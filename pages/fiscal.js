// pages/fiscal.js — Fiscal Vivanexa SaaS
// ===========================================
// Submenus: NF de Produto, NF de Serviço, NF do Consumidor
// ===========================================

import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import Head from 'next/head'
import { supabase } from '../lib/supabase'
import Navbar from '../components/Navbar'

const CSS = `
  *{box-sizing:border-box;margin:0;padding:0}
  :root{
    --bg:#0a0f1e;--surface:#111827;--surface2:#1a2540;--border:#1e2d4a;
    --accent:#00d4ff;--accent2:#7c3aed;--accent3:#10b981;
    --text:#e2e8f0;--muted:#64748b;--danger:#ef4444;--gold:#f59e0b;
  }
  body{background:var(--bg);color:var(--text);font-family:'DM Mono',monospace;min-height:100vh}
  body::before{content:'';position:fixed;inset:0;
    background-image:linear-gradient(rgba(0,212,255,.02) 1px,transparent 1px),linear-gradient(90deg,rgba(0,212,255,.02) 1px,transparent 1px);
    background-size:40px 40px;pointer-events:none;z-index:0}
  .page-wrap{max-width:1100px;margin:0 auto;padding:24px 16px;position:relative;z-index:1}
  .page-title{font-family:'Syne',sans-serif;font-size:22px;font-weight:800;color:var(--text);margin-bottom:4px}
  .page-sub{font-size:12px;color:var(--muted);margin-bottom:20px}
  .tabs{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:24px;border-bottom:1px solid var(--border);padding-bottom:12px}
  .tab-btn{padding:8px 16px;border-radius:8px;border:1px solid var(--border);background:var(--surface2);
    color:var(--muted);font-family:'DM Mono',monospace;font-size:12px;cursor:pointer;transition:all .15s}
  .tab-btn.active{background:rgba(0,212,255,.12);border-color:rgba(0,212,255,.4);color:var(--accent);font-weight:600}
  .card{background:var(--surface);border:1px solid var(--border);border-radius:14px;padding:20px;margin-bottom:16px}
  .card-title{font-family:'Syne',sans-serif;font-size:14px;font-weight:700;color:var(--text);margin-bottom:14px;display:flex;align-items:center;gap:8px}
  .field{margin-bottom:12px}
  .field label{font-size:11px;color:var(--muted);display:block;margin-bottom:4px;letter-spacing:.5px;text-transform:uppercase}
  .field input,.field textarea,.field select{width:100%;background:var(--surface2);border:1px solid var(--border);
    border-radius:8px;padding:9px 12px;font-family:'DM Mono',monospace;font-size:13px;color:var(--text);
    outline:none;transition:border-color .2s;resize:vertical}
  .field input:focus,.field textarea:focus,.field select:focus{border-color:var(--accent)}
  .btn{padding:9px 16px;border-radius:8px;border:none;font-family:'DM Mono',monospace;font-size:12px;
    font-weight:600;cursor:pointer;transition:all .2s;display:inline-flex;align-items:center;gap:6px}
  .btn-primary{background:linear-gradient(135deg,var(--accent),#0099bb);color:#fff}
  .btn-primary:hover{box-shadow:0 0 16px rgba(0,212,255,.4);transform:translateY(-1px)}
  .btn-secondary{background:var(--surface2);border:1px solid var(--border);color:var(--muted)}
  .btn-secondary:hover{border-color:var(--accent);color:var(--accent)}
  .btn-danger{background:rgba(239,68,68,.15);border:1px solid rgba(239,68,68,.3);color:var(--danger)}
  .btn-green{background:linear-gradient(135deg,var(--accent3),#059669);color:#fff}
  .btn:disabled{opacity:.5;cursor:not-allowed;transform:none!important}
  .grid2{display:grid;grid-template-columns:1fr 1fr;gap:12px}
  .grid3{display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px}
  .grid4{display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:10px}
  @media(max-width:640px){.grid2,.grid3,.grid4{grid-template-columns:1fr}}
  .table{width:100%;border-collapse:collapse;font-size:12px}
  .table th{background:var(--surface2);padding:9px 12px;text-align:left;color:var(--muted);font-size:11px;
    text-transform:uppercase;letter-spacing:.5px;border-bottom:1px solid var(--border)}
  .table td{padding:9px 12px;border-bottom:1px solid rgba(30,45,74,.5);color:var(--text);vertical-align:middle}
  .table tr:hover td{background:rgba(30,45,74,.3)}
  .badge{display:inline-block;padding:2px 10px;border-radius:20px;font-size:10px;font-weight:700;letter-spacing:.5px}
  .badge-blue{background:rgba(0,212,255,.15);color:var(--accent);border:1px solid rgba(0,212,255,.3)}
  .badge-green{background:rgba(16,185,129,.15);color:var(--accent3);border:1px solid rgba(16,185,129,.3)}
  .badge-yellow{background:rgba(245,158,11,.15);color:var(--gold);border:1px solid rgba(245,158,11,.3)}
  .badge-red{background:rgba(239,68,68,.15);color:var(--danger);border:1px solid rgba(239,68,68,.3)}
  .stat-row{display:flex;gap:12px;flex-wrap:wrap;margin-bottom:20px}
  .stat-card{background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:14px 18px;flex:1;min-width:130px}
  .stat-val{font-family:'Syne',sans-serif;font-size:22px;font-weight:800;color:var(--accent)}
  .stat-label{font-size:11px;color:var(--muted);margin-top:2px}
  .info-box{padding:12px 16px;border-radius:10px;font-size:12px;line-height:1.6;margin-bottom:12px}
  .info-blue{background:rgba(0,212,255,.08);border:1px solid rgba(0,212,255,.2);color:#94a3b8}
  .info-yellow{background:rgba(245,158,11,.08);border:1px solid rgba(245,158,11,.2);color:#fbbf24}
  .modal-overlay{position:fixed;inset:0;background:rgba(0,0,0,.75);z-index:500;display:flex;align-items:center;justify-content:center;padding:16px}
  .modal-box{background:#111827;border:1px solid #1e2d4a;border-radius:16px;padding:24px;width:100%;max-width:680px;max-height:90vh;overflow-y:auto}
  .modal-header{display:flex;justify-content:space-between;align-items:center;margin-bottom:20px}
  .modal-header h3{font-family:'Syne',sans-serif;font-size:15px;font-weight:700;color:#e2e8f0}
  .modal-close{background:none;border:none;color:#64748b;font-size:20px;cursor:pointer}
  .section-label{font-size:11px;font-weight:700;color:var(--accent);text-transform:uppercase;letter-spacing:1px;margin:16px 0 10px;padding-bottom:6px;border-bottom:1px solid var(--border)}
  .orb{position:fixed;border-radius:50%;filter:blur(120px);pointer-events:none;z-index:0;opacity:.06}
  .orb1{width:400px;height:400px;background:var(--accent);top:-100px;right:-100px}
  .orb2{width:300px;height:300px;background:var(--accent2);bottom:-100px;left:-100px}
  .toast{position:fixed;bottom:24px;right:24px;padding:12px 20px;border-radius:10px;font-size:13px;
    font-family:'DM Mono',monospace;z-index:9999;opacity:0;transform:translateY(20px);transition:all .3s}
  .itens-table{width:100%;border-collapse:collapse;font-size:12px;margin-top:8px}
  .itens-table th{background:var(--surface2);padding:8px 10px;text-align:left;color:var(--muted);font-size:11px;border:1px solid var(--border)}
  .itens-table td{padding:6px 10px;border:1px solid rgba(30,45,74,.4);color:var(--text)}
  .itens-table input{background:transparent;border:none;color:var(--text);font-family:'DM Mono',monospace;font-size:12px;width:100%;outline:none}
  .total-box{background:var(--surface2);border:1px solid var(--border);border-radius:10px;padding:14px 16px;margin-top:12px}
`

