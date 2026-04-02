// pages/reports.js
// ============================================================
// Relatórios Comerciais - VERSÃO CORRIGIDA
// ============================================================

import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { supabase } from '../lib/supabase';

// ── Helpers ──────────────────────────────────────────────────
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

// ── Componente de tabela de KPIs ──────────────────────────────
function KpiTable({ kpiTemplates, users, kpiLog, goals, mesRef }) {
  const diasUteis = diasUteisNoMes(mesRef);

  const userKpis = users.map(user => {
    const logs = kpiLog.filter(l => l.userId === user.id && l.date.startsWith(mesRef));
    const userGoals = (goals || []).find(g => g.userId === user.id && g.mes === mesRef) || {};
    const kpiData = kpiTemplates.map(kpi => {
      const realizado = logs.filter(l => l.kpiId === kpi.id).reduce((s, l) => s + (l.realizado || 0), 0);
      const metaDiaria = userGoals[kpi.id] || 0;
      const metaMensal = metaDiaria * diasUteis;
      return { kpi, realizado, metaMensal };
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
                {k.nome}<br />
                <span style={{ fontSize: 10 }}>realizado / meta mensal</span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {userKpis.map(uk => (
            <tr key={uk.user.id} style={{ borderBottom: '1px solid var(--border)' }}>
              <td style={{ padding: '8px 6px', fontWeight: 600 }}>{uk.user.nome}</td>
              {uk.kpiData.map(kd => {
                const metaMensal = kd.metaMensal;
                const realizado = kd.realizado;
                return (
                  <td key={kd.kpi.id} style={{ textAlign: 'center', padding: '8px 6px' }}>
                    <div style={{ fontWeight: 600 }}>{realizado}</div>
                    <div style={{ fontSize: 11, color: 'var(--muted)' }}>
                      {metaMensal > 0 ? `${metaMensal}` : '—'}
                    </div>
                  </td>
                );
              })}
            </table>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Componente de produtos vendidos ──────────────────────────
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

  const lista = Object.entries(produtos)
    .map(([nome, dados]) => ({ nome, ...dados }))
    .sort((a, b) => (b.adesao + b.mensalidade) - (a.adesao + a.mensalidade));

  if (lista.length === 0) {
    return <p style={{ color: 'var(--muted)', padding: 20, textAlign: 'center' }}>Nenhum contrato assinado no período.</p>;
  }

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
            </table>
          ))}
        </tbody>
        <tfoot style={{ borderTop: '2px solid var(--border)', fontWeight: 700 }}>
          <tr>
            <td style={{ padding: '8px 6px' }}>TOTAL</td>
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

// ── Componente de análise IA ─────────────────────────────────
function AnaliseIA({ data, empresaId }) {
  const [analysis, setAnalysis] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleGenerate() {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data, empresaId }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      setAnalysis(json.analysis);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
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
          marginBottom: 16,
        }}
      >
        {loading ? 'Analisando...' : '🤖 Gerar Análise com IA'}
      </button>
      {error && <p style={{ color: 'var(--danger)', marginBottom: 12 }}>⚠️ {error}</p>}
      {analysis && (
        <div
          style={{
            background: 'var(--surface2)',
            border: '1px solid var(--border)',
            borderRadius: 12,
            padding: '16px 20px',
            whiteSpace: 'pre-wrap',
            fontSize: 14,
            lineHeight: 1.6,
          }}
        >
          {analysis.split('\n').map((line, i) => (
            <p key={i} style={{ marginBottom: 8 }}>{line}</p>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Página principal ─────────────────────────────────────────
export default function Reports() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [cfg, setCfg] = useState(null);
  const [perfil, setPerfil] = useState(null);
  const [empresaId, setEmpresaId] = useState(null);
  const [aba, setAba] = useState('produtos');
  const [mesRef, setMesRef] = useState(mesAtual());

  useEffect(() => {
    async function loadData() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push('/');
        return;
      }
      const { data: profile } = await supabase
        .from('perfis')
        .select('*')
        .eq('id', session.user.id)
        .single();
      setPerfil(profile);
      const eid = profile?.empresa_id || session.user.id;
      setEmpresaId(eid);
      const { data: row } = await supabase
        .from('vx_storage')
        .select('value')
        .eq('key', `cfg:${eid}`)
        .single();
      if (row?.value) {
        try {
          setCfg(JSON.parse(row.value));
        } catch (e) { console.error(e); }
      }
      setLoading(false);
    }
    loadData();
  }, []);

  if (loading) {
    return <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>Carregando...</div>;
  }

  if (!cfg) {
    return <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>Configurações não carregadas.</div>;
  }

  const docHistory = cfg.docHistory || [];
  const contratosMes = docHistory.filter(d => d.status === 'signed' && (d.criado || '').slice(0, 7) === mesRef);
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
      return {
        nome: u.nome,
        contratos: realiz.length,
        adesao: realiz.reduce((s, c) => s + (Number(c.adesao) || 0), 0),
        mensalidade: realiz.reduce((s, c) => s + (Number(c.mensalidade) || 0), 0),
      };
    }),
    kpis: kpiTemplates.map(k => {
      const total = kpiLog.filter(l => l.kpiId === k.id && l.date.startsWith(mesRef)).reduce((s, l) => s + (l.realizado || 0), 0);
      return { nome: k.nome, total_realizado: total };
    }),
  };

  return (
    <>
      <Head><title>{cfg.company || 'Vivanexa'} – Relatórios</title></Head>
      <style>{`
        :root{--bg:#0a0f1e;--surface:#111827;--surface2:#1a2540;--border:#1e2d4a;--accent:#00d4ff;--accent2:#7c3aed;--accent3:#10b981;--text:#e2e8f0;--muted:#64748b;--shadow:0 4px 24px rgba(0,0,0,.4);}
        *{box-sizing:border-box;margin:0;padding:0}
        body{font-family:'DM Mono',monospace;background:var(--bg);color:var(--text);min-height:100vh}
        .container{max-width:960px;margin:20px auto;padding:0 20px}
        .tabs{display:flex;gap:6px;margin-bottom:20px;flex-wrap:wrap}
        .tab-btn{padding:8px 16px;border-radius:9px;background:var(--surface2);border:1px solid var(--border);color:var(--muted);font-size:12px;cursor:pointer}
        .tab-btn.active{background:rgba(0,212,255,.12);border-color:rgba(0,212,255,.35);color:var(--accent);font-weight:600}
        .card{background:var(--surface);border:1px solid var(--border);border-radius:14px;padding:20px 24px;margin-bottom:20px}
        .card-title{font-family:'Syne',sans-serif;font-size:16px;font-weight:700;color:var(--accent);margin-bottom:16px}
        .flex-between{display:flex;justify-content:space-between;align-items:center}
        .date-picker{background:var(--surface2);border:1px solid var(--border);border-radius:8px;padding:6px 10px;font-size:13px;color:var(--text)}
      `}</style>
      <div className="container">
        <div className="tabs">
          <button className={`tab-btn ${aba === 'produtos' ? 'active' : ''}`} onClick={() => setAba('produtos')}>📦 Contratos/Produtos</button>
          <button className={`tab-btn ${aba === 'kpis' ? 'active' : ''}`} onClick={() => setAba('kpis')}>📊 KPIs por Usuário</button>
          <button className={`tab-btn ${aba === 'ia' ? 'active' : ''}`} onClick={() => setAba('ia')}>🤖 Análise IA</button>
        </div>

        {(aba === 'produtos' || aba === 'kpis') && (
          <div className="flex-between" style={{ marginBottom: 16 }}>
            <label>Período:</label>
            <input type="month" value={mesRef} onChange={e => setMesRef(e.target.value)} className="date-picker" />
          </div>
        )}

        {aba === 'produtos' && (
          <div className="card">
            <div className="card-title">📈 Produtos Vendidos</div>
            <ProdutosChart contratosMes={contratosMes} />
            <div style={{ marginTop: 24 }}>
              <div className="card-title">🏆 Ranking de Vendedores</div>
              {contratosMes.length === 0 ? <p>Nenhum contrato assinado.</p> : (
                <table style={{ width: '100%' }}>
                  <thead><tr><th>Vendedor</th><th>Contratos</th><th>Adesão</th><th>Mensalidade</th><th>Total</th></tr></thead>
                  <tbody>
                    {usuarios.map(u => {
                      const vendas = contratosMes.filter(c => c.userId === u.id || c.consultor === u.id);
                      const adesao = vendas.reduce((s, c) => s + (Number(c.adesao) || 0), 0);
                      const mensal = vendas.reduce((s, c) => s + (Number(c.mensalidade) || 0), 0);
                      return (
                        <tr key={u.id}>
                          <td>{u.nome}</td><td>{vendas.length}</td><td>{fmt(adesao)}</td><td>{fmt(mensal)}</td><td>{fmt(adesao + mensal)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}

        {aba === 'kpis' && (
          <div className="card">
            <div className="card-title">🎯 KPIs por Usuário</div>
            {kpiTemplates.length === 0 ? <p>Nenhum KPI configurado.</p> : (
              <KpiTable kpiTemplates={kpiTemplates} users={usuarios} kpiLog={kpiLog} goals={goals} mesRef={mesRef} />
            )}
          </div>
        )}

        {aba === 'ia' && (
          <div className="card">
            <div className="card-title">🤖 Análise Inteligente (IA)</div>
            <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 16 }}>
              Envie os dados de vendas e KPIs para análise com IA. A IA sugerirá um plano de ação concreto.
            </p>
            <AnaliseIA data={dadosIA} empresaId={empresaId} />
          </div>
        )}
      </div>
    </>
  );
}
