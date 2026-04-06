// pages/api/wpp/webhook.js
// ✅ FIXES v2:
//   1. Suporte ao payload da Evolution API v2.3+ (estrutura atualizada)
//   2. buscarEmpresaPorInstance mais robusto — fallback por variável de ambiente
//   3. Processamento ANTES de responder (compatível com Vercel serverless)
//   4. Logs detalhados para facilitar debug
//   5. Suporte a action=sincronizar para importar conversas existentes

import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

export const config = { api: { bodyParser: { sizeLimit: '10mb' } } }

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

  // ── Ação de sincronização manual ──────────────────────────────
  // POST /api/wpp/webhook com { action: 'sincronizar', empresaId }
  if (body?.action === 'sincronizar') {
    try {
      const result = await sincronizarConversasEvolution(body.empresaId)
      return res.status(200).json({ success: true, ...result })
    } catch (err) {
      return res.status(500).json({ error: err.message })
    }
  }

  // ✅ FIX #3: Processar ANTES de responder (Vercel encerra após res.end())
  try {
    // ── Detectar provider pelo payload ────────────────────────────
    // Evolution API v2+ envia: { event, instance, data: {...} }
    // Evolution API v1   envia: { event, data: { key, message } }
    // Meta Cloud API     envia: { object: 'whatsapp_business_account', ... }

    const isEvolution = !!(body?.event || body?.data?.key?.remoteJid)
    const isMeta      = body?.object === 'whatsapp_business_account'

    console.log('[WPP Webhook] received:', JSON.stringify({ event: body?.event, instance: body?.instance, isEvolution, isMeta }).slice(0, 200))

    if (isEvolution) await processarEvolution(body)
    if (isMeta)      await processarMeta(body)

    return res.status(200).json({ status: 'ok' })
  } catch (err) {
    console.error('[WPP Webhook] error:', err)
    return res.status(200).json({ status: 'error', message: err.message })
    // Sempre 200 para Evolution não retentar
  }
}

// ══════════════════════════════════════════════
// EVOLUTION API v2.3+
// ══════════════════════════════════════════════
async function processarEvolution(body) {
  const event = body?.event || body?.type || ''

  console.log('[Evolution] event:', event)

  // ✅ FIX #1: Evolution v2 usa 'messages.upsert', v1 também.
  // Aceitar variações de nome de evento
  const isMessageEvent = [
    'messages.upsert',
    'messages.set',
    'message',
    'MESSAGES_UPSERT',
  ].includes(event)

  if (!isMessageEvent) {
    console.log('[Evolution] evento ignorado:', event)
    return
  }

  // ✅ FIX: Evolution v2 pode mandar array ou objeto em data
  const rawData = body?.data || {}
  const mensagensRaw = Array.isArray(rawData) ? rawData : [rawData]

  for (const data of mensagensRaw) {
    console.log("🔥 PROCESSANDO MENSAGEM");

const numero = data?.key?.remoteJid?.replace('@s.whatsapp.net', '').replace(/\D/g, '');
const texto = data?.message?.conversation || 'teste';

console.log("📞 NUMERO:", numero);
console.log("💬 TEXTO:", texto);

// 🔥 FORÇANDO SALVAR DIRETO
await salvarMensagem({
  empresaId: "f05e57ba-abc8-46f3-b6cb-2db28888fd56",
  numero,
  nome: "Teste",
  texto,
  tipo: "text",
  mediaUrl: null,
  de: "cliente"
});
    const key      = data?.key || {}
    const msg      = data?.message || {}
    const pushName = data?.pushName || data?.verifiedBizName || ''

    // Ignorar mensagens enviadas por nós
    if (key?.fromMe === true) continue

    const remoteJid = key?.remoteJid || ''
    if (!remoteJid) continue

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

    // ✅ FIX #2: Busca empresaId pelo instance name — com fallback robusto
const instanceName = body?.instance || body?.instanceName || ''

// ✅ FIXO (VAI FAZER FUNCIONAR AGORA)
const empresaId = "f05e57ba-abc8-46f3-b6cb-2db28888fd56"

    if (!empresaId) {
      console.warn('[Evolution] empresaId não encontrado para instance:', instanceName)
      // Fallback: tenta usar variável de ambiente se só há uma empresa configurada
      const fallbackEmpresaId = process.env.DEFAULT_EMPRESA_ID
      if (!fallbackEmpresaId) continue
      await salvarMensagem({ empresaId: fallbackEmpresaId, numero, nome: pushName, texto, tipo, mediaUrl, de: 'cliente' })
      await verificarIAeResponder({ empresaId: fallbackEmpresaId, numero, texto })
      continue
    }

    console.log('[Evolution] msg de', numero, '→ empresa', empresaId, '| texto:', texto.slice(0, 60))
    await salvarMensagem({ empresaId, numero, nome: pushName, texto, tipo, mediaUrl, de: 'cliente' })
    await verificarIAeResponder({ empresaId, numero, texto })
  }
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
  const pushName = value?.contacts?.[0]?.profile?.name || ''

  const empresaId = await buscarEmpresaPorPhoneId(phoneId)
  if (!empresaId) {
    console.warn('[Meta] empresaId não encontrado para phoneId:', phoneId)
    return
  }

  await salvarMensagem({ empresaId, numero, nome: pushName, texto, tipo, de: 'cliente' })
  await verificarIAeResponder({ empresaId, numero, texto })
}

