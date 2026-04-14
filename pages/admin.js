// pages/admin.js — Vivanexa Master Admin v2
// Funcionalidades:
//   ✅ Cadastro completo de clientes (tenants) com vendedor
//   ✅ Gestão de planos com valores e módulos padrão
//   ✅ Liberação granular de módulos + todos os submenus
//   ✅ Integração Asaas (cliente + assinatura recorrente + adesão)
//   ✅ Criação de usuário no Supabase Auth com senha definida
//   ✅ Envio de e-mail de boas-vindas com credenciais
//   ✅ Configuração SMTP da empresa master

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/router'
import Head from 'next/head'
import { supabase } from '../lib/supabase'

// ══════════════════════════════════════════════════════
// CONSTANTES
// ══════════════════════════════════════════════════════

const MASTER_EMAILS = ['admin@vivanexa.com.br', 'master@vivanexa.com.br']

const TODOS_MODULOS = [
  { id:'chat',            label:'💬 Chat / Assistente IA',  grupo:'Comercial'  },
  { id:'whatsapp_inbox',  label:'📱 WhatsApp Inbox',        grupo:'Comercial'  },
  { id:'crm',             label:'🤝 CRM',                   grupo:'Comercial'  },
  { id:'gerador_leads',   label:'🎯 Gerador de Leads',      grupo:'Comercial'  },
  { id:'disparo_massa',   label:'📣 Disparo em Massa',      grupo:'Comercial'  },
  { id:'chatbot',         label:'🤖 Chatbot',               grupo:'Comercial'  },
  { id:'agente_ia',       label:'🧠 Agente IA',             grupo:'Comercial'  },
  { id:'script_playbook', label:'📋 Script / Playbook',     grupo:'Comercial'  },
  { id:'campanhas_ia',    label:'🎯 Campanhas IA',          grupo:'Marketing'  },
  { id:'agenda_pub',      label:'📅 Agenda de Publicação',  grupo:'Marketing'  },
  { id:'geracao_conteudo',label:'✨ Geração de Conteúdo',   grupo:'Marketing'  },
  { id:'contas_receber',  label:'💵 Contas a Receber',      grupo:'Financeiro' },
  { id:'contas_pagar',    label:'💸 Contas a Pagar',        grupo:'Financeiro' },
  { id:'boleto_pix',      label:'🏦 Boleto / PIX',          grupo:'Financeiro' },
  { id:'cartao',          label:'💳 Cartão',                grupo:'Financeiro' },
  { id:'comissoes',       label:'🏆 Comissões',             grupo:'Financeiro' },
  { id:'rel_estrategico', label:'🎯 Visão Estratégica',     grupo:'Relatórios' },
  { id:'rel_financeiro',  label:'💰 Rel. Financeiro',       grupo:'Relatórios' },
  { id:'rel_kpis',        label:'📊 KPIs da Equipe',        grupo:'Relatórios' },
  { id:'rel_vendas',      label:'🛒 Rel. Vendas',           grupo:'Relatórios' },
  { id:'rel_produtos',    label:'📦 Rel. Produtos',         grupo:'Relatórios' },
  { id:'rel_comercial',   label:'💼 Rel. Comercial',        grupo:'Relatórios' },
  { id:'cfg_empresa',     label:'🏢 Config Empresa',        grupo:'Config'     },
  { id:'cfg_metas',       label:'🎯 Config Metas',          grupo:'Config'     },
  { id:'cfg_kpis',        label:'📊 Config KPIs',           grupo:'Config'     },
  { id:'cfg_usuarios',    label:'👥 Config Usuários',       grupo:'Config'     },
  { id:'cfg_produtos',    label:'📦 Config Produtos',       grupo:'Config'     },
  { id:'cfg_descontos',   label:'🏷️ Config Descontos',     grupo:'Config'     },
  { id:'cfg_whatsapp',    label:'📱 Config WhatsApp',       grupo:'Config'     },
  { id:'cfg_agente_ia',   label:'🤖 Config Agente IA',      grupo:'Config'     },
  { id:'cfg_depto',       label:'🏢 Departamentos',         grupo:'Config'     },
  { id:'cfg_integracoes', label:'🔗 Integrações',           grupo:'Config'     },
  { id:'cfg_telefonia',   label:'📞 Telefonia 3CX',         grupo:'Config'     },
  { id:'dashboard',       label:'🏠 Dashboard',             grupo:'Gestão'     },
  { id:'kpi',             label:'📊 Lançar KPIs',           grupo:'Gestão'     },
]

const GRUPOS = [...new Set(TODOS_MODULOS.map(m => m.grupo))]

const MODULOS_POR_PLANO = {
  starter: ['dashboard','chat','crm','kpi','rel_estrategico','cfg_empresa'],
  basic:   ['dashboard','chat','crm','kpi','whatsapp_inbox','gerador_leads','rel_estrategico','rel_vendas','cfg_empresa','cfg_usuarios','cfg_produtos'],
  pro:     ['dashboard','chat','crm','kpi','whatsapp_inbox','gerador_leads','disparo_massa','chatbot','agente_ia','script_playbook','campanhas_ia','contas_receber','contas_pagar','rel_estrategico','rel_financeiro','rel_kpis','rel_vendas','rel_comercial','cfg_empresa','cfg_usuarios','cfg_produtos','cfg_descontos','cfg_whatsapp','cfg_agente_ia'],
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

// ══════════════════════════════════════════════════════
// HELPERS
// ══════════════════════════════════════════════════════

const fmt      = n   => 'R$ ' + Number(n||0).toLocaleString('pt-BR', { minimumFractionDigits:2 })
const fmtData  = iso => iso ? new Date(iso).toLocaleDateString('pt-BR') : '—'
const gerarSenha = (len=10) => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789@#!'
  return Array.from({length:len}, () => chars[Math.floor(Math.random()*chars.length)]).join('')
}
const calcVenc = (dias=30) => { const d=new Date(); d.setDate(d.getDate()+dias); return d.toISOString().slice(0,10) }

function toast(msg, tipo='ok') {
  const el = document.getElementById('admin-toast')
  if (!el) return
  el.textContent = msg
  el.style.background = tipo==='ok' ? 'rgba(16,185,129,.92)' : 'rgba(239,68,68,.92)'
  el.style.opacity='1'; el.style.transform='translateY(0)'
  setTimeout(() => { el.style.opacity='0'; el.style.transform='translateY(20px)' }, 4000)
}

// ══════════════════════════════════════════════════════
// COMPONENTE PRINCIPAL
// ══════════════════════════════════════════════════════

