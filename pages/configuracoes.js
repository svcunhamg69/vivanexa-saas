// pages/configuracoes.js
import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/router'
import { supabase } from '../lib/supabase'

// ══════════════════════════════════════════════
// CONSTANTES
// ══════════════════════════════════════════════
const TABS = [
  { id: 'empresa', label: '🏢 Empresa' },
  { id: 'metas', label: '🎯 Metas' },
  { id: 'kpis', label: '📊 KPIs' },
  { id: 'usuarios', label: '👥 Usuários' },
  { id: 'produtos', label: '📦 Produtos' },
  { id: 'descontos', label: '🏷️ Descontos' },
  { id: 'vouchers', label: '🎫 Vouchers' },
  { id: 'documentos', label: '📄 Documentos' },
  { id: 'clientes', label: '🗃️ Clientes' },
  { id: 'tema', label: '🎨 Tema' },
]
const KPI_ICONS = ['📞','📲','📧','🤝','💼','🏆','🎯','💰','📈','📊','🔥','⭐','🚀','✅','📅','🗓','👥','🏃','💡','🎤','📝','🔔','💬','🌐','🛒','📦','🔑','⚡','🎁','🏅']
const MODULOS_PADRAO = ['Gestão Fiscal','CND','XML','BIA','IF','EP','Tributos']
const PLANOS_PADRAO = [
  { id: 'basic', nome: 'Basic', maxCnpjs: 25, usuarios: 1 },
  { id: 'pro', nome: 'Pro', maxCnpjs: 80, usuarios: 1 },
  { id: 'top', nome: 'Top', maxCnpjs: 150, usuarios: 5 },
  { id: 'topplus', nome: 'Top Plus', maxCnpjs: 999, usuarios: 999 },
]
const PRECOS_PADRAO = {
  'Gestão Fiscal': { basic:[478,318], pro:[590,409], top:[1032,547], topplus:[1398,679] },
  'CND': { basic:[0,48], pro:[0,90], top:[0,150], topplus:[0,200] },
  'XML': { basic:[478,199], pro:[590,299], top:[1032,349], topplus:[1398,399] },
  'BIA': { basic:[478,129], pro:[590,169], top:[1032,280], topplus:[1398,299] },
  'IF': { basic:[1600,379],pro:[1600,619],top:[1600,920], topplus:[1600,1100]},
  'EP': { basic:[0,39], pro:[0,82], top:[0,167], topplus:[0,200] },
  'Tributos': { basic:[0,0], pro:[0,0], top:[0,0], topplus:[0,0] },
}
const PERMISSOES_DISPONIVEIS = [
  { id: 'ver_dashboard', label: '📊 Ver Dashboard' },
  { id: 'ver_chat', label: '💬 Usar Chat' },
  { id: 'ver_configuracoes', label: '⚙️ Ver Configurações' },
  { id: 'editar_precos', label: '💲 Editar Preços' },
  { id: 'ver_historico', label: '🗂️ Ver Histórico' },
  { id: 'gerar_proposta', label: '📄 Gerar Proposta' },
  { id: 'gerar_contrato', label: '📝 Gerar Contrato' },
  { id: 'ver_clientes', label: '🗃️ Ver Clientes' },
  { id: 'gerenciar_usuarios', label: '👥 Gerenciar Usuários' },
  { id: 'ver_kpis', label: '📈 Ver KPIs' },
  { id: 'lancar_kpis', label: '✏️ Lançar KPIs diários' },
  { id: 'ver_vouchers', label: '🎫 Ver/Gerar Vouchers' },
]
const PERMISSOES_ADMIN = PERMISSOES_DISPONIVEIS.map(p => p.id)
const PERMISSOES_USER = ['ver_dashboard','ver_chat','gerar_proposta','gerar_contrato','ver_clientes','ver_historico','ver_kpis','lancar_kpis']

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
// ABA EMPRESA
// ══════════════════════════════════════════════
function TabEmpresa({ cfg, setCfg, empresaId }) {
  const [company, setCompany] = useState(cfg.company || '')
  const [slogan, setSlogan] = useState(cfg.slogan || '')
  const [logoB64, setLogoB64] = useState(cfg.logob64 || '')
  const [closeHour, setCloseHour] = useState(cfg.closeHour || 18)
  const [closeMessage, setCloseMessage] = useState(cfg.closeMessage || '')
  const [emailProvider, setEmailProvider] = useState(cfg.emailProvider || '')
  const [smtpHost, setSmtpHost] = useState(cfg.smtpHost || '')
  const [smtpPort, setSmtpPort] = useState(cfg.smtpPort || '587')
  const [smtpUser, setSmtpUser] = useState(cfg.smtpUser || '')
  const [smtpPass, setSmtpPass] = useState(cfg.smtpPass || '')
  const [emailApiKey, setEmailApiKey] = useState(cfg.emailApiKey || '')
  const [geminiApiKey, setGeminiApiKey] = useState(cfg.geminiApiKey || '')
  const [groqApiKey, setGroqApiKey] = useState(cfg.groqApiKey || '')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setCompany(cfg.company || '')
    setSlogan(cfg.slogan || '')
    setLogoB64(cfg.logob64 || '')
    setCloseHour(cfg.closeHour || 18)
    setCloseMessage(cfg.closeMessage || '')
    setEmailProvider(cfg.emailProvider || '')
    setSmtpHost(cfg.smtpHost || '')
    setSmtpPort(cfg.smtpPort || '587')
    setSmtpUser(cfg.smtpUser || '')
    setSmtpPass(cfg.smtpPass || '')
    setEmailApiKey(cfg.emailApiKey || '')
    setGeminiApiKey(cfg.geminiApiKey || '')
    setGroqApiKey(cfg.groqApiKey || '')
  }, [cfg])

  function handleLogo(e) {
    const file = e.target.files[0]
    if (!file) return
    if (file.size > 512000) { toast('Imagem muito grande (máx 500kb)', 'err'); return }
    const reader = new FileReader()
    reader.onload = ev => setLogoB64(ev.target.result.split(',')[1])
    reader.readAsDataURL(file)
  }

  function removerLogo() { setLogoB64('') }

  async function salvar() {
    setSaving(true)
    const novoCfg = {
      ...cfg,
      company, slogan, logob64: logoB64,
      closeHour, closeMessage,
      emailProvider, smtpHost, smtpPort, smtpUser, smtpPass, emailApiKey,
      geminiApiKey, groqApiKey
    }
    const { error } = await salvarStorage(empresaId, novoCfg)
    setSaving(false)
    if (error) { toast('Erro ao salvar: ' + error.message, 'err'); return }
    setCfg(novoCfg)
    toast('✅ Configurações salvas!')
  }

  return (
    <div style={s.body}>
      <div style={s.sec}>
        <div style={s.secTitle}>Identidade Visual</div>
        <div style={s.row2}>
          <div style={s.field}><label style={s.label}>Nome da Empresa</label><input style={s.input} value={company} onChange={e => setCompany(e.target.value)} placeholder="Ex: Vivanexa" /></div>
          <div style={s.field}><label style={s.label}>Slogan / Subtítulo</label><input style={s.input} value={slogan} onChange={e => setSlogan(e.target.value)} placeholder="Assistente Comercial" /></div>
        </div>
        <div style={s.field}>
          <label style={s.label}>Logomarca (PNG/JPG — máx 500kb)</label>
          <input type="file" accept="image/*" onChange={handleLogo} style={{ ...s.input, padding: '6px' }} />
        </div>
        {logoB64 ? (
          <div style={{ marginTop: 12, padding: 14, background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 10, display: 'inline-flex', flexDirection: 'column', alignItems: 'flex-start', gap: 10 }}>
            <div style={{ fontSize: 11, color: 'var(--muted)', letterSpacing: 1, textTransform: 'uppercase' }}>Pré-visualização</div>
            <img src={`data:image/png;base64,${logoB64}`} alt="Logo" style={{ height: 70, maxWidth: 280, objectFit: 'contain', borderRadius: 8, border: '1px solid var(--border)' }} />
            <button onClick={removerLogo} style={{ fontSize: 12, color: 'var(--danger)', background: 'rgba(239,68,68,.1)', border: '1px solid rgba(239,68,68,.25)', padding: '4px 10px', borderRadius: 7, cursor: 'pointer' }}>🗑 Remover logo</button>
          </div>
        ) : (
          <div style={{ marginTop: 10, padding: '14px 18px', background: 'var(--surface2)', border: '1px dashed var(--border)', borderRadius: 10, fontSize: 13, color: 'var(--muted)', textAlign: 'center' }}>Nenhuma logomarca carregada</div>
        )}
        <div style={{ ...s.secTitle, marginTop: 24 }}>Configurações da Oferta de Fechamento</div>
        <div style={s.row2}>
          <div style={s.field}><label style={s.label}>Horário limite (0-23)</label><input type="number" min={0} max={23} value={closeHour} onChange={e => setCloseHour(Number(e.target.value))} style={s.input} /></div>
          <div style={s.field}><label style={s.label}>Texto da oferta</label><input value={closeMessage} onChange={e => setCloseMessage(e.target.value)} style={s.input} placeholder="Oferta válida até as 18h de hoje" /></div>
        </div>
        <p style={{ fontSize: 12, color: 'var(--muted)', marginTop: 8 }}>A contagem regressiva será exibida no chat após o fechamento, usando o horário configurado.</p>
      </div>
      <div style={s.sec}>
        <div style={s.secTitle}>📧 Configuração de E-mail Automático</div>
        <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 12 }}>Configure as credenciais para envio de e-mails via SMTP ou API.</p>
        <div style={s.row2}>
          <div style={s.field}><label style={s.label}>Provedor (smtp/brevo/sendgrid)</label><input style={s.input} value={emailProvider} onChange={e => setEmailProvider(e.target.value)} placeholder="smtp" /></div>
          <div style={s.field}><label style={s.label}>Host SMTP</label><input style={s.input} value={smtpHost} onChange={e => setSmtpHost(e.target.value)} placeholder="smtp.gmail.com" /></div>
        </div>
        <div style={s.row2}>
          <div style={s.field}><label style={s.label}>Porta SMTP</label><input style={s.input} value={smtpPort} onChange={e => setSmtpPort(e.target.value)} placeholder="587" /></div>
          <div style={s.field}><label style={s.label}>Usuário SMTP</label><input style={s.input} value={smtpUser} onChange={e => setSmtpUser(e.target.value)} placeholder="email@dominio.com" /></div>
        </div>
        <div style={s.field}><label style={s.label}>Senha SMTP</label><input type="password" style={s.input} value={smtpPass} onChange={e => setSmtpPass(e.target.value)} placeholder="senha ou app password" /></div>
        <div style={s.field}><label style={s.label}>API Key (para Brevo/SendGrid)</label><input style={s.input} value={emailApiKey} onChange={e => setEmailApiKey(e.target.value)} placeholder="chave API" /></div>
      </div>
      <div style={s.sec}>
        <div style={s.secTitle}>🤖 Configuração de IA</div>
        <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 12 }}>Insira sua chave de API do Google Gemini ou Groq.</p>
        <div style={s.field}>
          <label style={s.label}>Chave API Google Gemini</label>
          <input style={s.input} type="password" value={geminiApiKey} onChange={e => setGeminiApiKey(e.target.value)} placeholder="AIza..." />
          <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>Obtenha em <a href="https://aistudio.google.com/apikey" target="_blank" rel="noreferrer" style={{ color: 'var(--accent)' }}>Google AI Studio</a> (gratuito)</div>
        </div>
        <div style={s.field}>
          <label style={s.label}>Chave API Groq (fallback)</label>
          <input style={s.input} type="password" value={groqApiKey} onChange={e => setGroqApiKey(e.target.value)} placeholder="gsk_..." />
          <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>Opcional. Se Gemini falhar, usa Groq.</div>
        </div>
      </div>
      <button style={s.saveBtn} onClick={salvar} disabled={saving}>{saving ? '⏳ Salvando...' : '✅ Salvar Configurações'}</button>
    </div>
  )
}

