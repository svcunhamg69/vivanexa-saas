// pages/api/wpp/sincronizar-msgs.js — CORRIGIDO v2
// Busca histórico completo de uma conversa + índice de todas as conversas

import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { empresaId, numero, limite = 100 } = req.body

  if (!empresaId) return res.status(400).json({ ok: false, error: 'empresaId é obrigatório' })

  try {
    // Se veio número → busca conversa específica
    if (numero) {
      const { data: row } = await supabase
        .from('vx_storage')
        .select('value')
        .eq('key', `wpp_conv:${empresaId}:${numero}`)
        .maybeSingle()

      if (!row?.value) return res.json({ ok: true, conv: null })

      const conv = JSON.parse(row.value)

      // Retorna as últimas N mensagens
      if (conv.mensagens?.length > limite) {
        conv.mensagens = conv.mensagens.slice(-limite)
      }

      return res.json({ ok: true, conv })
    }

    // Se não veio número → busca o índice (lista de conversas)
    const { data: idxRow } = await supabase
      .from('vx_storage')
      .select('value')
      .eq('key', `wpp_idx:${empresaId}`)
      .maybeSingle()

    const idx = idxRow?.value ? JSON.parse(idxRow.value) : {}

    // Converte para array ordenado por data
    const lista = Object.values(idx).sort((a, b) =>
      new Date(b.ultimaAt || b.updatedAt || 0) - new Date(a.ultimaAt || a.updatedAt || 0)
    )

    return res.json({ ok: true, conversas: lista })

  } catch (e) {
    console.error('[API /sincronizar-msgs]', e.message)
    return res.status(500).json({ ok: false, error: e.message })
  }
}
