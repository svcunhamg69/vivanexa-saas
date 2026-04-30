// pages/whatsapp-inbox.js — v5
// ✅ Melhorias v5:
//   1. IA com acesso à agenda Google para propor agendamentos
//   2. Transferir para usuário OU departamento
//   3. Agente IA por departamento (treinado em cfg.agentConfig), reconhece imagem/áudio/vídeo
//   4. Busca global de conversas por telefone, nome, protocolo (todas as abas)

import { useState, useEffect, useRef, useCallback } from 'react'
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

// ─────────────────────────────────────────────────────────────────────────────
// APIs externas
// ─────────────────────────────────────────────────────────────────────────────
async function buscarCNPJAPI(cnpj) {
  try {
    const r = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cnpj.replace(/\D/g,'')}`)
    if (!r.ok) return null
    const d = await r.json()
    const fone = (d.ddd_telefone_1||d.ddd_telefone_2||'').replace(/\D/g,'')
    const cep  = (d.cep||'').replace(/\D/g,'')
    return {
      razao:       d.razao_social||'',
      fantasia:    d.nome_fantasia||d.razao_social||'',
      email:       d.email||'',
      tel:         fone.length>=10 ? `(${fone.slice(0,2)}) ${fone.slice(2)}` : '',
      cep,
      end:         [d.descricao_tipo_logradouro, d.logradouro].filter(Boolean).join(' '),
      numero:      d.numero && d.numero!=='S/N' ? d.numero : '',
      complemento: d.complemento||'',
      bairro:      d.bairro||'',
      cidade:      d.municipio||'',
      uf:          d.uf||'',
    }
  } catch { return null }
}

async function buscarCEPAPI(cep) {
  try {
    const r = await fetch(`https://viacep.com.br/ws/${cep.replace(/\D/g,'')}/json/`)
    if (!r.ok) return null
    const d = await r.json()
    if (d.erro) return null
    return { end: d.logradouro||'', bairro: d.bairro||'', cidade: d.localidade||'', uf: d.uf||'' }
  } catch { return null }
}

// ─────────────────────────────────────────────────────────────────────────────
// Busca eventos do Google Agenda (próximos 7 dias)
// ─────────────────────────────────────────────────────────────────────────────
async function buscarEventosAgenda(empresaId) {
  try {
    const { data: tokenRow } = await supabase
      .from('vx_storage').select('value').eq('key', `gcal_token:${empresaId}`).maybeSingle()
    if (!tokenRow?.value) return []
    const token = JSON.parse(tokenRow.value)
    const now   = new Date()
    const fim   = new Date(now.getTime() + 7 * 86400000)
    const url   = `https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=${now.toISOString()}&timeMax=${fim.toISOString()}&singleEvents=true&orderBy=startTime&maxResults=20`
    const r = await fetch(url, { headers: { Authorization: `Bearer ${token.access_token}` } })
    if (!r.ok) return []
    const d = await r.json()
    return (d.items || []).map(ev => ({
      id:      ev.id,
      titulo:  ev.summary || '(sem título)',
      inicio:  ev.start?.dateTime || ev.start?.date,
      fim:     ev.end?.dateTime   || ev.end?.date,
      local:   ev.location || '',
    }))
  } catch { return [] }
}

// ─────────────────────────────────────────────────────────────────────────────
// Cria evento no Google Agenda
// ─────────────────────────────────────────────────────────────────────────────
async function criarEventoAgenda(empresaId, evento) {
  try {
    const { data: tokenRow } = await supabase
      .from('vx_storage').select('value').eq('key', `gcal_token:${empresaId}`).maybeSingle()
    if (!tokenRow?.value) return { ok: false, erro: 'Agenda não conectada' }
    const token = JSON.parse(tokenRow.value)
    const body = {
      summary:     evento.titulo,
      description: evento.descricao || '',
      start: { dateTime: evento.inicio, timeZone: 'America/Sao_Paulo' },
      end:   { dateTime: evento.fim,    timeZone: 'America/Sao_Paulo' },
    }
    const r = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events', {
      method:  'POST',
      headers: { Authorization: `Bearer ${token.access_token}`, 'Content-Type': 'application/json' },
      body:    JSON.stringify(body),
    })
    const d = await r.json()
    if (r.ok) return { ok: true, evento: d }
    return { ok: false, erro: d.error?.message || 'Erro ao criar evento' }
  } catch(e) { return { ok: false, erro: e.message } }
}

