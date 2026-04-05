// pages/produtividade.js — Produtividade Vivanexa v2
// Aba Consulta Tributária: busca por NCM, código de barras ou descrição
// com tributação completa (IPI, ICMS, PIS, COFINS, CEST) e embasamento legal.
import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import Head from 'next/head'
import { supabase } from '../lib/supabase'
import Navbar from '../components/Navbar'

const PRIORIDADES = ['Alta', 'Média', 'Baixa']
const STATUS_TAREFA = ['Pendente', 'Em Andamento', 'Concluída', 'Cancelada']
const EMPTY_TAREFA = { id: '', titulo: '', descricao: '', prioridade: 'Média', status: 'Pendente', responsavel: '', vencimento: '', criadoEm: '' }

const fmt = n => 'R$ ' + Number(n || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })

// ── Tabela NCM com tributação (base local para exemplos comuns) ──
// Em produção: integrar com API Receita Federal / SINIEF
const NCM_BASE = {
  '84713012': { descricao: 'Notebook / Laptop', ncm: '8471.30.12', ipi: 0, icms: 12, pis: 1.65, cofins: 7.6, cest: null, lei_ipi: 'TIPI – Tabela de Incidência do IPI (Decreto 11.158/2022)', lei_icms: 'RICMS/SP Art. 54 – Alíquota 12% para máquinas e equipamentos', lei_pis_cofins: 'Lei 10.637/2002 e 10.833/2003 – Regime não cumulativo', obs: 'Equipamentos de informática têm IPI reduzido a 0% conforme política de incentivo ao setor.' },
  '22021000': { descricao: 'Água mineral sem gás', ncm: '2202.10.00', ipi: 0, icms: 18, pis: 0.65, cofins: 3, cest: '03.001.00', lei_ipi: 'TIPI – Posição 2202 isenta de IPI', lei_icms: 'RICMS – Alíquota interna padrão de 18%', lei_pis_cofins: 'Lei 9.718/1998 – Regime cumulativo', obs: 'Bebidas em geral sujeitam-se à substituição tributária. Verificar CEST 03.001.00.' },
  '62034200': { descricao: 'Calça masculina de algodão', ncm: '6203.42.00', ipi: 0, icms: 12, pis: 1.65, cofins: 7.6, cest: null, lei_ipi: 'TIPI – Vestuário isento de IPI', lei_icms: 'Convênio ICMS 52/91 – Alíquota interestadual 12%', lei_pis_cofins: 'Lei 10.637/2002 – Não cumulativo para indústrias', obs: 'Confecções não estão sujeitas à substituição tributária em geral.' },
  '85171210': { descricao: 'Smartphone', ncm: '8517.12.10', ipi: 8, icms: 12, pis: 1.65, cofins: 7.6, cest: '21.059.00', lei_ipi: 'TIPI – Alíquota 8% para aparelhos de telefonia', lei_icms: 'RICMS – Alíquota de 12% com ST em operações interestaduais', lei_pis_cofins: 'Lei 10.637/2002 e 10.833/2003 – Não cumulativo', obs: 'Celulares têm ST em praticamente todos os estados. Verificar protocolo entre UFs.' },
  '10063021': { descricao: 'Arroz beneficiado', ncm: '1006.30.21', ipi: 0, icms: 7, pis: 0.065, cofins: 0.3, cest: '13.001.00', lei_ipi: 'TIPI – Cereais isentos de IPI', lei_icms: 'RICMS – Alíquota reduzida 7% (produto da cesta básica)', lei_pis_cofins: 'Lei 10.925/2004 Art. 1º – PIS/COFINS alíquota zero cesta básica', obs: 'Produto integrante da cesta básica com benefícios fiscais em todos os entes.' },
  '04021010': { descricao: 'Leite em pó integral', ncm: '0402.10.10', ipi: 0, icms: 7, pis: 0, cofins: 0, cest: null, lei_ipi: 'TIPI – Laticínios isentos', lei_icms: 'RICMS – Cesta básica 7%', lei_pis_cofins: 'Lei 10.925/2004 – Alíquota zero', obs: 'Isenção total de PIS/COFINS para leite. ICMS pode ser isento em alguns estados.' },
}

// ── Busca real na API BrasilAPI (NCM) ──────────────────────────
async function buscarNCMApi(ncm) {
  try {
    const clean = ncm.replace(/\D/g, '')
    const r = await fetch(`https://brasilapi.com.br/api/ncm/v1/${clean}`)
    if (!r.ok) return null
    const d = await r.json()
    return d
  } catch { return null }
}

// ── Busca por EAN / código de barras (Open Food Facts + Cosmos) ─
async function buscarEAN(ean) {
  try {
    const r = await fetch(`https://cosmos.bluesoft.com.br/products/${ean}`, {
      headers: { 'X-Cosmos-Token': 'demo' }
    })
    if (r.ok) { const d = await r.json(); return d }
  } catch { }
  // Fallback: Open Food Facts
  try {
    const r2 = await fetch(`https://world.openfoodfacts.org/api/v0/product/${ean}.json`)
    if (r2.ok) {
      const d = await r2.json()
      if (d.status === 1) return { description: d.product?.product_name_pt || d.product?.product_name, ncm: null, source: 'openfoodfacts' }
    }
  } catch { }
  return null
}

