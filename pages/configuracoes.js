// pages/configuracoes.js
// ============================================================
// MELHORIAS APLICADAS:
// 1. Logo: carrega e exibe corretamente após salvar
// 2. Produtos: planos completos (Basic/Pro/Top/Top Plus) com
//    CNPJs, usuários e tabela de preços por módulo
// 3. Usuários: permissões granulares + perfis personalizados
// 4. Vouchers: botão imprimir PDF estilizado
// 5. KPIs: seletor de ícone com galeria de opções + obrigatoriedade
// 6. Documentos: Nova aba para upload e gestão de documentos importados (HTML/PDF)
// 7. Histórico: Melhoria na aba para visualizar documentos gerados e assinados
// 8. Descontos: Lógica de percentuais e modo de desconto aprimorada
// ============================================================

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/router'
import { supabase } from '../lib/supabase'

// ══════════════════════════════════════════════
// CONSTANTES
// ══════════════════════════════════════════════
const TABS = [
  { id: 'empresa',    label: '🏢 Empresa' },
  { id: 'metas',      label: '🎯 Metas' },
  { id: 'kpis',       label: '📊 KPIs' },
  { id: 'usuarios',   label: '👥 Usuários' },
  { id: 'produtos',   label: '📦 Produtos' },
  { id: 'descontos',  label: '🏷️ Descontos' },
  { id: 'vouchers',   label: '🎫 Vouchers' },
  { id: 'documentos', label: '📄 Documentos' }, // Nova aba para documentos importados
  { id: 'historico',  label: '🗂️ Histórico' },  // Aba para histórico de gerados/assinados
  { id: 'clientes',   label: '🗃️ Clientes' },
  { id: 'tema',       label: '🎨 Tema' },
]

// Galeria de ícones para KPI
const KPI_ICONS = [
  '📞','📲','📧','🤝','💼','🏆','🎯','💰','📈','📊',
  '🔥','⭐','🚀','✅','📅','🗓','👥','🏃','💡','🎤',
  '📝','🔔','💬','🌐','🛒','📦','🔑','⚡','🎁','🏅',
]

// Módulos e planos padrão
const MODULOS_PADRAO = ['Gestão Fiscal','CND','XML','BIA','IF','EP','Tributos']
const PLANOS_PADRAO = [
  { id: 'basic',   nome: 'Basic',    maxCnpjs: 25,  usuarios: 1  },
  { id: 'pro',     nome: 'Pro',      maxCnpjs: 80,  usuarios: 1  },
  { id: 'top',     nome: 'Top',      maxCnpjs: 150, usuarios: 5  },
  { id: 'topplus', nome: 'Top Plus', maxCnpjs: 999, usuarios: 999 },
]
const PRECOS_PADRAO = {
  'Gestão Fiscal': { basic:[478,318], pro:[590,409], top:[1032,547], topplus:[1398,679] },
  'CND':           { basic:[0,48],   pro:[0,90],   top:[0,150],    topplus:[0,200]     },
  'XML':           { basic:[478,199], pro:[590,299], top:[1032,349], topplus:[1398,399] },
  'BIA':           { basic:[478,129], pro:[590,169], top:[1032,280], topplus:[1398,299] },
  'IF':            { basic:[1600,379],pro:[1600,619],top:[1600,920], topplus:[1600,1100]},
  'EP':            { basic:[0,39],   pro:[0,82],   top:[0,167],    topplus:[0,200]     },
  'Tributos':      { basic:[0,0],    pro:[0,0],    top:[0,0],      topplus:[0,0]       },
}

// Permissões disponíveis
const PERMISSOES_DISPONIVEIS = [
  { id: 'ver_dashboard',    label: '📊 Ver Dashboard'           },
  { id: 'ver_chat',         label: '💬 Usar Chat'               },
  { id: 'ver_configuracoes',label: '⚙️ Ver Configurações'        },
  { id: 'editar_precos',    label: '💲 Editar Preços'            },
  { id: 'ver_historico',    label: '🗂️ Ver Histórico'            },
  { id: 'gerar_proposta',   label: '📄 Gerar Proposta'           },
  { id: 'gerar_contrato',   label: '📝 Gerar Contrato'           },
  { id: 'ver_clientes',     label: '🗃️ Ver Clientes'             },
  { id: 'gerenciar_usuarios',label:'👥 Gerenciar Usuários'       },
  { id: 'ver_kpis',         label: '📈 Ver KPIs'                 },
  { id: 'lancar_kpis',      label: '✏️ Lançar KPIs diários'      },
  { id: 'ver_vouchers',     label: '🎫 Ver/Gerar Vouchers'       },
  { id: 'gerenciar_documentos', label: '📄 Gerenciar Documentos' }, // Nova permissão
]

// Permissões padrão por perfil
const PERMISSOES_ADMIN = PERMISSOES_DISPONIVEIS.map(p => p.id)
const PERMISSOES_USER  = ['ver_dashboard','ver_chat','gerar_proposta','gerar_contrato','ver_clientes','ver_historico','ver_kpis','lancar_kpis']

// ══════════════════════════════════════════════
// HELPERS
// ══════════════════════════════════════════════
function toast(msg, type = 'ok') {
  const el = document.getElementById('vx-toast')
  if (!el) return
  el.textContent = msg
  el.style.background = type === 'ok' ? 'rgba(16,185,129,.9)' : 'rgba(239,68,68,.9)'
  el.style.opacity = '1'
  el.style.transform = 'translateY(0)'
  setTimeout(() => { el.style.opacity = '0'; el.style.transform = 'translateY(20px)' }, 3000)
}

async function salvarStorage(empresaId, novoCfg) {
  return supabase.from('vx_storage').upsert({
    key: `cfg:${empresaId}`,
    value: JSON.stringify(novoCfg),
    updated_at: new Date().toISOString()
  })
}

// ══════════════════════════════════════════════
// ABA EMPRESA — CORREÇÃO DA LOGO
// ══════════════════════════════════════════════
function TabEmpresa({ cfg, setCfg, empresaId }) {
  const [company,  setCompany]  = useState(cfg.company  || '')
  const [slogan,   setSlogan]   = useState(cfg.slogan   || '')
  const [logoB64,  setLogoB64]  = useState(cfg.logob64  || '')
  const [saving,   setSaving]   = useState(false)

  useEffect(() => {
    setCompany(cfg.company  || '')
    setSlogan(cfg.slogan    || '')
    setLogoB64(cfg.logob64  || '')
  }, [cfg])

  function handleLogo(e) {
    const file = e.target.files[0]
    if (!file) return
    if (file.size > 512000) { toast('Imagem muito grande (máx 500kb)', 'err'); return }
    const reader = new FileReader()
    reader.onload = ev => setLogoB64(ev.target.result)
    reader.readAsDataURL(file)
  }

  function removerLogo() { setLogoB64('') }

  async function salvar() {
    setSaving(true)
    const novoCfg = { ...cfg, company, slogan, logob64: logoB64 }
    const { error } = await salvarStorage(empresaId, novoCfg)
    setSaving(false)
    if (error) { toast('Erro ao salvar: ' + error.message, 'err'); return }
    setCfg(novoCfg)
    toast('✅ Empresa salva com sucesso!')
  }

  return (
    <div style={s.body}>
      <div style={s.sec}>
        <div style={s.secTitle}>Identidade Visual</div>
        <div style={s.row2}>
          <div style={s.field}>
            <label style={s.label}>Nome da Empresa</label>
            <input style={s.input} value={company} onChange={e => setCompany(e.target.value)} placeholder="Ex: Vivanexa" />
          </div>
          <div style={s.field}>
            <label style={s.label}>Slogan / Subtítulo</label>
            <input style={s.input} value={slogan} onChange={e => setSlogan(e.target.value)} placeholder="Assistente Comercial" />
          </div>
        </div>

        <div style={s.field}>
          <label style={s.label}>Logomarca (PNG/JPG — máx 500kb)</label>
          <input type="file" accept="image/*" onChange={handleLogo} style={{ ...s.input, padding: '6px' }} />
        </div>

        {logoB64 ? (
          <div style={{ marginTop: 12, padding: 14, background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 10, display: 'inline-flex', flexDirection: 'column', alignItems: 'flex-start', gap: 10 }}>
            <div style={{ fontSize: 11, color: 'var(--muted)', letterSpacing: 1, textTransform: 'uppercase' }}>Pré-visualização</div>
            <img
              src={logoB64}
              alt="Logo"
              style={{ height: 70, maxWidth: 280, objectFit: 'contain', borderRadius: 8, border: '1px solid var(--border)' }}
              onError={e => { e.target.style.display = 'none' }}
            />
            <button onClick={removerLogo}
              style={{ fontSize: 12, color: 'var(--danger)', background: 'rgba(239,68,68,.1)', border: '1px solid rgba(239,68,68,.25)', padding: '4px 10px', borderRadius: 7, cursor: 'pointer', fontFamily: 'DM Mono, monospace' }}>
              🗑 Remover logo
            </button>
          </div>
        ) : (
          <div style={{ marginTop: 10, padding: '14px 18px', background: 'var(--surface2)', border: '1px dashed var(--border)', borderRadius: 10, fontSize: 13, color: 'var(--muted)', textAlign: 'center' }}>
            Nenhuma logomarca carregada
          </div>
        )}
      </div>
      <button style={s.saveBtn} onClick={salvar} disabled={saving}>
        {saving ? '⏳ Salvando...' : '✅ Salvar Empresa'}
      </button>
    </div>
  )
}