export default function AdminPage() {
  const router = useRouter()
  const [loading,      setLoading]      = useState(true)
  const [authorized,   setAuthorized]   = useState(false)
  const [masterUser,   setMasterUser]   = useState(null)
  const [masterCfg,    setMasterCfg]    = useState({})
  const [tenants,      setTenants]      = useState([])
  const [vendedores,   setVendedores]   = useState([])
  const [planos,       setPlanos]       = useState(PLANOS_PADRAO)
  const [aba,          setAba]          = useState('tenants')
  const [busca,        setBusca]        = useState('')
  const [filtroStatus, setFiltroStatus] = useState('')
  const [filtroPlano,  setFiltroPlano]  = useState('')
  const [modalTenant,  setModalTenant]  = useState(null)
  const [modalDelete,  setModalDelete]  = useState(null)
  const [saving,       setSaving]       = useState(false)

  useEffect(() => {
    async function init() {
      const { data:{ session } } = await supabase.auth.getSession()
      if (!session) { router.replace('/'); return }
      const { data:perfil } = await supabase.from('perfis').select('*').eq('user_id', session.user.id).maybeSingle()
      const isMaster = MASTER_EMAILS.includes(session.user.email) || perfil?.perfil==='master_admin' || perfil?.is_master===true
      if (!isMaster) { router.replace('/dashboard'); return }
      setMasterUser({ ...session.user, ...perfil })
      const { data:cfgRow } = await supabase.from('vx_storage').select('value').eq('key','master_cfg').maybeSingle()
      const mc = cfgRow?.value ? JSON.parse(cfgRow.value) : {}
      setMasterCfg(mc)
      if (mc.planosPersonalizados?.length) setPlanos(mc.planosPersonalizados)
      const { data:perfis } = await supabase.from('perfis').select('*')
      setVendedores(perfis||[])
      await carregarTenants()
      setLoading(false); setAuthorized(true)
    }
    init()
  }, [router])

  const carregarTenants = useCallback(async () => {
    const { data:rows } = await supabase.from('vx_storage').select('key,value,updated_at').like('key','tenant:%').order('updated_at',{ascending:false})
    const lista = (rows||[]).map(r => { try { return {...JSON.parse(r.value),_at:r.updated_at} } catch { return null } }).filter(Boolean)
    setTenants(lista)
  }, [])

  async function salvarMasterCfg(novoCfg) {
    const cfg = { ...masterCfg, ...novoCfg }
    setMasterCfg(cfg)
    await supabase.from('vx_storage').upsert({ key:'master_cfg', value:JSON.stringify(cfg), updated_at:new Date().toISOString() }, { onConflict:'key' })
    toast('✅ Configurações salvas!')
  }

  async function cadastrarTenant(dados) {
    setSaving(true)
    try {
      const res = await fetch('/api/cadastrar-tenant', {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ ...dados, masterCfg }),
      })
      const result = await res.json()
      if (!res.ok) throw new Error(result.error||'Erro ao cadastrar')
      toast('✅ Cliente cadastrado! E-mail enviado.')
      await carregarTenants(); setModalTenant(null)
    } catch(err) { toast('❌ '+err.message,'erro') }
    finally { setSaving(false) }
  }

  async function atualizarTenant(dados) {
    setSaving(true)
    try {
      const agora = new Date().toISOString()
      const tenant = { ...dados, atualizadoEm:agora }
      await supabase.from('vx_storage').upsert({ key:`tenant:${dados.id}`, value:JSON.stringify(tenant), updated_at:agora }, { onConflict:'key' })
      const { data:cfgRow } = await supabase.from('vx_storage').select('value').eq('key',`cfg:${dados.empresaId||dados.id}`).maybeSingle()
      const cfgAtual = cfgRow?.value ? JSON.parse(cfgRow.value) : {}
      await supabase.from('vx_storage').upsert({
        key:`cfg:${dados.empresaId||dados.id}`,
        value: JSON.stringify({ ...cfgAtual, company:dados.nomeEmpresa, tenant_plano:dados.plano, tenant_status:dados.status, tenant_modulos:dados.modulosLiberados, tenant_maxUsuarios:dados.maxUsuarios, tenant_vencimento:dados.vencimento, modulosAtivos:dados.modulosLiberados }),
        updated_at:agora,
      }, { onConflict:'key' })
      toast('✅ Atualizado!'); await carregarTenants(); setModalTenant(null)
    } catch(err) { toast('❌ '+err.message,'erro') }
    finally { setSaving(false) }
  }

  async function deletarTenant(id) {
    setSaving(true)
    await supabase.from('vx_storage').delete().eq('key',`tenant:${id}`)
    toast('🗑️ Removido.'); await carregarTenants(); setModalDelete(null); setSaving(false)
  }

  async function alterarStatus(t, st) { await atualizarTenant({...t,status:st}) }

  const tenantsFiltrados = tenants.filter(t => {
    const ok1 = !busca || [t.nomeEmpresa,t.emailAdmin,t.cnpj,t.responsavel].some(v=>v?.toLowerCase().includes(busca.toLowerCase()))
    const ok2 = !filtroStatus || t.status===filtroStatus
    const ok3 = !filtroPlano  || t.plano===filtroPlano
    return ok1&&ok2&&ok3
  })

  const stats = {
    total:     tenants.length,
    ativos:    tenants.filter(t=>t.status==='ativo').length,
    trial:     tenants.filter(t=>t.status==='trial').length,
    suspensos: tenants.filter(t=>t.status==='suspenso').length,
    mrr:       tenants.filter(t=>t.status==='ativo').reduce((a,t)=>a+Number(t.mensalidade||0),0),
  }

  if (loading) return <div style={{minHeight:'100vh',background:'#060c1a',display:'flex',alignItems:'center',justifyContent:'center',fontFamily:'DM Mono,monospace',color:'#64748b'}}><div style={{textAlign:'center'}}><div style={{fontSize:40,marginBottom:12}}>🛡️</div>Verificando acesso...</div></div>
  if (!authorized) return null

  return (
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
            <div><div style={{fontFamily:'Syne,sans-serif',fontWeight:800,fontSize:14,color:'#e2e8f0'}}>MASTER</div><div style={{fontSize:10,color:'#64748b',letterSpacing:1}}>ADMIN</div></div>
          </div>
          <nav className="sidebar-nav">
            {[{id:'tenants',icon:'🏢',label:'Clientes'},{id:'planos',icon:'📦',label:'Planos'},{id:'financeiro',icon:'💰',label:'Financeiro'},{id:'metricas',icon:'📊',label:'Métricas'},{id:'config',icon:'⚙️',label:'Config'}].map(item=>(
              <button key={item.id} className={`nav-btn ${aba===item.id?'active':''}`} onClick={()=>setAba(item.id)}>
                <span>{item.icon}</span><span>{item.label}</span>
              </button>
            ))}
          </nav>
          <div className="sidebar-user">
            <div style={{fontSize:11,color:'#475569'}}>Master Admin</div>
            <div style={{fontSize:11,color:'#94a3b8',marginTop:3,wordBreak:'break-all'}}>{masterUser?.email}</div>
            <button className="btn-sair" onClick={async()=>{await supabase.auth.signOut();router.replace('/')}}>Sair</button>
          </div>
        </aside>

        <main className="admin-main">

          {/* ─── CLIENTES ─── */}
          {aba==='tenants' && <>
            <div className="page-header">
              <div><h1 className="page-title">Clientes / Tenants</h1><p className="page-sub">Gerencie todos os clientes da plataforma</p></div>
              <button className="btn-primary" onClick={()=>setModalTenant('novo')}>+ Novo Cliente</button>
            </div>

            <div className="stats-grid">
              {[{label:'Total',valor:stats.total,icon:'🏢',cor:'#00d4ff'},{label:'Ativos',valor:stats.ativos,icon:'✅',cor:'#10b981'},{label:'Trial',valor:stats.trial,icon:'⏳',cor:'#f59e0b'},{label:'Suspensos',valor:stats.suspensos,icon:'🚫',cor:'#ef4444'},{label:'MRR',valor:fmt(stats.mrr),icon:'💰',cor:'#7c3aed'},{label:'ARR',valor:fmt(stats.mrr*12),icon:'📈',cor:'#ec4899'}].map((s,i)=>(
                <div key={i} className="stat-card" style={{'--cor':s.cor}}>
                  <div className="stat-icon">{s.icon}</div>
                  <div className="stat-val" style={{color:s.cor}}>{s.valor}</div>
                  <div className="stat-label">{s.label}</div>
                </div>
              ))}
            </div>

            <div className="filtros-bar">
              <input className="input-busca" placeholder="🔍 Empresa, e-mail, CNPJ, responsável..." value={busca} onChange={e=>setBusca(e.target.value)}/>
              <select className="select-filtro" value={filtroStatus} onChange={e=>setFiltroStatus(e.target.value)}>
                <option value="">Todos os status</option>
                {STATUS_TENANT.map(s=><option key={s.id} value={s.id}>{s.label}</option>)}
              </select>
              <select className="select-filtro" value={filtroPlano} onChange={e=>setFiltroPlano(e.target.value)}>
                <option value="">Todos os planos</option>
                {planos.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
              <span style={{fontSize:12,color:'#475569',marginLeft:'auto'}}>{tenantsFiltrados.length} resultado(s)</span>
            </div>

            <div className="table-wrap">
              <table className="admin-table">
                <thead><tr><th>Empresa</th><th>Vendedor</th><th>Plano</th><th>Status</th><th>Usuários</th><th>Mensalidade</th><th>Vencimento</th><th>Asaas</th><th>Ações</th></tr></thead>
                <tbody>
                  {tenantsFiltrados.length===0
                    ? <tr><td colSpan={9} style={{textAlign:'center',color:'#475569',padding:'40px 20px'}}>{tenants.length===0?'🏢 Nenhum cliente. Clique em "+ Novo Cliente".':'🔍 Sem resultados.'}</td></tr>
                    : tenantsFiltrados.map(t=>{
                        const plano  = planos.find(p=>p.id===t.plano)
                        const status = STATUS_TENANT.find(s=>s.id===t.status)
                        const vencido = t.vencimento && new Date(t.vencimento)<new Date()
                        const vendedor = vendedores.find(v=>v.user_id===t.vendedorId)
                        return (
                          <tr key={t.id} className="table-row">
                            <td><div style={{fontWeight:600,color:'#e2e8f0',fontSize:13}}>{t.nomeEmpresa}</div><div style={{fontSize:11,color:'#475569'}}>{t.emailAdmin}</div>{t.cnpj&&<div style={{fontSize:10,color:'#334155'}}>{t.cnpj}</div>}</td>
                            <td style={{fontSize:12,color:'#94a3b8'}}>{vendedor?.nome||'—'}</td>
                            <td><span className="badge" style={{background:plano?.cor+'22',color:plano?.cor,border:`1px solid ${plano?.cor}44`}}>{plano?.name||t.plano}</span></td>
                            <td><span className="badge" style={{background:status?.cor+'22',color:status?.cor,border:`1px solid ${status?.cor}44`}}>{status?.label}</span></td>
                            <td style={{color:'#94a3b8',fontSize:13}}>{t.usuariosAtivos||0}/{t.maxUsuarios||'∞'}</td>
                            <td style={{color:'#10b981',fontWeight:600,fontSize:13}}>{t.mensalidade?fmt(t.mensalidade):'—'}</td>
                            <td style={{fontSize:12,color:vencido?'#ef4444':'#94a3b8'}}>{fmtData(t.vencimento)}{vencido&&<div style={{fontSize:10,color:'#ef4444'}}>⚠️ Vencido</div>}</td>
                            <td>{t.asaasCustomerId?<span style={{fontSize:10,color:'#10b981'}}>✅ {t.asaasCustomerId.slice(0,12)}</span>:<span style={{fontSize:10,color:'#334155'}}>—</span>}</td>
                            <td><div style={{display:'flex',gap:6}}>
                              <button className="btn-icon" title="Editar" onClick={()=>setModalTenant(t)}>✏️</button>
                              {t.status==='ativo'?<button className="btn-icon" title="Suspender" onClick={()=>alterarStatus(t,'suspenso')}>🚫</button>:<button className="btn-icon" title="Reativar" onClick={()=>alterarStatus(t,'ativo')}>✅</button>}
                              <button className="btn-icon danger" title="Excluir" onClick={()=>setModalDelete(t)}>🗑️</button>
                            </div></td>
                          </tr>
                        )
                      })
                  }
                </tbody>
              </table>
            </div>
          </>}

          {/* ─── PLANOS ─── */}
          {aba==='planos' && <GerenciarPlanos planos={planos} setPlanos={setPlanos} onSave={p=>{setPlanos(p);salvarMasterCfg({planosPersonalizados:p})}}/>}

          {/* ─── FINANCEIRO ─── */}
          {aba==='financeiro' && <>
            <div className="page-header"><div><h1 className="page-title">Financeiro</h1><p className="page-sub">Receitas e cobranças</p></div></div>
            <div className="stats-grid" style={{gridTemplateColumns:'repeat(3,1fr)'}}>
              {[{label:'MRR',valor:fmt(stats.mrr),icon:'💰',cor:'#10b981'},{label:'ARR',valor:fmt(stats.mrr*12),icon:'📈',cor:'#00d4ff'},{label:'Ticket Médio',valor:stats.ativos>0?fmt(stats.mrr/stats.ativos):'R$ 0,00',icon:'🎯',cor:'#7c3aed'}].map((s,i)=>(
                <div key={i} className="stat-card" style={{'--cor':s.cor}}><div className="stat-icon">{s.icon}</div><div className="stat-val" style={{color:s.cor,fontSize:20}}>{s.valor}</div><div className="stat-label">{s.label}</div></div>
              ))}
            </div>
            <div className="table-wrap" style={{marginTop:24}}>
              <table className="admin-table">
                <thead><tr><th>Empresa</th><th>Plano</th><th>Adesão</th><th>Mensalidade</th><th>Vencimento</th><th>Status</th><th>Asaas ID</th></tr></thead>
                <tbody>
                  {tenants.filter(t=>t.status!=='cancelado').map(t=>{
                    const plano=planos.find(p=>p.id===t.plano), status=STATUS_TENANT.find(s=>s.id===t.status)
                    const vencido=t.vencimento&&new Date(t.vencimento)<new Date()
                    return(<tr key={t.id} className="table-row">
                      <td style={{fontWeight:600,color:'#e2e8f0',fontSize:13}}>{t.nomeEmpresa}</td>
                      <td><span className="badge" style={{background:plano?.cor+'22',color:plano?.cor,border:`1px solid ${plano?.cor}44`}}>{plano?.name}</span></td>
                      <td style={{color:'#94a3b8',fontSize:13}}>{t.adesao?fmt(t.adesao):'—'}</td>
                      <td style={{color:'#10b981',fontWeight:600,fontSize:13}}>{t.mensalidade?fmt(t.mensalidade):'—'}</td>
                      <td style={{fontSize:12,color:vencido?'#ef4444':'#94a3b8'}}>{fmtData(t.vencimento)}</td>
                      <td><span className="badge" style={{background:status?.cor+'22',color:status?.cor,border:`1px solid ${status?.cor}44`}}>{status?.label}</span></td>
                      <td style={{fontSize:11,color:'#475569'}}>{t.asaasCustomerId||'—'}</td>
                    </tr>)
                  })}
                </tbody>
              </table>
            </div>
          </>}

          {/* ─── MÉTRICAS ─── */}
          {aba==='metricas' && <>
            <div className="page-header"><div><h1 className="page-title">Métricas</h1><p className="page-sub">Visão geral da plataforma</p></div></div>
            <div style={{display:'grid',gridTemplateColumns:'repeat(2,1fr)',gap:20}}>
              <div className="card"><h3 className="card-title">📦 Por Plano</h3>
                {planos.map(p=>{const qtd=tenants.filter(t=>t.plano===p.id&&t.status==='ativo').length;const pct=stats.ativos>0?(qtd/stats.ativos)*100:0;return(<div key={p.id} style={{marginTop:12}}><div style={{display:'flex',justifyContent:'space-between',fontSize:12,color:'#94a3b8',marginBottom:4}}><span style={{color:p.cor}}>{p.name}</span><span>{qtd}</span></div><div style={{background:'#1a2540',borderRadius:4,height:6}}><div style={{background:p.cor,width:`${pct}%`,height:'100%',borderRadius:4}}/></div></div>)})}
              </div>
              <div className="card"><h3 className="card-title">📊 Por Status</h3>
                {STATUS_TENANT.map(s=>{const qtd=tenants.filter(t=>t.status===s.id).length;const pct=tenants.length>0?(qtd/tenants.length)*100:0;return(<div key={s.id} style={{marginTop:12}}><div style={{display:'flex',justifyContent:'space-between',fontSize:12,color:'#94a3b8',marginBottom:4}}><span style={{color:s.cor}}>{s.label}</span><span>{qtd} ({pct.toFixed(0)}%)</span></div><div style={{background:'#1a2540',borderRadius:4,height:6}}><div style={{background:s.cor,width:`${pct}%`,height:'100%',borderRadius:4}}/></div></div>)})}
              </div>
              <div className="card" style={{gridColumn:'1/-1'}}><h3 className="card-title">⚠️ Vencimentos nos próximos 30 dias</h3>
                {(()=>{const hoje=new Date(),limite=new Date();limite.setDate(limite.getDate()+30);const prox=tenants.filter(t=>{if(!t.vencimento||t.status==='cancelado')return false;const v=new Date(t.vencimento);return v>=hoje&&v<=limite}).sort((a,b)=>new Date(a.vencimento)-new Date(b.vencimento));if(!prox.length)return<p style={{color:'#475569',fontSize:13,marginTop:12}}>✅ Nenhum vencimento próximo.</p>;return prox.map(t=>{const dias=Math.ceil((new Date(t.vencimento)-hoje)/(86400000));const plano=planos.find(p=>p.id===t.plano);return(<div key={t.id} style={{display:'flex',justifyContent:'space-between',padding:'10px 0',borderBottom:'1px solid #1e2d4a'}}><div><div style={{fontSize:13,color:'#e2e8f0',fontWeight:600}}>{t.nomeEmpresa}</div><div style={{fontSize:11,color:'#475569',marginTop:2}}>{plano?.name} · {fmt(t.mensalidade)}/mês</div></div><div style={{textAlign:'right'}}><div style={{fontSize:12,color:dias<=7?'#ef4444':'#f59e0b'}}>em {dias} dia(s)</div><div style={{fontSize:11,color:'#475569'}}>{fmtData(t.vencimento)}</div></div></div>)})})()}
              </div>
            </div>
          </>}

          {/* ─── CONFIG ─── */}
          {aba==='config' && <ConfigMaster masterCfg={masterCfg} onSave={salvarMasterCfg}/>}
        </main>
      </div>

      {modalTenant && <ModalTenant tenant={modalTenant==='novo'?null:modalTenant} planos={planos} vendedores={vendedores} masterCfg={masterCfg} onSave={d=>d.id?atualizarTenant(d):cadastrarTenant(d)} onClose={()=>setModalTenant(null)} saving={saving}/>}

      {modalDelete && (
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

// ══════════════════════════════════════════════════════
// MODAL TENANT
// ══════════════════════════════════════════════════════

function ModalTenant({ tenant, planos, vendedores, masterCfg, onSave, onClose, saving }) {
  const isNovo = !tenant
  const [abaM,     setAbaM]     = useState('dados')
  const [nome,     setNome]     = useState(tenant?.nomeEmpresa||'')
  const [cnpj,     setCnpj]     = useState(tenant?.cnpj||'')
  const [email,    setEmail]    = useState(tenant?.emailAdmin||'')
  const [senha,    setSenha]    = useState(isNovo?gerarSenha():'')
  const [tel,      setTel]      = useState(tenant?.telefone||'')
  const [resp,     setResp]     = useState(tenant?.responsavel||'')
  const [vendId,   setVendId]   = useState(tenant?.vendedorId||'')
  const [plano,    setPlano]    = useState(tenant?.plano||'basic')
  const [status,   setStatus]   = useState(tenant?.status||'trial')
  const [maxUsu,   setMaxUsu]   = useState(tenant?.maxUsuarios||3)
  const [mensal,   setMensal]   = useState(tenant?.mensalidade||'')
  const [adesao,   setAdesao]   = useState(tenant?.adesao||'')
  const [venc,     setVenc]     = useState(tenant?.vencimento||calcVenc(30))
  const [mods,     setMods]     = useState(tenant?.modulosLiberados||MODULOS_POR_PLANO['basic'])
  const [obs,      setObs]      = useState(tenant?.obs||'')
  const [asaas,    setAsaas]    = useState(isNovo&&!!masterCfg?.asaasKey)
  const [billing,  setBilling]  = useState('BOLETO')
  const [sendMail, setSendMail] = useState(isNovo)
  const [visible,  setVisible]  = useState(false)

  function changePlano(p) {
    setPlano(p)
    const pl = planos.find(x=>x.id===p)
    if (pl) { setMaxUsu(pl.maxUsuarios===999?999:pl.maxUsuarios); if(pl.mensalidade)setMensal(pl.mensalidade); if(pl.adesao)setAdesao(pl.adesao) }
    setMods(MODULOS_POR_PLANO[p]||[])
  }

  function toggleMod(id) { setMods(prev=>prev.includes(id)?prev.filter(m=>m!==id):[...prev,id]) }
  function toggleGrupo(grupo) {
    const ids=TODOS_MODULOS.filter(m=>m.grupo===grupo).map(m=>m.id)
    const all=ids.every(id=>mods.includes(id))
    setMods(prev=>all?prev.filter(m=>!ids.includes(m)):[...new Set([...prev,...ids])])
  }

  function salvar() {
    if (!nome.trim()) { alert('Informe o nome da empresa.'); return }
    if (!email.trim()) { alert('Informe o e-mail.'); return }
    if (isNovo && !senha.trim()) { alert('Defina uma senha.'); return }
    onSave({ id:tenant?.id, empresaId:tenant?.empresaId, nomeEmpresa:nome.trim(), cnpj:cnpj.trim(), emailAdmin:email.trim().toLowerCase(), senha:isNovo?senha:undefined, telefone:tel.trim(), responsavel:resp.trim(), vendedorId:vendId, plano, status, maxUsuarios:Number(maxUsu), mensalidade:Number(String(mensal).replace(',','.')), adesao:Number(String(adesao).replace(',','.')), vencimento:venc, modulosLiberados:mods, obs:obs.trim(), criarAsaas:asaas, billingType:billing, sendEmail:sendMail, criadoEm:tenant?.criadoEm })
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" style={{maxWidth:740,maxHeight:'92vh',overflowY:'auto'}} onClick={e=>e.stopPropagation()}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:20}}>
          <h2 style={{fontFamily:'Syne,sans-serif',fontSize:18,color:'#00d4ff'}}>{isNovo?'🏢 Novo Cliente':`✏️ ${tenant.nomeEmpresa}`}</h2>
          <button onClick={onClose} style={{background:'none',border:'none',color:'#64748b',fontSize:20,cursor:'pointer'}}>✕</button>
        </div>

        <div style={{display:'flex',gap:6,marginBottom:20,borderBottom:'1px solid #1e2d4a',paddingBottom:12}}>
          {[{id:'dados',label:'📋 Dados'},{id:'plano',label:'📦 Plano'},{id:'modulos',label:'🔐 Módulos'},{id:'acesso',label:'🔑 Acesso'}].map(a=>(
            <button key={a.id} onClick={()=>setAbaM(a.id)} style={{padding:'6px 14px',borderRadius:6,border:'none',cursor:'pointer',fontSize:12,background:abaM===a.id?'#00d4ff22':'transparent',color:abaM===a.id?'#00d4ff':'#64748b',fontFamily:'DM Mono,monospace'}}>{a.label}</button>
          ))}
        </div>

        {/* DADOS */}
        {abaM==='dados' && <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:14}}>
          <div className="field" style={{gridColumn:'1/-1'}}><label>Nome da Empresa *</label><input value={nome} onChange={e=>setNome(e.target.value)} placeholder="Ex: Contabilidade ABC Ltda"/></div>
          <div className="field"><label>CNPJ</label><input value={cnpj} onChange={e=>setCnpj(e.target.value)} placeholder="00.000.000/0001-00"/></div>
          <div className="field"><label>Responsável</label><input value={resp} onChange={e=>setResp(e.target.value)} placeholder="Nome do responsável"/></div>
          <div className="field"><label>E-mail Admin *</label><input type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="admin@empresa.com"/></div>
          <div className="field"><label>Telefone / WhatsApp</label><input value={tel} onChange={e=>setTel(e.target.value)} placeholder="(11) 9 9999-9999"/></div>
          <div className="field" style={{gridColumn:'1/-1'}}><label>👔 Vendedor responsável pela venda</label>
            <select value={vendId} onChange={e=>setVendId(e.target.value)}>
              <option value="">— Selecionar vendedor —</option>
              {vendedores.map(v=><option key={v.user_id} value={v.user_id}>{v.nome} ({v.email})</option>)}
            </select>
          </div>
          <div className="field" style={{gridColumn:'1/-1'}}><label>Observações internas</label>
            <textarea value={obs} onChange={e=>setObs(e.target.value)} placeholder="Condições especiais, anotações..." rows={3} style={{width:'100%',background:'#1a2540',border:'1px solid #1e2d4a',borderRadius:8,padding:'9px 12px',color:'#e2e8f0',fontFamily:'DM Mono,monospace',fontSize:13,resize:'vertical'}}/>
          </div>
        </div>}

        {/* PLANO */}
        {abaM==='plano' && <div>
          <label style={{fontSize:12,color:'#64748b',display:'block',marginBottom:10}}>Plano Contratado</label>
          <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:10,marginBottom:20}}>
            {planos.map(p=>(
              <button key={p.id} onClick={()=>changePlano(p.id)} style={{padding:'12px 10px',borderRadius:10,border:`2px solid ${plano===p.id?p.cor:'#1e2d4a'}`,background:plano===p.id?p.cor+'22':'#111827',color:plano===p.id?p.cor:'#64748b',cursor:'pointer',fontFamily:'Syne,sans-serif',fontWeight:700,fontSize:13}}>
                {p.name}
                <div style={{fontSize:10,marginTop:4,fontFamily:'DM Mono,monospace',fontWeight:400}}>{p.maxUsuarios===999?'ilimitado':`até ${p.maxUsuarios} usr`}</div>
                {p.mensalidade>0&&<div style={{fontSize:11,marginTop:2,fontFamily:'DM Mono,monospace'}}>{fmt(p.mensalidade)}/mês</div>}
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
            <label style={{fontSize:12,color:'#64748b',display:'block',marginBottom:8}}>⚡ Atalhos de vencimento</label>
            <div style={{display:'flex',gap:8}}>{[7,14,30,90,365].map(d=><button key={d} onClick={()=>setVenc(calcVenc(d))} style={{padding:'5px 12px',background:'#1a2540',border:'1px solid #1e2d4a',borderRadius:6,color:'#94a3b8',fontSize:11,cursor:'pointer',fontFamily:'DM Mono,monospace'}}>+{d}d</button>)}</div>
          </div>
          {masterCfg?.asaasKey && <div style={{marginTop:20,padding:16,background:'#0d1526',borderRadius:10,border:'1px solid #1e2d4a'}}>
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:12}}>
              <span style={{fontSize:13,color:'#e2e8f0',fontWeight:600}}>🏦 Integração Asaas</span>
              <label style={{display:'flex',alignItems:'center',gap:8,cursor:'pointer'}}><input type="checkbox" checked={asaas} onChange={e=>setAsaas(e.target.checked)}/><span style={{fontSize:12,color:'#94a3b8'}}>Criar cliente + assinatura no Asaas</span></label>
            </div>
            {asaas && <div className="field"><label>Forma de pagamento</label><select value={billing} onChange={e=>setBilling(e.target.value)}><option value="BOLETO">Boleto bancário</option><option value="PIX">PIX</option><option value="CREDIT_CARD">Cartão de crédito</option><option value="UNDEFINED">Deixar cliente escolher</option></select></div>}
          </div>}
        </div>}

        {/* MÓDULOS */}
        {abaM==='modulos' && <div>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:16}}>
            <span style={{fontSize:12,color:'#64748b'}}>{mods.length}/{TODOS_MODULOS.length} módulos liberados</span>
            <div style={{display:'flex',gap:8}}>
              <button onClick={()=>setMods(TODOS_MODULOS.map(m=>m.id))} style={{padding:'4px 10px',background:'#10b98122',border:'1px solid #10b98144',borderRadius:6,color:'#10b981',fontSize:11,cursor:'pointer',fontFamily:'DM Mono,monospace'}}>Todos</button>
              <button onClick={()=>setMods([])} style={{padding:'4px 10px',background:'#ef444422',border:'1px solid #ef444444',borderRadius:6,color:'#ef4444',fontSize:11,cursor:'pointer',fontFamily:'DM Mono,monospace'}}>Nenhum</button>
            </div>
          </div>
          {GRUPOS.map(grupo=>{
            const gMods=TODOS_MODULOS.filter(m=>m.grupo===grupo)
            const all=gMods.every(m=>mods.includes(m.id))
            return(<div key={grupo} style={{marginBottom:20}}>
              <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:10}}>
                <span style={{fontSize:12,color:'#94a3b8',fontWeight:600}}>{grupo}</span>
                <button onClick={()=>toggleGrupo(grupo)} style={{padding:'2px 8px',background:all?'#00d4ff22':'#1a2540',border:`1px solid ${all?'#00d4ff44':'#1e2d4a'}`,borderRadius:4,color:all?'#00d4ff':'#475569',fontSize:10,cursor:'pointer',fontFamily:'DM Mono,monospace'}}>{all?'desmarcar':'marcar'}</button>
              </div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:6}}>
                {gMods.map(mod=>{const ativo=mods.includes(mod.id);return(
                  <div key={mod.id} onClick={()=>toggleMod(mod.id)} style={{display:'flex',alignItems:'center',gap:10,padding:'9px 12px',borderRadius:8,border:`1px solid ${ativo?'#00d4ff44':'#1e2d4a'}`,background:ativo?'#00d4ff0d':'#111827',cursor:'pointer'}}>
                    <div style={{width:15,height:15,borderRadius:3,border:`2px solid ${ativo?'#00d4ff':'#334155'}`,background:ativo?'#00d4ff':'transparent',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>{ativo&&<span style={{fontSize:9,color:'#000',fontWeight:900}}>✓</span>}</div>
                    <span style={{fontSize:11,color:ativo?'#e2e8f0':'#64748b'}}>{mod.label}</span>
                  </div>
                )})}
              </div>
            </div>)
          })}
        </div>}

        {/* ACESSO */}
        {abaM==='acesso' && <div style={{display:'flex',flexDirection:'column',gap:16}}>
          {isNovo && <div style={{padding:16,background:'#0d1526',borderRadius:10,border:'1px solid #1e2d4a'}}>
            <h3 style={{fontSize:13,color:'#e2e8f0',marginBottom:14}}>🔑 Credenciais de Acesso</h3>
            <div className="field" style={{marginBottom:12}}><label>Login (E-mail)</label><input value={email} readOnly style={{background:'#0a0f1e',opacity:.7}}/></div>
            <div className="field"><label>Senha inicial</label>
              <div style={{position:'relative'}}>
                <input type={visible?'text':'password'} value={senha} onChange={e=>setSenha(e.target.value)} style={{width:'100%',background:'#1a2540',border:'1px solid #1e2d4a',borderRadius:8,padding:'9px 44px 9px 12px',color:'#e2e8f0',fontFamily:'DM Mono,monospace',fontSize:13}}/>
                <button onClick={()=>setVisible(!visible)} style={{position:'absolute',right:10,top:'50%',transform:'translateY(-50%)',background:'none',border:'none',cursor:'pointer',fontSize:14}}>{visible?'🙈':'👁️'}</button>
              </div>
            </div>
            <button onClick={()=>setSenha(gerarSenha())} style={{marginTop:8,padding:'5px 12px',background:'#1a2540',border:'1px solid #1e2d4a',borderRadius:6,color:'#94a3b8',fontSize:11,cursor:'pointer',fontFamily:'DM Mono,monospace'}}>🔄 Gerar nova senha</button>
            <div style={{marginTop:12,padding:10,background:'rgba(239,68,68,.07)',border:'1px solid rgba(239,68,68,.2)',borderRadius:8,fontSize:11,color:'#ef4444',lineHeight:1.5}}>⚠️ Guarde esta senha — será enviada por e-mail ao cliente.</div>
          </div>}
          <div style={{padding:16,background:'#0d1526',borderRadius:10,border:'1px solid #1e2d4a'}}>
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:12}}>
              <h3 style={{fontSize:13,color:'#e2e8f0'}}>📧 E-mail de Boas-vindas</h3>
              <label style={{display:'flex',alignItems:'center',gap:8,cursor:'pointer'}}><input type="checkbox" checked={sendMail} onChange={e=>setSendMail(e.target.checked)}/><span style={{fontSize:12,color:'#94a3b8'}}>Enviar ao cadastrar</span></label>
            </div>
            {sendMail && <div style={{padding:12,background:'#111827',borderRadius:8,fontSize:12,color:'#64748b',lineHeight:1.7}}>
              <div style={{color:'#94a3b8',marginBottom:4}}>Prévia:</div>
              <div style={{color:'#e2e8f0'}}>Assunto: <strong>Bem-vindo(a) à Vivanexa — Seus dados de acesso</strong></div>
              <div style={{marginTop:6,color:'#64748b'}}>Olá <strong style={{color:'#94a3b8'}}>{resp||nome||'[nome]'}</strong>, seu acesso foi criado!<br/>🌐 {masterCfg?.siteUrl||'vivanexa-saas.vercel.app'}<br/>👤 {email||'[email]'}<br/>🔑 {isNovo?'••••••••':'[não alterada]'}</div>
            </div>}
            {!masterCfg?.smtpHost && <div style={{marginTop:10,padding:10,background:'rgba(245,158,11,.07)',border:'1px solid rgba(245,158,11,.2)',borderRadius:8,fontSize:11,color:'#f59e0b'}}>⚠️ SMTP não configurado. Configure em Configurações → Config.</div>}
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

