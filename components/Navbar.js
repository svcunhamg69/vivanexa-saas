// components/Navbar.js — Vivanexa SaaS v4
// ✅ Submenus agrupados DENTRO do menu pai (não soltos)
// ✅ Botão 🏠 Início sempre visível — volta ao dashboard de qualquer página
// ✅ Presente em TODAS as páginas: chat, crm, fiscal, financeiro, etc.

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/router'
import { supabase } from '../lib/supabase'

const MENU = [
  {
    id: 'comercial',
    label: 'Comercial',
    icon: '💼',
    color: '#00d4ff',
    subs: [
      { label: 'Chat / Assistente',  icon: '💬', href: '/chat' },
      { label: 'CRM',                icon: '🤝', href: '/crm' },
      { label: 'Disparo em Massa',   icon: '📣', href: '/prospeccao?aba=disparo' },
      { label: 'Chatbot',            icon: '🤖', href: '/prospeccao?aba=chatbot' },
      { label: 'Agente IA',          icon: '🧠', href: '/prospeccao?aba=agente' },
      { label: 'Script / Playbook',  icon: '📋', href: '/prospeccao?aba=script' },
    ],
  },
  {
    id: 'marketing',
    label: 'Marketing',
    icon: '📣',
    color: '#7c3aed',
    subs: [
      { label: 'Campanhas IA',         icon: '🎯', href: '/marketing?aba=campanhas' },
      { label: 'Geração de Imagens',   icon: '🖼️', href: '/marketing?aba=imagens' },
      { label: 'Agenda de Publicação', icon: '📅', href: '/marketing?aba=agenda' },
      { label: 'Script / Playbook',    icon: '📝', href: '/marketing?aba=script' },
    ],
  },
  {
    id: 'financeiro',
    label: 'Financeiro',
    icon: '💰',
    color: '#10b981',
    subs: [
      { label: 'Contas a Receber', icon: '💵', href: '/financeiro?aba=receber' },
      { label: 'Contas a Pagar',   icon: '💸', href: '/financeiro?aba=pagar' },
      { label: 'Boleto / PIX',     icon: '🏦', href: '/financeiro?aba=boleto' },
      { label: 'Cartão',           icon: '💳', href: '/financeiro?aba=cartao' },
      { label: 'Comissões',        icon: '🏆', href: '/financeiro?aba=comissoes' },
    ],
  },
  {
    id: 'fiscal',
    label: 'Fiscal',
    icon: '📄',
    color: '#f59e0b',
    subs: [
      { label: 'NF de Produto',    icon: '📦', href: '/fiscal?aba=produto' },
      { label: 'NF de Serviço',    icon: '🛠️', href: '/fiscal?aba=servico' },
      { label: 'NF do Consumidor', icon: '🧾', href: '/fiscal?aba=consumidor' },
    ],
  },
  {
    id: 'produtividade',
    label: 'Produtividade',
    icon: '⚡',
    color: '#06b6d4',
    subs: [
      { label: 'Captura de Notas',     icon: '📥', href: '/produtividade?aba=notas' },
      { label: 'Tarefas e Obrigações', icon: '✅', href: '/produtividade?aba=tarefas' },
      { label: 'Monitoramento e-CAC',  icon: '🔍', href: '/produtividade?aba=ecac' },
      { label: 'Consulta Tributária',  icon: '📊', href: '/produtividade?aba=tributaria' },
      { label: 'Gestão MEI',           icon: '🏪', href: '/produtividade?aba=mei' },
      { label: 'Simples Nacional',     icon: '📈', href: '/produtividade?aba=simples' },
    ],
  },
  {
    id: 'relatorios',
    label: 'Relatórios',
    icon: '📈',
    color: '#ec4899',
    subs: [
      { label: 'Visão Estratégica', icon: '🎯', href: '/reports?aba=estrategico' },
      { label: 'Financeiro',        icon: '💰', href: '/reports?aba=financeiro' },
      { label: 'KPIs da Equipe',    icon: '📊', href: '/reports?aba=kpis' },
      { label: 'Vendas',            icon: '🛒', href: '/reports?aba=vendas' },
      { label: 'Produtos',          icon: '📦', href: '/reports?aba=produtos' },
      { label: 'Comercial',         icon: '💼', href: '/reports?aba=comercial' },
      { label: 'Fiscal',            icon: '📄', href: '/reports?aba=fiscal' },
    ],
  },
  {
    id: 'configuracoes',
    label: 'Config',
    icon: '⚙️',
    color: '#94a3b8',
    subs: [
      { label: 'Empresa',     icon: '🏢', href: '/configuracoes?tab=empresa' },
      { label: 'Metas',       icon: '🎯', href: '/configuracoes?tab=metas' },
      { label: 'KPIs',        icon: '📊', href: '/configuracoes?tab=kpis' },
      { label: 'Usuários',    icon: '👥', href: '/configuracoes?tab=usuarios' },
      { label: 'Produtos',    icon: '📦', href: '/configuracoes?tab=produtos' },
      { label: 'Descontos',   icon: '🏷️', href: '/configuracoes?tab=descontos' },
      { label: 'Integrações', icon: '🔗', href: '/configuracoes?tab=integracoes' },
    ],
  },
]

