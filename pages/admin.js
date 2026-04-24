// pages/admin.js — Vivanexa Master Admin v4
// ✅ Sessão isolada | ✅ Vendedores com comissão + recorrência | ✅ Metas Planejado×Realizado
// ✅ Usuários admin com controle de abas | ✅ Portal vendedor | ✅ Relatório comissões
// ✅ Status pagamento por cliente | ✅ Exportar PDF / Excel / CSV / TXT

import { useState, useEffect, useCallback, useRef } from 'react'
import Head from 'next/head'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  { auth: { storageKey: 'vx_master_session', persistSession: true } }
)

// ══════════ CONSTANTES ══════════
const MASTER_EMAILS = ['admin@vivanexa.com.br', 'master@vivanexa.com.br']

const TODAS_ABAS = [
  { id:'tenants',    icon:'🏢', label:'Clientes'       },
  { id:'vendedores', icon:'👔', label:'Vendedores'     },
  { id:'usuarios',   icon:'👥', label:'Usuários Admin' },
  { id:'planos',     icon:'📦', label:'Planos'         },
  { id:'financeiro', icon:'💰', label:'Financeiro'     },
  { id:'relvendas',  icon:'📊', label:'Rel. Vendas'    },
  { id:'comissoes',  icon:'🏆', label:'Comissões'      },
  { id:'metricas',   icon:'📈', label:'Métricas'       },
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
  { id:'agenda_pub',       label:'📅 Agenda de Publicação',  grupo:'Marketing'  },
  { id:'geracao_conteudo', label:'✨ Geração de Conteúdo',   grupo:'Marketing'  },
  { id:'contas_receber',   label:'💵 Contas a Receber',      grupo:'Financeiro' },
  { id:'contas_pagar',     label:'💸 Contas a Pagar',        grupo:'Financeiro' },
  { id:'boleto_pix',       label:'🏦 Boleto / PIX',          grupo:'Financeiro' },
  { id:'cartao',           label:'💳 Cartão',                grupo:'Financeiro' },
  { id:'comissoes',        label:'🏆 Comissões',             grupo:'Financeiro' },
  { id:'rel_estrategico',  label:'🎯 Visão Estratégica',     grupo:'Relatórios' },
  { id:'rel_financeiro',   label:'💰 Rel. Financeiro',       grupo:'Relatórios' },
  { id:'rel_kpis',         label:'📊 KPIs da Equipe',        grupo:'Relatórios' },
  { id:'rel_vendas',       label:'🛒 Rel. Vendas',           grupo:'Relatórios' },
  { id:'rel_produtos',     label:'📦 Rel. Produtos',         grupo:'Relatórios' },
  { id:'rel_comercial',    label:'💼 Rel. Comercial',        grupo:'Relatórios' },
  { id:'cfg_empresa',      label:'🏢 Config Empresa',        grupo:'Config'     },
  { id:'cfg_usuarios',     label:'👥 Config Usuários',       grupo:'Config'     },
  { id:'cfg_produtos',     label:'📦 Config Produtos',       grupo:'Config'     },
  { id:'cfg_whatsapp',     label:'📱 Config WhatsApp',       grupo:'Config'     },
  { id:'dashboard',        label:'🏠 Dashboard',             grupo:'Gestão'     },
  { id:'kpi',              label:'📊 Lançar KPIs',           grupo:'Gestão'     },
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
  { id:'trial',    label:'Trial',     cor:'#f59e0b' },
  { id:'ativo',    label:'Ativo',     cor:'#10b981' },
  { id:'suspenso', label:'Suspenso',  cor:'#ef4444' },
  { id:'cancelado',label:'Cancelado', cor:'#64748b' },
]

// ══════════ HELPERS ══════════
const fmt        = n   => 'R$ ' + Number(n||0).toLocaleString('pt-BR',{minimumFractionDigits:2})
const fmtPct     = n   => Number(n||0).toLocaleString('pt-BR',{minimumFractionDigits:1,maximumFractionDigits:1})+'%'
const fmtData    = iso => iso ? new Date(iso+'T12:00:00').toLocaleDateString('pt-BR') : '—'
const mesAtual   = ()  => new Date().toISOString().slice(0,7)
const fmtMesLbl  = iso => { if(!iso) return '—'; const[y,m]=iso.split('-'); return ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'][Number(m)-1]+'/'+y }
const gerarSenha = (n=10) => { const c='ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789@#!'; return Array.from({length:n},()=>c[Math.floor(Math.random()*c.length)]).join('') }
const calcVenc   = (d=30) => { const x=new Date(); x.setDate(x.getDate()+d); return x.toISOString().slice(0,10) }
const uid        = ()  => Date.now().toString(36)+Math.random().toString(36).slice(2,6)

function toast(msg,tipo='ok'){
  const el=document.getElementById('admin-toast'); if(!el)return
  el.textContent=msg; el.style.background=tipo==='ok'?'rgba(16,185,129,.92)':'rgba(239,68,68,.92)'
  el.style.opacity='1'; el.style.transform='translateY(0)'
  setTimeout(()=>{el.style.opacity='0';el.style.transform='translateY(20px)'},4000)
}

// ══════════ EXPORTAÇÃO ══════════
function exportarCSV(dados,nome){
  if(!dados.length)return
  const h=Object.keys(dados[0]).join(';')
  const r=dados.map(row=>Object.values(row).map(v=>`"${String(v??'').replace(/"/g,'""')}"`).join(';')).join('\n')
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
  const xml=`<?xml version="1.0" encoding="UTF-8"?><?mso-application progid="Excel.Sheet"?><Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"><Worksheet ss:Name="Dados"><Table><Row>${cols.map(c=>`<Cell><Data ss:Type="String">${e(c)}</Data></Cell>`).join('')}</Row>${dados.map(r=>`<Row>${cols.map(c=>`<Cell><Data ss:Type="String">${e(r[c])}</Data></Cell>`).join('')}</Row>`).join('')}</Table></Worksheet></Workbook>`
  baixar(new Blob([xml],{type:'application/vnd.ms-excel;charset=utf-8;'}),nome+'.xls')
}
function exportarPDF(elementId){
  const el=document.getElementById(elementId); if(!el)return
  const win=window.open('','_blank')
  win.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"><style>body{font-family:Arial,sans-serif;font-size:11px;color:#111;margin:20px}h1,h2{font-size:15px;margin-bottom:8px}h3{font-size:13px;margin:16px 0 8px}table{width:100%;border-collapse:collapse;margin:8px 0}th{background:#1a2540;color:#fff;padding:6px 10px;text-align:left;font-size:10px}td{padding:5px 10px;border-bottom:1px solid #e2e8f0;font-size:10px}tr:nth-child(even) td{background:#f8fafc}tfoot td{font-weight:700;background:#f1f5f9;border-top:2px solid #cbd5e1}.stat{display:inline-block;margin:0 12px 8px 0;padding:8px 14px;background:#f1f5f9;border-radius:6px}.stat-val{font-size:18px;font-weight:700}.stat-lbl{font-size:10px;color:#64748b}@media print{body{margin:0}}</style></head><body>${el.innerHTML}</body></html>`)
  win.document.close(); win.focus()
  setTimeout(()=>{win.print()},600)
}
function baixar(blob,nome){
  const url=URL.createObjectURL(blob),a=document.createElement('a')
  a.href=url;a.download=nome;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)
}

// ══════════ LOGIN MASTER ══════════
function LoginMaster({onAuth}){
  const [email,setEmail]=useState('')
  const [senha,setSenha]=useState('')
  const [erro,setErro]=useState('')
  const [loading,setLoading]=useState(false)

  async function entrar(e){
    e.preventDefault()
    if(!email||!senha){setErro('Preencha e-mail e senha.');return}
    setLoading(true);setErro('')
    try{
      // Primeiro tenta Supabase Auth (master real)
      const {data,error}=await supabaseAdmin.auth.signInWithPassword({email:email.trim(),password:senha})
      if(!error){
        if(MASTER_EMAILS.includes(data.user.email)){onAuth(data.user,{tipo:'master'},null);return}
        // Logou mas não é master email — verifica se é admin cadastrado
        const {data:cfgRow}=await supabaseAdmin.from('vx_storage').select('value').eq('key','master_cfg').maybeSingle()
        const mc=cfgRow?.value?JSON.parse(cfgRow.value):{}
        const usrAdmin=(mc.adminUsuarios||[]).find(u=>u.email===email.trim()&&u.senha===senha&&u.ativo!==false)
        if(usrAdmin){await supabaseAdmin.auth.signOut();onAuth({email:data.user.email,id:data.user.id},{tipo:'admin',...usrAdmin},mc);return}
        await supabaseAdmin.auth.signOut();throw new Error('Sem permissão de acesso master.')
      }
      // Auth falhou — tenta vendedor (sem conta Supabase)
      const {data:cfgRow}=await supabaseAdmin.from('vx_storage').select('value').eq('key','master_cfg').maybeSingle()
      const mc=cfgRow?.value?JSON.parse(cfgRow.value):{}
      const vend=(mc.vendedores||[]).find(v=>v.email===email.trim()&&v.senhaPortal===senha&&v.ativo!==false)
      if(vend){onAuth({email:vend.email,id:vend.id},{tipo:'vendedor',...vend},mc);return}
      // Tenta admin sem conta Supabase
      const usrAdmin=(mc.adminUsuarios||[]).find(u=>u.email===email.trim()&&u.senha===senha&&u.ativo!==false)
      if(usrAdmin){onAuth({email:usrAdmin.email,id:usrAdmin.id},{tipo:'admin',...usrAdmin},mc);return}
      throw new Error('Usuário ou senha incorretos.')
    }catch(err){setErro(err.message||'Erro ao autenticar.')}
    setLoading(false)
  }

  return(
    <div style={{minHeight:'100vh',background:'#060c1a',display:'flex',alignItems:'center',justifyContent:'center',fontFamily:'DM Mono,monospace',padding:20}}>
      <div style={{width:'100%',maxWidth:380,background:'#0d1526',border:'1px solid #1e2d4a',borderRadius:16,padding:'36px 32px',boxShadow:'0 4px 32px rgba(0,0,0,.5)'}}>
        <div style={{textAlign:'center',marginBottom:28}}>
          <div style={{fontSize:40,marginBottom:12}}>🛡️</div>
          <div style={{fontFamily:'Syne,sans-serif',fontWeight:800,fontSize:18,color:'#e2e8f0'}}>MASTER ADMIN</div>
          <div style={{fontSize:11,color:'#475569',marginTop:4,letterSpacing:1}}>VIVANEXA SaaS</div>
        </div>
        <form onSubmit={entrar}>
          <div style={{marginBottom:14}}>
            <label style={{fontSize:11,color:'#64748b',display:'block',marginBottom:5}}>E-MAIL</label>
            <input value={email} onChange={e=>setEmail(e.target.value)} type="email" placeholder="admin@vivanexa.com.br"
              style={{width:'100%',background:'#111827',border:'1px solid #1e2d4a',borderRadius:8,padding:'10px 12px',color:'#e2e8f0',fontFamily:'DM Mono,monospace',fontSize:13,outline:'none'}}/>
          </div>
          <div style={{marginBottom:14}}>
            <label style={{fontSize:11,color:'#64748b',display:'block',marginBottom:5}}>SENHA</label>
            <input value={senha} onChange={e=>setSenha(e.target.value)} type="password" placeholder="••••••••"
              style={{width:'100%',background:'#111827',border:'1px solid #1e2d4a',borderRadius:8,padding:'10px 12px',color:'#e2e8f0',fontFamily:'DM Mono,monospace',fontSize:13,outline:'none'}}/>
          </div>
          {erro&&<div style={{fontSize:12,color:'#ef4444',marginBottom:12,lineHeight:1.4}}>{erro}</div>}
          <button type="submit" disabled={loading} style={{width:'100%',padding:12,borderRadius:8,background:'linear-gradient(135deg,#00d4ff,#0099bb)',border:'none',color:'#000',fontFamily:'DM Mono,monospace',fontWeight:700,fontSize:14,cursor:loading?'not-allowed':'pointer',opacity:loading?.6:1}}>
            {loading?'Autenticando...':'🔐 Entrar'}
          </button>
        </form>
        <div style={{marginTop:16,fontSize:11,color:'#1e2d4a',textAlign:'center'}}>Sessão isolada — não afeta o sistema principal.</div>
      </div>
    </div>
  )
}

