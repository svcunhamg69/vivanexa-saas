// pages/dashboard.js
// ============================================================
// MELHORIAS APLICADAS:
// 1. KPIs Consolidados: Soma as metas e realizados de toda a equipe.
// 2. Histórico de Lançamentos: Modal para ver o histórico diário de KPIs por usuário.
// 3. Obrigatoriedade de Preenchimento: Bloqueia acesso se KPI do dia anterior não foi preenchido.
// 4. Melhorias de UI/UX: Layout mais limpo e responsivo.
// ============================================================

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/router'
import { supabase } from '../lib/supabase'
import Head from 'next/head'

// ══════════════════════════════════════════════
// HELPERS
// ══════════════════════════════════════════════
function toast(msg, type = 'ok') {
  const el = document.getElementById('vx-toast')
  if (!el) return
  el.textContent = msg
  el.style.background = type === 'ok' ? 'rgba(16,185,129,.9)' : 'rgba(239,68,68,.9)'
  el.style.opacity = '1'
  el.style.transform = 'translateY(0)'
  setTimeout(() => { el.style.opacity = '0'; el.style.transform = 'translateY(20px)' }, 3000)
}

// Calcula dias úteis (segunda a sexta)
function getBusinessDaysInMonth(year, month) {
  const date = new Date(year, month - 1, 1);
  let count = 0;
  while (date.getMonth() === month - 1) {
    const day = date.getDay();
    if (day !== 0 && day !== 6) { // Sunday = 0, Saturday = 6
      count++;
    }
    date.setDate(date.getDate() + 1);
  }
  return count;
}

