// pages/configuracoes.js — v4 com URL por tab + comissões em usuários + TabClientes e TabDocumentos completos
import React, { useState, useEffect, useRef, Fragment } from 'react'
import { useRouter } from 'next/router'
import { supabase } from '../lib/supabase'
import Navbar from '../components/Navbar'

// ══════════════════════════════════════════════
// CONSTANTES
// ══════════════════════════════════════════════
const TABS = [
  { id: 'empresa',       label: '🏢 Empresa' },
  { id: 'metas',         label: '🎯 Metas' },
  { id: 'kpis',          label: '📊 KPIs' },
  { id: 'perfis',        label: '🛡️ Perfis' },
  { id: 'usuarios',      label: '👥 Usuários' },
  { id: 'produtos',      label: '📦 Produtos' },
  { id: 'descontos',     label: '🏷️ Descontos' },
  { id: 'vouchers',      label: '🎫 Vouchers' },
  { id: 'documentos',    label: '📄 Documentos' },
  { id: 'clientes',      label: '🗃️ Clientes' },
  { id: 'tema',          label: '🎨 Tema' },
  { id: 'whatsapp',      label: '💬 WhatsApp' },
  { id: 'agente_ia',     label: '🤖 Agente IA' },
  { id: 'departamentos', label: '🏢 Departamentos' },
  { id: 'integracoes',   label: '🔗 Integrações' },
  { id: 'google_meta',   label: '📍 Google & Meta' },
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
  { id: 'ver_comissoes',      label: '🏆 Ver Comissões' },
]
const PERMISSOES_ADMIN = PERMISSOES_DISPONIVEIS.map(p => p.id)
const PERMISSOES_USER  = ['ver_dashboard','ver_chat','gerar_proposta','gerar_contrato','ver_clientes','ver_kpis','lancar_kpis','ver_comissoes']

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

function fmt(n) {
  return 'R$ ' + Number(n || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })
}

