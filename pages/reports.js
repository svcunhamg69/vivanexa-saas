// pages/reports.js — v4 com relatórios completos + gerador personalizado
import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/router'
import Head from 'next/head'
import { supabase } from '../lib/supabase'
import Navbar from '../components/Navbar'

// ── HELPERS ──
const fmt   = n => 'R$ ' + Number(n || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })
const fmtK  = v => v >= 1000 ? `R$ ${(v / 1000).toFixed(1)}k` : fmt(v)
const fmtN  = n => Number(n || 0).toLocaleString('pt-BR')
const pct   = (r, m) => !m ? 0 : Math.min(100, Math.round((r / m) * 100))
const mesAtual = () => new Date().toISOString().slice(0, 7)
const fmtDate  = s => { if (!s) return '—'; try { return new Date(s + 'T12:00:00').toLocaleDateString('pt-BR') } catch { return s } }

function diasUteisNoMes(ym) {
  const [y, m] = ym.split('-').map(Number)
  const dias = new Date(y, m, 0).getDate()
  let u = 0
  for (let d = 1; d <= dias; d++) { const dw = new Date(y, m - 1, d).getDay(); if (dw !== 0 && dw !== 6) u++ }
  return u
}

// Calcula comissão de um usuário sobre um contrato
function calcComissao(contrato, usuario) {
  const com = usuario?.comissao
  if (!com) return { adesao: 0, mensalidade: 0 }
  const adesao = com.adesao?.tipo === 'percentual'
    ? (Number(contrato.valorAdesao || 0) * (Number(com.adesao.valor) || 0)) / 100
    : Number(com.adesao?.valor || 0)
  const mensalidade = com.mensalidade?.tipo === 'percentual'
    ? (Number(contrato.valorMensalidade || 0) * (Number(com.mensalidade.valor) || 0)) / 100
    : Number(com.mensalidade?.valor || 0)
  return { adesao, mensalidade }
}

// ── COMPONENTES VISUAIS ──
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

const ABAS_REPORTS = [
  { id: 'estrategico', label: '🎯 Visão Estratégica' },
  { id: 'vendas',      label: '🛒 Vendas' },
  { id: 'produtos',    label: '📦 Vendas por Produto' },
  { id: 'kpis',        label: '📊 KPIs' },
  { id: 'comissoes',   label: '🏆 Comissões' },
  { id: 'crm_atividades', label: '📋 Atividades CRM' },
  { id: 'crm_negocios',   label: '🤝 Negócios CRM' },
  { id: 'disparos',    label: '📣 Disparos em Massa' },
  { id: 'marketing',   label: '📣 Marketing' },
  { id: 'gerador',     label: '⚙️ Gerador de Relatório' },
]

export default function Reports() {
  const router = useRouter()
  const { aba: abaQuery } = router.query

  const [loading,    setLoading]    = useState(true)
  const [cfg,        setCfg]        = useState({})
  const [empresaId,  setEmpresaId]  = useState(null)
  const [perfil,     setPerfil]     = useState(null)
  const [session,    setSession]    = useState(null)
  const [aba,        setAba]        = useState('estrategico')
  const [mesFiltro,  setMesFiltro]  = useState(mesAtual())
  const [userFiltro, setUserFiltro] = useState('todos')

  useEffect(() => { if (abaQuery && ABAS_REPORTS.find(a => a.id === abaQuery)) setAba(abaQuery) }, [abaQuery])

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
      const { data: row } = await supabase.from('vx_storage').select('value').eq('key', `cfg:${eid}`).maybeSingle()
      if (row?.value) { try { setCfg(JSON.parse(row.value)) } catch {} }
      setLoading(false)
    }
    init()
  }, [router])

  const isGestor  = perfil?.perfil === 'admin' || perfil?.perfil === 'gestor' || perfil?.tipo === 'admin' || perfil?.tipo === 'gestor'
  const myId      = session?.user?.id
  const usuarios  = cfg.users || []

  // ── Normaliza contratos de múltiplas fontes ──
  const contratos = [
    ...(cfg.fin_contratos || []),
    ...(cfg.crm_negocios || [])
      .filter(n => n && (n.status === 'Fechado' || n.status === 'Ganho' || n.status === 'fechado' || n.status === 'ganho'))
      .map(n => ({
        id: n.id,
        clienteNome: n.empresa || n.nome || 'Cliente',
        vendedorId: n.vendedorId || n.responsavel_id || null,
        vendedorNome: n.vendedorNome || n.responsavel || 'N/D',
        valorAdesao: Number(n.valorAdesao || n.adesao || 0),
        valorMensalidade: Number(n.valorMensalidade || n.mensalidade || 0),
        dataFechamento: n.dataFechamento || n.updatedAt || n.criadoEm || '',
        modulos: n.modulos || [],
        status: 'fechado',
      }))
  ]

  // Contratos filtrados por mês e usuário (para vendedor, sempre só os próprios)
  const contratosFiltrado = contratos.filter(c => {
    const mes = c.dataFechamento?.slice(0, 7)
    if (mesFiltro && mes && mes !== mesFiltro) return false
    if (!isGestor && c.vendedorId !== myId && c.vendedorId !== perfil?.id) return false
    if (isGestor && userFiltro !== 'todos' && c.vendedorId !== userFiltro) return false
    return true
  })

  const totalAdesao     = contratosFiltrado.reduce((a, c) => a + (Number(c.valorAdesao) || 0), 0)
  const totalMensalidade = contratosFiltrado.reduce((a, c) => a + (Number(c.valorMensalidade) || 0), 0)

  // KPI logs filtrados
  const kpiLog = (cfg.kpiLog || []).filter(l => {
    if (mesFiltro && !l.date?.startsWith(mesFiltro)) return false
    if (!isGestor && l.userId !== myId) return false
    if (isGestor && userFiltro !== 'todos' && l.userId !== userFiltro) return false
    return true
  })

  // Metas do mês
  const goals = (cfg.goals || []).filter(g => g && g.mes === mesFiltro)

  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0a0f1e', color: '#64748b', fontFamily: 'DM Mono, monospace' }}>
      Carregando relatórios...
    </div>
  )

  return (
    <>
      <Head>
        <title>Relatórios — Vivanexa</title>
        <link href="https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=DM+Mono:wght@400;500&display=swap" rel="stylesheet" />
      </Head>
      <style>{`
        :root{--bg:#0a0f1e;--surface:#111827;--surface2:#1a2540;--border:#1e2d4a;--accent:#00d4ff;--accent2:#7c3aed;--accent3:#10b981;--text:#e2e8f0;--muted:#64748b;--danger:#ef4444;--warning:#f59e0b}
        *{box-sizing:border-box;margin:0;padding:0}
        body{font-family:'DM Mono',monospace;background:var(--bg);color:var(--text);min-height:100vh}
        input,select{background:var(--surface2);border:1px solid var(--border);border-radius:8px;padding:8px 12px;color:var(--text);font-family:'DM Mono',monospace;font-size:13px;outline:none}
        input:focus,select:focus{border-color:var(--accent)}
        table{width:100%;border-collapse:collapse}
        th{padding:10px 14px;text-align:left;font-size:11px;color:var(--muted);border-bottom:1px solid var(--border);font-weight:600;letter-spacing:.5px;background:var(--surface)}
        td{padding:11px 14px;border-bottom:1px solid rgba(30,45,74,.5);font-size:13px;vertical-align:middle}
        tr:hover td{background:rgba(0,212,255,.02)}
        tr:last-child td{border-bottom:none}
      `}</style>

      <Navbar cfg={cfg} perfil={perfil} />

      <main style={{ maxWidth: 1100, margin: '24px auto 60px', padding: '0 20px' }}>
        {/* Cabeçalho */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h1 style={{ fontFamily: 'Syne, sans-serif', fontSize: 22, fontWeight: 800, color: 'var(--accent)' }}>📈 Relatórios</h1>
            <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 3 }}>{cfg.company || 'Vivanexa'} · {perfil?.nome}</div>
          </div>
          {/* Filtros globais */}
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
            <input type="month" value={mesFiltro} onChange={e => setMesFiltro(e.target.value)} style={{ width: 150 }} />
            {isGestor && (
              <select value={userFiltro} onChange={e => setUserFiltro(e.target.value)} style={{ width: 160 }}>
                <option value="todos">Toda a equipe</option>
                {usuarios.map(u => <option key={u.id} value={u.id}>{u.nome}</option>)}
              </select>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 4, marginBottom: 24, flexWrap: 'wrap', background: 'var(--surface)', borderRadius: 10, padding: 6, border: '1px solid var(--border)' }}>
          {ABAS_REPORTS.map(a => (
            <button key={a.id} onClick={() => setAba(a.id)} style={{ padding: '7px 14px', borderRadius: 7, border: 'none', background: aba === a.id ? 'rgba(0,212,255,.15)' : 'transparent', color: aba === a.id ? 'var(--accent)' : 'var(--muted)', fontFamily: 'DM Mono, monospace', fontSize: 12, cursor: 'pointer', fontWeight: aba === a.id ? 600 : 400, transition: 'all .15s', whiteSpace: 'nowrap' }}>
              {a.label}
            </button>
          ))}
        </div>

        {/* ─── VISÃO ESTRATÉGICA ─── */}
        {aba === 'estrategico' && (
          <AbaEstrategica cfg={cfg} contratos={contratosFiltrado} kpiLog={kpiLog} goals={goals} mesFiltro={mesFiltro} isGestor={isGestor} usuarios={usuarios} userFiltro={userFiltro} />
        )}

        {/* ─── VENDAS ─── */}
        {aba === 'vendas' && (
          <AbaVendas cfg={cfg} contratos={contratosFiltrado} mesFiltro={mesFiltro} isGestor={isGestor} usuarios={usuarios} userFiltro={userFiltro} totalAdesao={totalAdesao} totalMensalidade={totalMensalidade} />
        )}

        {/* ─── VENDAS POR PRODUTO ─── */}
        {aba === 'produtos' && (
          <AbaProdutos cfg={cfg} contratos={contratosFiltrado} mesFiltro={mesFiltro} isGestor={isGestor} />
        )}

        {/* ─── KPIs ─── */}
        {aba === 'kpis' && (
          <AbaKpis cfg={cfg} kpiLog={kpiLog} goals={goals} mesFiltro={mesFiltro} isGestor={isGestor} usuarios={usuarios} userFiltro={userFiltro} session={session} perfil={perfil} />
        )}

        {/* ─── COMISSÕES ─── */}
        {aba === 'comissoes' && (
          <AbaComissoes cfg={cfg} contratos={contratosFiltrado} mesFiltro={mesFiltro} isGestor={isGestor} usuarios={usuarios} userFiltro={userFiltro} session={session} perfil={perfil} />
        )}

        {/* ─── ATIVIDADES CRM ─── */}
        {aba === 'crm_atividades' && (
          <AbaCrmAtividades cfg={cfg} mesFiltro={mesFiltro} isGestor={isGestor} usuarios={usuarios} userFiltro={userFiltro} myId={session?.user?.id} />
        )}

        {/* ─── NEGÓCIOS CRM ─── */}
        {aba === 'crm_negocios' && (
          <AbaCrmNegocios cfg={cfg} mesFiltro={mesFiltro} isGestor={isGestor} usuarios={usuarios} userFiltro={userFiltro} myId={session?.user?.id} />
        )}

        {/* ─── DISPAROS ─── */}
        {aba === 'disparos' && (
          <AbaDisparos empresaId={empresaId} mesFiltro={mesFiltro} isGestor={isGestor} />
        )}

        {/* ─── MARKETING ─── */}
        {aba === 'marketing' && (
          <AbaMarketing cfg={cfg} mesFiltro={mesFiltro} isGestor={isGestor} usuarios={usuarios} />
        )}

        {/* ─── GERADOR ─── */}
        {aba === 'gerador' && (
          <AbaGerador cfg={cfg} contratos={contratos} mesFiltro={mesFiltro} isGestor={isGestor} usuarios={usuarios} session={session} />
        )}
      </main>
    </>
  )
}

