// pages/kpi.js
import { useState, useEffect, useCallback } from 'react'
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
  const [data, setData] = useState(dateParam || new Date().toISOString().slice(0,10))
  const [error, setError] = useState('')

  // Função para carregar os dados
  const loadData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.replace('/'); // Usar replace para não adicionar ao histórico
        return;
      }

      let { data: profile } = await supabase
        .from('perfis')
        .select('*')
        .eq('user_id', session.user.id)
        .maybeSingle();

      if (!profile) {
        const nome = session.user.user_metadata?.name || session.user.email?.split('@')[0] || 'Usuário';
        const { data: novoPerfil } = await supabase
          .from('perfis')
          .insert({
            user_id: session.user.id,
            nome: nome,
            email: session.user.email,
            empresa_id: session.user.id,
            perfil: 'admin'
          })
          .select()
          .single();
        profile = novoPerfil;
      }

      const eid = profile?.empresa_id || session.user.id;
      setEmpresaId(eid);
      setUser({ ...session.user, ...profile });

      const { data: cfgRow, error: cfgError } = await supabase
        .from('vx_storage')
        .select('value')
        .eq('key', `cfg:${eid}`)
        .single();

      let loadedCfg = {};
      if (cfgError && cfgError.code !== 'PGRST116') { // PGRST116 = no rows found
        console.error("Erro ao carregar configuração:", cfgError);
        setError("Erro ao carregar configurações. Tente novamente.");
        setLoading(false);
        return;
      }
      if (cfgRow?.value) {
        loadedCfg = JSON.parse(cfgRow.value);
      }
      setCfg(loadedCfg);
      setKpis(loadedCfg.kpiTemplates || []);

      const log = loadedCfg.kpiLog || [];
      const dia = dateParam || new Date().toISOString().slice(0, 10); // Garante que a data seja consistente
      setData(dia); // Atualiza o estado da data com a data da URL ou hoje
      const existing = log.filter(l => l.userId === session.user.id && l.date === dia);
      const map = {};
      existing.forEach(l => { map[l.kpiId] = l.realizado; });
      setValores(map);

    } catch (err) {
      console.error("Erro geral ao carregar dados do KPI:", err);
      setError("Erro ao carregar dados. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }, [router, dateParam]); // Adicionado dateParam como dependência

  useEffect(() => {
    loadData();
  }, [loadData]);

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setError('');

    try {
      const { data: cfgRow, error: fetchError } = await supabase
        .from('vx_storage')
        .select('value')
        .eq('key', `cfg:${empresaId}`)
        .single();

      if (fetchError && fetchError.code !== 'PGRST116') {
        throw new Error(`Erro ao buscar configuração para salvar: ${fetchError.message}`);
      }

      let currentCfg = cfgRow?.value ? JSON.parse(cfgRow.value) : (cfg || {});
      if (!currentCfg.kpiLog) currentCfg.kpiLog = [];

      // Remove logs existentes para o usuário e data atual
      currentCfg.kpiLog = currentCfg.kpiLog.filter(l =>
        !(l.userId === user.id && l.date === data)
      );

      // Adiciona os novos valores de KPI
      for (const k of kpis) {
        const val = valores[k.id];
        if (val !== undefined && val !== '') {
          currentCfg.kpiLog.push({
            id: Date.now() + Math.random(), // ID único para cada log
            userId: user.id,
            date: data,
            kpiId: k.id,
            realizado: Number(val)
          });
        }
      }

      // Atualiza a configuração no Supabase
      const { error: upsertError } = await supabase.from('vx_storage').upsert(
        {
          key: `cfg:${empresaId}`,
          value: JSON.stringify(currentCfg),
          updated_at: new Date().toISOString()
        },
        { onConflict: 'key' } // Garante que atualiza se a chave já existe
      );

      if (upsertError) {
        throw new Error(`Erro ao salvar configuração: ${upsertError.message}`);
      }

      // Redireciona para a página original ou /chat
      const redirectTo = typeof redirect === 'string' ? decodeURIComponent(redirect) : '/chat';
      router.replace(redirectTo);
      router.reload(); // Força o _app.js a reavaliar a configuração
    } catch (err) {
      console.error("Erro ao salvar KPIs:", err);
      setError(`Erro ao salvar. Tente novamente. Detalhes: ${err.message}`);
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)', color: 'var(--muted)' }}>Carregando KPIs...</div>
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