// ══════════════════════════════════════════════════════
// GERENCIAR PLANOS
// ══════════════════════════════════════════════════════

function GerenciarPlanos({ planos, setPlanos, onSave }) {
  const [saving, setSaving] = useState(false)
  function upd(id, campo, val) { setPlanos(prev=>prev.map(p=>p.id===id?{...p,[campo]:val}:p)) }
  async function salvar() { setSaving(true); await onSave(planos); setSaving(false) }
  return (
    <div>
      <div className="page-header">
        <div><h1 className="page-title">Planos do Sistema</h1><p className="page-sub">Configure valores, limites e módulos padrão por plano</p></div>
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
              <div style={{fontSize:11,color:'#64748b'}}>Módulos incluídos: <strong style={{color:'#e2e8f0'}}>{(MODULOS_POR_PLANO[p.id]||[]).length}</strong></div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════════════
// CONFIG MASTER
// ══════════════════════════════════════════════════════

function ConfigMaster({ masterCfg, onSave }) {
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

  async function salvar() { setSaving(true); await onSave({smtpHost,smtpPort,smtpUser,smtpPass,smtpFrom,asaasKey,asaasSandbox:sandbox,siteUrl}); setSaving(false) }

  async function testar() {
    setTesting(true); setTestMsg('')
    try {
      const res = await fetch('/api/send-email',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({to:smtpUser,subject:'✅ Teste SMTP — Vivanexa',html:'<p>E-mail de teste enviado com sucesso! 🎉</p>',config:{smtpHost,smtpPort:Number(smtpPort),smtpUser,smtpPass}})})
      const d = await res.json()
      setTestMsg(d.success?'✅ Enviado com sucesso!':'❌ '+d.error)
    } catch(e){setTestMsg('❌ '+e.message)}
    setTesting(false)
  }

  return (
    <div>
      <div className="page-header">
        <div><h1 className="page-title">Configurações Master</h1><p className="page-sub">SMTP, Asaas e configurações gerais</p></div>
        <button className="btn-primary" disabled={saving} onClick={salvar}>{saving?'Salvando...':'💾 Salvar'}</button>
      </div>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:20}}>
        <div className="card" style={{gridColumn:'1/-1'}}>
          <h3 className="card-title" style={{marginBottom:16}}>📧 E-mail / SMTP</h3>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:14}}>
            <div className="field"><label>Servidor SMTP</label><input value={smtpHost} onChange={e=>setSmtpHost(e.target.value)} placeholder="smtp.gmail.com / smtp.brevo.com"/></div>
            <div className="field"><label>Porta</label><input value={smtpPort} onChange={e=>setSmtpPort(e.target.value)} placeholder="587"/></div>
            <div className="field"><label>Usuário / E-mail</label><input value={smtpUser} onChange={e=>setSmtpUser(e.target.value)} placeholder="seu@email.com"/></div>
            <div className="field"><label>Senha / App Password</label><input type="password" value={smtpPass} onChange={e=>setSmtpPass(e.target.value)} placeholder="••••••••"/></div>
            <div className="field" style={{gridColumn:'1/-1'}}><label>Nome remetente</label><input value={smtpFrom} onChange={e=>setSmtpFrom(e.target.value)} placeholder='Vivanexa <noreply@suaempresa.com>'/></div>
          </div>
          <div style={{marginTop:14,display:'flex',alignItems:'center',gap:12}}>
            <button onClick={testar} disabled={testing||!smtpHost} style={{padding:'8px 16px',background:'#1a2540',border:'1px solid #1e2d4a',borderRadius:8,color:'#94a3b8',fontSize:12,cursor:'pointer',fontFamily:'DM Mono,monospace'}}>{testing?'Enviando...':'📨 Testar'}</button>
            {testMsg&&<span style={{fontSize:12,color:testMsg.startsWith('✅')?'#10b981':'#ef4444'}}>{testMsg}</span>}
          </div>
          <div style={{marginTop:10,fontSize:11,color:'#475569',lineHeight:1.6}}>💡 Gmail: use App Password com 2FA. Brevo/SendGrid: use chave de API como senha.</div>
        </div>
        <div className="card">
          <h3 className="card-title" style={{marginBottom:16}}>🏦 Asaas</h3>
          <div style={{display:'flex',flexDirection:'column',gap:14}}>
            <div className="field"><label>Chave de API</label><input type="password" value={asaasKey} onChange={e=>setAsaasKey(e.target.value)} placeholder="$aact_..."/></div>
            <label style={{display:'flex',alignItems:'center',gap:10,cursor:'pointer',fontSize:12,color:'#94a3b8'}}><input type="checkbox" checked={sandbox} onChange={e=>setSandbox(e.target.checked)}/>Usar Sandbox (testes)</label>
            <div style={{padding:10,background:'rgba(0,212,255,.06)',border:'1px solid rgba(0,212,255,.15)',borderRadius:8,fontSize:11,color:'#64748b',lineHeight:1.6}}>Com a chave configurada, ao cadastrar um cliente será criado automaticamente no Asaas: cliente + cobrança de adesão (avulsa) + assinatura mensal recorrente.</div>
          </div>
        </div>
        <div className="card">
          <h3 className="card-title" style={{marginBottom:16}}>🌐 URL do Sistema</h3>
          <div className="field"><label>URL base (para e-mails)</label><input value={siteUrl} onChange={e=>setSiteUrl(e.target.value)} placeholder="https://vivanexa-saas.vercel.app"/></div>
          <div style={{marginTop:12,fontSize:11,color:'#475569',lineHeight:1.6}}>Usada no e-mail de boas-vindas enviado ao cliente.</div>
        </div>
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════════════
// CSS
// ══════════════════════════════════════════════════════

