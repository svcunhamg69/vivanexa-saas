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
function calcDisc(mods,plan,ifPlan,cnpjs,notas,cfg){
  const res=[];let tAd=0,tMen=0,tAdD=0,tMenD=0
  const discAd=cfg.discAdPct/100,discMen=cfg.discMenPct/100
  for(const mod of mods){
    if(mod==='IF'){const p=ifPlan||'basic',[aB,mB]=getPrice('IF',p,cfg),ad=aB*2,men=mB*1.2,adD=aB,menD=mB;res.push({name:pn('IF',cfg),ad,men,adD,menD,isPrepaid:true,plan:p,isIF:true});tAd+=ad;tMen+=men;tAdD+=adD;tMenD+=menD;continue}
    if(mod==='Tributos'){const m=calcTrib(notas);res.push({name:pn('Tributos',cfg),ad:0,men:m,adD:0,menD:m,isTributos:true,notas});tMen+=m;tMenD+=m;continue}
    if(mod==='EP'){const ep=plan==='topplus'?'top':plan,[,mB]=getPrice('EP',ep,cfg),men=mB*1.2,menD=mB;res.push({name:pn('EP',cfg),ad:0,men,adD:0,menD,isEP:true,plan:ep});tMen+=men;tMenD+=menD;continue}
    const[aB,mB]=getPrice(mod,plan,cfg);let ad=aB>0?Math.max(aB*2,1000):0,men=mB*1.2
    if(mod==='XML')men=Math.max(men,175);if(mod==='Gestão Fiscal')men=Math.max(men,200)
    const adD=aB>0?aB:0,menD=mB
    res.push({name:mod,ad,men,adD,menD,plan});tAd+=ad;tMen+=men;tAdD+=adD;tMenD+=menD
  }
  res.forEach(r=>{
    if(!r.isTributos&&!r.isEP){r.ad=r.ad*(1-discAd);r.adD=r.adD*(1-discAd)}
    if(!r.isTributos&&!r.isEP&&!r.isIF){r.men=r.men*(1-discMen);r.menD=r.menD*(1-discMen)}
  })
  return{results:res,tAd:tAd*(1-discAd),tMen:tMen*(1-discMen),tAdD:tAdD*(1-discAd),tMenD:tMenD*(1-discMen)}
}
function calcClosing(mods,plan,ifPlan,cnpjs,notas,cfg){
  const res=[];let tAd=0,tMen=0
  const cp=cfg.discClosePct/100
  for(const mod of mods){
    if(mod==='IF'){const p=ifPlan||'basic',[aB,mB]=getPrice('IF',p,cfg),ad=aB*(1-cp);res.push({name:pn('IF',cfg),ad,men:mB,isPrepaid:true,plan:p,isIF:true});tAd+=ad;tMen+=mB;continue}
    if(mod==='Tributos'){const m=calcTrib(notas);res.push({name:pn('Tributos',cfg),ad:0,men:m,isTributos:true});tMen+=m;continue}
    if(mod==='EP'){const ep=plan==='topplus'?'top':plan,[,mB]=getPrice('EP',ep,cfg);res.push({name:pn('EP',cfg),ad:0,men:mB,isEP:true,plan:ep});tMen+=mB;continue}
    const[aB]=getPrice(mod,plan,cfg);const ad=aB>0?Math.max(aB*(1-cp),0):0
    let men=0
    if(mod==='BIA')men=0.85*(cnpjs||0)
    else if(mod==='CND')men=0.40*(cnpjs||0)
    else if(mod==='Gestão Fiscal')men=Math.max(2.00*(cnpjs||0),200)
    else if(mod==='XML')men=Math.max(1.75*(cnpjs||0),175)
    res.push({name:mod,ad,men,plan});tAd+=ad;tMen+=men
  }
  return{results:res,tAd,tMen}
}

