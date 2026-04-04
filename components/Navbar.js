// components/Navbar.js — Menu Global Vivanexa SaaS v2
// =====================================================
// Navbar com menus, submenus e descrições para todas as páginas
// Uso: import Navbar from '../components/Navbar'
// Exemplo: <Navbar cfg={cfg} perfil={perfil} />
// =====================================================

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/router'
import { supabase } from '../lib/supabase'

const MENU = [
  {
    id: 'comercial',
    label: '💼 Comercial',
    color: '#00d4ff',
    desc: 'Vendas, propostas e relacionamento',
    subs: [
      { label: '💬 Chat / Assistente', href: '/chat',                    desc: 'IA comercial de precificação' },
      { label: '🤝 CRM',               href: '/crm',                     desc: 'Funil de vendas e clientes' },
      { label: '📣 Disparo em Massa',   href: '/prospeccao?aba=disparo',  desc: 'WhatsApp e e-mail em lote' },
      { label: '🤖 Chatbot',            href: '/prospeccao?aba=chatbot',  desc: 'Atendimento automatizado' },
      { label: '🧠 Agente IA',          href: '/prospeccao?aba=agente',   desc: 'OpenAI, Gemini, Groq' },
      { label: '📋 Script / Playbook',  href: '/prospeccao?aba=script',   desc: 'Roteiros de vendas' },
    ],
  },
  {
    id: 'marketing',
    label: '📣 Marketing',
    color: '#7c3aed',
    desc: 'Campanhas, conteúdo e publicações',
    subs: [
      { label: '🎯 Campanhas IA',          href: '/marketing?aba=campanhas', desc: 'Google e Meta com IA' },
      { label: '🖼️ Geração de Imagens',    href: '/marketing?aba=imagens',   desc: 'Posts e criativos' },
      { label: '📅 Agenda de Publicação',  href: '/marketing?aba=agenda',    desc: 'Instagram, TikTok, Facebook' },
      { label: '📝 Script / Playbook',     href: '/marketing?aba=script',    desc: 'Roteiros de marketing' },
    ],
  },
  {
    id: 'financeiro',
    label: '💰 Financeiro',
    color: '#10b981',
    desc: 'Controle financeiro e pagamentos',
    subs: [
      { label: '💵 Contas a Receber', href: '/financeiro?aba=receber',   desc: 'Receitas e cobranças' },
      { label: '💸 Contas a Pagar',   href: '/financeiro?aba=pagar',     desc: 'Despesas e fornecedores' },
      { label: '🏦 Boleto / PIX',     href: '/financeiro?aba=boleto',    desc: 'Emissão e recebimento' },
      { label: '💳 Cartão',           href: '/financeiro?aba=cartao',    desc: 'Crédito e débito' },
      { label: '🏆 Comissões',        href: '/financeiro?aba=comissoes', desc: 'Calculadora por metas' },
    ],
  },
  {
    id: 'fiscal',
    label: '📄 Fiscal',
    color: '#f59e0b',
    desc: 'Notas fiscais e obrigações',
    subs: [
      { label: '📦 NF de Produto',      href: '/fiscal?aba=produto',    desc: 'Nota fiscal eletrônica' },
      { label: '🛠️ NF de Serviço',     href: '/fiscal?aba=servico',    desc: 'Nota de serviço (NFSe)' },
      { label: '🧾 NF do Consumidor',   href: '/fiscal?aba=consumidor', desc: 'NFC-e e cupom fiscal' },
    ],
  },
  {
    id: 'produtividade',
    label: '⚡ Produtividade',
    color: '#06b6d4',
    desc: 'Tarefas, MEI e tributos',
    subs: [
      { label: '📥 Captura de Notas',       href: '/produtividade?aba=notas',     desc: 'XMLs e portal NF-e' },
      { label: '✅ Tarefas e Obrigações',   href: '/produtividade?aba=tarefas',   desc: 'Gestão de prazos' },
      { label: '🔍 Monitoramento e-CAC',    href: '/produtividade?aba=ecac',      desc: 'VERI, Monitor Contábil' },
      { label: '📊 Consulta Tributária',    href: '/produtividade?aba=tributaria',desc: 'NCM, barras, tributação' },
      { label: '🏪 Gestão MEI',             href: '/produtividade?aba=mei',       desc: 'DAS, anuidade e obrigações' },
      { label: '📈 Simples Nacional',       href: '/produtividade?aba=simples',   desc: 'Apuração e PGDAS' },
    ],
  },
  {
    id: 'relatorios',
    label: '📈 Relatórios',
    color: '#ec4899',
    desc: 'Análises e indicadores',
    subs: [
      { label: '💰 Financeiro', href: '/reports?aba=financeiro', desc: 'DRE e fluxo de caixa' },
      { label: '📊 KPIs',       href: '/reports?aba=kpis',       desc: 'Metas e indicadores' },
      { label: '🛒 Vendas',     href: '/reports?aba=vendas',     desc: 'Conversão e receita' },
      { label: '📦 Produtos',   href: '/reports?aba=produtos',   desc: 'Módulos e planos' },
      { label: '💼 Comercial',  href: '/reports?aba=comercial',  desc: 'Pipeline e funil' },
      { label: '📄 Fiscal',     href: '/reports?aba=fiscal',     desc: 'NFs emitidas' },
    ],
  },
  {
    id: 'configuracoes',
    label: '⚙️ Config',
    color: '#64748b',
    desc: 'Empresa, usuários e sistema',
    subs: [
      { label: '🏢 Empresa',    href: '/configuracoes?tab=empresa',   desc: 'Dados e logotipo' },
      { label: '🎯 Metas',      href: '/configuracoes?tab=metas',     desc: 'Objetivos mensais' },
      { label: '📊 KPIs',       href: '/configuracoes?tab=kpis',      desc: 'Indicadores e templates' },
      { label: '👥 Usuários',   href: '/configuracoes?tab=usuarios',  desc: 'Acessos e comissões' },
      { label: '📦 Produtos',   href: '/configuracoes?tab=produtos',  desc: 'Planos e preços' },
      { label: '🏷️ Descontos', href: '/configuracoes?tab=descontos', desc: 'Vouchers e condições' },
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

  const activeMenu = MENU.find(m => isActive(m))

  return (
    <>
      <style>{NAV_CSS}</style>

      <nav className="vx-navbar" ref={navRef}>
        {/* Logo — clica e vai para o dashboard */}
        <div className="vx-nav-logo" onClick={() => navigate('/dashboard')}>
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
                style={open === menu.id ? { color: menu.color, background: menu.color + '18' } : isActive(menu) ? { color: menu.color } : {}}
                onClick={() => setOpen(open === menu.id ? null : menu.id)}
              >
                {menu.label}
                <span className="chevron">▼</span>
              </button>

              {open === menu.id && (
                <div className="vx-dropdown" style={{ borderTopColor: menu.color }}>
                  <div className="vx-dropdown-header">
                    <div className="vx-dd-title">{menu.label}</div>
                    <div className="vx-dd-desc">{menu.desc}</div>
                  </div>
                  {menu.subs.map(sub => (
                    <button
                      key={sub.href}
                      className="vx-dropdown-item"
                      onClick={() => navigate(sub.href)}
                    >
                      <span className="vx-di-label">{sub.label}</span>
                      <span className="vx-di-desc">{sub.desc}</span>
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
              <div className="vx-nav-avatar">{(user.nome || user.email || 'U')[0].toUpperCase()}</div>
              <span>{user.nome || user.email}</span>
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
            <div className="vx-mobile-section-title" style={{ color: menu.color }}>{menu.label}</div>
            {menu.subs.map(sub => (
              <button key={sub.href} className="vx-mobile-item" onClick={() => navigate(sub.href)}>
                {sub.label}
              </button>
            ))}
          </div>
        ))}
        <div className="vx-mobile-footer">
          {user && <div className="vx-mobile-user">👤 {user.nome || user.email}</div>}
          <button className="vx-mobile-item" style={{ color: '#ef4444' }} onClick={handleLogout}>🚪 Sair</button>
        </div>
      </div>
    </>
  )
}

const NAV_CSS = `
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
    height: 54px;
    font-family: 'DM Mono', monospace;
  }
  .vx-nav-logo {
    display: flex;
    align-items: center;
    gap: 8px;
    cursor: pointer;
    margin-right: 12px;
    flex-shrink: 0;
  }
  .vx-nav-logo img { height: 32px; object-fit: contain; border-radius: 6px; }
  .vx-nav-logo-text {
    font-family: 'Syne', sans-serif;
    font-size: 14px;
    font-weight: 800;
    color: #00d4ff;
    letter-spacing: 2px;
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
  .vx-nav-item { position: relative; }
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
  .vx-nav-btn:hover { background: rgba(255,255,255,.05); color: #e2e8f0; }
  .vx-nav-btn .chevron { font-size: 7px; transition: transform .2s; }
  .vx-nav-btn.open .chevron { transform: rotate(180deg); }
  .vx-dropdown {
    position: absolute;
    top: calc(100% + 6px);
    left: 0;
    min-width: 240px;
    background: #0f1829;
    border: 1px solid #1e2d4a;
    border-top: 2px solid #00d4ff;
    border-radius: 11px;
    padding: 8px;
    box-shadow: 0 12px 40px rgba(0,0,0,.6);
    z-index: 2000;
    animation: vxFadeDown .15s ease;
  }
  @keyframes vxFadeDown {
    from { opacity: 0; transform: translateY(-6px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  .vx-dropdown-header {
    padding: 8px 10px 10px;
    border-bottom: 1px solid #1e2d4a;
    margin-bottom: 6px;
  }
  .vx-dd-title {
    font-family: 'Syne', sans-serif;
    font-size: 12px;
    font-weight: 700;
    color: #e2e8f0;
    margin-bottom: 2px;
  }
  .vx-dd-desc { font-size: 10px; color: #64748b; }
  .vx-dropdown-item {
    display: flex;
    flex-direction: column;
    width: 100%;
    text-align: left;
    background: none;
    border: none;
    padding: 7px 10px;
    border-radius: 7px;
    cursor: pointer;
    transition: all .12s;
    gap: 1px;
  }
  .vx-dropdown-item:hover { background: rgba(255,255,255,.05); }
  .vx-di-label {
    font-family: 'DM Mono', monospace;
    font-size: 12px;
    color: #e2e8f0;
    white-space: nowrap;
  }
  .vx-di-desc {
    font-family: 'DM Mono', monospace;
    font-size: 10px;
    color: #64748b;
  }
  .vx-nav-right {
    display: flex;
    align-items: center;
    gap: 10px;
    flex-shrink: 0;
    margin-left: 8px;
  }
  .vx-nav-user {
    display: flex;
    align-items: center;
    gap: 7px;
    font-size: 11px;
    color: #94a3b8;
    white-space: nowrap;
  }
  .vx-nav-avatar {
    width: 26px;
    height: 26px;
    border-radius: 50%;
    background: linear-gradient(135deg, #00d4ff, #0099bb);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 10px;
    font-weight: 700;
    color: #fff;
    flex-shrink: 0;
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
  .vx-nav-logout:hover { background: rgba(239,68,68,.2); }
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
    top: 54px;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(10,15,30,.99);
    z-index: 999;
    overflow-y: auto;
    padding: 12px;
  }
  .vx-mobile-menu.open { display: block; }
  .vx-mobile-section { margin-bottom: 8px; }
  .vx-mobile-section-title {
    font-family: 'Syne', sans-serif;
    font-size: 11px;
    font-weight: 700;
    padding: 8px 12px 4px;
    text-transform: uppercase;
    letter-spacing: 1.5px;
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
  .vx-mobile-item:hover { background: rgba(255,255,255,.05); color: #e2e8f0; }
  .vx-mobile-footer {
    border-top: 1px solid #1e2d4a;
    margin-top: 12px;
    padding-top: 12px;
  }
  .vx-mobile-user { color: #64748b; font-size: 12px; padding: 0 12px 8px; font-family: 'DM Mono', monospace; }
  @media (max-width: 768px) {
    .vx-nav-menus { display: none; }
    .vx-nav-right { display: none; }
    .vx-mobile-toggle { display: block; }
  }
`
