// pages/admin.js — Vivanexa Master Admin
// Acesso restrito: apenas super admin (master_admin no perfil)
// Gerencia: tenants (clientes), planos, módulos liberados, usuários, cobrança

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/router'
import Head from 'next/head'
import { supabase } from '../lib/supabase'

// ══════════════════════════════════════════════════════
// CONSTANTES DO SISTEMA
// ══════════════════════════════════════════════════════

const MASTER_EMAILS = ['admin@vivanexa.com.br', 'master@vivanexa.com.br']
// Adicione aqui os e-mails dos super admins da Vivanexa

const TODOS_MODULOS = [
  { id: 'chat',           label: '💬 Chat / Assistente IA',    grupo: 'Comercial' },
  { id: 'crm',            label: '🤝 CRM',                     grupo: 'Comercial' },
  { id: 'whatsapp_inbox', label: '📱 WhatsApp Inbox',          grupo: 'Comercial' },
  { id: 'gerador_leads',  label: '🎯 Gerador de Leads',        grupo: 'Comercial' },
  { id: 'prospeccao',     label: '📣 Prospecção / Chatbot',    grupo: 'Comercial' },
  { id: 'marketing',      label: '📣 Marketing IA',            grupo: 'Marketing' },
  { id: 'financeiro',     label: '💰 Financeiro',              grupo: 'Financeiro' },
  { id: 'reports',        label: '📈 Relatórios',              grupo: 'Relatórios' },
  { id: 'kpi',            label: '📊 KPIs',                    grupo: 'Gestão' },
  { id: 'configuracoes',  label: '⚙️ Configurações',           grupo: 'Gestão' },
  { id: 'dashboard',      label: '🏠 Dashboard',               grupo: 'Gestão' },
  { id: 'documentos',     label: '📄 Documentos / Contratos',  grupo: 'Gestão' },
]

const PLANOS_SISTEMA = [
  { id: 'starter',  name: 'Starter',   maxUsuarios: 2,   maxLeads: 500,  cor: '#64748b' },
  { id: 'basic',    name: 'Basic',     maxUsuarios: 3,   maxLeads: 2000, cor: '#00d4ff' },
  { id: 'pro',      name: 'Pro',       maxUsuarios: 8,   maxLeads: 5000, cor: '#7c3aed' },
  { id: 'top',      name: 'Top',       maxUsuarios: 20,  maxLeads: 15000,cor: '#10b981' },
  { id: 'topplus',  name: 'Top Plus',  maxUsuarios: 999, maxLeads: 99999,cor: '#f59e0b' },
  { id: 'custom',   name: 'Custom',    maxUsuarios: 0,   maxLeads: 0,    cor: '#ec4899' },
]

const STATUS_TENANT = [
  { id: 'trial',    label: 'Trial',      cor: '#f59e0b' },
  { id: 'ativo',    label: 'Ativo',      cor: '#10b981' },
  { id: 'suspenso', label: 'Suspenso',   cor: '#ef4444' },
  { id: 'cancelado',label: 'Cancelado',  cor: '#64748b' },
]

// Módulos padrão por plano
const MODULOS_POR_PLANO = {
  starter: ['dashboard', 'chat', 'crm', 'kpi'],
  basic:   ['dashboard', 'chat', 'crm', 'kpi', 'reports', 'gerador_leads', 'configuracoes'],
  pro:     ['dashboard', 'chat', 'crm', 'kpi', 'reports', 'gerador_leads', 'prospeccao', 'whatsapp_inbox', 'financeiro', 'configuracoes'],
  top:     TODOS_MODULOS.map(m => m.id),
  topplus: TODOS_MODULOS.map(m => m.id),
  custom:  [],
}

// ══════════════════════════════════════════════════════
// HELPERS
// ══════════════════════════════════════════════════════

function fmt(n) {
  return 'R$ ' + Number(n || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })
}

function fmtData(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('pt-BR')
}

function toast(msg, tipo = 'ok') {
  const el = document.getElementById('admin-toast')
  if (!el) return
  el.textContent = msg
  el.style.background = tipo === 'ok' ? 'rgba(16,185,129,.92)' : 'rgba(239,68,68,.92)'
  el.style.opacity = '1'
  el.style.transform = 'translateY(0)'
  setTimeout(() => { el.style.opacity = '0'; el.style.transform = 'translateY(20px)' }, 3500)
}

