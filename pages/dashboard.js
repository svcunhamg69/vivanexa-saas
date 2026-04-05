// pages/dashboard.js — Painel Principal Vivanexa SaaS v4
// ✅ Sem grid de módulos (estão no menu)
// ✅ Foco: KPIs reais, atividades do CRM, atalhos rápidos
// ✅ Usa Navbar com botão Início

import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import Head from 'next/head'
import { supabase } from '../lib/supabase'
import Navbar from '../components/Navbar'

const fmt = n => 'R$ ' + Number(n || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })
const fmtK = v => v >= 1000 ? `R$ ${(v / 1000).toFixed(1)}k` : fmt(v)

const ATALHOS = [
  { label: 'Nova Proposta',       icon: '📄', href: '/chat',                        cor: '#00d4ff' },
  { label: 'Novo Contrato',       icon: '📝', href: '/chat',                        cor: '#00d4ff' },
  { label: 'Novo Lead (CRM)',     icon: '🎯', href: '/crm',                         cor: '#7c3aed' },
  { label: 'Lançar KPIs',         icon: '📊', href: '/kpi',                         cor: '#10b981' },
  { label: 'Ver Relatórios',      icon: '📈', href: '/reports?aba=estrategico',     cor: '#ec4899' },
  { label: 'Consulta Tributária', icon: '🔍', href: '/produtividade?aba=tributaria',cor: '#06b6d4' },
  { label: 'Emitir NF',          icon: '🧾', href: '/fiscal?aba=servico',          cor: '#f59e0b' },
  { label: 'Configurações',       icon: '⚙️', href: '/configuracoes?tab=empresa',   cor: '#94a3b8' },
]

