// pages/configuracoes.js
import React, { useState, useEffect, useRef, Fragment } from 'react'
import { useRouter } from 'next/router'
import { supabase } from '../lib/supabase'
import Navbar from '../components/Navbar'

// ══════════════════════════════════════════════
// CONSTANTES
// ══════════════════════════════════════════════
const TABS = [
  { id: 'empresa',    label: '🏢 Empresa' },
  { id: 'metas',      label: '🎯 Metas' },
  { id: 'kpis',       label: '📊 KPIs' },
  { id: 'perfis',     label: '🛡️ Perfis' },
  { id: 'usuarios',   label: '👥 Usuários' },
  { id: 'produtos',   label: '📦 Produtos' },
  { id: 'descontos',  label: '🏷️ Descontos' },
  { id: 'vouchers',   label: '🎫 Vouchers' },
  { id: 'documentos', label: '📄 Documentos' },
  { id: 'clientes',   label: '🗃️ Clientes' },
  { id: 'tema',       label: '🎨 Tema' },
  { id: 'whatsapp',      label: '💬 WhatsApp' },
  { id: 'agente_ia',     label: '🤖 Agente IA' },
  { id: 'departamentos', label: '🏢 Departamentos' },
  { id: 'integracoes',  label: '🔗 Integrações' },
  { id: 'google_meta',  label: '📍 Google & Meta' },
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
  // Dashboard e Chat
  { id: 'ver_dashboard',      label: '📊 Ver Dashboard' },
  { id: 'ver_chat',           label: '💬 Usar Chat' },
  // Propostas e Contratos
  { id: 'gerar_proposta',     label: '📄 Gerar Proposta' },
  { id: 'gerar_contrato',     label: '📝 Gerar Contrato' },
  // CRM
  { id: 'ver_crm',            label: '🏆 Ver CRM' },
  { id: 'editar_crm',         label: '✏️ Editar CRM (negócios/atividades)' },
  { id: 'excluir_crm',        label: '🗑️ Excluir registros CRM' },
  // Clientes
  { id: 'ver_clientes',       label: '🗃️ Ver Clientes' },
  // Relatórios
  { id: 'ver_relatorios',     label: '📑 Ver Relatórios' },
  // KPIs
  { id: 'ver_kpis',           label: '📈 Ver KPIs' },
  { id: 'lancar_kpis',        label: '✏️ Lançar KPIs diários' },
  // Vouchers
  { id: 'ver_vouchers',       label: '🎫 Ver/Gerar Vouchers' },
  // WhatsApp Inbox
  { id: 'ver_inbox',          label: '💬 WhatsApp Inbox' },
  { id: 'transferir_conversa', label: '🔄 Transferir Conversas' },
  // Configurações (quem pode mexer)
  { id: 'ver_configuracoes',  label: '⚙️ Ver Configurações' },
  { id: 'editar_configuracoes', label: '🔧 Editar Configurações' },
  { id: 'editar_precos',      label: '💲 Editar Preços' },
  { id: 'gerenciar_usuarios', label: '👥 Gerenciar Usuários' },
  // Google Agenda
  { id: 'usar_google_agenda', label: '📅 Usar Google Agenda' },
]
const PERMISSOES_ADMIN = PERMISSOES_DISPONIVEIS.map(p => p.id)
const PERMISSOES_USER  = ['ver_dashboard','ver_chat','gerar_proposta','gerar_contrato','ver_clientes','ver_kpis','lancar_kpis','ver_crm','editar_crm','ver_relatorios','ver_inbox','usar_google_agenda']

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
    setOpenaiApiKey(cfg.openaiApiKey || '')
    setRazaoSocial(cfg.razaoSocial || '')
    setCnpjEmpresa(cfg.cnpjEmpresa || '')
    setTelefoneEmp(cfg.telefoneEmp || '')
    setEmailEmp(cfg.emailEmp || '')
    setResponsavel(cfg.responsavel || '')
    setEnderecoEmp(cfg.enderecoEmp || '')
    setSignEmail(cfg.signConfig?.email || '')
    setSignWpp(cfg.signConfig?.wpp || '')
    setSignUrl(cfg.signConfig?.url || '')
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
      geminiApiKey, groqApiKey, openaiApiKey,
      razaoSocial, cnpjEmpresa, telefoneEmp, emailEmp, responsavel, enderecoEmp,
      signConfig: { email: signEmail, wpp: signWpp, url: signUrl },
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
        <div style={s.field}>
          <label style={s.label}>Chave API OpenAI</label>
          <input style={s.input} type="password" value={openaiApiKey} onChange={e => setOpenaiApiKey(e.target.value)} placeholder="sk-..." />
          <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>Obtenha em <a href="https://platform.openai.com/api-keys" target="_blank" rel="noreferrer" style={{ color: 'var(--accent)' }}>platform.openai.com</a> — usada no Agente IA do WhatsApp.</div>
        </div>
      </div>

      <div style={s.sec}>
        <div style={s.secTitle}>✍️ Assinatura Eletrônica</div>
        <div style={s.row2}>
          <div style={s.field}><label style={s.label}>E-mail remetente</label><input type="email" style={s.input} value={signEmail} onChange={e => setSignEmail(e.target.value)} placeholder="noreply@empresa.com" /></div>
          <div style={s.field}><label style={s.label}>WhatsApp da empresa</label><input style={s.input} value={signWpp} onChange={e => setSignWpp(e.target.value)} placeholder="5531984059125" /></div>
        </div>
        <div style={s.field}><label style={s.label}>URL base do sistema (para links de assinatura)</label><input style={s.input} value={signUrl} onChange={e => setSignUrl(e.target.value)} placeholder="https://seusite.com" /></div>
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
    const novos = form.id
      ? perfis.map(p => p.id === form.id ? form : p)
      : [...perfis, { ...form, id: 'p_' + Date.now() }]
    const novoCfg = { ...cfg, perfisCustom: novos }
    const { error } = await salvarStorage(empresaId, novoCfg)
    setSaving(false)
    if (error) { toast('Erro ao salvar', 'err'); return }
    setPerfis(novos); setCfg(novoCfg); setForm(null)
    toast('✅ Perfil salvo!')
  }

  async function removerPerfil(id) {
    if (!confirm('Remover perfil?')) return
    const novos   = perfis.filter(p => p.id !== id)
    const novoCfg = { ...cfg, perfisCustom: novos }
    await salvarStorage(empresaId, novoCfg)
    setPerfis(novos); setCfg(novoCfg)
    toast('🗑 Perfil removido!')
  }

  return (
    <div style={s.body}>
      <div style={s.sec}>
        <div style={s.secTitle}>🛡️ Perfis de Acesso</div>
        <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 14, lineHeight: 1.6 }}>
          Crie perfis personalizados com permissões específicas. Os perfis Admin e Vendedor são padrão do sistema e não podem ser removidos.
        </p>

        {perfisDefault.map(p => (
          <div key={p.id} style={{ padding: '12px 16px', background: 'rgba(0,212,255,.04)', border: '1px solid rgba(0,212,255,.15)', borderRadius: 10, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600, color: 'var(--accent)', fontSize: 14 }}>{p.nome} <span style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 400 }}>(padrão)</span></div>
              <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 3 }}>{p.permissoes.length} permissões</div>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, maxWidth: 400 }}>
              {p.permissoes.slice(0, 5).map(perm => {
                const desc = PERMISSOES_DISPONIVEIS.find(x => x.id === perm)
                return desc ? <span key={perm} style={{ fontSize: 10, padding: '2px 8px', background: 'rgba(0,212,255,.1)', borderRadius: 4, color: 'var(--accent)' }}>{desc.label}</span> : null
              })}
              {p.permissoes.length > 5 && <span style={{ fontSize: 10, color: 'var(--muted)' }}>+{p.permissoes.length - 5}</span>}
            </div>
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

        <button onClick={() => setForm({ ...emptyPerfil })}
          style={{ padding: '10px 18px', borderRadius: 9, background: 'rgba(0,212,255,.08)', border: '1px solid rgba(0,212,255,.2)', color: 'var(--accent)', fontFamily: 'DM Mono, monospace', fontSize: 13, cursor: 'pointer', marginTop: 8 }}>
          + Novo Perfil
        </button>
      </div>

      {form && (
        <div style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 12, padding: 18 }}>
          <div style={{ ...s.secTitle, marginBottom: 14 }}>Dados do Perfil</div>
          <div style={s.field}>
            <label style={s.label}>Nome do Perfil</label>
            <input style={s.input} value={form.nome} onChange={e => setForm(f => ({ ...f, nome: e.target.value }))} placeholder="Ex: Supervisor, Gerente..." />
          </div>
          <div style={s.field}>
            <label style={s.label}>Permissões</label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginTop: 6 }}>
              {PERMISSOES_DISPONIVEIS.map(p => (
                <label key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 12, color: 'var(--text)', padding: '7px 10px', background: (form.permissoes || []).includes(p.id) ? 'rgba(0,212,255,.08)' : 'transparent', borderRadius: 6, border: `1px solid ${(form.permissoes || []).includes(p.id) ? 'rgba(0,212,255,.25)' : 'transparent'}` }}>
                  <input type="checkbox" checked={(form.permissoes || []).includes(p.id)} onChange={() => togglePerm(p.id)} />
                  {p.label}
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
// ABA USUÁRIOS — com campos de comissão
// ══════════════════════════════════════════════
function TabUsuarios({ cfg, setCfg, empresaId }) {
  const [users,  setUsers]  = useState(cfg.users || [])
  const [form,   setForm]   = useState(null)
  const [saving, setSaving] = useState(false)

  const perfisCustom = cfg.perfisCustom || []
  const perfisTipos = [
    { id: 'admin',   nome: 'Admin',    permissoes: PERMISSOES_ADMIN },
    { id: 'vendedor',nome: 'Vendedor', permissoes: PERMISSOES_USER  },
    ...perfisCustom.map(p => ({ id: p.id, nome: p.nome, permissoes: p.permissoes || [] }))
  ]

  const emptyComissao = { adesao: { tipo: 'percentual', valor: 0 }, mensalidade: { tipo: 'percentual', valor: 0 } }
  const emptyUser = { id: '', nome: '', email: '', username: '', password: '', telefone: '', tipo: 'vendedor', permissoes: [...PERMISSOES_USER], comissao: emptyComissao }

  function aplicarPerfil(tipo) {
    const p = perfisTipos.find(x => x.id === tipo)
    setForm(f => ({ ...f, tipo, permissoes: p ? [...p.permissoes] : [] }))
  }

  function updateComissao(campo, chave, valor) {
    setForm(f => ({
      ...f,
      comissao: {
        ...(f.comissao || emptyComissao),
        [campo]: { ...(f.comissao?.[campo] || { tipo: 'percentual', valor: 0 }), [chave]: valor }
      }
    }))
  }

  async function salvarUser() {
    if (!form.nome || !form.email) { toast('Nome e e-mail obrigatórios', 'err'); return }
    setSaving(true)
    const userToSave = { ...form, comissao: form.comissao || emptyComissao }
    const novos = form.id
      ? users.map(u => u.id === form.id ? userToSave : u)
      : [...users, { ...userToSave, id: Date.now().toString() }]
    const novoCfg = { ...cfg, users: novos }
    const { error } = await salvarStorage(empresaId, novoCfg)
    setSaving(false)
    if (error) { toast('Erro ao salvar', 'err'); return }
    setUsers(novos); setCfg(novoCfg); setForm(null)
    toast('✅ Usuário salvo!')
  }

  async function removerUser(id) {
    if (!confirm('Remover usuário?')) return
    const novos   = users.filter(u => u.id !== id)
    const novoCfg = { ...cfg, users: novos }
    await salvarStorage(empresaId, novoCfg)
    setUsers(novos); setCfg(novoCfg)
    toast('🗑 Usuário removido!')
  }

  const fmtComissao = (u) => {
    const c = u.comissao
    if (!c) return ''
    const ad = c.adesao?.tipo === 'percentual' ? `${c.adesao.valor}% adesão` : `R$ ${c.adesao?.valor || 0} adesão`
    const men = c.mensalidade?.tipo === 'percentual' ? `${c.mensalidade.valor}% mensalidade` : `R$ ${c.mensalidade?.valor || 0} mensalidade`
    return `${ad} · ${men}`
  }

  const ComissaoField = ({ campo, label }) => {
    const val = form?.comissao?.[campo] || { tipo: 'percentual', valor: 0 }
    return (
      <div style={{ background: 'rgba(0,212,255,.04)', border: '1px solid rgba(0,212,255,.12)', borderRadius: 10, padding: '12px 14px', marginBottom: 10 }}>
        <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: .5 }}>{label}</div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <div style={{ display: 'flex', borderRadius: 8, overflow: 'hidden', border: '1px solid var(--border)', flexShrink: 0 }}>
            {['percentual','valor_fixo'].map(tipo => (
              <button key={tipo} onClick={() => updateComissao(campo, 'tipo', tipo)}
                style={{ padding: '7px 14px', border: 'none', background: val.tipo === tipo ? 'var(--accent)' : 'var(--surface)', color: val.tipo === tipo ? '#000' : 'var(--muted)', fontFamily: 'DM Mono, monospace', fontSize: 11, cursor: 'pointer', fontWeight: val.tipo === tipo ? 700 : 400 }}>
                {tipo === 'percentual' ? '% Percentual' : 'R$ Valor Fixo'}
              </button>
            ))}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1 }}>
            <input type="number" min={0} step={val.tipo === 'percentual' ? 0.5 : 1}
              style={{ ...s.input, marginBottom: 0, width: 110, textAlign: 'right' }}
              value={val.valor || ''}
              onChange={e => updateComissao(campo, 'valor', Number(e.target.value))}
              placeholder="0"
            />
            <span style={{ fontSize: 13, color: 'var(--muted)', flexShrink: 0 }}>{val.tipo === 'percentual' ? '%' : 'R$'}</span>
          </div>
        </div>
        {val.valor > 0 && (
          <div style={{ fontSize: 11, color: 'var(--accent3)', marginTop: 6 }}>
            {val.tipo === 'percentual'
              ? `Sobre o valor do contrato: ${val.valor}% por operação`
              : `Valor fixo: R$ ${Number(val.valor).toLocaleString('pt-BR', { minimumFractionDigits: 2 })} por operação`}
          </div>
        )}
      </div>
    )
  }

  return (
    <div style={s.body}>
      <div style={s.sec}>
        <div style={s.secTitle}>Usuários Cadastrados</div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 14 }}>
          <button onClick={() => setForm({ ...emptyUser, comissao: { ...emptyComissao } })} style={{ padding: '10px 16px', borderRadius: 9, background: 'rgba(0,212,255,.1)', border: '1px solid rgba(0,212,255,.25)', color: 'var(--accent)', fontFamily: 'DM Mono, monospace', fontSize: 12, cursor: 'pointer' }}>+ Novo Usuário</button>
        </div>
        {users.length === 0 && !form && <p style={{ color: 'var(--muted)', fontSize: 13 }}>Nenhum usuário cadastrado.</p>}
        {users.map(u => {
          if (!u) return null
          return (
            <div key={u.id} style={{ padding: '12px 16px', background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 10, display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, color: 'var(--accent)', fontSize: 14 }}>{u.nome}</div>
                <div style={{ fontSize: 12, color: 'var(--muted)' }}>{u.email} · {u.tipo || 'vendedor'}{u.telefone ? ` · ${u.telefone}` : ''}</div>
                {u.comissao && (u.comissao.adesao?.valor > 0 || u.comissao.mensalidade?.valor > 0) && (
                  <div style={{ fontSize: 11, color: 'var(--accent3)', marginTop: 3 }}>💰 Comissão: {fmtComissao(u)}</div>
                )}
              </div>
              <button onClick={() => setForm({ ...u, comissao: u.comissao || { ...emptyComissao } })} style={{ padding: '5px 10px', borderRadius: 7, background: 'rgba(0,212,255,.1)', border: '1px solid rgba(0,212,255,.2)', color: 'var(--accent)' }}>✏️</button>
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
          <div style={s.row2}>
            <div style={s.field}><label style={s.label}>Telefone / WhatsApp</label><input style={s.input} value={form.telefone || ''} onChange={e => setForm(f => ({ ...f, telefone: e.target.value }))} placeholder="(00) 00000-0000" /></div>
            <div style={s.field}></div>
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
            <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 6 }}>
              Crie e edite perfis na aba <strong style={{color:'var(--accent)'}}>🛡️ Perfis</strong>. As permissões são aplicadas automaticamente.
            </div>
          </div>
          <div style={{ padding: '10px 14px', background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12, color: 'var(--muted)', marginBottom: 16 }}>
            <strong style={{color:'var(--text)'}}>Permissões do perfil "{perfisTipos.find(p => p.id === form.tipo)?.nome || form.tipo}":</strong>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 6 }}>
              {(form.permissoes || []).map(perm => {
                const desc = PERMISSOES_DISPONIVEIS.find(x => x.id === perm)
                return desc ? <span key={perm} style={{ fontSize: 11, padding: '2px 8px', background: 'rgba(0,212,255,.1)', borderRadius: 4, color: 'var(--accent)' }}>{desc.label}</span> : null
              })}
              {(form.permissoes || []).length === 0 && <span style={{color:'var(--muted)'}}>Nenhuma permissão</span>}
            </div>
          </div>

          {/* ── SEÇÃO COMISSÃO ── */}
          <div style={{ borderTop: '1px solid var(--border)', paddingTop: 16, marginTop: 4 }}>
            <div style={{ ...s.secTitle, marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
              💰 Configuração de Comissão
              <span style={{ fontSize: 10, fontWeight: 400, color: 'var(--muted)', textTransform: 'none', letterSpacing: 0, borderRadius: 6, background: 'rgba(16,185,129,.1)', border: '1px solid rgba(16,185,129,.2)', padding: '2px 8px', color: 'var(--accent3)' }}>
                aparece em Financeiro → Comissões
              </span>
            </div>
            <p style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 14, lineHeight: 1.6 }}>
              Define quanto o usuário recebe por contrato assinado — pode ser percentual sobre o valor do contrato ou valor fixo em R$.
            </p>
            <div style={s.row2}>
              <ComissaoField campo="adesao" label="💵 Comissão sobre Adesão" />
              <ComissaoField campo="mensalidade" label="🔄 Comissão sobre Mensalidade" />
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

  const [editMod,    setEditMod]    = useState(null)
  const [novoMod,    setNovoMod]    = useState('')
  const [formPlano,  setFormPlano]  = useState(null)

  function addModulo() {
    if (!novoMod.trim()) return
    const mod = novoMod.trim()
    if (modulos.includes(mod)) { toast('Módulo já existe', 'err'); return }
    setModulos(prev => [...prev, mod])
    setPrecos(prev => {
      const n = { ...prev }
      n[mod] = {}
      planos.forEach(p => { n[mod][p.id] = [0,0] })
      return n
    })
    setNovoMod('')
  }
  function renameModulo(oldName, newName) {
    if (!newName.trim() || newName === oldName) { setEditMod(null); return }
    setModulos(prev => prev.map(m => m === oldName ? newName.trim() : m))
    setPrecos(prev => {
      const n = { ...prev }
      n[newName.trim()] = n[oldName] || {}
      delete n[oldName]
      return n
    })
    setEditMod(null)
  }
  function removeModulo(mod) {
    if (!confirm(`Remover módulo "${mod}"?`)) return
    setModulos(prev => prev.filter(m => m !== mod))
    setPrecos(prev => { const n = { ...prev }; delete n[mod]; return n })
  }

  const emptyPlano = { id: '', name: '', maxCnpjs: 25, usuarios: 1 }
  function salvarPlano() {
    if (!formPlano.name.trim()) { toast('Nome do plano obrigatório', 'err'); return }
    const id = formPlano.id || formPlano.name.trim().toLowerCase().replace(/\s+/g, '_')
    const novo = { ...formPlano, id, name: formPlano.name.trim(), maxCnpjs: Number(formPlano.maxCnpjs)||25, usuarios: Number(formPlano.usuarios)||1 }
    if (formPlano._isNew) {
      setPlanos(prev => [...prev, novo])
      setPrecos(prev => {
        const n = { ...prev }
        modulos.forEach(mod => { if (!n[mod]) n[mod] = {}; n[mod][id] = [0,0] })
        return n
      })
    } else {
      setPlanos(prev => prev.map(p => p.id === formPlano.id ? novo : p))
    }
    setFormPlano(null)
  }
  function removePlano(id) {
    if (!confirm('Remover plano?')) return
    setPlanos(prev => prev.filter(p => p.id !== id))
    setPrecos(prev => {
      const n = { ...prev }
      Object.keys(n).forEach(mod => { if (n[mod][id]) delete n[mod][id] })
      return n
    })
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
    setCfg(novoCfg)
    toast('✅ Produtos salvos!')
  }

  const btnSubAba = (id, label) => (
    <button onClick={() => setSubAba(id)} style={{ padding: '7px 14px', borderRadius: 8, border: `1px solid ${subAba===id?'var(--accent)':'var(--border)'}`, background: subAba===id?'rgba(0,212,255,.1)':'var(--surface2)', color: subAba===id?'var(--accent)':'var(--muted)', fontFamily: 'DM Mono, monospace', fontSize: 12, cursor: 'pointer', fontWeight: subAba===id?600:400 }}>
      {label}
    </button>
  )

  return (
    <div style={s.body}>
      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        {btnSubAba('tabela',  '💰 Tabela de Preços')}
        {btnSubAba('modulos', '📦 Módulos')}
        {btnSubAba('planos',  '🗂️ Planos')}
      </div>

      {subAba === 'tabela' && (
        <div style={s.sec}>
          <div style={s.secTitle}>💰 Tabela de Preços (Adesão / Mensalidade)</div>
          <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 14 }}>Edite os valores de adesão e mensalidade por módulo e plano. Estes valores alimentam diretamente o chat.</p>
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
                        <td style={{ padding: '4px 6px' }}>
                          <input type="number" min={0} value={precos[mod]?.[p.id]?.[0] ?? 0}
                            onChange={e => updatePreco(mod, p.id, 0, e.target.value)}
                            style={{ ...s.input, padding: '4px 8px', width: 80, fontSize: 12 }} />
                        </td>
                        <td style={{ padding: '4px 6px' }}>
                          <input type="number" min={0} value={precos[mod]?.[p.id]?.[1] ?? 0}
                            onChange={e => updatePreco(mod, p.id, 1, e.target.value)}
                            style={{ ...s.input, padding: '4px 8px', width: 80, fontSize: 12 }} />
                        </td>
                      </Fragment>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p style={{ fontSize: 11, color: 'var(--muted)', marginTop: 10 }}>💡 Para adicionar módulos ou planos use as abas acima.</p>
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
                <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>Máx. {p.maxCnpjs} CNPJs · {p.usuarios} usuário{p.usuarios !== 1 ? 's' : ''} · ID: <code style={{ color: 'var(--accent3)' }}>{p.id}</code></div>
              </div>
              <button onClick={() => setFormPlano({ ...p, _isNew: false })} style={{ padding: '5px 10px', borderRadius: 7, background: 'rgba(0,212,255,.1)', border: '1px solid rgba(0,212,255,.2)', color: 'var(--accent)', cursor: 'pointer' }}>✏️</button>
              <button onClick={() => removePlano(p.id)} style={{ padding: '5px 10px', borderRadius: 7, background: 'rgba(239,68,68,.1)', border: '1px solid rgba(239,68,68,.2)', color: 'var(--danger)', cursor: 'pointer' }}>🗑</button>
            </div>
          ))}
          <button onClick={() => setFormPlano({ ...emptyPlano, _isNew: true })} style={{ padding: '10px 18px', borderRadius: 9, background: 'rgba(0,212,255,.08)', border: '1px solid rgba(0,212,255,.2)', color: 'var(--accent)', fontFamily: 'DM Mono, monospace', fontSize: 13, cursor: 'pointer', marginTop: 8 }}>+ Novo Plano</button>

          {formPlano && (
            <div style={{ marginTop: 16, padding: 18, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12 }}>
              <div style={{ ...s.secTitle, marginBottom: 14 }}>{formPlano._isNew ? 'Novo Plano' : `Editar: ${formPlano.name}`}</div>
              <div style={s.row2}>
                <div style={s.field}><label style={s.label}>Nome do Plano</label><input style={s.input} value={formPlano.name} onChange={e => setFormPlano(f => ({ ...f, name: e.target.value }))} placeholder="Ex: Basic, Pro..." /></div>
                <div style={s.field}><label style={s.label}>ID (chave única)</label><input style={s.input} value={formPlano.id} onChange={e => setFormPlano(f => ({ ...f, id: e.target.value.toLowerCase().replace(/\s+/g,'_') }))} placeholder="Ex: basic, pro..." disabled={!formPlano._isNew} /></div>
              </div>
              <div style={s.row2}>
                <div style={s.field}><label style={s.label}>Máx. CNPJs</label><input type="number" min={1} style={s.input} value={formPlano.maxCnpjs} onChange={e => setFormPlano(f => ({ ...f, maxCnpjs: e.target.value }))} /></div>
                <div style={s.field}><label style={s.label}>Usuários inclusos</label><input type="number" min={1} style={s.input} value={formPlano.usuarios} onChange={e => setFormPlano(f => ({ ...f, usuarios: e.target.value }))} /></div>
              </div>
              <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
                <button style={s.saveBtn} onClick={salvarPlano}>✅ Salvar Plano</button>
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
// ABA DESCONTOS
// ══════════════════════════════════════════════
function TabDescontos({ cfg, setCfg, empresaId }) {
  const [discMode,     setDiscMode]     = useState(cfg.discMode     || 'screen')
  const [discAdPct,    setDiscAdPct]    = useState(Number(cfg.discAdPct)    !== undefined ? Number(cfg.discAdPct) : 50)
  const [discMenPct,   setDiscMenPct]   = useState(Number(cfg.discMenPct)   || 0)
  const [discClosePct, setDiscClosePct] = useState(Number(cfg.discClosePct) !== undefined ? Number(cfg.discClosePct) : 40)
  const [saving,       setSaving]       = useState(false)

  useEffect(() => {
    setDiscMode(cfg.discMode || 'screen')
    setDiscAdPct(cfg.discAdPct !== undefined ? Number(cfg.discAdPct) : 50)
    setDiscMenPct(Number(cfg.discMenPct) || 0)
    setDiscClosePct(cfg.discClosePct !== undefined ? Number(cfg.discClosePct) : 40)
  }, [cfg])

  async function salvar() {
    setSaving(true)
    const novoCfg = { ...cfg, discMode, discAdPct: Number(discAdPct), discMenPct: Number(discMenPct), discClosePct: Number(discClosePct) }
    const { error } = await salvarStorage(empresaId, novoCfg)
    setSaving(false)
    if (error) { toast('Erro ao salvar', 'err'); return }
    setCfg(novoCfg)
    toast('✅ Descontos salvos!')
  }

  const Toggle = ({ on, onToggle, label, desc }) => (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'14px 0', borderBottom:'1px solid var(--border)' }}>
      <div>
        <div style={{ fontWeight:600, color:'var(--text)', fontSize:14 }}>{label}</div>
        <div style={{ fontSize:12, color:'var(--muted)', marginTop:3 }}>{desc}</div>
      </div>
      <div onClick={onToggle} style={{ width:48, height:26, borderRadius:13, background: on ? 'var(--accent3)' : 'var(--border)', cursor:'pointer', position:'relative', transition:'background .2s', flexShrink:0 }}>
        <div style={{ position:'absolute', top:3, left: on ? 24 : 3, width:20, height:20, borderRadius:10, background:'#fff', transition:'left .2s' }}/>
      </div>
    </div>
  )

  return (
    <div style={s.body}>
      <div style={s.sec}>
        <div style={s.secTitle}>🏷️ Modo de Desconto</div>
        <Toggle on={discMode==='screen'} onToggle={()=>setDiscMode(discMode==='screen'?'voucher':'screen')} label="Desconto em Tela" desc="Mostra desconto após o preço cheio automaticamente no chat" />
        <Toggle on={discMode==='voucher'} onToggle={()=>setDiscMode(discMode==='voucher'?'screen':'voucher')} label="Somente via Voucher" desc="Desconto só é aplicado com código de voucher válido" />
      </div>

      <div style={s.sec}>
        <div style={s.secTitle}>📊 Percentuais de Desconto</div>
        <p style={{ fontSize:13, color:'var(--muted)', marginBottom:16, lineHeight:1.6 }}>
          Estes percentuais são aplicados automaticamente no chat. O preço inicial exibido é sempre: <strong style={{color:'var(--text)'}}>Adesão ×2 e Mensalidade +20%</strong>. Em seguida o sistema mostra o desconto de tela e por último o de fechamento.
        </p>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:14 }}>
          <div style={s.field}>
            <label style={s.label}>% Adesão (desconto em tela)</label>
            <input type="number" min={0} max={100} style={s.input} value={discAdPct} onChange={e=>setDiscAdPct(e.target.value)} />
            <div style={{fontSize:11,color:'var(--muted)',marginTop:4}}>Ex: 50 → mostra 50% OFF na adesão</div>
          </div>
          <div style={s.field}>
            <label style={s.label}>% Mensalidade (desconto em tela)</label>
            <input type="number" min={0} max={100} style={s.input} value={discMenPct} onChange={e=>setDiscMenPct(e.target.value)} />
            <div style={{fontSize:11,color:'var(--muted)',marginTop:4}}>Ex: 0 → mensalidade sem desconto em tela</div>
          </div>
          <div style={s.field}>
            <label style={s.label}>% Adesão (fechamento no dia)</label>
            <input type="number" min={0} max={100} style={s.input} value={discClosePct} onChange={e=>setDiscClosePct(e.target.value)} />
            <div style={{fontSize:11,color:'var(--muted)',marginTop:4}}>Oportunidade exclusiva para fechar hoje</div>
          </div>
        </div>
        <div style={{ marginTop:14, padding:'12px 16px', background:'rgba(0,212,255,.05)', border:'1px solid rgba(0,212,255,.15)', borderRadius:8, fontSize:12, color:'var(--muted)', lineHeight:1.7 }}>
          💡 <strong style={{color:'var(--accent)'}}>Fluxo do chat:</strong> 1) Preço inicial (adesão ×2, mensalidade +20%) → 2) "Você tem desconto!" com % adesão e mensalidade em tela → 3) "Fechar hoje!" com % adesão fechamento
        </div>
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
  const [prefixo,  setPrefixo]  = useState('PROMO')
  const [vda,      setVda]      = useState(0)
  const [vdm,      setVdm]      = useState(0)
  const [vdate,    setVdate]    = useState('')
  const [ultimo,   setUltimo]   = useState(null)

  async function gerarVoucher() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
    const code  = Array.from({length: 6}, () => chars[Math.floor(Math.random() * chars.length)]).join('')
    const novo  = { id: Date.now().toString(), codigo: `${prefixo}-${code}`, pctAdesao: Number(vda) || 0, pctMensalidade: Number(vdm) || 0, comemoracao: vdate, criado: new Date().toISOString() }
    const novos = [...vouchers, novo]
    const novoCfg = { ...cfg, vouchers: novos }
    await salvarStorage(empresaId, novoCfg)
    setVouchers(novos); setCfg(novoCfg); setUltimo(novo)
  }

  async function removerVoucher(id) {
    const novos   = vouchers.filter(v => v.id !== id)
    const novoCfg = { ...cfg, vouchers: novos }
    await salvarStorage(empresaId, novoCfg)
    setVouchers(novos); setCfg(novoCfg)
  }

  function imprimirVoucher(v) {
    const empresa = cfg.company || 'Vivanexa'
    const criado  = v.criado ? new Date(v.criado).toLocaleDateString('pt-BR') : ''
    const win     = window.open('', '_blank', 'width=420,height=600')
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
    win.document.close(); win.focus()
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
// ABA DOCUMENTOS — versão com suporte a DOCX
// Substitua a função TabDocumentos em configuracoes.js
// ══════════════════════════════════════════════
//
// MUDANÇAS PRINCIPAIS:
// 1. Aceita .docx além de .html/.txt
// 2. Templates DOCX são salvos como base64 em cfg.docTemplates
// 3. Instruções claras para usar variáveis no Word
// 4. Prompt de IA atualizado para gerar DOCX via LibreOffice
//
// DEPENDÊNCIA: nenhuma nova — substitua apenas esta função


// ══════════════════════════════════════════════
// ABA DOCUMENTOS — variáveis organizadas por seção + suporte DOCX
// ══════════════════════════════════════════════
function TabDocumentos({ cfg, setCfg, empresaId }) {
  const [propostaTemplate, setPropostaTemplate] = React.useState(cfg.docTemplates?.proposta || '')
  const [contratoTemplate, setContratoTemplate] = React.useState(cfg.docTemplates?.contrato || '')
  const [propostaTipo,     setPropostaTipo]     = React.useState(cfg.docTemplates?.propostaTipo || 'html')
  const [contratoTipo,     setContratoTipo]     = React.useState(cfg.docTemplates?.contratoTipo || 'html')
  const [saving,   setSaving]   = React.useState(false)
  const [testando, setTestando] = React.useState(false)

  function handleFileUpload(tipo, e) {
    const file = e.target.files[0]
    if (!file) return
    if (file.size > 5 * 1024 * 1024) { toast('Arquivo muito grande (máx 5MB)', 'err'); return }

    const isDocx = file.name.toLowerCase().endsWith('.docx')
    const reader = new FileReader()

    if (isDocx) {
      reader.onload = ev => {
        const b64 = ev.target.result
        if (tipo === 'proposta') { setPropostaTemplate(b64); setPropostaTipo('docx') }
        else                    { setContratoTemplate(b64);  setContratoTipo('docx') }
        toast(`✅ DOCX carregado — ${Math.round(file.size / 1024)} KB`)
      }
      reader.readAsDataURL(file)
    } else {
      reader.onload = ev => {
        if (tipo === 'proposta') { setPropostaTemplate(ev.target.result); setPropostaTipo('html') }
        else                    { setContratoTemplate(ev.target.result);  setContratoTipo('html') }
      }
      reader.readAsText(file)
    }
    e.target.value = ''
  }

  function isDocxTemplate(tmpl) {
    return tmpl && (tmpl.startsWith('data:application/vnd') || tmpl.startsWith('data:application/octet') || tmpl.startsWith('data:application/zip'))
  }

  async function salvar() {
    setSaving(true)
    try {
      // Salva templates DOCX em chaves SEPARADAS para evitar JSON gigante no cfg
      const salvarTemplate = async (tipo, tmpl, tipoVal) => {
        if (!tmpl) return
        await supabase.from('vx_storage').upsert({
          key: `template:${tipo}:${empresaId}`,
          value: JSON.stringify({ content: tmpl, tipo: tipoVal, updatedAt: new Date().toISOString() }),
          updated_at: new Date().toISOString()
        }, { onConflict: 'key' })
      }
      await Promise.all([
        salvarTemplate('proposta', propostaTemplate, propostaTipo),
        salvarTemplate('contrato', contratoTemplate, contratoTipo),
      ])
      // No cfg salva apenas metadados (sem base64) para não estourar o JSON
      const novoCfg = {
        ...cfg,
        docTemplates: {
          proposta: isDocxTemplate(propostaTemplate) ? '' : propostaTemplate,
          contrato: isDocxTemplate(contratoTemplate) ? '' : contratoTemplate,
          propostaTipo,
          contratoTipo,
          propostaExterna: !!propostaTemplate,
          contratoExterna: !!contratoTemplate,
        }
      }
      const { error } = await salvarStorage(empresaId, novoCfg)
      if (error) { toast('Erro ao salvar: ' + error.message, 'err'); setSaving(false); return }
      setCfg(novoCfg)
      toast('✅ Templates e configurações salvos!')
    } catch (e) {
      toast('Erro: ' + e.message, 'err')
    }
    setSaving(false)
  }

  async function testarConexao() {
    setTestando(true)
    const { error } = await supabase.from('vx_storage').select('key').limit(1)
    setTestando(false)
    if (error) toast('❌ Falha: ' + error.message, 'err')
    else toast('✅ Conexão com Supabase OK!')
  }

  // Variáveis organizadas por grupo
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
        ['{{empresa}}',      'Nome fantasia do cliente'],
        ['{{razao}}',        'Razão social do cliente'],
        ['{{cnpj}}',         'CNPJ do cliente'],
        ['{{cpf}}',          'CPF do cliente (se pessoa física)'],
        ['{{contato}}',      'Nome do contato / responsável'],
        ['{{cpf_contato}}',  'CPF do contato principal'],
        ['{{email}}',        'E-mail do cliente'],
        ['{{telefone}}',     'Telefone do cliente'],
        ['{{endereco}}',     'Endereço completo do cliente'],
        ['{{cidade}}',       'Cidade do cliente'],
        ['{{uf}}',           'Estado (UF) do cliente'],
        ['{{regime}}',       'Regime tributário do cliente'],
        ['{{rimp_nome}}',    'Responsável pela implantação — nome'],
        ['{{rimp_email}}',   'Responsável pela implantação — e-mail'],
        ['{{rimp_tel}}',     'Responsável pela implantação — telefone'],
        ['{{rfin_nome}}',    'Responsável financeiro — nome'],
        ['{{rfin_email}}',   'Responsável financeiro — e-mail'],
        ['{{rfin_tel}}',     'Responsável financeiro — telefone'],
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
        ['{{modulo_1_nome}}',      'Nome do 1º módulo contratado'],
        ['{{modulo_1_adesao}}',    'Adesão do 1º módulo'],
        ['{{modulo_1_mensal}}',    'Mensalidade do 1º módulo'],
        ['{{modulo_2_nome}}',      'Nome do 2º módulo contratado'],
        ['{{modulo_2_adesao}}',    'Adesão do 2º módulo'],
        ['{{modulo_2_mensal}}',    'Mensalidade do 2º módulo'],
        ['{{modulo_3_nome}}',      'Nome do 3º módulo contratado'],
        ['{{modulo_3_adesao}}',    'Adesão do 3º módulo'],
        ['{{modulo_3_mensal}}',    'Mensalidade do 3º módulo'],
      ]
    },
    {
      titulo: '👤 Consultor e Sistema',
      desc: 'Dados do consultor que gerou o documento',
      cor: '#f59e0b',
      vars: [
        ['{{consultor_nome}}',   'Nome do consultor'],
        ['{{consultor_tel}}',    'Telefone do consultor (usuário)'],
        ['{{email_consultor}}',  'E-mail do consultor (usuário logado)'],
        ['{{data_hora}}',        'Data e hora atual de geração do documento'],
        ['{{logo}}',             'Logo da empresa em base64 (para uso em <img src="{{logo}}">)'],
      ]
    },
  ]

  const tagStyle = { fontSize: 11, padding: '2px 8px', background: 'rgba(0,212,255,.08)', borderRadius: 4, color: '#00d4ff', fontFamily: 'monospace', cursor: 'pointer', userSelect: 'all', border: '1px solid rgba(0,212,255,.15)', display: 'inline-block', margin: '2px 0' }

  return (
    <div style={s.body}>
      {/* Templates */}
      <div style={s.sec}>
        <div style={s.secTitle}>✍️ Modelos de Documentos</div>
        <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 16, lineHeight: 1.6 }}>
          Importe um arquivo <strong style={{ color: 'var(--accent)' }}>.docx</strong> (recomendado) ou cole HTML.
          No DOCX, use as variáveis no formato <code style={{ color: '#10b981' }}>{'{{variavel}}'}</code> diretamente no Word.
          O sistema substituirá todas automaticamente ao gerar o documento.
        </p>

        <div style={{ background: 'rgba(0,212,255,.04)', border: '1px solid rgba(0,212,255,.15)', borderRadius: 10, padding: '12px 16px', marginBottom: 20, fontSize: 12, color: 'var(--muted)', lineHeight: 1.9 }}>
          <strong style={{ color: 'var(--accent)' }}>📋 Como preparar o template DOCX:</strong><br />
          1. Abra o Word e crie seu contrato normalmente.<br />
          2. Onde quiser inserir dados dinâmicos, escreva a variável: <code style={{ color: 'var(--accent3)' }}>{'{{empresa}}'}</code>, <code style={{ color: 'var(--accent3)' }}>{'{{total_adesao}}'}</code>, etc.<br />
          3. Salve como <strong>.docx</strong> e importe aqui.<br />
          4. Ao gerar o contrato no chat, o sistema substituirá as variáveis e oferecerá o download do arquivo Word preenchido.
        </div>

        {[['proposta', '📋 Modelo de Proposta', propostaTemplate, setPropostaTemplate, propostaTipo, setPropostaTipo],
          ['contrato', '📄 Modelo de Contrato',  contratoTemplate, setContratoTemplate, contratoTipo, setContratoTipo]].map(([tipo, titulo, val, setter, tipoVal, setTipo]) => (
          <div key={tipo} style={{ marginBottom: 24, background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 12, padding: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
              <div style={{ ...s.secTitle, margin: 0 }}>{titulo}</div>
              <span style={{
                fontSize: 11, padding: '2px 10px', borderRadius: 20,
                background: tipoVal === 'docx' ? 'rgba(16,185,129,.15)' : 'rgba(0,212,255,.1)',
                border: `1px solid ${tipoVal === 'docx' ? 'rgba(16,185,129,.3)' : 'rgba(0,212,255,.2)'}`,
                color: tipoVal === 'docx' ? 'var(--accent3)' : 'var(--accent)',
              }}>
                {tipoVal === 'docx' ? '📎 Arquivo DOCX carregado' : '📝 Template HTML'}
              </span>
            </div>

            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
              <label style={{ fontSize: 12, color: 'var(--accent3)', cursor: 'pointer', background: 'rgba(16,185,129,.1)', padding: '7px 14px', borderRadius: 8, border: '1px solid rgba(16,185,129,.25)', display: 'flex', alignItems: 'center', gap: 6 }}>
                📂 Importar DOCX (recomendado)
                <input type="file" accept=".docx" onChange={e => handleFileUpload(tipo, e)} style={{ display: 'none' }} />
              </label>
              <label style={{ fontSize: 12, color: 'var(--muted)', cursor: 'pointer', background: 'rgba(100,116,139,.08)', padding: '7px 14px', borderRadius: 8, border: '1px solid rgba(100,116,139,.2)', display: 'flex', alignItems: 'center', gap: 6 }}>
                📃 Importar HTML/TXT
                <input type="file" accept=".txt,.html,.htm" onChange={e => handleFileUpload(tipo, e)} style={{ display: 'none' }} />
              </label>
              {val && (
                <button onClick={() => { setter(''); setTipo('html') }} style={{ fontSize: 12, color: 'var(--danger)', background: 'rgba(239,68,68,.08)', padding: '7px 12px', borderRadius: 8, border: '1px solid rgba(239,68,68,.2)', cursor: 'pointer' }}>🗑 Remover</button>
              )}
            </div>

            {isDocxTemplate(val) ? (
              <div style={{ padding: '14px 18px', background: 'rgba(16,185,129,.05)', border: '1px solid rgba(16,185,129,.2)', borderRadius: 8, fontSize: 12, color: 'var(--muted)', lineHeight: 1.8 }}>
                <strong style={{ color: 'var(--accent3)' }}>✅ Template DOCX carregado com sucesso.</strong><br />
                Na hora de gerar o contrato/proposta, o sistema substituirá todas as variáveis <code style={{ color: 'var(--accent)' }}>{'{{var}}'}</code> e gerará o download do arquivo Word preenchido.<br />
                <span style={{ color: '#94a3b8' }}>Tamanho: {val ? Math.round(val.length * 0.75 / 1024) + ' KB (base64)' : '—'}</span>
              </div>
            ) : (
              <textarea
                rows={8}
                style={{ ...s.input, fontFamily: 'monospace', fontSize: 12, resize: 'vertical', width: '100%', marginBottom: 6 }}
                value={val}
                onChange={e => setter(e.target.value)}
                placeholder={`Cole HTML aqui com variáveis como {{empresa}}, {{total_adesao}}, etc.\n\nOu importe um arquivo .docx acima para melhor qualidade.`}
              />
            )}
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
                  <span style={{ ...tagStyle, color: grupo.cor, background: grupo.cor + '10', borderColor: grupo.cor + '30' }}
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
          <li>Ao gerar uma proposta ou contrato no Chat, o sistema substituirá as variáveis automaticamente</li>
          <li>O documento final é exibido em tela e você pode imprimir, salvar em PDF ou enviar para assinatura</li>
        </ol>
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════
// ABA CLIENTES — completa com API CNPJ + CEP + Responsáveis
// ══════════════════════════════════════════════
function TabClientes({ cfg, setCfg, empresaId }) {
  const [busca,     setBusca]     = React.useState('')
  const [form,      setForm]      = React.useState(null)
  const [saving,    setSaving]    = React.useState(false)
  const [lookupMsg, setLookupMsg] = React.useState('')
  const [lookingUp, setLookingUp] = React.useState(false)

  const clientes  = cfg.clients || []
  const filtrados = busca.trim()
    ? clientes.filter(c => c && (
        c.nome?.toLowerCase().includes(busca.toLowerCase()) ||
        c.fantasia?.toLowerCase().includes(busca.toLowerCase()) ||
        c.cnpj?.includes(busca) || c.cpf?.includes(busca) || c.doc?.includes(busca)
      ))
    : clientes

  const EMPTY = {
    id: '', doc: '', fantasia: '', nome: '', contato: '', email: '', tel: '',
    cep: '', end: '', bairro: '', cidade: '', uf: '', cpfContato: '', regime: '',
    rimpNome: '', rimpEmail: '', rimpTel: '',
    rfinNome: '', rfinEmail: '', rfinTel: '',
  }

  // ── Auto-format doc ──
  function handleDocInput(val) {
    const d = val.replace(/\D/g, '')
    let fmt = d
    if (d.length <= 11) fmt = d.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, '$1.$2.$3-$4')
    else fmt = d.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5')
    setForm(f => ({ ...f, doc: fmt }))
  }

  function handleCepInput(val) {
    setForm(f => ({ ...f, cep: fmtCepStr(val) }))
  }

  // ── Busca CNPJ via BrasilAPI ──
  async function lookupDoc() {
    const raw = (form?.doc || '').replace(/\D/g, '')
    if (raw.length !== 14 && raw.length !== 11) { setLookupMsg('Informe um CPF ou CNPJ válido.'); return }
    setLookingUp(true); setLookupMsg('')

    // Verifica base local primeiro
    const local = clientes.find(c => (c.cnpj || c.cpf || c.doc || '').replace(/\D/g, '') === raw)
    if (local) {
      setForm(f => ({
        ...f,
        fantasia:   f.fantasia   || local.fantasia   || '',
        nome:       f.nome       || local.nome        || '',
        contato:    f.contato    || local.contato     || '',
        email:      f.email      || local.email       || '',
        tel:        f.tel        || local.tel || local.telefone || '',
        cep:        f.cep        || local.cep         || '',
        end:        f.end        || local.end || local.endereco || '',
        bairro:     f.bairro     || local.bairro      || '',
        cidade:     f.cidade     || local.cidade      || '',
        uf:         f.uf         || local.uf          || '',
        cpfContato: f.cpfContato || local.cpfContato  || '',
        regime:     f.regime     || local.regime      || '',
        rimpNome:   f.rimpNome   || local.rimpNome    || '',
        rimpEmail:  f.rimpEmail  || local.rimpEmail   || '',
        rimpTel:    f.rimpTel    || local.rimpTel     || '',
        rfinNome:   f.rfinNome   || local.rfinNome    || '',
        rfinEmail:  f.rfinEmail  || local.rfinEmail   || '',
        rfinTel:    f.rfinTel    || local.rfinTel     || '',
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

  // ── Busca CEP via ViaCEP ──
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
    const clean = s => (s || '').replace(/\D/g, '')
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
    const docRaw = (form.doc || '').replace(/\D/g, '')
    const novo = {
      ...form,
      id:   form.id || Date.now().toString(),
      cnpj: docRaw.length === 14 ? form.doc : '',
      cpf:  docRaw.length === 11 ? form.doc : '',
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

          {/* Nome fantasia + razão */}
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

          {/* CPF do contato + Regime tributário */}
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
        {[['dark','🌙 Tema Escuro','Fundo escuro com detalhes ciano'],['light','☀️ Tema Claro','Fundo branco, ideal para apresentações']].map(([t, title, sub]) => (
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

// ══════════════════════════════════════════════════════════════
// TAB INTEGRAÇÕES — WhatsApp Cloud API (Meta)
// ══════════════════════════════════════════════════════════════
function TabIntegracoes({ cfg, setCfg, empresaId }) {
  const [wppToken,   setWppToken]   = React.useState(cfg.wpp?.token   || '')
  const [wppPhoneId, setWppPhoneId] = React.useState(cfg.wpp?.phoneId || '')
  const [wppNumero,  setWppNumero]  = React.useState(cfg.wpp?.numero  || '')
  const [wppAtivo,   setWppAtivo]   = React.useState(cfg.wpp?.ativo   || false)
  const [testNum,    setTestNum]    = React.useState('')
  const [saving,     setSaving]     = React.useState(false)
  const [testing,    setTesting]    = React.useState(false)
  const [cnpjApiToken, setCnpjApiToken] = React.useState(cfg.cnpjApiToken || '')
  const [testingApi,   setTestingApi]   = React.useState(false)
  const [msg,          setMsg]          = React.useState('')
  // 3CX
  const [tcxUrl,          setTcxUrl]          = React.useState(cfg.tcx?.url          || '')
  const [tcxClientId,     setTcxClientId]     = React.useState(cfg.tcx?.clientId     || '')
  const [tcxClientSecret, setTcxClientSecret] = React.useState(cfg.tcx?.clientSecret || '')
  // Cloudflare Worker
  const [cfWorkerUrl,    setCfWorkerUrl]    = React.useState(cfg.cloudflareImageWorkerUrl    || '')
  const [cfWorkerSecret, setCfWorkerSecret] = React.useState(cfg.cloudflareWorkerSecret || '')

  const s = {
    card:  { background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 14, padding: '22px 24px', marginBottom: 16 },
    label: { fontSize: 11, color: 'var(--muted)', display: 'block', marginBottom: 5, letterSpacing: .5, textTransform: 'uppercase' },
    input: { width: '100%', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, padding: '9px 12px', fontFamily: 'DM Mono, monospace', fontSize: 13, color: 'var(--text)', outline: 'none', marginBottom: 12 },
    btn:   { padding: '10px 22px', borderRadius: 9, background: 'linear-gradient(135deg,#00d4ff,#0099bb)', border: 'none', color: '#fff', fontFamily: 'DM Mono, monospace', fontSize: 13, fontWeight: 600, cursor: 'pointer' },
    btnSec:{ padding: '9px 18px', borderRadius: 9, background: 'rgba(0,212,255,.1)', border: '1px solid rgba(0,212,255,.3)', color: 'var(--accent)', fontFamily: 'DM Mono, monospace', fontSize: 13, cursor: 'pointer' },
    h:     { fontFamily: 'Syne, sans-serif', fontSize: 15, fontWeight: 700, color: 'var(--accent)', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 },
    step:  { background: 'rgba(0,212,255,.08)', border: '1px solid rgba(0,212,255,.2)', borderRadius: 10, padding: '14px 18px', marginBottom: 10, fontSize: 13, color: 'var(--text)', lineHeight: 1.7 },
    badge: { display: 'inline-flex', alignItems: 'center', gap: 6, padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700 },
  }

  async function salvar() {
    setSaving(true); setMsg('')
    try {
      const { data: row } = await supabase.from('vx_storage').select('value').eq('key', `cfg:${empresaId}`).single()
      const atual = row?.value ? JSON.parse(row.value) : {}
      const novo  = { ...atual, wpp: { token: wppToken, phoneId: wppPhoneId, numero: wppNumero, ativo: wppAtivo }, cnpjApiToken: cnpjApiToken.trim() }
      await supabase.from('vx_storage').upsert({ key: `cfg:${empresaId}`, value: JSON.stringify(novo), updated_at: new Date().toISOString() })
      setCfg(novo)
      setMsg('✅ Configurações salvas!')
    } catch (e) {
      setMsg('❌ Erro ao salvar: ' + e.message)
    }
    setSaving(false)
  }

  async function salvarTcx() {
    setSaving(true); setMsg('')
    try {
      const { data: row } = await supabase.from('vx_storage').select('value').eq('key', `cfg:${empresaId}`).single()
      const atual = row?.value ? JSON.parse(row.value) : {}
      const novo = { ...atual, tcx: { url: tcxUrl.trim(), clientId: tcxClientId.trim(), clientSecret: tcxClientSecret.trim() } }
      await supabase.from('vx_storage').upsert({ key: `cfg:${empresaId}`, value: JSON.stringify(novo), updated_at: new Date().toISOString() })
      setCfg(novo)
      setMsg('✅ Integração 3CX salva!')
    } catch(e) { setMsg('❌ Erro: ' + e.message) }
    setSaving(false)
  }

  async function salvarCloudflare() {
    setSaving(true); setMsg('')
    try {
      const { data: row } = await supabase.from('vx_storage').select('value').eq('key', `cfg:${empresaId}`).single()
      const atual = row?.value ? JSON.parse(row.value) : {}
      const novo = { ...atual, cloudflareImageWorkerUrl: cfWorkerUrl.trim(), cloudflareWorkerSecret: cfWorkerSecret.trim() }
      await supabase.from('vx_storage').upsert({ key: `cfg:${empresaId}`, value: JSON.stringify(novo), updated_at: new Date().toISOString() })
      setCfg(novo)
      setMsg('✅ Cloudflare Worker salvo! O módulo Marketing já pode gerar imagens IA.')
    } catch(e) { setMsg('❌ Erro: ' + e.message) }
    setSaving(false)
  }

  async function testarEnvio() {
    if (!testNum) { setMsg('⚠️ Informe o número para teste'); return }
    if (!wppToken || !wppPhoneId) { setMsg('⚠️ Salve as credenciais primeiro'); return }
    setTesting(true); setMsg('')
    try {
      const r = await fetch('/api/whatsapp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'enviar',
          phoneId: wppPhoneId,
          token:   wppToken,
          para:    testNum,
          texto:   `✅ Teste da integração Vivanexa SaaS!\n\nSe você recebeu esta mensagem, a integração está funcionando perfeitamente. 🚀`,
        }),
      })
      const data = await r.json()
      setMsg(r.ok ? '✅ Mensagem de teste enviada!' : '❌ Erro: ' + (data.error || 'falhou'))
    } catch (e) {
      setMsg('❌ Erro: ' + e.message)
    }
    setTesting(false)
  }

  const webhookUrl = typeof window !== 'undefined'
    ? window.location.origin + '/api/whatsapp'
    : 'https://seu-dominio.vercel.app/api/whatsapp'

  return (
    <div style={{ padding: '24px' }}>
      <div style={s.h}>🔗 Integrações</div>

      {/* ── CNPJ API — Gerador de Leads ── */}
      <div style={{ ...s.card, borderColor: cnpjApiToken ? 'rgba(0,212,255,.35)' : 'var(--border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <div style={{ fontFamily: 'Syne, sans-serif', fontSize: 14, fontWeight: 700 }}>🔍 CNPJ API — Gerador de Leads</div>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700,
            background: cnpjApiToken ? 'rgba(0,212,255,.12)' : 'rgba(100,116,139,.12)',
            color: cnpjApiToken ? 'var(--accent)' : '#64748b',
            border: '1px solid ' + (cnpjApiToken ? 'rgba(0,212,255,.3)' : 'rgba(100,116,139,.3)') }}>
            {cnpjApiToken ? '● Configurado' : '○ Sem token'}
          </div>
        </div>
        <div style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.7, marginBottom: 14 }}>
          Token usado pelo <strong style={{ color: 'var(--text)' }}>Gerador de Leads</strong> para enriquecer empresas com telefone, e-mail e responsável via{' '}
          <strong style={{ color: 'var(--accent)' }}>cnpj-api.com</strong>. Plano <strong style={{ color: '#10b981' }}>gratuito</strong>: 5 req/min.
          Plano Basic: R$ 20/mês (10 req/min, dados mais atualizados).
        </div>

        <label style={s.label}>Token da cnpj-api.com</label>
        <input
          style={{ ...s.input, fontFamily: 'monospace', fontSize: 11 }}
          type="password"
          value={cnpjApiToken}
          onChange={e => setCnpjApiToken(e.target.value)}
          placeholder="Cole seu token aqui..."
        />
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', marginBottom: 8 }}>
          <button onClick={async () => {
            if (!cnpjApiToken.trim()) { setMsg('⚠️ Informe o token antes de testar'); return }
            setTestingApi(true); setMsg('')
            try {
              const r = await fetch('https://api.cnpj-api.com/v1/cnpj/00000000000191?token=' + cnpjApiToken.trim())
              if (r.ok)                   setMsg('✅ Token válido! cnpj-api.com conectada.')
              else if (r.status === 401 || r.status === 403) setMsg('❌ Token inválido ou sem permissão.')
              else if (r.status === 429)  setMsg('⚠️ Limite de requisições atingido (aguarde 1 min e tente novamente).')
              else                        setMsg('⚠️ Resposta HTTP ' + r.status + ' — verifique o token.')
            } catch (e) { setMsg('❌ Erro de conexão: ' + e.message) }
            setTestingApi(false)
          }} disabled={testingApi} style={s.btnSec}>
            {testingApi ? '⏳ Testando...' : '🧪 Testar token'}
          </button>
          <a href="https://cnpj-api.com" target="_blank" rel="noreferrer"
            style={{ padding: '9px 16px', borderRadius: 9, background: 'rgba(0,212,255,.06)', border: '1px solid rgba(0,212,255,.2)', color: 'var(--accent)', fontFamily: 'DM Mono, monospace', fontSize: 12, textDecoration: 'none' }}>
            🔗 Criar conta grátis
          </a>
        </div>
        <div style={{ fontSize: 11, color: 'var(--muted)', lineHeight: 1.6 }}>
          Acesse <strong>cnpj-api.com</strong>, crie sua conta, vá em "API" e copie o token.
        </div>
      </div>

      {/* ── STATUS ── */}
      <div style={{ ...s.card, borderColor: wppAtivo ? 'rgba(16,185,129,.4)' : 'var(--border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <div style={{ fontFamily: 'Syne, sans-serif', fontSize: 14, fontWeight: 700 }}>📱 WhatsApp Business</div>
          <div style={{ ...s.badge, background: wppAtivo ? 'rgba(16,185,129,.15)' : 'rgba(100,116,139,.15)', color: wppAtivo ? '#10b981' : '#64748b', border: `1px solid ${wppAtivo ? 'rgba(16,185,129,.3)' : 'rgba(100,116,139,.3)'}` }}>
            {wppAtivo ? '● Ativo' : '○ Inativo'}
          </div>
        </div>
        <div style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.7 }}>
          Integração com a <strong style={{ color: 'var(--text)' }}>WhatsApp Cloud API (Meta)</strong> — gratuita até 1.000 conversas/mês.
          Permite envio de propostas, disparo em massa, chatbot automático e notificações internas.
        </div>
        <div style={{ marginTop: 14, display: 'flex', alignItems: 'center', gap: 10 }}>
          <label style={{ fontSize: 13, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
            <input type="checkbox" checked={wppAtivo} onChange={e => setWppAtivo(e.target.checked)}
              style={{ width: 16, height: 16, cursor: 'pointer' }} />
            Ativar integração WhatsApp
          </label>
        </div>
      </div>

      {/* ── PASSO A PASSO ── */}
      <div style={s.card}>
        <div style={{ fontFamily: 'Syne, sans-serif', fontSize: 13, fontWeight: 700, marginBottom: 14, color: 'var(--muted)' }}>
          📋 COMO CONFIGURAR — Passo a passo
        </div>
        {[
          { n: '1', t: 'Criar conta no Meta for Developers', d: 'Acesse developers.facebook.com → clique em "Começar" → crie um App do tipo "Empresa"', link: 'https://developers.facebook.com', lbl: 'Acessar Meta Developers' },
          { n: '2', t: 'Adicionar produto WhatsApp', d: 'No painel do App → clique em "+ Adicionar produto" → selecione WhatsApp → clique em "Configurar"', link: null },
          { n: '3', t: 'Obter o Phone Number ID', d: 'Em WhatsApp → Introdução → copie o "ID do número de telefone" e cole no campo abaixo', link: null },
          { n: '4', t: 'Gerar o Token de Acesso', d: 'Na mesma tela → copie o "Token de acesso temporário" (para produção, gere um token permanente em Configurações do Sistema)', link: null },
          { n: '5', t: 'Configurar o Webhook', d: `Em WhatsApp → Configuração → Webhooks → cole a URL abaixo e o token de verificação: vivanexa_webhook_2024`, link: null, code: webhookUrl },
          { n: '6', t: 'Adicionar número de teste', d: 'Em WhatsApp → Introdução → adicione seu número pessoal como número de teste para poder enviar mensagens', link: null },
        ].map(({ n, t, d, link, lbl, code }) => (
          <div key={n} style={s.step}>
            <div style={{ fontWeight: 700, color: 'var(--accent)', marginBottom: 4 }}>Passo {n}: {t}</div>
            <div style={{ color: 'var(--muted)', fontSize: 12 }}>{d}</div>
            {code && <div style={{ marginTop: 8, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 6, padding: '7px 12px', fontFamily: 'DM Mono, monospace', fontSize: 12, color: '#10b981', wordBreak: 'break-all' }}>{code}</div>}
            {link && <a href={link} target="_blank" rel="noreferrer" style={{ display: 'inline-block', marginTop: 8, fontSize: 12, color: 'var(--accent)', textDecoration: 'underline' }}>{lbl || link}</a>}
          </div>
        ))}
      </div>

      {/* ── CREDENCIAIS ── */}
      <div style={s.card}>
        <div style={{ fontFamily: 'Syne, sans-serif', fontSize: 13, fontWeight: 700, marginBottom: 16 }}>🔑 Credenciais</div>

        <label style={s.label}>Phone Number ID</label>
        <input style={s.input} value={wppPhoneId} onChange={e => setWppPhoneId(e.target.value)}
          placeholder="Ex: 123456789012345" />

        <label style={s.label}>Token de Acesso (Access Token)</label>
        <input style={{ ...s.input, fontFamily: 'monospace', fontSize: 11 }} value={wppToken} onChange={e => setWppToken(e.target.value)}
          placeholder="EAAxxxxxxxxxxxxxxxx..." type="password" />

        <label style={s.label}>Número WhatsApp da Empresa (com DDI)</label>
        <input style={s.input} value={wppNumero} onChange={e => setWppNumero(e.target.value)}
          placeholder="5531999990000" />

        <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
          <button onClick={salvar} disabled={saving} style={s.btn}>
            {saving ? '⏳ Salvando...' : '💾 Salvar credenciais'}
          </button>
        </div>
      </div>

      {/* ── TESTE ── */}
      <div style={s.card}>
        <div style={{ fontFamily: 'Syne, sans-serif', fontSize: 13, fontWeight: 700, marginBottom: 16 }}>🧪 Testar Envio</div>
        <label style={s.label}>Número para teste (com DDI, ex: 5531999990000)</label>
        <input style={s.input} value={testNum} onChange={e => setTestNum(e.target.value)} placeholder="5531999990000" />
        <button onClick={testarEnvio} disabled={testing} style={s.btnSec}>
          {testing ? '⏳ Enviando...' : '📤 Enviar mensagem de teste'}
        </button>
      </div>

      {/* ── URL DO WEBHOOK ── */}
      <div style={s.card}>
        <div style={{ fontFamily: 'Syne, sans-serif', fontSize: 13, fontWeight: 700, marginBottom: 12 }}>🔗 URL do Webhook</div>
        <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 10 }}>
          Configure esta URL no painel da Meta (Passo 5). Token de verificação: <strong style={{ color: 'var(--accent)' }}>vivanexa_webhook_2024</strong>
        </div>
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 14px', fontFamily: 'DM Mono, monospace', fontSize: 12, color: '#10b981', wordBreak: 'break-all', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
          <span>{webhookUrl}</span>
          <button onClick={() => { navigator.clipboard.writeText(webhookUrl); setMsg('✅ URL copiada!') }}
            style={{ background: 'none', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--muted)', padding: '4px 10px', cursor: 'pointer', fontSize: 11, fontFamily: 'DM Mono, monospace', flexShrink: 0 }}>
            Copiar
          </button>
        </div>
      </div>

      {/* ── 3CX ── */}
      <div style={{ ...s.card, borderColor: cfg.tcx?.url ? 'rgba(0,212,255,.35)' : 'var(--border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <div style={{ fontFamily: 'Syne, sans-serif', fontSize: 14, fontWeight: 700 }}>📞 Integração 3CX</div>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700,
            background: tcxUrl ? 'rgba(0,212,255,.12)' : 'rgba(100,116,139,.12)',
            color: tcxUrl ? 'var(--accent)' : '#64748b',
            border: '1px solid ' + (tcxUrl ? 'rgba(0,212,255,.3)' : 'rgba(100,116,139,.3)') }}>
            {tcxUrl ? '● Configurado' : '○ Não configurado'}
          </div>
        </div>
        <div style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.7, marginBottom: 14 }}>
          Conecte o <strong style={{ color: 'var(--text)' }}>3CX</strong> para identificar clientes ao receber chamadas (pop-up automático no CRM) e registrar histórico de ligações. Requer 3CX Pro ou Enterprise com a <strong style={{ color: 'var(--accent)' }}>Call Control API v20</strong> ativada.
        </div>
        <label style={s.label}>URL da 3CX (ex: https://suaempresa.3cx.com.br)</label>
        <input style={s.input} value={tcxUrl} onChange={e => setTcxUrl(e.target.value)} placeholder="https://suaempresa.3cx.com.br" />
        <label style={s.label}>Client ID (gerado em Integrações → API no painel 3CX)</label>
        <input style={s.input} value={tcxClientId} onChange={e => setTcxClientId(e.target.value)} placeholder="vivanexa-crm" />
        <label style={s.label}>Client Secret</label>
        <input style={{ ...s.input, fontFamily: 'monospace', fontSize: 11 }} type="password" value={tcxClientSecret} onChange={e => setTcxClientSecret(e.target.value)} placeholder="••••••••••••" />
        <div style={{ fontSize: 11, color: 'var(--muted)', lineHeight: 1.6, marginBottom: 12 }}>
          No painel 3CX: <strong>Configurações → Integrações → API</strong> → clique em "+ Novo" → copie Client ID e Secret.
        </div>
        <button onClick={salvarTcx} disabled={saving} style={s.btnSec}>
          {saving ? '⏳ Salvando...' : '💾 Salvar 3CX'}
        </button>
      </div>

      {/* ── CLOUDFLARE IMAGE WORKER ── */}
      <div style={{ ...s.card, borderColor: cfg.cloudflareImageWorkerUrl ? 'rgba(124,58,237,.4)' : 'var(--border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <div style={{ fontFamily: 'Syne, sans-serif', fontSize: 14, fontWeight: 700 }}>🖼️ Cloudflare Image Worker (IA)</div>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700,
            background: cfWorkerUrl ? 'rgba(124,58,237,.12)' : 'rgba(100,116,139,.12)',
            color: cfWorkerUrl ? '#7c3aed' : '#64748b',
            border: '1px solid ' + (cfWorkerUrl ? 'rgba(124,58,237,.3)' : 'rgba(100,116,139,.3)') }}>
            {cfWorkerUrl ? '● Configurado' : '○ Não configurado'}
          </div>
        </div>
        <div style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.7, marginBottom: 14 }}>
          Worker Cloudflare com <strong style={{ color: '#7c3aed' }}>FLUX.1 schnell</strong> para geração de imagens no módulo Marketing. Grátis até 10.000 imagens/dia. Siga o guia <strong style={{ color: 'var(--text)' }}>GUIA-CLOUDFLARE-WORKER.md</strong> para criar e publicar o worker.
        </div>
        <label style={s.label}>URL do Worker (ex: https://vivanexa-image-gen.SEU-USUARIO.workers.dev)</label>
        <input style={s.input} value={cfWorkerUrl} onChange={e => setCfWorkerUrl(e.target.value)} placeholder="https://vivanexa-image-gen.seu-usuario.workers.dev" />
        <label style={s.label}>Chave Secreta do Worker (opcional — configurada via <code>wrangler secret put API_SECRET</code>)</label>
        <input style={{ ...s.input, fontFamily: 'monospace', fontSize: 11 }} type="password" value={cfWorkerSecret} onChange={e => setCfWorkerSecret(e.target.value)} placeholder="vx_img_2025_abc123" />
        <button onClick={salvarCloudflare} disabled={saving} style={{ ...s.btnSec, borderColor: 'rgba(124,58,237,.3)', color: '#7c3aed' }}>
          {saving ? '⏳ Salvando...' : '💾 Salvar Cloudflare Worker'}
        </button>
      </div>

      {/* ── GOOGLE AGENDA ── */}
      <div style={{ ...s.card, borderColor: (cfg.googleClientId || cfg.gcal?.clientId) ? 'rgba(16,185,129,.4)' : 'var(--border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <div style={{ fontFamily: 'Syne, sans-serif', fontSize: 14, fontWeight: 700 }}>📅 Google Agenda</div>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700,
            background: (cfg.googleClientId || cfg.gcal?.clientId) ? 'rgba(16,185,129,.12)' : 'rgba(100,116,139,.12)',
            color: (cfg.googleClientId || cfg.gcal?.clientId) ? '#10b981' : '#64748b',
            border: '1px solid ' + ((cfg.googleClientId || cfg.gcal?.clientId) ? 'rgba(16,185,129,.3)' : 'rgba(100,116,139,.3)') }}>
            {(cfg.googleClientId || cfg.gcal?.clientId) ? '● Configurado' : '○ Não configurado'}
          </div>
        </div>
        <div style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.7, marginBottom: 14 }}>
          Permite criar eventos na <strong style={{ color: 'var(--text)' }}>Google Agenda</strong> diretamente ao registrar uma Reunião como atividade no CRM.
          O botão "📅 Sincronizar com Google Agenda" aparece automaticamente nas atividades do tipo <strong style={{ color: '#10b981' }}>Reunião</strong>.
        </div>

        {/* Passo a passo */}
        <div style={{ fontFamily: 'Syne, sans-serif', fontSize: 12, fontWeight: 700, color: 'var(--muted)', marginBottom: 10, textTransform: 'uppercase', letterSpacing: 1 }}>Como configurar:</div>
        {[
          ['1', 'Google Cloud Console', 'Acesse console.cloud.google.com → crie um projeto → ative a Google Calendar API em "APIs e Serviços → Biblioteca"', 'https://console.cloud.google.com'],
          ['2', 'Criar credenciais OAuth', 'APIs e Serviços → Credenciais → "+ Criar Credenciais" → OAuth 2.0 Client ID → tipo "Web Application"', null],
          ['3', 'Adicionar Redirect URI', 'Em "URIs de redirecionamento autorizados" adicione: https://SEU-DOMINIO/api/auth/google/callback', null],
          ['4', 'Copiar Client ID e Secret', 'Copie o Client ID e Client Secret gerados e cole nos campos abaixo', null],
        ].map(([n, t, d, link]) => (
          <div key={n} style={{ background: 'rgba(16,185,129,.06)', border: '1px solid rgba(16,185,129,.15)', borderRadius: 10, padding: '12px 16px', marginBottom: 8, fontSize: 12, color: 'var(--text)', lineHeight: 1.7 }}>
            <strong style={{ color: '#10b981' }}>Passo {n}: {t}</strong>
            <div style={{ color: 'var(--muted)', marginTop: 2 }}>{d}</div>
            {link && <a href={link} target="_blank" rel="noreferrer" style={{ fontSize: 11, color: '#10b981', display: 'inline-block', marginTop: 4 }}>{link}</a>}
          </div>
        ))}

        <GoogleAgendaForm cfg={cfg} setCfg={setCfg} empresaId={empresaId} s={s} setMsg={setMsg} />
      </div>

      {msg && (
        <div style={{ padding: '12px 16px', borderRadius: 10, background: msg.startsWith('✅') ? 'rgba(16,185,129,.1)' : 'rgba(239,68,68,.1)', border: `1px solid ${msg.startsWith('✅') ? 'rgba(16,185,129,.3)' : 'rgba(239,68,68,.3)'}`, color: msg.startsWith('✅') ? '#10b981' : '#ef4444', fontSize: 13 }}>
          {msg}
        </div>
      )}
    </div>
  )
}

// ──────────────────────────────────────────────
// SUB-COMPONENTE: formulário Google Agenda
// Separado para manter estado de campos sem re-renderizar tudo
// ──────────────────────────────────────────────
function GoogleAgendaForm({ cfg, setCfg, empresaId, s, setMsg }) {
  const [clientId,     setClientId]     = React.useState(cfg.gcal?.clientId     || cfg.googleClientId     || '')
  const [clientSecret, setClientSecret] = React.useState(cfg.gcal?.clientSecret || cfg.googleClientSecret || '')
  const [saving,       setSaving]       = React.useState(false)
  const [gcalToken,    setGcalToken]    = React.useState(null)

  // Escutar retorno do popup OAuth
  React.useEffect(() => {
    function onMsg(e) {
      if (e.data?.type === 'GCAL_TOKEN') {
        setGcalToken(e.data.token)
        setMsg('✅ Google Agenda conectado com sucesso!')
      }
    }
    window.addEventListener('message', onMsg)
    return () => window.removeEventListener('message', onMsg)
  }, [setMsg])

  async function salvarGoogleCfg() {
    if (!clientId.trim() || !clientSecret.trim()) { setMsg('⚠️ Preencha Client ID e Client Secret'); return }
    setSaving(true)
    try {
      const { data: row } = await supabase.from('vx_storage').select('value').eq('key', `cfg:${empresaId}`).maybeSingle()
      const atual = row?.value ? JSON.parse(row.value) : {}
      const novo = { ...atual, gcal: { clientId: clientId.trim(), clientSecret: clientSecret.trim() }, googleClientId: clientId.trim(), googleClientSecret: clientSecret.trim() }
      await supabase.from('vx_storage').upsert({ key: `cfg:${empresaId}`, value: JSON.stringify(novo), updated_at: new Date().toISOString() })
      setCfg(novo)
      setMsg('✅ Credenciais Google salvas! Clique em "Conectar conta" para autorizar.')
    } catch (e) { setMsg('❌ Erro ao salvar: ' + e.message) }
    setSaving(false)
  }

  function conectarGoogle() {
    if (!clientId.trim()) { setMsg('⚠️ Salve o Client ID primeiro'); return }
    const redirectUri = window.location.origin + '/api/auth/google/callback'
    const scope = 'https://www.googleapis.com/auth/calendar.events'
    const url = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${encodeURIComponent(clientId.trim())}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=${encodeURIComponent(scope)}&access_type=offline&prompt=consent&state=${encodeURIComponent(empresaId)}`
    window.open(url, '_blank', 'width=500,height=620,scrollbars=yes')
  }

  async function verificarToken() {
    try {
      const { data: row } = await supabase.from('vx_storage').select('value').eq('key', `gcal_token:${empresaId}`).maybeSingle()
      if (row?.value) {
        const tk = JSON.parse(row.value)
        setGcalToken(tk)
        setMsg(`✅ Token ativo! Expira em: ${tk.expires_in ? new Date(tk.obtained_at + tk.expires_in * 1000).toLocaleString('pt-BR') : 'não definido'}`)
      } else {
        setMsg('⚠️ Nenhum token encontrado. Clique em "Conectar conta" para autorizar.')
      }
    } catch (e) { setMsg('❌ Erro ao verificar token: ' + e.message) }
  }

  return (
    <div>
      <label style={s.label}>Client ID (Google OAuth)</label>
      <input style={s.input} value={clientId} onChange={e => setClientId(e.target.value)} placeholder="XXXXXXXX.apps.googleusercontent.com" />

      <label style={s.label}>Client Secret</label>
      <input style={{ ...s.input, fontFamily: 'monospace', fontSize: 11 }} type="password" value={clientSecret} onChange={e => setClientSecret(e.target.value)} placeholder="GOCSPX-XXXXXXXXXX" />

      <div style={{ marginBottom: 10, fontSize: 11, color: 'var(--muted)', lineHeight: 1.6 }}>
        <strong style={{ color: 'var(--text)' }}>Redirect URI para configurar no Google Cloud:</strong><br />
        <code style={{ color: 'var(--accent)', wordBreak: 'break-all' }}>
          {typeof window !== 'undefined' ? window.location.origin : 'https://seu-dominio.vercel.app'}/api/auth/google/callback
        </code>
      </div>

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: gcalToken ? 12 : 0 }}>
        <button onClick={salvarGoogleCfg} disabled={saving} style={{ ...s.btnSec, borderColor: 'rgba(16,185,129,.3)', color: '#10b981', background: 'rgba(16,185,129,.08)' }}>
          {saving ? '⏳ Salvando...' : '💾 Salvar credenciais Google'}
        </button>
        <button onClick={conectarGoogle} style={{ ...s.btnSec }}>
          🔗 Conectar conta Google
        </button>
        <button onClick={verificarToken} style={{ ...s.btnSec, fontSize: 12 }}>
          🔍 Verificar token
        </button>
      </div>

      {gcalToken && (
        <div style={{ marginTop: 10, padding: '10px 14px', borderRadius: 8, background: 'rgba(16,185,129,.08)', border: '1px solid rgba(16,185,129,.25)', fontSize: 12, color: '#10b981' }}>
          ✅ Google Agenda autorizado — a integração está ativa.
        </div>
      )}
    </div>
  )
}

// ABA WHATSAPP
// ══════════════════════════════════════════════
function TabWhatsapp({ cfg, setCfg, empresaId }) {
  const [provider,  setProvider]  = React.useState(cfg.wppInbox?.provider  || 'evolution')
  const [evoUrl,    setEvoUrl]    = React.useState(cfg.wppInbox?.evolutionUrl || '')
  const [evoKey,    setEvoKey]    = React.useState(cfg.wppInbox?.evolutionKey || '')
  const [evoInst,   setEvoInst]   = React.useState(cfg.wppInbox?.evolutionInstance || '')
  const [evoStatus, setEvoStatus] = React.useState(null)
  const [qrCode,    setQrCode]    = React.useState(null)
  const [wppTags,   setWppTags]   = React.useState(cfg.wppTags || [
    { id: 'lead_frio',    label: 'Lead Frio',    cor: '#64748b' },
    { id: 'lead_quente',  label: 'Lead Quente',  cor: '#ef4444' },
    { id: 'dor_demora',   label: 'Dor: Demora',  cor: '#f59e0b' },
    { id: 'dor_controle', label: 'Dor: Controle',cor: '#7c3aed' },
  ])
  const [novaTagLabel, setNovaTagLabel] = React.useState('')
  const [novaTagCor,   setNovaTagCor]   = React.useState('#10b981')
  const [saving,    setSaving]    = React.useState(false)
  const [checking,  setChecking]  = React.useState(false)
  const [msg,       setMsg]       = React.useState('')

  const st = {
    card:  { background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 14, padding: '22px 24px', marginBottom: 16 },
    label: { fontSize: 11, color: 'var(--muted)', display: 'block', marginBottom: 5, letterSpacing: .5, textTransform: 'uppercase' },
    input: { width: '100%', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, padding: '9px 12px', fontFamily: 'DM Mono, monospace', fontSize: 13, color: 'var(--text)', outline: 'none', marginBottom: 12 },
    btn:   { padding: '10px 22px', borderRadius: 9, background: 'linear-gradient(135deg,#00d4ff,#0099bb)', border: 'none', color: '#fff', fontFamily: 'DM Mono, monospace', fontSize: 13, fontWeight: 600, cursor: 'pointer' },
    btnSec:{ padding: '9px 18px', borderRadius: 9, background: 'rgba(0,212,255,.1)', border: '1px solid rgba(0,212,255,.3)', color: 'var(--accent)', fontFamily: 'DM Mono, monospace', fontSize: 13, cursor: 'pointer' },
    h:     { fontFamily: 'Syne, sans-serif', fontSize: 15, fontWeight: 700, color: 'var(--accent)', marginBottom: 16 },
    sec:   { fontFamily: 'Syne, sans-serif', fontSize: 13, fontWeight: 700, color: 'var(--text)', marginBottom: 12 },
  }

  async function salvar() {
    setSaving(true); setMsg('')
    try {
      const { data: row } = await supabase.from('vx_storage').select('value').eq('key', `cfg:${empresaId}`).single()
      const atual = row?.value ? JSON.parse(row.value) : {}
      const novo  = { ...atual, wppTags, wppInbox: { provider, evolutionUrl: evoUrl, evolutionKey: evoKey, evolutionInstance: evoInst } }
      await supabase.from('vx_storage').upsert({ key: `cfg:${empresaId}`, value: JSON.stringify(novo), updated_at: new Date().toISOString() })
      setCfg(novo); setMsg('✅ Configurações salvas!')
    } catch (e) { setMsg('❌ Erro: ' + e.message) }
    setSaving(false)
  }

  async function verificarConexao() {
    if (!evoUrl || !evoKey || !evoInst) { setMsg('⚠️ Preencha URL, Key e Instance primeiro'); return }
    setChecking(true); setMsg('')
    try {
      const r = await fetch(`${evoUrl}/instance/connectionState/${evoInst}`, { headers: { 'apikey': evoKey } })
      const d = await r.json()
      const estado = d?.instance?.state || d?.state || 'unknown'
      setEvoStatus(estado)
      setMsg(estado === 'open' ? '✅ WhatsApp conectado!' : `⚠️ Status: ${estado}`)
    } catch (e) { setMsg('❌ Erro: ' + e.message) }
    setChecking(false)
  }

  async function buscarQR() {
    if (!evoUrl || !evoKey || !evoInst) { setMsg('⚠️ Preencha URL, Key e Instance primeiro'); return }
    setChecking(true); setMsg(''); setQrCode(null)
    try {
      await fetch(`${evoUrl}/instance/create`, {
        method: 'POST', headers: { 'apikey': evoKey, 'Content-Type': 'application/json' },
        body: JSON.stringify({ instanceName: evoInst, qrcode: true })
      }).catch(() => {})
      const r = await fetch(`${evoUrl}/instance/connect/${evoInst}`, { headers: { 'apikey': evoKey } })
      const d = await r.json()
      const qr = d?.base64 || d?.qrcode?.base64 || d?.qr
      if (qr) setQrCode(qr)
      else setMsg('⚠️ QR Code não disponível. A instância pode já estar conectada.')
    } catch (e) { setMsg('❌ Erro: ' + e.message) }
    setChecking(false)
  }

  function adicionarTag() {
    if (!novaTagLabel.trim()) return
    const id = novaTagLabel.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '')
    setWppTags(prev => [...prev, { id, label: novaTagLabel.trim(), cor: novaTagCor }])
    setNovaTagLabel(''); setNovaTagCor('#10b981')
  }

  const webhookUrl = typeof window !== 'undefined'
    ? window.location.origin + '/api/wpp/webhook'
    : 'https://seu-dominio.vercel.app/api/wpp/webhook'

  return (
    <div style={{ padding: 24 }}>
      <div style={st.h}>💬 WhatsApp Inbox</div>

      <div style={st.card}>
        <div style={st.sec}>📡 Tipo de Conexão</div>
        <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
          {[
            { id: 'evolution', label: '📱 QR Code (Evolution API)', desc: 'Conecta qualquer número via QR Code. Ideal para uso interno da equipe.' },
            { id: 'meta',      label: '✅ WhatsApp Oficial (Meta)',  desc: 'WhatsApp Business API oficial. Configure na aba Integrações.' },
          ].map(p => (
            <div key={p.id} onClick={() => setProvider(p.id)} style={{ flex: 1, padding: '14px 16px', borderRadius: 12, cursor: 'pointer', border: `2px solid ${provider === p.id ? 'var(--accent)' : 'var(--border)'}`, background: provider === p.id ? 'rgba(0,212,255,.06)' : 'var(--surface)' }}>
              <div style={{ fontWeight: 700, fontSize: 13, color: provider === p.id ? 'var(--accent)' : 'var(--text)', marginBottom: 6 }}>{p.label}</div>
              <div style={{ fontSize: 11, color: 'var(--muted)', lineHeight: 1.6 }}>{p.desc}</div>
            </div>
          ))}
        </div>
      </div>

      {provider === 'evolution' && (
        <div style={st.card}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <div style={st.sec}>⚙️ Evolution API (QR Code)</div>
            {evoStatus && (
              <span style={{ padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700, background: evoStatus === 'open' ? 'rgba(16,185,129,.15)' : 'rgba(245,158,11,.15)', color: evoStatus === 'open' ? '#10b981' : '#f59e0b', border: `1px solid ${evoStatus === 'open' ? 'rgba(16,185,129,.3)' : 'rgba(245,158,11,.3)'}` }}>
                {evoStatus === 'open' ? '● Conectado' : `○ ${evoStatus}`}
              </span>
            )}
          </div>

          <div style={{ padding: '12px 16px', background: 'rgba(0,212,255,.05)', border: '1px solid rgba(0,212,255,.15)', borderRadius: 10, fontSize: 12, color: 'var(--muted)', lineHeight: 1.7, marginBottom: 16 }}>
            A <strong style={{ color: 'var(--text)' }}>Evolution API</strong> é um servidor open-source para conectar WhatsApp via QR Code.
            Deploy gratuito no Railway ou Render:{' '}
            <a href="https://github.com/EvolutionAPI/evolution-api" target="_blank" rel="noreferrer" style={{ color: 'var(--accent)' }}>github.com/EvolutionAPI</a>
          </div>

          <label style={st.label}>URL da Evolution API</label>
          <input style={st.input} value={evoUrl} onChange={e => setEvoUrl(e.target.value)} placeholder="https://sua-evolution-api.railway.app" />

          <label style={st.label}>API Key Global</label>
          <input style={{ ...st.input, fontFamily: 'monospace' }} type="password" value={evoKey} onChange={e => setEvoKey(e.target.value)} placeholder="sua-api-key-global" />

          <label style={st.label}>Nome da Instance</label>
          <input style={st.input} value={evoInst} onChange={e => setEvoInst(e.target.value)} placeholder="Ex: vivanexa-empresa" />

          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 16 }}>
            <button onClick={verificarConexao} disabled={checking} style={st.btnSec}>{checking ? '⏳...' : '🔌 Verificar status'}</button>
            <button onClick={buscarQR} disabled={checking} style={st.btnSec}>{checking ? '⏳...' : '📱 Gerar QR Code'}</button>
          </div>

          {qrCode && (
            <div style={{ textAlign: 'center', marginBottom: 16 }}>
              <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 10 }}>WhatsApp → Dispositivos Conectados → Conectar → Escanear QR</div>
              <img src={qrCode.startsWith('data:') ? qrCode : `data:image/png;base64,${qrCode}`} alt="QR Code" style={{ width: 220, height: 220, borderRadius: 12, border: '3px solid var(--accent)', background: '#fff', padding: 8 }} />
            </div>
          )}

          <div style={{ padding: '12px 14px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8 }}>
            <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 8, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1 }}>URL do Webhook (configure na Evolution API → Eventos: MESSAGES_UPSERT)</div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <div style={{ flex: 1, fontFamily: 'monospace', fontSize: 11, color: '#10b981', wordBreak: 'break-all' }}>{webhookUrl}</div>
              <button onClick={() => { navigator.clipboard?.writeText(webhookUrl); setMsg('✅ URL copiada!') }} style={{ ...st.btnSec, padding: '5px 10px', fontSize: 11 }}>Copiar</button>
            </div>
          </div>
        </div>
      )}

      {provider === 'meta' && (
        <div style={{ padding: '14px 18px', background: 'rgba(0,212,255,.06)', border: '1px solid rgba(0,212,255,.2)', borderRadius: 10, fontSize: 13, color: 'var(--muted)', lineHeight: 1.7, marginBottom: 16 }}>
          O WhatsApp Oficial (Meta) é configurado na aba <strong style={{ color: 'var(--text)' }}>🔗 Integrações</strong>. Após salvar as credenciais lá, o Inbox usará aquela conexão automaticamente.
        </div>
      )}

      <div style={st.card}>
        <div style={st.sec}>🏷️ Tags de Conversa</div>
        <p style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 14, lineHeight: 1.6 }}>Tags para segmentar leads e clientes no Inbox WhatsApp.</p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
          {wppTags.map((tag, i) => (
            <div key={tag.id} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 12px', borderRadius: 20, border: `1.5px solid ${tag.cor}55`, background: tag.cor + '15' }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: tag.cor, flexShrink: 0 }} />
              <span style={{ fontSize: 12, fontWeight: 600, color: tag.cor }}>{tag.label}</span>
              <button onClick={() => setWppTags(prev => prev.filter((_, j) => j !== i))} style={{ background: 'none', border: 'none', color: tag.cor, cursor: 'pointer', fontSize: 14, padding: 0 }}>×</button>
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <input style={{ ...st.input, flex: 1, marginBottom: 0 }} value={novaTagLabel} onChange={e => setNovaTagLabel(e.target.value)} placeholder="Nome da tag" onKeyDown={e => e.key === 'Enter' && adicionarTag()} />
          <input type="color" value={novaTagCor} onChange={e => setNovaTagCor(e.target.value)} style={{ width: 36, height: 36, border: '1px solid var(--border)', borderRadius: 8, cursor: 'pointer', background: 'none' }} />
          <button onClick={adicionarTag} style={{ ...st.btnSec, marginBottom: 0 }}>+ Adicionar</button>
        </div>
      </div>

      <button onClick={salvar} disabled={saving} style={st.btn}>{saving ? '⏳ Salvando...' : '💾 Salvar configurações WhatsApp'}</button>

      {msg && (
        <div style={{ marginTop: 12, padding: '12px 16px', borderRadius: 10, background: msg.startsWith('✅') ? 'rgba(16,185,129,.1)' : 'rgba(239,68,68,.1)', border: `1px solid ${msg.startsWith('✅') ? 'rgba(16,185,129,.3)' : 'rgba(239,68,68,.3)'}`, color: msg.startsWith('✅') ? '#10b981' : '#ef4444', fontSize: 13 }}>
          {msg}
        </div>
      )}
    </div>
  )
}

// ══════════════════════════════════════════════
// ABA AGENTE IA
// ══════════════════════════════════════════════
// ══════════════════════════════════════════════
// ABA AGENTE IA — v2 com base de conhecimento expandida
// (PDF, site, texto livre)
// ══════════════════════════════════════════════
function TabAgenteIA({ cfg, setCfg, empresaId }) {
  const [agentes, setAgentes] = React.useState(cfg.wppAgentes || [])
  const [editIdx, setEditIdx] = React.useState(null)
  const [form, setForm]       = React.useState(null)
  const [saving, setSaving]   = React.useState(false)
  const [msg, setMsg]         = React.useState('')
  const [processandoPdf, setProcessandoPdf] = React.useState(false)
  const [processandoSite, setProcessandoSite] = React.useState(false)
  const pdfInputRef = React.useRef(null)

  const MODELOS = {
    openai: ['gpt-4o-mini', 'gpt-4o', 'gpt-3.5-turbo'],
    groq:   ['llama3-70b-8192', 'llama3-8b-8192', 'mixtral-8x7b-32768'],
    gemini: ['gemini-1.5-pro', 'gemini-1.5-flash'],
  }

  const AGENTE_VAZIO = {
    id: '', nome: 'Agente Vendas', ativo: true,
    prompt: `Você é um assistente comercial da empresa ${cfg.company || 'Vivanexa'}.\n\nSeu objetivo é qualificar leads, responder dúvidas e conduzir o cliente até o consultor humano.\n\nTOM: Profissional, amigável e objetivo.\nRESPOSTAS: Curtas, máximo 3 linhas por mensagem.`,
    provider: cfg.openaiApiKey ? 'openai' : cfg.groqApiKey ? 'groq' : 'openai',
    openaiKey: '', groqKey: '', geminiKey: '',
    model: 'gpt-4o-mini', maxTokens: 300,
    conhecimento: [],
    siteUrl: '',
    siteConteudo: '',
  }

  function novoAgente() {
    setForm({ ...AGENTE_VAZIO, id: 'agente_' + Date.now() })
    setEditIdx('novo')
  }

  function editarAgente(i) { setForm({ ...agentes[i] }); setEditIdx(i) }

  async function salvarAgente() {
    if (!form.nome.trim()) { setMsg('⚠️ Informe um nome'); return }
    setSaving(true); setMsg('')
    const novos = editIdx === 'novo' ? [...agentes, form] : agentes.map((a, i) => i === editIdx ? form : a)
    try {
      const { data: row } = await supabase.from('vx_storage').select('value').eq('key', `cfg:${empresaId}`).single()
      const atual = row?.value ? JSON.parse(row.value) : {}
      const novo  = { ...atual, wppAgentes: novos }
      await supabase.from('vx_storage').upsert({ key: `cfg:${empresaId}`, value: JSON.stringify(novo), updated_at: new Date().toISOString() })
      setCfg(novo); setAgentes(novos); setEditIdx(null); setForm(null); setMsg('✅ Agente salvo!')
    } catch (e) { setMsg('❌ Erro: ' + e.message) }
    setSaving(false)
  }

  async function removerAgente(i) {
    if (!confirm('Remover este agente?')) return
    const novos = agentes.filter((_, j) => j !== i)
    const { data: row } = await supabase.from('vx_storage').select('value').eq('key', `cfg:${empresaId}`).single()
    const atual = row?.value ? JSON.parse(row.value) : {}
    await supabase.from('vx_storage').upsert({ key: `cfg:${empresaId}`, value: JSON.stringify({ ...atual, wppAgentes: novos }), updated_at: new Date().toISOString() })
    setCfg({ ...cfg, wppAgentes: novos }); setAgentes(novos)
  }

  // ✅ NOVO: Ler PDF e extrair texto
  async function onPdfUpload(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setProcessandoPdf(true)
    setMsg('⏳ Lendo PDF...')
    try {
      const reader = new FileReader()
      reader.onload = async (ev) => {
        const base64 = ev.target.result.split(',')[1]
        // Chama API Claude/Gemini para extrair texto do PDF
        const geminiKey = cfg.geminiApiKey || cfg.geminiKey || ''
        if (geminiKey) {
          try {
            const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiKey}`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                contents: [{
                  parts: [
                    { inline_data: { mime_type: 'application/pdf', data: base64 } },
                    { text: 'Extraia todo o conteúdo textual deste PDF de forma organizada. Mantenha a estrutura original com títulos e seções. Não adicione comentários, apenas o conteúdo do documento.' }
                  ]
                }]
              })
            })
            const data = await res.json()
            const texto = data.candidates?.[0]?.content?.parts?.[0]?.text || ''
            if (texto) {
              const titulo = file.name.replace('.pdf', '')
              setForm(f => ({
                ...f,
                conhecimento: [...(f.conhecimento || []), { titulo, conteudo: texto, tipo: 'pdf', arquivo: file.name }]
              }))
              setMsg('✅ PDF lido e adicionado à base de conhecimento!')
            } else {
              setMsg('⚠️ Não foi possível extrair o texto do PDF. Verifique a chave Gemini.')
            }
          } catch (err) {
            setMsg('❌ Erro ao processar PDF: ' + err.message)
          }
        } else {
          // Fallback: extração básica via FileReader (texto simples)
          const textReader = new FileReader()
          textReader.onload = (ev2) => {
            const raw = ev2.target.result
            // Remove caracteres não imprimíveis e extrai texto básico
            const texto = raw.replace(/[^\x20-\x7E\n\r\t\u00C0-\u024F]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 5000)
            if (texto.length > 100) {
              setForm(f => ({
                ...f,
                conhecimento: [...(f.conhecimento || []), { titulo: file.name, conteudo: texto, tipo: 'pdf', arquivo: file.name }]
              }))
              setMsg('✅ PDF importado (extração básica — configure Gemini para melhor resultado)')
            } else {
              setMsg('⚠️ Configure a chave do Gemini em Config → Empresa para ler PDFs com precisão.')
            }
          }
          textReader.readAsText(file)
        }
        setProcessandoPdf(false)
      }
      reader.readAsDataURL(file)
    } catch (err) {
      setMsg('❌ Erro: ' + err.message)
      setProcessandoPdf(false)
    }
    e.target.value = ''
  }

  // ✅ NOVO: Rastrear site e extrair conteúdo
  async function rastrearSite() {
    const url = form.siteUrl?.trim()
    if (!url) { setMsg('⚠️ Informe a URL do site'); return }
    if (!url.startsWith('http')) { setMsg('⚠️ URL deve começar com http:// ou https://'); return }

    setProcessandoSite(true)
    setMsg('⏳ Acessando site...')
    try {
      // Busca o conteúdo do site via API própria ou proxy
      const res = await fetch('/api/ai/fetch-site', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url })
      })
      if (res.ok) {
        const data = await res.json()
        const texto = data.texto || ''
        if (texto) {
          setForm(f => ({
            ...f,
            siteConteudo: texto,
            conhecimento: [...(f.conhecimento || []), { titulo: `Site: ${url}`, conteudo: texto.slice(0, 3000), tipo: 'site', url }]
          }))
          setMsg(`✅ Site rastreado! ${texto.length} caracteres extraídos.`)
        } else {
          setMsg('⚠️ Não foi possível extrair conteúdo do site.')
        }
      } else {
        // Fallback: orientar o usuário a copiar manualmente
        setMsg('⚠️ Não foi possível acessar o site automaticamente. Cole o conteúdo manualmente no campo de texto abaixo.')
      }
    } catch (err) {
      setMsg('⚠️ Erro ao acessar site. Cole o conteúdo do site manualmente na base de conhecimento.')
    }
    setProcessandoSite(false)
  }

  const st = {
    card:  { background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 14, padding: '20px 22px', marginBottom: 14 },
    label: { fontSize: 11, color: 'var(--muted)', display: 'block', marginBottom: 5, letterSpacing: .5, textTransform: 'uppercase' },
    input: { width: '100%', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, padding: '9px 12px', fontFamily: 'DM Mono, monospace', fontSize: 13, color: 'var(--text)', outline: 'none', marginBottom: 12 },
    btn:   { padding: '10px 22px', borderRadius: 9, background: 'linear-gradient(135deg,#00d4ff,#0099bb)', border: 'none', color: '#fff', fontFamily: 'DM Mono, monospace', fontSize: 13, fontWeight: 600, cursor: 'pointer' },
    btnSec:{ padding: '9px 18px', borderRadius: 9, background: 'rgba(0,212,255,.1)', border: '1px solid rgba(0,212,255,.3)', color: 'var(--accent)', fontFamily: 'DM Mono, monospace', fontSize: 13, cursor: 'pointer' },
    btnPurple: { padding: '9px 18px', borderRadius: 9, background: 'rgba(124,58,237,.15)', border: '1px solid rgba(124,58,237,.35)', color: '#7c3aed', fontFamily: 'DM Mono, monospace', fontSize: 13, cursor: 'pointer' },
    h:     { fontFamily: 'Syne, sans-serif', fontSize: 15, fontWeight: 700, color: 'var(--accent)', marginBottom: 16 },
  }

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div style={st.h}>🤖 Agentes de IA — WhatsApp</div>
        <button onClick={novoAgente} style={st.btn}>+ Novo Agente</button>
      </div>

      <div style={{ padding: '12px 16px', background: 'rgba(124,58,237,.08)', border: '1px solid rgba(124,58,237,.25)', borderRadius: 10, fontSize: 12, color: 'var(--muted)', lineHeight: 1.7, marginBottom: 20 }}>
        🤖 Agentes respondem automaticamente conversas no status <strong style={{ color: '#7c3aed' }}>Automação</strong> do Inbox.<br />
        As chaves globais são as de <strong style={{ color: 'var(--text)' }}>Config → Empresa → IA</strong>. Você pode definir chaves específicas por agente.
      </div>

      {agentes.length === 0 && editIdx === null && (
        <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--muted)', fontSize: 13 }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>🤖</div>
          Nenhum agente configurado. Clique em <strong>+ Novo Agente</strong>.
        </div>
      )}

      {agentes.map((a, i) => editIdx === i ? null : (
        <div key={a.id} style={st.card}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text)', marginBottom: 4 }}>🤖 {a.nome}</div>
              <div style={{ fontSize: 11, color: 'var(--muted)' }}>
                {a.provider === 'openai' ? 'OpenAI' : a.provider === 'groq' ? 'Groq' : 'Gemini'} · {a.model} · {a.maxTokens} tokens
                {(a.conhecimento || []).length > 0 && <span style={{ marginLeft: 8, color: '#10b981' }}>· 📚 {a.conhecimento.length} base(s)</span>}
                {a.siteUrl && <span style={{ marginLeft: 8, color: '#7c3aed' }}>· 🌐 Site</span>}
              </div>
            </div>
            <span style={{ padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700, background: a.ativo ? 'rgba(16,185,129,.15)' : 'rgba(100,116,139,.15)', color: a.ativo ? '#10b981' : '#64748b', border: `1px solid ${a.ativo ? 'rgba(16,185,129,.3)' : 'rgba(100,116,139,.3)'}` }}>
              {a.ativo ? '● Ativo' : '○ Inativo'}
            </span>
            <button onClick={() => editarAgente(i)} style={st.btnSec}>✏️ Editar</button>
            <button onClick={() => removerAgente(i)} style={{ ...st.btnSec, color: '#ef4444', borderColor: 'rgba(239,68,68,.3)', background: 'rgba(239,68,68,.08)' }}>🗑</button>
          </div>
        </div>
      ))}

      {form && editIdx !== null && (
        <div style={{ ...st.card, border: '1px solid rgba(0,212,255,.3)', background: 'rgba(0,212,255,.03)' }}>
          <div style={{ fontFamily: 'Syne, sans-serif', fontSize: 14, fontWeight: 700, color: 'var(--accent)', marginBottom: 16 }}>
            {editIdx === 'novo' ? '➕ Novo Agente' : '✏️ Editando Agente'}
          </div>

          {/* Nome + Ativo */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={st.label}>Nome do Agente</label>
              <input style={st.input} value={form.nome} onChange={e => setForm(f => ({ ...f, nome: e.target.value }))} placeholder="Ex: Vendas Bot" />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', paddingTop: 18 }}>
              <label style={{ fontSize: 13, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                <input type="checkbox" checked={form.ativo} onChange={e => setForm(f => ({ ...f, ativo: e.target.checked }))} style={{ width: 16, height: 16 }} />
                Agente ativo
              </label>
            </div>
          </div>

          {/* Provedor + Modelo + Tokens */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
            <div>
              <label style={st.label}>Provedor de IA</label>
              <select value={form.provider} onChange={e => setForm(f => ({ ...f, provider: e.target.value, model: MODELOS[e.target.value]?.[0] || '' }))} style={{ ...st.input, appearance: 'auto' }}>
                <option value="openai">OpenAI (GPT)</option>
                <option value="groq">Groq (Llama)</option>
                <option value="gemini">Google Gemini</option>
              </select>
            </div>
            <div>
              <label style={st.label}>Modelo</label>
              <select value={form.model} onChange={e => setForm(f => ({ ...f, model: e.target.value }))} style={{ ...st.input, appearance: 'auto' }}>
                {(MODELOS[form.provider] || []).map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
            <div>
              <label style={st.label}>Max Tokens</label>
              <input type="number" style={st.input} value={form.maxTokens} onChange={e => setForm(f => ({ ...f, maxTokens: Number(e.target.value) }))} placeholder="300" />
            </div>
          </div>

          {/* API Key */}
          <div>
            <label style={st.label}>API Key específica (opcional — usa a global de Config → Empresa se vazio)</label>
            <input style={{ ...st.input, fontFamily: 'monospace' }} type="password"
              value={form.provider === 'openai' ? (form.openaiKey || '') : form.provider === 'groq' ? (form.groqKey || '') : (form.geminiKey || '')}
              onChange={e => {
                const k = form.provider === 'openai' ? 'openaiKey' : form.provider === 'groq' ? 'groqKey' : 'geminiKey'
                setForm(f => ({ ...f, [k]: e.target.value }))
              }}
              placeholder={form.provider === 'openai' ? 'sk-...' : form.provider === 'groq' ? 'gsk_...' : 'AIza...'} />
          </div>

          {/* Prompt */}
          <div>
            <label style={st.label}>Prompt do Sistema</label>
            <textarea value={form.prompt} onChange={e => setForm(f => ({ ...f, prompt: e.target.value }))} rows={7}
              style={{ ...st.input, resize: 'vertical', lineHeight: 1.6 }} placeholder="Você é um assistente comercial..." />
          </div>

          {/* ✅ BASE DE CONHECIMENTO EXPANDIDA */}
          <div style={{ background: 'rgba(0,0,0,.2)', borderRadius: 12, padding: '16px 18px', border: '1px solid rgba(255,255,255,.06)' }}>
            <div style={{ fontFamily: 'Syne, sans-serif', fontSize: 13, fontWeight: 700, color: '#e2e8f0', marginBottom: 4 }}>
              📚 Base de Conhecimento
            </div>
            <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 16, lineHeight: 1.6 }}>
              Alimente o agente com informações da sua empresa. Quanto mais contexto, melhores as respostas.
            </div>

            {/* ── TAB: PDF / SITE / TEXTO ── */}
            <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
              {[['texto','📝 Texto Livre'],['pdf','📄 Upload PDF'],['site','🌐 Site da Empresa']].map(([id, label]) => (
                <button key={id}
                  onClick={() => setForm(f => ({ ...f, _kbTab: id }))}
                  style={{ padding: '6px 14px', borderRadius: 7, border: 'none', cursor: 'pointer', fontFamily: 'DM Mono, monospace', fontSize: 11,
                    background: (form._kbTab || 'texto') === id ? 'linear-gradient(135deg,#00d4ff,#0099bb)' : 'rgba(255,255,255,.04)',
                    color: (form._kbTab || 'texto') === id ? '#fff' : '#64748b',
                    outline: (form._kbTab || 'texto') === id ? 'none' : '1px solid #1e2d4a'
                  }}>
                  {label}
                </button>
              ))}
            </div>

            {/* Painel TEXTO LIVRE */}
            {(!form._kbTab || form._kbTab === 'texto') && (
              <div>
                <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 10 }}>
                  Adicione textos com título e conteúdo — ex: FAQ, lista de preços, política, diferenciais, scripts.
                </div>
                {(form.conhecimento || []).filter(k => !k.tipo || k.tipo === 'texto').map((k, ki) => (
                  <div key={ki} style={{ display: 'flex', gap: 8, marginBottom: 8, alignItems: 'flex-start' }}>
                    <input style={{ ...st.input, width: 160, marginBottom: 0, flexShrink: 0, fontSize: 12 }}
                      value={k.titulo || ''} placeholder="Título (ex: FAQ)"
                      onChange={e => setForm(f => ({ ...f, conhecimento: f.conhecimento.map((x, xi) => xi === ki ? { ...x, titulo: e.target.value } : x) }))} />
                    <textarea style={{ ...st.input, flex: 1, marginBottom: 0, resize: 'vertical', minHeight: 60, fontSize: 12 }}
                      value={k.conteudo || ''} placeholder="Conteúdo..."
                      onChange={e => setForm(f => ({ ...f, conhecimento: f.conhecimento.map((x, xi) => xi === ki ? { ...x, conteudo: e.target.value } : x) }))} />
                    <button onClick={() => setForm(f => ({ ...f, conhecimento: f.conhecimento.filter((_, xi) => xi !== ki) }))}
                      style={{ background: 'rgba(239,68,68,.1)', border: '1px solid rgba(239,68,68,.2)', color: '#ef4444', borderRadius: 8, padding: '6px 10px', cursor: 'pointer', flexShrink: 0 }}>✕</button>
                  </div>
                ))}
                <button onClick={() => setForm(f => ({ ...f, conhecimento: [...(f.conhecimento || []), { titulo: '', conteudo: '', tipo: 'texto' }] }))}
                  style={{ ...st.btnSec, fontSize: 12, padding: '6px 12px' }}>+ Adicionar texto</button>
              </div>
            )}

            {/* Painel PDF */}
            {form._kbTab === 'pdf' && (
              <div>
                <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 12, lineHeight: 1.6 }}>
                  Faça upload de PDFs (catálogos, manuais, contratos, políticas). O texto será extraído automaticamente.<br />
                  <strong style={{ color: '#f59e0b' }}>💡 Configure a chave Gemini em Config → Empresa para melhor extração.</strong>
                </div>

                {/* Área de upload */}
                <div
                  onClick={() => !processandoPdf && pdfInputRef.current?.click()}
                  style={{ border: '2px dashed #1e2d4a', borderRadius: 10, padding: '28px 20px', textAlign: 'center', cursor: processandoPdf ? 'not-allowed' : 'pointer', background: 'rgba(0,212,255,.03)', transition: 'border-color .2s', marginBottom: 14 }}
                  onMouseEnter={e => !processandoPdf && (e.currentTarget.style.borderColor = 'rgba(0,212,255,.4)')}
                  onMouseLeave={e => e.currentTarget.style.borderColor = '#1e2d4a'}>
                  {processandoPdf ? (
                    <div>
                      <div style={{ fontSize: 28, marginBottom: 8 }}>⏳</div>
                      <div style={{ fontSize: 13, color: '#64748b' }}>Lendo PDF...</div>
                    </div>
                  ) : (
                    <div>
                      <div style={{ fontSize: 36, marginBottom: 10 }}>📄</div>
                      <div style={{ fontSize: 13, color: '#94a3b8', marginBottom: 4 }}>Clique para selecionar PDF</div>
                      <div style={{ fontSize: 11, color: '#475569' }}>Máx. recomendado: 5 MB · PDF, texto</div>
                    </div>
                  )}
                </div>
                <input ref={pdfInputRef} type="file" accept=".pdf" style={{ display: 'none' }} onChange={onPdfUpload} />

                {/* PDFs já adicionados */}
                {(form.conhecimento || []).filter(k => k.tipo === 'pdf').map((k, ki) => {
                  const idx = (form.conhecimento || []).indexOf(k)
                  return (
                    <div key={ki} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: 'rgba(16,185,129,.08)', border: '1px solid rgba(16,185,129,.2)', borderRadius: 8, marginBottom: 6 }}>
                      <span style={{ fontSize: 20 }}>📄</span>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 12, fontWeight: 600, color: '#e2e8f0' }}>{k.titulo}</div>
                        <div style={{ fontSize: 10, color: '#64748b', marginTop: 2 }}>{(k.conteudo || '').length} chars extraídos</div>
                      </div>
                      <button onClick={() => setForm(f => ({ ...f, conhecimento: f.conhecimento.filter((_, xi) => xi !== idx) }))}
                        style={{ background: 'rgba(239,68,68,.1)', border: '1px solid rgba(239,68,68,.2)', color: '#ef4444', borderRadius: 8, padding: '5px 10px', cursor: 'pointer', fontSize: 12 }}>✕</button>
                    </div>
                  )
                })}
              </div>
            )}

            {/* Painel SITE */}
            {form._kbTab === 'site' && (
              <div>
                <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 12, lineHeight: 1.6 }}>
                  Informe a URL do site da empresa. O sistema tentará extrair o conteúdo automaticamente.<br />
                  Se o site bloquear o acesso, cole o conteúdo manualmente no campo de texto abaixo.
                </div>

                {/* URL do site */}
                <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                  <input style={{ ...st.input, flex: 1, marginBottom: 0 }}
                    value={form.siteUrl || ''} placeholder="https://seusite.com.br"
                    onChange={e => setForm(f => ({ ...f, siteUrl: e.target.value }))} />
                  <button onClick={rastrearSite} disabled={processandoSite}
                    style={{ ...st.btn, padding: '9px 18px', fontSize: 12, whiteSpace: 'nowrap', opacity: processandoSite ? .6 : 1 }}>
                    {processandoSite ? '⏳ Acessando...' : '🌐 Rastrear Site'}
                  </button>
                </div>

                {/* Sites já rastreados */}
                {(form.conhecimento || []).filter(k => k.tipo === 'site').map((k, ki) => {
                  const idx = (form.conhecimento || []).indexOf(k)
                  return (
                    <div key={ki} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: 'rgba(124,58,237,.08)', border: '1px solid rgba(124,58,237,.2)', borderRadius: 8, marginBottom: 6 }}>
                      <span style={{ fontSize: 20 }}>🌐</span>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 12, fontWeight: 600, color: '#e2e8f0' }}>{k.titulo}</div>
                        <div style={{ fontSize: 10, color: '#64748b', marginTop: 2 }}>{(k.conteudo || '').length} chars · {k.url}</div>
                      </div>
                      <button onClick={() => setForm(f => ({ ...f, conhecimento: f.conhecimento.filter((_, xi) => xi !== idx) }))}
                        style={{ background: 'rgba(239,68,68,.1)', border: '1px solid rgba(239,68,68,.2)', color: '#ef4444', borderRadius: 8, padding: '5px 10px', cursor: 'pointer', fontSize: 12 }}>✕</button>
                    </div>
                  )
                })}

                {/* Fallback: conteúdo manual */}
                <div style={{ marginTop: 12 }}>
                  <label style={{ ...st.label, marginBottom: 6 }}>Ou cole o conteúdo do site manualmente</label>
                  <textarea style={{ ...st.input, minHeight: 100, resize: 'vertical', fontSize: 12 }}
                    value={form.siteConteudo || ''}
                    onChange={e => setForm(f => ({ ...f, siteConteudo: e.target.value }))}
                    placeholder="Cole aqui o texto da página Sobre, produtos, serviços, FAQ, etc..." />
                  {form.siteConteudo && (
                    <button onClick={() => {
                      const url = form.siteUrl || 'Site manual'
                      setForm(f => ({
                        ...f,
                        conhecimento: [...(f.conhecimento || []), { titulo: `Site: ${url}`, conteudo: form.siteConteudo, tipo: 'site', url }],
                        siteConteudo: ''
                      }))
                    }} style={{ ...st.btnSec, fontSize: 12, padding: '6px 14px', marginTop: 6 }}>
                      + Adicionar à base de conhecimento
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Resumo da base */}
            {(form.conhecimento || []).length > 0 && (
              <div style={{ marginTop: 14, padding: '10px 14px', background: 'rgba(16,185,129,.06)', border: '1px solid rgba(16,185,129,.2)', borderRadius: 8, fontSize: 11, color: '#64748b', display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                <span>📚 <strong style={{ color: '#10b981' }}>{(form.conhecimento || []).length}</strong> item(ns) na base</span>
                <span>📝 <strong style={{ color: '#10b981' }}>{(form.conhecimento || []).filter(k => !k.tipo || k.tipo === 'texto').length}</strong> textos</span>
                <span>📄 <strong style={{ color: '#10b981' }}>{(form.conhecimento || []).filter(k => k.tipo === 'pdf').length}</strong> PDFs</span>
                <span>🌐 <strong style={{ color: '#10b981' }}>{(form.conhecimento || []).filter(k => k.tipo === 'site').length}</strong> sites</span>
                <span>💾 <strong style={{ color: '#10b981' }}>{((form.conhecimento || []).reduce((a, k) => a + (k.conteudo || '').length, 0) / 1000).toFixed(1)} KB</strong> total</span>
              </div>
            )}
          </div>

          {/* Botões */}
          <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
            <button onClick={salvarAgente} disabled={saving} style={st.btn}>{saving ? '⏳...' : '💾 Salvar Agente'}</button>
            <button onClick={() => { setEditIdx(null); setForm(null) }} style={st.btnSec}>Cancelar</button>
          </div>
        </div>
      )}

      {msg && (
        <div style={{ marginTop: 12, padding: '12px 16px', borderRadius: 10, background: msg.startsWith('✅') ? 'rgba(16,185,129,.1)' : msg.startsWith('⏳') ? 'rgba(0,212,255,.1)' : 'rgba(239,68,68,.1)', border: `1px solid ${msg.startsWith('✅') ? 'rgba(16,185,129,.3)' : msg.startsWith('⏳') ? 'rgba(0,212,255,.3)' : 'rgba(239,68,68,.3)'}`, color: msg.startsWith('✅') ? '#10b981' : msg.startsWith('⏳') ? '#00d4ff' : '#ef4444', fontSize: 13 }}>
          {msg}
        </div>
      )}
    </div>
  )
}