// ── helpers de formatação (usados em TabClientes) ──
function fmtDocStr(s) {
  if (!s) return ''
  const d = s.replace(/\D/g, '')
  if (d.length === 14) return d.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5')
  if (d.length === 11) return d.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, '$1.$2.$3-$4')
  return s
}
function fmtCepStr(s) {
  if (!s) return ''
  const d = s.replace(/\D/g, '').slice(0, 8)
  return d.length > 5 ? d.slice(0, 5) + '-' + d.slice(5) : d
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
  const [razaoSocial,  setRazaoSocial]  = useState(cfg.razaoSocial  || '')
  const [cnpjEmpresa,  setCnpjEmpresa]  = useState(cfg.cnpjEmpresa  || '')
  const [telefoneEmp,  setTelefoneEmp]  = useState(cfg.telefoneEmp  || '')
  const [emailEmp,     setEmailEmp]     = useState(cfg.emailEmp     || '')
  const [responsavel,  setResponsavel]  = useState(cfg.responsavel  || '')
  const [enderecoEmp,  setEnderecoEmp]  = useState(cfg.enderecoEmp  || '')
  const [signEmail,    setSignEmail]    = useState(cfg.signConfig?.email || '')
  const [signWpp,      setSignWpp]      = useState(cfg.signConfig?.wpp   || '')
  const [signUrl,      setSignUrl]      = useState(cfg.signConfig?.url   || '')
  const [emailProvider,setEmailProvider]= useState(cfg.emailProvider|| '')
  const [smtpHost,     setSmtpHost]     = useState(cfg.smtpHost     || '')
  const [smtpPort,     setSmtpPort]     = useState(cfg.smtpPort     || '587')
  const [smtpUser,     setSmtpUser]     = useState(cfg.smtpUser     || '')
  const [smtpPass,     setSmtpPass]     = useState(cfg.smtpPass     || '')
  const [emailApiKey,  setEmailApiKey]  = useState(cfg.emailApiKey  || '')
  const [geminiApiKey, setGeminiApiKey] = useState(cfg.geminiApiKey || '')
  const [groqApiKey,   setGroqApiKey]   = useState(cfg.groqApiKey   || '')
  const [openaiApiKey, setOpenaiApiKey] = useState(cfg.openaiApiKey || '')
  const [saving,       setSaving]       = useState(false)

  useEffect(() => {
    setCompany(cfg.company || ''); setSlogan(cfg.slogan || ''); setLogoB64(cfg.logob64 || '')
    setClosingHour(cfg.closingHour ?? 18); setClosingText(cfg.closingText || 'Oferta válida até as 18h de hoje!')
    setEmailProvider(cfg.emailProvider || ''); setSmtpHost(cfg.smtpHost || ''); setSmtpPort(cfg.smtpPort || '587')
    setSmtpUser(cfg.smtpUser || ''); setSmtpPass(cfg.smtpPass || ''); setEmailApiKey(cfg.emailApiKey || '')
    setGeminiApiKey(cfg.geminiApiKey || ''); setGroqApiKey(cfg.groqApiKey || ''); setOpenaiApiKey(cfg.openaiApiKey || '')
    setRazaoSocial(cfg.razaoSocial || ''); setCnpjEmpresa(cfg.cnpjEmpresa || ''); setTelefoneEmp(cfg.telefoneEmp || '')
    setEmailEmp(cfg.emailEmp || ''); setResponsavel(cfg.responsavel || ''); setEnderecoEmp(cfg.enderecoEmp || '')
    setSignEmail(cfg.signConfig?.email || ''); setSignWpp(cfg.signConfig?.wpp || ''); setSignUrl(cfg.signConfig?.url || '')
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
      ...cfg, company, slogan, logob64: logoB64,
      closingHour: Number(closingHour), closingText,
      emailProvider, smtpHost, smtpPort, smtpUser, smtpPass, emailApiKey,
      geminiApiKey, groqApiKey, openaiApiKey,
      razaoSocial, cnpjEmpresa, telefoneEmp, emailEmp, responsavel, enderecoEmp,
      signConfig: { email: signEmail, wpp: signWpp, url: signUrl },
    }
    const { error } = await salvarStorage(empresaId, novoCfg)
    setSaving(false)
    if (error) { toast('Erro ao salvar: ' + error.message, 'err'); return }
    setCfg(novoCfg); toast('✅ Configurações salvas!')
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
        <div style={s.secTitle}>🏢 Dados Cadastrais da Empresa</div>
        <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 12 }}>Estes dados viram variáveis nos documentos e propostas.</p>
        <div style={s.row2}>
          <div style={s.field}><label style={s.label}>Nome Fantasia</label><input style={s.input} value={company} onChange={e => setCompany(e.target.value)} placeholder="Ex: Vivanexa" /></div>
          <div style={s.field}><label style={s.label}>Razão Social</label><input style={s.input} value={razaoSocial} onChange={e => setRazaoSocial(e.target.value)} placeholder="Ex: Vivanexa Tecnologia Ltda" /></div>
        </div>
        <div style={s.row2}>
          <div style={s.field}><label style={s.label}>CNPJ</label><input style={s.input} value={cnpjEmpresa} onChange={e => setCnpjEmpresa(e.target.value)} placeholder="00.000.000/0001-00" /></div>
          <div style={s.field}><label style={s.label}>Responsável</label><input style={s.input} value={responsavel} onChange={e => setResponsavel(e.target.value)} placeholder="Nome do responsável" /></div>
        </div>
        <div style={s.row2}>
          <div style={s.field}><label style={s.label}>Telefone</label><input style={s.input} value={telefoneEmp} onChange={e => setTelefoneEmp(e.target.value)} placeholder="(00) 00000-0000" /></div>
          <div style={s.field}><label style={s.label}>E-mail da Empresa</label><input type="email" style={s.input} value={emailEmp} onChange={e => setEmailEmp(e.target.value)} placeholder="contato@empresa.com" /></div>
        </div>
        <div style={s.field}><label style={s.label}>Endereço Completo</label><input style={s.input} value={enderecoEmp} onChange={e => setEnderecoEmp(e.target.value)} placeholder="Rua, nº, bairro, cidade – UF" /></div>
      </div>

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
        <div style={s.row2}>
          <div style={s.field}><label style={s.label}>Horário limite (0-23h)</label><input type="number" min={0} max={23} value={closingHour} onChange={e => setClosingHour(Number(e.target.value))} style={s.input} /></div>
          <div style={s.field}><label style={s.label}>Texto da oferta exibido no chat</label><input value={closingText} onChange={e => setClosingText(e.target.value)} style={s.input} placeholder="Oferta válida até as 18h de hoje!" /></div>
        </div>
        <div style={{ padding: '10px 14px', background: 'rgba(0,212,255,.06)', border: '1px solid rgba(0,212,255,.2)', borderRadius: 8, fontSize: 12, color: 'var(--accent)' }}>
          ⏱ Preview agora: <strong>{countdownPreview}</strong>
        </div>
      </div>

      <div style={s.sec}>
        <div style={s.secTitle}>📧 Configuração de E-mail Automático</div>
        <div style={s.row2}>
          <div style={s.field}><label style={s.label}>Provedor (smtp/brevo/sendgrid)</label><input style={s.input} value={emailProvider} onChange={e => setEmailProvider(e.target.value)} placeholder="smtp" /></div>
          <div style={s.field}><label style={s.label}>Host SMTP</label><input style={s.input} value={smtpHost} onChange={e => setSmtpHost(e.target.value)} placeholder="smtp.gmail.com" /></div>
        </div>
        <div style={s.row2}>
          <div style={s.field}><label style={s.label}>Porta SMTP</label><input style={s.input} value={smtpPort} onChange={e => setSmtpPort(e.target.value)} placeholder="587" /></div>
          <div style={s.field}><label style={s.label}>Usuário SMTP</label><input style={s.input} value={smtpUser} onChange={e => setSmtpUser(e.target.value)} placeholder="email@dominio.com" /></div>
        </div>
        <div style={s.field}><label style={s.label}>Senha SMTP</label><input type="password" style={s.input} value={smtpPass} onChange={e => setSmtpPass(e.target.value)} /></div>
        <div style={s.field}><label style={s.label}>API Key (para Brevo/SendGrid)</label><input style={s.input} value={emailApiKey} onChange={e => setEmailApiKey(e.target.value)} /></div>
      </div>

      <div style={s.sec}>
        <div style={s.secTitle}>🤖 Configuração de IA</div>
        <div style={s.field}><label style={s.label}>Chave API Google Gemini</label><input style={s.input} type="password" value={geminiApiKey} onChange={e => setGeminiApiKey(e.target.value)} placeholder="AIza..." /></div>
        <div style={s.field}><label style={s.label}>Chave API Groq (fallback)</label><input style={s.input} type="password" value={groqApiKey} onChange={e => setGroqApiKey(e.target.value)} placeholder="gsk_..." /></div>
        <div style={s.field}><label style={s.label}>Chave API OpenAI</label><input style={s.input} type="password" value={openaiApiKey} onChange={e => setOpenaiApiKey(e.target.value)} placeholder="sk-..." /></div>
      </div>

      <div style={s.sec}>
        <div style={s.secTitle}>✍️ Assinatura Eletrônica</div>
        <div style={s.row2}>
          <div style={s.field}><label style={s.label}>E-mail remetente</label><input type="email" style={s.input} value={signEmail} onChange={e => setSignEmail(e.target.value)} /></div>
          <div style={s.field}><label style={s.label}>WhatsApp da empresa</label><input style={s.input} value={signWpp} onChange={e => setSignWpp(e.target.value)} /></div>
        </div>
        <div style={s.field}><label style={s.label}>URL base do sistema</label><input style={s.input} value={signUrl} onChange={e => setSignUrl(e.target.value)} placeholder="https://seusite.com" /></div>
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
    setCfg(novoCfg); toast('✅ Metas salvas!')
  }

  async function adminClear(tipo) {
    if (!confirm(`Confirma zerar ${tipo}?`)) return
    let novoCfg = { ...cfg }
    if (tipo === 'metas')    novoCfg.goals   = []
    if (tipo === 'clientes') novoCfg.clients = []
    if (tipo === 'kpis')     { novoCfg.kpiLog = []; novoCfg.kpiDailyGoals = {} }
    if (tipo === 'tudo')     novoCfg = { company: cfg.company, slogan: cfg.slogan, logob64: cfg.logob64, users: cfg.users }
    const { error } = await salvarStorage(empresaId, novoCfg)
    if (error) { toast('Erro', 'err'); return }
    setCfg(novoCfg); toast('🗑 Dados removidos!')
  }

  return (
    <div style={s.body}>
      <div style={s.sec}>
        <div style={s.secTitle}>Metas de Vendas por Usuário</div>
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
// ABA KPIs
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
    setCfg(novoCfg); toast('✅ KPIs salvos!')
  }

  return (
    <div style={s.body}>
      <div style={s.sec}>
        <div style={s.secTitle}>📊 Indicadores de Atividade (KPIs)</div>
        {kpis.map(k => {
          if (!k) return null
          return (
            <div key={k.id} style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 10, padding: '12px 14px', marginBottom: 10 }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <button onClick={() => setIconPickerId(iconPickerId === k.id ? null : k.id)} style={{ width: 44, height: 44, borderRadius: 10, background: 'var(--surface)', border: '1px solid var(--border)', fontSize: 22, cursor: 'pointer' }}>{k.icone}</button>
                <input style={{ ...s.input, flex: 1 }} value={k.nome} onChange={e => updateKpi(k.id, 'nome', e.target.value)} placeholder="Nome do KPI" />
                <select style={{ ...s.input, width: 72 }} value={k.unidade || 'un'} onChange={e => updateKpi(k.id, 'unidade', e.target.value)}>
                  <option value="un">un</option><option value="R$">R$</option><option value="%">%</option><option value="h">h</option>
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
            <input type="checkbox" checked={kpiRequired} onChange={e => setKpiRequired(e.target.checked)} style={{ marginTop: 2, width: 16, height: 16 }} />
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>✅ Exigir preenchimento diário de KPIs</div>
              <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4, lineHeight: 1.5 }}>Se ativado, os usuários serão redirecionados para lançar KPIs se não preencheram o dia útil anterior.</div>
            </div>
          </label>
        </div>
      </div>

      {usuarios.length > 0 && kpis.length > 0 && (
        <div style={s.sec}>
          <div style={s.secTitle}>🎯 Metas Diárias por Usuário — {mesRef}</div>
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
                    const diaria = dailyGoals[uid]?.[k.id] || 0
                    const mensal = diaria * diasUteis
                    return (
                      <div key={k.id} style={s.field}>
                        <label style={s.label}>{k.icone} {k.nome} / dia</label>
                        <input type="number" min={0} style={s.input} value={diaria || ''} onChange={e => updateDailyGoal(uid, k.id, e.target.value)} placeholder="0" />
                        {diaria > 0 && <div style={{ fontSize: 11, color: 'var(--accent3)', marginTop: 4 }}>📅 Meta mensal: <strong>{mensal} {k.unidade || 'un'}</strong></div>}
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
// ABA PERFIS
// ══════════════════════════════════════════════
function TabPerfis({ cfg, setCfg, empresaId }) {
  const [perfis,  setPerfis]  = useState(cfg.perfisCustom || [])
  const [form,    setForm]    = useState(null)
  const [saving,  setSaving]  = useState(false)

  const perfisDefault = [
    { id: 'admin',   nome: 'Admin',    permissoes: PERMISSOES_ADMIN },
    { id: 'vendedor',nome: 'Vendedor', permissoes: PERMISSOES_USER  },
  ]
  const emptyPerfil = { id: '', nome: '', permissoes: [] }

  function togglePerm(perm) {
    setForm(f => {
      const perms = f.permissoes || []
      return { ...f, permissoes: perms.includes(perm) ? perms.filter(p => p !== perm) : [...perms, perm] }
    })
  }

  async function salvarPerfil() {
    if (!form.nome.trim()) { toast('Nome do perfil obrigatório', 'err'); return }
    setSaving(true)
    const novos = form.id ? perfis.map(p => p.id === form.id ? form : p) : [...perfis, { ...form, id: 'p_' + Date.now() }]
    const novoCfg = { ...cfg, perfisCustom: novos }
    const { error } = await salvarStorage(empresaId, novoCfg)
    setSaving(false)
    if (error) { toast('Erro ao salvar', 'err'); return }
    setPerfis(novos); setCfg(novoCfg); setForm(null); toast('✅ Perfil salvo!')
  }

  async function removerPerfil(id) {
    if (!confirm('Remover perfil?')) return
    const novos = perfis.filter(p => p.id !== id)
    await salvarStorage(empresaId, { ...cfg, perfisCustom: novos })
    setPerfis(novos); setCfg({ ...cfg, perfisCustom: novos }); toast('🗑 Perfil removido!')
  }

  return (
    <div style={s.body}>
      <div style={s.sec}>
        <div style={s.secTitle}>🛡️ Perfis de Acesso</div>
        {perfisDefault.map(p => (
          <div key={p.id} style={{ padding: '12px 16px', background: 'rgba(0,212,255,.04)', border: '1px solid rgba(0,212,255,.15)', borderRadius: 10, marginBottom: 8 }}>
            <div style={{ fontWeight: 600, color: 'var(--accent)', fontSize: 14 }}>{p.nome} <span style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 400 }}>(padrão)</span></div>
            <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 3 }}>{p.permissoes.length} permissões</div>
          </div>
        ))}
        {perfis.map(p => (
          <div key={p.id} style={{ padding: '12px 16px', background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 10, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600, color: 'var(--text)', fontSize: 14 }}>{p.nome}</div>
              <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 3 }}>{(p.permissoes || []).length} permissões</div>
            </div>
            <button onClick={() => setForm({ ...p })} style={{ padding: '5px 10px', borderRadius: 7, background: 'rgba(0,212,255,.1)', border: '1px solid rgba(0,212,255,.2)', color: 'var(--accent)', cursor: 'pointer' }}>✏️</button>
            <button onClick={() => removerPerfil(p.id)} style={{ padding: '5px 10px', borderRadius: 7, background: 'rgba(239,68,68,.1)', border: '1px solid rgba(239,68,68,.2)', color: 'var(--danger)', cursor: 'pointer' }}>🗑</button>
          </div>
        ))}
        <button onClick={() => setForm({ ...emptyPerfil })} style={{ padding: '10px 18px', borderRadius: 9, background: 'rgba(0,212,255,.08)', border: '1px solid rgba(0,212,255,.2)', color: 'var(--accent)', fontFamily: 'DM Mono, monospace', fontSize: 13, cursor: 'pointer', marginTop: 8 }}>+ Novo Perfil</button>
      </div>
      {form && (
        <div style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 12, padding: 18 }}>
          <div style={{ ...s.secTitle, marginBottom: 14 }}>Dados do Perfil</div>
          <div style={s.field}><label style={s.label}>Nome do Perfil</label><input style={s.input} value={form.nome} onChange={e => setForm(f => ({ ...f, nome: e.target.value }))} placeholder="Ex: Supervisor, Gerente..." /></div>
          <div style={s.field}>
            <label style={s.label}>Permissões</label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginTop: 6 }}>
              {PERMISSOES_DISPONIVEIS.map(p => (
                <label key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 12, color: 'var(--text)', padding: '7px 10px', background: (form.permissoes || []).includes(p.id) ? 'rgba(0,212,255,.08)' : 'transparent', borderRadius: 6, border: `1px solid ${(form.permissoes || []).includes(p.id) ? 'rgba(0,212,255,.25)' : 'transparent'}` }}>
                  <input type="checkbox" checked={(form.permissoes || []).includes(p.id)} onChange={() => togglePerm(p.id)} />{p.label}
                </label>
              ))}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
            <button style={s.saveBtn} onClick={salvarPerfil} disabled={saving}>{saving ? '⏳...' : '✅ Salvar Perfil'}</button>
            <button onClick={() => setForm(null)} style={{ padding: '11px 18px', borderRadius: 10, background: 'rgba(100,116,139,.12)', border: '1px solid rgba(100,116,139,.3)', color: 'var(--muted)', fontFamily: 'DM Mono, monospace', fontSize: 13, cursor: 'pointer' }}>Cancelar</button>
          </div>
        </div>
      )}
    </div>
  )
}