// ══════════ APP PRINCIPAL ══════════
export default function AdminPage(){
  const [masterUser,    setMasterUser]    = useState(null)
  const [usuarioLogado, setUsuarioLogado] = useState(null)
  const [masterCfg,     setMasterCfg]     = useState({})
  const [tenants,       setTenants]       = useState([])
  const [vendedores,    setVendedores]    = useState([])
  const [planos,        setPlanos]        = useState(PLANOS_PADRAO)
  const [aba,           setAba]           = useState('tenants')
  const [busca,         setBusca]         = useState('')
  const [filtroStatus,  setFiltroStatus]  = useState('')
  const [filtroPlano,   setFiltroPlano]   = useState('')
  const [modalTenant,   setModalTenant]   = useState(null)
  const [modalDelete,   setModalDelete]   = useState(null)
  const [saving,        setSaving]        = useState(false)
  const [checking,      setChecking]      = useState(true)

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
    const{data:l}=supabaseAdmin.auth.onAuthStateChange((ev)=>{if(ev==='SIGNED_OUT'){setMasterUser(null);setUsuarioLogado(null)}})
    return()=>l.subscription.unsubscribe()
  },[])

  async function carregarMasterCfg(){
    const{data:cfgRow}=await supabaseAdmin.from('vx_storage').select('value').eq('key','master_cfg').maybeSingle()
    const mc=cfgRow?.value?JSON.parse(cfgRow.value):{}
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
    toast('✅ Configurações salvas!');return cfg
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
      await supabaseAdmin.from('vx_storage').upsert({key:`tenant:${dados.id}`,value:JSON.stringify({...dados,atualizadoEm:agora}),updated_at:agora},{onConflict:'key'})
      const{data:cfgRow}=await supabaseAdmin.from('vx_storage').select('value').eq('key',`cfg:${dados.empresaId||dados.id}`).maybeSingle()
      const cfgAtual=cfgRow?.value?JSON.parse(cfgRow.value):{}
      await supabaseAdmin.from('vx_storage').upsert({key:`cfg:${dados.empresaId||dados.id}`,value:JSON.stringify({...cfgAtual,company:dados.nomeEmpresa,tenant_plano:dados.plano,tenant_status:dados.status,tenant_modulos:dados.modulosLiberados,tenant_maxUsuarios:dados.maxUsuarios,tenant_vencimento:dados.vencimento,modulosAtivos:dados.modulosLiberados}),updated_at:agora},{onConflict:'key'})
      toast('✅ Atualizado!');await carregarTenants();setModalTenant(null)
    }catch(err){toast('❌ '+err.message,'erro')}
    finally{setSaving(false)}
  }

  async function deletarTenant(id){
    setSaving(true)
    await supabaseAdmin.from('vx_storage').delete().eq('key',`tenant:${id}`)
    toast('🗑️ Removido.');await carregarTenants();setModalDelete(null);setSaving(false)
  }

  const tenantsFiltrados=tenants.filter(t=>{
    const ok1=!busca||[t.nomeEmpresa,t.emailAdmin,t.cnpj,t.responsavel].some(v=>v?.toLowerCase().includes(busca.toLowerCase()))
    const ok2=!filtroStatus||t.status===filtroStatus
    const ok3=!filtroPlano||t.plano===filtroPlano
    return ok1&&ok2&&ok3
  })

  const stats={
    total:tenants.length,
    ativos:tenants.filter(t=>t.status==='ativo').length,
    trial:tenants.filter(t=>t.status==='trial').length,
    suspensos:tenants.filter(t=>t.status==='suspenso').length,
    mrr:tenants.filter(t=>t.status==='ativo').reduce((a,t)=>a+Number(t.mensalidade||0),0),
  }

  const abasVisiveis=!usuarioLogado?[]:
    usuarioLogado.tipo==='master'?TODAS_ABAS:
    usuarioLogado.tipo==='vendedor'?TODAS_ABAS.filter(a=>['relvendas','comissoes'].includes(a.id)):
    TODAS_ABAS.filter(a=>(usuarioLogado.abasPermitidas||[]).includes(a.id))

  const tenantsDoVendedor=usuarioLogado?.tipo==='vendedor'
    ?tenants.filter(t=>t.vendedorId===usuarioLogado.id)
    :tenants

  if(checking)return<div style={{minHeight:'100vh',background:'#060c1a',display:'flex',alignItems:'center',justifyContent:'center',fontFamily:'DM Mono,monospace',color:'#64748b'}}><div style={{textAlign:'center'}}><div style={{fontSize:40,marginBottom:12}}>🛡️</div>Verificando...</div></div>
  if(!masterUser)return<LoginMaster onAuth={onAuth}/>

  return(
    <>
      <Head>
        <title>Vivanexa — Master Admin</title>
        <link href="https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=DM+Mono:wght@300;400;500&display=swap" rel="stylesheet"/>
      </Head>
      <style>{CSS}</style>
      <div id="admin-toast" className="toast"/>
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
              <button key={item.id} className={`nav-btn ${aba===item.id?'active':''}`} onClick={()=>setAba(item.id)}>
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
          {aba==='tenants'&&<AbaClientes tenants={tenantsFiltrados} allTenants={tenants} planos={planos} vendedores={vendedores} stats={stats} busca={busca} setBusca={setBusca} filtroStatus={filtroStatus} setFiltroStatus={setFiltroStatus} filtroPlano={filtroPlano} setFiltroPlano={setFiltroPlano} onNovo={()=>setModalTenant('novo')} onEditar={t=>setModalTenant(t)} onDeletar={t=>setModalDelete(t)} onAtualizarStatus={(t,s)=>atualizarTenant({...t,status:s})} onAtualizarPagto={t=>atualizarTenant(t)}/>}
          {aba==='vendedores'&&<GerenciarVendedores vendedores={vendedores} onSave={async lista=>{setVendedores(lista);await salvarMasterCfg({vendedores:lista})}}/>}
          {aba==='usuarios'&&<GerenciarUsuariosAdmin masterCfg={masterCfg} onSave={async lista=>await salvarMasterCfg({adminUsuarios:lista})}/>}
          {aba==='planos'&&<GerenciarPlanos planos={planos} setPlanos={setPlanos} onSave={p=>{setPlanos(p);salvarMasterCfg({planosPersonalizados:p})}}/>}
          {aba==='financeiro'&&<AbaFinanceiro tenants={tenants} planos={planos} stats={stats}/>}
          {aba==='relvendas'&&<RelatorioVendas tenants={tenantsDoVendedor} vendedores={vendedores} planos={planos} masterCfg={masterCfg} usuarioLogado={usuarioLogado} onAtualizarPagto={t=>atualizarTenant(t)}/>}
          {aba==='comissoes'&&<RelatorioComissoes tenants={tenantsDoVendedor} vendedores={vendedores} planos={planos} usuarioLogado={usuarioLogado}/>}
          {aba==='metricas'&&<AbaMetricas tenants={tenants} planos={planos} stats={stats}/>}
          {aba==='config'&&<ConfigMaster masterCfg={masterCfg} onSave={salvarMasterCfg}/>}
        </main>
      </div>

      {modalTenant&&<ModalTenant tenant={modalTenant==='novo'?null:modalTenant} planos={planos} vendedores={vendedores} masterCfg={masterCfg} onSave={d=>d.id?atualizarTenant(d):cadastrarTenant(d)} onClose={()=>setModalTenant(null)} saving={saving}/>}
      {modalDelete&&(
        <div className="modal-overlay" onClick={()=>setModalDelete(null)}>
          <div className="modal-box" style={{maxWidth:420}} onClick={e=>e.stopPropagation()}>
            <h2 style={{fontFamily:'Syne,sans-serif',color:'#ef4444',fontSize:18,marginBottom:12}}>🗑️ Confirmar Exclusão</h2>
            <p style={{color:'#94a3b8',fontSize:13,lineHeight:1.6}}>Excluir <strong style={{color:'#e2e8f0'}}>{modalDelete.nomeEmpresa}</strong>? Ação irreversível.</p>
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
function AbaClientes({tenants,allTenants,planos,vendedores,stats,busca,setBusca,filtroStatus,setFiltroStatus,filtroPlano,setFiltroPlano,onNovo,onEditar,onDeletar,onAtualizarStatus,onAtualizarPagto}){
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
          <thead><tr><th>Empresa</th><th>Vendedor</th><th>Plano</th><th>Status</th><th>Mensalidade</th><th>Vencimento</th><th>Pagamento</th><th>Ações</th></tr></thead>
          <tbody>
            {tenants.length===0
              ?<tr><td colSpan={8} style={{textAlign:'center',color:'#475569',padding:'40px'}}>Nenhum cliente encontrado.</td></tr>
              :tenants.map(t=>{
                const plano=planos.find(p=>p.id===t.plano)
                const status=STATUS_TENANT.find(s=>s.id===t.status)
                const vencido=t.vencimento&&new Date(t.vencimento)<new Date()
                const vendedor=vendedores.find(v=>v.id===t.vendedorId)
                const pagto=t.pagamentoStatus||'pendente'
                const pagtoInfo={pago:{cor:'#10b981'},pendente:{cor:'#f59e0b'},atrasado:{cor:'#ef4444'}}[pagto]||{cor:'#64748b'}
                return(
                  <tr key={t.id} className="table-row">
                    <td><div style={{fontWeight:600,color:'#e2e8f0',fontSize:13}}>{t.nomeEmpresa}</div><div style={{fontSize:11,color:'#475569'}}>{t.emailAdmin}</div>{t.cnpj&&<div style={{fontSize:10,color:'#334155'}}>{t.cnpj}</div>}</td>
                    <td style={{fontSize:12,color:'#94a3b8'}}>{vendedor?.nome||'—'}</td>
                    <td><span className="badge" style={{background:plano?.cor+'22',color:plano?.cor,border:`1px solid ${plano?.cor}44`}}>{plano?.name||t.plano}</span></td>
                    <td><span className="badge" style={{background:status?.cor+'22',color:status?.cor,border:`1px solid ${status?.cor}44`}}>{status?.label}</span></td>
                    <td style={{color:'#10b981',fontWeight:600,fontSize:13}}>{t.mensalidade?fmt(t.mensalidade):'—'}</td>
                    <td style={{fontSize:12,color:vencido?'#ef4444':'#94a3b8'}}>{fmtData(t.vencimento)}{vencido&&<div style={{fontSize:10,color:'#ef4444'}}>⚠️ Vencido</div>}</td>
                    <td>
                      <select value={pagto} onChange={async e=>onAtualizarPagto({...t,pagamentoStatus:e.target.value})}
                        style={{background:pagtoInfo.cor+'22',border:`1px solid ${pagtoInfo.cor}66`,borderRadius:6,color:pagtoInfo.cor,fontSize:11,padding:'3px 8px',fontFamily:'DM Mono,monospace',cursor:'pointer'}}>
                        <option value="pago">✅ Pago</option>
                        <option value="pendente">⏳ Pendente</option>
                        <option value="atrasado">⚠️ Atrasado</option>
                      </select>
                    </td>
                    <td><div style={{display:'flex',gap:6}}>
                      <button className="btn-icon" onClick={()=>onEditar(t)}>✏️</button>
                      {t.status==='ativo'?<button className="btn-icon" onClick={()=>onAtualizarStatus(t,'suspenso')}>🚫</button>:<button className="btn-icon" onClick={()=>onAtualizarStatus(t,'ativo')}>✅</button>}
                      <button className="btn-icon danger" onClick={()=>onDeletar(t)}>🗑️</button>
                    </div></td>
                  </tr>
                )
              })
            }
          </tbody>
        </table>
      </div>
    </>
  )
}

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
    if(!form.nome.trim()||!form.email.trim()){alert('Nome e e-mail obrigatórios.');return}
    setSaving(true)
    const nl=modal==='novo'
      ?[...lista,{...form,id:uid(),criadoEm:new Date().toISOString()}]
      :lista.map(v=>v.id===modal.id?{...v,...form}:v)
    setLista(nl);await onSave(nl);setModal(null);setSaving(false)
  }

  async function remover(id){
    if(!confirm('Remover vendedor?'))return
    const nl=lista.filter(v=>v.id!==id);setLista(nl);await onSave(nl)
  }

  return(
    <div>
      <div className="page-header">
        <div><h1 className="page-title">Vendedores</h1><p className="page-sub">Equipe interna — comissões, metas e portal de acesso</p></div>
        <button className="btn-primary" onClick={()=>{setForm(vazio);setModal('novo')}}>+ Novo Vendedor</button>
      </div>
      <div className="table-wrap">
        <table className="admin-table">
          <thead><tr><th>Nome</th><th>E-mail</th><th>% Adesão</th><th>% Mensal</th><th>Recorrência</th><th>Meta Adesão</th><th>Meta Mensal</th><th>Portal</th><th>Status</th><th>Ações</th></tr></thead>
          <tbody>
            {lista.length===0
              ?<tr><td colSpan={10} style={{textAlign:'center',color:'#475569',padding:'40px'}}>Nenhum vendedor. Clique em "+ Novo Vendedor".</td></tr>
              :lista.map(v=>(
                <tr key={v.id} className="table-row">
                  <td style={{fontWeight:600,color:'#e2e8f0',fontSize:13}}>{v.nome}</td>
                  <td style={{fontSize:12,color:'#94a3b8'}}>{v.email}</td>
                  <td style={{color:'#00d4ff',fontSize:13,fontWeight:600}}>{v.comissaoAdesao?fmtPct(v.comissaoAdesao):'—'}</td>
                  <td style={{color:'#7c3aed',fontSize:13,fontWeight:600}}>{v.comissaoMensal?fmtPct(v.comissaoMensal):'—'}</td>
                  <td style={{fontSize:12,color:'#94a3b8'}}>{Number(v.recorrenciaMeses||0)===0?'♾️ Indefinida':`${v.recorrenciaMeses} mês(es)`}</td>
                  <td style={{fontSize:13,color:'#f59e0b'}}>{v.metaAdesao?fmt(v.metaAdesao):'—'}</td>
                  <td style={{fontSize:13,color:'#10b981'}}>{v.metaMensal?fmt(v.metaMensal):'—'}</td>
                  <td><span style={{fontSize:11,color:v.senhaPortal?'#10b981':'#475569'}}>{v.senhaPortal?'🔑 Configurado':'—'}</span></td>
                  <td><span className="badge" style={{background:v.ativo!==false?'#10b98122':'#64748b22',color:v.ativo!==false?'#10b981':'#64748b',border:`1px solid ${v.ativo!==false?'#10b98144':'#64748b44'}`}}>{v.ativo!==false?'Ativo':'Inativo'}</span></td>
                  <td><div style={{display:'flex',gap:6}}>
                    <button className="btn-icon" onClick={()=>{setForm({...vazio,...v});setModal(v)}}>✏️</button>
                    <button className="btn-icon danger" onClick={()=>remover(v.id)}>🗑️</button>
                  </div></td>
                </tr>
              ))
            }
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
              <div className="field" style={{gridColumn:'1/-1'}}><label>Nome *</label><input value={form.nome} onChange={e=>upd('nome',e.target.value)} placeholder="João Silva"/></div>
              <div className="field"><label>E-mail *</label><input type="email" value={form.email} onChange={e=>upd('email',e.target.value)}/></div>
              <div className="field"><label>Telefone</label><input value={form.tel} onChange={e=>upd('tel',e.target.value)} placeholder="(11) 9 9999-9999"/></div>
              <div className="field"><label>🔑 Senha do Portal Admin</label><input type="password" value={form.senhaPortal} onChange={e=>upd('senhaPortal',e.target.value)} placeholder="Acesso ao /admin"/></div>
              <div className="field"><label>Status</label>
                <select value={form.ativo?'true':'false'} onChange={e=>upd('ativo',e.target.value==='true')}>
                  <option value="true">✅ Ativo</option><option value="false">❌ Inativo</option>
                </select>
              </div>
            </div>

            <div style={{padding:'14px 16px',background:'rgba(0,212,255,.06)',border:'1px solid rgba(0,212,255,.2)',borderRadius:10,marginBottom:16}}>
              <div style={{fontSize:12,color:'#00d4ff',fontWeight:700,marginBottom:14}}>💰 COMISSÃO</div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:14}}>
                <div className="field">
                  <label>% Comissão sobre Adesão</label>
                  <input type="number" step="0.1" min="0" max="100" value={form.comissaoAdesao} onChange={e=>upd('comissaoAdesao',e.target.value)} placeholder="Ex: 10"/>
                  <span style={{fontSize:11,color:'#475569'}}>Valor único pago ao fechar o contrato.</span>
                </div>
                <div className="field">
                  <label>% Comissão sobre Mensalidade</label>
                  <input type="number" step="0.1" min="0" max="100" value={form.comissaoMensal} onChange={e=>upd('comissaoMensal',e.target.value)} placeholder="Ex: 5"/>
                  <span style={{fontSize:11,color:'#475569'}}>Pago todo mês que o cliente pagar.</span>
                </div>
                <div className="field" style={{gridColumn:'1/-1'}}>
                  <label>Recorrência da Comissão Mensal</label>
                  <select value={form.recorrenciaMeses} onChange={e=>upd('recorrenciaMeses',e.target.value)}>
                    <option value="0">♾️ Indefinida — recebe enquanto cliente pagar</option>
                    <option value="1">1 mês</option>
                    <option value="2">2 meses</option>
                    <option value="3">3 meses</option>
                    <option value="6">6 meses</option>
                    <option value="12">12 meses</option>
                    <option value="24">24 meses</option>
                  </select>
                  <span style={{fontSize:11,color:'#475569',marginTop:4,display:'block'}}>
                    {Number(form.recorrenciaMeses)===0
                      ?'✅ Comissão mensal paga indefinidamente enquanto o cliente permanecer ativo.'
                      :`⏱️ Comissão mensal paga apenas nos primeiros ${form.recorrenciaMeses} mês(es) de cada cliente.`}
                  </span>
                </div>
              </div>
            </div>

            <div style={{padding:'14px 16px',background:'rgba(245,158,11,.06)',border:'1px solid rgba(245,158,11,.2)',borderRadius:10,marginBottom:20}}>
              <div style={{fontSize:12,color:'#f59e0b',fontWeight:700,marginBottom:14}}>🎯 METAS MENSAIS</div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:14}}>
                <div className="field">
                  <label>Meta de Adesão (R$)</label>
                  <input type="number" step="0.01" min="0" value={form.metaAdesao} onChange={e=>upd('metaAdesao',e.target.value)} placeholder="Ex: 5000"/>
                  <span style={{fontSize:11,color:'#475569'}}>Total em adesões que o vendedor deve atingir por mês.</span>
                </div>
                <div className="field">
                  <label>Meta de Mensalidade (R$)</label>
                  <input type="number" step="0.01" min="0" value={form.metaMensal} onChange={e=>upd('metaMensal',e.target.value)} placeholder="Ex: 3000"/>
                  <span style={{fontSize:11,color:'#475569'}}>Total em MRR que o vendedor deve gerar por mês.</span>
                </div>
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

