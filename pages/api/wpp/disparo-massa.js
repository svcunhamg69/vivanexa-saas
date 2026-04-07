// pages/api/wpp/disparo-massa.js
// ✅ Disparo em massa com anti-banimento, delays inteligentes, múltiplas mensagens e mídias

import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

export const config = {
  api: { bodyParser: { sizeLimit: '50mb' } },
}

// ─────────────────────────────────────────────
// Delay aleatório entre min e max ms
// ─────────────────────────────────────────────
function randomDelay(minMs, maxMs) {
  const ms = Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs
  return new Promise((r) => setTimeout(r, ms))
}

// ─────────────────────────────────────────────
// Seleciona mensagem aleatória do array (anti-spam)
// ─────────────────────────────────────────────
function escolherMensagem(mensagens) {
  if (!mensagens || mensagens.length === 0) return null
  return mensagens[Math.floor(Math.random() * mensagens.length)]
}

// ─────────────────────────────────────────────
// Substitui variáveis na mensagem: {{nome}}, {{empresa}} etc
// ─────────────────────────────────────────────
function interpolarMensagem(texto, contato) {
  if (!texto) return texto
  return texto
    .replace(/\{\{nome\}\}/gi, contato.nome || '')
    .replace(/\{\{empresa\}\}/gi, contato.empresa || '')
    .replace(/\{\{cidade\}\}/gi, contato.cidade || '')
    .replace(/\{\{numero\}\}/gi, contato.numero || '')
}

// ─────────────────────────────────────────────
// Envia uma única mensagem via Evolution API
// ─────────────────────────────────────────────
async function enviarMensagem({ baseUrl, apiKey, instance, numero, mensagem, tipo = 'text', mediaUrl, mediaCaption }) {
  const numeroLimpo = String(numero).replace(/\D/g, '').trim()

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
            mediatype: tipo, // image | video | audio | document
            media: mediaUrl,
            caption: mediaCaption || mensagem || '',
            fileName: tipo === 'document' ? (mediaCaption || 'arquivo') : undefined,
          },
        }

  // Tentativa 1: apikey header
  let r = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: apiKey },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(20000),
  })
  let result = await r.json()

  // Fallback: Bearer token
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

// ─────────────────────────────────────────────
// HANDLER PRINCIPAL
// ─────────────────────────────────────────────
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido' })
  }

  try {
    const {
      empresaId,
      instanceKey,        // chave da instância WPP a usar (suporta múltiplas)
      contatos,           // array de { numero, nome?, empresa?, cidade? }
      mensagens,          // array de strings (escolhe aleatório por contato)
      tipo = 'text',      // text | image | video | audio | document
      mediaUrl,           // URL da mídia (se tipo != text)
      mediaCaption,       // legenda da mídia
      delayMinMs = 8000,  // delay mínimo entre disparos (ms)
      delayMaxMs = 20000, // delay máximo entre disparos (ms)
      loteSize = 20,      // pausar a cada N envios
      lotePausaMs = 60000,// pausa entre lotes (ms)
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

    // Suporte a múltiplas instâncias: usa instanceKey se informado, senão padrão
    let instanciaCfg = wppCfg
    if (instanceKey && cfg.wppInstancias?.[instanceKey]) {
      instanciaCfg = cfg.wppInstancias[instanceKey]
    }

    const baseUrl = instanciaCfg.evolutionUrl || process.env.EVOLUTION_API_URL || ''
    const apiKey  = instanciaCfg.evolutionKey  || process.env.EVOLUTION_API_KEY  || ''
    const instance = instanciaCfg.evolutionInstance || process.env.EVOLUTION_INSTANCE || ''

    if (!baseUrl || !apiKey || !instance) {
      return res.status(400).json({ error: 'Instância WhatsApp não configurada corretamente' })
    }

    // ID único para esta campanha
    const campanhaId = `camp_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`
    const iniciou = new Date().toISOString()

    const resultados = []
    let enviados = 0
    let erros = 0

    // ─────────────────────────────────────────────
    // Loop de disparo com delays inteligentes
    // ─────────────────────────────────────────────
    for (let i = 0; i < contatos.length; i++) {
      const contato = contatos[i]
      const numero = contato.numero || contato

      // Escolhe mensagem aleatória e interpola variáveis
      const msgBase = escolherMensagem(mensagens)
      const mensagemFinal = interpolarMensagem(msgBase, { ...contato, numero })

      try {
        const { ok, status, result, numeroLimpo } = await enviarMensagem({
          baseUrl,
          apiKey,
          instance,
          numero,
          mensagem: mensagemFinal,
          tipo,
          mediaUrl,
          mediaCaption: mediaCaption ? interpolarMensagem(mediaCaption, contato) : undefined,
        })

        if (ok) {
          enviados++
          resultados.push({ numero: numeroLimpo, status: 'enviado', at: new Date().toISOString() })
        } else {
          erros++
          resultados.push({ numero, status: 'erro', motivo: result?.message || `HTTP ${status}`, at: new Date().toISOString() })
        }
      } catch (err) {
        erros++
        resultados.push({ numero, status: 'erro', motivo: err.message, at: new Date().toISOString() })
      }

      // Pausa entre lotes
      if ((i + 1) % loteSize === 0 && i < contatos.length - 1) {
        await new Promise((r) => setTimeout(r, lotePausaMs))
      } else if (i < contatos.length - 1) {
        // Delay aleatório entre mensagens (anti-banimento)
        await randomDelay(delayMinMs, delayMaxMs)
      }
    }

    // Salvar resultado da campanha no Supabase
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
