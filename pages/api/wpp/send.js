// ─────────────────────────────────────────────────────────────────────────────
// pages/api/wpp/send.js — Rota do Next.js que o painel chama para enviar
// Esta rota repassa a mensagem para o seu servidor whatsapp-web.js
// ─────────────────────────────────────────────────────────────────────────────

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { empresaId, numero, mensagem } = req.body

  if (!numero || !mensagem) {
    return res.status(400).json({ ok: false, error: 'numero e mensagem são obrigatórios' })
  }

  // URL do seu servidor WhatsApp — configure no .env.local do Next.js
  const WPP_SERVER = process.env.WPP_SERVER_URL || 'http://localhost:3001'

  try {
    const resp = await fetch(`${WPP_SERVER}/api/send`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ empresaId, numero, mensagem }),
    })

    const data = await resp.json()

    if (!resp.ok) {
      return res.status(resp.status).json({ ok: false, error: data.error || 'Erro ao enviar' })
    }

    return res.json({ ok: true, message: 'Mensagem enviada!' })

  } catch (e) {
    console.error('[API /wpp/send]', e.message)
    return res.status(500).json({ ok: false, error: 'Servidor WhatsApp indisponível: ' + e.message })
  }
}
