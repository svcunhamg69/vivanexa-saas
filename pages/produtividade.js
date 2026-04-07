// pages/produtividade.js — Vivanexa v5
// ✅ Simplificado: apenas Tarefas e Obrigações + Gestão MEI
// ✅ Gestão MEI completa implementada:
//    - Dashboard com faturamento, limite, alertas DAS
//    - Controle mensal de receitas (com geração de relatório)
//    - Painel de obrigações MEI (DAS-MEI + DASN-SIMEI)
//    - Upload de documentos (CCMEI, DAS, notas)
//    - Links para portais governamentais
//    - Alerta de limite de faturamento anual

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/router'
import Head from 'next/head'
import { supabase } from '../lib/supabase'
import Navbar from '../components/Navbar'

// ─── Constantes ───────────────────────────────────────────────────────────────
const STATUS_OBG  = ['Pendente', 'Em Andamento', 'Concluída', 'Atrasada']
const CATEGORIAS  = ['Federal', 'Estadual', 'Municipal']
const PERIODICIDADES = ['Mensal', 'Trimestral', 'Semestral', 'Anual']
const REGIMES = [
  { id:'simples',   label:'Simples Nacional' },
  { id:'presumido', label:'Lucro Presumido'  },
  { id:'real',      label:'Lucro Real'       },
  { id:'mei',       label:'MEI'              },
]
const MESES = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez']
const MESES_FULL = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro']

// Limite de faturamento anual MEI (2024/2025)
const LIMITE_MEI = 81000

// ─── Obrigações base por regime ───────────────────────────────────────────────
const OBRIGACOES_BASE = {
  simples: [
    { id:'das',          nome:'DAS – Documento de Arrecadação do Simples',       tipo:'Guia',       periodicidade:'Mensal',    dia_ideal:15, dia_atencao:18, dia_vencimento:20, categoria:'Federal'   },
    { id:'pgdas',        nome:'PGDAS-D – Programa Gerador do DAS',               tipo:'Declaração', periodicidade:'Mensal',    dia_ideal:15, dia_atencao:18, dia_vencimento:20, categoria:'Federal'   },
    { id:'fgts_s',       nome:'FGTS – Fundo de Garantia',                        tipo:'Guia',       periodicidade:'Mensal',    dia_ideal:5,  dia_atencao:6,  dia_vencimento:7,  categoria:'Federal'   },
    { id:'esocial_s',    nome:'eSocial – Folha de Pagamento',                    tipo:'Declaração', periodicidade:'Mensal',    dia_ideal:5,  dia_atencao:6,  dia_vencimento:7,  categoria:'Federal'   },
    { id:'dctf_s',       nome:'DCTF – Débitos e Créditos Tributários Federais',  tipo:'Declaração', periodicidade:'Mensal',    dia_ideal:10, dia_atencao:13, dia_vencimento:15, categoria:'Federal'   },
    { id:'defis',        nome:'DEFIS – Declaração Socioeconômica (Anual)',        tipo:'Declaração', periodicidade:'Anual',     mes_ref:3,    dia_ideal:25,   dia_atencao:28,    dia_vencimento:31, categoria:'Federal' },
    { id:'dirf_s',       nome:'DIRF – Declaração do IR Retido na Fonte (Anual)', tipo:'Declaração', periodicidade:'Anual',     mes_ref:2,    dia_ideal:20,   dia_atencao:25,    dia_vencimento:28, categoria:'Federal' },
    { id:'sped_ecd_s',   nome:'SPED ECD – Escrituração Contábil Digital (Anual)',tipo:'Declaração', periodicidade:'Anual',     mes_ref:6,    dia_ideal:20,   dia_atencao:27,    dia_vencimento:30, categoria:'Federal' },
  ],
  presumido: [
    { id:'irpj_p',       nome:'IRPJ – Imposto de Renda PJ (Trimestral)',         tipo:'Guia',       periodicidade:'Trimestral',dia_ideal:25, dia_atencao:28, dia_vencimento:31, categoria:'Federal'   },
    { id:'csll_p',       nome:'CSLL – Contribuição Social s/ Lucro Líquido',     tipo:'Guia',       periodicidade:'Trimestral',dia_ideal:25, dia_atencao:28, dia_vencimento:31, categoria:'Federal'   },
    { id:'pis_p',        nome:'PIS – Programa de Integração Social',             tipo:'Guia',       periodicidade:'Mensal',    dia_ideal:20, dia_atencao:23, dia_vencimento:25, categoria:'Federal'   },
    { id:'cofins_p',     nome:'COFINS – Contribuição p/ Financiamento da Seg.',  tipo:'Guia',       periodicidade:'Mensal',    dia_ideal:20, dia_atencao:23, dia_vencimento:25, categoria:'Federal'   },
    { id:'inss_p',       nome:'GPS – Guia da Previdência Social',                tipo:'Guia',       periodicidade:'Mensal',    dia_ideal:15, dia_atencao:18, dia_vencimento:20, categoria:'Federal'   },
    { id:'fgts_p',       nome:'FGTS – Fundo de Garantia',                        tipo:'Guia',       periodicidade:'Mensal',    dia_ideal:5,  dia_atencao:6,  dia_vencimento:7,  categoria:'Federal'   },
    { id:'dctf_p',       nome:'DCTF – Débitos e Créditos Tributários Federais',  tipo:'Declaração', periodicidade:'Mensal',    dia_ideal:10, dia_atencao:13, dia_vencimento:15, categoria:'Federal'   },
    { id:'esocial_p',    nome:'eSocial – Folha de Pagamento',                    tipo:'Declaração', periodicidade:'Mensal',    dia_ideal:5,  dia_atencao:6,  dia_vencimento:7,  categoria:'Federal'   },
    { id:'reinf_p',      nome:'EFD-REINF – Escrituração Fiscal de Retenções',   tipo:'Declaração', periodicidade:'Mensal',    dia_ideal:10, dia_atencao:13, dia_vencimento:15, categoria:'Federal'   },
    { id:'sped_ecd_p',   nome:'SPED ECD – Escrituração Contábil Digital (Anual)',tipo:'Declaração', periodicidade:'Anual',     mes_ref:6,    dia_ideal:20,   dia_atencao:27,    dia_vencimento:30, categoria:'Federal' },
    { id:'sped_ecf_p',   nome:'SPED ECF – Escrituração Contábil Fiscal (Anual)', tipo:'Declaração', periodicidade:'Anual',     mes_ref:7,    dia_ideal:20,   dia_atencao:28,    dia_vencimento:31, categoria:'Federal' },
    { id:'dirf_p',       nome:'DIRF – Declaração IR Retido na Fonte (Anual)',    tipo:'Declaração', periodicidade:'Anual',     mes_ref:2,    dia_ideal:20,   dia_atencao:25,    dia_vencimento:28, categoria:'Federal' },
    { id:'sped_fiscal_p',nome:'SPED EFD ICMS/IPI – Escrit. Fiscal Digital',     tipo:'Declaração', periodicidade:'Mensal',    dia_ideal:10, dia_atencao:13, dia_vencimento:15, categoria:'Estadual'  },
    { id:'gia_p',        nome:'GIA – Guia de Informação e Apuração do ICMS',    tipo:'Declaração', periodicidade:'Mensal',    dia_ideal:15, dia_atencao:18, dia_vencimento:20, categoria:'Estadual'  },
    { id:'iss_p',        nome:'ISS – Imposto Sobre Serviços',                    tipo:'Guia',       periodicidade:'Mensal',    dia_ideal:7,  dia_atencao:9,  dia_vencimento:10, categoria:'Municipal' },
  ],
  real: [
    { id:'irpj_r',       nome:'IRPJ – Estimativa Mensal',                        tipo:'Guia',       periodicidade:'Mensal',    dia_ideal:25, dia_atencao:28, dia_vencimento:31, categoria:'Federal'   },
    { id:'csll_r',       nome:'CSLL – Contribuição Social s/ Lucro Líquido',     tipo:'Guia',       periodicidade:'Mensal',    dia_ideal:25, dia_atencao:28, dia_vencimento:31, categoria:'Federal'   },
    { id:'pis_r',        nome:'PIS – Não Cumulativo',                            tipo:'Guia',       periodicidade:'Mensal',    dia_ideal:20, dia_atencao:23, dia_vencimento:25, categoria:'Federal'   },
    { id:'cofins_r',     nome:'COFINS – Não Cumulativa',                         tipo:'Guia',       periodicidade:'Mensal',    dia_ideal:20, dia_atencao:23, dia_vencimento:25, categoria:'Federal'   },
    { id:'inss_r',       nome:'GPS – Guia da Previdência Social',                tipo:'Guia',       periodicidade:'Mensal',    dia_ideal:15, dia_atencao:18, dia_vencimento:20, categoria:'Federal'   },
    { id:'fgts_r',       nome:'FGTS – Fundo de Garantia',                        tipo:'Guia',       periodicidade:'Mensal',    dia_ideal:5,  dia_atencao:6,  dia_vencimento:7,  categoria:'Federal'   },
    { id:'dctf_r',       nome:'DCTF – Débitos e Créditos Tributários Federais',  tipo:'Declaração', periodicidade:'Mensal',    dia_ideal:10, dia_atencao:13, dia_vencimento:15, categoria:'Federal'   },
    { id:'esocial_r',    nome:'eSocial – Folha de Pagamento',                    tipo:'Declaração', periodicidade:'Mensal',    dia_ideal:5,  dia_atencao:6,  dia_vencimento:7,  categoria:'Federal'   },
    { id:'reinf_r',      nome:'EFD-REINF – Escrituração Fiscal de Retenções',   tipo:'Declaração', periodicidade:'Mensal',    dia_ideal:10, dia_atencao:13, dia_vencimento:15, categoria:'Federal'   },
    { id:'sped_efd_r',   nome:'SPED EFD Contribuições',                          tipo:'Declaração', periodicidade:'Mensal',    dia_ideal:7,  dia_atencao:9,  dia_vencimento:10, categoria:'Federal'   },
    { id:'lalur_r',      nome:'LALUR – Livro de Apuração do Lucro Real (Anual)', tipo:'Livro Fiscal',periodicidade:'Anual',    mes_ref:6,    dia_ideal:20,   dia_atencao:27,    dia_vencimento:30, categoria:'Federal' },
    { id:'sped_ecd_r',   nome:'SPED ECD – Escrituração Contábil Digital (Anual)',tipo:'Declaração', periodicidade:'Anual',     mes_ref:6,    dia_ideal:20,   dia_atencao:27,    dia_vencimento:30, categoria:'Federal' },
    { id:'sped_ecf_r',   nome:'SPED ECF – Escrituração Contábil Fiscal (Anual)', tipo:'Declaração', periodicidade:'Anual',     mes_ref:7,    dia_ideal:20,   dia_atencao:28,    dia_vencimento:31, categoria:'Federal' },
    { id:'dirf_r',       nome:'DIRF – Declaração IR Retido na Fonte (Anual)',    tipo:'Declaração', periodicidade:'Anual',     mes_ref:2,    dia_ideal:20,   dia_atencao:25,    dia_vencimento:28, categoria:'Federal' },
    { id:'sped_fiscal_r',nome:'SPED EFD ICMS/IPI',                              tipo:'Declaração', periodicidade:'Mensal',    dia_ideal:10, dia_atencao:13, dia_vencimento:15, categoria:'Estadual'  },
    { id:'gia_r',        nome:'GIA – Guia de Informação e Apuração do ICMS',    tipo:'Declaração', periodicidade:'Mensal',    dia_ideal:15, dia_atencao:18, dia_vencimento:20, categoria:'Estadual'  },
    { id:'iss_r',        nome:'ISS – Imposto Sobre Serviços',                    tipo:'Guia',       periodicidade:'Mensal',    dia_ideal:7,  dia_atencao:9,  dia_vencimento:10, categoria:'Municipal' },
  ],
  mei: [
    { id:'das_mei',      nome:'DAS-MEI – Documento de Arrecadação MEI',          tipo:'Guia',       periodicidade:'Mensal',    dia_ideal:15, dia_atencao:18, dia_vencimento:20, categoria:'Federal'   },
    { id:'dasn',         nome:'DASN-SIMEI – Declaração Anual do MEI (Anual)',     tipo:'Declaração', periodicidade:'Anual',     mes_ref:5,    dia_ideal:25,   dia_atencao:28,    dia_vencimento:31, categoria:'Federal' },
    { id:'nota_mei',     nome:'Emissão de Notas Fiscais (quando aplicável)',      tipo:'Operacional',periodicidade:'Mensal',    dia_ideal:null,dia_atencao:null,dia_vencimento:null, categoria:'Municipal' },
  ],
}