// ══════════════════════════════════════════════
// ABA METAS
// ══════════════════════════════════════════════
function TabMetas({ cfg, setCfg, empresaId }) {
  const mes = new Date().toISOString().slice(0, 7)
  const [mesRef, setMesRef] = useState(mes)
  const [metas, setMetas] = useState({})
  const [saving, setSaving] = useState(false)
  const usuarios = cfg.users || []

  useEffect(() => {
    const g = cfg.goals || []
    const map = {}
    g.filter(x => x && x.mes === mesRef).forEach(x => { map[x.userId] = x })
    setMetas(map)
  }, [mesRef, cfg.goals])

  function updateMeta(userId, campo, val) {
    setMetas(prev => ({ ...prev, [userId]: { ...(prev[userId] || { userId, mes: mesRef }), [campo]: val } }))
  }

  async function salvar() {
    setSaving(true)
    const outrasGoals = (cfg.goals || []).filter(x => x && x.mes !== mesRef)
    const novasGoals = Object.values(metas).map(m => ({ ...m, mes: mesRef }))
    const novoCfg = { ...cfg, goals: [...outrasGoals, ...novasGoals] }
    const { error } = await salvarStorage(empresaId, novoCfg)
    setSaving(false)
    if (error) { toast('Erro ao salvar', 'err'); return }
    setCfg(novoCfg)
    toast('✅ Metas salvas!')
  }

  async function adminClear(tipo) {
    if (!confirm(`Confirma zerar ${tipo}?`)) return
    let novoCfg = { ...cfg }
    if (tipo === 'historico') novoCfg.docHistory = []
    if (tipo === 'metas') novoCfg.goals = []
    if (tipo === 'clientes') novoCfg.clients = []
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
        <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 16, lineHeight: 1.6 }}>Defina metas mensais de adesão e mensalidade para cada vendedor.</p>
        <div style={{ marginBottom: 16 }}><label style={s.label}>Mês de Referência</label><input type="month" value={mesRef} onChange={e => setMesRef(e.target.value)} style={s.input} /></div>
        {usuarios.length === 0 && <p style={{ color: 'var(--muted)', fontSize: 13 }}>Nenhum usuário cadastrado. Cadastre na aba Usuários.</p>}
        {usuarios.map(u => {
          if (!u) return null
          return (
            <div key={u.id || u.username} style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 10, padding: 14, marginBottom: 10 }}>
              <div style={{ fontWeight: 600, marginBottom: 10, color: 'var(--accent)', fontSize: 14 }}>{u.nome}</div>
              <div style={s.row2}>
                <div style={s.field}><label style={s.label}>Meta Adesão (R$)</label><input type="number" style={s.input} value={metas[u.id || u.username]?.metaAdesao || ''} onChange={e => updateMeta(u.id || u.username, 'metaAdesao', e.target.value)} placeholder="0" /></div>
                <div style={s.field}><label style={s.label}>Meta Mensalidade (R$)</label><input type="number" style={s.input} value={metas[u.id || u.username]?.metaMensalidade || ''} onChange={e => updateMeta(u.id || u.username, 'metaMensalidade', e.target.value)} placeholder="0" /></div>
              </div>
            </div>
          )
        })}
        <button style={s.saveBtn} onClick={salvar} disabled={saving}>{saving ? '⏳ Salvando...' : '✅ Salvar Metas'}</button>
      </div>
      <div style={s.sec}>
        <div style={{ ...s.secTitle, color: 'var(--danger)' }}>⚠️ Área Administrativa — Limpeza de Dados</div>
        {[['historico','🗑 Zerar histórico'],['metas','🎯 Zerar metas'],['clientes','👥 Zerar clientes'],['tudo','⚠️ RESET COMPLETO']].map(([tipo, label]) => (
          <button key={tipo} onClick={() => adminClear(tipo)} style={{ display: 'block', width: '100%', marginBottom: 8, padding: '11px 14px', borderRadius: 9, background: tipo === 'tudo' ? 'rgba(239,68,68,.2)' : 'rgba(239,68,68,.1)', border: tipo === 'tudo' ? '2px solid rgba(239,68,68,.5)' : '1px solid rgba(239,68,68,.3)', color: 'var(--danger)', fontFamily: 'DM Mono, monospace', fontSize: 13, cursor: 'pointer', textAlign: 'left', fontWeight: tipo === 'tudo' ? 700 : 400 }}>{label}</button>
        ))}
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════
// ABA KPIs
// ══════════════════════════════════════════════
function TabKpis({ cfg, setCfg, empresaId }) {
  const [kpis, setKpis] = useState(cfg.kpiTemplates || [])
  const [kpiRequired, setKpiRequired] = useState(cfg.kpiRequired || false)
  const [dailyGoals, setDailyGoals] = useState(cfg.kpiDailyGoals || {})
  const [mesRef, setMesRef] = useState(new Date().toISOString().slice(0, 7))
  const [saving, setSaving] = useState(false)
  const [iconPickerId, setIconPickerId] = useState(null)
  const usuarios = cfg.users || []

  function diasUteisNoMes(yearMonth) {
    const [y, m] = yearMonth.split('-').map(Number)
    const dias = new Date(y, m, 0).getDate()
    let uteis = 0
    for (let d = 1; d <= dias; d++) {
      const dow = new Date(y, m-1, d).getDay()
      if (dow !== 0 && dow !== 6) uteis++
    }
    return uteis
  }

  const diasUteis = diasUteisNoMes(mesRef)

  function addKpi() { setKpis(prev => [...prev, { id: Date.now(), nome: '', icone: '📊', unidade: 'un' }]) }
  function updateKpi(id, campo, val) { setKpis(prev => prev.map(k => k.id === id ? { ...k, [campo]: val } : k)) }
  function removeKpi(id) { setKpis(prev => prev.filter(k => k.id !== id)); if (iconPickerId === id) setIconPickerId(null) }
  function updateDailyGoal(userId, kpiId, val) { setDailyGoals(prev => ({ ...prev, [userId]: { ...(prev[userId] || {}), [kpiId]: Number(val) || 0 } })) }

  async function salvar() {
    setSaving(true)
    const novoCfg = { ...cfg, kpiTemplates: kpis, kpiRequired, kpiDailyGoals: dailyGoals }
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
        <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 14 }}>Configure os KPIs que os vendedores irão acompanhar diariamente.</p>
        {kpis.map(k => {
          if (!k) return null
          return (
            <div key={k.id} style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 10, padding: '12px 14px', marginBottom: 10 }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: iconPickerId === k.id ? 12 : 0 }}>
                <div style={{ position: 'relative' }}>
                  <button onClick={() => setIconPickerId(iconPickerId === k.id ? null : k.id)} style={{ width: 44, height: 44, borderRadius: 10, background: 'var(--surface)', border: '1px solid var(--border)', fontSize: 22, cursor: 'pointer' }}>{k.icone}</button>
                </div>
                <input style={{ ...s.input, flex: 1 }} value={k.nome} onChange={e => updateKpi(k.id, 'nome', e.target.value)} placeholder="Nome do KPI" />
                <select style={{ ...s.input, width: 72 }} value={k.unidade || 'un'} onChange={e => updateKpi(k.id, 'unidade', e.target.value)}>
                  <option value="un">un</option>
                  <option value="R$">R$</option>
                  <option value="%">%</option>
                  <option value="h">h</option>
                </select>
                <button onClick={() => removeKpi(k.id)} style={{ padding: '8px 12px', borderRadius: 8, background: 'rgba(239,68,68,.1)', border: '1px solid rgba(239,68,68,.2)', color: 'var(--danger)', cursor: 'pointer' }}>🗑</button>
              </div>
              {iconPickerId === k.id && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, padding: '10px 0' }}>
                  {KPI_ICONS.map(ic => (
                    <button key={ic} onClick={() => { updateKpi(k.id, 'icone', ic); setIconPickerId(null) }}
                      style={{ width: 36, height: 36, borderRadius: 8, background: k.icone === ic ? 'rgba(0,212,255,.15)' : 'var(--surface)', border: `1px solid ${k.icone === ic ? 'var(--accent)' : 'var(--border)'}`, fontSize: 18, cursor: 'pointer' }}>
                      {ic}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )
        })}
        <button onClick={addKpi} style={{ padding: '10px 18px', borderRadius: 9, background: 'rgba(0,212,255,.08)', border: '1px solid rgba(0,212,255,.2)', color: 'var(--accent)', fontFamily: 'DM Mono, monospace', fontSize: 13, cursor: 'pointer', marginBottom: 16 }}>+ Adicionar KPI</button>
        <div style={{ marginBottom: 16 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, color: 'var(--text)' }}>
            <input type="checkbox" checked={kpiRequired} onChange={e => setKpiRequired(e.target.checked)} />
            Exigir lançamento diário de KPIs
          </label>
        </div>
      </div>
      {usuarios.length > 0 && (
        <div style={s.sec}>
          <div style={s.secTitle}>🎯 Metas Diárias por Usuário — {mesRef}</div>
          <div style={{ marginBottom: 14 }}>
            <label style={s.label}>Mês de Referência</label>
            <input type="month" value={mesRef} onChange={e => setMesRef(e.target.value)} style={{ ...s.input, maxWidth: 200 }} />
            <span style={{ fontSize: 12, color: 'var(--muted)', marginLeft: 10 }}>{diasUteis} dias úteis</span>
          </div>
          {usuarios.map(u => {
            if (!u) return null
            return (
              <div key={u.id || u.username} style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 10, padding: 14, marginBottom: 12 }}>
                <div style={{ fontWeight: 600, color: 'var(--accent)', fontSize: 14, marginBottom: 10 }}>{u.nome}</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px,1fr))', gap: 10 }}>
                  {kpis.map(k => {
                    if (!k || !k.nome) return null
                    const uid = u.id || u.username
                    const diaria = dailyGoals[uid]?.[k.id] || 0
                    return (
                      <div key={k.id} style={s.field}>
                        <label style={s.label}>{k.icone} {k.nome} / dia</label>
                        <input type="number" min={0} style={s.input} value={diaria || ''} onChange={e => updateDailyGoal(uid, k.id, e.target.value)} placeholder="0" />
                        {diaria > 0 && <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 3 }}>Meta mensal: {diaria * diasUteis} {k.unidade || 'un'}</div>}
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      )}
      <button style={s.saveBtn} onClick={salvar} disabled={saving}>{saving ? '⏳ Salvando...' : '✅ Salvar KPIs'}</button>
    </div>
  )
}

