// pages/chat.js — Assistente Comercial Vivanexa SaaS v3
// ============================================================
// CORREÇÕES v3:
// 1. Logo exibida no header (do cfg.logob64 + fallback nome)
// 2. Contrato no modelo Fiscontech (Termo de Pedido)
// 3. Histórico salvo no Supabase (docHistory + doc:token)
// 4. Modal enviar para assinatura: WhatsApp / Email / Assinar agora
// 5. Modal de cliente completo: CEP busca, Endereço, Bairro, Regime
// 6. Timer reseta ao iniciar nova consulta
// 7. Texto proposta: "em até 10× sem juros"
// 8. Modo voucher pede código antes de calcular
// 9. Adicionado painel de assinaturas pendentes e histórico de documentos
// ============================================================

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/router'
import Head from 'next/head'
import { supabase } from '../lib/supabase'

const DEFAULT_CFG = {
  company:'VIVANEXA', slogan:'Assistente Comercial de Preços',
  discMode:'screen', discAdPct:50, discMenPct:0, discClosePct:40, unlimitedStrategy:true,
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
  productNames:{'Gestão Fiscal':'Gestão Fiscal','CND':'CND','XML':'XML','BIA':'BIA','IF':'Inteligência Fiscal','EP':'e-PROCESSOS','Tributos':'Tributos'},
}
const IF_NO_CNPJ=['IF','Tributos','EP']

