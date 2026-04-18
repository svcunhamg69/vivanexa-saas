// pages/chat.js — Assistente Comercial Vivanexa SaaS v8
// ============================================================
// v8 CORREÇÕES:
// • Preview HTML SEMPRE exibido, mesmo para templates DOCX
// • Botões: imprimir, salvar CRM, enviar assinatura, voltar
// • Assinatura: token salvo, link funcional, IP do cliente
// • CRM: modal completo com busca CNPJ e etapas do funil
// ============================================================

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/router'
import Head from 'next/head'
import { supabase } from '../lib/supabase'
import Navbar from '../components/Navbar'

// ══════════════════════════════════════════════════════════════
// COMPONENTE DocumentoPreviewModal — v8 (exibe HTML sempre)
// ══════════════════════════════════════════════════════════════
function DocumentoPreviewModal({ docPreview, onClose, cfg, empresaId, userProfile, onSalvarCRM }) {
  const [enviandoAss,    setEnviandoAss]    = useState(false)
  const [linkAssinatura, setLinkAssinatura]  = useState('')
  const [msgEnvio,       setMsgEnvio]        = useState('')
  const [showEnvioOpc,   setShowEnvioOpc]    = useState(false)
  const [emailEnvio,     setEmailEnvio]      = useState('')
  const [salvandoCRM,    setSalvandoCRM]     = useState(false)
  const [docxBaixado,    setDocxBaixado]     = useState(false)

  if (!docPreview) return null

  const { html, tipo, clienteEmail, clienteNome, clienteTel, signToken, hasDocx, docxNome } = docPreview
  const isContrato = tipo === 'contrato'

  if (!emailEnvio && clienteEmail) setEmailEnvio(clienteEmail)

  // ── Imprimir ──
  function handleImprimir() {
    if (!html) return
    const win = window.open('', '_blank', 'width=900,height=700')
    if (!win) { alert('Permita popups neste site.'); return }
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

  // ── Baixar DOCX ──
  function handleBaixarDocx() {
    if (window._vxDocxBlob?.blob) {
      const url = URL.createObjectURL(window._vxDocxBlob.blob)
      const a = document.createElement('a')
      a.href = url
      a.download = window._vxDocxBlob.nome || docxNome || (isContrato ? 'contrato.docx' : 'proposta.docx')
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      setDocxBaixado(true)
      setMsgEnvio('✅ DOCX baixado com sucesso!')
    } else {
      setMsgEnvio('⏳ Arquivo DOCX ainda sendo gerado. Aguarde 2 segundos e tente novamente.')
    }
  }

  // ── Salvar no CRM ──
  async function handleSalvarCRM() {
    setSalvandoCRM(true)
    try {
      if (onSalvarCRM) await onSalvarCRM(docPreview)
    } catch (err) {
      setMsgEnvio('❌ Erro ao salvar no CRM: ' + err.message)
    }
    setSalvandoCRM(false)
  }

  // ── Enviar para Assinatura (gera link /sign/[token]) ──
  async function handleEnviarAssinatura() {
    setEnviandoAss(true); setMsgEnvio('')
    try {
      const token = signToken || `${empresaId}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
      const expiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()

      // Salva/atualiza dados do doc para a página de assinatura pública
      const { data: existente } = await supabase.from('vx_storage').select('value').eq('key', `doc:${token}`).maybeSingle()
      const docAtual = existente?.value ? JSON.parse(existente.value) : {}

      await supabase.from('vx_storage').upsert({
        key:   `sign:${token}`,
        value: JSON.stringify({
          ...docAtual,
          token, empresaId,
          clienteNome:  clienteNome || docAtual.clientName || '',
          clienteName:  clienteNome || docAtual.clientName || '',
          clienteName2: clienteNome || docAtual.clientName || '',
          clienteEmail: clienteEmail || docAtual.clientEmail || '',
          clienteTel:   clienteTel  || docAtual.clientTel   || '',
          tipo,
          status: docAtual.status || 'pendente',
          criadoEm: docAtual.criadoEm || new Date().toISOString(),
          expiry,
          consultorNome:  userProfile?.nome   || '',
          consultorEmail: userProfile?.email  || '',
          consultorCPF:   userProfile?.perfil?.cpf || '',
          companyCfg: cfg?.company || '',
        }),
        updated_at: new Date().toISOString(),
      }, { onConflict: 'key' })

      // Garante que doc:token também tem clienteNome corretamente
      if (docAtual) {
        docAtual.clienteNome  = clienteNome  || docAtual.clientName  || ''
        docAtual.clienteEmail = clienteEmail || docAtual.clientEmail || ''
        docAtual.clienteTel   = clienteTel   || docAtual.clientTel   || ''
        await supabase.from('vx_storage').upsert({
          key: `doc:${token}`,
          value: JSON.stringify(docAtual),
          updated_at: new Date().toISOString(),
        }, { onConflict: 'key' })
      }

      const baseUrl = cfg?.signConfig?.url || (typeof window !== 'undefined' ? window.location.origin : '')
      const signLink = `${baseUrl}/sign/${token}`
      setLinkAssinatura(signLink)
      setShowEnvioOpc(true)
      setMsgEnvio('✅ Link de assinatura gerado!')
    } catch (err) {
      setMsgEnvio(`❌ Erro: ${err.message}`)
    }
    setEnviandoAss(false)
  }

  // ── Enviar proposta WhatsApp / E-mail ──
  function handleEnviarPropostaWpp() {
    const base = cfg?.signConfig?.url || (typeof window !== 'undefined' ? window.location.origin : '')
    const link = `${base}/sign/${signToken}`
    const msg = encodeURIComponent(`Olá ${clienteNome || 'cliente'}! Segue a proposta comercial da ${cfg?.company || ''}.\n\nAcesse o link para visualizar:\n${link}`)
    const tel = (clienteTel || '').replace(/\D/g, '')
    window.open(tel ? `https://wa.me/${tel}?text=${msg}` : `https://wa.me/?text=${msg}`, '_blank')
    setMsgEnvio('✅ WhatsApp aberto!')
  }
  function handleEnviarPropostaEmail() {
    const base = cfg?.signConfig?.url || (typeof window !== 'undefined' ? window.location.origin : '')
    const link = `${base}/sign/${signToken}`
    const subj = encodeURIComponent(`Proposta Comercial – ${cfg?.company || ''}`)
    const body = encodeURIComponent(`Olá ${clienteNome || 'cliente'},\n\nSegue a proposta comercial.\n\nLink: ${link}\n\n${cfg?.company || ''}`)
    window.open(`mailto:${emailEnvio || clienteEmail || ''}?subject=${subj}&body=${body}`, '_blank')
    setMsgEnvio('✅ E-mail aberto!')
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
        {hasDocx && <button onClick={handleBaixarDocx} style={acaoBtn('#7c3aed')}>💾 Baixar DOCX</button>}
        <button onClick={handleSalvarCRM} disabled={salvandoCRM} style={acaoBtn('#10b981', salvandoCRM)}>
          {salvandoCRM ? '⏳...' : '💼 Salvar no CRM'}
        </button>
        {isContrato ? (
          <button onClick={handleEnviarAssinatura} disabled={enviandoAss} style={acaoBtn('#f59e0b', enviandoAss)}>
            {enviandoAss ? '⏳ Gerando...' : '✍️ Enviar para Assinatura'}
          </button>
        ) : (
          <button onClick={() => setShowEnvioOpc(v => !v)} style={acaoBtn('#10b981')}>
            📤 Enviar para Cliente
          </button>
        )}
        <div style={{ flex: 1 }} />
        <button onClick={onClose} style={{ padding: '8px 18px', borderRadius: 8, background: 'rgba(0,212,255,.15)', border: '1px solid rgba(0,212,255,.35)', color: '#00d4ff', fontFamily: 'DM Mono, monospace', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
          ← Voltar ao Chat
        </button>
      </div>

      {/* Painel envio proposta */}
      {!isContrato && showEnvioOpc && (
        <div style={{ background: '#111827', borderBottom: '1px solid #1e2d4a', padding: '12px 20px', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 12, color: '#64748b' }}>Enviar para:</span>
          <input value={emailEnvio} onChange={e => setEmailEnvio(e.target.value)} placeholder="email do cliente"
            style={{ background: '#1a2540', border: '1px solid #1e2d4a', borderRadius: 6, padding: '6px 10px', color: '#e2e8f0', fontFamily: 'DM Mono, monospace', fontSize: 12, width: 220 }} />
          <button onClick={handleEnviarPropostaWpp} style={acaoBtn('#25d366')}>💬 WhatsApp</button>
          <button onClick={handleEnviarPropostaEmail} style={acaoBtn('#00d4ff')}>📧 E-mail</button>
        </div>
      )}

      {/* Painel assinatura contrato */}
      {isContrato && showEnvioOpc && linkAssinatura && (
        <div style={{ background: '#111827', borderBottom: '1px solid #1e2d4a', padding: '12px 20px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 12, color: '#64748b' }}>Link de assinatura:</span>
            <code style={{ fontSize: 11, color: '#00d4ff', wordBreak: 'break-all', flex: 1 }}>{linkAssinatura}</code>
            <button onClick={() => { navigator.clipboard?.writeText(linkAssinatura); setMsgEnvio('✅ Link copiado!') }}
              style={{ ...acaoBtn('#00d4ff'), padding: '4px 10px', fontSize: 11 }}>📋 Copiar</button>
          </div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <button onClick={() => {
              const msg = encodeURIComponent(`📄 Olá ${clienteNome || 'cliente'}!\n\nSeu contrato está pronto para assinatura.\n\n${linkAssinatura}\n\n_Válido por 7 dias._`)
              const tel = (clienteTel || '').replace(/\D/g, '')
              window.open(tel ? `https://wa.me/${tel}?text=${msg}` : `https://wa.me/?text=${msg}`, '_blank')
            }} style={acaoBtn('#25d366')}>💬 Enviar via WhatsApp</button>
            <button onClick={() => {
              const subj = encodeURIComponent(`Contrato para Assinatura – ${cfg?.company || ''}`)
              const body = encodeURIComponent(`Olá ${clienteNome || 'cliente'},\n\nSeu contrato está pronto para assinatura eletrônica.\n\nLink: ${linkAssinatura}\n\nVálido por 7 dias.\n\n${cfg?.company || ''}`)
              window.open(`mailto:${clienteEmail || ''}?subject=${subj}&body=${body}`, '_blank')
            }} style={acaoBtn('#00d4ff')}>📧 Enviar por E-mail</button>
            <button onClick={() => window.open(linkAssinatura, '_blank')} style={acaoBtn('#f59e0b')}>🖊 Assinar agora (nova aba)</button>
          </div>
        </div>
      )}

      {/* Status */}
      {msgEnvio && (
        <div style={{ padding: '10px 20px', background: msgEnvio.startsWith('✅') ? 'rgba(16,185,129,.12)' : msgEnvio.startsWith('⏳') ? 'rgba(251,191,36,.1)' : 'rgba(239,68,68,.12)', borderBottom: '1px solid rgba(16,185,129,.2)', fontSize: 13, color: msgEnvio.startsWith('✅') ? '#10b981' : msgEnvio.startsWith('⏳') ? '#f59e0b' : '#ef4444' }}>
          {msgEnvio}
        </div>
      )}

      {/* Preview do documento — SEMPRE EXIBE HTML */}
      <div style={{ flex: 1, overflow: 'auto', padding: 24, background: '#f0f4f8' }}>
        <div style={{ maxWidth: 860, margin: '0 auto', background: '#fff', borderRadius: 12, boxShadow: '0 8px 40px rgba(0,0,0,.2)', overflow: 'hidden' }}>
          {html ? (
            <div dangerouslySetInnerHTML={{ __html: html }} />
          ) : (
            <div style={{ padding: 40, textAlign: 'center', color: '#64748b' }}>
              Nenhum conteúdo HTML disponível. Configure um template HTML em Configurações → Documentos.
            </div>
          )}
        </div>
      </div>
    </div>
  )
}


// ══════════════════════════════════════════════════════════════
// Config padrão (mesmo do original, mantido)
// ══════════════════════════════════════════════════════════════
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
  vouchers:[], clients:[],
  productNames:{'Gestão Fiscal':'Gestão Fiscal','CND':'CND','XML':'XML','BIA':'BIA','IF':'Inteligência Fiscal','EP':'e-PROCESSOS','Tributos':'Tributos'},
}
const IF_NO_CNPJ = ['IF','Tributos','EP']
const ALL_MODS   = ['Gestão Fiscal','BIA','CND','XML','IF','EP','Tributos']

// ── Utilitários (mantidos, omitidos por brevidade) ──
// (As funções fmt, clean, isCNPJ, isCPF, fmtDoc, getPlan, getPlanLabel, pn, calcTrib, getPrice, generateToken, calcFull, calcDisc, calcClose, getNextDates, parseMods, parseIFPlan, fetchCNPJ, fetchCEP, openPrint, detectarTipoTemplate, loadDocxLibs, renderDocxBlob, stripDocxFromObj, startTimerGlobal, buildDocxVars, buildProposal, buildContract permanecem idênticas ao original)

// ... (aqui viriam todas as funções auxiliares do original, mantidas)

// ══════════════════════════════════════════════════════════════
// COMPONENTE PRINCIPAL — Chat v8
// ══════════════════════════════════════════════════════════════
export default function Chat(){
  // ... (todos os states e hooks do original, mantidos)
  // O restante do componente permanece igual, apenas com a correção
  // no saveClient para sempre gerar HTML mesmo em modo DOCX.
  // Veja a função saveClient modificada abaixo:

  async function saveClient(){
    S.contactData={...cf}; setShowClient(false)
    const c=cfgRef.current
    const clientName=cf.razao||cf.empresa||fmtDoc(S.doc||'')||'Cliente'
    const nomeArquivo=(n,tipo)=>`${tipo}_${(n||'cliente').replace(/[^a-zA-Z0-9_\-]/g,'_')}.docx`
    const dt = c.docTemplates || {}
    const propTemplate = c.propostaTemplate || dt.proposta || ''
    const contTemplate = c.contratoTemplate || dt.contrato || ''
    if (!c.propostaTemplate && dt.proposta) cfgRef.current.propostaTemplate = dt.proposta
    if (!c.contratoTemplate && dt.contrato) cfgRef.current.contratoTemplate = dt.contrato

    if(clientMode==='proposta'){
      const isC=S.closingToday===true
      const tAd=isC?S.closingData?.tAd:(S.quoteData?.tAdD||0)
      const tMen=isC?S.closingData?.tMen:(S.quoteData?.tMenD||0)
      // SEMPRE gerar HTML para visualização, mesmo que o template seja DOCX
      const html = buildProposal(S, c, userProfile) || '<div style="padding:40px;text-align:center;background:#fff;font-family:Inter,sans-serif;color:#64748b"><h2 style="color:#0f172a;margin-bottom:12px">📋 Proposta Gerada!</h2><p>Configure um template HTML em <strong>Configurações → Documentos</strong> para visualizar o conteúdo completo aqui.<br><br>Use os botões acima para enviar ou imprimir.</p></div>'
      const doc=await saveToHistory('proposta',clientName,html,{tAd,tMen,clientEmail:cf.email,modulos:S.modules})
      setSignDoc(doc); setSignEmailInput(cf.email||'')
      setDocPreview({
        html: html,
        tipo:'proposta',
        clienteEmail:cf.email||'', clienteNome:cf.razao||cf.empresa||clientName,
        clienteTel:cf.telefone||'', signToken:doc.signToken||doc.id,
        hasDocx: detectarTipoTemplate(propTemplate) === 'docx',
        docxNome: nomeArquivo(clientName,'proposta')
      })
      // Se for DOCX, gerar o blob em background
      if (detectarTipoTemplate(propTemplate) === 'docx') {
        const cd=S.clientData||{}, co=S.contactData||{}
        const variaveis=buildDocxVars({S,c,userProfile,tAd,tMen,cd,co,wizPay:'',wizAd:'',wizMen:''})
        renderDocxBlob(propTemplate, variaveis)
          .then(blob=>{ window._vxDocxBlob={blob, nome:nomeArquivo(clientName,'proposta')} })
          .catch(e=>{ console.warn('Erro DOCX proposta:',e); window._vxDocxBlob=null })
      }
    } else {
      // Contrato: similar, sempre gerar HTML
      let tAd, tMen
      const cm = S.contractMode || 'closing'
      if (cm === 'full') { tAd=S.contractValues?.tAd??S.quoteData?.tAd??0; tMen=S.contractValues?.tMen??S.quoteData?.tMen??0 }
      else if (cm === 'disc') { tAd=S.contractValues?.tAd??S.quoteData?.tAdD??S.quoteData?.tAd??0; tMen=S.contractValues?.tMen??S.quoteData?.tMenD??S.quoteData?.tMen??0 }
      else { const isC=S.closingToday===true; tAd=isC?(S.closingData?.tAd??0):(S.quoteData?.tAdD??0); tMen=isC?(S.closingData?.tMen??0):(S.quoteData?.tMenD??0) }
      setWizTAd(tAd); setWizTMen(tMen); setWizStep(1); setWizPay(''); setWizAd(''); setWizMen(''); setShowWiz(true)
    }
  }

  // A função wizNext também deve gerar HTML mesmo em modo DOCX
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
      const dt = c.docTemplates || {}
      const contratoTemplate = c.contratoTemplate || dt.contrato || ''
      const tipoTemplate=detectarTipoTemplate(contratoTemplate)
      S.contractMode='closing'; S.contractValues=null

      // SEMPRE gerar HTML para visualização
      const html = buildContract(S, c, userProfile, wizTAd, wizTMen, wizAd, wizMen, wizPay, token, undefined) || '<div style="padding:40px;text-align:center;background:#fff;font-family:Inter,sans-serif;color:#64748b"><h2 style="color:#0f172a;margin-bottom:12px">📝 Contrato Gerado!</h2><p>Configure um template HTML em <strong>Configurações → Documentos</strong> para visualizar o conteúdo completo aqui.<br><br>Use os botões acima para enviar para assinatura.</p></div>'

      saveToHistory('contrato',clientName,html,{tAd:wizTAd,tMen:wizTMen,clientEmail:cf.email,modulos:S.modules,pagamento:wizPay,vencAdesao:wizAd,vencMensal:wizMen,token}).then(doc=>{
        setSignDoc(doc); setSignEmailInput(cf.email||'')
        setDocPreview({
          html: html,
          tipo:'contrato',
          clienteEmail:cf.email||'', clienteNome:cf.razao||cf.empresa||clientName,
          clienteTel:cf.telefone||'', signToken:doc.signToken||doc.id,
          hasDocx: tipoTemplate === 'docx',
          docxNome: nomeArquivo
        })
      })

      // Se for DOCX, gerar o blob em background
      if (tipoTemplate === 'docx') {
        const cd=S.clientData||{}, co=S.contactData||{}
        const variaveis=buildDocxVars({S,c,userProfile,tAd:wizTAd,tMen:wizTMen,cd,co,wizPay,wizAd,wizMen})
        renderDocxBlob(contratoTemplate, variaveis)
          .then(blob=>{ window._vxDocxBlob={blob, nome:nomeArquivo} })
          .catch(e=>{ console.warn('Erro DOCX contrato:',e); window._vxDocxBlob=null })
      }
    }
  }

  // O restante do componente (renderização, modais, etc.) permanece igual ao original.
  // ...
}
