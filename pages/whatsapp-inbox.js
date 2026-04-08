// pages/whatsapp-inbox.js — v4
// ✅ Melhorias v4:
//   1. Modal "Abrir no CRM" expandido com busca automática CNPJ (BrasilAPI) e CEP (ViaCEP)
//   2. Ao salvar: cria negócio em crm_negocios E salva/atualiza cliente em cfg.clients
//   3. Campos completos: razão social, fantasia, endereço, bairro, cidade, UF, CEP, regime

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

// ─────────────────────────────────────────────────────────────────────────────
// APIs externas (mesma lógica do index_funcionando_.html)
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
// Modal "Abrir no CRM" — versão expandida com CNPJ/CEP automático
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
    // Negócio
    titulo:      conv.nome ? `Atendimento – ${conv.nome}` : 'Novo Lead WhatsApp',
    etapa:       'lead',
    origem:      'whatsapp',
    observacoes: `Lead via WhatsApp em ${new Date().toLocaleDateString('pt-BR')}`,
    // Cliente / contato
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
  const [aba,          setAba]          = useState('negocio') // negocio | endereco

  const inp = { width:'100%', background:'#1a2540', border:'1px solid #1e2d4a', borderRadius:8, padding:'9px 12px', color:'#e2e8f0', fontFamily:'DM Mono,monospace', fontSize:13, outline:'none' }
  const lbl = { fontSize:10, color:'#64748b', display:'block', marginBottom:4, letterSpacing:.5, textTransform:'uppercase' }
  const set = (k, v) => setForm(p => ({...p, [k]: v}))

  // ── Busca CNPJ ──────────────────────────────────────
  async function buscarCNPJ() {
    const cnpj = form.cnpj.replace(/\D/g,'')
    if (cnpj.length !== 14) { setCnpjMsg('⚠️ CNPJ deve ter 14 dígitos.'); return }

    // Verificar base local primeiro
    const localClientes = cfg.clients || []
    const local = localClientes.find(c => c.doc === cnpj)
    if (local) {
      setForm(p => ({
        ...p,
        razao:    p.razao    || local.razao    || '',
        fantasia: p.fantasia || local.fantasia || '',
        email:    p.email    || local.email    || '',
        telefone: p.telefone || local.tel      || '',
        cep:      p.cep      || local.cep      || '',
        end:      p.end      || local.end      || '',
        numero:   p.numero   || local.numero   || '',
        complemento: p.complemento || local.complemento || '',
        bairro:   p.bairro   || local.bairro   || '',
        cidade:   p.cidade   || local.cidade   || '',
        uf:       p.uf       || local.uf       || '',
        regime:   p.regime   || local.regime   || '',
        nome:     p.nome     || local.fantasia || local.razao || '',
      }))
      setCnpjMsg('✅ Dados encontrados na base local!')
      return
    }

    // API externa
    setBuscandoCNPJ(true); setCnpjMsg('⏳ Consultando Receita Federal...')
    const d = await buscarCNPJAPI(cnpj)
    if (d) {
      setForm(p => ({
        ...p,
        razao:    p.razao    || d.razao,
        fantasia: p.fantasia || d.fantasia,
        email:    p.email    || d.email,
        telefone: p.telefone || d.tel,
        cep:      p.cep      || d.cep,
        end:      p.end      || d.end,
        numero:   p.numero   || d.numero,
        complemento: p.complemento || d.complemento,
        bairro:   p.bairro   || d.bairro,
        cidade:   p.cidade   || d.cidade,
        uf:       p.uf       || d.uf,
        nome:     p.nome     || d.fantasia || d.razao,
      }))
      setCnpjMsg('✅ Dados da Receita Federal carregados!')
      // Se veio CEP mas sem endereço, busca via ViaCEP
      if (d.cep && !d.end) {
        const ce = await buscarCEPAPI(d.cep)
        if (ce) setForm(p => ({ ...p, end: p.end||ce.end, bairro: p.bairro||ce.bairro, cidade: p.cidade||ce.cidade, uf: p.uf||ce.uf }))
      }
    } else {
      setCnpjMsg('❌ CNPJ não localizado na Receita Federal.')
    }
    setBuscandoCNPJ(false)
  }

  // ── Busca CEP ───────────────────────────────────────
  async function buscarCEP() {
    const cep = form.cep.replace(/\D/g,'')
    if (cep.length !== 8) return
    setBuscandoCEP(true)
    const d = await buscarCEPAPI(cep)
    if (d) setForm(p => ({
      ...p,
      end:    p.end    || d.end,
      bairro: p.bairro || d.bairro,
      cidade: p.cidade || d.cidade,
      uf:     p.uf     || d.uf,
    }))
    setBuscandoCEP(false)
  }

  // ── Salvar ─────────────────────────────────────────
  async function salvar() {
    if (!form.titulo.trim() || !form.nome.trim()) { setErro('Título e nome são obrigatórios.'); return }
    setSalvando(true); setErro('')
    try {
      const { data: row } = await supabase.from('vx_storage').select('value').eq('key',`cfg:${empresaId}`).maybeSingle()
      const currentCfg = row?.value ? JSON.parse(row.value) : {}

      // 1. Criar negócio no funil CRM
      const novo = {
        id:           `neg_${Date.now()}`,
        titulo:       form.titulo,
        etapa:        form.etapa,
        nome:         form.razao  || form.nome,
        fantasia:     form.fantasia || form.nome,
        cnpj:         form.cnpj.replace(/\D/g,''),
        email:        form.email,
        telefone:     form.telefone,
        endereco:     [form.end, form.numero, form.complemento].filter(Boolean).join(', '),
        cidade:       form.cidade,
        uf:           form.uf,
        observacoes:  form.observacoes,
        origem:       'whatsapp',
        responsavel:  user?.nome || user?.email || '',
        criadoEm:     new Date().toISOString(),
        atualizadoEm: new Date().toISOString(),
        wppNumero:    conv.numero,
      }
      currentCfg.crm_negocios = [...(currentCfg.crm_negocios||[]), novo]

      // 2. Salvar/atualizar na base de clientes (cfg.clients) se marcado
      if (form.salvarCliente) {
        const docLimpo = form.cnpj.replace(/\D/g,'')
        const clientes = currentCfg.clients || []
        const clienteData = {
          id:          `cli_${Date.now()}`,
          doc:         docLimpo,
          fantasia:    form.fantasia || form.nome,
          razao:       form.razao,
          contato:     form.nome,
          email:       form.email,
          tel:         form.telefone,
          cep:         form.cep.replace(/\D/g,''),
          end:         form.end,
          numero:      form.numero,
          complemento: form.complemento,
          bairro:      form.bairro,
          cidade:      form.cidade,
          uf:          form.uf,
          regime:      form.regime,
          updatedAt:   new Date().toLocaleDateString('pt-BR'),
        }
        const idxExistente = docLimpo ? clientes.findIndex(c => c.doc === docLimpo) : -1
        if (idxExistente >= 0) {
          // Atualizar cliente existente (mesclar — não sobrescreve campos preenchidos)
          clientes[idxExistente] = { ...clientes[idxExistente], ...clienteData, id: clientes[idxExistente].id }
        } else {
          clientes.push(clienteData)
        }
        currentCfg.clients = clientes
      }

      await supabase.from('vx_storage').upsert({
        key:        `cfg:${empresaId}`,
        value:      JSON.stringify(currentCfg),
        updated_at: new Date().toISOString(),
      }, { onConflict: 'key' })

      onSalvo(novo)
    } catch(e) { setErro('Erro: ' + e.message) }
    setSalvando(false)
  }

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.80)', zIndex:2000, display:'flex', alignItems:'center', justifyContent:'center', padding:16 }} onClick={onClose}>
      <div style={{ background:'#111827', border:'1px solid #1e2d4a', borderRadius:16, width:'100%', maxWidth:540, maxHeight:'92vh', overflowY:'auto', display:'flex', flexDirection:'column' }} onClick={e=>e.stopPropagation()}>

        {/* Header */}
        <div style={{ padding:'20px 24px 0', display:'flex', alignItems:'center', justifyContent:'space-between', flexShrink:0 }}>
          <div style={{ fontFamily:'Syne,sans-serif', fontWeight:700, fontSize:17, color:'#e2e8f0' }}>🤝 Criar Negócio no CRM</div>
          <button onClick={onClose} style={{ background:'none', border:'none', color:'#64748b', fontSize:22, cursor:'pointer' }}>✕</button>
        </div>

        {/* Abas internas */}
        <div style={{ display:'flex', gap:0, padding:'14px 24px 0', borderBottom:'1px solid #1e2d4a', flexShrink:0 }}>
          {[['negocio','📋 Negócio'],['cliente','🏢 Cliente/Endereço']].map(([id,label])=>(
            <button key={id} onClick={()=>setAba(id)} style={{ padding:'7px 16px', border:'none', borderBottom:`2px solid ${aba===id?'#00d4ff':'transparent'}`, background:'none', color:aba===id?'#00d4ff':'#64748b', fontFamily:'DM Mono,monospace', fontSize:12, cursor:'pointer', transition:'all .15s' }}>
              {label}
            </button>
          ))}
        </div>

        {/* Body */}
        <div style={{ padding:'20px 24px', flex:1, overflowY:'auto' }}>

          {/* ── ABA NEGÓCIO ── */}
          {aba === 'negocio' && (
            <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
              <div><label style={lbl}>Título *</label><input style={inp} value={form.titulo} onChange={e=>set('titulo',e.target.value)} /></div>
              <div><label style={lbl}>Nome do Contato *</label><input style={inp} value={form.nome} onChange={e=>set('nome',e.target.value)} /></div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
                <div><label style={lbl}>Telefone</label><input style={inp} value={form.telefone} onChange={e=>set('telefone',e.target.value)} /></div>
                <div><label style={lbl}>E-mail</label><input style={inp} value={form.email} onChange={e=>set('email',e.target.value)} placeholder="email@empresa.com" /></div>
              </div>
              <div><label style={lbl}>Etapa do Funil</label>
                <select style={{...inp,cursor:'pointer'}} value={form.etapa} onChange={e=>set('etapa',e.target.value)}>
                  {etapas.map(et=><option key={et.id} value={et.id}>{et.label}</option>)}
                </select>
              </div>
              <div><label style={lbl}>Observações</label><textarea style={{...inp,resize:'vertical',minHeight:72}} value={form.observacoes} onChange={e=>set('observacoes',e.target.value)} /></div>

              {/* Aviso de aba cliente */}
              <div style={{ background:'rgba(0,212,255,.06)', border:'1px solid rgba(0,212,255,.15)', borderRadius:8, padding:'10px 14px', fontSize:12, color:'#64748b' }}>
                💡 Acesse a aba <strong style={{color:'#00d4ff'}}>Cliente/Endereço</strong> para preencher CNPJ, razão social e endereço completo automaticamente.
              </div>
            </div>
          )}

          {/* ── ABA CLIENTE / ENDEREÇO ── */}
          {aba === 'cliente' && (
            <div style={{ display:'flex', flexDirection:'column', gap:14 }}>

              {/* Bloco CNPJ */}
              <div style={{ background:'#1a2540', border:'1px solid rgba(0,212,255,.2)', borderRadius:10, padding:14 }}>
                <div style={{ fontSize:10, color:'#00d4ff', fontWeight:700, letterSpacing:1, textTransform:'uppercase', marginBottom:8 }}>🔍 Busca automática por CNPJ</div>
                <div style={{ display:'flex', gap:8 }}>
                  <input style={{...inp,flex:1}} value={form.cnpj} onChange={e=>set('cnpj',e.target.value)} placeholder="00.000.000/0001-00" onKeyDown={e=>{ if(e.key==='Enter') buscarCNPJ() }}/>
                  <button onClick={buscarCNPJ} disabled={buscandoCNPJ} style={{ padding:'9px 14px', borderRadius:8, background:'rgba(0,212,255,.15)', border:'1px solid rgba(0,212,255,.3)', color:'#00d4ff', fontSize:12, cursor:'pointer', whiteSpace:'nowrap', fontFamily:'DM Mono,monospace', opacity:buscandoCNPJ?.6:1 }}>
                    {buscandoCNPJ ? '⏳...' : '🔍 Buscar'}
                  </button>
                </div>
                {cnpjMsg && (
                  <div style={{ marginTop:8, fontSize:12, color: cnpjMsg.startsWith('✅') ? '#10b981' : cnpjMsg.startsWith('❌') ? '#ef4444' : '#64748b' }}>
                    {cnpjMsg}
                  </div>
                )}
              </div>

              {/* Dados da empresa */}
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
                <div><label style={lbl}>Nome Fantasia</label><input style={inp} value={form.fantasia} onChange={e=>set('fantasia',e.target.value)} /></div>
                <div><label style={lbl}>Razão Social</label><input style={inp} value={form.razao} onChange={e=>set('razao',e.target.value)} /></div>
              </div>

              <div>
                <label style={lbl}>Regime Tributário</label>
                <select style={{...inp,cursor:'pointer'}} value={form.regime} onChange={e=>set('regime',e.target.value)}>
                  <option value="">— Selecionar —</option>
                  <option>Simples Nacional</option>
                  <option>Lucro Presumido</option>
                  <option>Lucro Real</option>
                  <option>MEI</option>
                </select>
              </div>

              {/* CEP com busca automática */}
              <div style={{ background:'#1a2540', border:'1px solid rgba(0,212,255,.1)', borderRadius:10, padding:14 }}>
                <div style={{ fontSize:10, color:'#64748b', fontWeight:700, letterSpacing:1, textTransform:'uppercase', marginBottom:10 }}>📍 Endereço</div>
                <div style={{ display:'flex', gap:8, marginBottom:12 }}>
                  <div style={{flex:1}}>
                    <label style={lbl}>CEP</label>
                    <input style={inp} value={form.cep} onChange={e=>set('cep',e.target.value)} onBlur={buscarCEP} placeholder="00000-000" />
                  </div>
                  <div style={{ paddingTop:20 }}>
                    {buscandoCEP && <span style={{ fontSize:11, color:'#64748b' }}>🔍</span>}
                  </div>
                </div>
                <div style={{ display:'grid', gridTemplateColumns:'2fr 1fr 1fr', gap:10, marginBottom:10 }}>
                  <div><label style={lbl}>Logradouro</label><input style={inp} value={form.end} onChange={e=>set('end',e.target.value)} /></div>
                  <div><label style={lbl}>Número</label><input style={inp} value={form.numero} onChange={e=>set('numero',e.target.value)} /></div>
                  <div><label style={lbl}>Complemento</label><input style={inp} value={form.complemento} onChange={e=>set('complemento',e.target.value)} /></div>
                </div>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:10 }}>
                  <div><label style={lbl}>Bairro</label><input style={inp} value={form.bairro} onChange={e=>set('bairro',e.target.value)} /></div>
                  <div><label style={lbl}>Cidade</label><input style={inp} value={form.cidade} onChange={e=>set('cidade',e.target.value)} /></div>
                  <div><label style={lbl}>UF</label><input style={inp} value={form.uf} onChange={e=>set('uf',e.target.value)} maxLength={2} /></div>
                </div>
              </div>

              {/* Opção salvar cliente */}
              <label style={{ display:'flex', alignItems:'center', gap:10, cursor:'pointer', fontSize:13, color:'#e2e8f0', padding:'10px 14px', background:'rgba(16,185,129,.06)', border:'1px solid rgba(16,185,129,.2)', borderRadius:8 }}>
                <input type="checkbox" checked={form.salvarCliente} onChange={e=>set('salvarCliente',e.target.checked)} style={{ width:15, height:15, accentColor:'#10b981', cursor:'pointer' }} />
                <span>Salvar também na base de <strong style={{color:'#10b981'}}>Clientes</strong></span>
              </label>
            </div>
          )}
        </div>

        {/* Footer */}
        {erro && <div style={{ margin:'0 24px', padding:'8px 12px', background:'rgba(239,68,68,.1)', border:'1px solid rgba(239,68,68,.3)', borderRadius:8, fontSize:12, color:'#ef4444' }}>⚠️ {erro}</div>}
        <div style={{ display:'flex', gap:10, padding:'16px 24px', borderTop:'1px solid #1e2d4a', flexShrink:0 }}>
          <button onClick={onClose} style={{ flex:1, padding:10, background:'none', border:'1px solid #1e2d4a', color:'#64748b', borderRadius:10, cursor:'pointer', fontFamily:'DM Mono,monospace', fontSize:13 }}>Cancelar</button>
          <button onClick={salvar} disabled={salvando} style={{ flex:2, padding:10, background:'linear-gradient(135deg,#00d4ff,#0099bb)', border:'none', color:'#fff', borderRadius:10, cursor:salvando?'not-allowed':'pointer', fontFamily:'DM Mono,monospace', fontSize:13, fontWeight:600, opacity:salvando?.7:1 }}>
            {salvando ? '⏳ Salvando...' : '✅ Criar no CRM'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Componente principal
// ─────────────────────────────────────────────────────────────────────────────
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
          onSalvo={(neg)=>{
            // Recarregar cfg para refletir novos clientes
            supabase.from('vx_storage').select('value').eq('key',`cfg:${empresaId}`).maybeSingle().then(({data:r})=>{
              if(r?.value) setCfg(JSON.parse(r.value))
            })
            setShowCRM(false)
            showToast('✅ Negócio criado no CRM!')
            setTimeout(()=>router.push('/crm'), 1500)
          }}
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
              <button onClick={()=>setSidebarAberta(false)} className="btn-icon" style={{fontSize:16}}>✕</button>
            </div>
            <div style={{padding:'14px 16px'}}>
              <div className="det-card" style={{marginBottom:14}}>
                <Avatar nome={conv.nome} size={48} />
                <div style={{fontFamily:'Syne,sans-serif',fontWeight:700,fontSize:14,color:'var(--text)',marginTop:10,textAlign:'center'}}>{conv.nome||conv.numero}</div>
                <div style={{fontSize:11,color:'var(--muted)',marginTop:3}}>{conv.numero}</div>
                {protocolo&&<div style={{marginTop:8,fontSize:11,color:'var(--accent3)',background:'rgba(16,185,129,.1)',border:'1px solid rgba(16,185,129,.25)',borderRadius:6,padding:'3px 10px'}}>📋 {protocolo}</div>}
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
                <button onClick={finalizarComProtocolo} className="btn-acao-full">📋 Finalizar c/ Protocolo</button>
                <button onClick={()=>{setSidebarAberta(false);setShowCRM(true)}} className="btn-acao-full" style={{color:'#10b981',borderColor:'rgba(16,185,129,.3)'}}>🤝 Abrir no CRM</button>
                <button onClick={()=>{setMsgInput(`Olá! Aqui é da equipe ${cfg.company||'Vivanexa'}. Como posso ajudá-lo hoje? 😊`);setSidebarAberta(false)}} className="btn-acao-full">👋 Saudação padrão</button>
                <button onClick={()=>router.push('/chat')} className="btn-acao-full">💬 Gerar Proposta</button>
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
