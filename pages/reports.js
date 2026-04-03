// pages/reports.js
import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { supabase } from '../lib/supabase';
import { fmt, planLabel, prodName, getNextDates } from '../lib/pricing';

function fmtCurrency(v) {
  return Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}
function mesAtual() { return new Date().toISOString().slice(0, 7); }
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
function dateToMonth(dateStr) {
  if (!dateStr) return '';
  if (dateStr.includes('/')) {
    const parts = dateStr.split('/');
    if (parts.length >= 3) {
      const year = parts[2].split(',')[0].trim();
      const month = parts[1].padStart(2, '0');
      return `${year}-${month}`;
    }
  }
  try { const d = new Date(dateStr); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; } catch (e) { return ''; }
}
function entryBelongsTo(h, userId, users) {
  if (!h || !userId) return false;
  if (h.consultantId && h.consultantId === userId) return true;
  if (h.consultantSignedBy) {
    const u = (users || []).find(u2 => (u2.id || u2.username) === userId);
    if (u && (u.name === h.consultantSignedBy || u.username === h.consultantSignedBy)) return true;
  }
  if (h.consultant) {
    const u = (users || []).find(u2 => (u2.id || u2.username) === userId);
    if (u && (u.name === h.consultant || u.username === h.consultant)) return true;
  }
  return false;
}
function entryInMonth(h, month) {
  if (!h) return false;
  if (h.dateISO) return h.dateISO.slice(0, 7) === month;
  const signDate = h.signedAt || h.consultantSignedAt || h.date;
  return dateToMonth(signDate) === month;
}

