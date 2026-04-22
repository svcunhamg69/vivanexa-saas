// pages/api/wpp/webhook.js
// ══════════════════════════════════════════════════════
// Recebe eventos da Evolution API e persiste no Supabase
// no formato esperado pelo whatsapp-inbox.js
//
// Eventos tratados:
//  - MESSAGES_UPSERT   → salva mensagem + atualiza índice
//  - CONNECTION_UPDATE → atualiza status da instância
//  - QRCODE_UPDATED    → (ignorado aqui — tratado via polling)
// ══════════════════════════════════════════════════════

import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

export const config = { api: { bodyParser: { sizeLimit: '10mb' } } }

// ── Helper: carrega cfg da empresa pela instância ────────
async function getCfgPorInstancia(instanceName) {
  // Busca todas as empresas que têm essa instância cadastrada
  // Faz scan no vx_storage procurando por instanceName (limitado a 200 registros)
  const { data: rows } = await supabase
    .from('vx_storage')
    .select('key, value')
    .like('key', 'cfg:%')
    .limit(200)

  if (!rows) return null

  for (const row of rows) {
    try {
      const cfg = JSON.parse(row.value)
      const instancias = cfg.wppInbox?.instancias || []
      const match = instancias.find(
        i => i.instance === instanceName || i.instance?.toLowerCase() === instanceName?.toLowerCase()
      )
      if (match) {
        const empresaId = row.key.replace('cfg:', '')
        return { cfg, empresaId, instancia: match }
      }
      // Também checa o campo legado evolutionInstance
      if (cfg.wppInbox?.evolutionInstance === instanceName || cfg.wppInbox?.evolutionInstance?.toLowerCase() === instanceName?.toLowerCase()) {
        const empresaId = row.key.replace('cfg:', '')
        return { cfg, empresaId, instancia: { id: 'default', nome: 'Principal', instance: instanceName } }
      }
    } catch {}
  }
  return null
}

// ── Helper: gera protocolo ────────────────────────────
function gerarProtocolo() {
  const now = new Date()
  const d = now.toISOString().slice(0, 10).replace(/-/g, '')
  const t = Math.floor(Math.random() * 90000) + 10000
  return `ATD-${d}-${t}`
}

// ── Helper: normaliza número ──────────────────────────
function normalizarNumero(jid) {
  if (!jid) return ''
  return jid.replace('@s.whatsapp.net', '').replace('@c.us', '').replace(/\D/g, '')
}

// ── Helper: extrai texto da mensagem ─────────────────
function extrairTexto(msg) {
  if (!msg) return ''
  const m = msg.message || msg
  return (
    m.conversation ||
    m.extendedTextMessage?.text ||
    m.imageMessage?.caption ||
    m.videoMessage?.caption ||
    m.documentMessage?.caption ||
    m.documentWithCaptionMessage?.message?.documentMessage?.caption ||
    m.buttonsResponseMessage?.selectedDisplayText ||
    m.listResponseMessage?.title ||
    m.templateButtonReplyMessage?.selectedDisplayText ||
    ''
  )
}

// ── Helper: tipo de mídia ─────────────────────────────
function tipoMidia(msg) {
  if (!msg) return null
  const m = msg.message || msg
  if (m.imageMessage)    return 'image'
  if (m.videoMessage)    return 'video'
  if (m.audioMessage || m.pttMessage) return 'audio'
  if (m.documentMessage) return 'document'
  if (m.stickerMessage)  return 'sticker'
  if (m.locationMessage) return 'location'
  if (m.contactMessage)  return 'contact'
  return null
}

