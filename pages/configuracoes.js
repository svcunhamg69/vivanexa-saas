// pages/configuracoes.js
// ============================================================
// MELHORIAS APLICADAS:
// 1. Logo: carrega e exibe corretamente após salvar
// 2. Produtos: planos completos (Basic/Pro/Top/Top Plus) com
//    CNPJs, usuários e tabela de preços por módulo
// 3. Usuários: permissões granulares + perfis personalizados
// 4. Vouchers: botão imprimir PDF estilizado
// 5. KPIs: seletor de ícone com galeria de opções
// 6. Documentos: Nova aba para upload e gestão de documentos importados
// 7. Histórico: Melhoria na aba para visualizar documentos gerados e assinados
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
  // CORREÇÃO: lê logob64 do cfg a cada render (não só no mount)
  const [logoB64,  setLogoB64]  = useState(cfg.logob64  || '')
  const [saving,   setSaving]   = useState(false)

  // Sincroniza quando cfg mudar (após salvar em outra aba)
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
    // Força recarregar a logo do storage para confirmar que persistiu
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

        {/* CORREÇÃO: preview sempre atualizado + botão remover */}
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
// ABA KPIs — COM GALERIA DE ÍCONES
// ══════════════════════════════════════════════
function TabKpis({ cfg, setCfg, empresaId }) {
  const [kpis,        setKpis]        = useState(cfg.kpiTemplates || [])
  const [saving,      setSaving]      = useState(false)
  const [iconPickerId, setIconPickerId] = useState(null) // qual KPI está com seletor aberto

  function addKpi() {
    setKpis(prev => [...prev, { id: Date.now(), nome: '', icone: '📊', meta: 0, unidade: 'un', cor: '#00d4ff' }])
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
    const novoCfg = { ...cfg, kpiTemplates: kpis }
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
              {/* Botão do ícone com galeria */}
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

            {/* Galeria de ícones */}
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

  // Quando muda o perfil no form, aplica as permissões do perfil
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
      {/* Sub-abas */}
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

      {/* ── LISTA DE USUÁRIOS ── */}
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

          {/* Formulário do usuário */}
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

              {/* Permissões individuais */}
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

      {/* ── TIPOS DE PERFIL ── */}
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
                    </div >
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
  const [planos,  setPlanos]  = useState(cfg.plans   || PLANOS_PADRAO)
  const [precos,  setPrecos]  = useState(cfg.prices  || PRECOS_PADRAO)
  const [modulos, setModulos] = useState(cfg.modulos || MODULOS_PADRAO)
  const [saving,  setSaving]  = useState(false)
  const [abaP,    setAbaP]    = useState('planos') // 'planos' | 'precos' | 'modulos'
  const [novoMod, setNovoMod] = useState('')

  // ── Planos ──
  function updatePlano(id, campo, val) {
    setPlanos(prev => prev.map(p => p.id === id ? { ...p, [campo]: val } : p))
  }
  function addPlano() {
    setPlanos(prev => [...prev, { id: 'plano_' + Date.now(), nome: '', maxCnpjs: 0, usuarios: 1 }])
  }
  function removePlano(id) {
    if (!confirm('Remover plano?')) return
    setPlanos(prev => prev.filter(p => p.id !== id))
  }

  // ── Preços ──
  function updatePreco(mod, planId, idx, val) {
    setPrecos(prev => {
      const novo = { ...prev }
      if (!novo[mod]) novo[mod] = {}
      const arr = [...(novo[mod][planId] || [0, 0])]
      arr[idx] = Number(val) || 0
      novo[mod] = { ...novo[mod], [planId]: arr }
      return novo
    })
  }

  // ── Módulos ──
  function addModulo() {
    const m = novoMod.trim()
    if (!m || modulos.includes(m)) return
    setModulos(prev => [...prev, m])
    setNovoMod('')
    setPrecos(prev => ({ ...prev, [m]: {} }))
  }
  function removeModulo(m) {
    if (!confirm(`Remover módulo "${m}"?`)) return
    setModulos(prev => prev.filter(x => x !== m))
    setPrecos(prev => { const n = { ...prev }; delete n[m]; return n })
  }

  async function salvar() {
    setSaving(true)
    const novoCfg = { ...cfg, plans: planos, prices: precos, modulos }
    const { error } = await salvarStorage(empresaId, novoCfg)
    setSaving(false)
    if (error) { toast('Erro ao salvar', 'err'); return }
    setCfg(novoCfg)
    toast('✅ Produtos salvos!')
  }

  return (
    <div style={s.body}>
      {/* Sub-abas */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 20 }}>
        {[['planos','📋 Planos'],['precos','💲 Tabela de Preços'],['modulos','📦 Módulos']].map(([id, label]) => (
          <button key={id} onClick={() => setAbaP(id)}
            style={{ padding: '8px 16px', borderRadius: 9, fontFamily: 'DM Mono, monospace', fontSize: 12, cursor: 'pointer',
              background: abaP === id ? 'rgba(0,212,255,.12)' : 'var(--surface2)',
              border: `1px solid ${abaP === id ? 'rgba(0,212,255,.35)' : 'var(--border)'}`,
              color: abaP === id ? 'var(--accent)' : 'var(--muted)', fontWeight: abaP === id ? 600 : 400 }}>
            {label}
          </button>
        ))}
      </div>

      {/* ── PLANOS ── */}
      {abaP === 'planos' && (
        <div style={s.sec}>
          <div style={s.secTitle}>Planos Disponíveis</div>
          <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 14, lineHeight: 1.6 }}>
            Configure os planos, quantidade máxima de CNPJs e usuários permitidos em cada um.
          </p>

          {/* Tabela de planos */}
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: 'var(--surface2)', borderBottom: '1px solid var(--border)' }}>
                  {['Plano','Máx. CNPJs','Usuários',''].map(h => (
                    <th key={h} style={{ padding: '10px 12px', textAlign: 'left', fontSize: 10, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: 1, fontWeight: 600 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {planos.map(p => (
                  <tr key={p.id} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '8px 12px' }}>
                      <input style={{ ...s.input, fontWeight: 700, color: 'var(--accent)' }} value={p.nome}
                        onChange={e => updatePlano(p.id, 'nome', e.target.value)} placeholder="Nome do plano" />
                    </td>
                    <td style={{ padding: '8px 12px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <input type="number" style={{ ...s.input, width: 90 }} value={p.maxCnpjs}
                          onChange={e => updatePlano(p.id, 'maxCnpjs', Number(e.target.value))} />
                        {p.maxCnpjs >= 999 && <span style={{ fontSize: 11, color: 'var(--accent)', fontWeight: 600, whiteSpace: 'nowrap' }}>∞ Ilimitado</span>}
                      </div>
                    </td>
                    <td style={{ padding: '8px 12px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <input type="number" style={{ ...s.input, width: 90 }} value={p.usuarios}
                          onChange={e => updatePlano(p.id, 'usuarios', Number(e.target.value))} />
                        {p.usuarios >= 999 && <span style={{ fontSize: 11, color: 'var(--accent)', fontWeight: 600, whiteSpace: 'nowrap' }}>∞ Ilimitado</span>}
                      </div>
                    </td>
                    <td style={{ padding: '8px 12px' }}>
                      <button onClick={() => removePlano(p.id)}
                        style={{ padding: '6px 10px', borderRadius: 7, background: 'rgba(239,68,68,.1)', border: '1px solid rgba(239,68,68,.3)', color: 'var(--danger)', cursor: 'pointer' }}>
                        🗑
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <button onClick={addPlano}
            style={{ padding: '9px 16px', borderRadius: 8, background: 'rgba(0,212,255,.1)', border: '1px solid rgba(0,212,255,.25)', color: 'var(--accent)', fontFamily: 'DM Mono, monospace', fontSize: 13, cursor: 'pointer', marginTop: 12 }}>
            + Novo Plano
          </button>
          <div style={{ marginTop: 12, fontSize: 12, color: 'var(--muted)', lineHeight: 1.7 }}>
            💡 Dica: use 999 em CNPJs ou Usuários para indicar "Ilimitado"
          </div>
        </div>
      )}

      {/* ── TABELA DE PREÇOS ── */}
      {abaP === 'precos' && (
        <div style={s.sec}>
          <div style={s.secTitle}>Tabela de Preços por Módulo e Plano</div>
          <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 14, lineHeight: 1.6 }}>
            Preencha os valores de <strong style={{ color: 'var(--text)' }}>Adesão</strong> e <strong style={{ color: 'var(--text)' }}>Mensalidade</strong> para cada combinação de módulo e plano.
          </p>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ background: 'var(--surface2)', borderBottom: '2px solid var(--border)' }}>
                  <th style={{ padding: '10px 12px', textAlign: 'left', fontSize: 10, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: 1, minWidth: 120 }}>Módulo</th>
                  {planos.map(p => (
                    <th key={p.id} colSpan={2} style={{ padding: '10px 12px', textAlign: 'center', color: 'var(--accent)', fontWeight: 700, borderLeft: '1px solid var(--border)', fontSize: 12 }}>
                      {p.nome}
                      <div style={{ fontSize: 10, color: 'var(--muted)', fontWeight: 400, marginTop: 2 }}>
                        {p.maxCnpjs >= 999 ? '∞ CNPJs' : `até ${p.maxCnpjs} CNPJs`} · {p.usuarios >= 999 ? '∞ usuários' : `${p.usuarios} user${p.usuarios > 1 ? 's' : ''}`}
                      </div>
                    </th>
                  ))}
                </tr>
                <tr style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border)' }}>
                  <th style={{ padding: '8px 12px', textAlign: 'left' }}></th>
                  {planos.map(p => (
                    <>
                      <th key={`${p.id}-adesao`} style={{ padding: '8px 6px', textAlign: 'center', fontSize: 10, color: 'var(--muted)', borderLeft: '1px solid var(--border)' }}>Adesão</th>
                      <th key={`${p.id}-mensalidade`} style={{ padding: '8px 6px', textAlign: 'center', fontSize: 10, color: 'var(--muted)' }}>Mensal.</th>
                    </>
                  ))}
                </tr>
              </thead>
              <tbody>
                {modulos.map(mod => (
                  <tr key={mod} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '8px 12px', fontWeight: 600, color: 'var(--text)' }}>{mod}</td>
                    {planos.map(p => (
                      <>
                        <td key={`${mod}-${p.id}-adesao`} style={{ padding: '4px 6px', borderLeft: '1px solid var(--border)' }}>
                          <input type="number" style={{ ...s.input, width: '100%', padding: '6px 8px', textAlign: 'center' }}
                            value={precos[mod]?.[p.id]?.[0] || 0}
                            onChange={e => updatePreco(mod, p.id, 0, e.target.value)} />
                        </td>
                        <td key={`${mod}-${p.id}-mensalidade`} style={{ padding: '4px 6px' }}>
                          <input type="number" style={{ ...s.input, width: '100%', padding: '6px 8px', textAlign: 'center' }}
                            value={precos[mod]?.[p.id]?.[1] || 0}
                            onChange={e => updatePreco(mod, p.id, 1, e.target.value)} />
                        </td>
                      </>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── MÓDULOS ── */}
      {abaP === 'modulos' && (
        <div style={s.sec}>
          <div style={s.secTitle}>Módulos de Software</div>
          <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 14, lineHeight: 1.6 }}>
            Gerencie os módulos que compõem sua oferta de produtos.
          </p>

          <div style={{ marginBottom: 16 }}>
            <label style={s.label}>Adicionar novo módulo</label>
            <div style={{ display: 'flex', gap: 8 }}>
              <input style={{ ...s.input, flex: 1 }} value={novoMod} onChange={e => setNovoMod(e.target.value)} placeholder="Nome do módulo (ex: CRM)" />
              <button onClick={addModulo}
                style={{ padding: '9px 16px', borderRadius: 8, background: 'rgba(0,212,255,.1)', border: '1px solid rgba(0,212,255,.25)', color: 'var(--accent)', fontFamily: 'DM Mono, monospace', fontSize: 13, cursor: 'pointer', fontWeight: 600 }}>
                Adicionar
              </button>
            </div>
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {modulos.map(m => (
              <div key={m} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 8 }}>
                <span style={{ fontWeight: 600, fontSize: 13 }}>{m}</span>
                <button onClick={() => removeModulo(m)}
                  style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', fontSize: 14 }}>
                  ✕
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <button style={s.saveBtn} onClick={salvar} disabled={saving}>
        {saving ? '⏳ Salvando...' : '✅ Salvar Produtos'}
      </button>
    </div>
  )
}

// ══════════════════════════════════════════════
// ABA DESCONTOS
// ══════════════════════════════════════════════
function TabDescontos({ cfg, setCfg, empresaId }) {
  const [discAdPct,  setDiscAdPct]  = useState(cfg.discAdPct  || 50)
  const [discMenPct, setDiscMenPct] = useState(cfg.discMenPct || 0)
  const [discClosePct, setDiscClosePct] = useState(cfg.discClosePct || 40)
  const [saving,     setSaving]     = useState(false)

  useEffect(() => {
    setDiscAdPct(cfg.discAdPct || 50)
    setDiscMenPct(cfg.discMenPct || 0)
    setDiscClosePct(cfg.discClosePct || 40)
  }, [cfg])

  async function salvar() {
    setSaving(true)
    const novoCfg = { ...cfg, discAdPct, discMenPct, discClosePct }
    const { error } = await salvarStorage(empresaId, novoCfg)
    setSaving(false)
    if (error) { toast('Erro ao salvar', 'err'); return }
    setCfg(novoCfg)
    toast('✅ Descontos salvos!')
  }

  return (
    <div style={s.body}>
      <div style={s.sec}>
        <div style={s.secTitle}>Configurações de Desconto Padrão</div>
        <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 16, lineHeight: 1.6 }}>
          Defina os percentuais de desconto padrão aplicados nas propostas e contratos.
        </p>

        <div style={s.field}>
          <label style={s.label}>Desconto Padrão na Adesão (%)</label>
          <input type="number" style={s.input} value={discAdPct} onChange={e => setDiscAdPct(Number(e.target.value))} placeholder="50" min="0" max="100" />
        </div>
        <div style={s.field}>
          <label style={s.label}>Desconto Padrão na Mensalidade (%)</label>
          <input type="number" style={s.input} value={discMenPct} onChange={e => setDiscMenPct(Number(e.target.value))} placeholder="0" min="0" max="100" />
        </div>
        <div style={s.field}>
          <label style={s.label}>Desconto de Fechamento na Adesão (%)</label>
          <input type="number" style={s.input} value={discClosePct} onChange={e => setDiscClosePct(Number(e.target.value))} placeholder="40" min="0" max="100" />
          <p style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>
            Este desconto é aplicado na adesão para a "Oferta de Fechamento".
          </p>
        </div>
      </div>
      <button style={s.saveBtn} onClick={salvar} disabled={saving}>
        {saving ? '⏳ Salvando...' : '✅ Salvar Descontos'}
      </button>
    </div>
  )
}

// ══════════════════════════════════════════════
// ABA VOUCHERS — COM BOTÃO IMPRIMIR PDF
// ══════════════════════════════════════════════
function TabVouchers({ cfg, setCfg, empresaId }) {
  const [vouchers, setVouchers] = useState(cfg.vouchers || [])
  const [form, setForm] = useState(null)
  const [saving, setSaving] = useState(false)

  const emptyForm = { id: '', codigo: '', tipo: 'percent', valor: 0, validade: '', usado: false, cliente: '', dataUso: '' }

  function addVoucher() {
    setForm({ ...emptyForm, id: Date.now().toString(), codigo: 'VIVANEXA' + Math.random().toString(36).substring(2, 8).toUpperCase() })
  }

  function editVoucher(v) { setForm({ ...v }) }

  function removeVoucher(id) {
    if (!confirm('Remover voucher?')) return
    setVouchers(prev => prev.filter(v => v.id !== id))
  }

  async function salvarVoucher() {
    if (!form.codigo || !form.valor || !form.validade) { toast('Preencha todos os campos obrigatórios', 'err'); return }
    setSaving(true)
    let novos
    if (vouchers.find(v => v.id === form.id)) {
      novos = vouchers.map(v => v.id === form.id ? form : v)
    } else {
      novos = [...vouchers, form]
    }
    const novoCfg = { ...cfg, vouchers: novos }
    const { error } = await salvarStorage(empresaId, novoCfg)
    setSaving(false)
    if (error) { toast('Erro ao salvar', 'err'); return }
    setVouchers(novos)
    setCfg(novoCfg)
    setForm(null)
    toast('✅ Voucher salvo!')
  }

  function imprimirVoucher(voucher) {
    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
      <html>
      <head>
        <title>Voucher ${voucher.codigo}</title>
        <style>
          body { font-family: 'Inter', sans-serif; margin: 0; padding: 40px; background: #f0f2f5; color: #333; }
          .voucher-card {
            width: 100%; max-width: 500px; margin: 0 auto; padding: 30px;
            background: linear-gradient(135deg, #00d4ff, #0099bb);
            border-radius: 15px; box-shadow: 0 10px 30px rgba(0,0,0,0.2);
            color: #fff; text-align: center; position: relative; overflow: hidden;
          }
          .voucher-card::before {
            content: ''; position: absolute; top: -50px; left: -50px;
            width: 150px; height: 150px; background: rgba(255,255,255,0.1);
            border-radius: 50%; transform: rotate(45deg);
          }
          .voucher-card::after {
            content: ''; position: absolute; bottom: -50px; right: -50px;
            width: 150px; height: 150px; background: rgba(255,255,255,0.1);
            border-radius: 50%; transform: rotate(45deg);
          }
          h1 { font-size: 36px; margin-bottom: 10px; font-weight: 800; }
          h2 { font-size: 24px; margin-bottom: 20px; font-weight: 600; }
          .code {
            font-family: 'DM Mono', monospace; font-size: 48px; font-weight: 700;
            background: rgba(255,255,255,0.2); padding: 15px 25px; border-radius: 10px;
            margin-bottom: 25px; display: inline-block; letter-spacing: 2px;
          }
          .details p { font-size: 16px; margin-bottom: 8px; }
          .validity { font-size: 14px; opacity: 0.8; margin-top: 20px; }
          @media print {
            body { background: #fff; padding: 0; }
            .voucher-card { box-shadow: none; border: 1px solid #eee; }
          }
        </style>
      </head>
      <body>
        <div class="voucher-card">
          <h1>VOUCHER DE DESCONTO</h1>
          <h2>${voucher.tipo === 'percent' ? `${voucher.valor}% de Desconto` : `R$ ${voucher.valor.toLocaleString('pt-BR')} de Desconto`}</h2>
          <div class="code">${voucher.codigo}</div>
          <div class="details">
            <p>Válido para: ${voucher.cliente || 'Qualquer cliente'}</p>
            <p>Status: ${voucher.usado ? `Usado em ${voucher.dataUso}` : 'Disponível'}</p>
          </div>
          <p class="validity">Válido até: ${voucher.validade}</p>
        </div>
      </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.print();
  }

  return (
    <div style={s.body}>
      <div style={s.sec}>
        <div style={s.secTitle}>Vouchers de Desconto</div>
        <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 14, lineHeight: 1.6 }}>
          Crie e gerencie vouchers de desconto para seus clientes.
        </p>

        {vouchers.length === 0 && <p style={{ color: 'var(--muted)', fontSize: 13, marginBottom: 12 }}>Nenhum voucher cadastrado.</p>}
        {vouchers.map(v => (
          <div key={v.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 10, marginBottom: 8 }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600, fontSize: 14 }}>{v.codigo}</div>
              <div style={{ fontSize: 12, color: 'var(--muted)' }}>
                {v.tipo === 'percent' ? `${v.valor}% de Desconto` : `R$ ${v.valor.toLocaleString('pt-BR')}`} · Válido até: {v.validade}
              </div>
              {v.usado && (
                <div style={{ fontSize: 11, color: 'var(--accent3)', marginTop: 3 }}>
                  Usado por {v.cliente} em {v.dataUso}
                </div>
              )}
            </div>
            <button onClick={() => imprimirVoucher(v)}
              style={{ padding: '5px 10px', borderRadius: 7, background: 'rgba(16,185,129,.1)', border: '1px solid rgba(16,185,129,.2)', color: 'var(--accent3)', cursor: 'pointer', fontFamily: 'DM Mono, monospace', fontSize: 12 }}>
              🖨 Imprimir
            </button>
            <button onClick={() => editVoucher(v)}
              style={{ padding: '5px 10px', borderRadius: 7, background: 'rgba(0,212,255,.1)', border: '1px solid rgba(0,212,255,.2)', color: 'var(--accent)', cursor: 'pointer', fontFamily: 'DM Mono, monospace', fontSize: 12 }}>
              ✏️ Editar
            </button>
            <button onClick={() => removeVoucher(v.id)}
              style={{ padding: '5px 10px', borderRadius: 7, background: 'rgba(239,68,68,.1)', border: '1px solid rgba(239,68,68,.2)', color: 'var(--danger)', cursor: 'pointer', fontFamily: 'DM Mono, monospace', fontSize: 12 }}>
              🗑
            </button>
          </div>
        ))}
        <button onClick={addVoucher}
          style={{ padding: '9px 16px', borderRadius: 8, background: 'rgba(0,212,255,.1)', border: '1px solid rgba(0,212,255,.25)', color: 'var(--accent)', fontFamily: 'DM Mono, monospace', fontSize: 13, cursor: 'pointer', marginTop: 8 }}>
          + Novo Voucher
        </button>

        {form && (
          <div style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 12, padding: 18, marginTop: 16 }}>
            <div style={{ ...s.secTitle, marginBottom: 14 }}>
              {form.id ? '✏️ Editar Voucher' : '➕ Novo Voucher'}
            </div>
            <div style={s.field}>
              <label style={s.label}>Código do Voucher</label>
              <input style={s.input} value={form.codigo} onChange={e => setForm(f => ({ ...f, codigo: e.target.value }))} placeholder="VIVANEXA123" />
            </div>
            <div style={s.row2}>
              <div style={s.field}>
                <label style={s.label}>Tipo de Desconto</label>
                <select style={s.input} value={form.tipo} onChange={e => setForm(f => ({ ...f, tipo: e.target.value }))}>
                  <option value="percent">Percentual (%)</option>
                  <option value="fixed">Valor Fixo (R$)</option>
                </select>
              </div>
              <div style={s.field}>
                <label style={s.label}>Valor</label>
                <input type="number" style={s.input} value={form.valor} onChange={e => setForm(f => ({ ...f, valor: Number(e.target.value) }))} placeholder="50" />
              </div>
            </div>
            <div style={s.field}>
              <label style={s.label}>Validade (até)</label>
              <input type="date" style={s.input} value={form.validade} onChange={e => setForm(f => ({ ...f, validade: e.target.value }))} />
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
              <button style={s.saveBtn} onClick={salvarVoucher} disabled={saving}>
                {saving ? '⏳...' : '✅ Salvar Voucher'}
              </button>
              <button onClick={() => setForm(null)}
                style={{ padding: '11px 18px', borderRadius: 10, background: 'rgba(100,116,139,.12)', border: '1px solid rgba(100,116,139,.3)', color: 'var(--muted)', fontFamily: 'DM Mono, monospace', fontSize: 13, cursor: 'pointer' }}>
                Cancelar
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════
// NOVA ABA: DOCUMENTOS (Importados)
// ══════════════════════════════════════════════
function TabDocumentos({ cfg, setCfg, empresaId }) {
  const [docsImportados, setDocsImportados] = useState(cfg.importedDocs || [])
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef(null)

  useEffect(() => {
    setDocsImportados(cfg.importedDocs || [])
  }, [cfg.importedDocs])

  async function handleFileUpload(e) {
    const file = e.target.files[0]
    if (!file) return

    if (file.size > 5 * 1024 * 1024) { // 5MB limit
      toast('Arquivo muito grande (máx 5MB)', 'err');
      return;
    }

    const fileType = file.type.startsWith('application/pdf') ? 'pdf' : (file.type.startsWith('text/html') ? 'html' : null);
    if (!fileType) {
      toast('Formato de arquivo não suportado. Use PDF ou HTML.', 'err');
      return;
    }

    setUploading(true)
    const fileName = `${Date.now()}-${file.name}`
    const filePath = `${empresaId}/imported_docs/${fileName}`

    try {
      const { data, error } = await supabase.storage
        .from('vx_storage') // Usar o mesmo bucket 'vx_storage'
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false,
          contentType: file.type,
        })

      if (error) throw error

      const { data: publicUrlData } = supabase.storage
        .from('vx_storage')
        .getPublicUrl(filePath)

      if (!publicUrlData.publicUrl) throw new Error('Não foi possível obter a URL pública.')

      const newDoc = {
        id: Date.now().toString(),
        name: file.name,
        type: fileType,
        url: publicUrlData.publicUrl,
        uploadedAt: new Date().toISOString(),
        uploadedBy: 'admin', // Ou o ID do usuário logado
      }

      const updatedDocs = [...docsImportados, newDoc]
      const novoCfg = { ...cfg, importedDocs: updatedDocs }
      const { error: saveError } = await salvarStorage(empresaId, novoCfg)

      if (saveError) throw saveError

      setCfg(novoCfg)
      setDocsImportados(updatedDocs)
      toast('✅ Documento importado com sucesso!')
    } catch (error) {
      console.error('Erro ao fazer upload ou salvar documento:', error)
      toast('Erro ao importar documento: ' + error.message, 'err')
    } finally {
      setUploading(false)
      if (fileInputRef.current) {
        fileInputRef.current.value = '' // Limpa o input file
      }
    }
  }

  async function removeDocument(id) {
    if (!confirm('Tem certeza que deseja remover este documento? Esta ação é irreversível.')) return

    setSaving(true)
    try {
      const docToRemove = docsImportados.find(d => d.id === id)
      if (!docToRemove) throw new Error('Documento não encontrado.')

      // Remove do Supabase Storage
      const pathSegments = docToRemove.url.split('/')
      const fileNameInStorage = pathSegments[pathSegments.length - 1]
      const folderPath = `${empresaId}/imported_docs/`
      const { error: storageError } = await supabase.storage
        .from('vx_storage')
        .remove([folderPath + fileNameInStorage])

      if (storageError && storageError.statusCode !== '404') { // Ignorar 404 se o arquivo já não existir
        console.warn('Erro ao remover do storage (pode já ter sido removido):', storageError.message)
      }

      // Remove da configuração da empresa
      const updatedDocs = docsImportados.filter(d => d.id !== id)
      const novoCfg = { ...cfg, importedDocs: updatedDocs }
      const { error: saveError } = await salvarStorage(empresaId, novoCfg)

      if (saveError) throw saveError

      setCfg(novoCfg)
      setDocsImportados(updatedDocs)
      toast('🗑 Documento removido com sucesso!')
    } catch (error) {
      console.error('Erro ao remover documento:', error)
      toast('Erro ao remover documento: ' + error.message, 'err')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={s.body}>
      <div style={s.sec}>
        <div style={s.secTitle}>📄 Documentos Importados</div>
        <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 14, lineHeight: 1.6 }}>
          Faça upload de documentos (PDF ou HTML) para usar na plataforma.
        </p>

        <div style={s.field}>
          <label style={s.label}>Upload de Documento (PDF ou HTML, máx 5MB)</label>
          <input
            type="file"
            accept=".pdf,.html"
            onChange={handleFileUpload}
            ref={fileInputRef}
            style={{ ...s.input, padding: '6px' }}
            disabled={uploading}
          />
          {uploading && <p style={{ fontSize: 12, color: 'var(--accent)', marginTop: 8 }}>⏳ Enviando documento...</p>}
        </div>

        {docsImportados.length === 0 && !uploading && (
          <p style={{ color: 'var(--muted)', fontSize: 13, marginTop: 20 }}>Nenhum documento importado ainda.</p>
        )}

        <div style={{ marginTop: 20 }}>
          {docsImportados.map(doc => (
            <div key={doc.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 10, marginBottom: 8 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: 14 }}>{doc.name}</div>
                <div style={{ fontSize: 12, color: 'var(--muted)' }}>
                  {doc.type.toUpperCase()} · Importado em {new Date(doc.uploadedAt).toLocaleDateString('pt-BR')}
                </div>
              </div>
              <a href={doc.url} target="_blank" rel="noopener noreferrer"
                style={{ padding: '5px 10px', borderRadius: 7, background: 'rgba(0,212,255,.1)', border: '1px solid rgba(0,212,255,.2)', color: 'var(--accent)', cursor: 'pointer', fontFamily: 'DM Mono, monospace', fontSize: 12, textDecoration: 'none' }}>
                👁 Ver
              </a>
              <button onClick={() => removeDocument(doc.id)} disabled={saving}
                style={{ padding: '5px 10px', borderRadius: 7, background: 'rgba(239,68,68,.1)', border: '1px solid rgba(239,68,68,.2)', color: 'var(--danger)', cursor: 'pointer', fontFamily: 'DM Mono, monospace', fontSize: 12 }}>
                🗑
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════
// ABA HISTÓRICO (Documentos Gerados e Assinados)
// ══════════════════════════════════════════════
function TabHistorico({ cfg, setCfg, empresaId }) {
  const [docHistory, setDocHistory] = useState(cfg.docHistory || [])
  const [loading, setLoading] = useState(true)
  const [selectedDoc, setSelectedDoc] = useState(null) // Para modal de visualização

  useEffect(() => {
    // Ordena os documentos do mais recente para o mais antigo
    const sortedHistory = [...(cfg.docHistory || [])].sort((a, b) => new Date(b.generatedAt) - new Date(a.generatedAt))
    setDocHistory(sortedHistory)
    setLoading(false)
  }, [cfg.docHistory])

  // Função para buscar o HTML completo do documento (se não estiver no docHistory)
  async function fetchFullDocument(token) {
    setLoading(true)
    try {
      const { data: docRow, error } = await supabase
        .from('vx_storage')
        .select('value')
        .eq('key', `doc:${token}`)
        .single()

      if (error) throw error
      if (!docRow?.value) throw new Error('Documento não encontrado no storage.')

      const docData = JSON.parse(docRow.value)
      setSelectedDoc(docData)
    } catch (e) {
      console.error('Erro ao carregar documento completo:', e)
      toast('Erro ao carregar documento. Tente novamente.', 'err')
      setSelectedDoc(null)
    } finally {
      setLoading(false)
    }
  }

  function getStatusLabel(doc) {
    if (doc.status === 'signed') return '✅ Assinado'
    if (doc.status === 'pending') return '✍️ Aguardando Assinatura'
    return '⏳ Gerado'
  }

  function getStatusColor(doc) {
    if (doc.status === 'signed') return 'var(--accent3)'
    if (doc.status === 'pending') return 'var(--warning)'
    return 'var(--muted)'
  }

  return (
    <div style={s.body}>
      <div style={s.sec}>
        <div style={s.secTitle}>🗂️ Histórico de Documentos</div>
        <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 14, lineHeight: 1.6 }}>
          Visualize todas as propostas e contratos gerados e seus status de assinatura.
        </p>

        {loading && (
          <div style={s.centro}>
            <div style={s.spinner} />
            <p style={{ color: 'var(--muted)', fontSize: 14, marginTop: 20 }}>Carregando histórico...</p>
          </div>
        )}

        {!loading && docHistory.length === 0 && (
          <p style={{ color: 'var(--muted)', fontSize: 13, marginTop: 20 }}>Nenhum documento gerado ainda.</p>
        )}

        {!loading && docHistory.length > 0 && (
          <div style={{ marginTop: 20 }}>
            {docHistory.map(doc => (
              <div key={doc.signToken} style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 10, padding: '12px 14px', marginBottom: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, fontSize: 14 }}>
                      {doc.type === 'proposta' ? 'Proposta Comercial' : 'Contrato'} para {doc.clientName}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>
                      Gerado em {new Date(doc.generatedAt).toLocaleDateString('pt-BR')}
                      {doc.signedBy && ` por ${doc.signedBy}`}
                    </div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: getStatusColor(doc), marginTop: 4 }}>
                      {getStatusLabel(doc)}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                    <button onClick={() => fetchFullDocument(doc.signToken)}
                      style={{ padding: '6px 12px', borderRadius: 8, background: 'rgba(0,212,255,.1)', border: '1px solid rgba(0,212,255,.2)', color: 'var(--accent)', cursor: 'pointer', fontFamily: 'DM Mono, monospace', fontSize: 12 }}>
                      👁 Ver Documento
                    </button>
                    {doc.signToken && (
                      <a href={`/sign/${doc.signToken}`} target="_blank" rel="noopener noreferrer"
                        style={{ padding: '6px 12px', borderRadius: 8, background: 'rgba(124,58,237,.1)', border: '1px solid rgba(124,58,237,.2)', color: 'var(--accent2)', cursor: 'pointer', fontFamily: 'DM Mono, monospace', fontSize: 12, textDecoration: 'none' }}>
                        🔗 Link Assinatura
                      </a>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal de Visualização de Documento */}
      {selectedDoc && (
        <div className="modal-overlay">
          <div className="modal-box" style={{ maxWidth: 800 }}>
            <div className="modal-header">
              <h3>{selectedDoc.type === 'proposta' ? 'Proposta Comercial' : 'Contrato'} para {selectedDoc.clientName}</h3>
              <button className="modal-close" onClick={() => setSelectedDoc(null)}>✕</button>
            </div>
            <div className="modal-body" style={{ padding: 0 }}>
              {selectedDoc.html ? (
                <div
                  style={{ padding: '20px 24px', maxHeight: 'calc(90vh - 180px)', overflowY: 'auto', background: '#fff', color: '#333' }}
                  dangerouslySetInnerHTML={{ __html: selectedDoc.html }}
                />
              ) : (
                <div style={{ padding: '20px 24px', textAlign: 'center', color: 'var(--muted)' }}>
                  Conteúdo do documento não disponível.
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn-cancel" onClick={() => setSelectedDoc(null)}>Fechar</button>
              {selectedDoc.signToken && (
                <a href={`/sign/${selectedDoc.signToken}`} target="_blank" rel="noopener noreferrer"
                  className="btn-primary" style={{ textDecoration: 'none' }}>
                  Ir para Assinatura
                </a>
              )}
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

  const emptyForm = { id: '', name: '', cnpj: '', email: '', phone: '', address: '', city: '', state: '', zip: '' }

  function addClient() { setForm({ ...emptyForm, id: Date.now().toString() }) }
  function editClient(c) { setForm({ ...c }) }
  function removeClient(id) {
    if (!confirm('Remover cliente?')) return
    setClients(prev => prev.filter(c => c.id !== id))
  }

  async function salvarClient() {
    if (!form.name || !form.cnpj) { toast('Nome e CNPJ obrigatórios', 'err'); return }
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
        <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 14, lineHeight: 1.6 }}>
          Gerencie a base de clientes da sua empresa.
        </p>

        {clients.length === 0 && <p style={{ color: 'var(--muted)', fontSize: 13, marginBottom: 12 }}>Nenhum cliente cadastrado.</p>}
        {clients.map(c => (
          <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 10, marginBottom: 8 }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600, fontSize: 14 }}>{c.name}</div>
              <div style={{ fontSize: 12, color: 'var(--muted)' }}>
                {c.cnpj} · {c.city}/{c.state}
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
          <div style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 12, padding: 18, marginTop: 16 }}>
            <div style={{ ...s.secTitle, marginBottom: 14 }}>
              {form.id ? '✏️ Editar Cliente' : '➕ Novo Cliente'}
            </div>
            <div style={s.field}>
              <label style={s.label}>Nome/Razão Social</label>
              <input style={s.input} value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Nome do Cliente" />
            </div>
            <div style={s.row2}>
              <div style={s.field}><label style={s.label}>CNPJ</label>
                <input style={s.input} value={form.cnpj} onChange={e => setForm(f => ({ ...f, cnpj: e.target.value }))} placeholder="00.000.000/0000-00" />
              </div>
              <div style={s.field}><label style={s.label}>E-mail</label>
                <input style={s.input} type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="email@cliente.com" />
              </div>
            </div>
            <div style={s.row2}>
              <div style={s.field}><label style={s.label}>Telefone</label>
                <input style={s.input} value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="(00) 00000-0000" />
              </div>
              <div style={s.field}><label style={s.label}>Endereço</label>
                <input style={s.input} value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} placeholder="Rua, Número, Bairro" />
              </div>
            </div>
            <div style={s.modalGrid3}>
              <div style={s.field}><label style={s.label}>Cidade</label>
                <input style={s.input} value={form.city} onChange={e => setForm(f => ({ ...f, city: e.target.value }))} placeholder="Cidade" />
              </div>
              <div style={s.field}><label style={s.label}>Estado</label>
                <input style={s.input} value={form.state} onChange={e => setForm(f => ({ ...f, state: e.target.value }))} placeholder="UF" />
              </div>
              <div style={s.field}><label style={s.label}>CEP</label>
                <input style={s.input} value={form.zip} onChange={e => setForm(f => ({ ...f, zip: e.target.value }))} placeholder="00000-000" />
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
              <button style={s.saveBtn} onClick={salvarClient} disabled={saving}>
                {saving ? '⏳...' : '✅ Salvar Cliente'}
              </button>
              <button onClick={() => setForm(null)}
                style={{ padding: '11px 18px', borderRadius: 10, background: 'rgba(100,116,139,.12)', border: '1px solid rgba(100,116,139,.3)', color: 'var(--muted)', fontFamily: 'DM Mono, monospace', fontSize: 13, cursor: 'pointer' }}>
                Cancelar
              </button>
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
  const [primaryColor, setPrimaryColor] = useState(cfg.theme?.primaryColor || '#00d4ff')
  const [secondaryColor, setSecondaryColor] = useState(cfg.theme?.secondaryColor || '#7c3aed')
  const [successColor, setSuccessColor] = useState(cfg.theme?.successColor || '#10b981')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setPrimaryColor(cfg.theme?.primaryColor || '#00d4ff')
    setSecondaryColor(cfg.theme?.secondaryColor || '#7c3aed')
    setSuccessColor(cfg.theme?.successColor || '#10b981')
  }, [cfg])

  async function salvar() {
    setSaving(true)
    const novoCfg = { ...cfg, theme: { primaryColor, secondaryColor, successColor } }
    const { error } = await salvarStorage(empresaId, novoCfg)
    setSaving(false)
    if (error) { toast('Erro ao salvar', 'err'); return }
    setCfg(novoCfg)
    toast('✅ Tema salvo!')
    // Aplica o tema imediatamente
    document.documentElement.style.setProperty('--accent', primaryColor)
    document.documentElement.style.setProperty('--accent2', secondaryColor)
    document.documentElement.style.setProperty('--accent3', successColor)
  }

  return (
    <div style={s.body}>
      <div style={s.sec}>
        <div style={s.secTitle}>🎨 Personalização do Tema</div>
        <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 16, lineHeight: 1.6 }}>
          Personalize as cores principais da sua plataforma.
        </p>

        <div style={s.field}>
          <label style={s.label}>Cor Primária (Accent)</label>
          <input type="color" style={{ ...s.input, height: 40, padding: 5 }} value={primaryColor} onChange={e => setPrimaryColor(e.target.value)} />
        </div>
        <div style={s.field}>
          <label style={s.label}>Cor Secundária (Accent 2)</label>
          <input type="color" style={{ ...s.input, height: 40, padding: 5 }} value={secondaryColor} onChange={e => setSecondaryColor(e.target.value)} />
        </div>
        <div style={s.field}>
          <label style={s.label}>Cor de Sucesso (Accent 3)</label>
          <input type="color" style={{ ...s.input, height: 40, padding: 5 }} value={successColor} onChange={e => setSuccessColor(e.target.value)} />
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
  const [empresaId, setEmpresaId] = useState(null)
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState(null)

  useEffect(() => {
    async function getSession() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        router.push('/')
        return
      }
      setUser(session.user)
      // Assume que o empresaId está no metadata do usuário ou em uma tabela de perfis
      const userEmpresaId = session.user.user_metadata?.empresa_id || 'default_empresa_id' // TODO: Ajustar conforme sua lógica
      setEmpresaId(userEmpresaId)
      carregarConfig(userEmpresaId)
    }
    getSession()
  }, [router])

  useEffect(() => {
    if (cfg?.theme) {
      document.documentElement.style.setProperty('--accent', cfg.theme.primaryColor)
      document.documentElement.style.setProperty('--accent2', cfg.theme.secondaryColor)
      document.documentElement.style.setProperty('--accent3', cfg.theme.successColor)
    }
  }, [cfg?.theme])

  async function carregarConfig(id) {
    setLoading(true)
    const { data, error } = await supabase
      .from('vx_storage')
      .select('value')
      .eq('key', `cfg:${id}`)
      .single()

    if (error && error.code !== 'PGRST116') { // PGRST116 = no rows found (primeiro acesso)
      console.error('Erro ao carregar config:', error)
      toast('Erro ao carregar configurações.', 'err')
      setLoading(false)
      return
    }

    const initialCfg = data?.value ? JSON.parse(data.value) : {
      company: 'Minha Empresa',
      slogan: 'Assistente Comercial Inteligente',
      logob64: null,
      users: [],
      kpiTemplates: [],
      goals: [],
      plans: PLANOS_PADRAO,
      prices: PRECOS_PADRAO,
      modulos: MODULOS_PADRAO,
      discAdPct: 50,
      discMenPct: 0,
      discClosePct: 40,
      vouchers: [],
      docHistory: [], // Inicializa o histórico de documentos
      importedDocs: [], // Inicializa documentos importados
      clients: [],
      perfisTipos: [
        { id: 'admin', nome: 'Administrador', permissoes: PERMISSOES_ADMIN, fixo: true },
        { id: 'user',  nome: 'Vendedor',      permissoes: PERMISSOES_USER,  fixo: true },
      ],
      theme: { primaryColor: '#00d4ff', secondaryColor: '#7c3aed', successColor: '#10b981' },
    }
    setCfg(initialCfg)
    setLoading(false)
  }

  if (loading) {
    return (
      <div style={s.fullPageCenter}>
        <div style={s.spinner} />
        <p style={{ color: 'var(--muted)', fontSize: 14, marginTop: 20 }}>Carregando configurações...</p>
      </div>
    )
  }

  if (!cfg || !empresaId) {
    return (
      <div style={s.fullPageCenter}>
        <p style={{ color: 'var(--danger)', fontSize: 14 }}>Erro ao carregar configurações ou ID da empresa não encontrado.</p>
      </div>
    )
  }

  return (
    <div style={s.container}>
      <div style={s.sidebar}>
        <h2 style={s.sidebarTitle}>⚙️ Configurações</h2>
        <nav>
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{ ...s.tabButton, ...(activeTab === tab.id ? s.tabButtonActive : {}) }}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>
      <div style={s.content}>
        {activeTab === 'empresa'    && <TabEmpresa    cfg={cfg} setCfg={setCfg} empresaId={empresaId} />}
        {activeTab === 'metas'      && <TabMetas      cfg={cfg} setCfg={setCfg} empresaId={empresaId} />}
        {activeTab === 'kpis'       && <TabKpis       cfg={cfg} setCfg={setCfg} empresaId={empresaId} />}
        {activeTab === 'usuarios'   && <TabUsuarios   cfg={cfg} setCfg={setCfg} empresaId={empresaId} />}
        {activeTab === 'produtos'   && <TabProdutos   cfg={cfg} setCfg={setCfg} empresaId={empresaId} />}
        {activeTab === 'descontos'  && <TabDescontos  cfg={cfg} setCfg={setCfg} empresaId={empresaId} />}
        {activeTab === 'vouchers'   && <TabVouchers   cfg={cfg} setCfg={setCfg} empresaId={empresaId} />}
        {activeTab === 'documentos' && <TabDocumentos cfg={cfg} setCfg={setCfg} empresaId={empresaId} />} {/* Nova aba */}
        {activeTab === 'historico'  && <TabHistorico  cfg={cfg} setCfg={setCfg} empresaId={empresaId} />} {/* Aba atualizada */}
        {activeTab === 'clientes'   && <TabClientes   cfg={cfg} setCfg={setCfg} empresaId={empresaId} />}
        {activeTab === 'tema'       && <TabTema       cfg={cfg} setCfg={setCfg} empresaId={empresaId} />}
      </div>
      <div id="vx-toast" style={s.toast}></div>
    </div>
  )
}

// ══════════════════════════════════════════════
// ESTILOS LOCAIS
// ══════════════════════════════════════════════
const s = {
  container: {
    display: 'flex',
    minHeight: '100vh',
    width: '100%',
    maxWidth: 1200,
    margin: '0 auto',
    padding: '20px',
    gap: '20px',
  },
  sidebar: {
    width: 220,
    flexShrink: 0,
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    borderRadius: 16,
    padding: '20px 0',
    alignSelf: 'flex-start',
    position: 'sticky',
    top: 20,
  },
  sidebarTitle: {
    fontFamily: 'Syne, sans-serif',
    fontSize: 18,
    fontWeight: 700,
    color: 'var(--accent)',
    padding: '0 20px 15px',
    borderBottom: '1px solid var(--border)',
    marginBottom: 15,
  },
  tabButton: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    width: '100%',
    padding: '12px 20px',
    background: 'none',
    border: 'none',
    color: 'var(--muted)',
    fontSize: 14,
    textAlign: 'left',
    cursor: 'pointer',
    transition: 'all .2s',
    fontFamily: 'DM Mono, monospace',
    fontWeight: 500,
  },
  tabButtonActive: {
    background: 'rgba(0,212,255,.1)',
    color: 'var(--accent)',
    borderLeft: '4px solid var(--accent)',
    paddingLeft: 16,
  },
  content: {
    flex: 1,
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    borderRadius: 16,
    padding: '28px 32px',
    boxShadow: 'var(--shadow)',
  },
  body: {
    display: 'flex',
    flexDirection: 'column',
    gap: 25,
  },
  sec: {
    marginBottom: 20,
    paddingBottom: 20,
    borderBottom: '1px solid var(--border)',
  },
  secTitle: {
    fontFamily: 'Syne, sans-serif',
    fontSize: 16,
    fontWeight: 700,
    color: 'var(--text)',
    marginBottom: 12,
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  },
  field: {
    marginBottom: 15,
  },
  label: {
    fontSize: 12,
    color: 'var(--muted)',
    display: 'block',
    marginBottom: 6,
    letterSpacing: '.5px',
  },
  input: {
    width: '100%',
    background: 'var(--surface2)',
    border: '1px solid var(--border)',
    borderRadius: 8,
    padding: '10px 14px',
    fontSize: 14,
    color: 'var(--text)',
    outline: 'none',
    transition: 'border-color .2s',
    fontFamily: 'DM Mono, monospace',
  },
  'input:focus': {
    borderColor: 'var(--accent)',
  },
  row2: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: 15,
    marginBottom: 15,
  },
  modalGrid3: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr 1fr',
    gap: 10,
    marginBottom: 15,
  },
  saveBtn: {
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
    transition: 'all .2s',
    letterSpacing: '.5px',
    marginTop: 10,
  },
  'saveBtn:disabled': {
    opacity: .6,
    cursor: 'not-allowed',
  },
  toast: {
    position: 'fixed',
    bottom: 20,
    right: 20,
    background: 'rgba(16,185,129,.9)',
    color: '#fff',
    padding: '12px 20px',
    borderRadius: 10,
    boxShadow: '0 4px 15px rgba(0,0,0,.2)',
    opacity: 0,
    transform: 'translateY(20px)',
    transition: 'all .3s ease-out',
    zIndex: 7000,
    fontFamily: 'DM Mono, monospace',
    fontSize: 14,
  },
  fullPageCenter: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '100vh',
    width: '100%',
  },
  spinner: {
    width: 40,
    height: 40,
    border: '3px solid var(--border)',
    borderTop: '3px solid var(--accent)',
    borderRadius: '50%',
    animation: 'spin 1s linear infinite',
  },
  centro: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 200,
  },
}