const CSS = `
*, *::before, *::after { box-sizing:border-box; margin:0; padding:0; }
:root { --bg:#060c1a; --surface:#0d1526; --s2:#111827; --s3:#1a2540; --border:#1e2d4a; --accent:#00d4ff; --text:#e2e8f0; --muted:#64748b; }
body { font-family:'DM Mono',monospace; background:var(--bg); color:var(--text); }
.toast { position:fixed; bottom:28px; right:28px; z-index:9999; color:#fff; padding:12px 22px; border-radius:10px; font-size:13px; font-weight:600; opacity:0; transform:translateY(20px); transition:all .35s ease; pointer-events:none; box-shadow:0 4px 20px rgba(0,0,0,.4); }
.admin-wrap { display:flex; min-height:100vh; }
.admin-sidebar { width:220px; min-height:100vh; background:var(--surface); border-right:1px solid var(--border); display:flex; flex-direction:column; padding:20px 0; position:sticky; top:0; height:100vh; }
.sidebar-logo { display:flex; align-items:center; gap:12px; padding:0 20px 20px; border-bottom:1px solid var(--border); margin-bottom:16px; }
.sidebar-nav { flex:1; display:flex; flex-direction:column; gap:4px; padding:0 10px; }
.nav-btn { display:flex; align-items:center; gap:10px; padding:10px 14px; border-radius:8px; border:none; background:transparent; color:var(--muted); cursor:pointer; font-family:'DM Mono',monospace; font-size:13px; transition:all .2s; text-align:left; width:100%; }
.nav-btn:hover { background:var(--s3); color:var(--text); }
.nav-btn.active { background:rgba(0,212,255,.12); color:var(--accent); }
.sidebar-user { padding:16px 20px; border-top:1px solid var(--border); margin-top:16px; }
.btn-sair { margin-top:10px; width:100%; padding:7px; border-radius:6px; border:1px solid var(--border); background:transparent; color:var(--muted); cursor:pointer; font-family:'DM Mono',monospace; font-size:11px; transition:all .2s; }
.btn-sair:hover { border-color:#ef4444; color:#ef4444; }
.admin-main { flex:1; padding:32px; overflow-y:auto; }
.page-header { display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:24px; }
.page-title { font-family:'Syne',sans-serif; font-size:22px; font-weight:800; color:var(--text); }
.page-sub { font-size:12px; color:var(--muted); margin-top:4px; }
.stats-grid { display:grid; grid-template-columns:repeat(6,1fr); gap:14px; margin-bottom:24px; }
.stat-card { background:var(--s2); border:1px solid var(--border); border-top:2px solid var(--cor,#1e2d4a); border-radius:12px; padding:16px; text-align:center; }
.stat-icon { font-size:20px; margin-bottom:8px; }
.stat-val { font-family:'Syne',sans-serif; font-size:22px; font-weight:800; line-height:1; margin-bottom:4px; }
.stat-label { font-size:11px; color:var(--muted); }
.filtros-bar { display:flex; gap:10px; align-items:center; margin-bottom:16px; flex-wrap:wrap; }
.input-busca { flex:1; min-width:200px; background:var(--s2); border:1px solid var(--border); border-radius:8px; padding:9px 14px; color:var(--text); font-family:'DM Mono',monospace; font-size:13px; outline:none; }
.input-busca:focus { border-color:var(--accent); }
.select-filtro { background:var(--s2); border:1px solid var(--border); border-radius:8px; padding:9px 14px; color:var(--text); font-family:'DM Mono',monospace; font-size:13px; outline:none; cursor:pointer; }
.table-wrap { background:var(--s2); border:1px solid var(--border); border-radius:12px; overflow:hidden; }
.admin-table { width:100%; border-collapse:collapse; }
.admin-table th { padding:12px 16px; text-align:left; font-size:11px; color:var(--muted); border-bottom:1px solid var(--border); background:var(--surface); letter-spacing:.5px; }
.admin-table td { padding:12px 16px; border-bottom:1px solid #0d1526; vertical-align:middle; }
.table-row:hover { background:rgba(0,212,255,.025); }
.table-row:last-child td { border-bottom:none; }
.badge { display:inline-block; padding:3px 10px; border-radius:20px; font-size:11px; font-weight:600; }
.btn-primary { padding:10px 22px; border-radius:8px; background:linear-gradient(135deg,var(--accent),#0099bb); border:none; color:#000; font-family:'DM Mono',monospace; font-size:13px; font-weight:700; cursor:pointer; transition:all .2s; }
.btn-primary:hover:not(:disabled) { box-shadow:0 0 20px rgba(0,212,255,.35); transform:translateY(-1px); }
.btn-primary:disabled { opacity:.5; cursor:not-allowed; }
.btn-secondary { padding:10px 22px; border-radius:8px; background:transparent; border:1px solid var(--border); color:var(--muted); font-family:'DM Mono',monospace; font-size:13px; cursor:pointer; transition:all .2s; }
.btn-secondary:hover { border-color:var(--muted); color:var(--text); }
.btn-danger { padding:10px 22px; border-radius:8px; background:rgba(239,68,68,.15); border:1px solid rgba(239,68,68,.3); color:#ef4444; font-family:'DM Mono',monospace; font-size:13px; font-weight:600; cursor:pointer; }
.btn-danger:hover:not(:disabled) { background:rgba(239,68,68,.25); }
.btn-danger:disabled { opacity:.5; cursor:not-allowed; }
.btn-icon { width:30px; height:30px; border-radius:6px; background:var(--surface); border:1px solid var(--border); cursor:pointer; display:flex; align-items:center; justify-content:center; font-size:14px; transition:all .15s; }
.btn-icon:hover { background:var(--s3); border-color:var(--accent); }
.btn-icon.danger:hover { border-color:#ef4444; }
.card { background:var(--s2); border:1px solid var(--border); border-radius:12px; padding:20px; }
.card-title { font-family:'Syne',sans-serif; font-size:14px; font-weight:700; color:var(--text); }
.modal-overlay { position:fixed; inset:0; background:rgba(0,0,0,.75); display:flex; align-items:center; justify-content:center; z-index:9000; padding:20px; backdrop-filter:blur(4px); }
.modal-box { background:var(--surface); border:1px solid var(--border); border-radius:16px; padding:28px; width:100%; box-shadow:0 8px 48px rgba(0,0,0,.6); }
.field { display:flex; flex-direction:column; gap:5px; }
.field label { font-size:11px; color:var(--muted); letter-spacing:.5px; }
.field input, .field select, .field textarea { background:var(--s3); border:1px solid var(--border); border-radius:8px; padding:9px 12px; color:var(--text); font-family:'DM Mono',monospace; font-size:13px; outline:none; transition:border-color .2s; }
.field input:focus, .field select:focus { border-color:var(--accent); }
.field input::placeholder, .field textarea::placeholder { color:var(--muted); }
@media(max-width:900px){.stats-grid{grid-template-columns:repeat(3,1fr);}.admin-sidebar{width:60px;}.sidebar-logo div,.nav-btn span:last-child,.sidebar-user{display:none;}.nav-btn{justify-content:center;}.admin-main{padding:20px 16px;}}
`
