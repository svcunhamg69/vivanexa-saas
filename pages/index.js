// pages/index.js — Login Vivanexa SaaS
// Após login bem-sucedido redireciona para /dashboard
// CORREÇÃO: suporte a sub-usuários cadastrados em cfg.users (login por username/email + senha)
import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import Head from 'next/head'
import { supabase } from '../lib/supabase'

const LOGO_B64 = '/logo.png'

export default function Login() {
  const router = useRouter()
  const [login,    setLogin]    = useState('')   // aceita email OU username
  const [password, setPassword] = useState('')
  const [error,    setError]    = useState('')
  const [loading,  setLoading]  = useState(false)
  const [checking, setChecking] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        router.replace('/dashboard')
      } else {
        setChecking(false)
      }
    })

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) router.replace('/dashboard')
    })
    return () => listener.subscription.unsubscribe()
  }, [router])

  // ─── Tenta autenticar via Supabase Auth (admin/dono da empresa) ─────────
  async function tentarAuthSupabase(email, senha) {
    const { error: err } = await supabase.auth.signInWithPassword({ email, password: senha })
    return !err
  }

  // ─── Tenta autenticar via cfg.users (sub-usuário cadastrado no painel) ──
  // Percorre todos os registros vx_storage procurando o usuário pelo username ou email
  async function tentarAuthSubUser(loginDigitado, senhaDigitada) {
    try {
      // Busca todos os cfg de todas as empresas
      const { data: rows, error } = await supabase
        .from('vx_storage')
        .select('key, value')
        .like('key', 'cfg:%')

      if (error || !rows) return null

      for (const row of rows) {
        let cfg
        try { cfg = JSON.parse(row.value) } catch { continue }

        const users = cfg.users || []
        const encontrado = users.find(u =>
          u && (
            (u.username && u.username.toLowerCase() === loginDigitado.toLowerCase()) ||
            (u.email    && u.email.toLowerCase()    === loginDigitado.toLowerCase())
          ) && u.password === senhaDigitada
        )

        if (encontrado) {
          // Extrai empresaId da key "cfg:EMPRESA_ID"
          const empresaId = row.key.replace('cfg:', '')
          return { user: encontrado, empresaId, cfg }
        }
      }
      return null
    } catch {
      return null
    }
  }

  async function handleLogin(e) {
    e.preventDefault()
    if (!login || !password) { setError('Preencha login e senha.'); return }
    setLoading(true)
    setError('')

    const loginTrim = login.trim()

    // 1️⃣ Tenta primeiro pelo Supabase Auth (admin/dono — usa e-mail)
    const isEmail = loginTrim.includes('@')
    if (isEmail) {
      const ok = await tentarAuthSupabase(loginTrim, password)
      if (ok) return // _app.js vai pegar a sessão e redirecionar
    }

    // 2️⃣ Se falhou ou não é email, tenta como sub-usuário em cfg.users
    const subUser = await tentarAuthSubUser(loginTrim, password)

    if (subUser) {
      // Sub-usuário autenticado: salva os dados na sessão do browser
      // e redireciona para o dashboard
      sessionStorage.setItem('vx_subuser', JSON.stringify({
        id:        subUser.user.id,
        nome:      subUser.user.nome,
        email:     subUser.user.email,
        username:  subUser.user.username,
        tipo:      subUser.user.tipo || 'vendedor',
        permissoes: subUser.user.permissoes || [],
        empresaId: subUser.empresaId,
      }))
      router.replace('/dashboard')
      return
    }

    // 3️⃣ Se era email e não achou no Supabase Auth, tenta também como sub-usuário
    if (isEmail) {
      const subUserByEmail = await tentarAuthSubUser(loginTrim, password)
      if (subUserByEmail) {
        sessionStorage.setItem('vx_subuser', JSON.stringify({
          id:        subUserByEmail.user.id,
          nome:      subUserByEmail.user.nome,
          email:     subUserByEmail.user.email,
          username:  subUserByEmail.user.username,
          tipo:      subUserByEmail.user.tipo || 'vendedor',
          permissoes: subUserByEmail.user.permissoes || [],
          empresaId: subUserByEmail.empresaId,
        }))
        router.replace('/dashboard')
        return
      }
    }

    setError('Usuário ou senha incorretos.')
    setLoading(false)
  }

  function handleKeyLogin(e) { if (e.key === 'Enter') document.getElementById('lp').focus() }
  function handleKeyPass(e)  { if (e.key === 'Enter') handleLogin(e) }

  if (checking) {
    return (
      <>
        <Head><title>Vivanexa</title></Head>
        <style>{globalCSS}</style>
        <div className="spinner-wrap">
          <div className="spinner" />
          <div className="spinner-txt">Carregando...</div>
        </div>
      </>
    )
  }

  return (
    <>
      <Head>
        <title>Vivanexa – Login</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <link href="https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=DM+Mono:wght@300;400;500&display=swap" rel="stylesheet" />
      </Head>

      <style>{globalCSS}</style>

      <div className="orb orb1" />
      <div className="orb orb2" />

      <div className="login-screen">
        <div className="login-box">

          <div className="login-logo">
            <img src={LOGO_B64} alt="Vivanexa" onError={e => { e.target.style.display = 'none' }} />
          </div>

          <div className="login-title">ASSISTENTE COMERCIAL</div>

          <form onSubmit={handleLogin} noValidate>
            <div className="login-field">
              <label htmlFor="le">E-MAIL OU USUÁRIO</label>
              <input id="le" type="text" placeholder="seu@email.com ou username"
                autoComplete="username"
                value={login} onChange={e => setLogin(e.target.value)} onKeyDown={handleKeyLogin} />
            </div>

            <div className="login-field">
              <label htmlFor="lp">SENHA</label>
              <input id="lp" type="password" placeholder="••••••••" autoComplete="current-password"
                value={password} onChange={e => setPassword(e.target.value)} onKeyDown={handleKeyPass} />
            </div>

            <div className="login-err">{error}</div>

            <button type="submit" className="login-btn" disabled={loading}>
              {loading ? 'Entrando...' : 'Entrar'}
            </button>
          </form>

          <div style={{ textAlign: 'center', marginTop: '14px' }}>
            <button className="forgot-link" onClick={async () => {
              if (!login.includes('@')) { setError('Para redefinir senha, informe seu e-mail.'); return }
              setError('')
              const { error: err } = await supabase.auth.resetPasswordForEmail(login.trim())
              if (err) setError(err.message)
              else setError('✅ Link de redefinição enviado para seu e-mail!')
            }}>
              Esqueci minha senha
            </button>
          </div>

          <div className="login-version">Vivanexa SaaS v2.0</div>
        </div>
      </div>
    </>
  )
}

