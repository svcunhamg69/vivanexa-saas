// ============================================================
// pages/chat.js — Assistente Comercial Vivanexa SaaS
// VERSÃO COMPLETA: chat + proposta + contrato + wizard
// Copie para: vivanexa-saas/pages/chat.js
// ============================================================

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/router'
import Head from 'next/head'
import { supabase } from '../lib/supabase'

const DEFAULT_CFG = {
  company:'VIVANEXA', slogan:'Assistente Comercial de Preços',
  discMode:'screen', discAdPct:50, discMenPct:0, discClosePct:40, unlimitedStrategy:true,
  plans:[
    {id:'basic',name:'Basic',maxCnpjs:25,users:1,unlimited:false},
    {id:'pro',name:'Pro',maxCnpjs:80,users:1,unlimited:false},
    {id:'top',name:'Top',maxCnpjs:150,users:5,unlimited:false},
    {id:'topplus',name:'Top Plus',maxCnpjs:999,users:999,unlimited:true},
  ],
  prices:{
    'Gestão Fiscal':{basic:[478,318],pro:[590,409],top:[1032,547],topplus:[1398,679]},
    'CND':{basic:[0,48],pro:[0,90],top:[0,150],topplus:[0,200]},
    'XML':{basic:[478,199],pro:[590,299],top:[1032,349],topplus:[1398,399]},
    'BIA':{basic:[478,129],pro:[590,169],top:[1032,280],topplus:[1398,299]},
    'IF':{basic:[1600,379],pro:[1600,619],top:[1600,920]},
    'EP':{basic:[0,39],pro:[0,82],top:[0,167]},
  },
  vouchers:[],
  productNames:{'Gestão Fiscal':'Gestão Fiscal','CND':'CND','XML':'XML','BIA':'BIA','IF':'Inteligência Fiscal','EP':'e-PROCESSOS','Tributos':'Tributos'},
}
const IF_NO_CNPJ=['IF','Tributos','EP']

// ── Utilitários ──────────────────────────────────────────────
const fmt=n=>'R$ '+n.toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2})
const clean=s=>s.replace(/\D/g,'')
const isCNPJ=s=>s.length===14
const isCPF=s=>s.length===11

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
  for(const mod of mods){
    if(mod==='IF'){const p=ifPlan||'basic',[aB,mB]=getPrice('IF',p,cfg),ad=aB*2,men=mB*1.2,adD=aB,menD=mB;res.push({name:pn('IF',cfg),ad,men,adD,menD,isPrepaid:true,plan:p,isIF:true});tAd+=ad;tMen+=men;tAdD+=adD;tMenD+=menD;continue}
    if(mod==='Tributos'){const m=calcTrib(notas);res.push({name:pn('Tributos',cfg),ad:0,men:m,adD:0,menD:m,isTributos:true,notas});tMen+=m;tMenD+=m;continue}
    if(mod==='EP'){const ep=plan==='topplus'?'top':plan,[,mB]=getPrice('EP',ep,cfg),men=mB*1.2,menD=mB;res.push({name:pn('EP',cfg),ad:0,men,adD:0,menD,isEP:true,plan:ep});tMen+=men;tMenD+=menD;continue}
    const[aB,mB]=getPrice(mod,plan,cfg);let ad=aB>0?Math.max(aB*2,1000):0,men=mB*1.2
    if(mod==='XML')men=Math.max(men,175);if(mod==='Gestão Fiscal')men=Math.max(men,200)
    const adD=aB>0?aB:0,menD=mB;res.push({name:mod,ad,men,adD,menD,plan});tAd+=ad;tMen+=men;tAdD+=adD;tMenD+=menD
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
  const gN=(pn('Gestão Fiscal',cfg)||'').toLowerCase()
  if(/gest[aã]o\s*(e\s*an[aá]lise|fiscal)/i.test(tn)||(/\bfiscal\b/i.test(tn)&&!/intelig/i.test(tn))||(gN&&tn.includes(gN)))found.push('Gestão Fiscal')
  if(/\bbia\b/i.test(lo))found.push('BIA')
  if(/\bcnd\b/i.test(lo))found.push('CND')
  if(/\bxml\b/i.test(lo))found.push('XML')
  if(/tributos/i.test(lo))found.push('Tributos')
  const epN=(pn('EP',cfg)||'').toLowerCase()
  if(/e[\s-]?process[o]?s?|eprocess/i.test(lo)||(epN&&lo.includes(epN)))found.push('EP')
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
    const end=(d.descricao_tipo_logradouro?d.descricao_tipo_logradouro+' ':'')+
      (d.logradouro||'')+(d.numero&&d.numero!=='S/N'?' '+d.numero:'')+(d.complemento?' – '+d.complemento:'')
    return{nome:d.razao_social||'',fantasia:d.nome_fantasia||d.razao_social||'',email:d.email||'',
      telefone:f.length>=10?`(${f.slice(0,2)}) ${f.slice(2)}`:'',municipio:d.municipio||'',uf:d.uf||'',
      cep:d.cep?.replace(/\D/g,'')||'',logradouro:end.trim(),bairro:d.bairro||'',cnpj,tipo:'PJ'}
  }catch(e){return null}
}

