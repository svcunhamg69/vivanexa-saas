// pages/gerador-leads.js — Vivanexa SaaS v3
// ✅ Campo CNAE manual
// ✅ Filtro de situação (Ativa / Inativa / Todas)
// ✅ Filtro de data de abertura (empresas recentes / período)
// ✅ Usa minhareceita.org + opencnpj.org (APIs corretas e gratuitas)

import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import Head from 'next/head'
import { supabase } from '../lib/supabase'
import Navbar from '../components/Navbar'

const UFS = ['AC','AL','AM','AP','BA','CE','DF','ES','GO','MA','MG','MS','MT','PA','PB','PE','PI','PR','RJ','RN','RO','RR','RS','SC','SE','SP','TO']

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

const sleep = ms => new Promise(r => setTimeout(r, ms))

function fmtDoc(s) {
  if (!s) return ''
  const d = s.replace(/\D/g,'')
  if (d.length===14) return d.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/,'$1.$2.$3/$4-$5')
  if (d.length===11) return d.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/,'$1.$2.$3-$4')
  return s
}
function fmtTel(s) {
  if (!s) return ''
  const d = s.replace(/\D/g,'')
  if (d.length===11) return `(${d.slice(0,2)}) ${d.slice(2,7)}-${d.slice(7)}`
  if (d.length===10) return `(${d.slice(0,2)}) ${d.slice(2,6)}-${d.slice(6)}`
  return s
}
function fmtData(s) {
  if (!s) return ''
  // YYYY-MM-DD → DD/MM/YYYY
  const p = s.split('-')
  return p.length===3 ? `${p[2]}/${p[1]}/${p[0]}` : s
}

// ── Google Places ─────────────────────────────────────────────────────
async function buscarGoogle({ nicho, uf, cidade, bairro, logradouro, apiKey, onProgresso }) {
  if (!apiKey) return { resultados: [], erro: 'Chave Google Places API não configurada.\nAcesse Config → Google & Meta.' }
  const resultados = []
  let pageToken = null
  const query = [nicho, bairro, logradouro, cidade, uf, 'Brasil'].filter(Boolean).join(', ')
  onProgresso(`Google Places: "${query}"...`)
  try {
    do {
      const params = new URLSearchParams({ query, key: apiKey, language: 'pt-BR', region: 'br' })
      if (pageToken) params.set('pagetoken', pageToken)
      const r = await fetch(`https://maps.googleapis.com/maps/api/place/textsearch/json?${params}`, { signal: AbortSignal.timeout(15000) })
      if (!r.ok) break
      const data = await r.json()
      if (data.status === 'REQUEST_DENIED') return { resultados, erro: `Google API Key inválida: ${data.error_message||''}` }
      if (data.status !== 'OK') break
      onProgresso(`Google Places: buscando detalhes de ${data.results?.length||0} lugares... (${resultados.length} coletados)`)
      for (const place of (data.results||[])) {
        const det = await buscarDetalhesPlace(place.place_id, apiKey)
        resultados.push(mapPlace(place, det))
        await sleep(100)
      }
      pageToken = data.next_page_token || null
      if (pageToken) await sleep(2000)
    } while (pageToken)
  } catch (e) { return { resultados, erro: e.message } }
  return { resultados, erro: null }
}

async function buscarDetalhesPlace(placeId, apiKey) {
  try {
    const params = new URLSearchParams({ place_id: placeId, fields: 'name,formatted_address,formatted_phone_number,international_phone_number,website,address_components', key: apiKey, language: 'pt-BR' })
    const r = await fetch(`https://maps.googleapis.com/maps/api/place/details/json?${params}`, { signal: AbortSignal.timeout(10000) })
    if (!r.ok) return {}
    return (await r.json()).result || {}
  } catch { return {} }
}

function mapPlace(place, det) {
  const addr = det.address_components || []
  const get  = (...types) => { for (const type of types) { const c = addr.find(a=>a.types.includes(type)); if(c) return c.long_name } return '' }
  return {
    id: `gp_${place.place_id}`, nome: det.name||place.name||'', fantasia: det.name||place.name||'',
    responsavel: '', cnpj: '', telefone: (det.formatted_phone_number||det.international_phone_number||'').replace(/\D/g,''),
    email: '', site: det.website||'',
    logradouro: `${get('route')} ${get('street_number')}`.trim()||(place.formatted_address||'').split(',')[0]||'',
    numero: get('street_number'), complemento: '',
    bairro: get('sublocality_level_1','sublocality','neighborhood'),
    cidade: get('administrative_area_level_2','locality'),
    uf: get('administrative_area_level_1'),
    cep: get('postal_code').replace(/\D/g,''),
    atividade: (place.types||[]).join(', '), cnae: '', situacao: 'Ativa', dataInicio: '', capital: '', porte: '', natureza: '',
    fonte: 'Google Meu Negócio',
  }
}

// ── Meta Pages Search ─────────────────────────────────────────────────
async function buscarMeta({ nicho, uf, cidade, metaToken, onProgresso }) {
  if (!metaToken) return { resultados: [], erro: 'Token Meta (Graph API) não configurado.\nAcesse Config → Google & Meta.' }
  const resultados = []
  const q = [nicho, cidade, uf].filter(Boolean).join(' ')
  onProgresso(`Facebook/Instagram: "${q}"...`)
  try {
    let url = `https://graph.facebook.com/v19.0/pages/search?q=${encodeURIComponent(q)}&fields=name,phone,website,location,emails,category_list&access_token=${metaToken}&limit=100`
    do {
      const r = await fetch(url, { signal: AbortSignal.timeout(15000) })
      if (!r.ok) { const err = await r.json().catch(()=>({})); return { resultados, erro: `Meta API: ${err.error?.message||'Erro '+r.status}` } }
      const data = await r.json()
      if (data.error) return { resultados, erro: data.error.message }
      for (const page of (data.data||[])) resultados.push(mapMetaPage(page))
      onProgresso(`Facebook/Instagram: ${resultados.length} páginas...`)
      url = data.paging?.next || null
    } while (url)
  } catch (e) { return { resultados, erro: e.message } }
  return { resultados, erro: null }
}

function mapMetaPage(page) {
  const loc = page.location || {}
  return {
    id: `meta_${page.id}`, nome: page.name||'', fantasia: page.name||'',
    responsavel: '', cnpj: '', telefone: (page.phone||'').replace(/\D/g,''),
    email: page.emails?.[0]||'', site: page.website||`https://facebook.com/${page.id}`,
    logradouro: loc.street||'', numero: '', complemento: '', bairro: '',
    cidade: loc.city||'', uf: loc.state||'', cep: '',
    atividade: (page.category_list||[]).map(c=>c.name).join(', '),
    cnae: '', situacao: '', dataInicio: '', capital: '', porte: '', natureza: '',
    fonte: 'Facebook/Instagram',
  }
}

