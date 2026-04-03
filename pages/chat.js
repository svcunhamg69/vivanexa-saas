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
    const[aB,mB]=getPrice(mod,plan,cfg);let ad=aB>0?Math.max(aB*2,1000):0,men=mB*1.2
    if(mod==='XML')men=Math.max(men,175);if(mod==='Gestão Fiscal')men=Math.max(men,200)
    res.push({name:mod,ad,men,adD:ad,menD:men,plan});tAd+=ad;tMen+=men
  }
  return{results:res,tAd,tMen,tAdD:tAd,tMenD:tMen}
}
function calcDisc(mods,plan,ifPlan,cnpjs,notas,cfg,vo){
  const adPct=vo?vo.discAdPct:(cfg.discAdPct||50),menPct=vo?vo.discMenPct:(cfg.discMenPct||0)
  const res=[];let tAd=0,tMen=0,tAdD=0,tMenD=0
  for(const mod of mods){
    if(mod==='IF'){const p=ifPlan||'basic',[aB,mB]=getPrice('IF',p,cfg),ad=aB*2,men=mB*1.2,adD=ad*(1-adPct/100),menD=men*(1-menPct/100);res.push({name:pn('IF',cfg),ad,men,adD,menD,isPrepaid:true,plan:p,isIF:true});tAd+=ad;tMen+=men;tAdD+=adD;tMenD+=menD;continue}
    if(mod==='Tributos'){const m=calcTrib(notas);res.push({name:pn('Tributos',cfg),ad:0,men:m,adD:0,menD:m,isTributos:true,notas});tMen+=m;tMenD+=m;continue}
    if(mod==='EP'){const ep=plan==='topplus'?'top':plan,[,mB]=getPrice('EP',ep,cfg),men=mB*1.2,menD=men*(1-menPct/100);res.push({name:pn('EP',cfg),ad:0,men,adD:0,menD,isEP:true,plan:ep});tMen+=men;tMenD+=menD;continue}
    const[aB,mB]=getPrice(mod,plan,cfg);let ad=aB>0?Math.max(aB*2,1000):0,men=mB*1.2
    if(mod==='XML')men=Math.max(men,175);if(mod==='Gestão Fiscal')men=Math.max(men,200)
    const adD=aB>0?ad*(1-adPct/100):0,menD=men*(1-menPct/100)
    res.push({name:mod,ad,men,adD,menD,plan});tAd+=ad;tMen+=men;tAdD+=adD;tMenD+=menD
  }
  return{results:res,tAd,tMen,tAdD,tMenD}
}
function calcClose(mods,plan,ifPlan,cnpjs,notas,cfg,vo){
  const adPct=vo?vo.discAdPct:(cfg.discClosePct||40),menPct=vo?vo.discMenPct:(cfg.discMenPct||0)
  const res=[];let tAd=0,tMen=0,tAdD=0,tMenD=0
  for(const mod of mods){
    if(mod==='IF'){const p=ifPlan||'basic',[aB,mB]=getPrice('IF',p,cfg),ad=aB*2,men=mB*1.2,adD=ad*(1-adPct/100),menD=men*(1-menPct/100);res.push({name:pn('IF',cfg),ad,men,adD,menD,isPrepaid:true,plan:p,isIF:true});tAd+=ad;tMen+=men;tAdD+=adD;tMenD+=menD;continue}
    if(mod==='Tributos'){const m=calcTrib(notas);res.push({name:pn('Tributos',cfg),ad:0,men:m,adD:0,menD:m,isTributos:true,notas});tMen+=m;tMenD+=m;continue}
    if(mod==='EP'){const ep=plan==='topplus'?'top':plan,[,mB]=getPrice('EP',ep,cfg),men=mB*1.2,menD=men*(1-menPct/100);res.push({name:pn('EP',cfg),ad:0,men,adD:0,menD,isEP:true,plan:ep});tMen+=men;tMenD+=menD;continue}
    const[aB,mB]=getPrice(mod,plan,cfg);let ad=aB>0?Math.max(aB*2,1000):0,men=mB*1.2
    if(mod==='XML')men=Math.max(men,175);if(mod==='Gestão Fiscal')men=Math.max(men,200)
    const adD=aB>0?ad*(1-adPct/100):0,menD=men*(1-menPct/100)
    res.push({name:mod,ad,men,adD,menD,plan});tAd+=ad;tMen+=men;tAdD+=adD;tMenD+=menD
  }
  return{results:res,tAd,tMen,tAdD,tMenD}
}