function TabDepartamentos({ cfg, setCfg, empresaId }) {
  const [deps,    setDeps]    = React.useState(cfg.wppDeps || [
    { id: 'vendas',    nome: 'Vendas',          cor: '#10b981', ordem: 1 },
    { id: 'suporte',   nome: 'Suporte Técnico', cor: '#ef4444', ordem: 2 },
    { id: 'financeiro',nome: 'Financeiro',       cor: '#00d4ff', ordem: 3 },
  ])
  const [editIdx, setEditIdx] = React.useState(null)
  const [form,    setForm]    = React.useState(null)
  const [saving,  setSaving]  = React.useState(false)
  const [msg,     setMsg]     = React.useState('')

  const st = {
    card:  { background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 12, padding: '16px 20px', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 14 },
    label: { fontSize: 11, color: 'var(--muted)', display: 'block', marginBottom: 5, letterSpacing: .5, textTransform: 'uppercase' },
    input: { width: '100%', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, padding: '9px 12px', fontFamily: 'DM Mono, monospace', fontSize: 13, color: 'var(--text)', outline: 'none', marginBottom: 12 },
    btn:   { padding: '10px 22px', borderRadius: 9, background: 'linear-gradient(135deg,#00d4ff,#0099bb)', border: 'none', color: '#fff', fontFamily: 'DM Mono, monospace', fontSize: 13, fontWeight: 600, cursor: 'pointer' },
    btnSec:{ padding: '9px 18px', borderRadius: 9, background: 'rgba(0,212,255,.1)', border: '1px solid rgba(0,212,255,.3)', color: 'var(--accent)', fontFamily: 'DM Mono, monospace', fontSize: 13, cursor: 'pointer' },
    h:     { fontFamily: 'Syne, sans-serif', fontSize: 15, fontWeight: 700, color: 'var(--accent)', marginBottom: 16 },
  }

  async function salvarNoBanco(novosDeps) {
    setSaving(true); setMsg('')
    try {
      const { data: row } = await supabase.from('vx_storage').select('value').eq('key', `cfg:${empresaId}`).single()
      const atual = row?.value ? JSON.parse(row.value) : {}
      const novo  = { ...atual, wppDeps: novosDeps }
      await supabase.from('vx_storage').upsert({ key: `cfg:${empresaId}`, value: JSON.stringify(novo), updated_at: new Date().toISOString() })
      setCfg(novo); setDeps(novosDeps); setMsg('✅ Departamentos salvos!')
    } catch (e) { setMsg('❌ Erro: ' + e.message) }
    setSaving(false)
  }

  function salvarForm() {
    if (!form.nome.trim()) { setMsg('⚠️ Informe o nome'); return }
    const id = form.id || form.nome.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '')
    const dep = { ...form, id }
    const novos = editIdx === 'novo' ? [...deps, dep] : deps.map((d, i) => i === editIdx ? dep : d)
    setEditIdx(null); setForm(null)
    salvarNoBanco(novos)
  }

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div style={st.h}>🏢 Departamentos / Filas de Atendimento</div>
        <button onClick={() => { setForm({ id: '', nome: '', cor: '#10b981', ordem: deps.length + 1 }); setEditIdx('novo') }} style={st.btn}>+ Novo Departamento</button>
      </div>

      <p style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 20, lineHeight: 1.7 }}>
        Filas de atendimento do Inbox WhatsApp. As conversas podem ser transferidas entre departamentos e Agentes de IA podem ser vinculados a filas específicas.
      </p>

      {deps.sort((a, b) => a.ordem - b.ordem).map((d, i) => editIdx === i ? null : (
        <div key={d.id} style={st.card}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: d.cor + '25', border: `2px solid ${d.cor}55`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>🏢</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text)' }}>{d.nome}</div>
            <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>ID: {d.id} · Ordem: {d.ordem}</div>
          </div>
          <button onClick={() => { setForm({ ...d }); setEditIdx(i) }} style={{ ...st.btnSec, padding: '6px 12px', fontSize: 12 }}>✏️</button>
          <button onClick={() => salvarNoBanco(deps.filter((_, j) => j !== i))} style={{ background: 'rgba(239,68,68,.1)', border: '1px solid rgba(239,68,68,.2)', color: '#ef4444', borderRadius: 8, padding: '6px 10px', cursor: 'pointer' }}>🗑</button>
        </div>
      ))}

      {form && editIdx !== null && (
        <div style={{ background: 'rgba(0,212,255,.03)', border: '1px solid rgba(0,212,255,.3)', borderRadius: 14, padding: '20px 22px', marginBottom: 14 }}>
          <div style={{ fontFamily: 'Syne, sans-serif', fontSize: 14, fontWeight: 700, color: 'var(--accent)', marginBottom: 14 }}>
            {editIdx === 'novo' ? '➕ Novo Departamento' : '✏️ Editar Departamento'}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 100px 60px', gap: 12 }}>
            <div>
              <label style={st.label}>Nome do Departamento</label>
              <input style={st.input} value={form.nome} onChange={e => setForm(f => ({ ...f, nome: e.target.value }))} placeholder="Ex: Vendas" />
            </div>
            <div>
              <label style={st.label}>Ordem</label>
              <input type="number" style={st.input} value={form.ordem} onChange={e => setForm(f => ({ ...f, ordem: Number(e.target.value) }))} />
            </div>
            <div>
              <label style={st.label}>Cor</label>
              <input type="color" value={form.cor} onChange={e => setForm(f => ({ ...f, cor: e.target.value }))} style={{ width: '100%', height: 42, border: '1px solid var(--border)', borderRadius: 8, cursor: 'pointer', background: 'none' }} />
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={salvarForm} disabled={saving} style={st.btn}>{saving ? '⏳...' : '💾 Salvar'}</button>
            <button onClick={() => { setEditIdx(null); setForm(null) }} style={st.btnSec}>Cancelar</button>
          </div>
        </div>
      )}

      {msg && (
        <div style={{ marginTop: 12, padding: '12px 16px', borderRadius: 10, background: msg.startsWith('✅') ? 'rgba(16,185,129,.1)' : 'rgba(239,68,68,.1)', border: `1px solid ${msg.startsWith('✅') ? 'rgba(16,185,129,.3)' : 'rgba(239,68,68,.3)'}`, color: msg.startsWith('✅') ? '#10b981' : '#ef4444', fontSize: 13 }}>
          {msg}
        </div>
      )}
    </div>
  )
}

