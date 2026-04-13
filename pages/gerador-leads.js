// pages/gerador-leads.js — Vivanexa SaaS
// Gerador de Leads: Google Meu Negócio · Receita Federal · Instagram/Facebook
// Exportação: CSV · XLS · TXT · PDF
// Importação direta no CRM (escolha de etapa do funil)

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/router'
import Head from 'next/head'
import { supabase } from '../lib/supabase'
import Navbar from '../components/Navbar'

// ── UFs brasileiras ─────────────────────────────────
const UFS = ['AC','AL','AM','AP','BA','CE','DF','ES','GO','MA','MG','MS','MT','PA','PB','PE','PI','PR','RJ','RN','RO','RR','RS','SC','SE','SP','TO']

// ── Etapas padrão do CRM (espelhado do crm.js) ─────
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

// ── Helpers ─────────────────────────────────────────
const sleep = ms => new Promise(r => setTimeout(r, ms))

function fmtDoc(s) {
  if (!s) return ''
  const d = s.replace(/\D/g, '')
  if (d.length === 14) return d.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5')
  if (d.length === 11) return d.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, '$1.$2.$3-$4')
  return s
}

function fmtTel(s) {
  if (!s) return ''
  const d = s.replace(/\D/g, '')
  if (d.length === 11) return `(${d.slice(0,2)}) ${d.slice(2,7)}-${d.slice(7)}`
  if (d.length === 10) return `(${d.slice(0,2)}) ${d.slice(2,6)}-${d.slice(6)}`
  return s
}

// ── APIs de busca ────────────────────────────────────

// 1. Receita Federal via CNPJá / minhareceita.org
async function buscarReceita({ nicho, uf, cidade, bairro, logradouro, limite = 50 }) {
  const resultados = []
  const queries = []

  // CNPJá — busca por município + atividade
  // Usamos a API pública do minhareceita.org que expõe dados abertos da RFB
  // Endpoint: https://minhareceita.org/cnpj-por-municipio?municipio=...&uf=...
  // Também usamos cnpja.com para enriquecer cada CNPJ encontrado

  try {
    // Monta o termo de busca principal: nicho → atividade econômica
    const termoAtiv = nicho.toLowerCase()

    // Consulta via BrasilAPI que tem endpoint de busca por CNAE/município
    // GET https://brasilapi.com.br/api/cnpj/v1/{cnpj} — enriquecimento
    // Para busca: usamos a API pública de dados abertos da RFB via minhareceita

    const urlBase = `https://minhareceita.org`
    // Busca por município e filtro de atividade
    const cidade_enc = encodeURIComponent(cidade || '')
    const url = `${urlBase}/company?municipio=${cidade_enc}&uf=${uf}&situacao=ATIVA&limit=${limite}`

    const r = await fetch(url, { signal: AbortSignal.timeout(15000) })
    if (r.ok) {
      const data = await r.json()
      const empresas = Array.isArray(data) ? data : (data.companies || data.data || [])

      for (const emp of empresas) {
        // Filtro por nicho na descrição da atividade
        const ativDesc = (emp.cnae_fiscal_descricao || emp.atividade_principal?.[0]?.text || '').toLowerCase()
        const razao    = (emp.razao_social || '').toLowerCase()
        if (!ativDesc.includes(termoAtiv) && !razao.includes(termoAtiv)) continue

        // Filtro por bairro/logradouro se informado
        if (bairro && !(emp.bairro || '').toLowerCase().includes(bairro.toLowerCase())) continue
        if (logradouro && !(emp.logradouro || '').toLowerCase().includes(logradouro.toLowerCase())) continue

        resultados.push(mapearEmpresaReceita(emp))
        if (resultados.length >= limite) break
      }
    }
  } catch (e) {
    console.warn('[Receita] minhareceita falhou:', e.message)
  }

  // Fallback: cnpja.com
  if (resultados.length === 0) {
    try {
      const url = `https://api.cnpja.com/office/search?` + new URLSearchParams({
        q:       nicho,
        state:   uf,
        city:    cidade || '',
        district:bairro || '',
        status:  'ACTIVE',
        limit:   String(limite),
      })
      const r = await fetch(url, {
        headers: { 'Authorization': 'public' },
        signal: AbortSignal.timeout(15000),
      })
      if (r.ok) {
        const data = await r.json()
        const lista = data.offices || data.data || []
        for (const emp of lista) {
          resultados.push(mapearEmpresaCnpja(emp))
          if (resultados.length >= limite) break
        }
      }
    } catch (e) {
      console.warn('[Receita] cnpja falhou:', e.message)
    }
  }

  return resultados
}

function mapearEmpresaReceita(emp) {
  const fone = (emp.ddd_telefone_1 || emp.telefone || '').replace(/\D/g,'')
  return {
    id:           `rf_${emp.cnpj || Date.now()}`,
    nome:         emp.razao_social || emp.nome_fantasia || '',
    fantasia:     emp.nome_fantasia || emp.razao_social || '',
    responsavel:  emp.qsa?.[0]?.nome_socio || '',
    cnpj:         (emp.cnpj || '').replace(/\D/g,''),
    telefone:     fone,
    email:        emp.email || '',
    site:         '',
    logradouro:   [emp.descricao_tipo_logradouro, emp.logradouro].filter(Boolean).join(' '),
    numero:       emp.numero || '',
    complemento:  emp.complemento || '',
    bairro:       emp.bairro || '',
    cidade:       emp.municipio || emp.cidade || '',
    uf:           emp.uf || '',
    cep:          (emp.cep || '').replace(/\D/g,''),
    atividade:    emp.cnae_fiscal_descricao || '',
    fonte:        'Receita Federal',
  }
}

