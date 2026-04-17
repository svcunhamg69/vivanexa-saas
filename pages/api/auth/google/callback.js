// pages/api/auth/google/callback.js
// SALVAR EM: pages/api/auth/google/callback.js (crie as pastas se não existirem)

import { supabase } from '../../../../lib/supabase'

export default async function handler(req, res) {
  const { code, state: userId, error } = req.query

  if (error) {
    return res.send(`<!DOCTYPE html><html><head><meta charset="UTF-8"></head><body style="font-family:sans-serif;text-align:center;padding:40px;background:#0a0f1e;color:#e2e8f0"><div style="font-size:48px;margin-bottom:16px">❌</div><h2 style="color:#ef4444">Erro: ${error}</h2><script>setTimeout(()=>window.close(),3000)</script></body></html>`)
  }

  if (!code || !userId) {
    return res.status(400).json({ error: 'Parâmetros inválidos' })
  }

  try {
    // Buscar credenciais salvas nas configurações da empresa
    const { data: cfgRow } = await supabase
      .from('vx_storage')
      .select('value')
      .eq('key', `cfg:${userId}`)
      .maybeSingle()

    const cfg = cfgRow?.value ? JSON.parse(cfgRow.value) : {}
    const clientId     = cfg.googleClientId     || process.env.GOOGLE_CLIENT_ID     || ''
    const clientSecret = cfg.googleClientSecret || process.env.GOOGLE_CLIENT_SECRET || ''
    const redirectUri  = `${req.headers.host?.startsWith('localhost') ? 'http' : 'https'}://${req.headers.host}/api/auth/google/callback`

    if (!clientId || !clientSecret) {
      return res.send(`<!DOCTYPE html><html><head><meta charset="UTF-8"></head><body style="font-family:sans-serif;text-align:center;padding:40px;background:#0a0f1e;color:#e2e8f0"><h2 style="color:#ef4444">❌ Credenciais Google não configuradas</h2><p style="color:#64748b">Configure o Google Client ID e Secret em Configurações → Integrações → Google Agenda</p><script>setTimeout(()=>window.close(),4000)</script></body></html>`)
    }

    // Trocar code por token
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id:     clientId,
        client_secret: clientSecret,
        redirect_uri:  redirectUri,
        grant_type:    'authorization_code',
      }),
    })

    if (!tokenRes.ok) {
      const err = await tokenRes.json()
      return res.send(`<!DOCTYPE html><html><head><meta charset="UTF-8"></head><body style="font-family:sans-serif;text-align:center;padding:40px;background:#0a0f1e;color:#e2e8f0"><h2 style="color:#ef4444">❌ ${err.error_description || 'Erro ao obter token'}</h2><script>setTimeout(()=>window.close(),3000)</script></body></html>`)
    }

    const token = await tokenRes.json()

    // Salvar token no Supabase
    await supabase.from('vx_storage').upsert({
      key:        `gcal_token:${userId}`,
      value:      JSON.stringify({ ...token, obtained_at: Date.now() }),
      updated_at: new Date().toISOString(),
    }, { onConflict: 'key' })

    // Retornar página que fecha o popup e passa o token para a janela pai
    return res.send(`<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><title>Google Agenda Conectado</title></head>
<body style="font-family:sans-serif;text-align:center;padding:40px;background:#0a0f1e;color:#e2e8f0">
  <div style="font-size:48px;margin-bottom:16px">✅</div>
  <h2 style="color:#10b981">Google Agenda conectado!</h2>
  <p style="color:#64748b">Esta janela fechará em instantes...</p>
  <script>
    const token = ${JSON.stringify(token)};
    if (window.opener) {
      window.opener.postMessage({ type: 'GCAL_TOKEN', token }, '*');
      setTimeout(() => window.close(), 1500);
    } else {
      setTimeout(() => { window.location.href = '/crm?gcal_ok=1'; }, 2000);
    }
  </script>
</body>
</html>`)

  } catch (err) {
    console.error('Google callback error:', err)
    return res.send(`<!DOCTYPE html><html><head><meta charset="UTF-8"></head><body style="font-family:sans-serif;text-align:center;padding:40px;background:#0a0f1e;color:#e2e8f0"><h2 style="color:#ef4444">❌ Erro interno</h2><p style="color:#64748b">${err.message}</p><script>setTimeout(()=>window.close(),3000)</script></body></html>`)
  }
}
