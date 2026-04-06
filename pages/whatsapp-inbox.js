// pages/whatsapp-inbox.js
// Inbox WhatsApp Vivanexa — inspirado no HelfZap
// Split: lista de conversas (esq) + chat aberto (dir)
// Abas: Automação / Aguardando / Atendendo / Finalizados
// Tags, busca, Agente IA, transferência de fila

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/router'
import Head from 'next/head'
import { supabase } from '../lib/supabase'
import Navbar from '../components/Navbar'

// ── Status labels ─────────────────────────────────────────────
const STATUS = {
  automacao:  { label: 'Automação',  cor: '#7c3aed', bg: 'rgba(124,58,237,.15)' },
  aguardando: { label: 'Aguardando', cor: '#f59e0b', bg: 'rgba(245,158,11,.15)' },
  atendendo:  { label: 'Atendendo',  cor: '#00d4ff', bg: 'rgba(0,212,255,.15)' },
  finalizado: { label: 'Finalizado', cor: '#10b981', bg: 'rgba(16,185,129,.15)' },
}

const ABAS = ['automacao', 'aguardando', 'atendendo', 'finalizado']

const TAGS_PADRAO = [
  { id: 'lead_frio',    label: 'Lead Frio',    cor: '#64748b' },
  { id: 'lead_quente',  label: 'Lead Quente',  cor: '#ef4444' },
  { id: 'dor_demora',   label: 'Dor: Demora',  cor: '#f59e0b' },
  { id: 'dor_controle', label: 'Dor: Controle',cor: '#7c3aed' },
  { id: 'proposta',     label: 'Proposta',     cor: '#00d4ff' },
  { id: 'contrato',     label: 'Contrato',     cor: '#10b981' },
]

function fmtHora(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  const hoje = new Date()
  const diffDias = Math.floor((hoje - d) / 86400000)
  if (diffDias === 0) return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  if (diffDias === 1) return 'ontem'
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
}

function Avatar({ nome, size = 38 }) {
  const ini = (nome || '?').slice(0, 2).toUpperCase()
  const col  = ['#00d4ff','#7c3aed','#10b981','#f59e0b','#ef4444'][
    (nome || '').charCodeAt(0) % 5
  ]
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%',
      background: `${col}22`, border: `2px solid ${col}55`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: size * 0.35, fontWeight: 700, color: col, flexShrink: 0,
      fontFamily: 'Syne, sans-serif',
    }}>
      {ini}
    </div>
  )
}

