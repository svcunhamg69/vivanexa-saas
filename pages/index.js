import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import Head from 'next/head'
import { supabase } from '../lib/supabase'

// ── Logo base64 (extraída do sistema original) ───────────────────────────
const LOGO_B64 = '/logo.png' // Coloque o arquivo logo.png na pasta /public

export default function Login() {
  const router = useRouter()
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [error, setError]       = useState('')
  const [loading, setLoading]   = useState(false)
  const [checking, setChecking] = useState(true)

  // ── Restaura sessão ativa ──────────────────────────────────────────────
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        router.replace('/chat')
      } else {
        setChecking(false)
      }
    })

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) router.replace('/chat')
    })
    return () => listener.subscription.unsubscribe()
  }, [router])

  // ── Login ──────────────────────────────────────────────────────────────
  async function handleLogin(e) {
    e.preventDefault()
    if (!email || !password) { setError('Preencha e-mail e senha.'); return }
    setLoading(true)
    setError('')
    const { error: err } = await supabase.auth.signInWithPassword({ email, password })
    if (err) {
      setError(
        err.message === 'Invalid login credentials'
          ? 'Usuário ou senha incorretos.'
          : err.message
      )
      setLoading(false)
    }
    // sucesso → o listener onAuthStateChange cuida do redirect
  }

  // ── Enter nos campos ───────────────────────────────────────────────────
  function handleKeyEmail(e) { if (e.key === 'Enter') document.getElementById('lp').focus() }
  function handleKeyPass(e)  { if (e.key === 'Enter') handleLogin(e) }

  // ── Tela de verificação de sessão ─────────────────────────────────────
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
        <title>Vivanexa – Assistente Comercial</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <link
          href="https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=DM+Mono:wght@300;400;500&family=Inter:wght@300;400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </Head>

      <style>{globalCSS}</style>

      {/* Orbs decorativos */}
      <div className="orb orb1" />
      <div className="orb orb2" />

      {/* Tela de login */}
      <div className="login-screen">
        <div className="login-box">

          {/* Logo */}
          <div className="login-logo">
            <img src={LOGO_B64} alt="Vivanexa" onError={e => { e.target.style.display = 'none' }} />
          </div>

          {/* Título */}
          <div className="login-title" id="loginCompanyName">
            ASSISTENTE COMERCIAL
          </div>

          <form onSubmit={handleLogin} noValidate>
            {/* Campo e-mail */}
            <div className="login-field">
              <label htmlFor="le">E-MAIL</label>
              <input
                id="le"
                type="email"
                placeholder="seu@email.com"
                autoComplete="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                onKeyDown={handleKeyEmail}
              />
            </div>

            {/* Campo senha */}
            <div className="login-field">
              <label htmlFor="lp">SENHA</label>
              <input
                id="lp"
                type="password"
                placeholder="••••••••"
                autoComplete="current-password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                onKeyDown={handleKeyPass}
              />
            </div>

            {/* Mensagem de erro */}
            <div className="login-err">{error}</div>

            {/* Botão */}
            <button
              type="submit"
              className="login-btn"
              disabled={loading}
            >
              {loading ? 'Entrando...' : 'Entrar'}
            </button>
          </form>

          {/* Esqueci a senha */}
          <div style={{ textAlign: 'center', marginTop: '14px' }}>
            <button
              className="forgot-link"
              onClick={async () => {
                if (!email) { setError('Digite seu e-mail antes de continuar.'); return }
                setError('')
                const { error: err } = await supabase.auth.resetPasswordForEmail(email)
                if (err) setError(err.message)
                else setError('✅ Link de redefinição enviado para seu e-mail!')
              }}
            >
              Esqueci minha senha
            </button>
          </div>

          {/* Versão */}
          <div className="login-version">Vivanexa SaaS v1.0</div>
        </div>
      </div>
    </>
  )
}