// ── Componente principal ─────────────────────────────────────
export default function Chat() {
  const router = useRouter()
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)
  const [cfg, setCfg] = useState(null)
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [isTyping, setIsTyping] = useState(false)
  const [showConfigModal, setShowConfigModal] = useState(false)
  const [showClientModal, setShowClientModal] = useState(false)
  const [showAddPlanModal, setShowAddPlanModal] = useState(false)
  const [showAdminPanel, setShowAdminPanel] = useState(false)
  const [showReportsModal, setShowReportsModal] = useState(false)
  const [adminPassword, setAdminPassword] = useState('')
  const [adminError, setAdminError] = useState('')
  const [currentClient, setCurrentClient] = useState(null)
  const [currentClientIndex, setCurrentClientIndex] = useState(-1)
  const [newClientData, setNewClientData] = useState({
    cpfCnpj: '', nomeFantasia: '', razaoSocial: '', contatoNome: '',
    email: '', telefone: '', cep: '', endereco: '', bairro: '',
    cidade: '', estado: '', implNome: '', implEmail: '', implTelefone: '',
    finanNome: '', finanEmail: '', finanTelefone: '', cpfContato: '',
    regimeTributario: ''
  })
  const [clientSearchTerm, setClientSearchTerm] = useState('')
  const [filteredClients, setFilteredClients] = useState([])
  const [showSignatureModal, setShowSignatureModal] = useState(false)
  const [signatureData, setSignatureData] = useState({
    fullName: '', cpf: '', email: '', agreed: false
  })
  const [signaturePadOpen, setSignaturePadOpen] = useState(false)
  const [drawnSignature, setDrawnSignature] = useState(null)
  const [showEditUserModal, setShowEditUserModal] = useState(false)
  const [currentUserToEdit, setCurrentUserToEdit] = useState(null)
  const [showEditProductModal, setShowEditProductModal] = useState(false)
  const [currentProductToEdit, setCurrentProductToEdit] = useState(null)
  const [showEditDocTemplateModal, setShowEditDocTemplateModal] = useState(false)
  const [currentDocTemplateType, setCurrentDocTemplateType] = useState(null)
  const [docTemplateContent, setDocTemplateContent] = useState('')
  const [showConfigContractModal, setShowConfigContractModal] = useState(false)
  const [contractPayment, setContractPayment] = useState({
    adesaoCondition: 'vista',
    adesaoDueDate: '',
    mensalidadeDueDate: '',
    otherAdesaoDate: '',
    otherMensalidadeDate: ''
  })
  const [showAddProductModal, setShowAddProductModal] = useState(false)
  const [newProductData, setNewProductData] = useState({
    name: '', internalKey: '', noAdesao: false, basicProTopOnly: false, prices: {}
  })
  const [showAddUserModal, setShowAddUserModal] = useState(false)
  const [newUserData, setNewUserData] = useState({
    nome: '', email: '', telefone: '', perfil: 'padrao', senha: '', assinatura: null
  })
  const [showAddKpiModal, setShowAddKpiModal] = useState(false)
  const [newKpiData, setNewKpiData] = useState({ name: '', id: '' })
  const [showAddVoucherModal, setShowAddVoucherModal] = useState(false)
  const [newVoucherData, setNewVoucherData] = useState({
    prefix: '', adPct: 0, menPct: 0, commemorativeDate: ''
  })
  const [showAddPriceModal, setShowAddPriceModal] = useState(false)
  const [currentProductForPrice, setCurrentProductForPrice] = useState(null)
  const [newPriceData, setNewPriceData] = useState({ planId: '', adesao: '', mensalidade: '' })
  const [showAddPlanPriceModal, setShowAddPlanPriceModal] = useState(false)
  const [newPlanData, setNewPlanData] = useState({ id: '', name: '', maxCnpjs: '', users: '', unlimitedUsers: false })

  const messagesEndRef = useRef(null)
  const inputRef = useRef(null)

  // ── Efeitos e Carregamento Inicial ──────────────────────────
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      if (!session) {
        router.push('/')
      } else {
        loadConfig(session.user.id)
      }
    })

    const { data: authListener } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session)
        if (event === 'SIGNED_OUT') {
          router.push('/')
        } else if (event === 'SIGNED_IN' && router.pathname === '/') {
          router.push('/chat')
        }
      }
    )

    return () => {
      authListener.subscription.unsubscribe()
    }
  }, [router])

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages])

  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus()
    }
  }, [isTyping])

  useEffect(() => {
    if (cfg && cfg.clients) {
      const term = clientSearchTerm.toLowerCase()
      setFilteredClients(
        cfg.clients.filter(
          (c) =>
            c.nomeFantasia.toLowerCase().includes(term) ||
            c.razaoSocial.toLowerCase().includes(term) ||
            c.cpfCnpj.includes(clean(term))
        )
      )
    }
  }, [clientSearchTerm, cfg])

  const loadConfig = async (userId) => {
    setLoading(true)
    let { data: perfil, error: perfilError } = await supabase
      .from('perfis')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle()

    if (perfilError || !perfil) {
      const nome = session?.user?.user_metadata?.name || session?.user?.email?.split('@')[0] || 'Usuário'
      const { data: novoPerfil } = await supabase
        .from('perfis')
        .insert({
          user_id: userId,
          nome: nome,
          email: session?.user?.email,
          empresa_id: userId,
          perfil: 'admin'
        })
        .select()
        .single()
      perfil = novoPerfil
    }

    const empresaId = perfil?.empresa_id || userId
    const { data: row } = await supabase
      .from('vx_storage')
      .select('value')
      .eq('key', `cfg:${empresaId}`)
      .single()

    if (row?.value) {
      const loadedCfg = JSON.parse(row.value)
      // Garante que as propriedades essenciais existam
      loadedCfg.docHistory = loadedCfg.docHistory || []
      loadedCfg.clients = loadedCfg.clients || []
      loadedCfg.users = loadedCfg.users || []
      loadedCfg.kpiTemplates = loadedCfg.kpiTemplates || []
      loadedCfg.kpiLog = loadedCfg.kpiLog || []
      loadedCfg.goals = loadedCfg.goals || []
      loadedCfg.vouchers = loadedCfg.vouchers || []
      loadedCfg.plans = loadedCfg.plans || DEFAULT_CFG.plans
      loadedCfg.prices = loadedCfg.prices || DEFAULT_CFG.prices
      loadedCfg.productNames = loadedCfg.productNames || DEFAULT_CFG.productNames
      setCfg(loadedCfg)
    } else {
      // Se não houver config, cria uma nova com padrões
      const initialCfg = {
        ...DEFAULT_CFG,
        company: perfil?.empresa_nome || DEFAULT_CFG.company,
        users: [{
          id: userId,
          nome: perfil?.nome || 'Consultor Padrão',
          email: perfil?.email || session?.user?.email,
          perfil: perfil?.perfil || 'admin',
          assinatura: perfil?.assinatura || null,
          telefone: perfil?.telefone || ''
        }]
      }
      setCfg(initialCfg)
      await saveConfig(initialCfg, empresaId) // Salva a config inicial
    }
    setLoading(false)
  }

  const saveConfig = async (newCfg, empresaId = cfg.empresa_id || session.user.id) => {
    await supabase
      .from('vx_storage')
      .upsert({ key: `cfg:${empresaId}`, value: JSON.stringify(newCfg) }, { onConflict: 'key' })
    setCfg(newCfg)
  }

  // ── Funções de Chat e IA ────────────────────────────────────
  const sendMessage = async (e) => {
    e.preventDefault()
    if (!input.trim()) return

    const userMessage = { role: 'user', content: input }
    setMessages((prev) => [...prev, userMessage])
    setInput('')
    setIsTyping(true)

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [...messages, userMessage],
          cfg: cfg,
          userId: session.user.id,
          empresaId: cfg.empresa_id || session.user.id
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Erro ao comunicar com a IA')
      }

      const data = await response.json()
      setMessages((prev) => [...prev, { role: 'assistant', content: data.response }])
    } catch (error) {
      console.error('Erro ao enviar mensagem:', error)
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: `❌ Erro: ${error.message}. Por favor, tente novamente.` },
      ])
    } finally {
      setIsTyping(false)
    }
  }

  const handleChipClick = (text) => {
    setInput(text)
    // Não envia automaticamente, apenas preenche o input
  }

  // ── Funções de Configuração ─────────────────────────────────
  const handleSaveCompanyConfig = async () => {
    const updatedCfg = { ...cfg, company: cfg.company, slogan: cfg.slogan, logob64: cfg.logob64 }
    await saveConfig(updatedCfg)
    setShowConfigModal(false)
  }

  const handleSaveKpiConfig = async () => {
    const updatedCfg = { ...cfg, kpiTemplates: cfg.kpiTemplates, kpiRequired: cfg.kpiRequired }
    await saveConfig(updatedCfg)
    setShowConfigModal(false)
  }

  const handleSaveUsersConfig = async () => {
    const updatedCfg = { ...cfg, users: cfg.users }
    await saveConfig(updatedCfg)
    setShowConfigModal(false)
  }

  const handleSaveProductsConfig = async () => {
    const updatedCfg = { ...cfg, prices: cfg.prices, productNames: cfg.productNames, plans: cfg.plans }
    await saveConfig(updatedCfg)
    setShowConfigModal(false)
  }

  const handleSaveDiscountConfig = async () => {
    const updatedCfg = { ...cfg, discMode: cfg.discMode, discAdPct: cfg.discAdPct, discMenPct: cfg.discMenPct, discClosePct: cfg.discClosePct, unlimitedStrategy: cfg.unlimitedStrategy }
    await saveConfig(updatedCfg)
    setShowConfigModal(false)
  }

  const handleSaveVouchersConfig = async () => {
    const updatedCfg = { ...cfg, vouchers: cfg.vouchers }
    await saveConfig(updatedCfg)
    setShowConfigModal(false)
  }

  const handleSaveDocTemplatesConfig = async () => {
    const updatedCfg = { ...cfg, proposalTemplate: cfg.proposalTemplate, contractTemplate: cfg.contractTemplate }
    await saveConfig(updatedCfg)
    setShowConfigModal(false)
  }

  const handleSaveSignatureConfig = async () => {
    const updatedCfg = { ...cfg, emailRemetente: cfg.emailRemetente, whatsappEmpresa: cfg.whatsappEmpresa, baseUrl: cfg.baseUrl }
    await saveConfig(updatedCfg)
    setShowConfigModal(false)
  }

  const handleSaveClientsConfig = async () => {
    const updatedCfg = { ...cfg, clients: cfg.clients }
    await saveConfig(updatedCfg)
    setShowConfigModal(false)
  }

  const handleSaveThemeConfig = async () => {
    const updatedCfg = { ...cfg, theme: cfg.theme }
    await saveConfig(updatedCfg)
    setShowConfigModal(false)
  }

  const handleAddKpi = async () => {
    if (!newKpiData.name.trim()) return
    const newId = newKpiData.name.toLowerCase().replace(/\s/g, '-')
    const updatedKpiTemplates = [...(cfg.kpiTemplates || []), { id: newId, name: newKpiData.name }]
    const updatedCfg = { ...cfg, kpiTemplates: updatedKpiTemplates }
    await saveConfig(updatedCfg)
    setNewKpiData({ name: '', id: '' })
    setShowAddKpiModal(false)
  }

  const handleAddVoucher = async () => {
    if (!newVoucherData.prefix.trim()) return
    const newVoucher = {
      id: generateToken(),
      prefix: newVoucherData.prefix,
      adPct: Number(newVoucherData.adPct),
      menPct: Number(newVoucherData.menPct),
      commemorativeDate: newVoucherData.commemorativeDate,
      active: true
    }
    const updatedVouchers = [...(cfg.vouchers || []), newVoucher]
    const updatedCfg = { ...cfg, vouchers: updatedVouchers }
    await saveConfig(updatedCfg)
    setNewVoucherData({ prefix: '', adPct: 0, menPct: 0, commemorativeDate: '' })
    setShowAddVoucherModal(false)
  }

  const handleAddProduct = async () => {
    if (!newProductData.name.trim()) return
    const newInternalKey = newProductData.name.toLowerCase().replace(/\s/g, '-')
    const updatedPrices = { ...cfg.prices }
    updatedPrices[newProductData.name] = {} // Inicializa com objeto vazio para preços

    const updatedProductNames = { ...cfg.productNames, [newProductData.name]: newProductData.name }

    const updatedCfg = {
      ...cfg,
      prices: updatedPrices,
      productNames: updatedProductNames,
      // Adiciona o produto à lista de produtos se você tiver uma
      // Por enquanto, ele é implicitamente adicionado via `prices` e `productNames`
    }
    await saveConfig(updatedCfg)
    setNewProductData({ name: '', internalKey: '', noAdesao: false, basicProTopOnly: false, prices: {} })
    setShowAddProductModal(false)
  }

  const handleAddPriceToProduct = async () => {
    if (!currentProductForPrice || !newPriceData.planId || !newPriceData.adesao || !newPriceData.mensalidade) return

    const updatedPrices = { ...cfg.prices }
    if (!updatedPrices[currentProductForPrice]) {
      updatedPrices[currentProductForPrice] = {}
    }
    updatedPrices[currentProductForPrice][newPriceData.planId] = [
      Number(newPriceData.adesao),
      Number(newPriceData.mensalidade)
    ]

    const updatedCfg = { ...cfg, prices: updatedPrices }
    await saveConfig(updatedCfg)
    setNewPriceData({ planId: '', adesao: '', mensalidade: '' })
    setShowAddPriceModal(false)
  }

  const handleAddPlan = async () => {
    if (!newPlanData.id.trim() || !newPlanData.name.trim() || !newPlanData.maxCnpjs) return

    const newPlan = {
      id: newPlanData.id,
      name: newPlanData.name,
      maxCnpjs: Number(newPlanData.maxCnpjs),
      users: newPlanData.unlimitedUsers ? 999 : Number(newPlanData.users),
      unlimitedUsers: newPlanData.unlimitedUsers
    }

    const updatedPlans = [...(cfg.plans || []), newPlan]
    const updatedCfg = { ...cfg, plans: updatedPlans }
    await saveConfig(updatedCfg)
    setNewPlanData({ id: '', name: '', maxCnpjs: '', users: '', unlimitedUsers: false })
    setShowAddPlanModal(false)
  }

  const handleAddUser = async () => {
    if (!newUserData.nome.trim() || !newUserData.email.trim() || !newUserData.senha.trim()) return

    const newUser = {
      id: generateToken(), // ID temporário para usuários locais
      nome: newUserData.nome,
      email: newUserData.email,
      telefone: newUserData.telefone,
      perfil: newUserData.perfil,
      assinatura: newUserData.assinatura,
      // Senha não é armazenada diretamente no cfg, apenas para fins de cadastro inicial
    }

    const updatedUsers = [...(cfg.users || []), newUser]
    const updatedCfg = { ...cfg, users: updatedUsers }
    await saveConfig(updatedCfg)
    setNewUserData({ nome: '', email: '', telefone: '', perfil: 'padrao', senha: '', assinatura: null })
    setShowAddUserModal(false)
  }

  const handleEditUser = async () => {
    if (!currentUserToEdit) return

    const updatedUsers = cfg.users.map(u =>
      u.id === currentUserToEdit.id ? currentUserToEdit : u
    )
    const updatedCfg = { ...cfg, users: updatedUsers }
    await saveConfig(updatedCfg)
    setShowEditUserModal(false)
    setCurrentUserToEdit(null)
  }

  const handleEditProduct = async () => {
    if (!currentProductToEdit) return

    const updatedProductNames = { ...cfg.productNames, [currentProductToEdit.originalName]: currentProductToEdit.name }
    if (currentProductToEdit.originalName !== currentProductToEdit.name) {
      // Se o nome mudou, remove o antigo e adiciona o novo no prices
      const newPrices = { ...cfg.prices }
      newPrices[currentProductToEdit.name] = newPrices[currentProductToEdit.originalName]
      delete newPrices[currentProductToEdit.originalName]
      const updatedCfg = { ...cfg, productNames: updatedProductNames, prices: newPrices }
      await saveConfig(updatedCfg)
    } else {
      const updatedCfg = { ...cfg, productNames: updatedProductNames }
      await saveConfig(updatedCfg)
    }
    setShowEditProductModal(false)
    setCurrentProductToEdit(null)
  }

  const handleSaveDocTemplate = async () => {
    const updatedCfg = { ...cfg }
    if (currentDocTemplateType === 'proposal') {
      updatedCfg.proposalTemplate = docTemplateContent
    } else if (currentDocTemplateType === 'contract') {
      updatedCfg.contractTemplate = docTemplateContent
    }
    await saveConfig(updatedCfg)
    setShowEditDocTemplateModal(false)
    setDocTemplateContent('')
    setCurrentDocTemplateType(null)
  }

  const handleUseDefaultDocTemplate = async () => {
    const updatedCfg = { ...cfg }
    if (currentDocTemplateType === 'proposal') {
      delete updatedCfg.proposalTemplate
    } else if (currentDocTemplateType === 'contract') {
      delete updatedCfg.contractTemplate
    }
    await saveConfig(updatedCfg)
    setShowEditDocTemplateModal(false)
    setDocTemplateContent('')
    setCurrentDocTemplateType(null)
  }

  const handleAdminLogin = async () => {
    if (adminPassword === process.env.NEXT_PUBLIC_ADMIN_PASSWORD) {
      setAdminError('')
      // A senha está correta, agora o painel de admin é exibido
      // Não precisamos setar adminPassword para null aqui, pois ele é usado para controlar a exibição
    } else {
      setAdminError('Senha incorreta!')
    }
  }

  // ── Funções de Cliente ──────────────────────────────────────
  const handleSaveClient = async () => {
    if (!newClientData.cpfCnpj.trim() || !newClientData.nomeFantasia.trim()) {
      alert('CPF/CNPJ e Nome Fantasia são obrigatórios.')
      return
    }

    const cleanedCpfCnpj = clean(newClientData.cpfCnpj)

    // Validação de duplicidade
    const isDuplicate = cfg.clients.some(
      (c, idx) =>
        idx !== currentClientIndex && clean(c.cpfCnpj) === cleanedCpfCnpj
    )
    if (isDuplicate) {
      alert('Já existe um cliente com este CPF/CNPJ.')
      return
    }

    const clientToSave = {
      ...newClientData,
      cpfCnpj: cleanedCpfCnpj,
      id: currentClient ? currentClient.id : generateToken(), // Mantém ID se editando, gera novo se adicionando
      criado: currentClient ? currentClient.criado : new Date().toISOString(),
      atualizado: new Date().toISOString(),
    }

    let updatedClients
    if (currentClient) {
      // Editando cliente existente
      updatedClients = cfg.clients.map((c, idx) =>
        idx === currentClientIndex ? clientToSave : c
      )
    } else {
      // Adicionando novo cliente
      updatedClients = [...(cfg.clients || []), clientToSave]
    }

    const updatedCfg = { ...cfg, clients: updatedClients }
    await saveConfig(updatedCfg)
    setShowClientModal(false)
    setCurrentClient(null)
    setCurrentClientIndex(-1)
    setNewClientData({
      cpfCnpj: '', nomeFantasia: '', razaoSocial: '', contatoNome: '',
      email: '', telefone: '', cep: '', endereco: '', bairro: '',
      cidade: '', estado: '', implNome: '', implEmail: '', implTelefone: '',
      finanNome: '', finanEmail: '', finanTelefone: '', cpfContato: '',
      regimeTributario: ''
    })
  }

  const handleEditClient = (client, index) => {
    setCurrentClient(client)
    setCurrentClientIndex(index)
    setNewClientData(client)
    setShowClientModal(true)
  }

  const handleNewClient = () => {
    setCurrentClient(null)
    setCurrentClientIndex(-1)
    setNewClientData({
      cpfCnpj: '', nomeFantasia: '', razaoSocial: '', contatoNome: '',
      email: '', telefone: '', cep: '', endereco: '', bairro: '',
      cidade: '', estado: '', implNome: '', implEmail: '', implTelefone: '',
      finanNome: '', finanEmail: '', finanTelefone: '', cpfContato: '',
      regimeTributario: ''
    })
    setShowClientModal(true)
  }

  // ── Funções de Documentos (Proposta/Contrato) ────────────────
  const buildContract = (quote, client, consultor, signToken, signManifest = {}) => {
    const today = new Date().toLocaleDateString('pt-BR')
    const companyLogo = cfg.logob64 ? `<img src="${cfg.logob64}" alt="${cfg.company}" style="max-height: 60px; margin-bottom: 20px;" />` : ''
    const companyName = cfg.company || 'VIVANEXA'
    const companySlogan = cfg.slogan || 'Assistente Comercial de Preços'
    const contractTemplate = cfg.contractTemplate || `
      <p>Prezado(a) ${client.contatoNome || client.nomeFantasia},</p>
      <p>A ${companyName}, com sede em [ENDEREÇO DA EMPRESA], inscrita no CNPJ sob o nº [CNPJ DA EMPRESA], doravante denominada "CONTRATADA", e ${client.razaoSocial || client.nomeFantasia}, inscrita no CPF/CNPJ sob o nº ${fmtDoc(client.cpfCnpj)}, com sede em ${client.endereco}, ${client.bairro}, ${client.cidade} - ${client.estado}, CEP ${client.cep}, doravante denominada "CONTRATANTE", têm entre si, justo e contratado o presente instrumento, mediante as cláusulas e condições seguintes:</p>
      <p><strong>CLÁUSULA PRIMEIRA – DO OBJETO</strong></p>
      <p>O presente contrato tem por objeto a prestação de serviços de software e consultoria, conforme os módulos e planos detalhados abaixo:</p>
      <!-- TABELA DE PRODUTOS -->
      <p><strong>CLÁUSULA SEGUNDA – DOS VALORES E FORMA DE PAGAMENTO</strong></p>
      <p>Pela prestação dos serviços, a CONTRATANTE pagará à CONTRATADA os valores de Adesão e Mensalidade, conforme detalhado na tabela acima.</p>
      <p><strong>Adesão:</strong> ${fmt(quote.tAd)}</p>
      <p><strong>Mensalidade:</strong> ${fmt(quote.tMen)}</p>
      <p><strong>Condição de Pagamento da Adesão:</strong> ${contractPayment.adesaoCondition === 'vista' ? 'À vista' : contractPayment.adesaoCondition === 'cartao' ? 'Cartão de Crédito' : 'Boleto Parcelado'}</p>
      ${contractPayment.adesaoDueDate ? `<p><strong>Vencimento da Adesão:</strong> ${contractPayment.adesaoDueDate}</p>` : ''}
      ${contractPayment.mensalidadeDueDate ? `<p><strong>Vencimento da Mensalidade:</strong> ${contractPayment.mensalidadeDueDate}</p>` : ''}
      <p><strong>CLÁUSULA TERCEIRA – DA VIGÊNCIA</strong></p>
      <p>O presente contrato terá vigência de 12 (doze) meses, renováveis automaticamente por iguais períodos, salvo manifestação em contrário de qualquer das partes, com antecedência mínima de 30 (trinta) dias do término do período.</p>
      <p><strong>CLÁUSULA QUARTA – DO FORO</strong></p>
      <p>Fica eleito o foro da comarca de [CIDADE/ESTADO DA EMPRESA] para dirimir quaisquer dúvidas ou litígios decorrentes do presente contrato, com renúncia expressa a qualquer outro, por mais privilegiado que seja.</p>
      <p>E, por estarem assim justos e contratados, as partes assinam o presente instrumento em 2 (duas) vias de igual teor e forma, na presença das duas testemunhas abaixo.</p>
      <p>Data: ${today}</p>
      <!-- ASSINATURAS -->
      <!-- MANIFESTO DE ASSINATURA -->
    `

    const productsTable = `
      <table style="width:100%; border-collapse: collapse; margin-top: 20px; margin-bottom: 20px;">
        <thead>
          <tr style="background-color: #f2f2f2;">
            <th style="border: 1px solid #ddd; padding: 8px; text-align: left;">Módulo</th>
            <th style="border: 1px solid #ddd; padding: 8px; text-align: right;">Adesão</th>
            <th style="border: 1px solid #ddd; padding: 8px; text-align: right;">Mensalidade</th>
            <th style="border: 1px solid #ddd; padding: 8px; text-align: left;">Plano</th>
          </tr>
        </thead>
        <tbody>
          ${quote.results.map(p => `
            <tr>
              <td style="border: 1px solid #ddd; padding: 8px;">${p.name}</td>
              <td style="border: 1px solid #ddd; padding: 8px; text-align: right;">${fmt(p.ad)}</td>
              <td style="border: 1px solid #ddd; padding: 8px; text-align: right;">${fmt(p.men)}</td>
              <td style="border: 1px solid #ddd; padding: 8px;">${getPlanLabel(p.plan, cfg.plans)}</td>
            </tr>
          `).join('')}
          <tr style="background-color: #f2f2f2; font-weight: bold;">
            <td style="border: 1px solid #ddd; padding: 8px;">Total</td>
            <td style="border: 1px solid #ddd; padding: 8px; text-align: right;">${fmt(quote.tAd)}</td>
            <td style="border: 1px solid #ddd; padding: 8px; text-align: right;">${fmt(quote.tMen)}</td>
            <td style="border: 1px solid #ddd; padding: 8px;"></td>
          </tr>
        </tbody>
      </table>
    `

    let signaturesHtml = `
      <div style="margin-top: 50px; display: flex; justify-content: space-around; flex-wrap: wrap;">
        <div style="text-align: center; margin: 20px;">
          ${consultor?.assinatura ? `<img src="${consultor.assinatura}" alt="Assinatura do Consultor" style="max-width: 200px; height: auto; border-bottom: 1px solid #000; padding-bottom: 5px;" />` : '<div style="width: 200px; height: 1px; background-color: #000; margin: 0 auto 5px auto;"></div>'}
          <p style="margin-top: 5px; font-size: 14px;">${consultor?.nome || 'Consultor'}</p>
          <p style="font-size: 12px;">${consultor?.email || ''}</p>
          <p style="font-size: 12px;">${companyName}</p>
        </div>
        <div style="text-align: center; margin: 20px;">
          ${signManifest.clientSignature ? `<img src="${signManifest.clientSignature}" alt="Assinatura do Cliente" style="max-width: 200px; height: auto; border-bottom: 1px solid #000; padding-bottom: 5px;" />` : '<div style="width: 200px; height: 1px; background-color: #000; margin: 0 auto 5px auto;"></div>'}
          <p style="margin-top: 5px; font-size: 14px;">${signManifest.clientFullName || client.contatoNome || client.nomeFantasia}</p>
          <p style="font-size: 12px;">${signManifest.clientCpf ? fmtDoc(signManifest.clientCpf) : fmtDoc(client.cpfContato || client.cpfCnpj)}</p>
          <p style="font-size: 12px;">${signManifest.clientEmail || client.email}</p>
          <p style="font-size: 12px;">${client.razaoSocial || client.nomeFantasia}</p>
        </div>
      </div>
      <div style="margin-top: 30px; text-align: center; font-size: 12px; color: #555;">
        <p>Testemunha 1: _________________________</p>
        <p>Testemunha 2: _________________________</p>
      </div>
    `

    let manifestoHtml = ''
    if (signManifest.consultorSignedAt || signManifest.clientSignedAt) {
      manifestoHtml = `
        <div style="margin-top: 50px; border-top: 1px solid #eee; padding-top: 20px; font-size: 10px; color: #777;">
          <p><strong>Manifesto de Assinatura Eletrônica</strong></p>
          <p>Este documento foi assinado eletronicamente conforme Lei nº 14.063/2020.</p>
          ${signManifest.consultorSignedAt ? `
            <p><strong>Consultor:</strong> ${signManifest.consultorFullName} (CPF: ${fmtDoc(signManifest.consultorCpf)}, E-mail: ${signManifest.consultorEmail})</p>
            <p>Assinado em: ${new Date(signManifest.consultorSignedAt).toLocaleString('pt-BR')} (IP: ${signManifest.consultorIp})</p>
          ` : ''}
          ${signManifest.clientSignedAt ? `
            <p><strong>Cliente:</strong> ${signManifest.clientFullName} (CPF: ${fmtDoc(signManifest.clientCpf)}, E-mail: ${signManifest.clientEmail})</p>
            <p>Assinado em: ${new Date(signManifest.clientSignedAt).toLocaleString('pt-BR')} (IP: ${signManifest.clientIp})</p>
          ` : ''}
          <p>Token de Verificação: <strong>${signToken}</strong></p>
        </div>
      `
    }

    let finalHtml = contractTemplate
      .replace('<!-- TABELA DE PRODUTOS -->', productsTable)
      .replace('<!-- ASSINATURAS -->', signaturesHtml)
      .replace('<!-- MANIFESTO DE ASSINATURA -->', manifestoHtml)

    // Substituições adicionais para placeholders comuns
    finalHtml = finalHtml.replace(/|
$
ENDEREÇO DA EMPRESA
$
|/g, cfg.companyAddress || 'Não configurado')
    finalHtml = finalHtml.replace(/|
$
CNPJ DA EMPRESA
$
|/g, cfg.companyCnpj || 'Não configurado')
    finalHtml.replace(/|
$
CIDADE\/ESTADO DA EMPRESA
$
|/g, cfg.companyCityState || 'Não configurado')

    return `
      <!DOCTYPE html>
      <html lang="pt-BR">
      <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Contrato de Prestação de Serviços - ${client.nomeFantasia}</title>
          <style>
              body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 40px; }
              .header { text-align: center; margin-bottom: 30px; }
              .header img { max-width: 150px; }
              h1, h2, h3 { color: #0056b3; }
              table { width: 100%; border-collapse: collapse; margin-top: 20px; margin-bottom: 20px; }
              th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
              th { background-color: #f2f2f2; }
              .signature-block { margin-top: 50px; display: flex; justify-content: space-around; flex-wrap: wrap; }
              .signature-item { text-align: center; margin: 20px; }
              .signature-line { width: 200px; height: 1px; background-color: #000; margin: 0 auto 5px auto; }
              .signature-image { max-width: 200px; height: auto; border-bottom: 1px solid #000; padding-bottom: 5px; }
              .manifesto { margin-top: 50px; border-top: 1px solid #eee; padding-top: 20px; font-size: 10px; color: #777; }
          </style>
      </head>
      <body>
          <div class="header">
              ${companyLogo}
              <h1>${companyName}</h1>
              <p>${companySlogan}</p>
          </div>
          ${finalHtml}
      </body>
      </html>
    `
  }

  const generatePdfAndSendEmail = async (docId, contractHtml, clientEmail, clientName, consultorEmail, consultorName, config) => {
    try {
      // 1. Gerar PDF
      const pdfResponse = await fetch('/api/generate-pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ htmlContent: contractHtml }),
      });

      if (!pdfResponse.ok) {
        const errorData = await pdfResponse.json();
        throw new Error(errorData.error || 'Falha ao gerar PDF.');
      }

      const pdfBlob = await pdfResponse.blob();
      const reader = new FileReader();
      reader.readAsDataURL(pdfBlob);
      reader.onloadend = async () => {
        const base64Pdf = reader.result.split(',')[1]; // Extrai o base64

        // 2. Enviar E-mail com anexo
        const emailSubject = `Contrato Assinado - ${clientName} - ${config.company}`;
        const emailBody = `
          <p>Prezado(a) ${clientName},</p>
          <p>Seu contrato com a ${config.company} foi assinado por ambas as partes e está anexado a este e-mail.</p>
          <p>Em caso de dúvidas, entre em contato com seu consultor ${consultorName} (${consultorEmail}).</p>
          <p>Atenciosamente,</p>
          <p>${config.company}</p>
        `;

        const emailResponse = await fetch('/api/send-email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            to: clientEmail,
            subject: emailSubject,
            html: emailBody,
            from: config.emailRemetente || 'noreply@vivanexa.com', // Usar e-mail configurado
            config: {
              smtpHost: config.smtpHost,
              smtpPort: config.smtpPort,
              smtpUser: config.smtpUser,
              smtpPass: config.smtpPass,
            },
            attachments: [{
              filename: `contrato_${clientName.replace(/\s/g, '_')}.pdf`,
              content: base64Pdf,
              encoding: 'base64',
              contentType: 'application/pdf'
            }]
          }),
        });

        if (!emailResponse.ok) {
          const errorData = await emailResponse.json();
          throw new Error(errorData.error || 'Falha ao enviar e-mail.');
        }

        alert('Contrato assinado e e-mail com PDF enviado com sucesso!');
      };
    } catch (error) {
      console.error('Erro no fluxo de PDF/E-mail:', error);
      alert(`Erro ao processar contrato e enviar e-mail: ${error.message}`);
    }
  };


  const handleSignContract = async (docId, clientSignatureData) => {
    if (!cfg || !session) return

    const docIndex = cfg.docHistory.findIndex(d => d.id === docId)
    if (docIndex === -1) {
      alert('Documento não encontrado.')
      return
    }

    const doc = cfg.docHistory[docIndex]
    const consultor = cfg.users.find(u => u.id === session.user.id)

    const updatedDoc = { ...doc }
    const now = new Date().toISOString()
    const userIp = '127.0.0.1' // Em produção, você precisaria obter o IP real do servidor

    // Coleta dados do consultor logado para o manifesto
    const consultorManifest = {
      consultorFullName: consultor?.nome || 'Consultor',
      consultorCpf: consultor?.cpf || 'Não informado', // Adicione CPF ao perfil do consultor se tiver
      consultorEmail: consultor?.email || session.user.email,
      consultorSignedAt: now,
      consultorIp: userIp,
      consultorSignature: consultor?.assinatura || null,
    }

    // Coleta dados do cliente para o manifesto
    const clientManifest = {
      clientFullName: clientSignatureData.fullName,
      clientCpf: clientSignatureData.cpf,
      clientEmail: clientSignatureData.email,
      clientSignedAt: now,
      clientIp: userIp,
      clientSignature: clientSignatureData.signatureImage, // A imagem da assinatura desenhada
    }

    // Atualiza o documento com as assinaturas e manifesto
    updatedDoc.status = 'signed'
    updatedDoc.signedAt = now
    updatedDoc.signManifest = { ...consultorManifest, ...clientManifest } // Combina os manifestos

    // Reconstroi o HTML do contrato com as assinaturas
    const signedContractHtml = buildContract(
      doc.quote,
      doc.client,
      consultor,
      doc.signToken,
      updatedDoc.signManifest // Passa o manifesto completo para buildContract
    )
    updatedDoc.html = signedContractHtml // Atualiza o HTML do documento no histórico

    const updatedDocHistory = [...cfg.docHistory]
    updatedDocHistory[docIndex] = updatedDoc

    const updatedCfg = { ...cfg, docHistory: updatedDocHistory }
    await saveConfig(updatedCfg)

    // Enviar e-mail com o PDF do contrato assinado
    await generatePdfAndSendEmail(
      doc.id,
      signedContractHtml,
      clientSignatureData.email,
      clientSignatureData.fullName,
      consultor?.email || session.user.email,
      consultor?.nome || 'Consultor',
      cfg
    );

    alert('Contrato assinado com sucesso e e-mail enviado!')
    router.push('/chat')
  }

  // ── Renderização ────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-900 text-gray-300">
        Carregando...
      </div>
    )
  }

  if (!session) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-900 text-gray-300">
        Redirecionando para login...
      </div>
    )
  }

  const currentConsultor = cfg.users.find(u => u.id === session.user.id) || { nome: 'Consultor', email: session.user.email, perfil: 'padrao' }
  const isAdmin = currentConsultor.perfil === 'admin'

  return (
    <div className="flex flex-col h-screen bg-gray-900 text-gray-100">
      <Head>
        <title>{cfg.company || 'Vivanexa'} – Assistente Comercial</title>
        <link rel="icon" href="/favicon.ico" />
      </Head>

      {/* Header */}
      <header className="flex items-center justify-between p-4 bg-gray-800 shadow-md">
        <div className="flex items-center space-x-2 cursor-pointer" onClick={() => router.push('/chat')}>
          {cfg.logob64 ? (
            <img src={cfg.logob64} alt={cfg.company} className="h-9" />
          ) : (
            <h1 className="text-2xl font-bold text-blue-400">{cfg.company || 'VIVANEXA'}</h1>
          )}
          <span className="text-sm text-gray-400 hidden sm:block">{cfg.slogan || 'Assistente Comercial de Preços'}</span>
        </div>
        <nav className="flex items-center space-x-4">
          <button onClick={() => router.push('/dashboard')} className="text-gray-300 hover:text-blue-400 transition-colors">📊 Dashboard</button>
          <button onClick={() => setShowReportsModal(true)} className="text-gray-300 hover:text-blue-400 transition-colors">📈 Relatórios</button>
          <button onClick={() => setShowConfigModal(true)} className="text-gray-300 hover:text-blue-400 transition-colors">⚙️ Configurações</button>
          <button onClick={() => supabase.auth.signOut().then(() => router.push('/'))} className="text-gray-300 hover:text-red-400 transition-colors">Sair</button>
        </nav>
      </header>

      {/* Main Chat Area */}
      <main className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
        {messages.map((msg, index) => (
          <div
            key={index}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-xl p-3 rounded-lg shadow-md ${
                msg.role === 'user'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-700 text-gray-100'
              }`}
            >
              {msg.content.split('\n').map((line, i) => (
                <p key={i} className="mb-1 last:mb-0">
                  {line}
                </p>
              ))}
              {msg.role === 'assistant' && msg.content.includes('```json') && (
                <button
                  onClick={() => {
                    const jsonMatch = msg.content.match(/```json\n([\s\S]*?)\n```/)
                    if (jsonMatch && jsonMatch[1]) {
                      try {
                        const quoteData = JSON.parse(jsonMatch[1])
                        const client = cfg.clients.find(c => clean(c.cpfCnpj) === clean(quoteData.clientCpfCnpj))
                        if (!client) {
                          alert('Cliente não encontrado. Por favor, cadastre o cliente antes de gerar o contrato.')
                          return
                        }
                        const contractHtml = buildContract(quoteData, client, currentConsultor, generateToken())
                        const newDoc = {
                          id: generateToken(),
                          type: 'contract',
                          status: 'draft',
                          criado: new Date().toISOString(),
                          userId: session.user.id,
                          client: client,
                          quote: quoteData,
                          html: contractHtml,
                          signToken: generateToken(),
                        }
                        const updatedCfg = { ...cfg, docHistory: [...(cfg.docHistory || []), newDoc] }
                        saveConfig(updatedCfg)
                        alert('Contrato gerado e salvo no histórico de documentos!')
                        router.push(`/sign/${newDoc.signToken}`)
                      } catch (e) {
                        console.error('Erro ao parsear JSON ou gerar contrato:', e)
                        alert('Erro ao gerar contrato. Verifique os dados da proposta.')
                      }
                    }
                  }}
                  className="mt-2 px-4 py-2 bg-green-600 rounded-md hover:bg-green-700 transition-colors text-sm"
                >
                  📄 Gerar Contrato
                </button>
              )}
              {msg.role === 'assistant' && cfg.modChips && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {msg.content.includes('Módulos:') && ALL_MODS.map(mod => (
                    <button
                      key={mod}
                      onClick={() => handleChipClick(mod)}
                      className="px-3 py-1 bg-gray-600 rounded-full text-xs hover:bg-gray-500 transition-colors"
                    >
                      {pn(mod, cfg)}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
        {isTyping && (
          <div className="flex justify-start">
            <div className="max-w-xl p-3 rounded-lg shadow-md bg-gray-700 text-gray-100">
              Digitando...
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </main>

      {/* Input Area */}
      <form onSubmit={sendMessage} className="flex p-4 bg-gray-800 border-t border-gray-700">
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Digite sua mensagem..."
          className="flex-1 p-3 rounded-l-lg bg-gray-700 border border-gray-600 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          disabled={isTyping}
        />
        <button
          type="submit"
          className="px-6 py-3 bg-blue-600 text-white rounded-r-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          disabled={isTyping}
        >
          Enviar
        </button>
      </form>

      {/* Config Modal */}
      {showConfigModal && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 p-8 rounded-lg shadow-xl w-full max-w-3xl max-h-[90vh] overflow-y-auto relative">
            <h2 className="text-3xl font-bold mb-6 text-center text-blue-400">⚙️ Configurações</h2>
            <button onClick={() => setShowConfigModal(false)} className="absolute top-4 right-4 text-gray-400 hover:text-white text-2xl">✕</button>

            {/* Abas de Configuração */}
            <div className="flex flex-wrap gap-2 mb-6">
              {['Empresa', 'Metas', 'KPIs', 'Usuários', 'Produtos', 'Descontos', 'Vouchers', 'Documentos', 'Assinatura', 'Clientes', 'Tema'].map(tab => (
                <button
                  key={tab}
                  onClick={() => setCfg(prev => ({ ...prev, currentConfigTab: tab }))}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${cfg.currentConfigTab === tab ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}`}
                >
                  {tab}
                </button>
              ))}
            </div>

            {/* Conteúdo das Abas */}
            {cfg.currentConfigTab === 'Empresa' && (
              <div className="space-y-4">
                <h3 className="text-xl font-semibold text-blue-300">🏢 Identidade Visual</h3>
                <div>
                  <label className="block text-sm font-medium text-gray-300">Nome da Empresa</label>
                  <input
                    type="text"
                    value={cfg.company || ''}
                    onChange={(e) => setCfg({ ...cfg, company: e.target.value })}
                    className="mt-1 block w-full p-2 bg-gray-700 border border-gray-600 rounded-md text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300">Slogan / Subtítulo</label>
                  <input
                    type="text"
                    value={cfg.slogan || ''}
                    onChange={(e) => setCfg({ ...cfg, slogan: e.target.value })}
                    className="mt-1 block w-full p-2 bg-gray-700 border border-gray-600 rounded-md text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300">Logomarca (PNG/JPG — max 500kb)</label>
                  <input
                    type="file"
                    accept="image/png, image/jpeg"
                    onChange={(e) => {
                      const file = e.target.files[0]
                      if (file && file.size <= 500 * 1024) {
                        const reader = new FileReader()
                        reader.onloadend = () => {
                          setCfg({ ...cfg, logob64: reader.result })
                        }
                        reader.readAsDataURL(file)
                      } else {
                        alert('A imagem deve ter no máximo 500kb.')
                      }
                    }}
                    className="mt-1 block w-full text-sm text-gray-300 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                  />
                  {cfg.logob64 && <img src={cfg.logob64} alt="Logo Preview" className="mt-2 h-20" />}
                </div>
                <div className="flex justify-end mt-6">
                  <button onClick={handleSaveCompanyConfig} className="px-6 py-2 bg-green-600 rounded-lg hover:bg-green-700 transition-colors">✅ Salvar</button>
                </div>
              </div>
            )}

            {cfg.currentConfigTab === 'Metas' && (
              <div className="space-y-4">
                <h3 className="text-xl font-semibold text-blue-300">🎯 Metas de Vendas por Usuário</h3>
                <p className="text-sm text-gray-400">Defina metas mensais de adesão e mensalidade para cada vendedor. O realizado é calculado automaticamente com base nos contratos com **ambas as partes assinadas**.</p>
                <div>
                  <label className="block text-sm font-medium text-gray-300">Mês de Referência</label>
                  <input
                    type="month"
                    value={cfg.currentGoalMonth || new Date().toISOString().slice(0, 7)}
                    onChange={(e) => setCfg({ ...cfg, currentGoalMonth: e.target.value })}
                    className="mt-1 block w-full p-2 bg-gray-700 border border-gray-600 rounded-md text-white"
                  />
                </div>
                {(cfg.users || []).map(user => (
                  <div key={user.id} className="border border-gray-700 p-4 rounded-md">
                    <h4 className="font-semibold text-gray-200">{user.nome}</h4>
                    <div className="flex space-x-4 mt-2">
                      <div>
                        <label className="block text-xs font-medium text-gray-400">Meta Adesão</label>
                        <input
                          type="number"
                          value={(cfg.goals || []).find(g => g.userId === user.id && g.month === cfg.currentGoalMonth)?.adesao || ''}
                          onChange={(e) => {
                            const newGoals = [...(cfg.goals || [])]
                            const goalIndex = newGoals.findIndex(g => g.userId === user.id && g.month === cfg.currentGoalMonth)
                            if (goalIndex > -1) {
                              newGoals[goalIndex].adesao = Number(e.target.value)
                            } else {
                              newGoals.push({ userId: user.id, month: cfg.currentGoalMonth, adesao: Number(e.target.value), mensalidade: 0 })
                            }
                            setCfg({ ...cfg, goals: newGoals })
                          }}
                          className="mt-1 block w-24 p-1 bg-gray-700 border border-gray-600 rounded-md text-white text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-400">Meta Mensalidade</label>
                        <input
                          type="number"
                          value={(cfg.goals || []).find(g => g.userId === user.id && g.month === cfg.currentGoalMonth)?.mensalidade || ''}
                          onChange={(e) => {
                            const newGoals = [...(cfg.goals || [])]
                            const goalIndex = newGoals.findIndex(g => g.userId === user.id && g.month === cfg.currentGoalMonth)
                            if (goalIndex > -1) {
                              newGoals[goalIndex].mensalidade = Number(e.target.value)
                            } else {
                              newGoals.push({ userId: user.id, month: cfg.currentGoalMonth, adesao: 0, mensalidade: Number(e.target.value) })
                            }
                            setCfg({ ...cfg, goals: newGoals })
                          }}
                          className="mt-1 block w-24 p-1 bg-gray-700 border border-gray-600 rounded-md text-white text-sm"
                        />
                      </div>
                    </div>
                  </div>
                ))}
                <div className="flex justify-end mt-6">
                  <button onClick={() => saveConfig(cfg)} className="px-6 py-2 bg-green-600 rounded-lg hover:bg-green-700 transition-colors">✅ Salvar Metas</button>
                </div>
              </div>
            )}

            {cfg.currentConfigTab === 'KPIs' && (
              <div className="space-y-4">
                <h3 className="text-xl font-semibold text-blue-300">📊 Indicadores de Atividade (KPIs)</h3>
                <p className="text-sm text-gray-400">Configure os KPIs que os vendedores irão acompanhar diariamente. Ex: ligações, agendamentos, contratos fechados.</p>
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={cfg.kpiRequired || false}
                    onChange={(e) => setCfg({ ...cfg, kpiRequired: e.target.checked })}
                    className="h-4 w-4 text-blue-600 border-gray-300 rounded"
                  />
                  <label className="text-sm text-gray-300">Exigir preenchimento diário de KPIs?</label>
                </div>
                <div className="border border-gray-700 p-4 rounded-md">
                  <h4 className="font-semibold text-gray-200 mb-2">KPIs Configurados</h4>
                  {(cfg.kpiTemplates || []).map((kpi, index) => (
                    <div key={kpi.id} className="flex justify-between items-center py-1 border-b border-gray-700 last:border-b-0">
                      <span className="text-gray-300">{kpi.name}</span>
                      <button
                        onClick={() => {
                          const updatedKpis = cfg.kpiTemplates.filter((_, i) => i !== index)
                          setCfg({ ...cfg, kpiTemplates: updatedKpis })
                        }}
                        className="text-red-500 hover:text-red-400 text-sm"
                      >
                        Remover
                      </button>
                    </div>
                  ))}
                  <button onClick={() => setShowAddKpiModal(true)} className="mt-4 px-4 py-2 bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors text-sm">➕ Adicionar KPI</button>
                </div>

                <h3 className="text-xl font-semibold text-blue-300 mt-6">🎯 Metas Diárias por Usuário</h3>
                <p className="text-sm text-gray-400">Defina a meta diária de cada KPI para cada vendedor. O sistema calculará automaticamente a meta mensal (meta diária × dias úteis).</p>
                <div>
                  <label className="block text-sm font-medium text-gray-300">💡 Selecione o mês para configurar as metas</label>
                  <input
                    type="month"
                    value={cfg.currentKpiGoalMonth || new Date().toISOString().slice(0, 7)}
                    onChange={(e) => setCfg({ ...cfg, currentKpiGoalMonth: e.target.value })}
                    className="mt-1 block w-full p-2 bg-gray-700 border border-gray-600 rounded-md text-white"
                  />
                </div>
                {(cfg.users || []).map(user => (
                  <div key={user.id} className="border border-gray-700 p-4 rounded-md">
                    <h4 className="font-semibold text-gray-200">{user.nome}</h4>
                    {(cfg.kpiTemplates || []).map(kpi => (
                      <div key={kpi.id} className="flex items-center space-x-4 mt-2">
                        <label className="block text-xs font-medium text-gray-400 w-32">{kpi.name}</label>
                        <input
                          type="number"
                          value={(cfg.kpiGoals || []).find(g => g.userId === user.id && g.kpiId === kpi.id && g.month === cfg.currentKpiGoalMonth)?.dailyGoal || ''}
                          onChange={(e) => {
                            const newKpiGoals = [...(cfg.kpiGoals || [])]
                            const goalIndex = newKpiGoals.findIndex(g => g.userId === user.id && g.kpiId === kpi.id && g.month === cfg.currentKpiGoalMonth)
                            if (goalIndex > -1) {
                              newKpiGoals[goalIndex].dailyGoal = Number(e.target.value)
                            } else {
                              newKpiGoals.push({ userId: user.id, kpiId: kpi.id, month: cfg.currentKpiGoalMonth, dailyGoal: Number(e.target.value) })
                            }
                            setCfg({ ...cfg, kpiGoals: newKpiGoals })
                          }}
                          className="mt-1 block w-24 p-1 bg-gray-700 border border-gray-600 rounded-md text-white text-sm"
                        />
                      </div>
                    ))}
                  </div>
                ))}
                <div className="flex justify-end mt-6">
                  <button onClick={handleSaveKpiConfig} className="px-6 py-2 bg-green-600 rounded-lg hover:bg-green-700 transition-colors">✅ Salvar Metas de KPI</button>
                </div>
              </div>
            )}

            {cfg.currentConfigTab === 'Usuários' && (
              <div className="space-y-4">
                <h3 className="text-xl font-semibold text-blue-300">👥 Usuários do Sistema</h3>
                <button onClick={() => setShowAddUserModal(true)} className="px-4 py-2 bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors text-sm">+ Novo Usuário</button>
                <div className="overflow-x-auto">
                  <table className="min-w-full bg-gray-700 rounded-lg">
                    <thead>
                      <tr>
                        <th className="py-2 px-4 border-b border-gray-600 text-left text-sm font-semibold text-gray-300">Nome</th>
                        <th className="py-2 px-4 border-b border-gray-600 text-left text-sm font-semibold text-gray-300">E-mail</th>
                        <th className="py-2 px-4 border-b border-gray-600 text-left text-sm font-semibold text-gray-300">Perfil</th>
                        <th className="py-2 px-4 border-b border-gray-600 text-left text-sm font-semibold text-gray-300">Ações</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(cfg.users || []).map(user => (
                        <tr key={user.id}>
                          <td className="py-2 px-4 border-b border-gray-600 text-sm text-gray-200">{user.nome}</td>
                          <td className="py-2 px-4 border-b border-gray-600 text-sm text-gray-200">{user.email}</td>
                          <td className="py-2 px-4 border-b border-gray-600 text-sm text-gray-200">{user.perfil}</td>
                          <td className="py-2 px-4 border-b border-gray-600 text-sm">
                            <button onClick={() => { setCurrentUserToEdit(user); setShowEditUserModal(true); }} className="text-blue-400 hover:text-blue-300 mr-2">Editar</button>
                            <button onClick={() => {
                              if (confirm(`Tem certeza que deseja remover ${user.nome}?`)) {
                                const updatedUsers = cfg.users.filter(u => u.id !== user.id)
                                setCfg({ ...cfg, users: updatedUsers })
                                handleSaveUsersConfig()
                              }
                            }} className="text-red-400 hover:text-red-300">Remover</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="flex justify-end mt-6">
                  <button onClick={handleSaveUsersConfig} className="px-6 py-2 bg-green-600 rounded-lg hover:bg-green-700 transition-colors">✅ Salvar Usuários</button>
                </div>
              </div>
            )}

            {cfg.currentConfigTab === 'Produtos' && (
              <div className="space-y-4">
                <h3 className="text-xl font-semibold text-blue-300">📦 Produtos e Planos</h3>
                <button onClick={() => setShowAddProductModal(true)} className="px-4 py-2 bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors text-sm">+ Novo Produto</button>
                <div className="overflow-x-auto">
                  <table className="min-w-full bg-gray-700 rounded-lg">
                    <thead>
                      <tr>
                        <th className="py-2 px-4 border-b border-gray-600 text-left text-sm font-semibold text-gray-300">Produto</th>
                        {(cfg.plans || []).map(plan => (
                          <th key={plan.id} className="py-2 px-4 border-b border-gray-600 text-center text-sm font-semibold text-gray-300">{plan.name} (Adesão | Mens.)</th>
                        ))}
                        <th className="py-2 px-4 border-b border-gray-600 text-left text-sm font-semibold text-gray-300">Ações</th>
                      </tr>
                    </thead>
                    <tbody>
                      {Object.keys(cfg.prices || {}).map(productKey => (
                        <tr key={productKey}>
                          <td className="py-2 px-4 border-b border-gray-600 text-sm text-gray-200">
                            {cfg.productNames[productKey] || productKey}
                          </td>
                          {(cfg.plans || []).map(plan => {
                            const [adesao, mensalidade] = getPrice(productKey, plan.id, cfg)
                            return (
                              <td key={`${productKey}-${plan.id}`} className="py-2 px-4 border-b border-gray-600 text-center text-sm text-gray-200">
                                {fmt(adesao)} | {fmt(mensalidade)}
                              </td>
                            )
                          })}
                          <td className="py-2 px-4 border-b border-gray-600 text-sm">
                            <button onClick={() => {
                              setCurrentProductForPrice(productKey)
                              setShowAddPriceModal(true)
                            }} className="text-blue-400 hover:text-blue-300 mr-2">Editar Preços</button>
                            <button onClick={() => {
                              setCurrentProductToEdit({ originalName: productKey, name: cfg.productNames[productKey] || productKey })
                              setShowEditProductModal(true)
                            }} className="text-yellow-400 hover:text-yellow-300 mr-2">Editar Nome</button>
                            <button onClick={() => {
                              if (confirm(`Tem certeza que deseja remover o produto ${cfg.productNames[productKey] || productKey}?`)) {
                                const updatedPrices = { ...cfg.prices }
                                delete updatedPrices[productKey]
                                const updatedProductNames = { ...cfg.productNames }
                                delete updatedProductNames[productKey]
                                setCfg({ ...cfg, prices: updatedPrices, productNames: updatedProductNames })
                                handleSaveProductsConfig()
                              }
                            }} className="text-red-400 hover:text-red-300">Remover</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <h3 className="text-xl font-semibold text-blue-300 mt-6">Planos Disponíveis</h3>
                <button onClick={() => setShowAddPlanModal(true)} className="px-4 py-2 bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors text-sm">+ Novo Plano</button>
                <div className="overflow-x-auto">
                  <table className="min-w-full bg-gray-700 rounded-lg">
                    <thead>
                      <tr>
                        <th className="py-2 px-4 border-b border-gray-600 text-left text-sm font-semibold text-gray-300">Nome Exibido</th>
                        <th className="py-2 px-4 border-b border-gray-600 text-left text-sm font-semibold text-gray-300">ID/Chave</th>
                        <th className="py-2 px-4 border-b border-gray-600 text-center text-sm font-semibold text-gray-300">Max CNPJs</th>
                        <th className="py-2 px-4 border-b border-gray-600 text-center text-sm font-semibold text-gray-300">Usuários</th>
                        <th className="py-2 px-4 border-b border-gray-600 text-left text-sm font-semibold text-gray-300">Ações</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(cfg.plans || []).map(plan => (
                        <tr key={plan.id}>
                          <td className="py-2 px-4 border-b border-gray-600 text-sm text-gray-200">{plan.name}</td>
                          <td className="py-2 px-4 border-b border-gray-600 text-sm text-gray-200">{plan.id}</td>
                          <td className="py-2 px-4 border-b border-gray-600 text-center text-sm text-gray-200">{plan.maxCnpjs}</td>
                          <td className="py-2 px-4 border-b border-gray-600 text-center text-sm text-gray-200">{plan.unlimitedUsers ? '∞' : plan.users}</td>
                          <td className="py-2 px-4 border-b border-gray-600 text-sm">
                            <button onClick={() => {
                              if (confirm(`Tem certeza que deseja remover o plano ${plan.name}?`)) {
                                const updatedPlans = cfg.plans.filter(p => p.id !== plan.id)
                                setCfg({ ...cfg, plans: updatedPlans })
                                handleSaveProductsConfig()
                              }
                            }} className="text-red-400 hover:text-red-300">Remover</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="flex justify-end space-x-4 mt-6">
                  <button onClick={handleSaveProductsConfig} className="px-6 py-2 bg-green-600 rounded-lg hover:bg-green-700 transition-colors">✅ Salvar Tudo</button>
                  <button onClick={() => {
                    if (confirm('Tem certeza que deseja restaurar os preços padrão? Isso apagará todas as suas configurações de preços personalizadas.')) {
                      setCfg({ ...cfg, prices: DEFAULT_CFG.prices, productNames: DEFAULT_CFG.productNames, plans: DEFAULT_CFG.plans })
                      handleSaveProductsConfig()
                    }
                  }} className="px-6 py-2 bg-gray-600 rounded-lg hover:bg-gray-700 transition-colors">🔄 Restaurar preços padrão</button>
                </div>
              </div>
            )}

            {cfg.currentConfigTab === 'Descontos' && (
              <div className="space-y-4">
                <h3 className="text-xl font-semibold text-blue-300">🏷️ Descontos</h3>
                <div>
                  <label className="block text-sm font-medium text-gray-300">Modo de Desconto</label>
                  <select
                    value={cfg.discMode || 'screen'}
                    onChange={(e) => setCfg({ ...cfg, discMode: e.target.value })}
                    className="mt-1 block w-full p-2 bg-gray-700 border border-gray-600 rounded-md text-white"
                  >
                    <option value="screen">Desconto em Tela (Mostra desconto após o preço cheio automaticamente)</option>
                    <option value="voucher">Somente via Voucher (Desconto só é aplicado com código de voucher válido)</option>
                  </select>
                </div>
                <h4 className="font-semibold text-gray-200 mt-4">Percentuais de Desconto</h4>
                <div className="flex space-x-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300">% Adesão (tela)</label>
                    <input
                      type="number"
                      value={cfg.discAdPct || 0}
                      onChange={(e) => setCfg({ ...cfg, discAdPct: Number(e.target.value) })}
                      className="mt-1 block w-24 p-2 bg-gray-700 border border-gray-600 rounded-md text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300">% Mensalidade (tela)</label>
                    <input
                      type="number"
                      value={cfg.discMenPct || 0}
                      onChange={(e) => setCfg({ ...cfg, discMenPct: Number(e.target.value) })}
                      className="mt-1 block w-24 p-2 bg-gray-700 border border-gray-600 rounded-md text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300">% Adesão (fechamento)</label>
                    <input
                      type="number"
                      value={cfg.discClosePct || 0}
                      onChange={(e) => setCfg({ ...cfg, discClosePct: Number(e.target.value) })}
                      className="mt-1 block w-24 p-2 bg-gray-700 border border-gray-600 rounded-md text-white"
                    />
                  </div>
                </div>
                <div className="flex items-center space-x-2 mt-4">
                  <input
                    type="checkbox"
                    checked={cfg.unlimitedStrategy || false}
                    onChange={(e) => setCfg({ ...cfg, unlimitedStrategy: e.target.checked })}
                    className="h-4 w-4 text-blue-600 border-gray-300 rounded"
                  />
                  <label className="text-sm text-gray-300">Usuários Ilimitados nas ofertas (Exibe "Usuários Ilimitados" nas ofertas com desconto e fechamento)</label>
                </div>
                <div className="flex justify-end mt-6">
                  <button onClick={handleSaveDiscountConfig} className="px-6 py-2 bg-green-600 rounded-lg hover:bg-green-700 transition-colors">✅ Salvar</button>
                </div>
              </div>
            )}

            {cfg.currentConfigTab === 'Vouchers' && (
              <div className="space-y-4">
                <h3 className="text-xl font-semibold text-blue-300">🎫 Vouchers</h3>
                <button onClick={() => setShowAddVoucherModal(true)} className="px-4 py-2 bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors text-sm">Gerar Novo Voucher</button>
                <div className="overflow-x-auto">
                  <table className="min-w-full bg-gray-700 rounded-lg">
                    <thead>
                      <tr>
                        <th className="py-2 px-4 border-b border-gray-600 text-left text-sm font-semibold text-gray-300">Prefixo</th>
                        <th className="py-2 px-4 border-b border-gray-600 text-center text-sm font-semibold text-gray-300">% Adesão</th>
                        <th className="py-2 px-4 border-b border-gray-600 text-center text-sm font-semibold text-gray-300">% Mensalidade</th>
                        <th className="py-2 px-4 border-b border-gray-600 text-left text-sm font-semibold text-gray-300">Data Comemorativa</th>
                        <th className="py-2 px-4 border-b border-gray-600 text-left text-sm font-semibold text-gray-300">Ativo</th>
                        <th className="py-2 px-4 border-b border-gray-600 text-left text-sm font-semibold text-gray-300">Ações</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(cfg.vouchers || []).map(voucher => (
                        <tr key={voucher.id}>
                          <td className="py-2 px-4 border-b border-gray-600 text-sm text-gray-200">{voucher.prefix}</td>
                          <td className="py-2 px-4 border-b border-gray-600 text-center text-sm text-gray-200">{voucher.adPct}%</td>
                          <td className="py-2 px-4 border-b border-gray-600 text-center text-sm text-gray-200">{voucher.menPct}%</td>
                          <td className="py-2 px-4 border-b border-gray-600 text-sm text-gray-200">{voucher.commemorativeDate}</td>
                          <td className="py-2 px-4 border-b border-gray-600 text-sm text-gray-200">
                            <input
                              type="checkbox"
                              checked={voucher.active}
                              onChange={(e) => {
                                const updatedVouchers = cfg.vouchers.map(v => v.id === voucher.id ? { ...v, active: e.target.checked } : v)
                                setCfg({ ...cfg, vouchers: updatedVouchers })
                                handleSaveVouchersConfig()
                              }}
                              className="h-4 w-4 text-blue-600 border-gray-300 rounded"
                            />
                          </td>
                          <td className="py-2 px-4 border-b border-gray-600 text-sm">
                            <button onClick={() => {
                              if (confirm(`Tem certeza que deseja remover o voucher ${voucher.prefix}?`)) {
                                const updatedVouchers = cfg.vouchers.filter(v => v.id !== voucher.id)
                                setCfg({ ...cfg, vouchers: updatedVouchers })
                                handleSaveVouchersConfig()
                              }
                            }} className="text-red-400 hover:text-red-300">Remover</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="flex justify-end mt-6">
                  <button onClick={handleSaveVouchersConfig} className="px-6 py-2 bg-green-600 rounded-lg hover:bg-green-700 transition-colors">✅ Salvar Vouchers</button>
                </div>
              </div>
            )}

            {cfg.currentConfigTab === 'Documentos' && (
              <div className="space-y-4">
                <h3 className="text-xl font-semibold text-blue-300">📄 Modelos de Documentos</h3>
                <p className="text-sm text-gray-400">Configure os modelos padrão usados em todas as propostas e contratos gerados. Deixe em branco para usar o modelo padrão do sistema.</p>
                <div className="border border-gray-700 p-4 rounded-md">
                  <h4 className="font-semibold text-gray-200 mb-2">📄 Modelo de Proposta Comercial</h4>
                  <p className="text-sm text-gray-400 mb-2">Texto de abertura personalizado para propostas</p>
                  <button onClick={() => { setCurrentDocTemplateType('proposal'); setDocTemplateContent(cfg.proposalTemplate || ''); setShowEditDocTemplateModal(true); }} className="px-4 py-2 bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors text-sm">✏️ Editar</button>
                </div>
                <div className="border border-gray-700 p-4 rounded-md">
                  <h4 className="font-semibold text-gray-200 mb-2">📝 Modelo de Contrato</h4>
                  <p className="text-sm text-gray-400 mb-2">Texto de abertura personalizado para contratos</p>
                  <button onClick={() => { setCurrentDocTemplateType('contract'); setDocTemplateContent(cfg.contractTemplate || ''); setShowEditDocTemplateModal(true); }} className="px-4 py-2 bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors text-sm">✏️ Editar</button>
                </div>
                <div className="flex justify-end mt-6">
                  <button onClick={handleSaveDocTemplatesConfig} className="px-6 py-2 bg-green-600 rounded-lg hover:bg-green-700 transition-colors">✅ Salvar Modelos</button>
                </div>
              </div>
            )}

            {cfg.currentConfigTab === 'Assinatura' && (
              <div className="space-y-4">
                <h3 className="text-xl font-semibold text-blue-300">✍️ Configurações de Assinatura Eletrônica</h3>
                <div>
                  <label className="block text-sm font-medium text-gray-300">E-mail remetente (para envio)</label>
                  <input
                    type="email"
                    value={cfg.emailRemetente || ''}
                    onChange={(e) => setCfg({ ...cfg, emailRemetente: e.target.value })}
                    className="mt-1 block w-full p-2 bg-gray-700 border border-gray-600 rounded-md text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300">WhatsApp da empresa</label>
                  <input
                    type="text"
                    value={cfg.whatsappEmpresa || ''}
                    onChange={(e) => setCfg({ ...cfg, whatsappEmpresa: e.target.value })}
                    className="mt-1 block w-full p-2 bg-gray-700 border border-gray-600 rounded-md text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300">URL base do sistema (para links de assinatura)</label>
                  <p className="text-xs text-gray-400 mb-1">Se não configurado, será gerado um link local com os dados do documento</p>
                  <input
                    type="url"
                    value={cfg.baseUrl || ''}
                    onChange={(e) => setCfg({ ...cfg, baseUrl: e.target.value })}
                    className="mt-1 block w-full p-2 bg-gray-700 border border-gray-600 rounded-md text-white"
                  />
                </div>
                <div className="flex justify-end mt-6">
                  <button onClick={handleSaveSignatureConfig} className="px-6 py-2 bg-green-600 rounded-lg hover:bg-green-700 transition-colors">✅ Salvar Configurações</button>
                  <button onClick={() => alert('Funcionalidade de teste de conexão Supabase em desenvolvimento.')} className="ml-4 px-6 py-2 bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors">🔌 Testar Conexão Supabase</button>
                </div>
              </div>
            )}

            {cfg.currentConfigTab === 'Clientes' && (
              <div className="space-y-4">
                <h3 className="text-xl font-semibold text-blue-300">🗃️ Clientes</h3>
                <div className="flex justify-between items-center">
                  <input
                    type="text"
                    placeholder="Buscar por CPF/CNPJ ou Nome"
                    value={clientSearchTerm}
                    onChange={(e) => setClientSearchTerm(e.target.value)}
                    className="flex-1 p-2 bg-gray-700 border border-gray-600 rounded-md text-white mr-2"
                  />
                  <button onClick={handleNewClient} className="px-4 py-2 bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors text-sm">+ Novo Cliente</button>
                </div>
                <div className="overflow-x-auto">
                  <table className="min-w-full bg-gray-700 rounded-lg">
                    <thead>
                      <tr>
                        <th className="py-2 px-4 border-b border-gray-600 text-left text-sm font-semibold text-gray-300">Nome Fantasia</th>
                        <th className="py-2 px-4 border-b border-gray-600 text-left text-sm font-semibold text-gray-300">CPF/CNPJ</th>
                        <th className="py-2 px-4 border-b border-gray-600 text-left text-sm font-semibold text-gray-300">Contato</th>
                        <th className="py-2 px-4 border-b border-gray-600 text-left text-sm font-semibold text-gray-300">Ações</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(filteredClients || []).map((client, index) => (
                        <tr key={client.id}>
                          <td className="py-2 px-4 border-b border-gray-600 text-sm text-gray-200">{client.nomeFantasia}</td>
                          <td className="py-2 px-4 border-b border-gray-600 text-sm text-gray-200">{fmtDoc(client.cpfCnpj)}</td>
                          <td className="py-2 px-4 border-b border-gray-600 text-sm text-gray-200">{client.contatoNome}</td>
                          <td className="py-2 px-4 border-b border-gray-600 text-sm">
                            <button onClick={() => handleEditClient(client, index)} className="text-blue-400 hover:text-blue-300 mr-2">Editar</button>
                            <button onClick={() => {
                              if (confirm(`Tem certeza que deseja remover o cliente ${client.nomeFantasia}?`)) {
                                const updatedClients = cfg.clients.filter(c => c.id !== client.id)
                                setCfg({ ...cfg, clients: updatedClients })
                                handleSaveClientsConfig()
                              }
                            }} className="text-red-400 hover:text-red-300">Remover</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="flex justify-end mt-6">
                  <button onClick={handleSaveClientsConfig} className="px-6 py-2 bg-green-600 rounded-lg hover:bg-green-700 transition-colors">✅ Salvar Clientes</button>
                </div>
              </div>
            )}

            {cfg.currentConfigTab === 'Tema' && (
              <div className="space-y-4">
                <h3 className="text-xl font-semibold text-blue-300">🎨 Aparência</h3>
                <div className="flex items-center space-x-4">
                  <label className="flex items-center">
                    <input
                      type="radio"
                      name="theme"
                      value="dark"
                      checked={cfg.theme !== 'light'}
                      onChange={() => setCfg({ ...cfg, theme: 'dark' })}
                      className="h-4 w-4 text-blue-600 border-gray-300"
                    />
                    <span className="ml-2 text-gray-300">🌙 Tema Escuro (Fundo escuro com cores vibrantes - padrão)</span>
                  </label>
                  <label className="flex items-center">
                    <input
                      type="radio"
                      name="theme"
                      value="light"
                      checked={cfg.theme === 'light'}
                      onChange={() => setCfg({ ...cfg, theme: 'light' })}
                      className="h-4 w-4 text-blue-600 border-gray-300"
                    />
                    <span className="ml-2 text-gray-300">☀️ Tema Claro (Fundo branco, ideal para ambientes iluminados)</span>
                  </label>
                </div>
                <div className="flex justify-end mt-6">
                  <button onClick={handleSaveThemeConfig} className="px-6 py-2 bg-green-600 rounded-lg hover:bg-green-700 transition-colors">✅ Salvar Tema</button>
                </div>
              </div>
            )}

          </div>
        </div>
      )}

      {/* Client Modal (Add/Edit) */}
      {showClientModal && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 p-8 rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto relative">
            <h3 className="text-2xl font-bold mb-6 text-center">{currentClient ? '✏️ Editar Cliente' : '➕ Novo Cliente'}</h3>
            <button onClick={() => setShowClientModal(false)} className="absolute top-4 right-4 text-gray-400 hover:text-white text-2xl">✕</button>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-300">CPF / CNPJ *</label>
                <input
                  type="text"
                  value={newClientData.cpfCnpj}
                  onChange={(e) => setNewClientData({ ...newClientData, cpfCnpj: clean(e.target.value) })}
                  className="mt-1 block w-full p-2 bg-gray-700 border border-gray-600 rounded-md text-white"
                  maxLength={14}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300">Nome Fantasia / Nome *</label>
                <input
                  type="text"
                  value={newClientData.nomeFantasia}
                  onChange={(e) => setNewClientData({ ...newClientData, nomeFantasia: e.target.value })}
                  className="mt-1 block w-full p-2 bg-gray-700 border border-gray-600 rounded-md text-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300">Razão Social</label>
                <input
                  type="text"
                  value={newClientData.razaoSocial}
                  onChange={(e) => setNewClientData({ ...newClientData, razaoSocial: e.target.value })}
                  className="mt-1 block w-full p-2 bg-gray-700 border border-gray-600 rounded-md text-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300">Nome do Contato</label>
                <input
                  type="text"
                  value={newClientData.contatoNome}
                  onChange={(e) => setNewClientData({ ...newClientData, contatoNome: e.target.value })}
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
              <div>
                <label className="block text-sm font-medium text-gray-300">CPF do Contato Principal</label>
                <input
                  type="text"
                  value={newClientData.cpfContato}
                  onChange={(e) => setNewClientData({ ...newClientData, cpfContato: clean(e.target.value) })}
                  className="mt-1 block w-full p-2 bg-gray-700 border border-gray-600 rounded-md text-white"
                  maxLength={11}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300">Regime Tributário</label>
                <select
                  value={newClientData.regimeTributario}
                  onChange={(e) => setNewClientData({ ...newClientData, regimeTributario: e.target.value })}
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

            <h4 className="text-lg font-semibold text-blue-300 mt-6 mb-4">👷 Responsável pela Implantação</h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-300">Nome</label>
                <input
                  type="text"
                  value={newClientData.implNome}
                  onChange={(e) => setNewClientData({ ...newClientData, implNome: e.target.value })}
                  className="mt-1 block w-full p-2 bg-gray-700 border border-gray-600 rounded-md text-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300">E-mail</label>
                <input
                  type="email"
                  value={newClientData.implEmail}
                  onChange={(e) => setNewClientData({ ...newClientData, implEmail: e.target.value })}
                  className="mt-1 block w-full p-2 bg-gray-700 border border-gray-600 rounded-md text-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300">Telefone</label>
                <input
                  type="text"
                  value={newClientData.implTelefone}
                  onChange={(e) => setNewClientData({ ...newClientData, implTelefone: e.target.value })}
                  className="mt-1 block w-full p-2 bg-gray-700 border border-gray-600 rounded-md text-white"
                />
              </div>
            </div>

            <h4 className="text-lg font-semibold text-blue-300 mt-6 mb-4">💰 Responsável Financeiro</h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-300">Nome</label>
                <input
                  type="text"
                  value={newClientData.finanNome}
                  onChange={(e) => setNewClientData({ ...newClientData, finanNome: e.target.value })}
                  className="mt-1 block w-full p-2 bg-gray-700 border border-gray-600 rounded-md text-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300">E-mail</label>
                <input
                  type="email"
                  value={newClientData.finanEmail}
                  onChange={(e) => setNewClientData({ ...newClientData, finanEmail: e.target.value })}
                  className="mt-1 block w-full p-2 bg-gray-700 border border-gray-600 rounded-md text-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300">Telefone</label>
                <input
                  type="text"
                  value={newClientData.finanTelefone}
                  onChange={(e) => setNewClientData({ ...newClientData, finanTelefone: e.target.value })}
                  className="mt-1 block w-full p-2 bg-gray-700 border border-gray-600 rounded-md text-white"
                />
              </div>
            </div>

            <div className="flex justify-end space-x-4 mt-6">
              <button onClick={() => setShowClientModal(false)} className="px-6 py-2 bg-gray-600 rounded-lg hover:bg-gray-700 transition-colors">Cancelar</button>
              <button onClick={handleSaveClient} className="px-6 py-2 bg-green-600 rounded-lg hover:bg-green-700 transition-colors">✅ Salvar Cliente</button>
            </div>
          </div>
        </div>
      )}

      {/* Add KPI Modal */}
      {showAddKpiModal && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 p-8 rounded-lg shadow-xl w-full max-w-md relative">
            <h3 className="text-2xl font-bold mb-6 text-center">➕ Adicionar Novo KPI</h3>
            <button onClick={() => setShowAddKpiModal(false)} className="absolute top-4 right-4 text-gray-400 hover:text-white text-2xl">✕</button>
            <div>
              <label className="block text-sm font-medium text-gray-300">Nome do KPI</label>
              <input
                type="text"
                value={newKpiData.name}
                onChange={(e) => setNewKpiData({ ...newKpiData, name: e.target.value })}
                className="mt-1 block w-full p-2 bg-gray-700 border border-gray-600 rounded-md text-white"
              />
            </div>
            <div className="flex justify-end space-x-4 mt-6">
              <button onClick={() => setShowAddKpiModal(false)} className="px-6 py-2 bg-gray-600 rounded-lg hover:bg-gray-700 transition-colors">Cancelar</button>
              <button onClick={handleAddKpi} className="px-6 py-2 bg-green-600 rounded-lg hover:bg-green-700 transition-colors">✅ Adicionar KPI</button>
            </div>
          </div>
        </div>
      )}

      {/* Add Voucher Modal */}
      {showAddVoucherModal && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 p-8 rounded-lg shadow-xl w-full max-w-md relative">
            <h3 className="text-2xl font-bold mb-6 text-center">🎫 Gerar Novo Voucher</h3>
            <button onClick={() => setShowAddVoucherModal(false)} className="absolute top-4 right-4 text-gray-400 hover:text-white text-2xl">✕</button>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300">Prefixo</label>
                <input
                  type="text"
                  value={newVoucherData.prefix}
                  onChange={(e) => setNewVoucherData({ ...newVoucherData, prefix: e.target.value })}
                  className="mt-1 block w-full p-2 bg-gray-700 border border-gray-600 rounded-md text-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300">% Adesão</label>
                <input
                  type="number"
                  value={newVoucherData.adPct}
                  onChange={(e) => setNewVoucherData({ ...newVoucherData, adPct: Number(e.target.value) })}
                  className="mt-1 block w-full p-2 bg-gray-700 border border-gray-600 rounded-md text-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300">% Mensalidade</label>
                <input
                  type="number"
                  value={newVoucherData.menPct}
                  onChange={(e) => setNewVoucherData({ ...newVoucherData, menPct: Number(e.target.value) })}
                  className="mt-1 block w-full p-2 bg-gray-700 border border-gray-600 rounded-md text-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300">Data comemorativa (opcional)</label>
                <input
                  type="text"
                  value={newVoucherData.commemorativeDate}
                  onChange={(e) => setNewVoucherData({ ...newVoucherData, commemorativeDate: e.target.value })}
                  className="mt-1 block w-full p-2 bg-gray-700 border border-gray-600 rounded-md text-white"
                />
              </div>
            </div>
            <div className="flex justify-end space-x-4 mt-6">
              <button onClick={() => setShowAddVoucherModal(false)} className="px-6 py-2 bg-gray-600 rounded-lg hover:bg-gray-700 transition-colors">Cancelar</button>
              <button onClick={handleAddVoucher} className="px-6 py-2 bg-green-600 rounded-lg hover:bg-green-700 transition-colors">🎫 Gerar Voucher</button>
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
                <input
                  type="text"
                  value={newProductData.name}
                  onChange={(e) => setNewProductData({ ...newProductData, name: e.target.value })}
                  className="mt-1 block w-full p-2 bg-gray-700 border border-gray-600 rounded-md text-white"
                />
              </div>
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={newProductData.noAdesao}
                  onChange={(e) => setNewProductData({ ...newProductData, noAdesao: e.target.checked })}
                  className="h-4 w-4 text-blue-600 border-gray-300 rounded"
                />
                <label className="text-sm text-gray-300">Sem adesão (módulo como CND)</label>
              </div>
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={newProductData.basicProTopOnly}
                  onChange={(e) => setNewProductData({ ...newProductData, basicProTopOnly: e.target.checked })}
                  className="h-4 w-4 text-blue-600 border-gray-300 rounded"
                />
                <label className="text-sm text-gray-300">Apenas planos Basic/Pro/Top (como IF/EP)</label>
              </div>
            </div>
            <div className="flex justify-end space-x-4 mt-6">
              <button onClick={() => setShowAddProductModal(false)} className="px-6 py-2 bg-gray-600 rounded-lg hover:bg-gray-700 transition-colors">Cancelar</button>
              <button onClick={handleAddProduct} className="px-6 py-2 bg-green-600 rounded-lg hover:bg-green-700 transition-colors">✅ Adicionar Produto</button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Product Modal */}
      {showEditProductModal && currentProductToEdit && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 p-8 rounded-lg shadow-xl w-full max-w-md relative">
            <h3 className="text-2xl font-bold mb-6 text-center">✏️ Editar Produto</h3>
            <button onClick={() => setShowEditProductModal(false)} className="absolute top-4 right-4 text-gray-400 hover:text-white text-2xl">✕</button>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300">Nome do Produto</label>
                <input
                  type="text"
                  value={currentProductToEdit.name}
                  onChange={(e) => setCurrentProductToEdit({ ...currentProductToEdit, name: e.target.value })}
                  className="mt-1 block w-full p-2 bg-gray-700 border border-gray-600 rounded-md text-white"
                />
              </div>
            </div>
            <div className="flex justify-end space-x-4 mt-6">
              <button onClick={() => setShowEditProductModal(false)} className="px-6 py-2 bg-gray-600 rounded-lg hover:bg-gray-700 transition-colors">Cancelar</button>
              <button onClick={handleEditProduct} className="px-6 py-2 bg-green-600 rounded-lg hover:bg-green-700 transition-colors">✅ Salvar</button>
            </div>
          </div>
        </div>
      )}

      {/* Add Price to Product Modal */}
      {showAddPriceModal && currentProductForPrice && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 p-8 rounded-lg shadow-xl w-full max-w-md relative">
            <h3 className="text-2xl font-bold mb-6 text-center">Preços para {cfg.productNames[currentProductForPrice] || currentProductForPrice}</h3>
            <button onClick={() => setShowAddPriceModal(false)} className="absolute top-4 right-4 text-gray-400 hover:text-white text-2xl">✕</button>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300">Plano</label>
                <select
                  value={newPriceData.planId}
                  onChange={(e) => setNewPriceData({ ...newPriceData, planId: e.target.value })}
                  className="mt-1 block w-full p-2 bg-gray-700 border border-gray-600 rounded-md text-white"
                >
                  <option value="">Selecione um plano</option>
                  {(cfg.plans || []).map(plan => (
                    <option key={plan.id} value={plan.id}>{plan.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300">Adesão</label>
                <input
                  type="number"
                  value={newPriceData.adesao}
                  onChange={(e) => setNewPriceData({ ...newPriceData, adesao: e.target.value })}
                  className="mt-1 block w-full p-2 bg-gray-700 border border-gray-600 rounded-md text-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300">Mensalidade</label>
                <input
                  type="number"
                  value={newPriceData.mensalidade}
                  onChange={(e) => setNewPriceData({ ...newPriceData, mensalidade: e.target.value })}
                  className="mt-1 block w-full p-2 bg-gray-700 border border-gray-600 rounded-md text-white"
                />
              </div>
            </div>
            <div className="flex justify-end space-x-4 mt-6">
              <button onClick={() => setShowAddPriceModal(false)} className="px-6 py-2 bg-gray-600 rounded-lg hover:bg-gray-700 transition-colors">Cancelar</button>
              <button onClick={handleAddPriceToProduct} className="px-6 py-2 bg-green-600 rounded-lg hover:bg-green-700 transition-colors">✅ Salvar Preço</button>
            </div>
          </div>
        </div>
      )}

      {/* Add User Modal */}
      {showAddUserModal && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 p-8 rounded-lg shadow-xl w-full max-w-md relative">
            <h3 className="text-2xl font-bold mb-6 text-center">➕ Novo Usuário</h3>
            <button onClick={() => setShowAddUserModal(false)} className="absolute top-4 right-4 text-gray-400 hover:text-white text-2xl">✕</button>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300">Nome Completo</label>
                <input
                  type="text"
                  value={newUserData.nome}
                  onChange={(e) => setNewUserData({ ...newUserData, nome: e.target.value })}
                  className="mt-1 block w-full p-2 bg-gray-700 border border-gray-600 rounded-md text-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300">E-mail</label>
                <input
                  type="email"
                  value={newUserData.email}
                  onChange={(e) => setNewUserData({ ...newUserData, email: e.target.value })}
                  className="mt-1 block w-full p-2 bg-gray-700 border border-gray-600 rounded-md text-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300">Telefone</label>
                <input
                  type="text"
                  value={newUserData.telefone}
                  onChange={(e) => setNewUserData({ ...newUserData, telefone: e.target.value })}
                  className="mt-1 block w-full p-2 bg-gray-700 border border-gray-600 rounded-md text-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300">Senha</label>
                <input
                  type="password"
                  value={newUserData.senha}
                  onChange={(e) => setNewUserData({ ...newUserData, senha: e.target.value })}
                  className="mt-1 block w-full p-2 bg-gray-700 border border-gray-600 rounded-md text-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300">Perfil</label>
                <select
                  value={newUserData.perfil}
                  onChange={(e) => setNewUserData({ ...newUserData, perfil: e.target.value })}
                  className="mt-1 block w-full p-2 bg-gray-700 border border-gray-600 rounded-md text-white"
                >
                  <option value="padrao">Padrão</option>
                  <option value="admin">Administrador</option>
                </select>
              </div>
            </div>
            <div className="flex justify-end space-x-4 mt-6">
              <button onClick={() => setShowAddUserModal(false)} className="px-6 py-2 bg-gray-600 rounded-lg hover:bg-gray-700 transition-colors">Cancelar</button>
              <button onClick={handleAddUser} className="px-6 py-2 bg-green-600 rounded-lg hover:bg-green-700 transition-colors">✅ Salvar Usuário</button>
            </div>
          </div>
        </div>
      )}

      {/* Edit User Modal */}
      {showEditUserModal && currentUserToEdit && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 p-8 rounded-lg shadow-xl w-full max-w-md relative">
            <h3 className="text-2xl font-bold mb-6 text-center">✏️ Editar Usuário</h3>
            <button onClick={() => setShowEditUserModal(false)} className="absolute top-4 right-4 text-gray-400 hover:text-white text-2xl">✕</button>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300">Nome Completo</label>
                <input
                  type="text"
                  value={currentUserToEdit.nome}
                  onChange={(e) => setCurrentUserToEdit({ ...currentUserToEdit, nome: e.target.value })}
                  className="mt-1 block w-full p-2 bg-gray-700 border border-gray-600 rounded-md text-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300">E-mail</label>
                <input
                  type="email"
                  value={currentUserToEdit.email}
                  onChange={(e) => setCurrentUserToEdit({ ...currentUserToEdit, email: e.target.value })}
                  className="mt-1 block w-full p-2 bg-gray-700 border border-gray-600 rounded-md text-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300">Telefone</label>
                <input
                  type="text"
                  value={currentUserToEdit.telefone}
                  onChange={(e) => setCurrentUserToEdit({ ...currentUserToEdit, telefone: e.target.value })}
                  className="mt-1 block w-full p-2 bg-gray-700 border border-gray-600 rounded-md text-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300">Nova Senha (vazio = manter)</label>
                <input
                  type="password"
                  value="" // Não pré-preenche senhas por segurança
                  onChange={(e) => setCurrentUserToEdit({ ...currentUserToEdit, senha: e.target.value })}
                  className="mt-1 block w-full p-2 bg-gray-700 border border-gray-600 rounded-md text-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300">Perfil</label>
                <select
                  value={currentUserToEdit.perfil}
                  onChange={(e) => setCurrentUserToEdit({ ...currentUserToEdit, perfil: e.target.value })}
                  className="mt-1 block w-full p-2 bg-gray-700 border border-gray-600 rounded-md text-white"
                >
                  <option value="padrao">Padrão</option>
                  <option value="admin">Administrador</option>
                </select>
              </div>
              <div className="mt-4">
                <label className="block text-sm font-medium text-gray-300">✍️ Assinatura do Consultor (aparece nos contratos)</label>
                {currentUserToEdit.assinatura && (
                  <img src={currentUserToEdit.assinatura} alt="Assinatura" className="mt-2 max-h-20 border border-gray-600 p-1" />
                )}
                <div className="flex space-x-2 mt-2">
                  <button onClick={() => alert('Funcionalidade de carregar imagem em desenvolvimento.')} className="px-4 py-2 bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors text-sm">📷 Carregar imagem</button>
                  <button onClick={() => setSignaturePadOpen(true)} className="px-4 py-2 bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors text-sm">✍️ Desenhar</button>
                </div>
              </div>
            </div>
            <div className="flex justify-end space-x-4 mt-6">
              <button onClick={() => setShowEditUserModal(false)} className="px-6 py-2 bg-gray-600 rounded-lg hover:bg-gray-700 transition-colors">Cancelar</button>
              <button onClick={handleEditUser} className="px-6 py-2 bg-green-600 rounded-lg hover:bg-green-700 transition-colors">✅ Salvar</button>
            </div>
          </div>
        </div>
      )}

      {/* Signature Pad Modal */}
      {signaturePadOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 p-8 rounded-lg shadow-xl w-full max-w-md relative">
            <h3 className="text-2xl font-bold mb-6 text-center">✍️ Desenhar Assinatura</h3>
            <canvas
              id="signatureCanvas"
              width="400"
              height="200"
              className="border border-gray-600 bg-white rounded-md cursor-crosshair"
              style={{ touchAction: 'none' }} // Para melhor experiência em touch
            ></canvas>
            <div className="flex justify-end space-x-4 mt-6">
              <button onClick={() => {
                const canvas = document.getElementById('signatureCanvas');
                const ctx = canvas.getContext('2d');
                ctx.clearRect(0, 0, canvas.width, canvas.height);
              }} className="px-6 py-2 bg-gray-600 rounded-lg hover:bg-gray-700 transition-colors">🗑 Limpar</button>
              <button onClick={() => {
                const canvas = document.getElementById('signatureCanvas');
                setDrawnSignature(canvas.toDataURL());
                if (currentUserToEdit) {
                  setCurrentUserToEdit({ ...currentUserToEdit, assinatura: canvas.toDataURL() });
                } else if (newUserData) {
                  setNewUserData({ ...newUserData, assinatura: canvas.toDataURL() });
                }
                setSignaturePadOpen(false);
              }} className="px-6 py-2 bg-green-600 rounded-lg hover:bg-green-700 transition-colors">✅ Usar esta assinatura</button>
              <button onClick={() => setSignaturePadOpen(false)} className="px-6 py-2 bg-red-600 rounded-lg hover:bg-red-700 transition-colors">Cancelar</button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Document Template Modal */}
      {showEditDocTemplateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 p-8 rounded-lg shadow-xl w-full max-w-3xl max-h-[90vh] overflow-y-auto relative">
            <h3 className="text-2xl font-bold mb-6 text-center">✏️ Editar Modelo de {currentDocTemplateType === 'proposal' ? 'Proposta' : 'Contrato'}</h3>
            <button onClick={() => setShowEditDocTemplateModal(false)} className="absolute top-4 right-4 text-gray-400 hover:text-white text-2xl">✕</button>
            <p className="text-sm text-gray-400 mb-4">Texto de abertura personalizado (HTML ou texto puro). Deixe vazio para usar o padrão.</p>
            <textarea
              value={docTemplateContent}
              onChange={(e) => setDocTemplateContent(e.target.value)}
              className="mt-1 block w-full h-96 p-2 bg-gray-700 border border-gray-600 rounded-md text-white font-mono text-sm"
              placeholder="Insira seu HTML ou texto aqui..."
            ></textarea>
            <div className="flex justify-end space-x-4 mt-6">
              <button onClick={() => setShowEditDocTemplateModal(false)} className="px-6 py-2 bg-gray-600 rounded-lg hover:bg-gray-700 transition-colors">Cancelar</button>
              <button onClick={handleUseDefaultDocTemplate} className="px-6 py-2 bg-red-600 rounded-lg hover:bg-red-700 transition-colors">🔄 Usar Padrão</button>
              <button onClick={handleSaveDocTemplate} className="px-6 py-2 bg-green-600 rounded-lg hover:bg-green-700 transition-colors">✅ Salvar Modelo</button>
            </div>
          </div>
        </div>
      )}

      {/* Add Plan Modal */}
      {showAddPlanModal && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 p-8 rounded-lg shadow-xl w-full max-w-md relative">
            <h3 className="text-2xl font-bold mb-6 text-center">➕ Novo Plano</h3>
            <button onClick={() => setShowAddPlanModal(false)} className="absolute top-4 right-4 text-gray-400 hover:text-white text-2xl">✕</button>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300">ID/Chave do Plano (ex: basic, pro)</label>
                <input
                  type="text"
                  value={newPlanData.id}
                  onChange={(e) => setNewPlanData({ ...newPlanData, id: e.target.value })}
                  className="mt-1 block w-full p-2 bg-gray-700 border border-gray-600 rounded-md text-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300">Nome Exibido (ex: Plano Básico)</label>
                <input
                  type="text"
                  value={newPlanData.name}
                  onChange={(e) => setNewPlanData({ ...newPlanData, name: e.target.value })}
                  className="mt-1 block w-full p-2 bg-gray-700 border border-gray-600 rounded-md text-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300">Máximo de CNPJs</label>
                <input
                  type="number"
                  value={newPlanData.maxCnpjs}
                  onChange={(e) => setNewPlanData({ ...newPlanData, maxCnpjs: Number(e.target.value) })}
                  className="mt-1 block w-full p-2 bg-gray-700 border border-gray-600 rounded-md text-white"
                />
              </div>
              {!newPlanData.unlimitedUsers && (
                <div>
                  <label className="block text-sm font-medium text-gray-300">Número de Usuários</label>
                  <input
                    type="number"
                    value={newPlanData.users}
                    onChange={(e) => setNewPlanData({ ...newPlanData, users: Number(e.target.value) })}
                    className="mt-1 block w-full p-2 bg-gray-700 border border-gray-600 rounded-md text-white"
                  />
                </div>
              )}
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={newPlanData.unlimitedUsers}
                  onChange={(e) => setNewPlanData({ ...newPlanData, unlimitedUsers: e.target.checked })}
                  className="h-4 w-4 text-blue-600 border-gray-300 rounded"
                />
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
