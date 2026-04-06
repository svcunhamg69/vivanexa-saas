// pages/whatsapp-inbox.js — v3
// ✅ Correções:
//   1. Automação = apenas conversa nova sem agente
//   2. "Atender" seta botPausado=true → webhook não volta para Automação
//   3. "Abrir no CRM" abre modal que cria negócio direto no funil
//   4. Status fixo enquanto agente estiver no controle

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/router'
import Head from 'next/head'
import { supabase } from '../lib/supabase'
import Navbar from '../components/Navbar'

const STATUS = {
  automacao:  { label: 'Automação',  cor: '#7c3aed', bg: 'rgba(124,58,237,.15)' },
  aguardando: { label: 'Aguardando', cor: '#f59e0b', bg: 'rgba(245,158,11,.15)' },
  atendendo:  { label: 'Atendendo',  cor: '#00d4ff', bg: 'rgba(0,212,255,.15)'  },
  finalizado: { label: 'Finalizado', cor: '#10b981', bg: 'rgba(16,185,129,.15)' },
}
const ABAS = ['automacao', 'aguardando', 'atendendo', 'finalizado']
const TAGS_PADRAO = [
  { id: 'lead_frio',    label: 'Lead Frio',     cor: '#64748b' },
  { id: 'lead_quente',  label: 'Lead Quente',   cor: '#ef4444' },
  { id: 'dor_demora',   label: 'Dor: Demora',   cor: '#f59e0b' },
  { id: 'dor_controle', label: 'Dor: Controle', cor: '#7c3aed' },
  { id: 'proposta',     label: 'Proposta',      cor: '#00d4ff' },
  { id: 'contrato',     label: 'Contrato',      cor: '#10b981' },
]

function gerarProtocolo(tipo = 'ATD') {
  const now = new Date(), pad = n => String(n).padStart(2,'0')
  return `${tipo}-${now.getFullYear()}${pad(now.getMonth()+1)}${pad(now.getDate())}-${Math.floor(Math.random()*90000+10000)}`
}

function fmtHora(iso) {
  if (!iso) return ''
  const d = new Date(iso), diff = Math.floor((new Date() - d) / 86400000)
  if (diff === 0) return d.toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})
  if (diff === 1) return 'ontem'
  return d.toLocaleDateString('pt-BR',{day:'2-digit',month:'2-digit'})
}

function Avatar({ nome, size = 38 }) {
  const ini = (nome||'?').slice(0,2).toUpperCase()
  const col = ['#00d4ff','#7c3aed','#10b981','#f59e0b','#ef4444'][(nome||'').charCodeAt(0)%5]
  return <div style={{ width:size, height:size, borderRadius:'50%', background:`${col}22`, border:`2px solid ${col}55`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:size*.35, fontWeight:700, color:col, flexShrink:0, fontFamily:'Syne,sans-serif' }}>{ini}</div>
}

