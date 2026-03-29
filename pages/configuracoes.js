// pages/configuracoes.js
import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import { supabase } from '../lib/supabase'

// ══════════════════════════════════════════════
// CONSTANTES E HELPERS
// ══════════════════════════════════════════════
const TABS = [
  { id: 'empresa',      label: '🏢 Empresa' },
  { id: 'metas',        label: '🎯 Metas' },
  { id: 'kpis',         label: '📊 KPIs' },
  { id: 'usuarios',     label: '👥 Usuários' },
  { id: 'produtos',     label: '📦 Produtos' },
  { id: 'descontos',    label: '🏷️ Descontos' },
  { id: 'vouchers',     label: '🎫 Vouchers' },
  { id: 'documentos',   label: '📄 Documentos' },
  { id: 'historico',    label: '🗂️ Histórico' },
  { id: 'clientes',     label: '🗃️ Clientes' },
  { id: 'tema',         label: '🎨 Tema' },
]

function toast(msg, type = 'ok') {
  const el = document.getElementById('vx-toast')
  if (!el) return
  el.textContent = msg
  el.style.background = type === 'ok' ? 'rgba(16,185,129,.9)' : 'rgba(239,68,68,.9)'
  el.style.opacity = '1'
  el.style.transform = 'translateY(0)'
  setTimeout(() => {
    el.style.opacity = '0'
    el.style.transform = 'translateY(20px)'
  }, 3000)
}

// ══════════════════════════════════════════════
// COMPONENTES DE ABA
// ══════════════════════════════════════════════

// ─── ABA EMPRESA ───────────────────────────────
function TabEmpresa({ cfg, setCfg, empresaId }) {
  const [company, setCompany]     = useState(cfg.company || '')
  const [slogan, setSlogan]       = useState(cfg.slogan  || '')
  const [logoB64, setLogoB64]     = useState(cfg.logob64 || '')
  const [saving, setSaving]       = useState(false)

  function handleLogo(e) {
    const file = e.target.files[0]
    if (!file) return
    if (file.size > 512000) { toast('Imagem muito grande (máx 500kb)', 'err'); return }
    const reader = new FileReader()
    reader.onload = ev => setLogoB64(ev.target.result)
    reader.readAsDataURL(file)
  }

  async function salvar() {
    setSaving(true)
    const novoCfg = { ...cfg, company, slogan, logob64: logoB64 }
    const { error } = await supabase
      .from('vx_storage')
      .upsert({ key: `cfg:${empresaId}`, value: JSON.stringify(novoCfg), updated_at: new Date().toISOString() })
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
        {logoB64 && (
          <div style={{ marginTop: 10, marginBottom: 10 }}>
            <img src={logoB64} alt="Logo" style={{ height: 60, borderRadius: 8, border: '1px solid var(--border)' }} />
          </div>
        )}
      </div>
      <button style={s.saveBtn} onClick={salvar} disabled={saving}>
        {saving ? '⏳ Salvando...' : '✅ Salvar'}
      </button>
    </div>
  )
}

