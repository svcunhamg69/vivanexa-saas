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
  if(s.length===14)return s.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/,'$1.$2.$3/$4-$5')
  if(s.length===11)return s.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/,'$1.$2.$3-$4')
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
function calcClose(mods,plan,ifPlan,cnpjs,notas,cfg){
  const cp=(cfg.discClosePct||40)/100;const res=[];let tAd=0,tMen=0
  for(const mod of mods){
    if(mod==='IF'){const p=ifPlan||'basic',[aB,mB]=getPrice('IF',p,cfg);res.push({name:pn('IF',cfg),ad:aB*(1-cp),men:mB,isPrepaid:true,plan:p,isIF:true});tAd+=aB*(1-cp);tMen+=mB;continue}
    if(mod==='Tributos'){const m=calcTrib(notas);res.push({name:pn('Tributos',cfg),ad:0,men:m,isTributos:true});tMen+=m;continue}
    if(mod==='EP'){const ep=plan==='topplus'?'top':plan,[,mB]=getPrice('EP',ep,cfg);res.push({name:pn('EP',cfg),ad:0,men:mB,isEP:true,plan:ep});tMen+=mB;continue}
    const[aB]=getPrice(mod,plan,cfg);const ad=aB>0?Math.max(aB*(1-cp),0):0
    let men=0
    if(mod==='BIA')men=0.85*(cnpjs||0);else if(mod==='CND')men=0.40*(cnpjs||0)
    else if(mod==='Gestão Fiscal')men=Math.max(2.00*(cnpjs||0),200);else if(mod==='XML')men=Math.max(1.75*(cnpjs||0),175)
    res.push({name:mod,ad,men,plan});tAd+=ad;tMen+=men
  }
  return{results:res,tAd,tMen}
}

function getNextDates(){
  const now=new Date(),day=now.getDate(),m=now.getMonth()
  if(day<=20){let tm=m+1;if(tm>11)tm=0;return[5,10,15,20,25].map(d=>`${String(d).padStart(2,'0')}/${String(tm+1).padStart(2,'0')}`)}
  let tm=m+2;if(tm>11)tm-=12;return[5,10,15].map(d=>`${String(d).padStart(2,'0')}/${String(tm+1).padStart(2,'0')}`)
}
function parseMods(t,cfg){
  const lo=t.toLowerCase(),found=[]
  const ifN=(pn('IF',cfg)||'').toLowerCase()
  if(/intelig[eê]ncia\s*fiscal|intelig.*fiscal/i.test(lo)||(ifN&&lo.includes(ifN)))found.push('IF')
  const tn=lo.replace(/intelig[eê]ncia\s*fiscal|intelig[\w\s]*fiscal/gi,'')
  if(/gest[aã]o\s*(e\s*an[aá]lise|fiscal)/i.test(tn)||/\bfiscal\b/i.test(tn))found.push('Gestão Fiscal')
  if(/\bbia\b/i.test(lo))found.push('BIA')
  if(/\bcnd\b/i.test(lo))found.push('CND')
  if(/\bxml\b/i.test(lo))found.push('XML')
  if(/tributos/i.test(lo))found.push('Tributos')
  if(/e[\s-]?process[o]?s?|eprocess/i.test(lo))found.push('EP')
  return found
}
function parseIFPlan(t,plans){
  const lo=t.toLowerCase()
  for(const p of plans){if(lo.includes(p.name.toLowerCase())||lo.includes(p.id))return p.id}
  if(/\btop\b/i.test(t))return'top';if(/\bpro\b/i.test(t))return'pro';if(/\bbasic\b/i.test(t))return'basic'
  return null
}
async function fetchCNPJ(cnpj){
  try{
    const r=await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cnpj}`);if(!r.ok)return null
    const d=await r.json();const f=(d.ddd_telefone_1||d.ddd_telefone_2||'').replace(/\D/g,'')
    const end=(d.descricao_tipo_logradouro?d.descricao_tipo_logradouro+' ':'')+(d.logradouro||'')+(d.numero&&d.numero!=='S/N'?' '+d.numero:'')+(d.complemento?' – '+d.complemento:'')
    return{nome:d.razao_social||'',fantasia:d.nome_fantasia||d.razao_social||'',email:d.email||'',
      telefone:f.length>=10?`(${f.slice(0,2)}) ${f.slice(2)}`:'',municipio:d.municipio||'',uf:d.uf||'',
      cep:d.cep?.replace(/\D/g,'')||'',logradouro:end.trim(),bairro:d.bairro||'',cnpj,tipo:'PJ'}
  }catch{return null}
}
async function fetchCEP(cep){
  try{
    const r=await fetch(`https://brasilapi.com.br/api/cep/v1/${cep.replace(/\D/g,'')}`);if(!r.ok)return null
    const d=await r.json()
    return{logradouro:d.street||'',bairro:d.neighborhood||'',municipio:d.city||'',uf:d.state||''}
  }catch{return null}
}

function openPrint(html,title){
  const win=window.open('','_blank','width=900,height=700')
  if(!win){alert('Permita popups.');return}
  win.document.write(`<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"><title>${title}</title>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Syne:wght@700;800&display=swap" rel="stylesheet">
  <style>*{-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important;box-sizing:border-box}body{margin:0;background:#fff}
  .tb{display:flex;gap:10px;padding:14px 20px;background:#f8fafc;border-bottom:1px solid #e2e8f0}
  .tb button{padding:9px 18px;border-radius:8px;cursor:pointer;font-size:13px;font-weight:600;border:none}
  .bp{background:#0f172a;color:#fff}.bc{background:#e2e8f0;color:#475569}
  @media print{.tb{display:none!important}}</style>
  </head><body>
  <div class="tb"><button class="bp" onclick="window.print()">🖨 Imprimir / Salvar PDF</button><button class="bc" onclick="window.close()">✕ Fechar</button></div>
  ${html}</body></html>`)
  win.document.close();win.focus()
}

// ── Build Proposta (com suporte a template) ──────────────────
function buildProposal(S,cfg,user){
  const isC=S.closingToday===true,cd=S.clientData||{},co=S.contactData||{}
  const today=new Date().toLocaleDateString('pt-BR')
  const tAd=isC?S.closingData?.tAd:(S.quoteData?.tAdD||0)
  const tMen=isC?S.closingData?.tMen:(S.quoteData?.tMenD||0)
  const results=isC?S.closingData?.results:S.quoteData?.results
  const rows=(results||[]).map(r=>{
    const adS=(r.isTributos||r.isEP)?'—':fmt(isC?r.ad:r.adD)
    return`<td style="padding:10px 14px"><div style="font-weight:600;color:#0f172a">${r.name}</div>${r.plan?`<div style="font-size:11px;color:#64748b">Plano ${getPlanLabel(r.plan,cfg.plans)}</div>`:''}<\/td><td style="padding:10px 14px;text-align:center">${adS}<\/td><td style="padding:10px 14px;text-align:center">${fmt(isC?r.men:(r.menD||r.men))}<\/td>`
  }).join('')
  const field=(l,v)=>`<div><label style="font-size:10px;color:#64748b;text-transform:uppercase;display:block;margin-bottom:4px">${l}</label><div style="border:1px solid #e2e8f0;border-radius:6px;padding:8px 10px;font-size:13px;color:#1e293b;min-height:34px">${v||'—'}</div></div>`
  const sec=t=>`<div style="font-family:Syne,sans-serif;font-size:14px;font-weight:700;color:#0f172a;margin:0 0 13px;padding-bottom:8px;border-bottom:2px solid #e2e8f0;display:flex;align-items:center;gap:8px"><div style="width:8px;height:8px;background:#00d4ff;border-radius:50%;flex-shrink:0"></div>${t}</div>`

  // Se tiver template personalizado, substituir variáveis
  let template = cfg.propostaTemplate || ''
  if (template) {
    const vars = {
      '{{empresa}}': co.empresa||cd.fantasia||cd.nome||'',
      '{{razao}}': co.razao||cd.nome||'',
      '{{cnpj}}': fmtDoc(S.doc||''),
      '{{contato}}': co.contato||'',
      '{{email}}': co.email||cd.email||'',
      '{{telefone}}': co.telefone||cd.telefone||'',
      '{{cidade}}': co.cidade||cd.municipio||'',
      '{{uf}}': co.uf||cd.uf||'',
      '{{plano}}': S.plan?getPlanLabel(S.plan,cfg.plans):'—',
      '{{cnpjs_qty}}': S.cnpjs||'0',
      '{{total_adesao}}': fmt(tAd),
      '{{total_mensalidade}}': fmt(tMen),
      '{{data_hoje}}': today,
      '{{consultor_nome}}': user?.nome||'',
      '{{company}}': cfg.company||'Vivanexa',
      '{{produtos_tabela}}': `<table style="width:100%;border-collapse:collapse;font-size:13px"><thead><tr style="background:#f8fafc"><th style="padding:10px 14px;text-align:left">Módulo</th><th style="padding:10px 14px;text-align:center">Adesão</th><th style="padding:10px 14px;text-align:center">Mensalidade</th><\/tr><\/thead><tbody>${rows}<\/tbody><\/table>`
    }
    for (const [k, v] of Object.entries(vars)) {
      template = template.replace(new RegExp(k, 'g'), v)
    }
    return `<div style="background:#fff;font-family:Inter,sans-serif;color:#1e293b;max-width:820px;margin:0 auto">${template}</div>`
  }

  // Template padrão
  return`<div style="background:#fff;font-family:Inter,sans-serif;color:#1e293b;max-width:820px;margin:0 auto">
  <div style="background:linear-gradient(135deg,#0f172a,#1e3a5f);padding:32px 44px">
    ${cfg.logob64?`<img src="${cfg.logob64}" style="height:52px;object-fit:contain;margin-bottom:10px;display:block">`:`<div style="font-size:22px;font-weight:900;color:#00d4ff;letter-spacing:2px;margin-bottom:10px">${cfg.company||'Vivanexa'}</div>`}
    <div style="font-size:11px;color:#64748b;letter-spacing:2px;text-transform:uppercase;margin-bottom:18px">Proposta Comercial</div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
      <div><div style="font-size:10px;color:#64748b;text-transform:uppercase;letter-spacing:1px;margin-bottom:3px">Data</div><div style="font-size:13px;color:#e2e8f0;font-weight:500">${today}</div></div>
      <div><div style="font-size:10px;color:#64748b;text-transform:uppercase;letter-spacing:1px;margin-bottom:3px">Validade</div><div style="font-size:13px;color:#e2e8f0;font-weight:500">${isC?'Válida até as 18h de hoje':'Válida por 7 dias'}</div></div>
      <div><div style="font-size:10px;color:#64748b;text-transform:uppercase;letter-spacing:1px;margin-bottom:3px">Plano</div><div style="font-size:13px;color:#e2e8f0;font-weight:500">${S.plan?getPlanLabel(S.plan,cfg.plans):'—'}</div></div>
      <div><div style="font-size:10px;color:#64748b;text-transform:uppercase;letter-spacing:1px;margin-bottom:3px">CNPJs</div><div style="font-size:13px;color:#e2e8f0;font-weight:500">${S.cnpjs||'—'}</div></div>
    </div>
  </div>
  <div style="padding:32px 44px">
    <div style="margin-bottom:26px">${sec('Dados do Cliente')}
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
        ${field('Empresa',co.empresa||cd.fantasia||cd.nome||'')}${field('Razão Social',co.razao||cd.nome||'')}
        ${field('CPF / CNPJ',fmtDoc(S.doc||''))}${field('Contato',co.contato||'')}
        ${field('E-mail',co.email||cd.email||'')}${field('Telefone',co.telefone||cd.telefone||'')}
        ${field('Cidade',co.cidade||cd.municipio||'')}${field('Estado',co.uf||cd.uf||'')}
      </div>
    </div>
    <div style="margin-bottom:26px">${sec('Módulos Contratados')}
      <table style="width:100%;border-collapse:collapse;font-size:13px">
        <thead><tr style="background:#f8fafc"><th style="padding:10px 14px;text-align:left;font-size:10px;text-transform:uppercase;color:#64748b;border-bottom:2px solid #e2e8f0">Módulo</th><th style="padding:10px 14px;text-align:center;font-size:10px;text-transform:uppercase;color:#64748b;border-bottom:2px solid #e2e8f0">Adesão</th><th style="padding:10px 14px;text-align:center;font-size:10px;text-transform:uppercase;color:#64748b;border-bottom:2px solid #e2e8f0">Mensalidade</th><\/tr><\/thead>
        <tbody>${rows}<\/tbody>
      <\/table>
      <div style="background:#f8fafc;border-radius:10px;padding:16px 20px;margin-top:14px">
        <div style="display:flex;justify-content:space-between;padding:5px 0;font-size:13px"><span style="color:#64748b">Total Adesão</span><span style="font-weight:600;color:#0f172a">${fmt(tAd)}</span></div>
        <div style="display:flex;justify-content:space-between;padding:5px 0;font-size:16px"><span style="font-weight:600;color:#0f172a">Total Mensalidade</span><span style="font-weight:700;color:#00d4ff">${fmt(tMen)}</span></div>
      </div>
    </div>
    <div style="margin-bottom:26px">${sec('Condições de Pagamento — Adesão')}
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px">
        <div style="border:2px solid #00d4ff;border-radius:10px;padding:14px;text-align:center"><div style="font-size:22px;margin-bottom:6px">💳</div><div style="font-size:11px;font-weight:700;color:#0f172a;text-transform:uppercase;margin-bottom:6px">Cartão de Crédito</div><div style="font-size:12px;color:#10b981;font-weight:600">em até 10× sem juros</div><div style="font-size:11px;color:#64748b;margin-top:4px">${fmt(tAd/10)} / mês</div></div>
        <div style="border:1px solid #e2e8f0;border-radius:10px;padding:14px;text-align:center"><div style="font-size:22px;margin-bottom:6px">🏦</div><div style="font-size:11px;font-weight:700;color:#0f172a;text-transform:uppercase;margin-bottom:6px">Boleto / PIX</div><div style="font-size:12px;color:#10b981;font-weight:600">${fmt(tAd)}</div><div style="font-size:11px;color:#64748b;margin-top:4px">à vista</div></div>
        <div style="border:1px solid #e2e8f0;border-radius:10px;padding:14px;text-align:center"><div style="font-size:22px;margin-bottom:6px">📄</div><div style="font-size:11px;font-weight:700;color:#0f172a;text-transform:uppercase;margin-bottom:6px">Boleto Parcelado</div><div style="font-size:12px;color:#10b981;font-weight:600">${fmt(tAd*0.5)} entrada</div><div style="font-size:11px;color:#64748b;margin-top:4px">+ ${fmt(tAd*0.25)} em 30/60 dias</div></div>
      </div>
    </div>
    ${sec('Seu Consultor')}
    <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:10px;padding:14px 18px;display:flex;gap:12px">
      <div style="font-size:24px">👤</div>
      <div><div style="font-weight:700;font-size:14px;color:#14532d;margin-bottom:4px">${user?.nome||'—'}</div><div style="font-size:12px;color:#166534">${user?.email?'📧 '+user.email:''}</div></div>
    </div>
  </div>
</div>`
}

