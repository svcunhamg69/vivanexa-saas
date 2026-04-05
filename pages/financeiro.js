// pages/financeiro.js — Financeiro Vivanexa
import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import { supabase } from '../lib/supabase'
import Navbar from '../components/Navbar'

const ABAS = [
  { id: 'contas',    label: '💳 Contas a Pagar e Receber' },
  { id: 'nfe',       label: '🧾 Emissão de Nota Fiscal' },
  { id: 'pagamentos',label: '💰 Pagamentos' },
]

const CATEGORIAS = ['Receita', 'Despesa', 'Transferência']
const STATUS_CONTA = ['Pendente', 'Pago', 'Vencido', 'Cancelado']
const EMPTY_CONTA = { id: '', descricao: '', tipo: 'Receita', valor: '', vencimento: '', status: 'Pendente', categoria: '', observacoes: '', criadoEm: '' }
const EMPTY_NF = { id: '', numero: '', tomador: '', cnpjTomador: '', servico: '', valor: '', competencia: '', status: 'Emitida', descricao: '', criadoEm: '' }
const EMPTY_PGTO = { id: '', descricao: '', favorecido: '', valor: '', dataEmissao: '', dataPagamento: '', formaPagamento: 'PIX', status: 'Pendente', banco: '', agencia: '', conta: '', pix: '', observacoes: '', criadoEm: '' }

function fmt(n) { return 'R$ ' + Number(n || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 }) }
function fmtDate(s) { if (!s) return '—'; try { return new Date(s + 'T12:00:00').toLocaleDateString('pt-BR') } catch { return s } }

