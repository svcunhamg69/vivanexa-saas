// pages/sign/[token].js
// ============================================================
// Página pública de assinatura eletrônica
// Fluxo: cliente recebe link → abre → vê contrato → assina
// Após assinar: mostra "já assinado" se acessar novamente
// Salva assinatura no Supabase: vx_storage key = "doc:{token}"
// ============================================================

import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import Head from 'next/head'
import { supabase } from '../../lib/supabase'

function fmt(v) {
  return Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function fmtCPF(v) {
  const s = v.replace(/\D/g, '')
  if (s.length === 11) return s.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4')
  return v
}

export default function SignPage() {
  const router = useRouter()
  const { token } = router.query

  const [fase, setFase] = useState('carregando') // carregando | assinando | ja_assinado | sucesso | erro
  const [doc, setDoc] = useState(null)
  const [cfg, setCfg] = useState(null)

  // Formulário
  const [nome,   setNome]   = useState('')
  const [cpf,    setCpf]    = useState('')
  const [email,  setEmail]  = useState('')
  const [agreed, setAgreed] = useState(false)
  const [saving, setSaving] = useState(false)
  const [erroMsg, setErroMsg] = useState('')

  useEffect(() => {
    if (!token) return
    carregarDoc(token)
  }, [token])

  async function carregarDoc(tk) {
    try {
      // Busca o documento pelo token
      const { data: docRow } = await supabase
        .from('vx_storage')
        .select('value')
        .eq('key', `doc:${tk}`)
        .single()

      if (!docRow?.value) { setFase('erro'); return }
      const docData = JSON.parse(docRow.value)
      setDoc(docData)

      // Busca config da empresa (para logo, nome etc.)
      if (docData.empresaId) {
        const { data: cfgRow } = await supabase
          .from('vx_storage')
          .select('value')
          .eq('key', `cfg:${docData.empresaId}`)
          .single()
        if (cfgRow?.value) {
          try { setCfg(JSON.parse(cfgRow.value)) } catch {}
        }
      }

      // Se já foi assinado pelo cliente
      if (docData.signedAt && docData.signedBy) {
        setFase('ja_assinado')
      } else {
        setFase('assinando')
      }
    } catch (e) {
      console.error(e)
      setFase('erro')
    }
  }

  async function confirmarAssinatura() {
    if (!nome.trim()) { setErroMsg('Informe seu nome completo.'); return }
    if (!cpf.trim())  { setErroMsg('Informe seu CPF.'); return }
    if (!email.trim()) { setErroMsg('Informe seu e-mail.'); return }
    if (!agreed)      { setErroMsg('Você precisa aceitar os termos para assinar.'); return }

    setSaving(true)
    setErroMsg('')

    try {
      const now = new Date()
      const nowStr = now.toLocaleString('pt-BR')

      const docAtualizado = {
        ...doc,
        signedAt:  nowStr,
        signedBy:  nome.trim(),
        signCPF:   cpf.trim(),
        signEmail: email.trim(),
        signIP:    '(web)',
        status:    'pending', // fica pending até consultor também assinar
      }

      // Salva documento atualizado no Supabase
      const { error } = await supabase.from('vx_storage').upsert({
        key:        `doc:${token}`,
        value:      JSON.stringify(docAtualizado),
        updated_at: now.toISOString(),
      })

      if (error) throw error

      // Atualiza também o docHistory na cfg da empresa (sem html para economizar)
      if (doc.empresaId) {
        const { data: cfgRow } = await supabase
          .from('vx_storage').select('value').eq('key', `cfg:${doc.empresaId}`).single()
        if (cfgRow?.value) {
          try {
            const cfgData = JSON.parse(cfgRow.value)
            if (cfgData.docHistory) {
              cfgData.docHistory = cfgData.docHistory.map(h =>
                h.signToken === token
                  ? { ...h, signedAt: nowStr, signedBy: nome.trim(), signCPF: cpf.trim(), signEmail: email.trim(), status: 'pending' }
                  : h
              )
              await supabase.from('vx_storage').upsert({
                key: `cfg:${doc.empresaId}`,
                value: JSON.stringify(cfgData),
                updated_at: now.toISOString(),
              })
            }
          } catch {}
        }
      }

      setDoc(docAtualizado)
      setFase('sucesso')
    } catch (e) {
      console.error(e)
      setErroMsg('Erro ao salvar assinatura. Tente novamente.')
    } finally {
      setSaving(false)
    }
  }

  const empresa = cfg?.company || doc?.empresa || 'Vivanexa'
  const logoB64  = cfg?.logob64 || null

  // ── RENDER ────────────────────────────────────────────────

  if (fase === 'carregando') return (
    <Tela empresa={empresa} logo={logoB64}>
      <div style={st.centro}>
        <div style={st.spinner} />
        <p style={{ color: 'var(--muted)', fontSize: 14, marginTop: 20 }}>Carregando documento...</p>
      </div>
    </Tela>
  )

  if (fase === 'erro') return (
    <Tela empresa={empresa} logo={logoB64}>
      <div style={st.card}>
        <div style={{ fontSize: 48, textAlign: 'center', marginBottom: 16 }}>❌</div>
        <h2 style={{ ...st.titulo, color: 'var(--danger)', textAlign: 'center' }}>Documento não encontrado</h2>
        <p style={st.sub}>Este link de assinatura é inválido ou expirou. Solicite um novo link ao consultor.</p>
      </div>
    </Tela>
  )

  if (fase === 'ja_assinado') return (
    <Tela empresa={empresa} logo={logoB64}>
      <div style={st.card}>
        <div style={{ fontSize: 56, textAlign: 'center', marginBottom: 16 }}>✅</div>
        <h2 style={{ ...st.titulo, color: 'var(--accent3)', textAlign: 'center' }}>Documento já assinado</h2>
        <p style={{ ...st.sub, textAlign: 'center' }}>
          Este contrato foi assinado por <strong style={{ color: 'var(--text)' }}>{doc?.signedBy}</strong> em {doc?.signedAt}.
        </p>
        <p style={{ ...st.sub, textAlign: 'center', marginTop: 8 }}>
          Não é necessária nenhuma ação adicional. Você pode fechar esta página.
        </p>
        <div style={{ textAlign: 'center', marginTop: 20 }}>
          <span style={st.badge}>Lei nº 14.063/2020 — Assinatura Eletrônica</span>
        </div>
      </div>
    </Tela>
  )

  if (fase === 'sucesso') return (
    <Tela empresa={empresa} logo={logoB64}>
      <div style={st.card}>
        <div style={{ fontSize: 56, textAlign: 'center', marginBottom: 16 }}>✅</div>
        <h2 style={{ ...st.titulo, color: 'var(--accent3)', textAlign: 'center' }}>Assinatura registrada!</h2>
        <p style={{ ...st.sub, textAlign: 'center' }}>
          Obrigado, <strong style={{ color: 'var(--text)' }}>{nome}</strong>! Sua assinatura foi registrada com sucesso.
        </p>
        <p style={{ ...st.sub, textAlign: 'center', marginTop: 8 }}>
          O consultor responsável também precisará assinar para finalizar o documento. Uma cópia será enviada por e-mail.
        </p>
        <div style={{ textAlign: 'center', marginTop: 20 }}>
          <span style={st.badge}>Conforme a Lei nº 14.063/2020</span>
        </div>
      </div>
    </Tela>
  )

  // ── FASE: ASSINANDO ───────────────────────────────────────
  const tipoLabel = doc?.type === 'proposta' ? 'Proposta Comercial' : 'Termo de Pedido e Registro de Software'

  return (
    <Tela empresa={empresa} logo={logoB64}>
      <Head>
        <title>Assinar — {tipoLabel}</title>
      </Head>

      {/* Preview do documento */}
      {doc?.html && (
        <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0', marginBottom: 24, overflow: 'hidden', boxShadow: '0 2px 12px rgba(0,0,0,.08)' }}>
          <div style={{ padding: '10px 16px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0', fontSize: 12, color: '#64748b', display: 'flex', alignItems: 'center', gap: 8 }}>
            <span>📄</span>
            <span style={{ fontWeight: 600, color: '#1e293b' }}>{tipoLabel}</span>
            <span>·</span>
            <span>{doc.clientName || 'Cliente'}</span>
            {/* Adicionar botão de download se for PDF ou opção de expandir */}
            {doc.pdfUrl && (
              <a href={doc.pdfUrl} target="_blank" rel="noopener noreferrer"
                style={{ marginLeft: 'auto', padding: '4px 8px', borderRadius: 6, background: '#e0f2f7', border: '1px solid #b2e0ed', color: '#007bff', fontSize: 11, textDecoration: 'none', fontWeight: 600 }}>
                ⬇️ Baixar PDF
              </a>
            )}
          </div>
          <div
            style={{ padding: 0, maxHeight: 480, overflowY: 'auto', fontSize: 13 }}
            dangerouslySetInnerHTML={{ __html: doc.html }}
          />
        </div>
      )}

      {/* Card de assinatura */}
      <div style={st.card}>
        <h2 style={st.titulo}>✍️ Confirmar e Assinar</h2>
        <p style={st.sub}>
          Leia o documento acima com atenção. Ao assinar, você concorda com todos os termos apresentados,
          conforme a <strong>Lei nº 14.063/2020</strong> (assinatura eletrônica).
        </p>

        <div style={{ marginTop: 20 }}>
          <div style={st.campo}>
            <label style={st.label}>Nome completo *</label>
            <input style={st.input} value={nome} onChange={e => setNome(e.target.value)} placeholder="Seu nome completo" />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div style={st.campo}>
              <label style={st.label}>CPF *</label>
              <input style={st.input} value={cpf} onChange={e => setCpf(e.target.value)}
                placeholder="000.000.000-00"
                onBlur={e => setCpf(fmtCPF(e.target.value))} />
            </div>
            <div style={st.campo}>
              <label style={st.label}>E-mail *</label>
              <input style={st.input} type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="seu@email.com" />
            </div>
          </div>

          <div
            onClick={() => setAgreed(!agreed)}
            style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '14px 16px', background: agreed ? 'rgba(16,185,129,.06)' : 'rgba(100,116,139,.06)', border: `1px solid ${agreed ? 'rgba(16,185,129,.3)' : 'var(--border)'}`, borderRadius: 10, cursor: 'pointer', marginTop: 4, transition: 'all .2s' }}>
            <div style={{ width: 20, height: 20, borderRadius: 6, border: `2px solid ${agreed ? 'var(--accent3)' : 'var(--border)'}`, background: agreed ? 'var(--accent3)' : 'transparent', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: 1 }}>
              {agreed && <span style={{ color: '#fff', fontSize: 12, fontWeight: 700 }}>✓</span>}
            </div>
            <p style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 1.6, margin: 0 }}>
              Li e concordo com todos os termos e condições do documento acima. Entendo que esta assinatura eletrônica tem validade jurídica conforme a Lei nº 14.063/2020.
            </p>
          </div>

          {erroMsg && (
            <div style={{ padding: '10px 14px', background: 'rgba(239,68,68,.1)', border: '1px solid rgba(239,68,68,.3)', borderRadius: 8, fontSize: 13, color: 'var(--danger)', marginTop: 12 }}>
              ⚠️ {erroMsg}
            </div>
          )}

          <button
            onClick={confirmarAssinatura}
            disabled={saving}
            style={{ width: '100%', marginTop: 16, padding: '14px', borderRadius: 12, background: saving ? 'rgba(16,185,129,.4)' : 'linear-gradient(135deg,var(--accent3),#059669)', border: 'none', color: '#fff', fontFamily: 'DM Mono, monospace', fontSize: 15, fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer', letterSpacing: .5, transition: 'all .2s' }}>
            {saving ? '⏳ Registrando assinatura...' : '✅ Assinar Documento'}
          </button>

          <p style={{ fontSize: 11, color: 'var(--muted)', textAlign: 'center', marginTop: 12, lineHeight: 1.6 }}>
            Ao clicar em "Assinar", seu nome, CPF, e-mail, data e hora serão registrados como parte da assinatura eletrônica deste documento.
          </p>
        </div>
      </div>
    </Tela>
  )
}

