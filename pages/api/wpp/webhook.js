// pages/api/wpp/webhook.js — v3
// ✅ NÃO reseta status quando agente assumiu (botPausado=true ou atendendo/aguardando)
import { createClient } from '@supabase/supabase-js'
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
export const config = { api: { bodyParser: { sizeLimit: '10mb' } } }
export default async function handler(req, res) {
  if (req.method === 'GET') {
    const { 'hub.mode': mode, 'hub.verify_token': token, 'hub.challenge': challenge } = req.query
    if (mode === 'subscribe' && token === (process.env.WHATSAPP_VERIFY_TOKEN || 'vivanexa_webhook_2024')) return res.status(200).send(challenge)
    return res.status(403).json({ error: 'Token inválido' })
  }
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método não permitido' })
  const body = req.body
  try {
    const isEvolution = !!(body?.event || body?.data?.key?.remoteJid)
    const isMeta = body?.object === 'whatsapp_business_account'
    if (isEvolution) await processarEvolution(body)
    if (isMeta) await processarMeta(body)
    return res.status(200).json({ status: 'ok' })
  } catch (err) {
    console.error('[Webhook]', err)
    return res.status(200).json({ status: 'error', message: err.message })
  }
}
async function processarEvolution(body) {
  const event = (body?.event || '').toLowerCase()
  const isMsg = ['messages.upsert','messages_upsert','message','messages.set'].includes(event)
  if (!isMsg) return
  const msgs = Array.isArray(body?.data) ? body.data : body?.data ? [body.data] : []
  for (const data of msgs) {
    const key = data?.key || {}
    if (key?.fromMe) continue
    const remoteJid = key?.remoteJid || ''
    if (!remoteJid || remoteJid.includes('@g.us')) continue
    const numero = remoteJid.replace('@s.whatsapp.net','').replace(/\D/g,'')
    const msg = data?.message || {}
    const texto = msg?.conversation || msg?.extendedTextMessage?.text || msg?.imageMessage?.caption || msg?.videoMessage?.caption || msg?.documentMessage?.fileName || '[Mídia]'
    const tipo = msg?.imageMessage ? 'image' : msg?.videoMessage ? 'video' : msg?.audioMessage ? 'audio' : msg?.documentMessage ? 'document' : 'text'
    const mediaUrl = msg?.imageMessage?.url || msg?.videoMessage?.url || msg?.audioMessage?.url || null
    const instanceName = body?.instance || ''
    const empresaId = await buscarEmpresaPorInstance(instanceName)
    if (!empresaId) { console.warn('[Webhook] instance não encontrada:', instanceName); continue }
    await salvarMensagem({ empresaId, numero, nome: data?.pushName || '', texto, tipo, mediaUrl, de: 'cliente' })
    await verificarIAeResponder({ empresaId, numero, texto })
  }
}
async function processarMeta(body) {
  const message = body?.entry?.[0]?.changes?.[0]?.value?.messages?.[0]
  if (!message) return
  const phoneId = body?.entry?.[0]?.changes?.[0]?.value?.metadata?.phone_number_id
  const empresaId = await buscarEmpresaPorPhoneId(phoneId)
  if (!empresaId) return
  const numero = message.from
  const texto = message.text?.body || '[Mídia]'
  const nome = body?.entry?.[0]?.changes?.[0]?.value?.contacts?.[0]?.profile?.name || ''
  await salvarMensagem({ empresaId, numero, nome, texto, tipo: message.type || 'text', de: 'cliente' })
  await verificarIAeResponder({ empresaId, numero, texto })
}
async function salvarMensagem({ empresaId, numero, nome, texto, tipo, mediaUrl, de }) {
  const num = numero.replace(/\D/g,'')
  const key = `wpp_conv:${empresaId}:${num}`
  const { data: row } = await supabase.from('vx_storage').select('value').eq('key', key).maybeSingle()
  const agora = new Date().toISOString()
  if (!row?.value) {
    const conv = { id: key, numero: num, nome: nome || num, empresaId, status: 'automacao', botPausado: false, filaId: null, agenteId: null, agenteNome: null, tags: [], naoLidas: 1, ultimaMensagem: texto, ultimaAt: agora, mensagens: [{ id: `msg_${Date.now()}`, de, para: 'empresa', texto, tipo, mediaUrl, at: agora, lida: false }] }
    await supabase.from('vx_storage').upsert({ key, value: JSON.stringify(conv), updated_at: agora }, { onConflict: 'key' })
    await atualizarIndice(empresaId, num, { nome: conv.nome, ultimaMensagem: texto, ultimaAt: agora, status: 'automacao', naoLidas: 1, tags: [] })
    return
  }
  const conv = JSON.parse(row.value)
  if (nome && (!conv.nome || conv.nome === conv.numero)) conv.nome = nome
  conv.mensagens = conv.mensagens || []
  if (conv.mensagens.length >= 200) conv.mensagens = conv.mensagens.slice(-180)
  conv.mensagens.push({ id: `msg_${Date.now()}_${Math.random().toString(36).slice(2,5)}`, de, para: de === 'cliente' ? 'empresa' : num, texto, tipo, mediaUrl, at: agora, lida: de === 'empresa' })
  conv.ultimaMensagem = texto
  conv.ultimaAt = agora
  if (de === 'cliente') {
    conv.naoLidas = (conv.naoLidas || 0) + 1
    // ✅ NÃO muda status se agente está no controle
    const agenteTomouControle = conv.botPausado || conv.status === 'atendendo' || conv.status === 'aguardando'
    if (!agenteTomouControle) conv.status = 'automacao'
  }
  await supabase.from('vx_storage').upsert({ key, value: JSON.stringify(conv), updated_at: agora }, { onConflict: 'key' })
  await atualizarIndice(empresaId, num, { nome: conv.nome, ultimaMensagem: texto, ultimaAt: agora, status: conv.status, naoLidas: conv.naoLidas, tags: conv.tags || [] })
}
async function atualizarIndice(empresaId, numero, dados) {
  const idxKey = `wpp_idx:${empresaId}`
  const { data: row } = await supabase.from('vx_storage').select('value').eq('key', idxKey).maybeSingle()
  const idx = row?.value ? JSON.parse(row.value) : {}
  idx[numero] = { ...(idx[numero] || {}), numero, nome: dados.nome || idx[numero]?.nome || numero, ultimaMensagem: dados.ultimaMensagem || '', ultimaAt: dados.ultimaAt || new Date().toISOString(), status: dados.status, naoLidas: dados.naoLidas ?? 0, tags: dados.tags || [], updatedAt: new Date().toISOString() }
  await supabase.from('vx_storage').upsert({ key: idxKey, value: JSON.stringify(idx), updated_at: new Date().toISOString() }, { onConflict: 'key' })
}
async function buscarEmpresaPorInstance(instanceName) {
  if (!instanceName) return null
  try {
    const { data: rows } = await supabase.from('vx_storage').select('key, value').like('key', 'cfg:%')
    for (const row of rows || []) {
      try { const cfg = JSON.parse(row.value); if (cfg?.wppInbox?.evolutionInstance === instanceName || cfg?.wppInstance === instanceName) return row.key.replace('cfg:','') } catch {}
    }
  } catch {}
  return null
}
async function buscarEmpresaPorPhoneId(phoneId) {
  if (!phoneId) return null
  try {
    const { data: rows } = await supabase.from('vx_storage').select('key, value').like('key', 'cfg:%')
    for (const row of rows || []) {
      try { const cfg = JSON.parse(row.value); if (cfg?.wpp?.phoneId === phoneId) return row.key.replace('cfg:','') } catch {}
    }
  } catch {}
  return null
}
// ── Sessões do fluxo em memória ──────────────────────────────────
// { 'empresaId:numero': { nodeId, vars, waitingAnswer, variable, updatedAt } }
const FLOW_SESSIONS = new Map()
const FLOW_TTL = 15 * 60 * 1000 // 15 min sem resposta encerra sessão