// Formata data para YYYY-MM-DD
function formatDate(date) {
  const d = new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// ══════════════════════════════════════════════
// COMPONENTE PRINCIPAL DO DASHBOARD
// ══════════════════════════════════════════════
export default function Dashboard() {
  const router = useRouter()
  const [user, setUser] = useState(null)
  const [empresaId, setEmpresaId] = useState(null)
  const [cfg, setCfg] = useState(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('metas') // 'metas', 'produtos', 'kpis'
  const [mesRef, setMesRef] = useState(new Date().toISOString().slice(0, 7)) // YYYY-MM
  const [kpiLogs, setKpiLogs] = useState([]) // Todos os logs de KPI
  const [dailyKpiInputs, setDailyKpiInputs] = useState({}) // Inputs do dia para o usuário logado
  const [savingKpi, setSavingKpi] = useState(false)
  const [kpiBlockerActive, setKpiBlockerActive] = useState(false) // Estado para o bloqueador de KPI
  const [showKpiHistoryModal, setShowKpiHistoryModal] = useState(false)
  const [selectedUserForHistory, setSelectedUserForHistory] = useState(null)
  const [kpiHistoryData, setKpiHistoryData] = useState([])
  const [loadingKpiHistory, setLoadingKpiHistory] = useState(false)

  const currentYear = parseInt(mesRef.slice(0, 4))
  const currentMonth = parseInt(mesRef.slice(5, 7))
  const businessDays = getBusinessDaysInMonth(currentYear, currentMonth)
  const today = formatDate(new Date())
  const yesterday = formatDate(new Date(new Date().setDate(new Date().getDate() - 1)))

  useEffect(() => {
    async function loadData() {
      setLoading(true)
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/login')
        return
      }
      setUser(user)

      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('company_id, role, name')
        .eq('uuid', user.id)
        .single()

      if (profileError || !profile?.company_id) {
        console.error('Erro ao carregar perfil ou company_id não encontrado:', profileError);
        router.push('/login'); // Redireciona se não encontrar perfil/empresa
        return;
      }
      setEmpresaId(profile.company_id)

      const { data: cfgData, error: cfgError } = await supabase
        .from('vx_storage')
        .select('value')
        .eq('key', `cfg:${profile.company_id}`)
        .single()

      if (cfgError && cfgError.code !== 'PGRST116') {
        console.error('Erro ao carregar configurações:', cfgError);
        setLoading(false);
        return;
      }

      const loadedCfg = cfgData ? JSON.parse(cfgData.value) : {
        company: 'VIVANEXA',
        slogan: 'Assistente Comercial',
        kpiTemplates: [],
        users: [],
        kpiObrigatorio: false, // Default para a nova configuração
      }
      setCfg(loadedCfg)

      // Carregar logs de KPI para a empresa
      const { data: logs, error: logsError } = await supabase
        .from('kpi_logs')
        .select('*')
        .eq('empresa_id', profile.company_id)
        .gte('data', `${currentYear}-${String(currentMonth).padStart(2, '0')}-01`)
        .lte('data', `${currentYear}-${String(currentMonth).padStart(2, '0')}-31`) // Simplificado para o mês inteiro
        .order('created_at', { ascending: false });

      if (logsError) {
        console.error('Erro ao carregar logs de KPI:', logsError);
      } else {
        setKpiLogs(logs || []);
      }

      // Verificar obrigatoriedade de KPI
      if (loadedCfg.kpiObrigatorio) {
        const { data: lastKpiEntry, error: kpiEntryError } = await supabase
          .from('kpi_logs')
          .select('data')
          .eq('user_id', user.id)
          .eq('data', yesterday) // Verifica se há algum lançamento para ontem
          .limit(1);

        if (kpiEntryError) {
          console.error('Erro ao verificar KPI de ontem:', kpiEntryError);
        }

        // Se não houver lançamento para ontem E hoje não for o primeiro dia do mês
        // E o usuário não for admin (admins não são bloqueados)
        const isFirstDayOfMonth = new Date().getDate() === 1;
        if (!isFirstDayOfMonth && (!lastKpiEntry || lastKpiEntry.length === 0) && profile.role !== 'admin') {
          setKpiBlockerActive(true);
          toast('⚠️ Preencha os KPIs de ontem para continuar!', 'err');
        }
      }

      setLoading(false)
    }
    loadData()
  }, [router, mesRef]) // Recarrega se o mês de referência mudar

  useEffect(() => {
    if (cfg && user && kpiLogs) {
      // Preencher os inputs diários com os valores de hoje, se existirem
      const todayLogs = kpiLogs.filter(log => log.user_id === user.id && log.data === today);
      const initialInputs = {};
      cfg.kpiTemplates?.forEach(kpi => {
        const log = todayLogs.find(l => l.kpi_template_id === kpi.id);
        initialInputs[kpi.id] = log ? log.valor : '';
      });
      setDailyKpiInputs(initialInputs);
    }
  }, [cfg, user, kpiLogs, today]);

  // ══════════════════════════════════════════════
  // LÓGICA DE KPIs
  // ══════════════════════════════════════════════
  const handleKpiInputChange = (kpiId, value) => {
    setDailyKpiInputs(prev => ({ ...prev, [kpiId]: value }));
  };

  const salvarKpiDiario = async () => {
    if (!user || !empresaId || !cfg?.kpiTemplates) return;

    setSavingKpi(true);
    const updates = [];
    for (const kpi of cfg.kpiTemplates) {
      const valor = parseInt(dailyKpiInputs[kpi.id]) || 0;
      // Verifica se já existe um log para este KPI e data
      const existingLog = kpiLogs.find(log =>
        log.user_id === user.id &&
        log.kpi_template_id === kpi.id &&
        log.data === today
      );

      if (existingLog) {
        // Atualiza o log existente
        updates.push(
          supabase
            .from('kpi_logs')
            .update({ valor: valor, updated_at: new Date().toISOString() })
            .eq('id', existingLog.id)
        );
      } else if (valor > 0) {
        // Insere um novo log se o valor for maior que zero
        updates.push(
          supabase.from('kpi_logs').insert({
            user_id: user.id,
            empresa_id: empresaId,
            kpi_template_id: kpi.id,
            valor: valor,
            data: today,
          })
        );
      }
    }

    const results = await Promise.all(updates);
    const hasError = results.some(r => r.error);

    if (hasError) {
      toast('Erro ao salvar KPIs diários.', 'err');
      console.error('Erros ao salvar KPIs:', results.filter(r => r.error));
    } else {
      toast('✅ KPIs diários salvos com sucesso!');
      // Recarregar logs para atualizar o dashboard
      const { data: newLogs, error: logsError } = await supabase
        .from('kpi_logs')
        .select('*')
        .eq('empresa_id', empresaId)
        .gte('data', `${currentYear}-${String(currentMonth).padStart(2, '0')}-01`)
        .lte('data', `${currentYear}-${String(currentMonth).padStart(2, '0')}-31`)
        .order('created_at', { ascending: false });

      if (!logsError) {
        setKpiLogs(newLogs || []);
      }
      setKpiBlockerActive(false); // Desativa o bloqueador após salvar
    }
    setSavingKpi(false);
  };

  // ══════════════════════════════════════════════
  // CÁLCULOS DE KPI CONSOLIDADOS E POR USUÁRIO
  // ══════════════════════════════════════════════
  const consolidatedKpis = {};
  cfg?.kpiTemplates?.forEach(kpi => {
    consolidatedKpis[kpi.id] = {
      nome: kpi.nome,
      icone: kpi.icone,
      unidade: kpi.unidade,
      metaTotal: kpi.meta * businessDays * (cfg.users?.length || 1), // Meta diária * dias úteis * número de usuários
      realizadoTotal: 0,
    };
  });

  const userKpiData = {};
  cfg?.users?.forEach(u => {
    userKpiData[u.id] = {
      nome: u.nome,
      kpis: {},
    };
    cfg.kpiTemplates?.forEach(kpi => {
      userKpiData[u.id].kpis[kpi.id] = {
        nome: kpi.nome,
        icone: kpi.icone,
        unidade: kpi.unidade,
        metaMensal: kpi.meta * businessDays,
        metaDiaria: kpi.meta,
        realizadoMensal: 0,
        realizadoDiario: 0,
      };
    });
  });

  kpiLogs.forEach(log => {
    if (consolidatedKpis[log.kpi_template_id]) {
      consolidatedKpis[log.kpi_template_id].realizadoTotal += log.valor;
    }
    if (userKpiData[log.user_id] && userKpiData[log.user_id].kpis[log.kpi_template_id]) {
      userKpiData[log.user_id].kpis[log.kpi_template_id].realizadoMensal += log.valor;
      if (log.data === today) {
        userKpiData[log.user_id].kpis[log.kpi_template_id].realizadoDiario += log.valor;
      }
    }
  });

  // ══════════════════════════════════════════════
  // MODAL DE HISTÓRICO DE KPI
  // ══════════════════════════════════════════════
  const loadKpiHistory = async (userId) => {
    setLoadingKpiHistory(true);
    const { data, error } = await supabase
      .from('kpi_logs')
      .select('*')
      .eq('user_id', userId)
      .eq('empresa_id', empresaId)
      .order('data', { ascending: false });

    if (error) {
      toast('Erro ao carregar histórico de KPI: ' + error.message, 'err');
      setKpiHistoryData([]);
    } else {
      // Agrupar por data
      const grouped = data.reduce((acc, log) => {
        const date = log.data;
        if (!acc[date]) {
          acc[date] = [];
        }
        acc[date].push(log);
        return acc;
      }, {});
      setKpiHistoryData(Object.entries(grouped).sort(([dateA], [dateB]) => new Date(dateB) - new Date(dateA)));
    }
    setLoadingKpiHistory(false);
    setShowKpiHistoryModal(true);
  };

  if (loading) {
    return (
      <div style={s.loadingContainer}>
        <div style={s.spinner}></div>
        <p style={{ marginTop: 15, color: 'var(--muted)' }}>Carregando dashboard...</p>
      </div>
    )
  }

  if (!cfg || !empresaId) {
    return (
      <div style={s.loadingContainer}>
        <p style={{ color: 'var(--danger)' }}>Erro ao carregar configurações ou ID da empresa. Tente novamente.</p>
      </div>
    )
  }

  return (
    <div style={s.container}>
      <Head>
        <title>Dashboard de Vendas — {cfg.company || 'VIVANEXA'}</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <link href="https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=DM+Mono:wght@400;500&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
      </Head>
      <div style={s.sidebar}>
        <div style={s.logoContainer}>
          {cfg.logob64 ? (
            <img src={cfg.logob64} alt="Logo" style={s.logo} />
          ) : (
            <div style={s.appName}>{cfg.company || 'VIVANEXA'}</div>
          )}
          <div style={s.appSlogan}>{cfg.slogan || 'Assistente Comercial'}</div>
        </div>
        <nav style={s.nav}>
          <button
            style={{ ...s.navItem, ...(activeTab === 'metas' ? s.navItemActive : {}) }}
            onClick={() => setActiveTab('metas')}
          >
            🎯 Metas de Vendas
          </button>
          <button
            style={{ ...s.navItem, ...(activeTab === 'produtos' ? s.navItemActive : {}) }}
            onClick={() => setActiveTab('produtos')}
          >
            📦 Produtos Vendidos
          </button>
          <button
            style={{ ...s.navItem, ...(activeTab === 'kpis' ? s.navItemActive : {}) }}
            onClick={() => setActiveTab('kpis')}
          >
            📊 KPIs de Atividade
          </button>
        </nav>
        <button onClick={() => router.push('/configuracoes')} style={s.configBtn}>
          ⚙️ Configurações
        </button>
        <button onClick={async () => { await supabase.auth.signOut(); router.push('/login'); }} style={s.logoutBtn}>
          Sair
        </button>
      </div>

      <div style={s.mainContent}>
        <div style={s.header}>
          <h1 style={s.title}>Dashboard de Vendas</h1>
          <div style={s.periodSelector}>
            <label style={s.label}>Período:</label>
            <input type="month" value={mesRef} onChange={e => setMesRef(e.target.value)} style={s.input} />
          </div>
        </div>

        {kpiBlockerActive && (
          <div style={s.kpiBlockerOverlay}>
            <div style={s.kpiBlockerBox}>
              <h3 style={{ ...s.secTitle, color: 'var(--danger)' }}>⚠️ Preenchimento de KPIs Obrigatório!</h3>
              <p style={{ color: 'var(--muted)', marginBottom: 20 }}>
                Para ter acesso total ao sistema, por favor, preencha os KPIs referentes ao dia de ontem ({yesterday}).
              </p>
              <div style={{ marginBottom: 20 }}>
                {cfg.kpiTemplates?.map(kpi => (
                  <div key={kpi.id} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                    <span style={{ fontSize: 20 }}>{kpi.icone}</span>
                    <label style={{ ...s.label, marginBottom: 0, flex: 1 }}>{kpi.nome} ({kpi.unidade})</label>
                    <input
                      type="number"
                      style={{ ...s.input, width: 80 }}
                      value={dailyKpiInputs[kpi.id] || ''}
                      onChange={(e) => handleKpiInputChange(kpi.id, e.target.value)}
                      placeholder="0"
                    />
                  </div>
                ))}
              </div>
              <button style={s.saveBtn} onClick={salvarKpiDiario} disabled={savingKpi}>
                {savingKpi ? '⏳ Salvando...' : '✅ Salvar KPIs de Ontem'}
              </button>
            </div>
          </div>
        )}

        <div style={{ ...s.contentArea, filter: kpiBlockerActive ? 'blur(5px)' : 'none', pointerEvents: kpiBlockerActive ? 'none' : 'auto' }}>
          {activeTab === 'metas' && (
            <div style={s.sec}>
              <div style={s.secTitle}>🎯 Metas de Vendas</div>
              <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 14, lineHeight: 1.6 }}>
                Acompanhe o desempenho de adesão e mensalidade da equipe e individualmente.
              </p>

              {/* Gráfico de Adesão Consolidado */}
              <div style={{ marginBottom: 30 }}>
                <h3 style={{ ...s.secTitle, fontSize: 16, marginBottom: 15 }}>Adesão: Real vs Meta por Vendedor</h3>
                {cfg.users?.length === 0 && <p style={{ color: 'var(--muted)', fontSize: 13 }}>Nenhum usuário cadastrado para exibir metas.</p>}
                {cfg.users?.map(u => {
                  const userGoals = cfg.goals?.find(g => g.userId === u.id && g.mes === mesRef) || {};
                  const metaAdesao = parseFloat(userGoals.metaAdesao || 0);
                  const metaMensalidade = parseFloat(userGoals.metaMensalidade || 0);

                  // TODO: Implementar cálculo de realizado para adesão/mensalidade
                  // Por enquanto, valores fictícios ou 0
                  const realizadoAdesao = 0; // Buscar de contratos fechados
                  const realizadoMensalidade = 0; // Buscar de contratos fechados

                  const percAdesao = metaAdesao > 0 ? (realizadoAdesao / metaAdesao) * 100 : 0;
                  const percMensalidade = metaMensalidade > 0 ? (realizadoMensalidade / metaMensalidade) * 100 : 0;

                  return (
                    <div key={u.id} style={{ marginBottom: 20, background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 10, padding: 15 }}>
                      <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 8 }}>{u.nome}</div>
                      <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 10 }}>
                        {u.email} · {u.role || 'Vendedor'}
                      </div>

                      <div style={{ marginBottom: 10 }}>
                        <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 5 }}>Adesão: {fmt(realizadoAdesao)} / {fmt(metaAdesao)}</div>
                        <div style={s.progressBarContainer}>
                          <div style={{ ...s.progressBar, width: `${Math.min(100, percAdesao)}%`, background: 'var(--accent3)' }}></div>
                        </div>
                      </div>

                      <div>
                        <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 5 }}>Mensalidade: {fmt(realizadoMensalidade)} / {fmt(metaMensalidade)}</div>
                        <div style={s.progressBarContainer}>
                          <div style={{ ...s.progressBar, width: `${Math.min(100, percMensalidade)}%`, background: 'var(--accent)' }}></div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              <p style={{ fontSize: 13, color: 'var(--muted)', marginTop: 20 }}>
                <a href="#" onClick={() => router.push('/configuracoes?tab=metas')} style={{ color: 'var(--accent)', textDecoration: 'underline' }}>
                  Configure metas em Configurações
                </a>
              </p>
            </div>
          )}

          {activeTab === 'kpis' && (
            <div style={s.sec}>
              <div style={s.secTitle}>📊 KPIs de Atividade</div>
              <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 14, lineHeight: 1.6 }}>
                Acompanhe os indicadores de atividade da equipe e lance seus próprios KPIs diários.
              </p>

              {/* KPIs Consolidados – Equipe */}
              <div style={{ marginBottom: 30 }}>
                <h3 style={{ ...s.secTitle, fontSize: 16, marginBottom: 15 }}>KPIs Consolidados – Equipe</h3>
                {Object.values(consolidatedKpis).length === 0 && <p style={{ color: 'var(--muted)', fontSize: 13 }}>Nenhum KPI configurado.</p>}
                {Object.values(consolidatedKpis).map(kpi => {
                  const perc = kpi.metaTotal > 0 ? (kpi.realizadoTotal / kpi.metaTotal) * 100 : 0;
                  return (
                    <div key={kpi.nome} style={{ marginBottom: 15, background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 10, padding: 15 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                        <span style={{ fontSize: 22 }}>{kpi.icone}</span>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: 600, fontSize: 14 }}>{kpi.nome}</div>
                          <div style={{ fontSize: 12, color: 'var(--muted)' }}>
                            Realizado: {kpi.realizadoTotal} {kpi.unidade} / Meta: {kpi.metaTotal} {kpi.unidade}
                          </div>
                        </div>
                      </div>
                      <div style={s.progressBarContainer}>
                        <div style={{ ...s.progressBar, width: `${Math.min(100, perc)}%`, background: 'var(--accent)' }}></div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* KPIs Individuais do Usuário Logado */}
              <div style={{ marginBottom: 30 }}>
                <h3 style={{ ...s.secTitle, fontSize: 16, marginBottom: 15 }}>Seus KPIs Diários ({today})</h3>
                {cfg.kpiTemplates?.length === 0 && <p style={{ color: 'var(--muted)', fontSize: 13 }}>Nenhum KPI configurado para lançamento.</p>}
                {cfg.kpiTemplates?.map(kpi => (
                  <div key={kpi.id} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                    <span style={{ fontSize: 20 }}>{kpi.icone}</span>
                    <label style={{ ...s.label, marginBottom: 0, flex: 1 }}>{kpi.nome} ({kpi.unidade})</label>
                    <input
                      type="number"
                      style={{ ...s.input, width: 80 }}
                      value={dailyKpiInputs[kpi.id] || ''}
                      onChange={(e) => handleKpiInputChange(kpi.id, e.target.value)}
                      placeholder="0"
                    />
                  </div>
                ))}
                <p style={{ fontSize: 11, color: 'var(--muted)', marginTop: 10 }}>
                  {businessDays} dias úteis em {mesRef} - Metas mensal = metas diárias x {businessDays}
                </p>
                <button style={{ ...s.saveBtn, marginTop: 15 }} onClick={salvarKpiDiario} disabled={savingKpi}>
                  {savingKpi ? '⏳ Salvando...' : '✅ Salvar KPIs de Hoje'}
                </button>
              </div>

              {/* KPIs por Usuário (para administradores ou gerentes) */}
              {user?.role === 'admin' && ( // Apenas admins podem ver os KPIs de outros usuários
                <div style={s.sec}>
                  <h3 style={{ ...s.secTitle, fontSize: 16, marginBottom: 15 }}>KPIs por Usuário</h3>
                  {Object.values(userKpiData).length === 0 && <p style={{ color: 'var(--muted)', fontSize: 13 }}>Nenhum usuário com KPIs.</p>}
                  {Object.values(userKpiData).map(userData => (
                    <div key={userData.nome} style={{ marginBottom: 20, background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 10, padding: 15 }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                        <div style={{ fontWeight: 600, fontSize: 14 }}>{userData.nome}</div>
                        <button onClick={() => loadKpiHistory(Object.keys(userKpiData).find(id => userKpiData[id].nome === userData.nome))}
                          style={{ padding: '5px 10px', borderRadius: 7, background: 'rgba(0,212,255,.1)', border: '1px solid rgba(0,212,255,.2)', color: 'var(--accent)', cursor: 'pointer', fontFamily: 'DM Mono, monospace', fontSize: 12 }}>
                          Histórico
                        </button>
                      </div>
                      {Object.values(userData.kpis).map(kpi => {
                        const percMensal = kpi.metaMensal > 0 ? (kpi.realizadoMensal / kpi.metaMensal) * 100 : 0;
                        const percDiario = kpi.metaDiaria > 0 ? (kpi.realizadoDiario / kpi.metaDiaria) * 100 : 0;
                        return (
                          <div key={kpi.nome} style={{ marginBottom: 10 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--muted)' }}>
                              <span style={{ fontSize: 18 }}>{kpi.icone}</span>
                              <div style={{ flex: 1 }}>{kpi.nome}</div>
                              <div>Diário: {kpi.realizadoDiario} / {kpi.metaDiaria}</div>
                              <div style={{ width: 60, textAlign: 'right' }}>{percDiario.toFixed(0)}%</div>
                            </div>
                            <div style={s.progressBarContainer}>
                              <div style={{ ...s.progressBar, width: `${Math.min(100, percDiario)}%`, background: 'var(--accent3)' }}></div>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--muted)', marginTop: 5 }}>
                              <span style={{ width: 18 }}></span> {/* Espaço para alinhar */}
                              <div style={{ flex: 1 }}></div>
                              <div>Mensal: {kpi.realizadoMensal} / {kpi.metaMensal}</div>
                              <div style={{ width: 60, textAlign: 'right' }}>{percMensal.toFixed(0)}%</div>
                            </div>
                            <div style={s.progressBarContainer}>
                              <div style={{ ...s.progressBar, width: `${Math.min(100, percMensal)}%`, background: 'var(--accent)' }}></div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ))}
                </div>
              )}

              <p style={{ fontSize: 13, color: 'var(--muted)', marginTop: 20 }}>
                <a href="#" onClick={() => router.push('/configuracoes?tab=kpis')} style={{ color: 'var(--accent)', textDecoration: 'underline' }}>
                  Configure KPIs em Configurações
                </a>
              </p>
            </div>
          )}
        </div>
      </div>

      <div id="vx-toast" style={s.toast}></div>

      {/* Modal de Histórico de KPI */}
      {showKpiHistoryModal && (
        <div className="modal-overlay">
          <div className="modal-box" style={{ maxWidth: '700px' }}>
            <div className="modal-header">
              <h3>Histórico de KPIs de {selectedUserForHistory?.name}</h3>
              <button className="modal-close" onClick={() => setShowKpiHistoryModal(false)}>✕</button>
            </div>
            <div className="modal-body">
              {loadingKpiHistory ? (
                <div style={s.centro}>
                  <div style={s.spinner}></div>
                  <p style={{ marginTop: 15, color: 'var(--muted)' }}>Carregando histórico...</p>
                </div>
              ) : (
                <div>
                  {kpiHistoryData.length === 0 && <p style={{ color: 'var(--muted)', fontSize: 13 }}>Nenhum lançamento de KPI encontrado para este usuário.</p>}
                  {kpiHistoryData.map(([date, logs]) => (
                    <div key={date} style={{ marginBottom: 20, padding: 15, background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 10 }}>
                      <h4 style={{ fontSize: 15, color: 'var(--accent)', marginBottom: 10 }}>📅 {new Date(date).toLocaleDateString('pt-BR')}</h4>
                      {logs.map(log => {
                        const kpiTemplate = cfg.kpiTemplates?.find(t => t.id === log.kpi_template_id);
                        return (
                          <div key={log.id} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 5, fontSize: 14 }}>
                            <span style={{ fontSize: 18 }}>{kpiTemplate?.icone || '📊'}</span>
                            <div style={{ flex: 1 }}>{kpiTemplate?.nome || log.kpi_template_id}</div>
                            <div>{log.valor} {kpiTemplate?.unidade || 'un'}</div>
                          </div>
                        );
                      })}
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn-cancel" onClick={() => setShowKpiHistoryModal(false)}>Fechar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ══════════════════════════════════════════════
// ESTILOS (s)
// ══════════════════════════════════════════════
const s = {
  container: {
    display: 'flex',
    minHeight: '100vh',
    background: 'var(--bg)',
    color: 'var(--text)',
    width: '100%',
  },
  sidebar: {
    width: 260,
    background: 'var(--surface)',
    borderRight: '1px solid var(--border)',
    padding: '20px 0',
    display: 'flex',
    flexDirection: 'column',
    flexShrink: 0,
  },
  logoContainer: {
    padding: '0 20px 20px',
    borderBottom: '1px solid var(--border)',
    marginBottom: 20,
    textAlign: 'center',
  },
  logo: {
    height: 60,
    maxWidth: '100%',
    objectFit: 'contain',
    marginBottom: 8,
  },
  appName: {
    fontFamily: 'Syne, sans-serif',
    fontSize: 22,
    fontWeight: 800,
    color: 'var(--accent)',
  },
  appSlogan: {
    fontSize: 13,
    color: 'var(--muted)',
  },
  nav: {
    flex: 1,
    padding: '0 10px',
  },
  navItem: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    width: '100%',
    padding: '12px 15px',
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
  },
  configBtn: {
    display: 'block',
    width: 'calc(100% - 20px)',
    margin: '20px 10px 0',
    padding: '12px 15px',
    borderRadius: 10,
    background: 'var(--surface2)',
    border: '1px solid var(--border)',
    color: 'var(--muted)',
    fontSize: 13,
    fontFamily: 'DM Mono, monospace',
    cursor: 'pointer',
    textAlign: 'center',
    transition: 'all .2s',
  },
  logoutBtn: {
    display: 'block',
    width: 'calc(100% - 20px)',
    margin: '10px 10px 0',
    padding: '12px 15px',
    borderRadius: 10,
    background: 'rgba(239,68,68,.1)',
    border: '1px solid rgba(239,68,68,.2)',
    color: 'var(--danger)',
    fontSize: 13,
    fontFamily: 'DM Mono, monospace',
    cursor: 'pointer',
    textAlign: 'center',
    transition: 'all .2s',
  },
  mainContent: {
    flex: 1,
    padding: '20px 30px',
    overflowY: 'auto',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 25,
  },
  title: {
    fontFamily: 'Syne, sans-serif',
    fontSize: 28,
    fontWeight: 700,
    color: 'var(--text)',
  },
  periodSelector: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
  },
  input: {
    padding: '8px 12px',
    borderRadius: 8,
    border: '1px solid var(--border)',
    background: 'var(--surface2)',
    color: 'var(--text)',
    fontSize: 14,
    fontFamily: 'DM Mono, monospace',
    outline: 'none',
  },
  contentArea: {
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    borderRadius: 16,
    padding: '25px 30px',
    boxShadow: 'var(--shadow)',
  },
  sec: {
    marginBottom: 30,
    paddingBottom: 20,
    borderBottom: '1px solid var(--border)',
  },
  secTitle: {
    fontFamily: 'Syne, sans-serif',
    fontSize: 18,
    fontWeight: 700,
    color: 'var(--accent)',
    marginBottom: 15,
  },
  label: {
    display: 'block',
    fontSize: 12,
    color: 'var(--muted)',
    marginBottom: 6,
    letterSpacing: '.5px',
    textTransform: 'uppercase',
  },
  progressBarContainer: {
    width: '100%',
    height: 8,
    background: 'var(--border)',
    borderRadius: 4,
    overflow: 'hidden',
    marginTop: 5,
  },
  progressBar: {
    height: '100%',
    borderRadius: 4,
    transition: 'width 0.5s ease-in-out',
  },
  saveBtn: {
    display: 'block',
    width: '100%',
    padding: '12px 20px',
    borderRadius: 10,
    background: 'linear-gradient(135deg,var(--accent3),#059669)',
    border: 'none',
    color: '#fff',
    fontFamily: 'DM Mono, monospace',
    fontSize: 15,
    fontWeight: 700,
    cursor: 'pointer',
    letterSpacing: .5,
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
    fontSize: 14,
    fontFamily: 'DM Mono, monospace',
    opacity: 0,
    transform: 'translateY(20px)',
    transition: 'all .3s ease-out',
    zIndex: 1000,
  },
  loadingContainer: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '100vh',
    width: '100%',
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
  // Estilos para o bloqueador de KPI
  kpiBlockerOverlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,.85)',
    zIndex: 5000,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  kpiBlockerBox: {
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    borderRadius: 16,
    padding: '28px 32px',
    boxShadow: 'var(--shadow)',
    width: '100%',
    maxWidth: 500,
    textAlign: 'center',
  },
  // Estilos para o modal (copiados de configuracoes.js)
  'modal-overlay': {
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
  'modal-box': {
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    borderRadius: 16,
    width: '100%',
    maxWidth: 560, /* Ajuste conforme necessário */
    boxShadow: 'var(--shadow)',
    display: 'flex',
    flexDirection: 'column',
    maxHeight: '90vh',
    position: 'relative',
  },
  'modal-header': {
    padding: '20px 24px 0',
    flexShrink: 0,
  },
  'modal-header h3': {
    fontFamily: 'Syne, sans-serif',
    fontSize: 16,
    fontWeight: 700,
    color: 'var(--accent)',
  },
  'modal-close': {
    position: 'absolute',
    top: 16,
    right: 20,
    background: 'none',
    border: 'none',
    color: 'var(--muted)',
    fontSize: 20,
    cursor: 'pointer',
  },
  'modal-close:hover': {
    color: 'var(--text)',
  },
  'modal-body': {
    padding: '20px 24px',
    overflowY: 'auto',
    flex: 1,
  },
  'modal-footer': {
    padding: '16px 24px',
    borderTop: '1px solid var(--border)',
    display: 'flex',
    gap: 10,
    justifyContent: 'flex-end',
    flexShrink: 0,
  },
  'btn-cancel': {
    padding: '10px 18px',
    borderRadius: 10,
    background: 'rgba(100,116,139,.12)',
    border: '1px solid var(--border)',
    color: 'var(--muted)',
    fontFamily: 'DM Mono',
    fontSize: 13,
    cursor: 'pointer',
  },
  'btn-primary': {
    padding: '10px 22px',
    borderRadius: 10,
    background: 'linear-gradient(135deg,var(--accent),#0099bb)',
    border: 'none',
    color: '#fff',
    fontFamily: 'DM Mono',
    fontSize: 13,
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'all .2s',
  },
  'btn-primary:hover': {
    boxShadow: '0 0 16px rgba(0,212,255,.4)',
    transform: 'translateY(-1px)',
  },
}
