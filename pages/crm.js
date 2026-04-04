// pages/crm.js — CRM Vivanexa com Funil de Vendas Kanban
import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/router'
import { supabase } from '../lib/supabase'

const ETAPAS_PADRAO = [
  { id: 'lead',               label: 'Lead',                 cor: '#64748b' },
  { id: 'lead_qualificado',   label: 'Lead Qualificado',     cor: '#7c3aed' },
  { id: 'lead_marketing',     label: 'Lead Marketing',       cor: '#0099bb' },
  { id: 'reuniao_agendada',   label: 'Reunião Agendada',     cor: '#00d4ff' },
  { id: 'queda_agenda',       label: 'Queda de Agenda',      cor: '#f59e0b' },
  { id: 'atendimento',        label: 'Atendimento Realizado', cor: '#10b981' },
  { id: 'proposta_enviada',   label: 'Proposta Enviada',     cor: '#8b5cf6' },
  { id: 'fechamento',         label: 'Fechamento de Contrato', cor: '#059669' },
  { id: 'perdido',            label: 'Perdido',              cor: '#ef4444' },
]

const EMPTY_NEGOCIO = {
  id: '', titulo: '', etapa: 'lead',
  nome: '', fantasia: '', cnpj: '', cpf: '', email: '', telefone: '',
  endereco: '', cidade: '', uf: '', responsavel: '',
  adesao: '', mensalidade: '', modulos: '',
  observacoes: '', origem: 'manual', criadoEm: '', atualizadoEm: ''
}

function fmt(n) {
  if (!n && n !== 0) return '—'
  return 'R$ ' + Number(n).toLocaleString('pt-BR', { minimumFractionDigits: 2 })
}
function fmtDoc(s) {
  if (!s) return ''
  const d = s.replace(/\D/g, '')
  if (d.length === 14) return d.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5')
  if (d.length === 11) return d.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, '$1.$2.$3-$4')
  return s
}