// ══════════════════════════════════════════════
// ABA METAS
// ══════════════════════════════════════════════
function TabMetas({ cfg, setCfg, empresaId }) {
  const mes = new Date().toISOString().slice(0, 7)
  const [mesRef,  setMesRef]  = useState(mes)
  const [metas,   setMetas]   = useState({})
  const [saving,  setSaving]  = useState(false)
  const usuarios = cfg.users || []

  useEffect(() => {
    const g = cfg.goals || []
    const map = {}
    g.filter(x => x.mes === mesRef).forEach(x => { map[x.userId] = x })
    setMetas(map)
  }, [mesRef, cfg.goals])

  function updateMeta(userId, campo, val) {
    setMetas(prev => ({ ...prev, [userId]: { ...(prev[userId] || { userId, mes: mesRef }), [campo]: val } }))
  }

  async function salvar() {
    setSaving(true)
    const outrasGoals = (cfg.goals || []).filter(x => x.mes !== mesRef)
    const novasGoals  = Object.values(metas).map(m => ({ ...m, mes: mesRef }))
    const novoCfg     = { ...cfg, goals: [...outrasGoals, ...novasGoals] }
    const { error }   = await salvarStorage(empresaId, novoCfg)
    setSaving(false)
    if (error) { toast('Erro ao salvar', 'err'); return }
    setCfg(novoCfg)
    toast('✅ Metas salvas!')
  }

  async function adminClear(tipo) {
    if (!confirm(`Confirma zerar ${tipo}? Esta ação é irreversível.`)) return
    let novoCfg = { ...cfg }
    if (tipo === 'historico') novoCfg.docHistory = []
    if (tipo === 'metas')     novoCfg.goals = []
    if (tipo === 'clientes')  novoCfg.clients = []
    if (tipo === 'tudo') novoCfg = { company: cfg.company, slogan: cfg.slogan, logob64: cfg.logob64, users: cfg.users }
    const { error } = await salvarStorage(empresaId, novoCfg)
    if (error) { toast('Erro', 'err'); return }
    setCfg(novoCfg)
    toast('🗑 Dados removidos!')
  }

  return (
    <div style={s.body}>
      <div style={s.sec}>
        <div style={s.secTitle}>Metas de Vendas por Usuário</div>
        <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 16, lineHeight: 1.6 }}>
          Defina metas mensais de adesão e mensalidade para cada vendedor.
        </p>
        <div style={{ marginBottom: 16 }}>
          <label style={s.label}>Mês de Referência</label>
          <input type="month" value={mesRef} onChange={e => setMesRef(e.target.value)} style={s.input} />
        </div>
        {usuarios.length === 0 && (
          <p style={{ color: 'var(--muted)', fontSize: 13 }}>Nenhum usuário cadastrado. Cadastre na aba Usuários.</p>
        )}
        {usuarios.map(u => (
          <div key={u.id} style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 10, padding: 14, marginBottom: 10 }}>
            <div style={{ fontWeight: 600, marginBottom: 10, color: 'var(--accent)', fontSize: 14 }}>{u.nome}</div>
            <div style={s.row2}>
              <div style={s.field}>
                <label style={s.label}>Meta Adesão (R$)</label>
                <input type="number" style={s.input}
                  value={metas[u.id]?.metaAdesao || ''}
                  onChange={e => updateMeta(u.id, 'metaAdesao', e.target.value)}
                  placeholder="0" />
              </div>
              <div style={s.field}>
                <label style={s.label}>Meta Mensalidade (R$)</label>
                <input type="number" style={s.input}
                  value={metas[u.id]?.metaMensalidade || ''}
                  onChange={e => updateMeta(u.id, 'metaMensalidade', e.target.value)}
                  placeholder="0" />
              </div>
            </div>
          </div>
        ))}
        <button style={s.saveBtn} onClick={salvar} disabled={saving}>
          {saving ? '⏳ Salvando...' : '✅ Salvar Metas'}
        </button>
      </div>

      <div style={s.sec}>
        <div style={{ ...s.secTitle, color: 'var(--danger)' }}>⚠️ Área Administrativa — Limpeza de Dados</div>
        {[
          ['historico', '🗑 Zerar histórico de contratos e propostas'],
          ['metas',     '🎯 Zerar metas de todos os usuários'],
          ['clientes',  '👥 Zerar banco de clientes'],
          ['tudo',      '⚠️ RESET COMPLETO — Apagar tudo (IRREVERSÍVEL)'],
        ].map(([tipo, label]) => (
          <button key={tipo} onClick={() => adminClear(tipo)}
            style={{ display: 'block', width: '100%', marginBottom: 8, padding: '11px 14px', borderRadius: 9,
              background: tipo === 'tudo' ? 'rgba(239,68,68,.2)' : 'rgba(239,68,68,.1)',
              border: tipo === 'tudo' ? '2px solid rgba(239,68,68,.5)' : '1px solid rgba(239,68,68,.3)',
              color: 'var(--danger)', fontFamily: 'DM Mono, monospace', fontSize: 13, cursor: 'pointer',
              textAlign: 'left', fontWeight: tipo === 'tudo' ? 700 : 400 }}>
            {label}
          </button>
        ))}
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════
// ABA KPIs — COM GALERIA DE ÍCONES + OBRIGATORIEDADE
// ══════════════════════════════════════════════
function TabKpis({ cfg, setCfg, empresaId }) {
  const [kpis,        setKpis]        = useState(cfg.kpiTemplates || [])
  const [saving,      setSaving]      = useState(false)
  const [iconPickerId, setIconPickerId] = useState(null) // qual KPI está com seletor aberto
  const [kpiObrigatorio, setKpiObrigatorio] = useState(cfg.kpiObrigatorio || false) // Nova configuração

  useEffect(() => {
    setKpis(cfg.kpiTemplates || [])
    setKpiObrigatorio(cfg.kpiObrigatorio || false)
  }, [cfg])

  function addKpi() {
    setKpis(prev => [...prev, { id: Date.now().toString(), nome: '', icone: '📊', meta: 0, unidade: 'un', cor: '#00d4ff' }])
  }
  function updateKpi(id, campo, val) {
    setKpis(prev => prev.map(k => k.id === id ? { ...k, [campo]: val } : k))
  }
  function removeKpi(id) {
    setKpis(prev => prev.filter(k => k.id !== id))
    if (iconPickerId === id) setIconPickerId(null)
  }

  async function salvar() {
    setSaving(true)
    const novoCfg = { ...cfg, kpiTemplates: kpis, kpiObrigatorio: kpiObrigatorio } // Salva a nova configuração
    const { error } = await salvarStorage(empresaId, novoCfg)
    setSaving(false)
    if (error) { toast('Erro ao salvar', 'err'); return }
    setCfg(novoCfg)
    toast('✅ KPIs salvos!')
  }

  return (
    <div style={s.body}>
      <div style={s.sec}>
        <div style={s.secTitle}>📊 Indicadores de Atividade (KPIs)</div>
        <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 14, lineHeight: 1.6 }}>
          Configure os KPIs que os vendedores irão acompanhar diariamente. Cada KPI aparece no Dashboard com sua meta.
        </p>

        {kpis.map(k => (
          <div key={k.id} style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 10, padding: '12px 14px', marginBottom: 10 }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: iconPickerId === k.id ? 12 : 0 }}>
              <div style={{ position: 'relative' }}>
                <button onClick={() => setIconPickerId(iconPickerId === k.id ? null : k.id)}
                  style={{ width: 44, height: 44, borderRadius: 10, background: 'var(--surface)', border: '1px solid var(--border)', fontSize: 22, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'border-color .2s', borderColor: iconPickerId === k.id ? 'var(--accent)' : undefined }}
                  title="Escolher ícone">
                  {k.icone}
                </button>
              </div>

              <input style={{ ...s.input, flex: 1 }} value={k.nome}
                onChange={e => updateKpi(k.id, 'nome', e.target.value)}
                placeholder="Nome do KPI (ex: Ligações realizadas)" />

              <input type="number" style={{ ...s.input, width: 90 }} value={k.meta}
                onChange={e => updateKpi(k.id, 'meta', e.target.value)}
                placeholder="Meta" />

              <select style={{ ...s.input, width: 72 }} value={k.unidade || 'un'}
                onChange={e => updateKpi(k.id, 'unidade', e.target.value)}>
                <option value="un">un</option>
                <option value="R$">R$</option>
                <option value="%">%</option>
                <option value="h">h</option>
              </select>

              <button onClick={() => removeKpi(k.id)}
                style={{ padding: '8px 12px', borderRadius: 8, background: 'rgba(239,68,68,.1)', border: '1px solid rgba(239,68,68,.3)', color: 'var(--danger)', cursor: 'pointer' }}>
                🗑
              </button>
            </div>

            {iconPickerId === k.id && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, padding: '10px 0 2px' }}>
                {KPI_ICONS.map(ic => (
                  <button key={ic} onClick={() => { updateKpi(k.id, 'icone', ic); setIconPickerId(null) }}
                    style={{ width: 36, height: 36, borderRadius: 8, background: k.icone === ic ? 'rgba(0,212,255,.15)' : 'var(--surface)', border: `1px solid ${k.icone === ic ? 'var(--accent)' : 'var(--border)'}`, fontSize: 18, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all .15s' }}>
                    {ic}
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}

        <button onClick={addKpi}
          style={{ padding: '9px 16px', borderRadius: 8, background: 'rgba(0,212,255,.1)', border: '1px solid rgba(0,212,255,.25)', color: 'var(--accent)', fontFamily: 'DM Mono, monospace', fontSize: 13, cursor: 'pointer', fontWeight: 600, marginTop: 8 }}>
          ➕ Adicionar KPI
        </button>
      </div>

      {/* Nova seção: Obrigatoriedade de Preenchimento KPI */}
      <div style={s.sec}>
        <div style={s.secTitle}>Configurações de Lançamento de KPIs</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10, padding: '12px 14px', background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 10 }}>
          <label style={{ ...s.label, marginBottom: 0, flex: 1, cursor: 'pointer' }} htmlFor="kpi-obrigatorio-toggle">
            Obrigar preenchimento diário de KPIs
            <p style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>
              Se ativado, o usuário só terá acesso total ao sistema após preencher os KPIs do dia anterior.
            </p>
          </label>
          <label className="switch">
            <input type="checkbox" id="kpi-obrigatorio-toggle"
              checked={kpiObrigatorio}
              onChange={e => setKpiObrigatorio(e.target.checked)}
            />
            <span className="slider round"></span>
          </label>
        </div>
      </div>

      <button style={s.saveBtn} onClick={salvar} disabled={saving}>
        {saving ? '⏳ Salvando...' : '✅ Salvar KPIs'}
      </button>
    </div>
  )
}

