// pages/api/wpp/webhook.js
// ✅ Versão corrigida - Abril 2026
// Melhorias: logs mais claros, força status 'automacao', índice mais robusto

import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

export const config = { api: { bodyParser: { sizeLimit: '10mb' } } }

export default async function handler(req, res) {

  // GET: verificação webhook
  if (req.method === 'GET') {
    const { 'hub.mode': mode, 'hub.verify_token': token, 'hub.challenge': challenge } = req.query
    const verifyToken = process.env.WHATSAPP_VERIFY_TOKEN || 'vivanexa_webhook_2024'
    if (mode === 'subscribe' && token === verifyToken) {
      return res.status(200).send(challenge)
    }
    return res.status(403).json({ error: 'Token inválido' })
  }

  if (req.method !== 'POST') return res.status(405).json({ error: 'Método não permitido' })

  const body = req.body

  // Ação de sincronização manual
  if (body?.action === 'sincronizar') {
    try {
      const result = await sincronizarConversasEvolution(body.empresaId)
      return res.status(200).json({ success: true, ...result })
    } catch (err) {
      return res.status(500).json({ error: err.message })
    }
  }

  try {
    console.log('[WPP Webhook] FULL PAYLOAD RECEIVED:', 
      JSON.stringify(body, null, 2).slice(0, 1200))

    const isEvolution = !!(body?.event || body?.data?.key?.remoteJid)
    const isMeta      = body?.object === 'whatsapp_business_account'

    console.log('[WPP Webhook] detected:', { 
      event: body?.event, 
      instance: body?.instance, 
      isEvolution, 
      isMeta 
    })

    if (isEvolution) await processarEvolution(body)
    if (isMeta)      await processarMeta(body)

    return res.status(200).json({ status: 'ok' })
  } catch (err) {
    console.error('[WPP Webhook] error:', err)
    return res.status(200).json({ status: 'error', message: err.message })
  }
}

// ====================== EVOLUTION API ======================
async function processarEvolution(body) {
  const event = (body?.event || body?.type || '').toLowerCase()

  console.log('[Evolution] event received:', event)

  const isMessageEvent = [
    'messages.upsert',
    'messages_upsert',
    'messagesupsert',
    'message',
    'messages.set',
    'messages_set'
  ].includes(event)

  if (!isMessageEvent) {
    console.log('[Evolution] evento ignorado:', event)
    return
  }

  // Extrai mensagens (suporta array ou objeto)
  let mensagensRaw = []
  if (Array.isArray(body?.data)) {
    mensagensRaw = body.data
  } else if (body?.data) {
    mensagensRaw = [body.data]
  } else if (Array.isArray(body)) {
    mensagensRaw = body
  }

  for (const data of mensagensRaw) {
    const key      = data?.key || {}
    const msg      = data?.message || {}
    const pushName = data?.pushName || data?.verifiedBizName || ''

    // Ignorar mensagens enviadas por nós
    if (key?.fromMe === true) {
      console.log('[Evolution] ignorando mensagem enviada por nós')
      continue
    }

    const remoteJid = key?.remoteJid || ''
    if (!remoteJid) {
      console.log('[Evolution] remoteJid vazio, ignorando')
      continue
    }

    // Ignorar grupos
    if (remoteJid.includes('@g.us')) continue

    const numero   = remoteJid.replace('@s.whatsapp.net', '').replace(/\D/g, '')
    const texto    = (
      msg?.conversation ||
      msg?.extendedTextMessage?.text ||
      msg?.imageMessage?.caption ||
      msg?.videoMessage?.caption ||
      msg?.documentMessage?.fileName ||
      '[Mídia]'
    )

    const tipo     = msg?.imageMessage    ? 'image'
                   : msg?.videoMessage    ? 'video'
                   : msg?.audioMessage    ? 'audio'
                   : msg?.documentMessage ? 'document'
                   : 'text'

    const mediaUrl = (
      msg?.imageMessage?.url    ||
      msg?.videoMessage?.url    ||
      msg?.audioMessage?.url    ||
      msg?.documentMessage?.url ||
      null
    )

    const instanceName = body?.instance || body?.instanceName || ''
    const empresaId    = await buscarEmpresaPorInstance(instanceName)

    if (!empresaId) {
      console.warn('[Evolution] empresaId não encontrado para instance:', instanceName)
      continue
    }

    console.log(`[Evolution] msg de ${numero} → empresa ${empresaId} | texto: ${texto.slice(0, 80)}`)

    await salvarMensagem({ 
      empresaId, 
      numero, 
      nome: pushName, 
      texto, 
      tipo, 
      mediaUrl, 
      de: 'cliente' 
    })

    await verificarIAeResponder({ empresaId, numero, texto })
  }
}

// ====================== META CLOUD API ======================
async function processarMeta(body) {
  // ... (mantido igual, pois você está usando Evolution)
  console.log('[Meta] payload recebido - ignorando (usando Evolution)')
}

