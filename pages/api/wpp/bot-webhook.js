// pages/api/wpp/bot-webhook.js
// ══════════════════════════════════════════════════════════════
// Recebe mensagens do servidor WhatsApp próprio (wwebjs)
// e aciona o bot (chatbot flow ou agente IA)
//
// Este endpoint é chamado pelo src/supabase.js do whatsapp-server
// Configure no .env do servidor: NEXTJS_BOT_WEBHOOK_URL=https://vivanexa-saas.vercel.app/api/wpp/bot-webhook
// ══════════════════════════════════════════════════════════════

import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

// ── Helpers ──────────────────────────────────────────────────
async function getCfg(empresaId) {
  const { data } = await supabase.from('vx_storage').select('value')
    .eq('key', `cfg:${empresaId}`).maybeSingle()
  return data?.value ? JSON.parse(data.value) : {}
}

async function getFlows(empresaId) {
  const { data } = await supabase.from('vx_storage').select('value')
    .eq('key', `chatbot_flows:${empresaId}`).maybeSingle()
  return data?.value ? JSON.parse(data.value) : null
}

async function getConv(empresaId, numero) {
  const { data } = await supabase.from('vx_storage').select('value')
    .eq('key', `wpp_conv:${empresaId}:${numero}`).maybeSingle()
  return data?.value ? JSON.parse(data.value) : null
}

async function saveConv(empresaId, numero, conv) {
  await supabase.from('vx_storage').upsert(
    { key: `wpp_conv:${empresaId}:${numero}`, value: JSON.stringify(conv), updated_at: new Date().toISOString() },
    { onConflict: 'key' }
  )
  // Atualiza índice
  const { data: idxRow } = await supabase.from('vx_storage').select('value')
    .eq('key', `wpp_idx:${empresaId}`).maybeSingle()
  const idx = idxRow?.value ? JSON.parse(idxRow.value) : {}
  idx[numero] = {
    ...(idx[numero] || {}),
    numero,
    nome:           conv.nome || numero,
    ultimaMensagem: conv.ultimaMensagem || '',
    ultimaAt:       conv.ultimaAt || new Date().toISOString(),
    updatedAt:      new Date().toISOString(),
    status:         conv.status,
    naoLidas:       conv.naoLidas || 0,
    tags:           conv.tags || [],
  }
  await supabase.from('vx_storage').upsert(
    { key: `wpp_idx:${empresaId}`, value: JSON.stringify(idx), updated_at: new Date().toISOString() },
    { onConflict: 'key' }
  )
}