// ══════════════════════════════════════════════
// ABA USUÁRIOS
// ══════════════════════════════════════════════
function TabUsuarios({ cfg, setCfg, empresaId }) {
  const [users, setUsers] = useState(cfg.users || [])
  const [form, setForm] = useState(null)
  const [saving, setSaving] = useState(false)

  const perfisTipos = [
    { id: 'admin', label: 'Admin', permissoes: PERMISSOES_ADMIN },
    { id: 'vendedor', label: 'Vendedor', permissoes: PERMISSOES_USER },
    { id: 'personalizado', label: 'Personalizado', permissoes: [] },
  ]

  const emptyUser = { id: '', nome: '', email: '', username: '', password: '', tipo: 'vendedor', permissoes: [...PERMISSOES_USER] }

  function togglePermissao(perm) {
    setForm(f => {
      const perms = f.permissoes || []
      return { ...f, permissoes: perms.includes(perm) ? perms.filter(p => p !== perm) : [...perms, perm] }
    })
  }

  function aplicarPerfil(tipo) {
    const p = perfisTipos.find(x => x.id === tipo)
    setForm(f => ({ ...f, tipo, permissoes: p ? [...p.permissoes] : [] }))
  }

  async function salvarUser() {
    if (!form.nome || !form.email) { toast('Nome e e-mail obrigatórios', 'err'); return }
    setSaving(true)
    let novos
    if (form.id) {
      novos = users.map(u => u.id === form.id ? form : u)
    } else {
      const novo = { ...form, id: Date.now().toString() }
      novos = [...users, novo]
    }
    const novoCfg = { ...cfg, users: novos }
    const { error } = await salvarStorage(empresaId, novoCfg)
    setSaving(false)
    if (error) { toast('Erro ao salvar', 'err'); return }
    setUsers(novos)
    setCfg(novoCfg)
    setForm(null)
    toast('✅ Usuário salvo!')
  }

  async function removerUser(id) {
    if (!confirm('Remover usuário?')) return
    const novos = users.filter(u => u.id !== id)
    const novoCfg = { ...cfg, users: novos }
    await salvarStorage(empresaId, novoCfg)
    setUsers(novos)
    setCfg(novoCfg)
    toast('🗑 Usuário removido!')
  }

  return (
    <div style={s.body}>
      <div style={s.sec}>
        <div style={s.secTitle}>Usuários Cadastrados</div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 14 }}>
          <button onClick={() => setForm(emptyUser)} style={{ padding: '10px 16px', borderRadius: 9, background: 'rgba(0,212,255,.1)', border: '1px solid rgba(0,212,255,.25)', color: 'var(--accent)', fontFamily: 'DM Mono, monospace', fontSize: 12, cursor: 'pointer' }}>+ Novo Usuário</button>
        </div>
        {users.length === 0 && !form && <p style={{ color: 'var(--muted)', fontSize: 13 }}>Nenhum usuário cadastrado.</p>}
        {users.map(u => {
          if (!u) return null
          return (
            <div key={u.id} style={{ padding: '12px 16px', background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 10, display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, color: 'var(--accent)', fontSize: 14 }}>{u.nome}</div>
                <div style={{ fontSize: 12, color: 'var(--muted)' }}>{u.email} · {u.tipo || 'vendedor'}</div>
              </div>
              <button onClick={() => setForm({ ...u })} style={{ padding: '5px 10px', borderRadius: 7, background: 'rgba(0,212,255,.1)', border: '1px solid rgba(0,212,255,.2)', color: 'var(--accent)' }}>✏️</button>
              <button onClick={() => removerUser(u.id)} style={{ padding: '5px 10px', borderRadius: 7, background: 'rgba(239,68,68,.1)', border: '1px solid rgba(239,68,68,.2)', color: 'var(--danger)' }}>🗑</button>
            </div>
          )
        })}
      </div>
      {form && (
        <div style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 12, padding: 18, marginTop: 8 }}>
          <div style={{ ...s.secTitle, marginBottom: 14 }}>Dados do Usuário</div>
          <div style={s.row2}>
            <div style={s.field}><label style={s.label}>Nome</label><input style={s.input} value={form.nome} onChange={e => setForm(f => ({ ...f, nome: e.target.value }))} /></div>
            <div style={s.field}><label style={s.label}>E-mail</label><input type="email" style={s.input} value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} /></div>
          </div>
          <div style={s.row2}>
            <div style={s.field}><label style={s.label}>Username (login)</label><input style={s.input} value={form.username || ''} onChange={e => setForm(f => ({ ...f, username: e.target.value }))} /></div>
            <div style={s.field}><label style={s.label}>Senha</label><input type="password" style={s.input} value={form.password || ''} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} /></div>
          </div>
          <div style={s.field}>
            <label style={s.label}>Perfil de Acesso</label>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
              {perfisTipos.map(p => (
                <button key={p.id} onClick={() => aplicarPerfil(p.id)}
                  style={{ padding: '7px 14px', borderRadius: 8, border: `1px solid ${form.tipo === p.id ? 'var(--accent)' : 'var(--border)'}`, background: form.tipo === p.id ? 'rgba(0,212,255,.1)' : 'var(--surface)', color: form.tipo === p.id ? 'var(--accent)' : 'var(--muted)', fontFamily: 'DM Mono, monospace', fontSize: 12, cursor: 'pointer' }}>
                  {p.label}
                </button>
              ))}
            </div>
          </div>
          <div style={s.field}>
            <label style={s.label}>Permissões</label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
              {PERMISSOES_DISPONIVEIS.map(p => (
                <label key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 12, color: 'var(--text)', padding: '6px 10px', background: (form.permissoes || []).includes(p.id) ? 'rgba(0,212,255,.06)' : 'transparent', borderRadius: 6, border: `1px solid ${(form.permissoes || []).includes(p.id) ? 'rgba(0,212,255,.2)' : 'transparent'}` }}>
                  <input type="checkbox" checked={(form.permissoes || []).includes(p.id)} onChange={() => togglePermissao(p.id)} />
                  {p.label}
                </label>
              ))}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
            <button style={s.saveBtn} onClick={salvarUser} disabled={saving}>{saving ? '⏳...' : '✅ Salvar Usuário'}</button>
            <button onClick={() => setForm(null)} style={{ padding: '11px 18px', borderRadius: 10, background: 'rgba(100,116,139,.12)', border: '1px solid rgba(100,116,139,.3)', color: 'var(--muted)', fontFamily: 'DM Mono, monospace', fontSize: 13, cursor: 'pointer' }}>Cancelar</button>
          </div>
        </div>
      )}
    </div>
  )
}

