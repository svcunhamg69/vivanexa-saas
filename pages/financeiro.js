// pages/financeiro.js — Financeiro Vivanexa v2 (com Comissões)
import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import { supabase } from '../lib/supabase'
import Navbar from '../components/Navbar'

const ABAS = [
  { id: 'contas',     label: '💳 Contas a Pagar e Receber' },
  { id: 'nfe',        label: '🧾 Emissão de Nota Fiscal' },
  { id: 'pagamentos', label: '💰 Pagamentos' },
  { id: 'comissoes',  label: '🏆 Comissões' },
]

const CATEGORIAS   = ['Receita', 'Despesa', 'Transferência']
const STATUS_CONTA = ['Pendente', 'Pago', 'Vencido', 'Cancelado']
const EMPTY_CONTA  = { id:'', descricao:'', tipo:'Receita', valor:'', vencimento:'', status:'Pendente', categoria:'', observacoes:'', criadoEm:'' }
const EMPTY_NF     = { id:'', numero:'', tomador:'', cnpjTomador:'', servico:'', valor:'', competencia:'', status:'Emitida', descricao:'', criadoEm:'' }
const EMPTY_PGTO   = { id:'', descricao:'', favorecido:'', valor:'', dataEmissao:'', dataPagamento:'', formaPagamento:'PIX', status:'Pendente', banco:'', agencia:'', conta:'', pix:'', observacoes:'', criadoEm:'' }

function fmt(n)     { return 'R$ ' + Number(n||0).toLocaleString('pt-BR', { minimumFractionDigits: 2 }) }
function fmtDate(s) { if (!s) return '—'; try { return new Date(s+'T12:00:00').toLocaleDateString('pt-BR') } catch { return s } }
const mesAtual = () => new Date().toISOString().slice(0,7)

