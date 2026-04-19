// pages/sign/[token].js
// ══════════════════════════════════════════════════════════════════
// Página pública de assinatura eletrônica do cliente
// Acessada via link: /sign/<token>
// ══════════════════════════════════════════════════════════════════

import { useState, useEffect, useRef } from 'react'
import Head from 'next/head'
import { supabase } from '../../lib/supabase'

function pad(n){return String(n).padStart(2,'0')}
function nowStr(){
  const d=new Date()
  return `${pad(d.getDate())}/${pad(d.getMonth()+1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}

async function getClientIP(){
  try{
    const r=await fetch('https://api.ipify.org?format=json',{signal:AbortSignal.timeout(3000)})
    const d=await r.json()
    return d.ip||'(IP não capturado)'
  }catch{
    return '(IP não capturado)'
  }
}

export default function SignPage(){
  const [token,   setToken]   = useState(null)
  const [doc,     setDoc]     = useState(null)   // dados do documento
  const [cfg,     setCfg]     = useState({})     // cfg da empresa
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState('')

  // Formulário de assinatura
  const [nome,    setNome]    = useState('')
  const [cpf,     setCpf]     = useState('')
  const [email,   setEmail]   = useState('')
  const [agreed,  setAgreed]  = useState(false)
  const [saving,  setSaving]  = useState(false)
  const [saved,   setSaved]   = useState(false)
  const [errForm, setErrForm] = useState('')

  // Extrai token da URL
  useEffect(()=>{
    if(typeof window==='undefined') return
    const parts = window.location.pathname.split('/')
    const tk = parts[parts.length-1]
    if(tk) setToken(tk)
  },[])

  // Carrega o documento pelo token
  useEffect(()=>{
    if(!token) return
    ;(async()=>{
      setLoading(true)
      try{
        // Busca no vx_storage
        const {data,error:err}=await supabase
          .from('vx_storage')
          .select('value')
          .eq('key',`doc:${token}`)
          .single()

        if(err||!data?.value){
          setError('Documento não encontrado. O link pode ter expirado ou estar incorreto.')
          setLoading(false); return
        }

        const d = JSON.parse(data.value)

        // Verifica expiração
        if(d.expiry && new Date(d.expiry)<new Date()){
          setError('Este link de assinatura expirou. Solicite um novo link ao consultor responsável.')
          setLoading(false); return
        }

        // Verifica se já assinou
        if(d.signedAt && d.signedBy){
          setDoc({...d, jáAssinou: true})
          setLoading(false); return
        }

        setDoc(d)

        // Pré-preenche email se disponível
        if(d.clienteEmail) setEmail(d.clienteEmail)
        if(d.clienteNome)  setNome(d.clienteNome)

        // Carrega cfg da empresa para logo e nome
        if(d.empresaId){
          const {data:cfgRow}=await supabase
            .from('vx_storage')
            .select('value')
            .eq('key',`cfg:${d.empresaId}`)
            .maybeSingle()
          if(cfgRow?.value) setCfg(JSON.parse(cfgRow.value))
        }
      }catch(e){
        setError('Erro ao carregar o documento: '+e.message)
      }
      setLoading(false)
    })()
  },[token])

  async function confirmarAssinatura(){
    if(!nome.trim()){setErrForm('Informe seu nome completo.');return}
    if(!cpf.trim()){setErrForm('Informe seu CPF.');return}
    if(!email.trim()){setErrForm('Informe seu e-mail.');return}
    if(!agreed){setErrForm('Você deve aceitar os termos para assinar.');return}

    setSaving(true); setErrForm('')
    try{
      const ip = await getClientIP()
      const now = nowStr()

      // Re-lê para ter versão mais recente
      const {data:fresh}=await supabase
        .from('vx_storage')
        .select('value')
        .eq('key',`doc:${token}`)
        .single()

      const docData = fresh?.value ? JSON.parse(fresh.value) : {...doc}

      docData.signedAt     = now
      docData.signedBy     = nome.trim()
      docData.signCPF      = cpf.trim()
      docData.signEmail    = email.trim()
      docData.clientEmail  = email.trim()
      docData.signIP       = ip
      docData.status       = docData.consultantSignedAt ? 'signed' : 'pending'

      // Atualiza HTML do manifesto se existir
      if(docData.html){
        let html = docData.html
        html=html.replace(/<span id="manifest-client-name">[^<]*<\/span>/g,
          `<span id="manifest-client-name">${docData.signedBy}</span>`)
        html=html.replace(/<span id="manifest-client-cpf">[^<]*<\/span>/g,
          `<span id="manifest-client-cpf">${docData.signCPF}</span>`)
        html=html.replace(/<span id="manifest-client-email">[^<]*<\/span>/g,
          `<span id="manifest-client-email">${docData.signEmail}</span>`)
        html=html.replace(/<span id="manifest-client-date">[^<]*<\/span>/g,
          `<span id="manifest-client-date">${docData.signedAt}</span>`)
        docData.html=html
      }

      await supabase.from('vx_storage').upsert(
        {key:`doc:${token}`,value:JSON.stringify(docData),updated_at:new Date().toISOString()},
        {onConflict:'key'}
      )

      // Atualiza cfg da empresa com novo status
      if(doc?.empresaId){
        const {data:cfgRow}=await supabase
          .from('vx_storage').select('value').eq('key',`cfg:${doc.empresaId}`).single()
        if(cfgRow?.value){
          const c=JSON.parse(cfgRow.value)
          if(c.docHistory){
            c.docHistory=c.docHistory.map(h=>
              h.signToken===token
                ? {...h,signedAt:now,signedBy:nome.trim(),signCPF:cpf.trim(),signEmail:email.trim(),signIP:ip,status:docData.status}
                : h
            )
          }
          await supabase.from('vx_storage').upsert(
            {key:`cfg:${doc.empresaId}`,value:JSON.stringify(c),updated_at:new Date().toISOString()},
            {onConflict:'key'}
          )
        }
      }

      setDoc({...docData})
      setSaved(true)
    }catch(e){
      setErrForm('Erro ao registrar assinatura: '+e.message)
    }
    setSaving(false)
  }

  const companyName = cfg.company || doc?.empresaId || 'Vivanexa'
  const logoB64     = cfg.logob64 || null

  if(loading) return(
    <div style={{background:'#0a0f1e',minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center',flexDirection:'column',gap:16}}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=DM+Mono:wght@400;500&display=swap');`}</style>
      <div style={{width:48,height:48,border:'3px solid rgba(0,212,255,.2)',borderTop:'3px solid #00d4ff',borderRadius:'50%',animation:'spin 1s linear infinite'}}/>
      <div style={{color:'#64748b',fontFamily:'DM Mono,monospace',fontSize:13}}>Carregando documento...</div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )

  if(error) return(
    <div style={{background:'#0a0f1e',minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center',padding:20}}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=DM+Mono:wght@400;500&display=swap');`}</style>
      <div style={{maxWidth:480,background:'#111827',border:'1px solid rgba(239,68,68,.3)',borderRadius:16,padding:40,textAlign:'center',boxShadow:'0 8px 40px rgba(0,0,0,.4)'}}>
        <div style={{fontSize:48,marginBottom:16}}>⚠️</div>
        <div style={{fontFamily:'Syne,sans-serif',fontSize:18,fontWeight:700,color:'#ef4444',marginBottom:12}}>Documento Indisponível</div>
        <div style={{fontFamily:'DM Mono,monospace',fontSize:13,color:'#64748b',lineHeight:1.7}}>{error}</div>
      </div>
    </div>
  )

  // Já assinou
  if(doc?.jáAssinou || saved) return(
    <div style={{background:'#0a0f1e',minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center',padding:20}}>
      <Head><title>Documento Assinado</title></Head>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=DM+Mono:wght@400;500&display=swap');`}</style>
      <div style={{maxWidth:540,background:'#111827',border:'1px solid rgba(16,185,129,.3)',borderRadius:16,padding:40,textAlign:'center',boxShadow:'0 8px 40px rgba(0,0,0,.4)'}}>
        {logoB64 && <img src={logoB64} alt={companyName} style={{height:48,objectFit:'contain',marginBottom:20,display:'block',margin:'0 auto 20px'}}/>}
        <div style={{fontSize:56,marginBottom:16}}>✅</div>
        <div style={{fontFamily:'Syne,sans-serif',fontSize:20,fontWeight:800,color:'#10b981',marginBottom:12}}>
          {saved ? 'Assinatura Registrada com Sucesso!' : 'Documento Já Assinado'}
        </div>
        <div style={{fontFamily:'DM Mono,monospace',fontSize:13,color:'#94a3b8',lineHeight:1.8,marginBottom:24}}>
          {saved
            ? `Obrigado, ${nome}! Sua assinatura eletrônica foi registrada conforme a Lei nº 14.063/2020.`
            : `Este documento foi assinado por ${doc.signedBy} em ${doc.signedAt}.`
          }
        </div>
        <div style={{background:'rgba(16,185,129,.08)',border:'1px solid rgba(16,185,129,.2)',borderRadius:10,padding:'14px 18px',textAlign:'left',fontSize:12,fontFamily:'DM Mono,monospace',color:'#64748b',lineHeight:1.8}}>
          <div><strong style={{color:'#94a3b8'}}>Signatário:</strong> {doc.signedBy||nome}</div>
          <div><strong style={{color:'#94a3b8'}}>CPF:</strong> {doc.signCPF||cpf}</div>
          <div><strong style={{color:'#94a3b8'}}>E-mail:</strong> {doc.signEmail||email}</div>
          <div><strong style={{color:'#94a3b8'}}>Data/Hora:</strong> {doc.signedAt||nowStr()}</div>
          <div><strong style={{color:'#94a3b8'}}>IP:</strong> {doc.signIP||'—'}</div>
          <div><strong style={{color:'#94a3b8'}}>Token:</strong> {token}</div>
        </div>
        <div style={{marginTop:20,fontSize:11,color:'#475569',lineHeight:1.6}}>
          Assinatura eletrônica simples conforme <strong>Lei nº 14.063/2020</strong> e MP 2.200-2/2001.
        </div>
      </div>
    </div>
  )

  return(
    <>
      <Head>
        <title>Assinar Documento — {companyName}</title>
        <meta name="viewport" content="width=device-width,initial-scale=1"/>
      </Head>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@600;700;800&family=DM+Mono:wght@300;400;500&family=Inter:wght@400;500;600&display=swap');
        *{box-sizing:border-box;margin:0;padding:0}
        :root{--bg:#0a0f1e;--surface:#111827;--surface2:#1a2540;--border:#1e2d4a;--accent:#00d4ff;--accent3:#10b981;--text:#e2e8f0;--muted:#64748b;--gold:#fbbf24;--danger:#ef4444}
        body{background:var(--bg);color:var(--text);font-family:'DM Mono',monospace;min-height:100vh}
        .wrap{max-width:900px;margin:0 auto;padding:20px 16px}
        .hdr{background:rgba(10,15,30,.9);border-bottom:1px solid var(--border);padding:14px 20px;display:flex;align-items:center;gap:12;backdrop-filter:blur(12px);position:sticky;top:0;z-index:10}
        .doc-frame{background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 8px 40px rgba(0,0,0,.3)}
        .sign-box{background:var(--surface);border:1px solid var(--border);border-radius:14px;padding:28px;margin-top:20px}
        .field{margin-bottom:14px}
        .field label{font-size:11px;color:var(--muted);display:block;margin-bottom:5px;letter-spacing:.5px;text-transform:uppercase}
        .field input{width:100%;background:var(--surface2);border:1px solid var(--border);border-radius:8px;padding:11px 14px;font-family:'DM Mono',monospace;font-size:13px;color:var(--text);outline:none;transition:border-color .2s}
        .field input:focus{border-color:var(--accent)}
        .grid2{display:grid;grid-template-columns:1fr 1fr;gap:12px}
        @media(max-width:500px){.grid2{grid-template-columns:1fr}}
        .btn-sign{width:100%;padding:15px;background:linear-gradient(135deg,var(--accent3),#059669);border:none;color:#fff;font-family:'DM Mono',monospace;font-size:15px;font-weight:600;border-radius:12px;cursor:pointer;transition:all .2s;margin-top:8px}
        .btn-sign:hover{transform:translateY(-1px);box-shadow:0 0 24px rgba(16,185,129,.4)}
        .btn-sign:disabled{opacity:.6;cursor:not-allowed;transform:none}
        .check-wrap{display:flex;align-items:flex-start;gap:12px;padding:14px;background:rgba(16,185,129,.05);border:1px solid rgba(16,185,129,.2);border-radius:10px;cursor:pointer;user-select:none;margin-top:4px}
        .check-wrap.active{background:rgba(16,185,129,.1);border-color:rgba(16,185,129,.4)}
        .checkbox{width:20px;height:20px;border-radius:5px;border:2px solid var(--border);background:transparent;flex-shrink:0;display:flex;align-items:center;justify-content:center;margin-top:1px;transition:all .2s}
        .check-wrap.active .checkbox{border-color:var(--accent3);background:var(--accent3)}
        .err{padding:10px 14px;background:rgba(239,68,68,.1);border:1px solid rgba(239,68,68,.3);border-radius:8px;font-size:12px;color:var(--danger);margin-top:10px}
        .badge-tipo{display:inline-flex;align-items:center;gap:6px;padding:6px 14px;border-radius:20px;font-size:12px;font-weight:600;font-family:'DM Mono',monospace}
        .orb{position:fixed;border-radius:50%;filter:blur(120px);pointer-events:none;z-index:0;opacity:.08}
      `}</style>

      <div className="orb" style={{width:400,height:400,background:'#00d4ff',top:-150,right:-100}}/>
      <div className="orb" style={{width:300,height:300,background:'#7c3aed',bottom:-100,left:-80}}/>

      {/* Header */}
      <div className="hdr">
        {logoB64
          ? <img src={logoB64} alt={companyName} style={{height:36,objectFit:'contain'}}/>
          : <div style={{fontFamily:'Syne,sans-serif',fontWeight:800,color:'#00d4ff',fontSize:16}}>{companyName}</div>
        }
        <div style={{flex:1}}/>
        <span className="badge-tipo" style={{
          background: doc?.tipo==='contrato'?'rgba(245,158,11,.15)':'rgba(0,212,255,.15)',
          border:`1px solid ${doc?.tipo==='contrato'?'rgba(245,158,11,.35)':'rgba(0,212,255,.3)'}`,
          color: doc?.tipo==='contrato'?'#f59e0b':'#00d4ff'
        }}>
          {doc?.tipo==='contrato'?'📝 Contrato':'📋 Proposta'}
        </span>
      </div>

      <div className="wrap" style={{position:'relative',zIndex:1}}>

        {/* Documento */}
        {doc?.html && (
          <div style={{marginBottom:4}}>
            <div style={{fontSize:11,color:'#64748b',fontFamily:'DM Mono,monospace',marginBottom:10,textAlign:'center',letterSpacing:.5}}>
              📄 DOCUMENTO PARA ASSINATURA
            </div>
            <div className="doc-frame">
              <style>{`
                .doc-frame p{margin:0 0 8px;font-family:Calibri,'Segoe UI',Arial,sans-serif;font-size:11pt;line-height:1.6;color:#1e293b}
                .doc-frame table{width:100%;border-collapse:collapse;margin:12px 0}
                .doc-frame td,.doc-frame th{border:1px solid #cbd5e1;padding:6px 10px;vertical-align:top;font-family:Calibri,'Segoe UI',Arial,sans-serif;font-size:11pt;color:#1e293b}
                .doc-frame th{background:#f1f5f9;font-weight:700}
                .doc-frame img{max-width:100%;height:auto;display:block}
                .doc-frame strong,.doc-frame b{font-weight:700}
                .doc-frame h1,.doc-frame h2,.doc-frame h3,.doc-frame h4{margin:0 0 8px;line-height:1.3;font-family:Calibri,'Segoe UI',Arial,sans-serif;color:#1e293b}
              `}</style>
              <div style={{padding:'40px 52px',background:'#fff'}} dangerouslySetInnerHTML={{__html:doc.html}}/>
            </div>
          </div>
        )}

        {!doc?.html && (
          <div style={{background:'var(--surface)',border:'1px solid var(--border)',borderRadius:12,padding:32,textAlign:'center',marginBottom:4}}>
            <div style={{fontSize:48,marginBottom:12}}>📄</div>
            <div style={{fontFamily:'Syne,sans-serif',fontSize:16,fontWeight:700,color:'#00d4ff',marginBottom:8}}>
              {doc?.tipo==='contrato'?'Contrato':'Proposta'}: {doc?.clienteNome||'—'}
            </div>
            <div style={{fontSize:13,color:'#64748b'}}>Documento aguardando assinatura eletrônica</div>
          </div>
        )}

        {/* Formulário de assinatura */}
        <div className="sign-box">
          <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:20}}>
            <div style={{fontSize:24}}>✍️</div>
            <div>
              <div style={{fontFamily:'Syne,sans-serif',fontWeight:700,color:'#00d4ff',fontSize:16}}>Assinatura Eletrônica</div>
              <div style={{fontSize:11,color:'#64748b',marginTop:2}}>Conforme Lei nº 14.063/2020</div>
            </div>
          </div>

          <div className="grid2">
            <div className="field">
              <label>Nome Completo *</label>
              <input value={nome} onChange={e=>setNome(e.target.value)} placeholder="Seu nome completo"/>
            </div>
            <div className="field">
              <label>CPF *</label>
              <input value={cpf} onChange={e=>setCpf(e.target.value)} placeholder="000.000.000-00"/>
            </div>
          </div>
          <div className="field">
            <label>E-mail *</label>
            <input type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="seu@email.com"/>
          </div>

          <div className={`check-wrap${agreed?' active':''}`} onClick={()=>setAgreed(v=>!v)}>
            <div className="checkbox">
              {agreed && <span style={{color:'#fff',fontSize:13,fontWeight:700}}>✓</span>}
            </div>
            <div style={{fontSize:12,color:'#94a3b8',lineHeight:1.65}}>
              Declaro que li e concordo com todos os termos do documento acima. Confirmo que esta assinatura eletrônica tem validade jurídica conforme a <strong style={{color:'#e2e8f0'}}>Lei nº 14.063/2020</strong> e a MP 2.200-2/2001.
            </div>
          </div>

          {errForm && <div className="err">⚠️ {errForm}</div>}

          <button
            className="btn-sign"
            onClick={confirmarAssinatura}
            disabled={saving}
          >
            {saving ? '⏳ Registrando assinatura...' : '✅ Confirmar e Assinar'}
          </button>

          <div style={{marginTop:16,fontSize:11,color:'#475569',textAlign:'center',lineHeight:1.6}}>
            🔒 Seus dados são registrados com segurança, incluindo IP e data/hora, para fins de autenticidade do documento.
          </div>
        </div>

      </div>
    </>
  )
}
