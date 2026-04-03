// pages/chat.js — Assistente Comercial Vivanexa SaaS v5
// ============================================================
// v5 ADICIONA ao v4:
// • Manifesto de assinatura no contrato (token + signatários)
// • Contagem regressiva configurável (hora + texto)
// • Salvar clientes com histórico de documentos
// • Módulos clicáveis (chips) — toggle em cfg.modChips
// • Limpar mensagens ao iniciar nova consulta
// • Header clicável (logo e nome levam para /chat)
// • Suporte a templates de proposta/contrato via configurações
// • Tabela vertical de produtos no contrato
// • Logo da empresa no contrato
// • Validação de duplicatas de clientes
// • Botão Relatórios no header
// ============================================================

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/router'
import Head from 'next/head'
import { supabase } from '../lib/supabase'

// ── Config padrão ─────────────────────────────────────────────
const DEFAULT_CFG = {
  company:'VIVANEXA', slogan:'Assistente Comercial de Preços',
  discMode:'screen', discAdPct:50, discMenPct:0, discClosePct:40,
  unlimitedStrategy:true, modChips:true,
  closingHour:18, closingText:'',
  plans:[
    {id:'basic',   name:'Basic',    maxCnpjs:25,  users:1},
    {id:'pro',     name:'Pro',      maxCnpjs:80,  users:1},
    {id:'top',     name:'Top',      maxCnpjs:150, users:5},
    {id:'topplus', name:'Top Plus', maxCnpjs:999, users:999},
  ],
  prices:{
    'Gestão Fiscal':{basic:[478,318],pro:[590,409],top:[1032,547],topplus:[1398,679]},
    'CND':          {basic:[0,48],  pro:[0,90],  top:[0,150],   topplus:[0,200]},
    'XML':          {basic:[478,199],pro:[590,299],top:[1032,349],topplus:[1398,399]},
    'BIA':          {basic:[478,129],pro:[590,169],top:[1032,280],topplus:[1398,299]},
    'IF':           {basic:[1600,379],pro:[1600,619],top:[1600,920]},
    'EP':           {basic:[0,39],  pro:[0,82],  top:[0,167]},
  },
  vouchers:[],
  clients:[],
  productNames:{'Gestão Fiscal':'Gestão Fiscal','CND':'CND','XML':'XML','BIA':'BIA','IF':'Inteligência Fiscal','EP':'e-PROCESSOS','Tributos':'Tributos'},
}
const IF_NO_CNPJ = ['IF','Tributos','EP']
const ALL_MODS   = ['Gestão Fiscal','BIA','CND','XML','IF','EP','Tributos']

// ── Utilitários ──────────────────────────────────────────────
const fmt   = n => 'R$ ' + Number(n||0).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2})
const clean  = s => s.replace(/\D/g,'')
const isCNPJ = s => s.length===14
const isCPF  = s => s.length===11

function fmtDoc(s){
  if(!s)return'—'
  if(s.length===14)return s.replace(/
^
(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})
$
/,'$1.$2.$3/$4-$5')
  if(s.length===11)return s.replace(/
^
(\d{3})(\d{3})(\d{3})(\d{2})
$
/,'$1.$2.$3-$4')
  return s
}
function getPlan(n,plans){const s=[...plans].sort((a,b)=>a.maxCnpjs-b.maxCnpjs);for(const p of s)if(n<=p.maxCnpjs)return p.id;return s[s.length-1].id}
function getPlanLabel(id,plans){const p=(plans||[]).find(x=>x.id===id);return p?p.name:id}
function pn(key,cfg){return cfg?.productNames?.[key]||key}
function calcTrib(n){if(!n||n<=0)return 0;if(n<=50)return 169.90;if(n<=100)return 200;return 200+(n-100)*0.80}
function getPrice(mod,planId,cfg){const p=(cfg.prices[mod]||DEFAULT_CFG.prices[mod])||{};if(p[planId])return p[planId];const k=Object.keys(p);if(!k.length)return[0,0];return p[k[k.length-1]]||[0,0]}
function generateToken(){return Math.random().toString(36).slice(2)+Math.random().toString(36).slice(2)+Date.now().toString(36)}

// ── Cálculos ─────────────────────────────────────────────────
function calcFull(mods,plan,ifPlan,cnpjs,notas,cfg){
  const res=[];let tAd=0,tMen=0
  for(const mod of mods){
    if(mod==='IF'){const p=ifPlan||'basic',[aB,mB]=getPrice('IF',p,cfg),ad=aB*2,men=mB*1.2;res.push({name:pn('IF',cfg),ad,men,adD:ad,menD:men,isPrepaid:true,plan:p,isIF:true});tAd+=ad;tMen+=men;continue}
    if(mod==='Tributos'){const m=calcTrib(notas);res.push({name:pn('Tributos',cfg),ad:0,men:m,adD:0,menD:m,isTributos:true,notas});tMen+=m;continue}
    if(mod==='EP'){const ep=plan==='topplus'?'top':plan,[,mB]=getPrice('EP',ep,cfg),men=mB*1.2;res.push({name:pn('EP',cfg),ad:0,men,adD:0,menD:men,isEP:true,plan:ep});tMen+=men;continue}
    const [aB,mB]=getPrice(mod,plan,cfg);let ad=aB>0?Math.max(aB*2,1000):0;let men=mB*1.2;if(mod==='XML')men=Math.max(men,175);if(mod==='Gestão Fiscal')men=Math.max(men,200);res.push({name:pn(mod,cfg),ad,men,adD:ad,menD:men,plan});tAd+=ad;tMen+=men
  }
  return {results:res,tAd,tMen,tAdD:tAd,tMenD:tMen}
}
function calcDisc(mods,plan,ifPlan,cnpjs,notas,cfg){
  const {discAdPct=50,discMenPct=0,unlimitedStrategy=true}=cfg;const res=[];let tAd=0,tMen=0,tAdD=0,tMenD=0
  for(const mod of mods){
    if(mod==='IF'){const p=ifPlan||'basic',[aB,mB]=getPrice('IF',p,cfg),ad=aB*2,men=mB*1.2,adD=aB,menD=mB;res.push({name:pn('IF',cfg),ad,men,adD,menD,isPrepaid:true,plan:p,isIF:true});tAd+=ad;tMen+=men;tAdD+=adD;tMenD+=menD;continue}
    if(mod==='Tributos'){const m=calcTrib(notas);res.push({name:pn('Tributos',cfg),ad:0,men:m,adD:0,menD:m,isTributos:true,notas});tMen+=m;tMenD+=m;continue}
    if(mod==='EP'){const ep=plan==='topplus'?'top':plan,[,mB]=getPrice('EP',ep,cfg),men=mB*1.2,menD=mB;res.push({name:pn('EP',cfg),ad:0,men,adD:0,menD,isEP:true,plan:ep});tMen+=men;tMenD+=menD;continue}
    const [aB,mB]=getPrice(mod,plan,cfg);let ad=aB>0?Math.max(aB*2,1000):0;let men=mB*1.2;if(mod==='XML')men=Math.max(men,175);if(mod==='Gestão Fiscal')men=Math.max(men,200);const adD=aB>0?aB:0;const menD=mB;res.push({name:pn(mod,cfg),ad,men,adD,menD,plan});tAd+=ad;tMen+=men;tAdD+=adD;tMenD+=menD
  }
  const discAd=discAdPct/100;const discMen=discMenPct/100;const tAdFinal=tAd*(1-discAd);const tMenFinal=tMen*(1-discMen);const tAdDFinal=tAdD*(1-discAd);const tMenDFinal=tMenD*(1-discMen);res.forEach(r=>{if(!r.isTributos&&!r.isEP){r.ad=r.ad*(1-discAd);r.adD=r.adD*(1-discAd)}if(!r.isTributos&&!r.isEP&&!r.isIF){r.men=r.men*(1-discMen);r.menD=r.menD*(1-discMen)}});return {results:res,tAd:tAdFinal,tMen:tMenFinal,tAdD:tAdDFinal,tMenD:tMenDFinal}
}
function calcClosing(mods,plan,ifPlan,cnpjs,notas,cfg){
  const {discClosePct=40,unlimitedStrategy=true}=cfg;const res=[];let tAd=0,tMen=0;const cp=discClosePct/100
  for(const mod of mods){
    if(mod==='IF'){const p=ifPlan||'basic',[aB,mB]=getPrice('IF',p,cfg),ad=aB*(1-cp);res.push({name:pn('IF',cfg),ad,men:mB,isPrepaid:true,plan:p,isIF:true});tAd+=ad;tMen+=mB;continue}
    if(mod==='Tributos'){const m=calcTrib(notas);res.push({name:pn('Tributos',cfg),ad:0,men:m,isTributos:true});tMen+=m;continue}
    if(mod==='EP'){const ep=plan==='topplus'?'top':plan,[,mB]=getPrice('EP',ep,cfg);res.push({name:pn('EP',cfg),ad:0,men:mB,isEP:true,plan:ep});tMen+=mB;continue}
    const [aB]=getPrice(mod,plan,cfg);const ad=aB>0?Math.max(aB*(1-cp),0):0;let men=0;if(mod==='BIA')men=0.85*(cnpjs||0);else if(mod==='CND')men=0.40*(cnpjs||0);else if(mod==='Gestão Fiscal')men=Math.max(2.00*(cnpjs||0),200);else if(mod==='XML')men=Math.max(1.75*(cnpjs||0),175);res.push({name:pn(mod,cfg),ad,men,plan});tAd+=ad;tMen+=men
  }
  return {results:res,tAd,tMen}
}

