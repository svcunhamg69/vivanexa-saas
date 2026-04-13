// pages/api/wpp/disparo-massa.js
// ✅ NOVO: suporte a arquivo base64 (imagem/vídeo/áudio sem URL externa)
// ✅ Anti-banimento com delays inteligentes, múltiplas mensagens e mídias

import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

export const config = {
  api: { bodyParser: { sizeLimit: '50mb' } },
}

function randomDelay(minMs, maxMs) {
  const ms = Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs
  return new Promise((r) => setTimeout(r, ms))
}

function escolherMensagem(mensagens) {
  if (!mensagens || mensagens.length === 0) return null
  return mensagens[Math.floor(Math.random() * mensagens.length)]
}

function interpolarMensagem(texto, contato) {
  if (!texto) return texto
  return texto
    .replace(/\{\{nome\}\}|\{nome\}/gi,     contato.nome    || '')
    .replace(/\{\{empresa\}\}|\{empresa\}/gi, contato.empresa || '')
    .replace(/\{\{cidade\}\}|\{cidade\}/gi,   contato.cidade  || '')
    .replace(/\{\{numero\}\}|\{numero\}/gi,   contato.numero  || '')
}

// ✅ NOVO: envia mídia como base64 via Evolution API (mediaBase64 endpoint)
async function enviarMidiaBase64({ baseUrl, apiKey, instance, numero, base64Data, mediaNome, tipo, caption }) {
  const numeroLimpo = String(numero).replace(/\D/g, '').trim()

  // Remove o prefixo data:xxx;base64, se existir
  const base64Limpo = base64Data.includes(',') ? base64Data.split(',')[1] : base64Data

  // Detectar mimetype
  let mimetype = 'image/jpeg'
  if (base64Data.startsWith('data:')) {
    mimetype = base64Data.split(';')[0].replace('data:', '')
  } else if (tipo === 'video') mimetype = 'video/mp4'
  else if (tipo === 'audio') mimetype = 'audio/mpeg'
  else if (tipo === 'document') mimetype = 'application/pdf'

  const endpoint = `${baseUrl}/message/sendMedia/${instance}`
  const body = {
    number: numeroLimpo,
    media: {
      mediatype: tipo,
      media: base64Limpo,
      mimetype,
      caption: caption || '',
      fileName: mediaNome || `arquivo.${tipo === 'image' ? 'jpg' : tipo === 'video' ? 'mp4' : tipo === 'audio' ? 'mp3' : 'pdf'}`,
    }
  }

  let r = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: apiKey },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(30000),
  })
  let result = await r.json()

  if (!r.ok) {
    // Fallback Bearer
    r = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(30000),
    })
    result = await r.json()
  }

  return { ok: r.ok, status: r.status, result, numeroLimpo }
}

