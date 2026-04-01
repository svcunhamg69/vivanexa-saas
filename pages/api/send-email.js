// pages/api/send-email.js
// ============================================================
// API para envio de e-mails usando SMTP ou APIs externas
// ============================================================

import nodemailer from 'nodemailer'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido' })
  }

  const { to, subject, html, text, from, config } = req.body

  if (!to || !subject) {
    return res.status(400).json({ error: 'Destinatário e assunto são obrigatórios' })
  }

  try {
    // Se tiver configuração de SMTP, usa ela
    if (config && config.smtpHost && config.smtpUser && config.smtpPass) {
      const transporter = nodemailer.createTransport({
        host: config.smtpHost,
        port: config.smtpPort || 587,
        secure: config.smtpPort === 465,
        auth: {
          user: config.smtpUser,
          pass: config.smtpPass,
        },
      })

      await transporter.sendMail({
        from: from || config.smtpUser,
        to,
        subject,
        text: text || html?.replace(/<[^>]*>/g, ''),
        html,
      })
      return res.status(200).json({ success: true })
    }

    // Caso contrário, fallback para mailto (abrir cliente de e-mail)
    // Isso é feito no frontend, então aqui apenas retornamos sucesso
    return res.status(200).json({ success: true, fallback: true })

  } catch (err) {
    console.error('Erro ao enviar e-mail:', err)
    return res.status(500).json({ error: err.message })
  }
}