// ── Funções de Parse ─────────────────────────────────────────
function parseModules(text, productNames){
  const t=text.toLowerCase();const found=[];const ifName=(productNames['IF']||'Inteligência Fiscal').toLowerCase();const hasIF=/intelig[eê]ncia\s*fiscal|intelig.*fiscal/i.test(t)||(ifName&&t.includes(ifName));if(hasIF)found.push('IF');const tNoIF=t.replace(/intelig[eê]ncia\s*fiscal|intelig[\w\s]*fiscal/gi,'');const gfName=(productNames['Gestão Fiscal']||'').toLowerCase();if(/gest[aã]o\s*(e\s*an[aá]lise|fiscal)/i.test(tNoIF)||(/
\b
fiscal
\b
/i.test(tNoIF)&&!/intelig/i.test(tNoIF))||(gfName&&tNoIF.includes(gfName)))found.push('Gestão Fiscal');if(/
\b
bia
\b
/i.test(t))found.push('BIA');if(/
\b
cnd
\b
/i.test(t))found.push('CND');if(/
\b
xml
\b
/i.test(t))found.push('XML');if(/tributos/i.test(t))found.push('Tributos');const epName=(productNames['EP']||'').toLowerCase();if(/e[\s-]?process[o]s?|eprocess/i.test(t)||(epName&&t.includes(epName)))found.push('EP');return found
}
function parseIFPlan(text,plans){
  const t=text.toLowerCase();for(const p of plans){if(t.includes(p.name.toLowerCase())||t.includes(p.id))return p.id}if(/
\b
top
\b
/i.test(t))return 'top';if(/
\b
pro
\b
/i.test(t))return 'pro';if(/
\b
basic
\b
/i.test(t))return 'basic';return null
}
function parseCNPJsQty(text){
  const m=text.match(/
\b
(\d+)\s*(cnpj[s]?)?
\b
/i);return m?parseInt(m[1]):null
}
function parseUsers(text){
  const m=text.match(/
\b
(\d+)\s*(usu[aá]rio[s]?)?
\b
/i);return m?parseInt(m[1]):null
}
function getNextDates(){
  const now=new Date(),day=now.getDate(),m=now.getMonth(),y=now.getFullYear();let tm,ty;if(day<=20){tm=m+1;ty=y;if(tm>11){tm=0;ty++}return [5,10,15,20,25].map(d=>`${String(d).padStart(2,'0')}/${String(tm+1).padStart(2,'0')}`)}else{tm=m+2;ty=y;if(tm>11){tm-=12;ty++}return [5,10,15].map(d=>`${String(d).padStart(2,'0')}/${String(tm+1).padStart(2,'0')}`)}
}

