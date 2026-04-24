// pages/api/wpp/bot.js
// ══════════════════════════════════════════════════════
// Motor de execução do Chatbot Vivanexa
//
// Chamado pelo webhook quando chega mensagem nova.
// Lê o fluxo ativo, executa nó a nó, envia respostas
// via Evolution API e salva o estado da conversa.
//
// Tipos de nó suportados:
//  start     → entrada do fluxo
//  message   → envia texto
//  question  → aguarda resposta, salva em variável
//  condition → ramifica por palavra-chave/número
//  action    → webhook externo / tag / fechar / transferir
//  delay     → espera X segundos
//  media     → envia imagem/vídeo/áudio/documento
//  goto      → transfere para outro fluxo
//  human     → para o bot e envia para humano
//  end       → encerra atendimento
// ══════════════════════════════════════════════════════

import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

// ── Helpers ──────────────────────────────────────────

async function getCfg(empresaId) {
  const { data } = await supabase.from('vx_storage').select('value')
    .eq('key', `cfg:${empresaId}`).maybeSingle()
  return data?.value ? JSON.parse(data.value) : {}
}

async function getFlows(empresaId) {
  const { data } = await supabase.from('vx_storage').select('value')
    .eq('key', `chatbot_flows:${empresaId}`).maybeSingle()
  if (!data?.value) return null
  return JSON.parse(data.value)
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
    instanciaId:    conv.instanciaId,
    instancia:      conv.instancia,
  }
  await supabase.from('vx_storage').upsert(
    { key: `wpp_idx:${empresaId}`, value: JSON.stringify(idx), updated_at: new Date().toISOString() },
    { onConflict: 'key' }
  )
}

// ── Envio de mensagem via Evolution API ──────────────

async function enviarTexto(cfg, instancia, numero, texto) {
  const evoUrl = cfg.wppInbox?.evolutionUrl
  const evoKey = cfg.wppInbox?.evolutionKey
  if (!evoUrl || !evoKey || !texto?.trim()) return

  const num = numero.replace(/\D/g, '')
  const full = num.startsWith('55') ? num : `55${num}`

  await fetch(`${evoUrl}/message/sendText/${instancia}`, {
    method: 'POST',
    headers: { apikey: evoKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({ number: full, text: texto })
  })
}

async function enviarMidia(cfg, instancia, numero, mediaType, mediaUrl, caption) {
  const evoUrl = cfg.wppInbox?.evolutionUrl
  const evoKey = cfg.wppInbox?.evolutionKey
  if (!evoUrl || !evoKey || !mediaUrl) return

  const num = numero.replace(/\D/g, '')
  const full = num.startsWith('55') ? num : `55${num}`

  const endpoints = {
    image:    'sendMedia',
    video:    'sendMedia',
    audio:    'sendMedia',
    document: 'sendMedia',
  }

  const mediaTypes = {
    image:    'image',
    video:    'video',
    audio:    'audio',
    document: 'document',
  }

  await fetch(`${evoUrl}/message/${endpoints[mediaType] || 'sendMedia'}/${instancia}`, {
    method: 'POST',
    headers: { apikey: evoKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      number: full,
      mediatype: mediaTypes[mediaType] || 'image',
      media: mediaUrl,
      caption: caption || '',
      fileName: caption || 'arquivo',
    })
  })
}

async function enviarDigitando(cfg, instancia, numero, segundos = 2) {
  const evoUrl = cfg.wppInbox?.evolutionUrl
  const evoKey = cfg.wppInbox?.evolutionKey
  if (!evoUrl || !evoKey) return

  const num = (numero.replace(/\D/g, ''))
  const full = (num.startsWith('55') ? num : `55${num}`) + '@s.whatsapp.net'

  try {
    await fetch(`${evoUrl}/chat/sendPresence/${instancia}`, {
      method: 'POST',
      headers: { apikey: evoKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ number: full, options: { presence: 'composing', delay: segundos * 1000 } })
    })
  } catch {}
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms))
}

// ── Substitui variáveis na mensagem ─────────────────

