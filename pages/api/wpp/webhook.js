// pages/api/wpp/webhook.js — v3
// ══════════════════════════════════════════════════════════════════════
// Webhook Evolution API → Vivanexa Inbox
//
// Eventos tratados: MESSAGES_UPSERT
// Funcionalidades:
//   ✅ Recebe mensagens texto, imagem, áudio, vídeo, documento, emoji, sticker
//   ✅ Armazena base64 da mídia para exibição direta no Inbox
//   ✅ Cliente finalizado que retorna → conversa volta para Automação
//   ✅ Identifica a instância de origem da mensagem
//   ✅ Dispara Agente IA do departamento vinculado à instância
//   ✅ Agente IA reconhece imagem/áudio/vídeo via Gemini
//   ✅ Agente consulta Google Agenda do departamento para propor horários
// ══════════════════════════════════════════════════════════════════════

import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

export const config = { api: { bodyParser: { sizeLimit: '10mb' } } }

// ─── helpers ──────────────────────────────────────────────────────────

function limparNumero(n) {
  if (!n) return null
  const limpo = String(n).replace(/\D/g, '')
  if (limpo.length === 10 || limpo.length === 11) return '55' + limpo
  return limpo
}

function gerarProtocolo() {
  const now = new Date(), pad = n => String(n).padStart(2,'0')
  return `ATD-${now.getFullYear()}${pad(now.getMonth()+1)}${pad(now.getDate())}-${Math.floor(Math.random()*90000+10000)}`
}

async function getCfg(empresaId) {
  const { data } = await supabase.from('vx_storage').select('value').eq('key',`cfg:${empresaId}`).maybeSingle()
  return data?.value ? JSON.parse(data.value) : {}
}

// ─── Busca token e eventos do Google Agenda de um departamento ────────
async function buscarEventosAgendaDepto(empresaId, depId) {
  try {
    const { data } = await supabase.from('vx_storage').select('value')
      .eq('key', `gcal_token:${empresaId}:dep:${depId}`).maybeSingle()
    if (!data?.value) {
      // fallback para token principal
      const { data: d2 } = await supabase.from('vx_storage').select('value')
        .eq('key', `gcal_token:${empresaId}`).maybeSingle()
      if (!d2?.value) return []
      const token = JSON.parse(d2.value)
      return fetchCalendarEvents(token.access_token)
    }
    const token = JSON.parse(data.value)
    return fetchCalendarEvents(token.access_token)
  } catch { return [] }
}

async function fetchCalendarEvents(accessToken) {
  try {
    const now = new Date()
    const fim = new Date(now.getTime() + 7 * 86400000)
    const url = `https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=${now.toISOString()}&timeMax=${fim.toISOString()}&singleEvents=true&orderBy=startTime&maxResults=10`
    const r = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } })
    if (!r.ok) return []
    const d = await r.json()
    return (d.items || []).map(ev => ({
      titulo: ev.summary || '(sem título)',
      inicio: ev.start?.dateTime || ev.start?.date,
      fim:    ev.end?.dateTime   || ev.end?.date,
    }))
  } catch { return [] }
}

