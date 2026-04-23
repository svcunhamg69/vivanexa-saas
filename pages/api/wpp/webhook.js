// pages/api/wpp/webhook.js
// ══════════════════════════════════════════════════════
// Recebe eventos da Evolution API e persiste no Supabase
// no formato esperado pelo whatsapp-inbox.js
//
// IMPORTANTE: no Vercel, res.json() encerra a função.
// O processamento deve acontecer ANTES de responder.
// ══════════════════════════════════════════════════════

import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

export const config = { api: { bodyParser: { sizeLimit: '10mb' } } }

// ── Busca empresa pela instância ─────────────────────
async function getCfgPorInstancia(instanceName) {
  if (!instanceName) return null
  const { data: rows } = await supabase
    .from('vx_storage')
    .select('key, value')
    .like('key', 'cfg:%')
    .limit(300)

  if (!rows) return null

  const instLower = instanceName.toLowerCase()
  for (const row of rows) {
    try {
      const cfg = JSON.parse(row.value)
      const instancias = cfg.wppInbox?.instancias || []

      const match = instancias.find(i =>
        i.instance?.toLowerCase() === instLower
      )
      if (match) {
        return { cfg, empresaId: row.key.replace('cfg:', ''), instancia: match }
      }
      // Fallback: campo legado evolutionInstance
      if (cfg.wppInbox?.evolutionInstance?.toLowerCase() === instLower) {
        return {
          cfg,
          empresaId: row.key.replace('cfg:', ''),
          instancia: { id: 'inst_legacy', nome: 'Principal', instance: instanceName }
        }
      }
    } catch {}
  }
  return null
}

function gerarProtocolo() {
  const d = new Date().toISOString().slice(0, 10).replace(/-/g, '')
  return `ATD-${d}-${Math.floor(Math.random() * 90000) + 10000}`
}

function normalizarNumero(jid) {
  return (jid || '').replace('@s.whatsapp.net', '').replace('@c.us', '').replace(/\D/g, '')
}

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

function tipoMidia(msg) {
  if (!msg) return null
  const m = msg.message || msg
  if (m.imageMessage)            return 'image'
  if (m.videoMessage)            return 'video'
  if (m.audioMessage || m.pttMessage) return 'audio'
  if (m.documentMessage)         return 'document'
  if (m.stickerMessage)          return 'sticker'
  if (m.locationMessage)         return 'location'
  if (m.contactMessage)          return 'contact'
  return null
}

// ── Processa MESSAGES_UPSERT ──────────────────────────
async function processarMensagem(payload, instanceName) {
  const dados = await getCfgPorInstancia(instanceName)
  if (!dados) {
    console.warn('[webhook] Instância não encontrada:', instanceName)
    return
  }

  const { cfg, empresaId, instancia } = dados
  const messages = payload.data || payload.messages || []
  const msgList = Array.isArray(messages) ? messages : [messages]

  for (const msgEvento of msgList) {
    const key = msgEvento.key || {}
    const fromMe = key.fromMe === true
    const jid = key.remoteJid || ''

    if (jid.includes('@g.us') || jid.includes('@broadcast') || jid === 'status@broadcast') continue

    const numero = normalizarNumero(jid)
    if (!numero) continue

    const texto = extrairTexto(msgEvento)
    const midia = tipoMidia(msgEvento)
    const ts = msgEvento.messageTimestamp
      ? new Date(Number(msgEvento.messageTimestamp) * 1000).toISOString()
      : new Date().toISOString()
    const nomePushName = msgEvento.pushName || ''

    const textoFinal = texto || (midia ? (
      midia === 'audio'    ? '[Áudio]'    :
      midia === 'image'    ? '[Imagem]'   :
      midia === 'video'    ? '[Vídeo]'    :
      midia === 'document' ? '[Documento]' :
      midia === 'sticker'  ? '[Sticker]'  : '[Mídia]'
    ) : '')

    // Extrai base64 e mimetype da mídia
    // Evolution envia base64 completo quando webhook_base64: true
    let mediaBase64 = null
    let mimetype = null
    let mediaId = null
    if (midia) {
      const m = msgEvento.message || msgEvento
      const mediaMsg = (
        m.imageMessage || m.videoMessage || m.audioMessage ||
        m.pttMessage   || m.documentMessage || m.stickerMessage
      )
      if (mediaMsg) {
        mimetype  = mediaMsg.mimetype || null
        mediaId   = key.id || null
        // Evolution API com webhook_base64:true envia base64 no campo base64
        // O campo jpegThumbnail é apenas thumbnail (baixa qualidade) — NÃO usar para vídeo/áudio
        if (midia === 'image' || midia === 'sticker') {
          // Para imagens: usa base64 completo se disponível, senão thumbnail
          mediaBase64 = mediaMsg.base64 || mediaMsg.jpegThumbnail || null
        } else {
          // Para vídeo/áudio/doc: só usa se for base64 completo (não thumbnail)
          mediaBase64 = mediaMsg.base64 || null
        }
        // Tenta campo alternativo no evento raiz
        if (!mediaBase64 && msgEvento.base64) mediaBase64 = msgEvento.base64
      }
    }

    // Monta mensagem
    const novaMensagem = {
      id:          key.id || `msg_${Date.now()}_${Math.random().toString(36).slice(2)}`,
      fromMe,
      de:          fromMe ? 'empresa' : 'cliente',
      texto:       textoFinal,
      tipo:        midia || 'text',
      timestamp:   ts,
      lida:        fromMe,
      ...(mediaBase64 ? { mediaBase64, mimetype }   : {}),
      ...(mediaId     ? { mediaId }                  : {}),
      ...(mimetype    ? { mimetype }                 : {}),
    }

    // Carrega conversa existente
    const { data: convRow } = await supabase
      .from('vx_storage')
      .select('value')
      .eq('key', `wpp_conv:${empresaId}:${numero}`)
      .maybeSingle()

    const conv = convRow?.value ? JSON.parse(convRow.value) : {
      numero,
      nome:        nomePushName || numero,
      status:      'automacao',
      protocolo:   gerarProtocolo(),
      instanciaId: instancia.id,
      instancia:   instanceName,
      mensagens:   [],
      naoLidas:    0,
      criadoEm:    ts,
    }

    if (nomePushName && !fromMe && nomePushName !== numero) conv.nome = nomePushName
    if (!conv.instanciaId) conv.instanciaId = instancia.id
    if (!conv.instancia)   conv.instancia   = instanceName

    // Evita duplicatas pelo id
    const existe = (conv.mensagens || []).some(m => m.id === novaMensagem.id)
    if (!existe) {
      conv.mensagens = [...(conv.mensagens || []), novaMensagem]
    }

    conv.ultimaMensagem = textoFinal
    conv.ultimaAt       = ts
    conv.updatedAt      = ts

    if (!fromMe) {
      conv.naoLidas = (conv.naoLidas || 0) + 1
      if (conv.status === 'finalizado') {
        conv.status       = 'automacao'
        conv.botPausado   = false
        conv.protocolo    = gerarProtocolo()
        conv.finalizadoEm = null
      }
    }

    // Salva conversa
    await supabase.from('vx_storage').upsert(
      { key: `wpp_conv:${empresaId}:${numero}`, value: JSON.stringify(conv), updated_at: ts },
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
      nome:           conv.nome,
      ultimaMensagem: textoFinal,
      ultimaAt:       ts,
      updatedAt:      ts,
      status:         conv.status,
      naoLidas:       conv.naoLidas,
      instanciaId:    instancia.id,
      instancia:      instanceName,
    }

    await supabase.from('vx_storage').upsert(
      { key: `wpp_idx:${empresaId}`, value: JSON.stringify(idx), updated_at: ts },
      { onConflict: 'key' }
    )

    console.log(`[webhook] ✅ Mensagem salva: ${numero} | fromMe:${fromMe} | "${textoFinal.slice(0,50)}"`)

    // ✅ Aciona o motor do bot para mensagens recebidas (não enviadas)
    if (!fromMe) {
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL ||
        (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000')
      fetch(`${baseUrl}/api/wpp/bot`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ empresaId, numero, mensagem: textoFinal })
      }).catch(e => console.error('[webhook] Erro ao acionar bot:', e.message))
    }
  }
}

