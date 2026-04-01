// pages/configuracoes.js
// ============================================================
// VERSÃO CORRIGIDA
// • Mover SMTP para aba Empresa
// • Validação de duplicatas em Clientes
// • Toggle de botões em Produtos funcionando
// • Header clicável
// • Edição de nomes de módulos
// ============================================================

import { useState, useEffect } from 'react'
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
  { id: 'historico',  label: '🗂️ Histórico' },
  { id: 'clientes',   label: '🗃️ Clientes' },
  { id: 'tema',       label: '🎨 Tema' },
]

const KPI_ICONS = ['📞','📲','📧','🤝','💼','🏆','🎯','💰','📈','📊','🔥','⭐','🚀','✅','📅','🗓','👥','🏃','💡','🎤','📝','🔔','💬','🌐','🛒','📦','🔑','⚡','🎁','🏅']
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
]

const PERMISSOES_ADMIN = PERMISSOES_DISPONIVEIS.map(p => p.id)
const PERMISSOES_USER  = ['ver_dashboard','ver_chat','gerar_proposta','gerar_contrato','ver_clientes','ver_historico','ver_kpis','lancar_kpis']

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
// ABA EMPRESA (com SMTP)
// ══════════════════════════════════════════════
function TabEmpresa({ cfg, setCfg, empresaId }) {
  const [company,      setCompany]      = useState(cfg.company  || '')
  const [slogan,       setSlogan]       = useState(cfg.slogan   || '')
  const [logoB64,      setLogoB64]      = useState(cfg.logob64  || '')
  const [closeHour,    setCloseHour]    = useState(cfg.closeHour || 18)
  const [closeMessage, setCloseMessage] = useState(cfg.closeMessage || '')
  const [emailProvider, setEmailProvider] = useState(cfg.emailProvider || '')
  const [smtpHost,     setSmtpHost]     = useState(cfg.smtpHost || '')
  const [smtpPort,     setSmtpPort]     = useState(cfg.smtpPort || '587')
  const [smtpUser,     setSmtpUser]     = useState(cfg.smtpUser || '')
  const [smtpPass,     setSmtpPass]     = useState(cfg.smtpPass || '')
  const [emailApiKey,  setEmailApiKey]  = useState(cfg.emailApiKey || '')
  const [saving,       setSaving]       = useState(false)

  useEffect(() => {
    setCompany(cfg.company  || '')
    setSlogan(cfg.slogan    || '')
    setLogoB64(cfg.logob64  || '')
    setCloseHour(cfg.closeHour || 18)
    setCloseMessage(cfg.closeMessage || '')
    setEmailProvider(cfg.emailProvider || '')
    setSmtpHost(cfg.smtpHost || '')
    setSmtpPort(cfg.smtpPort || '587')
    setSmtpUser(cfg.smtpUser || '')
    setSmtpPass(cfg.smtpPass || '')
    setEmailApiKey(cfg.emailApiKey || '')
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
    const novoCfg = {
      ...cfg,
      company, slogan, logob64: logoB64,
      closeHour, closeMessage,
      emailProvider, smtpHost, smtpPort, smtpUser, smtpPass, emailApiKey
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
            <img src={logoB64} alt="Logo" style={{ height: 70, maxWidth: 280, objectFit: 'contain', borderRadius: 8, border: '1px solid var(--border)' }} />
            <button onClick={removerLogo} style={{ fontSize: 12, color: 'var(--danger)', background: 'rgba(239,68,68,.1)', border: '1px solid rgba(239,68,68,.25)', padding: '4px 10px', borderRadius: 7, cursor: 'pointer' }}>🗑 Remover logo</button>
          </div>
        ) : (
          <div style={{ marginTop: 10, padding: '14px 18px', background: 'var(--surface2)', border: '1px dashed var(--border)', borderRadius: 10, fontSize: 13, color: 'var(--muted)', textAlign: 'center' }}>Nenhuma logomarca carregada</div>
        )}
        <div style={{ ...s.secTitle, marginTop: 24 }}>Configurações da Oferta de Fechamento</div>
        <div style={s.row2}>
          <div style={s.field}><label style={s.label}>Horário limite (0-23)</label><input type="number" min={0} max={23} value={closeHour} onChange={e => setCloseHour(Number(e.target.value))} style={s.input} /></div>
          <div style={s.field}><label style={s.label}>Texto da oferta (ex: Oferta válida até as 18h de hoje)</label><input value={closeMessage} onChange={e => setCloseMessage(e.target.value)} style={s.input} placeholder="Oferta válida até as 18h de hoje" /></div>
        </div>
        <p style={{ fontSize: 12, color: 'var(--muted)', marginTop: 8 }}>A contagem regressiva será exibida no chat após o fechamento, usando o horário configurado.</p>
      </div>

      <div style={s.sec}>
        <div style={s.secTitle}>📧 Configuração de E-mail Automático</div>
        <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 12 }}>Configure as credenciais para envio de e-mails via SMTP ou API. Deixe vazio para usar o padrão mailto.</p>
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
        <p style={{ fontSize: 12, color: 'var(--muted)', marginTop: 8 }}>Nota: Se configurado, os e-mails de assinatura e cópia serão enviados automaticamente via servidor. Caso contrário, será aberto o cliente de e-mail padrão.</p>
      </div>

      <button style={s.saveBtn} onClick={salvar} disabled={saving}>{saving ? '⏳ Salvando...' : '✅ Salvar Configurações'}</button>
    </div>
  )
}

