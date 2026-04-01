// pages/kpi.js
import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import { supabase } from '../lib/supabase'

export default function KpiPage() {
  const router = useRouter()
  const { redirect, date: dateParam } = router.query
  const [cfg, setCfg] = useState(null)
  const [user, setUser] = useState(null)
  const [empresaId, setEmpresaId] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [kpis, setKpis] = useState([])
  const [valores, setValores] = useState({})
  // Se dateParam existir, usa ele, senão usa hoje
  const [data, setData] = useState(dateParam || new Date().toISOString().slice(0,10))
  const [error, setError] = useState('')

  useEffect(() => {
    async function load() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        router.push('/')
        return
      }
      const { data: profile } = await supabase
        .from('perfis')
        .select('*')
        .eq('id', session.user.id)
        .single()
      const eid = profile?.empresa_id || session.user.id
      setEmpresaId(eid)
      setUser({ ...session.user, ...profile })

      const { data: cfgRow } = await supabase
        .from('vx_storage')
        .select('value')
        .eq('key', `cfg:${eid}`)
        .single()
      if (cfgRow?.value) {
        const loaded = JSON.parse(cfgRow.value)
        setCfg(loaded)
        setKpis(loaded.kpiTemplates || [])
        // Pré-carregar valores já lançados no dia
        const log = loaded.kpiLog || []
        const dia = data
        const existing = log.filter(l => l.userId === session.user.id && l.date === dia)
        const map = {}
        existing.forEach(l => { map[l.kpiId] = l.realizado })
        setValores(map)
      }
      setLoading(false)
    }
    load()
  }, [])

  async function handleSubmit(e) {
    e.preventDefault()
    setSaving(true)
    setError('')

    try {
      // Buscar cfg atualizado
      const { data: cfgRow } = await supabase
        .from('vx_storage')
        .select('value')
        .eq('key', `cfg:${empresaId}`)
        .single()
      let currentCfg = cfgRow?.value ? JSON.parse(cfgRow.value) : cfg || {}
      if (!currentCfg.kpiLog) currentCfg.kpiLog = []

      // Remover lançamentos do mesmo usuário e data para não duplicar
      currentCfg.kpiLog = currentCfg.kpiLog.filter(l =>
        !(l.userId === user.id && l.date === data)
      )

      // Adicionar novos
      for (const k of kpis) {
        const val = valores[k.id]
        if (val !== undefined && val !== '') {
          currentCfg.kpiLog.push({
            id: Date.now() + Math.random(),
            userId: user.id,
            date: data,
            kpiId: k.id,
            realizado: Number(val)
          })
        }
      }

      // Salvar
      await supabase.from('vx_storage').upsert({
        key: `cfg:${empresaId}`,
        value: JSON.stringify(currentCfg),
        updated_at: new Date().toISOString()
      })

      // Redirecionar com reload total para garantir que o config seja recarregado
      const redirectTo = typeof redirect === 'string' ? redirect : '/chat'
      window.location.href = redirectTo
    } catch (err) {
      console.error(err)
      setError('Erro ao salvar. Tente novamente.')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)', color: 'var(--muted)' }}>Carregando...</div>
  }

  if (!kpis.length) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)', color: 'var(--muted)', flexDirection: 'column', gap: 16 }}>
        <div>📊 Nenhum KPI configurado.</div>
        <button onClick={() => router.push('/configuracoes')} style={{ padding: '10px 20px', background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer' }}>Configurar KPIs</button>
      </div>
    )
  }

  return (
    <>
      <style>{`
        *{box-sizing:border-box;margin:0;padding:0}
        body{background:var(--bg);font-family:'DM Mono',monospace}
        :root{--bg:#0a0f1e;--surface:#111827;--surface2:#1a2540;--border:#1e2d4a;--accent:#00d4ff;--text:#e2e8f0;--muted:#64748b;--accent3:#10b981;--danger:#ef4444}
      `}</style>
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
        <div style={{ maxWidth: 500, width: '100%', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: 28, boxShadow: '0 4px 24px rgba(0,0,0,.4)' }}>
          <h2 style={{ fontFamily: 'Syne, sans-serif', fontSize: 20, color: 'var(--accent)', marginBottom: 8, textAlign: 'center' }}>
            📊 Lançamento de KPIs
          </h2>
          <p style={{ fontSize: 13, color: 'var(--muted)', textAlign: 'center', marginBottom: 20 }}>
            {user?.nome}, registre suas atividades de <strong>{new Date(data).toLocaleDateString('pt-BR')}</strong>
          </p>
          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 12, color: 'var(--muted)', display: 'block', marginBottom: 4 }}>Data</label>
              <input
                type="date"
                value={data}
                onChange={e => setData(e.target.value)}
                max={new Date().toISOString().slice(0,10)}
                style={{ width: '100%', background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 8, padding: '9px 12px', color: 'var(--text)', fontFamily: 'DM Mono, monospace' }}
              />
            </div>

            {kpis.map(k => (
              <div key={k.id} style={{ marginBottom: 16 }}>
                <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 18 }}>{k.icone || '📊'}</span> {k.nome}
                </label>
                <input
                  type="number"
                  min="0"
                  value={valores[k.id] || ''}
                  onChange={e => setValores(prev => ({ ...prev, [k.id]: e.target.value }))}
                  placeholder={`Quantidade (${k.unidade || 'un'})`}
                  style={{ width: '100%', background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 8, padding: '9px 12px', color: 'var(--text)', fontFamily: 'DM Mono, monospace' }}
                />
              </div>
            ))}

            {error && (
              <div style={{ padding: '10px 14px', background: 'rgba(239,68,68,.1)', border: '1px solid rgba(239,68,68,.3)', borderRadius: 8, fontSize: 12, color: 'var(--danger)', marginBottom: 16 }}>
                ⚠️ {error}
              </div>
            )}

            <button
              type="submit"
              disabled={saving}
              style={{ width: '100%', padding: '12px', borderRadius: 10, background: 'linear-gradient(135deg,var(--accent),#0099bb)', border: 'none', color: '#fff', fontFamily: 'DM Mono, monospace', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}
            >
              {saving ? '⏳ Salvando...' : '✅ Salvar KPIs'}
            </button>
          </form>
        </div>
      </div>
    </>
  )
}
