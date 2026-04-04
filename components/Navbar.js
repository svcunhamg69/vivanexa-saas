// components/Navbar.js — Menu Global Vivanexa SaaS
// =====================================================
// Navbar com menus e submenus para todas as páginas
// Importar em todas as pages: import Navbar from '../components/Navbar'
// =====================================================

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/router'
import { supabase } from '../lib/supabase'

const MENU = [
  {
    id: 'comercial',
    label: '💼 Comercial',
    subs: [
      { label: '💬 Chat / Assistente', href: '/chat' },
      { label: '🤝 CRM', href: '/crm' },
      { label: '📣 Disparo em Massa', href: '/prospeccao?aba=disparo' },
      { label: '🤖 Chatbot', href: '/prospeccao?aba=chatbot' },
      { label: '🧠 Agente IA', href: '/prospeccao?aba=agente' },
      { label: '📋 Script / Playbook', href: '/prospeccao?aba=script' },
    ],
  },
  {
    id: 'marketing',
    label: '📣 Marketing',
    subs: [
      { label: '🎯 Campanhas IA', href: '/marketing?aba=campanhas' },
      { label: '🖼️ Geração de Imagens', href: '/marketing?aba=imagens' },
      { label: '📅 Agenda de Publicação', href: '/marketing?aba=agenda' },
      { label: '📝 Script / Playbook', href: '/marketing?aba=script' },
    ],
  },
  {
    id: 'financeiro',
    label: '💰 Financeiro',
    subs: [
      { label: '💵 Contas a Receber', href: '/financeiro?aba=receber' },
      { label: '💸 Contas a Pagar', href: '/financeiro?aba=pagar' },
      { label: '🏦 Boleto / PIX', href: '/financeiro?aba=boleto' },
      { label: '💳 Cartão', href: '/financeiro?aba=cartao' },
      { label: '🏆 Comissões', href: '/financeiro?aba=comissoes' },
    ],
  },
  {
    id: 'fiscal',
    label: '📄 Fiscal',
    subs: [
      { label: '📦 NF de Produto', href: '/fiscal?aba=produto' },
      { label: '🛠️ NF de Serviço', href: '/fiscal?aba=servico' },
      { label: '🧾 NF do Consumidor', href: '/fiscal?aba=consumidor' },
    ],
  },
  {
    id: 'produtividade',
    label: '⚡ Produtividade',
    subs: [
      { label: '📥 Captura de Notas', href: '/produtividade?aba=notas' },
      { label: '✅ Tarefas e Obrigações', href: '/produtividade?aba=tarefas' },
      { label: '🔍 Monitoramento e-CAC', href: '/produtividade?aba=ecac' },
      { label: '📊 Consulta Tributária', href: '/produtividade?aba=tributaria' },
      { label: '🏪 Gestão MEI', href: '/produtividade?aba=mei' },
      { label: '📈 Simples Nacional', href: '/produtividade?aba=simples' },
    ],
  },
  {
    id: 'relatorios',
    label: '📈 Relatórios',
    subs: [
      { label: '💰 Financeiro', href: '/reports?aba=financeiro' },
      { label: '📊 KPIs', href: '/reports?aba=kpis' },
      { label: '🛒 Vendas', href: '/reports?aba=vendas' },
      { label: '📦 Produtos', href: '/reports?aba=produtos' },
      { label: '💼 Comercial', href: '/reports?aba=comercial' },
      { label: '📄 Fiscal', href: '/reports?aba=fiscal' },
    ],
  },
  {
    id: 'configuracoes',
    label: '⚙️ Config',
    subs: [
      { label: '🏢 Empresa', href: '/configuracoes?tab=empresa' },
      { label: '🎯 Metas', href: '/configuracoes?tab=metas' },
      { label: '📊 KPIs', href: '/configuracoes?tab=kpis' },
      { label: '👥 Usuários', href: '/configuracoes?tab=usuarios' },
      { label: '📦 Produtos', href: '/configuracoes?tab=produtos' },
      { label: '🏷️ Descontos', href: '/configuracoes?tab=descontos' },
    ],
  },
]

