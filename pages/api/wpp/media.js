// pages/api/wpp/media.js — CORRIGIDO v2
// Aceita tanto mediaId (formato antigo Evolution API) quanto msgId

import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

export default async function handler(req, res) {
  const params = req.method === 'GET' ? req.query : req.body

  const {
    empresaId,
    numero,
    msgId,
    mediaId,      // formato antigo (Evolution API)
    instancia,    // ignorado — agora temos só uma instância própria
  } = params

  const eid    = empresaId
  const buscaId = msgId || mediaId   // aceita qualquer um dos dois

  if (!eid) {
    return res.status(400).json({ ok: false, error: 'empresaId é obrigatório' })
  }

  // Se não tiver número, tenta buscar em todas as conversas pelo mediaId
  if (!numero && buscaId) {
    try {
      // Busca o índice para saber quais conversas existem
      const { data: idxRow } = await supabase
        .from('vx_storage')
        .select('value')
        .eq('key', `wpp_idx:${eid}`)
        .maybeSingle()

      if (!idxRow?.value) {
        return res.status(404).json({ ok: false, error: 'Nenhuma conversa encontrada' })
      }

      const idx = JSON.parse(idxRow.value)
      const numeros = Object.keys(idx)

      // Procura a mensagem em todas as conversas
      for (const num of numeros) {
        const { data: row } = await supabase
          .from('vx_storage')
          .select('value')
          .eq('key', `wpp_conv:${eid}:${num}`)
          .maybeSingle()

        if (!row?.value) continue

        const conv = JSON.parse(row.value)
        const msg  = (conv.mensagens || []).find(
          m => m.id === buscaId || m.id?.includes(buscaId) || buscaId?.includes(m.id)
        )

        if (msg?.midia) {
          return res.json({
            ok:       true,
            base64:   msg.midia.base64,
            mimetype: msg.midia.mimetype,
            filename: msg.midia.filename || 'arquivo',
          })
        }
      }

      return res.status(404).json({ ok: false, error: 'Mídia não encontrada' })

    } catch (e) {
      console.error('[API /wpp/media]', e.message)
      return res.status(500).json({ ok: false, error: e.message })
    }
  }

  // Se tiver número, busca direto na conversa
  if (!numero) {
    return res.status(400).json({ ok: false, error: 'numero ou mediaId é obrigatório' })
  }

  try {
    const { data: row } = await supabase
      .from('vx_storage')
      .select('value')
      .eq('key', `wpp_conv:${eid}:${numero}`)
      .maybeSingle()

    if (!row?.value) {
      return res.status(404).json({ ok: false, error: 'Conversa não encontrada' })
    }

    const conv = JSON.parse(row.value)
    const msg  = (conv.mensagens || []).find(
      m => m.id === buscaId || m.id?.includes(buscaId) || buscaId?.includes(m.id)
    )

    if (!msg?.midia) {
      return res.status(404).json({ ok: false, error: 'Mídia não encontrada nesta conversa' })
    }

    return res.json({
      ok:       true,
      base64:   msg.midia.base64,
      mimetype: msg.midia.mimetype,
      filename: msg.midia.filename || 'arquivo',
    })

  } catch (e) {
    console.error('[API /wpp/media]', e.message)
    return res.status(500).json({ ok: false, error: e.message })
  }
}