// ══════════════════════════════════════════════
// ABA PRODUTOS
// ══════════════════════════════════════════════
function TabProdutos({ cfg, setCfg, empresaId }) {
  const [modulos, setModulos] = useState(cfg.modulos || MODULOS_PADRAO)
  const [planos, setPlanos] = useState(cfg.plans || PLANOS_PADRAO)
  const [precos, setPrecos] = useState(cfg.prices || PRECOS_PADRAO)
  const [novoMod, setNovoMod] = useState('')
  const [saving, setSaving] = useState(false)

  function addModulo() {
    if (!novoMod.trim()) return
    setModulos(prev => [...prev, novoMod.trim()])
    setPrecos(prev => ({ ...prev, [novoMod.trim()]: { basic:[0,0], pro:[0,0], top:[0,0], topplus:[0,0] } }))
    setNovoMod('')
  }

  function removeModulo(mod) {
    setModulos(prev => prev.filter(m => m !== mod))
    setPrecos(prev => { const n = {...prev}; delete n[mod]; return n })
  }

  function updatePreco(mod, plano, idx, val) {
    setPrecos(prev => {
      const n = { ...prev }
      if (!n[mod]) n[mod] = {}
      if (!n[mod][plano]) n[mod][plano] = [0, 0]
      n[mod][plano] = [...n[mod][plano]]
      n[mod][plano][idx] = Number(val) || 0
      return n
    })
  }

  async function salvar() {
    setSaving(true)
    const novoCfg = { ...cfg, modulos, plans: planos, prices: precos }
    const { error } = await salvarStorage(empresaId, novoCfg)
    setSaving(false)
    if (error) { toast('Erro ao salvar', 'err'); return }
    setCfg(novoCfg)
    toast('✅ Produtos salvos!')
  }

  return (
    <div style={s.body}>
      <div style={s.sec}>
        <div style={s.secTitle}>📦 Módulos / Produtos</div>
        <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
          <input style={{ ...s.input, flex: 1 }} value={novoMod} onChange={e => setNovoMod(e.target.value)} placeholder="Nome do novo módulo" onKeyDown={e => e.key === 'Enter' && addModulo()} />
          <button onClick={addModulo} style={{ padding: '9px 16px', borderRadius: 9, background: 'rgba(0,212,255,.1)', border: '1px solid rgba(0,212,255,.25)', color: 'var(--accent)', fontFamily: 'DM Mono, monospace', fontSize: 13, cursor: 'pointer', whiteSpace: 'nowrap' }}>+ Adicionar</button>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 20 }}>
          {modulos.map(mod => (
            <div key={mod} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 20 }}>
              <span style={{ fontSize: 13 }}>{mod}</span>
              <button onClick={() => removeModulo(mod)} style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', fontSize: 14, lineHeight: 1 }}>×</button>
            </div>
          ))}
        </div>
      </div>
      <div style={s.sec}>
        <div style={s.secTitle}>💰 Tabela de Preços</div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, minWidth: 600 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                <th style={{ padding: '8px 12px', textAlign: 'left', color: 'var(--muted)', fontWeight: 500 }}>Módulo</th>
                {planos.map(p => (
                  <th key={p.id} colSpan={2} style={{ padding: '8px 12px', textAlign: 'center', color: 'var(--muted)', fontWeight: 500 }}>{p.nome}</th>
                ))}
              </tr>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                <th></th>
                {planos.map(p => (
                  <>
                    <th key={`${p.id}-ad`} style={{ padding: '4px 8px', textAlign: 'center', color: 'var(--muted)', fontSize: 10, fontWeight: 400 }}>Adesão</th>
                    <th key={`${p.id}-men`} style={{ padding: '4px 8px', textAlign: 'center', color: 'var(--muted)', fontSize: 10, fontWeight: 400 }}>Mensal</th>
                  </>
                ))}
              </tr>
            </thead>
            <tbody>
              {modulos.map(mod => (
                <tr key={mod} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '8px 12px', fontWeight: 600, fontSize: 13 }}>{mod}</td>
                  {planos.map(p => (
                    <>
                      <td key={`${p.id}-ad`} style={{ padding: '6px 8px' }}>
                        <input type="number" min={0} value={precos[mod]?.[p.id]?.[0] ?? 0}
                          onChange={e => updatePreco(mod, p.id, 0, e.target.value)}
                          style={{ ...s.input, padding: '5px 8px', width: 80, fontSize: 12 }} />
                      </td>
                      <td key={`${p.id}-men`} style={{ padding: '6px 8px' }}>
                        <input type="number" min={0} value={precos[mod]?.[p.id]?.[1] ?? 0}
                          onChange={e => updatePreco(mod, p.id, 1, e.target.value)}
                          style={{ ...s.input, padding: '5px 8px', width: 80, fontSize: 12 }} />
                      </td>
                    </>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <button style={s.saveBtn} onClick={salvar} disabled={saving}>{saving ? '⏳ Salvando...' : '✅ Salvar Produtos'}</button>
    </div>
  )
}

// ══════════════════════════════════════════════
// ABA DESCONTOS
// ══════════════════════════════════════════════
function TabDescontos({ cfg, setCfg, empresaId }) {
  const [regras, setRegras] = useState(cfg.discountRules || [])
  const [saving, setSaving] = useState(false)

  function addRegra() {
    setRegras(prev => [...prev, { id: Date.now(), nome: '', pctAdesao: 0, pctMensalidade: 0, condicao: '' }])
  }

  function updateRegra(id, campo, val) {
    setRegras(prev => prev.map(r => r.id === id ? { ...r, [campo]: val } : r))
  }

  function removeRegra(id) {
    setRegras(prev => prev.filter(r => r.id !== id))
  }

  async function salvar() {
    setSaving(true)
    const novoCfg = { ...cfg, discountRules: regras }
    const { error } = await salvarStorage(empresaId, novoCfg)
    setSaving(false)
    if (error) { toast('Erro ao salvar', 'err'); return }
    setCfg(novoCfg)
    toast('✅ Descontos salvos!')
  }

  return (
    <div style={s.body}>
      <div style={s.sec}>
        <div style={s.secTitle}>🏷️ Regras de Desconto</div>
        <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 14 }}>Configure descontos que podem ser aplicados nas propostas.</p>
        {regras.map(r => {
          if (!r) return null
          return (
            <div key={r.id} style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 10, padding: 14, marginBottom: 10 }}>
              <div style={s.row2}>
                <div style={s.field}><label style={s.label}>Nome do Desconto</label><input style={s.input} value={r.nome} onChange={e => updateRegra(r.id, 'nome', e.target.value)} placeholder="Ex: Desconto Parceiro" /></div>
                <div style={s.field}><label style={s.label}>Condição</label><input style={s.input} value={r.condicao} onChange={e => updateRegra(r.id, 'condicao', e.target.value)} placeholder="Ex: Acima de 50 CNPJs" /></div>
              </div>
              <div style={s.row2}>
                <div style={s.field}><label style={s.label}>% Desconto Adesão</label><input type="number" min={0} max={100} style={s.input} value={r.pctAdesao} onChange={e => updateRegra(r.id, 'pctAdesao', e.target.value)} /></div>
                <div style={s.field}><label style={s.label}>% Desconto Mensalidade</label><input type="number" min={0} max={100} style={s.input} value={r.pctMensalidade} onChange={e => updateRegra(r.id, 'pctMensalidade', e.target.value)} /></div>
              </div>
              <button onClick={() => removeRegra(r.id)} style={{ padding: '5px 12px', borderRadius: 7, background: 'rgba(239,68,68,.1)', border: '1px solid rgba(239,68,68,.2)', color: 'var(--danger)', cursor: 'pointer', fontSize: 12 }}>🗑 Remover</button>
            </div>
          )
        })}
        <button onClick={addRegra} style={{ padding: '10px 18px', borderRadius: 9, background: 'rgba(0,212,255,.08)', border: '1px solid rgba(0,212,255,.2)', color: 'var(--accent)', fontFamily: 'DM Mono, monospace', fontSize: 13, cursor: 'pointer', marginBottom: 16 }}>+ Adicionar Desconto</button>
      </div>
      <button style={s.saveBtn} onClick={salvar} disabled={saving}>{saving ? '⏳ Salvando...' : '✅ Salvar Descontos'}</button>
    </div>
  )
}

