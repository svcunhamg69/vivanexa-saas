// pages/dashboard.js
// ============================================================
// MELHORIAS APLICADAS:
// 1. KPIs Consolidados – Equipe: soma a meta global da equipe
// 2. Histórico Diário por Usuário: permite ver lançamentos anteriores
// 3. Opção de Preenchimento Obrigatório: bloqueia o dashboard se não preenchido
// ============================================================

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { supabase } from '../lib/supabase';
import { fmt } from '../lib/pricing'; // Importa a função de formatação

// ══════════════════════════════════════════════
// HELPERS
// ══════════════════════════════════════════════
function toast(msg, type = 'ok') {
  const el = document.getElementById('vx-toast');
  if (!el) return;
  el.textContent = msg;
  el.style.background = type === 'ok' ? 'rgba(16,185,129,.9)' : 'rgba(239,68,68,.9)';
  el.style.opacity = '1';
  el.style.transform = 'translateY(0)';
  setTimeout(() => { el.style.opacity = '0'; el.style.transform = 'translateY(20px)' }, 3000);
}

// ══════════════════════════════════════════════
// COMPONENTE PRINCIPAL DO DASHBOARD
// ══════════════════════════════════════════════
export default function Dashboard() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [empresaId, setEmpresaId] = useState(null);
  const [cfg, setCfg] = useState(null);
  const [loading, setLoading] = useState(true);
  const [kpiLogs, setKpiLogs] = useState([]);
  const [todayKpiValues, setTodayKpiValues] = useState({});
  const [isKpiBlocked, setIsKpiBlocked] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [selectedUserHistory, setSelectedUserHistory] = useState(null);
  const [selectedUserHistoryData, setSelectedUserHistoryData] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  // ══════════════════════════════════════════════
  // EFEITOS E CARREGAMENTO INICIAL
  // ══════════════════════════════════════════════
  useEffect(() => {
    async function checkUser() {
      const { data: { session }, error } = await supabase.auth.getSession();
      if (error || !session) {
        router.push('/');
        return;
      }
      setUser(session.user);

      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('company_id, role') // Pega o role também
        .eq('uuid', session.user.id)
        .single();

      if (profileError || !profile?.company_id) {
        console.error('Erro ao buscar company_id ou company_id não encontrado:', profileError);
        router.push('/setup-empresa');
        return;
      }
      setEmpresaId(profile.company_id);
      // Aqui você pode salvar o role do usuário no estado se precisar
      // setUser(prev => ({ ...prev, role: profile.role }));
    }
    checkUser();
  }, [router]);

  useEffect(() => {
    async function loadConfigAndKpiLogs() {
      if (!empresaId || !user) return;

      setLoading(true);
      // Carrega configurações da empresa
      const { data: cfgData, error: cfgError } = await supabase
        .from('vx_storage')
        .select('value')
        .eq('key', `cfg:${empresaId}`)
        .single();

      if (cfgError && cfgError.code !== 'PGRST116') {
        console.error('Erro ao carregar configurações:', cfgError);
        setLoading(false);
        return;
      }

      let loadedCfg = cfgData ? JSON.parse(cfgData.value) : {};
      loadedCfg = {
        kpiTemplates: loadedCfg.kpiTemplates || [],
        users: loadedCfg.users || [],
        kpiDailyRequired: loadedCfg.kpiDailyRequired !== undefined ? loadedCfg.kpiDailyRequired : false,
        ...loadedCfg
      };
      setCfg(loadedCfg);

      // Carrega logs de KPI
      const { data: logsData, error: logsError } = await supabase
        .from('kpi_logs')
        .select('*')
        .eq('company_id', empresaId)
        .order('date', { ascending: false });

      if (logsError) {
        console.error('Erro ao carregar logs de KPI:', logsError);
        setLoading(false);
        return;
      }
      setKpiLogs(logsData);

      // Verifica bloqueio de KPI
      checkKpiBlock(loadedCfg, logsData, user.id);

      setLoading(false);
    }

    if (empresaId && user) {
      loadConfigAndKpiLogs();
    }
  }, [empresaId, user]);

  const checkKpiBlock = useCallback((currentCfg, currentKpiLogs, currentUserId) => {
    if (!currentCfg.kpiDailyRequired) {
      setIsKpiBlocked(false);
      return;
    }

    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);

    const todayStr = today.toISOString().split('T')[0];
    const yesterdayStr = yesterday.toISOString().split('T')[0];

    const currentHour = today.getHours();

    // Se for antes das 10h, não bloqueia por KPIs de ontem
    if (currentHour < 10) {
      setIsKpiBlocked(false);
      return;
    }

    // Verifica se o usuário tem KPIs para o dia anterior
    const hasKpiForYesterday = currentKpiLogs.some(log =>
      log.user_id === currentUserId && log.date.startsWith(yesterdayStr)
    );

    if (!hasKpiForYesterday) {
      setIsKpiBlocked(true);
    } else {
      setIsKpiBlocked(false);
    }
  }, []);

  // Preenche os valores de KPI de hoje ao carregar
  useEffect(() => {
    if (kpiLogs.length > 0 && cfg?.kpiTemplates.length > 0 && user) {
      const todayStr = new Date().toISOString().split('T')[0];
      const userTodayLogs = kpiLogs.filter(log =>
        log.user_id === user.id && log.date.startsWith(todayStr)
      );

      const initialValues = {};
      cfg.kpiTemplates.forEach(kpi => {
        const log = userTodayLogs.find(l => l.kpi_template_id === kpi.id);
        initialValues[kpi.id] = log ? log.value : '';
      });
      setTodayKpiValues(initialValues);
    }
  }, [kpiLogs, cfg, user]);

  // ══════════════════════════════════════════════
  // FUNÇÕES DE KPI
  // ══════════════════════════════════════════════
  const handleKpiChange = (kpiId, value) => {
    setTodayKpiValues(prev => ({ ...prev, [kpiId]: value }));
  };

  const saveKpiLogs = async () => {
    if (!user || !empresaId || !cfg?.kpiTemplates) {
      toast('Erro: Dados de usuário ou empresa não carregados.', 'err');
      return;
    }

    const today = new Date().toISOString().split('T')[0];
    const logsToInsert = [];
    const logsToUpdate = [];

    for (const kpi of cfg.kpiTemplates) {
      const value = parseFloat(todayKpiValues[kpi.id]);
      if (isNaN(value) || value < 0) {
        toast(`Valor inválido para ${kpi.nome}.`, 'err');
        return;
      }

      const existingLog = kpiLogs.find(log =>
        log.user_id === user.id &&
        log.kpi_template_id === kpi.id &&
        log.date.startsWith(today)
      );

      if (existingLog) {
        logsToUpdate.push({
          id: existingLog.id,
          value: value,
          updated_at: new Date().toISOString(),
        });
      } else {
        logsToInsert.push({
          user_id: user.id,
          company_id: empresaId,
          kpi_template_id: kpi.id,
          date: today,
          value: value,
        });
      }
    }

    let hasError = false;

    if (logsToInsert.length > 0) {
      const { error } = await supabase.from('kpi_logs').insert(logsToInsert);
      if (error) {
        console.error('Erro ao inserir logs de KPI:', error);
        toast('Erro ao salvar KPIs: ' + error.message, 'err');
        hasError = true;
      }
    }

    if (logsToUpdate.length > 0) {
      for (const log of logsToUpdate) {
        const { error } = await supabase.from('kpi_logs').update({ value: log.value, updated_at: log.updated_at }).eq('id', log.id);
        if (error) {
          console.error('Erro ao atualizar logs de KPI:', error);
          toast('Erro ao atualizar KPIs: ' + error.message, 'err');
          hasError = true;
        }
      }
    }

    if (!hasError) {
      toast('✅ KPIs salvos com sucesso!');
      // Recarrega os logs para atualizar o estado e verificar o bloqueio
      const { data: updatedLogs, error: fetchError } = await supabase
        .from('kpi_logs')
        .select('*')
        .eq('company_id', empresaId)
        .order('date', { ascending: false });

      if (!fetchError) {
        setKpiLogs(updatedLogs);
        checkKpiBlock(cfg, updatedLogs, user.id);
      }
    }
  };

  // ══════════════════════════════════════════════
  // CÁLCULOS DE KPI CONSOLIDADOS
  // ══════════════════════════════════════════════
  const consolidatedKpis = cfg?.kpiTemplates.map(kpi => {
    let totalMeta = 0;
    let totalRealizado = 0;

    // Soma as metas de todos os usuários para este KPI
    cfg.users.forEach(u => {
      totalMeta += kpi.meta; // Cada usuário tem a mesma meta para o KPI
    });

    // Soma os realizados de todos os usuários para este KPI
    const kpiLogsFiltered = kpiLogs.filter(log => log.kpi_template_id === kpi.id);
    const today = new Date().toISOString().split('T')[0];

    kpiLogsFiltered.forEach(log => {
      if (log.date.startsWith(today)) { // Apenas os lançamentos de hoje
        totalRealizado += log.value;
      }
    });

    const percent = totalMeta > 0 ? (totalRealizado / totalMeta) * 100 : 0;

    return {
      ...kpi,
      totalMeta,
      totalRealizado,
      percent: Math.min(100, percent), // Limita o percentual a 100% para a barra
      displayPercent: percent, // Mantém o valor real para exibição
    };
  }) || [];

  // ══════════════════════════════════════════════
  // HISTÓRICO DE KPI POR USUÁRIO
  // ══════════════════════════════════════════════
  const fetchUserKpiHistory = async (userId) => {
    setHistoryLoading(true);
    const { data, error } = await supabase
      .from('kpi_logs')
      .select('*')
      .eq('user_id', userId)
      .order('date', { ascending: false });

    if (error) {
      console.error('Erro ao buscar histórico do usuário:', error);
      toast('Erro ao carregar histórico.', 'err');
      setSelectedUserHistoryData([]);
    } else {
      setSelectedUserHistoryData(data);
    }
    setHistoryLoading(false);
    setShowHistoryModal(true);
  };

  if (loading || !user || !empresaId || !cfg) {
    return (
      <div style={s.centro}>
        <div style={s.spinner}></div>
        <p style={{ marginTop: 20, color: 'var(--muted)' }}>Carregando dashboard...</p>
      </div>
    );
  }

  // ══════════════════════════════════════════════
  // RENDERIZAÇÃO PRINCIPAL
  // ══════════════════════════════════════════════
  return (
    <>
      <Head>
        <title>Dashboard — {cfg.company}</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <link href="https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=DM+Mono:wght@400;500&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
      </Head>
      <div id="vx-toast" style={s.toast}></div>

      <div style={s.container}>
        <aside style={s.sidebar}>
          <div style={s.logoContainer}>
            {cfg.logob64
              ? <img src={cfg.logob64} alt={cfg.company} style={s.logo} />
              : <div style={s.logoText}>{cfg.company}</div>
            }
            <div style={s.slogan}>{cfg.slogan}</div>
          </div>

          <nav style={s.nav}>
            <button onClick={() => router.push('/dashboard')} style={{ ...s.navItem, ...s.navItemActive }}>
              📊 Dashboard
            </button>
            <button onClick={() => router.push('/chat')} style={s.navItem}>
              💬 Chat
            </button>
            <button onClick={() => router.push('/configuracoes')} style={s.navItem}>
              ⚙️ Configurações
            </button>
          </nav>

          <button onClick={() => supabase.auth.signOut()} style={s.logoutBtn}>
            Sair
          </button>
        </aside>

        <main style={s.mainContent}>
          <h1 style={s.pageTitle}>Dashboard de Vendas</h1>

          {isKpiBlocked && (
            <div style={s.kpiBlocker}>
              <h3>⚠️ Preenchimento de KPIs Obrigatório!</h3>
              <p>Você precisa preencher os KPIs do dia anterior para continuar. Por favor, insira seus dados diários.</p>
              <button onClick={() => setIsKpiBlocked(false)} style={s.kpiBlockerBtn}>Entendi</button>
            </div>
          )}

          <div style={s.section}>
            <h2 style={s.sectionTitle}>KPIs Consolidados – Equipe</h2>
            <div style={s.kpiGrid}>
              {consolidatedKpis.length === 0 && <p style={{ color: 'var(--muted)', fontSize: 13 }}>Nenhum KPI configurado. Configure na aba KPIs em Configurações.</p>}
              {consolidatedKpis.map(kpi => (
                <div key={kpi.id} style={s.kpiCard}>
                  <div style={s.kpiHeader}>
                    <span style={s.kpiIcon}>{kpi.icone}</span>
                    <h3 style={s.kpiName}>{kpi.nome}</h3>
                  </div>
                  <div style={s.kpiStats}>
                    <p>Meta: <span style={s.kpiValue}>{kpi.unidade === 'R$' ? fmt(kpi.totalMeta) : `${kpi.totalMeta} ${kpi.unidade}`}</span></p>
                    <p>Realizado: <span style={s.kpiValue}>{kpi.unidade === 'R$' ? fmt(kpi.totalRealizado) : `${kpi.totalRealizado} ${kpi.unidade}`}</span></p>
                  </div>
                  <div style={s.progressBarContainer}>
                    <div style={{ ...s.progressBar, width: `${kpi.percent}%`, background: kpi.percent >= 100 ? 'var(--accent3)' : 'var(--accent)' }}></div>
                    <span style={s.progressText}>{Math.round(kpi.displayPercent)}%</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div style={s.section}>
            <h2 style={s.sectionTitle}>Seus KPIs Diários</h2>
            <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 16 }}>
              Preencha seus indicadores de atividade para hoje.
            </p>
            <div style={s.kpiInputGrid}>
              {cfg.kpiTemplates.length === 0 && <p style={{ color: 'var(--muted)', fontSize: 13 }}>Nenhum KPI configurado. Configure na aba KPIs em Configurações.</p>}
              {cfg.kpiTemplates.map(kpi => (
                <div key={kpi.id} style={s.kpiInputField}>
                  <label style={s.kpiInputLabel}>{kpi.icone} {kpi.nome} (Meta: {kpi.meta} {kpi.unidade})</label>
                  <input
                    type="number"
                    value={todayKpiValues[kpi.id] || ''}
                    onChange={(e) => handleKpiChange(kpi.id, e.target.value)}
                    style={s.input}
                    placeholder={`Valor em ${kpi.unidade}`}
                  />
                </div>
              ))}
            </div>
            <button onClick={saveKpiLogs} style={s.saveBtn}>
              ✅ Salvar Meus KPIs
            </button>
          </div>

          <div style={s.section}>
            <h2 style={s.sectionTitle}>Histórico de KPIs por Usuário</h2>
            <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 16 }}>
              Visualize os lançamentos diários de KPIs de cada membro da equipe.
            </p>
            <div style={s.userList}>
              {cfg.users.length === 0 && <p style={{ color: 'var(--muted)', fontSize: 13 }}>Nenhum usuário cadastrado. Cadastre na aba Usuários em Configurações.</p>}
              {cfg.users.map(u => (
                <div key={u.id} style={s.userListItem}>
                  <span style={s.userName}>{u.nome}</span>
                  <button onClick={() => { setSelectedUserHistory(u); fetchUserKpiHistory(u.id); }} style={s.viewHistoryBtn}>
                    Ver Histórico
                  </button>
                </div>
              ))}
            </div>
          </div>
        </main>
      </div>

      {/* Modal de Histórico de KPI por Usuário */}
      {showHistoryModal && selectedUserHistory && (
        <div style={s.modalOverlay}>
          <div style={s.modalBox}>
            <div style={s.modalHeader}>
              <h3 style={s.modalHeaderH3}>Histórico de KPIs de {selectedUserHistory.nome}</h3>
              <button onClick={() => setShowHistoryModal(false)} style={s.modalClose}>✕</button>
            </div>
            <div style={s.modalBody}>
              {historyLoading ? (
                <div style={s.centro}>
                  <div style={s.spinner}></div>
                  <p style={{ marginTop: 20, color: 'var(--muted)' }}>Carregando histórico...</p>
                </div>
              ) : (
                <>
                  {selectedUserHistoryData.length === 0 && <p style={{ color: 'var(--muted)', fontSize: 13 }}>Nenhum lançamento de KPI encontrado para este usuário.</p>}
                  {cfg.kpiTemplates.map(kpi => (
                    <div key={kpi.id} style={{ marginBottom: 15, borderBottom: '1px dashed var(--border)', paddingBottom: 10 }}>
                      <h4 style={{ fontSize: 15, fontWeight: 600, color: 'var(--accent)', marginBottom: 8 }}>{kpi.icone} {kpi.nome}</h4>
                      <ul style={{ listStyle: 'none', padding: 0 }}>
                        {selectedUserHistoryData
                          .filter(log => log.kpi_template_id === kpi.id)
                          .map(log => (
                            <li key={log.id} style={{ fontSize: 13, color: 'var(--text)', marginBottom: 4 }}>
                              <span style={{ color: 'var(--muted)', marginRight: 8 }}>{new Date(log.date).toLocaleDateString()}:</span>
                              {kpi.unidade === 'R$' ? fmt(log.value) : `${log.value} ${kpi.unidade}`}
                            </li>
                          ))}
                      </ul>
                    </div>
                  ))}
                </>
              )}
            </div>
            <div style={s.modalFooter}>
              <button onClick={() => setShowHistoryModal(false)} style={s.btnCancel}>Fechar</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ══════════════════════════════════════════════
// ESTILOS (são os mesmos do globals.css, mas aqui para referência)
// ══════════════════════════════════════════════
const s = {
  container: {
    display: 'flex',
    minHeight: '100vh',
    background: 'var(--bg)',
    color: 'var(--text)',
  },
  sidebar: {
    width: 240,
    background: 'var(--surface)',
    borderRight: '1px solid var(--border)',
    padding: '20px 0',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    flexShrink: 0,
  },
  logoContainer: {
    marginBottom: 30,
    textAlign: 'center',
    padding: '0 20px',
  },
  logo: {
    height: 50,
    maxWidth: '100%',
    objectFit: 'contain',
    marginBottom: 8,
  },
  logoText: {
    fontFamily: 'Syne, sans-serif',
    fontSize: 24,
    fontWeight: 800,
    color: 'var(--accent)',
  },
  slogan: {
    fontSize: 12,
    color: 'var(--muted)',
    fontFamily: 'DM Mono, monospace',
  },
  nav: {
    width: '100%',
    flexGrow: 1,
    padding: '0 10px',
  },
  navItem: {
    display: 'flex',
    alignItems: 'center',
    width: '100%',
    padding: '10px 15px',
    borderRadius: 10,
    background: 'transparent',
    border: 'none',
    color: 'var(--muted)',
    fontSize: 14,
    fontFamily: 'DM Mono, monospace',
    textAlign: 'left',
    cursor: 'pointer',
    marginBottom: 5,
    transition: 'all .2s',
  },
  navItemActive: {
    background: 'rgba(0,212,255,.1)',
    color: 'var(--accent)',
    fontWeight: 600,
    border: '1px solid rgba(0,212,255,.2)',
  },
  logoutBtn: {
    width: 'calc(100% - 20px)',
    padding: '10px 15px',
    borderRadius: 10,
    background: 'rgba(239,68,68,.1)',
    border: '1px solid rgba(239,68,68,.2)',
    color: 'var(--danger)',
    fontSize: 14,
    fontFamily: 'DM Mono, monospace',
    cursor: 'pointer',
    marginTop: 20,
  },
  mainContent: {
    flexGrow: 1,
    padding: '30px',
    maxWidth: 900,
    margin: '0 auto',
  },
  pageTitle: {
    fontFamily: 'Syne, sans-serif',
    fontSize: 28,
    fontWeight: 700,
    color: 'var(--text)',
    marginBottom: 30,
  },
  section: {
    marginBottom: 40,
  },
  sectionTitle: {
    fontFamily: 'Syne, sans-serif',
    fontSize: 20,
    fontWeight: 700,
    color: 'var(--accent)',
    marginBottom: 20,
  },
  kpiGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
    gap: 20,
  },
  kpiCard: {
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    borderRadius: 16,
    padding: 20,
    boxShadow: 'var(--shadow)',
  },
  kpiHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    marginBottom: 10,
  },
  kpiIcon: {
    fontSize: 24,
  },
  kpiName: {
    fontFamily: 'Syne, sans-serif',
    fontSize: 16,
    fontWeight: 700,
    color: 'var(--text)',
  },
  kpiStats: {
    fontSize: 14,
    color: 'var(--muted)',
    marginBottom: 15,
  },
  kpiValue: {
    fontWeight: 600,
    color: 'var(--accent)',
  },
  progressBarContainer: {
    background: 'var(--surface2)',
    borderRadius: 10,
    height: 10,
    position: 'relative',
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    borderRadius: 10,
    transition: 'width 0.5s ease-in-out',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingRight: 5,
  },
  progressText: {
    position: 'absolute',
    right: 10,
    fontSize: 10,
    fontWeight: 600,
    color: 'var(--text)',
    textShadow: '0 0 2px rgba(0,0,0,0.5)',
  },
  kpiInputGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr',
    gap: 15,
    marginBottom: 20,
  },
  kpiInputField: {
    marginBottom: 0,
  },
  kpiInputLabel: {
    display: 'block',
    fontSize: 13,
    color: 'var(--muted)',
    marginBottom: 8,
    fontWeight: 500,
  },
  input: {
    width: '100%',
    padding: '10px 14px',
    background: 'var(--surface2)',
    border: '1px solid var(--border)',
    borderRadius: 8,
    fontSize: 14,
    color: 'var(--text)',
    outline: 'none',
    fontFamily: 'DM Mono, monospace',
  },
  saveBtn: {
    width: '100%',
    padding: '12px 20px',
    borderRadius: 10,
    background: 'linear-gradient(135deg,var(--accent),#0099bb)',
    border: 'none',
    color: '#fff',
    fontFamily: 'DM Mono, monospace',
    fontSize: 15,
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'all .2s',
  },
  userList: {
    display: 'grid',
    gridTemplateColumns: '1fr',
    gap: 10,
  },
  userListItem: {
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    borderRadius: 10,
    padding: '12px 15px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  userName: {
    fontSize: 15,
    fontWeight: 600,
    color: 'var(--text)',
  },
  viewHistoryBtn: {
    padding: '8px 14px',
    borderRadius: 8,
    background: 'rgba(124,58,237,.1)',
    border: '1px solid rgba(124,58,237,.2)',
    color: 'var(--accent2)',
    fontFamily: 'DM Mono, monospace',
    fontSize: 12,
    cursor: 'pointer',
    transition: 'all .2s',
  },
  kpiBlocker: {
    background: 'rgba(239,68,68,.15)',
    border: '1px solid rgba(239,68,68,.4)',
    borderRadius: 16,
    padding: 25,
    marginBottom: 30,
    textAlign: 'center',
    color: 'var(--danger)',
    boxShadow: '0 4px 20px rgba(239,68,68,.1)',
  },
  kpiBlockerBtn: {
    marginTop: 15,
    padding: '10px 20px',
    borderRadius: 10,
    background: 'var(--danger)',
    color: '#fff',
    border: 'none',
    fontFamily: 'DM Mono, monospace',
    fontSize: 14,
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'all .2s',
  },
  toast: {
    position: 'fixed',
    bottom: 20,
    right: 20,
    background: 'rgba(16,185,129,.9)',
    color: '#fff',
    padding: '12px 20px',
    borderRadius: 10,
    zIndex: 9999,
    opacity: 0,
    transform: 'translateY(20px)',
    transition: 'all .3s ease-out',
    fontFamily: 'DM Mono, monospace',
    fontSize: 14,
    boxShadow: '0 4px 12px rgba(0,0,0,.2)',
  },
  centro: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '100vh',
    background: 'var(--bg)',
    color: 'var(--text)',
  },
  spinner: {
    width: 40,
    height: 40,
    border: '3px solid var(--border)',
    borderTop: '3px solid var(--accent)',
    borderRadius: '50%',
    animation: 'spin 1s linear infinite',
  },
  modalOverlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,.75)',
    zIndex: 6000,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    overflowY: 'auto',
  },
  modalBox: {
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    borderRadius: 16,
    width: '100%',
    maxWidth: 600,
    boxShadow: 'var(--shadow)',
    display: 'flex',
    flexDirection: 'column',
    maxHeight: '90vh',
    position: 'relative',
  },
  modalHeader: {
    padding: '20px 24px 0',
    flexShrink: 0,
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  modalHeaderH3: {
    fontFamily: 'Syne, sans-serif',
    fontSize: 16,
    fontWeight: 700,
    color: 'var(--accent)',
  },
  modalClose: {
    background: 'none',
    border: 'none',
    color: 'var(--muted)',
    fontSize: 20,
    cursor: 'pointer',
  },
  modalBody: {
    padding: '20px 24px',
    overflowY: 'auto',
    flex: 1,
  },
  modalFooter: {
    padding: '16px 24px',
    borderTop: '1px solid var(--border)',
    display: 'flex',
    gap: 10,
    justifyContent: 'flex-end',
    flexShrink: 0,
  },
  btnCancel: {
    padding: '10px 18px',
    borderRadius: 10,
    background: 'rgba(100,116,139,.12)',
    border: '1px solid var(--border)',
    color: 'var(--muted)',
    fontFamily: 'DM Mono, monospace',
    fontSize: 13,
    cursor: 'pointer',
  },
};