// ── Layout wrapper ────────────────────────────────────────────
function Tela({ empresa, logo, children }) {
  return (
    <>
      <Head>
        <title>Assinatura Eletrônica — {empresa}</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <link href="https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=DM+Mono:wght@400;500&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
      </Head>
      <style>{`
        :root{--bg:#0a0f1e;--surface:#111827;--surface2:#1a2540;--border:#1e2d4a;--accent:#00d4ff;--accent2:#7c3aed;--accent3:#10b981;--text:#e2e8f0;--muted:#64748b;--danger:#ef4444;--shadow:0 4px 24px rgba(0,0,0,.4)}
        *{box-sizing:border-box;margin:0;padding:0}
        html{font-size:15px} /* Adicionado para consistência */
        body{font-family:'DM Mono',monospace;background:var(--bg);color:var(--text);min-height:100vh;display:flex;flex-direction:column;align-items:center;overflow-x:hidden} /* Ajustado para centralizar */
        body::before{content:'';position:fixed;inset:0;background-image:linear-gradient(rgba(0,212,255,.025) 1px,transparent 1px),linear-gradient(90deg,rgba(0,212,255,.025) 1px,transparent 1px);background-size:40px 40px;pointer-events:none;z-index:0}
        input, select, textarea {font-family:'DM Mono',monospace} /* Adicionado para consistência */
        ::-webkit-scrollbar{width:4px}::-webkit-scrollbar-thumb{background:var(--border);border-radius:4px}
        @keyframes spin{to{transform:rotate(360deg)}} /* Adicionado keyframe do spinner */

        /* Estilos para o header e main para melhor layout */
        header{position:sticky;top:0;z-index:100;width:100%;background:rgba(10,15,30,.9);backdrop-filter:blur(12px);border-bottom:1px solid var(--border);padding:12px 20px;display:flex;align-items:center;gap:12px}
        main{position:relative;z-index:10;width:100%;max-width:720px;margin:28px auto 60px;padding:0 16px;flex:1} /* Flex 1 para ocupar espaço */
      `}</style>
      <div style={{ position: 'fixed', width: 500, height: 500, background: 'var(--accent)', top: -200, right: -150, borderRadius: '50%', filter: 'blur(120px)', opacity: .06, pointerEvents: 'none', zIndex: 0 }} />
      <div style={{ position: 'fixed', width: 400, height: 400, background: 'var(--accent2)', bottom: -150, left: -100, borderRadius: '50%', filter: 'blur(120px)', opacity: .06, pointerEvents: 'none', zIndex: 0 }} />

      {/* Header */}
      <header>
        {logo
          ? <img src={logo} alt={empresa} style={{ height: 36, objectFit: 'contain' }} />
          : <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: 18, color: 'var(--accent)' }}>{empresa}</div>
        }
        <div style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--muted)' }}>✍️ Assinatura Eletrônica</div>
      </header>

      <main>
        {children}
      </main>
    </>
  )
}