function substituirVars(texto, vars = {}, conv = {}) {
  return (texto || '')
    .replace(/\{nome\}/gi, conv.nome || vars.nome || 'cliente')
    .replace(/\{numero\}/gi, conv.numero || '')
    .replace(/\{protocolo\}/gi, conv.protocolo || '')
    .replace(/#(\w+)/g, (_, k) => vars[k] || `#${k}`)
}

// ── Motor de execução do fluxo ───────────────────────

async function executarFluxo({ empresaId, cfg, fluxo, conv, mensagemCliente, vars = {} }) {
  const { nodes = [], connections = [] } = fluxo

  // Estado do bot na conversa
  const botState = conv.botState || {}
  let currentNodeId = botState.currentNodeId || null
  let botVars = { ...(botState.vars || {}), ...vars }
  let aguardandoResposta = botState.aguardandoResposta || false
  const instancia = conv.instancia || cfg.wppInbox?.evolutionInstance || ''
  const numero = conv.numero

  function getNode(id) { return nodes.find(n => n.id === id) }
  function getNextNode(fromId, portName = 'main') {
    const conn = connections.find(c => c.fromId === fromId && (c.fromPort === portName || (!c.fromPort && portName === 'main')))
    return conn ? getNode(conn.toId) : null
  }

  // Se estava aguardando resposta de uma pergunta
  if (aguardandoResposta && currentNodeId) {
    const questionNode = getNode(currentNodeId)
    if (questionNode?.type === 'question') {
      // Salva a resposta na variável
      const varName = questionNode.data?.variable || 'resposta'
      botVars[varName] = mensagemCliente
      // Avança para próximo nó
      const next = getNextNode(currentNodeId)
      currentNodeId = next?.id || null
      aguardandoResposta = false
    }
  }

  // Se não tem nó atual, começa do start
  if (!currentNodeId) {
    const startNode = nodes.find(n => n.type === 'start')
    if (!startNode) return { parou: true, motivo: 'sem_start' }
    // Envia a mensagem de boas-vindas do start se existir
    if (startNode.data?.text) {
      await enviarDigitando(cfg, instancia, numero, 1)
      await enviarTexto(cfg, instancia, numero, substituirVars(startNode.data.text, botVars, conv))
      await sleep(500)
    }
    const next = getNextNode(startNode.id)
    currentNodeId = next?.id || null
  }

  // Executa nós em sequência (máx 15 para evitar loop infinito)
  let iteracoes = 0
  while (currentNodeId && iteracoes < 15) {
    iteracoes++
    const node = getNode(currentNodeId)
    if (!node) break

    console.log(`[bot] Executando nó: ${node.type} (${node.id})`)

    // ── message ──
    if (node.type === 'message') {
      const texto = substituirVars(node.data?.text || '', botVars, conv)
      await enviarDigitando(cfg, instancia, numero, 1)
      await sleep(500)
      await enviarTexto(cfg, instancia, numero, texto)
      await sleep(300)
      const next = getNextNode(node.id)
      currentNodeId = next?.id || null
      continue
    }

    // ── question ──
    if (node.type === 'question') {
      const texto = substituirVars(node.data?.text || node.data?.question || '', botVars, conv)
      await enviarDigitando(cfg, instancia, numero, 1)
      await sleep(500)
      await enviarTexto(cfg, instancia, numero, texto)
      // Para aqui e espera resposta
      aguardandoResposta = true
      break
    }

    // ── condition ──
    if (node.type === 'condition') {
      const varName = node.data?.variable || 'opcao'
      const valor = (botVars[varName] || mensagemCliente || '').trim().toLowerCase()
      const branches = node.data?.branches || []

      let matchIdx = -1
      for (let i = 0; i < branches.length; i++) {
        const kw = (branches[i].keyword || '').toLowerCase().trim()
        if (!kw) continue
        // Aceita número ou palavra-chave exata
        const kwNum = String(i + 1)
        if (valor === kw || valor === kwNum || valor.includes(kw)) {
          matchIdx = i
          break
        }
      }

      const portName = matchIdx >= 0 ? `branch_${matchIdx}` : 'main'
      const next = getNextNode(node.id, portName) || getNextNode(node.id, 'main')
      currentNodeId = next?.id || null
      continue
    }

    // ── delay ──
    if (node.type === 'delay') {
      const segundos = Math.min(node.data?.seconds || 2, 30)
      if (node.data?.text) {
        await enviarDigitando(cfg, instancia, numero, segundos)
      } else {
        await sleep(segundos * 1000)
      }
      const next = getNextNode(node.id)
      currentNodeId = next?.id || null
      continue
    }

    // ── media ──
    if (node.type === 'media') {
      const mediaType = node.data?.mediaType || 'image'
      const mediaUrl  = node.data?.mediaUrl  || ''
      const caption   = substituirVars(node.data?.caption || '', botVars, conv)
      if (mediaUrl) {
        await enviarMidia(cfg, instancia, numero, mediaType, mediaUrl, caption)
        await sleep(500)
      }
      const next = getNextNode(node.id)
      currentNodeId = next?.id || null
      continue
    }

    // ── goto (ir para outro fluxo) ──
    if (node.type === 'goto') {
      if (node.data?.text) {
        await enviarTexto(cfg, instancia, numero, substituirVars(node.data.text, botVars, conv))
        await sleep(300)
      }
      const gotoFlowId = node.data?.gotoFlowId
      if (gotoFlowId) {
        // Reinicia no novo fluxo
        conv.botState = { currentNodeId: null, vars: botVars, aguardandoResposta: false, fluxoId: gotoFlowId }
        await saveConv(empresaId, numero, conv)
        // Chama recursivamente o novo fluxo
        const flowsData = await getFlows(empresaId)
        const novoFluxo = (flowsData?.flows || []).find(f => f.id === gotoFlowId)
        if (novoFluxo) {
          return executarFluxo({ empresaId, cfg, fluxo: novoFluxo, conv, mensagemCliente: '', vars: botVars })
        }
      }
      break
    }

    // ── human (transferir para humano) ──
    if (node.type === 'human') {
      if (node.data?.text) {
        await enviarTexto(cfg, instancia, numero, substituirVars(node.data.text, botVars, conv))
        await sleep(300)
      }
      const depId   = node.data?.departamentoId   || null
      const depNome = node.data?.departamentoNome  || null
      conv.status          = depId ? 'aguardando' : 'aguardando'
      conv.botPausado      = true
      conv.departamentoId  = depId
      conv.departamentoNome = depNome
      conv.botState        = { currentNodeId: null, vars: {}, aguardandoResposta: false }
      await saveConv(empresaId, numero, conv)
      return { parou: true, motivo: 'transferido_humano', departamentoId: depId }
    }

    // ── action ──
    if (node.type === 'action') {
      const tipo = node.data?.actionType || 'transfer'

      if (tipo === 'transfer') {
        if (node.data?.text) {
          await enviarTexto(cfg, instancia, numero, substituirVars(node.data.text, botVars, conv))
          await sleep(300)
        }
        conv.status    = 'aguardando'
        conv.botPausado = true
        conv.botState   = { currentNodeId: null, vars: {}, aguardandoResposta: false }
        await saveConv(empresaId, numero, conv)
        return { parou: true, motivo: 'transferido_humano' }
      }

      if (tipo === 'close') {
        const textoFim = node.data?.text || 'Atendimento encerrado. Obrigado! 😊'
        await enviarTexto(cfg, instancia, numero, substituirVars(textoFim, botVars, conv))
        conv.status   = 'finalizado'
        conv.botPausado = true
        conv.finalizadoEm = new Date().toISOString()
        conv.botState   = { currentNodeId: null, vars: {}, aguardandoResposta: false }
        await saveConv(empresaId, numero, conv)
        return { parou: true, motivo: 'finalizado' }
      }

      if (tipo === 'tag' && node.data?.tag) {
        conv.tags = [...new Set([...(conv.tags || []), node.data.tag])]
      }

      if (tipo === 'webhook' && node.data?.webhookUrl) {
        try {
          await fetch(node.data.webhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ numero, vars: botVars, conv })
          })
        } catch {}
      }

      const next = getNextNode(node.id)
      currentNodeId = next?.id || null
      continue
    }

    // ── end ──
    if (node.type === 'end') {
      const texto = node.data?.text || 'Obrigado pelo contato! Até mais. 👋'
      await enviarDigitando(cfg, instancia, numero, 1)
      await sleep(500)
      await enviarTexto(cfg, instancia, numero, substituirVars(texto, botVars, conv))
      conv.status        = 'finalizado'
      conv.botPausado    = true
      conv.finalizadoEm  = new Date().toISOString()
      conv.botState      = { currentNodeId: null, vars: {}, aguardandoResposta: false }
      await saveConv(empresaId, numero, conv)
      return { parou: true, motivo: 'fim' }
    }

    // Nó desconhecido — avança
    const next = getNextNode(node.id)
    currentNodeId = next?.id || null
  }

  // Salva estado atual
  conv.botState = { currentNodeId, vars: botVars, aguardandoResposta, fluxoId: fluxo.id }
  await saveConv(empresaId, numero, conv)
  return { parou: false, aguardandoResposta }
}

