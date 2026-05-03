// pages/admin.js — Vivanexa Master Admin v5
// ✅ Sessao isolada | ✅ Vendedores comissao+recorrencia | ✅ Metas Planejado x Realizado
// ✅ Usuarios admin controle de abas | ✅ Portal vendedor | ✅ Relatorio comissoes
// ✅ Status pagamento | ✅ Exportar PDF/Excel/CSV/TXT | ✅ Modal cobranca (Boleto/PIX/Cartao/Email)
// ✅ Credenciais cliente na aba Acesso | ✅ Templates email configuráveis
// ✅ Regua cobrança automatica | ✅ Financeiro avancado com inadimplencia

import { useState, useEffect, useCallback } from 'react'
import Head from 'next/head'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  { auth: { storageKey: 'vx_master_session', persistSession: true } }
)

const MASTER_EMAILS = ['admin@vivanexa.com.br', 'master@vivanexa.com.br']

const TODAS_ABAS = [
  { id:'tenants',    icon:'🏢', label:'Clientes'       },
  { id:'vendedores', icon:'👔', label:'Vendedores'     },
  { id:'usuarios',   icon:'👥', label:'Usuarios Admin' },
  { id:'planos',     icon:'📦', label:'Planos'         },
  { id:'financeiro', icon:'💰', label:'Financeiro'     },
  { id:'relvendas',  icon:'📊', label:'Rel. Vendas'    },
  { id:'comissoes',  icon:'🏆', label:'Comissoes'      },
  { id:'metricas',   icon:'📈', label:'Metricas'       },
  { id:'config',     icon:'⚙️', label:'Config'         },
]

const TODOS_MODULOS = [
  { id:'chat',             label:'💬 Chat / Assistente IA',  grupo:'Comercial'  },
  { id:'whatsapp_inbox',   label:'📱 WhatsApp Inbox',        grupo:'Comercial'  },
  { id:'crm',              label:'🤝 CRM',                   grupo:'Comercial'  },
  { id:'gerador_leads',    label:'🎯 Gerador de Leads',      grupo:'Comercial'  },
  { id:'disparo_massa',    label:'📣 Disparo em Massa',      grupo:'Comercial'  },
  { id:'chatbot',          label:'🤖 Chatbot',               grupo:'Comercial'  },
  { id:'agente_ia',        label:'🧠 Agente IA',             grupo:'Comercial'  },
  { id:'script_playbook',  label:'📋 Script / Playbook',     grupo:'Comercial'  },
  { id:'campanhas_ia',     label:'🎯 Campanhas IA',          grupo:'Marketing'  },
  { id:'agenda_pub',       label:'📅 Agenda Publicacao',     grupo:'Marketing'  },
  { id:'geracao_conteudo', label:'✨ Geracao de Conteudo',   grupo:'Marketing'  },
  { id:'contas_receber',   label:'💵 Contas a Receber',      grupo:'Financeiro' },
  { id:'contas_pagar',     label:'💸 Contas a Pagar',        grupo:'Financeiro' },
  { id:'boleto_pix',       label:'🏦 Boleto / PIX',          grupo:'Financeiro' },
  { id:'cartao',           label:'💳 Cartao',                grupo:'Financeiro' },
  { id:'comissoes',        label:'🏆 Comissoes',             grupo:'Financeiro' },
  { id:'rel_estrategico',  label:'🎯 Visao Estrategica',     grupo:'Relatorios' },
  { id:'rel_financeiro',   label:'💰 Rel. Financeiro',       grupo:'Relatorios' },
  { id:'rel_kpis',         label:'📊 KPIs da Equipe',        grupo:'Relatorios' },
  { id:'rel_vendas',       label:'🛒 Rel. Vendas',           grupo:'Relatorios' },
  { id:'rel_produtos',     label:'📦 Rel. Produtos',         grupo:'Relatorios' },
  { id:'rel_comercial',    label:'💼 Rel. Comercial',        grupo:'Relatorios' },
  { id:'cfg_empresa',      label:'🏢 Config Empresa',        grupo:'Config'     },
  { id:'cfg_usuarios',     label:'👥 Config Usuarios',       grupo:'Config'     },
  { id:'cfg_produtos',     label:'📦 Config Produtos',       grupo:'Config'     },
  { id:'cfg_whatsapp',     label:'📱 Config WhatsApp',       grupo:'Config'     },
  { id:'dashboard',        label:'🏠 Dashboard',             grupo:'Gestao'     },
  { id:'kpi',              label:'📊 Lancar KPIs',           grupo:'Gestao'     },
]
const GRUPOS = [...new Set(TODOS_MODULOS.map(m => m.grupo))]

const MODULOS_POR_PLANO = {
  starter: ['dashboard','chat','crm','kpi','rel_estrategico','cfg_empresa'],
  basic:   ['dashboard','chat','crm','kpi','whatsapp_inbox','gerador_leads','rel_estrategico','rel_vendas','cfg_empresa','cfg_usuarios','cfg_produtos'],
  pro:     ['dashboard','chat','crm','kpi','whatsapp_inbox','gerador_leads','disparo_massa','chatbot','agente_ia','script_playbook','campanhas_ia','contas_receber','contas_pagar','rel_estrategico','rel_financeiro','rel_kpis','rel_vendas','rel_comercial','cfg_empresa','cfg_usuarios','cfg_produtos','cfg_whatsapp'],
  top:     TODOS_MODULOS.map(m => m.id),
  topplus: TODOS_MODULOS.map(m => m.id),
  custom:  [],
}

const PLANOS_PADRAO = [
  { id:'starter', name:'Starter',  maxUsuarios:2,   cor:'#64748b', adesao:0, mensalidade:0 },
  { id:'basic',   name:'Basic',    maxUsuarios:3,   cor:'#00d4ff', adesao:0, mensalidade:0 },
  { id:'pro',     name:'Pro',      maxUsuarios:8,   cor:'#7c3aed', adesao:0, mensalidade:0 },
  { id:'top',     name:'Top',      maxUsuarios:20,  cor:'#10b981', adesao:0, mensalidade:0 },
  { id:'topplus', name:'Top Plus', maxUsuarios:999, cor:'#f59e0b', adesao:0, mensalidade:0 },
  { id:'custom',  name:'Custom',   maxUsuarios:0,   cor:'#ec4899', adesao:0, mensalidade:0 },
]

const STATUS_TENANT = [
  { id:'trial',    label:'Trial',    cor:'#f59e0b' },
  { id:'ativo',    label:'Ativo',    cor:'#10b981' },
  { id:'suspenso', label:'Suspenso', cor:'#ef4444' },
  { id:'cancelado',label:'Cancelado',cor:'#64748b' },
]

const REGUA_PADRAO = [
  { diasAposVenc:2,  canal:['email'],            assunto:'Lembrete de pagamento',      ativo:true,  suspenderAcesso:false },
  { diasAposVenc:5,  canal:['email','whatsapp'], assunto:'Pagamento pendente',          ativo:true,  suspenderAcesso:false },
  { diasAposVenc:10, canal:['email','whatsapp'], assunto:'Urgente: pagamento em atraso',ativo:true,  suspenderAcesso:false },
  { diasAposVenc:20, canal:['email','whatsapp'], assunto:'Acesso sera suspenso',        ativo:true,  suspenderAcesso:true  },
  { diasAposVenc:30, canal:['email'],            assunto:'Contrato encerrado',          ativo:false, suspenderAcesso:false },
]

const fmt       = n   => 'R$ ' + Number(n||0).toLocaleString('pt-BR',{minimumFractionDigits:2})
const fmtPct    = n   => Number(n||0).toLocaleString('pt-BR',{minimumFractionDigits:1,maximumFractionDigits:1})+'%'
const fmtData   = iso => iso ? new Date(iso+'T12:00:00').toLocaleDateString('pt-BR') : '-'
const mesAtual  = ()  => new Date().toISOString().slice(0,7)
const fmtMesLbl = iso => { if(!iso)return'-'; const[y,m]=iso.split('-'); return['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'][Number(m)-1]+'/'+y }
const gerarSenha= (n=10)=>{ const c='ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789@#!'; return Array.from({length:n},()=>c[Math.floor(Math.random()*c.length)]).join('') }
const calcVenc  = (d=30)=>{ const x=new Date(); x.setDate(x.getDate()+d); return x.toISOString().slice(0,10) }
const uid       = ()  => Date.now().toString(36)+Math.random().toString(36).slice(2,6)
const getDias   = iso => iso&&new Date(iso)<new Date() ? Math.floor((new Date()-new Date(iso+'T12:00:00'))/86400000) : 0
const subst     = (tpl,vars)=> tpl.replace(/\{\{(\w+)\}\}/g,(_,k)=>vars[k]||'')

function toast(msg,tipo='ok'){
  const el=document.getElementById('vx-toast'); if(!el)return
  el.textContent=msg
  el.style.background=tipo==='ok'?'rgba(16,185,129,.95)':'rgba(239,68,68,.95)'
  el.style.opacity='1'; el.style.transform='translateY(0)'
  setTimeout(()=>{el.style.opacity='0';el.style.transform='translateY(20px)'},4000)
}

function exportarCSV(dados,nome){
  if(!dados.length)return
  const h=Object.keys(dados[0]).join(';')
  const r=dados.map(row=>Object.values(row).map(v=>'"'+String(v??'').replace(/"/g,'""')+'"').join(';')).join('\n')
  baixar(new Blob(['\uFEFF'+h+'\n'+r],{type:'text/csv;charset=utf-8;'}),nome+'.csv')
}
function exportarTXT(dados,nome){
  if(!dados.length)return
  const cols=Object.keys(dados[0])
  const ws=cols.map(c=>Math.max(c.length,...dados.map(r=>String(r[c]??'').length)))
  const sep=ws.map(w=>'─'.repeat(w+2)).join('┼')
  const hdr=cols.map((c,i)=>c.padEnd(ws[i])).join(' │ ')
  const rows=dados.map(r=>cols.map((c,i)=>String(r[c]??'').padEnd(ws[i])).join(' │ '))
  baixar(new Blob([[hdr,sep,...rows].join('\n')],{type:'text/plain;charset=utf-8;'}),nome+'.txt')
}
function exportarExcel(dados,nome){
  if(!dados.length)return
  const e=v=>String(v??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;')
  const cols=Object.keys(dados[0])
  const xml='<?xml version="1.0" encoding="UTF-8"?><?mso-application progid="Excel.Sheet"?><Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"><Worksheet ss:Name="Dados"><Table><Row>'+cols.map(c=>'<Cell><Data ss:Type="String">'+e(c)+'</Data></Cell>').join('')+'</Row>'+dados.map(r=>'<Row>'+cols.map(c=>'<Cell><Data ss:Type="String">'+e(r[c])+'</Data></Cell>').join('')+'</Row>').join('')+'</Table></Worksheet></Workbook>'
  baixar(new Blob([xml],{type:'application/vnd.ms-excel;charset=utf-8;'}),nome+'.xls')
}
function exportarPDF(id){
  const el=document.getElementById(id); if(!el)return
  const win=window.open('','_blank')
  win.document.write('<!DOCTYPE html><html><head><meta charset="UTF-8"><style>body{font-family:Arial,sans-serif;font-size:11px;color:#111;margin:20px}h1,h2{font-size:15px;margin-bottom:8px}h3{font-size:13px;margin:16px 0 8px}table{width:100%;border-collapse:collapse;margin:8px 0}th{background:#1a2540;color:#fff;padding:6px 10px;text-align:left;font-size:10px}td{padding:5px 10px;border-bottom:1px solid #e2e8f0;font-size:10px}tr:nth-child(even) td{background:#f8fafc}tfoot td{font-weight:700;background:#f1f5f9;border-top:2px solid #cbd5e1}@media print{body{margin:0}}</style></head><body>'+el.innerHTML+'</body></html>')
  win.document.close(); win.focus()
  setTimeout(()=>win.print(),600)
}
function baixar(blob,nome){
  const url=URL.createObjectURL(blob),a=document.createElement('a')
  a.href=url;a.download=nome;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)
}

function LoginMaster({onAuth}){
  const [tela,setTela]=useState('login') // 'login' | 'recuperar' | 'novaSenha'
  const [email,setEmail]=useState('')
  const [senha,setSenha]=useState('')
  const [novaSenha,setNovaSenha]=useState('')
  const [confSenha,setConfSenha]=useState('')
  const [erro,setErro]=useState('')
  const [msg,setMsg]=useState('')
  const [loading,setLoading]=useState(false)
  const [showSenha,setShowSenha]=useState(false)
  const [showNova,setShowNova]=useState(false)

  // Detecta token de recuperacao na URL (Supabase envia #access_token=...)
  useEffect(()=>{
    const hash=window.location.hash
    if(hash.includes('access_token')&&hash.includes('type=recovery')){
      setTela('novaSenha')
      // Supabase ja processou o token automaticamente via onAuthStateChange
    }
    // Limpa o hash da URL sem recarregar
    if(hash.includes('access_token')){
      window.history.replaceState(null,'',window.location.pathname)
    }
  },[])

  // Escuta evento PASSWORD_RECOVERY do Supabase
  useEffect(()=>{
    const {data:l}=supabaseAdmin.auth.onAuthStateChange((event,session)=>{
      if(event==='PASSWORD_RECOVERY'){
        setTela('novaSenha')
        setMsg('✅ Link validado! Defina sua nova senha abaixo.')
      }
    })
    return()=>l.subscription.unsubscribe()
  },[])

  async function entrar(e){
    e.preventDefault()
    if(!email||!senha){setErro('Preencha e-mail e senha.');return}
    setLoading(true);setErro('')
    try{
      const {data,error}=await supabaseAdmin.auth.signInWithPassword({email:email.trim(),password:senha})
      if(!error){
        if(MASTER_EMAILS.includes(data.user.email)){onAuth(data.user,{tipo:'master'},null);return}
        const {data:cfgRow}=await supabaseAdmin.from('vx_storage').select('value').eq('key','master_cfg').maybeSingle()
        const mc=cfgRow?.value?JSON.parse(cfgRow.value):{}
        const ua=(mc.adminUsuarios||[]).find(u=>u.email===email.trim()&&u.senha===senha&&u.ativo!==false)
        if(ua){await supabaseAdmin.auth.signOut();onAuth({email:data.user.email,id:data.user.id},{tipo:'admin',...ua},mc);return}
        await supabaseAdmin.auth.signOut();throw new Error('Sem permissao master.')
      }
      const {data:cfgRow}=await supabaseAdmin.from('vx_storage').select('value').eq('key','master_cfg').maybeSingle()
      const mc=cfgRow?.value?JSON.parse(cfgRow.value):{}
      const vend=(mc.vendedores||[]).find(v=>v.email===email.trim()&&v.senhaPortal===senha&&v.ativo!==false)
      if(vend){onAuth({email:vend.email,id:vend.id},{tipo:'vendedor',...vend},mc);return}
      const ua=(mc.adminUsuarios||[]).find(u=>u.email===email.trim()&&u.senha===senha&&u.ativo!==false)
      if(ua){onAuth({email:ua.email,id:ua.id},{tipo:'admin',...ua},mc);return}
      throw new Error('Usuario ou senha incorretos.')
    }catch(err){setErro(err.message||'Erro ao autenticar.')}
    setLoading(false)
  }

  async function recuperar(e){
    e.preventDefault()
    if(!email.trim()){setErro('Informe o e-mail cadastrado.');return}
    setLoading(true);setErro('');setMsg('')
    try{
      // Monta URL de redirect para esta mesma pagina /admin
      const redirectTo=window.location.origin+'/admin'
      const {error}=await supabaseAdmin.auth.resetPasswordForEmail(email.trim(),{redirectTo})
      if(error)throw new Error(error.message)
      setMsg('✅ Link de recuperacao enviado para '+email.trim()+'. Verifique sua caixa de entrada (e o spam).')
    }catch(err){setErro(err.message||'Erro ao enviar e-mail.')}
    setLoading(false)
  }

  async function salvarNovaSenha(e){
    e.preventDefault()
    if(!novaSenha||novaSenha.length<6){setErro('A senha deve ter pelo menos 6 caracteres.');return}
    if(novaSenha!==confSenha){setErro('As senhas nao coincidem.');return}
    setLoading(true);setErro('');setMsg('')
    try{
      const {error}=await supabaseAdmin.auth.updateUser({password:novaSenha})
      if(error)throw new Error(error.message)
      setMsg('✅ Senha alterada com sucesso! Redirecionando para o login...')
      setTimeout(()=>{setTela('login');setNovaSenha('');setConfSenha('');setMsg('')},2500)
    }catch(err){setErro(err.message||'Erro ao alterar senha.')}
    setLoading(false)
  }

  const inputStyle={width:'100%',background:'#111827',border:'1px solid #1e2d4a',borderRadius:8,padding:'10px 12px',color:'#e2e8f0',fontFamily:'DM Mono,monospace',fontSize:13,outline:'none'}

  return(
    <div style={{minHeight:'100vh',background:'#060c1a',display:'flex',alignItems:'center',justifyContent:'center',fontFamily:'DM Mono,monospace',padding:20}}>
      <div style={{width:'100%',maxWidth:400,background:'#0d1526',border:'1px solid #1e2d4a',borderRadius:16,padding:'36px 32px',boxShadow:'0 4px 32px rgba(0,0,0,.5)'}}>

        {/* Header */}
        <div style={{textAlign:'center',marginBottom:28}}>
          <div style={{fontSize:40,marginBottom:12}}>{tela==='novaSenha'?'🔑':'🛡️'}</div>
          <div style={{fontFamily:'Syne,sans-serif',fontWeight:800,fontSize:18,color:'#e2e8f0'}}>
            {tela==='login'?'MASTER ADMIN':tela==='recuperar'?'RECUPERAR SENHA':'NOVA SENHA'}
          </div>
          <div style={{fontSize:11,color:'#475569',marginTop:4,letterSpacing:1}}>VIVANEXA SaaS</div>
        </div>

        {/* TELA: LOGIN */}
        {tela==='login'&&(
          <form onSubmit={entrar}>
            <div style={{marginBottom:14}}>
              <label style={{fontSize:11,color:'#64748b',display:'block',marginBottom:5}}>E-MAIL</label>
              <input value={email} onChange={e=>setEmail(e.target.value)} type="email" placeholder="admin@vivanexa.com.br" style={inputStyle}/>
            </div>
            <div style={{marginBottom:6}}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:5}}>
                <label style={{fontSize:11,color:'#64748b'}}>SENHA</label>
                <button type="button" onClick={()=>setShowSenha(!showSenha)}
                  style={{background:'none',border:'none',color:'#475569',fontSize:11,cursor:'pointer',fontFamily:'DM Mono,monospace'}}>
                  {showSenha?'🙈 ocultar':'👁️ mostrar'}
                </button>
              </div>
              <input value={senha} onChange={e=>setSenha(e.target.value)} type={showSenha?'text':'password'} placeholder="••••••••" style={inputStyle}/>
            </div>
            <div style={{textAlign:'right',marginBottom:16}}>
              <button type="button" onClick={()=>{setTela('recuperar');setErro('');setMsg('')}}
                style={{background:'none',border:'none',color:'#475569',fontSize:11,cursor:'pointer',fontFamily:'DM Mono,monospace',textDecoration:'underline'}}>
                Esqueci minha senha
              </button>
            </div>
            {erro&&<div style={{fontSize:12,color:'#ef4444',marginBottom:12,padding:'8px 12px',background:'rgba(239,68,68,.08)',borderRadius:6,border:'1px solid rgba(239,68,68,.2)'}}>{erro}</div>}
            <button type="submit" disabled={loading} style={{width:'100%',padding:12,borderRadius:8,background:'linear-gradient(135deg,#00d4ff,#0099bb)',border:'none',color:'#000',fontFamily:'DM Mono,monospace',fontWeight:700,fontSize:14,cursor:loading?'not-allowed':'pointer',opacity:loading?.6:1}}>
              {loading?'Autenticando...':'🔐 Entrar'}
            </button>
          </form>
        )}

        {/* TELA: RECUPERAR SENHA */}
        {tela==='recuperar'&&(
          <form onSubmit={recuperar}>
            <p style={{fontSize:12,color:'#64748b',lineHeight:1.7,marginBottom:20}}>
              Informe o e-mail da conta master. Enviaremos um link para redefinir a senha. Funciona apenas para contas Supabase (e-mails master).
            </p>
            <div style={{marginBottom:16}}>
              <label style={{fontSize:11,color:'#64748b',display:'block',marginBottom:5}}>E-MAIL DA CONTA MASTER</label>
              <input value={email} onChange={e=>setEmail(e.target.value)} type="email" placeholder="admin@vivanexa.com.br" style={inputStyle}/>
            </div>
            {erro&&<div style={{fontSize:12,color:'#ef4444',marginBottom:12,padding:'8px 12px',background:'rgba(239,68,68,.08)',borderRadius:6,border:'1px solid rgba(239,68,68,.2)'}}>{erro}</div>}
            {msg&&<div style={{fontSize:12,color:'#10b981',marginBottom:12,padding:'10px 12px',background:'rgba(16,185,129,.08)',borderRadius:6,border:'1px solid rgba(16,185,129,.2)',lineHeight:1.6}}>{msg}</div>}
            {!msg&&(
              <button type="submit" disabled={loading} style={{width:'100%',padding:12,borderRadius:8,background:'linear-gradient(135deg,#7c3aed,#5b21b6)',border:'none',color:'#fff',fontFamily:'DM Mono,monospace',fontWeight:700,fontSize:14,cursor:loading?'not-allowed':'pointer',opacity:loading?.6:1}}>
                {loading?'Enviando...':'📧 Enviar link de recuperacao'}
              </button>
            )}
            <button type="button" onClick={()=>{setTela('login');setErro('');setMsg('')}}
              style={{width:'100%',marginTop:10,padding:'10px',borderRadius:8,background:'transparent',border:'1px solid #1e2d4a',color:'#64748b',fontFamily:'DM Mono,monospace',fontSize:13,cursor:'pointer'}}>
              ← Voltar ao login
            </button>
          </form>
        )}

        {/* TELA: DEFINIR NOVA SENHA (chegou pelo link do email) */}
        {tela==='novaSenha'&&(
          <form onSubmit={salvarNovaSenha}>
            <p style={{fontSize:12,color:'#64748b',lineHeight:1.7,marginBottom:20}}>
              Defina sua nova senha. Ela deve ter pelo menos 6 caracteres.
            </p>
            {msg&&<div style={{fontSize:12,color:'#10b981',marginBottom:12,padding:'10px 12px',background:'rgba(16,185,129,.08)',borderRadius:6,border:'1px solid rgba(16,185,129,.2)',lineHeight:1.6}}>{msg}</div>}
            <div style={{marginBottom:14}}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:5}}>
                <label style={{fontSize:11,color:'#64748b'}}>NOVA SENHA</label>
                <button type="button" onClick={()=>setShowNova(!showNova)}
                  style={{background:'none',border:'none',color:'#475569',fontSize:11,cursor:'pointer',fontFamily:'DM Mono,monospace'}}>
                  {showNova?'🙈 ocultar':'👁️ mostrar'}
                </button>
              </div>
              <input value={novaSenha} onChange={e=>setNovaSenha(e.target.value)} type={showNova?'text':'password'} placeholder="Min. 6 caracteres" style={inputStyle}/>
            </div>
            <div style={{marginBottom:16}}>
              <label style={{fontSize:11,color:'#64748b',display:'block',marginBottom:5}}>CONFIRMAR NOVA SENHA</label>
              <input value={confSenha} onChange={e=>setConfSenha(e.target.value)} type={showNova?'text':'password'} placeholder="Repita a senha" style={inputStyle}/>
            </div>
            {/* Indicador de forca da senha */}
            {novaSenha&&(
              <div style={{marginBottom:14}}>
                <div style={{fontSize:10,color:'#64748b',marginBottom:4}}>FORCA DA SENHA</div>
                <div style={{background:'#1a2540',borderRadius:4,height:4,overflow:'hidden'}}>
                  <div style={{
                    height:'100%',borderRadius:4,transition:'width .3s',
                    width:novaSenha.length>=12&&/[A-Z]/.test(novaSenha)&&/[0-9]/.test(novaSenha)&&/[^A-Za-z0-9]/.test(novaSenha)?'100%':
                          novaSenha.length>=8&&(/[A-Z]/.test(novaSenha)||/[0-9]/.test(novaSenha))?'66%':
                          novaSenha.length>=6?'33%':'10%',
                    background:novaSenha.length>=12&&/[A-Z]/.test(novaSenha)&&/[0-9]/.test(novaSenha)?'#10b981':
                               novaSenha.length>=8?'#f59e0b':'#ef4444'
                  }}/>
                </div>
                <div style={{fontSize:10,color:'#475569',marginTop:4}}>
                  {novaSenha.length>=12&&/[A-Z]/.test(novaSenha)&&/[0-9]/.test(novaSenha)&&/[^A-Za-z0-9]/.test(novaSenha)?'🟢 Forte':
                   novaSenha.length>=8?'🟡 Media':'🔴 Fraca — use pelo menos 6 caracteres'}
                </div>
              </div>
            )}
            {confSenha&&novaSenha!==confSenha&&(
              <div style={{fontSize:11,color:'#ef4444',marginBottom:10}}>⚠️ As senhas nao coincidem.</div>
            )}
            {confSenha&&novaSenha===confSenha&&novaSenha.length>=6&&(
              <div style={{fontSize:11,color:'#10b981',marginBottom:10}}>✅ Senhas coincidem.</div>
            )}
            {erro&&<div style={{fontSize:12,color:'#ef4444',marginBottom:12,padding:'8px 12px',background:'rgba(239,68,68,.08)',borderRadius:6,border:'1px solid rgba(239,68,68,.2)'}}>{erro}</div>}
            <button type="submit" disabled={loading||novaSenha!==confSenha||novaSenha.length<6}
              style={{width:'100%',padding:12,borderRadius:8,background:'linear-gradient(135deg,#10b981,#059669)',border:'none',color:'#fff',fontFamily:'DM Mono,monospace',fontWeight:700,fontSize:14,cursor:(loading||novaSenha!==confSenha||novaSenha.length<6)?'not-allowed':'pointer',opacity:(novaSenha!==confSenha||novaSenha.length<6)?.5:1}}>
              {loading?'Salvando...':'✅ Salvar Nova Senha'}
            </button>
            <button type="button" onClick={()=>{setTela('login');setErro('');setMsg('');setNovaSenha('');setConfSenha('')}}
              style={{width:'100%',marginTop:10,padding:'10px',borderRadius:8,background:'transparent',border:'1px solid #1e2d4a',color:'#64748b',fontFamily:'DM Mono,monospace',fontSize:13,cursor:'pointer'}}>
              ← Voltar ao login
            </button>
          </form>
        )}

        <div style={{marginTop:20,fontSize:11,color:'#1e2d4a',textAlign:'center'}}>Sessao isolada — nao afeta o sistema principal.</div>
      </div>
    </div>
  )
}

