// pages/dashboard.js — Tela Principal Vivanexa SaaS
// ====================================================
// Esta é a primeira tela que o usuário vê após o login.
// Inclui: Navbar global, KPIs resumidos, acesso rápido,
// atividades do dia, atalhos e todos os módulos listados.
// ====================================================

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/router'
import Head from 'next/head'
import { supabase } from '../lib/supabase'
import Navbar from '../components/Navbar'

// ── Estrutura de módulos (espelha o Navbar) ─────────────────────
const MODULOS = [
  {
    id: 'comercial', label: 'Comercial', icon: '💼', color: '#00d4ff',
    desc: 'Vendas, propostas e relacionamento',
    subs: [
      { label: 'Chat / Assistente', icon: '💬', href: '/chat',                   desc: 'IA comercial de precificação' },
      { label: 'CRM',               icon: '🤝', href: '/crm',                    desc: 'Funil de vendas e clientes' },
      { label: 'Disparo em Massa',  icon: '📣', href: '/prospeccao?aba=disparo', desc: 'WhatsApp e e-mail em lote' },
      { label: 'Chatbot',           icon: '🤖', href: '/prospeccao?aba=chatbot', desc: 'Atendimento automatizado' },
      { label: 'Agente IA',         icon: '🧠', href: '/prospeccao?aba=agente',  desc: 'OpenAI, Gemini, Groq' },
      { label: 'Script / Playbook', icon: '📋', href: '/prospeccao?aba=script',  desc: 'Roteiros de vendas' },
    ],
  },
  {
    id: 'marketing', label: 'Marketing', icon: '📣', color: '#7c3aed',
    desc: 'Campanhas, conteúdo e publicações',
    subs: [
      { label: 'Campanhas IA',         icon: '🎯', href: '/marketing?aba=campanhas', desc: 'Google e Meta com IA' },
      { label: 'Geração de Imagens',   icon: '🖼️', href: '/marketing?aba=imagens',   desc: 'Posts e criativos' },
      { label: 'Agenda de Publicação', icon: '📅', href: '/marketing?aba=agenda',    desc: 'Instagram, TikTok, Facebook' },
      { label: 'Script / Playbook',    icon: '📝', href: '/marketing?aba=script',    desc: 'Roteiros de marketing' },
    ],
  },
  {
    id: 'financeiro', label: 'Financeiro', icon: '💰', color: '#10b981',
    desc: 'Controle financeiro e pagamentos',
    subs: [
      { label: 'Contas a Receber', icon: '💵', href: '/financeiro?aba=receber',   desc: 'Receitas e cobranças' },
      { label: 'Contas a Pagar',   icon: '💸', href: '/financeiro?aba=pagar',     desc: 'Despesas e fornecedores' },
      { label: 'Boleto / PIX',     icon: '🏦', href: '/financeiro?aba=boleto',    desc: 'Emissão e recebimento' },
      { label: 'Cartão',           icon: '💳', href: '/financeiro?aba=cartao',    desc: 'Crédito e débito' },
      { label: 'Comissões',        icon: '🏆', href: '/financeiro?aba=comissoes', desc: 'Calculadora por metas' },
    ],
  },
  {
    id: 'fiscal', label: 'Fiscal', icon: '📄', color: '#f59e0b',
    desc: 'Notas fiscais e obrigações',
    subs: [
      { label: 'NF de Produto',    icon: '📦', href: '/fiscal?aba=produto',    desc: 'Nota fiscal eletrônica' },
      { label: 'NF de Serviço',    icon: '🛠️', href: '/fiscal?aba=servico',    desc: 'Nota de serviço (NFSe)' },
      { label: 'NF do Consumidor', icon: '🧾', href: '/fiscal?aba=consumidor', desc: 'NFC-e e cupom fiscal' },
    ],
  },
  {
    id: 'produtividade', label: 'Produtividade', icon: '⚡', color: '#06b6d4',
    desc: 'Tarefas, MEI e tributos',
    subs: [
      { label: 'Captura de Notas',     icon: '📥', href: '/produtividade?aba=notas',      desc: 'XMLs e portal NF-e' },
      { label: 'Tarefas e Obrigações', icon: '✅', href: '/produtividade?aba=tarefas',    desc: 'Gestão de prazos' },
      { label: 'Monitoramento e-CAC',  icon: '🔍', href: '/produtividade?aba=ecac',       desc: 'VERI, Monitor Contábil' },
      { label: 'Consulta Tributária',  icon: '📊', href: '/produtividade?aba=tributaria', desc: 'NCM, barras, tributação' },
      { label: 'Gestão MEI',           icon: '🏪', href: '/produtividade?aba=mei',        desc: 'DAS, anuidade e obrigações' },
      { label: 'Simples Nacional',     icon: '📈', href: '/produtividade?aba=simples',    desc: 'Apuração e PGDAS' },
    ],
  },
  {
    id: 'relatorios', label: 'Relatórios', icon: '📈', color: '#ec4899',
    desc: 'Análises e indicadores',
    subs: [
      { label: 'Financeiro', icon: '💰', href: '/reports?aba=financeiro', desc: 'DRE e fluxo de caixa' },
      { label: 'KPIs',       icon: '📊', href: '/reports?aba=kpis',       desc: 'Metas e indicadores' },
      { label: 'Vendas',     icon: '🛒', href: '/reports?aba=vendas',     desc: 'Conversão e receita' },
      { label: 'Produtos',   icon: '📦', href: '/reports?aba=produtos',   desc: 'Módulos e planos' },
      { label: 'Comercial',  icon: '💼', href: '/reports?aba=comercial',  desc: 'Pipeline e funil' },
      { label: 'Fiscal',     icon: '📄', href: '/reports?aba=fiscal',     desc: 'NFs emitidas' },
    ],
  },
  {
    id: 'configuracoes', label: 'Configurações', icon: '⚙️', color: '#64748b',
    desc: 'Empresa, usuários e sistema',
    subs: [
      { label: 'Empresa',    icon: '🏢', href: '/configuracoes?tab=empresa',   desc: 'Dados e logotipo' },
      { label: 'Metas',      icon: '🎯', href: '/configuracoes?tab=metas',     desc: 'Objetivos mensais' },
      { label: 'KPIs',       icon: '📊', href: '/configuracoes?tab=kpis',      desc: 'Indicadores e templates' },
      { label: 'Usuários',   icon: '👥', href: '/configuracoes?tab=usuarios',  desc: 'Acessos e comissões' },
      { label: 'Produtos',   icon: '📦', href: '/configuracoes?tab=produtos',  desc: 'Planos e preços' },
      { label: 'Descontos',  icon: '🏷️', href: '/configuracoes?tab=descontos', desc: 'Vouchers e condições' },
    ],
  },
]