function mapearEmpresaCnpja(emp) {
  const company = emp.company || emp
  const address = emp.address || {}
  const fone    = (company.phones?.[0]?.number || '').replace(/\D/g,'')
  return {
    id:          `rf_${company.tax_id || Date.now()}`,
    nome:        company.name || '',
    fantasia:    company.alias || company.name || '',
    responsavel: company.members?.[0]?.person?.name || '',
    cnpj:        (company.tax_id || '').replace(/\D/g,''),
    telefone:    fone,
    email:       company.emails?.[0]?.address || '',
    site:        '',
    logradouro:  address.street || '',
    numero:      address.number || '',
    complemento: address.details || '',
    bairro:      address.district || '',
    cidade:      address.city || '',
    uf:          address.state || '',
    cep:         (address.zip || '').replace(/\D/g,''),
    atividade:   company.primary_activity?.text || '',
    fonte:       'Receita Federal',
  }
}

// 2. Google Places API (Places Text Search)
async function buscarGooglePlaces({ nicho, uf, cidade, bairro, logradouro, limite = 50, apiKey }) {
  if (!apiKey) return { resultados: [], erro: 'Chave Google Places API não configurada. Acesse Config → Integrações.' }

  const resultados = []
  let pageToken = null
  const local = [nicho, bairro, logradouro, cidade, uf, 'Brasil'].filter(Boolean).join(', ')

  try {
    do {
      const params = new URLSearchParams({
        query:  local,
        key:    apiKey,
        language: 'pt-BR',
        region: 'br',
      })
      if (pageToken) params.set('pagetoken', pageToken)

      const r = await fetch(`https://maps.googleapis.com/maps/api/place/textsearch/json?${params}`, {
        signal: AbortSignal.timeout(15000),
      })
      if (!r.ok) break
      const data = await r.json()
      if (data.status === 'REQUEST_DENIED') return { resultados, erro: data.error_message || 'API Key inválida ou sem permissão Places' }

      for (const place of (data.results || [])) {
        // Buscar detalhes do lugar
        const det = await buscarDetalhesPlace(place.place_id, apiKey)
        resultados.push(mapearPlace(place, det))
        if (resultados.length >= limite) break
        await sleep(200) // respeita rate limit
      }

      pageToken = data.next_page_token || null
      if (pageToken) await sleep(2000) // Google exige delay antes de usar pagetoken
    } while (pageToken && resultados.length < limite)
  } catch (e) {
    return { resultados, erro: e.message }
  }

  return { resultados, erro: null }
}

async function buscarDetalhesPlace(placeId, apiKey) {
  try {
    const params = new URLSearchParams({
      place_id: placeId,
      fields:   'name,formatted_address,formatted_phone_number,website,address_components,international_phone_number',
      key:      apiKey,
      language: 'pt-BR',
    })
    const r = await fetch(`https://maps.googleapis.com/maps/api/place/details/json?${params}`, {
      signal: AbortSignal.timeout(10000),
    })
    if (!r.ok) return {}
    const d = await r.json()
    return d.result || {}
  } catch { return {} }
}

function mapearPlace(place, det) {
  const addr = det.address_components || []
  const get  = type => addr.find(c => c.types.includes(type))?.long_name || ''

  return {
    id:          `gp_${place.place_id}`,
    nome:        det.name || place.name || '',
    fantasia:    det.name || place.name || '',
    responsavel: '',
    cnpj:        '',
    telefone:    (det.formatted_phone_number || det.international_phone_number || '').replace(/\D/g,''),
    email:       '',
    site:        det.website || '',
    logradouro:  `${get('route')} ${get('street_number')}`.trim() || place.formatted_address?.split(',')[0] || '',
    numero:      get('street_number'),
    complemento: '',
    bairro:      get('sublocality_level_1') || get('sublocality') || get('neighborhood'),
    cidade:      get('administrative_area_level_2') || get('locality'),
    uf:          get('administrative_area_level_1'),
    cep:         get('postal_code').replace(/\D/g,''),
    atividade:   (place.types || []).join(', '),
    fonte:       'Google Meu Negócio',
  }
}

// 3. Meta / Instagram Graph API
async function buscarMeta({ nicho, uf, cidade, limite = 30, metaToken }) {
  if (!metaToken) return { resultados: [], erro: 'Token Meta (Graph API) não configurado. Acesse Config → Integrações.' }

  const resultados = []
  try {
    // Instagram Business Discovery — busca páginas públicas por categoria/palavra
    const query = encodeURIComponent(`${nicho} ${cidade || ''}`)
    const r = await fetch(
      `https://graph.facebook.com/v19.0/pages/search?q=${query}&fields=name,phone,website,location,emails,category_list&access_token=${metaToken}&limit=${limite}`,
      { signal: AbortSignal.timeout(15000) }
    )
    if (!r.ok) {
      const err = await r.json()
      return { resultados, erro: err.error?.message || 'Erro na Graph API' }
    }
    const data = await r.json()
    for (const page of (data.data || [])) {
      resultados.push(mapearMetaPage(page))
      if (resultados.length >= limite) break
    }
  } catch (e) {
    return { resultados, erro: e.message }
  }
  return { resultados, erro: null }
}

function mapearMetaPage(page) {
  const loc = page.location || {}
  return {
    id:          `meta_${page.id}`,
    nome:        page.name || '',
    fantasia:    page.name || '',
    responsavel: '',
    cnpj:        '',
    telefone:    (page.phone || '').replace(/\D/g,''),
    email:       page.emails?.[0] || '',
    site:        page.website || `https://facebook.com/${page.id}`,
    logradouro:  loc.street || '',
    numero:      '',
    complemento: '',
    bairro:      loc.zip || '',
    cidade:      loc.city || '',
    uf:          loc.state || '',
    cep:         '',
    atividade:   (page.category_list || []).map(c => c.name).join(', '),
    fonte:       'Facebook/Instagram',
  }
}

