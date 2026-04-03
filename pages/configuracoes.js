// pages/configuracoes.js
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
  { id: 'documentos', label: '📄 Documentos' },
  { id: 'clientes',   label: '🗃️ Clientes' },
  { id: 'tema',       label: '🎨 Tema' },
]

const KPI_ICONS = ['📞','📲','📧','🤝','💼','🏆','🎯','💰','📈','📊','🔥','⭐','🚀','✅','📅','🗓','👥','🏃','💡','🎤','📝','🔔','💬','🌐','🛒','📦','🔑','⚡','🎁','🏅']

const MODULOS_PADRAO = ['Gestão Fiscal','CND','XML','BIA','IF','EP','Tributos']

const PLANOS_PADRAO = [
  { id: 'basic',   name: 'Basic',    maxCnpjs: 25,  usuarios: 1 },
  { id: 'pro',     name: 'Pro',      maxCnpjs: 80,  usuarios: 1 },
  { id: 'top',     name: 'Top',      maxCnpjs: 150, usuarios: 5 },
  { id: 'topplus', name: 'Top Plus', maxCnpjs: 999, usuarios: 999 },
]

const PRECOS_PADRAO = {
  'Gestão Fiscal': { basic:[478,318], pro:[590,409], top:[1032,547], topplus:[1398,679] },
  'CND':           { basic:[0,48],    pro:[0,90],    top:[0,150],    topplus:[0,200]    },
  'XML':           { basic:[478,199], pro:[590,299], top:[1032,349], topplus:[1398,399] },
  'BIA':           { basic:[478,129], pro:[590,169], top:[1032,280], topplus:[1398,299] },
  'IF':            { basic:[1600,379],pro:[1600,619],top:[1600,920], topplus:[1600,1100]},
  'EP':            { basic:[0,39],    pro:[0,82],    top:[0,167],    topplus:[0,200]    },
  'Tributos':      { basic:[0,0],     pro:[0,0],     top:[0,0],      topplus:[0,0]      },
}

const PERMISSOES_DISPONIVEIS = [
  { id: 'ver_dashboard',      label: '📊 Ver Dashboard' },
  { id: 'ver_chat',           label: '💬 Usar Chat' },
  { id: 'ver_configuracoes',  label: '⚙️ Ver Configurações' },
  { id: 'editar_precos',      label: '💲 Editar Preços' },
  { id: 'gerar_proposta',     label: '📄 Gerar Proposta' },
  { id: 'gerar_contrato',     label: '📝 Gerar Contrato' },
  { id: 'ver_clientes',       label: '🗃️ Ver Clientes' },
  { id: 'gerenciar_usuarios', label: '👥 Gerenciar Usuários' },
  { id: 'ver_kpis',           label: '📈 Ver KPIs' },
  { id: 'lancar_kpis',        label: '✏️ Lançar KPIs diários' },
  { id: 'ver_vouchers',       label: '🎫 Ver/Gerar Vouchers' },
]
const PERMISSOES_ADMIN = PERMISSOES_DISPONIVEIS.map(p => p.id)
const PERMISSOES_USER  = ['ver_dashboard','ver_chat','gerar_proposta','gerar_contrato','ver_clientes','ver_kpis','lancar_kpis']

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
  }, { onConflict: 'key' })
}

function diasUteisNoMes(yearMonth) {
  const [y, m] = yearMonth.split('-').map(Number)
  const dias = new Date(y, m, 0).getDate()
  let uteis = 0
  for (let d = 1; d <= dias; d++) {
    const dow = new Date(y, m - 1, d).getDay()
    if (dow !== 0 && dow !== 6) uteis++
  }
  return uteis
}

