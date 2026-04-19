// components/Navbar.js — Vivanexa SaaS v9
// Novidades v9:
// • Clique no avatar/nome do usuário abre dropdown com "Editar Senha"
// • Modal de troca de senha inline (sem sair da página)

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/router'
import { supabase } from '../lib/supabase'

const MENU = [
  {
    id: 'comercial', label: 'Comercial', icon: '💼', color: '#00d4ff',
    subs: [
      { label: 'Chat / Assistente',  icon: '💬', href: '/chat' },
      { label: 'WhatsApp Inbox',     icon: '📱', href: '/whatsapp-inbox' },
      { label: 'CRM',                icon: '🤝', href: '/crm' },
      { label: 'Gerador de Leads',   icon: '🎯', href: '/gerador-leads' },
      { label: 'Disparo em Massa',   icon: '📣', href: '/prospeccao?aba=disparo' },
      { label: 'Chatbot',            icon: '🤖', href: '/prospeccao?aba=chatbot' },
      { label: 'Agente IA',          icon: '🧠', href: '/prospeccao?aba=agente' },
      { label: 'Script / Playbook',  icon: '📋', href: '/prospeccao?aba=script' },
    ],
  },
  {
    id: 'marketing', label: 'Marketing', icon: '📣', color: '#7c3aed',
    subs: [
      { label: 'Campanhas IA',         icon: '🎯', href: '/marketing?aba=campanhas' },
      { label: 'Agenda de Publicação', icon: '📅', href: '/marketing?aba=agenda' },
      { label: 'Geração de Conteúdo',  icon: '✨', href: '/marketing?aba=imagens' },
    ],
  },
  {
    id: 'financeiro', label: 'Financeiro', icon: '💰', color: '#10b981',
    subs: [
      { label: 'Contas a Receber', icon: '💵', href: '/financeiro?aba=contas' },
      { label: 'Contas a Pagar',   icon: '💸', href: '/financeiro?aba=contas' },
      { label: 'Nota Fiscal',      icon: '🧾', href: '/financeiro?aba=nfe' },
      { label: 'Pagamentos',       icon: '💳', href: '/financeiro?aba=pagamentos' },
      { label: 'Comissões',        icon: '🏆', href: '/financeiro?aba=comissoes' },
    ],
  },
  {
    id: 'relatorios', label: 'Relatórios', icon: '📈', color: '#ec4899',
    subs: [
      { label: 'Visão Estratégica',    icon: '🎯', href: '/reports?aba=estrategico',   grupo: 'Visão Geral' },
      { label: 'Vendas',               icon: '🛒', href: '/reports?aba=vendas',         grupo: 'Vendas' },
      { label: 'Produtos / Módulos',   icon: '📦', href: '/reports?aba=produtos',       grupo: 'Vendas' },
      { label: 'Comissões',            icon: '🏆', href: '/reports?aba=comissoes',      grupo: 'Vendas' },
      { label: 'KPIs da Equipe',       icon: '📊', href: '/reports?aba=kpis',           grupo: 'Equipe' },
      { label: 'Atividades CRM',       icon: '📅', href: '/reports?aba=crm_atividades', grupo: 'CRM' },
      { label: 'Negócios CRM',         icon: '🤝', href: '/reports?aba=crm_negocios',   grupo: 'CRM' },
      { label: 'Disparos em Massa',    icon: '📣', href: '/reports?aba=disparos',       grupo: 'Campanhas' },
      { label: 'Marketing',            icon: '📢', href: '/reports?aba=marketing',      grupo: 'Campanhas' },
      { label: 'Gerador de Relatório', icon: '🛠', href: '/reports?aba=gerador',        grupo: 'Ferramentas' },
    ],
  },
  {
    id: 'configuracoes', label: 'Config', icon: '⚙️', color: '#94a3b8',
    directHref: '/configuracoes?tab=empresa',
    subs: [],
  },
]

export { MENU }