// ══════════════════════════════════════════════
// ABA USUÁRIOS — COM PERMISSÕES + PERFIS
// ══════════════════════════════════════════════
function TabUsuarios({ cfg, setCfg, empresaId }) {
  const [users,   setUsers]   = useState(cfg.users || [])
  const [form,    setForm]    = useState(null)
  const [saving,  setSaving]  = useState(false)
  const [abaU,    setAbaU]    = useState('lista') // 'lista' | 'perfis'
  const [perfis,  setPerfis]  = useState(cfg.perfisTipos || [
    { id: 'admin', nome: 'Administrador', permissoes: PERMISSOES_ADMIN, fixo: true },
    { id: 'user',  nome: 'Vendedor',      permissoes: PERMISSOES_USER,  fixo: true },
  ])
  const [perfilForm, setPerfilForm] = useState(null)

  const emptyForm = { nome: '', usuario: '', email: '', telefone: '', senha: '', perfilId: 'user', permissoes: PERMISSOES_USER }

  function editUser(u) { setForm({ ...u, permissoes: u.permissoes || PERMISSOES_USER }) }

  function removeUser(id) {
    if (!confirm('Remover usuário?')) return
    setUsers(prev => prev.filter(u => u.id !== id))
  }

  function mudarPerfil(perfilId) {
    const p = perfis.find(x => x.id === perfilId)
    setForm(f => ({ ...f, perfilId, permissoes: p?.permissoes || PERMISSOES_USER }))
  }

  function togglePermissao(perm) {
    setForm(f => {
      const perms = f.permissoes || []
      return { ...f, permissoes: perms.includes(perm) ? perms.filter(x => x !== perm) : [...perms, perm] }
    })
  }

  async function salvarUser() {
    if (!form.nome || !form.email) { toast('Nome e e-mail obrigatórios', 'err'); return }
    setSaving(true)
    let novos
    if (form.id) {
      novos = users.map(u => u.id === form.id ? form : u)
    } else {
      novos = [...users, { ...form, id: Date.now().toString() }]
    }
    const novoCfg = { ...cfg, users: novos, perfisTipos: perfis }
    const { error } = await salvarStorage(empresaId, novoCfg)
    setSaving(false)
    if (error) { toast('Erro ao salvar', 'err'); return }
    setUsers(novos)
    setCfg(novoCfg)
    setForm(null)
    toast('✅ Usuário salvo!')
  }

  // ── Perfis personalizados ──
  function addPerfil() {
    setPerfilForm({ id: 'perfil_' + Date.now(), nome: '', permissoes: PERMISSOES_USER, fixo: false })
  }
  function togglePerfilPerm(perm) {
    setPerfilForm(f => {
      const perms = f.permissoes || []
      return { ...f, permissoes: perms.includes(perm) ? perms.filter(x => x !== perm) : [...perms, perm] }
    })
  }
  async function salvarPerfil() {
    if (!perfilForm.nome) { toast('Nome do perfil obrigatório', 'err'); return }
    let novos
    if (perfis.find(p => p.id === perfilForm.id)) {
      novos = perfis.map(p => p.id === perfilForm.id ? perfilForm : p)
    } else {
      novos = [...perfis, perfilForm]
    }
    const novoCfg = { ...cfg, perfisTipos: novos }
    const { error } = await salvarStorage(empresaId, novoCfg)
    if (error) { toast('Erro ao salvar', 'err'); return }
    setPerfis(novos)
    setCfg(novoCfg)
    setPerfilForm(null)
    toast('✅ Perfil salvo!')
  }
  async function removerPerfil(id) {
    if (!confirm('Remover perfil?')) return
    const novos = perfis.filter(p => p.id !== id)
    const novoCfg = { ...cfg, perfisTipos: novos }
    await salvarStorage(empresaId, novoCfg)
    setPerfis(novos)
    setCfg(novoCfg)
    toast('🗑 Perfil removido!')
  }

  const nomePerfilLabel = (perfilId) => perfis.find(p => p.id === perfilId)?.nome || perfilId

  return (
    <div style={s.body}>
      <div style={{ display: 'flex', gap: 6, marginBottom: 20 }}>
        {[['lista','👥 Usuários'],['perfis','🔐 Tipos de Perfil']].map(([id, label]) => (
          <button key={id} onClick={() => setAbaU(id)}
            style={{ padding: '8px 16px', borderRadius: 9, fontFamily: 'DM Mono, monospace', fontSize: 12, cursor: 'pointer',
              background: abaU === id ? 'rgba(0,212,255,.12)' : 'var(--surface2)',
              border: `1px solid ${abaU === id ? 'rgba(0,212,255,.35)' : 'var(--border)'}`,
              color: abaU === id ? 'var(--accent)' : 'var(--muted)', fontWeight: abaU === id ? 600 : 400 }}>
            {label}
          </button>
        ))}
      </div>

      {abaU === 'lista' && (
        <div style={s.sec}>
          <div style={s.secTitle}>Usuários do Sistema</div>
          {users.length === 0 && <p style={{ color: 'var(--muted)', fontSize: 13, marginBottom: 12 }}>Nenhum usuário cadastrado.</p>}
          {users.map(u => (
            <div key={u.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 10, marginBottom: 8 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: 14 }}>{u.nome}</div>
                <div style={{ fontSize: 12, color: 'var(--muted)' }}>
                  {u.email} · <span style={{ color: 'var(--accent)', fontWeight: 600 }}>{nomePerfilLabel(u.perfilId || u.perfil)}</span>
                </div>
                {u.permissoes && (
                  <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 3 }}>
                    {u.permissoes.length} permissões configuradas
                  </div>
                )}
              </div>
              <button onClick={() => editUser(u)}
                style={{ padding: '5px 10px', borderRadius: 7, background: 'rgba(0,212,255,.1)', border: '1px solid rgba(0,212,255,.2)', color: 'var(--accent)', cursor: 'pointer', fontFamily: 'DM Mono, monospace', fontSize: 12 }}>
                ✏️ Editar
              </button>
              <button onClick={() => removeUser(u.id)}
                style={{ padding: '5px 10px', borderRadius: 7, background: 'rgba(239,68,68,.1)', border: '1px solid rgba(239,68,68,.2)', color: 'var(--danger)', cursor: 'pointer', fontFamily: 'DM Mono, monospace', fontSize: 12 }}>
                🗑
              </button>
            </div>
          ))}
          <button onClick={() => setForm(emptyForm)}
            style={{ padding: '9px 16px', borderRadius: 8, background: 'rgba(0,212,255,.1)', border: '1px solid rgba(0,212,255,.25)', color: 'var(--accent)', fontFamily: 'DM Mono, monospace', fontSize: 13, cursor: 'pointer', marginTop: 8 }}>
            + Novo Usuário
          </button>

          {form && (
            <div style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 12, padding: 18, marginTop: 16 }}>
              <div style={{ ...s.secTitle, marginBottom: 14 }}>
                {form.id ? '✏️ Editar Usuário' : '➕ Novo Usuário'}
              </div>
              <div style={s.row2}>
                <div style={s.field}><label style={s.label}>Nome Completo</label>
                  <input style={s.input} value={form.nome} onChange={e => setForm(f => ({ ...f, nome: e.target.value }))} placeholder="Nome" />
                </div>
                <div style={s.field}><label style={s.label}>Usuário (login)</label>
                  <input style={s.input} value={form.usuario} onChange={e => setForm(f => ({ ...f, usuario: e.target.value }))} placeholder="usuario" />
                </div>
              </div>
              <div style={s.row2}>
                <div style={s.field}><label style={s.label}>E-mail</label>
                  <input style={s.input} type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="email@empresa.com" />
                </div>
                <div style={s.field}><label style={s.label}>Telefone</label>
                  <input style={s.input} value={form.telefone} onChange={e => setForm(f => ({ ...f, telefone: e.target.value }))} placeholder="(00) 00000-0000" />
                </div>
              </div>
              <div style={s.row2}>
                <div style={s.field}><label style={s.label}>Senha</label>
                  <input style={s.input} type="password" value={form.senha} onChange={e => setForm(f => ({ ...f, senha: e.target.value }))} placeholder="••••••••" />
                </div>
                <div style={s.field}><label style={s.label}>Perfil base</label>
                  <select style={s.input} value={form.perfilId || form.perfil || 'user'} onChange={e => mudarPerfil(e.target.value)}>
                    {perfis.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}
                  </select>
                </div>
              </div>

              <div style={{ marginTop: 8 }}>
                <div style={{ ...s.secTitle, marginBottom: 10 }}>🔐 Permissões individuais</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                  {PERMISSOES_DISPONIVEIS.map(p => {
                    const ativo = (form.permissoes || []).includes(p.id)
                    return (
                      <div key={p.id} onClick={() => togglePermissao(p.id)}
                        style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', borderRadius: 8,
                          background: ativo ? 'rgba(0,212,255,.08)' : 'var(--surface)',
                          border: `1px solid ${ativo ? 'rgba(0,212,255,.3)' : 'var(--border)'}`,
                          cursor: 'pointer', fontSize: 12, color: ativo ? 'var(--text)' : 'var(--muted)', transition: 'all .15s' }}>
                        <div style={{ width: 16, height: 16, borderRadius: 4, border: `2px solid ${ativo ? 'var(--accent)' : 'var(--border)'}`, background: ativo ? 'var(--accent)' : 'transparent', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          {ativo && <span style={{ color: '#fff', fontSize: 10 }}>✓</span>}
                        </div>
                        {p.label}
                      </div>
                    )
                  })}
                </div>
              </div>

              <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
                <button style={s.saveBtn} onClick={salvarUser} disabled={saving}>
                  {saving ? '⏳...' : '✅ Salvar Usuário'}
                </button>
                <button onClick={() => setForm(null)}
                  style={{ padding: '11px 18px', borderRadius: 10, background: 'rgba(100,116,139,.12)', border: '1px solid rgba(100,116,139,.3)', color: 'var(--muted)', fontFamily: 'DM Mono, monospace', fontSize: 13, cursor: 'pointer' }}>
                  Cancelar
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {abaU === 'perfis' && (
        <div style={s.sec}>
          <div style={s.secTitle}>Tipos de Perfil de Acesso</div>
          <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 14, lineHeight: 1.6 }}>
            Crie perfis personalizados com permissões específicas. Os perfis fixos (Admin e Vendedor) não podem ser removidos.
          </p>
          {perfis.map(p => (
            <div key={p.id} style={{ padding: '12px 16px', background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 10, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: 14, color: p.fixo ? 'var(--accent)' : 'var(--text)' }}>
                  {p.fixo ? '🔒 ' : ''}{p.nome}
                </div>
                <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>
                  {p.permissoes.length} permissões
                </div>
              </div>
              <button onClick={() => setPerfilForm({ ...p })}
                style={{ padding: '5px 10px', borderRadius: 7, background: 'rgba(0,212,255,.1)', border: '1px solid rgba(0,212,255,.2)', color: 'var(--accent)', cursor: 'pointer', fontFamily: 'DM Mono, monospace', fontSize: 12 }}>
                ✏️ Editar
              </button>
              {!p.fixo && (
                <button onClick={() => removerPerfil(p.id)}
                  style={{ padding: '5px 10px', borderRadius: 7, background: 'rgba(239,68,68,.1)', border: '1px solid rgba(239,68,68,.2)', color: 'var(--danger)', cursor: 'pointer', fontFamily: 'DM Mono, monospace', fontSize: 12 }}>
                  🗑
                </button>
              )}
            </div>
          ))}
          <button onClick={addPerfil}
            style={{ padding: '9px 16px', borderRadius: 8, background: 'rgba(0,212,255,.1)', border: '1px solid rgba(0,212,255,.25)', color: 'var(--accent)', fontFamily: 'DM Mono, monospace', fontSize: 13, cursor: 'pointer', marginTop: 8 }}>
            + Novo Perfil Personalizado
          </button>

          {perfilForm && (
            <div style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 12, padding: 18, marginTop: 16 }}>
              <div style={{ ...s.secTitle, marginBottom: 14 }}>
                {perfilForm.fixo ? '✏️ Editar Perfil' : '➕ Novo Perfil'}
              </div>
              <div style={s.field}>
                <label style={s.label}>Nome do perfil</label>
                <input style={s.input} value={perfilForm.nome} onChange={e => setPerfilForm(f => ({ ...f, nome: e.target.value }))} placeholder="Ex: Supervisor" disabled={perfilForm.fixo} />
              </div>
              <div style={{ ...s.secTitle, marginTop: 12, marginBottom: 10 }}>Permissões deste perfil</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                {PERMISSOES_DISPONIVEIS.map(p => {
                  const ativo = (perfilForm.permissoes || []).includes(p.id)
                  return (
                    <div key={p.id} onClick={() => togglePerfilPerm(p.id)}
                      style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', borderRadius: 8,
                        background: ativo ? 'rgba(0,212,255,.08)' : 'var(--surface)',
                        border: `1px solid ${ativo ? 'rgba(0,212,255,.3)' : 'var(--border)'}`,
                        cursor: 'pointer', fontSize: 12, color: ativo ? 'var(--text)' : 'var(--muted)', transition: 'all .15s' }}>
                      <div style={{ width: 16, height: 16, borderRadius: 4, border: `2px solid ${ativo ? 'var(--accent)' : 'var(--border)'}`, background: ativo ? 'var(--accent)' : 'transparent', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        {ativo && <span style={{ color: '#fff', fontSize: 10 }}>✓</span>}
                      </div>
                      {p.label}
                    </div>
                  )
                })}
              </div>
              <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
                <button style={s.saveBtn} onClick={salvarPerfil}>✅ Salvar Perfil</button>
                <button onClick={() => setPerfilForm(null)}
                  style={{ padding: '11px 18px', borderRadius: 10, background: 'rgba(100,116,139,.12)', border: '1px solid rgba(100,116,139,.3)', color: 'var(--muted)', fontFamily: 'DM Mono, monospace', fontSize: 13, cursor: 'pointer' }}>
                  Cancelar
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ══════════════════════════════════════════════
// ABA PRODUTOS — COMPLETO COM PLANOS + PREÇOS
// ══════════════════════════════════════════════
function TabProdutos({ cfg, setCfg, empresaId }) {
  const [produtos, setProdutos] = useState(cfg.products || MODULOS_PADRAO.map(m => ({ id: m, nome: m, precos: PRECOS_PADRAO[m] || {} })))
  const [planos,   setPlanos]   = useState(cfg.plans    || PLANOS_PADRAO)
  const [saving,   setSaving]   = useState(false)
  const [formProduto, setFormProduto] = useState(null) // Para adicionar/editar produto
  const [formPlano,   setFormPlano]   = useState(null)   // Para adicionar/editar plano
  const [unlimitedUsers, setUnlimitedUsers] = useState(cfg.unlimitedUsers || false) // Nova configuração

  useEffect(() => {
    setProdutos(cfg.products || MODULOS_PADRAO.map(m => ({ id: m, nome: m, precos: PRECOS_PADRAO[m] || {} })))
    setPlanos(cfg.plans || PLANOS_PADRAO)
    setUnlimitedUsers(cfg.unlimitedUsers || false)
  }, [cfg])

  function addProduto() {
    setFormProduto({ id: 'novo_' + Date.now(), nome: '', precos: {}, semAdesao: false, apenasBasicProTop: false })
  }
  function editProduto(prod) {
    setFormProduto({ ...prod,
      semAdesao: prod.precos[planos[0]?.id]?.[0] === 0, // Verifica se o preço de adesão do primeiro plano é 0
      apenasBasicProTop: !planos.some(p => p.id === 'topplus' && prod.precos[p.id]) // Verifica se Top Plus não tem preço
    })
  }
  function removeProduto(id) {
    if (!confirm('Remover produto?')) return
    setProdutos(prev => prev.filter(p => p.id !== id))
  }

  function addPlano() {
    setFormPlano({ id: 'novo_' + Date.now(), nome: '', maxCnpjs: 0, usuarios: 0 })
  }
  function editPlano(plano) {
    setFormPlano({ ...plano })
  }
  function removePlano(id) {
    if (!confirm('Remover plano?')) return
    setPlanos(prev => prev.filter(p => p.id !== id))
  }

  async function salvar() {
    setSaving(true)
    const novoCfg = { ...cfg, products: produtos, plans: planos, unlimitedUsers: unlimitedUsers }
    const { error } = await salvarStorage(empresaId, novoCfg)
    setSaving(false)
    if (error) { toast('Erro ao salvar', 'err'); return }
    setCfg(novoCfg)
    toast('✅ Produtos e Planos salvos!')
  }

  async function salvarProdutoForm() {
    if (!formProduto.nome) { toast('Nome do produto obrigatório', 'err'); return }

    const novosPrecos = {}
    planos.forEach(plano => {
      const adesao = parseFloat(formProduto.precos[`${plano.id}_adesao`] || 0)
      const mensalidade = parseFloat(formProduto.precos[`${plano.id}_mensalidade`] || 0)
      novosPrecos[plano.id] = [adesao, mensalidade]
    })

    const produtoFinal = {
      id: formProduto.id,
      nome: formProduto.nome,
      precos: novosPrecos
    }

    let novosProdutos
    if (produtos.find(p => p.id === formProduto.id)) {
      novosProdutos = produtos.map(p => p.id === formProduto.id ? produtoFinal : p)
    } else {
      novosProdutos = [...produtos, produtoFinal]
    }
    setProdutos(novosProdutos)
    setFormProduto(null)
    toast('✅ Produto salvo!')
  }

  async function salvarPlanoForm() {
    if (!formPlano.nome || !formPlano.id) { toast('Nome e ID do plano obrigatórios', 'err'); return }
    let novos
    if (planos.find(p => p.id === formPlano.id)) {
      novos = planos.map(p => p.id === formPlano.id ? formPlano : p)
    } else {
      novos = [...planos, formPlano]
    }
    setPlanos(novos)
    setFormPlano(null)
    toast('✅ Plano salvo!')
  }

  async function restaurarPadrao() {
    if (!confirm('Restaurar preços padrão? Isso apagará suas configurações atuais.')) return
    const novoCfg = { ...cfg,
      products: MODULOS_PADRAO.map(m => ({ id: m, nome: m, precos: PRECOS_PADRAO[m] || {} })),
      plans: PLANOS_PADRAO
    }
    const { error } = await salvarStorage(empresaId, novoCfg)
    if (error) { toast('Erro', 'err'); return }
    setCfg(novoCfg)
    toast('🔄 Padrões restaurados!')
  }

  return (
    <div style={s.body}>
      <div style={s.sec}>
        <div style={s.secTitle}>Configurações Gerais</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10, padding: '12px 14px', background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 10 }}>
          <label style={{ ...s.label, marginBottom: 0, flex: 1, cursor: 'pointer' }} htmlFor="unlimited-users-toggle">
            Usuários Ilimitados nas ofertas
            <p style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>
              Exibe "Usuários Ilimitados" nas ofertas com desconto e fechamento.
            </p>
          </label>
          <label className="switch">
            <input type="checkbox" id="unlimited-users-toggle"
              checked={unlimitedUsers}
              onChange={e => setUnlimitedUsers(e.target.checked)}
            />
            <span className="slider round"></span>
          </label>
        </div>
      </div>

      <div style={s.sec}>
        <div style={s.secTitle}>📦 Produtos e Planos</div>
        <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 14, lineHeight: 1.6 }}>
          Configure os produtos/módulos e seus preços para cada plano disponível.
        </p>

        {/* Lista de Produtos */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 10, color: 'var(--accent)' }}>Produtos/Módulos</div>
          {produtos.length === 0 && <p style={{ color: 'var(--muted)', fontSize: 13, marginBottom: 12 }}>Nenhum produto cadastrado.</p>}
          {produtos.map(p => (
            <div key={p.id} style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 10, padding: '12px 14px', marginBottom: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>{p.nome}</div>
                  <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>
                    {planos.map(plano => (
                      <span key={plano.id} style={{ marginRight: 8 }}>
                        {plano.nome}: R$ {p.precos[plano.id]?.[0] || 0} / R$ {p.precos[plano.id]?.[1] || 0}
                      </span>
                    ))}
                  </div>
                </div>
                <button onClick={() => editProduto(p)}
                  style={{ padding: '5px 10px', borderRadius: 7, background: 'rgba(0,212,255,.1)', border: '1px solid rgba(0,212,255,.2)', color: 'var(--accent)', cursor: 'pointer', fontFamily: 'DM Mono, monospace', fontSize: 12 }}>
                  ✏️ Editar
                </button>
                <button onClick={() => removeProduto(p.id)}
                  style={{ padding: '5px 10px', borderRadius: 7, background: 'rgba(239,68,68,.1)', border: '1px solid rgba(239,68,68,.2)', color: 'var(--danger)', cursor: 'pointer', fontFamily: 'DM Mono, monospace', fontSize: 12 }}>
                  🗑
                </button>
              </div>
            </div>
          ))}
          <button onClick={addProduto}
            style={{ padding: '9px 16px', borderRadius: 8, background: 'rgba(0,212,255,.1)', border: '1px solid rgba(0,212,255,.25)', color: 'var(--accent)', fontFamily: 'DM Mono, monospace', fontSize: 13, cursor: 'pointer', marginTop: 8 }}>
            + Novo Produto
          </button>
        </div>

        {/* Lista de Planos */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 10, color: 'var(--accent)' }}>Planos Disponíveis</div>
          {planos.length === 0 && <p style={{ color: 'var(--muted)', fontSize: 13, marginBottom: 12 }}>Nenhum plano cadastrado.</p>}
          {planos.map(plano => (
            <div key={plano.id} style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 10, padding: '12px 14px', marginBottom: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>{plano.nome}</div>
                  <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>
                    ID: {plano.id} · CNPJs: {plano.maxCnpjs} · Usuários: {plano.usuarios}
                  </div>
                </div>
                <button onClick={() => editPlano(plano)}
                  style={{ padding: '5px 10px', borderRadius: 7, background: 'rgba(0,212,255,.1)', border: '1px solid rgba(0,212,255,.2)', color: 'var(--accent)', cursor: 'pointer', fontFamily: 'DM Mono, monospace', fontSize: 12 }}>
                  ✏️ Editar
                </button>
                <button onClick={() => removePlano(plano.id)}
                  style={{ padding: '5px 10px', borderRadius: 7, background: 'rgba(239,68,68,.1)', border: '1px solid rgba(239,68,68,.2)', color: 'var(--danger)', cursor: 'pointer', fontFamily: 'DM Mono, monospace', fontSize: 12 }}>
                  🗑
                </button>
              </div>
            </div>
          ))}
          <button onClick={addPlano}
            style={{ padding: '9px 16px', borderRadius: 8, background: 'rgba(0,212,255,.1)', border: '1px solid rgba(0,212,255,.25)', color: 'var(--accent)', fontFamily: 'DM Mono, monospace', fontSize: 13, cursor: 'pointer', marginTop: 8 }}>
            + Novo Plano
          </button>
        </div>

        <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
          <button style={s.saveBtn} onClick={salvar} disabled={saving}>
            {saving ? '⏳ Salvando...' : '✅ Salvar Tudo'}
          </button>
          <button onClick={restaurarPadrao}
            style={{ padding: '11px 18px', borderRadius: 10, background: 'rgba(100,116,139,.12)', border: '1px solid rgba(100,116,139,.3)', color: 'var(--muted)', fontFamily: 'DM Mono, monospace', fontSize: 13, cursor: 'pointer' }}>
            🔄 Restaurar preços padrão
          </button>
        </div>

        {/* Modal de Adicionar/Editar Produto */}
        {formProduto && (
          <div className="modal-overlay">
            <div className="modal-box">
              <div className="modal-header">
                <h3>{formProduto.id.startsWith('novo') ? '📦 Novo Produto' : '✏️ Editar Produto'}</h3>
                <button className="modal-close" onClick={() => setFormProduto(null)}>✕</button>
              </div>
              <div className="modal-body">
                <div style={s.field}>
                  <label style={s.label}>Nome do Produto</label>
                  <input style={s.input} value={formProduto.nome} onChange={e => setFormProduto(f => ({ ...f, nome: e.target.value }))} placeholder="Ex: Gestão Fiscal" />
                </div>
                <div style={{ ...s.secTitle, marginTop: 16, marginBottom: 10 }}>PREÇOS POR PLANO (Adesão | Mensalidade)</div>
                {planos.map(plano => (
                  <div key={plano.id} style={{ marginBottom: 10, padding: '10px 12px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8 }}>
                    <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 6, color: 'var(--accent)' }}>{plano.nome}</div>
                    <div style={s.row2}>
                      <div style={s.field}>
                        <label style={s.label}>Adesão (R$)</label>
                        <input type="number" style={s.input}
                          value={formProduto.precos[`${plano.id}_adesao`] !== undefined ? formProduto.precos[`${plano.id}_adesao`] : (formProduto.precos[plano.id]?.[0] || 0)}
                          onChange={e => setFormProduto(f => ({ ...f, precos: { ...f.precos, [`${plano.id}_adesao`]: e.target.value } }))}
                          placeholder="0" />
                      </div>
                      <div style={s.field}>
                        <label style={s.label}>Mensalidade (R$)</label>
                        <input type="number" style={s.input}
                          value={formProduto.precos[`${plano.id}_mensalidade`] !== undefined ? formProduto.precos[`${plano.id}_mensalidade`] : (formProduto.precos[plano.id]?.[1] || 0)}
                          onChange={e => setFormProduto(f => ({ ...f, precos: { ...f.precos, [`${plano.id}_mensalidade`]: e.target.value } }))}
                          placeholder="0" />
                      </div>
                    </div>
                  </div>
                ))}
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 10 }}>
                  <input type="checkbox" id="sem-adesao" checked={formProduto.semAdesao} onChange={e => setFormProduto(f => ({ ...f, semAdesao: e.target.checked }))} />
                  <label htmlFor="sem-adesao" style={s.label}>Sem adesão (módulo como CND)</label>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 5 }}>
                  <input type="checkbox" id="apenas-basic-pro-top" checked={formProduto.apenasBasicProTop} onChange={e => setFormProduto(f => ({ ...f, apenasBasicProTop: e.target.checked }))} />
                  <label htmlFor="apenas-basic-pro-top" style={s.label}>Apenas planos Basic/Pro/Top (como IF/EP)</label>
                </div>
              </div>
              <div className="modal-footer">
                <button className="btn-cancel" onClick={() => setFormProduto(null)}>Cancelar</button>
                <button className="btn-primary" onClick={salvarProdutoForm}>✅ Salvar Produto</button>
              </div>
            </div>
          </div>
        )}

        {/* Modal de Adicionar/Editar Plano */}
        {formPlano && (
          <div className="modal-overlay">
            <div className="modal-box">
              <div className="modal-header">
                <h3>{formPlano.id.startsWith('novo') ? '➕ Novo Plano' : '✏️ Editar Plano'}</h3>
                <button className="modal-close" onClick={() => setFormPlano(null)}>✕</button>
              </div>
              <div className="modal-body">
                <div style={s.field}>
                  <label style={s.label}>Nome Exibido</label>
                  <input style={s.input} value={formPlano.nome} onChange={e => setFormPlano(f => ({ ...f, nome: e.target.value }))} placeholder="Ex: Basic" />
                </div>
                <div style={s.field}>
                  <label style={s.label}>ID/Chave (único)</label>
                  <input style={s.input} value={formPlano.id} onChange={e => setFormPlano(f => ({ ...f, id: e.target.value }))} placeholder="Ex: basic" disabled={!formPlano.id.startsWith('novo')} />
                </div>
                <div style={s.field}>
                  <label style={s.label}>Máx CNPJs</label>
                  <input type="number" style={s.input} value={formPlano.maxCnpjs} onChange={e => setFormPlano(f => ({ ...f, maxCnpjs: parseInt(e.target.value) || 0 }))} placeholder="0" />
                </div>
                <div style={s.field}>
                  <label style={s.label}>Usuários</label>
                  <input type="number" style={s.input} value={formPlano.usuarios} onChange={e => setFormPlano(f => ({ ...f, usuarios: parseInt(e.target.value) || 0 }))} placeholder="0" />
                </div>
              </div>
              <div className="modal-footer">
                <button className="btn-cancel" onClick={() => setFormPlano(null)}>Cancelar</button>
                <button className="btn-primary" onClick={salvarPlanoForm}>✅ Salvar Plano</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════
// ABA DESCONTOS — APRIMORADA
// ══════════════════════════════════════════════
function TabDescontos({ cfg, setCfg, empresaId }) {
  const [descontoEmTela, setDescontoEmTela] = useState(cfg.descontoEmTela || false)
  const [somenteViaVoucher, setSomenteViaVoucher] = useState(cfg.somenteViaVoucher || false)
  const [percAdesaoTela, setPercAdesaoTela] = useState(cfg.percAdesaoTela || 0)
  const [percMensalidadeTela, setPercMensalidadeTela] = useState(cfg.percMensalidadeTela || 0)
  const [percAdesaoFechamento, setPercAdesaoFechamento] = useState(cfg.percAdesaoFechamento || 0)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setDescontoEmTela(cfg.descontoEmTela || false)
    setSomenteViaVoucher(cfg.somenteViaVoucher || false)
    setPercAdesaoTela(cfg.percAdesaoTela || 0)
    setPercMensalidadeTela(cfg.percMensalidadeTela || 0)
    setPercAdesaoFechamento(cfg.percAdesaoFechamento || 0)
  }, [cfg])

  async function salvar() {
    setSaving(true)
    const novoCfg = {
      ...cfg,
      descontoEmTela,
      somenteViaVoucher,
      percAdesaoTela,
      percMensalidadeTela,
      percAdesaoFechamento,
    }
    const { error } = await salvarStorage(empresaId, novoCfg)
    setSaving(false)
    if (error) { toast('Erro ao salvar', 'err'); return }
    setCfg(novoCfg)
    toast('✅ Descontos salvos!')
  }

  return (
    <div style={s.body}>
      <div style={s.sec}>
        <div style={s.secTitle}>MODO DE DESCONTO</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10, padding: '12px 14px', background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 10 }}>
          <label style={{ ...s.label, marginBottom: 0, flex: 1, cursor: 'pointer' }} htmlFor="desconto-em-tela-toggle">
            Desconto em Tela
            <p style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>
              Mostra desconto após o preço cheio automaticamente.
            </p>
          </label>
          <label className="switch">
            <input type="checkbox" id="desconto-em-tela-toggle"
              checked={descontoEmTela}
              onChange={e => setDescontoEmTela(e.target.checked)}
            />
            <span className="slider round"></span>
          </label>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10, padding: '12px 14px', background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 10 }}>
          <label style={{ ...s.label, marginBottom: 0, flex: 1, cursor: 'pointer' }} htmlFor="somente-via-voucher-toggle">
            Somente via Voucher
            <p style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>
              Desconto só é aplicado com código de voucher válido.
            </p>
          </label>
          <label className="switch">
            <input type="checkbox" id="somente-via-voucher-toggle"
              checked={somenteViaVoucher}
              onChange={e => setSomenteViaVoucher(e.target.checked)}
            />
            <span className="slider round"></span>
          </label>
        </div>
      </div>

      <div style={s.sec}>
        <div style={s.secTitle}>PERCENTUAIS DE DESCONTO</div>
        <div style={s.row2}>
          <div style={s.field}>
            <label style={s.label}>% Adesão (tela)</label>
            <input type="number" style={s.input} value={percAdesaoTela} onChange={e => setPercAdesaoTela(e.target.value)} placeholder="0" />
          </div>
          <div style={s.field}>
            <label style={s.label}>% Mensalidade (tela)</label>
            <input type="number" style={s.input} value={percMensalidadeTela} onChange={e => setPercMensalidadeTela(e.target.value)} placeholder="0" />
          </div>
        </div>
        <div style={s.field}>
          <label style={s.label}>% Adesão (fechamento)</label>
          <input type="number" style={s.input} value={percAdesaoFechamento} onChange={e => setPercAdesaoFechamento(e.target.value)} placeholder="0" />
        </div>
      </div>

      <button style={s.saveBtn} onClick={salvar} disabled={saving}>
        {saving ? '⏳ Salvando...' : '✅ Salvar'}
      </button>
    </div>
  )
}

