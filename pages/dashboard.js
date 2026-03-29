// pages/dashboard.js
import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/router'
import { supabase } from '../lib/supabase'

// ══════════════════════════════════════════════
// HELPERS
// ══════════════════════════════════════════════
function fmt(v) {
  return Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}
function mesAtual() {
  return new Date().toISOString().slice(0, 7)
}
function diasUteisNoMes(yearMonth) {
  const [y, m] = yearMonth.split('-').map(Number)
  const dias = new Date(y, m, 0).getDate()
  let uteis = 0
  for (let d = 1; d <= dias; d++) {
    const dow = new Date(y, m - 1, d).getDay()
    if (dow !== 0 && dow !== 6) uteis++
  }
  return uteis
}
function pct(real, meta) {
  if (!meta || meta <= 0) return 0
  return Math.min(100, Math.round((real / meta) * 100))
}

// ══════════════════════════════════════════════
// COMPONENTE: BARRA DE PROGRESSO
// ══════════════════════════════════════════════
function BarraProgresso({ label, real, meta, cor }) {
  const p = pct(real, meta)
  const corBarra = p >= 100 ? 'var(--accent3)' : p >= 70 ? 'var(--accent)' : p >= 40 ? 'var(--warning)' : 'var(--danger)'
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
        <span style={{ fontSize: 13, color: 'var(--text)', fontWeight: 500 }}>{label}</span>
        <span style={{ fontSize: 12, color: 'var(--muted)' }}>
          {fmt(real)} / {fmt(meta)} &nbsp;
          <span style={{ color: corBarra, fontWeight: 700 }}>{p}%</span>
        </span>
      </div>
      <div style={{ height: 8, background: 'var(--surface2)', borderRadius: 4, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${p}%`, background: corBarra, borderRadius: 4, transition: 'width .6s ease' }} />
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════
// COMPONENTE: CARD KPI
// ══════════════════════════════════════════════
function CardKpi({ icone, nome, realizado, meta, onClick }) {
  const p = pct(realizado, meta)
  const cor = p >= 100 ? 'var(--accent3)' : p >= 60 ? 'var(--accent)' : 'var(--muted)'
  return (
    <div onClick={onClick}
      style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 12, padding: '14px 16px', cursor: onClick ? 'pointer' : 'default', transition: 'border-color .2s' }}
      onMouseEnter={e => e.currentTarget.style.borderColor = 'rgba(0,212,255,.4)'}
      onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}>
      <div style={{ fontSize: 22, marginBottom: 6 }}>{icone}</div>
      <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 4, letterSpacing: '.5px' }}>{nome}</div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
        <span style={{ fontSize: 26, fontWeight: 800, fontFamily: 'Syne, sans-serif', color: cor }}>{realizado}</span>
        {meta > 0 && <span style={{ fontSize: 12, color: 'var(--muted)' }}>/ {meta}</span>}
      </div>
      {meta > 0 && (
        <div style={{ marginTop: 8, height: 4, background: 'var(--border)', borderRadius: 2, overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${p}%`, background: cor, borderRadius: 2, transition: 'width .6s' }} />
        </div>
      )}
    </div>
  )
}

// ══════════════════════════════════════════════
// COMPONENTE: GRÁFICO DE BARRAS SIMPLES (SVG)
// ══════════════════════════════════════════════
function GraficoBarras({ dados, altura = 120 }) {
  if (!dados || dados.length === 0) return null
  const maxVal = Math.max(...dados.map(d => d.valor), 1)
  const larguraBarra = 100 / dados.length
  return (
    <svg width="100%" height={altura} style={{ overflow: 'visible' }}>
      {dados.map((d, i) => {
        const h = Math.max(4, (d.valor / maxVal) * (altura - 24))
        const x = i * larguraBarra + larguraBarra * 0.1
        const w = larguraBarra * 0.8
        return (
          <g key={i}>
            <rect
              x={`${x}%`} y={altura - 20 - h} width={`${w}%`} height={h}
              rx="3" fill={d.cor || 'var(--accent)'}
              opacity={0.85}
            />
            <text x={`${x + w / 2}%`} y={altura - 4} textAnchor="middle"
              style={{ fontSize: 10, fill: 'var(--muted)', fontFamily: 'DM Mono, monospace' }}>
              {d.label}
            </text>
            {d.valor > 0 && (
              <text x={`${x + w / 2}%`} y={altura - 24 - h} textAnchor="middle"
                style={{ fontSize: 10, fill: 'var(--text)', fontFamily: 'DM Mono, monospace' }}>
                {d.valor > 9999 ? `${(d.valor / 1000).toFixed(0)}k` : d.valor}
              </text>
            )}
          </g>
        )
      })}
    </svg>
  )
}

