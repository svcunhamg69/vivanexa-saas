// pages/crm.js
const DIAS_PARADO_ALERTA = 3 — CRM Vivanexa v4
// Melhorias: Google Agenda em Reunião + Player gravação 3CX + Aba Documentos + Permissões atualizadas
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
const EMPTY_NEG  = { id:'',titulo:'',etapa:'lead',nome:'',fantasia:'',cnpj:'',cpf:'',email:'',telefone:'',endereco:'',cep:'',bairro:'',cidade:'',uf:'',responsavel:'',adesao:'',mensalidade:'',modulos:'',observacoes:'',origem:'manual',criadoEm:'',atualizadoEm:'' }
const EMPTY_ATIV = { id:'',negocioId:'',tipo:'Ligação',descricao:'',prazo:'',concluida:false,criadoEm:'',google_event_id:'',google_link:'',duracao_seg:0,gravacao_url:'' }
const EMPTY_CLI  = { id:'',doc:'',fantasia:'',razao:'',contato:'',email:'',tel:'',cep:'',end:'',numero:'',complemento:'',bairro:'',cidade:'',uf:'',cpfContato:'',regime:'',rimpNome:'',rimpEmail:'',rimpTel:'',rfinNome:'',rfinEmail:'',rfinTel:'',updatedAt:'' }