// ── Modal Criar no CRM ───────────────────────────────────────────────────────
function ModalCRM({ conv, empresaId, user, cfg, onClose, onSalvo }) {
  const etapas = cfg.crm_etapas?.length ? cfg.crm_etapas : [
    {id:'lead',label:'Lead'},{id:'lead_qualificado',label:'Lead Qualificado'},
    {id:'reuniao_agendada',label:'Reunião Agendada'},{id:'proposta_enviada',label:'Proposta Enviada'},
    {id:'fechamento',label:'Fechamento'},
  ]
  const [form, setForm] = useState({
    titulo: conv.nome ? `Atendimento – ${conv.nome}` : 'Novo Lead WhatsApp',
    nome: conv.nome || '', telefone: conv.numero || '',
    cnpj: '', email: '', etapa: 'lead', origem: 'whatsapp',
    observacoes: `Lead via WhatsApp em ${new Date().toLocaleDateString('pt-BR')}`,
  })
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')

  const inp = { width:'100%', background:'#1a2540', border:'1px solid #1e2d4a', borderRadius:8, padding:'9px 12px', color:'#e2e8f0', fontFamily:'DM Mono,monospace', fontSize:13, outline:'none' }
  const lbl = { fontSize:11, color:'#64748b', display:'block', marginBottom:4 }

  async function salvar() {
    if (!form.titulo.trim() || !form.nome.trim()) { setErro('Título e nome são obrigatórios.'); return }
    setSalvando(true); setErro('')
    try {
      const { data: row } = await supabase.from('vx_storage').select('value').eq('key',`cfg:${empresaId}`).maybeSingle()
      const currentCfg = row?.value ? JSON.parse(row.value) : {}
      const novo = { id:`neg_${Date.now()}`, titulo:form.titulo, etapa:form.etapa, nome:form.nome, telefone:form.telefone, cnpj:form.cnpj, email:form.email, observacoes:form.observacoes, origem:'whatsapp', responsavel:user?.nome||user?.email||'', criadoEm:new Date().toISOString(), atualizadoEm:new Date().toISOString(), wppNumero:conv.numero }
      currentCfg.crm_negocios = [...(currentCfg.crm_negocios||[]), novo]
      await supabase.from('vx_storage').upsert({ key:`cfg:${empresaId}`, value:JSON.stringify(currentCfg), updated_at:new Date().toISOString() },{ onConflict:'key' })
      onSalvo(novo)
    } catch(e) { setErro('Erro: '+e.message) }
    setSalvando(false)
  }

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.75)', zIndex:2000, display:'flex', alignItems:'center', justifyContent:'center', padding:20 }} onClick={onClose}>
      <div style={{ background:'#111827', border:'1px solid #1e2d4a', borderRadius:16, padding:28, width:'100%', maxWidth:460, maxHeight:'90vh', overflowY:'auto' }} onClick={e=>e.stopPropagation()}>
        <div style={{ fontFamily:'Syne,sans-serif', fontWeight:700, fontSize:17, color:'#e2e8f0', marginBottom:20 }}>🤝 Criar Negócio no CRM</div>
        <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
          <div><label style={lbl}>TÍTULO *</label><input style={inp} value={form.titulo} onChange={e=>setForm(p=>({...p,titulo:e.target.value}))} /></div>
          <div><label style={lbl}>NOME DO CONTATO *</label><input style={inp} value={form.nome} onChange={e=>setForm(p=>({...p,nome:e.target.value}))} /></div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
            <div><label style={lbl}>TELEFONE</label><input style={inp} value={form.telefone} onChange={e=>setForm(p=>({...p,telefone:e.target.value}))} /></div>
            <div><label style={lbl}>EMAIL</label><input style={inp} value={form.email} onChange={e=>setForm(p=>({...p,email:e.target.value}))} placeholder="email@empresa.com" /></div>
          </div>
          <div><label style={lbl}>CNPJ (opcional)</label><input style={inp} value={form.cnpj} onChange={e=>setForm(p=>({...p,cnpj:e.target.value}))} placeholder="00.000.000/0001-00" /></div>
          <div><label style={lbl}>ETAPA DO FUNIL</label>
            <select style={{...inp,cursor:'pointer'}} value={form.etapa} onChange={e=>setForm(p=>({...p,etapa:e.target.value}))}>
              {etapas.map(et=><option key={et.id} value={et.id}>{et.label}</option>)}
            </select>
          </div>
          <div><label style={lbl}>OBSERVAÇÕES</label><textarea style={{...inp,resize:'vertical',minHeight:72}} value={form.observacoes} onChange={e=>setForm(p=>({...p,observacoes:e.target.value}))} /></div>
        </div>
        {erro && <div style={{ marginTop:12, padding:'8px 12px', background:'rgba(239,68,68,.1)', border:'1px solid rgba(239,68,68,.3)', borderRadius:8, fontSize:12, color:'#ef4444' }}>⚠️ {erro}</div>}
        <div style={{ display:'flex', gap:10, marginTop:20 }}>
          <button onClick={onClose} style={{ flex:1, padding:10, background:'none', border:'1px solid #1e2d4a', color:'#64748b', borderRadius:10, cursor:'pointer', fontFamily:'DM Mono,monospace', fontSize:13 }}>Cancelar</button>
          <button onClick={salvar} disabled={salvando} style={{ flex:2, padding:10, background:'linear-gradient(135deg,#00d4ff,#0099bb)', border:'none', color:'#fff', borderRadius:10, cursor:salvando?'not-allowed':'pointer', fontFamily:'DM Mono,monospace', fontSize:13, fontWeight:600 }}>
            {salvando ? '⏳ Salvando...' : '✅ Criar no CRM'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Principal ────────────────────────────────────────────────────────────────
export default function WhatsappInbox() {
  const router = useRouter()
  const [user, setUser]             = useState(null)
  const [cfg,  setCfg]              = useState({})
  const [empresaId, setEmpresaId]   = useState(null)
  const [loading, setLoading]       = useState(true)
  const [idx, setIdx]               = useState({})
  const [convAtiva, setConvAtiva]   = useState(null)
  const [conv, setConv]             = useState(null)
  const [abaAtiva, setAbaAtiva]     = useState('automacao')
  const [busca, setBusca]           = useState('')
  const [enviando, setEnviando]     = useState(false)
  const [msgInput, setMsgInput]     = useState('')
  const [loadingConv, setLoadingConv] = useState(false)
  const [sidebarAberta, setSidebarAberta] = useState(false)
  const [showTransferir, setShowTransferir] = useState(false)
  const [showCRM, setShowCRM]       = useState(false)
  const [agentes, setAgentes]       = useState([])
  const [protocolo, setProtocolo]   = useState(null)
  const [toast, setToast]           = useState(null)
  const pollingRef = useRef(null)
  const msgEndRef  = useRef(null)
  const idxRef     = useRef({})

  const showToast = (msg, tipo='ok') => { setToast({msg,tipo}); setTimeout(()=>setToast(null),3500) }

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) { router.replace('/'); return }
      let { data: profile } = await supabase.from('perfis').select('*').eq('user_id',session.user.id).maybeSingle()
      if (!profile) {
        const nome = session.user.email?.split('@')[0]||'Usuário'
        const { data: p } = await supabase.from('perfis').insert({user_id:session.user.id,nome,email:session.user.email,empresa_id:session.user.id,perfil:'admin'}).select().single()
        profile = p
      }
      const eid = profile?.empresa_id||session.user.id
      setEmpresaId(eid); setUser({...session.user,...profile})
      const { data: cfgRow } = await supabase.from('vx_storage').select('value').eq('key',`cfg:${eid}`).maybeSingle()
      setCfg(cfgRow?.value ? JSON.parse(cfgRow.value) : {})
      const { data: perfis } = await supabase.from('perfis').select('user_id,nome,email').eq('empresa_id',eid)
      setAgentes(perfis||[])
      await carregarIndice(eid)
      setLoading(false)
    })
    return () => { if (pollingRef.current) clearInterval(pollingRef.current) }
  }, [router])

  useEffect(() => {
    if (!empresaId) return
    pollingRef.current = setInterval(async () => {
      const novo = await carregarIndice(empresaId, true)
      if (convAtiva) {
        const novAt = novo?.[convAtiva]?.updatedAt
        if (!idxRef.current?.[convAtiva]?.updatedAt || novAt !== idxRef.current[convAtiva].updatedAt)
          await carregarConv(empresaId, convAtiva, true)
      }
    }, 4000)
    return () => clearInterval(pollingRef.current)
  }, [empresaId, convAtiva])

  useEffect(() => { msgEndRef.current?.scrollIntoView({behavior:'smooth'}) }, [conv?.mensagens?.length])

  async function carregarIndice(eid, silencioso=false) {
    try {
      const { data: row } = await supabase.from('vx_storage').select('value').eq('key',`wpp_idx:${eid}`).maybeSingle()
      if (row?.value) { const p = JSON.parse(row.value); idxRef.current=p; setIdx(p); return p }
    } catch {}
    if (!silencioso) setLoading(false)
    return {}
  }

  async function carregarConv(eid, numero, silencioso=false) {
    if (!silencioso) setLoadingConv(true)
    try {
      const { data: row } = await supabase.from('vx_storage').select('value').eq('key',`wpp_conv:${eid}:${numero}`).maybeSingle()
      if (row?.value) {
        const c = JSON.parse(row.value)
        setConv(c)
        if (c.protocolo) setProtocolo(c.protocolo)
        if (c.naoLidas > 0) {
          c.naoLidas = 0
          await supabase.from('vx_storage').upsert({key:`wpp_conv:${eid}:${numero}`,value:JSON.stringify(c),updated_at:new Date().toISOString()},{onConflict:'key'})
          setIdx(prev => { const n={...prev,[numero]:{...(prev[numero]||{}),naoLidas:0}}; idxRef.current=n; return n })
        }
      }
    } catch {}
    if (!silencioso) setLoadingConv(false)
  }

  async function abrirConv(numero) {
    setConvAtiva(numero); setProtocolo(null); setSidebarAberta(false)
    await carregarConv(empresaId, numero)
  }

  async function enviar() {
    const txt = msgInput.trim()
    if (!txt||!convAtiva||enviando) return
    setEnviando(true); setMsgInput('')
    try {
      const r = await fetch('/api/wpp/send',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({empresaId,numero:convAtiva,mensagem:txt})})
      const d = await r.json()
      if (!r.ok) throw new Error(d.error||'Erro ao enviar')
      await carregarConv(empresaId, convAtiva, true)
    } catch(err) { showToast('Erro: '+err.message,'erro') }
    setEnviando(false)
  }

  async function mudarStatus(novoStatus, extra={}) {
    if (!conv||!empresaId) return
    const c = {...conv, status:novoStatus, ...extra}
    setConv(c)
    await supabase.from('vx_storage').upsert({key:`wpp_conv:${empresaId}:${convAtiva}`,value:JSON.stringify(c),updated_at:new Date().toISOString()},{onConflict:'key'})
    const novoIdx = {...idxRef.current,[convAtiva]:{...(idxRef.current[convAtiva]||{}),status:novoStatus,updatedAt:new Date().toISOString()}}
    idxRef.current=novoIdx; setIdx(novoIdx)
    await supabase.from('vx_storage').upsert({key:`wpp_idx:${empresaId}`,value:JSON.stringify(novoIdx),updated_at:new Date().toISOString()},{onConflict:'key'})
  }

  // ✅ Assumir: botPausado=true → webhook não reseta status
  async function assumirAtendimento() {
    await mudarStatus('atendendo',{botPausado:true,agenteId:user?.user_id,agenteNome:user?.nome||user?.email})
    showToast('✅ Você assumiu. Bot pausado.')
  }

  async function reativarBot() {
    await mudarStatus('automacao',{botPausado:false,agenteId:null,agenteNome:null})
    showToast('🤖 Bot reativado.')
  }

  async function finalizarComProtocolo() {
    const prot = gerarProtocolo('ATD')
    setProtocolo(prot)
    await mudarStatus('finalizado',{protocolo:prot,finalizadoEm:new Date().toISOString()})
    try {
      await fetch('/api/wpp/send',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({empresaId,numero:convAtiva,mensagem:`✅ Atendimento encerrado.\n\n📋 *Protocolo: ${prot}*\n\nObrigado por entrar em contato! 😊`})})
      await carregarConv(empresaId, convAtiva, true)
    } catch {}
    showToast(`📋 Protocolo: ${prot}`)
  }

  async function transferirPara(ag) {
    await mudarStatus('aguardando',{agenteId:ag.user_id,agenteNome:ag.nome,botPausado:true})
    setShowTransferir(false); showToast(`🔀 Transferido para ${ag.nome}`)
  }

  async function toggleTag(tagId) {
    if (!conv) return
    const novasTags = (conv.tags||[]).includes(tagId) ? (conv.tags||[]).filter(t=>t!==tagId) : [...(conv.tags||[]),tagId]
    const c = {...conv,tags:novasTags}; setConv(c)
    await supabase.from('vx_storage').upsert({key:`wpp_conv:${empresaId}:${convAtiva}`,value:JSON.stringify(c),updated_at:new Date().toISOString()},{onConflict:'key'})
    setIdx(prev=>{const n={...prev,[convAtiva]:{...(prev[convAtiva]||{}),tags:novasTags}};idxRef.current=n;return n})
  }

  const listaFiltrada = Object.values(idx)
    .filter(c=>c.status===abaAtiva)
    .filter(c=>!busca||(c.nome||'').toLowerCase().includes(busca.toLowerCase())||(c.numero||'').includes(busca))
    .sort((a,b)=>new Date(b.updatedAt||0)-new Date(a.updatedAt||0))

  const contadores = {}
  for (const aba of ABAS) contadores[aba] = Object.values(idx).filter(c=>c.status===aba).length

  const tagsDisp = cfg.wppTags?.length ? cfg.wppTags : TAGS_PADRAO
  const botAtivo = conv && !conv.botPausado && conv.status === 'automacao'

  if (loading) return <div style={{minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center',background:'#0a0f1e',color:'#64748b',fontFamily:'DM Mono,monospace'}}>Carregando inbox...</div>

  return (
    <>
      <Head>
        <title>WhatsApp Inbox – Vivanexa</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <link href="https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=DM+Mono:wght@300;400;500&display=swap" rel="stylesheet" />
      </Head>
      <style>{CSS}</style>
      <Navbar cfg={cfg} perfil={user} />

      {toast && <div style={{position:'fixed',bottom:24,left:'50%',transform:'translateX(-50%)',background:toast.tipo==='erro'?'#ef444422':'#10b98122',border:`1px solid ${toast.tipo==='erro'?'#ef4444':'#10b981'}`,color:toast.tipo==='erro'?'#ef4444':'#10b981',padding:'10px 20px',borderRadius:10,fontSize:13,zIndex:9999,fontFamily:'DM Mono,monospace',backdropFilter:'blur(8px)',boxShadow:'0 4px 24px rgba(0,0,0,.4)',whiteSpace:'nowrap'}}>{toast.msg}</div>}

      {showTransferir && (
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,.65)',zIndex:1000,display:'flex',alignItems:'center',justifyContent:'center'}} onClick={()=>setShowTransferir(false)}>
          <div style={{background:'#111827',border:'1px solid #1e2d4a',borderRadius:16,padding:24,minWidth:300,maxWidth:380}} onClick={e=>e.stopPropagation()}>
            <div style={{fontFamily:'Syne,sans-serif',fontWeight:700,color:'#e2e8f0',marginBottom:16}}>🔀 Transferir Atendimento</div>
            {agentes.map(ag=>(
              <button key={ag.user_id} onClick={()=>transferirPara(ag)} style={{width:'100%',padding:'10px 14px',marginBottom:8,borderRadius:10,background:'#1a2540',border:'1px solid #1e2d4a',color:'#e2e8f0',fontFamily:'DM Mono,monospace',fontSize:13,cursor:'pointer',textAlign:'left',display:'flex',alignItems:'center',gap:10}}>
                <Avatar nome={ag.nome} size={28} />
                <div><div style={{fontWeight:600}}>{ag.nome}</div><div style={{fontSize:11,color:'#64748b'}}>{ag.email}</div></div>
              </button>
            ))}
            <button onClick={()=>setShowTransferir(false)} style={{width:'100%',padding:8,background:'none',border:'1px solid #1e2d4a',color:'#64748b',borderRadius:8,cursor:'pointer',fontFamily:'DM Mono,monospace',fontSize:12,marginTop:8}}>Cancelar</button>
          </div>
        </div>
      )}

      {showCRM && conv && (
        <ModalCRM conv={conv} empresaId={empresaId} user={user} cfg={cfg}
          onClose={()=>setShowCRM(false)}
          onSalvo={()=>{ setShowCRM(false); showToast('✅ Negócio criado no CRM!'); setTimeout(()=>router.push('/crm'),1500) }}
        />
      )}

      <div className="inbox-wrap">
        {/* LISTA */}
        <div className="conv-list">
          <div className="list-header">
            <div style={{display:'flex',alignItems:'center',gap:10}}>
              <span style={{fontSize:20}}>💬</span>
              <span style={{fontFamily:'Syne,sans-serif',fontWeight:700,fontSize:15,color:'var(--text)'}}>WhatsApp Inbox</span>
            </div>
            <button onClick={()=>router.push('/configuracoes?tab=whatsapp')} className="btn-icon">⚙️</button>
          </div>
          <div className="busca-wrap">
            <span style={{fontSize:14,color:'var(--muted)'}}>🔍</span>
            <input className="busca-input" placeholder="Buscar conversas..." value={busca} onChange={e=>setBusca(e.target.value)} />
          </div>
          <div className="abas-list">
            {ABAS.map(aba=>(
              <button key={aba} onClick={()=>setAbaAtiva(aba)} className={`aba-btn ${abaAtiva===aba?'ativa':''}`}>
                {STATUS[aba].label}
                {contadores[aba]>0 && <span className="aba-count" style={{background:STATUS[aba].cor}}>{contadores[aba]}</span>}
              </button>
            ))}
          </div>
          <div className="conv-items">
            {listaFiltrada.length===0 ? (
              <div className="empty-list">
                <div style={{fontSize:36,marginBottom:10}}>💬</div>
                <div>Nenhuma conversa em <strong>{STATUS[abaAtiva].label}</strong></div>
                {abaAtiva==='automacao' && <div style={{fontSize:11,color:'var(--muted)',marginTop:8,lineHeight:1.6}}>Mensagens recebidas via WhatsApp<br/>aparecem aqui automaticamente.</div>}
              </div>
            ) : listaFiltrada.map(c=>(
              <div key={c.numero} onClick={()=>abrirConv(c.numero)} className={`conv-item ${convAtiva===c.numero?'ativa':''}`}>
                <Avatar nome={c.nome} />
                <div style={{flex:1,minWidth:0}}>
                  <div style={{display:'flex',justifyContent:'space-between',gap:8}}>
                    <div className="conv-nome">{c.nome||c.numero}</div>
                    <div className="conv-hora">{fmtHora(c.updatedAt)}</div>
                  </div>
                  <div className="conv-preview">{c.ultimaMensagem||'...'}</div>
                  {(c.tags||[]).length>0 && (
                    <div style={{display:'flex',gap:4,flexWrap:'wrap',marginTop:4}}>
                      {(c.tags||[]).slice(0,2).map(tid=>{ const t=tagsDisp.find(x=>x.id===tid); return t?<span key={tid} className="tag-chip" style={{borderColor:t.cor+'55',color:t.cor,background:t.cor+'15'}}>{t.label}</span>:null })}
                    </div>
                  )}
                </div>
                {(c.naoLidas||0)>0 && <span className="badge-naoLidas">{c.naoLidas}</span>}
              </div>
            ))}
          </div>
        </div>

        {/* CHAT */}
        <div className={`chat-area ${convAtiva?'aberta':''}`}>
          {!convAtiva ? (
            <div className="chat-vazio">
              <div style={{fontSize:56,marginBottom:16}}>💬</div>
              <div style={{fontFamily:'Syne,sans-serif',fontSize:18,fontWeight:700,color:'var(--text)',marginBottom:8}}>Atendimentos</div>
              <div style={{fontSize:13,color:'var(--muted)'}}>Selecione uma conversa para visualizar</div>
              <button onClick={()=>router.push('/configuracoes?tab=whatsapp')} className="btn-primary" style={{marginTop:20}}>⚙️ Configurar WhatsApp</button>
            </div>
          ) : loadingConv ? (
            <div className="chat-vazio"><div style={{color:'var(--muted)',fontSize:14}}>Carregando...</div></div>
          ) : conv ? (
            <>
              <div className="chat-header">
                <button className="btn-back" onClick={()=>setConvAtiva(null)}>←</button>
                <Avatar nome={conv.nome} size={34} />
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontWeight:700,fontSize:14,color:'var(--text)',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{conv.nome||conv.numero}</div>
                  <div style={{fontSize:11,color:'var(--muted)'}}>{conv.numero}{conv.agenteNome&&<span style={{color:'#00d4ff',marginLeft:8}}>· {conv.agenteNome}</span>}</div>
                </div>
                {botAtivo && <div style={{fontSize:10,fontWeight:700,padding:'3px 8px',borderRadius:20,background:'rgba(124,58,237,.2)',color:'#7c3aed',border:'1px solid rgba(124,58,237,.4)',display:'flex',alignItems:'center',gap:4}}><span style={{width:6,height:6,borderRadius:'50%',background:'#7c3aed',display:'inline-block',animation:'pulse 1.5s infinite'}}/>BOT ATIVO</div>}
                <div style={{fontSize:11,fontWeight:700,padding:'3px 10px',borderRadius:20,background:STATUS[conv.status]?.bg,color:STATUS[conv.status]?.cor,border:`1px solid ${STATUS[conv.status]?.cor}44`}}>{STATUS[conv.status]?.label}</div>
                <div style={{display:'flex',gap:5,flexWrap:'wrap'}}>
                  {conv.status!=='finalizado' && (
                    conv.status==='automacao'||botAtivo
                      ? <button onClick={assumirAtendimento} className="btn-acao verde">🙋 Assumir</button>
                      : <button onClick={reativarBot} className="btn-acao cinza">🤖 Bot</button>
                  )}
                  {/* ✅ Atender = assume com botPausado=true */}
                  {conv.status!=='atendendo'&&conv.status!=='finalizado'&&<button onClick={assumirAtendimento} className="btn-acao verde">▶ Atender</button>}
                  {conv.status==='atendendo'&&<button onClick={()=>mudarStatus('aguardando')} className="btn-acao amarelo">⏸ Aguardar</button>}
                  {conv.status!=='finalizado'&&<><button onClick={()=>setShowTransferir(true)} className="btn-acao cinza">🔀 Transferir</button><button onClick={finalizarComProtocolo} className="btn-acao cinza">✓ Finalizar</button></>}
                  <button onClick={()=>setSidebarAberta(!sidebarAberta)} className="btn-icon">ℹ️</button>
                </div>
              </div>

              {protocolo && <div style={{padding:'7px 16px',background:'rgba(16,185,129,.1)',borderBottom:'1px solid rgba(16,185,129,.2)',fontSize:12,color:'#10b981'}}>📋 Protocolo: <strong>{protocolo}</strong></div>}
              {conv.agenteNome&&conv.status!=='automacao'&&<div style={{padding:'5px 16px',background:'rgba(0,212,255,.05)',borderBottom:'1px solid rgba(0,212,255,.1)',fontSize:11,color:'#64748b'}}>👤 Atendido por: <span style={{color:'#00d4ff'}}>{conv.agenteNome}</span></div>}

              <div className="mensagens">
                {(conv.mensagens||[]).map(m=>(
                  <div key={m.id} className={`msg-wrap ${m.de==='empresa'?'enviada':'recebida'}`}>
                    <div className={`msg-bubble ${m.de==='empresa'?'enviada':'recebida'}`}>
                      {m.tipo==='image'&&m.mediaUrl&&<img src={m.mediaUrl} alt="img" style={{maxWidth:220,borderRadius:8,display:'block',marginBottom:4}}/>}
                      {m.tipo==='audio'&&m.mediaUrl&&<audio controls style={{width:'100%',marginBottom:4}}><source src={m.mediaUrl}/></audio>}
                      {m.tipo==='video'&&m.mediaUrl&&<video controls style={{maxWidth:220,borderRadius:8,display:'block',marginBottom:4}}><source src={m.mediaUrl}/></video>}
                      <div style={{fontSize:13,lineHeight:1.55,whiteSpace:'pre-wrap',wordBreak:'break-word'}}>{m.texto}</div>
                      <div className="msg-hora">{fmtHora(m.at)}</div>
                    </div>
                  </div>
                ))}
                <div ref={msgEndRef}/>
              </div>

              {conv.status!=='finalizado' ? (
                <div className="input-area">
                  <textarea className="msg-input" placeholder="Digite uma mensagem... (Enter para enviar)" value={msgInput} onChange={e=>setMsgInput(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();enviar()}}} rows={1}/>
                  <button onClick={enviar} disabled={enviando||!msgInput.trim()} className="btn-send">
                    {enviando?'⏳':<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>}
                  </button>
                </div>
              ) : (
                <div className="conv-finalizada">
                  ✅ Finalizado{protocolo?` · ${protocolo}`:''} · <button onClick={()=>{setProtocolo(null);mudarStatus('atendendo',{botPausado:true})}} style={{background:'none',border:'none',color:'var(--accent)',cursor:'pointer',fontFamily:'DM Mono,monospace',fontSize:12,textDecoration:'underline'}}>Reabrir</button>
                </div>
              )}
            </>
          ) : null}
        </div>

        {/* SIDEBAR */}
        {conv&&sidebarAberta&&(
          <div className="sidebar-det">
            <div className="sidebar-header">
              <span style={{fontFamily:'Syne,sans-serif',fontWeight:700,fontSize:14,color:'var(--accent)'}}>Detalhes</span>
              <button onClick={()=>setSidebarAberta(false)} className="btn-icon">✕</button>
            </div>
            <div style={{padding:16}}>
              <div className="det-card">
                <Avatar nome={conv.nome} size={48}/>
                <div style={{marginTop:10,textAlign:'center'}}>
                  <div style={{fontWeight:700,fontSize:15,color:'var(--text)'}}>{conv.nome||conv.numero}</div>
                  <div style={{fontSize:12,color:'var(--muted)',marginTop:2}}>📱 {conv.numero}</div>
                  {conv.agenteNome&&<div style={{fontSize:11,color:'#00d4ff',marginTop:4}}>👤 {conv.agenteNome}</div>}
                  {protocolo&&<div style={{fontSize:11,color:'#10b981',marginTop:4,fontWeight:700}}>📋 {protocolo}</div>}
                </div>
              </div>
              <div style={{marginTop:16}}>
                <div className="det-label">🏷️ Tags</div>
                <div style={{display:'flex',flexWrap:'wrap',gap:6,marginTop:8}}>
                  {tagsDisp.map(tag=>{ const ativa=(conv.tags||[]).includes(tag.id); return <button key={tag.id} onClick={()=>toggleTag(tag.id)} style={{padding:'4px 12px',borderRadius:20,fontSize:12,cursor:'pointer',fontFamily:'DM Mono,monospace',fontWeight:ativa?700:400,background:ativa?tag.cor+'25':'var(--surface2)',border:`1.5px solid ${ativa?tag.cor:'var(--border)'}`,color:ativa?tag.cor:'var(--muted)'}}>{tag.label}</button> })}
                </div>
              </div>
              <div style={{marginTop:16}}>
                <div className="det-label">📌 Status</div>
                <div style={{display:'flex',flexDirection:'column',gap:6,marginTop:8}}>
                  {ABAS.map(aba=><button key={aba} onClick={()=>mudarStatus(aba)} style={{padding:'8px 14px',borderRadius:8,fontSize:12,cursor:'pointer',fontFamily:'DM Mono,monospace',textAlign:'left',background:conv.status===aba?STATUS[aba].bg:'var(--surface2)',border:`1.5px solid ${conv.status===aba?STATUS[aba].cor+'55':'var(--border)'}`,color:conv.status===aba?STATUS[aba].cor:'var(--muted)',fontWeight:conv.status===aba?700:400}}>{STATUS[aba].label}</button>)}
                </div>
              </div>
              <div style={{marginTop:16}}>
                <div className="det-label">⚡ Ações Rápidas</div>
                <div style={{display:'flex',flexDirection:'column',gap:8,marginTop:8}}>
                  <button onClick={assumirAtendimento} className="btn-acao-full">🙋 Assumir (pausar bot)</button>
                  <button onClick={()=>setShowTransferir(true)} className="btn-acao-full">🔀 Transferir</button>
                  <button onClick={finalizarComProtocolo} className="btn-acao-full">📋 Finalizar c/ Protocolo</button>
                  <button onClick={()=>{setSidebarAberta(false);setShowCRM(true)}} className="btn-acao-full" style={{color:'#10b981',borderColor:'rgba(16,185,129,.3)'}}>🤝 Abrir no CRM</button>
                  <button onClick={()=>{setMsgInput(`Olá! Aqui é da equipe ${cfg.company||'Vivanexa'}. Como posso ajudá-lo hoje? 😊`);setSidebarAberta(false)}} className="btn-acao-full">👋 Saudação padrão</button>
                  <button onClick={()=>router.push('/chat')} className="btn-acao-full">💬 Gerar Proposta</button>
                </div>
              </div>
              <div style={{marginTop:16,padding:'10px 14px',background:'var(--surface2)',borderRadius:8,fontSize:12,color:'var(--muted)'}}>📊 {(conv.mensagens||[]).length} mensagens</div>
            </div>
          </div>
        )}
      </div>
    </>
  )
}