export default function Configuracoes() {
  const router    = useRouter()
  const [loading,   setLoading]   = useState(true)
  const [perfil,    setPerfil]    = useState(null)
  const [empresaId, setEmpresaId] = useState(null)
  const [cfg,       setCfg]       = useState({})
  const [abaAtiva,  setAbaAtiva]  = useState('empresa')

  // ── Lê ?tab= da URL para navegar direto à aba correta (vindo do menu) ──
  useEffect(() => {
    if (!router.isReady) return
    const { tab } = router.query
    if (tab && TABS.find(t => t.id === tab)) {
      setAbaAtiva(tab)
    }
  }, [router.isReady, router.query])

  function mudarAba(id) {
    setAbaAtiva(id)
    router.replace({ pathname: '/configuracoes', query: { tab: id } }, undefined, { shallow: true })
  }

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
      case 'perfis':     return <TabPerfis     {...props} />
      case 'usuarios':   return <TabUsuarios   {...props} />
      case 'produtos':   return <TabProdutos   {...props} />
      case 'descontos':  return <TabDescontos  {...props} />
      case 'vouchers':   return <TabVouchers   {...props} />
      case 'documentos': return <TabDocumentos {...props} />
      case 'clientes':   return <TabClientes   {...props} />
      case 'tema':       return <TabTema       {...props} />
      case 'whatsapp':      return <TabWhatsapp      {...props} />
      case 'agente_ia':     return <TabAgenteIA      {...props} />
      case 'departamentos': return <TabDepartamentos {...props} />
      case 'integracoes':  return <TabIntegracoes {...props} />
      case 'google_meta':  return <TabGoogleMeta  {...props} />
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

      <Navbar cfg={cfg} perfil={perfil} />

      <main style={{ position: 'relative', zIndex: 10, width: '100%', maxWidth: 960, margin: '20px auto 60px', padding: '0 20px' }}>
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, overflow: 'hidden', boxShadow: 'var(--shadow)' }}>
          <div style={{ background: 'var(--surface2)', borderBottom: '1px solid var(--border)', padding: '16px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <h3 style={{ fontFamily: 'Syne, sans-serif', fontSize: 16, fontWeight: 700, color: 'var(--accent)' }}>⚙️ Configurações</h3>
            <div style={{ fontSize: 12, color: 'var(--muted)' }}>{perfil?.nome && `Olá, ${perfil.nome}`}</div>
          </div>
          <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', background: 'var(--surface)', overflowX: 'auto' }}>
            {TABS.map(t => (
              <button key={t.id} onClick={() => mudarAba(t.id)} style={{ flexShrink: 0, padding: '11px 14px', border: 'none', background: 'none', color: abaAtiva === t.id ? 'var(--accent)' : 'var(--muted)', fontFamily: 'DM Mono, monospace', fontSize: 12, cursor: 'pointer', borderBottom: `2px solid ${abaAtiva === t.id ? 'var(--accent)' : 'transparent'}`, letterSpacing: .3, whiteSpace: 'nowrap', transition: 'color .2s', position: 'relative', top: 1 }}>{t.label}</button>
            ))}
          </div>
          {renderAba()}
        </div>
      </main>
    </>
  )
}

