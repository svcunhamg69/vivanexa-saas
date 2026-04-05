// pages/crm.js — CRM Vivanexa v2
// Funil Kanban + Timeline de Atividades + Visão do Dia + Prazos
import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/router'
import { supabase } from '../lib/supabase'
import Navbar from '../components/Navbar'

const ETAPAS_PADRAO = [
  { id: 'lead',             label: 'Lead',                  cor: '#64748b' },
  { id: 'lead_qualificado', label: 'Lead Qualificado',      cor: '#7c3aed' },
  { id: 'lead_marketing',   label: 'Lead Marketing',        cor: '#0099bb' },
  { id: 'reuniao_agendada', label: 'Reunião Agendada',      cor: '#00d4ff' },
  { id: 'queda_agenda',     label: 'Queda de Agenda',       cor: '#f59e0b' },
  { id: 'atendimento',      label: 'Atendimento Realizado', cor: '#10b981' },
  { id: 'proposta_enviada', label: 'Proposta Enviada',      cor: '#8b5cf6' },
  { id: 'fechamento',       label: 'Fechamento',            cor: '#059669' },
  { id: 'perdido',          label: 'Perdido',               cor: '#ef4444' },
]

const TIPO_ATIVIDADE = ['Ligação','Reunião','E-mail','WhatsApp','Proposta','Follow-up','Visita','Outro']
const EMPTY_NEG  = { id:'',titulo:'',etapa:'lead',nome:'',fantasia:'',cnpj:'',cpf:'',email:'',telefone:'',endereco:'',cidade:'',uf:'',responsavel:'',adesao:'',mensalidade:'',modulos:'',observacoes:'',origem:'manual',criadoEm:'',atualizadoEm:'' }
const EMPTY_ATIV = { id:'',negocioId:'',tipo:'Ligação',descricao:'',prazo:'',concluida:false,criadoEm:'' }

