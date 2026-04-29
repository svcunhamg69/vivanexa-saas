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

// ══════════════════════════════════════════════════
// BOT ENGINE — embutido no webhook para evitar HTTP
// interno no Vercel (serverless não consegue chamar
// outra serverless via fetch confiável)
// ══════════════════════════════════════════════════

async function getCfg(empresaId) {
  const { data } = await supabase.from('vx_storage').select('value').eq('key', `cfg:${empresaId}`).maybeSingle()
  return data?.value ? JSON.parse(data.value) : {}
}

async function getFlows(empresaId) {
  const { data } = await supabase.from('vx_storage').select('value').eq('key', `chatbot_flows:${empresaId}`).maybeSingle()
  return data?.value ? JSON.parse(data.value) : null
}

async function getConv(empresaId, numero) {
  const { data } = await supabase.from('vx_storage').select('value').eq('key', `wpp_conv:${empresaId}:${numero}`).maybeSingle()
  return data?.value ? JSON.parse(data.value) : null
}

async function saveConvBot(empresaId, numero, conv) {
  await supabase.from('vx_storage').upsert(
    { key: `wpp_conv:${empresaId}:${numero}`, value: JSON.stringify(conv), updated_at: new Date().toISOString() },
    { onConflict: 'key' }
  )
}

function gerarProtocolo2() {
  return `ATD-${new Date().toISOString().slice(0,10).replace(/-/g,'')}-${Math.floor(Math.random()*90000)+10000}`
}