// ─── Chama Agente IA (Gemini > OpenAI > Groq) ─────────────────────────
async function chamarAgenteIA({ cfg, agente, depto, mensagem, historico = [], mediaBase64, mediaTipo, eventos = [] }) {
  const geminiKey = agente?.geminiKey || cfg.geminiApiKey || ''
  const openaiKey = agente?.openaiKey || cfg.openaiApiKey || ''
  const groqKey   = agente?.groqKey   || cfg.groqApiKey   || ''
  const model     = agente?.model || 'gpt-4o-mini'

  const agendaCtx = eventos.length > 0
    ? `\n\nAGENDA DOS PRÓXIMOS 7 DIAS:\n${eventos.slice(0,5).map(e => {
        const d = e.inicio ? new Date(e.inicio).toLocaleDateString('pt-BR',{weekday:'short',day:'2-digit',month:'2-digit'}) : ''
        const h = e.inicio ? new Date(e.inicio).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'}) : ''
        return `- ${d} ${h}: ${e.titulo}`
      }).join('\n')}\n\nSe o cliente quiser agendar, proponha horários LIVRES entre os eventos acima.`
    : ''

  const conhecimentoCtx = (agente?.conhecimento || []).slice(0,5)
    .map(k => `[${k.titulo}]: ${(k.conteudo||'').slice(0,800)}`).join('\n\n')

  const systemPrompt = [
    agente?.prompt || `Você é um assistente de atendimento da empresa ${cfg.company || 'Empresa'}.`,
    depto ? `\nDepartamento: ${depto.nome}` : '',
    conhecimentoCtx ? `\n\nBASE DE CONHECIMENTO:\n${conhecimentoCtx}` : '',
    agendaCtx,
    '\n\nRESPOSTAS: Curtas, máximo 4 linhas. NÃO mencione que é IA. Responda sempre em português.',
    mediaTipo ? `\nO cliente enviou uma ${mediaTipo === 'image' ? 'imagem' : mediaTipo === 'audio' ? 'mensagem de áudio' : 'vídeo'}. Descreva e responda ao contexto se possível.` : '',
  ].filter(Boolean).join('')

  const histStr = historico.slice(-8)
    .filter(m => m.de !== 'empresa' || !m._iaGerado)
    .map(m => `${m.de === 'empresa' ? 'Assistente' : 'Cliente'}: ${m.texto || '[mídia]'}`)
    .join('\n')
  const promptFinal = histStr ? `${histStr}\nCliente: ${mensagem || '[mídia]'}` : (mensagem || '[mídia recebida]')

  // ── Gemini (suporta multimodal) ──
  if (geminiKey) {
    try {
      const parts = []
      if (mediaBase64 && mediaTipo === 'image') {
        parts.push({ inlineData: { mimeType: 'image/jpeg', data: mediaBase64 } })
      } else if (mediaBase64 && mediaTipo === 'audio') {
        parts.push({ inlineData: { mimeType: 'audio/ogg', data: mediaBase64 } })
      } else if (mediaBase64 && mediaTipo === 'video') {
        parts.push({ inlineData: { mimeType: 'video/mp4', data: mediaBase64 } })
      }
      parts.push({ text: promptFinal })

      const geminiModel = agente?.model?.startsWith('gemini') ? agente.model : 'gemini-2.0-flash'
      const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${geminiModel}:generateContent?key=${geminiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts }],
          systemInstruction: { parts: [{ text: systemPrompt }] },
          generationConfig: { maxOutputTokens: agente?.maxTokens || 300 },
        }),
      })
      const d = await r.json()
      const txt = d.candidates?.[0]?.content?.parts?.[0]?.text
      if (txt) return txt.trim()
    } catch (e) { console.error('Gemini err:', e.message) }
  }

  // ── OpenAI ──
  if (openaiKey) {
    try {
      const messages = [
        { role: 'system', content: systemPrompt },
        { role: 'user',   content: promptFinal },
      ]
      // Se houver imagem e for gpt-4o, envia via vision
      if (mediaBase64 && mediaTipo === 'image' && model.includes('4o')) {
        messages[1] = { role: 'user', content: [
          { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${mediaBase64}` } },
          { type: 'text', text: promptFinal },
        ]}
      }
      const r = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { Authorization: `Bearer ${openaiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model, messages, max_tokens: agente?.maxTokens || 300 }),
      })
      const d = await r.json()
      const txt = d.choices?.[0]?.message?.content
      if (txt) return txt.trim()
    } catch (e) { console.error('OpenAI err:', e.message) }
  }

  // ── Groq ──
  if (groqKey) {
    try {
      const groqModel = agente?.provider === 'groq' ? model : 'llama3-70b-8192'
      const r = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: { Authorization: `Bearer ${groqKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: groqModel, messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: promptFinal }], max_tokens: agente?.maxTokens || 300 }),
      })
      const d = await r.json()
      const txt = d.choices?.[0]?.message?.content
      if (txt) return txt.trim()
    } catch (e) { console.error('Groq err:', e.message) }
  }

  return null
}

// ─── Envia mensagem via Evolution API ─────────────────────────────────
async function enviarMsgEvo(evoUrl, evoKey, instance, numero, texto) {
  try {
    const r = await fetch(`${evoUrl}/message/sendText/${instance}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: evoKey },
      body: JSON.stringify({ number: numero, text: texto }),
    })
    return r.ok
  } catch { return false }
}

// ─── Salva conversa + índice ───────────────────────────────────────────
async function salvarConversa(empresaId, numero, conv) {
  await supabase.from('vx_storage').upsert({
    key: `wpp_conv:${empresaId}:${numero}`,
    value: JSON.stringify(conv),
    updated_at: new Date().toISOString(),
  }, { onConflict: 'key' })
}

async function salvarIndice(empresaId, idx) {
  await supabase.from('vx_storage').upsert({
    key: `wpp_idx:${empresaId}`,
    value: JSON.stringify(idx),
    updated_at: new Date().toISOString(),
  }, { onConflict: 'key' })
}