const fmt    = n => (!n&&n!==0)?'—':'R$ '+Number(n).toLocaleString('pt-BR',{minimumFractionDigits:2})
const fmtDoc = s => { if(!s)return''; const d=s.replace(/\D/g,''); if(d.length===14)return d.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/,'$1.$2.$3/$4-$5'); if(d.length===11)return d.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/,'$1.$2.$3-$4'); return s }
const fmtDT  = s => { if(!s)return'—'; try{ return new Date(s).toLocaleString('pt-BR',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'}) }catch{return s} }
const hoje   = () => new Date().toISOString().slice(0,10)
const isAtrasada = a => !a.concluida&&!!a.prazo&&new Date(a.prazo)<new Date()
const isHoje     = a => !a.concluida&&!!a.prazo&&a.prazo.slice(0,10)===hoje()
const isFutura   = a => !a.concluida&&!!a.prazo&&new Date(a.prazo)>new Date()&&a.prazo.slice(0,10)!==hoje()

async function fetchCNPJDados(cnpj) {
  try {
    const r = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cnpj.replace(/\D/g,'')}`)
    if(!r.ok) return null
    const d = await r.json()
    const f = (d.ddd_telefone_1||'').replace(/\D/g,'')
    return { nome:d.razao_social||'', fantasia:d.nome_fantasia||d.razao_social||'', email:d.email||'', telefone:f.length>=10?`(${f.slice(0,2)}) ${f.slice(2)}`:'', cidade:d.municipio||'', uf:d.uf||'', endereco:[d.descricao_tipo_logradouro,d.logradouro,d.numero,d.bairro].filter(Boolean).join(' ') }
  } catch { return null }
}

export default function CRM() {
  const router = useRouter()
  const [loading,      setLoading]      = useState(true)
  const [cfg,          setCfg]          = useState({})
  const [empresaId,    setEmpresaId]    = useState(null)
  const [perfil,       setPerfil]       = useState(null)
  const [negocios,     setNegocios]     = useState([])
  const [atividades,   setAtividades]   = useState([])
  const [etapas,       setEtapas]       = useState(ETAPAS_PADRAO)
  const [visao,        setVisao]        = useState('funil') // funil | atividades
  const [negSel,       setNegSel]       = useState(null)
  const [showFormNeg,  setShowFormNeg]  = useState(false)
  const [formNeg,      setFormNeg]      = useState({...EMPTY_NEG})
  const [showFormAtiv, setShowFormAtiv] = useState(false)
  const [formAtiv,     setFormAtiv]     = useState({...EMPTY_ATIV})
  const [busca,        setBusca]        = useState('')
  const [filtroEtapa,  setFiltroEtapa]  = useState('todas')
  const [filtroAtiv,   setFiltroAtiv]   = useState('todas')
  const [buscandoCNPJ, setBuscandoCNPJ] = useState(false)
  const [saving,       setSaving]       = useState(false)
  const [toast,        setToast]        = useState('')
  const [dragging,     setDragging]     = useState(null)
  const [dragOver,     setDragOver]     = useState(null)
  const dragNode = useRef(null)

  useEffect(() => {
    async function init() {
      const { data:{ session } } = await supabase.auth.getSession()
      if(!session){ router.replace('/'); return }
      let { data: perf } = await supabase.from('perfis').select('*').eq('user_id',session.user.id).maybeSingle()
      if(!perf){ const nm=session.user.email?.split('@')[0]||'Usuário'; const{data:np}=await supabase.from('perfis').insert({user_id:session.user.id,nome:nm,email:session.user.email,empresa_id:session.user.id,perfil:'admin'}).select().single(); perf=np }
      setPerfil(perf)
      const eid = perf?.empresa_id||session.user.id; setEmpresaId(eid)
      const{data:row}=await supabase.from('vx_storage').select('value').eq('key',`cfg:${eid}`).single()
      if(row?.value){ const c=JSON.parse(row.value); setCfg(c); setNegocios(c.crm_negocios||[]); setAtividades(c.crm_atividades||[]); if(c.crm_etapas?.length)setEtapas(c.crm_etapas) }
      setLoading(false)
    }
    init()
  },[router])

  const save = async nc => { await supabase.from('vx_storage').upsert({key:`cfg:${empresaId}`,value:JSON.stringify(nc),updated_at:new Date().toISOString()},{onConflict:'key'}) }
  const showToast = msg => { setToast(msg); setTimeout(()=>setToast(''),3000) }

  async function salvarNeg() {
    if(!formNeg.titulo.trim()){ alert('Informe o título.'); return }
    setSaving(true)
    const now=new Date().toISOString(); const novo={...formNeg,id:formNeg.id||'neg_'+Date.now(),criadoEm:formNeg.criadoEm||now,atualizadoEm:now}
    const lista=formNeg.id?negocios.map(n=>n.id===formNeg.id?novo:n):[...negocios,novo]
    const nc={...cfg,crm_negocios:lista}; await save(nc); setNegocios(lista); setCfg(nc)
    if(negSel?.id===novo.id)setNegSel(novo)
    setShowFormNeg(false); setFormNeg({...EMPTY_NEG}); setSaving(false); showToast('✅ Negócio salvo!')
  }

  async function excluirNeg(id) {
    if(!confirm('Excluir negócio e atividades?'))return
    const lista=negocios.filter(n=>n.id!==id); const listAv=atividades.filter(a=>a.negocioId!==id)
    const nc={...cfg,crm_negocios:lista,crm_atividades:listAv}; await save(nc); setNegocios(lista); setAtividades(listAv); setCfg(nc)
    if(negSel?.id===id){setNegSel(null);setVisao('funil')}; showToast('🗑 Removido!')
  }

  async function moverEtapa(negId,novaEtapa) {
    const lista=negocios.map(n=>n.id===negId?{...n,etapa:novaEtapa,atualizadoEm:new Date().toISOString()}:n)
    const nc={...cfg,crm_negocios:lista}; await save(nc); setNegocios(lista); setCfg(nc)
    if(negSel?.id===negId)setNegSel(s=>({...s,etapa:novaEtapa}))
  }

  async function salvarAtiv() {
    if(!formAtiv.descricao.trim()){ alert('Informe a descrição.'); return }
    setSaving(true)
    const now=new Date().toISOString(); const nova={...formAtiv,id:formAtiv.id||'atv_'+Date.now(),criadoEm:formAtiv.criadoEm||now}
    const lista=formAtiv.id?atividades.map(a=>a.id===formAtiv.id?nova:a):[...atividades,nova]
    const nc={...cfg,crm_atividades:lista}; await save(nc); setAtividades(lista); setCfg(nc)
    setShowFormAtiv(false); setFormAtiv({...EMPTY_ATIV}); setSaving(false); showToast('✅ Atividade salva!')
  }

  async function toggleConcluida(ativ) {
    const at={...ativ,concluida:!ativ.concluida}
    const lista=atividades.map(a=>a.id===ativ.id?at:a); const nc={...cfg,crm_atividades:lista}
    await save(nc); setAtividades(lista); setCfg(nc)
  }

  async function excluirAtiv(id) {
    if(!confirm('Excluir atividade?'))return
    const lista=atividades.filter(a=>a.id!==id); const nc={...cfg,crm_atividades:lista}
    await save(nc); setAtividades(lista); setCfg(nc); showToast('🗑 Removida!')
  }

  function onDragStart(e,neg){ setDragging(neg.id); dragNode.current=e.target; setTimeout(()=>{ if(dragNode.current)dragNode.current.style.opacity='0.4' },0) }
  function onDragEnd(){ if(dragNode.current)dragNode.current.style.opacity='1'; setDragging(null); setDragOver(null) }
  function onDragOver(e,id){ e.preventDefault(); setDragOver(id) }
  function onDrop(e,id){ e.preventDefault(); if(dragging)moverEtapa(dragging,id); setDragging(null); setDragOver(null) }

  async function buscarCNPJ() {
    const cnpj=formNeg.cnpj.replace(/\D/g,''); if(cnpj.length!==14){alert('CNPJ inválido.');return}
    setBuscandoCNPJ(true); const d=await fetchCNPJDados(cnpj)
    if(d)setFormNeg(f=>({...f,...d})); else alert('CNPJ não encontrado.')
    setBuscandoCNPJ(false); showToast(d?'✅ CNPJ carregado!':'❌ Não encontrado')
  }

  const negFiltrados = negocios.filter(n=>{
    const ob=!busca.trim()||n.titulo?.toLowerCase().includes(busca.toLowerCase())||n.nome?.toLowerCase().includes(busca.toLowerCase())||n.cnpj?.includes(busca)||n.email?.includes(busca)
    const oe=filtroEtapa==='todas'||n.etapa===filtroEtapa
    return ob&&oe
  })

  const ativFiltradas = atividades.filter(a=>{
    if(filtroAtiv==='hoje')      return isHoje(a)
    if(filtroAtiv==='atrasada')  return isAtrasada(a)
    if(filtroAtiv==='futura')    return isFutura(a)
    if(filtroAtiv==='concluida') return a.concluida
    return true
  })

  const atrasadas  = atividades.filter(isAtrasada).length
  const parHoje    = atividades.filter(isHoje).length
  const parFutura  = atividades.filter(isFutura).length
  const negDeAtiv  = a => negocios.find(n=>n.id===a.negocioId)
  const ativsDeNeg = id => atividades.filter(a=>a.negocioId===id).sort((a,b)=>new Date(b.criadoEm)-new Date(a.criadoEm))
  const logoSrc    = cfg.logob64?(cfg.logob64.startsWith('data:')?cfg.logob64:`data:image/png;base64,${cfg.logob64}`):null

  if(loading) return <div style={{minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center',background:'#0a0f1e',color:'#64748b',fontFamily:'DM Mono,monospace'}}>Carregando CRM...</div>

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@600;700;800&family=DM+Mono:wght@300;400;500&display=swap');
        :root{--bg:#0a0f1e;--surface:#111827;--surface2:#1a2540;--border:#1e2d4a;--accent:#00d4ff;--accent2:#7c3aed;--accent3:#10b981;--text:#e2e8f0;--muted:#64748b;--danger:#ef4444;--warning:#f59e0b;--gold:#fbbf24}
        *{box-sizing:border-box;margin:0;padding:0}
        body{font-family:'DM Mono',monospace;background:var(--bg);color:var(--text);min-height:100vh}
        ::-webkit-scrollbar{width:4px;height:4px}::-webkit-scrollbar-thumb{background:var(--border);border-radius:4px}
        .kb-wrap{display:flex;gap:12px;overflow-x:auto;padding-bottom:20px;align-items:flex-start}
        .kb-col{min-width:220px;width:220px;flex-shrink:0}
        .neg-card{background:var(--surface);border:1px solid var(--border);border-radius:10px;padding:12px 14px;margin-bottom:8px;cursor:grab;transition:box-shadow .2s,border-color .2s}
        .neg-card:hover{box-shadow:0 4px 16px rgba(0,0,0,.35);border-color:rgba(0,212,255,.25)}
        .neg-card:active{cursor:grabbing}
        .drop-ok{background:rgba(0,212,255,.04);border:1px dashed rgba(0,212,255,.35)!important;border-radius:8px}
        .tl-item{display:flex;gap:12px;margin-bottom:16px;position:relative}
        .tl-dot{width:10px;height:10px;border-radius:50%;flex-shrink:0;margin-top:4px}
        .tl-line{position:absolute;left:4px;top:14px;bottom:-16px;width:2px;background:var(--border)}
        input:focus,textarea:focus,select:focus{border-color:var(--accent)!important;outline:none}
      `}</style>

      {toast&&<div style={{position:'fixed',bottom:28,left:'50%',transform:'translateX(-50%)',background:'rgba(16,185,129,.92)',color:'#fff',padding:'11px 22px',borderRadius:10,fontFamily:'DM Mono',fontSize:14,zIndex:9999}}>{toast}</div>}

      <Navbar cfg={cfg} perfil={perfil} />
      </header>

      <main style={{padding:'20px 20px 60px'}}>

        {/* ── Barra de visão ── */}
        <div style={{display:'flex',gap:8,marginBottom:20,flexWrap:'wrap',alignItems:'center'}}>
          {[['funil','🗂️ Funil de Vendas'],['atividades','📅 Atividades']].map(([v,l])=>(
            <button key={v} onClick={()=>{setVisao(v);setNegSel(null)}}
              style={{padding:'9px 16px',borderRadius:9,border:`1.5px solid ${visao===v&&!negSel?'var(--accent)':'var(--border)'}`,background:visao===v&&!negSel?'rgba(0,212,255,.12)':'var(--surface2)',color:visao===v&&!negSel?'var(--accent)':'var(--muted)',fontFamily:'DM Mono,monospace',fontSize:13,cursor:'pointer',fontWeight:visao===v&&!negSel?700:400}}>
              {l}
            </button>
          ))}
          {negSel&&<span style={{fontSize:13,color:'var(--accent)',padding:'9px 16px',background:'rgba(0,212,255,.08)',border:'1px solid rgba(0,212,255,.25)',borderRadius:9}}>📋 {negSel.titulo}</span>}
          <div style={{marginLeft:'auto',display:'flex',gap:8}}>
            <input value={busca} onChange={e=>setBusca(e.target.value)} placeholder="🔍 Buscar..." style={{background:'var(--surface2)',border:'1px solid var(--border)',borderRadius:8,padding:'8px 12px',fontFamily:'DM Mono,monospace',fontSize:12,color:'var(--text)',outline:'none',width:180}}/>
            <button onClick={()=>{setFormNeg({...EMPTY_NEG});setShowFormNeg(true)}}
              style={{padding:'9px 18px',borderRadius:9,background:'linear-gradient(135deg,var(--accent),#0099bb)',border:'none',color:'#fff',fontFamily:'DM Mono,monospace',fontSize:13,fontWeight:600,cursor:'pointer',whiteSpace:'nowrap'}}>
              + Novo Negócio
            </button>
          </div>
        </div>

        {/* ── KPIs globais ── */}
        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(130px,1fr))',gap:10,marginBottom:20}}>
          {[
            {l:'Total Negócios',  v:negocios.length,                                                               c:'var(--accent)'},
            {l:'Propostas',       v:negocios.filter(n=>n.etapa==='proposta_enviada').length,                        c:'var(--accent2)'},
            {l:'Fechamentos',     v:negocios.filter(n=>n.etapa==='fechamento').length,                              c:'var(--accent3)'},
            {l:'⚠️ Atrasadas',   v:atrasadas,                                                                      c:'var(--danger)'},
            {l:'📅 Hoje',         v:parHoje,                                                                       c:'var(--warning)'},
            {l:'🔜 Futuras',      v:parFutura,                                                                     c:'var(--accent)'},
            {l:'Adesão Total',    v:fmt(negocios.filter(n=>n.etapa==='fechamento').reduce((a,n)=>a+(Number(n.adesao)||0),0)), c:'var(--gold)'},
          ].map(k=>(
            <div key={k.l} style={{background:'var(--surface)',border:'1px solid var(--border)',borderRadius:10,padding:'12px 14px'}}>
              <div style={{fontSize:9,color:'var(--muted)',textTransform:'uppercase',letterSpacing:1,marginBottom:4}}>{k.l}</div>
              <div style={{fontFamily:'Syne,sans-serif',fontSize:18,fontWeight:800,color:k.c}}>{k.v}</div>
            </div>
          ))}
        </div>

        {/* ══════════ DETALHE DO NEGÓCIO ══════════ */}
        {negSel&&(
          <div>
            <button onClick={()=>{setNegSel(null);setVisao('funil')}} style={{...S.nb,marginBottom:16}}>← Voltar ao Funil</button>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16}}>
              {/* Dados */}
              <div style={{background:'var(--surface)',border:'1px solid var(--border)',borderRadius:14,padding:'20px 22px'}}>
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:14}}>
                  <div style={{fontFamily:'Syne,sans-serif',fontSize:15,fontWeight:700,color:'var(--accent)'}}>🏢 Dados do Cliente</div>
                  <button onClick={()=>{setFormNeg({...negSel});setShowFormNeg(true)}} style={S.nb}>✏️ Editar</button>
                </div>
                {[['Título',negSel.titulo],['Razão Social',negSel.nome],['Fantasia',negSel.fantasia],['CNPJ',fmtDoc(negSel.cnpj)],['CPF',negSel.cpf],['E-mail',negSel.email],['Telefone',negSel.telefone],['Cidade/UF',[negSel.cidade,negSel.uf].filter(Boolean).join(' – ')],['Endereço',negSel.endereco],['Módulos',negSel.modulos],['Adesão',negSel.adesao?fmt(negSel.adesao):null],['Mensalidade',negSel.mensalidade?fmt(negSel.mensalidade):null]].filter(([,v])=>v).map(([l,v])=>(
                  <div key={l} style={{display:'flex',gap:8,padding:'5px 0',borderBottom:'1px solid var(--border)',fontSize:13}}>
                    <span style={{color:'var(--muted)',minWidth:100,flexShrink:0}}>{l}</span>
                    <span style={{color:'var(--text)',fontWeight:500}}>{v}</span>
                  </div>
                ))}
                <div style={{marginTop:14}}>
                  <div style={{fontSize:11,color:'var(--muted)',marginBottom:8,letterSpacing:1,textTransform:'uppercase'}}>Etapa do Funil</div>
                  <div style={{display:'flex',flexWrap:'wrap',gap:6}}>
                    {etapas.map(e=>(
                      <button key={e.id} onClick={()=>moverEtapa(negSel.id,e.id)}
                        style={{padding:'5px 10px',borderRadius:7,border:`1.5px solid ${negSel.etapa===e.id?e.cor:'var(--border)'}`,background:negSel.etapa===e.id?`${e.cor}22`:'var(--surface2)',color:negSel.etapa===e.id?e.cor:'var(--muted)',fontSize:11,cursor:'pointer',fontFamily:'DM Mono,monospace',fontWeight:negSel.etapa===e.id?700:400}}>
                        {e.label}
                      </button>
                    ))}
                  </div>
                </div>
                {negSel.observacoes&&<div style={{marginTop:12,padding:'10px 12px',background:'var(--surface2)',border:'1px solid var(--border)',borderRadius:8,fontSize:12,color:'var(--muted)',lineHeight:1.6}}>{negSel.observacoes}</div>}
              </div>

              {/* Timeline */}
              <div style={{background:'var(--surface)',border:'1px solid var(--border)',borderRadius:14,padding:'20px 22px'}}>
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:14}}>
                  <div style={{fontFamily:'Syne,sans-serif',fontSize:15,fontWeight:700,color:'var(--accent)'}}>📋 Timeline de Atividades</div>
                  <button onClick={()=>{setFormAtiv({...EMPTY_ATIV,negocioId:negSel.id});setShowFormAtiv(true)}}
                    style={{padding:'7px 14px',borderRadius:8,background:'rgba(0,212,255,.12)',border:'1px solid rgba(0,212,255,.25)',color:'var(--accent)',fontFamily:'DM Mono,monospace',fontSize:12,cursor:'pointer',fontWeight:600}}>
                    + Atividade
                  </button>
                </div>
                {ativsDeNeg(negSel.id).length===0
                  ?<div style={{textAlign:'center',padding:'30px 0',color:'var(--muted)',fontSize:13}}>Nenhuma atividade registrada.</div>
                  :<div style={{maxHeight:440,overflowY:'auto',paddingRight:4}}>
                    {ativsDeNeg(negSel.id).map((a,i,arr)=>{
                      const atr=isAtrasada(a),ehH=isHoje(a)
                      return(
                        <div key={a.id} className="tl-item">
                          {i<arr.length-1&&<div className="tl-line"/>}
                          <div className="tl-dot" style={{background:a.concluida?'var(--accent3)':atr?'var(--danger)':ehH?'var(--warning)':'var(--accent)'}}/>
                          <div style={{flex:1}}>
                            <div style={{display:'flex',gap:6,alignItems:'center',flexWrap:'wrap'}}>
                              <span style={{fontSize:11,padding:'1px 7px',borderRadius:4,background:'rgba(0,212,255,.1)',color:'var(--accent)'}}>{a.tipo}</span>
                              {a.concluida&&<span style={{fontSize:10,color:'var(--accent3)'}}>✅ Concluída</span>}
                              {atr&&!a.concluida&&<span style={{fontSize:10,color:'var(--danger)',fontWeight:700}}>⚠️ Atrasada</span>}
                              {ehH&&!a.concluida&&<span style={{fontSize:10,color:'var(--warning)',fontWeight:700}}>📅 Hoje</span>}
                            </div>
                            <div style={{fontSize:13,color:a.concluida?'var(--muted)':'var(--text)',marginTop:4,fontWeight:500,textDecoration:a.concluida?'line-through':'none'}}>{a.descricao}</div>
                            <div style={{fontSize:11,color:'var(--muted)',marginTop:3}}>
                              {a.prazo&&<span style={{color:atr?'var(--danger)':ehH?'var(--warning)':'var(--muted)'}}>⏰ {fmtDT(a.prazo)} · </span>}
                              {fmtDT(a.criadoEm)}
                            </div>
                            <div style={{display:'flex',gap:4,marginTop:6}}>
                              <button onClick={()=>toggleConcluida(a)} style={{padding:'3px 8px',borderRadius:5,background:a.concluida?'rgba(100,116,139,.1)':'rgba(16,185,129,.12)',border:`1px solid ${a.concluida?'var(--border)':'rgba(16,185,129,.3)'}`,color:a.concluida?'var(--muted)':'var(--accent3)',fontSize:11,cursor:'pointer'}}>{a.concluida?'↩ Reabrir':'✓ Concluir'}</button>
                              <button onClick={()=>{setFormAtiv({...a});setShowFormAtiv(true)}} style={{padding:'3px 7px',borderRadius:5,background:'rgba(0,212,255,.08)',border:'1px solid rgba(0,212,255,.2)',color:'var(--accent)',fontSize:11,cursor:'pointer'}}>✏️</button>
                              <button onClick={()=>excluirAtiv(a.id)} style={{padding:'3px 7px',borderRadius:5,background:'rgba(239,68,68,.08)',border:'1px solid rgba(239,68,68,.2)',color:'var(--danger)',fontSize:11,cursor:'pointer'}}>🗑</button>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                }
              </div>
            </div>
          </div>
        )}

        {/* ══════════ FUNIL KANBAN ══════════ */}
        {visao==='funil'&&!negSel&&(
          <>
            <div style={{display:'flex',gap:6,marginBottom:14,flexWrap:'wrap'}}>
              <button onClick={()=>setFiltroEtapa('todas')} style={{...S.chip,borderColor:filtroEtapa==='todas'?'var(--accent)':'var(--border)',color:filtroEtapa==='todas'?'var(--accent)':'var(--muted)',background:filtroEtapa==='todas'?'rgba(0,212,255,.1)':'var(--surface2)'}}>Todas</button>
              {etapas.map(e=>(
                <button key={e.id} onClick={()=>setFiltroEtapa(e.id)} style={{...S.chip,borderColor:filtroEtapa===e.id?e.cor:'var(--border)',color:filtroEtapa===e.id?e.cor:'var(--muted)',background:filtroEtapa===e.id?`${e.cor}18`:'var(--surface2)'}}>
                  {e.label} <span style={{fontSize:10,opacity:.7}}>({negocios.filter(n=>n.etapa===e.id).length})</span>
                </button>
              ))}
            </div>
            <div className="kb-wrap">
              {etapas.map(etapa=>{
                const cards=negFiltrados.filter(n=>n.etapa===etapa.id); const isDO=dragOver===etapa.id
                return(
                  <div key={etapa.id} className="kb-col" onDragOver={e=>onDragOver(e,etapa.id)} onDrop={e=>onDrop(e,etapa.id)}>
                    <div style={{padding:'8px 12px',borderRadius:8,marginBottom:8,background:isDO?'rgba(0,212,255,.06)':'var(--surface2)',border:`1px solid ${isDO?'rgba(0,212,255,.3)':'var(--border)'}`,transition:'all .2s'}}>
                      <div style={{display:'flex',alignItems:'center',gap:6}}>
                        <div style={{width:8,height:8,borderRadius:2,background:etapa.cor,flexShrink:0}}/>
                        <span style={{fontSize:11,fontWeight:700,color:'var(--text)',flex:1}}>{etapa.label}</span>
                        <span style={{fontSize:10,background:'rgba(0,212,255,.1)',color:'var(--accent)',borderRadius:10,padding:'1px 7px',fontWeight:700}}>{cards.length}</span>
                      </div>
                      <div style={{fontSize:10,color:'var(--muted)',marginTop:3}}>{fmt(cards.reduce((a,n)=>a+(Number(n.adesao)||0),0))}</div>
                    </div>
                    <div className={isDO?'drop-ok':''} style={{minHeight:80,borderRadius:8,padding:isDO?4:0,transition:'all .2s'}}>
                      {cards.map(neg=>{
                        const qA=atividades.filter(a=>a.negocioId===neg.id).length
                        const qR=atividades.filter(a=>a.negocioId===neg.id&&isAtrasada(a)).length
                        const qH=atividades.filter(a=>a.negocioId===neg.id&&isHoje(a)).length
                        return(
                          <div key={neg.id} className="neg-card" draggable onDragStart={e=>onDragStart(e,neg)} onDragEnd={onDragEnd}>
                            <div style={{fontWeight:700,fontSize:12,color:'var(--text)',marginBottom:3,lineHeight:1.3}}>{neg.titulo||neg.nome}</div>
                            {neg.nome&&neg.titulo!==neg.nome&&<div style={{fontSize:10,color:'var(--muted)',marginBottom:2}}>{neg.nome}</div>}
                            {neg.cnpj&&<div style={{fontSize:10,color:'var(--muted)'}}>{fmtDoc(neg.cnpj)}</div>}
                            {(neg.adesao||neg.mensalidade)&&<div style={{marginTop:5,display:'flex',gap:5,flexWrap:'wrap'}}>{neg.adesao&&<span style={{fontSize:10,color:'var(--gold)'}}>Ad:{fmt(neg.adesao)}</span>}{neg.mensalidade&&<span style={{fontSize:10,color:'var(--accent3)'}}>Men:{fmt(neg.mensalidade)}</span>}</div>}
                            {qA>0&&<div style={{display:'flex',gap:4,marginTop:5,flexWrap:'wrap'}}>{qR>0&&<span style={{fontSize:9,padding:'1px 5px',borderRadius:4,background:'rgba(239,68,68,.15)',color:'var(--danger)',fontWeight:700}}>⚠️{qR}</span>}{qH>0&&<span style={{fontSize:9,padding:'1px 5px',borderRadius:4,background:'rgba(245,158,11,.12)',color:'var(--warning)',fontWeight:700}}>📅{qH}</span>}{!qR&&!qH&&<span style={{fontSize:9,padding:'1px 5px',borderRadius:4,background:'rgba(0,212,255,.08)',color:'var(--accent)'}}>{qA} atv.</span>}</div>}
                            <div style={{display:'flex',gap:4,marginTop:8}}>
                              <button onClick={()=>{setNegSel(neg)}} style={{flex:1,padding:'4px 0',borderRadius:6,background:'rgba(0,212,255,.08)',border:'1px solid rgba(0,212,255,.2)',color:'var(--accent)',fontSize:10,cursor:'pointer',fontFamily:'DM Mono,monospace'}}>📋 Ver</button>
                              <button onClick={()=>{setFormNeg({...neg});setShowFormNeg(true)}} style={{padding:'4px 7px',borderRadius:6,background:'rgba(100,116,139,.08)',border:'1px solid var(--border)',color:'var(--muted)',fontSize:10,cursor:'pointer'}}>✏️</button>
                              <button onClick={()=>excluirNeg(neg.id)} style={{padding:'4px 7px',borderRadius:6,background:'rgba(239,68,68,.08)',border:'1px solid rgba(239,68,68,.2)',color:'var(--danger)',fontSize:10,cursor:'pointer'}}>🗑</button>
                            </div>
                          </div>
                        )
                      })}
                      {!cards.length&&<div style={{fontSize:11,color:'var(--muted)',textAlign:'center',padding:'18px 0',borderRadius:8,border:'1px dashed rgba(100,116,139,.2)'}}>Arrastar aqui</div>}
                    </div>
                  </div>
                )
              })}
            </div>
          </>
        )}

        {/* ══════════ VISÃO ATIVIDADES ══════════ */}
        {visao==='atividades'&&!negSel&&(
          <div>
            <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(140px,1fr))',gap:10,marginBottom:20}}>
              {[{l:'⚠️ Atrasadas',v:atrasadas,c:'var(--danger)',f:'atrasada'},{l:'📅 Para Hoje',v:parHoje,c:'var(--warning)',f:'hoje'},{l:'🔜 Futuras',v:parFutura,c:'var(--accent)',f:'futura'},{l:'✅ Concluídas',v:atividades.filter(a=>a.concluida).length,c:'var(--accent3)',f:'concluida'}].map(k=>(
                <div key={k.f} onClick={()=>setFiltroAtiv(filtroAtiv===k.f?'todas':k.f)}
                  style={{background:filtroAtiv===k.f?`${k.c}18`:'var(--surface)',border:`1px solid ${filtroAtiv===k.f?k.c:'var(--border)'}`,borderRadius:10,padding:'12px 14px',cursor:'pointer',transition:'all .2s'}}>
                  <div style={{fontSize:9,color:'var(--muted)',textTransform:'uppercase',letterSpacing:1,marginBottom:4}}>{k.l}</div>
                  <div style={{fontFamily:'Syne,sans-serif',fontSize:22,fontWeight:800,color:k.c}}>{k.v}</div>
                </div>
              ))}
            </div>
            <div style={{display:'flex',justifyContent:'flex-end',marginBottom:14}}>
              <button onClick={()=>{setFormAtiv({...EMPTY_ATIV});setShowFormAtiv(true)}} style={{padding:'9px 18px',borderRadius:9,background:'linear-gradient(135deg,var(--accent),#0099bb)',border:'none',color:'#fff',fontFamily:'DM Mono,monospace',fontSize:13,fontWeight:600,cursor:'pointer'}}>+ Nova Atividade</button>
            </div>
            {ativFiltradas.length===0
              ?<div style={{textAlign:'center',padding:'40px 0',color:'var(--muted)',fontSize:13}}>Nenhuma atividade.</div>
              :ativFiltradas.sort((a,b)=>{if(!a.prazo&&!b.prazo)return 0;if(!a.prazo)return 1;if(!b.prazo)return -1;return new Date(a.prazo)-new Date(b.prazo)}).map(a=>{
                const neg=negDeAtiv(a),atr=isAtrasada(a),ehH=isHoje(a)
                return(
                  <div key={a.id} style={{background:'var(--surface)',border:`1px solid ${atr?'rgba(239,68,68,.3)':ehH?'rgba(245,158,11,.3)':'var(--border)'}`,borderRadius:10,padding:'14px 16px',marginBottom:8,display:'flex',gap:12,alignItems:'flex-start'}}>
                    <div onClick={()=>toggleConcluida(a)} style={{width:22,height:22,borderRadius:6,border:`2px solid ${a.concluida?'var(--accent3)':atr?'var(--danger)':ehH?'var(--warning)':'var(--border)'}`,background:a.concluida?'var(--accent3)':'transparent',cursor:'pointer',flexShrink:0,marginTop:1,display:'flex',alignItems:'center',justifyContent:'center'}}>
                      {a.concluida&&<span style={{color:'#fff',fontSize:12,fontWeight:700}}>✓</span>}
                    </div>
                    <div style={{flex:1}}>
                      <div style={{display:'flex',gap:8,alignItems:'center',flexWrap:'wrap',marginBottom:4}}>
                        <span style={{fontSize:11,padding:'2px 7px',borderRadius:5,background:'rgba(0,212,255,.1)',color:'var(--accent)'}}>{a.tipo}</span>
                        {neg&&<span onClick={()=>setNegSel(neg)} style={{fontSize:11,color:'var(--accent2)',cursor:'pointer',textDecoration:'underline'}}>{neg.titulo||neg.nome}</span>}
                        {atr&&!a.concluida&&<span style={{fontSize:10,color:'var(--danger)',fontWeight:700}}>⚠️ Atrasada</span>}
                        {ehH&&!a.concluida&&<span style={{fontSize:10,color:'var(--warning)',fontWeight:700}}>📅 Hoje</span>}
                      </div>
                      <div style={{fontSize:13,color:a.concluida?'var(--muted)':'var(--text)',fontWeight:500,textDecoration:a.concluida?'line-through':'none'}}>{a.descricao}</div>
                      {a.prazo&&<div style={{fontSize:11,color:atr?'var(--danger)':ehH?'var(--warning)':'var(--muted)',marginTop:3}}>⏰ {fmtDT(a.prazo)}</div>}
                    </div>
                    <div style={{display:'flex',gap:4,flexShrink:0}}>
                      <button onClick={()=>{setFormAtiv({...a});setShowFormAtiv(true)}} style={{padding:'5px 9px',borderRadius:6,background:'rgba(0,212,255,.08)',border:'1px solid rgba(0,212,255,.2)',color:'var(--accent)',fontSize:12,cursor:'pointer'}}>✏️</button>
                      <button onClick={()=>excluirAtiv(a.id)} style={{padding:'5px 9px',borderRadius:6,background:'rgba(239,68,68,.08)',border:'1px solid rgba(239,68,68,.2)',color:'var(--danger)',fontSize:12,cursor:'pointer'}}>🗑</button>
                    </div>
                  </div>
                )
              })
            }
          </div>
        )}
      </main>

      {/* ════ MODAL NEGÓCIO ════ */}
      {showFormNeg&&(
        <div style={S.ov}>
          <div style={S.md}>
            <div style={S.mh}><h3 style={S.mt}>{formNeg.id?'✏️ Editar':'➕ Novo Negócio'}</h3><button onClick={()=>setShowFormNeg(false)} style={S.mc}>✕</button></div>
            <div style={S.mb}>
              <div style={{background:'var(--surface2)',border:'1px solid var(--border)',borderRadius:10,padding:14,marginBottom:14}}>
                <div style={{fontSize:10,color:'var(--accent)',marginBottom:8,fontWeight:700,letterSpacing:1,textTransform:'uppercase'}}>🔍 Buscar por CNPJ</div>
                <div style={{display:'flex',gap:8}}>
                  <input value={formNeg.cnpj} onChange={e=>setFormNeg(f=>({...f,cnpj:e.target.value}))} placeholder="00.000.000/0001-00" style={S.ip}/>
                  <button onClick={buscarCNPJ} disabled={buscandoCNPJ} style={{padding:'9px 14px',borderRadius:8,background:'rgba(0,212,255,.15)',border:'1px solid rgba(0,212,255,.3)',color:'var(--accent)',fontSize:12,cursor:'pointer',whiteSpace:'nowrap',fontFamily:'DM Mono,monospace'}}>{buscandoCNPJ?'⏳...':'🔍 Buscar'}</button>
                </div>
              </div>
              <F l="Título *"><input value={formNeg.titulo} onChange={e=>setFormNeg(f=>({...f,titulo:e.target.value}))} placeholder="Ex: Escritório Silva" style={S.ip}/></F>
              <div style={S.g2}>
                <F l="Razão Social"><input value={formNeg.nome} onChange={e=>setFormNeg(f=>({...f,nome:e.target.value}))} style={S.ip}/></F>
                <F l="Nome Fantasia"><input value={formNeg.fantasia} onChange={e=>setFormNeg(f=>({...f,fantasia:e.target.value}))} style={S.ip}/></F>
                <F l="E-mail"><input type="email" value={formNeg.email} onChange={e=>setFormNeg(f=>({...f,email:e.target.value}))} style={S.ip}/></F>
                <F l="Telefone"><input value={formNeg.telefone} onChange={e=>setFormNeg(f=>({...f,telefone:e.target.value}))} style={S.ip}/></F>
                <F l="CPF"><input value={formNeg.cpf} onChange={e=>setFormNeg(f=>({...f,cpf:e.target.value}))} style={S.ip}/></F>
                <F l="Responsável"><input value={formNeg.responsavel} onChange={e=>setFormNeg(f=>({...f,responsavel:e.target.value}))} style={S.ip}/></F>
                <F l="Cidade"><input value={formNeg.cidade} onChange={e=>setFormNeg(f=>({...f,cidade:e.target.value}))} style={S.ip}/></F>
                <F l="UF"><input value={formNeg.uf} onChange={e=>setFormNeg(f=>({...f,uf:e.target.value}))} maxLength={2} style={S.ip}/></F>
              </div>
              <F l="Endereço"><input value={formNeg.endereco} onChange={e=>setFormNeg(f=>({...f,endereco:e.target.value}))} style={S.ip}/></F>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:12}}>
                <F l="Adesão (R$)"><input type="number" value={formNeg.adesao} onChange={e=>setFormNeg(f=>({...f,adesao:e.target.value}))} style={S.ip}/></F>
                <F l="Mensalidade (R$)"><input type="number" value={formNeg.mensalidade} onChange={e=>setFormNeg(f=>({...f,mensalidade:e.target.value}))} style={S.ip}/></F>
                <F l="Etapa"><select value={formNeg.etapa} onChange={e=>setFormNeg(f=>({...f,etapa:e.target.value}))} style={{...S.ip,cursor:'pointer'}}>{etapas.map(e=><option key={e.id} value={e.id}>{e.label}</option>)}</select></F>
              </div>
              <F l="Módulos"><input value={formNeg.modulos} onChange={e=>setFormNeg(f=>({...f,modulos:e.target.value}))} placeholder="Ex: Gestão Fiscal, BIA" style={S.ip}/></F>
              <F l="Observações"><textarea value={formNeg.observacoes} onChange={e=>setFormNeg(f=>({...f,observacoes:e.target.value}))} rows={3} style={{...S.ip,resize:'vertical'}}/></F>
            </div>
            <div style={S.mf}><button onClick={()=>setShowFormNeg(false)} style={S.bc}>Cancelar</button><button onClick={salvarNeg} disabled={saving} style={S.bp}>{saving?'⏳...':'✅ Salvar'}</button></div>
          </div>
        </div>
      )}

      {/* ════ MODAL ATIVIDADE ════ */}
      {showFormAtiv&&(
        <div style={S.ov}>
          <div style={{...S.md,maxWidth:480}}>
            <div style={S.mh}><h3 style={S.mt}>{formAtiv.id?'✏️ Editar Atividade':'➕ Nova Atividade'}</h3><button onClick={()=>setShowFormAtiv(false)} style={S.mc}>✕</button></div>
            <div style={S.mb}>
              {!formAtiv.negocioId&&(
                <F l="Negócio Vinculado"><select value={formAtiv.negocioId} onChange={e=>setFormAtiv(f=>({...f,negocioId:e.target.value}))} style={{...S.ip,cursor:'pointer'}}><option value="">— Selecionar —</option>{negocios.map(n=><option key={n.id} value={n.id}>{n.titulo||n.nome}</option>)}</select></F>
              )}
              <div style={S.g2}>
                <F l="Tipo"><select value={formAtiv.tipo} onChange={e=>setFormAtiv(f=>({...f,tipo:e.target.value}))} style={{...S.ip,cursor:'pointer'}}>{TIPO_ATIVIDADE.map(t=><option key={t} value={t}>{t}</option>)}</select></F>
                <F l="Prazo / Data e Hora"><input type="datetime-local" value={formAtiv.prazo} onChange={e=>setFormAtiv(f=>({...f,prazo:e.target.value}))} style={S.ip}/></F>
              </div>
              <F l="Descrição *"><textarea value={formAtiv.descricao} onChange={e=>setFormAtiv(f=>({...f,descricao:e.target.value}))} rows={3} placeholder="O que foi feito ou precisa ser feito..." style={{...S.ip,resize:'vertical'}}/></F>
              <label style={{display:'flex',alignItems:'center',gap:10,cursor:'pointer',fontSize:13,color:'var(--muted)',marginTop:4,padding:'10px 14px',background:'var(--surface2)',border:'1px solid var(--border)',borderRadius:8}}>
                <input type="checkbox" checked={formAtiv.concluida} onChange={e=>setFormAtiv(f=>({...f,concluida:e.target.checked}))}/>
                Marcar como concluída
              </label>
            </div>
            <div style={S.mf}><button onClick={()=>setShowFormAtiv(false)} style={S.bc}>Cancelar</button><button onClick={salvarAtiv} disabled={saving} style={S.bp}>{saving?'⏳...':'✅ Salvar'}</button></div>
          </div>
        </div>
      )}
    </>
  )
}