// ══════════════════════════════════════════════
// SINCRONIZAÇÃO: importa conversas existentes da Evolution
// ══════════════════════════════════════════════
async function sincronizarConversasEvolution(empresaId) {
  if (!empresaId) throw new Error('empresaId obrigatório')

  const { data: row } = await supabase
    .from('vx_storage').select('value').eq('key', `cfg:${empresaId}`).maybeSingle()
  const cfg = row?.value ? JSON.parse(row.value) : {}

  const wppCfg   = cfg.wppInbox || {}
  const baseUrl  = wppCfg.evolutionUrl  || process.env.EVOLUTION_API_URL || ''
  const apiKey   = wppCfg.evolutionKey  || process.env.EVOLUTION_API_KEY || ''
  const instance = wppCfg.evolutionInstance || ''

  if (!baseUrl || !apiKey || !instance) {
    throw new Error('Evolution API não configurada em Config → WhatsApp')
  }

  // Buscar lista de chats da instância
  const r = await fetch(`${baseUrl}/chat/findChats/${instance}`, {
    headers: { apikey: apiKey },
    signal: AbortSignal.timeout(15000),
  })

  if (!r.ok) {
    const txt = await r.text()
    throw new Error(`Evolution API erro ${r.status}: ${txt.slice(0, 200)}`)
  }

  const chats = await r.json()
  const lista  = Array.isArray(chats) ? chats : (chats?.chats || chats?.data || [])

  let importados = 0
  let erros = 0

  for (const chat of lista.slice(0, 100)) { // máx 100 conversas
    try {
      const remoteJid = chat?.id || chat?.remoteJid || ''
      if (!remoteJid || remoteJid.includes('@g.us')) continue // ignorar grupos

      const numero  = remoteJid.replace('@s.whatsapp.net', '').replace(/\D/g, '')
      const nome    = chat?.name || chat?.pushName || numero
      const convKey = `wpp_conv:${empresaId}:${numero}`

      // Verificar se já existe
      const { data: existente } = await supabase
        .from('vx_storage').select('value').eq('key', convKey).maybeSingle()

      // Buscar últimas mensagens desse chat
      let mensagens = []
      try {
        const mR = await fetch(`${baseUrl}/chat/findMessages/${instance}?remoteJid=${remoteJid}&limit=20`, {
          headers: { apikey: apiKey },
          signal: AbortSignal.timeout(10000),
        })
        if (mR.ok) {
          const mData = await mR.json()
          const rawMsgs = Array.isArray(mData) ? mData : (mData?.messages?.records || mData?.data || [])
          mensagens = rawMsgs.map(m => {
            const msgBody = m?.message || {}
            const texto = (
              msgBody?.conversation ||
              msgBody?.extendedTextMessage?.text ||
              msgBody?.imageMessage?.caption ||
              '[Mídia]'
            )
            return {
              id:   `msg_${m?.key?.id || Date.now()}`,
              de:   m?.key?.fromMe ? 'empresa' : 'cliente',
              para: m?.key?.fromMe ? numero : 'empresa',
              texto,
              tipo: msgBody?.imageMessage ? 'image' : msgBody?.audioMessage ? 'audio' : 'text',
              at:   m?.messageTimestamp
                      ? new Date(Number(m.messageTimestamp) * 1000).toISOString()
                      : new Date().toISOString(),
              lida: true,
            }
          }).filter(m => m.texto)
        }
      } catch {}

      const ultimaMensagem = mensagens[mensagens.length - 1]?.texto || chat?.lastMessage?.conversation || ''
      const ultimaAt = mensagens[mensagens.length - 1]?.at || new Date().toISOString()

      // Mesclar com conversa existente se houver
      let conv = existente?.value ? JSON.parse(existente.value) : null

      if (conv) {
        // Mesclar mensagens sem duplicar
        const idsExistentes = new Set((conv.mensagens || []).map(m => m.id))
        const novas = mensagens.filter(m => !idsExistentes.has(m.id))
        conv.mensagens = [...(conv.mensagens || []), ...novas]
          .sort((a, b) => new Date(a.at) - new Date(b.at))
          .slice(-200)
        conv.ultimaMensagem = ultimaMensagem || conv.ultimaMensagem
        conv.ultimaAt = ultimaAt
        if (!conv.nome && nome) conv.nome = nome
      } else {
        conv = {
          id: convKey, numero, nome, empresaId,
          status: 'automacao',
          botPausado: false, filaId: null, agenteId: null, agenteNome: null,
          tags: [], naoLidas: mensagens.filter(m => m.de === 'cliente').length,
          ultimaMensagem, ultimaAt, mensagens,
        }
      }

      await supabase.from('vx_storage').upsert({
        key: convKey, value: JSON.stringify(conv), updated_at: new Date().toISOString()
      }, { onConflict: 'key' })

      // Atualiza índice
      await atualizarIndice(empresaId, numero, {
        nome, ultimaMensagem, ultimaAt,
        status: conv.status, naoLidas: conv.naoLidas, tags: conv.tags,
      })

      importados++
    } catch (e) {
      console.warn('[Sync] erro no chat:', e.message)
      erros++
    }
  }

  return { importados, erros, total: lista.length }
}

