// pages/reports.js — Relatórios Vivanexa SaaS
import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import { supabase } from '../lib/supabase'

const fmt = n => 'R$ ' + Number(n || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const fmtK = v => v >= 1000 ? `R$ ${(v / 1000).toFixed(1)}k` : fmt(v)

function mesAtual() { return new Date().toISOString().slice(0, 7) }
function diasUteisNoMes(ym) {
  const [y, m] = ym.split('-').map(Number)
  const dias = new Date(y, m, 0).getDate()
  let u = 0
  for (let d = 1; d <= dias; d++) { const dw = new Date(y, m - 1, d).getDay(); if (dw !== 0 && dw !== 6) u++ }
  return u
}
function dateToMonth(s) {
  if (!s) return ''
  try {
    if (s.includes('T') || s.match(/^\d{4}-/)) return s.slice(0, 7)
    const p = s.split('/'); if (p.length >= 3) return `${p[2].slice(0, 4)}-${p[1].padStart(2, '0')}`
  } catch { }
  return ''
}

// ── Cabeçalho ──────────────────────────────────────────────────
function Header({ cfg, perfil, router }) {
  const logoSrc = cfg.logob64
    ? (cfg.logob64.startsWith('data:') ? cfg.logob64 : `data:image/png;base64,${cfg.logob64}`)
    : null
  return (
    <header style={{ position: 'sticky', top: 0, zIndex: 100, background: 'rgba(10,15,30,.9)', backdropFilter: 'blur(12px)', borderBottom: '1px solid var(--border)', padding: '10px 20px' }}>
      <div style={{ maxWidth: 1100, margin: '0 auto', display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }} onClick={() => router.push('/chat')}>
          {logoSrc
            ? <img src={logoSrc} alt={cfg.company} style={{ height: 34, objectFit: 'contain', borderRadius: 6 }} onError={e => e.target.style.display = 'none'} />
            : <span style={{ fontFamily: 'Syne, sans-serif', fontSize: 15, fontWeight: 700 }}>{cfg.company || 'Vivanexa'}</span>}
        </div>
        <span style={{ fontSize: 13, color: 'var(--accent)', fontFamily: 'Syne, sans-serif', fontWeight: 700, marginLeft: 4 }}>📈 Relatórios</span>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 6, alignItems: 'center' }}>
          {[{ label: '💬 Chat', path: '/chat' }, { label: '📊 Dashboard', path: '/dashboard' }, { label: '⚙️ Config', path: '/configuracoes' }].map(b => (
            <button key={b.path} onClick={() => router.push(b.path)}
              style={{ background: 'var(--surface2)', border: '1px solid var(--border)', cursor: 'pointer', color: 'var(--muted)', fontSize: 11, padding: '5px 11px', borderRadius: 8, fontFamily: 'DM Mono, monospace' }}>
              {b.label}
            </button>
          ))}
          {perfil?.nome && <span style={{ fontSize: 11, color: 'var(--muted)' }}>👤 <span style={{ color: 'var(--text)' }}>{perfil.nome}</span></span>}
          <button onClick={() => supabase.auth.signOut().then(() => router.push('/'))}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', fontSize: 11, fontFamily: 'DM Mono, monospace' }}>Sair</button>
        </div>
      </div>
    </header>
  )
}