const globalCSS = `
  :root {
    --bg: #0a0f1e; --surface: #111827; --surface2: #1a2540;
    --border: #1e2d4a; --accent: #00d4ff; --accent2: #7c3aed;
    --text: #e2e8f0; --muted: #64748b; --danger: #ef4444;
  }
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  html { font-size: 15px; }
  body {
    font-family: 'DM Mono', monospace; background: var(--bg); color: var(--text);
    min-height: 100vh; display: flex; flex-direction: column; align-items: center; overflow-x: hidden;
  }
  body::before {
    content: ''; position: fixed; inset: 0;
    background-image: linear-gradient(rgba(0,212,255,.025) 1px, transparent 1px),
      linear-gradient(90deg, rgba(0,212,255,.025) 1px, transparent 1px);
    background-size: 40px 40px; pointer-events: none; z-index: 0;
  }
  .orb { position: fixed; border-radius: 50%; filter: blur(120px); pointer-events: none; z-index: 0; opacity: .10; }
  .orb1 { width: 500px; height: 500px; background: var(--accent); top: -200px; right: -150px; }
  .orb2 { width: 400px; height: 400px; background: var(--accent2); bottom: -150px; left: -100px; }
  .login-screen { position: fixed; inset: 0; background: var(--bg); z-index: 9999; display: flex; align-items: center; justify-content: center; padding: 20px; }
  .login-box { position: relative; z-index: 1; width: 100%; max-width: 400px; background: var(--surface); border: 1px solid var(--border); border-radius: 20px; padding: 36px 32px; box-shadow: 0 4px 24px rgba(0,0,0,.4); }
  .login-logo { text-align: center; margin-bottom: 20px; }
  .login-logo img { height: 56px; object-fit: contain; }
  .login-title { font-family: 'Syne', sans-serif; font-size: 13px; font-weight: 700; color: var(--muted); text-align: center; letter-spacing: 2px; text-transform: uppercase; margin-bottom: 28px; }
  .login-field { margin-bottom: 14px; }
  .login-field label { font-size: 11px; color: var(--muted); display: block; margin-bottom: 5px; letter-spacing: .8px; }
  .login-field input { width: 100%; background: var(--surface2); border: 1px solid var(--border); border-radius: 10px; padding: 11px 14px; font-family: 'DM Mono', monospace; font-size: 14px; color: var(--text); outline: none; transition: border-color .2s, box-shadow .2s; }
  .login-field input:focus { border-color: var(--accent); box-shadow: 0 0 0 3px rgba(0,212,255,.1); }
  .login-field input::placeholder { color: var(--muted); }
  .login-btn { width: 100%; padding: 13px; border-radius: 10px; background: linear-gradient(135deg, var(--accent), #0099bb); border: none; color: #fff; font-family: 'DM Mono', monospace; font-size: 14px; font-weight: 600; cursor: pointer; letter-spacing: .5px; transition: all .2s; margin-top: 8px; }
  .login-btn:hover:not(:disabled) { box-shadow: 0 0 20px rgba(0,212,255,.4); transform: translateY(-1px); }
  .login-btn:disabled { opacity: .6; cursor: not-allowed; }
  .login-err { font-size: 12px; color: var(--danger); text-align: center; margin-top: 10px; min-height: 18px; line-height: 1.4; white-space: pre-wrap; }
  .forgot-link { background: none; border: none; color: var(--muted); font-family: 'DM Mono', monospace; font-size: 11px; cursor: pointer; letter-spacing: .3px; transition: color .2s; padding: 0; }
  .forgot-link:hover { color: var(--accent); }
  .login-version { font-size: 10px; color: #2a3a5a; text-align: center; margin-top: 20px; letter-spacing: .5px; }
  .spinner-wrap { position: fixed; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 14px; background: var(--bg); z-index: 99999; font-family: 'DM Mono', monospace; }
  .spinner { width: 40px; height: 40px; border: 3px solid var(--border); border-top-color: var(--accent); border-radius: 50%; animation: spin .7s linear infinite; }
  .spinner-txt { color: var(--muted); font-size: 13px; letter-spacing: .5px; }
  @keyframes spin { to { transform: rotate(360deg); } }
`