export default function Financeiro() {
  const router = useRouter()
  const { aba: abaQuery } = router.query

  const [loading,     setLoading]     = useState(true)
  const [cfg,         setCfg]         = useState({})
  const [empresaId,   setEmpresaId]   = useState(null)
  const [perfil,      setPerfil]      = useState(null)
  const [aba,         setAba]         = useState('contas')
  const [saving,      setSaving]      = useState(false)
  const [msgSucesso,  setMsgSucesso]  = useState('')

  // Contas
  const [contas,         setContas]         = useState([])
  const [showFormConta,  setShowFormConta]  = useState(false)
  const [formConta,      setFormConta]      = useState({ ...EMPTY_CONTA })
  const [filtroTipo,     setFiltroTipo]     = useState('Todos')
  const [filtroStatus,   setFiltroStatus]   = useState('Todos')

  // NF
  const [notas,          setNotas]          = useState([])
  const [showFormNf,     setShowFormNf]     = useState(false)
  const [formNf,         setFormNf]         = useState({ ...EMPTY_NF })

  // Pagamentos
  const [pagamentos,     setPagamentos]     = useState([])
  const [showFormPgto,   setShowFormPgto]   = useState(false)
  const [formPgto,       setFormPgto]       = useState({ ...EMPTY_PGTO })

  // Comissões
  const [mesFiltroComissao, setMesFiltroComissao] = useState(mesAtual())
  const [userFiltroComissao, setUserFiltroComissao] = useState('todos')

  useEffect(() => { if (abaQuery) setAba(abaQuery) }, [abaQuery])

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
        setContas(c.fin_contas || [])
        setNotas(c.fin_notas || [])
        setPagamentos(c.fin_pagamentos || [])
      }
      setLoading(false)
    }
    init()
  }, [router])

  async function salvarStorage(novoCfg) {
    await supabase.from('vx_storage').upsert({ key: `cfg:${empresaId}`, value: JSON.stringify(novoCfg), updated_at: new Date().toISOString() }, { onConflict: 'key' })
  }

  function toast(msg) { setMsgSucesso(msg); setTimeout(() => setMsgSucesso(''), 3000) }

  // ─── Visibilidade por perfil ─────────────────────────
  const isGestor = perfil?.perfil === 'admin' || perfil?.perfil === 'gestor' || perfil?.tipo === 'admin' || perfil?.tipo === 'gestor'
  const userId   = perfil?.user_id || perfil?.id

  // ─── CONTAS ──────────────────────────────────────────
  async function salvarConta() {
    if (!formConta.descricao.trim() || !formConta.valor) { alert('Informe a descrição e o valor.'); return }
    setSaving(true)
    const nova = { ...formConta, id: formConta.id || 'ct_' + Date.now(), criadoEm: formConta.criadoEm || new Date().toISOString() }
    const lista = formConta.id ? contas.map(c => c.id === formConta.id ? nova : c) : [...contas, nova]
    const novoCfg = { ...cfg, fin_contas: lista }
    await salvarStorage(novoCfg)
    setContas(lista); setCfg(novoCfg); setShowFormConta(false); setFormConta({ ...EMPTY_CONTA }); setSaving(false)
    toast('✅ Conta salva!')
  }

  async function excluirConta(id) {
    if (!confirm('Excluir?')) return
    const lista = contas.filter(c => c.id !== id)
    const novoCfg = { ...cfg, fin_contas: lista }
    await salvarStorage(novoCfg); setContas(lista); setCfg(novoCfg); toast('🗑 Removido!')
  }

  async function marcarPago(ct) {
    const atualizado = { ...ct, status: ct.status === 'Pago' ? 'Pendente' : 'Pago' }
    const lista = contas.map(c => c.id === ct.id ? atualizado : c)
    const novoCfg = { ...cfg, fin_contas: lista }
    await salvarStorage(novoCfg); setContas(lista); setCfg(novoCfg)
  }

  const contasFiltradas = contas.filter(c => {
    if (filtroTipo !== 'Todos' && c.tipo !== filtroTipo) return false
    if (filtroStatus !== 'Todos' && c.status !== filtroStatus) return false
    return true
  })

  const totalReceber  = contas.filter(c => c.tipo==='Receita' && c.status!=='Pago' && c.status!=='Cancelado').reduce((a,c)=>a+Number(c.valor||0),0)
  const totalPagar    = contas.filter(c => c.tipo==='Despesa' && c.status!=='Pago' && c.status!=='Cancelado').reduce((a,c)=>a+Number(c.valor||0),0)
  const totalRecebido = contas.filter(c => c.tipo==='Receita' && c.status==='Pago').reduce((a,c)=>a+Number(c.valor||0),0)

  // ─── NOTAS FISCAIS ───────────────────────────────────
  async function salvarNf() {
    if (!formNf.tomador.trim()) { alert('Informe o tomador.'); return }
    setSaving(true)
    const nova = { ...formNf, id: formNf.id || 'nf_' + Date.now(), numero: formNf.numero || String(notas.length+1).padStart(5,'0'), criadoEm: formNf.criadoEm || new Date().toISOString() }
    const lista = formNf.id ? notas.map(n => n.id === formNf.id ? nova : n) : [...notas, nova]
    const novoCfg = { ...cfg, fin_notas: lista }
    await salvarStorage(novoCfg); setNotas(lista); setCfg(novoCfg); setShowFormNf(false); setFormNf({ ...EMPTY_NF }); setSaving(false)
    toast('✅ Nota salva!')
  }

  // ─── PAGAMENTOS ──────────────────────────────────────
  async function salvarPgto() {
    if (!formPgto.descricao.trim()) { alert('Informe a descrição.'); return }
    setSaving(true)
    const novo = { ...formPgto, id: formPgto.id || 'pg_' + Date.now(), criadoEm: formPgto.criadoEm || new Date().toISOString() }
    const lista = formPgto.id ? pagamentos.map(p => p.id === formPgto.id ? novo : p) : [...pagamentos, novo]
    const novoCfg = { ...cfg, fin_pagamentos: lista }
    await salvarStorage(novoCfg); setPagamentos(lista); setCfg(novoCfg); setShowFormPgto(false); setFormPgto({ ...EMPTY_PGTO }); setSaving(false)
    toast('✅ Pagamento salvo!')
  }

  // ─── COMISSÕES ───────────────────────────────────────
  // Busca contratos assinados / fechados no histórico e no CRM
  const historico    = cfg.historico       || []
  const crmNegocios  = cfg.crm_negocios    || []
  const usuarios     = cfg.users           || cfg.usuarios || []

  // Contratos do histórico com data
  const contratosHistorico = historico.map(h => ({
    id:            h.id || 'h_' + Math.random(),
    vendedorId:    h.userId || h.consultantId || '',
    vendedorNome:  h.consultor || h.userName || 'Desconhecido',
    clienteNome:   h.cliente || h.clienteNome || '—',
    valorAdesao:   Number(h.tAdD || h.adesao || 0),
    valorMensal:   Number(h.tMenD || h.mensalidade || 0),
    data:          h.date || h.criadoEm || '',
    origem:        'historico',
  }))

  // Contratos do CRM com status fechado
  const contratosCRM = crmNegocios
    .filter(n => n.etapa === 'fechamento' || n.status === 'fechado' || n.status === 'assinado')
    .map(n => ({
      id:           n.id,
      vendedorId:   n.userId || n.responsavelId || '',
      vendedorNome: n.responsavel || n.userName || 'Desconhecido',
      clienteNome:  n.empresa || n.cliente || n.nome || '—',
      valorAdesao:  Number(n.valorAdesao || n.adesao || 0),
      valorMensal:  Number(n.valorMensalidade || n.mensalidade || n.valor || 0),
      data:         n.dataFechamento || n.updatedAt || n.criadoEm || '',
      origem:       'crm',
    }))

  // Une e filtra por mês
  const todosContratos = [...contratosHistorico, ...contratosCRM]
    .filter(c => c.data && c.data.startsWith(mesFiltroComissao))

  // Função para calcular comissão de um vendedor
  function calcComissao(vendedorId, valorAdesao, valorMensal) {
    const user = usuarios.find(u => u.id === vendedorId || u.user_id === vendedorId)
    if (!user?.comissao) return { comAdesao: 0, comMensal: 0 }
    const { adesao, mensalidade } = user.comissao
    const comAdesao = adesao?.tipo === 'percentual'
      ? (valorAdesao * (Number(adesao.valor)||0)) / 100
      : Number(adesao?.valor || 0)
    const comMensal = mensalidade?.tipo === 'percentual'
      ? (valorMensal * (Number(mensalidade.valor)||0)) / 100
      : Number(mensalidade?.valor || 0)
    return { comAdesao, comMensal }
  }

  // Filtra contratos por usuário (vendedor vê só o dele, gestor/admin vê todos)
  const contratosFiltrados = todosContratos.filter(c => {
    if (!isGestor) {
      // vendedor só vê seus próprios
      const user = usuarios.find(u => u.email === perfil?.email || u.id === userId)
      return c.vendedorId === userId || c.vendedorId === user?.id || c.vendedorNome === (perfil?.nome || '')
    }
    if (userFiltroComissao !== 'todos') return c.vendedorId === userFiltroComissao || c.vendedorNome === userFiltroComissao
    return true
  })

  // Totais de comissão
  const totalComAdesao = contratosFiltrados.reduce((acc, c) => {
    const { comAdesao } = calcComissao(c.vendedorId, c.valorAdesao, c.valorMensal)
    return acc + comAdesao
  }, 0)
  const totalComMensal = contratosFiltrados.reduce((acc, c) => {
    const { comMensal } = calcComissao(c.vendedorId, c.valorAdesao, c.valorMensal)
    return acc + comMensal
  }, 0)

  // Resumo por vendedor (visão gestor)
  const resumoPorVendedor = {}
  contratosFiltrados.forEach(c => {
    const { comAdesao, comMensal } = calcComissao(c.vendedorId, c.valorAdesao, c.valorMensal)
    const key = c.vendedorNome || c.vendedorId
    if (!resumoPorVendedor[key]) resumoPorVendedor[key] = { nome: key, contratos: 0, comAdesao: 0, comMensal: 0, totalVenda: 0 }
    resumoPorVendedor[key].contratos++
    resumoPorVendedor[key].comAdesao  += comAdesao
    resumoPorVendedor[key].comMensal  += comMensal
    resumoPorVendedor[key].totalVenda += c.valorAdesao + c.valorMensal
  })

  if (loading) return (
    <div style={{ background:'#0a0f1e', minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', color:'#64748b', fontFamily:'DM Mono,monospace' }}>
      Carregando financeiro...
    </div>
  )

  return (
    <>
      <style>{CSS}</style>
      <link href="https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=DM+Mono:wght@400;500&display=swap" rel="stylesheet" />
      <Navbar cfg={cfg} perfil={perfil} />

      {msgSucesso && (
        <div style={{ position:'fixed', bottom:24, right:24, zIndex:999, background:'rgba(16,185,129,.9)', color:'#fff', padding:'12px 20px', borderRadius:10, fontFamily:'DM Mono,monospace', fontSize:13, boxShadow:'0 4px 20px rgba(0,0,0,.4)' }}>
          {msgSucesso}
        </div>
      )}

      <main style={{ maxWidth:1280, margin:'0 auto', padding:'24px 20px 60px', position:'relative', zIndex:1 }}>
        {/* Header */}
        <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:20, flexWrap:'wrap', gap:12 }}>
          <div>
            <h1 style={{ fontFamily:'Syne,sans-serif', fontSize:22, fontWeight:800, color:'#e2e8f0', marginBottom:4 }}>💰 Financeiro</h1>
            <p style={{ fontSize:12, color:'#64748b' }}>Gestão completa das finanças e comissões</p>
          </div>
        </div>

        {/* Abas */}
        <div style={{ display:'flex', gap:6, flexWrap:'wrap', marginBottom:24, borderBottom:'1px solid #1e2d4a', paddingBottom:12 }}>
          {ABAS.map(a => (
            <button key={a.id}
              onClick={() => { setAba(a.id); router.replace({ query: { aba: a.id } }, undefined, { shallow:true }) }}
              style={{ padding:'8px 14px', borderRadius:8, border:`1px solid ${aba===a.id?'rgba(0,212,255,.4)':'#1e2d4a'}`, background:aba===a.id?'rgba(0,212,255,.12)':'#1a2540', color:aba===a.id?'#00d4ff':'#64748b', fontFamily:'DM Mono,monospace', fontSize:11.5, cursor:'pointer', fontWeight:aba===a.id?600:400, whiteSpace:'nowrap' }}>
              {a.label}
            </button>
          ))}
        </div>

        {/* ══ CONTAS ══ */}
        {aba === 'contas' && (
          <div>
            {/* Cards resumo */}
            <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:14, marginBottom:22 }}>
              {[
                { label:'A Receber', valor:totalReceber, cor:'#10b981', icon:'💵' },
                { label:'A Pagar',   valor:totalPagar,   cor:'#ef4444', icon:'💸' },
                { label:'Recebido',  valor:totalRecebido, cor:'#00d4ff', icon:'✅' },
              ].map(c => (
                <div key={c.label} style={{ background:'#111827', border:`1px solid #1e2d4a`, borderRadius:13, padding:16, position:'relative', overflow:'hidden' }}>
                  <div style={{ position:'absolute', top:0, left:0, right:0, height:2, background:c.cor }} />
                  <div style={{ fontSize:18, marginBottom:6 }}>{c.icon}</div>
                  <div style={{ fontFamily:'Syne,sans-serif', fontSize:20, fontWeight:800, color:c.cor }}>{fmt(c.valor)}</div>
                  <div style={{ fontSize:10, color:'#94a3b8', textTransform:'uppercase', letterSpacing:.8 }}>{c.label}</div>
                </div>
              ))}
            </div>

            {/* Filtros */}
            <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginBottom:16, alignItems:'center' }}>
              <select value={filtroTipo} onChange={e => setFiltroTipo(e.target.value)} style={sel}>
                <option value="Todos">Todos os tipos</option>
                {CATEGORIAS.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              <select value={filtroStatus} onChange={e => setFiltroStatus(e.target.value)} style={sel}>
                <option value="Todos">Todos os status</option>
                {STATUS_CONTA.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
              <button onClick={() => { setFormConta({ ...EMPTY_CONTA }); setShowFormConta(true) }} style={btnPrimary}>+ Novo Lançamento</button>
            </div>

            {/* Tabela */}
            <div style={{ background:'#111827', border:'1px solid #1e2d4a', borderRadius:12, overflow:'hidden' }}>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 100px 100px 100px 80px 80px', gap:0, padding:'10px 16px', borderBottom:'1px solid #1e2d4a', fontSize:10, color:'#64748b', textTransform:'uppercase', letterSpacing:1 }}>
                <span>Descrição</span><span>Vencimento</span><span>Valor</span><span>Tipo</span><span>Status</span><span>Ações</span>
              </div>
              {contasFiltradas.length === 0
                ? <div style={{ padding:'30px', textAlign:'center', color:'#64748b', fontSize:13 }}>Nenhum lançamento encontrado</div>
                : contasFiltradas.map(c => {
                  const corStatus = c.status==='Pago'?'#10b981':c.status==='Vencido'?'#ef4444':c.status==='Cancelado'?'#64748b':'#f59e0b'
                  return (
                    <div key={c.id} style={{ display:'grid', gridTemplateColumns:'1fr 100px 100px 100px 80px 80px', gap:0, padding:'12px 16px', borderBottom:'1px solid #0f1929', alignItems:'center' }}
                      onMouseEnter={e=>e.currentTarget.style.background='rgba(255,255,255,.02)'}
                      onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                      <div>
                        <div style={{ fontSize:13, color:'#e2e8f0' }}>{c.descricao}</div>
                        {c.categoria && <div style={{ fontSize:10, color:'#64748b' }}>{c.categoria}</div>}
                      </div>
                      <span style={{ fontSize:12, color:'#94a3b8' }}>{fmtDate(c.vencimento)}</span>
                      <span style={{ fontSize:13, fontWeight:700, color:c.tipo==='Receita'?'#10b981':'#ef4444' }}>
                        {c.tipo==='Receita'?'+':'-'}{fmt(c.valor)}
                      </span>
                      <span style={{ fontSize:11, color:'#94a3b8' }}>{c.tipo}</span>
                      <span style={{ fontSize:10, padding:'3px 8px', borderRadius:5, background:corStatus+'15', color:corStatus, fontWeight:600 }}>{c.status}</span>
                      <div style={{ display:'flex', gap:4 }}>
                        <button onClick={() => marcarPago(c)} title={c.status==='Pago'?'Desfazer':'Marcar pago'} style={{ padding:'4px 6px', borderRadius:6, background:'rgba(16,185,129,.12)', border:'1px solid rgba(16,185,129,.2)', color:'#10b981', cursor:'pointer', fontSize:11 }}>✓</button>
                        <button onClick={() => { setFormConta({ ...c }); setShowFormConta(true) }} style={{ padding:'4px 6px', borderRadius:6, background:'rgba(0,212,255,.1)', border:'1px solid rgba(0,212,255,.2)', color:'#00d4ff', cursor:'pointer', fontSize:11 }}>✏</button>
                        <button onClick={() => excluirConta(c.id)} style={{ padding:'4px 6px', borderRadius:6, background:'rgba(239,68,68,.1)', border:'1px solid rgba(239,68,68,.2)', color:'#ef4444', cursor:'pointer', fontSize:11 }}>🗑</button>
                      </div>
                    </div>
                  )
                })
              }
            </div>
          </div>
        )}

        {/* ══ NOTA FISCAL ══ */}
        {aba === 'nfe' && (
          <div>
            <div style={{ display:'flex', justifyContent:'flex-end', marginBottom:16 }}>
              <button onClick={() => { setFormNf({ ...EMPTY_NF }); setShowFormNf(true) }} style={btnPrimary}>+ Nova Nota Fiscal</button>
            </div>
            <div style={{ background:'#111827', border:'1px solid #1e2d4a', borderRadius:12, overflow:'hidden' }}>
              <div style={{ display:'grid', gridTemplateColumns:'80px 1fr 1fr 100px 80px 60px', padding:'10px 16px', borderBottom:'1px solid #1e2d4a', fontSize:10, color:'#64748b', textTransform:'uppercase', letterSpacing:1 }}>
                <span>Nº</span><span>Tomador</span><span>Serviço</span><span>Valor</span><span>Status</span><span>Ações</span>
              </div>
              {notas.length === 0
                ? <div style={{ padding:'30px', textAlign:'center', color:'#64748b', fontSize:13 }}>Nenhuma nota fiscal emitida</div>
                : notas.map(n => (
                  <div key={n.id} style={{ display:'grid', gridTemplateColumns:'80px 1fr 1fr 100px 80px 60px', padding:'12px 16px', borderBottom:'1px solid #0f1929', alignItems:'center' }}
                    onMouseEnter={e=>e.currentTarget.style.background='rgba(255,255,255,.02)'}
                    onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                    <span style={{ fontSize:12, color:'#00d4ff', fontFamily:'monospace' }}>#{n.numero}</span>
                    <div>
                      <div style={{ fontSize:13, color:'#e2e8f0' }}>{n.tomador}</div>
                      <div style={{ fontSize:10, color:'#64748b' }}>{n.cnpjTomador}</div>
                    </div>
                    <span style={{ fontSize:12, color:'#94a3b8' }}>{n.servico || n.descricao}</span>
                    <span style={{ fontSize:13, fontWeight:700, color:'#10b981' }}>{fmt(n.valor)}</span>
                    <span style={{ fontSize:10, padding:'3px 8px', borderRadius:5, background:n.status==='Emitida'?'rgba(16,185,129,.12)':'rgba(239,68,68,.12)', color:n.status==='Emitida'?'#10b981':'#ef4444', fontWeight:600 }}>{n.status}</span>
                    <div style={{ display:'flex', gap:4 }}>
                      <button onClick={() => { setFormNf({...n}); setShowFormNf(true) }} style={{ padding:'4px 6px', borderRadius:6, background:'rgba(0,212,255,.1)', border:'1px solid rgba(0,212,255,.2)', color:'#00d4ff', cursor:'pointer', fontSize:11 }}>✏</button>
                    </div>
                  </div>
                ))
              }
            </div>
          </div>
        )}

        {/* ══ PAGAMENTOS ══ */}
        {aba === 'pagamentos' && (
          <div>
            <div style={{ display:'flex', justifyContent:'flex-end', marginBottom:16 }}>
              <button onClick={() => { setFormPgto({ ...EMPTY_PGTO }); setShowFormPgto(true) }} style={btnPrimary}>+ Novo Pagamento</button>
            </div>
            <div style={{ background:'#111827', border:'1px solid #1e2d4a', borderRadius:12, overflow:'hidden' }}>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 100px 100px 80px 60px', padding:'10px 16px', borderBottom:'1px solid #1e2d4a', fontSize:10, color:'#64748b', textTransform:'uppercase', letterSpacing:1 }}>
                <span>Descrição</span><span>Favorecido</span><span>Valor</span><span>Forma</span><span>Status</span><span>Ações</span>
              </div>
              {pagamentos.length === 0
                ? <div style={{ padding:'30px', textAlign:'center', color:'#64748b', fontSize:13 }}>Nenhum pagamento registrado</div>
                : pagamentos.map(p => (
                  <div key={p.id} style={{ display:'grid', gridTemplateColumns:'1fr 1fr 100px 100px 80px 60px', padding:'12px 16px', borderBottom:'1px solid #0f1929', alignItems:'center' }}
                    onMouseEnter={e=>e.currentTarget.style.background='rgba(255,255,255,.02)'}
                    onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                    <div>
                      <div style={{ fontSize:13, color:'#e2e8f0' }}>{p.descricao}</div>
                      <div style={{ fontSize:10, color:'#64748b' }}>{fmtDate(p.dataPagamento)}</div>
                    </div>
                    <span style={{ fontSize:12, color:'#94a3b8' }}>{p.favorecido}</span>
                    <span style={{ fontSize:13, fontWeight:700, color:'#ef4444' }}>{fmt(p.valor)}</span>
                    <span style={{ fontSize:11, color:'#94a3b8' }}>{p.formaPagamento}</span>
                    <span style={{ fontSize:10, padding:'3px 8px', borderRadius:5, background:p.status==='Pago'?'rgba(16,185,129,.12)':'rgba(245,158,11,.12)', color:p.status==='Pago'?'#10b981':'#f59e0b', fontWeight:600 }}>{p.status}</span>
                    <div style={{ display:'flex', gap:4 }}>
                      <button onClick={() => { setFormPgto({...p}); setShowFormPgto(true) }} style={{ padding:'4px 6px', borderRadius:6, background:'rgba(0,212,255,.1)', border:'1px solid rgba(0,212,255,.2)', color:'#00d4ff', cursor:'pointer', fontSize:11 }}>✏</button>
                    </div>
                  </div>
                ))
              }
            </div>
          </div>
        )}

        {/* ══ COMISSÕES ══ */}
        {aba === 'comissoes' && (
          <div>
            {/* Cabeçalho e filtros */}
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-end', flexWrap:'wrap', gap:12, marginBottom:20 }}>
              <div>
                <h2 style={{ fontFamily:'Syne,sans-serif', fontSize:18, fontWeight:800, color:'#e2e8f0', marginBottom:4 }}>🏆 Comissões por Período</h2>
                <p style={{ fontSize:12, color:'#64748b' }}>
                  {isGestor
                    ? 'Visão completa do time — contratos fechados geram comissões automáticas'
                    : 'Suas comissões com base nos contratos fechados'}
                </p>
              </div>
              <div style={{ display:'flex', gap:10, alignItems:'center', flexWrap:'wrap' }}>
                <div>
                  <label style={{ fontSize:10, color:'#64748b', display:'block', marginBottom:4 }}>MÊS</label>
                  <input type="month" value={mesFiltroComissao} onChange={e => setMesFiltroComissao(e.target.value)}
                    style={{ background:'#1a2540', border:'1px solid #1e2d4a', borderRadius:8, padding:'7px 10px', fontFamily:'DM Mono,monospace', fontSize:12, color:'#e2e8f0', outline:'none' }} />
                </div>
                {isGestor && (
                  <div>
                    <label style={{ fontSize:10, color:'#64748b', display:'block', marginBottom:4 }}>VENDEDOR</label>
                    <select value={userFiltroComissao} onChange={e => setUserFiltroComissao(e.target.value)} style={sel}>
                      <option value="todos">Todos</option>
                      {usuarios.map(u => <option key={u.id} value={u.id}>{u.nome}</option>)}
                    </select>
                  </div>
                )}
              </div>
            </div>

            {/* Cards resumo comissão */}
            <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:14, marginBottom:24 }}>
              {[
                { label:'Comissão de Adesão',       valor:totalComAdesao,               cor:'#00d4ff', icon:'📥', sub:`${contratosFiltrados.length} contratos` },
                { label:'Comissão de Mensalidade',  valor:totalComMensal,               cor:'#10b981', icon:'🔄', sub:'Recorrente' },
                { label:'Total de Comissões',        valor:totalComAdesao+totalComMensal, cor:'#7c3aed', icon:'🏆', sub:'Adesão + Mensalidade' },
              ].map(c => (
                <div key={c.label} style={{ background:'#111827', border:'1px solid #1e2d4a', borderRadius:13, padding:16, position:'relative', overflow:'hidden' }}>
                  <div style={{ position:'absolute', top:0, left:0, right:0, height:2, background:c.cor }} />
                  <div style={{ fontSize:18, marginBottom:6 }}>{c.icon}</div>
                  <div style={{ fontFamily:'Syne,sans-serif', fontSize:20, fontWeight:800, color:c.cor }}>{fmt(c.valor)}</div>
                  <div style={{ fontSize:10, color:'#e2e8f0', textTransform:'uppercase', letterSpacing:.8, marginBottom:2 }}>{c.label}</div>
                  <div style={{ fontSize:10, color:'#64748b' }}>{c.sub}</div>
                </div>
              ))}
            </div>

            {/* Aviso se usuário não tem comissão configurada */}
            {!isGestor && (() => {
              const userMatch = usuarios.find(u => u.email === perfil?.email || u.id === userId)
              if (userMatch && (!userMatch.comissao || (userMatch.comissao?.adesao?.valor === 0 && userMatch.comissao?.mensalidade?.valor === 0))) {
                return (
                  <div style={{ padding:'14px 18px', background:'rgba(245,158,11,.08)', border:'1px solid rgba(245,158,11,.25)', borderRadius:10, color:'#f59e0b', fontSize:13, marginBottom:16 }}>
                    ⚠️ Sua conta não possui comissão configurada. Solicite ao administrador que defina sua comissão em <strong>Configurações → Usuários</strong>.
                  </div>
                )
              }
              return null
            })()}

            {/* Resumo por vendedor (apenas gestor) */}
            {isGestor && Object.keys(resumoPorVendedor).length > 0 && (
              <div style={{ background:'#111827', border:'1px solid #1e2d4a', borderRadius:12, padding:20, marginBottom:22 }}>
                <div style={{ fontFamily:'Syne,sans-serif', fontSize:14, fontWeight:700, color:'#e2e8f0', marginBottom:16, display:'flex', alignItems:'center', gap:8 }}>
                  👥 Resumo por Vendedor
                </div>
                <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(260px,1fr))', gap:12 }}>
                  {Object.values(resumoPorVendedor).sort((a,b) => (b.comAdesao+b.comMensal)-(a.comAdesao+a.comMensal)).map(v => (
                    <div key={v.nome} style={{ background:'#1a2540', border:'1px solid #1e2d4a', borderRadius:10, padding:14 }}>
                      <div style={{ fontWeight:700, color:'#e2e8f0', fontSize:14, marginBottom:8 }}>{v.nome}</div>
                      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:6, fontSize:12 }}>
                        <div style={{ color:'#64748b' }}>Contratos</div><div style={{ color:'#00d4ff', fontWeight:700 }}>{v.contratos}</div>
                        <div style={{ color:'#64748b' }}>Com. Adesão</div><div style={{ color:'#10b981', fontWeight:700 }}>{fmt(v.comAdesao)}</div>
                        <div style={{ color:'#64748b' }}>Com. Mensal</div><div style={{ color:'#7c3aed', fontWeight:700 }}>{fmt(v.comMensal)}</div>
                        <div style={{ color:'#64748b' }}>Total</div><div style={{ color:'#f59e0b', fontWeight:700 }}>{fmt(v.comAdesao+v.comMensal)}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Tabela detalhada de contratos */}
            <div style={{ background:'#111827', border:'1px solid #1e2d4a', borderRadius:12, overflow:'hidden' }}>
              <div style={{ fontFamily:'Syne,sans-serif', fontSize:14, fontWeight:700, color:'#e2e8f0', padding:'16px 20px', borderBottom:'1px solid #1e2d4a', display:'flex', alignItems:'center', gap:8 }}>
                📋 Contratos Fechados — {new Date(mesFiltroComissao+'-01').toLocaleDateString('pt-BR',{month:'long',year:'numeric'})}
              </div>
              {/* Cabeçalho tabela */}
              <div style={{ display:'grid', gridTemplateColumns:isGestor?'1fr 120px 90px 90px 90px 90px':'1fr 90px 90px 90px 90px', padding:'10px 16px', borderBottom:'1px solid #1e2d4a', fontSize:10, color:'#64748b', textTransform:'uppercase', letterSpacing:1 }}>
                <span>Cliente</span>
                {isGestor && <span>Vendedor</span>}
                <span>Adesão</span>
                <span>Mensalidade</span>
                <span>Com. Adesão</span>
                <span>Com. Mensal</span>
              </div>
              {contratosFiltrados.length === 0
                ? (
                  <div style={{ padding:'40px', textAlign:'center' }}>
                    <div style={{ fontSize:32, marginBottom:10 }}>📭</div>
                    <div style={{ color:'#64748b', fontSize:13 }}>
                      Nenhum contrato encontrado em {new Date(mesFiltroComissao+'-01').toLocaleDateString('pt-BR',{month:'long',year:'numeric'})}
                    </div>
                    <div style={{ color:'#475569', fontSize:11, marginTop:6 }}>
                      Os contratos são gerados a partir do histórico de vendas e do CRM (negócios com status "Fechamento").
                    </div>
                  </div>
                )
                : contratosFiltrados.map(c => {
                  const { comAdesao, comMensal } = calcComissao(c.vendedorId, c.valorAdesao, c.valorMensal)
                  return (
                    <div key={c.id} style={{ display:'grid', gridTemplateColumns:isGestor?'1fr 120px 90px 90px 90px 90px':'1fr 90px 90px 90px 90px', padding:'12px 16px', borderBottom:'1px solid #0f1929', alignItems:'center' }}
                      onMouseEnter={e=>e.currentTarget.style.background='rgba(255,255,255,.02)'}
                      onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                      <div>
                        <div style={{ fontSize:13, color:'#e2e8f0' }}>{c.clienteNome}</div>
                        <div style={{ fontSize:10, color:'#64748b' }}>{fmtDate(c.data)} · {c.origem === 'crm' ? '🤝 CRM' : '📝 Histórico'}</div>
                      </div>
                      {isGestor && <span style={{ fontSize:12, color:'#94a3b8' }}>{c.vendedorNome}</span>}
                      <span style={{ fontSize:12, color:'#00d4ff' }}>{fmt(c.valorAdesao)}</span>
                      <span style={{ fontSize:12, color:'#10b981' }}>{fmt(c.valorMensal)}</span>
                      <span style={{ fontSize:13, fontWeight:700, color:comAdesao>0?'#f59e0b':'#475569' }}>{fmt(comAdesao)}</span>
                      <span style={{ fontSize:13, fontWeight:700, color:comMensal>0?'#7c3aed':'#475569' }}>{fmt(comMensal)}</span>
                    </div>
                  )
                })
              }
              {/* Totais */}
              {contratosFiltrados.length > 0 && (
                <div style={{ display:'grid', gridTemplateColumns:isGestor?'1fr 120px 90px 90px 90px 90px':'1fr 90px 90px 90px 90px', padding:'12px 16px', background:'rgba(0,212,255,.04)', borderTop:'1px solid rgba(0,212,255,.15)', alignItems:'center' }}>
                  <span style={{ fontSize:11, fontWeight:700, color:'#64748b', textTransform:'uppercase', letterSpacing:1 }}>TOTAL</span>
                  {isGestor && <span />}
                  <span style={{ fontSize:12, fontWeight:700, color:'#00d4ff' }}>{fmt(contratosFiltrados.reduce((a,c)=>a+c.valorAdesao,0))}</span>
                  <span style={{ fontSize:12, fontWeight:700, color:'#10b981' }}>{fmt(contratosFiltrados.reduce((a,c)=>a+c.valorMensal,0))}</span>
                  <span style={{ fontSize:13, fontWeight:800, color:'#f59e0b' }}>{fmt(totalComAdesao)}</span>
                  <span style={{ fontSize:13, fontWeight:800, color:'#7c3aed' }}>{fmt(totalComMensal)}</span>
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      {/* ══ MODAIS ══ */}

      {/* Modal Conta */}
      {showFormConta && (
        <Modal titulo={formConta.id ? 'Editar Lançamento' : 'Novo Lançamento'} onClose={() => setShowFormConta(false)}>
          {[['Descrição *','descricao','text'],['Valor (R$)','valor','number'],['Vencimento','vencimento','date'],['Categoria','categoria','text']].map(([l,k,t]) => (
            <Fld key={k} label={l}><input type={t} value={formConta[k]} onChange={e=>setFormConta(f=>({...f,[k]:e.target.value}))} style={inp} /></Fld>
          ))}
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
            <Fld label="Tipo">
              <select value={formConta.tipo} onChange={e=>setFormConta(f=>({...f,tipo:e.target.value}))} style={{...inp,cursor:'pointer'}}>
                {CATEGORIAS.map(c=><option key={c} value={c}>{c}</option>)}
              </select>
            </Fld>
            <Fld label="Status">
              <select value={formConta.status} onChange={e=>setFormConta(f=>({...f,status:e.target.value}))} style={{...inp,cursor:'pointer'}}>
                {STATUS_CONTA.map(s=><option key={s} value={s}>{s}</option>)}
              </select>
            </Fld>
          </div>
          <Fld label="Observações"><textarea value={formConta.observacoes} onChange={e=>setFormConta(f=>({...f,observacoes:e.target.value}))} rows={2} style={{...inp,resize:'vertical'}} /></Fld>
          <BtnRow onCancel={()=>setShowFormConta(false)} onSave={salvarConta} saving={saving} />
        </Modal>
      )}

      {/* Modal NF */}
      {showFormNf && (
        <Modal titulo={formNf.id ? 'Editar Nota Fiscal' : 'Nova Nota Fiscal'} onClose={() => setShowFormNf(false)}>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
            <Fld label="Número"><input value={formNf.numero} onChange={e=>setFormNf(f=>({...f,numero:e.target.value}))} style={inp} placeholder="Automático" /></Fld>
            <Fld label="Competência"><input type="month" value={formNf.competencia} onChange={e=>setFormNf(f=>({...f,competencia:e.target.value}))} style={inp} /></Fld>
          </div>
          <Fld label="Tomador *"><input value={formNf.tomador} onChange={e=>setFormNf(f=>({...f,tomador:e.target.value}))} style={inp} /></Fld>
          <Fld label="CNPJ do Tomador"><input value={formNf.cnpjTomador} onChange={e=>setFormNf(f=>({...f,cnpjTomador:e.target.value}))} style={inp} /></Fld>
          <Fld label="Serviço"><input value={formNf.servico} onChange={e=>setFormNf(f=>({...f,servico:e.target.value}))} style={inp} /></Fld>
          <Fld label="Descrição"><textarea value={formNf.descricao} onChange={e=>setFormNf(f=>({...f,descricao:e.target.value}))} rows={2} style={{...inp,resize:'vertical'}} /></Fld>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
            <Fld label="Valor (R$)"><input type="number" value={formNf.valor} onChange={e=>setFormNf(f=>({...f,valor:e.target.value}))} style={inp} /></Fld>
            <Fld label="Status">
              <select value={formNf.status} onChange={e=>setFormNf(f=>({...f,status:e.target.value}))} style={{...inp,cursor:'pointer'}}>
                {['Emitida','Cancelada','Substituída'].map(s=><option key={s} value={s}>{s}</option>)}
              </select>
            </Fld>
          </div>
          <BtnRow onCancel={()=>setShowFormNf(false)} onSave={salvarNf} saving={saving} />
        </Modal>
      )}

      {/* Modal Pagamento */}
      {showFormPgto && (
        <Modal titulo={formPgto.id ? 'Editar Pagamento' : 'Novo Pagamento'} onClose={() => setShowFormPgto(false)}>
          <Fld label="Descrição *"><input value={formPgto.descricao} onChange={e=>setFormPgto(f=>({...f,descricao:e.target.value}))} style={inp} /></Fld>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
            <Fld label="Favorecido"><input value={formPgto.favorecido} onChange={e=>setFormPgto(f=>({...f,favorecido:e.target.value}))} style={inp} /></Fld>
            <Fld label="Valor (R$)"><input type="number" value={formPgto.valor} onChange={e=>setFormPgto(f=>({...f,valor:e.target.value}))} style={inp} /></Fld>
            <Fld label="Data Emissão"><input type="date" value={formPgto.dataEmissao} onChange={e=>setFormPgto(f=>({...f,dataEmissao:e.target.value}))} style={inp} /></Fld>
            <Fld label="Data Pagamento"><input type="date" value={formPgto.dataPagamento} onChange={e=>setFormPgto(f=>({...f,dataPagamento:e.target.value}))} style={inp} /></Fld>
            <Fld label="Forma de Pagamento">
              <select value={formPgto.formaPagamento} onChange={e=>setFormPgto(f=>({...f,formaPagamento:e.target.value}))} style={{...inp,cursor:'pointer'}}>
                {['PIX','Boleto','TED/DOC','Cartão','Cheque','Dinheiro'].map(s=><option key={s} value={s}>{s}</option>)}
              </select>
            </Fld>
            <Fld label="Status">
              <select value={formPgto.status} onChange={e=>setFormPgto(f=>({...f,status:e.target.value}))} style={{...inp,cursor:'pointer'}}>
                {['Pendente','Pago','Cancelado'].map(s=><option key={s} value={s}>{s}</option>)}
              </select>
            </Fld>
          </div>
          {formPgto.formaPagamento === 'PIX' && (
            <Fld label="Chave PIX"><input value={formPgto.pix} onChange={e=>setFormPgto(f=>({...f,pix:e.target.value}))} style={inp} placeholder="CPF, CNPJ, e-mail ou telefone" /></Fld>
          )}
          {['TED/DOC','Boleto'].includes(formPgto.formaPagamento) && (
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:12 }}>
              <Fld label="Banco"><input value={formPgto.banco} onChange={e=>setFormPgto(f=>({...f,banco:e.target.value}))} style={inp} /></Fld>
              <Fld label="Agência"><input value={formPgto.agencia} onChange={e=>setFormPgto(f=>({...f,agencia:e.target.value}))} style={inp} /></Fld>
              <Fld label="Conta"><input value={formPgto.conta} onChange={e=>setFormPgto(f=>({...f,conta:e.target.value}))} style={inp} /></Fld>
            </div>
          )}
          <Fld label="Observações"><textarea value={formPgto.observacoes} onChange={e=>setFormPgto(f=>({...f,observacoes:e.target.value}))} rows={2} style={{...inp,resize:'vertical'}} /></Fld>
          <BtnRow onCancel={()=>setShowFormPgto(false)} onSave={salvarPgto} saving={saving} />
        </Modal>
      )}
    </>
  )
}