// ── Tabela genérica ─────────────────────────────────────────────
function Tabela({ cols, rows, emptyMsg = 'Nenhum dado encontrado.' }) {
  if (!rows || rows.length === 0) return (
    <div style={{ textAlign: 'center', padding: '30px 0', color: 'var(--muted)', fontSize: 13 }}>{emptyMsg}</div>
  )
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
        <thead>
          <tr style={{ borderBottom: '1px solid var(--border)' }}>
            {cols.map(c => <th key={c.key} style={{ padding: '8px 12px', textAlign: c.right ? 'right' : 'left', color: 'var(--muted)', fontWeight: 500, fontSize: 11, textTransform: 'uppercase', letterSpacing: '.8px', whiteSpace: 'nowrap' }}>{c.label}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} style={{ borderBottom: '1px solid var(--border)', background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,.01)' }}>
              {cols.map(c => <td key={c.key} style={{ padding: '9px 12px', textAlign: c.right ? 'right' : 'left', color: c.color || 'var(--text)', fontWeight: c.bold ? 600 : 400, whiteSpace: c.nowrap ? 'nowrap' : 'normal' }}>{row[c.key] ?? '—'}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ── Card de resumo ──────────────────────────────────────────────
function CardResumo({ label, valor, cor, sub }) {
  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '16px 18px' }}>
      <div style={{ fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.8px', marginBottom: 6 }}>{label}</div>
      <div style={{ fontFamily: 'Syne, sans-serif', fontSize: 20, fontWeight: 800, color: cor || 'var(--accent)' }}>{valor}</div>
      {sub && <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>{sub}</div>}
    </div>
  )
}

// ══════════════════════════════════════════════════════════════
// PÁGINA PRINCIPAL
// ══════════════════════════════════════════════════════════════
export default function Reports() {
  const router = useRouter()
  const [loading, setLoading]     = useState(true)
  const [perfil,  setPerfil]      = useState(null)
  const [cfg,     setCfg]         = useState({})
  const [aba,     setAba]         = useState('documentos')
  const [mes,     setMes]         = useState(mesAtual())
  const [busca,   setBusca]       = useState('')
  const [filtroTipo, setFiltroTipo] = useState('todos')

  useEffect(() => {
    async function init() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.push('/'); return }
      let { data: perf } = await supabase.from('perfis').select('*').eq('user_id', session.user.id).maybeSingle()
      if (!perf) { router.push('/'); return }
      setPerfil(perf)
      const eid = perf.empresa_id || session.user.id
      const { data: row } = await supabase.from('vx_storage').select('value').eq('key', `cfg:${eid}`).single()
      if (row?.value) {
        try { setCfg(JSON.parse(row.value)) } catch {}
      }
      setLoading(false)
    }
    init()
  }, [])

  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0a0f1e', color: '#64748b', fontFamily: 'DM Mono, monospace' }}>
      Carregando relatórios...
    </div>
  )

  const isAdmin     = perfil?.perfil === 'admin'
  const usuarios    = cfg.users || []
  const docHistory  = cfg.docHistory || []
  const kpiTemplates= cfg.kpiTemplates || []
  const kpiLog      = cfg.kpiLog || []
  const kpiGoals    = cfg.kpiDailyGoals || {}
  const goals       = cfg.goals || []
  const vouchers    = cfg.vouchers || []

  // Usuário atual
  const usuarioAtual = usuarios.find(u => u?.email === perfil?.email) || usuarios[0] || {}
  const userId = usuarioAtual?.id || usuarioAtual?.username || perfil?.user_id || ''

  // ── Filtros ──────────────────────────────────────────────────
  let docsFiltrados = docHistory.filter(d => {
    if (!d) return false
    if (!isAdmin && !entryBelongsToUser(d, userId, usuarios)) return false
    const dm = dateToMonth(d.criado || d.dateISO || d.date || '')
    if (mes && dm !== mes) return false
    if (filtroTipo !== 'todos' && d.type !== filtroTipo) return false
    if (busca.trim()) {
      const b = busca.toLowerCase()
      return (d.clientName || d.cliente || '').toLowerCase().includes(b) ||
             (d.consultor || '').toLowerCase().includes(b)
    }
    return true
  })

  function entryBelongsToUser(h, uid, users) {
    if (!h || !uid) return false
    if (h.userId === uid) return true
    if (h.consultantId === uid) return true
    const u = (users || []).find(u2 => (u2.id || u2.username) === uid)
    if (u && (h.consultor === u.nome || h.consultorEmail === u.email)) return true
    return false
  }

  // ── Totais do mês ────────────────────────────────────────────
  const totaisMes = (() => {
    const docs = isAdmin
      ? docHistory.filter(d => d && dateToMonth(d.criado || d.dateISO || '') === mes)
      : docHistory.filter(d => d && dateToMonth(d.criado || d.dateISO || '') === mes && entryBelongsToUser(d, userId, usuarios))
    const contratos = docs.filter(d => d.type === 'contrato')
    const propostas = docs.filter(d => d.type === 'proposta')
    const assinados = contratos.filter(d => d.status === 'signed')
    return {
      contratos: contratos.length,
      propostas: propostas.length,
      assinados: assinados.length,
      adesao: contratos.reduce((a, d) => a + (Number(d.tAd || d.adesao) || 0), 0),
      mensalidade: contratos.reduce((a, d) => a + (Number(d.tMen || d.mensalidade) || 0), 0),
      adesaoAssinada: assinados.reduce((a, d) => a + (Number(d.tAd || d.adesao) || 0), 0),
    }
  })()

  // ── Dados KPI ────────────────────────────────────────────────
  const kpiMesData = (() => {
    const uid = userId
    return kpiTemplates.map(kpi => {
      if (!kpi) return null
      const logs = kpiLog.filter(l => l && l.kpiId === kpi.id && l.userId === uid && l.date && l.date.startsWith(mes))
      const realizado = logs.reduce((a, l) => a + (Number(l.realizado) || 0), 0)
      const diaria = Number(kpiGoals[uid]?.[kpi.id] || 0)
      const meta = diaria * diasUteisNoMes(mes)
      const pct = meta > 0 ? Math.min(100, Math.round((realizado / meta) * 100)) : null
      return { id: kpi.id, nome: kpi.nome, icone: kpi.icone || '📊', realizado, meta, pct, unidade: kpi.unidade || 'un' }
    }).filter(Boolean)
  })()

  // ── Relatório por vendedor (admin) ───────────────────────────
  const rankingVendedores = (() => {
    if (!isAdmin) return []
    return usuarios.filter(u => u).map(u => {
      const uid = u.id || u.username
      const docs = docHistory.filter(d => d && dateToMonth(d.criado || d.dateISO || '') === mes && entryBelongsToUser(d, uid, usuarios))
      const contratos = docs.filter(d => d.type === 'contrato')
      const assinados = contratos.filter(d => d.status === 'signed')
      const adesao = contratos.reduce((a, d) => a + (Number(d.tAd || d.adesao) || 0), 0)
      const mensalidade = contratos.reduce((a, d) => a + (Number(d.tMen || d.mensalidade) || 0), 0)
      const metaGoal = goals.find(g => g?.userId === uid && g?.mes === mes) || {}
      const metaAd = Number(metaGoal.metaAdesao || 0)
      const metaMen = Number(metaGoal.metaMensalidade || 0)
      // KPIs do vendedor
      const kpisUser = kpiTemplates.map(kpi => {
        if (!kpi) return null
        const real = kpiLog.filter(l => l && l.kpiId === kpi.id && l.userId === uid && l.date?.startsWith(mes))
          .reduce((a, l) => a + (Number(l.realizado) || 0), 0)
        return { nome: kpi.nome, icone: kpi.icone, real }
      }).filter(Boolean)
      return {
        nome: u.nome, email: u.email, tipo: u.tipo,
        contratos: contratos.length, assinados: assinados.length,
        adesao, mensalidade, metaAd, metaMen,
        pctAd: metaAd > 0 ? Math.min(100, Math.round(adesao / metaAd * 100)) : null,
        pctMen: metaMen > 0 ? Math.min(100, Math.round(mensalidade / metaMen * 100)) : null,
        kpis: kpisUser
      }
    }).sort((a, b) => (b.adesao + b.mensalidade) - (a.adesao + a.mensalidade))
  })()

  // ── Rows para tabela de documentos ──────────────────────────
  const rowsDocs = docsFiltrados.map(d => ({
    tipo: d.type === 'contrato' ? '📝 Contrato' : '📄 Proposta',
    cliente: d.clientName || d.cliente || '—',
    consultor: d.consultor || '—',
    data: d.criado ? new Date(d.criado).toLocaleDateString('pt-BR') : (d.date || '—'),
    adesao: d.tAd || d.adesao ? fmt(Number(d.tAd || d.adesao)) : '—',
    mensalidade: d.tMen || d.mensalidade ? fmt(Number(d.tMen || d.mensalidade)) : '—',
    status: d.status === 'signed' ? '✅ Assinado' : d.status === 'pending' ? '⏳ Pendente' : d.status === 'sent' ? '📤 Enviado' : '📝 Rascunho',
  }))

  const ABAS = [
    { id: 'documentos', label: '📄 Documentos' },
    { id: 'kpis',       label: '🎯 KPIs' },
    { id: 'vendedores', label: '👥 Por Vendedor' },
    { id: 'vouchers',   label: '🎫 Vouchers' },
  ]

  const SEC = ({ title, children }) => (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: '20px 24px', marginBottom: 16, boxShadow: '0 4px 24px rgba(0,0,0,.3)' }}>
      {title && <div style={{ fontFamily: 'Syne, sans-serif', fontSize: 15, fontWeight: 700, color: 'var(--accent)', marginBottom: 16 }}>{title}</div>}
      {children}
    </div>
  )

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=DM+Mono:wght@300;400;500&display=swap');
        :root{--bg:#0a0f1e;--surface:#111827;--surface2:#1a2540;--border:#1e2d4a;--accent:#00d4ff;--accent2:#7c3aed;--accent3:#10b981;--text:#e2e8f0;--muted:#64748b;--danger:#ef4444;--warning:#f59e0b;--gold:#fbbf24}
        *{box-sizing:border-box;margin:0;padding:0}
        body{font-family:'DM Mono',monospace;background:var(--bg);color:var(--text);min-height:100vh}
        ::-webkit-scrollbar{width:4px}::-webkit-scrollbar-thumb{background:var(--border);border-radius:4px}
      `}</style>

      <Header cfg={cfg} perfil={perfil} router={router} />

      <main style={{ maxWidth: 1100, margin: '24px auto 60px', padding: '0 20px' }}>

        {/* Filtros de topo */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {ABAS.map(a => (
              <button key={a.id} onClick={() => setAba(a.id)}
                style={{ padding: '7px 14px', borderRadius: 8, border: `1px solid ${aba === a.id ? 'var(--accent)' : 'var(--border)'}`, background: aba === a.id ? 'rgba(0,212,255,.1)' : 'var(--surface2)', color: aba === a.id ? 'var(--accent)' : 'var(--muted)', fontFamily: 'DM Mono, monospace', fontSize: 12, cursor: 'pointer', fontWeight: aba === a.id ? 600 : 400 }}>
                {a.label}
              </button>
            ))}
          </div>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
            <span style={{ fontSize: 12, color: 'var(--muted)' }}>Mês:</span>
            <input type="month" value={mes} onChange={e => setMes(e.target.value)}
              style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 8, padding: '6px 10px', fontFamily: 'DM Mono, monospace', fontSize: 12, color: 'var(--text)', outline: 'none' }} />
          </div>
        </div>

        {/* Cards de resumo */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginBottom: 20 }}>
          <CardResumo label="📝 Contratos" valor={totaisMes.contratos} cor="var(--accent)" sub={`${totaisMes.assinados} assinados`} />
          <CardResumo label="📄 Propostas" valor={totaisMes.propostas} cor="var(--accent2)" />
          <CardResumo label="💰 Adesão" valor={fmtK(totaisMes.adesao)} cor="var(--gold)" sub={`Assinada: ${fmtK(totaisMes.adesaoAssinada)}`} />
          <CardResumo label="📅 Mensalidade" valor={fmtK(totaisMes.mensalidade)} cor="var(--accent3)" />
        </div>

        {/* ── ABA DOCUMENTOS ── */}
        {aba === 'documentos' && (
          <>
            <SEC title={null}>
              <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
                <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="🔍 Buscar cliente ou consultor..."
                  style={{ flex: 1, minWidth: 200, background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 12px', fontFamily: 'DM Mono, monospace', fontSize: 12, color: 'var(--text)', outline: 'none' }} />
                {['todos', 'contrato', 'proposta'].map(t => (
                  <button key={t} onClick={() => setFiltroTipo(t)}
                    style={{ padding: '7px 14px', borderRadius: 8, border: `1px solid ${filtroTipo === t ? 'var(--accent)' : 'var(--border)'}`, background: filtroTipo === t ? 'rgba(0,212,255,.1)' : 'var(--surface2)', color: filtroTipo === t ? 'var(--accent)' : 'var(--muted)', fontFamily: 'DM Mono, monospace', fontSize: 12, cursor: 'pointer' }}>
                    {t === 'todos' ? 'Todos' : t === 'contrato' ? '📝 Contratos' : '📄 Propostas'}
                  </button>
                ))}
              </div>
              <Tabela
                cols={[
                  { key: 'tipo',        label: 'Tipo',        nowrap: true },
                  { key: 'cliente',     label: 'Cliente' },
                  { key: 'consultor',   label: 'Consultor' },
                  { key: 'data',        label: 'Data',        nowrap: true },
                  { key: 'adesao',      label: 'Adesão',      right: true, color: 'var(--accent)', bold: true },
                  { key: 'mensalidade', label: 'Mensalidade', right: true, color: 'var(--accent3)', bold: true },
                  { key: 'status',      label: 'Status',      nowrap: true },
                ]}
                rows={rowsDocs}
                emptyMsg="Nenhum documento encontrado para este período."
              />
              {rowsDocs.length > 0 && (
                <div style={{ marginTop: 12, padding: '10px 14px', background: 'var(--surface2)', borderRadius: 8, fontSize: 12, display: 'flex', gap: 20, flexWrap: 'wrap' }}>
                  <span>Total: <strong style={{ color: 'var(--text)' }}>{rowsDocs.length} registros</strong></span>
                  <span>Adesão: <strong style={{ color: 'var(--accent)' }}>{fmt(docsFiltrados.reduce((a, d) => a + (Number(d.tAd || d.adesao) || 0), 0))}</strong></span>
                  <span>Mensalidade: <strong style={{ color: 'var(--accent3)' }}>{fmt(docsFiltrados.reduce((a, d) => a + (Number(d.tMen || d.mensalidade) || 0), 0))}</strong></span>
                </div>
              )}
            </SEC>
          </>
        )}

        {/* ── ABA KPIs ── */}
        {aba === 'kpis' && (
          <>
            {kpiMesData.length === 0 ? (
              <SEC>
                <div style={{ textAlign: 'center', padding: '30px 0', color: 'var(--muted)' }}>
                  Nenhum KPI configurado. Configure em <strong>Configurações → KPIs</strong>.
                </div>
              </SEC>
            ) : (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12, marginBottom: 16 }}>
                  {kpiMesData.map(k => (
                    <div key={k.id} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '16px 18px' }}>
                      <div style={{ fontSize: 24, marginBottom: 6 }}>{k.icone}</div>
                      <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 4 }}>{k.nome}</div>
                      <div style={{ fontFamily: 'Syne, sans-serif', fontSize: 24, fontWeight: 800, color: k.pct >= 100 ? 'var(--accent3)' : k.pct >= 60 ? 'var(--accent)' : 'var(--text)' }}>
                        {k.realizado}<span style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 400, marginLeft: 4 }}>{k.unidade}</span>
                      </div>
                      {k.meta > 0 && (
                        <>
                          <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>Meta: {k.meta} {k.unidade}</div>
                          <div style={{ marginTop: 8, height: 4, background: 'var(--border)', borderRadius: 2, overflow: 'hidden' }}>
                            <div style={{ height: '100%', width: `${k.pct}%`, background: k.pct >= 100 ? 'var(--accent3)' : k.pct >= 60 ? 'var(--accent)' : 'var(--warning)', borderRadius: 2 }} />
                          </div>
                          <div style={{ fontSize: 11, color: k.pct >= 100 ? 'var(--accent3)' : 'var(--muted)', marginTop: 4, textAlign: 'right', fontWeight: 600 }}>{k.pct}%</div>
                        </>
                      )}
                    </div>
                  ))}
                </div>

                {/* Lançamentos do mês */}
                <SEC title="📅 Lançamentos do Mês">
                  <Tabela
                    cols={[
                      { key: 'data',  label: 'Data',     nowrap: true },
                      { key: 'kpi',   label: 'KPI' },
                      { key: 'qtd',   label: 'Realizado', right: true, color: 'var(--accent3)', bold: true },
                    ]}
                    rows={kpiLog
                      .filter(l => l && l.userId === userId && l.date?.startsWith(mes))
                      .sort((a, b) => b.date.localeCompare(a.date))
                      .map(l => {
                        const kpi = kpiTemplates.find(k => k?.id === l.kpiId)
                        return { data: new Date(l.date).toLocaleDateString('pt-BR'), kpi: `${kpi?.icone || '📊'} ${kpi?.nome || 'KPI'}`, qtd: `${l.realizado} ${kpi?.unidade || 'un'}` }
                      })}
                    emptyMsg="Nenhum lançamento de KPI neste mês."
                  />
                </SEC>

                {/* KPIs por dia (tabela) */}
                {isAdmin && (
                  <SEC title="📊 KPIs por Vendedor">
                    <Tabela
                      cols={[
                        { key: 'vendedor', label: 'Vendedor' },
                        ...kpiTemplates.filter(Boolean).map(k => ({ key: k.id, label: `${k.icone} ${k.nome}`, right: true }))
                      ]}
                      rows={usuarios.filter(u => u).map(u => {
                        const uid = u.id || u.username
                        const row = { vendedor: u.nome }
                        kpiTemplates.filter(Boolean).forEach(k => {
                          const real = kpiLog.filter(l => l && l.kpiId === k.id && l.userId === uid && l.date?.startsWith(mes))
                            .reduce((a, l) => a + (Number(l.realizado) || 0), 0)
                          row[k.id] = `${real} ${k.unidade || 'un'}`
                        })
                        return row
                      })}
                      emptyMsg="Nenhum usuário cadastrado."
                    />
                  </SEC>
                )}
              </>
            )}
          </>
        )}

        {/* ── ABA POR VENDEDOR ── */}
        {aba === 'vendedores' && (
          <>
            {!isAdmin ? (
              <SEC>
                <div style={{ textAlign: 'center', padding: '20px 0', color: 'var(--muted)', fontSize: 13 }}>
                  Esta aba está disponível apenas para administradores.
                </div>
              </SEC>
            ) : rankingVendedores.length === 0 ? (
              <SEC>
                <div style={{ textAlign: 'center', padding: '30px 0', color: 'var(--muted)' }}>
                  Nenhum vendedor cadastrado.
                </div>
              </SEC>
            ) : (
              rankingVendedores.map((v, i) => (
                <SEC key={v.email} title={null}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                    <span style={{ fontSize: 24 }}>{i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`}</span>
                    <div>
                      <div style={{ fontFamily: 'Syne, sans-serif', fontSize: 16, fontWeight: 700 }}>{v.nome}</div>
                      <div style={{ fontSize: 11, color: 'var(--muted)' }}>{v.email} · {v.tipo || 'vendedor'}</div>
                    </div>
                    <div style={{ marginLeft: 'auto', display: 'flex', gap: 16 }}>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: 18, fontWeight: 800, fontFamily: 'Syne, sans-serif', color: 'var(--accent)' }}>{fmtK(v.adesao)}</div>
                        <div style={{ fontSize: 10, color: 'var(--muted)' }}>Adesão{v.pctAd !== null ? ` (${v.pctAd}%)` : ''}</div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: 18, fontWeight: 800, fontFamily: 'Syne, sans-serif', color: 'var(--accent3)' }}>{fmtK(v.mensalidade)}</div>
                        <div style={{ fontSize: 10, color: 'var(--muted)' }}>Mensalidade{v.pctMen !== null ? ` (${v.pctMen}%)` : ''}</div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: 18, fontWeight: 800, fontFamily: 'Syne, sans-serif', color: 'var(--gold)' }}>{v.contratos}</div>
                        <div style={{ fontSize: 10, color: 'var(--muted)' }}>Contratos ({v.assinados} ass.)</div>
                      </div>
                    </div>
                  </div>

                  {/* Barras de meta */}
                  {(v.metaAd > 0 || v.metaMen > 0) && (
                    <div style={{ marginBottom: 16 }}>
                      {v.metaAd > 0 && (
                        <div style={{ marginBottom: 10 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                            <span style={{ fontSize: 12, color: 'var(--muted)' }}>Adesão</span>
                            <span style={{ fontSize: 12, color: v.pctAd >= 100 ? 'var(--accent3)' : 'var(--muted)' }}>{fmt(v.adesao)} / {fmt(v.metaAd)} ({v.pctAd}%)</span>
                          </div>
                          <div style={{ height: 6, background: 'var(--border)', borderRadius: 3 }}>
                            <div style={{ height: '100%', width: `${v.pctAd}%`, background: v.pctAd >= 100 ? 'var(--accent3)' : 'var(--accent)', borderRadius: 3 }} />
                          </div>
                        </div>
                      )}
                      {v.metaMen > 0 && (
                        <div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                            <span style={{ fontSize: 12, color: 'var(--muted)' }}>Mensalidade</span>
                            <span style={{ fontSize: 12, color: v.pctMen >= 100 ? 'var(--accent3)' : 'var(--muted)' }}>{fmt(v.mensalidade)} / {fmt(v.metaMen)} ({v.pctMen}%)</span>
                          </div>
                          <div style={{ height: 6, background: 'var(--border)', borderRadius: 3 }}>
                            <div style={{ height: '100%', width: `${v.pctMen}%`, background: v.pctMen >= 100 ? 'var(--accent3)' : 'var(--accent3)', borderRadius: 3 }} />
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* KPIs do vendedor */}
                  {v.kpis.length > 0 && (
                    <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                      {v.kpis.map(k => (
                        <div key={k.nome} style={{ padding: '6px 12px', background: 'var(--surface2)', borderRadius: 8, fontSize: 12 }}>
                          <span>{k.icone} {k.nome}: </span>
                          <strong style={{ color: 'var(--accent)' }}>{k.real}</strong>
                        </div>
                      ))}
                    </div>
                  )}
                </SEC>
              ))
            )}
          </>
        )}

        {/* ── ABA VOUCHERS ── */}
        {aba === 'vouchers' && (
          <SEC title="🎫 Vouchers Emitidos">
            <Tabela
              cols={[
                { key: 'codigo',     label: 'Código',       bold: true, color: 'var(--accent3)' },
                { key: 'comemoracao',label: 'Evento' },
                { key: 'pctAdesao',  label: '% Adesão',    right: true },
                { key: 'pctMensal',  label: '% Mensalidade',right: true },
                { key: 'criado',     label: 'Criado em',    nowrap: true },
              ]}
              rows={(vouchers || []).map(v => ({
                codigo:      v.codigo,
                comemoracao: v.comemoracao || '—',
                pctAdesao:   v.pctAdesao > 0 ? `${v.pctAdesao}%` : '—',
                pctMensal:   v.pctMensalidade > 0 ? `${v.pctMensalidade}%` : '—',
                criado:      v.criado ? new Date(v.criado).toLocaleDateString('pt-BR') : '—',
              }))}
              emptyMsg="Nenhum voucher emitido."
            />
          </SEC>
        )}

      </main>
    </>
  )
}

export async function getServerSideProps() { return { props: {} } }