function substituirVars(texto, vars={}, conv={}) {
  return (texto||'')
    .replace(/\{nome\}/gi, conv.nome||vars.nome||'cliente')
    .replace(/\{numero\}/gi, conv.numero||'')
    .replace(/\{protocolo\}/gi, conv.protocolo||'')
    .replace(/#(\w+)/g, (_,k) => vars[k]||`#${k}`)
}

async function enviarTextoBot(cfg, instancia, numero, texto, empresaId=null) {
  const evoUrl = cfg.wppInbox?.evolutionUrl
  const evoKey = cfg.wppInbox?.evolutionKey
  if (!evoUrl || !evoKey || !texto?.trim()) return
  const num = numero.replace(/\D/g,'')
  const full = num.startsWith('55') ? num : `55${num}`
  try {
    await fetch(`${evoUrl}/message/sendText/${instancia}`, {
      method:'POST', headers:{apikey:evoKey,'Content-Type':'application/json'},
      body: JSON.stringify({number:full, text:texto})
    })
  } catch(e) { console.error('[bot] enviarTexto:', e.message) }

  // ✅ Salva mensagem enviada na conversa (para aparecer no inbox)
  if (empresaId) {
    try {
      const ts = new Date().toISOString()
      const novaMensagem = {
        id:        `bot_${Date.now()}_${Math.random().toString(36).slice(2)}`,
        fromMe:    true,
        de:        'empresa',
        texto,
        tipo:      'text',
        timestamp: ts,
        lida:      true,
      }
      const { data: convRow } = await supabase.from('vx_storage').select('value')
        .eq('key', `wpp_conv:${empresaId}:${numero}`).maybeSingle()
      if (convRow?.value) {
        const c = JSON.parse(convRow.value)
        c.mensagens   = [...(c.mensagens||[]), novaMensagem]
        c.ultimaMensagem = texto
        c.ultimaAt    = ts
        c.updatedAt   = ts
        await supabase.from('vx_storage').upsert(
          { key: `wpp_conv:${empresaId}:${numero}`, value: JSON.stringify(c), updated_at: ts },
          { onConflict: 'key' }
        )
        // Atualiza índice
        const { data: idxRow } = await supabase.from('vx_storage').select('value')
          .eq('key', `wpp_idx:${empresaId}`).maybeSingle()
        if (idxRow?.value) {
          const idx = JSON.parse(idxRow.value)
          if (idx[numero]) {
            idx[numero] = {...idx[numero], ultimaMensagem: texto, ultimaAt: ts, updatedAt: ts}
            await supabase.from('vx_storage').upsert(
              { key: `wpp_idx:${empresaId}`, value: JSON.stringify(idx), updated_at: ts },
              { onConflict: 'key' }
            )
          }
        }
      }
    } catch(e) { console.error('[bot] salvar mensagem enviada:', e.message) }
  }
}

async function enviarMidiaBot(cfg, instancia, numero, mediaType, mediaUrl, caption) {
  const evoUrl = cfg.wppInbox?.evolutionUrl
  const evoKey = cfg.wppInbox?.evolutionKey
  if (!evoUrl || !evoKey || !mediaUrl) return
  const num = numero.replace(/\D/g,'')
  const full = num.startsWith('55') ? num : `55${num}`
  try {
    await fetch(`${evoUrl}/message/sendMedia/${instancia}`, {
      method:'POST', headers:{apikey:evoKey,'Content-Type':'application/json'},
      body: JSON.stringify({number:full, mediatype:mediaType||'image', media:mediaUrl, caption:caption||''})
    })
  } catch(e) { console.error('[bot] enviarMidia:', e.message) }
}

function sleepBot(ms) { return new Promise(r=>setTimeout(r,ms)) }

async function executarFluxoBot({empresaId, cfg, fluxo, conv, mensagemCliente, vars={}}) {
  const {nodes=[], connections=[]} = fluxo
  const botState = conv.botState || {}
  let currentNodeId = botState.currentNodeId || null
  let botVars = {...(botState.vars||{}), ...vars}
  let aguardandoResposta = botState.aguardandoResposta || false
  const instancia = conv.instancia || cfg.wppInbox?.evolutionInstance || ''
  const numero = conv.numero

  const getNode = id => nodes.find(n=>n.id===id)
  const getNext = (fromId, port='main') => {
    const c = connections.find(c=>c.fromId===fromId&&(c.fromPort===port||(!c.fromPort&&port==='main')))
    return c ? getNode(c.toId) : null
  }

  if (aguardandoResposta && currentNodeId) {
    const qn = getNode(currentNodeId)
    if (qn?.type==='question') {
      botVars[qn.data?.variable||'resposta'] = mensagemCliente
      const next = getNext(currentNodeId)
      currentNodeId = next?.id||null
      aguardandoResposta = false
    }
  }

  if (!currentNodeId) {
    const startNode = nodes.find(n=>n.type==='start')
    if (!startNode) return
    if (startNode.data?.text) {
      await enviarTextoBot(cfg, instancia, numero, substituirVars(startNode.data.text, botVars, conv), empresaId)
      await sleepBot(400)
    }
    currentNodeId = getNext(startNode.id)?.id||null
  }

  let iter = 0
  while (currentNodeId && iter < 15) {
    iter++
    const node = getNode(currentNodeId)
    if (!node) break

    if (node.type==='message') {
      await enviarTextoBot(cfg, instancia, numero, substituirVars(node.data?.text||'', botVars, conv), empresaId)
      await sleepBot(300)
      currentNodeId = getNext(node.id)?.id||null
      continue
    }

    if (node.type==='question') {
      await enviarTextoBot(cfg, instancia, numero, substituirVars(node.data?.text||node.data?.question||'', botVars, conv), empresaId)
      aguardandoResposta = true
      break
    }

    if (node.type==='condition') {
      const varName = node.data?.variable||'opcao'
      const valor = (botVars[varName]||mensagemCliente||'').trim().toLowerCase()
      const branches = node.data?.branches||[]
      let matchIdx = -1
      for (let i=0; i<branches.length; i++) {
        const kw = (branches[i]?.keyword||'').toLowerCase().trim()
        if (!kw) continue
        if (valor===kw||valor===String(i+1)||valor.includes(kw)) { matchIdx=i; break }
      }
      const port = matchIdx>=0 ? `branch_${matchIdx}` : 'main'
      currentNodeId = (getNext(node.id,port)||getNext(node.id,'main'))?.id||null
      continue
    }

    if (node.type==='delay') {
      await sleepBot(Math.min((node.data?.seconds||2)*1000, 10000))
      currentNodeId = getNext(node.id)?.id||null
      continue
    }

    if (node.type==='media') {
      if (node.data?.mediaUrl) {
        await enviarMidiaBot(cfg, instancia, numero, node.data.mediaType||'image', node.data.mediaUrl, substituirVars(node.data.caption||'', botVars, conv))
        await sleepBot(400)
      }
      currentNodeId = getNext(node.id)?.id||null
      continue
    }

    if (node.type==='goto') {
      if (node.data?.text) await enviarTextoBot(cfg, instancia, numero, substituirVars(node.data.text, botVars, conv), empresaId)
      if (node.data?.gotoFlowId) {
        conv.botState = {currentNodeId:null, vars:botVars, aguardandoResposta:false, fluxoId:node.data.gotoFlowId}
        await saveConvBot(empresaId, numero, conv)
        const fd = await getFlows(empresaId)
        const nf = (fd?.flows||[]).find(f=>f.id===node.data.gotoFlowId)
        if (nf) await executarFluxoBot({empresaId,cfg,fluxo:nf,conv,mensagemCliente:'',vars:botVars})
      }
      return
    }

    if (node.type==='human'||node.type==='action') {
      if (node.data?.text) {
        await enviarTextoBot(cfg, instancia, numero, substituirVars(node.data.text, botVars, conv), empresaId)
        await sleepBot(300)
      }
      const tipo = node.data?.actionType
      if (node.type==='action'&&tipo==='close') {
        await enviarTextoBot(cfg, instancia, numero, substituirVars(node.data?.closeText||'Obrigado pelo contato! 😊', botVars, conv), empresaId)
        conv.status='finalizado'; conv.botPausado=true; conv.finalizadoEm=new Date().toISOString()
      } else if (node.type==='action'&&tipo==='webhook'&&node.data?.webhookUrl) {
        try { await fetch(node.data.webhookUrl,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({numero,vars:botVars})}) } catch{}
        currentNodeId = getNext(node.id)?.id||null; continue
      } else {
        conv.status = 'aguardando'
        conv.botPausado = true
        if (node.data?.departamentoId) conv.departamentoId = node.data.departamentoId
      }
      conv.botState={currentNodeId:null,vars:{},aguardandoResposta:false}
      await saveConvBot(empresaId,numero,conv)
      return
    }

    if (node.type==='end') {
      const txt = substituirVars(node.data?.text||'Obrigado pelo contato! Até mais. 👋', botVars, conv)
      await enviarTextoBot(cfg, instancia, numero, txt, empresaId)
      conv.status='finalizado'; conv.botPausado=true; conv.finalizadoEm=new Date().toISOString()
      conv.botState={currentNodeId:null,vars:{},aguardandoResposta:false}
      await saveConvBot(empresaId,numero,conv)
      return
    }

    currentNodeId = getNext(node.id)?.id||null
  }

  conv.botState = {currentNodeId, vars:botVars, aguardandoResposta, fluxoId:fluxo.id}
  await saveConvBot(empresaId, numero, conv)
}

