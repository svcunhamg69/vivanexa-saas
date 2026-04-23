// pages/api/wpp/media.js
// Proxy para buscar mídia da Evolution API sem CORS no browser

import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

export default async function handler(req, res) {
  const { empresaId, instancia, mediaId } = req.query
  if (!empresaId || !instancia || !mediaId) {
    return res.status(400).json({ error: 'Parâmetros inválidos' })
  }

  try {
    // Busca credenciais da empresa
    const { data: row } = await supabase
      .from('vx_storage').select('value')
      .eq('key', `cfg:${empresaId}`).maybeSingle()

    if (!row?.value) return res.status(404).json({ error: 'Empresa não encontrada' })

    const cfg = JSON.parse(row.value)
    const evoUrl = cfg.wppInbox?.evolutionUrl
    const evoKey = cfg.wppInbox?.evolutionKey

    if (!evoUrl || !evoKey) return res.status(400).json({ error: 'Evolution API não configurada' })

    // Busca mídia na Evolution API (server-side, sem CORS)
    const r = await fetch(`${evoUrl}/chat/getBase64FromMediaMessage/${instancia}`, {
      method: 'POST',
      headers: { apikey: evoKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: { key: { id: mediaId } }, convertToMp4: false })
    })

    if (!r.ok) return res.status(r.status).json({ error: 'Mídia não encontrada' })

    const data = await r.json()
    const base64 = data?.base64 || data?.mediaBase64 || ''
    const mimetype = data?.mimetype || 'application/octet-stream'

    if (!base64) return res.status(404).json({ error: 'Base64 não retornado' })

    // Retorna como imagem/áudio diretamente
    const buffer = Buffer.from(base64, 'base64')
    res.setHeader('Content-Type', mimetype)
    res.setHeader('Cache-Control', 'public, max-age=86400')
    return res.send(buffer)
  } catch (err) {
    console.error('[media proxy]', err.message)
    return res.status(500).json({ error: err.message })
  }
}