function toast(msg, type = 'ok') {
  const el = document.getElementById('fsc-toast')
  if (!el) return
  el.textContent = msg
  el.style.background = type === 'ok' ? 'rgba(16,185,129,.9)' : 'rgba(239,68,68,.9)'
  el.style.color = '#fff'
  el.style.opacity = '1'
  el.style.transform = 'translateY(0)'
  setTimeout(() => { el.style.opacity = '0'; el.style.transform = 'translateY(20px)' }, 3200)
}

function fmt(n) { return 'R$ ' + Number(n || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 }) }
function fmtCNPJ(v) {
  const n = v.replace(/\D/g, '').slice(0, 14)
  if (n.length <= 2) return n
  if (n.length <= 5) return n.replace(/(\d{2})(\d+)/, '$1.$2')
  if (n.length <= 8) return n.replace(/(\d{2})(\d{3})(\d+)/, '$1.$2.$3')
  if (n.length <= 12) return n.replace(/(\d{2})(\d{3})(\d{3})(\d+)/, '$1.$2.$3/$4')
  return n.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d+)/, '$1.$2.$3/$4-$5')
}

const ITEM_VAZIO = { id: '', descricao: '', ncm: '', cfop: '5102', un: 'UN', qtd: '1', vlUnit: '', vl: '0', icms: '12', ipi: '0', pis: '0,65', cofins: '3' }
const SERVICO_VAZIO = { id: '', descricao: '', cst: '0', iss: '5', pis: '0,65', cofins: '3', qtd: '1', vlUnit: '', vl: '0' }

const CFOP_OPCOES = [
  { v: '5101', l: '5101 - Venda de produção própria' },
  { v: '5102', l: '5102 - Venda de mercadoria adquirida' },
  { v: '5405', l: '5405 - Venda de mercadoria sujeita ST' },
  { v: '6101', l: '6101 - Venda interestadual produção' },
  { v: '6102', l: '6102 - Venda interestadual mercadoria' },
]

const NF_VAZIA_PRODUTO = {
  numero: '', serie: '1', natureza: 'Venda de Mercadoria', dataEmissao: new Date().toISOString().slice(0, 10),
  emitente: { cnpj: '', razao: '', ie: '', cep: '', logradouro: '', numero: '', bairro: '', municipio: '', uf: '' },
  destinatario: { cnpj: '', razao: '', ie: '', cep: '', logradouro: '', numero: '', bairro: '', municipio: '', uf: '', email: '' },
  transporte: { modalidade: '0', volumes: '', peso: '' },
  pagamento: { forma: '01', valor: '' },
  itens: [],
  observacoes: '',
  status: 'Rascunho'
}

const NF_VAZIA_SERVICO = {
  numero: '', serie: '1', natureza: 'Prestação de Serviço', dataEmissao: new Date().toISOString().slice(0, 10),
  emitente: { cnpj: '', razao: '', im: '', cep: '', logradouro: '', numero: '', bairro: '', municipio: '', uf: '' },
  tomador: { cnpj: '', razao: '', ie: '', cep: '', logradouro: '', numero: '', bairro: '', municipio: '', uf: '', email: '' },
  itens: [],
  observacoes: '',
  status: 'Rascunho',
  regimeEspecial: ''
}