// ── Converte texto em áudio via Gemini TTS ────────────
async function gerarAudioGemini(texto, geminiKey, voz = 'Aoede') {
  try {
    const r = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-tts:generateContent?key=${geminiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: texto }] }],
          generationConfig: {
            responseModalities: ['AUDIO'],
            speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: voz } } }
          }
        })
      }
    )
    const d = await r.json()
    const audioData = d.candidates?.[0]?.content?.parts?.[0]?.inlineData
    if (audioData?.data) return { base64: audioData.data, mimeType: audioData.mimeType || 'audio/wav' }
    console.warn('[TTS] Gemini não retornou áudio:', JSON.stringify(d).slice(0, 200))
    return null
  } catch (e) {
    console.error('[TTS] Gemini TTS erro:', e.message)
    return null
  }
}

// ── OpenAI TTS ────────────────────────────────────────
async function gerarAudioOpenAI(texto, openaiKey, voz = 'nova') {
  try {
    const r = await fetch('https://api.openai.com/v1/audio/speech', {
      method: 'POST',
      headers: { Authorization: `Bearer ${openaiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'tts-1', input: texto, voice: voz, response_format: 'mp3' })
    })
    if (!r.ok) return null
    const buffer = await r.arrayBuffer()
    return { base64: Buffer.from(buffer).toString('base64'), mimeType: 'audio/mp3' }
  } catch (e) {
    console.error('[TTS] OpenAI TTS erro:', e.message)
    return null
  }
}

// ── ElevenLabs TTS ────────────────────────────────────
async function gerarAudioElevenLabs(texto, apiKey, voiceId = '21m00Tcm4TlvDq8ikWAM') {
  // voiceId padrão: Rachel (voz feminina natural em pt-BR)
  try {
    const r = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
      method: 'POST',
      headers: { 'xi-api-key': apiKey, 'Content-Type': 'application/json', Accept: 'audio/mpeg' },
      body: JSON.stringify({ text: texto, model_id: 'eleven_multilingual_v2', voice_settings: { stability: 0.5, similarity_boost: 0.75 } })
    })
    if (!r.ok) return null
    const buffer = await r.arrayBuffer()
    return { base64: Buffer.from(buffer).toString('base64'), mimeType: 'audio/mpeg' }
  } catch (e) {
    console.error('[TTS] ElevenLabs TTS erro:', e.message)
    return null
  }
}

// ── Roteador de TTS (tenta provedores em ordem) ───────
async function gerarAudioTTS(texto, agente, cfg) {
  const provider  = agente.ttsProvider || 'gemini'
  const voz       = agente.ttsVoz || 'Aoede'
  const geminiKey = agente.geminiKey || cfg.geminiApiKey || process.env.GEMINI_API_KEY || ''
  const openaiKey = agente.openaiKey || cfg.openaiApiKey || process.env.OPENAI_API_KEY || ''
  const elevenKey = agente.elevenLabsKey || cfg.elevenLabsKey || ''

  if (provider === 'gemini' && geminiKey) {
    const audio = await gerarAudioGemini(texto, geminiKey, voz)
    if (audio) return audio
  }

  if (provider === 'openai' && openaiKey) {
    const audio = await gerarAudioOpenAI(texto, openaiKey, voz || 'nova')
    if (audio) return audio
  }

  if (provider === 'elevenlabs' && elevenKey) {
    const audio = await gerarAudioElevenLabs(texto, elevenKey)
    if (audio) return audio
  }

  // Fallback: tenta Gemini se tiver chave independente do provedor
  if (provider !== 'gemini' && geminiKey) {
    const audio = await gerarAudioGemini(texto, geminiKey, 'Aoede')
    if (audio) return audio
  }

  return null
}

// ── Envia áudio via Evolution API ────────────────────
async function enviarAudioBot(cfg, instancia, numero, audioBase64, mimeType = 'audio/ogg', empresaId = null, texto = '') {
  const evoUrl = cfg.wppInbox?.evolutionUrl
  const evoKey = cfg.wppInbox?.evolutionKey
  if (!evoUrl || !evoKey || !audioBase64) return false

  const num  = numero.replace(/\D/g, '')
  const full = num.startsWith('55') ? num : `55${num}`

  // Detecta a extensão correta do áudio
  const ext = mimeType.includes('wav') ? 'wav' : mimeType.includes('mp3') ? 'mp3' : 'ogg'
  const mediaType = `audio/${ext}`

  try {
    // Evolution API v2: envia áudio como base64
    const resp = await fetch(`${evoUrl}/message/sendMedia/${instancia}`, {
      method: 'POST',
      headers: { apikey: evoKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        number: full,
        mediatype: 'audio',
        mimetype: mediaType,
        media: `data:${mediaType};base64,${audioBase64}`,
        fileName: `resposta.${ext}`,
        caption: '',
      })
    })
    const result = await resp.json()
    console.log('[TTS] Áudio enviado:', resp.ok, JSON.stringify(result).slice(0, 100))

    // Salva no inbox como mensagem de áudio enviada
    if (empresaId && texto) {
      const ts = new Date().toISOString()
      const novaMensagem = {
        id:         `bot_audio_${Date.now()}`,
        fromMe:     true,
        de:         'empresa',
        texto:      '[Áudio]',
        tipo:       'audio',
        mediaBase64: audioBase64,
        mimetype:   mediaType,
        timestamp:  ts,
        lida:       true,
      }
      const { data: convRow } = await supabase.from('vx_storage').select('value')
        .eq('key', `wpp_conv:${empresaId}:${numero}`).maybeSingle()
      if (convRow?.value) {
        const c = JSON.parse(convRow.value)
        c.mensagens      = [...(c.mensagens || []), novaMensagem]
        c.ultimaMensagem = '[Áudio]'
        c.ultimaAt       = ts
        c.updatedAt      = ts
        await supabase.from('vx_storage').upsert(
          { key: `wpp_conv:${empresaId}:${numero}`, value: JSON.stringify(c), updated_at: ts },
          { onConflict: 'key' }
        )
      }
    }
    return resp.ok
  } catch (e) {
    console.error('[TTS] enviarAudio erro:', e.message)
    return false
  }
}

async function chamarIABot(cfg, agente, mensagem, historico=[], mediaBase64=null, mediaTipo=null, mimetype=null, empresaId=null) {
  if (!agente) return null
  const geminiKey = agente.geminiKey||cfg.geminiApiKey||process.env.GEMINI_API_KEY||''
  const groqKey   = agente.groqKey  ||cfg.groqApiKey  ||process.env.GROQ_API_KEY  ||''
  const openaiKey = agente.openaiKey||cfg.openaiApiKey ||process.env.OPENAI_API_KEY||''
  const grokKey   = agente.grokKey  ||cfg.grokApiKey   ||process.env.GROK_API_KEY  ||''
  const provider  = agente.provider || 'openai'

  const hist = historico.slice(-8).map(m=>`${m.fromMe||m.de==='empresa'?'Assistente':'Cliente'}: ${m.texto||m.body||''}`).join('\n')
  const basePrompt = agente.prompt || `Você é um assistente comercial da empresa ${cfg.company||'Vivanexa'}. Responda de forma cordial e objetiva em português. Máx 300 caracteres.`

  // ✅ Google Calendar: injeta horários disponíveis no contexto se gcalEnabled
  let agendaContexto = ''
  if (agente.gcalEnabled && empresaId) {
    try {
      const horarios = await buscarDisponibilidadeGcal(empresaId, agente, cfg)
      if (horarios && horarios.length > 0) {
        agendaContexto = `\n\nHORÁRIOS DISPONÍVEIS PARA AGENDAMENTO (próximos 7 dias):\n${horarios.map((h,i)=>`${i+1}. ${h}`).join('\n')}\n\nSe o cliente quiser agendar, ofereça estes horários. Quando ele confirmar um, diga que o agendamento foi registrado e use o formato: AGENDAR:[nome do cliente]|[data e hora confirmada]`
      }
    } catch {}
  }

  // Contexto de mídia para o prompt de texto
  const mediaContexto = mediaTipo === 'audio'    ? '\n[O cliente enviou um áudio. Você não consegue ouvir diretamente, mas tente ajudar.]'
                      : mediaTipo === 'image'    ? '\n[O cliente enviou uma imagem.]'
                      : mediaTipo === 'video'    ? '\n[O cliente enviou um vídeo.]'
                      : mediaTipo === 'document' ? '\n[O cliente enviou um documento.]'
                      : ''

  const promptTexto = `${basePrompt}${agendaContexto}${mediaContexto}\n\n${hist?`Histórico:\n${hist}\n`:''}\nCliente: ${mensagem||'(enviou mídia)'}\nAssistente:`

  // ── OpenAI (gpt-4o suporta imagem via base64) ────────
  if (openaiKey) {
    try {
      const model = agente.model || 'gpt-4o-mini'
      let content

      if (mediaBase64 && mediaTipo === 'image' && model.includes('gpt-4o')) {
        // GPT-4o vision: envia imagem como base64
        const b64 = mediaBase64.includes(',') ? mediaBase64.split(',')[1] : mediaBase64
        const mime = mimetype || 'image/jpeg'
        content = [
          { type: 'text', text: `${basePrompt}\n\n${hist?`Histórico:\n${hist}\n`:''}\nCliente enviou esta imagem${mensagem?` com a mensagem: "${mensagem}"`:''}.` },
          { type: 'image_url', image_url: { url: `data:${mime};base64,${b64}`, detail: 'low' } }
        ]
      } else if (mediaBase64 && mediaTipo === 'audio' && model.includes('gpt-4o')) {
        // GPT-4o audio
        const b64 = mediaBase64.includes(',') ? mediaBase64.split(',')[1] : mediaBase64
        content = [
          { type: 'text', text: `${basePrompt}\n\n${hist?`Histórico:\n${hist}\n`:''}\nCliente enviou um áudio${mensagem?` com a mensagem: "${mensagem}"`:''}.` },
          { type: 'input_audio', input_audio: { data: b64, format: 'mp4' } }
        ]
      } else {
        content = promptTexto
      }

      const r = await fetch('https://api.openai.com/v1/chat/completions', {
        method:'POST',
        headers:{Authorization:`Bearer ${openaiKey}`,'Content-Type':'application/json'},
        body:JSON.stringify({model, messages:[{role:'user',content}], max_tokens:400})
      })
      const d = await r.json()
      const txt = d.choices?.[0]?.message?.content?.trim()
      if (txt) return txt
    } catch(e) { console.error('[IA] OpenAI:', e.message) }
  }

  // ── Gemini (suporta imagem, áudio e vídeo via inlineData) ──
  if (geminiKey) {
    try {
      const model = agente.model?.includes('gemini') ? agente.model : 'gemini-2.0-flash'
      let parts = []

      if (mediaBase64) {
        const b64clean = mediaBase64.includes(',') ? mediaBase64.split(',')[1] : mediaBase64
        const mimeType = mimetype || (
          mediaTipo === 'image'    ? 'image/jpeg'   :
          mediaTipo === 'audio'    ? 'audio/ogg'    :
          mediaTipo === 'video'    ? 'video/mp4'    :
          mediaTipo === 'document' ? 'application/pdf' : 'application/octet-stream'
        )
        // Gemini aceita imagem, áudio e vídeo via inlineData
        parts.push({ inlineData: { mimeType, data: b64clean } })
      }

      const textoParte = mediaTipo
        ? `${basePrompt}\n\n${hist?`Histórico:\n${hist}\n`:''}\nCliente enviou ${
            mediaTipo==='audio'?'um áudio':mediaTipo==='image'?'uma imagem':mediaTipo==='video'?'um vídeo':'um arquivo'
          }${mensagem?` com a mensagem: "${mensagem}"`:'. Analise e responda de forma útil.'}`
        : promptTexto

      parts.push({ text: textoParte })

      const r = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${geminiKey}`,
        {method:'POST',headers:{'Content-Type':'application/json'},
         body:JSON.stringify({contents:[{parts}]})}
      )
      const d = await r.json()
      const txt = d.candidates?.[0]?.content?.parts?.[0]?.text?.trim()
      if (txt) return txt
    } catch(e) { console.error('[IA] Gemini:', e.message) }
  }

  // ── Groq (texto + visão em modelos vision) ──────────
  if (groqKey && (provider === 'groq' || !openaiKey && !geminiKey)) {
    try {
      const model = agente.model || 'llama3-8b-8192'
      const supportsVision = model.includes('vision')

      let messages
      if (supportsVision && mediaBase64 && mediaTipo === 'image') {
        const b64 = mediaBase64.includes(',') ? mediaBase64.split(',')[1] : mediaBase64
        const mime = mimetype || 'image/jpeg'
        messages = [{
          role: 'user',
          content: [
            { type: 'text', text: `${basePrompt}\n\n${hist?`Histórico:\n${hist}\n`:''}\nCliente enviou esta imagem${mensagem?` com a mensagem: "${mensagem}"`:'.'}` },
            { type: 'image_url', image_url: { url: `data:${mime};base64,${b64}` } }
          ]
        }]
      } else {
        messages = [{ role: 'user', content: promptTexto }]
      }

      const r = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method:'POST',
        headers:{Authorization:`Bearer ${groqKey}`,'Content-Type':'application/json'},
        body:JSON.stringify({model, messages, max_tokens:400})
      })
      const d = await r.json()
      const txt = d.choices?.[0]?.message?.content?.trim()
      if (txt) return txt
    } catch(e) { console.error('[IA] Groq:', e.message) }
  }

  // ── Grok / xAI (texto + imagem) ──────────────────────
  if (grokKey && (provider === 'grok' || !openaiKey && !geminiKey && !groqKey)) {
    try {
      const model = agente.model || 'grok-2-vision'
      const supportsVision = model.includes('vision')

      let messages
      if (supportsVision && mediaBase64 && mediaTipo === 'image') {
        const b64 = mediaBase64.includes(',') ? mediaBase64.split(',')[1] : mediaBase64
        const mime = mimetype || 'image/jpeg'
        messages = [{
          role: 'user',
          content: [
            { type: 'text', text: `${basePrompt}\n\n${hist?`Histórico:\n${hist}\n`:''}\nCliente enviou esta imagem${mensagem?` com a mensagem: "${mensagem}"`:'.'}` },
            { type: 'image_url', image_url: { url: `data:${mime};base64,${b64}` } }
          ]
        }]
      } else {
        messages = [{ role: 'user', content: promptTexto }]
      }

      const r = await fetch('https://api.x.ai/v1/chat/completions', {
        method:'POST',
        headers:{Authorization:`Bearer ${grokKey}`,'Content-Type':'application/json'},
        body:JSON.stringify({model, messages, max_tokens:400})
      })
      const d = await r.json()
      const txt = d.choices?.[0]?.message?.content?.trim()
      if (txt) return txt
    } catch(e) { console.error('[IA] Grok:', e.message) }
  }

  return null
}

