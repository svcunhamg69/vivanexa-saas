// pages/produtividade.js — Vivanexa v4
// ✅ Consulta Tributária: PIS/COFINS, IPI, ICMS, CBS, IBS, IS, CFOP, CEST, CST
// ✅ Busca por NCM (lista todos produtos), EAN/Código de barras, Descrição
// ✅ Lote: upload Excel / colar em massa
// ✅ Tarefas e Obrigações: Simples, Presumido, Real, MEI com dashboard contador

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/router'
import Head from 'next/head'
import { supabase } from '../lib/supabase'
import Navbar from '../components/Navbar'

// ─── Constantes ───────────────────────────────────────────────────────────────
const PRIORIDADES   = ['Alta', 'Média', 'Baixa']
const STATUS_OBG    = ['Pendente', 'Em Andamento', 'Concluída', 'Atrasada']
const UFS = ['AC','AL','AM','AP','BA','CE','DF','ES','GO','MA','MG','MS','MT','PA','PB','PE','PI','PR','RJ','RN','RO','RR','RS','SC','SE','SP','TO']
const REGIMES = [{ id:'simples', label:'Simples Nacional' },{ id:'presumido', label:'Lucro Presumido' },{ id:'real', label:'Lucro Real' },{ id:'mei', label:'MEI' }]
const TIPOS_NEGOCIO = [{ id:'varejo', label:'🛒 Varejo' },{ id:'atacadista', label:'📦 Atacadista' },{ id:'industria', label:'🏭 Indústria' },{ id:'servicos', label:'💼 Serviços' },{ id:'importador', label:'🌎 Importador' }]

// ─── Obrigações por regime ────────────────────────────────────────────────────
const OBRIGACOES_BASE = {
  simples: [
    { id:'das', nome:'DAS – Documento de Arrecadação do Simples', tipo:'Guia', periodicidade:'Mensal', dia_vencimento:20, dia_ideal:15, categoria:'Federal' },
    { id:'defis', nome:'DEFIS – Declaração de Informações Socioeconômicas', tipo:'Declaração', periodicidade:'Anual', mes_referencia:3, dia_vencimento:31, dia_ideal:25, categoria:'Federal' },
    { id:'pgdas', nome:'PGDAS-D – Programa Gerador do DAS', tipo:'Declaração', periodicidade:'Mensal', dia_vencimento:20, dia_ideal:15, categoria:'Federal' },
    { id:'fgts_simples', nome:'FGTS – Fundo de Garantia', tipo:'Guia', periodicidade:'Mensal', dia_vencimento:7, dia_ideal:5, categoria:'Federal' },
    { id:'esocial_simples', nome:'eSocial – Folha de Pagamento', tipo:'Declaração', periodicidade:'Mensal', dia_vencimento:7, dia_ideal:5, categoria:'Federal' },
    { id:'dctf_simples', nome:'DCTF – Débitos e Créditos Tributários Federais', tipo:'Declaração', periodicidade:'Mensal', dia_vencimento:15, dia_ideal:10, categoria:'Federal' },
    { id:'dirf_simples', nome:'DIRF – Declaração do Imposto de Renda Retido na Fonte', tipo:'Declaração', periodicidade:'Anual', mes_referencia:2, dia_vencimento:28, dia_ideal:20, categoria:'Federal' },
    { id:'sped_ecd_simples', nome:'SPED ECD – Escrituração Contábil Digital', tipo:'Declaração', periodicidade:'Anual', mes_referencia:6, dia_vencimento:30, dia_ideal:20, categoria:'Federal' },
  ],
  presumido: [
    { id:'irpj_p', nome:'IRPJ – Imposto de Renda Pessoa Jurídica (Estimativa)', tipo:'Guia', periodicidade:'Trimestral', dia_vencimento:31, dia_ideal:25, categoria:'Federal' },
    { id:'csll_p', nome:'CSLL – Contribuição Social sobre o Lucro Líquido', tipo:'Guia', periodicidade:'Trimestral', dia_vencimento:31, dia_ideal:25, categoria:'Federal' },
    { id:'pis_p', nome:'PIS – Programa de Integração Social', tipo:'Guia', periodicidade:'Mensal', dia_vencimento:25, dia_ideal:20, categoria:'Federal' },
    { id:'cofins_p', nome:'COFINS – Contribuição para Financiamento da Seguridade', tipo:'Guia', periodicidade:'Mensal', dia_vencimento:25, dia_ideal:20, categoria:'Federal' },
    { id:'inss_p', nome:'GPS – Guia da Previdência Social', tipo:'Guia', periodicidade:'Mensal', dia_vencimento:20, dia_ideal:15, categoria:'Federal' },
    { id:'fgts_p', nome:'FGTS – Fundo de Garantia', tipo:'Guia', periodicidade:'Mensal', dia_vencimento:7, dia_ideal:5, categoria:'Federal' },
    { id:'dctf_p', nome:'DCTF – Débitos e Créditos Tributários Federais', tipo:'Declaração', periodicidade:'Mensal', dia_vencimento:15, dia_ideal:10, categoria:'Federal' },
    { id:'sped_ecd_p', nome:'SPED ECD – Escrituração Contábil Digital', tipo:'Declaração', periodicidade:'Anual', mes_referencia:6, dia_vencimento:30, dia_ideal:20, categoria:'Federal' },
    { id:'sped_ecf_p', nome:'SPED ECF – Escrituração Contábil Fiscal', tipo:'Declaração', periodicidade:'Anual', mes_referencia:7, dia_vencimento:31, dia_ideal:20, categoria:'Federal' },
    { id:'dirf_p', nome:'DIRF – Declaração do Imposto Retido na Fonte', tipo:'Declaração', periodicidade:'Anual', mes_referencia:2, dia_vencimento:28, dia_ideal:20, categoria:'Federal' },
    { id:'esocial_p', nome:'eSocial – Folha de Pagamento', tipo:'Declaração', periodicidade:'Mensal', dia_vencimento:7, dia_ideal:5, categoria:'Federal' },
    { id:'reinf_p', nome:'EFD-REINF – Escrituração Fiscal Digital de Retenções', tipo:'Declaração', periodicidade:'Mensal', dia_vencimento:15, dia_ideal:10, categoria:'Federal' },
    { id:'sped_fiscal_p', nome:'SPED EFD ICMS/IPI – Escrituração Fiscal Digital', tipo:'Declaração', periodicidade:'Mensal', dia_vencimento:15, dia_ideal:10, categoria:'Estadual' },
    { id:'gia_p', nome:'GIA – Guia de Informação e Apuração do ICMS', tipo:'Declaração', periodicidade:'Mensal', dia_vencimento:20, dia_ideal:15, categoria:'Estadual' },
    { id:'iss_p', nome:'ISS – Imposto Sobre Serviços', tipo:'Guia', periodicidade:'Mensal', dia_vencimento:10, dia_ideal:7, categoria:'Municipal' },
  ],
  real: [
    { id:'irpj_r', nome:'IRPJ – Imposto de Renda PJ (Estimativa Mensal)', tipo:'Guia', periodicidade:'Mensal', dia_vencimento:31, dia_ideal:25, categoria:'Federal' },
    { id:'csll_r', nome:'CSLL – Contribuição Social s/ Lucro Líquido', tipo:'Guia', periodicidade:'Mensal', dia_vencimento:31, dia_ideal:25, categoria:'Federal' },
    { id:'pis_r', nome:'PIS – Não Cumulativo', tipo:'Guia', periodicidade:'Mensal', dia_vencimento:25, dia_ideal:20, categoria:'Federal' },
    { id:'cofins_r', nome:'COFINS – Não Cumulativa', tipo:'Guia', periodicidade:'Mensal', dia_vencimento:25, dia_ideal:20, categoria:'Federal' },
    { id:'inss_r', nome:'GPS – Guia da Previdência Social', tipo:'Guia', periodicidade:'Mensal', dia_vencimento:20, dia_ideal:15, categoria:'Federal' },
    { id:'fgts_r', nome:'FGTS – Fundo de Garantia', tipo:'Guia', periodicidade:'Mensal', dia_vencimento:7, dia_ideal:5, categoria:'Federal' },
    { id:'dctf_r', nome:'DCTF – Débitos e Créditos Tributários Federais', tipo:'Declaração', periodicidade:'Mensal', dia_vencimento:15, dia_ideal:10, categoria:'Federal' },
    { id:'sped_ecd_r', nome:'SPED ECD – Escrituração Contábil Digital', tipo:'Declaração', periodicidade:'Anual', mes_referencia:6, dia_vencimento:30, dia_ideal:20, categoria:'Federal' },
    { id:'sped_ecf_r', nome:'SPED ECF – Escrituração Contábil Fiscal', tipo:'Declaração', periodicidade:'Anual', mes_referencia:7, dia_vencimento:31, dia_ideal:20, categoria:'Federal' },
    { id:'sped_efd_r', nome:'SPED EFD Contribuições', tipo:'Declaração', periodicidade:'Mensal', dia_vencimento:10, dia_ideal:7, categoria:'Federal' },
    { id:'dirf_r', nome:'DIRF – Declaração do Imposto Retido na Fonte', tipo:'Declaração', periodicidade:'Anual', mes_referencia:2, dia_vencimento:28, dia_ideal:20, categoria:'Federal' },
    { id:'esocial_r', nome:'eSocial – Folha de Pagamento', tipo:'Declaração', periodicidade:'Mensal', dia_vencimento:7, dia_ideal:5, categoria:'Federal' },
    { id:'reinf_r', nome:'EFD-REINF – Escrituração Fiscal Digital de Retenções', tipo:'Declaração', periodicidade:'Mensal', dia_vencimento:15, dia_ideal:10, categoria:'Federal' },
    { id:'lalur_r', nome:'LALUR – Livro de Apuração do Lucro Real', tipo:'Livro Fiscal', periodicidade:'Anual', mes_referencia:6, dia_vencimento:30, dia_ideal:20, categoria:'Federal' },
    { id:'sped_fiscal_r', nome:'SPED EFD ICMS/IPI', tipo:'Declaração', periodicidade:'Mensal', dia_vencimento:15, dia_ideal:10, categoria:'Estadual' },
    { id:'gia_r', nome:'GIA – Guia de Informação e Apuração do ICMS', tipo:'Declaração', periodicidade:'Mensal', dia_vencimento:20, dia_ideal:15, categoria:'Estadual' },
    { id:'iss_r', nome:'ISS – Imposto Sobre Serviços', tipo:'Guia', periodicidade:'Mensal', dia_vencimento:10, dia_ideal:7, categoria:'Municipal' },
  ],
  mei: [
    { id:'das_mei', nome:'DAS-MEI – Documento de Arrecadação MEI', tipo:'Guia', periodicidade:'Mensal', dia_vencimento:20, dia_ideal:15, categoria:'Federal' },
    { id:'dasn', nome:'DASN-SIMEI – Declaração Anual do MEI', tipo:'Declaração', periodicidade:'Anual', mes_referencia:5, dia_vencimento:31, dia_ideal:25, categoria:'Federal' },
    { id:'nota_mei', nome:'Emissão de Notas Fiscais (quando aplicável)', tipo:'Operacional', periodicidade:'Mensal', dia_vencimento:null, dia_ideal:null, categoria:'Municipal' },
  ],
}

