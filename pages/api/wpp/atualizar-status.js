// pages/api/wpp/atualizar-status.js
// Atualiza o status de uma conversa:
// automacao | aguardando | atendendo | finalizado
// Também controla botPausado (pausa/retoma o bot)

import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { empresaId, numero, status, botPausado, protocolo, agenteId, agentNome } = req.body

  if (!empresaId || !numero) {
    return res.status(400).json({ ok: false, error: 'empresaId e numero são obrigatórios' })
  }

  const statusValidos = ['automacao', 'aguardando', 'atendendo', 'finalizado']
  if (status && !statusValidos.includes(status)) {
    return res.status(400).json({ ok: false, error: `Status inválido. Use: ${statusValidos.join(', ')}` })
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

    // Atualiza os campos enviados
    if (status !== undefined)     conv.status     = status
    if (botPausado !== undefined)  conv.botPausado = botPausado
    if (protocolo !== undefined)   conv.protocolo  = protocolo
    if (agenteId !== undefined)    conv.agenteId   = agenteId
    if (agentNome !== undefined)   conv.agentNome  = agentNome

    // Regras automáticas de status
    if (status === 'atendendo') {
      conv.botPausado = true   // pausa o bot quando humano assume
      conv.naoLidas   = 0
    }
    if (status === 'automacao') {
      conv.botPausado = false  // retoma o bot
      conv.agenteId   = null
      conv.agentNome  = null
    }
    if (status === 'finalizado') {
      conv.botPausado = true
      conv.protocolo  = protocolo || conv.protocolo
      conv.finalizadoEm = new Date().toISOString()
    }

    conv.updatedAt = new Date().toISOString()

    // Salva a conversa
    await supabase.from('vx_storage').upsert(
      { key: `wpp_conv:${empresaId}:${numero}`, value: JSON.stringify(conv), updated_at: new Date().toISOString() },
      { onConflict: 'key' }
    )

    // Atualiza o índice
    const { data: idxRow } = await supabase
      .from('vx_storage')
      .select('value')
      .eq('key', `wpp_idx:${empresaId}`)
      .maybeSingle()

    const idx = idxRow?.value ? JSON.parse(idxRow.value) : {}
    if (idx[numero]) {
      idx[numero].status    = conv.status
      idx[numero].updatedAt = conv.updatedAt
      idx[numero].naoLidas  = conv.naoLidas || 0
    }

    await supabase.from('vx_storage').upsert(
      { key: `wpp_idx:${empresaId}`, value: JSON.stringify(idx), updated_at: new Date().toISOString() },
      { onConflict: 'key' }
    )

    return res.json({ ok: true, conv })

  } catch (e) {
    console.error('[API /wpp/atualizar-status]', e.message)
    return res.status(500).json({ ok: false, error: e.message })
  }
}
