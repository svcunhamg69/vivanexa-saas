import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(200).json({ ok: true })
  }

  try {
    console.log("🔥 WEBHOOK RECEBIDO")
    console.log("📦 BODY:", JSON.stringify(req.body))

    const body = req.body

    // só processa mensagens
    if (body?.event !== 'messages.upsert' && body?.event !== 'MESSAGES_UPSERT') {
      return res.status(200).json({ ok: true })
    }

    const data = body?.data || {}
    const key = data?.key || {}
    const message = data?.message || {}

    const remoteJid = key?.remoteJid || ''
    if (!remoteJid) return res.status(200).json({ ok: true })

    const numero = remoteJid.replace('@s.whatsapp.net', '').replace(/\D/g, '')
    const texto =
      message?.conversation ||
      message?.extendedTextMessage?.text ||
      'sem texto'

    console.log("📞 NUMERO:", numero)
    console.log("💬 TEXTO:", texto)

    // 🔥 SEU EMPRESA ID FIXO
    const empresaId = "f05e57ba-abc8-46f3-b6cb-2db28888fd56"

    const agora = new Date().toISOString()
    const convKey = `wpp_conv:${empresaId}:${numero}`

    console.log("🔥 SALVANDO NO SUPABASE")

    // busca conversa existente
    const { data: convRow } = await supabase
      .from('vx_storage')
      .select('value')
      .eq('key', convKey)
      .maybeSingle()

    let conv = convRow?.value ? JSON.parse(convRow.value) : {
      id: convKey,
      numero,
      nome: numero,
      empresaId,
      mensagens: [],
      naoLidas: 0
    }

    // adiciona mensagem
    conv.mensagens.push({
      id: `msg_${Date.now()}`,
      de: 'cliente',
      texto,
      at: agora
    })

    conv.ultimaMensagem = texto
    conv.ultimaAt = agora
    conv.naoLidas = (conv.naoLidas || 0) + 1

    // salva
    await supabase.from('vx_storage').upsert({
      key: convKey,
      value: JSON.stringify(conv),
      updated_at: agora
    }, { onConflict: 'key' })

    console.log("✅ SALVO COM SUCESSO")

    return res.status(200).json({ ok: true })

  } catch (err) {
    console.error("❌ ERRO:", err)
    return res.status(200).json({ ok: true })
  }
}