// ══════════════════════════════════════════════
// ABA VOUCHERS
// ══════════════════════════════════════════════
function TabVouchers({ cfg, setCfg, empresaId }) {
  const [vouchers, setVouchers] = useState(cfg.vouchers || [])
  const [prefixo, setPrefixo] = useState('PROMO')
  const [vda, setVda] = useState(0)
  const [vdm, setVdm] = useState(0)
  const [vdate, setVdate] = useState('')
  const [ultimo, setUltimo] = useState(null)

  async function gerarVoucher() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
    const code = Array.from({length: 6}, () => chars[Math.floor(Math.random() * chars.length)]).join('')
    const novo = {
      id: Date.now().toString(),
      codigo: `${prefixo}-${code}`,
      pctAdesao: Number(vda) || 0,
      pctMensalidade: Number(vdm) || 0,
      comemoracao: vdate,
      criado: new Date().toISOString()
    }
    const novos = [...vouchers, novo]
    const novoCfg = { ...cfg, vouchers: novos }
    await salvarStorage(empresaId, novoCfg)
    setVouchers(novos)
    setCfg(novoCfg)
    setUltimo(novo)
  }

  async function removerVoucher(id) {
    const novos = vouchers.filter(v => v.id !== id)
    const novoCfg = { ...cfg, vouchers: novos }
    await salvarStorage(empresaId, novoCfg)
    setVouchers(novos)
    setCfg(novoCfg)
  }

  function imprimirVoucher(v) {
    const empresa = cfg.company || 'Vivanexa'
    const criado = v.criado ? new Date(v.criado).toLocaleDateString('pt-BR') : ''
    const win = window.open('', '_blank', 'width=420,height=600')
    win.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Voucher ${v.codigo}</title>
    <style>body{margin:0;background:#0a0f1e;display:flex;align-items:center;justify-content:center;min-height:100vh;font-family:'DM Mono',monospace}
    .card{background:linear-gradient(135deg,#111827,#1a2540);border:1px solid #1e2d4a;border-radius:20px;padding:32px;width:340px;color:#e2e8f0}
    .top{font-size:11px;color:#64748b;letter-spacing:2px;text-transform:uppercase;margin-bottom:20px}
    .comemoracao{font-size:22px;font-weight:800;color:#00d4ff;margin-bottom:8px;font-family:Syne,sans-serif}
    .title{font-size:12px;color:#64748b;letter-spacing:1px;text-transform:uppercase;margin-bottom:8px}
    .code{font-size:28px;font-weight:800;letter-spacing:4px;color:#10b981;margin-bottom:20px}
    .divider{border:none;border-top:1px solid #1e2d4a;margin:16px 0}
    .benefits{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:20px}
    .benefit{text-align:center;padding:12px;background:rgba(0,212,255,.05);border:1px solid rgba(0,212,255,.1);border-radius:10px}
    .benefit-val{font-size:24px;font-weight:800;color:#00d4ff;font-family:Syne,sans-serif}
    .benefit-label{font-size:10px;color:#64748b;margin-top:4px}
    .footer{display:flex;justify-content:space-between;align-items:flex-end}
    .footer-info{font-size:11px;color:#64748b;line-height:1.6}
    </style></head><body><div class="card">
    <div class="top">${empresa}</div>
    ${v.comemoracao ? `<div class="comemoracao">${v.comemoracao}</div>` : ''}
    <div class="title">Código de Desconto Exclusivo</div>
    <div class="code">${v.codigo}</div>
    <hr class="divider">
    <div class="benefits">
    ${v.pctAdesao > 0 ? `<div class="benefit"><div class="benefit-val">${v.pctAdesao}%</div><div class="benefit-label">Desconto na Adesão</div></div>` : ''}
    ${v.pctMensalidade > 0 ? `<div class="benefit"><div class="benefit-val">${v.pctMensalidade}%</div><div class="benefit-label">Desconto na Mensalidade</div></div>` : ''}
    ${v.pctAdesao === 0 && v.pctMensalidade === 0 ? `<div class="benefit" style="grid-column:span 2"><div class="benefit-val">🎁</div><div class="benefit-label">Voucher especial</div></div>` : ''}
    </div>
    <div class="footer"><div class="footer-info">Emitido em: ${criado}<br>${empresa}</div><div style="font-size:11px;color:#334155">Código único</div></div>
    </div></body></html>`)
    win.document.close()
    win.focus()
  }

  return (
    <div style={s.body}>
      <div style={s.sec}>
        <div style={s.secTitle}>Gerar Novo Voucher</div>
        <div style={s.row4}>
          <div style={s.field}><label style={s.label}>Prefixo</label><input style={{ ...s.input, textTransform: 'uppercase' }} maxLength={8} value={prefixo} onChange={e => setPrefixo(e.target.value.toUpperCase())} placeholder="PROMO" /></div>
          <div style={s.field}><label style={s.label}>% Adesão</label><input type="number" style={s.input} min={0} max={100} value={vda} onChange={e => setVda(e.target.value)} /></div>
          <div style={s.field}><label style={s.label}>% Mensalidade</label><input type="number" style={s.input} min={0} max={100} value={vdm} onChange={e => setVdm(e.target.value)} /></div>
          <div style={s.field}><label style={s.label}>Data comemorativa</label><input style={s.input} value={vdate} onChange={e => setVdate(e.target.value)} placeholder="Ex: Natal 2025" /></div>
        </div>
        <button onClick={gerarVoucher} style={{ padding: '10px 18px', borderRadius: 9, background: 'rgba(0,212,255,.15)', border: '1px solid rgba(0,212,255,.3)', color: 'var(--accent)', fontFamily: 'DM Mono, monospace', fontSize: 13, fontWeight: 600, cursor: 'pointer', marginTop: 8 }}>🎫 Gerar Voucher</button>
        {ultimo && (
          <div style={{ marginTop: 14, padding: 16, background: 'rgba(16,185,129,.08)', border: '1px solid rgba(16,185,129,.25)', borderRadius: 12 }}>
            <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 6, letterSpacing: 1, textTransform: 'uppercase' }}>Voucher gerado!</div>
            <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--accent3)', letterSpacing: 4, fontFamily: 'DM Mono, monospace', marginBottom: 8 }}>{ultimo.codigo}</div>
            <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 12 }}>Adesão: {ultimo.pctAdesao}% · Mensal: {ultimo.pctMensalidade}%{ultimo.comemoracao && ` · ${ultimo.comemoracao}`}</div>
            <button onClick={() => imprimirVoucher(ultimo)} style={{ padding: '9px 18px', borderRadius: 9, background: 'linear-gradient(135deg,#0f172a,#1e3a5f)', border: '1px solid rgba(0,212,255,.3)', color: '#00d4ff', fontFamily: 'DM Mono, monospace', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>🖨 Imprimir PDF</button>
          </div>
        )}
      </div>
      <div style={s.sec}>
        <div style={s.secTitle}>Vouchers Ativos</div>
        {vouchers.length === 0 && <p style={{ color: 'var(--muted)', fontSize: 13 }}>Nenhum voucher cadastrado.</p>}
        {vouchers.map(v => {
          if (!v) return null
          return (
            <div key={v.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 10, marginBottom: 8 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, color: 'var(--accent)', fontFamily: 'DM Mono, monospace', letterSpacing: 2, fontSize: 15 }}>{v.codigo}</div>
                <div style={{ fontSize: 12, color: 'var(--muted)' }}>Adesão {v.pctAdesao}% · Mensal {v.pctMensalidade}%{v.comemoracao && ` · ${v.comemoracao}`} · {v.criado && new Date(v.criado).toLocaleDateString('pt-BR')}</div>
              </div>
              <button onClick={() => imprimirVoucher(v)} style={{ padding: '6px 12px', borderRadius: 7, background: 'rgba(0,212,255,.08)', border: '1px solid rgba(0,212,255,.2)', color: 'var(--accent)', cursor: 'pointer', fontFamily: 'DM Mono, monospace', fontSize: 12, whiteSpace: 'nowrap' }}>🖨 PDF</button>
              <button onClick={() => removerVoucher(v.id)} style={{ padding: '6px 10px', borderRadius: 7, background: 'rgba(239,68,68,.1)', border: '1px solid rgba(239,68,68,.2)', color: 'var(--danger)', cursor: 'pointer' }}>🗑</button>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════
// ABA DOCUMENTOS
// ══════════════════════════════════════════════
function TabDocumentos({ cfg, setCfg, empresaId }) {
  const [emailRem, setEmailRem] = useState(cfg.signConfig?.email || '')
  const [wpp, setWpp] = useState(cfg.signConfig?.wpp || '')
  const [urlBase, setUrlBase] = useState(cfg.signConfig?.url || '')
  const [propostaTemplate, setPropostaTemplate] = useState(cfg.docTemplates?.proposta || '')
  const [contratoTemplate, setContratoTemplate] = useState(cfg.docTemplates?.contrato || '')
  const [saving, setSaving] = useState(false)
  const [testando, setTestando] = useState(false)

  function handleFileUpload(type, e) {
    const file = e.target.files[0]
    if (!file) return
    if (file.size > 2 * 1024 * 1024) { toast('Arquivo muito grande (máx 2MB)', 'err'); return }
    const reader = new FileReader()
    reader.onload = ev => {
      const content = ev.target.result
      if (type === 'proposta') setPropostaTemplate(content)
      else setContratoTemplate(content)
    }
    reader.readAsText(file)
  }

  async function salvar() {
    setSaving(true)
    const novoCfg = {
      ...cfg,
      signConfig: { email: emailRem, wpp, url: urlBase },
      docTemplates: { proposta: propostaTemplate, contrato: contratoTemplate }
    }
    const { error } = await salvarStorage(empresaId, novoCfg)
    setSaving(false)
    if (error) { toast('Erro ao salvar', 'err'); return }
    setCfg(novoCfg)
    toast('✅ Configurações salvas!')
  }

  async function testarConexao() {
    setTestando(true)
    const { error } = await supabase.from('vx_storage').select('key').limit(1)
    setTestando(false)
    if (error) toast('❌ Falha: ' + error.message, 'err')
    else toast('✅ Conexão com Supabase OK!')
  }

  return (
    <div style={s.body}>
      <div style={s.sec}>
        <div style={s.secTitle}>✍️ Modelos de Documentos</div>
        <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 12 }}>Personalize os modelos de proposta e contrato. Deixe vazio para usar os padrões.</p>
        <div style={{ marginBottom: 20 }}>
          <div style={{ ...s.secTitle, marginBottom: 8 }}>Modelo de Proposta</div>
          <textarea rows={8} style={{ ...s.input, fontFamily: 'monospace', fontSize: 12 }} value={propostaTemplate} onChange={e => setPropostaTemplate(e.target.value)} placeholder="Use HTML e variáveis como {{empresa}}, {{total_adesao}}, etc." />
          <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
            <label style={{ fontSize: 11, color: 'var(--muted)', cursor: 'pointer', background: 'rgba(0,212,255,.1)', padding: '4px 12px', borderRadius: 6, border: '1px solid rgba(0,212,255,.25)' }}>
              📂 Importar arquivo (.txt, .html)
              <input type="file" accept=".txt,.html,.htm" onChange={e => handleFileUpload('proposta', e)} style={{ display: 'none' }} />
            </label>
            <span style={{ fontSize: 11, color: 'var(--muted)' }}>ou cole o HTML diretamente acima</span>
          </div>
        </div>
        <div style={{ marginBottom: 20 }}>
          <div style={{ ...s.secTitle, marginBottom: 8 }}>Modelo de Contrato</div>
          <textarea rows={8} style={{ ...s.input, fontFamily: 'monospace', fontSize: 12 }} value={contratoTemplate} onChange={e => setContratoTemplate(e.target.value)} placeholder="Use HTML e variáveis como {{empresa}}, {{total_adesao}}, etc." />
          <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
            <label style={{ fontSize: 11, color: 'var(--muted)', cursor: 'pointer', background: 'rgba(0,212,255,.1)', padding: '4px 12px', borderRadius: 6, border: '1px solid rgba(0,212,255,.25)' }}>
              📂 Importar arquivo (.txt, .html)
              <input type="file" accept=".txt,.html,.htm" onChange={e => handleFileUpload('contrato', e)} style={{ display: 'none' }} />
            </label>
            <span style={{ fontSize: 11, color: 'var(--muted)' }}>ou cole o HTML diretamente acima</span>
          </div>
        </div>
        <div style={{ background: 'var(--surface2)', padding: '12px 16px', borderRadius: 8, marginBottom: 16 }}>
          <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 8, color: 'var(--accent)' }}>Variáveis disponíveis:</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, fontSize: 11, color: 'var(--muted)' }}>
            <div><code>{'{{empresa}}'}</code> - Nome fantasia</div><div><code>{'{{razao}}'}</code> - Razão social</div><div><code>{'{{cnpj}}'}</code> - CNPJ</div>
            <div><code>{'{{contato}}'}</code> - Nome do contato</div><div><code>{'{{email}}'}</code> - E-mail</div><div><code>{'{{telefone}}'}</code> - Telefone</div>
            <div><code>{'{{endereco}}'}</code> - Endereço</div><div><code>{'{{regime}}'}</code> - Regime</div><div><code>{'{{plano}}'}</code> - Plano</div>
            <div><code>{'{{total_adesao}}'}</code> - Total adesão</div><div><code>{'{{total_mensal}}'}</code> - Total mensal</div><div><code>{'{{data_hora}}'}</code> - Data atual</div>
            <div><code>{'{{condicao_pagamento}}'}</code> - Condição</div><div><code>{'{{vencimento_adesao}}'}</code> - Venc. adesão</div><div><code>{'{{vencimento_mensal}}'}</code> - Venc. mensal</div>
            <div><code>{'{{cnpjs_qty}}'}</code> - Qtd. CNPJs</div><div><code>{'{{consultor_nome}}'}</code> - Consultor</div><div><code>{'{{company}}'}</code> - Empresa</div>
            <div><code>{'{{produtos_tabela}}'}</code> - Tabela HTML</div><div><code>{'{{produtos_lista}}'}</code> - Lista vertical</div><div><code>{'{{logo}}'}</code> - Logo base64</div>
          </div>
        </div>
      </div>
      <div style={s.sec}>
        <div style={s.secTitle}>Configurações de Assinatura Eletrônica</div>
        <div style={s.row2}>
          <div style={s.field}><label style={s.label}>E-mail remetente</label><input type="email" style={s.input} value={emailRem} onChange={e => setEmailRem(e.target.value)} placeholder="noreply@vivanexa.com.br" /></div>
          <div style={s.field}><label style={s.label}>WhatsApp da empresa</label><input style={s.input} value={wpp} onChange={e => setWpp(e.target.value)} placeholder="5569984059125" /></div>
        </div>
        <div style={s.field}><label style={s.label}>URL base do sistema</label><input style={s.input} value={urlBase} onChange={e => setUrlBase(e.target.value)} placeholder="https://seusite.com/sign" /></div>
        <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
          <button style={s.saveBtn} onClick={salvar} disabled={saving}>{saving ? '⏳...' : '✅ Salvar'}</button>
          <button onClick={testarConexao} disabled={testando} style={{ padding: '11px 18px', borderRadius: 10, background: 'rgba(0,212,255,.1)', border: '1px solid rgba(0,212,255,.3)', color: 'var(--accent)', fontFamily: 'DM Mono, monospace', fontSize: 13, cursor: 'pointer' }}>{testando ? '⏳...' : '🔌 Testar Conexão'}</button>
        </div>
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════
// ABA CLIENTES
// ══════════════════════════════════════════════
function TabClientes({ cfg, setCfg, empresaId }) {
  const [busca, setBusca] = useState('')
  const [form, setForm] = useState(null)
  const [saving, setSaving] = useState(false)
  const clientes = cfg.clients || []
  const filtrados = busca.trim() ? clientes.filter(c => c && (c.nome?.toLowerCase().includes(busca.toLowerCase()) || c.cnpj?.includes(busca) || c.cpf?.includes(busca))) : clientes
  const emptyClient = { id: '', nome: '', cnpj: '', cpf: '', email: '', telefone: '', cidade: '' }

  function isDuplicate(formData) {
    return clientes.some(c => {
      if (!c || c.id === formData.id) return false
      if (formData.cnpj && c.cnpj === formData.cnpj) return true
      if (formData.cpf && c.cpf === formData.cpf) return true
      if (formData.email && c.email === formData.email) return true
      return false
    })
  }

  async function salvarCliente() {
    if (!form.nome) { toast('Nome obrigatório', 'err'); return }
    if (isDuplicate(form)) { toast('Cliente já cadastrado com esse CNPJ/CPF ou e-mail.', 'err'); return }
    setSaving(true)
    let novos = form.id ? clientes.map(c => c.id === form.id ? form : c) : [...clientes, { ...form, id: Date.now().toString() }]
    const novoCfg = { ...cfg, clients: novos }
    const { error } = await salvarStorage(empresaId, novoCfg)
    setSaving(false)
    if (error) { toast('Erro ao salvar', 'err'); return }
    setCfg(novoCfg); setForm(null); toast('✅ Cliente salvo!')
  }

  async function removerCliente(id) {
    if (!confirm('Remover cliente?')) return
    const novos = clientes.filter(c => c.id !== id)
    const novoCfg = { ...cfg, clients: novos }
    await salvarStorage(empresaId, novoCfg)
    setCfg(novoCfg); toast('🗑 Cliente removido!')
  }

  return (
    <div style={s.body}>
      <div style={s.sec}>
        <div style={s.secTitle}>Clientes Cadastrados</div>
        <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
          <input style={{ ...s.input, flex: 1 }} placeholder="CNPJ, CPF ou nome..." value={busca} onChange={e => setBusca(e.target.value)} />
          <button onClick={() => setForm(emptyClient)} style={{ padding: '10px 16px', borderRadius: 9, background: 'rgba(0,212,255,.1)', border: '1px solid rgba(0,212,255,.25)', color: 'var(--accent)', fontFamily: 'DM Mono, monospace', fontSize: 12, cursor: 'pointer', whiteSpace: 'nowrap' }}>+ Novo Cliente</button>
        </div>
        {filtrados.length === 0 && !form && <p style={{ color: 'var(--muted)' }}>Nenhum cliente encontrado.</p>}
        {filtrados.map(c => {
          if (!c) return null
          return (
            <div key={c.id} style={{ padding: '12px 16px', background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 10, display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, color: 'var(--accent)', fontSize: 14 }}>{c.nome}</div>
                <div style={{ fontSize: 12, color: 'var(--muted)' }}>{c.cnpj && `CNPJ: ${c.cnpj} · `}{c.cidade && c.cidade}</div>
              </div>
              <button onClick={() => setForm({ ...c })} style={{ padding: '5px 10px', borderRadius: 7, background: 'rgba(0,212,255,.1)', border: '1px solid rgba(0,212,255,.2)', color: 'var(--accent)' }}>✏️</button>
              <button onClick={() => removerCliente(c.id)} style={{ padding: '5px 10px', borderRadius: 7, background: 'rgba(239,68,68,.1)', border: '1px solid rgba(239,68,68,.2)', color: 'var(--danger)' }}>🗑</button>
            </div>
          )
        })}
      </div>
      {form && (
        <div style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 12, padding: 18, marginTop: 8 }}>
          <div style={{ ...s.secTitle, marginBottom: 14 }}>Dados do Cliente</div>
          <div style={s.row2}>
            <div style={s.field}><label style={s.label}>Nome / Razão Social</label><input style={s.input} value={form.nome} onChange={e => setForm(f => ({ ...f, nome: e.target.value }))} /></div>
            <div style={s.field}><label style={s.label}>CNPJ</label><input style={s.input} value={form.cnpj} onChange={e => setForm(f => ({ ...f, cnpj: e.target.value }))} /></div>
          </div>
          <div style={s.row2}>
            <div style={s.field}><label style={s.label}>E-mail</label><input type="email" style={s.input} value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} /></div>
            <div style={s.field}><label style={s.label}>Telefone</label><input style={s.input} value={form.telefone} onChange={e => setForm(f => ({ ...f, telefone: e.target.value }))} /></div>
          </div>
          <div style={s.field}><label style={s.label}>Cidade / Estado</label><input style={s.input} value={form.cidade} onChange={e => setForm(f => ({ ...f, cidade: e.target.value }))} /></div>
          <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
            <button style={s.saveBtn} onClick={salvarCliente} disabled={saving}>{saving ? '⏳...' : '✅ Salvar Cliente'}</button>
            <button onClick={() => setForm(null)} style={{ padding: '11px 18px', borderRadius: 10, background: 'rgba(100,116,139,.12)', border: '1px solid rgba(100,116,139,.3)', color: 'var(--muted)', fontFamily: 'DM Mono, monospace', fontSize: 13, cursor: 'pointer' }}>Cancelar</button>
          </div>
        </div>
      )}
    </div>
  )
}

// ══════════════════════════════════════════════
// ABA TEMA
// ══════════════════════════════════════════════
function TabTema({ cfg, setCfg, empresaId }) {
  const [tema, setTema] = useState(cfg.theme || 'dark')

  async function aplicarTema(t) {
    setTema(t)
    document.documentElement.setAttribute('data-theme', t)
    const novoCfg = { ...cfg, theme: t }
    await salvarStorage(empresaId, novoCfg)
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
        {[['dark','🌙 Tema Escuro','Fundo escuro'],['light','☀️ Tema Claro','Fundo branco']].map(([t, title, sub]) => (
          <div key={t} style={temaStyle(t)} onClick={() => aplicarTema(t)}>
            <div><div style={{ fontSize: 14, fontWeight: 600 }}>{title}</div><div style={{ fontSize: 12, color: 'var(--muted)' }}>{sub}</div></div>
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
  body: { padding: '20px 24px' },
  sec: { marginBottom: 24 },
  secTitle: { fontSize: 11, letterSpacing: '1.5px', color: 'var(--muted)', textTransform: 'uppercase', marginBottom: 12, paddingBottom: 8, borderBottom: '1px solid var(--border)' },
  label: { fontSize: 12, color: 'var(--muted)', display: 'block', marginBottom: 4, letterSpacing: '.5px' },
  input: { width: '100%', background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 8, padding: '9px 12px', fontFamily: 'DM Mono, monospace', fontSize: 13, color: 'var(--text)', outline: 'none' },
  field: { marginBottom: 12 },
  row2: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 4 },
  row3: { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 12 },
  row4: { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 12, marginBottom: 12 },
  saveBtn: { padding: '11px 22px', borderRadius: 10, background: 'linear-gradient(135deg,var(--accent),#0099bb)', border: 'none', color: '#fff', fontFamily: 'DM Mono, monospace', fontSize: 14, fontWeight: 600, cursor: 'pointer', letterSpacing: '.5px' },
}

// ══════════════════════════════════════════════
// PÁGINA PRINCIPAL
// ══════════════════════════════════════════════
export default function Configuracoes() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [perfil, setPerfil] = useState(null)
  const [empresaId, setEmpresaId] = useState(null)
  const [cfg, setCfg] = useState({})
  const [abaAtiva, setAbaAtiva] = useState('empresa')

  useEffect(() => {
    async function init() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.push('/'); return }

      let { data: perf, error } = await supabase
        .from('perfis')
        .select('*')
        .eq('user_id', session.user.id)
        .maybeSingle()

      if (!perf) {
        const nome = session.user.user_metadata?.name || session.user.email?.split('@')[0] || 'Usuário'
        const { data: novoPerfil, error: insertError } = await supabase
          .from('perfis')
          .insert({
            user_id: session.user.id,
            nome: nome,
            email: session.user.email,
            empresa_id: session.user.id,
            perfil: 'admin'
          })
          .select()
          .single()
        if (insertError) {
          console.error('Erro ao criar perfil:', insertError)
          perf = { empresa_id: session.user.id, nome }
        } else {
          perf = novoPerfil
        }
      }

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

      const saved = row?.value ? JSON.parse(row.value) : {}
      if (saved.theme) document.documentElement.setAttribute('data-theme', saved.theme)
      else document.documentElement.setAttribute('data-theme', 'dark')

      setLoading(false)
    }
    init()
  }, [])

  function renderAba() {
    const props = { cfg, setCfg, empresaId }
    switch (abaAtiva) {
      case 'empresa': return <TabEmpresa {...props} />
      case 'metas': return <TabMetas {...props} />
      case 'kpis': return <TabKpis {...props} />
      case 'usuarios': return <TabUsuarios {...props} />
      case 'produtos': return <TabProdutos {...props} />
      case 'descontos': return <TabDescontos {...props} />
      case 'vouchers': return <TabVouchers {...props} />
      case 'documentos': return <TabDocumentos {...props} />
      case 'clientes': return <TabClientes {...props} />
      case 'tema': return <TabTema {...props} />
      default: return null
    }
  }

  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)', color: 'var(--muted)', fontFamily: 'DM Mono, monospace' }}>
      Carregando configurações...
    </div>
  )

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=DM+Mono:wght@300;400;500&family=Inter:wght@300;400;500;600;700&display=swap');
        [data-theme="dark"]{--bg:#0a0f1e;--surface:#111827;--surface2:#1a2540;--border:#1e2d4a;--accent:#00d4ff;--accent2:#7c3aed;--accent3:#10b981;--text:#e2e8f0;--muted:#64748b;--danger:#ef4444;--warning:#f59e0b;--gold:#fbbf24;--card-bg:#1a2540;--shadow:0 4px 24px rgba(0,0,0,.4);}
        [data-theme="light"]{--bg:#f0f4f8;--surface:#ffffff;--surface2:#f8fafc;--border:#e2e8f0;--accent:#0099bb;--accent2:#7c3aed;--accent3:#059669;--text:#1e293b;--muted:#64748b;--danger:#ef4444;--warning:#d97706;--gold:#b45309;--card-bg:#f8fafc;--shadow:0 4px 24px rgba(0,0,0,.1);}
        *{box-sizing:border-box;margin:0;padding:0}
        body{font-family:'DM Mono',monospace;background:var(--bg);color:var(--text);min-height:100vh}
        [data-theme="dark"] body::before{content:'';position:fixed;inset:0;background-image:linear-gradient(rgba(0,212,255,.025) 1px,transparent 1px),linear-gradient(90deg,rgba(0,212,255,.025) 1px,transparent 1px);background-size:40px 40px;pointer-events:none;z-index:0}
        input[type=number]::-webkit-inner-spin-button{opacity:1}
        select option{background:var(--surface2);color:var(--text)}
        input:focus,select:focus{border-color:var(--accent)!important;outline:none}
      `}</style>

      <div style={{ position: 'fixed', width: 500, height: 500, background: 'var(--accent)', top: -200, right: -150, borderRadius: '50%', filter: 'blur(120px)', opacity: .06, pointerEvents: 'none', zIndex: 0 }} />
      <div style={{ position: 'fixed', width: 400, height: 400, background: 'var(--accent2)', bottom: -150, left: -100, borderRadius: '50%', filter: 'blur(120px)', opacity: .06, pointerEvents: 'none', zIndex: 0 }} />
      <div id="vx-toast" style={{ position: 'fixed', bottom: 30, left: '50%', transform: 'translateX(-50%) translateY(20px)', background: 'rgba(16,185,129,.9)', color: '#fff', padding: '12px 24px', borderRadius: 10, fontFamily: 'DM Mono, monospace', fontSize: 14, zIndex: 9999, opacity: 0, transition: 'opacity .3s, transform .3s', boxShadow: '0 4px 20px rgba(0,0,0,.3)' }} />

      <header style={{ position: 'relative', zIndex: 10, width: '100%', maxWidth: 960, margin: '0 auto', padding: '18px 20px 0', display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ cursor: 'pointer' }} onClick={() => router.push('/chat')}>
          {cfg.logob64
            ? <img src={`data:image/png;base64,${cfg.logob64}`} alt="Logo" style={{ height: 36, objectFit: 'contain' }} onError={e => e.target.style.display = 'none'} />
            : <div style={{ fontFamily: 'Syne, sans-serif', fontSize: 17, fontWeight: 700, letterSpacing: .5 }}>{cfg.company || 'Vivanexa'}</div>
          }
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
          <button onClick={() => router.push('/chat')} style={{ background: 'var(--surface2)', border: '1px solid var(--border)', cursor: 'pointer', color: 'var(--muted)', fontSize: 11, padding: '5px 11px', borderRadius: 8, fontFamily: 'DM Mono, monospace', letterSpacing: .3 }}>💬 Chat</button>
          <button onClick={() => router.push('/dashboard')} style={{ background: 'var(--surface2)', border: '1px solid var(--border)', cursor: 'pointer', color: 'var(--muted)', fontSize: 11, padding: '5px 11px', borderRadius: 8, fontFamily: 'DM Mono, monospace', letterSpacing: .3 }}>📊 Dashboard</button>
          <button onClick={() => router.push('/reports')} style={{ background: 'var(--surface2)', border: '1px solid var(--border)', cursor: 'pointer', color: 'var(--muted)', fontSize: 11, padding: '5px 11px', borderRadius: 8, fontFamily: 'DM Mono, monospace', letterSpacing: .3 }}>📈 Relatórios</button>
          <button onClick={() => supabase.auth.signOut().then(() => router.push('/'))} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', fontSize: 11, padding: '5px 9px', borderRadius: 8, fontFamily: 'DM Mono, monospace' }}>Sair</button>
        </div>
      </header>

      <main style={{ position: 'relative', zIndex: 10, width: '100%', maxWidth: 960, margin: '20px auto 60px', padding: '0 20px' }}>
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, overflow: 'hidden', boxShadow: 'var(--shadow)' }}>
          <div style={{ background: 'var(--surface2)', borderBottom: '1px solid var(--border)', padding: '16px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <h3 style={{ fontFamily: 'Syne, sans-serif', fontSize: 16, fontWeight: 700, color: 'var(--accent)' }}>⚙️ Configurações</h3>
            <div style={{ fontSize: 12, color: 'var(--muted)' }}>{perfil?.nome && `Olá, ${perfil.nome}`}</div>
          </div>
          <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', background: 'var(--surface)', overflowX: 'auto' }}>
            {TABS.map(t => (
              <button key={t.id} onClick={() => setAbaAtiva(t.id)} style={{ flexShrink: 0, padding: '11px 14px', border: 'none', background: 'none', color: abaAtiva === t.id ? 'var(--accent)' : 'var(--muted)', fontFamily: 'DM Mono, monospace', fontSize: 12, cursor: 'pointer', borderBottom: `2px solid ${abaAtiva === t.id ? 'var(--accent)' : 'transparent'}`, letterSpacing: .3, whiteSpace: 'nowrap', transition: 'color .2s', position: 'relative', top: 1 }}>{t.label}</button>
            ))}
          </div>
          {renderAba()}
        </div>
      </main>
    </>
  )
}

// ✅ CORREÇÃO PRINCIPAL: Força SSR e evita erro de pré-renderização estática no build
export async function getServerSideProps() {
  return { props: {} }
}
