// pages/api/send-email.js
// Suporta: Brevo, SendGrid, Gmail, SMTP genérico
// Suporta: anexos em base64 (attachments: [{filename, content (base64), contentType}])

import nodemailer from 'nodemailer'

export const config = { api: { bodyParser: { sizeLimit: '20mb' } } }

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método não permitido' })

  const { to, subject, html, text, from, config: cfg, attachments = [] } = req.body

  if (!to || !subject) return res.status(400).json({ error: 'Destinatário e assunto são obrigatórios' })

  // ── Sem SMTP configurado → fallback (frontend abre mailto) ──
  if (!cfg?.smtpHost || !cfg?.smtpUser || !cfg?.smtpPass) {
    return res.status(200).json({ success: true, fallback: true })
  }

  try {
    const isBrevo    = cfg.smtpHost.includes('brevo.com') || cfg.smtpHost.includes('sendinblue')
    const isSendGrid = cfg.smtpHost.includes('sendgrid')
    const port       = Number(cfg.smtpPort) || 587
    const secure     = port === 465

    // Brevo smtp-relay: user=apikey, pass=<API_KEY>
    // Se o usuário salvou a API key no campo "Senha SMTP" mas deixou user como "apikey",
    // tentamos também com a apiKey do campo dedicado
    const smtpUser = cfg.smtpUser || 'apikey'
    const smtpPass = cfg.smtpPass || cfg.apiKey || ''

    const transporter = nodemailer.createTransport({
      host: cfg.smtpHost,
      port,
      secure,
      auth: { user: smtpUser, pass: smtpPass },
      tls: { rejectUnauthorized: false },
      // Brevo e SendGrid exigem STARTTLS explícito na 587
      requireTLS: !secure,
    })

    // Monta anexos a partir de base64
    const nodeAttachments = attachments
      .filter(a => a.content && a.filename)
      .map(a => ({
        filename: a.filename,
        content: Buffer.from(a.content, 'base64'),
        contentType: a.contentType || 'application/octet-stream',
      }))

    await transporter.sendMail({
      from: from || `"${cfg.nomeRemetente || 'Vivanexa'}" <${cfg.smtpUser}>`,
      to,
      subject,
      text: text || html?.replace(/<[^>]*>/g, ''),
      html,
      attachments: nodeAttachments,
    })

    return res.status(200).json({ success: true })
  } catch (err) {
    console.error('Erro ao enviar e-mail:', err.message)

    // Mensagem de erro mais clara para o usuário
    let msg = err.message
    if (msg.includes('535') || msg.includes('Authentication'))
      msg = 'Falha na autenticação SMTP. Verifique usuário/senha em Configurações → Empresa.'
    if (msg.includes('ECONNREFUSED'))
      msg = `Não foi possível conectar ao servidor SMTP (${cfg.smtpHost}:${cfg.smtpPort || 587}).`
    if (msg.includes('ETIMEDOUT'))
      msg = 'Timeout ao conectar ao servidor SMTP. Verifique host e porta.'

    return res.status(500).json({ error: msg })
  }
}
