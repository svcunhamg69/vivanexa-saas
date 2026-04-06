// pages/api/wpp/webhook.js
// Recebe eventos da Evolution API (QR Code) e da Meta Cloud API
// Salva mensagens no vx_storage e aciona IA se configurado

import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

export const config = { api: { bodyParser: { sizeLimit: '5mb' } } }

export default async function handler(req, res) {

  // ── GET: verificação webhook Meta ─────────────────────────────
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
  res.status(200).json({ status: 'ok' }) // responde imediatamente

  try {
    // ── Detectar provider pelo payload ────────────────────────────
    const isEvolution = !!(body?.data?.key?.remoteJid || body?.event)
    const isMeta      = body?.object === 'whatsapp_business_account'

    if (isEvolution) await processarEvolution(body)
    if (isMeta)      await processarMeta(body)
  } catch (err) {
    console.error('Webhook error:', err)
  }
}

// ══════════════════════════════════════════════
// EVOLUTION API
// ══════════════════════════════════════════════
async function processarEvolution(body) {
  const event = body?.event || ''

  // Apenas mensagens recebidas
  if (!['messages.upsert', 'messages.set'].includes(event)) return

  const data    = body?.data || {}
  const key     = data?.key || {}
  const msg     = data?.message || {}
  const pushName= data?.pushName || ''

  // Ignorar mensagens enviadas por nós
  if (key?.fromMe) return

  const remoteJid = key?.remoteJid || ''
  // Ignorar grupos
  if (remoteJid.includes('@g.us')) return

  const numero   = remoteJid.replace('@s.whatsapp.net', '').replace(/\D/g, '')
  const texto    = msg?.conversation || msg?.extendedTextMessage?.text || msg?.imageMessage?.caption || '[Mídia]'
  const tipo     = msg?.imageMessage ? 'image' : msg?.videoMessage ? 'video' : msg?.audioMessage ? 'audio' : msg?.documentMessage ? 'document' : 'text'
  const mediaUrl = msg?.imageMessage?.url || msg?.videoMessage?.url || msg?.audioMessage?.url || msg?.documentMessage?.url || null

  // Tentar identificar empresaId pelo instanceId no body
  const instanceName = body?.instance || body?.instanceName || ''
  const empresaId    = await buscarEmpresaPorInstance(instanceName)
  if (!empresaId) return

  await salvarMensagem({ empresaId, numero, nome: pushName, texto, tipo, mediaUrl, de: 'cliente' })
  await verificarIAeResponder({ empresaId, numero, texto })
}

// ══════════════════════════════════════════════
// META CLOUD API
// ══════════════════════════════════════════════
async function processarMeta(body) {
  const entry   = body?.entry?.[0]
  const change  = entry?.changes?.[0]
  const value   = change?.value
  const message = value?.messages?.[0]
  if (!message) return

  const numero   = message.from
  const texto    = message.text?.body || '[Mídia]'
  const tipo     = message.type || 'text'
  const phoneId  = value?.metadata?.phone_number_id

  // Buscar empresa pelo phoneId
  const empresaId = await buscarEmpresaPorPhoneId(phoneId)
  if (!empresaId) return

  const pushName = value?.contacts?.[0]?.profile?.name || ''

  await salvarMensagem({ empresaId, numero, nome: pushName, texto, tipo, de: 'cliente' })
  await verificarIAeResponder({ empresaId, numero, texto })
}

// ══════════════════════════════════════════════
// HELPERS
// ══════════════════════════════════════════════
async function buscarEmpresaPorInstance(instanceName) {
  if (!instanceName) return null
  try {
    const { data: rows } = await supabase
      .from('vx_storage')
      .select('key, value')
      .like('key', 'cfg:%')
    for (const row of rows || []) {
      const cfg = row?.value ? JSON.parse(row.value) : {}
      if (cfg?.wppInbox?.evolutionInstance === instanceName) {
        return row.key.replace('cfg:', '')
      }
    }
  } catch {}
  return null
}

async function buscarEmpresaPorPhoneId(phoneId) {
  if (!phoneId) return null
  try {
    const { data: rows } = await supabase
      .from('vx_storage').select('key, value').like('key', 'cfg:%')
    for (const row of rows || []) {
      const cfg = row?.value ? JSON.parse(row.value) : {}
      if (cfg?.wpp?.phoneId === phoneId) return row.key.replace('cfg:', '')
    }
  } catch {}
  return null
}