// ─── ABA METAS ─────────────────────────────────
function TabMetas({ cfg, setCfg, empresaId }) {
  const mes = new Date().toISOString().slice(0, 7)
  const [mesRef, setMesRef] = useState(mes)
  const [metas, setMetas]   = useState({})
  const [saving, setSaving] = useState(false)
  const usuarios = cfg.users || []

  useEffect(() => {
    const g = cfg.goals || []
    const map = {}
    g.filter(x => x.mes === mesRef).forEach(x => { map[x.userId] = x })
    setMetas(map)
  }, [mesRef, cfg.goals])

  function updateMeta(userId, campo, val) {
    setMetas(prev => ({
      ...prev,
      [userId]: { ...(prev[userId] || { userId, mes: mesRef }), [campo]: val }
    }))
  }

  async function salvar() {
    setSaving(true)
    const outrasGoals = (cfg.goals || []).filter(x => x.mes !== mesRef)
    const novasGoals  = Object.values(metas).map(m => ({ ...m, mes: mesRef }))
    const novoCfg     = { ...cfg, goals: [...outrasGoals, ...novasGoals] }
    const { error }   = await supabase
      .from('vx_storage')
      .upsert({ key: `cfg:${empresaId}`, value: JSON.stringify(novoCfg), updated_at: new Date().toISOString() })
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
    if (tipo === 'tudo') {
      novoCfg = { company: cfg.company, slogan: cfg.slogan, logob64: cfg.logob64, users: cfg.users }
    }
    const { error } = await supabase
      .from('vx_storage')
      .upsert({ key: `cfg:${empresaId}`, value: JSON.stringify(novoCfg), updated_at: new Date().toISOString() })
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

// ─── ABA KPIs ──────────────────────────────────
function TabKpis({ cfg, setCfg, empresaId }) {
  const [kpis, setKpis]   = useState(cfg.kpiTemplates || [])
  const [saving, setSaving] = useState(false)

  function addKpi() {
    setKpis(prev => [...prev, { id: Date.now(), nome: '', icone: '📊', meta: 0 }])
  }
  function updateKpi(id, campo, val) {
    setKpis(prev => prev.map(k => k.id === id ? { ...k, [campo]: val } : k))
  }
  function removeKpi(id) {
    setKpis(prev => prev.filter(k => k.id !== id))
  }

  async function salvar() {
    setSaving(true)
    const novoCfg = { ...cfg, kpiTemplates: kpis }
    const { error } = await supabase
      .from('vx_storage')
      .upsert({ key: `cfg:${empresaId}`, value: JSON.stringify(novoCfg), updated_at: new Date().toISOString() })
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
          Configure os KPIs que os vendedores irão acompanhar diariamente.
        </p>
        {kpis.map(k => (
          <div key={k.id} style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
            <input style={{ ...s.input, width: 48 }} value={k.icone} onChange={e => updateKpi(k.id, 'icone', e.target.value)} placeholder="📊" />
            <input style={{ ...s.input, flex: 1 }} value={k.nome} onChange={e => updateKpi(k.id, 'nome', e.target.value)} placeholder="Nome do KPI (ex: Ligações)" />
            <input type="number" style={{ ...s.input, width: 80 }} value={k.meta} onChange={e => updateKpi(k.id, 'meta', e.target.value)} placeholder="Meta" />
            <button onClick={() => removeKpi(k.id)}
              style={{ padding: '8px 12px', borderRadius: 8, background: 'rgba(239,68,68,.1)', border: '1px solid rgba(239,68,68,.3)', color: 'var(--danger)', cursor: 'pointer', fontFamily: 'DM Mono, monospace' }}>
              🗑
            </button>
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

// ─── ABA USUÁRIOS ──────────────────────────────
function TabUsuarios({ cfg, setCfg, empresaId }) {
  const [users, setUsers]     = useState(cfg.users || [])
  const [form, setForm]       = useState(null)
  const [saving, setSaving]   = useState(false)

  const emptyForm = { nome: '', usuario: '', email: '', telefone: '', senha: '', perfil: 'user' }

  function editUser(u) { setForm({ ...u }) }

  function removeUser(id) {
    if (!confirm('Remover usuário?')) return
    setUsers(prev => prev.filter(u => u.id !== id))
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
    const novoCfg = { ...cfg, users: novos }
    const { error } = await supabase
      .from('vx_storage')
      .upsert({ key: `cfg:${empresaId}`, value: JSON.stringify(novoCfg), updated_at: new Date().toISOString() })
    setSaving(false)
    if (error) { toast('Erro ao salvar', 'err'); return }
    setUsers(novos)
    setCfg(novoCfg)
    setForm(null)
    toast('✅ Usuário salvo!')
  }

  return (
    <div style={s.body}>
      <div style={s.sec}>
        <div style={s.secTitle}>Usuários do Sistema</div>
        {users.length === 0 && <p style={{ color: 'var(--muted)', fontSize: 13, marginBottom: 12 }}>Nenhum usuário cadastrado.</p>}
        {users.map(u => (
          <div key={u.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 10, marginBottom: 8 }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600, fontSize: 14 }}>{u.nome}</div>
              <div style={{ fontSize: 12, color: 'var(--muted)' }}>{u.email} · {u.perfil === 'admin' ? '👑 Admin' : 'Padrão'}</div>
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
      </div>

      {form && (
        <div style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 12, padding: 18, marginTop: 8 }}>
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
            <div style={s.field}><label style={s.label}>Perfil</label>
              <select style={s.input} value={form.perfil} onChange={e => setForm(f => ({ ...f, perfil: e.target.value }))}>
                <option value="user">Padrão</option>
                <option value="admin">Administrador</option>
              </select>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10, marginTop: 10 }}>
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
  )
}

// ─── ABA PRODUTOS ──────────────────────────────
function TabProdutos({ cfg, setCfg, empresaId }) {
  const [produtos, setProdutos] = useState(cfg.produtos || [])
  const [saving, setSaving]     = useState(false)

  function addProduto() {
    setProdutos(prev => [...prev, { id: Date.now(), nome: '', adesao: '', mensalidade: '' }])
  }
  function updateProduto(id, campo, val) {
    setProdutos(prev => prev.map(p => p.id === id ? { ...p, [campo]: val } : p))
  }
  function removeProduto(id) {
    setProdutos(prev => prev.filter(p => p.id !== id))
  }

  async function salvar() {
    setSaving(true)
    const novoCfg = { ...cfg, produtos }
    const { error } = await supabase
      .from('vx_storage')
      .upsert({ key: `cfg:${empresaId}`, value: JSON.stringify(novoCfg), updated_at: new Date().toISOString() })
    setSaving(false)
    if (error) { toast('Erro ao salvar', 'err'); return }
    setCfg(novoCfg)
    toast('✅ Produtos salvos!')
  }

  return (
    <div style={s.body}>
      <div style={s.sec}>
        <div style={s.secTitle}>Produtos e Planos</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 120px 120px 40px', gap: 8, marginBottom: 8 }}>
          <span style={{ fontSize: 10, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.8px' }}>Nome</span>
          <span style={{ fontSize: 10, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.8px' }}>Adesão R$</span>
          <span style={{ fontSize: 10, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.8px' }}>Mensalidade</span>
          <span />
        </div>
        {produtos.map(p => (
          <div key={p.id} style={{ display: 'grid', gridTemplateColumns: '1fr 120px 120px 40px', gap: 8, marginBottom: 8 }}>
            <input style={s.input} value={p.nome} onChange={e => updateProduto(p.id, 'nome', e.target.value)} placeholder="Nome do produto" />
            <input type="number" style={s.input} value={p.adesao} onChange={e => updateProduto(p.id, 'adesao', e.target.value)} placeholder="0" />
            <input type="number" style={s.input} value={p.mensalidade} onChange={e => updateProduto(p.id, 'mensalidade', e.target.value)} placeholder="0" />
            <button onClick={() => removeProduto(p.id)}
              style={{ padding: '8px', borderRadius: 8, background: 'rgba(239,68,68,.1)', border: '1px solid rgba(239,68,68,.3)', color: 'var(--danger)', cursor: 'pointer' }}>
              🗑
            </button>
          </div>
        ))}
        <button onClick={addProduto}
          style={{ padding: '9px 16px', borderRadius: 8, background: 'rgba(0,212,255,.1)', border: '1px solid rgba(0,212,255,.25)', color: 'var(--accent)', fontFamily: 'DM Mono, monospace', fontSize: 13, cursor: 'pointer', marginTop: 6 }}>
          + Novo Produto
        </button>
      </div>
      <button style={s.saveBtn} onClick={salvar} disabled={saving}>
        {saving ? '⏳ Salvando...' : '✅ Salvar Tudo'}
      </button>
    </div>
  )
}

// ─── ABA DESCONTOS ─────────────────────────────
function TabDescontos({ cfg, setCfg, empresaId }) {
  const [discMode, setDiscMode] = useState(cfg.discMode || 'screen')
  const [da, setDa]             = useState(cfg.discAdPct    || 0)
  const [dm, setDm]             = useState(cfg.discMenPct   || 0)
  const [dc, setDc]             = useState(cfg.discClosePct || 0)
  const [saving, setSaving]     = useState(false)

  async function salvar() {
    setSaving(true)
    const novoCfg = { ...cfg, discMode, discAdPct: da, discMenPct: dm, discClosePct: dc }
    const { error } = await supabase
      .from('vx_storage')
      .upsert({ key: `cfg:${empresaId}`, value: JSON.stringify(novoCfg), updated_at: new Date().toISOString() })
    setSaving(false)
    if (error) { toast('Erro ao salvar', 'err'); return }
    setCfg(novoCfg)
    toast('✅ Descontos salvos!')
  }

  const radioStyle = (val) => ({
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '12px 16px', background: discMode === val ? 'rgba(0,212,255,.06)' : 'var(--surface2)',
    border: `1px solid ${discMode === val ? 'rgba(0,212,255,.3)' : 'var(--border)'}`,
    borderRadius: 10, marginBottom: 8, cursor: 'pointer'
  })

  return (
    <div style={s.body}>
      <div style={s.sec}>
        <div style={s.secTitle}>Modo de Desconto</div>
        {[
          ['screen',  '🖥 Desconto em Tela',       'Mostra desconto após o preço cheio automaticamente'],
          ['voucher', '🎫 Somente via Voucher',      'Desconto só é aplicado com código de voucher válido'],
        ].map(([val, title, sub]) => (
          <div key={val} style={radioStyle(val)} onClick={() => setDiscMode(val)}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 600 }}>{title}</div>
              <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>{sub}</div>
            </div>
            <div style={{ width: 20, height: 20, borderRadius: '50%', border: `2px solid ${discMode === val ? 'var(--accent)' : 'var(--border)'}`, background: discMode === val ? 'var(--accent)' : 'transparent' }} />
          </div>
        ))}
      </div>
      <div style={s.sec}>
        <div style={s.secTitle}>Percentuais de Desconto</div>
        <div style={s.row3}>
          <div style={s.field}><label style={s.label}>% Adesão (tela)</label>
            <input type="number" style={s.input} min={0} max={100} value={da} onChange={e => setDa(e.target.value)} />
          </div>
          <div style={s.field}><label style={s.label}>% Mensalidade (tela)</label>
            <input type="number" style={s.input} min={0} max={100} value={dm} onChange={e => setDm(e.target.value)} />
          </div>
          <div style={s.field}><label style={s.label}>% Adesão (fechamento)</label>
            <input type="number" style={s.input} min={0} max={100} value={dc} onChange={e => setDc(e.target.value)} />
          </div>
        </div>
      </div>
      <button style={s.saveBtn} onClick={salvar} disabled={saving}>
        {saving ? '⏳ Salvando...' : '✅ Salvar'}
      </button>
    </div>
  )
}

// ─── ABA VOUCHERS ──────────────────────────────
function TabVouchers({ cfg, setCfg, empresaId }) {
  const [prefixo, setPrefixo]   = useState('PROMO')
  const [vda, setVda]           = useState(40)
  const [vdm, setVdm]           = useState(0)
  const [vdate, setVdate]       = useState('')
  const [vouchers, setVouchers] = useState(cfg.vouchers || [])
  const [ultimo, setUltimo]     = useState(null)
  const [saving, setSaving]     = useState(false)

  function gerarCodigo() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
    let code = (prefixo || 'VX').toUpperCase().slice(0, 6) + '-'
    for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)]
    return code
  }

  async function gerarVoucher() {
    const novo = {
      id: Date.now(), codigo: gerarCodigo(), prefixo, pctAdesao: Number(vda),
      pctMensalidade: Number(vdm), comemoracao: vdate, criado: new Date().toISOString(), ativo: true
    }
    const novos = [...vouchers, novo]
    const novoCfg = { ...cfg, vouchers: novos }
    const { error } = await supabase
      .from('vx_storage')
      .upsert({ key: `cfg:${empresaId}`, value: JSON.stringify(novoCfg), updated_at: new Date().toISOString() })
    if (error) { toast('Erro ao salvar voucher', 'err'); return }
    setVouchers(novos)
    setCfg(novoCfg)
    setUltimo(novo)
    toast('🎫 Voucher gerado!')
  }

  async function removerVoucher(id) {
    const novos = vouchers.filter(v => v.id !== id)
    const novoCfg = { ...cfg, vouchers: novos }
    await supabase.from('vx_storage').upsert({ key: `cfg:${empresaId}`, value: JSON.stringify(novoCfg), updated_at: new Date().toISOString() })
    setVouchers(novos)
    setCfg(novoCfg)
    toast('🗑 Voucher removido!')
  }

  return (
    <div style={s.body}>
      <div style={s.sec}>
        <div style={s.secTitle}>Gerar Novo Voucher</div>
        <div style={s.row4}>
          <div style={s.field}><label style={s.label}>Prefixo</label>
            <input style={{ ...s.input, textTransform: 'uppercase' }} maxLength={8} value={prefixo} onChange={e => setPrefixo(e.target.value.toUpperCase())} placeholder="PROMO" />
          </div>
          <div style={s.field}><label style={s.label}>% Adesão</label>
            <input type="number" style={s.input} min={0} max={100} value={vda} onChange={e => setVda(e.target.value)} />
          </div>
          <div style={s.field}><label style={s.label}>% Mensalidade</label>
            <input type="number" style={s.input} min={0} max={100} value={vdm} onChange={e => setVdm(e.target.value)} />
          </div>
          <div style={s.field}><label style={s.label}>Data comemorativa</label>
            <input style={s.input} value={vdate} onChange={e => setVdate(e.target.value)} placeholder="Ex: Natal 2025" />
          </div>
        </div>
        <button onClick={gerarVoucher}
          style={{ padding: '10px 18px', borderRadius: 9, background: 'rgba(0,212,255,.15)', border: '1px solid rgba(0,212,255,.3)', color: 'var(--accent)', fontFamily: 'DM Mono, monospace', fontSize: 13, fontWeight: 600, cursor: 'pointer', marginTop: 8 }}>
          🎫 Gerar Voucher
        </button>
        {ultimo && (
          <div style={{ marginTop: 14, padding: 14, background: 'rgba(16,185,129,.1)', border: '1px solid rgba(16,185,129,.3)', borderRadius: 10 }}>
            <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 4 }}>CÓDIGO GERADO</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--accent3)', letterSpacing: 3, fontFamily: 'DM Mono, monospace' }}>{ultimo.codigo}</div>
            <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 6 }}>
              Adesão: {ultimo.pctAdesao}% · Mensalidade: {ultimo.pctMensalidade}%
              {ultimo.comemoracao && ` · ${ultimo.comemoracao}`}
            </div>
          </div>
        )}
      </div>
      <div style={s.sec}>
        <div style={s.secTitle}>Vouchers Ativos</div>
        {vouchers.length === 0 && <p style={{ color: 'var(--muted)', fontSize: 13 }}>Nenhum voucher cadastrado.</p>}
        {vouchers.map(v => (
          <div key={v.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 10, marginBottom: 8 }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, color: 'var(--accent)', fontFamily: 'DM Mono, monospace', letterSpacing: 1 }}>{v.codigo}</div>
              <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>
                Adesão {v.pctAdesao}% · Mensal {v.pctMensalidade}%{v.comemoracao && ` · ${v.comemoracao}`}
              </div>
            </div>
            <button onClick={() => removerVoucher(v.id)}
              style={{ padding: '6px 10px', borderRadius: 7, background: 'rgba(239,68,68,.1)', border: '1px solid rgba(239,68,68,.2)', color: 'var(--danger)', cursor: 'pointer', fontFamily: 'DM Mono, monospace', fontSize: 12 }}>
              🗑
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── ABA DOCUMENTOS ────────────────────────────
function TabDocumentos({ cfg, setCfg, empresaId }) {
  const [emailRem, setEmailRem] = useState(cfg.signConfig?.email || '')
  const [wpp, setWpp]           = useState(cfg.signConfig?.wpp   || '')
  const [urlBase, setUrlBase]   = useState(cfg.signConfig?.url   || '')
  const [saving, setSaving]     = useState(false)
  const [testando, setTestando] = useState(false)

  async function salvar() {
    setSaving(true)
    const novoCfg = { ...cfg, signConfig: { email: emailRem, wpp, url: urlBase } }
    const { error } = await supabase
      .from('vx_storage')
      .upsert({ key: `cfg:${empresaId}`, value: JSON.stringify(novoCfg), updated_at: new Date().toISOString() })
    setSaving(false)
    if (error) { toast('Erro ao salvar', 'err'); return }
    setCfg(novoCfg)
    toast('✅ Configurações salvas!')
  }

  async function testarConexao() {
    setTestando(true)
    const { data, error } = await supabase.from('vx_storage').select('key').limit(1)
    setTestando(false)
    if (error) { toast('❌ Falha na conexão: ' + error.message, 'err') }
    else { toast('✅ Conexão com Supabase OK!') }
  }

  return (
    <div style={s.body}>
      <div style={s.sec}>
        <div style={s.secTitle}>Modelos de Documentos</div>
        <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 14, lineHeight: 1.6 }}>
          Configure os modelos padrão usados em propostas e contratos. Deixe em branco para usar o modelo padrão.
        </p>
        {[
          ['proposta', '📄 Modelo de Proposta Comercial', 'Texto de abertura personalizado para propostas'],
          ['contrato', '📝 Modelo de Contrato',           'Texto de abertura personalizado para contratos'],
        ].map(([tipo, titulo, sub]) => (
          <div key={tipo} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 10, marginBottom: 8 }}>
            <div>
              <div style={{ fontWeight: 600, fontSize: 14 }}>{titulo}</div>
              <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>{sub}</div>
            </div>
            <button style={{ padding: '6px 12px', borderRadius: 8, background: 'rgba(0,212,255,.1)', border: '1px solid rgba(0,212,255,.2)', color: 'var(--accent)', cursor: 'pointer', fontFamily: 'DM Mono, monospace', fontSize: 12 }}>
              ✏️ Editar
            </button>
          </div>
        ))}
      </div>
      <div style={s.sec}>
        <div style={s.secTitle}>Configurações de Assinatura Eletrônica</div>
        <div style={s.row2}>
          <div style={s.field}><label style={s.label}>E-mail remetente</label>
            <input type="email" style={s.input} value={emailRem} onChange={e => setEmailRem(e.target.value)} placeholder="noreply@vivanexa.com.br" />
          </div>
          <div style={s.field}><label style={s.label}>WhatsApp da empresa</label>
            <input style={s.input} value={wpp} onChange={e => setWpp(e.target.value)} placeholder="5569984059125" />
          </div>
        </div>
        <div style={s.field}>
          <label style={s.label}>URL base do sistema (para links de assinatura)</label>
          <input style={s.input} value={urlBase} onChange={e => setUrlBase(e.target.value)} placeholder="https://seusite.com/sign" />
          <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>Se não configurado, será gerado um link local.</div>
        </div>
        <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
          <button style={s.saveBtn} onClick={salvar} disabled={saving}>
            {saving ? '⏳...' : '✅ Salvar Configurações'}
          </button>
          <button onClick={testarConexao} disabled={testando}
            style={{ padding: '11px 18px', borderRadius: 10, background: 'rgba(0,212,255,.1)', border: '1px solid rgba(0,212,255,.3)', color: 'var(--accent)', fontFamily: 'DM Mono, monospace', fontSize: 13, cursor: 'pointer' }}>
            {testando ? '⏳...' : '🔌 Testar Conexão Supabase'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── ABA HISTÓRICO ─────────────────────────────
function TabHistorico({ cfg }) {
  const [filtroTipo,   setFiltroTipo]   = useState('')
  const [filtroStatus, setFiltroStatus] = useState('')
  const [busca,        setBusca]        = useState('')

  const docs = (cfg.docHistory || []).filter(d => {
    if (filtroTipo   && d.tipo   !== filtroTipo)   return false
    if (filtroStatus && d.status !== filtroStatus) return false
    if (busca && !d.cliente?.toLowerCase().includes(busca.toLowerCase())) return false
    return true
  })

  function statusLabel(s) {
    if (s === 'signed')  return { txt: '✅ Assinado',             cor: 'var(--accent3)' }
    if (s === 'pending') return { txt: '⏳ Aguardando assinatura', cor: 'var(--warning)' }
    return                      { txt: '📝 Rascunho',             cor: 'var(--muted)'   }
  }

  return (
    <div style={s.body}>
      <div style={s.sec}>
        <div style={s.secTitle}>Propostas e Contratos Gerados</div>
        <div style={{ display: 'flex', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
          <select style={s.input} value={filtroTipo} onChange={e => setFiltroTipo(e.target.value)}>
            <option value="">Todos</option>
            <option value="proposta">Propostas</option>
            <option value="contrato">Contratos</option>
          </select>
          <select style={s.input} value={filtroStatus} onChange={e => setFiltroStatus(e.target.value)}>
            <option value="">Todos os status</option>
            <option value="pending">Aguardando assinatura</option>
            <option value="signed">Assinado</option>
            <option value="draft">Rascunho</option>
          </select>
          <input style={{ ...s.input, flex: 1, minWidth: 160 }}
            placeholder="Buscar por cliente..." value={busca} onChange={e => setBusca(e.target.value)} />
        </div>
        {docs.length === 0 && <p style={{ color: 'var(--muted)', fontSize: 13 }}>Nenhum documento encontrado.</p>}
        {docs.map((d, i) => {
          const sl = statusLabel(d.status)
          return (
            <div key={i} style={{ padding: '12px 16px', background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 10, marginBottom: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ fontWeight: 600, fontSize: 14 }}>{d.cliente || 'Cliente não identificado'}</div>
                <div style={{ fontSize: 12, color: sl.cor, fontWeight: 600 }}>{sl.txt}</div>
              </div>
              <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4 }}>
                {d.tipo === 'contrato' ? '📝 Contrato' : '📄 Proposta'} ·{' '}
                {d.criado ? new Date(d.criado).toLocaleDateString('pt-BR') : 'Data desconhecida'}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── ABA CLIENTES ──────────────────────────────
function TabClientes({ cfg, setCfg, empresaId }) {
  const [busca,    setBusca]    = useState('')
  const [form,     setForm]     = useState(null)
  const [saving,   setSaving]   = useState(false)
  const clientes = cfg.clients || []

  const filtrados = busca.trim()
    ? clientes.filter(c =>
        c.nome?.toLowerCase().includes(busca.toLowerCase()) ||
        c.cnpj?.includes(busca) || c.cpf?.includes(busca))
    : clientes

  const emptyClient = { id: '', nome: '', cnpj: '', cpf: '', email: '', telefone: '', cidade: '' }

  async function salvarCliente() {
    if (!form.nome) { toast('Nome obrigatório', 'err'); return }
    setSaving(true)
    let novos
    if (form.id) {
      novos = clientes.map(c => c.id === form.id ? form : c)
    } else {
      novos = [...clientes, { ...form, id: Date.now().toString() }]
    }
    const novoCfg = { ...cfg, clients: novos }
    const { error } = await supabase
      .from('vx_storage')
      .upsert({ key: `cfg:${empresaId}`, value: JSON.stringify(novoCfg), updated_at: new Date().toISOString() })
    setSaving(false)
    if (error) { toast('Erro ao salvar', 'err'); return }
    setCfg(novoCfg)
    setForm(null)
    toast('✅ Cliente salvo!')
  }

  async function removerCliente(id) {
    if (!confirm('Remover cliente?')) return
    const novos = clientes.filter(c => c.id !== id)
    const novoCfg = { ...cfg, clients: novos }
    await supabase.from('vx_storage').upsert({ key: `cfg:${empresaId}`, value: JSON.stringify(novoCfg), updated_at: new Date().toISOString() })
    setCfg(novoCfg)
    toast('🗑 Cliente removido!')
  }

  return (
    <div style={s.body}>
      <div style={s.sec}>
        <div style={s.secTitle}>Buscar / Cadastrar Cliente</div>
        <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
          <input style={{ ...s.input, flex: 1 }}
            placeholder="CNPJ, CPF ou nome do cliente..."
            value={busca} onChange={e => setBusca(e.target.value)} />
          <button onClick={() => setForm(emptyClient)}
            style={{ padding: '10px 16px', borderRadius: 9, background: 'rgba(0,212,255,.1)', border: '1px solid rgba(0,212,255,.25)', color: 'var(--accent)', fontFamily: 'DM Mono, monospace', fontSize: 13, cursor: 'pointer', whiteSpace: 'nowrap' }}>
            + Novo Cliente
          </button>
        </div>
        {filtrados.length === 0 && !form && <p style={{ color: 'var(--muted)', fontSize: 13 }}>Nenhum cliente encontrado.</p>}
        {filtrados.map(c => (
          <div key={c.id} style={{ padding: '12px 16px', background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 10, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600, color: 'var(--accent)', fontSize: 14 }}>{c.nome}</div>
              <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>
                {c.cnpj && `CNPJ: ${c.cnpj} · `}{c.cidade && `${c.cidade}`}
              </div>
            </div>
            <button onClick={() => setForm({ ...c })}
              style={{ padding: '5px 10px', borderRadius: 7, background: 'rgba(0,212,255,.1)', border: '1px solid rgba(0,212,255,.2)', color: 'var(--accent)', cursor: 'pointer', fontFamily: 'DM Mono, monospace', fontSize: 12 }}>
              ✏️
            </button>
            <button onClick={() => removerCliente(c.id)}
              style={{ padding: '5px 10px', borderRadius: 7, background: 'rgba(239,68,68,.1)', border: '1px solid rgba(239,68,68,.2)', color: 'var(--danger)', cursor: 'pointer', fontFamily: 'DM Mono, monospace', fontSize: 12 }}>
              🗑
            </button>
          </div>
        ))}
      </div>
      {form && (
        <div style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 12, padding: 18, marginTop: 8 }}>
          <div style={s.secTitle}>Dados do Cliente</div>
          <div style={s.row2}>
            <div style={s.field}><label style={s.label}>Nome completo / Razão Social</label>
              <input style={s.input} value={form.nome} onChange={e => setForm(f => ({ ...f, nome: e.target.value }))} />
            </div>
            <div style={s.field}><label style={s.label}>CNPJ</label>
              <input style={s.input} value={form.cnpj} onChange={e => setForm(f => ({ ...f, cnpj: e.target.value }))} placeholder="00.000.000/0000-00" />
            </div>
          </div>
          <div style={s.row2}>
            <div style={s.field}><label style={s.label}>E-mail</label>
              <input type="email" style={s.input} value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
            </div>
            <div style={s.field}><label style={s.label}>Telefone</label>
              <input style={s.input} value={form.telefone} onChange={e => setForm(f => ({ ...f, telefone: e.target.value }))} />
            </div>
          </div>
          <div style={s.field}><label style={s.label}>Cidade / Estado</label>
            <input style={s.input} value={form.cidade} onChange={e => setForm(f => ({ ...f, cidade: e.target.value }))} placeholder="Ex: São Paulo / SP" />
          </div>
          <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
            <button style={s.saveBtn} onClick={salvarCliente} disabled={saving}>
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
  )
}

// ─── ABA TEMA ──────────────────────────────────
function TabTema({ cfg, setCfg, empresaId }) {
  const [tema, setTema] = useState(cfg.theme || 'dark')

  async function aplicarTema(t) {
    setTema(t)
    document.documentElement.setAttribute('data-theme', t)
    const novoCfg = { ...cfg, theme: t }
    await supabase.from('vx_storage')
      .upsert({ key: `cfg:${empresaId}`, value: JSON.stringify(novoCfg), updated_at: new Date().toISOString() })
    setCfg(novoCfg)
    toast('🎨 Tema aplicado!')
  }

  const temaStyle = (t) => ({
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '12px 16px',
    background: tema === t ? 'rgba(0,212,255,.06)' : 'var(--surface2)',
    border: `1px solid ${tema === t ? 'rgba(0,212,255,.3)' : 'var(--border)'}`,
    borderRadius: 10, marginBottom: 8, cursor: 'pointer'
  })

  return (
    <div style={s.body}>
      <div style={s.sec}>
        <div style={s.secTitle}>Aparência</div>
        {[
          ['dark',  '🌙 Tema Escuro', 'Fundo escuro com cores vibrantes (padrão)'],
          ['light', '☀️ Tema Claro',  'Fundo branco, ideal para ambientes iluminados'],
        ].map(([t, title, sub]) => (
          <div key={t} style={temaStyle(t)} onClick={() => aplicarTema(t)}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 600 }}>{title}</div>
              <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>{sub}</div>
            </div>
            <div style={{ width: 20, height: 20, borderRadius: '50%', border: `2px solid ${tema === t ? 'var(--accent)' : 'var(--border)'}`, background: tema === t ? 'var(--accent)' : 'transparent' }} />
          </div>
        ))}
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════
// ESTILOS COMPARTILHADOS
// ══════════════════════════════════════════════
const s = {
  body:    { padding: '20px 24px' },
  sec:     { marginBottom: 24 },
  secTitle:{ fontSize: 11, letterSpacing: '1.5px', color: 'var(--muted)', textTransform: 'uppercase', marginBottom: 12, paddingBottom: 8, borderBottom: '1px solid var(--border)' },
  label:   { fontSize: 12, color: 'var(--muted)', display: 'block', marginBottom: 4, letterSpacing: '.5px' },
  input:   { width: '100%', background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 8, padding: '9px 12px', fontFamily: 'DM Mono, monospace', fontSize: 13, color: 'var(--text)', outline: 'none' },
  field:   { marginBottom: 12 },
  row2:    { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 4 },
  row3:    { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 12 },
  row4:    { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 12, marginBottom: 12 },
  saveBtn: { padding: '11px 22px', borderRadius: 10, background: 'linear-gradient(135deg,var(--accent),#0099bb)', border: 'none', color: '#fff', fontFamily: 'DM Mono, monospace', fontSize: 14, fontWeight: 600, cursor: 'pointer', letterSpacing: '.5px' },
}

// ══════════════════════════════════════════════
// PÁGINA PRINCIPAL
// ══════════════════════════════════════════════
export default function Configuracoes() {
  const router            = useRouter()
  const [loading, setLoading]     = useState(true)
  const [perfil, setPerfil]       = useState(null)
  const [empresaId, setEmpresaId] = useState(null)
  const [cfg, setCfg]             = useState({})
  const [abaAtiva, setAbaAtiva]   = useState('empresa')

  // ── Autenticação ──────────────────────────────
  useEffect(() => {
    async function init() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.push('/'); return }

      const { data: perf } = await supabase
        .from('perfis')
        .select('*')
        .eq('id', session.user.id)
        .single()

      setPerfil(perf)
      const eid = perf?.empresa_id || session.user.id
      setEmpresaId(eid)

      const { data: row } = await supabase
        .from('vx_storage')
        .select('value')
        .eq('key', `cfg:${eid}`)
        .single()

      if (row?.value) {
        try { setCfg(JSON.parse(row.value)) } catch {}
      }
      setLoading(false)
    }
    init()
  }, [])

  function renderAba() {
    const props = { cfg, setCfg, empresaId }
    switch (abaAtiva) {
      case 'empresa':    return <TabEmpresa    {...props} />
      case 'metas':      return <TabMetas      {...props} />
      case 'kpis':       return <TabKpis       {...props} />
      case 'usuarios':   return <TabUsuarios   {...props} />
      case 'produtos':   return <TabProdutos   {...props} />
      case 'descontos':  return <TabDescontos  {...props} />
      case 'vouchers':   return <TabVouchers   {...props} />
      case 'documentos': return <TabDocumentos {...props} />
      case 'historico':  return <TabHistorico  {...props} />
      case 'clientes':   return <TabClientes   {...props} />
      case 'tema':       return <TabTema       {...props} />
      default:           return null
    }
  }

  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)', color: 'var(--muted)', fontFamily: 'DM Mono, monospace' }}>
      Carregando configurações...
    </div>
  )

  return (
    <>
      {/* ESTILOS GLOBAIS */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=DM+Mono:wght@300;400;500&family=Inter:wght@300;400;500;600;700&display=swap');
        [data-theme="dark"]{
          --bg:#0a0f1e;--surface:#111827;--surface2:#1a2540;--border:#1e2d4a;
          --accent:#00d4ff;--accent2:#7c3aed;--accent3:#10b981;
          --text:#e2e8f0;--muted:#64748b;
          --danger:#ef4444;--warning:#f59e0b;--gold:#fbbf24;
          --card-bg:#1a2540;--input-bg:#111827;
          --shadow:0 4px 24px rgba(0,0,0,.4);
        }
        [data-theme="light"]{
          --bg:#f0f4f8;--surface:#ffffff;--surface2:#f8fafc;--border:#e2e8f0;
          --accent:#0099bb;--accent2:#7c3aed;--accent3:#059669;
          --text:#1e293b;--muted:#64748b;
          --danger:#ef4444;--warning:#d97706;--gold:#b45309;
          --card-bg:#f8fafc;--input-bg:#ffffff;
          --shadow:0 4px 24px rgba(0,0,0,.1);
        }
        *{box-sizing:border-box;margin:0;padding:0}
        body{font-family:'DM Mono',monospace;background:var(--bg);color:var(--text);min-height:100vh}
        [data-theme="dark"] body::before{
          content:'';position:fixed;inset:0;
          background-image:linear-gradient(rgba(0,212,255,.025) 1px,transparent 1px),
          linear-gradient(90deg,rgba(0,212,255,.025) 1px,transparent 1px);
          background-size:40px 40px;pointer-events:none;z-index:0}
        input[type=number]::-webkit-inner-spin-button{opacity:1}
        select option{background:var(--surface2);color:var(--text)}
      `}</style>

      {/* ORBS */}
      <div style={{ position: 'fixed', width: 500, height: 500, background: 'var(--accent)', top: -200, right: -150, borderRadius: '50%', filter: 'blur(120px)', opacity: .06, pointerEvents: 'none', zIndex: 0 }} />
      <div style={{ position: 'fixed', width: 400, height: 400, background: 'var(--accent2)', bottom: -150, left: -100, borderRadius: '50%', filter: 'blur(120px)', opacity: .06, pointerEvents: 'none', zIndex: 0 }} />

      {/* TOAST */}
      <div id="vx-toast" style={{ position: 'fixed', bottom: 30, left: '50%', transform: 'translateX(-50%) translateY(20px)', background: 'rgba(16,185,129,.9)', color: '#fff', padding: '12px 24px', borderRadius: 10, fontFamily: 'DM Mono, monospace', fontSize: 14, zIndex: 9999, opacity: 0, transition: 'opacity .3s, transform .3s', boxShadow: '0 4px 20px rgba(0,0,0,.3)' }} />

      {/* HEADER */}
      <header style={{ position: 'relative', zIndex: 10, width: '100%', maxWidth: 820, margin: '0 auto', padding: '18px 20px 0', display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ fontFamily: 'Syne, sans-serif', fontSize: 17, fontWeight: 700, letterSpacing: .5 }}>
          {cfg.company || 'Vivanexa'}
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
          <button onClick={() => router.push('/chat')}
            style={{ background: 'var(--surface2)', border: '1px solid var(--border)', cursor: 'pointer', color: 'var(--muted)', fontSize: 11, padding: '5px 11px', borderRadius: 8, fontFamily: 'DM Mono, monospace', letterSpacing: .3 }}>
            💬 Chat
          </button>
          <button onClick={() => router.push('/dashboard')}
            style={{ background: 'var(--surface2)', border: '1px solid var(--border)', cursor: 'pointer', color: 'var(--muted)', fontSize: 11, padding: '5px 11px', borderRadius: 8, fontFamily: 'DM Mono, monospace', letterSpacing: .3 }}>
            📊 Dashboard
          </button>
          <button onClick={() => supabase.auth.signOut().then(() => router.push('/'))}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', fontSize: 11, padding: '5px 9px', borderRadius: 8, fontFamily: 'DM Mono, monospace' }}>
            Sair
          </button>
        </div>
      </header>

      {/* CONTEÚDO PRINCIPAL */}
      <main style={{ position: 'relative', zIndex: 10, width: '100%', maxWidth: 820, margin: '20px auto 60px', padding: '0 20px' }}>
        {/* CAIXA DE CONFIG */}
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, overflow: 'hidden', boxShadow: 'var(--shadow)' }}>

          {/* CABEÇALHO */}
          <div style={{ background: 'var(--surface2)', borderBottom: '1px solid var(--border)', padding: '16px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <h3 style={{ fontFamily: 'Syne, sans-serif', fontSize: 16, fontWeight: 700, color: 'var(--accent)' }}>⚙️ Configurações</h3>
            <div style={{ fontSize: 12, color: 'var(--muted)' }}>
              {perfil?.nome && `Olá, ${perfil.nome}`}
            </div>
          </div>

          {/* ABAS */}
          <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', background: 'var(--surface)', overflowX: 'auto' }}>
            {TABS.map(t => (
              <button key={t.id} onClick={() => setAbaAtiva(t.id)}
                style={{
                  flexShrink: 0, padding: '11px 14px', border: 'none', background: 'none',
                  color: abaAtiva === t.id ? 'var(--accent)' : 'var(--muted)',
                  fontFamily: 'DM Mono, monospace', fontSize: 12, cursor: 'pointer',
                  borderBottom: `2px solid ${abaAtiva === t.id ? 'var(--accent)' : 'transparent'}`,
                  letterSpacing: .3, whiteSpace: 'nowrap', transition: 'color .2s',
                  position: 'relative', top: 1
                }}>
                {t.label}
              </button>
            ))}
          </div>

          {/* CONTEÚDO DA ABA */}
          {renderAba()}
        </div>
      </main>
    </>
  )
}