// ── Utilitários ──────────────────────────────────────────────
const fmt  = n => 'R$ ' + Number(n||0).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2})
const clean = s => s.replace(/\D/g,'')
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
function calcDisc(mods,plan,ifPlan,cnpjs,notas,cfg,voucherOverride){
  const adPct =voucherOverride?voucherOverride.discAdPct :(cfg.discAdPct ||50)
  const menPct=voucherOverride?voucherOverride.discMenPct:(cfg.discMenPct||0)
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
async function fetchCEP(cep){
  try{
    const r=await fetch(`https://brasilapi.com.br/api/cep/v1/${cep.replace(/\D/g,'')}`);if(!r.ok)return null
    const d=await r.json()
    return{logradouro:d.street||'',bairro:d.neighborhood||'',municipio:d.city||'',uf:d.state||'',cep:d.cep||cep}
  }catch{return null}
}

// ── Construir HTML da Proposta ────────────────────────────────
function buildProposal(S,cfg,user){
  const isC=S.closingToday===true,cd=S.clientData||{},co=S.contactData||{}
  const today=new Date().toLocaleDateString('pt-BR')
  const tAd =isC?S.closingData?.tAd :(S.quoteData?.tAdD||0)
  const tMen=isC?S.closingData?.tMen:(S.quoteData?.tMenD||0)
  const results=isC?S.closingData?.results:S.quoteData?.results
  const dates=getNextDates()
  const rows=(results||[]).map(r=>{
    const adS=(r.isTributos||r.isEP)?'—':fmt(isC?r.ad:r.adD)
    return`<tr><td style="padding:10px 14px"><div style="font-weight:600;color:#0f172a">${r.name}</div>${r.plan?`<div style="font-size:11px;color:#64748b">Plano ${getPlanLabel(r.plan,cfg.plans)}</div>`:''}</td><td style="padding:10px 14px;text-align:center">${adS}</td><td style="padding:10px 14px;text-align:center">${fmt(isC?r.men:(r.menD||r.men))}</td></tr>`
  }).join('')
  const field=(l,v)=>`<div><label style="font-size:10px;color:#64748b;text-transform:uppercase;display:block;margin-bottom:4px">${l}</label><div style="border:1px solid #e2e8f0;border-radius:6px;padding:8px 10px;font-size:13px;color:#1e293b;min-height:34px">${v||'—'}</div></div>`
  const sec=(t)=>`<div style="font-family:Syne,sans-serif;font-size:14px;font-weight:700;color:#0f172a;margin:0 0 13px;padding-bottom:8px;border-bottom:2px solid #e2e8f0;display:flex;align-items:center;gap:8px"><div style="width:8px;height:8px;background:#00d4ff;border-radius:50%;flex-shrink:0"></div>${t}</div>`
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
        <div style="border:2px solid #00d4ff;border-radius:10px;padding:14px;text-align:center"><div style="font-size:22px;margin-bottom:6px">💳</div><div style="font-size:11px;font-weight:700;color:#0f172a;text-transform:uppercase;margin-bottom:6px">Cartão de Crédito</div><div style="font-size:12px;color:#10b981;font-weight:600">em até 10× sem juros</div><div style="font-size:11px;color:#64748b;margin-top:4px">${fmt(tAd/10)} / mês</div></div>
        <div style="border:1px solid #e2e8f0;border-radius:10px;padding:14px;text-align:center"><div style="font-size:22px;margin-bottom:6px">🏦</div><div style="font-size:11px;font-weight:700;color:#0f172a;text-transform:uppercase;margin-bottom:6px">Boleto / PIX</div><div style="font-size:12px;color:#10b981;font-weight:600">${fmt(tAd)}</div><div style="font-size:11px;color:#64748b;margin-top:4px">à vista</div></div>
        <div style="border:1px solid #e2e8f0;border-radius:10px;padding:14px;text-align:center"><div style="font-size:22px;margin-bottom:6px">📄</div><div style="font-size:11px;font-weight:700;color:#0f172a;text-transform:uppercase;margin-bottom:6px">Boleto Parcelado</div><div style="font-size:12px;color:#10b981;font-weight:600">${fmt(tAd*0.5)} entrada</div><div style="font-size:11px;color:#64748b;margin-top:4px">+ ${fmt(tAd*0.25)} em 30/60 dias</div></div>
      </div>
    </div>
    ${sec('Seu Consultor')}
    <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:10px;padding:14px 18px;display:flex;align-items:flex-start;gap:12px">
      <div style="font-size:24px">👤</div>
      <div><div style="font-weight:700;font-size:14px;color:#14532d;margin-bottom:4px">${user?.nome||user?.email||'—'}</div><div style="font-size:12px;color:#166534">${user?.email?'📧 '+user.email:''}</div></div>
    </div>
  </div>
</div>`
}

// ── Construir HTML do Contrato (modelo Fiscontech) ────────────
function buildContract(S,cfg,user,tAd,tMen,dateAd,dateMen,payMethod){
  const cd=S.clientData||{},co=S.contactData||{}
  const today=new Date().toLocaleDateString('pt-BR')
  const isC=S.closingToday===true
  const results=isC?S.closingData?.results:S.quoteData?.results
  const payLabel=payMethod==='pix'?'PIX / Boleto à vista':
    payMethod?.startsWith('cartao')?`Cartão de Crédito em até ${payMethod.replace('cartao','').replace('x','×')} sem juros`:
    payMethod?.startsWith('boleto')?`Boleto Parcelado em ${payMethod.replace('boleto','').replace('x','×')} vezes`:payMethod

  const tableRows=(results||[]).map(r=>{
    const adS=(r.isTributos||r.isEP)?'—':fmt(isC?r.ad:(r.adD||0))
    return`<tr>
      <td style="padding:8px 12px;border:1px solid #e2e8f0;font-weight:500">${r.name}${r.plan?`<br><span style="font-size:11px;color:#64748b">Plano ${getPlanLabel(r.plan,cfg.plans)}</span>`:''}</td>
      <td style="padding:8px 12px;border:1px solid #e2e8f0;text-align:center">${adS}</td>
      <td style="padding:8px 12px;border:1px solid #e2e8f0;text-align:center">${S.cnpjs||'—'}</td>
      <td style="padding:8px 12px;border:1px solid #e2e8f0;text-align:center">${fmt(isC?r.men:(r.menD||r.men||0))}</td>
    </tr>`
  }).join('')

  const sec=(n,t)=>`<h3 style="font-family:Inter,sans-serif;font-size:14px;font-weight:700;color:#0f172a;margin:22px 0 10px;display:flex;align-items:center;gap:8px"><span style="width:8px;height:8px;background:#00d4ff;border-radius:50%;flex-shrink:0;display:inline-block"></span>${n} - ${t}</h3>`
  const row=(l,v)=>`<div style="margin-bottom:6px"><span style="font-size:12px;color:#64748b;min-width:120px;display:inline-block">${l}:</span><span style="font-size:13px;color:#1e293b;font-weight:500">${v||'—'}</span></div>`
  const endStr=[co.logradouro||cd.logradouro,co.bairro||cd.bairro,co.cidade||cd.municipio,co.uf||cd.uf].filter(Boolean).join(', ')

  return`<div style="background:#fff;font-family:Inter,sans-serif;color:#1e293b;max-width:820px;margin:0 auto;font-size:13px;line-height:1.7">
  <!-- CABEÇALHO -->
  <div style="background:linear-gradient(135deg,#0f172a,#1e293b);padding:28px 44px;display:flex;align-items:center;gap:20px">
    ${cfg.logob64?`<img src="${cfg.logob64}" style="height:52px;object-fit:contain">`:''}
    <div>
      <h1 style="font-family:Syne,sans-serif;font-size:18px;font-weight:800;color:#fff;margin-bottom:4px">Termo de Pedido e Registro de Software</h1>
      <p style="font-size:12px;color:#64748b">Seja bem-vindo ao ${cfg.company||'Vivanexa'}, é um prazer tê-lo como cliente.</p>
    </div>
  </div>
  <div style="padding:28px 44px">
    <div style="background:#f0f9ff;border:1px solid #bae6fd;border-radius:10px;padding:16px 20px;margin-bottom:20px;border-left:4px solid #00d4ff">
      <p style="font-size:13px;color:#0c4a6e;margin-bottom:6px">Segue abaixo os termos do pedido registrado com nosso time de vendas.</p>
      <p style="font-size:13px;color:#0c4a6e">Confira os dados abaixo com atenção e caso esteja tudo correto, basta <strong>ASSINAR</strong> esse pedido para darmos seguimento ao seu treinamento e implantação.</p>
    </div>

    ${sec('1','CONTRATADA')}
    <div style="background:#f8fafc;border-radius:8px;padding:14px 18px;margin-bottom:8px">
      ${row('Nome',cfg.company||'VIVANEXA')}
      ${row('CNPJ',cfg.cnpjEmpresa||'—')}
      ${row('Endereço',cfg.enderecoEmpresa||'—')}
      ${row('E-mail',cfg.emailEmpresa||'contato@vivanexa.com.br')}
      ${row('Responsável',user?.nome||'—')}
    </div>

    ${sec('2','CONTRATANTE')}
    <div style="background:#f8fafc;border-radius:8px;padding:14px 18px;margin-bottom:8px">
      ${row('Razão Social',co.razao||cd.nome||'')}
      ${row('CNPJ',fmtDoc(S.doc||''))}
      ${row('Endereço',endStr||'—')}
      ${row('E-mail',co.email||cd.email||'—')}
      ${row('Fone',co.telefone||cd.telefone||'—')}
      ${row('Contratante',co.contato||'—')}
      ${row('CPF',co.cpfContato||'—')}
      ${row('Regime Tributário',co.regime||'—')}
    </div>

    ${sec('3','RESPONSÁVEL PELA IMPLEMENTAÇÃO')}
    <div style="background:#f8fafc;border-radius:8px;padding:14px 18px;margin-bottom:8px">
      ${row('Nome',co.rimpNome||'—')}
      ${row('E-mail',co.rimpEmail||'—')}
      ${row('Telefone',co.rimpTel||'—')}
    </div>

    ${sec('4','RESPONSÁVEL PELO FINANCEIRO')}
    <div style="background:#f8fafc;border-radius:8px;padding:14px 18px;margin-bottom:8px">
      ${row('Nome',co.rfinNome||'—')}
      ${row('E-mail',co.rfinEmail||'—')}
      ${row('Telefone',co.rfinTel||'—')}
    </div>

    ${sec('5','PLANO CONTRATADO E VALORES')}
    <div style="margin-bottom:6px">${row('Validade','12 meses')}</div>
    <table style="width:100%;border-collapse:collapse;font-size:13px;margin:12px 0">
      <thead><tr style="background:#0f172a;color:#fff">
        <th style="padding:10px 12px;text-align:left;border:1px solid #334155">Nome do Produto</th>
        <th style="padding:10px 12px;text-align:center;border:1px solid #334155">Valor Adesão</th>
        <th style="padding:10px 12px;text-align:center;border:1px solid #334155">Qtd. CNPJs</th>
        <th style="padding:10px 12px;text-align:center;border:1px solid #334155">Mensalidade</th>
      </tr></thead>
      <tbody>${tableRows}</tbody>
    </table>
    <div style="background:#f8fafc;border-radius:8px;padding:12px 16px;margin-bottom:12px">
      ${row('Forma de Pagamento — Adesão',payLabel)}
      ${tAd>0?row('Vencimento da Adesão',dateAd||'—'):''}
      ${row('Vencimento 1ª Mensalidade',dateMen||'—')}
      <div style="display:flex;justify-content:space-between;padding-top:8px;border-top:1px solid #e2e8f0;margin-top:8px">
        <span style="font-weight:600">Total Adesão</span><span style="font-weight:700;color:#0f172a">${fmt(tAd)}</span>
      </div>
      <div style="display:flex;justify-content:space-between">
        <span style="font-weight:600">Total Mensalidade</span><span style="font-weight:700;color:#00d4ff">${fmt(tMen)}</span>
      </div>
    </div>

    <p style="font-size:12px;color:#475569;margin:8px 0">Nossa equipe de Sucesso do Cliente entrará em contato com você <strong>em até 72 horas</strong> após o contrato ser assinado. Horário de atendimento: 9h às 18h (Brasília).</p>

    <div style="background:#fefce8;border:1px solid #fde68a;border-radius:8px;padding:12px 16px;margin:16px 0;font-size:12px;color:#78350f">
      Dando o aceite, você concorda com nossos Termos e Condições de Uso e Política de Privacidade disponíveis em <strong>www.vivanexa.com.br/termos</strong>. A utilização do ${cfg.company||'Vivanexa'} indica que o Usuário/Cliente está ciente e concorda com todo o conteúdo constante deste Contrato.
    </div>

    <h3 style="font-family:Syne,sans-serif;font-size:13px;font-weight:700;color:#0f172a;margin:20px 0 10px">LIMITAÇÃO DE RESPONSABILIDADE</h3>
    <p style="font-size:11.5px;color:#64748b;margin-bottom:8px">O ${cfg.company||'Vivanexa'} é uma plataforma de automação de tarefas e processos fiscais e tributários, não se responsabilizando por pagamentos em duplicidade, pagamentos indevidos ou quaisquer perdas decorrentes do uso, mau uso, ou uso indevido dos seus produtos.</p>

    <h3 style="font-family:Syne,sans-serif;font-size:13px;font-weight:700;color:#0f172a;margin:20px 0 10px">DA VIGÊNCIA E DA RESCISÃO</h3>
    <p style="font-size:11.5px;color:#64748b;margin-bottom:8px">O presente CONTRATO terá vigência de 12 meses contados da data de assinatura e sua renovação será automática por mais 12 meses. Qualquer das partes poderá rescindir com notificação por escrito com antecedência mínima de 60 dias.</p>
    <p style="font-size:11.5px;color:#64748b;margin-bottom:20px">Em caso de inadimplência superior a 45 dias, a ${cfg.company||'Vivanexa'} poderá encaminhar dados para órgãos de proteção ao crédito (Serasa, SPC).</p>

    <!-- ASSINATURAS -->
    <div style="border-top:2px solid #e2e8f0;padding-top:24px;margin-top:24px">
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:40px">
        <div style="text-align:center">
          <div style="border-top:1px solid #0f172a;padding-top:8px;margin-top:60px">
            <div style="font-weight:600;font-size:13px">${cfg.company||'Vivanexa'}</div>
            <div style="font-size:11px;color:#64748b">CONTRATADA</div>
          </div>
        </div>
        <div style="text-align:center">
          <div style="border-top:1px solid #0f172a;padding-top:8px;margin-top:60px">
            <div style="font-weight:600;font-size:13px">${co.razao||cd.nome||'Cliente'}</div>
            <div style="font-size:11px;color:#64748b">CONTRATANTE</div>
          </div>
        </div>
      </div>
      <div style="text-align:center;margin-top:24px;font-size:11px;color:#94a3b8">${today} · Assinatura Eletrônica conforme Lei nº 14.063/2020</div>
    </div>
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
  .bp{background:#0f172a;color:#fff}.bc{background:#e2e8f0;color:#475569}.bs{background:linear-gradient(135deg,#10b981,#059669);color:#fff}
  @media print{.tb{display:none!important}}</style>
  </head><body>
  <div class="tb">
    <button class="bp" onclick="window.print()">🖨 Imprimir / Salvar PDF</button>
    <button class="bc" onclick="window.close()">✕ Fechar</button>
  </div>
  ${html}</body></html>`)
  win.document.close();win.focus()
}

// ══════════════════════════════════════════════════════════════
// COMPONENTES PARA HISTÓRICO E ASSINATURAS PENDENTES
// ══════════════════════════════════════════════════════════════

function ModalVer({ html, onClose }) {
  if (!html) return null
  return (
    <div className="modal-overlay" style={{ zIndex: 10000 }}>
      <div className="modal-box" style={{ maxWidth: '90vw', maxHeight: '90vh', overflow: 'auto' }}>
        <div className="modal-header">
          <h3>📄 Visualizar Documento</h3>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body" style={{ overflow: 'auto', maxHeight: '70vh' }}>
          <div dangerouslySetInnerHTML={{ __html: html }} />
        </div>
        <div className="modal-footer">
          <button className="btn-cancel" onClick={onClose}>Fechar</button>
        </div>
      </div>
    </div>
  )
}

function DocumentosPendentes({ cfg, empresaId, user, onCfgUpdate }) {
  const [modalEnvio, setModalEnvio] = useState(null)
  const [loading, setLoading] = useState(false)

  const docs = (cfg.docHistory || []).filter(d => d.status !== 'signed')

  async function assinarComoConsultor(doc) {
    setLoading(true)
    try {
      const now = new Date().toISOString()
      // Buscar documento completo
      const { data: row } = await supabase.from('vx_storage').select('value').eq('key', `doc:${doc.signToken}`).single()
      if (!row?.value) throw new Error('Documento não encontrado')
      const docData = JSON.parse(row.value)
      docData.signedByConsultor = user?.nome || user?.email
      docData.signedAtConsultor = now
      if (docData.signedAt) {
        docData.status = 'signed'
        // Enviar email de confirmação para ambos
        try {
          const emailCliente = docData.signEmail || docData.clientEmail || ''
          const emailConsultor = user?.email || ''
          const assunto = `Documento assinado - ${cfg.company}`
          const corpo = `O documento foi totalmente assinado por ambas as partes. Acesse o link para visualizar: ${window.location.origin}/sign/${doc.signToken}`
          if (emailCliente) window.open(`mailto:${emailCliente}?subject=${encodeURIComponent(assunto)}&body=${encodeURIComponent(corpo)}`)
          if (emailConsultor) window.open(`mailto:${emailConsultor}?subject=${encodeURIComponent(assunto)}&body=${encodeURIComponent(corpo)}`)
        } catch(e) { console.warn('email error', e) }
      } else {
        docData.status = 'pending'
      }
      await supabase.from('vx_storage').upsert({ key: `doc:${doc.signToken}`, value: JSON.stringify(docData), updated_at: now })

      // Atualizar docHistory na cfg
      const newHistory = cfg.docHistory.map(d => {
        if (d.signToken === doc.signToken) {
          return { ...d, signedByConsultor: user?.nome, signedAtConsultor: now, status: docData.status }
        }
        return d
      })
      const newCfg = { ...cfg, docHistory: newHistory }
      await supabase.from('vx_storage').upsert({ key: `cfg:${empresaId}`, value: JSON.stringify(newCfg), updated_at: now })
      onCfgUpdate(newCfg)
    } catch (err) {
      console.error(err)
      alert('Erro ao assinar como consultor')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ marginBottom: 24 }}>
      <h3 style={{ fontFamily: 'Syne, sans-serif', fontSize: 16, fontWeight: 700, color: 'var(--accent)', marginBottom: 16 }}>✍️ Assinaturas Pendentes</h3>
      {docs.length === 0 && <p style={{ color: 'var(--muted)', fontSize: 13 }}>Nenhum documento pendente.</p>}
      {docs.map(doc => {
        const clienteAssinou = !!doc.signedAt
        const consultorAssinou = !!doc.signedByConsultor
        return (
          <div key={doc.id} style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 10, padding: '12px 16px', marginBottom: 10 }}>
            <div style={{ fontWeight: 600, fontSize: 14 }}>{doc.clientName || 'Cliente'}</div>
            <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4 }}>
              {doc.date} · {doc.type === 'contrato' ? 'Contrato' : 'Proposta'}
            </div>
            <div style={{ marginTop: 8, display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
              <div style={{ fontSize: 12 }}>
                <span style={{ color: clienteAssinou ? 'var(--accent3)' : 'var(--warning)' }}>{clienteAssinou ? '✅ Cliente assinou' : '⏳ Cliente pendente'}</span>
                <span style={{ margin: '0 8px' }}>•</span>
                <span style={{ color: consultorAssinou ? 'var(--accent3)' : 'var(--warning)' }}>{consultorAssinou ? '✅ Consultor assinou' : '⏳ Consultor pendente'}</span>
              </div>
              <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
                <button onClick={() => setModalEnvio(doc)} style={{ padding: '4px 10px', borderRadius: 6, background: 'rgba(0,212,255,.1)', border: '1px solid rgba(0,212,255,.2)', color: 'var(--accent)', fontSize: 11, cursor: 'pointer' }}>📧 Enviar link</button>
                {!consultorAssinou && (
                  <button onClick={() => assinarComoConsultor(doc)} disabled={loading} style={{ padding: '4px 10px', borderRadius: 6, background: 'linear-gradient(135deg,var(--accent3),#059669)', border: 'none', color: '#fff', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>
                    ✍️ Assinar agora
                  </button>
                )}
              </div>
            </div>
          </div>
        )
      })}
      {modalEnvio && (
        <ModalEnvioDoc
          doc={modalEnvio}
          cfg={cfg}
          empresaId={empresaId}
          onClose={() => setModalEnvio(null)}
        />
      )}
    </div>
  )
}

function Historico({ cfg, empresaId, onCfgUpdate }) {
  const [modalVer, setModalVer] = useState(null)
  const [modalEnvio, setModalEnvio] = useState(null)
  const [htmlDoc, setHtmlDoc] = useState('')
  const [loading, setLoading] = useState(false)

  async function verDocumento(doc) {
    setLoading(true)
    try {
      const { data: row } = await supabase.from('vx_storage').select('value').eq('key', `doc:${doc.signToken}`).single()
      if (row?.value) {
        const docData = JSON.parse(row.value)
        setHtmlDoc(docData.html)
        setModalVer(doc)
      } else {
        alert('Documento não encontrado')
      }
    } catch (err) {
      console.error(err)
      alert('Erro ao carregar documento')
    } finally {
      setLoading(false)
    }
  }

  const docs = (cfg.docHistory || []).slice().reverse()

  return (
    <div>
      <h3 style={{ fontFamily: 'Syne, sans-serif', fontSize: 16, fontWeight: 700, color: 'var(--accent)', marginBottom: 16 }}>🗂️ Histórico de Documentos</h3>
      {docs.length === 0 && <p style={{ color: 'var(--muted)', fontSize: 13 }}>Nenhum documento gerado ainda.</p>}
      {docs.map(doc => (
        <div key={doc.id} style={{ padding: '10px 0', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 600, fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{doc.clientName || 'Cliente'}</div>
            <div style={{ fontSize: 11, color: 'var(--muted)' }}>
              {doc.date} · {doc.type === 'contrato' ? 'Contrato' : 'Proposta'}
              {doc.signedAt && ` · Cliente: ${doc.signedBy}`}
              {doc.signedByConsultor && ` · Consultor: ${doc.signedByConsultor}`}
              <span style={{ marginLeft: 8, color: doc.status === 'signed' ? 'var(--accent3)' : 'var(--warning)' }}>
                {doc.status === 'signed' ? '✅ Assinado' : doc.status === 'pending' ? '⏳ Pendente' : '📝 Rascunho'}
              </span>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => verDocumento(doc)} disabled={loading} style={{ padding: '4px 10px', borderRadius: 6, background: 'rgba(0,212,255,.1)', border: '1px solid rgba(0,212,255,.2)', color: 'var(--accent)', fontSize: 11, cursor: 'pointer' }}>👁️ Ver</button>
            <button onClick={() => setModalEnvio(doc)} style={{ padding: '4px 10px', borderRadius: 6, background: 'rgba(0,212,255,.1)', border: '1px solid rgba(0,212,255,.2)', color: 'var(--accent)', fontSize: 11, cursor: 'pointer' }}>📧 Enviar</button>
          </div>
        </div>
      ))}
      {modalVer && <ModalVer html={htmlDoc} onClose={() => setModalVer(null)} />}
      {modalEnvio && (
        <ModalEnvioDoc
          doc={modalEnvio}
          cfg={cfg}
          empresaId={empresaId}
          onClose={() => setModalEnvio(null)}
        />
      )}
    </div>
  )
}

function ModalEnvioDoc({ doc, cfg, empresaId, onClose }) {
  const [email, setEmail] = useState(doc.clientEmail || '')
  const [saving, setSaving] = useState(false)

  function buildSignUrl() {
    const base = typeof window !== 'undefined' ? (cfg.signConfig?.url || window.location.origin) : ''
    return `${base}/sign/${doc.signToken}`
  }

  function enviarWhatsApp() {
    const url = buildSignUrl()
    const tipo = doc.type === 'proposta' ? 'Proposta Comercial' : 'Contrato'
    const msg = encodeURIComponent(`Olá! Segue o link para assinatura eletrônica do ${tipo} – ${cfg.company || 'Vivanexa'}:\n\n${url}\n\nQualquer dúvida, entre em contato conosco.`)
    const wpp = (cfg.signConfig?.wpp || '').replace(/\D/g, '')
    if (wpp) window.open(`https://wa.me/${wpp}?text=${msg}`, '_blank')
    else window.open(`https://wa.me/?text=${msg}`, '_blank')
  }

  function enviarEmail() {
    const url = buildSignUrl()
    const tipo = doc.type === 'proposta' ? 'Proposta Comercial' : 'Contrato'
    const subj = encodeURIComponent(`${tipo} – ${cfg.company || 'Vivanexa'} – Aguardando sua assinatura`)
    const body = encodeURIComponent(`Olá!\n\nSegue o link para assinatura eletrônica do ${tipo}:\n\n${url}\n\nQualquer dúvida, entre em contato.\n\n${cfg.company || 'Vivanexa'}`)
    const to = email || doc.clientEmail || ''
    window.open(`mailto:${to}?subject=${subj}&body=${body}`, '_blank')
  }

  async function marcarEnviado() {
    setSaving(true)
    try {
      const { data: row } = await supabase.from('vx_storage').select('value').eq('key', `doc:${doc.signToken}`).single()
      if (row?.value) {
        const d = JSON.parse(row.value)
        if (d.status === 'draft') d.status = 'sent'
        await supabase.from('vx_storage').upsert({ key: `doc:${doc.signToken}`, value: JSON.stringify(d), updated_at: new Date().toISOString() })
      }
      // Atualizar cfg
      const newHistory = (cfg.docHistory || []).map(d => d.signToken === doc.signToken ? { ...d, status: 'sent' } : d)
      const newCfg = { ...cfg, docHistory: newHistory }
      await supabase.from('vx_storage').upsert({ key: `cfg:${empresaId}`, value: JSON.stringify(newCfg), updated_at: new Date().toISOString() })
    } catch(e) { console.warn(e) }
    setSaving(false)
    onClose()
  }

  return (
    <div className="modal-overlay" style={{ zIndex: 10001 }}>
      <div className="modal-box" style={{ maxWidth: 520 }}>
        <div className="modal-header">
          <h3>📧 Enviar para Assinatura</h3>
          <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 3 }}>
            {doc.type === 'proposta' ? 'Proposta' : 'Contrato'} · {doc.clientName}
          </div>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 10, color: 'var(--muted)', textTransform: 'uppercase', marginBottom: 6 }}>Link de Assinatura</div>
            <div style={{ display: 'flex', gap: 8 }}>
              <input readOnly value={buildSignUrl()} style={{ flex: 1, background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 12px', fontFamily: 'DM Mono, monospace', fontSize: 12, color: 'var(--accent)', outline: 'none' }} />
              <button onClick={() => navigator.clipboard.writeText(buildSignUrl())} style={{ padding: '8px 12px', borderRadius: 8, background: 'rgba(0,212,255,.1)', border: '1px solid rgba(0,212,255,.25)', color: 'var(--accent)', cursor: 'pointer', fontSize: 12 }}>📋 Copiar</button>
            </div>
          </div>
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 10, color: 'var(--muted)', textTransform: 'uppercase', marginBottom: 6 }}>E-mail do cliente</div>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="email do cliente" style={{ width: '100%', background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 8, padding: '9px 12px', fontFamily: 'DM Mono, monospace', fontSize: 13, color: 'var(--text)', outline: 'none' }} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <button onClick={enviarWhatsApp} style={{ padding: '13px 16px', borderRadius: 12, background: 'linear-gradient(135deg,#25d366,#128c7e)', border: 'none', color: '#fff', fontFamily: 'DM Mono, monospace', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>💬 Enviar via WhatsApp</button>
            <button onClick={enviarEmail} style={{ padding: '13px 16px', borderRadius: 12, background: 'linear-gradient(135deg,#0f172a,#1e3a5f)', border: '1px solid rgba(0,212,255,.3)', color: 'var(--accent)', fontFamily: 'DM Mono, monospace', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>📧 Enviar por E-mail</button>
            <button onClick={marcarEnviado} disabled={saving} style={{ padding: '13px 16px', borderRadius: 12, background: 'linear-gradient(135deg,rgba(251,191,36,.2),rgba(251,191,36,.08))', border: '1px solid rgba(251,191,36,.4)', color: 'var(--gold)', fontFamily: 'DM Mono, monospace', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>{saving ? '⏳...' : '✅ Marcar como enviado'}</button>
            <button onClick={onClose} style={{ padding: '11px', borderRadius: 10, background: 'rgba(100,116,139,.12)', border: '1px solid var(--border)', color: 'var(--muted)', fontFamily: 'DM Mono, monospace', fontSize: 13, cursor: 'pointer' }}>Fechar</button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════
// COMPONENTE PRINCIPAL
// ══════════════════════════════════════════════════════════════
export default function Chat(){
  const router   = useRouter()
  const msgRef   = useRef(null)
  const inputRef = useRef(null)
  const [userProfile,  setUserProfile]  = useState(null)
  const [cfg,          setCfg]          = useState(DEFAULT_CFG)
  const [empresaId,    setEmpresaId]    = useState(null)
  const [messages,     setMessages]     = useState([])
  const [input,        setInput]        = useState('')
  const [thinking,     setThinking]     = useState(false)
  const [chips,        setChips]        = useState([])
  const [timerVal,     setTimerVal]     = useState('')
  const [timerDeadline,setTimerDeadline]= useState(null)

  // Modal cliente
  const [showClient, setShowClient] = useState(false)
  const [clientMode, setClientMode] = useState('proposta')
  const emptyForm = {empresa:'',razao:'',contato:'',email:'',telefone:'',cep:'',logradouro:'',bairro:'',cidade:'',uf:'',cpfContato:'',regime:'',rimpNome:'',rimpEmail:'',rimpTel:'',rfinNome:'',rfinEmail:'',rfinTel:''}
  const [cf, setCf] = useState(emptyForm)
  const [buscandoCep, setBuscandoCep] = useState(false)

  // Wizard contrato
  const [showWiz,  setShowWiz]  = useState(false)
  const [wizStep,  setWizStep]  = useState(1)
  const [wizPay,   setWizPay]   = useState('')
  const [wizAd,    setWizAd]    = useState('')
  const [wizMen,   setWizMen]   = useState('')
  const [wizTAd,   setWizTAd]   = useState(0)
  const [wizTMen,  setWizTMen]  = useState(0)
  const [docGerado, setDocGerado] = useState(null) // {id, token, html, type, clientName}

  // Modal enviar para assinatura
  const [showSign,    setShowSign]    = useState(false)
  const [signDoc,     setSignDoc]     = useState(null)
  const [signEmailInput, setSignEmailInput] = useState('')
  const [signSalvo,   setSignSalvo]   = useState(false)

  // Modal assinar agora (self-sign)
  const [showSelfSign,  setShowSelfSign]  = useState(false)
  const [selfNome,      setSelfNome]      = useState('')
  const [selfCpf,       setSelfCpf]       = useState('')
  const [selfEmail,     setSelfEmail]     = useState('')
  const [selfAgreed,    setSelfAgreed]    = useState(false)
  const [selfSaving,    setSelfSaving]    = useState(false)
  const [selfErro,      setSelfErro]      = useState('')

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
      setUserProfile({...session.user,nome,perfil:profile})
      const eid=profile?.empresa_id||session.user.id
      setEmpresaId(eid)
      await loadCfg(eid)
    })
    const{data:l}=supabase.auth.onAuthStateChange((_e,s)=>{if(!s)router.replace('/')})
    return()=>l.subscription.unsubscribe()
  },[router])

  useEffect(()=>{
    if(!userProfile)return
    setTimeout(()=>addBot(`Olá, ${userProfile.nome}! 👋\n\nSou o assistente comercial da ${cfg.company||'Vivanexa'}.\nPara começar, informe o **CPF ou CNPJ** do cliente:`),300)
  },[userProfile])

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
        setCfg({...DEFAULT_CFG,...saved,plans:saved.plans?.length?saved.plans:DEFAULT_CFG.plans,prices:Object.keys(saved.prices||{}).length?saved.prices:DEFAULT_CFG.prices})
      }
    }catch{}
  }

  // ── Salvar documento no histórico ─────────────
  async function saveToHistory(type,clientName,html,extra={}){
    const id='doc_'+Date.now()+'_'+Math.random().toString(36).slice(2,6)
    const token=generateToken()
    const entry={
      id,type,clientName,
      date:new Date().toLocaleString('pt-BR'),
      dateISO:new Date().toISOString(),
      status:'draft',
      signToken:token,
      signedAt:null,signedBy:null,signCPF:null,signIP:null,
      signedByConsultor:null,signedAtConsultor:null,
      consultor:userProfile?.nome||'',
      empresaId:empresaId||'',
      ...extra
    }
    // Salva doc completo (com html) separado
    try{
      await supabase.from('vx_storage').upsert({key:`doc:${token}`,value:JSON.stringify({...entry,html}),updated_at:new Date().toISOString()})
    }catch(e){console.warn('doc save error',e)}

    // Atualiza cfg.docHistory (sem html para não estourar tamanho)
    try{
      const{data:cfgRow}=await supabase.from('vx_storage').select('value').eq('key',`cfg:${empresaId}`).single()
      const cfgData=cfgRow?.value?JSON.parse(cfgRow.value):{...cfg}
      if(!cfgData.docHistory)cfgData.docHistory=[]
      cfgData.docHistory.unshift(entry) // sem html
      if(cfgData.docHistory.length>200)cfgData.docHistory=cfgData.docHistory.slice(0,200)
      await supabase.from('vx_storage').upsert({key:`cfg:${empresaId}`,value:JSON.stringify(cfgData),updated_at:new Date().toISOString()})
      setCfg(cfgData)
    }catch(e){console.warn('history save error',e)}

    return{id,token,html,type,clientName,...entry}
  }

  const addBot  =(c,h=false)=>setMessages(p=>[...p,{role:'bot', content:c,isHTML:h, id:Date.now()+Math.random()}])
  const addUser =c           =>setMessages(p=>[...p,{role:'user',content:c,isHTML:false,id:Date.now()+Math.random()}])

  const resetS=()=>{
    Object.assign(S,{stage:'await_doc',doc:null,clientData:null,contactData:{},users:null,cnpjs:null,modules:[],plan:null,ifPlan:null,notas:null,quoteData:null,closingData:null,closingToday:false,appliedVoucher:null,awaitingVoucher:false})
    setTimerDeadline(null);setTimerVal('')
  }

  // ── Busca CEP ─────────────────────────────────
  async function buscarCep(cep){
    setBuscandoCep(true)
    const d=await fetchCEP(cep)
    setBuscandoCep(false)
    if(d)setCf(f=>({...f,logradouro:d.logradouro||f.logradouro,bairro:d.bairro||f.bairro,cidade:d.municipio||f.cidade,uf:d.uf||f.uf}))
  }

  // ── Lógica do chat ────────────────────────────
  async function processInput(t){
    const lo=t.toLowerCase()
    if(S.stage==='closed')return null
    if(['valeu','obrigado','obrigada','tchau'].some(w=>lo.includes(w))&&S.stage!=='await_doc'){S.stage='closed';return{h:false,c:'Perfeito! Boas vendas! 🚀'}}

    if(S.awaitingVoucher){
      if(lo.includes('sem voucher')||lo.includes('pular')){S.awaitingVoucher=false;S.quoteData=calcFull(S.modules,S.plan,S.ifPlan,S.cnpjs,S.notas,cfg);S.stage='full_quoted';return{h:true,c:rFull(S.quoteData)}}
      const code=t.trim().toUpperCase()
      const voucher=(cfg.vouchers||[]).find(v=>v.codigo===code&&v.ativo!==false)
      if(!voucher)return{h:false,c:`❌ Voucher **${code}** não encontrado.\n\nTente outro código ou "sem voucher" para ver o preço cheio:`}
      S.appliedVoucher=voucher;S.awaitingVoucher=false;S.stage='discounted'
      const discData=calcDisc(S.modules,S.plan,S.ifPlan,S.cnpjs,S.notas,cfg,{discAdPct:voucher.pctAdesao,discMenPct:voucher.pctMensalidade})
      S.quoteData=discData
      const cn=S.clientData?.fantasia||S.clientData?.nome||fmtDoc(S.doc||'')
      addUser(t);addBot(`✅ Voucher **${voucher.codigo}** aplicado! Desconto: Adesão ${voucher.pctAdesao}% · Mensalidade ${voucher.pctMensalidade}%`)
      setTimeout(()=>addBot(rDisc(discData,getNextDates(),cn),true),300);return null
    }

    if(S.stage==='await_doc'){
      const doc=clean(t);if(!isCNPJ(doc)&&!isCPF(doc))return{h:false,c:'Por favor, informe o CPF ou CNPJ (somente números).'}
      S.doc=doc
      if(isCNPJ(doc)){setThinking(true);const cd=await fetchCNPJ(doc);setThinking(false)
        if(cd){S.clientData=cd;S.stage='await_users';return{h:true,c:rClientCard(cd)+`<div style="margin-top:10px;font-size:14px;color:var(--muted)">✅ Empresa encontrada!<br><br>Quantos <strong style="color:var(--text)">usuários</strong> o cliente possui?</div>`}}
      }
      S.clientData={nome:isCPF(doc)?'Cliente PF':'Empresa',fantasia:'',cnpj:doc,tipo:isCPF(doc)?'PF':'PJ'}
      S.stage='await_users';return{h:false,c:(isCNPJ(doc)?`⚠️ CNPJ ${fmtDoc(doc)} não localizado.\n`:'')+`Quantos usuários o cliente possui?`}
    }
    if(S.stage==='await_users'){const u=parseInt(t.match(/\d+/)?.[0]);if(!u||u<1)return{h:false,c:'Quantos usuários? (número)'};S.users=u;S.stage='await_modules';return{h:false,c:`👥 ${u} usuário${u>1?'s':''}!\n\nQuais módulos?\n(Gestão Fiscal · BIA · CND · XML · IF · EP · Tributos)`}}
    if(S.stage==='await_if_plan'){const p=parseIFPlan(t,cfg.plans);if(!p)return{h:false,c:`Informe o plano IF:\n(${cfg.plans.map(x=>x.name).join(', ')})`};S.ifPlan=p;S.stage='await_modules';return checkCalc()}
    if(S.stage==='await_notas'){const n=parseInt(t);if(!n||n<1)return{h:false,c:'Quantas notas fiscais por mês?'};S.notas=n;S.stage='await_modules';return checkCalc()}

    const mods=parseMods(t,cfg);for(const m of mods)if(!S.modules.includes(m))S.modules.push(m)
    const nCNPJ=S.modules.length===0||S.modules.some(m=>!IF_NO_CNPJ.includes(m))
    if(nCNPJ){const n=parseInt(t.match(/\b(\d+)\s*(cnpj[s]?)?\b/i)?.[1]);if(n&&!S.cnpjs)S.cnpjs=n}
    return checkCalc()
  }

  function checkCalc(){
    if(S.modules.length===0)return{h:false,c:`Quais módulos?\n(Gestão Fiscal · BIA · CND · XML · IF · EP · Tributos)`}
    if(S.modules.includes('EP')&&!S.modules.includes('Gestão Fiscal')){S.modules=S.modules.filter(m=>m!=='EP');return{h:false,c:`⚠️ EP exige Gestão Fiscal.`}}
    if(S.modules.includes('IF')&&!S.ifPlan){S.stage='await_if_plan';return{h:false,c:`Qual o plano de IF?\n(${cfg.plans.map(p=>p.name).join(', ')})`}}
    if(S.modules.includes('Tributos')&&!S.notas){S.stage='await_notas';return{h:false,c:'Quantas notas fiscais por mês?'}}
    const nCNPJ=S.modules.some(m=>!IF_NO_CNPJ.includes(m))
    if(nCNPJ&&!S.cnpjs)return{h:false,c:'Quantos CNPJs o cliente possui?'}
    S.plan=nCNPJ?getPlan(S.cnpjs,cfg.plans):'basic'
    if(cfg.discMode==='voucher'&&!S.appliedVoucher&&!S.awaitingVoucher){S.awaitingVoucher=true;return{h:false,c:`🎫 Modo desconto por Voucher ativo.\n\nDigite o **código do voucher** para aplicar o desconto:\n(ou "sem voucher" para ver o preço cheio)`}}
    S.quoteData=calcFull(S.modules,S.plan,S.ifPlan,S.cnpjs,S.notas,cfg);S.stage='full_quoted'
    return{h:true,c:rFull(S.quoteData)}
  }

  async function send(text){
    const txt=(text||input).trim();if(!txt)return
    setInput('');addUser(txt);setChips([])
    setThinking(true);const resp=await processInput(txt);setThinking(false)
    if(resp)addBot(resp.c,resp.h)
    if(S.stage==='await_modules')setChips(['Gestão Fiscal + BIA','BIA + CND + XML','Gestão Fiscal + EP','Inteligência Fiscal'])
  }

  useEffect(()=>{
    const dates=getNextDates()
    window.vx_disc=(yes)=>{
      const cn=S.clientData?.fantasia||S.clientData?.nome||fmtDoc(S.doc||'')
      if(yes){S.stage='discounted';S.quoteData=calcDisc(S.modules,S.plan,S.ifPlan,S.cnpjs,S.notas,cfg,null);addUser('✅ Sim, quero ver!');addBot(rDisc(S.quoteData,dates,cn),true)}
      else{S.stage='closed';addUser('Não, obrigado');addBot('Sem problemas! 😊');setTimeout(()=>addBot(`<button class="reset-btn" onclick="window.vx_reset()">🔄 Iniciar nova consulta</button>`,true),400)}
      setChips([])
    }
    window.vx_close=(yes)=>{
      if(yes){const d=calcClose(S.modules,S.plan,S.ifPlan,S.cnpjs,S.notas,cfg);S.closingData=d;S.closingToday=true;S.stage='closing';addUser('✅ Sim, fechar hoje!');const dl=new Date();dl.setHours(18,0,0,0);setTimerDeadline(dl);addBot(rClose(d),true)}
      else{S.stage='discounted';addUser('Não por agora');addBot('Entendido!');setTimeout(()=>addBot(`<button class="reset-btn" onclick="window.vx_reset()">🔄 Iniciar nova consulta</button>`,true),400)}
      setChips([])
    }
    window.vx_reset=()=>{resetS();setChips([]);addBot('🔄 Nova consulta!\n\nInforme o CPF ou CNPJ do próximo cliente:')}
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
    S.contactData={...cf}
    setShowClient(false)
    const clientName=cf.razao||cf.empresa||fmtDoc(S.doc||'')||'Cliente'
    if(clientMode==='proposta'){
      const html=buildProposal(S,cfg,userProfile)
      openPrint(html,'Proposta Comercial')
      const doc=await saveToHistory('proposta',clientName,html,{tAd:S.quoteData?.tAdD||0,tMen:S.quoteData?.tMenD||0,clientEmail:cf.email,modulos:S.modules})
      setDocGerado(doc);setSignDoc(doc);setSignEmailInput(cf.email||'');setSignSalvo(true)
      setTimeout(()=>setShowSign(true),600)
    }else{
      const isC=S.closingToday===true
      const tAd =isC?S.closingData?.tAd :(S.quoteData?.tAdD||0)
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
      const html=buildContract(S,cfg,userProfile,wizTAd,wizTMen,wizAd,wizMen,wizPay)
      openPrint(html,'Contrato')
      const clientName=cf.razao||cf.empresa||fmtDoc(S.doc||'')||'Cliente'
      saveToHistory('contrato',clientName,html,{tAd:wizTAd,tMen:wizTMen,clientEmail:cf.email,modulos:S.modules,pagamento:wizPay,vencAdesao:wizAd,vencMensal:wizMen}).then(doc=>{
        setDocGerado(doc);setSignDoc(doc);setSignEmailInput(cf.email||'');setSignSalvo(true)
        setTimeout(()=>setShowSign(true),600)
      })
    }
  }

  // ── URL de assinatura ─────────────────────────
  function buildSignUrl(doc){
    const base=typeof window!=='undefined'?(cfg.signConfig?.url||window.location.origin):'https://vivanexa-saas.vercel.app'
    return`${base}/sign/${doc.signToken}`
  }

  // ── Envio WhatsApp ────────────────────────────
  function enviarWhatsApp(doc){
    const url=buildSignUrl(doc)
    const tipo=doc.type==='proposta'?'Proposta Comercial':'Contrato'
    const msg=encodeURIComponent(`Olá! Segue o link para assinatura eletrônica do ${tipo} – ${cfg.company||'Vivanexa'}:\n\n${url}\n\nQualquer dúvida, entre em contato conosco.`)
    const wpp=(cfg.signConfig?.wpp||'').replace(/\D/g,'')
    if(wpp)window.open(`https://wa.me/${wpp}?text=${msg}`,'_blank')
    else window.open(`https://wa.me/?text=${msg}`,'_blank')
    marcarEnviado(doc)
  }

  function enviarEmail(doc){
    const url=buildSignUrl(doc)
    const tipo=doc.type==='proposta'?'Proposta Comercial':'Contrato'
    const subj=encodeURIComponent(`${tipo} – ${cfg.company||'Vivanexa'} – Aguardando sua assinatura`)
    const body=encodeURIComponent(`Olá!\n\nSegue o link para assinatura eletrônica do ${tipo}:\n\n${url}\n\nQualquer dúvida, entre em contato.\n\n${cfg.company||'Vivanexa'}`)
    const email=signEmailInput||doc.clientEmail||''
    window.open(`mailto:${email}?subject=${subj}&body=${body}`,'_blank')
    marcarEnviado(doc)
  }

  async function marcarEnviado(doc){
    // Atualiza status para 'sent' no Supabase
    try{
      const{data:row}=await supabase.from('vx_storage').select('value').eq('key',`doc:${doc.signToken}`).single()
      if(row?.value){const d=JSON.parse(row.value);d.status='sent';await supabase.from('vx_storage').upsert({key:`doc:${doc.signToken}`,value:JSON.stringify(d),updated_at:new Date().toISOString()})}
    }catch{}
  }

  // ── Self-sign (assinar agora) ─────────────────
  async function confirmarSelfSign(){
    if(!selfNome.trim()){setSelfErro('Informe seu nome.');return}
    if(!selfCpf.trim()){setSelfErro('Informe seu CPF.');return}
    if(!selfEmail.trim()){setSelfErro('Informe seu e-mail.');return}
    if(!selfAgreed){setSelfErro('Aceite os termos para assinar.');return}
    setSelfSaving(true);setSelfErro('')
    try{
      const now=new Date(),nowStr=now.toLocaleString('pt-BR')
      const{data:row}=await supabase.from('vx_storage').select('value').eq('key',`doc:${signDoc.signToken}`).single()
      const docData=row?.value?JSON.parse(row.value):{...signDoc}
      docData.signedAt=nowStr;docData.signedBy=selfNome.trim();docData.signCPF=selfCpf.trim();docData.signEmail=selfEmail.trim();docData.signIP='(web)';docData.status='pending'
      await supabase.from('vx_storage').upsert({key:`doc:${signDoc.signToken}`,value:JSON.stringify(docData),updated_at:now.toISOString()})
      // Atualiza cfg
      const{data:cfgRow}=await supabase.from('vx_storage').select('value').eq('key',`cfg:${empresaId}`).single()
      if(cfgRow?.value){const c=JSON.parse(cfgRow.value);if(c.docHistory){c.docHistory=c.docHistory.map(h=>h.signToken===signDoc.signToken?{...h,signedAt:nowStr,signedBy:selfNome.trim(),status:'pending'}:h);await supabase.from('vx_storage').upsert({key:`cfg:${empresaId}`,value:JSON.stringify(c),updated_at:now.toISOString()})}}
      setShowSelfSign(false);setShowSign(false)
      addBot(`✅ Contrato assinado por **${selfNome}** em ${nowStr}!\n\nO documento está salvo e aguardando assinatura do consultor.`)
    }catch(e){setSelfErro('Erro ao salvar assinatura.')}
    finally{setSelfSaving(false)}
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
    const{results,tAd,tMen}=data;const dates=getNextDates();let h=''
    for(const r of results){h+=`<div class="price-card"><h4>🔹 ${r.name}${r.isPrepaid?' <small style="font-size:11px;color:var(--warning)">(pré-pago)</small>':''}</h4>${!r.isTributos&&!r.isEP?`<div class="price-row"><span class="label">Adesão</span><span class="val">${fmt(r.ad)}</span></div>`:''}<div class="price-row"><span class="label">Mensalidade</span><span class="val">${fmt(r.men)}</span></div></div>`}
    h+=`<div class="price-card" style="border-color:rgba(0,212,255,.25)"><h4>🔸 Total</h4><div class="price-row"><span class="label">Adesão total</span><span class="val">${fmt(tAd)}</span></div><div class="price-row"><span class="label">Mensalidade total</span><span class="val">${fmt(tMen)}</span></div></div>`
    h+=`<div class="teaser-card"><div class="teaser-title">🎫 Há licenças com desconto disponíveis!</div><div class="teaser-body">Deseja ver os valores com desconto?</div><div class="yn-row"><button class="yn-btn yes" onclick="window.vx_disc(true)">✅ Sim, quero ver!</button><button class="yn-btn no" onclick="window.vx_disc(false)">Não, obrigado</button></div></div>`
    h+=`<div class="section-label">Próximos vencimentos</div><div class="dates-box">${dates.map(d=>`<span class="date-chip">${d}</span>`).join('')}</div>`
    return h
  }
  function rDisc(data,dates,cn){
    const{results,tAd,tMen,tAdD,tMenD}=data;let h=''
    for(const r of results){h+=`<div class="price-card"><h4>🔹 ${r.name}</h4>${!r.isTributos&&!r.isEP?`<div class="price-row"><span class="label">Adesão</span><span class="val">${fmt(r.ad)}</span></div>`:''}<div class="price-row"><span class="label">Mensalidade</span><span class="val">${fmt(r.men)}</span></div><hr class="section-divider">${!r.isTributos&&!r.isEP?`<div class="price-row"><span class="label">Adesão c/ desconto</span><span class="val discount">${fmt(r.adD)}</span></div>`:''}<div class="price-row"><span class="label">Mensalidade c/ desconto</span><span class="val discount">${fmt(r.menD)}</span></div></div>`}
    h+=`<div class="price-card" style="border-color:rgba(0,212,255,.25)"><h4>🔸 Total</h4><div class="price-row"><span class="label">Adesão</span><span class="val">${fmt(tAd)}</span></div><div class="price-row"><span class="label">Mensalidade</span><span class="val">${fmt(tMen)}</span></div><hr class="section-divider"><div class="price-row"><span class="label">Adesão c/ desconto</span><span class="val discount">${fmt(tAdD)}</span></div><div class="price-row"><span class="label">Mensalidade c/ desconto</span><span class="val discount">${fmt(tMenD)}</span></div>${cfg.unlimitedStrategy?`<div style="margin-top:8px"><span class="unlimited-badge">♾ Usuários Ilimitados</span></div>`:''}</div>`
    h+=`<div class="opp-banner"><div class="opp-title">🔥 Oportunidade de Negociação</div><div class="opp-body"><strong style="color:var(--gold)">${cn}</strong> pode fechar agora com <strong style="color:var(--gold)">${cfg.discClosePct||40}% OFF</strong> na adesão!<br>Oferta válida até as <strong style="color:var(--gold)">18h de hoje</strong>.</div><div class="yn-row"><button class="yn-btn yes" onclick="window.vx_close(true)">✅ Sim, fechar hoje!</button><button class="yn-btn no" onclick="window.vx_close(false)">Não por agora</button></div></div>`
    h+=`<div class="section-label">Próximos vencimentos</div><div class="dates-box">${dates.map(d=>`<span class="date-chip">${d}</span>`).join('')}</div>`
    return h
  }
  function rClose(data){
    const{results,tAd,tMen}=data;const dates=getNextDates();let h=''
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

  if(!userProfile)return(<div style={{background:'#0a0f1e',minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center',color:'#64748b',fontFamily:'DM Mono, monospace'}}>Carregando...</div>)

  return(<>
    <Head>
      <title>{cfg.company} – Assistente Comercial</title>
      <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
      <link href="https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=DM+Mono:wght@300;400;500&family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet"/>
    </Head>
    <style>{CSS}</style>
    <div className="orb orb1"/><div className="orb orb2"/>

    {/* HEADER COM LOGO */}
    <header>
      <div className="header-logo">
        {cfg.logob64
          ? <img src={cfg.logob64} alt={cfg.company} style={{height:40,objectFit:'contain',borderRadius:8}} onError={e=>e.target.style.display='none'}/>
          : <div style={{fontFamily:'Syne,sans-serif',fontSize:17,fontWeight:700,letterSpacing:.5,color:'var(--text)'}}>{cfg.company||'Vivanexa'}</div>
        }
      </div>
      <div className="header-text">
        {cfg.slogan && <p style={{fontSize:11,color:'var(--muted)',marginTop:2}}>{cfg.slogan}</p>}
      </div>
      <div className="status-dot">online</div>
      <nav style={{display:'flex',gap:6,alignItems:'center',marginLeft:'auto'}}>
        <button onClick={()=>router.push('/dashboard')} style={{background:'var(--surface2)',border:'1px solid var(--border)',cursor:'pointer',color:'var(--muted)',fontSize:11,padding:'5px 11px',borderRadius:8,fontFamily:'DM Mono,monospace'}}>📊 Dashboard</button>
        <button onClick={()=>router.push('/configuracoes')} style={{background:'var(--surface2)',border:'1px solid var(--border)',cursor:'pointer',color:'var(--muted)',fontSize:11,padding:'5px 11px',borderRadius:8,fontFamily:'DM Mono,monospace'}}>⚙️ Config</button>
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

    {/* NOVOS PAINÉIS: Assinaturas Pendentes e Histórico */}
    <div style={{ marginTop: '24px', borderTop: '1px solid var(--border)', paddingTop: '24px', maxWidth: 820, margin: '24px auto 0' }}>
      <DocumentosPendentes
        cfg={cfg}
        empresaId={empresaId}
        user={userProfile}
        onCfgUpdate={(novoCfg) => setCfg(novoCfg)}
      />
      <Historico
        cfg={cfg}
        empresaId={empresaId}
        onCfgUpdate={(novoCfg) => setCfg(novoCfg)}
      />
    </div>

    {/* MODAL DADOS DO CLIENTE (igual ao original) */}
    {showClient&&(
      <div className="modal-overlay">
        <div className="modal-box" style={{maxWidth:620}}>
          <div className="modal-header">
            <h3>{clientMode==='proposta'?'📄 Confirmar Dados do Cliente':'📝 Confirmar Dados do Cliente'}</h3>
            <button className="modal-close" onClick={()=>setShowClient(false)}>✕</button>
          </div>
          <div className="modal-body">
            <div className="modal-sec">DADOS DO CLIENTE</div>
            {/* CPF/CNPJ + busca */}
            <div style={{marginBottom:12}}>
              <label className="field-label">CPF / CNPJ</label>
              <div style={{display:'flex',gap:8}}>
                <input className="field-input" value={fmtDoc(S.doc||'')} readOnly style={{flex:1,opacity:.7}}/>
              </div>
            </div>
            <div className="modal-grid2">
              <div className="field"><label>Nome Fantasia / Nome</label><input value={cf.empresa} onChange={e=>setCf(f=>({...f,empresa:e.target.value}))} placeholder="Nome fantasia"/></div>
              <div className="field"><label>Razão Social</label><input value={cf.razao} onChange={e=>setCf(f=>({...f,razao:e.target.value}))} placeholder="Razão social"/></div>
              <div className="field"><label>Nome do Contato</label><input value={cf.contato} onChange={e=>setCf(f=>({...f,contato:e.target.value}))} placeholder="Responsável"/></div>
              <div className="field"><label>E-mail</label><input type="email" value={cf.email} onChange={e=>setCf(f=>({...f,email:e.target.value}))} placeholder="email@empresa.com"/></div>
              <div className="field"><label>Telefone / WhatsApp</label><input value={cf.telefone} onChange={e=>setCf(f=>({...f,telefone:e.target.value}))} placeholder="(00) 00000-0000"/></div>
              <div className="field"><label>CEP</label>
                <div style={{display:'flex',gap:6}}>
                  <input value={cf.cep} onChange={e=>setCf(f=>({...f,cep:e.target.value}))} placeholder="00000-000" style={{flex:1}}
                    onBlur={e=>e.target.value.replace(/\D/g,'').length>=8&&buscarCep(e.target.value)}/>
                  <button onClick={()=>buscarCep(cf.cep)} disabled={buscandoCep}
                    style={{padding:'8px 12px',borderRadius:8,background:'rgba(0,212,255,.15)',border:'1px solid rgba(0,212,255,.3)',color:'var(--accent)',cursor:'pointer',fontSize:12,fontFamily:'DM Mono,monospace',whiteSpace:'nowrap'}}>
                    {buscandoCep?'⏳':'📍 Buscar'}
                  </button>
                </div>
              </div>
              <div className="field"><label>Endereço</label><input value={cf.logradouro} onChange={e=>setCf(f=>({...f,logradouro:e.target.value}))} placeholder="Rua, número"/></div>
              <div className="field"><label>Bairro</label><input value={cf.bairro} onChange={e=>setCf(f=>({...f,bairro:e.target.value}))} placeholder="Bairro"/></div>
              <div className="field"><label>Cidade</label><input value={cf.cidade} onChange={e=>setCf(f=>({...f,cidade:e.target.value}))} placeholder="Cidade"/></div>
              <div className="field"><label>Estado</label><input value={cf.uf} onChange={e=>setCf(f=>({...f,uf:e.target.value}))} placeholder="UF" maxLength={2}/></div>
              <div className="field"><label>CPF do Contato Principal</label><input value={cf.cpfContato} onChange={e=>setCf(f=>({...f,cpfContato:e.target.value}))} placeholder="000.000.000-00"/></div>
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

            {/* Responsáveis — sempre visíveis */}
            <div style={{marginTop:16,padding:14,background:'rgba(251,191,36,.06)',border:'1px solid rgba(251,191,36,.2)',borderRadius:10}}>
              <div style={{fontSize:11,color:'var(--gold)',letterSpacing:1.5,textTransform:'uppercase',marginBottom:10}}>🔧 Responsável pela Implantação</div>
              <div className="modal-grid3">
                {[['Nome','rimpNome'],['E-mail','rimpEmail'],['Telefone','rimpTel']].map(([l,k])=><div key={k} className="field"><label>{l}</label><input value={cf[k]||''} onChange={e=>setCf(f=>({...f,[k]:e.target.value}))} placeholder={l}/></div>)}
              </div>
            </div>
            <div style={{marginTop:12,padding:14,background:'rgba(16,185,129,.06)',border:'1px solid rgba(16,185,129,.2)',borderRadius:10}}>
              <div style={{fontSize:11,color:'var(--accent3)',letterSpacing:1.5,textTransform:'uppercase',marginBottom:10}}>💰 Responsável Financeiro</div>
              <div className="modal-grid3">
                {[['Nome','rfinNome'],['E-mail','rfinEmail'],['Telefone','rfinTel']].map(([l,k])=><div key={k} className="field"><label>{l}</label><input value={cf[k]||''} onChange={e=>setCf(f=>({...f,[k]:e.target.value}))} placeholder={l}/></div>)}
              </div>
            </div>
          </div>
          <div className="modal-footer">
            <button className="btn-cancel" onClick={()=>setShowClient(false)}>Cancelar</button>
            <button className="btn-primary" onClick={saveClient}>
              {clientMode==='proposta'?'✅ Salvar e Gerar Proposta':'📝 Avançar'}
            </button>
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
            <div style={{fontSize:12,color:'var(--muted)',marginTop:2}}>Passo {wizStep} de 2</div>
            <button className="modal-close" onClick={()=>setShowWiz(false)}>✕</button>
          </div>
          <div className="modal-body">
            {wizStep===1&&<>
              <div className="wiz-title">💳 Condição de Pagamento da Adesão</div>
              <div style={{fontSize:13,color:'var(--muted)',marginBottom:12}}>Valor da Adesão: <strong style={{color:'var(--text)'}}>{fmt(wizTAd)}</strong></div>
              <div className="wiz-sec">PAGAMENTO À VISTA</div>
              <div className={`pay-opt${wizPay==='pix'?' sel':''}`} onClick={()=>setWizPay('pix')}>
                <span>🏦</span><div style={{flex:1}}><div className="po-t">PIX ou Boleto à vista</div><div className="po-s">Pagamento único</div></div>
                <div className="po-v">{fmt(wizTAd)}</div>
              </div>
              <div className="wiz-sec" style={{marginTop:14}}>CARTÃO DE CRÉDITO — SEM JUROS</div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>
                {Array.from({length:10},(_,i)=>i+1).map(n=>(
                  <div key={n} className={`pay-opt sm${wizPay===`cartao${n}x`?' sel':''}`} onClick={()=>setWizPay(`cartao${n}x`)}>
                    <span style={{fontSize:14}}>💳</span>
                    <div style={{flex:1}}><div className="po-t">{n}× sem juros</div></div>
                    <div className="po-v" style={{fontSize:12}}>{fmt(wizTAd/n)}/mês</div>
                  </div>
                ))}
              </div>
              <div className="wiz-sec" style={{marginTop:14}}>BOLETO PARCELADO</div>
              {[{n:2,desc:`Entrada ${fmt(wizTAd*0.5)} + ${fmt(wizTAd*0.5)} em 30d`},{n:3,desc:`Entrada ${fmt(wizTAd*0.5)} + 2× de ${fmt(wizTAd*0.25)}`}].map(o=>(
                <div key={o.n} className={`pay-opt${wizPay===`boleto${o.n}x`?' sel':''}`} onClick={()=>setWizPay(`boleto${o.n}x`)} style={{marginBottom:8}}>
                  <span>📄</span><div style={{flex:1}}><div className="po-t">{o.n}× no Boleto</div><div className="po-s">{o.desc}</div></div>
                  <div className="po-v">{fmt(wizTAd/o.n)}</div>
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
              <div style={{fontSize:13,color:'var(--muted)',margin:'4px 0 8px'}}>Vencimento 1ª Mensalidade ({fmt(wizTMen)}/mês)</div>
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

    {/* MODAL ENVIAR PARA ASSINATURA (original) */}
    {showSign&&signDoc&&(
      <div className="modal-overlay">
        <div className="modal-box" style={{maxWidth:520}}>
          <div className="modal-header">
            <h3>✍️ Enviar para Assinatura</h3>
            <div style={{fontSize:12,color:'var(--muted)',marginTop:3}}>
              {signDoc.type==='proposta'?'Proposta':'Contrato'} · {signDoc.clientName}
              {signSalvo&&<span style={{marginLeft:8,background:'rgba(16,185,129,.15)',color:'var(--accent3)',padding:'2px 8px',borderRadius:10,fontSize:11,fontWeight:600}}>✅ Salvo na nuvem</span>}
            </div>
            <button className="modal-close" onClick={()=>setShowSign(false)}>✕</button>
          </div>
          <div className="modal-body">
            {/* Link */}
            <div style={{marginBottom:16}}>
              <div style={{fontSize:10,color:'var(--muted)',textTransform:'uppercase',letterSpacing:1.5,marginBottom:6}}>Link de Assinatura</div>
              <div style={{display:'flex',gap:8}}>
                <input readOnly value={buildSignUrl(signDoc)}
                  style={{flex:1,background:'var(--surface2)',border:'1px solid var(--border)',borderRadius:8,padding:'8px 12px',fontFamily:'DM Mono,monospace',fontSize:12,color:'var(--accent)',outline:'none'}}/>
                <button onClick={()=>{navigator.clipboard.writeText(buildSignUrl(signDoc));}}
                  style={{padding:'8px 12px',borderRadius:8,background:'rgba(0,212,255,.1)',border:'1px solid rgba(0,212,255,.25)',color:'var(--accent)',cursor:'pointer',fontFamily:'DM Mono,monospace',fontSize:12,whiteSpace:'nowrap'}}>
                  📋 Copiar
                </button>
              </div>
            </div>
            {/* E-mail do cliente */}
            <div style={{marginBottom:16}}>
              <div style={{fontSize:10,color:'var(--muted)',textTransform:'uppercase',letterSpacing:1.5,marginBottom:6}}>E-mail do cliente</div>
              <input type="email" value={signEmailInput} onChange={e=>setSignEmailInput(e.target.value)}
                placeholder="email do cliente"
                style={{width:'100%',background:'var(--surface2)',border:'1px solid var(--border)',borderRadius:8,padding:'9px 12px',fontFamily:'DM Mono,monospace',fontSize:13,color:'var(--text)',outline:'none'}}/>
            </div>
            {/* Botões de envio */}
            <div style={{display:'flex',flexDirection:'column',gap:10}}>
              <button onClick={()=>enviarWhatsApp(signDoc)}
                style={{padding:'13px 16px',borderRadius:12,background:'linear-gradient(135deg,#25d366,#128c7e)',border:'none',color:'#fff',fontFamily:'DM Mono,monospace',fontSize:14,fontWeight:600,cursor:'pointer',display:'flex',alignItems:'center',gap:10}}>
                <span>💬</span> Enviar via WhatsApp
              </button>
              <button onClick={()=>enviarEmail(signDoc)}
                style={{padding:'13px 16px',borderRadius:12,background:'linear-gradient(135deg,#0f172a,#1e3a5f)',border:'1px solid rgba(0,212,255,.3)',color:'var(--accent)',fontFamily:'DM Mono,monospace',fontSize:14,fontWeight:600,cursor:'pointer',display:'flex',alignItems:'center',gap:10}}>
                <span>📧</span> Enviar por E-mail
              </button>
              <button onClick={()=>{setShowSign(false);setSelfNome(cf.contato||'');setSelfCpf(cf.cpfContato||'');setSelfEmail(cf.email||'');setSelfAgreed(false);setSelfErro('');setShowSelfSign(true)}}
                style={{padding:'13px 16px',borderRadius:12,background:'linear-gradient(135deg,rgba(251,191,36,.2),rgba(251,191,36,.08))',border:'1px solid rgba(251,191,36,.4)',color:'var(--gold)',fontFamily:'DM Mono,monospace',fontSize:14,fontWeight:600,cursor:'pointer',display:'flex',alignItems:'center',gap:10}}>
                <span>👆</span> Assinar agora (esta tela)
              </button>
              <button onClick={()=>setShowSign(false)}
                style={{padding:'11px',borderRadius:10,background:'rgba(100,116,139,.12)',border:'1px solid var(--border)',color:'var(--muted)',fontFamily:'DM Mono,monospace',fontSize:13,cursor:'pointer'}}>
                Fechar
              </button>
            </div>
          </div>
        </div>
      </div>
    )}

    {/* MODAL ASSINAR AGORA */}
    {showSelfSign&&(
      <div className="modal-overlay">
        <div className="modal-box" style={{maxWidth:500}}>
          <div className="modal-header">
            <h3>✍️ Assinar Documento</h3>
            <button className="modal-close" onClick={()=>setShowSelfSign(false)}>✕</button>
          </div>
          <div className="modal-body">
            <p style={{fontSize:13,color:'var(--muted)',lineHeight:1.7,marginBottom:16}}>
              Preencha os dados abaixo para registrar a assinatura eletrônica do cliente conforme a <strong style={{color:'var(--text)'}}>Lei nº 14.063/2020</strong>.
            </p>
            <div className="field"><label>Nome completo *</label><input value={selfNome} onChange={e=>setSelfNome(e.target.value)} placeholder="Nome completo"/></div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
              <div className="field"><label>CPF *</label><input value={selfCpf} onChange={e=>setSelfCpf(e.target.value)} placeholder="000.000.000-00"/></div>
              <div className="field"><label>E-mail *</label><input type="email" value={selfEmail} onChange={e=>setSelfEmail(e.target.value)} placeholder="email"/></div>
            </div>
            <div onClick={()=>setSelfAgreed(!selfAgreed)}
              style={{display:'flex',alignItems:'flex-start',gap:12,padding:'12px 14px',background:selfAgreed?'rgba(16,185,129,.06)':'var(--surface2)',border:`1px solid ${selfAgreed?'rgba(16,185,129,.3)':'var(--border)'}`,borderRadius:10,cursor:'pointer',marginTop:4}}>
              <div style={{width:18,height:18,borderRadius:5,border:`2px solid ${selfAgreed?'var(--accent3)':'var(--border)'}`,background:selfAgreed?'var(--accent3)':'transparent',flexShrink:0,display:'flex',alignItems:'center',justifyContent:'center',marginTop:2}}>
                {selfAgreed&&<span style={{color:'#fff',fontSize:11,fontWeight:700}}>✓</span>}
              </div>
              <p style={{fontSize:12,color:'var(--muted)',lineHeight:1.6,margin:0}}>Declaro que li e concordo com todos os termos e condições do documento, conforme a Lei nº 14.063/2020.</p>
            </div>
            {selfErro&&<div style={{padding:'10px 14px',background:'rgba(239,68,68,.1)',border:'1px solid rgba(239,68,68,.3)',borderRadius:8,fontSize:12,color:'var(--danger)',marginTop:12}}>⚠️ {selfErro}</div>}
          </div>
          <div className="modal-footer">
            <button className="btn-cancel" onClick={()=>setShowSelfSign(false)}>Cancelar</button>
            <button className="btn-primary" onClick={confirmarSelfSign} disabled={selfSaving}>
              {selfSaving?'⏳ Registrando...':'✅ Confirmar Assinatura'}
            </button>
          </div>
        </div>
      </div>
    )}
  </>)
}

// ── CSS ───────────────────────────────────────────────────────
const CSS=`
  :root{--bg:#0a0f1e;--surface:#111827;--surface2:#1a2540;--border:#1e2d4a;--accent:#00d4ff;--accent2:#7c3aed;--accent3:#10b981;--text:#e2e8f0;--muted:#64748b;--user-bubble:#1e3a5f;--bot-bubble:#131f35;--danger:#ef4444;--warning:#f59e0b;--gold:#fbbf24;--card-bg:#1a2540;--shadow:0 4px 24px rgba(0,0,0,.4)}
  *{box-sizing:border-box;margin:0;padding:0}html{font-size:15px}
  body{font-family:'DM Mono',monospace;background:var(--bg);color:var(--text);min-height:100vh;display:flex;flex-direction:column;align-items:center;overflow-x:hidden}
  body::before{content:'';position:fixed;inset:0;background-image:linear-gradient(rgba(0,212,255,.025) 1px,transparent 1px),linear-gradient(90deg,rgba(0,212,255,.025) 1px,transparent 1px);background-size:40px 40px;pointer-events:none;z-index:0}
  .orb{position:fixed;border-radius:50%;filter:blur(120px);pointer-events:none;z-index:0;opacity:.1}
  .orb1{width:500px;height:500px;background:var(--accent);top:-200px;right:-150px}
  .orb2{width:400px;height:400px;background:var(--accent2);bottom:-150px;left:-100px}
  header{position:sticky;top:0;z-index:100;width:100%;max-width:860px;padding:12px 20px;display:flex;align-items:center;gap:10px;flex-wrap:wrap;background:rgba(10,15,30,.85);backdrop-filter:blur(12px);border-bottom:1px solid var(--border)}
  .header-logo{display:flex;align-items:center}
  .header-text p{font-size:11px;color:var(--muted)}
  .status-dot{display:flex;align-items:center;gap:6px;font-size:11px;color:var(--accent3)}
  .status-dot::before{content:'';width:7px;height:7px;background:var(--accent3);border-radius:50%;animation:pulse 2s infinite}
  @keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}
  .logout-btn{background:none;border:none;cursor:pointer;color:var(--muted);font-size:11px;padding:5px 9px;border-radius:8px;font-family:'DM Mono',monospace}
  .logout-btn:hover{color:var(--danger)}
  .chat-wrap{position:relative;z-index:10;width:100%;max-width:820px;padding:14px 20px 0;flex:1;display:flex;flex-direction:column}
  #messages{display:flex;flex-direction:column;gap:14px;padding-bottom:20px;min-height:400px;max-height:calc(100vh - 200px);overflow-y:auto;scroll-behavior:smooth}
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
  .reset-btn{width:100%;padding:10px;border-radius:10px;background:rgba(100,116,139,.1);border:1px solid var(--border);color:var(--muted);font-family:'DM Mono',monospace;font-size:12px;cursor:pointer;margin-top:4px}
  .reset-btn:hover{color:var(--text)}
  .timer-live{text-align:center;font-size:28px;font-weight:700;font-family:'Syne',sans-serif;color:var(--gold);letter-spacing:3px;padding:10px;background:rgba(251,191,36,.08);border:1px solid rgba(251,191,36,.25);border-radius:10px;margin:8px 0}
  #chips{display:flex;gap:8px;flex-wrap:wrap;padding:8px 0 4px}
  .chip{background:var(--surface2);border:1px solid var(--border);border-radius:8px;padding:6px 12px;font-family:'DM Mono',monospace;font-size:12px;color:var(--muted);cursor:pointer;transition:all .2s}
  .chip:hover{color:var(--accent);border-color:var(--accent)}
  #inputArea{display:flex;gap:10px;align-items:flex-end;padding:14px 0 20px}
  #userInput{flex:1;background:var(--surface);border:1px solid var(--border);border-radius:14px;padding:12px 16px;font-family:'DM Mono',monospace;font-size:15px;color:var(--text);outline:none;resize:none;line-height:1.5;transition:border-color .2s;min-height:48px}
  #userInput:focus{border-color:var(--accent);box-shadow:0 0 0 3px rgba(0,212,255,.08)}
  #userInput::placeholder{color:var(--muted)}
  .send-btn{width:48px;height:48px;border-radius:12px;background:linear-gradient(135deg,var(--accent),#0099bb);border:none;color:#fff;cursor:pointer;display:flex;align-items:center;justify-content:center;flex-shrink:0;transition:all .2s}
  .send-btn:hover{box-shadow:0 0 16px rgba(0,212,255,.4);transform:translateY(-1px)}
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
  .field{margin-bottom:10px}.field label,.field-label{font-size:11px;color:var(--muted);display:block;margin-bottom:4px;letter-spacing:.5px}
  .field input,.field-input{width:100%;background:var(--surface2);border:1px solid var(--border);border-radius:8px;padding:9px 12px;font-family:'DM Mono',monospace;font-size:13px;color:var(--text);outline:none;transition:border-color .2s}
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
  @keyframes spin{to{transform:rotate(360deg)}}
`
