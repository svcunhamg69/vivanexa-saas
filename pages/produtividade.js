// pages/produtividade.js — Produtividade Vivanexa
import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import { supabase } from '../lib/supabase'

const ABAS = [
  { id: 'tarefas',     label: '✅ Tarefas e Obrigações' },
  { id: 'tributaria',  label: '🔍 Consulta Tributária' },
  { id: 'mei',         label: '🏪 Gestão MEI' },
  { id: 'simples',     label: '📊 Simples Nacional' },
]

const PRIORIDADES = ['Alta', 'Média', 'Baixa']
const STATUS_TAREFA = ['Pendente', 'Em Andamento', 'Concluída', 'Cancelada']
const EMPTY_TAREFA = { id: '', titulo: '', descricao: '', prioridade: 'Média', status: 'Pendente', responsavel: '', vencimento: '', tipo: 'tarefa', criadoEm: '' }

function fmt(n) { return 'R$ ' + Number(n || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 }) }

export default function Produtividade() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [cfg, setCfg] = useState({})
  const [empresaId, setEmpresaId] = useState(null)
  const [perfil, setPerfil] = useState(null)
  const [aba, setAba] = useState('tarefas')

  // Tarefas
  const [tarefas, setTarefas] = useState([])
  const [showFormTarefa, setShowFormTarefa] = useState(false)
  const [formTarefa, setFormTarefa] = useState({ ...EMPTY_TAREFA })
  const [filtroPrioridade, setFiltroPrioridade] = useState('Todos')
  const [filtroStatus, setFiltroStatus] = useState('Todos')
  const [saving, setSaving] = useState(false)

  // Consulta Tributária
  const [cnpjConsulta, setCnpjConsulta] = useState('')
  const [resultadoConsulta, setResultadoConsulta] = useState(null)
  const [buscandoConsulta, setBuscandoConsulta] = useState(false)
  const [erroConsulta, setErroConsulta] = useState('')

  // MEI
  const [meis, setMeis] = useState([])
  const [showFormMei, setShowFormMei] = useState(false)
  const [formMei, setFormMei] = useState({ id: '', nome: '', cnpj: '', email: '', telefone: '', vencimentoDas: '', anuidade: '', observacoes: '' })

  // Simples Nacional
  const [faturamento, setFaturamento] = useState('')
  const [atividade, setAtividade] = useState('comercio')
  const [resultadoSimples, setResultadoSimples] = useState(null)

  const [msgSucesso, setMsgSucesso] = useState('')

  useEffect(() => {
    async function init() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.replace('/'); return }
      let { data: perf } = await supabase.from('perfis').select('*').eq('user_id', session.user.id).maybeSingle()
      if (!perf) {
        const nome = session.user.email?.split('@')[0] || 'Usuário'
        const { data: np } = await supabase.from('perfis').insert({ user_id: session.user.id, nome, email: session.user.email, empresa_id: session.user.id, perfil: 'admin' }).select().single()
        perf = np
      }
      setPerfil(perf)
      const eid = perf?.empresa_id || session.user.id
      setEmpresaId(eid)
      const { data: row } = await supabase.from('vx_storage').select('value').eq('key', `cfg:${eid}`).single()
      if (row?.value) {
        const c = JSON.parse(row.value)
        setCfg(c)
        setTarefas(c.tarefas || [])
        setMeis(c.meis || [])
      }
      setLoading(false)
    }
    init()
  }, [router])

  async function salvarStorage(novoCfg) {
    await supabase.from('vx_storage').upsert({ key: `cfg:${empresaId}`, value: JSON.stringify(novoCfg), updated_at: new Date().toISOString() }, { onConflict: 'key' })
  }

  function toast(msg) { setMsgSucesso(msg); setTimeout(() => setMsgSucesso(''), 3000) }

  // ─── TAREFAS ───────────────────────────────────
  async function salvarTarefa() {
    if (!formTarefa.titulo.trim()) { alert('Informe o título da tarefa.'); return }
    setSaving(true)
    const nova = { ...formTarefa, id: formTarefa.id || 'trf_' + Date.now(), criadoEm: formTarefa.criadoEm || new Date().toISOString() }
    const lista = formTarefa.id ? tarefas.map(t => t.id === formTarefa.id ? nova : t) : [...tarefas, nova]
    const novoCfg = { ...cfg, tarefas: lista }
    await salvarStorage(novoCfg)
    setTarefas(lista); setCfg(novoCfg); setShowFormTarefa(false); setFormTarefa({ ...EMPTY_TAREFA }); setSaving(false)
    toast('✅ Tarefa salva!')
  }

  async function excluirTarefa(id) {
    if (!confirm('Excluir tarefa?')) return
    const lista = tarefas.filter(t => t.id !== id)
    const novoCfg = { ...cfg, tarefas: lista }
    await salvarStorage(novoCfg)
    setTarefas(lista); setCfg(novoCfg); toast('🗑 Tarefa removida!')
  }

  async function toggleStatus(tarefa) {
    const proxStatus = { 'Pendente': 'Em Andamento', 'Em Andamento': 'Concluída', 'Concluída': 'Pendente', 'Cancelada': 'Pendente' }
    const atualizada = { ...tarefa, status: proxStatus[tarefa.status] || 'Pendente' }
    const lista = tarefas.map(t => t.id === tarefa.id ? atualizada : t)
    const novoCfg = { ...cfg, tarefas: lista }
    await salvarStorage(novoCfg)
    setTarefas(lista); setCfg(novoCfg)
  }

  const tarefasFiltradas = tarefas.filter(t => {
    if (filtroPrioridade !== 'Todos' && t.prioridade !== filtroPrioridade) return false
    if (filtroStatus !== 'Todos' && t.status !== filtroStatus) return false
    return true
  })

  // ─── CONSULTA TRIBUTÁRIA ────────────────────────
  async function consultarCNPJ() {
    const cnpj = cnpjConsulta.replace(/\D/g, '')
    if (cnpj.length !== 14) { setErroConsulta('CNPJ inválido.'); return }
    setBuscandoConsulta(true); setErroConsulta(''); setResultadoConsulta(null)
    try {
      const r = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cnpj}`)
      if (!r.ok) throw new Error('CNPJ não encontrado')
      const d = await r.json()
      setResultadoConsulta(d)
    } catch (e) { setErroConsulta(e.message) }
    setBuscandoConsulta(false)
  }

  // ─── MEI ────────────────────────────────────────
  async function salvarMei() {
    if (!formMei.nome.trim()) { alert('Informe o nome.'); return }
    setSaving(true)
    const novo = { ...formMei, id: formMei.id || 'mei_' + Date.now() }
    const lista = formMei.id ? meis.map(m => m.id === formMei.id ? novo : m) : [...meis, novo]
    const novoCfg = { ...cfg, meis: lista }
    await salvarStorage(novoCfg)
    setMeis(lista); setCfg(novoCfg); setShowFormMei(false); setFormMei({ id: '', nome: '', cnpj: '', email: '', telefone: '', vencimentoDas: '', anuidade: '', observacoes: '' }); setSaving(false)
    toast('✅ MEI salvo!')
  }

  // ─── SIMPLES NACIONAL ────────────────────────────
  const TABELAS_SIMPLES = {
    comercio: [
      { ate: 180000, aliquota: 4.00, deducao: 0 },
      { ate: 360000, aliquota: 7.30, deducao: 5940 },
      { ate: 720000, aliquota: 9.50, deducao: 13860 },
      { ate: 1800000, aliquota: 10.70, deducao: 22500 },
      { ate: 3600000, aliquota: 14.30, deducao: 87300 },
      { ate: 4800000, aliquota: 19.00, deducao: 378000 },
    ],
    servicos: [
      { ate: 180000, aliquota: 6.00, deducao: 0 },
      { ate: 360000, aliquota: 11.20, deducao: 9360 },
      { ate: 720000, aliquota: 13.20, deducao: 17640 },
      { ate: 1800000, aliquota: 16.00, deducao: 35640 },
      { ate: 3600000, aliquota: 21.00, deducao: 125640 },
      { ate: 4800000, aliquota: 33.00, deducao: 648000 },
    ],
  }

  function calcularSimples() {
    const fat = Number(faturamento.replace(/\D/g, '')) / 100
    if (!fat || fat <= 0) { alert('Informe o faturamento.'); return }
    const tabela = TABELAS_SIMPLES[atividade] || TABELAS_SIMPLES.comercio
    const faixa = tabela.find(f => fat <= f.ate) || tabela[tabela.length - 1]
    const impostoEfetivo = (fat * (faixa.aliquota / 100) - faixa.deducao) / fat * 100
    const valorImposto = fat * (impostoEfetivo / 100)
    setResultadoSimples({ faturamento: fat, aliquotaNominal: faixa.aliquota, aliquotaEfetiva: impostoEfetivo.toFixed(2), valorImposto, faixa: tabela.indexOf(faixa) + 1 })
  }

  const logoSrc = cfg.logob64 ? (cfg.logob64.startsWith('data:') ? cfg.logob64 : `data:image/png;base64,${cfg.logob64}`) : null
  const corStatus = { 'Pendente': '#f59e0b', 'Em Andamento': '#00d4ff', 'Concluída': '#10b981', 'Cancelada': '#64748b' }
  const corPrioridade = { 'Alta': '#ef4444', 'Média': '#f59e0b', 'Baixa': '#10b981' }

  if (loading) return <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0a0f1e', color: '#64748b', fontFamily: 'DM Mono, monospace' }}>Carregando...</div>

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=DM+Mono:wght@400;500&display=swap');
        :root{--bg:#0a0f1e;--surface:#111827;--surface2:#1a2540;--border:#1e2d4a;--accent:#00d4ff;--accent2:#7c3aed;--accent3:#10b981;--text:#e2e8f0;--muted:#64748b;--danger:#ef4444;--warning:#f59e0b}
        *{box-sizing:border-box;margin:0;padding:0}
        body{font-family:'DM Mono',monospace;background:var(--bg);color:var(--text);min-height:100vh}
        ::-webkit-scrollbar{width:4px}::-webkit-scrollbar-thumb{background:var(--border);border-radius:4px}
        input:focus,textarea:focus,select:focus{border-color:var(--accent)!important;outline:none}
      `}</style>

      {msgSucesso && <div style={{ position: 'fixed', bottom: 30, left: '50%', transform: 'translateX(-50%)', background: 'rgba(16,185,129,.9)', color: '#fff', padding: '12px 24px', borderRadius: 10, fontFamily: 'DM Mono', fontSize: 14, zIndex: 9999 }}>{msgSucesso}</div>}

      {/* Header */}
      <header style={{ position: 'sticky', top: 0, zIndex: 100, background: 'rgba(10,15,30,.95)', backdropFilter: 'blur(12px)', borderBottom: '1px solid var(--border)', padding: '10px 20px', display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }} onClick={() => router.push('/chat')}>
          {logoSrc ? <img src={logoSrc} alt="" style={{ height: 32, objectFit: 'contain', borderRadius: 6 }} onError={e => e.target.style.display = 'none'} />
            : <span style={{ fontFamily: 'Syne,sans-serif', fontSize: 15, fontWeight: 700 }}>{cfg.company || 'Vivanexa'}</span>}
        </div>
        <span style={{ fontSize: 13, color: 'var(--accent)', fontFamily: 'Syne,sans-serif', fontWeight: 700 }}>⚡ Produtividade</span>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 6, alignItems: 'center' }}>
          <button onClick={() => router.push('/chat')} style={navBtn}>💬 Chat</button>
          <button onClick={() => router.push('/crm')} style={navBtn}>🎯 CRM</button>
          <button onClick={() => router.push('/reports')} style={navBtn}>📈 Relatórios</button>
          {perfil?.nome && <span style={{ fontSize: 11, color: 'var(--muted)' }}>👤 <span style={{ color: 'var(--text)' }}>{perfil.nome}</span></span>}
          <button onClick={() => supabase.auth.signOut().then(() => router.push('/'))} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', fontSize: 11, fontFamily: 'DM Mono,monospace' }}>Sair</button>
        </div>
      </header>

      <main style={{ maxWidth: 1000, margin: '0 auto', padding: '20px 20px 60px' }}>
        {/* Abas */}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 24 }}>
          {ABAS.map(a => (
            <button key={a.id} onClick={() => setAba(a.id)}
              style={{ padding: '8px 14px', borderRadius: 9, border: `1.5px solid ${aba === a.id ? 'var(--accent)' : 'var(--border)'}`, background: aba === a.id ? 'rgba(0,212,255,.12)' : 'var(--surface2)', color: aba === a.id ? 'var(--accent)' : 'var(--muted)', fontFamily: 'DM Mono,monospace', fontSize: 12, cursor: 'pointer', fontWeight: aba === a.id ? 700 : 400 }}>
              {a.label}
            </button>
          ))}
        </div>

        {/* ══ TAREFAS ══ */}
        {aba === 'tarefas' && (
          <div>
            <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
              <h3 style={{ fontFamily: 'Syne,sans-serif', fontSize: 16, fontWeight: 700 }}>Tarefas e Obrigações</h3>
              <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {['Todos', ...PRIORIDADES].map(p => (
                  <button key={p} onClick={() => setFiltroPrioridade(p)}
                    style={{ padding: '5px 10px', borderRadius: 7, border: `1px solid ${filtroPrioridade === p ? 'var(--accent)' : 'var(--border)'}`, background: filtroPrioridade === p ? 'rgba(0,212,255,.1)' : 'var(--surface2)', color: filtroPrioridade === p ? 'var(--accent)' : 'var(--muted)', fontSize: 11, cursor: 'pointer', fontFamily: 'DM Mono,monospace' }}>
                    {p}
                  </button>
                ))}
                <select value={filtroStatus} onChange={e => setFiltroStatus(e.target.value)}
                  style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 7, padding: '5px 10px', color: 'var(--muted)', fontFamily: 'DM Mono,monospace', fontSize: 11, cursor: 'pointer' }}>
                  <option value="Todos">Todos status</option>
                  {STATUS_TAREFA.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
                <button onClick={() => { setFormTarefa({ ...EMPTY_TAREFA }); setShowFormTarefa(true) }}
                  style={{ padding: '7px 14px', borderRadius: 8, background: 'linear-gradient(135deg,var(--accent),#0099bb)', border: 'none', color: '#fff', fontFamily: 'DM Mono,monospace', fontSize: 12, cursor: 'pointer', fontWeight: 600 }}>
                  + Nova Tarefa
                </button>
              </div>
            </div>

            {/* Resumo */}
            <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
              {STATUS_TAREFA.map(s => (
                <div key={s} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 14px', textAlign: 'center' }}>
                  <div style={{ fontSize: 16, fontWeight: 800, color: corStatus[s], fontFamily: 'Syne,sans-serif' }}>{tarefas.filter(t => t.status === s).length}</div>
                  <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 2 }}>{s}</div>
                </div>
              ))}
            </div>

            {tarefasFiltradas.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--muted)', fontSize: 13 }}>Nenhuma tarefa encontrada.</div>
            ) : (
              tarefasFiltradas.map(t => (
                <div key={t.id} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '14px 16px', marginBottom: 8, display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                  <div onClick={() => toggleStatus(t)} style={{ width: 20, height: 20, borderRadius: 6, border: `2px solid ${corStatus[t.status]}`, background: t.status === 'Concluída' ? corStatus[t.status] : 'transparent', cursor: 'pointer', flexShrink: 0, marginTop: 2, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {t.status === 'Concluída' && <span style={{ color: '#fff', fontSize: 11 }}>✓</span>}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, fontSize: 14, color: t.status === 'Concluída' ? 'var(--muted)' : 'var(--text)', textDecoration: t.status === 'Concluída' ? 'line-through' : 'none' }}>{t.titulo}</div>
                    {t.descricao && <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 3 }}>{t.descricao}</div>}
                    <div style={{ display: 'flex', gap: 8, marginTop: 6, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 4, background: `rgba(${t.prioridade === 'Alta' ? '239,68,68' : t.prioridade === 'Média' ? '245,158,11' : '16,185,129'},.15)`, color: corPrioridade[t.prioridade] }}>{t.prioridade}</span>
                      <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 4, background: 'var(--surface2)', color: corStatus[t.status] }}>{t.status}</span>
                      {t.vencimento && <span style={{ fontSize: 10, color: 'var(--muted)' }}>📅 {new Date(t.vencimento + 'T12:00:00').toLocaleDateString('pt-BR')}</span>}
                      {t.responsavel && <span style={{ fontSize: 10, color: 'var(--muted)' }}>👤 {t.responsavel}</span>}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                    <button onClick={() => { setFormTarefa({ ...EMPTY_TAREFA, ...t }); setShowFormTarefa(true) }} style={{ padding: '5px 9px', borderRadius: 6, background: 'rgba(0,212,255,.08)', border: '1px solid rgba(0,212,255,.2)', color: 'var(--accent)', fontSize: 12, cursor: 'pointer' }}>✏️</button>
                    <button onClick={() => excluirTarefa(t.id)} style={{ padding: '5px 9px', borderRadius: 6, background: 'rgba(239,68,68,.08)', border: '1px solid rgba(239,68,68,.2)', color: 'var(--danger)', fontSize: 12, cursor: 'pointer' }}>🗑</button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* ══ CONSULTA TRIBUTÁRIA ══ */}
        {aba === 'tributaria' && (
          <div>
            <h3 style={{ fontFamily: 'Syne,sans-serif', fontSize: 16, fontWeight: 700, marginBottom: 16 }}>🔍 Consulta Tributária por CNPJ</h3>
            <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: '20px 22px', marginBottom: 16 }}>
              <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
                <input value={cnpjConsulta} onChange={e => setCnpjConsulta(e.target.value)} placeholder="00.000.000/0001-00"
                  style={{ flex: 1, background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 14px', fontFamily: 'DM Mono,monospace', fontSize: 13, color: 'var(--text)', outline: 'none' }}
                  onKeyDown={e => e.key === 'Enter' && consultarCNPJ()} />
                <button onClick={consultarCNPJ} disabled={buscandoConsulta}
                  style={{ padding: '10px 20px', borderRadius: 8, background: 'linear-gradient(135deg,var(--accent),#0099bb)', border: 'none', color: '#fff', fontFamily: 'DM Mono,monospace', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                  {buscandoConsulta ? '⏳...' : '🔍 Consultar'}
                </button>
              </div>
              {erroConsulta && <div style={{ padding: '10px 14px', background: 'rgba(239,68,68,.1)', border: '1px solid rgba(239,68,68,.3)', borderRadius: 8, fontSize: 13, color: 'var(--danger)' }}>⚠️ {erroConsulta}</div>}
              {resultadoConsulta && (
                <div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
                    {[
                      ['Razão Social', resultadoConsulta.razao_social],
                      ['Nome Fantasia', resultadoConsulta.nome_fantasia || '—'],
                      ['CNPJ', resultadoConsulta.cnpj],
                      ['Situação', resultadoConsulta.descricao_situacao_cadastral],
                      ['Porte', resultadoConsulta.descricao_porte],
                      ['Natureza Jurídica', resultadoConsulta.natureza_juridica],
                      ['Opção MEI', resultadoConsulta.opcao_pelo_mei ? '✅ Sim' : '❌ Não'],
                      ['Opção Simples', resultadoConsulta.opcao_pelo_simples ? '✅ Sim' : '❌ Não'],
                      ['Município', resultadoConsulta.municipio],
                      ['UF', resultadoConsulta.uf],
                      ['Capital Social', resultadoConsulta.capital_social ? `R$ ${Number(resultadoConsulta.capital_social).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : '—'],
                      ['Data Abertura', resultadoConsulta.data_inicio_atividade],
                    ].map(([l, v]) => (
                      <div key={l} style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 12px' }}>
                        <div style={{ fontSize: 10, color: 'var(--muted)', marginBottom: 3, textTransform: 'uppercase', letterSpacing: 1 }}>{l}</div>
                        <div style={{ fontSize: 13, color: 'var(--text)', fontWeight: 500 }}>{v || '—'}</div>
                      </div>
                    ))}
                  </div>
                  {resultadoConsulta.cnaes_secundarios?.length > 0 && (
                    <div style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 8, padding: '12px 14px' }}>
                      <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1 }}>CNAEs Secundários</div>
                      {resultadoConsulta.cnaes_secundarios.slice(0, 5).map((c, i) => (
                        <div key={i} style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 4 }}>{c.codigo} — {c.descricao}</div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ══ MEI ══ */}
        {aba === 'mei' && (
          <div>
            <div style={{ display: 'flex', gap: 10, marginBottom: 16, alignItems: 'center' }}>
              <h3 style={{ fontFamily: 'Syne,sans-serif', fontSize: 16, fontWeight: 700 }}>🏪 Gestão MEI</h3>
              <button onClick={() => { setFormMei({ id: '', nome: '', cnpj: '', email: '', telefone: '', vencimentoDas: '', anuidade: '', observacoes: '' }); setShowFormMei(true) }}
                style={{ marginLeft: 'auto', padding: '8px 16px', borderRadius: 8, background: 'linear-gradient(135deg,var(--accent),#0099bb)', border: 'none', color: '#fff', fontFamily: 'DM Mono,monospace', fontSize: 12, cursor: 'pointer', fontWeight: 600 }}>
                + Novo MEI
              </button>
            </div>
            {meis.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--muted)', fontSize: 13 }}>Nenhum MEI cadastrado.</div>
            ) : (
              meis.map(m => (
                <div key={m.id} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '14px 16px', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--accent)' }}>{m.nome}</div>
                    <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>
                      {m.cnpj && `CNPJ: ${m.cnpj} · `}
                      {m.email && `${m.email} · `}
                      {m.vencimentoDas && `DAS: dia ${m.vencimentoDas}`}
                    </div>
                    {m.observacoes && <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>{m.observacoes}</div>}
                  </div>
                  <button onClick={() => { setFormMei({ ...m }); setShowFormMei(true) }} style={{ padding: '6px 10px', borderRadius: 7, background: 'rgba(0,212,255,.08)', border: '1px solid rgba(0,212,255,.2)', color: 'var(--accent)', cursor: 'pointer' }}>✏️</button>
                  <button onClick={async () => { if (!confirm('Excluir MEI?')) return; const l = meis.filter(x => x.id !== m.id); const nc = { ...cfg, meis: l }; await salvarStorage(nc); setMeis(l); setCfg(nc); toast('🗑 MEI removido!') }}
                    style={{ padding: '6px 10px', borderRadius: 7, background: 'rgba(239,68,68,.08)', border: '1px solid rgba(239,68,68,.2)', color: 'var(--danger)', cursor: 'pointer' }}>🗑</button>
                </div>
              ))
            )}
          </div>
        )}

        {/* ══ SIMPLES NACIONAL ══ */}
        {aba === 'simples' && (
          <div>
            <h3 style={{ fontFamily: 'Syne,sans-serif', fontSize: 16, fontWeight: 700, marginBottom: 16 }}>📊 Simulador Simples Nacional</h3>
            <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: '22px 24px', maxWidth: 500 }}>
              <div style={{ marginBottom: 14 }}>
                <label style={{ fontSize: 12, color: 'var(--muted)', display: 'block', marginBottom: 4 }}>Faturamento Anual (R$)</label>
                <input value={faturamento} onChange={e => setFaturamento(e.target.value)} placeholder="Ex: 360000" type="number"
                  style={{ width: '100%', background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 12px', fontFamily: 'DM Mono,monospace', fontSize: 14, color: 'var(--text)', outline: 'none' }} />
              </div>
              <div style={{ marginBottom: 16 }}>
                <label style={{ fontSize: 12, color: 'var(--muted)', display: 'block', marginBottom: 4 }}>Atividade</label>
                <select value={atividade} onChange={e => setAtividade(e.target.value)}
                  style={{ width: '100%', background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 12px', fontFamily: 'DM Mono,monospace', fontSize: 13, color: 'var(--text)', cursor: 'pointer', outline: 'none' }}>
                  <option value="comercio">Comércio / Indústria (Anexo I/II)</option>
                  <option value="servicos">Serviços (Anexo III)</option>
                </select>
              </div>
              <button onClick={calcularSimples}
                style={{ width: '100%', padding: '12px', borderRadius: 10, background: 'linear-gradient(135deg,var(--accent),#0099bb)', border: 'none', color: '#fff', fontFamily: 'DM Mono,monospace', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
                📊 Calcular
              </button>
              {resultadoSimples && (
                <div style={{ marginTop: 20, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  {[
                    ['Faturamento', fmt(resultadoSimples.faturamento), 'var(--text)'],
                    ['Faixa', `${resultadoSimples.faixa}ª faixa`, 'var(--accent)'],
                    ['Alíquota Nominal', `${resultadoSimples.aliquotaNominal}%`, 'var(--warning)'],
                    ['Alíquota Efetiva', `${resultadoSimples.aliquotaEfetiva}%`, 'var(--accent3)'],
                    ['Imposto Anual', fmt(resultadoSimples.valorImposto), 'var(--danger)'],
                    ['Imposto Mensal', fmt(resultadoSimples.valorImposto / 12), 'var(--gold)'],
                  ].map(([l, v, c]) => (
                    <div key={l} style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 8, padding: '12px 14px' }}>
                      <div style={{ fontSize: 10, color: 'var(--muted)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 1 }}>{l}</div>
                      <div style={{ fontSize: 16, fontWeight: 800, color: c, fontFamily: 'Syne,sans-serif' }}>{v}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      {/* Modal Tarefa */}
      {showFormTarefa && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.75)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, width: '100%', maxWidth: 500, padding: '24px', boxShadow: '0 8px 40px rgba(0,0,0,.5)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ fontFamily: 'Syne,sans-serif', fontSize: 15, fontWeight: 700, color: 'var(--accent)' }}>{formTarefa.id ? '✏️ Editar Tarefa' : '➕ Nova Tarefa'}</h3>
              <button onClick={() => setShowFormTarefa(false)} style={{ background: 'none', border: 'none', color: 'var(--muted)', fontSize: 20, cursor: 'pointer' }}>✕</button>
            </div>
            {[['Título *', 'titulo', 'text', 'Título da tarefa'], ['Descrição', 'descricao', 'text', 'Detalhes...'], ['Responsável', 'responsavel', 'text', 'Nome do responsável']].map(([l, k, t, p]) => (
              <div key={k} style={{ marginBottom: 12 }}>
                <label style={{ fontSize: 11, color: 'var(--muted)', display: 'block', marginBottom: 4 }}>{l}</label>
                <input type={t} value={formTarefa[k]} onChange={e => setFormTarefa(f => ({ ...f, [k]: e.target.value }))} placeholder={p} style={{ width: '100%', background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 8, padding: '9px 12px', fontFamily: 'DM Mono,monospace', fontSize: 13, color: 'var(--text)', outline: 'none' }} />
              </div>
            ))}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 12 }}>
              {[['Prioridade', 'prioridade', PRIORIDADES], ['Status', 'status', STATUS_TAREFA]].map(([l, k, opts]) => (
                <div key={k} style={{ gridColumn: 'span 1' }}>
                  <label style={{ fontSize: 11, color: 'var(--muted)', display: 'block', marginBottom: 4 }}>{l}</label>
                  <select value={formTarefa[k]} onChange={e => setFormTarefa(f => ({ ...f, [k]: e.target.value }))} style={{ width: '100%', background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 8, padding: '9px 8px', fontFamily: 'DM Mono,monospace', fontSize: 12, color: 'var(--text)', cursor: 'pointer', outline: 'none' }}>
                    {opts.map(o => <option key={o} value={o}>{o}</option>)}
                  </select>
                </div>
              ))}
              <div>
                <label style={{ fontSize: 11, color: 'var(--muted)', display: 'block', marginBottom: 4 }}>Vencimento</label>
                <input type="date" value={formTarefa.vencimento} onChange={e => setFormTarefa(f => ({ ...f, vencimento: e.target.value }))} style={{ width: '100%', background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 8, padding: '9px 8px', fontFamily: 'DM Mono,monospace', fontSize: 12, color: 'var(--text)', outline: 'none' }} />
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button onClick={() => setShowFormTarefa(false)} style={{ padding: '10px 18px', borderRadius: 10, background: 'rgba(100,116,139,.12)', border: '1px solid var(--border)', color: 'var(--muted)', fontFamily: 'DM Mono,monospace', fontSize: 13, cursor: 'pointer' }}>Cancelar</button>
              <button onClick={salvarTarefa} disabled={saving} style={{ padding: '10px 22px', borderRadius: 10, background: 'linear-gradient(135deg,var(--accent),#0099bb)', border: 'none', color: '#fff', fontFamily: 'DM Mono,monospace', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>{saving ? '⏳...' : '✅ Salvar'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal MEI */}
      {showFormMei && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.75)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, width: '100%', maxWidth: 480, padding: '24px', boxShadow: '0 8px 40px rgba(0,0,0,.5)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ fontFamily: 'Syne,sans-serif', fontSize: 15, fontWeight: 700, color: 'var(--accent)' }}>{formMei.id ? '✏️ Editar MEI' : '➕ Novo MEI'}</h3>
              <button onClick={() => setShowFormMei(false)} style={{ background: 'none', border: 'none', color: 'var(--muted)', fontSize: 20, cursor: 'pointer' }}>✕</button>
            </div>
            {[['Nome *', 'nome'], ['CNPJ', 'cnpj'], ['E-mail', 'email'], ['Telefone', 'telefone'], ['Vencimento DAS (dia)', 'vencimentoDas'], ['Anuidade', 'anuidade'], ['Observações', 'observacoes']].map(([l, k]) => (
              <div key={k} style={{ marginBottom: 10 }}>
                <label style={{ fontSize: 11, color: 'var(--muted)', display: 'block', marginBottom: 4 }}>{l}</label>
                <input value={formMei[k]} onChange={e => setFormMei(m => ({ ...m, [k]: e.target.value }))} style={{ width: '100%', background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 8, padding: '9px 12px', fontFamily: 'DM Mono,monospace', fontSize: 13, color: 'var(--text)', outline: 'none' }} />
              </div>
            ))}
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 8 }}>
              <button onClick={() => setShowFormMei(false)} style={{ padding: '10px 18px', borderRadius: 10, background: 'rgba(100,116,139,.12)', border: '1px solid var(--border)', color: 'var(--muted)', fontFamily: 'DM Mono,monospace', fontSize: 13, cursor: 'pointer' }}>Cancelar</button>
              <button onClick={salvarMei} disabled={saving} style={{ padding: '10px 22px', borderRadius: 10, background: 'linear-gradient(135deg,var(--accent),#0099bb)', border: 'none', color: '#fff', fontFamily: 'DM Mono,monospace', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>{saving ? '⏳...' : '✅ Salvar'}</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

const navBtn = { background: 'var(--surface2)', border: '1px solid var(--border)', cursor: 'pointer', color: 'var(--muted)', fontSize: 11, padding: '5px 11px', borderRadius: 8, fontFamily: 'DM Mono,monospace' }

export async function getServerSideProps() { return { props: {} } }