// ── Envia mensagem via servidor próprio ──────────────────────
async function enviarTexto(numero, texto, empresaId) {
  if (!texto?.trim()) return
  const WPP_SERVER = process.env.WPP_SERVER_URL || 'http://localhost:3001'
  const num = numero.replace(/\D/g, '')

  try {
    await fetch(`${WPP_SERVER}/api/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ numero: num, mensagem: texto, empresaId })
    })
  } catch(e) {
    console.error('[bot-webhook] enviarTexto err:', e.message)
  }

  // Salva mensagem enviada no histórico
  if (empresaId) {
    try {
      const ts = new Date().toISOString()
      const { data: convRow } = await supabase.from('vx_storage').select('value')
        .eq('key', `wpp_conv:${empresaId}:${num}`).maybeSingle()
      if (convRow?.value) {
        const c = JSON.parse(convRow.value)
        const msgBot = {
          id: `bot_${Date.now()}_${Math.random().toString(36).slice(2,6)}`,
          de: 'empresa', fromMe: true, texto,
          at: ts, tipo: 'texto', isBot: true,
        }
        const jaExiste = (c.mensagens||[]).some(m => m.texto === texto && Math.abs(new Date(m.at||0) - new Date(ts)) < 3000)
        if (!jaExiste) {
          c.mensagens      = [...(c.mensagens||[]), msgBot]
          c.ultimaMensagem = texto.slice(0, 60)
          c.ultimaAt       = ts
          c.ultimaDe       = 'empresa'
          await supabase.from('vx_storage').upsert(
            { key: `wpp_conv:${empresaId}:${num}`, value: JSON.stringify(c), updated_at: ts },
            { onConflict: 'key' }
          )
        }
      }
    } catch(e) { console.error('[bot-webhook] salvar msg saida:', e.message) }
  }
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)) }

function substituirVars(texto, vars={}, conv={}) {
  return (texto||'')
    .replace(/\{nome\}/gi,     conv.nome||vars.nome||'cliente')
    .replace(/\{numero\}/gi,   conv.numero||'')
    .replace(/\{protocolo\}/gi, conv.protocolo||'')
    .replace(/#(\w+)/g, (_,k) => vars[k]||`#${k}`)
}

function gerarProtocolo() {
  return `ATD-${new Date().toISOString().slice(0,10).replace(/-/g,'')}-${Math.floor(Math.random()*90000)+10000}`
}

// ── Motor do Chatbot Flow ────────────────────────────────────
async function executarFluxo({ empresaId, cfg, fluxo, conv, mensagemCliente }) {
  const { nodes=[], connections=[] } = fluxo
  const botState = conv.botState || {}
  let currentNodeId       = botState.currentNodeId || null
  let botVars             = { ...(botState.vars||{}) }
  let aguardandoResposta  = botState.aguardandoResposta || false
  const numero            = conv.numero
  const mensagensEnviadas = []

  const getNode = id => nodes.find(n => n.id === id)
  const getNext = (fromId, port='main') => {
    const c = connections.find(c => c.fromId===fromId && (c.fromPort===port||(!c.fromPort&&port==='main')))
    return c ? getNode(c.toId) : null
  }

  const enviar = async (texto) => {
    const txt = substituirVars(texto, botVars, conv)
    if (!txt) return
    await enviarTexto(numero, txt, empresaId)
    mensagensEnviadas.push(txt)
    await sleep(300)
  }

  // Se estava aguardando resposta
  if (aguardandoResposta && currentNodeId) {
    const qn = getNode(currentNodeId)
    if (qn?.type === 'question') {
      botVars[qn.data?.variable||'resposta'] = mensagemCliente
      currentNodeId = getNext(currentNodeId)?.id || null
      aguardandoResposta = false
    }
  }

  // Nó inicial
  if (!currentNodeId) {
    const startNode = nodes.find(n => n.type === 'start')
    if (!startNode) return { mensagensEnviadas }
    if (startNode.data?.text) await enviar(startNode.data.text)
    currentNodeId = getNext(startNode.id)?.id || null
  }

  let iter = 0
  while (currentNodeId && iter < 15) {
    iter++
    const node = getNode(currentNodeId)
    if (!node) break

    if (node.type === 'message') {
      await enviar(node.data?.text || '')
      currentNodeId = getNext(node.id)?.id || null
      continue
    }

    if (node.type === 'question') {
      await enviar(node.data?.text || node.data?.question || '')
      aguardandoResposta = true
      break
    }

    if (node.type === 'condition') {
      const varName = node.data?.variable || 'opcao'
      const valor = (botVars[varName]||mensagemCliente||'').trim().toLowerCase()
      const branches = node.data?.branches || []
      let matchIdx = -1
      for (let i=0; i<branches.length; i++) {
        const kw = (branches[i]?.keyword||'').toLowerCase().trim()
        if (!kw) continue
        if (valor===kw || valor===String(i+1) || valor.includes(kw)) { matchIdx=i; break }
      }
      const port = matchIdx>=0 ? `branch_${matchIdx}` : 'main'
      currentNodeId = (getNext(node.id,port)||getNext(node.id,'main'))?.id || null
      continue
    }

    if (node.type === 'delay') {
      await sleep(Math.min((node.data?.seconds||2)*1000, 8000))
      currentNodeId = getNext(node.id)?.id || null
      continue
    }

    if (node.type === 'human' || (node.type === 'action' && node.data?.actionType !== 'webhook')) {
      if (node.data?.text) await enviar(node.data.text)
      if (node.type === 'action' && node.data?.actionType === 'close') {
        await enviar(node.data?.closeText || 'Obrigado pelo contato! 😊')
        conv.status = 'finalizado'; conv.botPausado = true; conv.finalizadoEm = new Date().toISOString()
      } else {
        conv.status = 'aguardando'; conv.botPausado = true
        if (node.data?.departamentoId) conv.departamentoId = node.data.departamentoId
      }
      conv.botState = { currentNodeId: null, vars: {}, aguardandoResposta: false }
      await saveConv(empresaId, numero, conv)
      return { mensagensEnviadas }
    }

    if (node.type === 'action' && node.data?.actionType === 'webhook') {
      try { await fetch(node.data.webhookUrl,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({numero,vars:botVars})}) } catch{}
      currentNodeId = getNext(node.id)?.id || null
      continue
    }

    if (node.type === 'end') {
      const txt = substituirVars(node.data?.text||'Obrigado pelo contato! Até mais. 👋', botVars, conv)
      await enviar(txt)
      conv.status = 'finalizado'; conv.botPausado = true
      if (!conv.protocolo) conv.protocolo = gerarProtocolo()
      conv.botState = { currentNodeId: null, vars: {}, aguardandoResposta: false }
      await saveConv(empresaId, numero, conv)
      return { mensagensEnviadas }
    }

    currentNodeId = getNext(node.id)?.id || null
  }

  // Salva estado do bot
  conv.botState = { currentNodeId, vars: botVars, aguardandoResposta }
  await saveConv(empresaId, numero, conv)
  return { mensagensEnviadas }
}

// ── Chama o Agente IA (Groq/Gemini/OpenAI) ──────────────────
async function chamarAgenteIA(cfg, agente, mensagem, historico) {
  const groqKey   = cfg.groqApiKey   || process.env.GROQ_API_KEY   || ''
  const geminiKey = cfg.geminiApiKey || process.env.GEMINI_API_KEY || ''
  const openaiKey = cfg.openaiKey    || process.env.OPENAI_API_KEY || ''
  const modelo    = agente.modelo    || 'llama3-8b-8192'
  const prompt    = agente.prompt    || 'Você é um assistente de vendas simpático e objetivo.'

  const msgs = [
    { role: 'system', content: prompt },
    ...historico.filter(m => m.texto).map(m => ({
      role: m.de === 'empresa' ? 'assistant' : 'user',
      content: m.texto
    })),
    { role: 'user', content: mensagem }
  ]

  // Tenta Groq primeiro
  if (groqKey) {
    try {
      const r = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${groqKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: modelo, messages: msgs, max_tokens: 500, temperature: 0.7 }),
        signal: AbortSignal.timeout(20000)
      })
      const d = await r.json()
      if (d.choices?.[0]?.message?.content) return d.choices[0].message.content.trim()
    } catch(e) { console.error('[IA] Groq err:', e.message) }
  }

  // Tenta Gemini
  if (geminiKey) {
    try {
      const geminiMsgs = msgs.filter(m=>m.role!=='system').map(m=>({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }]
      }))
      const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: geminiMsgs, systemInstruction: { parts: [{ text: prompt }] } }),
        signal: AbortSignal.timeout(20000)
      })
      const d = await r.json()
      if (d.candidates?.[0]?.content?.parts?.[0]?.text) return d.candidates[0].content.parts[0].text.trim()
    } catch(e) { console.error('[IA] Gemini err:', e.message) }
  }

  return null
}

