// pages/financeiro.js — v2 com aba Comissões
import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import { supabase } from '../lib/supabase'
import Navbar from '../components/Navbar'

const ABAS = [
  { id: 'contas',     label: '💳 Contas a Pagar e Receber' },
  { id: 'nfe',        label: '🧾 Notas Fiscais' },
  { id: 'pagamentos', label: '💰 Pagamentos' },
  { id: 'comissoes',  label: '🏆 Comissões' },
]

const CATEGORIAS  = ['Receita', 'Despesa', 'Transferência']
const STATUS_CONTA = ['Pendente', 'Pago', 'Vencido', 'Cancelado']

const EMPTY_CONTA = { id:'', descricao:'', tipo:'Receita', valor:'', vencimento:'', status:'Pendente', categoria:'', observacoes:'', criadoEm:'' }
const EMPTY_NF    = { id:'', numero:'', tomador:'', cnpjTomador:'', servico:'', valor:'', competencia:'', status:'Emitida', descricao:'', criadoEm:'' }
const EMPTY_PGTO  = { id:'', descricao:'', favorecido:'', valor:'', dataEmissao:'', dataPagamento:'', formaPagamento:'PIX', status:'Pendente', banco:'', agencia:'', conta:'', pix:'', observacoes:'', criadoEm:'' }

function fmt(n)      { return 'R$ ' + Number(n || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 }) }
function fmtDate(s)  { if (!s) return '—'; try { return new Date(s + 'T12:00:00').toLocaleDateString('pt-BR') } catch { return s } }
function fmtPct(v)   { return Number(v || 0).toFixed(1) + '%' }

// Calcula comissão de um usuário sobre um contrato
function calcComissao(contrato, usuario) {
  const com = usuario?.comissao
  if (!com) return { adesao: 0, mensalidade: 0 }

  let adesao = 0
  if (com.adesao?.tipo === 'percentual') {
    adesao = (Number(contrato.valorAdesao || 0) * (Number(com.adesao.valor) || 0)) / 100
  } else {
    adesao = Number(com.adesao?.valor || 0)
  }

  let mensalidade = 0
  if (com.mensalidade?.tipo === 'percentual') {
    mensalidade = (Number(contrato.valorMensalidade || 0) * (Number(com.mensalidade.valor) || 0)) / 100
  } else {
    mensalidade = Number(com.mensalidade?.valor || 0)
  }

  return { adesao, mensalidade }
}

