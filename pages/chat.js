// ============================================================
// pages/chat.js — Assistente Comercial Vivanexa SaaS
// Copie este arquivo para: vivanexa-saas/pages/chat.js
// ============================================================

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/router'
import Head from 'next/head'
import { supabase } from '../lib/supabase'

// ══════════════════════════════════════════
// CONFIGURAÇÃO PADRÃO (espelho do HTML original)
// ══════════════════════════════════════════
const DEFAULT_CFG = {
  company: 'VIVANEXA',
  slogan: 'Assistente Comercial de Preços',
  theme: 'dark',
  discMode: 'screen',
  discAdPct: 50,
  discMenPct: 0,
  discClosePct: 40,
  unlimitedStrategy: true,
  plans: [
    { id: 'basic',   name: 'Basic',    maxCnpjs: 25,  users: 1,   unlimited: false },
    { id: 'pro',     name: 'Pro',      maxCnpjs: 80,  users: 1,   unlimited: false },
    { id: 'top',     name: 'Top',      maxCnpjs: 150, users: 5,   unlimited: false },
    { id: 'topplus', name: 'Top Plus', maxCnpjs: 999, users: 999, unlimited: true  },
  ],
  prices: {
    'Gestão Fiscal': { basic:[478,318], pro:[590,409], top:[1032,547], topplus:[1398,679] },
    'CND':           { basic:[0,48],    pro:[0,90],    top:[0,150],    topplus:[0,200]    },
    'XML':           { basic:[478,199], pro:[590,299], top:[1032,349], topplus:[1398,399] },
    'BIA':           { basic:[478,129], pro:[590,169], top:[1032,280], topplus:[1398,299] },
    'IF':            { basic:[1600,379],pro:[1600,619],top:[1600,920]                    },
    'EP':            { basic:[0,39],    pro:[0,82],    top:[0,167]                        },
  },
  vouchers: [],
  productNames: {
    'Gestão Fiscal': 'Gestão Fiscal',
    'CND':           'CND',
    'XML':           'XML',
    'BIA':           'BIA',
    'IF':            'Inteligência Fiscal',
    'EP':            'e-PROCESSOS',
    'Tributos':      'Tributos',
  },
}

const IF_NO_CNPJ = ['IF', 'Tributos', 'EP']
const IF_USERS   = { basic: 1, pro: 1, top: 5 }

// ══════════════════════════════════════════
// UTILITÁRIOS DE PRICING
// ══════════════════════════════════════════
const fmt = n => 'R$ ' + n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const cleanDoc = s => s.replace(/\D/g, '')
const isCNPJ   = s => s.length === 14
const isCPF    = s => s.length === 11

function fmtDoc(s) {
  if (!s) return '—'
  if (s.length === 14) return s.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5')
  if (s.length === 11) return s.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, '$1.$2.$3-$4')
  return s
}

function getPlan(n, plans) {
  const sorted = [...plans].sort((a, b) => a.maxCnpjs - b.maxCnpjs)
  for (const p of sorted) if (n <= p.maxCnpjs) return p.id
  return sorted[sorted.length - 1].id
}

function getPlanObj(id, plans) { return plans.find(p => p.id === id) || plans[0] }
function planLabel(id, plans) {
  if (!id) return '—'
  const p = getPlanObj(id, plans)
  return p ? p.name : id.charAt(0).toUpperCase() + id.slice(1)
}

function prodName(key, cfg) {
  if (!key) return key
  if (cfg?.productNames?.[key]) return cfg.productNames[key]
  return key
}

function calcTributos(n) {
  if (!n || n <= 0) return 0
  if (n <= 50)  return 169.90
  if (n <= 100) return 200
  return 200 + (n - 100) * 0.80
}

function getPriceForPlan(mod, planId, cfg) {
  const prices = cfg.prices[mod]
  const defPrices = DEFAULT_CFG.prices[mod]
  const lookup = prices || defPrices
  if (!lookup) return [0, 0]
  if (lookup[planId]) return lookup[planId]
  const keys = Object.keys(lookup)
  if (!keys.length) return [0, 0]
  return lookup[keys[keys.length - 1]] || [0, 0]
}

function calcQuoteFullPrice(mods, plan, ifPlan, cnpjs, notas, cfg) {
  const results = []; let tAd = 0, tMen = 0
  for (const mod of mods) {
    if (mod === 'IF') {
      const p = ifPlan || 'basic'
      const [aB, mB] = getPriceForPlan('IF', p, cfg)
      const ad = aB * 2, men = mB * 1.2
      results.push({ name: prodName('IF', cfg), ad, men, adD: ad, menD: men, isPrepaid: true, plan: p, isIF: true })
      tAd += ad; tMen += men; continue
    }
    if (mod === 'Tributos') {
      const m = calcTributos(notas)
      results.push({ name: prodName('Tributos', cfg), ad: 0, men: m, adD: 0, menD: m, isTributos: true, notas })
      tMen += m; continue
    }
    if (mod === 'EP') {
      const epPlan = plan === 'topplus' ? 'top' : plan
      const [, mB] = getPriceForPlan('EP', epPlan, cfg)
      const men = mB * 1.2
      results.push({ name: prodName('EP', cfg), ad: 0, men, adD: 0, menD: men, isEP: true, plan: epPlan })
      tMen += men; continue
    }
    const [aB, mB] = getPriceForPlan(mod, plan, cfg)
    let ad = aB > 0 ? Math.max(aB * 2, 1000) : 0
    let men = mB * 1.2
    if (mod === 'XML') men = Math.max(men, 175)
    if (mod === 'Gestão Fiscal') men = Math.max(men, 200)
    results.push({ name: mod, ad, men, adD: ad, menD: men, plan })
    tAd += ad; tMen += men
  }
  return { results, tAd, tMen, tAdD: tAd, tMenD: tMen }
}