export { MENU }

export default function Navbar({ cfg = {}, perfil = null }) {
  const router = useRouter()
  const [open, setOpen] = useState(null)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [user, setUser] = useState(perfil)
  const navRef = useRef(null)

  useEffect(() => {
    if (perfil) { setUser(perfil); return }
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) return
      const { data: p } = await supabase
        .from('perfis').select('*').eq('user_id', session.user.id).maybeSingle()
      setUser(p)
    })
  }, [perfil])

  useEffect(() => {
    const handler = (e) => {
      if (navRef.current && !navRef.current.contains(e.target)) {
        setOpen(null)
        setMobileOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  useEffect(() => {
    setOpen(null)
    setMobileOpen(false)
  }, [router.pathname, router.query])

  function navigate(href) {
    setOpen(null)
    setMobileOpen(false)
    router.push(href)
  }

  function isActive(menu) {
    return menu.subs.some(s => router.pathname === s.href.split('?')[0])
  }

  async function handleLogout() {
    await supabase.auth.signOut()
    router.replace('/')
  }

  const logoSrc = cfg.logob64
    ? (cfg.logob64.startsWith('data:') ? cfg.logob64 : `data:image/png;base64,${cfg.logob64}`)
    : null

  return (
    <>
      <style>{CSS}</style>

      <nav className="nav" ref={navRef}>

        {/* ── Botão Início ── */}
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
            return (
              <div key={menu.id} className="nav-wrap">

                {/* Botão pai */}
                <button
                  className={`nav-btn${ativo ? ' is-active' : ''}${aberto ? ' is-open' : ''}`}
                  style={(ativo || aberto) ? { color: menu.color, background: menu.color + '16' } : {}}
                  onClick={(e) => { e.stopPropagation(); setOpen(aberto ? null : menu.id); }}
                >
                  <span>{menu.icon}</span>
                  <span>{menu.label}</span>
                  <span className={`nav-arr${aberto ? ' up' : ''}`}>▾</span>
                </button>

                {/* ── Dropdown ── */}
                {aberto && (
                  <div className="nav-dd" style={{ '--c': menu.color }} onClick={e => e.stopPropagation()}>

                    {/* Título do grupo */}
                    <div className="nav-dd-title">
                      <span>{menu.icon}</span>
                      <span style={{ color: menu.color }}>{menu.label}</span>
                    </div>

                    {/* Submenus do grupo */}
                    {menu.subs.map((sub) => {
                      const subAtivo = router.pathname === sub.href.split('?')[0]
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
                )}
              </div>
            )
          })}
        </div>

        {/* ── Direita ── */}
        <div className="nav-right">
          {user && (
            <div className="nav-user">
              <div className="nav-av">
                {(user.nome || user.email || 'U')[0].toUpperCase()}
              </div>
              <span className="nav-uname">
                {(user.nome || user.email || '').split(' ')[0]}
              </span>
            </div>
          )}
          <button className="nav-sair" onClick={handleLogout}>Sair</button>
        </div>

        <button className="nav-mob-btn" onClick={() => setMobileOpen(!mobileOpen)}>
          {mobileOpen ? '✕' : '☰'}
        </button>
      </nav>

      {/* ── Menu Mobile ── */}
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
                {menu.subs.map((sub) => (
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
            <button className="nav-sair" onClick={handleLogout}>Sair</button>
          </div>
        </div>
      )}
    </>
  )
}

const CSS = `
  .nav{position:sticky;top:0;z-index:9000;overflow:visible;background:rgba(8,13,26,.98);backdrop-filter:blur(18px);border-bottom:1px solid #18243a;display:flex;align-items:center;height:52px;padding:0 14px;gap:2px;font-family:'DM Mono',monospace}

  /* Botão Início */
  .nav-home{display:flex;align-items:center;gap:7px;padding:5px 12px;background:rgba(0,212,255,.1);border:1px solid rgba(0,212,255,.28);border-radius:8px;color:#00d4ff;font-family:'DM Mono',monospace;font-size:11.5px;font-weight:600;cursor:pointer;transition:all .15s;flex-shrink:0;white-space:nowrap}
  .nav-home:hover{background:rgba(0,212,255,.2);box-shadow:0 0 16px rgba(0,212,255,.18)}
  .nav-logo-img{height:22px;object-fit:contain;border-radius:4px}
  .nav-logo-icon{font-size:15px}
  .nav-home-label{font-size:11.5px}

  /* Separador */
  .nav-sep{width:1px;height:24px;background:#18243a;margin:0 8px;flex-shrink:0}

  /* Área de menus */
  .nav-menus{display:flex;align-items:center;gap:1px;flex:1;overflow:visible;}
  
  .nav-wrap{position:relative;overflow:visible}

  /* Botão do menu pai */
  .nav-btn{display:flex;align-items:center;gap:5px;padding:6px 9px;background:none;border:none;border-radius:7px;color:#6e8099;font-family:'DM Mono',monospace;font-size:11.5px;cursor:pointer;white-space:nowrap;transition:all .14s}
  .nav-btn:hover{background:rgba(255,255,255,.05);color:#c8d6e5}
  .nav-btn.is-active,.nav-btn.is-open{font-weight:600}
  .nav-arr{font-size:9px;opacity:.55;transition:transform .18s;margin-left:1px}
  .nav-arr.up{transform:rotate(180deg)}

  /* Dropdown */
  .nav-dd{position:absolute;top:calc(100% + 7px);left:0;min-width:224px;background:#08101e;border:1px solid #18243a;border-top:2px solid var(--c,#00d4ff);border-radius:12px;overflow:hidden;box-shadow:0 24px 64px rgba(0,0,0,.85);z-index:99999;pointer-events:all;animation:ddIn .13s ease}
  @keyframes ddIn{from{opacity:0;transform:translateY(-5px)}to{opacity:1;transform:translateY(0)}}

  /* Título do grupo no dropdown */
  .nav-dd-title{display:flex;align-items:center;gap:8px;padding:11px 13px 10px;border-bottom:1px solid #18243a;background:rgba(255,255,255,.025);font-family:'Syne',sans-serif;font-size:11px;font-weight:700;letter-spacing:1px;text-transform:uppercase}

  /* Botão de submenu */
  .nav-dd-btn{display:flex;align-items:center;gap:9px;width:100%;padding:9px 11px;background:none;border:none;border-radius:8px;color:#6e8099;font-family:'DM Mono',monospace;font-size:12px;cursor:pointer;text-align:left;transition:all .1s;position:relative;margin:2px 5px;width:calc(100% - 10px)}
  .nav-dd-btn:hover{background:rgba(255,255,255,.06);color:#e2e8f0}
  .nav-dd-btn.sub-active{font-weight:600}
  .nav-dd-icon{font-size:14px;width:18px;text-align:center;flex-shrink:0}
  .nav-dd-lbl{flex:1}
  .nav-dd-dot{width:6px;height:6px;border-radius:50%;flex-shrink:0}

  /* Lado direito */
  .nav-right{display:flex;align-items:center;gap:10px;flex-shrink:0;margin-left:6px}
  .nav-user{display:flex;align-items:center;gap:8px}
  .nav-av{width:28px;height:28px;border-radius:50%;background:linear-gradient(135deg,#00d4ff,#0088aa);display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;color:#fff;flex-shrink:0}
  .nav-uname{font-size:11px;color:#6e8099;white-space:nowrap}
  .nav-sair{padding:4px 11px;background:rgba(239,68,68,.1);border:1px solid rgba(239,68,68,.22);border-radius:7px;color:#ef4444;font-family:'DM Mono',monospace;font-size:11px;cursor:pointer;transition:all .14s;white-space:nowrap}
  .nav-sair:hover{background:rgba(239,68,68,.2)}
  .nav-mob-btn{display:none;background:none;border:1px solid #18243a;color:#6e8099;padding:6px 11px;border-radius:7px;cursor:pointer;font-size:16px;margin-left:auto}

  /* Mobile */
  .mob{position:fixed;top:52px;left:0;right:0;bottom:0;background:rgba(8,13,26,.99);z-index:999;overflow-y:auto;padding:14px}
  .mob-inicio{display:block;width:100%;padding:12px 16px;margin-bottom:14px;background:rgba(0,212,255,.1);border:1px solid rgba(0,212,255,.25);border-radius:10px;color:#00d4ff;font-family:'DM Mono',monospace;font-size:13px;font-weight:600;cursor:pointer;text-align:left}
  .mob-grupo{margin-bottom:7px;border:1px solid #18243a;border-radius:10px;overflow:hidden}
  .mob-titulo{padding:10px 14px;font-family:'Syne',sans-serif;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;background:rgba(255,255,255,.02);border-bottom:1px solid #18243a}
  .mob-itens{padding:4px}
  .mob-btn{display:flex;align-items:center;gap:10px;width:100%;padding:10px 12px;background:none;border:none;border-radius:8px;color:#6e8099;font-family:'DM Mono',monospace;font-size:13px;cursor:pointer;text-align:left;transition:all .12s}
  .mob-btn:hover{background:rgba(255,255,255,.05);color:#e2e8f0}
  .mob-ic{font-size:15px;width:20px;text-align:center;flex-shrink:0}
  .mob-rodape{display:flex;align-items:center;justify-content:space-between;padding:14px 4px 4px;margin-top:8px;border-top:1px solid #18243a}

  @media(max-width:768px){.nav-menus{display:none}.nav-right{display:none}.nav-mob-btn{display:block}}
`
