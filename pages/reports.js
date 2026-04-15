// pages/reports.js — Relatórios Vivanexa v4 (completo com todos os módulos)
import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import Head from 'next/head'
import { supabase } from '../lib/supabase'
import Navbar from '../components/Navbar'

const fmt  = n => 'R$ ' + Number(n||0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })
const fmtK = v => v >= 1000 ? `R$ ${(v/1000).toFixed(1)}k` : fmt(v)
const fmtN = n => Number(n||0).toLocaleString('pt-BR')
const pct  = (r,m) => !m ? 0 : Math.min(100, Math.round((r/m)*100))
const mesAtual = () => new Date().toISOString().slice(0,7)
const fmtDate  = s => { if(!s) return '—'; try { return new Date(s+'T12:00:00').toLocaleDateString('pt-BR') } catch { return s } }

function diasUteisNoMes(ym) {
  const [y,m] = ym.split('-').map(Number)
  const dias = new Date(y,m,0).getDate(); let u=0
  for (let d=1;d<=dias;d++) { const dw=new Date(y,m-1,d).getDay(); if(dw!==0&&dw!==6) u++ }
  return u
}

// ── Componentes visuais ────────────────────────────────────────────────────

function KpiCard({ label, valor, sub, cor, icon }) {
  return (
    <div style={{ background:'#111827', border:'1px solid #1e2d4a', borderRadius:13, padding:16, position:'relative', overflow:'hidden' }}>
      <div style={{ position:'absolute', top:0, left:0, right:0, height:2, background:cor||'#00d4ff' }} />
      <div style={{ fontSize:18, marginBottom:8 }}>{icon}</div>
      <div style={{ fontFamily:'Syne,sans-serif', fontSize:22, fontWeight:800, color:cor||'#00d4ff', marginBottom:4 }}>{valor}</div>
      <div style={{ fontSize:10, color:'#e2e8f0', textTransform:'uppercase', letterSpacing:.8, marginBottom:3 }}>{label}</div>
      {sub && <div style={{ fontSize:10, color:'#64748b' }}>{sub}</div>}
    </div>
  )
}

function Barra({ label, real, meta, cor }) {
  const p = pct(real,meta)
  const c = cor||(p>=100?'#10b981':p>=70?'#00d4ff':p>=40?'#f59e0b':'#ef4444')
  return (
    <div style={{ marginBottom:14 }}>
      <div style={{ display:'flex', justifyContent:'space-between', marginBottom:5 }}>
        <span style={{ fontSize:12, color:'#94a3b8' }}>{label}</span>
        <span style={{ fontSize:12, color:c, fontWeight:700 }}>{fmtK(real)} / {fmtK(meta)} ({p}%)</span>
      </div>
      <div style={{ height:7, background:'#1a2540', borderRadius:4, overflow:'hidden' }}>
        <div style={{ height:'100%', width:`${p}%`, background:c, borderRadius:4, transition:'width .6s' }} />
      </div>
    </div>
  )
}

function GraficoBarras({ dados, altura=120, moeda=true }) {
  if (!dados?.length) return <div style={{ color:'#64748b', fontSize:12, textAlign:'center', padding:20 }}>Sem dados</div>
  const max = Math.max(...dados.map(d=>d.valor),1)
  const larg = 100/dados.length, h=altura
  return (
    <svg width="100%" height={h+28} style={{ overflow:'visible' }}>
      {dados.map((d,i) => {
        const bh=Math.max(4,(d.valor/max)*h)
        const x=i*larg+larg*0.1, w=larg*0.8
        return (
          <g key={i}>
            <rect x={`${x}%`} y={h-bh} width={`${w}%`} height={bh} rx="4" fill={d.cor||'#00d4ff'} opacity={0.8} />
            <text x={`${x+w/2}%`} y={h+16} textAnchor="middle" style={{ fontSize:9, fill:'#64748b', fontFamily:'DM Mono' }}>{d.label}</text>
            {d.valor>0 && <text x={`${x+w/2}%`} y={h-bh-5} textAnchor="middle" style={{ fontSize:9, fill:'#e2e8f0', fontFamily:'DM Mono' }}>{moeda?fmtK(d.valor):d.valor}</text>}
          </g>
        )
      })}
    </svg>
  )
}

function Tabela({ cols, rows, emptyMsg='Sem dados' }) {
  return (
    <div style={{ background:'#111827', border:'1px solid #1e2d4a', borderRadius:12, overflow:'hidden' }}>
      <div style={{ display:'grid', gridTemplateColumns:cols.map(c=>c.w||'1fr').join(' '), padding:'10px 16px', borderBottom:'1px solid #1e2d4a', fontSize:10, color:'#64748b', textTransform:'uppercase', letterSpacing:1 }}>
        {cols.map(c=><span key={c.k}>{c.label}</span>)}
      </div>
      {rows.length===0
        ? <div style={{ padding:'30px', textAlign:'center', color:'#64748b', fontSize:13 }}>{emptyMsg}</div>
        : rows.map((row,i)=>(
          <div key={i} style={{ display:'grid', gridTemplateColumns:cols.map(c=>c.w||'1fr').join(' '), padding:'11px 16px', borderBottom:'1px solid #0f1929', alignItems:'center' }}
            onMouseEnter={e=>e.currentTarget.style.background='rgba(255,255,255,.02)'}
            onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
            {cols.map(c=>(
              <span key={c.k} style={{ fontSize:12, color:c.cor?c.cor(row[c.k]):c.k==='idx'?'#64748b':'#e2e8f0', fontWeight:c.bold?700:400 }}>
                {c.render?c.render(row):row[c.k]??'—'}
              </span>
            ))}
          </div>
        ))
      }
    </div>
  )
}

// ── Gerador de Relatório Personalizado ────────────────────────────────────