// ══════════════════════════════════════════════════════
// ABA VISÃO ESTRATÉGICA
// ══════════════════════════════════════════════════════
function AbaEstrategica({ cfg, contratos, kpiLog, goals, mesFiltro, isGestor, usuarios, userFiltro }) {
  const totalAdesao      = contratos.reduce((a, c) => a + (Number(c.valorAdesao) || 0), 0)
  const totalMensalidade = contratos.reduce((a, c) => a + (Number(c.valorMensalidade) || 0), 0)
  const qtdContratos     = contratos.length
  const ticketMedio      = qtdContratos > 0 ? totalAdesao / qtdContratos : 0

  // Metas do mês (soma de todos os usuários filtrados ou do usuário)
  const metaAdesao      = goals.reduce((a, g) => a + (Number(g.metaAdesao) || 0), 0)
  const metaMensalidade = goals.reduce((a, g) => a + (Number(g.metaMensalidade) || 0), 0)

  // KPIs: agrupa por template
  const kpiTemplates = cfg.kpiTemplates || []
  const kpiResumo = kpiTemplates.map(k => {
    const total = kpiLog.filter(l => l.kpiId === k.id).reduce((a, l) => a + (Number(l.realizado) || 0), 0)
    return { ...k, total }
  })

  // Top 3 produtos
  const produtoCount = {}
  contratos.forEach(c => (c.modulos || []).forEach(m => { produtoCount[m] = (produtoCount[m] || 0) + 1 }))
  const top3Produtos = Object.entries(produtoCount).sort((a, b) => b[1] - a[1]).slice(0, 3)

  // Projeção MRR: se tivermos dados de contratos dos últimos 3 meses
  const mrrAtual = contratos.reduce((a, c) => a + (Number(c.valorMensalidade) || 0), 0)

  return (
    <div>
      {/* KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 24 }}>
        <KpiCard label="Contratos Fechados" valor={fmtN(qtdContratos)} icon="📝" cor="#00d4ff" sub={mesFiltro} />
        <KpiCard label="Total Adesão" valor={fmtK(totalAdesao)} icon="💵" cor="#10b981" sub={metaAdesao > 0 ? `Meta: ${fmtK(metaAdesao)}` : undefined} />
        <KpiCard label="MRR (Mensalidades)" valor={fmtK(totalMensalidade)} icon="🔄" cor="#7c3aed" sub={metaMensalidade > 0 ? `Meta: ${fmtK(metaMensalidade)}` : undefined} />
        <KpiCard label="Ticket Médio Adesão" valor={fmtK(ticketMedio)} icon="🎯" cor="#f59e0b" sub="por contrato" />
      </div>

      {/* Barras de progresso vs meta */}
      {(metaAdesao > 0 || metaMensalidade > 0) && (
        <div style={card}>
          <div style={cardTitle}>📊 Progresso vs Metas — {mesFiltro}</div>
          <div style={{ marginTop: 16 }}>
            {metaAdesao > 0 && <Barra label="Adesão" real={totalAdesao} meta={metaAdesao} />}
            {metaMensalidade > 0 && <Barra label="Mensalidade" real={totalMensalidade} meta={metaMensalidade} cor="#7c3aed" />}
          </div>
        </div>
      )}

      {/* Top produtos + KPIs lado a lado */}
      <div style={{ display: 'grid', gridTemplateColumns: isGestor ? '1fr 1fr' : '1fr', gap: 16, marginTop: 16 }}>
        {top3Produtos.length > 0 && (
          <div style={card}>
            <div style={cardTitle}>📦 Top Produtos do Mês</div>
            <div style={{ marginTop: 14 }}>
              {top3Produtos.map(([nome, qtd], i) => (
                <div key={nome} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 0', borderBottom: i < top3Produtos.length - 1 ? '1px solid var(--border)' : 'none' }}>
                  <span style={{ width: 24, height: 24, borderRadius: '50%', background: ['rgba(0,212,255,.2)','rgba(124,58,237,.2)','rgba(16,185,129,.2)'][i], display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 800, color: ['#00d4ff','#7c3aed','#10b981'][i] }}>{i + 1}</span>
                  <div style={{ flex: 1, fontWeight: 600, fontSize: 13 }}>{nome}</div>
                  <span style={{ fontSize: 12, color: 'var(--muted)' }}>{qtd} contrato(s)</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {kpiResumo.length > 0 && (
          <div style={card}>
            <div style={cardTitle}>📊 KPIs do Período</div>
            <div style={{ marginTop: 14 }}>
              {kpiResumo.map(k => (
                <div key={k.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: '1px solid rgba(30,45,74,.5)' }}>
                  <span style={{ fontSize: 13, color: 'var(--muted)' }}>{k.icone} {k.nome}</span>
                  <span style={{ fontWeight: 700, color: '#00d4ff' }}>{fmtN(k.total)} {k.unidade || 'un'}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Projeção anual */}
      {mrrAtual > 0 && (
        <div style={{ ...card, marginTop: 16, borderColor: 'rgba(16,185,129,.3)' }}>
          <div style={cardTitle}>🚀 Projeção de Receita</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, marginTop: 14 }}>
            {[
              { label: 'MRR Atual', valor: fmt(mrrAtual), cor: '#10b981' },
              { label: 'ARR Projetado', valor: fmt(mrrAtual * 12), cor: '#00d4ff' },
              { label: 'Receita Adesão no Mês', valor: fmt(totalAdesao), cor: '#7c3aed' },
            ].map((c, i) => (
              <div key={i} style={{ textAlign: 'center', padding: '14px 10px', background: 'rgba(0,0,0,.2)', borderRadius: 10 }}>
                <div style={{ fontFamily: 'Syne, sans-serif', fontSize: 18, fontWeight: 800, color: c.cor }}>{c.valor}</div>
                <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>{c.label}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Análise IA (se configurada) */}
      <BotaoAnaliseIA cfg={cfg} dados={{ contratos: contratos.length, totalAdesao, totalMensalidade, mrrAtual, mesFiltro }} />
    </div>
  )
}

// ══════════════════════════════════════════════════════
// ABA VENDAS
// ══════════════════════════════════════════════════════
function AbaVendas({ cfg, contratos, mesFiltro, isGestor, usuarios, userFiltro, totalAdesao, totalMensalidade }) {
  // Agrupa contratos por vendedor
  const porVendedor = usuarios.map(u => {
    const contratsUser = contratos.filter(c => c.vendedorId === u.id)
    return {
      usuario: u,
      qtd:          contratsUser.length,
      totalAdesao:  contratsUser.reduce((a, c) => a + (Number(c.valorAdesao) || 0), 0),
      totalMens:    contratsUser.reduce((a, c) => a + (Number(c.valorMensalidade) || 0), 0),
      contratos:    contratsUser,
    }
  }).filter(v => v.qtd > 0).sort((a, b) => b.totalAdesao - a.totalAdesao)

  const goals = (cfg.goals || []).filter(g => g && g.mes === mesFiltro)

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, marginBottom: 24 }}>
        <KpiCard label="Contratos Fechados" valor={fmtN(contratos.length)} icon="📝" cor="#00d4ff" sub={mesFiltro} />
        <KpiCard label="Total Adesão" valor={fmt(totalAdesao)} icon="💵" cor="#10b981" />
        <KpiCard label="Total Mensalidade" valor={fmt(totalMensalidade)} icon="🔄" cor="#7c3aed" />
      </div>

      {/* Ranking vendedores (só gestor) */}
      {isGestor && porVendedor.length > 0 && (
        <div style={{ ...card, marginBottom: 20 }}>
          <div style={cardTitle}>🏅 Ranking de Vendedores — {mesFiltro}</div>
          <table style={{ marginTop: 14 }}>
            <thead><tr><th>#</th><th>Vendedor</th><th>Contratos</th><th>Adesão</th><th>Mensalidade</th><th>% Meta Adesão</th></tr></thead>
            <tbody>
              {porVendedor.map((v, i) => {
                const meta = goals.find(g => g.userId === v.usuario.id)
                const pctMeta = meta?.metaAdesao > 0 ? pct(v.totalAdesao, meta.metaAdesao) : null
                return (
                  <tr key={v.usuario.id}>
                    <td style={{ color: 'var(--muted)', fontSize: 12 }}>{i + 1}</td>
                    <td style={{ fontWeight: 600 }}>{v.usuario.nome}</td>
                    <td style={{ color: 'var(--muted)' }}>{v.qtd}</td>
                    <td style={{ fontWeight: 600, color: '#10b981' }}>{fmt(v.totalAdesao)}</td>
                    <td style={{ color: '#7c3aed' }}>{fmt(v.totalMens)}</td>
                    <td>
                      {pctMeta !== null
                        ? <span style={{ padding: '2px 8px', borderRadius: 20, fontSize: 11, background: pctMeta >= 100 ? 'rgba(16,185,129,.15)' : pctMeta >= 70 ? 'rgba(0,212,255,.15)' : 'rgba(245,158,11,.15)', color: pctMeta >= 100 ? '#10b981' : pctMeta >= 70 ? '#00d4ff' : '#f59e0b', border: `1px solid ${pctMeta >= 100 ? 'rgba(16,185,129,.3)' : 'rgba(0,212,255,.3)'}` }}>{pctMeta}%</span>
                        : <span style={{ color: 'var(--muted)', fontSize: 12 }}>—</span>
                      }
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Lista de contratos */}
      <div style={card}>
        <div style={cardTitle}>📋 Contratos do Período — {mesFiltro}</div>
        <table style={{ marginTop: 14 }}>
          <thead>
            <tr>
              <th>Cliente</th>
              {isGestor && <th>Vendedor</th>}
              <th>Data</th>
              <th>Adesão</th>
              <th>Mensalidade</th>
              <th>Módulos</th>
            </tr>
          </thead>
          <tbody>
            {contratos.length === 0 && <tr><td colSpan={isGestor ? 6 : 5} style={{ textAlign: 'center', color: 'var(--muted)', padding: 32 }}>Nenhum contrato no período.</td></tr>}
            {contratos.map((c, i) => (
              <tr key={c.id || i}>
                <td style={{ fontWeight: 600 }}>{c.clienteNome}</td>
                {isGestor && <td style={{ color: 'var(--muted)' }}>{c.vendedorNome || '—'}</td>}
                <td style={{ color: 'var(--muted)' }}>{fmtDate(c.dataFechamento)}</td>
                <td style={{ fontWeight: 600, color: '#10b981' }}>{fmt(c.valorAdesao)}</td>
                <td style={{ color: '#7c3aed' }}>{fmt(c.valorMensalidade)}</td>
                <td style={{ fontSize: 11, color: 'var(--muted)' }}>{(c.modulos || []).join(', ') || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════════════
// ABA VENDAS POR PRODUTO
// ══════════════════════════════════════════════════════
function AbaProdutos({ cfg, contratos, mesFiltro, isGestor }) {
  const modulos = cfg.modulos || ['Gestão Fiscal','CND','XML','BIA','IF','EP','Tributos']

  const resumo = modulos.map(mod => {
    const contratsComMod = contratos.filter(c => (c.modulos || []).includes(mod))
    const qtd = contratsComMod.length
    const adesao = contratsComMod.reduce((a, c) => {
      const prices = cfg.prices?.[mod]
      const plan = cfg.plans?.find(p => p.id === c.plano)
      const planId = plan?.id || 'basic'
      return a + (prices?.[planId]?.[0] || 0)
    }, 0)
    const mensalidade = contratsComMod.reduce((a, c) => {
      const prices = cfg.prices?.[mod]
      const plan = cfg.plans?.find(p => p.id === c.plano)
      const planId = plan?.id || 'basic'
      return a + (prices?.[planId]?.[1] || 0)
    }, 0)
    return { mod, qtd, adesao, mensalidade }
  }).filter(r => r.qtd > 0).sort((a, b) => b.qtd - a.qtd)

  const totalAdesao     = resumo.reduce((a, r) => a + r.adesao, 0)
  const totalMensalidade = resumo.reduce((a, r) => a + r.mensalidade, 0)

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, marginBottom: 24 }}>
        <KpiCard label="Produtos Vendidos" valor={fmtN(resumo.length)} icon="📦" cor="#00d4ff" sub={mesFiltro} />
        <KpiCard label="Receita Adesão" valor={fmt(totalAdesao)} icon="💵" cor="#10b981" />
        <KpiCard label="Receita Mensal" valor={fmt(totalMensalidade)} icon="🔄" cor="#7c3aed" />
      </div>

      <div style={card}>
        <div style={cardTitle}>📦 Vendas por Produto — {mesFiltro}</div>
        {resumo.length === 0 ? (
          <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--muted)', fontSize: 13 }}>Nenhuma venda com produtos identificados no período.</div>
        ) : (
          <>
            <div style={{ marginTop: 14, marginBottom: 20 }}>
              <GraficoBarras dados={resumo.map(r => ({ label: r.mod.slice(0, 8), valor: r.qtd, cor: '#00d4ff' }))} altura={100} moeda={false} />
            </div>
            <table>
              <thead><tr><th>Produto</th><th>Qtd Contratos</th><th>Receita Adesão</th><th>Receita Mensal</th><th>% do Total</th></tr></thead>
              <tbody>
                {resumo.map(r => (
                  <tr key={r.mod}>
                    <td style={{ fontWeight: 600 }}>{r.mod}</td>
                    <td><span style={{ padding: '2px 10px', borderRadius: 20, background: 'rgba(0,212,255,.12)', color: '#00d4ff', fontSize: 12, fontWeight: 700 }}>{r.qtd}</span></td>
                    <td style={{ color: '#10b981', fontWeight: 600 }}>{fmt(r.adesao)}</td>
                    <td style={{ color: '#7c3aed' }}>{fmt(r.mensalidade)}</td>
                    <td style={{ color: 'var(--muted)', fontSize: 12 }}>{contratos.length > 0 ? Math.round((r.qtd / contratos.length) * 100) : 0}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════════════
// ABA KPIs
// ══════════════════════════════════════════════════════
function AbaKpis({ cfg, kpiLog, goals, mesFiltro, isGestor, usuarios, userFiltro, session, perfil }) {
  const kpiTemplates = cfg.kpiTemplates || []
  const diasUteis = diasUteisNoMes(mesFiltro)

  // Para cada KPI, calcula realizado vs meta por usuário
  const usuariosFiltrados = isGestor
    ? (userFiltro === 'todos' ? usuarios : usuarios.filter(u => u.id === userFiltro))
    : [perfil || { id: session?.user?.id, nome: perfil?.nome || 'Eu', comissao: {} }]

  const kpiPorUsuario = usuariosFiltrados.map(u => {
    const uid = u.id || u.user_id || session?.user?.id
    const dailyGoals = cfg.kpiDailyGoals?.[uid] || {}
    const logsUser = kpiLog.filter(l => l.userId === uid)

    const kpis = kpiTemplates.map(k => {
      const realizado = logsUser.filter(l => l.kpiId === k.id).reduce((a, l) => a + (Number(l.realizado) || 0), 0)
      const metaDiaria = dailyGoals[k.id] || 0
      const metaMensal = metaDiaria * diasUteis
      return { ...k, realizado, metaMensal, metaDiaria }
    })

    return { usuario: u, kpis }
  })

  // Dias com lançamento (para gestor ver quem está em dia)
  const diasLancados = {}
  if (isGestor) {
    kpiLog.forEach(l => {
      if (!diasLancados[l.userId]) diasLancados[l.userId] = new Set()
      diasLancados[l.userId].add(l.date)
    })
  }

  return (
    <div>
      {kpiPorUsuario.map(({ usuario, kpis }) => {
        const uid = usuario.id || usuario.user_id
        const totalRealizado = kpis.reduce((a, k) => a + k.realizado, 0)
        const totalMeta      = kpis.reduce((a, k) => a + k.metaMensal, 0)
        return (
          <div key={uid} style={{ ...card, marginBottom: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <div style={cardTitle}>📊 {usuario.nome} — {mesFiltro}</div>
              {isGestor && diasLancados[uid] && (
                <span style={{ fontSize: 11, color: 'var(--muted)' }}>{diasLancados[uid].size} dia(s) lançado(s)</span>
              )}
            </div>

            {kpis.length === 0
              ? <div style={{ color: 'var(--muted)', fontSize: 13 }}>Nenhum KPI configurado.</div>
              : kpis.map(k => (
                  <Barra
                    key={k.id}
                    label={`${k.icone || '📊'} ${k.nome} (${k.unidade || 'un'})`}
                    real={k.realizado}
                    meta={k.metaMensal}
                  />
                ))
            }

            {totalMeta > 0 && (
              <div style={{ marginTop: 10, padding: '10px 14px', background: 'rgba(0,212,255,.05)', borderRadius: 8, fontSize: 12, color: 'var(--muted)' }}>
                Total geral: <strong style={{ color: '#00d4ff' }}>{fmtN(totalRealizado)}</strong> / {fmtN(totalMeta)} ({pct(totalRealizado, totalMeta)}%)
              </div>
            )}
          </div>
        )
      })}

      {/* Tabela detalhada */}
      {isGestor && kpiLog.length > 0 && (
        <div style={card}>
          <div style={cardTitle}>📋 Log Detalhado de KPIs — {mesFiltro}</div>
          <table style={{ marginTop: 14 }}>
            <thead><tr><th>Data</th><th>Usuário</th><th>KPI</th><th>Realizado</th></tr></thead>
            <tbody>
              {kpiLog.slice(0, 100).map((l, i) => (
                <tr key={i}>
                  <td style={{ color: 'var(--muted)' }}>{fmtDate(l.date)}</td>
                  <td style={{ fontWeight: 600 }}>{l.userName}</td>
                  <td style={{ color: 'var(--muted)' }}>{l.kpiNome}</td>
                  <td style={{ color: '#00d4ff', fontWeight: 600 }}>{fmtN(l.realizado)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {kpiLog.length > 100 && <div style={{ padding: '10px 14px', color: 'var(--muted)', fontSize: 12 }}>Mostrando 100 de {kpiLog.length} registros.</div>}
        </div>
      )}
    </div>
  )
}

// ══════════════════════════════════════════════════════
// ABA COMISSÕES
// ══════════════════════════════════════════════════════
function AbaComissoes({ cfg, contratos, mesFiltro, isGestor, usuarios, userFiltro, session, perfil }) {
  const comissoesDetalhadas = contratos.map(contrato => {
    const usuario = usuarios.find(u => u.id === contrato.vendedorId)
    const { adesao, mensalidade } = calcComissao(contrato, usuario)
    return { ...contrato, comissaoAdesao: adesao, comissaoMensalidade: mensalidade, totalComissao: adesao + mensalidade, usuario }
  })

  const totalComAdesao      = comissoesDetalhadas.reduce((a, c) => a + c.comissaoAdesao, 0)
  const totalComMensalidade = comissoesDetalhadas.reduce((a, c) => a + c.comissaoMensalidade, 0)
  const totalComissao       = totalComAdesao + totalComMensalidade

  const rankingComissao = isGestor
    ? usuarios.map(u => {
        const cc = comissoesDetalhadas.filter(c => c.vendedorId === u.id)
        return { usuario: u, totalAd: cc.reduce((a, c) => a + c.comissaoAdesao, 0), totalMen: cc.reduce((a, c) => a + c.comissaoMensalidade, 0), total: cc.reduce((a, c) => a + c.totalComissao, 0), qtd: cc.length }
      }).filter(r => r.qtd > 0).sort((a, b) => b.total - a.total)
    : []

  return (
    <div>
      {usuarios.filter(u => u.comissao?.adesao?.valor > 0 || u.comissao?.mensalidade?.valor > 0).length === 0 && (
        <div style={{ padding: '14px 18px', background: 'rgba(245,158,11,.08)', border: '1px solid rgba(245,158,11,.25)', borderRadius: 10, fontSize: 13, color: '#fbbf24', marginBottom: 20 }}>
          ⚠️ Configure comissões em <strong>Configurações → Usuários</strong> para ver cálculos automáticos.
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, marginBottom: 24 }}>
        <KpiCard label="Comissão Adesão" valor={fmt(totalComAdesao)} icon="💵" cor="#00d4ff" />
        <KpiCard label="Comissão Mensalidade" valor={fmt(totalComMensalidade)} icon="🔄" cor="#7c3aed" />
        <KpiCard label="Total Comissão" valor={fmt(totalComissao)} icon="🏆" cor="#10b981" sub={mesFiltro} />
      </div>

      {isGestor && rankingComissao.length > 0 && (
        <div style={{ ...card, marginBottom: 20 }}>
          <div style={cardTitle}>🏅 Ranking de Comissões — {mesFiltro}</div>
          <table style={{ marginTop: 14 }}>
            <thead><tr><th>#</th><th>Vendedor</th><th>Contratos</th><th>Com. Adesão</th><th>Com. Mensalidade</th><th>Total</th></tr></thead>
            <tbody>
              {rankingComissao.map((r, i) => (
                <tr key={r.usuario.id}>
                  <td style={{ color: 'var(--muted)' }}>{i + 1}</td>
                  <td style={{ fontWeight: 600 }}>{r.usuario.nome}</td>
                  <td style={{ color: 'var(--muted)' }}>{r.qtd}</td>
                  <td style={{ color: '#00d4ff' }}>{fmt(r.totalAd)}</td>
                  <td style={{ color: '#7c3aed' }}>{fmt(r.totalMen)}</td>
                  <td style={{ fontFamily: 'Syne, sans-serif', fontWeight: 800, color: '#10b981' }}>{fmt(r.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div style={card}>
        <div style={cardTitle}>📋 Comissões Detalhadas — {mesFiltro}</div>
        <table style={{ marginTop: 14 }}>
          <thead>
            <tr>
              <th>Cliente</th>
              {isGestor && <th>Vendedor</th>}
              <th>Data</th>
              <th>Vlr. Adesão</th>
              <th>Vlr. Mensalidade</th>
              <th>Com. Adesão</th>
              <th>Com. Mensalidade</th>
              <th>Total</th>
            </tr>
          </thead>
          <tbody>
            {comissoesDetalhadas.length === 0 && <tr><td colSpan={isGestor ? 8 : 7} style={{ textAlign: 'center', color: 'var(--muted)', padding: 32 }}>Nenhum contrato no período.</td></tr>}
            {comissoesDetalhadas.map((c, i) => (
              <tr key={c.id || i}>
                <td style={{ fontWeight: 600 }}>{c.clienteNome}</td>
                {isGestor && <td style={{ color: 'var(--muted)' }}>{c.vendedorNome || c.usuario?.nome || '—'}</td>}
                <td style={{ color: 'var(--muted)' }}>{fmtDate(c.dataFechamento)}</td>
                <td style={{ color: '#94a3b8' }}>{fmt(c.valorAdesao)}</td>
                <td style={{ color: '#94a3b8' }}>{fmt(c.valorMensalidade)}</td>
                <td style={{ color: '#00d4ff', fontWeight: 600 }}>{fmt(c.comissaoAdesao)}</td>
                <td style={{ color: '#7c3aed' }}>{fmt(c.comissaoMensalidade)}</td>
                <td style={{ fontFamily: 'Syne, sans-serif', fontWeight: 800, color: '#10b981' }}>{fmt(c.totalComissao)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════════════
// ABA CRM ATIVIDADES
// ══════════════════════════════════════════════════════
function AbaCrmAtividades({ cfg, mesFiltro, isGestor, usuarios, userFiltro, myId }) {
  const atividades = (cfg.crm_atividades || []).filter(a => {
    const mes = a.data?.slice(0, 7) || a.criadoEm?.slice(0, 7)
    if (mesFiltro && mes && mes !== mesFiltro) return false
    if (!isGestor && a.userId !== myId) return false
    if (isGestor && userFiltro !== 'todos' && a.userId !== userFiltro) return false
    return true
  })

  const porTipo = {}
  atividades.forEach(a => { porTipo[a.tipo || 'Outros'] = (porTipo[a.tipo || 'Outros'] || 0) + 1 })

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 24 }}>
        {Object.entries(porTipo).map(([tipo, qtd]) => (
          <KpiCard key={tipo} label={tipo} valor={fmtN(qtd)} icon={tipoIcon(tipo)} cor="#00d4ff" />
        ))}
        {Object.keys(porTipo).length === 0 && (
          <div style={{ gridColumn: '1/-1', ...card, textAlign: 'center', color: 'var(--muted)', padding: 32 }}>
            Nenhuma atividade registrada no período.<br />
            <span style={{ fontSize: 12, marginTop: 8, display: 'block' }}>As atividades são criadas no módulo CRM.</span>
          </div>
        )}
      </div>

      {atividades.length > 0 && (
        <div style={card}>
          <div style={cardTitle}>📋 Atividades — {mesFiltro}</div>
          <table style={{ marginTop: 14 }}>
            <thead><tr><th>Data</th>{isGestor && <th>Usuário</th>}<th>Tipo</th><th>Cliente</th><th>Resultado</th><th>Duração</th></tr></thead>
            <tbody>
              {atividades.map((a, i) => (
                <tr key={a.id || i}>
                  <td style={{ color: 'var(--muted)' }}>{fmtDate(a.data || a.criadoEm)}</td>
                  {isGestor && <td style={{ color: 'var(--muted)' }}>{usuarios.find(u => u.id === a.userId)?.nome || a.userId || '—'}</td>}
                  <td><span style={{ padding: '2px 8px', borderRadius: 20, fontSize: 11, background: 'rgba(0,212,255,.12)', color: '#00d4ff' }}>{tipoIcon(a.tipo)} {a.tipo || 'Outros'}</span></td>
                  <td style={{ fontWeight: 600 }}>{a.clienteNome || a.empresa || '—'}</td>
                  <td style={{ color: 'var(--muted)', fontSize: 12 }}>{a.resultado || '—'}</td>
                  <td style={{ color: 'var(--muted)' }}>{a.duracao ? a.duracao + 'min' : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ══════════════════════════════════════════════════════
// ABA NEGÓCIOS CRM
// ══════════════════════════════════════════════════════
function AbaCrmNegocios({ cfg, mesFiltro, isGestor, usuarios, userFiltro, myId }) {
  const negocios = (cfg.crm_negocios || []).filter(n => {
    if (!isGestor && n.vendedorId !== myId && n.responsavel_id !== myId) return false
    if (isGestor && userFiltro !== 'todos' && n.vendedorId !== userFiltro) return false
    return true
  })

  const porStatus = {}
  negocios.forEach(n => { porStatus[n.status || 'Aberto'] = (porStatus[n.status || 'Aberto'] || 0) + 1 })

  const statusCores = { 'Aberto':'#00d4ff', 'Em Negociação':'#f59e0b', 'Proposta Enviada':'#7c3aed', 'Fechado':'#10b981', 'Ganho':'#10b981', 'Perdido':'#ef4444' }

  // Tempo médio por estágio e negócios parados há mais de 7 dias
  const hoje = new Date()
  const negociosParados = negocios.filter(n => {
    if (['Fechado','Ganho','Perdido'].includes(n.status)) return false
    const ultima = new Date(n.updatedAt || n.criadoEm || hoje)
    const diasSemMover = Math.floor((hoje - ultima) / (1000 * 60 * 60 * 24))
    return diasSemMover > 7
  })

  const valorTotal   = negocios.filter(n => n.status !== 'Perdido').reduce((a, n) => a + (Number(n.valor || n.valorAdesao || 0)), 0)
  const valorFechado = negocios.filter(n => n.status === 'Fechado' || n.status === 'Ganho').reduce((a, n) => a + (Number(n.valor || n.valorAdesao || 0)), 0)
  const txConversao  = negocios.length > 0 ? Math.round((negocios.filter(n => n.status === 'Fechado' || n.status === 'Ganho').length / negocios.length) * 100) : 0

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 24 }}>
        <KpiCard label="Total Negócios" valor={fmtN(negocios.length)} icon="🤝" cor="#00d4ff" />
        <KpiCard label="Valor em Pipeline" valor={fmtK(valorTotal)} icon="💰" cor="#7c3aed" />
        <KpiCard label="Valor Fechado" valor={fmtK(valorFechado)} icon="✅" cor="#10b981" />
        <KpiCard label="Taxa de Conversão" valor={`${txConversao}%`} icon="🎯" cor="#f59e0b" />
      </div>

      {/* Funil por status */}
      <div style={{ ...card, marginBottom: 20 }}>
        <div style={cardTitle}>🔄 Pipeline por Status</div>
        <div style={{ display: 'flex', gap: 10, marginTop: 14, flexWrap: 'wrap' }}>
          {Object.entries(porStatus).map(([status, qtd]) => (
            <div key={status} style={{ flex: 1, minWidth: 120, padding: '12px 14px', background: (statusCores[status] || '#64748b') + '15', border: `1px solid ${(statusCores[status] || '#64748b')}44`, borderRadius: 10, textAlign: 'center' }}>
              <div style={{ fontFamily: 'Syne, sans-serif', fontSize: 22, fontWeight: 800, color: statusCores[status] || '#64748b' }}>{qtd}</div>
              <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>{status}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Negócios parados */}
      {negociosParados.length > 0 && (
        <div style={{ ...card, borderColor: 'rgba(245,158,11,.3)', marginBottom: 20 }}>
          <div style={{ ...cardTitle, color: '#f59e0b' }}>⚠️ Negócios Parados (+7 dias sem atualização) — {negociosParados.length}</div>
          <table style={{ marginTop: 14 }}>
            <thead><tr><th>Cliente</th>{isGestor && <th>Responsável</th>}<th>Status</th><th>Valor</th><th>Última Atividade</th></tr></thead>
            <tbody>
              {negociosParados.map((n, i) => {
                const ultima = new Date(n.updatedAt || n.criadoEm || hoje)
                const dias = Math.floor((hoje - ultima) / (1000 * 60 * 60 * 24))
                return (
                  <tr key={n.id || i}>
                    <td style={{ fontWeight: 600 }}>{n.empresa || n.nome || '—'}</td>
                    {isGestor && <td style={{ color: 'var(--muted)' }}>{n.vendedorNome || n.responsavel || '—'}</td>}
                    <td><span style={{ padding: '2px 8px', borderRadius: 20, fontSize: 11, background: (statusCores[n.status] || '#64748b') + '20', color: statusCores[n.status] || '#64748b' }}>{n.status}</span></td>
                    <td style={{ color: '#7c3aed' }}>{fmt(n.valor || n.valorAdesao || 0)}</td>
                    <td style={{ color: '#f59e0b' }}>{dias} dias</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Tabela completa */}
      <div style={card}>
        <div style={cardTitle}>📋 Todos os Negócios</div>
        <table style={{ marginTop: 14 }}>
          <thead><tr><th>Cliente</th>{isGestor && <th>Responsável</th>}<th>Status</th><th>Valor</th><th>Módulos</th><th>Data</th></tr></thead>
          <tbody>
            {negocios.length === 0 && <tr><td colSpan={isGestor ? 6 : 5} style={{ textAlign: 'center', color: 'var(--muted)', padding: 32 }}>Nenhum negócio encontrado.</td></tr>}
            {negocios.map((n, i) => (
              <tr key={n.id || i}>
                <td style={{ fontWeight: 600 }}>{n.empresa || n.nome || '—'}</td>
                {isGestor && <td style={{ color: 'var(--muted)' }}>{n.vendedorNome || n.responsavel || '—'}</td>}
                <td><span style={{ padding: '2px 8px', borderRadius: 20, fontSize: 11, background: (statusCores[n.status] || '#64748b') + '20', color: statusCores[n.status] || '#64748b' }}>{n.status || 'Aberto'}</span></td>
                <td style={{ color: '#7c3aed' }}>{fmt(n.valor || n.valorAdesao || 0)}</td>
                <td style={{ fontSize: 11, color: 'var(--muted)' }}>{(n.modulos || []).join(', ') || '—'}</td>
                <td style={{ color: 'var(--muted)' }}>{fmtDate(n.criadoEm || n.dataFechamento)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════════════
// ABA DISPAROS EM MASSA
// ══════════════════════════════════════════════════════
function AbaDisparos({ empresaId, mesFiltro, isGestor }) {
  const [campanhas,  setCampanhas]  = useState([])
  const [loading,    setLoading]    = useState(true)

  useEffect(() => {
    if (!empresaId) return
    async function load() {
      const { data: rows } = await supabase
        .from('vx_storage')
        .select('key, value, updated_at')
        .like('key', `campanha:${empresaId}:%`)
        .order('updated_at', { ascending: false })
        .limit(100)
      const lista = (rows || []).map(r => {
        try { return JSON.parse(r.value) } catch { return null }
      }).filter(Boolean).filter(c => {
        if (!mesFiltro) return true
        return c.iniciou?.slice(0, 7) === mesFiltro || c.finalizou?.slice(0, 7) === mesFiltro
      })
      setCampanhas(lista)
      setLoading(false)
    }
    load()
  }, [empresaId, mesFiltro])

  if (loading) return <div style={{ color: 'var(--muted)', padding: 32, textAlign: 'center' }}>Carregando campanhas...</div>

  const totalEnviados = campanhas.reduce((a, c) => a + (c.enviados || 0), 0)
  const totalErros    = campanhas.reduce((a, c) => a + (c.erros || 0), 0)
  const totalContatos = campanhas.reduce((a, c) => a + (c.totalContatos || 0), 0)
  const txEntrega     = totalContatos > 0 ? Math.round((totalEnviados / totalContatos) * 100) : 0

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 24 }}>
        <KpiCard label="Campanhas" valor={fmtN(campanhas.length)} icon="📣" cor="#00d4ff" sub={mesFiltro} />
        <KpiCard label="Total Contatos" valor={fmtN(totalContatos)} icon="👥" cor="#7c3aed" />
        <KpiCard label="Enviados" valor={fmtN(totalEnviados)} icon="✅" cor="#10b981" />
        <KpiCard label="Taxa de Entrega" valor={`${txEntrega}%`} icon="📊" cor={txEntrega >= 90 ? '#10b981' : '#f59e0b'} />
      </div>

      <div style={card}>
        <div style={cardTitle}>📣 Campanhas de Disparo — {mesFiltro}</div>
        {campanhas.length === 0 ? (
          <div style={{ padding: '32px 20px', textAlign: 'center', color: 'var(--muted)' }}>Nenhuma campanha no período.</div>
        ) : (
          <table style={{ marginTop: 14 }}>
            <thead><tr><th>Campanha</th><th>Tipo</th><th>Contatos</th><th>Enviados</th><th>Erros</th><th>Taxa</th><th>Data</th></tr></thead>
            <tbody>
              {campanhas.map((c, i) => {
                const tx = c.totalContatos > 0 ? Math.round((c.enviados / c.totalContatos) * 100) : 0
                return (
                  <tr key={c.id || i}>
                    <td style={{ fontWeight: 600, fontSize: 12 }}>{c.campanhaId || c.id}</td>
                    <td><span style={{ padding: '2px 8px', borderRadius: 20, fontSize: 11, background: 'rgba(0,212,255,.12)', color: '#00d4ff' }}>{c.tipo || 'text'}</span></td>
                    <td style={{ color: 'var(--muted)' }}>{c.totalContatos}</td>
                    <td style={{ color: '#10b981', fontWeight: 600 }}>{c.enviados}</td>
                    <td style={{ color: '#ef4444' }}>{c.erros || 0}</td>
                    <td><span style={{ padding: '2px 8px', borderRadius: 20, fontSize: 11, background: tx >= 90 ? 'rgba(16,185,129,.15)' : 'rgba(245,158,11,.15)', color: tx >= 90 ? '#10b981' : '#f59e0b' }}>{tx}%</span></td>
                    <td style={{ color: 'var(--muted)', fontSize: 12 }}>{fmtDate(c.iniciou)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════════════
// ABA MARKETING
// ══════════════════════════════════════════════════════
function AbaMarketing({ cfg, mesFiltro, isGestor, usuarios }) {
  const campanhas = (cfg.marketing_campanhas || []).filter(c => {
    if (!mesFiltro) return true
    return c.data?.slice(0, 7) === mesFiltro || c.criadoEm?.slice(0, 7) === mesFiltro
  })

  const totalAlcance  = campanhas.reduce((a, c) => a + (Number(c.alcance) || 0), 0)
  const totalCliques  = campanhas.reduce((a, c) => a + (Number(c.cliques) || 0), 0)
  const totalLeads    = campanhas.reduce((a, c) => a + (Number(c.leads) || 0), 0)
  const ctrMedio      = totalAlcance > 0 ? ((totalCliques / totalAlcance) * 100).toFixed(1) : 0

  const tiposCores = { 'email':'#00d4ff', 'whatsapp':'#10b981', 'social':'#7c3aed', 'sms':'#f59e0b' }

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 24 }}>
        <KpiCard label="Campanhas" valor={fmtN(campanhas.length)} icon="📣" cor="#7c3aed" sub={mesFiltro} />
        <KpiCard label="Alcance Total" valor={fmtN(totalAlcance)} icon="👁️" cor="#00d4ff" />
        <KpiCard label="Cliques" valor={fmtN(totalCliques)} icon="🖱️" cor="#10b981" sub={`CTR: ${ctrMedio}%`} />
        <KpiCard label="Leads Gerados" valor={fmtN(totalLeads)} icon="🎯" cor="#f59e0b" />
      </div>

      {campanhas.length === 0 ? (
        <div style={{ ...card, textAlign: 'center', color: 'var(--muted)', padding: 48 }}>
          Nenhuma campanha de marketing registrada no período.<br />
          <span style={{ fontSize: 12, marginTop: 8, display: 'block' }}>As campanhas são criadas no módulo Marketing.</span>
        </div>
      ) : (
        <div style={card}>
          <div style={cardTitle}>📣 Campanhas de Marketing — {mesFiltro}</div>
          <table style={{ marginTop: 14 }}>
            <thead><tr><th>Campanha</th><th>Tipo</th><th>Alcance</th><th>Cliques</th><th>CTR</th><th>Leads</th><th>Data</th></tr></thead>
            <tbody>
              {campanhas.map((c, i) => {
                const ctr = c.alcance > 0 ? ((c.cliques / c.alcance) * 100).toFixed(1) : 0
                return (
                  <tr key={c.id || i}>
                    <td style={{ fontWeight: 600 }}>{c.nome || c.titulo || '—'}</td>
                    <td><span style={{ padding: '2px 8px', borderRadius: 20, fontSize: 11, background: (tiposCores[c.tipo] || '#64748b') + '20', color: tiposCores[c.tipo] || '#64748b' }}>{c.tipo || '—'}</span></td>
                    <td style={{ color: '#00d4ff' }}>{fmtN(c.alcance)}</td>
                    <td style={{ color: '#10b981' }}>{fmtN(c.cliques)}</td>
                    <td style={{ color: 'var(--muted)' }}>{ctr}%</td>
                    <td style={{ fontWeight: 600, color: '#f59e0b' }}>{fmtN(c.leads)}</td>
                    <td style={{ color: 'var(--muted)' }}>{fmtDate(c.data || c.criadoEm)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ══════════════════════════════════════════════════════
// ABA GERADOR DE RELATÓRIO PERSONALIZADO
// ══════════════════════════════════════════════════════
const FONTES_DISPONIVEIS = [
  { id: 'contratos',   label: '📝 Contratos / Vendas', campos: ['clienteNome','vendedorNome','dataFechamento','valorAdesao','valorMensalidade','modulos','status'] },
  { id: 'kpis',        label: '📊 KPIs',               campos: ['date','userName','kpiNome','realizado'] },
  { id: 'crm_negocios',label: '🤝 Negócios CRM',       campos: ['empresa','status','valor','responsavel','criadoEm','modulos'] },
  { id: 'crm_atividades',label:'📋 Atividades CRM',    campos: ['data','userName','tipo','clienteNome','resultado','duracao'] },
  { id: 'fin_contas',  label: '💳 Contas',             campos: ['descricao','tipo','valor','vencimento','status','categoria'] },
]

function AbaGerador({ cfg, contratos, mesFiltro, isGestor, usuarios, session }) {
  const [fonte,         setFonte]         = useState('contratos')
  const [camposSel,     setCamposSel]     = useState([])
  const [filtroMes,     setFiltroMes]     = useState(mesFiltro)
  const [agrupamento,   setAgrupamento]   = useState('nenhum')
  const [resultado,     setResultado]     = useState(null)

  const fonteSel = FONTES_DISPONIVEIS.find(f => f.id === fonte) || FONTES_DISPONIVEIS[0]

  useEffect(() => { setCamposSel(fonteSel.campos) }, [fonte])

  function toggleCampo(campo) {
    setCamposSel(prev => prev.includes(campo) ? prev.filter(c => c !== campo) : [...prev, campo])
  }

  function getDados() {
    switch (fonte) {
      case 'contratos':     return contratos
      case 'kpis':          return (cfg.kpiLog || []).filter(l => !filtroMes || l.date?.startsWith(filtroMes))
      case 'crm_negocios':  return (cfg.crm_negocios || [])
      case 'crm_atividades':return (cfg.crm_atividades || [])
      case 'fin_contas':    return (cfg.fin_contas || [])
      default:              return []
    }
  }

  function gerarRelatorio() {
    let dados = getDados()

    // Filtra por mês se campo disponível
    if (filtroMes) {
      dados = dados.filter(d => {
        const data = d.dataFechamento || d.date || d.data || d.criadoEm || d.vencimento || ''
        return !data || data.startsWith(filtroMes)
      })
    }

    // Agrupamento
    if (agrupamento !== 'nenhum') {
      const grupos = {}
      dados.forEach(d => {
        const chave = d[agrupamento] || 'N/D'
        if (!grupos[chave]) grupos[chave] = []
        grupos[chave].push(d)
      })
      const dadosAgrupados = Object.entries(grupos).map(([chave, items]) => ({
        _grupo: chave,
        _qtd: items.length,
        ...items[0]
      }))
      setResultado(dadosAgrupados)
    } else {
      setResultado(dados)
    }
  }

  function exportarCSV() {
    if (!resultado?.length) return
    const headers = camposSel.join(';')
    const linhas  = resultado.map(r => camposSel.map(c => `"${r[c] ?? ''}"`).join(';'))
    const csv     = [headers, ...linhas].join('\n')
    const blob    = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
    const url     = URL.createObjectURL(blob)
    const a       = document.createElement('a')
    a.href = url; a.download = `relatorio_${fonte}_${filtroMes || 'todos'}.csv`
    a.click(); URL.revokeObjectURL(url)
  }

  const agrupamentosDisponiveis = fonteSel.campos.filter(c => ['vendedorNome','userName','tipo','status','modulos'].includes(c))

  return (
    <div>
      <div style={card}>
        <div style={cardTitle}>⚙️ Configure seu Relatório</div>

        {/* Fonte */}
        <div style={{ marginTop: 16, marginBottom: 14 }}>
          <div style={labelStyle}>Fonte de Dados</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 6 }}>
            {FONTES_DISPONIVEIS.map(f => (
              <button key={f.id} onClick={() => setFonte(f.id)}
                style={{ padding: '7px 14px', borderRadius: 8, border: `1.5px solid ${fonte === f.id ? 'var(--accent)' : 'var(--border)'}`, background: fonte === f.id ? 'rgba(0,212,255,.12)' : 'var(--surface2)', color: fonte === f.id ? 'var(--accent)' : 'var(--muted)', fontFamily: 'DM Mono, monospace', fontSize: 12, cursor: 'pointer', fontWeight: fonte === f.id ? 600 : 400 }}>
                {f.label}
              </button>
            ))}
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          {/* Campos */}
          <div>
            <div style={labelStyle}>Campos a Exibir</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 6 }}>
              {fonteSel.campos.map(campo => (
                <label key={campo} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 12, color: camposSel.includes(campo) ? 'var(--text)' : 'var(--muted)', padding: '5px 8px', background: camposSel.includes(campo) ? 'rgba(0,212,255,.06)' : 'transparent', borderRadius: 6 }}>
                  <input type="checkbox" checked={camposSel.includes(campo)} onChange={() => toggleCampo(campo)} style={{ cursor: 'pointer' }} />
                  {campo}
                </label>
              ))}
            </div>
          </div>

          {/* Filtros e agrupamento */}
          <div>
            <div style={{ marginBottom: 14 }}>
              <div style={labelStyle}>Filtrar por Mês</div>
              <input type="month" value={filtroMes} onChange={e => setFiltroMes(e.target.value)} style={{ width: '100%', marginTop: 6 }} />
            </div>
            <div>
              <div style={labelStyle}>Agrupar por</div>
              <select value={agrupamento} onChange={e => setAgrupamento(e.target.value)} style={{ width: '100%', marginTop: 6 }}>
                <option value="nenhum">Sem agrupamento</option>
                {agrupamentosDisponiveis.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
          <button onClick={gerarRelatorio} style={btnPrimary}>▶ Gerar Relatório</button>
          {resultado?.length > 0 && (
            <button onClick={exportarCSV} style={btnSecondary}>📥 Exportar CSV</button>
          )}
        </div>
      </div>

      {/* Resultado */}
      {resultado && (
        <div style={{ ...card, marginTop: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <div style={cardTitle}>📊 Resultado — {resultado.length} registros</div>
          </div>
          {resultado.length === 0 ? (
            <div style={{ color: 'var(--muted)', textAlign: 'center', padding: 32 }}>Nenhum dado encontrado para os filtros selecionados.</div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table>
                <thead>
                  <tr>
                    {agrupamento !== 'nenhum' && <th>Grupo</th>}
                    {agrupamento !== 'nenhum' && <th>Qtd</th>}
                    {camposSel.map(c => <th key={c}>{c}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {resultado.slice(0, 200).map((r, i) => (
                    <tr key={i}>
                      {agrupamento !== 'nenhum' && <td style={{ fontWeight: 600 }}>{r._grupo}</td>}
                      {agrupamento !== 'nenhum' && <td style={{ color: '#00d4ff' }}>{r._qtd}</td>}
                      {camposSel.map(c => (
                        <td key={c} style={{ fontSize: 12, color: 'var(--muted)' }}>
                          {Array.isArray(r[c]) ? r[c].join(', ') : (r[c] ?? '—')}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
              {resultado.length > 200 && <div style={{ padding: '10px 14px', color: 'var(--muted)', fontSize: 12 }}>Mostrando 200 de {resultado.length} registros. Exporte CSV para ver todos.</div>}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ══════════════════════════════════════════════════════
// BOTÃO ANÁLISE IA
// ══════════════════════════════════════════════════════
function BotaoAnaliseIA({ cfg, dados }) {
  const [analisando, setAnalisando] = useState(false)
  const [analise,    setAnalise]    = useState('')

  async function analisar() {
    const openaiKey = cfg.openaiApiKey || ''
    const geminiKey = cfg.geminiApiKey || ''
    const groqKey   = cfg.groqApiKey   || ''
    if (!openaiKey && !geminiKey && !groqKey) {
      setAnalise('⚠️ Configure uma chave de IA em Configurações → Empresa para usar esta função.')
      return
    }
    setAnalisando(true); setAnalise('')
    try {
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: dados, openaiApiKey: openaiKey, geminiApiKey: geminiKey, groqApiKey: groqKey }),
      })
      const json = await res.json()
      setAnalise(json.analysis || json.error || 'Sem resposta da IA.')
    } catch (e) {
      setAnalise('Erro: ' + e.message)
    }
    setAnalisando(false)
  }

  return (
    <div style={{ ...card, marginTop: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={cardTitle}>🤖 Análise com IA</div>
        <button onClick={analisar} disabled={analisando} style={{ padding: '9px 18px', borderRadius: 9, background: 'rgba(124,58,237,.15)', border: '1px solid rgba(124,58,237,.35)', color: '#a78bfa', fontFamily: 'DM Mono, monospace', fontSize: 13, cursor: 'pointer', fontWeight: 600 }}>
          {analisando ? '⏳ Analisando...' : '🤖 Gerar Análise'}
        </button>
      </div>
      {analise && (
        <div style={{ marginTop: 14, padding: '14px 16px', background: 'rgba(124,58,237,.06)', border: '1px solid rgba(124,58,237,.2)', borderRadius: 10, fontSize: 13, color: 'var(--muted)', lineHeight: 1.8, whiteSpace: 'pre-wrap' }}>
          {analise}
        </div>
      )}
    </div>
  )
}

// ── Helpers de ícone ──
function tipoIcon(tipo) {
  const mapa = { 'Ligação':'📞', 'Reunião':'🤝', 'E-mail':'📧', 'Tarefa':'✅', 'WhatsApp':'💬', 'Follow-up':'🔔' }
  return mapa[tipo] || '📋'
}

// ── Estilos ──
const card       = { background: '#111827', border: '1px solid #1e2d4a', borderRadius: 13, padding: '18px 20px' }
const cardTitle  = { fontFamily: 'Syne, sans-serif', fontSize: 14, fontWeight: 700, color: '#e2e8f0' }
const labelStyle = { fontSize: 11, color: '#64748b', letterSpacing: '.5px', textTransform: 'uppercase' }
const btnPrimary   = { padding: '10px 22px', borderRadius: 9, background: 'linear-gradient(135deg,#00d4ff,#0099bb)', border: 'none', color: '#fff', fontFamily: 'DM Mono, monospace', fontSize: 13, fontWeight: 700, cursor: 'pointer' }
const btnSecondary = { padding: '10px 18px', borderRadius: 9, background: 'rgba(100,116,139,.12)', border: '1px solid rgba(100,116,139,.3)', color: '#64748b', fontFamily: 'DM Mono, monospace', fontSize: 13, cursor: 'pointer' }