// ─────────────────────────────────────────────────────────────────────────────
// Modal Agendamento
// ─────────────────────────────────────────────────────────────────────────────
function ModalAgendamento({ conv, empresaId, cfg, onClose, onAgendado }) {
  const [eventos, setEventos]     = useState([])
  const [loadEvt, setLoadEvt]     = useState(true)
  const [agendaOk, setAgendaOk]   = useState(true)
  const [form, setForm]           = useState({
    titulo:    `Reunião com ${conv?.nome || conv?.numero || 'Cliente'}`,
    data:      '',
    horaInicio:'09:00',
    horaFim:   '09:30',
    descricao: `Agendamento via WhatsApp.\nContato: ${conv?.numero || ''}`,
  })
  const [salvando, setSalvando]   = useState(false)
  const [erro, setErro]           = useState('')
  const [sucesso, setSucesso]     = useState('')
  const set = (k,v) => setForm(p=>({...p,[k]:v}))

  useEffect(() => {
    buscarEventosAgenda(empresaId).then(evts => {
      setEventos(evts)
      setAgendaOk(true)
      setLoadEvt(false)
    }).catch(() => { setAgendaOk(false); setLoadEvt(false) })
  }, [empresaId])

  async function salvar() {
    if (!form.data || !form.titulo) { setErro('Preencha título e data.'); return }
    setSalvando(true); setErro('')
    const inicio = new Date(`${form.data}T${form.horaInicio}:00`).toISOString()
    const fim    = new Date(`${form.data}T${form.horaFim}:00`).toISOString()
    const r = await criarEventoAgenda(empresaId, { titulo: form.titulo, descricao: form.descricao, inicio, fim })
    if (r.ok) {
      setSucesso('✅ Evento criado na agenda!')
      const dataFmt = new Date(inicio).toLocaleDateString('pt-BR',{day:'2-digit',month:'2-digit',year:'numeric'})
      const horaFmt = form.horaInicio
      onAgendado && onAgendado(`📅 *Reunião agendada!*\n\nData: *${dataFmt}* às *${horaFmt}*\nAssunto: ${form.titulo}\n\nAguardamos você! 😊`)
      setTimeout(onClose, 1800)
    } else {
      setErro(r.erro || 'Erro ao agendar')
    }
    setSalvando(false)
  }

  const inp = { width:'100%', background:'#1a2540', border:'1px solid #1e2d4a', borderRadius:8, padding:'9px 12px', color:'#e2e8f0', fontFamily:'DM Mono,monospace', fontSize:13, outline:'none' }
  const lbl = { fontSize:10, color:'#64748b', display:'block', marginBottom:4, letterSpacing:.5, textTransform:'uppercase' }

  return (
    <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,.80)',zIndex:3000,display:'flex',alignItems:'center',justifyContent:'center',padding:16}} onClick={onClose}>
      <div style={{background:'#111827',border:'1px solid #1e2d4a',borderRadius:16,width:'100%',maxWidth:480,maxHeight:'90vh',overflowY:'auto'}} onClick={e=>e.stopPropagation()}>
        <div style={{padding:'20px 24px 0',display:'flex',alignItems:'center',justifyContent:'space-between'}}>
          <div style={{fontFamily:'Syne,sans-serif',fontWeight:700,fontSize:16,color:'#e2e8f0'}}>📅 Agendar Reunião</div>
          <button onClick={onClose} style={{background:'none',border:'none',color:'#64748b',fontSize:22,cursor:'pointer'}}>✕</button>
        </div>

        <div style={{padding:'16px 24px',display:'flex',flexDirection:'column',gap:14}}>

          {/* Status da agenda */}
          {!loadEvt && (
            <div style={{padding:'10px 14px',borderRadius:8,background:agendaOk?'rgba(16,185,129,.08)':'rgba(245,158,11,.08)',border:`1px solid ${agendaOk?'rgba(16,185,129,.25)':'rgba(245,158,11,.3)'}`,fontSize:12,color:agendaOk?'#10b981':'#f59e0b'}}>
              {agendaOk ? `📅 Google Agenda conectada · ${eventos.length} evento(s) nos próximos 7 dias` : '⚠️ Agenda não conectada. Configure em Configurações → Integrações → Google Agenda'}
            </div>
          )}

          {/* Próximos eventos (referência) */}
          {eventos.length > 0 && (
            <div style={{background:'#0d1b2e',border:'1px solid #1e2d4a',borderRadius:10,padding:12}}>
              <div style={{fontSize:10,color:'#64748b',letterSpacing:1,textTransform:'uppercase',marginBottom:8}}>Agenda (próx. 7 dias)</div>
              <div style={{display:'flex',flexDirection:'column',gap:5,maxHeight:120,overflowY:'auto'}}>
                {eventos.map(ev=>(
                  <div key={ev.id} style={{display:'flex',gap:8,alignItems:'center',fontSize:11,color:'#94a3b8'}}>
                    <span style={{color:'#00d4ff',flexShrink:0}}>{ev.inicio ? new Date(ev.inicio).toLocaleDateString('pt-BR',{day:'2-digit',month:'2-digit'}) : ''}</span>
                    <span style={{color:'#00d4ff',flexShrink:0}}>{ev.inicio ? new Date(ev.inicio).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'}) : ''}</span>
                    <span style={{overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{ev.titulo}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Formulário */}
          <div><label style={lbl}>Título *</label><input style={inp} value={form.titulo} onChange={e=>set('titulo',e.target.value)} /></div>
          <div><label style={lbl}>Data *</label><input style={inp} type="date" value={form.data} onChange={e=>set('data',e.target.value)} /></div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
            <div><label style={lbl}>Hora Início</label><input style={inp} type="time" value={form.horaInicio} onChange={e=>set('horaInicio',e.target.value)} /></div>
            <div><label style={lbl}>Hora Fim</label><input style={inp} type="time" value={form.horaFim} onChange={e=>set('horaFim',e.target.value)} /></div>
          </div>
          <div><label style={lbl}>Descrição</label><textarea style={{...inp,resize:'vertical',minHeight:60}} value={form.descricao} onChange={e=>set('descricao',e.target.value)} /></div>

          {erro    && <div style={{padding:'8px 12px',background:'rgba(239,68,68,.1)',border:'1px solid rgba(239,68,68,.3)',borderRadius:8,fontSize:12,color:'#ef4444'}}>⚠️ {erro}</div>}
          {sucesso && <div style={{padding:'8px 12px',background:'rgba(16,185,129,.1)',border:'1px solid rgba(16,185,129,.3)',borderRadius:8,fontSize:12,color:'#10b981'}}>{sucesso}</div>}
        </div>

        <div style={{display:'flex',gap:10,padding:'0 24px 20px'}}>
          <button onClick={onClose} style={{flex:1,padding:10,background:'none',border:'1px solid #1e2d4a',color:'#64748b',borderRadius:10,cursor:'pointer',fontFamily:'DM Mono,monospace',fontSize:13}}>Cancelar</button>
          <button onClick={salvar} disabled={salvando||!agendaOk} style={{flex:2,padding:10,background:'linear-gradient(135deg,#00d4ff,#0099bb)',border:'none',color:'#fff',borderRadius:10,cursor:salvando||!agendaOk?'not-allowed':'pointer',fontFamily:'DM Mono,monospace',fontSize:13,fontWeight:600,opacity:salvando||!agendaOk?.6:1}}>
            {salvando ? '⏳ Agendando...' : '📅 Confirmar Agendamento'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Modal de Busca Global
// ─────────────────────────────────────────────────────────────────────────────
function ModalBuscaGlobal({ idx, onClose, onAbrirConv }) {
  const [busca, setBusca] = useState('')
  const inputRef = useRef(null)

  useEffect(() => { inputRef.current?.focus() }, [])

  const todas = Object.values(idx)
  const resultado = busca.trim().length < 2 ? [] : todas.filter(c => {
    const q = busca.toLowerCase().trim()
    return (
      (c.nome     || '').toLowerCase().includes(q) ||
      (c.numero   || '').replace(/\D/g,'').includes(q.replace(/\D/g,'')) ||
      (c.protocolo|| '').toLowerCase().includes(q)
    )
  }).sort((a,b) => new Date(b.updatedAt||0) - new Date(a.updatedAt||0))

  return (
    <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,.80)',zIndex:3000,display:'flex',alignItems:'flex-start',justifyContent:'center',padding:'60px 16px 16px'}} onClick={onClose}>
      <div style={{background:'#111827',border:'1px solid #1e2d4a',borderRadius:16,width:'100%',maxWidth:520,overflow:'hidden'}} onClick={e=>e.stopPropagation()}>
        <div style={{padding:'16px 20px',borderBottom:'1px solid #1e2d4a',display:'flex',alignItems:'center',gap:10}}>
          <span style={{fontSize:18}}>🔍</span>
          <input ref={inputRef} style={{flex:1,background:'none',border:'none',color:'#e2e8f0',fontFamily:'DM Mono,monospace',fontSize:14,outline:'none'}} placeholder="Buscar por nome, telefone ou protocolo..." value={busca} onChange={e=>setBusca(e.target.value)} />
          <button onClick={onClose} style={{background:'none',border:'none',color:'#64748b',fontSize:18,cursor:'pointer'}}>✕</button>
        </div>

        {busca.trim().length >= 2 && (
          <div style={{maxHeight:'60vh',overflowY:'auto'}}>
            {resultado.length === 0 ? (
              <div style={{padding:'32px 20px',textAlign:'center',color:'#64748b',fontSize:13}}>Nenhuma conversa encontrada para <strong style={{color:'#e2e8f0'}}>"{busca}"</strong></div>
            ) : (
              resultado.map(c => (
                <button key={c.numero} onClick={()=>{onAbrirConv(c.numero,c.status);onClose()}} style={{width:'100%',padding:'13px 20px',background:'none',border:'none',borderBottom:'1px solid #1e2d4a',cursor:'pointer',textAlign:'left',display:'flex',alignItems:'center',gap:12,transition:'background .12s'}}
                  onMouseEnter={e=>e.currentTarget.style.background='rgba(0,212,255,.05)'}
                  onMouseLeave={e=>e.currentTarget.style.background='none'}>
                  <Avatar nome={c.nome} size={36} />
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontWeight:700,fontSize:13,color:'#e2e8f0',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{c.nome||c.numero}</div>
                    <div style={{fontSize:11,color:'#64748b',marginTop:2}}>{c.numero}{c.protocolo&&<span style={{marginLeft:8,color:'#10b981'}}>· {c.protocolo}</span>}</div>
                  </div>
                  <div>
                    <span style={{padding:'3px 8px',borderRadius:12,fontSize:10,fontWeight:700,background:STATUS[c.status]?.bg,color:STATUS[c.status]?.cor,border:`1px solid ${STATUS[c.status]?.cor}44`}}>
                      {STATUS[c.status]?.label}
                    </span>
                  </div>
                </button>
              ))
            )}
          </div>
        )}

        {busca.trim().length < 2 && (
          <div style={{padding:'24px 20px',textAlign:'center',color:'#64748b',fontSize:12}}>
            <div style={{fontSize:36,marginBottom:8}}>🔎</div>
            Digite ao menos 2 caracteres para buscar em todas as conversas
          </div>
        )}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Modal "Abrir no CRM"
// ─────────────────────────────────────────────────────────────────────────────
function ModalCRM({ conv, empresaId, user, cfg, onClose, onSalvo }) {
  const etapas = cfg.crm_etapas?.length ? cfg.crm_etapas : [
    {id:'lead',           label:'Lead'},
    {id:'lead_qualificado',label:'Lead Qualificado'},
    {id:'reuniao_agendada',label:'Reunião Agendada'},
    {id:'proposta_enviada',label:'Proposta Enviada'},
    {id:'fechamento',     label:'Fechamento'},
  ]

  const [form, setForm] = useState({
    titulo:      conv.nome ? `Atendimento – ${conv.nome}` : 'Novo Lead WhatsApp',
    etapa:       'lead',
    origem:      'whatsapp',
    observacoes: `Lead via WhatsApp em ${new Date().toLocaleDateString('pt-BR')}`,
    cnpj:        '',
    nome:        conv.nome || '',
    fantasia:    '',
    razao:       '',
    email:       '',
    telefone:    conv.numero || '',
    cep:         '',
    end:         '',
    numero:      '',
    complemento: '',
    bairro:      '',
    cidade:      '',
    uf:          '',
    regime:      '',
    salvarCliente: true,
  })

  const [buscandoCNPJ, setBuscandoCNPJ] = useState(false)
  const [buscandoCEP,  setBuscandoCEP]  = useState(false)
  const [cnpjMsg,      setCnpjMsg]      = useState('')
  const [salvando,     setSalvando]     = useState(false)
  const [erro,         setErro]         = useState('')
  const [aba,          setAba]          = useState('negocio')

  const inp = { width:'100%', background:'#1a2540', border:'1px solid #1e2d4a', borderRadius:8, padding:'9px 12px', color:'#e2e8f0', fontFamily:'DM Mono,monospace', fontSize:13, outline:'none' }
  const lbl = { fontSize:10, color:'#64748b', display:'block', marginBottom:4, letterSpacing:.5, textTransform:'uppercase' }
  const set = (k, v) => setForm(p => ({...p, [k]: v}))

  async function buscarCNPJ() {
    const cnpj = form.cnpj.replace(/\D/g,'')
    if (cnpj.length !== 14) { setCnpjMsg('⚠️ CNPJ deve ter 14 dígitos.'); return }
    const localClientes = cfg.clients || []
    const local = localClientes.find(c => c.doc === cnpj)
    if (local) {
      setForm(p => ({ ...p, razao:p.razao||local.razao||'', fantasia:p.fantasia||local.fantasia||'', email:p.email||local.email||'', telefone:p.telefone||local.tel||'', cep:p.cep||local.cep||'', end:p.end||local.end||'', numero:p.numero||local.numero||'', complemento:p.complemento||local.complemento||'', bairro:p.bairro||local.bairro||'', cidade:p.cidade||local.cidade||'', uf:p.uf||local.uf||'', regime:p.regime||local.regime||'', nome:p.nome||local.fantasia||local.razao||'' }))
      setCnpjMsg('✅ Dados encontrados na base local!')
      return
    }
    setBuscandoCNPJ(true); setCnpjMsg('⏳ Consultando Receita Federal...')
    const d = await buscarCNPJAPI(cnpj)
    if (d) {
      setForm(p => ({ ...p, razao:p.razao||d.razao, fantasia:p.fantasia||d.fantasia, email:p.email||d.email, telefone:p.telefone||d.tel, cep:p.cep||d.cep, end:p.end||d.end, numero:p.numero||d.numero, complemento:p.complemento||d.complemento, bairro:p.bairro||d.bairro, cidade:p.cidade||d.cidade, uf:p.uf||d.uf, nome:p.nome||d.fantasia||d.razao }))
      setCnpjMsg('✅ Dados da Receita Federal carregados!')
      if (d.cep && !d.end) {
        const ce = await buscarCEPAPI(d.cep)
        if (ce) setForm(p => ({ ...p, end:p.end||ce.end, bairro:p.bairro||ce.bairro, cidade:p.cidade||ce.cidade, uf:p.uf||ce.uf }))
      }
    } else {
      setCnpjMsg('❌ CNPJ não localizado na Receita Federal.')
    }
    setBuscandoCNPJ(false)
  }

  async function buscarCEP() {
    const cep = form.cep.replace(/\D/g,'')
    if (cep.length !== 8) return
    setBuscandoCEP(true)
    const d = await buscarCEPAPI(cep)
    if (d) setForm(p => ({ ...p, end:p.end||d.end, bairro:p.bairro||d.bairro, cidade:p.cidade||d.cidade, uf:p.uf||d.uf }))
    setBuscandoCEP(false)
  }

  async function salvar() {
    if (!form.titulo.trim() || !form.nome.trim()) { setErro('Título e nome são obrigatórios.'); return }
    setSalvando(true); setErro('')
    try {
      const { data: row } = await supabase.from('vx_storage').select('value').eq('key',`cfg:${empresaId}`).maybeSingle()
      const currentCfg = row?.value ? JSON.parse(row.value) : {}
      const novo = {
        id: `neg_${Date.now()}`, titulo: form.titulo, etapa: form.etapa, nome: form.razao||form.nome, fantasia: form.fantasia||form.nome,
        cnpj: form.cnpj.replace(/\D/g,''), email: form.email, telefone: form.telefone,
        endereco: [form.end, form.numero, form.complemento].filter(Boolean).join(', '),
        cidade: form.cidade, uf: form.uf, observacoes: form.observacoes,
        origem: 'whatsapp', responsavel: user?.nome||user?.email||'',
        criadoEm: new Date().toISOString(), atualizadoEm: new Date().toISOString(), wppNumero: conv.numero,
      }
      currentCfg.crm_negocios = [...(currentCfg.crm_negocios||[]), novo]
      if (form.salvarCliente) {
        const docLimpo = form.cnpj.replace(/\D/g,'')
        const clientes = currentCfg.clients || []
        const clienteData = { id:`cli_${Date.now()}`, doc:docLimpo, fantasia:form.fantasia||form.nome, razao:form.razao, contato:form.nome, email:form.email, tel:form.telefone, cep:form.cep.replace(/\D/g,''), end:form.end, numero:form.numero, complemento:form.complemento, bairro:form.bairro, cidade:form.cidade, uf:form.uf, regime:form.regime, updatedAt:new Date().toLocaleDateString('pt-BR') }
        const idxExistente = docLimpo ? clientes.findIndex(c => c.doc === docLimpo) : -1
        if (idxExistente >= 0) clientes[idxExistente] = { ...clientes[idxExistente], ...clienteData, id: clientes[idxExistente].id }
        else clientes.push(clienteData)
        currentCfg.clients = clientes
      }
      await supabase.from('vx_storage').upsert({ key:`cfg:${empresaId}`, value:JSON.stringify(currentCfg), updated_at:new Date().toISOString() }, { onConflict:'key' })
      onSalvo(novo)
    } catch(e) { setErro('Erro: ' + e.message) }
    setSalvando(false)
  }

  return (
    <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,.80)',zIndex:2000,display:'flex',alignItems:'center',justifyContent:'center',padding:16}} onClick={onClose}>
      <div style={{background:'#111827',border:'1px solid #1e2d4a',borderRadius:16,width:'100%',maxWidth:540,maxHeight:'92vh',overflowY:'auto',display:'flex',flexDirection:'column'}} onClick={e=>e.stopPropagation()}>
        <div style={{padding:'20px 24px 0',display:'flex',alignItems:'center',justifyContent:'space-between',flexShrink:0}}>
          <div style={{fontFamily:'Syne,sans-serif',fontWeight:700,fontSize:17,color:'#e2e8f0'}}>🤝 Criar Negócio no CRM</div>
          <button onClick={onClose} style={{background:'none',border:'none',color:'#64748b',fontSize:22,cursor:'pointer'}}>✕</button>
        </div>
        <div style={{display:'flex',gap:0,padding:'14px 24px 0',borderBottom:'1px solid #1e2d4a',flexShrink:0}}>
          {[['negocio','📋 Negócio'],['cliente','🏢 Cliente/Endereço']].map(([id,label])=>(
            <button key={id} onClick={()=>setAba(id)} style={{padding:'7px 16px',border:'none',borderBottom:`2px solid ${aba===id?'#00d4ff':'transparent'}`,background:'none',color:aba===id?'#00d4ff':'#64748b',fontFamily:'DM Mono,monospace',fontSize:12,cursor:'pointer',transition:'all .15s'}}>
              {label}
            </button>
          ))}
        </div>
        <div style={{padding:'20px 24px',flex:1,overflowY:'auto'}}>
          {aba === 'negocio' && (
            <div style={{display:'flex',flexDirection:'column',gap:14}}>
              <div><label style={lbl}>Título *</label><input style={inp} value={form.titulo} onChange={e=>set('titulo',e.target.value)} /></div>
              <div><label style={lbl}>Nome do Contato *</label><input style={inp} value={form.nome} onChange={e=>set('nome',e.target.value)} /></div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
                <div><label style={lbl}>Telefone</label><input style={inp} value={form.telefone} onChange={e=>set('telefone',e.target.value)} /></div>
                <div><label style={lbl}>E-mail</label><input style={inp} value={form.email} onChange={e=>set('email',e.target.value)} placeholder="email@empresa.com" /></div>
              </div>
              <div><label style={lbl}>Etapa do Funil</label>
                <select style={{...inp,cursor:'pointer'}} value={form.etapa} onChange={e=>set('etapa',e.target.value)}>
                  {etapas.map(et=><option key={et.id} value={et.id}>{et.label}</option>)}
                </select>
              </div>
              <div><label style={lbl}>Observações</label><textarea style={{...inp,resize:'vertical',minHeight:72}} value={form.observacoes} onChange={e=>set('observacoes',e.target.value)} /></div>
              <div style={{background:'rgba(0,212,255,.06)',border:'1px solid rgba(0,212,255,.15)',borderRadius:8,padding:'10px 14px',fontSize:12,color:'#64748b'}}>
                💡 Acesse a aba <strong style={{color:'#00d4ff'}}>Cliente/Endereço</strong> para preencher CNPJ e endereço automaticamente.
              </div>
            </div>
          )}
          {aba === 'cliente' && (
            <div style={{display:'flex',flexDirection:'column',gap:14}}>
              <div style={{background:'#1a2540',border:'1px solid rgba(0,212,255,.2)',borderRadius:10,padding:14}}>
                <div style={{fontSize:10,color:'#00d4ff',fontWeight:700,letterSpacing:1,textTransform:'uppercase',marginBottom:8}}>🔍 Busca automática por CNPJ</div>
                <div style={{display:'flex',gap:8}}>
                  <input style={{...inp,flex:1}} value={form.cnpj} onChange={e=>set('cnpj',e.target.value)} placeholder="00.000.000/0001-00" onKeyDown={e=>{ if(e.key==='Enter') buscarCNPJ() }}/>
                  <button onClick={buscarCNPJ} disabled={buscandoCNPJ} style={{padding:'9px 14px',borderRadius:8,background:'rgba(0,212,255,.15)',border:'1px solid rgba(0,212,255,.3)',color:'#00d4ff',fontSize:12,cursor:'pointer',whiteSpace:'nowrap',fontFamily:'DM Mono,monospace',opacity:buscandoCNPJ?.6:1}}>
                    {buscandoCNPJ ? '⏳...' : '🔍 Buscar'}
                  </button>
                </div>
                {cnpjMsg && <div style={{marginTop:8,fontSize:12,color:cnpjMsg.startsWith('✅')?'#10b981':cnpjMsg.startsWith('❌')?'#ef4444':'#64748b'}}>{cnpjMsg}</div>}
              </div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
                <div><label style={lbl}>Nome Fantasia</label><input style={inp} value={form.fantasia} onChange={e=>set('fantasia',e.target.value)} /></div>
                <div><label style={lbl}>Razão Social</label><input style={inp} value={form.razao} onChange={e=>set('razao',e.target.value)} /></div>
              </div>
              <div><label style={lbl}>Regime Tributário</label>
                <select style={{...inp,cursor:'pointer'}} value={form.regime} onChange={e=>set('regime',e.target.value)}>
                  <option value="">— Selecionar —</option>
                  <option>Simples Nacional</option><option>Lucro Presumido</option><option>Lucro Real</option><option>MEI</option>
                </select>
              </div>
              <div style={{background:'#1a2540',border:'1px solid rgba(0,212,255,.1)',borderRadius:10,padding:14}}>
                <div style={{fontSize:10,color:'#64748b',fontWeight:700,letterSpacing:1,textTransform:'uppercase',marginBottom:10}}>📍 Endereço</div>
                <div style={{display:'flex',gap:8,marginBottom:12}}>
                  <div style={{flex:1}}><label style={lbl}>CEP</label><input style={inp} value={form.cep} onChange={e=>set('cep',e.target.value)} onBlur={buscarCEP} placeholder="00000-000" /></div>
                  <div style={{paddingTop:20}}>{buscandoCEP && <span style={{fontSize:11,color:'#64748b'}}>🔍</span>}</div>
                </div>
                <div style={{display:'grid',gridTemplateColumns:'2fr 1fr 1fr',gap:10,marginBottom:10}}>
                  <div><label style={lbl}>Logradouro</label><input style={inp} value={form.end} onChange={e=>set('end',e.target.value)} /></div>
                  <div><label style={lbl}>Número</label><input style={inp} value={form.numero} onChange={e=>set('numero',e.target.value)} /></div>
                  <div><label style={lbl}>Complemento</label><input style={inp} value={form.complemento} onChange={e=>set('complemento',e.target.value)} /></div>
                </div>
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:10}}>
                  <div><label style={lbl}>Bairro</label><input style={inp} value={form.bairro} onChange={e=>set('bairro',e.target.value)} /></div>
                  <div><label style={lbl}>Cidade</label><input style={inp} value={form.cidade} onChange={e=>set('cidade',e.target.value)} /></div>
                  <div><label style={lbl}>UF</label><input style={inp} value={form.uf} onChange={e=>set('uf',e.target.value)} maxLength={2} /></div>
                </div>
              </div>
              <label style={{display:'flex',alignItems:'center',gap:10,cursor:'pointer',fontSize:13,color:'#e2e8f0',padding:'10px 14px',background:'rgba(16,185,129,.06)',border:'1px solid rgba(16,185,129,.2)',borderRadius:8}}>
                <input type="checkbox" checked={form.salvarCliente} onChange={e=>set('salvarCliente',e.target.checked)} style={{width:15,height:15,accentColor:'#10b981',cursor:'pointer'}} />
                <span>Salvar também na base de <strong style={{color:'#10b981'}}>Clientes</strong></span>
              </label>
            </div>
          )}
        </div>
        {erro && <div style={{margin:'0 24px',padding:'8px 12px',background:'rgba(239,68,68,.1)',border:'1px solid rgba(239,68,68,.3)',borderRadius:8,fontSize:12,color:'#ef4444'}}>⚠️ {erro}</div>}
        <div style={{display:'flex',gap:10,padding:'16px 24px',borderTop:'1px solid #1e2d4a',flexShrink:0}}>
          <button onClick={onClose} style={{flex:1,padding:10,background:'none',border:'1px solid #1e2d4a',color:'#64748b',borderRadius:10,cursor:'pointer',fontFamily:'DM Mono,monospace',fontSize:13}}>Cancelar</button>
          <button onClick={salvar} disabled={salvando} style={{flex:2,padding:10,background:'linear-gradient(135deg,#00d4ff,#0099bb)',border:'none',color:'#fff',borderRadius:10,cursor:salvando?'not-allowed':'pointer',fontFamily:'DM Mono,monospace',fontSize:13,fontWeight:600,opacity:salvando?.7:1}}>
            {salvando ? '⏳ Salvando...' : '✅ Criar no CRM'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Modal Transferir — usuário OU departamento
// ─────────────────────────────────────────────────────────────────────────────
function ModalTransferir({ agentes, departamentos, onTransferirUsuario, onTransferirDepto, onClose }) {
  const [aba, setAba] = useState('usuarios')

  return (
    <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,.65)',zIndex:1000,display:'flex',alignItems:'center',justifyContent:'center'}} onClick={onClose}>
      <div style={{background:'#111827',border:'1px solid #1e2d4a',borderRadius:16,padding:24,minWidth:320,maxWidth:400,maxHeight:'80vh',overflow:'hidden',display:'flex',flexDirection:'column'}} onClick={e=>e.stopPropagation()}>
        <div style={{fontFamily:'Syne,sans-serif',fontWeight:700,color:'#e2e8f0',marginBottom:14,fontSize:16}}>🔀 Transferir Atendimento</div>

        {/* Abas */}
        <div style={{display:'flex',marginBottom:14,gap:0,borderBottom:'1px solid #1e2d4a'}}>
          {[['usuarios','👤 Usuários'],['deptos','🏢 Departamentos']].map(([id,label])=>(
            <button key={id} onClick={()=>setAba(id)} style={{flex:1,padding:'7px 0',border:'none',borderBottom:`2px solid ${aba===id?'#00d4ff':'transparent'}`,background:'none',color:aba===id?'#00d4ff':'#64748b',fontFamily:'DM Mono,monospace',fontSize:11,cursor:'pointer',transition:'all .15s'}}>
              {label}
            </button>
          ))}
        </div>

        <div style={{flex:1,overflowY:'auto'}}>
          {aba === 'usuarios' && (
            agentes.length === 0 ? (
              <div style={{textAlign:'center',padding:'20px',color:'#64748b',fontSize:12}}>Nenhum usuário disponível</div>
            ) : agentes.map(ag=>(
              <button key={ag.user_id||ag.id} onClick={()=>onTransferirUsuario(ag)} style={{width:'100%',padding:'11px 14px',marginBottom:8,borderRadius:10,background:'#1a2540',border:'1px solid #1e2d4a',color:'#e2e8f0',fontFamily:'DM Mono,monospace',fontSize:13,cursor:'pointer',textAlign:'left',display:'flex',alignItems:'center',gap:10}}>
                <Avatar nome={ag.nome} size={28} />
                <div><div style={{fontWeight:600}}>{ag.nome}</div><div style={{fontSize:11,color:'#64748b'}}>{ag.email}</div></div>
              </button>
            ))
          )}
          {aba === 'deptos' && (
            departamentos.length === 0 ? (
              <div style={{textAlign:'center',padding:'20px',color:'#64748b',fontSize:12}}>
                Nenhum departamento cadastrado.<br/>
                <span style={{fontSize:11,marginTop:4,display:'block'}}>Configure em <strong style={{color:'#00d4ff'}}>Configurações → Agente IA</strong></span>
              </div>
            ) : departamentos.map(d=>(
              <button key={d.id} onClick={()=>onTransferirDepto(d)} style={{width:'100%',padding:'11px 14px',marginBottom:8,borderRadius:10,background:'#1a2540',border:'1px solid #1e2d4a',color:'#e2e8f0',fontFamily:'DM Mono,monospace',fontSize:13,cursor:'pointer',textAlign:'left',display:'flex',alignItems:'center',gap:12}}>
                <div style={{width:32,height:32,borderRadius:'50%',background:'rgba(124,58,237,.2)',border:'1px solid rgba(124,58,237,.4)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:16,flexShrink:0}}>{d.emoji||'🏢'}</div>
                <div style={{flex:1}}>
                  <div style={{fontWeight:600}}>{d.nome}</div>
                  <div style={{fontSize:11,color:'#64748b'}}>{d.descricao||'Departamento'}</div>
                </div>
                {d.agentIA && <span style={{fontSize:10,padding:'2px 7px',borderRadius:10,background:'rgba(124,58,237,.2)',color:'#7c3aed',border:'1px solid rgba(124,58,237,.4)'}}>🤖 IA</span>}
              </button>
            ))
          )}
        </div>

        <button onClick={onClose} style={{width:'100%',padding:9,background:'none',border:'1px solid #1e2d4a',color:'#64748b',borderRadius:8,cursor:'pointer',fontFamily:'DM Mono,monospace',fontSize:12,marginTop:10}}>Cancelar</button>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Agente IA por departamento — chama a API de IA com contexto do depto
// ─────────────────────────────────────────────────────────────────────────────
async function chamarAgenteIA({ cfg, depto, mensagem, historico = [], mediaBase64 = null, mediaTipo = null }) {
  const key = cfg.geminiKey || cfg.geminiApiKey || ''
  const groqKey = cfg.groqKey || cfg.groqApiKey || ''
  const openaiKey = cfg.openaiKey || cfg.openaiApiKey || ''

  // Monta contexto do departamento
  const baseKnowledge = cfg.agentConfig?.baseConhecimento || ''
  const deptoKnowledge = depto?.baseConhecimento || ''
  const systemPrompt = `
Você é o assistente de IA do departamento "${depto?.nome || 'Atendimento'}" da empresa ${cfg.company || 'Vivanexa'}.
${depto?.instrucoes ? `\nInstruções específicas: ${depto.instrucoes}` : ''}
${baseKnowledge ? `\nBase de conhecimento geral:\n${baseKnowledge.slice(0, 3000)}` : ''}
${deptoKnowledge ? `\nBase de conhecimento do departamento:\n${deptoKnowledge.slice(0, 2000)}` : ''}

Responda sempre em português, de forma natural e cordial.
NÃO mencione que você é uma IA ou que usa um modelo de linguagem.
Se a pergunta for sobre agendamento, proponha horários disponíveis.
Se receber imagem, áudio ou vídeo, descreva o conteúdo e responda ao contexto.
`.trim()

  const histStr = historico.slice(-6).map(m => `${m.de === 'empresa' ? 'Assistente' : 'Cliente'}: ${m.texto}`).join('\n')
  const promptFinal = histStr ? `${histStr}\nCliente: ${mensagem}` : mensagem

  // ── Tenta Gemini (suporta multimodal nativamente) ──
  if (key) {
    try {
      const parts = []
      if (mediaBase64 && mediaTipo) {
        if (mediaTipo === 'image') {
          parts.push({ inlineData: { mimeType: 'image/jpeg', data: mediaBase64 } })
        } else if (mediaTipo === 'audio') {
          parts.push({ inlineData: { mimeType: 'audio/ogg', data: mediaBase64 } })
        } else if (mediaTipo === 'video') {
          parts.push({ inlineData: { mimeType: 'video/mp4', data: mediaBase64 } })
        }
      }
      parts.push({ text: promptFinal })

      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${key}`
      const body = {
        contents: [{ role: 'user', parts }],
        systemInstruction: { parts: [{ text: systemPrompt }] },
      }
      const r = await fetch(url, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(body) })
      const d = await r.json()
      const txt = d.candidates?.[0]?.content?.parts?.[0]?.text
      if (txt) return txt.trim()
    } catch {}
  }

  // ── Fallback OpenAI ──
  if (openaiKey) {
    try {
      const messages = [
        { role: 'system', content: systemPrompt },
        { role: 'user',   content: promptFinal },
      ]
      const r = await fetch('https://api.openai.com/v1/chat/completions', {
        method:'POST',
        headers:{'Authorization':`Bearer ${openaiKey}`,'Content-Type':'application/json'},
        body: JSON.stringify({ model:'gpt-4o-mini', messages, max_tokens:600 })
      })
      const d = await r.json()
      const txt = d.choices?.[0]?.message?.content
      if (txt) return txt.trim()
    } catch {}
  }

  // ── Fallback Groq ──
  if (groqKey) {
    try {
      const r = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method:'POST',
        headers:{'Authorization':`Bearer ${groqKey}`,'Content-Type':'application/json'},
        body: JSON.stringify({ model:'llama3-70b-8192', messages:[{role:'system',content:systemPrompt},{role:'user',content:promptFinal}], max_tokens:600 })
      })
      const d = await r.json()
      const txt = d.choices?.[0]?.message?.content
      if (txt) return txt.trim()
    } catch {}
  }

  return null
}

// ─────────────────────────────────────────────────────────────────────────────
// Componente principal
// ─────────────────────────────────────────────────────────────────────────────
export default function WhatsappInbox() {
  const router = useRouter()
  const [user, setUser]               = useState(null)
  const [cfg,  setCfg]                = useState({})
  const [empresaId, setEmpresaId]     = useState(null)
  const [loading, setLoading]         = useState(true)
  const [idx, setIdx]                 = useState({})
  const [convAtiva, setConvAtiva]     = useState(null)
  const [conv, setConv]               = useState(null)
  const [abaAtiva, setAbaAtiva]       = useState('automacao')
  const [busca, setBusca]             = useState('')
  const [enviando, setEnviando]       = useState(false)
  const [msgInput, setMsgInput]       = useState('')
  const [loadingConv, setLoadingConv] = useState(false)
  const [sidebarAberta, setSidebarAberta] = useState(false)
  const [showTransferir, setShowTransferir] = useState(false)
  const [showCRM, setShowCRM]         = useState(false)
  const [showAgendamento, setShowAgendamento] = useState(false)
  const [showBuscaGlobal, setShowBuscaGlobal] = useState(false)
  const [agentes, setAgentes]         = useState([])
  const [protocolo, setProtocolo]     = useState(null)
  const [toast, setToast]             = useState(null)
  const pollingRef   = useRef(null)
  const msgEndRef    = useRef(null)
  const mensagensRef = useRef(null)
  const idxRef       = useRef({})

  const showToast = (msg, tipo='ok') => { setToast({msg,tipo}); setTimeout(()=>setToast(null),3500) }

  // Departamentos configurados no Agente IA
  const departamentos = cfg.agentConfig?.departamentos || cfg.departamentos || []

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
      // ✅ FIX: Sempre recarrega índice para atualizar badges
      const novo = await carregarIndice(empresaId, true)
      if (convAtiva) {
        // ✅ FIX: Sempre recarrega a conversa ativa — não depende apenas do updatedAt
        // porque o bot pode adicionar mensagens sem atualizar o índice corretamente
        await carregarConv(empresaId, convAtiva, true)
      }
    }, 2500)  // reduzido para 2.5s para resposta mais rápida
    return () => clearInterval(pollingRef.current)
  }, [empresaId, convAtiva])

  // ✅ FIX AUTO-SCROLL: função utilitária reutilizável
  const scrollParaBaixo = useCallback((behavior = 'smooth') => {
    setTimeout(() => {
      if (msgEndRef.current) {
        msgEndRef.current.scrollIntoView({ behavior, block: 'end' })
      } else if (mensagensRef.current) {
        mensagensRef.current.scrollTop = mensagensRef.current.scrollHeight + 9999
      }
    }, 50)
  }, [])

  useEffect(() => {
    scrollParaBaixo('instant')
  }, [convAtiva])

  useEffect(() => {
    // ✅ FIX: Scroll sempre que chegarem novas mensagens ou hora da última mensagem mudar
    scrollParaBaixo('smooth')
  }, [conv?.mensagens?.length, conv?.ultimaAt, conv?.ultimaDe])

  // Atalho teclado: Ctrl+K para busca global
  useEffect(() => {
    const handler = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') { e.preventDefault(); setShowBuscaGlobal(true) }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

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

        // ✅ FIX 1: Se conversa estava finalizada e chegou nova mensagem → volta para automação
        if (c.status === 'finalizado' && c.naoLidas > 0) {
          c.status = 'automacao'
          c.botPausado = false
          c.protocolo = null
          c.finalizadoEm = null
          // Limpa no índice também
          const novoIdx = { ...idxRef.current, [numero]: { ...(idxRef.current[numero]||{}), status: 'automacao', naoLidas: 0, updatedAt: new Date().toISOString() } }
          idxRef.current = novoIdx; setIdx(novoIdx)
          await supabase.from('vx_storage').upsert({ key:`wpp_idx:${eid}`, value:JSON.stringify(novoIdx), updated_at:new Date().toISOString() }, { onConflict:'key' })
        }

        setConv(c)
        if (c.protocolo) setProtocolo(c.protocolo)
        // ✅ FIX: Zera naoLidas sempre ao abrir a conversa (não só se > 0)
        // e salva no Supabase e no estado local de forma consistente
        if ((c.naoLidas || 0) > 0 || !silencioso) {
          c.naoLidas = 0
          // Salva conversa com naoLidas=0
          await supabase.from('vx_storage').upsert(
            { key:`wpp_conv:${eid}:${numero}`, value:JSON.stringify(c), updated_at:new Date().toISOString() },
            { onConflict:'key' }
          )
          // ✅ FIX: Atualiza TAMBÉM o índice no Supabase (não só o state local)
          const idxAtual = { ...idxRef.current }
          idxAtual[numero] = { ...(idxAtual[numero]||{}), naoLidas: 0, updatedAt: new Date().toISOString() }
          idxRef.current = idxAtual
          setIdx(idxAtual)
          await supabase.from('vx_storage').upsert(
            { key:`wpp_idx:${eid}`, value:JSON.stringify(idxAtual), updated_at:new Date().toISOString() },
            { onConflict:'key' }
          )
        }
        // ✅ FIX: Scroll sempre para última mensagem, independente de silencioso
        setTimeout(() => {
          if (msgEndRef.current) {
            msgEndRef.current.scrollIntoView({ behavior: 'smooth', block: 'end' })
          } else if (mensagensRef.current) {
            mensagensRef.current.scrollTop = mensagensRef.current.scrollHeight + 9999
          }
        }, 80)
      }
    } catch {}
    if (!silencioso) setLoadingConv(false)
  }

  async function abrirConv(numero, statusHint) {
    // Se vier de busca global e a aba não bater, troca a aba
    if (statusHint && statusHint !== abaAtiva) setAbaAtiva(statusHint)
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
    // Salva protocolo no índice para busca global
    const novoIdx = {...idxRef.current,[convAtiva]:{...(idxRef.current[convAtiva]||{}),protocolo:prot,status:'finalizado'}}
    idxRef.current=novoIdx; setIdx(novoIdx)
    await supabase.from('vx_storage').upsert({key:`wpp_idx:${empresaId}`,value:JSON.stringify(novoIdx),updated_at:new Date().toISOString()},{onConflict:'key'})
    try {
      await fetch('/api/wpp/send',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({empresaId,numero:convAtiva,mensagem:`✅ Atendimento encerrado.\n\n📋 *Protocolo: ${prot}*\n\nObrigado por entrar em contato! 😊`})})
      await carregarConv(empresaId, convAtiva, true)
    } catch {}
    showToast(`📋 Protocolo: ${prot}`)
  }

  async function transferirParaUsuario(ag) {
    await mudarStatus('aguardando',{agenteId:ag.user_id||ag.id,agenteNome:ag.nome,botPausado:true,departamentoId:null,departamentoNome:null})
    setShowTransferir(false); showToast(`🔀 Transferido para ${ag.nome}`)
  }

  async function transferirParaDepto(depto) {
    // Se o departamento tiver agente IA, muda para automacao com contexto do depto
    const novoStatus = depto.agentIA ? 'automacao' : 'aguardando'
    await mudarStatus(novoStatus, {
      botPausado: !depto.agentIA,
      agenteId:   null,
      agenteNome: null,
      departamentoId:   depto.id,
      departamentoNome: depto.nome,
      departamentoIA:   depto.agentIA || false,
    })
    setShowTransferir(false)
    showToast(`🏢 Transferido para o depto. ${depto.nome}${depto.agentIA ? ' (IA ativa)' : ''}`)
  }

  async function toggleTag(tagId) {
    if (!conv) return
    const novasTags = (conv.tags||[]).includes(tagId) ? (conv.tags||[]).filter(t=>t!==tagId) : [...(conv.tags||[]),tagId]
    const c = {...conv,tags:novasTags}; setConv(c)
    await supabase.from('vx_storage').upsert({key:`wpp_conv:${empresaId}:${convAtiva}`,value:JSON.stringify(c),updated_at:new Date().toISOString()},{onConflict:'key'})
    setIdx(prev=>{const n={...prev,[convAtiva]:{...(prev[convAtiva]||{}),tags:novasTags}};idxRef.current=n;return n})
  }

  // Dispara resposta do agente IA de departamento
  async function dispararRespostaIA(mensagemCliente, mediaBase64=null, mediaTipo=null) {
    if (!conv) return
    const deptoId = conv.departamentoId
    const depto   = departamentos.find(d => d.id === deptoId) || {}
    if (!conv.departamentoIA && !depto.agentIA) return
    try {
      const resposta = await chamarAgenteIA({
        cfg, depto,
        mensagem:   mensagemCliente,
        historico:  (conv.mensagens || []).slice(-10),
        mediaBase64, mediaTipo,
      })
      if (resposta) {
        await fetch('/api/wpp/send',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({empresaId,numero:convAtiva,mensagem:resposta})})
        await carregarConv(empresaId, convAtiva, true)
      }
    } catch(e) { console.error('Agente IA depto:', e) }
  }

  const listaFiltrada = Object.values(idx)
    .filter(c=>c.status===abaAtiva)
    .filter(c=>!busca||(c.nome||'').toLowerCase().includes(busca.toLowerCase())||(c.numero||'').includes(busca))
    .sort((a,b)=>new Date(b.updatedAt||0)-new Date(a.updatedAt||0))

  const contadores = {}
  for (const aba of ABAS) contadores[aba] = Object.values(idx).filter(c=>c.status===aba).length

  const tagsDisp = cfg.wppTags?.length ? cfg.wppTags : TAGS_PADRAO
  const botAtivo = conv && !conv.botPausado && conv.status === 'automacao'
  const deptoAtual = conv?.departamentoId ? departamentos.find(d=>d.id===conv.departamentoId) : null

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

      {/* Modal Transferir — com suporte a departamentos */}
      {showTransferir && (
        <ModalTransferir
          agentes={agentes}
          departamentos={departamentos}
          onTransferirUsuario={transferirParaUsuario}
          onTransferirDepto={transferirParaDepto}
          onClose={()=>setShowTransferir(false)}
        />
      )}

      {showCRM && conv && (
        <ModalCRM conv={conv} empresaId={empresaId} user={user} cfg={cfg}
          onClose={()=>setShowCRM(false)}
          onSalvo={(neg)=>{
            supabase.from('vx_storage').select('value').eq('key',`cfg:${empresaId}`).maybeSingle().then(({data:r})=>{
              if(r?.value) setCfg(JSON.parse(r.value))
            })
            setShowCRM(false)
            showToast('✅ Negócio criado no CRM!')
            setTimeout(()=>router.push('/crm'), 1500)
          }}
        />
      )}

      {/* Modal Agendamento */}
      {showAgendamento && conv && (
        <ModalAgendamento
          conv={conv} empresaId={empresaId} cfg={cfg}
          onClose={()=>setShowAgendamento(false)}
          onAgendado={async (msgConfirm) => {
            setShowAgendamento(false)
            setMsgInput(msgConfirm)
            showToast('📅 Agendamento criado! Confirme o envio.')
          }}
        />
      )}

      {/* Modal Busca Global */}
      {showBuscaGlobal && (
        <ModalBuscaGlobal
          idx={idx}
          onClose={()=>setShowBuscaGlobal(false)}
          onAbrirConv={abrirConv}
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
            <div style={{display:'flex',gap:6}}>
              {/* Botão busca global */}
              <button onClick={()=>setShowBuscaGlobal(true)} className="btn-icon" title="Busca global (Ctrl+K)">🔍</button>
              <button onClick={()=>router.push('/configuracoes?tab=whatsapp')} className="btn-icon">⚙️</button>
            </div>
          </div>
          {/* Busca rápida na aba ativa */}
          <div className="busca-wrap">
            <span style={{fontSize:14,color:'var(--muted)'}}>🔍</span>
            <input className="busca-input" placeholder="Filtrar nesta aba..." value={busca} onChange={e=>setBusca(e.target.value)} />
            <button onClick={()=>setShowBuscaGlobal(true)} style={{background:'none',border:'1px solid #1e2d4a',borderRadius:6,padding:'4px 8px',color:'#64748b',cursor:'pointer',fontSize:10,fontFamily:'DM Mono,monospace',whiteSpace:'nowrap'}} title="Busca em todas as abas">
              Tudo
            </button>
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
                  <div style={{display:'flex',gap:6,flexWrap:'wrap',marginTop:2}}>
                    {c.departamentoNome && <span style={{fontSize:10,color:'#7c3aed'}}>🏢 {c.departamentoNome}</span>}
                    {c.instanciaId && (()=>{ const inst=(cfg.wppInbox?.instancias||[]).find(i=>i.id===c.instanciaId||i.instance===c.instanciaId); return inst?<span style={{fontSize:10,color:'#f59e0b'}}>📱 {inst.nome}</span>:null })()} 
                  </div>
                  {(c.tags||[]).length>0 && (
                    <div style={{display:'flex',gap:4,flexWrap:'wrap',marginTop:4}}>
                      {(c.tags||[]).slice(0,2).map(tid=>{ const t=tagsDisp.find(x=>x.id===tid); return t?<span key={tid} className="tag-chip" style={{borderColor:t.cor+'55',color:t.cor,background:t.cor+'15'}}>{t.label}</span>:null })}
                    </div>
                  )}
                </div>
                {(c.naoLidas||0)>0 && convAtiva!==c.numero && <span className="badge-naoLidas">{c.naoLidas}</span>}
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
              <div style={{display:'flex',gap:10,marginTop:20,flexWrap:'wrap',justifyContent:'center'}}>
                <button onClick={()=>router.push('/configuracoes?tab=whatsapp')} className="btn-primary">⚙️ Configurar WhatsApp</button>
                <button onClick={()=>setShowBuscaGlobal(true)} className="btn-primary" style={{background:'linear-gradient(135deg,#7c3aed,#5b21b6)'}}>🔍 Busca Global</button>
              </div>
            </div>
          ) : loadingConv ? (
            <div className="chat-vazio"><div style={{color:'var(--muted)',fontSize:14}}>Carregando...</div></div>
          ) : conv ? (
            <>
              <div className="chat-header">
                <button className="btn-back" onClick={()=>setConvAtiva(null)}>←</button>
                <Avatar nome={conv.nome} size={34} />
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontWeight:700,fontSize:14,color:'var(--text)',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',display:'flex',alignItems:'center',gap:6}}>{conv.nome||conv.numero}<span title="Atualizando em tempo real" style={{width:7,height:7,borderRadius:'50%',background:'#10b981',flexShrink:0,animation:'pulse 2s infinite'}}/></div>
                  <div style={{fontSize:11,color:'var(--muted)',display:'flex',gap:8,alignItems:'center',flexWrap:'wrap'}}>
                    <span>{conv.numero}</span>
                    {/* Número/instância de origem */}
                    {(()=>{ const insts=cfg.wppInbox?.instancias||[]; const instObj=conv.instanciaId?insts.find(i=>i.id===conv.instanciaId||i.instance===conv.instanciaId):null; return instObj?<span style={{color:'#f59e0b',fontWeight:700,fontSize:10,padding:'1px 6px',borderRadius:8,background:'rgba(245,158,11,.12)',border:'1px solid rgba(245,158,11,.3)'}}>📱 {instObj.nome}{instObj.numero?` · ${instObj.numero}`:''}</span>:null })()}
                    {conv.agenteNome&&<span style={{color:'#00d4ff'}}>· {conv.agenteNome}</span>}
                    {deptoAtual&&<span style={{color:'#7c3aed'}}>· 🏢 {deptoAtual.nome}</span>}
                    {conv.protocolo&&<span style={{color:'#10b981'}}>· 📋 {conv.protocolo}</span>}
                  </div>
                </div>
                {botAtivo && <div style={{fontSize:10,fontWeight:700,padding:'3px 8px',borderRadius:20,background:'rgba(124,58,237,.2)',color:'#7c3aed',border:'1px solid rgba(124,58,237,.4)',display:'flex',alignItems:'center',gap:4}}><span style={{width:6,height:6,borderRadius:'50%',background:'#7c3aed',display:'inline-block',animation:'pulse 1.5s infinite'}}/>BOT ATIVO</div>}
                {conv.departamentoIA && <div style={{fontSize:10,fontWeight:700,padding:'3px 8px',borderRadius:20,background:'rgba(0,212,255,.15)',color:'#00d4ff',border:'1px solid rgba(0,212,255,.35)',display:'flex',alignItems:'center',gap:4}}><span style={{width:6,height:6,borderRadius:'50%',background:'#00d4ff',display:'inline-block',animation:'pulse 1.5s infinite'}}/>IA DEPTO</div>}
                <div style={{fontSize:11,fontWeight:700,padding:'3px 10px',borderRadius:20,background:STATUS[conv.status]?.bg,color:STATUS[conv.status]?.cor,border:`1px solid ${STATUS[conv.status]?.cor}44`}}>{STATUS[conv.status]?.label}</div>
                <div style={{display:'flex',gap:5,flexWrap:'wrap'}}>
                  {conv.status!=='finalizado' && (
                    conv.status==='automacao'||botAtivo
                      ? <button onClick={assumirAtendimento} className="btn-acao verde">🙋 Assumir</button>
                      : <button onClick={reativarBot} className="btn-acao cinza">🤖 Bot</button>
                  )}
                  {conv.status!=='atendendo'&&conv.status!=='finalizado'&&<button onClick={assumirAtendimento} className="btn-acao verde">▶ Atender</button>}
                  {conv.status==='atendendo'&&<button onClick={()=>mudarStatus('aguardando')} className="btn-acao amarelo">⏸ Aguardar</button>}
                  {conv.status!=='finalizado'&&<>
                    <button onClick={()=>setShowTransferir(true)} className="btn-acao cinza">🔀 Transferir</button>
                    <button onClick={finalizarComProtocolo} className="btn-acao cinza">✓ Finalizar</button>
                  </>}
                  <button onClick={()=>setSidebarAberta(!sidebarAberta)} className="btn-icon">ℹ️</button>
                </div>
              </div>

              {protocolo && <div style={{padding:'7px 16px',background:'rgba(16,185,129,.1)',borderBottom:'1px solid rgba(16,185,129,.2)',fontSize:12,color:'#10b981'}}>📋 Protocolo: <strong>{protocolo}</strong></div>}
              {conv.agenteNome&&conv.status!=='automacao'&&<div style={{padding:'5px 16px',background:'rgba(0,212,255,.05)',borderBottom:'1px solid rgba(0,212,255,.1)',fontSize:11,color:'#64748b'}}>👤 Atendido por: <span style={{color:'#00d4ff'}}>{conv.agenteNome}</span></div>}
              {deptoAtual&&<div style={{padding:'5px 16px',background:'rgba(124,58,237,.05)',borderBottom:'1px solid rgba(124,58,237,.15)',fontSize:11,color:'#64748b'}}>🏢 Departamento: <span style={{color:'#7c3aed'}}>{deptoAtual.nome}</span>{conv.departamentoIA&&<span style={{marginLeft:8,color:'#00d4ff'}}>· Agente IA ativo</span>}</div>}

              <div className="mensagens" ref={mensagensRef}>
                {(conv.mensagens||[]).map((m,idx)=>{
                  if (!m) return null
                  // Compatibilidade: campo 'de' ou 'fromMe', campo 'at' ou 'timestamp'
                  const fromMe = m.de === 'empresa' || m.fromMe === true
                  const hora   = m.at || m.timestamp || m.criadoEm || null
                  const texto  = m.texto || m.body || m.message || ''
                  const tipo   = m.tipo || m.type || 'text'

                  const resolverMidia = (msg) => {
                    try {
                      if (msg.mediaBase64) {
                        const mime = msg.mimetype || (
                          tipo === 'image'    ? 'image/jpeg'  :
                          tipo === 'audio'    ? 'audio/ogg'   :
                          tipo === 'video'    ? 'video/mp4'   :
                          tipo === 'sticker'  ? 'image/webp'  :
                          tipo === 'document' ? 'application/pdf' : 'application/octet-stream'
                        )
                        const b64 = msg.mediaBase64.startsWith('data:')
                          ? msg.mediaBase64
                          : `data:${mime};base64,${msg.mediaBase64}`
                        return b64
                      }
                      if (msg.mediaUrl) return msg.mediaUrl
                      if (msg.mediaId && conv?.instancia) {
                        return `/api/wpp/media?empresaId=${empresaId}&instancia=${encodeURIComponent(conv.instancia)}&mediaId=${encodeURIComponent(msg.mediaId)}`
                      }
                      if (msg.id && conv?.instancia && tipo !== 'text') {
                        return `/api/wpp/media?empresaId=${empresaId}&instancia=${encodeURIComponent(conv.instancia)}&mediaId=${encodeURIComponent(msg.id)}`
                      }
                    } catch {}
                    return null
                  }
                  const mediaResolvida = resolverMidia(m)

                  return (
                  <div key={m.id||idx} className={`msg-wrap ${fromMe?'enviada':'recebida'}`}>
                    <div className={`msg-bubble ${fromMe?'enviada':'recebida'}`}>
                      {tipo==='image'&&mediaResolvida&&<img src={mediaResolvida} alt="img" style={{maxWidth:220,borderRadius:8,display:'block',marginBottom:4}} onError={e=>{e.target.style.display='none'}}/>}
                      {tipo==='audio'&&mediaResolvida&&(
                        <audio controls style={{width:'100%',marginBottom:4,maxWidth:260}}>
                          <source src={mediaResolvida} type={m.mimetype||'audio/ogg'}/>
                          <source src={mediaResolvida}/>
                        </audio>
                      )}
                      {tipo==='video'&&mediaResolvida&&(
                        <video controls style={{maxWidth:220,borderRadius:8,display:'block',marginBottom:4}}>
                          <source src={mediaResolvida} type={m.mimetype||'video/mp4'}/>
                          <source src={mediaResolvida}/>
                        </video>
                      )}
                      {(tipo==='image'||tipo==='audio'||tipo==='video'||tipo==='document')&&!mediaResolvida&&(
                        <div style={{padding:'8px 12px',background:'rgba(0,212,255,.08)',border:'1px solid rgba(0,212,255,.2)',borderRadius:8,marginBottom:4,fontSize:12,color:'#00d4ff',display:'flex',alignItems:'center',gap:8,flexWrap:'wrap'}}>
                          <span>{tipo==='image'?'🖼':tipo==='audio'?'🎵':tipo==='video'?'🎬':'📄'}</span>
                          <span>{tipo==='image'?'Imagem':tipo==='audio'?'Áudio':tipo==='video'?'Vídeo':'Documento'} recebido</span>
                          {(m.mediaId||m.id) && conv?.instancia && (
                            <a href={`/api/wpp/media?empresaId=${empresaId}&instancia=${encodeURIComponent(conv.instancia)}&mediaId=${encodeURIComponent(m.mediaId||m.id)}`}
                              target="_blank" rel="noreferrer"
                              style={{marginLeft:'auto',padding:'3px 10px',background:'rgba(0,212,255,.15)',border:'1px solid rgba(0,212,255,.3)',borderRadius:6,color:'#00d4ff',textDecoration:'none',fontSize:11,fontWeight:600}}>
                              ⬇ Ver
                            </a>
                          )}
                        </div>
                      )}
                      {tipo==='document'&&(
                        <div style={{padding:'8px 12px',background:'rgba(124,58,237,.08)',border:'1px solid rgba(124,58,237,.2)',borderRadius:8,marginBottom:4,fontSize:12,color:'#a78bfa',display:'flex',alignItems:'center',gap:6}}>
                          <span>📎</span>
                          <span>{m.nomeArquivo||m.fileName||'Documento'}</span>
                          {mediaResolvida&&<a href={mediaResolvida} download={m.nomeArquivo||'arquivo'} style={{color:'#7c3aed',marginLeft:4}}>⬇️</a>}
                        </div>
                      )}
                      <div style={{fontSize:13,lineHeight:1.55,whiteSpace:'pre-wrap',wordBreak:'break-word'}}>{texto}</div>
                      <div className="msg-hora">{fmtHora(hora)}</div>
                    </div>
                  </div>
                  )
                })}
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
              <button onClick={()=>setSidebarAberta(false)} className="btn-icon" style={{fontSize:16}}>✕</button>
            </div>
            <div style={{padding:'14px 16px'}}>
              <div className="det-card" style={{marginBottom:14}}>
                <Avatar nome={conv.nome} size={48} />
                <div style={{fontFamily:'Syne,sans-serif',fontWeight:700,fontSize:14,color:'var(--text)',marginTop:10,textAlign:'center'}}>{conv.nome||conv.numero}</div>
                <div style={{fontSize:11,color:'var(--muted)',marginTop:3}}>{conv.numero}</div>
                {protocolo&&<div style={{marginTop:8,fontSize:11,color:'var(--accent3)',background:'rgba(16,185,129,.1)',border:'1px solid rgba(16,185,129,.25)',borderRadius:6,padding:'3px 10px'}}>📋 {protocolo}</div>}
                {deptoAtual&&<div style={{marginTop:6,fontSize:11,color:'#7c3aed',background:'rgba(124,58,237,.1)',border:'1px solid rgba(124,58,237,.25)',borderRadius:6,padding:'3px 10px'}}>🏢 {deptoAtual.nome}</div>}
              </div>

              <div className="det-label" style={{marginBottom:8}}>🏷️ Tags</div>
              <div style={{display:'flex',flexWrap:'wrap',gap:6,marginBottom:16}}>
                {tagsDisp.map(t=>{
                  const on=(conv.tags||[]).includes(t.id)
                  return <button key={t.id} onClick={()=>toggleTag(t.id)} className="tag-chip" style={{borderColor:on?t.cor:t.cor+'44',color:on?t.cor:t.cor+'88',background:on?t.cor+'20':'transparent',cursor:'pointer'}}>{t.label}</button>
                })}
              </div>

              <div className="det-label" style={{marginBottom:8}}>📊 Status</div>
              <div style={{display:'flex',flexDirection:'column',gap:6,marginBottom:16}}>
                {Object.entries(STATUS).map(([id,s])=>(
                  <button key={id} onClick={()=>mudarStatus(id)}
                    style={{padding:'6px 10px',borderRadius:7,border:`1.5px solid ${conv.status===id?s.cor:s.cor+'33'}`,background:conv.status===id?s.bg:'transparent',color:conv.status===id?s.cor:s.cor+'88',fontFamily:'DM Mono,monospace',fontSize:11,cursor:'pointer',textAlign:'left',fontWeight:conv.status===id?700:400}}>
                    {s.label}
                  </button>
                ))}
              </div>

              <div className="det-label" style={{marginBottom:8}}>⚡ Ações Rápidas</div>
              <div style={{display:'flex',flexDirection:'column',gap:8}}>
                <button onClick={assumirAtendimento} className="btn-acao-full">🙋 Assumir (pausar bot)</button>
                <button onClick={()=>setShowTransferir(true)} className="btn-acao-full">🔀 Transferir</button>
                <button onClick={()=>{setSidebarAberta(false);setShowAgendamento(true)}} className="btn-acao-full" style={{color:'#00d4ff',borderColor:'rgba(0,212,255,.3)'}}>📅 Agendar Reunião</button>
                <button onClick={finalizarComProtocolo} className="btn-acao-full">📋 Finalizar c/ Protocolo</button>
                <button onClick={()=>{setSidebarAberta(false);setShowCRM(true)}} className="btn-acao-full" style={{color:'#10b981',borderColor:'rgba(16,185,129,.3)'}}>🤝 Abrir no CRM</button>
                <button onClick={()=>{setMsgInput(`Olá! Aqui é da equipe ${cfg.company||'Vivanexa'}. Como posso ajudá-lo hoje? 😊`);setSidebarAberta(false)}} className="btn-acao-full">👋 Saudação padrão</button>
                <button onClick={()=>router.push('/chat')} className="btn-acao-full">💬 Gerar Proposta</button>
                <button onClick={()=>setShowBuscaGlobal(true)} className="btn-acao-full">🔍 Busca Global</button>
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
  @keyframes pulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.5;transform:scale(1.3)}}
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
  .sidebar-det{width:260px;min-width:230px;border-left:1px solid var(--border);background:var(--surface);overflow-y:auto;flex-shrink:0;height:100%}
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