const CSS = `
  :root{--bg:#0a0f1e;--surface:#111827;--surface2:#1a2540;--border:#1e2d4a;--accent:#00d4ff;--accent2:#7c3aed;--accent3:#10b981;--text:#e2e8f0;--muted:#64748b;--danger:#ef4444;--warning:#f59e0b}
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:'DM Mono',monospace;background:var(--bg);color:var(--text);min-height:100vh}
  @keyframes pulse{0%,100%{opacity:1}50%{opacity:.3}}
  .inbox-wrap{display:flex;height:calc(100vh - 48px);overflow:hidden}
  .conv-list{width:300px;min-width:260px;max-width:320px;display:flex;flex-direction:column;border-right:1px solid var(--border);background:var(--surface);flex-shrink:0;height:100%;overflow:hidden}
  .list-header{padding:14px 16px;display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid var(--border);background:var(--surface2)}
  .busca-wrap{display:flex;align-items:center;gap:8px;padding:10px 12px;border-bottom:1px solid var(--border)}
  .busca-input{flex:1;background:var(--surface2);border:1px solid var(--border);padding:7px 10px;font-family:DM Mono,monospace;font-size:12px;color:var(--text);outline:none;border-radius:8px}
  .busca-input:focus{border-color:var(--accent)}
  .abas-list{display:flex;border-bottom:1px solid var(--border);background:var(--surface2);overflow-x:auto}
  .aba-btn{flex:1;padding:9px 4px;border:none;background:none;color:var(--muted);font-family:DM Mono,monospace;font-size:10px;cursor:pointer;border-bottom:2px solid transparent;position:relative;top:1px;display:flex;align-items:center;justify-content:center;gap:3px;white-space:nowrap;transition:color .2s}
  .aba-btn.ativa{color:var(--accent);border-bottom-color:var(--accent)}
  .aba-count{padding:1px 5px;border-radius:10px;font-size:9px;color:#fff;font-weight:700}
  .conv-items{flex:1;overflow-y:auto}
  .conv-items::-webkit-scrollbar{width:3px}.conv-items::-webkit-scrollbar-thumb{background:var(--border);border-radius:3px}
  .conv-item{display:flex;align-items:flex-start;gap:10px;padding:12px 14px;cursor:pointer;border-bottom:1px solid var(--border);transition:background .15s;position:relative}
  .conv-item:hover{background:var(--surface2)}
  .conv-item.ativa{background:rgba(0,212,255,.06);border-left:3px solid var(--accent)}
  .conv-nome{font-size:13px;font-weight:600;color:var(--text);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  .conv-hora{font-size:10px;color:var(--muted);flex-shrink:0}
  .conv-preview{font-size:11px;color:var(--muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;margin-top:2px}
  .tag-chip{padding:2px 7px;border-radius:10px;font-size:10px;font-weight:600;border:1px solid;white-space:nowrap}
  .badge-naoLidas{position:absolute;top:12px;right:12px;background:#ef4444;color:#fff;font-size:10px;font-weight:700;padding:2px 6px;border-radius:10px;min-width:18px;text-align:center}
  .empty-list{text-align:center;padding:40px 20px;color:var(--muted);font-size:13px}
  .chat-area{flex:1;display:flex;flex-direction:column;height:100%;overflow:hidden;background:var(--bg);min-width:0}
  .chat-vazio{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;color:var(--muted);font-size:13px;padding:40px}
  .chat-header{padding:10px 14px;border-bottom:1px solid var(--border);background:var(--surface2);display:flex;align-items:center;gap:6px;flex-shrink:0;flex-wrap:wrap}
  .mensagens{flex:1;overflow-y:auto;padding:16px;display:flex;flex-direction:column;gap:8px}
  .mensagens::-webkit-scrollbar{width:4px}.mensagens::-webkit-scrollbar-thumb{background:var(--border);border-radius:4px}
  .msg-wrap{display:flex}.msg-wrap.enviada{justify-content:flex-end}.msg-wrap.recebida{justify-content:flex-start}
  .msg-bubble{max-width:68%;padding:10px 14px;border-radius:14px;font-size:13px;line-height:1.6;word-break:break-word}
  .msg-bubble.enviada{background:rgba(0,212,255,.12);border:1px solid rgba(0,212,255,.2);border-bottom-right-radius:4px}
  .msg-bubble.recebida{background:var(--surface);border:1px solid var(--border);border-bottom-left-radius:4px}
  .msg-hora{font-size:10px;color:var(--muted);text-align:right;margin-top:4px}
  .input-area{padding:12px 16px;border-top:1px solid var(--border);display:flex;gap:10px;align-items:flex-end;background:var(--surface2);flex-shrink:0}
  .msg-input{flex:1;background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:10px 14px;font-family:DM Mono,monospace;font-size:13px;color:var(--text);outline:none;resize:none;min-height:42px;max-height:100px;line-height:1.5}
  .msg-input:focus{border-color:var(--accent)}
  .btn-send{width:42px;height:42px;border-radius:12px;background:linear-gradient(135deg,#00d4ff,#0099bb);border:none;color:#fff;cursor:pointer;display:flex;align-items:center;justify-content:center;flex-shrink:0;transition:all .2s}
  .btn-send:hover:not(:disabled){box-shadow:0 0 16px rgba(0,212,255,.4);transform:translateY(-1px)}
  .btn-send:disabled{opacity:.5;cursor:not-allowed}
  .conv-finalizada{padding:12px 16px;text-align:center;font-size:12px;color:var(--muted);border-top:1px solid var(--border);background:var(--surface2);flex-shrink:0}
  .sidebar-det{width:250px;min-width:220px;border-left:1px solid var(--border);background:var(--surface);overflow-y:auto;flex-shrink:0;height:100%}
  .sidebar-header{padding:14px 16px;display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid var(--border);background:var(--surface2)}
  .det-card{background:var(--surface2);border:1px solid var(--border);border-radius:12px;padding:16px;display:flex;flex-direction:column;align-items:center}
  .det-label{font-size:10px;color:var(--muted);letter-spacing:1.5px;text-transform:uppercase}
  .btn-primary{padding:10px 20px;border-radius:10px;background:linear-gradient(135deg,#00d4ff,#0099bb);border:none;color:#fff;font-family:DM Mono,monospace;font-size:13px;font-weight:600;cursor:pointer}
  .btn-icon{background:none;border:1px solid var(--border);color:var(--muted);padding:6px 10px;border-radius:8px;cursor:pointer;font-size:14px;transition:all .15s;flex-shrink:0}
  .btn-icon:hover{color:var(--accent);border-color:rgba(0,212,255,.3)}
  .btn-back{display:none;background:none;border:none;color:var(--muted);font-size:20px;cursor:pointer;padding:4px 8px}
  .btn-acao{padding:5px 10px;border-radius:8px;font-family:DM Mono,monospace;font-size:11px;font-weight:600;cursor:pointer;border:1.5px solid;transition:all .15s;flex-shrink:0;white-space:nowrap}
  .btn-acao.verde{background:rgba(16,185,129,.12);border-color:rgba(16,185,129,.35);color:#10b981}
  .btn-acao.amarelo{background:rgba(245,158,11,.12);border-color:rgba(245,158,11,.35);color:#f59e0b}
  .btn-acao.cinza{background:rgba(100,116,139,.12);border-color:rgba(100,116,139,.3);color:#64748b}
  .btn-acao-full{width:100%;padding:9px 14px;border-radius:8px;background:var(--surface2);border:1px solid var(--border);color:var(--muted);font-family:DM Mono,monospace;font-size:12px;cursor:pointer;text-align:left;transition:all .15s}
  .btn-acao-full:hover{color:var(--accent);border-color:rgba(0,212,255,.3)}
  @media(max-width:768px){
    .conv-list{width:100%!important;max-width:100%!important;position:absolute;inset:0;z-index:1}
    .chat-area{position:absolute;inset:0;z-index:10;display:none}
    .chat-area.aberta{display:flex}
    .btn-back{display:block}
    .sidebar-det{display:none}
  }
`