// ══════════════════════════════════════════════
// ABA VOUCHERS — COM IMPRESSÃO DE PDF
// ══════════════════════════════════════════════
function TabVouchers({ cfg, setCfg, empresaId }) {
  const [prefixo, setPrefixo] = useState('PROMO')
  const [percAdesao, setPercAdesao] = useState(0)
  const [percMensalidade, setPercMensalidade] = useState(0)
  const [dataComemorativa, setDataComemorativa] = useState('')
  const [vouchers, setVouchers] = useState(cfg.vouchers || [])
  const [saving, setSaving] = useState(false)
  const [showVoucherModal, setShowVoucherModal] = useState(false)
  const [currentVoucher, setCurrentVoucher] = useState(null)

  useEffect(() => {
    setVouchers(cfg.vouchers || [])
  }, [cfg])

  function gerarCodigo() {
    return Math.random().toString(36).substring(2, 8).toUpperCase()
  }

  async function gerarVoucher() {
    if (!prefixo) { toast('Prefixo obrigatório', 'err'); return }
    setSaving(true)
    const novoVoucher = {
      id: Date.now().toString(),
      codigo: `${prefixo}-${gerarCodigo()}`,
      percAdesao: parseFloat(percAdesao),
      percMensalidade: parseFloat(percMensalidade),
      dataGeracao: new Date().toISOString(),
      dataComemorativa: dataComemorativa,
      usado: false,
      userId: 'admin', // Ou o ID do usuário logado
    }
    const novosVouchers = [...vouchers, novoVoucher]
    const novoCfg = { ...cfg, vouchers: novosVouchers }
    const { error } = await salvarStorage(empresaId, novoCfg)
    setSaving(false)
    if (error) { toast('Erro ao gerar voucher', 'err'); return }
    setCfg(novoCfg)
    setVouchers(novosVouchers)
    toast('✅ Voucher gerado!')
    setCurrentVoucher(novoVoucher)
    setShowVoucherModal(true)
  }

  function removerVoucher(id) {
    if (!confirm('Remover voucher?')) return
    const novosVouchers = vouchers.filter(v => v.id !== id)
    const novoCfg = { ...cfg, vouchers: novosVouchers }
    salvarStorage(empresaId, novoCfg)
    setCfg(novoCfg)
    setVouchers(novosVouchers)
    toast('🗑 Voucher removido!')
  }

  function imprimirVoucher(voucher) {
    setCurrentVoucher(voucher)
    setShowVoucherModal(true)
  }

  return (
    <div style={s.body}>
      <div style={s.sec}>
        <div style={s.secTitle}>GERAR NOVO VOUCHER</div>
        <div style={s.field}>
          <label style={s.label}>Prefixo</label>
          <input style={s.input} value={prefixo} onChange={e => setPrefixo(e.target.value)} placeholder="Ex: PROMO" />
        </div>
        <div style={s.row2}>
          <div style={s.field}>
            <label style={s.label}>% Adesão</label>
            <input type="number" style={s.input} value={percAdesao} onChange={e => setPercAdesao(e.target.value)} placeholder="0" />
          </div>
          <div style={s.field}>
            <label style={s.label}>% Mensalidade</label>
            <input type="number" style={s.input} value={percMensalidade} onChange={e => setPercMensalidade(e.target.value)} placeholder="0" />
          </div>
        </div>
        <div style={s.field}>
          <label style={s.label}>Data comemorativa (opcional)</label>
          <input style={s.input} value={dataComemorativa} onChange={e => setDataComemorativa(e.target.value)} placeholder="Ex: Natal 2025" />
        </div>
        <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
          <button style={s.saveBtn} onClick={gerarVoucher} disabled={saving}>
            {saving ? '⏳ Gerando...' : '🎫 Gerar Voucher'}
          </button>
          {currentVoucher && (
            <button onClick={() => imprimirVoucher(currentVoucher)}
              style={{ padding: '11px 18px', borderRadius: 10, background: 'rgba(124,58,237,.15)', border: '1px solid rgba(124,58,237,.3)', color: 'var(--accent2)', fontFamily: 'DM Mono, monospace', fontSize: 13, cursor: 'pointer', fontWeight: 600 }}>
              📄 Gerar PDF
            </button>
          )}
        </div>
      </div>

      <div style={s.sec}>
        <div style={s.secTitle}>VOUCHERS ATIVOS</div>
        {vouchers.length === 0 && <p style={{ color: 'var(--muted)', fontSize: 13, marginBottom: 12 }}>Nenhum voucher ativo.</p>}
        {vouchers.map(v => (
          <div key={v.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 10, marginBottom: 8 }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600, fontSize: 14 }}>{v.codigo}</div>
              <div style={{ fontSize: 12, color: 'var(--muted)' }}>
                {v.percAdesao}% off adesão {v.percMensalidade > 0 ? `e ${v.percMensalidade}% off mensalidade` : ''}
                {v.dataComemorativa && ` (${v.dataComemorativa})`}
              </div>
              {v.usado && <span style={{ ...s.badge, background: 'rgba(239,68,68,.1)', border: '1px solid rgba(239,68,68,.25)', color: 'var(--danger)', marginLeft: 8 }}>USADO</span>}
            </div>
            <button onClick={() => imprimirVoucher(v)}
              style={{ padding: '5px 10px', borderRadius: 7, background: 'rgba(124,58,237,.1)', border: '1px solid rgba(124,58,237,.2)', color: 'var(--accent2)', cursor: 'pointer', fontFamily: 'DM Mono, monospace', fontSize: 12 }}>
              📄 PDF
            </button>
            <button onClick={() => removerVoucher(v.id)}
              style={{ padding: '5px 10px', borderRadius: 7, background: 'rgba(239,68,68,.1)', border: '1px solid rgba(239,68,68,.2)', color: 'var(--danger)', cursor: 'pointer', fontFamily: 'DM Mono, monospace', fontSize: 12 }}>
              🗑
            </button>
          </div>
        ))}
      </div>

      {showVoucherModal && currentVoucher && (
        <VoucherModal voucher={currentVoucher} onClose={() => setShowVoucherModal(false)} empresaCfg={cfg} />
      )}
    </div>
  )
}