function KpiTable({ kpiTemplates, users, kpiLog, goals, mesRef }) {
  const diasUteis = diasUteisNoMes(mesRef);
  const safeUsers = users || [];
  const safeKpis = kpiTemplates || [];
  const safeLog = kpiLog || [];
  const safeGoals = goals || [];

  const userKpis = safeUsers.map(user => {
    if (!user) return null;
    const uid = user.id || user.username || '';
    const logs = safeLog.filter(l => l && l.userId === uid && l.date && l.date.startsWith(mesRef));
    const userGoals = safeGoals.find(g => g && g.userId === uid && g.mes === mesRef) || {};
    const kpiData = safeKpis.map(kpi => {
      if (!kpi) return null;
      const realizado = logs.filter(l => l.kpiId === kpi.id).reduce((s, l) => s + (Number(l.realizado) || 0), 0);
      const metaDiaria = userGoals[kpi.id] || 0;
      const metaMensal = metaDiaria * diasUteis;
      const progresso = metaMensal > 0 ? Math.min(100, (realizado / metaMensal) * 100) : 0;
      return { kpi, realizado, metaMensal, progresso };
    }).filter(Boolean);
    return { user, kpiData };
  }).filter(Boolean);

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, minWidth: 600 }}>
        <thead>
          <tr style={{ borderBottom: '2px solid var(--border)' }}>
            <th style={{ textAlign: 'left', padding: '10px 6px' }}>Usuário</th>
            {safeKpis.map(k => k && (
              <th key={k.id} style={{ textAlign: 'center', padding: '10px 6px' }}>
                {k.nome}<br /><span style={{ fontSize: 10 }}>realizado / meta mensal</span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {userKpis.map(uk => {
            if (!uk) return null;
            return (
              <tr key={uk.user.id || uk.user.username} style={{ borderBottom: '1px solid var(--border)' }}>
                <td style={{ padding: '8px 6px', fontWeight: 600 }}>{uk.user.nome}</td>
                {uk.kpiData.map(kd => {
                  if (!kd) return null;
                  const p = kd.progresso;
                  const cor = p >= 100 ? 'var(--accent3)' : p >= 70 ? 'var(--accent)' : p >= 40 ? 'var(--warning)' : 'var(--muted)';
                  return (
                    <td key={kd.kpi.id} style={{ textAlign: 'center', padding: '8px 6px' }}>
                      <div style={{ fontWeight: 600, color: cor }}>{kd.realizado}</div>
                      <div style={{ fontSize: 11, color: 'var(--muted)' }}>
                        {kd.metaMensal > 0 ? `${kd.metaMensal} (${Math.round(p)}%)` : '—'}
                      </div>
                      <div style={{ marginTop: 4, height: 4, background: 'var(--surface2)', borderRadius: 2, overflow: 'hidden' }}>
                        <div style={{ width: `${p}%`, height: '100%', background: cor, borderRadius: 2 }} />
                      </div>
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function ProdutosChart({ contratosMes, productNames }) {
  const safeProdName = (mod) => {
    try { return (prodName && prodName(mod, productNames)) || mod; } catch { return mod; }
  };
  const produtos = {};
  (contratosMes || []).forEach(c => {
    if (!c || !c.modulos) return;
    c.modulos.forEach(mod => {
      if (!mod) return;
      const nomeMod = safeProdName(mod);
      if (!produtos[nomeMod]) produtos[nomeMod] = { count: 0, adesao: 0, mensalidade: 0 };
      produtos[nomeMod].count++;
      produtos[nomeMod].adesao += Number(c.adesaoModulos?.[mod] || 0);
      produtos[nomeMod].mensalidade += Number(c.mensalidadeModulos?.[mod] || 0);
    });
  });
  const lista = Object.entries(produtos).map(([nome, dados]) => ({ nome, ...dados }))
    .sort((a, b) => (b.adesao + b.mensalidade) - (a.adesao + a.mensalidade));
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
              <td style={{ textAlign: 'right', padding: '8px 6px' }}>{fmtCurrency(p.adesao)}</td>
              <td style={{ textAlign: 'right', padding: '8px 6px' }}>{fmtCurrency(p.mensalidade)}</td>
              <td style={{ textAlign: 'right', padding: '8px 6px', fontWeight: 600 }}>{fmtCurrency(p.adesao + p.mensalidade)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot style={{ borderTop: '2px solid var(--border)', fontWeight: 700 }}>
          <tr>
            <td style={{ padding: '8px 6px' }}>TOTAL</td>
            <td style={{ textAlign: 'center', padding: '8px 6px' }}>{lista.reduce((s, p) => s + p.count, 0)}</td>
            <td style={{ textAlign: 'right', padding: '8px 6px' }}>{fmtCurrency(lista.reduce((s, p) => s + p.adesao, 0))}</td>
            <td style={{ textAlign: 'right', padding: '8px 6px' }}>{fmtCurrency(lista.reduce((s, p) => s + p.mensalidade, 0))}</td>
            <td style={{ textAlign: 'right', padding: '8px 6px' }}>{fmtCurrency(lista.reduce((s, p) => s + p.adesao + p.mensalidade, 0))}</td>
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
    setLoading(true); setError(''); setAnalysis('');
    try {
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          data, empresaId,
          geminiKey: cfgIA?.geminiApiKey || '',
          groqKey: cfgIA?.groqApiKey || '',
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Erro na API');
      setAnalysis(json.analysis);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      {!cfgIA?.geminiApiKey && !cfgIA?.groqApiKey && (
        <div style={{ padding: '10px 14px', background: 'rgba(251,191,36,.08)', border: '1px solid rgba(251,191,36,.3)', borderRadius: 8, fontSize: 12, color: 'var(--warning)', marginBottom: 12 }}>
          ⚠️ Configure sua chave de API em <strong>Configurações → Empresa</strong> (Google Gemini ou Groq).
        </div>
      )}
      <button onClick={handleGenerate} disabled={loading}
        style={{ padding: '10px 22px', borderRadius: 9, background: 'linear-gradient(135deg,var(--accent),#0099bb)', border: 'none', color: '#fff', fontFamily: 'DM Mono, monospace', fontSize: 13, fontWeight: 600, cursor: 'pointer', marginBottom: 16 }}>
        {loading ? '⏳ Analisando...' : '🤖 Gerar Análise com IA'}
      </button>
      {error && (
        <div style={{ padding: '10px 14px', background: 'rgba(239,68,68,.08)', border: '1px solid rgba(239,68,68,.3)', borderRadius: 8, fontSize: 13, color: 'var(--danger)', marginBottom: 12, whiteSpace: 'pre-wrap' }}>
          ❌ {error}
        </div>
      )}
      {analysis && (
        <div style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 10, padding: 20, fontSize: 13, lineHeight: 1.8, whiteSpace: 'pre-wrap', color: 'var(--text)' }}>
          {analysis}
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
  const [perfil, setPerfil] = useState(null);
  const [aba, setAba] = useState('produtos');
  const [mesRef, setMesRef] = useState(mesAtual());

  useEffect(() => {
    async function load() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.push('/'); return; }

      let { data: perfilData } = await supabase.from('perfis').select('*').eq('user_id', session.user.id).maybeSingle();
      if (!perfilData) {
        const nome = session.user.user_metadata?.name || session.user.email?.split('@')[0] || 'Usuário';
        const { data: novoPerfil } = await supabase.from('perfis').insert({
          user_id: session.user.id, nome, email: session.user.email,
          empresa_id: session.user.id, perfil: 'admin',
        }).select().single();
        perfilData = novoPerfil;
      }
      setPerfil(perfilData);
      const eid = perfilData?.empresa_id || session.user.id;
      setEmpresaId(eid);

      const { data: row } = await supabase.from('vx_storage').select('value').eq('key', `cfg:${eid}`).single();
      if (row?.value) {
        try { setCfg(JSON.parse(row.value)); } catch { setCfg({}); }
      } else {
        setCfg({ company: 'Vivanexa', docHistory: [], users: [], kpiTemplates: [], kpiLog: [], goals: [] });
      }
      setLoading(false);
    }
    load();
  }, []);

  if (loading) return <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)', color: 'var(--muted)' }}>Carregando...</div>;
  if (!cfg) return <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)', color: 'var(--muted)' }}>Configurações não carregadas.</div>;

  const isAdmin = perfil?.perfil === 'admin';
  const docHistory = cfg.docHistory || [];
  const usuarios = cfg.users || [];
  const userId = perfil?.id || '';

  const contratosMes = docHistory.filter(d =>
    d && d.status === 'signed' && (d.criado || d.dateISO || '').slice(0, 7) === mesRef
  );

  const contratosFiltrados = isAdmin ? contratosMes : contratosMes.filter(d => {
    if (!d) return false;
    if (d.userId === userId) return true;
    if (d.consultorId === userId) return true;
    if (d.consultor === perfil?.nome) return true;
    if (d.consultorEmail === perfil?.email) return true;
    return false;
  });

  const kpiTemplates = cfg.kpiTemplates || [];
  const kpiLog = cfg.kpiLog || [];
  const goals = cfg.goals || [];

  const dadosIA = {
    periodo: mesRef,
    total_contratos: contratosFiltrados.length,
    total_adesao: contratosFiltrados.reduce((s, c) => s + (Number(c.tAd || c.adesao) || 0), 0),
    total_mensalidade: contratosFiltrados.reduce((s, c) => s + (Number(c.tMen || c.mensalidade) || 0), 0),
    usuarios: usuarios.filter(Boolean).map(u => {
      const realiz = contratosFiltrados.filter(c => c && (c.userId === u.id || c.consultor === u.id || c.consultorEmail === u.email));
      return {
        nome: u.nome,
        contratos: realiz.length,
        adesao: realiz.reduce((s, c) => s + (Number(c.tAd || c.adesao) || 0), 0),
        mensalidade: realiz.reduce((s, c) => s + (Number(c.tMen || c.mensalidade) || 0), 0)
      };
    }),
    kpis: kpiTemplates.filter(Boolean).map(k => ({
      nome: k.nome,
      total_realizado: kpiLog.filter(l => l && l.kpiId === k.id && l.date && l.date.startsWith(mesRef)).reduce((s, l) => s + (Number(l.realizado) || 0), 0)
    })),
  };

  const ranking = usuarios.filter(Boolean).map(u => {
    const realiz = contratosFiltrados.filter(c => c && (c.userId === u.id || c.consultor === u.id || c.consultorEmail === u.email));
    return {
      ...u,
      adesao: realiz.reduce((s, c) => s + (Number(c.tAd || c.adesao) || 0), 0),
      mensalidade: realiz.reduce((s, c) => s + (Number(c.tMen || c.mensalidade) || 0), 0),
      contratos: realiz.length
    };
  }).sort((a, b) => (b.adesao + b.mensalidade) - (a.adesao + a.mensalidade));

  return (
    <>
      <Head><title>{cfg.company || 'Vivanexa'} – Relatórios</title></Head>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=DM+Mono:wght@300;400;500&display=swap');
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
        .tab-btn{padding:8px 16px;border-radius:9px;background:var(--surface2);border:1px solid var(--border);color:var(--muted);font-size:12px;cursor:pointer;font-family:'DM Mono',monospace;}
        .tab-btn.active{background:rgba(0,212,255,.12);border-color:rgba(0,212,255,.35);color:var(--accent);font-weight:600;}
        .card{background:var(--surface);border:1px solid var(--border);border-radius:14px;padding:20px 24px;margin-bottom:20px;}
        .card-title{font-family:'Syne',sans-serif;font-size:16px;font-weight:700;color:var(--accent);margin-bottom:16px;}
        .date-picker{background:var(--surface2);border:1px solid var(--border);border-radius:8px;padding:6px 10px;font-size:13px;color:var(--text);font-family:'DM Mono',monospace;}
      `}</style>
      <div className="orb orb1"/><div className="orb orb2"/>
      <header>
        <div className="header-logo" onClick={() => router.push('/chat')}>
          {cfg.logob64
            ? <img src={`data:image/png;base64,${cfg.logob64}`} alt={cfg.company} style={{ height: 36 }} />
            : <div style={{ fontFamily: 'Syne,sans-serif', fontSize: 16, fontWeight: 700 }}>{cfg.company || 'Vivanexa'}</div>
          }
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
          <button onClick={() => router.push('/chat')} style={{ background: 'var(--surface2)', border: '1px solid var(--border)', cursor: 'pointer', color: 'var(--muted)', fontSize: 11, padding: '5px 11px', borderRadius: 8, fontFamily: 'DM Mono,monospace' }}>💬 Chat</button>
          <button onClick={() => router.push('/dashboard')} style={{ background: 'var(--surface2)', border: '1px solid var(--border)', cursor: 'pointer', color: 'var(--muted)', fontSize: 11, padding: '5px 11px', borderRadius: 8, fontFamily: 'DM Mono,monospace' }}>📊 Dashboard</button>
          <button onClick={() => router.push('/configuracoes')} style={{ background: 'var(--surface2)', border: '1px solid var(--border)', cursor: 'pointer', color: 'var(--muted)', fontSize: 11, padding: '5px 11px', borderRadius: 8, fontFamily: 'DM Mono,monospace' }}>⚙️ Config</button>
          <button onClick={() => supabase.auth.signOut().then(() => router.push('/'))} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', fontSize: 11, padding: '5px 9px', borderRadius: 8, fontFamily: 'DM Mono,monospace' }}>Sair</button>
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
            <label style={{ fontSize: 12, color: 'var(--muted)' }}>Período:</label>
            <input type="month" value={mesRef} onChange={e => setMesRef(e.target.value)} className="date-picker" />
          </div>
        )}

        {aba === 'produtos' && (
          <div className="card">
            <div className="card-title">📈 Produtos Vendidos – {new Date(mesRef + '-02').toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}</div>
            <ProdutosChart contratosMes={contratosFiltrados} productNames={cfg.productNames || {}} />
            <div style={{ marginTop: 24 }}>
              <div className="card-title">🏆 Ranking de Vendedores</div>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid var(--border)' }}>
                    <th style={{ textAlign: 'left', padding: '8px 6px' }}>Vendedor</th>
                    <th style={{ textAlign: 'center', padding: '8px 6px' }}>Contratos</th>
                    <th style={{ textAlign: 'right', padding: '8px 6px' }}>Adesão</th>
                    <th style={{ textAlign: 'right', padding: '8px 6px' }}>Mensalidade</th>
                    <th style={{ textAlign: 'right', padding: '8px 6px' }}>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {ranking.map((v, i) => {
                    if (!v) return null;
                    return (
                      <tr key={v.id || v.username || i} style={{ borderBottom: '1px solid var(--border)' }}>
                        <td style={{ padding: '8px 6px', fontWeight: 600 }}>{i === 0 ? '🥇 ' : i === 1 ? '🥈 ' : i === 2 ? '🥉 ' : `${i+1}. `}{v.nome}</td>
                        <td style={{ textAlign: 'center', padding: '8px 6px' }}>{v.contratos}</td>
                        <td style={{ textAlign: 'right', padding: '8px 6px' }}>{fmtCurrency(v.adesao)}</td>
                        <td style={{ textAlign: 'right', padding: '8px 6px' }}>{fmtCurrency(v.mensalidade)}</td>
                        <td style={{ textAlign: 'right', padding: '8px 6px', fontWeight: 600 }}>{fmtCurrency(v.adesao + v.mensalidade)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {aba === 'kpis' && (
          <div className="card">
            <div className="card-title">🎯 KPIs por Usuário – {new Date(mesRef + '-02').toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}</div>
            {kpiTemplates.length === 0
              ? <p style={{ color: 'var(--muted)', fontSize: 13 }}>Nenhum KPI configurado. Acesse Configurações → KPIs.</p>
              : <KpiTable kpiTemplates={kpiTemplates} users={usuarios} kpiLog={kpiLog} goals={goals} mesRef={mesRef} />
            }
          </div>
        )}

        {aba === 'ia' && (
          <div className="card">
            <div className="card-title">🤖 Análise Inteligente (IA)</div>
            <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 16 }}>Envie os dados de vendas e KPIs para análise com IA.</p>
            <AnaliseIA data={dadosIA} empresaId={empresaId} cfgIA={cfg} />
          </div>
        )}
      </div>
    </>
  );
}

// ✅ Força SSR — evita erro de pré-renderização estática no build
export async function getServerSideProps() {
  return { props: {} };
}
