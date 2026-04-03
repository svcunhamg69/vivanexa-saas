// pages/kpi.js
import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/router'
import { supabase } from '../lib/supabase'

export default function KpiPage() {
  const router = useRouter()
  const { redirect, date: dateParam } = router.query

  const [cfg,          setCfg]         = useState(null)
  const [user,         setUser]        = useState(null)
  const [empresaId,    setEmpresaId]   = useState(null)
  const [loading,      setLoading]     = useState(true)
  const [saving,       setSaving]      = useState(false)
  const [kpis,         setKpis]        = useState([])
  const [valores,      setValores]     = useState({})
  const [data,         setData]        = useState(dateParam || new Date().toISOString().slice(0, 10))
  const [error,        setError]       = useState('')
  const [metasDiarias, setMetasDiarias] = useState({})

  const loadData = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.replace('/'); return }

      let { data: profile } = await supabase.from('perfis').select('*').eq('user_id', session.user.id).maybeSingle()

      if (!profile) {
        const nome = session.user.user_metadata?.name || session.user.email?.split('@')[0] || 'Usuário'
        const { data: novoPerfil } = await supabase
          .from('perfis')
          .insert({ user_id: session.user.id, nome, email: session.user.email, empresa_id: session.user.id, perfil: 'admin' })
          .select().single()
        profile = novoPerfil
      }

      const eid = profile?.empresa_id || session.user.id
      setEmpresaId(eid)
      setUser({ ...session.user, ...profile })

      const { data: cfgRow, error: cfgError } = await supabase
        .from('vx_storage').select('value').eq('key', `cfg:${eid}`).single()

      if (cfgError && cfgError.code !== 'PGRST116') {
        setError('Erro ao carregar configurações. Tente novamente.')
        setLoading(false)
        return
      }

      const loadedCfg = cfgRow?.value ? JSON.parse(cfgRow.value) : {}
      setCfg(loadedCfg)
      setKpis(loadedCfg.kpiTemplates || [])

      const dailyGoals = loadedCfg.kpiDailyGoals || {}
      setMetasDiarias(dailyGoals[session.user.id] || {})

      const dia = dateParam || new Date().toISOString().slice(0, 10)
      setData(dia)
      const log      = loadedCfg.kpiLog || []
      const existing = log.filter(l => l.userId === session.user.id && l.date === dia)
      const map      = {}
      existing.forEach(l => { map[l.kpiId] = l.realizado })
      setValores(map)

    } catch (err) {
      setError('Erro ao carregar dados. Tente novamente.')
    } finally {
      setLoading(false)
    }
  }, [router, dateParam])

  useEffect(() => { loadData() }, [loadData])

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')

    // Valida se pelo menos um KPI foi preenchido
    const algumPreenchido = kpis.some(k => valores[k.id] !== undefined && valores[k.id] !== '')
    if (!algumPreenchido) {
      setError('Preencha pelo menos um KPI antes de salvar.')
      return
    }

    setSaving(true)
    try {
      const { data: cfgRow, error: fetchError } = await supabase
        .from('vx_storage').select('value').eq('key', `cfg:${empresaId}`).single()

      if (fetchError && fetchError.code !== 'PGRST116') throw new Error(fetchError.message)

      let currentCfg = cfgRow?.value ? JSON.parse(cfgRow.value) : (cfg || {})
      if (!currentCfg.kpiLog) currentCfg.kpiLog = []

      // Remove logs do dia para esse usuário e reinsere
      currentCfg.kpiLog = currentCfg.kpiLog.filter(l => !(l.userId === user.id && l.date === data))

      for (const k of kpis) {
        const val = valores[k.id]
        if (val !== undefined && val !== '') {
          currentCfg.kpiLog.push({
            id: Date.now() + Math.random(),
            userId: user.id,
            userName: user.nome || user.email,
            date: data,
            kpiId: k.id,
            kpiNome: k.nome,
            realizado: Number(val)
          })
        }
      }

      const { error: upsertError } = await supabase.from('vx_storage').upsert(
        { key: `cfg:${empresaId}`, value: JSON.stringify(currentCfg), updated_at: new Date().toISOString() },
        { onConflict: 'key' }
      )
      if (upsertError) throw new Error(upsertError.message)

      // ✅ FIX: Marca no sessionStorage que acabou de salvar para evitar loop no _app.js
      sessionStorage.setItem('kpi_just_saved', data)

      // ✅ FIX: Usa window.location para forçar navegação limpa (evita _app.js reler cfg antigo)
      const redirectTo = typeof redirect === 'string' && redirect
        ? decodeURIComponent(redirect)
        : '/chat'
      window.location.href = redirectTo

    } catch (err) {
      setError(`Erro ao salvar. ${err.message}`)
      setSaving(false)
    }
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

  const mesAtual  = data.slice(0, 7)
  const diasUteis = diasUteisNoMes(mesAtual)

  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0a0f1e', color: '#64748b', fontFamily: 'DM Mono, monospace' }}>
      Carregando KPIs...
    </div>
  )

  if (!kpis.length) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0a0f1e', color: '#64748b', flexDirection: 'column', gap: 16, fontFamily: 'DM Mono, monospace' }}>
      <div>📊 Nenhum KPI configurado.</div>
      <button onClick={() => router.push('/configuracoes')} style={{ padding: '10px 20px', background: '#00d4ff', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer' }}>Configurar KPIs</button>
    </div>
  )

  return (
    <>
      <style>{`
        *{box-sizing:border-box;margin:0;padding:0}
        body{background:#0a0f1e;font-family:'DM Mono',monospace}
        :root{--bg:#0a0f1e;--surface:#111827;--surface2:#1a2540;--border:#1e2d4a;--accent:#00d4ff;--text:#e2e8f0;--muted:#64748b;--accent3:#10b981;--danger:#ef4444}
      `}</style>
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
        <div style={{ maxWidth: 500, width: '100%', background: '#111827', border: '1px solid #1e2d4a', borderRadius: 16, padding: 28, boxShadow: '0 4px 24px rgba(0,0,0,.4)' }}>
          <h2 style={{ fontFamily: 'Syne, sans-serif', fontSize: 20, color: '#00d4ff', marginBottom: 8, textAlign: 'center' }}>
            📊 Lançamento de KPIs
          </h2>
          <p style={{ fontSize: 13, color: '#64748b', textAlign: 'center', marginBottom: 20 }}>
            {user?.nome}, registre suas atividades de <strong style={{ color: '#e2e8f0' }}>{new Date(data + 'T12:00:00').toLocaleDateString('pt-BR')}</strong>
          </p>

          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 12, color: '#64748b', display: 'block', marginBottom: 4 }}>Data</label>
              <input
                type="date"
                value={data}
                onChange={e => setData(e.target.value)}
                max={new Date().toISOString().slice(0, 10)}
                style={{ width: '100%', background: '#1a2540', border: '1px solid #1e2d4a', borderRadius: 8, padding: '9px 12px', color: '#e2e8f0', fontFamily: 'DM Mono, monospace' }}
              />
            </div>

            {kpis.map(k => {
              const metaDiaria = metasDiarias[k.id] || 0
              const metaMensal = metaDiaria * diasUteis
              return (
                <div key={k.id} style={{ marginBottom: 16 }}>
                  <label style={{ fontSize: 13, fontWeight: 600, color: '#e2e8f0', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 18 }}>{k.icone || '📊'}</span> {k.nome}
                    {metaDiaria > 0 && (
                      <span style={{ fontSize: 11, color: '#10b981', marginLeft: 'auto' }}>
                        Meta: {metaDiaria}/dia · {metaMensal}/mês
                      </span>
                    )}
                  </label>
                  <input
                    type="number" min="0"
                    value={valores[k.id] ?? ''}
                    onChange={e => setValores(prev => ({ ...prev, [k.id]: e.target.value }))}
                    placeholder={`Quantidade (${k.unidade || 'un'})`}
                    style={{ width: '100%', background: '#1a2540', border: '1px solid #1e2d4a', borderRadius: 8, padding: '9px 12px', color: '#e2e8f0', fontFamily: 'DM Mono, monospace' }}
                  />
                </div>
              )
            })}

            {error && (
              <div style={{ padding: '10px 14px', background: 'rgba(239,68,68,.1)', border: '1px solid rgba(239,68,68,.3)', borderRadius: 8, fontSize: 12, color: '#ef4444', marginBottom: 16 }}>
                ⚠️ {error}
              </div>
            )}

            <button
              type="submit"
              disabled={saving}
              style={{ width: '100%', padding: '12px', borderRadius: 10, background: saving ? '#1a2540' : 'linear-gradient(135deg,#00d4ff,#0099bb)', border: 'none', color: saving ? '#64748b' : '#fff', fontFamily: 'DM Mono, monospace', fontSize: 14, fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer' }}
            >
              {saving ? '⏳ Salvando...' : '✅ Salvar KPIs'}
            </button>
          </form>
        </div>
      </div>
    </>
  )
}