function GeradorRelatorio({ cfg, perfil }) {
  const FONTES = {
    historico:    { label:'📝 Histórico de Vendas',    campos:['data','cliente','consultor','valorAdesao','valorMensal','modulos'] },
    crm_negocios: { label:'🤝 Negócios CRM',           campos:['nome','etapa','valor','responsavel','criadoEm','updatedAt'] },
    crm_atividades:{ label:'📅 Atividades CRM',        campos:['tipo','descricao','prazo','concluida','userId'] },
    kpiLog:       { label:'📊 KPIs',                   campos:['date','kpiId','realizado','userName'] },
    fin_contas:   { label:'💰 Contas',                 campos:['descricao','tipo','valor','status','vencimento','categoria'] },
    usuarios:     { label:'👥 Usuários',               campos:['nome','email','tipo'] },
  }
  const AGRUPAMENTOS = ['Nenhum','Por dia','Por semana','Por mês','Por usuário']

  const [fonte,       setFonte]       = useState('historico')
  const [camposSel,   setCamposSel]   = useState(['data','cliente','valorAdesao','valorMensal'])
  const [agrupamento, setAgrupamento] = useState('Nenhum')
  const [periodoIni,  setPeriodoIni]  = useState('')
  const [periodoFim,  setPeriodoFim]  = useState('')
  const [resultado,   setResultado]   = useState(null)

  const isGestor = perfil?.perfil==='admin'||perfil?.perfil==='gestor'||perfil?.tipo==='admin'||perfil?.tipo==='gestor'

  function toggleCampo(c) {
    setCamposSel(prev => prev.includes(c) ? prev.filter(x=>x!==c) : [...prev,c])
  }

  function gerar() {
    let dados = (cfg[fonte] || [])
    // Filtro por perfil
    if (!isGestor && fonte === 'historico') {
      dados = dados.filter(r => r.userId===perfil?.user_id || r.userName===perfil?.nome || r.consultor===perfil?.nome)
    }
    // Filtro por período
    if (periodoIni) dados = dados.filter(r => { const d=r.date||r.criadoEm||r.vencimento||''; return d>=periodoIni })
    if (periodoFim) dados = dados.filter(r => { const d=r.date||r.criadoEm||r.vencimento||''; return d<=periodoFim+'T23:59:59' })
    // Seleciona campos
    const rows = dados.map((r,i) => {
      const row = { idx:i+1 }
      camposSel.forEach(c => { row[c]=r[c]??'—' })
      return row
    })
    setResultado(rows)
  }

  function exportarCSV() {
    if (!resultado?.length) return
    const header = ['#',...camposSel].join(';')
    const lines  = resultado.map(r => [r.idx,...camposSel.map(c=>r[c])].join(';'))
    const blob   = new Blob([header+'\n'+lines.join('\n')], { type:'text/csv;charset=utf-8;' })
    const url    = URL.createObjectURL(blob)
    const a      = document.createElement('a'); a.href=url; a.download=`relatorio_${fonte}_${new Date().toISOString().slice(0,10)}.csv`; a.click()
  }

  const camposFonte = FONTES[fonte]?.campos || []

  return (
    <div>
      <div style={{ background:'#111827', border:'1px solid #1e2d4a', borderRadius:14, padding:22, marginBottom:20 }}>
        <div style={{ fontFamily:'Syne,sans-serif', fontSize:16, fontWeight:800, color:'#e2e8f0', marginBottom:18 }}>🛠 Monte seu Relatório Personalizado</div>

        {/* Fonte */}
        <div style={{ marginBottom:18 }}>
          <label style={{ fontSize:10, color:'#64748b', display:'block', marginBottom:8, textTransform:'uppercase', letterSpacing:1 }}>1. Fonte de Dados</label>
          <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
            {Object.entries(FONTES).map(([k,v]) => (
              <button key={k} onClick={()=>{ setFonte(k); setCamposSel(v.campos.slice(0,4)) }}
                style={{ padding:'7px 14px', borderRadius:8, border:`1.5px solid ${fonte===k?'#00d4ff':'#1e2d4a'}`, background:fonte===k?'rgba(0,212,255,.12)':'#1a2540', color:fonte===k?'#00d4ff':'#64748b', fontFamily:'DM Mono,monospace', fontSize:11.5, cursor:'pointer', fontWeight:fonte===k?600:400 }}>
                {v.label}
              </button>
            ))}
          </div>
        </div>

        {/* Campos */}
        <div style={{ marginBottom:18 }}>
          <label style={{ fontSize:10, color:'#64748b', display:'block', marginBottom:8, textTransform:'uppercase', letterSpacing:1 }}>2. Campos a Exibir</label>
          <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
            {camposFonte.map(c => (
              <button key={c} onClick={()=>toggleCampo(c)}
                style={{ padding:'5px 12px', borderRadius:6, border:`1px solid ${camposSel.includes(c)?'rgba(16,185,129,.4)':'#1e2d4a'}`, background:camposSel.includes(c)?'rgba(16,185,129,.1)':'#1a2540', color:camposSel.includes(c)?'#10b981':'#64748b', fontFamily:'DM Mono,monospace', fontSize:11, cursor:'pointer' }}>
                {camposSel.includes(c)?'✓ ':''}{c}
              </button>
            ))}
          </div>
        </div>

        {/* Período e Agrupamento */}
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:12, marginBottom:18 }}>
          <div>
            <label style={{ fontSize:10, color:'#64748b', display:'block', marginBottom:6, textTransform:'uppercase', letterSpacing:1 }}>3. Período — De</label>
            <input type="date" value={periodoIni} onChange={e=>setPeriodoIni(e.target.value)}
              style={{ width:'100%', background:'#1a2540', border:'1px solid #1e2d4a', borderRadius:8, padding:'8px 10px', fontFamily:'DM Mono,monospace', fontSize:12, color:'#e2e8f0', outline:'none' }} />
          </div>
          <div>
            <label style={{ fontSize:10, color:'#64748b', display:'block', marginBottom:6, textTransform:'uppercase', letterSpacing:1 }}>Até</label>
            <input type="date" value={periodoFim} onChange={e=>setPeriodoFim(e.target.value)}
              style={{ width:'100%', background:'#1a2540', border:'1px solid #1e2d4a', borderRadius:8, padding:'8px 10px', fontFamily:'DM Mono,monospace', fontSize:12, color:'#e2e8f0', outline:'none' }} />
          </div>
          <div>
            <label style={{ fontSize:10, color:'#64748b', display:'block', marginBottom:6, textTransform:'uppercase', letterSpacing:1 }}>4. Agrupamento</label>
            <select value={agrupamento} onChange={e=>setAgrupamento(e.target.value)}
              style={{ width:'100%', background:'#1a2540', border:'1px solid #1e2d4a', borderRadius:8, padding:'8px 10px', fontFamily:'DM Mono,monospace', fontSize:12, color:'#e2e8f0', outline:'none', cursor:'pointer' }}>
              {AGRUPAMENTOS.map(a=><option key={a} value={a}>{a}</option>)}
            </select>
          </div>
        </div>

        <div style={{ display:'flex', gap:10 }}>
          <button onClick={gerar}
            style={{ padding:'10px 22px', borderRadius:9, background:'linear-gradient(135deg,#00d4ff,#0099bb)', border:'none', color:'#fff', fontFamily:'DM Mono,monospace', fontSize:12, fontWeight:600, cursor:'pointer' }}>
            🔍 Gerar Relatório
          </button>
          {resultado?.length > 0 && (
            <button onClick={exportarCSV}
              style={{ padding:'10px 18px', borderRadius:9, background:'rgba(16,185,129,.1)', border:'1px solid rgba(16,185,129,.25)', color:'#10b981', fontFamily:'DM Mono,monospace', fontSize:12, cursor:'pointer' }}>
              📥 Exportar CSV
            </button>
          )}
        </div>
      </div>

      {/* Resultado */}
      {resultado !== null && (
        <div style={{ background:'#111827', border:'1px solid #1e2d4a', borderRadius:12, overflow:'hidden' }}>
          <div style={{ padding:'14px 18px', borderBottom:'1px solid #1e2d4a', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
            <div style={{ fontFamily:'Syne,sans-serif', fontSize:14, fontWeight:700, color:'#e2e8f0' }}>
              Resultado — {resultado.length} registro(s)
            </div>
          </div>
          <div style={{ overflowX:'auto' }}>
            <table style={{ width:'100%', borderCollapse:'collapse', fontFamily:'DM Mono,monospace', fontSize:12 }}>
              <thead>
                <tr style={{ background:'#1a2540' }}>
                  <th style={{ padding:'8px 14px', textAlign:'left', color:'#64748b', fontSize:10, textTransform:'uppercase', letterSpacing:1 }}>#</th>
                  {camposSel.map(c=><th key={c} style={{ padding:'8px 14px', textAlign:'left', color:'#64748b', fontSize:10, textTransform:'uppercase', letterSpacing:1 }}>{c}</th>)}
                </tr>
              </thead>
              <tbody>
                {resultado.slice(0,100).map((r,i)=>(
                  <tr key={i} style={{ borderBottom:'1px solid #0f1929' }}
                    onMouseEnter={e=>e.currentTarget.style.background='rgba(255,255,255,.02)'}
                    onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                    <td style={{ padding:'9px 14px', color:'#475569' }}>{r.idx}</td>
                    {camposSel.map(c=><td key={c} style={{ padding:'9px 14px', color:'#e2e8f0', maxWidth:200, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{String(r[c]??'—')}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
            {resultado.length > 100 && (
              <div style={{ padding:'12px 18px', textAlign:'center', color:'#64748b', fontSize:12 }}>
                Mostrando 100 de {resultado.length} registros. Exporte o CSV para ver todos.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Componente principal ───────────────────────────────────────────────────

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
      const eid = perf?.empresa_id || sess.user.id; setEmpresaId(eid)
      const { data: row } = await supabase.from('vx_storage').select('value').eq('key', `cfg:${eid}`).single()
      if (row?.value) setCfg(JSON.parse(row.value))
      setLoading(false)
    }
    init()
  }, [router])

  // ── Dados derivados ──────────────────────────────────────────────────────
  const historico   = cfg.historico       || []
  const kpiLog      = cfg.kpiLog          || []
  const kpiTpls     = cfg.kpiTemplates    || []
  const metas       = cfg.metas           || {}
  const negocios    = cfg.crm_negocios    || []
  const atividades  = cfg.crm_atividades  || []
  const usuarios    = cfg.users           || cfg.usuarios || []
  const contas      = cfg.fin_contas      || []
  const campanhas   = cfg.marketing_campanhas || []

  const isGestor = perfil?.perfil==='admin'||perfil?.perfil==='gestor'||perfil?.tipo==='admin'||perfil?.tipo==='gestor'
  const userId   = perfil?.user_id || perfil?.id

  // Filtro por período (mês)
  const histMes = historico.filter(h => {
    const d = h.date || h.criadoEm || ''
    const dentroMes = d.startsWith(mesFiltro)
    if (!isGestor) {
      const userMatch = usuarios.find(u=>u.email===perfil?.email||u.id===userId)
      return dentroMes && (h.userId===userId||h.userId===userMatch?.id||h.consultor===perfil?.nome||h.userName===perfil?.nome)
    }
    if (userFiltro !== 'todos') return dentroMes && (h.userId===userFiltro||h.userName===userFiltro)
    return dentroMes
  })

  // Financeiro
  const receitaMes     = histMes.reduce((a,h)=>a+Number(h.tMenD||h.mensalidade||0),0)
  const adesaoMes      = histMes.reduce((a,h)=>a+Number(h.tAdD||h.adesao||0),0)
  const contratosMes   = histMes.length
  const ticketMedio    = contratosMes > 0 ? receitaMes/contratosMes : 0
  const contasRec      = contas.filter(c=>c.tipo==='Receita'&&(c.vencimento||'').startsWith(mesFiltro))
  const contasPag      = contas.filter(c=>c.tipo==='Despesa'&&(c.vencimento||'').startsWith(mesFiltro))
  const totalRec       = contasRec.reduce((a,c)=>a+Number(c.valor||0),0)
  const totalPag       = contasPag.reduce((a,c)=>a+Number(c.valor||0),0)
  const saldo          = totalRec - totalPag

  // Meses anteriores (6 meses)
  const mesesAnteriores = [-5,-4,-3,-2,-1,0].map(d => {
    const dt = new Date(); dt.setMonth(dt.getMonth()+d)
    const ym = dt.toISOString().slice(0,7)
    const label = dt.toLocaleDateString('pt-BR',{month:'short'})
    const valor = historico.filter(h=>(h.date||'').startsWith(ym)).reduce((a,h)=>a+Number(h.tMenD||h.mensalidade||0),0)
    const qtd   = historico.filter(h=>(h.date||'').startsWith(ym)).length
    // Mês anterior para comparação
    return { ym, label, valor, qtd, cor:ym===mesFiltro?'#00d4ff':'#1e2d4a' }
  })
  const mesAnterior = mesesAnteriores[mesesAnteriores.length-2]
  const mesAtualData = mesesAnteriores[mesesAnteriores.length-1]
  const crescimento = mesAnterior?.valor > 0 ? Math.round(((mesAtualData?.valor-mesAnterior?.valor)/mesAnterior.valor)*100) : null

  // KPIs
  const hojeStr   = new Date().toISOString().slice(0,10)
  const kpiHoje   = kpiLog.filter(l=>l.date===hojeStr)
  const diasUteis = diasUteisNoMes(mesFiltro)
  const kpiMes    = kpiLog.filter(l=>(l.date||'').startsWith(mesFiltro))

  // CRM
  const ETAPAS = ['lead','lead_qualificado','lead_marketing','reuniao_agendada','atendimento','proposta_enviada','fechamento','perdido']
  const negPorEtapa    = ETAPAS.map(e=>({ etapa:e, qtd:negocios.filter(n=>n.etapa===e).length }))
  const taxaConversao  = negocios.length>0?Math.round((negocios.filter(n=>n.etapa==='fechamento').length/negocios.length)*100):0
  const ativsAtrasadas = atividades.filter(a=>!a.concluida&&a.prazo&&new Date(a.prazo)<new Date()).length
  const ativsHoje      = atividades.filter(a=>!a.concluida&&a.prazo&&a.prazo.slice(0,10)===hojeStr).length

  // Módulos mais vendidos
  const modContagem = {}
  histMes.forEach(h => {
    const mods = h.modulos?(Array.isArray(h.modulos)?h.modulos:h.modulos.split(',')): []
    mods.forEach(m=>{ if(m.trim()) modContagem[m.trim()]=(modContagem[m.trim()]||0)+1 })
  })
  const topMods = Object.entries(modContagem).sort((a,b)=>b[1]-a[1]).slice(0,8)

  // Adesão e mensalidade por módulo
  const modValores = {}
  histMes.forEach(h => {
    const mods = h.modulos?(Array.isArray(h.modulos)?h.modulos:h.modulos.split(',')):[],
          ad   = Number(h.tAdD||h.adesao||0)/Math.max(1,mods.length),
          men  = Number(h.tMenD||h.mensalidade||0)/Math.max(1,mods.length)
    mods.forEach(m=>{
      if(!m.trim()) return
      if(!modValores[m.trim()]) modValores[m.trim()]={adesao:0,mensal:0,qtd:0}
      modValores[m.trim()].adesao+=ad; modValores[m.trim()].mensal+=men; modValores[m.trim()].qtd++
    })
  })

  // Comissões
  function calcComissao(vendedorId, vendedorNome, valorAdesao, valorMensal) {
    const user = usuarios.find(u=>u.id===vendedorId||u.user_id===vendedorId||u.nome===vendedorNome||u.email===vendedorNome)
    if (!user?.comissao) return { comAdesao:0, comMensal:0 }
    const { adesao, mensalidade } = user.comissao
    const comAdesao  = adesao?.tipo==='percentual' ? (valorAdesao*(Number(adesao.valor)||0))/100 : Number(adesao?.valor||0)
    const comMensal  = mensalidade?.tipo==='percentual' ? (valorMensal*(Number(mensalidade.valor)||0))/100 : Number(mensalidade?.valor||0)
    return { comAdesao, comMensal }
  }

  // Vendas por consultor
  const porConsultor = {}
  histMes.forEach(h => {
    const uid  = h.userId||h.consultantId||'unknown'
    const nome = h.consultor||h.userName||uid
    if (!porConsultor[uid]) porConsultor[uid]={nome,contratos:0,mensalidade:0,adesao:0,comAdesao:0,comMensal:0}
    porConsultor[uid].contratos++
    porConsultor[uid].mensalidade+=Number(h.tMenD||h.mensalidade||0)
    porConsultor[uid].adesao+=Number(h.tAdD||h.adesao||0)
    const { comAdesao, comMensal } = calcComissao(uid, nome, Number(h.tAdD||h.adesao||0), Number(h.tMenD||h.mensalidade||0))
    porConsultor[uid].comAdesao+=comAdesao; porConsultor[uid].comMensal+=comMensal
  })

  // MRR projetado (média dos últimos 3 meses)
  const mrr3meses = mesesAnteriores.slice(-3).map(m=>m.valor)
  const mrrMedio  = mrr3meses.reduce((a,v)=>a+v,0)/Math.max(1,mrr3meses.filter(v=>v>0).length)

  // Atividades CRM por tipo
  const tiposAtiv = {}
  atividades.forEach(a=>{ const t=a.tipo||'outros'; tiposAtiv[t]=(tiposAtiv[t]||0)+1 })

  // Tempo médio por etapa no CRM (em dias)
  const tempoPorEtapa = {}
  negocios.forEach(n => {
    const t=n.etapa||'desconhecido'
    const dias = n.criadoEm ? Math.round((new Date()-new Date(n.criadoEm))/(1000*60*60*24)) : 0
    if (!tempoPorEtapa[t]) tempoPorEtapa[t]={total:0,qtd:0}
    tempoPorEtapa[t].total+=dias; tempoPorEtapa[t].qtd++
  })

  // Disparos em massa
  const disparos = Object.entries(cfg)
    .filter(([k])=>k.startsWith('campanha:'))
    .map(([k,v])=>({ id:k, ...(typeof v==='object'?v:{}), nome:v?.nome||k }))

  const ABAS_LIST = [
    { id:'estrategico', label:'🎯 Estratégica' },
    { id:'vendas',      label:'🛒 Vendas' },
    { id:'produtos',    label:'📦 Produtos' },
    { id:'kpis',        label:'📊 KPIs' },
    { id:'comissoes',   label:'🏆 Comissões' },
    { id:'crm_atividades', label:'📅 Atividades CRM' },
    { id:'crm_negocios',   label:'🤝 Negócios CRM' },
    { id:'disparos',    label:'📣 Disparos' },
    { id:'marketing',   label:'📢 Marketing' },
    { id:'gerador',     label:'🛠 Gerador' },
  ]

  if (loading) return (
    <div style={{ background:'#0a0f1e', minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', color:'#64748b', fontFamily:'DM Mono,monospace' }}>
      Carregando relatórios...
    </div>
  )

  // Controles de filtro comuns
  const FiltroHeader = () => (
    <div style={{ display:'flex', gap:10, alignItems:'center', flexWrap:'wrap' }}>
      <div>
        <label style={{ fontSize:10, color:'#64748b', display:'block', marginBottom:4 }}>PERÍODO</label>
        <input type="month" value={mesFiltro} onChange={e=>setMesFiltro(e.target.value)}
          style={{ background:'#1a2540', border:'1px solid #1e2d4a', borderRadius:8, padding:'7px 10px', fontFamily:'DM Mono,monospace', fontSize:12, color:'#e2e8f0', outline:'none' }} />
      </div>
      {isGestor && (
        <div>
          <label style={{ fontSize:10, color:'#64748b', display:'block', marginBottom:4 }}>VENDEDOR</label>
          <select value={userFiltro} onChange={e=>setUserFiltro(e.target.value)}
            style={{ background:'#1a2540', border:'1px solid #1e2d4a', borderRadius:8, padding:'7px 10px', fontFamily:'DM Mono,monospace', fontSize:12, color:'#e2e8f0', outline:'none', cursor:'pointer' }}>
            <option value="todos">Todos</option>
            {usuarios.map(u=><option key={u.id} value={u.id}>{u.nome}</option>)}
          </select>
        </div>
      )}
    </div>
  )

  return (
    <>
      <Head>
        <title>Relatórios — {cfg.company||'Vivanexa'}</title>
        <link href="https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=DM+Mono:wght@400;500&display=swap" rel="stylesheet" />
      </Head>
      <style>{CSS}</style>
      <Navbar cfg={cfg} perfil={perfil} />

      <div className="rp-wrap">
        {/* Cabeçalho */}
        <div className="rp-hdr">
          <div>
            <h1 className="rp-title">📈 Relatórios</h1>
            <p className="rp-sub">
              {isGestor ? 'Visão completa do negócio em tempo real' : `Seus indicadores — ${perfil?.nome||''}`}
            </p>
          </div>
          <FiltroHeader />
        </div>

        {/* Abas */}
        <div className="tabs">
          {ABAS_LIST.map(a=>(
            <button key={a.id} className={`tab-btn${aba===a.id?' active':''}`}
              onClick={()=>{ setAba(a.id); router.replace({query:{aba:a.id}},undefined,{shallow:true}) }}>
              {a.label}
            </button>
          ))}
        </div>

        {/* ══ VISÃO ESTRATÉGICA ══ */}
        {aba==='estrategico' && (
          <div>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:14, marginBottom:22 }}>
              <KpiCard label="Receita Mensal"    valor={fmtK(receitaMes)}   sub={`${contratosMes} contratos`}       cor="#10b981" icon="💰" />
              <KpiCard label="Adesão do Mês"     valor={fmtK(adesaoMes)}    sub="Entradas de caixa"                 cor="#00d4ff" icon="📥" />
              <KpiCard label="Ticket Médio"      valor={fmtK(ticketMedio)}  sub="Por contrato"                      cor="#7c3aed" icon="🎯" />
              <KpiCard label="Taxa de Conversão" valor={`${taxaConversao}%`} sub={`${negocios.length} leads`}       cor="#f59e0b" icon="📊" />
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:14, marginBottom:22 }}>
              <KpiCard label="MRR Projetado"   valor={fmtK(mrrMedio)}              sub="Média 3 meses"         cor="#06b6d4" icon="📈" />
              <KpiCard label="Leads Ativos"    valor={fmtN(negocios.filter(n=>n.etapa!=='fechamento'&&n.etapa!=='perdido').length)} sub="Em negociação" cor="#a78bfa" icon="🤝" />
              <KpiCard label="Atrasadas"       valor={fmtN(ativsAtrasadas)}        sub="Atividades CRM"        cor="#ef4444" icon="⚠️" />
              <KpiCard label="Saldo Financeiro" valor={fmtK(saldo)}                sub="Receitas - Despesas"   cor={saldo>=0?'#10b981':'#ef4444'} icon="💳" />
            </div>

            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:18, marginBottom:22 }}>
              <div className="card">
                <div className="card-title">📈 Receita — Últimos 6 Meses
                  {crescimento !== null && (
                    <span style={{ fontSize:11, padding:'2px 8px', borderRadius:5, background:crescimento>=0?'rgba(16,185,129,.12)':'rgba(239,68,68,.12)', color:crescimento>=0?'#10b981':'#ef4444', marginLeft:8 }}>
                      {crescimento>=0?'▲':'▼'} {Math.abs(crescimento)}% vs mês anterior
                    </span>
                  )}
                </div>
                <GraficoBarras dados={mesesAnteriores.map(m=>({ label:m.label, valor:m.valor, cor:m.ym===mesFiltro?'#00d4ff':'#334155' }))} altura={140} />
              </div>
              <div className="card">
                <div className="card-title">📦 Top Módulos — {mesFiltro}</div>
                {topMods.length===0
                  ? <div style={{ color:'#64748b', fontSize:12, textAlign:'center', padding:20 }}>Sem dados</div>
                  : topMods.slice(0,4).map(([mod,qtd],i)=>(
                    <div key={mod} style={{ display:'flex', alignItems:'center', gap:10, marginBottom:10 }}>
                      <div style={{ width:22, fontFamily:'Syne,sans-serif', fontSize:14, fontWeight:800, color:'#64748b' }}>#{i+1}</div>
                      <div style={{ flex:1 }}>
                        <div style={{ display:'flex', justifyContent:'space-between', marginBottom:3 }}>
                          <span style={{ fontSize:12, color:'#e2e8f0' }}>{cfg.productNames?.[mod]||mod}</span>
                          <span style={{ fontSize:11, color:'#00d4ff', fontWeight:700 }}>{qtd} contratos</span>
                        </div>
                        <div style={{ height:5, background:'#1a2540', borderRadius:3, overflow:'hidden' }}>
                          <div style={{ height:'100%', width:`${Math.round((qtd/Math.max(1,topMods[0][1]))*100)}%`, background:`hsl(${190-i*20},80%,55%)`, borderRadius:3 }} />
                        </div>
                      </div>
                    </div>
                  ))
                }
              </div>
            </div>

            {/* Análise estratégica */}
            <div className="card">
              <div className="card-title">🧠 Análise Estratégica — {new Date(mesFiltro+'-01').toLocaleDateString('pt-BR',{month:'long',year:'numeric'})}</div>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:14 }}>
                <div style={{ background:'#1a2540', border:'1px solid #1e2d4a', borderRadius:12, padding:16 }}>
                  <div style={{ fontSize:11, color:'#00d4ff', fontWeight:700, textTransform:'uppercase', letterSpacing:1, marginBottom:12 }}>💼 Saúde Comercial</div>
                  {[
                    { l:'Contratos fechados',  v:contratosMes,  cor:'#10b981' },
                    { l:'Leads em pipeline',   v:negocios.filter(n=>n.etapa!=='fechamento'&&n.etapa!=='perdido').length, cor:'#00d4ff' },
                    { l:'Taxa de conversão',   v:`${taxaConversao}%`, cor:taxaConversao>=30?'#10b981':taxaConversao>=15?'#f59e0b':'#ef4444' },
                    { l:'Atividades atrasadas',v:ativsAtrasadas, cor:ativsAtrasadas===0?'#10b981':'#ef4444' },
                  ].map(r=>(
                    <div key={r.l} style={{ display:'flex', justifyContent:'space-between', padding:'8px 0', borderBottom:'1px solid #1e2d4a', fontSize:12 }}>
                      <span style={{ color:'#94a3b8' }}>{r.l}</span>
                      <span style={{ color:r.cor, fontWeight:700 }}>{r.v}</span>
                    </div>
                  ))}
                </div>
                <div style={{ background:'#1a2540', border:'1px solid #1e2d4a', borderRadius:12, padding:16 }}>
                  <div style={{ fontSize:11, color:'#7c3aed', fontWeight:700, textTransform:'uppercase', letterSpacing:1, marginBottom:12 }}>💰 Saúde Financeira</div>
                  {[
                    { l:'Receita MRR',  v:fmtK(receitaMes), cor:'#10b981' },
                    { l:'Adesão',       v:fmtK(adesaoMes),  cor:'#00d4ff' },
                    { l:'MRR Projetado',v:fmtK(mrrMedio),   cor:'#a78bfa' },
                    { l:'Saldo',        v:fmtK(saldo),       cor:saldo>=0?'#10b981':'#ef4444' },
                  ].map(r=>(
                    <div key={r.l} style={{ display:'flex', justifyContent:'space-between', padding:'8px 0', borderBottom:'1px solid #1e2d4a', fontSize:12 }}>
                      <span style={{ color:'#94a3b8' }}>{r.l}</span>
                      <span style={{ color:r.cor, fontWeight:700 }}>{r.v}</span>
                    </div>
                  ))}
                </div>
                <div style={{ background:'#1a2540', border:'1px solid #1e2d4a', borderRadius:12, padding:16 }}>
                  <div style={{ fontSize:11, color:'#10b981', fontWeight:700, textTransform:'uppercase', letterSpacing:1, marginBottom:12 }}>🏆 Top Consultores</div>
                  {Object.values(porConsultor).sort((a,b)=>b.contratos-a.contratos).slice(0,4).map((u,i)=>(
                    <div key={i} style={{ display:'flex', justifyContent:'space-between', padding:'8px 0', borderBottom:'1px solid #1e2d4a', fontSize:12 }}>
                      <span style={{ color:'#94a3b8' }}>#{i+1} {u.nome}</span>
                      <span style={{ color:'#10b981', fontWeight:700 }}>{u.contratos} ct.</span>
                    </div>
                  ))}
                  {Object.keys(porConsultor).length===0 && <div style={{ color:'#475569', fontSize:12 }}>Sem dados no período</div>}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ══ VENDAS ══ */}
        {aba==='vendas' && (
          <div>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:14, marginBottom:22 }}>
              <KpiCard label="Contratos"    valor={contratosMes}       sub="Fechados no mês"    cor="#00d4ff" icon="📝" />
              <KpiCard label="Receita MRR"  valor={fmtK(receitaMes)}   sub="Mensalidades"        cor="#10b981" icon="💰" />
              <KpiCard label="Adesão"       valor={fmtK(adesaoMes)}    sub="Entradas de caixa"   cor="#7c3aed" icon="📥" />
              <KpiCard label="Ticket Médio" valor={fmtK(ticketMedio)}  sub="Por contrato"        cor="#f59e0b" icon="🎯" />
            </div>

            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:18, marginBottom:22 }}>
              <div className="card">
                <div className="card-title">📈 Evolução de Receita — 6 Meses</div>
                <GraficoBarras dados={mesesAnteriores.map(m=>({ label:m.label, valor:m.valor, cor:m.ym===mesFiltro?'#00d4ff':'#334155' }))} altura={130} />
              </div>
              <div className="card">
                <div className="card-title">📊 Contratos por Mês</div>
                <GraficoBarras dados={mesesAnteriores.map(m=>({ label:m.label, valor:m.qtd, cor:m.ym===mesFiltro?'#7c3aed':'#334155' }))} altura={130} moeda={false} />
              </div>
            </div>

            {/* Ranking de consultores */}
            <div className="card" style={{ marginBottom:18 }}>
              <div className="card-title">🏆 {isGestor?'Ranking de Consultores':'Meu Desempenho'}</div>
              {Object.keys(porConsultor).length===0
                ? <div style={{ color:'#64748b', fontSize:12, textAlign:'center', padding:20 }}>Sem dados neste período</div>
                : Object.values(porConsultor).sort((a,b)=>b.contratos-a.contratos).map((u,i)=>(
                  <div key={i} style={{ display:'flex', alignItems:'center', gap:12, padding:'12px 0', borderBottom:'1px solid #1e2d4a' }}>
                    <div style={{ width:28, height:28, borderRadius:'50%', background:i===0?'#f59e0b':i===1?'#94a3b8':'#cd7c32', display:'flex', alignItems:'center', justifyContent:'center', fontSize:12, fontWeight:700, color:'#000', flexShrink:0 }}>{i+1}</div>
                    <div style={{ flex:1 }}>
                      <div style={{ fontSize:13, fontWeight:600, color:'#e2e8f0' }}>{u.nome}</div>
                      <div style={{ fontSize:10, color:'#64748b' }}>{u.contratos} contratos · Adesão: {fmtK(u.adesao)}</div>
                    </div>
                    <div style={{ textAlign:'right' }}>
                      <div style={{ fontSize:14, fontWeight:800, color:'#10b981' }}>{fmtK(u.mensalidade)}</div>
                      <div style={{ fontSize:10, color:'#64748b' }}>MRR</div>
                    </div>
                  </div>
                ))
              }
            </div>

            {/* Tabela detalhada de contratos */}
            <div className="card">
              <div className="card-title">📋 Contratos Detalhados — {mesFiltro}</div>
              {histMes.length===0
                ? <div style={{ color:'#64748b', fontSize:12, textAlign:'center', padding:20 }}>Sem contratos neste período</div>
                : <div style={{ overflowX:'auto' }}>
                  <table style={{ width:'100%', borderCollapse:'collapse', fontFamily:'DM Mono,monospace', fontSize:12 }}>
                    <thead>
                      <tr style={{ borderBottom:'1px solid #1e2d4a' }}>
                        {['Data','Cliente',isGestor&&'Consultor','Adesão','Mensalidade','Módulos'].filter(Boolean).map(h=>(
                          <th key={h} style={{ padding:'8px 12px', textAlign:'left', color:'#64748b', fontSize:10, textTransform:'uppercase', letterSpacing:1 }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {histMes.map((h,i)=>(
                        <tr key={i} style={{ borderBottom:'1px solid #0f1929' }}
                          onMouseEnter={e=>e.currentTarget.style.background='rgba(255,255,255,.02)'}
                          onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                          <td style={{ padding:'9px 12px', color:'#64748b' }}>{fmtDate(h.date)}</td>
                          <td style={{ padding:'9px 12px', color:'#e2e8f0' }}>{h.cliente||h.clienteNome||'—'}</td>
                          {isGestor && <td style={{ padding:'9px 12px', color:'#94a3b8' }}>{h.consultor||h.userName||'—'}</td>}
                          <td style={{ padding:'9px 12px', color:'#00d4ff', fontWeight:700 }}>{fmt(h.tAdD||h.adesao||0)}</td>
                          <td style={{ padding:'9px 12px', color:'#10b981', fontWeight:700 }}>{fmt(h.tMenD||h.mensalidade||0)}</td>
                          <td style={{ padding:'9px 12px', color:'#64748b', fontSize:11 }}>{Array.isArray(h.modulos)?h.modulos.join(', '):(h.modulos||'—')}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              }
            </div>
          </div>
        )}

        {/* ══ PRODUTOS ══ */}
        {aba==='produtos' && (
          <div>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:14, marginBottom:22 }}>
              <KpiCard label="Módulos Vendidos"  valor={topMods.length}                                    sub="Neste período"      cor="#00d4ff" icon="📦" />
              <KpiCard label="Módulo Líder"       valor={topMods[0]?.[0]||'—'}                            sub={`${topMods[0]?.[1]||0} contratos`} cor="#f59e0b" icon="🥇" />
              <KpiCard label="Receita Total"      valor={fmtK(receitaMes+adesaoMes)}                      sub="Mensal + Adesão"    cor="#10b981" icon="💰" />
            </div>

            <div className="card" style={{ marginBottom:18 }}>
              <div className="card-title">📦 Módulos — Contratos, Adesão e Mensalidade</div>
              {Object.keys(modValores).length===0
                ? <div style={{ color:'#64748b', fontSize:12, textAlign:'center', padding:20 }}>Sem dados neste período</div>
                : Object.entries(modValores).sort((a,b)=>b[1].qtd-a[1].qtd).map(([mod,v],i)=>(
                  <div key={mod} style={{ display:'grid', gridTemplateColumns:'180px 60px 1fr 1fr 1fr', alignItems:'center', gap:14, padding:'12px 0', borderBottom:'1px solid #1e2d4a' }}>
                    <div style={{ fontSize:13, fontWeight:600, color:'#e2e8f0' }}>#{i+1} {cfg.productNames?.[mod]||mod}</div>
                    <div style={{ fontSize:12, color:'#00d4ff', fontWeight:700 }}>{v.qtd} ct.</div>
                    <div>
                      <div style={{ fontSize:10, color:'#64748b', marginBottom:3 }}>Adesão</div>
                      <div style={{ fontSize:13, color:'#7c3aed', fontWeight:700 }}>{fmt(v.adesao)}</div>
                    </div>
                    <div>
                      <div style={{ fontSize:10, color:'#64748b', marginBottom:3 }}>Mensalidade</div>
                      <div style={{ fontSize:13, color:'#10b981', fontWeight:700 }}>{fmt(v.mensal)}</div>
                    </div>
                    <div>
                      <div style={{ fontSize:10, color:'#64748b', marginBottom:3 }}>Total</div>
                      <div style={{ fontSize:13, color:'#f59e0b', fontWeight:700 }}>{fmt(v.adesao+v.mensal)}</div>
                    </div>
                  </div>
                ))
              }
            </div>

            <div className="card">
              <div className="card-title">📊 Volume por Módulo</div>
              <GraficoBarras dados={topMods.map(([mod,qtd],i)=>({ label:(cfg.productNames?.[mod]||mod).slice(0,6), valor:qtd, cor:`hsl(${190-i*20},80%,55%)` }))} altura={140} moeda={false} />
            </div>
          </div>
        )}

        {/* ══ KPIs ══ */}
        {aba==='kpis' && (
          <div>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:14, marginBottom:22 }}>
              <KpiCard label="KPIs Configurados"  valor={kpiTpls.length}  sub="Indicadores ativos"           cor="#00d4ff" icon="📊" />
              <KpiCard label="Lançamentos Hoje"   valor={kpiHoje.length}  sub="Registros hoje"               cor="#10b981" icon="✅" />
              <KpiCard label="Lançamentos no Mês" valor={kpiMes.length}   sub={`de ${diasUteis} dias úteis`} cor="#7c3aed" icon="📅" />
              <KpiCard label="Dias Úteis"         valor={diasUteis}       sub={mesFiltro}                    cor="#f59e0b" icon="📆" />
            </div>

            {kpiTpls.length===0
              ? <div className="card" style={{ textAlign:'center', padding:40 }}>
                  <div style={{ fontSize:40, marginBottom:12 }}>📊</div>
                  <div style={{ color:'#64748b', marginBottom:16 }}>Nenhum KPI configurado</div>
                  <button className="btn-primary" onClick={()=>router.push('/configuracoes?tab=kpis')}>Configurar KPIs →</button>
                </div>
              : kpiTpls.map(k=>{
                  const logsMes   = kpiMes.filter(l=>l.kpiId===k.id)
                  const totalReal = logsMes.reduce((a,l)=>a+Number(l.realizado||0),0)
                  const metaDiaria = Number(cfg.kpiDailyGoals?.[session?.user?.id]?.[k.id]||0)
                  const metaMes   = metaDiaria*diasUteis
                  const p = metaMes>0?Math.min(100,Math.round((totalReal/metaMes)*100)):null
                  const cor = !p?'#64748b':p>=100?'#10b981':p>=70?'#00d4ff':p>=40?'#f59e0b':'#ef4444'
                  const porUser = {}
                  logsMes.forEach(l=>{ if(!porUser[l.userId])porUser[l.userId]={nome:l.userName,total:0}; porUser[l.userId].total+=Number(l.realizado||0) })
                  return (
                    <div key={k.id} className="card" style={{ marginBottom:14 }}>
                      <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:14 }}>
                        <span style={{ fontSize:24 }}>{k.icone||'📊'}</span>
                        <div style={{ flex:1 }}>
                          <div style={{ fontFamily:'Syne,sans-serif', fontSize:15, fontWeight:700, color:'#e2e8f0' }}>{k.nome}</div>
                          <div style={{ fontSize:11, color:'#64748b' }}>Meta: {metaDiaria}/dia · {metaMes} total em {mesFiltro}</div>
                        </div>
                        <div style={{ textAlign:'right' }}>
                          <div style={{ fontFamily:'Syne,sans-serif', fontSize:22, fontWeight:800, color:cor }}>{fmtN(totalReal)}</div>
                          <div style={{ fontSize:10, color:'#64748b' }}>{p!==null?`${p}% da meta`:'Sem meta'}</div>
                        </div>
                      </div>
                      {p!==null && <div style={{ height:8, background:'#1a2540', borderRadius:4, overflow:'hidden', marginBottom:14 }}><div style={{ height:'100%', width:`${p}%`, background:cor, borderRadius:4, transition:'width .6s' }} /></div>}
                      {isGestor && Object.keys(porUser).length>0 && (
                        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(150px,1fr))', gap:8 }}>
                          {Object.entries(porUser).map(([uid,u])=>(
                            <div key={uid} style={{ background:'#1a2540', border:'1px solid #1e2d4a', borderRadius:8, padding:'8px 12px' }}>
                              <div style={{ fontSize:10, color:'#64748b', marginBottom:3 }}>👤 {u.nome||uid}</div>
                              <div style={{ fontSize:16, fontWeight:700, color:'#e2e8f0' }}>{fmtN(u.total)} {k.unidade||''}</div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )
                })
            }
          </div>
        )}

        {/* ══ COMISSÕES ══ */}
        {aba==='comissoes' && (
          <div>
            {/* Cards de totais */}
            {(() => {
              const contratosComissao = histMes
              const totComAdesao = contratosComissao.reduce((acc,h)=>{
                const { comAdesao }=calcComissao(h.userId||h.consultantId, h.consultor||h.userName, Number(h.tAdD||h.adesao||0), Number(h.tMenD||h.mensalidade||0))
                return acc+comAdesao
              },0)
              const totComMensal = contratosComissao.reduce((acc,h)=>{
                const { comMensal }=calcComissao(h.userId||h.consultantId, h.consultor||h.userName, Number(h.tAdD||h.adesao||0), Number(h.tMenD||h.mensalidade||0))
                return acc+comMensal
              },0)
              return (
                <>
                  <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:14, marginBottom:22 }}>
                    <KpiCard label="Comissão Adesão"    valor={fmt(totComAdesao)}           sub={`${contratosComissao.length} contratos`} cor="#00d4ff" icon="📥" />
                    <KpiCard label="Comissão Mensal"    valor={fmt(totComMensal)}           sub="Recorrente" cor="#10b981" icon="🔄" />
                    <KpiCard label="Total Comissões"    valor={fmt(totComAdesao+totComMensal)} sub="Período"  cor="#7c3aed" icon="🏆" />
                  </div>

                  {/* Resumo por vendedor (gestor) */}
                  {isGestor && (
                    <div className="card" style={{ marginBottom:18 }}>
                      <div className="card-title">👥 Comissões por Vendedor</div>
                      {Object.keys(porConsultor).length===0
                        ? <div style={{ color:'#64748b', fontSize:12, textAlign:'center', padding:20 }}>Sem dados no período</div>
                        : Object.values(porConsultor).sort((a,b)=>(b.comAdesao+b.comMensal)-(a.comAdesao+a.comMensal)).map((u,i)=>(
                          <div key={i} style={{ display:'grid', gridTemplateColumns:'180px 80px 1fr 1fr 1fr', alignItems:'center', gap:10, padding:'12px 0', borderBottom:'1px solid #1e2d4a' }}>
                            <div style={{ fontWeight:600, color:'#e2e8f0', fontSize:13 }}>{u.nome}</div>
                            <div style={{ fontSize:12, color:'#94a3b8' }}>{u.contratos} ct.</div>
                            <div><div style={{ fontSize:10, color:'#64748b' }}>Com. Adesão</div><div style={{ fontSize:13, color:'#00d4ff', fontWeight:700 }}>{fmt(u.comAdesao)}</div></div>
                            <div><div style={{ fontSize:10, color:'#64748b' }}>Com. Mensal</div><div style={{ fontSize:13, color:'#7c3aed', fontWeight:700 }}>{fmt(u.comMensal)}</div></div>
                            <div><div style={{ fontSize:10, color:'#64748b' }}>Total</div><div style={{ fontSize:13, color:'#f59e0b', fontWeight:700 }}>{fmt(u.comAdesao+u.comMensal)}</div></div>
                          </div>
                        ))
                      }
                    </div>
                  )}

                  {/* Tabela individual */}
                  <div className="card">
                    <div className="card-title">📋 Comissão por Contrato — {mesFiltro}</div>
                    {contratosComissao.length===0
                      ? <div style={{ color:'#64748b', fontSize:12, textAlign:'center', padding:20 }}>Sem contratos neste período</div>
                      : <div style={{ overflowX:'auto' }}>
                        <table style={{ width:'100%', borderCollapse:'collapse', fontFamily:'DM Mono,monospace', fontSize:12 }}>
                          <thead>
                            <tr style={{ borderBottom:'1px solid #1e2d4a' }}>
                              {['Data','Cliente',isGestor&&'Consultor','V. Adesão','V. Mensal','Com. Adesão','Com. Mensal','Total Com.'].filter(Boolean).map(h=>(
                                <th key={h} style={{ padding:'8px 12px', textAlign:'left', color:'#64748b', fontSize:10, textTransform:'uppercase', letterSpacing:1 }}>{h}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {contratosComissao.map((h,i)=>{
                              const ad  = Number(h.tAdD||h.adesao||0)
                              const men = Number(h.tMenD||h.mensalidade||0)
                              const { comAdesao, comMensal } = calcComissao(h.userId||h.consultantId, h.consultor||h.userName, ad, men)
                              return (
                                <tr key={i} style={{ borderBottom:'1px solid #0f1929' }}
                                  onMouseEnter={e=>e.currentTarget.style.background='rgba(255,255,255,.02)'}
                                  onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                                  <td style={{ padding:'9px 12px', color:'#64748b' }}>{fmtDate(h.date)}</td>
                                  <td style={{ padding:'9px 12px', color:'#e2e8f0' }}>{h.cliente||h.clienteNome||'—'}</td>
                                  {isGestor&&<td style={{ padding:'9px 12px', color:'#94a3b8' }}>{h.consultor||h.userName||'—'}</td>}
                                  <td style={{ padding:'9px 12px', color:'#00d4ff' }}>{fmt(ad)}</td>
                                  <td style={{ padding:'9px 12px', color:'#10b981' }}>{fmt(men)}</td>
                                  <td style={{ padding:'9px 12px', color:'#f59e0b', fontWeight:700 }}>{fmt(comAdesao)}</td>
                                  <td style={{ padding:'9px 12px', color:'#a78bfa', fontWeight:700 }}>{fmt(comMensal)}</td>
                                  <td style={{ padding:'9px 12px', color:'#fbbf24', fontWeight:800 }}>{fmt(comAdesao+comMensal)}</td>
                                </tr>
                              )
                            })}
                          </tbody>
                        </table>
                      </div>
                    }
                  </div>
                </>
              )
            })()}
          </div>
        )}

        {/* ══ ATIVIDADES CRM ══ */}
        {aba==='crm_atividades' && (
          <div>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:14, marginBottom:22 }}>
              <KpiCard label="Total Atividades"  valor={atividades.length}                              sub="Todas"              cor="#00d4ff" icon="📅" />
              <KpiCard label="Concluídas"         valor={atividades.filter(a=>a.concluida).length}     sub="Finalizadas"        cor="#10b981" icon="✅" />
              <KpiCard label="Pendentes"          valor={atividades.filter(a=>!a.concluida).length}    sub="Em aberto"          cor="#f59e0b" icon="⏳" />
              <KpiCard label="Atrasadas"          valor={ativsAtrasadas}                               sub="Prazo vencido"      cor="#ef4444" icon="⚠️" />
            </div>

            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:18, marginBottom:18 }}>
              <div className="card">
                <div className="card-title">📊 Por Tipo de Atividade</div>
                {Object.entries(tiposAtiv).length===0
                  ? <div style={{ color:'#64748b', fontSize:12, textAlign:'center', padding:20 }}>Sem atividades registradas</div>
                  : Object.entries(tiposAtiv).sort((a,b)=>b[1]-a[1]).map(([tipo,qtd])=>(
                    <div key={tipo} style={{ display:'flex', alignItems:'center', gap:12, marginBottom:10 }}>
                      <div style={{ width:120, fontSize:12, color:'#94a3b8', textTransform:'capitalize', flexShrink:0 }}>{tipo}</div>
                      <div style={{ flex:1, height:22, background:'#1a2540', borderRadius:4, overflow:'hidden' }}>
                        <div style={{ height:'100%', width:`${Math.max(5,(qtd/Math.max(1,atividades.length))*100)}%`, background:'#00d4ff', borderRadius:4, display:'flex', alignItems:'center', paddingLeft:8 }}>
                          <span style={{ fontSize:10, fontWeight:700, color:'#000' }}>{qtd}</span>
                        </div>
                      </div>
                    </div>
                  ))
                }
              </div>
              <div className="card">
                <div className="card-title">📋 Status das Atividades</div>
                {[
                  { l:'Atrasadas',  v:ativsAtrasadas, cor:'#ef4444' },
                  { l:'Para hoje',  v:ativsHoje,      cor:'#f59e0b' },
                  { l:'Futuras',    v:atividades.filter(a=>!a.concluida&&a.prazo&&new Date(a.prazo)>new Date()&&a.prazo.slice(0,10)!==hojeStr).length, cor:'#64748b' },
                  { l:'Concluídas', v:atividades.filter(a=>a.concluida).length, cor:'#10b981' },
                ].map(r=>(
                  <div key={r.l} style={{ display:'flex', justifyContent:'space-between', padding:'10px 0', borderBottom:'1px solid #1e2d4a', fontSize:13 }}>
                    <span style={{ color:'#94a3b8' }}>{r.l}</span>
                    <span style={{ fontWeight:800, color:r.cor, fontFamily:'Syne,sans-serif', fontSize:16 }}>{r.v}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Tabela de atividades */}
            <div className="card">
              <div className="card-title">📋 Lista de Atividades</div>
              {atividades.length===0
                ? <div style={{ color:'#64748b', fontSize:12, textAlign:'center', padding:20 }}>Nenhuma atividade cadastrada no CRM</div>
                : <div style={{ overflowX:'auto' }}>
                  <table style={{ width:'100%', borderCollapse:'collapse', fontFamily:'DM Mono,monospace', fontSize:12 }}>
                    <thead>
                      <tr style={{ borderBottom:'1px solid #1e2d4a' }}>
                        {['Tipo','Descrição','Prazo','Status'].map(h=>(
                          <th key={h} style={{ padding:'8px 12px', textAlign:'left', color:'#64748b', fontSize:10, textTransform:'uppercase', letterSpacing:1 }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {atividades.slice(0,50).map((a,i)=>{
                        const atrasada = !a.concluida&&a.prazo&&new Date(a.prazo)<new Date()
                        return (
                          <tr key={i} style={{ borderBottom:'1px solid #0f1929' }}
                            onMouseEnter={e=>e.currentTarget.style.background='rgba(255,255,255,.02)'}
                            onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                            <td style={{ padding:'9px 12px', color:'#94a3b8', textTransform:'capitalize' }}>{a.tipo||'—'}</td>
                            <td style={{ padding:'9px 12px', color:'#e2e8f0' }}>{a.descricao||a.titulo||'—'}</td>
                            <td style={{ padding:'9px 12px', color:atrasada?'#ef4444':'#94a3b8' }}>{fmtDate(a.prazo)}</td>
                            <td style={{ padding:'9px 12px' }}>
                              <span style={{ fontSize:10, padding:'3px 8px', borderRadius:5, background:a.concluida?'rgba(16,185,129,.12)':atrasada?'rgba(239,68,68,.12)':'rgba(245,158,11,.12)', color:a.concluida?'#10b981':atrasada?'#ef4444':'#f59e0b', fontWeight:600 }}>
                                {a.concluida?'Concluída':atrasada?'Atrasada':'Pendente'}
                              </span>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                  {atividades.length>50 && <div style={{ padding:'10px', textAlign:'center', color:'#64748b', fontSize:11 }}>Mostrando 50 de {atividades.length}. Use o Gerador para exportar todos.</div>}
                </div>
              }
            </div>
          </div>
        )}

        {/* ══ NEGÓCIOS CRM ══ */}
        {aba==='crm_negocios' && (
          <div>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:14, marginBottom:22 }}>
              <KpiCard label="Total Leads"      valor={negocios.length}                                      sub="No CRM"           cor="#00d4ff" icon="🎯" />
              <KpiCard label="Em Negociação"    valor={negocios.filter(n=>n.etapa!=='fechamento'&&n.etapa!=='perdido').length} sub="Pipeline" cor="#7c3aed" icon="🔄" />
              <KpiCard label="Fechados"         valor={negocios.filter(n=>n.etapa==='fechamento').length}     sub="Convertidos"      cor="#10b981" icon="🏆" />
              <KpiCard label="Perdidos"         valor={negocios.filter(n=>n.etapa==='perdido').length}        sub="Total geral"      cor="#ef4444" icon="❌" />
            </div>

            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:18, marginBottom:18 }}>
              <div className="card">
                <div className="card-title">🔢 Funil de Vendas por Etapa</div>
                {negPorEtapa.filter(e=>e.qtd>0).map(e=>(
                  <div key={e.etapa} style={{ display:'flex', alignItems:'center', gap:12, marginBottom:10 }}>
                    <div style={{ width:140, fontSize:11, color:'#94a3b8', textTransform:'capitalize', flexShrink:0 }}>{e.etapa.replace(/_/g,' ')}</div>
                    <div style={{ flex:1, height:22, background:'#1a2540', borderRadius:4, overflow:'hidden' }}>
                      <div style={{ height:'100%', width:`${Math.max(5,(e.qtd/Math.max(1,negocios.length))*100)}%`, background:'#00d4ff', borderRadius:4, display:'flex', alignItems:'center', paddingLeft:8 }}>
                        <span style={{ fontSize:10, fontWeight:700, color:'#000' }}>{e.qtd}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <div className="card">
                <div className="card-title">⏱ Tempo Médio por Etapa</div>
                {Object.entries(tempoPorEtapa).length===0
                  ? <div style={{ color:'#64748b', fontSize:12, textAlign:'center', padding:20 }}>Sem dados suficientes</div>
                  : Object.entries(tempoPorEtapa).map(([etapa,v])=>(
                    <div key={etapa} style={{ display:'flex', justifyContent:'space-between', padding:'8px 0', borderBottom:'1px solid #1e2d4a', fontSize:12 }}>
                      <span style={{ color:'#94a3b8', textTransform:'capitalize' }}>{etapa.replace(/_/g,' ')}</span>
                      <span style={{ color:'#00d4ff', fontWeight:700 }}>{Math.round(v.total/v.qtd)} dias</span>
                    </div>
                  ))
                }
              </div>
            </div>

            {/* Negócios parados há mais de 15 dias */}
            {isGestor && (() => {
              const parados = negocios.filter(n=>{
                if (n.etapa==='fechamento'||n.etapa==='perdido') return false
                const dias = n.updatedAt ? Math.round((new Date()-new Date(n.updatedAt))/(1000*60*60*24)) : 0
                return dias >= 15
              })
              return parados.length>0 ? (
                <div style={{ padding:'14px 18px', background:'rgba(239,68,68,.06)', border:'1px solid rgba(239,68,68,.2)', borderRadius:10, marginBottom:18 }}>
                  <div style={{ fontFamily:'Syne,sans-serif', fontSize:14, fontWeight:700, color:'#ef4444', marginBottom:10 }}>⚠️ {parados.length} Negócio(s) Parado(s) há mais de 15 dias</div>
                  {parados.slice(0,5).map((n,i)=>(
                    <div key={i} style={{ fontSize:12, color:'#94a3b8', marginBottom:4 }}>• {n.empresa||n.nome||'—'} — {Math.round((new Date()-new Date(n.updatedAt))/(1000*60*60*24))} dias sem movimentação</div>
                  ))}
                </div>
              ) : null
            })()}

            {/* Tabela de negócios */}
            <div className="card">
              <div className="card-title">📋 Negócios Detalhados</div>
              {negocios.length===0
                ? <div style={{ color:'#64748b', fontSize:12, textAlign:'center', padding:20 }}>Nenhum negócio no CRM</div>
                : <div style={{ overflowX:'auto' }}>
                  <table style={{ width:'100%', borderCollapse:'collapse', fontFamily:'DM Mono,monospace', fontSize:12 }}>
                    <thead>
                      <tr style={{ borderBottom:'1px solid #1e2d4a' }}>
                        {['Empresa','Etapa','Valor','Responsável','Criado em'].map(h=>(
                          <th key={h} style={{ padding:'8px 12px', textAlign:'left', color:'#64748b', fontSize:10, textTransform:'uppercase', letterSpacing:1 }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {negocios.slice(0,50).map((n,i)=>(
                        <tr key={i} style={{ borderBottom:'1px solid #0f1929' }}
                          onMouseEnter={e=>e.currentTarget.style.background='rgba(255,255,255,.02)'}
                          onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                          <td style={{ padding:'9px 12px', color:'#e2e8f0', fontWeight:600 }}>{n.empresa||n.nome||'—'}</td>
                          <td style={{ padding:'9px 12px' }}>
                            <span style={{ fontSize:10, padding:'3px 8px', borderRadius:5, background:n.etapa==='fechamento'?'rgba(16,185,129,.12)':n.etapa==='perdido'?'rgba(239,68,68,.12)':'rgba(0,212,255,.08)', color:n.etapa==='fechamento'?'#10b981':n.etapa==='perdido'?'#ef4444':'#00d4ff', textTransform:'capitalize' }}>
                              {(n.etapa||'').replace(/_/g,' ')}
                            </span>
                          </td>
                          <td style={{ padding:'9px 12px', color:'#10b981', fontWeight:700 }}>{fmt(n.valor||n.valorMensalidade||0)}</td>
                          <td style={{ padding:'9px 12px', color:'#94a3b8' }}>{n.responsavel||n.userName||'—'}</td>
                          <td style={{ padding:'9px 12px', color:'#64748b' }}>{fmtDate(n.criadoEm)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              }
            </div>
          </div>
        )}

        {/* ══ DISPAROS EM MASSA ══ */}
        {aba==='disparos' && (
          <div>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:14, marginBottom:22 }}>
              <KpiCard label="Campanhas"  valor={disparos.length}                                                        sub="Total"        cor="#00d4ff" icon="📣" />
              <KpiCard label="Enviados"   valor={fmtN(disparos.reduce((a,c)=>a+(c.enviados||c.total||0),0))}             sub="Total geral"  cor="#10b981" icon="✅" />
              <KpiCard label="Com Erros"  valor={fmtN(disparos.reduce((a,c)=>a+(c.erros||c.falhas||0),0))}              sub="Falhas"       cor="#ef4444" icon="❌" />
            </div>

            {disparos.length===0
              ? <div className="card" style={{ textAlign:'center', padding:40 }}>
                <div style={{ fontSize:40, marginBottom:12 }}>📣</div>
                <div style={{ color:'#64748b', marginBottom:10 }}>Nenhuma campanha de disparo encontrada</div>
                <div style={{ color:'#475569', fontSize:11 }}>As campanhas aparecem aqui quando executadas via Comercial → Disparo em Massa</div>
              </div>
              : <div className="card">
                <div className="card-title">📋 Campanhas de Disparo</div>
                <div style={{ overflowX:'auto' }}>
                  <table style={{ width:'100%', borderCollapse:'collapse', fontFamily:'DM Mono,monospace', fontSize:12 }}>
                    <thead>
                      <tr style={{ borderBottom:'1px solid #1e2d4a' }}>
                        {['Campanha','Enviados','Erros','Taxa Entrega','Data'].map(h=>(
                          <th key={h} style={{ padding:'8px 12px', textAlign:'left', color:'#64748b', fontSize:10, textTransform:'uppercase', letterSpacing:1 }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {disparos.map((c,i)=>{
                        const env=c.enviados||c.total||0, err=c.erros||c.falhas||0
                        const taxa=env>0?Math.round(((env-err)/env)*100):0
                        return (
                          <tr key={i} style={{ borderBottom:'1px solid #0f1929' }}
                            onMouseEnter={e=>e.currentTarget.style.background='rgba(255,255,255,.02)'}
                            onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                            <td style={{ padding:'9px 12px', color:'#e2e8f0' }}>{c.nome||c.id}</td>
                            <td style={{ padding:'9px 12px', color:'#10b981', fontWeight:700 }}>{fmtN(env)}</td>
                            <td style={{ padding:'9px 12px', color:err>0?'#ef4444':'#64748b' }}>{fmtN(err)}</td>
                            <td style={{ padding:'9px 12px' }}>
                              <span style={{ fontSize:11, padding:'3px 8px', borderRadius:5, background:taxa>=90?'rgba(16,185,129,.12)':taxa>=70?'rgba(245,158,11,.12)':'rgba(239,68,68,.12)', color:taxa>=90?'#10b981':taxa>=70?'#f59e0b':'#ef4444', fontWeight:600 }}>
                                {taxa}%
                              </span>
                            </td>
                            <td style={{ padding:'9px 12px', color:'#64748b' }}>{fmtDate(c.criadoEm||c.data)}</td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            }
          </div>
        )}

        {/* ══ MARKETING ══ */}
        {aba==='marketing' && (
          <div>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:14, marginBottom:22 }}>
              <KpiCard label="Campanhas"    valor={campanhas.length}                                               sub="Total"         cor="#7c3aed" icon="📢" />
              <KpiCard label="Alcance"      valor={fmtN(campanhas.reduce((a,c)=>a+(c.alcance||0),0))}             sub="Total"         cor="#00d4ff" icon="👁" />
              <KpiCard label="Cliques"      valor={fmtN(campanhas.reduce((a,c)=>a+(c.cliques||0),0))}             sub="Total"         cor="#10b981" icon="🖱" />
              <KpiCard label="Leads Gerados" valor={fmtN(campanhas.reduce((a,c)=>a+(c.leads||0),0))}              sub="Via marketing"  cor="#f59e0b" icon="🎯" />
            </div>

            {campanhas.length===0
              ? <div className="card" style={{ textAlign:'center', padding:40 }}>
                <div style={{ fontSize:40, marginBottom:12 }}>📢</div>
                <div style={{ color:'#64748b', marginBottom:10 }}>Nenhuma campanha de marketing registrada</div>
                <div style={{ color:'#475569', fontSize:11, lineHeight:1.6 }}>
                  Acesse <strong style={{ color:'#7c3aed' }}>Marketing → Campanhas IA</strong> para criar campanhas.<br/>
                  Os dados aparecerão aqui automaticamente em <code style={{ color:'#a78bfa' }}>cfg.marketing_campanhas[]</code>.
                </div>
              </div>
              : <>
                <div className="card" style={{ marginBottom:18 }}>
                  <div className="card-title">📊 Por Tipo de Campanha</div>
                  {(() => {
                    const porTipo = {}
                    campanhas.forEach(c=>{ const t=c.tipo||'outros'; if(!porTipo[t])porTipo[t]={qtd:0,alcance:0,cliques:0,leads:0}; porTipo[t].qtd++; porTipo[t].alcance+=c.alcance||0; porTipo[t].cliques+=c.cliques||0; porTipo[t].leads+=c.leads||0 })
                    return Object.entries(porTipo).map(([tipo,v])=>(
                      <div key={tipo} style={{ display:'grid', gridTemplateColumns:'120px 80px 1fr 1fr 1fr', alignItems:'center', gap:10, padding:'10px 0', borderBottom:'1px solid #1e2d4a' }}>
                        <div style={{ fontSize:12, color:'#e2e8f0', textTransform:'capitalize' }}>{tipo}</div>
                        <div style={{ fontSize:11, color:'#64748b' }}>{v.qtd} camp.</div>
                        <div><div style={{ fontSize:10, color:'#64748b' }}>Alcance</div><div style={{ fontSize:13, color:'#00d4ff', fontWeight:700 }}>{fmtN(v.alcance)}</div></div>
                        <div><div style={{ fontSize:10, color:'#64748b' }}>Cliques</div><div style={{ fontSize:13, color:'#10b981', fontWeight:700 }}>{fmtN(v.cliques)}</div></div>
                        <div><div style={{ fontSize:10, color:'#64748b' }}>Leads</div><div style={{ fontSize:13, color:'#f59e0b', fontWeight:700 }}>{fmtN(v.leads)}</div></div>
                      </div>
                    ))
                  })()}
                </div>
                <div className="card">
                  <div className="card-title">📋 Campanhas Detalhadas</div>
                  <div style={{ overflowX:'auto' }}>
                    <table style={{ width:'100%', borderCollapse:'collapse', fontFamily:'DM Mono,monospace', fontSize:12 }}>
                      <thead>
                        <tr style={{ borderBottom:'1px solid #1e2d4a' }}>
                          {['Campanha','Tipo','Alcance','Cliques','Leads','Data'].map(h=>(
                            <th key={h} style={{ padding:'8px 12px', textAlign:'left', color:'#64748b', fontSize:10, textTransform:'uppercase', letterSpacing:1 }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {campanhas.map((c,i)=>(
                          <tr key={i} style={{ borderBottom:'1px solid #0f1929' }}
                            onMouseEnter={e=>e.currentTarget.style.background='rgba(255,255,255,.02)'}
                            onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                            <td style={{ padding:'9px 12px', color:'#e2e8f0' }}>{c.nome||c.titulo||'—'}</td>
                            <td style={{ padding:'9px 12px', color:'#a78bfa', textTransform:'capitalize' }}>{c.tipo||'—'}</td>
                            <td style={{ padding:'9px 12px', color:'#00d4ff', fontWeight:700 }}>{fmtN(c.alcance||0)}</td>
                            <td style={{ padding:'9px 12px', color:'#10b981', fontWeight:700 }}>{fmtN(c.cliques||0)}</td>
                            <td style={{ padding:'9px 12px', color:'#f59e0b', fontWeight:700 }}>{fmtN(c.leads||0)}</td>
                            <td style={{ padding:'9px 12px', color:'#64748b' }}>{fmtDate(c.data||c.criadoEm)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            }
          </div>
        )}

        {/* ══ GERADOR PERSONALIZADO ══ */}
        {aba==='gerador' && (
          <GeradorRelatorio cfg={cfg} perfil={perfil} />
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
  .card{background:var(--surface);border:1px solid var(--border);border-radius:14px;padding:20px;margin-bottom:0}
  .card-title{font-family:'Syne',sans-serif;font-size:14px;font-weight:700;color:var(--text);margin-bottom:16px;display:flex;align-items:center;gap:8px}
  .field-label{font-size:11px;color:var(--muted);display:block;margin-bottom:4px;letter-spacing:.5px}
  .btn-primary{display:inline-flex;align-items:center;gap:6px;padding:9px 18px;background:linear-gradient(135deg,var(--accent),#0099bb);border:none;border-radius:9px;color:#fff;font-family:'DM Mono',monospace;font-size:12px;font-weight:600;cursor:pointer;transition:all .18s;white-space:nowrap}
  .btn-primary:hover{box-shadow:0 0 16px rgba(0,212,255,.35);transform:translateY(-1px)}
  @media(max-width:900px){.rp-hdr{flex-direction:column}}
  @media(max-width:700px){.rp-wrap{padding:16px 12px 40px}}
`
