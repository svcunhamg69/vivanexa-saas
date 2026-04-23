// pages/api/wpp/media.js
// Proxy server-side para buscar mídia da Evolution API
// Evita CORS ao chamar Evolution diretamente do browser

import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

export const config = { api: { responseLimit: '50mb', bodyParser: { sizeLimit: '1mb' } } }

export default async function handler(req, res) {
  const { empresaId, instancia, mediaId } = req.query
  if (!empresaId || !instancia || !mediaId) {
    return res.status(400).json({ error: 'Parâmetros inválidos' })
  }

  try {
    const { data: row } = await supabase
      .from('vx_storage').select('value')
      .eq('key', `cfg:${empresaId}`).maybeSingle()

    if (!row?.value) return res.status(404).json({ error: 'Empresa não encontrada' })

    const cfg = JSON.parse(row.value)
    const evoUrl = cfg.wppInbox?.evolutionUrl
    const evoKey = cfg.wppInbox?.evolutionKey

    if (!evoUrl || !evoKey) return res.status(400).json({ error: 'Evolution API não configurada' })

    // Evolution API v2: POST /chat/getBase64FromMediaMessage/{instance}
    const r = await fetch(`${evoUrl}/chat/getBase64FromMediaMessage/${instancia}`, {
      method: 'POST',
      headers: { apikey: evoKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: { key: { id: mediaId } },
        convertToMp4: false
      })
    })

    if (!r.ok) {
      console.error('[media proxy] Evolution retornou:', r.status)
      return res.status(r.status).json({ error: 'Mídia não encontrada na Evolution' })
    }

    const data = await r.json()
    const base64 = data?.base64 || data?.mediaBase64 || ''
    const mimetype = data?.mimetype || 'application/octet-stream'

    if (!base64) return res.status(404).json({ error: 'Base64 não retornado pela Evolution' })

    // Remove prefixo data:... se presente
    const b64clean = base64.includes(',') ? base64.split(',')[1] : base64
    const buffer = Buffer.from(b64clean, 'base64')

    res.setHeader('Content-Type', mimetype)
    res.setHeader('Content-Length', buffer.length)
    res.setHeader('Cache-Control', 'public, max-age=3600')
    return res.send(buffer)
  } catch (err) {
    console.error('[media proxy]', err.message)
    return res.status(500).json({ error: err.message })
  }
}