// ══════════════════════════════════════════════
// COMPONENTE: LINHA DO TEMPO (ÚLTIMOS DOCS)
// ══════════════════════════════════════════════
function UltimosDocs({ docs }) {
  if (!docs || docs.length === 0) return (
    <p style={{ color: 'var(--muted)', fontSize: 13, padding: '12px 0' }}>
      Nenhum documento gerado ainda.
    </p>
  )
  return (
    <div>
      {docs.slice(0, 6).map((d, i) => {
        const isSigned = d.status === 'signed'
        const isPending = d.status === 'pending' || d.status === 'sent'
        const isContrato = d.type === 'contrato'
        return (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 0', borderBottom: i < Math.min(docs.length, 6) - 1 ? '1px solid var(--border)' : 'none' }}>
            <div style={{ fontSize: 18, flexShrink: 0 }}>{isContrato ? '📝' : '📄'}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {d.cliente || 'Cliente não identificado'}
              </div>
              <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 1 }}>
                {isContrato ? 'Contrato' : 'Proposta'} ·{' '}
                {d.criado ? new Date(d.criado).toLocaleDateString('pt-BR') : '—'}
              </div>
            </div>
            <div style={{ fontSize: 11, fontWeight: 600, color: isSigned ? 'var(--accent3)' : isPending ? 'var(--warning)' : 'var(--muted)', flexShrink: 0 }}>
              {isSigned ? '✅' : isPending ? '⏳' : '📝'}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ══════════════════════════════════════════════
// COMPONENTE: MODAL LANÇAR KPI
// ══════════════════════════════════════════════
function ModalKpi({ kpi, userId, onClose, onSave }) {
  const hoje = new Date().toISOString().slice(0, 10)
  const [valor, setValor] = useState('')
  const [data, setData] = useState(hoje)

  async function salvar() {
    if (!valor || isNaN(Number(valor))) return
    await onSave({ kpiId: kpi.id, valor: Number(valor), data, userId })
    onClose()
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.8)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: 28, width: '100%', maxWidth: 360, boxShadow: 'var(--shadow)' }}>
        <div style={{ fontFamily: 'Syne, sans-serif', fontSize: 16, fontWeight: 700, color: 'var(--accent)', marginBottom: 20 }}>
          {kpi.icone} Lançar {kpi.nome}
        </div>
        <div style={{ marginBottom: 14 }}>
          <label style={{ fontSize: 12, color: 'var(--muted)', display: 'block', marginBottom: 4 }}>Data</label>
          <input type="date" value={data} onChange={e => setData(e.target.value)}
            style={{ width: '100%', background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 8, padding: '9px 12px', fontFamily: 'DM Mono, monospace', fontSize: 13, color: 'var(--text)', outline: 'none' }} />
        </div>
        <div style={{ marginBottom: 20 }}>
          <label style={{ fontSize: 12, color: 'var(--muted)', display: 'block', marginBottom: 4 }}>Quantidade</label>
          <input type="number" autoFocus min={0} value={valor} onChange={e => setValor(e.target.value)}
            placeholder="Ex: 15"
            style={{ width: '100%', background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 8, padding: '9px 12px', fontFamily: 'DM Mono, monospace', fontSize: 14, color: 'var(--text)', outline: 'none' }} />
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={salvar}
            style={{ flex: 1, padding: '11px', borderRadius: 10, background: 'linear-gradient(135deg,var(--accent),#0099bb)', border: 'none', color: '#fff', fontFamily: 'DM Mono, monospace', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
            ✅ Salvar
          </button>
          <button onClick={onClose}
            style={{ padding: '11px 18px', borderRadius: 10, background: 'rgba(100,116,139,.12)', border: '1px solid rgba(100,116,139,.3)', color: 'var(--muted)', fontFamily: 'DM Mono, monospace', fontSize: 13, cursor: 'pointer' }}>
            Cancelar
          </button>
        </div>
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════
// PÁGINA PRINCIPAL
// ══════════════════════════════════════════════
export default function Dashboard() {
  const router = useRouter()
  const [loading, setLoading]       = useState(true)
  const [perfil, setPerfil]         = useState(null)
  const [empresaId, setEmpresaId]   = useState(null)
  const [cfg, setCfg]               = useState({})
  const [mes, setMes]               = useState(mesAtual())
  const [kpiModal, setKpiModal]     = useState(null)  // kpi selecionado para lançar
  const [abaAtiva, setAbaAtiva]     = useState('geral')

  // ── Autenticação e carregamento ────────────
  useEffect(() => {
    async function init() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.push('/'); return }

      const { data: perf } = await supabase
        .from('perfis')
        .select('*')
        .eq('id', session.user.id)
        .single()

      setPerfil(perf)
      const eid = perf?.empresa_id || session.user.id
      setEmpresaId(eid)

      // Carregar config
      const { data: row } = await supabase
        .from('vx_storage')
        .select('value')
        .eq('key', `cfg:${eid}`)
        .single()

      if (row?.value) {
        try { setCfg(JSON.parse(row.value)) } catch {}
      }
      setLoading(false)
    }
    init()
  }, [])

  // ── Lançar KPI ────────────────────────────
  async function salvarKpi({ kpiId, valor, data, userId }) {
    const novoCfg = { ...cfg }
    if (!novoCfg.kpiLog) novoCfg.kpiLog = []
    novoCfg.kpiLog.push({ id: Date.now(), userId, date: data, kpiId, realizado: valor })

    await supabase.from('vx_storage')
      .upsert({ key: `cfg:${empresaId}`, value: JSON.stringify(novoCfg), updated_at: new Date().toISOString() })
    setCfg(novoCfg)
  }

  // ── Cálculos ──────────────────────────────
  const usuarios     = cfg.users       || []
  const goals        = cfg.goals       || []
  const kpiTemplates = cfg.kpiTemplates|| []
  const kpiGoals     = cfg.kpiGoals    || {}
  const kpiLog       = cfg.kpiLog      || []
  const docHistory   = cfg.docHistory  || []
  const isAdmin      = perfil?.perfil === 'admin'

  // Quem é o usuário atual para filtrar KPIs
  const usuarioAtual = usuarios.find(u => u.email === perfil?.email) || usuarios[0]

  // Contratos assinados no mês
  const contratosMes = docHistory.filter(d => {
    if (d.status !== 'signed') return false
    const dataCriado = d.criado ? d.criado.slice(0, 7) : ''
    return dataCriado === mes
  })

  // Metas por usuário no mês
  function metasUsuario(userId) {
    return goals.find(g => g.userId === userId && g.mes === mes) || {}
  }

  // Realizado de adesão e mensalidade por usuário (baseado nos contratos assinados)
  function realizadoUsuario(userId) {
    const contratos = contratosMes.filter(d => d.userId === userId || d.consultor === userId)
    const adesao = contratos.reduce((acc, d) => acc + (Number(d.adesao) || 0), 0)
    const mensalidade = contratos.reduce((acc, d) => acc + (Number(d.mensalidade) || 0), 0)
    return { adesao, mensalidade, contratos: contratos.length }
  }

  // Total geral do mês
  const totaisGerais = (() => {
    const ad  = contratosMes.reduce((a, d) => a + (Number(d.adesao) || 0), 0)
    const men = contratosMes.reduce((a, d) => a + (Number(d.mensalidade) || 0), 0)
    return { adesao: ad, mensalidade: men, contratos: contratosMes.length }
  })()

  // Metas totais de todos os usuários
  const metasTotais = (() => {
    let ad = 0, men = 0
    usuarios.forEach(u => {
      const m = metasUsuario(u.id)
      ad  += Number(m.metaAdesao || 0)
      men += Number(m.metaMensalidade || 0)
    })
    return { adesao: ad, mensalidade: men }
  })()

  // KPIs do usuário atual no mês
  function kpiRealizadoMes(kpiId, userId, month) {
    return kpiLog
      .filter(l => l.kpiId === kpiId && l.userId === userId && l.date.startsWith(month))
      .reduce((acc, l) => acc + (Number(l.realizado) || 0), 0)
  }
  function kpiMetaMes(kpiId, userId, month) {
    const diaria = kpiGoals[userId]?.[month]?.[kpiId] || 0
    return diaria * diasUteisNoMes(month)
  }

  // Gráfico dos últimos 6 meses de adesão
  const dadosGrafico = (() => {
    const meses = []
    for (let i = 5; i >= 0; i--) {
      const d = new Date()
      d.setMonth(d.getMonth() - i)
      const m = d.toISOString().slice(0, 7)
      const label = d.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '')
      const valor = docHistory
        .filter(d => d.status === 'signed' && (d.criado || '').slice(0, 7) === m)
        .reduce((acc, d) => acc + (Number(d.adesao) || 0), 0)
      meses.push({ label, valor, cor: m === mes ? 'var(--accent)' : 'rgba(0,212,255,.4)' })
    }
    return meses
  })()

  // Ranking de vendedores
  const ranking = usuarios.map(u => {
    const r = realizadoUsuario(u.id)
    const m = metasUsuario(u.id)
    return {
      ...u,
      adesao: r.adesao,
      mensalidade: r.mensalidade,
      contratos: r.contratos,
      metaAd: Number(m.metaAdesao || 0),
      metaMen: Number(m.metaMensalidade || 0),
    }
  }).sort((a, b) => (b.adesao + b.mensalidade) - (a.adesao + a.mensalidade))

  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)', color: 'var(--muted)', fontFamily: 'DM Mono, monospace' }}>
      Carregando dashboard...
    </div>
  )

  return (
    <>
      {/* ESTILOS GLOBAIS */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=DM+Mono:wght@300;400;500&display=swap');
        [data-theme="dark"]{
          --bg:#0a0f1e;--surface:#111827;--surface2:#1a2540;--border:#1e2d4a;
          --accent:#00d4ff;--accent2:#7c3aed;--accent3:#10b981;
          --text:#e2e8f0;--muted:#64748b;
          --danger:#ef4444;--warning:#f59e0b;--gold:#fbbf24;
          --shadow:0 4px 24px rgba(0,0,0,.4);
        }
        [data-theme="light"]{
          --bg:#f0f4f8;--surface:#ffffff;--surface2:#f8fafc;--border:#e2e8f0;
          --accent:#0099bb;--accent2:#7c3aed;--accent3:#059669;
          --text:#1e293b;--muted:#64748b;
          --danger:#ef4444;--warning:#d97706;--gold:#b45309;
          --shadow:0 4px 24px rgba(0,0,0,.1);
        }
        *{box-sizing:border-box;margin:0;padding:0}
        body{font-family:'DM Mono',monospace;background:var(--bg);color:var(--text);min-height:100vh}
        [data-theme="dark"] body::before{
          content:'';position:fixed;inset:0;
          background-image:linear-gradient(rgba(0,212,255,.025) 1px,transparent 1px),
          linear-gradient(90deg,rgba(0,212,255,.025) 1px,transparent 1px);
          background-size:40px 40px;pointer-events:none;z-index:0}
        ::-webkit-scrollbar{width:4px}
        ::-webkit-scrollbar-thumb{background:var(--border);border-radius:4px}
      `}</style>

      {/* ORBS */}
      <div style={{ position: 'fixed', width: 500, height: 500, background: 'var(--accent)', top: -200, right: -150, borderRadius: '50%', filter: 'blur(120px)', opacity: .05, pointerEvents: 'none', zIndex: 0 }} />
      <div style={{ position: 'fixed', width: 400, height: 400, background: 'var(--accent2)', bottom: -150, left: -100, borderRadius: '50%', filter: 'blur(120px)', opacity: .05, pointerEvents: 'none', zIndex: 0 }} />

      {/* MODAL KPI */}
      {kpiModal && (
        <ModalKpi
          kpi={kpiModal}
          userId={usuarioAtual?.id}
          onClose={() => setKpiModal(null)}
          onSave={salvarKpi}
        />
      )}

      {/* HEADER */}
      <header style={{ position: 'relative', zIndex: 10, width: '100%', maxWidth: 900, margin: '0 auto', padding: '18px 20px 0', display: 'flex', alignItems: 'center', gap: 12 }}>
        <div>
          <div style={{ fontFamily: 'Syne, sans-serif', fontSize: 17, fontWeight: 700, letterSpacing: .5 }}>
            {cfg.company || 'Vivanexa'}
          </div>
          <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>📊 Dashboard de Vendas</div>
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
          <button onClick={() => router.push('/chat')}
            style={{ background: 'var(--surface2)', border: '1px solid var(--border)', cursor: 'pointer', color: 'var(--muted)', fontSize: 11, padding: '5px 11px', borderRadius: 8, fontFamily: 'DM Mono, monospace', letterSpacing: .3 }}>
            💬 Chat
          </button>
          <button onClick={() => router.push('/configuracoes')}
            style={{ background: 'var(--surface2)', border: '1px solid var(--border)', cursor: 'pointer', color: 'var(--muted)', fontSize: 11, padding: '5px 11px', borderRadius: 8, fontFamily: 'DM Mono, monospace', letterSpacing: .3 }}>
            ⚙️ Config
          </button>
          <button onClick={() => supabase.auth.signOut().then(() => router.push('/'))}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', fontSize: 11, padding: '5px 9px', borderRadius: 8, fontFamily: 'DM Mono, monospace' }}>
            Sair
          </button>
        </div>
      </header>

      <main style={{ position: 'relative', zIndex: 10, width: '100%', maxWidth: 900, margin: '20px auto 60px', padding: '0 20px' }}>

        {/* SELETOR DE MÊS + ABAS */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', gap: 6 }}>
            {[
              { id: 'geral', label: '📊 Geral' },
              { id: 'kpis',  label: '🎯 KPIs' },
              { id: 'ranking', label: '🏆 Ranking' },
              { id: 'historico', label: '🗂️ Histórico' },
            ].map(t => (
              <button key={t.id} onClick={() => setAbaAtiva(t.id)}
                style={{ padding: '6px 14px', borderRadius: 8, border: `1px solid ${abaAtiva === t.id ? 'var(--accent)' : 'var(--border)'}`, background: abaAtiva === t.id ? 'rgba(0,212,255,.1)' : 'var(--surface2)', color: abaAtiva === t.id ? 'var(--accent)' : 'var(--muted)', fontFamily: 'DM Mono, monospace', fontSize: 12, cursor: 'pointer' }}>
                {t.label}
              </button>
            ))}
          </div>
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 12, color: 'var(--muted)' }}>Mês:</span>
            <input type="month" value={mes} onChange={e => setMes(e.target.value)}
              style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 8, padding: '6px 10px', fontFamily: 'DM Mono, monospace', fontSize: 13, color: 'var(--text)', outline: 'none' }} />
          </div>
        </div>

        {/* ── ABA GERAL ── */}
        {abaAtiva === 'geral' && (
          <div>
            {/* CARDS RESUMO */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 20 }}>
              {[
                { label: '💰 Adesão Total',       val: fmt(totaisGerais.adesao),      cor: 'var(--accent)' },
                { label: '📅 Mensalidade Total',  val: fmt(totaisGerais.mensalidade), cor: 'var(--accent3)' },
                { label: '📝 Contratos Fechados', val: totaisGerais.contratos,        cor: 'var(--gold)' },
              ].map((c, i) => (
                <div key={i} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: '18px 20px', boxShadow: 'var(--shadow)' }}>
                  <div style={{ fontSize: 11, color: 'var(--muted)', letterSpacing: '.8px', textTransform: 'uppercase', marginBottom: 8 }}>{c.label}</div>
                  <div style={{ fontFamily: 'Syne, sans-serif', fontSize: 22, fontWeight: 800, color: c.cor }}>{c.val}</div>
                </div>
              ))}
            </div>

            {/* METAS TOTAIS */}
            <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: '20px 24px', marginBottom: 20, boxShadow: 'var(--shadow)' }}>
              <div style={{ fontFamily: 'Syne, sans-serif', fontSize: 15, fontWeight: 700, color: 'var(--accent)', marginBottom: 16 }}>🎯 Metas do Mês</div>
              <BarraProgresso label="Adesão" real={totaisGerais.adesao} meta={metasTotais.adesao} />
              <BarraProgresso label="Mensalidade" real={totaisGerais.mensalidade} meta={metasTotais.mensalidade} />
            </div>

            {/* GRÁFICO DOS ÚLTIMOS 6 MESES */}
            <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: '20px 24px', marginBottom: 20, boxShadow: 'var(--shadow)' }}>
              <div style={{ fontFamily: 'Syne, sans-serif', fontSize: 15, fontWeight: 700, color: 'var(--accent)', marginBottom: 16 }}>📈 Adesão — Últimos 6 Meses</div>
              <GraficoBarras dados={dadosGrafico} altura={140} />
            </div>

            {/* ÚLTIMOS DOCUMENTOS */}
            <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: '20px 24px', boxShadow: 'var(--shadow)' }}>
              <div style={{ fontFamily: 'Syne, sans-serif', fontSize: 15, fontWeight: 700, color: 'var(--accent)', marginBottom: 12 }}>🗂️ Últimos Documentos</div>
              <UltimosDocs docs={docHistory.slice().reverse()} />
            </div>
          </div>
        )}

        {/* ── ABA KPIs ── */}
        {abaAtiva === 'kpis' && (
          <div>
            {kpiTemplates.length === 0 ? (
              <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: '32px 24px', textAlign: 'center' }}>
                <div style={{ fontSize: 32, marginBottom: 12 }}>📊</div>
                <div style={{ fontFamily: 'Syne, sans-serif', fontSize: 16, fontWeight: 700, marginBottom: 8 }}>Nenhum KPI cadastrado</div>
                <p style={{ color: 'var(--muted)', fontSize: 13, marginBottom: 16 }}>Configure seus KPIs em Configurações → KPIs</p>
                <button onClick={() => router.push('/configuracoes')}
                  style={{ padding: '10px 20px', borderRadius: 9, background: 'rgba(0,212,255,.1)', border: '1px solid rgba(0,212,255,.3)', color: 'var(--accent)', fontFamily: 'DM Mono, monospace', fontSize: 13, cursor: 'pointer' }}>
                  ⚙️ Ir para Configurações
                </button>
              </div>
            ) : (
              <div>
                <div style={{ fontFamily: 'Syne, sans-serif', fontSize: 15, fontWeight: 700, color: 'var(--text)', marginBottom: 16 }}>
                  Clique em um KPI para lançar seu realizado
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 12 }}>
                  {kpiTemplates.map(kpi => {
                    const uid = usuarioAtual?.id || ''
                    const real = kpiRealizadoMes(kpi.id, uid, mes)
                    const meta = kpiMetaMes(kpi.id, uid, mes)
                    return (
                      <CardKpi
                        key={kpi.id}
                        icone={kpi.icone || '📊'}
                        nome={kpi.nome}
                        realizado={real}
                        meta={meta}
                        onClick={() => setKpiModal(kpi)}
                      />
                    )
                  })}
                </div>

                {/* Histórico KPI do mês */}
                <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: '20px 24px', marginTop: 20, boxShadow: 'var(--shadow)' }}>
                  <div style={{ fontFamily: 'Syne, sans-serif', fontSize: 14, fontWeight: 700, color: 'var(--accent)', marginBottom: 14 }}>📅 Lançamentos do Mês</div>
                  {kpiLog.filter(l => l.date.startsWith(mes) && l.userId === usuarioAtual?.id).length === 0 ? (
                    <p style={{ color: 'var(--muted)', fontSize: 13 }}>Nenhum lançamento neste mês.</p>
                  ) : (
                    kpiLog
                      .filter(l => l.date.startsWith(mes) && l.userId === usuarioAtual?.id)
                      .slice().reverse().slice(0, 10)
                      .map((l, i) => {
                        const kpi = kpiTemplates.find(k => k.id === l.kpiId)
                        return (
                          <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '7px 0', borderBottom: '1px solid var(--border)' }}>
                            <span>{kpi?.icone || '📊'}</span>
                            <span style={{ flex: 1, fontSize: 13 }}>{kpi?.nome || 'KPI'}</span>
                            <span style={{ fontSize: 12, color: 'var(--muted)' }}>{new Date(l.date).toLocaleDateString('pt-BR')}</span>
                            <span style={{ fontWeight: 700, color: 'var(--accent3)', fontSize: 14 }}>+{l.realizado}</span>
                          </div>
                        )
                      })
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── ABA RANKING ── */}
        {abaAtiva === 'ranking' && (
          <div>
            {usuarios.length === 0 ? (
              <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: '32px 24px', textAlign: 'center' }}>
                <p style={{ color: 'var(--muted)', fontSize: 13 }}>Nenhum usuário cadastrado. Adicione em Configurações → Usuários.</p>
              </div>
            ) : (
              <div>
                {ranking.map((u, i) => {
                  const emoji = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`
                  const pctAd  = pct(u.adesao, u.metaAd)
                  const pctMen = pct(u.mensalidade, u.metaMen)
                  return (
                    <div key={u.id} style={{ background: i === 0 ? 'linear-gradient(135deg,rgba(251,191,36,.08),rgba(251,191,36,.02))' : 'var(--surface)', border: `1px solid ${i === 0 ? 'rgba(251,191,36,.3)' : 'var(--border)'}`, borderRadius: 14, padding: '18px 20px', marginBottom: 12, boxShadow: 'var(--shadow)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
                        <span style={{ fontSize: 22 }}>{emoji}</span>
                        <div>
                          <div style={{ fontWeight: 700, fontSize: 15 }}>{u.nome}</div>
                          <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 1 }}>
                            {u.contratos} contrato{u.contratos !== 1 ? 's' : ''} fechado{u.contratos !== 1 ? 's' : ''}
                          </div>
                        </div>
                        <div style={{ marginLeft: 'auto', textAlign: 'right' }}>
                          <div style={{ fontSize: 16, fontWeight: 800, fontFamily: 'Syne, sans-serif', color: 'var(--accent3)' }}>{fmt(u.adesao + u.mensalidade)}</div>
                          <div style={{ fontSize: 11, color: 'var(--muted)' }}>total no mês</div>
                        </div>
                      </div>
                      <BarraProgresso label="Adesão" real={u.adesao} meta={u.metaAd} />
                      <BarraProgresso label="Mensalidade" real={u.mensalidade} meta={u.metaMen} />
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* ── ABA HISTÓRICO ── */}
        {abaAtiva === 'historico' && (
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: '20px 24px', boxShadow: 'var(--shadow)' }}>
            <div style={{ fontFamily: 'Syne, sans-serif', fontSize: 15, fontWeight: 700, color: 'var(--accent)', marginBottom: 16 }}>🗂️ Todos os Documentos</div>
            {docHistory.length === 0 ? (
              <p style={{ color: 'var(--muted)', fontSize: 13 }}>Nenhum documento gerado ainda.</p>
            ) : (
              docHistory.slice().reverse().map((d, i) => {
                const isSigned  = d.status === 'signed'
                const isPending = d.status === 'pending' || d.status === 'sent'
                return (
                  <div key={i} style={{ display: 'flex', gap: 12, alignItems: 'center', padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
                    <span style={{ fontSize: 18 }}>{d.type === 'contrato' ? '📝' : '📄'}</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 600 }}>{d.cliente || 'Cliente não identificado'}</div>
                      <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 1 }}>
                        {d.type === 'contrato' ? 'Contrato' : 'Proposta'} ·{' '}
                        {d.criado ? new Date(d.criado).toLocaleDateString('pt-BR') : '—'}
                        {d.adesao > 0 && ` · ${fmt(d.adesao)}`}
                      </div>
                    </div>
                    <div style={{ fontSize: 11, fontWeight: 600, color: isSigned ? 'var(--accent3)' : isPending ? 'var(--warning)' : 'var(--muted)' }}>
                      {isSigned ? '✅ Assinado' : isPending ? '⏳ Pendente' : '📝 Rascunho'}
                    </div>
                  </div>
                )
              })
            )}
          </div>
        )}
      </main>
    </>
  )
}