function Modal({ titulo, onClose, children }) {
  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.75)', zIndex:200, display:'flex', alignItems:'center', justifyContent:'center', padding:20, overflowY:'auto' }}>
      <div style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:16, width:'100%', maxWidth:520, padding:24, boxShadow:'0 8px 40px rgba(0,0,0,.5)', maxHeight:'90vh', overflowY:'auto' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
          <h3 style={{ fontFamily:'Syne,sans-serif', fontSize:15, fontWeight:700, color:'var(--accent)' }}>{titulo}</h3>
          <button onClick={onClose} style={{ background:'none', border:'none', color:'var(--muted)', fontSize:20, cursor:'pointer' }}>✕</button>
        </div>
        {children}
      </div>
    </div>
  )
}
function Fld({ label, children }) {
  return (
    <div style={{ marginBottom:12 }}>
      <label style={{ fontSize:11, color:'var(--muted)', display:'block', marginBottom:4, letterSpacing:.5 }}>{label}</label>
      {children}
    </div>
  )
}
function BtnRow({ onCancel, onSave, saving }) {
  return (
    <div style={{ display:'flex', gap:10, justifyContent:'flex-end', marginTop:8 }}>
      <button onClick={onCancel} style={{ padding:'10px 18px', borderRadius:10, background:'rgba(100,116,139,.12)', border:'1px solid var(--border)', color:'var(--muted)', fontFamily:'DM Mono,monospace', fontSize:13, cursor:'pointer' }}>Cancelar</button>
      <button onClick={onSave} disabled={saving} style={{ padding:'10px 22px', borderRadius:10, background:'linear-gradient(135deg,var(--accent),#0099bb)', border:'none', color:'#fff', fontFamily:'DM Mono,monospace', fontSize:13, fontWeight:600, cursor:saving?'not-allowed':'pointer' }}>{saving?'⏳...':'✅ Salvar'}</button>
    </div>
  )
}