export default function AdminPage(){
  const [masterUser,setMasterUser]=useState(null)
  const [usuarioLogado,setUsuarioLogado]=useState(null)
  const [masterCfg,setMasterCfg]=useState({})
  const [tenants,setTenants]=useState([])
  const [vendedores,setVendedores]=useState([])
  const [planos,setPlanos]=useState(PLANOS_PADRAO)
  const [aba,setAba]=useState('tenants')
  const [busca,setBusca]=useState('')
  const [filtroStatus,setFiltroStatus]=useState('')
  const [filtroPlano,setFiltroPlano]=useState('')
  const [modalTenant,setModalTenant]=useState(null)
  const [modalDelete,setModalDelete]=useState(null)
  const [saving,setSaving]=useState(false)
  const [checking,setChecking]=useState(true)

  useEffect(()=>{
    supabaseAdmin.auth.getSession().then(async({data:{session}})=>{
      if(session&&MASTER_EMAILS.includes(session.user.email)){
        const mc=await carregarMasterCfg()
        setMasterUser(session.user);setUsuarioLogado({tipo:'master'})
        setVendedores(mc.vendedores||[])
        if(mc.planosPersonalizados?.length)setPlanos(mc.planosPersonalizados)
        await carregarTenants()
      }
      setChecking(false)
    })
    const{data:l}=supabaseAdmin.auth.onAuthStateChange((ev)=>{
      if(ev==='SIGNED_OUT'){setMasterUser(null);setUsuarioLogado(null)}
    })
    return()=>l.subscription.unsubscribe()
  },[])

  async function carregarMasterCfg(){
    const{data:r}=await supabaseAdmin.from('vx_storage').select('value').eq('key','master_cfg').maybeSingle()
    const mc=r?.value?JSON.parse(r.value):{}
    setMasterCfg(mc);return mc
  }

  const carregarTenants=useCallback(async()=>{
    const{data:rows}=await supabaseAdmin.from('vx_storage').select('key,value,updated_at').like('key','tenant:%').order('updated_at',{ascending:false})
    const lista=(rows||[]).map(r=>{try{return{...JSON.parse(r.value),_at:r.updated_at}}catch{return null}}).filter(Boolean)
    setTenants(lista);return lista
  },[])

  async function onAuth(user,perfil,mc){
    const cfg=mc||await carregarMasterCfg()
    setVendedores(cfg.vendedores||[])
    if(cfg.planosPersonalizados?.length)setPlanos(cfg.planosPersonalizados)
    await carregarTenants()
    setMasterUser(user);setUsuarioLogado(perfil)
    if(perfil.tipo==='vendedor')setAba('relvendas')
    else if(perfil.tipo==='admin')setAba(perfil.abasPermitidas?.[0]||'tenants')
    else setAba('tenants')
  }

  async function sair(){await supabaseAdmin.auth.signOut();setMasterUser(null);setUsuarioLogado(null)}

  async function salvarMasterCfg(novoCfg){
    const cfg={...masterCfg,...novoCfg}
    setMasterCfg(cfg)
    await supabaseAdmin.from('vx_storage').upsert({key:'master_cfg',value:JSON.stringify(cfg),updated_at:new Date().toISOString()},{onConflict:'key'})
    toast('✅ Configuracoes salvas!');return cfg
  }

  async function cadastrarTenant(dados){
    setSaving(true)
    try{
      const res=await fetch('/api/cadastrar-tenant',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...dados,masterCfg})})
      const result=await res.json()
      if(!res.ok)throw new Error(result.error||'Erro ao cadastrar')
      toast('✅ Cliente cadastrado!');await carregarTenants();setModalTenant(null)
    }catch(err){toast('❌ '+err.message,'erro')}
    finally{setSaving(false)}
  }

  async function atualizarTenant(dados){
    setSaving(true)
    try{
      const agora=new Date().toISOString()
      await supabaseAdmin.from('vx_storage').upsert({key:'tenant:'+dados.id,value:JSON.stringify({...dados,atualizadoEm:agora}),updated_at:agora},{onConflict:'key'})
      const{data:cr}=await supabaseAdmin.from('vx_storage').select('value').eq('key','cfg:'+(dados.empresaId||dados.id)).maybeSingle()
      const ca=cr?.value?JSON.parse(cr.value):{}
      await supabaseAdmin.from('vx_storage').upsert({key:'cfg:'+(dados.empresaId||dados.id),value:JSON.stringify({...ca,company:dados.nomeEmpresa,tenant_plano:dados.plano,tenant_status:dados.status,tenant_modulos:dados.modulosLiberados,tenant_maxUsuarios:dados.maxUsuarios,tenant_vencimento:dados.vencimento,modulosAtivos:dados.modulosLiberados}),updated_at:agora},{onConflict:'key'})
      toast('✅ Atualizado!');await carregarTenants();setModalTenant(null)
    }catch(err){toast('❌ '+err.message,'erro')}
    finally{setSaving(false)}
  }

  async function deletarTenant(id){
    setSaving(true)
    await supabaseAdmin.from('vx_storage').delete().eq('key','tenant:'+id)
    toast('🗑️ Removido.');await carregarTenants();setModalDelete(null);setSaving(false)
  }

  const tenantsFiltrados=tenants.filter(t=>{
    const ok1=!busca||[t.nomeEmpresa,t.emailAdmin,t.cnpj,t.responsavel].some(v=>v?.toLowerCase().includes(busca.toLowerCase()))
    const ok2=!filtroStatus||t.status===filtroStatus
    const ok3=!filtroPlano||t.plano===filtroPlano
    return ok1&&ok2&&ok3
  })

  const stats={
    total:tenants.length,ativos:tenants.filter(t=>t.status==='ativo').length,
    trial:tenants.filter(t=>t.status==='trial').length,suspensos:tenants.filter(t=>t.status==='suspenso').length,
    mrr:tenants.filter(t=>t.status==='ativo').reduce((a,t)=>a+Number(t.mensalidade||0),0),
  }

  const abasVisiveis=!usuarioLogado?[]:
    usuarioLogado.tipo==='master'?TODAS_ABAS:
    usuarioLogado.tipo==='vendedor'?TODAS_ABAS.filter(a=>['relvendas','comissoes'].includes(a.id)):
    TODAS_ABAS.filter(a=>(usuarioLogado.abasPermitidas||[]).includes(a.id))

  const tenantsVend=usuarioLogado?.tipo==='vendedor'?tenants.filter(t=>t.vendedorId===usuarioLogado.id):tenants

  if(checking)return<div style={{minHeight:'100vh',background:'#060c1a',display:'flex',alignItems:'center',justifyContent:'center',fontFamily:'DM Mono,monospace',color:'#64748b'}}><div style={{textAlign:'center'}}><div style={{fontSize:40,marginBottom:12}}>🛡️</div>Verificando...</div></div>
  if(!masterUser)return<LoginMaster onAuth={onAuth}/>

  return(
    <>
      <Head>
        <title>Vivanexa — Master Admin</title>
        <link href="https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=DM+Mono:wght@300;400;500&display=swap" rel="stylesheet"/>
      </Head>
      <style>{CSS}</style>
      <div id="vx-toast" className="toast"/>
      <div className="admin-wrap">
        <aside className="admin-sidebar">
          <div className="sidebar-logo">
            <span style={{fontSize:22}}>🛡️</span>
            <div>
              <div style={{fontFamily:'Syne,sans-serif',fontWeight:800,fontSize:14,color:'#e2e8f0'}}>{usuarioLogado?.tipo==='vendedor'?'PORTAL':'MASTER'}</div>
              <div style={{fontSize:10,color:'#64748b',letterSpacing:1}}>{usuarioLogado?.tipo==='vendedor'?'VENDEDOR':'ADMIN'}</div>
            </div>
          </div>
          <nav className="sidebar-nav">
            {abasVisiveis.map(item=>(
              <button key={item.id} className={'nav-btn '+(aba===item.id?'active':'')} onClick={()=>setAba(item.id)}>
                <span>{item.icon}</span><span>{item.label}</span>
              </button>
            ))}
          </nav>
          <div className="sidebar-user">
            <div style={{fontSize:11,color:'#475569'}}>{usuarioLogado?.tipo==='master'?'Master Admin':usuarioLogado?.tipo==='vendedor'?'👔 Vendedor':'👤 Admin'}</div>
            <div style={{fontSize:11,color:'#94a3b8',marginTop:3,wordBreak:'break-all'}}>{masterUser?.email}</div>
            <button className="btn-sair" onClick={sair}>Sair</button>
          </div>
        </aside>
        <main className="admin-main">
          {aba==='tenants'&&<AbaClientes tenants={tenantsFiltrados} planos={planos} vendedores={vendedores} stats={stats} busca={busca} setBusca={setBusca} filtroStatus={filtroStatus} setFiltroStatus={setFiltroStatus} filtroPlano={filtroPlano} setFiltroPlano={setFiltroPlano} masterCfg={masterCfg} onNovo={()=>setModalTenant('novo')} onEditar={t=>setModalTenant(t)} onDeletar={t=>setModalDelete(t)} onAtualizarStatus={(t,s)=>atualizarTenant({...t,status:s})} onAtualizarPagto={t=>atualizarTenant(t)}/>}
          {aba==='vendedores'&&<GerenciarVendedores vendedores={vendedores} onSave={async l=>{setVendedores(l);await salvarMasterCfg({vendedores:l})}}/>}
          {aba==='usuarios'&&<GerenciarUsuariosAdmin masterCfg={masterCfg} onSave={async l=>await salvarMasterCfg({adminUsuarios:l})}/>}
          {aba==='planos'&&<GerenciarPlanos planos={planos} setPlanos={setPlanos} onSave={p=>{setPlanos(p);salvarMasterCfg({planosPersonalizados:p})}}/>}
          {aba==='financeiro'&&<AbaFinanceiro tenants={tenants} planos={planos} stats={stats} masterCfg={masterCfg} onAtualizarPagto={t=>atualizarTenant(t)}/>}
          {aba==='relvendas'&&<RelatorioVendas tenants={tenantsVend} vendedores={vendedores} planos={planos} masterCfg={masterCfg} usuarioLogado={usuarioLogado} onAtualizarPagto={t=>atualizarTenant(t)}/>}
          {aba==='comissoes'&&<RelatorioComissoes tenants={tenantsVend} vendedores={vendedores} planos={planos} usuarioLogado={usuarioLogado}/>}
          {aba==='metricas'&&<AbaMetricas tenants={tenants} planos={planos} stats={stats}/>}
          {aba==='config'&&<ConfigMaster masterCfg={masterCfg} onSave={salvarMasterCfg}/>}
        </main>
      </div>
      {modalTenant&&<ModalTenant tenant={modalTenant==='novo'?null:modalTenant} planos={planos} vendedores={vendedores} masterCfg={masterCfg} onSave={d=>d.id?atualizarTenant(d):cadastrarTenant(d)} onClose={()=>setModalTenant(null)} saving={saving}/>}
      {modalDelete&&(
        <div className="modal-overlay" onClick={()=>setModalDelete(null)}>
          <div className="modal-box" style={{maxWidth:420}} onClick={e=>e.stopPropagation()}>
            <h2 style={{fontFamily:'Syne,sans-serif',color:'#ef4444',fontSize:18,marginBottom:12}}>🗑️ Confirmar Exclusao</h2>
            <p style={{color:'#94a3b8',fontSize:13,lineHeight:1.6}}>Excluir <strong style={{color:'#e2e8f0'}}>{modalDelete.nomeEmpresa}</strong>? Acao irreversivel.</p>
            <div style={{display:'flex',gap:10,marginTop:24,justifyContent:'flex-end'}}>
              <button className="btn-secondary" onClick={()=>setModalDelete(null)}>Cancelar</button>
              <button className="btn-danger" disabled={saving} onClick={()=>deletarTenant(modalDelete.id)}>{saving?'Excluindo...':'Sim, excluir'}</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

// ══════════ ABA CLIENTES ══════════
function AbaClientes({tenants,planos,vendedores,stats,busca,setBusca,filtroStatus,setFiltroStatus,filtroPlano,setFiltroPlano,masterCfg,onNovo,onEditar,onDeletar,onAtualizarStatus,onAtualizarPagto}){
  const [modalCob,setModalCob]=useState(null)
  return(
    <>
      <div className="page-header">
        <div><h1 className="page-title">Clientes / Tenants</h1><p className="page-sub">Gerencie todos os clientes da plataforma</p></div>
        <button className="btn-primary" onClick={onNovo}>+ Novo Cliente</button>
      </div>
      <div className="stats-grid">
        {[{label:'Total',valor:stats.total,icon:'🏢',cor:'#00d4ff'},{label:'Ativos',valor:stats.ativos,icon:'✅',cor:'#10b981'},{label:'Trial',valor:stats.trial,icon:'⏳',cor:'#f59e0b'},{label:'Suspensos',valor:stats.suspensos,icon:'🚫',cor:'#ef4444'},{label:'MRR',valor:fmt(stats.mrr),icon:'💰',cor:'#7c3aed'},{label:'ARR',valor:fmt(stats.mrr*12),icon:'📈',cor:'#ec4899'}].map((s,i)=>(
          <div key={i} className="stat-card" style={{'--cor':s.cor}}><div className="stat-icon">{s.icon}</div><div className="stat-val" style={{color:s.cor}}>{s.valor}</div><div className="stat-label">{s.label}</div></div>
        ))}
      </div>
      <div className="filtros-bar">
        <input className="input-busca" placeholder="🔍 Empresa, e-mail, CNPJ..." value={busca} onChange={e=>setBusca(e.target.value)}/>
        <select className="select-filtro" value={filtroStatus} onChange={e=>setFiltroStatus(e.target.value)}>
          <option value="">Todos os status</option>{STATUS_TENANT.map(s=><option key={s.id} value={s.id}>{s.label}</option>)}
        </select>
        <select className="select-filtro" value={filtroPlano} onChange={e=>setFiltroPlano(e.target.value)}>
          <option value="">Todos os planos</option>{planos.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <span style={{fontSize:12,color:'#475569',marginLeft:'auto'}}>{tenants.length} resultado(s)</span>
      </div>
      <div className="table-wrap">
        <table className="admin-table">
          <thead><tr><th>Empresa</th><th>Vendedor</th><th>Plano</th><th>Status</th><th>Mensalidade</th><th>Vencimento</th><th>Pagamento</th><th>Acoes</th></tr></thead>
          <tbody>
            {tenants.length===0
              ?<tr><td colSpan={8} style={{textAlign:'center',color:'#475569',padding:'40px'}}>Nenhum cliente encontrado.</td></tr>
              :tenants.map(t=>{
                const plano=planos.find(p=>p.id===t.plano)
                const status=STATUS_TENANT.find(s=>s.id===t.status)
                const dias=getDias(t.vencimento)
                const vend=vendedores.find(v=>v.id===t.vendedorId)
                const pagto=t.pagamentoStatus||'pendente'
                const pCor={pago:'#10b981',pendente:'#f59e0b',atrasado:'#ef4444'}[pagto]||'#64748b'
                return(
                  <tr key={t.id} className="table-row">
                    <td><div style={{fontWeight:600,color:'#e2e8f0',fontSize:13}}>{t.nomeEmpresa}</div><div style={{fontSize:11,color:'#475569'}}>{t.emailAdmin}</div>{t.cnpj&&<div style={{fontSize:10,color:'#334155'}}>{t.cnpj}</div>}</td>
                    <td style={{fontSize:12,color:'#94a3b8'}}>{vend?.nome||'-'}</td>
                    <td><span className="badge" style={{background:plano?.cor+'22',color:plano?.cor,border:'1px solid '+plano?.cor+'44'}}>{plano?.name||t.plano}</span></td>
                    <td><span className="badge" style={{background:status?.cor+'22',color:status?.cor,border:'1px solid '+status?.cor+'44'}}>{status?.label}</span></td>
                    <td style={{color:'#10b981',fontWeight:600,fontSize:13}}>{t.mensalidade?fmt(t.mensalidade):'-'}</td>
                    <td style={{fontSize:12,color:dias>0?'#ef4444':'#94a3b8'}}>{fmtData(t.vencimento)}{dias>0&&<div style={{fontSize:10,color:'#ef4444'}}>⚠️ {dias}d atraso</div>}</td>
                    <td>
                      <select value={pagto} onChange={async e=>onAtualizarPagto({...t,pagamentoStatus:e.target.value})}
                        style={{background:pCor+'22',border:'1px solid '+pCor+'66',borderRadius:6,color:pCor,fontSize:11,padding:'3px 8px',fontFamily:'DM Mono,monospace',cursor:'pointer',outline:'none'}}>
                        <option value="pago">✅ Pago</option>
                        <option value="pendente">⏳ Pendente</option>
                        <option value="atrasado">⚠️ Atrasado</option>
                      </select>
                    </td>
                    <td><div style={{display:'flex',gap:4}}>
                      <button className="btn-icon" title="Editar" onClick={()=>onEditar(t)}>✏️</button>
                      <button className="btn-icon" title="Cobrar" onClick={()=>setModalCob(t)} style={{background:'rgba(124,58,237,.15)',borderColor:'rgba(124,58,237,.4)'}}>💳</button>
                      {t.status==='ativo'?<button className="btn-icon" title="Suspender" onClick={()=>onAtualizarStatus(t,'suspenso')}>🚫</button>:<button className="btn-icon" title="Reativar" onClick={()=>onAtualizarStatus(t,'ativo')}>✅</button>}
                      <button className="btn-icon danger" title="Excluir" onClick={()=>onDeletar(t)}>🗑️</button>
                    </div></td>
                  </tr>
                )
              })
            }
          </tbody>
        </table>
      </div>
      {modalCob&&<ModalCobranca tenant={modalCob} masterCfg={masterCfg} onClose={()=>setModalCob(null)} onPago={async()=>{await onAtualizarPagto({...modalCob,pagamentoStatus:'pago'});setModalCob(null)}}/>}
    </>
  )
}

// ══════════ MODAL COBRANCA ══════════
function ModalCobranca({tenant,masterCfg,onClose,onPago}){
  const [tipo,setTipo]=useState('email')
  const [enviando,setEnviando]=useState(false)
  const [resultado,setResultado]=useState(null)
  const [linkExtra,setLinkExtra]=useState(masterCfg?.linkPagamento||'')
  const temAsaas=!!masterCfg?.asaasKey
  const dias=getDias(tenant.vencimento)

  async function emitir(){
    setEnviando(true);setResultado(null)
    try{
      if(tipo==='email'){
        const siteUrl=masterCfg?.siteUrl||''
        const tpl=masterCfg?.emailTemplates?.cobranca||TPL_COB_EMAIL
        const vars={nomeEmpresa:tenant.nomeEmpresa,responsavel:tenant.responsavel||tenant.nomeEmpresa,mensalidade:fmt(tenant.mensalidade),adesao:fmt(tenant.adesao),vencimento:fmtData(tenant.vencimento),linkPagamento:linkExtra||masterCfg?.linkPagamento||siteUrl,siteUrl}
        const html=subst(tpl,vars)
        const res=await fetch('/api/send-email',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({to:tenant.emailAdmin,subject:'💳 Cobranca — '+tenant.nomeEmpresa+' — '+fmt(tenant.mensalidade),html,config:{smtpHost:masterCfg?.smtpHost,smtpPort:masterCfg?.smtpPort,smtpUser:masterCfg?.smtpUser,smtpPass:masterCfg?.smtpPass,emailApiKey:masterCfg?.emailApiKey,emailRemetente:masterCfg?.smtpFrom||masterCfg?.smtpUser,nomeRemetente:'Vivanexa'}})})
        const b=await res.json()
        setResultado({ok:b.success,msg:b.success?'✅ E-mail de cobranca enviado!':'❌ '+b.error})
      } else if(tipo.startsWith('asaas_')){
        if(!tenant.asaasCustomerId){setResultado({ok:false,msg:'❌ Cliente sem Asaas ID. Edite e cadastre no Asaas.'});setEnviando(false);return}
        const bt=tipo==='asaas_boleto'?'BOLETO':tipo==='asaas_pix'?'PIX':'CREDIT_CARD'
        const dd=new Date();dd.setDate(dd.getDate()+3)
        const base=masterCfg.asaasSandbox?'https://sandbox.asaas.com/api/v3':'https://api.asaas.com/v3'
        const res=await fetch(base+'/payments',{method:'POST',headers:{'Content-Type':'application/json','access_token':masterCfg.asaasKey},body:JSON.stringify({customer:tenant.asaasCustomerId,billingType:bt,value:Number(tenant.mensalidade||0),dueDate:dd.toISOString().slice(0,10),description:'Mensalidade '+tenant.nomeEmpresa,externalReference:tenant.id})})
        const b=await res.json()
        if(res.ok){const link=b.bankSlipUrl||b.invoiceUrl||b.transactionReceiptUrl||'';setResultado({ok:true,msg:'✅ Cobranca criada no Asaas!',link})}
        else{setResultado({ok:false,msg:'❌ Asaas: '+(b.errors?.[0]?.description||JSON.stringify(b))})}
      } else if(tipo==='link'){
        await navigator.clipboard.writeText(linkExtra)
        setResultado({ok:true,msg:'✅ Link copiado!'})
      }
    }catch(e){setResultado({ok:false,msg:'❌ '+e.message})}
    setEnviando(false)
  }

  const OPCOES=[
    {id:'email',lbl:'📧 E-mail de cobranca',desc:'Envia e-mail ao cliente com o valor em aberto'},
    ...(temAsaas?[{id:'asaas_boleto',lbl:'🏦 Boleto (Asaas)',desc:'Gera boleto bancario'},{id:'asaas_pix',lbl:'⚡ PIX (Asaas)',desc:'Gera cobranca PIX'},{id:'asaas_card',lbl:'💳 Cartao (Asaas)',desc:'Link de pagamento cartao'}]:[]),
    {id:'link',lbl:'🔗 Link de pagamento',desc:'Copia link personalizado'},
  ]

  return(
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" style={{maxWidth:520}} onClick={e=>e.stopPropagation()}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:20}}>
          <h2 style={{fontFamily:'Syne,sans-serif',fontSize:17,color:'#7c3aed'}}>💳 Emitir Cobranca</h2>
          <button onClick={onClose} style={{background:'none',border:'none',color:'#64748b',fontSize:20,cursor:'pointer'}}>✕</button>
        </div>
        <div style={{padding:'12px 16px',background:'#0d1526',borderRadius:10,border:'1px solid #1e2d4a',marginBottom:20}}>
          <div style={{fontWeight:700,color:'#e2e8f0',fontSize:14}}>{tenant.nomeEmpresa}</div>
          <div style={{fontSize:12,color:'#64748b',marginTop:4}}>{tenant.emailAdmin}</div>
          <div style={{display:'flex',gap:20,marginTop:10,flexWrap:'wrap'}}>
            <div><div style={{fontSize:10,color:'#475569'}}>MENSALIDADE</div><div style={{color:'#10b981',fontWeight:700,fontSize:15}}>{fmt(tenant.mensalidade)}</div></div>
            {Number(tenant.adesao)>0&&<div><div style={{fontSize:10,color:'#475569'}}>ADESAO</div><div style={{color:'#00d4ff',fontWeight:700,fontSize:15}}>{fmt(tenant.adesao)}</div></div>}
            <div><div style={{fontSize:10,color:'#475569'}}>VENCIMENTO</div><div style={{color:dias>0?'#ef4444':'#94a3b8',fontWeight:600,fontSize:13}}>{fmtData(tenant.vencimento)}{dias>0&&' ('+dias+'d atraso)'}</div></div>
          </div>
        </div>
        <div style={{marginBottom:16}}>
          <label style={{fontSize:11,color:'#64748b',display:'block',marginBottom:10,letterSpacing:.5}}>FORMA DE COBRANCA</label>
          <div style={{display:'flex',flexDirection:'column',gap:8}}>
            {OPCOES.map(op=>(
              <div key={op.id} onClick={()=>setTipo(op.id)} style={{display:'flex',alignItems:'center',gap:12,padding:'10px 14px',borderRadius:8,border:'1px solid '+(tipo===op.id?'#7c3aed44':'#1e2d4a'),background:tipo===op.id?'rgba(124,58,237,.08)':'#111827',cursor:'pointer'}}>
                <div style={{width:16,height:16,borderRadius:'50%',border:'2px solid '+(tipo===op.id?'#7c3aed':'#334155'),background:tipo===op.id?'#7c3aed':'transparent',flexShrink:0}}/>
                <div>
                  <div style={{fontSize:13,color:tipo===op.id?'#e2e8f0':'#64748b',fontWeight:tipo===op.id?600:400}}>{op.lbl}</div>
                  <div style={{fontSize:11,color:'#475569',marginTop:2}}>{op.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
        {(tipo==='link'||tipo==='email')&&(
          <div className="field" style={{marginBottom:16}}>
            <label>Link de pagamento (opcional)</label>
            <input value={linkExtra} onChange={e=>setLinkExtra(e.target.value)} placeholder="https://seu-checkout.com/pagar"/>
          </div>
        )}
        {resultado&&(
          <div style={{padding:'12px 16px',borderRadius:8,background:resultado.ok?'rgba(16,185,129,.1)':'rgba(239,68,68,.1)',border:'1px solid '+(resultado.ok?'rgba(16,185,129,.3)':'rgba(239,68,68,.3)'),marginBottom:16}}>
            <div style={{fontSize:13,color:resultado.ok?'#10b981':'#ef4444',fontWeight:600}}>{resultado.msg}</div>
            {resultado.link&&<a href={resultado.link} target="_blank" rel="noreferrer" style={{fontSize:12,color:'#00d4ff',display:'block',marginTop:6,wordBreak:'break-all'}}>{resultado.link}</a>}
          </div>
        )}
        <div style={{display:'flex',gap:10,justifyContent:'flex-end',paddingTop:16,borderTop:'1px solid #1e2d4a'}}>
          {resultado?.ok&&<button className="btn-secondary" onClick={onPago} style={{color:'#10b981',borderColor:'#10b98144'}}>✅ Marcar como Pago</button>}
          <button className="btn-secondary" onClick={onClose}>Fechar</button>
          <button className="btn-primary" disabled={enviando} onClick={emitir} style={{background:'linear-gradient(135deg,#7c3aed,#5b21b6)'}}>
            {enviando?'Processando...':'🚀 Emitir Cobranca'}
          </button>
        </div>
      </div>
    </div>
  )
}

const TPL_COB_EMAIL='<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;border:1px solid #e2e8f0"><div style="background:linear-gradient(135deg,#0d1526,#1a2540);padding:32px;text-align:center"><h1 style="color:#00d4ff;font-size:22px;margin:0">Vivanexa</h1></div><div style="padding:32px"><h2 style="color:#1a202c;font-size:18px;margin:0 0 16px">💳 Cobranca</h2><p style="color:#475569;font-size:14px;line-height:1.7">Ola, <strong>{{responsavel}}</strong>!</p><p style="color:#475569;font-size:14px;line-height:1.7">Segue cobranca da <strong>{{nomeEmpresa}}</strong> no valor de <strong>{{mensalidade}}</strong>.</p><div style="background:#f8fafc;border-radius:8px;padding:16px;margin:20px 0;border:1px solid #e2e8f0"><table style="width:100%;font-size:13px;color:#475569"><tr><td>Empresa:</td><td style="font-weight:700;color:#1a202c">{{nomeEmpresa}}</td></tr><tr><td>Valor:</td><td style="font-weight:700;color:#10b981">{{mensalidade}}</td></tr><tr><td>Vencimento:</td><td style="font-weight:700">{{vencimento}}</td></tr></table></div><div style="text-align:center;margin:28px 0"><a href="{{linkPagamento}}" style="display:inline-block;padding:14px 32px;background:linear-gradient(135deg,#00d4ff,#0099bb);color:#000;text-decoration:none;border-radius:8px;font-weight:700;font-size:14px">💳 Realizar Pagamento</a></div></div><div style="background:#f8fafc;padding:16px;text-align:center;font-size:11px;color:#94a3b8">Vivanexa SaaS</div></div>'

// ══════════ GERENCIAR VENDEDORES ══════════
function GerenciarVendedores({vendedores,onSave}){
  const [lista,setLista]=useState(vendedores)
  const [modal,setModal]=useState(null)
  const [saving,setSaving]=useState(false)
  useEffect(()=>setLista(vendedores),[vendedores])
  const vazio={nome:'',email:'',tel:'',ativo:true,senhaPortal:'',comissaoAdesao:'',comissaoMensal:'',recorrenciaMeses:'0',metaAdesao:'',metaMensal:''}
  const [form,setForm]=useState(vazio)
  const upd=(k,v)=>setForm(f=>({...f,[k]:v}))
  async function salvar(){
    if(!form.nome.trim()||!form.email.trim()){alert('Nome e e-mail obrigatorios.');return}
    setSaving(true)
    const nl=modal==='novo'?[...lista,{...form,id:uid(),criadoEm:new Date().toISOString()}]:lista.map(v=>v.id===modal.id?{...v,...form}:v)
    setLista(nl);await onSave(nl);setModal(null);setSaving(false)
  }
  async function remover(id){
    if(!confirm('Remover vendedor?'))return
    const nl=lista.filter(v=>v.id!==id);setLista(nl);await onSave(nl)
  }
  return(
    <div>
      <div className="page-header">
        <div><h1 className="page-title">Vendedores</h1><p className="page-sub">Equipe interna — comissoes, metas e portal</p></div>
        <button className="btn-primary" onClick={()=>{setForm(vazio);setModal('novo')}}>+ Novo Vendedor</button>
      </div>
      <div className="table-wrap">
        <table className="admin-table">
          <thead><tr><th>Nome</th><th>E-mail</th><th>% Adesao</th><th>% Mensal</th><th>Recorrencia</th><th>Meta Adesao</th><th>Meta Mensal</th><th>Portal</th><th>Status</th><th>Acoes</th></tr></thead>
          <tbody>
            {lista.length===0?<tr><td colSpan={10} style={{textAlign:'center',color:'#475569',padding:'40px'}}>Nenhum vendedor cadastrado.</td></tr>
            :lista.map(v=>(
              <tr key={v.id} className="table-row">
                <td style={{fontWeight:600,color:'#e2e8f0',fontSize:13}}>{v.nome}</td>
                <td style={{fontSize:12,color:'#94a3b8'}}>{v.email}</td>
                <td style={{color:'#00d4ff',fontWeight:600,fontSize:13}}>{v.comissaoAdesao?fmtPct(v.comissaoAdesao):'-'}</td>
                <td style={{color:'#7c3aed',fontWeight:600,fontSize:13}}>{v.comissaoMensal?fmtPct(v.comissaoMensal):'-'}</td>
                <td style={{fontSize:12,color:'#94a3b8'}}>{Number(v.recorrenciaMeses||0)===0?'♾️ Indefinida':v.recorrenciaMeses+' mes(es)'}</td>
                <td style={{fontSize:13,color:'#f59e0b'}}>{v.metaAdesao?fmt(v.metaAdesao):'-'}</td>
                <td style={{fontSize:13,color:'#10b981'}}>{v.metaMensal?fmt(v.metaMensal):'-'}</td>
                <td><span style={{fontSize:11,color:v.senhaPortal?'#10b981':'#475569'}}>{v.senhaPortal?'🔑 Configurado':'-'}</span></td>
                <td><span className="badge" style={{background:v.ativo!==false?'#10b98122':'#64748b22',color:v.ativo!==false?'#10b981':'#64748b',border:'1px solid '+(v.ativo!==false?'#10b98144':'#64748b44')}}>{v.ativo!==false?'Ativo':'Inativo'}</span></td>
                <td><div style={{display:'flex',gap:6}}>
                  <button className="btn-icon" onClick={()=>{setForm({...vazio,...v});setModal(v)}}>✏️</button>
                  <button className="btn-icon danger" onClick={()=>remover(v.id)}>🗑️</button>
                </div></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {modal&&(
        <div className="modal-overlay" onClick={()=>setModal(null)}>
          <div className="modal-box" style={{maxWidth:660,maxHeight:'90vh',overflowY:'auto'}} onClick={e=>e.stopPropagation()}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:20}}>
              <h2 style={{fontFamily:'Syne,sans-serif',fontSize:17,color:'#00d4ff'}}>{modal==='novo'?'👔 Novo Vendedor':'✏️ Editar Vendedor'}</h2>
              <button onClick={()=>setModal(null)} style={{background:'none',border:'none',color:'#64748b',fontSize:20,cursor:'pointer'}}>✕</button>
            </div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:14,marginBottom:20}}>
              <div className="field" style={{gridColumn:'1/-1'}}><label>Nome *</label><input value={form.nome} onChange={e=>upd('nome',e.target.value)} placeholder="Joao Silva"/></div>
              <div className="field"><label>E-mail *</label><input type="email" value={form.email} onChange={e=>upd('email',e.target.value)}/></div>
              <div className="field"><label>Telefone</label><input value={form.tel} onChange={e=>upd('tel',e.target.value)} placeholder="(11) 9 9999-9999"/></div>
              <div className="field"><label>🔑 Senha do Portal Admin</label><input type="password" value={form.senhaPortal} onChange={e=>upd('senhaPortal',e.target.value)} placeholder="Acesso ao /admin"/></div>
              <div className="field"><label>Status</label>
                <select value={form.ativo?'true':'false'} onChange={e=>upd('ativo',e.target.value==='true')}><option value="true">✅ Ativo</option><option value="false">❌ Inativo</option></select>
              </div>
            </div>
            <div style={{padding:'14px 16px',background:'rgba(0,212,255,.06)',border:'1px solid rgba(0,212,255,.2)',borderRadius:10,marginBottom:16}}>
              <div style={{fontSize:12,color:'#00d4ff',fontWeight:700,marginBottom:14}}>💰 COMISSAO</div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:14}}>
                <div className="field"><label>% Comissao sobre Adesao</label><input type="number" step="0.1" min="0" max="100" value={form.comissaoAdesao} onChange={e=>upd('comissaoAdesao',e.target.value)} placeholder="Ex: 10"/><span style={{fontSize:11,color:'#475569',marginTop:4}}>Valor unico no fechamento.</span></div>
                <div className="field"><label>% Comissao sobre Mensalidade</label><input type="number" step="0.1" min="0" max="100" value={form.comissaoMensal} onChange={e=>upd('comissaoMensal',e.target.value)} placeholder="Ex: 5"/><span style={{fontSize:11,color:'#475569',marginTop:4}}>Pago todo mes que o cliente pagar.</span></div>
                <div className="field" style={{gridColumn:'1/-1'}}>
                  <label>Recorrencia da Comissao Mensal</label>
                  <select value={form.recorrenciaMeses} onChange={e=>upd('recorrenciaMeses',e.target.value)}>
                    <option value="0">♾️ Indefinida — recebe enquanto cliente pagar</option>
                    <option value="1">1 mes</option><option value="2">2 meses</option><option value="3">3 meses</option>
                    <option value="6">6 meses</option><option value="12">12 meses</option><option value="24">24 meses</option>
                  </select>
                  <span style={{fontSize:11,color:'#475569',marginTop:4,display:'block'}}>
                    {Number(form.recorrenciaMeses)===0?'✅ Comissao mensal paga indefinidamente.':'⏱️ Comissao paga nos primeiros '+form.recorrenciaMeses+' mes(es) de cada cliente.'}
                  </span>
                </div>
              </div>
            </div>
            <div style={{padding:'14px 16px',background:'rgba(245,158,11,.06)',border:'1px solid rgba(245,158,11,.2)',borderRadius:10,marginBottom:20}}>
              <div style={{fontSize:12,color:'#f59e0b',fontWeight:700,marginBottom:14}}>🎯 METAS MENSAIS</div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:14}}>
                <div className="field"><label>Meta de Adesao (R$)</label><input type="number" step="0.01" min="0" value={form.metaAdesao} onChange={e=>upd('metaAdesao',e.target.value)} placeholder="Ex: 5000"/></div>
                <div className="field"><label>Meta de Mensalidade (R$)</label><input type="number" step="0.01" min="0" value={form.metaMensal} onChange={e=>upd('metaMensal',e.target.value)} placeholder="Ex: 3000"/></div>
              </div>
            </div>
            <div style={{display:'flex',gap:10,justifyContent:'flex-end'}}>
              <button className="btn-secondary" onClick={()=>setModal(null)}>Cancelar</button>
              <button className="btn-primary" disabled={saving} onClick={salvar}>{saving?'Salvando...':'✅ Salvar Vendedor'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ══════════ USUARIOS ADMIN ══════════
function GerenciarUsuariosAdmin({masterCfg,onSave}){
  const lista=masterCfg.adminUsuarios||[]
  const [modal,setModal]=useState(null)
  const [saving,setSaving]=useState(false)
  const vazio={nome:'',email:'',senha:'',ativo:true,abasPermitidas:['tenants','relvendas']}
  const [form,setForm]=useState(vazio)
  const upd=(k,v)=>setForm(f=>({...f,[k]:v}))
  function toggleAba(id){setForm(f=>({...f,abasPermitidas:f.abasPermitidas.includes(id)?f.abasPermitidas.filter(a=>a!==id):[...f.abasPermitidas,id]}))}
  async function salvar(){
    if(!form.nome.trim()||!form.email.trim()||!form.senha.trim()){alert('Nome, e-mail e senha obrigatorios.');return}
    setSaving(true)
    const nl=modal==='novo'?[...lista,{...form,id:uid(),criadoEm:new Date().toISOString()}]:lista.map(u=>u.id===modal.id?{...u,...form}:u)
    await onSave(nl);setModal(null);setSaving(false)
  }
  return(
    <div>
      <div className="page-header">
        <div><h1 className="page-title">Usuarios Admin</h1><p className="page-sub">Controle de acesso ao painel master</p></div>
        <button className="btn-primary" onClick={()=>{setForm(vazio);setModal('novo')}}>+ Novo Usuario</button>
      </div>
      <div style={{marginBottom:16,padding:'12px 16px',background:'rgba(245,158,11,.06)',border:'1px solid rgba(245,158,11,.2)',borderRadius:10,fontSize:12,color:'#f59e0b',lineHeight:1.6}}>
        💡 Usuarios admin acessam com e-mail e senha definidos aqui. Vendedores acessam com a senha do portal definida em Vendedores e veem apenas Rel. Vendas e Comissoes.
      </div>
      <div className="table-wrap">
        <table className="admin-table">
          <thead><tr><th>Nome</th><th>E-mail</th><th>Abas com Acesso</th><th>Status</th><th>Acoes</th></tr></thead>
          <tbody>
            {lista.length===0?<tr><td colSpan={5} style={{textAlign:'center',color:'#475569',padding:'40px'}}>Nenhum usuario admin. O e-mail master tem acesso completo.</td></tr>
            :lista.map(u=>(
              <tr key={u.id} className="table-row">
                <td style={{fontWeight:600,color:'#e2e8f0',fontSize:13}}>{u.nome}</td>
                <td style={{fontSize:12,color:'#94a3b8'}}>{u.email}</td>
                <td style={{fontSize:11,color:'#64748b',maxWidth:300}}>{(u.abasPermitidas||[]).map(a=>TODAS_ABAS.find(x=>x.id===a)?.label||a).join(', ')||'-'}</td>
                <td><span className="badge" style={{background:u.ativo!==false?'#10b98122':'#64748b22',color:u.ativo!==false?'#10b981':'#64748b',border:'1px solid '+(u.ativo!==false?'#10b98144':'#64748b44')}}>{u.ativo!==false?'Ativo':'Inativo'}</span></td>
                <td><div style={{display:'flex',gap:6}}>
                  <button className="btn-icon" onClick={()=>{setForm({...vazio,...u});setModal(u)}}>✏️</button>
                  <button className="btn-icon danger" onClick={async()=>{if(!confirm('Remover usuario?'))return;await onSave(lista.filter(x=>x.id!==u.id))}}>🗑️</button>
                </div></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {modal&&(
        <div className="modal-overlay" onClick={()=>setModal(null)}>
          <div className="modal-box" style={{maxWidth:560,maxHeight:'90vh',overflowY:'auto'}} onClick={e=>e.stopPropagation()}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:20}}>
              <h2 style={{fontFamily:'Syne,sans-serif',fontSize:17,color:'#00d4ff'}}>{modal==='novo'?'👤 Novo Usuario Admin':'✏️ Editar Usuario'}</h2>
              <button onClick={()=>setModal(null)} style={{background:'none',border:'none',color:'#64748b',fontSize:20,cursor:'pointer'}}>✕</button>
            </div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:14,marginBottom:20}}>
              <div className="field" style={{gridColumn:'1/-1'}}><label>Nome *</label><input value={form.nome} onChange={e=>upd('nome',e.target.value)}/></div>
              <div className="field"><label>E-mail *</label><input type="email" value={form.email} onChange={e=>upd('email',e.target.value)}/></div>
              <div className="field"><label>Senha *</label><input type="password" value={form.senha} onChange={e=>upd('senha',e.target.value)}/></div>
              <div className="field"><label>Status</label><select value={form.ativo?'true':'false'} onChange={e=>upd('ativo',e.target.value==='true')}><option value="true">Ativo</option><option value="false">Inativo</option></select></div>
            </div>
            <div style={{marginBottom:20}}>
              <div style={{fontSize:12,color:'#94a3b8',fontWeight:700,marginBottom:12,letterSpacing:.5}}>🔐 ABAS COM ACESSO</div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>
                {TODAS_ABAS.filter(a=>a.id!=='usuarios').map(a=>{
                  const ativo=form.abasPermitidas.includes(a.id)
                  return(
                    <div key={a.id} onClick={()=>toggleAba(a.id)} style={{display:'flex',alignItems:'center',gap:10,padding:'8px 12px',borderRadius:8,border:'1px solid '+(ativo?'#00d4ff44':'#1e2d4a'),background:ativo?'#00d4ff0d':'#111827',cursor:'pointer'}}>
                      <div style={{width:14,height:14,borderRadius:3,border:'2px solid '+(ativo?'#00d4ff':'#334155'),background:ativo?'#00d4ff':'transparent',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>{ativo&&<span style={{fontSize:8,color:'#000',fontWeight:900}}>✓</span>}</div>
                      <span style={{fontSize:12,color:ativo?'#e2e8f0':'#64748b'}}>{a.icon} {a.label}</span>
                    </div>
                  )
                })}
              </div>
            </div>
            <div style={{display:'flex',gap:10,justifyContent:'flex-end'}}>
              <button className="btn-secondary" onClick={()=>setModal(null)}>Cancelar</button>
              <button className="btn-primary" disabled={saving} onClick={salvar}>{saving?'Salvando...':'✅ Salvar'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ══════════ ABA FINANCEIRO AVANCADO ══════════
function AbaFinanceiro({tenants,planos,stats,masterCfg,onAtualizarPagto}){
  const [filtro,setFiltro]=useState('')
  const [modalCob,setModalCob]=useState(null)
  const [rodando,setRodando]=useState(false)
  const [cronRes,setCronRes]=useState(null)

  const inadimplentes=tenants.filter(t=>(t.pagamentoStatus||'pendente')!=='pago'&&t.vencimento&&new Date(t.vencimento)<new Date())
  const filtrados=filtro==='inadimplente'?inadimplentes:filtro==='pago'?tenants.filter(t=>t.pagamentoStatus==='pago'):filtro==='pendente'?tenants.filter(t=>(t.pagamentoStatus||'pendente')==='pendente'):tenants.filter(t=>t.status!=='cancelado')
  const totalRec=tenants.filter(t=>t.pagamentoStatus==='pago').reduce((a,t)=>a+Number(t.mensalidade||0),0)
  const totalInad=inadimplentes.reduce((a,t)=>a+Number(t.mensalidade||0),0)
  const totalAdes=tenants.reduce((a,t)=>a+Number(t.adesao||0),0)

  async function dispararRegua(){
    setRodando(true);setCronRes(null)
    try{
      const res=await fetch('/api/cobranca-automatica?secret='+(masterCfg?.cronSecret||'dev_test'))
      const d=await res.json();setCronRes(d)
    }catch(e){setCronRes({error:e.message})}
    setRodando(false)
  }

  return(
    <>
      <div className="page-header">
        <div><h1 className="page-title">Financeiro</h1><p className="page-sub">Receitas, cobranças e inadimplencia</p></div>
        <button onClick={dispararRegua} disabled={rodando} className="btn-secondary" style={{fontSize:12,padding:'8px 16px',color:'#f59e0b',borderColor:'#f59e0b44'}}>
          {rodando?'⏳ Rodando...':'🤖 Disparar Regua Agora'}
        </button>
      </div>
      <div className="stats-grid" style={{gridTemplateColumns:'repeat(4,1fr)',marginBottom:20}}>
        {[{label:'MRR',valor:fmt(stats.mrr),icon:'💰',cor:'#10b981'},{label:'Recebido',valor:fmt(totalRec),icon:'✅',cor:'#00d4ff'},{label:'Inadimplencia',valor:fmt(totalInad),icon:'⚠️',cor:'#ef4444'},{label:'Total Adesoes',valor:fmt(totalAdes),icon:'🎯',cor:'#7c3aed'}].map((s,i)=>(
          <div key={i} className="stat-card" style={{'--cor':s.cor}}><div className="stat-icon">{s.icon}</div><div className="stat-val" style={{color:s.cor,fontSize:18}}>{s.valor}</div><div className="stat-label">{s.label}</div></div>
        ))}
      </div>
      {cronRes&&(
        <div style={{padding:'12px 16px',borderRadius:10,background:cronRes.error?'rgba(239,68,68,.08)':'rgba(16,185,129,.08)',border:'1px solid '+(cronRes.error?'rgba(239,68,68,.3)':'rgba(16,185,129,.3)'),marginBottom:20}}>
          {cronRes.error?<div style={{color:'#ef4444',fontSize:13}}>❌ {cronRes.error}</div>:<div><div style={{color:'#10b981',fontSize:13,fontWeight:600}}>✅ Regua executada — {cronRes.processados} inadimplente(s) verificado(s)</div>{cronRes.log?.slice(0,5).map((l,i)=><div key={i} style={{fontSize:11,color:'#64748b',marginTop:4}}>{JSON.stringify(l)}</div>)}</div>}
        </div>
      )}
      {inadimplentes.length>0&&(
        <div style={{padding:'14px 18px',borderRadius:10,background:'rgba(239,68,68,.08)',border:'1px solid rgba(239,68,68,.3)',marginBottom:20,display:'flex',justifyContent:'space-between',alignItems:'center'}}>
          <div><div style={{color:'#ef4444',fontWeight:700,fontSize:14}}>⚠️ {inadimplentes.length} cliente(s) inadimplente(s)</div><div style={{color:'#94a3b8',fontSize:12,marginTop:4}}>Total em aberto: {fmt(totalInad)}</div></div>
          <button onClick={()=>setFiltro('inadimplente')} style={{padding:'8px 16px',background:'rgba(239,68,68,.15)',border:'1px solid rgba(239,68,68,.4)',borderRadius:8,color:'#ef4444',fontSize:12,cursor:'pointer',fontFamily:'DM Mono,monospace'}}>Ver inadimplentes</button>
        </div>
      )}
      <div className="filtros-bar">
        {[{v:'',l:'Todos os ativos'},{v:'pago',l:'✅ Pagos'},{v:'pendente',l:'⏳ Pendentes'},{v:'inadimplente',l:'⚠️ Inadimplentes'}].map(f=>(
          <button key={f.v} onClick={()=>setFiltro(f.v)} style={{padding:'7px 14px',borderRadius:6,border:'1px solid',cursor:'pointer',fontSize:12,fontFamily:'DM Mono,monospace',borderColor:filtro===f.v?'#00d4ff':'#1e2d4a',background:filtro===f.v?'rgba(0,212,255,.1)':'#111827',color:filtro===f.v?'#00d4ff':'#64748b'}}>{f.l}</button>
        ))}
        <span style={{fontSize:12,color:'#475569',marginLeft:'auto'}}>{filtrados.length} cliente(s)</span>
      </div>
      <div className="table-wrap">
        <table className="admin-table">
          <thead><tr><th>Empresa</th><th>Plano</th><th>Adesao</th><th>Mensalidade</th><th>Vencimento</th><th>Atraso</th><th>Pagamento</th><th>Cobrar</th></tr></thead>
          <tbody>
            {filtrados.length===0?<tr><td colSpan={8} style={{textAlign:'center',color:'#475569',padding:'40px'}}>Nenhum registro.</td></tr>
            :filtrados.map(t=>{
              const plano=planos.find(p=>p.id===t.plano)
              const pagto=t.pagamentoStatus||'pendente'
              const dias=getDias(t.vencimento)
              const pCor={pago:'#10b981',pendente:'#f59e0b',atrasado:'#ef4444'}[pagto]||'#64748b'
              return(
                <tr key={t.id} className="table-row">
                  <td><div style={{fontWeight:600,color:'#e2e8f0',fontSize:13}}>{t.nomeEmpresa}</div><div style={{fontSize:11,color:'#475569'}}>{t.emailAdmin}</div></td>
                  <td><span className="badge" style={{background:plano?.cor+'22',color:plano?.cor,border:'1px solid '+plano?.cor+'44'}}>{plano?.name}</span></td>
                  <td style={{color:'#94a3b8',fontSize:13}}>{t.adesao?fmt(t.adesao):'-'}</td>
                  <td style={{color:'#10b981',fontWeight:600,fontSize:13}}>{t.mensalidade?fmt(t.mensalidade):'-'}</td>
                  <td style={{fontSize:12,color:dias>0?'#ef4444':'#94a3b8'}}>{fmtData(t.vencimento)}</td>
                  <td>{dias>0?<span style={{fontSize:12,color:dias>10?'#ef4444':dias>5?'#f59e0b':'#94a3b8',fontWeight:600}}>{dias}d</span>:<span style={{color:'#334155',fontSize:11}}>-</span>}</td>
                  <td>
                    <select value={pagto} onChange={async e=>onAtualizarPagto({...t,pagamentoStatus:e.target.value})}
                      style={{background:pCor+'22',border:'1px solid '+pCor+'66',borderRadius:6,color:pCor,fontSize:11,padding:'3px 8px',fontFamily:'DM Mono,monospace',cursor:'pointer',outline:'none'}}>
                      <option value="pago">✅ Pago</option><option value="pendente">⏳ Pendente</option><option value="atrasado">⚠️ Atrasado</option>
                    </select>
                  </td>
                  <td><button onClick={()=>setModalCob(t)} className="btn-icon" title="Emitir cobrança" style={{background:'rgba(124,58,237,.15)',borderColor:'rgba(124,58,237,.4)'}}>💳</button></td>
                </tr>
              )
            })}
          </tbody>
          {filtrados.length>0&&(
            <tfoot><tr>
              <td colSpan={2} style={{padding:'12px 16px',fontSize:11,color:'#64748b',fontWeight:600}}>TOTAIS</td>
              <td style={{padding:'12px 16px',color:'#94a3b8',fontWeight:700,fontSize:13}}>{fmt(filtrados.reduce((a,t)=>a+Number(t.adesao||0),0))}</td>
              <td style={{padding:'12px 16px',color:'#10b981',fontWeight:700,fontSize:13}}>{fmt(filtrados.reduce((a,t)=>a+Number(t.mensalidade||0),0))}/mes</td>
              <td colSpan={4}/>
            </tr></tfoot>
          )}
        </table>
      </div>
      {modalCob&&<ModalCobranca tenant={modalCob} masterCfg={masterCfg} onClose={()=>setModalCob(null)} onPago={async()=>{await onAtualizarPagto({...modalCob,pagamentoStatus:'pago'});setModalCob(null)}}/>}
    </>
  )
}

// ══════════ ABA METRICAS ══════════
function AbaMetricas({tenants,planos,stats}){
  return(
    <>
      <div className="page-header"><div><h1 className="page-title">Metricas</h1><p className="page-sub">Visao geral da plataforma</p></div></div>
      <div style={{display:'grid',gridTemplateColumns:'repeat(2,1fr)',gap:20}}>
        <div className="card"><h3 className="card-title" style={{marginBottom:16}}>📦 Ativos por Plano</h3>
          {planos.map(p=>{const q=tenants.filter(t=>t.plano===p.id&&t.status==='ativo').length;const pc=stats.ativos>0?(q/stats.ativos)*100:0;return(<div key={p.id} style={{marginTop:12}}><div style={{display:'flex',justifyContent:'space-between',fontSize:12,color:'#94a3b8',marginBottom:4}}><span style={{color:p.cor}}>{p.name}</span><span>{q}</span></div><div style={{background:'#1a2540',borderRadius:4,height:6}}><div style={{background:p.cor,width:pc+'%',height:'100%',borderRadius:4}}/></div></div>)})}
        </div>
        <div className="card"><h3 className="card-title" style={{marginBottom:16}}>📊 Por Status</h3>
          {STATUS_TENANT.map(s=>{const q=tenants.filter(t=>t.status===s.id).length;const pc=tenants.length>0?(q/tenants.length)*100:0;return(<div key={s.id} style={{marginTop:12}}><div style={{display:'flex',justifyContent:'space-between',fontSize:12,color:'#94a3b8',marginBottom:4}}><span style={{color:s.cor}}>{s.label}</span><span>{q} ({pc.toFixed(0)}%)</span></div><div style={{background:'#1a2540',borderRadius:4,height:6}}><div style={{background:s.cor,width:pc+'%',height:'100%',borderRadius:4}}/></div></div>)})}
        </div>
        <div className="card" style={{gridColumn:'1/-1'}}><h3 className="card-title" style={{marginBottom:16}}>⚠️ Vencimentos nos proximos 30 dias</h3>
          {(()=>{
            const hoje=new Date(),lim=new Date();lim.setDate(lim.getDate()+30)
            const prox=tenants.filter(t=>{if(!t.vencimento||t.status==='cancelado')return false;const v=new Date(t.vencimento);return v>=hoje&&v<=lim}).sort((a,b)=>new Date(a.vencimento)-new Date(b.vencimento))
            if(!prox.length)return<p style={{color:'#475569',fontSize:13,marginTop:8}}>✅ Nenhum vencimento proximo.</p>
            return prox.map(t=>{
              const dias=Math.ceil((new Date(t.vencimento)-hoje)/86400000)
              const plano=planos.find(p=>p.id===t.plano)
              return(<div key={t.id} style={{display:'flex',justifyContent:'space-between',padding:'10px 0',borderBottom:'1px solid #1e2d4a'}}>
                <div><div style={{fontSize:13,color:'#e2e8f0',fontWeight:600}}>{t.nomeEmpresa}</div><div style={{fontSize:11,color:'#475569',marginTop:2}}>{plano?.name} · {fmt(t.mensalidade)}/mes</div></div>
                <div style={{textAlign:'right'}}><div style={{fontSize:12,color:dias<=7?'#ef4444':'#f59e0b',fontWeight:600}}>em {dias} dia(s)</div><div style={{fontSize:11,color:'#475569'}}>{fmtData(t.vencimento)}</div></div>
              </div>)
            })
          })()}
        </div>
      </div>
    </>
  )
}

// ══════════ GERENCIAR PLANOS ══════════
function GerenciarPlanos({planos,setPlanos,onSave}){
  const [saving,setSaving]=useState(false)
  const [modal,setModal]=useState(null) // null | 'novo' | objeto_plano
  const [confirmDel,setConfirmDel]=useState(null)

  // Form fields
  const vazio={id:'',name:'',cor:'#00d4ff',maxUsuarios:5,adesao:0,mensalidade:0,descricao:'',destaque:false,modulos:[]}
  const [form,setForm]=useState(vazio)
  const upd=(k,v)=>setForm(f=>({...f,[k]:v}))
  function toggleModForm(id){setForm(f=>({...f,modulos:f.modulos.includes(id)?f.modulos.filter(m=>m!==id):[...f.modulos,id]}))}
  function toggleGrupoForm(grupo){
    const ids=TODOS_MODULOS.filter(m=>m.grupo===grupo).map(m=>m.id)
    const all=ids.every(id=>form.modulos.includes(id))
    setForm(f=>({...f,modulos:all?f.modulos.filter(m=>!ids.includes(m)):[...new Set([...f.modulos,...ids])]}))
  }

  const CORES_PRESET=['#00d4ff','#7c3aed','#10b981','#f59e0b','#ec4899','#ef4444','#64748b','#06b6d4','#8b5cf6','#f97316']

  async function salvarTodos(){setSaving(true);await onSave(planos);setSaving(false);toast('✅ Planos salvos!')}

  async function salvarModal(){
    if(!form.name.trim()){alert('Informe o nome do plano.');return}
    const idFinal=form.id||form.name.toLowerCase().replace(/[^a-z0-9]/g,'_').slice(0,20)
    const novo={...form,id:idFinal}
    let nl
    if(modal==='novo'){
      if(planos.find(p=>p.id===idFinal)){alert('Ja existe um plano com este ID: '+idFinal);return}
      nl=[...planos,novo]
    } else {
      nl=planos.map(p=>p.id===modal.id?novo:p)
    }
    setPlanos(nl)
    await onSave(nl)
    setModal(null)
    toast('✅ Plano '+(modal==='novo'?'criado':'atualizado')+'!')
  }

  async function excluirPlano(id){
    const nl=planos.filter(p=>p.id!==id)
    setPlanos(nl)
    await onSave(nl)
    setConfirmDel(null)
    toast('🗑️ Plano removido.')
  }

  const clientesNoPlan=id=>0 // placeholder — seria contado dos tenants se passado como prop

  return(
    <div>
      <div className="page-header">
        <div><h1 className="page-title">Planos</h1><p className="page-sub">Crie, edite e exclua planos — cada cliente tem seu plano atribuido</p></div>
        <div style={{display:'flex',gap:8}}>
          <button className="btn-secondary" disabled={saving} onClick={salvarTodos} style={{fontSize:13}}>💾 Salvar todos</button>
          <button className="btn-primary" onClick={()=>{setForm(vazio);setModal('novo')}}>+ Novo Plano</button>
        </div>
      </div>

      {/* Grid de planos */}
      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(300px,1fr))',gap:16}}>
        {planos.map(p=>(
          <div key={p.id} className="card" style={{borderTop:'3px solid '+p.cor,position:'relative'}}>
            {p.destaque&&<div style={{position:'absolute',top:-1,right:16,background:p.cor,color:'#000',fontSize:10,fontWeight:700,padding:'2px 8px',borderRadius:'0 0 6px 6px',letterSpacing:.5}}>DESTAQUE</div>}
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:12}}>
              <div>
                <h3 style={{fontFamily:'Syne,sans-serif',color:p.cor,fontSize:17,fontWeight:800}}>{p.name}</h3>
                <span style={{fontSize:10,color:'#475569',background:'#0d1526',padding:'1px 6px',borderRadius:3,marginTop:4,display:'inline-block'}}>{p.id}</span>
              </div>
              <div style={{display:'flex',gap:6}}>
                <button className="btn-icon" title="Editar" onClick={()=>{setForm({...vazio,...p,modulos:p.modulos||[]});setModal(p)}}>✏️</button>
                <button className="btn-icon danger" title="Excluir" onClick={()=>setConfirmDel(p)}>🗑️</button>
              </div>
            </div>

            {p.descricao&&<p style={{fontSize:12,color:'#64748b',marginBottom:12,lineHeight:1.5}}>{p.descricao}</p>}

            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,marginBottom:12}}>
              <div style={{padding:'8px 12px',background:'#0d1526',borderRadius:8}}>
                <div style={{fontSize:10,color:'#475569',marginBottom:3}}>ADESAO</div>
                <div style={{color:'#94a3b8',fontWeight:700,fontSize:14}}>{p.adesao>0?fmt(p.adesao):'Gratis'}</div>
              </div>
              <div style={{padding:'8px 12px',background:'#0d1526',borderRadius:8}}>
                <div style={{fontSize:10,color:'#475569',marginBottom:3}}>MENSALIDADE</div>
                <div style={{color:p.cor,fontWeight:700,fontSize:14}}>{p.mensalidade>0?fmt(p.mensalidade)+'/mes':'Gratis'}</div>
              </div>
            </div>

            <div style={{display:'flex',justifyContent:'space-between',fontSize:12,color:'#64748b'}}>
              <span>👥 Ate {p.maxUsuarios===999?'ilimitados':p.maxUsuarios+' usuario(s)'}</span>
              <span>🔐 {(p.modulos||[]).length} modulo(s)</span>
            </div>
          </div>
        ))}

        {/* Card + novo */}
        <div onClick={()=>{setForm(vazio);setModal('novo')}}
          style={{border:'2px dashed #1e2d4a',borderRadius:12,padding:24,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:10,cursor:'pointer',minHeight:160,transition:'all .2s'}}
          onMouseEnter={e=>{e.currentTarget.style.borderColor='#00d4ff';e.currentTarget.style.background='rgba(0,212,255,.03)'}}
          onMouseLeave={e=>{e.currentTarget.style.borderColor='#1e2d4a';e.currentTarget.style.background='transparent'}}>
          <div style={{fontSize:32,opacity:.4}}>＋</div>
          <div style={{fontSize:13,color:'#475569'}}>Novo Plano</div>
        </div>
      </div>

      {/* Modal criar/editar plano */}
      {modal&&(
        <div className="modal-overlay" onClick={()=>setModal(null)}>
          <div className="modal-box" style={{maxWidth:700,maxHeight:'92vh',overflowY:'auto'}} onClick={e=>e.stopPropagation()}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:20}}>
              <h2 style={{fontFamily:'Syne,sans-serif',fontSize:17,color:'#00d4ff'}}>{modal==='novo'?'📦 Novo Plano':'✏️ Editar Plano: '+modal.name}</h2>
              <button onClick={()=>setModal(null)} style={{background:'none',border:'none',color:'#64748b',fontSize:20,cursor:'pointer'}}>✕</button>
            </div>

            {/* Dados basicos */}
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:14,marginBottom:20}}>
              <div className="field">
                <label>Nome do plano *</label>
                <input value={form.name} onChange={e=>{upd('name',e.target.value);if(modal==='novo')upd('id',e.target.value.toLowerCase().replace(/[^a-z0-9]/g,'_').slice(0,20))}} placeholder="Ex: Profissional"/>
              </div>
              <div className="field">
                <label>ID interno (gerado automaticamente)</label>
                <input value={form.id} onChange={e=>upd('id',e.target.value.toLowerCase().replace(/[^a-z0-9_]/g,'').slice(0,20))} placeholder="ex: profissional" readOnly={modal!=='novo'} style={{opacity:modal!=='novo'?.6:1}}/>
                <span>Usado internamente. Nao pode ser alterado apos criar.</span>
              </div>
              <div className="field" style={{gridColumn:'1/-1'}}>
                <label>Descricao (exibida para o cliente)</label>
                <input value={form.descricao} onChange={e=>upd('descricao',e.target.value)} placeholder="Ex: Ideal para equipes de ate 8 pessoas"/>
              </div>
              <div className="field"><label>Adesao padrao (R$)</label><input type="number" step="0.01" min="0" value={form.adesao} onChange={e=>upd('adesao',Number(e.target.value))}/></div>
              <div className="field"><label>Mensalidade padrao (R$)</label><input type="number" step="0.01" min="0" value={form.mensalidade} onChange={e=>upd('mensalidade',Number(e.target.value))}/></div>
              <div className="field">
                <label>Max. usuarios (999 = ilimitado)</label>
                <input type="number" min="1" value={form.maxUsuarios} onChange={e=>upd('maxUsuarios',Number(e.target.value))}/>
              </div>
              <div>
                <label style={{fontSize:11,color:'#64748b',display:'block',marginBottom:8,letterSpacing:.5}}>COR DO PLANO</label>
                <div style={{display:'flex',gap:8,flexWrap:'wrap',alignItems:'center'}}>
                  {CORES_PRESET.map(c=>(
                    <div key={c} onClick={()=>upd('cor',c)}
                      style={{width:28,height:28,borderRadius:'50%',background:c,cursor:'pointer',border:'3px solid '+(form.cor===c?'#fff':'transparent'),transition:'all .15s'}}/>
                  ))}
                  <input type="color" value={form.cor} onChange={e=>upd('cor',e.target.value)}
                    style={{width:28,height:28,borderRadius:'50%',border:'none',cursor:'pointer',background:'none',padding:0}}
                    title="Cor personalizada"/>
                </div>
                <div style={{marginTop:8,display:'flex',alignItems:'center',gap:10}}>
                  <div style={{width:40,height:4,borderRadius:2,background:form.cor}}/>
                  <span style={{fontSize:11,color:form.cor,fontWeight:700}}>{form.name||'Preview'}</span>
                </div>
              </div>
              <div style={{display:'flex',alignItems:'center'}}>
                <label style={{display:'flex',alignItems:'center',gap:10,cursor:'pointer',fontSize:13,color:'#94a3b8'}}>
                  <input type="checkbox" checked={form.destaque||false} onChange={e=>upd('destaque',e.target.checked)}/>
                  ⭐ Marcar como plano em destaque
                </label>
              </div>
            </div>

            {/* Modulos do plano */}
            <div style={{padding:'14px 16px',background:'rgba(0,212,255,.04)',border:'1px solid rgba(0,212,255,.15)',borderRadius:10,marginBottom:20}}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:14}}>
                <div style={{fontSize:12,color:'#00d4ff',fontWeight:700}}>🔐 MODULOS INCLUIDOS NESTE PLANO</div>
                <div style={{display:'flex',gap:8}}>
                  <button onClick={()=>setForm(f=>({...f,modulos:TODOS_MODULOS.map(m=>m.id)}))} style={{padding:'3px 10px',background:'#10b98122',border:'1px solid #10b98144',borderRadius:5,color:'#10b981',fontSize:11,cursor:'pointer',fontFamily:'DM Mono,monospace'}}>Todos</button>
                  <button onClick={()=>setForm(f=>({...f,modulos:[]}))} style={{padding:'3px 10px',background:'#ef444422',border:'1px solid #ef444444',borderRadius:5,color:'#ef4444',fontSize:11,cursor:'pointer',fontFamily:'DM Mono,monospace'}}>Nenhum</button>
                  <span style={{fontSize:11,color:'#475569',padding:'3px 6px'}}>{form.modulos.length}/{TODOS_MODULOS.length}</span>
                </div>
              </div>
              {GRUPOS.map(grupo=>{
                const gMs=TODOS_MODULOS.filter(m=>m.grupo===grupo)
                const allG=gMs.every(m=>form.modulos.includes(m.id))
                return(
                  <div key={grupo} style={{marginBottom:16}}>
                    <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:8}}>
                      <span style={{fontSize:11,color:'#94a3b8',fontWeight:700}}>{grupo}</span>
                      <button onClick={()=>toggleGrupoForm(grupo)} style={{padding:'1px 7px',background:allG?'#00d4ff22':'#1a2540',border:'1px solid '+(allG?'#00d4ff44':'#1e2d4a'),borderRadius:4,color:allG?'#00d4ff':'#475569',fontSize:10,cursor:'pointer',fontFamily:'DM Mono,monospace'}}>{allG?'desmarcar':'marcar'}</button>
                    </div>
                    <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:5}}>
                      {gMs.map(mod=>{const at=form.modulos.includes(mod.id);return(
                        <div key={mod.id} onClick={()=>toggleModForm(mod.id)} style={{display:'flex',alignItems:'center',gap:8,padding:'7px 10px',borderRadius:6,border:'1px solid '+(at?'#00d4ff44':'#1e2d4a'),background:at?'#00d4ff0d':'#111827',cursor:'pointer'}}>
                          <div style={{width:13,height:13,borderRadius:2,border:'2px solid '+(at?'#00d4ff':'#334155'),background:at?'#00d4ff':'transparent',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>{at&&<span style={{fontSize:8,color:'#000',fontWeight:900}}>✓</span>}</div>
                          <span style={{fontSize:11,color:at?'#e2e8f0':'#64748b'}}>{mod.label}</span>
                        </div>
                      )})}
                    </div>
                  </div>
                )
              })}
            </div>

            <div style={{display:'flex',gap:10,justifyContent:'flex-end'}}>
              <button className="btn-secondary" onClick={()=>setModal(null)}>Cancelar</button>
              <button className="btn-primary" onClick={salvarModal} disabled={saving}>{saving?'Salvando...':modal==='novo'?'✅ Criar Plano':'✅ Salvar Alteracoes'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal confirmar exclusao */}
      {confirmDel&&(
        <div className="modal-overlay" onClick={()=>setConfirmDel(null)}>
          <div className="modal-box" style={{maxWidth:440}} onClick={e=>e.stopPropagation()}>
            <h2 style={{fontFamily:'Syne,sans-serif',color:'#ef4444',fontSize:18,marginBottom:12}}>🗑️ Excluir Plano</h2>
            <p style={{color:'#94a3b8',fontSize:13,lineHeight:1.7}}>
              Tem certeza que deseja excluir o plano <strong style={{color:confirmDel.cor}}>{confirmDel.name}</strong>?<br/>
              <span style={{color:'#f59e0b',fontSize:12}}>⚠️ Clientes ja atribuidos a este plano continuarao com ele ate voce reatribuir manualmente.</span>
            </p>
            <div style={{display:'flex',gap:10,marginTop:24,justifyContent:'flex-end'}}>
              <button className="btn-secondary" onClick={()=>setConfirmDel(null)}>Cancelar</button>
              <button className="btn-danger" onClick={()=>excluirPlano(confirmDel.id)}>Sim, excluir plano</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ══════════ RELATORIO DE VENDAS ══════════
function RelatorioVendas({tenants,vendedores,planos,masterCfg,usuarioLogado,onAtualizarPagto}){
  const [fVend,setFVend]=useState(usuarioLogado?.tipo==='vendedor'?usuarioLogado.id:'')
  const [fMes,setFMes]=useState(mesAtual())
  const [fPlano,setFPlano]=useState('')
  const [fPagto,setFPagto]=useState('')

  const meses=[...new Set(tenants.filter(t=>t.criadoEm).map(t=>t.criadoEm.slice(0,7)))].sort((a,b)=>b.localeCompare(a))
  if(!meses.includes(mesAtual()))meses.unshift(mesAtual())

  const filtrados=tenants.filter(t=>{
    const mes=t.criadoEm?.slice(0,7)||''
    const pagto=t.pagamentoStatus||'pendente'
    return(!fMes||mes===fMes)&&(!fVend||t.vendedorId===fVend)&&(!fPlano||t.plano===fPlano)&&(!fPagto||pagto===fPagto)
  })

  const totAdes=filtrados.reduce((a,t)=>a+Number(t.adesao||0),0)
  const totMens=filtrados.reduce((a,t)=>a+Number(t.mensalidade||0),0)
  const totPago=filtrados.filter(t=>t.pagamentoStatus==='pago').reduce((a,t)=>a+Number(t.mensalidade||0),0)
  const totPend=filtrados.filter(t=>t.pagamentoStatus!=='pago').reduce((a,t)=>a+Number(t.mensalidade||0),0)

  const rankVend=vendedores.map(v=>{
    const cl=filtrados.filter(t=>t.vendedorId===v.id)
    const rA=cl.reduce((a,t)=>a+Number(t.adesao||0),0)
    const rM=cl.reduce((a,t)=>a+Number(t.mensalidade||0),0)
    const mA=Number(v.metaAdesao||0),mM=Number(v.metaMensal||0)
    return{...v,qtd:cl.length,rA,rM,mA,mM,pA:mA>0?(rA/mA*100):null,pM:mM>0?(rM/mM*100):null}
  }).filter(v=>v.qtd>0)

  function dadosExp(){return filtrados.map(t=>({Empresa:t.nomeEmpresa,Email:t.emailAdmin,Vendedor:vendedores.find(v=>v.id===t.vendedorId)?.nome||'-',Plano:planos.find(p=>p.id===t.plano)?.name||t.plano,Status:t.status,Adesao:Number(t.adesao||0).toFixed(2),Mensalidade:Number(t.mensalidade||0).toFixed(2),Pagamento:t.pagamentoStatus||'pendente',Cadastro:t.criadoEm?new Date(t.criadoEm).toLocaleDateString('pt-BR'):'-'}))}

  const EXP_ID='rel-vendas-print'

  function Barra({val,cor}){
    if(val===null)return<span style={{fontSize:11,color:'#334155'}}>sem meta</span>
    const c=val>=100?'#10b981':val>=50?'#f59e0b':'#ef4444'
    return(<div style={{minWidth:80}}><div style={{fontSize:11,color:c,marginBottom:3,fontWeight:600}}>{val.toFixed(0)}%</div><div style={{background:'#1a2540',borderRadius:4,height:6}}><div style={{background:c,width:Math.min(val,100)+'%',height:'100%',borderRadius:4}}/></div></div>)
  }

  return(
    <div>
      <div className="page-header">
        <div><h1 className="page-title">Relatorio de Vendas</h1><p className="page-sub">Planejado x Realizado · Status de pagamento por cliente</p></div>
        <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
          <button onClick={()=>exportarPDF(EXP_ID)} className="btn-secondary" style={{fontSize:12,padding:'8px 14px'}}>🖨️ PDF</button>
          <button onClick={()=>exportarExcel(dadosExp(),'rel-vendas')} className="btn-secondary" style={{fontSize:12,padding:'8px 14px'}}>📊 Excel</button>
          <button onClick={()=>exportarCSV(dadosExp(),'rel-vendas')} className="btn-secondary" style={{fontSize:12,padding:'8px 14px'}}>📄 CSV</button>
          <button onClick={()=>exportarTXT(dadosExp(),'rel-vendas')} className="btn-secondary" style={{fontSize:12,padding:'8px 14px'}}>📝 TXT</button>
        </div>
      </div>
      <div className="filtros-bar">
        <select className="select-filtro" value={fMes} onChange={e=>setFMes(e.target.value)}>
          <option value="">Todos os meses</option>{meses.map(m=><option key={m} value={m}>{fmtMesLbl(m)}</option>)}
        </select>
        {usuarioLogado?.tipo!=='vendedor'&&(<select className="select-filtro" value={fVend} onChange={e=>setFVend(e.target.value)}><option value="">Todos os vendedores</option>{vendedores.map(v=><option key={v.id} value={v.id}>{v.nome}</option>)}</select>)}
        <select className="select-filtro" value={fPlano} onChange={e=>setFPlano(e.target.value)}><option value="">Todos os planos</option>{planos.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select>
        <select className="select-filtro" value={fPagto} onChange={e=>setFPagto(e.target.value)}><option value="">Todos os pagamentos</option><option value="pago">✅ Pago</option><option value="pendente">⏳ Pendente</option><option value="atrasado">⚠️ Atrasado</option></select>
        <span style={{fontSize:12,color:'#475569',marginLeft:'auto'}}>{filtrados.length} venda(s)</span>
      </div>
      <div id={EXP_ID}>
        <div className="stats-grid" style={{gridTemplateColumns:'repeat(4,1fr)',marginBottom:20}}>
          {[{label:'Vendas',valor:filtrados.length,icon:'🧾',cor:'#00d4ff'},{label:'Total Adesao',valor:fmt(totAdes),icon:'💵',cor:'#f59e0b'},{label:'MRR Gerado',valor:fmt(totMens),icon:'🔄',cor:'#7c3aed'},{label:'Recebido (Pago)',valor:fmt(totPago),icon:'✅',cor:'#10b981'}].map((s,i)=>(
            <div key={i} className="stat-card" style={{'--cor':s.cor}}><div className="stat-icon">{s.icon}</div><div className="stat-val" style={{color:s.cor,fontSize:18}}>{s.valor}</div><div className="stat-label">{s.label}</div></div>
          ))}
        </div>
        {rankVend.length>0&&(
          <div className="card" style={{marginBottom:20}}>
            <h3 className="card-title" style={{marginBottom:16}}>🎯 Planejado x Realizado — {fmtMesLbl(fMes)||'Todos os meses'}</h3>
            <div style={{overflowX:'auto'}}>
              <table className="admin-table" style={{minWidth:700}}>
                <thead><tr><th>#</th><th>Vendedor</th><th>Clientes</th><th style={{color:'#f59e0b'}}>Meta Adesao</th><th style={{color:'#00d4ff'}}>Realiz. Adesao</th><th>%</th><th style={{color:'#f59e0b'}}>Meta Mensal</th><th style={{color:'#10b981'}}>Realiz. Mensal</th><th>%</th></tr></thead>
                <tbody>
                  {rankVend.sort((a,b)=>b.rM-a.rM).map((v,i)=>(
                    <tr key={v.id} className="table-row">
                      <td style={{fontSize:16}}>{i===0?'🥇':i===1?'🥈':i===2?'🥉':'#'+(i+1)}</td>
                      <td style={{fontWeight:600,color:'#e2e8f0',fontSize:13}}>{v.nome}</td>
                      <td style={{color:'#94a3b8',fontSize:13}}>{v.qtd}</td>
                      <td style={{color:'#f59e0b',fontSize:13}}>{v.mA>0?fmt(v.mA):'-'}</td>
                      <td style={{color:'#00d4ff',fontWeight:600,fontSize:13}}>{fmt(v.rA)}</td>
                      <td><Barra val={v.pA}/></td>
                      <td style={{color:'#f59e0b',fontSize:13}}>{v.mM>0?fmt(v.mM):'-'}</td>
                      <td style={{color:'#10b981',fontWeight:600,fontSize:13}}>{fmt(v.rM)}</td>
                      <td><Barra val={v.pM}/></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
        <div className="table-wrap">
          <table className="admin-table">
            <thead><tr><th>Empresa</th><th>Vendedor</th><th>Plano</th><th>Status</th><th>Adesao</th><th>Mensalidade</th><th>Pagamento</th><th>Cadastro</th></tr></thead>
            <tbody>
              {filtrados.length===0?<tr><td colSpan={8} style={{textAlign:'center',color:'#475569',padding:'40px'}}>Nenhuma venda no periodo.</td></tr>
              :filtrados.map(t=>{
                const plano=planos.find(p=>p.id===t.plano)
                const status=STATUS_TENANT.find(s=>s.id===t.status)
                const vend=vendedores.find(v=>v.id===t.vendedorId)
                const pagto=t.pagamentoStatus||'pendente'
                const pCor={pago:'#10b981',pendente:'#f59e0b',atrasado:'#ef4444'}[pagto]||'#64748b'
                return(
                  <tr key={t.id} className="table-row">
                    <td><div style={{fontWeight:600,color:'#e2e8f0',fontSize:13}}>{t.nomeEmpresa}</div><div style={{fontSize:11,color:'#475569'}}>{t.emailAdmin}</div></td>
                    <td style={{fontSize:12,color:'#94a3b8'}}>{vend?.nome||'-'}</td>
                    <td><span className="badge" style={{background:plano?.cor+'22',color:plano?.cor,border:'1px solid '+plano?.cor+'44'}}>{plano?.name||t.plano}</span></td>
                    <td><span className="badge" style={{background:status?.cor+'22',color:status?.cor,border:'1px solid '+status?.cor+'44'}}>{status?.label}</span></td>
                    <td style={{color:'#94a3b8',fontSize:13}}>{t.adesao?fmt(t.adesao):'-'}</td>
                    <td style={{color:'#10b981',fontWeight:600,fontSize:13}}>{t.mensalidade?fmt(t.mensalidade):'-'}</td>
                    <td>
                      <select value={pagto} onChange={async e=>onAtualizarPagto({...t,pagamentoStatus:e.target.value})}
                        style={{background:pCor+'22',border:'1px solid '+pCor+'66',borderRadius:6,color:pCor,fontSize:11,padding:'3px 8px',fontFamily:'DM Mono,monospace',cursor:'pointer',outline:'none'}}>
                        <option value="pago">✅ Pago</option><option value="pendente">⏳ Pendente</option><option value="atrasado">⚠️ Atrasado</option>
                      </select>
                    </td>
                    <td style={{fontSize:12,color:'#94a3b8'}}>{t.criadoEm?new Date(t.criadoEm).toLocaleDateString('pt-BR'):'-'}</td>
                  </tr>
                )
              })}
            </tbody>
            {filtrados.length>0&&(
              <tfoot><tr>
                <td colSpan={4} style={{padding:'12px 16px',fontSize:12,color:'#64748b',fontWeight:600}}>TOTAIS — {filtrados.length} cliente(s)</td>
                <td style={{padding:'12px 16px',color:'#94a3b8',fontWeight:700,fontSize:13}}>{fmt(totAdes)}</td>
                <td style={{padding:'12px 16px',color:'#10b981',fontWeight:700,fontSize:13}}>{fmt(totMens)}/mes</td>
                <td style={{padding:'12px 16px',fontSize:11}}><span style={{color:'#10b981'}}>Pago: {fmt(totPago)}</span><br/><span style={{color:'#f59e0b'}}>Pendente: {fmt(totPend)}</span></td>
                <td/>
              </tr></tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  )
}

// ══════════ RELATORIO DE COMISSOES ══════════
function RelatorioComissoes({tenants,vendedores,planos,usuarioLogado}){
  const [fVend,setFVend]=useState(usuarioLogado?.tipo==='vendedor'?usuarioLogado.id:'')
  const [fMes,setFMes]=useState(mesAtual())

  const meses=[...new Set(tenants.filter(t=>t.criadoEm).map(t=>t.criadoEm.slice(0,7)))].sort((a,b)=>b.localeCompare(a))
  if(!meses.includes(mesAtual()))meses.unshift(mesAtual())

  const dadosVends=vendedores.filter(v=>!fVend||v.id===fVend).map(v=>{
    const pA=Number(v.comissaoAdesao||0)/100
    const pM=Number(v.comissaoMensal||0)/100
    const mRec=Number(v.recorrenciaMeses||0)
    const clientes=tenants.filter(t=>{const mes=t.criadoEm?.slice(0,7)||'';return t.vendedorId===v.id&&(!fMes||mes===fMes)})
    const linhas=clientes.map(t=>{
      const aB=Number(t.adesao||0),mB=Number(t.mensalidade||0)
      const cAP=aB*pA,cMP=mB*pM
      const pago=t.pagamentoStatus==='pago'
      return{tenant:t,aB,mB,cAP,cMP,cAR:pago?cAP:0,cMR:pago?cMP:0}
    })
    const tPA=linhas.reduce((a,l)=>a+l.cAP,0),tPM=linhas.reduce((a,l)=>a+l.cMP,0)
    const tRA=linhas.reduce((a,l)=>a+l.cAR,0),tRM=linhas.reduce((a,l)=>a+l.cMR,0)
    const tP=tPA+tPM,tR=tRA+tRM,pct=tP>0?(tR/tP*100):0
    return{...v,linhas,tPA,tPM,tRA,tRM,tP,tR,pct,mRec}
  }).filter(v=>v.linhas.length>0)

  const gP=dadosVends.reduce((a,v)=>a+v.tP,0)
  const gR=dadosVends.reduce((a,v)=>a+v.tR,0)

  function dadosExp(){
    const rows=[]
    dadosVends.forEach(v=>{v.linhas.forEach(l=>{
      rows.push({Vendedor:v.nome,Empresa:l.tenant.nomeEmpresa,Plano:planos.find(p=>p.id===l.tenant.plano)?.name||l.tenant.plano,Adesao_Bruta:l.aB.toFixed(2),Mensal_Bruta:l.mB.toFixed(2),Pagamento:l.tenant.pagamentoStatus||'pendente',Com_Ades_Plan:l.cAP.toFixed(2),Com_Mens_Plan:l.cMP.toFixed(2),Com_Ades_Real:l.cAR.toFixed(2),Com_Mens_Real:l.cMR.toFixed(2),Recorrencia:Number(v.mRec)===0?'Indefinida':v.mRec+' mes(es)'})
    })})
    return rows
  }

  const EXP_ID='rel-com-print'

  return(
    <div>
      <div className="page-header">
        <div><h1 className="page-title">Comissoes</h1><p className="page-sub">Planejado x Realizado por vendedor e cliente</p></div>
        <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
          <button onClick={()=>exportarPDF(EXP_ID)} className="btn-secondary" style={{fontSize:12,padding:'8px 14px'}}>🖨️ PDF</button>
          <button onClick={()=>exportarExcel(dadosExp(),'comissoes')} className="btn-secondary" style={{fontSize:12,padding:'8px 14px'}}>📊 Excel</button>
          <button onClick={()=>exportarCSV(dadosExp(),'comissoes')} className="btn-secondary" style={{fontSize:12,padding:'8px 14px'}}>📄 CSV</button>
          <button onClick={()=>exportarTXT(dadosExp(),'comissoes')} className="btn-secondary" style={{fontSize:12,padding:'8px 14px'}}>📝 TXT</button>
        </div>
      </div>
      <div className="filtros-bar">
        <select className="select-filtro" value={fMes} onChange={e=>setFMes(e.target.value)}><option value="">Todos os meses</option>{meses.map(m=><option key={m} value={m}>{fmtMesLbl(m)}</option>)}</select>
        {usuarioLogado?.tipo!=='vendedor'&&(<select className="select-filtro" value={fVend} onChange={e=>setFVend(e.target.value)}><option value="">Todos os vendedores</option>{vendedores.map(v=><option key={v.id} value={v.id}>{v.nome}</option>)}</select>)}
      </div>
      <div className="stats-grid" style={{gridTemplateColumns:'repeat(4,1fr)',marginBottom:20}}>
        {[{label:'Comissao Planejada',valor:fmt(gP),icon:'📋',cor:'#f59e0b'},{label:'Comissao Realizada',valor:fmt(gR),icon:'✅',cor:'#10b981'},{label:'% Realizado',valor:gP>0?(gR/gP*100).toFixed(0)+'%':'-',icon:'📊',cor:'#00d4ff'},{label:'A Receber',valor:fmt(gP-gR),icon:'⏳',cor:'#7c3aed'}].map((s,i)=>(
          <div key={i} className="stat-card" style={{'--cor':s.cor}}><div className="stat-icon">{s.icon}</div><div className="stat-val" style={{color:s.cor,fontSize:18}}>{s.valor}</div><div className="stat-label">{s.label}</div></div>
        ))}
      </div>
      <div id={EXP_ID}>
        {dadosVends.length===0?<div style={{textAlign:'center',color:'#475569',padding:'60px',fontSize:13}}>🏆 Nenhuma comissao no periodo.</div>
        :dadosVends.map(v=>(
          <div key={v.id} className="card" style={{marginBottom:20}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:12,flexWrap:'wrap',gap:12}}>
              <div>
                <div style={{fontFamily:'Syne,sans-serif',fontWeight:800,fontSize:16,color:'#e2e8f0'}}>👔 {v.nome}</div>
                <div style={{fontSize:11,color:'#475569',marginTop:4,lineHeight:1.7}}>
                  Comissao Adesao: <span style={{color:'#00d4ff',fontWeight:600}}>{fmtPct(v.comissaoAdesao||0)}</span>
                  {' · '}Comissao Mensal: <span style={{color:'#7c3aed',fontWeight:600}}>{fmtPct(v.comissaoMensal||0)}</span>
                  {' · '}Recorrencia: <span style={{color:'#f59e0b',fontWeight:600}}>{Number(v.mRec)===0?'♾️ Indefinida':v.mRec+' mes(es)'}</span>
                </div>
              </div>
              <div style={{display:'flex',gap:16}}>
                {[{lbl:'PLANEJADO',val:fmt(v.tP),cor:'#f59e0b'},{lbl:'REALIZADO',val:fmt(v.tR),cor:'#10b981'},{lbl:'A RECEBER',val:fmt(v.tP-v.tR),cor:'#7c3aed'}].map((x,i)=>(
                  <div key={i} style={{textAlign:'right'}}><div style={{fontSize:10,color:'#475569',letterSpacing:.5}}>{x.lbl}</div><div style={{fontSize:15,fontWeight:700,color:x.cor}}>{x.val}</div></div>
                ))}
              </div>
            </div>
            {v.tP>0&&(
              <div style={{marginBottom:16}}>
                <div style={{display:'flex',justifyContent:'space-between',fontSize:11,color:'#64748b',marginBottom:4}}>
                  <span>Progresso</span>
                  <span style={{color:v.pct>=100?'#10b981':v.pct>=50?'#f59e0b':'#ef4444',fontWeight:600}}>{v.pct.toFixed(0)}%</span>
                </div>
                <div style={{background:'#1a2540',borderRadius:6,height:8}}>
                  <div style={{background:'linear-gradient(90deg,'+(v.pct>=100?'#10b981':'#f59e0b')+',#00d4ff)',width:Math.min(v.pct,100)+'%',height:'100%',borderRadius:6,transition:'width .5s'}}/>
                </div>
              </div>
            )}
            <div style={{overflowX:'auto'}}>
              <table className="admin-table" style={{minWidth:900}}>
                <thead><tr><th>Empresa</th><th>Plano</th><th>Adesao</th><th>Mensal</th><th>Pagamento</th><th style={{color:'#f59e0b'}}>Com.Ades.Plan.</th><th style={{color:'#f59e0b'}}>Com.Mens.Plan.</th><th style={{color:'#10b981'}}>Com.Ades.Real.</th><th style={{color:'#10b981'}}>Com.Mens.Real.</th></tr></thead>
                <tbody>
                  {v.linhas.map(l=>{
                    const plano=planos.find(p=>p.id===l.tenant.plano)
                    const pagto=l.tenant.pagamentoStatus||'pendente'
                    const pInfo={pago:{cor:'#10b981',lbl:'✅ Pago'},pendente:{cor:'#f59e0b',lbl:'⏳ Pendente'},atrasado:{cor:'#ef4444',lbl:'⚠️ Atrasado'}}[pagto]||{cor:'#64748b',lbl:'-'}
                    return(
                      <tr key={l.tenant.id} className="table-row">
                        <td><div style={{fontWeight:600,color:'#e2e8f0',fontSize:12}}>{l.tenant.nomeEmpresa}</div><div style={{fontSize:10,color:'#475569'}}>{l.tenant.criadoEm?new Date(l.tenant.criadoEm).toLocaleDateString('pt-BR'):''}</div></td>
                        <td><span className="badge" style={{background:plano?.cor+'22',color:plano?.cor,border:'1px solid '+plano?.cor+'44'}}>{plano?.name||l.tenant.plano}</span></td>
                        <td style={{color:'#94a3b8',fontSize:12}}>{l.aB?fmt(l.aB):'-'}</td>
                        <td style={{color:'#94a3b8',fontSize:12}}>{l.mB?fmt(l.mB)+'/mes':'-'}</td>
                        <td><span style={{fontSize:11,color:pInfo.cor,fontWeight:600}}>{pInfo.lbl}</span></td>
                        <td style={{color:l.cAP>0?'#f59e0b':'#334155',fontSize:12,fontWeight:l.cAP>0?600:400}}>{l.cAP>0?fmt(l.cAP):'-'}</td>
                        <td style={{color:l.cMP>0?'#f59e0b':'#334155',fontSize:12,fontWeight:l.cMP>0?600:400}}>{l.cMP>0?fmt(l.cMP)+'/mes':'-'}</td>
                        <td style={{color:l.cAR>0?'#10b981':'#334155',fontSize:12,fontWeight:l.cAR>0?700:400}}>{l.cAR>0?fmt(l.cAR):'-'}</td>
                        <td style={{color:l.cMR>0?'#10b981':'#334155',fontSize:12,fontWeight:l.cMR>0?700:400}}>{l.cMR>0?fmt(l.cMR)+'/mes':'-'}</td>
                      </tr>
                    )
                  })}
                </tbody>
                <tfoot><tr>
                  <td colSpan={5} style={{padding:'10px 16px',fontSize:11,color:'#64748b',fontWeight:600}}>SUBTOTAL {v.nome.toUpperCase()} · {v.linhas.length} cliente(s)</td>
                  <td style={{padding:'10px 16px',color:'#f59e0b',fontWeight:700,fontSize:12}}>{fmt(v.tPA)}</td>
                  <td style={{padding:'10px 16px',color:'#f59e0b',fontWeight:700,fontSize:12}}>{fmt(v.tPM)}/mes</td>
                  <td style={{padding:'10px 16px',color:'#10b981',fontWeight:700,fontSize:12}}>{fmt(v.tRA)}</td>
                  <td style={{padding:'10px 16px',color:'#10b981',fontWeight:700,fontSize:12}}>{fmt(v.tRM)}/mes</td>
                </tr></tfoot>
              </table>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ══════════ MODAL TENANT ══════════
function ModalTenant({tenant,planos,vendedores,masterCfg,onSave,onClose,saving}){
  const isNovo=!tenant
  const [abaM,setAbaM]=useState('dados')
  const [nome,setNome]=useState(tenant?.nomeEmpresa||'')
  const [cnpj,setCnpj]=useState(tenant?.cnpj||'')
  const [email,setEmail]=useState(tenant?.emailAdmin||'')
  const [senha,setSenha]=useState(isNovo?gerarSenha():'')
  const [tel,setTel]=useState(tenant?.telefone||'')
  const [resp,setResp]=useState(tenant?.responsavel||'')
  const [vendId,setVendId]=useState(tenant?.vendedorId||'')
  const [plano,setPlano]=useState(tenant?.plano||'basic')
  const [status,setStatus]=useState(tenant?.status||'trial')
  const [maxUsu,setMaxUsu]=useState(tenant?.maxUsuarios||3)
  const [mensal,setMensal]=useState(tenant?.mensalidade||'')
  const [adesao,setAdesao]=useState(tenant?.adesao||'')
  const [venc,setVenc]=useState(tenant?.vencimento||calcVenc(30))
  const [mods,setMods]=useState(tenant?.modulosLiberados||MODULOS_POR_PLANO['basic'])
  const [obs,setObs]=useState(tenant?.obs||'')
  const [asaas,setAsaas]=useState(isNovo&&!!masterCfg?.asaasKey)
  const [billing,setBilling]=useState('BOLETO')
  const [sendMail,setSendMail]=useState(isNovo)
  const [visible,setVisible]=useState(false)
  const [copiado,setCopiado]=useState('')

  function changePlano(p){
    setPlano(p)
    const pl=planos.find(x=>x.id===p)
    if(pl){setMaxUsu(pl.maxUsuarios===999?999:pl.maxUsuarios);if(pl.mensalidade)setMensal(pl.mensalidade);if(pl.adesao)setAdesao(pl.adesao)}
    setMods(MODULOS_POR_PLANO[p]||[])
  }
  function toggleMod(id){setMods(prev=>prev.includes(id)?prev.filter(m=>m!==id):[...prev,id])}
  function toggleGrupo(grupo){
    const ids=TODOS_MODULOS.filter(m=>m.grupo===grupo).map(m=>m.id)
    const all=ids.every(id=>mods.includes(id))
    setMods(prev=>all?prev.filter(m=>!ids.includes(m)):[...new Set([...prev,...ids])])
  }
  function copiar(texto,campo){
    navigator.clipboard.writeText(texto)
    setCopiado(campo);setTimeout(()=>setCopiado(''),2000)
  }
  function salvar(){
    if(!nome.trim()){alert('Informe o nome da empresa.');return}
    if(!email.trim()){alert('Informe o e-mail.');return}
    if(isNovo&&!senha.trim()){alert('Defina uma senha.');return}
    onSave({
      id:tenant?.id,empresaId:tenant?.empresaId,
      nomeEmpresa:nome.trim(),cnpj:cnpj.trim(),emailAdmin:email.trim().toLowerCase(),
      senha:isNovo?senha:undefined,senhaInicial:isNovo?senha:(tenant?.senhaInicial),
      telefone:tel.trim(),responsavel:resp.trim(),vendedorId:vendId,
      plano,status,maxUsuarios:Number(maxUsu),
      mensalidade:Number(String(mensal).replace(',','.')),
      adesao:Number(String(adesao).replace(',','.')),
      vencimento:venc,modulosLiberados:mods,obs:obs.trim(),
      criarAsaas:asaas,billingType:billing,sendEmail:sendMail,
      criadoEm:tenant?.criadoEm||new Date().toISOString(),
      pagamentoStatus:tenant?.pagamentoStatus||'pendente',
      asaasCustomerId:tenant?.asaasCustomerId,
    })
  }

  return(
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" style={{maxWidth:740,maxHeight:'92vh',overflowY:'auto'}} onClick={e=>e.stopPropagation()}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:20}}>
          <h2 style={{fontFamily:'Syne,sans-serif',fontSize:18,color:'#00d4ff'}}>{isNovo?'🏢 Novo Cliente':'✏️ '+tenant.nomeEmpresa}</h2>
          <button onClick={onClose} style={{background:'none',border:'none',color:'#64748b',fontSize:20,cursor:'pointer'}}>✕</button>
        </div>
        <div style={{display:'flex',gap:6,marginBottom:20,borderBottom:'1px solid #1e2d4a',paddingBottom:12}}>
          {[{id:'dados',lbl:'📋 Dados'},{id:'plano',lbl:'📦 Plano'},{id:'modulos',lbl:'🔐 Modulos'},{id:'acesso',lbl:'🔑 Acesso'}].map(a=>(
            <button key={a.id} onClick={()=>setAbaM(a.id)} style={{padding:'6px 14px',borderRadius:6,border:'none',cursor:'pointer',fontSize:12,background:abaM===a.id?'#00d4ff22':'transparent',color:abaM===a.id?'#00d4ff':'#64748b',fontFamily:'DM Mono,monospace'}}>{a.lbl}</button>
          ))}
        </div>

        {abaM==='dados'&&(
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:14}}>
            <div className="field" style={{gridColumn:'1/-1'}}><label>Nome da Empresa *</label><input value={nome} onChange={e=>setNome(e.target.value)} placeholder="Ex: Contabilidade ABC Ltda"/></div>
            <div className="field"><label>CNPJ</label><input value={cnpj} onChange={e=>setCnpj(e.target.value)} placeholder="00.000.000/0001-00"/></div>
            <div className="field"><label>Responsavel</label><input value={resp} onChange={e=>setResp(e.target.value)}/></div>
            <div className="field"><label>E-mail Admin *</label><input type="email" value={email} onChange={e=>setEmail(e.target.value)}/></div>
            <div className="field"><label>Telefone</label><input value={tel} onChange={e=>setTel(e.target.value)} placeholder="(11) 9 9999-9999"/></div>
            <div className="field" style={{gridColumn:'1/-1'}}><label>👔 Vendedor responsavel pela venda</label>
              <select value={vendId} onChange={e=>setVendId(e.target.value)}>
                <option value="">— Selecionar vendedor —</option>
                {vendedores.filter(v=>v.ativo!==false).map(v=><option key={v.id} value={v.id}>{v.nome} ({v.email})</option>)}
              </select>
            </div>
            <div className="field" style={{gridColumn:'1/-1'}}><label>Observacoes internas</label>
              <textarea value={obs} onChange={e=>setObs(e.target.value)} rows={3} style={{width:'100%',background:'#1a2540',border:'1px solid #1e2d4a',borderRadius:8,padding:'9px 12px',color:'#e2e8f0',fontFamily:'DM Mono,monospace',fontSize:13,resize:'vertical'}}/>
            </div>
          </div>
        )}

        {abaM==='plano'&&(
          <div>
            <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:10,marginBottom:20}}>
              {planos.map(p=>(
                <button key={p.id} onClick={()=>changePlano(p.id)} style={{padding:'12px 10px',borderRadius:10,border:'2px solid '+(plano===p.id?p.cor:'#1e2d4a'),background:plano===p.id?p.cor+'22':'#111827',color:plano===p.id?p.cor:'#64748b',cursor:'pointer',fontFamily:'Syne,sans-serif',fontWeight:700,fontSize:13}}>
                  {p.name}<div style={{fontSize:10,marginTop:4,fontFamily:'DM Mono,monospace',fontWeight:400}}>{p.maxUsuarios===999?'ilimitado':'ate '+p.maxUsuarios+' usr'}</div>
                  {p.mensalidade>0&&<div style={{fontSize:11,marginTop:2}}>{fmt(p.mensalidade)}/mes</div>}
                </button>
              ))}
            </div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:14}}>
              <div className="field"><label>Status</label><select value={status} onChange={e=>setStatus(e.target.value)}>{STATUS_TENANT.map(s=><option key={s.id} value={s.id}>{s.label}</option>)}</select></div>
              <div className="field"><label>Max. Usuarios</label><input type="number" min={1} value={maxUsu} onChange={e=>setMaxUsu(e.target.value)}/></div>
              <div className="field"><label>Valor Adesao (R$)</label><input type="number" step="0.01" min="0" value={adesao} onChange={e=>setAdesao(e.target.value)} placeholder="0,00"/></div>
              <div className="field"><label>Mensalidade (R$)</label><input type="number" step="0.01" min="0" value={mensal} onChange={e=>setMensal(e.target.value)} placeholder="0,00"/></div>
              <div className="field" style={{gridColumn:'1/-1'}}><label>Vencimento / Renovacao</label><input type="date" value={venc} onChange={e=>setVenc(e.target.value)}/></div>
            </div>
            <div style={{marginTop:12}}>
              <label style={{fontSize:12,color:'#64748b',display:'block',marginBottom:8}}>⚡ Atalhos</label>
              <div style={{display:'flex',gap:8}}>{[7,14,30,90,365].map(d=><button key={d} onClick={()=>setVenc(calcVenc(d))} style={{padding:'5px 12px',background:'#1a2540',border:'1px solid #1e2d4a',borderRadius:6,color:'#94a3b8',fontSize:11,cursor:'pointer',fontFamily:'DM Mono,monospace'}}>+{d}d</button>)}</div>
            </div>
            {masterCfg?.asaasKey&&(
              <div style={{marginTop:20,padding:16,background:'#0d1526',borderRadius:10,border:'1px solid #1e2d4a'}}>
                <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:12}}>
                  <span style={{fontSize:13,color:'#e2e8f0',fontWeight:600}}>🏦 Asaas</span>
                  <label style={{display:'flex',alignItems:'center',gap:8,cursor:'pointer'}}><input type="checkbox" checked={asaas} onChange={e=>setAsaas(e.target.checked)}/><span style={{fontSize:12,color:'#94a3b8'}}>Criar cliente + assinatura</span></label>
                </div>
                {asaas&&<div className="field"><label>Forma de pagamento</label><select value={billing} onChange={e=>setBilling(e.target.value)}><option value="BOLETO">Boleto</option><option value="PIX">PIX</option><option value="CREDIT_CARD">Cartao</option><option value="UNDEFINED">Cliente escolhe</option></select></div>}
              </div>
            )}
          </div>
        )}

        {abaM==='modulos'&&(
          <div>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:16}}>
              <span style={{fontSize:12,color:'#64748b'}}>{mods.length}/{TODOS_MODULOS.length} modulos liberados</span>
              <div style={{display:'flex',gap:8}}>
                <button onClick={()=>setMods(TODOS_MODULOS.map(m=>m.id))} style={{padding:'4px 10px',background:'#10b98122',border:'1px solid #10b98144',borderRadius:6,color:'#10b981',fontSize:11,cursor:'pointer',fontFamily:'DM Mono,monospace'}}>Todos</button>
                <button onClick={()=>setMods([])} style={{padding:'4px 10px',background:'#ef444422',border:'1px solid #ef444444',borderRadius:6,color:'#ef4444',fontSize:11,cursor:'pointer',fontFamily:'DM Mono,monospace'}}>Nenhum</button>
              </div>
            </div>
            {GRUPOS.map(grupo=>{
              const gMs=TODOS_MODULOS.filter(m=>m.grupo===grupo)
              const all=gMs.every(m=>mods.includes(m.id))
              return(
                <div key={grupo} style={{marginBottom:20}}>
                  <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:10}}>
                    <span style={{fontSize:12,color:'#94a3b8',fontWeight:600}}>{grupo}</span>
                    <button onClick={()=>toggleGrupo(grupo)} style={{padding:'2px 8px',background:all?'#00d4ff22':'#1a2540',border:'1px solid '+(all?'#00d4ff44':'#1e2d4a'),borderRadius:4,color:all?'#00d4ff':'#475569',fontSize:10,cursor:'pointer',fontFamily:'DM Mono,monospace'}}>{all?'desmarcar':'marcar'}</button>
                  </div>
                  <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:6}}>
                    {gMs.map(mod=>{const at=mods.includes(mod.id);return(
                      <div key={mod.id} onClick={()=>toggleMod(mod.id)} style={{display:'flex',alignItems:'center',gap:10,padding:'9px 12px',borderRadius:8,border:'1px solid '+(at?'#00d4ff44':'#1e2d4a'),background:at?'#00d4ff0d':'#111827',cursor:'pointer'}}>
                        <div style={{width:15,height:15,borderRadius:3,border:'2px solid '+(at?'#00d4ff':'#334155'),background:at?'#00d4ff':'transparent',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>{at&&<span style={{fontSize:9,color:'#000',fontWeight:900}}>✓</span>}</div>
                        <span style={{fontSize:11,color:at?'#e2e8f0':'#64748b'}}>{mod.label}</span>
                      </div>
                    )})}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {abaM==='acesso'&&(
          <div style={{display:'flex',flexDirection:'column',gap:16}}>
            {/* Credenciais existentes (edicao) */}
            {!isNovo&&tenant?.emailAdmin&&(
              <div style={{padding:16,background:'#0d1526',borderRadius:10,border:'1px solid #1e2d4a'}}>
                <h3 style={{fontSize:13,color:'#e2e8f0',marginBottom:14}}>🔑 Credenciais do Cliente</h3>
                <div style={{display:'grid',gridTemplateColumns:'1fr auto',gap:8,alignItems:'center',marginBottom:12}}>
                  <div>
                    <div style={{fontSize:10,color:'#475569',marginBottom:4}}>LOGIN (E-MAIL)</div>
                    <div style={{fontSize:13,color:'#00d4ff',fontFamily:'DM Mono,monospace',background:'#060c1a',padding:'8px 12px',borderRadius:6,border:'1px solid #1e2d4a'}}>{tenant.emailAdmin}</div>
                  </div>
                  <button onClick={()=>copiar(tenant.emailAdmin,'email')} style={{padding:'8px 12px',background:copiado==='email'?'#10b98122':'#1a2540',border:'1px solid #1e2d4a',borderRadius:6,color:copiado==='email'?'#10b981':'#64748b',cursor:'pointer',fontSize:12,fontFamily:'DM Mono,monospace',marginTop:18}}>
                    {copiado==='email'?'✅':'📋'}
                  </button>
                </div>
                {tenant.senhaInicial?(
                  <div style={{display:'grid',gridTemplateColumns:'1fr auto',gap:8,alignItems:'center'}}>
                    <div>
                      <div style={{fontSize:10,color:'#475569',marginBottom:4}}>SENHA INICIAL</div>
                      <div style={{fontSize:13,color:'#f59e0b',fontFamily:'DM Mono,monospace',background:'#060c1a',padding:'8px 12px',borderRadius:6,border:'1px solid #1e2d4a',letterSpacing:1}}>{visible?tenant.senhaInicial:'••••••••••'}</div>
                    </div>
                    <div style={{display:'flex',gap:6,marginTop:18}}>
                      <button onClick={()=>setVisible(!visible)} style={{padding:'8px 10px',background:'#1a2540',border:'1px solid #1e2d4a',borderRadius:6,color:'#64748b',cursor:'pointer',fontSize:12}}>{visible?'🙈':'👁️'}</button>
                      <button onClick={()=>copiar(tenant.senhaInicial,'senha')} style={{padding:'8px 10px',background:copiado==='senha'?'#10b98122':'#1a2540',border:'1px solid #1e2d4a',borderRadius:6,color:copiado==='senha'?'#10b981':'#64748b',cursor:'pointer',fontSize:12}}>{copiado==='senha'?'✅':'📋'}</button>
                    </div>
                  </div>
                ):(
                  <div style={{marginTop:8,padding:10,background:'rgba(245,158,11,.07)',border:'1px solid rgba(245,158,11,.2)',borderRadius:8,fontSize:11,color:'#f59e0b'}}>⚠️ Senha nao armazenada (cadastro antigo). Para redefinir, use "Esqueci minha senha" no login.</div>
                )}
                <div style={{marginTop:12,padding:10,background:'rgba(0,212,255,.06)',border:'1px solid rgba(0,212,255,.15)',borderRadius:8,fontSize:11,color:'#64748b',lineHeight:1.6}}>
                  🌐 URL de acesso: <a href={masterCfg?.siteUrl} target="_blank" rel="noreferrer" style={{color:'#00d4ff'}}>{masterCfg?.siteUrl||'vivanexa-saas.vercel.app'}</a>
                </div>
              </div>
            )}
            {/* Credenciais novo cliente */}
            {isNovo&&(
              <div style={{padding:16,background:'#0d1526',borderRadius:10,border:'1px solid #1e2d4a'}}>
                <h3 style={{fontSize:13,color:'#e2e8f0',marginBottom:14}}>🔑 Definir Credenciais</h3>
                <div className="field" style={{marginBottom:12}}><label>Login (E-mail)</label><input value={email} readOnly style={{opacity:.7}}/></div>
                <div className="field">
                  <label>Senha inicial</label>
                  <div style={{position:'relative'}}>
                    <input type={visible?'text':'password'} value={senha} onChange={e=>setSenha(e.target.value)}
                      style={{width:'100%',background:'#1a2540',border:'1px solid #1e2d4a',borderRadius:8,padding:'9px 44px 9px 12px',color:'#e2e8f0',fontFamily:'DM Mono,monospace',fontSize:13,outline:'none'}}/>
                    <button onClick={()=>setVisible(!visible)} style={{position:'absolute',right:10,top:'50%',transform:'translateY(-50%)',background:'none',border:'none',cursor:'pointer',fontSize:14}}>{visible?'🙈':'👁️'}</button>
                  </div>
                </div>
                <button onClick={()=>setSenha(gerarSenha())} style={{marginTop:8,padding:'5px 12px',background:'#1a2540',border:'1px solid #1e2d4a',borderRadius:6,color:'#94a3b8',fontSize:11,cursor:'pointer',fontFamily:'DM Mono,monospace'}}>🔄 Gerar senha aleatoria</button>
                <div style={{marginTop:12,padding:10,background:'rgba(239,68,68,.07)',border:'1px solid rgba(239,68,68,.2)',borderRadius:8,fontSize:11,color:'#ef4444',lineHeight:1.5}}>⚠️ Esta senha sera enviada ao cliente por e-mail e ficara salva para consulta futura.</div>
              </div>
            )}
            {/* E-mail de boas-vindas */}
            <div style={{padding:16,background:'#0d1526',borderRadius:10,border:'1px solid #1e2d4a'}}>
              <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:12}}>
                <h3 style={{fontSize:13,color:'#e2e8f0'}}>📧 E-mail de Boas-vindas / Credenciais</h3>
                <label style={{display:'flex',alignItems:'center',gap:8,cursor:'pointer'}}>
                  <input type="checkbox" checked={sendMail} onChange={e=>setSendMail(e.target.checked)}/>
                  <span style={{fontSize:12,color:'#94a3b8'}}>{isNovo?'Enviar ao cadastrar':'Reenviar credenciais'}</span>
                </label>
              </div>
              {sendMail&&(
                <div style={{padding:12,background:'#111827',borderRadius:8,fontSize:12,color:'#64748b',lineHeight:1.7}}>
                  <div style={{color:'#94a3b8',marginBottom:4}}>Previa:</div>
                  <div style={{color:'#e2e8f0'}}>Para: <strong>{email}</strong></div>
                  <div style={{color:'#e2e8f0',marginTop:4}}>Assunto: <strong>Bem-vindo(a) a Vivanexa — Seus dados de acesso</strong></div>
                  <div style={{marginTop:8,padding:10,background:'#0d1526',borderRadius:6}}>
                    <div>Ola <strong style={{color:'#94a3b8'}}>{resp||nome||'[nome]'}</strong>, seu acesso foi criado!</div>
                    <div>🌐 {masterCfg?.siteUrl||'vivanexa-saas.vercel.app'}</div>
                    <div>👤 {email||'[email]'}</div>
                    <div>🔑 {isNovo?senha:'[senha enviada no cadastro]'}</div>
                  </div>
                </div>
              )}
              {!masterCfg?.smtpHost&&<div style={{marginTop:10,padding:10,background:'rgba(245,158,11,.07)',border:'1px solid rgba(245,158,11,.2)',borderRadius:8,fontSize:11,color:'#f59e0b'}}>⚠️ SMTP nao configurado em Config.</div>}
            </div>
          </div>
        )}

        <div style={{display:'flex',justifyContent:'flex-end',gap:10,marginTop:24,paddingTop:16,borderTop:'1px solid #1e2d4a'}}>
          <button className="btn-secondary" onClick={onClose}>Cancelar</button>
          <button className="btn-primary" disabled={saving} onClick={salvar}>{saving?'⏳ Processando...':isNovo?'✅ Cadastrar Cliente':'✅ Salvar Alteracoes'}</button>
        </div>
      </div>
    </div>
  )
}

// ══════════ CONFIG MASTER COMPLETA ══════════
function ConfigMaster({masterCfg,onSave}){
  const [abaConf,setAbaConf]=useState('smtp')
  const [smtpHost,setSmtpHost]=useState(masterCfg?.smtpHost||'')
  const [smtpPort,setSmtpPort]=useState(masterCfg?.smtpPort||'587')
  const [smtpUser,setSmtpUser]=useState(masterCfg?.smtpUser||'')
  const [smtpPass,setSmtpPass]=useState(masterCfg?.smtpPass||'')
  const [smtpFrom,setSmtpFrom]=useState(masterCfg?.smtpFrom||'')
  const [asaasKey,setAsaasKey]=useState(masterCfg?.asaasKey||'')
  const [sandbox,setSandbox]=useState(masterCfg?.asaasSandbox??true)
  const [siteUrl,setSiteUrl]=useState(masterCfg?.siteUrl||'https://vivanexa-saas.vercel.app')
  const [linkPag,setLinkPag]=useState(masterCfg?.linkPagamento||'')
  const [cronSec,setCronSec]=useState(masterCfg?.cronSecret||'')
  const [wppUrl,setWppUrl]=useState(masterCfg?.wppApiUrl||'')
  const [wppTok,setWppTok]=useState(masterCfg?.wppToken||'')
  const [tplBv,setTplBv]=useState(masterCfg?.emailTemplates?.boasVindas||'')
  const [tplCob,setTplCob]=useState(masterCfg?.emailTemplates?.cobranca||'')
  const [tplWpp,setTplWpp]=useState(masterCfg?.wppTemplates?.cobranca||'')
  const reguaIni=masterCfg?.reguaCobranca?.length?masterCfg.reguaCobranca:REGUA_PADRAO
  const [regua,setRegua]=useState(reguaIni)
  const [saving,setSaving]=useState(false)
  const [testing,setTesting]=useState(false)
  const [testMsg,setTestMsg]=useState('')

  function updR(i,k,v){setRegua(r=>r.map((x,j)=>j===i?{...x,[k]:v}:x))}
  function togCanal(i,c){setRegua(r=>r.map((x,j)=>j===i?{...x,canal:x.canal.includes(c)?x.canal.filter(v=>v!==c):[...x.canal,c]}:x))}
  function addEtapa(){setRegua(r=>[...r,{diasAposVenc:r.length>0?r[r.length-1].diasAposVenc+5:2,canal:['email'],assunto:'Lembrete — {{nomeEmpresa}}',ativo:true,suspenderAcesso:false}])}
  function remEtapa(i){setRegua(r=>r.filter((_,j)=>j!==i))}

  async function salvar(){
    setSaving(true)
    await onSave({smtpHost,smtpPort,smtpUser,smtpPass,smtpFrom,asaasKey,asaasSandbox:sandbox,siteUrl,linkPagamento:linkPag,cronSecret:cronSec,wppApiUrl:wppUrl,wppToken:wppTok,reguaCobranca:regua,emailTemplates:{boasVindas:tplBv||undefined,cobranca:tplCob||undefined},wppTemplates:{cobranca:tplWpp||undefined}})
    setSaving(false)
  }

  async function testar(){
    setTesting(true);setTestMsg('')
    try{
      const res=await fetch('/api/send-email',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({to:smtpUser,subject:'✅ Teste SMTP — Vivanexa',html:'<p>E-mail de teste! 🎉</p>',config:{smtpHost,smtpPort:Number(smtpPort),smtpUser,smtpPass}})})
      const d=await res.json();setTestMsg(d.success?'✅ Enviado com sucesso!':'❌ '+d.error)
    }catch(e){setTestMsg('❌ '+e.message)}
    setTesting(false)
  }

  const ABAS_CONF=[{id:'smtp',lbl:'📧 SMTP'},{id:'asaas',lbl:'🏦 Asaas'},{id:'regua',lbl:'🤖 Regua'},{id:'templates',lbl:'📝 Templates'},{id:'geral',lbl:'⚙️ Geral'}]

  return(
    <div>
      <div className="page-header">
        <div><h1 className="page-title">Configuracoes Master</h1><p className="page-sub">SMTP, Asaas, regua de cobranca e templates</p></div>
        <button className="btn-primary" disabled={saving} onClick={salvar}>{saving?'Salvando...':'💾 Salvar Tudo'}</button>
      </div>
      <div style={{display:'flex',gap:6,marginBottom:24,borderBottom:'1px solid #1e2d4a',paddingBottom:12}}>
        {ABAS_CONF.map(a=>(
          <button key={a.id} onClick={()=>setAbaConf(a.id)} style={{padding:'7px 14px',borderRadius:6,border:'none',cursor:'pointer',fontSize:12,fontFamily:'DM Mono,monospace',background:abaConf===a.id?'rgba(0,212,255,.12)':'transparent',color:abaConf===a.id?'#00d4ff':'#64748b'}}>{a.lbl}</button>
        ))}
      </div>

      {abaConf==='smtp'&&(
        <div className="card">
          <h3 className="card-title" style={{marginBottom:16}}>📧 Configuracao SMTP</h3>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:14}}>
            <div className="field"><label>Servidor SMTP</label><input value={smtpHost} onChange={e=>setSmtpHost(e.target.value)} placeholder="smtp.gmail.com ou smtp.brevo.com"/></div>
            <div className="field"><label>Porta</label><input value={smtpPort} onChange={e=>setSmtpPort(e.target.value)} placeholder="587"/></div>
            <div className="field"><label>Usuario / E-mail</label><input value={smtpUser} onChange={e=>setSmtpUser(e.target.value)}/></div>
            <div className="field"><label>Senha / App Password</label><input type="password" value={smtpPass} onChange={e=>setSmtpPass(e.target.value)}/></div>
            <div className="field" style={{gridColumn:'1/-1'}}><label>Nome remetente</label><input value={smtpFrom} onChange={e=>setSmtpFrom(e.target.value)} placeholder="Vivanexa <noreply@suaempresa.com>"/></div>
          </div>
          <div style={{marginTop:14,display:'flex',alignItems:'center',gap:12}}>
            <button onClick={testar} disabled={testing||!smtpHost} style={{padding:'8px 16px',background:'#1a2540',border:'1px solid #1e2d4a',borderRadius:8,color:'#94a3b8',fontSize:12,cursor:'pointer',fontFamily:'DM Mono,monospace'}}>{testing?'Enviando...':'📨 Testar SMTP'}</button>
            {testMsg&&<span style={{fontSize:12,color:testMsg.startsWith('✅')?'#10b981':'#ef4444'}}>{testMsg}</span>}
          </div>
          <div style={{marginTop:12,fontSize:11,color:'#475569',lineHeight:1.6}}>💡 Gmail: use App Password com 2FA ativado. Brevo/SendGrid: use a chave de API como senha.</div>
        </div>
      )}

      {abaConf==='asaas'&&(
        <div className="card">
          <h3 className="card-title" style={{marginBottom:16}}>🏦 Integracao Asaas</h3>
          <div style={{display:'flex',flexDirection:'column',gap:14}}>
            <div className="field"><label>Chave de API Asaas</label><input type="password" value={asaasKey} onChange={e=>setAsaasKey(e.target.value)} placeholder="$aact_..."/></div>
            <label style={{display:'flex',alignItems:'center',gap:10,cursor:'pointer',fontSize:13,color:'#94a3b8'}}><input type="checkbox" checked={sandbox} onChange={e=>setSandbox(e.target.checked)}/> Usar Sandbox (ambiente de testes)</label>
            <div className="field"><label>Link de pagamento padrao</label><input value={linkPag} onChange={e=>setLinkPag(e.target.value)} placeholder="https://pay.asaas.com/..."/></div>
          </div>
          <div style={{marginTop:16,padding:12,background:'rgba(0,212,255,.06)',border:'1px solid rgba(0,212,255,.15)',borderRadius:8,fontSize:11,color:'#64748b',lineHeight:1.7}}>
            Com Asaas configurado: gere boleto, PIX ou link de cartao direto pelo painel, sem acessar o Asaas. A regua de cobranca tambem pode gerar cobranças no Asaas.
          </div>
        </div>
      )}

      {abaConf==='regua'&&(
        <div>
          <div className="card" style={{marginBottom:16}}>
            <h3 className="card-title" style={{marginBottom:8}}>🤖 Regua de Cobranca Automatica</h3>
            <p style={{fontSize:12,color:'#64748b',lineHeight:1.7,marginBottom:16}}>
              Configure quando e como o sistema notificara clientes inadimplentes.<br/>
              A regua e executada via <code style={{color:'#00d4ff',background:'#0d1526',padding:'1px 6px',borderRadius:4}}>/api/cobranca-automatica</code> — configure um cron job para chamar diariamente.
            </p>
            <div style={{padding:'12px 16px',background:'#0d1526',borderRadius:8,marginBottom:16,border:'1px solid #1e2d4a'}}>
              <div style={{fontSize:12,color:'#94a3b8',fontWeight:700,marginBottom:10}}>📱 WhatsApp para Cobranca</div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:14}}>
                <div className="field"><label>URL do bot WhatsApp</label><input value={wppUrl} onChange={e=>setWppUrl(e.target.value)} placeholder="https://seuapp.com/api/wpp/send"/></div>
                <div className="field"><label>Token / API Key</label><input type="password" value={wppTok} onChange={e=>setWppTok(e.target.value)} placeholder="Bearer ..."/></div>
              </div>
            </div>
            <div className="field">
              <label>Secret da Cron (protecao do endpoint)</label>
              <input value={cronSec} onChange={e=>setCronSec(e.target.value)} placeholder="minha-chave-secreta-123"/>
              <span style={{fontSize:11,color:'#475569',marginTop:4}}>Use: <code style={{color:'#00d4ff'}}>/api/cobranca-automatica?secret=SUA_CHAVE</code></span>
            </div>
          </div>
          <div style={{display:'flex',flexDirection:'column',gap:12}}>
            {regua.map((etapa,i)=>(
              <div key={i} className="card" style={{borderLeft:'3px solid '+(etapa.ativo?'#00d4ff':'#334155'),opacity:etapa.ativo?1:.6}}>
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:14}}>
                  <div style={{display:'flex',alignItems:'center',gap:12}}>
                    <span style={{fontSize:22}}>{['1️⃣','2️⃣','3️⃣','4️⃣','5️⃣','6️⃣','7️⃣'][i]||'▶️'}</span>
                    <div>
                      <div style={{fontWeight:700,color:'#e2e8f0',fontSize:13}}>Etapa {i+1} — {etapa.diasAposVenc} dia(s) apos vencimento</div>
                      <div style={{fontSize:11,color:'#475569',marginTop:2}}>Canais: {etapa.canal.join(' + ')}</div>
                    </div>
                  </div>
                  <div style={{display:'flex',gap:8,alignItems:'center'}}>
                    <label style={{display:'flex',alignItems:'center',gap:6,cursor:'pointer',fontSize:12,color:'#64748b'}}><input type="checkbox" checked={etapa.ativo} onChange={e=>updR(i,'ativo',e.target.checked)}/>Ativa</label>
                    <button onClick={()=>remEtapa(i)} style={{background:'none',border:'none',cursor:'pointer',fontSize:16,color:'#ef444466'}}>🗑️</button>
                  </div>
                </div>
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:14}}>
                  <div className="field"><label>Dias apos vencimento</label><input type="number" min="1" value={etapa.diasAposVenc} onChange={e=>updR(i,'diasAposVenc',Number(e.target.value))}/></div>
                  <div>
                    <label style={{fontSize:11,color:'#64748b',letterSpacing:.5,display:'block',marginBottom:8}}>CANAIS DE ENVIO</label>
                    <div style={{display:'flex',gap:10}}>
                      {['email','whatsapp'].map(c=>(
                        <label key={c} style={{display:'flex',alignItems:'center',gap:6,cursor:'pointer',fontSize:12,color:'#94a3b8'}}>
                          <input type="checkbox" checked={etapa.canal.includes(c)} onChange={()=>togCanal(i,c)}/>
                          {c==='email'?'📧 E-mail':'📱 WhatsApp'}
                        </label>
                      ))}
                    </div>
                  </div>
                  <div className="field" style={{gridColumn:'1/-1'}}><label>Assunto do e-mail (variaveis: {'{{nomeEmpresa}} {{diasAtraso}} {{vencimento}} {{mensalidade}}'})</label><input value={etapa.assunto} onChange={e=>updR(i,'assunto',e.target.value)}/></div>
                  <div style={{gridColumn:'1/-1'}}>
                    <label style={{display:'flex',alignItems:'center',gap:8,cursor:'pointer',fontSize:12,color:etapa.suspenderAcesso?'#ef4444':'#94a3b8'}}>
                      <input type="checkbox" checked={etapa.suspenderAcesso||false} onChange={e=>updR(i,'suspenderAcesso',e.target.checked)}/>
                      🚫 Suspender acesso do cliente ao disparar esta etapa
                    </label>
                  </div>
                </div>
              </div>
            ))}
            <button onClick={addEtapa} style={{padding:'12px',border:'2px dashed #1e2d4a',borderRadius:10,background:'transparent',color:'#475569',cursor:'pointer',fontSize:13,fontFamily:'DM Mono,monospace'}}>+ Adicionar Etapa</button>
          </div>
        </div>
      )}

      {abaConf==='templates'&&(
        <div style={{display:'flex',flexDirection:'column',gap:16}}>
          <div style={{padding:'12px 16px',background:'rgba(0,212,255,.06)',border:'1px solid rgba(0,212,255,.15)',borderRadius:10,fontSize:12,color:'#64748b',lineHeight:1.7}}>
            📝 Personalize os e-mails. Variaveis: <code style={{color:'#00d4ff'}}>{'{{nomeEmpresa}} {{responsavel}} {{mensalidade}} {{senha}} {{siteUrl}} {{linkPagamento}} {{vencimento}} {{diasAtraso}}'}</code>. Deixe em branco para usar o template padrao do sistema.
          </div>
          <div className="card">
            <h3 className="card-title" style={{marginBottom:12}}>📧 Template — E-mail de Boas-vindas</h3>
            <p style={{fontSize:11,color:'#475569',marginBottom:10}}>Enviado ao cadastrar novo cliente. Variaveis: nomeEmpresa, responsavel, email, senha, siteUrl, plano</p>
            <textarea value={tplBv} onChange={e=>setTplBv(e.target.value)} placeholder="Deixe em branco para o template padrao. Cole aqui o HTML personalizado..." rows={10} style={{width:'100%',background:'#111827',border:'1px solid #1e2d4a',borderRadius:8,padding:'12px',color:'#e2e8f0',fontFamily:'DM Mono,monospace',fontSize:12,resize:'vertical',outline:'none'}}/>
            {tplBv&&<button onClick={()=>setTplBv('')} style={{marginTop:6,fontSize:11,color:'#ef4444',background:'none',border:'none',cursor:'pointer'}}>🗑️ Limpar (usar padrao)</button>}
          </div>
          <div className="card">
            <h3 className="card-title" style={{marginBottom:12}}>⚠️ Template — E-mail de Cobranca Automatica</h3>
            <p style={{fontSize:11,color:'#475569',marginBottom:10}}>Usado pela regua de cobranca. Variaveis: nomeEmpresa, responsavel, diasAtraso, vencimento, mensalidade, siteUrl, linkPagamento</p>
            <textarea value={tplCob} onChange={e=>setTplCob(e.target.value)} placeholder="Deixe em branco para o template padrao de cobranca..." rows={10} style={{width:'100%',background:'#111827',border:'1px solid #1e2d4a',borderRadius:8,padding:'12px',color:'#e2e8f0',fontFamily:'DM Mono,monospace',fontSize:12,resize:'vertical',outline:'none'}}/>
            {tplCob&&<button onClick={()=>setTplCob('')} style={{marginTop:6,fontSize:11,color:'#ef4444',background:'none',border:'none',cursor:'pointer'}}>🗑️ Limpar</button>}
          </div>
          <div className="card">
            <h3 className="card-title" style={{marginBottom:12}}>📱 Template — WhatsApp de Cobranca</h3>
            <p style={{fontSize:11,color:'#475569',marginBottom:10}}>Mensagem texto enviada via WhatsApp na regua. Variaveis: nomeEmpresa, responsavel, diasAtraso, vencimento, mensalidade, linkPagamento</p>
            <textarea value={tplWpp} onChange={e=>setTplWpp(e.target.value)} placeholder="Ex: ⚠️ Ola {{responsavel}}, sua mensalidade de {{mensalidade}} esta em aberto ha {{diasAtraso}} dia(s). Acesse: {{linkPagamento}}" rows={6} style={{width:'100%',background:'#111827',border:'1px solid #1e2d4a',borderRadius:8,padding:'12px',color:'#e2e8f0',fontFamily:'DM Mono,monospace',fontSize:12,resize:'vertical',outline:'none'}}/>
            {tplWpp&&<button onClick={()=>setTplWpp('')} style={{marginTop:6,fontSize:11,color:'#ef4444',background:'none',border:'none',cursor:'pointer'}}>🗑️ Limpar</button>}
          </div>
        </div>
      )}

      {abaConf==='geral'&&(
        <div className="card">
          <h3 className="card-title" style={{marginBottom:16}}>⚙️ Configuracoes Gerais</h3>
          <div style={{display:'flex',flexDirection:'column',gap:14}}>
            <div className="field"><label>URL base do sistema</label><input value={siteUrl} onChange={e=>setSiteUrl(e.target.value)} placeholder="https://vivanexa-saas.vercel.app"/></div>
            <div className="field"><label>Link de pagamento padrao</label><input value={linkPag} onChange={e=>setLinkPag(e.target.value)} placeholder="https://pay.asaas.com/..."/><span style={{fontSize:11,color:'#475569',marginTop:4}}>Exibido nos e-mails e modal de cobranca manual.</span></div>
            <div className="field"><label>Secret da cron de cobranca</label><input value={cronSec} onChange={e=>setCronSec(e.target.value)} placeholder="chave-secreta-123"/><span style={{fontSize:11,color:'#475569',marginTop:4}}>Protege o endpoint /api/cobranca-automatica.</span></div>
          </div>
          <div style={{marginTop:20,padding:'12px 16px',background:'#0d1526',borderRadius:8,border:'1px solid #1e2d4a'}}>
            <div style={{fontSize:12,color:'#94a3b8',fontWeight:700,marginBottom:10}}>📅 Configuracao do Cron Job (Vercel)</div>
            <div style={{fontSize:11,color:'#64748b',lineHeight:1.8}}>
              Adicione em <code style={{color:'#00d4ff'}}>vercel.json</code>:<br/>
              <code style={{display:'block',marginTop:8,padding:'10px',background:'#060c1a',borderRadius:6,color:'#10b981',fontSize:11}}>
                {'{ "crons": [{ "path": "/api/cobranca-automatica?secret='+cronSec+'", "schedule": "0 9 * * *" }] }'}
              </code>
              Isso executa a regua diariamente as 9h.
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ══════════ CSS COMPLETO ══════════
const CSS=`
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
:root{--bg:#060c1a;--surface:#0d1526;--s2:#111827;--s3:#1a2540;--border:#1e2d4a;--accent:#00d4ff;--text:#e2e8f0;--muted:#64748b}
body{font-family:'DM Mono',monospace;background:var(--bg);color:var(--text)}
.toast{position:fixed;bottom:28px;right:28px;z-index:9999;color:#fff;padding:12px 22px;border-radius:10px;font-size:13px;font-weight:600;opacity:0;transform:translateY(20px);transition:all .35s ease;pointer-events:none;box-shadow:0 4px 20px rgba(0,0,0,.4)}
.admin-wrap{display:flex;min-height:100vh}
.admin-sidebar{width:220px;min-height:100vh;background:var(--surface);border-right:1px solid var(--border);display:flex;flex-direction:column;padding:20px 0;position:sticky;top:0;height:100vh;overflow-y:auto}
.sidebar-logo{display:flex;align-items:center;gap:12px;padding:0 20px 20px;border-bottom:1px solid var(--border);margin-bottom:16px}
.sidebar-nav{flex:1;display:flex;flex-direction:column;gap:4px;padding:0 10px}
.nav-btn{display:flex;align-items:center;gap:10px;padding:10px 14px;border-radius:8px;border:none;background:transparent;color:var(--muted);cursor:pointer;font-family:'DM Mono',monospace;font-size:13px;transition:all .2s;text-align:left;width:100%}
.nav-btn:hover{background:var(--s3);color:var(--text)}
.nav-btn.active{background:rgba(0,212,255,.12);color:var(--accent)}
.sidebar-user{padding:16px 20px;border-top:1px solid var(--border)}
.btn-sair{margin-top:10px;width:100%;padding:7px;border-radius:6px;border:1px solid var(--border);background:transparent;color:var(--muted);cursor:pointer;font-family:'DM Mono',monospace;font-size:11px;transition:all .2s}
.btn-sair:hover{border-color:#ef4444;color:#ef4444}
.admin-main{flex:1;padding:32px;overflow-y:auto;min-width:0}
.page-header{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:24px;flex-wrap:wrap;gap:12px}
.page-title{font-family:'Syne',sans-serif;font-size:22px;font-weight:800;color:var(--text)}
.page-sub{font-size:12px;color:var(--muted);margin-top:4px}
.stats-grid{display:grid;grid-template-columns:repeat(6,1fr);gap:14px;margin-bottom:24px}
.stat-card{background:var(--s2);border:1px solid var(--border);border-top:2px solid var(--cor,#1e2d4a);border-radius:12px;padding:16px;text-align:center}
.stat-icon{font-size:20px;margin-bottom:8px}
.stat-val{font-family:'Syne',sans-serif;font-size:22px;font-weight:800;line-height:1;margin-bottom:4px}
.stat-label{font-size:11px;color:var(--muted)}
.filtros-bar{display:flex;gap:10px;align-items:center;margin-bottom:16px;flex-wrap:wrap}
.input-busca{flex:1;min-width:200px;background:var(--s2);border:1px solid var(--border);border-radius:8px;padding:9px 14px;color:var(--text);font-family:'DM Mono',monospace;font-size:13px;outline:none}
.input-busca:focus{border-color:var(--accent)}
.select-filtro{background:var(--s2);border:1px solid var(--border);border-radius:8px;padding:9px 14px;color:var(--text);font-family:'DM Mono',monospace;font-size:13px;outline:none;cursor:pointer}
.table-wrap{background:var(--s2);border:1px solid var(--border);border-radius:12px;overflow:hidden;overflow-x:auto}
.admin-table{width:100%;border-collapse:collapse;min-width:600px}
.admin-table th{padding:12px 16px;text-align:left;font-size:11px;color:var(--muted);border-bottom:1px solid var(--border);background:var(--surface);letter-spacing:.5px;white-space:nowrap}
.admin-table td{padding:12px 16px;border-bottom:1px solid #0d1526;vertical-align:middle}
.admin-table tfoot td{border-top:2px solid var(--border);border-bottom:none;background:var(--surface)}
.table-row:hover{background:rgba(0,212,255,.025)}
.table-row:last-child td{border-bottom:none}
.badge{display:inline-block;padding:3px 10px;border-radius:20px;font-size:11px;font-weight:600;white-space:nowrap}
.btn-primary{padding:10px 22px;border-radius:8px;background:linear-gradient(135deg,var(--accent),#0099bb);border:none;color:#000;font-family:'DM Mono',monospace;font-size:13px;font-weight:700;cursor:pointer;transition:all .2s;white-space:nowrap}
.btn-primary:hover:not(:disabled){box-shadow:0 0 20px rgba(0,212,255,.35);transform:translateY(-1px)}
.btn-primary:disabled{opacity:.5;cursor:not-allowed}
.btn-secondary{padding:10px 22px;border-radius:8px;background:transparent;border:1px solid var(--border);color:var(--muted);font-family:'DM Mono',monospace;font-size:13px;cursor:pointer;transition:all .2s;white-space:nowrap}
.btn-secondary:hover{border-color:var(--muted);color:var(--text)}
.btn-danger{padding:10px 22px;border-radius:8px;background:rgba(239,68,68,.15);border:1px solid rgba(239,68,68,.3);color:#ef4444;font-family:'DM Mono',monospace;font-size:13px;font-weight:600;cursor:pointer}
.btn-danger:hover:not(:disabled){background:rgba(239,68,68,.25)}
.btn-danger:disabled{opacity:.5;cursor:not-allowed}
.btn-icon{width:30px;height:30px;border-radius:6px;background:var(--surface);border:1px solid var(--border);cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:14px;transition:all .15s}
.btn-icon:hover{background:var(--s3);border-color:var(--accent)}
.btn-icon.danger:hover{border-color:#ef4444}
.card{background:var(--s2);border:1px solid var(--border);border-radius:12px;padding:20px}
.card-title{font-family:'Syne',sans-serif;font-size:14px;font-weight:700;color:var(--text)}
.modal-overlay{position:fixed;inset:0;background:rgba(0,0,0,.75);display:flex;align-items:center;justify-content:center;z-index:9000;padding:20px;backdrop-filter:blur(4px)}
.modal-box{background:var(--surface);border:1px solid var(--border);border-radius:16px;padding:28px;width:100%;box-shadow:0 8px 48px rgba(0,0,0,.6)}
.field{display:flex;flex-direction:column;gap:5px}
.field label{font-size:11px;color:var(--muted);letter-spacing:.5px;text-transform:uppercase}
.field input,.field select,.field textarea{background:var(--s3);border:1px solid var(--border);border-radius:8px;padding:9px 12px;color:var(--text);font-family:'DM Mono',monospace;font-size:13px;outline:none;transition:border-color .2s}
.field input:focus,.field select:focus{border-color:var(--accent)}
.field input::placeholder,.field textarea::placeholder{color:var(--muted)}
.field span{font-size:11px;color:var(--muted)}
@media(max-width:900px){
  .stats-grid{grid-template-columns:repeat(2,1fr)}
  .admin-sidebar{width:60px}
  .sidebar-logo div,.nav-btn span:last-child,.sidebar-user{display:none}
  .nav-btn{justify-content:center}
  .admin-main{padding:16px}
}
`