// ── Agente IA de departamento ─────────────────────────

async function chamarAgenteIA(cfg, depto, mensagem, historico = []) {
  const agentes  = cfg.wppAgentes || []
  const agente   = agentes.find(a => a.id === depto.agentIA && a.ativo) || agentes.find(a => a.ativo)
  if (!agente) return null

  const geminiKey = agente.geminiKey || cfg.geminiApiKey || process.env.GEMINI_API_KEY || ''
  const groqKey   = agente.groqKey   || cfg.groqApiKey   || process.env.GROQ_API_KEY   || ''
  const openaiKey = agente.openaiKey || cfg.openaiApiKey  || process.env.OPENAI_API_KEY  || ''

  const histTexto = historico.slice(-8).map(m =>
    `${m.fromMe ? 'Assistente' : 'Cliente'}: ${m.texto}`
  ).join('\n')

  const prompt = `${agente.prompt || `Você é um assistente de atendimento da empresa ${cfg.company || 'Vivanexa'}. Responda de forma cordial, objetiva e em português. Limite sua resposta a 300 caracteres quando possível.`}

${histTexto ? `Histórico recente:\n${histTexto}\n` : ''}
Cliente: ${mensagem}
Assistente:`

  // OpenAI
  if (openaiKey) {
    try {
      const r = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { Authorization: `Bearer ${openaiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: agente.model || 'gpt-4o-mini', messages: [{ role: 'user', content: prompt }], max_tokens: 400, temperature: 0.7 })
      })
      const d = await r.json()
      const txt = d.choices?.[0]?.message?.content?.trim()
      if (txt) return txt
    } catch {}
  }

  // Gemini
  if (geminiKey) {
    try {
      const model = agente.model?.includes('gemini') ? agente.model : 'gemini-2.0-flash'
      const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${geminiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
      })
      const d = await r.json()
      const txt = d.candidates?.[0]?.content?.parts?.[0]?.text?.trim()
      if (txt) return txt
    } catch {}
  }

  // Groq
  if (groqKey) {
    try {
      const r = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: { Authorization: `Bearer ${groqKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: agente.model || 'llama3-8b-8192', messages: [{ role: 'user', content: prompt }], max_tokens: 400 })
      })
      const d = await r.json()
      const txt = d.choices?.[0]?.message?.content?.trim()
      if (txt) return txt
    } catch {}
  }

  return null
}

