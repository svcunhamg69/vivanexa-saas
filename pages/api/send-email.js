// pages/api/send-email.js
// ✅ FIX v2: suporta Brevo com apenas emailApiKey (sem smtpHost obrigatório)
import nodemailer from 'nodemailer'

export const config = { api: { bodyParser: { sizeLimit: '20mb' } } }

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método não permitido' })

  const { to, subject, html, text, from, config: cfg, attachments = [], empresaId, negocioId } = req.body
  if (!to || !subject) return res.status(400).json({ error: 'Destinatário e assunto são obrigatórios' })

  // ── Resolve a API key do Brevo de todos os campos possíveis ──
  const brevoApiKey = (cfg?.emailApiKey || cfg?.apiKey || cfg?.brevoApiKey
    || cfg?.api_key || cfg?.brevo_api_key || cfg?.smtpPass || '').trim()

  // ── Detecta se é Brevo ──
  const isBrevo =
    (cfg?.smtpHost && (cfg.smtpHost.includes('brevo.com') || cfg.smtpHost.includes('sendinblue'))) ||
    cfg?.smtpUser === 'apikey' ||
    cfg?.emailProvider === 'brevo' ||
    (brevoApiKey.length >= 20 && !cfg?.smtpHost)

  console.log('[send-email] isBrevo:', isBrevo, '| apiKey len:', brevoApiKey.length)

  if (isBrevo) {
    if (!brevoApiKey || brevoApiKey.length < 10) {
      return res.status(500).json({
        error: 'Brevo API: Key not found — acesse Configurações → Empresa → "API Key (Brevo/SendGrid)" e salve sua chave xsmtpib-...'
      })
    }

    try {
      const senderEmail = cfg.emailRemetente || cfg.smtpFrom || cfg.emailEmpresa
        || cfg.emailEmp || cfg.smtpUser || 'noreply@vivanexa.com.br'
      const senderName  = cfg.nomeRemetente || cfg.company || 'Vivanexa'

      const body = {
        sender:      { name: senderName, email: senderEmail },
        to:          [{ email: to }],
        subject,
        htmlContent: html || `<p style="font-family:Arial,sans-serif;white-space:pre-wrap">${(text || '').replace(/\n/g, '<br>')}</p>`,
        // Tags para rastreamento via webhook Brevo → /api/brevo-webhook
        ...(empresaId ? { tags: [`empresaId:${empresaId}`, negocioId ? `negocioId:${negocioId}` : 'negocioId:none'] } : {}),
      }

      if (attachments.length > 0) {
        body.attachment = attachments
          .filter(a => a.content && a.filename)
          .map(a => ({ name: a.filename, content: a.content }))
      }

      const resp = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'api-key': brevoApiKey },
        body: JSON.stringify(body),
      })

      const result = await resp.json()
      console.log('[send-email] Brevo status:', resp.status)

      if (resp.ok) return res.status(200).json({ success: true })

      let msg = result.message || JSON.stringify(result)
      if (resp.status === 401) msg = 'Chave API inválida. Verifique em Configurações → Empresa → API Key (Brevo).'
      return res.status(500).json({ error: `Brevo API: ${msg}` })
    } catch (err) {
      return res.status(500).json({ error: 'Erro ao chamar API Brevo: ' + err.message })
    }
  }

  // ── SMTP genérico ──
  if (!cfg?.smtpHost || !cfg?.smtpUser) {
    return res.status(200).json({ success: true, fallback: true })
  }

  if (!cfg.smtpPass) {
    return res.status(200).json({ success: true, fallback: true })
  }

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
    if (msg.includes('535') || msg.includes('Authentication')) msg = 'Falha na autenticação SMTP. Verifique usuário/senha.'
    if (msg.includes('ECONNREFUSED')) msg = `Não foi possível conectar ao servidor SMTP.`
    if (msg.includes('ETIMEDOUT')) msg = 'Timeout ao conectar ao servidor SMTP.'
    return res.status(500).json({ error: msg })
  }
}