async function buscarDisponibilidadeGcal(empresaId, agente, cfg) {
  // Busca token do Google Calendar
  const tokenKey = `gcal_token:${empresaId}`
  const { data: tokenRow } = await supabase.from('vx_storage').select('value').eq('key', tokenKey).maybeSingle()
  if (!tokenRow?.value) return null

  let token = JSON.parse(tokenRow.value)

  // Refresh token se necessário
  if (token.expires_in && token.obtained_at) {
    const expiresAt = token.obtained_at + (token.expires_in * 1000)
    if (Date.now() > expiresAt - 60000 && token.refresh_token) {
      try {
        const clientId     = cfg.gcal?.clientId || cfg.googleClientId || ''
        const clientSecret = cfg.gcal?.clientSecret || cfg.googleClientSecret || ''
        const r = await fetch('https://oauth2.googleapis.com/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: token.refresh_token, client_id: clientId, client_secret: clientSecret })
        })
        const novo = await r.json()
        if (novo.access_token) {
          token = { ...token, ...novo, obtained_at: Date.now() }
          await supabase.from('vx_storage').upsert({ key: tokenKey, value: JSON.stringify(token), updated_at: new Date().toISOString() }, { onConflict: 'key' })
        }
      } catch {}
    }
  }

  if (!token.access_token) return null

  // Busca próximos 7 dias
  const agora = new Date()
  const fim   = new Date(agora.getTime() + 7 * 24 * 60 * 60 * 1000)

  try {
    const r = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=${agora.toISOString()}&timeMax=${fim.toISOString()}&singleEvents=true&orderBy=startTime&maxResults=20`,
      { headers: { Authorization: `Bearer ${token.access_token}` } }
    )
    const d = await r.json()
    const eventos = (d.items || []).map(e => ({
      titulo:  e.summary || 'Ocupado',
      inicio:  e.start?.dateTime || e.start?.date,
      fim:     e.end?.dateTime   || e.end?.date,
    }))

    // Gera lista de horários livres (dias úteis 8h-18h)
    const horariosLivres = []
    for (let i = 1; i <= 7; i++) {
      const dia = new Date(agora)
      dia.setDate(dia.getDate() + i)
      if (dia.getDay() === 0 || dia.getDay() === 6) continue // pula fim de semana
      const diaStr = dia.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: '2-digit' })
      for (const hora of ['09:00', '10:00', '11:00', '14:00', '15:00', '16:00']) {
        const slot = new Date(`${dia.toISOString().slice(0,10)}T${hora}:00`)
        const slotFim = new Date(slot.getTime() + 60 * 60 * 1000)
        const ocupado = eventos.some(e => {
          const ini = new Date(e.inicio)
          const f   = new Date(e.fim)
          return slot < f && slotFim > ini
        })
        if (!ocupado) horariosLivres.push(`${diaStr} às ${hora}`)
      }
      if (horariosLivres.filter(h => h.includes(diaStr)).length >= 2) continue
    }

    return horariosLivres.slice(0, 6)
  } catch (e) {
    console.error('[gcal] buscarDisponibilidade:', e.message)
    return null
  }
}

async function criarEventoGcal(empresaId, cfg, titulo, dataHora, duracaoMin = 60, descricao = '') {
  const tokenKey = `gcal_token:${empresaId}`
  const { data: tokenRow } = await supabase.from('vx_storage').select('value').eq('key', tokenKey).maybeSingle()
  if (!tokenRow?.value) return false

  const token = JSON.parse(tokenRow.value)
  if (!token.access_token) return false

  const inicio = new Date(dataHora)
  const fim    = new Date(inicio.getTime() + duracaoMin * 60000)

  try {
    const r = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token.access_token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        summary:     titulo,
        description: descricao,
        start: { dateTime: inicio.toISOString(), timeZone: 'America/Sao_Paulo' },
        end:   { dateTime: fim.toISOString(),    timeZone: 'America/Sao_Paulo' },
      })
    })
    return r.ok
  } catch {
    return false
  }
}

async function processarBot(empresaId, numero, mensagem) {
  const cfg  = await getCfg(empresaId)
  const conv = await getConv(empresaId, numero)
  if (!conv) return

  if (conv.status==='atendendo'||conv.status==='finalizado') return

  const flowsData = await getFlows(empresaId)
  const modoAutomacao = flowsData?.modoAutomacao||'chatbot'
  const botAtivo = flowsData?.botAtivo===true

  // Extrai mídia da última mensagem recebida
  const mensagens   = conv.mensagens || []
  const ultimaMsg   = [...mensagens].reverse().find(m => !m.fromMe && m.de !== 'empresa')
  const mediaBase64 = ultimaMsg?.mediaBase64 || null
  const mediaTipo   = ultimaMsg?.tipo !== 'text' ? ultimaMsg?.tipo : null
  const mimetype    = ultimaMsg?.mimetype || null

  // Modo Agente IA global
  if (modoAutomacao==='agente' && botAtivo && !conv.botPausado) {
    const agente = (cfg.wppAgentes||[]).find(a=>a.ativo)
    if (agente) {
      const resposta = await chamarIABot(cfg, agente, mensagem, mensagens.slice(-10), mediaBase64, mediaTipo, mimetype, empresaId)
      if (resposta) {
        const agendarMatch = resposta.match(/AGENDAR:([^|]+)\|(.+)/i)
        let respostaFinal = resposta.replace(/AGENDAR:[^\n]+/gi, '').trim()

        if (agendarMatch && agente.gcalEnabled) {
          try {
            const dataMatch = agendarMatch[2]?.trim().match(/(\d{1,2})\/(\d{1,2}).*?(\d{1,2}):(\d{2})/)
            if (dataMatch) {
              const ano = new Date().getFullYear()
              const dataHora = new Date(`${ano}-${dataMatch[2].padStart(2,'0')}-${dataMatch[1].padStart(2,'0')}T${dataMatch[3].padStart(2,'0')}:${dataMatch[4]}:00-03:00`)
              const criado = await criarEventoGcal(empresaId, cfg, `Atendimento — ${conv.nome||'Cliente'}`, dataHora, 60, `Agendado via WhatsApp. Número: ${numero}`)
              if (criado && !respostaFinal) respostaFinal = `✅ Agendado! Te esperamos no dia ${dataMatch[1]}/${dataMatch[2]} às ${dataMatch[3]}:${dataMatch[4]}. 😊`
            }
          } catch(e) { console.error('[gcal] criarEvento:', e.message) }
        }

        const instancia = conv.instancia||cfg.wppInbox?.evolutionInstance||''
        const textoParaEnviar = respostaFinal || resposta

        // ✅ Responde em áudio se: cliente mandou áudio E agente tem responderEmAudio ativo
        const deveResponderEmAudio = agente.responderEmAudio && mediaTipo === 'audio'

        if (deveResponderEmAudio) {
          const audio = await gerarAudioTTS(textoParaEnviar, agente, cfg)
          if (audio) {
            await enviarAudioBot(cfg, instancia, numero, audio.base64, audio.mimeType, empresaId, textoParaEnviar)
          } else {
            // Fallback para texto se TTS falhar
            await enviarTextoBot(cfg, instancia, numero, textoParaEnviar, empresaId)
          }
        } else {
          await enviarTextoBot(cfg, instancia, numero, textoParaEnviar, empresaId)
        }
      }
    }
    return
  }

  // Modo Chatbot Flow
  if (modoAutomacao==='chatbot' && botAtivo && !conv.botPausado) {
    const fluxoId = conv.botState?.fluxoId||flowsData?.activeFlowId
    const fluxo   = (flowsData?.flows||[]).find(f=>f.id===fluxoId)
                 || (flowsData?.flows||[]).find(f=>f.active)
                 || flowsData?.flows?.[0]
    if (fluxo) {
      await executarFluxoBot({empresaId, cfg, fluxo, conv, mensagemCliente: mensagem})
      return
    }
  }

  // Agente IA de departamento (fallback)
  if (!conv.botPausado) {
    const depto  = (cfg.wppDeps||[]).find(d=>d.id===conv.departamentoId)
    const agente = depto?.agentIA ? (cfg.wppAgentes||[]).find(a=>a.id===depto.agentIA&&a.ativo) : null
    if (agente) {
      const resposta = await chamarIABot(cfg, agente, mensagem, mensagens.slice(-10), mediaBase64, mediaTipo, mimetype, empresaId)
      if (resposta) {
        const agendarMatch = resposta.match(/AGENDAR:([^|]+)\|(.+)/i)
        let respostaFinal = resposta.replace(/AGENDAR:[^\n]+/gi, '').trim()
        if (agendarMatch && agente.gcalEnabled) {
          try {
            const dataMatch = agendarMatch[2]?.trim().match(/(\d{1,2})\/(\d{1,2}).*?(\d{1,2}):(\d{2})/)
            if (dataMatch) {
              const ano = new Date().getFullYear()
              const dataHora = new Date(`${ano}-${dataMatch[2].padStart(2,'0')}-${dataMatch[1].padStart(2,'0')}T${dataMatch[3].padStart(2,'0')}:${dataMatch[4]}:00-03:00`)
              const criado = await criarEventoGcal(empresaId, cfg, `Atendimento — ${conv.nome||'Cliente'}`, dataHora, 60, `Agendado via WhatsApp. Número: ${numero}`)
              if (criado && !respostaFinal) respostaFinal = `✅ Agendado! Te esperamos no dia ${dataMatch[1]}/${dataMatch[2]} às ${dataMatch[3]}:${dataMatch[4]}. 😊`
            }
          } catch {}
        }
        const instancia = conv.instancia||cfg.wppInbox?.evolutionInstance||''
        await enviarTextoBot(cfg, instancia, numero, respostaFinal||resposta, empresaId)
      }
    }
  }
}

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

    // ✅ FIX: Chama o motor do bot DIRETAMENTE (sem HTTP fetch)
    // No Vercel, serverless functions não podem chamar outras via HTTP internamente
    if (!fromMe) {
      try {
        await processarBot(empresaId, numero, textoFinal)
      } catch (e) {
        console.error('[webhook] Erro no bot:', e.message)
      }
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
