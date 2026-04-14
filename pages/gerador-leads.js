// pages/gerador-leads.js — Vivanexa SaaS v2
// ✅ Busca corrigida: usa APIs corretas para cada fonte
// ✅ Sem limitação de resultados (busca enquanto houver páginas)
// ✅ Lê chaves Google/Meta do cfg (Config → Google & Meta)

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

// ── Helpers ──────────────────────────────────────────
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

// ─────────────────────────────────────────────────────
// 1. RECEITA FEDERAL — chama rota interna /api/leads/buscar-receita
//    que usa casadosdados.com.br (dados abertos RFB) + open.cnpja.com
// ─────────────────────────────────────────────────────
async function buscarReceita({ nicho, uf, cidade, bairro, logradouro, onProgresso }) {
  onProgresso('Consultando Receita Federal (dados abertos RFB)...')

  const r = await fetch('/api/leads/buscar-receita', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ nicho, uf, cidade, bairro, logradouro }),
    signal:  AbortSignal.timeout(120000), // 2 min — pode demorar para muitos CNAEs
  })

  if (!r.ok) {
    const err = await r.json().catch(() => ({}))
    return { resultados: [], erro: err.error || `Erro ${r.status} na busca` }
  }

  const data = await r.json()
  return { resultados: data.resultados || [], erro: data.aviso || null }
}

// ─────────────────────────────────────────────────────
// 2. GOOGLE PLACES — Text Search + Place Details
// ─────────────────────────────────────────────────────
async function buscarGoogle({ nicho, uf, cidade, bairro, logradouro, apiKey, onProgresso }) {
  if (!apiKey) return { resultados: [], erro: 'Chave Google Places API não configurada.\nAcesse Config → Google & Meta para configurar.' }

  const resultados = []
  let pageToken = null
  // Monta query progressivamente: nicho + bairro + cidade + UF
  const partes = [nicho, bairro, logradouro, cidade, uf, 'Brasil'].filter(Boolean)
  const query  = partes.join(', ')

  onProgresso(`Consultando Google Places: "${query}"...`)

  try {
    do {
      const params = new URLSearchParams({ query, key: apiKey, language: 'pt-BR', region: 'br' })
      if (pageToken) params.set('pagetoken', pageToken)

      const r = await fetch(`https://maps.googleapis.com/maps/api/place/textsearch/json?${params}`, {
        signal: AbortSignal.timeout(15000),
      })
      if (!r.ok) break
      const data = await r.json()

      if (data.status === 'REQUEST_DENIED') {
        return { resultados, erro: `Google API Key inválida ou sem permissão Places.\nDetalhe: ${data.error_message || ''}` }
      }
      if (data.status === 'ZERO_RESULTS') break
      if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') break

      onProgresso(`Google Places: buscando detalhes de ${data.results?.length || 0} lugares... (total: ${resultados.length + (data.results?.length||0)})`)

      for (const place of (data.results || [])) {
        const det = await buscarDetalhesPlace(place.place_id, apiKey)
        resultados.push(mapPlace(place, det))
        await sleep(100)
      }

      pageToken = data.next_page_token || null
      if (pageToken) await sleep(2000)
    } while (pageToken)
  } catch (e) {
    return { resultados, erro: e.message }
  }

  return { resultados, erro: null }
}