function F({ l, children }) {
  return <div style={{marginBottom:12}}><label style={{fontSize:11,color:'var(--muted)',display:'block',marginBottom:4,letterSpacing:'.5px'}}>{l}</label>{children}</div>
}

const S = {
  nb:   { background:'var(--surface2)', border:'1px solid var(--border)', cursor:'pointer', color:'var(--muted)', fontSize:11, padding:'5px 11px', borderRadius:8, fontFamily:'DM Mono,monospace' },
  chip: { padding:'5px 10px', borderRadius:7, border:'1px solid var(--border)', fontSize:11, cursor:'pointer', fontFamily:'DM Mono,monospace' },
  ip:   { width:'100%', background:'var(--surface2)', border:'1px solid var(--border)', borderRadius:8, padding:'9px 12px', fontFamily:'DM Mono,monospace', fontSize:13, color:'var(--text)', outline:'none' },
  g2:   { display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 },
  ov:   { position:'fixed', inset:0, background:'rgba(0,0,0,.75)', zIndex:200, display:'flex', alignItems:'center', justifyContent:'center', padding:20, overflowY:'auto' },
  md:   { background:'var(--surface)', border:'1px solid var(--border)', borderRadius:16, width:'100%', maxWidth:640, boxShadow:'0 8px 40px rgba(0,0,0,.5)', maxHeight:'92vh', display:'flex', flexDirection:'column' },
  mh:   { padding:'20px 24px 0', flexShrink:0, display:'flex', alignItems:'center', justifyContent:'space-between' },
  mt:   { fontFamily:'Syne,sans-serif', fontSize:16, fontWeight:700, color:'var(--accent)' },
  mc:   { background:'none', border:'none', color:'var(--muted)', fontSize:22, cursor:'pointer', lineHeight:1 },
  mb:   { padding:'16px 24px', overflowY:'auto', flex:1 },
  mf:   { padding:'16px 24px', borderTop:'1px solid var(--border)', display:'flex', gap:10, justifyContent:'flex-end', flexShrink:0 },
  bc:   { padding:'10px 18px', borderRadius:10, background:'rgba(100,116,139,.12)', border:'1px solid var(--border)', color:'var(--muted)', fontFamily:'DM Mono,monospace', fontSize:13, cursor:'pointer' },
  bp:   { padding:'10px 22px', borderRadius:10, background:'linear-gradient(135deg,var(--accent),#0099bb)', border:'none', color:'#fff', fontFamily:'DM Mono,monospace', fontSize:13, fontWeight:600, cursor:'pointer' },
}

export async function getServerSideProps() { return { props:{} } }