// Componente Modal do Voucher (para impressão)
function VoucherModal({ voucher, onClose, empresaCfg }) {
  const voucherRef = useRef()

  const handlePrint = () => {
    const printWindow = window.open('', '', 'height=600,width=800');
    printWindow.document.write('<html><head><title>Voucher de Desconto</title>');
    printWindow.document.write('<style>');
    printWindow.document.write(`
      body { font-family: 'Inter', sans-serif; margin: 0; padding: 20px; background: #f0f2f5; color: #333; }
      .voucher-container {
        width: 100%; max-width: 600px; margin: 0 auto; padding: 30px;
        background: linear-gradient(135deg, #1a2540, #111827);
        border-radius: 15px; box-shadow: 0 8px 20px rgba(0,0,0,0.3);
        color: #e2e8f0; text-align: center; position: relative; overflow: hidden;
        border: 2px dashed rgba(0,212,255,0.3);
      }
      .voucher-header { margin-bottom: 25px; }
      .voucher-header h1 {
        font-family: 'Syne', sans-serif; font-size: 36px; font-weight: 800;
        color: #00d4ff; text-transform: uppercase; letter-spacing: 2px;
        margin-bottom: 10px;
      }
      .voucher-header p { font-size: 16px; color: #64748b; margin-top: 5px; }
      .logo { max-height: 80px; margin-bottom: 20px; filter: drop-shadow(0 0 8px rgba(0,212,255,0.4)); }
      .benefits { margin-bottom: 30px; padding: 15px 20px; background: rgba(0,212,255,0.08); border-radius: 10px; }
      .benefits h2 {
        font-family: 'Syne', sans-serif; font-size: 22px; font-weight: 700;
        color: #10b981; margin-bottom: 15px;
      }
      .benefit-item {
        font-size: 38px; font-weight: 700; color: #10b981;
        margin-bottom: 10px;
      }
      .benefit-item span { font-size: 20px; color: #e2e8f0; font-weight: 400; }
      .voucher-code-section { margin-bottom: 30px; }
      .voucher-code-section h3 {
        font-size: 14px; color: #64748b; text-transform: uppercase;
        letter-spacing: 1px; margin-bottom: 8px;
      }
      .voucher-code {
        font-family: 'DM Mono', monospace; font-size: 48px; font-weight: 700;
        color: #00d4ff; background: rgba(0,212,255,0.05); padding: 10px 25px;
        border-radius: 12px; display: inline-block; letter-spacing: 3px;
        border: 1px solid rgba(0,212,255,0.2);
      }
      .validity { font-size: 14px; color: #64748b; line-height: 1.6; margin-bottom: 30px; }
      .validity strong { color: #e2e8f0; }
      .footer {
        border-top: 1px solid rgba(100,116,139,0.2); padding-top: 20px;
        margin-top: 20px;
      }
      .footer .company-name {
        font-family: 'Syne', sans-serif; font-size: 24px; font-weight: 800;
        color: #e2e8f0; margin-bottom: 5px;
      }
      .footer .website { font-size: 14px; color: #00d4ff; text-decoration: none; }
      .watermark {
        position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%) rotate(-45deg);
        font-size: 120px; color: rgba(100,116,139,0.08); pointer-events: none;
        user-select: none; z-index: 0; font-family: 'Syne', sans-serif; font-weight: 800;
      }
      @media print {
        body { background: #fff; }
        .voucher-container { box-shadow: none; border: 1px solid #ccc; }
        .voucher-header h1, .voucher-code { color: #007bff; }
        .benefits h2, .benefit-item { color: #28a745; }
        .watermark { display: none; }
      }
    `);
    printWindow.document.write('</style>');
    printWindow.document.write('</head><body>');
    printWindow.document.write(voucherRef.current.innerHTML);
    printWindow.document.write('</body></html>');
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
  }

  const dataGeracao = new Date(voucher.dataGeracao).toLocaleDateString('pt-BR')
  const empresaNome = empresaCfg.company || 'VIVANEXA'
  const empresaSlogan = empresaCfg.slogan || 'Assistente Comercial'
  const empresaLogo = empresaCfg.logob64

  return (
    <div className="modal-overlay">
      <div className="modal-box" style={{ maxWidth: 680 }}>
        <div className="modal-header">
          <h3>🎫 Pré-visualização do Voucher</h3>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body" style={{ padding: 0 }}>
          <div ref={voucherRef} className="voucher-container" style={{ margin: '20px auto', position: 'relative', zIndex: 1 }}>
            <div className="watermark">{empresaNome}</div>
            <div className="voucher-header">
              {empresaLogo && <img src={empresaLogo} alt="Logo" className="logo" />}
              <h1>VOUCHER DE DESCONTO</h1>
              <p>{empresaSlogan}</p>
            </div>

            <div className="benefits">
              <h2>BENEFÍCIOS INCLUÍDOS</h2>
              {voucher.percAdesao > 0 && (
                <div className="benefit-item">{voucher.percAdesao}% <span>NA ADESÃO</span></div>
              )}
              {voucher.percMensalidade > 0 && (
                <div className="benefit-item">{voucher.percMensalidade}% <span>NA MENSALIDADE</span></div>
              )}
              {(voucher.percAdesao === 0 && voucher.percMensalidade === 0) && (
                <div className="benefit-item" style={{ fontSize: 24 }}>Desconto especial!</div>
              )}
            </div>

            <div className="voucher-code-section">
              <h3>CÓDIGO DO VOUCHER</h3>
              <div className="voucher-code">{voucher.codigo}</div>
            </div>

            <div className="validity">
              Válido para contratação de novos serviços {empresaNome}.<br/>
              Apresente este voucher ao consultor para aplicar o desconto.
              <p style={{ marginTop: 10 }}>
                Gerado em: <strong>{dataGeracao}</strong> {voucher.dataComemorativa && `(Ref: ${voucher.dataComemorativa})`}
                <br/>
                Uso: <strong>Único</strong>
              </p>
            </div>

            <div className="footer">
              <div className="company-name">{empresaNome}</div>
              <a href="https://www.vivanexa.com.br" target="_blank" rel="noopener noreferrer" className="website">www.vivanexa.com.br</a>
            </div>
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn-cancel" onClick={onClose}>Fechar</button>
          <button className="btn-primary" onClick={handlePrint}>🖨️ Imprimir / Salvar PDF</button>
        </div>
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════
// ABA DOCUMENTOS — PARA UPLOAD E GESTÃO DE ARQUIVOS
// ══════════════════════════════════════════════
function TabDocumentos({ cfg, setCfg, empresaId }) {
  const [documentosImportados, setDocumentosImportados] = useState(cfg.importedDocs || [])
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [showDocModal, setShowDocModal] = useState(false)
  const [currentDocContent, setCurrentDocContent] = useState('')
  const [currentDocName, setCurrentDocName] = useState('')

  useEffect(() => {
    setDocumentosImportados(cfg.importedDocs || [])
  }, [cfg])

  async function handleFileUpload(event) {
    const file = event.target.files[0]
    if (!file) return

    if (file.size > 5 * 1024 * 1024) { // 5MB limit
      toast('Arquivo muito grande (máx 5MB)', 'err');
      return;
    }

    setUploading(true)
    const filePath = `${empresaId}/imported_docs/${Date.now()}-${file.name}`
    const { data, error } = await supabase.storage
      .from('documents') // Certifique-se que você tem um bucket 'documents' no Supabase Storage
      .upload(filePath, file)

    if (error) {
      toast('Erro ao fazer upload: ' + error.message, 'err');
      setUploading(false);
      return;
    }

    const publicUrl = supabase.storage.from('documents').getPublicUrl(filePath).data.publicUrl;

    const novoDocumento = {
      id: Date.now().toString(),
      nome: file.name,
      url: publicUrl,
      tipo: file.type,
      uploadedAt: new Date().toISOString(),
      userId: 'admin', // Ou o ID do usuário logado
    }

    const novosDocumentos = [...documentosImportados, novoDocumento]
    const novoCfg = { ...cfg, importedDocs: novosDocumentos }
    const { error: saveError } = await salvarStorage(empresaId, novoCfg)

    setUploading(false)
    if (saveError) {
      toast('Erro ao salvar no banco de dados: ' + saveError.message, 'err');
      return;
    }
    setCfg(novoCfg)
    setDocumentosImportados(novosDocumentos)
    toast('✅ Documento importado com sucesso!')
  }

  async function removerDocumento(docId, docUrl) {
    if (!confirm('Remover documento? Esta ação é irreversível.')) return

    setSaving(true)
    // Extrair o caminho do arquivo da URL pública para remover do storage
    const pathSegments = docUrl.split('/')
    const filePath = pathSegments.slice(pathSegments.indexOf(empresaId)).join('/')

    const { error: deleteError } = await supabase.storage
      .from('documents')
      .remove([filePath])

    if (deleteError) {
      toast('Erro ao remover do storage: ' + deleteError.message, 'err');
      setSaving(false);
      return;
    }

    const novosDocumentos = documentosImportados.filter(doc => doc.id !== docId)
    const novoCfg = { ...cfg, importedDocs: novosDocumentos }
    const { error: saveError } = await salvarStorage(empresaId, novoCfg)

    setSaving(false)
    if (saveError) {
      toast('Erro ao atualizar banco de dados: ' + saveError.message, 'err');
      return;
    }
    setCfg(novoCfg)
    setDocumentosImportados(novosDocumentos)
    toast('🗑 Documento removido!')
  }

  async function visualizarDocumento(doc) {
    if (doc.tipo.includes('pdf')) {
      window.open(doc.url, '_blank');
    } else if (doc.tipo.includes('html')) {
      try {
        const response = await fetch(doc.url);
        const htmlContent = await response.text();
        setCurrentDocContent(htmlContent);
        setCurrentDocName(doc.nome);
        setShowDocModal(true);
      } catch (error) {
        toast('Erro ao carregar conteúdo HTML: ' + error.message, 'err');
      }
    } else {
      toast('Tipo de documento não suportado para visualização direta.', 'err');
    }
  }

  return (
    <div style={s.body}>
      <div style={s.sec}>
        <div style={s.secTitle}>📄 Documentos Importados</div>
        <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 14, lineHeight: 1.6 }}>
          Faça upload de documentos (PDF, HTML) para uso interno ou como modelos.
          **Não suporta edição online de .doc/.docx.**
        </p>

        <div style={s.field}>
          <label style={s.label}>Upload de Documento (PDF, HTML — máx 5MB)</label>
          <input type="file" accept=".pdf,.html" onChange={handleFileUpload} style={{ ...s.input, padding: '6px' }} disabled={uploading} />
          {uploading && <p style={{ fontSize: 12, color: 'var(--accent)', marginTop: 5 }}>⏳ Fazendo upload...</p>}
        </div>

        <div style={{ marginTop: 20 }}>
          <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 10, color: 'var(--accent)' }}>Documentos na Nuvem</div>
          {documentosImportados.length === 0 && <p style={{ color: 'var(--muted)', fontSize: 13, marginBottom: 12 }}>Nenhum documento importado.</p>}
          {documentosImportados.map(doc => (
            <div key={doc.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 10, marginBottom: 8 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: 14 }}>{doc.nome}</div>
                <div style={{ fontSize: 12, color: 'var(--muted)' }}>
                  {new Date(doc.uploadedAt).toLocaleDateString('pt-BR')} · {doc.tipo.split('/')[1].toUpperCase()}
                </div>
              </div>
              <button onClick={() => visualizarDocumento(doc)}
                style={{ padding: '5px 10px', borderRadius: 7, background: 'rgba(0,212,255,.1)', border: '1px solid rgba(0,212,255,.2)', color: 'var(--accent)', cursor: 'pointer', fontFamily: 'DM Mono, monospace', fontSize: 12 }}>
                👁 Ver
              </button>
              <button onClick={() => removerDocumento(doc.id, doc.url)}
                style={{ padding: '5px 10px', borderRadius: 7, background: 'rgba(239,68,68,.1)', border: '1px solid rgba(239,68,68,.2)', color: 'var(--danger)', cursor: 'pointer', fontFamily: 'DM Mono, monospace', fontSize: 12 }} disabled={saving}>
                🗑
              </button>
            </div>
          ))}
        </div>
      </div>

      {showDocModal && (
        <div className="modal-overlay">
          <div className="modal-box" style={{ maxWidth: '80vw', width: '90%', height: '90vh' }}>
            <div className="modal-header">
              <h3>Visualizar Documento: {currentDocName}</h3>
              <button className="modal-close" onClick={() => setShowDocModal(false)}>✕</button>
            </div>
            <div className="modal-body" style={{ flex: 1, overflowY: 'auto', padding: '20px', background: '#fff', color: '#333' }}>
              <div dangerouslySetInnerHTML={{ __html: currentDocContent }} />
            </div>
            <div className="modal-footer">
              <button className="btn-cancel" onClick={() => setShowDocModal(false)}>Fechar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ══════════════════════════════════════════════
// ABA HISTÓRICO — MELHORADA
// ══════════════════════════════════════════════
function TabHistorico({ cfg, setCfg, empresaId }) {
  const [docHistory, setDocHistory] = useState(cfg.docHistory || [])
  const [filterType, setFilterType] = useState('todos') // 'todos', 'propostas', 'contratos'
  const [filterStatus, setFilterStatus] = useState('todos') // 'todos', 'aguardando', 'assinado', 'rascunho'
  const [searchTerm, setSearchTerm] = useState('')
  const [showDocModal, setShowDocModal] = useState(false)
  const [currentDocContent, setCurrentDocContent] = useState('')
  const [currentDocTitle, setCurrentDocTitle] = useState('')
  const [loadingDocContent, setLoadingDocContent] = useState(false)

  useEffect(() => {
    setDocHistory(cfg.docHistory || [])
  }, [cfg])

  const filteredDocs = docHistory.filter(doc => {
    const matchesType = filterType === 'todos' || doc.type === filterType
    const matchesStatus = filterStatus === 'todos' || doc.status === filterStatus
    const matchesSearch = searchTerm === '' ||
                          doc.clientName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          doc.title.toLowerCase().includes(searchTerm.toLowerCase())
    return matchesType && matchesStatus && matchesSearch
  }).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)) // Mais recentes primeiro

  async function visualizarDocumento(doc) {
    setLoadingDocContent(true)
    setCurrentDocTitle(doc.title)
    try {
      // Assumindo que o conteúdo HTML está no Supabase Storage
      const { data, error } = await supabase.storage
        .from('documents') // Seu bucket de documentos
        .download(`${empresaId}/generated_docs/${doc.id}.html`) // Caminho onde o HTML foi salvo

      if (error) throw error

      const reader = new FileReader()
      reader.onload = (e) => {
        setCurrentDocContent(e.target.result)
        setShowDocModal(true)
        setLoadingDocContent(false)
      }
      reader.readAsText(data)

    } catch (error) {
      toast('Erro ao carregar conteúdo do documento: ' + error.message, 'err')
      setLoadingDocContent(false)
    }
  }

  function getStatusLabel(status) {
    switch (status) {
      case 'rascunho': return 'Rascunho'
      case 'aguardando': return 'Aguardando assinatura'
      case 'assinado': return 'Assinado'
      default: return status
    }
  }

  function getStatusColor(status) {
    switch (status) {
      case 'rascunho': return 'var(--muted)'
      case 'aguardando': return 'var(--warning)'
      case 'assinado': return 'var(--accent3)'
      default: return 'var(--muted)'
    }
  }

  return (
    <div style={s.body}>
      <div style={s.sec}>
        <div style={s.secTitle}>🗂️ Propostas e Contratos Gerados</div>
        <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 14, lineHeight: 1.6 }}>
          Acompanhe o status de todas as propostas e contratos gerados pelo sistema.
        </p>

        <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
          <select style={{ ...s.input, flex: 1, minWidth: 120 }} value={filterType} onChange={e => setFilterType(e.target.value)}>
            <option value="todos">Todos</option>
            <option value="proposta">Propostas</option>
            <option value="contrato">Contratos</option>
          </select>
          <select style={{ ...s.input, flex: 1, minWidth: 160 }} value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
            <option value="todos">Todos os status</option>
            <option value="aguardando">Aguardando assinatura</option>
            <option value="assinado">Assinado</option>
            <option value="rascunho">Rascunho</option>
          </select>
          <input type="text" style={{ ...s.input, flex: 2, minWidth: 180 }} placeholder="Buscar por cliente..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
          <button onClick={() => { setFilterType('todos'); setFilterStatus('todos'); setSearchTerm('') }}
            style={{ padding: '10px 16px', borderRadius: 8, background: 'rgba(100,116,139,.12)', border: '1px solid rgba(100,116,139,.3)', color: 'var(--muted)', fontFamily: 'DM Mono, monospace', fontSize: 13, cursor: 'pointer' }}>
            🗑 Limpar
          </button>
        </div>

        {filteredDocs.length === 0 && <p style={{ color: 'var(--muted)', fontSize: 13, marginBottom: 12 }}>Nenhum documento encontrado com os filtros aplicados.</p>}

        {filteredDocs.map(doc => (
          <div key={doc.id} style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 10, padding: '14px 16px', marginBottom: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <div style={{ fontWeight: 600, fontSize: 15, color: 'var(--text)' }}>{doc.title}</div>
              <span style={{ fontSize: 11, color: getStatusColor(doc.status), background: `${getStatusColor(doc.status).replace('var(--', 'rgba(').replace(')', ',.1)')}`, padding: '4px 10px', borderRadius: 15, fontWeight: 600 }}>
                {getStatusLabel(doc.status)}
              </span>
            </div>
            <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 8 }}>
              Cliente: <strong>{doc.clientName}</strong> · Gerado por: {doc.userName}
            </div>
            <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 12 }}>
              {new Date(doc.createdAt).toLocaleString('pt-BR')}
              {doc.consultantSignedAt && <span style={{ marginLeft: 10 }}> · Consultor assinou em {new Date(doc.consultantSignedAt).toLocaleString('pt-BR')}</span>}
              {doc.clientSignedAt && <span style={{ marginLeft: 10 }}> · Cliente assinou em {new Date(doc.clientSignedAt).toLocaleString('pt-BR')}</span>}
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => visualizarDocumento(doc)}
                style={{ padding: '8px 14px', borderRadius: 8, background: 'rgba(0,212,255,.1)', border: '1px solid rgba(0,212,255,.2)', color: 'var(--accent)', cursor: 'pointer', fontFamily: 'DM Mono, monospace', fontSize: 13 }}>
                👁 Ver Documento
              </button>
              {doc.signatureLink && (
                <a href={doc.signatureLink} target="_blank" rel="noopener noreferrer"
                  style={{ padding: '8px 14px', borderRadius: 8, background: 'rgba(124,58,237,.1)', border: '1px solid rgba(124,58,237,.2)', color: 'var(--accent2)', cursor: 'pointer', fontFamily: 'DM Mono, monospace', fontSize: 13, textDecoration: 'none' }}>
                  🔗 Link Assinatura
                </a>
              )}
              {/* Adicionar botão de "Enviar" se necessário, como na imagem */}
            </div>
          </div>
        ))}
      </div>

      {showDocModal && (
        <div className="modal-overlay">
          <div className="modal-box" style={{ maxWidth: '80vw', width: '90%', height: '90vh' }}>
            <div className="modal-header">
              <h3>Visualizar: {currentDocTitle}</h3>
              <button className="modal-close" onClick={() => setShowDocModal(false)}>✕</button>
            </div>
            <div className="modal-body" style={{ flex: 1, overflowY: 'auto', padding: '20px', background: '#fff', color: '#333' }}>
              {loadingDocContent ? (
                <div style={s.centro}>
                  <div style={s.spinner}></div>
                  <p style={{ marginTop: 15, color: 'var(--muted)' }}>Carregando documento...</p>
                </div>
              ) : (
                <div dangerouslySetInnerHTML={{ __html: currentDocContent }} />
              )}
            </div>
            <div className="modal-footer">
              <button className="btn-cancel" onClick={() => setShowDocModal(false)}>Fechar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ══════════════════════════════════════════════
// ABA CLIENTES
// ══════════════════════════════════════════════
function TabClientes({ cfg, setCfg, empresaId }) {
  const [clients, setClients] = useState(cfg.clients || [])
  const [form, setForm] = useState(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setClients(cfg.clients || [])
  }, [cfg])

  const emptyForm = {
    id: '', nomeFantasia: '', razaoSocial: '', cnpj: '', contatoNome: '',
    email: '', telefone: '', cep: '', endereco: '', bairro: '', cidade: '', estado: '',
    respImplNome: '', respImplEmail: '', respImplTelefone: '',
    respFinNome: '', respFinEmail: '', respFinTelefone: '',
    cpfContatoPrincipal: '', regimeTributario: ''
  }

  function addClient() { setForm({ ...emptyForm, id: Date.now().toString() }) }
  function editClient(client) { setForm({ ...emptyForm, ...client }) }
  function removeClient(id) {
    if (!confirm('Remover cliente?')) return
    setClients(prev => prev.filter(c => c.id !== id))
  }

  async function salvarClient() {
    if (!form.nomeFantasia && !form.razaoSocial) { toast('Nome Fantasia ou Razão Social obrigatórios', 'err'); return }
    setSaving(true)
    let novos
    if (clients.find(c => c.id === form.id)) {
      novos = clients.map(c => c.id === form.id ? form : c)
    } else {
      novos = [...clients, form]
    }
    const novoCfg = { ...cfg, clients: novos }
    const { error } = await salvarStorage(empresaId, novoCfg)
    setSaving(false)
    if (error) { toast('Erro ao salvar', 'err'); return }
    setClients(novos)
    setCfg(novoCfg)
    setForm(null)
    toast('✅ Cliente salvo!')
  }

  return (
    <div style={s.body}>
      <div style={s.sec}>
        <div style={s.secTitle}>🗃️ Clientes Cadastrados</div>
        {clients.length === 0 && <p style={{ color: 'var(--muted)', fontSize: 13, marginBottom: 12 }}>Nenhum cliente cadastrado.</p>}
        {clients.map(c => (
          <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 10, marginBottom: 8 }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600, fontSize: 14 }}>{c.nomeFantasia || c.razaoSocial}</div>
              <div style={{ fontSize: 12, color: 'var(--muted)' }}>
                {c.cnpj || c.cpfContatoPrincipal} · {c.cidade} - {c.estado}
              </div>
            </div>
            <button onClick={() => editClient(c)}
              style={{ padding: '5px 10px', borderRadius: 7, background: 'rgba(0,212,255,.1)', border: '1px solid rgba(0,212,255,.2)', color: 'var(--accent)', cursor: 'pointer', fontFamily: 'DM Mono, monospace', fontSize: 12 }}>
              ✏️ Editar
            </button>
            <button onClick={() => removeClient(c.id)}
              style={{ padding: '5px 10px', borderRadius: 7, background: 'rgba(239,68,68,.1)', border: '1px solid rgba(239,68,68,.2)', color: 'var(--danger)', cursor: 'pointer', fontFamily: 'DM Mono, monospace', fontSize: 12 }}>
              🗑
            </button>
          </div>
        ))}
        <button onClick={addClient}
          style={{ padding: '9px 16px', borderRadius: 8, background: 'rgba(0,212,255,.1)', border: '1px solid rgba(0,212,255,.25)', color: 'var(--accent)', fontFamily: 'DM Mono, monospace', fontSize: 13, cursor: 'pointer', marginTop: 8 }}>
          + Novo Cliente
        </button>

        {form && (
          <div className="modal-overlay">
            <div className="modal-box">
              <div className="modal-header">
                <h3>{form.id.startsWith('novo') ? '➕ Novo Cliente' : '✏️ Editar Cliente'}</h3>
                <button className="modal-close" onClick={() => setForm(null)}>✕</button>
              </div>
              <div className="modal-body">
                <div style={s.row2}>
                  <div style={s.field}><label style={s.label}>Nome Fantasia / Nome</label>
                    <input style={s.input} value={form.nomeFantasia} onChange={e => setForm(f => ({ ...f, nomeFantasia: e.target.value }))} placeholder="Nome Fantasia" />
                  </div>
                  <div style={s.field}><label style={s.label}>Razão Social</label>
                    <input style={s.input} value={form.razaoSocial} onChange={e => setForm(f => ({ ...f, razaoSocial: e.target.value }))} placeholder="Razão Social" />
                  </div>
                </div>
                <div style={s.row2}>
                  <div style={s.field}><label style={s.label}>CPF / CNPJ</label>
                    <input style={s.input} value={form.cnpj} onChange={e => setForm(f => ({ ...f, cnpj: e.target.value }))} placeholder="00.000.000/0000-00" />
                  </div>
                  <div style={s.field}><label style={s.label}>Nome do Contato</label>
                    <input style={s.input} value={form.contatoNome} onChange={e => setForm(f => ({ ...f, contatoNome: e.target.value }))} placeholder="Nome do Contato Principal" />
                  </div>
                </div>
                <div style={s.row2}>
                  <div style={s.field}><label style={s.label}>E-mail</label>
                    <input style={s.input} type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="email@cliente.com" />
                  </div>
                  <div style={s.field}><label style={s.label}>Telefone / WhatsApp</label>
                    <input style={s.input} value={form.telefone} onChange={e => setForm(f => ({ ...f, telefone: e.target.value }))} placeholder="(00) 00000-0000" />
                  </div>
                </div>
                <div style={s.row2}>
                  <div style={s.field}><label style={s.label}>CEP</label>
                    <input style={s.input} value={form.cep} onChange={e => setForm(f => ({ ...f, cep: e.target.value }))} placeholder="00000-000" />
                  </div>
                  <div style={s.field}><label style={s.label}>Endereço</label>
                    <input style={s.input} value={form.endereco} onChange={e => setForm(f => ({ ...f, endereco: e.target.value }))} placeholder="Rua, número" />
                  </div>
                </div>
                <div style={s.row2}>
                  <div style={s.field}><label style={s.label}>Bairro</label>
                    <input style={s.input} value={form.bairro} onChange={e => setForm(f => ({ ...f, bairro: e.target.value }))} placeholder="Bairro" />
                  </div>
                  <div style={s.field}><label style={s.label}>Cidade</label>
                    <input style={s.input} value={form.cidade} onChange={e => setForm(f => ({ ...f, cidade: e.target.value }))} placeholder="Cidade" />
                  </div>
                </div>
                <div style={s.row2}>
                  <div style={s.field}><label style={s.label}>Estado (UF)</label>
                    <input style={s.input} value={form.estado} onChange={e => setForm(f => ({ ...f, estado: e.target.value }))} placeholder="UF" />
                  </div>
                  <div style={s.field}><label style={s.label}>CPF do Contato Principal</label>
                    <input style={s.input} value={form.cpfContatoPrincipal} onChange={e => setForm(f => ({ ...f, cpfContatoPrincipal: e.target.value }))} placeholder="000.000.000-00" />
                  </div>
                </div>
                <div style={s.field}>
                  <label style={s.label}>Regime Tributário</label>
                  <select style={s.input} value={form.regimeTributario} onChange={e => setForm(f => ({ ...f, regimeTributario: e.target.value }))}>
                    <option value="">Selecione...</option>
                    <option value="Simples Nacional">Simples Nacional</option>
                    <option value="Lucro Presumido">Lucro Presumido</option>
                    <option value="Lucro Real">Lucro Real</option>
                    <option value="MEI">MEI</option>
                  </select>
                </div>

                <div style={{ ...s.secTitle, marginTop: 20, marginBottom: 10 }}>👷 Responsável pela Implantação</div>
                <div style={s.row2}>
                  <div style={s.field}><label style={s.label}>Nome</label>
                    <input style={s.input} value={form.respImplNome} onChange={e => setForm(f => ({ ...f, respImplNome: e.target.value }))} placeholder="Nome" />
                  </div>
                  <div style={s.field}><label style={s.label}>E-mail</label>
                    <input style={s.input} type="email" value={form.respImplEmail} onChange={e => setForm(f => ({ ...f, respImplEmail: e.target.value }))} placeholder="email@empresa.com" />
                  </div>
                </div>
                <div style={s.field}><label style={s.label}>Telefone</label>
                  <input style={s.input} value={form.respImplTelefone} onChange={e => setForm(f => ({ ...f, respImplTelefone: e.target.value }))} placeholder="(00) 00000-0000" />
                </div>

                <div style={{ ...s.secTitle, marginTop: 20, marginBottom: 10 }}>💰 Responsável Financeiro</div>
                <div style={s.row2}>
                  <div style={s.field}><label style={s.label}>Nome</label>
                    <input style={s.input} value={form.respFinNome} onChange={e => setForm(f => ({ ...f, respFinNome: e.target.value }))} placeholder="Nome" />
                  </div>
                  <div style={s.field}><label style={s.label}>E-mail</label>
                    <input style={s.input} type="email" value={form.respFinEmail} onChange={e => setForm(f => ({ ...f, respFinEmail: e.target.value }))} placeholder="email@empresa.com" />
                  </div>
                </div>
                <div style={s.field}><label style={s.label}>Telefone</label>
                  <input style={s.input} value={form.respFinTelefone} onChange={e => setForm(f => ({ ...f, respFinTelefone: e.target.value }))} placeholder="(00) 00000-0000" />
                </div>
              </div>
              <div className="modal-footer">
                <button className="btn-cancel" onClick={() => setForm(null)}>Cancelar</button>
                <button className="btn-primary" onClick={salvarClient} disabled={saving}>
                  {saving ? '⏳ Salvando...' : '✅ Salvar Cliente'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════
// ABA TEMA
// ══════════════════════════════════════════════
function TabTema({ cfg, setCfg, empresaId }) {
  const [temaEscuro, setTemaEscuro] = useState(cfg.temaEscuro !== undefined ? cfg.temaEscuro : true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setTemaEscuro(cfg.temaEscuro !== undefined ? cfg.temaEscuro : true)
  }, [cfg])

  async function salvar() {
    setSaving(true)
    const novoCfg = { ...cfg, temaEscuro: temaEscuro }
    const { error } = await salvarStorage(empresaId, novoCfg)
    setSaving(false)
    if (error) { toast('Erro ao salvar', 'err'); return }
    setCfg(novoCfg)
    toast('✅ Tema salvo!')
    // Aplicar o tema imediatamente
    document.documentElement.setAttribute('data-theme', temaEscuro ? 'dark' : 'light')
  }

  useEffect(() => {
    // Aplica o tema inicial ao carregar
    document.documentElement.setAttribute('data-theme', temaEscuro ? 'dark' : 'light')
  }, [temaEscuro])


  return (
    <div style={s.body}>
      <div style={s.sec}>
        <div style={s.secTitle}>APARÊNCIA</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10, padding: '12px 14px', background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 10 }}>
          <label style={{ ...s.label, marginBottom: 0, flex: 1, cursor: 'pointer' }} htmlFor="tema-escuro-toggle">
            🌙 Tema Escuro
            <p style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>
              Fundo escuro com cores vibrantes (padrão).
            </p>
          </label>
          <label className="switch">
            <input type="checkbox" id="tema-escuro-toggle"
              checked={temaEscuro}
              onChange={e => setTemaEscuro(e.target.checked)}
            />
            <span className="slider round"></span>
          </label>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10, padding: '12px 14px', background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 10 }}>
          <label style={{ ...s.label, marginBottom: 0, flex: 1, cursor: 'pointer' }} htmlFor="tema-claro-toggle">
            ☀️ Tema Claro
            <p style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>
              Fundo branco, ideal para ambientes iluminados.
            </p>
          </label>
          <label className="switch">
            <input type="checkbox" id="tema-claro-toggle"
              checked={!temaEscuro}
              onChange={e => setTemaEscuro(!e.target.checked)}
            />
            <span className="slider round"></span>
          </label>
        </div>
      </div>
      <button style={s.saveBtn} onClick={salvar} disabled={saving}>
        {saving ? '⏳ Salvando...' : '✅ Salvar Tema'}
      </button>
    </div>
  )
}