// ── Componente Principal ─────────────────────────────────────
export default function Chat() {
  const router = useRouter()
  const [session, setSession] = useState(null)
  const [cfg, setCfg] = useState(DEFAULT_CFG)
  const [loading, setLoading] = useState(true)
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [currentClient, setCurrentClient] = useState(null)
  const [showClientModal, setShowClientModal] = useState(false)
  const [showAddClientModal, setShowAddClientModal] = useState(false)
  const [newClientData, setNewClientData] = useState({
    cpf_cnpj: '', nome_fantasia: '', razao_social: '',
    nome_contato: '', email: '', telefone: '',
    cep: '', endereco: '', bairro: '', cidade: '', estado: '',
    responsavel_implantacao_nome: '', responsavel_implantacao_email: '', responsavel_implantacao_telefone: '',
    responsavel_financeiro_nome: '', responsavel_financeiro_email: '', responsavel_financeiro_telefone: '',
    cpf_contato_principal: '', regime_tributario: ''
  })
  const [clientSearchTerm, setClientSearchTerm] = useState('')
  const [filteredClients, setFilteredClients] = useState([])
  const [showAdminPanel, setShowAdminPanel] = useState(false)
  const [adminPassword, setAdminPassword] = useState('')
  const [adminError, setAdminError] = useState('')
  const [showReportsModal, setShowReportsModal] = useState(false)
  const [showAddPlanModal, setShowAddPlanModal] = useState(false)
  const [newPlanData, setNewPlanData] = useState({ id: '', name: '', maxCnpjs: 0, users: 1, unlimitedUsers: false })
  const [showAddProductModal, setShowAddProductModal] = useState(false)
  const [newProductData, setNewProductData] = useState({ name: '', internal_key: '', no_adesao: false, basic_pro_top_only: false, prices: {} })
  const [showEditUserModal, setShowEditUserModal] = useState(false)
  const [editingUser, setEditingUser] = useState(null)
  const [userSignature, setUserSignature] = useState(null)
  const [showSignaturePad, setShowSignaturePad] = useState(false)
  const [signatureImage, setSignatureImage] = useState(null)
  const [showEditTemplateModal, setShowEditTemplateModal] = useState(false)
  const [editingTemplate, setEditingTemplate] = useState({ type: '', content: '' })
  const [showPaymentModal, setShowPaymentModal] = useState(false)
  const [paymentDetails, setPaymentDetails] = useState({
    adesao_condicao: 'vista',
    adesao_vencimento: '',
    mensalidade_vencimento: ''
  })
  const [showContractPreview, setShowContractPreview] = useState(false)
  const [contractHtml, setContractHtml] = useState('')
  const [contractData, setContractData] = useState(null)
  const [currentProposal, setCurrentProposal] = useState(null)
  const [showProposalPreview, setShowProposalPreview] = useState(false)
  const [proposalHtml, setProposalHtml] = useState('')
  const [showToast, setShowToast] = useState(false)
  const [toastMessage, setToastMessage] = useState('')
  const [toastType, setToastType] = useState('success') // 'success', 'error', 'info'
  const messagesEndRef = useRef(null)

  // ── Efeitos ──────────────────────────────────────────────────
  useEffect(() => {
    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      if (!session) {
        router.push('/')
      } else {
        fetchConfig(session.user.id)
      }
    })
    return () => authListener.unsubscribe()
  }, [])

  useEffect(() => {
    if (session?.user?.id) {
      fetchConfig(session.user.id)
    }
  }, [session?.user?.id])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    if (clientSearchTerm) {
      const term = clientSearchTerm.toLowerCase()
      setFilteredClients(
        cfg.clients.filter(
          (client) =>
            client.nome_fantasia?.toLowerCase().includes(term) ||
            client.razao_social?.toLowerCase().includes(term) ||
            client.cpf_cnpj?.includes(term)
        )
      )
    } else {
      setFilteredClients(cfg.clients)
    }
  }, [clientSearchTerm, cfg.clients])

  // ── Funções de Toast ─────────────────────────────────────────
  const showToastMessage = (message, type = 'info') => {
    setToastMessage(message)
    setToastType(type)
    setShowToast(true)
    setTimeout(() => setShowToast(false), 3000)
  }

  // ── Funções de Configuração ──────────────────────────────────
  const fetchConfig = async (userId) => {
    setLoading(true)
    const { data, error } = await supabase
      .from('configs')
      .select('*')
      .eq('user_id', userId)
      .single()

    if (error && error.code !== 'PGRST116') { // PGRST116 = no rows found
      console.error('Erro ao buscar configuração:', error)
      showToastMessage('Erro ao carregar configurações.', 'error')
    } else if (data) {
      setCfg({ ...DEFAULT_CFG, ...data.config })
      if (data.config.userSignature) {
        setUserSignature(data.config.userSignature)
      }
    } else {
      // Se não houver configuração, cria uma padrão
      const { error: insertError } = await supabase
        .from('configs')
        .insert({ user_id: userId, config: DEFAULT_CFG })
      if (insertError) {
        console.error('Erro ao criar configuração padrão:', insertError)
        showToastMessage('Erro ao criar configurações padrão.', 'error')
      } else {
        setCfg(DEFAULT_CFG)
      }
    }
    setLoading(false)
  }

  const updateConfig = async (newConfig) => {
    const finalConfig = { ...cfg, ...newConfig }
    setCfg(finalConfig)
    const { error } = await supabase
      .from('configs')
      .update({ config: finalConfig })
      .eq('user_id', session.user.id)
    if (error) {
      console.error('Erro ao salvar configuração:', error)
      showToastMessage('Erro ao salvar configurações.', 'error')
      return false
    }
    showToastMessage('Configurações salvas!', 'success')
    return true
  }

  // ── Funções de Chat ──────────────────────────────────────────
  const handleSendMessage = async () => {
    if (!input.trim()) return

    const newMessage = { role: 'user', content: input }
    setMessages((prev) => [...prev, newMessage])
    setInput('')

    // Processar comandos internos
    if (input.toLowerCase().startsWith('/cliente')) {
      const clientDoc = clean(input.split(' ')[1] || '')
      if (clientDoc) {
        const client = cfg.clients.find(c => clean(c.cpf_cnpj) === clientDoc)
        if (client) {
          setCurrentClient(client)
          setMessages((prev) => [...prev, { role: 'assistant', content: `Cliente **${client.nome_fantasia || client.razao_social}** (${fmtDoc(client.cpf_cnpj)}) selecionado.` }])
        } else {
          setMessages((prev) => [...prev, { role: 'assistant', content: `Cliente com documento **${fmtDoc(clientDoc)}** não encontrado. Gostaria de cadastrá-lo?` }])
          setNewClientData(prev => ({ ...prev, cpf_cnpj: clientDoc }))
          setShowAddClientModal(true)
        }
      } else {
        setMessages((prev) => [...prev, { role: 'assistant', content: 'Por favor, informe o CPF/CNPJ do cliente. Ex: `/cliente 12345678901`' }])
      }
      return
    }

    if (input.toLowerCase().startsWith('/proposta')) {
      if (!currentClient) {
        setMessages((prev) => [...prev, { role: 'assistant', content: 'Por favor, selecione um cliente primeiro com `/cliente [CPF/CNPJ]`.' }])
        return
      }
      const prompt = input.substring('/proposta'.length).trim()
      await generateProposal(prompt)
      return
    }

    if (input.toLowerCase().startsWith('/contrato')) {
      if (!currentClient) {
        setMessages((prev) => [...prev, { role: 'assistant', content: 'Por favor, selecione um cliente primeiro com `/cliente [CPF/CNPJ]`.' }])
        return
      }
      const prompt = input.substring('/contrato'.length).trim()
      await generateContract(prompt)
      return
    }

    if (input.toLowerCase() === '/limpar') {
      setMessages([])
      setCurrentClient(null)
      showToastMessage('Chat limpo e cliente deselecionado.', 'info')
      return
    }

    // Enviar para a API de análise
    setMessages((prev) => [...prev, { role: 'assistant', content: 'Analisando...' }])
    try {
      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          data: {
            currentClient,
            messages: messages.map(m => ({ role: m.role, content: m.content })),
            config: cfg,
            latestUserMessage: input
          },
          geminiKey: cfg.geminiKey, // Passa a chave da config
          groqKey: cfg.groqKey // Passa a chave da config
        }),
      })
      const data = await response.json()

      if (data.error) {
        setMessages((prev) => prev.slice(0, -1).concat({ role: 'assistant', content: `Erro: ${data.error}` }))
        showToastMessage(`Erro da IA: ${data.error}`, 'error')
      } else {
        setMessages((prev) => prev.slice(0, -1).concat({ role: 'assistant', content: data.analysis }))
      }
    } catch (error) {
      console.error('Erro ao chamar API de análise:', error)
      setMessages((prev) => prev.slice(0, -1).concat({ role: 'assistant', content: 'Erro ao conectar com a IA. Verifique sua conexão ou as chaves de API.' }))
      showToastMessage('Erro ao conectar com a IA.', 'error')
    }
  }

  // ── Funções de Cliente ───────────────────────────────────────
  const handleSaveClient = async () => {
    if (!newClientData.cpf_cnpj || !newClientData.nome_fantasia) {
      showToastMessage('CPF/CNPJ e Nome Fantasia são obrigatórios.', 'error')
      return
    }

    const cleanedCpfCnpj = clean(newClientData.cpf_cnpj)
    if (cfg.clients.some(c => clean(c.cpf_cnpj) === cleanedCpfCnpj && c.id !== newClientData.id)) {
      showToastMessage('Já existe um cliente com este CPF/CNPJ.', 'error')
      return
    }

    let updatedClients
    if (newClientData.id) { // Editando cliente existente
      updatedClients = cfg.clients.map(c =>
        c.id === newClientData.id ? { ...newClientData, cpf_cnpj: cleanedCpfCnpj } : c
      )
      showToastMessage('Cliente atualizado com sucesso!', 'success')
    } else { // Adicionando novo cliente
      const newId = Date.now().toString()
      updatedClients = [...cfg.clients, { ...newClientData, id: newId, cpf_cnpj: cleanedCpfCnpj }]
      showToastMessage('Cliente adicionado com sucesso!', 'success')
    }

    await updateConfig({ clients: updatedClients })
    setNewClientData({
      cpf_cnpj: '', nome_fantasia: '', razao_social: '',
      nome_contato: '', email: '', telefone: '',
      cep: '', endereco: '', bairro: '', cidade: '', estado: '',
      responsavel_implantacao_nome: '', responsavel_implantacao_email: '', responsavel_implantacao_telefone: '',
      responsavel_financeiro_nome: '', responsavel_financeiro_email: '', responsavel_financeiro_telefone: '',
      cpf_contato_principal: '', regime_tributario: ''
    })
    setShowAddClientModal(false)
    setShowClientModal(false) // Fecha o modal de detalhes se estiver aberto
  }

  const handleEditClient = (client) => {
    setNewClientData(client)
    setShowAddClientModal(true)
  }

  const handleDeleteClient = async (clientId) => {
    if (window.confirm('Tem certeza que deseja excluir este cliente?')) {
      const updatedClients = cfg.clients.filter(c => c.id !== clientId)
      await updateConfig({ clients: updatedClients })
      if (currentClient?.id === clientId) {
        setCurrentClient(null)
      }
      showToastMessage('Cliente excluído.', 'info')
      setShowClientModal(false)
    }
  }

  // ── Funções de Proposta/Contrato ─────────────────────────────
  const generateProposal = async (prompt) => {
    setMessages((prev) => [...prev, { role: 'assistant', content: 'Gerando proposta...' }])
    try {
      const parsedModules = parseModules(prompt, cfg.productNames)
      const parsedCnpjs = parseCNPJsQty(prompt) || (currentClient.cpf_cnpj && isCNPJ(clean(currentClient.cpf_cnpj)) ? 1 : 0)
      const parsedIFPlan = parseIFPlan(prompt, cfg.plans)

      if (!parsedModules.length) {
        setMessages((prev) => prev.slice(0, -1).concat({ role: 'assistant', content: 'Não consegui identificar os módulos para a proposta. Por favor, especifique.' }))
        return
      }

      const planId = getPlan(parsedCnpjs, cfg.plans)
      const quote = cfg.discMode === 'screen' ? calcDisc(parsedModules, planId, parsedIFPlan, parsedCnpjs, 0, cfg) : calcFull(parsedModules, planId, parsedIFPlan, parsedCnpjs, 0, cfg)

      const proposal = {
        id: generateToken(),
        type: 'proposal',
        date: new Date().toISOString(),
        client: currentClient,
        modules: parsedModules,
        cnpjs: parsedCnpjs,
        planId: planId,
        ifPlan: parsedIFPlan,
        quote: quote,
        status: 'Rascunho',
        consultor: session.user.user_metadata.full_name || session.user.email,
        consultorEmail: session.user.email,
        html: '', // Será preenchido ao construir
      }

      const proposalHtmlContent = buildProposal(proposal, cfg)
      proposal.html = proposalHtmlContent // Salva o HTML gerado
      setCurrentProposal(proposal)
      setProposalHtml(proposalHtmlContent)
      setShowProposalPreview(true)
      setMessages((prev) => prev.slice(0, -1).concat({ role: 'assistant', content: 'Proposta gerada com sucesso!' }))

      // Salvar proposta no histórico
      const updatedDocuments = [...(cfg.documents || []), proposal]
      await updateConfig({ documents: updatedDocuments })

    } catch (error) {
      console.error('Erro ao gerar proposta:', error)
      setMessages((prev) => prev.slice(0, -1).concat({ role: 'assistant', content: 'Erro ao gerar proposta. Tente novamente.' }))
      showToastMessage('Erro ao gerar proposta.', 'error')
    }
  }

  const generateContract = async (prompt) => {
    setMessages((prev) => [...prev, { role: 'assistant', content: 'Gerando contrato...' }])
    try {
      const parsedModules = parseModules(prompt, cfg.productNames)
      const parsedCnpjs = parseCNPJsQty(prompt) || (currentClient.cpf_cnpj && isCNPJ(clean(currentClient.cpf_cnpj)) ? 1 : 0)
      const parsedIFPlan = parseIFPlan(prompt, cfg.plans)

      if (!parsedModules.length) {
        setMessages((prev) => prev.slice(0, -1).concat({ role: 'assistant', content: 'Não consegui identificar os módulos para o contrato. Por favor, especifique.' }))
        return
      }

      const planId = getPlan(parsedCnpjs, cfg.plans)
      const quote = cfg.discMode === 'screen' ? calcDisc(parsedModules, planId, parsedIFPlan, parsedCnpjs, 0, cfg) : calcFull(parsedModules, planId, parsedIFPlan, parsedCnpjs, 0, cfg)

      const contract = {
        id: generateToken(),
        type: 'contract',
        date: new Date().toISOString(),
        client: currentClient,
        modules: parsedModules,
        cnpjs: parsedCnpjs,
        planId: planId,
        ifPlan: parsedIFPlan,
        quote: quote,
        status: 'Rascunho',
        consultor: session.user.user_metadata.full_name || session.user.email,
        consultorEmail: session.user.email,
        paymentDetails: paymentDetails, // Adiciona detalhes de pagamento
        html: '', // Será preenchido ao construir
        signatures: {
          consultor: null,
          client: null
        }
      }

      setContractData(contract)
      setShowPaymentModal(true) // Abre o modal de pagamento antes de gerar o HTML final
      setMessages((prev) => prev.slice(0, -1).concat({ role: 'assistant', content: 'Detalhes de pagamento necessários para o contrato.' }))

    } catch (error) {
      console.error('Erro ao gerar contrato:', error)
      setMessages((prev) => prev.slice(0, -1).concat({ role: 'assistant', content: 'Erro ao gerar contrato. Tente novamente.' }))
      showToastMessage('Erro ao gerar contrato.', 'error')
    }
  }

  const handleConfirmPaymentDetails = async () => {
    if (!paymentDetails.adesao_vencimento || !paymentDetails.mensalidade_vencimento) {
      showToastMessage('Datas de vencimento são obrigatórias.', 'error')
      return
    }

    const updatedContract = { ...contractData, paymentDetails: paymentDetails }
    const contractHtmlContent = buildContract(updatedContract, cfg, userSignature) // Passa userSignature
    updatedContract.html = contractHtmlContent

    setContractData(updatedContract)
    setContractHtml(contractHtmlContent)
    setShowPaymentModal(false)
    setShowContractPreview(true)
    showToastMessage('Contrato gerado com sucesso!', 'success')

    // Salvar contrato no histórico
    const updatedDocuments = [...(cfg.documents || []), updatedContract]
    await updateConfig({ documents: updatedDocuments })
  }

  const handleSendProposal = async (proposal) => {
    const { email, nome_fantasia } = proposal.client
    const { consultor, consultorEmail } = proposal

    if (!email) {
      showToastMessage('Cliente não possui e-mail cadastrado.', 'error')
      return
    }

    setMessages((prev) => [...prev, { role: 'assistant', content: 'Enviando proposta por e-mail...' }])

    try {
      const response = await fetch('/api/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: email,
          subject: `Proposta Comercial Vivanexa para ${nome_fantasia}`,
          html: proposal.html,
          from: cfg.emailRemetente || consultorEmail,
          config: cfg // Passa a config para o backend usar SMTP
        }),
      })

      const data = await response.json()

      if (data.success) {
        setMessages((prev) => prev.slice(0, -1).concat({ role: 'assistant', content: `Proposta enviada para ${email}!` }))
        showToastMessage('Proposta enviada com sucesso!', 'success')
        // Atualizar status da proposta para "Enviada" ou similar
        const updatedDocuments = cfg.documents.map(doc =>
          doc.id === proposal.id ? { ...doc, status: 'Enviada' } : doc
        )
        await updateConfig({ documents: updatedDocuments })
      } else {
        setMessages((prev) => prev.slice(0, -1).concat({ role: 'assistant', content: `Erro ao enviar proposta: ${data.error}` }))
        showToastMessage(`Erro ao enviar proposta: ${data.error}`, 'error')
      }
    } catch (error) {
      console.error('Erro ao enviar proposta:', error)
      setMessages((prev) => prev.slice(0, -1).concat({ role: 'assistant', content: 'Erro ao enviar proposta. Verifique a configuração de e-mail.' }))
      showToastMessage('Erro ao enviar proposta.', 'error')
    }
  }

  const handleSendContract = async (contract) => {
    const { email, nome_fantasia } = contract.client
    const { consultor, consultorEmail, id: contractId } = contract

    if (!email) {
      showToastMessage('Cliente não possui e-mail cadastrado.', 'error')
      return
    }

    setMessages((prev) => [...prev, { role: 'assistant', content: 'Enviando contrato para assinatura...' }])

    try {
      const baseUrl = cfg.baseUrl || window.location.origin
      const signLink = `${baseUrl}/sign/${contractId}`

      const emailHtml = `
        <p>Prezado(a) ${nome_fantasia},</p>
        <p>Segue o contrato de prestação de serviços da Vivanexa para sua análise e assinatura eletrônica.</p>
        <p>Por favor, clique no link abaixo para visualizar e assinar o documento:</p>
        <p><a href="${signLink}" target="_blank" style="padding: 10px 20px; background-color: #00d4ff; color: white; text-decoration: none; border-radius: 5px;">Assinar Contrato</a></p>
        <p>Atenciosamente,</p>
        <p>${consultor}</p>
        <p>Vivanexa</p>
      `

      const response = await fetch('/api/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: email,
          subject: `Contrato Vivanexa para Assinatura - ${nome_fantasia}`,
          html: emailHtml,
          from: cfg.emailRemetente || consultorEmail,
          config: cfg // Passa a config para o backend usar SMTP
        }),
      })

      const data = await response.json()

      if (data.success) {
        setMessages((prev) => prev.slice(0, -1).concat({ role: 'assistant', content: `Contrato enviado para ${email} para assinatura!` }))
        showToastMessage('Contrato enviado para assinatura!', 'success')
        // Atualizar status do contrato para "Aguardando assinatura"
        const updatedDocuments = cfg.documents.map(doc =>
          doc.id === contract.id ? { ...doc, status: 'Aguardando assinatura' } : doc
        )
        await updateConfig({ documents: updatedDocuments })
      } else {
        setMessages((prev) => prev.slice(0, -1).concat({ role: 'assistant', content: `Erro ao enviar contrato: ${data.error}` }))
        showToastMessage(`Erro ao enviar contrato: ${data.error}`, 'error')
      }
    } catch (error) {
      console.error('Erro ao enviar contrato:', error)
      setMessages((prev) => prev.slice(0, -1).concat({ role: 'assistant', content: 'Erro ao enviar contrato. Verifique a configuração de e-mail.' }))
      showToastMessage('Erro ao enviar contrato.', 'error')
    }
  }

  const generatePdfAndSendEmail = async (contract) => {
    setMessages((prev) => [...prev, { role: 'assistant', content: 'Gerando PDF do contrato e enviando por e-mail...' }])
    try {
      // 1. Gerar PDF do contrato
      const pdfResponse = await fetch('/api/generate-pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ htmlContent: contract.html }),
      });

      if (!pdfResponse.ok) {
        const errorText = await pdfResponse.text();
        throw new Error(`Falha ao gerar PDF: ${errorText}`);
      }

      const pdfBlob = await pdfResponse.blob();
      const reader = new FileReader();
      reader.readAsDataURL(pdfBlob);
      reader.onloadend = async () => {
        const base64Pdf = reader.result.split(',')[1]; // Pega apenas a parte base64

        // 2. Enviar e-mail com o PDF anexado
        const { email, nome_fantasia } = contract.client;
        const { consultor, consultorEmail } = contract;

        const emailHtml = `
          <p>Prezado(a) ${nome_fantasia},</p>
          <p>Seu contrato com a Vivanexa foi assinado por ambas as partes e está anexado a este e-mail.</p>
          <p>Agradecemos a confiança!</p>
          <p>Atenciosamente,</p>
          <p>${consultor}</p>
          <p>Vivanexa</p>
        `;

        const sendEmailResponse = await fetch('/api/send-email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            to: email,
            subject: `Contrato Vivanexa Assinado - ${nome_fantasia}`,
            html: emailHtml,
            from: cfg.emailRemetente || consultorEmail,
            config: cfg,
            attachments: [{
              filename: `contrato_vivanexa_${contract.id}.pdf`,
              content: base64Pdf,
              encoding: 'base64',
              contentType: 'application/pdf'
            }]
          }),
        });

        const emailData = await sendEmailResponse.json();

        if (emailData.success) {
          setMessages((prev) => prev.slice(0, -1).concat({ role: 'assistant', content: `Contrato PDF enviado para ${email}!` }));
          showToastMessage('Contrato PDF enviado com sucesso!', 'success');
        } else {
          setMessages((prev) => prev.slice(0, -1).concat({ role: 'assistant', content: `Erro ao enviar contrato PDF: ${emailData.error}` }));
          showToastMessage(`Erro ao enviar contrato PDF: ${emailData.error}`, 'error');
        }
      };
    } catch (error) {
      console.error('Erro ao gerar PDF ou enviar e-mail:', error);
      setMessages((prev) => prev.slice(0, -1).concat({ role: 'assistant', content: 'Erro ao gerar PDF ou enviar e-mail do contrato.' }));
      showToastMessage('Erro ao gerar PDF ou enviar e-mail.', 'error');
    }
  };


  const handleSignContract = async (contractId, signerType, signatureData) => {
    // Esta função seria chamada pela página de assinatura (sign/[token].js)
    // Mas para fins de demonstração e teste, vamos simular aqui.
    // Na prática, a página de assinatura faria a atualização no Supabase.

    const updatedDocuments = cfg.documents.map(doc => {
      if (doc.id === contractId && doc.type === 'contract') {
        const updatedSignatures = { ...doc.signatures, [signerType]: signatureData };
        const newStatus = (updatedSignatures.consultor && updatedSignatures.client) ? 'Assinado' : doc.status;
        const updatedDoc = { ...doc, signatures: updatedSignatures, status: newStatus };

        // Se ambas as partes assinaram, atualiza o HTML para incluir as assinaturas
        if (newStatus === 'Assinado') {
          updatedDoc.html = buildContract(updatedDoc, cfg, userSignature); // Reconstroi o HTML com as assinaturas
          generatePdfAndSendEmail(updatedDoc); // Envia o PDF por e-mail
        }
        return updatedDoc;
      }
      return doc;
    });

    await updateConfig({ documents: updatedDocuments });
    showToastMessage(`Contrato ${contractId} assinado por ${signerType}!`, 'success');
  };

  // ── Funções de Construção de HTML (Proposta/Contrato) ───────
  const buildProposal = (proposal, cfg) => {
    const { client, modules, cnpjs, planId, ifPlan, quote } = proposal
    const { company, slogan, logob64, productNames, plans, proposalTemplate } = cfg
    const date = new Date(proposal.date).toLocaleDateString('pt-BR')

    const headerHtml = `
      <div style="text-align: center; margin-bottom: 30px;">
        ${logob64 ? `<img src="${logob64}" alt="${company}" style="max-height: 80px; margin-bottom: 10px;" />` : `<h1 style="color: #00d4ff; font-family: 'Syne', sans-serif; margin: 0;">${company}</h1>`}
        <p style="color: #64748b; font-size: 14px; margin: 0;">${slogan}</p>
      </div>
    `

    const introText = proposalTemplate || `
      <p>Prezado(a) ${client.nome_contato || client.nome_fantasia || client.razao_social},</p>
      <p>Apresentamos a seguir nossa proposta comercial para os serviços da Vivanexa, desenvolvida para otimizar a gestão e a inteligência fiscal de sua empresa.</p>
    `

    const productsTable = `
      <table style="width: 100%; border-collapse: collapse; margin-top: 20px;">
        <thead>
          <tr style="background-color: #1a2540; color: #e2e8f0;">
            <th style="padding: 12px; text-align: left; border: 1px solid #1e2d4a;">Módulo</th>
            <th style="padding: 12px; text-align: center; border: 1px solid #1e2d4a;">Plano</th>
            <th style="padding: 12px; text-align: right; border: 1px solid #1e2d4a;">Adesão</th>
            <th style="padding: 12px; text-align: right; border: 1px solid #1e2d4a;">Mensalidade</th>
          </tr>
        </thead>
        <tbody>
          ${quote.results.map(item => `
            <tr style="background-color: #111827; color: #e2e8f0;">
              <td style="padding: 10px; border: 1px solid #1e2d4a;">${item.name}</td>
              <td style="padding: 10px; text-align: center; border: 1px solid #1e2d4a;">${item.isIF ? getPlanLabel(item.plan, plans) + ' (IF)' : item.isEP ? getPlanLabel(item.plan, plans) + ' (EP)' : getPlanLabel(planId, plans)}</td>
              <td style="padding: 10px; text-align: right; border: 1px solid #1e2d4a;">${fmt(item.adD)}</td>
              <td style="padding: 10px; text-align: right; border: 1px solid #1e2d4a;">${fmt(item.menD)}</td>
            </tr>
          `).join('')}
          <tr style="background-color: #1a2540; color: #00d4ff; font-weight: bold;">
            <td colspan="2" style="padding: 12px; text-align: right; border: 1px solid #1e2d4a;">Total:</td>
            <td style="padding: 12px; text-align: right; border: 1px solid #1e2d4a;">${fmt(quote.tAdD)}</td>
            <td style="padding: 12px; text-align: right; border: 1px solid #1e2d4a;">${fmt(quote.tMenD)}</td>
          </tr>
        </tbody>
      </table>
    `

    const clientInfo = `
      <div style="margin-top: 30px; padding: 15px; background-color: #1a2540; border-radius: 8px; color: #e2e8f0;">
        <h3 style="color: #00d4ff; margin-bottom: 10px;">Dados do Cliente</h3>
        <p><strong>Empresa:</strong> ${client.nome_fantasia || client.razao_social}</p>
        <p><strong>CNPJ/CPF:</strong> ${fmtDoc(client.cpf_cnpj)}</p>
        <p><strong>Contato:</strong> ${client.nome_contato}</p>
        <p><strong>E-mail:</strong> ${client.email}</p>
        <p><strong>Telefone:</strong> ${client.telefone}</p>
      </div>
    `

    const footerHtml = `
      <div style="margin-top: 50px; text-align: center; color: #64748b; font-size: 12px;">
        <p>${company} – Proposta Comercial – Gerado em ${date}</p>
        <p>Este documento é uma proposta e não possui validade de contrato.</p>
      </div>
    `

    return `
      <!DOCTYPE html>
      <html lang="pt-BR">
      <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Proposta Comercial - ${company}</title>
          <style>
              body { font-family: Arial, sans-serif; line-height: 1.6; color: #e2e8f0; background-color: #0a0f1e; margin: 0; padding: 20px; }
              .container { max-width: 800px; margin: 20px auto; background-color: #111827; padding: 30px; border-radius: 10px; box-shadow: 0 0 15px rgba(0, 0, 0, 0.5); border: 1px solid #1e2d4a; }
              h1, h2, h3 { color: #00d4ff; font-family: 'Syne', sans-serif; }
              p { margin-bottom: 10px; }
              table { width: 100%; border-collapse: collapse; margin-top: 20px; }
              th, td { padding: 12px; text-align: left; border: 1px solid #1e2d4a; }
              th { background-color: #1a2540; color: #00d4ff; }
              .total { background-color: #1a2540; font-weight: bold; color: #00d4ff; }
              .footer { margin-top: 40px; text-align: center; font-size: 0.8em; color: #64748b; }
              .section-title { color: #00d4ff; border-bottom: 2px solid #1e2d4a; padding-bottom: 5px; margin-top: 30px; margin-bottom: 15px; }
          </style>
      </head>
      <body>
          <div class="container">
              ${headerHtml}
              <div class="section-title">Proposta Comercial</div>
              ${introText}
              ${productsTable}
              ${clientInfo}
              ${footerHtml}
          </div>
      </body>
      </html>
    `
  }

  const buildContract = (contract, cfg, consultorSignatureImage) => {
    const { client, modules, cnpjs, planId, ifPlan, quote, paymentDetails, signatures } = contract
    const { company, slogan, logob64, productNames, plans, contractTemplate } = cfg
    const date = new Date(contract.date).toLocaleDateString('pt-BR')

    const headerHtml = `
      <div style="text-align: center; margin-bottom: 30px;">
        ${logob64 ? `<img src="${logob64}" alt="${company}" style="max-height: 80px; margin-bottom: 10px;" />` : `<h1 style="color: #00d4ff; font-family: 'Syne', sans-serif; margin: 0;">${company}</h1>`}
        <p style="color: #64748b; font-size: 14px; margin: 0;">${slogan}</p>
      </div>
    `

    const introText = contractTemplate || `
      <p>Este Contrato de Prestação de Serviços é celebrado entre:</p>
      <p><strong>CONTRATADA:</strong> ${company}, com sede em [Endereço da Contratada], inscrita no CNPJ sob o nº [CNPJ da Contratada].</p>
      <p><strong>CONTRATANTE:</strong> ${client.razao_social || client.nome_fantasia}, inscrita no CNPJ/CPF sob o nº ${fmtDoc(client.cpf_cnpj)}, com sede em ${client.endereco}, ${client.bairro}, ${client.cidade} - ${client.estado}.</p>
      <p>As partes acima identificadas têm, entre si, justo e contratado o presente, mediante as cláusulas e condições seguintes:</p>
    `

    const productsTable = `
      <h3 style="color: #00d4ff; margin-top: 30px; margin-bottom: 15px;">Serviços Contratados</h3>
      <table style="width: 100%; border-collapse: collapse; margin-top: 20px;">
        <thead>
          <tr style="background-color: #1a2540; color: #e2e8f0;">
            <th style="padding: 12px; text-align: left; border: 1px solid #1e2d4a;">Módulo</th>
            <th style="padding: 12px; text-align: center; border: 1px solid #1e2d4a;">Plano</th>
            <th style="padding: 12px; text-align: right; border: 1px solid #1e2d4a;">Adesão</th>
            <th style="padding: 12px; text-align: right; border: 1px solid #1e2d4a;">Mensalidade</th>
          </tr>
        </thead>
        <tbody>
          ${quote.results.map(item => `
            <tr style="background-color: #111827; color: #e2e8f0;">
              <td style="padding: 10px; border: 1px solid #1e2d4a;">${item.name}</td>
              <td style="padding: 10px; text-align: center; border: 1px solid #1e2d4a;">${item.isIF ? getPlanLabel(item.plan, plans) + ' (IF)' : item.isEP ? getPlanLabel(item.plan, plans) + ' (EP)' : getPlanLabel(planId, plans)}</td>
              <td style="padding: 10px; text-align: right; border: 1px solid #1e2d4a;">${fmt(item.adD)}</td>
              <td style="padding: 10px; text-align: right; border: 1px solid #1e2d4a;">${fmt(item.menD)}</td>
            </tr>
          `).join('')}
          <tr style="background-color: #1a2540; color: #00d4ff; font-weight: bold;">
            <td colspan="2" style="padding: 12px; text-align: right; border: 1px solid #1e2d4a;">Total:</td>
            <td style="padding: 12px; text-align: right; border: 1px solid #1e2d4a;">${fmt(quote.tAdD)}</td>
            <td style="padding: 12px; text-align: right; border: 1px solid #1e2d4a;">${fmt(quote.tMenD)}</td>
          </tr>
        </tbody>
      </table>
    `

    const paymentInfo = `
      <h3 style="color: #00d4ff; margin-top: 30px; margin-bottom: 15px;">Condições de Pagamento</h3>
      <p><strong>Valor da Adesão:</strong> ${fmt(quote.tAdD)}</p>
      <p><strong>Condição de Pagamento da Adesão:</strong> ${paymentDetails.adesao_condicao === 'vista' ? 'À vista' : paymentDetails.adesao_condicao === 'pix_boleto' ? 'PIX ou Boleto à vista' : paymentDetails.adesao_condicao === 'cartao' ? 'Cartão de Crédito - sem juros' : 'Boleto parcelado - sem juros'}</p>
      <p><strong>Vencimento da Adesão:</strong> ${new Date(paymentDetails.adesao_vencimento).toLocaleDateString('pt-BR')}</p>
      <p><strong>Valor da Mensalidade:</strong> ${fmt(quote.tMenD)}</p>
      <p><strong>Vencimento da Mensalidade:</strong> Todo dia ${new Date(paymentDetails.mensalidade_vencimento).getDate()} de cada mês, a partir de ${new Date(paymentDetails.mensalidade_vencimento).toLocaleDateString('pt-BR')}.</p>
    `

    const signatureSection = `
      <h3 style="color: #00d4ff; margin-top: 50px; margin-bottom: 30px; text-align: center;">Assinaturas</h3>
      <div style="display: flex; justify-content: space-around; flex-wrap: wrap; gap: 30px;">
        <div style="flex: 1; min-width: 280px; text-align: center; padding: 20px; border: 1px dashed #1e2d4a; border-radius: 8px;">
          ${signatures.consultor?.image ? `<img src="${signatures.consultor.image}" alt="Assinatura do Consultor" style="max-width: 200px; max-height: 100px; display: block; margin: 0 auto 10px auto;" />` : (consultorSignatureImage ? `<img src="${consultorSignatureImage}" alt="Assinatura do Consultor" style="max-width: 200px; max-height: 100px; display: block; margin: 0 auto 10px auto;" />` : '<div style="height: 100px; display: flex; align-items: center; justify-content: center; color: #64748b;">[Espaço para Assinatura do Consultor]</div>')}
          <p style="margin-top: 10px; font-weight: bold; color: #e2e8f0;">${contract.consultor}</p>
          <p style="font-size: 12px; color: #64748b;">Consultor Vivanexa</p>
          ${signatures.consultor ? `
            <p style="font-size: 10px; color: #64748b; margin-top: 5px;">
              CPF: ${fmtDoc(signatures.consultor.cpf)}<br/>
              E-mail: ${signatures.consultor.email}<br/>
              Data: ${new Date(signatures.consultor.date).toLocaleString('pt-BR')}<br/>
              IP: ${signatures.consultor.ip}
            </p>
          ` : ''}
        </div>
        <div style="flex: 1; min-width: 280px; text-align: center; padding: 20px; border: 1px dashed #1e2d4a; border-radius: 8px;">
          ${signatures.client?.image ? `<img src="${signatures.client.image}" alt="Assinatura do Cliente" style="max-width: 200px; max-height: 100px; display: block; margin: 0 auto 10px auto;" />` : '<div style="height: 100px; display: flex; align-items: center; justify-content: center; color: #64748b;">[Espaço para Assinatura do Cliente]</div>'}
          <p style="margin-top: 10px; font-weight: bold; color: #e2e8f0;">${client.nome_contato || client.nome_fantasia || client.razao_social}</p>
          <p style="font-size: 12px; color: #64748b;">Contratante</p>
          ${signatures.client ? `
            <p style="font-size: 10px; color: #64748b; margin-top: 5px;">
              CPF: ${fmtDoc(signatures.client.cpf)}<br/>
              E-mail: ${signatures.client.email}<br/>
              Data: ${new Date(signatures.client.date).toLocaleString('pt-BR')}<br/>
              IP: ${signatures.client.ip}
            </p>
          ` : ''}
        </div>
      </div>
      <div style="margin-top: 30px; text-align: center; font-size: 11px; color: #64748b;">
        <p><strong>Manifesto de Assinatura Eletrônica Simples:</strong> Este documento foi assinado eletronicamente por ambas as partes, em conformidade com a Lei nº 14.063/2020.</p>
        <p>Token de Validação: <strong>${contract.id}</strong></p>
        <p>Os dados de IP, data e hora de cada assinatura foram registrados para fins de auditoria e validade jurídica.</p>
      </div>
    `

    const footerHtml = `
      <div style="margin-top: 50px; text-align: center; color: #64748b; font-size: 12px;">
        <p>${company} – Contrato de Prestação de Serviços – Gerado em ${date}</p>
        <p>Este documento possui validade jurídica mediante as assinaturas eletrônicas.</p>
      </div>
    `

    return `
      <!DOCTYPE html>
      <html lang="pt-BR">
      <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Contrato de Prestação de Serviços - ${company}</title>
          <style>
              body { font-family: Arial, sans-serif; line-height: 1.6; color: #e2e8f0; background-color: #0a0f1e; margin: 0; padding: 20px; }
              .container { max-width: 800px; margin: 20px auto; background-color: #111827; padding: 30px; border-radius: 10px; box-shadow: 0 0 15px rgba(0, 0, 0, 0.5); border: 1px solid #1e2d4a; }
              h1, h2, h3 { color: #00d4ff; font-family: 'Syne', sans-serif; }
              p { margin-bottom: 10px; }
              table { width: 100%; border-collapse: collapse; margin-top: 20px; }
              th, td { padding: 12px; text-align: left; border: 1px solid #1e2d4a; }
              th { background-color: #1a2540; color: #00d4ff; }
              .total { background-color: #1a2540; font-weight: bold; color: #00d4ff; }
              .footer { margin-top: 40px; text-align: center; font-size: 0.8em; color: #64748b; }
              .section-title { color: #00d4ff; border-bottom: 2px solid #1e2d4a; padding-bottom: 5px; margin-top: 30px; margin-bottom: 15px; }
          </style>
      </head>
      <body>
          <div class="container">
              ${headerHtml}
              <div class="section-title">Contrato de Prestação de Serviços</div>
              ${introText}
              ${productsTable}
              ${paymentInfo}
              ${signatureSection}
              ${footerHtml}
          </div>
      </body>
      </html>
    `
  }

  // ── Renderização ─────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-900 text-white">
        <div className="text-xl">Carregando...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white flex flex-col">
      <Head>
        <title>{cfg.company || 'Vivanexa'} – Assistente Comercial</title>
        <link rel="icon" href="/favicon.ico" />
      </Head>

      {/* Global Orbs */}
      <div className="orb orb1" />
      <div className="orb orb2" />

      {/* Header */}
      <header className="sticky top-0 z-10 max-w-4xl mx-auto p-4 flex items-center gap-2 flex-wrap bg-gray-900 bg-opacity-90 backdrop-filter backdrop-blur-md border-b border-gray-800">
        <div className="flex items-center gap-2 cursor-pointer" onClick={() => router.push('/chat')}>
          {cfg.logob64 ? <img src={cfg.logob64} alt={cfg.company} className="h-9" /> : <div className="font-syne text-xl font-bold text-blue-400">{cfg.company || 'Vivanexa'}</div>}
          <span className="text-gray-400 text-sm">{cfg.slogan || 'Assistente Comercial de Preços'}</span>
        </div>
        <div className="ml-auto flex gap-2">
          <button onClick={() => router.push('/dashboard')} className="px-3 py-1 bg-gray-800 rounded-lg hover:bg-gray-700 transition-colors text-sm">📊 Dashboard</button>
          <button onClick={() => router.push('/configuracoes')} className="px-3 py-1 bg-gray-800 rounded-lg hover:bg-gray-700 transition-colors text-sm">⚙️ Config</button>
          <button onClick={() => supabase.auth.signOut().then(() => router.push('/'))} className="px-3 py-1 bg-red-600 rounded-lg hover:bg-red-700 transition-colors text-sm">Sair</button>
        </div>
      </header>

      {/* Main Chat Area */}
      <main className="flex-1 flex flex-col max-w-4xl mx-auto w-full p-4">
        {/* Current Client Display */}
        {currentClient && (
          <div className="bg-gray-800 p-3 rounded-lg mb-4 flex items-center justify-between">
            <p className="text-sm text-gray-300">
              Cliente selecionado: <span className="font-semibold text-blue-400">{currentClient.nome_fantasia || currentClient.razao_social}</span> ({fmtDoc(currentClient.cpf_cnpj)})
            </p>
            <button onClick={() => setCurrentClient(null)} className="text-red-400 hover:text-red-300 text-sm">Remover</button>
          </div>
        )}

        {/* Messages */}
        <div className="flex-1 overflow-y-auto space-y-4 p-4 bg-gray-800 rounded-lg shadow-inner mb-4">
          {messages.map((msg, index) => (
            <div key={index} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-xl px-4 py-2 rounded-lg shadow ${msg.role === 'user' ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-100'}`}>
                {msg.content.split('\n').map((line, i) => (
                  <p key={i} className="mb-1 last:mb-0">{line}</p>
                ))}
              </div>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
            placeholder="Digite sua mensagem ou comando (/cliente, /proposta, /contrato, /limpar)"
            className="flex-1 p-3 rounded-lg bg-gray-700 border border-gray-600 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            onClick={handleSendMessage}
            className="px-5 py-3 bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            Enviar
          </button>
        </div>
      </main>

      {/* Toast Notification */}
      {showToast && (
        <div className={`fixed bottom-4 right-4 px-6 py-3 rounded-lg shadow-lg text-white ${toastType === 'success' ? 'bg-green-500' : toastType === 'error' ? 'bg-red-500' : 'bg-blue-500'}`}>
          {toastMessage}
        </div>
      )}

      {/* Modals */}
      {/* Client Details Modal */}
      {showClientModal && currentClient && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 p-8 rounded-lg shadow-xl w-full max-w-md relative">
            <h3 className="text-2xl font-bold mb-6 text-center">📋 Dados para o CRM</h3>
            <button onClick={() => setShowClientModal(false)} className="absolute top-4 right-4 text-gray-400 hover:text-white text-2xl">✕</button>
            <div className="space-y-3 text-gray-300">
              <p><strong>CPF/CNPJ:</strong> {fmtDoc(currentClient.cpf_cnpj)}</p>
              <p><strong>Nome Fantasia:</strong> {currentClient.nome_fantasia}</p>
              <p><strong>Razão Social:</strong> {currentClient.razao_social}</p>
              <p><strong>Contato:</strong> {currentClient.nome_contato}</p>
              <p><strong>E-mail:</strong> {currentClient.email}</p>
              <p><strong>Telefone:</strong> {currentClient.telefone}</p>
              <p><strong>Endereço:</strong> {currentClient.endereco}, {currentClient.bairro}, {currentClient.cidade} - {currentClient.estado} ({currentClient.cep})</p>
              {currentClient.responsavel_implantacao_nome && <p><strong>Resp. Implantação:</strong> {currentClient.responsavel_implantacao_nome} ({currentClient.responsavel_implantacao_email})</p>}
              {currentClient.responsavel_financeiro_nome && <p><strong>Resp. Financeiro:</strong> {currentClient.responsavel_financeiro_nome} ({currentClient.responsavel_financeiro_email})</p>}
              <p><strong>Regime Tributário:</strong> {currentClient.regime_tributario}</p>
            </div>
            <div className="flex justify-end space-x-4 mt-6">
              <button onClick={() => {
                const crmData = `
CPF/CNPJ: ${fmtDoc(currentClient.cpf_cnpj)}
Nome Fantasia: ${currentClient.nome_fantasia}
Razão Social: ${currentClient.razao_social}
Contato: ${currentClient.nome_contato}
E-mail: ${currentClient.email}
Telefone: ${currentClient.telefone}
Endereço: ${currentClient.endereco}, ${currentClient.bairro}, ${currentClient.cidade} - ${currentClient.estado} (${currentClient.cep})
Responsável Implantação: ${currentClient.responsavel_implantacao_nome} (${currentClient.responsavel_implantacao_email})
Responsável Financeiro: ${currentClient.responsavel_financeiro_nome} (${currentClient.responsavel_financeiro_email})
Regime Tributário: ${currentClient.regime_tributario}
                `
                navigator.clipboard.writeText(crmData.trim())
                showToastMessage('Dados copiados para o CRM!', 'success')
              }} className="px-6 py-2 bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors">📋 Copiar tudo</button>
              <button onClick={() => setShowClientModal(false)} className="px-6 py-2 bg-gray-600 rounded-lg hover:bg-gray-700 transition-colors">Fechar</button>
            </div>
          </div>
        </div>
      )}

      {/* Add/Edit Client Modal */}
      {showAddClientModal && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 p-8 rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto relative">
            <h3 className="text-2xl font-bold mb-6 text-center">{newClientData.id ? '✏️ Editar Cliente' : '➕ Novo Cliente'}</h3>
            <button onClick={() => setShowAddClientModal(false)} className="absolute top-4 right-4 text-gray-400 hover:text-white text-2xl">✕</button>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-300">CPF / CNPJ *</label>
                <input
                  type="text"
                  value={newClientData.cpf_cnpj}
                  onChange={(e) => setNewClientData({ ...newClientData, cpf_cnpj: clean(e.target.value) })}
                  className="mt-1 block w-full p-2 bg-gray-700 border border-gray-600 rounded-md text-white"
                  maxLength={14}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300">Nome Fantasia / Nome *</label>
                <input
                  type="text"
                  value={newClientData.nome_fantasia}
                  onChange={(e) => setNewClientData({ ...newClientData, nome_fantasia: e.target.value })}
                  className="mt-1 block w-full p-2 bg-gray-700 border border-gray-600 rounded-md text-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300">Razão Social</label>
                <input
                  type="text"
                  value={newClientData.razao_social}
                  onChange={(e) => setNewClientData({ ...newClientData, razao_social: e.target.value })}
                  className="mt-1 block w-full p-2 bg-gray-700 border border-gray-600 rounded-md text-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300">Nome do Contato</label>
                <input
                  type="text"
                  value={newClientData.nome_contato}
                  onChange={(e) => setNewClientData({ ...newClientData, nome_contato: e.target.value })}
                  className="mt-1 block w-full p-2 bg-gray-700 border border-gray-600 rounded-md text-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300">E-mail</label>
                <input
                  type="email"
                  value={newClientData.email}
                  onChange={(e) => setNewClientData({ ...newClientData, email: e.target.value })}
                  className="mt-1 block w-full p-2 bg-gray-700 border border-gray-600 rounded-md text-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300">Telefone / WhatsApp</label>
                <input
                  type="text"
                  value={newClientData.telefone}
                  onChange={(e) => setNewClientData({ ...newClientData, telefone: e.target.value })}
                  className="mt-1 block w-full p-2 bg-gray-700 border border-gray-600 rounded-md text-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300">CEP</label>
                <input
                  type="text"
                  value={newClientData.cep}
                  onChange={(e) => setNewClientData({ ...newClientData, cep: clean(e.target.value) })}
                  className="mt-1 block w-full p-2 bg-gray-700 border border-gray-600 rounded-md text-white"
                  maxLength={8}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300">Endereço</label>
                <input
                  type="text"
                  value={newClientData.endereco}
                  onChange={(e) => setNewClientData({ ...newClientData, endereco: e.target.value })}
                  className="mt-1 block w-full p-2 bg-gray-700 border border-gray-600 rounded-md text-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300">Bairro</label>
                <input
                  type="text"
                  value={newClientData.bairro}
                  onChange={(e) => setNewClientData({ ...newClientData, bairro: e.target.value })}
                  className="mt-1 block w-full p-2 bg-gray-700 border border-gray-600 rounded-md text-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300">Cidade</label>
                <input
                  type="text"
                  value={newClientData.cidade}
                  onChange={(e) => setNewClientData({ ...newClientData, cidade: e.target.value })}
                  className="mt-1 block w-full p-2 bg-gray-700 border border-gray-600 rounded-md text-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300">Estado</label>
                <input
                  type="text"
                  value={newClientData.estado}
                  onChange={(e) => setNewClientData({ ...newClientData, estado: e.target.value })}
                  className="mt-1 block w-full p-2 bg-gray-700 border border-gray-600 rounded-md text-white"
                />
              </div>
              <div className="md:col-span-2">
                <h4 className="text-lg font-semibold text-blue-400 mt-4 mb-2">👷 Responsável pela Implantação</h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300">Nome</label>
                    <input
                      type="text"
                      value={newClientData.responsavel_implantacao_nome}
                      onChange={(e) => setNewClientData({ ...newClientData, responsavel_implantacao_nome: e.target.value })}
                      className="mt-1 block w-full p-2 bg-gray-700 border border-gray-600 rounded-md text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300">E-mail</label>
                    <input
                      type="email"
                      value={newClientData.responsavel_implantacao_email}
                      onChange={(e) => setNewClientData({ ...newClientData, responsavel_implantacao_email: e.target.value })}
                      className="mt-1 block w-full p-2 bg-gray-700 border border-gray-600 rounded-md text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300">Telefone</label>
                    <input
                      type="text"
                      value={newClientData.responsavel_implantacao_telefone}
                      onChange={(e) => setNewClientData({ ...newClientData, responsavel_implantacao_telefone: e.target.value })}
                      className="mt-1 block w-full p-2 bg-gray-700 border border-gray-600 rounded-md text-white"
                    />
                  </div>
                </div>
              </div>
              <div className="md:col-span-2">
                <h4 className="text-lg font-semibold text-blue-400 mt-4 mb-2">💰 Responsável Financeiro</h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300">Nome</label>
                    <input
                      type="text"
                      value={newClientData.responsavel_financeiro_nome}
                      onChange={(e) => setNewClientData({ ...newClientData, responsavel_financeiro_nome: e.target.value })}
                      className="mt-1 block w-full p-2 bg-gray-700 border border-gray-600 rounded-md text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300">E-mail</label>
                    <input
                      type="email"
                      value={newClientData.responsavel_financeiro_email}
                      onChange={(e) => setNewClientData({ ...newClientData, responsavel_financeiro_email: e.target.value })}
                      className="mt-1 block w-full p-2 bg-gray-700 border border-gray-600 rounded-md text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300">Telefone</label>
                    <input
                      type="text"
                      value={newClientData.responsavel_financeiro_telefone}
                      onChange={(e) => setNewClientData({ ...newClientData, responsavel_financeiro_telefone: e.target.value })}
                      className="mt-1 block w-full p-2 bg-gray-700 border border-gray-600 rounded-md text-white"
                    />
                  </div>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300">CPF do Contato Principal</label>
                <input
                  type="text"
                  value={newClientData.cpf_contato_principal}
                  onChange={(e) => setNewClientData({ ...newClientData, cpf_contato_principal: clean(e.target.value) })}
                  className="mt-1 block w-full p-2 bg-gray-700 border border-gray-600 rounded-md text-white"
                  maxLength={11}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300">Regime Tributário</label>
                <select
                  value={newClientData.regime_tributario}
                  onChange={(e) => setNewClientData({ ...newClientData, regime_tributario: e.target.value })}
                  className="mt-1 block w-full p-2 bg-gray-700 border border-gray-600 rounded-md text-white"
                >
                  <option value="">Selecione...</option>
                  <option value="Simples Nacional">Simples Nacional</option>
                  <option value="Lucro Presumido">Lucro Presumido</option>
                  <option value="Lucro Real">Lucro Real</option>
                  <option value="MEI">MEI</option>
                </select>
              </div>
            </div>
            <div className="flex justify-end space-x-4 mt-6">
              <button onClick={() => setShowAddClientModal(false)} className="px-6 py-2 bg-gray-600 rounded-lg hover:bg-gray-700 transition-colors">Cancelar</button>
              <button onClick={handleSaveClient} className="px-6 py-2 bg-green-600 rounded-lg hover:bg-green-700 transition-colors">✅ Salvar Cliente</button>
            </div>
          </div>
        </div>
      )}

      {/* Proposal Preview Modal */}
      {showProposalPreview && currentProposal && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 p-8 rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto relative">
            <h3 className="text-2xl font-bold mb-6 text-center">📄 Prévia da Proposta</h3>
            <button onClick={() => setShowProposalPreview(false)} className="absolute top-4 right-4 text-gray-400 hover:text-white text-2xl">✕</button>
            <iframe srcDoc={proposalHtml} className="w-full h-[60vh] border border-gray-700 rounded-lg bg-white" title="Prévia da Proposta"></iframe>
            <div className="flex justify-end space-x-4 mt-6">
              <button onClick={() => handleSendProposal(currentProposal)} className="px-6 py-2 bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors">📧 Enviar por E-mail</button>
              <button onClick={() => setShowProposalPreview(false)} className="px-6 py-2 bg-gray-600 rounded-lg hover:bg-gray-700 transition-colors">Fechar</button>
            </div>
          </div>
        </div>
      )}

      {/* Payment Details Modal (for Contract) */}
      {showPaymentModal && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 p-8 rounded-lg shadow-xl w-full max-w-md relative">
            <h3 className="text-2xl font-bold mb-6 text-center">📝 Configurar Contrato</h3>
            <button onClick={() => setShowPaymentModal(false)} className="absolute top-4 right-4 text-gray-400 hover:text-white text-2xl">✕</button>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300">💳 Condição de Pagamento da Adesão</label>
                <select
                  value={paymentDetails.adesao_condicao}
                  onChange={(e) => setPaymentDetails({ ...paymentDetails, adesao_condicao: e.target.value })}
                  className="mt-1 block w-full p-2 bg-gray-700 border border-gray-600 rounded-md text-white"
                >
                  <option value="vista">Pagamento à vista</option>
                  <option value="pix_boleto">PIX ou Boleto à vista</option>
                  <option value="cartao">Cartão de Crédito — sem juros</option>
                  <option value="boleto_parcelado">Boleto parcelado — sem juros</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300">Vencimento da Adesão *</label>
                <input
                  type="date"
                  value={paymentDetails.adesao_vencimento}
                  onChange={(e) => setPaymentDetails({ ...paymentDetails, adesao_vencimento: e.target.value })}
                  className="mt-1 block w-full p-2 bg-gray-700 border border-gray-600 rounded-md text-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300">Vencimento da Mensalidade *</label>
                <input
                  type="date"
                  value={paymentDetails.mensalidade_vencimento}
                  onChange={(e) => setPaymentDetails({ ...paymentDetails, mensalidade_vencimento: e.target.value })}
                  className="mt-1 block w-full p-2 bg-gray-700 border border-gray-600 rounded-md text-white"
                />
              </div>
            </div>

            <div className="flex justify-end space-x-4 mt-6">
              <button onClick={() => setShowPaymentModal(false)} className="px-6 py-2 bg-gray-600 rounded-lg hover:bg-gray-700 transition-colors">Cancelar</button>
              <button onClick={handleConfirmPaymentDetails} className="px-6 py-2 bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors">Próximo →</button>
            </div>
          </div>
        </div>
      )}

      {/* Contract Preview Modal */}
      {showContractPreview && contractData && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 p-8 rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto relative">
            <h3 className="text-2xl font-bold mb-6 text-center">📄 Prévia do Contrato</h3>
            <button onClick={() => setShowContractPreview(false)} className="absolute top-4 right-4 text-gray-400 hover:text-white text-2xl">✕</button>
            <iframe srcDoc={contractHtml} className="w-full h-[60vh] border border-gray-700 rounded-lg bg-white" title="Prévia do Contrato"></iframe>
            <div className="flex justify-end space-x-4 mt-6">
              <button onClick={() => handleSendContract(contractData)} className="px-6 py-2 bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors">📧 Enviar para Assinatura</button>
              <button onClick={() => setShowContractPreview(false)} className="px-6 py-2 bg-gray-600 rounded-lg hover:bg-gray-700 transition-colors">Fechar</button>
            </div>
          </div>
        </div>
      )}

      {/* Admin Panel Modal */}
      {showAdminPanel && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 p-8 rounded-lg shadow-xl w-full max-w-md relative">
            <h3 className="text-2xl font-bold mb-6 text-center">👑 Painel Master</h3>
            <button onClick={() => setShowAdminPanel(false)} className="absolute top-4 right-4 text-gray-400 hover:text-white text-2xl">✕</button>

            {!adminPassword ? (
              <div className="space-y-4">
                <p className="text-center text-gray-300">Acesso Master - Área restrita ao administrador do sistema</p>
                <div>
                  <label className="block text-sm font-medium text-gray-300">SENHA</label>
                  <input
                    type="password"
                    value={adminPassword}
                    onChange={(e) => setAdminPassword(e.target.value)}
                    className="mt-1 block w-full p-2 bg-gray-900 border border-gray-600 rounded-md text-white"
                  />
                </div>
                {adminError && <p className="text-red-500 text-sm text-center">{adminError}</p>}
                <div className="flex justify-end space-x-4 mt-6">
                  <button onClick={() => setShowAdminPanel(false)} className="px-6 py-2 bg-gray-600 rounded-lg hover:bg-gray-700 transition-colors">Cancelar</button>
                  <button onClick={handleAdminLogin} className="px-6 py-2 bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors">🔐 Entrar no Painel Master</button>
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                <h4 className="font-semibold mb-3">⚠️ Área Administrativa — Limpeza de Dados</h4>
                <button className="w-full px-4 py-2 bg-red-700 rounded-lg hover:bg-red-800 transition-colors">🗑 Zerar histórico de contratos e propostas</button>
                <button className="w-full px-4 py-2 bg-red-700 rounded-lg hover:bg-red-800 transition-colors">🎯 Zerar metas de todos os usuários</button>
                <button className="w-full px-4 py-2 bg-red-700 rounded-lg hover:bg-red-800 transition-colors">👥 Zerar banco de clientes</button>
                <button className="w-full px-4 py-2 bg-red-900 rounded-lg hover:bg-red-950 transition-colors font-bold">⚠️ RESET COMPLETO — Apagar tudo e restaurar padrões (IRREVERSÍVEL)</button>
                <div className="flex justify-end mt-6">
                  <button onClick={() => setShowAdminPanel(false)} className="px-6 py-2 bg-gray-600 rounded-lg hover:bg-gray-700 transition-colors">Sair</button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Reports Modal */}
      {showReportsModal && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 p-8 rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto relative">
            <h3 className="text-2xl font-bold mb-6 text-center">📊 Relatórios</h3>
            <button onClick={() => setShowReportsModal(false)} className="absolute top-4 right-4 text-gray-400 hover:text-white text-2xl">✕</button>
            <p>Conteúdo dos relatórios aqui. Em breve!</p>
            <div className="flex justify-end mt-6">
              <button onClick={() => setShowReportsModal(false)} className="px-6 py-2 bg-gray-600 rounded-lg hover:bg-gray-700 transition-colors">Fechar</button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