// ── Exportação ────────────────────────────────────────────────────────
const COLS = ['Nome','Fantasia','Responsável','CNPJ','Telefone','E-mail','Site','Logradouro','Nº','Complemento','Bairro','Cidade','UF','CEP','CNAE','Atividade','Situação','Abertura','Porte','Capital Social','Fonte']
function valLead(l) {
  return [l.nome, l.fantasia, l.responsavel, fmtDoc(l.cnpj), fmtTel(l.telefone),
          l.email, l.site, l.logradouro, l.numero, l.complemento,
          l.bairro, l.cidade, l.uf, l.cep, l.cnae, l.atividade,
          l.situacao, fmtData(l.dataInicio), l.porte, l.capital, l.fonte]
}
function exportCSV(leads) {
  const rows = leads.map(l => valLead(l).map(v=>`"${(v||'').replace(/"/g,'""')}"`).join(';'))
  baixar(new Blob(['\uFEFF'+[COLS.join(';'),...rows].join('\n')], {type:'text/csv;charset=utf-8'}), 'leads.csv')
}
function exportXLS(leads) {
  const rows = leads.map(l => valLead(l).map(v=>`<td>${(v||'').replace(/&/g,'&amp;').replace(/</g,'&lt;')}</td>`).join(''))
  const html = `<html><head><meta charset="utf-8"></head><body><table><thead><tr>${COLS.map(h=>`<th>${h}</th>`).join('')}</tr></thead><tbody>${rows.map(r=>`<tr>${r}</tr>`).join('')}</tbody></table></body></html>`
  baixar(new Blob([html],{type:'application/vnd.ms-excel;charset=utf-8'}), 'leads.xls')
}
function exportTXT(leads) {
  const txt = leads.map((l,i) => [
    `--- Lead ${i+1} ---`,
    `Nome: ${l.nome}`, `Fantasia: ${l.fantasia}`, `Responsável: ${l.responsavel}`,
    `CNPJ: ${fmtDoc(l.cnpj)}`, `Telefone: ${fmtTel(l.telefone)}`, `E-mail: ${l.email}`, `Site: ${l.site}`,
    `Endereço: ${[l.logradouro,l.numero,l.complemento].filter(Boolean).join(', ')}`,
    `Bairro: ${l.bairro}`, `Cidade: ${l.cidade}/${l.uf}`, `CEP: ${l.cep}`,
    `CNAE: ${l.cnae}`, `Atividade: ${l.atividade}`, `Situação: ${l.situacao}`,
    `Abertura: ${fmtData(l.dataInicio)}`, `Porte: ${l.porte}`, `Capital: ${l.capital}`,
    `Fonte: ${l.fonte}`,
  ].join('\n')).join('\n\n')
  baixar(new Blob([txt],{type:'text/plain;charset=utf-8'}), 'leads.txt')
}
function exportPDF(leads, filtros) {
  const w = window.open('','_blank')
  const rows = leads.map((l,i) => `<tr style="background:${i%2===0?'#f8fafc':'#fff'}">
    <td>${i+1}</td>
    <td><b>${l.nome||'—'}</b>${l.fantasia&&l.fantasia!==l.nome?`<br><small style="color:#64748b">${l.fantasia}</small>`:''}</td>
    <td>${l.responsavel||'—'}</td>
    <td>${fmtDoc(l.cnpj)||'—'}</td>
    <td>${fmtTel(l.telefone)||'—'}</td>
    <td>${l.email||'—'}</td>
    <td>${l.site?`<a href="${l.site}">${l.site}</a>`:'—'}</td>
    <td>${[l.logradouro,l.numero].filter(Boolean).join(', ')||'—'}<br><small style="color:#64748b">${[l.bairro,l.cidade,l.uf].filter(Boolean).join(' / ')}</small></td>
    <td>${l.cnae||'—'}</td>
    <td><span style="padding:1px 6px;border-radius:4px;font-size:9px;background:${(l.situacao||'').toLowerCase().includes('ativa')?'#dcfce7':'#fee2e2'};color:${(l.situacao||'').toLowerCase().includes('ativa')?'#166534':'#991b1b'}">${l.situacao||'—'}</span></td>
    <td>${fmtData(l.dataInicio)||'—'}</td>
    <td><small style="color:#64748b">${l.fonte||'—'}</small></td>
  </tr>`)
  w.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>Leads Vivanexa</title>
  <style>body{font-family:Arial,sans-serif;font-size:10px;padding:16px}h2{color:#0099bb;margin-bottom:4px}.sub{font-size:10px;color:#64748b;margin-bottom:14px}
  table{width:100%;border-collapse:collapse;font-size:9px}th{background:#0f172a;color:#fff;padding:5px 6px;text-align:left}
  td{padding:4px 6px;border-bottom:1px solid #e2e8f0;vertical-align:top}@media print{body{padding:0}}</style></head><body>
  <h2>🎯 Gerador de Leads — Vivanexa SaaS</h2>
  <div class="sub">Nicho: <b>${filtros.nicho||filtros.cnaeManual}</b> · Estado: <b>${filtros.uf}</b>${filtros.cidade?` · Cidade: <b>${filtros.cidade}</b>`:''} · <b>${leads.length}</b> leads · ${new Date().toLocaleString('pt-BR')}</div>
  <table><thead><tr><th>#</th><th>Empresa</th><th>Responsável</th><th>CNPJ</th><th>Telefone</th><th>E-mail</th><th>Site</th><th>Endereço / Cidade</th><th>CNAE</th><th>Situação</th><th>Abertura</th><th>Fonte</th></tr></thead>
  <tbody>${rows.join('')}</tbody></table>
  <script>window.onload=()=>{setTimeout(()=>window.print(),400)}</script></body></html>`)
  w.document.close()
}
function baixar(blob, nome) {
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = nome; a.click()
  setTimeout(()=>URL.revokeObjectURL(a.href), 5000)
}

// ── Componente ────────────────────────────────────────────────────────
// ── CNAE com descrições (para autocomplete) ───────────────────────────
const NICHO_CNAE_LABELS = {
  '6920601': 'Atividades de contabilidade',
  '6920602': 'Escrituração fiscal e previdenciária',
  '6911701': 'Serviços advocatícios',
  '6911702': 'Atividades auxiliares da justiça',
  '6912500': 'Cartórios',
  '8630502': 'Atividade médica ambulatorial com recursos para realização de exames complementares',
  '8630501': 'Atividade médica ambulatorial sem recursos para realização de exames',
  '8630503': 'Atividade médica ambulatorial restrita a consultas',
  '8630504': 'Atividade odontológica',
  '8610101': 'Atividades de atendimento hospitalar',
  '8610102': 'UTI Neonatal',
  '8650001': 'Atividades de enfermagem e fisioterapia',
  '8650002': 'Atividades de psicologia e psicanálise',
  '8650004': 'Atividades de fisioterapia',
  '8650006': 'Atividades de nutricionistas',
  '4771701': 'Comércio varejista de produtos farmacêuticos',
  '4771702': 'Comércio varejista de produtos farmacêuticos homeopáticos',
  '8640202': 'Laboratórios clínicos',
  '8640203': 'Serviços de diálise e nefrologia',
  '4774100': 'Comércio varejista de artigos de óptica',
  '5611201': 'Restaurantes e similares',
  '5611202': 'Bares e outros estabelecimentos especializados em servir bebidas',
  '5611203': 'Lanchonetes, casas de chá, de sucos e similares',
  '1091101': 'Fabricação de produtos de panificação industrial',
  '4721102': 'Padaria e confeitaria com predominância de revenda',
  '8511200': 'Educação infantil — creche',
  '8512100': 'Educação infantil — pré-escola',
  '8513900': 'Ensino fundamental',
  '8532500': 'Educação superior — graduação e pós-graduação',
  '8533300': 'Educação superior — pós-graduação e extensão',
  '8599604': 'Treinamento em desenvolvimento profissional e gerencial',
  '8599605': 'Cursos preparatórios para concursos',
  '8599699': 'Outras atividades de ensino não especificadas',
  '9602501': 'Cabeleireiros',
  '9602502': 'Outras atividades de tratamento de beleza',
  '9602503': 'Barbearias',
  '9609202': 'Clínicas de estética e similares',
  '9313100': 'Academias de condicionamento físico',
  '4789004': 'Comércio varejista de animais vivos e artigos para animais de estimação',
  '7500100': 'Atividades veterinárias',
  '4520001': 'Serviços de manutenção e reparação mecânica de veículos automotores',
  '4520002': 'Serviços de manutenção e reparação elétrica de veículos automotores',
  '4520003': 'Serviços de manutenção e reparação de veículos automotores (geral)',
  '4530701': 'Comércio por atacado de peças e acessórios para veículos automotores',
  '4530703': 'Comércio a varejo de peças e acessórios para veículos automotores',
  '6821801': 'Corretagem de imóveis de terceiros',
  '6821802': 'Corretagem de imóveis próprios',
  '4110700': 'Incorporação de empreendimentos imobiliários',
  '4120400': 'Construção de edifícios',
  '6201500': 'Desenvolvimento de programas de computador sob encomenda',
  '6202300': 'Desenvolvimento e licenciamento de programas de computador customizáveis',
  '6209100': 'Suporte técnico, manutenção e outros serviços em tecnologia da informação',
  '4751201': 'Comércio varejista especializado de equipamentos e suprimentos de informática',
  '4711302': 'Supermercados',
  '4711301': 'Minimercados e mercearias',
  '5510801': 'Hotéis',
  '5510802': 'Apart-hotéis',
  '5590601': 'Albergues, exceto assistenciais',
  '5590602': 'Campings',
  '7911200': 'Agências de viagens',
  '7912100': 'Operadores turísticos',
  '6511101': 'Seguros de vida',
  '6511102': 'Planos de auxílio-funeral',
  '6512000': 'Seguros não-vida',
  '7020400': 'Atividades de consultoria em gestão empresarial',
  '7319002': 'Promoção de vendas',
  '7319003': 'Marketing direto',
  '7311400': 'Agências de publicidade',
  '7312200': 'Agenciamento de espaços para publicidade',
  '7112000': 'Atividades de engenharia e consultorias em engenharia e correlatas',
  '7111100': 'Atividades de arquitetura',
  '8121400': 'Limpeza de prédios e em domicílios',
  '8122200': 'Imunização e controle de pragas urbanas',
  '8011101': 'Atividades de vigilância e segurança privada',
  '8011102': 'Serviços de escolta e vigilância',
  '4930201': 'Transporte rodoviário de carga, exceto produtos perigosos e mudanças',
  '4930202': 'Transporte rodoviário de carga, exceto produtos perigosos e mudanças — municipal',
  '5229001': 'Serviços de apoio ao transporte por táxi',
  '5229002': 'Serviços de reboque de veículos',
  '1811301': 'Impressão de jornais',
  '1811302': 'Impressão de livros, revistas e outras publicações periódicas',
  '7420001': 'Atividades de produção de fotografias',
  '7420002': 'Atividades de produção de fotografias aéreas e submarinas',
  '4759801': 'Comércio varejista de artigos de tapeçaria, cortinas e persianas',
  '4759899': 'Comércio varejista de outros artigos de uso pessoal e doméstico',
  '4330401': 'Impermeabilização em obras de engenharia civil',
  '4330402': 'Instalação de portas, janelas, tetos, divisórias e armários embutidos',
  '4321500': 'Instalação e manutenção elétrica',
  '4322301': 'Instalações hidráulicas, sanitárias e de gás',
  '4754701': 'Comércio varejista de móveis',
  '4754702': 'Comércio varejista de artigos de colchoaria',
  '4783102': 'Comércio varejista de artigos de joalheria',
  '6422100': 'Bancos múltiplos, com carteira comercial',
  '6499901': 'Clubes de investimento',
  '7810800': 'Seleção e agenciamento de mão-de-obra',
  '7820500': 'Locação de mão-de-obra temporária',
  '8130300': 'Atividades paisagísticas',
}

// ── Naturezas Jurídicas (principais) ─────────────────────────────────
const NATUREZAS = [
  { cod: '2135', label: 'MEI – Microempreendedor Individual' },
  { cod: '2062', label: 'Sociedade Empresária Limitada (LTDA)' },
  { cod: '2305', label: 'Sociedade Anônima Fechada (S.A.)' },
  { cod: '2054', label: 'Sociedade Simples Pura' },
  { cod: '2046', label: 'Sociedade em Nome Coletivo' },
  { cod: '4120', label: 'Empresa Individual (EIRELI)' },
  { cod: '2143', label: 'Empresa Individual de Responsabilidade Limitada' },
  { cod: '1015', label: 'Órgão Público Federal' },
  { cod: '1023', label: 'Órgão Público Estadual' },
  { cod: '1031', label: 'Órgão Público Municipal' },
  { cod: '3999', label: 'Associação Privada' },
  { cod: '3069', label: 'Fundação Privada' },
  { cod: '2232', label: 'Sociedade Cooperativa' },
  { cod: '2240', label: 'Consórcio de Empregadores' },
]

export default function GeradorLeads() {
  const router = useRouter()
  const [user,      setUser]      = useState(null)
  const [cfg,       setCfg]       = useState({})
  const [empresaId, setEmpresaId] = useState(null)
  const [loading,   setLoading]   = useState(true)

  // Formulário
  const [fonte,        setFonte]        = useState('receita')
  const [nicho,        setNicho]        = useState('')
  const [cnaeManual,   setCnaeManual]   = useState('')
  const [uf,           setUf]           = useState('')
  const [cidade,       setCidade]       = useState('')
  const [bairro,       setBairro]       = useState('')
  const [logradouro,   setLogradouro]   = useState('')

  // ── Filtros de situação e data ─────────────────────────────────────
  const [situacaoFiltro,   setSituacaoFiltro]   = useState('ativa')
  const [dataInicioDe,     setDataInicioDe]     = useState('')
  const [dataInicioAte,    setDataInicioAte]    = useState('')
  const [empresasRecentes, setEmpresasRecentes] = useState(false)

  // ── Filtros de qualidade PRÉ-BUSCA (enviados à API) ────────────────
  const [apenasComTelefone, setApenasComTelefone] = useState(false)
  const [apenasComCelular,  setApenasComCelular]  = useState(false)
  const [apenasComEmail,    setApenasComEmail]    = useState(false)
  const [excluirMei,        setExcluirMei]        = useState(false)
  const [somenteMei,        setSomenteMei]        = useState(false)
  const [somenteMatriz,     setSomenteMatriz]     = useState(false)
  const [somenteFilial,     setSomenteFilial]     = useState(false)

  // ── Natureza Jurídica multi-select ────────────────────────────────
  const [naturezasSelecionadas, setNaturezasSelecionadas] = useState([]) // [{cod,label}]
  const [buscaNatureza,         setBuscaNatureza]         = useState('')
  const [naturezaAberta,        setNaturezaAberta]        = useState(false)

  // ── CNAE multi-select (além do campo manual) ──────────────────────
  const [cnaesSelecionados,  setCnaesSelecionados]  = useState([]) // [{cod,label}]
  const [buscaCnae,          setBuscaCnae]          = useState('')
  const [cnaeAberto,         setCnaeAberto]         = useState(false)

  // ── Filtros pós-busca (client-side) ───────────────────────────────
  const [filtroLocal,       setFiltroLocal]       = useState('')
  const [filtroEmailContem, setFiltroEmailContem] = useState('')

  // Resultados
  const [leads,       setLeads]       = useState([])
  const [selecionados,setSelecionados]= useState([])
  const [buscando,    setBuscando]    = useState(false)
  const [progresso,   setProgresso]   = useState('')
  const [erroAPI,     setErroAPI]     = useState('')
  const [buscaFeita,  setBuscaFeita]  = useState(false)
  const [cnaesUsados, setCnaesUsados] = useState([])

  // Modal CRM
  const [showCRM,    setShowCRM]    = useState(false)
  const [etapaCRM,   setEtapaCRM]   = useState('lead')
  const [etapas,     setEtapas]     = useState(ETAPAS_PADRAO)
  const [importando, setImportando] = useState(false)
  const [importMsg,  setImportMsg]  = useState('')

  const [toast, setToast] = useState(null)
  const showToast = (msg, tipo='ok') => { setToast({msg,tipo}); setTimeout(()=>setToast(null), 3500) }

  useEffect(()=>{
    async function init() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.replace('/'); return }
      let { data: perfil } = await supabase.from('perfis').select('*').eq('user_id', session.user.id).maybeSingle()
      if (!perfil) {
        const nome = session.user.email?.split('@')[0]||'Usuário'
        const { data: np } = await supabase.from('perfis').insert({user_id:session.user.id,nome,email:session.user.email,empresa_id:session.user.id,perfil:'admin'}).select().single()
        perfil = np
      }
      const eid = perfil?.empresa_id||session.user.id
      setEmpresaId(eid); setUser({...session.user,...perfil})
      const { data: row } = await supabase.from('vx_storage').select('value').eq('key',`cfg:${eid}`).maybeSingle()
      if (row?.value) { const c=JSON.parse(row.value); setCfg(c); if(c.crm_etapas?.length)setEtapas(c.crm_etapas) }
      setLoading(false)
    }
    init()
  },[router])

  useEffect(()=>{
    if (empresasRecentes) {
      const d = new Date(); d.setFullYear(d.getFullYear()-1)
      setDataInicioDe(d.toISOString().slice(0,10))
      setDataInicioAte('')
    } else {
      setDataInicioDe(''); setDataInicioAte('')
    }
  },[empresasRecentes])

  const googleKey = cfg.googlePlacesKey || cfg.apiLeads?.googlePlacesKey || ''
  const metaToken = cfg.metaToken       || cfg.apiLeads?.metaGraphToken  || cfg.wpp?.token || ''

  async function buscar() {
    if (!uf) { showToast('Selecione o estado (UF)', 'err'); return }
    if (fonte==='receita' && !nicho.trim() && !cnaeManual.trim()) { showToast('Informe o nicho ou o código CNAE', 'err'); return }
    if (fonte!=='receita' && !nicho.trim()) { showToast('Informe o nicho/segmento', 'err'); return }

    setBuscando(true); setLeads([]); setSelecionados([])
    setErroAPI(''); setBuscaFeita(false); setFiltroLocal(''); setCnaesUsados([]); setFiltroEmailContem('')

    try {
      let resultado=[], erro=null

      if (fonte==='receita') {
        setProgresso('Consultando Receita Federal (minhareceita.org)...')
        const r = await fetch('/api/leads/buscar-receita', {
          method:'POST', headers:{'Content-Type':'application/json'},
          body: JSON.stringify({
            nicho:        nicho.trim(),
            cnaeManual:   cnaesSelecionados.length > 0
              ? cnaesSelecionados.map(c=>c.cod).join(',')
              : cnaeManual.trim(),
            uf,
            cidade:       cidade.trim(),
            bairro:       bairro.trim(),
            logradouro:   logradouro.trim(),
            situacaoFiltro,
            dataInicioDe: dataInicioDe  || undefined,
            dataInicioAte: dataInicioAte || undefined,
            apenasNovas: empresasRecentes,
            diasNovas:   365,
            empresaId,
            // filtros de qualidade pré-busca
            apenasComTelefone,
            apenasComCelular,
            apenasComEmail,
            excluirMei,
            somenteMei,
            somenteMatriz,
            somenteFilial,
            naturezasSelecionadas: naturezasSelecionadas.map(n=>n.cod),
          }),
          signal: AbortSignal.timeout(180000),
        })
        const data = await r.json()
        resultado = data.resultados || []
        erro      = data.aviso      || null
        if (data.cnaes?.length) setCnaesUsados(data.cnaes)
      } else if (fonte==='google') {
        const res = await buscarGoogle({ nicho:nicho.trim(), uf, cidade:cidade.trim(), bairro:bairro.trim(), logradouro:logradouro.trim(), apiKey:googleKey, onProgresso:setProgresso })
        resultado = res.resultados; erro = res.erro
      } else {
        const res = await buscarMeta({ nicho:nicho.trim(), uf, cidade:cidade.trim(), metaToken, onProgresso:setProgresso })
        resultado = res.resultados; erro = res.erro
      }

      setLeads(resultado)
      if (erro) setErroAPI(erro)
    } catch(e) { setErroAPI('Erro inesperado: '+e.message) }

    setBuscando(false); setProgresso(''); setBuscaFeita(true)
  }

  async function importarNoCRM() {
    const alvos = selecionados.length>0 ? leads.filter(l=>selecionados.includes(l.id)) : leadsFiltrados
    if (!alvos.length) { showToast('Selecione pelo menos um lead','err'); return }
    setImportando(true); setImportMsg('')
    try {
      const { data: row } = await supabase.from('vx_storage').select('value').eq('key',`cfg:${empresaId}`).maybeSingle()
      const cc  = row?.value ? JSON.parse(row.value) : {}
      const now = new Date().toISOString()
      const novos = alvos.map(l => ({
        id:           `neg_${Date.now()}_${Math.random().toString(36).slice(2,6)}`,
        titulo:       l.nome||l.fantasia||'Lead importado',
        etapa:        etapaCRM,
        nome:         l.nome||'',
        fantasia:     l.fantasia||'',
        cnpj:         l.cnpj||'',
        email:        l.email||'',
        telefone:     fmtTel(l.telefone),
        endereco:     [l.logradouro,l.numero,l.complemento].filter(Boolean).join(', '),
        bairro:       l.bairro||'',
        cidade:       l.cidade||'',
        uf:           l.uf||'',
        cep:          l.cep||'',
        responsavel:  l.responsavel||'',
        observacoes:  `Importado do Gerador de Leads em ${new Date().toLocaleDateString('pt-BR')}. Fonte: ${l.fonte}. CNAE: ${l.cnae}. Situação: ${l.situacao}. Abertura: ${fmtData(l.dataInicio)}`,
        origem:       'gerador_leads',
        site:         l.site||'',
        criadoEm:     now, atualizadoEm: now,
      }))
      cc.crm_negocios = [...(cc.crm_negocios||[]), ...novos]
      await supabase.from('vx_storage').upsert({key:`cfg:${empresaId}`,value:JSON.stringify(cc),updated_at:now},{onConflict:'key'})
      const lbl = etapas.find(e=>e.id===etapaCRM)?.label||etapaCRM
      setImportMsg(`✅ ${novos.length} leads importados para "${lbl}"!`)
      showToast(`✅ ${novos.length} leads no CRM!`)
      setTimeout(()=>{ setShowCRM(false); setImportMsg('') }, 2500)
    } catch(e) { setImportMsg('❌ Erro: '+e.message) }
    setImportando(false)
  }

  const leadsFiltrados = leads.filter(l => {
    if (filtroLocal.trim()) {
      const q = filtroLocal.toLowerCase()
      const bate = (l.nome||'').toLowerCase().includes(q) || (l.cidade||'').toLowerCase().includes(q) ||
             (l.bairro||'').toLowerCase().includes(q) || (l.cnpj||'').includes(q) ||
             (l.telefone||'').includes(q) || (l.email||'').toLowerCase().includes(q) ||
             (l.responsavel||'').toLowerCase().includes(q) || (l.cnae||'').includes(q) ||
             (l.atividade||'').toLowerCase().includes(q)
      if (!bate) return false
    }
    if (filtroEmailContem.trim() && !(l.email||'').toLowerCase().includes(filtroEmailContem.trim().toLowerCase())) return false
    return true
  })

  const alvosExport = selecionados.length>0 ? leads.filter(l=>selecionados.includes(l.id)) : leadsFiltrados
  const toggleSel   = id => setSelecionados(prev=>prev.includes(id)?prev.filter(x=>x!==id):[...prev,id])
  const toggleTodos = () => setSelecionados(selecionados.length===leadsFiltrados.length?[]:leadsFiltrados.map(l=>l.id))

  if (loading) return <div style={{minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center',background:'#0a0f1e',color:'#64748b',fontFamily:'DM Mono,monospace'}}>Carregando...</div>

  return (
    <>
      <Head>
        <title>Gerador de Leads — Vivanexa</title>
        <meta name="viewport" content="width=device-width,initial-scale=1.0" />
        <link href="https://fonts.googleapis.com/css2?family=Syne:wght@600;700;800&family=DM+Mono:wght@300;400;500&display=swap" rel="stylesheet" />
      </Head>
      <style>{CSS}</style>

      {toast && <div style={{position:'fixed',bottom:24,left:'50%',transform:'translateX(-50%)',zIndex:9999,padding:'10px 22px',borderRadius:10,fontFamily:'DM Mono,monospace',fontSize:13,color:'#fff',boxShadow:'0 4px 24px rgba(0,0,0,.5)',background:toast.tipo==='err'?'rgba(239,68,68,.95)':'rgba(16,185,129,.95)'}}>{toast.msg}</div>}

      {/* Modal CRM */}
      {showCRM && (
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,.82)',zIndex:2000,display:'flex',alignItems:'center',justifyContent:'center',padding:20}} onClick={()=>setShowCRM(false)}>
          <div style={{background:'#111827',border:'1px solid #1e2d4a',borderRadius:16,padding:28,width:'100%',maxWidth:500}} onClick={e=>e.stopPropagation()}>
            <div style={{fontFamily:'Syne,sans-serif',fontWeight:700,fontSize:17,color:'#e2e8f0',marginBottom:6}}>🤝 Importar no CRM</div>
            <div style={{fontSize:12,color:'#64748b',marginBottom:20}}>
              {selecionados.length>0?`${selecionados.length} lead(s) selecionado(s)`:`Todos os ${leadsFiltrados.length} leads`} serão importados.
            </div>
            <div style={{marginBottom:16}}>
              <div style={{fontSize:11,color:'#64748b',textTransform:'uppercase',letterSpacing:.5,marginBottom:8}}>Etapa do funil de destino</div>
              <div style={{display:'flex',flexWrap:'wrap',gap:7}}>
                {etapas.map(e=>(
                  <button key={e.id} onClick={()=>setEtapaCRM(e.id)}
                    style={{padding:'6px 14px',borderRadius:8,cursor:'pointer',fontFamily:'DM Mono,monospace',fontSize:12,fontWeight:etapaCRM===e.id?700:400,
                      border:`1.5px solid ${etapaCRM===e.id?e.cor:e.cor+'44'}`,
                      background:etapaCRM===e.id?`${e.cor}22`:'transparent',
                      color:etapaCRM===e.id?e.cor:e.cor+'99'}}>
                    {e.label}
                  </button>
                ))}
              </div>
            </div>
            {importMsg&&<div style={{padding:'10px 14px',borderRadius:8,marginBottom:14,fontSize:13,background:importMsg.startsWith('✅')?'rgba(16,185,129,.1)':'rgba(239,68,68,.1)',border:`1px solid ${importMsg.startsWith('✅')?'rgba(16,185,129,.3)':'rgba(239,68,68,.3)'}`,color:importMsg.startsWith('✅')?'#10b981':'#ef4444'}}>{importMsg}</div>}
            <div style={{display:'flex',gap:10}}>
              <button onClick={()=>setShowCRM(false)} style={{flex:1,padding:10,background:'none',border:'1px solid #1e2d4a',color:'#64748b',borderRadius:10,cursor:'pointer',fontFamily:'DM Mono,monospace',fontSize:13}}>Cancelar</button>
              <button onClick={importarNoCRM} disabled={importando} style={{flex:2,padding:10,background:'linear-gradient(135deg,#10b981,#059669)',border:'none',color:'#fff',borderRadius:10,cursor:importando?'not-allowed':'pointer',fontFamily:'DM Mono,monospace',fontSize:13,fontWeight:600,opacity:importando?.7:1}}>
                {importando?'⏳ Importando...':'✅ Importar no CRM'}
              </button>
            </div>
          </div>
        </div>
      )}

      <Navbar cfg={cfg} perfil={user} />

      <div className="pw">
        <div style={{display:'flex',alignItems:'flex-end',justifyContent:'space-between',flexWrap:'wrap',gap:12,marginBottom:20}}>
          <div>
            <div className="pt">🎯 Gerador de Leads</div>
            <div className="ps">Receita Federal · Google Meu Negócio · Facebook/Instagram</div>
          </div>
          <button onClick={()=>router.push('/configuracoes?tab=google_meta')} style={{padding:'7px 16px',borderRadius:9,border:'1px solid rgba(0,212,255,.3)',background:'rgba(0,212,255,.06)',color:'var(--accent)',fontFamily:'DM Mono,monospace',fontSize:12,cursor:'pointer'}}>
            ⚙️ Configurar APIs
          </button>
        </div>

        {/* ── FORMULÁRIO ── */}
        <div className="card">

          {/* Fonte */}
          <div style={{marginBottom:20}}>
            <div className="sl">Fonte de Dados</div>
            <div style={{display:'flex',gap:10,flexWrap:'wrap'}}>
              {[
                ['receita','🏛️','Receita Federal','minhareceita.org — CNPJ, sócios, endereço, CNAE'],
                ['google', '📍','Google Meu Negócio','Places API — telefone, site, endereço completo'],
                ['meta',   '📘','Facebook/Instagram','Meta Graph API — páginas de negócios'],
              ].map(([val,icon,label,desc])=>(
                <button key={val} onClick={()=>setFonte(val)} className={`fb ${fonte===val?'fa':''}`}>
                  <span style={{fontSize:22,flexShrink:0}}>{icon}</span>
                  <div style={{minWidth:0}}>
                    <div style={{fontWeight:700,fontSize:13}}>{label}</div>
                    <div style={{fontSize:10,color:fonte===val?'rgba(0,212,255,.7)':'var(--muted)',marginTop:2}}>{desc}</div>
                  </div>
                </button>
              ))}
            </div>
            {fonte==='google'&&!googleKey&&<div className="av">⚠️ Google Places API Key não configurada. <button onClick={()=>router.push('/configuracoes?tab=google_meta')} className="lnk">Configurar →</button></div>}
            {fonte==='meta'&&!metaToken&&<div className="av">⚠️ Token Meta Graph API não configurado. <button onClick={()=>router.push('/configuracoes?tab=google_meta')} className="lnk">Configurar →</button></div>}
            {fonte==='google'&&googleKey&&<div className="ok">✅ Google Places API configurada</div>}
            {fonte==='meta'&&metaToken&&<div className="ok">✅ Meta Graph API configurada</div>}
          </div>

          {/* Campos principais */}
          <div className="fg">
            <div className="fw req">
              <label>Nicho / Segmento {fonte!=='receita'&&'*'}</label>
              <input value={nicho} onChange={e=>setNicho(e.target.value)}
                placeholder="Ex: Dentista, Contabilidade, Advocacia..."
                onKeyDown={e=>e.key==='Enter'&&buscar()} />
            </div>

            {/* Campo CNAE — só para Receita Federal */}
            {fonte==='receita'&&(
              <div className="fw">
                <label>Código CNAE <span className="ob">opcional — sobrepõe nicho</span></label>
                <input value={cnaeManual} onChange={e=>setCnaeManual(e.target.value)}
                  placeholder="Ex: 6920601 ou 6920601,6920602" />
              </div>
            )}

            <div className="fw req">
              <label>Estado (UF) *</label>
              <select value={uf} onChange={e=>setUf(e.target.value)}>
                <option value="">— Selecione —</option>
                {UFS.map(u=><option key={u} value={u}>{u}</option>)}
              </select>
            </div>
            <div className="fw">
              <label>Cidade <span className="ob">opcional</span></label>
              <input value={cidade} onChange={e=>setCidade(e.target.value)} placeholder="Ex: Belo Horizonte" />
            </div>
            <div className="fw">
              <label>Bairro <span className="ob">opcional</span></label>
              <input value={bairro} onChange={e=>setBairro(e.target.value)} placeholder="Ex: Savassi" />
            </div>
            <div className="fw">
              <label>Rua / Avenida <span className="ob">opcional</span></label>
              <input value={logradouro} onChange={e=>setLogradouro(e.target.value)} placeholder="Ex: Av. Afonso Pena" />
            </div>
          </div>

          {/* Filtros avançados — só Receita Federal */}
          {fonte==='receita'&&(
            <div className="filtros-box">
              <div className="sl" style={{marginBottom:14}}>⚙️ Filtros Avançados</div>

              {/* ── Linha 1: Situação + Data abertura ── */}
              <div style={{display:'grid',gridTemplateColumns:'auto 1fr 1fr',gap:14,marginBottom:14,alignItems:'start'}}>
                <div className="fw">
                  <label>Situação Cadastral</label>
                  <div style={{display:'flex',gap:6,marginTop:4,flexWrap:'wrap'}}>
                    {[['ativa','✅ Ativa','#10b981'],['inativa','❌ Inativa','#ef4444'],['todas','📋 Todas','#64748b']].map(([val,label,cor])=>(
                      <button key={val} onClick={()=>setSituacaoFiltro(val)}
                        style={{padding:'5px 12px',borderRadius:7,cursor:'pointer',fontFamily:'DM Mono,monospace',fontSize:11,
                          border:`1.5px solid ${situacaoFiltro===val?cor:cor+'44'}`,
                          background:situacaoFiltro===val?`${cor}22`:'transparent',
                          color:situacaoFiltro===val?cor:cor+'99',fontWeight:situacaoFiltro===val?700:400,transition:'all .15s'}}>
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="fw">
                  <label>Abertura — De</label>
                  <input type="date" value={dataInicioDe} onChange={e=>{setDataInicioDe(e.target.value);setEmpresasRecentes(false)}} style={{marginTop:4}} />
                </div>
                <div className="fw">
                  <label>Abertura — Até</label>
                  <input type="date" value={dataInicioAte} onChange={e=>{setDataInicioAte(e.target.value);setEmpresasRecentes(false)}} style={{marginTop:4}} />
                </div>
              </div>

              {/* ── Linha 2: Empresas recentes ── */}
              <div style={{marginBottom:14}}>
                <label style={{display:'flex',alignItems:'center',gap:8,cursor:'pointer',fontSize:12,color:'var(--text)',width:'fit-content'}}>
                  <input type="checkbox" checked={empresasRecentes} onChange={e=>setEmpresasRecentes(e.target.checked)} style={{width:14,height:14,accentColor:'var(--accent)'}} />
                  Abertas nos últimos 12 meses
                </label>
              </div>

              {/* ── Linha 3: Natureza Jurídica multi-select ── */}
              <div style={{marginBottom:14,position:'relative'}}>
                <label style={{fontSize:11,color:'var(--muted)',display:'block',marginBottom:5,letterSpacing:.5}}>
                  Natureza Jurídica <span style={{fontSize:9,color:'var(--muted)',background:'var(--surface2)',border:'1px solid var(--border)',padding:'1px 6px',borderRadius:10,marginLeft:4}}>OPCIONAL — MÚLTIPLA</span>
                </label>

                {/* Tags selecionadas */}
                {naturezasSelecionadas.length>0&&(
                  <div style={{display:'flex',flexWrap:'wrap',gap:5,marginBottom:6}}>
                    {naturezasSelecionadas.map(n=>(
                      <span key={n.cod} style={{display:'inline-flex',alignItems:'center',gap:5,padding:'3px 10px',borderRadius:20,fontSize:11,
                        background:'rgba(124,58,237,.15)',border:'1px solid rgba(124,58,237,.4)',color:'#a78bfa',fontFamily:'DM Mono,monospace'}}>
                        {n.cod} · {n.label.split('(')[0].trim()}
                        <button onClick={()=>setNaturezasSelecionadas(p=>p.filter(x=>x.cod!==n.cod))}
                          style={{background:'none',border:'none',cursor:'pointer',color:'#a78bfa',fontSize:13,lineHeight:1,padding:0}}>×</button>
                      </span>
                    ))}
                  </div>
                )}

                {/* Input de busca */}
                <div style={{position:'relative'}}>
                  <input
                    value={buscaNatureza}
                    onChange={e=>{setBuscaNatureza(e.target.value);setNaturezaAberta(true)}}
                    onFocus={()=>setNaturezaAberta(true)}
                    onBlur={()=>setTimeout(()=>setNaturezaAberta(false),180)}
                    placeholder="Digite para buscar natureza jurídica..."
                    style={{width:'100%',background:'var(--surface2)',border:'1px solid var(--border)',borderRadius:8,padding:'8px 12px',fontFamily:'DM Mono,monospace',fontSize:12,color:'var(--text)',outline:'none'}}
                  />
                  {naturezaAberta&&(
                    <div style={{position:'absolute',top:'100%',left:0,right:0,zIndex:200,background:'#111827',border:'1px solid #1e2d4a',borderRadius:8,marginTop:3,maxHeight:220,overflowY:'auto',boxShadow:'0 8px 32px rgba(0,0,0,.6)'}}>
                      {NATUREZAS
                        .filter(n=>{
                          const q=buscaNatureza.toLowerCase()
                          return !naturezasSelecionadas.find(s=>s.cod===n.cod) &&
                            (n.cod.includes(q)||n.label.toLowerCase().includes(q)||q==='')
                        })
                        .map(n=>(
                          <div key={n.cod}
                            onMouseDown={()=>{setNaturezasSelecionadas(p=>[...p,n]);setBuscaNatureza('');setNaturezaAberta(false)}}
                            style={{padding:'9px 14px',cursor:'pointer',fontSize:12,fontFamily:'DM Mono,monospace',color:'var(--text)',borderBottom:'1px solid rgba(30,45,74,.5)',display:'flex',gap:8,alignItems:'center'}}
                            onMouseEnter={e=>e.currentTarget.style.background='rgba(0,212,255,.07)'}
                            onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                            <span style={{fontSize:10,color:'#a78bfa',fontFamily:'monospace',minWidth:38}}>{n.cod}</span>
                            <span>{n.label}</span>
                          </div>
                        ))}
                      {NATUREZAS.filter(n=>{const q=buscaNatureza.toLowerCase();return !naturezasSelecionadas.find(s=>s.cod===n.cod)&&(n.cod.includes(q)||n.label.toLowerCase().includes(q)||q==='')}).length===0&&(
                        <div style={{padding:'12px 14px',fontSize:12,color:'var(--muted)',textAlign:'center'}}>Nenhuma natureza encontrada</div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* ── Linha 4: CNAE multi-select ── */}
              <div style={{marginBottom:14,position:'relative'}}>
                <label style={{fontSize:11,color:'var(--muted)',display:'block',marginBottom:5,letterSpacing:.5}}>
                  Código CNAE <span style={{fontSize:9,color:'var(--muted)',background:'var(--surface2)',border:'1px solid var(--border)',padding:'1px 6px',borderRadius:10,marginLeft:4}}>OPCIONAL — MÚLTIPLO — SOBREPÕE NICHO</span>
                </label>

                {/* Tags selecionadas */}
                {cnaesSelecionados.length>0&&(
                  <div style={{display:'flex',flexWrap:'wrap',gap:5,marginBottom:6}}>
                    {cnaesSelecionados.map(c=>(
                      <span key={c.cod} style={{display:'inline-flex',alignItems:'center',gap:5,padding:'3px 10px',borderRadius:20,fontSize:11,
                        background:'rgba(0,212,255,.1)',border:'1px solid rgba(0,212,255,.4)',color:'var(--accent)',fontFamily:'monospace'}}>
                        {c.cod}{c.label&&` · ${c.label.slice(0,30)}`}
                        <button onClick={()=>setCnaesSelecionados(p=>p.filter(x=>x.cod!==c.cod))}
                          style={{background:'none',border:'none',cursor:'pointer',color:'var(--accent)',fontSize:13,lineHeight:1,padding:0}}>×</button>
                      </span>
                    ))}
                  </div>
                )}

                {/* Input de busca/digitação */}
                <div style={{position:'relative'}}>
                  <input
                    value={buscaCnae}
                    onChange={e=>{setBuscaCnae(e.target.value);setCnaeAberto(true)}}
                    onFocus={()=>setCnaeAberto(true)}
                    onBlur={()=>setTimeout(()=>setCnaeAberto(false),180)}
                    onKeyDown={e=>{
                      if(e.key==='Enter'&&buscaCnae.replace(/\D/g,'').length>=4){
                        const cod=buscaCnae.replace(/\D/g,'')
                        if(!cnaesSelecionados.find(c=>c.cod===cod)){
                          setCnaesSelecionados(p=>[...p,{cod,label:''}])
                          setBuscaCnae('');setCnaeAberto(false)
                        }
                      }
                    }}
                    placeholder="Digite o código (ex: 6920601) ou nome e pressione Enter..."
                    style={{width:'100%',background:'var(--surface2)',border:'1px solid var(--border)',borderRadius:8,padding:'8px 12px',fontFamily:'DM Mono,monospace',fontSize:12,color:'var(--text)',outline:'none'}}
                  />
                  {cnaeAberto&&buscaCnae.length>=2&&(()=>{
                    const q=buscaCnae.toLowerCase().replace(/\D/g,'')||buscaCnae.toLowerCase()
                    const matches=Object.entries(NICHO_CNAE_LABELS).filter(([cod,label])=>
                      !cnaesSelecionados.find(c=>c.cod===cod)&&(cod.includes(q)||label.toLowerCase().includes(buscaCnae.toLowerCase()))
                    ).slice(0,12)
                    if(!matches.length) return null
                    return (
                      <div style={{position:'absolute',top:'100%',left:0,right:0,zIndex:200,background:'#111827',border:'1px solid #1e2d4a',borderRadius:8,marginTop:3,maxHeight:220,overflowY:'auto',boxShadow:'0 8px 32px rgba(0,0,0,.6)'}}>
                        {matches.map(([cod,label])=>(
                          <div key={cod}
                            onMouseDown={()=>{setCnaesSelecionados(p=>[...p,{cod,label}]);setBuscaCnae('');setCnaeAberto(false)}}
                            style={{padding:'9px 14px',cursor:'pointer',fontSize:12,fontFamily:'DM Mono,monospace',color:'var(--text)',borderBottom:'1px solid rgba(30,45,74,.5)',display:'flex',gap:8,alignItems:'center'}}
                            onMouseEnter={e=>e.currentTarget.style.background='rgba(0,212,255,.07)'}
                            onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                            <span style={{fontSize:10,color:'var(--accent)',fontFamily:'monospace',minWidth:60}}>{cod}</span>
                            <span>{label}</span>
                          </div>
                        ))}
                      </div>
                    )
                  })()}
                </div>
              </div>

              {/* ── Linha 5: Qualidade do contato ── */}
              <div style={{borderTop:'1px solid rgba(0,212,255,.1)',paddingTop:14}}>
                <div style={{fontSize:10,color:'var(--accent)',textTransform:'uppercase',letterSpacing:1,fontWeight:700,marginBottom:10}}>
                  🎯 Qualidade do contato — aplicados antes de buscar
                </div>
                <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
                  {[
                    [apenasComTelefone, setApenasComTelefone, '📞 Com telefone',    '#10b981'],
                    [apenasComCelular,  setApenasComCelular,  '📱 Com celular',     '#0ea5e9'],
                    [apenasComEmail,    setApenasComEmail,    '✉️ Com e-mail',      '#00d4ff'],
                    [excluirMei,        setExcluirMei,        '🚫 Excluir MEI',     '#f59e0b'],
                    [somenteMei,        setSomenteMei,        '🧾 Somente MEI',     '#a78bfa'],
                    [somenteMatriz,     setSomenteMatriz,     '🏢 Somente Matriz',  '#10b981'],
                    [somenteFilial,     setSomenteFilial,     '🔗 Somente Filial',  '#0ea5e9'],
                  ].map(([ativo, setter, label, cor])=>{
                    // Regras de exclusão mútua
                    const desabilitado =
                      (label.includes('MEI') && label.includes('Somente') && excluirMei) ||
                      (label.includes('Excluir') && somenteMei) ||
                      (label.includes('Matriz') && somenteFilial) ||
                      (label.includes('Filial') && somenteMatriz)
                    return (
                      <button key={label}
                        onClick={()=>{ if(!desabilitado) setter(v=>!v) }}
                        disabled={desabilitado}
                        style={{padding:'7px 14px',borderRadius:9,cursor:desabilitado?'not-allowed':'pointer',fontFamily:'DM Mono,monospace',fontSize:11,
                          fontWeight:ativo?700:400,transition:'all .18s',
                          border:`1.5px solid ${ativo?cor:desabilitado?'rgba(100,116,139,.2)':cor+'44'}`,
                          background:ativo?`${cor}18`:desabilitado?'rgba(100,116,139,.05)':'rgba(255,255,255,.02)',
                          color:ativo?cor:desabilitado?'#334155':'#64748b',
                          boxShadow:ativo?`0 0 10px ${cor}30`:'none',
                          opacity:desabilitado?0.45:1}}>
                        {ativo?'✓ ':''}{label}
                      </button>
                    )
                  })}
                </div>
                {(apenasComTelefone||apenasComCelular||apenasComEmail||excluirMei||somenteMei||somenteMatriz||somenteFilial)&&(
                  <div style={{marginTop:10,fontSize:11,color:'#fbbf24',background:'rgba(245,158,11,.08)',border:'1px solid rgba(245,158,11,.2)',borderRadius:7,padding:'7px 12px'}}>
                    ⚡ {[apenasComTelefone&&'Com telefone',apenasComCelular&&'Com celular',apenasComEmail&&'Com e-mail',excluirMei&&'Excluindo MEI',somenteMei&&'Só MEI',somenteMatriz&&'Só Matriz',somenteFilial&&'Só Filial'].filter(Boolean).join(' · ')} — a busca pode demorar mais pois filtra antes de retornar
                  </div>
                )}
              </div>

              <div style={{marginTop:12,fontSize:11,color:'var(--muted)',lineHeight:1.6,background:'rgba(0,212,255,.04)',border:'1px solid rgba(0,212,255,.1)',borderRadius:8,padding:'8px 12px'}}>
                ℹ️ <strong style={{color:'var(--text)'}}>Como funciona:</strong> usa a API <strong style={{color:'var(--accent)'}}>minhareceita.org</strong> (Receita Federal, atualizada mensalmente). O <strong style={{color:'var(--text)'}}>CNAE</strong> é detectado automaticamente pelo nicho. Para mais resultados, deixe a cidade em branco.
              </div>
            </div>
          )}

          <button onClick={buscar} disabled={buscando} className="bb">
            {buscando ? `⏳ ${progresso||'Buscando...'}` : '🔍 Buscar Leads'}
          </button>
        </div>

        {/* ── RESULTADOS ── */}
        {(buscaFeita||leads.length>0)&&(
          <div className="card">
            <div className="rh">
              <div>
                <div style={{fontFamily:'Syne,sans-serif',fontWeight:700,fontSize:16,color:'var(--text)'}}>
                  {leads.length>0?`${leads.length} lead${leads.length!==1?'s':''} encontrado${leads.length!==1?'s':''}`:'Nenhum resultado'}
                </div>
                {selecionados.length>0&&<div style={{fontSize:12,color:'var(--accent)',marginTop:2}}>{selecionados.length} selecionado(s)</div>}
              </div>
              {leads.length>0&&(
                <div style={{display:'flex',gap:8,flexWrap:'wrap',alignItems:'center'}}>
                  <div style={{display:'flex',alignItems:'center',gap:6,flexWrap:'wrap'}}>
                    <span style={{fontSize:11,color:'var(--muted)'}}>Exportar ({alvosExport.length}):</span>
                    {[['CSV','csv'],['XLS','xls'],['TXT','txt'],['PDF','pdf']].map(([label,tipo])=>(
                      <button key={tipo} onClick={()=>{
                        if(tipo==='csv')exportCSV(alvosExport)
                        if(tipo==='xls')exportXLS(alvosExport)
                        if(tipo==='txt')exportTXT(alvosExport)
                        if(tipo==='pdf')exportPDF(alvosExport,{nicho,cnaeManual,uf,cidade})
                        showToast(`📥 Exportando ${alvosExport.length} leads como ${tipo.toUpperCase()}...`)
                      }} className="be">{label}</button>
                    ))}
                  </div>
                  <button onClick={()=>setShowCRM(true)} className="bc">🤝 Importar no CRM</button>
                </div>
              )}
            </div>

            {erroAPI&&<div className="av" style={{marginBottom:12,whiteSpace:'pre-line'}}>{erroAPI}</div>}

            {cnaesUsados.length>0&&fonte==='receita'&&(
              <div style={{background:'rgba(0,212,255,.04)',border:'1px solid rgba(0,212,255,.1)',borderRadius:8,padding:'7px 12px',marginBottom:10,fontSize:11,color:'var(--muted)'}}>
                🔍 CNAEs pesquisados: <span style={{color:'var(--accent)',fontFamily:'monospace'}}>{cnaesUsados.join(' · ')}</span>
              </div>
            )}

            {leads.length>0&&(
              <>
                {/* ── Filtros pós-busca ── */}
                <div style={{display:'flex',gap:10,marginBottom:12,alignItems:'center',flexWrap:'wrap'}}>
                  <input value={filtroLocal} onChange={e=>setFiltroLocal(e.target.value)}
                    placeholder="🔍 Filtrar lista..."
                    style={{maxWidth:220,background:'var(--surface2)',border:'1px solid var(--border)',borderRadius:8,padding:'8px 12px',fontFamily:'DM Mono,monospace',fontSize:12,color:'var(--text)',outline:'none'}} />

                  {/* Filtrar por texto no e-mail */}
                  <input value={filtroEmailContem} onChange={e=>setFiltroEmailContem(e.target.value)}
                    placeholder="✉️ Filtrar e-mail (ex: cont)"
                    style={{maxWidth:200,background:'var(--surface2)',border:'1px solid rgba(0,212,255,.3)',borderRadius:8,padding:'8px 12px',fontFamily:'DM Mono,monospace',fontSize:12,color:'var(--text)',outline:'none'}} />

                  <button onClick={toggleTodos} className="bs">
                    {selecionados.length===leadsFiltrados.length&&leadsFiltrados.length>0?'✕ Desmarcar':'☑ Marcar todos'}
                  </button>

                  {leadsFiltrados.length!==leads.length&&(
                    <span style={{fontSize:11,color:'var(--muted)'}}>{leadsFiltrados.length} de {leads.length}</span>
                  )}

                  {(filtroLocal||filtroEmailContem) && (
                    <button onClick={()=>{setFiltroLocal('');setFiltroEmailContem('')}}
                      style={{padding:'5px 11px',borderRadius:7,border:'1px solid rgba(239,68,68,.4)',background:'rgba(239,68,68,.08)',color:'#ef4444',cursor:'pointer',fontFamily:'DM Mono,monospace',fontSize:11}}>
                      ✕ Limpar
                    </button>
                  )}
                </div>

                <div className="tw">
                  <table className="lt">
                    <thead>
                      <tr>
                        <th style={{width:36}}><input type="checkbox" checked={selecionados.length===leadsFiltrados.length&&leadsFiltrados.length>0} onChange={toggleTodos} style={{accentColor:'var(--accent)'}}/></th>
                        <th>Empresa</th>
                        <th>Responsável</th>
                        <th>Telefone</th>
                        <th>E-mail</th>
                        <th>Site</th>
                        <th>Endereço</th>
                        <th>Cidade/UF</th>
                        <th>CNPJ</th>
                        <th>CNAE</th>
                        <th>Situação</th>
                        <th>Abertura</th>
                        <th>Fonte</th>
                      </tr>
                    </thead>
                    <tbody>
                      {leadsFiltrados.map(l=>{
                        const ativa = (l.situacao||'').toLowerCase().includes('ativa')
                        return (
                        <tr key={l.id} className={selecionados.includes(l.id)?'sel':''}>
                          <td><input type="checkbox" checked={selecionados.includes(l.id)} onChange={()=>toggleSel(l.id)} style={{accentColor:'var(--accent)'}}/></td>
                          <td>
                            <div className="ln">{l.nome||'—'}</div>
                            {l.fantasia&&l.fantasia!==l.nome&&<div className="ls">{l.fantasia}</div>}
                            {l.atividade&&<div className="la">{l.atividade.slice(0,50)}{l.atividade.length>50?'...':''}</div>}
                          </td>
                          <td className="tm">{l.responsavel||'—'}</td>
                          <td>{l.telefone?<a href={`tel:${l.telefone}`} className="tl">📞 {fmtTel(l.telefone)}</a>:<span className="tm">—</span>}</td>
                          <td>{l.email?<a href={`mailto:${l.email}`} className="el">{l.email}</a>:<span className="tm">—</span>}</td>
                          <td>{l.site?<a href={l.site.startsWith('http')?l.site:'https://'+l.site} target="_blank" rel="noreferrer" className="sl2">🔗</a>:<span className="tm">—</span>}</td>
                          <td className="te">
                            <div>{[l.logradouro,l.numero].filter(Boolean).join(', ')||'—'}</div>
                            {l.bairro&&<div className="ls">{l.bairro}</div>}
                            {l.cep&&<div className="ls">CEP {l.cep}</div>}
                          </td>
                          <td className="tm">{l.cidade||'—'}/{l.uf||'—'}</td>
                          <td style={{fontSize:10,color:'var(--muted)'}}>{fmtDoc(l.cnpj)||'—'}</td>
                          <td style={{fontSize:10,color:'var(--accent)',fontFamily:'monospace'}}>{l.cnae||'—'}</td>
                          <td>
                            {l.situacao
                              ? <span style={{padding:'2px 8px',borderRadius:10,fontSize:10,fontWeight:600,background:ativa?'rgba(16,185,129,.15)':'rgba(239,68,68,.15)',color:ativa?'#10b981':'#ef4444',border:`1px solid ${ativa?'rgba(16,185,129,.3)':'rgba(239,68,68,.3)'}`}}>{ativa?'✅ Ativa':'❌ Inativa'}</span>
                              : <span className="tm">—</span>}
                          </td>
                          <td style={{fontSize:10,color:'var(--muted)',whiteSpace:'nowrap'}}>{fmtData(l.dataInicio)||'—'}</td>
                          <td><span title={l.fonte} style={{fontSize:16}}>{l.fonte==='Receita Federal'?'🏛️':l.fonte==='Google Meu Negócio'?'📍':'📘'}</span></td>
                        </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
                {leadsFiltrados.length===0&&filtroLocal&&<div style={{textAlign:'center',padding:30,color:'var(--muted)',fontSize:13}}>Nenhum lead corresponde ao filtro.</div>}
              </>
            )}

            {buscaFeita&&leads.length===0&&!erroAPI&&(
              <div style={{textAlign:'center',padding:40,color:'var(--muted)',fontSize:14}}>
                <div style={{fontSize:40,marginBottom:12}}>🔍</div>
                Nenhum lead encontrado. Tente ajustar os filtros ou trocar a fonte.
              </div>
            )}
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
  body::before{content:'';position:fixed;inset:0;background-image:linear-gradient(rgba(0,212,255,.02) 1px,transparent 1px),linear-gradient(90deg,rgba(0,212,255,.02) 1px,transparent 1px);background-size:40px 40px;pointer-events:none;z-index:0}
  ::-webkit-scrollbar{width:4px;height:4px}::-webkit-scrollbar-thumb{background:var(--border);border-radius:4px}
  input,select{background:var(--surface2);border:1px solid var(--border);border-radius:8px;padding:9px 12px;font-family:'DM Mono',monospace;font-size:13px;color:var(--text);outline:none;width:100%;transition:border-color .2s}
  input:focus,select:focus{border-color:var(--accent)}
  input::placeholder{color:var(--muted)}
  input[type=date]{color-scheme:dark}
  .pw{max-width:1400px;margin:0 auto;padding:24px 16px 60px;position:relative;z-index:1}
  .pt{font-family:'Syne',sans-serif;font-size:22px;font-weight:800;color:var(--text)}
  .ps{font-size:12px;color:var(--muted);margin-top:3px}
  .card{background:var(--surface);border:1px solid var(--border);border-radius:14px;padding:22px 24px;margin-bottom:16px}
  .sl{font-size:10px;color:var(--muted);text-transform:uppercase;letter-spacing:1px;font-weight:700}
  .ob{font-size:9px;color:var(--muted);background:var(--surface2);border:1px solid var(--border);padding:1px 6px;border-radius:10px;margin-left:4px;text-transform:uppercase;letter-spacing:.3px}
  .fg{display:grid;grid-template-columns:1fr 1fr 1fr;gap:14px;margin-bottom:16px}
  @media(max-width:700px){.fg{grid-template-columns:1fr 1fr}}
  @media(max-width:480px){.fg{grid-template-columns:1fr}}
  .fw{margin-bottom:0}
  .fw label{font-size:11px;color:var(--muted);display:block;margin-bottom:5px;letter-spacing:.5px}
  .fw.req label::after{content:' *';color:var(--accent)}
  .fb{display:flex;align-items:center;gap:12px;padding:14px 16px;border-radius:12px;cursor:pointer;font-family:'DM Mono',monospace;border:1.5px solid var(--border);background:var(--surface2);color:var(--muted);transition:all .2s;text-align:left;flex:1;min-width:180px}
  .fb.fa{border-color:var(--accent);background:rgba(0,212,255,.08);color:var(--accent)}
  .fb:hover:not(.fa){border-color:rgba(0,212,255,.3);color:var(--text)}
  .av{background:rgba(245,158,11,.08);border:1px solid rgba(245,158,11,.25);border-radius:8px;padding:10px 14px;font-size:12px;color:#fbbf24;margin-top:10px;line-height:1.7}
  .ok{background:rgba(16,185,129,.08);border:1px solid rgba(16,185,129,.2);border-radius:8px;padding:8px 14px;font-size:12px;color:#10b981;margin-top:8px}
  .lnk{background:none;border:none;color:var(--accent);cursor:pointer;fontFamily:'DM Mono',monospace;font-size:12px;text-decoration:underline}
  .filtros-box{background:var(--surface2);border:1px solid var(--border);border-radius:12px;padding:16px 18px;margin-bottom:16px}
  .bb{width:100%;padding:13px;border-radius:10px;background:linear-gradient(135deg,var(--accent),#0099bb);border:none;color:#fff;font-family:'DM Mono',monospace;font-size:14px;font-weight:600;cursor:pointer;transition:all .2s}
  .bb:hover:not(:disabled){box-shadow:0 0 20px rgba(0,212,255,.4);transform:translateY(-1px)}
  .bb:disabled{opacity:.6;cursor:not-allowed;transform:none}
  .rh{display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:12px;margin-bottom:16px}
  .be{padding:5px 12px;border-radius:7px;border:1px solid var(--border);background:var(--surface2);color:var(--muted);font-family:'DM Mono',monospace;font-size:11px;cursor:pointer;transition:all .2s;font-weight:600}
  .be:hover{border-color:var(--accent);color:var(--accent)}
  .bc{padding:8px 16px;border-radius:9px;background:linear-gradient(135deg,var(--accent3),#059669);border:none;color:#fff;font-family:'DM Mono',monospace;font-size:12px;font-weight:600;cursor:pointer;transition:all .2s}
  .bc:hover{box-shadow:0 0 16px rgba(16,185,129,.4);transform:translateY(-1px)}
  .bs{padding:6px 14px;border-radius:8px;border:1px solid var(--border);background:var(--surface2);color:var(--muted);font-family:'DM Mono',monospace;font-size:11px;cursor:pointer;white-space:nowrap;transition:all .2s}
  .bs:hover{border-color:var(--accent);color:var(--accent)}
  .tw{overflow-x:auto;border-radius:10px;border:1px solid var(--border)}
  .lt{width:100%;border-collapse:collapse;font-size:12px}
  .lt th{background:var(--surface2);padding:9px 12px;text-align:left;font-size:10px;color:var(--muted);text-transform:uppercase;letter-spacing:.5px;font-weight:700;border-bottom:1px solid var(--border);white-space:nowrap}
  .lt td{padding:9px 12px;border-bottom:1px solid rgba(30,45,74,.5);vertical-align:top}
  .lt tr:last-child td{border-bottom:none}
  .lt tr:hover td{background:rgba(0,212,255,.025)}
  .lt tr.sel td{background:rgba(0,212,255,.06)}
  .ln{font-weight:600;color:var(--text);font-size:13px}
  .ls{font-size:10px;color:var(--muted);margin-top:2px}
  .la{font-size:9px;color:rgba(0,212,255,.55);margin-top:2px}
  .tm{color:var(--muted);font-size:11px}
  .te{font-size:11px;color:var(--muted);min-width:130px}
  .tl{color:var(--accent3);text-decoration:none;font-size:11px;white-space:nowrap}
  .tl:hover{text-decoration:underline}
  .el{color:var(--accent);text-decoration:none;font-size:11px;word-break:break-all}
  .el:hover{text-decoration:underline}
  .sl2{color:var(--accent2);text-decoration:none;font-size:16px}
`

export async function getServerSideProps() { return { props:{} } }