function getFlowSession(empresaId, numero) {
  const k = `${empresaId}:${numero}`
  const s = FLOW_SESSIONS.get(k)
  if (!s) return null
  if (Date.now() - s.updatedAt > FLOW_TTL) { FLOW_SESSIONS.delete(k); return null }
  return s
}
function setFlowSession(empresaId, numero, data) {
  FLOW_SESSIONS.set(`${empresaId}:${numero}`, { ...data, updatedAt: Date.now() })
}
function clearFlowSession(empresaId, numero) {
  FLOW_SESSIONS.delete(`${empresaId}:${numero}`)
}

// ── Decisor principal: fluxo visual → IA ────────────────────────
async function verificarIAeResponder({ empresaId, numero, texto }) {
  try {
    const num = numero.replace(/\D/g,'')

    // Verificar se agente humano assumiu — não responde nada
    const { data: convRow } = await supabase.from('vx_storage').select('value').eq('key', `wpp_conv:${empresaId}:${num}`).maybeSingle()
    const conv = convRow?.value ? JSON.parse(convRow.value) : {}
    if (conv.botPausado || conv.status === 'atendendo' || conv.status === 'aguardando') return

    // 1️⃣ Tentar fluxo visual
    const usouFluxo = await executarFluxo({ empresaId, numero: num, texto, conv })
    if (usouFluxo) return

    // 2️⃣ Fallback: Agente IA (lógica original preservada)
    await executarAgenteIA({ empresaId, numero: num, texto, conv })
  } catch (err) { console.warn('[Responder]', err.message) }
}