async function salvarMensagem({ empresaId, numero, nome, texto, tipo, mediaUrl, de }) {
  const numeroLimpo = numero.replace(/\D/g, '')
  const convKey = `wpp_conv:${empresaId}:${numeroLimpo}`

  const { data: convRow } = await supabase
    .from('vx_storage').select('value').eq('key', convKey).single().catch(() => ({ data: null }))

  const agora = new Date().toISOString()
  let conv = convRow?.value ? JSON.parse(convRow.value) : {
    id: convKey, numero: numeroLimpo, nome: nome || numeroLimpo,
    empresaId, status: 'automacao', filaId: null, usuarioId: null,
    tags: [], naoLidas: 0, ultimaMensagem: '', ultimaAt: agora, mensagens: [],
  }

  // Atualiza nome se vier
  if (nome && !conv.nome) conv.nome = nome

  const msgId = `msg_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`
  conv.mensagens = conv.mensagens || []

  // Limitar histórico a 200 msgs
  if (conv.mensagens.length >= 200) conv.mensagens = conv.mensagens.slice(-180)

  conv.mensagens.push({
    id: msgId, de, para: de === 'cliente' ? 'empresa' : numeroLimpo,
    texto, tipo, mediaUrl, at: agora, lida: de === 'empresa',
  })
  conv.ultimaMensagem = texto
  conv.ultimaAt = agora
  if (de === 'cliente') conv.naoLidas = (conv.naoLidas || 0) + 1

  await supabase.from('vx_storage').upsert({
    key: convKey, value: JSON.stringify(conv), updated_at: agora
  }, { onConflict: 'key' })

  // Atualiza índice de conversas
  await atualizarIndice(empresaId, numeroLimpo, {
    nome: conv.nome, ultimaMensagem: texto, ultimaAt: agora,
    status: conv.status, naoLidas: conv.naoLidas, tags: conv.tags,
  })
}

async function atualizarIndice(empresaId, numero, dados) {
  const idxKey = `wpp_idx:${empresaId}`
  const { data: row } = await supabase
    .from('vx_storage').select('value').eq('key', idxKey).single().catch(() => ({ data: null }))

  const idx = row?.value ? JSON.parse(row.value) : {}
  idx[numero] = { ...(idx[numero] || {}), numero, ...dados, updatedAt: new Date().toISOString() }

  await supabase.from('vx_storage').upsert({
    key: idxKey, value: JSON.stringify(idx), updated_at: new Date().toISOString()
  }, { onConflict: 'key' })
}

async function verificarIAeResponder({ empresaId, numero, texto }) {
  try {
    const { data: row } = await supabase
      .from('vx_storage').select('value').eq('key', `cfg:${empresaId}`).single()
    const cfg = row?.value ? JSON.parse(row.value) : {}

    const agentesCfg = cfg.wppAgentes || []
    if (!agentesCfg.length) return

    // Verificar se conversa está em modo automacao
    const numeroLimpo = numero.replace(/\D/g, '')
    const convKey = `wpp_conv:${empresaId}:${numeroLimpo}`
    const { data: convRow } = await supabase
      .from('vx_storage').select('value').eq('key', convKey).single().catch(() => ({ data: null }))
    const conv = convRow?.value ? JSON.parse(convRow.value) : {}

    if (conv.status !== 'automacao') return

    // Pega primeiro agente ativo da fila da conversa (ou qualquer ativo)
    const agente = agentesCfg.find(a => a.ativo && (!a.filaId || a.filaId === conv.filaId)) || agentesCfg.find(a => a.ativo)
    if (!agente) return

    const apiKey   = agente.openaiKey || agente.groqKey || cfg.openaiApiKey || cfg.groqApiKey || ''
    const provider = agente.openaiKey || cfg.openaiApiKey ? 'openai' : 'groq'
    const model    = agente.model || (provider === 'openai' ? 'gpt-4o-mini' : 'llama3-70b-8192')

    if (!apiKey) return

    // Monta histórico das últimas 10 mensagens
    const historico = (conv.mensagens || []).slice(-10).map(m => ({
      role: m.de === 'cliente' ? 'user' : 'assistant',
      content: m.texto,
    }))

    const messages = [
      { role: 'system', content: agente.prompt || 'Você é um assistente comercial prestativo.' },
      ...historico,
    ]

    let resposta = null

    if (provider === 'openai') {
      const r = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model, messages, max_tokens: 300, temperature: 0.7 }),
        signal: AbortSignal.timeout(20000),
      })
      const d = await r.json()
      resposta = d?.choices?.[0]?.message?.content?.trim()
    } else {
      const r = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model, messages, max_tokens: 300, temperature: 0.7 }),
        signal: AbortSignal.timeout(20000),
      })
      const d = await r.json()
      resposta = d?.choices?.[0]?.message?.content?.trim()
    }

    if (!resposta) return

    // Enviar resposta
    await fetch(`${process.env.NEXTAUTH_URL || ''}/api/wpp/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ empresaId, numero: numeroLimpo, mensagem: resposta }),
    }).catch(() => {})

  } catch (err) {
    console.warn('IA responder error:', err.message)
  }
}