// ══════════════════════════════════════════════
// COMPONENTE PRINCIPAL DE CONFIGURAÇÕES
// ══════════════════════════════════════════════
export default function Configuracoes() {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState('empresa')
  const [cfg, setCfg] = useState(null)
  const [loading, setLoading] = useState(true)
  const [empresaId, setEmpresaId] = useState(null)
  const [user, setUser] = useState(null)

  useEffect(() => {
    async function loadUserAndConfig() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/login')
        return
      }
      setUser(user)
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('company_id')
        .eq('uuid', user.id)
        .single()

      if (profileError || !profile?.company_id) {
        console.error('Erro ao carregar perfil ou company_id não encontrado:', profileError);
        // Tratar caso de empresa não encontrada, talvez redirecionar ou mostrar erro
        setLoading(false);
        return;
      }
      setEmpresaId(profile.company_id)

      const { data, error } = await supabase
        .from('vx_storage')
        .select('value')
        .eq('key', `cfg:${profile.company_id}`)
        .single()

      if (error && error.code !== 'PGRST116') { // PGRST116 = no rows found
        console.error('Erro ao carregar configurações:', error);
        setLoading(false);
        return;
      }

      const initialCfg = data ? JSON.parse(data.value) : {
        company: 'Minha Empresa',
        slogan: 'Assistente Comercial',
        logob64: '',
        goals: [],
        kpiTemplates: [],
        users: [],
        products: MODULOS_PADRAO.map(m => ({ id: m, nome: m, precos: PRECOS_PADRAO[m] || {} })),
        plans: PLANOS_PADRAO,
        discounts: {
          descontoEmTela: false,
          somenteViaVoucher: false,
          percAdesaoTela: 0,
          percMensalidadeTela: 0,
          percAdesaoFechamento: 0,
        },
        vouchers: [],
        docModels: {
          proposta: '',
          contrato: '',
        },
        signatureConfig: {
          emailRemetente: '',
          whatsappEmpresa: '',
          baseUrl: '',
        },
        docHistory: [],
        importedDocs: [], // Inicializa documentos importados
        clients: [],
        temaEscuro: true,
        kpiObrigatorio: false, // Nova configuração
      }
      setCfg(initialCfg)
      setLoading(false)
    }
    loadUserAndConfig()
  }, [router])

  if (loading) {
    return (
      <div style={s.loadingContainer}>
        <div style={s.spinner}></div>
        <p style={{ marginTop: 15, color: 'var(--muted)' }}>Carregando configurações...</p>
      </div>
    )
  }

  if (!cfg || !empresaId) {
    return (
      <div style={s.loadingContainer}>
        <p style={{ color: 'var(--danger)' }}>Erro ao carregar configurações ou ID da empresa. Tente novamente.</p>
      </div>
    )
  }

  const renderTabContent = () => {
    switch (activeTab) {
      case 'empresa':    return <TabEmpresa    cfg={cfg} setCfg={setCfg} empresaId={empresaId} />
      case 'metas':      return <TabMetas      cfg={cfg} setCfg={setCfg} empresaId={empresaId} />
      case 'kpis':       return <TabKpis       cfg={cfg} setCfg={setCfg} empresaId={empresaId} />
      case 'usuarios':   return <TabUsuarios   cfg={cfg} setCfg={setCfg} empresaId={empresaId} />
      case 'produtos':   return <TabProdutos   cfg={cfg} setCfg={setCfg} empresaId={empresaId} />
      case 'descontos':  return <TabDescontos  cfg={cfg} setCfg={setCfg} empresaId={empresaId} />
      case 'vouchers':   return <TabVouchers   cfg={cfg} setCfg={setCfg} empresaId={empresaId} />
      case 'documentos': return <TabDocumentos cfg={cfg} setCfg={setCfg} empresaId={empresaId} />
      case 'historico':  return <TabHistorico  cfg={cfg} setCfg={setCfg} empresaId={empresaId} />
      case 'clientes':   return <TabClientes   cfg={cfg} setCfg={setCfg} empresaId={empresaId} />
      case 'tema':       return <TabTema       cfg={cfg} setCfg={setCfg} empresaId={empresaId} />
      default:           return <TabEmpresa    cfg={cfg} setCfg={setCfg} empresaId={empresaId} />
    }
  }

  return (
    <div style={s.container}>
      <div style={s.sidebar}>
        <div style={s.logoContainer}>
          {cfg.logob64 ? (
            <img src={cfg.logob64} alt="Logo" style={s.logo} />
          ) : (
            <div style={s.appName}>{cfg.company || 'VIVANEXA'}</div>
          )}
          <div style={s.appSlogan}>{cfg.slogan || 'Assistente Comercial'}</div>
        </div>
        <nav style={s.nav}>
          {TABS.map(tab => (
            <button
              key={tab.id}
              style={{ ...s.navItem, ...(activeTab === tab.id ? s.navItemActive : {}) }}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </nav>
        <button onClick={() => router.push('/dashboard')} style={s.backToDash}>
          ← Voltar para o Dashboard
        </button>
      </div>
      <div style={s.mainContent}>
        <div style={s.header}>
          <h1 style={s.title}>⚙️ Configurações</h1>
          <button onClick={() => router.push('/dashboard')} style={s.closeBtn}>✕</button>
        </div>
        <div style={s.contentArea}>
          {renderTabContent()}
        </div>
      </div>
      <div id="vx-toast" style={s.toast}></div>
    </div>
  )
}

// ══════════════════════════════════════════════
// ESTILOS (s)
// ══════════════════════════════════════════════
const s = {
  container: {
    display: 'flex',
    minHeight: '100vh',
    background: 'var(--bg)',
    color: 'var(--text)',
    width: '100%',
  },
  sidebar: {
    width: 260,
    background: 'var(--surface)',
    borderRight: '1px solid var(--border)',
    padding: '20px 0',
    display: 'flex',
    flexDirection: 'column',
    flexShrink: 0,
  },
  logoContainer: {
    padding: '0 20px 20px',
    borderBottom: '1px solid var(--border)',
    marginBottom: 20,
    textAlign: 'center',
  },
  logo: {
    height: 60,
    maxWidth: '100%',
    objectFit: 'contain',
    marginBottom: 8,
  },
  appName: {
    fontFamily: 'Syne, sans-serif',
    fontSize: 22,
    fontWeight: 800,
    color: 'var(--accent)',
  },
  appSlogan: {
    fontSize: 13,
    color: 'var(--muted)',
  },
  nav: {
    flex: 1,
    padding: '0 10px',
  },
  navItem: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    width: '100%',
    padding: '12px 15px',
    borderRadius: 10,
    background: 'transparent',
    border: 'none',
    color: 'var(--muted)',
    fontSize: 14,
    fontFamily: 'DM Mono, monospace',
    textAlign: 'left',
    cursor: 'pointer',
    marginBottom: 5,
    transition: 'all .2s',
  },
  navItemActive: {
    background: 'rgba(0,212,255,.1)',
    color: 'var(--accent)',
    fontWeight: 600,
  },
  backToDash: {
    display: 'block',
    width: 'calc(100% - 20px)',
    margin: '20px 10px 0',
    padding: '12px 15px',
    borderRadius: 10,
    background: 'var(--surface2)',
    border: '1px solid var(--border)',
    color: 'var(--muted)',
    fontSize: 13,
    fontFamily: 'DM Mono, monospace',
    cursor: 'pointer',
    textAlign: 'center',
    transition: 'all .2s',
  },
  mainContent: {
    flex: 1,
    padding: '20px 30px',
    overflowY: 'auto',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 25,
  },
  title: {
    fontFamily: 'Syne, sans-serif',
    fontSize: 28,
    fontWeight: 700,
    color: 'var(--text)',
  },
  closeBtn: {
    background: 'none',
    border: 'none',
    color: 'var(--muted)',
    fontSize: 24,
    cursor: 'pointer',
  },
  contentArea: {
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    borderRadius: 16,
    padding: '25px 30px',
    boxShadow: 'var(--shadow)',
  },
  body: {
    maxWidth: 800,
    margin: '0 auto',
  },
  sec: {
    marginBottom: 30,
    paddingBottom: 20,
    borderBottom: '1px solid var(--border)',
  },
  secTitle: {
    fontFamily: 'Syne, sans-serif',
    fontSize: 18,
    fontWeight: 700,
    color: 'var(--accent)',
    marginBottom: 15,
  },
  field: {
    marginBottom: 15,
  },
  label: {
    display: 'block',
    fontSize: 12,
    color: 'var(--muted)',
    marginBottom: 6,
    letterSpacing: '.5px',
    textTransform: 'uppercase',
  },
  input: {
    width: '100%',
    padding: '10px 14px',
    borderRadius: 8,
    border: '1px solid var(--border)',
    background: 'var(--surface2)',
    color: 'var(--text)',
    fontSize: 14,
    fontFamily: 'DM Mono, monospace',
    outline: 'none',
    transition: 'border-color .2s',
  },
  row2: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: 15,
  },
  saveBtn: {
    display: 'block',
    width: '100%',
    padding: '12px 20px',
    borderRadius: 10,
    background: 'linear-gradient(135deg,var(--accent3),#059669)',
    border: 'none',
    color: '#fff',
    fontFamily: 'DM Mono, monospace',
    fontSize: 15,
    fontWeight: 700,
    cursor: 'pointer',
    letterSpacing: .5,
    transition: 'all .2s',
  },
  toast: {
    position: 'fixed',
    bottom: 20,
    right: 20,
    background: 'rgba(16,185,129,.9)',
    color: '#fff',
    padding: '12px 20px',
    borderRadius: 10,
    fontSize: 14,
    fontFamily: 'DM Mono, monospace',
    opacity: 0,
    transform: 'translateY(20px)',
    transition: 'all .3s ease-out',
    zIndex: 1000,
  },
  loadingContainer: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '100vh',
    width: '100%',
    background: 'var(--bg)',
    color: 'var(--text)',
  },
  spinner: {
    width: 40,
    height: 40,
    border: '3px solid var(--border)',
    borderTop: '3px solid var(--accent)',
    borderRadius: '50%',
    animation: 'spin 1s linear infinite',
  },
  // Estilos para o switch toggle
  switch: {
    position: 'relative',
    display: 'inline-block',
    width: 44,
    height: 24,
  },
  'switch input': {
    opacity: 0,
    width: 0,
    height: 0,
  },
  slider: {
    position: 'absolute',
    cursor: 'pointer',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'var(--border)',
    transition: '.4s',
    borderRadius: 24,
  },
  'slider:before': {
    position: 'absolute',
    content: '""',
    height: 16,
    width: 16,
    left: 4,
    bottom: 4,
    backgroundColor: 'white',
    transition: '.4s',
    borderRadius: '50%',
  },
  'input:checked + .slider': {
    backgroundColor: 'var(--accent3)',
  },
  'input:focus + .slider': {
    boxShadow: '0 0 1px var(--accent3)',
  },
  'input:checked + .slider:before': {
    transform: 'translateX(20px)',
  },
}
