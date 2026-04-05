// components/Navbar.js — Vivanexa SaaS v4.1
// ✅ Fix: dropdown z-index e pointer-events corrigidos
// ✅ Submenus agrupados DENTRO do menu pai
// ✅ Botão 🏠 Início sempre visível
// ✅ Funciona em TODAS as páginas

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

  // ✅ FIX: fecha ao clicar fora
  useEffect(() => {
    function handler(e) {
      if (navRef.current && !navRef.current.contains(e.target)) {
        setOpen(null)
        setMobileOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  // ✅ fecha ao trocar de página
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

      <nav className="vx-nav" ref={navRef}>

        {/* ── Botão Início ── */}
        <button className="vx-home" onClick={() => navigate('/dashboard')}>
          {logoSrc
            ? <img src={logoSrc} alt="logo" className="vx-logo-img" />
            : <span>🏠</span>
          }
          <span className="vx-home-label">Início</span>
        </button>

        <div className="vx-sep" />

        {/* ── Menus desktop ── */}
        <div className="vx-menus">
          {MENU.map((menu) => {
            const ativo  = isActive(menu)
            const aberto = open === menu.id
            return (
              <div key={menu.id} className="vx-wrap">

                {/* Botão pai */}
                <button
                  className={`vx-btn${ativo ? ' is-active' : ''}${aberto ? ' is-open' : ''}`}
                  style={(ativo || aberto) ? { color: menu.color, background: menu.color + '18' } : {}}
                  onClick={(e) => {
                    e.stopPropagation()
                    setOpen(aberto ? null : menu.id)
                  }}
                >
                  <span>{menu.icon}</span>
                  <span>{menu.label}</span>
                  <span className={`vx-arr${aberto ? ' up' : ''}`}>▾</span>
                </button>

                {/* ── Dropdown ── */}
                {aberto && (
                  <div
                    className="vx-dd"
                    style={{ '--c': menu.color }}
                    onClick={e => e.stopPropagation()}
                  >
                    {/* Título do grupo */}
                    <div className="vx-dd-title">
                      <span>{menu.icon}</span>
                      <span style={{ color: menu.color }}>{menu.label}</span>
                    </div>

                    {/* Submenus */}
                    {menu.subs.map((sub) => {
                      const subAtivo = router.pathname === sub.href.split('?')[0]
                      return (
                        <button
                          key={sub.href}
                          className={`vx-dd-btn${subAtivo ? ' sub-active' : ''}`}
                          style={subAtivo ? { color: menu.color, background: menu.color + '14' } : {}}
                          onClick={() => navigate(sub.href)}
                        >
                          <span className="vx-dd-icon">{sub.icon}</span>
                          <span className="vx-dd-lbl">{sub.label}</span>
                          {subAtivo && <span className="vx-dd-dot" style={{ background: menu.color }} />}
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
        <div className="vx-right">
          {user && (
            <div className="vx-user">
              <div className="vx-av">
                {(user.nome || user.email || 'U')[0].toUpperCase()}
              </div>
              <span className="vx-uname">
                {(user.nome || user.email || '').split(' ')[0]}
              </span>
            </div>
          )}
          <button className="vx-sair" onClick={handleLogout}>Sair</button>
        </div>

        {/* ── Hamburguer mobile ── */}
        <button className="vx-mob-btn" onClick={() => setMobileOpen(!mobileOpen)}>
          {mobileOpen ? '✕' : '☰'}
        </button>
      </nav>

      {/* ── Menu Mobile ── */}
      {mobileOpen && (
        <div className="vx-mob">
          <button className="vx-mob-inicio" onClick={() => navigate('/dashboard')}>
            🏠 Painel Principal
          </button>

          {MENU.map((menu) => (
            <div key={menu.id} className="vx-mob-grupo">
              <div className="vx-mob-titulo" style={{ color: menu.color }}>
                {menu.icon} {menu.label}
              </div>
              <div className="vx-mob-itens">
                {menu.subs.map((sub) => (
                  <button key={sub.href} className="vx-mob-btn-item" onClick={() => navigate(sub.href)}>
                    <span className="vx-mob-ic">{sub.icon}</span>
                    {sub.label}
                  </button>
                ))}
              </div>
            </div>
          ))}

          <div className="vx-mob-rodape">
            <span style={{ color: '#64748b', fontSize: 12 }}>👤 {user?.nome || user?.email}</span>
            <button className="vx-sair" onClick={handleLogout}>Sair</button>
          </div>
        </div>
      )}
    </>
  )
}

const CSS = `
  /* ── Navbar base ── */
  .vx-nav {
    position: sticky; top: 0; z-index: 9000;
    background: rgba(8,13,26,.98); backdrop-filter: blur(18px);
    border-bottom: 1px solid #18243a;
    display: flex; align-items: center; height: 52px; padding: 0 14px; gap: 2px;
    font-family: 'DM Mono', monospace;
  }

  /* ── Botão Início ── */
  .vx-home {
    display: flex; align-items: center; gap: 7px;
    padding: 5px 12px;
    background: rgba(0,212,255,.1); border: 1px solid rgba(0,212,255,.28);
    border-radius: 8px; color: #00d4ff;
    font-family: 'DM Mono', monospace; font-size: 11.5px; font-weight: 600;
    cursor: pointer; transition: all .15s; flex-shrink: 0; white-space: nowrap;
  }
  .vx-home:hover { background: rgba(0,212,255,.2); box-shadow: 0 0 16px rgba(0,212,255,.18); }
  .vx-logo-img { height: 22px; object-fit: contain; border-radius: 4px; }
  .vx-home-label { font-size: 11.5px; }

  /* ── Separador ── */
  .vx-sep { width: 1px; height: 24px; background: #18243a; margin: 0 8px; flex-shrink: 0; }

  /* ── Área de menus ── */
  .vx-menus {
    display: flex; align-items: center; gap: 1px;
    flex: 1; overflow-x: auto; scrollbar-width: none;
  }
  .vx-menus::-webkit-scrollbar { display: none; }

  /* ✅ FIX CRÍTICO: position relative no wrap para o dropdown aparecer */
  .vx-wrap { position: relative; }

  /* ── Botão do menu pai ── */
  .vx-btn {
    display: flex; align-items: center; gap: 5px; padding: 6px 9px;
    background: none; border: none; border-radius: 7px;
    color: #6e8099; font-family: 'DM Mono', monospace; font-size: 11.5px;
    cursor: pointer; white-space: nowrap; transition: all .14s;
  }
  .vx-btn:hover { background: rgba(255,255,255,.05); color: #c8d6e5; }
  .vx-btn.is-active, .vx-btn.is-open { font-weight: 600; }
  .vx-arr { font-size: 9px; opacity: .55; transition: transform .18s; margin-left: 1px; display: inline-block; }
  .vx-arr.up { transform: rotate(180deg); }

  /* ✅ FIX CRÍTICO: z-index alto + pointer-events no dropdown */
  .vx-dd {
    position: absolute;
    top: calc(100% + 7px);
    left: 0;
    min-width: 224px;
    background: #08101e;
    border: 1px solid #18243a;
    border-top: 2px solid var(--c, #00d4ff);
    border-radius: 12px;
    overflow: hidden;
    box-shadow: 0 24px 64px rgba(0,0,0,.85);
    z-index: 99999;
    pointer-events: all;
    animation: vxDdIn .13s ease;
  }
  @keyframes vxDdIn {
    from { opacity: 0; transform: translateY(-5px); }
    to   { opacity: 1; transform: translateY(0); }
  }

  /* ── Título do grupo ── */
  .vx-dd-title {
    display: flex; align-items: center; gap: 8px;
    padding: 11px 13px 10px;
    border-bottom: 1px solid #18243a;
    background: rgba(255,255,255,.025);
    font-family: 'Syne', sans-serif; font-size: 11px; font-weight: 700;
    letter-spacing: 1px; text-transform: uppercase; color: #94a3b8;
  }

  /* ── Botão de submenu ── */
  .vx-dd-btn {
    display: flex; align-items: center; gap: 9px;
    width: calc(100% - 10px); margin: 2px 5px;
    padding: 9px 11px;
    background: none; border: none; border-radius: 8px;
    color: #6e8099; font-family: 'DM Mono', monospace; font-size: 12px;
    cursor: pointer; text-align: left; transition: all .1s; position: relative;
  }
  .vx-dd-btn:hover { background: rgba(255,255,255,.06); color: #e2e8f0; }
  .vx-dd-btn.sub-active { font-weight: 600; }
  .vx-dd-icon { font-size: 14px; width: 18px; text-align: center; flex-shrink: 0; }
  .vx-dd-lbl  { flex: 1; }
  .vx-dd-dot  { width: 6px; height: 6px; border-radius: 50%; flex-shrink: 0; }

  /* ── Lado direito ── */
  .vx-right { display: flex; align-items: center; gap: 10px; flex-shrink: 0; margin-left: 6px; }
  .vx-user  { display: flex; align-items: center; gap: 8px; }
  .vx-av {
    width: 28px; height: 28px; border-radius: 50%;
    background: linear-gradient(135deg,#00d4ff,#0088aa);
    display: flex; align-items: center; justify-content: center;
    font-size: 11px; font-weight: 700; color: #fff; flex-shrink: 0;
  }
  .vx-uname { font-size: 11px; color: #6e8099; white-space: nowrap; }
  .vx-sair {
    padding: 4px 11px;
    background: rgba(239,68,68,.1); border: 1px solid rgba(239,68,68,.22);
    border-radius: 7px; color: #ef4444;
    font-family: 'DM Mono', monospace; font-size: 11px; cursor: pointer;
    transition: all .14s; white-space: nowrap;
  }
  .vx-sair:hover { background: rgba(239,68,68,.2); }

  /* ── Hamburguer ── */
  .vx-mob-btn {
    display: none;
    background: none; border: 1px solid #18243a; color: #6e8099;
    padding: 6px 11px; border-radius: 7px; cursor: pointer; font-size: 16px;
    margin-left: auto;
  }

  /* ── Mobile menu ── */
  .vx-mob {
    position: fixed; top: 52px; left: 0; right: 0; bottom: 0;
    background: rgba(8,13,26,.99); z-index: 8999;
    overflow-y: auto; padding: 14px;
  }
  .vx-mob-inicio {
    display: block; width: 100%; padding: 12px 16px; margin-bottom: 14px;
    background: rgba(0,212,255,.1); border: 1px solid rgba(0,212,255,.25);
    border-radius: 10px; color: #00d4ff;
    font-family: 'DM Mono', monospace; font-size: 13px; font-weight: 600;
    cursor: pointer; text-align: left;
  }
  .vx-mob-grupo { margin-bottom: 7px; border: 1px solid #18243a; border-radius: 10px; overflow: hidden; }
  .vx-mob-titulo {
    padding: 10px 14px;
    font-family: 'Syne', sans-serif; font-size: 11px; font-weight: 700;
    text-transform: uppercase; letter-spacing: 1px;
    background: rgba(255,255,255,.02); border-bottom: 1px solid #18243a;
  }
  .vx-mob-itens { padding: 4px; }
  .vx-mob-btn-item {
    display: flex; align-items: center; gap: 10px;
    width: 100%; padding: 10px 12px;
    background: none; border: none; border-radius: 8px;
    color: #6e8099; font-family: 'DM Mono', monospace; font-size: 13px;
    cursor: pointer; text-align: left; transition: all .12s;
  }
  .vx-mob-btn-item:hover { background: rgba(255,255,255,.05); color: #e2e8f0; }
  .vx-mob-ic { font-size: 15px; width: 20px; text-align: center; flex-shrink: 0; }
  .vx-mob-rodape {
    display: flex; align-items: center; justify-content: space-between;
    padding: 14px 4px 4px; margin-top: 8px; border-top: 1px solid #18243a;
  }

  @media (max-width: 768px) {
    .vx-menus  { display: none; }
    .vx-right  { display: none; }
    .vx-mob-btn { display: block; }
  }
`