// ── Processa CONNECTION_UPDATE ────────────────────────
async function processarConexao(payload, instanceName) {
  const estado = payload.data?.state || payload.state || ''
  const numero = payload.data?.number || payload.data?.phone || payload.number || ''
  const profileName = payload.data?.profileName || payload.profileName || ''

  console.log(`[webhook] CONNECTION_UPDATE | ${instanceName} | estado: ${estado} | numero: ${numero}`)

  if (estado !== 'open') return

  const dados = await getCfgPorInstancia(instanceName)
  if (!dados) return

  const { cfg, empresaId, instancia } = dados

  if (numero) {
    const numLimpo = normalizarNumero(numero + (numero.includes('@') ? '' : '@s.whatsapp.net'))
    const instancias = cfg.wppInbox?.instancias || []
    const instanciasAtualizadas = instancias.map(i =>
      i.id === instancia.id || i.instance?.toLowerCase() === instanceName.toLowerCase()
        ? { ...i, numero: numLimpo || i.numero, status: 'open', profileName: profileName || i.profileName }
        : i
    )
    const novoCfg = { ...cfg, wppInbox: { ...cfg.wppInbox, instancias: instanciasAtualizadas } }
    await supabase.from('vx_storage').upsert(
      { key: `cfg:${empresaId}`, value: JSON.stringify(novoCfg), updated_at: new Date().toISOString() },
      { onConflict: 'key' }
    )
    console.log(`[webhook] ✅ Número ${numLimpo} salvo na instância ${instanceName}`)
  }
}

// ── Handler principal ─────────────────────────────────
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método não permitido' })

  const instanceName = (
    req.headers['instance'] ||
    req.headers['instancename'] ||
    req.body?.instance ||
    req.body?.instanceName ||
    req.body?.sender ||
    ''
  ).toString().trim()

  const evento = (req.body?.event || req.body?.type || '').toString()
  const eventoNorm = evento.toLowerCase().replace(/\./g, '_')

  console.log('[webhook] evento:', evento, '| eventoNorm:', eventoNorm, '| instance:', instanceName)
  console.log('[webhook] body keys:', Object.keys(req.body || {}).join(','))

  // ✅ CORREÇÃO CRÍTICA: processa ANTES de responder
  // No Vercel, res.json() encerra a serverless function.
  // Código após res.json() NÃO executa.
  try {
    if (eventoNorm === 'messages_upsert') {
      await processarMensagem(req.body, instanceName)
    } else if (eventoNorm === 'connection_update') {
      await processarConexao(req.body, instanceName)
    } else {
      console.log('[webhook] Evento ignorado:', evento)
    }
  } catch (err) {
    console.error('[webhook] Erro:', err.message)
  }

  // Responde DEPOIS de processar
  return res.status(200).json({ ok: true, evento: eventoNorm, instance: instanceName })
}
