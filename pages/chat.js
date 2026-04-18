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
import Navbar from '../components/Navbar'

// ══════════════════════════════════════════════════════════════
// COMPONENTE DocumentoPreviewModal
// Exibe proposta/contrato gerado em tela com botões de ação
// ══════════════════════════════════════════════════════════════
function DocumentoPreviewModal({ docPreview, onClose, cfg, empresaId, userProfile, onSalvarCRM }) {
  const [enviandoAssComp, setEnviandoAssComp] = useState(false)
  const [linkAssinatura,  setLinkAssinatura]  = useState('')
  const [msgEnvio,        setMsgEnvio]        = useState('')
  const [showEnvioOpcoes, setShowEnvioOpcoes] = useState(false)
  const [emailEnvio,      setEmailEnvio]      = useState('')
  const [salvandoCRM,     setSalvandoCRM]     = useState(false)

  if (!docPreview) return null

  const { html, tipo, clienteEmail, clienteNome, clienteTel, signToken, hasDocx, docxNome } = docPreview
  const isContrato = tipo === 'contrato'

  // Preenche email do cliente
  if (!emailEnvio && clienteEmail) setEmailEnvio(clienteEmail)

  // ── 1. Imprimir ──
  function handleImprimir() {
    const win = window.open('', '_blank', 'width=900,height=700')
    if (!win) { alert('Permita popups.'); return }
    win.document.write(`<!DOCTYPE html>
<html><head><meta charset="UTF-8">
<title>${isContrato ? 'Contrato' : 'Proposta'}</title>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=Syne:wght@700;800&display=swap" rel="stylesheet">
<style>
  body{font-family:Inter,sans-serif;background:#fff;color:#1e293b;margin:0;padding:24px}
  @media print{body{padding:0} .print-btn{display:none!important}}
  .print-btn{position:fixed;top:16px;right:16px;padding:10px 20px;background:#0f172a;border:none;border-radius:8px;color:#fff;font-weight:700;cursor:pointer;font-size:14px;z-index:999}
</style>
</head><body>
<button class="print-btn" onclick="window.print()">🖨 Imprimir / Salvar PDF</button>
${html}
</body></html>`)
    win.document.close()
    win.focus()
    setTimeout(() => win.print(), 800)
  }

  // ── 2. Baixar DOCX ──
  function handleBaixarDocx() {
    if (window._vxDocxBlob?.blob) {
      const url = URL.createObjectURL(window._vxDocxBlob.blob)
      const a = document.createElement('a')
      a.href = url
      a.download = window._vxDocxBlob.nome || (isContrato ? 'contrato.docx' : 'proposta.docx')
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } else {
      alert('Arquivo DOCX ainda sendo preparado. Aguarde um instante.')
    }
  }

  // ── 3. Salvar no CRM ──
  async function handleSalvarCRM() {
    setSalvandoCRM(true)
    try {
      if (onSalvarCRM) await onSalvarCRM(docPreview)
      setMsgEnvio('✅ Salvo no CRM com sucesso!')
    } catch (err) {
      setMsgEnvio('❌ Erro ao salvar no CRM: ' + err.message)
    }
    setSalvandoCRM(false)
  }

  // ── 4. Enviar para assinatura (contrato) ──
  async function handleEnviarAssinatura() {
    if (!clienteEmail && !clienteTel) { setMsgEnvio('⚠️ Cliente sem e-mail ou telefone cadastrado.'); return }

    setEnviandoAssComp(true); setMsgEnvio('')
    try {
      const token  = signToken || `${empresaId}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
      const expiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()

      await supabase.from('vx_storage').upsert({
        key:   `sign:${token}`,
        value: JSON.stringify({
          token, empresaId, html,
          clienteNome, clienteEmail, clienteTel,
          status: 'pendente',
          criadoEm: new Date().toISOString(),
          expiry,
        }),
        updated_at: new Date().toISOString(),
      }, { onConflict: 'key' })

      const baseUrl  = cfg.signConfig?.url || (typeof window !== 'undefined' ? window.location.origin : '')
      const signLink = `${baseUrl}/sign/${token}`
      setLinkAssinatura(signLink)
      setShowEnvioOpcoes(true)
      setMsgEnvio(`✅ Link de assinatura gerado!`)
    } catch (err) {
      setMsgEnvio(`❌ Erro: ${err.message}`)
    }
    setEnviandoAssComp(false)
  }

  // ── 5. Enviar proposta para cliente (WhatsApp / Email) ──
  function handleEnviarPropostaWpp() {
    const msg = encodeURIComponent(`Olá ${clienteNome || 'cliente'}! Segue abaixo a proposta comercial da ${cfg.company || 'Vivanexa'}.\n\nAcesse o link para visualizar:\n${window.location.origin}/sign/${signToken}`)
    const tel = (clienteTel||'').replace(/\D/g,'')
    window.open(tel ? `https://wa.me/${tel}?text=${msg}` : `https://wa.me/?text=${msg}`, '_blank')
    setMsgEnvio('✅ WhatsApp aberto com o link da proposta!')
  }
  function handleEnviarPropostaEmail() {
    const subj = encodeURIComponent(`Proposta Comercial – ${cfg.company || 'Vivanexa'}`)
    const body = encodeURIComponent(`Olá ${clienteNome || 'cliente'},\n\nSegue a proposta comercial.\n\nLink: ${window.location.origin}/sign/${signToken}\n\n${cfg.company || 'Vivanexa'}`)
    window.open(`mailto:${emailEnvio||clienteEmail||''}?subject=${subj}&body=${body}`, '_blank')
    setMsgEnvio('✅ E-mail aberto com a proposta!')
  }

  const acaoBtn = (cor, disabled = false) => ({
    padding: '8px 16px', borderRadius: 8, fontFamily: 'DM Mono, monospace', fontSize: 13,
    fontWeight: 600, cursor: disabled ? 'not-allowed' : 'pointer', whiteSpace: 'nowrap',
    background: cor + '18', border: `1px solid ${cor}44`, color: cor,
    opacity: disabled ? 0.6 : 1, transition: 'all .15s',
  })

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.88)', zIndex: 3000, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Barra de ações */}
      <div style={{ background: '#0a0f1e', borderBottom: '1px solid #1e2d4a', display: 'flex', alignItems: 'center', gap: 10, padding: '12px 20px', flexShrink: 0, flexWrap: 'wrap' }}>
        <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, color: '#00d4ff', fontSize: 15, marginRight: 8 }}>
          {isContrato ? '📄 Contrato' : '📋 Proposta'} gerado
        </div>
        <button onClick={handleImprimir} style={acaoBtn('#00d4ff')}>🖨 Imprimir / PDF</button>
        {hasDocx && (
          <button onClick={handleBaixarDocx} style={acaoBtn('#7c3aed')}>💾 Baixar DOCX</button>
        )}
        <button onClick={handleSalvarCRM} disabled={salvandoCRM} style={acaoBtn('#10b981', salvandoCRM)}>
          {salvandoCRM ? '⏳...' : '💼 Salvar no CRM'}
        </button>
        {isContrato ? (
          <button onClick={handleEnviarAssinatura} disabled={enviandoAssComp} style={acaoBtn('#f59e0b', enviandoAssComp)}>
            {enviandoAssComp ? '⏳ Gerando...' : '✍️ Enviar para Assinatura'}
          </button>
        ) : (
          <button onClick={() => setShowEnvioOpcoes(v => !v)} style={acaoBtn('#10b981')}>
            📤 Enviar para Cliente
          </button>
        )}
        <div style={{ flex: 1 }} />
        <button onClick={onClose} style={{ padding: '8px 18px', borderRadius: 8, background: 'rgba(0,212,255,.15)', border: '1px solid rgba(0,212,255,.35)', color: '#00d4ff', fontFamily: 'DM Mono, monospace', fontSize: 13, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
          ← Voltar ao Chat
        </button>
      </div>

      {/* Painel de envio proposta */}
      {!isContrato && showEnvioOpcoes && (
        <div style={{ background: '#111827', borderBottom: '1px solid #1e2d4a', padding: '12px 20px', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 12, color: '#64748b' }}>Enviar para:</span>
          <input
            value={emailEnvio}
            onChange={e => setEmailEnvio(e.target.value)}
            placeholder="email do cliente"
            style={{ background: '#1a2540', border: '1px solid #1e2d4a', borderRadius: 6, padding: '6px 10px', color: '#e2e8f0', fontFamily: 'DM Mono, monospace', fontSize: 12, width: 220 }}
          />
          <button onClick={handleEnviarPropostaWpp} style={acaoBtn('#25d366')}>💬 WhatsApp</button>
          <button onClick={handleEnviarPropostaEmail} style={acaoBtn('#00d4ff')}>📧 E-mail</button>
        </div>
      )}

      {/* Painel de opções de assinatura */}
      {isContrato && showEnvioOpcoes && linkAssinatura && (
        <div style={{ background: '#111827', borderBottom: '1px solid #1e2d4a', padding: '12px 20px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 12, color: '#64748b' }}>Link de assinatura:</span>
            <code style={{ fontSize: 11, color: '#00d4ff', wordBreak: 'break-all', flex: 1 }}>{linkAssinatura}</code>
            <button onClick={() => { navigator.clipboard?.writeText(linkAssinatura); setMsgEnvio('✅ Link copiado!') }} style={{ ...acaoBtn('#00d4ff'), padding: '4px 10px', fontSize: 11 }}>📋 Copiar</button>
          </div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <button onClick={() => {
              const msg = encodeURIComponent(`📄 Olá ${clienteNome || 'cliente'}!\n\nSeu contrato está pronto para assinatura.\n\n${linkAssinatura}\n\n_Válido por 7 dias._`)
              const tel = (clienteTel||'').replace(/\D/g,'')
              window.open(tel ? `https://wa.me/${tel}?text=${msg}` : `https://wa.me/?text=${msg}`, '_blank')
            }} style={acaoBtn('#25d366')}>💬 Enviar via WhatsApp</button>
            <button onClick={() => {
              const subj = encodeURIComponent(`Contrato para Assinatura – ${cfg.company || 'Vivanexa'}`)
              const body = encodeURIComponent(`Olá ${clienteNome || 'cliente'},\n\nSeu contrato está pronto para assinatura eletrônica.\n\nLink: ${linkAssinatura}\n\nVálido por 7 dias.\n\n${cfg.company || 'Vivanexa'}`)
              window.open(`mailto:${clienteEmail||''}?subject=${subj}&body=${body}`, '_blank')
            }} style={acaoBtn('#00d4ff')}>📧 Enviar por E-mail</button>
            <button onClick={() => {
              // Abrir link de assinatura nesta própria tela
              window.open(linkAssinatura, '_blank')
            }} style={acaoBtn('#f59e0b')}>🖊 Assinar agora (esta tela)</button>
          </div>
        </div>
      )}

      {/* Mensagem de status */}
      {msgEnvio && (
        <div style={{ padding: '10px 20px', background: msgEnvio.startsWith('✅') ? 'rgba(16,185,129,.12)' : 'rgba(239,68,68,.12)', borderBottom: '1px solid rgba(16,185,129,.2)', fontSize: 13, color: msgEnvio.startsWith('✅') ? '#10b981' : '#ef4444' }}>
          {msgEnvio}
        </div>
      )}

      {/* Preview do documento */}
      <div style={{ flex: 1, overflow: 'auto', padding: 24, background: '#f0f4f8' }}>
        <div
          style={{ maxWidth: 860, margin: '0 auto', background: '#fff', borderRadius: 12, boxShadow: '0 8px 40px rgba(0,0,0,.2)', overflow: 'hidden' }}
          dangerouslySetInnerHTML={{ __html: html }}
        />
      </div>
    </div>
  )
}

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
  const adPct=vo?Number(vo.discAdPct||0):(cfg.discAdPct!==undefined?Number(cfg.discAdPct):50)
  const menPct=vo?Number(vo.discMenPct||0):(cfg.discMenPct!==undefined?Number(cfg.discMenPct):0)
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

// ══════════════════════════════════════════════════════════════
// DOCX — Detecção de tipo e geração com substituição de variáveis
// ══════════════════════════════════════════════════════════════

/**
 * Detecta se o template é DOCX (base64/data-url) ou HTML puro.
 */
function detectarTipoTemplate(template) {
  if (!template) return 'html'
  if (
    template.startsWith('data:application/vnd') ||
    template.startsWith('data:application/octet') ||
    template.startsWith('data:application/zip')
  ) return 'docx'
  // Base64 puro sem prefixo: long string sem espaços e chars válidos
  if (template.length > 500 && /^[A-Za-z0-9+/=]+$/.test(template.slice(0, 100))) return 'docx'
  return 'html'
}

/**
 * Carrega dinamicamente PizZip e Docxtemplater via CDN (apenas uma vez).
 */
async function loadDocxLibs() {
  if (window._pizZipLoaded) return { PizZip: window.PizZip, Docxtemplater: window.docxtemplater }
  await new Promise((res, rej) => {
    const s1 = document.createElement('script')
    s1.src = 'https://unpkg.com/pizzip@3.1.7/dist/pizzip.js'
    s1.onload = () => {
      const s2 = document.createElement('script')
      s2.src = 'https://unpkg.com/docxtemplater@3.49.0/build/docxtemplater.js'
      s2.onload = () => { window._pizZipLoaded = true; res() }
      s2.onerror = rej
      document.head.appendChild(s2)
    }
    s1.onerror = rej
    document.head.appendChild(s1)
  })
  return { PizZip: window.PizZip, Docxtemplater: window.docxtemplater }
}

/**
 * Gera e baixa um DOCX com variáveis substituídas.
 * Retorna true se o DOCX foi baixado com sucesso.
 */
async function gerarEBaixarDocx(templateBase64, variaveis, nomeArquivo) {
  try {
    const { PizZip, Docxtemplater } = await loadDocxLibs()
    if (!PizZip || !Docxtemplater) throw new Error('Libs não carregadas')

    let b64 = templateBase64
    if (b64.includes(',')) b64 = b64.split(',')[1]
    const binaryStr = atob(b64)
    const bytes = new Uint8Array(binaryStr.length)
    for (let i = 0; i < binaryStr.length; i++) bytes[i] = binaryStr.charCodeAt(i)

    const zip = new PizZip(bytes.buffer)
    // Tenta primeiro com delimitadores padrão {variavel}
    // Se falhar, tenta com delimitadores duplos {{variavel}}
    let doc
    try {
      doc = new Docxtemplater(zip, { paragraphLoop: true, nullGetter: () => '', delimiters: { start: '{', end: '}' } })
      doc.render(variaveis)
    } catch(e1) {
      try {
        const zip2 = new PizZip(bytes.buffer)
        doc = new Docxtemplater(zip2, { paragraphLoop: true, nullGetter: () => '', delimiters: { start: '{{{', end: '}}}' } })
        doc.render(variaveis)
      } catch(e2) {
        // Fallback: delimitadores padrão sem erro
        const zip3 = new PizZip(bytes.buffer)
        doc = new Docxtemplater(zip3, { paragraphLoop: true, nullGetter: () => '' })
        doc.render(variaveis)
      }
    }

    const blob = doc.getZip().generate({
      type: 'blob',
      mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      compression: 'DEFLATE',
    })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = nomeArquivo
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    return true
  } catch (err) {
    console.error('Erro ao gerar DOCX:', err)
    // Fallback: baixa o template original sem substituição
    try {
      let b64 = templateBase64
      if (b64.includes(',')) b64 = b64.split(',')[1]
      const bin = atob(b64)
      const bytes = new Uint8Array(bin.length)
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
      const blob = new Blob([bytes], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = nomeArquivo
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch {}
    return false
  }
}

/**
 * Renderiza variáveis num DOCX template e retorna Blob.
 * Tenta delimitadores {var} e {{var}} automaticamente.
 */
async function renderDocxBlob(templateBase64, variaveis) {
  const { PizZip, Docxtemplater } = await loadDocxLibs()
  if (!PizZip || !Docxtemplater) throw new Error('Libs não carregadas')

  const toBytes = (b64) => {
    let b = b64; if (b.includes(',')) b = b.split(',')[1]
    const bin = atob(b); const bytes = new Uint8Array(bin.length)
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
    return bytes
  }

  // O Word às vezes divide tags {{var}} em múltiplos runs de XML
  // ex: {{pla</w:t><w:t>no}} → causa "Duplicate close tag"
  // A opção linebreaks:true + parser tolerante resolve isso
  const tryRender = (delimiters) => {
    const zip = new PizZip(toBytes(templateBase64).buffer)
    const opts = {
      paragraphLoop: true,
      linebreaks: true,
      nullGetter: () => '',
      // Parser tolerante: nunca lança erro para variável desconhecida
      parser: (tag) => ({ get: (scope) => {
        const val = tag.split('.').reduce((o, k) => (o && o[k] !== undefined ? o[k] : undefined), scope)
        return val !== undefined ? val : ''
      }})
    }
    if (delimiters) opts.delimiters = delimiters
    const doc = new Docxtemplater(zip, opts)
    doc.render(variaveis)
    return doc.getZip().generate({
      type: 'blob',
      mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      compression: 'DEFLATE',
    })
  }

  // Tenta delimitadores padrão {var} primeiro, depois {{var}}, depois sem substituição
  try { return tryRender(null) } catch(e1) {
    try { return tryRender({ start: '{{', end: '}}' }) } catch(e2) {
      console.warn('Ambos delimitadores falharam, baixando template sem substituição:', e2)
      // Fallback: retorna o template original sem substituição
      const bytes = toBytes(templateBase64)
      return new Blob([bytes], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' })
    }
  }
}

// ══════════════════════════════════════════════════════════════
// STRIP DOCX — remove base64 DOCX de qualquer objeto recursivamente
// Usado antes de qualquer upsert no Supabase para evitar 406
// ══════════════════════════════════════════════════════════════
function _isDocxStr(t) {
  return !!(t && typeof t === 'string' && (
    t.startsWith('data:application/vnd') ||
    t.startsWith('data:application/octet') ||
    t.startsWith('data:application/zip') ||
    (t.length > 500 && /^[A-Za-z0-9+/=]+$/.test(t.slice(0, 100)))
  ))
}
function stripDocxFromObj(obj) {
  if (!obj || typeof obj !== 'object') return obj
  if (Array.isArray(obj)) return obj.map(stripDocxFromObj)
  const out = {}
  for (const [k, v] of Object.entries(obj)) {
    if (_isDocxStr(v)) out[k] = ''
    else if (v && typeof v === 'object') out[k] = stripDocxFromObj(v)
    else out[k] = v
  }
  return out
}

// ── Build Proposta (com suporte a template) ──────────────────
function buildProposal(S,cfg,user,templateOverride){
  const isC=S.closingToday===true,cd=S.clientData||{},co=S.contactData||{}
  const today=new Date().toLocaleDateString('pt-BR')
  const tAd=isC?S.closingData?.tAd:(S.quoteData?.tAdD||0)
  const tMen=isC?S.closingData?.tMen:(S.quoteData?.tMenD||0)
  const results=isC?S.closingData?.results:S.quoteData?.results
  // Plano com fallback seguro — nunca deixa 'undefined' aparecer
  const plans=cfg.plans?.length?cfg.plans:DEFAULT_CFG.plans
  const planLabel=S.plan?getPlanLabel(S.plan,plans)||S.plan:'—'
  const rows=(results||[]).map(r=>{
    const adS=(r.isTributos||r.isEP)?'—':fmt(isC?r.ad:r.adD)
    return`<td style="padding:10px 14px"><div style="font-weight:600;color:#0f172a">${r.name}</div>${r.plan?`<div style="font-size:11px;color:#64748b">Plano ${getPlanLabel(r.plan,plans)||r.plan}</div>`:''}<\/td><td style="padding:10px 14px;text-align:center">${adS}<\/td><td style="padding:10px 14px;text-align:center">${fmt(isC?r.men:(r.menD||r.men))}<\/td>`
  }).join('')
  const field=(l,v)=>`<div><label style="font-size:10px;color:#64748b;text-transform:uppercase;display:block;margin-bottom:4px">${l}</label><div style="border:1px solid #e2e8f0;border-radius:6px;padding:8px 10px;font-size:13px;color:#1e293b;min-height:34px">${v||'—'}</div></div>`
  const sec=t=>`<div style="font-family:Syne,sans-serif;font-size:14px;font-weight:700;color:#0f172a;margin:0 0 13px;padding-bottom:8px;border-bottom:2px solid #e2e8f0;display:flex;align-items:center;gap:8px"><div style="width:8px;height:8px;background:#00d4ff;border-radius:50%;flex-shrink:0"></div>${t}</div>`

  // Prioridade: templateOverride > cfg.propostaTemplate > cfg.docTemplates?.proposta
  // Se for DOCX (data:application...), ignora e usa HTML hardcoded como preview
  let template = templateOverride || cfg.propostaTemplate || cfg.docTemplates?.proposta || ''
  const isDocxTpl = _isDocxStr(template)
  if (template && !isDocxTpl) {
    // Template HTML: substitui variáveis
    const vars = {
      '{{empresa}}': co.empresa||cd.fantasia||cd.nome||'',
      '{{razao}}': co.razao||cd.nome||'',
      '{{cnpj}}': fmtDoc(S.doc||''),
      '{{contato}}': co.contato||'',
      '{{email}}': co.email||cd.email||'',
      '{{telefone}}': co.telefone||cd.telefone||'',
      '{{cidade}}': co.cidade||cd.municipio||'',
      '{{uf}}': co.uf||cd.uf||'',
      '{{plano}}': planLabel,
      '{{cnpjs_qty}}': String(S.cnpjs||'0'),
      '{{total_adesao}}': fmt(tAd),
      '{{total_mensalidade}}': fmt(tMen),
      '{{total_mensal}}': fmt(tMen),
      '{{data_hoje}}': today,
      '{{consultor_nome}}': user?.nome||'',
      '{{consultor_tel}}': user?.perfil?.telefone || user?.telefone || '',
      '{{company}}': cfg.company||'Vivanexa',
      '{{produtos_tabela}}': `<table style="width:100%;border-collapse:collapse;font-size:13px"><thead><tr style="background:#f8fafc"><th style="padding:10px 14px;text-align:left">Módulo</th><th style="padding:10px 14px;text-align:center">Adesão</th><th style="padding:10px 14px;text-align:center">Mensalidade</th><\/tr><\/thead><tbody>${rows}<\/tbody><\/table>`
    }
    for (const [k, v] of Object.entries(vars)) {
      template = template.replace(new RegExp(k.replace(/[{}]/g,'\\$&'), 'g'), v)
    }
    return `<div style="background:#fff;font-family:Inter,sans-serif;color:#1e293b;max-width:820px;margin:0 auto">${template}</div>`
  }

  return`<div style="background:#fff;font-family:Inter,sans-serif;color:#1e293b;max-width:820px;margin:0 auto">
  <div style="background:linear-gradient(135deg,#0f172a,#1e3a5f);padding:32px 44px">
    ${cfg.logob64?`<img src="${cfg.logob64}" style="height:52px;object-fit:contain;margin-bottom:10px;display:block">`:`<div style="font-size:22px;font-weight:900;color:#00d4ff;letter-spacing:2px;margin-bottom:10px">${cfg.company||'Vivanexa'}</div>`}
    <div style="font-size:11px;color:#64748b;letter-spacing:2px;text-transform:uppercase;margin-bottom:18px">Proposta Comercial</div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
      <div><div style="font-size:10px;color:#64748b;text-transform:uppercase;letter-spacing:1px;margin-bottom:3px">Data</div><div style="font-size:13px;color:#e2e8f0;font-weight:500">${today}</div></div>
      <div><div style="font-size:10px;color:#64748b;text-transform:uppercase;letter-spacing:1px;margin-bottom:3px">Validade</div><div style="font-size:13px;color:#e2e8f0;font-weight:500">${isC?'Válida até as 18h de hoje':'Válida por 7 dias'}</div></div>
      <div><div style="font-size:10px;color:#64748b;text-transform:uppercase;letter-spacing:1px;margin-bottom:3px">Plano</div><div style="font-size:13px;color:#e2e8f0;font-weight:500">${planLabel}</div></div>
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

// ── Build Contrato com Manifesto de Assinatura ──
function buildContract(S, cfg, user, tAd, tMen, dateAd, dateMen, payMethod, token, signedData, templateOverride) {
  const cd = S.clientData || {}
  const co = S.contactData || {}
  const today = new Date().toLocaleDateString('pt-BR')
  const now = new Date().toLocaleString('pt-BR')
  const isC = S.closingToday === true
  const results = isC ? S.closingData?.results : S.quoteData?.results
  // Plano com fallback seguro
  const plans = cfg.plans?.length ? cfg.plans : DEFAULT_CFG.plans
  const planLabel = S.plan ? (getPlanLabel(S.plan, plans) || S.plan) : '—'

  const payLabel =
    payMethod === 'pix'
      ? 'PIX / Boleto à vista'
      : payMethod?.startsWith('cartao')
        ? `Cartão em até ${payMethod.replace('cartao', '').replace('x', '×')} sem juros`
        : payMethod?.startsWith('boleto')
          ? `Boleto ${payMethod.replace('boleto', '').replace('x', '×')}×`
          : payMethod

  const produtosVertical = (results || [])
    .map(r => {
      const adS = r.isTributos || r.isEP ? '—' : fmt(isC ? r.ad : r.adD || 0)
      const menS = fmt(isC ? r.men : r.menD || r.men || 0)
      const planoNome = r.plan ? (getPlanLabel(r.plan, plans) || r.plan) : ''
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

  const sec = (n, t) =>
    `<h3 style="font-family:Syne,sans-serif;font-size:14px;font-weight:700;color:#0f172a;margin:22px 0 10px;display:flex;align-items:center;gap:8px"><span style="width:8px;height:8px;background:#00d4ff;border-radius:50%;flex-shrink:0;display:inline-block"></span>${n} - ${t}</h3>`

  const row = (l, v) =>
    `<div style="margin-bottom:6px"><span style="font-size:12px;color:#64748b;min-width:120px;display:inline-block">${l}:</span><span style="font-size:13px;color:#1e293b;font-weight:500">${v || '—'}</span></div>`

  const endStr = [co.logradouro || cd.logradouro, co.bairro || cd.bairro, co.cidade || cd.municipio, co.uf || cd.uf]
    .filter(Boolean)
    .join(', ')

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
        <div style="font-size:12px;color:#374151;margin-bottom:4px"><strong>Assinado por:</strong> <span id="manifest-client-name">${signedData?.signedBy || co.contato || cd.fantasia || cd.nome || 'Aguardando'}</span></div>
        <div style="font-size:12px;color:#374151;margin-bottom:4px"><strong>CPF:</strong> <span id="manifest-client-cpf">${signedData?.signCPF || co.cpfContato || '—'}</span></div>
        <div style="font-size:12px;color:#374151;margin-bottom:4px"><strong>E-mail:</strong> <span id="manifest-client-email">${signedData?.clientEmail || co.email || cd.email || '—'}</span></div>
        <div style="font-size:12px;color:#374151;margin-bottom:4px"><strong>Data/Hora:</strong> <span id="manifest-client-date">${signedData?.signedAt || 'Aguardando assinatura'}</span></div>
        <div style="font-size:11px;color:#6b7280;margin-top:6px;padding-top:6px;border-top:1px solid #d1fae5"><strong>Token:</strong> ${docId}</div>
      </div>
      <div style="border:1px solid #6ee7b7;border-radius:8px;padding:16px;background:#fff">
        <div style="font-size:10px;color:#10b981;letter-spacing:1.5px;text-transform:uppercase;font-weight:700;margin-bottom:10px">✅ ASSINATURA DA CONTRATADA (CONSULTOR)</div>
        <div style="font-size:12px;color:#374151;margin-bottom:4px"><strong>Assinado por:</strong> <span id="manifest-consult-name">${signedData?.consultantSignedBy || user?.nome || '—'}</span></div>
        <div style="font-size:12px;color:#374151;margin-bottom:4px"><strong>Data/Hora:</strong> <span id="manifest-consult-date">${signedData?.consultantSignedAt || 'Aguardando assinatura'}</span></div>
        <div style="font-size:12px;color:#374151;margin-bottom:4px"><strong>E-mail:</strong> ${signedData?.consultantEmail || user?.email || '—'}</div>
      </div>
    </div>
    <div style="margin-top:16px;font-size:11px;color:#6b7280;line-height:1.6">
      Assinaturas eletrônicas simples conforme <strong>Lei nº 14.063/2020</strong> e MP 2.200-2/2001.<br>
      Documento: <strong>doc_${docId}</strong> · Verificação: <a href="https://assinatura.iti.gov.br" style="color:#10b981">assinatura.iti.gov.br</a>
    </div>
  </div>`

  // Template: usa DOCX ou HTML. Se DOCX, apenas gera HTML hardcoded como preview.
  let template = templateOverride || cfg.contratoTemplate || cfg.docTemplates?.contrato || ''
  const isDocxTpl = _isDocxStr(template)
  if (template && !isDocxTpl) {
    const vars = {
      '{{empresa}}': co.empresa || cd.fantasia || cd.nome || '',
      '{{razao}}': co.razao || cd.nome || '',
      '{{cnpj}}': fmtDoc(S.doc || ''),
      '{{contato}}': co.contato || '',
      '{{email}}': co.email || cd.email || '',
      '{{telefone}}': co.telefone || cd.telefone || '',
      '{{endereco}}': endStr,
      '{{regime}}': co.regime || '',
      '{{plano}}': planLabel,
      '{{cnpjs_qty}}': String(S.cnpjs || '0'),
      '{{total_adesao}}': fmt(tAd),
      '{{total_mensalidade}}': fmt(tMen),
      '{{total_mensal}}': fmt(tMen),
      '{{condicao_pagamento}}': payLabel,
      '{{vencimento_adesao}}': dateAd || '—',
      '{{vencimento_mensal}}': dateMen || '—',
      '{{data_hora}}': now,
      '{{data_hoje}}': today,
      '{{consultor_nome}}': user?.nome || '',
      '{{consultor_tel}}': user?.perfil?.telefone || user?.telefone || '',
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
      template = template.replace(new RegExp(k.replace(/[{}]/g,'\\$&'), 'g'), v)
    }
    if (!template.includes('MANIFESTO DE ASSINATURAS')) {
      template += manifesto
    }
    return `<div style="background:#fff;font-family:Inter,sans-serif;color:#1e293b;max-width:820px;margin:0 auto;font-size:13px;line-height:1.7">${template}</div>`
  }

  return `
  <div style="background:#fff;font-family:Inter,sans-serif;color:#1e293b;max-width:820px;margin:0 auto;font-size:13px;line-height:1.7">
    <div style="background:linear-gradient(135deg,#0f172a,#1e293b;padding:28px 44px;display:flex;align-items:center;gap:20px">
      ${cfg.logob64 ? `<img src="${cfg.logob64}" style="height:52px;object-fit:contain">` : '<div style="font-size:22px;font-weight:900;color:#00d4ff;letter-spacing:2px;margin-bottom:10px">' + cfg.company + '</div>'}
      <div>
        <h1 style="font-family:Syne,sans-serif;font-size:18px;font-weight:800;color:#fff;margin-bottom:4px">Termo de Pedido e Registro de Software</h1>
        <p style="font-size:12px;color:#64748b">Seja bem-vindo ao ${cfg.company || 'Vivanexa'}, é um prazer tê-lo como cliente.</p>
      </div>
    </div>
    <div style="padding:28px 44px">
      <div style="background:#f0f9ff;border:1px solid #bae6fd;border-radius:10px;padding:16px 20px;margin-bottom:20px;border-left:4px solid #00d4ff">
        <p style="font-size:13px;color:#0c4a6e;margin-bottom:6px">Segue abaixo os termos do pedido registrado com nosso time de vendas.</p>
        <p style="font-size:13px;color:#0c4a6e">Confira os dados abaixo com atenção e caso esteja tudo correto, basta <strong>ASSINAR</strong> para darmos seguimento ao treinamento e implantação.</p>
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
// TIMER GLOBAL (fora do React para não ser afetado por re-renders)
// Mesma lógica do HTML local que funciona
// ══════════════════════════════════════════════════════════════
function startTimerGlobal(deadline){
  if(window._vxTimerInt){clearInterval(window._vxTimerInt);window._vxTimerInt=null}
  window._vxTimerDeadline=deadline
  function tick(){
    const el=document.getElementById('vx-timer')
    if(!el) return // não encerra o interval — espera o React recriar o elemento
    const diff=deadline-new Date()
    if(diff<=0){el.textContent='EXPIRADO';el.style.color='var(--muted)';clearInterval(window._vxTimerInt);window._vxTimerInt=null;window._vxTimerDeadline=null;return}
    const hh=Math.floor(diff/3600000),mm=Math.floor((diff%3600000)/60000),ss=Math.floor((diff%60000)/1000)
    el.textContent=`${String(hh).padStart(2,'0')}:${String(mm).padStart(2,'0')}:${String(ss).padStart(2,'0')}`
  }
  tick()
  window._vxTimerInt=setInterval(tick,100) // 100ms: minimiza o flash após re-renders do React
}

// ══════════════════════════════════════════════════════════════
// BUILD DOCX VARS — Monta objeto com TODAS as variáveis do template
// Suporta tanto {variavel} quanto {{variavel}} no Word
// ══════════════════════════════════════════════════════════════
function buildDocxVars({S, c, userProfile, tAd, tMen, cd, co, wizPay='', wizAd='', wizMen=''}) {
  const payLabel = wizPay === 'pix' ? 'PIX / Boleto à vista'
    : wizPay?.startsWith('cartao') ? `Cartão em até ${wizPay.replace('cartao','').replace('x','×')} sem juros`
    : wizPay?.startsWith('boleto') ? `Boleto ${wizPay.replace('boleto','').replace('x','×')}×`
    : wizPay || ''

  const endStr = [co.logradouro||cd?.logradouro, co.bairro||cd?.bairro, co.cidade||cd?.municipio, co.uf||cd?.uf]
    .filter(Boolean).join(', ')

  const hoje = new Date().toLocaleDateString('pt-BR')
  const agora = new Date().toLocaleString('pt-BR')

  const vars = {
    // Contratada
    company:          c.company || 'VIVANEXA',
    razao_empresa:    c.razaoEmpresa || c.razao_empresa || c.company || '',
    cnpj_empresa:     c.cnpjEmpresa  || c.cnpj_empresa  || '',
    responsavel:      c.responsavel  || userProfile?.nome || '',
    telefone_empresa: c.telefone     || c.telefoneEmpresa || '',
    email_empresa:    c.emailEmpresa || c.email_empresa   || '',
    endereco_empresa: c.enderecoEmpresa || c.endereco_empresa || '',

    // Contratante (cliente)
    empresa:   co.empresa  || cd?.fantasia || cd?.nome || '',
    razao:     co.razao    || cd?.nome     || '',
    cpf:       isCPF(S.doc||'') ? fmtDoc(S.doc||'') : '',
    cnpj:      fmtDoc(S.doc||''),
    doc:       fmtDoc(S.doc||''),
    contato:   co.contato  || '',
    email:     co.email    || cd?.email    || '',
    telefone:  co.telefone || cd?.telefone || '',
    endereco:  endStr,
    cidade:    co.cidade   || cd?.municipio || '',
    uf:        co.uf       || cd?.uf        || '',
    regime:    co.regime   || '',
    cpf_contato:    co.cpfContato || '',
    cpf_contato_val:co.cpfContato || '',

    // Responsável pela Implementação
    rimp_nome:  co.rimpNome  || '',
    rimp_email: co.rimpEmail || '',
    rimp_tel:   co.rimpTel   || '',
    nome_implementacao:     co.rimpNome  || '',
    email_implementacao:    co.rimpEmail || '',
    telefone_implementacao: co.rimpTel   || '',

    // Responsável Financeiro
    rfin_nome:  co.rfinNome  || '',
    rfin_email: co.rfinEmail || '',
    rfin_tel:   co.rfinTel   || '',
    nome_financeiro:     co.rfinNome  || '',
    email_financeiro:    co.rfinEmail || '',
    telefone_financeiro: co.rfinTel   || '',

    // Produtos e Serviços
    plano:              S.plan ? (getPlanLabel(S.plan, c.plans?.length ? c.plans : DEFAULT_CFG.plans) || S.plan) : '—',
    cnpjs_qty:          String(S.cnpjs || ''),
    total_adesao:       fmt(tAd),
    total_mensalidade:  fmt(tMen),
    total_mensal:       fmt(tMen),
    condicao_pagamento: payLabel,
    vencimento_adesao:  wizAd  || '—',
    vencimento_mensal:  wizMen || '—',

    // Consultor e Sistema
    consultor_nome:  userProfile?.nome || '',
    consultor_tel:   userProfile?.perfil?.telefone || userProfile?.telefone || '',
    email_consultor: userProfile?.email || '',
    data_hora:       agora,
    data_hoje:       hoje,
    logo:            c.logob64 ? `<img src="${c.logob64}" style="height:52px">` : '',
  }

  // Variáveis individuais por módulo (ex: {{modulo_1_nome}}, {{modulo_1_adesao}}, {{modulo_1_mensal}})
  const results = S.closingToday ? (S.closingData?.results||[]) : (S.quoteData?.results||[])
  results.forEach((r, i) => {
    const n = i + 1
    vars[`modulo_${n}_nome`]   = r.name || ''
    vars[`modulo_${n}_adesao`] = (!r.isTributos && !r.isEP) ? fmt(S.closingToday ? r.ad : (r.adD ?? r.ad)) : '—'
    vars[`modulo_${n}_mensal`] = fmt(S.closingToday ? r.men : (r.menD ?? r.men))
    vars[`modulo_${n}_plano`]  = r.plan ? getPlanLabel(r.plan, c.plans) : ''
  })

  return vars
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
  const [cfgLoaded,     setCfgLoaded]     = useState(false)
  const [messages,      setMessages]      = useState([])
  const [input,         setInput]         = useState('')
  const [thinking,      setThinking]      = useState(false)

  const [selectedMods,  setSelectedMods]  = useState([])
  const [awaitingMods,  setAwaitingMods]  = useState(false)

  const [painel,      setPainel]      = useState(null)
  const [histDocs,    setHistDocs]    = useState([])
  const [histLoading, setHistLoading] = useState(false)

  const [showClient, setShowClient] = useState(false)
  const [clientMode, setClientMode] = useState('proposta')
  const emptyForm={empresa:'',razao:'',contato:'',email:'',telefone:'',cep:'',logradouro:'',bairro:'',cidade:'',uf:'',cpfContato:'',regime:'',rimpNome:'',rimpEmail:'',rimpTel:'',rfinNome:'',rfinEmail:'',rfinTel:''}
  const [cf,          setCf]          = useState(emptyForm)
  const [buscandoCep, setBuscandoCep] = useState(false)

  const [showWiz,  setShowWiz]  = useState(false)
  const [wizStep,  setWizStep]  = useState(1)
  const [wizPay,   setWizPay]   = useState('')
  const [wizAd,    setWizAd]    = useState('')
  const [wizMen,   setWizMen]   = useState('')
  const [wizTAd,   setWizTAd]   = useState(0)
  const [wizTMen,  setWizTMen]  = useState(0)

  const [showSign,       setShowSign]       = useState(false)
  const [docPreview,     setDocPreview]     = useState(null)
  // docPreview = { html, tipo: 'proposta'|'contrato', clienteEmail, clienteNome, clienteTel, signToken }
  const [signDoc,        setSignDoc]        = useState(null)
  const [signEmailInput, setSignEmailInput] = useState('')

  const [showSignForm, setShowSignForm] = useState(false)
  const [signFormSide, setSignFormSide] = useState('client')
  const [signFormDoc,  setSignFormDoc]  = useState(null)
  const [sfNome,       setSfNome]       = useState('')
  const [sfCpf,        setSfCpf]        = useState('')
  const [sfEmail,      setSfEmail]      = useState('')
  const [sfAgreed,     setSfAgreed]     = useState(false)
  const [sfSaving,     setSfSaving]     = useState(false)
  const [sfErro,       setSfErro]       = useState('')

  const [showDocView,    setShowDocView]    = useState(false)
  const [docViewHtml,    setDocViewHtml]    = useState('')
  const [docViewTitle,   setDocViewTitle]   = useState('')
  const [docViewLoading, setDocViewLoading] = useState(false)

  // ── Modal Salvar no CRM ──────────────────────────────────────
  const [showModalCRM,  setShowModalCRM]  = useState(false)
  const [docParaCRM,    setDocParaCRM]    = useState(null)
  const [crmForm,       setCrmForm]       = useState({})
  const [crmAba,        setCrmAba]        = useState('negocio')
  const [crmSalvando,   setCrmSalvando]   = useState(false)
  const [crmErro,       setCrmErro]       = useState('')

  const S = useRef({
    stage:'await_doc',doc:null,clientData:null,contactData:{},
    users:null,cnpjs:null,modules:[],plan:null,ifPlan:null,notas:null,
    quoteData:null,closingData:null,closingToday:false,
    appliedVoucher:null,awaitingVoucher:false,
    contractMode:'closing', contractValues:null
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
    if(!userProfile||!cfgLoaded)return
    const c=cfgRef.current
    const nomeEmpresa=c.company||'Vivanexa'
    setTimeout(()=>addBot(`Olá, ${userProfile.nome}! 👋\n\nSou o assistente comercial da ${nomeEmpresa}.\nPara começar, informe o **CPF ou CNPJ** do cliente:`),300)
  },[userProfile,cfgLoaded])

  // Timer gerenciado fora do React (igual ao HTML local) para evitar
  // que re-renders do dangerouslySetInnerHTML resetem o textContent
  useEffect(()=>{ return()=>{ if(window._vxTimerInt){clearInterval(window._vxTimerInt);window._vxTimerInt=null} } },[])

  // Após cada re-render das mensagens, reaplicar o timer imediatamente no elemento recriado
  useEffect(()=>{
    if(window._vxTimerDeadline){
      const el=document.getElementById('vx-timer')
      if(el){
        const diff=window._vxTimerDeadline-new Date()
        if(diff>0){
          const hh=Math.floor(diff/3600000),mm=Math.floor((diff%3600000)/60000),ss=Math.floor((diff%60000)/1000)
          el.textContent=`${String(hh).padStart(2,'0')}:${String(mm).padStart(2,'0')}:${String(ss).padStart(2,'0')}`
        } else {el.textContent='EXPIRADO';el.style.color='var(--muted)'}
      }
    }
  },[messages]) 

  useEffect(()=>{if(msgRef.current)msgRef.current.scrollTop=msgRef.current.scrollHeight},[messages,thinking])

  async function loadCfg(eid){
    try{
      // ── Busca cfg + templates separados em paralelo ──────────────
      const [cfgResult, tplPropResult, tplContResult] = await Promise.all([
        supabase.from('vx_storage').select('value').eq('key', `cfg:${eid}`).single(),
        supabase.from('vx_storage').select('value').eq('key', `template:proposta:${eid}`).maybeSingle(),
        supabase.from('vx_storage').select('value').eq('key', `template:contrato:${eid}`).maybeSingle(),
      ])

      if (!cfgResult.data?.value) { setCfgLoaded(true); return }

      const saved = JSON.parse(cfgResult.data.value)
      const dt = saved.docTemplates || {}

      // ── Coleta templates de todas as fontes ──────────────────────
      // Chave separada tem prioridade; depois cfg legado; depois docTemplates
      const tplPropSeparado = tplPropResult.data?.value || ''
      const tplContSeparado = tplContResult.data?.value || ''
      const tplPropCfg = saved.propostaTemplate || dt.proposta || ''
      const tplContCfg = saved.contratoTemplate || dt.contrato || ''

      // Template final para uso em memória
      let propostaTemplate = tplPropSeparado || tplPropCfg
      let contratoTemplate = tplContSeparado || tplContCfg

      // ── MIGRAÇÃO: move DOCX do cfg → chaves separadas ────────────
      let needClean = false

      if (!tplPropSeparado && _isDocxStr(tplPropCfg)) {
        const { error } = await supabase.from('vx_storage').upsert(
          { key: `template:proposta:${eid}`, value: tplPropCfg, updated_at: new Date().toISOString() },
          { onConflict: 'key' }
        )
        if (!error) { needClean = true; console.log('✅ Proposta migrada') }
        else { console.warn('Migração proposta err:', error) }
      }

      if (!tplContSeparado && _isDocxStr(tplContCfg)) {
        const { error } = await supabase.from('vx_storage').upsert(
          { key: `template:contrato:${eid}`, value: tplContCfg, updated_at: new Date().toISOString() },
          { onConflict: 'key' }
        )
        if (!error) { needClean = true; console.log('✅ Contrato migrado') }
        else { console.warn('Migração contrato err:', error) }
      }

      // ── _detectTipo: DEVE ser declarado ANTES de qualquer uso ────
      // (era declarado depois, causando ReferenceError com const)
      const _detectTipo = (tmpl, hint) => {
        if (hint === 'docx' || _isDocxStr(tmpl)) return 'docx'
        return 'html'
      }

      // ── LIMPEZA: remove qualquer DOCX do JSON cfg principal ──────
      // Faz isso SEMPRE que detectar DOCX no cfg (independente de migração)
      const temDocxNoCfg = _isDocxStr(tplPropCfg) || _isDocxStr(tplContCfg)
      if (needClean || temDocxNoCfg) {
        const cfgLimpo = stripDocxFromObj({ ...saved })
        // Garante que docTemplates fica com apenas tipos (sem base64)
        cfgLimpo.docTemplates = {
          propostaTipo: dt.propostaTipo || (propostaTemplate ? _detectTipo(propostaTemplate) : 'html'),
          contratoTipo: dt.contratoTipo || (contratoTemplate ? _detectTipo(contratoTemplate) : 'html'),
          proposta: '',
          contrato: '',
        }
        delete cfgLimpo.propostaTemplate
        delete cfgLimpo.contratoTemplate

        const { error: cleanErr } = await supabase.from('vx_storage').upsert(
          { key: `cfg:${eid}`, value: JSON.stringify(cfgLimpo), updated_at: new Date().toISOString() },
          { onConflict: 'key' }
        )
        if (!cleanErr) console.log('✅ cfg limpo no Supabase (sem DOCX)')
        else console.warn('Limpeza cfg err:', cleanErr)
      }

      // ── Monta merged para uso em memória ─────────────────────────
      const propostaTipo = _detectTipo(propostaTemplate, dt.propostaTipo || saved.propostaTipo)
      const contratoTipo = _detectTipo(contratoTemplate, dt.contratoTipo || saved.contratoTipo)

      // saved pode ainda ter os campos base64 em memória — limpa antes do merge
      const savedLimpo = stripDocxFromObj({ ...saved })
      delete savedLimpo.propostaTemplate
      delete savedLimpo.contratoTemplate

      const merged = {
        ...DEFAULT_CFG,
        ...savedLimpo,
        plans: saved.plans?.length ? saved.plans : DEFAULT_CFG.plans,
        prices: Object.keys(saved.prices || {}).length ? saved.prices : DEFAULT_CFG.prices,
        // Templates reais apenas em memória — nunca volta pro banco
        propostaTemplate,
        contratoTemplate,
        propostaTipo,
        contratoTipo,
        docTemplates: {
          proposta: propostaTemplate,
          contrato: contratoTemplate,
          propostaTipo,
          contratoTipo,
        },
      }

      cfgRef.current = merged
      setCfg(merged)
    } catch(e) { console.warn('loadCfg error:', e) }
    setCfgLoaded(true)
  }

  async function saveToHistory(type,clientName,html,extra={}){
    const id='doc_'+Date.now()+'_'+Math.random().toString(36).slice(2,6)
    const token=extra.token||generateToken()
    const _now=new Date()
    const entry={id,type,clientName,
      cliente:extra.clientName||(S?.contactData?.razao||S?.clientData?.nome||clientName||''),
      date:_now.toLocaleString('pt-BR'),dateISO:_now.toISOString(),criado:_now.toISOString(),
      status:'draft',signToken:token,signedAt:null,signedBy:null,signCPF:null,signIP:null,
      consultantSignedAt:null,consultantSignedBy:null,
      adesao:extra.tAd||0,mensalidade:extra.tMen||0,
      userId:userProfile?.id||'',
      consultor:userProfile?.nome||'',consultorEmail:userProfile?.email||'',empresaId:empresaId||'',...extra}
    try{await supabase.from('vx_storage').upsert({key:`doc:${token}`,value:JSON.stringify({...entry,html}),updated_at:new Date().toISOString()})}catch(e){console.warn(e)}

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
      const existe = clients.some(cl => cl.doc === docSnap || (cl.email && cl.email === novoCliente.email))
      if(!existe){
        clients.push(novoCliente)
      } else {
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

    try{
      const{data:cfgRow}=await supabase.from('vx_storage').select('value').eq('key',`cfg:${empresaId}`).single()
      // CRÍTICO: se cfgRow é null, usa c mas SEM os templates DOCX em memória
      // (nunca usar {...c} diretamente pois c tem propostaTemplate/contratoTemplate em memória)
      let cfgData
      if(cfgRow?.value){
        cfgData = JSON.parse(cfgRow.value)
      } else {
        // Cria um cfg base sem templates para não re-introduzir DOCX no banco
        cfgData = stripDocxFromObj({...c})
        delete cfgData.propostaTemplate
        delete cfgData.contratoTemplate
      }
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
      // Salvar templates em memória para restaurar no cfgRef após o save
      const templatesEmMemoria = {
        propostaTemplate: cfgRef.current.propostaTemplate || '',
        contratoTemplate: cfgRef.current.contratoTemplate || '',
        propostaTipo: cfgRef.current.propostaTipo || 'html',
        contratoTipo: cfgRef.current.contratoTipo || 'html',
        docTemplates: cfgRef.current.docTemplates || {},
      }
      // Limpa QUALQUER base64 DOCX do cfgData antes de salvar (segurança total)
      const cfgParaSalvar = stripDocxFromObj(cfgData)
      delete cfgParaSalvar.propostaTemplate
      delete cfgParaSalvar.contratoTemplate
      if(cfgParaSalvar.docTemplates){
        cfgParaSalvar.docTemplates = {
          propostaTipo: cfgParaSalvar.docTemplates.propostaTipo || 'html',
          contratoTipo: cfgParaSalvar.docTemplates.contratoTipo || 'html',
          proposta: '',
          contrato: '',
        }
      }
      await supabase.from('vx_storage').upsert({key:`cfg:${empresaId}`,value:JSON.stringify(cfgParaSalvar),updated_at:new Date().toISOString()})
      // cfgRef em memória = banco limpo + templates da sessão
      const mergedCfg = { ...cfgParaSalvar, ...templatesEmMemoria }
      cfgRef.current=mergedCfg;setCfg(mergedCfg)
    }catch(e){console.warn(e)}
    return{id,token,html,type,clientName,...entry}
  }

  const addBot  =(c,h=false)=>setMessages(p=>[...p,{role:'bot',content:c,isHTML:h,id:Date.now()+Math.random()}])
  const addUser =c           =>setMessages(p=>[...p,{role:'user',content:c,isHTML:false,id:Date.now()+Math.random()}])

  const resetS=()=>{
    Object.assign(S,{stage:'await_doc',doc:null,clientData:null,contactData:{},users:null,cnpjs:null,modules:[],plan:null,ifPlan:null,notas:null,quoteData:null,closingData:null,closingToday:false,appliedVoucher:null,awaitingVoucher:false,contractMode:'closing',contractValues:null})
    // Limpar timer global
    if(window._vxTimerInt){clearInterval(window._vxTimerInt);window._vxTimerInt=null}
    window._vxTimerDeadline=null
    setSelectedMods([]);setAwaitingMods(false)
    setMessages([])
  }

  async function buscarCep(cep){
    setBuscandoCep(true);const d=await fetchCEP(cep);setBuscandoCep(false)
    if(d)setCf(f=>({...f,logradouro:d.logradouro||f.logradouro,bairro:d.bairro||f.bairro,cidade:d.municipio||f.cidade,uf:d.uf||f.uf}))
  }

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

      // Atualiza o HTML do manifesto com os dados reais de assinatura
      if(docData.html){
        let html=docData.html
        // Substitui campos do manifesto do cliente
        html=html.replace(/<span id="manifest-client-name">[^<]*<\/span>/,`<span id="manifest-client-name">${docData.signedBy||'—'}</span>`)
        html=html.replace(/<span id="manifest-client-cpf">[^<]*<\/span>/,`<span id="manifest-client-cpf">${docData.signCPF||'—'}</span>`)
        html=html.replace(/<span id="manifest-client-email">[^<]*<\/span>/,`<span id="manifest-client-email">${docData.clientEmail||docData.signEmail||'—'}</span>`)
        html=html.replace(/<span id="manifest-client-date">[^<]*<\/span>/,`<span id="manifest-client-date">${docData.signedAt||'Aguardando assinatura'}</span>`)
        // Substitui campos do manifesto do consultor
        html=html.replace(/<span id="manifest-consult-name">[^<]*<\/span>/,`<span id="manifest-consult-name">${docData.consultantSignedBy||'—'}</span>`)
        html=html.replace(/<span id="manifest-consult-date">[^<]*<\/span>/,`<span id="manifest-consult-date">${docData.consultantSignedAt||'Aguardando assinatura'}</span>`)
        docData.html=html
      }

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
        const dest=[clientE,consultorE].filter(Boolean)
        if(dest.length>0){
          const htmlEmail=`<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto"><div style="background:#0f172a;padding:24px;text-align:center"><h1 style="color:#00d4ff;font-size:20px;margin:0">${cfgRef.current.company||'Vivanexa'}</h1></div><div style="padding:24px;background:#f8fafc"><h2 style="color:#065f46">✅ ${tipo} Assinado por Ambas as Partes</h2><p>O documento foi assinado com sucesso.</p><table style="width:100%;border-collapse:collapse;margin:16px 0"><tr style="background:#e2e8f0"><th style="padding:8px;text-align:left">Parte</th><th style="padding:8px;text-align:left">Nome</th><th style="padding:8px;text-align:left">Data/Hora</th></tr><tr><td style="padding:8px;border-bottom:1px solid #e2e8f0">Cliente (Contratante)</td><td style="padding:8px;border-bottom:1px solid #e2e8f0">${docData.signedBy||'—'}</td><td style="padding:8px;border-bottom:1px solid #e2e8f0">${docData.signedAt||'—'}</td></tr><tr><td style="padding:8px">Consultor (Contratada)</td><td style="padding:8px">${docData.consultantSignedBy||'—'}</td><td style="padding:8px">${docData.consultantSignedAt||'—'}</td></tr></table><p><a href="${url}" style="display:inline-block;background:#00d4ff;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600">Visualizar Documento Assinado</a></p></div></div>`
          try{
            await fetch('/api/send-email',{method:'POST',headers:{'Content-Type':'application/json'},
              body:JSON.stringify({to:dest.join(','),subject:`✅ ${tipo} – ${cfgRef.current.company||'Vivanexa'} – Assinado`,html:htmlEmail,
                config:{smtpHost:cfgRef.current.smtpHost||'',smtpPort:Number(cfgRef.current.smtpPort||587),smtpUser:cfgRef.current.smtpUser||'',smtpPass:cfgRef.current.smtpPass||''}})
            })
          }catch(emailErr){console.warn('Email send error:',emailErr)}
          addBot(`✅ Contrato totalmente assinado! E-mail enviado para: ${dest.join(', ')}`)
        } else {
          addBot(`✅ Contrato totalmente assinado!`)
        }
      }else{
        addBot(signFormSide==='consultant'?`✅ Assinatura do consultor registrada!`:`✅ Assinatura do cliente registrada!`)
      }
    }catch(e){console.error(e);setSfErro('Erro ao salvar. Tente novamente.')}
    finally{setSfSaving(false)}
  }

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
      else{
        S.stage='await_proposal_after_disc'
        addUser('Não, obrigado')
        addBot(`Sem problemas! Vou gerar uma proposta comercial com os valores originais.\n\nClique abaixo para continuar:`)
        setTimeout(()=>addBot(`<button class="prop-btn" onclick="window.vx_prop()">📄 Gerar Proposta Comercial</button><button class="reset-btn" style="margin-top:6px" onclick="window.vx_reset()">🔄 Iniciar nova consulta</button>`,true),400)
      }
    }
    window.vx_close=(yes)=>{
      const c=cfgRef.current
      if(yes){const d=calcClose(S.modules,S.plan,S.ifPlan,S.cnpjs,S.notas,c);S.closingData=d;S.closingToday=true;S.stage='closing'
        const h=c.closingHour||18;const dl=new Date();dl.setHours(h,0,0,0);
        addUser('✅ Fechar hoje!');addBot(rClose(d),true)
        // Inicia timer após DOM renderizar a bolha — igual ao HTML local
        setTimeout(()=>startTimerGlobal(dl),200)
      }
      else{
        S.stage='await_proposal_after_disc'
        addUser('Não por agora')
        addBot('Sem problemas! Deseja que eu gere uma proposta comercial com os valores com desconto?')
        setTimeout(()=>addBot(`<button class="prop-btn" onclick="window.vx_prop()">📄 Gerar Proposta Comercial</button><button class="reset-btn" style="margin-top:6px" onclick="window.vx_reset()">🔄 Iniciar nova consulta</button>`,true),400)
      }
    }
    window.vx_reset=()=>{
      resetS()
      const c=cfgRef.current
      setTimeout(()=>addBot(`🔄 Nova consulta!\n\nInforme o CPF ou CNPJ do próximo cliente:`),100)
    }
    window.vx_prop=()=>{
      // Se estamos na tela de fechamento, voltar aos valores com desconto padrão para a proposta
      if(S.closingToday) {
        S.closingToday = false  // proposta usa valores discountados, não de fechamento
      }
      const cd=S.clientData||{},co=S.contactData||{}
      setCf({...emptyForm,empresa:co.empresa||cd.fantasia||cd.nome||'',razao:co.razao||cd.nome||'',email:co.email||cd.email||'',telefone:co.telefone||cd.telefone||'',cidade:co.cidade||cd.municipio||'',uf:co.uf||cd.uf||'',logradouro:co.logradouro||cd.logradouro||'',bairro:co.bairro||cd.bairro||'',cep:co.cep||cd.cep||'',contato:co.contato||''})
      setClientMode('proposta');setShowClient(true)
    }
    // ── Contrato no fechamento (valores de fechamento) ──
    window.vx_cont=()=>{
      const cd=S.clientData||{},co=S.contactData||{}
      // Usa valores de fechamento (closingData) ou quoteData como fallback
      S.contractMode='closing'
      setCf({...emptyForm,empresa:co.empresa||cd.fantasia||cd.nome||'',razao:co.razao||cd.nome||'',email:co.email||cd.email||'',telefone:co.telefone||cd.telefone||'',cidade:co.cidade||cd.municipio||'',uf:co.uf||cd.uf||'',logradouro:co.logradouro||cd.logradouro||'',bairro:co.bairro||cd.bairro||'',cep:co.cep||cd.cep||'',contato:co.contato||''})
      setClientMode('contrato');setShowClient(true)
    }
    // ── Contrato no preço cheio (sem desconto) ──
    window.vx_cont_full=()=>{
      const cd=S.clientData||{},co=S.contactData||{}
      // Salva os valores cheios para uso no saveClient
      S.contractMode='full'
      S.contractValues={
        tAd: S.quoteData?.tAd||0,
        tMen: S.quoteData?.tMen||0,
        results: S.quoteData?.results||[]
      }
      setCf({...emptyForm,empresa:co.empresa||cd.fantasia||cd.nome||'',razao:co.razao||cd.nome||'',email:co.email||cd.email||'',telefone:co.telefone||cd.telefone||'',cidade:co.cidade||cd.municipio||'',uf:co.uf||cd.uf||'',logradouro:co.logradouro||cd.logradouro||'',bairro:co.bairro||cd.bairro||'',cep:co.cep||cd.cep||'',contato:co.contato||''})
      setClientMode('contrato');setShowClient(true)
    }
    // ── Contrato com desconto de tela (valores com desconto padrão) ──
    window.vx_cont_disc=()=>{
      const cd=S.clientData||{},co=S.contactData||{}
      // Usa os valores com desconto (tAdD, tMenD)
      S.contractMode='disc'
      S.contractValues={
        tAd: S.quoteData?.tAdD||S.quoteData?.tAd||0,
        tMen: S.quoteData?.tMenD||S.quoteData?.tMen||0,
        results: S.quoteData?.results||[]
      }
      setCf({...emptyForm,empresa:co.empresa||cd.fantasia||cd.nome||'',razao:co.razao||cd.nome||'',email:co.email||cd.email||'',telefone:co.telefone||cd.telefone||'',cidade:co.cidade||cd.municipio||'',uf:co.uf||cd.uf||'',logradouro:co.logradouro||cd.logradouro||'',bairro:co.bairro||cd.bairro||'',cep:co.cep||cd.cep||'',contato:co.contato||''})
      setClientMode('contrato');setShowClient(true)
    }
  },[cfg])

  async function saveClient(){
    S.contactData={...cf};setShowClient(false)
    const c=cfgRef.current
    const clientName=cf.razao||cf.empresa||fmtDoc(S.doc||'')||'Cliente'
    const nomeArquivo=(n,tipo)=>`${tipo}_${(n||'cliente').replace(/[^a-zA-Z0-9_\-]/g,'_')}.docx`

    // ── Garante que templates de docTemplates estão mapeados ──
    const dt = c.docTemplates || {}
    const propTemplate = c.propostaTemplate || dt.proposta || ''
    const contTemplate = c.contratoTemplate || dt.contrato || ''
    // Atualiza cfgRef para ter sempre os templates disponíveis durante a sessão
    if (!c.propostaTemplate && dt.proposta) cfgRef.current.propostaTemplate = dt.proposta
    if (!c.contratoTemplate && dt.contrato) cfgRef.current.contratoTemplate = dt.contrato

    if(clientMode==='proposta'){
      const tipoTemplate=detectarTipoTemplate(propTemplate)

      if(tipoTemplate==='docx'){
        // ── PROPOSTA VIA DOCX ──────────────────────────────────
        const isC=S.closingToday===true
        const tAd=isC?S.closingData?.tAd:(S.quoteData?.tAdD||0)
        const tMen=isC?S.closingData?.tMen:(S.quoteData?.tMenD||0)
        const cd=S.clientData||{},co=S.contactData||{}
        const variaveis=buildDocxVars({S,c,userProfile,tAd,tMen,cd,co,wizPay:'',wizAd:'',wizMen:''})
        // Gerar blob DOCX e mostrar preview em tela (HTML fallback) + botão de download
        const htmlFallback=buildProposal(S,c,userProfile,propTemplate)
        const doc=await saveToHistory('proposta',clientName,htmlFallback,{tAd,tMen,clientEmail:cf.email,modulos:S.modules})
        setSignDoc(doc);setSignEmailInput(cf.email||'')
        // Armazena blob docx em window para download posterior
        renderDocxBlob(propTemplate, variaveis)
          .then(blob=>{ window._vxDocxBlob={blob,nome:nomeArquivo(clientName,'proposta')} })
          .catch(e=>{ console.warn('Erro DOCX proposta:',e); window._vxDocxBlob=null })
        setDocPreview({html:htmlFallback,tipo:'proposta',clienteEmail:cf.email||'',clienteNome:cf.razao||cf.empresa||clientName,clienteTel:cf.telefone||'',signToken:doc.signToken||doc.id,hasDocx:true,docxNome:nomeArquivo(clientName,'proposta')})
      } else {
        // ── PROPOSTA VIA HTML (com preview em tela) ─────────
        const html=buildProposal(S,c,userProfile,propTemplate)
        const tAd=S.closingToday?S.closingData?.tAd:(S.quoteData?.tAdD||0)
        const tMen=S.closingToday?S.closingData?.tMen:(S.quoteData?.tMenD||0)
        const doc=await saveToHistory('proposta',clientName,html,{tAd,tMen,clientEmail:cf.email,modulos:S.modules})
        setSignDoc(doc);setSignEmailInput(cf.email||'')
        setDocPreview({html,tipo:'proposta',clienteEmail:cf.email||'',clienteNome:cf.razao||cf.empresa||clientName,clienteTel:cf.telefone||'',signToken:doc.signToken||doc.id})
      }
    }else{
      // ── CONTRATO: determina os valores corretos de acordo com o modo ──
      let tAd, tMen
      const cm = S.contractMode || 'closing'
      if (cm === 'full') {
        // Preço cheio (sem nenhum desconto)
        tAd  = S.contractValues?.tAd  ?? S.quoteData?.tAd  ?? 0
        tMen = S.contractValues?.tMen ?? S.quoteData?.tMen ?? 0
      } else if (cm === 'disc') {
        // Com desconto de tela (não de fechamento)
        tAd  = S.contractValues?.tAd  ?? S.quoteData?.tAdD ?? S.quoteData?.tAd  ?? 0
        tMen = S.contractValues?.tMen ?? S.quoteData?.tMenD?? S.quoteData?.tMen ?? 0
      } else {
        // Fechamento (closing) — comportamento original
        const isC = S.closingToday === true
        tAd  = isC ? (S.closingData?.tAd  ?? 0) : (S.quoteData?.tAdD  ?? 0)
        tMen = isC ? (S.closingData?.tMen ?? 0) : (S.quoteData?.tMenD ?? 0)
      }
      setWizTAd(tAd);setWizTMen(tMen);setWizStep(1);setWizPay('');setWizAd('');setWizMen('');setShowWiz(true)
    }
  }

  async function wizNext(){
    if(wizStep===1){if(!wizPay){alert('Selecione a condição de pagamento.');return};setWizStep(2)}
    else{
      if(wizTAd>0&&!wizAd){alert('Selecione a data de vencimento da adesão.');return}
      if(!wizMen){alert('Selecione a data da 1ª mensalidade.');return}
      setShowWiz(false)
      const c=cfgRef.current
      const token=generateToken()
      const clientName=cf.razao||cf.empresa||fmtDoc(S.doc||'')||'Cliente'
      const nomeArquivo=`contrato_${(clientName||'cliente').replace(/[^a-zA-Z0-9_\-]/g,'_')}.docx`
      // Garante que template de contrato está mapeado de docTemplates
      const dt = c.docTemplates || {}
      const contratoTemplate = c.contratoTemplate || dt.contrato || ''
      const tipoTemplate=detectarTipoTemplate(contratoTemplate)
      // Reseta contractMode após gerar
      S.contractMode = 'closing'
      S.contractValues = null

      if(tipoTemplate==='docx'){
        // ── CONTRATO VIA DOCX ──────────────────────────────────
        const cd=S.clientData||{},co=S.contactData||{}
        const variaveis=buildDocxVars({S,c,userProfile,tAd:wizTAd,tMen:wizTMen,cd,co,wizPay,wizAd,wizMen})
        // Salva HTML padrão no histórico para link de assinatura
        const htmlFallback=buildContract(S,c,userProfile,wizTAd,wizTMen,wizAd,wizMen,wizPay,token,undefined,contratoTemplate)
        // Armazena blob docx para download no preview
        renderDocxBlob(contratoTemplate, variaveis)
          .then(blob=>{ window._vxDocxBlob={blob,nome:nomeArquivo} })
          .catch(e=>{ console.warn('Erro DOCX contrato:',e); window._vxDocxBlob=null })
        saveToHistory('contrato',clientName,htmlFallback,{tAd:wizTAd,tMen:wizTMen,clientEmail:cf.email,modulos:S.modules,pagamento:wizPay,vencAdesao:wizAd,vencMensal:wizMen,token}).then(doc=>{
          setSignDoc(doc);setSignEmailInput(cf.email||'')
          setDocPreview({html:htmlFallback,tipo:'contrato',clienteEmail:cf.email||'',clienteNome:cf.razao||cf.empresa||clientName,clienteTel:cf.telefone||'',signToken:doc.signToken||doc.id,hasDocx:true,docxNome:nomeArquivo})
        })
      } else {
        // ── CONTRATO VIA HTML (com preview em tela) ─────────
        const html=buildContract(S,c,userProfile,wizTAd,wizTMen,wizAd,wizMen,wizPay,token,undefined,contratoTemplate)
        saveToHistory('contrato',clientName,html,{tAd:wizTAd,tMen:wizTMen,clientEmail:cf.email,modulos:S.modules,pagamento:wizPay,vencAdesao:wizAd,vencMensal:wizMen,token}).then(doc=>{
          setSignDoc(doc);setSignEmailInput(cf.email||'')
          setDocPreview({html,tipo:'contrato',clienteEmail:cf.email||'',clienteNome:cf.razao||cf.empresa||clientName,clienteTel:cf.telefone||'',signToken:doc.signToken||doc.id})
        })
      }
    }
  }

  const wizDates=getNextDates()

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
    h+=`<div style="margin-top:8px"><button class="prop-btn" onclick="window.vx_prop()">📄 Gerar Proposta Comercial</button></div>`
    h+=`<div style="margin-top:4px"><button class="prop-btn" style="background:linear-gradient(135deg,rgba(124,58,237,.18),rgba(124,58,237,.06));border-color:rgba(124,58,237,.35);color:#a78bfa" onclick="window.vx_cont_full()">📝 Gerar Contrato (preço cheio)</button></div>`
    return h
  }
  function rDisc(data,dates,cn){
    const c=cfgRef.current
    const{results,tAd,tMen,tAdD,tMenD}=data;let h=''
    for(const r of results){h+=`<div class="price-card"><h4>🔹 ${r.name}</h4>${!r.isTributos&&!r.isEP?`<div class="price-row"><span class="label">Adesão</span><span class="val">${fmt(r.ad)}</span></div>`:''}<div class="price-row"><span class="label">Mensalidade</span><span class="val">${fmt(r.men)}</span></div><hr class="section-divider">${!r.isTributos&&!r.isEP?`<div class="price-row"><span class="label">Adesão c/ desc.</span><span class="val discount">${fmt(r.adD)}</span></div>`:''}<div class="price-row"><span class="label">Mensalidade c/ desc.</span><span class="val discount">${fmt(r.menD)}</span></div></div>`}
    h+=`<div class="price-card" style="border-color:rgba(0,212,255,.25)"><h4>🔸 Total</h4><div class="price-row"><span class="label">Adesão</span><span class="val">${fmt(tAd)}</span></div><div class="price-row"><span class="label">Mensalidade</span><span class="val">${fmt(tMen)}</span></div><hr class="section-divider"><div class="price-row"><span class="label">Adesão c/ desc.</span><span class="val discount">${fmt(tAdD)}</span></div><div class="price-row"><span class="label">Mensalidade c/ desc.</span><span class="val discount">${fmt(tMenD)}</span></div>${c.unlimitedStrategy?`<div style="margin-top:8px"><span class="unlimited-badge">♾ Usuários Ilimitados</span></div>`:''}</div>`
    const h2=c.closingHour??18
    const textoExtra=c.closingText?`<div style="font-size:13px;color:var(--muted);margin-top:6px;font-style:italic">${c.closingText}</div>`:''
    h+=`<div class="opp-banner"><div class="opp-title">🔥 Oportunidade de Negociação</div><div class="opp-body"><strong style="color:var(--gold)">${cn}</strong> pode fechar com <strong style="color:var(--gold)">${c.discClosePct||40}% OFF</strong> na adesão!<br>Oferta válida até as <strong style="color:var(--gold)">${h2}h de hoje</strong>.</div>${textoExtra}<div class="yn-row" style="margin-top:12px"><button class="yn-btn yes" onclick="window.vx_close(true)">✅ Fechar hoje!</button><button class="yn-btn no" onclick="window.vx_close(false)">Não por agora</button></div></div>`
    h+=`<div class="section-label">Próximos vencimentos</div><div class="dates-box">${dates.map(d=>`<span class="date-chip">${d}</span>`).join('')}</div>`
    h+=`<div style="margin-top:8px"><button class="prop-btn" onclick="window.vx_prop()">📄 Gerar Proposta Comercial (com desconto)</button></div>`
    h+=`<div style="margin-top:4px"><button class="prop-btn" style="background:linear-gradient(135deg,rgba(124,58,237,.18),rgba(124,58,237,.06));border-color:rgba(124,58,237,.35);color:#a78bfa" onclick="window.vx_cont_disc()">📝 Gerar Contrato (com desconto)</button></div>`
    return h
  }
  function rClose(data){
    const c=cfgRef.current
    const{results,tAd,tMen}=data;let h=''
    const h2=c.closingHour??18
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

    {/* ✅ NAVBAR GLOBAL — substitui o header antigo */}
    <Navbar cfg={cfg} perfil={userProfile} />

    {/* Barra secundária: status + botões internos do chat */}
    <div style={{display:'flex',gap:6,padding:'6px 20px',background:'rgba(10,15,30,.9)',borderBottom:'1px solid var(--border)',flexWrap:'wrap',alignItems:'center',width:'100%'}}>
      <div className="status-dot">online</div>
      {[{id:'historico',label:'🗂️ Histórico'},{id:'assinaturas',label:'✍️ Assinaturas'}].map(({id,label})=>(
        <button key={id} onClick={()=>abrirPainel(id)} style={{background:'var(--surface2)',border:'1px solid var(--border)',cursor:'pointer',color:'var(--muted)',fontSize:11,padding:'5px 11px',borderRadius:8,fontFamily:'DM Mono,monospace',transition:'all .15s'}}
          onMouseEnter={e=>{e.currentTarget.style.color='var(--accent)';e.currentTarget.style.borderColor='rgba(0,212,255,.3)'}}
          onMouseLeave={e=>{e.currentTarget.style.color='var(--muted)';e.currentTarget.style.borderColor='var(--border)'}}>
          {label}
        </button>
      ))}
    </div>

    <div className="chat-wrap">
      <div id="messages" ref={msgRef}>
        {messages.map(m=>(
          <div key={m.id} className={`msg ${m.role}`}>
            <div className="msg-label">{m.role==='user'?'Você':'Assistente'}</div>
            <div className="bubble" {...(m.isHTML?{dangerouslySetInnerHTML:{__html:m.content}}:{children:m.content})}/>
          </div>
        ))}
        {thinking&&<div className="msg bot"><div className="thinking"><span/><span/><span/></div></div>}
      </div>

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

    {/* MODAL DOCUMENTO PREVIEW — proposta/contrato gerado em tela */}
    {docPreview && (
      <DocumentoPreviewModal
        docPreview={docPreview}
        onClose={() => {
          setDocPreview(null)
          // Mensagem de retorno ao chat com ações disponíveis
          const tipo = docPreview.tipo === 'contrato' ? 'Contrato' : 'Proposta'
          setTimeout(() => addBot(
            `✅ ${tipo} fechado! Voltamos ao chat.\n\nDeseja fazer mais alguma coisa?\n` +
            `• Gerar contrato → clique no botão acima ou diga "gerar contrato"\n` +
            `• Nova consulta → diga "nova consulta" ou "reiniciar"`,
            false
          ), 100)
        }}
        cfg={cfg}
        empresaId={empresaId}
        userProfile={userProfile}
        onSalvarCRM={(doc) => {
          // Abre o modal de integração CRM com dados pré-preenchidos
          const co = S.contactData || {}
          const cd = S.clientData || {}
          const clientName = co.razao || co.empresa || cd.nome || cd.fantasia || fmtDoc(S.doc || '')
          const etapas = cfgRef.current.crm_etapas?.length ? cfgRef.current.crm_etapas : [
            {id:'lead',label:'Lead'},
            {id:'lead_qualificado',label:'Lead Qualificado'},
            {id:'reuniao_agendada',label:'Reunião Agendada'},
            {id:'proposta_enviada',label:'Proposta Enviada'},
            {id:'negociacao',label:'Negociação'},
            {id:'fechamento',label:'Fechamento'},
          ]
          setCrmForm({
            titulo: doc.tipo === 'proposta' ? `Proposta – ${clientName}` : `Contrato – ${clientName}`,
            etapa: doc.tipo === 'proposta' ? 'proposta_enviada' : 'fechamento',
            observacoes: `${doc.tipo === 'proposta' ? 'Proposta' : 'Contrato'} gerado via Chat em ${new Date().toLocaleDateString('pt-BR')}`,
            cnpj: S.doc || '',
            nome: clientName,
            fantasia: co.empresa || cd.fantasia || '',
            razao: co.razao || cd.nome || '',
            email: co.email || cd.email || '',
            telefone: co.telefone || cd.telefone || '',
            cidade: co.cidade || cd.municipio || '',
            uf: co.uf || cd.uf || '',
            salvarCliente: true,
            tAd: doc.tAd || 0,
            tMen: doc.tMen || 0,
            signToken: doc.signToken || '',
            docTipo: doc.tipo || 'proposta',
            etapas,
          })
          setCrmAba('negocio')
          setCrmErro('')
          setDocParaCRM(doc)
          setShowModalCRM(true)
        }}
      />
    )}

    {/* MODAL SALVAR NO CRM */}
    {showModalCRM && docParaCRM && (()=>{
      const etapas = crmForm.etapas || [{id:'lead',label:'Lead'},{id:'proposta_enviada',label:'Proposta Enviada'},{id:'fechamento',label:'Fechamento'}]
      const inp = {width:'100%',background:'var(--surface2)',border:'1px solid var(--border)',borderRadius:8,padding:'9px 12px',color:'var(--text)',fontFamily:'DM Mono,monospace',fontSize:13,outline:'none',boxSizing:'border-box'}
      const setF = (k,v) => setCrmForm(p=>({...p,[k]:v}))

      async function salvarNoCRM(){
        if(!crmForm.titulo?.trim()||!crmForm.nome?.trim()){setCrmErro('Título e nome são obrigatórios.');return}
        setCrmSalvando(true);setCrmErro('')
        try{
          const{data:row}=await supabase.from('vx_storage').select('value').eq('key',`cfg:${empresaId}`).maybeSingle()
          const currentCfg=row?.value?JSON.parse(row.value):{...cfgRef.current}

          // 1. Criar negócio no funil CRM
          const novoNegocio={
            id:`neg_${Date.now()}`,
            titulo:crmForm.titulo,
            etapa:crmForm.etapa,
            nome:crmForm.razao||crmForm.nome,
            fantasia:crmForm.fantasia||crmForm.nome,
            cnpj:(crmForm.cnpj||'').replace(/\D/g,''),
            email:crmForm.email,
            telefone:crmForm.telefone,
            cidade:crmForm.cidade,
            uf:crmForm.uf,
            observacoes:crmForm.observacoes,
            origem:'chat',
            responsavel:userProfile?.nome||userProfile?.email||'',
            criadoEm:new Date().toISOString(),
            atualizadoEm:new Date().toISOString(),
            documentoToken:crmForm.signToken,
            valorAdesao:crmForm.tAd||0,
            valorMensal:crmForm.tMen||0,
          }
          if(!currentCfg.crm_negocios)currentCfg.crm_negocios=[]
          currentCfg.crm_negocios.push(novoNegocio)

          // 2. Salvar/atualizar cliente (opcional)
          if(crmForm.salvarCliente){
            const docLimpo=(crmForm.cnpj||'').replace(/\D/g,'')
            if(!currentCfg.clients)currentCfg.clients=[]
            const clienteNovo={
              doc:docLimpo,
              nome:crmForm.razao||crmForm.nome,
              fantasia:crmForm.fantasia||crmForm.nome,
              email:crmForm.email,
              telefone:crmForm.telefone,
              cidade:crmForm.cidade,
              uf:crmForm.uf,
              ultimoContato:new Date().toISOString(),
              documentos:crmForm.signToken?[{id:crmForm.signToken,type:crmForm.docTipo,date:new Date().toLocaleString('pt-BR'),status:'draft',token:crmForm.signToken}]:[]
            }
            const idx=docLimpo?currentCfg.clients.findIndex(c=>c.doc===docLimpo):
              (crmForm.email?currentCfg.clients.findIndex(c=>c.email===crmForm.email):-1)
            if(idx===-1){currentCfg.clients.push(clienteNovo)}
            else{
              if(!currentCfg.clients[idx].documentos)currentCfg.clients[idx].documentos=[]
              if(crmForm.signToken)currentCfg.clients[idx].documentos.push({id:crmForm.signToken,type:crmForm.docTipo,date:new Date().toLocaleString('pt-BR'),status:'draft',token:crmForm.signToken})
              currentCfg.clients[idx].ultimoContato=new Date().toISOString()
              currentCfg.clients[idx].nome=clienteNovo.nome
              currentCfg.clients[idx].fantasia=clienteNovo.fantasia
              currentCfg.clients[idx].email=clienteNovo.email
              currentCfg.clients[idx].telefone=clienteNovo.telefone
              currentCfg.clients[idx].cidade=clienteNovo.cidade
            }
          }

          await supabase.from('vx_storage').upsert({key:`cfg:${empresaId}`,value:JSON.stringify(currentCfg),updated_at:new Date().toISOString()},{onConflict:'key'})
          cfgRef.current=currentCfg;setCfg(currentCfg)
          setShowModalCRM(false)
          addBot(`✅ Negócio **"${novoNegocio.titulo}"** salvo no CRM na etapa **${etapas.find(e=>e.id===novoNegocio.etapa)?.label||novoNegocio.etapa}**!`)
        }catch(e){setCrmErro('Erro ao salvar: '+e.message)}
        setCrmSalvando(false)
      }

      return(
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,.82)',zIndex:3500,display:'flex',alignItems:'center',justifyContent:'center',padding:16}} onClick={()=>setShowModalCRM(false)}>
          <div style={{background:'var(--surface)',border:'1px solid var(--border)',borderRadius:16,width:'100%',maxWidth:540,maxHeight:'92vh',overflowY:'auto',display:'flex',flexDirection:'column'}} onClick={e=>e.stopPropagation()}>

            {/* Header */}
            <div style={{padding:'20px 24px 0',display:'flex',alignItems:'center',justifyContent:'space-between',flexShrink:0}}>
              <div style={{fontFamily:'Syne,sans-serif',fontWeight:700,fontSize:17,color:'var(--accent)'}}>🤝 Salvar no CRM</div>
              <button onClick={()=>setShowModalCRM(false)} style={{background:'none',border:'none',color:'var(--muted)',fontSize:22,cursor:'pointer'}}>✕</button>
            </div>
            <div style={{padding:'4px 24px 0',fontSize:12,color:'var(--muted)'}}>
              {docParaCRM.tipo==='proposta'?'📄 Proposta':'📝 Contrato'} · {crmForm.nome}
            </div>

            {/* Abas */}
            <div style={{display:'flex',gap:0,padding:'14px 24px 0',borderBottom:'1px solid var(--border)',flexShrink:0}}>
              {[['negocio','📋 Negócio'],['cliente','🏢 Cliente']].map(([id,label])=>(
                <button key={id} onClick={()=>setCrmAba(id)} style={{padding:'7px 18px',border:'none',borderBottom:`2px solid ${crmAba===id?'var(--accent)':'transparent'}`,background:'none',color:crmAba===id?'var(--accent)':'var(--muted)',fontFamily:'DM Mono,monospace',fontSize:12,cursor:'pointer',transition:'all .15s'}}>
                  {label}
                </button>
              ))}
            </div>

            {/* Corpo */}
            <div style={{padding:'20px 24px',flex:1,overflowY:'auto',display:'flex',flexDirection:'column',gap:12}}>
              {crmAba==='negocio'&&<>
                <div className="field"><label>Título do Negócio *</label><input style={inp} value={crmForm.titulo||''} onChange={e=>setF('titulo',e.target.value)} placeholder="Ex: Proposta – Empresa XYZ"/></div>
                <div className="field"><label>Nome do Contato / Cliente *</label><input style={inp} value={crmForm.nome||''} onChange={e=>setF('nome',e.target.value)} placeholder="Nome completo ou empresa"/></div>
                <div className="field"><label>Etapa do Funil</label>
                  <div style={{display:'flex',flexDirection:'column',gap:6,marginTop:4}}>
                    {etapas.map(et=>{
                      const isSelected = crmForm.etapa === et.id
                      const cores = {
                        lead:'#64748b', lead_qualificado:'#f59e0b', reuniao_agendada:'#3b82f6',
                        proposta_enviada:'#8b5cf6', negociacao:'#ec4899', fechamento:'#10b981',
                        atendimento:'#06b6d4', fechado:'#10b981',
                      }
                      const cor = cores[et.id] || '#00d4ff'
                      return(
                        <button key={et.id} onClick={()=>setF('etapa',et.id)} style={{
                          width:'100%',padding:'10px 14px',borderRadius:8,cursor:'pointer',
                          textAlign:'left',fontSize:13,fontFamily:'DM Mono,monospace',
                          background:isSelected?`${cor}18`:'var(--surface2)',
                          border:`${isSelected?2:1}px solid ${isSelected?cor:'var(--border)'}`,
                          color:isSelected?cor:'var(--muted)',
                          display:'flex',alignItems:'center',justifyContent:'space-between',
                          transition:'all .15s',
                        }}>
                          <span>{et.label}</span>
                          {isSelected&&<span style={{fontSize:12,fontWeight:700,background:cor,color:'#fff',padding:'2px 8px',borderRadius:12}}>✓ SELECIONADO</span>}
                        </button>
                      )
                    })}
                  </div>
                </div>
                {(crmForm.tAd>0||crmForm.tMen>0)&&(
                  <div style={{padding:'10px 14px',background:'rgba(0,212,255,.06)',border:'1px solid rgba(0,212,255,.15)',borderRadius:8,fontSize:13,color:'var(--muted)'}}>
                    💰 Adesão: <strong style={{color:'var(--accent)'}}>{fmt(crmForm.tAd||0)}</strong> · Mensalidade: <strong style={{color:'var(--accent)'}}>{fmt(crmForm.tMen||0)}</strong>
                  </div>
                )}
                <div className="field"><label>Observações</label>
                  <textarea style={{...inp,resize:'vertical',minHeight:72}} value={crmForm.observacoes||''} onChange={e=>setF('observacoes',e.target.value)}/>
                </div>
              </>}
              {crmAba==='cliente'&&<>
                <div className="modal-grid2">
                  <div className="field"><label>Nome Fantasia</label><input style={inp} value={crmForm.fantasia||''} onChange={e=>setF('fantasia',e.target.value)}/></div>
                  <div className="field"><label>Razão Social</label><input style={inp} value={crmForm.razao||''} onChange={e=>setF('razao',e.target.value)}/></div>
                  <div className="field"><label>E-mail</label><input style={inp} value={crmForm.email||''} onChange={e=>setF('email',e.target.value)}/></div>
                  <div className="field"><label>Telefone</label><input style={inp} value={crmForm.telefone||''} onChange={e=>setF('telefone',e.target.value)}/></div>
                  <div className="field"><label>Cidade</label><input style={inp} value={crmForm.cidade||''} onChange={e=>setF('cidade',e.target.value)}/></div>
                  <div className="field"><label>UF</label><input style={inp} value={crmForm.uf||''} onChange={e=>setF('uf',e.target.value)} maxLength={2}/></div>
                </div>
                <div onClick={()=>setF('salvarCliente',!crmForm.salvarCliente)} style={{display:'flex',alignItems:'center',gap:10,padding:'10px 14px',background:crmForm.salvarCliente?'rgba(16,185,129,.06)':'var(--surface2)',border:`1px solid ${crmForm.salvarCliente?'rgba(16,185,129,.25)':'var(--border)'}`,borderRadius:8,cursor:'pointer',transition:'all .15s'}}>
                  <div style={{width:17,height:17,borderRadius:4,border:`2px solid ${crmForm.salvarCliente?'var(--accent3)':'var(--border)'}`,background:crmForm.salvarCliente?'var(--accent3)':'transparent',flexShrink:0,display:'flex',alignItems:'center',justifyContent:'center'}}>
                    {crmForm.salvarCliente&&<span style={{color:'#fff',fontSize:11,fontWeight:700}}>✓</span>}
                  </div>
                  <span style={{fontSize:13,color:'var(--text)'}}>Salvar também na base de <strong style={{color:'var(--accent3)'}}>Clientes</strong></span>
                </div>
              </>}
            </div>

            {crmErro&&<div style={{margin:'0 24px',padding:'8px 12px',background:'rgba(239,68,68,.1)',border:'1px solid rgba(239,68,68,.3)',borderRadius:8,fontSize:12,color:'var(--danger)'}}>⚠️ {crmErro}</div>}

            {/* Footer */}
            <div style={{display:'flex',gap:10,padding:'16px 24px',borderTop:'1px solid var(--border)',flexShrink:0}}>
              <button onClick={()=>setShowModalCRM(false)} style={{flex:1,padding:10,background:'none',border:'1px solid var(--border)',color:'var(--muted)',borderRadius:10,cursor:'pointer',fontFamily:'DM Mono,monospace',fontSize:13}}>Cancelar</button>
              <button onClick={salvarNoCRM} disabled={crmSalvando} style={{flex:2,padding:10,background:'linear-gradient(135deg,var(--accent3),#059669)',border:'none',color:'#fff',borderRadius:10,cursor:crmSalvando?'not-allowed':'pointer',fontFamily:'DM Mono,monospace',fontSize:13,fontWeight:600,opacity:crmSalvando?.7:1}}>
                {crmSalvando?'⏳ Salvando...':'✅ Salvar no CRM'}
              </button>
            </div>
          </div>
        </div>
      )
    })()}

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
  body{font-family:'DM Mono',monospace;background:var(--bg);color:var(--text);min-height:100vh;display:flex;flex-direction:column;align-items:stretch;overflow-x:hidden}
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
  .chat-wrap{position:relative;z-index:10;width:100%;max-width:960px;margin:0 auto;padding:14px 20px 0;flex:1;display:flex;flex-direction:column}
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