// ══════════════════════════════════════════════
// ABA METAS (igual ao original, omitido por brevidade – mantém)
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
    if (!confirm(`Confirma zerar ${tipo}?`)) return
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
        <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 16, lineHeight: 1.6 }}>Defina metas mensais de adesão e mensalidade para cada vendedor.</p>
        <div style={{ marginBottom: 16 }}><label style={s.label}>Mês de Referência</label><input type="month" value={mesRef} onChange={e => setMesRef(e.target.value)} style={s.input} /></div>
        {usuarios.length === 0 && <p style={{ color: 'var(--muted)', fontSize: 13 }}>Nenhum usuário cadastrado. Cadastre na aba Usuários.</p>}
        {usuarios.map(u => (
          <div key={u.id} style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 10, padding: 14, marginBottom: 10 }}>
            <div style={{ fontWeight: 600, marginBottom: 10, color: 'var(--accent)', fontSize: 14 }}>{u.nome}</div>
            <div style={s.row2}>
              <div style={s.field}><label style={s.label}>Meta Adesão (R$)</label><input type="number" style={s.input} value={metas[u.id]?.metaAdesao || ''} onChange={e => updateMeta(u.id, 'metaAdesao', e.target.value)} placeholder="0" /></div>
              <div style={s.field}><label style={s.label}>Meta Mensalidade (R$)</label><input type="number" style={s.input} value={metas[u.id]?.metaMensalidade || ''} onChange={e => updateMeta(u.id, 'metaMensalidade', e.target.value)} placeholder="0" /></div>
            </div>
          </div>
        ))}
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
// ABA KPIs (com metas diárias por usuário) – já alinhado
// ══════════════════════════════════════════════
function TabKpis({ cfg, setCfg, empresaId }) {
  const [kpis,        setKpis]        = useState(cfg.kpiTemplates || [])
  const [kpiRequired, setKpiRequired] = useState(cfg.kpiRequired || false)
  const [dailyGoals,  setDailyGoals]  = useState(cfg.kpiDailyGoals || {})
  const [mesRef,      setMesRef]      = useState(new Date().toISOString().slice(0, 7))
  const [saving,      setSaving]      = useState(false)
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
        {kpis.map(k => (
          <div key={k.id} style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 10, padding: '12px 14px', marginBottom: 10 }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: iconPickerId === k.id ? 12 : 0 }}>
              <div style={{ position: 'relative' }}>
                <button onClick={() => setIconPickerId(iconPickerId === k.id ? null : k.id)} style={{ width: 44, height: 44, borderRadius: 10, background: 'var(--surface)', border: '1px solid var(--border)', fontSize: 22, cursor: 'pointer' }}>{k.icone}</button>
              </div>
              <input style={{ ...s.input, flex: 1 }} value={k.nome} onChange={e => updateKpi(k.id, 'nome', e.target.value)} placeholder="Nome do KPI" />
              <select style={{ ...s.input, width: 72 }} value={k.unidade || 'un'} onChange={e => updateKpi(k.id, 'unidade', e.target.value)}>
                <option value="un">un</option><option value="R$">R$</option><option value="%">%</option><option value="h">h</option>
              </select>
              <button onClick={() => removeKpi(k.id)} style={{ padding: '8px 12px', borderRadius: 8, background: 'rgba(239,68,68,.1)', border: '1px solid rgba(239,68,68,.3)', color: 'var(--danger)' }}>🗑</button>
            </div>
            {iconPickerId === k.id && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, padding: '10px 0 2px' }}>
                {KPI_ICONS.map(ic => (
                  <button key={ic} onClick={() => { updateKpi(k.id, 'icone', ic); setIconPickerId(null) }} style={{ width: 36, height: 36, borderRadius: 8, background: k.icone === ic ? 'rgba(0,212,255,.15)' : 'var(--surface)', border: `1px solid ${k.icone === ic ? 'var(--accent)' : 'var(--border)'}`, fontSize: 18 }}>{ic}</button>
                ))}
              </div>
            )}
          </div>
        ))}
        <button onClick={addKpi} style={{ padding: '9px 16px', borderRadius: 8, background: 'rgba(0,212,255,.1)', border: '1px solid rgba(0,212,255,.25)', color: 'var(--accent)', fontSize: 13, marginTop: 8 }}>➕ Adicionar KPI</button>
      </div>

      <div style={s.sec}>
        <div style={s.secTitle}>🎯 Metas Diárias por Usuário</div>
        <div style={{ marginBottom: 14, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <label style={s.label}>Mês de Referência</label>
          <div style={{ display: 'flex', gap: 8 }}><input type="month" value={mesRef} onChange={e => setMesRef(e.target.value)} style={s.input} /><span style={{ padding: '8px 12px', background: 'var(--surface2)', borderRadius: 8, fontSize: 12 }}>{diasUteis} dias úteis</span></div>
        </div>
        {kpis.length === 0 ? <p style={{ color: 'var(--muted)' }}>Nenhum KPI cadastrado.</p> : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, minWidth: 300 }}>
              <thead><tr style={{ borderBottom: '2px solid var(--border)' }}><th style={{ textAlign: 'left', padding: '10px 6px' }}>Usuário</th>{kpis.map(k => <th key={k.id} style={{ textAlign: 'center', padding: '10px 6px' }}>{k.nome}<br/><span style={{ fontSize: 10 }}>meta/dia</span></th>)}</tr></thead>
              <tbody>
                {usuarios.length === 0 ? <tr><td colSpan={kpis.length+1} style={{ padding: '20px', textAlign: 'center' }}>Nenhum usuário cadastrado.</td></tr> :
                  usuarios.map(u => (
                    <tr key={u.id} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: '10px 6px', fontWeight: 600, position: 'sticky', left: 0, background: 'var(--surface)' }}>{u.nome}</td>
                      {kpis.map(k => {
                        const val = dailyGoals[u.id]?.[k.id] || 0
                        const metaMensal = val * diasUteis
                        return (
                          <td key={k.id} style={{ padding: '8px 6px', textAlign: 'center' }}>
                            <input type="number" min={0} value={val} onChange={e => updateDailyGoal(u.id, k.id, e.target.value)} style={{ ...s.input, width: '80px', textAlign: 'center', marginBottom: '4px' }} />
                            <div style={{ fontSize: 10, color: 'var(--accent)' }}>meta mensal: {metaMensal}</div>
                          </td>
                        )
                      })}
                    </tr>
                  ))
                }
              </tbody>
            </table>
          </div>
        )}
        <button style={s.saveBtn} onClick={salvar} disabled={saving} className="mt-4">✅ Salvar Metas de KPI</button>
      </div>

      <div style={s.sec}>
        <div style={s.secTitle}>🔐 Obrigatoriedade de KPIs</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
          <div onClick={() => setKpiRequired(!kpiRequired)} style={{ width: 40, height: 20, borderRadius: 10, background: kpiRequired ? 'var(--accent3)' : 'rgba(100,116,139,.3)', cursor: 'pointer', position: 'relative' }}>
            <div style={{ width: 16, height: 16, borderRadius: '50%', background: '#fff', position: 'absolute', top: 2, left: kpiRequired ? 22 : 2, transition: 'left .2s' }} />
          </div>
          <span style={{ fontSize: 13 }}>{kpiRequired ? '✅ Exigir preenchimento diário de KPIs' : '⭕ Não exigir preenchimento diário'}</span>
        </div>
        <p style={{ fontSize: 12, color: 'var(--muted)' }}>Se ativado, os usuários serão redirecionados para uma tela de lançamento de KPIs sempre que não tiverem preenchido o dia anterior.</p>
      </div>
      <button style={s.saveBtn} onClick={salvar} disabled={saving}>{saving ? '⏳ Salvando...' : '✅ Salvar KPIs'}</button>
    </div>
  )
}