// ══════════════════════════════════════════════
// ABA EMPRESA
// ══════════════════════════════════════════════
function TabEmpresa({ cfg, setCfg, empresaId }) {
  const [company,      setCompany]      = useState(cfg.company      || '')
  const [slogan,       setSlogan]       = useState(cfg.slogan       || '')
  const [logoB64,      setLogoB64]      = useState(cfg.logob64      || '')
  const [closingHour,  setClosingHour]  = useState(cfg.closingHour  ?? 18)
  const [closingText,  setClosingText]  = useState(cfg.closingText  || 'Oferta válida até as 18h de hoje!')
  const [emailProvider,setEmailProvider]= useState(cfg.emailProvider|| '')
  const [smtpHost,     setSmtpHost]     = useState(cfg.smtpHost     || '')
  const [smtpPort,     setSmtpPort]     = useState(cfg.smtpPort     || '587')
  const [smtpUser,     setSmtpUser]     = useState(cfg.smtpUser     || '')
  const [smtpPass,     setSmtpPass]     = useState(cfg.smtpPass     || '')
  const [emailApiKey,  setEmailApiKey]  = useState(cfg.emailApiKey  || '')
  const [geminiApiKey, setGeminiApiKey] = useState(cfg.geminiApiKey || '')
  const [groqApiKey,   setGroqApiKey]   = useState(cfg.groqApiKey   || '')
  const [saving,       setSaving]       = useState(false)

  useEffect(() => {
    setCompany(cfg.company || '')
    setSlogan(cfg.slogan || '')
    setLogoB64(cfg.logob64 || '')
    setClosingHour(cfg.closingHour ?? 18)
    setClosingText(cfg.closingText || 'Oferta válida até as 18h de hoje!')
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

  async function salvar() {
    setSaving(true)
    const novoCfg = {
      ...cfg,
      company, slogan, logob64: logoB64,
      closingHour: Number(closingHour), closingText,
      emailProvider, smtpHost, smtpPort, smtpUser, smtpPass, emailApiKey,
      geminiApiKey, groqApiKey
    }
    const { error } = await salvarStorage(empresaId, novoCfg)
    setSaving(false)
    if (error) { toast('Erro ao salvar: ' + error.message, 'err'); return }
    setCfg(novoCfg)
    toast('✅ Configurações salvas!')
  }

  const agora = new Date()
  const horaAtual = agora.getHours() + agora.getMinutes() / 60
  const restante = closingHour - horaAtual
  const countdownPreview = restante > 0
    ? `${Math.floor(restante)}h ${Math.round((restante % 1) * 60)}min restantes`
    : 'Oferta encerrada para hoje'

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
            <button onClick={() => setLogoB64('')} style={{ fontSize: 12, color: 'var(--danger)', background: 'rgba(239,68,68,.1)', border: '1px solid rgba(239,68,68,.25)', padding: '4px 10px', borderRadius: 7, cursor: 'pointer' }}>🗑 Remover logo</button>
          </div>
        ) : (
          <div style={{ marginTop: 10, padding: '14px 18px', background: 'var(--surface2)', border: '1px dashed var(--border)', borderRadius: 10, fontSize: 13, color: 'var(--muted)', textAlign: 'center' }}>Nenhuma logomarca carregada</div>
        )}
      </div>

      <div style={s.sec}>
        <div style={s.secTitle}>⏰ Configurações da Oferta de Fechamento</div>
        <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 12, lineHeight: 1.6 }}>
          Quando configurado, uma contagem regressiva aparecerá automaticamente no chat na última oferta gerada, usando o horário abaixo.
        </p>
        <div style={s.row2}>
          <div style={s.field}>
            <label style={s.label}>Horário limite (0-23h)</label>
            <input type="number" min={0} max={23} value={closingHour} onChange={e => setClosingHour(Number(e.target.value))} style={s.input} />
          </div>
          <div style={s.field}>
            <label style={s.label}>Texto da oferta exibido no chat</label>
            <input value={closingText} onChange={e => setClosingText(e.target.value)} style={s.input} placeholder="Oferta válida até as 18h de hoje!" />
          </div>
        </div>
        <div style={{ padding: '10px 14px', background: 'rgba(0,212,255,.06)', border: '1px solid rgba(0,212,255,.2)', borderRadius: 8, fontSize: 12, color: 'var(--accent)' }}>
          ⏱ Preview agora: <strong>{countdownPreview}</strong> — Exibição: "{closingText || `Oferta válida até as ${closingHour}h de hoje!`}"
        </div>
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
// ABA METAS (mantida igual)
// ══════════════════════════════════════════════
function TabMetas({ cfg, setCfg, empresaId }) {
  const mes = new Date().toISOString().slice(0, 7)
  const [mesRef, setMesRef] = useState(mes)
  const [metas, setMetas]   = useState({})
  const [saving, setSaving]  = useState(false)
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
    const novasGoals  = Object.values(metas).map(m => ({ ...m, mes: mesRef }))
    const novoCfg     = { ...cfg, goals: [...outrasGoals, ...novasGoals] }
    const { error }   = await salvarStorage(empresaId, novoCfg)
    setSaving(false)
    if (error) { toast('Erro ao salvar', 'err'); return }
    setCfg(novoCfg)
    toast('✅ Metas salvas!')
  }

  async function adminClear(tipo) {
    if (!confirm(`Confirma zerar ${tipo}?`)) return
    let novoCfg = { ...cfg }
    if (tipo === 'metas')   novoCfg.goals   = []
    if (tipo === 'clientes') novoCfg.clients = []
    if (tipo === 'kpis')    { novoCfg.kpiLog = []; novoCfg.kpiDailyGoals = {} }
    if (tipo === 'tudo')    novoCfg = { company: cfg.company, slogan: cfg.slogan, logob64: cfg.logob64, users: cfg.users }
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
          const uid = u.id || u.username
          return (
            <div key={uid} style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 10, padding: 14, marginBottom: 10 }}>
              <div style={{ fontWeight: 600, marginBottom: 10, color: 'var(--accent)', fontSize: 14 }}>{u.nome}</div>
              <div style={s.row2}>
                <div style={s.field}><label style={s.label}>Meta Adesão (R$)</label><input type="number" style={s.input} value={metas[uid]?.metaAdesao || ''} onChange={e => updateMeta(uid, 'metaAdesao', e.target.value)} placeholder="0" /></div>
                <div style={s.field}><label style={s.label}>Meta Mensalidade (R$)</label><input type="number" style={s.input} value={metas[uid]?.metaMensalidade || ''} onChange={e => updateMeta(uid, 'metaMensalidade', e.target.value)} placeholder="0" /></div>
              </div>
            </div>
          )
        })}
        <button style={s.saveBtn} onClick={salvar} disabled={saving}>{saving ? '⏳ Salvando...' : '✅ Salvar Metas'}</button>
      </div>

      <div style={s.sec}>
        <div style={{ ...s.secTitle, color: 'var(--danger)' }}>⚠️ Área Administrativa — Limpeza de Dados</div>
        {[['metas','🎯 Zerar metas'],['clientes','👥 Zerar clientes'],['kpis','📊 Zerar logs de KPI'],['tudo','⚠️ RESET COMPLETO']].map(([tipo, label]) => (
          <button key={tipo} onClick={() => adminClear(tipo)} style={{ display: 'block', width: '100%', marginBottom: 8, padding: '11px 14px', borderRadius: 9, background: tipo === 'tudo' ? 'rgba(239,68,68,.2)' : 'rgba(239,68,68,.1)', border: tipo === 'tudo' ? '2px solid rgba(239,68,68,.5)' : '1px solid rgba(239,68,68,.3)', color: 'var(--danger)', fontFamily: 'DM Mono, monospace', fontSize: 13, cursor: 'pointer', textAlign: 'left', fontWeight: tipo === 'tudo' ? 700 : 400 }}>{label}</button>
        ))}
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════
// ABA KPIs (mantida igual)
// ══════════════════════════════════════════════
function TabKpis({ cfg, setCfg, empresaId }) {
  const [kpis,         setKpis]         = useState(cfg.kpiTemplates  || [])
  const [kpiRequired,  setKpiRequired]  = useState(cfg.kpiRequired   || false)
  const [dailyGoals,   setDailyGoals]   = useState(cfg.kpiDailyGoals || {})
  const [mesRef,       setMesRef]       = useState(new Date().toISOString().slice(0, 7))
  const [saving,       setSaving]       = useState(false)
  const [iconPickerId, setIconPickerId] = useState(null)
  const usuarios = cfg.users || []
  const diasUteis = diasUteisNoMes(mesRef)

  function addKpi() { setKpis(prev => [...prev, { id: Date.now(), nome: '', icone: '📊', unidade: 'un' }]) }
  function updateKpi(id, campo, val) { setKpis(prev => prev.map(k => k.id === id ? { ...k, [campo]: val } : k)) }
  function removeKpi(id) { setKpis(prev => prev.filter(k => k.id !== id)); if (iconPickerId === id) setIconPickerId(null) }
  function updateDailyGoal(userId, kpiId, val) {
    setDailyGoals(prev => ({ ...prev, [userId]: { ...(prev[userId] || {}), [kpiId]: Number(val) || 0 } }))
  }

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
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <button onClick={() => setIconPickerId(iconPickerId === k.id ? null : k.id)} style={{ width: 44, height: 44, borderRadius: 10, background: 'var(--surface)', border: '1px solid var(--border)', fontSize: 22, cursor: 'pointer' }}>{k.icone}</button>
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

        <div style={{ padding: '14px 16px', background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 10 }}>
          <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={kpiRequired}
              onChange={e => setKpiRequired(e.target.checked)}
              style={{ marginTop: 2, width: 16, height: 16 }}
            />
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>✅ Exigir preenchimento diário de KPIs</div>
              <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4, lineHeight: 1.5 }}>
                Se ativado, os usuários serão redirecionados para a tela de lançamento de KPIs sempre que <strong>não tiverem preenchido o dia útil anterior</strong>. O bloqueio ocorre automaticamente ao acessar o sistema.
              </div>
            </div>
          </label>
        </div>
      </div>

      {usuarios.length > 0 && kpis.length > 0 && (
        <div style={s.sec}>
          <div style={s.secTitle}>🎯 Metas Diárias por Usuário — {mesRef}</div>
          <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 14, lineHeight: 1.5 }}>
            Defina a meta diária de cada KPI por vendedor. A meta mensal será calculada automaticamente com base nos dias úteis do mês ({diasUteis} dias úteis em {mesRef}).
          </p>
          <div style={{ marginBottom: 14 }}>
            <label style={s.label}>Mês de Referência</label>
            <input type="month" value={mesRef} onChange={e => setMesRef(e.target.value)} style={{ ...s.input, maxWidth: 200 }} />
            <span style={{ fontSize: 12, color: 'var(--muted)', marginLeft: 10 }}>{diasUteis} dias úteis</span>
          </div>
          {usuarios.map(u => {
            if (!u) return null
            const uid = u.id || u.username
            return (
              <div key={uid} style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 10, padding: 14, marginBottom: 12 }}>
                <div style={{ fontWeight: 600, color: 'var(--accent)', fontSize: 14, marginBottom: 10 }}>{u.nome}</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px,1fr))', gap: 12 }}>
                  {kpis.map(k => {
                    if (!k || !k.nome) return null
                    const diaria   = dailyGoals[uid]?.[k.id] || 0
                    const mensal   = diaria * diasUteis
                    return (
                      <div key={k.id} style={s.field}>
                        <label style={s.label}>{k.icone} {k.nome} / dia</label>
                        <input
                          type="number" min={0} style={s.input}
                          value={diaria || ''}
                          onChange={e => updateDailyGoal(uid, k.id, e.target.value)}
                          placeholder="0"
                        />
                        {diaria > 0 && (
                          <div style={{ fontSize: 11, color: 'var(--accent3)', marginTop: 4 }}>
                            📅 Meta mensal: <strong>{mensal} {k.unidade || 'un'}</strong>
                          </div>
                        )}
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

// As demais abas (Usuários, Produtos, Descontos, Vouchers, Documentos, Clientes, Tema) permanecem exatamente como no original.
// Para não estender demais, mantenha o código original dessas abas, pois as alterações foram apenas na TabEmpresa.
// Abaixo segue apenas a estrutura da página principal e estilos (já presente no arquivo original).

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
  const router    = useRouter()
  const [loading,   setLoading]   = useState(true)
  const [perfil,    setPerfil]    = useState(null)
  const [empresaId, setEmpresaId] = useState(null)
  const [cfg,       setCfg]       = useState({})
  const [abaAtiva,  setAbaAtiva]  = useState('empresa')

  useEffect(() => {
    async function init() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.push('/'); return }

      let { data: perf } = await supabase
        .from('perfis').select('*').eq('user_id', session.user.id).maybeSingle()

      if (!perf) {
        const nome = session.user.user_metadata?.name || session.user.email?.split('@')[0] || 'Usuário'
        const { data: novoPerfil, error: insertError } = await supabase
          .from('perfis')
          .insert({ user_id: session.user.id, nome, email: session.user.email, empresa_id: session.user.id, perfil: 'admin' })
          .select().single()
        perf = insertError ? { empresa_id: session.user.id, nome } : novoPerfil
      }

      setPerfil(perf)
      const eid = perf?.empresa_id || session.user.id
      setEmpresaId(eid)

      const { data: row } = await supabase.from('vx_storage').select('value').eq('key', `cfg:${eid}`).single()
      if (row?.value) {
        try { setCfg(JSON.parse(row.value)) } catch {}
      }
      const saved = row?.value ? JSON.parse(row.value) : {}
      document.documentElement.setAttribute('data-theme', saved.theme || 'dark')
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
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=DM+Mono:wght@300;400;500&family=Inter:wght@300;400;500;600;700&display=swap');
        [data-theme="dark"]{--bg:#0a0f1e;--surface:#111827;--surface2:#1a2540;--border:#1e2d4a;--accent:#00d4ff;--accent2:#7c3aed;--accent3:#10b981;--text:#e2e8f0;--muted:#64748b;--danger:#ef4444;--warning:#f59e0b;--gold:#fbbf24;--shadow:0 4px 24px rgba(0,0,0,.4);}
        [data-theme="light"]{--bg:#f0f4f8;--surface:#ffffff;--surface2:#f8fafc;--border:#e2e8f0;--accent:#0099bb;--accent2:#7c3aed;--accent3:#059669;--text:#1e293b;--muted:#64748b;--danger:#ef4444;--warning:#d97706;--gold:#b45309;--shadow:0 4px 24px rgba(0,0,0,.1);}
        *{box-sizing:border-box;margin:0;padding:0}
        body{font-family:'DM Mono',monospace;background:var(--bg);color:var(--text);min-height:100vh}
        [data-theme="dark"] body::before{content:'';position:fixed;inset:0;background-image:linear-gradient(rgba(0,212,255,.025) 1px,transparent 1px),linear-gradient(90deg,rgba(0,212,255,.025) 1px,transparent 1px);background-size:40px 40px;pointer-events:none;z-index:0}
        input[type=number]::-webkit-inner-spin-button{opacity:1}
        select option{background:var(--surface2);color:var(--text)}
        input:focus,select:focus,textarea:focus{border-color:var(--accent)!important;outline:none}
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
          <button onClick={() => router.push('/chat')}      style={navBtn}>💬 Chat</button>
          <button onClick={() => router.push('/dashboard')} style={navBtn}>📊 Dashboard</button>
          <button onClick={() => router.push('/reports')}   style={navBtn}>📈 Relatórios</button>
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

const navBtn = { background: 'var(--surface2)', border: '1px solid var(--border)', cursor: 'pointer', color: 'var(--muted)', fontSize: 11, padding: '5px 11px', borderRadius: 8, fontFamily: 'DM Mono, monospace', letterSpacing: .3 }

export async function getServerSideProps() {
  return { props: {} }
}