function calcQuoteWithDiscount(mods, plan, ifPlan, cnpjs, notas, cfg) {
  const results = []; let tAd = 0, tMen = 0, tAdD = 0, tMenD = 0
  for (const mod of mods) {
    if (mod === 'IF') {
      const p = ifPlan || 'basic'
      const [aB, mB] = getPriceForPlan('IF', p, cfg)
      const ad = aB * 2, men = mB * 1.2, adD = aB, menD = mB
      results.push({ name: prodName('IF', cfg), ad, men, adD, menD, isPrepaid: true, plan: p, isIF: true })
      tAd += ad; tMen += men; tAdD += adD; tMenD += menD; continue
    }
    if (mod === 'Tributos') {
      const m = calcTributos(notas)
      results.push({ name: prodName('Tributos', cfg), ad: 0, men: m, adD: 0, menD: m, isTributos: true, notas })
      tMen += m; tMenD += m; continue
    }
    if (mod === 'EP') {
      const epPlan = plan === 'topplus' ? 'top' : plan
      const [, mB] = getPriceForPlan('EP', epPlan, cfg)
      const men = mB * 1.2, menD = mB
      results.push({ name: prodName('EP', cfg), ad: 0, men, adD: 0, menD, isEP: true, plan: epPlan })
      tMen += men; tMenD += menD; continue
    }
    const [aB, mB] = getPriceForPlan(mod, plan, cfg)
    let ad = aB > 0 ? Math.max(aB * 2, 1000) : 0
    let men = mB * 1.2
    if (mod === 'XML') men = Math.max(men, 175)
    if (mod === 'Gestão Fiscal') men = Math.max(men, 200)
    const adD = aB > 0 ? aB : 0, menD = mB
    results.push({ name: mod, ad, men, adD, menD, plan })
    tAd += ad; tMen += men; tAdD += adD; tMenD += menD
  }
  return { results, tAd, tMen, tAdD, tMenD }
}

function calcClosing(mods, plan, ifPlan, cnpjs, notas, cfg) {
  const cp = (cfg.discClosePct || 40) / 100
  const results = []; let tAd = 0, tMen = 0
  for (const mod of mods) {
    if (mod === 'IF') {
      const p = ifPlan || 'basic'
      const [aB, mB] = getPriceForPlan('IF', p, cfg)
      results.push({ name: prodName('IF', cfg), ad: aB * (1 - cp), men: mB, isPrepaid: true, plan: p, isIF: true })
      tAd += aB * (1 - cp); tMen += mB; continue
    }
    if (mod === 'Tributos') {
      const m = calcTributos(notas)
      results.push({ name: prodName('Tributos', cfg), ad: 0, men: m, isTributos: true })
      tMen += m; continue
    }
    if (mod === 'EP') {
      const epPlan = plan === 'topplus' ? 'top' : plan
      const [, mB] = getPriceForPlan('EP', epPlan, cfg)
      results.push({ name: prodName('EP', cfg), ad: 0, men: mB, isEP: true, plan: epPlan })
      tMen += mB; continue
    }
    const [aB] = getPriceForPlan(mod, plan, cfg)
    const ad = aB > 0 ? Math.max(aB * (1 - cp), 0) : 0
    let men = 0
    if (mod === 'BIA')          men = 0.85 * (cnpjs || 0)
    else if (mod === 'CND')     men = 0.40 * (cnpjs || 0)
    else if (mod === 'Gestão Fiscal') men = Math.max(2.00 * (cnpjs || 0), 200)
    else if (mod === 'XML')     men = Math.max(1.75 * (cnpjs || 0), 175)
    results.push({ name: mod, ad, men, plan })
    tAd += ad; tMen += men
  }
  return { results, tAd, tMen }
}

function getNextDates() {
  const now = new Date(), day = now.getDate(), m = now.getMonth(), y = now.getFullYear()
  let tm, ty
  if (day <= 20) {
    tm = m + 1; ty = y; if (tm > 11) { tm = 0; ty++ }
    return [5, 10, 15, 20, 25].map(d => `${String(d).padStart(2,'0')}/${String(tm + 1).padStart(2,'0')}`)
  } else {
    tm = m + 2; ty = y; if (tm > 11) { tm -= 12; ty++ }
    return [5, 10, 15].map(d => `${String(d).padStart(2,'0')}/${String(tm + 1).padStart(2,'0')}`)
  }
}

function parseModules(text, cfg) {
  const t = text.toLowerCase(), found = []
  const ifName = (prodName('IF', cfg) || '').toLowerCase()
  const hasIF  = /intelig[eê]ncia\s*fiscal|intelig.*fiscal/i.test(t) || (ifName && t.includes(ifName))
  if (hasIF) found.push('IF')
  const tNoIF = t.replace(/intelig[eê]ncia\s*fiscal|intelig[\w\s]*fiscal/gi, '')
  const gfName = (prodName('Gestão Fiscal', cfg) || '').toLowerCase()
  if (/gest[aã]o\s*(e\s*an[aá]lise|fiscal)/i.test(tNoIF) || (/\bfiscal\b/i.test(tNoIF) && !/intelig/i.test(tNoIF)) || (gfName && tNoIF.includes(gfName))) found.push('Gestão Fiscal')
  if (/\bbia\b/i.test(t)) found.push('BIA')
  if (/\bcnd\b/i.test(t)) found.push('CND')
  if (/\bxml\b/i.test(t)) found.push('XML')
  if (/tributos/i.test(t)) found.push('Tributos')
  const epName = (prodName('EP', cfg) || '').toLowerCase()
  if (/e[\s-]?process[o]?s?|eprocess/i.test(t) || (epName && t.includes(epName))) found.push('EP')
  return found
}

function parseIFPlan(text, plans) {
  const t = text.toLowerCase()
  for (const p of plans) { if (t.includes(p.name.toLowerCase()) || t.includes(p.id)) return p.id }
  if (/\btop\b/i.test(t)) return 'top'
  if (/\bpro\b/i.test(t)) return 'pro'
  if (/\bbasic\b/i.test(t)) return 'basic'
  return null
}

