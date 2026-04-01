// pages/dashboard.js
// ============================================================
// MELHORIAS APLICADAS:
// 1. Gráficos de produtos vendidos (adesão + mensalidade por módulo)
// 2. Menus de navegação visíveis no header (Chat, Config, Sair)
// 3. Logo exibida no header quando configurada
// 4. Card "Contratos do mês" com detalhes dos produtos vendidos
// 5. Header clicável para voltar ao chat
// ============================================================

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/router'
import { supabase } from '../lib/supabase'

// ── Helpers ──────────────────────────────────────────────────
function fmt(v) {
  return Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}
function fmtK(v) {
  if (v >= 1000) return `R$ ${(v / 1000).toFixed(1)}k`
  return fmt(v)
}
function mesAtual() { return new Date().toISOString().slice(0, 7) }
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

// ── Barra de progresso ────────────────────────────────────────
function BarraProgresso({ label, real, meta }) {
  const p = pct(real, meta)
  const cor = p >= 100 ? 'var(--accent3)' : p >= 70 ? 'var(--accent)' : p >= 40 ? 'var(--warning)' : 'var(--danger)'
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
        <span style={{ fontSize: 13, color: 'var(--text)', fontWeight: 500 }}>{label}</span>
        <span style={{ fontSize: 12, color: 'var(--muted)' }}>
          {fmt(real)} / {fmt(meta)}{' '}
          <span style={{ color: cor, fontWeight: 700 }}>{p}%</span>
        </span>
      </div>
      <div style={{ height: 8, background: 'var(--surface2)', borderRadius: 4, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${p}%`, background: cor, borderRadius: 4, transition: 'width .6s ease' }} />
      </div>
    </div>
  )
}

// ── Card KPI ─────────────────────────────────────────────────
function CardKpi({ icone, nome, realizado, meta, onClick }) {
  const p   = pct(realizado, meta)
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

// ── Gráfico de barras SVG ────────────────────────────────────
function GraficoBarras({ dados, altura = 130, formatarValor }) {
  if (!dados || dados.length === 0) return (
    <div style={{ textAlign: 'center', padding: '20px 0', color: 'var(--muted)', fontSize: 13 }}>
      Sem dados para exibir
    </div>
  )
  const maxVal = Math.max(...dados.map(d => d.valor), 1)
  const larg   = 100 / dados.length
  const fmtV   = formatarValor || (v => v > 9999 ? `${(v / 1000).toFixed(0)}k` : String(v))
  return (
    <svg width="100%" height={altura} style={{ overflow: 'visible' }}>
      {dados.map((d, i) => {
        const h = Math.max(4, (d.valor / maxVal) * (altura - 28))
        const x = i * larg + larg * 0.1
        const w = larg * 0.8
        return (
          <g key={i}>
            <rect x={`${x}%`} y={altura - 22 - h} width={`${w}%`} height={h}
              rx="3" fill={d.cor || 'var(--accent)'} opacity={0.85} />
            <text x={`${x + w / 2}%`} y={altura - 4} textAnchor="middle"
              style={{ fontSize: 9, fill: 'var(--muted)', fontFamily: 'DM Mono, monospace' }}>
              {d.label}
            </text>
            {d.valor > 0 && (
              <text x={`${x + w / 2}%`} y={altura - 26 - h} textAnchor="middle"
                style={{ fontSize: 9, fill: 'var(--text)', fontFamily: 'DM Mono, monospace' }}>
                {fmtV(d.valor)}
              </text>
            )}
          </g>
        )
      })}
    </svg>
  )
}

// ── Gráfico de pizza simples (SVG) ────────────────────────────
function GraficoPizza({ dados, tamanho = 140 }) {
  if (!dados || dados.length === 0) return null
  const total = dados.reduce((a, d) => a + d.valor, 0)
  if (total === 0) return (
    <div style={{ textAlign: 'center', color: 'var(--muted)', fontSize: 13, padding: 20 }}>Sem dados</div>
  )
  const cx = tamanho / 2, cy = tamanho / 2, r = tamanho / 2 - 10
  let anguloAtual = -Math.PI / 2
  const fatias = dados.map(d => {
    const angulo = (d.valor / total) * 2 * Math.PI
    const x1 = cx + r * Math.cos(anguloAtual)
    const y1 = cy + r * Math.sin(anguloAtual)
    anguloAtual += angulo
    const x2 = cx + r * Math.cos(anguloAtual)
    const y2 = cy + r * Math.sin(anguloAtual)
    const grande = angulo > Math.PI ? 1 : 0
    return { ...d, x1, y1, x2, y2, grande, angulo }
  })
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap' }}>
      <svg width={tamanho} height={tamanho} style={{ flexShrink: 0 }}>
        {fatias.map((f, i) => (
          f.angulo > 0.01 && (
            <path key={i}
              d={`M${cx},${cy} L${f.x1},${f.y1} A${r},${r} 0 ${f.grande} 1 ${f.x2},${f.y2} Z`}
              fill={f.cor} opacity={0.85} />
          )
        ))}
        <circle cx={cx} cy={cy} r={r * 0.45} fill="var(--surface)" />
      </svg>
      <div style={{ flex: 1 }}>
        {dados.map((d, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, fontSize: 12 }}>
            <div style={{ width: 10, height: 10, borderRadius: 3, background: d.cor, flexShrink: 0 }} />
            <span style={{ color: 'var(--muted)', flex: 1 }}>{d.label}</span>
            <span style={{ fontWeight: 700, color: 'var(--text)' }}>{Math.round((d.valor / total) * 100)}%</span>
            <span style={{ color: 'var(--accent)', fontSize: 11 }}>{fmtK(d.valor)}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Últimos docs ─────────────────────────────────────────────
function UltimosDocs({ docs }) {
  if (!docs || docs.length === 0) return (
    <p style={{ color: 'var(--muted)', fontSize: 13, padding: '12px 0' }}>Nenhum documento gerado ainda.</p>
  )
  return (
    <div>
      {docs.slice(0, 6).map((d, i) => {
        const isSigned  = d.status === 'signed'
        const isPending = d.status === 'pending' || d.status === 'sent'
        return (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 0', borderBottom: i < Math.min(docs.length, 6) - 1 ? '1px solid var(--border)' : 'none' }}>
            <div style={{ fontSize: 18, flexShrink: 0 }}>{d.type === 'contrato' ? '📝' : '📄'}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {d.cliente || 'Cliente não identificado'}
              </div>
              <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 1 }}>
                {d.type === 'contrato' ? 'Contrato' : 'Proposta'} · {d.criado ? new Date(d.criado).toLocaleDateString('pt-BR') : '—'}
                {d.adesao > 0 && ` · ${fmtK(d.adesao)}`}
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

// ── Modal lançar KPI ─────────────────────────────────────────
function ModalKpi({ kpi, userId, onClose, onSave }) {
  const hoje = new Date().toISOString().slice(0, 10)
  const [valor, setValor] = useState('')
  const [data,  setData]  = useState(hoje)

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

// ══════════════════════════════════════════════════════════════
// PÁGINA PRINCIPAL
// ══════════════════════════════════════════════════════════════
export default function Dashboard() {
  const router = useRouter()
  const [loading,   setLoading]   = useState(true)
  const [perfil,    setPerfil]    = useState(null)
  const [empresaId, setEmpresaId] = useState(null)
  const [cfg,       setCfg]       = useState({})
  const [mes,       setMes]       = useState(mesAtual())
  const [kpiModal,  setKpiModal]  = useState(null)
  const [abaAtiva,  setAbaAtiva]  = useState('geral')

  useEffect(() => {
    async function init() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.push('/'); return }

      const { data: perf } = await supabase.from('perfis').select('*').eq('id', session.user.id).single()
      setPerfil(perf)
      const eid = perf?.empresa_id || session.user.id
      setEmpresaId(eid)

      const { data: row } = await supabase.from('vx_storage').select('value').eq('key', `cfg:${eid}`).single()
      if (row?.value) {
        try {
          const saved = JSON.parse(row.value)
          setCfg(saved)
          if (saved.theme) document.documentElement.setAttribute('data-theme', saved.theme)
          else document.documentElement.setAttribute('data-theme', 'dark')
        } catch {}
      } else {
        document.documentElement.setAttribute('data-theme', 'dark')
      }
      setLoading(false)
    }
    init()
  }, [])

  async function salvarKpi({ kpiId, valor, data, userId }) {
    const novoCfg = { ...cfg }
    if (!novoCfg.kpiLog) novoCfg.kpiLog = []
    novoCfg.kpiLog.push({ id: Date.now(), userId, date: data, kpiId, realizado: valor })
    await supabase.from('vx_storage')
      .upsert({ key: `cfg:${empresaId}`, value: JSON.stringify(novoCfg), updated_at: new Date().toISOString() })
    setCfg(novoCfg)
  }

  // ── Derivações ─────────────────────────────────
  const usuarios     = cfg.users        || []
  const goals        = cfg.goals        || []
  const kpiTemplates = cfg.kpiTemplates || []
  const kpiGoals     = cfg.kpiGoals     || {}
  const kpiLog       = cfg.kpiLog       || []
  const docHistory   = cfg.docHistory   || []

  const usuarioAtual = usuarios.find(u => u.email === perfil?.email) || usuarios[0]

  // Contratos assinados no mês selecionado
  const contratosMes = docHistory.filter(d => {
    if (d.status !== 'signed') return false
    return (d.criado || '').slice(0, 7) === mes
  })

  function metasUsuario(userId) {
    return goals.find(g => g.userId === userId && g.mes === mes) || {}
  }
  function realizadoUsuario(userId) {
    const contratos = contratosMes.filter(d => d.userId === userId || d.consultor === userId)
    const adesao    = contratos.reduce((acc, d) => acc + (Number(d.adesao) || 0), 0)
    const mensalidade = contratos.reduce((acc, d) => acc + (Number(d.mensalidade) || 0), 0)
    return { adesao, mensalidade, contratos: contratos.length }
  }

  const totaisGerais = (() => {
    const ad  = contratosMes.reduce((a, d) => a + (Number(d.adesao) || 0), 0)
    const men = contratosMes.reduce((a, d) => a + (Number(d.mensalidade) || 0), 0)
    return { adesao: ad, mensalidade: men, contratos: contratosMes.length }
  })()

  const metasTotais = (() => {
    let ad = 0, men = 0
    usuarios.forEach(u => {
      const m = metasUsuario(u.id)
      ad  += Number(m.metaAdesao || 0)
      men += Number(m.metaMensalidade || 0)
    })
    return { adesao: ad, mensalidade: men }
  })()

  function kpiRealizadoMes(kpiId, userId, month) {
    return kpiLog
      .filter(l => l.kpiId === kpiId && l.userId === userId && l.date.startsWith(month))
      .reduce((acc, l) => acc + (Number(l.realizado) || 0), 0)
  }
  function kpiMetaMes(kpiId, userId, month) {
    const diaria = kpiGoals[userId]?.[month]?.[kpiId] || 0
    return diaria * diasUteisNoMes(month)
  }

  // Gráfico últimos 6 meses — adesão
  const dadosGrafico6m = (() => {
    const meses = []
    for (let i = 5; i >= 0; i--) {
      const d = new Date(); d.setMonth(d.getMonth() - i)
      const m     = d.toISOString().slice(0, 7)
      const label = d.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '')
      const valor = docHistory
        .filter(d => d.status === 'signed' && (d.criado || '').slice(0, 7) === m)
        .reduce((acc, d) => acc + (Number(d.adesao) || 0), 0)
      meses.push({ label, valor, cor: m === mes ? 'var(--accent)' : 'rgba(0,212,255,.4)' })
    }
    return meses
  })()

  // ── NOVO: Produtos vendidos no mês ─────────────
  const produtosVendidos = (() => {
    const mapa = {}
    contratosMes.forEach(d => {
      if (!d.modulos) return
      d.modulos.forEach(mod => {
        if (!mapa[mod]) mapa[mod] = { adesao: 0, mensalidade: 0, qtd: 0 }
        mapa[mod].adesao      += Number(d.adesaoModulos?.[mod] || 0)
        mapa[mod].mensalidade += Number(d.mensalidadeModulos?.[mod] || 0)
        mapa[mod].qtd         += 1
      })
    })
    return Object.entries(mapa).map(([nome, v]) => ({ nome, ...v }))
      .sort((a, b) => (b.adesao + b.mensalidade) - (a.adesao + a.mensalidade))
  })()

  // Cores para módulos
  const CORES_MOD = ['var(--accent)','var(--accent3)','var(--accent2)','var(--gold)','var(--danger)','var(--warning)','#06b6d4','#8b5cf6']

  const dadosAdesaoPorMod = produtosVendidos.map((p, i) => ({
    label: p.nome.length > 8 ? p.nome.slice(0, 7) + '…' : p.nome,
    valor: p.adesao,
    cor: CORES_MOD[i % CORES_MOD.length]
  }))
  const dadosMensalidadePorMod = produtosVendidos.map((p, i) => ({
    label: p.nome.length > 8 ? p.nome.slice(0, 7) + '…' : p.nome,
    valor: p.mensalidade,
    cor: CORES_MOD[i % CORES_MOD.length]
  }))
  const dadosPizzaAdesao = produtosVendidos.map((p, i) => ({
    label: p.nome, valor: p.adesao, cor: CORES_MOD[i % CORES_MOD.length]
  })).filter(d => d.valor > 0)
  const dadosPizzaMensal = produtosVendidos.map((p, i) => ({
    label: p.nome, valor: p.mensalidade, cor: CORES_MOD[i % CORES_MOD.length]
  })).filter(d => d.valor > 0)

  // Ranking de vendedores
  const ranking = usuarios.map(u => {
    const r = realizadoUsuario(u.id)
    const m = metasUsuario(u.id)
    return { ...u, adesao: r.adesao, mensalidade: r.mensalidade, contratos: r.contratos, metaAd: Number(m.metaAdesao || 0), metaMen: Number(m.metaMensalidade || 0) }
  }).sort((a, b) => (b.adesao + b.mensalidade) - (a.adesao + a.mensalidade))

  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)', color: 'var(--muted)', fontFamily: 'DM Mono, monospace' }}>
      Carregando dashboard...
    </div>
  )

  const card = (label, val, cor, sub) => (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: '18px 20px', boxShadow: 'var(--shadow)' }}>
      <div style={{ fontSize: 11, color: 'var(--muted)', letterSpacing: '.8px', textTransform: 'uppercase', marginBottom: 8 }}>{label}</div>
      <div style={{ fontFamily: 'Syne, sans-serif', fontSize: 22, fontWeight: 800, color: cor }}>{val}</div>
      {sub && <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>{sub}</div>}
    </div>
  )

  return (
    <>
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
        [data-theme="dark"] body::before{content:'';position:fixed;inset:0;
          background-image:linear-gradient(rgba(0,212,255,.025) 1px,transparent 1px),linear-gradient(90deg,rgba(0,212,255,.025) 1px,transparent 1px);
          background-size:40px 40px;pointer-events:none;z-index:0}
        ::-webkit-scrollbar{width:4px}::-webkit-scrollbar-thumb{background:var(--border);border-radius:4px}
      `}</style>

      <div style={{ position: 'fixed', width: 500, height: 500, background: 'var(--accent)', top: -200, right: -150, borderRadius: '50%', filter: 'blur(120px)', opacity: .05, pointerEvents: 'none', zIndex: 0 }} />
      <div style={{ position: 'fixed', width: 400, height: 400, background: 'var(--accent2)', bottom: -150, left: -100, borderRadius: '50%', filter: 'blur(120px)', opacity: .05, pointerEvents: 'none', zIndex: 0 }} />

      {kpiModal && <ModalKpi kpi={kpiModal} userId={usuarioAtual?.id} onClose={() => setKpiModal(null)} onSave={salvarKpi} />}

      {/* HEADER COM MENUS E LOGO CLICÁVEL */}
      <header style={{ position: 'sticky', top: 0, zIndex: 100, width: '100%', background: 'rgba(10,15,30,.85)', backdropFilter: 'blur(12px)', borderBottom: '1px solid var(--border)', padding: '12px 20px' }}>
        <div style={{ maxWidth: 960, margin: '0 auto', display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ cursor: 'pointer' }} onClick={() => router.push('/chat')}>
            {cfg.logob64
              ? <img src={cfg.logob64} alt={cfg.company} style={{ height: 36, objectFit: 'contain', borderRadius: 6 }} onError={e => e.target.style.display = 'none'} />
              : <div>
                  <div style={{ fontFamily: 'Syne, sans-serif', fontSize: 16, fontWeight: 700, letterSpacing: .5 }}>{cfg.company || 'Vivanexa'}</div>
                  <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 1 }}>📊 Dashboard de Vendas</div>
                </div>
            }
          </div>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 6, alignItems: 'center' }}>
            <button onClick={() => router.push('/chat')}
              style={{ background: 'var(--surface2)', border: '1px solid var(--border)', cursor: 'pointer', color: 'var(--muted)', fontSize: 11, padding: '5px 11px', borderRadius: 8, fontFamily: 'DM Mono, monospace' }}>
              💬 Chat
            </button>
            <button onClick={() => router.push('/configuracoes')}
              style={{ background: 'var(--surface2)', border: '1px solid var(--border)', cursor: 'pointer', color: 'var(--muted)', fontSize: 11, padding: '5px 11px', borderRadius: 8, fontFamily: 'DM Mono, monospace' }}>
              ⚙️ Config
            </button>
            {perfil?.nome && <span style={{ fontSize: 11, color: 'var(--muted)' }}>👤 <span style={{ color: 'var(--text)' }}>{perfil.nome}</span></span>}
            <button onClick={() => supabase.auth.signOut().then(() => router.push('/'))}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', fontSize: 11, padding: '5px 9px', borderRadius: 8, fontFamily: 'DM Mono, monospace' }}>
              Sair
            </button>
          </div>
        </div>
      </header>

      <main style={{ position: 'relative', zIndex: 10, width: '100%', maxWidth: 960, margin: '20px auto 60px', padding: '0 20px' }}>

        {/* ABAS + SELETOR MÊS */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {[
              { id: 'geral',    label: '📊 Geral'    },
              { id: 'produtos', label: '📦 Produtos'  },
              { id: 'kpis',    label: '🎯 KPIs'      },
              { id: 'ranking', label: '🏆 Ranking'   },
              { id: 'historico',label:'🗂️ Histórico' },
            ].map(t => (
              <button key={t.id} onClick={() => setAbaAtiva(t.id)}
                style={{ padding: '6px 14px', borderRadius: 8, border: `1px solid ${abaAtiva === t.id ? 'var(--accent)' : 'var(--border)'}`, background: abaAtiva === t.id ? 'rgba(0,212,255,.1)' : 'var(--surface2)', color: abaAtiva === t.id ? 'var(--accent)' : 'var(--muted)', fontFamily: 'DM Mono, monospace', fontSize: 12, cursor: 'pointer', fontWeight: abaAtiva === t.id ? 600 : 400 }}>
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
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 20 }}>
              {card('💰 Adesão Total',       fmt(totaisGerais.adesao),                    'var(--accent)',  `Meta: ${fmt(metasTotais.adesao)}`)}
              {card('📅 Mensalidade Total',  fmt(totaisGerais.mensalidade),               'var(--accent3)', `Meta: ${fmt(metasTotais.mensalidade)}`)}
              {card('📝 Contratos Fechados', totaisGerais.contratos + ' contrato' + (totaisGerais.contratos !== 1 ? 's' : ''), 'var(--gold)')}
            </div>

            <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: '20px 24px', marginBottom: 20, boxShadow: 'var(--shadow)' }}>
              <div style={{ fontFamily: 'Syne, sans-serif', fontSize: 15, fontWeight: 700, color: 'var(--accent)', marginBottom: 16 }}>🎯 Metas do Mês</div>
              <BarraProgresso label="Adesão"       real={totaisGerais.adesao}       meta={metasTotais.adesao}       />
              <BarraProgresso label="Mensalidade"  real={totaisGerais.mensalidade}  meta={metasTotais.mensalidade}  />
            </div>

            <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: '20px 24px', marginBottom: 20, boxShadow: 'var(--shadow)' }}>
              <div style={{ fontFamily: 'Syne, sans-serif', fontSize: 15, fontWeight: 700, color: 'var(--accent)', marginBottom: 16 }}>📈 Adesão — Últimos 6 Meses</div>
              <GraficoBarras dados={dadosGrafico6m} altura={140} formatarValor={v => fmtK(v)} />
            </div>

            <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: '20px 24px', boxShadow: 'var(--shadow)' }}>
              <div style={{ fontFamily: 'Syne, sans-serif', fontSize: 15, fontWeight: 700, color: 'var(--accent)', marginBottom: 12 }}>🗂️ Últimos Documentos</div>
              <UltimosDocs docs={docHistory.slice().reverse()} />
            </div>
          </div>
        )}

        {/* ── ABA PRODUTOS VENDIDOS ── */}
        {abaAtiva === 'produtos' && (
          <div>
            {produtosVendidos.length === 0 ? (
              <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: '40px 24px', textAlign: 'center', boxShadow: 'var(--shadow)' }}>
                <div style={{ fontSize: 40, marginBottom: 12 }}>📦</div>
                <div style={{ fontFamily: 'Syne, sans-serif', fontSize: 16, fontWeight: 700, marginBottom: 8 }}>Sem contratos assinados neste mês</div>
                <p style={{ color: 'var(--muted)', fontSize: 13 }}>Os gráficos aparecem quando contratos forem marcados como "assinado" no histórico.</p>
              </div>
            ) : (
              <>
                {/* Cards resumo por módulo */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12, marginBottom: 20 }}>
                  {produtosVendidos.map((p, i) => (
                    <div key={p.nome} style={{ background: 'var(--surface)', border: `1px solid ${CORES_MOD[i % CORES_MOD.length]}40`, borderRadius: 12, padding: '16px 18px', boxShadow: 'var(--shadow)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                        <div style={{ width: 10, height: 10, borderRadius: 3, background: CORES_MOD[i % CORES_MOD.length], flexShrink: 0 }} />
                        <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--text)' }}>{p.nome}</div>
                        <div style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--muted)' }}>{p.qtd}×</div>
                      </div>
                      {p.adesao > 0 && (
                        <div style={{ marginBottom: 4 }}>
                          <div style={{ fontSize: 10, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: 1 }}>Adesão</div>
                          <div style={{ fontSize: 16, fontWeight: 800, color: CORES_MOD[i % CORES_MOD.length], fontFamily: 'Syne, sans-serif' }}>{fmtK(p.adesao)}</div>
                        </div>
                      )}
                      {p.mensalidade > 0 && (
                        <div>
                          <div style={{ fontSize: 10, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: 1 }}>Mensalidade</div>
                          <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--accent3)', fontFamily: 'Syne, sans-serif' }}>{fmtK(p.mensalidade)}</div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
                  <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: '20px 24px', boxShadow: 'var(--shadow)' }}>
                    <div style={{ fontFamily: 'Syne, sans-serif', fontSize: 14, fontWeight: 700, color: 'var(--accent)', marginBottom: 14 }}>💰 Adesão por Módulo</div>
                    <GraficoBarras dados={dadosAdesaoPorMod} altura={130} formatarValor={v => fmtK(v)} />
                  </div>
                  <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: '20px 24px', boxShadow: 'var(--shadow)' }}>
                    <div style={{ fontFamily: 'Syne, sans-serif', fontSize: 14, fontWeight: 700, color: 'var(--accent3)', marginBottom: 14 }}>📅 Mensalidade por Módulo</div>
                    <GraficoBarras dados={dadosMensalidadePorMod} altura={130} formatarValor={v => fmtK(v)} />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                  {dadosPizzaAdesao.length > 0 && (
                    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: '20px 24px', boxShadow: 'var(--shadow)' }}>
                      <div style={{ fontFamily: 'Syne, sans-serif', fontSize: 14, fontWeight: 700, color: 'var(--accent)', marginBottom: 14 }}>🥧 Distribuição Adesão</div>
                      <GraficoPizza dados={dadosPizzaAdesao} tamanho={130} />
                    </div>
                  )}
                  {dadosPizzaMensal.length > 0 && (
                    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: '20px 24px', boxShadow: 'var(--shadow)' }}>
                      <div style={{ fontFamily: 'Syne, sans-serif', fontSize: 14, fontWeight: 700, color: 'var(--accent3)', marginBottom: 14 }}>🥧 Distribuição Mensalidade</div>
                      <GraficoPizza dados={dadosPizzaMensal} tamanho={130} />
                    </div>
                  )}
                </div>

                {/* Tabela detalhada */}
                <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: '20px 24px', marginTop: 16, boxShadow: 'var(--shadow)' }}>
                  <div style={{ fontFamily: 'Syne, sans-serif', fontSize: 14, fontWeight: 700, color: 'var(--text)', marginBottom: 14 }}>📋 Resumo Detalhado</div>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid var(--border)' }}>
                        {['Módulo', 'Qtd', 'Adesão Total', 'Mensalidade Total', 'Receita Total'].map(h => (
                          <th key={h} style={{ padding: '8px 12px', textAlign: h === 'Módulo' ? 'left' : 'right', fontSize: 10, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: 1 }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {produtosVendidos.map((p, i) => (
                        <tr key={p.nome} style={{ borderBottom: '1px solid var(--border)' }}>
                          <td style={{ padding: '10px 12px', display: 'flex', alignItems: 'center', gap: 8 }}>
                            <div style={{ width: 8, height: 8, borderRadius: 2, background: CORES_MOD[i % CORES_MOD.length], flexShrink: 0 }} />
                            <span style={{ fontWeight: 600 }}>{p.nome}</span>
                           </td>
                          <td style={{ padding: '10px 12px', textAlign: 'right', color: 'var(--muted)' }}>{p.qtd}×</td>
                          <td style={{ padding: '10px 12px', textAlign: 'right', color: 'var(--accent)', fontWeight: 600 }}>{fmt(p.adesao)}</td>
                          <td style={{ padding: '10px 12px', textAlign: 'right', color: 'var(--accent3)', fontWeight: 600 }}>{fmt(p.mensalidade)}</td>
                          <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700, color: 'var(--text)' }}>{fmt(p.adesao + p.mensalidade)}</td>
                        </tr>
                      ))}
                      <tr style={{ background: 'var(--surface2)', fontWeight: 700 }}>
                        <td style={{ padding: '10px 12px' }}>TOTAL</td>
                        <td style={{ padding: '10px 12px', textAlign: 'right' }}>{produtosVendidos.reduce((a, p) => a + p.qtd, 0)}×</td>
                        <td style={{ padding: '10px 12px', textAlign: 'right', color: 'var(--accent)' }}>{fmt(produtosVendidos.reduce((a, p) => a + p.adesao, 0))}</td>
                        <td style={{ padding: '10px 12px', textAlign: 'right', color: 'var(--accent3)' }}>{fmt(produtosVendidos.reduce((a, p) => a + p.mensalidade, 0))}</td>
                        <td style={{ padding: '10px 12px', textAlign: 'right' }}>{fmt(produtosVendidos.reduce((a, p) => a + p.adesao + p.mensalidade, 0))}</td>
                      </tr>
                    </tbody>
                  </table>
                  <p style={{ fontSize: 11, color: 'var(--muted)', marginTop: 12 }}>
                    💡 Os dados aparecem quando o contrato salvo inclui o campo <code>modulos</code>, <code>adesaoModulos</code> e <code>mensalidadeModulos</code>.
                  </p>
                </div>
              </>
            )}
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
                    const uid  = usuarioAtual?.id || ''
                    const real = kpiRealizadoMes(kpi.id, uid, mes)
                    const meta = kpiMetaMes(kpi.id, uid, mes)
                    return <CardKpi key={kpi.id} icone={kpi.icone || '📊'} nome={kpi.nome} realizado={real} meta={meta} onClick={() => setKpiModal(kpi)} />
                  })}
                </div>
                <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: '20px 24px', marginTop: 20, boxShadow: 'var(--shadow)' }}>
                  <div style={{ fontFamily: 'Syne, sans-serif', fontSize: 14, fontWeight: 700, color: 'var(--accent)', marginBottom: 14 }}>📅 Lançamentos do Mês</div>
                  {kpiLog.filter(l => l.date.startsWith(mes) && l.userId === usuarioAtual?.id).length === 0
                    ? <p style={{ color: 'var(--muted)', fontSize: 13 }}>Nenhum lançamento neste mês.</p>
                    : kpiLog.filter(l => l.date.startsWith(mes) && l.userId === usuarioAtual?.id).slice().reverse().slice(0, 10).map((l, i) => {
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
                  }
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
                  return (
                    <div key={u.id} style={{ background: i === 0 ? 'linear-gradient(135deg,rgba(251,191,36,.08),rgba(251,191,36,.02))' : 'var(--surface)', border: `1px solid ${i === 0 ? 'rgba(251,191,36,.3)' : 'var(--border)'}`, borderRadius: 14, padding: '18px 20px', marginBottom: 12, boxShadow: 'var(--shadow)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
                        <span style={{ fontSize: 22 }}>{emoji}</span>
                        <div>
                          <div style={{ fontWeight: 700, fontSize: 15 }}>{u.nome}</div>
                          <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 1 }}>{u.contratos} contrato{u.contratos !== 1 ? 's' : ''}</div>
                        </div>
                        <div style={{ marginLeft: 'auto', textAlign: 'right' }}>
                          <div style={{ fontSize: 16, fontWeight: 800, fontFamily: 'Syne, sans-serif', color: 'var(--accent3)' }}>{fmt(u.adesao + u.mensalidade)}</div>
                          <div style={{ fontSize: 11, color: 'var(--muted)' }}>total no mês</div>
                        </div>
                      </div>
                      <BarraProgresso label="Adesão"      real={u.adesao}      meta={u.metaAd}  />
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
                        {d.type === 'contrato' ? 'Contrato' : 'Proposta'} · {d.criado ? new Date(d.criado).toLocaleDateString('pt-BR') : '—'}
                        {d.adesao > 0 && ` · ${fmt(d.adesao)}`}
                        {d.modulos?.length > 0 && ` · ${d.modulos.join(', ')}`}
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