// ── Estilos locais ────────────────────────────────────────────
const st = {
  card: {
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    borderRadius: 16,
    padding: '28px 32px',
    boxShadow: 'var(--shadow)',
  },
  titulo: {
    fontFamily: 'Syne, sans-serif',
    fontSize: 20,
    fontWeight: 700,
    color: 'var(--accent)',
    marginBottom: 10,
  },
  sub: {
    fontSize: 13,
    color: 'var(--muted)',
    lineHeight: 1.7,
  },
  campo: { marginBottom: 14 },
  label: { fontSize: 12, color: 'var(--muted)', display: 'block', marginBottom: 4, letterSpacing: '.5px' },
  input: {
    width: '100%',
    background: 'var(--surface2)',
    border: '1px solid var(--border)',
    borderRadius: 8,
    padding: '10px 14px',
    fontSize: 14,
    color: 'var(--text)',
    outline: 'none',
  },
  badge: {
    display: 'inline-block',
    background: 'rgba(16,185,129,.1)',
    border: '1px solid rgba(16,185,129,.25)',
    color: 'var(--accent3)',
    padding: '4px 12px',
    borderRadius: 20,
    fontSize: 11,
    fontWeight: 600,
    letterSpacing: 1,
  },
  centro: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 300,
  },
  spinner: {
    width: 40,
    height: 40,
    border: '3px solid var(--border)',
    borderTop: '3px solid var(--accent)',
    borderRadius: '50%',
    animation: 'spin 1s linear infinite',
  },
}