// ── Executor do fluxo visual ─────────────────────────────────────
async function executarFluxo({ empresaId, numero, texto, conv }) {
  const { data: flowRow } = await supabase.from('vx_storage').select('value').eq('key', `chatbot_flows:${empresaId}`).maybeSingle()
  if (!flowRow?.value) return false

  const flowData = JSON.parse(flowRow.value)
  if (!flowData.botAtivo) return false

  const fluxoAtivo = (flowData.flows || []).find(f => f.id === flowData.activeFlowId || f.active)
  if (!fluxoAtivo || !fluxoAtivo.nodes?.length) return false

  // Buscar credenciais Evolution API do cfg
  const { data: cfgRow } = await supabase.from('vx_storage').select('value').eq('key', `cfg:${empresaId}`).maybeSingle()
  const cfg = cfgRow?.value ? JSON.parse(cfgRow.value) : {}
  const evoUrl  = cfg.wppInbox?.evolutionUrl  || ''
  const evoKey  = cfg.wppInbox?.evolutionKey  || ''
  const evoInst = cfg.wppInbox?.evolutionInstance || ''

  // Interpolar variáveis {{nome}} na mensagem
  function interpolar(text, vars) {
    return (text || '').replace(/\{\{(\w+)\}\}/g, (_, k) => vars?.[k] || `{{${k}}}`)
  }

  // Enviar mensagem via Evolution API e salvar no histórico
  async function enviar(text, vars) {
    const finalText = interpolar(text, vars)
    if (evoUrl && evoKey && evoInst) {
      await fetch(`${evoUrl}/message/sendText/${evoInst}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'apikey': evoKey },
        body: JSON.stringify({ number: numero, text: finalText, delay: 800 })
      }).catch(() => {})
    }
    // Salvar mensagem do bot no histórico da conversa
    await salvarMensagem({ empresaId, numero, nome: '', texto: finalText, tipo: 'text', mediaUrl: null, de: 'bot' })
  }

  // Executar nó — recursivo para nós automáticos (message, action sem pausa)
  async function execNó(nodeId, vars) {
    const node = fluxoAtivo.nodes.find(n => n.id === nodeId)
    if (!node) { clearFlowSession(empresaId, numero); return }

    switch (node.type) {

      case 'start':
      case 'message': {
        await enviar(node.data?.text || '', vars)
        const next = fluxoAtivo.connections.find(c => c.fromId === nodeId && c.port === 'main')
        if (next) await execNó(next.toId, vars)
        else clearFlowSession(empresaId, numero)
        break
      }

      case 'question': {
        await enviar(node.data?.text || '', vars)
        // Pausa aqui — salva estado e aguarda próxima mensagem do cliente
        setFlowSession(empresaId, numero, { nodeId, vars, waitingAnswer: true, variable: node.data?.variable })
        break
      }

      case 'condition': {
        const valor = (vars[node.data?.variable] || texto || '').toLowerCase().trim()
        const branches = node.data?.branches || []
        let matched = false
        for (let i = 0; i < branches.length; i++) {
          const kw = (branches[i].keyword || '').toLowerCase().trim()
          if (kw && valor.includes(kw)) {
            const next = fluxoAtivo.connections.find(c => c.fromId === nodeId && c.port === `branch_${i}`)
            if (next) { await execNó(next.toId, vars); matched = true; break }
          }
        }
        if (!matched) {
          const next = fluxoAtivo.connections.find(c => c.fromId === nodeId && c.port === 'main')
          if (next) await execNó(next.toId, vars)
          else clearFlowSession(empresaId, numero)
        }
        break
      }

      case 'action': {
        const tipo = node.data?.actionType || 'transfer'
        if (tipo === 'transfer') {
          if (node.data?.text) await enviar(node.data.text, vars)
          // Marcar conversa para atendimento humano (aparece no Inbox como "Aguardando")
          const convKey = `wpp_conv:${empresaId}:${numero}`
          const { data: cr } = await supabase.from('vx_storage').select('value').eq('key', convKey).maybeSingle()
          if (cr?.value) {
            const c2 = JSON.parse(cr.value)
            c2.status = 'aguardando'; c2.botPausado = true
            await supabase.from('vx_storage').upsert({ key: convKey, value: JSON.stringify(c2), updated_at: new Date().toISOString() }, { onConflict: 'key' })
            await atualizarIndice(empresaId, numero, { nome: c2.nome, ultimaMensagem: c2.ultimaMensagem, ultimaAt: c2.ultimaAt, status: 'aguardando', naoLidas: c2.naoLidas, tags: c2.tags || [] })
          }
          clearFlowSession(empresaId, numero)
        } else if (tipo === 'webhook') {
          try {
            await fetch(node.data?.webhookUrl, {
              method: 'POST', headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ empresaId, numero, texto, vars })
            })
          } catch {}
          const next = fluxoAtivo.connections.find(c => c.fromId === nodeId && c.port === 'main')
          if (next) await execNó(next.toId, vars)
          else clearFlowSession(empresaId, numero)
        } else if (tipo === 'tag') {
          const convKey = `wpp_conv:${empresaId}:${numero}`
          const { data: cr } = await supabase.from('vx_storage').select('value').eq('key', convKey).maybeSingle()
          if (cr?.value) {
            const c2 = JSON.parse(cr.value)
            c2.tags = [...new Set([...(c2.tags || []), node.data?.tag || ''].filter(Boolean))]
            await supabase.from('vx_storage').upsert({ key: convKey, value: JSON.stringify(c2), updated_at: new Date().toISOString() }, { onConflict: 'key' })
          }
          const next = fluxoAtivo.connections.find(c => c.fromId === nodeId && c.port === 'main')
          if (next) await execNó(next.toId, vars)
          else clearFlowSession(empresaId, numero)
        } else {
          clearFlowSession(empresaId, numero)
        }
        break
      }

      case 'end': {
        if (node.data?.text) await enviar(node.data.text, vars)
        clearFlowSession(empresaId, numero)
        break
      }
    }
  }

  // Verificar sessão existente (cliente respondeu uma pergunta)
  const sess = getFlowSession(empresaId, numero)
  if (sess?.waitingAnswer) {
    const vars = { ...sess.vars }
    if (sess.variable) vars[sess.variable] = texto
    setFlowSession(empresaId, numero, { ...sess, vars, waitingAnswer: false })
    const next = fluxoAtivo.connections.find(c => c.fromId === sess.nodeId && c.port === 'main')
    if (next) await execNó(next.toId, vars)
    else clearFlowSession(empresaId, numero)
    return true
  }

  // Nova conversa — iniciar pelo nó start
  const startNode = fluxoAtivo.nodes.find(n => n.type === 'start')
  if (!startNode) return false
  setFlowSession(empresaId, numero, { nodeId: startNode.id, vars: {}, waitingAnswer: false })
  await execNó(startNode.id, {})
  return true
}

// ── Agente IA (fallback — lógica original v3 preservada) ─────────
async function executarAgenteIA({ empresaId, numero, texto, conv }) {
  try {
    const { data: cfgRow } = await supabase.from('vx_storage').select('value').eq('key', `cfg:${empresaId}`).maybeSingle()
    const cfg = cfgRow?.value ? JSON.parse(cfgRow.value) : {}
    const agentes = cfg.wppAgentes || []
    if (!agentes.length) return
    if (conv.status !== 'automacao' || conv.botPausado) return
    const agente = agentes.find(a => a.ativo)
    if (!agente) return
    const apiKey = agente.openaiKey || agente.groqKey || cfg.openaiApiKey || cfg.groqApiKey || ''
    if (!apiKey) return
    const isGroq = !!(agente.groqKey || (!agente.openaiKey && cfg.groqApiKey))
    const model = agente.model || (isGroq ? 'llama3-70b-8192' : 'gpt-4o-mini')
    const url = isGroq ? 'https://api.groq.com/openai/v1/chat/completions' : 'https://api.openai.com/v1/chat/completions'
    const messages = [{ role: 'system', content: agente.prompt || 'Você é um assistente comercial prestativo.' }, ...(conv.mensagens || []).slice(-10).map(m => ({ role: m.de === 'cliente' ? 'user' : 'assistant', content: m.texto }))]
    const r = await fetch(url, { method: 'POST', headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ model, messages, max_tokens: 300, temperature: 0.7 }), signal: AbortSignal.timeout(20000) })
    const d = await r.json()
    const resposta = d?.choices?.[0]?.message?.content?.trim()
    if (!resposta) return
    const appUrl = process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_APP_URL || ''
    await fetch(`${appUrl}/api/wpp/send`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ empresaId, numero, mensagem: resposta }) }).catch(() => {})
  } catch (err) { console.warn('[IA]', err.message) }
}
