if (body?.object === 'whatsapp_business_account') {
  try {
    const entry   = body.entry?.[0]
    const change  = entry?.changes?.[0]
    const value   = change?.value
    const message = value?.messages?.[0]

    if (!message) return res.status(200).json({ status: 'no_message' })

    const from    = message.from
    const msgText = message.text?.body || ''
    const phoneId = value.metadata?.phone_number_id

    const token   = process.env.WHATSAPP_TOKEN

    // 🔥 IMPORTANTE: IMPORTAR SUPABASE
    const { createClient } = require('@supabase/supabase-js')

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    )

    const empresaId = 'default' // pode melhorar depois

    const numero = from

    // ─────────────────────────────────────────────
    // 1. SALVAR CONVERSA
    // ─────────────────────────────────────────────
    const convKey = `wpp_conv:${empresaId}:${numero}`

    let { data: row } = await supabase
      .from('vx_storage')
      .select('value')
      .eq('key', convKey)
      .maybeSingle()

    let conv = row?.value ? JSON.parse(row.value) : {
      numero,
      nome: numero,
      mensagens: [],
      status: 'automacao',
      naoLidas: 0,
      criadoEm: new Date().toISOString()
    }

    conv.mensagens.push({
      id: Date.now(),
      de: 'cliente',
      texto: msgText,
      tipo: 'text',
      at: new Date().toISOString()
    })

    conv.ultimaMensagem = msgText
    conv.updatedAt = new Date().toISOString()
    conv.naoLidas = (conv.naoLidas || 0) + 1

    await supabase.from('vx_storage').upsert({
      key: convKey,
      value: JSON.stringify(conv),
      updated_at: new Date().toISOString()
    }, { onConflict: 'key' })

    // ─────────────────────────────────────────────
    // 2. ATUALIZAR ÍNDICE
    // ─────────────────────────────────────────────
    const idxKey = `wpp_idx:${empresaId}`

    let { data: idxRow } = await supabase
      .from('vx_storage')
      .select('value')
      .eq('key', idxKey)
      .maybeSingle()

    let idx = idxRow?.value ? JSON.parse(idxRow.value) : {}

    idx[numero] = {
      numero,
      nome: numero,
      ultimaMensagem: msgText,
      updatedAt: conv.updatedAt,
      status: conv.status,
      naoLidas: conv.naoLidas
    }

    await supabase.from('vx_storage').upsert({
      key: idxKey,
      value: JSON.stringify(idx),
      updated_at: new Date().toISOString()
    }, { onConflict: 'key' })

    // ─────────────────────────────────────────────
    // 3. CHATBOT (igual você já tem)
    // ─────────────────────────────────────────────
    const resposta = gerarRespostaChatbot(msgText.toLowerCase())

    if (resposta && token && phoneId) {
      await enviarMensagem({ phoneId, token, para: from, texto: resposta })
    }

    return res.status(200).json({ status: 'ok' })
  } catch (err) {
    console.error('Erro no webhook WhatsApp:', err)
    return res.status(200).json({ status: 'error', message: err.message })
  }
}