// ── Exportação ───────────────────────────────────────

function exportCSV(leads) {
  const headers = ['Nome','Fantasia','Responsavel','CNPJ','Telefone','Email','Site','Logradouro','Numero','Complemento','Bairro','Cidade','UF','CEP','Atividade','Fonte']
  const rows = leads.map(l => [
    l.nome, l.fantasia, l.responsavel, fmtDoc(l.cnpj), fmtTel(l.telefone),
    l.email, l.site, l.logradouro, l.numero, l.complemento,
    l.bairro, l.cidade, l.uf, l.cep, l.atividade, l.fonte
  ].map(v => `"${(v||'').replace(/"/g,'""')}"`).join(';'))
  const csv = [headers.join(';'), ...rows].join('\n')
  baixar(new Blob(['\uFEFF'+csv], {type:'text/csv;charset=utf-8'}), 'leads.csv')
}

function exportTXT(leads) {
  const txt = leads.map((l,i) => [
    `--- Lead ${i+1} ---`,
    `Nome: ${l.nome}`, `Fantasia: ${l.fantasia}`, `Responsável: ${l.responsavel}`,
    `CNPJ: ${fmtDoc(l.cnpj)}`, `Telefone: ${fmtTel(l.telefone)}`,
    `E-mail: ${l.email}`, `Site: ${l.site}`,
    `Endereço: ${[l.logradouro,l.numero,l.complemento].filter(Boolean).join(', ')}`,
    `Bairro: ${l.bairro}`, `Cidade: ${l.cidade}/${l.uf}`, `CEP: ${l.cep}`,
    `Atividade: ${l.atividade}`, `Fonte: ${l.fonte}`,
  ].join('\n')).join('\n\n')
  baixar(new Blob([txt], {type:'text/plain;charset=utf-8'}), 'leads.txt')
}

function exportXLS(leads) {
  // Gera um HTML table que o Excel abre diretamente como XLS
  const headers = ['Nome','Fantasia','Responsável','CNPJ','Telefone','E-mail','Site','Logradouro','Nº','Complemento','Bairro','Cidade','UF','CEP','Atividade','Fonte']
  const rows = leads.map(l => [
    l.nome, l.fantasia, l.responsavel, fmtDoc(l.cnpj), fmtTel(l.telefone),
    l.email, l.site, l.logradouro, l.numero, l.complemento,
    l.bairro, l.cidade, l.uf, l.cep, l.atividade, l.fonte
  ].map(v => `<td>${(v||'').replace(/&/g,'&amp;').replace(/</g,'&lt;')}</td>`).join(''))
  const table = `<table><thead><tr>${headers.map(h=>`<th>${h}</th>`).join('')}</tr></thead><tbody>${rows.map(r=>`<tr>${r}</tr>`).join('')}</tbody></table>`
  const html  = `<html><head><meta charset="utf-8"></head><body>${table}</body></html>`
  baixar(new Blob([html], {type:'application/vnd.ms-excel;charset=utf-8'}), 'leads.xls')
}