async function fetchCNPJDados(cnpj) {
  try {
    const r = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cnpj.replace(/\D/g, '')}`)
    if (!r.ok) return null
    const d = await r.json()
    const f = (d.ddd_telefone_1 || '').replace(/\D/g, '')
    return {
      nome: d.razao_social || '',
      fantasia: d.nome_fantasia || d.razao_social || '',
      email: d.email || '',
      telefone: f.length >= 10 ? `(${f.slice(0,2)}) ${f.slice(2)}` : '',
      cidade: d.municipio || '',
      uf: d.uf || '',
      endereco: [d.descricao_tipo_logradouro, d.logradouro, d.numero, d.bairro].filter(Boolean).join(' '),
    }
  } catch { return null }
}

export default function CRM() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [cfg, setCfg] = useState({})
  const [empresaId, setEmpresaId] = useState(null)
  const [perfil, setPerfil] = useState(null)
  const [negocios, setNegocios] = useState([])
  const [etapas, setEtapas] = useState(ETAPAS_PADRAO)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ ...EMPTY_NEGOCIO })
  const [busca, setBusca] = useState('')
  const [buscandoCNPJ, setBuscandoCNPJ] = useState(false)
  const [saving, setSaving] = useState(false)
  const [dragging, setDragging] = useState(null)
  const [dragOver, setDragOver] = useState(null)
  const [msgSucesso, setMsgSucesso] = useState('')
  const dragNode = useRef(null)

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
        setNegocios(c.crm_negocios || [])
        if (c.crm_etapas?.length) setEtapas(c.crm_etapas)
      }
      setLoading(false)
    }
    init()
  }, [router])

  async function salvarStorage(novoCfg) {
    await supabase.from('vx_storage').upsert({ key: `cfg:${empresaId}`, value: JSON.stringify(novoCfg), updated_at: new Date().toISOString() }, { onConflict: 'key' })
  }

  async function salvarNegocio() {
    if (!form.titulo.trim()) { alert('Informe o título do negócio.'); return }
    setSaving(true)
    const agora = new Date().toISOString()
    const novo = {
      ...form,
      id: form.id || 'neg_' + Date.now(),
      criadoEm: form.criadoEm || agora,
      atualizadoEm: agora,
    }
    const lista = form.id ? negocios.map(n => n.id === form.id ? novo : n) : [...negocios, novo]
    const novoCfg = { ...cfg, crm_negocios: lista }
    await salvarStorage(novoCfg)
    setNegocios(lista); setCfg(novoCfg)
    setShowForm(false); setForm({ ...EMPTY_NEGOCIO })
    setSaving(false)
    toast('✅ Negócio salvo!')
  }

  async function excluirNegocio(id) {
    if (!confirm('Excluir este negócio?')) return
    const lista = negocios.filter(n => n.id !== id)
    const novoCfg = { ...cfg, crm_negocios: lista }
    await salvarStorage(novoCfg)
    setNegocios(lista); setCfg(novoCfg)
    toast('🗑 Negócio removido!')
  }

  async function moverEtapa(negId, novaEtapa) {
    const lista = negocios.map(n => n.id === negId ? { ...n, etapa: novaEtapa, atualizadoEm: new Date().toISOString() } : n)
    const novoCfg = { ...cfg, crm_negocios: lista }
    await salvarStorage(novoCfg)
    setNegocios(lista); setCfg(novoCfg)
  }

  async function buscarCNPJ() {
    const cnpj = form.cnpj.replace(/\D/g, '')
    if (cnpj.length !== 14) { alert('CNPJ inválido.'); return }
    setBuscandoCNPJ(true)
    const dados = await fetchCNPJDados(cnpj)
    if (dados) {
      setForm(f => ({ ...f, nome: dados.nome, fantasia: dados.fantasia, email: dados.email || f.email, telefone: dados.telefone || f.telefone, cidade: dados.cidade, uf: dados.uf, endereco: dados.endereco }))
      toast('✅ Dados do CNPJ carregados!')
    } else {
      alert('CNPJ não encontrado na base pública.')
    }
    setBuscandoCNPJ(false)
  }

  function toast(msg) {
    setMsgSucesso(msg)
    setTimeout(() => setMsgSucesso(''), 3000)
  }

  // Drag and Drop
  function onDragStart(e, neg) {
    setDragging(neg.id)
    dragNode.current = e.target
    setTimeout(() => { if (dragNode.current) dragNode.current.style.opacity = '0.4' }, 0)
  }
  function onDragEnd() {
    if (dragNode.current) dragNode.current.style.opacity = '1'
    setDragging(null); setDragOver(null)
  }
  function onDragOver(e, etapaId) {
    e.preventDefault()
    setDragOver(etapaId)
  }
  function onDrop(e, etapaId) {
    e.preventDefault()
    if (dragging && dragging !== etapaId) {
      moverEtapa(dragging, etapaId)
    }
    setDragging(null); setDragOver(null)
  }

  const negFiltrados = busca.trim()
    ? negocios.filter(n => n.titulo?.toLowerCase().includes(busca.toLowerCase()) || n.nome?.toLowerCase().includes(busca.toLowerCase()) || n.cnpj?.includes(busca) || n.email?.toLowerCase().includes(busca.toLowerCase()))
    : negocios

  const logoSrc = cfg.logob64 ? (cfg.logob64.startsWith('data:') ? cfg.logob64 : `data:image/png;base64,${cfg.logob64}`) : null

  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0a0f1e', color: '#64748b', fontFamily: 'DM Mono, monospace' }}>
      Carregando CRM...
    </div>
  )

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=DM+Mono:wght@300;400;500&display=swap');
        :root{--bg:#0a0f1e;--surface:#111827;--surface2:#1a2540;--border:#1e2d4a;--accent:#00d4ff;--accent2:#7c3aed;--accent3:#10b981;--text:#e2e8f0;--muted:#64748b;--danger:#ef4444;--warning:#f59e0b;--gold:#fbbf24}
        *{box-sizing:border-box;margin:0;padding:0}
        body{font-family:'DM Mono',monospace;background:var(--bg);color:var(--text);min-height:100vh}
        ::-webkit-scrollbar{width:4px;height:4px}::-webkit-scrollbar-thumb{background:var(--border);border-radius:4px}
        .kanban-col{min-width:230px;width:230px;flex-shrink:0}
        .neg-card{background:var(--surface);border:1px solid var(--border);border-radius:10px;padding:12px 14px;margin-bottom:8px;cursor:grab;transition:box-shadow .2s,border-color .2s}
        .neg-card:hover{box-shadow:0 4px 16px rgba(0,0,0,.3);border-color:rgba(0,212,255,.25)}
        .neg-card:active{cursor:grabbing}
        .col-drop-active{background:rgba(0,212,255,.04);border:1px dashed rgba(0,212,255,.3)!important}
        input:focus,textarea:focus,select:focus{border-color:var(--accent)!important;outline:none}
      `}</style>

      {/* Toast */}
      {msgSucesso && (
        <div style={{ position: 'fixed', bottom: 30, left: '50%', transform: 'translateX(-50%)', background: 'rgba(16,185,129,.9)', color: '#fff', padding: '12px 24px', borderRadius: 10, fontFamily: 'DM Mono', fontSize: 14, zIndex: 9999, boxShadow: '0 4px 20px rgba(0,0,0,.3)' }}>
          {msgSucesso}
        </div>
      )}

      {/* Header */}
      <header style={{ position: 'sticky', top: 0, zIndex: 100, background: 'rgba(10,15,30,.95)', backdropFilter: 'blur(12px)', borderBottom: '1px solid var(--border)', padding: '10px 20px', display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }} onClick={() => router.push('/chat')}>
          {logoSrc ? <img src={logoSrc} alt="" style={{ height: 32, objectFit: 'contain', borderRadius: 6 }} onError={e => e.target.style.display = 'none'} />
            : <span style={{ fontFamily: 'Syne,sans-serif', fontSize: 15, fontWeight: 700 }}>{cfg.company || 'Vivanexa'}</span>}
        </div>
        <span style={{ fontSize: 13, color: 'var(--accent)', fontFamily: 'Syne,sans-serif', fontWeight: 700 }}>🎯 CRM</span>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
          <button onClick={() => router.push('/chat')} style={navBtn}>💬 Chat</button>
          <button onClick={() => router.push('/reports')} style={navBtn}>📈 Relatórios</button>
          <button onClick={() => router.push('/configuracoes')} style={navBtn}>⚙️</button>
          {perfil?.nome && <span style={{ fontSize: 11, color: 'var(--muted)' }}>👤 <span style={{ color: 'var(--text)' }}>{perfil.nome}</span></span>}
          <button onClick={() => supabase.auth.signOut().then(() => router.push('/'))} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', fontSize: 11, fontFamily: 'DM Mono,monospace' }}>Sair</button>
        </div>
      </header>

      <main style={{ padding: '20px 20px 60px' }}>
        {/* Barra de ações */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 20, alignItems: 'center', flexWrap: 'wrap' }}>
          <h2 style={{ fontFamily: 'Syne,sans-serif', fontSize: 18, fontWeight: 700, color: 'var(--text)' }}>Funil de Vendas</h2>
          <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="🔍 Buscar negócio, cliente, CNPJ..." style={{ flex: 1, minWidth: 200, background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 12px', fontFamily: 'DM Mono,monospace', fontSize: 12, color: 'var(--text)', outline: 'none' }} />
          <button onClick={() => { setForm({ ...EMPTY_NEGOCIO, etapa: 'lead' }); setShowForm(true) }}
            style={{ padding: '9px 18px', borderRadius: 9, background: 'linear-gradient(135deg,var(--accent),#0099bb)', border: 'none', color: '#fff', fontFamily: 'DM Mono,monospace', fontSize: 13, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}>
            + Novo Negócio
          </button>
        </div>

        {/* Totalizadores */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
          {[
            { label: 'Total Negócios', val: negocios.length, cor: 'var(--accent)' },
            { label: 'Propostas', val: negocios.filter(n => n.etapa === 'proposta_enviada').length, cor: 'var(--accent2)' },
            { label: 'Fechamentos', val: negocios.filter(n => n.etapa === 'fechamento').length, cor: 'var(--accent3)' },
            { label: 'Adesão Total', val: fmt(negocios.filter(n => n.etapa === 'fechamento').reduce((a, n) => a + (Number(n.adesao) || 0), 0)), cor: 'var(--gold)' },
            { label: 'Mensal Total', val: fmt(negocios.filter(n => n.etapa === 'fechamento').reduce((a, n) => a + (Number(n.mensalidade) || 0), 0)), cor: 'var(--accent3)' },
          ].map(c => (
            <div key={c.label} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '10px 16px', minWidth: 130 }}>
              <div style={{ fontSize: 10, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>{c.label}</div>
              <div style={{ fontFamily: 'Syne,sans-serif', fontSize: 17, fontWeight: 800, color: c.cor }}>{c.val}</div>
            </div>
          ))}
        </div>

        {/* Kanban */}
        <div style={{ display: 'flex', gap: 12, overflowX: 'auto', paddingBottom: 20, alignItems: 'flex-start' }}>
          {etapas.map(etapa => {
            const cards = negFiltrados.filter(n => n.etapa === etapa.id)
            const isDragOver = dragOver === etapa.id
            return (
              <div key={etapa.id} className="kanban-col"
                onDragOver={e => onDragOver(e, etapa.id)}
                onDrop={e => onDrop(e, etapa.id)}>
                {/* Cabeçalho da coluna */}
                <div style={{ padding: '8px 12px', borderRadius: 8, marginBottom: 8, background: isDragOver ? 'rgba(0,212,255,.08)' : 'var(--surface2)', border: `1px solid ${isDragOver ? 'rgba(0,212,255,.3)' : 'var(--border)'}`, transition: 'all .2s' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <div style={{ width: 8, height: 8, borderRadius: 2, background: etapa.cor, flexShrink: 0 }} />
                    <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text)', flex: 1 }}>{etapa.label}</span>
                    <span style={{ fontSize: 11, background: 'rgba(0,212,255,.1)', color: 'var(--accent)', borderRadius: 10, padding: '1px 7px', fontWeight: 700 }}>{cards.length}</span>
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 3 }}>
                    {fmt(cards.reduce((a, n) => a + (Number(n.adesao) || 0), 0))}
                  </div>
                </div>

                {/* Cards */}
                <div className={isDragOver ? 'col-drop-active' : ''} style={{ minHeight: 80, borderRadius: 8, padding: isDragOver ? 4 : 0, transition: 'all .2s' }}>
                  {cards.map(neg => (
                    <div key={neg.id} className="neg-card"
                      draggable
                      onDragStart={e => onDragStart(e, neg)}
                      onDragEnd={onDragEnd}>
                      <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--text)', marginBottom: 4, lineHeight: 1.3 }}>{neg.titulo || neg.nome || 'Sem título'}</div>
                      {neg.nome && neg.titulo !== neg.nome && <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 4 }}>{neg.nome}</div>}
                      {neg.cnpj && <div style={{ fontSize: 10, color: 'var(--muted)' }}>{fmtDoc(neg.cnpj)}</div>}
                      {neg.adesao && <div style={{ fontSize: 11, color: 'var(--gold)', marginTop: 4 }}>Ad: {fmt(neg.adesao)}</div>}
                      {neg.mensalidade && <div style={{ fontSize: 11, color: 'var(--accent3)' }}>Men: {fmt(neg.mensalidade)}</div>}
                      {neg.modulos && <div style={{ fontSize: 10, color: 'var(--accent)', marginTop: 4, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{neg.modulos}</div>}
                      <div style={{ display: 'flex', gap: 4, marginTop: 8 }}>
                        <button onClick={() => { setForm({ ...EMPTY_NEGOCIO, ...neg }); setShowForm(true) }}
                          style={{ flex: 1, padding: '4px 0', borderRadius: 6, background: 'rgba(0,212,255,.08)', border: '1px solid rgba(0,212,255,.2)', color: 'var(--accent)', fontSize: 11, cursor: 'pointer', fontFamily: 'DM Mono,monospace' }}>✏️ Editar</button>
                        <button onClick={() => excluirNegocio(neg.id)}
                          style={{ padding: '4px 8px', borderRadius: 6, background: 'rgba(239,68,68,.08)', border: '1px solid rgba(239,68,68,.2)', color: 'var(--danger)', fontSize: 11, cursor: 'pointer' }}>🗑</button>
                      </div>
                    </div>
                  ))}
                  {cards.length === 0 && (
                    <div style={{ fontSize: 11, color: 'var(--muted)', textAlign: 'center', padding: '20px 0', borderRadius: 8, border: '1px dashed rgba(100,116,139,.2)' }}>
                      Arraste aqui
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </main>

      {/* Modal Formulário */}
      {showForm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.75)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, overflowY: 'auto' }}>
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, width: '100%', maxWidth: 620, boxShadow: '0 8px 40px rgba(0,0,0,.5)', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '20px 24px 0', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <h3 style={{ fontFamily: 'Syne,sans-serif', fontSize: 16, fontWeight: 700, color: 'var(--accent)' }}>
                {form.id ? '✏️ Editar Negócio' : '➕ Novo Negócio'}
              </h3>
              <button onClick={() => setShowForm(false)} style={{ background: 'none', border: 'none', color: 'var(--muted)', fontSize: 20, cursor: 'pointer', lineHeight: 1 }}>✕</button>
            </div>
            <div style={{ padding: '16px 24px', overflowY: 'auto', flex: 1 }}>
              {/* CNPJ com busca automática */}
              <div style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 10, padding: 14, marginBottom: 14 }}>
                <div style={{ fontSize: 11, color: 'var(--accent)', marginBottom: 8, fontWeight: 600, letterSpacing: 1, textTransform: 'uppercase' }}>🔍 Buscar por CNPJ</div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input value={form.cnpj} onChange={e => setForm(f => ({ ...f, cnpj: e.target.value }))}
                    placeholder="00.000.000/0001-00"
                    style={inp} />
                  <button onClick={buscarCNPJ} disabled={buscandoCNPJ}
                    style={{ padding: '9px 14px', borderRadius: 8, background: 'rgba(0,212,255,.15)', border: '1px solid rgba(0,212,255,.3)', color: 'var(--accent)', fontSize: 12, cursor: 'pointer', whiteSpace: 'nowrap', fontFamily: 'DM Mono,monospace' }}>
                    {buscandoCNPJ ? '⏳...' : '🔍 Buscar'}
                  </button>
                </div>
              </div>

              <Fld label="Título do Negócio *"><input value={form.titulo} onChange={e => setForm(f => ({ ...f, titulo: e.target.value }))} placeholder="Ex: Escritório Silva — Gestão Fiscal" style={inp} /></Fld>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <Fld label="Razão Social"><input value={form.nome} onChange={e => setForm(f => ({ ...f, nome: e.target.value }))} style={inp} /></Fld>
                <Fld label="Nome Fantasia"><input value={form.fantasia} onChange={e => setForm(f => ({ ...f, fantasia: e.target.value }))} style={inp} /></Fld>
                <Fld label="E-mail"><input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} style={inp} /></Fld>
                <Fld label="Telefone"><input value={form.telefone} onChange={e => setForm(f => ({ ...f, telefone: e.target.value }))} style={inp} /></Fld>
                <Fld label="CPF"><input value={form.cpf} onChange={e => setForm(f => ({ ...f, cpf: e.target.value }))} style={inp} /></Fld>
                <Fld label="Responsável"><input value={form.responsavel} onChange={e => setForm(f => ({ ...f, responsavel: e.target.value }))} style={inp} /></Fld>
                <Fld label="Cidade"><input value={form.cidade} onChange={e => setForm(f => ({ ...f, cidade: e.target.value }))} style={inp} /></Fld>
                <Fld label="UF"><input value={form.uf} onChange={e => setForm(f => ({ ...f, uf: e.target.value }))} maxLength={2} style={inp} /></Fld>
              </div>
              <Fld label="Endereço"><input value={form.endereco} onChange={e => setForm(f => ({ ...f, endereco: e.target.value }))} style={inp} /></Fld>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                <Fld label="Adesão (R$)"><input type="number" value={form.adesao} onChange={e => setForm(f => ({ ...f, adesao: e.target.value }))} style={inp} /></Fld>
                <Fld label="Mensalidade (R$)"><input type="number" value={form.mensalidade} onChange={e => setForm(f => ({ ...f, mensalidade: e.target.value }))} style={inp} /></Fld>
                <Fld label="Etapa">
                  <select value={form.etapa} onChange={e => setForm(f => ({ ...f, etapa: e.target.value }))} style={{ ...inp, cursor: 'pointer' }}>
                    {etapas.map(e => <option key={e.id} value={e.id}>{e.label}</option>)}
                  </select>
                </Fld>
              </div>
              <Fld label="Módulos / Produtos"><input value={form.modulos} onChange={e => setForm(f => ({ ...f, modulos: e.target.value }))} placeholder="Ex: Gestão Fiscal, BIA, CND" style={inp} /></Fld>
              <Fld label="Observações">
                <textarea value={form.observacoes} onChange={e => setForm(f => ({ ...f, observacoes: e.target.value }))} rows={3} style={{ ...inp, resize: 'vertical' }} />
              </Fld>
            </div>
            <div style={{ padding: '16px 24px', borderTop: '1px solid var(--border)', display: 'flex', gap: 10, justifyContent: 'flex-end', flexShrink: 0 }}>
              <button onClick={() => setShowForm(false)} style={{ padding: '10px 18px', borderRadius: 10, background: 'rgba(100,116,139,.12)', border: '1px solid var(--border)', color: 'var(--muted)', fontFamily: 'DM Mono,monospace', fontSize: 13, cursor: 'pointer' }}>Cancelar</button>
              <button onClick={salvarNegocio} disabled={saving} style={{ padding: '10px 22px', borderRadius: 10, background: 'linear-gradient(135deg,var(--accent),#0099bb)', border: 'none', color: '#fff', fontFamily: 'DM Mono,monospace', fontSize: 13, fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer' }}>
                {saving ? '⏳ Salvando...' : '✅ Salvar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

function Fld({ label, children }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <label style={{ fontSize: 11, color: 'var(--muted)', display: 'block', marginBottom: 4, letterSpacing: '.5px' }}>{label}</label>
      {children}
    </div>
  )
}

const inp = { width: '100%', background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 8, padding: '9px 12px', fontFamily: 'DM Mono,monospace', fontSize: 13, color: 'var(--text)', outline: 'none' }
const navBtn = { background: 'var(--surface2)', border: '1px solid var(--border)', cursor: 'pointer', color: 'var(--muted)', fontSize: 11, padding: '5px 11px', borderRadius: 8, fontFamily: 'DM Mono,monospace' }

export async function getServerSideProps() { return { props: {} } }
