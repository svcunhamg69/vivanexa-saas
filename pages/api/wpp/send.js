// pages/api/wpp/send.js
// Envia mensagens via Evolution API (WhatsApp QR Code)
// ou via Meta Cloud API (WhatsApp Oficial)

import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método não permitido' })

  try {
    const { empresaId, numero, mensagem, tipo = 'text', mediaUrl, mediaCaption } = req.body

    if (!empresaId || !numero || !mensagem) {
      return res.status(400).json({ error: 'empresaId, numero e mensagem são obrigatórios' })
    }

    // Buscar config da empresa
    const { data: row } = await supabase
      .from('vx_storage').select('value').eq('key', `cfg:${empresaId}`).single()
    const cfg = row?.value ? JSON.parse(row.value) : {}

    const wppCfg = cfg.wppInbox || {}
    const provider = wppCfg.provider || 'evolution' // 'evolution' | 'meta'

    let result

    // ── Evolution API (QR Code) ──────────────────────────────────
    if (provider === 'evolution') {
      const baseUrl = wppCfg.evolutionUrl || process.env.EVOLUTION_API_URL || ''
      const apiKey  = wppCfg.evolutionKey || process.env.EVOLUTION_API_KEY || ''
      const instance= wppCfg.evolutionInstance || ''

      if (!baseUrl || !apiKey || !instance) {
        return res.status(400).json({ error: 'Evolution API não configurada. Verifique Config → WhatsApp.' })
      }

      const numeroLimpo = numero.replace(/\D/g, '')
      const url = `${baseUrl}/message/sendText/${instance}`

      const body = tipo === 'text'
        ? { number: numeroLimpo, text: mensagem }
        : { number: numeroLimpo, media: { mediatype: tipo, media: mediaUrl, caption: mediaCaption || mensagem } }

      const endpoint = tipo === 'text'
        ? `${baseUrl}/message/sendText/${instance}`
        : `${baseUrl}/message/sendMedia/${instance}`

      const r = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'apikey': apiKey },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(15000),
      })
      result = await r.json()
      if (!r.ok) return res.status(r.status).json({ error: result?.message || 'Erro Evolution API', detail: result })
    }

    // ── Meta Cloud API (Oficial) ──────────────────────────────────
    if (provider === 'meta') {
      const phoneId = cfg.wpp?.phoneId || ''
      const token   = cfg.wpp?.token   || ''

      if (!phoneId || !token) {
        return res.status(400).json({ error: 'WhatsApp Oficial não configurado. Verifique Config → Integrações.' })
      }

      const numeroLimpo = numero.replace(/\D/g, '')
      const r = await fetch(`https://graph.facebook.com/v19.0/${phoneId}/messages`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          recipient_type: 'individual',
          to: numeroLimpo,
          type: 'text',
          text: { preview_url: false, body: mensagem },
        }),
      })
      result = await r.json()
      if (!r.ok) return res.status(r.status).json({ error: result?.error?.message || 'Erro Meta API', detail: result })
    }

    // ── Salvar mensagem no histórico ─────────────────────────────
    const msgId = `msg_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`
    const numeroLimpo = numero.replace(/\D/g, '')
    const convKey = `wpp_conv:${empresaId}:${numeroLimpo}`

    const { data: convRow } = await supabase
      .from('vx_storage').select('value').eq('key', convKey).single().catch(() => ({ data: null }))

    const conv = convRow?.value ? JSON.parse(convRow.value) : {
      id: convKey, numero: numeroLimpo, empresaId,
      status: 'atendendo', ultimaMensagem: mensagem,
      ultimaAt: new Date().toISOString(), mensagens: [], naoLidas: 0
    }

    conv.mensagens = conv.mensagens || []
    conv.mensagens.push({
      id: msgId, de: 'empresa', para: numeroLimpo,
      texto: mensagem, tipo, mediaUrl, mediaCaption,
      at: new Date().toISOString(), lida: true,
    })
    conv.ultimaMensagem = mensagem
    conv.ultimaAt = new Date().toISOString()

    await supabase.from('vx_storage').upsert({
      key: convKey, value: JSON.stringify(conv), updated_at: new Date().toISOString()
    }, { onConflict: 'key' })

    return res.status(200).json({ success: true, msgId, result })
  } catch (err) {
    console.error('Erro wpp/send:', err)
    return res.status(500).json({ error: err.message || 'Erro interno' })
  }
}