const inp     = { width:'100%', background:'var(--surface2)', border:'1px solid var(--border)', borderRadius:8, padding:'9px 12px', fontFamily:'DM Mono,monospace', fontSize:13, color:'var(--text)', outline:'none' }
const sel     = { background:'#1a2540', border:'1px solid #1e2d4a', borderRadius:8, padding:'7px 10px', fontFamily:'DM Mono,monospace', fontSize:12, color:'#e2e8f0', outline:'none', cursor:'pointer' }
const btnPrimary = { display:'inline-flex', alignItems:'center', gap:6, padding:'9px 18px', background:'linear-gradient(135deg,#00d4ff,#0099bb)', border:'none', borderRadius:9, color:'#fff', fontFamily:'DM Mono,monospace', fontSize:12, fontWeight:600, cursor:'pointer' }

const CSS = `
  :root{--bg:#0a0f1e;--surface:#111827;--surface2:#1a2540;--border:#1e2d4a;--accent:#00d4ff;--text:#e2e8f0;--muted:#64748b;--danger:#ef4444}
  *{box-sizing:border-box;margin:0;padding:0}
  body{background:var(--bg);color:var(--text);font-family:'DM Mono',monospace;min-height:100vh}
  body::before{content:'';position:fixed;inset:0;background-image:linear-gradient(rgba(0,212,255,.018) 1px,transparent 1px),linear-gradient(90deg,rgba(0,212,255,.018) 1px,transparent 1px);background-size:44px 44px;pointer-events:none;z-index:0}
`

export async function getServerSideProps() { return { props: {} } }