// ── Componente Principal ─────────────────────────────────────
export default function Chat() {
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [session, setSession] = useState(null)
  const [cfg, setCfg] = useState(null)
  const [showConfig, setShowConfig] = useState(false)
  const [showClientModal, setShowClientModal] = useState(false)
  const [showEditClientModal, setShowEditClientModal] = useState(false)
  const [showSignModal, setShowSignModal] = useState(false)
  const [showPaymentModal, setShowPaymentModal] = useState(false)
  const [showEditTemplateModal, setShowEditTemplateModal] = useState(false)
  const [currentTemplateType, setCurrentTemplateType] = useState(null)
  const [currentTemplateContent, setCurrentTemplateContent] = useState('')
  const [selectedClient, setSelectedClient] = useState(null)
  const [newClientData, setNewClientData] = useState({
    cpf_cnpj: '', nome_fantasia: '', razao_social: '',
    contato_nome: '', email: '', telefone: '',
    cep: '', endereco: '', bairro: '', cidade: '', estado: '',
    resp_impl_nome: '', resp_impl_email: '', resp_impl_telefone: '',
    resp_fin_nome: '', resp_fin_email: '', resp_fin_telefone: '',
    cpf_contato_principal: '', regime_tributario: ''
  })
  const [paymentCondition, setPaymentCondition] = useState('vista')
  const [adesaoDueDate, setAdesaoDueDate] = useState('')
  const [otherAdesaoDueDate, setOtherAdesaoDueDate] = useState('')
  const [mensalidadeDueDate, setMensalidadeDueDate] = useState('5')
  const [otherMensalidadeDueDate, setOtherMensalidadeDueDate] = useState('')
  const [userSignature, setUserSignature] = useState(null)
  const [showDrawSignatureModal, setShowDrawSignatureModal] = useState(false)
  const [isDrawing, setIsDrawing] = useState(false)
  const [signatureCanvas, setSignatureCanvas] = useState(null)
  const [signatureCtx, setSignatureCtx] = useState(null)
  const [lastPos, setLastPos] = useState({ x: 0, y: 0 })
  const [showCRMModal, setShowCRMModal] = useState(false)
  const [crmData, setCrmData] = useState('')
  const [showEditUserModal, setShowEditUserModal] = useState(false)
  const [editingUser, setEditingUser] = useState(null)
  const [editUserSignature, setEditUserSignature] = useState(null)
  const [showAddProductModal, setShowAddProductModal] = useState(false)
  const [newProductData, setNewProductData] = useState({
    name: '', internal_key: '', prices: {}, no_adesao: false, basic_pro_top_only: false
  })
  const [showAddPlanModal, setShowAddPlanModal] = useState(false)
  const [newPlanData, setNewPlanData] = useState({
    id: '', name: '', maxCnpjs: 0, users: 1, unlimited: false
  })
  const [showAdminPanel, setShowAdminPanel] = useState(false)
  const [adminPassword, setAdminPassword] = useState('')
  const [adminError, setAdminError] = useState('')
  const [showReportsModal, setShowReportsModal] = useState(false)

  const messagesEndRef = useRef(null)
  const router = useRouter()

  // ── Efeitos e Carregamento Inicial ──────────────────────────
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
    })
    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      if (!session) router.push('/')
    })
    return () => authListener.subscription.unsubscribe()
  }, [router])

  useEffect(() => {
    if (!session) return
    const loadCfg = async () => {
      const { data: perfil } = await supabase
        .from('perfis')
        .select('*')
        .eq('user_id', session.user.id)
        .maybeSingle()

      const empresaId = perfil?.empresa_id || session.user.id
      const { data: row } = await supabase
        .from('vx_storage')
        .select('value')
        .eq('key', `cfg:${empresaId}`)
        .single()

      if (row?.value) {
        setCfg(JSON.parse(row.value))
      } else {
        setCfg(DEFAULT_CFG)
      }
    }
    loadCfg()
  }, [session])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // ── Funções de Manipulação de Estado e UI ───────────────────
  const handleInputChange = (e) => setInput(e.target.value)

  const handleSendMessage = async (e) => {
    e.preventDefault()
    if (!input.trim() || loading) return

    const userMessage = { role: 'user', content: input }
    setMessages((prev) => [...prev, userMessage])
    setInput('')
    setLoading(true)

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: input, cfg, session }),
      })
      const data = await response.json()

      if (data.error) {
        setMessages((prev) => [...prev, { role: 'assistant', content: `Erro: ${data.error}` }])
      } else {
        setMessages((prev) => [...prev, { role: 'assistant', content: data.response }])
      }
    } catch (error) {
      console.error('Erro ao enviar mensagem:', error)
      setMessages((prev) => [...prev, { role: 'assistant', content: 'Desculpe, houve um erro ao processar sua solicitação.' }])
    } finally {
      setLoading(false)
    }
  }

  const handleChipClick = (content) => {
    setInput(content)
    // handleSendMessage({ preventDefault: () => {} }) // Não envia automaticamente, apenas preenche
  }

  const handleClearChat = () => {
    setMessages([])
    setInput('')
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/')
  }

  const handleSaveCfg = async (newCfg) => {
    if (!session) return
    const { data: perfil } = await supabase
      .from('perfis')
      .select('empresa_id')
      .eq('user_id', session.user.id)
      .maybeSingle()
    const empresaId = perfil?.empresa_id || session.user.id

    const { error } = await supabase
      .from('vx_storage')
      .upsert({ key: `cfg:${empresaId}`, value: JSON.stringify(newCfg) }, { onConflict: 'key' })

    if (error) {
      console.error('Erro ao salvar configuração:', error)
      alert('Erro ao salvar configuração.')
    } else {
      setCfg(newCfg)
      alert('Configuração salva com sucesso!')
      setShowConfig(false)
    }
  }

  const handleClientChange = (e) => {
    const { name, value } = e.target
    setNewClientData(prev => ({ ...prev, [name]: value }))
  }

  const handleSaveClient = async () => {
    if (!session) return
    const { data: perfil } = await supabase
      .from('perfis')
      .select('empresa_id')
      .eq('user_id', session.user.id)
      .maybeSingle()
    const empresaId = perfil?.empresa_id || session.user.id

    const clientToSave = { ...newClientData, cpf_cnpj: clean(newClientData.cpf_cnpj) }

    if (!clientToSave.cpf_cnpj || !clientToSave.nome_fantasia) {
      alert('CPF/CNPJ e Nome Fantasia são obrigatórios.')
      return
    }

    // Validação de duplicidade
    const existingClient = cfg.clients.find(c => clean(c.cpf_cnpj) === clientToSave.cpf_cnpj)
    if (existingClient && (!selectedClient || existingClient.id !== selectedClient.id)) {
      alert('Já existe um cliente com este CPF/CNPJ.')
      return
    }

    let updatedClients
    if (selectedClient) {
      updatedClients = cfg.clients.map(c => c.id === selectedClient.id ? { ...clientToSave, id: selectedClient.id } : c)
    } else {
      updatedClients = [...cfg.clients, { ...clientToSave, id: generateToken() }]
    }

    const newCfg = { ...cfg, clients: updatedClients }
    await handleSaveCfg(newCfg)
    setShowClientModal(false)
    setShowEditClientModal(false)
    setSelectedClient(null)
    setNewClientData({
      cpf_cnpj: '', nome_fantasia: '', razao_social: '',
      contato_nome: '', email: '', telefone: '',
      cep: '', endereco: '', bairro: '', cidade: '', estado: '',
      resp_impl_nome: '', resp_impl_email: '', resp_impl_telefone: '',
      resp_fin_nome: '', resp_fin_email: '', resp_fin_telefone: '',
      cpf_contato_principal: '', regime_tributario: ''
    })
  }

  const handleEditClient = (client) => {
    setSelectedClient(client)
    setNewClientData(client)
    setShowEditClientModal(true)
  }

  const handleDeleteClient = async (clientId) => {
    if (!confirm('Tem certeza que deseja excluir este cliente?')) return
    const updatedClients = cfg.clients.filter(c => c.id !== clientId)
    const newCfg = { ...cfg, clients: updatedClients }
    await handleSaveCfg(newCfg)
  }

  const handleOpenSignModal = (doc) => {
    setSelectedClient(cfg.clients.find(c => c.id === doc.clientId))
    setMessages((prev) => [...prev, { role: 'assistant', content: `Gerando link de assinatura para o documento ${doc.id}...` }])
    router.push(`/sign/${doc.id}`)
  }

  const handlePaymentConditionChange = (e) => setPaymentCondition(e.target.value)
  const handleAdesaoDueDateChange = (e) => setAdesaoDueDate(e.target.value)
  const handleOtherAdesaoDueDateChange = (e) => setOtherAdesaoDueDate(e.target.value)
  const handleMensalidadeDueDateChange = (e) => setMensalidadeDueDate(e.target.value)
  const handleOtherMensalidadeDueDateChange = (e) => setOtherMensalidadeDueDate(e.target.value)

  const handleGenerateContract = async (doc) => {
    if (!adesaoDueDate) {
      alert('Por favor, selecione a data de vencimento da adesão.')
      return
    }

    const docToUpdate = {
      ...doc,
      paymentCondition,
      adesaoDueDate: adesaoDueDate === 'other' ? otherAdesaoDueDate : adesaoDueDate,
      mensalidadeDueDate: mensalidadeDueDate === 'other' ? otherMensalidadeDueDate : mensalidadeDueDate,
      status: 'Aguardando assinatura'
    }

    const updatedDocs = cfg.documents.map(d => d.id === doc.id ? docToUpdate : d)
    const newCfg = { ...cfg, documents: updatedDocs }
    await handleSaveCfg(newCfg)
    setShowPaymentModal(false)
    setMessages((prev) => [...prev, { role: 'assistant', content: `Contrato ${doc.id} configurado para assinatura. Compartilhe o link: ${window.location.origin}/sign/${doc.id}` }])
  }

  const handleOpenEditTemplate = (type) => {
    setCurrentTemplateType(type)
    setCurrentTemplateContent(cfg[type] || '')
    setShowEditTemplateModal(true)
  }

  const handleSaveTemplate = async () => {
    const newCfg = { ...cfg, [currentTemplateType]: currentTemplateContent }
    await handleSaveCfg(newCfg)
    setShowEditTemplateModal(false)
  }

  const handleUseDefaultTemplate = async () => {
    const newCfg = { ...cfg, [currentTemplateType]: '' }
    await handleSaveCfg(newCfg)
    setCurrentTemplateContent('')
    alert('Modelo padrão restaurado.')
  }

  const handleOpenCRMModal = (doc) => {
    const client = cfg.clients.find(c => c.id === doc.clientId)
    if (!client) {
      alert('Cliente não encontrado para este documento.')
      return
    }
    const crmText = `
Nome Fantasia: ${client.nome_fantasia}
Razão Social: ${client.razao_social}
CPF/CNPJ: ${fmtDoc(client.cpf_cnpj)}
Contato Principal: ${client.contato_nome}
E-mail: ${client.email}
Telefone: ${client.telefone}
CEP: ${client.cep}
Endereço: ${client.endereco}, ${client.bairro}, ${client.cidade} - ${client.estado}
Responsável Implantação: ${client.resp_impl_nome} (${client.resp_impl_email} / ${client.resp_impl_telefone})
Responsável Financeiro: ${client.resp_fin_nome} (${client.resp_fin_email} / ${client.resp_fin_telefone})
Regime Tributário: ${client.regime_tributario}

Detalhes do Contrato:
Tipo: ${doc.type === 'proposal' ? 'Proposta' : 'Contrato'}
ID: ${doc.id}
Data: ${new Date(doc.date).toLocaleDateString()}
Módulos: ${doc.mods.map(m => pn(m, cfg)).join(', ')}
CNPJs: ${doc.cnpjs}
Notas: ${doc.notas || 'N/A'}
Plano: ${getPlanLabel(doc.plan, cfg.plans)}
Plano IF: ${doc.ifPlan ? getPlanLabel(doc.ifPlan, cfg.plans) : 'N/A'}
Adesão: ${fmt(doc.tAdD)}
Mensalidade: ${fmt(doc.tMenD)}
Condição de Pagamento Adesão: ${doc.paymentCondition}
Vencimento Adesão: ${doc.adesaoDueDate}
Vencimento Mensalidade: ${doc.mensalidadeDueDate}
Status: ${doc.status}
    `
    setCrmData(crmText)
    setShowCRMModal(true)
  }

  const handleCopyCRMData = () => {
    navigator.clipboard.writeText(crmData)
    alert('Dados copiados para a área de transferência!')
  }

  const handleOpenEditUser = (user) => {
    setEditingUser(user)
    setEditUserSignature(user.signature_img || null)
    setShowEditUserModal(true)
  }

  const handleSaveUser = async () => {
    if (!editingUser) return

    const { data, error } = await supabase
      .from('perfis')
      .update({
        nome: editingUser.nome,
        email: editingUser.email,
        telefone: editingUser.telefone,
        perfil: editingUser.perfil,
        signature_img: editUserSignature,
        // Não atualiza a senha aqui, pois é um campo sensível e deve ser tratado separadamente
      })
      .eq('user_id', editingUser.user_id)
      .select()
      .single()

    if (error) {
      console.error('Erro ao salvar usuário:', error)
      alert('Erro ao salvar usuário.')
    } else {
      alert('Usuário atualizado com sucesso!')
      setShowEditUserModal(false)
      // Recarregar a lista de usuários ou atualizar o estado local
      // Para simplificar, vamos apenas fechar o modal.
    }
  }

  const handleAddProduct = async () => {
    if (!newProductData.name || !newProductData.internal_key) {
      alert('Nome e ID/Chave interna do produto são obrigatórios.')
      return
    }

    const newCfg = { ...cfg }
    if (!newCfg.products) newCfg.products = []
    newCfg.products.push({ ...newProductData, id: generateToken() })

    // Adicionar preços padrão para o novo produto
    if (!newCfg.prices[newProductData.internal_key]) {
      newCfg.prices[newProductData.internal_key] = {}
      cfg.plans.forEach(plan => {
        newCfg.prices[newProductData.internal_key][plan.id] = [0, 0]
      })
    }

    await handleSaveCfg(newCfg)
    setShowAddProductModal(false)
    setNewProductData({
      name: '', internal_key: '', prices: {}, no_adesao: false, basic_pro_top_only: false
    })
  }

  const handleAddPlan = async () => {
    if (!newPlanData.id || !newPlanData.name || newPlanData.maxCnpjs <= 0) {
      alert('ID, Nome e Máximo de CNPJs são obrigatórios e devem ser válidos.')
      return
    }

    const newCfg = { ...cfg }
    if (!newCfg.plans) newCfg.plans = []
    newCfg.plans.push({ ...newPlanData })

    // Adicionar preços padrão para o novo plano em todos os produtos existentes
    for (const productKey in newCfg.prices) {
      if (newCfg.prices.hasOwnProperty(productKey)) {
        newCfg.prices[productKey][newPlanData.id] = [0, 0]
      }
    }

    await handleSaveCfg(newCfg)
    setShowAddPlanModal(false)
    setNewPlanData({
      id: '', name: '', maxCnpjs: 0, users: 1, unlimited: false
    })
  }

  const handleUpdateProductPrice = (productKey, planId, type, value) => {
    const newCfg = { ...cfg }
    if (!newCfg.prices[productKey]) newCfg.prices[productKey] = {}
    if (!newCfg.prices[productKey][planId]) newCfg.prices[productKey][planId] = [0, 0]

    const priceArray = [...newCfg.prices[productKey][planId]]
    if (type === 'adesao') {
      priceArray[0] = parseFloat(value) || 0
    } else {
      priceArray[1] = parseFloat(value) || 0
    }
    newCfg.prices[productKey][planId] = priceArray
    setCfg(newCfg) // Atualiza o estado local para refletir a mudança imediatamente
  }

  const handleResetPrices = async () => {
    if (!confirm('Tem certeza que deseja restaurar os preços padrão? Isso apagará todos os preços personalizados.')) return
    const newCfg = { ...cfg, prices: DEFAULT_CFG.prices }
    await handleSaveCfg(newCfg)
  }

  const handleAdminLogin = async () => {
    if (adminPassword === 'vivanexa123') { // Senha fixa para acesso master
      setShowAdminPanel(true)
      setAdminError('')
    } else {
      setAdminError('Senha incorreta.')
    }
  }

  // ── Funções de Assinatura ───────────────────────────────────
  const initSignatureCanvas = (canvas) => {
    if (canvas) {
      setSignatureCanvas(canvas)
      const ctx = canvas.getContext('2d')
      ctx.lineWidth = 2
      ctx.lineCap = 'round'
      ctx.strokeStyle = '#000'
      setSignatureCtx(ctx)
    }
  }

  const startDrawing = ({ nativeEvent }) => {
    setIsDrawing(true)
    const { offsetX, offsetY } = nativeEvent
    signatureCtx.beginPath()
    signatureCtx.moveTo(offsetX, offsetY)
    setLastPos({ x: offsetX, y: offsetY })
  }

  const draw = ({ nativeEvent }) => {
    if (!isDrawing) return
    const { offsetX, offsetY } = nativeEvent
    signatureCtx.lineTo(offsetX, offsetY)
    signatureCtx.stroke()
    setLastPos({ x: offsetX, y: offsetY })
  }

  const stopDrawing = () => {
    setIsDrawing(false)
    signatureCtx.closePath()
  }

  const clearSignature = () => {
    if (signatureCtx && signatureCanvas) {
      signatureCtx.clearRect(0, 0, signatureCanvas.width, signatureCanvas.height)
      setUserSignature(null)
      setEditUserSignature(null)
    }
  }

  const saveSignature = () => {
    if (signatureCanvas) {
      const dataUrl = signatureCanvas.toDataURL('image/png')
      if (showEditUserModal) {
        setEditUserSignature(dataUrl)
      } else {
        setUserSignature(dataUrl)
      }
      setShowDrawSignatureModal(false)
    }
  }

  // ── Geração de Documentos (Proposta/Contrato) ────────────────
  const buildContract = (doc, client, consultantSignature = null, clientSignature = null) => {
    const companyLogo = cfg.companyLogo || '' // Assumindo que a logo está em cfg.companyLogo
    const companyName = cfg.company || DEFAULT_CFG.company
    const companySlogan = cfg.slogan || DEFAULT_CFG.slogan
    const contractTemplate = cfg.contractTemplate || '' // Conteúdo do template de contrato
    const proposalTemplate = cfg.proposalTemplate || '' // Conteúdo do template de proposta

    const isContract = doc.type === 'contract'
    const templateContent = isContract ? contractTemplate : proposalTemplate

    const productsTable = doc.results.map(item => `
      <tr>
        <td>${item.name}</td>
        <td>${getPlanLabel(item.plan, cfg.plans)}</td>
        <td>${fmt(item.adD)}</td>
        <td>${fmt(item.menD)}</td>
      </tr>
    `).join('')

    const today = new Date().toLocaleDateString('pt-BR')

    // Formatação das assinaturas
    const consultantSignatureHtml = consultantSignature ? `
      <div style="text-align: center; margin-top: 40px;">
        <img src="${consultantSignature}" alt="Assinatura do Consultor" style="max-width: 200px; height: auto; border-bottom: 1px solid #000; padding-bottom: 5px;">
        <p style="margin-top: 5px; font-size: 14px;">${session?.user?.user_metadata?.name || 'Consultor Vivanexa'}</p>
        <p style="font-size: 12px;">CPF: ${session?.user?.user_metadata?.cpf || 'Não informado'}</p>
        <p style="font-size: 12px;">E-mail: ${session?.user?.email || 'Não informado'}</p>
      </div>
    ` : `
      <div style="text-align: center; margin-top: 40px;">
        <div style="width: 200px; height: 100px; border-bottom: 1px solid #000; margin: 0 auto;"></div>
        <p style="margin-top: 5px; font-size: 14px;">${session?.user?.user_metadata?.name || 'Consultor Vivanexa'}</p>
        <p style="font-size: 12px;">CPF: ${session?.user?.user_metadata?.cpf || 'Não informado'}</p>
        <p style="font-size: 12px;">E-mail: ${session?.user?.email || 'Não informado'}</p>
      </div>
    `;

    const clientSignatureHtml = clientSignature ? `
      <div style="text-align: center; margin-top: 40px;">
        <img src="${clientSignature}" alt="Assinatura do Cliente" style="max-width: 200px; height: auto; border-bottom: 1px solid #000; padding-bottom: 5px;">
        <p style="margin-top: 5px; font-size: 14px;">${client.contato_nome || client.nome_fantasia}</p>
        <p style="font-size: 12px;">CPF/CNPJ: ${fmtDoc(client.cpf_cnpj)}</p>
        <p style="font-size: 12px;">E-mail: ${client.email}</p>
      </div>
    ` : `
      <div style="text-align: center; margin-top: 40px;">
        <div style="width: 200px; height: 100px; border-bottom: 1px solid #000; margin: 0 auto;"></div>
        <p style="margin-top: 5px; font-size: 14px;">${client.contato_nome || client.nome_fantasia}</p>
        <p style="font-size: 12px;">CPF/CNPJ: ${fmtDoc(client.cpf_cnpj)}</p>
        <p style="font-size: 12px;">E-mail: ${client.email}</p>
      </div>
    `;

    const signaturesSection = `
      <div style="display: flex; justify-content: space-around; margin-top: 80px; page-break-before: always;">
        ${consultantSignatureHtml}
        ${clientSignatureHtml}
      </div>
      <p style="text-align: center; margin-top: 20px; font-size: 10px; color: #666;">
        Documento assinado eletronicamente em ${today}.
        Detalhes da assinatura: IP, data e hora registrados.
      </p>
    `;

    // Substituições no template
    let html = `
      <!DOCTYPE html>
      <html lang="pt-BR">
      <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>${isContract ? 'Contrato' : 'Proposta'} Comercial - ${companyName}</title>
          <style>
              body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 20px; }
              .container { max-width: 800px; margin: 0 auto; background: #fff; padding: 30px; border-radius: 8px; box-shadow: 0 0 10px rgba(0,0,0,0.1); }
              .header { text-align: center; margin-bottom: 30px; }
              .header img { max-width: 150px; margin-bottom: 10px; }
              .header h1 { margin: 0; color: #0056b3; }
              .header p { margin: 5px 0 0; font-size: 1.1em; color: #555; }
              h2 { color: #0056b3; border-bottom: 2px solid #eee; padding-bottom: 10px; margin-top: 30px; }
              table { width: 100%; border-collapse: collapse; margin-top: 20px; }
              th, td { border: 1px solid #ddd; padding: 10px; text-align: left; }
              th { background-color: #f2f2f2; }
              .total { font-weight: bold; }
              .footer { text-align: center; margin-top: 50px; font-size: 0.9em; color: #777; }
              .signature-area { margin-top: 60px; padding-top: 20px; border-top: 1px dashed #ccc; text-align: center; }
              .signature-line { display: inline-block; width: 250px; border-bottom: 1px solid #000; margin: 0 40px; padding-bottom: 5px; }
              .signature-name { margin-top: 5px; font-size: 0.9em; }
              .page-break { page-break-before: always; }
          </style>
      </head>
      <body>
          <div class="container">
              <div class="header">
                  ${companyLogo ? `<img src="${companyLogo}" alt="${companyName} Logo">` : ''}
                  <h1>${companyName}</h1>
                  <p>${companySlogan}</p>
                  <h2>${isContract ? 'CONTRATO DE PRESTAÇÃO DE SERVIÇOS' : 'PROPOSTA COMERCIAL'}</h2>
              </div>

              ${templateContent || `
              <p>Prezado(a) ${client.contato_nome || client.nome_fantasia},</p>
              <p>Apresentamos a seguir a proposta de serviços da ${companyName}, desenvolvida para atender às necessidades de sua empresa.</p>
              `}

              <h2>Dados do Cliente</h2>
              <p><strong>Nome Fantasia:</strong> ${client.nome_fantasia}</p>
              <p><strong>Razão Social:</strong> ${client.razao_social}</p>
              <p><strong>CPF/CNPJ:</strong> ${fmtDoc(client.cpf_cnpj)}</p>
              <p><strong>Contato Principal:</strong> ${client.contato_nome}</p>
              <p><strong>E-mail:</strong> ${client.email}</p>
              <p><strong>Telefone:</strong> ${client.telefone}</p>
              <p><strong>Endereço:</strong> ${client.endereco}, ${client.bairro}, ${client.cidade} - ${client.estado} - CEP: ${client.cep}</p>
              <p><strong>Regime Tributário:</strong> ${client.regime_tributario}</p>

              <h2>Serviços Contratados</h2>
              <table>
                  <thead>
                      <tr>
                          <th>Módulo</th>
                          <th>Plano</th>
                          <th>Adesão</th>
                          <th>Mensalidade</th>
                      </tr>
                  </thead>
                  <tbody>
                      ${productsTable}
                  </tbody>
                  <tfoot>
                      <tr class="total">
                          <td colspan="2">Total</td>
                          <td>${fmt(doc.tAdD)}</td>
                          <td>${fmt(doc.tMenD)}</td>
                      </tr>
                  </tfoot>
              </table>

              <h2>Condições de Pagamento</h2>
              <p><strong>Adesão:</strong> ${doc.paymentCondition === 'vista' ? 'Pagamento à vista' : doc.paymentCondition}</p>
              <p><strong>Vencimento da Adesão:</strong> ${doc.adesaoDueDate}</p>
              <p><strong>Vencimento da Mensalidade:</strong> Dia ${doc.mensalidadeDueDate} de cada mês.</p>

              ${isContract ? `
                <h2>Cláusulas Contratuais</h2>
                <p>Aqui seriam inseridas as cláusulas padrão do contrato. Exemplo: Prazo de 12 meses, renovação automática, rescisão, confidencialidade, foro, etc.</p>
                <p>Para detalhes completos, consulte o documento anexo ou o termo de serviço em nosso site.</p>
              ` : `
                <h2>Validade da Proposta</h2>
                <p>Esta proposta é válida por 15 dias a partir da data de emissão.</p>
              `}

              <p style="margin-top: 30px;">Atenciosamente,</p>
              <p><strong>${companyName}</strong></p>

              ${signaturesSection}

              <div class="footer">
                  <p>${companyName} - ${companySlogan}</p>
                  <p>Gerado em ${today}</p>
              </div>
          </div>
      </body>
      </html>
    `;

    // Substituições adicionais para o template personalizado
    html = html.replace(/{{CLIENT_NAME}}/g, client.contato_nome || client.nome_fantasia)
               .replace(/{{COMPANY_NAME}}/g, companyName)
               .replace(/{{CONTRACT_ID}}/g, doc.id)
               .replace(/{{TODAY_DATE}}/g, today)
               .replace(/{{TOTAL_ADESAO}}/g, fmt(doc.tAdD))
               .replace(/{{TOTAL_MENSALIDADE}}/g, fmt(doc.tMenD))
               .replace(/{{PAYMENT_CONDITION}}/g, doc.paymentCondition === 'vista' ? 'Pagamento à vista' : doc.paymentCondition)
               .replace(/{{ADESAO_DUE_DATE}}/g, doc.adesaoDueDate)
               .replace(/{{MENSALIDADE_DUE_DATE}}/g, doc.mensalidadeDueDate)
               .replace(/{{CONSULTANT_NAME}}/g, session?.user?.user_metadata?.name || 'Consultor Vivanexa')
               .replace(/{{CONSULTANT_EMAIL}}/g, session?.user?.email || 'Não informado')
               .replace(/{{CLIENT_CNPJ}}/g, fmtDoc(client.cpf_cnpj))
               .replace(/{{CLIENT_EMAIL}}/g, client.email);

    return html;
  }

  // Nova função para gerar PDF e enviar e-mail
  const generatePdfAndSendEmail = async (doc, client, consultantSignature, clientSignature) => {
    setLoading(true);
    try {
      const signedContractHtml = buildContract(doc, client, consultantSignature, clientSignature);

      // 1. Gerar PDF
      const pdfResponse = await fetch('/api/generate-pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ htmlContent: signedContractHtml }),
      });

      if (!pdfResponse.ok) {
        const errorData = await pdfResponse.json();
        throw new Error(`Erro ao gerar PDF: ${errorData.error}`);
      }

      const pdfBlob = await pdfResponse.blob();
      const reader = new FileReader();
      reader.readAsDataURL(pdfBlob);
      reader.onloadend = async () => {
        const base64Pdf = reader.result.split(',')[1]; // Extrai o base64

        // 2. Enviar e-mail com o PDF anexado
        const emailConfig = cfg.emailConfig || {}; // Assumindo que as configs de email estão em cfg.emailConfig
        const emailSubject = `Contrato Assinado - ${cfg.company || DEFAULT_CFG.company} - ${client.nome_fantasia}`;
        const emailBody = `
          <p>Prezado(a) ${client.contato_nome || client.nome_fantasia},</p>
          <p>Seu contrato com a ${cfg.company || DEFAULT_CFG.company} foi assinado por ambas as partes e está anexado a este e-mail.</p>
          <p>Agradecemos a confiança!</p>
          <p>Atenciosamente,</p>
          <p>${cfg.company || DEFAULT_CFG.company}</p>
        `;

        const sendEmailResponse = await fetch('/api/send-email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            to: client.email,
            subject: emailSubject,
            html: emailBody,
            from: emailConfig.smtpUser || 'noreply@vivanexa.com', // Remetente padrão ou configurado
            config: emailConfig,
            attachments: [{
              filename: `contrato_${doc.id}.pdf`,
              content: base64Pdf,
              encoding: 'base64',
              contentType: 'application/pdf'
            }]
          }),
        });

        if (!sendEmailResponse.ok) {
          const errorData = await sendEmailResponse.json();
          throw new Error(`Erro ao enviar e-mail: ${errorData.error}`);
        }

        setMessages((prev) => [...prev, { role: 'assistant', content: `E-mail com o contrato PDF enviado para ${client.email}!` }]);
      };
    } catch (error) {
      console.error('Erro no processo de PDF e e-mail:', error);
      setMessages((prev) => [...prev, { role: 'assistant', content: `Erro ao gerar PDF ou enviar e-mail: ${error.message}` }]);
    } finally {
      setLoading(false);
    }
  };


  // ── Renderização ────────────────────────────────────────────
  if (!session || !cfg) {
    return <div className="flex items-center justify-center min-h-screen bg-gray-900 text-white">Carregando...</div>
  }

  const userIsAdmin = session?.user?.user_metadata?.perfil === 'admin' || cfg.users?.find(u => u.user_id === session.user.id)?.perfil === 'admin'

  return (
    <div className="flex flex-col h-screen bg-gray-900 text-white">
      <Head>
        <title>{cfg.company || DEFAULT_CFG.company} - Assistente Comercial</title>
        <link rel="icon" href="/favicon.ico" />
      </Head>

      {/* Header */}
      <header className="flex items-center justify-between p-4 bg-gray-800 shadow-md">
        <div className="flex items-center cursor-pointer" onClick={() => router.push('/chat')}>
          {cfg.companyLogo && <img src={cfg.companyLogo} alt="Logo" className="h-8 mr-2" />}
          <h1 className="text-xl font-bold">{cfg.company || DEFAULT_CFG.company}</h1>
          <p className="ml-2 text-sm text-gray-400">{cfg.slogan || DEFAULT_CFG.slogan}</p>
        </div>
        <nav className="flex items-center space-x-4">
          <button onClick={() => setShowReportsModal(true)} className="text-gray-300 hover:text-white">Relatórios</button>
          <button onClick={() => setShowConfig(true)} className="text-gray-300 hover:text-white">Configurações</button>
          <button onClick={handleLogout} className="text-red-400 hover:text-red-300">Sair</button>
        </nav>
      </header>

      {/* Main Chat Area */}
      <main className="flex-1 flex overflow-hidden">
        {/* Sidebar */}
        <aside className="w-64 bg-gray-800 p-4 border-r border-gray-700 flex flex-col">
          <h2 className="text-lg font-semibold mb-4">Menu</h2>
          <nav className="flex-1">
            <ul>
              <li className="mb-2"><a href="#" className="block p-2 rounded hover:bg-gray-700">📊 Dashboard</a></li>
              <li className="mb-2"><a href="#" className="block p-2 rounded hover:bg-gray-700">📊 Metas</a></li>
              <li className="mb-2"><a href="#" className="block p-2 rounded hover:bg-gray-700">📄 Documentos</a></li>
              <li className="mb-2"><a href="#" className="block p-2 rounded hover:bg-gray-700">🗂️ Histórico</a></li>
              <li className="mb-2"><a href="#" className="block p-2 rounded hover:bg-gray-700">✍️ Assinaturas</a></li>
              {userIsAdmin && <li className="mb-2"><button onClick={() => setShowAdminPanel(true)} className="block w-full text-left p-2 rounded hover:bg-gray-700">🔑 Admin</button></li>}
              <li className="mb-2"><button onClick={() => setShowConfig(true)} className="block w-full text-left p-2 rounded hover:bg-gray-700">⚙️ Configurações</button></li>
              <li className="mb-2"><button onClick={handleLogout} className="block w-full text-left p-2 rounded hover:bg-gray-700">Sair</button></li>
            </ul>
          </nav>
          <div className="mt-auto text-sm text-gray-500">
            <p>Usuário: {session.user.email}</p>
            <p>Perfil: {userIsAdmin ? 'Administrador' : 'Padrão'}</p>
          </div>
        </aside>

        {/* Chat Content */}
        <section className="flex-1 flex flex-col p-4 bg-gray-900">
          <div className="flex-1 overflow-y-auto pr-4" style={{ scrollbarWidth: 'thin', scrollbarColor: '#4a5568 #2d3748' }}>
            {messages.map((msg, index) => (
              <div key={index} className={`mb-4 p-3 rounded-lg max-w-3/4 ${msg.role === 'user' ? 'bg-blue-600 ml-auto' : 'bg-gray-700 mr-auto'}`}>
                <p className="font-bold">{msg.role === 'user' ? 'Você' : 'Assistente'}</p>
                <div dangerouslySetInnerHTML={{ __html: msg.content }} />
                {msg.role === 'assistant' && msg.content.includes('Gerar Proposta') && (
                  <button onClick={() => handleOpenSignModal(msg.document)} className="mt-2 px-3 py-1 bg-green-500 rounded hover:bg-green-600">Gerar Proposta</button>
                )}
                {msg.role === 'assistant' && msg.content.includes('Gerar Contrato') && (
                  <button onClick={() => {
                    setSelectedClient(cfg.clients.find(c => c.id === msg.document.clientId));
                    setShowPaymentModal(true);
                    // Temporariamente armazenar o documento para uso no modal de pagamento
                    // Isso pode ser melhorado com um estado específico para o documento em edição
                    setMessages((prev) => [...prev, { role: 'system', content: JSON.stringify(msg.document) }]);
                  }} className="mt-2 px-3 py-1 bg-green-500 rounded hover:bg-green-600">Configurar Contrato</button>
                )}
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          {/* Input Area */}
          <form onSubmit={handleSendMessage} className="flex mt-4">
            <input
              type="text"
              value={input}
              onChange={handleInputChange}
              placeholder={loading ? 'Pensando...' : 'Digite sua mensagem...'}
              className="flex-1 p-3 rounded-l-lg bg-gray-700 text-white border border-gray-600 focus:outline-none focus:border-blue-500"
              disabled={loading}
            />
            <button
              type="submit"
              className="px-6 py-3 bg-blue-600 rounded-r-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
              disabled={loading}
            >
              {loading ? 'Enviando...' : 'Enviar'}
            </button>
          </form>
          {cfg.modChips && (
            <div className="flex flex-wrap gap-2 mt-2">
              {ALL_MODS.map(mod => (
                <span
                  key={mod}
                  onClick={() => handleChipClick(mod)}
                  className="px-3 py-1 bg-gray-700 rounded-full text-sm cursor-pointer hover:bg-gray-600"
                >
                  {pn(mod, cfg)}
                </span>
              ))}
              <span
                onClick={handleClearChat}
                className="px-3 py-1 bg-red-700 rounded-full text-sm cursor-pointer hover:bg-red-600"
              >
                Limpar Chat
              </span>
            </div>
          )}
        </section>
      </main>

      {/* Modals */}
      {/* Configurações Modal */}
      {showConfig && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 p-8 rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto relative">
            <h3 className="text-2xl font-bold mb-6 text-center">⚙️ Configurações</h3>
            <button onClick={() => setShowConfig(false)} className="absolute top-4 right-4 text-gray-400 hover:text-white text-2xl">✕</button>

            {/* Abas de Configuração */}
            <div className="flex border-b border-gray-700 mb-6">
              {/* Simplificado para fins de exemplo, você pode adicionar mais abas */}
              <button className="py-2 px-4 text-blue-400 border-b-2 border-blue-400">Geral</button>
              <button className="py-2 px-4 text-gray-400 hover:text-white">Empresa</button>
              <button className="py-2 px-4 text-gray-400 hover:text-white">Metas</button>
              <button className="py-2 px-4 text-gray-400 hover:text-white">KPIs</button>
              <button className="py-2 px-4 text-gray-400 hover:text-white">Usuários</button>
              <button className="py-2 px-4 text-gray-400 hover:text-white">Produtos</button>
              <button className="py-2 px-4 text-gray-400 hover:text-white">Descontos</button>
              <button className="py-2 px-4 text-gray-400 hover:text-white">Vouchers</button>
              <button className="py-2 px-4 text-gray-400 hover:text-white">Documentos</button>
              <button className="py-2 px-4 text-gray-400 hover:text-white">Clientes</button>
              <button className="py-2 px-4 text-gray-400 hover:text-white">Tema</button>
            </div>

            {/* Conteúdo da Aba Geral */}
            <div className="space-y-6">
              {/* Identidade Visual */}
              <div className="bg-gray-700 p-4 rounded-md">
                <h4 className="font-semibold mb-3">Identidade Visual</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300">Nome da Empresa</label>
                    <input
                      type="text"
                      value={cfg.company || ''}
                      onChange={(e) => setCfg(prev => ({ ...prev, company: e.target.value }))}
                      className="mt-1 block w-full p-2 bg-gray-900 border border-gray-600 rounded-md text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300">Slogan / Subtítulo</label>
                    <input
                      type="text"
                      value={cfg.slogan || ''}
                      onChange={(e) => setCfg(prev => ({ ...prev, slogan: e.target.value }))}
                      className="mt-1 block w-full p-2 bg-gray-900 border border-gray-600 rounded-md text-white"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-300">Logomarca (URL)</label>
                    <input
                      type="text"
                      value={cfg.companyLogo || ''}
                      onChange={(e) => setCfg(prev => ({ ...prev, companyLogo: e.target.value }))}
                      placeholder="URL da imagem da logo (PNG/JPG)"
                      className="mt-1 block w-full p-2 bg-gray-900 border border-gray-600 rounded-md text-white"
                    />
                    {cfg.companyLogo && <img src={cfg.companyLogo} alt="Logo Preview" className="mt-2 max-h-20" />}
                  </div>
                </div>
              </div>

              {/* Configurações Gerais */}
              <div className="bg-gray-700 p-4 rounded-md">
                <h4 className="font-semibold mb-3">Configurações Gerais</h4>
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    checked={cfg.unlimitedStrategy || false}
                    onChange={(e) => setCfg(prev => ({ ...prev, unlimitedStrategy: e.target.checked }))}
                    className="h-4 w-4 text-blue-600 border-gray-300 rounded"
                  />
                  <label className="ml-2 block text-sm text-gray-300">Usuários Ilimitados nas ofertas</label>
                </div>
                <p className="text-xs text-gray-400 ml-6">Exibe "Usuários Ilimitados" nas ofertas com desconto e fechamento</p>
                <div className="flex items-center mt-2">
                  <input
                    type="checkbox"
                    checked={cfg.modChips || false}
                    onChange={(e) => setCfg(prev => ({ ...prev, modChips: e.target.checked }))}
                    className="h-4 w-4 text-blue-600 border-gray-300 rounded"
                  />
                  <label className="ml-2 block text-sm text-gray-300">Módulos Clicáveis (Chips)</label>
                </div>
                <p className="text-xs text-gray-400 ml-6">Exibe chips de módulos para preencher o input do chat</p>
              </div>

              {/* Modo de Desconto */}
              <div className="bg-gray-700 p-4 rounded-md">
                <h4 className="font-semibold mb-3">Modo de Desconto</h4>
                <div className="space-y-2">
                  <label className="flex items-center">
                    <input
                      type="radio"
                      name="discMode"
                      value="screen"
                      checked={cfg.discMode === 'screen'}
                      onChange={(e) => setCfg(prev => ({ ...prev, discMode: e.target.value }))}
                      className="h-4 w-4 text-blue-600 border-gray-300"
                    />
                    <span className="ml-2 text-sm text-gray-300">Desconto em Tela - Mostra desconto após o preço cheio automaticamente</span>
                  </label>
                  <label className="flex items-center">
                    <input
                      type="radio"
                      name="discMode"
                      value="voucher"
                      checked={cfg.discMode === 'voucher'}
                      onChange={(e) => setCfg(prev => ({ ...prev, discMode: e.target.value }))}
                      className="h-4 w-4 text-blue-600 border-gray-300"
                    />
                    <span className="ml-2 text-sm text-gray-300">Somente via Voucher - Desconto só é aplicado com código de voucher válido</span>
                  </label>
                </div>
                <h5 className="font-semibold mt-4 mb-2">Percentuais de Desconto</h5>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300">% Adesão (tela)</label>
                    <input
                      type="number"
                      value={cfg.discAdPct || 0}
                      onChange={(e) => setCfg(prev => ({ ...prev, discAdPct: parseFloat(e.target.value) }))}
                      className="mt-1 block w-full p-2 bg-gray-900 border border-gray-600 rounded-md text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300">% Mensalidade (tela)</label>
                    <input
                      type="number"
                      value={cfg.discMenPct || 0}
                      onChange={(e) => setCfg(prev => ({ ...prev, discMenPct: parseFloat(e.target.value) }))}
                      className="mt-1 block w-full p-2 bg-gray-900 border border-gray-600 rounded-md text-white"
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-sm font-medium text-gray-300">% Adesão (fechamento)</label>
                    <input
                      type="number"
                      value={cfg.discClosePct || 0}
                      onChange={(e) => setCfg(prev => ({ ...prev, discClosePct: parseFloat(e.target.value) }))}
                      className="mt-1 block w-full p-2 bg-gray-900 border border-gray-600 rounded-md text-white"
                    />
                  </div>
                </div>
              </div>

              {/* Configurações de Assinatura Eletrônica */}
              <div className="bg-gray-700 p-4 rounded-md">
                <h4 className="font-semibold mb-3">Configurações de Assinatura Eletrônica</h4>
                <div>
                  <label className="block text-sm font-medium text-gray-300">E-mail remetente (para envio)</label>
                  <input
                    type="email"
                    value={cfg.emailConfig?.smtpUser || ''}
                    onChange={(e) => setCfg(prev => ({ ...prev, emailConfig: { ...prev.emailConfig, smtpUser: e.target.value } }))}
                    className="mt-1 block w-full p-2 bg-gray-900 border border-gray-600 rounded-md text-white"
                  />
                </div>
                <div className="mt-4">
                  <label className="block text-sm font-medium text-gray-300">URL base do sistema (para links de assinatura)</label>
                  <input
                    type="text"
                    value={cfg.baseUrl || ''}
                    onChange={(e) => setCfg(prev => ({ ...prev, baseUrl: e.target.value }))}
                    placeholder="Ex: https://seusistema.com"
                    className="mt-1 block w-full p-2 bg-gray-900 border border-gray-600 rounded-md text-white"
                  />
                  <p className="text-xs text-gray-400 mt-1">Se não configurado, será gerado um link local com os dados do documento</p>
                </div>
                {/* Adicione mais campos de configuração de SMTP se necessário */}
              </div>

              {/* Botão Salvar */}
              <div className="flex justify-end mt-6">
                <button onClick={() => handleSaveCfg(cfg)} className="px-6 py-2 bg-green-600 rounded-lg hover:bg-green-700 transition-colors">✅ Salvar</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Cliente Modal (Novo/Editar) */}
      {(showClientModal || showEditClientModal) && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 p-8 rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto relative">
            <h3 className="text-2xl font-bold mb-6 text-center">{selectedClient ? '✏️ Editar Cliente' : '+ Novo Cliente'}</h3>
            <button onClick={() => { setShowClientModal(false); setShowEditClientModal(false); setSelectedClient(null); setNewClientData({ cpf_cnpj: '', nome_fantasia: '', razao_social: '', contato_nome: '', email: '', telefone: '', cep: '', endereco: '', bairro: '', cidade: '', estado: '', resp_impl_nome: '', resp_impl_email: '', resp_impl_telefone: '', resp_fin_nome: '', resp_fin_email: '', resp_fin_telefone: '', cpf_contato_principal: '', regime_tributario: '' }) }} className="absolute top-4 right-4 text-gray-400 hover:text-white text-2xl">✕</button>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-300">CPF / CNPJ</label>
                <input type="text" name="cpf_cnpj" value={newClientData.cpf_cnpj} onChange={handleClientChange} className="mt-1 block w-full p-2 bg-gray-900 border border-gray-600 rounded-md text-white" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300">Nome Fantasia / Nome</label>
                <input type="text" name="nome_fantasia" value={newClientData.nome_fantasia} onChange={handleClientChange} className="mt-1 block w-full p-2 bg-gray-900 border border-gray-600 rounded-md text-white" />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-300">Razão Social</label>
                <input type="text" name="razao_social" value={newClientData.razao_social} onChange={handleClientChange} className="mt-1 block w-full p-2 bg-gray-900 border border-gray-600 rounded-md text-white" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300">Nome do Contato</label>
                <input type="text" name="contato_nome" value={newClientData.contato_nome} onChange={handleClientChange} className="mt-1 block w-full p-2 bg-gray-900 border border-gray-600 rounded-md text-white" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300">E-mail</label>
                <input type="email" name="email" value={newClientData.email} onChange={handleClientChange} className="mt-1 block w-full p-2 bg-gray-900 border border-gray-600 rounded-md text-white" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300">Telefone / WhatsApp</label>
                <input type="text" name="telefone" value={newClientData.telefone} onChange={handleClientChange} className="mt-1 block w-full p-2 bg-gray-900 border border-gray-600 rounded-md text-white" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300">CEP</label>
                <input type="text" name="cep" value={newClientData.cep} onChange={handleClientChange} className="mt-1 block w-full p-2 bg-gray-900 border border-gray-600 rounded-md text-white" />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-300">Endereço</label>
                <input type="text" name="endereco" value={newClientData.endereco} onChange={handleClientChange} className="mt-1 block w-full p-2 bg-gray-900 border border-gray-600 rounded-md text-white" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300">Bairro</label>
                <input type="text" name="bairro" value={newClientData.bairro} onChange={handleClientChange} className="mt-1 block w-full p-2 bg-gray-900 border border-gray-600 rounded-md text-white" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300">Cidade</label>
                <input type="text" name="cidade" value={newClientData.cidade} onChange={handleClientChange} className="mt-1 block w-full p-2 bg-gray-900 border border-gray-600 rounded-md text-white" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300">Estado</label>
                <input type="text" name="estado" value={newClientData.estado} onChange={handleClientChange} className="mt-1 block w-full p-2 bg-gray-900 border border-gray-600 rounded-md text-white" />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-300">Regime Tributário</label>
                <select name="regime_tributario" value={newClientData.regime_tributario} onChange={handleClientChange} className="mt-1 block w-full p-2 bg-gray-900 border border-gray-600 rounded-md text-white">
                  <option value="">Selecione...</option>
                  <option value="Simples Nacional">Simples Nacional</option>
                  <option value="Lucro Presumido">Lucro Presumido</option>
                  <option value="Lucro Real">Lucro Real</option>
                  <option value="MEI">MEI</option>
                </select>
              </div>
            </div>

            <h4 className="font-semibold mt-6 mb-3">👷 Responsável pela Implantação</h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-300">Nome</label>
                <input type="text" name="resp_impl_nome" value={newClientData.resp_impl_nome} onChange={handleClientChange} className="mt-1 block w-full p-2 bg-gray-900 border border-gray-600 rounded-md text-white" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300">E-mail</label>
                <input type="email" name="resp_impl_email" value={newClientData.resp_impl_email} onChange={handleClientChange} className="mt-1 block w-full p-2 bg-gray-900 border border-gray-600 rounded-md text-white" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300">Telefone</label>
                <input type="text" name="resp_impl_telefone" value={newClientData.resp_impl_telefone} onChange={handleClientChange} className="mt-1 block w-full p-2 bg-gray-900 border border-gray-600 rounded-md text-white" />
              </div>
            </div>

            <h4 className="font-semibold mt-6 mb-3">💰 Responsável Financeiro</h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-300">Nome</label>
                <input type="text" name="resp_fin_nome" value={newClientData.resp_fin_nome} onChange={handleClientChange} className="mt-1 block w-full p-2 bg-gray-900 border border-gray-600 rounded-md text-white" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300">E-mail</label>
                <input type="email" name="resp_fin_email" value={newClientData.resp_fin_email} onChange={handleClientChange} className="mt-1 block w-full p-2 bg-gray-900 border border-gray-600 rounded-md text-white" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300">Telefone</label>
                <input type="text" name="resp_fin_telefone" value={newClientData.resp_fin_telefone} onChange={handleClientChange} className="mt-1 block w-full p-2 bg-gray-900 border border-gray-600 rounded-md text-white" />
              </div>
            </div>

            <div className="flex justify-end space-x-4 mt-6">
              <button onClick={() => { setShowClientModal(false); setShowEditClientModal(false); setSelectedClient(null); setNewClientData({ cpf_cnpj: '', nome_fantasia: '', razao_social: '', contato_nome: '', email: '', telefone: '', cep: '', endereco: '', bairro: '', cidade: '', estado: '', resp_impl_nome: '', resp_impl_email: '', resp_impl_telefone: '', resp_fin_nome: '', resp_fin_email: '', resp_fin_telefone: '', cpf_contato_principal: '', regime_tributario: '' }) }} className="px-6 py-2 bg-gray-600 rounded-lg hover:bg-gray-700 transition-colors">Cancelar</button>
              <button onClick={handleSaveClient} className="px-6 py-2 bg-green-600 rounded-lg hover:bg-green-700 transition-colors">✅ Salvar Cliente</button>
            </div>
          </div>
        </div>
      )}

      {/* Payment Modal (Configurar Contrato) */}
      {showPaymentModal && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 p-8 rounded-lg shadow-xl w-full max-w-md relative">
            <h3 className="text-2xl font-bold mb-6 text-center">📝 Configurar Contrato</h3>
            <button onClick={() => setShowPaymentModal(false)} className="absolute top-4 right-4 text-gray-400 hover:text-white text-2xl">✕</button>

            <p className="mb-4">Preencha os dados de pagamento antes de gerar o contrato.</p>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-300 mb-2">💳 Condição de Pagamento da Adesão</label>
              <select value={paymentCondition} onChange={handlePaymentConditionChange} className="mt-1 block w-full p-2 bg-gray-900 border border-gray-600 rounded-md text-white">
                <option value="vista">Pagamento à vista</option>
                <option value="pix_boleto">PIX ou Boleto à vista</option>
                <option value="cartao_credito">Cartão de Crédito — sem juros</option>
                <option value="boleto_parcelado">Boleto parcelado — sem juros</option>
              </select>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-300 mb-2">📅 Datas de Vencimento</label>
              <label className="block text-sm font-medium text-gray-400">Vencimento da Adesão *</label>
              <select value={adesaoDueDate} onChange={handleAdesaoDueDateChange} className="mt-1 block w-full p-2 bg-gray-900 border border-gray-600 rounded-md text-white">
                <option value="">Selecione...</option>
                {['5', '10', '15', '20', '25'].map(day => (
                  <option key={day} value={day}>Dia {day} do próximo mês</option>
                ))}
                <option value="other">Outra data</option>
              </select>
              {adesaoDueDate === 'other' && (
                <input
                  type="date"
                  value={otherAdesaoDueDate}
                  onChange={handleOtherAdesaoDueDateChange}
                  className="mt-2 block w-full p-2 bg-gray-900 border border-gray-600 rounded-md text-white"
                />
              )}
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-400">Vencimento da Mensalidade *</label>
              <select value={mensalidadeDueDate} onChange={handleMensalidadeDueDateChange} className="mt-1 block w-full p-2 bg-gray-900 border border-gray-600 rounded-md text-white">
                <option value="5">Dia 5</option>
                <option value="10">Dia 10</option>
                <option value="15">Dia 15</option>
                <option value="20">Dia 20</option>
                <option value="25">Dia 25</option>
                <option value="other">Outra data</option>
              </select>
              {mensalidadeDueDate === 'other' && (
                <input
                  type="text" // Pode ser um date picker ou texto livre
                  value={otherMensalidadeDueDate}
                  onChange={handleOtherMensalidadeDueDateChange}
                  placeholder="Ex: Último dia útil"
                  className="mt-2 block w-full p-2 bg-gray-900 border border-gray-600 rounded-md text-white"
                />
              )}
            </div>

            <div className="flex justify-between mt-6">
              <button onClick={() => setShowPaymentModal(false)} className="px-4 py-2 bg-gray-600 rounded-lg hover:bg-gray-700 transition-colors">← Voltar</button>
              <button onClick={() => {
                // O documento atual para configuração está no último item das mensagens do assistente
                const lastDocMessage = messages.slice().reverse().find(m => m.role === 'system' && m.content.startsWith('{'));
                if (lastDocMessage) {
                  const doc = JSON.parse(lastDocMessage.content);
                  handleGenerateContract(doc);
                } else {
                  alert('Erro: Documento não encontrado para configuração.');
                }
              }} className="px-4 py-2 bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors">Próximo →</button>
            </div>
          </div>
        </div>
      )}

      {/* CRM Data Modal */}
      {showCRMModal && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 p-8 rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto relative">
            <h3 className="text-2xl font-bold mb-6 text-center">📋 Dados para o CRM</h3>
            <button onClick={() => setShowCRMModal(false)} className="absolute top-4 right-4 text-gray-400 hover:text-white text-2xl">✕</button>
            <textarea
              readOnly
              value={crmData}
              className="w-full h-96 p-4 bg-gray-900 border border-gray-600 rounded-md text-white font-mono text-sm"
            ></textarea>
            <div className="flex justify-end space-x-4 mt-6">
              <button onClick={handleCopyCRMData} className="px-6 py-2 bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors">📋 Copiar tudo</button>
              <button onClick={() => setShowCRMModal(false)} className="px-6 py-2 bg-gray-600 rounded-lg hover:bg-gray-700 transition-colors">Fechar</button>
            </div>
          </div>
        </div>
      )}

      {/* Edit User Modal */}
      {showEditUserModal && editingUser && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 p-8 rounded-lg shadow-xl w-full max-w-xl max-h-[90vh] overflow-y-auto relative">
            <h3 className="text-2xl font-bold mb-6 text-center">✏️ Editar Usuário</h3>
            <button onClick={() => setShowEditUserModal(false)} className="absolute top-4 right-4 text-gray-400 hover:text-white text-2xl">✕</button>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-300">Nome Completo</label>
                <input type="text" value={editingUser.nome} onChange={(e) => setEditingUser(prev => ({ ...prev, nome: e.target.value }))} className="mt-1 block w-full p-2 bg-gray-900 border border-gray-600 rounded-md text-white" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300">Usuário (login)</label>
                <input type="text" value={editingUser.email} disabled className="mt-1 block w-full p-2 bg-gray-900 border border-gray-600 rounded-md text-gray-400 cursor-not-allowed" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300">E-mail</label>
                <input type="email" value={editingUser.email} onChange={(e) => setEditingUser(prev => ({ ...prev, email: e.target.value }))} className="mt-1 block w-full p-2 bg-gray-900 border border-gray-600 rounded-md text-white" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300">Telefone</label>
                <input type="text" value={editingUser.telefone} onChange={(e) => setEditingUser(prev => ({ ...prev, telefone: e.target.value }))} className="mt-1 block w-full p-2 bg-gray-900 border border-gray-600 rounded-md text-white" />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-300">Nova Senha (vazio = manter)</label>
                <input type="password" placeholder="********" className="mt-1 block w-full p-2 bg-gray-900 border border-gray-600 rounded-md text-white" />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-300">Perfil</label>
                <select value={editingUser.perfil} onChange={(e) => setEditingUser(prev => ({ ...prev, perfil: e.target.value }))} className="mt-1 block w-full p-2 bg-gray-900 border border-gray-600 rounded-md text-white">
                  <option value="padrao">Padrão</option>
                  <option value="admin">Administrador</option>
                </select>
              </div>
            </div>

            <h4 className="font-semibold mt-6 mb-3">✍️ Assinatura do Consultor (aparece nos contratos)</h4>
            <div className="flex items-center space-x-4">
              {editUserSignature && <img src={editUserSignature} alt="Assinatura" className="h-20 border border-gray-600 rounded-md" />}
              <button onClick={() => setShowDrawSignatureModal(true)} className="px-4 py-2 bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors">✍️ Desenhar</button>
              {editUserSignature && <button onClick={clearSignature} className="px-4 py-2 bg-red-600 rounded-lg hover:bg-red-700 transition-colors">🗑 Limpar</button>}
            </div>

            <div className="flex justify-end space-x-4 mt-6">
              <button onClick={() => setShowEditUserModal(false)} className="px-6 py-2 bg-gray-600 rounded-lg hover:bg-gray-700 transition-colors">Cancelar</button>
              <button onClick={handleSaveUser} className="px-6 py-2 bg-green-600 rounded-lg hover:bg-green-700 transition-colors">✅ Salvar</button>
            </div>
          </div>
        </div>
      )}

      {/* Draw Signature Modal */}
      {showDrawSignatureModal && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 p-8 rounded-lg shadow-xl w-full max-w-xl relative">
            <h3 className="text-2xl font-bold mb-6 text-center">✍️ Desenhar Assinatura</h3>
            <button onClick={() => setShowDrawSignatureModal(false)} className="absolute top-4 right-4 text-gray-400 hover:text-white text-2xl">✕</button>
            <canvas
              ref={initSignatureCanvas}
              width="400"
              height="200"
              className="border border-gray-600 bg-white rounded-md cursor-crosshair mx-auto block"
              onMouseDown={startDrawing}
              onMouseUp={stopDrawing}
              onMouseOut={stopDrawing}
              onMouseMove={draw}
              onTouchStart={startDrawing}
              onTouchEnd={stopDrawing}
              onTouchCancel={stopDrawing}
              onTouchMove={draw}
            ></canvas>
            <div className="flex justify-end space-x-4 mt-6">
              <button onClick={clearSignature} className="px-6 py-2 bg-red-600 rounded-lg hover:bg-red-700 transition-colors">🗑 Limpar</button>
              <button onClick={saveSignature} className="px-6 py-2 bg-green-600 rounded-lg hover:bg-green-700 transition-colors">✅ Usar esta assinatura</button>
              <button onClick={() => setShowDrawSignatureModal(false)} className="px-6 py-2 bg-gray-600 rounded-lg hover:bg-gray-700 transition-colors">Cancelar</button>
            </div>
          </div>
        </div>
      )}

      {/* Add Product Modal */}
      {showAddProductModal && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 p-8 rounded-lg shadow-xl w-full max-w-md relative">
            <h3 className="text-2xl font-bold mb-6 text-center">📦 Novo Produto</h3>
            <button onClick={() => setShowAddProductModal(false)} className="absolute top-4 right-4 text-gray-400 hover:text-white text-2xl">✕</button>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300">Nome do Produto</label>
                <input type="text" value={newProductData.name} onChange={(e) => setNewProductData(prev => ({ ...prev, name: e.target.value }))} className="mt-1 block w-full p-2 bg-gray-900 border border-gray-600 rounded-md text-white" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300">ID/Chave Interna</label>
                <input type="text" value={newProductData.internal_key} onChange={(e) => setNewProductData(prev => ({ ...prev, internal_key: e.target.value }))} className="mt-1 block w-full p-2 bg-gray-900 border border-gray-600 rounded-md text-white" />
              </div>
              <div className="flex items-center">
                <input type="checkbox" checked={newProductData.no_adesao} onChange={(e) => setNewProductData(prev => ({ ...prev, no_adesao: e.target.checked }))} className="h-4 w-4 text-blue-600 border-gray-300 rounded" />
                <label className="ml-2 block text-sm text-gray-300">Sem adesão (módulo como CND)</label>
              </div>
              <div className="flex items-center">
                <input type="checkbox" checked={newProductData.basic_pro_top_only} onChange={(e) => setNewProductData(prev => ({ ...prev, basic_pro_top_only: e.target.checked }))} className="h-4 w-4 text-blue-600 border-gray-300 rounded" />
                <label className="ml-2 block text-sm text-gray-300">Apenas planos Basic/Pro/Top (como IF/EP)</label>
              </div>
            </div>

            <div className="flex justify-end space-x-4 mt-6">
              <button onClick={() => setShowAddProductModal(false)} className="px-6 py-2 bg-gray-600 rounded-lg hover:bg-gray-700 transition-colors">Cancelar</button>
              <button onClick={handleAddProduct} className="px-6 py-2 bg-green-600 rounded-lg hover:bg-green-700 transition-colors">✅ Adicionar Produto</button>
            </div>
          </div>
        </div>
      )}

      {/* Add Plan Modal */}
      {showAddPlanModal && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 p-8 rounded-lg shadow-xl w-full max-w-md relative">
            <h3 className="text-2xl font-bold mb-6 text-center">+ Novo Plano</h3>
            <button onClick={() => setShowAddPlanModal(false)} className="absolute top-4 right-4 text-gray-400 hover:text-white text-2xl">✕</button>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300">ID/Chave do Plano</label>
                <input type="text" value={newPlanData.id} onChange={(e) => setNewPlanData(prev => ({ ...prev, id: e.target.value }))} className="mt-1 block w-full p-2 bg-gray-900 border border-gray-600 rounded-md text-white" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300">Nome Exibido</label>
                <input type="text" value={newPlanData.name} onChange={(e) => setNewPlanData(prev => ({ ...prev, name: e.target.value }))} className="mt-1 block w-full p-2 bg-gray-900 border border-gray-600 rounded-md text-white" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300">Máx CNPJs</label>
                <input type="number" value={newPlanData.maxCnpjs} onChange={(e) => setNewPlanData(prev => ({ ...prev, maxCnpjs: parseInt(e.target.value) || 0 }))} className="mt-1 block w-full p-2 bg-gray-900 border border-gray-600 rounded-md text-white" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300">Usuários</label>
                <input type="number" value={newPlanData.users} onChange={(e) => setNewPlanData(prev => ({ ...prev, users: parseInt(e.target.value) || 1 }))} className="mt-1 block w-full p-2 bg-gray-900 border border-gray-600 rounded-md text-white" />
              </div>
              <div className="flex items-center">
                <input type="checkbox" checked={newPlanData.unlimited} onChange={(e) => setNewPlanData(prev => ({ ...prev, unlimited: e.target.checked }))} className="h-4 w-4 text-blue-600 border-gray-300 rounded" />
                <label className="ml-2 block text-sm text-gray-300">Usuários Ilimitados?</label>
              </div>
            </div>

            <div className="flex justify-end space-x-4 mt-6">
              <button onClick={() => setShowAddPlanModal(false)} className="px-6 py-2 bg-gray-600 rounded-lg hover:bg-gray-700 transition-colors">Cancelar</button>
              <button onClick={handleAddPlan} className="px-6 py-2 bg-green-600 rounded-lg hover:bg-green-700 transition-colors">✅ Adicionar Plano</button>
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