// ── HTML: Proposta ───────────────────────────────────────────
function buildProposal(S,cfg,user){
  const isC=S.closingToday===true,cd=S.clientData||{},co=S.contactData||{}
  const today=new Date().toLocaleDateString('pt-BR')
  const tAd=isC?S.closingData?.tAd:(S.quoteData?.tAdD||0)
  const tMen=isC?S.closingData?.tMen:(S.quoteData?.tMenD||0)
  const results=isC?S.closingData?.results:S.quoteData?.results
  const dates=getNextDates()
  const rows=(results||[]).map(r=>{
    const adS=(r.isTributos||r.isEP)?'—':fmt(isC?r.ad:r.adD)
    return`<tr><td><div style="font-weight:600;color:#0f172a">${r.name}</div>${r.plan?`<div style="font-size:11px;color:#64748b">Plano ${getPlanLabel(r.plan,cfg.plans)}</div>`:''}</td><td style="text-align:center">${adS}</td><td style="text-align:center">${fmt(isC?r.men:r.menD)}</td></tr>`
  }).join('')
  const field=(l,v)=>`<div><label style="font-size:10px;color:#64748b;text-transform:uppercase;display:block;margin-bottom:4px">${l}</label><div style="border:1px solid #e2e8f0;border-radius:6px;padding:8px 10px;font-size:13px;color:#1e293b;min-height:34px">${v||'—'}</div></div>`
  const sec=(t)=>`<div style="font-family:Syne,sans-serif;font-size:14px;font-weight:700;color:#0f172a;margin:0 0 13px;padding-bottom:8px;border-bottom:2px solid #e2e8f0;display:flex;align-items:center;gap:8px"><div style="width:8px;height:8px;background:#00d4ff;border-radius:50%;flex-shrink:0"></div>${t}</div>`
  return`<div style="background:#fff;font-family:Inter,sans-serif;color:#1e293b;max-width:820px;margin:0 auto">
  <div style="background:linear-gradient(135deg,#0f172a,#1e3a5f);padding:32px 44px">
    <img src="/logo.png" style="height:50px;object-fit:contain;margin-bottom:10px;display:block" onerror="this.style.display='none'">
    <div style="font-size:11px;color:#64748b;letter-spacing:2px;text-transform:uppercase;margin-bottom:18px">Proposta Comercial</div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
      <div><div style="font-size:10px;color:#64748b;letter-spacing:1px;text-transform:uppercase;margin-bottom:3px">Data</div><div style="font-size:13px;color:#e2e8f0;font-weight:500">${today}</div></div>
      <div><div style="font-size:10px;color:#64748b;letter-spacing:1px;text-transform:uppercase;margin-bottom:3px">Validade</div><div style="font-size:13px;color:#e2e8f0;font-weight:500">${isC?'Válida até as 18h de hoje':'Válida por 7 dias'}</div></div>
      <div><div style="font-size:10px;color:#64748b;letter-spacing:1px;text-transform:uppercase;margin-bottom:3px">Plano</div><div style="font-size:13px;color:#e2e8f0;font-weight:500">${S.plan?getPlanLabel(S.plan,cfg.plans):'—'}</div></div>
      <div><div style="font-size:10px;color:#64748b;letter-spacing:1px;text-transform:uppercase;margin-bottom:3px">CNPJs</div><div style="font-size:13px;color:#e2e8f0;font-weight:500">${S.cnpjs||'—'}</div></div>
    </div>
  </div>
  <div style="padding:32px 44px">
    <div style="margin-bottom:26px">${sec('Dados do Cliente')}
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
        ${field('Empresa',cd.fantasia||cd.nome||'')}${field('Razão Social',cd.nome||'')}
        ${field('CPF / CNPJ',fmtDoc(S.doc||''))}${field('Nome do Contato',co.contato||'')}
        ${field('E-mail',co.email||cd.email||'')}${field('Telefone',co.telefone||cd.telefone||'')}
        ${field('Cidade',co.cidade||cd.municipio||'')}${field('Estado',co.uf||cd.uf||'')}
      </div>
    </div>
    <div style="margin-bottom:26px">${sec('Módulos Contratados')}
      <table style="width:100%;border-collapse:collapse;font-size:13px">
        <thead><tr style="background:#f8fafc"><th style="padding:10px 14px;text-align:left;font-size:10px;text-transform:uppercase;color:#64748b;border-bottom:2px solid #e2e8f0">Módulo</th><th style="padding:10px 14px;text-align:center;font-size:10px;text-transform:uppercase;color:#64748b;border-bottom:2px solid #e2e8f0">Adesão</th><th style="padding:10px 14px;text-align:center;font-size:10px;text-transform:uppercase;color:#64748b;border-bottom:2px solid #e2e8f0">Mensalidade</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
      <div style="background:#f8fafc;border-radius:10px;padding:16px 20px;margin-top:14px">
        <div style="display:flex;justify-content:space-between;padding:5px 0;font-size:13px"><span style="color:#64748b">Total Adesão</span><span style="font-weight:600;color:#0f172a">${fmt(tAd)}</span></div>
        <div style="display:flex;justify-content:space-between;padding:5px 0;font-size:16px"><span style="font-weight:600;color:#0f172a">Total Mensalidade</span><span style="font-weight:700;color:#00d4ff">${fmt(tMen)}</span></div>
      </div>
    </div>
    <div style="margin-bottom:26px">${sec('Condições de Pagamento — Adesão')}
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px">
        <div style="border:2px solid #00d4ff;border-radius:10px;padding:14px;text-align:center"><div style="font-size:22px;margin-bottom:6px">💳</div><div style="font-size:11px;font-weight:700;color:#0f172a;text-transform:uppercase;margin-bottom:6px">Cartão de Crédito</div><div style="font-size:11px;color:#64748b">Parcelado em</div><div style="font-size:12px;color:#10b981;font-weight:600;margin-top:4px">10× sem juros</div><div style="font-size:11px;color:#64748b;margin-top:4px">${fmt(tAd/10)} / mês</div></div>
        <div style="border:1px solid #e2e8f0;border-radius:10px;padding:14px;text-align:center"><div style="font-size:22px;margin-bottom:6px">🏦</div><div style="font-size:11px;font-weight:700;color:#0f172a;text-transform:uppercase;margin-bottom:6px">Boleto / PIX</div><div style="font-size:11px;color:#64748b">À vista</div><div style="font-size:12px;color:#10b981;font-weight:600;margin-top:4px">${fmt(tAd)}</div></div>
        <div style="border:1px solid #e2e8f0;border-radius:10px;padding:14px;text-align:center"><div style="font-size:22px;margin-bottom:6px">📄</div><div style="font-size:11px;font-weight:700;color:#0f172a;text-transform:uppercase;margin-bottom:6px">Boleto Parcelado</div><div style="font-size:11px;color:#64748b">3× sem juros</div><div style="font-size:12px;color:#10b981;font-weight:600;margin-top:4px">${fmt(tAd*0.5)} entrada</div><div style="font-size:11px;color:#64748b;margin-top:4px">+ ${fmt(tAd*0.25)} em 30/60 dias</div></div>
      </div>
    </div>
    <div style="margin-bottom:26px">${sec('Primeira Mensalidade')}
      <div style="font-size:13px;color:#475569;margin-bottom:10px">Escolha o vencimento para <strong style="color:#0f172a">${fmt(tMen)}/mês</strong>:</div>
      <div style="display:flex;gap:8px;flex-wrap:wrap">${dates.map(d=>`<span style="background:#eff6ff;border:1px solid #bfdbfe;color:#1d4ed8;padding:4px 12px;border-radius:20px;font-size:11px;font-weight:600">${d}</span>`).join('')}</div>
    </div>
    ${isC?`<div style="background:#fef2f2;border:1px solid #fecaca;border-radius:10px;padding:14px 18px;margin-bottom:26px;display:flex;align-items:center;gap:12px"><div style="font-size:20px">⏱</div><div style="color:#b91c1c;font-weight:500;line-height:1.5;font-size:12px">Esta proposta com <strong>condições especiais de fechamento</strong> é válida somente até as <strong>18h de hoje</strong>.</div></div>`:''}
    <div style="margin-bottom:26px">${sec('Seu Consultor')}
      <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:10px;padding:14px 18px;display:flex;align-items:flex-start;gap:12px">
        <div style="font-size:24px">👤</div>
        <div><div style="font-weight:700;font-size:14px;color:#14532d;margin-bottom:4px">${user?.nome||user?.email||'—'}</div><div style="font-size:12px;color:#166534">${user?.email?'📧 '+user.email:''}</div></div>
      </div>
    </div>
  </div>
  <div style="background:#f8fafc;padding:18px 44px;display:flex;justify-content:space-between;align-items:center;font-size:11px;color:#94a3b8;border-top:1px solid #e2e8f0">
    <div style="font-weight:700;color:#1e293b">${cfg.company}</div>
    <div>www.vivanexa.com.br · Gerada em ${today}</div>
  </div>
</div>`
}