// ── Handler principal ─────────────────────────────────────────
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  // Verifica segredo
  const secret = req.headers['x-wpp-secret'] || req.body?.secret
  if (process.env.WEBHOOK_SECRET && secret !== process.env.WEBHOOK_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  const { empresaId, numero, mensagem, conv: convPayload } = req.body

  if (!empresaId || !numero || !mensagem) {
    return res.status(400).json({ ok: false, error: 'empresaId, numero e mensagem são obrigatórios' })
  }

  try {
    const cfg      = await getCfg(empresaId)
    const conv     = await getConv(empresaId, numero) || convPayload
    const flowsData = await getFlows(empresaId)

    if (!conv) return res.json({ ok: true, ignorado: true, motivo: 'sem conversa' })

    // Não processa se humano está atendendo ou finalizado
    if (conv.status === 'atendendo' || conv.status === 'finalizado') {
      return res.json({ ok: true, ignorado: true, motivo: conv.status })
    }

    if (conv.botPausado) {
      return res.json({ ok: true, ignorado: true, motivo: 'bot_pausado' })
    }

    const modoAutomacao = flowsData?.modoAutomacao || 'chatbot'
    const botAtivo      = flowsData?.botAtivo === true

    if (!botAtivo) {
      return res.json({ ok: true, ignorado: true, motivo: 'bot_inativo' })
    }

    // ── MODO AGENTE IA ──────────────────────────────────────
    if (modoAutomacao === 'agente') {
      const agentes = cfg.wppAgentes || []
      const agente  = agentes.find(a => a.ativo) || null
      if (agente) {
        const historico = (conv.mensagens || []).slice(-10)
        const resposta  = await chamarAgenteIA(cfg, agente, mensagem, historico)
        if (resposta) {
          await enviarTexto(numero, resposta, empresaId)
          return res.json({ ok: true, modo: 'agente_ia', resposta })
        }
      }
      return res.json({ ok: true, modo: 'agente_ia', semResposta: true })
    }

    // ── MODO CHATBOT FLOW ───────────────────────────────────
    if (modoAutomacao === 'chatbot') {
      const fluxoId = conv.botState?.fluxoId || flowsData?.activeFlowId
      const fluxo   = (flowsData?.flows || []).find(f => f.id === fluxoId)
                   || (flowsData?.flows || []).find(f => f.active)
                   || flowsData?.flows?.[0]

      if (fluxo) {
        const resultado = await executarFluxo({ empresaId, cfg, fluxo, conv, mensagemCliente: mensagem })
        return res.json({ ok: true, modo: 'chatbot', resultado })
      }
    }

    // ── AGENTE IA DE DEPARTAMENTO (fallback) ─────────────────
    const depto  = (cfg.wppDeps||[]).find(d => d.id === conv.departamentoId)
    const agente = depto?.agentIA ? (cfg.wppAgentes||[]).find(a => a.id===depto.agentIA && a.ativo) : null
    if (agente) {
      const historico = (conv.mensagens||[]).slice(-10)
      const resposta  = await chamarAgenteIA(cfg, agente, mensagem, historico)
      if (resposta) {
        await enviarTexto(numero, resposta, empresaId)
        return res.json({ ok: true, modo: 'agente_depto', resposta })
      }
    }

    return res.json({ ok: true, semBot: true })

  } catch(err) {
    console.error('[bot-webhook] Erro:', err.message)
    return res.status(500).json({ error: err.message })
  }
}