export default function Dashboard() {
  const router  = useRouter()
  const [user,       setUser]      = useState(null)
  const [cfg,        setCfg]       = useState({})
  const [empresaId,  setEmpresaId] = useState(null)
  const [loading,    setLoading]   = useState(true)
  const [stats,      setStats]     = useState({ receita: 0, contratos: 0, leads: 0, kpiPct: 0 })
  const [atividades, setAtiv]      = useState([])

  useEffect(() => {
    async function init() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.replace('/'); return }

      let { data: perfil } = await supabase
        .from('perfis').select('*').eq('user_id', session.user.id).maybeSingle()

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
      setEmpresaId(eid)

      const { data: row } = await supabase
        .from('vx_storage').select('value').eq('key', `cfg:${eid}`).single()
      const c = row?.value ? JSON.parse(row.value) : {}
      setCfg(c)

      // ── Stats reais ──────────────────────────────────────────
      const mes       = new Date().toISOString().slice(0, 7)
      const historico = c.historico || []
      const histMes   = historico.filter(h => (h.date || '').startsWith(mes))
      const receita   = histMes.reduce((a, h) => a + Number(h.tMenD || h.mensalidade || 0), 0)
      const contratos = histMes.length
      const negocios  = c.crm_negocios || []
      const leads     = negocios.filter(n => n.etapa !== 'fechamento' && n.etapa !== 'perdido').length

      const hoje     = new Date().toISOString().slice(0, 10)
      const kpiLog   = (c.kpiLog || []).filter(l => l.userId === session.user.id && l.date === hoje)
      const kpiTpls  = c.kpiTemplates || []
      let kpiPct = 0
      if (kpiTpls.length && kpiLog.length) {
        const metas    = c.kpiDailyGoals?.[session.user.id] || {}
        let tMeta = 0, tReal = 0
        kpiTpls.forEach(k => {
          const meta = Number(metas[k.id] || 0)
          const real = Number(kpiLog.find(l => l.kpiId === k.id)?.realizado || 0)
          if (meta > 0) { tMeta += meta; tReal += Math.min(real, meta) }
        })
        kpiPct = tMeta > 0 ? Math.round((tReal / tMeta) * 100) : 0
      }
      setStats({ receita, contratos, leads, kpiPct })

      // ── Atividades do CRM ────────────────────────────────────
      const ativs    = c.crm_atividades || []
      const negMap   = {}
      negocios.forEach(n => { negMap[n.id] = n })
      const amanha   = new Date(); amanha.setDate(amanha.getDate() + 1)
      const amStr    = amanha.toISOString().slice(0, 10)

      const lista = ativs
        .filter(a => !a.concluida)
        .map(a => {
          const neg    = negMap[a.negocioId]
          const dia    = a.prazo ? a.prazo.slice(0, 10) : null
          let status   = 'futura'
          let prazoLabel = a.prazo
            ? new Date(a.prazo).toLocaleDateString('pt-BR', { day:'2-digit', month:'2-digit' }) + (a.prazo.slice(11,16) ? ' ' + a.prazo.slice(11,16) : '')
            : 'Sem prazo'
          if (dia && dia < hoje)      { status = 'atrasada'; prazoLabel = 'Atrasada' }
          else if (dia === hoje)      { status = 'hoje';     prazoLabel = 'Hoje ' + (a.prazo?.slice(11,16) || '') }
          else if (dia === amStr)     { prazoLabel = 'Amanhã ' + (a.prazo?.slice(11,16) || '') }
          return { ...a, status, prazoLabel, clienteNome: neg?.fantasia || neg?.nome || neg?.titulo || '—' }
        })
        .sort((a, b) => {
          const o = { atrasada: 0, hoje: 1, futura: 2 }
          return (o[a.status] ?? 2) - (o[b.status] ?? 2)
        })
        .slice(0, 8)

      setAtiv(lista)
      setLoading(false)
    }
    init()
  }, [router])

  const dataHoje = new Date().toLocaleDateString('pt-BR', {
    weekday: 'long', day: '2-digit', month: 'long', year: 'numeric'
  })

  const STATS = [
    { label: 'Receita do Mês',     val: fmtK(stats.receita),    sub: `${stats.contratos} contratos`,    cor: '#10b981', icon: '💰' },
    { label: 'Leads no Pipeline',  val: String(stats.leads),    sub: 'Em negociação',                   cor: '#7c3aed', icon: '🎯' },
    { label: 'KPI do Dia',         val: `${stats.kpiPct}%`,     sub: 'Meta diária acumulada',           cor: '#f59e0b', icon: '📊' },
    { label: 'Contratos no Mês',   val: String(stats.contratos),sub: 'Fechados este mês',               cor: '#00d4ff', icon: '📝' },
  ]

  if (loading) return (
    <div style={{ background: '#080d1a', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b', fontFamily: 'DM Mono,monospace' }}>
      Carregando painel...
    </div>
  )

  return (
    <>
      <Head>
        <title>{cfg.company || 'Vivanexa'} — Painel</title>
        <meta name="viewport" content="width=device-width,initial-scale=1" />
        <link href="https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=DM+Mono:wght@400;500&display=swap" rel="stylesheet" />
      </Head>
      <style>{CSS}</style>

      <div className="orb o1" /><div className="orb o2" />

      {/* Navbar com menu completo */}
      <Navbar cfg={cfg} perfil={user} />

      <main className="main">

        {/* ── Saudação ── */}
        <div className="greeting">
          <div>
            <div className="g-date">{dataHoje}</div>
            <h1 className="g-title">Olá, {(user?.nome || 'Usuário').split(' ')[0]} 👋</h1>
            <p className="g-sub">Bem-vindo ao painel Vivanexa — use o menu acima para navegar.</p>
          </div>
          <div className="g-actions">
            <button className="btn-p" onClick={() => router.push('/chat')}>💬 Abrir Assistente</button>
            <button className="btn-s" onClick={() => router.push('/kpi')}>📊 Lançar KPIs</button>
          </div>
        </div>

        {/* ── Cards de KPI ── */}
        <div className="stats">
          {STATS.map((s, i) => (
            <div key={i} className="stat" style={{ '--c': s.cor }}>
              <div className="stat-ico">{s.icon}</div>
              <div className="stat-val">{s.val}</div>
              <div className="stat-lbl">{s.label}</div>
              <div className="stat-sub">{s.sub}</div>
            </div>
          ))}
        </div>

        {/* ── Grade: Atividades + Atalhos ── */}
        <div className="grid2">

          {/* Atividades do CRM */}
          <div className="card">
            <div className="card-title">
              📅 Atividades Pendentes
              <button className="link-btn" onClick={() => router.push('/crm')}>Ver CRM →</button>
            </div>
            {atividades.length === 0 ? (
              <div className="empty">
                <span style={{ fontSize: 32 }}>✅</span>
                <p>Nenhuma atividade pendente</p>
                <button className="btn-s" style={{ marginTop: 8 }} onClick={() => router.push('/crm')}>Abrir CRM</button>
              </div>
            ) : atividades.map((a, i) => (
              <div key={i} className={`ativ ativ-${a.status}`}>
                <div className="ativ-left">
                  <span className={`ativ-badge badge-${a.status}`}>{a.tipo}</span>
                  <div>
                    <div className="ativ-cliente">{a.clienteNome}</div>
                    {a.descricao && <div className="ativ-desc">{a.descricao}</div>}
                  </div>
                </div>
                <div className={`ativ-prazo prazo-${a.status}`}>{a.prazoLabel}</div>
              </div>
            ))}
          </div>

          {/* Atalhos rápidos */}
          <div className="card">
            <div className="card-title">⚡ Atalhos Rápidos</div>
            <div className="atalhos">
              {ATALHOS.map((a, i) => (
                <button
                  key={i}
                  className="atalho"
                  style={{ '--ac': a.cor }}
                  onClick={() => router.push(a.href)}
                >
                  <span className="atalho-icon">{a.icon}</span>
                  <span className="atalho-label">{a.label}</span>
                  <span className="atalho-arr">›</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* ── Linha extra: últimos contratos ── */}
        <div className="card" style={{ marginTop: 20 }}>
          <div className="card-title">
            📋 Últimos Contratos Fechados
            <button className="link-btn" onClick={() => router.push('/reports?aba=vendas')}>Ver relatório →</button>
          </div>
          {(cfg.historico || []).length === 0 ? (
            <div className="empty">
              <span style={{ fontSize: 32 }}>📄</span>
              <p>Nenhum contrato registrado ainda</p>
              <button className="btn-p" style={{ marginTop: 8 }} onClick={() => router.push('/chat')}>Gerar primeira proposta</button>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table className="tabela">
                <thead>
                  <tr>
                    <th>Cliente</th>
                    <th>Plano</th>
                    <th>Mensalidade</th>
                    <th>Adesão</th>
                    <th>Consultor</th>
                    <th>Data</th>
                  </tr>
                </thead>
                <tbody>
                  {[...(cfg.historico || [])].reverse().slice(0, 8).map((h, i) => (
                    <tr key={i}>
                      <td>{h.clientName || h.nome || '—'}</td>
                      <td><span className="badge-plan">{h.plan || '—'}</span></td>
                      <td style={{ color: '#10b981', fontWeight: 700 }}>{fmt(h.tMenD || h.mensalidade || 0)}</td>
                      <td style={{ color: '#00d4ff' }}>{fmt(h.tAdD || h.adesao || 0)}</td>
                      <td style={{ color: '#94a3b8' }}>{h.consultor || h.userName || '—'}</td>
                      <td style={{ color: '#64748b' }}>{h.date ? new Date(h.date).toLocaleDateString('pt-BR') : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

      </main>
    </>
  )
}

const CSS = `
  :root{--bg:#080d1a;--surface:#0f1826;--s2:#162032;--border:#18243a;--accent:#00d4ff;--text:#e2e8f0;--muted:#64748b}
  *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
  body{background:var(--bg);color:var(--text);font-family:'DM Mono',monospace;min-height:100vh;overflow-x:hidden}
  body::before{content:'';position:fixed;inset:0;background-image:linear-gradient(rgba(0,212,255,.015) 1px,transparent 1px),linear-gradient(90deg,rgba(0,212,255,.015) 1px,transparent 1px);background-size:44px 44px;pointer-events:none;z-index:0}

  .orb{position:fixed;border-radius:50%;filter:blur(140px);pointer-events:none;z-index:0;opacity:.06}
  .o1{width:600px;height:600px;background:#00d4ff;top:-260px;right:-200px}
  .o2{width:450px;height:450px;background:#7c3aed;bottom:-180px;left:-120px}

  .main{position:relative;z-index:10;max-width:1280px;margin:0 auto;padding:28px 20px 60px}

  /* Saudação */
  .greeting{display:flex;align-items:flex-start;justify-content:space-between;gap:20px;margin-bottom:24px;flex-wrap:wrap}
  .g-date{font-size:11px;color:var(--muted);text-transform:capitalize;letter-spacing:1px;margin-bottom:4px}
  .g-title{font-family:'Syne',sans-serif;font-size:26px;font-weight:800;margin-bottom:4px}
  .g-sub{font-size:13px;color:var(--muted)}
  .g-actions{display:flex;gap:10px;align-items:center;flex-wrap:wrap;flex-shrink:0}

  /* Botões */
  .btn-p{display:flex;align-items:center;gap:8px;padding:11px 20px;background:linear-gradient(135deg,#00d4ff,#0099bb);border:none;border-radius:10px;color:#fff;font-family:'DM Mono',monospace;font-size:13px;font-weight:600;cursor:pointer;transition:all .2s;white-space:nowrap}
  .btn-p:hover{box-shadow:0 0 20px rgba(0,212,255,.4);transform:translateY(-2px)}
  .btn-s{display:flex;align-items:center;gap:8px;padding:11px 18px;background:var(--s2);border:1px solid var(--border);border-radius:10px;color:var(--muted);font-family:'DM Mono',monospace;font-size:13px;cursor:pointer;transition:all .2s;white-space:nowrap}
  .btn-s:hover{border-color:var(--accent);color:var(--accent)}

  /* Stats */
  .stats{display:grid;grid-template-columns:repeat(4,1fr);gap:14px;margin-bottom:20px}
  .stat{background:var(--surface);border:1px solid var(--border);border-radius:13px;padding:18px;position:relative;overflow:hidden;transition:transform .2s}
  .stat::before{content:'';position:absolute;top:0;left:0;right:0;height:2px;background:var(--c)}
  .stat:hover{transform:translateY(-2px)}
  .stat-ico{font-size:20px;margin-bottom:10px}
  .stat-val{font-family:'Syne',sans-serif;font-size:23px;font-weight:800;color:var(--c);margin-bottom:4px}
  .stat-lbl{font-size:10px;color:var(--text);text-transform:uppercase;letter-spacing:.8px;margin-bottom:3px}
  .stat-sub{font-size:10px;color:var(--muted)}

  /* Grade 2 colunas */
  .grid2{display:grid;grid-template-columns:1fr 360px;gap:20px;align-items:start}

  /* Card */
  .card{background:var(--surface);border:1px solid var(--border);border-radius:15px;padding:20px}
  .card-title{font-family:'Syne',sans-serif;font-size:14px;font-weight:700;margin-bottom:16px;display:flex;align-items:center;justify-content:space-between}
  .link-btn{background:none;border:none;color:var(--accent);font-family:'DM Mono',monospace;font-size:11px;cursor:pointer;padding:0}
  .link-btn:hover{opacity:.7}
  .empty{text-align:center;padding:28px 0;color:var(--muted);font-size:13px;display:flex;flex-direction:column;align-items:center;gap:8px}

  /* Atividades */
  .ativ{display:flex;align-items:flex-start;justify-content:space-between;gap:10px;padding:10px 10px;border-radius:9px;margin-bottom:6px;border:1px solid transparent;transition:all .13s}
  .ativ:hover{background:var(--s2)}
  .ativ-atrasada{border-color:rgba(239,68,68,.2);background:rgba(239,68,68,.04)}
  .ativ-hoje{border-color:rgba(245,158,11,.15)}
  .ativ-left{display:flex;align-items:flex-start;gap:9px;flex:1;min-width:0}
  .ativ-badge{font-size:9px;font-weight:700;letter-spacing:.5px;text-transform:uppercase;padding:3px 7px;border-radius:5px;white-space:nowrap;flex-shrink:0;margin-top:1px}
  .badge-atrasada{background:rgba(239,68,68,.15);color:#ef4444;border:1px solid rgba(239,68,68,.3)}
  .badge-hoje{background:rgba(245,158,11,.15);color:#f59e0b;border:1px solid rgba(245,158,11,.3)}
  .badge-futura{background:rgba(100,116,139,.1);color:#64748b;border:1px solid rgba(100,116,139,.2)}
  .ativ-cliente{font-size:12px;font-weight:600;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .ativ-desc{font-size:10px;color:var(--muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .ativ-prazo{font-size:11px;font-weight:600;white-space:nowrap;flex-shrink:0}
  .prazo-atrasada{color:#ef4444}
  .prazo-hoje{color:#f59e0b}
  .prazo-futura{color:var(--muted)}

  /* Atalhos */
  .atalhos{display:flex;flex-direction:column;gap:7px}
  .atalho{display:flex;align-items:center;gap:10px;padding:11px 14px;background:var(--s2);border:1px solid var(--border);border-radius:10px;color:#94a3b8;font-family:'DM Mono',monospace;font-size:12px;cursor:pointer;transition:all .15s;text-align:left}
  .atalho:hover{border-color:var(--ac);color:var(--ac);background:color-mix(in srgb,var(--ac) 8%,var(--s2))}
  .atalho-icon{font-size:16px;width:20px;text-align:center;flex-shrink:0}
  .atalho-label{flex:1}
  .atalho-arr{font-size:16px;color:var(--muted);opacity:0;transition:opacity .14s}
  .atalho:hover .atalho-arr{opacity:1}

  /* Tabela */
  .tabela{width:100%;border-collapse:collapse;font-size:12px;min-width:540px}
  .tabela th{padding:8px 12px;text-align:left;font-size:10px;color:var(--muted);text-transform:uppercase;letter-spacing:1px;border-bottom:1px solid var(--border);font-weight:500}
  .tabela td{padding:10px 12px;border-bottom:1px solid var(--border);color:var(--text)}
  .tabela tr:last-child td{border-bottom:none}
  .tabela tr:hover td{background:var(--s2)}
  .badge-plan{background:rgba(0,212,255,.1);color:var(--accent);border:1px solid rgba(0,212,255,.25);padding:2px 8px;border-radius:20px;font-size:10px;font-weight:700}

  /* Responsivo */
  @media(max-width:1024px){.stats{grid-template-columns:repeat(2,1fr)}.grid2{grid-template-columns:1fr}}
  @media(max-width:600px){.stats{grid-template-columns:1fr 1fr}.g-title{font-size:20px}.greeting{flex-direction:column}.g-actions{width:100%}.btn-p,.btn-s{flex:1;justify-content:center}}
`