function gerarId() {
  return `ten_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
}

function calcVencimento(dias = 30) {
  const d = new Date()
  d.setDate(d.getDate() + dias)
  return d.toISOString().slice(0, 10)
}

// ══════════════════════════════════════════════════════
// COMPONENTE PRINCIPAL
// ══════════════════════════════════════════════════════

export default function AdminPage() {
  const router = useRouter()
  const [loading,       setLoading]       = useState(true)
  const [authorized,    setAuthorized]    = useState(false)
  const [masterUser,    setMasterUser]    = useState(null)
  const [tenants,       setTenants]       = useState([])
  const [aba,           setAba]           = useState('tenants')
  const [busca,         setBusca]         = useState('')
  const [filtroStatus,  setFiltroStatus]  = useState('')
  const [filtroPlano,   setFiltroPlano]   = useState('')
  const [modalTenant,   setModalTenant]   = useState(null) // null | 'novo' | {tenant}
  const [modalDelete,   setModalDelete]   = useState(null)
  const [saving,        setSaving]        = useState(false)

  // ── Verificar acesso master ────────────────────────
  useEffect(() => {
    async function init() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.replace('/'); return }

      const { data: perfil } = await supabase
        .from('perfis').select('*').eq('user_id', session.user.id).maybeSingle()

      const isMaster =
        MASTER_EMAILS.includes(session.user.email) ||
        perfil?.perfil === 'master_admin' ||
        perfil?.is_master === true

      if (!isMaster) { router.replace('/dashboard'); return }

      setMasterUser({ ...session.user, ...perfil })
      setAuthorized(true)
      await carregarTenants()
      setLoading(false)
    }
    init()
  }, [router])

  // ── Carregar todos os tenants ──────────────────────
  const carregarTenants = useCallback(async () => {
    // Buscar todos os registros de tenant no vx_storage
    const { data: rows } = await supabase
      .from('vx_storage')
      .select('key, value, updated_at')
      .like('key', 'tenant:%')
      .order('updated_at', { ascending: false })

    const lista = (rows || []).map(r => {
      try { return { ...JSON.parse(r.value), _updatedAt: r.updated_at } }
      catch { return null }
    }).filter(Boolean)

    setTenants(lista)
    return lista
  }, [])

  // ── Salvar tenant ──────────────────────────────────
  async function salvarTenant(dados) {
    setSaving(true)
    try {
      const isNovo = !dados.id
      const id = dados.id || gerarId()
      const agora = new Date().toISOString()

      const tenant = {
        ...dados,
        id,
        criadoEm: dados.criadoEm || agora,
        atualizadoEm: agora,
      }

      // Salvar registro do tenant
      const { error: e1 } = await supabase.from('vx_storage').upsert(
        { key: `tenant:${id}`, value: JSON.stringify(tenant), updated_at: agora },
        { onConflict: 'key' }
      )
      if (e1) throw new Error(e1.message)

      // Se novo, criar/atualizar o cfg da empresa com módulos e limites
      const { data: cfgRow } = await supabase
        .from('vx_storage').select('value').eq('key', `cfg:${id}`).maybeSingle()

      const cfgAtual = cfgRow?.value ? JSON.parse(cfgRow.value) : {}

      const novoCfg = {
        ...cfgAtual,
        company: dados.nomeEmpresa,
        tenant_plano: dados.plano,
        tenant_status: dados.status,
        tenant_modulos: dados.modulosLiberados || [],
        tenant_maxUsuarios: dados.maxUsuarios,
        tenant_vencimento: dados.vencimento,
        tenant_mensalidade: dados.mensalidade,
        tenant_adesao: dados.adesao,
        tenant_obs: dados.obs,
        // Atualizar também a lista de módulos visíveis no menu
        modulosAtivos: dados.modulosLiberados || [],
      }

      const { error: e2 } = await supabase.from('vx_storage').upsert(
        { key: `cfg:${id}`, value: JSON.stringify(novoCfg), updated_at: agora },
        { onConflict: 'key' }
      )
      if (e2) throw new Error(e2.message)

      toast(isNovo ? '✅ Cliente cadastrado com sucesso!' : '✅ Cliente atualizado!')
      await carregarTenants()
      setModalTenant(null)
    } catch (err) {
      toast('❌ Erro: ' + err.message, 'erro')
    } finally {
      setSaving(false)
    }
  }

  // ── Deletar tenant ─────────────────────────────────
  async function deletarTenant(id) {
    setSaving(true)
    try {
      await supabase.from('vx_storage').delete().eq('key', `tenant:${id}`)
      toast('🗑️ Cliente removido.')
      await carregarTenants()
      setModalDelete(null)
    } catch (err) {
      toast('❌ Erro ao remover: ' + err.message, 'erro')
    } finally {
      setSaving(false)
    }
  }

  // ── Suspender / Reativar ───────────────────────────
  async function alterarStatus(tenant, novoStatus) {
    await salvarTenant({ ...tenant, status: novoStatus })
  }

  // ── Filtros ────────────────────────────────────────
  const tenantsFiltrados = tenants.filter(t => {
    const ok1 = !busca || t.nomeEmpresa?.toLowerCase().includes(busca.toLowerCase()) || t.emailAdmin?.toLowerCase().includes(busca.toLowerCase()) || t.cnpj?.includes(busca)
    const ok2 = !filtroStatus || t.status === filtroStatus
    const ok3 = !filtroPlano || t.plano === filtroPlano
    return ok1 && ok2 && ok3
  })

  // ── Stats ──────────────────────────────────────────
  const stats = {
    total:     tenants.length,
    ativos:    tenants.filter(t => t.status === 'ativo').length,
    trial:     tenants.filter(t => t.status === 'trial').length,
    suspensos: tenants.filter(t => t.status === 'suspenso').length,
    mrr:       tenants.filter(t => t.status === 'ativo').reduce((a, t) => a + Number(t.mensalidade || 0), 0),
    arr:       tenants.filter(t => t.status === 'ativo').reduce((a, t) => a + Number(t.mensalidade || 0), 0) * 12,
  }

  // ══════════════════════════════════════════════════════
  // RENDER
  // ══════════════════════════════════════════════════════

  if (loading) return (
    <div style={{ minHeight: '100vh', background: '#060c1a', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'DM Mono, monospace', color: '#64748b', fontSize: 14 }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 32, marginBottom: 12 }}>🛡️</div>
        Verificando acesso master...
      </div>
    </div>
  )

  if (!authorized) return null

  return (
    <>
      <Head>
        <title>Vivanexa — Master Admin</title>
        <link href="https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=DM+Mono:wght@300;400;500&display=swap" rel="stylesheet" />
      </Head>

      <style>{CSS}</style>

      {/* Toast */}
      <div id="admin-toast" style={{
        position: 'fixed', bottom: 28, right: 28, zIndex: 9999,
        background: 'rgba(16,185,129,.92)', color: '#fff',
        padding: '12px 22px', borderRadius: 10, fontSize: 13,
        fontFamily: 'DM Mono, monospace', fontWeight: 600,
        opacity: 0, transform: 'translateY(20px)',
        transition: 'all .35s ease', pointerEvents: 'none',
        boxShadow: '0 4px 20px rgba(0,0,0,.4)'
      }} />

      <div className="admin-wrap">
        {/* ── SIDEBAR ── */}
        <aside className="admin-sidebar">
          <div className="sidebar-logo">
            <span style={{ fontSize: 22 }}>🛡️</span>
            <div>
              <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: 14, color: '#e2e8f0' }}>MASTER</div>
              <div style={{ fontSize: 10, color: '#64748b', letterSpacing: 1 }}>ADMIN PANEL</div>
            </div>
          </div>

          <nav className="sidebar-nav">
            {[
              { id: 'tenants',    icon: '🏢', label: 'Clientes' },
              { id: 'financeiro', icon: '💰', label: 'Financeiro' },
              { id: 'metricas',   icon: '📊', label: 'Métricas' },
            ].map(item => (
              <button
                key={item.id}
                className={`nav-btn ${aba === item.id ? 'active' : ''}`}
                onClick={() => setAba(item.id)}
              >
                <span>{item.icon}</span>
                <span>{item.label}</span>
              </button>
            ))}
          </nav>

          <div className="sidebar-user">
            <div style={{ fontSize: 11, color: '#475569' }}>Logado como</div>
            <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 3 }}>{masterUser?.email}</div>
            <button className="btn-sair" onClick={async () => { await supabase.auth.signOut(); router.replace('/') }}>
              Sair
            </button>
          </div>
        </aside>

        {/* ── CONTEÚDO ── */}
        <main className="admin-main">

          {/* ─── ABA: CLIENTES ─── */}
          {aba === 'tenants' && (
            <div>
              {/* Header */}
              <div className="page-header">
                <div>
                  <h1 className="page-title">Clientes / Tenants</h1>
                  <p className="page-sub">Gerencie todos os clientes do sistema Vivanexa</p>
                </div>
                <button className="btn-primary" onClick={() => setModalTenant('novo')}>
                  + Novo Cliente
                </button>
              </div>

              {/* Stats Cards */}
              <div className="stats-grid">
                {[
                  { label: 'Total', valor: stats.total, icon: '🏢', cor: '#00d4ff' },
                  { label: 'Ativos', valor: stats.ativos, icon: '✅', cor: '#10b981' },
                  { label: 'Trial', valor: stats.trial, icon: '⏳', cor: '#f59e0b' },
                  { label: 'Suspensos', valor: stats.suspensos, icon: '🚫', cor: '#ef4444' },
                  { label: 'MRR', valor: fmt(stats.mrr), icon: '💰', cor: '#7c3aed', isText: true },
                  { label: 'ARR', valor: fmt(stats.arr), icon: '📈', cor: '#ec4899', isText: true },
                ].map((s, i) => (
                  <div key={i} className="stat-card" style={{ '--card-cor': s.cor }}>
                    <div className="stat-icon">{s.icon}</div>
                    <div className="stat-val" style={{ color: s.cor }}>{s.valor}</div>
                    <div className="stat-label">{s.label}</div>
                  </div>
                ))}
              </div>

              {/* Filtros */}
              <div className="filtros-bar">
                <input
                  className="input-busca"
                  placeholder="🔍 Buscar por nome, e-mail ou CNPJ..."
                  value={busca}
                  onChange={e => setBusca(e.target.value)}
                />
                <select className="select-filtro" value={filtroStatus} onChange={e => setFiltroStatus(e.target.value)}>
                  <option value="">Todos os status</option>
                  {STATUS_TENANT.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
                </select>
                <select className="select-filtro" value={filtroPlano} onChange={e => setFiltroPlano(e.target.value)}>
                  <option value="">Todos os planos</option>
                  {PLANOS_SISTEMA.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
                <span style={{ fontSize: 12, color: '#475569', marginLeft: 'auto', whiteSpace: 'nowrap' }}>
                  {tenantsFiltrados.length} resultado(s)
                </span>
              </div>

              {/* Tabela */}
              <div className="table-wrap">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Empresa</th>
                      <th>Plano</th>
                      <th>Status</th>
                      <th>Usuários</th>
                      <th>Módulos</th>
                      <th>Mensalidade</th>
                      <th>Vencimento</th>
                      <th>Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tenantsFiltrados.length === 0 ? (
                      <tr>
                        <td colSpan={8} style={{ textAlign: 'center', color: '#475569', padding: '40px 20px' }}>
                          {tenants.length === 0 ? '🏢 Nenhum cliente cadastrado. Clique em "+ Novo Cliente" para começar.' : '🔍 Nenhum resultado encontrado.'}
                        </td>
                      </tr>
                    ) : tenantsFiltrados.map(t => {
                      const plano = PLANOS_SISTEMA.find(p => p.id === t.plano)
                      const status = STATUS_TENANT.find(s => s.id === t.status)
                      const venc = t.vencimento ? new Date(t.vencimento) : null
                      const vencido = venc && venc < new Date()
                      return (
                        <tr key={t.id} className="table-row">
                          <td>
                            <div style={{ fontWeight: 600, color: '#e2e8f0', fontSize: 13 }}>{t.nomeEmpresa}</div>
                            <div style={{ fontSize: 11, color: '#475569', marginTop: 2 }}>{t.emailAdmin}</div>
                            {t.cnpj && <div style={{ fontSize: 10, color: '#334155', marginTop: 1 }}>{t.cnpj}</div>}
                          </td>
                          <td>
                            <span className="badge" style={{ background: plano?.cor + '22', color: plano?.cor, border: `1px solid ${plano?.cor}44` }}>
                              {plano?.name || t.plano}
                            </span>
                          </td>
                          <td>
                            <span className="badge" style={{ background: status?.cor + '22', color: status?.cor, border: `1px solid ${status?.cor}44` }}>
                              {status?.label || t.status}
                            </span>
                          </td>
                          <td style={{ color: '#94a3b8', fontSize: 13 }}>
                            {t.usuariosAtivos || 0} / {t.maxUsuarios || '∞'}
                          </td>
                          <td style={{ color: '#94a3b8', fontSize: 13 }}>
                            {(t.modulosLiberados || []).length} módulos
                          </td>
                          <td style={{ color: '#10b981', fontWeight: 600, fontSize: 13 }}>
                            {t.mensalidade ? fmt(t.mensalidade) : '—'}
                          </td>
                          <td style={{ fontSize: 12, color: vencido ? '#ef4444' : '#94a3b8' }}>
                            {fmtData(t.vencimento)}
                            {vencido && <span style={{ display: 'block', fontSize: 10, color: '#ef4444' }}>⚠️ Vencido</span>}
                          </td>
                          <td>
                            <div style={{ display: 'flex', gap: 6 }}>
                              <button className="btn-icon" title="Editar" onClick={() => setModalTenant(t)}>✏️</button>
                              {t.status === 'ativo' ? (
                                <button className="btn-icon" title="Suspender" onClick={() => alterarStatus(t, 'suspenso')}>🚫</button>
                              ) : (
                                <button className="btn-icon" title="Reativar" onClick={() => alterarStatus(t, 'ativo')}>✅</button>
                              )}
                              <button className="btn-icon danger" title="Excluir" onClick={() => setModalDelete(t)}>🗑️</button>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ─── ABA: FINANCEIRO ─── */}
          {aba === 'financeiro' && (
            <div>
              <div className="page-header">
                <div>
                  <h1 className="page-title">Financeiro</h1>
                  <p className="page-sub">Receitas, mensalidades e status de pagamento</p>
                </div>
              </div>

              <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(3,1fr)' }}>
                {[
                  { label: 'MRR (Receita Mensal)', valor: fmt(stats.mrr), icon: '💰', cor: '#10b981' },
                  { label: 'ARR (Receita Anual)',  valor: fmt(stats.arr), icon: '📈', cor: '#00d4ff' },
                  { label: 'Ticket Médio',          valor: stats.ativos > 0 ? fmt(stats.mrr / stats.ativos) : 'R$ 0,00', icon: '🎯', cor: '#7c3aed' },
                ].map((s, i) => (
                  <div key={i} className="stat-card" style={{ '--card-cor': s.cor }}>
                    <div className="stat-icon">{s.icon}</div>
                    <div className="stat-val" style={{ color: s.cor, fontSize: 20 }}>{s.valor}</div>
                    <div className="stat-label">{s.label}</div>
                  </div>
                ))}
              </div>

              <div className="table-wrap" style={{ marginTop: 24 }}>
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Empresa</th>
                      <th>Plano</th>
                      <th>Adesão</th>
                      <th>Mensalidade</th>
                      <th>Vencimento</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tenants.filter(t => t.status !== 'cancelado').map(t => {
                      const plano = PLANOS_SISTEMA.find(p => p.id === t.plano)
                      const status = STATUS_TENANT.find(s => s.id === t.status)
                      const venc = t.vencimento ? new Date(t.vencimento) : null
                      const vencido = venc && venc < new Date()
                      return (
                        <tr key={t.id} className="table-row">
                          <td style={{ fontWeight: 600, color: '#e2e8f0', fontSize: 13 }}>{t.nomeEmpresa}</td>
                          <td>
                            <span className="badge" style={{ background: plano?.cor + '22', color: plano?.cor, border: `1px solid ${plano?.cor}44` }}>
                              {plano?.name || t.plano}
                            </span>
                          </td>
                          <td style={{ color: '#94a3b8', fontSize: 13 }}>{t.adesao ? fmt(t.adesao) : '—'}</td>
                          <td style={{ color: '#10b981', fontWeight: 600, fontSize: 13 }}>{t.mensalidade ? fmt(t.mensalidade) : '—'}</td>
                          <td style={{ fontSize: 12, color: vencido ? '#ef4444' : '#94a3b8' }}>{fmtData(t.vencimento)}</td>
                          <td>
                            <span className="badge" style={{ background: status?.cor + '22', color: status?.cor, border: `1px solid ${status?.cor}44` }}>
                              {status?.label}
                            </span>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ─── ABA: MÉTRICAS ─── */}
          {aba === 'metricas' && (
            <div>
              <div className="page-header">
                <div>
                  <h1 className="page-title">Métricas do Sistema</h1>
                  <p className="page-sub">Visão geral da plataforma</p>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 20, marginBottom: 28 }}>
                {/* Distribuição por plano */}
                <div className="card">
                  <h3 className="card-title">📦 Clientes por Plano</h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 16 }}>
                    {PLANOS_SISTEMA.map(p => {
                      const qtd = tenants.filter(t => t.plano === p.id && t.status === 'ativo').length
                      const pct = stats.ativos > 0 ? (qtd / stats.ativos) * 100 : 0
                      return (
                        <div key={p.id}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#94a3b8', marginBottom: 4 }}>
                            <span style={{ color: p.cor }}>{p.name}</span>
                            <span>{qtd} cliente(s)</span>
                          </div>
                          <div style={{ background: '#1a2540', borderRadius: 4, height: 6, overflow: 'hidden' }}>
                            <div style={{ background: p.cor, width: `${pct}%`, height: '100%', borderRadius: 4, transition: 'width .5s' }} />
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>

                {/* Distribuição por status */}
                <div className="card">
                  <h3 className="card-title">📊 Clientes por Status</h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 16 }}>
                    {STATUS_TENANT.map(s => {
                      const qtd = tenants.filter(t => t.status === s.id).length
                      const pct = tenants.length > 0 ? (qtd / tenants.length) * 100 : 0
                      return (
                        <div key={s.id}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#94a3b8', marginBottom: 4 }}>
                            <span style={{ color: s.cor }}>{s.label}</span>
                            <span>{qtd} ({pct.toFixed(0)}%)</span>
                          </div>
                          <div style={{ background: '#1a2540', borderRadius: 4, height: 6, overflow: 'hidden' }}>
                            <div style={{ background: s.cor, width: `${pct}%`, height: '100%', borderRadius: 4 }} />
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>

              {/* Vencimentos próximos */}
              <div className="card">
                <h3 className="card-title">⚠️ Vencimentos nos próximos 30 dias</h3>
                <div style={{ marginTop: 16 }}>
                  {(() => {
                    const hoje = new Date()
                    const limite = new Date(); limite.setDate(limite.getDate() + 30)
                    const prox = tenants.filter(t => {
                      if (!t.vencimento || t.status === 'cancelado') return false
                      const v = new Date(t.vencimento)
                      return v >= hoje && v <= limite
                    }).sort((a, b) => new Date(a.vencimento) - new Date(b.vencimento))
                    if (!prox.length) return <p style={{ color: '#475569', fontSize: 13 }}>✅ Nenhum vencimento próximo.</p>
                    return prox.map(t => {
                      const plano = PLANOS_SISTEMA.find(p => p.id === t.plano)
                      const dias = Math.ceil((new Date(t.vencimento) - hoje) / (1000 * 60 * 60 * 24))
                      return (
                        <div key={t.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid #1e2d4a' }}>
                          <div>
                            <div style={{ fontSize: 13, color: '#e2e8f0', fontWeight: 600 }}>{t.nomeEmpresa}</div>
                            <div style={{ fontSize: 11, color: '#475569', marginTop: 2 }}>{plano?.name} · {fmt(t.mensalidade)}/mês</div>
                          </div>
                          <div style={{ textAlign: 'right' }}>
                            <div style={{ fontSize: 12, color: dias <= 7 ? '#ef4444' : '#f59e0b' }}>em {dias} dia(s)</div>
                            <div style={{ fontSize: 11, color: '#475569' }}>{fmtData(t.vencimento)}</div>
                          </div>
                        </div>
                      )
                    })
                  })()}
                </div>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* ═══════════════════════════════════════════════════════
          MODAL: NOVO / EDITAR TENANT
      ═══════════════════════════════════════════════════════ */}
      {modalTenant && (
        <ModalTenant
          tenant={modalTenant === 'novo' ? null : modalTenant}
          onSave={salvarTenant}
          onClose={() => setModalTenant(null)}
          saving={saving}
        />
      )}

      {/* ═══════════════════════════════════════════════════════
          MODAL: CONFIRMAR EXCLUSÃO
      ═══════════════════════════════════════════════════════ */}
      {modalDelete && (
        <div className="modal-overlay" onClick={() => setModalDelete(null)}>
          <div className="modal-box" style={{ maxWidth: 420 }} onClick={e => e.stopPropagation()}>
            <h2 style={{ fontFamily: 'Syne, sans-serif', color: '#ef4444', fontSize: 18, marginBottom: 12 }}>
              🗑️ Confirmar Exclusão
            </h2>
            <p style={{ color: '#94a3b8', fontSize: 13, lineHeight: 1.6 }}>
              Deseja realmente excluir o cliente <strong style={{ color: '#e2e8f0' }}>{modalDelete.nomeEmpresa}</strong>?
              Esta ação não pode ser desfeita.
            </p>
            <div style={{ display: 'flex', gap: 10, marginTop: 24, justifyContent: 'flex-end' }}>
              <button className="btn-secondary" onClick={() => setModalDelete(null)}>Cancelar</button>
              <button className="btn-danger" disabled={saving} onClick={() => deletarTenant(modalDelete.id)}>
                {saving ? 'Excluindo...' : 'Sim, excluir'}
              </button>
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

function ModalTenant({ tenant, onSave, onClose, saving }) {
  const isNovo = !tenant

  const [nomeEmpresa,      setNomeEmpresa]      = useState(tenant?.nomeEmpresa      || '')
  const [cnpj,             setCnpj]             = useState(tenant?.cnpj             || '')
  const [emailAdmin,       setEmailAdmin]       = useState(tenant?.emailAdmin       || '')
  const [telefone,         setTelefone]         = useState(tenant?.telefone         || '')
  const [responsavel,      setResponsavel]      = useState(tenant?.responsavel      || '')
  const [plano,            setPlano]            = useState(tenant?.plano            || 'basic')
  const [status,           setStatus]           = useState(tenant?.status           || 'trial')
  const [maxUsuarios,      setMaxUsuarios]      = useState(tenant?.maxUsuarios      || 3)
  const [mensalidade,      setMensalidade]      = useState(tenant?.mensalidade      || '')
  const [adesao,           setAdesao]           = useState(tenant?.adesao           || '')
  const [vencimento,       setVencimento]       = useState(tenant?.vencimento       || calcVencimento(30))
  const [modulosLiberados, setModulosLiberados] = useState(tenant?.modulosLiberados || MODULOS_POR_PLANO['basic'] || [])
  const [obs,              setObs]              = useState(tenant?.obs              || '')
  const [abaModal,         setAbaModal]         = useState('dados')

  // Quando muda o plano, sugere módulos e usuários
  function handlePlanoChange(novoPlano) {
    setPlano(novoPlano)
    const p = PLANOS_SISTEMA.find(p => p.id === novoPlano)
    if (p) {
      setMaxUsuarios(p.maxUsuarios === 999 ? 999 : p.maxUsuarios)
      setModulosLiberados(MODULOS_POR_PLANO[novoPlano] || [])
    }
  }

  function toggleModulo(id) {
    setModulosLiberados(prev =>
      prev.includes(id) ? prev.filter(m => m !== id) : [...prev, id]
    )
  }

  function toggleGrupo(grupo) {
    const ids = TODOS_MODULOS.filter(m => m.grupo === grupo).map(m => m.id)
    const todosAtivos = ids.every(id => modulosLiberados.includes(id))
    if (todosAtivos) {
      setModulosLiberados(prev => prev.filter(m => !ids.includes(m)))
    } else {
      setModulosLiberados(prev => [...new Set([...prev, ...ids])])
    }
  }

  function handleSalvar() {
    if (!nomeEmpresa.trim()) { alert('Informe o nome da empresa.'); return }
    if (!emailAdmin.trim())  { alert('Informe o e-mail do admin.'); return }

    onSave({
      id:               tenant?.id,
      nomeEmpresa:      nomeEmpresa.trim(),
      cnpj:             cnpj.trim(),
      emailAdmin:       emailAdmin.trim().toLowerCase(),
      telefone:         telefone.trim(),
      responsavel:      responsavel.trim(),
      plano,
      status,
      maxUsuarios:      Number(maxUsuarios),
      mensalidade:      Number(String(mensalidade).replace(',', '.')),
      adesao:           Number(String(adesao).replace(',', '.')),
      vencimento,
      modulosLiberados,
      obs:              obs.trim(),
      criadoEm:         tenant?.criadoEm,
    })
  }

  const grupos = [...new Set(TODOS_MODULOS.map(m => m.grupo))]

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" style={{ maxWidth: 680, maxHeight: '92vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h2 style={{ fontFamily: 'Syne, sans-serif', fontSize: 18, color: '#00d4ff' }}>
            {isNovo ? '🏢 Novo Cliente' : `✏️ Editar: ${tenant.nomeEmpresa}`}
          </h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#64748b', fontSize: 20, cursor: 'pointer' }}>✕</button>
        </div>

        {/* Abas do modal */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 20, borderBottom: '1px solid #1e2d4a', paddingBottom: 12 }}>
          {[
            { id: 'dados',    label: '📋 Dados' },
            { id: 'plano',    label: '📦 Plano & Cobrança' },
            { id: 'modulos',  label: '🔐 Módulos' },
          ].map(a => (
            <button
              key={a.id}
              onClick={() => setAbaModal(a.id)}
              style={{
                padding: '6px 14px', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: 12,
                background: abaModal === a.id ? '#00d4ff22' : 'transparent',
                color: abaModal === a.id ? '#00d4ff' : '#64748b',
                fontFamily: 'DM Mono, monospace',
              }}
            >
              {a.label}
            </button>
          ))}
        </div>

        {/* ── ABA: DADOS ── */}
        {abaModal === 'dados' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <div className="field" style={{ gridColumn: '1 / -1' }}>
              <label>Nome da Empresa *</label>
              <input value={nomeEmpresa} onChange={e => setNomeEmpresa(e.target.value)} placeholder="Ex: Contabilidade ABC Ltda" />
            </div>
            <div className="field">
              <label>CNPJ</label>
              <input value={cnpj} onChange={e => setCnpj(e.target.value)} placeholder="00.000.000/0001-00" />
            </div>
            <div className="field">
              <label>Responsável</label>
              <input value={responsavel} onChange={e => setResponsavel(e.target.value)} placeholder="Nome do responsável" />
            </div>
            <div className="field">
              <label>E-mail Admin *</label>
              <input type="email" value={emailAdmin} onChange={e => setEmailAdmin(e.target.value)} placeholder="admin@empresa.com.br" />
            </div>
            <div className="field">
              <label>Telefone</label>
              <input value={telefone} onChange={e => setTelefone(e.target.value)} placeholder="(11) 9 9999-9999" />
            </div>
            <div className="field" style={{ gridColumn: '1 / -1' }}>
              <label>Observações internas</label>
              <textarea
                value={obs}
                onChange={e => setObs(e.target.value)}
                placeholder="Notas sobre o cliente, condições especiais, etc."
                rows={3}
                style={{ width: '100%', background: '#1a2540', border: '1px solid #1e2d4a', borderRadius: 8, padding: '9px 12px', color: '#e2e8f0', fontFamily: 'DM Mono, monospace', fontSize: 13, resize: 'vertical' }}
              />
            </div>
          </div>
        )}

        {/* ── ABA: PLANO & COBRANÇA ── */}
        {abaModal === 'plano' && (
          <div>
            {/* Seleção de plano */}
            <div style={{ marginBottom: 20 }}>
              <label style={{ fontSize: 12, color: '#64748b', display: 'block', marginBottom: 10 }}>Plano Contratado</label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
                {PLANOS_SISTEMA.map(p => (
                  <button
                    key={p.id}
                    onClick={() => handlePlanoChange(p.id)}
                    style={{
                      padding: '12px 10px',
                      borderRadius: 10,
                      border: `2px solid ${plano === p.id ? p.cor : '#1e2d4a'}`,
                      background: plano === p.id ? p.cor + '22' : '#111827',
                      color: plano === p.id ? p.cor : '#64748b',
                      cursor: 'pointer',
                      fontFamily: 'Syne, sans-serif',
                      fontWeight: 700,
                      fontSize: 13,
                      transition: 'all .2s',
                    }}
                  >
                    {p.name}
                    <div style={{ fontSize: 10, marginTop: 4, fontFamily: 'DM Mono, monospace', fontWeight: 400 }}>
                      {p.maxUsuarios === 999 ? 'ilimitado' : `até ${p.maxUsuarios} usuário(s)`}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              <div className="field">
                <label>Status</label>
                <select value={status} onChange={e => setStatus(e.target.value)}>
                  {STATUS_TENANT.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
                </select>
              </div>
              <div className="field">
                <label>Máx. Usuários</label>
                <input type="number" min={1} value={maxUsuarios} onChange={e => setMaxUsuarios(e.target.value)} />
              </div>
              <div className="field">
                <label>Valor Adesão (R$)</label>
                <input type="number" step="0.01" min="0" value={adesao} onChange={e => setAdesao(e.target.value)} placeholder="0,00" />
              </div>
              <div className="field">
                <label>Mensalidade (R$)</label>
                <input type="number" step="0.01" min="0" value={mensalidade} onChange={e => setMensalidade(e.target.value)} placeholder="0,00" />
              </div>
              <div className="field" style={{ gridColumn: '1 / -1' }}>
                <label>Vencimento / Renovação</label>
                <input type="date" value={vencimento} onChange={e => setVencimento(e.target.value)} />
              </div>
            </div>

            {/* Botões rápidos de trial */}
            <div style={{ marginTop: 16 }}>
              <label style={{ fontSize: 12, color: '#64748b', display: 'block', marginBottom: 8 }}>⚡ Atalhos de vencimento</label>
              <div style={{ display: 'flex', gap: 8 }}>
                {[7, 14, 30, 90, 365].map(dias => (
                  <button key={dias} onClick={() => setVencimento(calcVencimento(dias))}
                    style={{ padding: '5px 12px', background: '#1a2540', border: '1px solid #1e2d4a', borderRadius: 6, color: '#94a3b8', fontSize: 11, cursor: 'pointer', fontFamily: 'DM Mono, monospace' }}>
                    +{dias}d
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── ABA: MÓDULOS ── */}
        {abaModal === 'modulos' && (
          <div>
            <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontSize: 12, color: '#64748b' }}>
                {modulosLiberados.length} de {TODOS_MODULOS.length} módulos liberados
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => setModulosLiberados(TODOS_MODULOS.map(m => m.id))}
                  style={{ padding: '4px 10px', background: '#10b98122', border: '1px solid #10b98144', borderRadius: 6, color: '#10b981', fontSize: 11, cursor: 'pointer', fontFamily: 'DM Mono, monospace' }}>
                  Todos
                </button>
                <button onClick={() => setModulosLiberados([])}
                  style={{ padding: '4px 10px', background: '#ef444422', border: '1px solid #ef444444', borderRadius: 6, color: '#ef4444', fontSize: 11, cursor: 'pointer', fontFamily: 'DM Mono, monospace' }}>
                  Nenhum
                </button>
              </div>
            </div>

            {grupos.map(grupo => {
              const modGrupo = TODOS_MODULOS.filter(m => m.grupo === grupo)
              const todosAtivos = modGrupo.every(m => modulosLiberados.includes(m.id))
              return (
                <div key={grupo} style={{ marginBottom: 20 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                    <span style={{ fontSize: 12, color: '#94a3b8', fontWeight: 600 }}>{grupo}</span>
                    <button onClick={() => toggleGrupo(grupo)}
                      style={{ padding: '2px 8px', background: todosAtivos ? '#00d4ff22' : '#1a2540', border: `1px solid ${todosAtivos ? '#00d4ff44' : '#1e2d4a'}`, borderRadius: 4, color: todosAtivos ? '#00d4ff' : '#475569', fontSize: 10, cursor: 'pointer', fontFamily: 'DM Mono, monospace' }}>
                      {todosAtivos ? 'desmarcar grupo' : 'marcar grupo'}
                    </button>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                    {modGrupo.map(mod => {
                      const ativo = modulosLiberados.includes(mod.id)
                      return (
                        <div
                          key={mod.id}
                          onClick={() => toggleModulo(mod.id)}
                          style={{
                            display: 'flex', alignItems: 'center', gap: 10,
                            padding: '10px 14px', borderRadius: 8,
                            border: `1px solid ${ativo ? '#00d4ff44' : '#1e2d4a'}`,
                            background: ativo ? '#00d4ff0d' : '#111827',
                            cursor: 'pointer', transition: 'all .15s',
                          }}
                        >
                          <div style={{
                            width: 16, height: 16, borderRadius: 4,
                            border: `2px solid ${ativo ? '#00d4ff' : '#334155'}`,
                            background: ativo ? '#00d4ff' : 'transparent',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            flexShrink: 0, transition: 'all .15s',
                          }}>
                            {ativo && <span style={{ fontSize: 10, color: '#000', fontWeight: 900 }}>✓</span>}
                          </div>
                          <span style={{ fontSize: 12, color: ativo ? '#e2e8f0' : '#64748b' }}>{mod.label}</span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* Footer */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 24, paddingTop: 16, borderTop: '1px solid #1e2d4a' }}>
          <button className="btn-secondary" onClick={onClose}>Cancelar</button>
          <button className="btn-primary" disabled={saving} onClick={handleSalvar}>
            {saving ? '⏳ Salvando...' : isNovo ? '✅ Cadastrar Cliente' : '✅ Salvar Alterações'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════════════
// CSS
// ══════════════════════════════════════════════════════

const CSS = `
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  :root {
    --bg: #060c1a; --surface: #0d1526; --surface2: #111827;
    --surface3: #1a2540; --border: #1e2d4a; --accent: #00d4ff;
    --text: #e2e8f0; --muted: #64748b; --green: #10b981;
    --purple: #7c3aed; --danger: #ef4444; --warn: #f59e0b;
  }
  body { font-family: 'DM Mono', monospace; background: var(--bg); color: var(--text); min-height: 100vh; }

  .admin-wrap { display: flex; min-height: 100vh; }

  .admin-sidebar {
    width: 220px; min-height: 100vh; background: var(--surface);
    border-right: 1px solid var(--border); display: flex;
    flex-direction: column; padding: 20px 0; position: sticky; top: 0; height: 100vh;
  }
  .sidebar-logo {
    display: flex; align-items: center; gap: 12px;
    padding: 0 20px 20px; border-bottom: 1px solid var(--border); margin-bottom: 16px;
  }
  .sidebar-nav { flex: 1; display: flex; flex-direction: column; gap: 4px; padding: 0 10px; }
  .nav-btn {
    display: flex; align-items: center; gap: 10px;
    padding: 10px 14px; border-radius: 8px; border: none;
    background: transparent; color: var(--muted); cursor: pointer;
    font-family: 'DM Mono', monospace; font-size: 13px;
    transition: all .2s; text-align: left; width: 100%;
  }
  .nav-btn:hover { background: var(--surface3); color: var(--text); }
  .nav-btn.active { background: rgba(0,212,255,.12); color: var(--accent); }
  .sidebar-user { padding: 16px 20px; border-top: 1px solid var(--border); margin-top: 16px; }
  .btn-sair {
    margin-top: 10px; width: 100%; padding: 7px; border-radius: 6px;
    border: 1px solid var(--border); background: transparent;
    color: var(--muted); cursor: pointer; font-family: 'DM Mono', monospace;
    font-size: 11px; transition: all .2s;
  }
  .btn-sair:hover { border-color: var(--danger); color: var(--danger); }

  .admin-main { flex: 1; padding: 32px; overflow-y: auto; }

  .page-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 24px; }
  .page-title { font-family: 'Syne', sans-serif; font-size: 22px; font-weight: 800; color: var(--text); }
  .page-sub { font-size: 12px; color: var(--muted); margin-top: 4px; }

  .stats-grid { display: grid; grid-template-columns: repeat(6, 1fr); gap: 14px; margin-bottom: 24px; }
  .stat-card {
    background: var(--surface2); border: 1px solid var(--border);
    border-top: 2px solid var(--card-cor, #1e2d4a);
    border-radius: 12px; padding: 16px; text-align: center;
  }
  .stat-icon { font-size: 20px; margin-bottom: 8px; }
  .stat-val { font-family: 'Syne', sans-serif; font-size: 24px; font-weight: 800; line-height: 1; margin-bottom: 4px; }
  .stat-label { font-size: 11px; color: var(--muted); }

  .filtros-bar { display: flex; gap: 10px; align-items: center; margin-bottom: 16px; flex-wrap: wrap; }
  .input-busca {
    flex: 1; min-width: 200px; background: var(--surface2); border: 1px solid var(--border);
    border-radius: 8px; padding: 9px 14px; color: var(--text);
    font-family: 'DM Mono', monospace; font-size: 13px; outline: none;
  }
  .input-busca:focus { border-color: var(--accent); }
  .select-filtro {
    background: var(--surface2); border: 1px solid var(--border);
    border-radius: 8px; padding: 9px 14px; color: var(--text);
    font-family: 'DM Mono', monospace; font-size: 13px; outline: none; cursor: pointer;
  }

  .table-wrap { background: var(--surface2); border: 1px solid var(--border); border-radius: 12px; overflow: hidden; }
  .admin-table { width: 100%; border-collapse: collapse; }
  .admin-table th {
    padding: 12px 16px; text-align: left; font-size: 11px;
    color: var(--muted); border-bottom: 1px solid var(--border);
    background: var(--surface); letter-spacing: .5px; font-weight: 600;
  }
  .admin-table td { padding: 13px 16px; border-bottom: 1px solid #0d1526; vertical-align: middle; }
  .table-row:hover { background: rgba(0,212,255,.025); }
  .table-row:last-child td { border-bottom: none; }

  .badge {
    display: inline-block; padding: 3px 10px; border-radius: 20px;
    font-size: 11px; font-weight: 600; letter-spacing: .3px;
  }

  .btn-primary {
    padding: 10px 22px; border-radius: 8px;
    background: linear-gradient(135deg, var(--accent), #0099bb);
    border: none; color: #000; font-family: 'DM Mono', monospace;
    font-size: 13px; font-weight: 700; cursor: pointer; transition: all .2s;
  }
  .btn-primary:hover:not(:disabled) { box-shadow: 0 0 20px rgba(0,212,255,.35); transform: translateY(-1px); }
  .btn-primary:disabled { opacity: .5; cursor: not-allowed; }

  .btn-secondary {
    padding: 10px 22px; border-radius: 8px;
    background: transparent; border: 1px solid var(--border);
    color: var(--muted); font-family: 'DM Mono', monospace;
    font-size: 13px; cursor: pointer; transition: all .2s;
  }
  .btn-secondary:hover { border-color: var(--muted); color: var(--text); }

  .btn-danger {
    padding: 10px 22px; border-radius: 8px;
    background: rgba(239,68,68,.15); border: 1px solid rgba(239,68,68,.3);
    color: var(--danger); font-family: 'DM Mono', monospace;
    font-size: 13px; font-weight: 600; cursor: pointer; transition: all .2s;
  }
  .btn-danger:hover:not(:disabled) { background: rgba(239,68,68,.25); }
  .btn-danger:disabled { opacity: .5; cursor: not-allowed; }

  .btn-icon {
    width: 30px; height: 30px; border-radius: 6px;
    background: var(--surface); border: 1px solid var(--border);
    cursor: pointer; display: flex; align-items: center; justify-content: center;
    font-size: 14px; transition: all .15s;
  }
  .btn-icon:hover { background: var(--surface3); border-color: var(--accent); }
  .btn-icon.danger:hover { border-color: var(--danger); }

  .card {
    background: var(--surface2); border: 1px solid var(--border);
    border-radius: 12px; padding: 20px;
  }
  .card-title { font-family: 'Syne', sans-serif; font-size: 14px; font-weight: 700; color: var(--text); }

  .modal-overlay {
    position: fixed; inset: 0; background: rgba(0,0,0,.7);
    display: flex; align-items: center; justify-content: center;
    z-index: 9000; padding: 20px; backdrop-filter: blur(4px);
  }
  .modal-box {
    background: var(--surface); border: 1px solid var(--border);
    border-radius: 16px; padding: 28px; width: 100%;
    box-shadow: 0 8px 48px rgba(0,0,0,.6);
  }

  .field { display: flex; flex-direction: column; gap: 5px; }
  .field label { font-size: 11px; color: var(--muted); letter-spacing: .5px; }
  .field input, .field select {
    background: var(--surface3); border: 1px solid var(--border);
    border-radius: 8px; padding: 9px 12px; color: var(--text);
    font-family: 'DM Mono', monospace; font-size: 13px; outline: none;
    transition: border-color .2s;
  }
  .field input:focus, .field select:focus { border-color: var(--accent); }
  .field input::placeholder { color: var(--muted); }

  @media (max-width: 900px) {
    .stats-grid { grid-template-columns: repeat(3, 1fr); }
    .admin-sidebar { width: 60px; }
    .sidebar-logo div, .nav-btn span:last-child, .sidebar-user { display: none; }
    .nav-btn { justify-content: center; }
    .admin-main { padding: 20px 16px; }
  }
`