export default function Fiscal() {
  const router = useRouter()
  const { aba: abaQuery } = router.query
  const [aba, setAba] = useState('produto')
  const [loading, setLoading] = useState(true)
  const [cfg, setCfg] = useState({})
  const [empresaId, setEmpresaId] = useState(null)
  const [perfil, setPerfil] = useState(null)
  const [saving, setSaving] = useState(false)

  // Notas de Produto
  const [nfsProduto, setNfsProduto] = useState([])
  const [showFormProduto, setShowFormProduto] = useState(false)
  const [formProduto, setFormProduto] = useState({ ...NF_VAZIA_PRODUTO })
  const [itensProduto, setItensProduto] = useState([])

  // Notas de Serviço
  const [nfsServico, setNfsServico] = useState([])
  const [showFormServico, setShowFormServico] = useState(false)
  const [formServico, setFormServico] = useState({ ...NF_VAZIA_SERVICO })
  const [itensServico, setItensServico] = useState([])

  // Notas do Consumidor
  const [nfsConsumidor, setNfsConsumidor] = useState([])
  const [showFormConsumidor, setShowFormConsumidor] = useState(false)
  const [formConsumidor, setFormConsumidor] = useState({ ...NF_VAZIA_PRODUTO, natureza: 'Venda ao Consumidor Final' })
  const [itensConsumidor, setItensConsumidor] = useState([])

  const [filtro, setFiltro] = useState('')

  // Certificado digital e controle de numeração
  const [certificadoBase64, setCertificadoBase64] = useState('')
  const [senhaCertificado, setSenhaCertificado] = useState('')
  const [ultimoNumeroNFe, setUltimoNumeroNFe] = useState(0)
  const [ultimoNumeroNFCe, setUltimoNumeroNFCe] = useState(0)
  const [emitindo, setEmitindo] = useState(false)

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
        setNfsProduto(c.nfsProduto || [])
        setNfsServico(c.nfsServico || [])
        setNfsConsumidor(c.nfsConsumidor || [])
        setCertificadoBase64(c.certificadoBase64 || '')
        setSenhaCertificado(c.senhaCertificado || '')
        setUltimoNumeroNFe(c.ultimoNumeroNFe || 0)
        setUltimoNumeroNFCe(c.ultimoNumeroNFCe || 0)
        // Pré-preenche emitente com dados da empresa
        const emit = {
          cnpj: c.cnpj || '', razao: c.company || '', razaoSocial: c.razaoSocial || c.company || '',
          nomeFantasia: c.company || '', ie: c.ie || '', cep: c.cep || '',
          logradouro: c.logradouro || '', numero: c.numeroEnd || '', bairro: c.bairro || '',
          municipio: c.municipio || '', uf: c.uf || '', codigoMunicipio: c.codigoMunicipio || '',
          telefone: c.telefoneEmpresa || '', serie: '1'
        }
        setFormProduto(f => ({ ...f, emitente: emit }))
        setFormServico(f => ({ ...f, emitente: { ...emit, im: c.im || '' } }))
        setFormConsumidor(f => ({ ...f, emitente: emit }))
      }
      setLoading(false)
    }
    init()
  }, [router])

  useEffect(() => { if (abaQuery) setAba(abaQuery) }, [abaQuery])

  async function salvarStorage(novoCfg) {
    await supabase.from('vx_storage').upsert({ key: `cfg:${empresaId}`, value: JSON.stringify(novoCfg), updated_at: new Date().toISOString() }, { onConflict: 'key' })
  }

  async function buscarCNPJ(cnpj, tipo) {
    const num = cnpj.replace(/\D/g, '')
    if (num.length !== 14) return
    try {
      const r = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${num}`)
      if (!r.ok) return
      const d = await r.json()
      const dados = { cnpj: fmtCNPJ(num), razao: d.razao_social || '', municipio: d.municipio || '', uf: d.uf || '', cep: d.cep?.replace(/\D/g, '') || '', logradouro: (d.descricao_tipo_logradouro ? d.descricao_tipo_logradouro + ' ' : '') + (d.logradouro || ''), bairro: d.bairro || '', numero: d.numero || '' }
      if (tipo === 'destProduto') setFormProduto(f => ({ ...f, destinatario: { ...f.destinatario, ...dados } }))
      if (tipo === 'destServico') setFormServico(f => ({ ...f, tomador: { ...f.tomador, ...dados } }))
      if (tipo === 'destConsumidor') setFormConsumidor(f => ({ ...f, destinatario: { ...f.destinatario, ...dados } }))
      toast('CNPJ encontrado!')
    } catch { toast('CNPJ não encontrado', 'err') }
  }

  function calcTotalItens(itens) {
    return itens.reduce((acc, it) => acc + (parseFloat(String(it.vl).replace(',', '.')) || 0), 0)
  }

  function atualizarItemProduto(idx, campo, valor) {
    setItensProduto(prev => {
      const novos = [...prev]
      novos[idx] = { ...novos[idx], [campo]: valor }
      if (campo === 'qtd' || campo === 'vlUnit') {
        const qtd = parseFloat(String(campo === 'qtd' ? valor : novos[idx].qtd).replace(',', '.')) || 0
        const vlUnit = parseFloat(String(campo === 'vlUnit' ? valor : novos[idx].vlUnit).replace(',', '.')) || 0
        novos[idx].vl = (qtd * vlUnit).toFixed(2)
      }
      return novos
    })
  }

  function atualizarItemServico(idx, campo, valor) {
    setItensServico(prev => {
      const novos = [...prev]
      novos[idx] = { ...novos[idx], [campo]: valor }
      if (campo === 'qtd' || campo === 'vlUnit') {
        const qtd = parseFloat(String(campo === 'qtd' ? valor : novos[idx].qtd).replace(',', '.')) || 0
        const vlUnit = parseFloat(String(campo === 'vlUnit' ? valor : novos[idx].vlUnit).replace(',', '.')) || 0
        novos[idx].vl = (qtd * vlUnit).toFixed(2)
      }
      return novos
    })
  }

  function atualizarItemConsumidor(idx, campo, valor) {
    setItensConsumidor(prev => {
      const novos = [...prev]
      novos[idx] = { ...novos[idx], [campo]: valor }
      if (campo === 'qtd' || campo === 'vlUnit') {
        const qtd = parseFloat(String(campo === 'qtd' ? valor : novos[idx].qtd).replace(',', '.')) || 0
        const vlUnit = parseFloat(String(campo === 'vlUnit' ? valor : novos[idx].vlUnit).replace(',', '.')) || 0
        novos[idx].vl = (qtd * vlUnit).toFixed(2)
      }
      return novos
    })
  }

  async function salvarNFProduto() {
    if (!formProduto.emitente.cnpj || !formProduto.destinatario.cnpj) { toast('Preencha os dados do emitente e destinatário', 'err'); return }
    if (itensProduto.length === 0) { toast('Adicione pelo menos um item', 'err'); return }
    setSaving(true)
    const nf = { ...formProduto, id: formProduto.id || String(Date.now()), itens: itensProduto, total: calcTotalItens(itensProduto), numero: formProduto.numero || String(nfsProduto.length + 1).padStart(6, '0'), criadoEm: formProduto.criadoEm || new Date().toISOString() }
    const novas = formProduto.id ? nfsProduto.map(n => n.id === formProduto.id ? nf : n) : [...nfsProduto, nf]
    setNfsProduto(novas)
    const novoCfg = { ...cfg, nfsProduto: novas }
    setCfg(novoCfg)
    await salvarStorage(novoCfg)
    setShowFormProduto(false)
    setItensProduto([])
    setFormProduto({ ...NF_VAZIA_PRODUTO })
    toast('NF-e salva!')
    setSaving(false)
  }

  async function salvarNFServico() {
    if (!formServico.emitente.cnpj || !formServico.tomador.cnpj) { toast('Preencha os dados do emitente e tomador', 'err'); return }
    if (itensServico.length === 0) { toast('Adicione pelo menos um serviço', 'err'); return }
    setSaving(true)
    const nf = { ...formServico, id: formServico.id || String(Date.now()), itens: itensServico, total: calcTotalItens(itensServico), numero: formServico.numero || String(nfsServico.length + 1).padStart(6, '0'), criadoEm: formServico.criadoEm || new Date().toISOString() }
    const novas = formServico.id ? nfsServico.map(n => n.id === formServico.id ? nf : n) : [...nfsServico, nf]
    setNfsServico(novas)
    const novoCfg = { ...cfg, nfsServico: novas }
    setCfg(novoCfg)
    await salvarStorage(novoCfg)
    setShowFormServico(false)
    setItensServico([])
    setFormServico({ ...NF_VAZIA_SERVICO })
    toast('NFS-e salva!')
    setSaving(false)
  }

  async function salvarNFConsumidor() {
    if (!formConsumidor.emitente.cnpj) { toast('Preencha os dados do emitente', 'err'); return }
    if (itensConsumidor.length === 0) { toast('Adicione pelo menos um item', 'err'); return }
    setSaving(true)
    const nf = { ...formConsumidor, id: formConsumidor.id || String(Date.now()), itens: itensConsumidor, total: calcTotalItens(itensConsumidor), numero: formConsumidor.numero || String(nfsConsumidor.length + 1).padStart(6, '0'), criadoEm: formConsumidor.criadoEm || new Date().toISOString() }
    const novas = formConsumidor.id ? nfsConsumidor.map(n => n.id === formConsumidor.id ? nf : n) : [...nfsConsumidor, nf]
    setNfsConsumidor(novas)
    const novoCfg = { ...cfg, nfsConsumidor: novas }
    setCfg(novoCfg)
    await salvarStorage(novoCfg)
    setShowFormConsumidor(false)
    setItensConsumidor([])
    setFormConsumidor({ ...NF_VAZIA_PRODUTO, natureza: 'Venda ao Consumidor Final' })
    toast('NFC-e salva!')
    setSaving(false)
  }

  // ── EMISSÃO REAL NA SEFAZ ──
  async function emitirNFeSefaz(modelo) {
    if (!certificadoBase64) {
      toast('Certificado digital não configurado. Acesse Configurações → Empresa.', 'err')
      return
    }

    const emit = modelo === '65' ? formConsumidor.emitente : (modelo === '55' && aba === 'servico' ? formServico.emitente : formProduto.emitente)

    let destinatario = {}
    let produtos = []

    if (modelo === '55' && aba !== 'consumidor') {
      const form = aba === 'servico' ? formServico : formProduto
      const itens = aba === 'servico' ? itensServico : itensProduto
      const dest = aba === 'servico' ? form.tomador : form.destinatario
      destinatario = {
        cnpj: dest.cnpj, cpf: dest.cpf, nome: dest.razao,
        isento: dest.ie === 'ISENTO', ie: dest.ie,
        logradouro: dest.logradouro, numero: dest.numero,
        complemento: dest.complemento, bairro: dest.bairro,
        codigoMunicipio: dest.codigoMunicipio || '', municipio: dest.municipio,
        uf: dest.uf, cep: dest.cep, telefone: dest.telefone
      }
      produtos = itens.map((it, i) => ({
        codigoProduto: it.id || String(i + 1).padStart(6, '0'),
        descricao: it.descricao,
        ncm: it.ncm || '00000000',
        cfop: it.cfop || '5102',
        unidade: it.un || 'UN',
        quantidade: Number(String(it.qtd).replace(',', '.')) || 1,
        valorUnitario: Number(String(it.vlUnit).replace(',', '.')) || 0,
        desconto: 0,
        codigoBarras: 'SEM GTIN',
        csosn: '400'
      }))
    } else {
      // NFC-e consumidor
      const dest = formConsumidor.destinatario
      if (dest?.cnpj) destinatario = { cnpj: dest.cnpj, cpf: dest.cpf, nome: dest.razao || 'CONSUMIDOR NAO IDENTIFICADO' }
      produtos = itensConsumidor.map((it, i) => ({
        codigoProduto: it.id || String(i + 1).padStart(6, '0'),
        descricao: it.descricao,
        ncm: it.ncm || '00000000',
        cfop: it.cfop || '5102',
        unidade: it.un || 'UN',
        quantidade: Number(String(it.qtd).replace(',', '.')) || 1,
        valorUnitario: Number(String(it.vlUnit).replace(',', '.')) || 0,
        codigoBarras: 'SEM GTIN',
        csosn: '400'
      }))
    }

    if (!emit.cnpj) { toast('Dados do emitente incompletos. Verifique Configurações.', 'err'); return }
    if (produtos.length === 0) { toast('Adicione pelo menos um item antes de emitir.', 'err'); return }

    const dadosNota = {
      naturezaOperacao: modelo === '55' && aba === 'servico' ? 'PRESTAÇÃO DE SERVIÇO' : 'VENDA DE MERCADORIA',
      tipoOperacao: '1',
      dataSaida: new Date().toISOString().slice(0, 10),
      horaSaida: '12:00:00',
      formaPagamento: modelo === '65' ? (formConsumidor.pagamento?.forma || '01') : '01'
    }

    setEmitindo(true)
    try {
      const response = await fetch('/api/nfe/emitir', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          emitente: emit,
          destinatario,
          produtos,
          dadosNota,
          tpAmb: cfg.nfeTpAmb || '2',
          modelo,
          certificadoBase64,
          senhaCertificado,
          ultimoNumero: modelo === '55' ? ultimoNumeroNFe : ultimoNumeroNFCe
        })
      })

      const result = await response.json()

      if (response.ok && result.status === 'autorizada') {
        const novaNota = {
          id: String(Date.now()),
          numero: result.numero,
          chave: result.chave,
          protocolo: result.protocolo,
          xmlProtocolado: result.xml,
          valor: produtos.reduce((s, p) => s + p.quantidade * p.valorUnitario, 0),
          dataEmissao: new Date().toISOString().slice(0, 10),
          status: 'Emitida',
          destinatario: { razao: destinatario.nome || 'Consumidor' },
          itens: produtos,
          emitidaViaSefaz: true,
          ambiente: cfg.nfeTpAmb === '1' ? 'Produção' : 'Homologação'
        }

        if (modelo === '55') {
          const novas = [...nfsProduto, novaNota]
          setNfsProduto(novas)
          const novoNumero = parseInt(result.numero)
          setUltimoNumeroNFe(novoNumero)
          const novoCfg = { ...cfg, nfsProduto: novas, ultimoNumeroNFe: novoNumero }
          setCfg(novoCfg)
          await salvarStorage(novoCfg)
          setShowFormProduto(false)
          setItensProduto([])
          setFormProduto({ ...NF_VAZIA_PRODUTO })
        } else {
          const novas = [...nfsConsumidor, novaNota]
          setNfsConsumidor(novas)
          const novoNumero = parseInt(result.numero)
          setUltimoNumeroNFCe(novoNumero)
          const novoCfg = { ...cfg, nfsConsumidor: novas, ultimoNumeroNFCe: novoNumero }
          setCfg(novoCfg)
          await salvarStorage(novoCfg)
          setShowFormConsumidor(false)
          setItensConsumidor([])
          setFormConsumidor({ ...NF_VAZIA_PRODUTO, natureza: 'Venda ao Consumidor Final' })
        }

        toast(`✅ NF-e ${result.numero} autorizada! Protocolo: ${result.protocolo}`)
      } else {
        toast(`❌ SEFAZ: ${result.motivo || result.error} (cStat: ${result.cStat || ''})`, 'err')
      }
    } catch (err) {
      console.error(err)
      toast('Erro na emissão: ' + err.message, 'err')
    } finally {
      setEmitindo(false)
    }
  }

  async function cancelarNFeSefaz(nf, tipo) {
    const justificativa = prompt('Informe a justificativa do cancelamento (mínimo 15 caracteres):')
    if (!justificativa || justificativa.length < 15) {
      toast('Justificativa inválida (mínimo 15 caracteres)', 'err')
      return
    }
    if (!certificadoBase64) { toast('Certificado não configurado', 'err'); return }

    try {
      const response = await fetch('/api/nfe/cancelar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chave: nf.chave,
          protocolo: nf.protocolo,
          justificativa,
          emitente: formProduto.emitente,
          tpAmb: cfg.nfeTpAmb || '2',
          certificadoBase64,
          senhaCertificado
        })
      })
      const result = await response.json()
      if (response.ok && result.status === 'cancelada') {
        const atualizar = (lista, setLista, chave) => {
          const novas = lista.map(n => n.id === nf.id ? { ...n, status: 'Cancelada' } : n)
          setLista(novas)
          return novas
        }
        if (tipo === 'produto') {
          const novas = atualizar(nfsProduto, setNfsProduto)
          await salvarStorage({ ...cfg, nfsProduto: novas })
        } else {
          const novas = atualizar(nfsConsumidor, setNfsConsumidor)
          await salvarStorage({ ...cfg, nfsConsumidor: novas })
        }
        toast('✅ NF-e cancelada com sucesso!')
      } else {
        toast(`❌ Erro: ${result.motivo}`, 'err')
      }
    } catch (err) {
      toast('Erro no cancelamento: ' + err.message, 'err')
    }
  }

  async function excluirNF(tipo, id) {
    if (!confirm('Excluir esta nota fiscal?')) return
    if (tipo === 'produto') {
      const novas = nfsProduto.filter(n => n.id !== id)
      setNfsProduto(novas)
      const novoCfg = { ...cfg, nfsProduto: novas }
      setCfg(novoCfg)
      await salvarStorage(novoCfg)
    } else if (tipo === 'servico') {
      const novas = nfsServico.filter(n => n.id !== id)
      setNfsServico(novas)
      const novoCfg = { ...cfg, nfsServico: novas }
      setCfg(novoCfg)
      await salvarStorage(novoCfg)
    } else {
      const novas = nfsConsumidor.filter(n => n.id !== id)
      setNfsConsumidor(novas)
      const novoCfg = { ...cfg, nfsConsumidor: novas }
      setCfg(novoCfg)
      await salvarStorage(novoCfg)
    }
    toast('Nota excluída')
  }

  function renderTabelaNFs(notas, tipo) {
    const filtradas = notas.filter(n =>
      !filtro || (n.numero || '').includes(filtro) || (n.destinatario?.razao || n.tomador?.razao || '').toLowerCase().includes(filtro.toLowerCase())
    )
    return (
      <div style={{ overflowX: 'auto' }}>
        <table className="table">
          <thead>
            <tr>
              <th>Nº</th>
              <th>Data</th>
              <th>{tipo === 'servico' ? 'Tomador' : 'Destinatário'}</th>
              <th>Total</th>
              <th>Status</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody>
            {filtradas.length === 0 ? (
              <tr><td colSpan={6} style={{ textAlign: 'center', color: '#64748b', padding: 20 }}>Nenhuma nota fiscal encontrada</td></tr>
            ) : filtradas.map(nf => (
              <tr key={nf.id}>
                <td>{nf.numero || '—'}</td>
                <td>{nf.dataEmissao || '—'}</td>
                <td style={{ maxWidth: 200 }}>{nf.destinatario?.razao || nf.tomador?.razao || '—'}</td>
                <td>{fmt(nf.total || 0)}</td>
                <td>
                  <span className={`badge ${nf.status === 'Emitida' ? 'badge-green' : nf.status === 'Cancelada' ? 'badge-red' : nf.status === 'Rascunho' ? 'badge-yellow' : 'badge-blue'}`}>
                    {nf.status}
                  </span>
                </td>
                <td>
                  <div style={{ display: 'flex', gap: 4 }}>
                    <button className="btn btn-secondary" style={{ fontSize: 10, padding: '3px 8px' }}
                      onClick={() => {
                        if (tipo === 'produto') { setFormProduto(nf); setItensProduto(nf.itens || []); setShowFormProduto(true) }
                        else if (tipo === 'servico') { setFormServico(nf); setItensServico(nf.itens || []); setShowFormServico(true) }
                        else { setFormConsumidor(nf); setItensConsumidor(nf.itens || []); setShowFormConsumidor(true) }
                      }}>✏️ Editar</button>
                    {nf.emitidaViaSefaz && nf.status === 'Emitida' && (
                      <button className="btn btn-secondary" style={{ fontSize: 10, padding: '3px 8px' }} onClick={() => cancelarNFeSefaz(nf, tipo)}>❌ Cancel.</button>
                    )}
                    <button className="btn btn-danger" style={{ fontSize: 10, padding: '3px 8px' }} onClick={() => excluirNF(tipo, nf.id)}>🗑</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )
  }

  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0a0f1e', color: '#64748b', fontFamily: 'DM Mono, monospace' }}>
      Carregando Fiscal...
    </div>
  )

  const totalNFs = nfsProduto.length + nfsServico.length + nfsConsumidor.length
  const totalValor = [...nfsProduto, ...nfsServico, ...nfsConsumidor].reduce((a, n) => a + (n.total || 0), 0)

  return (
    <>
      <Head>
        <title>Fiscal — {cfg.company || 'Vivanexa'}</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <link href="https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=DM+Mono:wght@300;400;500&display=swap" rel="stylesheet" />
      </Head>
      <style>{CSS}</style>
      <div className="orb orb1" /><div className="orb orb2" />

      {/* NAVBAR */}
      <Navbar cfg={cfg} perfil={perfil} />

      <div className="page-wrap">
        <div className="page-title">📄 Fiscal</div>
        <div className="page-sub">Emissão de notas fiscais de produto, serviço e consumidor</div>

        <div className="info-box info-yellow" style={{ marginBottom: 16 }}>
          {certificadoBase64
            ? <>✅ <strong>Certificado digital configurado.</strong> Ambiente: <strong>{cfg.nfeTpAmb === '1' ? '🟢 Produção' : '🟡 Homologação (teste)'}</strong>. Use o botão <strong>"Emitir NF-e SEFAZ"</strong> para enviar à SEFAZ.</>
            : <>⚠️ <strong>Certificado digital não configurado.</strong> Acesse <strong>Configurações → Empresa</strong> e faça o upload do arquivo .pfx para emitir notas com validade fiscal.</>
          }
        </div>

        {/* Stats */}
        <div className="stat-row">
          <div className="stat-card">
            <div className="stat-val">{nfsProduto.length}</div>
            <div className="stat-label">NF-e Produto</div>
          </div>
          <div className="stat-card">
            <div className="stat-val">{nfsServico.length}</div>
            <div className="stat-label">NFS-e Serviço</div>
          </div>
          <div className="stat-card">
            <div className="stat-val">{nfsConsumidor.length}</div>
            <div className="stat-label">NFC-e Consumidor</div>
          </div>
          <div className="stat-card">
            <div className="stat-val" style={{ fontSize: 16 }}>{fmt(totalValor)}</div>
            <div className="stat-label">Total Emitido</div>
          </div>
        </div>

        {/* Tabs */}
        <div className="tabs">
          <button className={`tab-btn ${aba === 'produto' ? 'active' : ''}`} onClick={() => setAba('produto')}>📦 NF de Produto (NF-e)</button>
          <button className={`tab-btn ${aba === 'servico' ? 'active' : ''}`} onClick={() => setAba('servico')}>🛠️ NF de Serviço (NFS-e)</button>
          <button className={`tab-btn ${aba === 'consumidor' ? 'active' : ''}`} onClick={() => setAba('consumidor')}>🧾 NF Consumidor (NFC-e)</button>
        </div>

        {/* ── ABA NF-e PRODUTO ── */}
        {aba === 'produto' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
              <input value={filtro} onChange={e => setFiltro(e.target.value)} placeholder="🔍 Buscar por número ou destinatário..." style={{ background: '#1a2540', border: '1px solid #1e2d4a', borderRadius: 8, padding: '8px 12px', fontFamily: 'DM Mono, monospace', fontSize: 12, color: '#e2e8f0', outline: 'none', width: 280 }} />
              <button className="btn btn-primary" onClick={() => { setFormProduto({ ...NF_VAZIA_PRODUTO }); setItensProduto([]); setShowFormProduto(true) }}>+ Nova NF-e</button>
            </div>
            <div className="card">{renderTabelaNFs(nfsProduto, 'produto')}</div>
          </div>
        )}

        {/* ── ABA NFS-e SERVIÇO ── */}
        {aba === 'servico' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
              <input value={filtro} onChange={e => setFiltro(e.target.value)} placeholder="🔍 Buscar por número ou tomador..." style={{ background: '#1a2540', border: '1px solid #1e2d4a', borderRadius: 8, padding: '8px 12px', fontFamily: 'DM Mono, monospace', fontSize: 12, color: '#e2e8f0', outline: 'none', width: 280 }} />
              <button className="btn btn-primary" onClick={() => { setFormServico({ ...NF_VAZIA_SERVICO }); setItensServico([]); setShowFormServico(true) }}>+ Nova NFS-e</button>
            </div>
            <div className="card">{renderTabelaNFs(nfsServico, 'servico')}</div>
          </div>
        )}

        {/* ── ABA NFC-e CONSUMIDOR ── */}
        {aba === 'consumidor' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
              <input value={filtro} onChange={e => setFiltro(e.target.value)} placeholder="🔍 Buscar..." style={{ background: '#1a2540', border: '1px solid #1e2d4a', borderRadius: 8, padding: '8px 12px', fontFamily: 'DM Mono, monospace', fontSize: 12, color: '#e2e8f0', outline: 'none', width: 280 }} />
              <button className="btn btn-primary" onClick={() => { setFormConsumidor({ ...NF_VAZIA_PRODUTO, natureza: 'Venda ao Consumidor Final' }); setItensConsumidor([]); setShowFormConsumidor(true) }}>+ Nova NFC-e</button>
            </div>
            <div className="card">{renderTabelaNFs(nfsConsumidor, 'consumidor')}</div>
          </div>
        )}
      </div>

      {/* ── MODAL NF-e PRODUTO ── */}
      {showFormProduto && (
        <div className="modal-overlay">
          <div className="modal-box" style={{ maxWidth: 800 }}>
            <div className="modal-header">
              <h3>📦 {formProduto.id ? 'Editar' : 'Nova'} NF-e de Produto</h3>
              <button className="modal-close" onClick={() => setShowFormProduto(false)}>✕</button>
            </div>

            <div className="grid3">
              <div className="field"><label>Número</label><input value={formProduto.numero} onChange={e => setFormProduto(f => ({ ...f, numero: e.target.value }))} placeholder="000001" /></div>
              <div className="field"><label>Série</label><input value={formProduto.serie} onChange={e => setFormProduto(f => ({ ...f, serie: e.target.value }))} /></div>
              <div className="field"><label>Data Emissão</label><input type="date" value={formProduto.dataEmissao} onChange={e => setFormProduto(f => ({ ...f, dataEmissao: e.target.value }))} /></div>
            </div>
            <div className="field"><label>Natureza da Operação</label><input value={formProduto.natureza} onChange={e => setFormProduto(f => ({ ...f, natureza: e.target.value }))} /></div>

            <div className="section-label">🏢 Emitente</div>
            <div className="grid3">
              <div className="field"><label>CNPJ</label><input value={formProduto.emitente.cnpj} onChange={e => setFormProduto(f => ({ ...f, emitente: { ...f.emitente, cnpj: fmtCNPJ(e.target.value) } }))} /></div>
              <div className="field"><label>Razão Social</label><input value={formProduto.emitente.razao} onChange={e => setFormProduto(f => ({ ...f, emitente: { ...f.emitente, razao: e.target.value } }))} /></div>
              <div className="field"><label>IE</label><input value={formProduto.emitente.ie} onChange={e => setFormProduto(f => ({ ...f, emitente: { ...f.emitente, ie: e.target.value } }))} /></div>
              <div className="field"><label>Município</label><input value={formProduto.emitente.municipio} onChange={e => setFormProduto(f => ({ ...f, emitente: { ...f.emitente, municipio: e.target.value } }))} /></div>
              <div className="field"><label>UF</label><input value={formProduto.emitente.uf} onChange={e => setFormProduto(f => ({ ...f, emitente: { ...f.emitente, uf: e.target.value } }))} maxLength={2} /></div>
            </div>

            <div className="section-label">👤 Destinatário</div>
            <div className="grid3">
              <div className="field"><label>CNPJ/CPF</label>
                <div style={{ display: 'flex', gap: 6 }}>
                  <input value={formProduto.destinatario.cnpj} onChange={e => setFormProduto(f => ({ ...f, destinatario: { ...f.destinatario, cnpj: fmtCNPJ(e.target.value) } }))} style={{ flex: 1 }} />
                  <button className="btn btn-secondary" style={{ padding: '4px 10px', fontSize: 11 }} onClick={() => buscarCNPJ(formProduto.destinatario.cnpj, 'destProduto')}>🔍</button>
                </div>
              </div>
              <div className="field"><label>Razão Social</label><input value={formProduto.destinatario.razao} onChange={e => setFormProduto(f => ({ ...f, destinatario: { ...f.destinatario, razao: e.target.value } }))} /></div>
              <div className="field"><label>IE</label><input value={formProduto.destinatario.ie} onChange={e => setFormProduto(f => ({ ...f, destinatario: { ...f.destinatario, ie: e.target.value } }))} /></div>
              <div className="field"><label>Município</label><input value={formProduto.destinatario.municipio} onChange={e => setFormProduto(f => ({ ...f, destinatario: { ...f.destinatario, municipio: e.target.value } }))} /></div>
              <div className="field"><label>UF</label><input value={formProduto.destinatario.uf} onChange={e => setFormProduto(f => ({ ...f, destinatario: { ...f.destinatario, uf: e.target.value } }))} maxLength={2} /></div>
              <div className="field"><label>E-mail</label><input type="email" value={formProduto.destinatario.email} onChange={e => setFormProduto(f => ({ ...f, destinatario: { ...f.destinatario, email: e.target.value } }))} /></div>
            </div>

            <div className="section-label">📦 Itens</div>
            <div style={{ overflowX: 'auto' }}>
              <table className="itens-table">
                <thead>
                  <tr>
                    <th style={{ minWidth: 160 }}>Descrição</th>
                    <th style={{ minWidth: 80 }}>NCM</th>
                    <th style={{ minWidth: 80 }}>CFOP</th>
                    <th style={{ minWidth: 50 }}>UN</th>
                    <th style={{ minWidth: 60 }}>Qtd</th>
                    <th style={{ minWidth: 80 }}>Vl Unit</th>
                    <th style={{ minWidth: 80 }}>Total</th>
                    <th style={{ minWidth: 50 }}>ICMS%</th>
                    <th style={{ minWidth: 30 }}></th>
                  </tr>
                </thead>
                <tbody>
                  {itensProduto.map((it, idx) => (
                    <tr key={idx}>
                      <td><input value={it.descricao} onChange={e => atualizarItemProduto(idx, 'descricao', e.target.value)} /></td>
                      <td><input value={it.ncm} onChange={e => atualizarItemProduto(idx, 'ncm', e.target.value)} /></td>
                      <td>
                        <select value={it.cfop} onChange={e => atualizarItemProduto(idx, 'cfop', e.target.value)} style={{ background: 'transparent', border: 'none', color: '#e2e8f0', fontFamily: 'DM Mono, monospace', fontSize: 12 }}>
                          {CFOP_OPCOES.map(o => <option key={o.v} value={o.v}>{o.v}</option>)}
                        </select>
                      </td>
                      <td><input value={it.un} onChange={e => atualizarItemProduto(idx, 'un', e.target.value)} /></td>
                      <td><input type="number" value={it.qtd} onChange={e => atualizarItemProduto(idx, 'qtd', e.target.value)} /></td>
                      <td><input type="number" value={it.vlUnit} onChange={e => atualizarItemProduto(idx, 'vlUnit', e.target.value)} /></td>
                      <td style={{ color: '#10b981' }}>{fmt(parseFloat(it.vl) || 0)}</td>
                      <td><input type="number" value={it.icms} onChange={e => atualizarItemProduto(idx, 'icms', e.target.value)} /></td>
                      <td><button onClick={() => setItensProduto(p => p.filter((_, i) => i !== idx))} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: 14 }}>✕</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <button className="btn btn-secondary" style={{ marginTop: 8 }} onClick={() => setItensProduto(p => [...p, { ...ITEM_VAZIO, id: String(Date.now()) }])}>+ Adicionar Item</button>

            {itensProduto.length > 0 && (
              <div className="total-box">
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                  <span style={{ color: '#64748b' }}>Total dos Itens:</span>
                  <span style={{ color: '#10b981', fontWeight: 700, fontSize: 16 }}>{fmt(calcTotalItens(itensProduto))}</span>
                </div>
              </div>
            )}

            <div className="section-label">💳 Pagamento</div>
            <div className="grid2">
              <div className="field"><label>Forma de Pagamento</label>
                <select value={formProduto.pagamento.forma} onChange={e => setFormProduto(f => ({ ...f, pagamento: { ...f.pagamento, forma: e.target.value } }))} style={{ width: '100%', background: '#1a2540', border: '1px solid #1e2d4a', borderRadius: 8, padding: '9px 12px', fontFamily: 'DM Mono, monospace', fontSize: 13, color: '#e2e8f0', outline: 'none' }}>
                  <option value="01">Dinheiro</option>
                  <option value="02">Cheque</option>
                  <option value="03">Cartão de Crédito</option>
                  <option value="04">Cartão de Débito</option>
                  <option value="05">Crédito Loja</option>
                  <option value="10">Vale Alimentação</option>
                  <option value="15">Boleto Bancário</option>
                  <option value="17">PIX</option>
                  <option value="99">Outros</option>
                </select>
              </div>
              <div className="field"><label>Status da Nota</label>
                <select value={formProduto.status} onChange={e => setFormProduto(f => ({ ...f, status: e.target.value }))} style={{ width: '100%', background: '#1a2540', border: '1px solid #1e2d4a', borderRadius: 8, padding: '9px 12px', fontFamily: 'DM Mono, monospace', fontSize: 13, color: '#e2e8f0', outline: 'none' }}>
                  <option value="Rascunho">Rascunho</option>
                  <option value="Emitida">Emitida</option>
                  <option value="Cancelada">Cancelada</option>
                  <option value="Denegada">Denegada</option>
                </select>
              </div>
            </div>

            <div className="field"><label>Observações</label><textarea value={formProduto.observacoes} onChange={e => setFormProduto(f => ({ ...f, observacoes: e.target.value }))} placeholder="Informações complementares..." /></div>

            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 8 }}>
              <button className="btn btn-secondary" onClick={() => setShowFormProduto(false)}>Cancelar</button>
              <button className="btn btn-primary" onClick={salvarNFProduto} disabled={saving}>{saving ? '⏳ Salvando...' : '💾 Salvar Rascunho'}</button>
              <button className="btn btn-green" onClick={() => emitirNFeSefaz('55')} disabled={emitindo || saving}>{emitindo ? '⏳ Emitindo...' : '📤 Emitir NF-e SEFAZ'}</button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL NFS-e SERVIÇO ── */}
      {showFormServico && (
        <div className="modal-overlay">
          <div className="modal-box" style={{ maxWidth: 800 }}>
            <div className="modal-header">
              <h3>🛠️ {formServico.id ? 'Editar' : 'Nova'} NFS-e de Serviço</h3>
              <button className="modal-close" onClick={() => setShowFormServico(false)}>✕</button>
            </div>

            <div className="grid3">
              <div className="field"><label>Número</label><input value={formServico.numero} onChange={e => setFormServico(f => ({ ...f, numero: e.target.value }))} placeholder="000001" /></div>
              <div className="field"><label>Série</label><input value={formServico.serie} onChange={e => setFormServico(f => ({ ...f, serie: e.target.value }))} /></div>
              <div className="field"><label>Data Emissão</label><input type="date" value={formServico.dataEmissao} onChange={e => setFormServico(f => ({ ...f, dataEmissao: e.target.value }))} /></div>
            </div>
            <div className="grid2">
              <div className="field"><label>Natureza da Operação</label><input value={formServico.natureza} onChange={e => setFormServico(f => ({ ...f, natureza: e.target.value }))} /></div>
              <div className="field"><label>Regime Especial Tributação</label>
                <select value={formServico.regimeEspecial} onChange={e => setFormServico(f => ({ ...f, regimeEspecial: e.target.value }))} style={{ width: '100%', background: '#1a2540', border: '1px solid #1e2d4a', borderRadius: 8, padding: '9px 12px', fontFamily: 'DM Mono, monospace', fontSize: 13, color: '#e2e8f0', outline: 'none' }}>
                  <option value="">Nenhum</option>
                  <option value="1">Microempresa Municipal</option>
                  <option value="2">Estimativa</option>
                  <option value="3">Sociedade de Profissionais</option>
                  <option value="4">Cooperativa</option>
                  <option value="5">MEI - Simples Nacional</option>
                  <option value="6">ME EPP - Simples Nacional</option>
                </select>
              </div>
            </div>

            <div className="section-label">🏢 Prestador (Emitente)</div>
            <div className="grid3">
              <div className="field"><label>CNPJ</label><input value={formServico.emitente.cnpj} onChange={e => setFormServico(f => ({ ...f, emitente: { ...f.emitente, cnpj: fmtCNPJ(e.target.value) } }))} /></div>
              <div className="field"><label>Razão Social</label><input value={formServico.emitente.razao} onChange={e => setFormServico(f => ({ ...f, emitente: { ...f.emitente, razao: e.target.value } }))} /></div>
              <div className="field"><label>Inscrição Municipal</label><input value={formServico.emitente.im || ''} onChange={e => setFormServico(f => ({ ...f, emitente: { ...f.emitente, im: e.target.value } }))} /></div>
              <div className="field"><label>Município</label><input value={formServico.emitente.municipio} onChange={e => setFormServico(f => ({ ...f, emitente: { ...f.emitente, municipio: e.target.value } }))} /></div>
              <div className="field"><label>UF</label><input value={formServico.emitente.uf} onChange={e => setFormServico(f => ({ ...f, emitente: { ...f.emitente, uf: e.target.value } }))} maxLength={2} /></div>
            </div>

            <div className="section-label">👤 Tomador</div>
            <div className="grid3">
              <div className="field"><label>CNPJ/CPF</label>
                <div style={{ display: 'flex', gap: 6 }}>
                  <input value={formServico.tomador.cnpj} onChange={e => setFormServico(f => ({ ...f, tomador: { ...f.tomador, cnpj: fmtCNPJ(e.target.value) } }))} style={{ flex: 1 }} />
                  <button className="btn btn-secondary" style={{ padding: '4px 10px', fontSize: 11 }} onClick={() => buscarCNPJ(formServico.tomador.cnpj, 'destServico')}>🔍</button>
                </div>
              </div>
              <div className="field"><label>Razão Social</label><input value={formServico.tomador.razao} onChange={e => setFormServico(f => ({ ...f, tomador: { ...f.tomador, razao: e.target.value } }))} /></div>
              <div className="field"><label>E-mail</label><input type="email" value={formServico.tomador.email} onChange={e => setFormServico(f => ({ ...f, tomador: { ...f.tomador, email: e.target.value } }))} /></div>
              <div className="field"><label>Município</label><input value={formServico.tomador.municipio} onChange={e => setFormServico(f => ({ ...f, tomador: { ...f.tomador, municipio: e.target.value } }))} /></div>
              <div className="field"><label>UF</label><input value={formServico.tomador.uf} onChange={e => setFormServico(f => ({ ...f, tomador: { ...f.tomador, uf: e.target.value } }))} maxLength={2} /></div>
            </div>

            <div className="section-label">🛠️ Serviços</div>
            <div style={{ overflowX: 'auto' }}>
              <table className="itens-table">
                <thead>
                  <tr>
                    <th style={{ minWidth: 200 }}>Descrição do Serviço</th>
                    <th style={{ minWidth: 60 }}>Qtd</th>
                    <th style={{ minWidth: 80 }}>Vl Unit</th>
                    <th style={{ minWidth: 80 }}>Total</th>
                    <th style={{ minWidth: 60 }}>ISS%</th>
                    <th style={{ minWidth: 60 }}>PIS%</th>
                    <th style={{ minWidth: 60 }}>COFINS%</th>
                    <th style={{ minWidth: 30 }}></th>
                  </tr>
                </thead>
                <tbody>
                  {itensServico.map((it, idx) => (
                    <tr key={idx}>
                      <td><input value={it.descricao} onChange={e => atualizarItemServico(idx, 'descricao', e.target.value)} /></td>
                      <td><input type="number" value={it.qtd} onChange={e => atualizarItemServico(idx, 'qtd', e.target.value)} /></td>
                      <td><input type="number" value={it.vlUnit} onChange={e => atualizarItemServico(idx, 'vlUnit', e.target.value)} /></td>
                      <td style={{ color: '#10b981' }}>{fmt(parseFloat(it.vl) || 0)}</td>
                      <td><input value={it.iss} onChange={e => atualizarItemServico(idx, 'iss', e.target.value)} /></td>
                      <td><input value={it.pis} onChange={e => atualizarItemServico(idx, 'pis', e.target.value)} /></td>
                      <td><input value={it.cofins} onChange={e => atualizarItemServico(idx, 'cofins', e.target.value)} /></td>
                      <td><button onClick={() => setItensServico(p => p.filter((_, i) => i !== idx))} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: 14 }}>✕</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <button className="btn btn-secondary" style={{ marginTop: 8 }} onClick={() => setItensServico(p => [...p, { ...SERVICO_VAZIO, id: String(Date.now()) }])}>+ Adicionar Serviço</button>

            {itensServico.length > 0 && (
              <div className="total-box">
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#64748b', fontSize: 13 }}>Total dos Serviços:</span>
                  <span style={{ color: '#10b981', fontWeight: 700, fontSize: 16 }}>{fmt(calcTotalItens(itensServico))}</span>
                </div>
              </div>
            )}

            <div className="grid2" style={{ marginTop: 12 }}>
              <div className="field"><label>Status da Nota</label>
                <select value={formServico.status} onChange={e => setFormServico(f => ({ ...f, status: e.target.value }))} style={{ width: '100%', background: '#1a2540', border: '1px solid #1e2d4a', borderRadius: 8, padding: '9px 12px', fontFamily: 'DM Mono, monospace', fontSize: 13, color: '#e2e8f0', outline: 'none' }}>
                  <option value="Rascunho">Rascunho</option>
                  <option value="Emitida">Emitida</option>
                  <option value="Cancelada">Cancelada</option>
                </select>
              </div>
            </div>
            <div className="field"><label>Observações</label><textarea value={formServico.observacoes} onChange={e => setFormServico(f => ({ ...f, observacoes: e.target.value }))} placeholder="Informações complementares..." /></div>

            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 8 }}>
              <button className="btn btn-secondary" onClick={() => setShowFormServico(false)}>Cancelar</button>
              <button className="btn btn-primary" onClick={salvarNFServico} disabled={saving}>{saving ? '⏳ Salvando...' : '💾 Salvar Rascunho'}</button>
              <button className="btn btn-green" onClick={() => emitirNFeSefaz('55')} disabled={emitindo || saving}>{emitindo ? '⏳ Emitindo...' : '📤 Emitir NFS-e SEFAZ'}</button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL NFC-e CONSUMIDOR ── */}
      {showFormConsumidor && (
        <div className="modal-overlay">
          <div className="modal-box" style={{ maxWidth: 700 }}>
            <div className="modal-header">
              <h3>🧾 {formConsumidor.id ? 'Editar' : 'Nova'} NFC-e (Consumidor Final)</h3>
              <button className="modal-close" onClick={() => setShowFormConsumidor(false)}>✕</button>
            </div>

            <div className="grid3">
              <div className="field"><label>Número</label><input value={formConsumidor.numero} onChange={e => setFormConsumidor(f => ({ ...f, numero: e.target.value }))} /></div>
              <div className="field"><label>Série</label><input value={formConsumidor.serie} onChange={e => setFormConsumidor(f => ({ ...f, serie: e.target.value }))} /></div>
              <div className="field"><label>Data Emissão</label><input type="date" value={formConsumidor.dataEmissao} onChange={e => setFormConsumidor(f => ({ ...f, dataEmissao: e.target.value }))} /></div>
            </div>

            <div className="section-label">🏢 Emitente</div>
            <div className="grid2">
              <div className="field"><label>CNPJ</label><input value={formConsumidor.emitente.cnpj} onChange={e => setFormConsumidor(f => ({ ...f, emitente: { ...f.emitente, cnpj: fmtCNPJ(e.target.value) } }))} /></div>
              <div className="field"><label>Razão Social</label><input value={formConsumidor.emitente.razao} onChange={e => setFormConsumidor(f => ({ ...f, emitente: { ...f.emitente, razao: e.target.value } }))} /></div>
            </div>

            <div className="section-label">👤 Consumidor (opcional)</div>
            <div className="grid3">
              <div className="field"><label>CPF/CNPJ</label><input value={formConsumidor.destinatario?.cnpj || ''} onChange={e => setFormConsumidor(f => ({ ...f, destinatario: { ...f.destinatario, cnpj: e.target.value } }))} placeholder="Opcional" /></div>
              <div className="field"><label>Nome</label><input value={formConsumidor.destinatario?.razao || ''} onChange={e => setFormConsumidor(f => ({ ...f, destinatario: { ...f.destinatario, razao: e.target.value } }))} placeholder="Opcional" /></div>
              <div className="field"><label>E-mail</label><input value={formConsumidor.destinatario?.email || ''} onChange={e => setFormConsumidor(f => ({ ...f, destinatario: { ...f.destinatario, email: e.target.value } }))} placeholder="Opcional" /></div>
            </div>

            <div className="section-label">📦 Itens</div>
            <div style={{ overflowX: 'auto' }}>
              <table className="itens-table">
                <thead>
                  <tr>
                    <th style={{ minWidth: 160 }}>Descrição</th>
                    <th style={{ minWidth: 60 }}>Qtd</th>
                    <th style={{ minWidth: 80 }}>Vl Unit</th>
                    <th style={{ minWidth: 80 }}>Total</th>
                    <th style={{ minWidth: 60 }}>ICMS%</th>
                    <th style={{ minWidth: 30 }}></th>
                  </tr>
                </thead>
                <tbody>
                  {itensConsumidor.map((it, idx) => (
                    <tr key={idx}>
                      <td><input value={it.descricao} onChange={e => atualizarItemConsumidor(idx, 'descricao', e.target.value)} /></td>
                      <td><input type="number" value={it.qtd} onChange={e => atualizarItemConsumidor(idx, 'qtd', e.target.value)} /></td>
                      <td><input type="number" value={it.vlUnit} onChange={e => atualizarItemConsumidor(idx, 'vlUnit', e.target.value)} /></td>
                      <td style={{ color: '#10b981' }}>{fmt(parseFloat(it.vl) || 0)}</td>
                      <td><input value={it.icms} onChange={e => atualizarItemConsumidor(idx, 'icms', e.target.value)} /></td>
                      <td><button onClick={() => setItensConsumidor(p => p.filter((_, i) => i !== idx))} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: 14 }}>✕</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <button className="btn btn-secondary" style={{ marginTop: 8 }} onClick={() => setItensConsumidor(p => [...p, { ...ITEM_VAZIO, id: String(Date.now()) }])}>+ Adicionar Item</button>

            {itensConsumidor.length > 0 && (
              <div className="total-box">
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#64748b', fontSize: 13 }}>Total:</span>
                  <span style={{ color: '#10b981', fontWeight: 700, fontSize: 18 }}>{fmt(calcTotalItens(itensConsumidor))}</span>
                </div>
              </div>
            )}

            <div className="grid2" style={{ marginTop: 12 }}>
              <div className="field"><label>Forma de Pagamento</label>
                <select value={formConsumidor.pagamento?.forma || '01'} onChange={e => setFormConsumidor(f => ({ ...f, pagamento: { ...f.pagamento, forma: e.target.value } }))} style={{ width: '100%', background: '#1a2540', border: '1px solid #1e2d4a', borderRadius: 8, padding: '9px 12px', fontFamily: 'DM Mono, monospace', fontSize: 13, color: '#e2e8f0', outline: 'none' }}>
                  <option value="01">Dinheiro</option>
                  <option value="03">Cartão de Crédito</option>
                  <option value="04">Cartão de Débito</option>
                  <option value="17">PIX</option>
                  <option value="99">Outros</option>
                </select>
              </div>
              <div className="field"><label>Status</label>
                <select value={formConsumidor.status} onChange={e => setFormConsumidor(f => ({ ...f, status: e.target.value }))} style={{ width: '100%', background: '#1a2540', border: '1px solid #1e2d4a', borderRadius: 8, padding: '9px 12px', fontFamily: 'DM Mono, monospace', fontSize: 13, color: '#e2e8f0', outline: 'none' }}>
                  <option value="Rascunho">Rascunho</option>
                  <option value="Emitida">Emitida</option>
                  <option value="Cancelada">Cancelada</option>
                </select>
              </div>
            </div>
            <div className="field"><label>Observações</label><textarea value={formConsumidor.observacoes} onChange={e => setFormConsumidor(f => ({ ...f, observacoes: e.target.value }))} /></div>

            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 8 }}>
              <button className="btn btn-secondary" onClick={() => setShowFormConsumidor(false)}>Cancelar</button>
              <button className="btn btn-primary" onClick={salvarNFConsumidor} disabled={saving}>{saving ? '⏳ Salvando...' : '💾 Salvar Rascunho'}</button>
              <button className="btn btn-green" onClick={() => emitirNFeSefaz('65')} disabled={emitindo || saving}>{emitindo ? '⏳ Emitindo...' : '📤 Emitir NFC-e SEFAZ'}</button>
            </div>
          </div>
        </div>
      )}

      <div id="fsc-toast" className="toast" />
    </>
  )
}
