// pages/reports.js — Relatórios Estratégicos Vivanexa SaaS v3
// Visão Estratégica, Financeiro, KPIs, Vendas, Produtos, Comercial, Fiscal
import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import Head from 'next/head'
import { supabase } from '../lib/supabase'
import Navbar from '../components/Navbar'

const fmt  = n => 'R$ ' + Number(n || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })
const fmtK = v => v >= 1000 ? `R$ ${(v / 1000).toFixed(1)}k` : fmt(v)
const fmtN = n => Number(n || 0).toLocaleString('pt-BR')
const pct  = (r, m) => !m ? 0 : Math.min(100, Math.round((r / m) * 100))
const mesAtual = () => new Date().toISOString().slice(0, 7)

function diasUteisNoMes(ym) {
  const [y, m] = ym.split('-').map(Number)
  const dias = new Date(y, m, 0).getDate()
  let u = 0
  for (let d = 1; d <= dias; d++) { const dw = new Date(y, m - 1, d).getDay(); if (dw !== 0 && dw !== 6) u++ }
  return u
}

function Barra({ label, real, meta, cor }) {
  const p = pct(real, meta)
  const c = cor || (p >= 100 ? '#10b981' : p >= 70 ? '#00d4ff' : p >= 40 ? '#f59e0b' : '#ef4444')
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
        <span style={{ fontSize: 12, color: '#94a3b8' }}>{label}</span>
        <span style={{ fontSize: 12, color: c, fontWeight: 700 }}>{fmtK(real)} / {fmtK(meta)} ({p}%)</span>
      </div>
      <div style={{ height: 7, background: '#1a2540', borderRadius: 4, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${p}%`, background: c, borderRadius: 4, transition: 'width .6s' }} />
      </div>
    </div>
  )
}

function KpiCard({ label, valor, sub, cor, icon }) {
  return (
    <div style={{ background: '#111827', border: '1px solid #1e2d4a', borderRadius: 13, padding: '16px', position: 'relative', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: cor || '#00d4ff' }} />
      <div style={{ fontSize: 18, marginBottom: 8 }}>{icon}</div>
      <div style={{ fontFamily: 'Syne,sans-serif', fontSize: 22, fontWeight: 800, color: cor || '#00d4ff', marginBottom: 4 }}>{valor}</div>
      <div style={{ fontSize: 10, color: '#e2e8f0', textTransform: 'uppercase', letterSpacing: .8, marginBottom: 3 }}>{label}</div>
      {sub && <div style={{ fontSize: 10, color: '#64748b' }}>{sub}</div>}
    </div>
  )
}

function GraficoBarras({ dados, altura = 120, moeda = true }) {
  if (!dados?.length) return <div style={{ color: '#64748b', fontSize: 12, textAlign: 'center', padding: 20 }}>Sem dados</div>
  const max = Math.max(...dados.map(d => d.valor), 1)
  const larg = 100 / dados.length
  const h = altura
  return (
    <svg width="100%" height={h + 28} style={{ overflow: 'visible' }}>
      {dados.map((d, i) => {
        const bh = Math.max(4, (d.valor / max) * h)
        const x = i * larg + larg * 0.1, w = larg * 0.8
        return (
          <g key={i}>
            <rect x={`${x}%`} y={h - bh} width={`${w}%`} height={bh} rx="4" fill={d.cor || '#00d4ff'} opacity={0.8} />
            <text x={`${x + w / 2}%`} y={h + 16} textAnchor="middle" style={{ fontSize: 9, fill: '#64748b', fontFamily: 'DM Mono' }}>{d.label}</text>
            {d.valor > 0 && <text x={`${x + w / 2}%`} y={h - bh - 5} textAnchor="middle" style={{ fontSize: 9, fill: '#e2e8f0', fontFamily: 'DM Mono' }}>{moeda ? fmtK(d.valor) : d.valor}</text>}
          </g>
        )
      })}
    </svg>
  )
}

export default function Reports() {
  const router = useRouter()
  const { aba: abaQuery } = router.query

  const [loading,   setLoading]   = useState(true)
  const [cfg,       setCfg]       = useState({})
  const [empresaId, setEmpresaId] = useState(null)
  const [perfil,    setPerfil]    = useState(null)
  const [session,   setSession]   = useState(null)
  const [aba,       setAba]       = useState('estrategico')
  const [mesFiltro, setMesFiltro] = useState(mesAtual())
  const [userFiltro, setUserFiltro] = useState('todos')

  useEffect(() => { if (abaQuery) setAba(abaQuery) }, [abaQuery])

  useEffect(() => {
    async function init() {
      const { data: { session: sess } } = await supabase.auth.getSession()
      if (!sess) { router.replace('/'); return }
      setSession(sess)

      let { data: perf } = await supabase.from('perfis').select('*').eq('user_id', sess.user.id).maybeSingle()
      if (!perf) {
        const nome = sess.user.email?.split('@')[0] || 'Usuário'
        const { data: np } = await supabase.from('perfis').insert({ user_id: sess.user.id, nome, email: sess.user.email, empresa_id: sess.user.id, perfil: 'admin' }).select().single()
        perf = np
      }
      setPerfil(perf)
      const eid = perf?.empresa_id || sess.user.id
      setEmpresaId(eid)

      const { data: row } = await supabase.from('vx_storage').select('value').eq('key', `cfg:${eid}`).single()
      if (row?.value) setCfg(JSON.parse(row.value))
      setLoading(false)
    }
    init()
  }, [router])

  // ── Derivações de dados ──────────────────────────────────────
  const historico  = cfg.historico  || []
  const kpiLog     = cfg.kpiLog     || []
  const kpiTpls    = cfg.kpiTemplates || []
  const metas      = cfg.metas      || {}
  const negocios   = cfg.crm_negocios  || []
  const atividades = cfg.crm_atividades || []
  const usuarios   = cfg.usuarios   || []
  const contas     = cfg.contas     || []
  const tarefas    = cfg.tarefas    || []

  const histMes = historico.filter(h => (h.date || '').startsWith(mesFiltro))

  // Financeiro
  const receitaMes  = histMes.reduce((a, h) => a + Number(h.tMenD || h.mensalidade || 0), 0)
  const adesaoMes   = histMes.reduce((a, h) => a + Number(h.tAdD  || h.adesao     || 0), 0)
  const contasRec   = contas.filter(c => c.tipo === 'Receita'  && (c.vencimento || '').startsWith(mesFiltro))
  const contasPag   = contas.filter(c => c.tipo === 'Despesa'  && (c.vencimento || '').startsWith(mesFiltro))
  const totalRec    = contasRec.reduce((a, c) => a + Number(c.valor || 0), 0)
  const totalPag    = contasPag.reduce((a, c) => a + Number(c.valor || 0), 0)
  const saldo       = totalRec - totalPag

  // Vendas
  const contratosMes    = histMes.length
  const ticketMedio     = contratosMes > 0 ? receitaMes / contratosMes : 0
  const mesesAnteriores = [-5,-4,-3,-2,-1,0].map(d => {
    const dt = new Date(); dt.setMonth(dt.getMonth() + d)
    const ym = dt.toISOString().slice(0,7)
    const label = dt.toLocaleDateString('pt-BR', { month: 'short' })
    const valor = historico.filter(h => (h.date||'').startsWith(ym)).reduce((a,h) => a + Number(h.tMenD||h.mensalidade||0), 0)
    const qtd   = historico.filter(h => (h.date||'').startsWith(ym)).length
    return { ym, label, valor, qtd, cor: ym === mesFiltro ? '#00d4ff' : '#1e2d4a' }
  })

  // KPIs
  const hojeStr = new Date().toISOString().slice(0,10)
  const kpiHoje = kpiLog.filter(l => l.date === hojeStr)
  const diasUteis = diasUteisNoMes(mesFiltro)
  const kpiMes = kpiLog.filter(l => (l.date||'').startsWith(mesFiltro))

  // CRM
  const ETAPAS = ['lead','lead_qualificado','lead_marketing','reuniao_agendada','atendimento','proposta_enviada','fechamento','perdido']
  const negPorEtapa = ETAPAS.map(e => ({ etapa: e, qtd: negocios.filter(n => n.etapa === e).length }))
  const taxaConversao = negocios.length > 0 ? Math.round((negocios.filter(n => n.etapa === 'fechamento').length / negocios.length) * 100) : 0
  const ativsAtrasadas = atividades.filter(a => !a.concluida && a.prazo && new Date(a.prazo) < new Date()).length
  const ativsHoje      = atividades.filter(a => !a.concluida && a.prazo && a.prazo.slice(0,10) === hojeStr).length

  // Produtos (módulos)
  const modContagem = {}
  histMes.forEach(h => {
    const mods = h.modulos ? (Array.isArray(h.modulos) ? h.modulos : h.modulos.split(',')) : []
    mods.forEach(m => { modContagem[m] = (modContagem[m] || 0) + 1 })
  })
  const topMods = Object.entries(modContagem).sort((a,b) => b[1]-a[1]).slice(0,6)

  // Comissões por consultor
  const comissoesPorUser = {}
  histMes.forEach(h => {
    const uid = h.userId || h.consultantId || 'desconhecido'
    const nome = h.consultor || h.userName || uid
    if (!comissoesPorUser[uid]) comissoesPorUser[uid] = { nome, contratos: 0, mensalidade: 0, adesao: 0 }
    comissoesPorUser[uid].contratos++
    comissoesPorUser[uid].mensalidade += Number(h.tMenD || h.mensalidade || 0)
    comissoesPorUser[uid].adesao += Number(h.tAdD || h.adesao || 0)
  })

  // Tarefas por status
  const tarefasPorStatus = { Pendente: 0, 'Em Andamento': 0, Concluída: 0, Cancelada: 0 }
  tarefas.forEach(t => { if (tarefasPorStatus[t.status] !== undefined) tarefasPorStatus[t.status]++ })

  if (loading) return (
    <div style={{ background: '#0a0f1e', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b', fontFamily: 'DM Mono,monospace' }}>
      Carregando relatórios...
    </div>
  )

  const ABAS = [
    { id: 'estrategico', label: '🎯 Visão Estratégica' },
    { id: 'financeiro',  label: '💰 Financeiro' },
    { id: 'kpis',        label: '📊 KPIs da Equipe' },
    { id: 'vendas',      label: '🛒 Vendas' },
    { id: 'comercial',   label: '💼 Comercial / CRM' },
    { id: 'produtos',    label: '📦 Produtos' },
    { id: 'fiscal',      label: '📄 Fiscal' },
  ]

  return (
    <>
      <Head>
        <title>Relatórios — {cfg.company || 'Vivanexa'}</title>
        <link href="https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=DM+Mono:wght@400;500&display=swap" rel="stylesheet" />
      </Head>
      <style>{CSS}</style>

      <Navbar cfg={cfg} perfil={perfil} />

      <div className="rp-wrap">
        {/* Header */}
        <div className="rp-hdr">
          <div>
            <h1 className="rp-title">📈 Relatórios Estratégicos</h1>
            <p className="rp-sub">Visão completa do negócio em tempo real</p>
          </div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <div>
              <label className="field-label">Período</label>
              <input type="month" value={mesFiltro} onChange={e => setMesFiltro(e.target.value)}
                style={{ background: '#1a2540', border: '1px solid #1e2d4a', borderRadius: 8, padding: '7px 10px', fontFamily: 'DM Mono,monospace', fontSize: 12, color: '#e2e8f0', outline: 'none' }} />
            </div>
          </div>
        </div>

        {/* Abas */}
        <div className="tabs">
          {ABAS.map(a => (
            <button key={a.id} className={`tab-btn${aba === a.id ? ' active' : ''}`} onClick={() => setAba(a.id)}>{a.label}</button>
          ))}
        </div>

        {/* ══ VISÃO ESTRATÉGICA ══ */}
        {aba === 'estrategico' && (
          <div>
            {/* KPIs principais */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14, marginBottom: 22 }}>
              <KpiCard label="Receita do Mês"    valor={fmtK(receitaMes)}          sub={`${contratosMes} contratos`}       cor="#10b981" icon="💰" />
              <KpiCard label="Adesão do Mês"     valor={fmtK(adesaoMes)}            sub="Receita de novos contratos"        cor="#00d4ff" icon="📝" />
              <KpiCard label="Ticket Médio"      valor={fmtK(ticketMedio)}          sub="Mensalidade média/contrato"        cor="#7c3aed" icon="🎯" />
              <KpiCard label="Taxa de Conversão" valor={`${taxaConversao}%`}        sub={`${negocios.length} leads totais`} cor="#f59e0b" icon="📊" />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14, marginBottom: 22 }}>
              <KpiCard label="Leads Ativos"      valor={fmtN(negocios.filter(n=>n.etapa!=='fechamento'&&n.etapa!=='perdido').length)} sub="Em negociação"       cor="#06b6d4" icon="🤝" />
              <KpiCard label="Ativ. Atrasadas"   valor={fmtN(ativsAtrasadas)} sub="Precisam de atenção"     cor="#ef4444" icon="⚠️" />
              <KpiCard label="Ativ. Hoje"        valor={fmtN(ativsHoje)}      sub="Agendadas para hoje"     cor="#f59e0b" icon="📅" />
              <KpiCard label="Saldo do Mês"      valor={fmtK(saldo)}          sub="Rec - Desp financeiro"   cor={saldo>=0?"#10b981":"#ef4444"} icon="💳" />
            </div>

            {/* Gráfico evolução + funil */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18, marginBottom: 22 }}>
              <div className="card">
                <div className="card-title">📈 Receita — Últimos 6 Meses</div>
                <GraficoBarras dados={mesesAnteriores.map(m => ({ label: m.label, valor: m.valor, cor: m.ym === mesFiltro ? '#00d4ff' : '#334155' }))} altura={140} />
              </div>
              <div className="card">
                <div className="card-title">🔢 Contratos — Últimos 6 Meses</div>
                <GraficoBarras dados={mesesAnteriores.map(m => ({ label: m.label, valor: m.qtd, cor: m.ym === mesFiltro ? '#7c3aed' : '#334155' }))} altura={140} moeda={false} />
              </div>
            </div>

            {/* Análise estratégica */}
            <div className="card">
              <div className="card-title">🧠 Análise Estratégica — {new Date(mesFiltro + '-01').toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 14 }}>
                {/* Saúde comercial */}
                <div style={{ background: '#1a2540', border: '1px solid #1e2d4a', borderRadius: 12, padding: 16 }}>
                  <div style={{ fontSize: 11, color: '#00d4ff', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 }}>💼 Saúde Comercial</div>
                  {[
                    { l: 'Contratos fechados', v: contratosMes },
                    { l: 'Leads no pipeline', v: negocios.filter(n=>n.etapa!=='fechamento'&&n.etapa!=='perdido').length },
                    { l: 'Taxa de conversão', v: `${taxaConversao}%` },
                    { l: 'Atividades pendentes', v: atividades.filter(a=>!a.concluida).length },
                  ].map(r => (
                    <div key={r.l} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: '1px solid #1e2d4a', fontSize: 12 }}>
                      <span style={{ color: '#64748b' }}>{r.l}</span>
                      <span style={{ color: '#e2e8f0', fontWeight: 700 }}>{r.v}</span>
                    </div>
                  ))}
                </div>
                {/* Saúde financeira */}
                <div style={{ background: '#1a2540', border: '1px solid #1e2d4a', borderRadius: 12, padding: 16 }}>
                  <div style={{ fontSize: 11, color: '#10b981', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 }}>💰 Saúde Financeira</div>
                  {[
                    { l: 'Receita mensal', v: fmtK(receitaMes) },
                    { l: 'Adesões', v: fmtK(adesaoMes) },
                    { l: 'Contas a receber', v: fmtK(totalRec) },
                    { l: 'Contas a pagar', v: fmtK(totalPag) },
                    { l: 'Saldo', v: fmtK(saldo), cor: saldo >= 0 ? '#10b981' : '#ef4444' },
                  ].map(r => (
                    <div key={r.l} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: '1px solid #1e2d4a', fontSize: 12 }}>
                      <span style={{ color: '#64748b' }}>{r.l}</span>
                      <span style={{ color: r.cor || '#e2e8f0', fontWeight: 700 }}>{r.v}</span>
                    </div>
                  ))}
                </div>
                {/* Produtividade */}
                <div style={{ background: '#1a2540', border: '1px solid #1e2d4a', borderRadius: 12, padding: 16 }}>
                  <div style={{ fontSize: 11, color: '#7c3aed', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 }}>⚡ Produtividade</div>
                  {[
                    { l: 'Tarefas pendentes',   v: tarefasPorStatus['Pendente'] },
                    { l: 'Tarefas em andamento', v: tarefasPorStatus['Em Andamento'] },
                    { l: 'Tarefas concluídas',  v: tarefasPorStatus['Concluída'] },
                    { l: 'KPIs lançados hoje',  v: kpiHoje.length },
                  ].map(r => (
                    <div key={r.l} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: '1px solid #1e2d4a', fontSize: 12 }}>
                      <span style={{ color: '#64748b' }}>{r.l}</span>
                      <span style={{ color: '#e2e8f0', fontWeight: 700 }}>{r.v}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ══ FINANCEIRO ══ */}
        {aba === 'financeiro' && (
          <div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 14, marginBottom: 22 }}>
              <KpiCard label="Total a Receber" valor={fmtK(totalRec)}  sub={`${contasRec.length} lançamentos`}  cor="#10b981" icon="💵" />
              <KpiCard label="Total a Pagar"   valor={fmtK(totalPag)}  sub={`${contasPag.length} lançamentos`}  cor="#ef4444" icon="💸" />
              <KpiCard label="Saldo do Mês"    valor={fmtK(saldo)}     sub="Receitas - Despesas"                 cor={saldo>=0?"#10b981":"#ef4444"} icon="💰" />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18, marginBottom: 22 }}>
              <div className="card">
                <div className="card-title">📈 Receita por Mês</div>
                <GraficoBarras dados={mesesAnteriores.map(m => ({ label: m.label, valor: m.valor, cor: '#10b981' }))} altura={130} />
              </div>
              <div className="card">
                <div className="card-title">📋 Lançamentos do Mês</div>
                {contas.filter(c => (c.vencimento||'').startsWith(mesFiltro)).length === 0
                  ? <div style={{ color: '#64748b', fontSize: 12, textAlign: 'center', padding: 20 }}>Sem lançamentos</div>
                  : contas.filter(c => (c.vencimento||'').startsWith(mesFiltro)).slice(0,8).map((c,i) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #1e2d4a', fontSize: 12 }}>
                      <div>
                        <div style={{ color: '#e2e8f0' }}>{c.descricao}</div>
                        <div style={{ color: '#64748b', fontSize: 10 }}>{c.status} · {c.vencimento}</div>
                      </div>
                      <div style={{ fontWeight: 700, color: c.tipo === 'Receita' ? '#10b981' : '#ef4444', flexShrink: 0, marginLeft: 10 }}>
                        {c.tipo === 'Receita' ? '+' : '-'}{fmt(c.valor)}
                      </div>
                    </div>
                  ))
                }
              </div>
            </div>
          </div>
        )}

        {/* ══ KPIs DA EQUIPE ══ */}
        {aba === 'kpis' && (
          <div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14, marginBottom: 22 }}>
              <KpiCard label="KPIs Configurados"  valor={kpiTpls.length}              sub="Indicadores ativos"            cor="#00d4ff" icon="📊" />
              <KpiCard label="Lançamentos Hoje"    valor={kpiHoje.length}              sub="Registros do dia atual"        cor="#10b981" icon="✅" />
              <KpiCard label="Lançamentos no Mês" valor={kpiMes.length}               sub={`de ${diasUteis} dias úteis`}  cor="#7c3aed" icon="📅" />
              <KpiCard label="Dias Úteis no Mês"  valor={diasUteis}                   sub={mesFiltro}                    cor="#f59e0b" icon="📆" />
            </div>

            {kpiTpls.length === 0 ? (
              <div className="card" style={{ textAlign: 'center', padding: 40 }}>
                <div style={{ fontSize: 40, marginBottom: 12 }}>📊</div>
                <div style={{ color: '#64748b', marginBottom: 16 }}>Nenhum KPI configurado</div>
                <button className="btn-primary" onClick={() => router.push('/configuracoes?tab=kpis')}>Configurar KPIs →</button>
              </div>
            ) : (
              <div>
                {kpiTpls.map(k => {
                  const logsMes = kpiMes.filter(l => l.kpiId === k.id)
                  const totalReal = logsMes.reduce((a,l) => a + Number(l.realizado || 0), 0)
                  const metaDiaria = Number(cfg.kpiDailyGoals?.[session?.user?.id]?.[k.id] || 0)
                  const metaMes = metaDiaria * diasUteis
                  const p = metaMes > 0 ? Math.min(100, Math.round((totalReal / metaMes) * 100)) : null
                  const cor = !p ? '#64748b' : p >= 100 ? '#10b981' : p >= 70 ? '#00d4ff' : p >= 40 ? '#f59e0b' : '#ef4444'

                  // Por usuário
                  const porUser = {}
                  logsMes.forEach(l => { if (!porUser[l.userId]) porUser[l.userId] = { nome: l.userName, total: 0 }; porUser[l.userId].total += Number(l.realizado || 0) })

                  return (
                    <div key={k.id} className="card" style={{ marginBottom: 14 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                        <span style={{ fontSize: 24 }}>{k.icone || '📊'}</span>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontFamily: 'Syne,sans-serif', fontSize: 15, fontWeight: 700, color: '#e2e8f0' }}>{k.nome}</div>
                          <div style={{ fontSize: 11, color: '#64748b' }}>Meta: {metaDiaria}/dia · {metaMes}/{mesFiltro}</div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontFamily: 'Syne,sans-serif', fontSize: 22, fontWeight: 800, color: cor }}>{fmtN(totalReal)}</div>
                          <div style={{ fontSize: 10, color: '#64748b' }}>{p !== null ? `${p}% da meta` : 'Sem meta'}</div>
                        </div>
                      </div>
                      {p !== null && (
                        <div style={{ height: 8, background: '#1a2540', borderRadius: 4, overflow: 'hidden', marginBottom: 14 }}>
                          <div style={{ height: '100%', width: `${p}%`, background: cor, borderRadius: 4, transition: 'width .6s' }} />
                        </div>
                      )}
                      {Object.keys(porUser).length > 0 && (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(160px,1fr))', gap: 8 }}>
                          {Object.entries(porUser).map(([uid, u]) => (
                            <div key={uid} style={{ background: '#1a2540', border: '1px solid #1e2d4a', borderRadius: 8, padding: '8px 12px' }}>
                              <div style={{ fontSize: 10, color: '#64748b', marginBottom: 3 }}>👤 {u.nome || uid}</div>
                              <div style={{ fontSize: 16, fontWeight: 700, color: '#e2e8f0' }}>{fmtN(u.total)} {k.unidade || ''}</div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* ══ VENDAS ══ */}
        {aba === 'vendas' && (
          <div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14, marginBottom: 22 }}>
              <KpiCard label="Contratos"    valor={contratosMes}       sub="Fechados no mês"      cor="#00d4ff" icon="📝" />
              <KpiCard label="Receita"      valor={fmtK(receitaMes)}   sub="Mensalidades"          cor="#10b981" icon="💰" />
              <KpiCard label="Adesão"       valor={fmtK(adesaoMes)}    sub="Entradas de caixa"     cor="#7c3aed" icon="📥" />
              <KpiCard label="Ticket Médio" valor={fmtK(ticketMedio)}  sub="Por contrato"          cor="#f59e0b" icon="🎯" />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18 }}>
              <div className="card">
                <div className="card-title">📈 Evolução de Receita</div>
                <GraficoBarras dados={mesesAnteriores.map(m => ({ label: m.label, valor: m.valor, cor: '#00d4ff' }))} altura={130} />
              </div>
              <div className="card">
                <div className="card-title">🏆 Ranking de Consultores</div>
                {Object.keys(comissoesPorUser).length === 0
                  ? <div style={{ color: '#64748b', fontSize: 12, textAlign: 'center', padding: 20 }}>Sem dados neste período</div>
                  : Object.values(comissoesPorUser).sort((a,b) => b.contratos-a.contratos).map((u,i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: '1px solid #1e2d4a' }}>
                      <div style={{ width: 28, height: 28, borderRadius: '50%', background: i===0?'#f59e0b':i===1?'#94a3b8':'#cd7c32', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: '#000', flexShrink: 0 }}>{i+1}</div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: '#e2e8f0' }}>{u.nome}</div>
                        <div style={{ fontSize: 10, color: '#64748b' }}>{u.contratos} contratos · Adesão: {fmtK(u.adesao)}</div>
                      </div>
                      <div style={{ textAlign: 'right', flexShrink: 0 }}>
                        <div style={{ fontSize: 14, fontWeight: 800, color: '#10b981' }}>{fmtK(u.mensalidade)}</div>
                        <div style={{ fontSize: 10, color: '#64748b' }}>mensalidade</div>
                      </div>
                    </div>
                  ))
                }
              </div>
            </div>
          </div>
        )}

        {/* ══ COMERCIAL / CRM ══ */}
        {aba === 'comercial' && (
          <div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14, marginBottom: 22 }}>
              <KpiCard label="Total Leads"     valor={negocios.length}          sub="No CRM"               cor="#00d4ff" icon="🎯" />
              <KpiCard label="Em Negociação"   valor={negocios.filter(n=>n.etapa!=='fechamento'&&n.etapa!=='perdido').length} sub="Pipeline ativo" cor="#7c3aed" icon="🔄" />
              <KpiCard label="Fechamentos"     valor={negocios.filter(n=>n.etapa==='fechamento').length}   sub="Total geral"      cor="#10b981" icon="🏆" />
              <KpiCard label="Perdidos"        valor={negocios.filter(n=>n.etapa==='perdido').length}      sub="Total geral"      cor="#ef4444" icon="❌" />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18 }}>
              <div className="card">
                <div className="card-title">🔢 Funil de Vendas — Por Etapa</div>
                {negPorEtapa.filter(e => e.qtd > 0).map(e => (
                  <div key={e.etapa} style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
                    <div style={{ width: 120, fontSize: 11, color: '#94a3b8', textTransform: 'capitalize', flexShrink: 0 }}>
                      {e.etapa.replace(/_/g,' ')}
                    </div>
                    <div style={{ flex: 1, height: 22, background: '#1a2540', borderRadius: 4, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${Math.max(5,(e.qtd/Math.max(1,negocios.length))*100)}%`, background: '#00d4ff', borderRadius: 4, display: 'flex', alignItems: 'center', paddingLeft: 8 }}>
                        <span style={{ fontSize: 10, fontWeight: 700, color: '#000' }}>{e.qtd}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <div className="card">
                <div className="card-title">📅 Atividades</div>
                {[
                  { l: 'Atrasadas',     v: ativsAtrasadas, cor: '#ef4444' },
                  { l: 'Para hoje',     v: ativsHoje,      cor: '#f59e0b' },
                  { l: 'Futuras',       v: atividades.filter(a=>!a.concluida&&a.prazo&&new Date(a.prazo)>new Date()&&a.prazo.slice(0,10)!==hojeStr).length, cor: '#64748b' },
                  { l: 'Concluídas',    v: atividades.filter(a=>a.concluida).length, cor: '#10b981' },
                ].map(r => (
                  <div key={r.l} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid #1e2d4a', fontSize: 13 }}>
                    <span style={{ color: '#94a3b8' }}>{r.l}</span>
                    <span style={{ fontWeight: 800, color: r.cor, fontFamily: 'Syne,sans-serif', fontSize: 16 }}>{r.v}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ══ PRODUTOS ══ */}
        {aba === 'produtos' && (
          <div>
            <div className="card" style={{ marginBottom: 18 }}>
              <div className="card-title">📦 Módulos Mais Vendidos — {mesFiltro}</div>
              {topMods.length === 0
                ? <div style={{ color: '#64748b', fontSize: 12, textAlign: 'center', padding: 20 }}>Sem dados neste período</div>
                : topMods.map(([mod, qtd], i) => (
                  <div key={mod} style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 12 }}>
                    <div style={{ width: 24, fontFamily: 'Syne,sans-serif', fontSize: 14, fontWeight: 800, color: '#64748b' }}>#{i+1}</div>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                        <span style={{ fontSize: 13, color: '#e2e8f0', fontWeight: 600 }}>{cfg.productNames?.[mod] || mod}</span>
                        <span style={{ fontSize: 12, color: '#00d4ff', fontWeight: 700 }}>{qtd} contratos</span>
                      </div>
                      <div style={{ height: 6, background: '#1a2540', borderRadius: 3, overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${Math.round((qtd/Math.max(1,topMods[0][1]))*100)}%`, background: `hsl(${190 - i*20},80%,55%)`, borderRadius: 3 }} />
                      </div>
                    </div>
                  </div>
                ))
              }
            </div>
          </div>
        )}

        {/* ══ FISCAL ══ */}
        {aba === 'fiscal' && (
          <div className="card">
            <div className="card-title">📄 Relatório Fiscal</div>
            <p style={{ fontSize: 13, color: '#64748b', marginBottom: 20, lineHeight: 1.7 }}>
              Integração com módulo Fiscal para relatórios de NF-e, NFS-e e NFC-e emitidas.
              Acesse <strong style={{ color: '#00d4ff', cursor: 'pointer' }} onClick={() => router.push('/fiscal')}>Módulo Fiscal</strong> para emitir e gerenciar notas.
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12 }}>
              {[
                { label: 'NF de Produto',    icon: '📦', href: '/fiscal?aba=produto' },
                { label: 'NF de Serviço',    icon: '🛠️', href: '/fiscal?aba=servico' },
                { label: 'NF do Consumidor', icon: '🧾', href: '/fiscal?aba=consumidor' },
              ].map(n => (
                <div key={n.label} onClick={() => router.push(n.href)} style={{ background: '#1a2540', border: '1px solid #1e2d4a', borderRadius: 12, padding: '20px 16px', textAlign: 'center', cursor: 'pointer', transition: 'border-color .14s' }}
                  onMouseEnter={e => e.currentTarget.style.borderColor='rgba(0,212,255,.4)'}
                  onMouseLeave={e => e.currentTarget.style.borderColor='#1e2d4a'}
                >
                  <div style={{ fontSize: 28, marginBottom: 10 }}>{n.icon}</div>
                  <div style={{ fontFamily: 'Syne,sans-serif', fontSize: 13, fontWeight: 700, color: '#e2e8f0', marginBottom: 6 }}>{n.label}</div>
                  <div style={{ fontSize: 11, color: '#00d4ff' }}>Acessar módulo →</div>
                </div>
              ))}
            </div>
          </div>
        )}

      </div>
    </>
  )
}

const CSS = `
  :root{--bg:#0a0f1e;--surface:#111827;--surface2:#1a2540;--border:#1e2d4a;--accent:#00d4ff;--text:#e2e8f0;--muted:#64748b;--danger:#ef4444;--gold:#f59e0b;--accent3:#10b981}
  *{box-sizing:border-box;margin:0;padding:0}
  body{background:var(--bg);color:var(--text);font-family:'DM Mono',monospace;min-height:100vh}
  body::before{content:'';position:fixed;inset:0;background-image:linear-gradient(rgba(0,212,255,.018) 1px,transparent 1px),linear-gradient(90deg,rgba(0,212,255,.018) 1px,transparent 1px);background-size:44px 44px;pointer-events:none;z-index:0}
  .rp-wrap{max-width:1280px;margin:0 auto;padding:24px 20px 60px;position:relative;z-index:1}
  .rp-hdr{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;margin-bottom:20px;flex-wrap:wrap}
  .rp-title{font-family:'Syne',sans-serif;font-size:22px;font-weight:800;margin-bottom:4px}
  .rp-sub{font-size:12px;color:var(--muted)}
  .tabs{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:24px;border-bottom:1px solid var(--border);padding-bottom:12px}
  .tab-btn{padding:8px 14px;border-radius:8px;border:1px solid var(--border);background:var(--surface2);color:var(--muted);font-family:'DM Mono',monospace;font-size:11.5px;cursor:pointer;transition:all .14s;white-space:nowrap}
  .tab-btn.active{background:rgba(0,212,255,.12);border-color:rgba(0,212,255,.4);color:var(--accent);font-weight:600}
  .card{background:var(--surface);border:1px solid var(--border);border-radius:14px;padding:20px}
  .card-title{font-family:'Syne',sans-serif;font-size:14px;font-weight:700;color:var(--text);margin-bottom:16px;display:flex;align-items:center;gap:8px}
  .field-label{font-size:11px;color:var(--muted);display:block;margin-bottom:4px;letter-spacing:.5px}
  .btn-primary{display:flex;align-items:center;gap:6px;padding:9px 18px;background:linear-gradient(135deg,var(--accent),#0099bb);border:none;border-radius:9px;color:#fff;font-family:'DM Mono',monospace;font-size:12px;font-weight:600;cursor:pointer;transition:all .18s;white-space:nowrap}
  .btn-primary:hover{box-shadow:0 0 16px rgba(0,212,255,.35);transform:translateY(-1px)}
  @media(max-width:900px){.rp-hdr{flex-direction:column}}
`