// ── Processa MESSAGES_UPSERT ──────────────────────────
async function processarMensagem(payload, instanceName) {
  const dados = await getCfgPorInstancia(instanceName)
  if (!dados) {
    console.warn('[webhook] Instância não encontrada:', instanceName)
    return { ok: false, reason: 'instancia_nao_encontrada' }
  }

  const { cfg, empresaId, instancia } = dados
  const messages = payload.data || payload.messages || []
  const msgList = Array.isArray(messages) ? messages : [messages]

  for (const msgEvento of msgList) {
    const key = msgEvento.key || {}
    const fromMe = key.fromMe === true
    const jid = key.remoteJid || ''

    // Ignora grupos e status
    if (jid.includes('@g.us') || jid.includes('@broadcast') || jid === 'status@broadcast') continue

    const numero = normalizarNumero(jid)
    if (!numero) continue

    const texto = extrairTexto(msgEvento)
    const midia = tipoMidia(msgEvento)
    const timestamp = msgEvento.messageTimestamp
      ? new Date(Number(msgEvento.messageTimestamp) * 1000).toISOString()
      : new Date().toISOString()

    // Nome do contato
    const nomePushName = msgEvento.pushName || msgEvento.verifiedBizName || ''

    // Monta objeto da mensagem
    const novaMensagem = {
      id:        key.id || `msg_${Date.now()}`,
      fromMe,
      texto:     texto || (midia ? `[${midia === 'audio' ? 'Áudio' : midia === 'image' ? 'Imagem' : midia === 'video' ? 'Vídeo' : midia === 'document' ? 'Documento' : 'Mídia'}]` : ''),
      tipo:      midia || 'text',
      timestamp,
      lida:      fromMe,
    }

    // Carrega conversa existente
    const { data: convRow } = await supabase
      .from('vx_storage')
      .select('value')
      .eq('key', `wpp_conv:${empresaId}:${numero}`)
      .maybeSingle()

    const convAtual = convRow?.value ? JSON.parse(convRow.value) : null

    // Monta/atualiza conversa
    const conv = convAtual || {
      numero,
      nome:        nomePushName || numero,
      status:      'automacao',
      protocolo:   gerarProtocolo(),
      instanciaId: instancia.id,
      instancia:   instanceName,
      mensagens:   [],
      naoLidas:    0,
      criadoEm:    timestamp,
    }

    // Atualiza nome se recebemos o pushName
    if (nomePushName && !fromMe) conv.nome = nomePushName

    // Garante instanciaId
    if (!conv.instanciaId) conv.instanciaId = instancia.id

    // Evita mensagem duplicada
    const msgExiste = (conv.mensagens || []).some(m => m.id === novaMensagem.id)
    if (!msgExiste) {
      conv.mensagens = [...(conv.mensagens || []), novaMensagem]
    }

    // Atualiza contadores
    conv.ultimaMensagem = novaMensagem.texto
    conv.ultimaAt       = timestamp
    conv.updatedAt      = timestamp

    if (!fromMe) {
      conv.naoLidas = (conv.naoLidas || 0) + 1
      // Se estava finalizado e chegou nova mensagem → volta para automação
      if (conv.status === 'finalizado') {
        conv.status      = 'automacao'
        conv.botPausado  = false
        conv.protocolo   = gerarProtocolo()
        conv.finalizadoEm = null
      }
    }

    // Salva conversa
    await supabase.from('vx_storage').upsert(
      { key: `wpp_conv:${empresaId}:${numero}`, value: JSON.stringify(conv), updated_at: timestamp },
      { onConflict: 'key' }
    )

    // Atualiza índice
    const { data: idxRow } = await supabase
      .from('vx_storage')
      .select('value')
      .eq('key', `wpp_idx:${empresaId}`)
      .maybeSingle()

    const idx = idxRow?.value ? JSON.parse(idxRow.value) : {}
    idx[numero] = {
      numero,
      nome:          conv.nome,
      ultimaMensagem: conv.ultimaMensagem,
      ultimaAt:      timestamp,
      updatedAt:     timestamp,
      status:        conv.status,
      naoLidas:      conv.naoLidas,
      instanciaId:   instancia.id,
      instancia:     instanceName,
    }

    await supabase.from('vx_storage').upsert(
      { key: `wpp_idx:${empresaId}`, value: JSON.stringify(idx), updated_at: timestamp },
      { onConflict: 'key' }
    )
  }

  return { ok: true }
}

// ── Processa CONNECTION_UPDATE ────────────────────────
async function processarConexao(payload, instanceName) {
  const estado = payload.data?.state || payload.state || ''
  const numero = payload.data?.number || payload.number || ''

  if (!estado) return { ok: true }

  const dados = await getCfgPorInstancia(instanceName)
  if (!dados) return { ok: false, reason: 'instancia_nao_encontrada' }

  const { cfg, empresaId, instancia } = dados

  // Se conectou e tem número, salva automaticamente na instância
  if (estado === 'open' && numero) {
    const numLimpo = normalizarNumero(numero + '@s.whatsapp.net')
    const instancias = cfg.wppInbox?.instancias || []
    const instanciasAtualizadas = instancias.map(i =>
      i.id === instancia.id || i.instance === instanceName
        ? { ...i, numero: numLimpo, status: 'open' }
        : i
    )
    const novoCfg = { ...cfg, wppInbox: { ...cfg.wppInbox, instancias: instanciasAtualizadas } }
    await supabase.from('vx_storage').upsert(
      { key: `cfg:${empresaId}`, value: JSON.stringify(novoCfg), updated_at: new Date().toISOString() },
      { onConflict: 'key' }
    )
    console.log(`[webhook] ${instanceName} conectado! Número: ${numLimpo}`)
  }

  return { ok: true, estado, numero }
}

// ── Handler principal ─────────────────────────────────
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método não permitido' })

  // Evolution API envia o nome da instância no header ou no body
  const instanceName =
    req.headers['instance'] ||
    req.headers['instancename'] ||
    req.body?.instance ||
    req.body?.instanceName ||
    req.body?.sender ||
    ''

  const evento = req.body?.event || req.body?.type || ''

  console.log('[webhook] evento:', evento, '| instance:', instanceName)

  // Responde imediatamente para não bloquear a Evolution
  res.status(200).json({ ok: true })

  // Processa em background (não bloqueia a resposta)
  try {
    if (evento === 'messages.upsert' || evento === 'MESSAGES_UPSERT') {
      await processarMensagem(req.body, instanceName)
    } else if (evento === 'connection.update' || evento === 'CONNECTION_UPDATE') {
      await processarConexao(req.body, instanceName)
    }
    // QRCODE_UPDATED, CONTACTS_SET etc — ignorados por ora
  } catch (err) {
    console.error('[webhook] Erro:', err.message, err.stack?.slice(0, 200))
  }
}