async function buscarDetalhesPlace(placeId, apiKey) {
  try {
    const params = new URLSearchParams({
      place_id: placeId,
      fields:   'name,formatted_address,formatted_phone_number,international_phone_number,website,address_components',
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

function mapPlace(place, det) {
  const addr = det.address_components || []
  const get  = (...types) => {
    for (const type of types) {
      const c = addr.find(a => a.types.includes(type))
      if (c) return c.long_name
    }
    return ''
  }
  return {
    id:          `gp_${place.place_id}`,
    nome:        det.name || place.name || '',
    fantasia:    det.name || place.name || '',
    responsavel: '',
    cnpj:        '',
    telefone:    (det.formatted_phone_number || det.international_phone_number || '').replace(/\D/g,''),
    email:       '',
    site:        det.website || '',
    logradouro:  `${get('route')} ${get('street_number')}`.trim() || (place.formatted_address || '').split(',')[0] || '',
    numero:      get('street_number'),
    complemento: '',
    bairro:      get('sublocality_level_1','sublocality','neighborhood'),
    cidade:      get('administrative_area_level_2','locality'),
    uf:          get('administrative_area_level_1'),
    cep:         get('postal_code').replace(/\D/g,''),
    atividade:   (place.types || []).join(', '),
    fonte:       'Google Meu Negócio',
  }
}

// ─────────────────────────────────────────────────────
// 3. META GRAPH API — Pages Search
// ─────────────────────────────────────────────────────
async function buscarMeta({ nicho, uf, cidade, metaToken, onProgresso }) {
  if (!metaToken) return { resultados: [], erro: 'Token Meta (Graph API) não configurado.\nAcesse Config → Google & Meta para configurar.' }

  const resultados = []
  const q = [nicho, cidade, uf].filter(Boolean).join(' ')
  onProgresso(`Consultando Facebook/Instagram: "${q}"...`)

  try {
    let url = `https://graph.facebook.com/v19.0/pages/search?` +
      `q=${encodeURIComponent(q)}&fields=name,phone,website,location,emails,category_list&access_token=${metaToken}&limit=100`

    do {
      const r = await fetch(url, { signal: AbortSignal.timeout(15000) })
      if (!r.ok) {
        const err = await r.json().catch(() => ({}))
        return { resultados, erro: `Meta API: ${err.error?.message || 'Erro ' + r.status}` }
      }
      const data = await r.json()
      if (data.error) return { resultados, erro: data.error.message }

      for (const page of (data.data || [])) {
        resultados.push(mapMetaPage(page))
      }
      onProgresso(`Facebook/Instagram: ${resultados.length} páginas encontradas...`)
      url = data.paging?.next || null
    } while (url)
  } catch (e) {
    return { resultados, erro: e.message }
  }

  return { resultados, erro: null }
}

function mapMetaPage(page) {
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
    bairro:      '',
    cidade:      loc.city || '',
    uf:          loc.state || '',
    cep:         '',
    atividade:   (page.category_list || []).map(c => c.name).join(', '),
    fonte:       'Facebook/Instagram',
  }
}

// ── Exportação ────────────────────────────────────────
function exportCSV(leads) {
  const headers = ['Nome','Fantasia','Responsavel','CNPJ','Telefone','Email','Site','Logradouro','Numero','Complemento','Bairro','Cidade','UF','CEP','Atividade','Fonte']
  const rows = leads.map(l => [
    l.nome, l.fantasia, l.responsavel, fmtDoc(l.cnpj), fmtTel(l.telefone),
    l.email, l.site, l.logradouro, l.numero, l.complemento,
    l.bairro, l.cidade, l.uf, l.cep, l.atividade, l.fonte
  ].map(v => `"${(v||'').replace(/"/g,'""')}"`).join(';'))
  baixar(new Blob(['\uFEFF'+[headers.join(';'),...rows].join('\n')], {type:'text/csv;charset=utf-8'}), 'leads.csv')
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
  const headers = ['Nome','Fantasia','Responsável','CNPJ','Telefone','E-mail','Site','Logradouro','Nº','Complemento','Bairro','Cidade','UF','CEP','Atividade','Fonte']
  const rows = leads.map(l => [
    l.nome, l.fantasia, l.responsavel, fmtDoc(l.cnpj), fmtTel(l.telefone),
    l.email, l.site, l.logradouro, l.numero, l.complemento,
    l.bairro, l.cidade, l.uf, l.cep, l.atividade, l.fonte
  ].map(v => `<td>${(v||'').replace(/&/g,'&amp;').replace(/</g,'&lt;')}</td>`).join(''))
  const html = `<html><head><meta charset="utf-8"></head><body><table><thead><tr>${headers.map(h=>`<th>${h}</th>`).join('')}</tr></thead><tbody>${rows.map(r=>`<tr>${r}</tr>`).join('')}</tbody></table></body></html>`
  baixar(new Blob([html], {type:'application/vnd.ms-excel;charset=utf-8'}), 'leads.xls')
}

function exportPDF(leads, filtros) {
  const w = window.open('', '_blank')
  const rows = leads.map((l,i) => `
    <tr style="background:${i%2===0?'#f8fafc':'#fff'}">
      <td>${i+1}</td>
      <td><strong>${l.nome||'—'}</strong>${l.fantasia&&l.fantasia!==l.nome?`<br><small style="color:#64748b">${l.fantasia}</small>`:''}</td>
      <td>${l.responsavel||'—'}</td>
      <td>${fmtDoc(l.cnpj)||'—'}</td>
      <td>${fmtTel(l.telefone)||'—'}</td>
      <td>${l.email||'—'}</td>
      <td>${l.site?`<a href="${l.site}" style="color:#0099bb">${l.site}</a>`:'—'}</td>
      <td>${[l.logradouro,l.numero,l.complemento].filter(Boolean).join(', ')||'—'}</td>
      <td>${l.bairro||'—'}</td>
      <td>${l.cidade||'—'}/${l.uf||'—'}</td>
      <td>${l.cep||'—'}</td>
      <td><small style="color:#64748b">${l.fonte||'—'}</small></td>
    </tr>`)
  w.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>Leads</title>
  <style>body{font-family:Arial,sans-serif;font-size:11px;padding:16px}h2{color:#0099bb;margin-bottom:4px}.sub{font-size:11px;color:#64748b;margin-bottom:14px}
  table{width:100%;border-collapse:collapse;font-size:9px}th{background:#0f172a;color:#fff;padding:5px 7px;text-align:left}td{padding:4px 7px;border-bottom:1px solid #e2e8f0;vertical-align:top}
  @media print{body{padding:0}}</style></head><body>
  <h2>🎯 Gerador de Leads — Vivanexa SaaS</h2>
  <div class="sub">Nicho: <b>${filtros.nicho}</b> · Estado: <b>${filtros.uf}</b>${filtros.cidade?' · Cidade: <b>'+filtros.cidade+'</b>':''} · <b>${leads.length}</b> leads · ${new Date().toLocaleString('pt-BR')}</div>
  <table><thead><tr><th>#</th><th>Empresa</th><th>Responsável</th><th>CNPJ</th><th>Telefone</th><th>E-mail</th><th>Site</th><th>Endereço</th><th>Bairro</th><th>Cidade/UF</th><th>CEP</th><th>Fonte</th></tr></thead>
  <tbody>${rows.join('')}</tbody></table>
  <script>window.onload=()=>{setTimeout(()=>window.print(),400)}</script></body></html>`)
  w.document.close()
}

function baixar(blob, nome) {
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = nome
  a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 5000)
}

// ── Componente principal ──────────────────────────────
export default function GeradorLeads() {
  const router = useRouter()

  const [user,      setUser]      = useState(null)
  const [cfg,       setCfg]       = useState({})
  const [empresaId, setEmpresaId] = useState(null)
  const [loading,   setLoading]   = useState(true)

  // Formulário
  const [nicho,      setNicho]      = useState('')
  const [uf,         setUf]         = useState('')
  const [cidade,     setCidade]     = useState('')
  const [bairro,     setBairro]     = useState('')
  const [logradouro, setLogradouro] = useState('')
  const [fonte,      setFonte]      = useState('receita')

  // Resultados
  const [leads,       setLeads]       = useState([])
  const [selecionados,setSelecionados]= useState([])
  const [buscando,    setBuscando]    = useState(false)
  const [progresso,   setProgresso]   = useState('')
  const [erroAPI,     setErroAPI]     = useState('')
  const [buscaFeita,  setBuscaFeita]  = useState(false)
  const [filtroLocal, setFiltroLocal] = useState('')

  // Modal CRM
  const [showCRM,    setShowCRM]    = useState(false)
  const [etapaCRM,   setEtapaCRM]   = useState('lead')
  const [etapas,     setEtapas]     = useState(ETAPAS_PADRAO)
  const [importando, setImportando] = useState(false)
  const [importMsg,  setImportMsg]  = useState('')

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
      setEmpresaId(eid); setUser({...session.user,...perfil})
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

  // ── Chaves de API do cfg ────────────────────────────
  const googleKey = cfg.googlePlacesKey || cfg.apiLeads?.googlePlacesKey || ''
  const metaToken = cfg.metaToken       || cfg.apiLeads?.metaGraphToken  || cfg.wpp?.token || ''

  // ── Busca ───────────────────────────────────────────
  async function buscar() {
    if (!nicho.trim()) { showToast('Informe o nicho/segmento', 'err'); return }
    if (!uf)           { showToast('Selecione o estado (UF)', 'err'); return }

    setBuscando(true); setLeads([]); setSelecionados([])
    setErroAPI(''); setBuscaFeita(false); setFiltroLocal('')

    const params = { nicho: nicho.trim(), uf, cidade: cidade.trim(), bairro: bairro.trim(), logradouro: logradouro.trim(), onProgresso: setProgresso }

    try {
      let resultado = []
      let erro = null

      if (fonte === 'receita') {
        const res = await buscarReceita(params)
        resultado = res.resultados; erro = res.erro
      } else if (fonte === 'google') {
        const res = await buscarGoogle({ ...params, apiKey: googleKey })
        resultado = res.resultados; erro = res.erro
      } else {
        const res = await buscarMeta({ ...params, metaToken })
        resultado = res.resultados; erro = res.erro
      }

      setLeads(resultado)
      if (erro) setErroAPI(erro)
    } catch (e) {
      setErroAPI('Erro inesperado: ' + e.message)
    }

    setBuscando(false); setProgresso(''); setBuscaFeita(true)
  }

  // ── Importar CRM ────────────────────────────────────
  async function importarNoCRM() {
    const alvos = selecionados.length > 0 ? leads.filter(l => selecionados.includes(l.id)) : leadsFiltrados
    if (!alvos.length) { showToast('Selecione pelo menos um lead', 'err'); return }
    setImportando(true); setImportMsg('')
    try {
      const { data: row } = await supabase.from('vx_storage').select('value').eq('key', `cfg:${empresaId}`).maybeSingle()
      const cc = row?.value ? JSON.parse(row.value) : {}
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
        endereco:     [l.logradouro,l.numero,l.complemento].filter(Boolean).join(', '),
        bairro:       l.bairro || '',
        cidade:       l.cidade || '',
        uf:           l.uf || '',
        cep:          l.cep || '',
        responsavel:  l.responsavel || '',
        observacoes:  `Importado do Gerador de Leads em ${new Date().toLocaleDateString('pt-BR')}. Fonte: ${l.fonte}. Atividade: ${l.atividade}`,
        origem:       'gerador_leads',
        site:         l.site || '',
        criadoEm:     now,
        atualizadoEm: now,
      }))
      cc.crm_negocios = [...(cc.crm_negocios||[]), ...novos]
      await supabase.from('vx_storage').upsert({ key:`cfg:${empresaId}`, value:JSON.stringify(cc), updated_at:now }, { onConflict:'key' })
      const etapaLabel = etapas.find(e=>e.id===etapaCRM)?.label || etapaCRM
      setImportMsg(`✅ ${novos.length} leads importados para "${etapaLabel}"!`)
      showToast(`✅ ${novos.length} leads no CRM!`)
      setTimeout(() => { setShowCRM(false); setImportMsg('') }, 2500)
    } catch (e) { setImportMsg('❌ Erro: ' + e.message) }
    setImportando(false)
  }

  const leadsFiltrados = leads.filter(l => {
    if (!filtroLocal.trim()) return true
    const q = filtroLocal.toLowerCase()
    return (l.nome||'').toLowerCase().includes(q) || (l.cidade||'').toLowerCase().includes(q) ||
           (l.bairro||'').toLowerCase().includes(q) || (l.cnpj||'').includes(q) ||
           (l.telefone||'').includes(q) || (l.email||'').toLowerCase().includes(q) ||
           (l.responsavel||'').toLowerCase().includes(q)
  })

  const alvosExport = selecionados.length > 0 ? leads.filter(l => selecionados.includes(l.id)) : leadsFiltrados
  const toggleSel   = id => setSelecionados(prev => prev.includes(id) ? prev.filter(x=>x!==id) : [...prev,id])
  const toggleTodos = () => setSelecionados(selecionados.length === leadsFiltrados.length ? [] : leadsFiltrados.map(l=>l.id))

  if (loading) return <div style={{minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center',background:'#0a0f1e',color:'#64748b',fontFamily:'DM Mono,monospace'}}>Carregando...</div>

  return (
    <>
      <Head>
        <title>Gerador de Leads — Vivanexa</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
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
            <div className="ps">Encontre empresas por nicho, localização e fonte de dados</div>
          </div>
          <button onClick={()=>router.push('/configuracoes?tab=google_meta')} style={{padding:'7px 16px',borderRadius:9,border:'1px solid rgba(0,212,255,.3)',background:'rgba(0,212,255,.06)',color:'var(--accent)',fontFamily:'DM Mono,monospace',fontSize:12,cursor:'pointer'}}>
            ⚙️ Configurar APIs
          </button>
        </div>

        {/* Formulário */}
        <div className="card">
          {/* Fonte */}
          <div style={{marginBottom:20}}>
            <div className="sl">Fonte de Dados</div>
            <div style={{display:'flex',gap:10,flexWrap:'wrap'}}>
              {[
                ['receita','🏛️','Receita Federal','Dados abertos da RFB — CNPJ, sócios, endereço'],
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

            {/* Avisos API */}
            {fonte==='google'&&!googleKey&&(
              <div className="av">
                ⚠️ Google Places API Key não configurada.{' '}
                <button onClick={()=>router.push('/configuracoes?tab=google_meta')} style={{background:'none',border:'none',color:'var(--accent)',cursor:'pointer',fontFamily:'DM Mono,monospace',fontSize:12,textDecoration:'underline'}}>Configurar agora →</button>
              </div>
            )}
            {fonte==='meta'&&!metaToken&&(
              <div className="av">
                ⚠️ Token Meta Graph API não configurado.{' '}
                <button onClick={()=>router.push('/configuracoes?tab=google_meta')} style={{background:'none',border:'none',color:'var(--accent)',cursor:'pointer',fontFamily:'DM Mono,monospace',fontSize:12,textDecoration:'underline'}}>Configurar agora →</button>
              </div>
            )}
            {fonte==='google'&&googleKey&&<div className="ok">✅ Google Places API configurada</div>}
            {fonte==='meta'&&metaToken&&<div className="ok">✅ Meta Graph API configurada</div>}
          </div>

          {/* Campos */}
          <div className="fg">
            <div className="fw req">
              <label>Nicho / Segmento *</label>
              <input value={nicho} onChange={e=>setNicho(e.target.value)} placeholder="Ex: Dentista, Contabilidade, Advocacia..." onKeyDown={e=>e.key==='Enter'&&buscar()} />
            </div>
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
            <div className="fw" style={{gridColumn:'span 2'}}>
              <label>Rua / Avenida <span className="ob">opcional</span></label>
              <input value={logradouro} onChange={e=>setLogradouro(e.target.value)} placeholder="Ex: Av. Afonso Pena" />
            </div>
          </div>

          <button onClick={buscar} disabled={buscando} className="bb">
            {buscando ? `⏳ ${progresso||'Buscando...'}` : '🔍 Buscar Leads'}
          </button>
        </div>

        {/* Resultados */}
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
                        if(tipo==='pdf')exportPDF(alvosExport,{nicho,uf,cidade})
                        showToast(`📥 Exportando ${alvosExport.length} leads como ${tipo.toUpperCase()}...`)
                      }} className="be">{label}</button>
                    ))}
                  </div>
                  <button onClick={()=>setShowCRM(true)} className="bc">🤝 Importar no CRM</button>
                </div>
              )}
            </div>

            {erroAPI&&(
              <div className="av" style={{marginBottom:12,whiteSpace:'pre-line'}}>{erroAPI}</div>
            )}

            {leads.length>0&&(
              <>
                <div style={{display:'flex',gap:10,marginBottom:12,alignItems:'center',flexWrap:'wrap'}}>
                  <input value={filtroLocal} onChange={e=>setFiltroLocal(e.target.value)} placeholder="🔍 Filtrar lista..." style={{maxWidth:260,background:'var(--surface2)',border:'1px solid var(--border)',borderRadius:8,padding:'8px 12px',fontFamily:'DM Mono,monospace',fontSize:12,color:'var(--text)',outline:'none'}} />
                  <button onClick={toggleTodos} className="bs">
                    {selecionados.length===leadsFiltrados.length&&leadsFiltrados.length>0?'✕ Desmarcar todos':'☑ Marcar todos'}
                  </button>
                  {leadsFiltrados.length!==leads.length&&<span style={{fontSize:11,color:'var(--muted)'}}>{leadsFiltrados.length} de {leads.length}</span>}
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
                        <th>Fonte</th>
                      </tr>
                    </thead>
                    <tbody>
                      {leadsFiltrados.map(l=>(
                        <tr key={l.id} className={selecionados.includes(l.id)?'sel':''}>
                          <td><input type="checkbox" checked={selecionados.includes(l.id)} onChange={()=>toggleSel(l.id)} style={{accentColor:'var(--accent)'}}/></td>
                          <td>
                            <div className="ln">{l.nome||'—'}</div>
                            {l.fantasia&&l.fantasia!==l.nome&&<div className="ls">{l.fantasia}</div>}
                            {l.atividade&&<div className="la">{l.atividade}</div>}
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
                          <td><span title={l.fonte} style={{fontSize:15}}>{l.fonte==='Receita Federal'?'🏛️':l.fonte==='Google Meu Negócio'?'📍':'📘'}</span></td>
                        </tr>
                      ))}
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
  .pw{max-width:1340px;margin:0 auto;padding:24px 16px 60px;position:relative;z-index:1}
  .pt{font-family:'Syne',sans-serif;font-size:22px;font-weight:800;color:var(--text)}
  .ps{font-size:12px;color:var(--muted);margin-top:3px}
  .card{background:var(--surface);border:1px solid var(--border);border-radius:14px;padding:22px 24px;margin-bottom:16px}
  .sl{font-size:10px;color:var(--muted);text-transform:uppercase;letter-spacing:1px;font-weight:700;margin-bottom:10px}
  .ob{font-size:9px;color:var(--muted);background:var(--surface2);border:1px solid var(--border);padding:1px 6px;border-radius:10px;margin-left:4px;text-transform:uppercase;letter-spacing:.3px}
  .fg{display:grid;grid-template-columns:1fr 1fr 1fr;gap:14px;margin-bottom:16px}
  @media(max-width:700px){.fg{grid-template-columns:1fr 1fr}}
  @media(max-width:480px){.fg{grid-template-columns:1fr}}
  .fw label{font-size:11px;color:var(--muted);display:block;margin-bottom:5px;letter-spacing:.5px}
  .fw.req label::after{content:' *';color:var(--accent)}
  .fb{display:flex;align-items:center;gap:12px;padding:14px 16px;border-radius:12px;cursor:pointer;font-family:'DM Mono',monospace;border:1.5px solid var(--border);background:var(--surface2);color:var(--muted);transition:all .2s;text-align:left;flex:1;min-width:180px}
  .fb.fa{border-color:var(--accent);background:rgba(0,212,255,.08);color:var(--accent)}
  .fb:hover:not(.fa){border-color:rgba(0,212,255,.3);color:var(--text)}
  .av{background:rgba(245,158,11,.08);border:1px solid rgba(245,158,11,.25);border-radius:8px;padding:10px 14px;font-size:12px;color:#fbbf24;margin-top:10px;line-height:1.7}
  .ok{background:rgba(16,185,129,.08);border:1px solid rgba(16,185,129,.2);border-radius:8px;padding:8px 14px;font-size:12px;color:#10b981;margin-top:8px}
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
  .lt td{padding:10px 12px;border-bottom:1px solid rgba(30,45,74,.5);vertical-align:top}
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
  .sl2{color:var(--accent2);text-decoration:none;font-size:15px}
  .sl2:hover{opacity:.8}
`

export async function getServerSideProps() { return { props: {} } }