async function fetchCNPJ(cnpj) {
  try {
    const r = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cnpj}`)
    if (!r.ok) return null
    const d = await r.json()
    const fone = (d.ddd_telefone_1 || d.ddd_telefone_2 || '').replace(/\D/g, '')
    const logr = (d.descricao_tipo_logradouro ? d.descricao_tipo_logradouro + ' ' : '') +
      (d.logradouro || '') + (d.numero && d.numero !== 'S/N' ? ' ' + d.numero : '') +
      (d.complemento ? ' – ' + d.complemento : '')
    return {
      nome: d.razao_social || '',
      fantasia: d.nome_fantasia || d.razao_social || '',
      email: d.email || '',
      telefone: fone.length >= 10 ? `(${fone.slice(0, 2)}) ${fone.slice(2)}` : '',
      municipio: d.municipio || '',
      uf: d.uf || '',
      cep: d.cep?.replace(/\D/g, '') || '',
      logradouro: logr.trim(),
      bairro: d.bairro || '',
      cnpj, tipo: 'PJ'
    }
  } catch (e) { return null }
}

// ══════════════════════════════════════════
// COMPONENTE PRINCIPAL
// ══════════════════════════════════════════
export default function Chat() {
  const router  = useRouter()
  const msgRef  = useRef(null)
  const inputRef = useRef(null)

  const [userProfile, setUserProfile] = useState(null)
  const [cfg, setCfg] = useState(DEFAULT_CFG)
  const [messages, setMessages] = useState([])
  const [input, setInput]   = useState('')
  const [thinking, setThinking] = useState(false)
  const [chips, setChips]   = useState([])
  const [timerVal, setTimerVal] = useState('')
  const [timerDeadline, setTimerDeadline] = useState(null)

  // Estado da conversa
  const stateRef = useRef({
    stage: 'await_doc',
    doc: null, clientData: null,
    users: null, cnpjs: null, modules: [], plan: null,
    ifPlan: null, notas: null,
    quoteData: null, appliedVoucher: null,
  })
  const S = stateRef.current

  // ── Autenticação ───────────────────────────────────────────
  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) { router.replace('/'); return }
      const { data: profile } = await supabase
        .from('perfis')
        .select('*')
        .eq('id', session.user.id)
        .single()
      const userName = profile?.nome || session.user.email?.split('@')[0] || 'Consultor'
      setUserProfile({ ...session.user, nome: userName, perfil: profile })
      await loadCfg(profile?.empresa_id)
    })
    const { data: listener } = supabase.auth.onAuthStateChange((_e, session) => {
      if (!session) router.replace('/')
    })
    return () => listener.subscription.unsubscribe()
  }, [router])

  // ── Mensagem de boas-vindas ────────────────────────────────
  useEffect(() => {
    if (!userProfile) return
    setTimeout(() => {
      addBotMsg(`Olá, ${userProfile.nome}! 👋\n\nSou o assistente comercial da Vivanexa.\nPara começar, informe o **CPF ou CNPJ** do cliente:`)
    }, 300)
  }, [userProfile])

  // ── Timer de fechamento ────────────────────────────────────
  useEffect(() => {
    if (!timerDeadline) return
    const iv = setInterval(() => {
      const diff = timerDeadline - new Date()
      if (diff <= 0) { setTimerVal('EXPIRADO'); clearInterval(iv); return }
      const hh = Math.floor(diff / 3600000)
      const mm = Math.floor((diff % 3600000) / 60000)
      const ss = Math.floor((diff % 60000) / 1000)
      setTimerVal(`${String(hh).padStart(2,'0')}:${String(mm).padStart(2,'0')}:${String(ss).padStart(2,'0')}`)
    }, 1000)
    return () => clearInterval(iv)
  }, [timerDeadline])

  // ── Scroll automático ──────────────────────────────────────
  useEffect(() => {
    if (msgRef.current) msgRef.current.scrollTop = msgRef.current.scrollHeight
  }, [messages, thinking])

  // ── Carregar config da empresa ─────────────────────────────
  async function loadCfg(empresaId) {
    if (!empresaId) return
    try {
      const { data: empresa } = await supabase.from('empresas').select('*').eq('id', empresaId).single()
      const { data: planos }  = await supabase.from('planos').select('*').eq('empresa_id', empresaId)
      const { data: precos }  = await supabase.from('precos').select('*').eq('empresa_id', empresaId)
      const { data: vouchers } = await supabase.from('vales').select('*').eq('empresa_id', empresaId)
      if (empresa) {
        const newCfg = { ...DEFAULT_CFG }
        if (empresa.nome)        newCfg.company = empresa.nome
        if (empresa.slogan)      newCfg.slogan  = empresa.slogan
        if (empresa.disc_ad_pct != null) newCfg.discAdPct   = empresa.disc_ad_pct
        if (empresa.disc_men_pct != null) newCfg.discMenPct = empresa.disc_men_pct
        if (empresa.disc_close_pct != null) newCfg.discClosePct = empresa.disc_close_pct
        if (empresa.disc_mode)   newCfg.discMode = empresa.disc_mode
        if (planos?.length)      newCfg.plans    = planos.map(p => ({ id: p.id, name: p.nome, maxCnpjs: p.max_cnpjs, users: p.max_usuarios, unlimited: p.ilimitado }))
        if (vouchers?.length)    newCfg.vouchers = vouchers.map(v => ({ code: v.codigo, discAdPct: v.desc_ad_pct, discMenPct: v.desc_men_pct, event: v.evento }))
        setCfg(newCfg)
      }
    } catch (e) { console.warn('Erro ao carregar config:', e) }
  }

  // ── Helpers de mensagem ────────────────────────────────────
  function addBotMsg(content, isHTML = false) {
    setMessages(prev => [...prev, { role: 'bot', content, isHTML, id: Date.now() + Math.random() }])
  }
  function addUserMsg(content) {
    setMessages(prev => [...prev, { role: 'user', content, isHTML: false, id: Date.now() + Math.random() }])
  }
  function resetState() {
    Object.assign(S, {
      stage: 'await_doc', doc: null, clientData: null,
      users: null, cnpjs: null, modules: [], plan: null,
      ifPlan: null, notas: null, quoteData: null, appliedVoucher: null
    })
  }

  // ── Processamento da conversa ──────────────────────────────
  async function processInput(text) {
    const t = text.trim(), low = t.toLowerCase()
    if (S.stage === 'closed') return null

    if (['valeu','obrigado','obrigada','tchau'].some(w => low.includes(w)) && S.stage !== 'await_doc') {
      S.stage = 'closed'
      return { type: 'text', content: 'Perfeito! Boas vendas! 🚀' }
    }

    // ETAPA 1: CPF / CNPJ
    if (S.stage === 'await_doc') {
      const doc = cleanDoc(t)
      if (!isCNPJ(doc) && !isCPF(doc)) return { type: 'text', content: 'Por favor, informe o CPF ou CNPJ do cliente (somente números).' }
      S.doc = doc
      if (isCNPJ(doc)) {
        setThinking(true)
        const cd = await fetchCNPJ(doc)
        setThinking(false)
        if (cd) {
          S.clientData = cd
          S.stage = 'await_users'
          return { type: 'html', content: renderClientCard(cd) + `<div style="margin-top:10px;font-size:14px;color:var(--muted)">✅ Empresa encontrada!<br><br>Quantos <strong style="color:var(--text)">usuários</strong> o cliente possui atualmente?</div>` }
        }
      }
      S.clientData = { nome: isCPF(doc) ? 'Cliente PF' : 'Empresa', fantasia: '', cnpj: doc, tipo: isCPF(doc) ? 'PF' : 'PJ' }
      S.stage = 'await_users'
      return { type: 'text', content: (isCNPJ(doc) ? `⚠️ CNPJ ${fmtDoc(doc)} não localizado.\n` : '') + `Quantos usuários o cliente possui atualmente?` }
    }

    // ETAPA 2: Usuários
    if (S.stage === 'await_users') {
      const u = parseInt(t.match(/\d+/)?.[0])
      if (!u || u < 1) return { type: 'text', content: 'Quantos usuários? (informe um número)' }
      S.users = u; S.stage = 'await_modules'
      return { type: 'text', content: `👥 ${u} usuário${u > 1 ? 's' : ''} registrado${u > 1 ? 's' : ''}!\n\nQuais módulos deseja incluir?\n(${prodName('Gestão Fiscal', cfg)} · ${prodName('BIA', cfg)} · ${prodName('CND', cfg)} · ${prodName('XML', cfg)} · ${prodName('IF', cfg)} · ${prodName('EP', cfg)} · ${prodName('Tributos', cfg)})` }
    }

    // ETAPA 3: Plano IF
    if (S.stage === 'await_if_plan') {
      const p = parseIFPlan(t, cfg.plans)
      if (!p) return { type: 'text', content: `Informe o plano ${prodName('IF', cfg)}:\n(${cfg.plans.map(p => p.name).join(', ')})` }
      S.ifPlan = p; S.stage = 'await_modules'; return checkAndCalc()
    }

    // ETAPA 4: Notas fiscais
    if (S.stage === 'await_notas') {
      const n = parseInt(t)
      if (!n || n < 1) return { type: 'text', content: 'Quantas notas fiscais por mês?' }
      S.notas = n; S.stage = 'await_modules'; return checkAndCalc()
    }

    // ETAPA 5: Módulos
    const mods = parseModules(t, cfg)
    for (const m of mods) if (!S.modules.includes(m)) S.modules.push(m)
    const willNeedCNPJ = S.modules.length === 0 || S.modules.some(m => !IF_NO_CNPJ.includes(m))
    if (willNeedCNPJ) { const n = parseInt(t.match(/\b(\d+)\s*(cnpj[s]?)?\b/i)?.[1]); if (n && !S.cnpjs) S.cnpjs = n }
    return checkAndCalc()
  }

  function checkAndCalc() {
    if (S.modules.length === 0)
      return { type: 'text', content: `Quais módulos deseja incluir?\n(${prodName('Gestão Fiscal', cfg)} · ${prodName('BIA', cfg)} · ${prodName('CND', cfg)} · ${prodName('XML', cfg)} · ${prodName('IF', cfg)} · ${prodName('EP', cfg)} · ${prodName('Tributos', cfg)})` }
    if (S.modules.includes('EP') && !S.modules.includes('Gestão Fiscal')) {
      S.modules = S.modules.filter(m => m !== 'EP')
      return { type: 'text', content: `⚠️ O ${prodName('EP', cfg)} exige o módulo ${prodName('Gestão Fiscal', cfg)}.\nPor favor, inclua também o ${prodName('Gestão Fiscal', cfg)}.` }
    }
    if (S.modules.includes('IF') && !S.ifPlan) {
      S.stage = 'await_if_plan'
      return { type: 'text', content: `Qual o plano de ${prodName('IF', cfg)}?\n(${cfg.plans.map(p => p.name).join(', ')})` }
    }
    if (S.modules.includes('Tributos') && !S.notas) {
      S.stage = 'await_notas'
      return { type: 'text', content: 'Quantas notas fiscais por mês?' }
    }
    const needsCNPJ = S.modules.some(m => !IF_NO_CNPJ.includes(m))
    if (needsCNPJ && !S.cnpjs) return { type: 'text', content: 'Quantos CNPJs o cliente possui?' }

    S.plan = needsCNPJ ? getPlan(S.cnpjs, cfg.plans) : 'basic'
    S.quoteData = calcQuoteFullPrice(S.modules, S.plan, S.ifPlan, S.cnpjs, S.notas, cfg)
    const dates = getNextDates()
    S.stage = 'full_quoted'
    return { type: 'html', content: renderFullPriceOnly(S.quoteData, dates) }
  }

  // ── Enviar mensagem ────────────────────────────────────────
  async function sendMessage(text) {
    const txt = (text || input).trim()
    if (!txt) return
    setInput('')
    addUserMsg(txt)
    setChips([])
    setThinking(true)
    const resp = await processInput(txt)
    setThinking(false)
    if (resp) addBotMsg(resp.content, resp.type === 'html')
    if (S.stage === 'await_modules') {
      setChips([
        `${prodName('Gestão Fiscal', cfg)} + ${prodName('BIA', cfg)}`,
        `${prodName('BIA', cfg)} + ${prodName('CND', cfg)} + ${prodName('XML', cfg)}`,
        `${prodName('Gestão Fiscal', cfg)} + ${prodName('EP', cfg)}`,
        prodName('IF', cfg),
      ])
    }
  }

  // ── Handlers dos botões inline ─────────────────────────────
  useEffect(() => {
    window.handleShowDiscount = (yes) => {
      const dates = getNextDates()
      const cn = S.clientData?.fantasia || S.clientData?.nome || fmtDoc(S.doc || '')
      if (yes) {
        S.stage = 'discounted'
        S.quoteData = calcQuoteWithDiscount(S.modules, S.plan, S.ifPlan, S.cnpjs, S.notas, cfg)
        addUserMsg('✅ Sim, quero ver!')
        addBotMsg(renderWithDiscount(S.quoteData, dates, cn, cfg), true)
      } else {
        S.stage = 'closed'
        addUserMsg('Não, obrigado')
        addBotMsg('Sem problemas! 😊')
        setTimeout(() => addBotMsg(
          `<div style="display:flex;flex-direction:column;gap:8px">
            <button class="prop-btn" onclick="window.resetConsulta()">🔄 Iniciar nova consulta</button>
          </div>`, true
        ), 400)
      }
      setChips([])
    }
    window.handleClosingToday = (yes) => {
      const dates = getNextDates()
      if (yes) {
        const data = calcClosing(S.modules, S.plan, S.ifPlan, S.cnpjs, S.notas, cfg)
        S.stage = 'closed'
        addUserMsg('✅ Sim, fechar hoje!')
        const deadline = new Date(); deadline.setHours(18, 0, 0, 0)
        setTimerDeadline(deadline)
        addBotMsg(renderClosingResult(data, dates, cfg), true)
      } else {
        S.stage = 'closed'
        addUserMsg('Não por agora')
        addBotMsg('Entendido! Os valores com desconto padrão continuam válidos.')
        setTimeout(() => addBotMsg(
          `<div style="display:flex;flex-direction:column;gap:8px">
            <button class="prop-btn" onclick="window.resetConsulta()">🔄 Iniciar nova consulta</button>
          </div>`, true
        ), 400)
      }
      setChips([])
    }
    window.tryVoucher = () => {
      const code = (document.getElementById('voucherInput')?.value || '').toUpperCase().trim()
      const v = cfg.vouchers.find(x => x.code === code)
      const msgEl = document.getElementById('voucherMsg')
      if (v) {
        S.appliedVoucher = v
        if (msgEl) msgEl.innerHTML = `<div class="voucher-msg ok">✅ Voucher <strong>${v.code}</strong> aplicado!</div>`
        setTimeout(() => window.handleShowDiscount(true), 800)
      } else {
        if (msgEl) msgEl.innerHTML = `<div class="voucher-msg err">❌ Voucher inválido ou expirado.</div>`
      }
    }
    window.resetConsulta = () => {
      resetState()
      setChips([])
      addBotMsg('🔄 Nova consulta iniciada!\n\nInforme o CPF ou CNPJ do próximo cliente:')
    }
  }, [cfg])

  async function handleLogout() {
    await supabase.auth.signOut()
    router.replace('/')
  }

  // ══════════════════════════════════════════
  // RENDER
  // ══════════════════════════════════════════
  if (!userProfile) return (
    <div style={{ background: '#0a0f1e', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b', fontFamily: 'DM Mono, monospace' }}>
      Carregando...
    </div>
  )

  return (
    <>
      <Head>
        <title>{cfg.company} – Assistente Comercial</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <link href="https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=DM+Mono:wght@300;400;500&family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet" />
      </Head>

      <style>{CSS}</style>

      <div className="orb orb1" /><div className="orb orb2" />

      {/* ── HEADER ── */}
      <header>
        <div className="header-logo">
          <img src="/logo.png" alt={cfg.company} onError={e => e.target.style.display='none'} />
        </div>
        <div className="header-text">
          <h1>{cfg.company}</h1>
          <p>{cfg.slogan}</p>
        </div>

        {/* ── NAVEGAÇÃO ── */}
        <nav className="header-nav">
          <button
            className="nav-btn nav-btn--active"
            onClick={() => router.push('/chat')}
            title="Chat"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
            </svg>
            Chat
          </button>
          <button
            className="nav-btn"
            onClick={() => router.push('/dashboard')}
            title="Dashboard"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/>
              <rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>
            </svg>
            Dashboard
          </button>
          <button
            className="nav-btn"
            onClick={() => router.push('/configuracoes')}
            title="Configurações"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3"/>
              <path d="M19.07 4.93a10 10 0 0 1 0 14.14M4.93 4.93a10 10 0 0 0 0 14.14"/>
              <path d="M12 2v2M12 20v2M2 12h2M20 12h2"/>
            </svg>
            Config.
          </button>
        </nav>

        <div className="status-dot">online</div>
        <div className="header-user">
          <span>{userProfile.nome}</span>
        </div>
        <button className="logout-btn" onClick={handleLogout}>Sair</button>
      </header>

      {/* ── CHAT ── */}
      <div className="chat-wrap">
        <div id="messages" ref={msgRef}>
          {messages.map(m => (
            <div key={m.id} className={`msg ${m.role}`}>
              <div className="msg-label">{m.role === 'user' ? 'Você' : 'Assistente'}</div>
              <div
                className="bubble"
                {...(m.isHTML
                  ? { dangerouslySetInnerHTML: { __html: m.content } }
                  : { children: m.content }
                )}
              />
            </div>
          ))}
          {thinking && (
            <div className="msg bot">
              <div className="thinking"><span /><span /><span /></div>
            </div>
          )}
          {timerVal && (
            <div id="timerDisplay" className="timer-live">{timerVal}</div>
          )}
        </div>

        {/* Chips de sugestão */}
        {chips.length > 0 && (
          <div id="chips">
            {chips.map((c, i) => (
              <button key={i} className="chip" onClick={() => sendMessage(c)}>{c}</button>
            ))}
          </div>
        )}

        {/* Input */}
        <div id="inputArea">
          <textarea
            ref={inputRef}
            id="userInput"
            placeholder="Digite CPF, CNPJ, módulos..."
            value={input}
            onChange={e => { setInput(e.target.value); e.target.style.height = 'auto'; e.target.style.height = Math.min(e.target.scrollHeight, 100) + 'px' }}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() } }}
            rows={1}
          />
          <button className="send-btn" onClick={() => sendMessage()}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
          </button>
        </div>
      </div>
    </>
  )
}

// ══════════════════════════════════════════
// RENDER HELPERS (HTML gerado para o chat)
// ══════════════════════════════════════════
function renderClientCard(cd) {
  const end = [cd.logradouro, cd.bairro, cd.municipio && cd.uf ? cd.municipio + ' – ' + cd.uf : cd.municipio || cd.uf].filter(Boolean).join(', ')
  const cep = cd.cep ? cd.cep.replace(/^(\d{5})(\d{3})$/, '$1-$2') : ''
  return `<div class="client-card">
    <div class="cl-name">${cd.fantasia || cd.nome || fmtDoc(cd.cnpj)}</div>
    ${cd.nome && cd.fantasia ? `<div class="client-row"><span class="cl-label">Razão Social</span><span class="cl-val">${cd.nome}</span></div>` : ''}
    ${cd.cnpj ? `<div class="client-row"><span class="cl-label">CNPJ</span><span class="cl-val">${fmtDoc(cd.cnpj)}</span></div>` : ''}
    ${end ? `<div class="client-row"><span class="cl-label">Endereço</span><span class="cl-val">${end}</span></div>` : ''}
    ${cep ? `<div class="client-row"><span class="cl-label">CEP</span><span class="cl-val">${cep}</span></div>` : ''}
    ${cd.telefone ? `<div class="client-row"><span class="cl-label">Telefone</span><span class="cl-val">${cd.telefone}</span></div>` : ''}
    ${cd.email ? `<div class="client-row"><span class="cl-label">E-mail</span><span class="cl-val">${cd.email}</span></div>` : ''}
  </div>`
}

function renderFullPriceOnly(data, dates) {
  const { results, tAd, tMen } = data
  let h = ''
  for (const r of results) {
    h += `<div class="price-card"><h4>🔹 ${r.name}${r.isPrepaid ? ' <small style="font-size:11px;color:var(--warning)">(pré-pago)</small>' : ''}</h4>`
    if (!r.isTributos && !r.isEP) h += `<div class="price-row"><span class="label">Adesão</span><span class="val">${fmt(r.ad)}</span></div>`
    h += `<div class="price-row"><span class="label">Mensalidade</span><span class="val">${fmt(r.men)}</span></div></div>`
  }
  h += `<div class="price-card" style="border-color:rgba(0,212,255,.25)">
    <h4>🔸 Total</h4>
    <div class="price-row"><span class="label">Adesão total</span><span class="val">${fmt(tAd)}</span></div>
    <div class="price-row"><span class="label">Mensalidade total</span><span class="val">${fmt(tMen)}</span></div>
  </div>`
  h += `<div class="teaser-card">
    <div class="teaser-title">🎫 Há licenças com desconto disponíveis!</div>
    <div class="teaser-body">Temos condições especiais para novos clientes.<br>Deseja ver os valores com desconto?</div>
    <div class="yn-row">
      <button class="yn-btn yes" onclick="window.handleShowDiscount(true)">✅ Sim, quero ver!</button>
      <button class="yn-btn no"  onclick="window.handleShowDiscount(false)">Não, obrigado</button>
    </div>
  </div>`
  h += `<div class="section-label">Próximos vencimentos</div>`
  h += `<div class="dates-box">${dates.map(d => `<span class="date-chip">${d}</span>`).join('')}</div>`
  return h
}

function renderWithDiscount(data, dates, clientName, cfg) {
  const { results, tAd, tMen, tAdD, tMenD } = data
  let h = ''
  for (const r of results) {
    h += `<div class="price-card"><h4>🔹 ${r.name}</h4>`
    if (!r.isTributos && !r.isEP) h += `<div class="price-row"><span class="label">Adesão</span><span class="val">${fmt(r.ad)}</span></div>`
    h += `<div class="price-row"><span class="label">Mensalidade</span><span class="val">${fmt(r.men)}</span></div>`
    h += `<hr class="section-divider">`
    if (!r.isTributos && !r.isEP) h += `<div class="price-row"><span class="label">Adesão de Tabela</span><span class="val discount">${fmt(r.adD)}</span></div>`
    h += `<div class="price-row"><span class="label">Mensalidade c/ desconto</span><span class="val discount">${fmt(r.menD)}</span></div>`
    h += `</div>`
  }
  h += `<div class="price-card" style="border-color:rgba(0,212,255,.25)">
    <h4>🔸 Total</h4>
    <div class="price-row"><span class="label">Adesão total</span><span class="val">${fmt(tAd)}</span></div>
    <div class="price-row"><span class="label">Mensalidade total</span><span class="val">${fmt(tMen)}</span></div>
    <hr class="section-divider">
    <div class="price-row"><span class="label">Adesão de Tabela</span><span class="val discount">${fmt(tAdD)}</span></div>
    <div class="price-row"><span class="label">Mensalidade de Tabela</span><span class="val discount">${fmt(tMenD)}</span></div>
    ${cfg?.unlimitedStrategy ? `<div style="margin-top:8px"><span class="unlimited-badge">♾ Usuários Ilimitados</span></div>` : ''}
  </div>`
  h += `<div class="opp-banner">
    <div class="opp-title">🔥 Oportunidade de Negociação</div>
    <div class="opp-body">
      <strong style="color:var(--gold)">${clientName}</strong> pode fechar agora com condições ainda melhores:<br>
      • Adesão com <strong style="color:var(--gold)">${cfg?.discClosePct || 40}% OFF</strong> sobre o valor base<br>
      • Mensalidade calculada por CNPJ ativo<br>
      ${cfg?.unlimitedStrategy ? `• <span class="unlimited-badge" style="display:inline-flex;font-size:12px">♾ Usuários Ilimitados</span><br>` : ''}
      <br>Oferta válida somente até as <strong style="color:var(--gold)">18h de hoje</strong>.
    </div>
    <div class="yn-row">
      <button class="yn-btn yes" onclick="window.handleClosingToday(true)">✅ Sim, fechar hoje!</button>
      <button class="yn-btn no"  onclick="window.handleClosingToday(false)">Não por agora</button>
    </div>
  </div>`
  h += `<div class="section-label">Próximos vencimentos</div>`
  h += `<div class="dates-box">${dates.map(d => `<span class="date-chip">${d}</span>`).join('')}</div>`
  return h
}

function renderClosingResult(data, dates, cfg) {
  const { results, tAd, tMen } = data
  let h = ''
  for (const r of results) {
    h += `<div class="price-card"><h4>🔹 ${r.name}</h4>`
    if (!r.isTributos && !r.isEP) h += `<div class="price-row"><span class="label">Adesão (fechamento)</span><span class="val closing">${fmt(r.ad)}</span></div>`
    h += `<div class="price-row"><span class="label">Mensalidade</span><span class="val closing">${fmt(r.men)}</span></div></div>`
  }
  h += `<div class="price-card" style="border-color:rgba(251,191,36,.3)">
    <h4 style="color:var(--gold)">🔸 Total – Fechamento</h4>
    <div class="price-row"><span class="label">Adesão total</span><span class="val closing">${fmt(tAd)}</span></div>
    <div class="price-row"><span class="label">Mensalidade total</span><span class="val closing">${fmt(tMen)}</span></div>
    ${cfg?.unlimitedStrategy ? `<div style="margin-top:8px"><span class="unlimited-badge">♾ Usuários Ilimitados</span></div>` : ''}
  </div>`
  h += `<div class="section-label">Próximos vencimentos</div>`
  h += `<div class="dates-box">${dates.map(d => `<span class="date-chip">${d}</span>`).join('')}</div>`
  h += `<div style="display:flex;flex-direction:column;gap:8px;margin-top:10px">
    <button class="reset-btn" onclick="window.resetConsulta()">🔄 Encerrar e iniciar nova consulta</button>
  </div>`
  return h
}

// ══════════════════════════════════════════
// CSS
// ══════════════════════════════════════════
const CSS = `
  :root {
    --bg:#0a0f1e; --surface:#111827; --surface2:#1a2540; --border:#1e2d4a;
    --accent:#00d4ff; --accent2:#7c3aed; --accent3:#10b981;
    --text:#e2e8f0; --muted:#64748b; --user-bubble:#1e3a5f; --bot-bubble:#131f35;
    --danger:#ef4444; --warning:#f59e0b; --gold:#fbbf24;
    --card-bg:#1a2540; --shadow:0 4px 24px rgba(0,0,0,.4);
  }
  *{box-sizing:border-box;margin:0;padding:0}
  html{font-size:15px}
  body{font-family:'DM Mono',monospace;background:var(--bg);color:var(--text);min-height:100vh;display:flex;flex-direction:column;align-items:center;overflow-x:hidden}
  body::before{content:'';position:fixed;inset:0;background-image:linear-gradient(rgba(0,212,255,.025) 1px,transparent 1px),linear-gradient(90deg,rgba(0,212,255,.025) 1px,transparent 1px);background-size:40px 40px;pointer-events:none;z-index:0}
  .orb{position:fixed;border-radius:50%;filter:blur(120px);pointer-events:none;z-index:0;opacity:.1}
  .orb1{width:500px;height:500px;background:var(--accent);top:-200px;right:-150px}
  .orb2{width:400px;height:400px;background:var(--accent2);bottom:-150px;left:-100px}

  /* ── HEADER ── */
  header{position:relative;z-index:10;width:100%;max-width:820px;padding:18px 20px 0;display:flex;align-items:center;gap:12px;flex-wrap:wrap}
  .header-logo img{height:44px;width:44px;object-fit:contain;border-radius:10px;flex-shrink:0}
  .header-text h1{font-family:'Syne',sans-serif;font-size:17px;font-weight:700;letter-spacing:.5px}
  .header-text p{font-size:11px;color:var(--muted);margin-top:2px;letter-spacing:.5px}

  /* ── NAV BUTTONS ── */
  .header-nav{display:flex;align-items:center;gap:4px;margin-left:auto}
  .nav-btn{display:flex;align-items:center;gap:6px;padding:7px 13px;border-radius:9px;border:1px solid var(--border);background:transparent;color:var(--muted);font-family:'DM Mono',monospace;font-size:12px;font-weight:500;cursor:pointer;transition:all .2s;letter-spacing:.3px;white-space:nowrap}
  .nav-btn:hover{color:var(--accent);border-color:rgba(0,212,255,.35);background:rgba(0,212,255,.06)}
  .nav-btn--active{color:var(--accent);border-color:rgba(0,212,255,.4);background:rgba(0,212,255,.1)}
  .nav-btn svg{flex-shrink:0;opacity:.8}

  .status-dot{display:flex;align-items:center;gap:6px;font-size:11px;color:var(--accent3);letter-spacing:.5px}
  .status-dot::before{content:'';width:7px;height:7px;background:var(--accent3);border-radius:50%;box-shadow:0 0 8px var(--accent3);animation:pulse 2s infinite}
  @keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}
  .header-user{font-size:11px;color:var(--muted);display:flex;align-items:center;gap:6px}
  .header-user span{color:var(--text);font-weight:500}
  .logout-btn{background:none;border:none;cursor:pointer;color:var(--muted);font-size:11px;padding:5px 9px;border-radius:8px;font-family:'DM Mono',monospace;transition:all .2s}
  .logout-btn:hover{color:var(--danger);background:rgba(239,68,68,.08)}

  /* ── CHAT ── */
  .chat-wrap{position:relative;z-index:10;width:100%;max-width:820px;padding:14px 20px 0;flex:1;display:flex;flex-direction:column}
  #messages{display:flex;flex-direction:column;gap:14px;padding-bottom:20px;min-height:400px;max-height:calc(100vh - 230px);overflow-y:auto;scroll-behavior:smooth}
  #messages::-webkit-scrollbar{width:4px}
  #messages::-webkit-scrollbar-thumb{background:var(--border);border-radius:4px}
  .msg{display:flex;flex-direction:column;max-width:92%;animation:fadeUp .3s ease}
  @keyframes fadeUp{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}
  .msg.user{align-self:flex-end;align-items:flex-end}
  .msg.bot{align-self:flex-start;align-items:flex-start}
  .bubble{padding:13px 17px;border-radius:14px;font-size:15px;line-height:1.65;white-space:pre-wrap;word-break:break-word}
  .msg.user .bubble{background:var(--user-bubble);border:1px solid rgba(0,212,255,.15);border-bottom-right-radius:4px}
  .msg.bot .bubble{background:var(--bot-bubble);border:1px solid var(--border);border-bottom-left-radius:4px}
  .msg-label{font-size:11px;color:var(--muted);margin-bottom:4px;letter-spacing:.5px}

  /* ── THINKING ── */
  .thinking{display:flex;gap:5px;padding:14px 18px;background:var(--bot-bubble);border:1px solid var(--border);border-radius:14px;border-bottom-left-radius:4px}
  .thinking span{width:8px;height:8px;background:var(--muted);border-radius:50%;animation:bounce 1.2s infinite}
  .thinking span:nth-child(2){animation-delay:.2s}
  .thinking span:nth-child(3){animation-delay:.4s}
  @keyframes bounce{0%,80%,100%{transform:translateY(0)}40%{transform:translateY(-6px)}}

  /* ── PRICE CARDS ── */
  .price-card{background:var(--card-bg);border:1px solid var(--border);border-radius:12px;padding:15px 18px;margin:4px 0;font-size:15px}
  .price-card h4{font-family:'Syne',sans-serif;font-size:15px;font-weight:700;color:var(--accent);margin-bottom:10px;letter-spacing:.5px;display:flex;align-items:center;gap:6px;flex-wrap:wrap}
  .price-row{display:flex;justify-content:space-between;align-items:center;padding:5px 0;border-bottom:1px solid rgba(128,128,128,.1)}
  .price-row:last-child{border-bottom:none}
  .price-row .label{color:var(--muted);font-size:13px}
  .price-row .val{font-weight:600;color:var(--text);font-size:14px}
  .price-row .val.discount{color:var(--accent3)}
  .price-row .val.closing{color:var(--gold)}
  .section-divider{border:none;border-top:1px dashed var(--border);margin:8px 0}
  .unlimited-badge{background:rgba(0,212,255,.12);color:var(--accent);padding:3px 8px;border-radius:6px;font-size:12px;font-weight:600}
  .plan-badge{background:rgba(124,58,237,.15);color:var(--accent2);padding:2px 7px;border-radius:6px;font-size:11px}

  /* ── CLIENT CARD ── */
  .client-card{background:linear-gradient(135deg,rgba(0,212,255,.08),rgba(0,212,255,.03));border:1px solid rgba(0,212,255,.2);border-radius:12px;padding:14px 16px;margin:4px 0}
  .cl-name{font-family:'Syne',sans-serif;font-size:16px;font-weight:700;color:var(--accent);margin-bottom:8px}
  .client-row{display:flex;gap:8px;font-size:13px;padding:3px 0}
  .cl-label{color:var(--muted);min-width:90px;flex-shrink:0}
  .cl-val{color:var(--text)}

  /* ── TEASER / VOUCHER ── */
  .teaser-card{background:linear-gradient(135deg,rgba(124,58,237,.15),rgba(124,58,237,.05));border:1px solid rgba(124,58,237,.3);border-radius:12px;padding:16px 18px;margin:8px 0}
  .teaser-title{font-family:'Syne',sans-serif;font-size:15px;font-weight:700;color:var(--accent2);margin-bottom:8px}
  .teaser-body{font-size:13px;color:var(--muted);line-height:1.6;margin-bottom:12px}
  .yn-row{display:flex;gap:10px;flex-wrap:wrap}
  .yn-btn{padding:9px 18px;border-radius:10px;border:none;font-family:'DM Mono',monospace;font-size:13px;font-weight:600;cursor:pointer;transition:all .2s}
  .yn-btn.yes{background:linear-gradient(135deg,var(--accent3),#059669);color:#fff}
  .yn-btn.no{background:rgba(100,116,139,.15);border:1px solid var(--border);color:var(--muted)}
  .yn-btn:hover{transform:translateY(-1px);filter:brightness(1.1)}
  .voucher-row{display:flex;gap:8px;margin-top:10px}
  .voucher-input{flex:1;background:var(--surface2);border:1px solid var(--border);border-radius:8px;padding:9px 12px;font-family:'DM Mono',monospace;font-size:13px;color:var(--text);outline:none;letter-spacing:1px;text-transform:uppercase}
  .voucher-input:focus{border-color:var(--accent)}
  .voucher-apply-btn{padding:9px 16px;border-radius:8px;background:var(--accent2);border:none;color:#fff;font-family:'DM Mono',monospace;font-size:13px;font-weight:600;cursor:pointer}
  .voucher-msg.ok{color:var(--accent3);font-size:13px;margin-top:8px}
  .voucher-msg.err{color:var(--danger);font-size:13px;margin-top:8px}

  /* ── OPP BANNER ── */
  .opp-banner{background:linear-gradient(135deg,rgba(251,191,36,.12),rgba(251,191,36,.04));border:1px solid rgba(251,191,36,.3);border-radius:12px;padding:16px 18px;margin:8px 0}
  .opp-title{font-family:'Syne',sans-serif;font-size:15px;font-weight:700;color:var(--gold);margin-bottom:10px}
  .opp-body{font-size:13px;color:var(--muted);line-height:1.7;margin-bottom:12px}

  /* ── DATES ── */
  .section-label{font-size:11px;color:var(--muted);letter-spacing:1px;text-transform:uppercase;margin:12px 0 6px}
  .dates-box{display:flex;gap:8px;flex-wrap:wrap}
  .date-chip{background:var(--surface2);border:1px solid var(--border);border-radius:8px;padding:5px 12px;font-size:13px;color:var(--text)}

  /* ── BOTÕES DE AÇÃO ── */
  .prop-btn{width:100%;padding:12px;border-radius:10px;background:linear-gradient(135deg,rgba(0,212,255,.15),rgba(0,212,255,.05));border:1px solid rgba(0,212,255,.3);color:var(--accent);font-family:'DM Mono',monospace;font-size:13px;font-weight:600;cursor:pointer;transition:all .2s;text-align:left}
  .prop-btn:hover{background:linear-gradient(135deg,rgba(0,212,255,.25),rgba(0,212,255,.1));transform:translateY(-1px)}
  .reset-btn{width:100%;padding:10px;border-radius:10px;background:rgba(100,116,139,.1);border:1px solid var(--border);color:var(--muted);font-family:'DM Mono',monospace;font-size:12px;cursor:pointer;transition:all .2s}
  .reset-btn:hover{color:var(--text);border-color:var(--muted)}

  /* ── TIMER ── */
  .timer-live{text-align:center;font-size:28px;font-weight:700;font-family:'Syne',sans-serif;color:var(--gold);letter-spacing:3px;padding:10px;background:rgba(251,191,36,.08);border:1px solid rgba(251,191,36,.25);border-radius:10px;margin:8px 0}

  /* ── CHIPS ── */
  #chips{display:flex;gap:8px;flex-wrap:wrap;padding:8px 0 4px}
  .chip{background:var(--surface2);border:1px solid var(--border);border-radius:8px;padding:6px 12px;font-family:'DM Mono',monospace;font-size:12px;color:var(--muted);cursor:pointer;transition:all .2s}
  .chip:hover{color:var(--accent);border-color:var(--accent);background:rgba(0,212,255,.08)}

  /* ── INPUT AREA ── */
  #inputArea{display:flex;gap:10px;align-items:flex-end;padding:14px 0 20px}
  #userInput{flex:1;background:var(--surface);border:1px solid var(--border);border-radius:14px;padding:12px 16px;font-family:'DM Mono',monospace;font-size:15px;color:var(--text);outline:none;resize:none;line-height:1.5;transition:border-color .2s;min-height:48px}
  #userInput:focus{border-color:var(--accent);box-shadow:0 0 0 3px rgba(0,212,255,.08)}
  #userInput::placeholder{color:var(--muted)}
  .send-btn{width:48px;height:48px;border-radius:12px;background:linear-gradient(135deg,var(--accent),#0099bb);border:none;color:#fff;cursor:pointer;display:flex;align-items:center;justify-content:center;flex-shrink:0;transition:all .2s}
  .send-btn:hover{box-shadow:0 0 16px rgba(0,212,255,.4);transform:translateY(-1px)}

  /* ── RESPONSIVO ── */
  @media(max-width:600px){
    .header-nav{order:3;width:100%;margin-left:0;margin-top:4px}
    .nav-btn{flex:1;justify-content:center;padding:6px 10px}
  }
`