// ── HTML: Contrato ───────────────────────────────────────────
function buildContract(S,cfg,user,tAd,tMen,adDate,menDate,payMode){
  const isC=S.closingToday===true,cd=S.clientData||{},co=S.contactData||{}
  const today=new Date().toLocaleDateString('pt-BR')
  const results=isC?S.closingData?.results:S.quoteData?.results
  const blank=()=>'<span style="color:#94a3b8">___________________________</span>'
  const sec=t=>`<div style="font-family:Syne,sans-serif;font-size:14px;font-weight:700;color:#0f172a;padding-bottom:8px;border-bottom:2px solid #e2e8f0;margin:24px 0 14px;display:flex;align-items:center;gap:8px"><div style="width:8px;height:8px;background:#00d4ff;border-radius:50%;flex-shrink:0"></div>${t}</div>`
  const row=(l,v,b)=>`<tr><td style="padding:5px 0;color:#64748b;width:160px;vertical-align:top;font-size:12px">${l}</td><td style="padding:5px 0;${b?'font-weight:600;color:#0f172a;':'color:#1e293b;'}">${v}</td></tr>`
  const addr=(co.end?co.end+', ':'')+(co.bairro?co.bairro+', ':'')+
    (co.cidade||cd.municipio||'')+(co.uf||cd.uf?' – '+(co.uf||cd.uf):'')
  let payDesc='(condição a definir)'
  if(payMode==='pix')payDesc=`À vista no PIX ou Boleto — ${fmt(tAd||0)}`
  else{
    const cM=payMode?.match(/^cartao(\d+)x$/);if(cM){const n=parseInt(cM[1]);payDesc=n===1?`À vista no Cartão — ${fmt(tAd||0)}`:`${n}× sem juros no Cartão — ${fmt((tAd||0)/n)}/mês`}
    const bM=payMode?.match(/^boleto(\d+)x$/);if(bM){const n=parseInt(bM[1]);payDesc=n===2?`2× no Boleto — Entrada ${fmt((tAd||0)*0.5)} + ${fmt((tAd||0)*0.5)} em 30 dias`:`3× no Boleto — Entrada ${fmt((tAd||0)*0.5)} + ${fmt((tAd||0)*0.25)} em 30/60 dias`}
  }
  const payLines=[]
  if(tAd>0)payLines.push(`Adesão: ${fmt(tAd||0)} — vencimento em ${adDate||'___/___'} — Pagamento: ${payDesc}`)
  if(tMen>0)payLines.push(`Mensalidade: ${fmt(tMen||0)}/mês — 1ª mensalidade com vencimento em ${menDate||'___/___'}`)
  const tableRows=(results||[]).map(r=>{
    const adS=r.isTributos||r.isEP?'—':fmt(isC?r.ad:r.adD)
    return`<tr><td style="padding:10px 14px;border-bottom:1px solid #f1f5f9;font-size:13px;color:#1e293b;font-weight:500">${r.name}</td><td style="padding:10px 14px;border-bottom:1px solid #f1f5f9;font-size:13px;color:#1e293b;text-align:center">${adS}</td><td style="padding:10px 14px;border-bottom:1px solid #f1f5f9;font-size:13px;color:#1e293b;text-align:center">${fmt(isC?r.men:r.menD)}</td><td style="padding:10px 14px;border-bottom:1px solid #f1f5f9;font-size:13px;color:#1e293b;text-align:center">${S.cnpjs||'—'}</td><td style="padding:10px 14px;border-bottom:1px solid #f1f5f9;font-size:13px;color:#10b981;font-weight:700;text-align:right">${fmt(isC?r.men:r.menD)}</td></tr>`
  }).join('')
  return`<div style="background:#fff;font-family:Inter,sans-serif;color:#1e293b;max-width:820px;margin:0 auto">
  <div style="background:linear-gradient(135deg,#0f172a,#1e3a5f);padding:32px 44px;text-align:center">
    <img src="/logo.png" style="height:56px;object-fit:contain;display:block;margin:0 auto 14px" onerror="this.style.display='none'">
    <div style="font-family:Syne,sans-serif;font-size:20px;font-weight:800;color:#fff;margin-bottom:6px">Termo de Pedido e Registro de Software</div>
    <div style="font-size:12px;color:#94a3b8">Seja bem-vindo ao ${cfg.company}! É um prazer tê-lo como cliente.</div>
  </div>
  <div style="padding:36px 44px">
    <p style="font-size:13px;color:#475569;line-height:1.8;margin-bottom:28px;padding:14px 18px;background:#f8fafc;border-left:3px solid #00d4ff;border-radius:0 8px 8px 0">
      Segue abaixo os termos do pedido registrado com nosso time de vendas.<br>
      Confira os dados abaixo com atenção e caso esteja tudo correto, basta <strong style="color:#0f172a">ASSINAR</strong> esse pedido para darmos seguimento ao seu treinamento e implantação.
    </p>
    ${sec('1 – CONTRATADA')}
    <table style="width:100%;font-size:13px;margin-bottom:24px">
      ${row('Nome:','VIVANEXA DESENVOLVIMENTO E LICENCIAMENTO DE PROGRAMAS LTDA',true)}
      ${row('CNPJ:','32.125.987/0001-67')}
      ${row('Endereço:','Rua Dom Augusto, 1488, Sala D, Centro, Ji-Paraná RO, 76900-103')}
      ${row('E-mail:','contato@vivanexa.com.br')}
      ${row('Responsável:','Alex Geovane Leite')}
      ${row('CPF:','620.650.412-34')}
    </table>
    ${sec('2 – CONTRATANTE')}
    <table style="width:100%;font-size:13px;margin-bottom:24px">
      ${row('Razão Social:',co.razao||cd.nome||blank(),true)}
      ${row('CNPJ:',fmtDoc(S.doc||'')||blank())}
      ${row('Endereço:',addr||blank())}
      ${row('E-mail:',co.email||cd.email||blank())}
      ${row('Fone:',co.telefone||cd.telefone||blank())}
      ${row('Contratante:',co.contato||blank())}
      ${row('CPF:',co.cpfContato||blank())}
    </table>
    ${sec('3 – RESPONSÁVEL PELA IMPLEMENTAÇÃO')}
    <table style="width:100%;font-size:13px;margin-bottom:24px">
      ${row('Nome:',co.rimpNome||blank())}${row('E-mail:',co.rimpEmail||blank())}${row('Telefone:',co.rimpTel||blank())}
    </table>
    ${sec('4 – RESPONSÁVEL PELO FINANCEIRO')}
    <table style="width:100%;font-size:13px;margin-bottom:24px">
      ${row('Nome:',co.rfinNome||blank())}${row('E-mail:',co.rfinEmail||blank())}${row('Telefone:',co.rfinTel||blank())}
    </table>
    ${sec('5 – PLANO CONTRATADO E VALORES')}
    <div style="font-size:12px;color:#64748b;margin-bottom:10px"><strong>Validade:</strong> 12 meses</div>
    <table style="width:100%;border-collapse:collapse;margin-bottom:0">
      <thead><tr style="background:#f8fafc">
        <th style="padding:10px 14px;text-align:left;font-size:11px;text-transform:uppercase;color:#64748b;border-bottom:2px solid #e2e8f0">Nome do Produto</th>
        <th style="padding:10px 14px;text-align:center;font-size:11px;text-transform:uppercase;color:#64748b;border-bottom:2px solid #e2e8f0">Valor Unitário (Adesão)</th>
        <th style="padding:10px 14px;text-align:center;font-size:11px;text-transform:uppercase;color:#64748b;border-bottom:2px solid #e2e8f0">Mensalidade</th>
        <th style="padding:10px 14px;text-align:center;font-size:11px;text-transform:uppercase;color:#64748b;border-bottom:2px solid #e2e8f0">Qtd. CNPJs</th>
        <th style="padding:10px 14px;text-align:right;font-size:11px;text-transform:uppercase;color:#64748b;border-bottom:2px solid #e2e8f0">Preço Total/mês</th>
      </tr></thead>
      <tbody>${tableRows}</tbody>
      <tfoot>
        <tr style="background:#f0fdf4"><td colspan="4" style="padding:12px 14px;font-weight:700;color:#0f172a">Total Mensalidade</td><td style="padding:12px 14px;font-weight:800;color:#10b981;font-size:16px;text-align:right">${fmt(tMen||0)}/mês</td></tr>
        <tr style="background:#fffbeb"><td colspan="4" style="padding:10px 14px;font-weight:700;color:#92400e">Adesão (único)</td><td style="padding:10px 14px;font-weight:700;color:#b45309;text-align:right">${fmt(tAd||0)}</td></tr>
      </tfoot>
    </table>
    <div style="margin-top:14px;margin-bottom:28px;padding:14px 18px;background:#fffbeb;border:1px solid #fde68a;border-radius:8px;font-size:13px;color:#92400e">
      <strong>Observação:</strong> ${payLines.join('<br>')||'(a definir)'}<br>
      <strong>Regime Tributário:</strong> ${co.regime||blank()}
    </div>
    <div style="background:#f0f9ff;border:1px solid #bae6fd;border-radius:10px;padding:16px 20px;margin-bottom:24px;font-size:13px;color:#0c4a6e;line-height:1.8">
      Nossa equipe entrará em contato <strong>em até 72 horas</strong> após a assinatura.<br>
      Atendimento: <strong>9:00 às 18:00h de Brasília</strong>.<br>
      Tenha em mãos os certificados digitais das empresas.
    </div>
    <div style="font-size:13px;color:#475569;line-height:1.8;margin-bottom:24px">
      <p>Dando o aceite, você concorda com os <strong>Termos e Condições de Uso e Política de Privacidade Vivanexa</strong> em www.vivanexa.com.br/termos-de-uso.</p>
      <p style="margin-top:8px"><strong>Após contratação e aceite, todos os pagamentos serão devidos e nenhum valor será ressarcido após o início do Onboarding.</strong></p>
      <p style="margin-top:8px"><strong>WhatsApp:</strong> 69 98405-9125 | <strong>E-mail:</strong> contato@vivanexa.com.br</p>
    </div>
    <div style="margin-top:44px;padding-top:24px;border-top:2px solid #e2e8f0">
      <div style="font-family:Syne,sans-serif;font-size:13px;font-weight:700;color:#0f172a;margin-bottom:24px;text-align:center">ASSINATURAS</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:48px">
        <div style="text-align:center"><div style="height:60px;border-bottom:1px solid #1e293b;margin-bottom:10px"></div><div style="font-weight:600;font-size:13px;color:#0f172a">${user?.nome||'Consultor'}</div><div style="font-size:12px;color:#64748b">${cfg.company}</div><div style="font-size:11px;color:#94a3b8">VIVANEXA DESENVOLVIMENTO E LICENCIAMENTO DE PROGRAMAS LTDA</div></div>
        <div style="text-align:center"><div style="height:60px;border-bottom:1px solid #1e293b;margin-bottom:10px"></div><div style="font-weight:600;font-size:13px;color:#0f172a">${co.contato||co.razao||cd.nome||'Contratante'}</div><div style="font-size:12px;color:#64748b">${co.razao||cd.nome||'Empresa'}</div><div style="font-size:12px;color:#64748b">CPF: ${co.cpfContato||blank()}</div></div>
      </div>
      <div style="text-align:center;margin-top:28px;font-size:12px;color:#94a3b8">${addr?addr+' · ':''} ${today}</div>
    </div>
  </div>
  <div style="background:#f8fafc;padding:16px 44px;display:flex;justify-content:space-between;align-items:center;font-size:11px;color:#94a3b8;border-top:1px solid #e2e8f0">
    <div style="font-weight:700;color:#1e293b">${cfg.company}</div>
    <div>www.vivanexa.com.br · contato@vivanexa.com.br · (69) 98405-9125</div>
  </div>
</div>`
}