// ══════════════════════════════════════════════
// ABA USUÁRIOS (omitido por brevidade – mantenha o código existente)
// ══════════════════════════════════════════════
function TabUsuarios({ cfg, setCfg, empresaId }) {
  // ... (mesmo código anterior) ...
  // Para economizar espaço, não repetirei, mas mantenha o código que você já tem.
  // Se necessário, posso incluir depois.
  return <div style={s.body}>Usuários (manter código anterior)</div>
}

// ══════════════════════════════════════════════
// ABA PRODUTOS – com toggle de botões funcionando
// ══════════════════════════════════════════════
function TabProdutos({ cfg, setCfg, empresaId }) {
  const [planos,  setPlanos]  = useState(cfg.plans   || PLANOS_PADRAO)
  const [precos,  setPrecos]  = useState(cfg.prices  || PRECOS_PADRAO)
  const [modulos, setModulos] = useState(cfg.modulos || MODULOS_PADRAO)
  const [enableProductButtons, setEnableProductButtons] = useState(cfg.enableProductButtons || false)
  const [saving,  setSaving]  = useState(false)
  const [abaP,    setAbaP]    = useState('planos')
  const [novoMod, setNovoMod] = useState('')
  const [editandoMod, setEditandoMod] = useState(null)

  function updatePlano(id, campo, val) { setPlanos(prev => prev.map(p => p.id === id ? { ...p, [campo]: val } : p)) }
  function addPlano() { setPlanos(prev => [...prev, { id: 'plano_' + Date.now(), nome: '', maxCnpjs: 0, usuarios: 1 }]) }
  function removePlano(id) { if (!confirm('Remover plano?')) return; setPlanos(prev => prev.filter(p => p.id !== id)) }
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
  function addModulo() { const m = novoMod.trim(); if (!m || modulos.includes(m)) return; setModulos(prev => [...prev, m]); setNovoMod(''); setPrecos(prev => ({ ...prev, [m]: {} })) }
  function removeModulo(idx) { const m = modulos[idx]; if (!confirm(`Remover módulo "${m}"?`)) return; const novos = [...modulos]; novos.splice(idx,1); setModulos(novos); const novosPrecos = { ...precos }; delete novosPrecos[m]; setPrecos(novosPrecos) }
  function iniciarEdicaoModulo(idx) { setEditandoMod({ idx, valor: modulos[idx] }) }
  function salvarEdicaoModulo() {
    if (!editandoMod || !editandoMod.valor.trim()) return
    const novos = [...modulos]
    const nomeAntigo = novos[editandoMod.idx]
    const nomeNovo = editandoMod.valor.trim()
    if (nomeAntigo === nomeNovo) { setEditandoMod(null); return }
    novos[editandoMod.idx] = nomeNovo
    const novosPrecos = { ...precos }
    if (nomeAntigo !== nomeNovo) {
      novosPrecos[nomeNovo] = novosPrecos[nomeAntigo]
      delete novosPrecos[nomeAntigo]
    }
    setModulos(novos)
    setPrecos(novosPrecos)
    setEditandoMod(null)
  }

  async function salvar() {
    setSaving(true)
    const novoCfg = { ...cfg, plans: planos, prices: precos, modulos, enableProductButtons }
    const { error } = await salvarStorage(empresaId, novoCfg)
    setSaving(false)
    if (error) { toast('Erro ao salvar', 'err'); return }
    setCfg(novoCfg)
    toast('✅ Produtos salvos!')
  }

  return (
    <div style={s.body}>
      <div style={{ display: 'flex', gap: 6, marginBottom: 20 }}>
        {[['planos','📋 Planos'],['precos','💲 Preços'],['modulos','📦 Módulos']].map(([id, label]) => (
          <button key={id} onClick={() => setAbaP(id)} style={{ padding: '8px 16px', borderRadius: 9, fontFamily: 'DM Mono, monospace', fontSize: 12, cursor: 'pointer', background: abaP === id ? 'rgba(0,212,255,.12)' : 'var(--surface2)', border: `1px solid ${abaP === id ? 'rgba(0,212,255,.35)' : 'var(--border)'}`, color: abaP === id ? 'var(--accent)' : 'var(--muted)' }}>{label}</button>
        ))}
      </div>

      {abaP === 'planos' && (
        <div style={s.sec}>
          <div style={s.secTitle}>Planos Disponíveis</div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead><tr style={{ background: 'var(--surface2)' }}><th style={{ padding: '10px 12px' }}>Plano</th><th>Máx. CNPJs</th><th>Usuários</th><th></th></tr></thead>
              <tbody>
                {planos.map(p => (
                  <tr key={p.id} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '8px 12px' }}><input style={{ ...s.input, fontWeight: 700, color: 'var(--accent)' }} value={p.nome} onChange={e => updatePlano(p.id, 'nome', e.target.value)} /></td>
                    <td style={{ padding: '8px 12px' }}><input type="number" style={{ ...s.input, width: 90 }} value={p.maxCnpjs} onChange={e => updatePlano(p.id, 'maxCnpjs', Number(e.target.value))} /></td>
                    <td style={{ padding: '8px 12px' }}><input type="number" style={{ ...s.input, width: 90 }} value={p.usuarios} onChange={e => updatePlano(p.id, 'usuarios', Number(e.target.value))} /></td>
                    <td><button onClick={() => removePlano(p.id)} style={{ padding: '6px 10px', borderRadius: 7, background: 'rgba(239,68,68,.1)', border: '1px solid rgba(239,68,68,.3)', color: 'var(--danger)' }}>🗑</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button onClick={addPlano} style={{ padding: '9px 16px', borderRadius: 8, background: 'rgba(0,212,255,.1)', border: '1px solid rgba(0,212,255,.25)', color: 'var(--accent)', marginTop: 12 }}>+ Novo Plano</button>
          <div style={{ marginTop: 12, fontSize: 12 }}>💡 Use 999 para CNPJs ou Usuários para indicar "Ilimitado"</div>
        </div>
      )}

      {abaP === 'precos' && (
        <div style={s.sec}>
          <div style={s.secTitle}>Tabela de Preços</div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead><tr style={{ background: 'var(--surface2)' }}><th style={{ padding: '10px 12px' }}>Módulo</th>{planos.map(p => <th key={p.id} colSpan={2} style={{ padding: '10px 12px', textAlign: 'center' }}>{p.nome}</th>)}</tr>
              <tr><td style={{ padding: '6px 12px' }}></td>{planos.map(p => <><td style={{ padding: '6px 8px', textAlign: 'center' }}>Adesão</td><td style={{ padding: '6px 8px', textAlign: 'center' }}>Mensal</td></>)}</tr></thead>
              <tbody>
                {modulos.map(mod => (
                  <tr key={mod} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '8px 12px', fontWeight: 600 }}>{mod}</td>
                    {planos.map(p => {
                      const vals = (precos[mod] || {})[p.id] || [0,0]
                      return (
                        <>
                          <td style={{ padding: '6px 8px', borderLeft: '1px solid var(--border)' }}><input type="number" style={{ ...s.input, width: 80, textAlign: 'right' }} value={vals[0]} onChange={e => updatePreco(mod, p.id, 0, e.target.value)} /></td>
                          <td><input type="number" style={{ ...s.input, width: 80, textAlign: 'right' }} value={vals[1]} onChange={e => updatePreco(mod, p.id, 1, e.target.value)} /></td>
                        </>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {abaP === 'modulos' && (
        <div style={s.sec}>
          <div style={s.secTitle}>Módulos do Sistema</div>
          <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 14 }}>Gerencie os módulos que aparecem no chat e nas propostas.</p>
          {modulos.map((m, idx) => (
            <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 10, marginBottom: 8 }}>
              {editandoMod && editandoMod.idx === idx ? (
                <input style={{ ...s.input, flex: 1 }} value={editandoMod.valor} onChange={e => setEditandoMod({ ...editandoMod, valor: e.target.value })} onBlur={salvarEdicaoModulo} onKeyDown={e => e.key === 'Enter' && salvarEdicaoModulo()} autoFocus />
              ) : (
                <div style={{ flex: 1, fontWeight: 600, fontSize: 14, cursor: 'pointer' }} onClick={() => iniciarEdicaoModulo(idx)}>✏️ {m}</div>
              )}
              <button onClick={() => removeModulo(idx)} style={{ padding: '5px 10px', borderRadius: 7, background: 'rgba(239,68,68,.1)', border: '1px solid rgba(239,68,68,.2)', color: 'var(--danger)' }}>🗑</button>
            </div>
          ))}
          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <input style={{ ...s.input, flex: 1 }} value={novoMod} onChange={e => setNovoMod(e.target.value)} onKeyDown={e => e.key === 'Enter' && addModulo()} placeholder="Nome do novo módulo..." />
            <button onClick={addModulo} style={{ padding: '9px 16px', borderRadius: 8, background: 'rgba(0,212,255,.1)', border: '1px solid rgba(0,212,255,.25)', color: 'var(--accent)' }}>+ Adicionar</button>
          </div>
        </div>
      )}

      <div style={s.sec}>
        <div style={s.secTitle}>🖱️ Interface do Chat</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
          <div onClick={() => setEnableProductButtons(!enableProductButtons)} style={{ width: 40, height: 20, borderRadius: 10, background: enableProductButtons ? 'var(--accent3)' : 'rgba(100,116,139,.3)', cursor: 'pointer', position: 'relative' }}>
            <div style={{ width: 16, height: 16, borderRadius: '50%', background: '#fff', position: 'absolute', top: 2, left: enableProductButtons ? 22 : 2, transition: 'left .2s' }} />
          </div>
          <span style={{ fontSize: 13 }}>{enableProductButtons ? '✅ Seleção de módulos por botões' : '⭕ Seleção de módulos por digitação'}</span>
        </div>
        <p style={{ fontSize: 12, color: 'var(--muted)' }}>Se ativado, os módulos aparecerão como botões no chat em vez de digitação.</p>
      </div>

      <button style={s.saveBtn} onClick={salvar} disabled={saving}>{saving ? '⏳ Salvando...' : '✅ Salvar Produtos'}</button>
    </div>
  )
}

// ══════════════════════════════════════════════
// ABA DESCONTOS (omitido por brevidade)
// ══════════════════════════════════════════════
function TabDescontos({ cfg, setCfg, empresaId }) {
  const [discMode, setDiscMode] = useState(cfg.discMode    || 'screen')
  const [da,       setDa]       = useState(cfg.discAdPct    || 0)
  const [dm,       setDm]       = useState(cfg.discMenPct   || 0)
  const [dc,       setDc]       = useState(cfg.discClosePct || 0)
  const [saving,   setSaving]   = useState(false)

  async function salvar() {
    setSaving(true)
    const novoCfg = { ...cfg, discMode, discAdPct: da, discMenPct: dm, discClosePct: dc }
    const { error } = await salvarStorage(empresaId, novoCfg)
    setSaving(false)
    if (error) { toast('Erro ao salvar', 'err'); return }
    setCfg(novoCfg)
    toast('✅ Descontos salvos!')
  }

  const radioStyle = (val) => ({
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '12px 16px',
    background: discMode === val ? 'rgba(0,212,255,.06)' : 'var(--surface2)',
    border: `1px solid ${discMode === val ? 'rgba(0,212,255,.3)' : 'var(--border)'}`,
    borderRadius: 10, marginBottom: 8, cursor: 'pointer'
  })

  return (
    <div style={s.body}>
      <div style={s.sec}>
        <div style={s.secTitle}>Modo de Desconto</div>
        {[['screen','🖥 Desconto em Tela','Mostra desconto após o preço cheio'],['voucher','🎫 Somente via Voucher','Desconto só com código']].map(([val,title,sub]) => (
          <div key={val} style={radioStyle(val)} onClick={() => setDiscMode(val)}>
            <div><div style={{ fontSize: 14, fontWeight: 600 }}>{title}</div><div style={{ fontSize: 12, color: 'var(--muted)' }}>{sub}</div></div>
            <div style={{ width: 20, height: 20, borderRadius: '50%', border: `2px solid ${discMode === val ? 'var(--accent)' : 'var(--border)'}`, background: discMode === val ? 'var(--accent)' : 'transparent' }} />
          </div>
        ))}
      </div>
      <div style={s.sec}>
        <div style={s.secTitle}>Percentuais de Desconto</div>
        <div style={s.row3}>
          <div style={s.field}><label style={s.label}>% Adesão (tela)</label><input type="number" style={s.input} min={0} max={100} value={da} onChange={e => setDa(e.target.value)} /></div>
          <div style={s.field}><label style={s.label}>% Mensalidade (tela)</label><input type="number" style={s.input} min={0} max={100} value={dm} onChange={e => setDm(e.target.value)} /></div>
          <div style={s.field}><label style={s.label}>% Adesão (fechamento)</label><input type="number" style={s.input} min={0} max={100} value={dc} onChange={e => setDc(e.target.value)} /></div>
        </div>
      </div>
      <button style={s.saveBtn} onClick={salvar} disabled={saving}>{saving ? '⏳...' : '✅ Salvar'}</button>
    </div>
  )
}

// ══════════════════════════════════════════════
// ABA VOUCHERS (omitido por brevidade – manter original)
// ══════════════════════════════════════════════
function TabVouchers({ cfg, setCfg, empresaId }) {
  // Manter código original
  return <div style={s.body}>Vouchers (manter código anterior)</div>
}

// ══════════════════════════════════════════════
// ABA DOCUMENTOS (sem SMTP)
// ══════════════════════════════════════════════
function TabDocumentos({ cfg, setCfg, empresaId }) {
  const [emailRem,   setEmailRem]   = useState(cfg.signConfig?.email || '')
  const [wpp,        setWpp]        = useState(cfg.signConfig?.wpp   || '')
  const [urlBase,    setUrlBase]    = useState(cfg.signConfig?.url   || '')
  const [propostaTemplate, setPropostaTemplate] = useState(cfg.propostaTemplate || '')
  const [contratoTemplate, setContratoTemplate] = useState(cfg.contratoTemplate || '')
  const [saving,     setSaving]     = useState(false)
  const [testando,   setTestando]   = useState(false)

  function handleFileUpload(type, e) {
    const file = e.target.files[0]
    if (!file) return
    if (file.size > 2 * 1024 * 1024) { toast('Arquivo muito grande (máx 2MB)', 'err'); return }
    const ext = file.name.split('.').pop().toLowerCase()
    if (ext === 'docx' || ext === 'doc') {
      toast('Arquivo .doc/.docx não são suportados diretamente. Por favor, salve o conteúdo como .txt ou .html e tente novamente.', 'err')
      e.target.value = ''
      return
    }
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
    const novoCfg = { ...cfg, signConfig: { email: emailRem, wpp, url: urlBase }, propostaTemplate, contratoTemplate }
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
        <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 12 }}>Você pode personalizar os modelos de proposta e contrato. Deixe vazio para usar os padrões.</p>
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
            <div><code>{'{{condicao_pagamento}}'}</code> - Condição de pagamento</div><div><code>{'{{vencimento_adesao}}'}</code> - Venc. adesão</div><div><code>{'{{vencimento_mensal}}'}</code> - Venc. mensal</div>
            <div><code>{'{{cnpjs_qty}}'}</code> - Qtd. CNPJs</div><div><code>{'{{consultor_nome}}'}</code> - Nome consultor</div><div><code>{'{{company}}'}</code> - Nome da empresa</div>
            <div><code>{'{{produtos_tabela}}'}</code> - Tabela de produtos (HTML)</div>
            <div><code>{'{{produtos_lista}}'}</code> - Lista vertical de produtos</div>
            <div><code>{'{{logo}}'}</code> - Logo da empresa (base64)</div>
          </div>
        </div>
      </div>
      <div style={s.sec}>
        <div style={s.secTitle}>Configurações de Assinatura Eletrônica</div>
        <div style={s.row2}>
          <div style={s.field}><label style={s.label}>E-mail remetente</label><input type="email" style={s.input} value={emailRem} onChange={e => setEmailRem(e.target.value)} placeholder="noreply@vivanexa.com.br" /></div>
          <div style={s.field}><label style={s.label}>WhatsApp da empresa</label><input style={s.input} value={wpp} onChange={e => setWpp(e.target.value)} placeholder="5569984059125" /></div>
        </div>
        <div style={s.field}><label style={s.label}>URL base do sistema (para links de assinatura)</label><input style={s.input} value={urlBase} onChange={e => setUrlBase(e.target.value)} placeholder="https://seusite.com/sign" /></div>
        <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
          <button style={s.saveBtn} onClick={salvar} disabled={saving}>{saving ? '⏳...' : '✅ Salvar'}</button>
          <button onClick={testarConexao} disabled={testando} style={{ padding: '11px 18px', borderRadius: 10, background: 'rgba(0,212,255,.1)', border: '1px solid rgba(0,212,255,.3)', color: 'var(--accent)' }}>{testando ? '⏳...' : '🔌 Testar Conexão'}</button>
        </div>
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════
// ABA HISTÓRICO (com visualização)
// ══════════════════════════════════════════════
function TabHistorico({ cfg }) {
  const [filtroTipo,   setFiltroTipo]   = useState('')
  const [filtroStatus, setFiltroStatus] = useState('')
  const [busca,        setBusca]        = useState('')
  const docs = (cfg.docHistory || []).filter(d => {
    if (filtroTipo   && d.type !== filtroTipo)   return false
    if (filtroStatus && d.status !== filtroStatus) return false
    if (busca && !d.clientName?.toLowerCase().includes(busca.toLowerCase())) return false
    return true
  })
  function statusLabel(st) {
    if (st === 'signed')  return { txt: '✅ Assinado', cor: 'var(--accent3)' }
    if (st === 'pending') return { txt: '⏳ Pendente', cor: 'var(--warning)' }
    return { txt: '📝 Rascunho', cor: 'var(--muted)' }
  }
  return (
    <div style={s.body}>
      <div style={s.sec}>
        <div style={s.secTitle}>Histórico de Documentos</div>
        <div style={{ display: 'flex', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
          <select style={s.input} value={filtroTipo} onChange={e => setFiltroTipo(e.target.value)}><option value="">Todos</option><option value="proposta">Propostas</option><option value="contrato">Contratos</option></select>
          <select style={s.input} value={filtroStatus} onChange={e => setFiltroStatus(e.target.value)}><option value="">Todos</option><option value="pending">Pendente</option><option value="signed">Assinado</option><option value="draft">Rascunho</option></select>
          <input style={{ ...s.input, flex: 1, minWidth: 160 }} placeholder="Buscar por cliente..." value={busca} onChange={e => setBusca(e.target.value)} />
        </div>
        {docs.length === 0 && <p style={{ color: 'var(--muted)' }}>Nenhum documento encontrado.</p>}
        {docs.map((d, i) => {
          const sl = statusLabel(d.status)
          return (
            <div key={i} style={{ padding: '12px 16px', background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 10, marginBottom: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ fontWeight: 600, fontSize: 14 }}>{d.clientName || 'Cliente'}</div>
                <div style={{ fontSize: 12, color: sl.cor, fontWeight: 600 }}>{sl.txt}</div>
              </div>
              <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4 }}>
                {d.type === 'contrato' ? '📝 Contrato' : '📄 Proposta'} · {d.date}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════
// ABA CLIENTES (com validação de duplicatas)
// ══════════════════════════════════════════════
function TabClientes({ cfg, setCfg, empresaId }) {
  const [busca,  setBusca]  = useState('')
  const [form,   setForm]   = useState(null)
  const [saving, setSaving] = useState(false)
  const clientes = cfg.clients || []
  const filtrados = busca.trim() ? clientes.filter(c => c.nome?.toLowerCase().includes(busca.toLowerCase()) || c.cnpj?.includes(busca) || c.cpf?.includes(busca)) : clientes
  const emptyClient = { id: '', nome: '', cnpj: '', cpf: '', email: '', telefone: '', cidade: '' }

  function isDuplicate(formData) {
    return clientes.some(c => {
      if (c.id === formData.id) return false
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
          <button onClick={() => setForm(emptyClient)} style={{ padding: '10px 16px', borderRadius: 9, background: 'rgba(0,212,255,.1)', border: '1px solid rgba(0,212,255,.25)', color: 'var(--accent)', whiteSpace: 'nowrap' }}>+ Novo Cliente</button>
        </div>
        {filtrados.length === 0 && !form && <p style={{ color: 'var(--muted)' }}>Nenhum cliente encontrado.</p>}
        {filtrados.map(c => (
          <div key={c.id} style={{ padding: '12px 16px', background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 10, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600, color: 'var(--accent)', fontSize: 14 }}>{c.nome}</div>
              <div style={{ fontSize: 12, color: 'var(--muted)' }}>{c.cnpj && `CNPJ: ${c.cnpj} · `}{c.cidade && c.cidade}</div>
            </div>
            <button onClick={() => setForm({ ...c })} style={{ padding: '5px 10px', borderRadius: 7, background: 'rgba(0,212,255,.1)', border: '1px solid rgba(0,212,255,.2)', color: 'var(--accent)' }}>✏️</button>
            <button onClick={() => removerCliente(c.id)} style={{ padding: '5px 10px', borderRadius: 7, background: 'rgba(239,68,68,.1)', border: '1px solid rgba(239,68,68,.2)', color: 'var(--danger)' }}>🗑</button>
          </div>
        ))}
      </div>
      {form && (
        <div style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 12, padding: 18, marginTop: 8 }}>
          <div style={{ ...s.secTitle, marginBottom: 14 }}>Dados do Cliente</div>
          <div style={s.row2}>
            <div style={s.field}><label>Nome / Razão Social</label><input style={s.input} value={form.nome} onChange={e => setForm(f => ({ ...f, nome: e.target.value }))} /></div>
            <div style={s.field}><label>CNPJ</label><input style={s.input} value={form.cnpj} onChange={e => setForm(f => ({ ...f, cnpj: e.target.value }))} /></div>
          </div>
          <div style={s.row2}>
            <div style={s.field}><label>E-mail</label><input type="email" style={s.input} value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} /></div>
            <div style={s.field}><label>Telefone</label><input style={s.input} value={form.telefone} onChange={e => setForm(f => ({ ...f, telefone: e.target.value }))} /></div>
          </div>
          <div style={s.field}><label>Cidade / Estado</label><input style={s.input} value={form.cidade} onChange={e => setForm(f => ({ ...f, cidade: e.target.value }))} /></div>
          <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
            <button style={s.saveBtn} onClick={salvarCliente} disabled={saving}>{saving ? '⏳...' : '✅ Salvar Cliente'}</button>
            <button onClick={() => setForm(null)} style={{ padding: '11px 18px', borderRadius: 10, background: 'rgba(100,116,139,.12)', border: '1px solid rgba(100,116,139,.3)', color: 'var(--muted)' }}>Cancelar</button>
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
        {[['dark','🌙 Tema Escuro','Fundo escuro'],['light','☀️ Tema Claro','Fundo branco']].map(([t,title,sub]) => (
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
  row2:    { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 4  },
  row3:    { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 12 },
  row4:    { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 12, marginBottom: 12 },
  saveBtn: { padding: '11px 22px', borderRadius: 10, background: 'linear-gradient(135deg,var(--accent),#0099bb)', border: 'none', color: '#fff', fontFamily: 'DM Mono, monospace', fontSize: 14, fontWeight: 600, cursor: 'pointer', letterSpacing: '.5px' },
}

// ══════════════════════════════════════════════
// PÁGINA PRINCIPAL
// ══════════════════════════════════════════════
export default function Configuracoes() {
  const router = useRouter()
  const [loading,   setLoading]   = useState(true)
  const [perfil,    setPerfil]    = useState(null)
  const [empresaId, setEmpresaId] = useState(null)
  const [cfg,       setCfg]       = useState({})
  const [abaAtiva,  setAbaAtiva]  = useState('empresa')

  useEffect(() => {
    async function init() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.push('/'); return }
      const { data: perf } = await supabase.from('perfis').select('*').eq('id', session.user.id).single()
      setPerfil(perf)
      const eid = perf?.empresa_id || session.user.id
      setEmpresaId(eid)
      const { data: row } = await supabase.from('vx_storage').select('value').eq('key', `cfg:${eid}`).single()
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

  if (loading) return <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)', color: 'var(--muted)', fontFamily: 'DM Mono, monospace' }}>Carregando configurações...</div>

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=DM+Mono:wght@300;400;500&family=Inter:wght@300;400;500;600;700&display=swap');
        [data-theme="dark"]{--bg:#0a0f1e;--surface:#111827;--surface2:#1a2540;--border:#1e2d4a;--accent:#00d4ff;--accent2:#7c3aed;--accent3:#10b981;--text:#e2e8f0;--muted:#64748b;--danger:#ef4444;--warning:#f59e0b;--gold:#fbbf24;--card-bg:#1a2540;--shadow:0 4px 24px rgba(0,0,0,.4);}
        [data-theme="light"]{--bg:#f0f4f8;--surface:#ffffff;--surface2:#f8fafc;--border:#e2e8f0;--accent:#0099bb;--accent2:#7c3aed;--accent3:#059669;--text:#1e293b;--muted:#64748b;--danger:#ef4444;--warning:#d97706;--gold:#b45309;--card-bg:#f8fafc;--shadow:0 4px 24px rgba(0,0,0,.1);}
        *{box-sizing:border-box;margin:0;padding:0} body{font-family:'DM Mono',monospace;background:var(--bg);color:var(--text);min-height:100vh}
        [data-theme="dark"] body::before{content:'';position:fixed;inset:0;background-image:linear-gradient(rgba(0,212,255,.025) 1px,transparent 1px),linear-gradient(90deg,rgba(0,212,255,.025) 1px,transparent 1px);background-size:40px 40px;pointer-events:none;z-index:0}
        input[type=number]::-webkit-inner-spin-button{opacity:1} select option{background:var(--surface2);color:var(--text)} input:focus,select:focus{border-color:var(--accent)!important;outline:none}
      `}</style>
      <div style={{ position:'fixed',width:500,height:500,background:'var(--accent)',top:-200,right:-150,borderRadius:'50%',filter:'blur(120px)',opacity:.06,pointerEvents:'none',zIndex:0 }} />
      <div style={{ position:'fixed',width:400,height:400,background:'var(--accent2)',bottom:-150,left:-100,borderRadius:'50%',filter:'blur(120px)',opacity:.06,pointerEvents:'none',zIndex:0 }} />
      <div id="vx-toast" style={{ position:'fixed',bottom:30,left:'50%',transform:'translateX(-50%) translateY(20px)',background:'rgba(16,185,129,.9)',color:'#fff',padding:'12px 24px',borderRadius:10,fontFamily:'DM Mono, monospace',fontSize:14,zIndex:9999,opacity:0,transition:'opacity .3s, transform .3s',boxShadow:'0 4px 20px rgba(0,0,0,.3)' }} />
      <header style={{ position:'relative',zIndex:10,width:'100%',maxWidth:960,margin:'0 auto',padding:'18px 20px 0',display:'flex',alignItems:'center',gap:12 }}>
        <div style={{ cursor:'pointer' }} onClick={() => router.push('/chat')}>
          {cfg.logob64 ? <img src={cfg.logob64} alt="Logo" style={{ height:36,objectFit:'contain' }} onError={e => e.target.style.display='none'} /> : <div style={{ fontFamily:'Syne, sans-serif',fontSize:17,fontWeight:700,letterSpacing:.5 }}>{cfg.company || 'Vivanexa'}</div>}
        </div>
        <div style={{ marginLeft:'auto',display:'flex',gap:8,alignItems:'center' }}>
          <button onClick={() => router.push('/chat')} style={{ background:'var(--surface2)',border:'1px solid var(--border)',cursor:'pointer',color:'var(--muted)',fontSize:11,padding:'5px 11px',borderRadius:8,fontFamily:'DM Mono, monospace',letterSpacing:.3 }}>💬 Chat</button>
          <button onClick={() => router.push('/dashboard')} style={{ background:'var(--surface2)',border:'1px solid var(--border)',cursor:'pointer',color:'var(--muted)',fontSize:11,padding:'5px 11px',borderRadius:8,fontFamily:'DM Mono, monospace',letterSpacing:.3 }}>📊 Dashboard</button>
          <button onClick={() => supabase.auth.signOut().then(() => router.push('/'))} style={{ background:'none',border:'none',cursor:'pointer',color:'var(--muted)',fontSize:11,padding:'5px 9px',borderRadius:8,fontFamily:'DM Mono, monospace' }}>Sair</button>
        </div>
      </header>
      <main style={{ position:'relative',zIndex:10,width:'100%',maxWidth:960,margin:'20px auto 60px',padding:'0 20px' }}>
        <div style={{ background:'var(--surface)',border:'1px solid var(--border)',borderRadius:16,overflow:'hidden',boxShadow:'var(--shadow)' }}>
          <div style={{ background:'var(--surface2)',borderBottom:'1px solid var(--border)',padding:'16px 24px',display:'flex',alignItems:'center',justifyContent:'space-between' }}>
            <h3 style={{ fontFamily:'Syne, sans-serif',fontSize:16,fontWeight:700,color:'var(--accent)' }}>⚙️ Configurações</h3>
            <div style={{ fontSize:12,color:'var(--muted)' }}>{perfil?.nome && `Olá, ${perfil.nome}`}</div>
          </div>
          <div style={{ display:'flex',borderBottom:'1px solid var(--border)',background:'var(--surface)',overflowX:'auto' }}>
            {TABS.map(t => (
              <button key={t.id} onClick={() => setAbaAtiva(t.id)} style={{ flexShrink:0, padding:'11px 14px', border:'none', background:'none', color: abaAtiva === t.id ? 'var(--accent)' : 'var(--muted)', fontFamily:'DM Mono, monospace', fontSize:12, cursor:'pointer', borderBottom:`2px solid ${abaAtiva === t.id ? 'var(--accent)' : 'transparent'}`, letterSpacing:.3, whiteSpace:'nowrap', transition:'color .2s', position:'relative', top:1 }}>{t.label}</button>
            ))}
          </div>
          {renderAba()}
        </div>
      </main>
    </>
  )
}