// ── Build Contrato com Manifesto de Assinatura (suporte a template, produtos verticais, variáveis corretas) ──
function buildContract(S, cfg, user, tAd, tMen, dateAd, dateMen, payMethod, token) {
  const cd = S.clientData || {}
  const co = S.contactData || {}
  const today = new Date().toLocaleDateString('pt-BR')
  const now = new Date().toLocaleString('pt-BR')
  const isC = S.closingToday === true
  const results = isC ? S.closingData?.results : S.quoteData?.results

  const payLabel =
    payMethod === 'pix'
      ? 'PIX / Boleto à vista'
      : payMethod?.startsWith('cartao')
        ? `Cartão em até ${payMethod.replace('cartao', '').replace('x', '×')} sem juros`
        : payMethod?.startsWith('boleto')
          ? `Boleto ${payMethod.replace('boleto', '').replace('x', '×')}×`
          : payMethod

  // Gera lista vertical de produtos
  const produtosVertical = (results || [])
    .map(r => {
      const adS = r.isTributos || r.isEP ? '—' : fmt(isC ? r.ad : r.adD || 0)
      const menS = fmt(isC ? r.men : r.menD || r.men || 0)
      const planoNome = r.plan ? getPlanLabel(r.plan, cfg.plans) : ''
      return `
      <div style="border:1px solid #e2e8f0;border-radius:8px;padding:12px;margin-bottom:12px">
        <div style="font-weight:600;margin-bottom:6px">${r.name}${planoNome ? `<span style="font-size:11px;color:#64748b;margin-left:6px">(Plano ${planoNome})</span>` : ''}</div>
        <div style="display:flex;justify-content:space-between;font-size:13px;margin-top:6px">
          <span>Adesão:</span><span style="font-weight:600">${adS}</span>
        </div>
        <div style="display:flex;justify-content:space-between;font-size:13px;margin-top:4px">
          <span>Mensalidade:</span><span style="font-weight:600;color:#00d4ff">${menS}</span>
        </div>
        <div style="font-size:11px;color:#64748b;margin-top:6px">CNPJs: ${S.cnpjs || '—'}</div>
      </div>`
    })
    .join('')

  // Funções auxiliares
  const sec = (n, t) =>
    `<h3 style="font-family:Syne,sans-serif;font-size:14px;font-weight:700;color:#0f172a;margin:22px 0 10px;display:flex;align-items:center;gap:8px"><span style="width:8px;height:8px;background:#00d4ff;border-radius:50%;flex-shrink:0;display:inline-block"></span>${n} - ${t}</h3>`

  const row = (l, v) =>
    `<div style="margin-bottom:6px"><span style="font-size:12px;color:#64748b;min-width:120px;display:inline-block">${l}:</span><span style="font-size:13px;color:#1e293b;font-weight:500">${v || '—'}</span></div>`

  const endStr = [co.logradouro || cd.logradouro, co.bairro || cd.bairro, co.cidade || cd.municipio, co.uf || cd.uf]
    .filter(Boolean)
    .join(', ')

  // ── Manifesto de assinatura (preenchido dinamicamente) ──
  const docId = token || generateToken()
  const manifesto = `
  <div style="margin-top:40px;border:2px solid #10b981;border-radius:12px;padding:24px;background:#f0fdf4">
    <div style="display:flex;align-items:center;gap:12px;margin-bottom:20px">
      <div style="font-size:24px">✅</div>
      <div>
        <div style="font-family:Syne,sans-serif;font-size:16px;font-weight:800;color:#065f46">MANIFESTO DE ASSINATURAS ELETRÔNICAS</div>
        <div style="font-size:11px;color:#10b981;font-weight:600;letter-spacing:1px;text-transform:uppercase;margin-top:2px">DOCUMENTO VÁLIDO</div>
      </div>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">
      <div style="border:1px solid #6ee7b7;border-radius:8px;padding:16px;background:#fff">
        <div style="font-size:10px;color:#10b981;letter-spacing:1.5px;text-transform:uppercase;font-weight:700;margin-bottom:10px">✅ ASSINATURA DO CONTRATANTE (CLIENTE)</div>
        <div style="font-size:12px;color:#374151;margin-bottom:4px"><strong>Assinado por:</strong> <span id="manifest-client-name">${co.contato || cd.fantasia || cd.nome || 'Aguardando'}</span></div>
        <div style="font-size:12px;color:#374151;margin-bottom:4px"><strong>CPF:</strong> <span id="manifest-client-cpf">${co.cpfContato || '—'}</span></div>
        <div style="font-size:12px;color:#374151;margin-bottom:4px"><strong>E-mail:</strong> <span id="manifest-client-email">${co.email || cd.email || '—'}</span></div>
        <div style="font-size:12px;color:#374151;margin-bottom:4px"><strong>Data/Hora:</strong> <span id="manifest-client-date">${S.signDoc?.signedAt || 'Aguardando assinatura'}</span></div>
        <div style="font-size:11px;color:#6b7280;margin-top:6px;padding-top:6px;border-top:1px solid #d1fae5"><strong>Token:</strong> ${docId}</div>
      </div>
      <div style="border:1px solid #6ee7b7;border-radius:8px;padding:16px;background:#fff">
        <div style="font-size:10px;color:#10b981;letter-spacing:1.5px;text-transform:uppercase;font-weight:700;margin-bottom:10px">✅ ASSINATURA DA CONTRATADA (CONSULTOR)</div>
        <div style="font-size:12px;color:#374151;margin-bottom:4px"><strong>Assinado por:</strong> <span id="manifest-consult-name">${user?.nome || '—'}</span></div>
        <div style="font-size:12px;color:#374151;margin-bottom:4px"><strong>Data/Hora:</strong> <span id="manifest-consult-date">${S.signDoc?.consultantSignedAt || 'Aguardando assinatura'}</span></div>
        <div style="font-size:12px;color:#374151;margin-bottom:4px"><strong>E-mail:</strong> ${user?.email || '—'}</div>
      </div>
    </div>
    <div style="margin-top:16px;font-size:11px;color:#6b7280;line-height:1.6">
      Assinaturas eletrônicas simples conforme <strong>Lei nº 14.063/2020</strong> e MP 2.200-2/2001.<br>
      Documento: <strong>doc_${docId}</strong> · Verificação: <a href="https://assinatura.iti.gov.br" style="color:#10b981">assinatura.iti.gov.br</a>
    </div>
  </div>`

  // Se tiver template personalizado, substituir variáveis e adicionar manifesto
  let template = cfg.contratoTemplate || ''
  if (template) {
    const vars = {
      '{{empresa}}': co.empresa || cd.fantasia || cd.nome || '',
      '{{razao}}': co.razao || cd.nome || '',
      '{{cnpj}}': fmtDoc(S.doc || ''),
      '{{contato}}': co.contato || '',
      '{{email}}': co.email || cd.email || '',
      '{{telefone}}': co.telefone || cd.telefone || '',
      '{{endereco}}': endStr,
      '{{regime}}': co.regime || '',
      '{{plano}}': S.plan ? getPlanLabel(S.plan, cfg.plans) : '—',
      '{{cnpjs_qty}}': S.cnpjs || '0',
      '{{total_adesao}}': fmt(tAd),
      '{{total_mensalidade}}': fmt(tMen),
      '{{condicao_pagamento}}': payLabel,
      '{{vencimento_adesao}}': dateAd || '—',
      '{{vencimento_mensal}}': dateMen || '—',
      '{{data_hora}}': now,
      '{{data_hoje}}': today,
      '{{consultor_nome}}': user?.nome || '',
      '{{company}}': cfg.company || 'Vivanexa',
      '{{logo}}': cfg.logob64 ? `<img src="${cfg.logob64}" style="height:52px;object-fit:contain;margin-bottom:10px;display:block">` : '',
      '{{produtos_tabela}}': `<div style="margin:16px 0">${produtosVertical}</div>`,
      '{{produtos_lista}}': `<div style="margin:16px 0">${produtosVertical}</div>`,
      '{{nome_financeiro}}': co.rfinNome || '',
      '{{email_financeiro}}': co.rfinEmail || '',
      '{{telefone_financeiro}}': co.rfinTel || '',
      '{{nome_implementacao}}': co.rimpNome || '',
      '{{email_implementacao}}': co.rimpEmail || '',
      '{{telefone_implementacao}}': co.rimpTel || '',
    }
    for (const [k, v] of Object.entries(vars)) {
      template = template.replace(new RegExp(k, 'g'), v)
    }
    // Se o manifesto não estiver no template, adiciona no final
    if (!template.includes('MANIFESTO DE ASSINATURAS')) {
      template += manifesto
    }
    return `<div style="background:#fff;font-family:Inter,sans-serif;color:#1e293b;max-width:820px;margin:0 auto;font-size:13px;line-height:1.7">${template}</div>`
  }

  // Template padrão (usado se nenhum template foi carregado)
  return `
  <div style="background:#fff;font-family:Inter,sans-serif;color:#1e293b;max-width:820px;margin:0 auto;font-size:13px;line-height:1.7">
    <div style="background:linear-gradient(135deg,#0f172a,#1e293b);padding:28px 44px;display:flex;align-items:center;gap:20px">
      ${cfg.logob64 ? `<img src="${cfg.logob64}" style="height:52px;object-fit:contain">` : '<div style="font-size:22px;font-weight:900;color:#00d4ff;letter-spacing:2px;margin-bottom:10px">' + cfg.company + '</div>'}
      <div>
        <h1 style="font-family:Syne,sans-serif;font-size:18px;font-weight:800;color:#fff;margin-bottom:4px">Termo de Pedido e Registro de Software</h1>
        <p style="font-size:12px;color:#64748b">Seja bem-vindo ao ${cfg.company || 'Vivanexa'}, é um prazer tê-lo como cliente.</p>
      </div>
    </div>
    <div style="padding:28px 44px">
      <div style="background:#f0f9ff;border:1px solid #bae6fd;border-radius:10px;padding:16px 20px;margin-bottom:20px;border-left:4px solid #00d4ff">
        <p style="font-size:13px;color:#0c4a6e;margin-bottom:6px">Segue abaixo os termos do pedido registrado com nosso time de vendas.</p>
        <p style="font-size:13px;color:#0c4a6e">Confira os dados com atenção e caso esteja tudo correto, basta <strong>ASSINAR</strong> para darmos seguimento ao treinamento e implantação.</p>
      </div>

      ${sec('1', 'CONTRATADA')}
      <div style="background:#f8fafc;border-radius:8px;padding:14px 18px;margin-bottom:8px">
        ${row('Nome', cfg.company || 'VIVANEXA')}
        ${row('E-mail', cfg.emailEmpresa || 'contato@vivanexa.com.br')}
        ${row('Responsável', user?.nome || '—')}
      </div>

      ${sec('2', 'CONTRATANTE')}
      <div style="background:#f8fafc;border-radius:8px;padding:14px 18px;margin-bottom:8px">
        ${row('Razão Social', co.razao || cd.nome || '')}
        ${row('CNPJ', fmtDoc(S.doc || ''))}
        ${row('Endereço', endStr || '—')}
        ${row('E-mail', co.email || cd.email || '—')}
        ${row('Fone', co.telefone || cd.telefone || '—')}
        ${row('Contratante', co.contato || '—')}
        ${row('CPF', co.cpfContato || '—')}
        ${row('Regime Tributário', co.regime || '—')}
      </div>

      ${sec('3', 'RESPONSÁVEL PELA IMPLEMENTAÇÃO')}
      <div style="background:#f8fafc;border-radius:8px;padding:14px 18px;margin-bottom:8px">
        ${row('Nome', co.rimpNome || '—')}
        ${row('E-mail', co.rimpEmail || '—')}
        ${row('Telefone', co.rimpTel || '—')}
      </div>

      ${sec('4', 'RESPONSÁVEL PELO FINANCEIRO')}
      <div style="background:#f8fafc;border-radius:8px;padding:14px 18px;margin-bottom:8px">
        ${row('Nome', co.rfinNome || '—')}
        ${row('E-mail', co.rfinEmail || '—')}
        ${row('Telefone', co.rfinTel || '—')}
      </div>

      ${sec('5', 'PLANO CONTRATADO E VALORES')}
      ${row('Validade', '12 meses')}
      <div style="margin:16px 0">
        ${produtosVertical}
      </div>
      <div style="background:#f8fafc;border-radius:8px;padding:12px 16px;margin-bottom:16px">
        ${row('Forma de Pagamento', payLabel)}
        ${tAd > 0 ? row('Vencimento Adesão', dateAd || '—') : ''}
        ${row('Vencimento 1ª Mensalidade', dateMen || '—')}
        <div style="display:flex;justify-content:space-between;padding-top:8px;border-top:1px solid #e2e8f0;margin-top:8px">
          <span style="font-weight:600">Total Adesão</span>
          <span style="font-weight:700">${fmt(tAd)}</span>
        </div>
        <div style="display:flex;justify-content:space-between">
          <span style="font-weight:600">Total Mensalidade</span>
          <span style="font-weight:700;color:#00d4ff">${fmt(tMen)}</span>
        </div>
      </div>

      <p style="font-size:12px;color:#475569;margin:8px 0">Nossa equipe entrará em contato <strong>em até 72 horas</strong> após a assinatura. Atendimento: 9h às 18h (Brasília).</p>

      <div style="background:#fefce8;border:1px solid #fde68a;border-radius:8px;padding:12px 16px;margin:16px 0;font-size:12px;color:#78350f">
        Dando o aceite, você concorda com os Termos e Condições de Uso e Política de Privacidade em <strong>www.vivanexa.com.br/termos</strong>.
      </div>

      <div style="border-top:2px solid #e2e8f0;padding-top:24px;margin-top:24px">
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:40px">
          <div style="text-align:center">
            <div style="height:60px;border-bottom:1px solid #0f172a;margin-bottom:8px"></div>
            <div style="font-weight:600;font-size:13px">${cfg.company || 'Vivanexa'}</div>
            <div style="font-size:11px;color:#64748b">CONTRATADA</div>
            <div style="font-size:10px;color:#94a3b8;margin-top:4px">${co.cidade || cd.municipio || ''} · ${today}</div>
          </div>
          <div style="text-align:center">
            <div style="height:60px;border-bottom:1px solid #0f172a;margin-bottom:8px"></div>
            <div style="font-weight:600;font-size:13px">${co.razao || cd.nome || 'Cliente'}</div>
            <div style="font-size:11px;color:#64748b">CONTRATANTE</div>
            <div style="font-size:10px;color:#94a3b8;margin-top:4px">${co.cidade || cd.municipio || ''} · ${today}</div>
          </div>
        </div>
      </div>

      ${manifesto}
    </div>
  </div>`
}