const corStatus    = { 'Pendente':'#f59e0b', 'Em Andamento':'#00d4ff', 'Concluída':'#10b981', 'Atrasada':'#ef4444' }
const corCategoria = { 'Federal':'#00d4ff', 'Estadual':'#7c3aed', 'Municipal':'#f59e0b' }

// ─── Helpers ──────────────────────────────────────────────────────────────────
function gerarKey(clienteId, obgId, ano, mes) {
  return `${clienteId}_${obgId}_${ano}_${String(mes).padStart(2,'0')}`
}

function obgOcorreNoMes(obg, mes, ano) {
  if (obg.periodicidade === 'Mensal') return true
  if (obg.periodicidade === 'Trimestral') return [3,6,9,12].includes(mes)
  if (obg.periodicidade === 'Semestral') return [6,12].includes(mes)
  if (obg.periodicidade === 'Anual') return obg.mes_ref === mes
  return false
}

function gerarObrigacoesAnuais(cliente, obgExistentes, ano, customObgRegimes) {
  const regime = cliente.regime || 'simples'
  const obgBase = (customObgRegimes && customObgRegimes[regime]) || OBRIGACOES_BASE[regime] || []
  const novas = []
  for (let mes = 1; mes <= 12; mes++) {
    for (const obg of obgBase) {
      if (!obgOcorreNoMes(obg, mes, ano)) continue
      const key = gerarKey(cliente.id, obg.id, ano, mes)
      const jaExiste = obgExistentes.some(o => o.key === key)
      if (!jaExiste) {
        novas.push({
          key, clienteId: cliente.id, clienteNome: cliente.nome,
          clienteUF: cliente.uf || '', clienteMun: cliente.cidade || '',
          obgId: obg.id, obgNome: obg.nome, tipo: obg.tipo,
          categoria: obg.categoria, periodicidade: obg.periodicidade,
          dia_ideal: obg.dia_ideal, dia_atencao: obg.dia_atencao, dia_vencimento: obg.dia_vencimento,
          mes, ano, status: 'Pendente', dataConc: null, obs: '', usuarioId: cliente.usuarioId || null, isManual: false,
        })
      }
    }
  }
  return novas
}

function fmt(v) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0)
}