export default function Produtividade() {
  const router = useRouter()
  const { aba: abaQuery } = router.query

  const [loading,  setLoading]  = useState(true)
  const [cfg,      setCfg]      = useState({})
  const [empresaId, setEmpresaId] = useState(null)
  const [perfil,   setPerfil]   = useState(null)
  const [aba,      setAba]      = useState('tarefas')

  // Tarefas
  const [tarefas,       setTarefas]       = useState([])
  const [showFormTarefa, setShowFormTarefa] = useState(false)
  const [formTarefa,    setFormTarefa]    = useState({ ...EMPTY_TAREFA })
  const [filtroPrioridade, setFiltroPrioridade] = useState('Todos')
  const [filtroStatus,  setFiltroStatus]  = useState('Todos')
  const [saving,        setSaving]        = useState(false)

  // Consulta Tributária
  const [tribBusca,  setTribBusca]  = useState('')
  const [tribTipo,   setTribTipo]   = useState('ncm') // ncm | ean | descricao
  const [tribResult, setTribResult] = useState(null)
  const [tribLoading, setTribLoading] = useState(false)
  const [tribErro,   setTribErro]   = useState('')

  // MEI
  const [meis,        setMeis]        = useState([])
  const [showFormMei, setShowFormMei] = useState(false)
  const [formMei,     setFormMei]     = useState({ id: '', nome: '', cnpj: '', email: '', telefone: '', vencimentoDas: '', anuidade: '', observacoes: '' })

  // Simples Nacional
  const [faturamento,      setFaturamento]      = useState('')
  const [atividade,        setAtividade]        = useState('comercio')
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
        setCfg(c); setTarefas(c.tarefas || []); setMeis(c.meis || [])
      }
      setLoading(false)
    }
    init()
  }, [router])

  useEffect(() => {
    if (abaQuery) setAba(abaQuery)
  }, [abaQuery])

  async function salvarStorage(novoCfg) {
    await supabase.from('vx_storage').upsert({ key: `cfg:${empresaId}`, value: JSON.stringify(novoCfg), updated_at: new Date().toISOString() }, { onConflict: 'key' })
  }

  function toast(msg) { setMsgSucesso(msg); setTimeout(() => setMsgSucesso(''), 3000) }

  // ── TAREFAS ──────────────────────────────────────────────────
  async function salvarTarefa() {
    if (!formTarefa.titulo.trim()) { alert('Informe o título.'); return }
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
    await salvarStorage(novoCfg); setTarefas(lista); setCfg(novoCfg); toast('🗑 Removida!')
  }

  // ── CONSULTA TRIBUTÁRIA ───────────────────────────────────────
  async function consultarTributaria() {
    if (!tribBusca.trim()) { setTribErro('Informe o ' + (tribTipo === 'ncm' ? 'NCM' : tribTipo === 'ean' ? 'código de barras' : 'descrição')); return }
    setTribLoading(true); setTribErro(''); setTribResult(null)

    try {
      const termo = tribBusca.trim().replace(/[.\-\/]/g, '')

      if (tribTipo === 'ncm') {
        // 1. Tenta base local
        const local = NCM_BASE[termo] || NCM_BASE[tribBusca.trim()]
        if (local) { setTribResult({ ...local, fonte: 'base_local', busca: tribBusca }); setTribLoading(false); return }

        // 2. Tenta BrasilAPI
        const api = await buscarNCMApi(termo)
        if (api && api.codigo) {
          setTribResult({
            descricao: api.descricao,
            ncm: api.codigo,
            ipi: api.aliquota_ipi || 0,
            icms: null, pis: null, cofins: null, cest: null,
            lei_ipi: 'TIPI – Tabela de Incidência do IPI (Decreto 11.158/2022)',
            lei_icms: 'Verificar RICMS do estado de destino e convênios ICMS',
            lei_pis_cofins: 'Lei 10.637/2002 (PIS) e 10.833/2003 (COFINS)',
            obs: 'Alíquotas de ICMS, PIS e COFINS dependem do regime tributário e estado. Consulte o contador.',
            fonte: 'brasilapi',
            busca: tribBusca
          })
          setTribLoading(false); return
        }

        setTribErro('NCM não encontrado. Verifique o código ou tente por descrição.')

      } else if (tribTipo === 'ean') {
        const r = await buscarEAN(termo)
        if (r && (r.description || r.descricao)) {
          const desc = r.description || r.descricao || ''
          const ncmEncontrado = r.ncm?.code || r.ncm || null
          const local = ncmEncontrado ? NCM_BASE[String(ncmEncontrado).replace(/\D/g, '')] : null
          setTribResult({
            descricao: desc,
            ncm: ncmEncontrado ? String(ncmEncontrado) : 'Não disponível',
            ean: termo,
            ipi: local?.ipi ?? null,
            icms: local?.icms ?? null,
            pis: local?.pis ?? null,
            cofins: local?.cofins ?? null,
            cest: local?.cest ?? null,
            lei_ipi: local?.lei_ipi || 'Consultar TIPI conforme o NCM identificado',
            lei_icms: local?.lei_icms || 'Verificar RICMS do estado',
            lei_pis_cofins: local?.lei_pis_cofins || 'Lei 10.637/2002 e 10.833/2003',
            obs: local?.obs || 'Para tributação completa, informe o NCM do produto ao seu contador.',
            fonte: 'ean',
            busca: tribBusca
          })
        } else {
          setTribErro('Produto não encontrado pelo código de barras. Tente buscar pelo NCM.')
        }

      } else {
        // Busca por descrição — filtra a base local
        const t = tribBusca.toLowerCase()
        const achado = Object.entries(NCM_BASE).find(([, v]) => v.descricao.toLowerCase().includes(t))
        if (achado) {
          setTribResult({ ...achado[1], ean: null, fonte: 'base_local', busca: tribBusca })
        } else {
          setTribErro('Nenhum produto encontrado. Tente buscar pelo NCM ou código de barras.')
        }
      }
    } catch (e) {
      setTribErro('Erro na consulta. Verifique sua conexão.')
    } finally {
      setTribLoading(false)
    }
  }

  // ── MEI ───────────────────────────────────────────────────────
  async function salvarMei() {
    if (!formMei.nome.trim()) { alert('Informe o nome.'); return }
    setSaving(true)
    const novo = { ...formMei, id: formMei.id || 'mei_' + Date.now() }
    const lista = formMei.id ? meis.map(m => m.id === formMei.id ? novo : m) : [...meis, novo]
    const novoCfg = { ...cfg, meis: lista }
    await salvarStorage(novoCfg); setMeis(lista); setCfg(novoCfg); setShowFormMei(false)
    setFormMei({ id: '', nome: '', cnpj: '', email: '', telefone: '', vencimentoDas: '', anuidade: '', observacoes: '' })
    setSaving(false); toast('✅ MEI salvo!')
  }

  // ── SIMPLES NACIONAL ─────────────────────────────────────────
  function calcularSimples() {
    const fat = Number(faturamento)
    if (!fat || fat <= 0) { alert('Informe o faturamento anual.'); return }
    const tabelas = {
      comercio:  [{ lim: 180000, al: 4,   ded: 0 },    { lim: 360000, al: 7.3,  ded: 5940 },   { lim: 720000, al: 9.5,  ded: 13860 }, { lim: 1800000, al: 10.7, ded: 22500 }, { lim: 3600000, al: 14.3, ded: 87300 }, { lim: 4800000, al: 19,   ded: 378000 }],
      servicos:  [{ lim: 180000, al: 6,   ded: 0 },    { lim: 360000, al: 11.2, ded: 9360 },   { lim: 720000, al: 13.5, ded: 17640 }, { lim: 1800000, al: 16,   ded: 35640 }, { lim: 3600000, al: 21,   ded: 125640 },{ lim: 4800000, al: 33,   ded: 648000 }],
    }
    const tab = tabelas[atividade] || tabelas.comercio
    let faixa = tab.length - 1
    for (let i = 0; i < tab.length; i++) { if (fat <= tab[i].lim) { faixa = i; break } }
    const { al, ded } = tab[faixa]
    const alEfetiva = ((fat * (al / 100) - ded) / fat) * 100
    setResultadoSimples({ faturamento: fat, faixa: faixa + 1, aliquotaNominal: al, aliquotaEfetiva: alEfetiva.toFixed(2), valorImposto: fat * (al / 100) - ded })
  }

  const tarefasFiltradas = tarefas.filter(t =>
    (filtroPrioridade === 'Todos' || t.prioridade === filtroPrioridade) &&
    (filtroStatus === 'Todos' || t.status === filtroStatus)
  )

  const statusColor = { 'Pendente': '#f59e0b', 'Em Andamento': '#00d4ff', 'Concluída': '#10b981', 'Cancelada': '#64748b' }
  const priColor    = { 'Alta': '#ef4444', 'Média': '#f59e0b', 'Baixa': '#10b981' }

  if (loading) return (
    <div style={{ background: '#0a0f1e', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b', fontFamily: 'DM Mono, monospace' }}>
      Carregando...
    </div>
  )

  return (
    <>
      <Head>
        <title>Produtividade — {cfg.company || 'Vivanexa'}</title>
        <link href="https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=DM+Mono:wght@400;500&display=swap" rel="stylesheet" />
      </Head>
      <style>{CSS}</style>

      <Navbar cfg={cfg} perfil={perfil} />

      <div className="page-wrap">
        <div className="page-hdr">
          <h1 className="page-title">⚡ Produtividade</h1>
          <p className="page-sub">Tarefas, consultas e gestão tributária</p>
        </div>

        {/* Abas */}
        <div className="tabs">
          {[
            { id: 'tarefas',    label: '✅ Tarefas e Obrigações' },
            { id: 'tributaria', label: '📊 Consulta Tributária' },
            { id: 'mei',        label: '🏪 Gestão MEI' },
            { id: 'simples',    label: '📈 Simples Nacional' },
            { id: 'ecac',       label: '🔍 Monitor e-CAC' },
            { id: 'notas',      label: '📥 Captura de Notas' },
          ].map(a => (
            <button key={a.id} className={`tab-btn${aba === a.id ? ' active' : ''}`} onClick={() => setAba(a.id)}>{a.label}</button>
          ))}
        </div>

        {/* ══ TAREFAS ══ */}
        {aba === 'tarefas' && (
          <div>
            <div className="section-hdr">
              <div className="filtros">
                {['Todos', ...PRIORIDADES].map(p => (
                  <button key={p} className={`filt-btn${filtroPrioridade === p ? ' on' : ''}`} onClick={() => setFiltroPrioridade(p)}>{p}</button>
                ))}
                <span style={{ color: '#1e2d4a' }}>|</span>
                {['Todos', ...STATUS_TAREFA].map(s => (
                  <button key={s} className={`filt-btn${filtroStatus === s ? ' on' : ''}`} onClick={() => setFiltroStatus(s)}>{s}</button>
                ))}
              </div>
              <button className="btn-primary" onClick={() => { setFormTarefa({ ...EMPTY_TAREFA }); setShowFormTarefa(true) }}>+ Nova Tarefa</button>
            </div>
            {tarefasFiltradas.length === 0 ? (
              <div className="empty">Nenhuma tarefa encontrada.</div>
            ) : tarefasFiltradas.map(t => (
              <div key={t.id} className="task-row">
                <div className="task-pri" style={{ background: priColor[t.prioridade] + '22', color: priColor[t.prioridade], borderColor: priColor[t.prioridade] + '44' }}>{t.prioridade}</div>
                <div className="task-body">
                  <div className="task-title">{t.titulo}</div>
                  {t.descricao && <div className="task-desc">{t.descricao}</div>}
                  <div className="task-meta">
                    {t.responsavel && <span>👤 {t.responsavel}</span>}
                    {t.vencimento && <span>📅 {new Date(t.vencimento + 'T12:00').toLocaleDateString('pt-BR')}</span>}
                  </div>
                </div>
                <div className="task-status" style={{ color: statusColor[t.status] }}>{t.status}</div>
                <div className="task-acts">
                  <button className="act-btn edit" onClick={() => { setFormTarefa({ ...t }); setShowFormTarefa(true) }}>✏️</button>
                  <button className="act-btn del" onClick={() => excluirTarefa(t.id)}>🗑</button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ══ CONSULTA TRIBUTÁRIA ══ */}
        {aba === 'tributaria' && (
          <div>
            <div className="card" style={{ marginBottom: 20 }}>
              <div className="card-title">🔍 Consulta de Tributação de Produtos</div>
              <p style={{ fontSize: 12, color: '#64748b', marginBottom: 16, lineHeight: 1.6 }}>
                Consulte a tributação completa de qualquer produto pelo NCM, código de barras (EAN) ou descrição.
                Obtém: IPI, ICMS, PIS, COFINS, CEST e embasamento legal atualizado.
              </p>

              {/* Tipo de busca */}
              <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
                {[
                  { id: 'ncm',       label: '🏷️ NCM',              placeholder: 'Ex: 8517.12.10' },
                  { id: 'ean',       label: '📦 Código de Barras', placeholder: 'Ex: 7896007820' },
                  { id: 'descricao', label: '🔤 Descrição',        placeholder: 'Ex: smartphone' },
                ].map(t => (
                  <button key={t.id}
                    onClick={() => { setTribTipo(t.id); setTribBusca(''); setTribResult(null); setTribErro('') }}
                    style={{ padding: '7px 14px', borderRadius: 8, border: '1px solid', cursor: 'pointer', fontFamily: 'DM Mono,monospace', fontSize: 12, fontWeight: 600, transition: 'all .14s',
                      background: tribTipo === t.id ? 'rgba(0,212,255,.15)' : '#1a2540',
                      borderColor: tribTipo === t.id ? 'rgba(0,212,255,.5)' : '#1e2d4a',
                      color: tribTipo === t.id ? '#00d4ff' : '#64748b',
                    }}>
                    {t.label}
                  </button>
                ))}
              </div>

              {/* Campo de busca */}
              <div style={{ display: 'flex', gap: 10 }}>
                <input
                  value={tribBusca}
                  onChange={e => setTribBusca(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && consultarTributaria()}
                  placeholder={tribTipo === 'ncm' ? 'Digite o código NCM (ex: 8471.30.12)' : tribTipo === 'ean' ? 'Digite o código de barras EAN' : 'Digite a descrição do produto'}
                  style={{ flex: 1, background: '#1a2540', border: '1px solid #1e2d4a', borderRadius: 8, padding: '11px 14px', fontFamily: 'DM Mono,monospace', fontSize: 13, color: '#e2e8f0', outline: 'none' }}
                />
                <button onClick={consultarTributaria} disabled={tribLoading}
                  style={{ padding: '11px 22px', borderRadius: 8, background: 'linear-gradient(135deg,#00d4ff,#0099bb)', border: 'none', color: '#fff', fontFamily: 'DM Mono,monospace', fontSize: 13, fontWeight: 600, cursor: tribLoading ? 'not-allowed' : 'pointer', opacity: tribLoading ? .7 : 1, flexShrink: 0 }}>
                  {tribLoading ? '⏳ Consultando...' : '🔍 Consultar'}
                </button>
              </div>

              {tribErro && (
                <div style={{ marginTop: 12, padding: '10px 14px', background: 'rgba(239,68,68,.1)', border: '1px solid rgba(239,68,68,.3)', borderRadius: 8, fontSize: 12, color: '#ef4444' }}>
                  ⚠️ {tribErro}
                </div>
              )}
            </div>

            {/* Resultado */}
            {tribResult && (
              <div className="card">
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
                  <div>
                    <div style={{ fontFamily: 'Syne,sans-serif', fontSize: 18, fontWeight: 800, color: '#e2e8f0', marginBottom: 4 }}>{tribResult.descricao}</div>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      {tribResult.ncm && <span style={{ background: 'rgba(0,212,255,.12)', border: '1px solid rgba(0,212,255,.3)', color: '#00d4ff', padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700 }}>NCM {tribResult.ncm}</span>}
                      {tribResult.ean && <span style={{ background: 'rgba(124,58,237,.12)', border: '1px solid rgba(124,58,237,.3)', color: '#a78bfa', padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700 }}>EAN {tribResult.ean}</span>}
                      {tribResult.cest && <span style={{ background: 'rgba(245,158,11,.12)', border: '1px solid rgba(245,158,11,.3)', color: '#f59e0b', padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700 }}>CEST {tribResult.cest}</span>}
                    </div>
                  </div>
                  <span style={{ fontSize: 10, color: '#64748b', background: '#1a2540', border: '1px solid #1e2d4a', padding: '4px 10px', borderRadius: 6 }}>
                    {tribResult.fonte === 'brasilapi' ? '📡 BrasilAPI' : tribResult.fonte === 'ean' ? '📦 EAN DB' : '📚 Base local'}
                  </span>
                </div>

                {/* Grid de tributos */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 20 }}>
                  {[
                    { label: 'IPI', val: tribResult.ipi, color: '#7c3aed', lei: 'Decreto 11.158/2022 – TIPI', desc: 'Imposto sobre Produtos Industrializados' },
                    { label: 'ICMS', val: tribResult.icms, color: '#f59e0b', lei: 'RICMS estadual + Convênios CONFAZ', desc: 'Imposto sobre Circulação de Mercadorias' },
                    { label: 'PIS', val: tribResult.pis, color: '#10b981', lei: 'Lei 10.637/2002', desc: 'Programa de Integração Social' },
                    { label: 'COFINS', val: tribResult.cofins, color: '#00d4ff', lei: 'Lei 10.833/2003', desc: 'Contribuição para Financiamento da Seguridade' },
                  ].map(t => (
                    <div key={t.label} style={{ background: '#1a2540', border: `1px solid ${t.color}33`, borderRadius: 10, padding: '14px 12px', textAlign: 'center' }}>
                      <div style={{ fontSize: 10, color: '#64748b', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>{t.label}</div>
                      <div style={{ fontFamily: 'Syne,sans-serif', fontSize: 26, fontWeight: 800, color: t.val !== null ? t.color : '#334155', marginBottom: 4 }}>
                        {t.val !== null ? `${t.val}%` : 'Varia*'}
                      </div>
                      <div style={{ fontSize: 9, color: '#64748b', lineHeight: 1.4 }}>{t.desc}</div>
                    </div>
                  ))}
                </div>

                {/* Embasamento legal */}
                <div style={{ background: 'rgba(0,212,255,.04)', border: '1px solid rgba(0,212,255,.15)', borderRadius: 10, padding: '16px 18px', marginBottom: 14 }}>
                  <div style={{ fontFamily: 'Syne,sans-serif', fontSize: 12, fontWeight: 700, color: '#00d4ff', marginBottom: 12, textTransform: 'uppercase', letterSpacing: 1 }}>⚖️ Embasamento Legal</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    {[
                      ['🏭 IPI',         tribResult.lei_ipi],
                      ['🏛️ ICMS',        tribResult.lei_icms],
                      ['💰 PIS/COFINS',  tribResult.lei_pis_cofins],
                      ['📋 CEST',        tribResult.cest ? `Portaria CAQUI – CEST ${tribResult.cest}` : 'Não sujeito à Substituição Tributária'],
                    ].map(([l, v]) => (
                      <div key={l} style={{ background: '#111827', border: '1px solid #1e2d4a', borderRadius: 8, padding: '10px 12px' }}>
                        <div style={{ fontSize: 10, color: '#64748b', marginBottom: 4, fontWeight: 700 }}>{l}</div>
                        <div style={{ fontSize: 11, color: '#e2e8f0', lineHeight: 1.5 }}>{v}</div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Observação */}
                {tribResult.obs && (
                  <div style={{ background: 'rgba(245,158,11,.06)', border: '1px solid rgba(245,158,11,.2)', borderRadius: 8, padding: '12px 14px' }}>
                    <div style={{ fontSize: 10, color: '#f59e0b', fontWeight: 700, marginBottom: 4 }}>⚠️ ATENÇÃO</div>
                    <div style={{ fontSize: 12, color: '#94a3b8', lineHeight: 1.6 }}>{tribResult.obs}</div>
                  </div>
                )}

                {/* Carga total */}
                {tribResult.ipi !== null && tribResult.icms !== null && (
                  <div style={{ marginTop: 14, display: 'flex', gap: 10 }}>
                    <div style={{ flex: 1, background: '#1a2540', border: '1px solid #1e2d4a', borderRadius: 10, padding: '12px 16px', textAlign: 'center' }}>
                      <div style={{ fontSize: 10, color: '#64748b', marginBottom: 4 }}>CARGA TRIBUTÁRIA TOTAL</div>
                      <div style={{ fontFamily: 'Syne,sans-serif', fontSize: 24, fontWeight: 800, color: '#ef4444' }}>
                        {(Number(tribResult.ipi || 0) + Number(tribResult.icms || 0) + Number(tribResult.pis || 0) + Number(tribResult.cofins || 0)).toFixed(2)}%
                      </div>
                    </div>
                    <div style={{ flex: 2, background: '#1a2540', border: '1px solid #1e2d4a', borderRadius: 10, padding: '12px 16px' }}>
                      <div style={{ fontSize: 10, color: '#64748b', marginBottom: 8 }}>SIMULAÇÃO EM UM PRODUTO DE R$ 100,00</div>
                      {[
                        ['IPI',    tribResult.ipi],
                        ['ICMS',   tribResult.icms],
                        ['PIS',    tribResult.pis],
                        ['COFINS', tribResult.cofins],
                      ].filter(([, v]) => v !== null).map(([l, v]) => (
                        <div key={l} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 3 }}>
                          <span style={{ color: '#64748b' }}>{l}:</span>
                          <span style={{ color: '#e2e8f0', fontWeight: 600 }}>R$ {Number(v).toFixed(2)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ══ MEI ══ */}
        {aba === 'mei' && (
          <div>
            <div className="section-hdr">
              <h3 style={{ fontFamily: 'Syne,sans-serif', fontSize: 16, fontWeight: 700, color: '#e2e8f0' }}>🏪 Gestão MEI</h3>
              <button className="btn-primary" onClick={() => { setFormMei({ id: '', nome: '', cnpj: '', email: '', telefone: '', vencimentoDas: '', anuidade: '', observacoes: '' }); setShowFormMei(true) }}>+ Novo MEI</button>
            </div>
            {meis.length === 0 ? <div className="empty">Nenhum MEI cadastrado.</div> : meis.map(m => (
              <div key={m.id} className="list-row">
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: 14, color: '#00d4ff' }}>{m.nome}</div>
                  <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
                    {m.cnpj && `CNPJ: ${m.cnpj} · `}{m.email && `${m.email} · `}{m.vencimentoDas && `DAS: dia ${m.vencimentoDas}`}
                  </div>
                  {m.observacoes && <div style={{ fontSize: 11, color: '#64748b', marginTop: 4 }}>{m.observacoes}</div>}
                </div>
                <button className="act-btn edit" onClick={() => { setFormMei({ ...m }); setShowFormMei(true) }}>✏️</button>
                <button className="act-btn del" onClick={async () => { if (!confirm('Excluir?')) return; const l = meis.filter(x => x.id !== m.id); const nc = { ...cfg, meis: l }; await salvarStorage(nc); setMeis(l); setCfg(nc); toast('🗑 Removido!') }}>🗑</button>
              </div>
            ))}
          </div>
        )}

        {/* ══ SIMPLES NACIONAL ══ */}
        {aba === 'simples' && (
          <div>
            <div className="card" style={{ maxWidth: 520 }}>
              <div className="card-title">📊 Simulador Simples Nacional</div>
              <div style={{ marginBottom: 14 }}>
                <label className="field-label">Faturamento Anual (R$)</label>
                <input value={faturamento} onChange={e => setFaturamento(e.target.value)} placeholder="Ex: 360000" type="number" className="field-input" />
              </div>
              <div style={{ marginBottom: 16 }}>
                <label className="field-label">Atividade</label>
                <select value={atividade} onChange={e => setAtividade(e.target.value)} className="field-input" style={{ cursor: 'pointer' }}>
                  <option value="comercio">Comércio / Indústria (Anexo I/II)</option>
                  <option value="servicos">Serviços (Anexo III)</option>
                </select>
              </div>
              <button onClick={calcularSimples} className="btn-primary" style={{ width: '100%', padding: 13, justifyContent: 'center' }}>📊 Calcular DAS</button>
              {resultadoSimples && (
                <div style={{ marginTop: 20, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  {[
                    ['Faturamento',     fmt(resultadoSimples.faturamento), '#e2e8f0'],
                    ['Faixa',          `${resultadoSimples.faixa}ª faixa`, '#00d4ff'],
                    ['Alíquota Nominal', `${resultadoSimples.aliquotaNominal}%`, '#f59e0b'],
                    ['Alíquota Efetiva', `${resultadoSimples.aliquotaEfetiva}%`, '#10b981'],
                    ['Imposto Anual',   fmt(resultadoSimples.valorImposto), '#ef4444'],
                    ['DAS Mensal',      fmt(resultadoSimples.valorImposto / 12), '#f59e0b'],
                  ].map(([l, v, c]) => (
                    <div key={l} style={{ background: '#1a2540', border: '1px solid #1e2d4a', borderRadius: 8, padding: '12px 14px' }}>
                      <div style={{ fontSize: 10, color: '#64748b', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 1 }}>{l}</div>
                      <div style={{ fontSize: 18, fontWeight: 800, color: c, fontFamily: 'Syne,sans-serif' }}>{v}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ══ E-CAC ══ */}
        {aba === 'ecac' && (
          <div className="card">
            <div className="card-title">🔍 Monitoramento e-CAC</div>
            <p style={{ fontSize: 13, color: '#64748b', marginBottom: 20, lineHeight: 1.7 }}>
              Integração com portais de monitoramento contábil e fiscal. Configure as credenciais em <strong style={{ color: '#00d4ff', cursor: 'pointer' }} onClick={() => router.push('/configuracoes?tab=integracoes')}>Configurações → Integrações</strong>.
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 12 }}>
              {[
                { nome: 'VERI',            desc: 'Monitoramento automático de CNDs, certidões e situação fiscal.',   cor: '#00d4ff', url: 'https://veri.com.br' },
                { nome: 'Monitor Contábil', desc: 'Painel unificado de obrigações acessórias e prazos fiscais.',      cor: '#7c3aed', url: '#' },
                { nome: 'Fiscontech',       desc: 'Gestão de malhas fiscais, pendências e regularização automática.', cor: '#10b981', url: '#' },
                { nome: 'SIEG',             desc: 'Captura e organização automática de XMLs de NF-e e NFC-e.',       cor: '#f59e0b', url: '#' },
              ].map(s => (
                <div key={s.nome} style={{ background: '#1a2540', border: `1px solid ${s.cor}33`, borderRadius: 12, padding: '16px 18px' }}>
                  <div style={{ fontFamily: 'Syne,sans-serif', fontSize: 14, fontWeight: 700, color: s.cor, marginBottom: 6 }}>{s.nome}</div>
                  <div style={{ fontSize: 12, color: '#64748b', marginBottom: 12, lineHeight: 1.5 }}>{s.desc}</div>
                  <button onClick={() => router.push('/configuracoes?tab=integracoes')} style={{ padding: '7px 14px', borderRadius: 7, background: s.cor + '1a', border: `1px solid ${s.cor}44`, color: s.cor, fontFamily: 'DM Mono,monospace', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>
                    Configurar →
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ══ CAPTURA DE NOTAS ══ */}
        {aba === 'notas' && (
          <div className="card">
            <div className="card-title">📥 Captura de Notas Fiscais</div>
            <p style={{ fontSize: 13, color: '#64748b', marginBottom: 20, lineHeight: 1.7 }}>
              Integração com o Portal Nacional da NF-e para captura automática de XMLs. Configure em <strong style={{ color: '#00d4ff', cursor: 'pointer' }} onClick={() => router.push('/configuracoes?tab=integracoes')}>Configurações → Integrações</strong>.
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12 }}>
              {[
                { label: 'NF-e Compras',  icon: '📦', desc: 'XMLs de notas de entrada / compras' },
                { label: 'NF-e Vendas',   icon: '🛒', desc: 'XMLs de notas emitidas / vendas' },
                { label: 'SIEG Monitor',  icon: '📡', desc: 'Captura automática via SIEG' },
              ].map(c => (
                <div key={c.label} style={{ background: '#1a2540', border: '1px solid #1e2d4a', borderRadius: 12, padding: '18px 16px', textAlign: 'center' }}>
                  <div style={{ fontSize: 28, marginBottom: 10 }}>{c.icon}</div>
                  <div style={{ fontFamily: 'Syne,sans-serif', fontSize: 13, fontWeight: 700, color: '#e2e8f0', marginBottom: 6 }}>{c.label}</div>
                  <div style={{ fontSize: 11, color: '#64748b', marginBottom: 14 }}>{c.desc}</div>
                  <button onClick={() => router.push('/configuracoes?tab=integracoes')} style={{ padding: '7px 14px', borderRadius: 7, background: 'rgba(0,212,255,.1)', border: '1px solid rgba(0,212,255,.25)', color: '#00d4ff', fontFamily: 'DM Mono,monospace', fontSize: 11, cursor: 'pointer' }}>Configurar</button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Toast */}
      {msgSucesso && (
        <div style={{ position: 'fixed', bottom: 24, right: 24, background: 'rgba(16,185,129,.9)', color: '#fff', padding: '12px 20px', borderRadius: 10, fontFamily: 'DM Mono,monospace', fontSize: 13, fontWeight: 600, zIndex: 9999 }}>
          {msgSucesso}
        </div>
      )}

      {/* Modal Tarefa */}
      {showFormTarefa && (
        <div className="modal-bg">
          <div className="modal-box">
            <div className="modal-hdr">
              <h3>{formTarefa.id ? '✏️ Editar Tarefa' : '➕ Nova Tarefa'}</h3>
              <button className="modal-close" onClick={() => setShowFormTarefa(false)}>✕</button>
            </div>
            {[['Título *', 'titulo'], ['Descrição', 'descricao'], ['Responsável', 'responsavel']].map(([l, k]) => (
              <div key={k} style={{ marginBottom: 12 }}>
                <label className="field-label">{l}</label>
                <input value={formTarefa[k]} onChange={e => setFormTarefa(f => ({ ...f, [k]: e.target.value }))} className="field-input" />
              </div>
            ))}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 12 }}>
              <div>
                <label className="field-label">Prioridade</label>
                <select value={formTarefa.prioridade} onChange={e => setFormTarefa(f => ({ ...f, prioridade: e.target.value }))} className="field-input">
                  {PRIORIDADES.map(o => <option key={o} value={o}>{o}</option>)}
                </select>
              </div>
              <div>
                <label className="field-label">Status</label>
                <select value={formTarefa.status} onChange={e => setFormTarefa(f => ({ ...f, status: e.target.value }))} className="field-input">
                  {STATUS_TAREFA.map(o => <option key={o} value={o}>{o}</option>)}
                </select>
              </div>
              <div>
                <label className="field-label">Vencimento</label>
                <input type="date" value={formTarefa.vencimento} onChange={e => setFormTarefa(f => ({ ...f, vencimento: e.target.value }))} className="field-input" />
              </div>
            </div>
            <div className="modal-foot">
              <button className="btn-cancel" onClick={() => setShowFormTarefa(false)}>Cancelar</button>
              <button className="btn-primary" onClick={salvarTarefa} disabled={saving}>{saving ? '⏳...' : '✅ Salvar'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal MEI */}
      {showFormMei && (
        <div className="modal-bg">
          <div className="modal-box">
            <div className="modal-hdr">
              <h3>{formMei.id ? '✏️ Editar MEI' : '➕ Novo MEI'}</h3>
              <button className="modal-close" onClick={() => setShowFormMei(false)}>✕</button>
            </div>
            {[['Nome *', 'nome'], ['CNPJ', 'cnpj'], ['E-mail', 'email'], ['Telefone', 'telefone'], ['Vencimento DAS (dia)', 'vencimentoDas'], ['Anuidade', 'anuidade'], ['Observações', 'observacoes']].map(([l, k]) => (
              <div key={k} style={{ marginBottom: 10 }}>
                <label className="field-label">{l}</label>
                <input value={formMei[k]} onChange={e => setFormMei(m => ({ ...m, [k]: e.target.value }))} className="field-input" />
              </div>
            ))}
            <div className="modal-foot">
              <button className="btn-cancel" onClick={() => setShowFormMei(false)}>Cancelar</button>
              <button className="btn-primary" onClick={salvarMei} disabled={saving}>{saving ? '⏳...' : '✅ Salvar'}</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

const CSS = `
  :root{--bg:#0a0f1e;--surface:#111827;--surface2:#1a2540;--border:#1e2d4a;--accent:#00d4ff;--text:#e2e8f0;--muted:#64748b;--danger:#ef4444;--gold:#f59e0b;--accent3:#10b981}
  *{box-sizing:border-box;margin:0;padding:0}
  body{background:var(--bg);color:var(--text);font-family:'DM Mono',monospace;min-height:100vh}
  body::before{content:'';position:fixed;inset:0;background-image:linear-gradient(rgba(0,212,255,.018) 1px,transparent 1px),linear-gradient(90deg,rgba(0,212,255,.018) 1px,transparent 1px);background-size:44px 44px;pointer-events:none;z-index:0}
  .page-wrap{max-width:1200px;margin:0 auto;padding:24px 20px 60px;position:relative;z-index:1}
  .page-hdr{margin-bottom:20px}
  .page-title{font-family:'Syne',sans-serif;font-size:22px;font-weight:800;margin-bottom:4px}
  .page-sub{font-size:12px;color:var(--muted)}
  .tabs{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:24px;border-bottom:1px solid var(--border);padding-bottom:12px}
  .tab-btn{padding:8px 14px;border-radius:8px;border:1px solid var(--border);background:var(--surface2);color:var(--muted);font-family:'DM Mono',monospace;font-size:11.5px;cursor:pointer;transition:all .14s;white-space:nowrap}
  .tab-btn.active{background:rgba(0,212,255,.12);border-color:rgba(0,212,255,.4);color:var(--accent);font-weight:600}
  .section-hdr{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:16px;flex-wrap:wrap}
  .filtros{display:flex;gap:5px;flex-wrap:wrap;align-items:center}
  .filt-btn{padding:5px 11px;border-radius:7px;border:1px solid var(--border);background:var(--surface2);color:var(--muted);font-family:'DM Mono',monospace;font-size:11px;cursor:pointer;transition:all .12s;white-space:nowrap}
  .filt-btn.on{background:rgba(0,212,255,.12);border-color:rgba(0,212,255,.4);color:var(--accent)}
  .btn-primary{display:flex;align-items:center;gap:6px;padding:9px 18px;background:linear-gradient(135deg,var(--accent),#0099bb);border:none;border-radius:9px;color:#fff;font-family:'DM Mono',monospace;font-size:12px;font-weight:600;cursor:pointer;transition:all .18s;white-space:nowrap}
  .btn-primary:hover{box-shadow:0 0 16px rgba(0,212,255,.35);transform:translateY(-1px)}
  .btn-primary:disabled{opacity:.6;cursor:not-allowed;transform:none}
  .btn-cancel{padding:9px 18px;border-radius:9px;background:rgba(100,116,139,.12);border:1px solid var(--border);color:var(--muted);font-family:'DM Mono',monospace;font-size:12px;cursor:pointer}
  .empty{text-align:center;padding:40px 0;color:var(--muted);font-size:13px}
  .task-row{display:flex;align-items:flex-start;gap:12px;padding:14px;background:var(--surface);border:1px solid var(--border);border-radius:11px;margin-bottom:8px;transition:border-color .14s}
  .task-row:hover{border-color:#2a3d5a}
  .task-pri{font-size:10px;font-weight:700;padding:3px 9px;border-radius:20px;border:1px solid;flex-shrink:0;margin-top:2px;letter-spacing:.5px}
  .task-body{flex:1;min-width:0}
  .task-title{font-size:13px;font-weight:600;color:var(--text);margin-bottom:3px}
  .task-desc{font-size:11px;color:var(--muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-bottom:4px}
  .task-meta{display:flex;gap:12px;font-size:10px;color:var(--muted)}
  .task-status{font-size:11px;font-weight:600;white-space:nowrap;flex-shrink:0;margin-top:2px}
  .task-acts{display:flex;gap:6px;flex-shrink:0}
  .act-btn{padding:5px 9px;border-radius:7px;border:1px solid;cursor:pointer;font-size:13px;transition:all .12s;background:none}
  .act-btn.edit{border-color:rgba(0,212,255,.25);color:var(--accent)}
  .act-btn.edit:hover{background:rgba(0,212,255,.1)}
  .act-btn.del{border-color:rgba(239,68,68,.25);color:var(--danger)}
  .act-btn.del:hover{background:rgba(239,68,68,.1)}
  .list-row{display:flex;align-items:center;gap:10px;padding:14px;background:var(--surface);border:1px solid var(--border);border-radius:10px;margin-bottom:8px}
  .card{background:var(--surface);border:1px solid var(--border);border-radius:14px;padding:22px}
  .card-title{font-family:'Syne',sans-serif;font-size:15px;font-weight:700;color:var(--text);margin-bottom:14px;display:flex;align-items:center;gap:8px}
  .field-label{font-size:11px;color:var(--muted);display:block;margin-bottom:4px;letter-spacing:.5px;text-transform:uppercase}
  .field-input{width:100%;background:var(--surface2);border:1px solid var(--border);border-radius:8px;padding:10px 12px;font-family:'DM Mono',monospace;font-size:13px;color:var(--text);outline:none;transition:border-color .18s}
  .field-input:focus{border-color:var(--accent)}
  .modal-bg{position:fixed;inset:0;background:rgba(0,0,0,.78);z-index:500;display:flex;align-items:center;justify-content:center;padding:20px;overflow-y:auto}
  .modal-box{background:var(--surface);border:1px solid var(--border);border-radius:16px;width:100%;max-width:500px;padding:24px;box-shadow:0 8px 48px rgba(0,0,0,.6);max-height:90vh;overflow-y:auto}
  .modal-hdr{display:flex;align-items:center;justify-content:space-between;margin-bottom:18px}
  .modal-hdr h3{font-family:'Syne',sans-serif;font-size:15px;font-weight:700;color:var(--accent)}
  .modal-close{background:none;border:none;color:var(--muted);font-size:20px;cursor:pointer}
  .modal-foot{display:flex;gap:10px;justify-content:flex-end;margin-top:16px}
  @media(max-width:640px){.section-hdr{flex-direction:column;align-items:flex-start}}
`