// ══════════════════════════════════════════════════════════
// ABA GOOGLE PLACES & META (Facebook/Instagram)
// Usada pelo Gerador de Leads
// ══════════════════════════════════════════════════════════
function TabGoogleMeta({ cfg, setCfg, empresaId }) {
  const saved = cfg.apiLeads || {}

  // Google Places
  const [googleKey,     setGoogleKey]     = React.useState(saved.googlePlacesKey || '')
  const [googleAtivo,   setGoogleAtivo]   = React.useState(saved.googlePlacesAtivo || false)
  const [googleTestNicho, setGoogleTestNicho] = React.useState('Contabilidade')
  const [googleTestCidade, setGoogleTestCidade] = React.useState('São Paulo')

  // Meta (Facebook Graph API — Pages Search + Instagram Business Discovery)
  const [metaToken,     setMetaToken]     = React.useState(saved.metaGraphToken || '')
  const [metaAppId,     setMetaAppId]     = React.useState(saved.metaAppId || '')
  const [metaAppSecret, setMetaAppSecret] = React.useState(saved.metaAppSecret || '')
  const [metaAtivo,     setMetaAtivo]     = React.useState(saved.metaAtivo || false)

  const [saving,    setSaving]    = React.useState(false)
  const [testingG,  setTestingG]  = React.useState(false)
  const [testingM,  setTestingM]  = React.useState(false)
  const [msg,       setMsg]       = React.useState('')
  const [testResultG, setTestResultG] = React.useState(null)
  const [testResultM, setTestResultM] = React.useState(null)

  const s = {
    card:   { background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 14, padding: '22px 24px', marginBottom: 16 },
    label:  { fontSize: 11, color: 'var(--muted)', display: 'block', marginBottom: 5, letterSpacing: .5, textTransform: 'uppercase' },
    input:  { width: '100%', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, padding: '9px 12px', fontFamily: 'DM Mono, monospace', fontSize: 13, color: 'var(--text)', outline: 'none', marginBottom: 12 },
    btn:    { padding: '10px 22px', borderRadius: 9, background: 'linear-gradient(135deg,#00d4ff,#0099bb)', border: 'none', color: '#fff', fontFamily: 'DM Mono, monospace', fontSize: 13, fontWeight: 600, cursor: 'pointer' },
    btnSec: { padding: '9px 18px', borderRadius: 9, background: 'rgba(0,212,255,.1)', border: '1px solid rgba(0,212,255,.3)', color: 'var(--accent)', fontFamily: 'DM Mono, monospace', fontSize: 13, cursor: 'pointer' },
    btnGreen: { padding: '9px 18px', borderRadius: 9, background: 'rgba(16,185,129,.15)', border: '1px solid rgba(16,185,129,.3)', color: 'var(--accent3)', fontFamily: 'DM Mono, monospace', fontSize: 13, cursor: 'pointer' },
    h:      { fontFamily: 'Syne, sans-serif', fontSize: 15, fontWeight: 700, color: 'var(--accent)', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 },
    step:   { background: 'rgba(0,212,255,.06)', border: '1px solid rgba(0,212,255,.15)', borderRadius: 10, padding: '12px 16px', marginBottom: 8, fontSize: 12, color: 'var(--text)', lineHeight: 1.7 },
    badge:  { display: 'inline-flex', alignItems: 'center', gap: 6, padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700 },
    secH:   { fontFamily: 'Syne, sans-serif', fontSize: 14, fontWeight: 700, marginBottom: 14 },
    info:   { background: 'rgba(0,212,255,.06)', border: '1px solid rgba(0,212,255,.15)', borderRadius: 8, padding: '10px 14px', fontSize: 12, color: 'var(--muted)', lineHeight: 1.7, marginBottom: 14 },
    warn:   { background: 'rgba(245,158,11,.08)', border: '1px solid rgba(245,158,11,.25)', borderRadius: 8, padding: '10px 14px', fontSize: 12, color: '#fbbf24', lineHeight: 1.7, marginBottom: 14 },
  }

  async function salvar() {
    setSaving(true); setMsg('')
    try {
      const { data: row } = await supabase.from('vx_storage').select('value').eq('key', `cfg:${empresaId}`).maybeSingle()
      const atual = row?.value ? JSON.parse(row.value) : {}
      const novo  = {
        ...atual,
        apiLeads: {
          googlePlacesKey:   googleKey.trim(),
          googlePlacesAtivo: googleAtivo,
          metaGraphToken:    metaToken.trim(),
          metaAppId:         metaAppId.trim(),
          metaAppSecret:     metaAppSecret.trim(),
          metaAtivo,
        },
        // Compat: gerador-leads.js lê cfg.googlePlacesKey e cfg.metaToken diretamente
        googlePlacesKey: googleKey.trim(),
        metaToken:       metaToken.trim(),
      }
      await supabase.from('vx_storage').upsert({ key: `cfg:${empresaId}`, value: JSON.stringify(novo), updated_at: new Date().toISOString() })
      setCfg(novo)
      setMsg('✅ Configurações salvas com sucesso!')
    } catch (e) { setMsg('❌ Erro ao salvar: ' + e.message) }
    setSaving(false)
  }

  async function testarGoogle() {
    if (!googleKey.trim()) { setMsg('⚠️ Informe a Google API Key antes de testar'); return }
    setTestingG(true); setTestResultG(null); setMsg('')
    try {
      const query = encodeURIComponent(`${googleTestNicho} ${googleTestCidade} Brasil`)
      const r = await fetch(
        `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${query}&key=${googleKey.trim()}&language=pt-BR&region=br`,
        { signal: AbortSignal.timeout(12000) }
      )
      const d = await r.json()
      if (d.status === 'OK') {
        setTestResultG({ ok: true, msg: `✅ API funcionando! ${d.results?.length || 0} resultados para "${googleTestNicho} em ${googleTestCidade}"`, sample: d.results?.[0]?.name })
      } else if (d.status === 'REQUEST_DENIED') {
        setTestResultG({ ok: false, msg: `❌ Acesso negado: ${d.error_message || 'verifique se a API Places está habilitada no Google Cloud Console e se a chave tem permissão'}` })
      } else {
        setTestResultG({ ok: false, msg: `⚠️ Status: ${d.status} — ${d.error_message || ''}` })
      }
    } catch (e) { setTestResultG({ ok: false, msg: '❌ Erro de conexão: ' + e.message }) }
    setTestingG(false)
  }

  async function testarMeta() {
    if (!metaToken.trim()) { setMsg('⚠️ Informe o Token da Graph API antes de testar'); return }
    setTestingM(true); setTestResultM(null); setMsg('')
    try {
      const r = await fetch(
        `https://graph.facebook.com/v19.0/me?fields=id,name&access_token=${metaToken.trim()}`,
        { signal: AbortSignal.timeout(10000) }
      )
      const d = await r.json()
      if (d.id) {
        setTestResultM({ ok: true, msg: `✅ Token válido! Conta: ${d.name} (ID: ${d.id})` })
      } else {
        setTestResultM({ ok: false, msg: `❌ Token inválido: ${d.error?.message || 'verifique o token'}` })
      }
    } catch (e) { setTestResultM({ ok: false, msg: '❌ Erro de conexão: ' + e.message }) }
    setTestingM(false)
  }

  function copiar(txt) {
    navigator.clipboard.writeText(txt)
    setMsg('✅ Copiado!')
    setTimeout(() => setMsg(''), 2000)
  }

  return (
    <div style={{ padding: '24px' }}>
      <div style={s.h}>📍 Google Meu Negócio & 📘 Facebook / Instagram</div>
      <div style={s.info}>
        Estas integrações são usadas pelo <strong style={{ color: 'var(--text)' }}>Gerador de Leads</strong> para buscar empresas por nicho e localização.
        Configure as chaves abaixo e salve — elas ficarão disponíveis automaticamente para todas as buscas.
      </div>

      {/* ══ GOOGLE PLACES ══ */}
      <div style={{ ...s.card, borderColor: googleAtivo ? 'rgba(0,212,255,.3)' : 'var(--border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div style={s.secH}>📍 Google Places API</div>
          <div style={{ ...s.badge, background: googleAtivo ? 'rgba(0,212,255,.12)' : 'rgba(100,116,139,.12)', color: googleAtivo ? 'var(--accent)' : '#64748b', border: `1px solid ${googleAtivo ? 'rgba(0,212,255,.3)' : 'rgba(100,116,139,.3)'}` }}>
            {googleAtivo ? '● Ativo' : '○ Inativo'}
          </div>
        </div>

        <div style={s.info}>
          Permite buscar empresas diretamente no <strong style={{ color: 'var(--text)' }}>Google Maps / Google Meu Negócio</strong>, retornando nome, telefone, site e endereço completo.
          A API é <strong style={{ color: 'var(--accent3)' }}>gratuita até 200 requisições/mês</strong> no plano free do Google Cloud (após isso ~US$17/1000).
        </div>

        {/* Passo a passo */}
        <div style={{ fontFamily: 'Syne, sans-serif', fontSize: 12, fontWeight: 700, color: 'var(--muted)', marginBottom: 10, textTransform: 'uppercase', letterSpacing: 1 }}>Como obter a chave:</div>
        {[
          ['1', 'Acesse o Google Cloud Console', 'console.cloud.google.com → crie ou selecione um projeto', 'https://console.cloud.google.com'],
          ['2', 'Habilite as APIs necessárias', 'APIs e Serviços → Biblioteca → habilite "Places API" e "Maps JavaScript API"', null],
          ['3', 'Crie uma credencial', 'APIs e Serviços → Credenciais → Criar credenciais → Chave de API', null],
          ['4', 'Restrinja a chave (recomendado)', 'Em Restrições de API, selecione apenas Places API para segurança', null],
          ['5', 'Cole a chave abaixo e salve', 'A chave tem o formato AIzaSy...', null],
        ].map(([n, t, d, link]) => (
          <div key={n} style={s.step}>
            <strong style={{ color: 'var(--accent)' }}>Passo {n}: {t}</strong>
            <div style={{ color: 'var(--muted)', marginTop: 2 }}>{d}</div>
            {link && <a href={link} target="_blank" rel="noreferrer" style={{ fontSize: 11, color: 'var(--accent)', display: 'inline-block', marginTop: 4 }}>{link}</a>}
          </div>
        ))}

        <label style={s.label}>Google Places API Key</label>
        <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
          <input style={{ ...s.input, marginBottom: 0, flex: 1, fontFamily: 'monospace', fontSize: 12 }}
            value={googleKey} onChange={e => setGoogleKey(e.target.value)}
            placeholder="AIzaSyXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX" type="password" />
          {googleKey && <button onClick={() => copiar(googleKey)} style={{ ...s.btnSec, padding: '9px 14px', marginBottom: 0 }}>📋</button>}
        </div>

        <label style={s.label}>Ativar busca Google Places no Gerador de Leads</label>
        <div style={{ marginBottom: 14 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, color: 'var(--text)' }}>
            <input type="checkbox" checked={googleAtivo} onChange={e => setGoogleAtivo(e.target.checked)} style={{ width: 15, height: 15, cursor: 'pointer' }} />
            Ativar Google Places
          </label>
        </div>

        {/* Teste */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 10 }}>
          <div>
            <label style={s.label}>Nicho para teste</label>
            <input style={{ ...s.input, marginBottom: 0 }} value={googleTestNicho} onChange={e => setGoogleTestNicho(e.target.value)} placeholder="Ex: Dentista" />
          </div>
          <div>
            <label style={s.label}>Cidade para teste</label>
            <input style={{ ...s.input, marginBottom: 0 }} value={googleTestCidade} onChange={e => setGoogleTestCidade(e.target.value)} placeholder="Ex: São Paulo" />
          </div>
        </div>
        <button onClick={testarGoogle} disabled={testingG} style={{ ...s.btnSec, marginBottom: testResultG ? 10 : 0 }}>
          {testingG ? '⏳ Testando...' : '🧪 Testar conexão Google'}
        </button>
        {testResultG && (
          <div style={{ padding: '10px 14px', borderRadius: 8, fontSize: 12, lineHeight: 1.6,
            background: testResultG.ok ? 'rgba(16,185,129,.08)' : 'rgba(239,68,68,.08)',
            border: `1px solid ${testResultG.ok ? 'rgba(16,185,129,.25)' : 'rgba(239,68,68,.25)'}`,
            color: testResultG.ok ? '#10b981' : '#ef4444' }}>
            {testResultG.msg}
            {testResultG.ok && testResultG.sample && <div style={{ marginTop: 4, color: 'var(--muted)' }}>Exemplo: {testResultG.sample}</div>}
          </div>
        )}
      </div>

      {/* ══ META / FACEBOOK / INSTAGRAM ══ */}
      <div style={{ ...s.card, borderColor: metaAtivo ? 'rgba(124,58,237,.3)' : 'var(--border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div style={{ ...s.secH, color: '#a78bfa' }}>📘 Facebook & Instagram (Meta Graph API)</div>
          <div style={{ ...s.badge, background: metaAtivo ? 'rgba(124,58,237,.12)' : 'rgba(100,116,139,.12)', color: metaAtivo ? '#a78bfa' : '#64748b', border: `1px solid ${metaAtivo ? 'rgba(124,58,237,.3)' : 'rgba(100,116,139,.3)'}` }}>
            {metaAtivo ? '● Ativo' : '○ Inativo'}
          </div>
        </div>

        <div style={s.info}>
          Permite buscar <strong style={{ color: 'var(--text)' }}>Páginas do Facebook e perfis comerciais do Instagram</strong> por palavra-chave e localização.
          Usa a <strong style={{ color: '#a78bfa' }}>Meta Graph API v19</strong> — gratuita respeitando os limites de requisições.
        </div>

        <div style={s.warn}>
          ⚠️ A Meta exige um App aprovado para uso em produção. Para testes, use um token de usuário gerado no Graph API Explorer. Para produção, o App precisa passar pela revisão da Meta.
        </div>

        {/* Passo a passo */}
        <div style={{ fontFamily: 'Syne, sans-serif', fontSize: 12, fontWeight: 700, color: 'var(--muted)', marginBottom: 10, textTransform: 'uppercase', letterSpacing: 1 }}>Como configurar:</div>
        {[
          ['1', 'Acesse Meta for Developers', 'Crie um App do tipo "Empresa" ou "Consumidor"', 'https://developers.facebook.com'],
          ['2', 'Adicione o produto "Facebook Login"', 'Painel do App → "+ Adicionar produto" → Facebook Login', null],
          ['3', 'Gere um Token de Acesso', 'Graph API Explorer (tools.facebook.com) → selecione seu App → gere token com permissões pages_read_engagement, pages_search', 'https://developers.facebook.com/tools/explorer'],
          ['4', 'Para token de longa duração', 'Troque o token de curta duração por um de 60 dias via: GET /oauth/access_token?grant_type=fb_exchange_token', null],
          ['5', 'Cole o token abaixo', 'O token começa com EAAG... ou EAAxxxxxxx', null],
        ].map(([n, t, d, link]) => (
          <div key={n} style={{ ...s.step, borderColor: 'rgba(124,58,237,.2)', background: 'rgba(124,58,237,.04)' }}>
            <strong style={{ color: '#a78bfa' }}>Passo {n}: {t}</strong>
            <div style={{ color: 'var(--muted)', marginTop: 2 }}>{d}</div>
            {link && <a href={link} target="_blank" rel="noreferrer" style={{ fontSize: 11, color: '#a78bfa', display: 'inline-block', marginTop: 4 }}>{link}</a>}
          </div>
        ))}

        <label style={s.label}>App ID (opcional — para fluxo OAuth próprio)</label>
        <input style={s.input} value={metaAppId} onChange={e => setMetaAppId(e.target.value)} placeholder="Ex: 1234567890123456" />

        <label style={s.label}>App Secret (opcional)</label>
        <input style={{ ...s.input, fontFamily: 'monospace', fontSize: 12 }} value={metaAppSecret} onChange={e => setMetaAppSecret(e.target.value)} placeholder="Ex: abc123def456..." type="password" />

        <label style={s.label}>Token de Acesso da Graph API *</label>
        <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
          <input style={{ ...s.input, marginBottom: 0, flex: 1, fontFamily: 'monospace', fontSize: 11 }}
            value={metaToken} onChange={e => setMetaToken(e.target.value)}
            placeholder="EAAxxxxxxxxxxxxxxxx..." type="password" />
          {metaToken && <button onClick={() => copiar(metaToken)} style={{ ...s.btnSec, padding: '9px 14px', marginBottom: 0 }}>📋</button>}
        </div>

        <label style={s.label}>Ativar busca Facebook/Instagram no Gerador de Leads</label>
        <div style={{ marginBottom: 14 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, color: 'var(--text)' }}>
            <input type="checkbox" checked={metaAtivo} onChange={e => setMetaAtivo(e.target.checked)} style={{ width: 15, height: 15, cursor: 'pointer' }} />
            Ativar Facebook / Instagram
          </label>
        </div>

        <button onClick={testarMeta} disabled={testingM} style={{ ...s.btnSec, borderColor: 'rgba(124,58,237,.3)', color: '#a78bfa', background: 'rgba(124,58,237,.08)', marginBottom: testResultM ? 10 : 0 }}>
          {testingM ? '⏳ Testando...' : '🧪 Testar token Meta'}
        </button>
        {testResultM && (
          <div style={{ padding: '10px 14px', borderRadius: 8, fontSize: 12, lineHeight: 1.6,
            background: testResultM.ok ? 'rgba(16,185,129,.08)' : 'rgba(239,68,68,.08)',
            border: `1px solid ${testResultM.ok ? 'rgba(16,185,129,.25)' : 'rgba(239,68,68,.25)'}`,
            color: testResultM.ok ? '#10b981' : '#ef4444' }}>
            {testResultM.msg}
          </div>
        )}
      </div>

      {/* Botão Salvar */}
      <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
        <button onClick={salvar} disabled={saving} style={s.btn}>
          {saving ? '⏳ Salvando...' : '💾 Salvar todas as configurações'}
        </button>
        {msg && (
          <div style={{ fontSize: 13, padding: '8px 14px', borderRadius: 8,
            background: msg.startsWith('✅') ? 'rgba(16,185,129,.1)' : msg.startsWith('⚠️') ? 'rgba(245,158,11,.1)' : 'rgba(239,68,68,.1)',
            border: `1px solid ${msg.startsWith('✅') ? 'rgba(16,185,129,.3)' : msg.startsWith('⚠️') ? 'rgba(245,158,11,.3)' : 'rgba(239,68,68,.3)'}`,
            color: msg.startsWith('✅') ? '#10b981' : msg.startsWith('⚠️') ? '#fbbf24' : '#ef4444' }}>
            {msg}
          </div>
        )}
      </div>
    </div>
  )
}

const navBtn = { background: 'var(--surface2)', border: '1px solid var(--border)', cursor: 'pointer', color: 'var(--muted)', fontSize: 11, padding: '5px 11px', borderRadius: 8, fontFamily: 'DM Mono, monospace', letterSpacing: .3 }

export async function getServerSideProps() {
  return { props: {} }
}
