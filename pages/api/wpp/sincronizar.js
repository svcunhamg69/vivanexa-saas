// ─────────────────────────────────────────────────────────────────────────────
// pages/api/wpp/sincronizar-msgs.js
// Retorna o histórico de mensagens de uma conversa do Supabase
// (antes buscava na Evolution API — agora busca direto do Supabase)
// ─────────────────────────────────────────────────────────────────────────────

import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { empresaId, numero, limite = 50 } = req.body

  if (!empresaId || !numero) {
    return res.status(400).json({ ok: false, error: 'empresaId e numero são obrigatórios' })
  }

  try {
    const { data: row } = await supabase
      .from('vx_storage')
      .select('value')
      .eq('key', `wpp_conv:${empresaId}:${numero}`)
      .maybeSingle()

    if (!row?.value) {
      return res.json({ ok: true, conv: null })
    }

    const conv = JSON.parse(row.value)

    // Retorna apenas as últimas N mensagens para não sobrecarregar
    if (conv.mensagens?.length > limite) {
      conv.mensagens = conv.mensagens.slice(-limite)
    }

    return res.json({ ok: true, conv })

  } catch (e) {
    console.error('[API /sincronizar-msgs]', e.message)
    return res.status(500).json({ ok: false, error: e.message })
  }
}