export default function Navbar({ cfg = {}, perfil = null }) {
  const router = useRouter()
  const [open,          setOpen]          = useState(null)
  const [mobileOpen,    setMobileOpen]    = useState(false)
  const [user,          setUser]          = useState(perfil)
  const [userMenuOpen,  setUserMenuOpen]  = useState(false)
  const [showSenhaModal,setShowSenhaModal]= useState(false)
  const [novaSenha,     setNovaSenha]     = useState('')
  const [confirmSenha,  setConfirmSenha]  = useState('')
  const [senhaMsg,      setSenhaMsg]      = useState('')
  const [senhaSaving,   setSenhaSaving]   = useState(false)
  const navRef     = useRef(null)
  const userRef    = useRef(null)

  const [cfgLocal, setCfgLocal] = useState(cfg || {})

  useEffect(() => {
    if (perfil) { setUser(perfil); return }
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) return
      const { data: p } = await supabase
        .from('perfis').select('*').eq('user_id', session.user.id).maybeSingle()
      setUser(p)
    })
  }, [perfil])

  // Busca a logo do Supabase se não veio pela prop cfg
  useEffect(() => {
    if (cfg?.logob64) { setCfgLocal(cfg); return }
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) return
      let eid = null
      try {
        const su = sessionStorage.getItem('vx_subuser') || localStorage.getItem('vx_subuser')
        if (su) { eid = JSON.parse(su).empresaId }
      } catch {}
      if (!eid) {
        const { data: p } = await supabase.from('perfis').select('empresa_id').eq('user_id', session.user.id).maybeSingle()
        eid = p?.empresa_id || session.user.id
      }
      const { data: row } = await supabase.from('vx_storage').select('value').eq('key', `cfg:${eid}`).maybeSingle()
      if (row?.value) {
        try { setCfgLocal(JSON.parse(row.value)) } catch {}
      }
    })
  }, [cfg])

  useEffect(() => {
    const handler = (e) => {
      if (navRef.current && !navRef.current.contains(e.target)) {
        setOpen(null); setMobileOpen(false); setUserMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  useEffect(() => {
    setOpen(null); setMobileOpen(false); setUserMenuOpen(false)
  }, [router.pathname, router.query])

  function navigate(href) { setOpen(null); setMobileOpen(false); router.push(href) }

  function isActive(menu) {
    if (menu.directHref) return router.pathname === menu.directHref.split('?')[0]
    return menu.subs.some(s => router.pathname === s.href.split('?')[0])
  }

  async function handleLogout() {
    await supabase.auth.signOut()
    router.replace('/')
  }

  async function handleTrocarSenha() {
    setSenhaMsg('')
    if (!novaSenha || novaSenha.length < 6) { setSenhaMsg('❌ A senha deve ter ao menos 6 caracteres.'); return }
    if (novaSenha !== confirmSenha) { setSenhaMsg('❌ As senhas não coincidem.'); return }
    setSenhaSaving(true)
    const { error } = await supabase.auth.updateUser({ password: novaSenha })
    setSenhaSaving(false)
    if (error) { setSenhaMsg('❌ Erro: ' + error.message); return }
    setSenhaMsg('✅ Senha alterada com sucesso!')
    setNovaSenha(''); setConfirmSenha('')
    setTimeout(() => { setShowSenhaModal(false); setSenhaMsg('') }, 2000)
  }

  const logoSrc = cfgLocal.logob64
    ? (cfgLocal.logob64.startsWith('data:') ? cfgLocal.logob64 : `data:image/png;base64,${cfgLocal.logob64}`)
    : null

  return (
    <>
      <style>{CSS}</style>
      <nav className="nav" ref={navRef}>

        {/* ── Início ── */}
        <button className="nav-home" onClick={() => navigate('/dashboard')}>
          {logoSrc
            ? <img src={logoSrc} alt="logo" className="nav-logo-img" />
            : <span className="nav-logo-icon">🏠</span>
          }
          <span className="nav-home-label">Início</span>
        </button>

        <div className="nav-sep" />

        {/* ── Menus ── */}
        <div className="nav-menus">
          {MENU.map((menu) => {
            const ativo  = isActive(menu)
            const aberto = open === menu.id

            if (menu.directHref) {
              return (
                <div key={menu.id} className="nav-wrap">
                  <button
                    className={`nav-btn${ativo ? ' is-active' : ''}`}
                    style={ativo ? { color: menu.color } : {}}
                    onClick={() => navigate(menu.directHref)}
                  >
                    <span>{menu.icon}</span>
                    <span>{menu.label}</span>
                  </button>
                </div>
              )
            }

            const grupos = menu.subs.reduce((acc, sub) => {
              const g = sub.grupo || ''
              let grp = acc.find(x => x.titulo === g)
              if (!grp) { grp = { titulo: g, items: [] }; acc.push(grp) }
              grp.items.push(sub)
              return acc
            }, [])

            return (
              <div key={menu.id} className="nav-wrap">
                <button
                  className={`nav-btn${ativo ? ' is-active' : ''}${aberto ? ' is-open' : ''}`}
                  style={ativo || aberto ? { color: menu.color } : {}}
                  onClick={(e) => { e.stopPropagation(); setOpen(aberto ? null : menu.id) }}
                >
                  <span>{menu.icon}</span>
                  <span>{menu.label}</span>
                  <span className={`nav-arr${aberto ? ' up' : ''}`}>▾</span>
                </button>

                {aberto && (
                  <div className="nav-dd" style={{ '--c': menu.color }} onClick={e => e.stopPropagation()}>
                    <div className="nav-dd-title">
                      <span>{menu.icon}</span>
                      <span style={{ color: menu.color }}>{menu.label}</span>
                    </div>
                    {grupos.map((grupo, gi) => (
                      <div key={gi}>
                        {grupo.titulo && (
                          <div className="nav-dd-grupo" style={{ color: menu.color }}>
                            <span className="nav-dd-grupo-linha" />
                            <span className="nav-dd-grupo-label">{grupo.titulo}</span>
                            <span className="nav-dd-grupo-linha" />
                          </div>
                        )}
                        {grupo.items.map((sub) => {
                          const subAtivo = router.pathname === sub.href.split('?')[0] &&
                            (router.query.aba === sub.href.split('aba=')[1] || !sub.href.includes('aba='))
                          return (
                            <button
                              key={sub.href}
                              className={`nav-dd-btn${subAtivo ? ' sub-active' : ''}`}
                              style={subAtivo ? { color: menu.color, background: menu.color + '12' } : {}}
                              onClick={() => navigate(sub.href)}
                            >
                              <span className="nav-dd-icon">{sub.icon}</span>
                              <span className="nav-dd-lbl">{sub.label}</span>
                              {subAtivo && <span className="nav-dd-dot" style={{ background: menu.color }} />}
                            </button>
                          )
                        })}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {/* ── Direita — Avatar clicável ── */}
        <div className="nav-right">
          {user && (
            <div className="nav-user-wrap" ref={userRef} style={{ position: 'relative' }}>
              <button
                className="nav-user"
                onClick={(e) => { e.stopPropagation(); setUserMenuOpen(v => !v) }}
                title="Clique para opções de conta"
              >
                <div className="nav-av">{(user.nome || user.email || 'U')[0].toUpperCase()}</div>
                <div>
                  <div className="nav-uname">{(user.nome || user.email || '').split(' ')[0]}</div>
                  <div style={{ fontSize: 9, color: '#475569', lineHeight: 1 }}>{user.perfil || user.tipo || 'usuário'}</div>
                </div>
                <span style={{ fontSize: 9, color: '#475569', marginLeft: 2 }}>▾</span>
              </button>

              {userMenuOpen && (
                <div className="user-dd" onClick={e => e.stopPropagation()}>
                  <div className="user-dd-header">
                    <div className="user-dd-av">{(user.nome || user.email || 'U')[0].toUpperCase()}</div>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: '#e2e8f0' }}>{user.nome || 'Usuário'}</div>
                      <div style={{ fontSize: 11, color: '#64748b' }}>{user.email || ''}</div>
                    </div>
                  </div>
                  <div className="user-dd-sep" />
                  <button className="user-dd-btn" onClick={() => { setUserMenuOpen(false); setShowSenhaModal(true) }}>
                    🔑 Alterar Senha
                  </button>
                  <div className="user-dd-sep" />
                  <button className="user-dd-btn user-dd-sair" onClick={handleLogout}>
                    🚪 Sair
                  </button>
                </div>
              )}
            </div>
          )}
          {!user && (
            <button className="nav-sair" onClick={handleLogout}>Sair</button>
          )}
        </div>

        <button className="nav-mob-btn" onClick={() => setMobileOpen(!mobileOpen)}>
          {mobileOpen ? '✕' : '☰'}
        </button>
      </nav>

      {/* ── Mobile ── */}
      {mobileOpen && (
        <div className="mob">
          <button className="mob-inicio" onClick={() => navigate('/dashboard')}>
            🏠 Painel Principal
          </button>
          {MENU.map((menu) => (
            <div key={menu.id} className="mob-grupo">
              <div className="mob-titulo" style={{ color: menu.color }}>
                {menu.icon} {menu.label}
              </div>
              <div className="mob-itens">
                {menu.directHref ? (
                  <button className="mob-btn" onClick={() => navigate(menu.directHref)}>
                    <span className="mob-ic">⚙️</span> Abrir Configurações
                  </button>
                ) : menu.subs.map((sub) => (
                  <button key={sub.href} className="mob-btn" onClick={() => navigate(sub.href)}>
                    <span className="mob-ic">{sub.icon}</span>
                    {sub.label}
                  </button>
                ))}
              </div>
            </div>
          ))}
          <div className="mob-rodape">
            <span style={{ color: '#64748b', fontSize: 12 }}>👤 {user?.nome || user?.email}</span>
            <button className="mob-btn-senha" onClick={() => { setMobileOpen(false); setShowSenhaModal(true) }}>🔑 Alterar Senha</button>
            <button className="nav-sair" onClick={handleLogout}>Sair</button>
          </div>
        </div>
      )}

      {/* ── Modal Alterar Senha ── */}
      {showSenhaModal && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,.8)', zIndex: 99999,
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20
        }} onClick={() => setShowSenhaModal(false)}>
          <div style={{
            background: '#111827', border: '1px solid #1e2d4a', borderRadius: 16,
            padding: 32, width: '100%', maxWidth: 400, boxShadow: '0 24px 64px rgba(0,0,0,.8)'
          }} onClick={e => e.stopPropagation()}>
            <div style={{ fontFamily: 'Syne, sans-serif', fontSize: 18, fontWeight: 800, color: '#00d4ff', marginBottom: 6 }}>🔑 Alterar Senha</div>
            <div style={{ fontSize: 12, color: '#64748b', marginBottom: 24 }}>
              Usuário: <strong style={{ color: '#e2e8f0' }}>{user?.email}</strong>
            </div>

            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 11, color: '#64748b', display: 'block', marginBottom: 5, letterSpacing: '.8px', textTransform: 'uppercase' }}>Nova Senha</label>
              <input
                type="password"
                value={novaSenha}
                onChange={e => setNovaSenha(e.target.value)}
                placeholder="Mínimo 6 caracteres"
                style={{ width: '100%', background: '#1a2540', border: '1px solid #1e2d4a', borderRadius: 10, padding: '11px 14px', fontFamily: 'DM Mono, monospace', fontSize: 14, color: '#e2e8f0', outline: 'none', boxSizing: 'border-box' }}
                onFocus={e => e.target.style.borderColor = '#00d4ff'}
                onBlur={e => e.target.style.borderColor = '#1e2d4a'}
              />
            </div>

            <div style={{ marginBottom: 20 }}>
              <label style={{ fontSize: 11, color: '#64748b', display: 'block', marginBottom: 5, letterSpacing: '.8px', textTransform: 'uppercase' }}>Confirmar Nova Senha</label>
              <input
                type="password"
                value={confirmSenha}
                onChange={e => setConfirmSenha(e.target.value)}
                placeholder="Repita a nova senha"
                style={{ width: '100%', background: '#1a2540', border: '1px solid #1e2d4a', borderRadius: 10, padding: '11px 14px', fontFamily: 'DM Mono, monospace', fontSize: 14, color: '#e2e8f0', outline: 'none', boxSizing: 'border-box' }}
                onFocus={e => e.target.style.borderColor = '#00d4ff'}
                onBlur={e => e.target.style.borderColor = '#1e2d4a'}
                onKeyDown={e => e.key === 'Enter' && handleTrocarSenha()}
              />
            </div>

            {senhaMsg && (
              <div style={{
                padding: '10px 14px', borderRadius: 8, fontSize: 13, marginBottom: 16,
                background: senhaMsg.startsWith('✅') ? 'rgba(16,185,129,.12)' : 'rgba(239,68,68,.12)',
                border: `1px solid ${senhaMsg.startsWith('✅') ? 'rgba(16,185,129,.3)' : 'rgba(239,68,68,.3)'}`,
                color: senhaMsg.startsWith('✅') ? '#10b981' : '#ef4444'
              }}>{senhaMsg}</div>
            )}

            <div style={{ display: 'flex', gap: 10 }}>
              <button
                onClick={() => { setShowSenhaModal(false); setSenhaMsg(''); setNovaSenha(''); setConfirmSenha('') }}
                style={{ flex: 1, padding: '12px', borderRadius: 10, background: 'rgba(100,116,139,.12)', border: '1px solid #1e2d4a', color: '#64748b', fontFamily: 'DM Mono, monospace', fontSize: 13, cursor: 'pointer' }}
              >Cancelar</button>
              <button
                onClick={handleTrocarSenha}
                disabled={senhaSaving}
                style={{ flex: 2, padding: '12px', borderRadius: 10, background: 'linear-gradient(135deg,#00d4ff,#0099bb)', border: 'none', color: '#fff', fontFamily: 'DM Mono, monospace', fontSize: 13, fontWeight: 700, cursor: senhaSaving ? 'not-allowed' : 'pointer', opacity: senhaSaving ? .7 : 1 }}
              >{senhaSaving ? '⏳ Salvando...' : '✅ Salvar Nova Senha'}</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

const CSS = `
  .nav{position:sticky;top:0;z-index:9000;overflow:visible;background:rgba(8,13,26,.98);backdrop-filter:blur(18px);border-bottom:1px solid #18243a;display:flex;align-items:center;height:52px;padding:0 14px;gap:2px;font-family:'DM Mono',monospace}
  .nav-home{display:flex;align-items:center;gap:7px;padding:5px 12px;background:rgba(0,212,255,.1);border:1px solid rgba(0,212,255,.28);border-radius:8px;color:#00d4ff;font-family:'DM Mono',monospace;font-size:11.5px;font-weight:600;cursor:pointer;transition:all .15s;flex-shrink:0;white-space:nowrap}
  .nav-home:hover{background:rgba(0,212,255,.2);box-shadow:0 0 16px rgba(0,212,255,.18)}
  .nav-logo-img{height:22px;object-fit:contain;border-radius:4px}
  .nav-logo-icon{font-size:15px}
  .nav-home-label{font-size:11.5px}
  .nav-sep{width:1px;height:24px;background:#18243a;margin:0 8px;flex-shrink:0}
  .nav-menus{display:flex;align-items:center;gap:1px;flex:1;overflow:visible}
  .nav-wrap{position:relative;overflow:visible}
  .nav-btn{display:flex;align-items:center;gap:5px;padding:6px 9px;background:none;border:none;border-radius:7px;color:#6e8099;font-family:'DM Mono',monospace;font-size:11.5px;cursor:pointer;white-space:nowrap;transition:all .14s}
  .nav-btn:hover{background:rgba(255,255,255,.05);color:#c8d6e5}
  .nav-btn.is-active,.nav-btn.is-open{font-weight:600}
  .nav-arr{font-size:9px;opacity:.55;transition:transform .18s;margin-left:1px}
  .nav-arr.up{transform:rotate(180deg)}
  .nav-dd{position:absolute;top:calc(100% + 7px);left:0;min-width:230px;background:#08101e;border:1px solid #18243a;border-top:2px solid var(--c,#00d4ff);border-radius:12px;overflow:hidden;box-shadow:0 24px 64px rgba(0,0,0,.85);z-index:99999;pointer-events:all;animation:ddIn .13s ease}
  @keyframes ddIn{from{opacity:0;transform:translateY(-5px)}to{opacity:1;transform:translateY(0)}}
  .nav-dd-title{display:flex;align-items:center;gap:8px;padding:11px 13px 10px;border-bottom:1px solid #18243a;background:rgba(255,255,255,.025);font-family:'Syne',sans-serif;font-size:11px;font-weight:700;letter-spacing:1px;text-transform:uppercase}
  .nav-dd-grupo{display:flex;align-items:center;gap:7px;padding:8px 11px 4px;font-family:'Syne',sans-serif;font-size:9.5px;font-weight:700;letter-spacing:1.2px;text-transform:uppercase;opacity:.8}
  .nav-dd-grupo-linha{flex:1;height:1px;background:currentColor;opacity:.2}
  .nav-dd-grupo-label{white-space:nowrap;flex-shrink:0}
  .nav-dd-btn{display:flex;align-items:center;gap:9px;width:calc(100% - 10px);padding:8px 11px;background:none;border:none;border-radius:8px;color:#6e8099;font-family:'DM Mono',monospace;font-size:12px;cursor:pointer;text-align:left;transition:all .1s;position:relative;margin:2px 5px}
  .nav-dd-btn:hover{background:rgba(255,255,255,.06);color:#e2e8f0}
  .nav-dd-btn.sub-active{font-weight:600}
  .nav-dd-icon{font-size:14px;width:18px;text-align:center;flex-shrink:0}
  .nav-dd-lbl{flex:1}
  .nav-dd-dot{width:6px;height:6px;border-radius:50%;flex-shrink:0}

  /* ── User dropdown ── */
  .nav-right{display:flex;align-items:center;gap:10px;flex-shrink:0;margin-left:6px}
  .nav-user-wrap{position:relative}
  .nav-user{display:flex;align-items:center;gap:8px;background:none;border:none;cursor:pointer;padding:4px 8px;border-radius:8px;transition:background .15s}
  .nav-user:hover{background:rgba(255,255,255,.05)}
  .nav-av{width:28px;height:28px;border-radius:50%;background:linear-gradient(135deg,#00d4ff,#0088aa);display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;color:#fff;flex-shrink:0}
  .nav-uname{font-size:11px;color:#6e8099;white-space:nowrap;line-height:1.2}
  .user-dd{position:absolute;top:calc(100% + 8px);right:0;min-width:220px;background:#08101e;border:1px solid #18243a;border-top:2px solid #00d4ff;border-radius:12px;overflow:hidden;box-shadow:0 24px 64px rgba(0,0,0,.85);z-index:99999;animation:ddIn .13s ease}
  .user-dd-header{display:flex;align-items:center;gap:10px;padding:14px;background:rgba(0,212,255,.04);border-bottom:1px solid #18243a}
  .user-dd-av{width:36px;height:36px;border-radius:50%;background:linear-gradient(135deg,#00d4ff,#0088aa);display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:700;color:#fff;flex-shrink:0}
  .user-dd-sep{height:1px;background:#18243a;margin:4px 0}
  .user-dd-btn{display:flex;align-items:center;gap:9px;width:100%;padding:10px 14px;background:none;border:none;color:#94a3b8;font-family:'DM Mono',monospace;font-size:12px;cursor:pointer;text-align:left;transition:all .12s}
  .user-dd-btn:hover{background:rgba(255,255,255,.05);color:#e2e8f0}
  .user-dd-sair{color:#ef4444!important}
  .user-dd-sair:hover{background:rgba(239,68,68,.08)!important}

  .nav-sair{padding:4px 11px;background:rgba(239,68,68,.1);border:1px solid rgba(239,68,68,.22);border-radius:7px;color:#ef4444;font-family:'DM Mono',monospace;font-size:11px;cursor:pointer;transition:all .14s;white-space:nowrap}
  .nav-sair:hover{background:rgba(239,68,68,.2)}
  .nav-mob-btn{display:none;background:none;border:1px solid #18243a;color:#6e8099;padding:6px 11px;border-radius:7px;cursor:pointer;font-size:16px;margin-left:auto}
  .mob{position:fixed;top:52px;left:0;right:0;bottom:0;background:rgba(8,13,26,.99);z-index:999;overflow-y:auto;padding:14px}
  .mob-inicio{display:block;width:100%;padding:12px 16px;margin-bottom:14px;background:rgba(0,212,255,.1);border:1px solid rgba(0,212,255,.25);border-radius:10px;color:#00d4ff;font-family:'DM Mono',monospace;font-size:13px;font-weight:600;cursor:pointer;text-align:left}
  .mob-grupo{margin-bottom:7px;border:1px solid #18243a;border-radius:10px;overflow:hidden}
  .mob-titulo{padding:10px 14px;font-family:'Syne',sans-serif;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;background:rgba(255,255,255,.02);border-bottom:1px solid #18243a}
  .mob-itens{padding:4px}
  .mob-btn{display:flex;align-items:center;gap:10px;width:100%;padding:10px 12px;background:none;border:none;border-radius:8px;color:#6e8099;font-family:'DM Mono',monospace;font-size:13px;cursor:pointer;text-align:left;transition:all .12s}
  .mob-btn:hover{background:rgba(255,255,255,.05);color:#e2e8f0}
  .mob-btn-senha{display:flex;align-items:center;gap:8px;padding:8px 14px;background:rgba(0,212,255,.08);border:1px solid rgba(0,212,255,.2);border-radius:8px;color:#00d4ff;font-family:'DM Mono',monospace;font-size:12px;cursor:pointer}
  .mob-ic{font-size:15px;width:20px;text-align:center;flex-shrink:0}
  .mob-rodape{display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;padding:14px 4px 4px;margin-top:8px;border-top:1px solid #18243a}
  @media(max-width:768px){.nav-menus{display:none}.nav-right{display:none}.nav-mob-btn{display:block}}
`