// ══════════════════════════════════════════════════════════════
// COMPONENTE PRINCIPAL
// ══════════════════════════════════════════════════════════════
export default function Chat(){
  const router   = useRouter()
  const msgRef   = useRef(null)
  const [userProfile,   setUserProfile]   = useState(null)
  const [cfg,           setCfg]           = useState(DEFAULT_CFG)
  const cfgRef = useRef(DEFAULT_CFG)
  const [empresaId,     setEmpresaId]     = useState(null)
  const [messages,      setMessages]      = useState([])
  const [input,         setInput]         = useState('')
  const [thinking,      setThinking]      = useState(false)
  const [timerVal,      setTimerVal]      = useState('')
  const [timerDeadline, setTimerDeadline] = useState(null)

  // Módulos chips selecionados
  const [selectedMods,  setSelectedMods]  = useState([])
  const [awaitingMods,  setAwaitingMods]  = useState(false)

  // Painéis overlay
  const [painel,      setPainel]      = useState(null)
  const [histDocs,    setHistDocs]    = useState([])
  const [histLoading, setHistLoading] = useState(false)

  // Modal cliente
  const [showClient, setShowClient] = useState(false)
  const [clientMode, setClientMode] = useState('proposta')
  const emptyForm={empresa:'',razao:'',contato:'',email:'',telefone:'',cep:'',logradouro:'',bairro:'',cidade:'',uf:'',cpfContato:'',regime:'',rimpNome:'',rimpEmail:'',rimpTel:'',rfinNome:'',rfinEmail:'',rfinTel:''}
  const [cf,          setCf]          = useState(emptyForm)
  const [buscandoCep, setBuscandoCep] = useState(false)

  // Wizard contrato
  const [showWiz,  setShowWiz]  = useState(false)
  const [wizStep,  setWizStep]  = useState(1)
  const [wizPay,   setWizPay]   = useState('')
  const [wizAd,    setWizAd]    = useState('')
  const [wizMen,   setWizMen]   = useState('')
  const [wizTAd,   setWizTAd]   = useState(0)
  const [wizTMen,  setWizTMen]  = useState(0)

  // Modal envio assinatura
  const [showSign,       setShowSign]       = useState(false)
  const [signDoc,        setSignDoc]        = useState(null)
  const [signEmailInput, setSignEmailInput] = useState('')

  // Modal formulário assinatura
  const [showSignForm, setShowSignForm] = useState(false)
  const [signFormSide, setSignFormSide] = useState('client')
  const [signFormDoc,  setSignFormDoc]  = useState(null)
  const [sfNome,       setSfNome]       = useState('')
  const [sfCpf,        setSfCpf]        = useState('')
  const [sfEmail,      setSfEmail]      = useState('')
  const [sfAgreed,     setSfAgreed]     = useState(false)
  const [sfSaving,     setSfSaving]     = useState(false)
  const [sfErro,       setSfErro]       = useState('')

  // Ver documento
  const [showDocView,    setShowDocView]    = useState(false)
  const [docViewHtml,    setDocViewHtml]    = useState('')
  const [docViewTitle,   setDocViewTitle]   = useState('')
  const [docViewLoading, setDocViewLoading] = useState(false)

  const S = useRef({
    stage:'await_doc',doc:null,clientData:null,contactData:{},
    users:null,cnpjs:null,modules:[],plan:null,ifPlan:null,notas:null,
    quoteData:null,closingData:null,closingToday:false,
    appliedVoucher:null,awaitingVoucher:false
  }).current

  // ── Auth ──────────────────────────────────────
  useEffect(()=>{
    supabase.auth.getSession().then(async({data:{session}})=>{
      if(!session){router.replace('/');return}
      const{data:profile}=await supabase.from('perfis').select('*').eq('id',session.user.id).single()
      const nome=profile?.nome||session.user.email?.split('@')[0]||'Consultor'
      const up={...session.user,nome,perfil:profile}
      setUserProfile(up)
      const eid=profile?.empresa_id||session.user.id
      setEmpresaId(eid)
      await loadCfg(eid)
    })
    const{data:l}=supabase.auth.onAuthStateChange((_e,s)=>{if(!s)router.replace('/')})
    return()=>l.subscription.unsubscribe()
  },[router])

  useEffect(()=>{
    if(!userProfile)return
    const c=cfgRef.current
    setTimeout(()=>addBot(`Olá, ${userProfile.nome}! 👋\n\nSou o assistente comercial da ${c.company||'Vivanexa'}.\nPara começar, informe o **CPF ou CNPJ** do cliente:`),300)
  },[userProfile])

  // Timer
  useEffect(()=>{
    if(!timerDeadline){setTimerVal('');return}
    const iv=setInterval(()=>{
      const diff=timerDeadline-new Date()
      if(diff<=0){setTimerVal('EXPIRADO');setTimerDeadline(null);clearInterval(iv);return}
      const hh=Math.floor(diff/3600000),mm=Math.floor((diff%3600000)/60000),ss=Math.floor((diff%60000)/1000)
      setTimerVal(`${String(hh).padStart(2,'0')}:${String(mm).padStart(2,'0')}:${String(ss).padStart(2,'0')}`)
    },1000)
    return()=>clearInterval(iv)
  },[timerDeadline])

  useEffect(()=>{if(msgRef.current)msgRef.current.scrollTop=msgRef.current.scrollHeight},[messages,thinking])

  async function loadCfg(eid){
    try{
      const{data:row}=await supabase.from('vx_storage').select('value').eq('key',`cfg:${eid}`).single()
      if(row?.value){
        const saved=JSON.parse(row.value)
        const merged={...DEFAULT_CFG,...saved,plans:saved.plans?.length?saved.plans:DEFAULT_CFG.plans,prices:Object.keys(saved.prices||{}).length?saved.prices:DEFAULT_CFG.prices}
        cfgRef.current=merged
        setCfg(merged)
      }
    }catch{}
  }

  // ── Salvar doc + cliente (com validação de duplicatas) ──────────
  async function saveToHistory(type,clientName,html,extra={}){
    const id='doc_'+Date.now()+'_'+Math.random().toString(36).slice(2,6)
    const token=extra.token||generateToken()
    const entry={id,type,clientName,date:new Date().toLocaleString('pt-BR'),dateISO:new Date().toISOString(),
      status:'draft',signToken:token,signedAt:null,signedBy:null,signCPF:null,signIP:null,
      consultantSignedAt:null,consultantSignedBy:null,
      consultor:userProfile?.nome||'',consultorEmail:userProfile?.email||'',empresaId:empresaId||'',...extra}
    try{await supabase.from('vx_storage').upsert({key:`doc:${token}`,value:JSON.stringify({...entry,html}),updated_at:new Date().toISOString()})}catch(e){console.warn(e)}

    // Salvar cliente com histórico de documentos e evitar duplicatas
    const c=cfgRef.current
    const docSnap=S.doc||''
    if(docSnap){
      const clients=c.clients||[]
      const co=S.contactData||{},cd=S.clientData||{}
      const novoCliente = {
        doc:docSnap,
        nome:co.razao||co.empresa||cd.nome||cd.fantasia||clientName,
        fantasia:co.empresa||cd.fantasia||'',
        email:co.email||cd.email||'',
        telefone:co.telefone||cd.telefone||'',
        cidade:co.cidade||cd.municipio||'',
        uf:co.uf||cd.uf||'',
        ultimoContato:new Date().toISOString(),
        documentos:[{id,type,date:entry.date,status:'draft',token}]
      }
      // Verificar se já existe cliente com mesmo CNPJ/CPF ou e-mail
      const existe = clients.some(cl => cl.doc === docSnap || (cl.email && cl.email === novoCliente.email))
      if(!existe){
        clients.push(novoCliente)
      } else {
        // Atualiza o cliente existente
        const idx = clients.findIndex(cl => cl.doc === docSnap || (cl.email && cl.email === novoCliente.email))
        if(idx !== -1){
          if(!clients[idx].documentos) clients[idx].documentos = []
          clients[idx].documentos.push({id,type,date:entry.date,status:'draft',token})
          clients[idx].ultimoContato = new Date().toISOString()
          clients[idx].nome = novoCliente.nome
          clients[idx].fantasia = novoCliente.fantasia
          clients[idx].email = novoCliente.email
          clients[idx].telefone = novoCliente.telefone
          clients[idx].cidade = novoCliente.cidade
        }
      }
    }

    // Atualiza cfg
    try{
      const{data:cfgRow}=await supabase.from('vx_storage').select('value').eq('key',`cfg:${empresaId}`).single()
      const cfgData=cfgRow?.value?JSON.parse(cfgRow.value):{...c}
      if(!cfgData.docHistory)cfgData.docHistory=[]
      cfgData.docHistory.unshift(entry)
      if(cfgData.docHistory.length>200)cfgData.docHistory=cfgData.docHistory.slice(0,200)
      if(!cfgData.clients)cfgData.clients=[]
      const docSnap2=S.doc||''
      if(docSnap2){
        const co=S.contactData||{},cd=S.clientData||{}
        const novoCliente = {
          doc:docSnap2,
          nome:co.razao||co.empresa||cd.nome||cd.fantasia||clientName,
          fantasia:co.empresa||cd.fantasia||'',
          email:co.email||cd.email||'',
          telefone:co.telefone||cd.telefone||'',
          cidade:co.cidade||cd.municipio||'',
          uf:co.uf||cd.uf||'',
          ultimoContato:new Date().toISOString(),
          documentos:[{id,type,date:entry.date,status:'draft',token}]
        }
        const existe = cfgData.clients.some(cl => cl.doc === docSnap2 || (cl.email && cl.email === novoCliente.email))
        if(!existe){
          cfgData.clients.push(novoCliente)
        } else {
          const idx = cfgData.clients.findIndex(cl => cl.doc === docSnap2 || (cl.email && cl.email === novoCliente.email))
          if(idx !== -1){
            if(!cfgData.clients[idx].documentos) cfgData.clients[idx].documentos = []
            cfgData.clients[idx].documentos.push({id,type,date:entry.date,status:'draft',token})
            cfgData.clients[idx].ultimoContato = new Date().toISOString()
            cfgData.clients[idx].nome = novoCliente.nome
            cfgData.clients[idx].fantasia = novoCliente.fantasia
            cfgData.clients[idx].email = novoCliente.email
            cfgData.clients[idx].telefone = novoCliente.telefone
            cfgData.clients[idx].cidade = novoCliente.cidade
          }
        }
      }
      await supabase.from('vx_storage').upsert({key:`cfg:${empresaId}`,value:JSON.stringify(cfgData),updated_at:new Date().toISOString()})
      cfgRef.current=cfgData;setCfg(cfgData)
    }catch(e){console.warn(e)}
    return{id,token,html,type,clientName,...entry}
  }

  const addBot  =(c,h=false)=>setMessages(p=>[...p,{role:'bot',content:c,isHTML:h,id:Date.now()+Math.random()}])
  const addUser =c           =>setMessages(p=>[...p,{role:'user',content:c,isHTML:false,id:Date.now()+Math.random()}])

  const resetS=()=>{
    Object.assign(S,{stage:'await_doc',doc:null,clientData:null,contactData:{},users:null,cnpjs:null,modules:[],plan:null,ifPlan:null,notas:null,quoteData:null,closingData:null,closingToday:false,appliedVoucher:null,awaitingVoucher:false})
    setTimerDeadline(null);setTimerVal('');setSelectedMods([]);setAwaitingMods(false)
    setMessages([]) // LIMPAR TELA
  }

  async function buscarCep(cep){
    setBuscandoCep(true);const d=await fetchCEP(cep);setBuscandoCep(false)
    if(d)setCf(f=>({...f,logradouro:d.logradouro||f.logradouro,bairro:d.bairro||f.bairro,cidade:d.municipio||f.cidade,uf:d.uf||f.uf}))
  }

  // ── Histórico ─────────────────────────────────
  async function carregarHistorico(){
    setHistLoading(true)
    try{
      const hist=(cfgRef.current.docHistory||[])
      const enriched=await Promise.all(hist.slice(0,50).map(async h=>{
        try{const{data:r}=await supabase.from('vx_storage').select('value').eq('key',`doc:${h.signToken}`).single()
          if(r?.value){const d=JSON.parse(r.value);return{...h,...d,html:d.html}}}catch{}
        return h
      }))
      setHistDocs(enriched)
    }catch{}
    setHistLoading(false)
  }

  async function verDocumento(h){
    setDocViewTitle((h.type==='contrato'?'📝 Contrato':'📄 Proposta')+' — '+h.clientName)
    setDocViewHtml('');setShowDocView(true);setDocViewLoading(true)
    try{
      const{data:r}=await supabase.from('vx_storage').select('value').eq('key',`doc:${h.signToken}`).single()
      if(r?.value){const d=JSON.parse(r.value);setDocViewHtml(d.html||'<p>Sem conteúdo HTML.</p>')}
      else setDocViewHtml('<p style="color:#64748b">Documento não encontrado.</p>')
    }catch{setDocViewHtml('<p style="color:#ef4444">Erro ao carregar.</p>')}
    setDocViewLoading(false)
  }

  function buildSignUrl(doc){
    const base=typeof window!=='undefined'?(cfgRef.current.signConfig?.url||window.location.origin):'https://vivanexa-saas.vercel.app'
    return`${base}/sign/${doc.signToken}`
  }

  function enviarWhatsApp(doc){
    const url=buildSignUrl(doc),tipo=doc.type==='proposta'?'Proposta Comercial':'Contrato'
    const msg=encodeURIComponent(`Olá! Segue o link para assinatura eletrônica do ${tipo} – ${cfgRef.current.company||'Vivanexa'}:\n\n${url}`)
    const wpp=(cfgRef.current.signConfig?.wpp||'').replace(/\D/g,'')
    window.open(wpp?`https://wa.me/${wpp}?text=${msg}`:`https://wa.me/?text=${msg}`,'_blank')
    marcarEnviado(doc)
  }
  function enviarEmail(doc){
    const url=buildSignUrl(doc),tipo=doc.type==='proposta'?'Proposta Comercial':'Contrato'
    const subj=encodeURIComponent(`${tipo} – ${cfgRef.current.company||'Vivanexa'} – Aguardando sua assinatura`)
    const body=encodeURIComponent(`Olá!\n\nLink para assinatura:\n\n${url}\n\n${cfgRef.current.company||'Vivanexa'}`)
    window.open(`mailto:${signEmailInput||doc.clientEmail||''}?subject=${subj}&body=${body}`,'_blank')
    marcarEnviado(doc)
  }
  async function marcarEnviado(doc){
    try{const{data:r}=await supabase.from('vx_storage').select('value').eq('key',`doc:${doc.signToken}`).single()
      if(r?.value){const d=JSON.parse(r.value);if(d.status==='draft')d.status='sent';await supabase.from('vx_storage').upsert({key:`doc:${doc.signToken}`,value:JSON.stringify(d),updated_at:new Date().toISOString()})}}catch{}
  }

  function abrirSignForm(doc,side){
    setSignFormDoc(doc);setSignFormSide(side)
    if(side==='consultant'){setSfNome(userProfile?.nome||'');setSfCpf('');setSfEmail(userProfile?.email||'')}
    else{setSfNome(doc.clientName||'');setSfCpf('');setSfEmail(doc.clientEmail||'')}
    setSfAgreed(false);setSfErro('');setShowSignForm(true)
  }

  async function confirmarSignForm(){
    if(!sfNome.trim()){setSfErro('Informe o nome.');return}
    if(!sfCpf.trim()){setSfErro('Informe o CPF.');return}
    if(!sfEmail.trim()){setSfErro('Informe o e-mail.');return}
    if(!sfAgreed){setSfErro('Aceite os termos.');return}
    setSfSaving(true);setSfErro('')
    try{
      const now=new Date(),nowStr=now.toLocaleString('pt-BR')
      const{data:r}=await supabase.from('vx_storage').select('value').eq('key',`doc:${signFormDoc.signToken}`).single()
      const docData=r?.value?JSON.parse(r.value):{...signFormDoc}
      if(signFormSide==='consultant'){
        docData.consultantSignedAt=nowStr;docData.consultantSignedBy=sfNome.trim()
        docData.consultantCPF=sfCpf.trim();docData.consultantEmail=sfEmail.trim()
      }else{
        docData.signedAt=nowStr;docData.signedBy=sfNome.trim()
        docData.signCPF=sfCpf.trim();docData.signEmail=sfEmail.trim()
        docData.signIP='(web)';docData.clientEmail=sfEmail.trim()
      }
      const bothSigned=!!(docData.signedAt&&docData.consultantSignedAt)
      docData.status=bothSigned?'signed':docData.signedAt?'pending':'sent'
      await supabase.from('vx_storage').upsert({key:`doc:${signFormDoc.signToken}`,value:JSON.stringify(docData),updated_at:now.toISOString()})

      const{data:cfgRow}=await supabase.from('vx_storage').select('value').eq('key',`cfg:${empresaId}`).single()
      if(cfgRow?.value){
        const c=JSON.parse(cfgRow.value)
        if(c.docHistory){c.docHistory=c.docHistory.map(h=>h.signToken===signFormDoc.signToken?{...h,...docData,html:undefined}:h)}
        await supabase.from('vx_storage').upsert({key:`cfg:${empresaId}`,value:JSON.stringify(c),updated_at:now.toISOString()})
        cfgRef.current=c;setCfg(c)
      }
      setShowSignForm(false)
      if(painel==='assinaturas'||painel==='historico')await carregarHistorico()
      if(bothSigned){
        const tipo=docData.type==='proposta'?'Proposta Comercial':'Contrato'
        const url=buildSignUrl(docData)
        const clientE=docData.clientEmail||docData.signEmail||''
        const consultorE=docData.consultorEmail||docData.consultantEmail||userProfile?.email||''
        const dest=[clientE,consultorE].filter(Boolean).join(',')
        if(dest&&confirm(`✅ Contrato totalmente assinado!\n\nDeseja enviar uma cópia para:\nCliente: ${clientE}\nConsultor: ${consultorE}\n\nClique OK para abrir o e-mail.`)){
          const subj=encodeURIComponent(`✅ ${tipo} – ${cfgRef.current.company||'Vivanexa'} – Assinado`)
          const body=encodeURIComponent(`${tipo} assinado por ambas as partes.\n\nCliente: ${docData.signedBy} (${docData.signedAt})\nConsultor: ${docData.consultantSignedBy} (${docData.consultantSignedAt})\n\nAcesse: ${url}`)
          window.open(`mailto:${dest}?subject=${subj}&body=${body}`,'_blank')
        }
      }else{
        addBot(signFormSide==='consultant'?`✅ Assinatura do consultor registrada!`:`✅ Assinatura do cliente registrada!`)
      }
    }catch(e){console.error(e);setSfErro('Erro ao salvar. Tente novamente.')}
    finally{setSfSaving(false)}
  }

  // ── Lógica chat ───────────────────────────────
  async function processInput(t){
    const c=cfgRef.current
    const lo=t.toLowerCase()
    if(S.stage==='closed')return null
    if(['valeu','obrigado','obrigada','tchau'].some(w=>lo.includes(w))&&S.stage!=='await_doc'){S.stage='closed';return{h:false,c:'Perfeito! Boas vendas! 🚀'}}

    if(S.awaitingVoucher){
      if(lo.includes('sem voucher')||lo.includes('pular')){S.awaitingVoucher=false;S.quoteData=calcFull(S.modules,S.plan,S.ifPlan,S.cnpjs,S.notas,c);S.stage='full_quoted';return{h:true,c:rFull(S.quoteData)}}
      const code=t.trim().toUpperCase()
      const voucher=(c.vouchers||[]).find(v=>v.codigo===code&&v.ativo!==false)
      if(!voucher)return{h:false,c:`❌ Voucher **${code}** não encontrado.\n\n"sem voucher" para ver preço cheio:`}
      S.appliedVoucher=voucher;S.awaitingVoucher=false;S.stage='discounted'
      const discData=calcDisc(S.modules,S.plan,S.ifPlan,S.cnpjs,S.notas,c,{discAdPct:voucher.pctAdesao,discMenPct:voucher.pctMensalidade})
      S.quoteData=discData
      const cn=S.clientData?.fantasia||S.clientData?.nome||fmtDoc(S.doc||'')
      addUser(t);addBot(`✅ Voucher **${voucher.codigo}** aplicado!`)
      setTimeout(()=>addBot(rDisc(discData,getNextDates(),cn),true),300);return null
    }

    if(S.stage==='await_doc'){
      const doc=clean(t);if(!isCNPJ(doc)&&!isCPF(doc))return{h:false,c:'Por favor, informe o CPF ou CNPJ (somente números).'}
      S.doc=doc
      // Verificar se cliente já existe
      const existing=(c.clients||[]).find(cl=>cl.doc===doc)
      if(isCNPJ(doc)){setThinking(true);const cd=await fetchCNPJ(doc);setThinking(false)
        if(cd){S.clientData=cd;S.stage='await_users'
          const hist=existing?.documentos?.length?`\n\n📋 **${existing.documentos.length} documento(s)** gerado(s) anteriormente para este cliente.`:'';
          return{h:true,c:rClientCard(cd)+`<div style="margin-top:10px;font-size:14px;color:var(--muted)">✅ Empresa encontrada!${hist}<br><br>Quantos <strong style="color:var(--text)">usuários</strong> o cliente possui?</div>`}}
      }
      S.clientData={nome:isCPF(doc)?'Cliente PF':'Empresa',fantasia:'',cnpj:doc,tipo:isCPF(doc)?'PF':'PJ'}
      const hist=existing?.documentos?.length?`\n\n📋 **${existing.documentos.length} documento(s)** anteriores para este cliente.`:''
      S.stage='await_users'
      return{h:false,c:(isCNPJ(doc)?`⚠️ CNPJ ${fmtDoc(doc)} não localizado.\n`:'')+`Quantos usuários o cliente possui?${hist}`}
    }
    if(S.stage==='await_users'){const u=parseInt(t.match(/\d+/)?.[0]);if(!u||u<1)return{h:false,c:'Quantos usuários? (número)'};S.users=u;S.stage='await_modules'
      if(c.modChips!==false){setAwaitingMods(true);return{h:false,c:`👥 ${u} usuário${u>1?'s':''}!\n\nSelecione os **módulos** desejados e clique em Confirmar:`}}
      return{h:false,c:`👥 ${u} usuário${u>1?'s':''}!\n\nQuais módulos?\n(Gestão Fiscal · BIA · CND · XML · IF · EP · Tributos)`}}
    if(S.stage==='await_if_plan'){const p=parseIFPlan(t,c.plans);if(!p)return{h:false,c:`Informe o plano IF:\n(${c.plans.map(x=>x.name).join(', ')})`};S.ifPlan=p;S.stage='await_modules';return checkCalc()}
    if(S.stage==='await_notas'){const n=parseInt(t);if(!n||n<1)return{h:false,c:'Quantas notas fiscais por mês?'};S.notas=n;S.stage='await_modules';return checkCalc()}

    const mods=parseMods(t,c);for(const m of mods)if(!S.modules.includes(m))S.modules.push(m)
    const nCNPJ=S.modules.some(m=>!IF_NO_CNPJ.includes(m))
    if(nCNPJ){const n=parseInt(t.match(/\b(\d+)\s*(cnpj[s]?)?\b/i)?.[1]);if(n&&!S.cnpjs)S.cnpjs=n}
    return checkCalc()
  }

  function checkCalc(){
    const c=cfgRef.current
    if(S.modules.length===0)return{h:false,c:`Quais módulos? (Gestão Fiscal · BIA · CND · XML · IF · EP · Tributos)`}
    if(S.modules.includes('EP')&&!S.modules.includes('Gestão Fiscal')){S.modules=S.modules.filter(m=>m!=='EP');return{h:false,c:`⚠️ EP exige Gestão Fiscal.`}}
    if(S.modules.includes('IF')&&!S.ifPlan){S.stage='await_if_plan';return{h:false,c:`Qual o plano de IF?\n(${c.plans.map(p=>p.name).join(', ')})`}}
    if(S.modules.includes('Tributos')&&!S.notas){S.stage='await_notas';return{h:false,c:'Quantas notas fiscais por mês?'}}
    const nCNPJ=S.modules.some(m=>!IF_NO_CNPJ.includes(m))
    if(nCNPJ&&!S.cnpjs)return{h:false,c:'Quantos CNPJs o cliente possui?'}
    S.plan=nCNPJ?getPlan(S.cnpjs,c.plans):'basic'
    if(c.discMode==='voucher'&&!S.appliedVoucher&&!S.awaitingVoucher){S.awaitingVoucher=true;return{h:false,c:`🎫 Modo voucher ativo.\n\nDigite o **código do voucher**:\n(ou "sem voucher" para ver preço cheio)`}}
    S.quoteData=calcFull(S.modules,S.plan,S.ifPlan,S.cnpjs,S.notas,c);S.stage='full_quoted'
    return{h:true,c:rFull(S.quoteData)}
  }

  // ── Confirmar módulos via chips ───────────────
  function confirmarMods(){
    if(selectedMods.length===0){addBot('Selecione pelo menos um módulo.');return}
    setAwaitingMods(false)
    S.modules=[...selectedMods]
    setSelectedMods([])
    addUser(selectedMods.join(' + '))
    const res=checkCalc()
    if(res){
      if(res.h)addBot(res.c,true); else addBot(res.c)
    }
  }

  async function send(text){
    const txt=(text||input).trim();if(!txt)return
    if(awaitingMods){
      // Input de texto na área de módulos (ex: cnpjs)
      setInput('')
      addUser(txt)
      setThinking(true)
      const resp=await processInput(txt)
      setThinking(false)
      if(resp)addBot(resp.c,resp.h)
      return
    }
    setInput('');addUser(txt)
    setThinking(true);const resp=await processInput(txt);setThinking(false)
    if(resp)addBot(resp.c,resp.h)
  }

  useEffect(()=>{
    const dates=getNextDates()
    window.vx_disc=(yes)=>{
      const c=cfgRef.current
      const cn=S.clientData?.fantasia||S.clientData?.nome||fmtDoc(S.doc||'')
      if(yes){S.stage='discounted';S.quoteData=calcDisc(S.modules,S.plan,S.ifPlan,S.cnpjs,S.notas,c,null);addUser('✅ Sim!');addBot(rDisc(S.quoteData,dates,cn),true)}
      else{S.stage='closed';addUser('Não, obrigado');addBot('Sem problemas!');setTimeout(()=>addBot(`<button class="reset-btn" onclick="window.vx_reset()">🔄 Iniciar nova consulta</button>`,true),400)}
    }
    window.vx_close=(yes)=>{
      const c=cfgRef.current
      if(yes){const d=calcClose(S.modules,S.plan,S.ifPlan,S.cnpjs,S.notas,c);S.closingData=d;S.closingToday=true;S.stage='closing'
        const h=c.closingHour||18;const dl=new Date();dl.setHours(h,0,0,0);setTimerDeadline(dl)
        addUser('✅ Fechar hoje!');addBot(rClose(d),true)}
      else{S.stage='discounted';addUser('Não por agora');addBot('Entendido!');setTimeout(()=>addBot(`<button class="reset-btn" onclick="window.vx_reset()">🔄 Iniciar nova consulta</button>`,true),400)}
    }
    window.vx_reset=()=>{
      resetS()
      const c=cfgRef.current
      setTimeout(()=>addBot(`🔄 Nova consulta!\n\nInforme o CPF ou CNPJ do próximo cliente:`),100)
    }
    window.vx_prop=()=>{
      const cd=S.clientData||{},co=S.contactData||{}
      setCf({...emptyForm,empresa:co.empresa||cd.fantasia||cd.nome||'',razao:co.razao||cd.nome||'',email:co.email||cd.email||'',telefone:co.telefone||cd.telefone||'',cidade:co.cidade||cd.municipio||'',uf:co.uf||cd.uf||'',logradouro:co.logradouro||cd.logradouro||'',bairro:co.bairro||cd.bairro||'',cep:co.cep||cd.cep||'',contato:co.contato||''})
      setClientMode('proposta');setShowClient(true)
    }
    window.vx_cont=()=>{
      const cd=S.clientData||{},co=S.contactData||{}
      setCf({...emptyForm,empresa:co.empresa||cd.fantasia||cd.nome||'',razao:co.razao||cd.nome||'',email:co.email||cd.email||'',telefone:co.telefone||cd.telefone||'',cidade:co.cidade||cd.municipio||'',uf:co.uf||cd.uf||'',logradouro:co.logradouro||cd.logradouro||'',bairro:co.bairro||cd.bairro||'',cep:co.cep||cd.cep||'',contato:co.contato||''})
      setClientMode('contrato');setShowClient(true)
    }
  },[cfg])

  async function saveClient(){
    S.contactData={...cf};setShowClient(false)
    const clientName=cf.razao||cf.empresa||fmtDoc(S.doc||'')||'Cliente'
    if(clientMode==='proposta'){
      const html=buildProposal(S,cfgRef.current,userProfile)
      openPrint(html,'Proposta Comercial')
      const doc=await saveToHistory('proposta',clientName,html,{tAd:S.quoteData?.tAdD||0,tMen:S.quoteData?.tMenD||0,clientEmail:cf.email,modulos:S.modules})
      setSignDoc(doc);setSignEmailInput(cf.email||'')
      setTimeout(()=>setShowSign(true),600)
    }else{
      const isC=S.closingToday===true
      const tAd=isC?S.closingData?.tAd:(S.quoteData?.tAdD||0)
      const tMen=isC?S.closingData?.tMen:(S.quoteData?.tMenD||0)
      setWizTAd(tAd);setWizTMen(tMen);setWizStep(1);setWizPay('');setWizAd('');setWizMen('');setShowWiz(true)
    }
  }

  function wizNext(){
    if(wizStep===1){if(!wizPay){alert('Selecione a condição de pagamento.');return};setWizStep(2)}
    else{
      if(wizTAd>0&&!wizAd){alert('Selecione a data de vencimento da adesão.');return}
      if(!wizMen){alert('Selecione a data da 1ª mensalidade.');return}
      setShowWiz(false)
      const token=generateToken()
      const html=buildContract(S,cfgRef.current,userProfile,wizTAd,wizTMen,wizAd,wizMen,wizPay,token)
      openPrint(html,'Contrato')
      const clientName=cf.razao||cf.empresa||fmtDoc(S.doc||'')||'Cliente'
      saveToHistory('contrato',clientName,html,{tAd:wizTAd,tMen:wizTMen,clientEmail:cf.email,modulos:S.modules,pagamento:wizPay,vencAdesao:wizAd,vencMensal:wizMen,token}).then(doc=>{
        setSignDoc(doc);setSignEmailInput(cf.email||'')
        setTimeout(()=>setShowSign(true),600)
      })
    }
  }

  const wizDates=getNextDates()

  // ── Render helpers ────────────────────────────
  function rClientCard(cd){
    const end=[cd.logradouro,cd.bairro,cd.municipio&&cd.uf?cd.municipio+' – '+cd.uf:cd.municipio||cd.uf].filter(Boolean).join(', ')
    const cep=cd.cep?cd.cep.replace(/^(\d{5})(\d{3})$/,'$1-$2'):''
    return`<div class="client-card"><div class="cl-name">${cd.fantasia||cd.nome||fmtDoc(cd.cnpj)}</div>
      ${cd.nome&&cd.fantasia?`<div class="client-row"><span class="cl-label">Razão Social</span><span class="cl-val">${cd.nome}</span></div>`:''}
      ${cd.cnpj?`<div class="client-row"><span class="cl-label">CNPJ</span><span class="cl-val">${fmtDoc(cd.cnpj)}</span></div>`:''}
      ${end?`<div class="client-row"><span class="cl-label">Endereço</span><span class="cl-val">${end}</span></div>`:''}
      ${cep?`<div class="client-row"><span class="cl-label">CEP</span><span class="cl-val">${cep}</span></div>`:''}
      ${cd.telefone?`<div class="client-row"><span class="cl-label">Telefone</span><span class="cl-val">${cd.telefone}</span></div>`:''}
      ${cd.email?`<div class="client-row"><span class="cl-label">E-mail</span><span class="cl-val">${cd.email}</span></div>`:''}
    </div>`
  }
  function rFull(data){
    const{results,tAd,tMen}=data;let h=''
    for(const r of results){h+=`<div class="price-card"><h4>🔹 ${r.name}${r.isPrepaid?' <small style="font-size:11px;color:var(--warning)">(pré-pago)</small>':''}</h4>${!r.isTributos&&!r.isEP?`<div class="price-row"><span class="label">Adesão</span><span class="val">${fmt(r.ad)}</span></div>`:''}<div class="price-row"><span class="label">Mensalidade</span><span class="val">${fmt(r.men)}</span></div></div>`}
    h+=`<div class="price-card" style="border-color:rgba(0,212,255,.25)"><h4>🔸 Total</h4><div class="price-row"><span class="label">Adesão total</span><span class="val">${fmt(tAd)}</span></div><div class="price-row"><span class="label">Mensalidade total</span><span class="val">${fmt(tMen)}</span></div></div>`
    h+=`<div class="teaser-card"><div class="teaser-title">🎫 Licenças com desconto disponíveis!</div><div class="teaser-body">Deseja ver os valores com desconto?</div><div class="yn-row"><button class="yn-btn yes" onclick="window.vx_disc(true)">✅ Sim!</button><button class="yn-btn no" onclick="window.vx_disc(false)">Não, obrigado</button></div></div>`
    h+=`<div class="section-label">Próximos vencimentos</div><div class="dates-box">${getNextDates().map(d=>`<span class="date-chip">${d}</span>`).join('')}</div>`
    return h
  }
  function rDisc(data,dates,cn){
    const c=cfgRef.current
    const{results,tAd,tMen,tAdD,tMenD}=data;let h=''
    for(const r of results){h+=`<div class="price-card"><h4>🔹 ${r.name}</h4>${!r.isTributos&&!r.isEP?`<div class="price-row"><span class="label">Adesão</span><span class="val">${fmt(r.ad)}</span></div>`:''}<div class="price-row"><span class="label">Mensalidade</span><span class="val">${fmt(r.men)}</span></div><hr class="section-divider">${!r.isTributos&&!r.isEP?`<div class="price-row"><span class="label">Adesão c/ desc.</span><span class="val discount">${fmt(r.adD)}</span></div>`:''}<div class="price-row"><span class="label">Mensalidade c/ desc.</span><span class="val discount">${fmt(r.menD)}</span></div></div>`}
    h+=`<div class="price-card" style="border-color:rgba(0,212,255,.25)"><h4>🔸 Total</h4><div class="price-row"><span class="label">Adesão</span><span class="val">${fmt(tAd)}</span></div><div class="price-row"><span class="label">Mensalidade</span><span class="val">${fmt(tMen)}</span></div><hr class="section-divider"><div class="price-row"><span class="label">Adesão c/ desc.</span><span class="val discount">${fmt(tAdD)}</span></div><div class="price-row"><span class="label">Mensalidade c/ desc.</span><span class="val discount">${fmt(tMenD)}</span></div>${c.unlimitedStrategy?`<div style="margin-top:8px"><span class="unlimited-badge">♾ Usuários Ilimitados</span></div>`:''}</div>`
    const h2=c.closingHour||18
    const textoExtra=c.closingText?`<div style="font-size:13px;color:var(--muted);margin-top:6px;font-style:italic">${c.closingText}</div>`:''
    h+=`<div class="opp-banner"><div class="opp-title">🔥 Oportunidade de Negociação</div><div class="opp-body"><strong style="color:var(--gold)">${cn}</strong> pode fechar com <strong style="color:var(--gold)">${c.discClosePct||40}% OFF</strong> na adesão!<br>Oferta válida até as <strong style="color:var(--gold)">${h2}h de hoje</strong>.</div>${textoExtra}<div class="yn-row" style="margin-top:12px"><button class="yn-btn yes" onclick="window.vx_close(true)">✅ Fechar hoje!</button><button class="yn-btn no" onclick="window.vx_close(false)">Não por agora</button></div></div>`
    h+=`<div class="section-label">Próximos vencimentos</div><div class="dates-box">${dates.map(d=>`<span class="date-chip">${d}</span>`).join('')}</div>`
    return h
  }
  function rClose(data){
    const c=cfgRef.current
    const{results,tAd,tMen}=data;let h=''
    // Timer com texto configurável
    const h2=c.closingHour||18
    const textoTimer=c.closingText||`Oferta válida até as ${h2}h de hoje`
    h+=`<div class="timer-block"><div class="timer-label">⏱ ${textoTimer}</div><div id="vx-timer" class="timer-live">--:--:--</div><div class="timer-sub">Após este horário retornam os valores com desconto padrão</div></div>`
    for(const r of results){h+=`<div class="price-card"><h4>🔹 ${r.name}</h4>${!r.isTributos&&!r.isEP?`<div class="price-row"><span class="label">Adesão (fechamento)</span><span class="val closing">${fmt(r.ad)}</span></div>`:''}<div class="price-row"><span class="label">Mensalidade</span><span class="val closing">${fmt(r.men)}</span></div></div>`}
    h+=`<div class="price-card" style="border-color:rgba(251,191,36,.3)"><h4 style="color:var(--gold)">🔸 Total – Fechamento</h4><div class="price-row"><span class="label">Adesão total</span><span class="val closing">${fmt(tAd)}</span></div><div class="price-row"><span class="label">Mensalidade total</span><span class="val closing">${fmt(tMen)}</span></div>${c.unlimitedStrategy?`<div style="margin-top:8px"><span class="unlimited-badge">♾ Usuários Ilimitados</span></div>`:''}</div>`
    h+=`<div style="display:flex;flex-direction:column;gap:8px;margin-top:10px">
      <button class="prop-btn" onclick="window.vx_prop()">📄 Gerar Proposta Comercial</button>
      <button class="prop-btn" style="background:linear-gradient(135deg,rgba(251,191,36,.2),rgba(251,191,36,.08));border-color:rgba(251,191,36,.4);color:var(--gold)" onclick="window.vx_cont()">📝 Gerar Contrato</button>
      <button class="reset-btn" onclick="window.vx_reset()">🔄 Encerrar e iniciar nova consulta</button>
    </div>`
    return h
  }

  function statusBadge(h){
    if(h.status==='signed')  return{txt:'✅ Assinado',       cor:'var(--accent3)',bg:'rgba(16,185,129,.12)', border:'rgba(16,185,129,.25)'}
    if(h.status==='pending') return{txt:'⏳ Aguardando',     cor:'var(--warning)', bg:'rgba(251,191,36,.1)',  border:'rgba(251,191,36,.25)'}
    if(h.status==='sent')    return{txt:'📤 Enviado',         cor:'var(--accent)',  bg:'rgba(0,212,255,.1)',   border:'rgba(0,212,255,.25)'}
    return                         {txt:'📝 Rascunho',        cor:'var(--muted)',   bg:'rgba(100,116,139,.1)',border:'rgba(100,116,139,.2)'}
  }

  function abrirPainel(p){setPainel(p);if(p==='historico'||p==='assinaturas')carregarHistorico()}

  if(!userProfile)return<div style={{background:'#0a0f1e',minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center',color:'#64748b',fontFamily:'DM Mono,monospace'}}>Carregando...</div>

  // ── Painel overlay ────────────────────────────
  const renderPainel=()=>{
    if(!painel)return null
    return(
      <div style={{position:'fixed',inset:0,background:'var(--bg)',zIndex:200,display:'flex',flexDirection:'column',overflow:'hidden'}}>
        <div style={{background:'rgba(10,15,30,.9)',backdropFilter:'blur(12px)',borderBottom:'1px solid var(--border)',padding:'12px 20px',display:'flex',alignItems:'center',gap:12,flexShrink:0}}>
          <button onClick={()=>setPainel(null)} style={{background:'none',border:'none',color:'var(--muted)',cursor:'pointer',fontSize:20,padding:'4px 8px',borderRadius:8}}>✕</button>
          <h2 style={{fontFamily:'Syne,sans-serif',fontSize:16,fontWeight:700,color:'var(--accent)'}}>
            {painel==='historico'?'🗂️ Histórico':painel==='assinaturas'?'✍️ Assinaturas':'📄 Documentos'}
          </h2>
          {(painel==='historico'||painel==='assinaturas')&&<button onClick={carregarHistorico} style={{marginLeft:'auto',padding:'6px 14px',borderRadius:8,background:'rgba(0,212,255,.1)',border:'1px solid rgba(0,212,255,.25)',color:'var(--accent)',fontFamily:'DM Mono,monospace',fontSize:12,cursor:'pointer'}}>🔄 Atualizar</button>}
        </div>
        <div style={{flex:1,overflowY:'auto',padding:'20px',maxWidth:900,width:'100%',margin:'0 auto'}}>
          {painel==='historico'&&(histLoading?<div style={{textAlign:'center',padding:40,color:'var(--muted)'}}>Carregando...</div>
            :histDocs.length===0?<div style={{textAlign:'center',padding:40}}><div style={{fontSize:40,marginBottom:12}}>📄</div><div style={{color:'var(--muted)',fontSize:14}}>Nenhum documento gerado ainda.</div></div>
            :histDocs.map(h=>{
              const sb=statusBadge(h)
              return(
                <div key={h.id} style={{background:'var(--surface)',border:'1px solid var(--border)',borderRadius:14,padding:'16px 20px',marginBottom:12,boxShadow:'var(--shadow)'}}>
                  <div style={{display:'flex',alignItems:'flex-start',gap:12,marginBottom:10}}>
                    <span style={{fontSize:22,flexShrink:0}}>{h.type==='contrato'?'📝':'📄'}</span>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{fontWeight:700,fontSize:15,color:'var(--text)',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{h.clientName||'Cliente'}</div>
                      <div style={{fontSize:12,color:'var(--muted)',marginTop:2}}>{h.type==='contrato'?'Contrato':'Proposta'} · {h.date} · {h.consultor}{h.modulos?.length>0?` · ${h.modulos.join(', ')}`:''}
                      </div>
                      {h.signedBy&&<div style={{fontSize:11,color:'var(--accent3)',marginTop:2}}>✅ Cliente: {h.signedBy} em {h.signedAt}</div>}
                      {h.consultantSignedBy&&<div style={{fontSize:11,color:'var(--accent3)',marginTop:1}}>✅ Consultor: {h.consultantSignedBy} em {h.consultantSignedAt}</div>}
                    </div>
                    <span style={{fontSize:12,fontWeight:600,color:sb.cor,background:sb.bg,border:`1px solid ${sb.border}`,padding:'4px 10px',borderRadius:20,whiteSpace:'nowrap',flexShrink:0}}>{sb.txt}</span>
                  </div>
                  <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
                    <button onClick={()=>verDocumento(h)} style={{padding:'7px 14px',borderRadius:8,background:'rgba(0,212,255,.1)',border:'1px solid rgba(0,212,255,.25)',color:'var(--accent)',cursor:'pointer',fontFamily:'DM Mono,monospace',fontSize:12,fontWeight:600}}>👁 Ver documento</button>
                    {h.status!=='signed'&&<button onClick={()=>{setSignDoc(h);setSignEmailInput(h.clientEmail||'');setShowSign(true);setPainel(null)}} style={{padding:'7px 14px',borderRadius:8,background:'rgba(251,191,36,.1)',border:'1px solid rgba(251,191,36,.3)',color:'var(--gold)',cursor:'pointer',fontFamily:'DM Mono,monospace',fontSize:12,fontWeight:600}}>✍️ Reenviar para assinatura</button>}
                  </div>
                </div>
              )})
          )}

          {painel==='assinaturas'&&(histLoading?<div style={{textAlign:'center',padding:40,color:'var(--muted)'}}>Carregando...</div>
            :histDocs.length===0?<div style={{textAlign:'center',padding:40}}><div style={{fontSize:40,marginBottom:12}}>✍️</div><div style={{color:'var(--muted)',fontSize:14}}>Nenhum documento.</div></div>
            :histDocs.map(h=>{
              const clienteAssinou=!!(h.signedAt&&h.signedBy),consultorAssinou=!!(h.consultantSignedAt&&h.consultantSignedBy)
              const total=clienteAssinou&&consultorAssinou
              return(
                <div key={h.id} style={{background:'var(--surface)',border:`1px solid ${total?'rgba(16,185,129,.3)':'var(--border)'}`,borderRadius:14,padding:'18px 20px',marginBottom:14,boxShadow:'var(--shadow)'}}>
                  <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:14}}>
                    <span style={{fontSize:20}}>{h.type==='contrato'?'📝':'📄'}</span>
                    <div style={{flex:1}}>
                      <div style={{fontWeight:700,fontSize:15}}>{h.clientName||'Cliente'}</div>
                      <div style={{fontSize:12,color:'var(--muted)',marginTop:1}}>{h.date} · {h.consultor}</div>
                    </div>
                    <span style={{fontSize:12,fontWeight:700,color:total?'var(--accent3)':'var(--warning)',background:total?'rgba(16,185,129,.1)':'rgba(251,191,36,.1)',padding:'4px 12px',borderRadius:20,border:`1px solid ${total?'rgba(16,185,129,.3)':'rgba(251,191,36,.3)'}`}}>
                      {total?'✅ Totalmente Assinado':'⏳ Aguardando Assinaturas'}
                    </span>
                  </div>
                  <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
                    <div style={{background:'var(--surface2)',border:'1px solid var(--border)',borderRadius:10,padding:'14px 16px'}}>
                      <div style={{fontSize:10,color:'var(--muted)',letterSpacing:1.5,textTransform:'uppercase',marginBottom:8}}>CONTRATADA (Consultor)</div>
                      {consultorAssinou?<><div style={{fontSize:13,fontWeight:600,color:'var(--accent3)',marginBottom:2}}>✅ {h.consultantSignedBy}</div><div style={{fontSize:11,color:'var(--muted)'}}>{h.consultantSignedAt}</div></>
                        :<><div style={{fontSize:13,color:'var(--muted)',marginBottom:10}}>{h.consultor||'—'} — aguardando</div>
                        <button onClick={()=>abrirSignForm(h,'consultant')} style={{padding:'8px 14px',borderRadius:8,background:'rgba(0,212,255,.15)',border:'1px solid rgba(0,212,255,.3)',color:'var(--accent)',cursor:'pointer',fontFamily:'DM Mono,monospace',fontSize:12,fontWeight:600}}>✍️ Assinar agora</button></>}
                    </div>
                    <div style={{background:'var(--surface2)',border:'1px solid var(--border)',borderRadius:10,padding:'14px 16px'}}>
                      <div style={{fontSize:10,color:'var(--muted)',letterSpacing:1.5,textTransform:'uppercase',marginBottom:8}}>CONTRATANTE (Cliente)</div>
                      {clienteAssinou?<><div style={{fontSize:13,fontWeight:600,color:'var(--accent3)',marginBottom:2}}>✅ {h.signedBy}</div><div style={{fontSize:11,color:'var(--muted)'}}>{h.signedAt}</div></>
                        :<><div style={{fontSize:13,color:'var(--muted)',marginBottom:10}}>{h.clientName||'—'} — aguardando</div>
                        <button onClick={()=>{setSignDoc(h);setSignEmailInput(h.clientEmail||'');setShowSign(true);setPainel(null)}} style={{padding:'8px 14px',borderRadius:8,background:'rgba(251,191,36,.1)',border:'1px solid rgba(251,191,36,.3)',color:'var(--gold)',cursor:'pointer',fontFamily:'DM Mono,monospace',fontSize:12,fontWeight:600}}>📤 Enviar link</button></>}
                    </div>
                  </div>
                  {total&&<div style={{marginTop:12,padding:'10px 14px',background:'rgba(16,185,129,.08)',border:'1px solid rgba(16,185,129,.2)',borderRadius:8,fontSize:12,color:'var(--accent3)',display:'flex',gap:10,alignItems:'center'}}>
                    ✅ Contrato completamente assinado.{' '}
                    <button onClick={()=>verDocumento(h)} style={{background:'none',border:'none',color:'var(--accent)',cursor:'pointer',fontFamily:'DM Mono,monospace',fontSize:12,textDecoration:'underline',padding:0}}>Ver documento</button>
                  </div>}
                </div>
              )})
          )}

          {painel==='documentos'&&<div>
            <div style={{background:'var(--surface)',border:'1px solid var(--border)',borderRadius:14,padding:'20px 24px',marginBottom:16}}>
              <h3 style={{fontFamily:'Syne,sans-serif',fontSize:15,fontWeight:700,color:'var(--accent)',marginBottom:8}}>📄 Templates de Documentos</h3>
              <p style={{fontSize:13,color:'var(--muted)',lineHeight:1.7,marginBottom:14}}>Para editar os templates, acesse <strong style={{color:'var(--text)'}}>Configurações → Documentos</strong>.</p>
              <button onClick={()=>{setPainel(null);router.push('/configuracoes')}} style={{padding:'10px 20px',borderRadius:9,background:'rgba(0,212,255,.1)',border:'1px solid rgba(0,212,255,.3)',color:'var(--accent)',fontFamily:'DM Mono,monospace',fontSize:13,cursor:'pointer',fontWeight:600}}>⚙️ Ir para Configurações → Documentos</button>
            </div>
          </div>}
        </div>
      </div>
    )
  }

  // Renderizar botões de módulos quando habilitados
  const renderModulosButtons = () => {
    if (!cfg.modChips) return null
    if (S.stage !== 'await_modules') return null
    const mods = cfg.modulos || ALL_MODS
    return (
      <div style={{ marginTop: 8, marginBottom: 12, display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {mods.map(mod => {
          const sel = selectedMods.includes(mod)
          return (
            <button
              key={mod}
              onClick={() => setSelectedMods(prev => sel ? prev.filter(m => m !== mod) : [...prev, mod])}
              style={{
                padding: '8px 14px',
                borderRadius: 8,
                background: sel ? 'rgba(0,212,255,.2)' : 'var(--surface2)',
                border: `1px solid ${sel ? 'var(--accent)' : 'var(--border)'}`,
                color: sel ? 'var(--accent)' : 'var(--muted)',
                cursor: 'pointer',
                fontFamily: 'DM Mono, monospace',
                fontSize: 12,
                transition: 'all .15s'
              }}
            >
              {mod}
            </button>
          )
        })}
        <button
          onClick={confirmarMods}
          style={{
            padding: '8px 14px',
            borderRadius: 8,
            background: 'linear-gradient(135deg,var(--accent3),#059669)',
            border: 'none',
            color: '#fff',
            cursor: 'pointer',
            fontFamily: 'DM Mono, monospace',
            fontSize: 12,
            fontWeight: 600
          }}
        >
          ✅ Confirmar módulos
        </button>
        <button
          onClick={() => { setAwaitingMods(false); addBot('Quais módulos?\n(Gestão Fiscal · BIA · CND · XML · IF · EP · Tributos)') }}
          style={{
            padding: '8px 14px',
            borderRadius: 8,
            background: 'rgba(100,116,139,.12)',
            border: '1px solid var(--border)',
            color: 'var(--muted)',
            cursor: 'pointer',
            fontFamily: 'DM Mono, monospace',
            fontSize: 12
          }}
        >
          Digitar
        </button>
      </div>
    )
  }

  return(<>
    <Head>
      <title>{cfg.company} – Assistente Comercial</title>
      <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
      <link href="https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=DM+Mono:wght@300;400;500&family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet"/>
    </Head>
    <style>{CSS}</style>
    <div className="orb orb1"/><div className="orb orb2"/>
    {renderPainel()}

    {/* HEADER COM LOGO CLICÁVEL E BOTÃO RELATÓRIOS */}
    <header>
      <div className="header-logo" style={{cursor:'pointer'}} onClick={() => router.push('/chat')}>
        {cfg.logob64?<img src={cfg.logob64} alt={cfg.company} style={{height:40,objectFit:'contain',borderRadius:8}} onError={e=>e.target.style.display='none'}/>
          :<div style={{fontFamily:'Syne,sans-serif',fontSize:17,fontWeight:700,color:'var(--text)'}}>{cfg.company||'Vivanexa'}</div>}
        {cfg.logob64&&<div style={{marginLeft:10}}><div style={{fontFamily:'Syne,sans-serif',fontSize:13,fontWeight:700,color:'var(--text)'}}>{cfg.company}</div><div style={{fontSize:11,color:'var(--muted)'}}>{cfg.slogan}</div></div>}
        {!cfg.logob64&&<div style={{marginLeft:4,fontSize:11,color:'var(--muted)'}}>{cfg.slogan}</div>}
      </div>
      <div className="status-dot">online</div>
      <nav style={{display:'flex',gap:4,alignItems:'center',marginLeft:'auto',flexWrap:'wrap'}}>
        <button onClick={() => router.push('/reports')} style={{background:'var(--surface2)',border:'1px solid var(--border)',cursor:'pointer',color:'var(--muted)',fontSize:11,padding:'5px 11px',borderRadius:8,fontFamily:'DM Mono,monospace'}}>📈 Relatórios</button>
        {[{id:'documentos',label:'📄 Documentos'},{id:'historico',label:'🗂️ Histórico'},{id:'assinaturas',label:'✍️ Assinaturas'}].map(({id,label})=>(
          <button key={id} onClick={()=>abrirPainel(id)} style={{background:'var(--surface2)',border:'1px solid var(--border)',cursor:'pointer',color:'var(--muted)',fontSize:11,padding:'5px 11px',borderRadius:8,fontFamily:'DM Mono,monospace',transition:'all .15s'}}
            onMouseEnter={e=>{e.currentTarget.style.color='var(--accent)';e.currentTarget.style.borderColor='rgba(0,212,255,.3)'}}
            onMouseLeave={e=>{e.currentTarget.style.color='var(--muted)';e.currentTarget.style.borderColor='var(--border)'}}>
            {label}
          </button>
        ))}
        <button onClick={()=>router.push('/dashboard')} style={{background:'var(--surface2)',border:'1px solid var(--border)',cursor:'pointer',color:'var(--muted)',fontSize:11,padding:'5px 11px',borderRadius:8,fontFamily:'DM Mono,monospace'}}>📊 Dashboard</button>
        <button onClick={()=>router.push('/configuracoes')} style={{background:'var(--surface2)',border:'1px solid var(--border)',cursor:'pointer',color:'var(--muted)',fontSize:15,padding:'5px 10px',borderRadius:8,fontFamily:'DM Mono,monospace'}}>⚙️</button>
        <span style={{fontSize:11,color:'var(--muted)'}}>👤 <span style={{color:'var(--text)',fontWeight:500}}>{userProfile.nome}</span></span>
        <button className="logout-btn" onClick={async()=>{await supabase.auth.signOut();router.replace('/')}}>Sair</button>
      </nav>
    </header>

    <div className="chat-wrap">
      <div id="messages" ref={msgRef}>
        {messages.map(m=>(
          <div key={m.id} className={`msg ${m.role}`}>
            <div className="msg-label">{m.role==='user'?'Você':'Assistente'}</div>
            <div className="bubble" {...(m.isHTML?{dangerouslySetInnerHTML:{__html:m.content}}:{children:m.content})}/>
          </div>
        ))}
        {thinking&&<div className="msg bot"><div className="thinking"><span/><span/><span/></div></div>}
        {timerVal&&timerDeadline&&<div className="timer-live">{timerVal}</div>}
      </div>

      {/* MÓDULOS CLICÁVEIS */}
      {renderModulosButtons()}

      <div id="inputArea">
        <textarea id="userInput" placeholder="Digite CPF, CNPJ, módulos..." value={input}
          onChange={e=>{setInput(e.target.value);e.target.style.height='auto';e.target.style.height=Math.min(e.target.scrollHeight,100)+'px'}}
          onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();send()}}} rows={1}/>
        <button className="send-btn" onClick={()=>send()}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
        </button>
      </div>
    </div>

    {/* MODAL VER DOCUMENTO */}
    {showDocView&&(
      <div className="modal-overlay" style={{zIndex:300}}>
        <div className="modal-box" style={{maxWidth:860,maxHeight:'92vh'}}>
          <div className="modal-header"><h3 style={{fontSize:14}}>{docViewTitle}</h3><button className="modal-close" onClick={()=>setShowDocView(false)}>✕</button></div>
          <div className="modal-body" style={{padding:0,flex:1,overflow:'hidden',display:'flex',flexDirection:'column'}}>
            {docViewLoading?<div style={{textAlign:'center',padding:40,color:'var(--muted)'}}>⏳ Carregando...</div>
              :<div style={{flex:1,overflowY:'auto',background:'#fff'}}><div dangerouslySetInnerHTML={{__html:docViewHtml}}/></div>}
          </div>
          <div className="modal-footer">
            <button className="btn-cancel" onClick={()=>setShowDocView(false)}>Fechar</button>
            <button className="btn-primary" onClick={()=>openPrint(docViewHtml,docViewTitle)}>🖨 Imprimir</button>
          </div>
        </div>
      </div>
    )}

    {/* MODAL CLIENTE */}
    {showClient&&(
      <div className="modal-overlay">
        <div className="modal-box" style={{maxWidth:620}}>
          <div className="modal-header"><h3>{clientMode==='proposta'?'📄':'📝'} Confirmar Dados do Cliente</h3><button className="modal-close" onClick={()=>setShowClient(false)}>✕</button></div>
          <div className="modal-body">
            <div style={{padding:'9px 12px',background:'var(--surface2)',border:'1px solid var(--border)',borderRadius:8,fontSize:13,color:'var(--muted)',fontFamily:'DM Mono,monospace',marginBottom:12}}>{fmtDoc(S.doc||'')}</div>
            <div className="modal-grid2">
              <div className="field"><label>Nome Fantasia</label><input value={cf.empresa} onChange={e=>setCf(f=>({...f,empresa:e.target.value}))} placeholder="Nome fantasia"/></div>
              <div className="field"><label>Razão Social</label><input value={cf.razao} onChange={e=>setCf(f=>({...f,razao:e.target.value}))} placeholder="Razão social"/></div>
              <div className="field"><label>Contato</label><input value={cf.contato} onChange={e=>setCf(f=>({...f,contato:e.target.value}))} placeholder="Responsável"/></div>
              <div className="field"><label>E-mail</label><input type="email" value={cf.email} onChange={e=>setCf(f=>({...f,email:e.target.value}))} placeholder="email@empresa.com"/></div>
              <div className="field"><label>Telefone</label><input value={cf.telefone} onChange={e=>setCf(f=>({...f,telefone:e.target.value}))} placeholder="(00) 00000-0000"/></div>
              <div className="field"><label>CEP</label>
                <div style={{display:'flex',gap:6}}>
                  <input value={cf.cep} onChange={e=>setCf(f=>({...f,cep:e.target.value}))} placeholder="00000-000" style={{flex:1}} onBlur={e=>e.target.value.replace(/\D/g,'').length>=8&&buscarCep(e.target.value)}/>
                  <button onClick={()=>buscarCep(cf.cep)} disabled={buscandoCep} style={{padding:'8px 12px',borderRadius:8,background:'rgba(0,212,255,.15)',border:'1px solid rgba(0,212,255,.3)',color:'var(--accent)',cursor:'pointer',fontFamily:'DM Mono,monospace',fontSize:12}}>{buscandoCep?'⏳':'📍'}</button>
                </div>
              </div>
              <div className="field"><label>Endereço</label><input value={cf.logradouro} onChange={e=>setCf(f=>({...f,logradouro:e.target.value}))} placeholder="Rua, número"/></div>
              <div className="field"><label>Bairro</label><input value={cf.bairro} onChange={e=>setCf(f=>({...f,bairro:e.target.value}))} placeholder="Bairro"/></div>
              <div className="field"><label>Cidade</label><input value={cf.cidade} onChange={e=>setCf(f=>({...f,cidade:e.target.value}))} placeholder="Cidade"/></div>
              <div className="field"><label>UF</label><input value={cf.uf} onChange={e=>setCf(f=>({...f,uf:e.target.value}))} placeholder="UF" maxLength={2}/></div>
              <div className="field"><label>CPF do Contato</label><input value={cf.cpfContato} onChange={e=>setCf(f=>({...f,cpfContato:e.target.value}))} placeholder="000.000.000-00"/></div>
              <div className="field"><label>Regime Tributário</label>
                <select value={cf.regime} onChange={e=>setCf(f=>({...f,regime:e.target.value}))} style={{width:'100%',background:'var(--surface2)',border:'1px solid var(--border)',borderRadius:8,padding:'9px 12px',fontFamily:'DM Mono,monospace',fontSize:13,color:'var(--text)',outline:'none'}}>
                  <option value="">Selecione...</option>
                  <option value="Simples Nacional">Simples Nacional</option>
                  <option value="Lucro Presumido">Lucro Presumido</option>
                  <option value="Lucro Real">Lucro Real</option>
                  <option value="MEI">MEI</option>
                </select>
              </div>
            </div>
            <div style={{marginTop:12,padding:14,background:'rgba(251,191,36,.06)',border:'1px solid rgba(251,191,36,.2)',borderRadius:10}}>
              <div style={{fontSize:11,color:'var(--gold)',letterSpacing:1.5,textTransform:'uppercase',marginBottom:10}}>🔧 Responsável pela Implantação</div>
              <div className="modal-grid3">{[['Nome','rimpNome'],['E-mail','rimpEmail'],['Telefone','rimpTel']].map(([l,k])=><div key={k} className="field"><label>{l}</label><input value={cf[k]||''} onChange={e=>setCf(f=>({...f,[k]:e.target.value}))} placeholder={l}/></div>)}</div>
            </div>
            <div style={{marginTop:12,padding:14,background:'rgba(16,185,129,.06)',border:'1px solid rgba(16,185,129,.2)',borderRadius:10}}>
              <div style={{fontSize:11,color:'var(--accent3)',letterSpacing:1.5,textTransform:'uppercase',marginBottom:10}}>💰 Responsável Financeiro</div>
              <div className="modal-grid3">{[['Nome','rfinNome'],['E-mail','rfinEmail'],['Telefone','rfinTel']].map(([l,k])=><div key={k} className="field"><label>{l}</label><input value={cf[k]||''} onChange={e=>setCf(f=>({...f,[k]:e.target.value}))} placeholder={l}/></div>)}</div>
            </div>
          </div>
          <div className="modal-footer">
            <button className="btn-cancel" onClick={()=>setShowClient(false)}>Cancelar</button>
            <button className="btn-primary" onClick={saveClient}>{clientMode==='proposta'?'✅ Salvar e Gerar Proposta':'📝 Avançar'}</button>
          </div>
        </div>
      </div>
    )}

    {/* WIZARD CONTRATO */}
    {showWiz&&(
      <div className="modal-overlay">
        <div className="modal-box" style={{maxWidth:680}}>
          <div className="modal-header"><h3>📝 Configurar Contrato — Passo {wizStep}/2</h3><button className="modal-close" onClick={()=>setShowWiz(false)}>✕</button></div>
          <div className="modal-body">
            {wizStep===1&&<>
              <div className="wiz-title">💳 Condição de Pagamento — Adesão: <strong>{fmt(wizTAd)}</strong></div>
              <div className="wiz-sec">À VISTA</div>
              <div className={`pay-opt${wizPay==='pix'?' sel':''}`} onClick={()=>setWizPay('pix')}><span>🏦</span><div style={{flex:1}}><div className="po-t">PIX ou Boleto à vista</div></div><div className="po-v">{fmt(wizTAd)}</div></div>
              <div className="wiz-sec" style={{marginTop:12}}>CARTÃO — SEM JUROS</div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>
                {Array.from({length:10},(_,i)=>i+1).map(n=>(
                  <div key={n} className={`pay-opt sm${wizPay===`cartao${n}x`?' sel':''}`} onClick={()=>setWizPay(`cartao${n}x`)}>
                    <span>💳</span><div style={{flex:1}}><div className="po-t">{n}×</div></div><div className="po-v" style={{fontSize:12}}>{fmt(wizTAd/n)}/m</div>
                  </div>
                ))}
              </div>
              <div className="wiz-sec" style={{marginTop:12}}>BOLETO PARCELADO</div>
              {[{n:2,d:`${fmt(wizTAd*0.5)} + ${fmt(wizTAd*0.5)} em 30d`},{n:3,d:`${fmt(wizTAd*0.5)} + 2× de ${fmt(wizTAd*0.25)}`}].map(o=>(
                <div key={o.n} className={`pay-opt${wizPay===`boleto${o.n}x`?' sel':''}`} onClick={()=>setWizPay(`boleto${o.n}x`)} style={{marginBottom:8}}>
                  <span>📄</span><div style={{flex:1}}><div className="po-t">{o.n}× Boleto</div><div className="po-s">{o.d}</div></div><div className="po-v">{fmt(wizTAd/o.n)}</div>
                </div>
              ))}
            </>}
            {wizStep===2&&<>
              <div className="wiz-title">📅 Datas de Vencimento</div>
              {wizTAd>0&&<>
                <div style={{fontSize:13,color:'var(--muted)',margin:'12px 0 8px'}}>Vencimento da Adesão ({fmt(wizTAd)})</div>
                <div style={{display:'flex',gap:8,flexWrap:'wrap',marginBottom:8}}>{wizDates.map(d=><button key={d} className={`date-pill${wizAd===d?' chosen':''}`} onClick={()=>setWizAd(d)}>{d}</button>)}</div>
                <input className="date-inp" placeholder="Outra data (DD/MM)" value={wizAd&&!wizDates.includes(wizAd)?wizAd:''} onChange={e=>setWizAd(e.target.value)} style={{marginBottom:16}}/>
              </>}
              <div style={{fontSize:13,color:'var(--muted)',margin:'4px 0 8px'}}>1ª Mensalidade ({fmt(wizTMen)}/mês)</div>
              <div style={{display:'flex',gap:8,flexWrap:'wrap',marginBottom:8}}>{wizDates.map(d=><button key={d} className={`date-pill${wizMen===d?' chosen':''}`} onClick={()=>setWizMen(d)}>{d}</button>)}</div>
              <input className="date-inp" placeholder="Outra data (DD/MM)" value={wizMen&&!wizDates.includes(wizMen)?wizMen:''} onChange={e=>setWizMen(e.target.value)}/>
            </>}
          </div>
          <div className="modal-footer">
            {wizStep===2&&<button className="btn-cancel" onClick={()=>setWizStep(1)}>← Voltar</button>}
            <button className="btn-cancel" onClick={()=>setShowWiz(false)}>Cancelar</button>
            <button className="btn-primary" onClick={wizNext}>{wizStep===1?'Próximo →':'📝 Gerar Contrato'}</button>
          </div>
        </div>
      </div>
    )}

    {/* MODAL ENVIAR ASSINATURA */}
    {showSign&&signDoc&&(
      <div className="modal-overlay" style={{zIndex:250}}>
        <div className="modal-box" style={{maxWidth:500}}>
          <div className="modal-header">
            <h3>✍️ Enviar para Assinatura</h3>
            <div style={{fontSize:12,color:'var(--muted)',marginTop:3}}>{signDoc.type==='proposta'?'Proposta':'Contrato'} · {signDoc.clientName}</div>
            <button className="modal-close" onClick={()=>setShowSign(false)}>✕</button>
          </div>
          <div className="modal-body">
            <div style={{marginBottom:14}}>
              <div style={{fontSize:10,color:'var(--muted)',textTransform:'uppercase',letterSpacing:1.5,marginBottom:6}}>Link de Assinatura</div>
              <div style={{display:'flex',gap:8}}>
                <input readOnly value={buildSignUrl(signDoc)} style={{flex:1,background:'var(--surface2)',border:'1px solid var(--border)',borderRadius:8,padding:'8px 12px',fontFamily:'DM Mono,monospace',fontSize:11,color:'var(--accent)',outline:'none'}}/>
                <button onClick={()=>navigator.clipboard?.writeText(buildSignUrl(signDoc))} style={{padding:'8px 12px',borderRadius:8,background:'rgba(0,212,255,.1)',border:'1px solid rgba(0,212,255,.25)',color:'var(--accent)',cursor:'pointer',fontFamily:'DM Mono,monospace',fontSize:12}}>📋</button>
              </div>
            </div>
            <div style={{marginBottom:16}}>
              <div style={{fontSize:10,color:'var(--muted)',textTransform:'uppercase',letterSpacing:1.5,marginBottom:6}}>E-mail do cliente</div>
              <input type="email" value={signEmailInput} onChange={e=>setSignEmailInput(e.target.value)} placeholder="email do cliente" style={{width:'100%',background:'var(--surface2)',border:'1px solid var(--border)',borderRadius:8,padding:'9px 12px',fontFamily:'DM Mono,monospace',fontSize:13,color:'var(--text)',outline:'none'}}/>
            </div>
            <div style={{display:'flex',flexDirection:'column',gap:10}}>
              <button onClick={()=>enviarWhatsApp(signDoc)} style={{padding:'13px 16px',borderRadius:12,background:'linear-gradient(135deg,#25d366,#128c7e)',border:'none',color:'#fff',fontFamily:'DM Mono,monospace',fontSize:14,fontWeight:600,cursor:'pointer',display:'flex',alignItems:'center',gap:10}}><span>💬</span> Enviar via WhatsApp</button>
              <button onClick={()=>enviarEmail(signDoc)} style={{padding:'13px 16px',borderRadius:12,background:'linear-gradient(135deg,#0f172a,#1e3a5f)',border:'1px solid rgba(0,212,255,.3)',color:'var(--accent)',fontFamily:'DM Mono,monospace',fontSize:14,fontWeight:600,cursor:'pointer',display:'flex',alignItems:'center',gap:10}}><span>📧</span> Enviar por E-mail</button>
              <button onClick={()=>{setShowSign(false);abrirSignForm(signDoc,'client')}} style={{padding:'13px 16px',borderRadius:12,background:'linear-gradient(135deg,rgba(251,191,36,.2),rgba(251,191,36,.08))',border:'1px solid rgba(251,191,36,.4)',color:'var(--gold)',fontFamily:'DM Mono,monospace',fontSize:14,fontWeight:600,cursor:'pointer',display:'flex',alignItems:'center',gap:10}}><span>👆</span> Assinar agora (esta tela)</button>
              <button onClick={()=>setShowSign(false)} style={{padding:'11px',borderRadius:10,background:'rgba(100,116,139,.12)',border:'1px solid var(--border)',color:'var(--muted)',fontFamily:'DM Mono,monospace',fontSize:13,cursor:'pointer'}}>Fechar</button>
            </div>
          </div>
        </div>
      </div>
    )}

    {/* MODAL FORMULÁRIO ASSINATURA */}
    {showSignForm&&(
      <div className="modal-overlay" style={{zIndex:300}}>
        <div className="modal-box" style={{maxWidth:480}}>
          <div className="modal-header">
            <h3>✍️ {signFormSide==='consultant'?'Assinatura do Consultor':'Assinatura do Cliente'}</h3>
            <button className="modal-close" onClick={()=>setShowSignForm(false)}>✕</button>
          </div>
          <div className="modal-body">
            <p style={{fontSize:13,color:'var(--muted)',lineHeight:1.7,marginBottom:16}}>Preencha os dados para registrar a assinatura eletrônica conforme a <strong style={{color:'var(--text)'}}>Lei nº 14.063/2020</strong>.</p>
            <div className="field"><label>Nome completo *</label><input value={sfNome} onChange={e=>setSfNome(e.target.value)} placeholder="Nome completo"/></div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
              <div className="field"><label>CPF *</label><input value={sfCpf} onChange={e=>setSfCpf(e.target.value)} placeholder="000.000.000-00"/></div>
              <div className="field"><label>E-mail *</label><input type="email" value={sfEmail} onChange={e=>setSfEmail(e.target.value)} placeholder="email"/></div>
            </div>
            <div onClick={()=>setSfAgreed(!sfAgreed)} style={{display:'flex',alignItems:'flex-start',gap:12,padding:'12px 14px',background:sfAgreed?'rgba(16,185,129,.06)':'var(--surface2)',border:`1px solid ${sfAgreed?'rgba(16,185,129,.3)':'var(--border)'}`,borderRadius:10,cursor:'pointer',marginTop:4}}>
              <div style={{width:18,height:18,borderRadius:5,border:`2px solid ${sfAgreed?'var(--accent3)':'var(--border)'}`,background:sfAgreed?'var(--accent3)':'transparent',flexShrink:0,display:'flex',alignItems:'center',justifyContent:'center',marginTop:2}}>
                {sfAgreed&&<span style={{color:'#fff',fontSize:11,fontWeight:700}}>✓</span>}
              </div>
              <p style={{fontSize:12,color:'var(--muted)',lineHeight:1.6,margin:0}}>Declaro que li e concordo com todos os termos, conforme a Lei nº 14.063/2020.</p>
            </div>
            {sfErro&&<div style={{padding:'10px 14px',background:'rgba(239,68,68,.1)',border:'1px solid rgba(239,68,68,.3)',borderRadius:8,fontSize:12,color:'var(--danger)',marginTop:12}}>⚠️ {sfErro}</div>}
          </div>
          <div className="modal-footer">
            <button className="btn-cancel" onClick={()=>setShowSignForm(false)}>Cancelar</button>
            <button className="btn-primary" onClick={confirmarSignForm} disabled={sfSaving}>{sfSaving?'⏳ Registrando...':'✅ Confirmar Assinatura'}</button>
          </div>
        </div>
      </div>
    )}
  </>)
}