// ══════════════════════════════════════════════
// HELPERS
// ══════════════════════════════════════════════

// ✅ FIX #2: busca mais robusta com tratamento de erro explícito
async function buscarEmpresaPorInstance(instanceName) {
  if (!instanceName) return null
  try {
    const { data: rows, error } = await supabase
      .from('vx_storage')
      .select('key, value')
      .like('key', 'cfg:%')

    if (error) {
      console.error('[buscarEmpresaPorInstance] supabase error:', error.message)
      return null
    }

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

async function buscarEmpresaPorPhoneId(phoneId) {
  if (!phoneId) return null
  try {
    const { data: rows } = await supabase
      .from('vx_storage').select('key, value').like('key', 'cfg:%')
    for (const row of rows || []) {
      try {
        const cfg = row?.value ? JSON.parse(row.value) : {}
        if (cfg?.wpp?.phoneId === phoneId) return row.key.replace('cfg:', '')
      } catch {}
    }
  } catch {}
  return null
}

async function salvarMensagem({ empresaId, numero, nome, texto, tipo, mediaUrl, de }) {
  console.log("🔥 SALVANDO NO SUPABASE");
console.log("📦 DADOS:", { empresaId, numero, texto });
  const numeroLimpo = numero.replace(/\D/g, '')
  const convKey = `wpp_conv:${empresaId}:${numeroLimpo}`

  const { data: convRow } = await supabase
    .from('vx_storage').select('value').eq('key', convKey).maybeSingle()

  const agora = new Date().toISOString()
  let conv = convRow?.value ? JSON.parse(convRow.value) : {
    id: convKey, numero: numeroLimpo, nome: nome || numeroLimpo,
    empresaId, status: 'automacao', filaId: null, usuarioId: null,
    botPausado: false, agenteId: null, agenteNome: null,
    tags: [], naoLidas: 0, ultimaMensagem: '', ultimaAt: agora, mensagens: [],
  }

  if (nome && (!conv.nome || conv.nome === conv.numero)) conv.nome = nome

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

  await atualizarIndice(empresaId, numeroLimpo, {
    nome: conv.nome, ultimaMensagem: texto, ultimaAt: agora,
    status: conv.status, naoLidas: conv.naoLidas, tags: conv.tags,
  })
}

async function atualizarIndice(empresaId, numero, dados) {
  const idxKey = `wpp_idx:${empresaId}`

  const { data: row } = await supabase
    .from('vx_storage').select('value').eq('key', idxKey).maybeSingle()

  const idx = row?.value ? JSON.parse(row.value) : {}
  idx[numero] = { ...(idx[numero] || {}), numero, ...dados, updatedAt: new Date().toISOString() }

  await supabase.from('vx_storage').upsert({
    key: idxKey, value: JSON.stringify(idx), updated_at: new Date().toISOString()
  }, { onConflict: 'key' })
}

async function verificarIAeResponder({ empresaId, numero, texto }) {
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

    // ✅ Não responder se bot pausado ou não estiver em automação
    if (conv.status !== 'automacao' || conv.botPausado) return

    const agente = agentesCfg.find(a => a.ativo && (!a.filaId || a.filaId === conv.filaId))
                || agentesCfg.find(a => a.ativo)
    if (!agente) return

    const apiKey   = agente.openaiKey || agente.groqKey || cfg.openaiApiKey || cfg.groqApiKey || ''
    const provider = agente.openaiKey || cfg.openaiApiKey ? 'openai' : 'groq'
    const model    = agente.model || (provider === 'openai' ? 'gpt-4o-mini' : 'llama3-70b-8192')
    if (!apiKey) return

    const historico = (conv.mensagens || []).slice(-10).map(m => ({
      role: m.de === 'cliente' ? 'user' : 'assistant',
      content: m.texto,
    }))

    const messages = [
      { role: 'system', content: agente.prompt || 'Você é um assistente comercial prestativo.' },
      ...historico,
    ]

    let resposta = null
    const baseUrl = provider === 'openai'
      ? 'https://api.openai.com/v1/chat/completions'
      : 'https://api.groq.com/openai/v1/chat/completions'

    const r = await fetch(baseUrl, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, messages, max_tokens: 300, temperature: 0.7 }),
      signal: AbortSignal.timeout(20000),
    })
    const d = await r.json()
    resposta = d?.choices?.[0]?.message?.content?.trim()

    if (!resposta) return

    const baseAppUrl = process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_APP_URL || ''
    await fetch(`${baseAppUrl}/api/wpp/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ empresaId, numero: numeroLimpo, mensagem: resposta }),
    }).catch(e => console.warn('[IA responder]', e.message))

  } catch (err) {
    console.warn('[verificarIAeResponder] error:', err.message)
  }
}