// ── Atalhos rápidos ─────────────────────────────────────────────
const ATALHOS = [
  { label: 'Nova Proposta',   icon: '📄', href: '/chat' },
  { label: 'Novo Contrato',   icon: '📝', href: '/chat' },
  { label: 'Lançar KPIs',     icon: '📊', href: '/kpi' },
  { label: 'Ver Relatórios',  icon: '📈', href: '/reports' },
  { label: 'Novo Lead',       icon: '🎯', href: '/crm' },
  { label: 'Configurações',   icon: '⚙️', href: '/configuracoes' },
]

// ── Utilitários ─────────────────────────────────────────────────
const fmt = n => 'R$ ' + Number(n || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })

export default function Dashboard() {
  const router = useRouter()
  const [user, setUser]       = useState(null)
  const [cfg,  setCfg]        = useState({})
  const [stats, setStats]     = useState({ receita: 0, contratos: 0, leads: 0, kpiPct: 0 })
  const [atividades, setAtiv] = useState([])
  const [loading, setLoading] = useState(true)
  const [hora, setHora]       = useState('')

  // Relógio ao vivo
  useEffect(() => {
    const tick = () => setHora(new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }))
    tick()
    const t = setInterval(tick, 30000)
    return () => clearInterval(t)
  }, [])

  // Carrega dados do Supabase
  useEffect(() => {
    async function init() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.replace('/'); return }

      let { data: perfil } = await supabase.from('perfis').select('*').eq('user_id', session.user.id).maybeSingle()
      if (!perfil) {
        const nome = session.user.user_metadata?.name || session.user.email?.split('@')[0] || 'Usuário'
        const { data: np } = await supabase
          .from('perfis')
          .insert({ user_id: session.user.id, nome, email: session.user.email, empresa_id: session.user.id, perfil: 'admin' })
          .select().single()
        perfil = np
      }
      setUser(perfil)

      const eid = perfil?.empresa_id || session.user.id
      const { data: row } = await supabase.from('vx_storage').select('value').eq('key', `cfg:${eid}`).single()
      const c = row?.value ? JSON.parse(row.value) : {}
      setCfg(c)

      // ── Calcular stats reais ──────────────────────────────────
      const mesAtual = new Date().toISOString().slice(0, 7)
      const historico = c.historico || []
      const receitaMes = historico
        .filter(h => (h.date || '').startsWith(mesAtual))
        .reduce((acc, h) => acc + Number(h.tMenD || h.mensalidade || 0), 0)
      const contratosMes = historico.filter(h => (h.date || '').startsWith(mesAtual)).length

      const negocios = c.crm_negocios || []
      const leads = negocios.filter(n => n.etapa !== 'fechamento' && n.etapa !== 'perdido').length

      // KPI do dia
      const hoje = new Date().toISOString().slice(0, 10)
      const kpiLog = (c.kpiLog || []).filter(l => l.userId === session.user.id && l.date === hoje)
      const kpiTemplates = c.kpiTemplates || []
      let kpiPct = 0
      if (kpiTemplates.length > 0 && kpiLog.length > 0) {
        const metas = c.kpiDailyGoals?.[session.user.id] || {}
        let totalMeta = 0, totalReal = 0
        kpiTemplates.forEach(k => {
          const meta = Number(metas[k.id] || 0)
          const real = Number(kpiLog.find(l => l.kpiId === k.id)?.realizado || 0)
          if (meta > 0) { totalMeta += meta; totalReal += Math.min(real, meta) }
        })
        kpiPct = totalMeta > 0 ? Math.round((totalReal / totalMeta) * 100) : 0
      }

      setStats({ receita: receitaMes, contratos: contratosMes, leads, kpiPct })

      // ── Atividades do CRM ────────────────────────────────────
      const ativs = c.crm_atividades || []
      const negsMap = {}
      negocios.forEach(n => { negsMap[n.id] = n })
      const hojeStr = new Date().toISOString().slice(0, 10)
      const amanha = new Date(); amanha.setDate(amanha.getDate() + 1)
      const amStr = amanha.toISOString().slice(0, 10)

      const ativsFormatadas = ativs
        .filter(a => !a.concluida)
        .map(a => {
          const neg = negsMap[a.negocioId]
          const prazoDia = a.prazo ? a.prazo.slice(0, 10) : null
          let status = 'futura'
          let prazoLabel = a.prazo ? new Date(a.prazo).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : 'Sem prazo'
          if (prazoDia && prazoDia < hojeStr) { status = 'atrasada'; prazoLabel = '⚠️ Atrasada' }
          else if (prazoDia === hojeStr) { status = 'hoje'; prazoLabel = 'Hoje ' + (a.prazo?.slice(11, 16) || '') }
          else if (prazoDia === amStr) { prazoLabel = 'Amanhã ' + (a.prazo?.slice(11, 16) || '') }
          return { ...a, status, prazoLabel, clienteNome: neg?.fantasia || neg?.nome || neg?.titulo || '—' }
        })
        .sort((a, b) => {
          const ord = { atrasada: 0, hoje: 1, futura: 2 }
          return (ord[a.status] || 2) - (ord[b.status] || 2)
        })
        .slice(0, 6)

      setAtiv(ativsFormatadas)
      setLoading(false)
    }
    init()
  }, [router])

  const dataHoje = new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })

  const STATS_CARDS = [
    { label: 'Receita do Mês',       val: fmt(stats.receita),          sub: 'Total de mensalidades',     color: '#10b981', icon: '💰' },
    { label: 'Contratos Fechados',   val: String(stats.contratos),     sub: 'Este mês',                  color: '#00d4ff', icon: '📝' },
    { label: 'Leads no Funil',       val: String(stats.leads),         sub: 'Negócios em andamento',     color: '#7c3aed', icon: '🎯' },
    { label: 'KPI do Dia',           val: stats.kpiPct + '%',          sub: 'Meta diária acumulada',     color: '#f59e0b', icon: '📊' },
  ]

  if (loading) {
    return (
      <div style={{ background: '#0a0f1e', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b', fontFamily: 'DM Mono, monospace', fontSize: 14 }}>
        Carregando painel...
      </div>
    )
  }

  return (
    <>
      <Head>
        <title>{cfg.company || 'Vivanexa'} — Painel</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <link href="https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=DM+Mono:wght@300;400;500&display=swap" rel="stylesheet" />
      </Head>

      <style>{CSS}</style>

      <div className="orb orb1" />
      <div className="orb orb2" />

      {/* Navbar global */}
      <Navbar cfg={cfg} perfil={user} />

      <main className="dash-main">

        {/* ── Saudação ── */}
        <div className="dash-greeting">
          <div>
            <div className="dash-date">{dataHoje}</div>
            <h1 className="dash-title">Olá, {(user?.nome || 'Usuário').split(' ')[0]} 👋</h1>
            <p className="dash-sub">Bem-vindo ao painel Vivanexa. Tudo o que precisa está aqui.</p>
          </div>
          <div className="dash-top-actions">
            <button className="dash-btn-primary" onClick={() => router.push('/chat')}>
              💬 Abrir Assistente
            </button>
            <button className="dash-btn-secondary" onClick={() => router.push('/kpi')}>
              📊 Lançar KPIs
            </button>
          </div>
        </div>

        {/* ── Stats ── */}
        <div className="dash-stats">
          {STATS_CARDS.map((s, i) => (
            <div key={i} className="stat-card" style={{ '--sc': s.color }}>
              <div className="stat-icon">{s.icon}</div>
              <div className="stat-val">{s.val}</div>
              <div className="stat-label">{s.label}</div>
              <div className="stat-sub">{s.sub}</div>
            </div>
          ))}
        </div>

        {/* ── Grade principal ── */}
        <div className="dash-grid">

          {/* Acesso rápido por módulo */}
          <div className="dash-card">
            <div className="card-title">🚀 Acesso Rápido por Módulo</div>
            <div className="mod-grid">
              {MODULOS.map(m => (
                <div key={m.id} className="mod-card" style={{ '--mc': m.color }}
                  onClick={() => router.push(m.subs[0].href)}>
                  <div className="mod-icon">{m.icon}</div>
                  <div className="mod-name">{m.label}</div>
                  <div className="mod-count">{m.subs.length} funções</div>
                  <span className="mod-arrow">→</span>
                </div>
              ))}
            </div>
          </div>

          {/* Coluna lateral */}
          <div className="dash-side">

            {/* Atividades */}
            <div className="dash-card">
              <div className="card-title" style={{ marginBottom: 14 }}>
                📅 Atividades
                <button className="btn-link" onClick={() => router.push('/crm')}>Ver todas →</button>
              </div>
              {atividades.length === 0 ? (
                <div style={{ color: '#64748b', fontSize: 13, textAlign: 'center', padding: '20px 0' }}>
                  Nenhuma atividade pendente
                </div>
              ) : atividades.map((a, i) => (
                <div key={i} className={`ativ-row ativ-${a.status}`}>
                  <span className="ativ-tipo-badge">{a.tipo}</span>
                  <div className="ativ-info">
                    <div className="ativ-cliente">{a.clienteNome}</div>
                    {a.descricao && <div className="ativ-desc">{a.descricao}</div>}
                  </div>
                  <div className={`ativ-prazo ${a.status}`}>{a.prazoLabel}</div>
                </div>
              ))}
            </div>

            {/* Atalhos */}
            <div className="dash-card">
              <div className="card-title" style={{ marginBottom: 14 }}>⚡ Atalhos</div>
              <div className="atalhos-grid">
                {ATALHOS.map((a, i) => (
                  <button key={i} className="atalho-btn" onClick={() => router.push(a.href)}>
                    <span>{a.icon}</span>
                    <span>{a.label}</span>
                  </button>
                ))}
              </div>
            </div>

          </div>
        </div>

        {/* ── Todos os módulos expandidos ── */}
        <div className="dash-card" style={{ marginTop: 20 }}>
          <div className="card-title">🗂 Todos os Módulos</div>
          <div className="areas-grid">
            {MODULOS.map(m => (
              <div key={m.id} className="area-card" style={{ '--mc': m.color }}>
                <div className="area-header">
                  <span>{m.icon}</span>
                  <div>
                    <div className="area-name">{m.label}</div>
                    <div className="area-desc">{m.desc}</div>
                  </div>
                </div>
                <div className="area-body">
                  {m.subs.map(s => (
                    <button key={s.href} className="area-sub" onClick={() => router.push(s.href)}>
                      <span style={{ fontSize: 13 }}>{s.icon}</span>
                      <span className="area-sub-label">{s.label}</span>
                      <span className="area-sub-arrow">›</span>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

      </main>
    </>
  )
}

const CSS = `
  :root {
    --bg: #0a0f1e; --surface: #111827; --surface2: #1a2540;
    --border: #1e2d4a; --accent: #00d4ff; --accent2: #7c3aed;
    --accent3: #10b981; --text: #e2e8f0; --muted: #64748b;
    --danger: #ef4444; --gold: #f59e0b;
  }
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    background: var(--bg); color: var(--text);
    font-family: 'DM Mono', monospace; min-height: 100vh; overflow-x: hidden;
  }
  body::before {
    content: ''; position: fixed; inset: 0;
    background-image: linear-gradient(rgba(0,212,255,.018) 1px, transparent 1px),
      linear-gradient(90deg, rgba(0,212,255,.018) 1px, transparent 1px);
    background-size: 44px 44px; pointer-events: none; z-index: 0;
  }
  .orb { position: fixed; border-radius: 50%; filter: blur(130px); pointer-events: none; z-index: 0; opacity: .07; }
  .orb1 { width: 600px; height: 600px; background: var(--accent); top: -250px; right: -200px; }
  .orb2 { width: 450px; height: 450px; background: var(--accent2); bottom: -180px; left: -120px; }

  .dash-main { position: relative; z-index: 10; max-width: 1280px; margin: 0 auto; padding: 28px 20px 60px; }

  /* Saudação */
  .dash-greeting {
    display: flex; align-items: flex-start; justify-content: space-between;
    gap: 20px; margin-bottom: 24px; flex-wrap: wrap;
  }
  .dash-date { font-size: 11px; color: var(--muted); text-transform: capitalize; letter-spacing: 1px; margin-bottom: 4px; }
  .dash-title { font-family: 'Syne', sans-serif; font-size: 26px; font-weight: 800; color: var(--text); margin-bottom: 4px; }
  .dash-sub { font-size: 13px; color: var(--muted); }
  .dash-top-actions { display: flex; gap: 10px; flex-wrap: wrap; align-items: center; flex-shrink: 0; }
  .dash-btn-primary {
    display: flex; align-items: center; gap: 8px;
    padding: 11px 20px; background: linear-gradient(135deg, var(--accent), #0099bb);
    border: none; border-radius: 10px; color: #fff;
    font-family: 'DM Mono', monospace; font-size: 13px; font-weight: 600;
    cursor: pointer; transition: all .2s; white-space: nowrap;
  }
  .dash-btn-primary:hover { box-shadow: 0 0 20px rgba(0,212,255,.4); transform: translateY(-2px); }
  .dash-btn-secondary {
    display: flex; align-items: center; gap: 8px;
    padding: 11px 18px; background: var(--surface2);
    border: 1px solid var(--border); border-radius: 10px; color: var(--muted);
    font-family: 'DM Mono', monospace; font-size: 13px;
    cursor: pointer; transition: all .2s; white-space: nowrap;
  }
  .dash-btn-secondary:hover { border-color: var(--accent); color: var(--accent); }

  /* Stats */
  .dash-stats { display: grid; grid-template-columns: repeat(4, 1fr); gap: 14px; margin-bottom: 20px; }
  .stat-card {
    background: var(--surface); border: 1px solid var(--border); border-radius: 13px;
    padding: 18px; position: relative; overflow: hidden; transition: transform .2s;
  }
  .stat-card::before { content: ''; position: absolute; top: 0; left: 0; right: 0; height: 2px; background: var(--sc); }
  .stat-card:hover { transform: translateY(-2px); }
  .stat-icon { font-size: 20px; margin-bottom: 10px; }
  .stat-val { font-family: 'Syne', sans-serif; font-size: 22px; font-weight: 800; color: var(--sc); margin-bottom: 4px; }
  .stat-label { font-size: 10px; color: var(--text); font-weight: 500; text-transform: uppercase; letter-spacing: .8px; margin-bottom: 3px; }
  .stat-sub { font-size: 10px; color: var(--muted); }

  /* Grade */
  .dash-grid { display: grid; grid-template-columns: 1fr 320px; gap: 18px; align-items: start; }
  .dash-card { background: var(--surface); border: 1px solid var(--border); border-radius: 15px; padding: 20px; }
  .card-title {
    font-family: 'Syne', sans-serif; font-size: 13px; font-weight: 700; color: var(--text);
    margin-bottom: 16px; display: flex; align-items: center; justify-content: space-between;
  }
  .btn-link { background: none; border: none; color: var(--accent); font-family: 'DM Mono', monospace; font-size: 11px; cursor: pointer; padding: 0; }

  /* Módulos */
  .mod-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; }
  .mod-card {
    background: var(--surface2); border: 1px solid var(--border); border-radius: 11px;
    padding: 14px 12px; cursor: pointer; transition: all .18s; position: relative; overflow: hidden;
  }
  .mod-card:hover { border-color: var(--mc); transform: translateY(-2px); }
  .mod-card:hover .mod-arrow { opacity: 1; color: var(--mc); }
  .mod-icon { font-size: 22px; margin-bottom: 8px; }
  .mod-name { font-family: 'Syne', sans-serif; font-size: 11px; font-weight: 700; color: var(--text); margin-bottom: 2px; }
  .mod-count { font-size: 9px; color: var(--muted); }
  .mod-arrow { position: absolute; top: 10px; right: 10px; font-size: 13px; color: var(--muted); opacity: 0; transition: all .18s; }

  /* Side */
  .dash-side { display: flex; flex-direction: column; gap: 14px; }

  /* Atividades */
  .ativ-row {
    display: flex; align-items: flex-start; gap: 9px; padding: 9px;
    border-radius: 8px; margin-bottom: 5px; border: 1px solid transparent; transition: all .12s;
  }
  .ativ-row:hover { background: var(--surface2); }
  .ativ-row.ativ-hoje { border-color: rgba(245,158,11,.15); }
  .ativ-row.ativ-atrasada { border-color: rgba(239,68,68,.2); background: rgba(239,68,68,.04); }
  .ativ-tipo-badge {
    font-size: 9px; font-weight: 700; letter-spacing: .5px; text-transform: uppercase;
    color: var(--muted); background: var(--surface2); border: 1px solid var(--border);
    border-radius: 4px; padding: 2px 5px; white-space: nowrap; flex-shrink: 0; margin-top: 2px;
  }
  .ativ-info { flex: 1; min-width: 0; }
  .ativ-cliente { font-size: 12px; color: var(--text); font-weight: 500; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .ativ-desc { font-size: 10px; color: var(--muted); margin-top: 1px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .ativ-prazo { font-size: 10px; font-weight: 600; white-space: nowrap; flex-shrink: 0; margin-top: 2px; }
  .ativ-prazo.hoje { color: var(--gold); }
  .ativ-prazo.atrasada { color: var(--danger); }
  .ativ-prazo.futura { color: var(--muted); }

  /* Atalhos */
  .atalhos-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
  .atalho-btn {
    display: flex; align-items: center; gap: 7px; padding: 10px 11px;
    background: var(--surface2); border: 1px solid var(--border); border-radius: 9px;
    color: #94a3b8; font-family: 'DM Mono', monospace; font-size: 11px;
    cursor: pointer; transition: all .14s; text-align: left;
  }
  .atalho-btn:hover { border-color: var(--accent); color: var(--accent); background: rgba(0,212,255,.07); }

  /* Áreas */
  .areas-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; }
  .area-card { border: 1px solid var(--border); border-radius: 12px; overflow: hidden; transition: border-color .2s; }
  .area-card:hover { border-color: var(--mc); }
  .area-header {
    display: flex; align-items: center; gap: 10px; padding: 12px;
    border-bottom: 1px solid var(--border);
    background: color-mix(in srgb, var(--mc) 6%, var(--surface2));
    font-size: 18px;
  }
  .area-name { font-family: 'Syne', sans-serif; font-size: 11px; font-weight: 700; color: var(--mc); }
  .area-desc { font-size: 9.5px; color: var(--muted); margin-top: 1px; }
  .area-body { padding: 6px; }
  .area-sub {
    display: flex; align-items: center; gap: 6px; padding: 6px 8px; border-radius: 7px;
    cursor: pointer; font-size: 10.5px; color: #94a3b8; transition: all .12s;
    border: none; background: none; width: 100%; text-align: left; font-family: 'DM Mono', monospace;
  }
  .area-sub:hover { background: rgba(255,255,255,.04); color: var(--text); }
  .area-sub-label { flex: 1; }
  .area-sub-arrow { font-size: 13px; color: var(--muted); opacity: 0; transition: opacity .12s; }
  .area-sub:hover .area-sub-arrow { opacity: 1; }

  /* Responsive */
  @media (max-width: 1100px) {
    .areas-grid { grid-template-columns: repeat(3, 1fr); }
  }
  @media (max-width: 900px) {
    .dash-stats { grid-template-columns: repeat(2, 1fr); }
    .dash-grid { grid-template-columns: 1fr; }
    .mod-grid { grid-template-columns: repeat(3, 1fr); }
    .areas-grid { grid-template-columns: repeat(2, 1fr); }
  }
  @media (max-width: 600px) {
    .dash-title { font-size: 20px; }
    .dash-stats { grid-template-columns: 1fr 1fr; }
    .mod-grid { grid-template-columns: repeat(2, 1fr); }
    .areas-grid { grid-template-columns: 1fr; }
    .dash-greeting { flex-direction: column; }
    .dash-top-actions { width: 100%; }
    .dash-btn-primary, .dash-btn-secondary { flex: 1; justify-content: center; }
  }
`
