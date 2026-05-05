// pages/api/wpp/send.js — CORRIGIDO v2
// Envia mensagem pelo servidor WhatsApp e salva no histórico com de:'empresa'

import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { empresaId, numero, mensagem } = req.body

  if (!numero)    return res.status(400).json({ ok: false, error: 'numero é obrigatório' })
  if (!mensagem)  return res.status(400).json({ ok: false, error: 'mensagem é obrigatória' })
  if (!empresaId) return res.status(400).json({ ok: false, error: 'empresaId é obrigatório' })

  const WPP_SERVER = process.env.WPP_SERVER_URL || 'http://localhost:3001'

  try {
    // 1. Envia pelo servidor WhatsApp
    const resp = await fetch(`${WPP_SERVER}/api/send`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ empresaId, numero, mensagem }),
    })

    const data = await resp.json()
    if (!resp.ok) return res.status(resp.status).json({ ok: false, error: data.error || 'Erro ao enviar' })

    // 2. Salva a mensagem enviada no Supabase com de:'empresa'
    const msgObj = {
      id:        `sent_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      texto:     mensagem,
      de:        'empresa',   // ← ESSENCIAL para aparecer no lado direito do chat
      at:        new Date().toISOString(),
      timestamp: new Date().toISOString(),
      tipo:      'texto',
    }

    // Busca a conversa atual
    const { data: row } = await supabase
      .from('vx_storage')
      .select('value')
      .eq('key', `wpp_conv:${empresaId}:${numero}`)
      .maybeSingle()

    let conv = row?.value ? JSON.parse(row.value) : {
      numero,
      nome:          numero,
      status:        'atendendo',
      botPausado:    true,
      mensagens:     [],
      tags:          [],
      naoLidas:      0,
      criadaEm:      new Date().toISOString(),
      ultimaAt:      new Date().toISOString(),
      ultimaMensagem:'',
      ultimaDe:      'empresa',
      instancia:     'vivanexa-vendas',
    }

    // Evita duplicata
    const jaExiste = (conv.mensagens || []).some(m => m.id === msgObj.id)
    if (!jaExiste) {
      conv.mensagens  = [...(conv.mensagens || []), msgObj]
    }
    conv.ultimaAt      = msgObj.at
    conv.ultimaMensagem = mensagem.slice(0, 100)
    conv.ultimaDe      = 'empresa'
    conv.naoLidas      = 0   // zeramos pois a empresa está respondendo

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
    idx[numero] = {
      ...(idx[numero] || {}),
      numero,
      nome:          conv.nome || numero,
      ultimaMensagem: conv.ultimaMensagem,
      ultimaAt:      conv.ultimaAt,
      updatedAt:     new Date().toISOString(),
      status:        conv.status,
      naoLidas:      0,
      tags:          conv.tags || [],
    }

    await supabase.from('vx_storage').upsert(
      { key: `wpp_idx:${empresaId}`, value: JSON.stringify(idx), updated_at: new Date().toISOString() },
      { onConflict: 'key' }
    )

    return res.json({ ok: true, message: 'Mensagem enviada!', msg: msgObj })

  } catch (e) {
    console.error('[API /wpp/send]', e.message)
    return res.status(500).json({ ok: false, error: 'Servidor WhatsApp indisponível: ' + e.message })
  }
}
