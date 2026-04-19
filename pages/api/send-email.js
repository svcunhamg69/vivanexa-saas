// pages/api/send-email.js
import nodemailer from 'nodemailer'

export const config = { api: { bodyParser: { sizeLimit: '20mb' } } }

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método não permitido' })

  const { to, subject, html, text, from, config: cfg, attachments = [] } = req.body
  if (!to || !subject) return res.status(400).json({ error: 'Destinatário e assunto são obrigatórios' })

  if (!cfg?.smtpHost || !cfg?.smtpUser || !cfg?.smtpPass) {
    return res.status(200).json({ success: true, fallback: true })
  }

  const isBrevo = cfg.smtpHost.includes('brevo.com') || cfg.smtpHost.includes('sendinblue') || cfg.smtpUser === 'apikey'

  // ── Brevo: usa API HTTP (mais confiável que SMTP no Vercel) ──
  if (isBrevo) {
    const apiKey = cfg.smtpPass || cfg.apiKey || ''
    try {
      const body = {
        sender: { name: cfg.nomeRemetente || cfg.company || 'Vivanexa', email: cfg.emailRemetente || cfg.smtpFrom || to },
        to: [{ email: to }],
        subject,
        htmlContent: html || `<p>${text || ''}</p>`,
      }

      // Anexos
      if (attachments.length > 0) {
        body.attachment = attachments
          .filter(a => a.content && a.filename)
          .map(a => ({ name: a.filename, content: a.content }))
      }

      const resp = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'api-key': apiKey,
        },
        body: JSON.stringify(body),
      })

      const result = await resp.json()
      if (resp.ok) return res.status(200).json({ success: true })

      // Erro da API Brevo
      const msg = result.message || JSON.stringify(result)
      return res.status(500).json({ error: `Brevo API: ${msg}` })
    } catch (err) {
      return res.status(500).json({ error: 'Erro ao chamar API Brevo: ' + err.message })
    }
  }

  // ── SMTP genérico (Gmail, outros) ──
  try {
    const port   = Number(cfg.smtpPort) || 587
    const secure = port === 465

    const transporter = nodemailer.createTransport({
      host: cfg.smtpHost,
      port,
      secure,
      auth: { user: cfg.smtpUser, pass: cfg.smtpPass },
      tls: { rejectUnauthorized: false },
      requireTLS: !secure,
    })

    const nodeAttachments = attachments
      .filter(a => a.content && a.filename)
      .map(a => ({
        filename: a.filename,
        content: Buffer.from(a.content, 'base64'),
        contentType: a.contentType || 'application/octet-stream',
      }))

    await transporter.sendMail({
      from: from || `"${cfg.nomeRemetente || 'Vivanexa'}" <${cfg.smtpUser}>`,
      to, subject,
      text: text || html?.replace(/<[^>]*>/g, ''),
      html,
      attachments: nodeAttachments,
    })

    return res.status(200).json({ success: true })
  } catch (err) {
    let msg = err.message
    if (msg.includes('535') || msg.includes('Authentication')) msg = 'Falha na autenticação SMTP. Verifique usuário/senha em Configurações → Empresa.'
    if (msg.includes('ECONNREFUSED')) msg = `Não foi possível conectar ao servidor SMTP (${cfg.smtpHost}:${cfg.smtpPort || 587}).`
    if (msg.includes('ETIMEDOUT')) msg = 'Timeout ao conectar ao servidor SMTP.'
    return res.status(500).json({ error: msg })
  }
}