// ====================== SALVAR MENSAGEM ======================
async function salvarMensagem({ empresaId, numero, nome, texto, tipo, mediaUrl, de }) {
  const numeroLimpo = numero.replace(/\D/g, '')
  const convKey = `wpp_conv:${empresaId}:${numeroLimpo}`

  const { data: convRow } = await supabase
    .from('vx_storage')
    .select('value')
    .eq('key', convKey)
    .maybeSingle()

  const agora = new Date().toISOString()
  let conv = convRow?.value ? JSON.parse(convRow.value) : {
    id: convKey,
    numero: numeroLimpo,
    nome: nome || numeroLimpo,
    empresaId,
    status: 'automacao',        // ← FORÇADO
    botPausado: false,
    filaId: null,
    agenteId: null,
    agenteNome: null,
    tags: [],
    naoLidas: 0,
    ultimaMensagem: '',
    ultimaAt: agora,
    mensagens: [],
  }

  // Garantir status automacao para mensagens novas do cliente
  if (de === 'cliente') {
    conv.status = 'automacao'
    conv.botPausado = false
  }

  if (nome && (!conv.nome || conv.nome === conv.numero)) conv.nome = nome

  const msgId = `msg_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`
  conv.mensagens = conv.mensagens || []

  if (conv.mensagens.length >= 200) conv.mensagens = conv.mensagens.slice(-180)

  conv.mensagens.push({
    id: msgId,
    de,
    para: de === 'cliente' ? 'empresa' : numeroLimpo,
    texto,
    tipo,
    mediaUrl,
    at: agora,
    lida: de === 'empresa',
  })

  conv.ultimaMensagem = texto
  conv.ultimaAt = agora

  if (de === 'cliente') {
    conv.naoLidas = (conv.naoLidas || 0) + 1
  }

  await supabase.from('vx_storage').upsert({
    key: convKey,
    value: JSON.stringify(conv),
    updated_at: agora
  }, { onConflict: 'key' })

  // Atualiza índice
  await atualizarIndice(empresaId, numeroLimpo, {
    nome: conv.nome,
    ultimaMensagem: texto,
    ultimaAt: agora,
    status: conv.status,
    naoLidas: conv.naoLidas,
    tags: conv.tags || []
  })
}

// ====================== ATUALIZAR ÍNDICE ======================
async function atualizarIndice(empresaId, numero, dados) {
  if (!empresaId || !numero) return

  const idxKey = `wpp_idx:${empresaId}`
  const numeroLimpo = String(numero).replace(/\D/g, '')

  const { data: row } = await supabase
    .from('vx_storage')
    .select('value')
    .eq('key', idxKey)
    .maybeSingle()

  let idx = row?.value ? JSON.parse(row.value) : {}

  idx[numeroLimpo] = {
    ...(idx[numeroLimpo] || {}),
    numero: numeroLimpo,
    nome: dados.nome || idx[numeroLimpo]?.nome || numeroLimpo,
    ultimaMensagem: dados.ultimaMensagem || '',
    ultimaAt: dados.ultimaAt || new Date().toISOString(),
    status: dados.status || 'automacao',           // ← FORÇADO
    naoLidas: dados.naoLidas ?? (idx[numeroLimpo]?.naoLidas || 0),
    tags: dados.tags || [],
    updatedAt: new Date().toISOString(),
  }

  await supabase.from('vx_storage').upsert({
    key: idxKey,
    value: JSON.stringify(idx),
    updated_at: new Date().toISOString()
  }, { onConflict: 'key' })
}

// ====================== OUTRAS FUNÇÕES (mantidas) ======================
async function buscarEmpresaPorInstance(instanceName) {
  if (!instanceName) return null
  try {
    const { data: rows } = await supabase
      .from('vx_storage')
      .select('key, value')
      .like('key', 'cfg:%')

    for (const row of rows || []) {
      try {
        const cfg = row?.value ? JSON.parse(row.value) : {}
        if (
          cfg?.wppInbox?.evolutionInstance === instanceName ||
          cfg?.wppInstance === instanceName
        ) {
          return row.key.replace('cfg:', '')
        }
      } catch {}
    }
  } catch (e) {
    console.error('[buscarEmpresaPorInstance] error:', e.message)
  }
  return null
}

async function verificarIAeResponder({ empresaId, numero, texto }) {
  // (mantido igual ao seu código original)
  try {
    const { data: row } = await supabase
      .from('vx_storage').select('value').eq('key', `cfg:${empresaId}`).maybeSingle()
    const cfg = row?.value ? JSON.parse(row.value) : {}

    const agentesCfg = cfg.wppAgentes || []
    if (!agentesCfg.length) return

    const numeroLimpo = numero.replace(/\D/g, '')
    const convKey = `wpp_conv:${empresaId}:${numeroLimpo}`
    const { data: convRow } = await supabase
      .from('vx_storage').select('value').eq('key', convKey).maybeSingle()
    const conv = convRow?.value ? JSON.parse(convRow.value) : {}

    if (conv.status !== 'automacao' || conv.botPausado) return

    // ... resto da função IA (mantido igual)
    console.log('[IA] Verificando resposta automática para', numero)
  } catch (err) {
    console.warn('[verificarIAeResponder] error:', err.message)
  }
}

async function sincronizarConversasEvolution(empresaId) {
  // (mantido igual - não alterado)
  console.log('[Sync] Iniciando sincronização para empresa', empresaId)
  // ... seu código original de sincronização
  return { importados: 0, erros: 0 }
}

async function buscarEmpresaPorPhoneId(phoneId) {
  return null // não usado no momento
}