export default function Financeiro() {
  const router = useRouter()
  const [loading,    setLoading]    = useState(true)
  const [cfg,        setCfg]        = useState({})
  const [empresaId,  setEmpresaId]  = useState(null)
  const [perfil,     setPerfil]     = useState(null)
  const [session,    setSession]    = useState(null)
  const [aba,        setAba]        = useState('contas')
  const [saving,     setSaving]     = useState(false)
  const [msgSucesso, setMsgSucesso] = useState('')

  // Contas
  const [contas,        setContas]        = useState([])
  const [showFormConta, setShowFormConta] = useState(false)
  const [formConta,     setFormConta]     = useState({ ...EMPTY_CONTA })
  const [filtroTipo,    setFiltroTipo]    = useState('Todos')
  const [filtroStatus,  setFiltroStatus]  = useState('Todos')

  // NF
  const [notas,      setNotas]      = useState([])
  const [showFormNf, setShowFormNf] = useState(false)
  const [formNf,     setFormNf]     = useState({ ...EMPTY_NF })

  // Pagamentos
  const [pagamentos,     setPagamentos]     = useState([])
  const [showFormPgto,   setShowFormPgto]   = useState(false)
  const [formPgto,       setFormPgto]       = useState({ ...EMPTY_PGTO })

  // Comissões
  const [filtroMesComissao, setFiltroMesComissao] = useState(new Date().toISOString().slice(0, 7))
  const [filtroUserComissao, setFiltroUserComissao] = useState('todos')

  // Leitura da aba via query string (ex: /financeiro?aba=comissoes)
  useEffect(() => {
    if (!router.isReady) return
    const { aba: abaQuery } = router.query
    if (abaQuery && ABAS.find(a => a.id === abaQuery)) setAba(abaQuery)
  }, [router.isReady, router.query])

  useEffect(() => {
    async function init() {
      const { data: { session: sess } } = await supabase.auth.getSession()
      if (!sess) { router.replace('/'); return }
      setSession(sess)

      let { data: perf } = await supabase.from('perfis').select('*').eq('user_id', sess.user.id).maybeSingle()
      if (!perf) {
        const nome = sess.user.email?.split('@')[0] || 'Usuário'
        const { data: np } = await supabase.from('perfis').insert({ user_id: sess.user.id, nome, email: sess.user.email, empresa_id: sess.user.id, perfil: 'admin' }).select().single()
        perf = np
      }
      setPerfil(perf)
      const eid = perf?.empresa_id || sess.user.id
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

  // ── CONTAS ──
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

  const totalReceber  = contas.filter(c => c.tipo === 'Receita'  && c.status !== 'Pago' && c.status !== 'Cancelado').reduce((a, c) => a + (Number(c.valor) || 0), 0)
  const totalPagar    = contas.filter(c => c.tipo === 'Despesa'  && c.status !== 'Pago' && c.status !== 'Cancelado').reduce((a, c) => a + (Number(c.valor) || 0), 0)
  const totalRecebido = contas.filter(c => c.tipo === 'Receita'  && c.status === 'Pago').reduce((a, c) => a + (Number(c.valor) || 0), 0)

  // ── NOTAS FISCAIS ──
  async function salvarNf() {
    if (!formNf.tomador.trim()) { alert('Informe o tomador.'); return }
    setSaving(true)
    const nova = { ...formNf, id: formNf.id || 'nf_' + Date.now(), numero: formNf.numero || String(notas.length + 1).padStart(5, '0'), criadoEm: formNf.criadoEm || new Date().toISOString() }
    const lista = formNf.id ? notas.map(n => n.id === formNf.id ? nova : n) : [...notas, nova]
    const novoCfg = { ...cfg, fin_notas: lista }
    await salvarStorage(novoCfg); setNotas(lista); setCfg(novoCfg); setShowFormNf(false); setFormNf({ ...EMPTY_NF }); setSaving(false)
    toast('✅ Nota salva!')
  }

  // ── PAGAMENTOS ──
  async function salvarPgto() {
    if (!formPgto.descricao.trim()) { alert('Informe a descrição.'); return }
    setSaving(true)
    const novo = { ...formPgto, id: formPgto.id || 'pg_' + Date.now(), criadoEm: formPgto.criadoEm || new Date().toISOString() }
    const lista = formPgto.id ? pagamentos.map(p => p.id === formPgto.id ? novo : p) : [...pagamentos, novo]
    const novoCfg = { ...cfg, fin_pagamentos: lista }
    await salvarStorage(novoCfg); setPagamentos(lista); setCfg(novoCfg); setShowFormPgto(false); setFormPgto({ ...EMPTY_PGTO }); setSaving(false)
    toast('✅ Pagamento salvo!')
  }

  // ── COMISSÕES — lógica central ──
  // Fonte de dados: contratos assinados (fin_contratos ou crm_negocios com status fechado)
  const contratos = [
    ...(cfg.fin_contratos || []),
    ...(cfg.crm_negocios || []).filter(n => n && (n.status === 'Fechado' || n.status === 'Ganho' || n.status === 'fechado' || n.status === 'ganho'))
      .map(n => ({
        id: n.id,
        clienteNome: n.empresa || n.nome || n.clienteNome || 'Cliente',
        vendedorId: n.vendedorId || n.responsavel_id || null,
        vendedorNome: n.vendedorNome || n.responsavel || 'N/D',
        valorAdesao: Number(n.valorAdesao || n.valor_adesao || n.adesao || 0),
        valorMensalidade: Number(n.valorMensalidade || n.valor_mensalidade || n.mensalidade || 0),
        dataFechamento: n.dataFechamento || n.data_fechamento || n.updatedAt || n.criadoEm || '',
        modulos: n.modulos || [],
        status: 'fechado',
      }))
  ]

  const usuarios = cfg.users || []
  const isGestor = perfil?.perfil === 'admin' || perfil?.perfil === 'gestor' || perfil?.tipo === 'admin' || perfil?.tipo === 'gestor'

  // Filtra contratos do mês selecionado
  const contratosFiltrados = contratos.filter(c => {
    const data = c.dataFechamento?.slice(0, 7)
    if (filtroMesComissao && data && data !== filtroMesComissao) return false
    if (!isGestor && session && c.vendedorId !== session.user.id && c.vendedorId !== perfil?.user_id) return false
    if (filtroUserComissao !== 'todos' && c.vendedorId !== filtroUserComissao) return false
    return true
  })

  // Calcula comissão por contrato
  const comissoesDetalhadas = contratosFiltrados.map(contrato => {
    const usuario = usuarios.find(u => u.id === contrato.vendedorId || u.email === contrato.vendedorEmail)
    const { adesao, mensalidade } = calcComissao(contrato, usuario)
    return {
      ...contrato,
      comissaoAdesao: adesao,
      comissaoMensalidade: mensalidade,
      totalComissao: adesao + mensalidade,
      usuario,
    }
  })

  // Totais de comissão
  const totalComAdesao     = comissoesDetalhadas.reduce((a, c) => a + c.comissaoAdesao, 0)
  const totalComMensalidade = comissoesDetalhadas.reduce((a, c) => a + c.comissaoMensalidade, 0)
  const totalComissao      = totalComAdesao + totalComMensalidade

  // Ranking de comissão por vendedor (visível só para gestor)
  const rankingComissao = isGestor
    ? usuarios.map(u => {
        const contratsUser = comissoesDetalhadas.filter(c => c.vendedorId === u.id || c.vendedorId === u.email)
        const totalAd  = contratsUser.reduce((a, c) => a + c.comissaoAdesao, 0)
        const totalMen = contratsUser.reduce((a, c) => a + c.comissaoMensalidade, 0)
        return { usuario: u, totalAd, totalMen, total: totalAd + totalMen, qtdContratos: contratsUser.length }
      }).filter(r => r.total > 0 || r.qtdContratos > 0).sort((a, b) => b.total - a.total)
    : []

  const logoSrc = cfg.logob64 ? (cfg.logob64.startsWith('data:') ? cfg.logob64 : `data:image/png;base64,${cfg.logob64}`) : null
  const corStatus = { 'Pendente':'#f59e0b', 'Pago':'#10b981', 'Vencido':'#ef4444', 'Cancelado':'#64748b', 'Emitida':'#00d4ff', 'Cancelada':'#ef4444' }

  if (loading) return <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', background:'#0a0f1e', color:'#64748b', fontFamily:'DM Mono,monospace' }}>Carregando...</div>

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=DM+Mono:wght@400;500&display=swap');
        :root{--bg:#0a0f1e;--surface:#111827;--surface2:#1a2540;--border:#1e2d4a;--accent:#00d4ff;--accent2:#7c3aed;--accent3:#10b981;--text:#e2e8f0;--muted:#64748b;--danger:#ef4444;--warning:#f59e0b;--gold:#fbbf24}
        *{box-sizing:border-box;margin:0;padding:0}
        body{font-family:'DM Mono',monospace;background:var(--bg);color:var(--text);min-height:100vh}
        input,select,textarea{background:var(--surface2);border:1px solid var(--border);border-radius:8px;padding:9px 12px;font-family:'DM Mono',monospace;font-size:13px;color:var(--text);outline:none;transition:border-color .2s}
        input:focus,select:focus,textarea:focus{border-color:var(--accent)}
        table{width:100%;border-collapse:collapse}
        th{padding:10px 14px;text-align:left;font-size:11px;color:var(--muted);border-bottom:1px solid var(--border);font-weight:600;letter-spacing:.5px;background:var(--surface)}
        td{padding:12px 14px;border-bottom:1px solid rgba(30,45,74,.5);font-size:13px;vertical-align:middle}
        tr:hover td{background:rgba(0,212,255,.02)}
        tr:last-child td{border-bottom:none}
      `}</style>

      <Navbar cfg={cfg} perfil={perfil} />

      <main style={{ maxWidth: 1100, margin: '24px auto 60px', padding: '0 20px' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24 }}>
          {logoSrc && <img src={logoSrc} alt="Logo" style={{ height: 40, objectFit: 'contain' }} />}
          <div>
            <h1 style={{ fontFamily: 'Syne, sans-serif', fontSize: 22, fontWeight: 800, color: 'var(--accent)' }}>💰 Financeiro</h1>
            <div style={{ fontSize: 12, color: 'var(--muted)' }}>{cfg.company || 'Vivanexa'}</div>
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 24, flexWrap: 'wrap' }}>
          {ABAS.map(a => (
            <button key={a.id} onClick={() => setAba(a.id)} style={{ padding: '9px 18px', borderRadius: 9, border: `1px solid ${aba === a.id ? 'var(--accent)' : 'var(--border)'}`, background: aba === a.id ? 'rgba(0,212,255,.12)' : 'var(--surface)', color: aba === a.id ? 'var(--accent)' : 'var(--muted)', fontFamily: 'DM Mono, monospace', fontSize: 13, cursor: 'pointer', fontWeight: aba === a.id ? 600 : 400, transition: 'all .2s' }}>
              {a.label}
            </button>
          ))}
        </div>

        {msgSucesso && (
          <div style={{ padding: '12px 16px', background: 'rgba(16,185,129,.12)', border: '1px solid rgba(16,185,129,.3)', borderRadius: 10, color: 'var(--accent3)', fontSize: 13, marginBottom: 16 }}>{msgSucesso}</div>
        )}

        {/* ─── ABA: CONTAS ─── */}
        {aba === 'contas' && (
          <div>
            {/* Cards de resumo */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, marginBottom: 24 }}>
              {[
                { label: 'A Receber', valor: fmt(totalReceber),  cor: '#10b981', icon: '💵' },
                { label: 'A Pagar',   valor: fmt(totalPagar),    cor: '#ef4444', icon: '💸' },
                { label: 'Recebido',  valor: fmt(totalRecebido), cor: '#00d4ff', icon: '✅' },
              ].map((c, i) => (
                <div key={i} style={{ background: 'var(--surface)', border: `1px solid var(--border)`, borderTop: `3px solid ${c.cor}`, borderRadius: 12, padding: '16px 18px' }}>
                  <div style={{ fontSize: 20, marginBottom: 6 }}>{c.icon}</div>
                  <div style={{ fontFamily: 'Syne, sans-serif', fontSize: 22, fontWeight: 800, color: c.cor }}>{c.valor}</div>
                  <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>{c.label}</div>
                </div>
              ))}
            </div>

            {/* Filtros + botão novo */}
            <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
              <select value={filtroTipo} onChange={e => setFiltroTipo(e.target.value)} style={{ width: 140 }}>
                <option value="Todos">Todos os tipos</option>
                {CATEGORIAS.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              <select value={filtroStatus} onChange={e => setFiltroStatus(e.target.value)} style={{ width: 150 }}>
                <option value="Todos">Todos os status</option>
                {STATUS_CONTA.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
              <button onClick={() => { setShowFormConta(true); setFormConta({ ...EMPTY_CONTA }) }} style={{ marginLeft: 'auto', padding: '9px 18px', borderRadius: 9, background: 'linear-gradient(135deg,var(--accent),#0099bb)', border: 'none', color: '#fff', fontFamily: 'DM Mono, monospace', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>+ Nova Conta</button>
            </div>

            {/* Form nova conta */}
            {showFormConta && (
              <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 18, marginBottom: 20 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--accent)', marginBottom: 14, fontFamily: 'Syne, sans-serif' }}>{formConta.id ? 'Editar Conta' : 'Nova Conta'}</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div><label style={lbl}>Descrição *</label><input value={formConta.descricao} onChange={e => setFormConta(f => ({ ...f, descricao: e.target.value }))} style={{ width: '100%' }} /></div>
                  <div><label style={lbl}>Valor (R$) *</label><input type="number" min={0} step={0.01} value={formConta.valor} onChange={e => setFormConta(f => ({ ...f, valor: e.target.value }))} style={{ width: '100%' }} /></div>
                  <div><label style={lbl}>Tipo</label>
                    <select value={formConta.tipo} onChange={e => setFormConta(f => ({ ...f, tipo: e.target.value }))} style={{ width: '100%' }}>
                      {CATEGORIAS.map(c => <option key={c}>{c}</option>)}
                    </select>
                  </div>
                  <div><label style={lbl}>Status</label>
                    <select value={formConta.status} onChange={e => setFormConta(f => ({ ...f, status: e.target.value }))} style={{ width: '100%' }}>
                      {STATUS_CONTA.map(s => <option key={s}>{s}</option>)}
                    </select>
                  </div>
                  <div><label style={lbl}>Vencimento</label><input type="date" value={formConta.vencimento} onChange={e => setFormConta(f => ({ ...f, vencimento: e.target.value }))} style={{ width: '100%' }} /></div>
                  <div><label style={lbl}>Categoria</label><input value={formConta.categoria} onChange={e => setFormConta(f => ({ ...f, categoria: e.target.value }))} style={{ width: '100%' }} placeholder="Ex: Salário, Aluguel" /></div>
                  <div style={{ gridColumn: '1/-1' }}><label style={lbl}>Observações</label><textarea value={formConta.observacoes} onChange={e => setFormConta(f => ({ ...f, observacoes: e.target.value }))} style={{ width: '100%', minHeight: 64, resize: 'vertical' }} /></div>
                </div>
                <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
                  <button onClick={salvarConta} disabled={saving} style={btnPrimary}>{saving ? '⏳...' : '✅ Salvar'}</button>
                  <button onClick={() => setShowFormConta(false)} style={btnSecondary}>Cancelar</button>
                </div>
              </div>
            )}

            {/* Tabela contas */}
            <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
              <table>
                <thead><tr><th>Descrição</th><th>Tipo</th><th>Valor</th><th>Vencimento</th><th>Status</th><th>Ações</th></tr></thead>
                <tbody>
                  {contasFiltradas.length === 0 && (
                    <tr><td colSpan={6} style={{ textAlign: 'center', color: 'var(--muted)', padding: 32 }}>Nenhuma conta encontrada.</td></tr>
                  )}
                  {contasFiltradas.map(c => (
                    <tr key={c.id}>
                      <td><div style={{ fontWeight: 600, color: 'var(--text)' }}>{c.descricao}</div><div style={{ fontSize: 11, color: 'var(--muted)' }}>{c.categoria}</div></td>
                      <td><span style={{ padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600, background: c.tipo === 'Receita' ? 'rgba(16,185,129,.15)' : 'rgba(239,68,68,.15)', color: c.tipo === 'Receita' ? '#10b981' : '#ef4444', border: `1px solid ${c.tipo === 'Receita' ? 'rgba(16,185,129,.3)' : 'rgba(239,68,68,.3)'}` }}>{c.tipo}</span></td>
                      <td style={{ fontWeight: 600, color: c.tipo === 'Receita' ? '#10b981' : '#ef4444' }}>{fmt(c.valor)}</td>
                      <td style={{ color: 'var(--muted)' }}>{fmtDate(c.vencimento)}</td>
                      <td><span style={{ padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600, background: (corStatus[c.status] || '#64748b') + '22', color: corStatus[c.status] || '#64748b', border: `1px solid ${corStatus[c.status] || '#64748b'}44` }}>{c.status}</span></td>
                      <td>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button onClick={() => marcarPago(c)} style={{ ...btnIcon, color: '#10b981' }} title={c.status === 'Pago' ? 'Desfazer' : 'Marcar pago'}>✅</button>
                          <button onClick={() => { setFormConta({ ...c }); setShowFormConta(true) }} style={btnIcon} title="Editar">✏️</button>
                          <button onClick={() => excluirConta(c.id)} style={{ ...btnIcon, color: '#ef4444' }} title="Excluir">🗑</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ─── ABA: NOTAS FISCAIS ─── */}
        {aba === 'nfe' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
              <button onClick={() => { setShowFormNf(true); setFormNf({ ...EMPTY_NF }) }} style={btnPrimary}>+ Nova Nota</button>
            </div>
            {showFormNf && (
              <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 18, marginBottom: 20 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--accent)', marginBottom: 14, fontFamily: 'Syne, sans-serif' }}>{formNf.id ? 'Editar Nota' : 'Nova Nota Fiscal'}</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div><label style={lbl}>Tomador *</label><input value={formNf.tomador} onChange={e => setFormNf(f => ({ ...f, tomador: e.target.value }))} style={{ width: '100%' }} /></div>
                  <div><label style={lbl}>CNPJ do Tomador</label><input value={formNf.cnpjTomador} onChange={e => setFormNf(f => ({ ...f, cnpjTomador: e.target.value }))} style={{ width: '100%' }} /></div>
                  <div><label style={lbl}>Serviço</label><input value={formNf.servico} onChange={e => setFormNf(f => ({ ...f, servico: e.target.value }))} style={{ width: '100%' }} /></div>
                  <div><label style={lbl}>Valor (R$)</label><input type="number" min={0} step={0.01} value={formNf.valor} onChange={e => setFormNf(f => ({ ...f, valor: e.target.value }))} style={{ width: '100%' }} /></div>
                  <div><label style={lbl}>Competência</label><input type="month" value={formNf.competencia} onChange={e => setFormNf(f => ({ ...f, competencia: e.target.value }))} style={{ width: '100%' }} /></div>
                  <div><label style={lbl}>Status</label>
                    <select value={formNf.status} onChange={e => setFormNf(f => ({ ...f, status: e.target.value }))} style={{ width: '100%' }}>
                      {['Emitida', 'Cancelada', 'Pendente'].map(s => <option key={s}>{s}</option>)}
                    </select>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
                  <button onClick={salvarNf} disabled={saving} style={btnPrimary}>{saving ? '⏳...' : '✅ Salvar'}</button>
                  <button onClick={() => setShowFormNf(false)} style={btnSecondary}>Cancelar</button>
                </div>
              </div>
            )}
            <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
              <table>
                <thead><tr><th>Nº</th><th>Tomador</th><th>Serviço</th><th>Valor</th><th>Competência</th><th>Status</th><th>Ações</th></tr></thead>
                <tbody>
                  {notas.length === 0 && <tr><td colSpan={7} style={{ textAlign: 'center', color: 'var(--muted)', padding: 32 }}>Nenhuma nota cadastrada.</td></tr>}
                  {notas.map(n => (
                    <tr key={n.id}>
                      <td style={{ color: 'var(--muted)' }}>{n.numero}</td>
                      <td><div style={{ fontWeight: 600 }}>{n.tomador}</div><div style={{ fontSize: 11, color: 'var(--muted)' }}>{n.cnpjTomador}</div></td>
                      <td style={{ color: 'var(--muted)' }}>{n.servico}</td>
                      <td style={{ fontWeight: 600, color: '#10b981' }}>{fmt(n.valor)}</td>
                      <td style={{ color: 'var(--muted)' }}>{n.competencia}</td>
                      <td><span style={{ padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600, background: (corStatus[n.status] || '#64748b') + '22', color: corStatus[n.status] || '#64748b', border: `1px solid ${(corStatus[n.status] || '#64748b')}44` }}>{n.status}</span></td>
                      <td>
                        <button onClick={() => { setFormNf({ ...n }); setShowFormNf(true) }} style={btnIcon}>✏️</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ─── ABA: PAGAMENTOS ─── */}
        {aba === 'pagamentos' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
              <button onClick={() => { setShowFormPgto(true); setFormPgto({ ...EMPTY_PGTO }) }} style={btnPrimary}>+ Novo Pagamento</button>
            </div>
            {showFormPgto && (
              <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 18, marginBottom: 20 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--accent)', marginBottom: 14, fontFamily: 'Syne, sans-serif' }}>{formPgto.id ? 'Editar Pagamento' : 'Novo Pagamento'}</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div><label style={lbl}>Descrição *</label><input value={formPgto.descricao} onChange={e => setFormPgto(f => ({ ...f, descricao: e.target.value }))} style={{ width: '100%' }} /></div>
                  <div><label style={lbl}>Favorecido</label><input value={formPgto.favorecido} onChange={e => setFormPgto(f => ({ ...f, favorecido: e.target.value }))} style={{ width: '100%' }} /></div>
                  <div><label style={lbl}>Valor (R$)</label><input type="number" min={0} step={0.01} value={formPgto.valor} onChange={e => setFormPgto(f => ({ ...f, valor: e.target.value }))} style={{ width: '100%' }} /></div>
                  <div><label style={lbl}>Forma de Pagamento</label>
                    <select value={formPgto.formaPagamento} onChange={e => setFormPgto(f => ({ ...f, formaPagamento: e.target.value }))} style={{ width: '100%' }}>
                      {['PIX', 'TED', 'Boleto', 'Cartão', 'Cheque', 'Dinheiro'].map(s => <option key={s}>{s}</option>)}
                    </select>
                  </div>
                  <div><label style={lbl}>Data Emissão</label><input type="date" value={formPgto.dataEmissao} onChange={e => setFormPgto(f => ({ ...f, dataEmissao: e.target.value }))} style={{ width: '100%' }} /></div>
                  <div><label style={lbl}>Data Pagamento</label><input type="date" value={formPgto.dataPagamento} onChange={e => setFormPgto(f => ({ ...f, dataPagamento: e.target.value }))} style={{ width: '100%' }} /></div>
                  {formPgto.formaPagamento === 'PIX' && <div style={{ gridColumn: '1/-1' }}><label style={lbl}>Chave PIX</label><input value={formPgto.pix} onChange={e => setFormPgto(f => ({ ...f, pix: e.target.value }))} style={{ width: '100%' }} /></div>}
                  <div style={{ gridColumn: '1/-1' }}><label style={lbl}>Observações</label><textarea value={formPgto.observacoes} onChange={e => setFormPgto(f => ({ ...f, observacoes: e.target.value }))} style={{ width: '100%', minHeight: 64, resize: 'vertical' }} /></div>
                </div>
                <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
                  <button onClick={salvarPgto} disabled={saving} style={btnPrimary}>{saving ? '⏳...' : '✅ Salvar'}</button>
                  <button onClick={() => setShowFormPgto(false)} style={btnSecondary}>Cancelar</button>
                </div>
              </div>
            )}
            <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
              <table>
                <thead><tr><th>Descrição</th><th>Favorecido</th><th>Valor</th><th>Forma</th><th>Data</th><th>Status</th><th>Ações</th></tr></thead>
                <tbody>
                  {pagamentos.length === 0 && <tr><td colSpan={7} style={{ textAlign: 'center', color: 'var(--muted)', padding: 32 }}>Nenhum pagamento cadastrado.</td></tr>}
                  {pagamentos.map(p => (
                    <tr key={p.id}>
                      <td style={{ fontWeight: 600 }}>{p.descricao}</td>
                      <td style={{ color: 'var(--muted)' }}>{p.favorecido}</td>
                      <td style={{ fontWeight: 600, color: '#ef4444' }}>{fmt(p.valor)}</td>
                      <td style={{ color: 'var(--muted)' }}>{p.formaPagamento}</td>
                      <td style={{ color: 'var(--muted)' }}>{fmtDate(p.dataPagamento || p.dataEmissao)}</td>
                      <td><span style={{ padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600, background: (corStatus[p.status] || '#64748b') + '22', color: corStatus[p.status] || '#64748b', border: `1px solid ${(corStatus[p.status] || '#64748b')}44` }}>{p.status}</span></td>
                      <td><button onClick={() => { setFormPgto({ ...p }); setShowFormPgto(true) }} style={btnIcon}>✏️</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ─── ABA: COMISSÕES ← NOVA ─── */}
        {aba === 'comissoes' && (
          <div>
            {/* Aviso se não há configuração de comissão */}
            {usuarios.filter(u => u.comissao?.adesao?.valor > 0 || u.comissao?.mensalidade?.valor > 0).length === 0 && (
              <div style={{ padding: '14px 18px', background: 'rgba(245,158,11,.08)', border: '1px solid rgba(245,158,11,.25)', borderRadius: 10, fontSize: 13, color: '#fbbf24', marginBottom: 20, lineHeight: 1.6 }}>
                ⚠️ Nenhum usuário tem comissão configurada. Acesse <strong>Configurações → Usuários</strong> e defina os percentuais ou valores fixos para cada vendedor.
              </div>
            )}

            {/* Cards resumo */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, marginBottom: 24 }}>
              {[
                { label: 'Comissão Adesão',       valor: fmt(totalComAdesao),      cor: '#00d4ff', icon: '💵' },
                { label: 'Comissão Mensalidade',   valor: fmt(totalComMensalidade), cor: '#7c3aed', icon: '🔄' },
                { label: 'Total de Comissão',      valor: fmt(totalComissao),       cor: '#10b981', icon: '🏆' },
              ].map((c, i) => (
                <div key={i} style={{ background: 'var(--surface)', border: `1px solid var(--border)`, borderTop: `3px solid ${c.cor}`, borderRadius: 12, padding: '16px 18px' }}>
                  <div style={{ fontSize: 20, marginBottom: 6 }}>{c.icon}</div>
                  <div style={{ fontFamily: 'Syne, sans-serif', fontSize: 22, fontWeight: 800, color: c.cor }}>{c.valor}</div>
                  <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>{c.label}</div>
                </div>
              ))}
            </div>

            {/* Filtros */}
            <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap', alignItems: 'center' }}>
              <div>
                <label style={{ fontSize: 11, color: 'var(--muted)', display: 'block', marginBottom: 4 }}>Mês</label>
                <input type="month" value={filtroMesComissao} onChange={e => setFiltroMesComissao(e.target.value)} style={{ width: 160 }} />
              </div>
              {isGestor && (
                <div>
                  <label style={{ fontSize: 11, color: 'var(--muted)', display: 'block', marginBottom: 4 }}>Vendedor</label>
                  <select value={filtroUserComissao} onChange={e => setFiltroUserComissao(e.target.value)} style={{ width: 180 }}>
                    <option value="todos">Todos</option>
                    {usuarios.map(u => <option key={u.id} value={u.id}>{u.nome}</option>)}
                  </select>
                </div>
              )}
            </div>

            {/* Ranking de comissão — só para gestor/admin */}
            {isGestor && rankingComissao.length > 0 && (
              <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '18px 20px', marginBottom: 24 }}>
                <div style={{ fontFamily: 'Syne, sans-serif', fontSize: 14, fontWeight: 700, color: 'var(--accent)', marginBottom: 14 }}>🏅 Ranking de Comissões — {filtroMesComissao}</div>
                {rankingComissao.map((r, i) => (
                  <div key={r.usuario.id} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '10px 0', borderBottom: i < rankingComissao.length - 1 ? '1px solid var(--border)' : 'none' }}>
                    <div style={{ width: 28, height: 28, borderRadius: '50%', background: i === 0 ? '#fbbf2422' : i === 1 ? '#94a3b822' : i === 2 ? '#cd7c3422' : 'var(--surface2)', border: `1px solid ${i === 0 ? '#fbbf24' : i === 1 ? '#94a3b8' : i === 2 ? '#cd7c34' : 'var(--border)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: 12, color: i === 0 ? '#fbbf24' : i === 1 ? '#94a3b8' : i === 2 ? '#cd7c34' : 'var(--muted)', flexShrink: 0 }}>
                      {i + 1}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--text)' }}>{r.usuario.nome}</div>
                      <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>{r.qtdContratos} contrato(s) · Adesão: {fmt(r.totalAd)} · Mensal: {fmt(r.totalMen)}</div>
                    </div>
                    <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: 16, color: '#10b981' }}>{fmt(r.total)}</div>
                  </div>
                ))}
              </div>
            )}

            {/* Tabela detalhada de comissões */}
            <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
              <table>
                <thead>
                  <tr>
                    <th>Cliente</th>
                    {isGestor && <th>Vendedor</th>}
                    <th>Data</th>
                    <th>Vlr. Adesão</th>
                    <th>Vlr. Mensalidade</th>
                    <th>Com. Adesão</th>
                    <th>Com. Mensalidade</th>
                    <th>Total Comissão</th>
                  </tr>
                </thead>
                <tbody>
                  {comissoesDetalhadas.length === 0 && (
                    <tr>
                      <td colSpan={isGestor ? 8 : 7} style={{ textAlign: 'center', color: 'var(--muted)', padding: 40 }}>
                        Nenhum contrato fechado encontrado para este período.
                        {contratos.length === 0 && (
                          <div style={{ marginTop: 8, fontSize: 12 }}>Os contratos vêm do CRM (negócios com status Fechado/Ganho) ou de fin_contratos[].</div>
                        )}
                      </td>
                    </tr>
                  )}
                  {comissoesDetalhadas.map((c, i) => {
                    const com = c.usuario?.comissao
                    const configAdesao = com?.adesao?.tipo === 'percentual' ? fmtPct(com.adesao.valor) : fmt(com?.adesao?.valor || 0)
                    const configMen    = com?.mensalidade?.tipo === 'percentual' ? fmtPct(com.mensalidade.valor) : fmt(com?.mensalidade?.valor || 0)
                    return (
                      <tr key={c.id || i}>
                        <td>
                          <div style={{ fontWeight: 600, color: 'var(--text)' }}>{c.clienteNome}</div>
                          {c.modulos?.length > 0 && <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>{c.modulos.join(', ')}</div>}
                        </td>
                        {isGestor && <td style={{ color: 'var(--muted)' }}>{c.vendedorNome || c.usuario?.nome || '—'}</td>}
                        <td style={{ color: 'var(--muted)' }}>{fmtDate(c.dataFechamento)}</td>
                        <td style={{ color: '#94a3b8' }}>{fmt(c.valorAdesao)}</td>
                        <td style={{ color: '#94a3b8' }}>{fmt(c.valorMensalidade)}</td>
                        <td>
                          {c.comissaoAdesao > 0
                            ? <div><span style={{ fontWeight: 700, color: '#00d4ff' }}>{fmt(c.comissaoAdesao)}</span><div style={{ fontSize: 10, color: 'var(--muted)' }}>({configAdesao})</div></div>
                            : <span style={{ color: 'var(--muted)' }}>—</span>
                          }
                        </td>
                        <td>
                          {c.comissaoMensalidade > 0
                            ? <div><span style={{ fontWeight: 700, color: '#7c3aed' }}>{fmt(c.comissaoMensalidade)}</span><div style={{ fontSize: 10, color: 'var(--muted)' }}>({configMen})</div></div>
                            : <span style={{ color: 'var(--muted)' }}>—</span>
                          }
                        </td>
                        <td style={{ fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: 15, color: '#10b981' }}>{fmt(c.totalComissao)}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {/* Nota explicativa */}
            <div style={{ marginTop: 16, padding: '12px 16px', background: 'rgba(0,212,255,.05)', border: '1px solid rgba(0,212,255,.12)', borderRadius: 8, fontSize: 12, color: 'var(--muted)', lineHeight: 1.7 }}>
              💡 As comissões são calculadas sobre os contratos com status <strong style={{ color: 'var(--text)' }}>Fechado / Ganho</strong> no CRM.
              As alíquotas são definidas em <strong style={{ color: 'var(--accent)' }}>Configurações → Usuários</strong>.
              {!isGestor && ' Você está vendo apenas seus próprios contratos.'}
            </div>
          </div>
        )}
      </main>
    </>
  )
}

// ── Estilos reutilizáveis ──
const lbl       = { fontSize: 11, color: '#64748b', display: 'block', marginBottom: 4, letterSpacing: '.5px' }
const btnPrimary   = { padding: '10px 22px', borderRadius: 9, background: 'linear-gradient(135deg,#00d4ff,#0099bb)', border: 'none', color: '#fff', fontFamily: 'DM Mono, monospace', fontSize: 13, fontWeight: 700, cursor: 'pointer' }
const btnSecondary = { padding: '10px 18px', borderRadius: 9, background: 'rgba(100,116,139,.12)', border: '1px solid rgba(100,116,139,.3)', color: '#64748b', fontFamily: 'DM Mono, monospace', fontSize: 13, cursor: 'pointer' }
const btnIcon      = { width: 30, height: 30, borderRadius: 7, background: '#1a2540', border: '1px solid #1e2d4a', cursor: 'pointer', fontSize: 14, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', transition: 'all .15s' }
