// pages/reports.js
import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { supabase } from '../lib/supabase';

function fmt(v) {
  return Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function mesAtual() {
  return new Date().toISOString().slice(0, 7);
}

function diasUteisNoMes(yearMonth) {
  const [y, m] = yearMonth.split('-').map(Number);
  const dias = new Date(y, m, 0).getDate();
  let uteis = 0;
  for (let d = 1; d <= dias; d++) {
    const dow = new Date(y, m - 1, d).getDay();
    if (dow !== 0 && dow !== 6) uteis++;
  }
  return uteis;
}

function KpiTable({ kpiTemplates, users, kpiLog, goals, mesRef }) {
  const diasUteis = diasUteisNoMes(mesRef);
  const userKpis = users.map(user => {
    const logs = kpiLog.filter(l => l.userId === user.id && l.date.startsWith(mesRef));
    const userGoals = (goals || []).find(g => g.userId === user.id && g.mes === mesRef) || {};
    const kpiData = kpiTemplates.map(kpi => {
      const realizado = logs.filter(l => l.kpiId === kpi.id).reduce((s, l) => s + (l.realizado || 0), 0);
      const metaDiaria = userGoals[kpi.id] || 0;
      const metaMensal = metaDiaria * diasUteis;
      const progresso = metaMensal > 0 ? Math.min(100, (realizado / metaMensal) * 100) : 0;
      return { kpi, realizado, metaMensal, progresso };
    });
    return { user, kpiData };
  });

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, minWidth: 600 }}>
        <thead>
          <tr style={{ borderBottom: '2px solid var(--border)' }}>
            <th style={{ textAlign: 'left', padding: '10px 6px' }}>Usuário</th>
            {kpiTemplates.map(k => (
              <th key={k.id} style={{ textAlign: 'center', padding: '10px 6px' }}>
                {k.nome}<br /><span style={{ fontSize: 10 }}>realizado / meta mensal</span>
              </th>
            ))}
          <tr>
        </thead>
        <tbody>
          {userKpis.map(uk => (
            <tr key={uk.user.id} style={{ borderBottom: '1px solid var(--border)' }}>
              <td style={{ padding: '8px 6px', fontWeight: 600 }}>{uk.user.nome}</td>
              {uk.kpiData.map(kd => {
                const progresso = kd.progresso;
                const cor = progresso >= 100 ? 'var(--accent3)' : progresso >= 70 ? 'var(--accent)' : progresso >= 40 ? 'var(--warning)' : 'var(--muted)';
                return (
                  <td key={kd.kpi.id} style={{ textAlign: 'center', padding: '8px 6px' }}>
                    <div style={{ fontWeight: 600, color: cor }}>{kd.realizado}</div>
                    <div style={{ fontSize: 11, color: 'var(--muted)' }}>
                      {kd.metaMensal > 0 ? `${kd.metaMensal} (${Math.round(progresso)}%)` : '—'}
                    </div>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ProdutosChart({ contratosMes }) {
  const produtos = {};
  contratosMes.forEach(c => {
    if (c.modulos) {
      c.modulos.forEach(mod => {
        if (!produtos[mod]) produtos[mod] = { count: 0, adesao: 0, mensalidade: 0 };
        produtos[mod].count++;
        produtos[mod].adesao += Number(c.adesaoModulos?.[mod] || 0);
        produtos[mod].mensalidade += Number(c.mensalidadeModulos?.[mod] || 0);
      });
    }
  });

  const lista = Object.entries(produtos).map(([nome, dados]) => ({ nome, ...dados })).sort((a, b) => (b.adesao + b.mensalidade) - (a.adesao + a.mensalidade));

  if (lista.length === 0) return <p style={{ color: 'var(--muted)', padding: 20, textAlign: 'center' }}>Nenhum contrato assinado no período.</p>;

  return (
    <div>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
        <thead>
          <tr style={{ borderBottom: '2px solid var(--border)' }}>
            <th style={{ textAlign: 'left', padding: '8px 6px' }}>Módulo</th>
            <th style={{ textAlign: 'center', padding: '8px 6px' }}>Contratos</th>
            <th style={{ textAlign: 'right', padding: '8px 6px' }}>Adesão Total</th>
            <th style={{ textAlign: 'right', padding: '8px 6px' }}>Mensalidade Total</th>
            <th style={{ textAlign: 'right', padding: '8px 6px' }}>Receita Total</th>
          </tr>
        </thead>
        <tbody>
          {lista.map(p => (
            <tr key={p.nome} style={{ borderBottom: '1px solid var(--border)' }}>
              <td style={{ padding: '8px 6px', fontWeight: 600 }}>{p.nome}</td>
              <td style={{ textAlign: 'center', padding: '8px 6px' }}>{p.count}</td>
              <td style={{ textAlign: 'right', padding: '8px 6px' }}>{fmt(p.adesao)}</td>
              <td style={{ textAlign: 'right', padding: '8px 6px' }}>{fmt(p.mensalidade)}</td>
              <td style={{ textAlign: 'right', padding: '8px 6px', fontWeight: 600 }}>{fmt(p.adesao + p.mensalidade)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot style={{ borderTop: '2px solid var(--border)', fontWeight: 700 }}>
          <tr><td style={{ padding: '8px 6px' }}>TOTAL</td>
            <td style={{ textAlign: 'center', padding: '8px 6px' }}>{lista.reduce((s, p) => s + p.count, 0)}</td>
            <td style={{ textAlign: 'right', padding: '8px 6px' }}>{fmt(lista.reduce((s, p) => s + p.adesao, 0))}</td>
            <td style={{ textAlign: 'right', padding: '8px 6px' }}>{fmt(lista.reduce((s, p) => s + p.mensalidade, 0))}</td>
            <td style={{ textAlign: 'right', padding: '8px 6px' }}>{fmt(lista.reduce((s, p) => s + p.adesao + p.mensalidade, 0))}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

function AnaliseIA({ data, empresaId, cfgIA }) {
  const [analysis, setAnalysis] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleGenerate() {
    setLoading(true);
    setError('');
    setAnalysis('');
    try {
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data, empresaId, geminiKey: cfgIA?.geminiApiKey || '', groqKey: cfgIA?.groqApiKey || '' }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Erro na API');
      setAnalysis(json.analysis);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <button
          onClick={handleGenerate}
          disabled={loading}
          style={{
            padding: '10px 20px',
            borderRadius: 8,
            background: 'linear-gradient(135deg,var(--accent),#0099bb)',
            border: 'none',
            color: '#fff',
            fontFamily: 'DM Mono, monospace',
            fontWeight: 600,
            cursor: loading ? 'not-allowed' : 'pointer',
          }}
        >
          {loading ? 'Analisando...' : '🤖 Gerar Análise com IA'}
        </button>
      </div>
      {error && <p style={{ color: 'var(--danger)', marginBottom: 12, whiteSpace: 'pre-wrap' }}>⚠️ {error}</p>}
      {analysis && (
        <div style={{
          background: 'var(--surface2)',
          border: '1px solid var(--border)',
          borderRadius: 12,
          padding: '16px 20px',
          whiteSpace: 'pre-wrap',
          fontFamily: 'Inter, sans-serif',
          fontSize: 14,
          lineHeight: 1.6,
          color: 'var(--text)',
        }}>
          {analysis.split('\n').map((line, i) => <p key={i} style={{ marginBottom: 8 }}>{line}</p>)}
        </div>
      )}
    </div>
  );
}

export default function Reports() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [cfg, setCfg] = useState(null);
  const [empresaId, setEmpresaId] = useState(null);
  const [aba, setAba] = useState('produtos');
  const [mesRef, setMesRef] = useState(mesAtual());

  useEffect(() => {
    async function load() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.push('/'); return; }

      // Busca ou cria perfil automaticamente
      let { data: perfil } = await supabase
        .from('perfis')
        .select('*')
        .eq('user_id', session.user.id)
        .maybeSingle();

      if (!perfil) {
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
        perfil = novoPerfil;
      }

      const eid = perfil?.empresa_id || session.user.id;
      setEmpresaId(eid);

      const { data: row } = await supabase
        .from('vx_storage')
        .select('value')
        .eq('key', `cfg:${eid}`)
        .single();

      if (row?.value) {
        setCfg(JSON.parse(row.value));
      } else {
        setCfg({ company: 'Vivanexa', docHistory: [], users: [], kpiTemplates: [], kpiLog: [], goals: [] });
      }
      setLoading(false);
    }
    load();
  }, []);

  if (loading) return <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)', color: 'var(--muted)' }}>Carregando...</div>;
  if (!cfg) return <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)', color: 'var(--muted)' }}>Configurações não carregadas.</div>;

  const docHistory = cfg.docHistory || [];
  const contratosMes = docHistory.filter(d => d.status === 'signed' && (d.criado || d.dateISO || '').slice(0, 7) === mesRef);
  const usuarios = cfg.users || [];
  const kpiTemplates = cfg.kpiTemplates || [];
  const kpiLog = cfg.kpiLog || [];
  const goals = cfg.goals || [];

  const dadosIA = {
    periodo: mesRef,
    total_contratos: contratosMes.length,
    total_adesao: contratosMes.reduce((s, c) => s + (Number(c.adesao) || 0), 0),
    total_mensalidade: contratosMes.reduce((s, c) => s + (Number(c.mensalidade) || 0), 0),
    usuarios: usuarios.map(u => {
      const realiz = contratosMes.filter(c => c.userId === u.id || c.consultor === u.id);
      return { nome: u.nome, contratos: realiz.length, adesao: realiz.reduce((s, c) => s + (Number(c.adesao) || 0), 0), mensalidade: realiz.reduce((s, c) => s + (Number(c.mensalidade) || 0), 0) };
    }),
    kpis: kpiTemplates.map(k => ({ nome: k.nome, total_realizado: kpiLog.filter(l => l.kpiId === k.id && l.date.startsWith(mesRef)).reduce((s, l) => s + (l.realizado || 0), 0) })),
  };

  const ranking = usuarios.map(u => {
    const realiz = contratosMes.filter(c => c.userId === u.id || c.consultor === u.id);
    return { ...u, adesao: realiz.reduce((s, c) => s + (Number(c.adesao) || 0), 0), mensalidade: realiz.reduce((s, c) => s + (Number(c.mensalidade) || 0), 0), contratos: realiz.length };
  }).sort((a, b) => (b.adesao + b.mensalidade) - (a.adesao + a.mensalidade));

  return (
    <>
      <Head><title>{cfg.company || 'Vivanexa'} – Relatórios</title></Head>
      <style>{`
        :root{--bg:#0a0f1e;--surface:#111827;--surface2:#1a2540;--border:#1e2d4a;--accent:#00d4ff;--text:#e2e8f0;--muted:#64748b;--accent3:#10b981;--danger:#ef4444;--warning:#f59e0b;--gold:#fbbf24;}
        *{margin:0;padding:0;box-sizing:border-box;}
        body{font-family:'DM Mono',monospace;background:var(--bg);color:var(--text);}
        .orb{position:fixed;border-radius:50%;filter:blur(120px);opacity:.1;pointer-events:none;z-index:0;}
        .orb1{width:500px;height:500px;background:var(--accent);top:-200px;right:-150px;}
        .orb2{width:400px;height:400px;background:#7c3aed;bottom:-150px;left:-100px;}
        header{position:sticky;top:0;z-index:100;max-width:960px;margin:0 auto;padding:12px 20px;display:flex;align-items:center;gap:8px;flex-wrap:wrap;background:rgba(10,15,30,.9);backdrop-filter:blur(12px);border-bottom:1px solid var(--border);}
        .header-logo{display:flex;align-items:center;gap:8px;cursor:pointer;}
        .container{max-width:960px;margin:20px auto;padding:0 20px;}
        .tabs{display:flex;gap:6px;margin-bottom:20px;flex-wrap:wrap;}
        .tab-btn{padding:8px 16px;border-radius:9px;background:var(--surface2);border:1px solid var(--border);color:var(--muted);font-size:12px;cursor:pointer;}
        .tab-btn.active{background:rgba(0,212,255,.12);border-color:rgba(0,212,255,.35);color:var(--accent);font-weight:600;}
        .card{background:var(--surface);border:1px solid var(--border);border-radius:14px;padding:20px 24px;margin-bottom:20px;}
        .card-title{font-family:'Syne',sans-serif;font-size:16px;font-weight:700;color:var(--accent);margin-bottom:16px;}
        .date-picker{background:var(--surface2);border:1px solid var(--border);border-radius:8px;padding:6px 10px;font-size:13px;color:var(--text);}
      `}</style>
      <div className="orb orb1"/><div className="orb orb2"/>
      <header>
        <div className="header-logo" onClick={() => router.push('/chat')}>
          {cfg.logob64 ? <img src={cfg.logob64} alt={cfg.company} style={{ height: 36 }} /> : <div style={{ fontFamily: 'Syne,sans-serif', fontSize: 16, fontWeight: 700 }}>{cfg.company || 'Vivanexa'}</div>}
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
          <button onClick={() => router.push('/chat')} style={{ background: 'var(--surface2)', border: '1px solid var(--border)', cursor: 'pointer', color: 'var(--muted)', fontSize: 11, padding: '5px 11px', borderRadius: 8 }}>💬 Chat</button>
          <button onClick={() => router.push('/dashboard')} style={{ background: 'var(--surface2)', border: '1px solid var(--border)', cursor: 'pointer', color: 'var(--muted)', fontSize: 11, padding: '5px 11px', borderRadius: 8 }}>📊 Dashboard</button>
          <button onClick={() => router.push('/configuracoes')} style={{ background: 'var(--surface2)', border: '1px solid var(--border)', cursor: 'pointer', color: 'var(--muted)', fontSize: 11, padding: '5px 11px', borderRadius: 8 }}>⚙️ Config</button>
          <button onClick={() => supabase.auth.signOut().then(() => router.push('/'))} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', fontSize: 11, padding: '5px 9px', borderRadius: 8 }}>Sair</button>
        </div>
      </header>
      <div className="container">
        <div className="tabs">
          {[{ id: 'produtos', label: '📦 Contratos/Produtos' }, { id: 'kpis', label: '📊 KPIs por Usuário' }, { id: 'ia', label: '🤖 Análise IA' }].map(t => (
            <button key={t.id} className={`tab-btn ${aba === t.id ? 'active' : ''}`} onClick={() => setAba(t.id)}>{t.label}</button>
          ))}
        </div>
        {(aba === 'produtos' || aba === 'kpis') && (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <label style={{ fontSize: 12 }}>Período:</label>
            <input type="month" value={mesRef} onChange={e => setMesRef(e.target.value)} className="date-picker" />
          </div>
        )}
        {aba === 'produtos' && (
          <div className="card">
            <div className="card-title">📈 Produtos Vendidos – {new Date(mesRef + '-01').toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}</div>
            <ProdutosChart contratosMes={contratosMes} />
            <div style={{ marginTop: 24 }}>
              <div className="card-title">🏆 Ranking de Vendedores</div>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead><tr style={{ borderBottom: '2px solid var(--border)' }}><th style={{ textAlign: 'left', padding: '8px 6px' }}>Vendedor</th><th style={{ textAlign: 'center' }}>Contratos</th><th style={{ textAlign: 'right' }}>Adesão</th><th style={{ textAlign: 'right' }}>Mensalidade</th><th style={{ textAlign: 'right' }}>Total</th></tr></thead>
                <tbody>{ranking.map((v, i) => (
                  <tr key={v.id} style={{ borderBottom: '1px solid var(--border)' }}><td style={{ padding: '8px 6px', fontWeight: 600 }}>{i === 0 ? '🥇 ' : i === 1 ? '🥈 ' : i === 2 ? '🥉 ' : ''}{v.nome}</td><td style={{ textAlign: 'center' }}>{v.contratos}</td><td style={{ textAlign: 'right' }}>{fmt(v.adesao)}</td><td style={{ textAlign: 'right' }}>{fmt(v.mensalidade)}</td><td style={{ textAlign: 'right', fontWeight: 600 }}>{fmt(v.adesao + v.mensalidade)}</td></tr>
                ))}</tbody>
              </table>
            </div>
          </div>
        )}
        {aba === 'kpis' && (
          <div className="card">
            <div className="card-title">🎯 KPIs por Usuário – {new Date(mesRef + '-01').toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}</div>
            {kpiTemplates.length === 0 ? <p>Nenhum KPI configurado. Acesse Configurações → KPIs.</p> : <KpiTable kpiTemplates={kpiTemplates} users={usuarios} kpiLog={kpiLog} goals={goals} mesRef={mesRef} />}
          </div>
        )}
        {aba === 'ia' && (
          <div className="card">
            <div className="card-title">🤖 Análise Inteligente (IA)</div>
            <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 16 }}>Envie os dados de vendas e KPIs para análise com IA. A IA sugerirá um plano de ação concreto baseado nos resultados.</p>
            <AnaliseIA data={dadosIA} empresaId={empresaId} cfgIA={cfg} />
          </div>
        )}
      </div>
    </>
  );
}