function exportPDF(leads, filtros) {
  const w = window.open('', '_blank')
  const rows = leads.map((l,i) => `
    <tr style="background:${i%2===0?'#f8fafc':'#fff'}">
      <td>${i+1}</td>
      <td><strong>${l.nome||'—'}</strong>${l.fantasia&&l.fantasia!==l.nome?`<br><small>${l.fantasia}</small>`:''}</td>
      <td>${l.responsavel||'—'}</td>
      <td>${fmtDoc(l.cnpj)||'—'}</td>
      <td>${fmtTel(l.telefone)||'—'}</td>
      <td>${l.email||'—'}</td>
      <td>${l.site?`<a href="${l.site}">${l.site}</a>`:'—'}</td>
      <td>${[l.logradouro,l.numero,l.complemento].filter(Boolean).join(', ')||'—'}</td>
      <td>${l.bairro||'—'}</td>
      <td>${l.cidade||'—'}/${l.uf||'—'}</td>
      <td>${l.cep||'—'}</td>
      <td><span style="font-size:10px;color:#64748b">${l.fonte||'—'}</span></td>
    </tr>`).join('')

  w.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>Leads Vivanexa</title>
  <style>
    body{font-family:Arial,sans-serif;font-size:11px;color:#1e293b;padding:20px}
    h2{color:#0099bb;margin-bottom:4px}
    .sub{font-size:11px;color:#64748b;margin-bottom:16px}
    table{width:100%;border-collapse:collapse;font-size:10px}
    th{background:#0f172a;color:#fff;padding:6px 8px;text-align:left;font-size:10px}
    td{padding:5px 8px;border-bottom:1px solid #e2e8f0;vertical-align:top}
    @media print{body{padding:0}}
  </style></head><body>
  <h2>🎯 Gerador de Leads — Vivanexa SaaS</h2>
  <div class="sub">Nicho: <b>${filtros.nicho}</b> · UF: <b>${filtros.uf}</b> · Cidade: <b>${filtros.cidade||'Todas'}</b> · ${leads.length} leads · Gerado em ${new Date().toLocaleString('pt-BR')}</div>
  <table><thead><tr>
    <th>#</th><th>Empresa</th><th>Responsável</th><th>CNPJ</th><th>Telefone</th>
    <th>E-mail</th><th>Site</th><th>Endereço</th><th>Bairro</th><th>Cidade/UF</th><th>CEP</th><th>Fonte</th>
  </tr></thead><tbody>${rows}</tbody></table>
  <script>window.onload=()=>window.print()</script></body></html>`)
  w.document.close()
}

function baixar(blob, nome) {
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = nome
  a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 5000)
}

// ── Componente principal ─────────────────────────────
export default function GeradorLeads() {
  const router = useRouter()

  // Auth
  const [user,      setUser]      = useState(null)
  const [cfg,       setCfg]       = useState({})
  const [empresaId, setEmpresaId] = useState(null)
  const [loading,   setLoading]   = useState(true)

  // Formulário de busca
  const [nicho,       setNicho]       = useState('')
  const [uf,          setUf]          = useState('')
  const [cidade,      setCidade]      = useState('')
  const [bairro,      setBairro]      = useState('')
  const [logradouro,  setLogradouro]  = useState('')
  const [fonte,       setFonte]       = useState('receita') // receita | google | meta
  const [limite,      setLimite]      = useState(50)

  // Resultados
  const [leads,       setLeads]       = useState([])
  const [selecionados,setSelecionados]= useState([])
  const [buscando,    setBuscando]    = useState(false)
  const [progresso,   setProgresso]   = useState('')
  const [erroAPI,     setErroAPI]     = useState('')
  const [buscaFeita,  setBuscaFeita]  = useState(false)

  // Filtro local
  const [filtroLocal, setFiltroLocal] = useState('')

  // Modal CRM import
  const [showCRM,     setShowCRM]     = useState(false)
  const [etapaCRM,    setEtapaCRM]    = useState('lead')
  const [etapas,      setEtapas]      = useState(ETAPAS_PADRAO)
  const [importando,  setImportando]  = useState(false)
  const [importMsg,   setImportMsg]   = useState('')

  // Toast
  const [toast, setToast] = useState(null)
  const showToast = (msg, tipo='ok') => { setToast({msg,tipo}); setTimeout(()=>setToast(null),3500) }

  useEffect(() => {
    async function init() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.replace('/'); return }
      let { data: perfil } = await supabase.from('perfis').select('*').eq('user_id', session.user.id).maybeSingle()
      if (!perfil) {
        const nome = session.user.email?.split('@')[0] || 'Usuário'
        const { data: np } = await supabase.from('perfis').insert({ user_id:session.user.id, nome, email:session.user.email, empresa_id:session.user.id, perfil:'admin' }).select().single()
        perfil = np
      }
      const eid = perfil?.empresa_id || session.user.id
      setEmpresaId(eid)
      setUser({ ...session.user, ...perfil })
      const { data: row } = await supabase.from('vx_storage').select('value').eq('key', `cfg:${eid}`).maybeSingle()
      if (row?.value) {
        const c = JSON.parse(row.value)
        setCfg(c)
        if (c.crm_etapas?.length) setEtapas(c.crm_etapas)
      }
      setLoading(false)
    }
    init()
  }, [router])

  // ── Busca principal ────────────────────────────────
  async function buscar() {
    if (!nicho.trim()) { showToast('Informe o nicho/segmento', 'err'); return }
    if (!uf)           { showToast('Selecione o estado (UF)', 'err'); return }

    setBuscando(true); setLeads([]); setSelecionados([]); setErroAPI(''); setBuscaFeita(false)
    setProgresso('Iniciando busca...')

    try {
      if (fonte === 'receita') {
        setProgresso('Consultando Receita Federal (dados abertos)...')
        const res = await buscarReceita({ nicho: nicho.trim(), uf, cidade: cidade.trim(), bairro: bairro.trim(), logradouro: logradouro.trim(), limite })
        setLeads(res)
        if (res.length === 0) setErroAPI('Nenhum resultado encontrado. Tente termos mais amplos ou verifique a ortografia.')
      }

      if (fonte === 'google') {
        const apiKey = cfg.googlePlacesKey || cfg.googleApiKey || ''
        setProgresso('Consultando Google Places API...')
        const { resultados, erro } = await buscarGooglePlaces({ nicho: nicho.trim(), uf, cidade: cidade.trim(), bairro: bairro.trim(), logradouro: logradouro.trim(), limite, apiKey })
        if (erro) setErroAPI(erro)
        setLeads(resultados)
      }

      if (fonte === 'meta') {
        const metaToken = cfg.wpp?.token || cfg.metaToken || ''
        setProgresso('Consultando Facebook/Instagram Graph API...')
        const { resultados, erro } = await buscarMeta({ nicho: nicho.trim(), uf, cidade: cidade.trim(), limite, metaToken })
        if (erro) setErroAPI(erro)
        setLeads(resultados)
      }
    } catch (e) {
      setErroAPI('Erro inesperado: ' + e.message)
    }

    setBuscando(false); setProgresso(''); setBuscaFeita(true)
  }

  // ── Importar no CRM ────────────────────────────────
  async function importarNoCRM() {
    const alvos = selecionados.length > 0 ? leads.filter(l => selecionados.includes(l.id)) : leads
    if (!alvos.length) { showToast('Selecione pelo menos um lead', 'err'); return }

    setImportando(true); setImportMsg('')
    try {
      const { data: row } = await supabase.from('vx_storage').select('value').eq('key', `cfg:${empresaId}`).maybeSingle()
      const currentCfg = row?.value ? JSON.parse(row.value) : {}
      const now = new Date().toISOString()
      const novos = alvos.map(l => ({
        id:           `neg_${Date.now()}_${Math.random().toString(36).slice(2,6)}`,
        titulo:       l.nome || l.fantasia || 'Lead importado',
        etapa:        etapaCRM,
        nome:         l.nome || '',
        fantasia:     l.fantasia || '',
        cnpj:         l.cnpj || '',
        email:        l.email || '',
        telefone:     fmtTel(l.telefone),
        endereco:     [l.logradouro, l.numero, l.complemento].filter(Boolean).join(', '),
        cidade:       l.cidade || '',
        uf:           l.uf || '',
        responsavel:  l.responsavel || '',
        observacoes:  `Lead importado do Gerador de Leads em ${new Date().toLocaleDateString('pt-BR')}. Fonte: ${l.fonte}. Atividade: ${l.atividade}`,
        origem:       'gerador_leads',
        site:         l.site || '',
        criadoEm:     now,
        atualizadoEm: now,
      }))

      currentCfg.crm_negocios = [...(currentCfg.crm_negocios || []), ...novos]
      await supabase.from('vx_storage').upsert({
        key: `cfg:${empresaId}`, value: JSON.stringify(currentCfg), updated_at: now
      }, { onConflict: 'key' })

      setImportMsg(`✅ ${novos.length} leads importados para o CRM na etapa "${etapas.find(e=>e.id===etapaCRM)?.label}"!`)
      setTimeout(() => { setShowCRM(false); setImportMsg('') }, 2500)
      showToast(`✅ ${novos.length} leads no CRM!`)
    } catch (e) {
      setImportMsg('❌ Erro: ' + e.message)
    }
    setImportando(false)
  }

  // ── Leads filtrados localmente ─────────────────────
  const leadsFiltrados = leads.filter(l => {
    if (!filtroLocal.trim()) return true
    const q = filtroLocal.toLowerCase()
    return (l.nome||'').toLowerCase().includes(q) ||
           (l.cidade||'').toLowerCase().includes(q) ||
           (l.bairro||'').toLowerCase().includes(q) ||
           (l.cnpj||'').includes(q) ||
           (l.telefone||'').includes(q) ||
           (l.email||'').toLowerCase().includes(q)
  })

  const alvosExport = selecionados.length > 0 ? leads.filter(l => selecionados.includes(l.id)) : leadsFiltrados

  const toggleSel = id => setSelecionados(prev => prev.includes(id) ? prev.filter(x=>x!==id) : [...prev,id])
  const toggleTodos = () => setSelecionados(selecionados.length === leadsFiltrados.length ? [] : leadsFiltrados.map(l=>l.id))

  if (loading) return (
    <div style={{minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center',background:'#0a0f1e',color:'#64748b',fontFamily:'DM Mono,monospace'}}>
      Carregando...
    </div>
  )

  const filtros = { nicho, uf, cidade }

  return (
    <>
      <Head>
        <title>Gerador de Leads — Vivanexa</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <link href="https://fonts.googleapis.com/css2?family=Syne:wght@600;700;800&family=DM+Mono:wght@300;400;500&display=swap" rel="stylesheet" />
      </Head>
      <style>{CSS}</style>

      {toast && (
        <div style={{position:'fixed',bottom:24,left:'50%',transform:'translateX(-50%)',zIndex:9999,padding:'10px 22px',borderRadius:10,fontFamily:'DM Mono,monospace',fontSize:13,backdropFilter:'blur(8px)',
          background: toast.tipo==='err' ? 'rgba(239,68,68,.9)' : 'rgba(16,185,129,.9)', color:'#fff', boxShadow:'0 4px 24px rgba(0,0,0,.5)'}}>
          {toast.msg}
        </div>
      )}

      {/* Modal CRM */}
      {showCRM && (
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,.80)',zIndex:2000,display:'flex',alignItems:'center',justifyContent:'center',padding:20}} onClick={()=>setShowCRM(false)}>
          <div style={{background:'#111827',border:'1px solid #1e2d4a',borderRadius:16,padding:28,width:'100%',maxWidth:480}} onClick={e=>e.stopPropagation()}>
            <div style={{fontFamily:'Syne,sans-serif',fontWeight:700,fontSize:17,color:'#e2e8f0',marginBottom:6}}>🤝 Importar no CRM</div>
            <div style={{fontSize:12,color:'#64748b',marginBottom:20}}>
              {selecionados.length > 0 ? `${selecionados.length} lead(s) selecionado(s)` : `Todos os ${leadsFiltrados.length} leads da lista`} serão importados no funil.
            </div>

            <div style={{marginBottom:16}}>
              <label style={{fontSize:11,color:'#64748b',display:'block',marginBottom:6,letterSpacing:.5,textTransform:'uppercase'}}>Etapa do Funil de Destino</label>
              <div style={{display:'flex',flexWrap:'wrap',gap:8}}>
                {etapas.map(e => (
                  <button key={e.id} onClick={() => setEtapaCRM(e.id)}
                    style={{padding:'6px 14px',borderRadius:8,cursor:'pointer',fontFamily:'DM Mono,monospace',fontSize:12,
                      border: `1.5px solid ${etapaCRM===e.id ? e.cor : e.cor+'44'}`,
                      background: etapaCRM===e.id ? `${e.cor}22` : 'transparent',
                      color: etapaCRM===e.id ? e.cor : e.cor+'88',
                      fontWeight: etapaCRM===e.id ? 700 : 400}}>
                    {e.label}
                  </button>
                ))}
              </div>
            </div>

            {importMsg && (
              <div style={{padding:'10px 14px',borderRadius:8,marginBottom:14,fontSize:13,
                background: importMsg.startsWith('✅') ? 'rgba(16,185,129,.1)' : 'rgba(239,68,68,.1)',
                color: importMsg.startsWith('✅') ? '#10b981' : '#ef4444',
                border: `1px solid ${importMsg.startsWith('✅') ? 'rgba(16,185,129,.3)' : 'rgba(239,68,68,.3)'}`}}>
                {importMsg}
              </div>
            )}

            <div style={{display:'flex',gap:10}}>
              <button onClick={()=>setShowCRM(false)} style={{flex:1,padding:10,background:'none',border:'1px solid #1e2d4a',color:'#64748b',borderRadius:10,cursor:'pointer',fontFamily:'DM Mono,monospace',fontSize:13}}>Cancelar</button>
              <button onClick={importarNoCRM} disabled={importando}
                style={{flex:2,padding:10,background:'linear-gradient(135deg,#10b981,#059669)',border:'none',color:'#fff',borderRadius:10,cursor:importando?'not-allowed':'pointer',fontFamily:'DM Mono,monospace',fontSize:13,fontWeight:600,opacity:importando?.7:1}}>
                {importando ? '⏳ Importando...' : '✅ Importar no CRM'}
              </button>
            </div>
          </div>
        </div>
      )}

      <Navbar cfg={cfg} perfil={user} />

      <div className="page-wrap">
        <div className="page-title">🎯 Gerador de Leads</div>
        <div className="page-sub">Encontre empresas por nicho, localização e fonte de dados</div>

        {/* ── FORMULÁRIO ── */}
        <div className="card">
          {/* Fonte */}
          <div style={{marginBottom:20}}>
            <div className="sec-label">Fonte de Dados</div>
            <div style={{display:'flex',gap:10,flexWrap:'wrap'}}>
              {[
                ['receita', '🏛️', 'Receita Federal', 'Dados abertos da RFB — CNPJ, responsável, endereço'],
                ['google',  '📍', 'Google Meu Negócio', 'Google Places API — telefone, site, endereço'],
                ['meta',    '📘', 'Facebook / Instagram', 'Meta Graph API — páginas de negócios'],
              ].map(([val, icon, label, desc]) => (
                <button key={val} onClick={() => setFonte(val)}
                  className={`fonte-btn ${fonte===val ? 'ativo' : ''}`}>
                  <span style={{fontSize:20}}>{icon}</span>
                  <div>
                    <div style={{fontWeight:700,fontSize:13}}>{label}</div>
                    <div style={{fontSize:10,color:fonte===val?'rgba(0,212,255,.7)':'var(--muted)',marginTop:2}}>{desc}</div>
                  </div>
                </button>
              ))}
            </div>

            {/* Avisos de configuração */}
            {fonte === 'google' && !cfg.googlePlacesKey && !cfg.googleApiKey && (
              <div className="aviso-cfg">
                ⚠️ Google Places API Key não configurada. Acesse{' '}
                <button onClick={() => router.push('/configuracoes?tab=integracoes')} style={{background:'none',border:'none',color:'var(--accent)',cursor:'pointer',fontFamily:'DM Mono,monospace',fontSize:12,textDecoration:'underline'}}>
                  Config → Integrações
                </button>{' '}e adicione sua chave.
              </div>
            )}
            {fonte === 'meta' && !cfg.wpp?.token && !cfg.metaToken && (
              <div className="aviso-cfg">
                ⚠️ Token da Meta Graph API não configurado. Acesse{' '}
                <button onClick={() => router.push('/configuracoes?tab=integracoes')} style={{background:'none',border:'none',color:'var(--accent)',cursor:'pointer',fontFamily:'DM Mono,monospace',fontSize:12,textDecoration:'underline'}}>
                  Config → Integrações
                </button>{' '}e configure o WhatsApp/Meta.
              </div>
            )}
          </div>

          {/* Campos */}
          <div className="form-grid">
            <div className="field-wrap required">
              <label>Nicho / Segmento *</label>
              <input value={nicho} onChange={e=>setNicho(e.target.value)}
                placeholder="Ex: Dentista, Contabilidade, Advocacia, Restaurante..."
                onKeyDown={e => e.key==='Enter' && buscar()} />
            </div>
            <div className="field-wrap required">
              <label>Estado (UF) *</label>
              <select value={uf} onChange={e=>setUf(e.target.value)}>
                <option value="">— Selecione —</option>
                {UFS.map(u => <option key={u} value={u}>{u}</option>)}
              </select>
            </div>
            <div className="field-wrap">
              <label>Cidade <span className="opt-badge">opcional</span></label>
              <input value={cidade} onChange={e=>setCidade(e.target.value)} placeholder="Ex: Belo Horizonte" />
            </div>
            <div className="field-wrap">
              <label>Bairro <span className="opt-badge">opcional</span></label>
              <input value={bairro} onChange={e=>setBairro(e.target.value)} placeholder="Ex: Savassi" />
            </div>
            <div className="field-wrap" style={{gridColumn:'span 2'}}>
              <label>Rua / Avenida <span className="opt-badge">opcional</span></label>
              <input value={logradouro} onChange={e=>setLogradouro(e.target.value)} placeholder="Ex: Av. Afonso Pena" />
            </div>
            <div className="field-wrap">
              <label>Limite de resultados</label>
              <select value={limite} onChange={e=>setLimite(Number(e.target.value))}>
                {[20,50,100,200].map(n => <option key={n} value={n}>{n} leads</option>)}
              </select>
            </div>
          </div>

          <button onClick={buscar} disabled={buscando} className="btn-buscar">
            {buscando ? `⏳ ${progresso || 'Buscando...'}` : '🔍 Buscar Leads'}
          </button>
        </div>

        {/* ── RESULTADOS ── */}
        {(buscaFeita || leads.length > 0) && (
          <div className="card">
            {/* Header resultados */}
            <div className="results-header">
              <div>
                <div style={{fontFamily:'Syne,sans-serif',fontWeight:700,fontSize:16,color:'var(--text)'}}>
                  {leads.length > 0 ? `${leads.length} lead${leads.length!==1?'s':''} encontrado${leads.length!==1?'s':''}` : 'Nenhum resultado'}
                </div>
                {selecionados.length > 0 && (
                  <div style={{fontSize:12,color:'var(--accent)',marginTop:2}}>{selecionados.length} selecionado(s)</div>
                )}
              </div>
              {leads.length > 0 && (
                <div style={{display:'flex',gap:8,flexWrap:'wrap',alignItems:'center'}}>
                  {/* Exportar */}
                  <div className="export-group">
                    <span style={{fontSize:11,color:'var(--muted)'}}>Exportar:</span>
                    {[['CSV','csv'],['XLS','xls'],['TXT','txt'],['PDF','pdf']].map(([label,tipo])=>(
                      <button key={tipo} onClick={() => {
                        if (tipo==='csv') exportCSV(alvosExport)
                        if (tipo==='xls') exportXLS(alvosExport)
                        if (tipo==='txt') exportTXT(alvosExport)
                        if (tipo==='pdf') exportPDF(alvosExport, filtros)
                        showToast(`📥 Exportando ${alvosExport.length} leads como ${tipo.toUpperCase()}...`)
                      }} className="btn-export">
                        {label}
                      </button>
                    ))}
                  </div>
                  {/* Importar CRM */}
                  <button onClick={() => setShowCRM(true)} className="btn-crm">
                    🤝 Importar no CRM
                  </button>
                </div>
              )}
            </div>

            {erroAPI && (
              <div className="aviso-cfg" style={{marginBottom:12}}>⚠️ {erroAPI}</div>
            )}

            {leads.length > 0 && (
              <>
                {/* Filtro local + controles */}
                <div style={{display:'flex',gap:10,marginBottom:12,alignItems:'center',flexWrap:'wrap'}}>
                  <input value={filtroLocal} onChange={e=>setFiltroLocal(e.target.value)}
                    placeholder="🔍 Filtrar lista..." className="filtro-local" />
                  <button onClick={toggleTodos} className="btn-sel">
                    {selecionados.length===leadsFiltrados.length?'✕ Desmarcar todos':'☑ Marcar todos'}
                  </button>
                </div>

                {/* Tabela */}
                <div className="table-wrap">
                  <table className="leads-table">
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
                        <th style={{width:80}}>Fonte</th>
                      </tr>
                    </thead>
                    <tbody>
                      {leadsFiltrados.map(l => (
                        <tr key={l.id} className={selecionados.includes(l.id)?'sel':''}>
                          <td><input type="checkbox" checked={selecionados.includes(l.id)} onChange={()=>toggleSel(l.id)} style={{accentColor:'var(--accent)'}}/></td>
                          <td>
                            <div className="lead-nome">{l.nome||'—'}</div>
                            {l.fantasia && l.fantasia !== l.nome && <div className="lead-sub">{l.fantasia}</div>}
                            {l.atividade && <div className="lead-ativ">{l.atividade}</div>}
                          </td>
                          <td className="td-muted">{l.responsavel||'—'}</td>
                          <td>
                            {l.telefone
                              ? <a href={`tel:${l.telefone}`} className="tel-link">📞 {fmtTel(l.telefone)}</a>
                              : <span className="td-muted">—</span>}
                          </td>
                          <td>
                            {l.email
                              ? <a href={`mailto:${l.email}`} className="email-link">{l.email}</a>
                              : <span className="td-muted">—</span>}
                          </td>
                          <td>
                            {l.site
                              ? <a href={l.site} target="_blank" rel="noreferrer" className="site-link">🔗 Site</a>
                              : <span className="td-muted">—</span>}
                          </td>
                          <td className="td-end">
                            <div>{[l.logradouro,l.numero].filter(Boolean).join(', ')||'—'}</div>
                            {l.bairro && <div className="lead-sub">{l.bairro}</div>}
                            {l.cep && <div className="lead-sub">CEP: {l.cep}</div>}
                          </td>
                          <td className="td-muted">{l.cidade||'—'}/{l.uf||'—'}</td>
                          <td className="td-muted" style={{fontSize:10}}>{fmtDoc(l.cnpj)||'—'}</td>
                          <td>
                            <span className={`fonte-badge fonte-${(l.fonte||'').toLowerCase().replace(/[^a-z]/g,'')}`}>
                              {l.fonte==='Receita Federal'?'🏛️':l.fonte==='Google Meu Negócio'?'📍':'📘'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {leadsFiltrados.length === 0 && filtroLocal && (
                  <div style={{textAlign:'center',padding:30,color:'var(--muted)',fontSize:13}}>
                    Nenhum lead corresponde ao filtro "{filtroLocal}".
                  </div>
                )}
              </>
            )}

            {buscaFeita && leads.length === 0 && !erroAPI && (
              <div style={{textAlign:'center',padding:40,color:'var(--muted)',fontSize:14}}>
                <div style={{fontSize:40,marginBottom:12}}>🔍</div>
                Nenhum lead encontrado. Tente ajustar os filtros ou trocar a fonte de dados.
              </div>
            )}
          </div>
        )}
      </div>
    </>
  )
}

const CSS = `
  :root{--bg:#0a0f1e;--surface:#111827;--surface2:#1a2540;--border:#1e2d4a;--accent:#00d4ff;--accent2:#7c3aed;--accent3:#10b981;--text:#e2e8f0;--muted:#64748b;--danger:#ef4444;--warning:#f59e0b;--gold:#fbbf24}
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:'DM Mono',monospace;background:var(--bg);color:var(--text);min-height:100vh}
  body::before{content:'';position:fixed;inset:0;background-image:linear-gradient(rgba(0,212,255,.02) 1px,transparent 1px),linear-gradient(90deg,rgba(0,212,255,.02) 1px,transparent 1px);background-size:40px 40px;pointer-events:none;z-index:0}
  ::-webkit-scrollbar{width:4px;height:4px}::-webkit-scrollbar-thumb{background:var(--border);border-radius:4px}
  input,select{background:var(--surface2);border:1px solid var(--border);border-radius:8px;padding:9px 12px;font-family:'DM Mono',monospace;font-size:13px;color:var(--text);outline:none;width:100%;transition:border-color .2s}
  input:focus,select:focus{border-color:var(--accent)}
  input::placeholder{color:var(--muted)}
  .page-wrap{max-width:1300px;margin:0 auto;padding:24px 16px 60px;position:relative;z-index:1}
  .page-title{font-family:'Syne',sans-serif;font-size:22px;font-weight:800;color:var(--text);margin-bottom:4px}
  .page-sub{font-size:12px;color:var(--muted);margin-bottom:20px}
  .card{background:var(--surface);border:1px solid var(--border);border-radius:14px;padding:22px 24px;margin-bottom:16px}
  .sec-label{font-size:10px;color:var(--muted);text-transform:uppercase;letter-spacing:1px;font-weight:700;margin-bottom:10px}
  .opt-badge{font-size:9px;color:var(--muted);background:var(--surface2);border:1px solid var(--border);padding:1px 6px;border-radius:10px;margin-left:4px;text-transform:uppercase;letter-spacing:.3px}
  .form-grid{display:grid;grid-template-columns:1fr 1fr 1fr;gap:14px;margin-bottom:16px}
  @media(max-width:720px){.form-grid{grid-template-columns:1fr 1fr}}
  @media(max-width:480px){.form-grid{grid-template-columns:1fr}}
  .field-wrap label{font-size:11px;color:var(--muted);display:block;margin-bottom:5px;letter-spacing:.5px}
  .field-wrap.required label::after{content:' *';color:var(--accent)}
  .fonte-btn{display:flex;align-items:center;gap:12px;padding:14px 16px;border-radius:12px;cursor:pointer;font-family:'DM Mono',monospace;border:1.5px solid var(--border);background:var(--surface2);color:var(--muted);transition:all .2s;text-align:left;flex:1;min-width:200px}
  .fonte-btn.ativo{border-color:var(--accent);background:rgba(0,212,255,.08);color:var(--accent)}
  .fonte-btn:hover:not(.ativo){border-color:rgba(0,212,255,.3);color:var(--text)}
  .aviso-cfg{background:rgba(245,158,11,.08);border:1px solid rgba(245,158,11,.25);border-radius:8px;padding:10px 14px;font-size:12px;color:#fbbf24;margin-top:10px;line-height:1.6}
  .btn-buscar{width:100%;padding:13px;border-radius:10px;background:linear-gradient(135deg,var(--accent),#0099bb);border:none;color:#fff;font-family:'DM Mono',monospace;font-size:14px;font-weight:600;cursor:pointer;transition:all .2s;letter-spacing:.3px}
  .btn-buscar:hover:not(:disabled){box-shadow:0 0 20px rgba(0,212,255,.4);transform:translateY(-1px)}
  .btn-buscar:disabled{opacity:.6;cursor:not-allowed;transform:none}
  .results-header{display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:12px;margin-bottom:16px}
  .export-group{display:flex;align-items:center;gap:6px;flex-wrap:wrap}
  .btn-export{padding:5px 12px;border-radius:7px;border:1px solid var(--border);background:var(--surface2);color:var(--muted);font-family:'DM Mono',monospace;font-size:11px;cursor:pointer;transition:all .2s;font-weight:600}
  .btn-export:hover{border-color:var(--accent);color:var(--accent)}
  .btn-crm{padding:8px 16px;border-radius:9px;background:linear-gradient(135deg,var(--accent3),#059669);border:none;color:#fff;font-family:'DM Mono',monospace;font-size:12px;font-weight:600;cursor:pointer;transition:all .2s}
  .btn-crm:hover{box-shadow:0 0 16px rgba(16,185,129,.4);transform:translateY(-1px)}
  .filtro-local{max-width:280px}
  .btn-sel{padding:6px 14px;border-radius:8px;border:1px solid var(--border);background:var(--surface2);color:var(--muted);font-family:'DM Mono',monospace;font-size:11px;cursor:pointer;white-space:nowrap;transition:all .2s}
  .btn-sel:hover{border-color:var(--accent);color:var(--accent)}
  .table-wrap{overflow-x:auto;border-radius:10px;border:1px solid var(--border)}
  .leads-table{width:100%;border-collapse:collapse;font-size:12px}
  .leads-table th{background:var(--surface2);padding:9px 12px;text-align:left;font-size:10px;color:var(--muted);text-transform:uppercase;letter-spacing:.5px;font-weight:700;border-bottom:1px solid var(--border);white-space:nowrap}
  .leads-table td{padding:10px 12px;border-bottom:1px solid rgba(30,45,74,.5);vertical-align:top}
  .leads-table tr:last-child td{border-bottom:none}
  .leads-table tr:hover td{background:rgba(0,212,255,.03)}
  .leads-table tr.sel td{background:rgba(0,212,255,.06)}
  .lead-nome{font-weight:600;color:var(--text);font-size:13px}
  .lead-sub{font-size:10px;color:var(--muted);margin-top:2px}
  .lead-ativ{font-size:9px;color:rgba(0,212,255,.6);margin-top:2px}
  .td-muted{color:var(--muted);font-size:11px}
  .td-end{font-size:11px;color:var(--muted);min-width:140px}
  .tel-link{color:var(--accent3);text-decoration:none;font-size:11px;white-space:nowrap}
  .tel-link:hover{text-decoration:underline}
  .email-link{color:var(--accent);text-decoration:none;font-size:11px;word-break:break-all}
  .email-link:hover{text-decoration:underline}
  .site-link{color:var(--accent2);text-decoration:none;font-size:11px}
  .site-link:hover{text-decoration:underline}
  .fonte-badge{font-size:16px}
`

export async function getServerSideProps() { return { props: {} } }