async function enviarMensagem({ baseUrl, apiKey, instance, numero, mensagem, tipo = 'text', mediaUrl, mediaCaption, mediaBase64, mediaNome }) {
  const numeroLimpo = String(numero).replace(/\D/g, '').trim()

  // ✅ NOVO: se tem base64, usa envio de arquivo direto
  if (mediaBase64 && tipo !== 'text') {
    return enviarMidiaBase64({ baseUrl, apiKey, instance, numero, base64Data: mediaBase64, mediaNome, tipo, caption: mediaCaption || mensagem || '' })
  }

  const endpoint =
    tipo === 'text'
      ? `${baseUrl}/message/sendText/${instance}`
      : `${baseUrl}/message/sendMedia/${instance}`

  const body =
    tipo === 'text'
      ? { number: numeroLimpo, text: mensagem }
      : {
          number: numeroLimpo,
          media: {
            mediatype: tipo,
            media: mediaUrl,
            caption: mediaCaption || mensagem || '',
            fileName: tipo === 'document' ? (mediaCaption || 'arquivo') : undefined,
          },
        }

  let r = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: apiKey },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(20000),
  })
  let result = await r.json()

  if (!r.ok && (result?.message?.includes('token') || result?.error)) {
    r = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(20000),
    })
    result = await r.json()
  }

  return { ok: r.ok, status: r.status, result, numeroLimpo }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido' })
  }

  try {
    const {
      empresaId,
      instanceKey,
      contatos,
      mensagens,
      tipo = 'text',
      mediaUrl,
      mediaCaption,
      // ✅ NOVO: parâmetros de arquivo base64
      mediaBase64 = false,    // true se mediaUrl contém base64
      mediaNome,              // nome original do arquivo
      delayMinMs = 8000,
      delayMaxMs = 20000,
      loteSize = 20,
      lotePausaMs = 60000,
    } = req.body

    if (!empresaId || !contatos?.length || !mensagens?.length) {
      return res.status(400).json({
        error: 'empresaId, contatos e mensagens são obrigatórios',
      })
    }

    // Buscar config da empresa
    const { data: row } = await supabase
      .from('vx_storage')
      .select('value')
      .eq('key', `cfg:${empresaId}`)
      .maybeSingle()

    const cfg = row?.value ? JSON.parse(row.value) : {}
    const wppCfg = cfg.wppInbox || {}

    let instanciaCfg = wppCfg
    if (instanceKey && cfg.wppInstancias?.[instanceKey]) {
      instanciaCfg = cfg.wppInstancias[instanceKey]
    }

    const baseUrl  = instanciaCfg.evolutionUrl      || process.env.EVOLUTION_API_URL  || ''
    const apiKey   = instanciaCfg.evolutionKey       || process.env.EVOLUTION_API_KEY  || ''
    const instance = instanciaCfg.evolutionInstance  || process.env.EVOLUTION_INSTANCE || ''

    if (!baseUrl || !apiKey || !instance) {
      return res.status(400).json({ error: 'Instância WhatsApp não configurada corretamente' })
    }

    const campanhaId = `camp_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`
    const iniciou    = new Date().toISOString()

    const resultados = []
    let enviados = 0
    let erros    = 0

    // ✅ Se é base64, extrai o dado uma vez (não passa para cada contato o payload inteiro)
    const base64Data = mediaBase64 ? mediaUrl : null

    for (let i = 0; i < contatos.length; i++) {
      const contato = contatos[i]
      const numero  = contato.numero || contato

      const msgBase       = escolherMensagem(mensagens)
      const mensagemFinal = interpolarMensagem(msgBase, { ...contato, numero })

      try {
        const { ok, status, result, numeroLimpo } = await enviarMensagem({
          baseUrl,
          apiKey,
          instance,
          numero,
          mensagem: mensagemFinal,
          tipo,
          mediaUrl:    !mediaBase64 ? mediaUrl : undefined,
          mediaCaption: mediaCaption ? interpolarMensagem(mediaCaption, contato) : undefined,
          // ✅ NOVO
          mediaBase64: mediaBase64 ? base64Data : undefined,
          mediaNome,
        })

        if (ok) {
          enviados++
          resultados.push({
            numero: numeroLimpo,
            nome: contato.nome || '',
            status: 'enviado',
            mensagemEnviada: mensagemFinal,
            at: new Date().toISOString(),
          })
        } else {
          erros++
          resultados.push({
            numero,
            nome: contato.nome || '',
            status: 'erro',
            motivo: result?.message || `HTTP ${status}`,
            at: new Date().toISOString(),
          })
        }
      } catch (err) {
        erros++
        resultados.push({
          numero,
          nome: contato.nome || '',
          status: 'erro',
          motivo: err.message,
          at: new Date().toISOString(),
        })
      }

      if ((i + 1) % loteSize === 0 && i < contatos.length - 1) {
        await new Promise((r) => setTimeout(r, lotePausaMs))
      } else if (i < contatos.length - 1) {
        await randomDelay(delayMinMs, delayMaxMs)
      }
    }

    // Salvar resultado da campanha (sem o base64 para não estourar o banco)
    const campanha = {
      id: campanhaId,
      empresaId,
      instanceKey: instanceKey || 'default',
      tipo,
      totalContatos: contatos.length,
      enviados,
      erros,
      iniciou,
      finalizou: new Date().toISOString(),
      resultados,
    }

    await supabase.from('vx_storage').upsert(
      {
        key: `campanha:${empresaId}:${campanhaId}`,
        value: JSON.stringify(campanha),
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'key' }
    )

    return res.status(200).json({
      success: true,
      campanhaId,
      total: contatos.length,
      enviados,
      erros,
      resultados,
    })
  } catch (err) {
    console.error('🔥 Erro disparo massa:', err)
    return res.status(500).json({ error: err.message || 'Erro interno' })
  }
}