function openPrint(html,title){
  const win=window.open('','_blank','width=900,height=700')
  if(!win){alert('Permita popups para imprimir.');return}
  win.document.write(`<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"><title>${title}</title>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Syne:wght@700;800&display=swap" rel="stylesheet">
  <style>*{-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important;box-sizing:border-box}body{margin:0;background:#fff;font-family:Inter,sans-serif}
  .tb{display:flex;gap:10px;padding:14px 20px;background:#f8fafc;border-bottom:1px solid #e2e8f0}
  .tb button{padding:9px 18px;border-radius:8px;cursor:pointer;font-size:13px;font-weight:600;border:none}
  .bp{background:#0f172a;color:#fff}.bc{background:#e2e8f0;color:#475569}
  @media print{.tb{display:none!important}*{-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important}}</style>
  </head><body>
  <div class="tb"><button class="bp" onclick="window.print()">🖨 Imprimir / Salvar PDF</button><button class="bc" onclick="window.close()">✕ Fechar</button></div>
  ${html}</body></html>`)
  win.document.close();win.focus()
}

// ══════════════════════════════════════════
// COMPONENTE
// ══════════════════════════════════════════
export default function Chat(){
  const router=useRouter()
  const msgRef=useRef(null)
  const inputRef=useRef(null)
  const [userProfile,setUserProfile]=useState(null)
  const [cfg,setCfg]=useState(DEFAULT_CFG)
  const [messages,setMessages]=useState([])
  const [input,setInput]=useState('')
  const [thinking,setThinking]=useState(false)
  const [chips,setChips]=useState([])
  const [timerVal,setTimerVal]=useState('')
  const [timerDeadline,setTimerDeadline]=useState(null)

  // Modal cliente
  const [showClient,setShowClient]=useState(false)
  const [clientMode,setClientMode]=useState('proposta')
  const [cf,setCf]=useState({empresa:'',razao:'',contato:'',email:'',telefone:'',cidade:'',uf:'',cpfContato:'',regime:'',rimpNome:'',rimpEmail:'',rimpTel:'',rfinNome:'',rfinEmail:'',rfinTel:''})

  // Wizard
  const [showWiz,setShowWiz]=useState(false)
  const [wizStep,setWizStep]=useState(1)
  const [wizPay,setWizPay]=useState('')
  const [wizAd,setWizAd]=useState('')
  const [wizMen,setWizMen]=useState('')
  const [wizTAd,setWizTAd]=useState(0)
  const [wizTMen,setWizTMen]=useState(0)

  const S=useRef({stage:'await_doc',doc:null,clientData:null,contactData:{},users:null,cnpjs:null,modules:[],plan:null,ifPlan:null,notas:null,quoteData:null,closingData:null,closingToday:false,appliedVoucher:null}).current

  useEffect(()=>{
    supabase.auth.getSession().then(async({data:{session}})=>{
      if(!session){router.replace('/');return}
      const{data:profile}=await supabase.from('perfis').select('*').eq('id',session.user.id).single()
      const nome=profile?.nome||session.user.email?.split('@')[0]||'Consultor'
      setUserProfile({...session.user,nome,perfil:profile})
      if(profile?.empresa_id)await loadCfg(profile.empresa_id)
    })
    const{data:l}=supabase.auth.onAuthStateChange((_e,s)=>{if(!s)router.replace('/')})
    return()=>l.subscription.unsubscribe()
  },[router])

  useEffect(()=>{if(!userProfile)return;setTimeout(()=>addBot(`Olá, ${userProfile.nome}! 👋\n\nSou o assistente comercial da Vivanexa.\nPara começar, informe o **CPF ou CNPJ** do cliente:`),300)},[userProfile])

  useEffect(()=>{
    if(!timerDeadline)return
    const iv=setInterval(()=>{
      const diff=timerDeadline-new Date()
      if(diff<=0){setTimerVal('EXPIRADO');clearInterval(iv);return}
      const hh=Math.floor(diff/3600000),mm=Math.floor((diff%3600000)/60000),ss=Math.floor((diff%60000)/1000)
      setTimerVal(`${String(hh).padStart(2,'0')}:${String(mm).padStart(2,'0')}:${String(ss).padStart(2,'0')}`)
    },1000)
    return()=>clearInterval(iv)
  },[timerDeadline])

  useEffect(()=>{if(msgRef.current)msgRef.current.scrollTop=msgRef.current.scrollHeight},[messages,thinking])

  async function loadCfg(id){
    try{
      const{data:emp}=await supabase.from('empresas').select('*').eq('id',id).single()
      const{data:vales}=await supabase.from('vales').select('*').eq('empresa_id',id)
      if(emp){
        const nc={...DEFAULT_CFG}
        if(emp.nome)nc.company=emp.nome;if(emp.slogan)nc.slogan=emp.slogan
        if(emp.disc_ad_pct!=null)nc.discAdPct=emp.disc_ad_pct;if(emp.disc_men_pct!=null)nc.discMenPct=emp.disc_men_pct
        if(emp.disc_close_pct!=null)nc.discClosePct=emp.disc_close_pct;if(emp.disc_mode)nc.discMode=emp.disc_mode
        if(vales?.length)nc.vouchers=vales.map(v=>({code:v.codigo,discAdPct:v.desc_ad_pct,discMenPct:v.desc_men_pct,event:v.evento}))
        setCfg(nc)
      }
    }catch(e){console.warn('cfg error',e)}
  }

  const addBot=(c,h=false)=>setMessages(p=>[...p,{role:'bot',content:c,isHTML:h,id:Date.now()+Math.random()}])
  const addUser=c=>setMessages(p=>[...p,{role:'user',content:c,isHTML:false,id:Date.now()+Math.random()}])
  const resetS=()=>Object.assign(S,{stage:'await_doc',doc:null,clientData:null,contactData:{},users:null,cnpjs:null,modules:[],plan:null,ifPlan:null,notas:null,quoteData:null,closingData:null,closingToday:false,appliedVoucher:null})

  async function processInput(t){
    const lo=t.toLowerCase()
    if(S.stage==='closed')return null
    if(['valeu','obrigado','obrigada','tchau'].some(w=>lo.includes(w))&&S.stage!=='await_doc'){S.stage='closed';return{h:false,c:'Perfeito! Boas vendas! 🚀'}}

    if(S.stage==='await_doc'){
      const doc=clean(t);if(!isCNPJ(doc)&&!isCPF(doc))return{h:false,c:'Por favor, informe o CPF ou CNPJ (somente números).'}
      S.doc=doc
      if(isCNPJ(doc)){setThinking(true);const cd=await fetchCNPJ(doc);setThinking(false)
        if(cd){S.clientData=cd;S.stage='await_users';return{h:true,c:rClientCard(cd)+`<div style="margin-top:10px;font-size:14px;color:var(--muted)">✅ Empresa encontrada!<br><br>Quantos <strong style="color:var(--text)">usuários</strong> o cliente possui?</div>`}}
      }
      S.clientData={nome:isCPF(doc)?'Cliente PF':'Empresa',fantasia:'',cnpj:doc,tipo:isCPF(doc)?'PF':'PJ'}
      S.stage='await_users';return{h:false,c:(isCNPJ(doc)?`⚠️ CNPJ ${fmtDoc(doc)} não localizado.\n`:'')+`Quantos usuários o cliente possui?`}
    }
    if(S.stage==='await_users'){const u=parseInt(t.match(/\d+/)?.[0]);if(!u||u<1)return{h:false,c:'Quantos usuários? (número)'}
      S.users=u;S.stage='await_modules';return{h:false,c:`👥 ${u} usuário${u>1?'s':''} registrado${u>1?'s':''}!\n\nQuais módulos?\n(${pn('Gestão Fiscal',cfg)} · ${pn('BIA',cfg)} · ${pn('CND',cfg)} · ${pn('XML',cfg)} · ${pn('IF',cfg)} · ${pn('EP',cfg)} · Tributos)`}}
    if(S.stage==='await_if_plan'){const p=parseIFPlan(t,cfg.plans);if(!p)return{h:false,c:`Informe o plano ${pn('IF',cfg)}:\n(${cfg.plans.map(x=>x.name).join(', ')})`};S.ifPlan=p;S.stage='await_modules';return checkCalc()}
    if(S.stage==='await_notas'){const n=parseInt(t);if(!n||n<1)return{h:false,c:'Quantas notas fiscais por mês?'};S.notas=n;S.stage='await_modules';return checkCalc()}

    const mods=parseMods(t,cfg);for(const m of mods)if(!S.modules.includes(m))S.modules.push(m)
    const nCNPJ=S.modules.length===0||S.modules.some(m=>!IF_NO_CNPJ.includes(m))
    if(nCNPJ){const n=parseInt(t.match(/\b(\d+)\s*(cnpj[s]?)?\b/i)?.[1]);if(n&&!S.cnpjs)S.cnpjs=n}
    return checkCalc()
  }

  function checkCalc(){
    if(S.modules.length===0)return{h:false,c:`Quais módulos?\n(${pn('Gestão Fiscal',cfg)} · ${pn('BIA',cfg)} · ${pn('CND',cfg)} · ${pn('XML',cfg)} · ${pn('IF',cfg)} · ${pn('EP',cfg)} · Tributos)`}
    if(S.modules.includes('EP')&&!S.modules.includes('Gestão Fiscal')){S.modules=S.modules.filter(m=>m!=='EP');return{h:false,c:`⚠️ ${pn('EP',cfg)} exige ${pn('Gestão Fiscal',cfg)}.`}}
    if(S.modules.includes('IF')&&!S.ifPlan){S.stage='await_if_plan';return{h:false,c:`Qual o plano de ${pn('IF',cfg)}?\n(${cfg.plans.map(p=>p.name).join(', ')})`}}
    if(S.modules.includes('Tributos')&&!S.notas){S.stage='await_notas';return{h:false,c:'Quantas notas fiscais por mês?'}}
    const nCNPJ=S.modules.some(m=>!IF_NO_CNPJ.includes(m))
    if(nCNPJ&&!S.cnpjs)return{h:false,c:'Quantos CNPJs o cliente possui?'}
    S.plan=nCNPJ?getPlan(S.cnpjs,cfg.plans):'basic'
    S.quoteData=calcFull(S.modules,S.plan,S.ifPlan,S.cnpjs,S.notas,cfg)
    S.stage='full_quoted'
    return{h:true,c:rFull(S.quoteData)}
  }

  async function send(text){
    const txt=(text||input).trim();if(!txt)return
    setInput('');addUser(txt);setChips([])
    setThinking(true);const resp=await processInput(txt);setThinking(false)
    if(resp)addBot(resp.c,resp.h)
    if(S.stage==='await_modules')setChips([`${pn('Gestão Fiscal',cfg)} + ${pn('BIA',cfg)}`,`${pn('BIA',cfg)} + ${pn('CND',cfg)} + ${pn('XML',cfg)}`,`${pn('Gestão Fiscal',cfg)} + ${pn('EP',cfg)}`,pn('IF',cfg)])
  }

  useEffect(()=>{
    window.vx_disc=(yes)=>{
      const dates=getNextDates(),cn=S.clientData?.fantasia||S.clientData?.nome||fmtDoc(S.doc||'')
      if(yes){S.stage='discounted';S.quoteData=calcDisc(S.modules,S.plan,S.ifPlan,S.cnpjs,S.notas,cfg);addUser('✅ Sim, quero ver!');addBot(rDisc(S.quoteData,dates,cn),true)}
      else{S.stage='closed';addUser('Não, obrigado');addBot('Sem problemas! 😊');setTimeout(()=>addBot(`<button class="reset-btn" onclick="window.vx_reset()">🔄 Iniciar nova consulta</button>`,true),400)}
      setChips([])
    }
    window.vx_close=(yes)=>{
      if(yes){const d=calcClose(S.modules,S.plan,S.ifPlan,S.cnpjs,S.notas,cfg);S.closingData=d;S.closingToday=true;S.stage='closing';addUser('✅ Sim, fechar hoje!');const dl=new Date();dl.setHours(18,0,0,0);setTimerDeadline(dl);addBot(rClose(d),true)}
      else{S.stage='discounted';addUser('Não por agora');addBot('Entendido! Valores com desconto padrão permanecem válidos.');setTimeout(()=>addBot(`<button class="reset-btn" onclick="window.vx_reset()">🔄 Iniciar nova consulta</button>`,true),400)}
      setChips([])
    }
    window.vx_reset=()=>{resetS();setChips([]);addBot('🔄 Nova consulta!\n\nInforme o CPF ou CNPJ do próximo cliente:')}
    window.vx_prop=()=>{const cd=S.clientData||{};setCf(f=>({...f,empresa:cd.fantasia||cd.nome||'',razao:cd.nome||'',email:cd.email||'',telefone:cd.telefone||'',cidade:cd.municipio||'',uf:cd.uf||''}));setClientMode('proposta');setShowClient(true)}
    window.vx_cont=()=>{const cd=S.clientData||{};setCf(f=>({...f,empresa:cd.fantasia||cd.nome||'',razao:cd.nome||'',email:cd.email||'',telefone:cd.telefone||'',cidade:cd.municipio||'',uf:cd.uf||''}));setClientMode('contrato');setShowClient(true)}
  },[cfg])

  function saveClient(){
    S.contactData={empresa:cf.empresa,razao:cf.razao,contato:cf.contato,email:cf.email,telefone:cf.telefone,cidade:cf.cidade,uf:cf.uf,cpfContato:cf.cpfContato,regime:cf.regime,rimpNome:cf.rimpNome,rimpEmail:cf.rimpEmail,rimpTel:cf.rimpTel,rfinNome:cf.rfinNome,rfinEmail:cf.rfinEmail,rfinTel:cf.rfinTel}
    setShowClient(false)
    if(clientMode==='proposta'){openPrint(buildProposal(S,cfg,userProfile),'Proposta Comercial')}
    else{
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
      openPrint(buildContract(S,cfg,userProfile,wizTAd,wizTMen,wizAd,wizMen,wizPay),'Contrato')
    }
  }

  const dates=getNextDates()

  // ── render helpers HTML ───────────────────────────────────
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
    h+=`<div class="teaser-card"><div class="teaser-title">🎫 Há licenças com desconto disponíveis!</div><div class="teaser-body">Temos condições especiais para novos clientes. Deseja ver os valores com desconto?</div><div class="yn-row"><button class="yn-btn yes" onclick="window.vx_disc(true)">✅ Sim, quero ver!</button><button class="yn-btn no" onclick="window.vx_disc(false)">Não, obrigado</button></div></div>`
    h+=`<div class="section-label">Próximos vencimentos</div><div class="dates-box">${dates.map(d=>`<span class="date-chip">${d}</span>`).join('')}</div>`
    return h
  }
  function rDisc(data,dates,cn){
    const{results,tAd,tMen,tAdD,tMenD}=data;let h=''
    for(const r of results){h+=`<div class="price-card"><h4>🔹 ${r.name}</h4>${!r.isTributos&&!r.isEP?`<div class="price-row"><span class="label">Adesão</span><span class="val">${fmt(r.ad)}</span></div>`:''}<div class="price-row"><span class="label">Mensalidade</span><span class="val">${fmt(r.men)}</span></div><hr class="section-divider">${!r.isTributos&&!r.isEP?`<div class="price-row"><span class="label">Adesão de Tabela</span><span class="val discount">${fmt(r.adD)}</span></div>`:''}<div class="price-row"><span class="label">Mensalidade c/ desconto</span><span class="val discount">${fmt(r.menD)}</span></div></div>`}
    h+=`<div class="price-card" style="border-color:rgba(0,212,255,.25)"><h4>🔸 Total</h4><div class="price-row"><span class="label">Adesão total</span><span class="val">${fmt(tAd)}</span></div><div class="price-row"><span class="label">Mensalidade total</span><span class="val">${fmt(tMen)}</span></div><hr class="section-divider"><div class="price-row"><span class="label">Adesão de Tabela</span><span class="val discount">${fmt(tAdD)}</span></div><div class="price-row"><span class="label">Mensalidade de Tabela</span><span class="val discount">${fmt(tMenD)}</span></div>${cfg.unlimitedStrategy?`<div style="margin-top:8px"><span class="unlimited-badge">♾ Usuários Ilimitados</span></div>`:''}</div>`
    h+=`<div class="opp-banner"><div class="opp-title">🔥 Oportunidade de Negociação</div><div class="opp-body"><strong style="color:var(--gold)">${cn}</strong> pode fechar agora:<br>• Adesão com <strong style="color:var(--gold)">${cfg.discClosePct||40}% OFF</strong><br>• Mensalidade por CNPJ ativo<br>${cfg.unlimitedStrategy?'• <span class="unlimited-badge" style="display:inline-flex;font-size:12px">♾ Usuários Ilimitados</span><br>':''}<br>Oferta válida até as <strong style="color:var(--gold)">18h de hoje</strong>.</div><div class="yn-row"><button class="yn-btn yes" onclick="window.vx_close(true)">✅ Sim, fechar hoje!</button><button class="yn-btn no" onclick="window.vx_close(false)">Não por agora</button></div></div>`
    h+=`<div class="section-label">Próximos vencimentos</div><div class="dates-box">${dates.map(d=>`<span class="date-chip">${d}</span>`).join('')}</div>`
    return h
  }
  function rClose(data){
    const{results,tAd,tMen}=data;let h=''
    for(const r of results){h+=`<div class="price-card"><h4>🔹 ${r.name}</h4>${!r.isTributos&&!r.isEP?`<div class="price-row"><span class="label">Adesão (fechamento)</span><span class="val closing">${fmt(r.ad)}</span></div>`:''}<div class="price-row"><span class="label">Mensalidade</span><span class="val closing">${fmt(r.men)}</span></div></div>`}
    h+=`<div class="price-card" style="border-color:rgba(251,191,36,.3)"><h4 style="color:var(--gold)">🔸 Total – Fechamento</h4><div class="price-row"><span class="label">Adesão total</span><span class="val closing">${fmt(tAd)}</span></div><div class="price-row"><span class="label">Mensalidade total</span><span class="val closing">${fmt(tMen)}</span></div>${cfg.unlimitedStrategy?`<div style="margin-top:8px"><span class="unlimited-badge">♾ Usuários Ilimitados</span></div>`:''}</div>`
    h+=`<div class="section-label">Próximos vencimentos</div><div class="dates-box">${dates.map(d=>`<span class="date-chip">${d}</span>`).join('')}</div>`
    h+=`<div style="display:flex;flex-direction:column;gap:8px;margin-top:10px">
      <button class="prop-btn" onclick="window.vx_prop()">📄 Gerar Proposta Comercial</button>
      <button class="prop-btn" style="background:linear-gradient(135deg,rgba(251,191,36,.2),rgba(251,191,36,.08));border-color:rgba(251,191,36,.4);color:var(--gold)" onclick="window.vx_cont()">📝 Gerar Contrato</button>
      <button class="reset-btn" onclick="window.vx_reset()">🔄 Encerrar e iniciar nova consulta</button>
    </div>`
    return h
  }

  const wizDates=getNextDates()

  if(!userProfile)return<div style={{background:'#0a0f1e',minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center',color:'#64748b',fontFamily:'DM Mono, monospace'}}>Carregando...</div>

  return(<>
    <Head>
      <title>{cfg.company} – Assistente Comercial</title>
      <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
      <link href="https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=DM+Mono:wght@300;400;500&family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet"/>
    </Head>
    <style>{CSS}</style>
    <div className="orb orb1"/><div className="orb orb2"/>

    <header>
      <div className="header-logo"><img src="/logo.png" alt={cfg.company} onError={e=>e.target.style.display='none'}/></div>
      <div className="header-text"><h1>{cfg.company}</h1><p>{cfg.slogan}</p></div>
      <div className="status-dot">online</div>
      <div className="header-user"><span>{userProfile.nome}</span></div>
      <button className="logout-btn" onClick={async()=>{await supabase.auth.signOut();router.replace('/')}}>Sair</button>
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
        {timerVal&&<div className="timer-live">{timerVal}</div>}
      </div>
      {chips.length>0&&<div id="chips">{chips.map((c,i)=><button key={i} className="chip" onClick={()=>send(c)}>{c}</button>)}</div>}
      <div id="inputArea">
        <textarea ref={inputRef} id="userInput" placeholder="Digite CPF, CNPJ, módulos..." value={input}
          onChange={e=>{setInput(e.target.value);e.target.style.height='auto';e.target.style.height=Math.min(e.target.scrollHeight,100)+'px'}}
          onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();send()}}} rows={1}/>
        <button className="send-btn" onClick={()=>send()}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
        </button>
      </div>
    </div>

    {/* MODAL DADOS DO CLIENTE */}
    {showClient&&(
      <div className="modal-overlay">
        <div className="modal-box">
          <div className="modal-header">
            <h3>{clientMode==='proposta'?'📄 Dados para Proposta':'📝 Dados para Contrato'}</h3>
            <button className="modal-close" onClick={()=>setShowClient(false)}>✕</button>
          </div>
          <div className="modal-body">
            <div className="modal-sec">DADOS DO CLIENTE</div>
            <div className="modal-grid2">
              {[['Empresa','empresa'],['Razão Social','razao'],['Nome do Contato','contato'],['E-mail','email'],['Telefone','telefone'],['Cidade','cidade'],['Estado','uf'],['CPF do Contato','cpfContato'],['Regime Tributário','regime']].map(([l,k])=>(
                <div key={k} className="field"><label>{l}</label><input value={cf[k]||''} onChange={e=>setCf(f=>({...f,[k]:e.target.value}))}/></div>
              ))}
            </div>
            {clientMode==='contrato'&&<>
              <div className="modal-sec" style={{marginTop:16}}>RESPONSÁVEL PELA IMPLEMENTAÇÃO</div>
              <div className="modal-grid3">{[['Nome','rimpNome'],['E-mail','rimpEmail'],['Telefone','rimpTel']].map(([l,k])=><div key={k} className="field"><label>{l}</label><input value={cf[k]||''} onChange={e=>setCf(f=>({...f,[k]:e.target.value}))}/></div>)}</div>
              <div className="modal-sec" style={{marginTop:16}}>RESPONSÁVEL PELO FINANCEIRO</div>
              <div className="modal-grid3">{[['Nome','rfinNome'],['E-mail','rfinEmail'],['Telefone','rfinTel']].map(([l,k])=><div key={k} className="field"><label>{l}</label><input value={cf[k]||''} onChange={e=>setCf(f=>({...f,[k]:e.target.value}))}/></div>)}</div>
            </>}
          </div>
          <div className="modal-footer">
            <button className="btn-cancel" onClick={()=>setShowClient(false)}>Cancelar</button>
            <button className="btn-primary" onClick={saveClient}>{clientMode==='proposta'?'📄 Gerar Proposta':'📝 Avançar'}</button>
          </div>
        </div>
      </div>
    )}

    {/* WIZARD DE CONTRATO */}
    {showWiz&&(
      <div className="modal-overlay">
        <div className="modal-box" style={{maxWidth:680}}>
          <div className="modal-header">
            <h3>📝 Configurar Contrato</h3>
            <div style={{fontSize:12,color:'var(--muted)',marginTop:2}}>Preencha os dados de pagamento antes de gerar</div>
          </div>
          <div className="modal-body">
            {wizStep===1&&<>
              <div className="wiz-title">💳 Condição de Pagamento da Adesão</div>
              <div style={{fontSize:13,color:'var(--muted)',marginBottom:12}}>Valor da Adesão: <strong style={{color:'var(--text)'}}>{fmt(wizTAd)}</strong></div>
              <div className="wiz-sec">PAGAMENTO À VISTA</div>
              <div className={`pay-opt${wizPay==='pix'?' sel':''}`} onClick={()=>setWizPay('pix')}>
                <span>🏦</span><div style={{flex:1}}><div className="po-t">PIX ou Boleto à vista</div><div className="po-s">Pagamento único, sem taxa adicional</div></div>
                <div className="po-v">{fmt(wizTAd)}</div>
              </div>
              <div className="wiz-sec" style={{marginTop:14}}>CARTÃO DE CRÉDITO — SEM JUROS</div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>
                {Array.from({length:10},(_,i)=>i+1).map(n=>(
                  <div key={n} className={`pay-opt sm${wizPay===`cartao${n}x`?' sel':''}`} onClick={()=>setWizPay(`cartao${n}x`)}>
                    <span style={{fontSize:14}}>💳</span><div style={{flex:1}}><div className="po-t">{n}× sem juros</div><div className="po-s">no cartão</div></div>
                    <div className="po-v" style={{fontSize:12}}>{fmt(wizTAd/n)}/mês</div>
                  </div>
                ))}
              </div>
              <div className="wiz-sec" style={{marginTop:14}}>BOLETO PARCELADO — SEM JUROS</div>
              {[{n:2,desc:`Entrada ${fmt(wizTAd*0.5)} + ${fmt(wizTAd*0.5)} em 30 dias`},{n:3,desc:`Entrada ${fmt(wizTAd*0.5)} + ${fmt(wizTAd*0.25)} em 30 dias + ${fmt(wizTAd*0.25)} em 60 dias`}].map(o=>(
                <div key={o.n} className={`pay-opt${wizPay===`boleto${o.n}x`?' sel':''}`} onClick={()=>setWizPay(`boleto${o.n}x`)} style={{marginBottom:8}}>
                  <span>📄</span><div style={{flex:1}}><div className="po-t">{o.n}× sem juros no Boleto</div><div className="po-s">{o.desc}</div></div>
                  <div className="po-v">{fmt(wizTAd/o.n)}/parc.</div>
                </div>
              ))}
            </>}

            {wizStep===2&&<>
              <div className="wiz-title">📅 Datas de Vencimento</div>
              {wizTAd>0&&<>
                <div style={{fontSize:13,color:'var(--muted)',margin:'12px 0 8px'}}>Adesão: <strong style={{color:'var(--text)'}}>{fmt(wizTAd)}</strong></div>
                <div style={{fontSize:12,color:'var(--muted)',marginBottom:6}}>Vencimento da Adesão *</div>
                <div style={{display:'flex',gap:8,flexWrap:'wrap',marginBottom:8}}>{wizDates.map(d=><button key={d} className={`date-pill${wizAd===d?' chosen':''}`} onClick={()=>setWizAd(d)}>{d}</button>)}</div>
                <input className="date-inp" placeholder="Outra data (DD/MM)" value={wizAd&&!wizDates.includes(wizAd)?wizAd:''} onChange={e=>setWizAd(e.target.value)} style={{marginBottom:16}}/>
              </>}
              <div style={{fontSize:13,color:'var(--muted)',margin:'4px 0 8px'}}>1ª Mensalidade: <strong style={{color:'var(--text)'}}>{fmt(wizTMen)}/mês</strong></div>
              <div style={{fontSize:12,color:'var(--muted)',marginBottom:6}}>Vencimento da 1ª Mensalidade *</div>
              <div style={{display:'flex',gap:8,flexWrap:'wrap',marginBottom:8}}>{wizDates.map(d=><button key={d} className={`date-pill${wizMen===d?' chosen':''}`} onClick={()=>setWizMen(d)}>{d}</button>)}</div>
              <input className="date-inp" placeholder="Outra data (DD/MM)" value={wizMen&&!wizDates.includes(wizMen)?wizMen:''} onChange={e=>setWizMen(e.target.value)}/>
            </>}
          </div>
          <div className="modal-footer">
            {wizStep===2&&<button className="btn-cancel" onClick={()=>setWizStep(1)}>← Voltar</button>}
            <button className="btn-cancel" onClick={()=>setShowWiz(false)}>Cancelar</button>
            <button className="btn-primary" onClick={wizNext}>{wizStep===1?'Próximo →':'Gerar Contrato →'}</button>
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
  header{position:relative;z-index:10;width:100%;max-width:820px;padding:18px 20px 0;display:flex;align-items:center;gap:12px;flex-wrap:wrap}
  .header-logo img{height:44px;width:44px;object-fit:contain;border-radius:10px;flex-shrink:0}
  .header-text h1{font-family:'Syne',sans-serif;font-size:17px;font-weight:700;letter-spacing:.5px}
  .header-text p{font-size:11px;color:var(--muted);margin-top:2px}
  .status-dot{margin-left:auto;display:flex;align-items:center;gap:6px;font-size:11px;color:var(--accent3)}
  .status-dot::before{content:'';width:7px;height:7px;background:var(--accent3);border-radius:50%;animation:pulse 2s infinite}
  @keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}
  .header-user{font-size:11px;color:var(--muted)}.header-user span{color:var(--text);font-weight:500}
  .logout-btn{background:none;border:none;cursor:pointer;color:var(--muted);font-size:11px;padding:5px 9px;border-radius:8px;font-family:'DM Mono',monospace;transition:all .2s}
  .logout-btn:hover{color:var(--danger);background:rgba(239,68,68,.08)}
  .chat-wrap{position:relative;z-index:10;width:100%;max-width:820px;padding:14px 20px 0;flex:1;display:flex;flex-direction:column}
  #messages{display:flex;flex-direction:column;gap:14px;padding-bottom:20px;min-height:400px;max-height:calc(100vh - 230px);overflow-y:auto;scroll-behavior:smooth}
  #messages::-webkit-scrollbar{width:4px}#messages::-webkit-scrollbar-thumb{background:var(--border);border-radius:4px}
  .msg{display:flex;flex-direction:column;max-width:92%;animation:fadeUp .3s ease}
  @keyframes fadeUp{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}
  .msg.user{align-self:flex-end;align-items:flex-end}.msg.bot{align-self:flex-start;align-items:flex-start}
  .bubble{padding:13px 17px;border-radius:14px;font-size:15px;line-height:1.65;white-space:pre-wrap;word-break:break-word}
  .msg.user .bubble{background:var(--user-bubble);border:1px solid rgba(0,212,255,.15);border-bottom-right-radius:4px}
  .msg.bot .bubble{background:var(--bot-bubble);border:1px solid var(--border);border-bottom-left-radius:4px}
  .msg-label{font-size:11px;color:var(--muted);margin-bottom:4px;letter-spacing:.5px}
  .thinking{display:flex;gap:5px;padding:14px 18px;background:var(--bot-bubble);border:1px solid var(--border);border-radius:14px;border-bottom-left-radius:4px}
  .thinking span{width:8px;height:8px;background:var(--muted);border-radius:50%;animation:bounce 1.2s infinite}
  .thinking span:nth-child(2){animation-delay:.2s}.thinking span:nth-child(3){animation-delay:.4s}
  @keyframes bounce{0%,80%,100%{transform:translateY(0)}40%{transform:translateY(-6px)}}
  .price-card{background:var(--card-bg);border:1px solid var(--border);border-radius:12px;padding:15px 18px;margin:4px 0;font-size:15px}
  .price-card h4{font-family:'Syne',sans-serif;font-size:15px;font-weight:700;color:var(--accent);margin-bottom:10px;letter-spacing:.5px;display:flex;align-items:center;gap:6px;flex-wrap:wrap}
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
  .yn-btn:hover{transform:translateY(-1px);filter:brightness(1.1)}
  .opp-banner{background:linear-gradient(135deg,rgba(251,191,36,.12),rgba(251,191,36,.04));border:1px solid rgba(251,191,36,.3);border-radius:12px;padding:16px 18px;margin:8px 0}
  .opp-title{font-family:'Syne',sans-serif;font-size:15px;font-weight:700;color:var(--gold);margin-bottom:10px}
  .opp-body{font-size:13px;color:var(--muted);line-height:1.7;margin-bottom:12px}
  .section-label{font-size:11px;color:var(--muted);letter-spacing:1px;text-transform:uppercase;margin:12px 0 6px}
  .dates-box{display:flex;gap:8px;flex-wrap:wrap}
  .date-chip{background:var(--surface2);border:1px solid var(--border);border-radius:8px;padding:5px 12px;font-size:13px;color:var(--text)}
  .prop-btn{width:100%;padding:12px;border-radius:10px;background:linear-gradient(135deg,rgba(0,212,255,.15),rgba(0,212,255,.05));border:1px solid rgba(0,212,255,.3);color:var(--accent);font-family:'DM Mono',monospace;font-size:13px;font-weight:600;cursor:pointer;transition:all .2s;text-align:left;margin-bottom:4px}
  .prop-btn:hover{background:linear-gradient(135deg,rgba(0,212,255,.25),rgba(0,212,255,.1));transform:translateY(-1px)}
  .reset-btn{width:100%;padding:10px;border-radius:10px;background:rgba(100,116,139,.1);border:1px solid var(--border);color:var(--muted);font-family:'DM Mono',monospace;font-size:12px;cursor:pointer;transition:all .2s;margin-top:4px}
  .reset-btn:hover{color:var(--text);border-color:var(--muted)}
  .timer-live{text-align:center;font-size:28px;font-weight:700;font-family:'Syne',sans-serif;color:var(--gold);letter-spacing:3px;padding:10px;background:rgba(251,191,36,.08);border:1px solid rgba(251,191,36,.25);border-radius:10px;margin:8px 0}
  #chips{display:flex;gap:8px;flex-wrap:wrap;padding:8px 0 4px}
  .chip{background:var(--surface2);border:1px solid var(--border);border-radius:8px;padding:6px 12px;font-family:'DM Mono',monospace;font-size:12px;color:var(--muted);cursor:pointer;transition:all .2s}
  .chip:hover{color:var(--accent);border-color:var(--accent);background:rgba(0,212,255,.08)}
  #inputArea{display:flex;gap:10px;align-items:flex-end;padding:14px 0 20px}
  #userInput{flex:1;background:var(--surface);border:1px solid var(--border);border-radius:14px;padding:12px 16px;font-family:'DM Mono',monospace;font-size:15px;color:var(--text);outline:none;resize:none;line-height:1.5;transition:border-color .2s;min-height:48px}
  #userInput:focus{border-color:var(--accent);box-shadow:0 0 0 3px rgba(0,212,255,.08)}
  #userInput::placeholder{color:var(--muted)}
  .send-btn{width:48px;height:48px;border-radius:12px;background:linear-gradient(135deg,var(--accent),#0099bb);border:none;color:#fff;cursor:pointer;display:flex;align-items:center;justify-content:center;flex-shrink:0;transition:all .2s}
  .send-btn:hover{box-shadow:0 0 16px rgba(0,212,255,.4);transform:translateY(-1px)}
  /* MODAIS */
  .modal-overlay{position:fixed;inset:0;background:rgba(0,0,0,.75);z-index:6000;display:flex;align-items:center;justify-content:center;padding:20px;overflow-y:auto}
  .modal-box{background:var(--surface);border:1px solid var(--border);border-radius:16px;width:100%;max-width:560px;box-shadow:var(--shadow);display:flex;flex-direction:column;max-height:90vh;position:relative}
  .modal-header{padding:20px 24px 0;flex-shrink:0}
  .modal-header h3{font-family:'Syne',sans-serif;font-size:16px;font-weight:700;color:var(--accent)}
  .modal-close{position:absolute;top:16px;right:20px;background:none;border:none;color:var(--muted);font-size:20px;cursor:pointer}
  .modal-close:hover{color:var(--text)}
  .modal-body{padding:20px 24px;overflow-y:auto;flex:1}
  .modal-sec{font-size:10px;color:var(--muted);letter-spacing:1.5px;text-transform:uppercase;margin-bottom:12px;margin-top:4px}
  .modal-grid2{display:grid;grid-template-columns:1fr 1fr;gap:12px}
  .modal-grid3{display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px}
  .field label{font-size:11px;color:var(--muted);display:block;margin-bottom:4px;letter-spacing:.5px}
  .field input{width:100%;background:var(--surface2);border:1px solid var(--border);border-radius:8px;padding:9px 12px;font-family:'DM Mono',monospace;font-size:13px;color:var(--text);outline:none;transition:border-color .2s}
  .field input:focus{border-color:var(--accent)}
  .modal-footer{padding:16px 24px;border-top:1px solid var(--border);display:flex;gap:10px;justify-content:flex-end;flex-shrink:0}
  .btn-cancel{padding:10px 18px;border-radius:10px;background:rgba(100,116,139,.12);border:1px solid var(--border);color:var(--muted);font-family:'DM Mono',monospace;font-size:13px;cursor:pointer}
  .btn-primary{padding:10px 22px;border-radius:10px;background:linear-gradient(135deg,var(--accent),#0099bb);border:none;color:#fff;font-family:'DM Mono',monospace;font-size:13px;font-weight:600;cursor:pointer;transition:all .2s}
  .btn-primary:hover{box-shadow:0 0 16px rgba(0,212,255,.4);transform:translateY(-1px)}
  /* WIZARD */
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
