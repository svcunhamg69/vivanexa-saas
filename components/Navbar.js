// components/Navbar.js — Vivanexa SaaS v3
// Submenus abrem NO TOPO ao clicar. Botão Home sempre visível.
import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/router'
import { supabase } from '../lib/supabase'

const MENU = [
  {
    id: 'comercial', label: 'Comercial', icon: '💼', color: '#00d4ff',
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
    id: 'marketing', label: 'Marketing', icon: '📣', color: '#7c3aed',
    subs: [
      { label: 'Campanhas IA',         icon: '🎯', href: '/marketing?aba=campanhas' },
      { label: 'Geração de Imagens',   icon: '🖼️', href: '/marketing?aba=imagens' },
      { label: 'Agenda de Publicação', icon: '📅', href: '/marketing?aba=agenda' },
      { label: 'Script / Playbook',    icon: '📝', href: '/marketing?aba=script' },
    ],
  },
  {
    id: 'financeiro', label: 'Financeiro', icon: '💰', color: '#10b981',
    subs: [
      { label: 'Contas a Receber', icon: '💵', href: '/financeiro?aba=receber' },
      { label: 'Contas a Pagar',   icon: '💸', href: '/financeiro?aba=pagar' },
      { label: 'Boleto / PIX',     icon: '🏦', href: '/financeiro?aba=boleto' },
      { label: 'Cartão',           icon: '💳', href: '/financeiro?aba=cartao' },
      { label: 'Comissões',        icon: '🏆', href: '/financeiro?aba=comissoes' },
    ],
  },
  {
    id: 'fiscal', label: 'Fiscal', icon: '📄', color: '#f59e0b',
    subs: [
      { label: 'NF de Produto',    icon: '📦', href: '/fiscal?aba=produto' },
      { label: 'NF de Serviço',    icon: '🛠️', href: '/fiscal?aba=servico' },
      { label: 'NF do Consumidor', icon: '🧾', href: '/fiscal?aba=consumidor' },
    ],
  },
  {
    id: 'produtividade', label: 'Produtividade', icon: '⚡', color: '#06b6d4',
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
    id: 'relatorios', label: 'Relatórios', icon: '📈', color: '#ec4899',
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
    id: 'configuracoes', label: 'Config', icon: '⚙️', color: '#64748b',
    subs: [
      { label: 'Empresa',      icon: '🏢', href: '/configuracoes?tab=empresa' },
      { label: 'Metas',        icon: '🎯', href: '/configuracoes?tab=metas' },
      { label: 'KPIs',         icon: '📊', href: '/configuracoes?tab=kpis' },
      { label: 'Usuários',     icon: '👥', href: '/configuracoes?tab=usuarios' },
      { label: 'Produtos',     icon: '📦', href: '/configuracoes?tab=produtos' },
      { label: 'Descontos',    icon: '🏷️', href: '/configuracoes?tab=descontos' },
      { label: 'Integrações',  icon: '🔗', href: '/configuracoes?tab=integracoes' },
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
    if (!perfil) {
      supabase.auth.getSession().then(async ({ data: { session } }) => {
        if (!session) return
        const { data: p } = await supabase.from('perfis').select('*').eq('user_id', session.user.id).maybeSingle()
        setUser(p)
      })
    }
  }, [perfil])

  useEffect(() => {
    const handler = (e) => {
      if (navRef.current && !navRef.current.contains(e.target)) {
        setOpen(null); setMobileOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  function navigate(href) { setOpen(null); setMobileOpen(false); router.push(href) }
  function isActive(menu) { return menu.subs.some(s => router.pathname === s.href.split('?')[0]) }
  async function handleLogout() { await supabase.auth.signOut(); router.replace('/') }

  return (
    <>
      <style>{CSS}</style>
      <nav className="vx-nav" ref={navRef}>

        {/* Botão Home — sempre visível, destaque azul */}
        <button className="vx-home-btn" onClick={() => navigate('/dashboard')} title="Painel Principal">
          {cfg.logob64
            ? <img src={cfg.logob64.startsWith('data:') ? cfg.logob64 : `data:image/png;base64,${cfg.logob64}`}
                alt="logo" style={{ height: 24, objectFit: 'contain', borderRadius: 4 }} />
            : <span style={{ fontSize: 14 }}>🏠</span>
          }
          <span>Início</span>
        </button>

        <div className="vx-sep" />

        {/* Menus desktop */}
        <div className="vx-menus">
          {MENU.map(menu => (
            <div key={menu.id} className="vx-item">
              <button
                className={`vx-btn${open === menu.id ? ' open' : ''}${isActive(menu) ? ' active' : ''}`}
                style={(open === menu.id || isActive(menu)) ? { color: menu.color, background: menu.color + '14' } : {}}
                onClick={() => setOpen(open === menu.id ? null : menu.id)}
              >
                {menu.icon} {menu.label}
                <span className={`vx-arr${open === menu.id ? ' rot' : ''}`}>▾</span>
              </button>

              {open === menu.id && (
                <div className="vx-dd" style={{ borderTopColor: menu.color }}>
                  <div className="vx-dd-head" style={{ color: menu.color }}>
                    {menu.icon} {menu.label}
                  </div>
                  {menu.subs.map(sub => (
                    <button key={sub.href} className="vx-dd-btn" onClick={() => navigate(sub.href)}>
                      <span className="vx-dd-ic">{sub.icon}</span>
                      {sub.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Lado direito */}
        <div className="vx-right">
          {user && (
            <div className="vx-user">
              <div className="vx-av">{(user.nome || user.email || 'U')[0].toUpperCase()}</div>
              <span className="vx-uname">{(user.nome || user.email || '').split(' ')[0]}</span>
            </div>
          )}
          <button className="vx-sair" onClick={handleLogout}>Sair</button>
        </div>

        <button className="vx-mob-tog" onClick={() => setMobileOpen(!mobileOpen)}>
          {mobileOpen ? '✕' : '☰'}
        </button>
      </nav>

      {mobileOpen && (
        <div className="vx-mob">
          <button className="vx-mob-home" onClick={() => navigate('/dashboard')}>🏠 Painel Principal</button>
          {MENU.map(menu => (
            <div key={menu.id} className="vx-mob-sec">
              <div className="vx-mob-title" style={{ color: menu.color }}>{menu.icon} {menu.label}</div>
              {menu.subs.map(sub => (
                <button key={sub.href} className="vx-mob-item" onClick={() => navigate(sub.href)}>
                  {sub.icon} {sub.label}
                </button>
              ))}
            </div>
          ))}
          <div className="vx-mob-foot">
            <span style={{ color: '#64748b', fontSize: 12 }}>👤 {user?.nome || user?.email}</span>
            <button className="vx-sair" onClick={handleLogout}>Sair</button>
          </div>
        </div>
      )}
    </>
  )
}

const CSS = `
  .vx-nav{position:sticky;top:0;z-index:1000;background:rgba(9,14,28,.98);backdrop-filter:blur(16px);border-bottom:1px solid #1e2d4a;display:flex;align-items:center;padding:0 12px;height:52px;gap:3px;font-family:'DM Mono',monospace}
  .vx-home-btn{display:flex;align-items:center;gap:6px;background:rgba(0,212,255,.12);border:1px solid rgba(0,212,255,.3);color:#00d4ff;font-family:'DM Mono',monospace;font-size:11px;font-weight:600;padding:5px 11px;border-radius:8px;cursor:pointer;transition:all .15s;flex-shrink:0;white-space:nowrap}
  .vx-home-btn:hover{background:rgba(0,212,255,.22);box-shadow:0 0 14px rgba(0,212,255,.2)}
  .vx-sep{width:1px;height:26px;background:#1e2d4a;margin:0 8px;flex-shrink:0}
  .vx-menus{display:flex;align-items:center;gap:1px;flex:1;overflow-x:auto;scrollbar-width:none}
  .vx-menus::-webkit-scrollbar{display:none}
  .vx-item{position:relative}
  .vx-btn{display:flex;align-items:center;gap:4px;background:none;border:none;color:#94a3b8;font-family:'DM Mono',monospace;font-size:11.5px;padding:6px 9px;border-radius:7px;cursor:pointer;white-space:nowrap;transition:all .14s}
  .vx-btn:hover{background:rgba(255,255,255,.05);color:#e2e8f0}
  .vx-arr{font-size:9px;transition:transform .18s}
  .vx-arr.rot{transform:rotate(180deg)}
  .vx-dd{position:absolute;top:calc(100% + 6px);left:0;min-width:215px;background:#0c1525;border:1px solid #1e2d4a;border-top:2px solid;border-radius:11px;padding:8px;box-shadow:0 18px 56px rgba(0,0,0,.75);z-index:3000;animation:vxIn .12s ease}
  @keyframes vxIn{from{opacity:0;transform:translateY(-6px)}to{opacity:1;transform:translateY(0)}}
  .vx-dd-head{font-family:'Syne',sans-serif;font-size:10px;font-weight:700;letter-spacing:1.2px;text-transform:uppercase;padding:5px 9px 9px;border-bottom:1px solid #1e2d4a;margin-bottom:5px}
  .vx-dd-btn{display:flex;align-items:center;gap:8px;width:100%;background:none;border:none;color:#94a3b8;font-family:'DM Mono',monospace;font-size:12px;padding:8px 9px;border-radius:7px;cursor:pointer;transition:all .1s;text-align:left}
  .vx-dd-btn:hover{background:rgba(255,255,255,.06);color:#e2e8f0}
  .vx-dd-ic{font-size:14px;width:18px;text-align:center;flex-shrink:0}
  .vx-right{display:flex;align-items:center;gap:8px;flex-shrink:0;margin-left:6px}
  .vx-user{display:flex;align-items:center;gap:7px}
  .vx-av{width:27px;height:27px;border-radius:50%;background:linear-gradient(135deg,#00d4ff,#0099bb);display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;color:#fff;flex-shrink:0}
  .vx-uname{font-size:11px;color:#94a3b8;white-space:nowrap}
  .vx-sair{background:rgba(239,68,68,.1);border:1px solid rgba(239,68,68,.22);color:#ef4444;font-family:'DM Mono',monospace;font-size:11px;padding:4px 10px;border-radius:6px;cursor:pointer;transition:all .15s;white-space:nowrap}
  .vx-sair:hover{background:rgba(239,68,68,.2)}
  .vx-mob-tog{display:none;background:none;border:1px solid #1e2d4a;color:#94a3b8;padding:6px 10px;border-radius:7px;cursor:pointer;font-size:16px;margin-left:auto}
  .vx-mob{position:fixed;top:52px;left:0;right:0;bottom:0;background:rgba(9,14,28,.99);z-index:999;overflow-y:auto;padding:14px}
  .vx-mob-home{display:block;width:100%;text-align:left;background:rgba(0,212,255,.1);border:1px solid rgba(0,212,255,.25);color:#00d4ff;font-family:'DM Mono',monospace;font-size:13px;font-weight:600;padding:12px 16px;border-radius:10px;cursor:pointer;margin-bottom:12px}
  .vx-mob-sec{margin-bottom:10px}
  .vx-mob-title{font-family:'Syne',sans-serif;font-size:11px;font-weight:700;padding:8px 12px 4px;text-transform:uppercase;letter-spacing:1.5px}
  .vx-mob-item{display:block;width:100%;text-align:left;background:none;border:none;color:#94a3b8;font-family:'DM Mono',monospace;font-size:13px;padding:10px 16px;border-radius:8px;cursor:pointer;transition:all .12s}
  .vx-mob-item:hover{background:rgba(255,255,255,.05);color:#e2e8f0}
  .vx-mob-foot{border-top:1px solid #1e2d4a;margin-top:14px;padding-top:14px;display:flex;align-items:center;justify-content:space-between}
  @media(max-width:768px){.vx-menus{display:none}.vx-right{display:none}.vx-mob-tog{display:block}}
`