// ══════════════════════════════════════════════
// ABA USUÁRIOS — com campo de comissão
// ══════════════════════════════════════════════
function TabUsuarios({ cfg, setCfg, empresaId }) {
  const [users,  setUsers]  = useState(cfg.users || [])
  const [form,   setForm]   = useState(null)
  const [saving, setSaving] = useState(false)

  const perfisCustom = cfg.perfisCustom || []
  const perfisTipos = [
    { id: 'admin',   nome: 'Admin',    permissoes: PERMISSOES_ADMIN },
    { id: 'gestor',  nome: 'Gestor',   permissoes: PERMISSOES_ADMIN },
    { id: 'vendedor',nome: 'Vendedor', permissoes: PERMISSOES_USER  },
    ...perfisCustom.map(p => ({ id: p.id, nome: p.nome, permissoes: p.permissoes || [] }))
  ]

  const emptyUser = {
    id: '', nome: '', email: '', username: '', password: '', tipo: 'vendedor',
    permissoes: [...PERMISSOES_USER],
    comissao: {
      adesao:       { tipo: 'percentual', valor: 0 },
      mensalidade:  { tipo: 'percentual', valor: 0 },
    }
  }

  function aplicarPerfil(tipo) {
    const p = perfisTipos.find(x => x.id === tipo)
    setForm(f => ({ ...f, tipo, permissoes: p ? [...p.permissoes] : [] }))
  }

  function updateComissao(campo, key, val) {
    setForm(f => ({
      ...f,
      comissao: {
        ...(f.comissao || {}),
        [campo]: { ...(f.comissao?.[campo] || { tipo: 'percentual', valor: 0 }), [key]: val }
      }
    }))
  }

  async function salvarUser() {
    if (!form.nome || !form.email) { toast('Nome e e-mail obrigatórios', 'err'); return }
    setSaving(true)
    const novos = form.id ? users.map(u => u.id === form.id ? form : u) : [...users, { ...form, id: Date.now().toString() }]
    const novoCfg = { ...cfg, users: novos }
    const { error } = await salvarStorage(empresaId, novoCfg)
    setSaving(false)
    if (error) { toast('Erro ao salvar', 'err'); return }
    setUsers(novos); setCfg(novoCfg); setForm(null); toast('✅ Usuário salvo!')
  }

  async function removerUser(id) {
    if (!confirm('Remover usuário?')) return
    const novos = users.filter(u => u.id !== id)
    await salvarStorage(empresaId, { ...cfg, users: novos })
    setUsers(novos); setCfg({ ...cfg, users: novos }); toast('🗑 Usuário removido!')
  }

  function previewComissao(campo, val, tipo) {
    if (!val || val == 0) return null
    if (tipo === 'percentual') return `Ex: sobre R$ 1.000,00 → R$ ${(1000 * val / 100).toFixed(2).replace('.', ',')}`
    return `Valor fixo por contrato`
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
          const com = u.comissao
          return (
            <div key={u.id} style={{ padding: '12px 16px', background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 10, display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, color: 'var(--accent)', fontSize: 14 }}>{u.nome}</div>
                <div style={{ fontSize: 12, color: 'var(--muted)' }}>{u.email} · {u.tipo || 'vendedor'}</div>
                {com && (
                  <div style={{ fontSize: 11, color: '#10b981', marginTop: 3, display: 'flex', gap: 12 }}>
                    <span>Adesão: {com.adesao?.tipo === 'percentual' ? `${com.adesao.valor}%` : fmt(com.adesao?.valor || 0)}</span>
                    <span>Mensalidade: {com.mensalidade?.tipo === 'percentual' ? `${com.mensalidade.valor}%` : fmt(com.mensalidade?.valor || 0)}</span>
                  </div>
                )}
              </div>
              <button onClick={() => setForm({ ...emptyUser, ...u, comissao: { ...emptyUser.comissao, ...(u.comissao || {}) } })} style={{ padding: '5px 10px', borderRadius: 7, background: 'rgba(0,212,255,.1)', border: '1px solid rgba(0,212,255,.2)', color: 'var(--accent)' }}>✏️</button>
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
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {perfisTipos.map(p => (
                <button key={p.id} onClick={() => aplicarPerfil(p.id)}
                  style={{ padding: '7px 16px', borderRadius: 8, border: `1.5px solid ${form.tipo === p.id ? 'var(--accent)' : 'var(--border)'}`, background: form.tipo === p.id ? 'rgba(0,212,255,.12)' : 'var(--surface)', color: form.tipo === p.id ? 'var(--accent)' : 'var(--muted)', fontFamily: 'DM Mono, monospace', fontSize: 12, cursor: 'pointer', fontWeight: form.tipo === p.id ? 600 : 400 }}>
                  {p.nome}
                </button>
              ))}
            </div>
          </div>

          {/* BLOCO DE COMISSÃO */}
          <div style={{ marginTop: 20, padding: '16px 18px', background: 'rgba(16,185,129,.06)', border: '1px solid rgba(16,185,129,.2)', borderRadius: 12 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#10b981', marginBottom: 4, fontFamily: 'Syne, sans-serif' }}>🏆 Comissão do Vendedor</div>
            <p style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 14, lineHeight: 1.6 }}>
              Configure o percentual ou valor fixo de comissão para adesão e mensalidade.
              Estas configurações alimentam o relatório Financeiro → Comissões.
            </p>

            {/* Adesão */}
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)', marginBottom: 8 }}>Comissão de Adesão</div>
              <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', gap: 6 }}>
                  {['percentual', 'valor_fixo'].map(tipo => (
                    <button key={tipo} onClick={() => updateComissao('adesao', 'tipo', tipo)}
                      style={{ padding: '7px 14px', borderRadius: 8, border: `1.5px solid ${form.comissao?.adesao?.tipo === tipo ? '#10b981' : 'var(--border)'}`, background: form.comissao?.adesao?.tipo === tipo ? 'rgba(16,185,129,.12)' : 'var(--surface)', color: form.comissao?.adesao?.tipo === tipo ? '#10b981' : 'var(--muted)', fontFamily: 'DM Mono, monospace', fontSize: 12, cursor: 'pointer' }}>
                      {tipo === 'percentual' ? '% Percentual' : 'R$ Valor Fixo'}
                    </button>
                  ))}
                </div>
                <div style={{ flex: 1, minWidth: 140 }}>
                  <div style={{ position: 'relative' }}>
                    <input type="number" min={0} step={form.comissao?.adesao?.tipo === 'percentual' ? 0.5 : 1}
                      style={{ ...s.input, paddingLeft: 12, marginBottom: 0 }}
                      value={form.comissao?.adesao?.valor || ''}
                      onChange={e => updateComissao('adesao', 'valor', Number(e.target.value))}
                      placeholder={form.comissao?.adesao?.tipo === 'percentual' ? 'Ex: 10' : 'Ex: 500'} />
                    <span style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', fontSize: 12, color: 'var(--muted)', pointerEvents: 'none' }}>
                      {form.comissao?.adesao?.tipo === 'percentual' ? '%' : 'R$'}
                    </span>
                  </div>
                  {form.comissao?.adesao?.valor > 0 && (
                    <div style={{ fontSize: 11, color: '#10b981', marginTop: 4 }}>
                      {previewComissao('adesao', form.comissao.adesao.valor, form.comissao.adesao.tipo)}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Mensalidade */}
            <div>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)', marginBottom: 8 }}>Comissão de Mensalidade</div>
              <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', gap: 6 }}>
                  {['percentual', 'valor_fixo'].map(tipo => (
                    <button key={tipo} onClick={() => updateComissao('mensalidade', 'tipo', tipo)}
                      style={{ padding: '7px 14px', borderRadius: 8, border: `1.5px solid ${form.comissao?.mensalidade?.tipo === tipo ? '#10b981' : 'var(--border)'}`, background: form.comissao?.mensalidade?.tipo === tipo ? 'rgba(16,185,129,.12)' : 'var(--surface)', color: form.comissao?.mensalidade?.tipo === tipo ? '#10b981' : 'var(--muted)', fontFamily: 'DM Mono, monospace', fontSize: 12, cursor: 'pointer' }}>
                      {tipo === 'percentual' ? '% Percentual' : 'R$ Valor Fixo'}
                    </button>
                  ))}
                </div>
                <div style={{ flex: 1, minWidth: 140 }}>
                  <div style={{ position: 'relative' }}>
                    <input type="number" min={0} step={form.comissao?.mensalidade?.tipo === 'percentual' ? 0.5 : 1}
                      style={{ ...s.input, paddingLeft: 12, marginBottom: 0 }}
                      value={form.comissao?.mensalidade?.valor || ''}
                      onChange={e => updateComissao('mensalidade', 'valor', Number(e.target.value))}
                      placeholder={form.comissao?.mensalidade?.tipo === 'percentual' ? 'Ex: 5' : 'Ex: 150'} />
                    <span style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', fontSize: 12, color: 'var(--muted)', pointerEvents: 'none' }}>
                      {form.comissao?.mensalidade?.tipo === 'percentual' ? '%' : 'R$'}
                    </span>
                  </div>
                  {form.comissao?.mensalidade?.valor > 0 && (
                    <div style={{ fontSize: 11, color: '#10b981', marginTop: 4 }}>
                      {previewComissao('mensalidade', form.comissao.mensalidade.valor, form.comissao.mensalidade.tipo)}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Resumo visual */}
            {(form.comissao?.adesao?.valor > 0 || form.comissao?.mensalidade?.valor > 0) && (
              <div style={{ marginTop: 14, padding: '10px 14px', background: 'rgba(16,185,129,.1)', border: '1px solid rgba(16,185,129,.25)', borderRadius: 8, fontSize: 12, color: '#10b981' }}>
                📋 Resumo: Adesão {form.comissao?.adesao?.tipo === 'percentual' ? `${form.comissao.adesao.valor}% do valor` : `R$ ${form.comissao.adesao?.valor || 0} fixo`}
                {' · '}
                Mensalidade {form.comissao?.mensalidade?.tipo === 'percentual' ? `${form.comissao.mensalidade.valor}% do valor` : `R$ ${form.comissao.mensalidade?.valor || 0} fixo`}
              </div>
            )}
          </div>

          <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
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
  const [subAba,   setSubAba]  = useState('tabela')
  const [modulos,  setModulos] = useState(cfg.modulos || MODULOS_PADRAO)
  const [planos,   setPlanos]  = useState(() => {
    const ps = cfg.plans || PLANOS_PADRAO
    return ps.map(p => ({ ...p, name: p.name || p.nome || p.id, maxCnpjs: p.maxCnpjs || p.usuarios || 25, usuarios: p.usuarios || 1 }))
  })
  const [precos,   setPrecos]  = useState(() => {
    const merged = { ...PRECOS_PADRAO }
    Object.keys(cfg.prices || {}).forEach(mod => { merged[mod] = { ...PRECOS_PADRAO[mod], ...(cfg.prices[mod] || {}) } })
    return merged
  })
  const [saving,   setSaving]  = useState(false)
  const [editMod,  setEditMod] = useState(null)
  const [novoMod,  setNovoMod] = useState('')
  const [formPlano,setFormPlano]= useState(null)

  function addModulo() {
    if (!novoMod.trim()) return
    const mod = novoMod.trim()
    if (modulos.includes(mod)) { toast('Módulo já existe', 'err'); return }
    setModulos(prev => [...prev, mod])
    setPrecos(prev => { const n = { ...prev }; n[mod] = {}; planos.forEach(p => { n[mod][p.id] = [0,0] }); return n })
    setNovoMod('')
  }

  function renameModulo(oldName, newName) {
    if (!newName.trim() || newName === oldName) { setEditMod(null); return }
    setModulos(prev => prev.map(m => m === oldName ? newName.trim() : m))
    setPrecos(prev => { const n = { ...prev }; n[newName.trim()] = n[oldName] || {}; delete n[oldName]; return n })
    setEditMod(null)
  }

  function removeModulo(mod) {
    if (!confirm(`Remover módulo "${mod}"?`)) return
    setModulos(prev => prev.filter(m => m !== mod))
    setPrecos(prev => { const n = { ...prev }; delete n[mod]; return n })
  }

  function updatePreco(mod, planId, idx, val) {
    setPrecos(prev => {
      const n = { ...prev }
      if (!n[mod]) n[mod] = {}
      if (!n[mod][planId]) n[mod][planId] = [0,0]
      n[mod][planId] = [...n[mod][planId]]
      n[mod][planId][idx] = Number(val) || 0
      return n
    })
  }

  async function salvar() {
    setSaving(true)
    const novoCfg = { ...cfg, modulos, plans: planos, prices: precos }
    const { error } = await salvarStorage(empresaId, novoCfg)
    setSaving(false)
    if (error) { toast('Erro ao salvar', 'err'); return }
    setCfg(novoCfg); toast('✅ Produtos salvos!')
  }

  const btnSub = (id, label) => (
    <button onClick={() => setSubAba(id)} style={{ padding: '7px 14px', borderRadius: 8, border: `1px solid ${subAba===id?'var(--accent)':'var(--border)'}`, background: subAba===id?'rgba(0,212,255,.1)':'var(--surface2)', color: subAba===id?'var(--accent)':'var(--muted)', fontFamily: 'DM Mono, monospace', fontSize: 12, cursor: 'pointer', fontWeight: subAba===id?600:400 }}>{label}</button>
  )

  return (
    <div style={s.body}>
      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        {btnSub('tabela', '💰 Tabela de Preços')}{btnSub('modulos', '📦 Módulos')}{btnSub('planos', '🗂️ Planos')}
      </div>

      {subAba === 'tabela' && (
        <div style={s.sec}>
          <div style={s.secTitle}>💰 Tabela de Preços (Adesão / Mensalidade)</div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, minWidth: 500 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  <th style={{ padding: '8px 12px', textAlign: 'left', color: 'var(--muted)', fontWeight: 500 }}>Módulo</th>
                  {planos.map(p => (
                    <th key={p.id} colSpan={2} style={{ padding: '8px 12px', textAlign: 'center', color: 'var(--accent)', fontWeight: 600 }}>{p.name}</th>
                  ))}
                </tr>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  <th></th>
                  {planos.map(p => (
                    <Fragment key={p.id}>
                      <th style={{ padding: '4px 8px', textAlign: 'center', color: 'var(--muted)', fontSize: 10, fontWeight: 400 }}>Adesão R$</th>
                      <th style={{ padding: '4px 8px', textAlign: 'center', color: 'var(--muted)', fontSize: 10, fontWeight: 400 }}>Mensal R$</th>
                    </Fragment>
                  ))}
                </tr>
              </thead>
              <tbody>
                {modulos.map(mod => (
                  <tr key={mod} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '8px 12px', fontWeight: 600, fontSize: 13, color: 'var(--text)', whiteSpace: 'nowrap' }}>{mod}</td>
                    {planos.map(p => (
                      <Fragment key={p.id}>
                        <td style={{ padding: '4px 6px' }}><input type="number" min={0} value={precos[mod]?.[p.id]?.[0] ?? 0} onChange={e => updatePreco(mod, p.id, 0, e.target.value)} style={{ ...s.input, padding: '4px 8px', width: 80, fontSize: 12 }} /></td>
                        <td style={{ padding: '4px 6px' }}><input type="number" min={0} value={precos[mod]?.[p.id]?.[1] ?? 0} onChange={e => updatePreco(mod, p.id, 1, e.target.value)} style={{ ...s.input, padding: '4px 8px', width: 80, fontSize: 12 }} /></td>
                      </Fragment>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {subAba === 'modulos' && (
        <div style={s.sec}>
          <div style={s.secTitle}>📦 Módulos / Produtos</div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
            <input style={{ ...s.input, flex: 1 }} value={novoMod} onChange={e => setNovoMod(e.target.value)} placeholder="Nome do novo módulo" onKeyDown={e => e.key === 'Enter' && addModulo()} />
            <button onClick={addModulo} style={{ padding: '9px 16px', borderRadius: 9, background: 'rgba(0,212,255,.1)', border: '1px solid rgba(0,212,255,.25)', color: 'var(--accent)', fontFamily: 'DM Mono, monospace', fontSize: 13, cursor: 'pointer', whiteSpace: 'nowrap' }}>+ Adicionar</button>
          </div>
          {modulos.map(mod => (
            <div key={mod} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 10, marginBottom: 8 }}>
              {editMod?.old === mod ? (
                <>
                  <input autoFocus style={{ ...s.input, flex: 1 }} value={editMod.new} onChange={e => setEditMod(m => ({ ...m, new: e.target.value }))} onKeyDown={e => { if (e.key === 'Enter') renameModulo(mod, editMod.new); if (e.key === 'Escape') setEditMod(null) }} />
                  <button onClick={() => renameModulo(mod, editMod.new)} style={{ padding: '5px 12px', borderRadius: 7, background: 'rgba(16,185,129,.15)', border: '1px solid rgba(16,185,129,.3)', color: 'var(--accent3)', cursor: 'pointer', fontSize: 12 }}>✅</button>
                  <button onClick={() => setEditMod(null)} style={{ padding: '5px 12px', borderRadius: 7, background: 'rgba(100,116,139,.1)', border: '1px solid var(--border)', color: 'var(--muted)', cursor: 'pointer', fontSize: 12 }}>✕</button>
                </>
              ) : (
                <>
                  <span style={{ flex: 1, fontWeight: 600, fontSize: 14 }}>{mod}</span>
                  <button onClick={() => setEditMod({ old: mod, new: mod })} style={{ padding: '5px 10px', borderRadius: 7, background: 'rgba(0,212,255,.1)', border: '1px solid rgba(0,212,255,.2)', color: 'var(--accent)', cursor: 'pointer' }}>✏️</button>
                  <button onClick={() => removeModulo(mod)} style={{ padding: '5px 10px', borderRadius: 7, background: 'rgba(239,68,68,.1)', border: '1px solid rgba(239,68,68,.2)', color: 'var(--danger)', cursor: 'pointer' }}>🗑</button>
                </>
              )}
            </div>
          ))}
        </div>
      )}

      {subAba === 'planos' && (
        <div style={s.sec}>
          <div style={s.secTitle}>🗂️ Planos Disponíveis</div>
          {planos.map(p => (
            <div key={p.id} style={{ padding: '12px 16px', background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 10, display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--accent)' }}>{p.name}</div>
                <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>Máx. {p.maxCnpjs} CNPJs · {p.usuarios} usuário{p.usuarios !== 1 ? 's' : ''}</div>
              </div>
              <button onClick={() => setFormPlano({ ...p, _isNew: false })} style={{ padding: '5px 10px', borderRadius: 7, background: 'rgba(0,212,255,.1)', border: '1px solid rgba(0,212,255,.2)', color: 'var(--accent)', cursor: 'pointer' }}>✏️</button>
              <button onClick={() => { if(!confirm('Remover plano?'))return; setPlanos(prev=>prev.filter(x=>x.id!==p.id)) }} style={{ padding: '5px 10px', borderRadius: 7, background: 'rgba(239,68,68,.1)', border: '1px solid rgba(239,68,68,.2)', color: 'var(--danger)', cursor: 'pointer' }}>🗑</button>
            </div>
          ))}
          <button onClick={() => setFormPlano({ id:'', name:'', maxCnpjs:25, usuarios:1, _isNew:true })} style={{ padding: '10px 18px', borderRadius: 9, background: 'rgba(0,212,255,.08)', border: '1px solid rgba(0,212,255,.2)', color: 'var(--accent)', fontFamily: 'DM Mono, monospace', fontSize: 13, cursor: 'pointer', marginTop: 8 }}>+ Novo Plano</button>
          {formPlano && (
            <div style={{ marginTop: 16, padding: 18, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12 }}>
              <div style={s.row2}>
                <div style={s.field}><label style={s.label}>Nome do Plano</label><input style={s.input} value={formPlano.name} onChange={e => setFormPlano(f => ({ ...f, name: e.target.value }))} /></div>
                <div style={s.field}><label style={s.label}>ID</label><input style={s.input} value={formPlano.id} onChange={e => setFormPlano(f => ({ ...f, id: e.target.value.toLowerCase().replace(/\s+/g,'_') }))} disabled={!formPlano._isNew} /></div>
              </div>
              <div style={s.row2}>
                <div style={s.field}><label style={s.label}>Máx. CNPJs</label><input type="number" min={1} style={s.input} value={formPlano.maxCnpjs} onChange={e => setFormPlano(f => ({ ...f, maxCnpjs: e.target.value }))} /></div>
                <div style={s.field}><label style={s.label}>Usuários inclusos</label><input type="number" min={1} style={s.input} value={formPlano.usuarios} onChange={e => setFormPlano(f => ({ ...f, usuarios: e.target.value }))} /></div>
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                <button style={s.saveBtn} onClick={() => {
                  if (!formPlano.name.trim()) { toast('Nome obrigatório','err'); return }
                  const id = formPlano.id || formPlano.name.toLowerCase().replace(/\s+/g,'_')
                  const novo = { ...formPlano, id, name: formPlano.name.trim(), maxCnpjs: Number(formPlano.maxCnpjs)||25, usuarios: Number(formPlano.usuarios)||1 }
                  if (formPlano._isNew) setPlanos(prev => [...prev, novo])
                  else setPlanos(prev => prev.map(p => p.id === formPlano.id ? novo : p))
                  setFormPlano(null)
                }}>✅ Salvar Plano</button>
                <button onClick={() => setFormPlano(null)} style={{ padding: '11px 18px', borderRadius: 10, background: 'rgba(100,116,139,.12)', border: '1px solid rgba(100,116,139,.3)', color: 'var(--muted)', fontFamily: 'DM Mono, monospace', fontSize: 13, cursor: 'pointer' }}>Cancelar</button>
              </div>
            </div>
          )}
        </div>
      )}
      <button style={s.saveBtn} onClick={salvar} disabled={saving}>{saving ? '⏳ Salvando...' : '✅ Salvar Produtos'}</button>
    </div>
  )
}

// ══════════════════════════════════════════════
// ABA CLIENTES — com API CNPJ (BrasilAPI) + CEP (ViaCEP)
// ══════════════════════════════════════════════
function TabClientes({ cfg, setCfg, empresaId }) {
  const [busca,     setBusca]     = useState('')
  const [form,      setForm]      = useState(null)
  const [saving,    setSaving]    = useState(false)
  const [lookupMsg, setLookupMsg] = useState('')
  const [lookingUp, setLookingUp] = useState(false)

  const clientes  = cfg.clients || []
  const filtrados = busca.trim()
    ? clientes.filter(c => c && (
        c.nome?.toLowerCase().includes(busca.toLowerCase()) ||
        c.fantasia?.toLowerCase().includes(busca.toLowerCase()) ||
        c.cnpj?.includes(busca) || c.cpf?.includes(busca)
      ))
    : clientes

  const EMPTY = {
    id: '', doc: '', fantasia: '', nome: '', contato: '', email: '', tel: '',
    cep: '', end: '', bairro: '', cidade: '', uf: '', cpfContato: '', regime: '',
    rimpNome: '', rimpEmail: '', rimpTel: '',
    rfinNome: '', rfinEmail: '', rfinTel: '',
  }

  function handleDocInput(val) {
    const d = val.replace(/\D/g, '')
    let fmtd = d
    if (d.length <= 11) fmtd = d.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, '$1.$2.$3-$4')
    else fmtd = d.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5')
    setForm(f => ({ ...f, doc: fmtd }))
  }

  function handleCepInput(val) {
    setForm(f => ({ ...f, cep: fmtCepStr(val) }))
  }

  async function lookupDoc() {
    const raw = (form?.doc || '').replace(/\D/g, '')
    if (raw.length !== 14 && raw.length !== 11) { setLookupMsg('Informe um CPF ou CNPJ válido.'); return }
    setLookingUp(true); setLookupMsg('')

    const local = clientes.find(c => (c.cnpj || c.doc || '').replace(/\D/g, '') === raw)
    if (local) {
      setForm(f => ({
        ...f,
        fantasia:   f.fantasia   || local.fantasia,
        nome:       f.nome       || local.nome,
        contato:    f.contato    || local.contato,
        email:      f.email      || local.email,
        tel:        f.tel        || local.tel,
        cep:        f.cep        || local.cep,
        end:        f.end        || local.end,
        bairro:     f.bairro     || local.bairro,
        cidade:     f.cidade     || local.cidade,
        uf:         f.uf         || local.uf,
        cpfContato: f.cpfContato || local.cpfContato,
        regime:     f.regime     || local.regime,
        rimpNome:   f.rimpNome   || local.rimpNome,
        rimpEmail:  f.rimpEmail  || local.rimpEmail,
        rimpTel:    f.rimpTel    || local.rimpTel,
        rfinNome:   f.rfinNome   || local.rfinNome,
        rfinEmail:  f.rfinEmail  || local.rfinEmail,
        rfinTel:    f.rfinTel    || local.rfinTel,
      }))
      setLookupMsg('✅ Dados encontrados na base local!')
      setLookingUp(false); return
    }

    if (raw.length === 14) {
      try {
        const r = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${raw}`)
        if (r.ok) {
          const d = await r.json()
          const fone = (d.ddd_telefone_1 || d.ddd_telefone_2 || '').replace(/\D/g, '')
          const foneStr = fone.length >= 10 ? `(${fone.slice(0, 2)}) ${fone.slice(2)}` : ''
          setForm(f => ({
            ...f,
            fantasia: f.fantasia || d.nome_fantasia || d.razao_social || '',
            nome:     f.nome     || d.razao_social || '',
            email:    f.email    || d.email || '',
            tel:      f.tel      || foneStr,
            cep:      f.cep      || fmtCepStr(d.cep || ''),
            end:      f.end      || ((d.logradouro || '') + (d.numero ? ', ' + d.numero : '')),
            bairro:   f.bairro   || d.bairro || '',
            cidade:   f.cidade   || d.municipio || '',
            uf:       f.uf       || d.uf || '',
          }))
          setLookupMsg('✅ Dados da Receita Federal carregados!')
          if (!d.logradouro && d.cep) await lookupCepDireto((d.cep || '').replace(/\D/g, ''))
        } else {
          setLookupMsg('CNPJ não localizado na Receita Federal.')
        }
      } catch {
        setLookupMsg('Erro na consulta. Verifique a conexão.')
      }
    } else {
      setLookupMsg('CPF informado — preencha os dados manualmente.')
    }
    setLookingUp(false)
  }

  async function lookupCep() {
    const cep = (form?.cep || '').replace(/\D/g, '')
    if (cep.length !== 8) return
    await lookupCepDireto(cep)
  }

  async function lookupCepDireto(cep) {
    try {
      const r = await fetch(`https://viacep.com.br/ws/${cep}/json/`)
      if (!r.ok) return
      const d = await r.json()
      if (d.erro) return
      setForm(f => ({
        ...f,
        end:    f.end    || d.logradouro || '',
        bairro: f.bairro || d.bairro     || '',
        cidade: f.cidade || d.localidade || '',
        uf:     f.uf     || d.uf         || '',
      }))
    } catch {}
  }

  function isDuplicate(formData) {
    const clean = str => (str || '').replace(/\D/g, '')
    return clientes.some(cl => {
      if (!cl || cl.id === formData.id) return false
      const doc = clean(formData.doc)
      if (doc.length >= 11 && clean(cl.doc || cl.cnpj || cl.cpf) === doc) return true
      if (formData.email && cl.email && cl.email.toLowerCase() === formData.email.toLowerCase()) return true
      return false
    })
  }

  async function salvarCliente() {
    if (!form.nome && !form.fantasia) { toast('Nome obrigatório', 'err'); return }
    if (isDuplicate(form)) { toast('Cliente já cadastrado com esse CNPJ/CPF ou e-mail.', 'err'); return }
    setSaving(true)
    const novo = {
      ...form,
      id: form.id || Date.now().toString(),
      cnpj: form.doc?.replace(/\D/g, '').length === 14 ? form.doc : '',
      cpf:  form.doc?.replace(/\D/g, '').length === 11 ? form.doc : '',
    }
    const novos = form.id ? clientes.map(c => c.id === form.id ? novo : c) : [...clientes, novo]
    const novoCfg = { ...cfg, clients: novos }
    const { error } = await salvarStorage(empresaId, novoCfg)
    setSaving(false)
    if (error) { toast('Erro ao salvar', 'err'); return }
    setCfg(novoCfg); setForm(null); setLookupMsg(''); toast('✅ Cliente salvo!')
  }

  async function removerCliente(id) {
    if (!confirm('Remover cliente?')) return
    const novos = clientes.filter(c => c.id !== id)
    await salvarStorage(empresaId, { ...cfg, clients: novos })
    setCfg({ ...cfg, clients: novos }); toast('🗑 Cliente removido!')
  }

  const inp = { ...s.input, width: '100%' }
  const blk = { background: 'rgba(0,212,255,.04)', border: '1px solid rgba(0,212,255,.12)', borderRadius: 10, padding: '12px 14px', marginBottom: 12 }
  const blkGold = { background: 'rgba(251,191,36,.04)', border: '1px solid rgba(251,191,36,.12)', borderRadius: 10, padding: '12px 14px', marginBottom: 12 }
  const blkLbl = (color, txt) => <div style={{ fontSize: 11, color, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 10, fontWeight: 700 }}>{txt}</div>

  return (
    <div style={s.body}>
      <div style={s.sec}>
        <div style={s.secTitle}>Clientes Cadastrados</div>
        <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
          <input style={{ ...s.input, flex: 1 }} placeholder="CNPJ, CPF, nome ou fantasia..." value={busca} onChange={e => setBusca(e.target.value)} />
          <button onClick={() => { setForm({ ...EMPTY }); setLookupMsg('') }} style={{ padding: '10px 16px', borderRadius: 9, background: 'rgba(0,212,255,.1)', border: '1px solid rgba(0,212,255,.25)', color: 'var(--accent)', fontFamily: 'DM Mono, monospace', fontSize: 12, cursor: 'pointer', whiteSpace: 'nowrap' }}>+ Novo Cliente</button>
        </div>
        {filtrados.length === 0 && !form && <p style={{ color: 'var(--muted)' }}>Nenhum cliente encontrado.</p>}
        {filtrados.map(c => {
          if (!c) return null
          return (
            <div key={c.id} style={{ padding: '12px 16px', background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 10, display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, color: 'var(--accent)', fontSize: 14 }}>{c.fantasia || c.nome}</div>
                <div style={{ fontSize: 12, color: 'var(--muted)' }}>
                  {c.doc || c.cnpj || c.cpf || ''}
                  {c.cidade ? ` · ${c.cidade}` : ''}
                  {c.regime ? ` · ${c.regime}` : ''}
                </div>
              </div>
              <button onClick={() => { setForm({ ...EMPTY, ...c, doc: c.doc || c.cnpj || c.cpf || '' }); setLookupMsg('') }} style={{ padding: '5px 10px', borderRadius: 7, background: 'rgba(0,212,255,.1)', border: '1px solid rgba(0,212,255,.2)', color: 'var(--accent)' }}>✏️</button>
              <button onClick={() => removerCliente(c.id)} style={{ padding: '5px 10px', borderRadius: 7, background: 'rgba(239,68,68,.1)', border: '1px solid rgba(239,68,68,.2)', color: 'var(--danger)' }}>🗑</button>
            </div>
          )
        })}
      </div>

      {form && (
        <div style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 12, padding: 20, marginTop: 8 }}>
          <div style={{ ...s.secTitle, marginBottom: 14 }}>Dados do Cliente</div>

          {/* CPF / CNPJ + busca */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 8, marginBottom: 14 }}>
            <div style={s.field}>
              <label style={s.label}>CPF / CNPJ</label>
              <input style={inp} value={form.doc || ''} onChange={e => handleDocInput(e.target.value)} placeholder="00.000.000/0000-00" maxLength={18} />
            </div>
            <div style={{ display: 'flex', alignItems: 'flex-end' }}>
              <button onClick={lookupDoc} disabled={lookingUp} style={{ padding: '9px 14px', borderRadius: 8, background: 'rgba(0,212,255,.15)', border: '1px solid rgba(0,212,255,.3)', color: 'var(--accent)', fontFamily: 'DM Mono, monospace', fontSize: 13, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                {lookingUp ? '⏳ Buscando...' : '🔍 Buscar'}
              </button>
            </div>
          </div>
          {lookupMsg && (
            <div style={{ marginBottom: 12, fontSize: 12, padding: '6px 10px', borderRadius: 8, background: lookupMsg.startsWith('✅') ? 'rgba(16,185,129,.1)' : 'rgba(245,158,11,.1)', color: lookupMsg.startsWith('✅') ? '#10b981' : '#fbbf24', border: `1px solid ${lookupMsg.startsWith('✅') ? 'rgba(16,185,129,.3)' : 'rgba(245,158,11,.3)'}` }}>
              {lookupMsg}
            </div>
          )}

          <div style={s.row2}>
            <div style={s.field}><label style={s.label}>Nome Fantasia</label><input style={inp} value={form.fantasia || ''} onChange={e => setForm(f => ({ ...f, fantasia: e.target.value }))} placeholder="Nome fantasia" /></div>
            <div style={s.field}><label style={s.label}>Razão Social</label><input style={inp} value={form.nome || ''} onChange={e => setForm(f => ({ ...f, nome: e.target.value }))} placeholder="Razão social" /></div>
          </div>
          <div style={s.row2}>
            <div style={s.field}><label style={s.label}>Nome do Contato</label><input style={inp} value={form.contato || ''} onChange={e => setForm(f => ({ ...f, contato: e.target.value }))} placeholder="Responsável" /></div>
            <div style={s.field}><label style={s.label}>E-mail</label><input type="email" style={inp} value={form.email || ''} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="email@empresa.com" /></div>
          </div>
          <div style={s.row2}>
            <div style={s.field}><label style={s.label}>Telefone / WhatsApp</label><input style={inp} value={form.tel || ''} onChange={e => setForm(f => ({ ...f, tel: e.target.value }))} placeholder="(00) 00000-0000" /></div>
            <div style={s.field}>
              <label style={s.label}>CEP</label>
              <div style={{ display: 'flex', gap: 6 }}>
                <input style={{ ...inp, flex: 1 }} value={form.cep || ''} onChange={e => handleCepInput(e.target.value)} onBlur={lookupCep} placeholder="00000-000" maxLength={9} />
                <button onClick={lookupCep} style={{ padding: '9px 10px', borderRadius: 8, background: 'rgba(0,212,255,.1)', border: '1px solid rgba(0,212,255,.2)', color: 'var(--accent)', cursor: 'pointer', fontSize: 13 }}>📍</button>
              </div>
            </div>
          </div>
          <div style={s.row2}>
            <div style={s.field}><label style={s.label}>Endereço</label><input style={inp} value={form.end || ''} onChange={e => setForm(f => ({ ...f, end: e.target.value }))} placeholder="Rua, número" /></div>
            <div style={s.field}><label style={s.label}>Bairro</label><input style={inp} value={form.bairro || ''} onChange={e => setForm(f => ({ ...f, bairro: e.target.value }))} placeholder="Bairro" /></div>
          </div>
          <div style={s.row2}>
            <div style={s.field}><label style={s.label}>Cidade</label><input style={inp} value={form.cidade || ''} onChange={e => setForm(f => ({ ...f, cidade: e.target.value }))} placeholder="Cidade" /></div>
            <div style={s.field}><label style={s.label}>Estado (UF)</label><input style={inp} value={form.uf || ''} onChange={e => setForm(f => ({ ...f, uf: e.target.value.toUpperCase() }))} placeholder="UF" maxLength={2} /></div>
          </div>

          {/* Responsável pela Implantação */}
          <div style={blk}>
            {blkLbl('var(--accent)', '👷 Responsável pela Implantação')}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
              <div style={s.field}><label style={s.label}>Nome</label><input style={inp} value={form.rimpNome || ''} onChange={e => setForm(f => ({ ...f, rimpNome: e.target.value }))} placeholder="Nome do responsável" /></div>
              <div style={s.field}><label style={s.label}>E-mail</label><input type="email" style={inp} value={form.rimpEmail || ''} onChange={e => setForm(f => ({ ...f, rimpEmail: e.target.value }))} placeholder="email@empresa.com" /></div>
              <div style={s.field}><label style={s.label}>Telefone</label><input style={inp} value={form.rimpTel || ''} onChange={e => setForm(f => ({ ...f, rimpTel: e.target.value }))} placeholder="(00) 00000-0000" /></div>
            </div>
          </div>

          {/* Responsável Financeiro */}
          <div style={blkGold}>
            {blkLbl('#fbbf24', '💰 Responsável Financeiro')}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
              <div style={s.field}><label style={s.label}>Nome</label><input style={inp} value={form.rfinNome || ''} onChange={e => setForm(f => ({ ...f, rfinNome: e.target.value }))} placeholder="Nome do responsável" /></div>
              <div style={s.field}><label style={s.label}>E-mail</label><input type="email" style={inp} value={form.rfinEmail || ''} onChange={e => setForm(f => ({ ...f, rfinEmail: e.target.value }))} placeholder="email@financeiro.com" /></div>
              <div style={s.field}><label style={s.label}>Telefone</label><input style={inp} value={form.rfinTel || ''} onChange={e => setForm(f => ({ ...f, rfinTel: e.target.value }))} placeholder="(00) 00000-0000" /></div>
            </div>
          </div>

          <div style={s.row2}>
            <div style={s.field}><label style={s.label}>CPF do Contato Principal</label><input style={inp} value={form.cpfContato || ''} onChange={e => setForm(f => ({ ...f, cpfContato: e.target.value }))} placeholder="000.000.000-00" /></div>
            <div style={s.field}>
              <label style={s.label}>Regime Tributário</label>
              <select style={inp} value={form.regime || ''} onChange={e => setForm(f => ({ ...f, regime: e.target.value }))}>
                <option value="">Selecione...</option>
                <option>Simples Nacional</option>
                <option>Lucro Presumido</option>
                <option>Lucro Real</option>
                <option>MEI</option>
              </select>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
            <button style={s.saveBtn} onClick={salvarCliente} disabled={saving}>{saving ? '⏳...' : '✅ Salvar Cliente'}</button>
            <button onClick={() => { setForm(null); setLookupMsg('') }} style={{ padding: '11px 18px', borderRadius: 10, background: 'rgba(100,116,139,.12)', border: '1px solid rgba(100,116,139,.3)', color: 'var(--muted)', fontFamily: 'DM Mono, monospace', fontSize: 13, cursor: 'pointer' }}>Cancelar</button>
          </div>
        </div>
      )}
    </div>
  )
}

// ══════════════════════════════════════════════
// ABA DOCUMENTOS — variáveis organizadas por seção
// ══════════════════════════════════════════════
function TabDocumentos({ cfg, setCfg, empresaId }) {
  const [propostaTemplate, setPropostaTemplate] = useState(cfg.docTemplates?.proposta || '')
  const [contratoTemplate, setContratoTemplate] = useState(cfg.docTemplates?.contrato || '')
  const [saving,   setSaving]   = useState(false)
  const [testando, setTestando] = useState(false)

  function handleFileUpload(tipo, e) {
    const file = e.target.files[0]
    if (!file) return
    if (file.size > 5 * 1024 * 1024) { toast('Arquivo muito grande (máx 5MB)', 'err'); return }

    if (file.name.endsWith('.docx')) {
      const reader = new FileReader()
      reader.onload = ev => {
        const b64 = ev.target.result
        if (tipo === 'proposta') setPropostaTemplate(b64)
        else setContratoTemplate(b64)
        toast(`✅ DOCX carregado — ${Math.round(file.size / 1024)} KB`)
      }
      reader.readAsDataURL(file)
      return
    }

    const reader = new FileReader()
    reader.onload = ev => {
      if (tipo === 'proposta') setPropostaTemplate(ev.target.result)
      else setContratoTemplate(ev.target.result)
    }
    reader.readAsText(file)
  }

  function isDocx(tmpl) {
    return tmpl && tmpl.startsWith('data:application/vnd')
  }

  async function salvar() {
    setSaving(true)
    const novoCfg = { ...cfg, docTemplates: { proposta: propostaTemplate, contrato: contratoTemplate } }
    const { error } = await salvarStorage(empresaId, novoCfg)
    setSaving(false)
    if (error) { toast('Erro ao salvar', 'err'); return }
    setCfg(novoCfg); toast('✅ Configurações salvas!')
  }

  async function testarConexao() {
    setTestando(true)
    const { error } = await supabase.from('vx_storage').select('key').limit(1)
    setTestando(false)
    if (error) toast('❌ Falha: ' + error.message, 'err')
    else toast('✅ Conexão com Supabase OK!')
  }

  const GRUPOS_VARIAVEIS = [
    {
      titulo: '🏢 Contratada',
      desc: 'Dados da sua empresa (cadastrado em Configurações → Empresa)',
      cor: '#00d4ff',
      vars: [
        ['{{company}}',          'Nome fantasia da empresa contratada'],
        ['{{razao_empresa}}',    'Razão social da empresa contratada'],
        ['{{cnpj_empresa}}',     'CNPJ da empresa contratada'],
        ['{{responsavel}}',      'Responsável da empresa contratada'],
        ['{{telefone_empresa}}', 'Telefone da empresa contratada'],
        ['{{email_empresa}}',    'E-mail da empresa contratada'],
        ['{{endereco_empresa}}', 'Endereço completo da empresa contratada'],
      ]
    },
    {
      titulo: '🤝 Contratante',
      desc: 'Dados do cliente (puxado do cadastro em Configurações → Clientes)',
      cor: '#10b981',
      vars: [
        ['{{empresa}}',     'Nome fantasia do cliente'],
        ['{{razao}}',       'Razão social do cliente'],
        ['{{cnpj}}',        'CNPJ do cliente'],
        ['{{cpf}}',         'CPF do cliente (se pessoa física)'],
        ['{{contato}}',     'Nome do contato / responsável'],
        ['{{cpf_contato}}', 'CPF do contato principal'],
        ['{{email}}',       'E-mail do cliente'],
        ['{{telefone}}',    'Telefone do cliente'],
        ['{{endereco}}',    'Endereço completo do cliente'],
        ['{{cidade}}',      'Cidade do cliente'],
        ['{{uf}}',          'Estado (UF) do cliente'],
        ['{{regime}}',      'Regime tributário do cliente'],
        ['{{rimp_nome}}',   'Responsável pela implantação — nome'],
        ['{{rimp_email}}',  'Responsável pela implantação — e-mail'],
        ['{{rimp_tel}}',    'Responsável pela implantação — telefone'],
        ['{{rfin_nome}}',   'Responsável financeiro — nome'],
        ['{{rfin_email}}',  'Responsável financeiro — e-mail'],
        ['{{rfin_tel}}',    'Responsável financeiro — telefone'],
      ]
    },
    {
      titulo: '📦 Produtos e Serviços',
      desc: 'Dados dos módulos contratados (calculados no chat com base em Configurações → Produtos)',
      cor: '#7c3aed',
      vars: [
        ['{{plano}}',              'Plano contratado (Basic, Pro, Top, Top Plus)'],
        ['{{cnpjs_qty}}',          'Quantidade de CNPJs'],
        ['{{total_adesao}}',       'Valor total da adesão (soma dos módulos)'],
        ['{{total_mensal}}',       'Valor total da mensalidade (soma dos módulos)'],
        ['{{condicao_pagamento}}', 'Condição de pagamento negociada'],
        ['{{vencimento_adesao}}',  'Data de vencimento da adesão'],
        ['{{vencimento_mensal}}',  'Data de vencimento da mensalidade'],
        ['{{produtos_tabela}}',    'Tabela HTML completa dos módulos com adesão e mensalidade'],
        ['{{produtos_lista}}',     'Lista em texto dos módulos contratados'],
      ]
    },
    {
      titulo: '👤 Consultor e Sistema',
      desc: 'Dados do consultor que gerou o documento',
      cor: '#f59e0b',
      vars: [
        ['{{consultor_nome}}', 'Nome do consultor'],
        ['{{data_hora}}',      'Data e hora atual de geração do documento'],
        ['{{logo}}',           'Logo da empresa em base64 (para uso em <img src="{{logo}}">)'],
      ]
    },
  ]

  const tagStyle = {
    fontSize: 11, padding: '2px 8px', background: 'rgba(0,212,255,.08)', borderRadius: 4,
    color: '#00d4ff', fontFamily: 'monospace', cursor: 'pointer', userSelect: 'all',
    border: '1px solid rgba(0,212,255,.15)', display: 'inline-block', margin: '2px 0'
  }

  return (
    <div style={s.body}>
      <div style={s.sec}>
        <div style={s.secTitle}>✍️ Modelos de Documentos</div>
        <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 16, lineHeight: 1.6 }}>
          Importe um arquivo <strong style={{ color: 'var(--accent)' }}>.docx</strong> (recomendado) ou cole HTML.
          No DOCX, use as variáveis no formato <code style={{ color: '#10b981' }}>{'{{variavel}}'}</code> diretamente no Word.
          O sistema substituirá todas automaticamente ao gerar o documento.
        </p>

        {[
          ['proposta', '📋 Modelo de Proposta', propostaTemplate, setPropostaTemplate],
          ['contrato', '📄 Modelo de Contrato',  contratoTemplate, setContratoTemplate]
        ].map(([tipo, titulo, val, setter]) => (
          <div key={tipo} style={{ marginBottom: 24 }}>
            <div style={{ ...s.secTitle, marginBottom: 10 }}>{titulo}</div>

            {isDocx(val) ? (
              <div style={{ padding: '14px 18px', background: 'rgba(16,185,129,.08)', border: '1px solid rgba(16,185,129,.25)', borderRadius: 10, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 14 }}>
                <span style={{ fontSize: 24 }}>📄</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, color: '#10b981', fontSize: 13 }}>Template DOCX carregado com sucesso.</div>
                  <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 3, lineHeight: 1.5 }}>
                    Na hora de gerar o contrato/proposta, o sistema substituirá todas as variáveis <code style={{ color: '#10b981' }}>{'{{var}}'}</code> e gerará o download do arquivo Word preenchido.<br />
                    Tamanho: {Math.round((val.length * 0.75) / 1024)} KB (base64)
                  </div>
                </div>
                <button onClick={() => setter('')} style={{ padding: '6px 12px', borderRadius: 7, background: 'rgba(239,68,68,.1)', border: '1px solid rgba(239,68,68,.25)', color: 'var(--danger)', cursor: 'pointer', fontSize: 12 }}>🗑 Remover</button>
              </div>
            ) : (
              <textarea
                rows={7}
                style={{ ...s.input, fontFamily: 'monospace', fontSize: 12, resize: 'vertical', width: '100%', marginBottom: 8 }}
                value={val}
                onChange={e => setter(e.target.value)}
                placeholder={`Cole HTML aqui com variáveis como {{empresa}}, {{total_adesao}}, etc.`}
              />
            )}

            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <label style={{ fontSize: 12, color: 'var(--accent)', cursor: 'pointer', background: 'rgba(0,212,255,.1)', padding: '7px 14px', borderRadius: 8, border: '1px solid rgba(0,212,255,.25)', fontFamily: 'DM Mono, monospace', fontWeight: 600 }}>
                📁 Importar DOCX (recomendado)
                <input type="file" accept=".docx" onChange={e => handleFileUpload(tipo, e)} style={{ display: 'none' }} />
              </label>
              <label style={{ fontSize: 12, color: 'var(--muted)', cursor: 'pointer', background: 'var(--surface2)', padding: '7px 14px', borderRadius: 8, border: '1px solid var(--border)', fontFamily: 'DM Mono, monospace' }}>
                📃 Importar HTML/TXT
                <input type="file" accept=".txt,.html,.htm" onChange={e => handleFileUpload(tipo, e)} style={{ display: 'none' }} />
              </label>
              {val && !isDocx(val) && (
                <button onClick={() => setter('')} style={{ fontSize: 12, color: 'var(--danger)', background: 'rgba(239,68,68,.1)', padding: '7px 12px', borderRadius: 8, border: '1px solid rgba(239,68,68,.25)', cursor: 'pointer', fontFamily: 'DM Mono, monospace' }}>🗑 Remover</button>
              )}
            </div>
          </div>
        ))}

        <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
          <button style={s.saveBtn} onClick={salvar} disabled={saving}>{saving ? '⏳...' : '✅ Salvar'}</button>
          <button onClick={testarConexao} disabled={testando} style={{ padding: '11px 18px', borderRadius: 10, background: 'rgba(0,212,255,.1)', border: '1px solid rgba(0,212,255,.3)', color: 'var(--accent)', fontFamily: 'DM Mono, monospace', fontSize: 13, cursor: 'pointer' }}>{testando ? '⏳...' : '🔌 Testar Conexão'}</button>
        </div>
      </div>

      {/* Variáveis organizadas por seção */}
      <div style={s.sec}>
        <div style={s.secTitle}>📋 Variáveis disponíveis — use no DOCX ou no HTML</div>
        <p style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 16, lineHeight: 1.6 }}>
          Clique em qualquer variável para selecionar e copiar. No DOCX Word, coloque-as exatamente como mostradas abaixo (com as chaves duplas).
        </p>

        {GRUPOS_VARIAVEIS.map((grupo, gi) => (
          <div key={gi} style={{ marginBottom: 20, border: `1px solid ${grupo.cor}22`, borderRadius: 12, overflow: 'hidden' }}>
            <div style={{ background: grupo.cor + '12', borderBottom: `1px solid ${grupo.cor}22`, padding: '10px 16px' }}>
              <div style={{ fontFamily: 'Syne, sans-serif', fontSize: 13, fontWeight: 700, color: grupo.cor }}>{grupo.titulo}</div>
              <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>{grupo.desc}</div>
            </div>
            <div style={{ padding: '12px 16px', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 6 }}>
              {grupo.vars.map(([v, desc]) => (
                <div key={v} style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                  <span
                    style={{ ...tagStyle, color: grupo.cor, background: grupo.cor + '10', borderColor: grupo.cor + '30' }}
                    onClick={() => { navigator.clipboard?.writeText(v); toast(`✅ ${v} copiado!`) }}>
                    {v}
                  </span>
                  <span style={{ fontSize: 11, color: 'var(--muted)', lineHeight: 1.4 }}>{desc}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Instruções DOCX */}
      <div style={{ ...s.sec, padding: '16px 18px', background: 'rgba(124,58,237,.06)', border: '1px solid rgba(124,58,237,.2)', borderRadius: 12 }}>
        <div style={{ fontFamily: 'Syne, sans-serif', fontSize: 13, fontWeight: 700, color: '#a78bfa', marginBottom: 10 }}>📝 Como usar no Word (.docx)</div>
        <ol style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 2, paddingLeft: 18 }}>
          <li>Abra seu modelo no Word e posicione o cursor onde quer inserir a variável</li>
          <li>Digite a variável exatamente como mostrada acima — ex: <code style={{ color: '#a78bfa' }}>{'{{empresa}}'}</code></li>
          <li>Salve o arquivo como <strong style={{ color: 'var(--text)' }}>.docx</strong> normalmente</li>
          <li>Importe o arquivo no campo acima clicando em "Importar DOCX"</li>
          <li>Ao gerar uma proposta ou contrato no Chat, o sistema substituirá todas as variáveis automaticamente</li>
          <li>O documento final é exibido em tela e você pode imprimir, salvar em PDF ou enviar para assinatura</li>
        </ol>
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
// PÁGINA PRINCIPAL — com leitura de ?tab= na URL
// ══════════════════════════════════════════════
export default function Configuracoes() {
  const router    = useRouter()
  const [loading,   setLoading]   = useState(true)
  const [perfil,    setPerfil]    = useState(null)
  const [empresaId, setEmpresaId] = useState(null)
  const [cfg,       setCfg]       = useState({})
  const [abaAtiva,  setAbaAtiva]  = useState('empresa')

  // Lê o parâmetro ?tab= da URL e ativa a aba correspondente
  useEffect(() => {
    if (!router.isReady) return
    const { tab } = router.query
    if (tab && TABS.find(t => t.id === tab)) {
      setAbaAtiva(tab)
    }
  }, [router.isReady, router.query])

  // Muda aba e atualiza a URL
  function mudarAba(id) {
    setAbaAtiva(id)
    router.replace(
      { pathname: '/configuracoes', query: { tab: id } },
      undefined,
      { shallow: true }
    )
  }

  useEffect(() => {
    async function init() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.push('/'); return }

      let { data: perf } = await supabase.from('perfis').select('*').eq('user_id', session.user.id).maybeSingle()
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
      case 'empresa':       return <TabEmpresa    {...props} />
      case 'metas':         return <TabMetas      {...props} />
      case 'kpis':          return <TabKpis       {...props} />
      case 'perfis':        return <TabPerfis     {...props} />
      case 'usuarios':      return <TabUsuarios   {...props} />
      case 'produtos':      return <TabProdutos   {...props} />
      case 'documentos':    return <TabDocumentos {...props} />
      case 'clientes':      return <TabClientes   {...props} />
      // As abas abaixo devem ser importadas/copiadas do seu arquivo original:
      // case 'descontos':     return <TabDescontos  {...props} />
      // case 'vouchers':      return <TabVouchers   {...props} />
      // case 'tema':          return <TabTema       {...props} />
      // case 'whatsapp':      return <TabWhatsapp   {...props} />
      // case 'agente_ia':     return <TabAgenteIA   {...props} />
      // case 'departamentos': return <TabDepartamentos {...props} />
      // case 'integracoes':   return <TabIntegracoes  {...props} />
      // case 'google_meta':   return <TabGoogleMeta   {...props} />
      default: return <div style={{ padding: 24, color: 'var(--muted)', fontSize: 13 }}>Selecione uma aba</div>
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
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=DM+Mono:wght@300;400;500&display=swap');
        [data-theme="dark"]{--bg:#0a0f1e;--surface:#111827;--surface2:#1a2540;--border:#1e2d4a;--accent:#00d4ff;--accent2:#7c3aed;--accent3:#10b981;--text:#e2e8f0;--muted:#64748b;--danger:#ef4444;--warning:#f59e0b}
        [data-theme="light"]{--bg:#f0f4f8;--surface:#ffffff;--surface2:#f8fafc;--border:#e2e8f0;--accent:#0099bb;--accent2:#7c3aed;--accent3:#059669;--text:#1e293b;--muted:#64748b;--danger:#ef4444;--warning:#d97706}
        *{box-sizing:border-box;margin:0;padding:0}
        body{font-family:'DM Mono',monospace;background:var(--bg);color:var(--text);min-height:100vh}
        input:focus,select:focus,textarea:focus{border-color:var(--accent)!important;outline:none}
      `}</style>

      <div id="vx-toast" style={{ position: 'fixed', bottom: 30, left: '50%', transform: 'translateX(-50%) translateY(20px)', background: 'rgba(16,185,129,.9)', color: '#fff', padding: '12px 24px', borderRadius: 10, fontFamily: 'DM Mono, monospace', fontSize: 14, zIndex: 9999, opacity: 0, transition: 'opacity .3s, transform .3s', boxShadow: '0 4px 20px rgba(0,0,0,.3)' }} />

      <Navbar cfg={cfg} perfil={perfil} />

      <main style={{ position: 'relative', zIndex: 10, width: '100%', maxWidth: 960, margin: '20px auto 60px', padding: '0 20px' }}>
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, overflow: 'hidden', boxShadow: '0 4px 24px rgba(0,0,0,.4)' }}>
          <div style={{ background: 'var(--surface2)', borderBottom: '1px solid var(--border)', padding: '16px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <h3 style={{ fontFamily: 'Syne, sans-serif', fontSize: 16, fontWeight: 700, color: 'var(--accent)' }}>⚙️ Configurações</h3>
            <div style={{ fontSize: 12, color: 'var(--muted)' }}>{perfil?.nome && `Olá, ${perfil.nome}`}</div>
          </div>

          {/* Tabs — usando mudarAba() para sincronizar URL */}
          <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', background: 'var(--surface)', overflowX: 'auto' }}>
            {TABS.map(t => (
              <button
                key={t.id}
                onClick={() => mudarAba(t.id)}
                style={{
                  flexShrink: 0, padding: '11px 14px', border: 'none', background: 'none',
                  color: abaAtiva === t.id ? 'var(--accent)' : 'var(--muted)',
                  fontFamily: 'DM Mono, monospace', fontSize: 12, cursor: 'pointer',
                  borderBottom: `2px solid ${abaAtiva === t.id ? 'var(--accent)' : 'transparent'}`,
                  letterSpacing: .3, whiteSpace: 'nowrap', transition: 'color .2s', position: 'relative', top: 1
                }}>
                {t.label}
              </button>
            ))}
          </div>

          {renderAba()}
        </div>
      </main>
    </>
  )
}

export async function getServerSideProps() {
  return { props: {} }
}