// ─── Handler principal ─────────────────────────────────────────────────
export default async function handler(req, res) {
  if (req.method === 'GET') return res.status(200).json({ ok: true })
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método não permitido' })

  // Responde imediatamente para não timeout na Evolution API
  res.status(200).json({ received: true })

  try {
    const body = req.body

    // Suporta formato Evolution v1 e v2
    const event     = body.event || body.type || ''
    const data      = body.data || body
    const instance  = body.instance || data.instance || body.instanceName || ''
    const msgData   = data.message || data.messages?.[0] || data

    if (!['messages.upsert', 'MESSAGES_UPSERT', 'message'].includes(event) && !msgData?.key) return

    const key     = msgData.key || {}
    const fromMe  = key.fromMe === true
    if (fromMe) return // Ignora mensagens enviadas pela empresa

    const numero  = limparNumero(key.remoteJid?.replace('@s.whatsapp.net','') || msgData.from || '')
    if (!numero) return

    const msg     = msgData.message || msgData
    const now     = new Date().toISOString()

    // ── Extrai tipo e conteúdo da mensagem ──
    let tipo = 'texto', texto = '', mediaBase64 = null, mimetype = null, nomeArquivo = null

    if (msg.conversation || msg.extendedTextMessage?.text) {
      texto = msg.conversation || msg.extendedTextMessage?.text || ''
    } else if (msg.imageMessage) {
      tipo = 'image'; texto = msg.imageMessage.caption || '📷 Imagem'
      mimetype = msg.imageMessage.mimetype || 'image/jpeg'
    } else if (msg.audioMessage || msg.pttMessage) {
      tipo = 'audio'; texto = '🎵 Áudio'
      mimetype = (msg.audioMessage || msg.pttMessage)?.mimetype || 'audio/ogg'
    } else if (msg.videoMessage) {
      tipo = 'video'; texto = msg.videoMessage.caption || '🎬 Vídeo'
      mimetype = msg.videoMessage.mimetype || 'video/mp4'
    } else if (msg.documentMessage || msg.documentWithCaptionMessage) {
      tipo = 'document'
      const docMsg = msg.documentMessage || msg.documentWithCaptionMessage?.message?.documentMessage
      texto = docMsg?.caption || docMsg?.fileName || '📎 Documento'
      nomeArquivo = docMsg?.fileName || 'documento'
      mimetype = docMsg?.mimetype || 'application/octet-stream'
    } else if (msg.stickerMessage) {
      tipo = 'image'; texto = '🎭 Sticker'
    } else if (msg.reactionMessage) {
      texto = msg.reactionMessage.text || '👍'
    } else if (msg.locationMessage) {
      tipo = 'texto'; texto = `📍 Localização: ${msg.locationMessage.degreesLatitude?.toFixed(5)}, ${msg.locationMessage.degreesLongitude?.toFixed(5)}`
    } else {
      texto = '[mensagem não suportada]'
    }

    // Base64 pode vir inline na Evolution v2
    if (data.media?.base64) mediaBase64 = data.media.base64
    else if (data.base64) mediaBase64 = data.base64
    else if (msgData.base64) mediaBase64 = msgData.base64

    // ── Encontrar empresa pela instância ──
    // Busca em todos os cfgs qual tem esta instância
    const { data: rows } = await supabase.from('vx_storage').select('key,value').like('key','cfg:%')
    let empresaId = null, cfg = {}, instanciaObj = null

    for (const row of rows || []) {
      try {
        const c = JSON.parse(row.value)
        const insts = c.wppInbox?.instancias || []
        const found = insts.find(i => i.instance === instance || instance.includes(i.instance))
        if (found) {
          empresaId = row.key.replace('cfg:','')
          cfg = c
          instanciaObj = found
          break
        }
        // Fallback: evolutionInstance direto
        if (c.wppInbox?.evolutionInstance === instance || c.evolutionInstance === instance) {
          empresaId = row.key.replace('cfg:','')
          cfg = c
          break
        }
      } catch {}
    }

    if (!empresaId) {
      console.warn('[webhook] Instância não encontrada:', instance)
      return
    }

    const evoUrl = cfg.wppInbox?.evolutionUrl || cfg.evolutionApiUrl || ''
    const evoKey = cfg.wppInbox?.evolutionKey || cfg.evolutionApiToken || ''
    const instName = instanciaObj?.instance || instance

    // Se não veio base64 e é mídia, tenta buscar da Evolution API
    if (!mediaBase64 && ['image','audio','video','document'].includes(tipo) && evoUrl && evoKey && msgData.key?.id) {
      try {
        const r = await fetch(`${evoUrl}/chat/getBase64FromMediaMessage/${instName}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', apikey: evoKey },
          body: JSON.stringify({ message: msgData, convertToMp4: tipo === 'video' }),
        })
        if (r.ok) {
          const d = await r.json()
          mediaBase64 = d.base64 || d.media || null
        }
      } catch (e) { console.warn('[webhook] Erro ao buscar base64:', e.message) }
    }

    // ── Carrega conversa existente ──
    const convKey = `wpp_conv:${empresaId}:${numero}`
    const { data: convRow } = await supabase.from('vx_storage').select('value').eq('key', convKey).maybeSingle()
    let conv = convRow?.value ? JSON.parse(convRow.value) : null

    const msgId = `msg_${Date.now()}_${Math.random().toString(36).slice(2,7)}`
    const novaMensagem = {
      id: msgId, de: 'cliente', tipo, texto, at: now,
      ...(mediaBase64 ? { mediaBase64 } : {}),
      ...(mimetype    ? { mimetype }    : {}),
      ...(nomeArquivo ? { nomeArquivo } : {}),
    }

    const eraFinalizado = conv?.status === 'finalizado'

    if (!conv) {
      // Nova conversa
      conv = {
        numero, nome: numero, status: 'automacao', botPausado: false,
        mensagens: [novaMensagem], naoLidas: 1,
        criadoEm: now, updatedAt: now,
        instanciaId: instanciaObj?.id || '',
        departamentoId: instanciaObj?.departamentoId || '',
        departamentoNome: (cfg.wppDeps || []).find(d => d.id === instanciaObj?.departamentoId)?.nome || '',
      }
    } else {
      // ✅ FIX 1: Conversa finalizada que recebe nova mensagem → volta para automação
      if (eraFinalizado) {
        conv.status = 'automacao'
        conv.botPausado = false
        conv.protocolo = null
        conv.finalizadoEm = null
        conv.agenteId = null
        conv.agenteNome = null
      }
      conv.mensagens = [...(conv.mensagens || []).slice(-200), novaMensagem]
      conv.naoLidas = (conv.naoLidas || 0) + 1
      conv.updatedAt = now
      conv.ultimaMensagem = texto
    }

    // ── Atualiza índice ──
    const { data: idxRow } = await supabase.from('vx_storage').select('value').eq('key',`wpp_idx:${empresaId}`).maybeSingle()
    let idx = idxRow?.value ? JSON.parse(idxRow.value) : {}
    idx[numero] = {
      numero, nome: conv.nome || numero,
      status: conv.status, updatedAt: now,
      ultimaMensagem: texto, naoLidas: conv.naoLidas || 1,
      tags: conv.tags || [],
      instanciaId: conv.instanciaId || '',
      departamentoId: conv.departamentoId || '',
      departamentoNome: conv.departamentoNome || '',
      protocolo: conv.protocolo || null,
    }

    await salvarConversa(empresaId, numero, conv)
    await salvarIndice(empresaId, idx)

    // ── Dispara Agente IA se conversa em automação ──
    if (conv.status === 'automacao' && !conv.botPausado) {
      // Encontra o agente vinculado ao departamento
      const depId    = conv.departamentoId || instanciaObj?.departamentoId || ''
      const dep      = (cfg.wppDeps || []).find(d => d.id === depId)
      const agenteId = dep?.agenteIAId || (cfg.wppAgentes?.[0]?.id)
      const agente   = (cfg.wppAgentes || []).find(a => a.id === agenteId && a.ativo !== false)

      if (agente) {
        // Busca agenda do departamento se agente tem gcalEnabled
        let eventos = []
        if (agente.gcalEnabled && depId) {
          eventos = await buscarEventosAgendaDepto(empresaId, depId)
        } else if (agente.gcalEnabled) {
          eventos = await buscarEventosAgendaDepto(empresaId, null)
        }

        const resposta = await chamarAgenteIA({
          cfg, agente, depto: dep,
          mensagem: texto,
          historico: conv.mensagens.slice(-10),
          mediaBase64: agente.reconheceMidia !== false ? mediaBase64 : null,
          mediaTipo: tipo !== 'texto' && tipo !== 'document' ? tipo : null,
          eventos,
        })

        if (resposta && evoUrl && evoKey) {
          await enviarMsgEvo(evoUrl, evoKey, instName, numero, resposta)

          // Salva resposta da IA na conversa
          const msgIA = { id: `ia_${Date.now()}`, de: 'empresa', tipo: 'texto', texto: resposta, at: new Date().toISOString(), _iaGerado: true }
          conv.mensagens.push(msgIA)
          conv.updatedAt = new Date().toISOString()
          await salvarConversa(empresaId, numero, conv)
        }
      }
    }

  } catch (err) {
    console.error('[webhook] Erro:', err.message, err.stack)
  }
}
