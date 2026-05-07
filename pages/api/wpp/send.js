// pages/api/wpp/send.js — DEFINITIVO
// Repassa para o servidor WhatsApp que envia E salva
// NÃO salva aqui para evitar race condition

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { empresaId, numero, mensagem } = req.body

  if (!numero)    return res.status(400).json({ ok: false, error: 'numero é obrigatório' })
  if (!mensagem)  return res.status(400).json({ ok: false, error: 'mensagem é obrigatória' })

  const WPP_SERVER = process.env.WPP_SERVER_URL || 'http://localhost:3001'

  try {
    const resp = await fetch(`${WPP_SERVER}/api/send`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ numero, mensagem, salvar: true }),
    })

    const data = await resp.json()
    if (!resp.ok) return res.status(resp.status).json({ ok: false, error: data.error || 'Erro ao enviar' })

    return res.json({ ok: true, message: 'Mensagem enviada!' })

  } catch (e) {
    console.error('[API /wpp/send]', e.message)
    return res.status(500).json({ ok: false, error: 'Servidor WhatsApp indisponível: ' + e.message })
  }
}
