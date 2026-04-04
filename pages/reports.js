// pages/reports.js — Central de Relatórios Vivanexa SaaS v2
// Tela principal: Comercial | Produtividade | Financeiro | Fiscal | Histórico | Assinaturas | Configurações
import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import { supabase } from '../lib/supabase'

const fmt  = n => 'R$ ' + Number(n || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const fmtK = v => v >= 1000 ? `R$ ${(v / 1000).toFixed(1)}k` : fmt(v)
const fmtN = n => Number(n || 0).toLocaleString('pt-BR')

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
    if (s.match(/^\d{4}-\d{2}/)) return s.slice(0, 7)
    const p = s.split('/'); if (p.length >= 3) return `${p[2].slice(0,4)}-${p[1].padStart(2,'0')}`
  } catch { }
  return ''
}
function pertenceAo(h, uid, usuarios) {
  if (!h || !uid) return false
  if (h.userId === uid || h.consultantId === uid) return true
  const u = (usuarios || []).find(u2 => (u2.id || u2.username) === uid)
  if (u && (h.consultor === u.nome || h.consultorEmail === u.email)) return true
  return false
}
function pct(real, meta) { if (!meta || meta <= 0) return 0; return Math.min(100, Math.round((real / meta) * 100)) }

function Barra({ label, real, meta }) {
  const p = pct(real, meta)
  const c = p >= 100 ? 'var(--accent3)' : p >= 70 ? 'var(--accent)' : p >= 40 ? 'var(--warning)' : 'var(--danger)'
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
        <span style={{ fontSize: 12, color: 'var(--muted)' }}>{label}</span>
        <span style={{ fontSize: 12, color: c, fontWeight: 600 }}>{fmtK(real)} / {fmtK(meta)} ({p}%)</span>
      </div>
      <div style={{ height: 6, background: 'var(--surface2)', borderRadius: 3, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${p}%`, background: c, borderRadius: 3, transition: 'width .5s' }} />
      </div>
    </div>
  )
}

function Card({ label, valor, sub, cor }) {
  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '14px 16px' }}>
      <div style={{ fontSize: 10, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>{label}</div>
      <div style={{ fontFamily: 'Syne, sans-serif', fontSize: 19, fontWeight: 800, color: cor || 'var(--accent)' }}>{valor}</div>
      {sub && <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 3 }}>{sub}</div>}
    </div>
  )
}

function GraficoBarras({ dados, altura }) {
  if (!dados || !dados.length) return <div style={{ color: 'var(--muted)', fontSize: 12, textAlign: 'center', padding: 20 }}>Sem dados</div>
  const max = Math.max(...dados.map(d => d.valor), 1)
  const larg = 100 / dados.length
  const h = altura || 120
  return (
    <svg width="100%" height={h + 20} style={{ overflow: 'visible' }}>
      {dados.map((d, i) => {
        const bh = Math.max(3, (d.valor / max) * h)
        const x = i * larg + larg * 0.1, w = larg * 0.8
        return (
          <g key={i}>
            <rect x={`${x}%`} y={h - bh} width={`${w}%`} height={bh} rx="3" fill={d.cor || 'var(--accent)'} opacity={0.85} />
            <text x={`${x + w / 2}%`} y={h + 14} textAnchor="middle" style={{ fontSize: 9, fill: 'var(--muted)', fontFamily: 'DM Mono' }}>{d.label}</text>
            {d.valor > 0 && <text x={`${x + w / 2}%`} y={h - bh - 4} textAnchor="middle" style={{ fontSize: 9, fill: 'var(--text)', fontFamily: 'DM Mono' }}>{fmtK(d.valor)}</text>}
          </g>
        )
      })}
    </svg>
  )
}

function Tabela({ cols, rows, empty }) {
  if (!rows || !rows.length) return <div style={{ color: 'var(--muted)', fontSize: 12, padding: '18px 0', textAlign: 'center' }}>{empty || 'Sem dados.'}</div>
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
        <thead>
          <tr>{cols.map(c => <th key={c.k} style={{ padding: '7px 10px', textAlign: c.r ? 'right' : 'left', color: 'var(--muted)', fontWeight: 500, fontSize: 10, textTransform: 'uppercase', letterSpacing: 1, whiteSpace: 'nowrap', borderBottom: '1px solid var(--border)' }}>{c.l}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} style={{ borderBottom: '1px solid var(--border)', background: i % 2 ? 'rgba(255,255,255,.01)' : 'transparent' }}>
              {cols.map(c => <td key={c.k} style={{ padding: '8px 10px', textAlign: c.r ? 'right' : 'left', color: c.cor || 'var(--text)', fontWeight: c.bold ? 600 : 400, whiteSpace: c.nw ? 'nowrap' : 'normal' }}>{row[c.k] ?? '—'}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function Sec({ title, children }) {
  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: '18px 22px', marginBottom: 16 }}>
      {title && <div style={{ fontFamily: 'Syne, sans-serif', fontSize: 14, fontWeight: 700, color: 'var(--accent)', marginBottom: 14 }}>{title}</div>}
      {children}
    </div>
  )
}

export default function Reports() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [perfil,  setPerfil]  = useState(null)
  const [cfg,     setCfg]     = useState({})
  const [aba,     setAba]     = useState('comercial')
  const [mes,     setMes]     = useState(mesAtual())
  const [busca,   setBusca]   = useState('')
  const [ftipo,   setFtipo]   = useState('todos')

  useEffect(() => {
    async function init() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.push('/'); return }
      let { data: perf } = await supabase.from('perfis').select('*').eq('user_id', session.user.id).maybeSingle()
      if (!perf) {
        const nome = session.user.user_metadata?.name || session.user.email?.split('@')[0] || 'Usuário'
        const { data: np } = await supabase.from('perfis').insert({ user_id: session.user.id, nome, email: session.user.email, empresa_id: session.user.id, perfil: 'admin' }).select().single()
        perf = np
      }
      setPerfil(perf)
      const eid = perf.empresa_id || session.user.id
      const { data: row } = await supabase.from('vx_storage').select('value').eq('key', `cfg:${eid}`).single()
      if (row?.value) { try { setCfg(JSON.parse(row.value)) } catch {} }
      setLoading(false)
    }
    init()
  }, [])

  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0a0f1e', color: '#64748b', fontFamily: 'DM Mono, monospace' }}>Carregando...</div>
  )

  const isAdmin    = perfil?.perfil === 'admin'
  const usuarios   = cfg.users || []
  const docHistory = cfg.docHistory || []
  const kpiTemplates = cfg.kpiTemplates || []
  const kpiLog     = cfg.kpiLog || []
  const kpiGoals   = cfg.kpiDailyGoals || {}
  const goals      = cfg.goals || []
  const vouchers   = cfg.vouchers || []

  const usuAtual = usuarios.find(u => u?.email === perfil?.email) || usuarios[0] || {}
  const userId   = usuAtual?.id || usuAtual?.username || perfil?.user_id || ''

  const docsMes   = docHistory.filter(d => d && (isAdmin || pertenceAo(d, userId, usuarios)) && dateToMonth(d.criado || d.dateISO || d.date || '') === mes)
  const contratos = docsMes.filter(d => d.type === 'contrato')
  const propostas = docsMes.filter(d => d.type === 'proposta')
  const assinados = contratos.filter(d => d.status === 'signed')
  const totAdesao = contratos.reduce((a, d) => a + (Number(d.tAd || d.adesao) || 0), 0)
  const totMensal = contratos.reduce((a, d) => a + (Number(d.tMen || d.mensalidade) || 0), 0)
  const totAdSign = assinados.reduce((a, d) => a + (Number(d.tAd || d.adesao) || 0), 0)

  const metaG  = goals.find(g => g?.userId === userId && g?.mes === mes) || {}
  const metaAd = Number(metaG.metaAdesao || 0)
  const metaMen= Number(metaG.metaMensalidade || 0)

  const kpiMes = kpiTemplates.map(k => {
    if (!k) return null
    const real  = kpiLog.filter(l => l && l.kpiId === k.id && l.userId === userId && l.date?.startsWith(mes)).reduce((a, l) => a + (Number(l.realizado) || 0), 0)
    const diaria = Number(kpiGoals[userId]?.[k.id] || 0)
    const meta  = diaria * diasUteisNoMes(mes)
    return { ...k, real, meta, pctV: meta > 0 ? pct(real, meta) : null }
  }).filter(Boolean)

  const grafico6m = (() => {
    const arr = []
    for (let i = 5; i >= 0; i--) {
      const d = new Date(); d.setMonth(d.getMonth() - i)
      const m = d.toISOString().slice(0, 7)
      const label = d.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '')
      const docs = docHistory.filter(h => h && h.type === 'contrato' && dateToMonth(h.criado || h.dateISO || '') === m && (isAdmin || pertenceAo(h, userId, usuarios)))
      arr.push({ label, valor: docs.reduce((a, h) => a + (Number(h.tAd || h.adesao) || 0), 0), cor: m === mes ? 'var(--accent)' : 'rgba(0,212,255,.35)' })
    }
    return arr
  })()

  const ranking = isAdmin ? usuarios.filter(u => u).map(u => {
    const uid = u.id || u.username
    const docs = docHistory.filter(d => d && d.type === 'contrato' && dateToMonth(d.criado || d.dateISO || '') === mes && pertenceAo(d, uid, usuarios))
    const sign = docs.filter(d => d.status === 'signed')
    const ad   = docs.reduce((a, d) => a + (Number(d.tAd || d.adesao) || 0), 0)
    const men  = docs.reduce((a, d) => a + (Number(d.tMen || d.mensalidade) || 0), 0)
    const g    = goals.find(x => x?.userId === uid && x?.mes === mes) || {}
    const mAd  = Number(g.metaAdesao || 0)
    const kpis = kpiTemplates.filter(Boolean).map(k => {
      const real = kpiLog.filter(l => l && l.kpiId === k.id && l.userId === uid && l.date?.startsWith(mes)).reduce((a, l) => a + (Number(l.realizado) || 0), 0)
      return { nome: k.nome, icone: k.icone, real, unidade: k.unidade || 'un' }
    })
    return { ...u, ad, men, sign: sign.length, docs: docs.length, mAd, pAd: mAd > 0 ? pct(ad, mAd) : null, kpis }
  }).sort((a, b) => (b.ad + b.men) - (a.ad + a.men)) : []

  const docsFilt = docsMes.filter(d => {
    if (ftipo !== 'todos' && d.type !== ftipo) return false
    if (busca.trim()) { const b = busca.toLowerCase(); return (d.clientName || d.cliente || '').toLowerCase().includes(b) || (d.consultor || '').toLowerCase().includes(b) }
    return true
  })

  const prodVendidos = (() => {
    const mapa = {}
    contratos.forEach(d => {
      if (!d?.modulos) return
      d.modulos.forEach(mod => {
        if (!mapa[mod]) mapa[mod] = { qtd: 0, adesao: 0, mensalidade: 0 }
        mapa[mod].qtd++
        mapa[mod].adesao    += Number(d.adesaoModulos?.[mod] || 0)
        mapa[mod].mensalidade += Number(d.mensalidadeModulos?.[mod] || 0)
      })
    })
    return Object.entries(mapa).map(([nome, v]) => ({ nome, ...v })).sort((a, b) => b.qtd - a.qtd)
  })()

  const logoSrc = cfg.logob64 ? (cfg.logob64.startsWith('data:') ? cfg.logob64 : `data:image/png;base64,${cfg.logob64}`) : null
  const CORES   = ['var(--accent)', 'var(--accent3)', 'var(--accent2)', 'var(--gold)', 'var(--danger)', 'var(--warning)']
  const stBadge = s => ({ signed: '✅ Assinado', pending: '⏳ Pendente', sent: '📤 Enviado', draft: '📝 Rascunho' }[s] || s || '—')

  const ABAS = [
    { id: 'comercial',    label: '💬 Comercial' },
    { id: 'produtividade',label: '🎯 Produtividade' },
    { id: 'financeiro',   label: '💰 Financeiro' },
    { id: 'fiscal',       label: '📋 Fiscal' },
    { id: 'historico',    label: '🗂️ Histórico' },
    { id: 'assinaturas',  label: '✍️ Assinaturas' },
    { id: 'configuracoes',label: '⚙️ Configurações' },
  ]

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=DM+Mono:wght@300;400;500&display=swap');
        :root{--bg:#0a0f1e;--surface:#111827;--surface2:#1a2540;--border:#1e2d4a;--accent:#00d4ff;--accent2:#7c3aed;--accent3:#10b981;--text:#e2e8f0;--muted:#64748b;--danger:#ef4444;--warning:#f59e0b;--gold:#fbbf24}
        *{box-sizing:border-box;margin:0;padding:0}
        body{font-family:'DM Mono',monospace;background:var(--bg);color:var(--text);min-height:100vh}
        ::-webkit-scrollbar{width:4px}::-webkit-scrollbar-thumb{background:var(--border);border-radius:4px}
      `}</style>

      {/* HEADER */}
      <header style={{ position: 'sticky', top: 0, zIndex: 100, background: 'rgba(10,15,30,.92)', backdropFilter: 'blur(12px)', borderBottom: '1px solid var(--border)', padding: '10px 20px' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto', display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }} onClick={() => setAba('comercial')}>
            {logoSrc ? <img src={logoSrc} alt="" style={{ height: 32, objectFit: 'contain', borderRadius: 6 }} onError={e => e.target.style.display='none'} /> : <span style={{ fontFamily: 'Syne, sans-serif', fontSize: 15, fontWeight: 700 }}>{cfg.company || 'Vivanexa'}</span>}
          </div>
          <span style={{ fontSize: 13, color: 'var(--accent)', fontFamily: 'Syne, sans-serif', fontWeight: 700 }}>📈 Relatórios</span>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 6, alignItems: 'center' }}>
            <button onClick={() => router.push('/chat')} style={{ background: 'rgba(0,212,255,.1)', border: '1px solid rgba(0,212,255,.25)', cursor: 'pointer', color: 'var(--accent)', fontSize: 11, padding: '5px 11px', borderRadius: 8, fontFamily: 'DM Mono, monospace', fontWeight: 600 }}>💬 Chat</button>
            {perfil?.nome && <span style={{ fontSize: 11, color: 'var(--muted)' }}>👤 <span style={{ color: 'var(--text)' }}>{perfil.nome}</span></span>}
            <button onClick={() => supabase.auth.signOut().then(() => router.push('/'))} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', fontSize: 11, fontFamily: 'DM Mono, monospace' }}>Sair</button>
          </div>
        </div>
      </header>

      <main style={{ maxWidth: 1100, margin: '0 auto', padding: '20px 20px 60px' }}>

        {/* Abas */}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 20, alignItems: 'center' }}>
          {ABAS.map(a => (
            <button key={a.id} onClick={() => setAba(a.id)}
              style={{ padding: '8px 13px', borderRadius: 9, border: `1.5px solid ${aba===a.id?'var(--accent)':'var(--border)'}`, background: aba===a.id?'rgba(0,212,255,.12)':'var(--surface2)', color: aba===a.id?'var(--accent)':'var(--muted)', fontFamily: 'DM Mono, monospace', fontSize: 12, cursor: 'pointer', fontWeight: aba===a.id?700:400 }}>
              {a.label}
            </button>
          ))}
          {aba !== 'configuracoes' && (
            <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
              <span style={{ fontSize: 11, color: 'var(--muted)' }}>Mês:</span>
              <input type="month" value={mes} onChange={e => setMes(e.target.value)}
                style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 8, padding: '6px 10px', fontFamily: 'DM Mono, monospace', fontSize: 12, color: 'var(--text)', outline: 'none' }} />
            </div>
          )}
        </div>

        {/* Cards resumo */}
        {aba !== 'configuracoes' && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px,1fr))', gap: 10, marginBottom: 20 }}>
            <Card label="📝 Contratos" valor={contratos.length} sub={`${assinados.length} assinados`} cor="var(--accent)" />
            <Card label="📄 Propostas" valor={propostas.length} cor="var(--accent2)" />
            <Card label="💰 Adesão"   valor={fmtK(totAdesao)} sub={`Assina: ${fmtK(totAdSign)}`} cor="var(--gold)" />
            <Card label="📅 Mensal"   valor={fmtK(totMensal)} cor="var(--accent3)" />
          </div>
        )}

        {/* ══ COMERCIAL ══ */}
        {aba === 'comercial' && (<>
          <Sec title={null}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:12 }}>
              <div>
                <div style={{ fontFamily:'Syne,sans-serif', fontSize:15, fontWeight:700, color:'var(--text)', marginBottom:4 }}>💬 Assistente Comercial</div>
                <div style={{ fontSize:13, color:'var(--muted)' }}>Gere propostas e contratos para seus clientes diretamente no chat.</div>
              </div>
              <button onClick={() => router.push('/chat')} style={{ padding:'12px 24px', borderRadius:12, background:'linear-gradient(135deg,var(--accent),#0099bb)', border:'none', color:'#fff', fontFamily:'DM Mono,monospace', fontSize:14, fontWeight:700, cursor:'pointer', whiteSpace:'nowrap' }}>
                💬 Abrir Chat →
              </button>
            </div>
          </Sec>

          {(metaAd > 0 || metaMen > 0) && (
            <Sec title="🎯 Metas do Mês">
              {metaAd  > 0 && <Barra label="Adesão"      real={totAdesao} meta={metaAd}  />}
              {metaMen > 0 && <Barra label="Mensalidade" real={totMensal} meta={metaMen} />}
            </Sec>
          )}

          <Sec title="📈 Adesão — Últimos 6 Meses">
            <GraficoBarras dados={grafico6m} altura={130} />
          </Sec>

          {isAdmin && ranking.length > 0 && (
            <Sec title="🏆 Ranking de Vendedores">
              {ranking.map((u, i) => (
                <div key={u.id||u.email||i} style={{ display:'flex', alignItems:'center', gap:12, padding:'10px 0', borderBottom:'1px solid var(--border)' }}>
                  <span style={{ fontSize:18, width:28 }}>{i===0?'🥇':i===1?'🥈':i===2?'🥉':`${i+1}.`}</span>
                  <div style={{ flex:1 }}>
                    <div style={{ fontWeight:600, fontSize:13 }}>{u.nome}</div>
                    <div style={{ fontSize:11, color:'var(--muted)' }}>{u.docs} contratos · {u.sign} assinados</div>
                  </div>
                  <div style={{ textAlign:'right' }}>
                    <div style={{ fontSize:14, fontWeight:700, fontFamily:'Syne,sans-serif', color:'var(--accent)' }}>{fmtK(u.ad)}</div>
                    <div style={{ fontSize:11, color:'var(--muted)' }}>adesão{u.pAd!==null?` · ${u.pAd}%`:''}</div>
                  </div>
                  <div style={{ textAlign:'right' }}>
                    <div style={{ fontSize:14, fontWeight:700, fontFamily:'Syne,sans-serif', color:'var(--accent3)' }}>{fmtK(u.men)}</div>
                    <div style={{ fontSize:11, color:'var(--muted)' }}>mensal</div>
                  </div>
                </div>
              ))}
            </Sec>
          )}

          <Sec title="🗂️ Últimos Documentos">
            <Tabela cols={[{k:'tipo',l:'Tipo',nw:true},{k:'cliente',l:'Cliente'},{k:'data',l:'Data',nw:true},{k:'adesao',l:'Adesão',r:true,cor:'var(--accent)',bold:true},{k:'status',l:'Status',nw:true}]}
              rows={docHistory.filter(d => d && (isAdmin||pertenceAo(d,userId,usuarios))).slice(0,8).map(d=>({tipo:d.type==='contrato'?'📝 Contrato':'📄 Proposta',cliente:d.clientName||d.cliente||'—',data:d.criado?new Date(d.criado).toLocaleDateString('pt-BR'):'—',adesao:(d.tAd||d.adesao)?fmtK(Number(d.tAd||d.adesao)):'—',status:stBadge(d.status)}))}
              empty="Nenhum documento gerado ainda." />
          </Sec>
        </>)}

        {/* ══ PRODUTIVIDADE ══ */}
        {aba === 'produtividade' && (<>
          {kpiTemplates.length === 0 ? (
            <Sec><div style={{ textAlign:'center', padding:'30px 0', color:'var(--muted)' }}>Nenhum KPI configurado. <button onClick={()=>setAba('configuracoes')} style={{ background:'none', border:'none', color:'var(--accent)', cursor:'pointer', fontFamily:'DM Mono,monospace', fontSize:13 }}>Configurar →</button></div></Sec>
          ) : (<>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(170px,1fr))', gap:12, marginBottom:16 }}>
              {kpiMes.map(k => {
                const cor = k.pctV===null?'var(--accent)':k.pctV>=100?'var(--accent3)':k.pctV>=60?'var(--accent)':'var(--warning)'
                return (
                  <div key={k.id} style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:12, padding:'16px 18px' }}>
                    <div style={{ fontSize:24, marginBottom:6 }}>{k.icone||'📊'}</div>
                    <div style={{ fontSize:11, color:'var(--muted)', marginBottom:4 }}>{k.nome}</div>
                    <div style={{ fontFamily:'Syne,sans-serif', fontSize:22, fontWeight:800, color:cor }}>{fmtN(k.real)}<span style={{ fontSize:11, fontWeight:400, color:'var(--muted)', marginLeft:4 }}>{k.unidade||'un'}</span></div>
                    {k.meta > 0 && (<>
                      <div style={{ fontSize:11, color:'var(--muted)', marginTop:4 }}>Meta: {fmtN(k.meta)}</div>
                      <div style={{ marginTop:8, height:4, background:'var(--border)', borderRadius:2, overflow:'hidden' }}><div style={{ height:'100%', width:`${k.pctV}%`, background:cor, borderRadius:2 }} /></div>
                      <div style={{ fontSize:11, color:cor, marginTop:4, textAlign:'right', fontWeight:600 }}>{k.pctV}%</div>
                    </>)}
                  </div>
                )
              })}
            </div>
            <Sec title="📅 Lançamentos do Mês">
              <Tabela cols={[{k:'data',l:'Data',nw:true},{k:'kpi',l:'KPI'},{k:'qtd',l:'Realizado',r:true,cor:'var(--accent3)',bold:true}]}
                rows={kpiLog.filter(l=>l&&l.userId===userId&&l.date?.startsWith(mes)).sort((a,b)=>b.date.localeCompare(a.date)).map(l=>{const k=kpiTemplates.find(x=>x?.id===l.kpiId);return{data:new Date(l.date+'T12:00:00').toLocaleDateString('pt-BR'),kpi:`${k?.icone||'📊'} ${k?.nome||'KPI'}`,qtd:`${fmtN(l.realizado)} ${k?.unidade||'un'}`}})}
                empty="Nenhum lançamento neste mês." />
            </Sec>
            {isAdmin && (
              <Sec title="📊 KPIs por Vendedor">
                <Tabela cols={[{k:'vendedor',l:'Vendedor'},...kpiTemplates.filter(Boolean).map(k=>({k:k.id,l:`${k.icone} ${k.nome}`,r:true}))]}
                  rows={usuarios.filter(u=>u).map(u=>{const uid=u.id||u.username;const row={vendedor:u.nome};kpiTemplates.filter(Boolean).forEach(k=>{const real=kpiLog.filter(l=>l&&l.kpiId===k.id&&l.userId===uid&&l.date?.startsWith(mes)).reduce((a,l)=>a+(Number(l.realizado)||0),0);row[k.id]=`${fmtN(real)} ${k.unidade||'un'}`});return row})}
                  empty="Nenhum usuário." />
              </Sec>
            )}
          </>)}
        </>)}

        {/* ══ FINANCEIRO ══ */}
        {aba === 'financeiro' && (<>
          <Sec title="📦 Produtos Vendidos">
            {prodVendidos.length===0 ? <div style={{ color:'var(--muted)', fontSize:13, textAlign:'center', padding:'20px 0' }}>Nenhum contrato com módulos neste mês.</div> : (<>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(170px,1fr))', gap:12, marginBottom:16 }}>
                {prodVendidos.map((p,i)=>(
                  <div key={p.nome} style={{ background:'var(--surface2)', border:`1px solid ${CORES[i%CORES.length]}40`, borderRadius:12, padding:'14px 16px' }}>
                    <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:8 }}>
                      <div style={{ width:8, height:8, borderRadius:2, background:CORES[i%CORES.length] }} />
                      <div style={{ fontWeight:700, fontSize:13 }}>{p.nome}</div>
                      <div style={{ marginLeft:'auto', fontSize:11, color:'var(--muted)' }}>{p.qtd}×</div>
                    </div>
                    {p.adesao>0&&<div style={{ fontSize:11, color:'var(--muted)' }}>Adesão: <strong style={{ color:CORES[i%CORES.length] }}>{fmtK(p.adesao)}</strong></div>}
                    {p.mensalidade>0&&<div style={{ fontSize:11, color:'var(--muted)' }}>Mensal: <strong style={{ color:'var(--accent3)' }}>{fmtK(p.mensalidade)}</strong></div>}
                  </div>
                ))}
              </div>
              <Tabela cols={[{k:'mod',l:'Módulo'},{k:'qtd',l:'Qtd',r:true},{k:'ad',l:'Adesão',r:true,cor:'var(--accent)',bold:true},{k:'men',l:'Mensalidade',r:true,cor:'var(--accent3)',bold:true},{k:'tot',l:'Total',r:true,bold:true}]}
                rows={[...prodVendidos.map(p=>({mod:p.nome,qtd:`${p.qtd}×`,ad:fmt(p.adesao),men:fmt(p.mensalidade),tot:fmt(p.adesao+p.mensalidade)})),{mod:'TOTAL',qtd:`${prodVendidos.reduce((a,p)=>a+p.qtd,0)}×`,ad:fmt(prodVendidos.reduce((a,p)=>a+p.adesao,0)),men:fmt(prodVendidos.reduce((a,p)=>a+p.mensalidade,0)),tot:fmt(prodVendidos.reduce((a,p)=>a+p.adesao+p.mensalidade,0))}]} />
            </>)}
          </Sec>
          {isAdmin&&(<Sec title="👥 Receita por Vendedor">
            <Tabela cols={[{k:'nome',l:'Vendedor'},{k:'docs',l:'Contratos',r:true},{k:'sign',l:'Assinados',r:true},{k:'ad',l:'Adesão',r:true,cor:'var(--accent)',bold:true},{k:'men',l:'Mensal',r:true,cor:'var(--accent3)',bold:true},{k:'pAd',l:'% Meta Ad',r:true}]}
              rows={ranking.map(u=>({nome:u.nome,docs:u.docs,sign:u.sign,ad:fmtK(u.ad),men:fmtK(u.men),pAd:u.pAd!==null?`${u.pAd}%`:'—'}))}
              empty="Nenhum vendedor." />
          </Sec>)}
        </>)}

        {/* ══ FISCAL ══ */}
        {aba === 'fiscal' && (
          <Sec title="📋 Documentos do Mês">
            <div style={{ display:'flex', gap:10, marginBottom:14, flexWrap:'wrap' }}>
              <input value={busca} onChange={e=>setBusca(e.target.value)} placeholder="🔍 Buscar cliente..." style={{ flex:1, minWidth:180, background:'var(--surface2)', border:'1px solid var(--border)', borderRadius:8, padding:'8px 12px', fontFamily:'DM Mono,monospace', fontSize:12, color:'var(--text)', outline:'none' }} />
              {['todos','contrato','proposta'].map(t=>(
                <button key={t} onClick={()=>setFtipo(t)} style={{ padding:'7px 12px', borderRadius:8, border:`1px solid ${ftipo===t?'var(--accent)':'var(--border)'}`, background:ftipo===t?'rgba(0,212,255,.1)':'var(--surface2)', color:ftipo===t?'var(--accent)':'var(--muted)', fontFamily:'DM Mono,monospace', fontSize:12, cursor:'pointer' }}>
                  {t==='todos'?'Todos':t==='contrato'?'📝 Contratos':'📄 Propostas'}
                </button>
              ))}
            </div>
            <Tabela cols={[{k:'tipo',l:'Tipo',nw:true},{k:'cliente',l:'Cliente'},{k:'consultor',l:'Consultor'},{k:'data',l:'Data',nw:true},{k:'adesao',l:'Adesão',r:true,cor:'var(--accent)',bold:true},{k:'mensal',l:'Mensalidade',r:true,cor:'var(--accent3)',bold:true},{k:'status',l:'Status',nw:true}]}
              rows={docsFilt.map(d=>({tipo:d.type==='contrato'?'📝 Contrato':'📄 Proposta',cliente:d.clientName||d.cliente||'—',consultor:d.consultor||'—',data:d.criado?new Date(d.criado).toLocaleDateString('pt-BR'):'—',adesao:(d.tAd||d.adesao)?fmt(Number(d.tAd||d.adesao)):'—',mensal:(d.tMen||d.mensalidade)?fmt(Number(d.tMen||d.mensalidade)):'—',status:stBadge(d.status)}))}
              empty="Nenhum documento encontrado." />
            {docsFilt.length>0&&<div style={{ marginTop:10, fontSize:12, color:'var(--muted)', display:'flex', gap:16 }}><span>Total: <strong style={{ color:'var(--text)' }}>{docsFilt.length}</strong></span><span>Adesão: <strong style={{ color:'var(--accent)' }}>{fmt(docsFilt.reduce((a,d)=>a+(Number(d.tAd||d.adesao)||0),0))}</strong></span><span>Mensal: <strong style={{ color:'var(--accent3)' }}>{fmt(docsFilt.reduce((a,d)=>a+(Number(d.tMen||d.mensalidade)||0),0))}</strong></span></div>}
          </Sec>
        )}

        {/* ══ HISTÓRICO ══ */}
        {aba === 'historico' && (
          <Sec title="🗂️ Histórico Completo">
            <Tabela cols={[{k:'tipo',l:'Tipo',nw:true},{k:'cliente',l:'Cliente'},{k:'consultor',l:'Consultor'},{k:'data',l:'Data',nw:true},{k:'adesao',l:'Adesão',r:true,cor:'var(--accent)',bold:true},{k:'status',l:'Status',nw:true}]}
              rows={[...docHistory].filter(d=>d&&(isAdmin||pertenceAo(d,userId,usuarios))).sort((a,b)=>(b.criado||b.dateISO||'').localeCompare(a.criado||a.dateISO||'')).slice(0,100).map(d=>({tipo:d.type==='contrato'?'📝':'📄',cliente:d.clientName||d.cliente||'—',consultor:d.consultor||'—',data:d.criado?new Date(d.criado).toLocaleDateString('pt-BR'):'—',adesao:(d.tAd||d.adesao)?fmtK(Number(d.tAd||d.adesao)):'—',status:stBadge(d.status)}))}
              empty="Nenhum documento no histórico." />
          </Sec>
        )}

        {/* ══ ASSINATURAS ══ */}
        {aba === 'assinaturas' && (<>
          <Sec title="⏳ Pendentes de Assinatura">
            <Tabela cols={[{k:'cliente',l:'Cliente'},{k:'consultor',l:'Consultor'},{k:'data',l:'Criado',nw:true},{k:'adesao',l:'Adesão',r:true,cor:'var(--gold)',bold:true},{k:'status',l:'Status',nw:true}]}
              rows={docHistory.filter(d=>d&&d.status!=='signed'&&d.type==='contrato'&&(isAdmin||pertenceAo(d,userId,usuarios))).slice(0,50).map(d=>({cliente:d.clientName||d.cliente||'—',consultor:d.consultor||'—',data:d.criado?new Date(d.criado).toLocaleDateString('pt-BR'):'—',adesao:(d.tAd||d.adesao)?fmtK(Number(d.tAd||d.adesao)):'—',status:stBadge(d.status)}))}
              empty="Nenhum documento pendente." />
          </Sec>
          <Sec title="✅ Assinados">
            <Tabela cols={[{k:'cliente',l:'Cliente'},{k:'consultor',l:'Consultor'},{k:'data',l:'Assinado',nw:true},{k:'adesao',l:'Adesão',r:true,cor:'var(--accent3)',bold:true}]}
              rows={docHistory.filter(d=>d&&d.status==='signed'&&(isAdmin||pertenceAo(d,userId,usuarios))).slice(0,50).map(d=>({cliente:d.clientName||d.cliente||'—',consultor:d.consultor||'—',data:d.signedAt?new Date(d.signedAt).toLocaleDateString('pt-BR'):(d.criado?new Date(d.criado).toLocaleDateString('pt-BR'):'—'),adesao:(d.tAd||d.adesao)?fmtK(Number(d.tAd||d.adesao)):'—'}))}
              empty="Nenhum documento assinado." />
          </Sec>
        </>)}

        {/* ══ CONFIGURAÇÕES ══ */}
        {aba === 'configuracoes' && (
          <Sec title={null}>
            <div style={{ textAlign:'center', padding:'30px 0' }}>
              <div style={{ fontSize:40, marginBottom:16 }}>⚙️</div>
              <div style={{ fontFamily:'Syne,sans-serif', fontSize:16, fontWeight:700, marginBottom:8 }}>Configurações do Sistema</div>
              <p style={{ color:'var(--muted)', fontSize:13, marginBottom:20 }}>Gerencie empresa, usuários, perfis, produtos, KPIs, descontos e documentos.</p>
              <button onClick={()=>router.push('/configuracoes')} style={{ padding:'12px 28px', borderRadius:12, background:'linear-gradient(135deg,var(--accent),#0099bb)', border:'none', color:'#fff', fontFamily:'DM Mono,monospace', fontSize:14, fontWeight:700, cursor:'pointer' }}>
                ⚙️ Ir para Configurações →
              </button>
            </div>
          </Sec>
        )}

      </main>
    </>
  )
}

export async function getServerSideProps() { return { props: {} } }