export default function WhatsappInbox() {
  const router = useRouter()
  const [user, setUser]           = useState(null)
  const [cfg,  setCfg]            = useState({})
  const [empresaId, setEmpresaId] = useState(null)
  const [loading, setLoading]     = useState(true)

  // Conversas
  const [idx, setIdx]               = useState({}) // índice { numero: {...} }
  const [convAtiva, setConvAtiva]   = useState(null) // numero
  const [conv, setConv]             = useState(null) // conversa completa
  const [abaAtiva, setAbaAtiva]     = useState('atendendo')
  const [busca, setBusca]           = useState('')
  const [enviando, setEnviando]     = useState(false)
  const [msgInput, setMsgInput]     = useState('')
  const [loadingConv, setLoadingConv] = useState(false)

  // Sidebar direita
  const [sidebarAberta, setSidebarAberta] = useState(false)

  // Polling
  const pollingRef = useRef(null)
  const msgEndRef  = useRef(null)

  // ── Auth + load ───────────────────────────────────────────────
  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) { router.replace('/'); return }
      let { data: profile } = await supabase.from('perfis').select('*').eq('user_id', session.user.id).maybeSingle()
      if (!profile) {
        const nome = session.user.user_metadata?.name || session.user.email?.split('@')[0] || 'Usuário'
        const { data: p } = await supabase.from('perfis')
          .insert({ user_id: session.user.id, nome, email: session.user.email, empresa_id: session.user.id, perfil: 'admin' })
          .select().single()
        profile = p
      }
      const eid = profile?.empresa_id || session.user.id
      setEmpresaId(eid)
      setUser({ ...session.user, ...profile })

      const { data: row } = await supabase.from('vx_storage').select('value').eq('key', `cfg:${eid}`).single()
      const c = row?.value ? JSON.parse(row.value) : {}
      setCfg(c)
      await carregarIndice(eid)
      setLoading(false)
    })
    return () => { if (pollingRef.current) clearInterval(pollingRef.current) }
  }, [router])

  // ── Polling 5s ───────────────────────────────────────────────
  useEffect(() => {
    if (!empresaId) return
    pollingRef.current = setInterval(() => {
      carregarIndice(empresaId, true)
      if (convAtiva) carregarConv(empresaId, convAtiva, true)
    }, 5000)
    return () => clearInterval(pollingRef.current)
  }, [empresaId, convAtiva])

  // ── Scroll to bottom ─────────────────────────────────────────
  useEffect(() => {
    msgEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [conv?.mensagens])

  async function carregarIndice(eid, silencioso = false) {
    try {
      const { data: row } = await supabase
        .from('vx_storage').select('value').eq('key', `wpp_idx:${eid}`).single()
      if (row?.value) setIdx(JSON.parse(row.value))
    } catch {}
    if (!silencioso) setLoading(false)
  }

  async function carregarConv(eid, numero, silencioso = false) {
    if (!silencioso) setLoadingConv(true)
    try {
      const { data: row } = await supabase
        .from('vx_storage').select('value').eq('key', `wpp_conv:${eid}:${numero}`).single()
      if (row?.value) {
        const c = JSON.parse(row.value)
        setConv(c)
        // Zerar não lidas
        if (c.naoLidas > 0) {
          c.naoLidas = 0
          await supabase.from('vx_storage').upsert({
            key: `wpp_conv:${eid}:${numero}`, value: JSON.stringify(c), updated_at: new Date().toISOString()
          }, { onConflict: 'key' })
          setIdx(prev => ({ ...prev, [numero]: { ...(prev[numero] || {}), naoLidas: 0 } }))
        }
      }
    } catch {}
    if (!silencioso) setLoadingConv(false)
  }

  async function abrirConv(numero) {
    setConvAtiva(numero)
    await carregarConv(empresaId, numero)
    if (window.innerWidth < 768) setSidebarAberta(false)
  }

  // ── Enviar mensagem ───────────────────────────────────────────
  async function enviar() {
    const txt = msgInput.trim()
    if (!txt || !convAtiva || enviando) return
    setEnviando(true)
    setMsgInput('')

    try {
      const r = await fetch('/api/wpp/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ empresaId, numero: convAtiva, mensagem: txt }),
      })
      const data = await r.json()
      if (!r.ok) throw new Error(data.error || 'Erro ao enviar')
      await carregarConv(empresaId, convAtiva, true)
    } catch (err) {
      alert('Erro ao enviar: ' + err.message)
    }
    setEnviando(false)
  }

  // ── Mudar status da conversa ──────────────────────────────────
  async function mudarStatus(novoStatus) {
    if (!conv || !empresaId) return
    const c = { ...conv, status: novoStatus }
    setConv(c)
    await supabase.from('vx_storage').upsert({
      key: `wpp_conv:${empresaId}:${convAtiva}`,
      value: JSON.stringify(c), updated_at: new Date().toISOString()
    }, { onConflict: 'key' })
    setIdx(prev => ({ ...prev, [convAtiva]: { ...(prev[convAtiva] || {}), status: novoStatus } }))
  }

  // ── Toggle tag ────────────────────────────────────────────────
  async function toggleTag(tagId) {
    if (!conv) return
    const tags = conv.tags || []
    const novasTags = tags.includes(tagId) ? tags.filter(t => t !== tagId) : [...tags, tagId]
    const c = { ...conv, tags: novasTags }
    setConv(c)
    await supabase.from('vx_storage').upsert({
      key: `wpp_conv:${empresaId}:${convAtiva}`,
      value: JSON.stringify(c), updated_at: new Date().toISOString()
    }, { onConflict: 'key' })
    setIdx(prev => ({ ...prev, [convAtiva]: { ...(prev[convAtiva] || {}), tags: novasTags } }))
  }

  // ── Filtros ───────────────────────────────────────────────────
  const listaFiltrada = Object.values(idx)
    .filter(c => c.status === abaAtiva)
    .filter(c => {
      if (!busca) return true
      const q = busca.toLowerCase()
      return (c.nome || '').toLowerCase().includes(q) || (c.numero || '').includes(q)
    })
    .sort((a, b) => new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0))

  const contadores = {}
  for (const aba of ABAS) {
    contadores[aba] = Object.values(idx).filter(c => c.status === aba).length
  }

  const tagsDisponiveis = cfg.wppTags?.length ? cfg.wppTags : TAGS_PADRAO

  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0a0f1e', color: '#64748b', fontFamily: 'DM Mono, monospace' }}>
      Carregando inbox...
    </div>
  )

  return (
    <>
      <Head>
        <title>WhatsApp Inbox – Vivanexa</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <link href="https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=DM+Mono:wght@300;400;500&display=swap" rel="stylesheet" />
      </Head>
      <style>{CSS}</style>

      <Navbar cfg={cfg} perfil={user} />

      <div className="inbox-wrap">

        {/* ══════════════════════════════════════════
            COLUNA ESQUERDA — Lista de conversas
        ═══════════════════════════════════════════ */}
        <div className={`conv-list ${convAtiva && window?.innerWidth < 768 ? 'hidden-mobile' : ''}`}>

          {/* Header lista */}
          <div className="list-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 20 }}>💬</span>
              <span style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 15, color: 'var(--text)' }}>WhatsApp Inbox</span>
            </div>
            <button
              onClick={() => router.push('/configuracoes?tab=whatsapp')}
              className="btn-icon" title="Configurações WhatsApp"
            >⚙️</button>
          </div>

          {/* Busca */}
          <div className="busca-wrap">
            <span className="busca-icon">🔍</span>
            <input
              className="busca-input"
              placeholder="Buscar conversas..."
              value={busca}
              onChange={e => setBusca(e.target.value)}
            />
          </div>

          {/* Abas */}
          <div className="abas-list">
            {ABAS.map(aba => (
              <button
                key={aba}
                onClick={() => setAbaAtiva(aba)}
                className={`aba-btn ${abaAtiva === aba ? 'ativa' : ''}`}
              >
                {STATUS[aba].label}
                {contadores[aba] > 0 && (
                  <span className="aba-count" style={{ background: STATUS[aba].cor }}>{contadores[aba]}</span>
                )}
              </button>
            ))}
          </div>

          {/* Lista */}
          <div className="conv-items">
            {listaFiltrada.length === 0 ? (
              <div className="empty-list">
                <div style={{ fontSize: 36, marginBottom: 10 }}>💬</div>
                <div>Nenhuma conversa em <strong>{STATUS[abaAtiva].label}</strong></div>
                {abaAtiva === 'atendendo' && (
                  <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 8 }}>
                    Configure o WhatsApp em Config → WhatsApp
                  </div>
                )}
              </div>
            ) : listaFiltrada.map(c => (
              <div
                key={c.numero}
                onClick={() => abrirConv(c.numero)}
                className={`conv-item ${convAtiva === c.numero ? 'ativa' : ''}`}
              >
                <Avatar nome={c.nome} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                    <div className="conv-nome">{c.nome || c.numero}</div>
                    <div className="conv-hora">{fmtHora(c.updatedAt)}</div>
                  </div>
                  <div className="conv-preview">{c.ultimaMensagem || '...'}</div>
                  {(c.tags || []).length > 0 && (
                    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 4 }}>
                      {(c.tags || []).slice(0, 3).map(tagId => {
                        const t = tagsDisponiveis.find(x => x.id === tagId)
                        return t ? (
                          <span key={tagId} className="tag-chip" style={{ borderColor: t.cor + '55', color: t.cor, background: t.cor + '15' }}>
                            {t.label}
                          </span>
                        ) : null
                      })}
                    </div>
                  )}
                </div>
                {(c.naoLidas || 0) > 0 && (
                  <span className="badge-naoLidas">{c.naoLidas}</span>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* ══════════════════════════════════════════
            COLUNA DIREITA — Chat aberto
        ═══════════════════════════════════════════ */}
        <div className="chat-area">
          {!convAtiva ? (
            <div className="chat-vazio">
              <div style={{ fontSize: 56, marginBottom: 16 }}>💬</div>
              <div style={{ fontFamily: 'Syne, sans-serif', fontSize: 18, fontWeight: 700, color: 'var(--text)', marginBottom: 8 }}>Atendimentos</div>
              <div style={{ fontSize: 13, color: 'var(--muted)' }}>Selecione uma conversa para visualizar ou inicie um novo atendimento</div>
              <button
                onClick={() => router.push('/configuracoes?tab=whatsapp')}
                className="btn-primary" style={{ marginTop: 20 }}
              >
                ⚙️ Configurar WhatsApp
              </button>
            </div>
          ) : loadingConv ? (
            <div className="chat-vazio">
              <div style={{ color: 'var(--muted)', fontSize: 14 }}>Carregando conversa...</div>
            </div>
          ) : conv ? (
            <>
              {/* Header chat */}
              <div className="chat-header">
                <button className="btn-back" onClick={() => setConvAtiva(null)}>←</button>
                <Avatar nome={conv.nome} size={34} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {conv.nome || conv.numero}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--muted)' }}>{conv.numero}</div>
                </div>

                {/* Status badge */}
                <div style={{
                  fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20,
                  background: STATUS[conv.status]?.bg, color: STATUS[conv.status]?.cor,
                  border: `1px solid ${STATUS[conv.status]?.cor}44`,
                }}>
                  {STATUS[conv.status]?.label}
                </div>

                {/* Ações rápidas */}
                <div style={{ display: 'flex', gap: 6 }}>
                  {conv.status !== 'atendendo' && (
                    <button onClick={() => mudarStatus('atendendo')} className="btn-acao verde">
                      ▶ Atender
                    </button>
                  )}
                  {conv.status !== 'aguardando' && conv.status !== 'finalizado' && (
                    <button onClick={() => mudarStatus('aguardando')} className="btn-acao amarelo">
                      ⏸ Aguardar
                    </button>
                  )}
                  {conv.status !== 'finalizado' && (
                    <button onClick={() => mudarStatus('finalizado')} className="btn-acao cinza">
                      ✓ Finalizar
                    </button>
                  )}
                  <button onClick={() => setSidebarAberta(!sidebarAberta)} className="btn-icon" title="Detalhes">
                    ℹ️
                  </button>
                </div>
              </div>

              {/* Área de mensagens */}
              <div className="mensagens">
                {(conv.mensagens || []).map(m => (
                  <div
                    key={m.id}
                    className={`msg-wrap ${m.de === 'empresa' ? 'enviada' : 'recebida'}`}
                  >
                    <div className={`msg-bubble ${m.de === 'empresa' ? 'enviada' : 'recebida'}`}>
                      {m.tipo === 'image' && m.mediaUrl && (
                        <img src={m.mediaUrl} alt="imagem" style={{ maxWidth: 220, borderRadius: 8, display: 'block', marginBottom: 4 }} />
                      )}
                      <div style={{ fontSize: 14, lineHeight: 1.55, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                        {m.texto}
                      </div>
                      <div className="msg-hora">{fmtHora(m.at)}</div>
                    </div>
                  </div>
                ))}
                <div ref={msgEndRef} />
              </div>

              {/* Input de mensagem */}
              {conv.status !== 'finalizado' ? (
                <div className="input-area">
                  <textarea
                    className="msg-input"
                    placeholder="Digite uma mensagem..."
                    value={msgInput}
                    onChange={e => setMsgInput(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); enviar() } }}
                    rows={1}
                  />
                  <button
                    onClick={enviar}
                    disabled={enviando || !msgInput.trim()}
                    className="btn-send"
                  >
                    {enviando ? '⏳' : (
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <line x1="22" y1="2" x2="11" y2="13" />
                        <polygon points="22 2 15 22 11 13 2 9 22 2" />
                      </svg>
                    )}
                  </button>
                </div>
              ) : (
                <div className="conv-finalizada">
                  ✅ Conversa finalizada ·{' '}
                  <button onClick={() => mudarStatus('atendendo')} style={{ background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer', fontFamily: 'DM Mono, monospace', fontSize: 12, textDecoration: 'underline' }}>
                    Reabrir
                  </button>
                </div>
              )}
            </>
          ) : null}
        </div>

        {/* ══════════════════════════════════════════
            SIDEBAR DIREITA — Detalhes / Tags / Ações
        ═══════════════════════════════════════════ */}
        {conv && sidebarAberta && (
          <div className="sidebar-det">
            <div className="sidebar-header">
              <span style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 14, color: 'var(--accent)' }}>Detalhes</span>
              <button onClick={() => setSidebarAberta(false)} className="btn-icon">✕</button>
            </div>

            <div style={{ padding: '16px' }}>
              {/* Info do contato */}
              <div className="det-card">
                <Avatar nome={conv.nome} size={48} />
                <div style={{ marginTop: 10, textAlign: 'center' }}>
                  <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--text)' }}>{conv.nome || conv.numero}</div>
                  <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>📱 {conv.numero}</div>
                </div>
              </div>

              {/* Tags */}
              <div style={{ marginTop: 16 }}>
                <div className="det-label">🏷️ Tags</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
                  {tagsDisponiveis.map(tag => {
                    const ativa = (conv.tags || []).includes(tag.id)
                    return (
                      <button
                        key={tag.id}
                        onClick={() => toggleTag(tag.id)}
                        style={{
                          padding: '4px 12px', borderRadius: 20, fontSize: 12, cursor: 'pointer',
                          fontFamily: 'DM Mono, monospace', fontWeight: ativa ? 700 : 400,
                          background: ativa ? tag.cor + '25' : 'var(--surface2)',
                          border: `1.5px solid ${ativa ? tag.cor : 'var(--border)'}`,
                          color: ativa ? tag.cor : 'var(--muted)',
                        }}
                      >
                        {tag.label}
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Mudar status */}
              <div style={{ marginTop: 16 }}>
                <div className="det-label">📌 Status</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 8 }}>
                  {ABAS.map(aba => (
                    <button
                      key={aba}
                      onClick={() => mudarStatus(aba)}
                      style={{
                        padding: '8px 14px', borderRadius: 8, fontSize: 12, cursor: 'pointer',
                        fontFamily: 'DM Mono, monospace', textAlign: 'left',
                        background: conv.status === aba ? STATUS[aba].bg : 'var(--surface2)',
                        border: `1.5px solid ${conv.status === aba ? STATUS[aba].cor + '55' : 'var(--border)'}`,
                        color: conv.status === aba ? STATUS[aba].cor : 'var(--muted)',
                        fontWeight: conv.status === aba ? 700 : 400,
                      }}
                    >
                      {STATUS[aba].label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Ações */}
              <div style={{ marginTop: 16 }}>
                <div className="det-label">⚡ Ações Rápidas</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>
                  <button
                    onClick={() => {
                      const msg = `Olá! Aqui é da equipe ${cfg.company || 'Vivanexa'}. Como posso ajudá-lo hoje? 😊`
                      setMsgInput(msg)
                      setSidebarAberta(false)
                    }}
                    className="btn-acao-full"
                  >
                    👋 Saudação padrão
                  </button>
                  <button
                    onClick={() => router.push(`/crm?busca=${conv.numero}`)}
                    className="btn-acao-full"
                  >
                    🤝 Abrir no CRM
                  </button>
                  <button
                    onClick={() => router.push(`/chat`)}
                    className="btn-acao-full"
                  >
                    💬 Gerar Proposta
                  </button>
                </div>
              </div>

              {/* Total de mensagens */}
              <div style={{ marginTop: 16, padding: '10px 14px', background: 'var(--surface2)', borderRadius: 8, fontSize: 12, color: 'var(--muted)' }}>
                📊 {(conv.mensagens || []).length} mensagens nesta conversa
              </div>
            </div>
          </div>
        )}

      </div>
    </>
  )
}

const CSS = `
  :root{--bg:#0a0f1e;--surface:#111827;--surface2:#1a2540;--border:#1e2d4a;--accent:#00d4ff;--accent2:#7c3aed;--accent3:#10b981;--text:#e2e8f0;--muted:#64748b;--danger:#ef4444;--warning:#f59e0b;--shadow:0 4px 24px rgba(0,0,0,.4)}
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:'DM Mono',monospace;background:var(--bg);color:var(--text);min-height:100vh}

  .inbox-wrap{display:flex;height:calc(100vh - 48px);overflow:hidden;position:relative}

  /* ── LISTA ── */
  .conv-list{width:320px;min-width:280px;max-width:340px;display:flex;flex-direction:column;border-right:1px solid var(--border);background:var(--surface);flex-shrink:0;height:100%;overflow:hidden}
  .list-header{padding:14px 16px;display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid var(--border);background:var(--surface2)}
  .busca-wrap{display:flex;align-items:center;gap:8px;padding:10px 12px;border-bottom:1px solid var(--border)}
  .busca-icon{font-size:14px;color:var(--muted);flex-shrink:0}
  .busca-input{flex:1;background:var(--surface2);border:1px solid var(--border);borderRadius:8px;padding:7px 10px;font-family:DM Mono,monospace;font-size:12px;color:var(--text);outline:none;border-radius:8px}
  .busca-input:focus{border-color:var(--accent)}
  .abas-list{display:flex;gap:0;border-bottom:1px solid var(--border);background:var(--surface2);overflow-x:auto}
  .aba-btn{flex:1;padding:9px 6px;border:none;background:none;color:var(--muted);font-family:DM Mono,monospace;font-size:10px;cursor:pointer;border-bottom:2px solid transparent;position:relative;top:1px;display:flex;align-items:center;justify-content:center;gap:4px;white-space:nowrap;transition:color .2s}
  .aba-btn.ativa{color:var(--accent);border-bottom-color:var(--accent)}
  .aba-count{padding:1px 5px;border-radius:10px;font-size:9px;color:#fff;font-weight:700}
  .conv-items{flex:1;overflow-y:auto}
  .conv-items::-webkit-scrollbar{width:3px}.conv-items::-webkit-scrollbar-thumb{background:var(--border);border-radius:3px}
  .conv-item{display:flex;align-items:flex-start;gap:10px;padding:12px 14px;cursor:pointer;border-bottom:1px solid var(--border);transition:background .15s;position:relative}
  .conv-item:hover{background:var(--surface2)}
  .conv-item.ativa{background:rgba(0,212,255,.06);border-left:3px solid var(--accent)}
  .conv-nome{font-size:13px;font-weight:600;color:var(--text);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  .conv-hora{font-size:10px;color:var(--muted);flex-shrink:0}
  .conv-preview{font-size:11px;color:var(--muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;margin-top:2px}
  .tag-chip{padding:2px 7px;border-radius:10px;font-size:10px;font-weight:600;border:1px solid;white-space:nowrap}
  .badge-naoLidas{position:absolute;top:12px;right:12px;background:#ef4444;color:#fff;font-size:10px;font-weight:700;padding:2px 6px;border-radius:10px;min-width:18px;text-align:center}
  .empty-list{text-align:center;padding:40px 20px;color:var(--muted);font-size:13px}

  /* ── CHAT ── */
  .chat-area{flex:1;display:flex;flex-direction:column;height:100%;overflow:hidden;background:var(--bg);min-width:0}
  .chat-vazio{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;color:var(--muted);font-size:13px;padding:40px}
  .chat-header{padding:12px 16px;border-bottom:1px solid var(--border);background:var(--surface2);display:flex;align-items:center;gap:10px;flex-shrink:0;flex-wrap:wrap}
  .mensagens{flex:1;overflow-y:auto;padding:16px;display:flex;flex-direction:column;gap:8px}
  .mensagens::-webkit-scrollbar{width:4px}.mensagens::-webkit-scrollbar-thumb{background:var(--border);border-radius:4px}
  .msg-wrap{display:flex}.msg-wrap.enviada{justify-content:flex-end}.msg-wrap.recebida{justify-content:flex-start}
  .msg-bubble{max-width:68%;padding:10px 14px;border-radius:14px;font-size:13px;line-height:1.6;word-break:break-word}
  .msg-bubble.enviada{background:rgba(0,212,255,.12);border:1px solid rgba(0,212,255,.2);border-bottom-right-radius:4px}
  .msg-bubble.recebida{background:var(--surface);border:1px solid var(--border);border-bottom-left-radius:4px}
  .msg-hora{font-size:10px;color:var(--muted);text-align:right;margin-top:4px}
  .input-area{padding:12px 16px;border-top:1px solid var(--border);display:flex;gap:10px;align-items:flex-end;background:var(--surface2);flex-shrink:0}
  .msg-input{flex:1;background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:10px 14px;font-family:DM Mono,monospace;font-size:13px;color:var(--text);outline:none;resize:none;min-height:42px;max-height:100px;line-height:1.5}
  .msg-input:focus{border-color:var(--accent)}
  .btn-send{width:42px;height:42px;border-radius:12px;background:linear-gradient(135deg,#00d4ff,#0099bb);border:none;color:#fff;cursor:pointer;display:flex;align-items:center;justify-content:center;flex-shrink:0;transition:all .2s}
  .btn-send:hover:not(:disabled){box-shadow:0 0 16px rgba(0,212,255,.4);transform:translateY(-1px)}
  .btn-send:disabled{opacity:.5;cursor:not-allowed}
  .conv-finalizada{padding:12px 16px;text-align:center;font-size:12px;color:var(--muted);border-top:1px solid var(--border);background:var(--surface2);flex-shrink:0}

  /* ── SIDEBAR DETALHES ── */
  .sidebar-det{width:260px;min-width:240px;border-left:1px solid var(--border);background:var(--surface);overflow-y:auto;flex-shrink:0;height:100%}
  .sidebar-header{padding:14px 16px;display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid var(--border);background:var(--surface2)}
  .det-card{background:var(--surface2);border:1px solid var(--border);border-radius:12px;padding:16px;display:flex;flex-direction:column;align-items:center}
  .det-label{font-size:10px;color:var(--muted);letter-spacing:1.5px;text-transform:uppercase}

  /* ── BOTÕES ── */
  .btn-primary{padding:10px 20px;border-radius:10px;background:linear-gradient(135deg,#00d4ff,#0099bb);border:none;color:#fff;font-family:DM Mono,monospace;font-size:13px;font-weight:600;cursor:pointer;transition:all .2s}
  .btn-primary:hover{box-shadow:0 0 16px rgba(0,212,255,.4);transform:translateY(-1px)}
  .btn-icon{background:none;border:1px solid var(--border);color:var(--muted);padding:6px 10px;border-radius:8px;cursor:pointer;font-size:14px;transition:all .15s;flex-shrink:0}
  .btn-icon:hover{color:var(--accent);border-color:rgba(0,212,255,.3)}
  .btn-back{display:none;background:none;border:none;color:var(--muted);font-size:20px;cursor:pointer;padding:4px 8px}
  .btn-acao{padding:6px 12px;border-radius:8px;font-family:DM Mono,monospace;font-size:11px;font-weight:600;cursor:pointer;border:1.5px solid;transition:all .15s;flex-shrink:0}
  .btn-acao.verde{background:rgba(16,185,129,.12);border-color:rgba(16,185,129,.35);color:#10b981}
  .btn-acao.amarelo{background:rgba(245,158,11,.12);border-color:rgba(245,158,11,.35);color:#f59e0b}
  .btn-acao.cinza{background:rgba(100,116,139,.12);border-color:rgba(100,116,139,.3);color:#64748b}
  .btn-acao-full{width:100%;padding:9px 14px;border-radius:8px;background:var(--surface2);border:1px solid var(--border);color:var(--muted);font-family:DM Mono,monospace;font-size:12px;cursor:pointer;text-align:left;transition:all .15s}
  .btn-acao-full:hover{color:var(--accent);border-color:rgba(0,212,255,.3)}

  /* ── MOBILE ── */
  @media(max-width:768px){
    .conv-list{width:100%!important;max-width:100%!important}
    .chat-area{position:absolute;inset:0;z-index:10;display:none}
    .chat-area.aberta{display:flex}
    .btn-back{display:block}
    .sidebar-det{display:none}
  }
`