export default function Navbar({ cfg = {}, perfil = null }) {
  const router = useRouter()
  const [open, setOpen] = useState(null)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [user, setUser] = useState(perfil)
  const navRef = useRef(null)

  useEffect(() => {
    if (!perfil) {
      supabase.auth.getSession().then(async ({ data: { session } }) => {
        if (!session) return
        const { data: p } = await supabase.from('perfis').select('*').eq('user_id', session.user.id).maybeSingle()
        setUser(p)
      })
    }
  }, [perfil])

  // Fecha dropdown ao clicar fora
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

  return (
    <>
      <style>{`
        .vx-navbar {
          position: sticky;
          top: 0;
          z-index: 1000;
          background: rgba(10, 15, 30, 0.97);
          backdrop-filter: blur(12px);
          border-bottom: 1px solid #1e2d4a;
          padding: 0 16px;
          display: flex;
          align-items: center;
          gap: 0;
          height: 52px;
          font-family: 'DM Mono', monospace;
        }
        .vx-nav-logo {
          display: flex;
          align-items: center;
          gap: 8px;
          cursor: pointer;
          margin-right: 8px;
          flex-shrink: 0;
        }
        .vx-nav-logo img {
          height: 32px;
          object-fit: contain;
          border-radius: 6px;
        }
        .vx-nav-logo-text {
          font-family: 'Syne', sans-serif;
          font-size: 14px;
          font-weight: 700;
          color: #e2e8f0;
          white-space: nowrap;
        }
        .vx-nav-menus {
          display: flex;
          align-items: center;
          gap: 2px;
          flex: 1;
          overflow-x: auto;
          scrollbar-width: none;
        }
        .vx-nav-menus::-webkit-scrollbar { display: none; }
        .vx-nav-item {
          position: relative;
        }
        .vx-nav-btn {
          background: none;
          border: none;
          color: #94a3b8;
          font-family: 'DM Mono', monospace;
          font-size: 11.5px;
          padding: 6px 10px;
          border-radius: 7px;
          cursor: pointer;
          white-space: nowrap;
          transition: all .15s;
          display: flex;
          align-items: center;
          gap: 4px;
        }
        .vx-nav-btn:hover,
        .vx-nav-btn.active {
          background: rgba(0,212,255,.08);
          color: #00d4ff;
        }
        .vx-nav-btn .chevron {
          font-size: 8px;
          transition: transform .2s;
        }
        .vx-nav-btn.open .chevron { transform: rotate(180deg); }
        .vx-dropdown {
          position: absolute;
          top: calc(100% + 6px);
          left: 0;
          min-width: 220px;
          background: #111827;
          border: 1px solid #1e2d4a;
          border-radius: 10px;
          padding: 6px;
          box-shadow: 0 8px 32px rgba(0,0,0,.5);
          z-index: 2000;
          animation: fadeDown .15s ease;
        }
        @keyframes fadeDown {
          from { opacity: 0; transform: translateY(-6px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .vx-dropdown-item {
          display: block;
          width: 100%;
          text-align: left;
          background: none;
          border: none;
          color: #94a3b8;
          font-family: 'DM Mono', monospace;
          font-size: 12px;
          padding: 8px 12px;
          border-radius: 7px;
          cursor: pointer;
          transition: all .12s;
          white-space: nowrap;
        }
        .vx-dropdown-item:hover {
          background: rgba(0,212,255,.08);
          color: #00d4ff;
        }
        .vx-nav-right {
          display: flex;
          align-items: center;
          gap: 8px;
          flex-shrink: 0;
          margin-left: 8px;
        }
        .vx-nav-user {
          font-size: 11px;
          color: #64748b;
          white-space: nowrap;
        }
        .vx-nav-user span {
          color: #e2e8f0;
          font-weight: 500;
        }
        .vx-nav-logout {
          background: rgba(239,68,68,.1);
          border: 1px solid rgba(239,68,68,.25);
          color: #ef4444;
          font-family: 'DM Mono', monospace;
          font-size: 11px;
          padding: 4px 10px;
          border-radius: 6px;
          cursor: pointer;
          transition: all .15s;
          white-space: nowrap;
        }
        .vx-nav-logout:hover {
          background: rgba(239,68,68,.2);
        }
        .vx-mobile-toggle {
          display: none;
          background: none;
          border: 1px solid #1e2d4a;
          color: #94a3b8;
          padding: 6px 10px;
          border-radius: 7px;
          cursor: pointer;
          font-size: 16px;
          margin-left: auto;
        }
        .vx-mobile-menu {
          display: none;
          position: fixed;
          top: 52px;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(10,15,30,.98);
          z-index: 999;
          overflow-y: auto;
          padding: 12px;
        }
        .vx-mobile-menu.open { display: block; }
        .vx-mobile-section { margin-bottom: 8px; }
        .vx-mobile-section-title {
          font-family: 'Syne', sans-serif;
          font-size: 12px;
          font-weight: 700;
          color: #00d4ff;
          padding: 8px 12px 4px;
          text-transform: uppercase;
          letter-spacing: 1px;
        }
        .vx-mobile-item {
          display: block;
          width: 100%;
          text-align: left;
          background: none;
          border: none;
          color: #94a3b8;
          font-family: 'DM Mono', monospace;
          font-size: 13px;
          padding: 10px 16px;
          border-radius: 8px;
          cursor: pointer;
          transition: all .12s;
        }
        .vx-mobile-item:hover {
          background: rgba(0,212,255,.08);
          color: #00d4ff;
        }
        @media (max-width: 768px) {
          .vx-nav-menus { display: none; }
          .vx-nav-right { display: none; }
          .vx-mobile-toggle { display: block; }
        }
      `}</style>

      <nav className="vx-navbar" ref={navRef}>
        {/* Logo */}
        <div className="vx-nav-logo" onClick={() => navigate('/chat')}>
          {cfg.logob64
            ? <img src={cfg.logob64.startsWith('data:') ? cfg.logob64 : `data:image/png;base64,${cfg.logob64}`} alt={cfg.company || 'Vivanexa'} />
            : <div className="vx-nav-logo-text">{cfg.company || 'VIVANEXA'}</div>
          }
        </div>

        {/* Menus desktop */}
        <div className="vx-nav-menus">
          {MENU.map(menu => (
            <div key={menu.id} className="vx-nav-item">
              <button
                className={`vx-nav-btn ${open === menu.id ? 'open' : ''} ${isActive(menu) ? 'active' : ''}`}
                onClick={() => setOpen(open === menu.id ? null : menu.id)}
              >
                {menu.label}
                <span className="chevron">▼</span>
              </button>

              {open === menu.id && (
                <div className="vx-dropdown">
                  {menu.subs.map(sub => (
                    <button
                      key={sub.href}
                      className="vx-dropdown-item"
                      onClick={() => navigate(sub.href)}
                    >
                      {sub.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Lado direito */}
        <div className="vx-nav-right">
          {user && (
            <div className="vx-nav-user">
              👤 <span>{user.nome || user.email}</span>
            </div>
          )}
          <button className="vx-nav-logout" onClick={handleLogout}>Sair</button>
        </div>

        {/* Toggle mobile */}
        <button className="vx-mobile-toggle" onClick={() => setMobileOpen(!mobileOpen)}>
          {mobileOpen ? '✕' : '☰'}
        </button>
      </nav>

      {/* Menu mobile */}
      <div className={`vx-mobile-menu ${mobileOpen ? 'open' : ''}`}>
        {MENU.map(menu => (
          <div key={menu.id} className="vx-mobile-section">
            <div className="vx-mobile-section-title">{menu.label}</div>
            {menu.subs.map(sub => (
              <button key={sub.href} className="vx-mobile-item" onClick={() => navigate(sub.href)}>
                {sub.label}
              </button>
            ))}
          </div>
        ))}
        <div style={{ borderTop: '1px solid #1e2d4a', marginTop: 12, paddingTop: 12 }}>
          {user && <div style={{ color: '#64748b', fontSize: 12, padding: '0 12px 8px', fontFamily: 'DM Mono' }}>👤 {user.nome || user.email}</div>}
          <button className="vx-mobile-item" style={{ color: '#ef4444' }} onClick={handleLogout}>🚪 Sair</button>
        </div>
      </div>
    </>
  )
}