const CSS=`
  :root{--bg:#0a0f1e;--surface:#111827;--surface2:#1a2540;--border:#1e2d4a;--accent:#00d4ff;--accent2:#7c3aed;--accent3:#10b981;--text:#e2e8f0;--muted:#64748b;--user-bubble:#1e3a5f;--bot-bubble:#131f35;--danger:#ef4444;--warning:#f59e0b;--gold:#fbbf24;--card-bg:#1a2540;--shadow:0 4px 24px rgba(0,0,0,.4)}
  *{box-sizing:border-box;margin:0;padding:0}html{font-size:15px}
  body{font-family:'DM Mono',monospace;background:var(--bg);color:var(--text);min-height:100vh;display:flex;flex-direction:column;align-items:center;overflow-x:hidden}
  body::before{content:'';position:fixed;inset:0;background-image:linear-gradient(rgba(0,212,255,.025) 1px,transparent 1px),linear-gradient(90deg,rgba(0,212,255,.025) 1px,transparent 1px);background-size:40px 40px;pointer-events:none;z-index:0}
  .orb{position:fixed;border-radius:50%;filter:blur(120px);pointer-events:none;z-index:0;opacity:.1}
  .orb1{width:500px;height:500px;background:var(--accent);top:-200px;right:-150px}
  .orb2{width:400px;height:400px;background:var(--accent2);bottom:-150px;left:-100px}
  header{position:sticky;top:0;z-index:100;width:100%;max-width:960px;padding:10px 20px;display:flex;align-items:center;gap:8px;flex-wrap:wrap;background:rgba(10,15,30,.9);backdrop-filter:blur(12px);border-bottom:1px solid var(--border)}
  .header-logo{display:flex;align-items:center;gap:8px}
  .status-dot{display:flex;align-items:center;gap:6px;font-size:11px;color:var(--accent3)}
  .status-dot::before{content:'';width:7px;height:7px;background:var(--accent3);border-radius:50%;animation:pulse 2s infinite}
  @keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}
  .logout-btn{background:none;border:none;cursor:pointer;color:var(--muted);font-size:11px;padding:5px 9px;border-radius:8px;font-family:'DM Mono',monospace}
  .logout-btn:hover{color:var(--danger)}
  .chat-wrap{position:relative;z-index:10;width:100%;max-width:820px;padding:14px 20px 0;flex:1;display:flex;flex-direction:column}
  #messages{display:flex;flex-direction:column;gap:14px;padding-bottom:10px;min-height:300px;max-height:calc(100vh - 200px);overflow-y:auto;scroll-behavior:smooth}
  #messages::-webkit-scrollbar{width:4px}#messages::-webkit-scrollbar-thumb{background:var(--border);border-radius:4px}
  .msg{display:flex;flex-direction:column;max-width:92%;animation:fadeUp .3s ease}
  @keyframes fadeUp{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}
  .msg.user{align-self:flex-end;align-items:flex-end}.msg.bot{align-self:flex-start;align-items:flex-start}
  .bubble{padding:13px 17px;border-radius:14px;font-size:15px;line-height:1.65;white-space:pre-wrap;word-break:break-word}
  .msg.user .bubble{background:var(--user-bubble);border:1px solid rgba(0,212,255,.15);border-bottom-right-radius:4px}
  .msg.bot .bubble{background:var(--bot-bubble);border:1px solid var(--border);border-bottom-left-radius:4px}
  .msg-label{font-size:11px;color:var(--muted);margin-bottom:4px;letter-spacing:.5px}
  .thinking{display:flex;gap:5px;padding:14px 18px;background:var(--bot-bubble);border:1px solid var(--border);border-radius:14px}
  .thinking span{width:8px;height:8px;background:var(--muted);border-radius:50%;animation:bounce 1.2s infinite}
  .thinking span:nth-child(2){animation-delay:.2s}.thinking span:nth-child(3){animation-delay:.4s}
  @keyframes bounce{0%,80%,100%{transform:translateY(0)}40%{transform:translateY(-6px)}}
  .price-card{background:var(--card-bg);border:1px solid var(--border);border-radius:12px;padding:15px 18px;margin:4px 0}
  .price-card h4{font-family:'Syne',sans-serif;font-size:15px;font-weight:700;color:var(--accent);margin-bottom:10px;display:flex;align-items:center;gap:6px;flex-wrap:wrap}
  .price-row{display:flex;justify-content:space-between;align-items:center;padding:5px 0;border-bottom:1px solid rgba(128,128,128,.1)}
  .price-row:last-child{border-bottom:none}.price-row .label{color:var(--muted);font-size:13px}.price-row .val{font-weight:600;color:var(--text);font-size:14px}
  .price-row .val.discount{color:var(--accent3)}.price-row .val.closing{color:var(--gold)}
  .section-divider{border:none;border-top:1px dashed var(--border);margin:8px 0}
  .unlimited-badge{background:rgba(0,212,255,.12);color:var(--accent);padding:3px 8px;border-radius:6px;font-size:12px;font-weight:600}
  .client-card{background:linear-gradient(135deg,rgba(0,212,255,.08),rgba(0,212,255,.03));border:1px solid rgba(0,212,255,.2);border-radius:12px;padding:14px 16px;margin:4px 0}
  .cl-name{font-family:'Syne',sans-serif;font-size:16px;font-weight:700;color:var(--accent);margin-bottom:8px}
  .client-row{display:flex;gap:8px;font-size:13px;padding:3px 0}.cl-label{color:var(--muted);min-width:90px;flex-shrink:0}.cl-val{color:var(--text)}
  .teaser-card{background:linear-gradient(135deg,rgba(124,58,237,.15),rgba(124,58,237,.05));border:1px solid rgba(124,58,237,.3);border-radius:12px;padding:16px 18px;margin:8px 0}
  .teaser-title{font-family:'Syne',sans-serif;font-size:15px;font-weight:700;color:var(--accent2);margin-bottom:8px}
  .teaser-body{font-size:13px;color:var(--muted);line-height:1.6;margin-bottom:12px}
  .yn-row{display:flex;gap:10px;flex-wrap:wrap}
  .yn-btn{padding:9px 18px;border-radius:10px;border:none;font-family:'DM Mono',monospace;font-size:13px;font-weight:600;cursor:pointer;transition:all .2s}
  .yn-btn.yes{background:linear-gradient(135deg,var(--accent3),#059669);color:#fff}
  .yn-btn.no{background:rgba(100,116,139,.15);border:1px solid var(--border);color:var(--muted)}
  .opp-banner{background:linear-gradient(135deg,rgba(251,191,36,.12),rgba(251,191,36,.04));border:1px solid rgba(251,191,36,.3);border-radius:12px;padding:16px 18px;margin:8px 0}
  .opp-title{font-family:'Syne',sans-serif;font-size:15px;font-weight:700;color:var(--gold);margin-bottom:10px}
  .opp-body{font-size:13px;color:var(--muted);line-height:1.7;margin-bottom:12px}
  .timer-block{background:linear-gradient(135deg,rgba(239,68,68,.1),rgba(239,68,68,.04));border:1px solid rgba(239,68,68,.25);border-radius:12px;padding:20px;margin:8px 0;text-align:center}
  .timer-label{font-size:12px;color:var(--muted);letter-spacing:1px;text-transform:uppercase;margin-bottom:12px}
  .timer-sub{font-size:11px;color:var(--muted);margin-top:10px}
  .timer-live{font-size:32px;font-weight:700;font-family:'Syne',sans-serif;color:#ef4444;letter-spacing:4px;padding:8px 0}
  .section-label{font-size:11px;color:var(--muted);letter-spacing:1px;text-transform:uppercase;margin:12px 0 6px}
  .dates-box{display:flex;gap:8px;flex-wrap:wrap}
  .date-chip{background:var(--surface2);border:1px solid var(--border);border-radius:8px;padding:5px 12px;font-size:13px;color:var(--text)}
  .prop-btn{width:100%;padding:12px;border-radius:10px;background:linear-gradient(135deg,rgba(0,212,255,.15),rgba(0,212,255,.05));border:1px solid rgba(0,212,255,.3);color:var(--accent);font-family:'DM Mono',monospace;font-size:13px;font-weight:600;cursor:pointer;text-align:left;margin-bottom:4px}
  .reset-btn{width:100%;padding:10px;border-radius:10px;background:rgba(100,116,139,.1);border:1px solid var(--border);color:var(--muted);font-family:'DM Mono',monospace;font-size:12px;cursor:pointer;margin-top:4px}
  #inputArea{display:flex;gap:10px;align-items:flex-end;padding:14px 0 20px}
  #userInput{flex:1;background:var(--surface);border:1px solid var(--border);border-radius:14px;padding:12px 16px;font-family:'DM Mono',monospace;font-size:15px;color:var(--text);outline:none;resize:none;line-height:1.5;transition:border-color .2s;min-height:48px}
  #userInput:focus{border-color:var(--accent);box-shadow:0 0 0 3px rgba(0,212,255,.08)}
  #userInput::placeholder{color:var(--muted)}
  .send-btn{width:48px;height:48px;border-radius:12px;background:linear-gradient(135deg,var(--accent),#0099bb);border:none;color:#fff;cursor:pointer;display:flex;align-items:center;justify-content:center;flex-shrink:0;transition:all .2s}
  .send-btn:hover{box-shadow:0 0 16px rgba(0,212,255,.4);transform:translateY(-1px)}
  .modal-overlay{position:fixed;inset:0;background:rgba(0,0,0,.75);z-index:150;display:flex;align-items:center;justify-content:center;padding:20px;overflow-y:auto}
  .modal-box{background:var(--surface);border:1px solid var(--border);border-radius:16px;width:100%;max-width:560px;box-shadow:var(--shadow);display:flex;flex-direction:column;max-height:90vh;position:relative}
  .modal-header{padding:20px 24px 0;flex-shrink:0}
  .modal-header h3{font-family:'Syne',sans-serif;font-size:16px;font-weight:700;color:var(--accent)}
  .modal-close{position:absolute;top:16px;right:20px;background:none;border:none;color:var(--muted);font-size:20px;cursor:pointer}
  .modal-close:hover{color:var(--text)}
  .modal-body{padding:20px 24px;overflow-y:auto;flex:1}
  .modal-grid2{display:grid;grid-template-columns:1fr 1fr;gap:12px}
  .modal-grid3{display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px}
  .field{margin-bottom:10px}.field label{font-size:11px;color:var(--muted);display:block;margin-bottom:4px;letter-spacing:.5px}
  .field input{width:100%;background:var(--surface2);border:1px solid var(--border);border-radius:8px;padding:9px 12px;font-family:'DM Mono',monospace;font-size:13px;color:var(--text);outline:none}
  .field input:focus{border-color:var(--accent)}
  .modal-footer{padding:16px 24px;border-top:1px solid var(--border);display:flex;gap:10px;justify-content:flex-end;flex-shrink:0}
  .btn-cancel{padding:10px 18px;border-radius:10px;background:rgba(100,116,139,.12);border:1px solid var(--border);color:var(--muted);font-family:'DM Mono',monospace;font-size:13px;cursor:pointer}
  .btn-primary{padding:10px 22px;border-radius:10px;background:linear-gradient(135deg,var(--accent),#0099bb);border:none;color:#fff;font-family:'DM Mono',monospace;font-size:13px;font-weight:600;cursor:pointer;transition:all .2s}
  .btn-primary:hover{box-shadow:0 0 16px rgba(0,212,255,.4);transform:translateY(-1px)}
  .wiz-title{font-family:'Syne',sans-serif;font-size:14px;font-weight:700;color:var(--text);margin-bottom:14px}
  .wiz-sec{font-size:10px;color:var(--muted);letter-spacing:1.5px;text-transform:uppercase;margin-bottom:8px;margin-top:8px}
  .pay-opt{display:flex;align-items:center;gap:12px;padding:11px 14px;border-radius:10px;border:1.5px solid var(--border);background:var(--surface2);cursor:pointer;transition:all .2s;margin-bottom:8px;font-size:18px}
  .pay-opt.sm{font-size:14px;padding:9px 12px;margin-bottom:0}
  .pay-opt.sel,.pay-opt:hover{border-color:var(--accent);background:rgba(0,212,255,.08)}
  .po-t{font-weight:700;font-size:13px;color:var(--text)}.po-s{font-size:11px;color:var(--muted);margin-top:2px}
  .po-v{font-size:13px;font-weight:700;color:var(--accent);white-space:nowrap}
  .date-pill{padding:6px 14px;border-radius:20px;border:1.5px solid var(--border);background:var(--surface2);color:var(--muted);font-family:'DM Mono',monospace;font-size:12px;cursor:pointer;transition:all .2s}
  .date-pill.chosen,.date-pill:hover{border-color:var(--accent);color:var(--accent);background:rgba(0,212,255,.1)}
  .date-inp{width:100%;background:var(--surface2);border:1px solid var(--border);border-radius:8px;padding:9px 12px;font-family:'DM Mono',monospace;font-size:13px;color:var(--text);outline:none;margin-top:6px}
  .date-inp:focus{border-color:var(--accent)}
`