// Keyframes para o spinner (se não estiver no CSS global)
const globalStyles = `
  @keyframes spin {
    to { transform: rotate(360deg); }
  }
  .modal-overlay{position:fixed;inset:0;background:rgba(0,0,0,.75);z-index:6000;display:flex;align-items:center;justify-content:center;padding:20px;overflow-y:auto}
  .modal-box{background:var(--surface);border:1px solid var(--border);border-radius:16px;width:100%;max-width:560px;box-shadow:var(--shadow);display:flex;flex-direction:column;max-height:90vh;position:relative}
  .modal-header{padding:20px 24px 0;flex-shrink:0}
  .modal-header h3{font-family:'Syne',sans-serif;font-size:16px;font-weight:700;color:var(--accent)}
  .modal-close{position:absolute;top:16px;right:20px;background:none;border:none;color:var(--muted);font-size:20px;cursor:pointer}
  .modal-close:hover{color:var(--text)}
  .modal-body{padding:20px 24px;overflow-y:auto;flex:1}
  .modal-footer{padding:16px 24px;border-top:1px solid var(--border);display:flex;gap:10px;justify-content:flex-end;flex-shrink:0}
  .btn-cancel{padding:10px 18px;border-radius:10px;background:rgba(100,116,139,.12);border:1px solid var(--border);color:var(--muted);font-family:'DM Mono',monospace;font-size:13px;cursor:pointer}
  .btn-primary{padding:10px 22px;border-radius:10px;background:linear-gradient(135deg,var(--accent),#0099bb);border:none;color:#fff;font-family:'DM Mono',monospace;font-size:13px;font-weight:600;cursor:pointer;transition:all .2s}
  .btn-primary:hover{box-shadow:0 0 16px rgba(0,212,255,.4);transform:translateY(-1px)}
`;

// Adiciona os estilos globais se não estiverem já no seu CSS
if (typeof window !== 'undefined' && !document.getElementById('global-config-styles')) {
  const styleTag = document.createElement('style');
  styleTag.id = 'global-config-styles';
  styleTag.textContent = globalStyles;
  document.head.appendChild(styleTag);
}
