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
function generateToken(length = 32) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

// ── Componente principal ──────────────────────────────────────
export default function Chat() {
  const router = useRouter()
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [cfg, setCfg] = useState(DEFAULT_CFG)
  const [empresaId, setEmpresaId] = useState(null)
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [showConfig, setShowConfig] = useState(false)
  const [showClientModal, setShowClientModal] = useState(false)
  const [showEditClientModal, setShowEditClientModal] = useState(false)
  const [currentClient, setCurrentClient] = useState(null)
  const [showContractPreview, setShowContractPreview] = useState(false)
  const [contractData, setContractData] = useState(null)
  const [showAddPlanModal, setShowAddPlanModal] = useState(false)
  const [newPlanData, setNewPlanData] = useState({ id: '', name: '', maxCnpjs: 0, users: 1, unlimitedUsers: false })
  const [showAdminPanel, setShowAdminPanel] = useState(false)
  const [adminPassword, setAdminPassword] = useState('')
  const [adminError, setAdminError] = useState('')
  const [showReportsModal, setShowReportsModal] = useState(false)
  const chatContainerRef = useRef(null)

  // ── Autenticação e Carregamento de Configurações ──────────
  useEffect(() => {
    async function checkUser() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/')
      } else {
        setUser(user)
        fetchConfig(user.id)
      }
      setLoading(false)
    }
    checkUser()

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        setUser(session.user)
        fetchConfig(session.user.id)
      } else {
        setUser(null)
        router.push('/')
      }
    })

    return () => {
      authListener.subscription.unsubscribe()
    }
  }, [])

  const fetchConfig = async (userId) => {
    const { data, error } = await supabase
      .from('empresas')
      .select('*')
      .eq('user_id', userId)
      .single()

    if (error && error.code !== 'PGRST116') { // PGRST116 = no rows found
      console.error('Erro ao buscar configurações da empresa:', error)
    } else if (data) {
      setEmpresaId(data.id)
      const parsedCfg = { ...DEFAULT_CFG, ...data.config }
      setCfg(parsedCfg)
      if (parsedCfg.clients) {
        setMessages(prev => [...prev, { from: 'bot', text: `Olá ${user?.email || 'consultor'}! Tenho ${parsedCfg.clients.length} clientes cadastrados. Como posso ajudar hoje?` }])
      } else {
        setMessages(prev => [...prev, { from: 'bot', text: `Olá ${user?.email || 'consultor'}! Como posso ajudar hoje?` }])
      }
    } else {
      // Create default config for new user
      const { data: newCompany, error: newCompanyError } = await supabase
        .from('empresas')
        .insert([{ user_id: userId, config: DEFAULT_CFG }])
        .select()
        .single()

      if (newCompanyError) {
        console.error('Erro ao criar configuração padrão:', newCompanyError)
      } else {
        setEmpresaId(newCompany.id)
        setCfg(DEFAULT_CFG)
        setMessages(prev => [...prev, { from: 'bot', text: `Olá ${user?.email || 'consultor'}! Como posso ajudar hoje?` }])
      }
    }
  }

  // ── Scroll para o final do chat ───────────────────────────
  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight
    }
  }, [messages])

  // ── Lógica do Chat ─────────────────────────────────────────
  const handleSendMessage = async () => {
    if (input.trim() === '') return

    const userMessage = { from: 'user', text: input }
    setMessages(prev => [...prev, userMessage])
    setInput('')

    // Processar a mensagem do usuário
    const response = await processUserMessage(input)
    setMessages(prev => [...prev, { from: 'bot', text: response }])
  }

  const processUserMessage = async (message) => {
    const lowerMessage = message.toLowerCase()

    // 1. Gerar Proposta
    if (lowerMessage.includes('gerar proposta') || lowerMessage.includes('fazer proposta')) {
      return handleGenerateProposal()
    }

    // 2. Gerar Contrato
    if (lowerMessage.includes('gerar contrato') || lowerMessage.includes('fazer contrato')) {
      return handleGenerateContract()
    }

    // 3. Salvar Cliente
    if (lowerMessage.includes('salvar cliente') || lowerMessage.includes('cadastrar cliente')) {
      setShowClientModal(true)
      return 'Certo, vamos cadastrar um novo cliente. Por favor, preencha os dados.'
    }

    // 4. Buscar Cliente
    if (lowerMessage.includes('buscar cliente') || lowerMessage.includes('procurar cliente')) {
      const doc = clean(message.match(/\d+/g)?.join('') || '')
      if (doc) {
        return handleSearchClient(doc)
      }
      return 'Por favor, informe o CPF ou CNPJ do cliente que deseja buscar.'
    }

    // 5. Editar Cliente
    if (lowerMessage.includes('editar cliente')) {
      const doc = clean(message.match(/\d+/g)?.join('') || '')
      if (doc) {
        return handleEditClient(doc)
      }
      return 'Por favor, informe o CPF ou CNPJ do cliente que deseja editar.'
    }

    // 6. Limpar Chat
    if (lowerMessage.includes('limpar chat') || lowerMessage.includes('nova consulta')) {
      setMessages([])
      return 'Chat limpo. Como posso ajudar agora?'
    }

    // 7. Abrir Configurações
    if (lowerMessage.includes('configurações') || lowerMessage.includes('config')) {
      setShowConfig(true)
      return 'Abrindo configurações...'
    }

    // 8. Abrir Relatórios
    if (lowerMessage.includes('relatórios') || lowerMessage.includes('reports')) {
      setShowReportsModal(true)
      return 'Abrindo relatórios...'
    }

    // 9. Abrir Painel Master
    if (lowerMessage.includes('painel master') || lowerMessage.includes('admin')) {
      setShowAdminPanel(true)
      setAdminPassword('')
      setAdminError('')
      return 'Abrindo painel master...'
    }

    // Resposta padrão
    return 'Desculpe, não entendi. Posso gerar uma proposta, um contrato, salvar/buscar/editar clientes, limpar o chat, ou abrir as configurações/relatórios/painel master.'
  }

  // ── Funções de Cliente ──────────────────────────────────────
  const handleSearchClient = async (doc) => {
    const client = cfg.clients.find(c => clean(c.doc) === doc)
    if (client) {
      setCurrentClient(client)
      setShowEditClientModal(true)
      return `Cliente ${client.name} (${fmtDoc(client.doc)}) encontrado. Abrindo para edição.`
    }
    return `Cliente com documento ${fmtDoc(doc)} não encontrado.`
  }

  const handleEditClient = async (doc) => {
    const client = cfg.clients.find(c => clean(c.doc) === doc)
    if (client) {
      setCurrentClient(client)
      setShowEditClientModal(true)
      return `Cliente ${client.name} (${fmtDoc(client.doc)}) encontrado. Abrindo para edição.`
    }
    return `Cliente com documento ${fmtDoc(doc)} não encontrado.`
  }

  const handleSaveClient = async (clientData) => {
    const existingClientIndex = cfg.clients.findIndex(c => clean(c.doc) === clean(clientData.doc))
    let updatedClients = []

    if (existingClientIndex > -1) {
      updatedClients = cfg.clients.map((c, i) => i === existingClientIndex ? clientData : c)
    } else {
      updatedClients = [...cfg.clients, clientData]
    }

    const { error } = await supabase
      .from('empresas')
      .update({ config: { ...cfg, clients: updatedClients } })
      .eq('id', empresaId)

    if (error) {
      console.error('Erro ao salvar cliente:', error)
      return 'Erro ao salvar cliente.'
    }

    setCfg(prev => ({ ...prev, clients: updatedClients }))
    setShowClientModal(false)
    setShowEditClientModal(false)
    setCurrentClient(null)
    return `Cliente ${clientData.name} salvo com sucesso!`
  }

  // ── Funções de Proposta/Contrato ──────────────────────────
  const handleGenerateProposal = async () => {
    // Lógica para coletar dados da proposta (ex: perguntar ao usuário)
    // Por enquanto, vamos usar dados mock
    const proposalData = {
      clientName: 'Cliente Teste Proposta',
      clientDoc: '11.222.333/0001-44',
      modules: ['Gestão Fiscal', 'BIA'],
      cnpjs: 10,
      planId: 'pro',
      totalAdesao: 1500,
      totalMensalidade: 800,
      consultorName: user?.user_metadata?.full_name || 'Consultor Vivanexa',
      consultorEmail: user?.email,
      date: new Date().toLocaleDateString('pt-BR'),
      companyName: cfg.company,
      companyLogo: cfg.companyLogo,
      proposalTemplate: cfg.proposalTemplate,
      contractTemplate: cfg.contractTemplate, // Incluir para referência futura
    }

    const proposalHtml = buildProposal(proposalData)
    setContractData({ ...proposalData, html: proposalHtml, type: 'proposal' })
    setShowContractPreview(true)
    return 'Proposta gerada. Revise e envie para o cliente.'
  }

  const handleGenerateContract = async () => {
    // Lógica para coletar dados do contrato (ex: perguntar ao usuário)
    // Por enquanto, vamos usar dados mock
    const contractDetails = {
      clientName: 'Cliente Teste Contrato',
      clientDoc: '55.666.777/0001-88',
      clientEmail: 'cliente@teste.com',
      modules: ['Gestão Fiscal', 'XML', 'CND'],
      cnpjs: 25,
      planId: 'top',
      totalAdesao: 2000,
      totalMensalidade: 1200,
      consultorName: user?.user_metadata?.full_name || 'Consultor Vivanexa',
      consultorEmail: user?.email,
      date: new Date().toLocaleDateString('pt-BR'),
      companyName: cfg.company,
      companyLogo: cfg.companyLogo,
      contractTemplate: cfg.contractTemplate,
      proposalTemplate: cfg.proposalTemplate, // Incluir para referência futura
      paymentConditionAdesao: 'PIX ou Boleto à vista',
      paymentConditionMensalidade: 'Boleto mensal',
      dueDateAdesao: '10/04/2026',
      dueDateMensalidade: '15/04/2026',
      // Adicionar campos para assinaturas
      consultorSignature: user?.user_metadata?.signature_url || null, // URL da imagem da assinatura do consultor
      clientSignature: null, // Será preenchido após a assinatura
      consultorSignedAt: null,
      clientSignedAt: null,
      consultorSignedIp: null,
      clientSignedIp: null,
      consultorSignedCpf: null,
      clientSignedCpf: null,
      consultorSignedEmail: null,
      clientSignedEmail: null,
      token: generateToken(), // Token único para o link de assinatura
    }

    const contractHtml = buildContract(contractDetails)
    setContractData({ ...contractDetails, html: contractHtml, type: 'contract' })
    setShowContractPreview(true)
    return 'Contrato gerado. Revise e envie para o cliente para assinatura.'
  }

  const handleSendContract = async (data) => {
    if (!data || data.type !== 'contract') {
      setMessages(prev => [...prev, { from: 'bot', text: 'Erro: Não há dados de contrato para enviar.' }])
      return
    }

    setMessages(prev => [...prev, { from: 'bot', text: 'Enviando contrato para assinatura...' }])

    try {
      // 1. Salvar o contrato no histórico de documentos
      const { data: docData, error: docError } = await supabase
        .from('documentos')
        .insert([{
          empresa_id: empresaId,
          tipo: 'contrato',
          titulo: `Contrato - ${data.clientName} (${fmtDoc(data.clientDoc)})`,
          conteudo_html: data.html,
          status: 'aguardando_assinatura',
          token_assinatura: data.token,
          dados_contrato: data, // Salva todos os dados do contrato para referência
        }])
        .select()
        .single()

      if (docError) {
        console.error('Erro ao salvar documento:', docError)
        setMessages(prev => [...prev, { from: 'bot', text: `Erro ao salvar o contrato: ${docError.message}` }])
        return
      }

      const signatureLink = `${window.location.origin}/sign/${data.token}`

      // 2. Enviar e-mail para o cliente com o link de assinatura
      const emailHtml = `
        <p>Prezado(a) ${data.clientName},</p>
        <p>Seu contrato com a ${data.companyName} está pronto para ser assinado eletronicamente.</p>
        <p>Por favor, clique no link abaixo para revisar e assinar o documento:</p>
        <p><a href="${signatureLink}">${signatureLink}</a></p>
        <p>Atenciosamente,</p>
        <p>${data.consultorName}</p>
        <p>${data.companyName}</p>
      `

      const emailResponse = await fetch('/api/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: data.clientEmail,
          subject: `Contrato para Assinatura - ${data.companyName}`,
          html: emailHtml,
          config: cfg.emailConfig, // Assumindo que as configurações de e-mail estão em cfg.emailConfig
        }),
      })

      if (!emailResponse.ok) {
        const errorData = await emailResponse.json()
        throw new Error(errorData.error || 'Erro ao enviar e-mail.')
      }

      setMessages(prev => [...prev, { from: 'bot', text: `Contrato enviado com sucesso para ${data.clientEmail}. O cliente receberá um e-mail com o link para assinatura.` }])
      setShowContractPreview(false)

    } catch (error) {
      console.error('Erro ao enviar contrato:', error)
      setMessages(prev => [...prev, { from: 'bot', text: `Falha ao enviar contrato: ${error.message}` }])
    }
  }

  // Nova função para gerar PDF e enviar e-mail com anexo
  const generatePdfAndSendEmail = async (contractDetails, clientEmail, consultorEmail, emailConfig) => {
    try {
      // 1. Gerar o PDF do contrato
      const pdfResponse = await fetch('/api/generate-pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ htmlContent: buildContract(contractDetails) }), // Usa o HTML final do contrato
      });

      if (!pdfResponse.ok) {
        const errorData = await pdfResponse.json();
        throw new Error(errorData.error || 'Erro ao gerar PDF do contrato.');
      }

      const pdfBlob = await pdfResponse.blob();
      const reader = new FileReader();
      reader.readAsDataURL(pdfBlob);

      reader.onloadend = async () => {
        const base64Pdf = reader.result.split(',')[1]; // Extrai o base64

        // 2. Enviar e-mail com o PDF anexado
        const emailSubject = `Contrato Assinado - ${contractDetails.companyName} - ${contractDetails.clientName}`;
        const emailHtml = `
          <p>Prezado(a) ${contractDetails.clientName},</p>
          <p>Seu contrato com a ${contractDetails.companyName} foi assinado por ambas as partes e está anexado a este e-mail.</p>
          <p>Agradecemos a sua confiança!</p>
          <p>Atenciosamente,</p>
          <p>${contractDetails.consultorName}</p>
          <p>${contractDetails.companyName}</p>
        `;

        const attachments = [{
          filename: `contrato_${contractDetails.clientName.replace(/\s/g, '_')}.pdf`,
          content: base64Pdf,
          encoding: 'base64',
          contentType: 'application/pdf',
        }];

        const sendEmailResponse = await fetch('/api/send-email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            to: clientEmail,
            bcc: consultorEmail, // Envia uma cópia para o consultor
            subject: emailSubject,
            html: emailHtml,
            config: emailConfig,
            attachments: attachments,
          }),
        });

        if (!sendEmailResponse.ok) {
          const errorData = await sendEmailResponse.json();
          throw new Error(errorData.error || 'Erro ao enviar e-mail com o contrato assinado.');
        }

        setMessages(prev => [...prev, { from: 'bot', text: `Contrato assinado enviado por e-mail para ${clientEmail} e ${consultorEmail}.` }]);
      };

    } catch (error) {
      console.error('Erro no fluxo de PDF e e-mail:', error);
      setMessages(prev => [...prev, { from: 'bot', text: `Falha ao gerar PDF ou enviar e-mail do contrato assinado: ${error.message}` }]);
    }
  };


  // ── Construtor de HTML para Proposta/Contrato ─────────────
  const buildProposal = (data) => {
    const {
      clientName, clientDoc, modules, cnpjs, planId,
      totalAdesao, totalMensalidade, consultorName, date,
      companyName, companyLogo, proposalTemplate
    } = data

    const productsHtml = modules.map(mod => {
      const [adesao, mensalidade] = getPrice(mod, planId, cfg)
      return `
        <tr>
          <td>${pn(mod, cfg)}</td>
          <td>${fmt(adesao)}</td>
          <td>${fmt(mensalidade)}</td>
        </tr>
      `
    }).join('')

    const logoHtml = companyLogo ? `<img src="${companyLogo}" alt="${companyName} Logo" style="max-width: 150px; margin-bottom: 20px;">` : `<h2>${companyName}</h2>`;

    const templateContent = proposalTemplate || `
      <p>Prezado(a) ${clientName},</p>
      <p>Apresentamos a seguir a proposta comercial para os serviços da ${companyName}.</p>
      <p><strong>Cliente:</strong> ${clientName} (${fmtDoc(clientDoc)})</p>
      <p><strong>Data:</strong> ${date}</p>
      <p><strong>Consultor:</strong> ${consultorName}</p>
      <h3>Serviços Contratados:</h3>
      <table style="width:100%; border-collapse: collapse; margin-bottom: 20px;">
        <thead>
          <tr style="background-color:#f2f2f2;">
            <th style="padding: 8px; border: 1px solid #ddd; text-align: left;">Módulo</th>
            <th style="padding: 8px; border: 1px solid #ddd; text-align: left;">Adesão</th>
            <th style="padding: 8px; border: 1px solid #ddd; text-align: left;">Mensalidade</th>
          </tr>
        </thead>
        <tbody>
          ${productsHtml}
        </tbody>
        <tfoot>
          <tr>
            <td style="padding: 8px; border: 1px solid #ddd; text-align: right; font-weight: bold;">Total:</td>
            <td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">${fmt(totalAdesao)}</td>
            <td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">${fmt(totalMensalidade)}</td>
          </tr>
        </tfoot>
      </table>
      <p>Esta proposta é válida por 7 dias.</p>
      <p>Aguardamos seu contato para formalizarmos esta parceria.</p>
      <p>Atenciosamente,</p>
      <p>${consultorName}</p>
      <p>${companyName}</p>
    `;

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Proposta Comercial - ${companyName}</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 40px; }
          .container { max-width: 800px; margin: auto; background: #fff; padding: 30px; border: 1px solid #ddd; }
          h1, h2, h3 { color: #0056b3; }
          table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
          th, td { padding: 8px; border: 1px solid #ddd; text-align: left; }
          th { background-color: #f2f2f2; }
          .footer { margin-top: 40px; font-size: 0.9em; text-align: center; color: #777; }
        </style>
      </head>
      <body>
        <div class="container">
          <div style="text-align: center;">
            ${logoHtml}
          </div>
          <h1>Proposta Comercial</h1>
          ${templateContent}
          <div class="footer">
            <p>${companyName} - ${new Date().getFullYear()}</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  const buildContract = (data) => {
    const {
      clientName, clientDoc, clientEmail, modules, cnpjs, planId,
      totalAdesao, totalMensalidade, consultorName, consultorEmail, date,
      companyName, companyLogo, contractTemplate,
      paymentConditionAdesao, paymentConditionMensalidade,
      dueDateAdesao, dueDateMensalidade,
      consultorSignature, clientSignature,
      consultorSignedAt, clientSignedAt,
      consultorSignedIp, clientSignedIp,
      consultorSignedCpf, clientSignedCpf,
      consultorSignedEmail, clientSignedEmail,
    } = data

    const productsHtml = modules.map(mod => {
      const [adesao, mensalidade] = getPrice(mod, planId, cfg)
      return `
        <tr>
          <td>${pn(mod, cfg)}</td>
          <td>${fmt(adesao)}</td>
          <td>${fmt(mensalidade)}</td>
        </tr>
      `
    }).join('')

    const logoHtml = companyLogo ? `<img src="${companyLogo}" alt="${companyName} Logo" style="max-width: 150px; margin-bottom: 20px;">` : `<h2>${companyName}</h2>`;

    const consultorSignatureHtml = consultorSignature ? `
      <div style="margin-top: 30px; text-align: center;">
        <img src="${consultorSignature}" alt="Assinatura do Consultor" style="max-width: 200px; border-bottom: 1px solid #000; padding-bottom: 5px;">
        <p style="margin-top: 5px; font-size: 0.9em;">${consultorName}</p>
        <p style="font-size: 0.8em; color: #555;">Consultor(a) ${companyName}</p>
        ${consultorSignedCpf ? `<p style="font-size: 0.8em; color: #555;">CPF: ${fmtDoc(consultorSignedCpf)}</p>` : ''}
        ${consultorSignedEmail ? `<p style="font-size: 0.8em; color: #555;">Email: ${consultorSignedEmail}</p>` : ''}
        ${consultorSignedAt ? `<p style="font-size: 0.8em; color: #555;">Data/Hora: ${new Date(consultorSignedAt).toLocaleString('pt-BR')}</p>` : ''}
        ${consultorSignedIp ? `<p style="font-size: 0.8em; color: #555;">IP: ${consultorSignedIp}</p>` : ''}
      </div>
    ` : `
      <div style="margin-top: 30px; text-align: center; border-bottom: 1px solid #000; padding-bottom: 5px; width: 200px; margin-left: auto; margin-right: auto;">
        <p style="margin-top: 5px; font-size: 0.9em;">${consultorName}</p>
        <p style="font-size: 0.8em; color: #555;">Consultor(a) ${companyName}</p>
      </div>
    `;

    const clientSignatureHtml = clientSignature ? `
      <div style="margin-top: 30px; text-align: center;">
        <img src="${clientSignature}" alt="Assinatura do Cliente" style="max-width: 200px; border-bottom: 1px solid #000; padding-bottom: 5px;">
        <p style="margin-top: 5px; font-size: 0.9em;">${clientName}</p>
        <p style="font-size: 0.8em; color: #555;">Cliente</p>
        ${clientSignedCpf ? `<p style="font-size: 0.8em; color: #555;">CPF: ${fmtDoc(clientSignedCpf)}</p>` : ''}
        ${clientSignedEmail ? `<p style="font-size: 0.8em; color: #555;">Email: ${clientSignedEmail}</p>` : ''}
        ${clientSignedAt ? `<p style="font-size: 0.8em; color: #555;">Data/Hora: ${new Date(clientSignedAt).toLocaleString('pt-BR')}</p>` : ''}
        ${clientSignedIp ? `<p style="font-size: 0.8em; color: #555;">IP: ${clientSignedIp}</p>` : ''}
      </div>
    ` : `
      <div style="margin-top: 30px; text-align: center; border-bottom: 1px solid #000; padding-bottom: 5px; width: 200px; margin-left: auto; margin-right: auto;">
        <p style="margin-top: 5px; font-size: 0.9em;">${clientName}</p>
        <p style="font-size: 0.8em; color: #555;">Cliente</p>
      </div>
    `;

    const templateContent = contractTemplate || `
      <p>Este Contrato de Prestação de Serviços é celebrado entre:</p>
      <p><strong>CONTRATADA:</strong> ${companyName}, com sede em [Endereço da Empresa], inscrita no CNPJ sob o nº [CNPJ da Empresa].</p>
      <p><strong>CONTRATANTE:</strong> ${clientName}, ${isCNPJ(clean(clientDoc)) ? 'pessoa jurídica' : 'pessoa física'}, inscrita no ${isCNPJ(clean(clientDoc)) ? 'CNPJ' : 'CPF'} sob o nº ${fmtDoc(clientDoc)}, com e-mail ${clientEmail}.</p>

      <h3>Objeto do Contrato:</h3>
      <p>A CONTRATADA prestará à CONTRATANTE os seguintes serviços:</p>
      <table style="width:100%; border-collapse: collapse; margin-bottom: 20px;">
        <thead>
          <tr style="background-color:#f2f2f2;">
            <th style="padding: 8px; border: 1px solid #ddd; text-align: left;">Módulo</th>
            <th style="padding: 8px; border: 1px solid #ddd; text-align: left;">Adesão</th>
            <th style="padding: 8px; border: 1px solid #ddd; text-align: left;">Mensalidade</th>
          </tr>
        </thead>
        <tbody>
          ${productsHtml}
        </tbody>
        <tfoot>
          <tr>
            <td style="padding: 8px; border: 1px solid #ddd; text-align: right; font-weight: bold;">Total:</td>
            <td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">${fmt(totalAdesao)}</td>
            <td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">${fmt(totalMensalidade)}</td>
          </tr>
        </tfoot>
      </table>

      <h3>Condições de Pagamento:</h3>
      <p><strong>Adesão:</strong> ${paymentConditionAdesao} - Vencimento: ${dueDateAdesao}</p>
      <p><strong>Mensalidade:</strong> ${paymentConditionMensalidade} - Vencimento: ${dueDateMensalidade}</p>

      <h3>Disposições Gerais:</h3>
      <p>Este contrato entra em vigor na data de sua assinatura e terá prazo de 12 (doze) meses, renovável automaticamente por iguais períodos, salvo manifestação em contrário de qualquer das partes com antecedência mínima de 30 (trinta) dias.</p>
      <p>Fica eleito o foro da comarca de [Cidade/Estado da Empresa] para dirimir quaisquer dúvidas ou litígios decorrentes deste contrato.</p>

      <p>E, por estarem assim justos e contratados, as partes assinam o presente instrumento eletronicamente.</p>

      <div style="display: flex; justify-content: space-around; margin-top: 50px;">
        ${consultorSignatureHtml}
        ${clientSignatureHtml}
      </div>
      <p style="text-align: center; margin-top: 20px; font-size: 0.8em; color: #777;">
        Documento assinado eletronicamente conforme Lei nº 14.063/2020.
      </p>
    `;

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Contrato de Prestação de Serviços - ${companyName}</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 40px; }
          .container { max-width: 800px; margin: auto; background: #fff; padding: 30px; border: 1px solid #ddd; }
          h1, h2, h3 { color: #0056b3; }
          table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
          th, td { padding: 8px; border: 1px solid #ddd; text-align: left; }
          th { background-color: #f2f2f2; }
          .footer { margin-top: 40px; font-size: 0.9em; text-align: center; color: #777; }
        </style>
      </head>
      <body>
        <div class="container">
          <div style="text-align: center;">
            ${logoHtml}
          </div>
          <h1>Contrato de Prestação de Serviços</h1>
          <p style="text-align: right; font-size: 0.9em;">${date}</p>
          ${templateContent}
          <div class="footer">
            <p>${companyName} - ${new Date().getFullYear()}</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  // ── Renderização do Componente ────────────────────────────
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-900 text-white">
        Carregando...
      </div>
    )
  }

  return (
    <div className="flex flex-col h-screen bg-gray-900 text-white">
      <Head>
        <title>{cfg.company} - Assistente Comercial</title>
        <link rel="icon" href="/favicon.ico" />
      </Head>

      {/* Header */}
      <header className="flex items-center justify-between p-4 bg-gray-800 shadow-md">
        <div className="flex items-center cursor-pointer" onClick={() => router.push('/chat')}>
          {cfg.companyLogo && <img src={cfg.companyLogo} alt="Logo" className="h-8 mr-3" />}
          <h1 className="text-xl font-bold">{cfg.company}</h1>
        </div>
        <nav className="flex items-center space-x-4">
          <button onClick={() => setShowReportsModal(true)} className="text-gray-300 hover:text-white">📊 Relatórios</button>
          <button onClick={() => setShowConfig(true)} className="text-gray-300 hover:text-white">⚙️ Configurações</button>
          <button onClick={async () => { await supabase.auth.signOut(); router.push('/'); }} className="text-red-400 hover:text-red-300">Sair</button>
        </nav>
      </header>

      {/* Main Chat Area */}
      <main className="flex-1 flex overflow-hidden">
        {/* Sidebar (optional, can be removed if not needed) */}
        {/* <aside className="w-64 bg-gray-800 p-4 border-r border-gray-700">
          <h2 className="text-lg font-semibold mb-4">Menu</h2>
          <ul>
            <li className="mb-2"><a href="#" className="text-gray-300 hover:text-white">Dashboard</a></li>
            <li className="mb-2"><a href="#" className="text-gray-300 hover:text-white">Clientes</a></li>
            <li className="mb-2"><a href="#" className="text-gray-300 hover:text-white">Documentos</a></li>
          </ul>
        </aside> */}

        {/* Chat Content */}
        <div className="flex-1 flex flex-col p-4 overflow-hidden">
          <div ref={chatContainerRef} className="flex-1 overflow-y-auto p-4 bg-gray-800 rounded-lg shadow-inner mb-4 custom-scrollbar">
            {messages.map((msg, index) => (
              <div key={index} className={`mb-4 ${msg.from === 'user' ? 'text-right' : 'text-left'}`}>
                <span className={`inline-block p-3 rounded-lg ${msg.from === 'user' ? 'bg-blue-600' : 'bg-gray-700'}`}>
                  {msg.text}
                </span>
              </div>
            ))}
          </div>

          {/* Input Area */}
          <div className="flex items-center p-4 bg-gray-800 rounded-lg shadow-md">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
              placeholder="Digite sua mensagem..."
              className="flex-1 p-3 rounded-lg bg-gray-700 border border-gray-600 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              onClick={handleSendMessage}
              className="ml-4 px-6 py-3 bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              Enviar
            </button>
          </div>
        </div>
      </main>

      {/* Config Modal */}
      {showConfig && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 p-8 rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto relative">
            <h3 className="text-2xl font-bold mb-6 text-center">⚙️ Configurações</h3>
            <button onClick={() => setShowConfig(false)} className="absolute top-4 right-4 text-gray-400 hover:text-white text-2xl">✕</button>

            {/* Configurações da Empresa */}
            <div className="mb-8 p-6 bg-gray-700 rounded-lg">
              <h4 className="font-semibold mb-3">🏢 Identidade Visual</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300">Nome da Empresa</label>
                  <input
                    type="text"
                    value={cfg.company}
                    onChange={(e) => setCfg(prev => ({ ...prev, company: e.target.value }))}
                    className="mt-1 block w-full p-2 bg-gray-900 border border-gray-600 rounded-md text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300">Slogan / Subtítulo</label>
                  <input
                    type="text"
                    value={cfg.slogan}
                    onChange={(e) => setCfg(prev => ({ ...prev, slogan: e.target.value }))}
                    className="mt-1 block w-full p-2 bg-gray-900 border border-gray-600 rounded-md text-white"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300">Logomarca (URL)</label>
                <input
                  type="text"
                  value={cfg.companyLogo || ''}
                  onChange={(e) => setCfg(prev => ({ ...prev, companyLogo: e.target.value }))}
                  placeholder="URL da imagem da logo (ex: https://exemplo.com/logo.png)"
                  className="mt-1 block w-full p-2 bg-gray-900 border border-gray-600 rounded-md text-white"
                />
                {cfg.companyLogo && <img src={cfg.companyLogo} alt="Logo Preview" className="mt-2 h-16" />}
              </div>
            </div>

            {/* Configurações de E-mail e Assinatura */}
            <div className="mb-8 p-6 bg-gray-700 rounded-lg">
              <h4 className="font-semibold mb-3">📧 Configurações de E-mail e Assinatura Eletrônica</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300">E-mail Remetente (SMTP User)</label>
                  <input
                    type="email"
                    value={cfg.emailConfig?.smtpUser || ''}
                    onChange={(e) => setCfg(prev => ({ ...prev, emailConfig: { ...prev.emailConfig, smtpUser: e.target.value } }))}
                    className="mt-1 block w-full p-2 bg-gray-900 border border-gray-600 rounded-md text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300">Senha do E-mail (SMTP Pass)</label>
                  <input
                    type="password"
                    value={cfg.emailConfig?.smtpPass || ''}
                    onChange={(e) => setCfg(prev => ({ ...prev, emailConfig: { ...prev.emailConfig, smtpPass: e.target.value } }))}
                    className="mt-1 block w-full p-2 bg-gray-900 border border-gray-600 rounded-md text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300">Host SMTP</label>
                  <input
                    type="text"
                    value={cfg.emailConfig?.smtpHost || ''}
                    onChange={(e) => setCfg(prev => ({ ...prev, emailConfig: { ...prev.emailConfig, smtpHost: e.target.value } }))}
                    className="mt-1 block w-full p-2 bg-gray-900 border border-gray-600 rounded-md text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300">Porta SMTP</label>
                  <input
                    type="number"
                    value={cfg.emailConfig?.smtpPort || 587}
                    onChange={(e) => setCfg(prev => ({ ...prev, emailConfig: { ...prev.emailConfig, smtpPort: Number(e.target.value) } }))}
                    className="mt-1 block w-full p-2 bg-gray-900 border border-gray-600 rounded-md text-white"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300">URL Base do Sistema (para links de assinatura)</label>
                <input
                  type="text"
                  value={cfg.baseUrl || ''}
                  onChange={(e) => setCfg(prev => ({ ...prev, baseUrl: e.target.value }))}
                  placeholder="Ex: https://seusistema.com"
                  className="mt-1 block w-full p-2 bg-gray-900 border border-gray-600 rounded-md text-white"
                />
              </div>
            </div>

            {/* Produtos e Planos */}
            <div className="mb-8 p-6 bg-gray-700 rounded-lg">
              <h4 className="font-semibold mb-3">📦 Produtos e Planos</h4>
              <div className="mb-4">
                <h5 className="text-lg font-medium mb-2">Planos Disponíveis</h5>
                <div className="overflow-x-auto">
                  <table className="min-w-full bg-gray-900 rounded-md">
                    <thead>
                      <tr>
                        <th className="py-2 px-4 border-b border-gray-600 text-left text-sm font-medium text-gray-300">Nome Exibido</th>
                        <th className="py-2 px-4 border-b border-gray-600 text-left text-sm font-medium text-gray-300">ID/Chave</th>
                        <th className="py-2 px-4 border-b border-gray-600 text-left text-sm font-medium text-gray-300">Max CNPJs</th>
                        <th className="py-2 px-4 border-b border-gray-600 text-left text-sm font-medium text-gray-300">Usuários</th>
                        <th className="py-2 px-4 border-b border-gray-600 text-left text-sm font-medium text-gray-300">Ações</th>
                      </tr>
                    </thead>
                    <tbody>
                      {cfg.plans.map((plan, index) => (
                        <tr key={plan.id} className="border-b border-gray-600 last:border-b-0">
                          <td className="py-2 px-4">{plan.name}</td>
                          <td className="py-2 px-4">{plan.id}</td>
                          <td className="py-2 px-4">{plan.maxCnpjs}</td>
                          <td className="py-2 px-4">{plan.unlimitedUsers ? 'Ilimitados' : plan.users}</td>
                          <td className="py-2 px-4">
                            <button
                              onClick={() => {
                                const updatedPlans = cfg.plans.filter((_, i) => i !== index);
                                setCfg(prev => ({ ...prev, plans: updatedPlans }));
                              }}
                              className="text-red-500 hover:text-red-700"
                            >
                              Remover
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <button onClick={() => setShowAddPlanModal(true)} className="mt-4 px-4 py-2 bg-green-600 rounded-lg hover:bg-green-700 transition-colors">
                  + Novo Plano
                </button>
              </div>

              <div className="mb-4">
                <h5 className="text-lg font-medium mb-2">Nomes de Produtos (Exibição)</h5>
                {Object.keys(cfg.productNames).map(key => (
                  <div key={key} className="flex items-center mb-2">
                    <label className="w-40 text-sm font-medium text-gray-300">{key}:</label>
                    <input
                      type="text"
                      value={cfg.productNames[key]}
                      onChange={(e) => setCfg(prev => ({
                        ...prev,
                        productNames: { ...prev.productNames, [key]: e.target.value }
                      }))}
                      className="ml-2 flex-1 p-2 bg-gray-900 border border-gray-600 rounded-md text-white"
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* Modelos de Documentos */}
            <div className="mb-8 p-6 bg-gray-700 rounded-lg">
              <h4 className="font-semibold mb-3">📄 Modelos de Documentos</h4>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-300">Modelo de Proposta Comercial (HTML)</label>
                <textarea
                  value={cfg.proposalTemplate || ''}
                  onChange={(e) => setCfg(prev => ({ ...prev, proposalTemplate: e.target.value }))}
                  rows="5"
                  className="mt-1 block w-full p-2 bg-gray-900 border border-gray-600 rounded-md text-white"
                  placeholder="Deixe em branco para usar o modelo padrão do sistema."
                ></textarea>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300">Modelo de Contrato (HTML)</label>
                <textarea
                  value={cfg.contractTemplate || ''}
                  onChange={(e) => setCfg(prev => ({ ...prev, contractTemplate: e.target.value }))}
                  rows="5"
                  className="mt-1 block w-full p-2 bg-gray-900 border border-gray-600 rounded-md text-white"
                  placeholder="Deixe em branco para usar o modelo padrão do sistema."
                ></textarea>
              </div>
            </div>

            {/* Botões de Ação */}
            <div className="flex justify-end space-x-4 mt-6">
              <button onClick={() => setShowConfig(false)} className="px-6 py-2 bg-gray-600 rounded-lg hover:bg-gray-700 transition-colors">Cancelar</button>
              <button onClick={async () => {
                const { error } = await supabase
                  .from('empresas')
                  .update({ config: cfg })
                  .eq('id', empresaId)
                if (error) {
                  console.error('Erro ao salvar configurações:', error)
                  setMessages(prev => [...prev, { from: 'bot', text: `Erro ao salvar configurações: ${error.message}` }])
                } else {
                  setMessages(prev => [...prev, { from: 'bot', text: 'Configurações salvas com sucesso!' }])
                  setShowConfig(false)
                }
              }} className="px-6 py-2 bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors">✅ Salvar Configurações</button>
            </div>
          </div>
        </div>
      )}

      {/* Client Modal (Add New Client) */}
      {showClientModal && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 p-8 rounded-lg shadow-xl w-full max-w-md relative">
            <h3 className="text-2xl font-bold mb-6 text-center">➕ Novo Cliente</h3>
            <button onClick={() => setShowClientModal(false)} className="absolute top-4 right-4 text-gray-400 hover:text-white text-2xl">✕</button>
            <ClientForm client={null} onSave={handleSaveClient} onCancel={() => setShowClientModal(false)} />
          </div>
        </div>
      )}

      {/* Client Modal (Edit Existing Client) */}
      {showEditClientModal && currentClient && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 p-8 rounded-lg shadow-xl w-full max-w-md relative">
            <h3 className="text-2xl font-bold mb-6 text-center">✏️ Editar Cliente</h3>
            <button onClick={() => setShowEditClientModal(false)} className="absolute top-4 right-4 text-gray-400 hover:text-white text-2xl">✕</button>
            <ClientForm client={currentClient} onSave={handleSaveClient} onCancel={() => setShowEditClientModal(false)} />
          </div>
        </div>
      )}

      {/* Contract Preview Modal */}
      {showContractPreview && contractData && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 p-8 rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto relative">
            <h3 className="text-2xl font-bold mb-6 text-center">{contractData.type === 'contract' ? '📝 Prévia do Contrato' : '📄 Prévia da Proposta'}</h3>
            <button onClick={() => setShowContractPreview(false)} className="absolute top-4 right-4 text-gray-400 hover:text-white text-2xl">✕</button>
            <iframe srcDoc={contractData.html} className="w-full h-[60vh] border border-gray-600 rounded-lg bg-white" title="Prévia do Contrato"></iframe>
            <div className="flex justify-end space-x-4 mt-6">
              {contractData.type === 'contract' && (
                <button onClick={() => handleSendContract(contractData)} className="px-6 py-2 bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors">📧 Enviar para Assinatura</button>
              )}
              <button onClick={() => setShowContractPreview(false)} className="px-6 py-2 bg-gray-600 rounded-lg hover:bg-gray-700 transition-colors">Fechar</button>
            </div>
          </div>
        </div>
      )}

      {/* Add Plan Modal */}
      {showAddPlanModal && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 p-8 rounded-lg shadow-xl w-full max-w-md relative">
            <h3 className="text-2xl font-bold mb-6 text-center">➕ Adicionar Novo Plano</h3>
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
                <label className="block text-sm font-medium text-gray-300">Nome Exibido (ex: Plano Basic)</label>
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

// ClientForm Component (needs to be defined outside the main Chat component or in its own file)
function ClientForm({ client, onSave, onCancel }) {
  const [formData, setFormData] = useState(client || {
    name: '', doc: '', email: '', phone: '', cep: '', address: '',
    neighborhood: '', city: '', state: '', contactCpf: '', taxRegime: '',
    implementationContact: { name: '', email: '', phone: '' },
    financialContact: { name: '', email: '', phone: '' },
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleNestedChange = (section, e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [section]: { ...prev[section], [name]: value }
    }));
  };

  const handleSave = () => {
    onSave(formData);
  };

  return (
    <div className="space-y-4 text-gray-300">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium">CPF / CNPJ</label>
          <input type="text" name="doc" value={formData.doc} onChange={handleChange} className="mt-1 block w-full p-2 bg-gray-900 border border-gray-600 rounded-md text-white" />
        </div>
        <div>
          <label className="block text-sm font-medium">Nome Fantasia / Nome</label>
          <input type="text" name="name" value={formData.name} onChange={handleChange} className="mt-1 block w-full p-2 bg-gray-900 border border-gray-600 rounded-md text-white" />
        </div>
        <div>
          <label className="block text-sm font-medium">Razão Social</label>
          <input type="text" name="companyName" value={formData.companyName || ''} onChange={handleChange} className="mt-1 block w-full p-2 bg-gray-900 border border-gray-600 rounded-md text-white" />
        </div>
        <div>
          <label className="block text-sm font-medium">Nome do Contato</label>
          <input type="text" name="contactName" value={formData.contactName || ''} onChange={handleChange} className="mt-1 block w-full p-2 bg-gray-900 border border-gray-600 rounded-md text-white" />
        </div>
        <div>
          <label className="block text-sm font-medium">E-mail</label>
          <input type="email" name="email" value={formData.email} onChange={handleChange} className="mt-1 block w-full p-2 bg-gray-900 border border-gray-600 rounded-md text-white" />
        </div>
        <div>
          <label className="block text-sm font-medium">Telefone / WhatsApp</label>
          <input type="text" name="phone" value={formData.phone} onChange={handleChange} className="mt-1 block w-full p-2 bg-gray-900 border border-gray-600 rounded-md text-white" />
        </div>
        <div>
          <label className="block text-sm font-medium">CEP</label>
          <input type="text" name="cep" value={formData.cep} onChange={handleChange} className="mt-1 block w-full p-2 bg-gray-900 border border-gray-600 rounded-md text-white" />
        </div>
        <div>
          <label className="block text-sm font-medium">Endereço</label>
          <input type="text" name="address" value={formData.address} onChange={handleChange} className="mt-1 block w-full p-2 bg-gray-900 border border-gray-600 rounded-md text-white" />
        </div>
        <div>
          <label className="block text-sm font-medium">Bairro</label>
          <input type="text" name="neighborhood" value={formData.neighborhood} onChange={handleChange} className="mt-1 block w-full p-2 bg-gray-900 border border-gray-600 rounded-md text-white" />
        </div>
        <div>
          <label className="block text-sm font-medium">Cidade</label>
          <input type="text" name="city" value={formData.city} onChange={handleChange} className="mt-1 block w-full p-2 bg-gray-900 border border-gray-600 rounded-md text-white" />
        </div>
        <div>
          <label className="block text-sm font-medium">Estado</label>
          <input type="text" name="state" value={formData.state} onChange={handleChange} className="mt-1 block w-full p-2 bg-gray-900 border border-gray-600 rounded-md text-white" />
        </div>
        <div>
          <label className="block text-sm font-medium">CPF do Contato Principal</label>
          <input type="text" name="contactCpf" value={formData.contactCpf} onChange={handleChange} className="mt-1 block w-full p-2 bg-gray-900 border border-gray-600 rounded-md text-white" />
        </div>
        <div>
          <label className="block text-sm font-medium">Regime Tributário</label>
          <select name="taxRegime" value={formData.taxRegime} onChange={handleChange} className="mt-1 block w-full p-2 bg-gray-900 border border-gray-600 rounded-md text-white">
            <option value="">Selecione...</option>
            <option value="Simples Nacional">Simples Nacional</option>
            <option value="Lucro Presumido">Lucro Presumido</option>
            <option value="Lucro Real">Lucro Real</option>
            <option value="MEI">MEI</option>
          </select>
        </div>
      </div>

      <h4 className="font-semibold mt-6 mb-2">👷 Responsável pela Implantação</h4>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium">Nome</label>
          <input type="text" name="name" value={formData.implementationContact.name} onChange={(e) => handleNestedChange('implementationContact', e)} className="mt-1 block w-full p-2 bg-gray-900 border border-gray-600 rounded-md text-white" />
        </div>
        <div>
          <label className="block text-sm font-medium">E-mail</label>
          <input type="email" name="email" value={formData.implementationContact.email} onChange={(e) => handleNestedChange('implementationContact', e)} className="mt-1 block w-full p-2 bg-gray-900 border border-gray-600 rounded-md text-white" />
        </div>
        <div>
          <label className="block text-sm font-medium">Telefone</label>
          <input type="text" name="phone" value={formData.implementationContact.phone} onChange={(e) => handleNestedChange('implementationContact', e)} className="mt-1 block w-full p-2 bg-gray-900 border border-gray-600 rounded-md text-white" />
        </div>
      </div>

      <h4 className="font-semibold mt-6 mb-2">💰 Responsável Financeiro</h4>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium">Nome</label>
          <input type="text" name="name" value={formData.financialContact.name} onChange={(e) => handleNestedChange('financialContact', e)} className="mt-1 block w-full p-2 bg-gray-900 border border-gray-600 rounded-md text-white" />
        </div>
        <div>
          <label className="block text-sm font-medium">E-mail</label>
          <input type="email" name="email" value={formData.financialContact.email} onChange={(e) => handleNestedChange('financialContact', e)} className="mt-1 block w-full p-2 bg-gray-900 border border-gray-600 rounded-md text-white" />
        </div>
        <div>
          <label className="block text-sm font-medium">Telefone</label>
          <input type="text" name="phone" value={formData.financialContact.phone} onChange={(e) => handleNestedChange('financialContact', e)} className="mt-1 block w-full p-2 bg-gray-900 border border-gray-600 rounded-md text-white" />
        </div>
      </div>

      <div className="flex justify-end space-x-4 mt-6">
        <button onClick={onCancel} className="px-6 py-2 bg-gray-600 rounded-lg hover:bg-gray-700 transition-colors">Cancelar</button>
        <button onClick={handleSave} className="px-6 py-2 bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors">✅ Salvar Cliente</button>
      </div>
    </div>
  );
}