// ══════════ USUÁRIOS ADMIN ══════════
function GerenciarUsuariosAdmin({masterCfg,onSave}){
  const lista=masterCfg.adminUsuarios||[]
  const [modal,setModal]=useState(null)
  const [saving,setSaving]=useState(false)
  const vazio={nome:'',email:'',senha:'',ativo:true,abasPermitidas:['tenants','relvendas']}
  const [form,setForm]=useState(vazio)
  const upd=(k,v)=>setForm(f=>({...f,[k]:v}))

  function toggleAba(id){
    setForm(f=>({...f,abasPermitidas:f.abasPermitidas.includes(id)?f.abasPermitidas.filter(a=>a!==id):[...f.abasPermitidas,id]}))
  }

  async function salvar(){
    if(!form.nome.trim()||!form.email.trim()||!form.senha.trim()){alert('Nome, e-mail e senha obrigatórios.');return}
    setSaving(true)
    const nl=modal==='novo'
      ?[...lista,{...form,id:uid(),criadoEm:new Date().toISOString()}]
      :lista.map(u=>u.id===modal.id?{...u,...form}:u)
    await onSave(nl);setModal(null);setSaving(false)
  }

  return(
    <div>
      <div className="page-header">
        <div><h1 className="page-title">Usuários Admin</h1><p className="page-sub">Controle de acesso ao painel master</p></div>
        <button className="btn-primary" onClick={()=>{setForm(vazio);setModal('novo')}}>+ Novo Usuário</button>
      </div>
      <div style={{marginBottom:16,padding:'12px 16px',background:'rgba(245,158,11,.06)',border:'1px solid rgba(245,158,11,.2)',borderRadius:10,fontSize:12,color:'#f59e0b',lineHeight:1.6}}>
        💡 Usuários admin acessam com e-mail e senha definidos aqui (sem conta Supabase). Vendedores acessam com a senha do portal definida em <strong>Vendedores</strong> e veem apenas Relatório de Vendas e Comissões.
      </div>
      <div className="table-wrap">
        <table className="admin-table">
          <thead><tr><th>Nome</th><th>E-mail</th><th>Abas com Acesso</th><th>Status</th><th>Ações</th></tr></thead>
          <tbody>
            {lista.length===0
              ?<tr><td colSpan={5} style={{textAlign:'center',color:'#475569',padding:'40px'}}>Nenhum usuário admin. O e-mail master sempre tem acesso completo.</td></tr>
              :lista.map(u=>(
                <tr key={u.id} className="table-row">
                  <td style={{fontWeight:600,color:'#e2e8f0',fontSize:13}}>{u.nome}</td>
                  <td style={{fontSize:12,color:'#94a3b8'}}>{u.email}</td>
                  <td style={{fontSize:11,color:'#64748b',maxWidth:300}}>{(u.abasPermitidas||[]).map(a=>TODAS_ABAS.find(x=>x.id===a)?.label||a).join(', ')||'—'}</td>
                  <td><span className="badge" style={{background:u.ativo!==false?'#10b98122':'#64748b22',color:u.ativo!==false?'#10b981':'#64748b',border:`1px solid ${u.ativo!==false?'#10b98144':'#64748b44'}`}}>{u.ativo!==false?'Ativo':'Inativo'}</span></td>
                  <td><div style={{display:'flex',gap:6}}>
                    <button className="btn-icon" onClick={()=>{setForm({...vazio,...u});setModal(u)}}>✏️</button>
                    <button className="btn-icon danger" onClick={async()=>{if(!confirm('Remover usuário?'))return;await onSave(lista.filter(x=>x.id!==u.id))}}>🗑️</button>
                  </div></td>
                </tr>
              ))
            }
          </tbody>
        </table>
      </div>

      {modal&&(
        <div className="modal-overlay" onClick={()=>setModal(null)}>
          <div className="modal-box" style={{maxWidth:560,maxHeight:'90vh',overflowY:'auto'}} onClick={e=>e.stopPropagation()}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:20}}>
              <h2 style={{fontFamily:'Syne,sans-serif',fontSize:17,color:'#00d4ff'}}>{modal==='novo'?'👤 Novo Usuário Admin':'✏️ Editar Usuário'}</h2>
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
                    <div key={a.id} onClick={()=>toggleAba(a.id)} style={{display:'flex',alignItems:'center',gap:10,padding:'8px 12px',borderRadius:8,border:`1px solid ${ativo?'#00d4ff44':'#1e2d4a'}`,background:ativo?'#00d4ff0d':'#111827',cursor:'pointer'}}>
                      <div style={{width:14,height:14,borderRadius:3,border:`2px solid ${ativo?'#00d4ff':'#334155'}`,background:ativo?'#00d4ff':'transparent',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>{ativo&&<span style={{fontSize:8,color:'#000',fontWeight:900}}>✓</span>}</div>
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

// ══════════ RELATÓRIO DE VENDAS ══════════
function RelatorioVendas({tenants,vendedores,planos,masterCfg,usuarioLogado,onAtualizarPagto}){
  const [filtroVend,  setFiltroVend]  = useState(usuarioLogado?.tipo==='vendedor'?usuarioLogado.id:'')
  const [filtroMes,   setFiltroMes]   = useState(mesAtual())
  const [filtroPlano, setFiltroPlano] = useState('')
  const [filtroPagto, setFiltroPagto] = useState('')

  const meses=[...new Set(tenants.filter(t=>t.criadoEm).map(t=>t.criadoEm.slice(0,7)))].sort((a,b)=>b.localeCompare(a))
  if(!meses.includes(mesAtual()))meses.unshift(mesAtual())

  const filtrados=tenants.filter(t=>{
    const mes=t.criadoEm?.slice(0,7)||''
    const pagto=t.pagamentoStatus||'pendente'
    return(!filtroMes||mes===filtroMes)&&(!filtroVend||t.vendedorId===filtroVend)&&(!filtroPlano||t.plano===filtroPlano)&&(!filtroPagto||pagto===filtroPagto)
  })

  const totalAdesao=filtrados.reduce((a,t)=>a+Number(t.adesao||0),0)
  const totalMensal=filtrados.reduce((a,t)=>a+Number(t.mensalidade||0),0)
  const totalPago  =filtrados.filter(t=>t.pagamentoStatus==='pago').reduce((a,t)=>a+Number(t.mensalidade||0),0)
  const totalPendente=filtrados.filter(t=>t.pagamentoStatus!=='pago').reduce((a,t)=>a+Number(t.mensalidade||0),0)

  // Planejado x Realizado por vendedor
  const rankVend=vendedores.map(v=>{
    const cl=filtrados.filter(t=>t.vendedorId===v.id)
    const rA=cl.reduce((a,t)=>a+Number(t.adesao||0),0)
    const rM=cl.reduce((a,t)=>a+Number(t.mensalidade||0),0)
    const mA=Number(v.metaAdesao||0)
    const mM=Number(v.metaMensal||0)
    return{...v,qtd:cl.length,rA,rM,mA,mM,pA:mA>0?(rA/mA*100):null,pM:mM>0?(rM/mM*100):null}
  }).filter(v=>v.qtd>0)

  function dadosExp(){
    return filtrados.map(t=>({
      Empresa:     t.nomeEmpresa,
      Email:       t.emailAdmin,
      Vendedor:    vendedores.find(v=>v.id===t.vendedorId)?.nome||'—',
      Plano:       planos.find(p=>p.id===t.plano)?.name||t.plano,
      Status:      t.status,
      Adesao:      Number(t.adesao||0).toFixed(2),
      Mensalidade: Number(t.mensalidade||0).toFixed(2),
      Pagamento:   t.pagamentoStatus||'pendente',
      Cadastro:    t.criadoEm?new Date(t.criadoEm).toLocaleDateString('pt-BR'):'—',
    }))
  }

  const EXP_ID='rel-vendas-print'

  function BarraMeta({val,meta,cor1,cor2}){
    if(meta===null)return<span style={{fontSize:11,color:'#334155'}}>sem meta</span>
    const pct=Math.min(val,100)
    const cor=val>=100?'#10b981':val>=50?'#f59e0b':'#ef4444'
    return(
      <div style={{minWidth:80}}>
        <div style={{fontSize:11,color:cor,marginBottom:3,fontWeight:600}}>{val.toFixed(0)}%</div>
        <div style={{background:'#1a2540',borderRadius:4,height:6}}>
          <div style={{background:cor,width:`${pct}%`,height:'100%',borderRadius:4,transition:'width .4s'}}/>
        </div>
      </div>
    )
  }

  return(
    <div>
      <div className="page-header">
        <div><h1 className="page-title">Relatório de Vendas</h1><p className="page-sub">Planejado × Realizado · Status de pagamento por cliente</p></div>
        <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
          <button onClick={()=>exportarPDF(EXP_ID)} className="btn-secondary" style={{fontSize:12,padding:'8px 14px'}}>🖨️ PDF</button>
          <button onClick={()=>exportarExcel(dadosExp(),'rel-vendas')} className="btn-secondary" style={{fontSize:12,padding:'8px 14px'}}>📊 Excel</button>
          <button onClick={()=>exportarCSV(dadosExp(),'rel-vendas')} className="btn-secondary" style={{fontSize:12,padding:'8px 14px'}}>📄 CSV</button>
          <button onClick={()=>exportarTXT(dadosExp(),'rel-vendas')} className="btn-secondary" style={{fontSize:12,padding:'8px 14px'}}>📝 TXT</button>
        </div>
      </div>

      <div className="filtros-bar">
        <select className="select-filtro" value={filtroMes} onChange={e=>setFiltroMes(e.target.value)}>
          <option value="">Todos os meses</option>
          {meses.map(m=><option key={m} value={m}>{fmtMesLbl(m)}</option>)}
        </select>
        {usuarioLogado?.tipo!=='vendedor'&&(
          <select className="select-filtro" value={filtroVend} onChange={e=>setFiltroVend(e.target.value)}>
            <option value="">Todos os vendedores</option>
            {vendedores.map(v=><option key={v.id} value={v.id}>{v.nome}</option>)}
          </select>
        )}
        <select className="select-filtro" value={filtroPlano} onChange={e=>setFiltroPlano(e.target.value)}>
          <option value="">Todos os planos</option>
          {planos.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <select className="select-filtro" value={filtroPagto} onChange={e=>setFiltroPagto(e.target.value)}>
          <option value="">Todos os pagamentos</option>
          <option value="pago">✅ Pago</option>
          <option value="pendente">⏳ Pendente</option>
          <option value="atrasado">⚠️ Atrasado</option>
        </select>
        <span style={{fontSize:12,color:'#475569',marginLeft:'auto'}}>{filtrados.length} venda(s)</span>
      </div>

      <div id={EXP_ID}>
        {/* Cards de totais */}
        <div className="stats-grid" style={{gridTemplateColumns:'repeat(4,1fr)',marginBottom:20}}>
          {[
            {label:'Vendas no período',valor:filtrados.length,  icon:'🧾',cor:'#00d4ff'},
            {label:'Total Adesão',     valor:fmt(totalAdesao),  icon:'💵',cor:'#f59e0b'},
            {label:'MRR Gerado',       valor:fmt(totalMensal),  icon:'🔄',cor:'#7c3aed'},
            {label:'Recebido (Pago)',  valor:fmt(totalPago),    icon:'✅',cor:'#10b981'},
          ].map((s,i)=>(
            <div key={i} className="stat-card" style={{'--cor':s.cor}}>
              <div className="stat-icon">{s.icon}</div>
              <div className="stat-val" style={{color:s.cor,fontSize:18}}>{s.valor}</div>
              <div className="stat-label">{s.label}</div>
            </div>
          ))}
        </div>

        {/* Planejado x Realizado */}
        {rankVend.length>0&&(
          <div className="card" style={{marginBottom:20}}>
            <h3 className="card-title" style={{marginBottom:16}}>🎯 Planejado × Realizado — {fmtMesLbl(filtroMes)||'Todos os meses'}</h3>
            <div style={{overflowX:'auto'}}>
              <table className="admin-table" style={{minWidth:700}}>
                <thead>
                  <tr>
                    <th>#</th><th>Vendedor</th><th>Clientes</th>
                    <th style={{color:'#f59e0b'}}>Meta Adesão</th><th style={{color:'#00d4ff'}}>Realiz. Adesão</th><th>%</th>
                    <th style={{color:'#f59e0b'}}>Meta Mensal</th><th style={{color:'#10b981'}}>Realiz. Mensal</th><th>%</th>
                  </tr>
                </thead>
                <tbody>
                  {rankVend.sort((a,b)=>b.rM-a.rM).map((v,i)=>(
                    <tr key={v.id} className="table-row">
                      <td style={{fontSize:16}}>{i===0?'🥇':i===1?'🥈':i===2?'🥉':`#${i+1}`}</td>
                      <td style={{fontWeight:600,color:'#e2e8f0',fontSize:13}}>{v.nome}</td>
                      <td style={{color:'#94a3b8',fontSize:13}}>{v.qtd}</td>
                      <td style={{color:'#f59e0b',fontSize:13}}>{v.mA>0?fmt(v.mA):'—'}</td>
                      <td style={{color:'#00d4ff',fontWeight:600,fontSize:13}}>{fmt(v.rA)}</td>
                      <td><BarraMeta val={v.pA??0} meta={v.pA}/></td>
                      <td style={{color:'#f59e0b',fontSize:13}}>{v.mM>0?fmt(v.mM):'—'}</td>
                      <td style={{color:'#10b981',fontWeight:600,fontSize:13}}>{fmt(v.rM)}</td>
                      <td><BarraMeta val={v.pM??0} meta={v.pM}/></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Tabela de clientes */}
        <div className="table-wrap">
          <table className="admin-table">
            <thead><tr><th>Empresa</th><th>Vendedor</th><th>Plano</th><th>Status</th><th>Adesão</th><th>Mensalidade</th><th>Pagamento</th><th>Cadastro</th></tr></thead>
            <tbody>
              {filtrados.length===0
                ?<tr><td colSpan={8} style={{textAlign:'center',color:'#475569',padding:'40px'}}>Nenhuma venda no período.</td></tr>
                :filtrados.map(t=>{
                    const plano=planos.find(p=>p.id===t.plano)
                    const status=STATUS_TENANT.find(s=>s.id===t.status)
                    const vend=vendedores.find(v=>v.id===t.vendedorId)
                    const pagto=t.pagamentoStatus||'pendente'
                    const pInfo={pago:{cor:'#10b981',lbl:'✅ Pago'},pendente:{cor:'#f59e0b',lbl:'⏳ Pendente'},atrasado:{cor:'#ef4444',lbl:'⚠️ Atrasado'}}[pagto]||{cor:'#64748b',lbl:pagto}
                    return(
                      <tr key={t.id} className="table-row">
                        <td><div style={{fontWeight:600,color:'#e2e8f0',fontSize:13}}>{t.nomeEmpresa}</div><div style={{fontSize:11,color:'#475569'}}>{t.emailAdmin}</div></td>
                        <td style={{fontSize:12,color:'#94a3b8'}}>{vend?.nome||'—'}</td>
                        <td><span className="badge" style={{background:plano?.cor+'22',color:plano?.cor,border:`1px solid ${plano?.cor}44`}}>{plano?.name||t.plano}</span></td>
                        <td><span className="badge" style={{background:status?.cor+'22',color:status?.cor,border:`1px solid ${status?.cor}44`}}>{status?.label}</span></td>
                        <td style={{color:'#94a3b8',fontSize:13}}>{t.adesao?fmt(t.adesao):'—'}</td>
                        <td style={{color:'#10b981',fontWeight:600,fontSize:13}}>{t.mensalidade?fmt(t.mensalidade):'—'}</td>
                        <td>
                          <select value={pagto} onChange={async e=>onAtualizarPagto({...t,pagamentoStatus:e.target.value})}
                            style={{background:pInfo.cor+'22',border:`1px solid ${pInfo.cor}66`,borderRadius:6,color:pInfo.cor,fontSize:11,padding:'3px 8px',fontFamily:'DM Mono,monospace',cursor:'pointer',outline:'none'}}>
                            <option value="pago">✅ Pago</option>
                            <option value="pendente">⏳ Pendente</option>
                            <option value="atrasado">⚠️ Atrasado</option>
                          </select>
                        </td>
                        <td style={{fontSize:12,color:'#94a3b8'}}>{t.criadoEm?new Date(t.criadoEm).toLocaleDateString('pt-BR'):'—'}</td>
                      </tr>
                    )
                  })
              }
            </tbody>
            {filtrados.length>0&&(
              <tfoot>
                <tr>
                  <td colSpan={4} style={{padding:'12px 16px',fontSize:12,color:'#64748b',fontWeight:600}}>TOTAIS — {filtrados.length} cliente(s)</td>
                  <td style={{padding:'12px 16px',color:'#94a3b8',fontWeight:700,fontSize:13}}>{fmt(totalAdesao)}</td>
                  <td style={{padding:'12px 16px',color:'#10b981',fontWeight:700,fontSize:13}}>{fmt(totalMensal)}/mês</td>
                  <td style={{padding:'12px 16px',fontSize:11}}>
                    <span style={{color:'#10b981'}}>Pago: {fmt(totalPago)}</span><br/>
                    <span style={{color:'#f59e0b'}}>Pendente: {fmt(totalPendente)}</span>
                  </td>
                  <td/>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  )
}

// ══════════ RELATÓRIO DE COMISSÕES ══════════
function RelatorioComissoes({tenants,vendedores,planos,usuarioLogado}){
  const [filtroVend,setFiltroVend]=useState(usuarioLogado?.tipo==='vendedor'?usuarioLogado.id:'')
  const [filtroMes, setFiltroMes] =useState(mesAtual())

  const meses=[...new Set(tenants.filter(t=>t.criadoEm).map(t=>t.criadoEm.slice(0,7)))].sort((a,b)=>b.localeCompare(a))
  if(!meses.includes(mesAtual()))meses.unshift(mesAtual())

  const vendsAlvo=vendedores.filter(v=>!filtroVend||v.id===filtroVend)

  const dadosVends=vendsAlvo.map(v=>{
    const pctA=Number(v.comissaoAdesao||0)/100
    const pctM=Number(v.comissaoMensal||0)/100
    const mesesRec=Number(v.recorrenciaMeses||0)

    const clientes=tenants.filter(t=>{
      const mes=t.criadoEm?.slice(0,7)||''
      return t.vendedorId===v.id&&(!filtroMes||mes===filtroMes)
    })

    const linhas=clientes.map(t=>{
      const adesaoBruta =Number(t.adesao||0)
      const mensalBruta =Number(t.mensalidade||0)
      const comAPlan    =adesaoBruta*pctA
      const comMPlan    =mensalBruta*pctM
      const pago        =t.pagamentoStatus==='pago'
      const comAReal    =pago?comAPlan:0
      const comMReal    =pago?comMPlan:0
      return{tenant:t,adesaoBruta,mensalBruta,comAPlan,comMPlan,comAReal,comMReal,pago}
    })

    const totPlanA=linhas.reduce((a,l)=>a+l.comAPlan,0)
    const totPlanM=linhas.reduce((a,l)=>a+l.comMPlan,0)
    const totRealA=linhas.reduce((a,l)=>a+l.comAReal,0)
    const totRealM=linhas.reduce((a,l)=>a+l.comMReal,0)
    const totPlan=totPlanA+totPlanM
    const totReal=totRealA+totRealM
    const pct=totPlan>0?(totReal/totPlan*100):0

    return{...v,linhas,totPlanA,totPlanM,totRealA,totRealM,totPlan,totReal,pct,mesesRec}
  }).filter(v=>v.linhas.length>0)

  const grandPlan=dadosVends.reduce((a,v)=>a+v.totPlan,0)
  const grandReal=dadosVends.reduce((a,v)=>a+v.totReal,0)
  const grandRec =grandPlan-grandReal

  function dadosExp(){
    const rows=[]
    dadosVends.forEach(v=>{
      v.linhas.forEach(l=>{
        rows.push({
          Vendedor:           v.nome,
          Empresa:            l.tenant.nomeEmpresa,
          Plano:              planos.find(p=>p.id===l.tenant.plano)?.name||l.tenant.plano,
          Adesao_Bruta:       l.adesaoBruta.toFixed(2),
          Mensal_Bruta:       l.mensalBruta.toFixed(2),
          Pagamento:          l.tenant.pagamentoStatus||'pendente',
          ComAdesaoPlaneja:   l.comAPlan.toFixed(2),
          ComMensalPlaneja:   l.comMPlan.toFixed(2),
          ComAdesaoRealiz:    l.comAReal.toFixed(2),
          ComMensalRealiz:    l.comMReal.toFixed(2),
          Recorrencia:        Number(v.mesesRec)===0?'Indefinida':`${v.mesesRec} mes(es)`,
          PctComissaoAdesao:  fmtPct(v.comissaoAdesao||0),
          PctComissaoMensal:  fmtPct(v.comissaoMensal||0),
        })
      })
    })
    return rows
  }

  const EXP_ID='rel-comissoes-print'

  return(
    <div>
      <div className="page-header">
        <div><h1 className="page-title">Comissões</h1><p className="page-sub">Planejado × Realizado por vendedor e cliente</p></div>
        <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
          <button onClick={()=>exportarPDF(EXP_ID)} className="btn-secondary" style={{fontSize:12,padding:'8px 14px'}}>🖨️ PDF</button>
          <button onClick={()=>exportarExcel(dadosExp(),'comissoes')} className="btn-secondary" style={{fontSize:12,padding:'8px 14px'}}>📊 Excel</button>
          <button onClick={()=>exportarCSV(dadosExp(),'comissoes')} className="btn-secondary" style={{fontSize:12,padding:'8px 14px'}}>📄 CSV</button>
          <button onClick={()=>exportarTXT(dadosExp(),'comissoes')} className="btn-secondary" style={{fontSize:12,padding:'8px 14px'}}>📝 TXT</button>
        </div>
      </div>

      <div className="filtros-bar">
        <select className="select-filtro" value={filtroMes} onChange={e=>setFiltroMes(e.target.value)}>
          <option value="">Todos os meses</option>
          {meses.map(m=><option key={m} value={m}>{fmtMesLbl(m)}</option>)}
        </select>
        {usuarioLogado?.tipo!=='vendedor'&&(
          <select className="select-filtro" value={filtroVend} onChange={e=>setFiltroVend(e.target.value)}>
            <option value="">Todos os vendedores</option>
            {vendedores.map(v=><option key={v.id} value={v.id}>{v.nome}</option>)}
          </select>
        )}
      </div>

      {/* Cards gerais */}
      <div className="stats-grid" style={{gridTemplateColumns:'repeat(4,1fr)',marginBottom:20}}>
        {[
          {label:'Comissão Planejada', valor:fmt(grandPlan),                                                          icon:'📋',cor:'#f59e0b'},
          {label:'Comissão Realizada', valor:fmt(grandReal),                                                          icon:'✅',cor:'#10b981'},
          {label:'% Realizado',        valor:grandPlan>0?(grandReal/grandPlan*100).toFixed(0)+'%':'—',                icon:'📊',cor:'#00d4ff'},
          {label:'A Receber',          valor:fmt(grandRec),                                                           icon:'⏳',cor:'#7c3aed'},
        ].map((s,i)=>(
          <div key={i} className="stat-card" style={{'--cor':s.cor}}>
            <div className="stat-icon">{s.icon}</div>
            <div className="stat-val" style={{color:s.cor,fontSize:18}}>{s.valor}</div>
            <div className="stat-label">{s.label}</div>
          </div>
        ))}
      </div>

      <div id={EXP_ID}>
        {dadosVends.length===0
          ?<div style={{textAlign:'center',color:'#475569',padding:'60px 20px',fontSize:13}}>🏆 Nenhuma comissão no período.</div>
          :dadosVends.map(v=>(
            <div key={v.id} className="card" style={{marginBottom:20}}>
              {/* Header vendedor */}
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:12,flexWrap:'wrap',gap:12}}>
                <div>
                  <div style={{fontFamily:'Syne,sans-serif',fontWeight:800,fontSize:16,color:'#e2e8f0'}}>👔 {v.nome}</div>
                  <div style={{fontSize:11,color:'#475569',marginTop:4,lineHeight:1.7}}>
                    Comissão Adesão: <span style={{color:'#00d4ff',fontWeight:600}}>{fmtPct(v.comissaoAdesao||0)}</span>
                    {' · '}Comissão Mensal: <span style={{color:'#7c3aed',fontWeight:600}}>{fmtPct(v.comissaoMensal||0)}</span>
                    {' · '}Recorrência: <span style={{color:'#f59e0b',fontWeight:600}}>{Number(v.mesesRec)===0?'♾️ Indefinida':`${v.mesesRec} mês(es)`}</span>
                  </div>
                </div>
                <div style={{display:'flex',gap:16}}>
                  {[
                    {lbl:'PLANEJADO',val:fmt(v.totPlan),cor:'#f59e0b'},
                    {lbl:'REALIZADO',val:fmt(v.totReal),cor:'#10b981'},
                    {lbl:'A RECEBER',val:fmt(v.totPlan-v.totReal),cor:'#7c3aed'},
                  ].map((x,i)=>(
                    <div key={i} style={{textAlign:'right'}}>
                      <div style={{fontSize:10,color:'#475569',letterSpacing:.5}}>{x.lbl}</div>
                      <div style={{fontSize:15,fontWeight:700,color:x.cor}}>{x.val}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Barra progresso */}
              {v.totPlan>0&&(
                <div style={{marginBottom:16}}>
                  <div style={{display:'flex',justifyContent:'space-between',fontSize:11,color:'#64748b',marginBottom:4}}>
                    <span>Progresso do período</span>
                    <span style={{color:v.pct>=100?'#10b981':v.pct>=50?'#f59e0b':'#ef4444',fontWeight:600}}>{v.pct.toFixed(0)}%</span>
                  </div>
                  <div style={{background:'#1a2540',borderRadius:6,height:8}}>
                    <div style={{background:`linear-gradient(90deg,${v.pct>=100?'#10b981':'#f59e0b'},${v.pct>=100?'#00d4ff':'#00d4ff'})`,width:`${Math.min(v.pct,100)}%`,height:'100%',borderRadius:6,transition:'width .5s'}}/>
                  </div>
                </div>
              )}

              {/* Tabela clientes */}
              <div style={{overflowX:'auto'}}>
                <table className="admin-table" style={{minWidth:900}}>
                  <thead>
                    <tr>
                      <th>Empresa</th><th>Plano</th><th>Adesão Bruta</th><th>Mensal Bruta</th><th>Pagamento</th>
                      <th style={{color:'#f59e0b'}}>Com. Adesão Plan.</th>
                      <th style={{color:'#f59e0b'}}>Com. Mensal Plan.</th>
                      <th style={{color:'#10b981'}}>Com. Adesão Real.</th>
                      <th style={{color:'#10b981'}}>Com. Mensal Real.</th>
                    </tr>
                  </thead>
                  <tbody>
                    {v.linhas.map(l=>{
                      const plano=planos.find(p=>p.id===l.tenant.plano)
                      const pInfo={pago:{cor:'#10b981',lbl:'✅ Pago'},pendente:{cor:'#f59e0b',lbl:'⏳ Pendente'},atrasado:{cor:'#ef4444',lbl:'⚠️ Atrasado'}}[l.tenant.pagamentoStatus||'pendente']||{cor:'#64748b',lbl:'—'}
                      return(
                        <tr key={l.tenant.id} className="table-row">
                          <td>
                            <div style={{fontWeight:600,color:'#e2e8f0',fontSize:12}}>{l.tenant.nomeEmpresa}</div>
                            <div style={{fontSize:10,color:'#475569'}}>{l.tenant.criadoEm?new Date(l.tenant.criadoEm).toLocaleDateString('pt-BR'):''}</div>
                          </td>
                          <td><span className="badge" style={{background:plano?.cor+'22',color:plano?.cor,border:`1px solid ${plano?.cor}44`}}>{plano?.name||l.tenant.plano}</span></td>
                          <td style={{color:'#94a3b8',fontSize:12}}>{l.adesaoBruta?fmt(l.adesaoBruta):'—'}</td>
                          <td style={{color:'#94a3b8',fontSize:12}}>{l.mensalBruta?fmt(l.mensalBruta)+'  /mês':'—'}</td>
                          <td><span style={{fontSize:11,color:pInfo.cor,fontWeight:600}}>{pInfo.lbl}</span></td>
                          <td style={{color:l.comAPlan>0?'#f59e0b':'#334155',fontSize:12,fontWeight:l.comAPlan>0?600:400}}>{l.comAPlan>0?fmt(l.comAPlan):'—'}</td>
                          <td style={{color:l.comMPlan>0?'#f59e0b':'#334155',fontSize:12,fontWeight:l.comMPlan>0?600:400}}>{l.comMPlan>0?fmt(l.comMPlan)+' /mês':'—'}</td>
                          <td style={{color:l.comAReal>0?'#10b981':'#334155',fontSize:12,fontWeight:l.comAReal>0?700:400}}>{l.comAReal>0?fmt(l.comAReal):'—'}</td>
                          <td style={{color:l.comMReal>0?'#10b981':'#334155',fontSize:12,fontWeight:l.comMReal>0?700:400}}>{l.comMReal>0?fmt(l.comMReal)+' /mês':'—'}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                  <tfoot>
                    <tr>
                      <td colSpan={5} style={{padding:'10px 16px',fontSize:11,color:'#64748b',fontWeight:600}}>SUBTOTAL {v.nome.toUpperCase()} · {v.linhas.length} cliente(s)</td>
                      <td style={{padding:'10px 16px',color:'#f59e0b',fontWeight:700,fontSize:12}}>{fmt(v.totPlanA)}</td>
                      <td style={{padding:'10px 16px',color:'#f59e0b',fontWeight:700,fontSize:12}}>{fmt(v.totPlanM)}/mês</td>
                      <td style={{padding:'10px 16px',color:'#10b981',fontWeight:700,fontSize:12}}>{fmt(v.totRealA)}</td>
                      <td style={{padding:'10px 16px',color:'#10b981',fontWeight:700,fontSize:12}}>{fmt(v.totRealM)}/mês</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          ))
        }
      </div>
    </div>
  )
}

// ══════════ ABA FINANCEIRO ══════════
function AbaFinanceiro({tenants,planos,stats}){
  return(
    <>
      <div className="page-header"><div><h1 className="page-title">Financeiro</h1><p className="page-sub">Receitas e cobranças</p></div></div>
      <div className="stats-grid" style={{gridTemplateColumns:'repeat(3,1fr)'}}>
        {[{label:'MRR',valor:fmt(stats.mrr),icon:'💰',cor:'#10b981'},{label:'ARR',valor:fmt(stats.mrr*12),icon:'📈',cor:'#00d4ff'},{label:'Ticket Médio',valor:stats.ativos>0?fmt(stats.mrr/stats.ativos):'R$ 0,00',icon:'🎯',cor:'#7c3aed'}].map((s,i)=>(
          <div key={i} className="stat-card" style={{'--cor':s.cor}}><div className="stat-icon">{s.icon}</div><div className="stat-val" style={{color:s.cor,fontSize:20}}>{s.valor}</div><div className="stat-label">{s.label}</div></div>
        ))}
      </div>
      <div className="table-wrap" style={{marginTop:24}}>
        <table className="admin-table">
          <thead><tr><th>Empresa</th><th>Plano</th><th>Adesão</th><th>Mensalidade</th><th>Vencimento</th><th>Status</th></tr></thead>
          <tbody>
            {tenants.filter(t=>t.status!=='cancelado').map(t=>{
              const plano=planos.find(p=>p.id===t.plano),status=STATUS_TENANT.find(s=>s.id===t.status)
              const vencido=t.vencimento&&new Date(t.vencimento)<new Date()
              return(<tr key={t.id} className="table-row">
                <td style={{fontWeight:600,color:'#e2e8f0',fontSize:13}}>{t.nomeEmpresa}</td>
                <td><span className="badge" style={{background:plano?.cor+'22',color:plano?.cor,border:`1px solid ${plano?.cor}44`}}>{plano?.name}</span></td>
                <td style={{color:'#94a3b8',fontSize:13}}>{t.adesao?fmt(t.adesao):'—'}</td>
                <td style={{color:'#10b981',fontWeight:600,fontSize:13}}>{t.mensalidade?fmt(t.mensalidade):'—'}</td>
                <td style={{fontSize:12,color:vencido?'#ef4444':'#94a3b8'}}>{fmtData(t.vencimento)}</td>
                <td><span className="badge" style={{background:status?.cor+'22',color:status?.cor,border:`1px solid ${status?.cor}44`}}>{status?.label}</span></td>
              </tr>)
            })}
          </tbody>
        </table>
      </div>
    </>
  )
}

// ══════════ ABA MÉTRICAS ══════════
function AbaMetricas({tenants,planos,stats}){
  return(
    <>
      <div className="page-header"><div><h1 className="page-title">Métricas</h1><p className="page-sub">Visão geral da plataforma</p></div></div>
      <div style={{display:'grid',gridTemplateColumns:'repeat(2,1fr)',gap:20}}>
        <div className="card">
          <h3 className="card-title" style={{marginBottom:16}}>📦 Ativos por Plano</h3>
          {planos.map(p=>{const q=tenants.filter(t=>t.plano===p.id&&t.status==='ativo').length;const pc=stats.ativos>0?(q/stats.ativos)*100:0;return(<div key={p.id} style={{marginTop:12}}><div style={{display:'flex',justifyContent:'space-between',fontSize:12,color:'#94a3b8',marginBottom:4}}><span style={{color:p.cor}}>{p.name}</span><span>{q}</span></div><div style={{background:'#1a2540',borderRadius:4,height:6}}><div style={{background:p.cor,width:`${pc}%`,height:'100%',borderRadius:4}}/></div></div>)})}
        </div>
        <div className="card">
          <h3 className="card-title" style={{marginBottom:16}}>📊 Por Status</h3>
          {STATUS_TENANT.map(s=>{const q=tenants.filter(t=>t.status===s.id).length;const pc=tenants.length>0?(q/tenants.length)*100:0;return(<div key={s.id} style={{marginTop:12}}><div style={{display:'flex',justifyContent:'space-between',fontSize:12,color:'#94a3b8',marginBottom:4}}><span style={{color:s.cor}}>{s.label}</span><span>{q} ({pc.toFixed(0)}%)</span></div><div style={{background:'#1a2540',borderRadius:4,height:6}}><div style={{background:s.cor,width:`${pc}%`,height:'100%',borderRadius:4}}/></div></div>)})}
        </div>
        <div className="card" style={{gridColumn:'1/-1'}}>
          <h3 className="card-title" style={{marginBottom:16}}>⚠️ Vencimentos nos próximos 30 dias</h3>
          {(()=>{
            const hoje=new Date(),lim=new Date();lim.setDate(lim.getDate()+30)
            const prox=tenants.filter(t=>{if(!t.vencimento||t.status==='cancelado')return false;const v=new Date(t.vencimento);return v>=hoje&&v<=lim}).sort((a,b)=>new Date(a.vencimento)-new Date(b.vencimento))
            if(!prox.length)return<p style={{color:'#475569',fontSize:13,marginTop:8}}>✅ Nenhum vencimento próximo.</p>
            return prox.map(t=>{
              const dias=Math.ceil((new Date(t.vencimento)-hoje)/86400000)
              const plano=planos.find(p=>p.id===t.plano)
              return(<div key={t.id} style={{display:'flex',justifyContent:'space-between',padding:'10px 0',borderBottom:'1px solid #1e2d4a'}}>
                <div><div style={{fontSize:13,color:'#e2e8f0',fontWeight:600}}>{t.nomeEmpresa}</div><div style={{fontSize:11,color:'#475569',marginTop:2}}>{plano?.name} · {fmt(t.mensalidade)}/mês</div></div>
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
  function upd(id,k,v){setPlanos(prev=>prev.map(p=>p.id===id?{...p,[k]:v}:p))}
  async function salvar(){setSaving(true);await onSave(planos);setSaving(false)}
  return(
    <div>
      <div className="page-header">
        <div><h1 className="page-title">Planos</h1><p className="page-sub">Configure valores e limites por plano</p></div>
        <button className="btn-primary" disabled={saving} onClick={salvar}>{saving?'Salvando...':'💾 Salvar Planos'}</button>
      </div>
      <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:16}}>
        {planos.map(p=>(
          <div key={p.id} className="card" style={{borderTop:`3px solid ${p.cor}`}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:16}}>
              <h3 style={{fontFamily:'Syne,sans-serif',color:p.cor,fontSize:16,fontWeight:800}}>{p.name}</h3>
              <span style={{fontSize:10,color:'#475569',background:'#1a2540',padding:'2px 8px',borderRadius:4}}>{p.id}</span>
            </div>
            <div style={{display:'flex',flexDirection:'column',gap:12}}>
              <div className="field"><label>Máx. Usuários</label><input type="number" value={p.maxUsuarios} onChange={e=>upd(p.id,'maxUsuarios',Number(e.target.value))}/></div>
              <div className="field"><label>Adesão padrão (R$)</label><input type="number" step="0.01" value={p.adesao||0} onChange={e=>upd(p.id,'adesao',Number(e.target.value))}/></div>
              <div className="field"><label>Mensalidade padrão (R$)</label><input type="number" step="0.01" value={p.mensalidade||0} onChange={e=>upd(p.id,'mensalidade',Number(e.target.value))}/></div>
              <div style={{fontSize:11,color:'#475569'}}>Módulos incluídos: <strong style={{color:'#e2e8f0'}}>{(MODULOS_POR_PLANO[p.id]||[]).length}</strong></div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ══════════ CONFIG MASTER ══════════
function ConfigMaster({masterCfg,onSave}){
  const [smtpHost,setSmtpHost]=useState(masterCfg?.smtpHost||'')
  const [smtpPort,setSmtpPort]=useState(masterCfg?.smtpPort||'587')
  const [smtpUser,setSmtpUser]=useState(masterCfg?.smtpUser||'')
  const [smtpPass,setSmtpPass]=useState(masterCfg?.smtpPass||'')
  const [smtpFrom,setSmtpFrom]=useState(masterCfg?.smtpFrom||'')
  const [asaasKey,setAsaasKey]=useState(masterCfg?.asaasKey||'')
  const [sandbox, setSandbox] =useState(masterCfg?.asaasSandbox??true)
  const [siteUrl, setSiteUrl] =useState(masterCfg?.siteUrl||'https://vivanexa-saas.vercel.app')
  const [saving,  setSaving]  =useState(false)
  const [testing, setTesting] =useState(false)
  const [testMsg, setTestMsg] =useState('')

  async function salvar(){setSaving(true);await onSave({smtpHost,smtpPort,smtpUser,smtpPass,smtpFrom,asaasKey,asaasSandbox:sandbox,siteUrl});setSaving(false)}
  async function testar(){
    setTesting(true);setTestMsg('')
    try{
      const res=await fetch('/api/send-email',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({to:smtpUser,subject:'✅ Teste SMTP — Vivanexa',html:'<p>E-mail de teste! 🎉</p>',config:{smtpHost,smtpPort:Number(smtpPort),smtpUser,smtpPass}})})
      const d=await res.json();setTestMsg(d.success?'✅ Enviado com sucesso!':'❌ '+d.error)
    }catch(e){setTestMsg('❌ '+e.message)}
    setTesting(false)
  }

  return(
    <div>
      <div className="page-header">
        <div><h1 className="page-title">Configurações Master</h1><p className="page-sub">SMTP, Asaas e URL do sistema</p></div>
        <button className="btn-primary" disabled={saving} onClick={salvar}>{saving?'Salvando...':'💾 Salvar'}</button>
      </div>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:20}}>
        <div className="card" style={{gridColumn:'1/-1'}}>
          <h3 className="card-title" style={{marginBottom:16}}>📧 E-mail / SMTP</h3>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:14}}>
            <div className="field"><label>Servidor SMTP</label><input value={smtpHost} onChange={e=>setSmtpHost(e.target.value)} placeholder="smtp.gmail.com ou smtp.brevo.com"/></div>
            <div className="field"><label>Porta</label><input value={smtpPort} onChange={e=>setSmtpPort(e.target.value)} placeholder="587"/></div>
            <div className="field"><label>Usuário / E-mail</label><input value={smtpUser} onChange={e=>setSmtpUser(e.target.value)}/></div>
            <div className="field"><label>Senha / App Password</label><input type="password" value={smtpPass} onChange={e=>setSmtpPass(e.target.value)}/></div>
            <div className="field" style={{gridColumn:'1/-1'}}><label>Nome remetente</label><input value={smtpFrom} onChange={e=>setSmtpFrom(e.target.value)} placeholder='Vivanexa <noreply@suaempresa.com>'/></div>
          </div>
          <div style={{marginTop:14,display:'flex',alignItems:'center',gap:12}}>
            <button onClick={testar} disabled={testing||!smtpHost} style={{padding:'8px 16px',background:'#1a2540',border:'1px solid #1e2d4a',borderRadius:8,color:'#94a3b8',fontSize:12,cursor:'pointer',fontFamily:'DM Mono,monospace'}}>{testing?'Enviando...':'📨 Testar SMTP'}</button>
            {testMsg&&<span style={{fontSize:12,color:testMsg.startsWith('✅')?'#10b981':'#ef4444'}}>{testMsg}</span>}
          </div>
        </div>
        <div className="card">
          <h3 className="card-title" style={{marginBottom:16}}>🏦 Asaas</h3>
          <div style={{display:'flex',flexDirection:'column',gap:14}}>
            <div className="field"><label>Chave de API</label><input type="password" value={asaasKey} onChange={e=>setAsaasKey(e.target.value)} placeholder="$aact_..."/></div>
            <label style={{display:'flex',alignItems:'center',gap:10,cursor:'pointer',fontSize:12,color:'#94a3b8'}}><input type="checkbox" checked={sandbox} onChange={e=>setSandbox(e.target.checked)}/>Usar Sandbox (testes)</label>
          </div>
        </div>
        <div className="card">
          <h3 className="card-title" style={{marginBottom:16}}>🌐 URL do Sistema</h3>
          <div className="field"><label>URL base (para e-mails)</label><input value={siteUrl} onChange={e=>setSiteUrl(e.target.value)} placeholder="https://vivanexa-saas.vercel.app"/></div>
          <div style={{marginTop:10,fontSize:11,color:'#475569'}}>Usada no e-mail de boas-vindas enviado ao cliente.</div>
        </div>
      </div>
    </div>
  )
}

// ══════════ MODAL TENANT ══════════
function ModalTenant({tenant,planos,vendedores,masterCfg,onSave,onClose,saving}){
  const isNovo=!tenant
  const [abaM,   setAbaM]   =useState('dados')
  const [nome,   setNome]   =useState(tenant?.nomeEmpresa||'')
  const [cnpj,   setCnpj]   =useState(tenant?.cnpj||'')
  const [email,  setEmail]  =useState(tenant?.emailAdmin||'')
  const [senha,  setSenha]  =useState(isNovo?gerarSenha():'')
  const [tel,    setTel]    =useState(tenant?.telefone||'')
  const [resp,   setResp]   =useState(tenant?.responsavel||'')
  const [vendId, setVendId] =useState(tenant?.vendedorId||'')
  const [plano,  setPlano]  =useState(tenant?.plano||'basic')
  const [status, setStatus] =useState(tenant?.status||'trial')
  const [maxUsu, setMaxUsu] =useState(tenant?.maxUsuarios||3)
  const [mensal, setMensal] =useState(tenant?.mensalidade||'')
  const [adesao, setAdesao] =useState(tenant?.adesao||'')
  const [venc,   setVenc]   =useState(tenant?.vencimento||calcVenc(30))
  const [mods,   setMods]   =useState(tenant?.modulosLiberados||MODULOS_POR_PLANO['basic'])
  const [obs,    setObs]    =useState(tenant?.obs||'')
  const [asaas,  setAsaas]  =useState(isNovo&&!!masterCfg?.asaasKey)
  const [billing,setBilling]=useState('BOLETO')
  const [sendMail,setSendMail]=useState(isNovo)
  const [visible,setVisible]=useState(false)

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

  function salvar(){
    if(!nome.trim()){alert('Informe o nome da empresa.');return}
    if(!email.trim()){alert('Informe o e-mail.');return}
    if(isNovo&&!senha.trim()){alert('Defina uma senha.');return}
    onSave({
      id:tenant?.id,empresaId:tenant?.empresaId,
      nomeEmpresa:nome.trim(),cnpj:cnpj.trim(),emailAdmin:email.trim().toLowerCase(),
      senha:isNovo?senha:undefined,telefone:tel.trim(),responsavel:resp.trim(),
      vendedorId:vendId,plano,status,maxUsuarios:Number(maxUsu),
      mensalidade:Number(String(mensal).replace(',','.')),
      adesao:Number(String(adesao).replace(',','.')),
      vencimento:venc,modulosLiberados:mods,obs:obs.trim(),
      criarAsaas:asaas,billingType:billing,sendEmail:sendMail,
      criadoEm:tenant?.criadoEm||new Date().toISOString(),
      pagamentoStatus:tenant?.pagamentoStatus||'pendente',
    })
  }

  return(
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" style={{maxWidth:740,maxHeight:'92vh',overflowY:'auto'}} onClick={e=>e.stopPropagation()}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:20}}>
          <h2 style={{fontFamily:'Syne,sans-serif',fontSize:18,color:'#00d4ff'}}>{isNovo?'🏢 Novo Cliente':`✏️ ${tenant.nomeEmpresa}`}</h2>
          <button onClick={onClose} style={{background:'none',border:'none',color:'#64748b',fontSize:20,cursor:'pointer'}}>✕</button>
        </div>
        <div style={{display:'flex',gap:6,marginBottom:20,borderBottom:'1px solid #1e2d4a',paddingBottom:12}}>
          {[{id:'dados',lbl:'📋 Dados'},{id:'plano',lbl:'📦 Plano'},{id:'modulos',lbl:'🔐 Módulos'},{id:'acesso',lbl:'🔑 Acesso'}].map(a=>(
            <button key={a.id} onClick={()=>setAbaM(a.id)} style={{padding:'6px 14px',borderRadius:6,border:'none',cursor:'pointer',fontSize:12,background:abaM===a.id?'#00d4ff22':'transparent',color:abaM===a.id?'#00d4ff':'#64748b',fontFamily:'DM Mono,monospace'}}>{a.lbl}</button>
          ))}
        </div>

        {abaM==='dados'&&<div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:14}}>
          <div className="field" style={{gridColumn:'1/-1'}}><label>Nome da Empresa *</label><input value={nome} onChange={e=>setNome(e.target.value)} placeholder="Ex: Contabilidade ABC Ltda"/></div>
          <div className="field"><label>CNPJ</label><input value={cnpj} onChange={e=>setCnpj(e.target.value)} placeholder="00.000.000/0001-00"/></div>
          <div className="field"><label>Responsável</label><input value={resp} onChange={e=>setResp(e.target.value)}/></div>
          <div className="field"><label>E-mail Admin *</label><input type="email" value={email} onChange={e=>setEmail(e.target.value)}/></div>
          <div className="field"><label>Telefone</label><input value={tel} onChange={e=>setTel(e.target.value)} placeholder="(11) 9 9999-9999"/></div>
          <div className="field" style={{gridColumn:'1/-1'}}><label>👔 Vendedor responsável pela venda</label>
            <select value={vendId} onChange={e=>setVendId(e.target.value)}>
              <option value="">— Selecionar vendedor —</option>
              {vendedores.filter(v=>v.ativo!==false).map(v=><option key={v.id} value={v.id}>{v.nome} ({v.email})</option>)}
            </select>
          </div>
          <div className="field" style={{gridColumn:'1/-1'}}><label>Observações internas</label>
            <textarea value={obs} onChange={e=>setObs(e.target.value)} rows={3} style={{width:'100%',background:'#1a2540',border:'1px solid #1e2d4a',borderRadius:8,padding:'9px 12px',color:'#e2e8f0',fontFamily:'DM Mono,monospace',fontSize:13,resize:'vertical'}}/>
          </div>
        </div>}

        {abaM==='plano'&&<div>
          <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:10,marginBottom:20}}>
            {planos.map(p=>(
              <button key={p.id} onClick={()=>changePlano(p.id)} style={{padding:'12px 10px',borderRadius:10,border:`2px solid ${plano===p.id?p.cor:'#1e2d4a'}`,background:plano===p.id?p.cor+'22':'#111827',color:plano===p.id?p.cor:'#64748b',cursor:'pointer',fontFamily:'Syne,sans-serif',fontWeight:700,fontSize:13}}>
                {p.name}<div style={{fontSize:10,marginTop:4,fontFamily:'DM Mono,monospace',fontWeight:400}}>{p.maxUsuarios===999?'ilimitado':`até ${p.maxUsuarios} usr`}</div>
                {p.mensalidade>0&&<div style={{fontSize:11,marginTop:2}}>{fmt(p.mensalidade)}/mês</div>}
              </button>
            ))}
          </div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:14}}>
            <div className="field"><label>Status</label><select value={status} onChange={e=>setStatus(e.target.value)}>{STATUS_TENANT.map(s=><option key={s.id} value={s.id}>{s.label}</option>)}</select></div>
            <div className="field"><label>Máx. Usuários</label><input type="number" min={1} value={maxUsu} onChange={e=>setMaxUsu(e.target.value)}/></div>
            <div className="field"><label>Valor Adesão (R$)</label><input type="number" step="0.01" min="0" value={adesao} onChange={e=>setAdesao(e.target.value)} placeholder="0,00"/></div>
            <div className="field"><label>Mensalidade (R$)</label><input type="number" step="0.01" min="0" value={mensal} onChange={e=>setMensal(e.target.value)} placeholder="0,00"/></div>
            <div className="field" style={{gridColumn:'1/-1'}}><label>Vencimento / Renovação</label><input type="date" value={venc} onChange={e=>setVenc(e.target.value)}/></div>
          </div>
          <div style={{marginTop:12}}>
            <label style={{fontSize:12,color:'#64748b',display:'block',marginBottom:8}}>⚡ Atalhos</label>
            <div style={{display:'flex',gap:8}}>{[7,14,30,90,365].map(d=><button key={d} onClick={()=>setVenc(calcVenc(d))} style={{padding:'5px 12px',background:'#1a2540',border:'1px solid #1e2d4a',borderRadius:6,color:'#94a3b8',fontSize:11,cursor:'pointer',fontFamily:'DM Mono,monospace'}}>+{d}d</button>)}</div>
          </div>
          {masterCfg?.asaasKey&&<div style={{marginTop:20,padding:16,background:'#0d1526',borderRadius:10,border:'1px solid #1e2d4a'}}>
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:12}}>
              <span style={{fontSize:13,color:'#e2e8f0',fontWeight:600}}>🏦 Asaas</span>
              <label style={{display:'flex',alignItems:'center',gap:8,cursor:'pointer'}}><input type="checkbox" checked={asaas} onChange={e=>setAsaas(e.target.checked)}/><span style={{fontSize:12,color:'#94a3b8'}}>Criar cliente + assinatura</span></label>
            </div>
            {asaas&&<div className="field"><label>Forma de pagamento</label><select value={billing} onChange={e=>setBilling(e.target.value)}><option value="BOLETO">Boleto</option><option value="PIX">PIX</option><option value="CREDIT_CARD">Cartão</option><option value="UNDEFINED">Cliente escolhe</option></select></div>}
          </div>}
        </div>}

        {abaM==='modulos'&&<div>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:16}}>
            <span style={{fontSize:12,color:'#64748b'}}>{mods.length}/{TODOS_MODULOS.length} módulos liberados</span>
            <div style={{display:'flex',gap:8}}>
              <button onClick={()=>setMods(TODOS_MODULOS.map(m=>m.id))} style={{padding:'4px 10px',background:'#10b98122',border:'1px solid #10b98144',borderRadius:6,color:'#10b981',fontSize:11,cursor:'pointer',fontFamily:'DM Mono,monospace'}}>Todos</button>
              <button onClick={()=>setMods([])} style={{padding:'4px 10px',background:'#ef444422',border:'1px solid #ef444444',borderRadius:6,color:'#ef4444',fontSize:11,cursor:'pointer',fontFamily:'DM Mono,monospace'}}>Nenhum</button>
            </div>
          </div>
          {GRUPOS.map(grupo=>{
            const gMs=TODOS_MODULOS.filter(m=>m.grupo===grupo)
            const all=gMs.every(m=>mods.includes(m.id))
            return(<div key={grupo} style={{marginBottom:20}}>
              <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:10}}>
                <span style={{fontSize:12,color:'#94a3b8',fontWeight:600}}>{grupo}</span>
                <button onClick={()=>toggleGrupo(grupo)} style={{padding:'2px 8px',background:all?'#00d4ff22':'#1a2540',border:`1px solid ${all?'#00d4ff44':'#1e2d4a'}`,borderRadius:4,color:all?'#00d4ff':'#475569',fontSize:10,cursor:'pointer',fontFamily:'DM Mono,monospace'}}>{all?'desmarcar':'marcar'}</button>
              </div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:6}}>
                {gMs.map(mod=>{const at=mods.includes(mod.id);return(
                  <div key={mod.id} onClick={()=>toggleMod(mod.id)} style={{display:'flex',alignItems:'center',gap:10,padding:'9px 12px',borderRadius:8,border:`1px solid ${at?'#00d4ff44':'#1e2d4a'}`,background:at?'#00d4ff0d':'#111827',cursor:'pointer'}}>
                    <div style={{width:15,height:15,borderRadius:3,border:`2px solid ${at?'#00d4ff':'#334155'}`,background:at?'#00d4ff':'transparent',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>{at&&<span style={{fontSize:9,color:'#000',fontWeight:900}}>✓</span>}</div>
                    <span style={{fontSize:11,color:at?'#e2e8f0':'#64748b'}}>{mod.label}</span>
                  </div>
                )})}
              </div>
            </div>)
          })}
        </div>}

        {abaM==='acesso'&&<div style={{display:'flex',flexDirection:'column',gap:16}}>
          {isNovo&&<div style={{padding:16,background:'#0d1526',borderRadius:10,border:'1px solid #1e2d4a'}}>
            <h3 style={{fontSize:13,color:'#e2e8f0',marginBottom:14}}>🔑 Credenciais</h3>
            <div className="field" style={{marginBottom:12}}><label>Login (E-mail)</label><input value={email} readOnly style={{opacity:.7}}/></div>
            <div className="field"><label>Senha inicial</label>
              <div style={{position:'relative'}}>
                <input type={visible?'text':'password'} value={senha} onChange={e=>setSenha(e.target.value)}
                  style={{width:'100%',background:'#1a2540',border:'1px solid #1e2d4a',borderRadius:8,padding:'9px 44px 9px 12px',color:'#e2e8f0',fontFamily:'DM Mono,monospace',fontSize:13}}/>
                <button onClick={()=>setVisible(!visible)} style={{position:'absolute',right:10,top:'50%',transform:'translateY(-50%)',background:'none',border:'none',cursor:'pointer',fontSize:14}}>{visible?'🙈':'👁️'}</button>
              </div>
            </div>
            <button onClick={()=>setSenha(gerarSenha())} style={{marginTop:8,padding:'5px 12px',background:'#1a2540',border:'1px solid #1e2d4a',borderRadius:6,color:'#94a3b8',fontSize:11,cursor:'pointer',fontFamily:'DM Mono,monospace'}}>🔄 Gerar nova senha</button>
            <div style={{marginTop:12,padding:10,background:'rgba(239,68,68,.07)',border:'1px solid rgba(239,68,68,.2)',borderRadius:8,fontSize:11,color:'#ef4444',lineHeight:1.5}}>⚠️ Esta senha será enviada por e-mail ao cliente.</div>
          </div>}
          <div style={{padding:16,background:'#0d1526',borderRadius:10,border:'1px solid #1e2d4a'}}>
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:12}}>
              <h3 style={{fontSize:13,color:'#e2e8f0'}}>📧 E-mail de Boas-vindas</h3>
              <label style={{display:'flex',alignItems:'center',gap:8,cursor:'pointer'}}><input type="checkbox" checked={sendMail} onChange={e=>setSendMail(e.target.checked)}/><span style={{fontSize:12,color:'#94a3b8'}}>Enviar ao cadastrar</span></label>
            </div>
            {!masterCfg?.smtpHost&&<div style={{padding:10,background:'rgba(245,158,11,.07)',border:'1px solid rgba(245,158,11,.2)',borderRadius:8,fontSize:11,color:'#f59e0b'}}>⚠️ SMTP não configurado. Configure em Config.</div>}
          </div>
        </div>}

        <div style={{display:'flex',justifyContent:'flex-end',gap:10,marginTop:24,paddingTop:16,borderTop:'1px solid #1e2d4a'}}>
          <button className="btn-secondary" onClick={onClose}>Cancelar</button>
          <button className="btn-primary" disabled={saving} onClick={salvar}>{saving?'⏳ Processando...':isNovo?'✅ Cadastrar Cliente':'✅ Salvar Alterações'}</button>
        </div>
      </div>
    </div>
  )
}

// ══════════ CSS ══════════
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
@media(max-width:900px){
  .stats-grid{grid-template-columns:repeat(2,1fr)}
  .admin-sidebar{width:60px}
  .sidebar-logo div,.nav-btn span:last-child,.sidebar-user{display:none}
  .nav-btn{justify-content:center}
  .admin-main{padding:16px}
}
`