export default function Financeiro() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [cfg, setCfg] = useState({})
  const [empresaId, setEmpresaId] = useState(null)
  const [perfil, setPerfil] = useState(null)
  const [aba, setAba] = useState('contas')
  const [saving, setSaving] = useState(false)
  const [msgSucesso, setMsgSucesso] = useState('')

  // Contas
  const [contas, setContas] = useState([])
  const [showFormConta, setShowFormConta] = useState(false)
  const [formConta, setFormConta] = useState({ ...EMPTY_CONTA })
  const [filtroTipo, setFiltroTipo] = useState('Todos')
  const [filtroStatus, setFiltroStatus] = useState('Todos')

  // NF
  const [notas, setNotas] = useState([])
  const [showFormNf, setShowFormNf] = useState(false)
  const [formNf, setFormNf] = useState({ ...EMPTY_NF })

  // Pagamentos
  const [pagamentos, setPagamentos] = useState([])
  const [showFormPgto, setShowFormPgto] = useState(false)
  const [formPgto, setFormPgto] = useState({ ...EMPTY_PGTO })

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

  // ─── CONTAS ──────────────────────────────────
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

  const totalReceber = contas.filter(c => c.tipo === 'Receita' && c.status !== 'Pago' && c.status !== 'Cancelado').reduce((a, c) => a + (Number(c.valor) || 0), 0)
  const totalPagar = contas.filter(c => c.tipo === 'Despesa' && c.status !== 'Pago' && c.status !== 'Cancelado').reduce((a, c) => a + (Number(c.valor) || 0), 0)
  const totalRecebido = contas.filter(c => c.tipo === 'Receita' && c.status === 'Pago').reduce((a, c) => a + (Number(c.valor) || 0), 0)

  // ─── NOTAS FISCAIS ───────────────────────────
  async function salvarNf() {
    if (!formNf.tomador.trim()) { alert('Informe o tomador.'); return }
    setSaving(true)
    const nova = { ...formNf, id: formNf.id || 'nf_' + Date.now(), numero: formNf.numero || String(notas.length + 1).padStart(5, '0'), criadoEm: formNf.criadoEm || new Date().toISOString() }
    const lista = formNf.id ? notas.map(n => n.id === formNf.id ? nova : n) : [...notas, nova]
    const novoCfg = { ...cfg, fin_notas: lista }
    await salvarStorage(novoCfg); setNotas(lista); setCfg(novoCfg); setShowFormNf(false); setFormNf({ ...EMPTY_NF }); setSaving(false)
    toast('✅ Nota salva!')
  }

  // ─── PAGAMENTOS ──────────────────────────────
  async function salvarPgto() {
    if (!formPgto.descricao.trim()) { alert('Informe a descrição.'); return }
    setSaving(true)
    const novo = { ...formPgto, id: formPgto.id || 'pg_' + Date.now(), criadoEm: formPgto.criadoEm || new Date().toISOString() }
    const lista = formPgto.id ? pagamentos.map(p => p.id === formPgto.id ? novo : p) : [...pagamentos, novo]
    const novoCfg = { ...cfg, fin_pagamentos: lista }
    await salvarStorage(novoCfg); setPagamentos(lista); setCfg(novoCfg); setShowFormPgto(false); setFormPgto({ ...EMPTY_PGTO }); setSaving(false)
    toast('✅ Pagamento salvo!')
  }

  const logoSrc = cfg.logob64 ? (cfg.logob64.startsWith('data:') ? cfg.logob64 : `data:image/png;base64,${cfg.logob64}`) : null
  const corStatus = { 'Pendente': '#f59e0b', 'Pago': '#10b981', 'Vencido': '#ef4444', 'Cancelado': '#64748b', 'Emitida': '#00d4ff', 'Cancelada': '#ef4444' }

  if (loading) return <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0a0f1e', color: '#64748b', fontFamily: 'DM Mono,monospace' }}>Carregando...</div>

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=DM+Mono:wght@400;500&display=swap');
        :root{--bg:#0a0f1e;--surface:#111827;--surface2:#1a2540;--border:#1e2d4a;--accent:#00d4ff;--accent2:#7c3aed;--accent3:#10b981;--text:#e2e8f0;--muted:#64748b;--danger:#ef4444;--warning:#f59e0b;--gold:#fbbf24}
        *{box-sizing:border-box;margin:0;padding:0}
        body{font-family:'DM Mono',monospace;background:var(--bg);color:var(--text);min-height:100vh}
        ::-webkit-scrollbar{width:4px}::-webkit-scrollbar-thumb{background:var(--border);border-radius:4px}
        input:focus,textarea:focus,select:focus{border-color:var(--accent)!important;outline:none}
      `}</style>

      {msgSucesso && <div style={{ position: 'fixed', bottom: 30, left: '50%', transform: 'translateX(-50%)', background: 'rgba(16,185,129,.9)', color: '#fff', padding: '12px 24px', borderRadius: 10, fontFamily: 'DM Mono', fontSize: 14, zIndex: 9999 }}>{msgSucesso}</div>}

      <Navbar cfg={cfg} perfil={perfil} />
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

        {/* ══ CONTAS A PAGAR E RECEBER ══ */}
        {aba === 'contas' && (
          <div>
            {/* KPIs */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(170px,1fr))', gap: 10, marginBottom: 20 }}>
              {[
                { l: '💸 A Pagar', v: fmt(totalPagar), c: 'var(--danger)' },
                { l: '💰 A Receber', v: fmt(totalReceber), c: 'var(--warning)' },
                { l: '✅ Recebido', v: fmt(totalRecebido), c: 'var(--accent3)' },
                { l: '📊 Saldo', v: fmt(totalRecebido - totalPagar), c: totalRecebido - totalPagar >= 0 ? 'var(--accent3)' : 'var(--danger)' },
              ].map(k => (
                <div key={k.l} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '14px 16px' }}>
                  <div style={{ fontSize: 10, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>{k.l}</div>
                  <div style={{ fontFamily: 'Syne,sans-serif', fontSize: 18, fontWeight: 800, color: k.c }}>{k.v}</div>
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap', alignItems: 'center' }}>
              {['Todos', ...CATEGORIAS].map(t => (
                <button key={t} onClick={() => setFiltroTipo(t)}
                  style={{ padding: '5px 10px', borderRadius: 7, border: `1px solid ${filtroTipo === t ? 'var(--accent)' : 'var(--border)'}`, background: filtroTipo === t ? 'rgba(0,212,255,.1)' : 'var(--surface2)', color: filtroTipo === t ? 'var(--accent)' : 'var(--muted)', fontSize: 11, cursor: 'pointer', fontFamily: 'DM Mono,monospace' }}>
                  {t}
                </button>
              ))}
              <select value={filtroStatus} onChange={e => setFiltroStatus(e.target.value)}
                style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 7, padding: '5px 10px', color: 'var(--muted)', fontFamily: 'DM Mono,monospace', fontSize: 11, cursor: 'pointer', outline: 'none' }}>
                <option value="Todos">Todos status</option>
                {STATUS_CONTA.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
              <button onClick={() => { setFormConta({ ...EMPTY_CONTA }); setShowFormConta(true) }}
                style={{ marginLeft: 'auto', padding: '7px 16px', borderRadius: 8, background: 'linear-gradient(135deg,var(--accent),#0099bb)', border: 'none', color: '#fff', fontFamily: 'DM Mono,monospace', fontSize: 12, cursor: 'pointer', fontWeight: 600 }}>
                + Novo Lançamento
              </button>
            </div>

            {contasFiltradas.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--muted)', fontSize: 13 }}>Nenhum lançamento encontrado.</div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border)' }}>
                      {['Status', 'Descrição', 'Tipo', 'Valor', 'Vencimento', 'Ações'].map(h => (
                        <th key={h} style={{ padding: '8px 10px', textAlign: h === 'Valor' ? 'right' : 'left', color: 'var(--muted)', fontSize: 10, textTransform: 'uppercase', letterSpacing: 1, fontWeight: 500, whiteSpace: 'nowrap' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {contasFiltradas.map(ct => (
                      <tr key={ct.id} style={{ borderBottom: '1px solid var(--border)' }}>
                        <td style={{ padding: '10px 10px' }}>
                          <div onClick={() => marcarPago(ct)} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, cursor: 'pointer', fontSize: 11, padding: '3px 8px', borderRadius: 6, background: `rgba(${corStatus[ct.status] === '#10b981' ? '16,185,129' : corStatus[ct.status] === '#ef4444' ? '239,68,68' : '245,158,11'},.1)`, color: corStatus[ct.status] || 'var(--muted)' }}>
                            {ct.status === 'Pago' ? '✅' : '⏳'} {ct.status}
                          </div>
                        </td>
                        <td style={{ padding: '10px 10px', color: 'var(--text)', fontWeight: 500 }}>{ct.descricao}</td>
                        <td style={{ padding: '10px 10px' }}>
                          <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 4, background: ct.tipo === 'Receita' ? 'rgba(16,185,129,.1)' : ct.tipo === 'Despesa' ? 'rgba(239,68,68,.1)' : 'rgba(0,212,255,.1)', color: ct.tipo === 'Receita' ? 'var(--accent3)' : ct.tipo === 'Despesa' ? 'var(--danger)' : 'var(--accent)' }}>{ct.tipo}</span>
                        </td>
                        <td style={{ padding: '10px 10px', textAlign: 'right', fontWeight: 700, color: ct.tipo === 'Receita' ? 'var(--accent3)' : 'var(--danger)' }}>{fmt(ct.valor)}</td>
                        <td style={{ padding: '10px 10px', color: 'var(--muted)', whiteSpace: 'nowrap' }}>{fmtDate(ct.vencimento)}</td>
                        <td style={{ padding: '10px 10px' }}>
                          <div style={{ display: 'flex', gap: 4 }}>
                            <button onClick={() => { setFormConta({ ...ct }); setShowFormConta(true) }} style={{ padding: '4px 8px', borderRadius: 6, background: 'rgba(0,212,255,.08)', border: '1px solid rgba(0,212,255,.2)', color: 'var(--accent)', cursor: 'pointer', fontSize: 11 }}>✏️</button>
                            <button onClick={() => excluirConta(ct.id)} style={{ padding: '4px 8px', borderRadius: 6, background: 'rgba(239,68,68,.08)', border: '1px solid rgba(239,68,68,.2)', color: 'var(--danger)', cursor: 'pointer', fontSize: 11 }}>🗑</button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ══ NOTAS FISCAIS ══ */}
        {aba === 'nfe' && (
          <div>
            <div style={{ display: 'flex', gap: 10, marginBottom: 16, alignItems: 'center' }}>
              <h3 style={{ fontFamily: 'Syne,sans-serif', fontSize: 16, fontWeight: 700 }}>🧾 Notas Fiscais</h3>
              <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
                <div style={{ fontSize: 12, color: 'var(--muted)', padding: '6px 12px', background: 'var(--surface2)', borderRadius: 8, border: '1px solid var(--border)' }}>
                  Total emitido: <strong style={{ color: 'var(--accent3)' }}>{fmt(notas.reduce((a, n) => a + (Number(n.valor) || 0), 0))}</strong>
                </div>
                <button onClick={() => { setFormNf({ ...EMPTY_NF }); setShowFormNf(true) }}
                  style={{ padding: '8px 16px', borderRadius: 8, background: 'linear-gradient(135deg,var(--accent),#0099bb)', border: 'none', color: '#fff', fontFamily: 'DM Mono,monospace', fontSize: 12, cursor: 'pointer', fontWeight: 600 }}>
                  + Nova NF
                </button>
              </div>
            </div>

            {notas.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--muted)', fontSize: 13 }}>Nenhuma nota fiscal registrada.</div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border)' }}>
                      {['Nº', 'Tomador', 'Serviço', 'Valor', 'Competência', 'Status', 'Ações'].map(h => (
                        <th key={h} style={{ padding: '8px 10px', textAlign: h === 'Valor' ? 'right' : 'left', color: 'var(--muted)', fontSize: 10, textTransform: 'uppercase', letterSpacing: 1, fontWeight: 500, whiteSpace: 'nowrap' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {notas.map(n => (
                      <tr key={n.id} style={{ borderBottom: '1px solid var(--border)' }}>
                        <td style={{ padding: '10px 10px', color: 'var(--accent)', fontWeight: 700 }}>#{n.numero}</td>
                        <td style={{ padding: '10px 10px', color: 'var(--text)', fontWeight: 500 }}>{n.tomador}</td>
                        <td style={{ padding: '10px 10px', color: 'var(--muted)' }}>{n.servico || '—'}</td>
                        <td style={{ padding: '10px 10px', textAlign: 'right', fontWeight: 700, color: 'var(--accent3)' }}>{fmt(n.valor)}</td>
                        <td style={{ padding: '10px 10px', color: 'var(--muted)' }}>{n.competencia || '—'}</td>
                        <td style={{ padding: '10px 10px' }}>
                          <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 6, background: n.status === 'Emitida' ? 'rgba(0,212,255,.1)' : 'rgba(239,68,68,.1)', color: corStatus[n.status] || 'var(--muted)' }}>{n.status}</span>
                        </td>
                        <td style={{ padding: '10px 10px' }}>
                          <div style={{ display: 'flex', gap: 4 }}>
                            <button onClick={() => { setFormNf({ ...n }); setShowFormNf(true) }} style={{ padding: '4px 8px', borderRadius: 6, background: 'rgba(0,212,255,.08)', border: '1px solid rgba(0,212,255,.2)', color: 'var(--accent)', cursor: 'pointer', fontSize: 11 }}>✏️</button>
                            <button onClick={async () => { if (!confirm('Excluir?')) return; const l = notas.filter(x => x.id !== n.id); const nc = { ...cfg, fin_notas: l }; await salvarStorage(nc); setNotas(l); setCfg(nc); toast('🗑 NF removida!') }} style={{ padding: '4px 8px', borderRadius: 6, background: 'rgba(239,68,68,.08)', border: '1px solid rgba(239,68,68,.2)', color: 'var(--danger)', cursor: 'pointer', fontSize: 11 }}>🗑</button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ══ PAGAMENTOS ══ */}
        {aba === 'pagamentos' && (
          <div>
            <div style={{ display: 'flex', gap: 10, marginBottom: 16, alignItems: 'center' }}>
              <h3 style={{ fontFamily: 'Syne,sans-serif', fontSize: 16, fontWeight: 700 }}>💰 Pagamentos</h3>
              <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
                <div style={{ fontSize: 12, color: 'var(--muted)', padding: '6px 12px', background: 'var(--surface2)', borderRadius: 8, border: '1px solid var(--border)' }}>
                  Pago: <strong style={{ color: 'var(--accent3)' }}>{fmt(pagamentos.filter(p => p.status === 'Pago').reduce((a, p) => a + (Number(p.valor) || 0), 0))}</strong>
                  {' · '}Pendente: <strong style={{ color: 'var(--warning)' }}>{fmt(pagamentos.filter(p => p.status === 'Pendente').reduce((a, p) => a + (Number(p.valor) || 0), 0))}</strong>
                </div>
                <button onClick={() => { setFormPgto({ ...EMPTY_PGTO }); setShowFormPgto(true) }}
                  style={{ padding: '8px 16px', borderRadius: 8, background: 'linear-gradient(135deg,var(--accent),#0099bb)', border: 'none', color: '#fff', fontFamily: 'DM Mono,monospace', fontSize: 12, cursor: 'pointer', fontWeight: 600 }}>
                  + Novo Pagamento
                </button>
              </div>
            </div>

            {pagamentos.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--muted)', fontSize: 13 }}>Nenhum pagamento registrado.</div>
            ) : (
              pagamentos.map(p => (
                <div key={p.id} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '14px 16px', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--text)' }}>{p.descricao}</div>
                    <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 3 }}>
                      {p.favorecido && `👤 ${p.favorecido} · `}
                      {p.formaPagamento && `${p.formaPagamento} · `}
                      {p.dataPagamento ? `Pgto: ${fmtDate(p.dataPagamento)}` : p.dataEmissao ? `Emissão: ${fmtDate(p.dataEmissao)}` : ''}
                    </div>
                    {(p.pix || p.banco) && (
                      <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>
                        {p.pix && `PIX: ${p.pix}`}
                        {p.banco && ` Banco: ${p.banco}${p.agencia ? ' Ag: ' + p.agencia : ''}${p.conta ? ' CC: ' + p.conta : ''}`}
                      </div>
                    )}
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div style={{ fontFamily: 'Syne,sans-serif', fontSize: 16, fontWeight: 800, color: p.status === 'Pago' ? 'var(--accent3)' : 'var(--warning)' }}>{fmt(p.valor)}</div>
                    <div style={{ fontSize: 11, marginTop: 4, padding: '2px 8px', borderRadius: 4, background: p.status === 'Pago' ? 'rgba(16,185,129,.1)' : 'rgba(245,158,11,.1)', color: p.status === 'Pago' ? 'var(--accent3)' : 'var(--warning)', display: 'inline-block' }}>{p.status}</div>
                  </div>
                  <div style={{ display: 'flex', gap: 4 }}>
                    <button onClick={() => { setFormPgto({ ...p }); setShowFormPgto(true) }} style={{ padding: '6px 10px', borderRadius: 7, background: 'rgba(0,212,255,.08)', border: '1px solid rgba(0,212,255,.2)', color: 'var(--accent)', cursor: 'pointer' }}>✏️</button>
                    <button onClick={async () => { if (!confirm('Excluir?')) return; const l = pagamentos.filter(x => x.id !== p.id); const nc = { ...cfg, fin_pagamentos: l }; await salvarStorage(nc); setPagamentos(l); setCfg(nc); toast('🗑 Removido!') }} style={{ padding: '6px 10px', borderRadius: 7, background: 'rgba(239,68,68,.08)', border: '1px solid rgba(239,68,68,.2)', color: 'var(--danger)', cursor: 'pointer' }}>🗑</button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </main>

      {/* Modal Conta */}
      {showFormConta && (
        <Modal titulo={formConta.id ? 'Editar Lançamento' : 'Novo Lançamento'} onClose={() => setShowFormConta(false)}>
          {[['Descrição *', 'descricao', 'text'], ['Valor (R$)', 'valor', 'number'], ['Vencimento', 'vencimento', 'date'], ['Categoria', 'categoria', 'text']].map(([l, k, t]) => (
            <Fld key={k} label={l}><input type={t} value={formConta[k]} onChange={e => setFormConta(f => ({ ...f, [k]: e.target.value }))} style={inp} /></Fld>
          ))}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Fld label="Tipo">
              <select value={formConta.tipo} onChange={e => setFormConta(f => ({ ...f, tipo: e.target.value }))} style={{ ...inp, cursor: 'pointer' }}>
                {CATEGORIAS.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </Fld>
            <Fld label="Status">
              <select value={formConta.status} onChange={e => setFormConta(f => ({ ...f, status: e.target.value }))} style={{ ...inp, cursor: 'pointer' }}>
                {STATUS_CONTA.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </Fld>
          </div>
          <Fld label="Observações"><textarea value={formConta.observacoes} onChange={e => setFormConta(f => ({ ...f, observacoes: e.target.value }))} rows={2} style={{ ...inp, resize: 'vertical' }} /></Fld>
          <BtnRow onCancel={() => setShowFormConta(false)} onSave={salvarConta} saving={saving} />
        </Modal>
      )}

      {/* Modal NF */}
      {showFormNf && (
        <Modal titulo={formNf.id ? 'Editar Nota Fiscal' : 'Nova Nota Fiscal'} onClose={() => setShowFormNf(false)}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Fld label="Número"><input value={formNf.numero} onChange={e => setFormNf(f => ({ ...f, numero: e.target.value }))} style={inp} placeholder="Automático" /></Fld>
            <Fld label="Competência"><input type="month" value={formNf.competencia} onChange={e => setFormNf(f => ({ ...f, competencia: e.target.value }))} style={inp} /></Fld>
          </div>
          <Fld label="Tomador *"><input value={formNf.tomador} onChange={e => setFormNf(f => ({ ...f, tomador: e.target.value }))} style={inp} /></Fld>
          <Fld label="CNPJ do Tomador"><input value={formNf.cnpjTomador} onChange={e => setFormNf(f => ({ ...f, cnpjTomador: e.target.value }))} style={inp} /></Fld>
          <Fld label="Serviço"><input value={formNf.servico} onChange={e => setFormNf(f => ({ ...f, servico: e.target.value }))} style={inp} /></Fld>
          <Fld label="Descrição"><textarea value={formNf.descricao} onChange={e => setFormNf(f => ({ ...f, descricao: e.target.value }))} rows={2} style={{ ...inp, resize: 'vertical' }} /></Fld>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Fld label="Valor (R$)"><input type="number" value={formNf.valor} onChange={e => setFormNf(f => ({ ...f, valor: e.target.value }))} style={inp} /></Fld>
            <Fld label="Status">
              <select value={formNf.status} onChange={e => setFormNf(f => ({ ...f, status: e.target.value }))} style={{ ...inp, cursor: 'pointer' }}>
                {['Emitida', 'Cancelada', 'Substituída'].map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </Fld>
          </div>
          <BtnRow onCancel={() => setShowFormNf(false)} onSave={salvarNf} saving={saving} />
        </Modal>
      )}

      {/* Modal Pagamento */}
      {showFormPgto && (
        <Modal titulo={formPgto.id ? 'Editar Pagamento' : 'Novo Pagamento'} onClose={() => setShowFormPgto(false)}>
          <Fld label="Descrição *"><input value={formPgto.descricao} onChange={e => setFormPgto(f => ({ ...f, descricao: e.target.value }))} style={inp} /></Fld>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Fld label="Favorecido"><input value={formPgto.favorecido} onChange={e => setFormPgto(f => ({ ...f, favorecido: e.target.value }))} style={inp} /></Fld>
            <Fld label="Valor (R$)"><input type="number" value={formPgto.valor} onChange={e => setFormPgto(f => ({ ...f, valor: e.target.value }))} style={inp} /></Fld>
            <Fld label="Data Emissão"><input type="date" value={formPgto.dataEmissao} onChange={e => setFormPgto(f => ({ ...f, dataEmissao: e.target.value }))} style={inp} /></Fld>
            <Fld label="Data Pagamento"><input type="date" value={formPgto.dataPagamento} onChange={e => setFormPgto(f => ({ ...f, dataPagamento: e.target.value }))} style={inp} /></Fld>
            <Fld label="Forma de Pagamento">
              <select value={formPgto.formaPagamento} onChange={e => setFormPgto(f => ({ ...f, formaPagamento: e.target.value }))} style={{ ...inp, cursor: 'pointer' }}>
                {['PIX', 'Boleto', 'TED/DOC', 'Cartão', 'Cheque', 'Dinheiro'].map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </Fld>
            <Fld label="Status">
              <select value={formPgto.status} onChange={e => setFormPgto(f => ({ ...f, status: e.target.value }))} style={{ ...inp, cursor: 'pointer' }}>
                {['Pendente', 'Pago', 'Cancelado'].map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </Fld>
          </div>
          {formPgto.formaPagamento === 'PIX' && (
            <Fld label="Chave PIX"><input value={formPgto.pix} onChange={e => setFormPgto(f => ({ ...f, pix: e.target.value }))} style={inp} placeholder="CPF, CNPJ, e-mail ou telefone" /></Fld>
          )}
          {['TED/DOC', 'Boleto'].includes(formPgto.formaPagamento) && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
              <Fld label="Banco"><input value={formPgto.banco} onChange={e => setFormPgto(f => ({ ...f, banco: e.target.value }))} style={inp} /></Fld>
              <Fld label="Agência"><input value={formPgto.agencia} onChange={e => setFormPgto(f => ({ ...f, agencia: e.target.value }))} style={inp} /></Fld>
              <Fld label="Conta"><input value={formPgto.conta} onChange={e => setFormPgto(f => ({ ...f, conta: e.target.value }))} style={inp} /></Fld>
            </div>
          )}
          <Fld label="Observações"><textarea value={formPgto.observacoes} onChange={e => setFormPgto(f => ({ ...f, observacoes: e.target.value }))} rows={2} style={{ ...inp, resize: 'vertical' }} /></Fld>
          <BtnRow onCancel={() => setShowFormPgto(false)} onSave={salvarPgto} saving={saving} />
        </Modal>
      )}
    </>
  )
}

function Modal({ titulo, onClose, children }) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.75)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, overflowY: 'auto' }}>
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, width: '100%', maxWidth: 520, padding: '24px', boxShadow: '0 8px 40px rgba(0,0,0,.5)', maxHeight: '90vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h3 style={{ fontFamily: 'Syne,sans-serif', fontSize: 15, fontWeight: 700, color: 'var(--accent)' }}>{titulo}</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--muted)', fontSize: 20, cursor: 'pointer' }}>✕</button>
        </div>
        {children}
      </div>
    </div>
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

function BtnRow({ onCancel, onSave, saving }) {
  return (
    <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 8 }}>
      <button onClick={onCancel} style={{ padding: '10px 18px', borderRadius: 10, background: 'rgba(100,116,139,.12)', border: '1px solid var(--border)', color: 'var(--muted)', fontFamily: 'DM Mono,monospace', fontSize: 13, cursor: 'pointer' }}>Cancelar</button>
      <button onClick={onSave} disabled={saving} style={{ padding: '10px 22px', borderRadius: 10, background: 'linear-gradient(135deg,var(--accent),#0099bb)', border: 'none', color: '#fff', fontFamily: 'DM Mono,monospace', fontSize: 13, fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer' }}>{saving ? '⏳...' : '✅ Salvar'}</button>
    </div>
  )
}

const inp = { width: '100%', background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 8, padding: '9px 12px', fontFamily: 'DM Mono,monospace', fontSize: 13, color: 'var(--text)', outline: 'none' }
const navBtn = { background: 'var(--surface2)', border: '1px solid var(--border)', cursor: 'pointer', color: 'var(--muted)', fontSize: 11, padding: '5px 11px', borderRadius: 8, fontFamily: 'DM Mono,monospace' }

export async function getServerSideProps() { return { props: {} } }
