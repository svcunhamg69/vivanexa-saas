// pages/api/wpp/media.js
// Busca mídia (imagem, áudio, vídeo) de uma mensagem salva no Supabase
// Corrige os erros 404 em /api/wpp/media

import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

export default async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { empresaId, numero, msgId } = req.method === 'GET' ? req.query : req.body

  if (!empresaId || !numero || !msgId) {
    return res.status(400).json({ ok: false, error: 'empresaId, numero e msgId são obrigatórios' })
  }

  try {
    // Busca a conversa
    const { data: row } = await supabase
      .from('vx_storage')
      .select('value')
      .eq('key', `wpp_conv:${empresaId}:${numero}`)
      .maybeSingle()

    if (!row?.value) {
      return res.status(404).json({ ok: false, error: 'Conversa não encontrada' })
    }

    const conv = JSON.parse(row.value)
    const msg  = (conv.mensagens || []).find(m => m.id === msgId)

    if (!msg) {
      return res.status(404).json({ ok: false, error: 'Mensagem não encontrada' })
    }

    if (!msg.midia) {
      return res.status(404).json({ ok: false, error: 'Mensagem sem mídia' })
    }

    // Retorna a mídia em base64
    return res.json({
      ok:       true,
      base64:   msg.midia.base64,
      mimetype: msg.midia.mimetype,
      filename: msg.midia.filename,
    })

  } catch (e) {
    console.error('[API /wpp/media]', e.message)
    return res.status(500).json({ ok: false, error: e.message })
  }
}