const fmt    = n => (!n&&n!==0)?'—':'R$ '+Number(n).toLocaleString('pt-BR',{minimumFractionDigits:2})
const fmtDoc = s => { if(!s)return''; const d=s.replace(/\D/g,''); if(d.length===14)return d.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/,'$1.$2.$3/$4-$5'); if(d.length===11)return d.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/,'$1.$2.$3-$4'); return s }
const fmtCEP = s => { if(!s)return''; const d=s.replace(/\D/g,''); return d.length===8?d.replace(/^(\d{5})(\d{3})$/,'$1-$2'):s }
const fmtDT  = s => { if(!s)return'—'; try{ return new Date(s).toLocaleString('pt-BR',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'}) }catch{return s} }
const hoje   = () => new Date().toISOString().slice(0,10)
const isAtrasada = a => !a.concluida&&!!a.prazo&&new Date(a.prazo)<new Date()
const isHoje     = a => !a.concluida&&!!a.prazo&&a.prazo.slice(0,10)===hoje()
const isFutura   = a => !a.concluida&&!!a.prazo&&new Date(a.prazo)>new Date()&&a.prazo.slice(0,10)!==hoje()

// ── Click2Call 3CX ─────────────────────────────────
function click2call(numero, cfg3cx) {
  if (!numero) return
  const tel = String(numero).replace(/\D/g, '')
  if (!tel) return
  const modo = cfg3cx?.modo || 'tel'
  if (modo === 'tel') { window.open(`tel:${tel}`, '_self'); return }
  if (modo === '3cx_web') {
    const host = cfg3cx?.host || ''
    if (!host) { alert('Configure o Host 3CX em Config → Integrações → Telefonia'); return }
    window.open(`https://${host}/webclient/#/call?phone=${tel}`, '_blank'); return
  }
  if (modo === '3cx_api') {
    const host=cfg3cx?.host||'', token3cx=cfg3cx?.token||'', ramal=cfg3cx?.ramal||''
    if (!host||!token3cx||!ramal) { alert('Configure Host, Token e Ramal 3CX em Config → Integrações → Telefonia'); return }
    fetch(`https://${host}/callcontrol/calls`,{method:'POST',headers:{'Authorization':`Bearer ${token3cx}`,'Content-Type':'application/json'},body:JSON.stringify({from:ramal,to:tel,callType:'pstn'})})
      .then(r=>{ if(!r.ok)alert('Erro ao iniciar chamada via 3CX API') }).catch(()=>alert('Erro de conexão com 3CX'))
  }
}

// ── Google Calendar: criar/atualizar evento ─────────────────────
async function criarEventoGCal(atividade, negocio, accessToken) {
  const prazoDate = atividade.prazo ? new Date(atividade.prazo) : new Date()
  const endDate   = new Date(prazoDate.getTime() + 60 * 60 * 1000)
  const titulo = `Reunião: ${negocio?.titulo || negocio?.fantasia || negocio?.nome || 'Lead'}`
  const descricao = [atividade.descricao||'', negocio?.email?`E-mail: ${negocio.email}`:'', negocio?.telefone?`Fone: ${negocio.telefone}`:''].filter(Boolean).join('\n')
  const event = {
    summary: titulo, description: descricao,
    start: { dateTime: prazoDate.toISOString(), timeZone: 'America/Sao_Paulo' },
    end:   { dateTime: endDate.toISOString(),   timeZone: 'America/Sao_Paulo' },
    reminders: { useDefault: false, overrides: [{ method: 'popup', minutes: 30 }] },
  }
  const url = atividade.google_event_id
    ? `https://www.googleapis.com/calendar/v3/calendars/primary/events/${atividade.google_event_id}`
    : 'https://www.googleapis.com/calendar/v3/calendars/primary/events'
  const method = atividade.google_event_id ? 'PATCH' : 'POST'
  const res = await fetch(url, {
    method,
    headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(event),
  })
  if (!res.ok) { const e = await res.json(); throw new Error(e.error?.message || 'Erro Google Calendar') }
  const created = await res.json()
  return { google_event_id: created.id, google_link: created.htmlLink }
}

async function syncGCal(atividade, negocio, cfg, userId, setStatus) {
  setStatus('🔄 Verificando token Google...')
  // Buscar token salvo
  let token = null
  try {
    const { data } = await supabase.from('vx_storage').select('value').eq('key', `gcal_token:${userId}`).maybeSingle()
    if (data?.value) token = JSON.parse(data.value)
  } catch {}

  // Verificar expiração
  if (token && token.obtained_at && token.expires_in) {
    const expAt = token.obtained_at + (token.expires_in - 60) * 1000
    if (Date.now() > expAt && token.refresh_token) {
      setStatus('🔄 Renovando acesso...')
      try {
        const clientId = cfg.googleClientId || ''
        const clientSecret = cfg.googleClientSecret || ''
        if (clientId && clientSecret) {
          const r = await fetch('https://oauth2.googleapis.com/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({ refresh_token: token.refresh_token, client_id: clientId, client_secret: clientSecret, grant_type: 'refresh_token' }),
          })
          if (r.ok) {
            const nt = await r.json()
            token = { ...token, ...nt, obtained_at: Date.now() }
            await supabase.from('vx_storage').upsert({ key: `gcal_token:${userId}`, value: JSON.stringify(token), updated_at: new Date().toISOString() }, { onConflict: 'key' })
          }
        }
      } catch {}
    }
  }

  // Sem token: iniciar OAuth
  if (!token?.access_token) {
    const clientId = cfg.googleClientId || ''
    if (!clientId) throw new Error('Configure o Google Client ID em Configurações → Integrações → Google Agenda')
    const redirectUri = `${window.location.origin}/api/auth/google/callback`
    const scope = encodeURIComponent('https://www.googleapis.com/auth/calendar.events')
    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${encodeURIComponent(clientId)}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=${scope}&access_type=offline&prompt=consent&state=${encodeURIComponent(userId)}`
    setStatus('🔐 Abrindo autenticação Google...')
    const popup = window.open(authUrl, 'gcal_auth', 'width=520,height=640,left=200,top=100')
    if (!popup) throw new Error('Popup bloqueado. Permita popups para este site.')
    token = await new Promise((resolve, reject) => {
      const to = setTimeout(() => { window.removeEventListener('message', h); reject(new Error('Timeout de autenticação')) }, 120000)
      function h(e) { if (e.data?.type !== 'GCAL_TOKEN') return; clearTimeout(to); window.removeEventListener('message', h); resolve(e.data.token) }
      window.addEventListener('message', h)
      const ci = setInterval(() => { if (popup.closed) { clearInterval(ci); clearTimeout(to); window.removeEventListener('message', h); reject(new Error('Janela fechada pelo usuário')) } }, 500)
    })
    await supabase.from('vx_storage').upsert({ key: `gcal_token:${userId}`, value: JSON.stringify({ ...token, obtained_at: Date.now() }), updated_at: new Date().toISOString() }, { onConflict: 'key' })
  }

  setStatus(atividade.google_event_id ? '🔄 Atualizando evento...' : '📅 Criando evento...')
  const result = await criarEventoGCal(atividade, negocio, token.access_token)
  setStatus('✅ Sincronizado com Google Agenda!')
  return result
}

// ── APIs externas ──────────────────────────────────
async function fetchCNPJDados(cnpj) {
  try {
    const r = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cnpj.replace(/\D/g,'')}`)
    if(!r.ok) return null
    const d = await r.json()
    const f = (d.ddd_telefone_1||d.ddd_telefone_2||'').replace(/\D/g,'')
    const cep = (d.cep||'').replace(/\D/g,'')
    return {
      razao:d.razao_social||'', fantasia:d.nome_fantasia||d.razao_social||'', email:d.email||'',
      tel:f.length>=10?`(${f.slice(0,2)}) ${f.slice(2)}`:'', cidade:d.municipio||'', uf:d.uf||'',
      cep, end:[d.descricao_tipo_logradouro,d.logradouro].filter(Boolean).join(' '),
      numero:d.numero&&d.numero!=='S/N'?d.numero:'', complemento:d.complemento||'', bairro:d.bairro||'',
      nome:d.razao_social||'', endereco:[d.descricao_tipo_logradouro,d.logradouro,d.numero,d.bairro].filter(Boolean).join(' '),
      telefone:f.length>=10?`(${f.slice(0,2)}) ${f.slice(2)}`:'',
    }
  } catch { return null }
}

async function fetchCEPDados(cep) {
  try {
    const r = await fetch(`https://viacep.com.br/ws/${cep.replace(/\D/g,'')}/json/`)
    if(!r.ok) return null
    const d = await r.json()
    if(d.erro) return null
    return { end:d.logradouro||'', bairro:d.bairro||'', cidade:d.localidade||'', uf:d.uf||'' }
  } catch { return null }
}

// ── Componente principal ────────────────────────────
export default function CRM() {
  const router = useRouter()
  const [loading,      setLoading]      = useState(true)
  const [cfg,          setCfg]          = useState({})
  const [empresaId,    setEmpresaId]    = useState(null)
  const [perfil,       setPerfil]       = useState(null)
  const [negocios,     setNegocios]     = useState([])
  const [atividades,   setAtividades]   = useState([])
  const [clientes,     setClientes]     = useState([])
  const [documentos,   setDocumentos]   = useState([])
  const [etapas,       setEtapas]       = useState(ETAPAS_PADRAO)
  const [funis,        setFunis]        = useState([]) // lista de funis {id,nome,etapas}
  const [funilAtivo,   setFunilAtivo]   = useState(null) // id do funil ativo
  const [showFunisMgr, setShowFunisMgr] = useState(false) // modal gerenciar funis
  const [formFunil,    setFormFunil]    = useState({id:'',nome:'',etapas:[]})
  const [showEmailModal, setShowEmailModal] = useState(false)
  const [emailDest,    setEmailDest]    = useState('')
  const [emailAssunto, setEmailAssunto] = useState('')
  const [emailCorpo,   setEmailCorpo]   = useState('')
  const [emailSending, setEmailSending] = useState(false)
  const [visao,        setVisao]        = useState('funil')
  const [cfg3cx,       setCfg3cx]       = useState({})
  const [negSel,       setNegSel]       = useState(null)
  const [abaDetalhe,   setAbaDetalhe]   = useState('atividades') // atividades | documentos
  const [showFormNeg,  setShowFormNeg]  = useState(false)
  const [formNeg,      setFormNeg]      = useState({...EMPTY_NEG})
  const [showFormAtiv, setShowFormAtiv] = useState(false)
  const [formAtiv,     setFormAtiv]     = useState({...EMPTY_ATIV})
  const [showFormCli,  setShowFormCli]  = useState(false)
  const [formCli,      setFormCli]      = useState({...EMPTY_CLI})
  const [cliSel,       setCliSel]       = useState(null)
  const [busca,        setBusca]        = useState('')
  const [buscaCli,     setBuscaCli]     = useState('')
  const [filtroEtapa,  setFiltroEtapa]  = useState('todas')
  const [filtroAtiv,   setFiltroAtiv]   = useState('todas')
  const [buscandoCNPJ, setBuscandoCNPJ] = useState(false)
  const [buscandoCNPJCli, setBuscandoCNPJCli] = useState(false)
  const [buscandoCEP,  setBuscandoCEP]  = useState(false)
  const [cnpjMsg,      setCnpjMsg]      = useState('')
  const [saving,       setSaving]       = useState(false)
  const [toast,        setToast]        = useState('')
  const [dragging,     setDragging]     = useState(null)
  const [dragOver,     setDragOver]     = useState(null)
  const [gcalStatus,   setGcalStatus]   = useState('')
  const [gcalLoading,  setGcalLoading]  = useState(false)
  const [docViewer,    setDocViewer]    = useState(null) // HTML a exibir no viewer
  const [playerAberto, setPlayerAberto] = useState({}) // {[ativId]: bool}
  const dragNode = useRef(null)

  useEffect(() => {
    async function init() {
      const { data:{ session } } = await supabase.auth.getSession()
      if(!session){ router.replace('/'); return }
      let { data: perf } = await supabase.from('perfis').select('*').eq('user_id',session.user.id).maybeSingle()
      if(!perf){ const nm=session.user.email?.split('@')[0]||'Usuário'; const{data:np}=await supabase.from('perfis').insert({user_id:session.user.id,nome:nm,email:session.user.email,empresa_id:session.user.id,perfil:'admin'}).select().single(); perf=np }
      setPerfil(perf)
      const eid = perf?.empresa_id||session.user.id; setEmpresaId(eid)
      const{data:row}=await supabase.from('vx_storage').select('value').eq('key',`cfg:${eid}`).maybeSingle()
      if(row?.value){
        const c=JSON.parse(row.value)
        setCfg(c); setNegocios(c.crm_negocios||[]); setAtividades(c.crm_atividades||[])
        setClientes(c.clients||[]); setDocumentos(c.crm_documentos||[])
        if(c.crm_etapas?.length)setEtapas(c.crm_etapas)
        if(c.tel3cx)setCfg3cx(c.tel3cx)
        // Carrega funis — se não tiver, cria o funil padrão
        if(c.crm_funis?.length){
          setFunis(c.crm_funis)
          setFunilAtivo(c.crm_funilAtivo||c.crm_funis[0]?.id||null)
          const fa=c.crm_funis.find(f=>f.id===(c.crm_funilAtivo||c.crm_funis[0]?.id))
          if(fa?.etapas?.length)setEtapas(fa.etapas)
        }else{
          // Cria funil padrão a partir das etapas existentes
          const funilPadrao={id:'funil_1',nome:'Funil Principal',etapas:c.crm_etapas||ETAPAS_PADRAO}
          setFunis([funilPadrao]);setFunilAtivo('funil_1')
        }
      }
      setLoading(false)
    }
    init()
  },[router])

  const save = async nc => {
    await supabase.from('vx_storage').upsert({key:`cfg:${empresaId}`,value:JSON.stringify(nc),updated_at:new Date().toISOString()},{onConflict:'key'})
  }
  const showToast = msg => { setToast(msg); setTimeout(()=>setToast(''),3500) }

  // ── Funis ─────────────────────────────────────────
  const [showAgente,   setShowAgente]   = useState(false)
  const [agenteLog,    setAgenteLog]    = useState([])
  const [agenteRodando,setAgenteRodando]= useState('')

  async function rodarAgente(acao, negocioId) {
    if (!empresaId) return
    setAgenteRodando(acao)
    try {
      const resp = await fetch('/api/agente-followup', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ acao, empresaId, negocioId })
      })
      const r = await resp.json()
      if (r.ok) {
        showToast(acao === 'briefing_diario' ? '✅ Briefing enviado!' : `✅ Follow-up concluído! ${r.resultados?.length || 0} enviados.`)
        setAgenteLog(prev => [{ acao, data: new Date().toLocaleString('pt-BR'), ...r }, ...prev.slice(0, 9)])
        // Recarrega negocios
        const nc = await getCfgFresh()
        if (nc?.crm_negocios) setNegocios(nc.crm_negocios)
      } else showToast('❌ ' + (r.erro || r.error))
    } catch { showToast('❌ Erro ao chamar agente') }
    setAgenteRodando('')
  }

  async function getCfgFresh() {
    const { data } = await supabase.from('vx_storage').select('value').eq('key', `cfg:${empresaId}`).single()
    return data?.value ? JSON.parse(data.value) : null
  }
    const novo={...f,id:f.id||'funil_'+Date.now()}
    const lista=f.id?funis.map(x=>x.id===f.id?novo:x):[...funis,novo]
    setFunis(lista)
    const nc={...cfg,crm_funis:lista,crm_funilAtivo:funilAtivo||novo.id}
    await save(nc);setCfg(nc);showToast('✅ Funil salvo!')
  }

  async function excluirFunil(id) {
    if(funis.length<=1){showToast('⚠️ Precisa ter ao menos 1 funil.');return}
    if(!confirm('Excluir este funil?'))return
    const lista=funis.filter(f=>f.id!==id)
    setFunis(lista)
    const novoAtivo=lista[0]?.id||null;setFunilAtivo(novoAtivo)
    if(lista[0]?.etapas?.length)setEtapas(lista[0].etapas)
    const nc={...cfg,crm_funis:lista,crm_funilAtivo:novoAtivo};await save(nc);setCfg(nc);showToast('🗑 Funil removido!')
  }

  function trocarFunil(id) {
    setFunilAtivo(id)
    const f=funis.find(x=>x.id===id)
    if(f?.etapas?.length)setEtapas(f.etapas)
    const nc={...cfg,crm_funilAtivo:id};setCfg(nc)
    save(nc)
  }

  const [emailAnexos,  setEmailAnexos]  = useState([]) // [{filename, content (base64), contentType, size}]

  async function adicionarAnexo(e) {
    const files = Array.from(e.target.files)
    for (const file of files) {
      if (file.size > 10 * 1024 * 1024) { showToast('⚠️ Arquivo maior que 10MB ignorado: ' + file.name); continue }
      const b64 = await new Promise(res => {
        const r = new FileReader()
        r.onload = () => res(r.result.split(',')[1])
        r.readAsDataURL(file)
      })
      setEmailAnexos(prev => [...prev, { filename: file.name, content: b64, contentType: file.type, size: file.size }])
    }
    e.target.value = ''
  }

  // ── Email ────────────────────────────────────────
  async function enviarEmail() {
    if(!emailDest||!emailAssunto){showToast('⚠️ Preencha destinatário e assunto.');return}
    setEmailSending(true)
    try{
      const smtpCfg=cfg.smtpHost?{smtpHost:cfg.smtpHost,smtpPort:cfg.smtpPort||587,smtpUser:cfg.smtpUser,smtpPass:cfg.smtpPass,nomeRemetente:cfg.company||'Vivanexa'}:null
      const resp=await fetch('/api/send-email',{method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({to:emailDest,subject:emailAssunto,html:`<div style="font-family:Arial,sans-serif;white-space:pre-wrap">${emailCorpo.replace(/\n/g,'<br>')}</div>`,config:smtpCfg,attachments:emailAnexos})})
      const r=await resp.json()
      if(r.success&&!r.fallback){showToast('✅ Email enviado!');setShowEmailModal(false);setEmailDest('');setEmailAssunto('');setEmailCorpo('');setEmailAnexos([])}
      else if(r.fallback){
        // Abre cliente de email local como fallback
        window.location.href=`mailto:${emailDest}?subject=${encodeURIComponent(emailAssunto)}&body=${encodeURIComponent(emailCorpo)}`
        setShowEmailModal(false)
      }
      else showToast('❌ Erro: '+r.error)
    }catch(e){showToast('❌ Erro ao enviar email')}
    setEmailSending(false)
  }

  // ── Negócios ─────────────────────────────────────
  async function salvarNeg() {
    if(!formNeg.titulo.trim()){ alert('Informe o título.'); return }
    setSaving(true)
    const now=new Date().toISOString()
    const novo={...formNeg,id:formNeg.id||'neg_'+Date.now(),criadoEm:formNeg.criadoEm||now,atualizadoEm:now}
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

  // ── Atividades ────────────────────────────────────
  async function salvarAtiv() {
    if(!formAtiv.descricao.trim()){ alert('Informe a descrição.'); return }
    setSaving(true)
    const now=new Date().toISOString()
    const nova={...formAtiv,id:formAtiv.id||'atv_'+Date.now(),criadoEm:formAtiv.criadoEm||now}
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

  // ── Google Agenda ─────────────────────────────────
  async function handleSyncGCal() {
    if(!formAtiv.prazo){ alert('Defina a data/hora antes de sincronizar.'); return }
    setGcalLoading(true); setGcalStatus('')
    try {
      const result = await syncGCal(formAtiv, negSel, cfg, perfil?.user_id||empresaId, setGcalStatus)
      setFormAtiv(f=>({...f, google_event_id: result.google_event_id, google_link: result.google_link }))
    } catch(err) {
      setGcalStatus(`❌ ${err.message}`)
    }
    setGcalLoading(false)
  }

  // ── Clientes ──────────────────────────────────────
  async function salvarCliente() {
    const data = { ...formCli }
    if(!data.doc&&!data.fantasia&&!data.razao){ alert('Informe ao menos o CNPJ/CPF ou o nome.'); return }
    setSaving(true)
    const now = new Date().toLocaleDateString('pt-BR')
    if(!data.id) {
      if(data.doc && clientes.find(c=>c.doc===data.doc.replace(/\D/g,''))) { alert('Já existe um cliente com este CNPJ/CPF.'); setSaving(false); return }
      data.id = 'cli_'+Date.now(); data.doc = data.doc.replace(/\D/g,''); data.updatedAt = now
      const lista = [...clientes, data]
      const nc = {...cfg, clients: lista}; await save(nc); setClientes(lista); setCfg(nc)
    } else {
      data.doc = data.doc.replace(/\D/g,''); data.updatedAt = now
      const lista = clientes.map(c=>c.id===data.id?data:c)
      const nc = {...cfg, clients: lista}; await save(nc); setClientes(lista); setCfg(nc)
    }
    setShowFormCli(false); setFormCli({...EMPTY_CLI}); setCnpjMsg(''); setSaving(false); showToast('✅ Cliente salvo!')
  }

  async function excluirCliente(id) {
    if(!confirm('Excluir este cliente?'))return
    const lista = clientes.filter(c=>c.id!==id)
    const nc = {...cfg, clients: lista}; await save(nc); setClientes(lista); setCfg(nc)
    if(cliSel?.id===id) setCliSel(null)
    showToast('🗑 Cliente removido!')
  }

  async function buscarCNPJNeg() {
    const cnpj=formNeg.cnpj.replace(/\D/g,''); if(cnpj.length!==14){alert('CNPJ inválido.');return}
    setBuscandoCNPJ(true); const d=await fetchCNPJDados(cnpj)
    if(d) setFormNeg(f=>({...f,...d})); else alert('CNPJ não encontrado.')
    setBuscandoCNPJ(false); showToast(d?'✅ CNPJ carregado!':'❌ Não encontrado')
  }

  async function buscarCNPJCli() {
    const cnpj = formCli.doc.replace(/\D/g,'')
    if(cnpj.length!==14){ setCnpjMsg('⚠️ CNPJ inválido.'); return }
    setBuscandoCNPJCli(true); setCnpjMsg('⏳ Consultando Receita Federal...')
    const local = clientes.find(c=>c.doc===cnpj)
    if(local) { setFormCli(f=>({...f,...local})); setCnpjMsg('✅ Dados encontrados na base local!'); setBuscandoCNPJCli(false); return }
    const d = await fetchCNPJDados(cnpj)
    if(d) {
      setFormCli(f=>({...f, razao:f.razao||d.razao, fantasia:f.fantasia||d.fantasia, email:f.email||d.email, tel:f.tel||d.tel, cep:f.cep||d.cep, end:f.end||d.end, numero:f.numero||d.numero, complemento:f.complemento||d.complemento, bairro:f.bairro||d.bairro, cidade:f.cidade||d.cidade, uf:f.uf||d.uf }))
      setCnpjMsg('✅ Dados da Receita Federal carregados!')
      if(d.cep && !d.end) { const ce = await fetchCEPDados(d.cep); if(ce) setFormCli(f=>({...f,...ce})) }
    } else { setCnpjMsg('❌ CNPJ não localizado na Receita Federal.') }
    setBuscandoCNPJCli(false)
  }

  async function buscarCEPCli() {
    const cep = formCli.cep.replace(/\D/g,'')
    if(cep.length!==8){ return }
    setBuscandoCEP(true)
    const d = await fetchCEPDados(cep)
    if(d) setFormCli(f=>({...f, end:f.end||d.end, bairro:f.bairro||d.bairro, cidade:f.cidade||d.cidade, uf:f.uf||d.uf}))
    setBuscandoCEP(false)
  }

  // ── DnD ──────────────────────────────────────────
  function onDragStart(e,neg){ setDragging(neg.id); dragNode.current=e.target; setTimeout(()=>{ if(dragNode.current)dragNode.current.style.opacity='0.4' },0) }
  function onDragEnd(){ if(dragNode.current)dragNode.current.style.opacity='1'; setDragging(null); setDragOver(null) }
  function onDragOver(e,id){ e.preventDefault(); setDragOver(id) }
  function onDrop(e,id){ e.preventDefault(); if(dragging)moverEtapa(dragging,id); setDragging(null); setDragOver(null) }

  // ── Filtros ───────────────────────────────────────
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
  const cliFiltrados = clientes.filter(c => {
    if(!buscaCli.trim()) return true
    const q = buscaCli.toLowerCase()
    return (c.fantasia||'').toLowerCase().includes(q)||(c.razao||'').toLowerCase().includes(q)||(c.doc||'').includes(q)||(c.email||'').toLowerCase().includes(q)||(c.cidade||'').toLowerCase().includes(q)
  })
  const atrasadas  = atividades.filter(isAtrasada).length
  const parHoje    = atividades.filter(isHoje).length
  const parFutura  = atividades.filter(isFutura).length
  const ativsDeNeg = id => atividades.filter(a=>a.negocioId===id).sort((a,b)=>new Date(b.criadoEm)-new Date(a.criadoEm))
  const docsDeNeg  = id => documentos.filter(d=>d.negocioId===id).sort((a,b)=>new Date(b.criadoEm)-new Date(a.criadoEm))

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
        .kb-col{min-width:230px;width:230px;flex-shrink:0}
        .neg-card{background:var(--surface);border:1px solid var(--border);border-radius:10px;padding:12px 14px;margin-bottom:8px;cursor:grab;transition:box-shadow .2s,border-color .2s,transform .15s}
        .neg-card:hover{box-shadow:0 6px 20px rgba(0,0,0,.4);transform:translateY(-1px)}
        .neg-card:active{cursor:grabbing;transform:translateY(0)}
        .drop-ok{background:rgba(0,212,255,.04);border:1px dashed rgba(0,212,255,.35)!important;border-radius:8px}
        .tl-item{display:flex;gap:12px;margin-bottom:16px;position:relative}
        .tl-dot{width:10px;height:10px;border-radius:50%;flex-shrink:0;margin-top:4px}
        .tl-line{position:absolute;left:4px;top:14px;bottom:-16px;width:2px;background:var(--border)}
        .cli-row{display:flex;align-items:center;gap:10px;padding:12px 14px;background:var(--surface);border:1px solid var(--border);border-radius:10px;margin-bottom:8px;transition:border-color .2s}
        .cli-row:hover{border-color:rgba(0,212,255,.3)}
        input:focus,textarea:focus,select:focus{border-color:var(--accent)!important;outline:none}
        audio{accent-color:#00d4ff}
      `}</style>

      {toast&&<div style={{position:'fixed',bottom:28,left:'50%',transform:'translateX(-50%)',background:'rgba(16,185,129,.92)',color:'#fff',padding:'11px 22px',borderRadius:10,fontFamily:'DM Mono',fontSize:14,zIndex:9999,whiteSpace:'nowrap'}}>{toast}</div>}

      {/* ── Viewer de documento ── */}
      {docViewer&&(
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,.88)',zIndex:3000,overflow:'auto',padding:24}}>
          <div style={{maxWidth:860,margin:'0 auto'}}>
            <div style={{display:'flex',gap:10,justifyContent:'flex-end',marginBottom:12}}>
              <button onClick={()=>{const w=window.open('','_blank');w.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"></head><body style="margin:0;padding:20px;background:#f0f4f8">${docViewer.html}</body></html>`);w.document.close()}}
                style={{padding:'8px 14px',borderRadius:8,background:'rgba(124,58,237,.15)',border:'1px solid rgba(124,58,237,.35)',color:'#7c3aed',fontSize:12,cursor:'pointer',fontFamily:'DM Mono,monospace'}}>🖨 Imprimir</button>
              <button onClick={()=>setDocViewer(null)}
                style={{padding:'8px 16px',borderRadius:8,background:'#1e2d4a',border:'1px solid #334155',color:'#e2e8f0',cursor:'pointer',fontSize:13,fontFamily:'DM Mono,monospace'}}>✕ Fechar</button>
            </div>
            <div style={{background:'#fff',borderRadius:12,padding:32,boxShadow:'0 8px 40px rgba(0,0,0,.3)'}} dangerouslySetInnerHTML={{__html:docViewer.html}}/>
          </div>
        </div>
      )}

      <Navbar cfg={cfg} perfil={perfil} />

      <main style={{padding:'20px 20px 60px'}}>

        {/* ── Barra de visão ── */}
        <div style={{display:'flex',gap:8,marginBottom:20,flexWrap:'wrap',alignItems:'center'}}>
          {[['funil','🗂️ Funil de Vendas'],['atividades','📅 Atividades'],['clientes','👥 Clientes']].map(([v,l])=>(            <button key={v} onClick={()=>{setVisao(v);setNegSel(null);setCliSel(null)}}
              style={{padding:'9px 16px',borderRadius:9,border:`1.5px solid ${visao===v&&!negSel?'var(--accent)':'var(--border)'}`,background:visao===v&&!negSel?'rgba(0,212,255,.12)':'var(--surface2)',color:visao===v&&!negSel?'var(--accent)':'var(--muted)',fontFamily:'DM Mono,monospace',fontSize:13,cursor:'pointer',fontWeight:visao===v&&!negSel?700:400}}>
              {l}
            </button>
          ))}

          {/* Seletor de Funis */}
          {visao==='funil'&&!negSel&&funis.length>0&&(
            <div style={{display:'flex',gap:6,alignItems:'center',marginLeft:8,paddingLeft:8,borderLeft:'1px solid var(--border)'}}>
              {funis.map(f=>(
                <button key={f.id} onClick={()=>trocarFunil(f.id)}
                  style={{padding:'6px 13px',borderRadius:8,border:`1.5px solid ${funilAtivo===f.id?'var(--accent2)':'var(--border)'}`,background:funilAtivo===f.id?'rgba(124,58,237,.15)':'var(--surface2)',color:funilAtivo===f.id?'#a78bfa':'var(--muted)',fontFamily:'DM Mono,monospace',fontSize:12,cursor:'pointer',fontWeight:funilAtivo===f.id?700:400}}>
                  {f.nome}
                </button>
              ))}
              <button onClick={()=>{setFormFunil({id:'',nome:'',etapas:etapas});setShowFunisMgr(true)}}
                style={{padding:'6px 11px',borderRadius:8,border:'1.5px dashed var(--border)',background:'transparent',color:'var(--muted)',fontFamily:'DM Mono,monospace',fontSize:11,cursor:'pointer'}}>
                ⚙️ Funis
              </button>
            </div>
          )}

          <button onClick={()=>setShowAgente(true)}
            style={{marginLeft:'auto',padding:'9px 16px',borderRadius:9,border:'1.5px solid rgba(16,185,129,.4)',background:'rgba(16,185,129,.08)',color:'#10b981',fontFamily:'DM Mono,monospace',fontSize:13,cursor:'pointer',fontWeight:600,display:'flex',alignItems:'center',gap:6}}>
            🤖 Agente IA
          </button>
          <div style={{marginLeft:'auto',display:'flex',gap:8}}>
            {visao==='clientes' ? (
              <>
                <input value={buscaCli} onChange={e=>setBuscaCli(e.target.value)} placeholder="🔍 Buscar cliente..." style={{background:'var(--surface2)',border:'1px solid var(--border)',borderRadius:8,padding:'8px 12px',fontFamily:'DM Mono,monospace',fontSize:12,color:'var(--text)',outline:'none',width:200}}/>
                <button onClick={()=>{setFormCli({...EMPTY_CLI,id:''});setCnpjMsg('');setShowFormCli(true)}}
                  style={{padding:'9px 18px',borderRadius:9,background:'linear-gradient(135deg,var(--accent),#0099bb)',border:'none',color:'#fff',fontFamily:'DM Mono,monospace',fontSize:13,fontWeight:600,cursor:'pointer',whiteSpace:'nowrap'}}>+ Novo Cliente</button>
              </>
            ) : (
              <>
                <input value={busca} onChange={e=>setBusca(e.target.value)} placeholder="🔍 Buscar..." style={{background:'var(--surface2)',border:'1px solid var(--border)',borderRadius:8,padding:'8px 12px',fontFamily:'DM Mono,monospace',fontSize:12,color:'var(--text)',outline:'none',width:180}}/>
                <button onClick={()=>{setFormNeg({...EMPTY_NEG});setShowFormNeg(true)}}
                  style={{padding:'9px 18px',borderRadius:9,background:'linear-gradient(135deg,var(--accent),#0099bb)',border:'none',color:'#fff',fontFamily:'DM Mono,monospace',fontSize:13,fontWeight:600,cursor:'pointer',whiteSpace:'nowrap'}}>+ Novo Negócio</button>
              </>
            )}
          </div>
        </div>

        {/* ── KPIs globais ── */}
        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(130px,1fr))',gap:10,marginBottom:20}}>
          {[
            {l:'Total Negócios',v:negocios.length,c:'var(--accent)'},
            {l:'Propostas',v:negocios.filter(n=>n.etapa==='proposta_enviada').length,c:'var(--accent2)'},
            {l:'Fechamentos',v:negocios.filter(n=>n.etapa==='fechamento').length,c:'var(--accent3)'},
            {l:'⚠️ Atrasadas',v:atrasadas,c:'var(--danger)'},
            {l:'📅 Hoje',v:parHoje,c:'var(--warning)'},
            {l:'🔜 Futuras',v:parFutura,c:'var(--accent)'},
            {l:'Adesão Total',v:fmt(negocios.filter(n=>n.etapa==='fechamento').reduce((a,n)=>a+(Number(n.adesao)||0),0)),c:'var(--gold)'},
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

              {/* Dados do cliente */}
              <div style={{background:'var(--surface)',border:'1px solid var(--border)',borderRadius:14,padding:'20px 22px'}}>
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:14}}>
                  <div style={{fontFamily:'Syne,sans-serif',fontSize:15,fontWeight:700,color:'var(--accent)'}}>🏢 Dados do Cliente</div>
                  <div style={{display:'flex',gap:6}}>
                    {negSel.telefone&&(
                      <button onClick={()=>click2call(negSel.telefone,cfg3cx)}
                        style={{padding:'5px 12px',borderRadius:8,background:'rgba(16,185,129,.12)',border:'1px solid rgba(16,185,129,.3)',color:'var(--accent3)',fontSize:12,cursor:'pointer',fontFamily:'DM Mono,monospace',fontWeight:600}}>
                        📞 Ligar
                      </button>
                    )}
                    <button onClick={()=>{setEmailDest(negSel.email||'');setEmailAssunto(`Atendimento — ${negSel.titulo}`);setEmailCorpo('');setShowEmailModal(true)}}
                      style={{padding:'5px 12px',borderRadius:8,background:'rgba(0,212,255,.12)',border:'1px solid rgba(0,212,255,.3)',color:'var(--accent)',fontSize:12,cursor:'pointer',fontFamily:'DM Mono,monospace',fontWeight:600}}>
                      📧 E-mail
                    </button>
                    <button onClick={()=>{setFormNeg({...negSel});setShowFormNeg(true)}} style={S.nb}>✏️ Editar</button>
                  </div>
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

              {/* Timeline + Documentos */}
              <div style={{background:'var(--surface)',border:'1px solid var(--border)',borderRadius:14,padding:'20px 22px'}}>
                {/* Abas */}
                <div style={{display:'flex',gap:0,marginBottom:14,borderBottom:'1px solid var(--border)'}}>
                  {[['atividades','📋 Atividades'],['documentos','📄 Documentos']].map(([id,label])=>(
                    <button key={id} onClick={()=>setAbaDetalhe(id)}
                      style={{padding:'8px 16px',border:'none',background:'none',color:abaDetalhe===id?'var(--accent)':'var(--muted)',fontFamily:'DM Mono,monospace',fontSize:13,cursor:'pointer',fontWeight:abaDetalhe===id?700:400,borderBottom:abaDetalhe===id?'2px solid var(--accent)':'2px solid transparent',marginBottom:-1}}>
                      {label} {id==='documentos'?`(${docsDeNeg(negSel.id).length})`:`(${ativsDeNeg(negSel.id).length})`}
                    </button>
                  ))}
                  {abaDetalhe==='atividades'&&(
                    <button onClick={()=>{setFormAtiv({...EMPTY_ATIV,negocioId:negSel.id});setGcalStatus('');setShowFormAtiv(true)}}
                      style={{marginLeft:'auto',padding:'7px 14px',borderRadius:8,background:'rgba(0,212,255,.12)',border:'1px solid rgba(0,212,255,.25)',color:'var(--accent)',fontFamily:'DM Mono,monospace',fontSize:12,cursor:'pointer',fontWeight:600}}>
                      + Atividade
                    </button>
                  )}
                </div>

                {/* Aba Atividades */}
                {abaDetalhe==='atividades'&&(
                  ativsDeNeg(negSel.id).length===0
                    ?<div style={{textAlign:'center',padding:'30px 0',color:'var(--muted)',fontSize:13}}>Nenhuma atividade registrada.</div>
                    :<div style={{maxHeight:480,overflowY:'auto',paddingRight:4}}>
                      {ativsDeNeg(negSel.id).map((a,i,arr)=>{
                        const atr=isAtrasada(a),ehH=isHoje(a)
                        const playerOn = playerAberto[a.id]
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
                                {a.google_link&&<a href={a.google_link} target="_blank" rel="noopener noreferrer" style={{fontSize:10,color:'#4285f4',textDecoration:'none'}}>📅 Google Agenda</a>}
                              </div>
                              <div style={{fontSize:13,color:a.concluida?'var(--muted)':'var(--text)',marginTop:4,fontWeight:500,textDecoration:a.concluida?'line-through':'none'}}>{a.descricao}</div>
                              {/* Duração ligação 3CX */}
                              {a.duracao_seg>0&&<div style={{fontSize:10,color:'var(--muted)',marginTop:2}}>⏱ {Math.floor(a.duracao_seg/60)}min {a.duracao_seg%60}s{a.agente_nome?` · ${a.agente_nome}`:''}</div>}
                              <div style={{display:'flex',gap:8,marginTop:6,alignItems:'center',flexWrap:'wrap'}}>
                                {a.prazo&&<span style={{fontSize:10,color:'var(--muted)'}}>{fmtDT(a.prazo)}</span>}
                                <button onClick={()=>toggleConcluida(a)} style={{fontSize:10,background:a.concluida?'rgba(16,185,129,.1)':'rgba(0,212,255,.08)',border:`1px solid ${a.concluida?'rgba(16,185,129,.3)':'rgba(0,212,255,.2)'}`,color:a.concluida?'var(--accent3)':'var(--accent)',borderRadius:5,padding:'2px 8px',cursor:'pointer',fontFamily:'DM Mono,monospace'}}>{a.concluida?'↩ Reabrir':'✅ Concluir'}</button>
                                <button onClick={()=>{setFormAtiv({...a});setGcalStatus(a.google_link?'✅ Já sincronizado':'');setShowFormAtiv(true)}} style={{fontSize:10,background:'none',border:'none',color:'var(--muted)',cursor:'pointer',fontFamily:'DM Mono,monospace'}}>✏️</button>
                                <button onClick={()=>excluirAtiv(a.id)} style={{fontSize:10,background:'none',border:'none',color:'var(--danger)',cursor:'pointer',fontFamily:'DM Mono,monospace'}}>🗑</button>
                              </div>
                              {/* Player de gravação 3CX */}
                              {a.gravacao_url&&(
                                <div style={{marginTop:8,background:'var(--surface2)',border:'1px solid var(--border)',borderRadius:8,padding:'8px 12px'}}>
                                  <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:playerOn?8:0}}>
                                    <span style={{fontSize:11,color:'var(--muted)'}}>🎙 Gravação</span>
                                    <button onClick={()=>setPlayerAberto(p=>({...p,[a.id]:!p[a.id]}))} style={{fontSize:10,color:'var(--accent)',background:'none',border:'none',cursor:'pointer',padding:0}}>{playerOn?'▲ Ocultar':'▼ Ouvir'}</button>
                                    <a href={a.gravacao_url} download style={{fontSize:10,color:'var(--muted)',textDecoration:'none',marginLeft:'auto'}}>⬇ Baixar</a>
                                  </div>
                                  {playerOn&&<audio controls src={a.gravacao_url} style={{width:'100%',height:32,borderRadius:4}}/>}
                                </div>
                              )}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                )}

                {/* Aba Documentos */}
                {abaDetalhe==='documentos'&&(
                  docsDeNeg(negSel.id).length===0
                    ?<div style={{textAlign:'center',padding:'30px 0',color:'var(--muted)',fontSize:13}}>
                        📄 Nenhum documento gerado ainda.<br/>
                        <span style={{fontSize:11}}>Gere uma proposta ou contrato no Chat.</span>
                      </div>
                    :<div style={{maxHeight:480,overflowY:'auto',paddingRight:4}}>
                      {docsDeNeg(negSel.id).map(doc=>(
                        <div key={doc.id} style={{display:'flex',alignItems:'center',gap:12,padding:'10px 0',borderBottom:'1px solid var(--border)'}}>
                          <span style={{fontSize:20}}>{doc.tipo==='proposta'?'📋':'📄'}</span>
                          <div style={{flex:1}}>
                            <div style={{fontSize:13,color:'var(--text)',fontWeight:600}}>{doc.tipo==='proposta'?'Proposta':'Contrato'}{doc.clienteNome?` — ${doc.clienteNome}`:''}</div>
                            <div style={{fontSize:11,color:'var(--muted)',marginTop:2}}>
                              {doc.criadoEm?new Date(doc.criadoEm).toLocaleString('pt-BR'):''}
                              {doc.criadoPor?` · ${doc.criadoPor}`:''}
                            </div>
                          </div>
                          <div style={{display:'flex',gap:6}}>
                            {doc.html&&<button onClick={()=>setDocViewer(doc)} style={{padding:'5px 10px',borderRadius:7,background:'rgba(0,212,255,.1)',border:'1px solid rgba(0,212,255,.25)',color:'var(--accent)',fontSize:11,cursor:'pointer',fontFamily:'DM Mono,monospace'}}>👁 Ver</button>}
                          </div>
                        </div>
                      ))}
                    </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ══════════ FUNIL ══════════ */}
        {!negSel&&visao==='funil'&&(
          <div>
            <div style={{display:'flex',gap:8,marginBottom:14,flexWrap:'wrap'}}>
              {[['todas','Todas'],...etapas.map(e=>[e.id,e.label])].map(([id,label])=>(
                <button key={id} onClick={()=>setFiltroEtapa(id)}
                  style={{padding:'5px 12px',borderRadius:20,border:`1px solid ${filtroEtapa===id?'var(--accent)':'var(--border)'}`,background:filtroEtapa===id?'rgba(0,212,255,.1)':'var(--surface2)',color:filtroEtapa===id?'var(--accent)':'var(--muted)',fontSize:11,cursor:'pointer',fontFamily:'DM Mono,monospace',whiteSpace:'nowrap'}}>
                  {label} {id!=='todas'?`(${negocios.filter(n=>n.etapa===id).length})`:``}
                </button>
              ))}
            </div>
            <div className="kb-wrap">
              {etapas.filter(e=>filtroEtapa==='todas'||e.id===filtroEtapa).map(etapa=>{
                const cols=negFiltrados.filter(n=>n.etapa===etapa.id)
                return(
                  <div key={etapa.id} className="kb-col" onDragOver={e=>onDragOver(e,etapa.id)} onDrop={e=>onDrop(e,etapa.id)}>
                    <div style={{marginBottom:10}}>
                      <div style={{display:'flex',alignItems:'center',gap:6,marginBottom:4}}>
                        <div style={{width:8,height:8,borderRadius:'50%',background:etapa.cor,flexShrink:0}}/>
                        <span style={{fontSize:11,fontWeight:700,color:etapa.cor,letterSpacing:.5}}>{etapa.label}</span>
                        <span style={{marginLeft:'auto',fontSize:10,color:'var(--muted)',background:'var(--surface2)',border:'1px solid var(--border)',borderRadius:10,padding:'1px 7px'}}>{cols.length}</span>
                      </div>
                      <div style={{fontSize:10,color:'var(--muted)'}}>R$ {cols.reduce((a,n)=>a+(Number(n.adesao)||0),0).toLocaleString('pt-BR',{minimumFractionDigits:2})}</div>
                    </div>
                    <div className={dragOver===etapa.id?'drop-ok':''} style={{minHeight:60,borderRadius:8,padding:dragOver===etapa.id?'4px':0,transition:'all .2s'}}>
                      {cols.map(neg=>{
                        const etapaInfo=etapas.find(e=>e.id===neg.etapa)||etapas[0]
                        return(
                          <div key={neg.id} className="neg-card" style={{borderLeft:`3px solid ${etapaInfo.cor}`}}
                            draggable onDragStart={e=>onDragStart(e,neg)} onDragEnd={onDragEnd}
                            onClick={()=>{setNegSel(neg);setVisao('detalhe');setAbaDetalhe('atividades')}}>
                            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:6}}>
                              <span style={{fontSize:9,fontWeight:700,padding:'2px 7px',borderRadius:10,background:`${etapaInfo.cor}22`,color:etapaInfo.cor,border:`1px solid ${etapaInfo.cor}44`,letterSpacing:.5,textTransform:'uppercase'}}>{etapaInfo.label}</span>
                              {neg.adesao&&<span style={{fontSize:11,color:'var(--gold)',fontWeight:700}}>{fmt(neg.adesao)}</span>}
                            </div>
                            <div style={{fontSize:13,fontWeight:600,color:'var(--text)',marginBottom:3}}>{neg.titulo}</div>
                            {neg.nome&&<div style={{fontSize:11,color:'var(--muted)',marginBottom:3}}>{neg.nome}</div>}
                            {neg.cnpj&&<div style={{fontSize:10,color:'var(--muted)',marginBottom:3}}>{fmtDoc(neg.cnpj)}</div>}
                            {neg.email&&<div style={{fontSize:10,color:'var(--muted)',marginBottom:3}}>{neg.email}</div>}
                            <div style={{display:'flex',gap:5,marginTop:8}}>
                              <button onClick={e=>{e.stopPropagation();setFormNeg({...neg});setShowFormNeg(true)}}
                                style={{flex:1,padding:'4px 0',borderRadius:6,background:'rgba(0,212,255,.08)',border:'1px solid rgba(0,212,255,.15)',color:'var(--accent)',fontSize:10,cursor:'pointer',fontFamily:'DM Mono,monospace'}}>✏️ Ver</button>
                              {neg.telefone&&<button onClick={e=>{e.stopPropagation();click2call(neg.telefone,cfg3cx)}}
                                style={{padding:'4px 8px',borderRadius:6,background:'rgba(16,185,129,.12)',border:'1px solid rgba(16,185,129,.3)',color:'var(--accent3)',fontSize:10,cursor:'pointer',fontFamily:'DM Mono,monospace'}}>📞</button>}
                              <button onClick={e=>{e.stopPropagation();excluirNeg(neg.id)}}
                                style={{padding:'4px 8px',borderRadius:6,background:'rgba(239,68,68,.08)',border:'1px solid rgba(239,68,68,.15)',color:'var(--danger)',fontSize:10,cursor:'pointer',fontFamily:'DM Mono,monospace'}}>🗑</button>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                    <div style={{marginTop:6,fontSize:10,color:'var(--muted)',textAlign:'center',padding:'8px',border:'1px dashed var(--border)',borderRadius:8,cursor:'default'}}>Arrastar aqui</div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* ══════════ ATIVIDADES ══════════ */}
        {!negSel&&visao==='atividades'&&(
          <div>
            <div style={{display:'flex',gap:8,marginBottom:16,flexWrap:'wrap',alignItems:'center'}}>
              {[['todas','Todas'],['hoje','📅 Hoje'],['atrasada','⚠️ Atrasadas'],['futura','🔜 Futuras'],['concluida','✅ Concluídas']].map(([id,label])=>(
                <button key={id} onClick={()=>setFiltroAtiv(id)}
                  style={{padding:'6px 14px',borderRadius:20,border:`1px solid ${filtroAtiv===id?'var(--accent)':'var(--border)'}`,background:filtroAtiv===id?'rgba(0,212,255,.1)':'var(--surface2)',color:filtroAtiv===id?'var(--accent)':'var(--muted)',fontSize:11,cursor:'pointer',fontFamily:'DM Mono,monospace'}}>
                  {label}
                </button>
              ))}
              <button onClick={()=>{setFormAtiv({...EMPTY_ATIV});setGcalStatus('');setShowFormAtiv(true)}}
                style={{marginLeft:'auto',padding:'7px 16px',borderRadius:8,background:'rgba(0,212,255,.12)',border:'1px solid rgba(0,212,255,.25)',color:'var(--accent)',fontFamily:'DM Mono,monospace',fontSize:12,cursor:'pointer',fontWeight:600}}>+ Nova Atividade</button>
            </div>
            {ativFiltradas.length===0
              ?<div style={{textAlign:'center',padding:'50px 0',color:'var(--muted)',fontSize:14}}>Nenhuma atividade encontrada.</div>
              :<div>{ativFiltradas.sort((a,b)=>new Date(a.prazo||0)-new Date(b.prazo||0)).map(a=>{
                const neg=negocios.find(n=>n.id===a.negocioId)
                const atr=isAtrasada(a),ehH=isHoje(a)
                const playerOn=playerAberto[a.id]
                return(
                  <div key={a.id} style={{background:'var(--surface)',border:`1px solid ${atr?'rgba(239,68,68,.3)':ehH?'rgba(245,158,11,.3)':'var(--border)'}`,borderRadius:12,padding:'14px 16px',marginBottom:10,display:'flex',flexDirection:'column',gap:8}}>
                    <div style={{display:'flex',gap:12,alignItems:'flex-start'}}>
                      <div style={{width:10,height:10,borderRadius:'50%',background:a.concluida?'var(--accent3)':atr?'var(--danger)':ehH?'var(--warning)':'var(--accent)',flexShrink:0,marginTop:3}}/>
                      <div style={{flex:1}}>
                        <div style={{display:'flex',gap:6,alignItems:'center',flexWrap:'wrap',marginBottom:4}}>
                          <span style={{fontSize:11,padding:'1px 7px',borderRadius:4,background:'rgba(0,212,255,.1)',color:'var(--accent)'}}>{a.tipo}</span>
                          {neg&&<span style={{fontSize:11,color:'var(--muted)'}}>↗ {neg.titulo}</span>}
                          {atr&&!a.concluida&&<span style={{fontSize:10,color:'var(--danger)',fontWeight:700}}>⚠️ Atrasada</span>}
                          {ehH&&!a.concluida&&<span style={{fontSize:10,color:'var(--warning)',fontWeight:700}}>📅 Hoje</span>}
                          {a.concluida&&<span style={{fontSize:10,color:'var(--accent3)'}}>✅ Concluída</span>}
                          {a.google_link&&<a href={a.google_link} target="_blank" rel="noopener noreferrer" style={{fontSize:10,color:'#4285f4',textDecoration:'none'}}>📅 Agenda</a>}
                        </div>
                        <div style={{fontSize:13,color:a.concluida?'var(--muted)':'var(--text)',textDecoration:a.concluida?'line-through':'none'}}>{a.descricao}</div>
                        {a.duracao_seg>0&&<div style={{fontSize:10,color:'var(--muted)',marginTop:2}}>⏱ {Math.floor(a.duracao_seg/60)}min {a.duracao_seg%60}s{a.agente_nome?` · ${a.agente_nome}`:''}</div>}
                        {a.prazo&&<div style={{fontSize:10,color:'var(--muted)',marginTop:4}}>{fmtDT(a.prazo)}</div>}
                      </div>
                      <div style={{display:'flex',gap:6,flexShrink:0}}>
                        <button onClick={()=>toggleConcluida(a)} style={{fontSize:10,padding:'4px 8px',borderRadius:6,background:a.concluida?'rgba(16,185,129,.1)':'rgba(0,212,255,.08)',border:`1px solid ${a.concluida?'rgba(16,185,129,.3)':'rgba(0,212,255,.2)'}`,color:a.concluida?'var(--accent3)':'var(--accent)',cursor:'pointer',fontFamily:'DM Mono,monospace'}}>{a.concluida?'↩':'✅'}</button>
                        <button onClick={()=>{setFormAtiv({...a});setGcalStatus(a.google_link?'✅ Já sincronizado':'');setShowFormAtiv(true)}} style={{fontSize:10,padding:'4px 8px',borderRadius:6,background:'rgba(0,212,255,.05)',border:'1px solid var(--border)',color:'var(--muted)',cursor:'pointer',fontFamily:'DM Mono,monospace'}}>✏️</button>
                        <button onClick={()=>excluirAtiv(a.id)} style={{fontSize:10,padding:'4px 8px',borderRadius:6,background:'rgba(239,68,68,.08)',border:'1px solid rgba(239,68,68,.15)',color:'var(--danger)',cursor:'pointer',fontFamily:'DM Mono,monospace'}}>🗑</button>
                      </div>
                    </div>
                    {/* Player 3CX */}
                    {a.gravacao_url&&(
                      <div style={{marginLeft:22,background:'var(--surface2)',border:'1px solid var(--border)',borderRadius:8,padding:'8px 12px'}}>
                        <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:playerOn?8:0}}>
                          <span style={{fontSize:11,color:'var(--muted)'}}>🎙 Gravação</span>
                          <button onClick={()=>setPlayerAberto(p=>({...p,[a.id]:!p[a.id]}))} style={{fontSize:10,color:'var(--accent)',background:'none',border:'none',cursor:'pointer',padding:0}}>{playerOn?'▲ Ocultar':'▼ Ouvir'}</button>
                          <a href={a.gravacao_url} download style={{fontSize:10,color:'var(--muted)',textDecoration:'none',marginLeft:'auto'}}>⬇ Baixar</a>
                        </div>
                        {playerOn&&<audio controls src={a.gravacao_url} style={{width:'100%',height:32,borderRadius:4}}/>}
                      </div>
                    )}
                  </div>
                )
              })}</div>
            }
          </div>
        )}

        {/* ══════════ CLIENTES ══════════ */}
        {!negSel&&visao==='clientes'&&(
          <div>
            {cliSel ? (
              <div>
                <button onClick={()=>setCliSel(null)} style={{...S.nb,marginBottom:16}}>← Voltar à lista</button>
                <div style={{background:'var(--surface)',border:'1px solid rgba(0,212,255,.2)',borderRadius:14,padding:'22px 24px'}}>
                  <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:18}}>
                    <div>
                      <div style={{fontFamily:'Syne,sans-serif',fontSize:18,fontWeight:800,color:'var(--accent)'}}>{cliSel.fantasia||cliSel.razao||'—'}</div>
                      {cliSel.razao&&cliSel.fantasia&&<div style={{fontSize:12,color:'var(--muted)',marginTop:2}}>{cliSel.razao}</div>}
                    </div>
                    <div style={{display:'flex',gap:8}}>
                      <button onClick={()=>{setFormCli({...cliSel});setCnpjMsg('');setShowFormCli(true)}} style={{...S.nb,color:'var(--accent)',borderColor:'rgba(0,212,255,.3)'}}>✏️ Editar</button>
                      <button onClick={()=>excluirCliente(cliSel.id)} style={{...S.nb,color:'var(--danger)',borderColor:'rgba(239,68,68,.3)'}}>🗑 Excluir</button>
                    </div>
                  </div>
                  <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:0}}>
                    {[['CNPJ/CPF',fmtDoc(cliSel.doc)],['Nome Fantasia',cliSel.fantasia],['Razão Social',cliSel.razao],['Contato Principal',cliSel.contato],['E-mail',cliSel.email],['Telefone',cliSel.tel],['CEP',fmtCEP(cliSel.cep)],['Endereço',[cliSel.end,cliSel.numero,cliSel.complemento].filter(Boolean).join(', ')],['Bairro',cliSel.bairro],['Cidade/UF',[cliSel.cidade,cliSel.uf].filter(Boolean).join(' – ')],['Regime Tributário',cliSel.regime],['Atualizado em',cliSel.updatedAt]].filter(([,v])=>v).map(([l,v])=>(
                      <div key={l} style={{display:'flex',gap:8,padding:'9px 0',borderBottom:'1px solid var(--border)',fontSize:13}}>
                        <span style={{color:'var(--muted)',minWidth:140,flexShrink:0}}>{l}</span>
                        <span style={{color:'var(--text)',fontWeight:500}}>{v}</span>
                      </div>
                    ))}
                  </div>
                  {(cliSel.rimpNome||cliSel.rfinNome)&&(
                    <div style={{marginTop:16,display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
                      {cliSel.rimpNome&&<div style={{background:'var(--surface2)',border:'1px solid var(--border)',borderRadius:10,padding:'12px 14px'}}><div style={{fontSize:10,color:'var(--accent)',fontWeight:700,letterSpacing:1,textTransform:'uppercase',marginBottom:8}}>Resp. Implantação</div><div style={{fontSize:13,color:'var(--text)',fontWeight:600}}>{cliSel.rimpNome}</div>{cliSel.rimpEmail&&<div style={{fontSize:12,color:'var(--muted)',marginTop:2}}>{cliSel.rimpEmail}</div>}{cliSel.rimpTel&&<div style={{fontSize:12,color:'var(--muted)',marginTop:2}}>{cliSel.rimpTel}</div>}</div>}
                      {cliSel.rfinNome&&<div style={{background:'var(--surface2)',border:'1px solid var(--border)',borderRadius:10,padding:'12px 14px'}}><div style={{fontSize:10,color:'var(--gold)',fontWeight:700,letterSpacing:1,textTransform:'uppercase',marginBottom:8}}>Resp. Financeiro</div><div style={{fontSize:13,color:'var(--text)',fontWeight:600}}>{cliSel.rfinNome}</div>{cliSel.rfinEmail&&<div style={{fontSize:12,color:'var(--muted)',marginTop:2}}>{cliSel.rfinEmail}</div>}{cliSel.rfinTel&&<div style={{fontSize:12,color:'var(--muted)',marginTop:2}}>{cliSel.rfinTel}</div>}</div>}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div>
                {cliFiltrados.length===0
                  ?<div style={{textAlign:'center',padding:'60px 0',color:'var(--muted)',fontSize:14}}>
                    {clientes.length===0?'Nenhum cliente cadastrado.':'Nenhum cliente encontrado para a busca.'}<br/><br/>
                    <button onClick={()=>{setFormCli({...EMPTY_CLI,id:''});setCnpjMsg('');setShowFormCli(true)}} style={{padding:'10px 20px',borderRadius:9,background:'linear-gradient(135deg,var(--accent),#0099bb)',border:'none',color:'#fff',fontFamily:'DM Mono,monospace',fontSize:13,cursor:'pointer'}}>+ Cadastrar primeiro cliente</button>
                  </div>
                  :<div>
                    <div style={{fontSize:12,color:'var(--muted)',marginBottom:12}}>{cliFiltrados.length} cliente{cliFiltrados.length!==1?'s':''} encontrado{cliFiltrados.length!==1?'s':''}</div>
                    {cliFiltrados.map(cl=>(
                      <div key={cl.id} className="cli-row" style={{cursor:'pointer'}} onClick={()=>setCliSel(cl)}>
                        <div style={{width:40,height:40,borderRadius:'50%',background:'rgba(0,212,255,.1)',border:'1px solid rgba(0,212,255,.25)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:16,flexShrink:0}}>{(cl.fantasia||cl.razao||'?').slice(0,1).toUpperCase()}</div>
                        <div style={{flex:1,minWidth:0}}>
                          <div style={{fontSize:13,fontWeight:600,color:'var(--text)'}}>{cl.fantasia||cl.razao||'—'}</div>
                          {cl.razao&&cl.fantasia&&<div style={{fontSize:11,color:'var(--muted)'}}>{cl.razao}</div>}
                          <div style={{fontSize:11,color:'var(--muted)',marginTop:2,display:'flex',gap:12,flexWrap:'wrap'}}>
                            {cl.doc&&<span>{fmtDoc(cl.doc)}</span>}
                            {cl.cidade&&cl.uf&&<span>{cl.cidade} – {cl.uf}</span>}
                            {cl.email&&<span>{cl.email}</span>}
                          </div>
                        </div>
                        <div style={{display:'flex',gap:6,flexShrink:0}} onClick={e=>e.stopPropagation()}>
                          <button onClick={()=>{setFormCli({...cl});setCnpjMsg('');setShowFormCli(true)}} style={{padding:'5px 10px',borderRadius:7,background:'rgba(0,212,255,.08)',border:'1px solid rgba(0,212,255,.2)',color:'var(--accent)',fontSize:11,cursor:'pointer',fontFamily:'DM Mono,monospace'}}>✏️</button>
                          <button onClick={()=>excluirCliente(cl.id)} style={{padding:'5px 10px',borderRadius:7,background:'rgba(239,68,68,.08)',border:'1px solid rgba(239,68,68,.2)',color:'var(--danger)',fontSize:11,cursor:'pointer',fontFamily:'DM Mono,monospace'}}>🗑</button>
                        </div>
                      </div>
                    ))}
                  </div>
                }
              </div>
            )}
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
                  <button onClick={buscarCNPJNeg} disabled={buscandoCNPJ} style={{padding:'9px 14px',borderRadius:8,background:'rgba(0,212,255,.15)',border:'1px solid rgba(0,212,255,.3)',color:'var(--accent)',fontSize:12,cursor:'pointer',whiteSpace:'nowrap',fontFamily:'DM Mono,monospace'}}>{buscandoCNPJ?'⏳...':'🔍 Buscar'}</button>
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
          <div style={{...S.md,maxWidth:500}}>
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

              {/* ── Botão Google Agenda (somente para Reunião) ── */}
              {formAtiv.tipo==='Reunião'&&(
                <div style={{marginTop:14,padding:'14px',background:'rgba(66,133,244,.05)',border:'1px solid rgba(66,133,244,.25)',borderRadius:10}}>
                  <div style={{fontSize:11,color:'rgba(66,133,244,.8)',fontWeight:700,letterSpacing:1,textTransform:'uppercase',marginBottom:10}}>📅 Google Agenda</div>
                  <button
                    type="button"
                    onClick={handleSyncGCal}
                    disabled={gcalLoading}
                    style={{display:'flex',alignItems:'center',justifyContent:'center',gap:8,width:'100%',padding:'10px 16px',borderRadius:9,border:'1.5px solid rgba(66,133,244,.4)',background:'rgba(66,133,244,.1)',color:'#4285f4',fontFamily:'DM Mono,monospace',fontSize:13,fontWeight:600,cursor:gcalLoading?'not-allowed':'pointer',opacity:gcalLoading?.7:1,transition:'all .2s'}}>
                    {gcalLoading?'⏳ Sincronizando...':formAtiv.google_event_id?'🔄 Atualizar no Google Agenda':'📅 Sincronizar com Google Agenda'}
                  </button>
                  {gcalStatus&&(
                    <div style={{marginTop:8,fontSize:12,textAlign:'center',color:gcalStatus.startsWith('✅')?'var(--accent3)':gcalStatus.startsWith('❌')?'var(--danger)':'var(--muted)'}}>
                      {gcalStatus}
                    </div>
                  )}
                  {formAtiv.google_link&&(
                    <a href={formAtiv.google_link} target="_blank" rel="noopener noreferrer"
                      style={{display:'block',textAlign:'center',marginTop:6,fontSize:12,color:'#4285f4',textDecoration:'none'}}>
                      🔗 Abrir no Google Agenda
                    </a>
                  )}
                </div>
              )}

            </div>
            <div style={S.mf}>
              <button onClick={()=>setShowFormAtiv(false)} style={S.bc}>Cancelar</button>
              <button onClick={salvarAtiv} disabled={saving} style={S.bp}>{saving?'⏳...':'✅ Salvar'}</button>
            </div>
          </div>
        </div>
      )}

      {/* ════ MODAL CLIENTE ════ */}
      {showFormCli&&(
        <div style={S.ov}>
          <div style={{...S.md,maxWidth:680}}>
            <div style={S.mh}>
              <h3 style={S.mt}>{formCli.id?'✏️ Editar Cliente':'➕ Novo Cliente'}</h3>
              <button onClick={()=>setShowFormCli(false)} style={S.mc}>✕</button>
            </div>
            <div style={S.mb}>
              <div style={{background:'var(--surface2)',border:'1px solid rgba(0,212,255,.2)',borderRadius:10,padding:14,marginBottom:16}}>
                <div style={{fontSize:10,color:'var(--accent)',marginBottom:8,fontWeight:700,letterSpacing:1,textTransform:'uppercase'}}>🔍 Buscar CNPJ — preenchimento automático</div>
                <div style={{display:'flex',gap:8}}>
                  <input value={formCli.doc} onChange={e=>setFormCli(f=>({...f,doc:e.target.value}))} placeholder="00.000.000/0001-00 ou CPF" style={S.ip}/>
                  <button onClick={buscarCNPJCli} disabled={buscandoCNPJCli} style={{padding:'9px 14px',borderRadius:8,background:'rgba(0,212,255,.15)',border:'1px solid rgba(0,212,255,.3)',color:'var(--accent)',fontSize:12,cursor:'pointer',whiteSpace:'nowrap',fontFamily:'DM Mono,monospace'}}>
                    {buscandoCNPJCli?'⏳ Buscando...':'🔍 Buscar'}
                  </button>
                </div>
                {cnpjMsg&&<div style={{marginTop:8,fontSize:12,color:cnpjMsg.startsWith('✅')?'var(--accent3)':cnpjMsg.startsWith('❌')?'var(--danger)':'var(--muted)'}}>{cnpjMsg}</div>}
              </div>
              <div style={{fontSize:11,color:'var(--accent)',fontWeight:700,letterSpacing:1,textTransform:'uppercase',marginBottom:10,paddingBottom:6,borderBottom:'1px solid var(--border)'}}>Dados da Empresa</div>
              <div style={S.g2}>
                <F l="Nome Fantasia"><input value={formCli.fantasia} onChange={e=>setFormCli(f=>({...f,fantasia:e.target.value}))} style={S.ip}/></F>
                <F l="Razão Social"><input value={formCli.razao} onChange={e=>setFormCli(f=>({...f,razao:e.target.value}))} style={S.ip}/></F>
                <F l="E-mail"><input type="email" value={formCli.email} onChange={e=>setFormCli(f=>({...f,email:e.target.value}))} style={S.ip}/></F>
                <F l="Telefone"><input value={formCli.tel} onChange={e=>setFormCli(f=>({...f,tel:e.target.value}))} style={S.ip}/></F>
                <F l="Contato Principal (nome)"><input value={formCli.contato} onChange={e=>setFormCli(f=>({...f,contato:e.target.value}))} style={S.ip}/></F>
                <F l="CPF do Contato"><input value={formCli.cpfContato} onChange={e=>setFormCli(f=>({...f,cpfContato:e.target.value}))} style={S.ip}/></F>
                <F l="Regime Tributário">
                  <select value={formCli.regime} onChange={e=>setFormCli(f=>({...f,regime:e.target.value}))} style={{...S.ip,cursor:'pointer'}}>
                    <option value="">— Selecionar —</option>
                    <option>Simples Nacional</option><option>Lucro Presumido</option><option>Lucro Real</option><option>MEI</option>
                  </select>
                </F>
              </div>
              <div style={{fontSize:11,color:'var(--accent)',fontWeight:700,letterSpacing:1,textTransform:'uppercase',margin:'14px 0 10px',paddingBottom:6,borderBottom:'1px solid var(--border)'}}>Endereço</div>
              <div style={{display:'grid',gridTemplateColumns:'1fr auto',gap:8,marginBottom:12}}>
                <F l="CEP"><input value={formCli.cep} onChange={e=>setFormCli(f=>({...f,cep:e.target.value}))} onBlur={buscarCEPCli} placeholder="00000-000" style={S.ip}/></F>
                <div style={{paddingTop:18}}>{buscandoCEP&&<span style={{fontSize:11,color:'var(--muted)'}}>🔍</span>}</div>
              </div>
              <div style={{display:'grid',gridTemplateColumns:'2fr 1fr 1fr',gap:12}}>
                <F l="Logradouro / Rua"><input value={formCli.end} onChange={e=>setFormCli(f=>({...f,end:e.target.value}))} style={S.ip}/></F>
                <F l="Número"><input value={formCli.numero} onChange={e=>setFormCli(f=>({...f,numero:e.target.value}))} style={S.ip}/></F>
                <F l="Complemento"><input value={formCli.complemento} onChange={e=>setFormCli(f=>({...f,complemento:e.target.value}))} style={S.ip}/></F>
              </div>
              <div style={S.g2}>
                <F l="Bairro"><input value={formCli.bairro} onChange={e=>setFormCli(f=>({...f,bairro:e.target.value}))} style={S.ip}/></F>
                <div style={S.g2}>
                  <F l="Cidade"><input value={formCli.cidade} onChange={e=>setFormCli(f=>({...f,cidade:e.target.value}))} style={S.ip}/></F>
                  <F l="UF"><input value={formCli.uf} onChange={e=>setFormCli(f=>({...f,uf:e.target.value}))} maxLength={2} style={S.ip}/></F>
                </div>
              </div>
              <div style={{fontSize:11,color:'var(--accent)',fontWeight:700,letterSpacing:1,textTransform:'uppercase',margin:'14px 0 10px',paddingBottom:6,borderBottom:'1px solid var(--border)'}}>Responsáveis</div>
              <div style={S.g2}>
                <div>
                  <div style={{fontSize:11,color:'var(--gold)',fontWeight:700,marginBottom:8}}>Implantação</div>
                  <F l="Nome"><input value={formCli.rimpNome} onChange={e=>setFormCli(f=>({...f,rimpNome:e.target.value}))} style={S.ip}/></F>
                  <F l="E-mail"><input value={formCli.rimpEmail} onChange={e=>setFormCli(f=>({...f,rimpEmail:e.target.value}))} style={S.ip}/></F>
                  <F l="Telefone"><input value={formCli.rimpTel} onChange={e=>setFormCli(f=>({...f,rimpTel:e.target.value}))} style={S.ip}/></F>
                </div>
                <div>
                  <div style={{fontSize:11,color:'var(--gold)',fontWeight:700,marginBottom:8}}>Financeiro</div>
                  <F l="Nome"><input value={formCli.rfinNome} onChange={e=>setFormCli(f=>({...f,rfinNome:e.target.value}))} style={S.ip}/></F>
                  <F l="E-mail"><input value={formCli.rfinEmail} onChange={e=>setFormCli(f=>({...f,rfinEmail:e.target.value}))} style={S.ip}/></F>
                  <F l="Telefone"><input value={formCli.rfinTel} onChange={e=>setFormCli(f=>({...f,rfinTel:e.target.value}))} style={S.ip}/></F>
                </div>
              </div>
            </div>
            <div style={S.mf}>
              <button onClick={()=>setShowFormCli(false)} style={S.bc}>Cancelar</button>
              <button onClick={salvarCliente} disabled={saving} style={S.bp}>{saving?'⏳ Salvando...':'✅ Salvar Cliente'}</button>
            </div>
          </div>
        </div>
      )}

      {/* ════ MODAL EMAIL ════ */}
      {showEmailModal&&(
        <div style={S.ov}>
          <div style={{...S.md,maxWidth:560}}>
            <div style={S.mh}>
              <h3 style={S.mt}>📧 Enviar E-mail</h3>
              <button onClick={()=>setShowEmailModal(false)} style={S.mc}>✕</button>
            </div>
            <div style={S.mb}>
              {!cfg.smtpHost&&<div style={{background:'rgba(251,191,36,.1)',border:'1px solid rgba(251,191,36,.3)',borderRadius:8,padding:'10px 14px',fontSize:12,color:'#f59e0b',marginBottom:14}}>⚠️ SMTP não configurado. Configure em <strong>Config → Empresa</strong> para envio real. O botão abrirá seu cliente de e-mail como alternativa.</div>}
              <F l="Para"><input value={emailDest} onChange={e=>setEmailDest(e.target.value)} style={S.ip} placeholder="email@cliente.com"/></F>
              <F l="Assunto"><input value={emailAssunto} onChange={e=>setEmailAssunto(e.target.value)} style={S.ip}/></F>
              <F l="Mensagem">
                <textarea value={emailCorpo} onChange={e=>setEmailCorpo(e.target.value)} rows={7} style={{...S.ip,resize:'vertical',lineHeight:1.6}}/>
              </F>

              {/* ── Anexos ── */}
              <div style={{marginTop:8}}>
                <div style={{fontSize:11,color:'var(--muted)',marginBottom:6,letterSpacing:.5}}>ANEXOS</div>
                <label style={{display:'inline-flex',alignItems:'center',gap:6,padding:'7px 14px',borderRadius:8,background:'rgba(0,212,255,.08)',border:'1px dashed rgba(0,212,255,.35)',color:'var(--accent)',fontSize:12,cursor:'pointer',fontFamily:'DM Mono,monospace'}}>
                  📎 Adicionar arquivo
                  <input type="file" multiple style={{display:'none'}} onChange={adicionarAnexo}/>
                </label>
                {emailAnexos.length>0&&(
                  <div style={{marginTop:8,display:'flex',flexWrap:'wrap',gap:6}}>
                    {emailAnexos.map((a,i)=>(
                      <div key={i} style={{display:'flex',alignItems:'center',gap:6,padding:'4px 10px',background:'var(--surface2)',border:'1px solid var(--border)',borderRadius:8,fontSize:11,color:'var(--text)'}}>
                        📄 {a.filename} <span style={{color:'var(--muted)'}}>({(a.size/1024).toFixed(0)}KB)</span>
                        <button onClick={()=>setEmailAnexos(p=>p.filter((_,j)=>j!==i))} style={{background:'none',border:'none',color:'var(--danger)',cursor:'pointer',padding:'0 2px',fontSize:13}}>✕</button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <div style={S.mf}>
              <button onClick={()=>{setShowEmailModal(false);setEmailAnexos([])}} style={S.bc}>Cancelar</button>
              <button onClick={enviarEmail} disabled={emailSending} style={S.bp}>{emailSending?'⏳ Enviando...':'📤 Enviar'}</button>
            </div>
          </div>
        </div>
      )}

      {/* ════ MODAL AGENTE IA ════ */}
      {showAgente&&(
        <div style={S.ov}>
          <div style={{...S.md,maxWidth:620}}>
            <div style={S.mh}>
              <h3 style={{...S.mt,color:'#10b981'}}>🤖 Agente IA de Follow-up</h3>
              <button onClick={()=>setShowAgente(false)} style={S.mc}>✕</button>
            </div>
            <div style={S.mb}>

              <div style={{background:'rgba(16,185,129,.07)',border:'1px solid rgba(16,185,129,.25)',borderRadius:10,padding:14,marginBottom:20,fontSize:12,color:'#94a3b8',lineHeight:1.7}}>
                O Agente IA monitora negócios parados, faz follow-up automático via WhatsApp, envia briefing diário aos vendedores e negocia com clientes até detectar interesse de fechamento — quando retorna ao vendedor.<br/>
                <strong style={{color:'#10b981'}}>Configure Evolution API em Config → Integrações para ativar o WhatsApp.</strong>
              </div>

              {/* Ações */}
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12,marginBottom:20}}>
                <div style={{background:'var(--surface2)',border:'1px solid var(--border)',borderRadius:12,padding:16}}>
                  <div style={{fontSize:22,marginBottom:8}}>📋</div>
                  <div style={{fontWeight:700,fontSize:13,color:'var(--text)',marginBottom:4}}>Briefing Diário</div>
                  <div style={{fontSize:11,color:'var(--muted)',marginBottom:12,lineHeight:1.5}}>Envia resumo do dia para o vendedor via WhatsApp com atividades, leads quentes e negócios parados.</div>
                  <button onClick={()=>rodarAgente('briefing_diario')} disabled={!!agenteRodando} style={{...S.bp,width:'100%',justifyContent:'center',background:'rgba(0,212,255,.15)',color:'var(--accent)',border:'1px solid rgba(0,212,255,.3)'}}>
                    {agenteRodando==='briefing_diario'?'⏳ Enviando...':'📤 Enviar agora'}
                  </button>
                </div>

                <div style={{background:'var(--surface2)',border:'1px solid var(--border)',borderRadius:12,padding:16}}>
                  <div style={{fontSize:22,marginBottom:8}}>💬</div>
                  <div style={{fontWeight:700,fontSize:13,color:'var(--text)',marginBottom:4}}>Follow-up Automático</div>
                  <div style={{fontSize:11,color:'var(--muted)',marginBottom:12,lineHeight:1.5}}>Verifica negócios parados há +{DIAS_PARADO_ALERTA} dias e envia mensagem personalizada via WhatsApp para reativar o interesse.</div>
                  <button onClick={()=>rodarAgente('followup_parado')} disabled={!!agenteRodando} style={{...S.bp,width:'100%',justifyContent:'center',background:'rgba(16,185,129,.15)',color:'#10b981',border:'1px solid rgba(16,185,129,.3)'}}>
                    {agenteRodando==='followup_parado'?'⏳ Processando...':'🚀 Rodar follow-up'}
                  </button>
                </div>
              </div>

              {/* Negócios parados com ação individual */}
              {negocios.filter(n=>!['fechamento','perdido'].includes(n.etapa)&&diasDesde(n.updatedAt)>=DIAS_PARADO_ALERTA).length>0&&(
                <div style={{marginBottom:20}}>
                  <div style={{fontSize:11,color:'#f59e0b',letterSpacing:.5,marginBottom:8,fontWeight:700}}>⚠️ NEGÓCIOS PARADOS</div>
                  {negocios.filter(n=>!['fechamento','perdido'].includes(n.etapa)&&diasDesde(n.updatedAt)>=DIAS_PARADO_ALERTA).slice(0,5).map(neg=>(
                    <div key={neg.id} style={{display:'flex',alignItems:'center',gap:10,padding:'9px 12px',background:'rgba(251,191,36,.05)',border:'1px solid rgba(251,191,36,.2)',borderRadius:8,marginBottom:6}}>
                      <div style={{flex:1}}>
                        <span style={{fontSize:12,fontWeight:600,color:'var(--text)'}}>{neg.titulo}</span>
                        <span style={{fontSize:11,color:'var(--muted)',marginLeft:8}}>{diasDesde(neg.updatedAt)}d parado</span>
                        {neg.agenteEmNegociacao&&<span style={{fontSize:10,background:'rgba(16,185,129,.15)',color:'#10b981',padding:'1px 6px',borderRadius:6,marginLeft:6}}>🤖 IA negociando</span>}
                      </div>
                      <button onClick={()=>rodarAgente('followup_parado',neg.id)} disabled={!!agenteRodando}
                        style={{padding:'4px 10px',borderRadius:7,background:'rgba(16,185,129,.12)',border:'1px solid rgba(16,185,129,.3)',color:'#10b981',fontSize:11,cursor:'pointer',fontFamily:'DM Mono,monospace'}}>
                        Follow-up
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Log das últimas ações */}
              {agenteLog.length>0&&(
                <div>
                  <div style={{fontSize:11,color:'var(--muted)',letterSpacing:.5,marginBottom:8,fontWeight:700}}>ÚLTIMAS AÇÕES DO AGENTE</div>
                  {agenteLog.slice(0,5).map((l,i)=>(
                    <div key={i} style={{padding:'8px 12px',background:'var(--surface2)',borderRadius:8,marginBottom:6,fontSize:11,color:'var(--muted)'}}>
                      <span style={{color:'#10b981',fontWeight:600}}>{l.acao}</span> · {l.data}
                      {l.texto&&<div style={{color:'var(--text)',marginTop:4,fontSize:11,lineHeight:1.4,whiteSpace:'pre-wrap'}}>{l.texto.slice(0,200)}</div>}
                      {l.resultados&&<div style={{color:'var(--text)',marginTop:4}}>{l.resultados.length} follow-ups enviados</div>}
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div style={S.mf}>
              <button onClick={()=>setShowAgente(false)} style={S.bp}>Fechar</button>
            </div>
          </div>
        </div>
      )}
      {showFunisMgr&&(
        <div style={S.ov}>
          <div style={{...S.md,maxWidth:560}}>
            <div style={S.mh}>
              <h3 style={S.mt}>⚙️ Gerenciar Funis de Vendas</h3>
              <button onClick={()=>setShowFunisMgr(false)} style={S.mc}>✕</button>
            </div>
            <div style={S.mb}>
              {/* Lista de funis existentes */}
              <div style={{marginBottom:20}}>
                {funis.map(f=>(
                  <div key={f.id} style={{display:'flex',alignItems:'center',gap:8,padding:'10px 12px',background:'var(--surface2)',border:`1.5px solid ${funilAtivo===f.id?'var(--accent2)':'var(--border)'}`,borderRadius:10,marginBottom:8}}>
                    <span style={{flex:1,fontWeight:600,fontSize:13,color:funilAtivo===f.id?'#a78bfa':'var(--text)'}}>{f.nome}</span>
                    <span style={{fontSize:11,color:'var(--muted)'}}>{f.etapas?.length||0} etapas</span>
                    <button onClick={()=>{trocarFunil(f.id);setShowFunisMgr(false)}} style={{...S.nb,color:funilAtivo===f.id?'var(--accent2)':'var(--muted)'}}>
                      {funilAtivo===f.id?'✅ Ativo':'Ativar'}
                    </button>
                    <button onClick={()=>setFormFunil({...f,etapasStr:f.etapas?.map(e=>e.label).join(', ')||''})}
                      style={{...S.nb}}>✏️</button>
                    <button onClick={()=>excluirFunil(f.id)} style={{...S.nb,color:'var(--danger)'}}>🗑</button>
                  </div>
                ))}
              </div>

              {/* Formulário criar/editar funil */}
              <div style={{background:'var(--surface2)',border:'1px solid var(--border)',borderRadius:10,padding:16}}>
                <div style={{fontFamily:'Syne,sans-serif',fontSize:13,fontWeight:700,color:'var(--accent)',marginBottom:12}}>
                  {formFunil.id?'✏️ Editar Funil':'➕ Novo Funil'}
                </div>
                <F l="Nome do Funil">
                  <input value={formFunil.nome} onChange={e=>setFormFunil(f=>({...f,nome:e.target.value}))} style={S.ip} placeholder="Ex: Funil Contabilidade"/>
                </F>
                <F l="Etapas (separadas por vírgula)">
                  <input value={formFunil.etapasStr||''} onChange={e=>setFormFunil(f=>({...f,etapasStr:e.target.value}))}
                    style={S.ip} placeholder="Lead, Qualificado, Proposta, Fechamento, Perdido"/>
                </F>
                <div style={{fontSize:11,color:'var(--muted)',marginBottom:12}}>As cores serão atribuídas automaticamente por ordem.</div>
                <div style={{display:'flex',gap:8,justifyContent:'flex-end'}}>
                  <button onClick={()=>setFormFunil({id:'',nome:'',etapasStr:''})} style={S.bc}>Limpar</button>
                  <button onClick={async()=>{
                    if(!formFunil.nome.trim()){showToast('⚠️ Informe o nome do funil.');return}
                    const cores=['#64748b','#7c3aed','#00d4ff','#10b981','#f59e0b','#8b5cf6','#059669','#ef4444']
                    const etapasGeradas=(formFunil.etapasStr||'').split(',').map((l,i)=>({id:'e_'+Date.now()+'_'+i,label:l.trim(),cor:cores[i%cores.length]})).filter(e=>e.label)
                    const novoFunil={...formFunil,etapas:etapasGeradas.length?etapasGeradas:ETAPAS_PADRAO}
                    await salvarFunil(novoFunil)
                    if(!funilAtivo||formFunil.id===funilAtivo){setEtapas(novoFunil.etapas)}
                    setFormFunil({id:'',nome:'',etapasStr:''})
                  }} style={S.bp}>✅ {formFunil.id?'Atualizar':'Criar'} Funil</button>
                </div>
              </div>
            </div>
            <div style={S.mf}>
              <button onClick={()=>setShowFunisMgr(false)} style={S.bp}>Fechar</button>
            </div>
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
  ov:   { position:'fixed', inset:0, background:'rgba(0,0,0,.80)', zIndex:200, display:'flex', alignItems:'center', justifyContent:'center', padding:20, overflowY:'auto' },
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