const fmt = n => 'R$ ' + Number(n || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })
const fmtPct = n => n !== null && n !== undefined ? `${Number(n).toFixed(2)}` : '—'

// ─── Cores de status ──────────────────────────────────────────────────────────
const corStatus = { 'Pendente':'#f59e0b', 'Em Andamento':'#00d4ff', 'Concluída':'#10b981', 'Atrasada':'#ef4444' }
const corCategoria = { 'Federal':'#00d4ff', 'Estadual':'#7c3aed', 'Municipal':'#f59e0b' }

// ═════════════════════════════════════════════════════════════════════════════
export default function Produtividade() {
  const router   = useRouter()
  const { aba: abaQuery } = router.query

  const [loading,   setLoading]   = useState(true)
  const [cfg,       setCfg]       = useState({})
  const [empresaId, setEmpresaId] = useState(null)
  const [perfil,    setPerfil]    = useState(null)
  const [aba,       setAba]       = useState('tarefas')

  // ── Consulta tributária ──────────────────────────────────────────────────
  const [tribUF,      setTribUF]      = useState('SP')
  const [tribRegime,  setTribRegime]  = useState('presumido')
  const [tribNegocio, setTribNegocio] = useState('varejo')
  const [tribTipo,    setTribTipo]    = useState('ncm')
  const [tribBusca,   setTribBusca]   = useState('')
  const [tribLoading, setTribLoading] = useState(false)
  const [tribErro,    setTribErro]    = useState('')
  const [tribResult,  setTribResult]  = useState(null)
  const [tribLista,   setTribLista]   = useState([])
  const [tribAba,     setTribAba]     = useState('pis') // pis | ipi | icms | cbs | ibs | is
  const [showModal,   setShowModal]   = useState(false)

  // Lote
  const [loteTexto,   setLoteTexto]   = useState('')
  const [loteLoading, setLoteLoading] = useState(false)
  const [loteResultados, setLoteResultados] = useState([])
  const [loteErro,    setLoteErro]    = useState('')
  const [showLote,    setShowLote]    = useState(false)
  const [loteTipo,    setLoteTipo]    = useState('ncm')
  const fileRef = useRef(null)

  // ── Tarefas / Obrigações ─────────────────────────────────────────────────
  const [clientes,        setClientes]        = useState([])
  const [clienteSel,      setClienteSel]      = useState(null)
  const [obrigacoes,      setObrigacoes]      = useState([]) // [{...obg, clienteId, mes, ano, status, dataConc}]
  const [filtroCat,       setFiltroCat]       = useState('Todos')
  const [filtroStatus,    setFiltroStatus]    = useState('Todos')
  const [filtroCliente,   setFiltroCliente]   = useState('Todos')
  const [anoRef,          setAnoRef]          = useState(new Date().getFullYear())
  const [mesRef,          setMesRef]          = useState(new Date().getMonth() + 1)
  const [saving,          setSaving]          = useState(false)
  const [showClienteForm, setShowClienteForm] = useState(false)
  const [formCliente,     setFormCliente]     = useState({ id:'', nome:'', cnpj:'', regime:'simples', email:'', telefone:'' })

  // MEI / Simples Nacional (mantidos)
  const [meis,        setMeis]        = useState([])
  const [faturamento, setFaturamento] = useState('')
  const [atividade,   setAtividade]   = useState('comercio')
  const [resultSimples, setResultSimples] = useState(null)

  const [msgSucesso, setMsgSucesso] = useState('')

  // ─── Init ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    async function init() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.replace('/'); return }
      let { data: perf } = await supabase.from('perfis').select('*').eq('user_id', session.user.id).maybeSingle()
      if (!perf) {
        const nome = session.user.email?.split('@')[0] || 'Usuário'
        const { data: np } = await supabase.from('perfis').insert({ user_id: session.user.id, nome, email: session.user.email, empresa_id: session.user.id, perfil: 'admin' }).select().single()
        perf = np
      }
      setPerfil(perf)
      const eid = perf?.empresa_id || session.user.id
      setEmpresaId(eid)
      const { data: row } = await supabase.from('vx_storage').select('value').eq('key', `cfg:${eid}`).single()
      if (row?.value) {
        const c = JSON.parse(row.value)
        setCfg(c)
        setClientes(c.contabilClientes || [])
        setObrigacoes(c.contabilObrigacoes || [])
        setMeis(c.meis || [])
      }
      setLoading(false)
    }
    init()
  }, [router])

  useEffect(() => { if (abaQuery) setAba(abaQuery) }, [abaQuery])

  async function salvarStorage(novoCfg) {
    await supabase.from('vx_storage').upsert({ key: `cfg:${empresaId}`, value: JSON.stringify(novoCfg), updated_at: new Date().toISOString() }, { onConflict: 'key' })
  }

  function toast(msg) { setMsgSucesso(msg); setTimeout(() => setMsgSucesso(''), 3000) }

  // ─── CONSULTA TRIBUTÁRIA INDIVIDUAL ───────────────────────────────────────
  async function consultarTributaria(busca, tipo) {
    const b = (busca || tribBusca).trim()
    const t = tipo || tribTipo
    if (!b) { setTribErro(`Informe o ${t === 'ncm' ? 'NCM' : t === 'ean' ? 'código de barras' : 'descrição'}`); return }
    setTribLoading(true); setTribErro(''); setTribResult(null); setTribLista([])

    try {
      const r = await fetch('/api/tributaria/consultar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tipo: t, busca: b, uf: tribUF, regime: tribRegime, tipoNegocio: tribNegocio }),
      })
      const d = await r.json()
      if (d.lote) return // ignorar
      if (!d.success) { setTribErro(d.erro || 'Não encontrado.'); return }
      if (d.single) { setTribResult(d.data); setShowModal(true) }
      else { setTribLista(d.lista || []) }
    } catch (e) {
      setTribErro('Erro de conexão. Verifique sua internet.')
    } finally {
      setTribLoading(false)
    }
  }

  async function selecionarNCM(item) {
    setTribLista([])
    await consultarTributaria(item.codigo, 'ncm')
  }

  // ─── LOTE ─────────────────────────────────────────────────────────────────
  async function processarLote() {
    const linhas = loteTexto.trim().split('\n').map(l => l.trim()).filter(Boolean)
    if (!linhas.length) { setLoteErro('Cole ou importe os itens acima.'); return }
    setLoteLoading(true); setLoteErro(''); setLoteResultados([])

    const lote = linhas.map(linha => {
      const cols = linha.split(/[\t;,]/)
      const val  = (cols[0] || '').trim().replace(/[.\-\/\s]/g, '')
      if (loteTipo === 'ncm') return { ncm: val }
      if (loteTipo === 'ean') return { ean: val }
      return { descricao: (cols[0] || '').trim() }
    })

    try {
      const r = await fetch('/api/tributaria/consultar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lote, uf: tribUF, regime: tribRegime, tipoNegocio: tribNegocio }),
      })
      const d = await r.json()
      setLoteResultados(d.lote || [])
    } catch (e) {
      setLoteErro('Erro ao processar lote.')
    } finally {
      setLoteLoading(false)
    }
  }

  // ─── Upload Excel (lê como texto) ──────────────────────────────────────────
  function handleFileUpload(e) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = evt => {
      // Tenta parsear CSV/TXT; para xlsx real precisaria de lib
      const texto = evt.target.result
      setLoteTexto(texto.split('\n').slice(0, 200).join('\n'))
      toast('📄 Arquivo carregado! Revise e clique em Processar.')
    }
    reader.readAsText(file)
  }

  // ─── CLIENTES / OBRIGAÇÕES ────────────────────────────────────────────────
  async function salvarCliente() {
    if (!formCliente.nome.trim()) { alert('Informe o nome do cliente.'); return }
    setSaving(true)
    const novo = { ...formCliente, id: formCliente.id || 'cli_' + Date.now() }
    const lista = formCliente.id ? clientes.map(c => c.id === formCliente.id ? novo : c) : [...clientes, novo]

    // Gera obrigações automáticas para o novo cliente
    let novasObg = obrigacoes.filter(o => o.clienteId !== novo.id)
    const obgDoRegime = OBRIGACOES_BASE[novo.regime] || []
    const hoje = new Date()
    obgDoRegime.forEach(obg => {
      const key = `${novo.id}_${obg.id}_${hoje.getFullYear()}_${mesRef}`
      const jaExiste = novasObg.some(o => o.key === key)
      if (!jaExiste) {
        novasObg.push({ key, clienteId: novo.id, clienteNome: novo.nome, obgId: obg.id, obgNome: obg.nome, tipo: obg.tipo, categoria: obg.categoria, periodicidade: obg.periodicidade, dia_vencimento: obg.dia_vencimento, dia_ideal: obg.dia_ideal, mes: mesRef, ano: hoje.getFullYear(), status: 'Pendente', dataConc: null, obs: '' })
      }
    })

    const novoCfg = { ...cfg, contabilClientes: lista, contabilObrigacoes: novasObg }
    await salvarStorage(novoCfg)
    setClientes(lista); setObrigacoes(novasObg); setCfg(novoCfg)
    setShowClienteForm(false)
    setFormCliente({ id:'', nome:'', cnpj:'', regime:'simples', email:'', telefone:'' })
    setSaving(false); toast('✅ Cliente salvo!')
  }

  async function alterarStatusObg(key, novoStatus) {
    const novas = obrigacoes.map(o => o.key === key ? { ...o, status: novoStatus, dataConc: novoStatus === 'Concluída' ? new Date().toISOString().slice(0,10) : null } : o)
    const novoCfg = { ...cfg, contabilObrigacoes: novas }
    await salvarStorage(novoCfg); setObrigacoes(novas); setCfg(novoCfg)
  }

  // ─── Filtros obrigações ────────────────────────────────────────────────────
  const hoje = new Date()
  const obgFiltradas = obrigacoes.filter(o => {
    if (o.mes !== mesRef || o.ano !== anoRef) return false
    if (filtroCliente !== 'Todos' && o.clienteId !== filtroCliente) return false
    if (filtroCat !== 'Todos' && o.categoria !== filtroCat) return false
    if (filtroStatus !== 'Todos' && o.status !== filtroStatus) return false
    return true
  })

  const obgPendentes  = obrigacoes.filter(o => o.status === 'Pendente').length
  const obgConcluidas = obrigacoes.filter(o => o.status === 'Concluída').length
  const obgAtrasadas  = obrigacoes.filter(o => {
    if (o.status === 'Concluída') return false
    if (!o.dia_vencimento) return false
    const venc = new Date(o.ano, o.mes - 1, o.dia_vencimento)
    return hoje > venc
  }).length

  // ─── SIMPLES NACIONAL ─────────────────────────────────────────────────────
  function calcularSimples() {
    const fat = Number(faturamento)
    if (!fat || fat <= 0) { alert('Informe o faturamento anual.'); return }
    const tabelas = {
      comercio: [{lim:180000,al:4,ded:0},{lim:360000,al:7.3,ded:5940},{lim:720000,al:9.5,ded:13860},{lim:1800000,al:10.7,ded:22500},{lim:3600000,al:14.3,ded:87300},{lim:4800000,al:19,ded:378000}],
      servicos:  [{lim:180000,al:6,ded:0},{lim:360000,al:11.2,ded:9360},{lim:720000,al:13.5,ded:17640},{lim:1800000,al:16,ded:35640},{lim:3600000,al:21,ded:125640},{lim:4800000,al:33,ded:648000}],
    }
    const tab = tabelas[atividade] || tabelas.comercio
    let faixa = tab.length - 1
    for (let i = 0; i < tab.length; i++) { if (fat <= tab[i].lim) { faixa = i; break } }
    const { al, ded } = tab[faixa]
    const alEfetiva = ((fat * (al / 100) - ded) / fat) * 100
    setResultSimples({ faturamento: fat, faixa: faixa + 1, aliquotaNominal: al, aliquotaEfetiva: alEfetiva.toFixed(2), valorImposto: fat * (al / 100) - ded })
  }

  if (loading) return (
    <div style={{background:'#0a0f1e',minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center',color:'#64748b',fontFamily:'DM Mono, monospace'}}>Carregando...</div>
  )

  const mesesNomes = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez']
  const regimeLbl  = REGIMES.find(r => r.id === tribRegime)?.label || tribRegime
  const negocioLbl = TIPOS_NEGOCIO.find(n => n.id === tribNegocio)?.label || tribNegocio

  // ══════════════════════════════════════════════════════════════════════════
  return (
    <>
      <Head>
        <title>Produtividade — {cfg.company || 'Vivanexa'}</title>
        <link href="https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=DM+Mono:wght@400;500&display=swap" rel="stylesheet" />
      </Head>
      <style>{CSS}</style>
      <Navbar cfg={cfg} perfil={perfil} />

      <div className="page-wrap">
        <div className="page-hdr">
          <h1 className="page-title">⚡ Produtividade</h1>
          <p className="page-sub">Tarefas, obrigações fiscais e consulta tributária completa</p>
        </div>

        {/* Abas principais */}
        <div className="tabs">
          {[
            { id:'tarefas',    label:'✅ Tarefas e Obrigações' },
            { id:'tributaria', label:'📊 Consulta Tributária'  },
            { id:'mei',        label:'🏪 Gestão MEI'           },
            { id:'simples',    label:'📈 Simples Nacional'     },
            { id:'ecac',       label:'🔍 Monitor e-CAC'        },
            { id:'notas',      label:'📥 Captura de Notas'     },
          ].map(a => (
            <button key={a.id} className={`tab-btn${aba === a.id ? ' active' : ''}`} onClick={() => setAba(a.id)}>{a.label}</button>
          ))}
        </div>

        {/* ══ TAREFAS E OBRIGAÇÕES ══ */}
        {aba === 'tarefas' && (
          <div>
            {/* Dashboard contador */}
            <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:12,marginBottom:20}}>
              {[
                { l:'Total Clientes',  v:clientes.length,  c:'#00d4ff', i:'👥' },
                { l:'Pendentes',       v:obgPendentes,     c:'#f59e0b', i:'⏳' },
                { l:'Concluídas',      v:obgConcluidas,    c:'#10b981', i:'✅' },
                { l:'Atrasadas',       v:obgAtrasadas,     c:'#ef4444', i:'⚠️' },
              ].map(m => (
                <div key={m.l} style={{background:'#111827',border:`1px solid ${m.c}33`,borderRadius:12,padding:'16px 18px'}}>
                  <div style={{fontSize:20,marginBottom:6}}>{m.i}</div>
                  <div style={{fontFamily:'Syne,sans-serif',fontSize:26,fontWeight:800,color:m.c}}>{m.v}</div>
                  <div style={{fontSize:11,color:'#64748b',marginTop:2}}>{m.l}</div>
                </div>
              ))}
            </div>

            {/* Filtros de período */}
            <div style={{display:'flex',gap:10,alignItems:'center',marginBottom:16,flexWrap:'wrap'}}>
              <div style={{display:'flex',gap:4,alignItems:'center'}}>
                <button onClick={() => setAnoRef(a => a - 1)} style={btnSmStyle}>◀</button>
                <span style={{color:'#e2e8f0',fontSize:13,minWidth:40,textAlign:'center'}}>{anoRef}</span>
                <button onClick={() => setAnoRef(a => a + 1)} style={btnSmStyle}>▶</button>
              </div>
              <div style={{display:'flex',gap:4,flexWrap:'wrap'}}>
                {mesesNomes.map((m, i) => (
                  <button key={i} onClick={() => setMesRef(i + 1)}
                    style={{...btnSmStyle, background: mesRef === i+1 ? 'rgba(0,212,255,.2)' : '#1a2540', color: mesRef === i+1 ? '#00d4ff' : '#64748b', borderColor: mesRef === i+1 ? 'rgba(0,212,255,.4)' : '#1e2d4a'}}>
                    {m}
                  </button>
                ))}
              </div>
              <div style={{marginLeft:'auto',display:'flex',gap:8}}>
                <select value={filtroCliente} onChange={e => setFiltroCliente(e.target.value)} className="field-input" style={{width:'auto',padding:'6px 10px',fontSize:12}}>
                  <option value="Todos">Todos clientes</option>
                  {clientes.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
                </select>
                <select value={filtroCat} onChange={e => setFiltroCat(e.target.value)} className="field-input" style={{width:'auto',padding:'6px 10px',fontSize:12}}>
                  <option value="Todos">Todas categorias</option>
                  <option value="Federal">Federal</option>
                  <option value="Estadual">Estadual</option>
                  <option value="Municipal">Municipal</option>
                </select>
                <select value={filtroStatus} onChange={e => setFiltroStatus(e.target.value)} className="field-input" style={{width:'auto',padding:'6px 10px',fontSize:12}}>
                  {['Todos', ...STATUS_OBG].map(s => <option key={s} value={s}>{s}</option>)}
                </select>
                <button className="btn-primary" onClick={() => { setFormCliente({ id:'',nome:'',cnpj:'',regime:'simples',email:'',telefone:'' }); setShowClienteForm(true) }}>+ Cliente</button>
              </div>
            </div>

            {/* Lista de clientes rápida */}
            {clientes.length > 0 && (
              <div style={{display:'flex',gap:6,flexWrap:'wrap',marginBottom:16}}>
                {clientes.map(c => (
                  <button key={c.id}
                    onClick={() => setFiltroCliente(filtroCliente === c.id ? 'Todos' : c.id)}
                    style={{padding:'4px 12px',borderRadius:20,border:'1px solid',fontSize:11,cursor:'pointer',fontFamily:'DM Mono,monospace',
                      background: filtroCliente === c.id ? 'rgba(0,212,255,.15)' : '#1a2540',
                      borderColor: filtroCliente === c.id ? 'rgba(0,212,255,.4)' : '#1e2d4a',
                      color: filtroCliente === c.id ? '#00d4ff' : '#64748b'}}>
                    {c.nome} <span style={{opacity:.6,marginLeft:4}}>{REGIMES.find(r => r.id === c.regime)?.label?.split(' ')[0]}</span>
                  </button>
                ))}
              </div>
            )}

            {/* Tabela de obrigações */}
            {obgFiltradas.length === 0 ? (
              <div className="empty">
                {clientes.length === 0
                  ? '👤 Cadastre um cliente para gerar as obrigações automaticamente.'
                  : `Nenhuma obrigação para ${mesesNomes[mesRef-1]}/${anoRef} com os filtros selecionados.`}
              </div>
            ) : (
              <div>
                {obgFiltradas.map(o => {
                  const vencimento = o.dia_vencimento ? new Date(o.ano, o.mes - 1, o.dia_vencimento) : null
                  const atrasada   = vencimento && hoje > vencimento && o.status !== 'Concluída'
                  const statusReal = atrasada ? 'Atrasada' : o.status
                  return (
                    <div key={o.key} style={{display:'flex',alignItems:'center',gap:10,padding:'12px 14px',background:'#111827',border:'1px solid',borderColor: atrasada ? 'rgba(239,68,68,.3)' : '#1e2d4a',borderRadius:10,marginBottom:6}}>
                      <span style={{fontSize:10,padding:'2px 8px',borderRadius:20,border:'1px solid',color:corCategoria[o.categoria]||'#64748b',borderColor:(corCategoria[o.categoria]||'#64748b')+'44',background:(corCategoria[o.categoria]||'#64748b')+'11',flexShrink:0}}>{o.categoria}</span>
                      <div style={{flex:1,minWidth:0}}>
                        <div style={{fontSize:12,fontWeight:600,color:'#e2e8f0',marginBottom:2}}>{o.obgNome}</div>
                        <div style={{fontSize:11,color:'#64748b'}}>{o.clienteNome} · {o.tipo} · {o.periodicidade}</div>
                      </div>
                      <div style={{fontSize:11,color:'#64748b',flexShrink:0,textAlign:'center'}}>
                        {o.dia_ideal && <div style={{color:'#10b981'}}>Meta: dia {o.dia_ideal}</div>}
                        {o.dia_vencimento && <div style={{color: atrasada ? '#ef4444' : '#f59e0b'}}>Vence: dia {o.dia_vencimento}</div>}
                        {o.dataConc && <div style={{color:'#10b981'}}>✅ {o.dataConc}</div>}
                      </div>
                      <span style={{fontSize:11,fontWeight:700,color:corStatus[statusReal],flexShrink:0}}>{statusReal}</span>
                      <select value={o.status} onChange={e => alterarStatusObg(o.key, e.target.value)}
                        style={{background:'#1a2540',border:'1px solid #1e2d4a',borderRadius:6,padding:'4px 8px',fontSize:11,color:'#e2e8f0',fontFamily:'DM Mono,monospace',cursor:'pointer'}}>
                        {STATUS_OBG.map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* ══ CONSULTA TRIBUTÁRIA ══ */}
        {aba === 'tributaria' && (
          <div>
            {/* Card de filtros */}
            <div className="card" style={{marginBottom:16}}>
              <div className="card-title">📊 Consulta de Tributação de Produtos</div>
              <p style={{fontSize:12,color:'#64748b',marginBottom:16,lineHeight:1.6}}>
                Consulte PIS/COFINS, IPI, ICMS, CBS, IBS, IS, CFOP e CEST com dados reais. Selecione UF, Regime e Tipo de Negócio para resultados personalizados.
              </p>

              {/* Filtros */}
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:12,marginBottom:16}}>
                <div>
                  <label className="field-label">🗺️ Estado (UF)</label>
                  <select value={tribUF} onChange={e => setTribUF(e.target.value)} className="field-input" style={{cursor:'pointer'}}>
                    {UFS.map(uf => <option key={uf} value={uf}>{uf}</option>)}
                  </select>
                </div>
                <div>
                  <label className="field-label">📋 Regime Tributário</label>
                  <select value={tribRegime} onChange={e => setTribRegime(e.target.value)} className="field-input" style={{cursor:'pointer'}}>
                    {REGIMES.map(r => <option key={r.id} value={r.id}>{r.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="field-label">🏢 Tipo de Negócio</label>
                  <select value={tribNegocio} onChange={e => setTribNegocio(e.target.value)} className="field-input" style={{cursor:'pointer'}}>
                    {TIPOS_NEGOCIO.map(n => <option key={n.id} value={n.id}>{n.label}</option>)}
                  </select>
                </div>
              </div>

              {/* Tipo de busca */}
              <div style={{display:'flex',gap:8,marginBottom:14,flexWrap:'wrap'}}>
                {[{id:'ncm',label:'🏷️ NCM'},{id:'ean',label:'📦 Cód. de Barras'},{id:'descricao',label:'🔤 Descrição'}].map(t => (
                  <button key={t.id} onClick={() => { setTribTipo(t.id); setTribBusca(''); setTribResult(null); setTribErro(''); setTribLista([]) }}
                    style={{padding:'7px 16px',borderRadius:8,border:'1px solid',cursor:'pointer',fontFamily:'DM Mono,monospace',fontSize:12,fontWeight:600,
                      background: tribTipo === t.id ? 'rgba(0,212,255,.15)' : '#1a2540',
                      borderColor: tribTipo === t.id ? 'rgba(0,212,255,.5)' : '#1e2d4a',
                      color: tribTipo === t.id ? '#00d4ff' : '#64748b'}}>
                    {t.label}
                  </button>
                ))}
                <button onClick={() => setShowLote(!showLote)}
                  style={{padding:'7px 16px',borderRadius:8,border:'1px solid',cursor:'pointer',fontFamily:'DM Mono,monospace',fontSize:12,fontWeight:600,marginLeft:'auto',
                    background: showLote ? 'rgba(124,58,237,.15)' : '#1a2540',
                    borderColor: showLote ? 'rgba(124,58,237,.5)' : '#1e2d4a',
                    color: showLote ? '#a78bfa' : '#64748b'}}>
                  📋 Consulta em Lote
                </button>
              </div>

              {/* Campo de busca */}
              <div style={{display:'flex',gap:10}}>
                <input value={tribBusca} onChange={e => setTribBusca(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && consultarTributaria()}
                  placeholder={tribTipo === 'ncm' ? 'Ex: 22021000 ou 2202.10.00' : tribTipo === 'ean' ? 'Ex: 7896007820001' : 'Ex: Refrigerante, Notebook...'}
                  style={{flex:1,background:'#1a2540',border:'1px solid #1e2d4a',borderRadius:8,padding:'11px 14px',fontFamily:'DM Mono,monospace',fontSize:13,color:'#e2e8f0',outline:'none'}}
                />
                <button onClick={() => consultarTributaria()} disabled={tribLoading}
                  style={{padding:'11px 24px',borderRadius:8,background:'linear-gradient(135deg,#00d4ff,#0099bb)',border:'none',color:'#fff',fontFamily:'DM Mono,monospace',fontSize:13,fontWeight:600,cursor:tribLoading?'not-allowed':'pointer',opacity:tribLoading?.7:1,flexShrink:0}}>
                  {tribLoading ? '⏳...' : '🔍 Consultar'}
                </button>
              </div>

              {tribErro && <div style={{marginTop:10,padding:'10px 14px',background:'rgba(239,68,68,.1)',border:'1px solid rgba(239,68,68,.3)',borderRadius:8,fontSize:12,color:'#ef4444'}}>⚠️ {tribErro}</div>}

              {/* Fontes */}
              <div style={{marginTop:12,display:'flex',gap:6,flexWrap:'wrap'}}>
                {[['BrasilAPI','#00d4ff'],['Bluesoft Cosmos','#7c3aed'],['IBPT','#10b981'],['CONFAZ/SEFAZ','#f59e0b'],['LC 214/2025','#ec4899']].map(([l,c]) => (
                  <span key={l} style={{fontSize:10,color:c,background:c+'15',border:`1px solid ${c}33`,padding:'2px 8px',borderRadius:20,fontWeight:700}}>{l}</span>
                ))}
              </div>
            </div>

            {/* ─ LOTE ─ */}
            {showLote && (
              <div className="card" style={{marginBottom:16}}>
                <div className="card-title">📋 Consulta em Lote</div>
                <p style={{fontSize:12,color:'#64748b',marginBottom:14}}>Cole uma lista (um por linha) ou importe Excel/CSV. Funciona por NCM, EAN ou Descrição.</p>
                <div style={{display:'flex',gap:8,marginBottom:12}}>
                  {[{id:'ncm',l:'NCM'},{id:'ean',l:'Código de Barras'},{id:'descricao',l:'Descrição'}].map(t => (
                    <button key={t.id} onClick={() => setLoteTipo(t.id)}
                      style={{padding:'6px 14px',borderRadius:7,border:'1px solid',cursor:'pointer',fontFamily:'DM Mono,monospace',fontSize:11,
                        background: loteTipo === t.id ? 'rgba(0,212,255,.15)' : '#1a2540',
                        borderColor: loteTipo === t.id ? 'rgba(0,212,255,.4)' : '#1e2d4a',
                        color: loteTipo === t.id ? '#00d4ff' : '#64748b'}}>
                      {t.l}
                    </button>
                  ))}
                  <button onClick={() => fileRef.current?.click()}
                    style={{padding:'6px 14px',borderRadius:7,border:'1px solid rgba(16,185,129,.4)',background:'rgba(16,185,129,.1)',color:'#10b981',fontFamily:'DM Mono,monospace',fontSize:11,cursor:'pointer',marginLeft:'auto'}}>
                    📂 Importar Excel/CSV
                  </button>
                  <input ref={fileRef} type="file" accept=".csv,.txt,.xlsx,.xls" style={{display:'none'}} onChange={handleFileUpload} />
                </div>
                <textarea value={loteTexto} onChange={e => setLoteTexto(e.target.value)}
                  placeholder={`Cole aqui (um por linha):\n22021000\n85171210\n10063021`}
                  rows={8} style={{width:'100%',background:'#1a2540',border:'1px solid #1e2d4a',borderRadius:8,padding:'10px 12px',fontFamily:'DM Mono,monospace',fontSize:12,color:'#e2e8f0',resize:'vertical',outline:'none'}} />
                {loteErro && <div style={{marginTop:8,fontSize:12,color:'#ef4444'}}>⚠️ {loteErro}</div>}
                <div style={{display:'flex',gap:10,marginTop:12,alignItems:'center'}}>
                  <button onClick={processarLote} disabled={loteLoading}
                    style={{padding:'10px 20px',borderRadius:8,background:'linear-gradient(135deg,#7c3aed,#5b21b6)',border:'none',color:'#fff',fontFamily:'DM Mono,monospace',fontSize:13,fontWeight:600,cursor:loteLoading?'not-allowed':'pointer'}}>
                    {loteLoading ? '⏳ Processando...' : `🚀 Processar Lote (${loteTexto.split('\n').filter(l => l.trim()).length} itens)`}
                  </button>
                  {loteResultados.length > 0 && (
                    <button onClick={() => {
                      const csv = ['NCM,Descrição,PIS,COFINS,IPI,ICMS,CFOP Entrada,CFOP Saída,CEST,CBS,IBS,Fonte',
                        ...loteResultados.map(r => {
                          const d = r.data
                          if (!d) return `${r.input},,,,,,,,,,${r.erro||'Erro'}`
                          return `${d.ncm},"${d.descricao}",${d.pis_cofins?.pis},${d.pis_cofins?.cofins},${d.ipi?.aliquota},${d.icms?.aliquota},${d.icms?.cfop_entrada},${d.icms?.cfop_saida},${d.icms?.cest||''},${d.cbs?.aliquota},${d.ibs?.aliq_estadual},${r.tipo}`
                        })
                      ].join('\n')
                      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
                      const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'tributacao_lote.csv'; a.click()
                    }} style={{padding:'10px 18px',borderRadius:8,background:'rgba(16,185,129,.1)',border:'1px solid rgba(16,185,129,.3)',color:'#10b981',fontFamily:'DM Mono,monospace',fontSize:12,cursor:'pointer'}}>
                      ⬇️ Exportar CSV ({loteResultados.length})
                    </button>
                  )}
                </div>

                {/* Tabela resultado lote */}
                {loteResultados.length > 0 && (
                  <div style={{marginTop:16,overflowX:'auto'}}>
                    <table style={{width:'100%',borderCollapse:'collapse',fontSize:11}}>
                      <thead>
                        <tr style={{background:'#1a2540',color:'#64748b'}}>
                          {['Input','NCM','Descrição','PIS','COFINS','IPI','ICMS','CFOP E/S','CEST','CBS','IBS','Ação'].map(h => (
                            <th key={h} style={{padding:'8px 10px',textAlign:'left',borderBottom:'1px solid #1e2d4a',whiteSpace:'nowrap'}}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {loteResultados.map((r, i) => {
                          const d = r.data
                          if (!d) return (
                            <tr key={i} style={{borderBottom:'1px solid #1e2d4a'}}>
                              <td style={{padding:'8px 10px',color:'#64748b'}}>{r.input}</td>
                              <td colSpan={11} style={{padding:'8px 10px',color:'#ef4444'}}>❌ {r.erro}</td>
                            </tr>
                          )
                          return (
                            <tr key={i} style={{borderBottom:'1px solid #1e2d4a'}} onMouseEnter={e => e.currentTarget.style.background='#1a2540'} onMouseLeave={e => e.currentTarget.style.background='transparent'}>
                              <td style={{padding:'8px 10px',color:'#64748b'}}>{r.input}</td>
                              <td style={{padding:'8px 10px',color:'#00d4ff',fontWeight:700}}>{d.ncm}</td>
                              <td style={{padding:'8px 10px',color:'#e2e8f0',maxWidth:200,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{d.descricao}</td>
                              <td style={{padding:'8px 10px',color:'#10b981'}}>{fmtPct(d.pis_cofins?.pis)}%</td>
                              <td style={{padding:'8px 10px',color:'#10b981'}}>{fmtPct(d.pis_cofins?.cofins)}%</td>
                              <td style={{padding:'8px 10px',color:'#7c3aed'}}>{fmtPct(d.ipi?.aliquota)}%</td>
                              <td style={{padding:'8px 10px',color:'#f59e0b'}}>{fmtPct(d.icms?.aliquota)}%</td>
                              <td style={{padding:'8px 10px',color:'#64748b'}}>{d.icms?.cfop_entrada}/{d.icms?.cfop_saida}</td>
                              <td style={{padding:'8px 10px',color:'#64748b'}}>{d.icms?.cest || '—'}</td>
                              <td style={{padding:'8px 10px',color:'#ec4899'}}>{fmtPct(d.cbs?.aliquota)}%</td>
                              <td style={{padding:'8px 10px',color:'#ec4899'}}>{fmtPct(d.ibs?.aliq_estadual)}%</td>
                              <td style={{padding:'8px 10px'}}>
                                <button onClick={() => { setTribResult(d); setShowModal(true) }}
                                  style={{padding:'3px 8px',borderRadius:5,background:'rgba(0,212,255,.1)',border:'1px solid rgba(0,212,255,.3)',color:'#00d4ff',fontSize:10,cursor:'pointer',fontFamily:'DM Mono,monospace'}}>
                                  ver
                                </button>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* Lista de NCMs (busca por descrição) */}
            {tribLista.length > 0 && (
              <div className="card" style={{marginBottom:16}}>
                <div className="card-title">📋 {tribLista.length} produtos encontrados — selecione</div>
                {tribLista.map(item => (
                  <div key={item.codigo} onClick={() => selecionarNCM(item)}
                    style={{display:'flex',alignItems:'center',gap:12,padding:'10px 14px',background:'#1a2540',border:'1px solid #1e2d4a',borderRadius:8,marginBottom:5,cursor:'pointer',transition:'border-color .14s'}}
                    onMouseEnter={e => e.currentTarget.style.borderColor='rgba(0,212,255,.4)'}
                    onMouseLeave={e => e.currentTarget.style.borderColor='#1e2d4a'}>
                    <span style={{background:'rgba(0,212,255,.12)',border:'1px solid rgba(0,212,255,.3)',color:'#00d4ff',padding:'3px 10px',borderRadius:20,fontSize:11,fontWeight:700,flexShrink:0}}>NCM {item.codigo}</span>
                    <span style={{fontSize:12,color:'#e2e8f0'}}>{item.descricao}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Instrução quando não há resultado */}
            {!tribResult && !tribLista.length && !showLote && (
              <div className="card" style={{textAlign:'center',padding:'40px 20px'}}>
                <div style={{fontSize:40,marginBottom:16}}>🔍</div>
                <div style={{fontSize:14,color:'#e2e8f0',fontWeight:600,marginBottom:8}}>Faça sua consulta tributária</div>
                <div style={{fontSize:12,color:'#64748b',lineHeight:1.7}}>
                  Selecione UF, Regime e Tipo de Negócio.<br/>
                  Busque por <strong style={{color:'#00d4ff'}}>NCM</strong>, <strong style={{color:'#7c3aed'}}>Código de Barras</strong> ou <strong style={{color:'#10b981'}}>Descrição</strong>.<br/>
                  Para consultas em massa, use o botão <strong style={{color:'#a78bfa'}}>Consulta em Lote</strong>.
                </div>
              </div>
            )}
          </div>
        )}

        {/* ══ MEI ══ */}
        {aba === 'mei' && (
          <div>
            <div className="section-hdr">
              <h3 style={{fontFamily:'Syne,sans-serif',fontSize:16,fontWeight:700,color:'#e2e8f0'}}>🏪 Gestão MEI</h3>
            </div>
            {meis.length === 0 ? <div className="empty">Nenhum MEI cadastrado.</div> : meis.map(m => (
              <div key={m.id} className="list-row">
                <div style={{flex:1}}>
                  <div style={{fontWeight:700,fontSize:14,color:'#00d4ff'}}>{m.nome}</div>
                  <div style={{fontSize:12,color:'#64748b',marginTop:2}}>
                    {m.cnpj && `CNPJ: ${m.cnpj} · `}{m.email && `${m.email} · `}{m.vencimentoDas && `DAS: dia ${m.vencimentoDas}`}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ══ SIMPLES NACIONAL ══ */}
        {aba === 'simples' && (
          <div>
            <div className="card" style={{maxWidth:520}}>
              <div className="card-title">📊 Simulador Simples Nacional</div>
              <div style={{marginBottom:14}}>
                <label className="field-label">Faturamento Anual (R$)</label>
                <input value={faturamento} onChange={e => setFaturamento(e.target.value)} placeholder="Ex: 360000" type="number" className="field-input" />
              </div>
              <div style={{marginBottom:16}}>
                <label className="field-label">Atividade</label>
                <select value={atividade} onChange={e => setAtividade(e.target.value)} className="field-input" style={{cursor:'pointer'}}>
                  <option value="comercio">Comércio / Indústria (Anexo I/II)</option>
                  <option value="servicos">Serviços (Anexo III)</option>
                </select>
              </div>
              <button onClick={calcularSimples} className="btn-primary" style={{width:'100%',padding:13,justifyContent:'center'}}>📊 Calcular DAS</button>
              {resultSimples && (
                <div style={{marginTop:20,display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
                  {[['Faturamento',fmt(resultSimples.faturamento),'#e2e8f0'],['Faixa',`${resultSimples.faixa}ª faixa`,'#00d4ff'],['Alíq. Nominal',`${resultSimples.aliquotaNominal}%`,'#f59e0b'],['Alíq. Efetiva',`${resultSimples.aliquotaEfetiva}%`,'#10b981'],['Imposto Anual',fmt(resultSimples.valorImposto),'#ef4444'],['DAS Mensal',fmt(resultSimples.valorImposto/12),'#f59e0b']].map(([l,v,c]) => (
                    <div key={l} style={{background:'#1a2540',border:'1px solid #1e2d4a',borderRadius:8,padding:'12px 14px'}}>
                      <div style={{fontSize:10,color:'#64748b',marginBottom:4,textTransform:'uppercase',letterSpacing:1}}>{l}</div>
                      <div style={{fontSize:18,fontWeight:800,color:c,fontFamily:'Syne,sans-serif'}}>{v}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ══ E-CAC ══ */}
        {aba === 'ecac' && (
          <div className="card">
            <div className="card-title">🔍 Monitoramento e-CAC</div>
            <p style={{fontSize:13,color:'#64748b',marginBottom:20,lineHeight:1.7}}>Configure as integrações em <strong style={{color:'#00d4ff',cursor:'pointer'}} onClick={() => router.push('/configuracoes?tab=integracoes')}>Configurações → Integrações</strong>.</p>
            <div style={{display:'grid',gridTemplateColumns:'repeat(2,1fr)',gap:12}}>
              {[{nome:'VERI',desc:'Monitoramento automático de CNDs e certidões.',cor:'#00d4ff'},{nome:'Monitor Contábil',desc:'Painel de obrigações acessórias e prazos.',cor:'#7c3aed'},{nome:'Fiscontech',desc:'Gestão de malhas fiscais e pendências.',cor:'#10b981'},{nome:'SIEG',desc:'Captura automática de XMLs.',cor:'#f59e0b'}].map(s => (
                <div key={s.nome} style={{background:'#1a2540',border:`1px solid ${s.cor}33`,borderRadius:12,padding:'16px 18px'}}>
                  <div style={{fontFamily:'Syne,sans-serif',fontSize:14,fontWeight:700,color:s.cor,marginBottom:6}}>{s.nome}</div>
                  <div style={{fontSize:12,color:'#64748b',marginBottom:12}}>{s.desc}</div>
                  <button onClick={() => router.push('/configuracoes?tab=integracoes')} style={{padding:'7px 14px',borderRadius:7,background:s.cor+'1a',border:`1px solid ${s.cor}44`,color:s.cor,fontFamily:'DM Mono,monospace',fontSize:11,fontWeight:600,cursor:'pointer'}}>Configurar →</button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ══ CAPTURA NOTAS ══ */}
        {aba === 'notas' && (
          <div className="card">
            <div className="card-title">📥 Captura de Notas Fiscais</div>
            <p style={{fontSize:13,color:'#64748b',marginBottom:20}}>Configure em <strong style={{color:'#00d4ff',cursor:'pointer'}} onClick={() => router.push('/configuracoes?tab=integracoes')}>Configurações → Integrações</strong>.</p>
            <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:12}}>
              {[{label:'NF-e Compras',icon:'📦',desc:'XMLs de notas de entrada'},{label:'NF-e Vendas',icon:'🛒',desc:'XMLs de notas emitidas'},{label:'SIEG Monitor',icon:'📡',desc:'Captura automática SIEG'}].map(c => (
                <div key={c.label} style={{background:'#1a2540',border:'1px solid #1e2d4a',borderRadius:12,padding:'18px 16px',textAlign:'center'}}>
                  <div style={{fontSize:28,marginBottom:10}}>{c.icon}</div>
                  <div style={{fontFamily:'Syne,sans-serif',fontSize:13,fontWeight:700,color:'#e2e8f0',marginBottom:6}}>{c.label}</div>
                  <div style={{fontSize:11,color:'#64748b',marginBottom:14}}>{c.desc}</div>
                  <button onClick={() => router.push('/configuracoes?tab=integracoes')} style={{padding:'7px 14px',borderRadius:7,background:'rgba(0,212,255,.1)',border:'1px solid rgba(0,212,255,.25)',color:'#00d4ff',fontFamily:'DM Mono,monospace',fontSize:11,cursor:'pointer'}}>Configurar</button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Toast */}
      {msgSucesso && (
        <div style={{position:'fixed',bottom:24,right:24,background:'rgba(16,185,129,.9)',color:'#fff',padding:'12px 20px',borderRadius:10,fontFamily:'DM Mono,monospace',fontSize:13,fontWeight:600,zIndex:9999}}>{msgSucesso}</div>
      )}

      {/* ══ MODAL DETALHE TRIBUTÁRIO ══ */}
      {showModal && tribResult && (
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,.85)',zIndex:1000,display:'flex',alignItems:'center',justifyContent:'center',padding:20,overflowY:'auto'}}>
          <div style={{background:'#111827',border:'1px solid #1e2d4a',borderRadius:20,width:'100%',maxWidth:700,maxHeight:'92vh',overflowY:'auto',boxShadow:'0 24px 80px rgba(0,0,0,.8)'}}>
            {/* Header modal */}
            <div style={{background:'#0a0f1e',borderRadius:'20px 20px 0 0',padding:'18px 22px',display:'flex',alignItems:'center',justifyContent:'space-between',gap:12,flexWrap:'wrap',borderBottom:'1px solid #1e2d4a'}}>
              <div>
                <div style={{fontFamily:'Syne,sans-serif',fontSize:16,fontWeight:800,color:'#e2e8f0',marginBottom:8}}>ℹ️ {tribResult.descricao?.toUpperCase()}</div>
                <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
                  {[
                    { l: tribResult.ncm, c:'#334155', tc:'#94a3b8' },
                    { l: `📍 ${tribResult.uf}`, c:'#1a2540', tc:'#64748b' },
                    { l: `🏢 ${TIPOS_NEGOCIO.find(n=>n.id===tribResult.tipoNegocio)?.label||tribResult.tipoNegocio}`, c:'#1a2540', tc:'#64748b' },
                    { l: `📋 ${REGIMES.find(r=>r.id===tribResult.regime)?.label||tribResult.regime}`, c:'#1a2540', tc:'#64748b' },
                  ].map((b,i) => (
                    <span key={i} style={{padding:'3px 10px',borderRadius:20,background:b.c,color:b.tc,fontSize:11,fontWeight:700,border:'1px solid #1e2d4a'}}>{b.l}</span>
                  ))}
                </div>
              </div>
              <button onClick={() => setShowModal(false)} style={{background:'#1a2540',border:'1px solid #1e2d4a',color:'#64748b',borderRadius:8,padding:'6px 14px',cursor:'pointer',fontFamily:'DM Mono,monospace',fontSize:12}}>✕ Fechar</button>
            </div>

            {/* Sub-abas do modal */}
            <div style={{display:'flex',borderBottom:'1px solid #1e2d4a',background:'#0d1526'}}>
              {[
                { id:'pis',  label:'% PIS/COFINS', icon:'%'  },
                { id:'ipi',  label:'IPI',           icon:'🏭' },
                { id:'icms', label:'ICMS',          icon:'🏛️' },
                { id:'cbs',  label:'CBS',            icon:'🏦' },
                { id:'ibs',  label:'IBS',            icon:'⚖️' },
                { id:'is',   label:'IS',             icon:'$'  },
              ].map(tab => (
                <button key={tab.id} onClick={() => setTribAba(tab.id)}
                  style={{flex:1,padding:'12px 8px',background:'none',border:'none',borderBottom:`2px solid ${tribAba === tab.id ? '#00d4ff' : 'transparent'}`,color:tribAba === tab.id ? '#00d4ff' : '#64748b',fontFamily:'DM Mono,monospace',fontSize:11,fontWeight:tribAba === tab.id ? 700 : 400,cursor:'pointer',transition:'all .14s',whiteSpace:'nowrap'}}>
                  {tab.icon} {tab.label}
                </button>
              ))}
            </div>

            {/* Conteúdo abas */}
            <div style={{padding:'20px 22px'}}>

              {/* PIS/COFINS */}
              {tribAba === 'pis' && tribResult.pis_cofins && (() => {
                const p = tribResult.pis_cofins
                return (
                  <div>
                    <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:10,marginBottom:14}}>
                      {[['NCM', tribResult.ncm],['PIS', fmtPct(p.pis)],['CST ENTRADA', p.cst_entrada],['CST SAÍDA', p.cst_saida]].map(([l,v]) => <InfoCard key={l} label={l} value={v} />)}
                    </div>
                    <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:10,marginBottom:14}}>
                      {[['CFOP ENTRADA', p.cfop_entrada],['CFOP SAÍDA', p.cfop_saida],['COFINS', fmtPct(p.cofins)],['NRI', p.nri || '—']].map(([l,v]) => <InfoCard key={l} label={l} value={v} />)}
                    </div>
                    <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:10,marginBottom:14}}>
                      {[['COD. ANP','—'],['VIGÊNCIA INÍCIO','—'],['MEDICAMENTO', p.medicamento||'N']].map(([l,v]) => <InfoCard key={l} label={l} value={v} />)}
                    </div>
                    {p.amparo_legal && <InfoBox label="AMPARO LEGAL" value={p.amparo_legal} />}
                    {p.natureza_receita && <InfoBox label="NATUREZA DA RECEITA ISENTA" value={p.natureza_receita} />}
                  </div>
                )
              })()}

              {/* IPI */}
              {tribAba === 'ipi' && tribResult.ipi && (() => {
                const p = tribResult.ipi
                return (
                  <div>
                    <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:10,marginBottom:14}}>
                      {[['ALIQ. IPI', fmtPct(p.aliquota)],['CÓD. ENQ', p.cod_enq||'—'],['CST SAÍDA', p.cst_saida],['CST ENTRADA', p.cst_entrada]].map(([l,v]) => <InfoCard key={l} label={l} value={v} />)}
                    </div>
                    <div style={{display:'grid',gridTemplateColumns:'1fr',gap:10,marginBottom:14}}>
                      <InfoCard label="EX" value={p.ex||'—'} />
                    </div>
                    <InfoBox label="TIPI" value={p.tipi} />
                    <div style={{marginTop:12,fontSize:11,color:'#64748b'}}>
                      🔗 Para mais informações acesse: <a href="https://www.gov.br/receitafederal/pt-br/assuntos/aduana-e-comercio-exterior/classificacao-fiscal-de-mercadorias/tipi" target="_blank" rel="noreferrer" style={{color:'#00d4ff'}}>TIPI – Tabela de Incidência do IPI</a>
                    </div>
                  </div>
                )
              })()}

              {/* ICMS */}
              {tribAba === 'icms' && tribResult.icms && (() => {
                const p = tribResult.icms
                return (
                  <div>
                    <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:10,marginBottom:14}}>
                      {[['ALIQ. ICMS(%)', fmtPct(p.aliquota)],['CST/CSOSN', p.cst_csosn],['CFOP ENTRADA', p.cfop_entrada],['CFOP SAÍDA', p.cfop_saida]].map(([l,v]) => <InfoCard key={l} label={l} value={v} />)}
                    </div>
                    <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:10,marginBottom:14}}>
                      {[['CEST', p.cest||'—'],['RED. BC ICMS(%)', fmtPct(p.red_bc)],['RED. BC ICMS-ST(%)', fmtPct(p.red_bc_st)],['IVA(%)', fmtPct(p.iva)]].map(([l,v]) => <InfoCard key={l} label={l} value={v} />)}
                    </div>
                    <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:10,marginBottom:14}}>
                      {[['FCP(%)', fmtPct(p.fcp)],['CÓD. BENEFÍCIO', p.cod_beneficio||'—'],['ANTECIPADO', p.antecipado||'N'],['DIFERIDO', p.diferido||'Não']].map(([l,v]) => <InfoCard key={l} label={l} value={v} />)}
                    </div>
                    <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:10,marginBottom:14}}>
                      {[['DIFERIMENTO(%)', fmtPct(p.diferimento_pct)],['DESONERADO', p.desonerado||'—'],['DESONERAÇÃO(%)', fmtPct(p.desonerado_pct)],['ISENÇÃO(%)', fmtPct(p.isencao_pct)]].map(([l,v]) => <InfoCard key={l} label={l} value={v} />)}
                    </div>
                    {/* PDV */}
                    <div style={{fontSize:12,color:'#00d4ff',fontWeight:700,marginBottom:10,marginTop:4}}>📱 PDV – Ponto de Venda</div>
                    <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:10,marginBottom:14}}>
                      {[['CFOP ENTRADA', p.pdv?.cfop_entrada||'—'],['CFOP SAÍDA', p.pdv?.cfop_saida||'—'],['CEST', p.pdv?.cest||p.cest||'—'],['CST/CSOSN', p.pdv?.cst_csosn||'—']].map(([l,v]) => <InfoCard key={l} label={l} value={v} />)}
                    </div>
                    <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:10,marginBottom:14}}>
                      {[['ALIQ. ICMS(%)', fmtPct(p.pdv?.aliquota||0)],['RED. BC ICMS(%)', p.pdv?.red_bc||'—'],['RED. BC ICMS-ST(%)', p.pdv?.red_bc_st||'—'],['IVA(%)', fmtPct(p.pdv?.iva||0)]].map(([l,v]) => <InfoCard key={l} label={l} value={v} />)}
                    </div>
                    <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:10,marginBottom:14}}>
                      {[['FCP(%)', p.pdv?.fcp||'—'],['CÓD. BENEFÍCIO', p.pdv?.cod_beneficio||'—'],['ANTECIPADO', p.pdv?.antecipado||'—'],['DIFERIDO', p.pdv?.diferido||'—']].map(([l,v]) => <InfoCard key={l} label={l} value={v} />)}
                    </div>
                    <div style={{display:'grid',gridTemplateColumns:'1fr',gap:10,marginBottom:14}}>
                      <InfoCard label="SIMB. PDV" value={p.pdv?.simb_pdv||'F'} />
                    </div>
                    <InfoBox label="AMPARO LEGAL" value={p.amparo_legal} />
                    {p.cest_descricao && <InfoBox label="CEST" value={p.cest_descricao} />}
                  </div>
                )
              })()}

              {/* CBS */}
              {tribAba === 'cbs' && tribResult.cbs && (() => {
                const p = tribResult.cbs
                return (
                  <div>
                    <div style={{background:'rgba(236,72,153,.06)',border:'1px solid rgba(236,72,153,.2)',borderRadius:12,padding:'18px',marginBottom:16}}>
                      <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:10}}>
                        {[['CST', p.cst],['ALÍQUOTA', fmtPct(p.aliquota)],['REDUÇÃO', fmtPct(p.reducao)]].map(([l,v]) => <InfoCard key={l} label={l} value={v} accent='#ec4899' />)}
                      </div>
                    </div>
                    <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:10,marginBottom:14}}>
                      {[['VIGÊNCIA INÍCIO', p.vigencia_inicio],['VIGÊNCIA FIM', p.vigencia_fim],['ANEXO','—'],['CLASSTRIB', p.classtrib]].map(([l,v]) => <InfoCard key={l} label={l} value={v} />)}
                    </div>
                    <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:14}}>
                      <InfoCard label="DESCRIÇÃO CLASSTRIB" value={p.desc_classtrib} />
                      <InfoCard label="DESCRIÇÃO CST" value={p.desc_cst} />
                    </div>
                    <InfoBox label="AMPARO LEGAL" value={p.amparo_legal} />
                  </div>
                )
              })()}

              {/* IBS */}
              {tribAba === 'ibs' && tribResult.ibs && (() => {
                const p = tribResult.ibs
                return (
                  <div>
                    <div style={{background:'rgba(236,72,153,.06)',border:'1px solid rgba(236,72,153,.2)',borderRadius:12,padding:'18px',marginBottom:16}}>
                      <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:10}}>
                        {[['CST', p.cst],['ALÍQUOTA ESTADUAL', fmtPct(p.aliq_estadual)],['ALÍQUOTA MUNICIPAL', fmtPct(p.aliq_municipal)]].map(([l,v]) => <InfoCard key={l} label={l} value={v} accent='#ec4899' />)}
                      </div>
                    </div>
                    <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:10,marginBottom:14}}>
                      {[['VIGÊNCIA INÍCIO', p.vigencia_inicio],['VIGÊNCIA FIM', p.vigencia_fim],['ANEXO','—'],['CLASSTRIB', p.classtrib]].map(([l,v]) => <InfoCard key={l} label={l} value={v} />)}
                    </div>
                    <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:10,marginBottom:14}}>
                      <InfoCard label="DESCRIÇÃO CLASSTRIB" value={p.desc_classtrib} />
                      <InfoCard label="DESCRIÇÃO CST" value={p.desc_cst} />
                      <InfoCard label="REDUÇÃO" value={fmtPct(p.reducao)} />
                    </div>
                    <InfoBox label="AMPARO LEGAL" value={p.amparo_legal} />
                  </div>
                )
              })()}

              {/* IS */}
              {tribAba === 'is' && tribResult.is && (() => {
                const p = tribResult.is
                return (
                  <div>
                    <div style={{background:'rgba(236,72,153,.06)',border:'1px solid rgba(236,72,153,.2)',borderRadius:12,padding:'18px',marginBottom:16}}>
                      <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:10}}>
                        {[['CST', p.cst||'—'],['ALÍQUOTA', p.aliquota!==null?fmtPct(p.aliquota):'—'],['ANEXO', p.anexo||'—']].map(([l,v]) => <InfoCard key={l} label={l} value={v} accent='#ec4899' />)}
                      </div>
                    </div>
                    <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:10,marginBottom:14}}>
                      <InfoCard label="CLASSTRIB" value={p.classtrib||'—'} />
                      <InfoCard label="DESCRIÇÃO CLASSTRIB" value={p.desc_classtrib||'—'} />
                      <InfoCard label="DESCRIÇÃO CST" value={p.desc_cst||'—'} />
                    </div>
                    <InfoBox label="AMPARO LEGAL" value={p.amparo_legal} />
                  </div>
                )
              })()}
            </div>
          </div>
        </div>
      )}

      {/* Modal Cadastro Cliente */}
      {showClienteForm && (
        <div className="modal-bg">
          <div className="modal-box" style={{maxWidth:480}}>
            <div className="modal-hdr">
              <h3>👤 {formCliente.id ? 'Editar Cliente' : 'Novo Cliente'}</h3>
              <button className="modal-close" onClick={() => setShowClienteForm(false)}>✕</button>
            </div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12,marginBottom:14}}>
              <div style={{gridColumn:'1/-1'}}>
                <label className="field-label">Nome / Razão Social *</label>
                <input value={formCliente.nome} onChange={e => setFormCliente(f=>({...f,nome:e.target.value}))} className="field-input" placeholder="Ex: Empresa XPTO Ltda" />
              </div>
              <div>
                <label className="field-label">CNPJ / CPF</label>
                <input value={formCliente.cnpj} onChange={e => setFormCliente(f=>({...f,cnpj:e.target.value}))} className="field-input" placeholder="00.000.000/0001-00" />
              </div>
              <div>
                <label className="field-label">Regime Tributário</label>
                <select value={formCliente.regime} onChange={e => setFormCliente(f=>({...f,regime:e.target.value}))} className="field-input" style={{cursor:'pointer'}}>
                  {REGIMES.map(r => <option key={r.id} value={r.id}>{r.label}</option>)}
                </select>
              </div>
              <div>
                <label className="field-label">E-mail</label>
                <input value={formCliente.email} onChange={e => setFormCliente(f=>({...f,email:e.target.value}))} className="field-input" placeholder="cliente@email.com" />
              </div>
              <div>
                <label className="field-label">Telefone</label>
                <input value={formCliente.telefone} onChange={e => setFormCliente(f=>({...f,telefone:e.target.value}))} className="field-input" placeholder="(31) 99999-9999" />
              </div>
            </div>
            <div style={{background:'rgba(0,212,255,.06)',border:'1px solid rgba(0,212,255,.15)',borderRadius:8,padding:'10px 14px',marginBottom:14,fontSize:12,color:'#64748b'}}>
              ℹ️ Ao salvar, as obrigações do regime <strong style={{color:'#00d4ff'}}>{REGIMES.find(r=>r.id===formCliente.regime)?.label}</strong> serão geradas automaticamente para {`${mesesNomes[mesRef-1]}/${anoRef}`}.
            </div>
            <div className="modal-foot">
              <button className="btn-cancel" onClick={() => setShowClienteForm(false)}>Cancelar</button>
              <button className="btn-primary" onClick={salvarCliente} disabled={saving}>{saving ? '⏳...' : '✅ Salvar'}</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

// ─── Componentes auxiliares de UI ─────────────────────────────────────────────
function InfoCard({ label, value, accent }) {
  return (
    <div style={{background:'#1a2540',border:'1px solid #1e2d4a',borderRadius:8,padding:'12px 14px'}}>
      <div style={{fontSize:9,color:'#64748b',textTransform:'uppercase',letterSpacing:.8,marginBottom:5,fontWeight:700}}>{label}</div>
      <div style={{fontSize:14,fontWeight:700,color: accent || '#e2e8f0',fontFamily:'Syne,sans-serif'}}>{value !== null && value !== undefined ? String(value) : '—'}</div>
    </div>
  )
}

function InfoBox({ label, value }) {
  return (
    <div style={{background:'#1a2540',border:'1px solid #1e2d4a',borderRadius:8,padding:'12px 14px',marginBottom:10}}>
      <div style={{fontSize:9,color:'#64748b',textTransform:'uppercase',letterSpacing:.8,marginBottom:5,fontWeight:700}}>{label}</div>
      <div style={{fontSize:13,fontWeight:700,color:'#e2e8f0'}}>{value || '—'}</div>
    </div>
  )
}

// ─── Estilos auxiliares ───────────────────────────────────────────────────────
const btnSmStyle = { padding:'4px 10px',borderRadius:6,border:'1px solid #1e2d4a',background:'#1a2540',color:'#64748b',fontFamily:'DM Mono,monospace',fontSize:11,cursor:'pointer' }

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
  .section-hdr{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:16px;flex-wrap:wrap}
  .btn-primary{display:flex;align-items:center;gap:6px;padding:9px 18px;background:linear-gradient(135deg,var(--accent),#0099bb);border:none;border-radius:9px;color:#fff;font-family:'DM Mono',monospace;font-size:12px;font-weight:600;cursor:pointer;transition:all .18s;white-space:nowrap}
  .btn-primary:hover{box-shadow:0 0 16px rgba(0,212,255,.35);transform:translateY(-1px)}
  .btn-primary:disabled{opacity:.6;cursor:not-allowed;transform:none}
  .btn-cancel{padding:9px 18px;border-radius:9px;background:rgba(100,116,139,.12);border:1px solid var(--border);color:var(--muted);font-family:'DM Mono',monospace;font-size:12px;cursor:pointer}
  .empty{text-align:center;padding:50px 0;color:var(--muted);font-size:13px;line-height:1.8}
  .list-row{display:flex;align-items:center;gap:10px;padding:14px;background:var(--surface);border:1px solid var(--border);border-radius:10px;margin-bottom:8px}
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
  }
`