// ── CSS Global ─────────────────────────────────────────────────────────────
const globalCSS = `
  /* ═══════════════════════════════════════
     THEME VARIABLES (dark – igual ao original)
  ═══════════════════════════════════════ */
  :root {
    --bg:          #0a0f1e;
    --surface:     #111827;
    --surface2:    #1a2540;
    --border:      #1e2d4a;
    --accent:      #00d4ff;
    --accent2:     #7c3aed;
    --accent3:     #10b981;
    --text:        #e2e8f0;
    --muted:       #64748b;
    --danger:      #ef4444;
    --shadow:      0 4px 24px rgba(0,0,0,.4);
  }

  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  html { font-size: 15px; }

  body {
    font-family: 'DM Mono', monospace;
    background: var(--bg);
    color: var(--text);
    min-height: 100vh;
    display: flex;
    flex-direction: column;
    align-items: center;
    overflow-x: hidden;
  }

  /* Grade de fundo */
  body::before {
    content: '';
    position: fixed;
    inset: 0;
    background-image:
      linear-gradient(rgba(0,212,255,.025) 1px, transparent 1px),
      linear-gradient(90deg, rgba(0,212,255,.025) 1px, transparent 1px);
    background-size: 40px 40px;
    pointer-events: none;
    z-index: 0;
  }

  /* ── Orbs ───────────────────────────────── */
  .orb {
    position: fixed;
    border-radius: 50%;
    filter: blur(120px);
    pointer-events: none;
    z-index: 0;
    opacity: .10;
  }
  .orb1 { width: 500px; height: 500px; background: var(--accent);  top: -200px; right: -150px; }
  .orb2 { width: 400px; height: 400px; background: var(--accent2); bottom: -150px; left: -100px; }

  /* ── Tela de Login ──────────────────────── */
  .login-screen {
    position: fixed;
    inset: 0;
    background: var(--bg);
    z-index: 9999;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 20px;
  }

  .login-box {
    position: relative;
    z-index: 1;
    width: 100%;
    max-width: 400px;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 20px;
    padding: 36px 32px;
    box-shadow: var(--shadow);
  }

  .login-logo {
    text-align: center;
    margin-bottom: 20px;
  }
  .login-logo img {
    height: 56px;
    object-fit: contain;
  }

  .login-title {
    font-family: 'Syne', sans-serif;
    font-size: 13px;
    font-weight: 700;
    color: var(--muted);
    text-align: center;
    letter-spacing: 2px;
    text-transform: uppercase;
    margin-bottom: 28px;
  }

  .login-field {
    margin-bottom: 14px;
  }
  .login-field label {
    font-size: 11px;
    color: var(--muted);
    display: block;
    margin-bottom: 5px;
    letter-spacing: .8px;
  }
  .login-field input {
    width: 100%;
    background: var(--surface2);
    border: 1px solid var(--border);
    border-radius: 10px;
    padding: 11px 14px;
    font-family: 'DM Mono', monospace;
    font-size: 14px;
    color: var(--text);
    outline: none;
    transition: border-color .2s, box-shadow .2s;
  }
  .login-field input:focus {
    border-color: var(--accent);
    box-shadow: 0 0 0 3px rgba(0,212,255,.1);
  }
  .login-field input::placeholder { color: var(--muted); }

  .login-btn {
    width: 100%;
    padding: 13px;
    border-radius: 10px;
    background: linear-gradient(135deg, var(--accent), #0099bb);
    border: none;
    color: #fff;
    font-family: 'DM Mono', monospace;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    letter-spacing: .5px;
    transition: all .2s;
    margin-top: 8px;
  }
  .login-btn:hover:not(:disabled) {
    box-shadow: 0 0 20px rgba(0,212,255,.4);
    transform: translateY(-1px);
  }
  .login-btn:disabled {
    opacity: .6;
    cursor: not-allowed;
  }

  .login-err {
    font-size: 12px;
    color: var(--danger);
    text-align: center;
    margin-top: 10px;
    min-height: 18px;
    line-height: 1.4;
    white-space: pre-wrap;
  }

  .forgot-link {
    background: none;
    border: none;
    color: var(--muted);
    font-family: 'DM Mono', monospace;
    font-size: 11px;
    cursor: pointer;
    letter-spacing: .3px;
    transition: color .2s;
    padding: 0;
  }
  .forgot-link:hover { color: var(--accent); }

  .login-version {
    font-size: 10px;
    color: #2a3a5a;
    text-align: center;
    margin-top: 20px;
    letter-spacing: .5px;
  }

  /* ── Spinner de verificação de sessão ──── */
  .spinner-wrap {
    position: fixed;
    inset: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 14px;
    background: var(--bg);
    z-index: 99999;
    font-family: 'DM Mono', monospace;
  }
  .spinner {
    width: 40px;
    height: 40px;
    border: 3px solid var(--border);
    border-top-color: var(--accent);
    border-radius: 50%;
    animation: spin .7s linear infinite;
  }
  .spinner-txt {
    color: var(--muted);
    font-size: 13px;
    letter-spacing: .5px;
  }
  @keyframes spin { to { transform: rotate(360deg); } }
`