// ═════════════════════════════════════════════════════════════════════════════
export default function Produtividade() {
  const router  = useRouter()
  const { aba: abaQuery } = router.query

  const [loading,    setLoading]    = useState(true)
  const [cfg,        setCfg]        = useState({})
  const [empresaId,  setEmpresaId]  = useState(null)
  const [perfil,     setPerfil]     = useState(null)
  const [aba,        setAba]        = useState('tarefas')
  const [usuarios,   setUsuarios]   = useState([])

  // ── Tarefas / Obrigações ─────────────────────────────────────────────────
  const [clientes,     setClientes]     = useState([])
  const [obrigacoes,   setObrigacoes]   = useState([])
  const [anoRef,       setAnoRef]       = useState(new Date().getFullYear())
  const [mesRef,       setMesRef]       = useState(new Date().getMonth() + 1)
  const [saving,       setSaving]       = useState(false)
  const [msgSucesso,   setMsgSucesso]   = useState('')

  const [filtroCat,      setFiltroCat]      = useState('Todos')
  const [filtroStatus,   setFiltroStatus]   = useState('Todos')
  const [filtroCliente,  setFiltroCliente]  = useState('Todos')
  const [filtroUsuario,  setFiltroUsuario]  = useState('Todos')
  const [buscaTexto,     setBuscaTexto]     = useState('')
  const [drillDown,      setDrillDown]      = useState(null)
  const [showObgForm,    setShowObgForm]    = useState(false)
  const [formObg,        setFormObg]        = useState(null)
  const [showRegimeEdit, setShowRegimeEdit] = useState(false)
  const [regimeEditando, setRegimeEditando] = useState('simples')
  const [customObgRegimes, setCustomObgRegimes] = useState({})

  // ── MEI ──────────────────────────────────────────────────────────────────
  const [meiCliente,     setMeiCliente]     = useState(null)  // cliente MEI selecionado
  const [meiAno,         setMeiAno]         = useState(new Date().getFullYear())
  const [meiReceitas,    setMeiReceitas]    = useState({})    // { '2025_01': { comercio: 0, servicos: 0, notas: [] }, ... }
  const [meiDocs,        setMeiDocs]        = useState([])    // documentos uploaded
  const [meiSubAba,      setMeiSubAba]      = useState('dashboard')
  const [meiMesEdit,     setMeiMesEdit]     = useState(null)  // mês sendo editado
  const [meiFormRec,     setMeiFormRec]     = useState({ comercio: '', servicos: '', obs: '' })
  const [meiDasStatus,   setMeiDasStatus]   = useState({})    // { '2025_01': 'Pago'|'Pendente'|'Atrasado' }

  // ─── Init ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    async function init() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.replace('/'); return }

      let { data: perf } = await supabase.from('perfis').select('*').eq('user_id', session.user.id).maybeSingle()
      if (!perf) {
        const nome = session.user.email?.split('@')[0] || 'Usuário'
        const { data: np } = await supabase.from('perfis')
          .insert({ user_id: session.user.id, nome, email: session.user.email, empresa_id: session.user.id, perfil: 'admin' })
          .select().single()
        perf = np
      }
      setPerfil(perf)
      const eid = perf?.empresa_id || session.user.id
      setEmpresaId(eid)

      const { data: row } = await supabase.from('vx_storage').select('value').eq('key', `cfg:${eid}`).single()
      if (row?.value) {
        const c = JSON.parse(row.value)
        setCfg(c)
        const todosClientes = c.clients || []
        const isAdmin = perf?.perfil === 'admin' || perf?.perfil === 'gerente'
        const clientesFiltrados = isAdmin ? todosClientes : todosClientes.filter(cl => !cl.usuarioId || cl.usuarioId === perf.user_id)
        setClientes(clientesFiltrados)
        setObrigacoes(c.contabilObrigacoes || [])
        setCustomObgRegimes(c.customObgRegimes || {})
        setUsuarios(c.usuarios || [])
        setMeiReceitas(c.meiReceitas || {})
        setMeiDasStatus(c.meiDasStatus || {})
        setMeiDocs(c.meiDocs || [])
        // Seleciona primeiro cliente MEI automaticamente
        const primeiro = clientesFiltrados.find(c => c.regime === 'mei')
        if (primeiro) setMeiCliente(primeiro.id)
      }
      setLoading(false)
    }
    init()
  }, [router])

  useEffect(() => { if (abaQuery) setAba(abaQuery) }, [abaQuery])

  async function salvarStorage(novoCfg) {
    await supabase.from('vx_storage').upsert(
      { key: `cfg:${empresaId}`, value: JSON.stringify(novoCfg), updated_at: new Date().toISOString() },
      { onConflict: 'key' }
    )
  }

  function toast(msg) { setMsgSucesso(msg); setTimeout(() => setMsgSucesso(''), 3500) }

  // ─── Obrigações ────────────────────────────────────────────────────────────
  async function gerarTodasObrigacoes() {
    setSaving(true)
    let obgAtuais = [...obrigacoes]
    for (const cliente of clientes) {
      const novas = gerarObrigacoesAnuais(cliente, obgAtuais, anoRef, customObgRegimes)
      obgAtuais = [...obgAtuais, ...novas]
    }
    const novoCfg = { ...cfg, contabilObrigacoes: obgAtuais }
    await salvarStorage(novoCfg)
    setObrigacoes(obgAtuais)
    setCfg(novoCfg)
    setSaving(false)
    toast(`✅ Obrigações geradas para todos os ${clientes.length} clientes no ano ${anoRef}!`)
  }

  function abrirNovaObg() {
    setFormObg({
      key: '', clienteId: '', obgId: 'manual_' + Date.now(),
      obgNome: '', tipo: 'Declaração', categoria: 'Federal',
      periodicidade: 'Mensal', dia_ideal: '', dia_atencao: '', dia_vencimento: '',
      mes: mesRef, ano: anoRef, status: 'Pendente',
      dataConc: '', obs: '', usuarioId: '', isManual: true,
    })
    setShowObgForm(true)
  }

  function abrirEditarObg(obg) { setFormObg({ ...obg }); setShowObgForm(true) }

  async function salvarObg() {
    if (!formObg.obgNome.trim()) { alert('Informe o nome da obrigação.'); return }
    if (!formObg.clienteId) { alert('Selecione o cliente.'); return }
    setSaving(true)
    const cliente = clientes.find(c => c.id === formObg.clienteId)
    const key = formObg.key || gerarKey(formObg.clienteId, formObg.obgId, formObg.ano, formObg.mes)
    const obgFinal = { ...formObg, key, clienteNome: cliente?.nome || formObg.clienteNome }
    const novas = formObg.key ? obrigacoes.map(o => o.key === formObg.key ? obgFinal : o) : [...obrigacoes, obgFinal]
    const novoCfg = { ...cfg, contabilObrigacoes: novas }
    await salvarStorage(novoCfg)
    setObrigacoes(novas); setCfg(novoCfg); setShowObgForm(false); setSaving(false)
    toast('✅ Obrigação salva!')
  }

  async function excluirObg(key) {
    if (!confirm('Excluir esta obrigação?')) return
    const novas = obrigacoes.filter(o => o.key !== key)
    const novoCfg = { ...cfg, contabilObrigacoes: novas }
    await salvarStorage(novoCfg)
    setObrigacoes(novas); setCfg(novoCfg)
    toast('🗑 Obrigação removida!')
  }

  async function alterarStatusObg(key, novoStatus) {
    const novas = obrigacoes.map(o =>
      o.key === key ? { ...o, status: novoStatus, dataConc: novoStatus === 'Concluída' ? new Date().toISOString().slice(0,10) : null } : o
    )
    const novoCfg = { ...cfg, contabilObrigacoes: novas }
    await salvarStorage(novoCfg)
    setObrigacoes(novas); setCfg(novoCfg)
  }

  async function salvarRegimeCliente(clienteId, regime) {
    const novosClientes = (cfg.clients || []).map(c => c.id === clienteId ? { ...c, regime } : c)
    const obgSemEsteCliente = obrigacoes.filter(o => o.clienteId !== clienteId)
    const clienteAtual = novosClientes.find(c => c.id === clienteId)
    const novasObg = clienteAtual ? gerarObrigacoesAnuais(clienteAtual, obgSemEsteCliente, anoRef, customObgRegimes) : []
    const merged = [...obgSemEsteCliente, ...novasObg]
    const novoCfg = { ...cfg, clients: novosClientes, contabilObrigacoes: merged }
    await salvarStorage(novoCfg)
    setCfg(novoCfg); setClientes(prev => prev.map(c => c.id === clienteId ? { ...c, regime } : c)); setObrigacoes(merged)
    toast('✅ Regime atualizado! Obrigações geradas para o ano.')
  }

  async function atribuirUsuario(clienteId, usuarioId) {
    const novosClients = (cfg.clients || []).map(c => c.id === clienteId ? { ...c, usuarioId } : c)
    const novoCfg = { ...cfg, clients: novosClients }
    await salvarStorage(novoCfg)
    setCfg(novoCfg); setClientes(prev => prev.map(c => c.id === clienteId ? { ...c, usuarioId } : c))
    const novasObg = obrigacoes.map(o => o.clienteId === clienteId ? { ...o, usuarioId } : o)
    const novoCfg2 = { ...novoCfg, contabilObrigacoes: novasObg }
    await salvarStorage(novoCfg2); setObrigacoes(novasObg); setCfg(novoCfg2)
    toast('✅ Usuário atribuído!')
  }

  async function salvarCustomObgRegime(regime, lista) {
    const novoCustom = { ...customObgRegimes, [regime]: lista }
    const novoCfg = { ...cfg, customObgRegimes: novoCustom }
    await salvarStorage(novoCfg); setCfg(novoCfg); setCustomObgRegimes(novoCustom)
    toast('✅ Obrigações do regime atualizadas!')
  }

  // ─── MEI: Funções ──────────────────────────────────────────────────────────
  function meiKey(ano, mes) { return `${ano}_${String(mes).padStart(2,'0')}` }

  function getMeiReceita(ano, mes) {
    return meiReceitas[meiKey(ano, mes)] || { comercio: 0, servicos: 0, obs: '' }
  }

  function faturamentoAnualMei(ano) {
    let total = 0
    for (let m = 1; m <= 12; m++) {
      const r = getMeiReceita(ano, m)
      total += (Number(r.comercio) || 0) + (Number(r.servicos) || 0)
    }
    return total
  }

  function faturamentoAcumuladoMei(ano, mesAtual) {
    let total = 0
    for (let m = 1; m <= mesAtual; m++) {
      const r = getMeiReceita(ano, m)
      total += (Number(r.comercio) || 0) + (Number(r.servicos) || 0)
    }
    return total
  }

  async function salvarReceitaMei(ano, mes, dados) {
    const chave = meiKey(ano, mes)
    const novaReceitas = { ...meiReceitas, [chave]: dados }
    const novoCfg = { ...cfg, meiReceitas: novaReceitas }
    await salvarStorage(novoCfg)
    setMeiReceitas(novaReceitas); setCfg(novoCfg)
    setMeiMesEdit(null)
    toast('✅ Receita registrada!')
  }

  async function alterarStatusDas(ano, mes, status) {
    const chave = meiKey(ano, mes)
    const novoDas = { ...meiDasStatus, [chave]: status }
    const novoCfg = { ...cfg, meiDasStatus: novoDas }
    await salvarStorage(novoCfg)
    setMeiDasStatus(novoDas); setCfg(novoCfg)
    toast('✅ Status do DAS atualizado!')
  }

  function gerarRelatorioMensal(ano, mes) {
    const rec = getMeiReceita(ano, mes)
    const total = (Number(rec.comercio) || 0) + (Number(rec.servicos) || 0)
    const cliente = clientes.find(c => c.id === meiCliente)
    const texto = `RELATÓRIO MENSAL DE RECEITAS BRUTAS - MEI\n` +
      `==========================================\n` +
      `Empresa: ${cliente?.nome || '—'}\n` +
      `CNPJ: ${cliente?.cnpj || '—'}\n` +
      `Mês/Ano: ${MESES_FULL[mes-1]}/${ano}\n\n` +
      `Receita de Comércio/Indústria: ${fmt(rec.comercio)}\n` +
      `Receita de Serviços:           ${fmt(rec.servicos)}\n` +
      `TOTAL:                         ${fmt(total)}\n\n` +
      `Observações: ${rec.obs || '—'}\n\n` +
      `Declaro que as informações acima são verdadeiras.\n\n` +
      `Local e Data: _________________, ___/___/______\n\n` +
      `Assinatura: _______________________________\n` +
      `${cliente?.nome || ''}`
    const blob = new Blob([texto], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `relatorio_mei_${ano}_${String(mes).padStart(2,'0')}.txt`
    a.click()
    URL.revokeObjectURL(url)
    toast('📄 Relatório gerado!')
  }

  // ─── Cálculos ─────────────────────────────────────────────────────────────
  const hoje = new Date()
  const mesAtual = hoje.getMonth() + 1
  const anoAtual = hoje.getFullYear()

  const calcStatus = (o) => {
    if (o.status === 'Concluída') return 'Concluída'
    if (!o.dia_vencimento) return o.status
    const venc = new Date(o.ano, o.mes - 1, o.dia_vencimento)
    if (hoje > venc) return 'Atrasada'
    return o.status
  }

  const obgDoMes = obrigacoes.filter(o => o.mes === mesRef && o.ano === anoRef)
  const obgPendentes  = obgDoMes.filter(o => ['Pendente','Em Andamento'].includes(calcStatus(o))).length
  const obgConcluidas = obgDoMes.filter(o => calcStatus(o) === 'Concluída').length
  const obgAtrasadas  = obgDoMes.filter(o => calcStatus(o) === 'Atrasada').length
  const totalClientes = clientes.length
  const isAdmin = perfil?.perfil === 'admin' || perfil?.perfil === 'gerente'

  const obgFiltradas = obgDoMes.filter(o => {
    if (filtroCliente !== 'Todos' && o.clienteId !== filtroCliente) return false
    if (filtroCat !== 'Todos' && o.categoria !== filtroCat) return false
    if (filtroUsuario !== 'Todos' && o.usuarioId !== filtroUsuario) return false
    if (buscaTexto.trim()) {
      const b = buscaTexto.toLowerCase()
      if (!o.obgNome?.toLowerCase().includes(b) && !o.clienteNome?.toLowerCase().includes(b)) return false
    }
    if (filtroStatus !== 'Todos' && calcStatus(o) !== filtroStatus) return false
    if (drillDown === 'pendentes' && !['Pendente','Em Andamento'].includes(calcStatus(o))) return false
    if (drillDown === 'concluidas' && calcStatus(o) !== 'Concluída') return false
    if (drillDown === 'atrasadas' && calcStatus(o) !== 'Atrasada') return false
    return true
  })

  // MEI: clientes com regime MEI
  const clientesMei = clientes.filter(c => c.regime === 'mei')
  const clienteMeiObj = clientes.find(c => c.id === meiCliente)
  const fatAnualMei = faturamentoAnualMei(meiAno)
  const fatAcumMei = faturamentoAcumuladoMei(meiAno, mesAtual)
  const pctLimite = Math.min(100, Math.round((fatAcumMei / LIMITE_MEI) * 100))
  const alertaLimite = pctLimite >= 80

  if (loading) return (
    <div style={{background:'#0a0f1e',minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center',color:'#64748b',fontFamily:'DM Mono,monospace'}}>
      Carregando...
    </div>
  )

  // ══════════════════════════════════════════════════════════════════════════
  return (
    <>
      <Head>
        <title>Produtividade — {cfg.company || 'Vivanexa'}</title>
        <link href="https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=DM+Mono:wght@400;500&display=swap" rel="stylesheet" />
      </Head>
      <style>{CSS}</style>
      <Navbar cfg={cfg} perfil={perfil} />

      {msgSucesso && (
        <div style={{position:'fixed',bottom:24,right:24,zIndex:9999,background:'rgba(16,185,129,.95)',color:'#fff',padding:'12px 20px',borderRadius:10,fontSize:13,fontFamily:'DM Mono,monospace',boxShadow:'0 4px 20px rgba(0,0,0,.4)'}}>
          {msgSucesso}
        </div>
      )}

      <div className="page-wrap">
        <div className="page-hdr">
          <h1 className="page-title">⚡ Produtividade</h1>
          <p className="page-sub">Tarefas, obrigações fiscais e gestão MEI</p>
        </div>

        {/* Abas principais */}
        <div className="tabs">
          {[
            { id:'tarefas', label:'✅ Tarefas e Obrigações' },
            { id:'mei',     label:'🏪 Gestão MEI'           },
          ].map(a => (
            <button key={a.id} className={`tab-btn${aba === a.id ? ' active' : ''}`} onClick={() => { setAba(a.id); setDrillDown(null) }}>{a.label}</button>
          ))}
        </div>

        {/* ══ TAREFAS E OBRIGAÇÕES ══ */}
        {aba === 'tarefas' && (
          <div>
            {/* Dashboard */}
            <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:12,marginBottom:20}}>
              {[
                { l:'Total Clientes', v:totalClientes,  c:'#00d4ff', i:'👥', d:null         },
                { l:'Pendentes',      v:obgPendentes,   c:'#f59e0b', i:'⏳', d:'pendentes'  },
                { l:'Concluídas',     v:obgConcluidas,  c:'#10b981', i:'✅', d:'concluidas' },
                { l:'Atrasadas',      v:obgAtrasadas,   c:'#ef4444', i:'⚠️', d:'atrasadas'  },
              ].map(m => (
                <div key={m.l}
                  onClick={() => { if(m.d) { setDrillDown(drillDown === m.d ? null : m.d); setFiltroStatus('Todos') } }}
                  style={{ background: drillDown === m.d ? `${m.c}18` : '#111827', border: `1px solid ${drillDown === m.d ? m.c+'55' : '#1e2d4a'}`, borderRadius:12, padding:'16px 18px', cursor: m.d ? 'pointer' : 'default', transition:'all .2s' }}>
                  <div style={{fontSize:20,marginBottom:6}}>{m.i}</div>
                  <div style={{fontFamily:'Syne,sans-serif',fontSize:26,fontWeight:800,color:m.c}}>{m.v}</div>
                  <div style={{fontSize:11,color:'#64748b',marginTop:2}}>{m.l}</div>
                  {m.d && <div style={{fontSize:10,color:m.c,marginTop:4,opacity:.7}}>clique para filtrar</div>}
                </div>
              ))}
            </div>

            {drillDown && (
              <div style={{background:'rgba(0,212,255,.06)',border:'1px solid rgba(0,212,255,.2)',borderRadius:8,padding:'8px 14px',marginBottom:14,fontSize:12,color:'#00d4ff',display:'flex',alignItems:'center',justifyContent:'space-between'}}>
                <span>🔍 Exibindo: <strong>{drillDown === 'pendentes' ? 'Pendentes e Em Andamento' : drillDown === 'concluidas' ? 'Concluídas' : 'Atrasadas'}</strong> de {MESES[mesRef-1]}/{anoRef}</span>
                <button onClick={() => setDrillDown(null)} style={{background:'none',border:'none',color:'#64748b',cursor:'pointer',fontSize:16}}>✕</button>
              </div>
            )}

            {/* Navegação ano/mês */}
            <div style={{display:'flex',gap:8,alignItems:'center',marginBottom:12,flexWrap:'wrap'}}>
              <div style={{display:'flex',gap:4,alignItems:'center'}}>
                <button onClick={() => setAnoRef(a => a - 1)} style={btnSmStyle}>◀</button>
                <span style={{color:'#e2e8f0',fontSize:13,minWidth:40,textAlign:'center'}}>{anoRef}</span>
                <button onClick={() => setAnoRef(a => a + 1)} style={btnSmStyle}>▶</button>
              </div>
              <div style={{display:'flex',gap:4,flexWrap:'wrap'}}>
                {MESES.map((m, i) => (
                  <button key={i} onClick={() => setMesRef(i + 1)}
                    style={{...btnSmStyle, background:mesRef===i+1?'rgba(0,212,255,.2)':'#1a2540', color:mesRef===i+1?'#00d4ff':'#64748b', borderColor:mesRef===i+1?'rgba(0,212,255,.4)':'#1e2d4a'}}>
                    {m}
                  </button>
                ))}
              </div>
            </div>

            {/* Filtros */}
            <div style={{display:'flex',gap:8,alignItems:'center',marginBottom:14,flexWrap:'wrap'}}>
              <input value={buscaTexto} onChange={e => setBuscaTexto(e.target.value)} placeholder="🔍 Buscar por obrigação ou cliente..." className="field-input" style={{flex:'1 1 200px',minWidth:200,padding:'7px 12px',fontSize:12}} />
              <select value={filtroCliente} onChange={e => setFiltroCliente(e.target.value)} className="field-input" style={{width:'auto',padding:'6px 10px',fontSize:12}}>
                <option value="Todos">Todos clientes</option>
                {clientes.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
              </select>
              <select value={filtroCat} onChange={e => setFiltroCat(e.target.value)} className="field-input" style={{width:'auto',padding:'6px 10px',fontSize:12}}>
                <option value="Todos">Todas categorias</option>
                {CATEGORIAS.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              <select value={filtroStatus} onChange={e => { setFiltroStatus(e.target.value); setDrillDown(null) }} className="field-input" style={{width:'auto',padding:'6px 10px',fontSize:12}}>
                <option value="Todos">Todos status</option>
                {STATUS_OBG.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
              {isAdmin && (
                <select value={filtroUsuario} onChange={e => setFiltroUsuario(e.target.value)} className="field-input" style={{width:'auto',padding:'6px 10px',fontSize:12}}>
                  <option value="Todos">Todos</option>
                  {usuarios.map(u => <option key={u.id} value={u.id}>{u.nome || u.email}</option>)}
                  <option value="">Sem usuário</option>
                </select>
              )}
              <button className="btn-primary" onClick={abrirNovaObg}>+ Obrigação</button>
              <button className="btn-primary" onClick={gerarTodasObrigacoes} disabled={saving} style={{background:'linear-gradient(135deg,#7c3aed,#5b21b6)'}}>
                {saving ? '⏳...' : '🔄 Gerar Ano'}
              </button>
            </div>

            {/* Chips de clientes */}
            {clientes.length > 0 && (
              <div style={{display:'flex',gap:6,flexWrap:'wrap',marginBottom:16}}>
                {clientes.map(c => (
                  <button key={c.id}
                    onClick={() => setFiltroCliente(filtroCliente === c.id ? 'Todos' : c.id)}
                    style={{padding:'4px 12px',borderRadius:20,border:'1px solid',fontSize:11,cursor:'pointer',fontFamily:'DM Mono,monospace',
                      background:filtroCliente===c.id?'rgba(0,212,255,.15)':'#1a2540',
                      borderColor:filtroCliente===c.id?'rgba(0,212,255,.4)':'#1e2d4a',
                      color:filtroCliente===c.id?'#00d4ff':'#64748b'}}>
                    {c.nome}
                    {c.regime && <span style={{opacity:.6,marginLeft:4}}>{REGIMES.find(r=>r.id===c.regime)?.label?.split(' ')[0]}</span>}
                  </button>
                ))}
              </div>
            )}

            {/* Tabela de obrigações */}
            {clientes.length === 0 ? (
              <div className="empty">👤 Nenhum cliente encontrado.<br/><span style={{fontSize:12}}>Cadastre clientes em <strong style={{color:'#00d4ff'}}>Configurações → Clientes</strong> e defina o regime tributário abaixo.</span></div>
            ) : obgFiltradas.length === 0 ? (
              <div className="empty">
                Nenhuma obrigação para {MESES[mesRef-1]}/{anoRef} com os filtros selecionados.<br/>
                <button className="btn-primary" style={{marginTop:12,display:'inline-flex'}} onClick={gerarTodasObrigacoes}>🔄 Gerar Obrigações do Ano</button>
              </div>
            ) : (
              <div>
                <div style={{fontSize:12,color:'#64748b',marginBottom:8}}>{obgFiltradas.length} obrigação(ões) encontrada(s)</div>
                {obgFiltradas.map(o => {
                  const statusReal = calcStatus(o)
                  const atrasada = statusReal === 'Atrasada'
                  const hoje_d = new Date()
                  const vencDia = o.dia_vencimento ? new Date(o.ano, o.mes-1, o.dia_vencimento) : null
                  const atencaoDia = o.dia_atencao ? new Date(o.ano, o.mes-1, o.dia_atencao) : null
                  const dentroAtencao = atencaoDia && hoje_d >= atencaoDia && (!vencDia || hoje_d <= vencDia)
                  const bordColor = atrasada ? 'rgba(239,68,68,.4)' : dentroAtencao ? 'rgba(245,158,11,.3)' : '#1e2d4a'
                  return (
                    <div key={o.key} style={{display:'flex',alignItems:'center',gap:10,padding:'12px 14px',background:'#111827',border:`1px solid ${bordColor}`,borderRadius:10,marginBottom:6}}>
                      <span style={{fontSize:10,padding:'2px 8px',borderRadius:20,border:'1px solid',color:corCategoria[o.categoria]||'#64748b',borderColor:(corCategoria[o.categoria]||'#64748b')+'44',background:(corCategoria[o.categoria]||'#64748b')+'11',flexShrink:0}}>{o.categoria}</span>
                      <div style={{flex:1,minWidth:0}}>
                        <div style={{fontSize:12,fontWeight:600,color:'#e2e8f0',marginBottom:2}}>{o.obgNome}</div>
                        <div style={{fontSize:11,color:'#64748b'}}>{o.clienteNome} · {o.tipo} · {o.periodicidade}</div>
                        {o.obs && <div style={{fontSize:11,color:'#7c3aed',marginTop:2}}>📝 {o.obs}</div>}
                      </div>
                      <div style={{fontSize:11,color:'#64748b',flexShrink:0,textAlign:'center',lineHeight:1.7}}>
                        {o.dia_ideal     && <div style={{color:'#10b981'}}>✅ Meta: dia {o.dia_ideal}</div>}
                        {o.dia_atencao   && <div style={{color:'#f59e0b'}}>⚠️ Atenção: dia {o.dia_atencao}</div>}
                        {o.dia_vencimento&& <div style={{color:atrasada?'#ef4444':'#64748b'}}>📅 Vence: dia {o.dia_vencimento}</div>}
                        {o.dataConc      && <div style={{color:'#10b981'}}>✅ {o.dataConc}</div>}
                      </div>
                      <span style={{fontSize:11,fontWeight:700,color:corStatus[statusReal]||'#64748b',flexShrink:0}}>{statusReal}</span>
                      <select value={o.status} onChange={e => alterarStatusObg(o.key, e.target.value)}
                        style={{background:'#1a2540',border:'1px solid #1e2d4a',borderRadius:6,padding:'4px 8px',fontSize:11,color:'#e2e8f0',fontFamily:'DM Mono,monospace',cursor:'pointer'}}>
                        {STATUS_OBG.map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                      <button onClick={() => abrirEditarObg(o)} style={{...btnSmStyle,color:'#00d4ff',borderColor:'rgba(0,212,255,.3)'}}>✏️</button>
                      <button onClick={() => excluirObg(o.key)} style={{...btnSmStyle,color:'#ef4444',borderColor:'rgba(239,68,68,.3)'}}>🗑</button>
                    </div>
                  )
                })}
              </div>
            )}

            {/* Configuração de Clientes */}
            {clientes.length > 0 && (
              <div style={{marginTop:28}}>
                <div style={{fontSize:11,color:'#64748b',textTransform:'uppercase',letterSpacing:1,marginBottom:12,borderTop:'1px solid #1e2d4a',paddingTop:16}}>
                  Configuração de Clientes
                </div>
                <div style={{display:'flex',flexDirection:'column',gap:8}}>
                  {clientes.map(c => (
                    <div key={c.id} style={{display:'flex',alignItems:'center',gap:10,padding:'10px 14px',background:'#111827',border:'1px solid #1e2d4a',borderRadius:10}}>
                      <div style={{flex:1,fontSize:13,color:'#e2e8f0',fontWeight:600}}>{c.nome}</div>
                      <div style={{fontSize:11,color:'#64748b'}}>{c.cnpj || c.cpf || ''}</div>
                      <select value={c.regime || 'simples'} onChange={e => salvarRegimeCliente(c.id, e.target.value)}
                        style={{background:'#1a2540',border:'1px solid #1e2d4a',borderRadius:6,padding:'5px 10px',fontSize:12,color:'#e2e8f0',fontFamily:'DM Mono,monospace',cursor:'pointer'}}>
                        {REGIMES.map(r => <option key={r.id} value={r.id}>{r.label}</option>)}
                      </select>
                      {isAdmin && (
                        <select value={c.usuarioId || ''} onChange={e => atribuirUsuario(c.id, e.target.value)}
                          style={{background:'#1a2540',border:'1px solid #1e2d4a',borderRadius:6,padding:'5px 10px',fontSize:12,color:'#e2e8f0',fontFamily:'DM Mono,monospace',cursor:'pointer'}}>
                          <option value="">Sem usuário</option>
                          {usuarios.map(u => <option key={u.id} value={u.id}>{u.nome || u.email}</option>)}
                        </select>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ══ GESTÃO MEI ══ */}
        {aba === 'mei' && (
          <div>
            {/* Seleção de cliente MEI */}
            <div style={{display:'flex',gap:10,alignItems:'center',marginBottom:20,flexWrap:'wrap'}}>
              <div>
                <label className="field-label">🏪 Cliente MEI</label>
                {clientesMei.length === 0 ? (
                  <div style={{fontSize:12,color:'#f59e0b',padding:'8px 0'}}>
                    ⚠️ Nenhum cliente com regime MEI cadastrado. Atribua o regime MEI em <strong>Tarefas → Configuração de Clientes</strong>.
                  </div>
                ) : (
                  <select value={meiCliente || ''} onChange={e => setMeiCliente(e.target.value)} className="field-input" style={{width:260}}>
                    {clientesMei.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
                  </select>
                )}
              </div>
              <div>
                <label className="field-label">📅 Ano de Referência</label>
                <div style={{display:'flex',gap:4,alignItems:'center'}}>
                  <button onClick={() => setMeiAno(a => a - 1)} style={btnSmStyle}>◀</button>
                  <span style={{color:'#e2e8f0',fontSize:13,minWidth:46,textAlign:'center'}}>{meiAno}</span>
                  <button onClick={() => setMeiAno(a => a + 1)} style={btnSmStyle}>▶</button>
                </div>
              </div>
            </div>

            {clientesMei.length > 0 && meiCliente && (
              <>
                {/* Alerta de limite */}
                {alertaLimite && (
                  <div style={{background:'rgba(245,158,11,.12)',border:'1px solid rgba(245,158,11,.4)',borderRadius:10,padding:'12px 16px',marginBottom:16,display:'flex',alignItems:'center',gap:12}}>
                    <span style={{fontSize:24}}>⚠️</span>
                    <div>
                      <div style={{fontSize:13,fontWeight:700,color:'#f59e0b'}}>Atenção: {pctLimite}% do limite MEI atingido!</div>
                      <div style={{fontSize:12,color:'#64748b',marginTop:2}}>
                        Faturamento acumulado: <strong style={{color:'#f59e0b'}}>{fmt(fatAcumMei)}</strong> de {fmt(LIMITE_MEI)} anuais. 
                        {pctLimite >= 100 && ' 🚨 Limite ultrapassado — considere migrar de regime!'}
                      </div>
                    </div>
                  </div>
                )}

                {/* Sub-abas MEI */}
                <div className="tabs" style={{marginBottom:20}}>
                  {[
                    { id:'dashboard',   label:'📊 Dashboard'          },
                    { id:'receitas',    label:'💰 Receitas Mensais'   },
                    { id:'das',         label:'📋 DAS-MEI'            },
                    { id:'documentos',  label:'📁 Documentos'         },
                    { id:'portais',     label:'🌐 Portais Gov'        },
                  ].map(s => (
                    <button key={s.id} className={`tab-btn${meiSubAba === s.id ? ' active' : ''}`} onClick={() => setMeiSubAba(s.id)}>{s.label}</button>
                  ))}
                </div>

                {/* ── Dashboard MEI ── */}
                {meiSubAba === 'dashboard' && (
                  <div>
                    <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:14,marginBottom:20}}>
                      {[
                        { l:'Faturamento no Ano', v:fmt(fatAnualMei), c:'#10b981', i:'💰', sub:`${meiAno}` },
                        { l:'Acumulado até o Mês', v:fmt(fatAcumMei), c:'#00d4ff', i:'📈', sub:`Jan-${MESES[mesAtual-1]}` },
                        { l:'Limite Disponível', v:fmt(Math.max(0, LIMITE_MEI - fatAcumMei)), c: pctLimite>=80?'#ef4444':'#7c3aed', i:'🔢', sub:`de ${fmt(LIMITE_MEI)}` },
                      ].map(m => (
                        <div key={m.l} style={{background:'#111827',border:`1px solid ${m.c}33`,borderRadius:12,padding:'18px 20px'}}>
                          <div style={{fontSize:22,marginBottom:8}}>{m.i}</div>
                          <div style={{fontFamily:'Syne,sans-serif',fontSize:20,fontWeight:800,color:m.c}}>{m.v}</div>
                          <div style={{fontSize:11,color:'#64748b',marginTop:2}}>{m.l}</div>
                          <div style={{fontSize:10,color:m.c,opacity:.7,marginTop:2}}>{m.sub}</div>
                        </div>
                      ))}
                    </div>

                    {/* Barra de progresso do limite */}
                    <div className="card" style={{marginBottom:16}}>
                      <div className="card-title">📏 Termômetro de Faturamento MEI</div>
                      <div style={{display:'flex',justifyContent:'space-between',fontSize:11,color:'#64748b',marginBottom:8}}>
                        <span>R$ 0</span>
                        <span style={{color:pctLimite>=80?'#f59e0b':'#64748b'}}>{pctLimite}% utilizado</span>
                        <span>{fmt(LIMITE_MEI)}</span>
                      </div>
                      <div style={{height:16,background:'#1a2540',borderRadius:8,overflow:'hidden'}}>
                        <div style={{
                          height:'100%',
                          width:`${pctLimite}%`,
                          background: pctLimite>=100 ? '#ef4444' : pctLimite>=80 ? 'linear-gradient(90deg,#f59e0b,#ef4444)' : 'linear-gradient(90deg,#10b981,#00d4ff)',
                          borderRadius:8, transition:'width .6s',
                        }} />
                      </div>
                      <div style={{fontSize:11,color:'#64748b',marginTop:8}}>
                        Faturado em {meiAno}: <strong style={{color:'#e2e8f0'}}>{fmt(fatAnualMei)}</strong> | 
                        Restante: <strong style={{color: pctLimite>=80?'#ef4444':'#10b981'}}>{fmt(Math.max(0, LIMITE_MEI - fatAnualMei))}</strong>
                      </div>
                    </div>

                    {/* Resumo anual por mês */}
                    <div className="card">
                      <div className="card-title">📅 Receita por Mês — {meiAno}</div>
                      <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:8}}>
                        {MESES.map((m, i) => {
                          const rec = getMeiReceita(meiAno, i + 1)
                          const total = (Number(rec.comercio) || 0) + (Number(rec.servicos) || 0)
                          const chave = meiKey(meiAno, i + 1)
                          const dasStatus = meiDasStatus[chave] || 'Pendente'
                          const corDas = dasStatus === 'Pago' ? '#10b981' : dasStatus === 'Atrasado' ? '#ef4444' : '#f59e0b'
                          return (
                            <div key={i} style={{background:'#1a2540',borderRadius:8,padding:'10px 12px',border:'1px solid #1e2d4a'}}>
                              <div style={{fontSize:11,color:'#64748b',marginBottom:4,fontWeight:600}}>{m}</div>
                              <div style={{fontSize:13,fontWeight:700,color:total>0?'#e2e8f0':'#64748b'}}>{total > 0 ? fmt(total) : '—'}</div>
                              <div style={{fontSize:10,marginTop:4,color:corDas}}>DAS: {dasStatus}</div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  </div>
                )}

                {/* ── Receitas Mensais ── */}
                {meiSubAba === 'receitas' && (
                  <div>
                    <div style={{fontSize:12,color:'#64748b',marginBottom:16}}>
                      Registre o faturamento mensal separado por <strong style={{color:'#e2e8f0'}}>Comércio/Indústria</strong> e <strong style={{color:'#e2e8f0'}}>Serviços</strong> conforme exigido pela legislação MEI.
                    </div>
                    <div style={{display:'flex',flexDirection:'column',gap:8}}>
                      {MESES.map((m, i) => {
                        const mes = i + 1
                        const rec = getMeiReceita(meiAno, mes)
                        const total = (Number(rec.comercio) || 0) + (Number(rec.servicos) || 0)
                        const editando = meiMesEdit === mes
                        return (
                          <div key={i} style={{background:'#111827',border:'1px solid #1e2d4a',borderRadius:10,padding:'14px 16px'}}>
                            <div style={{display:'flex',alignItems:'center',gap:12}}>
                              <div style={{width:60,fontSize:12,fontWeight:600,color:'#e2e8f0'}}>{m}/{meiAno}</div>
                              {!editando ? (
                                <>
                                  <div style={{flex:1,display:'flex',gap:16,fontSize:12,color:'#64748b'}}>
                                    <span>🛒 Comércio: <strong style={{color:'#e2e8f0'}}>{fmt(rec.comercio)}</strong></span>
                                    <span>💼 Serviços: <strong style={{color:'#e2e8f0'}}>{fmt(rec.servicos)}</strong></span>
                                    <span style={{color:total>0?'#10b981':'#64748b'}}>Total: <strong>{fmt(total)}</strong></span>
                                    {rec.obs && <span style={{color:'#7c3aed'}}>📝 {rec.obs}</span>}
                                  </div>
                                  <button onClick={() => { setMeiMesEdit(mes); setMeiFormRec({ comercio: rec.comercio||'', servicos: rec.servicos||'', obs: rec.obs||'' }) }}
                                    style={{...btnSmStyle,color:'#00d4ff',borderColor:'rgba(0,212,255,.3)'}}>✏️ Editar</button>
                                  <button onClick={() => gerarRelatorioMensal(meiAno, mes)}
                                    style={{...btnSmStyle,color:'#10b981',borderColor:'rgba(16,185,129,.3)'}}>📄 Relatório</button>
                                </>
                              ) : (
                                <div style={{flex:1}}>
                                  <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 2fr',gap:10,marginBottom:10}}>
                                    <div>
                                      <label className="field-label">🛒 Comércio/Indústria (R$)</label>
                                      <input type="number" min="0" step="0.01" value={meiFormRec.comercio} onChange={e => setMeiFormRec(f=>({...f,comercio:e.target.value}))} className="field-input" placeholder="0,00" />
                                    </div>
                                    <div>
                                      <label className="field-label">💼 Serviços (R$)</label>
                                      <input type="number" min="0" step="0.01" value={meiFormRec.servicos} onChange={e => setMeiFormRec(f=>({...f,servicos:e.target.value}))} className="field-input" placeholder="0,00" />
                                    </div>
                                    <div>
                                      <label className="field-label">📝 Observações</label>
                                      <input value={meiFormRec.obs} onChange={e => setMeiFormRec(f=>({...f,obs:e.target.value}))} className="field-input" placeholder="Opcional..." />
                                    </div>
                                  </div>
                                  <div style={{display:'flex',gap:8}}>
                                    <button className="btn-primary" style={{fontSize:12}} onClick={() => salvarReceitaMei(meiAno, mes, { comercio: Number(meiFormRec.comercio)||0, servicos: Number(meiFormRec.servicos)||0, obs: meiFormRec.obs })}>💾 Salvar</button>
                                    <button className="btn-cancel" style={{fontSize:12}} onClick={() => setMeiMesEdit(null)}>Cancelar</button>
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}

                {/* ── DAS-MEI ── */}
                {meiSubAba === 'das' && (
                  <div>
                    <div style={{background:'rgba(0,212,255,.06)',border:'1px solid rgba(0,212,255,.15)',borderRadius:10,padding:'14px 16px',marginBottom:16,fontSize:12,color:'#64748b',lineHeight:1.8}}>
                      <strong style={{color:'#00d4ff'}}>📋 DAS-MEI</strong> — O boleto mensal vence todo dia <strong style={{color:'#e2e8f0'}}>20</strong>. O valor inclui INSS, ISS e/ou ICMS conforme atividade.
                      Controle abaixo os pagamentos e gere alertas de vencimento.
                    </div>
                    <div style={{display:'flex',flexDirection:'column',gap:8}}>
                      {MESES.map((m, i) => {
                        const mes = i + 1
                        const chave = meiKey(meiAno, mes)
                        const status = meiDasStatus[chave] || 'Pendente'
                        const vencido = mes < mesAtual && meiAno <= anoAtual && status !== 'Pago'
                        const corAtual = status === 'Pago' ? '#10b981' : vencido ? '#ef4444' : '#f59e0b'
                        return (
                          <div key={i} style={{display:'flex',alignItems:'center',gap:14,padding:'12px 16px',background:'#111827',border:`1px solid ${status==='Pago'?'rgba(16,185,129,.2)':vencido?'rgba(239,68,68,.25)':'#1e2d4a'}`,borderRadius:10}}>
                            <span style={{fontSize:12,fontWeight:600,color:'#e2e8f0',minWidth:80}}>{m}/{meiAno}</span>
                            <span style={{fontSize:11,color:'#64748b'}}>Vencimento: dia 20</span>
                            <div style={{flex:1}} />
                            <span style={{fontSize:12,fontWeight:700,color:corAtual}}>{vencido && status !== 'Pago' ? '🔴 Atrasado' : status === 'Pago' ? '✅ Pago' : '⏳ Pendente'}</span>
                            <select value={status} onChange={e => alterarStatusDas(meiAno, mes, e.target.value)}
                              style={{background:'#1a2540',border:'1px solid #1e2d4a',borderRadius:6,padding:'4px 10px',fontSize:11,color:'#e2e8f0',fontFamily:'DM Mono,monospace',cursor:'pointer'}}>
                              <option value="Pendente">Pendente</option>
                              <option value="Pago">Pago</option>
                              <option value="Atrasado">Atrasado</option>
                            </select>
                          </div>
                        )
                      })}
                    </div>

                    {/* DASN-SIMEI */}
                    <div className="card" style={{marginTop:20}}>
                      <div className="card-title">📑 DASN-SIMEI — Declaração Anual</div>
                      <div style={{fontSize:12,color:'#64748b',lineHeight:1.9}}>
                        A Declaração Anual do Simples Nacional para MEI deve ser entregue até <strong style={{color:'#f59e0b'}}>31 de maio</strong> do ano seguinte ao de referência.<br/>
                        Ela consolida o faturamento de todos os 12 meses do ano.<br/>
                        <strong style={{color:'#e2e8f0'}}>Faturamento de {meiAno}:</strong> {fmt(fatAnualMei)}
                      </div>
                      <div style={{display:'flex',gap:10,marginTop:14,flexWrap:'wrap'}}>
                        <a href="https://www8.receita.fazenda.gov.br/SimplesNacional/Aplicacoes/ATSPO/dasnsimei.app/" target="_blank" rel="noopener"
                          style={{...btnSmStyle,color:'#00d4ff',borderColor:'rgba(0,212,255,.3)',textDecoration:'none',padding:'8px 16px'}}>
                          🌐 Acessar DASN-SIMEI
                        </a>
                      </div>
                    </div>
                  </div>
                )}

                {/* ── Documentos ── */}
                {meiSubAba === 'documentos' && (
                  <div>
                    <div style={{fontSize:12,color:'#64748b',marginBottom:16}}>
                      Organize os documentos essenciais do MEI. Guarde os comprovantes por pelo menos <strong style={{color:'#e2e8f0'}}>5 anos</strong>.
                    </div>
                    <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:12,marginBottom:20}}>
                      {[
                        { icon:'🪪', titulo:'CCMEI', desc:'Certificado da Condição de MEI — comprova a existência do CNPJ. Necessário para conta bancária e emissão de notas.' },
                        { icon:'📋', titulo:'DAS Pagos', desc:'Comprovantes mensais de pagamento do DAS. Guarde todos os boletos pagos.' },
                        { icon:'📊', titulo:'Relatórios Mensais', desc:'Relatórios de receita bruta gerados pelo sistema. Assine e arquive mensalmente.' },
                        { icon:'📦', titulo:'NF de Compra', desc:'Notas fiscais de aquisição de mercadorias ou serviços. Guardar por 5 anos.' },
                        { icon:'🧾', titulo:'NF Emitidas', desc:'Notas fiscais de venda ou serviço emitidas pelo MEI.' },
                        { icon:'📑', titulo:'DASN-SIMEI', desc:'Declaração anual enviada até 31/05. Guarde o recibo de entrega.' },
                      ].map(d => (
                        <div key={d.titulo} style={{background:'#111827',border:'1px solid #1e2d4a',borderRadius:12,padding:'16px'}}>
                          <div style={{fontSize:24,marginBottom:8}}>{d.icon}</div>
                          <div style={{fontSize:13,fontWeight:700,color:'#e2e8f0',marginBottom:6}}>{d.titulo}</div>
                          <div style={{fontSize:11,color:'#64748b',lineHeight:1.6}}>{d.desc}</div>
                        </div>
                      ))}
                    </div>
                    <div style={{background:'rgba(124,58,237,.08)',border:'1px solid rgba(124,58,237,.2)',borderRadius:10,padding:'14px 16px',fontSize:12,color:'#64748b'}}>
                      💡 <strong style={{color:'#7c3aed'}}>Dica:</strong> Use o botão <strong style={{color:'#e2e8f0'}}>📄 Relatório</strong> na aba <em>Receitas Mensais</em> para gerar automaticamente o Relatório Mensal de Receitas Brutas assinável.
                    </div>
                  </div>
                )}

                {/* ── Portais Gov ── */}
                {meiSubAba === 'portais' && (
                  <div>
                    <div style={{fontSize:12,color:'#64748b',marginBottom:16}}>
                      Acesso rápido aos portais governamentais obrigatórios para o MEI.
                    </div>
                    <div style={{display:'grid',gridTemplateColumns:'repeat(2,1fr)',gap:14}}>
                      {[
                        {
                          icon:'🏛️', titulo:'Portal do Empreendedor (Gov.br)',
                          desc:'Abertura, alteração de dados, baixa do MEI e emissão do CCMEI.',
                          url:'https://www.gov.br/empresas-e-negocios/pt-br/empreendedor',
                          cor:'#00d4ff',
                        },
                        {
                          icon:'📋', titulo:'PGMEI — Emissão do DAS',
                          desc:'Emita o boleto mensal DAS-MEI diretamente pelo Programa Gerador da Receita Federal.',
                          url:'https://www8.receita.fazenda.gov.br/SimplesNacional/Aplicacoes/ATSPO/pgmei.app/',
                          cor:'#10b981',
                        },
                        {
                          icon:'📑', titulo:'DASN-SIMEI — Declaração Anual',
                          desc:'Entregue a declaração anual de faturamento até 31 de maio. Obrigatória mesmo sem faturamento.',
                          url:'https://www8.receita.fazenda.gov.br/SimplesNacional/Aplicacoes/ATSPO/dasnsimei.app/',
                          cor:'#f59e0b',
                        },
                        {
                          icon:'🧾', titulo:'Portal NFS-e Nacional',
                          desc:'Emissão obrigatória de Nota Fiscal de Serviço Eletrônica para MEIs prestadores de serviço.',
                          url:'https://www.nfse.gov.br/',
                          cor:'#7c3aed',
                        },
                        {
                          icon:'🔍', titulo:'e-CAC — Receita Federal',
                          desc:'Verifique sua regularidade fiscal, situação cadastral e emita a Certidão Negativa de Débitos (CND).',
                          url:'https://cav.receita.fazenda.gov.br/',
                          cor:'#ec4899',
                        },
                        {
                          icon:'📚', titulo:'Sebrae — Guia MEI',
                          desc:'Orientações, cursos e suporte para o microempreendedor individual.',
                          url:'https://www.sebrae.com.br/sites/PortalSebrae/ufs/ap/artigos/o-que-e-o-mei,8f0d3e0211987410VgnVCM1000003b74010aRCRD',
                          cor:'#06b6d4',
                        },
                      ].map(p => (
                        <a key={p.titulo} href={p.url} target="_blank" rel="noopener"
                          style={{display:'block',background:'#111827',border:`1px solid ${p.cor}22`,borderRadius:12,padding:'18px',textDecoration:'none',transition:'all .18s',cursor:'pointer'}}
                          onMouseEnter={e => e.currentTarget.style.borderColor = p.cor+'66'}
                          onMouseLeave={e => e.currentTarget.style.borderColor = p.cor+'22'}>
                          <div style={{fontSize:28,marginBottom:10}}>{p.icon}</div>
                          <div style={{fontSize:13,fontWeight:700,color:p.cor,marginBottom:6}}>{p.titulo}</div>
                          <div style={{fontSize:11,color:'#64748b',lineHeight:1.6}}>{p.desc}</div>
                          <div style={{fontSize:11,color:p.cor,marginTop:10,opacity:.7}}>🔗 Acessar →</div>
                        </a>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}

      </div>

      {/* ══ MODAL: Nova/Editar Obrigação ══ */}
      {showObgForm && formObg && (
        <div className="modal-bg">
          <div className="modal-box" style={{maxWidth:560}}>
            <div className="modal-hdr">
              <h3>{formObg.key ? '✏️ Editar Obrigação' : '➕ Nova Obrigação'}</h3>
              <button className="modal-close" onClick={() => setShowObgForm(false)}>✕</button>
            </div>

            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:10}}>
              <div style={{gridColumn:'1/-1'}}>
                <label className="field-label">Nome da Obrigação *</label>
                <input value={formObg.obgNome} onChange={e => setFormObg(f=>({...f,obgNome:e.target.value}))} className="field-input" placeholder="Ex: DCTF – Débitos Tributários" />
              </div>
              <div>
                <label className="field-label">Cliente *</label>
                <select value={formObg.clienteId} onChange={e => setFormObg(f=>({...f,clienteId:e.target.value}))} className="field-input">
                  <option value="">Selecione...</option>
                  {clientes.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
                </select>
              </div>
              <div>
                <label className="field-label">Categoria</label>
                <select value={formObg.categoria} onChange={e => setFormObg(f=>({...f,categoria:e.target.value}))} className="field-input">
                  {CATEGORIAS.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="field-label">Tipo</label>
                <input value={formObg.tipo} onChange={e => setFormObg(f=>({...f,tipo:e.target.value}))} className="field-input" placeholder="Declaração / Guia / Operacional" />
              </div>
              <div>
                <label className="field-label">Periodicidade</label>
                <select value={formObg.periodicidade} onChange={e => setFormObg(f=>({...f,periodicidade:e.target.value}))} className="field-input">
                  {PERIODICIDADES.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
              <div>
                <label className="field-label">Mês</label>
                <select value={formObg.mes} onChange={e => setFormObg(f=>({...f,mes:Number(e.target.value)}))} className="field-input">
                  {MESES.map((m,i) => <option key={i} value={i+1}>{m}</option>)}
                </select>
              </div>
              <div>
                <label className="field-label">Ano</label>
                <input type="number" value={formObg.ano} onChange={e => setFormObg(f=>({...f,ano:Number(e.target.value)}))} className="field-input" />
              </div>
            </div>

            <div style={{background:'rgba(0,212,255,.04)',border:'1px solid rgba(0,212,255,.1)',borderRadius:8,padding:'12px 14px',marginBottom:12}}>
              <div style={{fontSize:11,color:'#64748b',marginBottom:10,textTransform:'uppercase',letterSpacing:.8}}>Prazos (dia do mês)</div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:10}}>
                <div>
                  <label className="field-label" style={{color:'#10b981'}}>✅ Ideal (verde)</label>
                  <input type="number" min="1" max="31" value={formObg.dia_ideal||''} onChange={e => setFormObg(f=>({...f,dia_ideal:e.target.value?Number(e.target.value):null}))} className="field-input" placeholder="Ex: 10" />
                </div>
                <div>
                  <label className="field-label" style={{color:'#f59e0b'}}>⚠️ Atenção (amarelo)</label>
                  <input type="number" min="1" max="31" value={formObg.dia_atencao||''} onChange={e => setFormObg(f=>({...f,dia_atencao:e.target.value?Number(e.target.value):null}))} className="field-input" placeholder="Ex: 13" />
                </div>
                <div>
                  <label className="field-label" style={{color:'#ef4444'}}>🔴 Vencimento (vermelho)</label>
                  <input type="number" min="1" max="31" value={formObg.dia_vencimento||''} onChange={e => setFormObg(f=>({...f,dia_vencimento:e.target.value?Number(e.target.value):null}))} className="field-input" placeholder="Ex: 15" />
                </div>
              </div>
            </div>

            <div style={{marginBottom:10}}>
              <label className="field-label">Status</label>
              <select value={formObg.status} onChange={e => setFormObg(f=>({...f,status:e.target.value}))} className="field-input">
                {STATUS_OBG.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            {isAdmin && (
              <div style={{marginBottom:10}}>
                <label className="field-label">Usuário Responsável</label>
                <select value={formObg.usuarioId||''} onChange={e => setFormObg(f=>({...f,usuarioId:e.target.value}))} className="field-input">
                  <option value="">Sem usuário</option>
                  {usuarios.map(u => <option key={u.id} value={u.id}>{u.nome||u.email}</option>)}
                </select>
              </div>
            )}
            <div style={{marginBottom:14}}>
              <label className="field-label">Observações</label>
              <input value={formObg.obs||''} onChange={e => setFormObg(f=>({...f,obs:e.target.value}))} className="field-input" placeholder="Anotação opcional..." />
            </div>

            <div className="modal-foot">
              <button className="btn-cancel" onClick={() => setShowObgForm(false)}>Cancelar</button>
              <button className="btn-primary" onClick={salvarObg} disabled={saving}>{saving?'⏳...':'✅ Salvar'}</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

// ─── Estilo botão pequeno ─────────────────────────────────────────────────────
const btnSmStyle = {
  padding:'4px 10px', borderRadius:6, border:'1px solid #1e2d4a',
  background:'#1a2540', color:'#64748b',
  fontFamily:'DM Mono,monospace', fontSize:11, cursor:'pointer'
}

// ─── CSS principal ─────────────────────────────────────────────────────────────
const CSS = `
  :root{--bg:#0a0f1e;--surface:#111827;--surface2:#1a2540;--border:#1e2d4a;--accent:#00d4ff;--text:#e2e8f0;--muted:#64748b;--danger:#ef4444;--gold:#f59e0b;--accent3:#10b981}
  *{box-sizing:border-box;margin:0;padding:0}
  body{background:var(--bg);color:var(--text);font-family:'DM Mono',monospace;min-height:100vh}
  body::before{content:'';position:fixed;inset:0;background-image:linear-gradient(rgba(0,212,255,.018) 1px,transparent 1px),linear-gradient(90deg,rgba(0,212,255,.018) 1px,transparent 1px);background-size:44px 44px;pointer-events:none;z-index:0}
  .page-wrap{max-width:1300px;margin:0 auto;padding:24px 20px 60px;position:relative;z-index:1}
  .page-hdr{margin-bottom:20px}
  .page-title{font-family:'Syne',sans-serif;font-size:22px;font-weight:800;margin-bottom:4px}
  .page-sub{font-size:12px;color:var(--muted)}
  .tabs{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:24px;border-bottom:1px solid var(--border);padding-bottom:12px}
  .tab-btn{padding:8px 14px;border-radius:8px;border:1px solid var(--border);background:var(--surface2);color:var(--muted);font-family:'DM Mono',monospace;font-size:11.5px;cursor:pointer;transition:all .14s;white-space:nowrap}
  .tab-btn.active{background:rgba(0,212,255,.12);border-color:rgba(0,212,255,.4);color:var(--accent);font-weight:600}
  .btn-primary{display:flex;align-items:center;gap:6px;padding:9px 18px;background:linear-gradient(135deg,var(--accent),#0099bb);border:none;border-radius:9px;color:#fff;font-family:'DM Mono',monospace;font-size:12px;font-weight:600;cursor:pointer;transition:all .18s;white-space:nowrap}
  .btn-primary:hover{box-shadow:0 0 16px rgba(0,212,255,.35);transform:translateY(-1px)}
  .btn-primary:disabled{opacity:.6;cursor:not-allowed;transform:none}
  .btn-cancel{padding:9px 18px;border-radius:9px;background:rgba(100,116,139,.12);border:1px solid var(--border);color:var(--muted);font-family:'DM Mono',monospace;font-size:12px;cursor:pointer}
  .empty{text-align:center;padding:50px 0;color:var(--muted);font-size:13px;line-height:1.8}
  .card{background:var(--surface);border:1px solid var(--border);border-radius:14px;padding:22px}
  .card-title{font-family:'Syne',sans-serif;font-size:15px;font-weight:700;color:var(--text);margin-bottom:14px;display:flex;align-items:center;gap:8px}
  .field-label{font-size:11px;color:var(--muted);display:block;margin-bottom:4px;letter-spacing:.5px;text-transform:uppercase}
  .field-input{width:100%;background:var(--surface2);border:1px solid var(--border);border-radius:8px;padding:10px 12px;font-family:'DM Mono',monospace;font-size:13px;color:var(--text);outline:none;transition:border-color .18s}
  .field-input:focus{border-color:var(--accent)}
  .modal-bg{position:fixed;inset:0;background:rgba(0,0,0,.82);z-index:500;display:flex;align-items:center;justify-content:center;padding:20px;overflow-y:auto}
  .modal-box{background:var(--surface);border:1px solid var(--border);border-radius:16px;width:100%;max-width:500px;padding:24px;box-shadow:0 8px 48px rgba(0,0,0,.6);max-height:90vh;overflow-y:auto}
  .modal-hdr{display:flex;align-items:center;justify-content:space-between;margin-bottom:18px}
  .modal-hdr h3{font-family:'Syne',sans-serif;font-size:15px;font-weight:700;color:var(--accent)}
  .modal-close{background:none;border:none;color:var(--muted);font-size:20px;cursor:pointer}
  .modal-foot{display:flex;gap:10px;justify-content:flex-end;margin-top:16px}
  select.field-input option{background:#1a2540;color:#e2e8f0}
  @media(max-width:768px){
    .page-wrap{padding:16px 14px 50px}
    [style*="repeat(4"]{grid-template-columns:repeat(2,1fr)!important}
    [style*="1fr 1fr 1fr"]{grid-template-columns:1fr!important}
    [style*="repeat(3"]{grid-template-columns:1fr 1fr!important}
    [style*="repeat(2,1fr)"]{grid-template-columns:1fr!important}
  }
`