// ── Handler principal ─────────────────────────────────

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método não permitido' })

  const { empresaId, numero, mensagem, conv: convInput } = req.body
  if (!empresaId || !numero) return res.status(400).json({ error: 'empresaId e numero são obrigatórios' })

  try {
    const cfg  = await getCfg(empresaId)
    const conv = convInput || await getConv(empresaId, numero)
    if (!conv) return res.status(404).json({ error: 'Conversa não encontrada' })

    // ── VERIFICA SE É RESPOSTA AO BRIEFING DO AGENTE IA ────────────────────
    // Vendedor pode responder "1", "2" ou "3" ao briefing e o agente age automaticamente
    // Condição: o número é de um usuário (telefone em cfg.users[]) e não é cliente
    {
      const users = cfg.users || []
      const numLimpo = numero.replace(/\D/g, '')
      const isVendedor = users.some(u => {
        const tel = (u.telefone || '').replace(/\D/g, '')
        return tel && (numLimpo.endsWith(tel) || tel.endsWith(numLimpo))
      })
      const isBriefingReply = isVendedor && /^[123]$|rodar|follow.?up|parado|fechar|briefing/i.test(mensagem.trim())

      if (isBriefingReply) {
        // Descobre o usuário correspondente
        const usuarioTelefone = numero
        try {
          const baseUrl = process.env.NEXT_PUBLIC_APP_URL
            || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000')
          await fetch(`${baseUrl}/api/agente-followup`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ acao: 'resposta_briefing', empresaId, mensagem, usuarioTelefone })
          })
        } catch (e) { console.error('[bot] resposta_briefing err:', e.message) }
        return res.status(200).json({ ok: true, modo: 'resposta_briefing' })
      }
    }

    // Não processa se atendendo por humano ou finalizado
    if (conv.status === 'atendendo' || conv.status === 'finalizado') {
      return res.status(200).json({ ok: true, ignorado: true, motivo: conv.status })
    }

    const flowsData = await getFlows(empresaId)
    const modoAutomacao = flowsData?.modoAutomacao || 'chatbot'
    const botGlobalAtivo = flowsData?.botAtivo === true

    // ── MODO AGENTE IA ────────────────────────────────
    if (modoAutomacao === 'agente' && botGlobalAtivo && !conv.botPausado) {
      // Usa o agente configurado globalmente (não por departamento)
      const agentes = cfg.wppAgentes || []
      const agente  = agentes.find(a => a.ativo) || null
      if (agente) {
        const historico = (conv.mensagens || []).slice(-10)
        const resposta  = await chamarAgenteIA(cfg, { agentIA: agente.id }, mensagem, historico)
        if (resposta) {
          const instancia = conv.instancia || cfg.wppInbox?.evolutionInstance || ''
          await enviarTexto(cfg, instancia, numero, resposta)
          return res.status(200).json({ ok: true, modo: 'agente_ia' })
        }
      }
      return res.status(200).json({ ok: true, modo: 'agente_ia', semResposta: true })
    }

    // ── MODO CHATBOT FLOW ─────────────────────────────
    if (modoAutomacao === 'chatbot' && botGlobalAtivo && !conv.botPausado) {
      const fluxoId = conv.botState?.fluxoId || flowsData?.activeFlowId
      const fluxo   = (flowsData?.flows || []).find(f => f.id === fluxoId)
                   || (flowsData?.flows || []).find(f => f.active)
                   || flowsData?.flows?.[0]

      if (fluxo) {
        const resultado = await executarFluxo({ empresaId, cfg, fluxo, conv, mensagemCliente: mensagem })
        return res.status(200).json({ ok: true, modo: 'chatbot', resultado })
      }
    }

    // ── AGENTE IA DE DEPARTAMENTO (fallback) ──────────
    if (!conv.botPausado) {
      const depto = (cfg.wppDeps || []).find(d => d.id === conv.departamentoId)
      if (depto?.agentIA) {
        const historico = (conv.mensagens || []).slice(-10)
        const resposta  = await chamarAgenteIA(cfg, depto, mensagem, historico)
        if (resposta) {
          const instancia = conv.instancia || cfg.wppInbox?.evolutionInstance || ''
          await enviarTexto(cfg, instancia, numero, resposta)
          return res.status(200).json({ ok: true, modo: 'agente_depto' })
        }
      }
    }

    return res.status(200).json({ ok: true, semBot: true })
  } catch (err) {
    console.error('[bot] Erro:', err.message, err.stack?.slice(0, 300))
    return res.status(500).json({ error: err.message })
  }
}
