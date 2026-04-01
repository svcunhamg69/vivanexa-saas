// pages/configuracoes.js
// ============================================================
// MELHORIAS APLICADAS:
// 1. Logo: carrega e exibe corretamente após salvar
// 2. Produtos: planos completos (Basic/Pro/Top/Top Plus) com
//    CNPJs, usuários e tabela de preços por módulo
// 3. Usuários: permissões granulares + perfis personalizados
// 4. Descontos: % Adesão (tela), % Mensalidade (tela), % Adesão (fechamento)
//    e Modo de Desconto (em tela ou via voucher)
// 5. Documentos: upload de PDF/HTML, visualização e histórico
// 6. KPIs: Obrigar preenchimento diário de KPIs + galeria de ícones
// 7. Histórico: Visualização de documentos gerados e assinaturas
// ============================================================

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { supabase } from '../lib/supabase';
import { v4 as uuidv4 } from 'uuid'; // Para gerar IDs únicos para documentos

// Funções auxiliares de formatação (podem vir de lib/pricing.js)
function fmt(n) {
  return 'R$ ' + Number(n || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtPct(n) {
  return Number(n || 0).toLocaleString('pt-BR', { style: 'percent', minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

// Componente principal de Configurações
export default function Configuracoes() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [empresaId, setEmpresaId] = useState(null);
  const [cfg, setCfg] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('geral');
  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  // Estados para as novas abas
  const [newUserName, setNewUserName] = useState('');
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserRole, setNewUserRole] = useState('user');
  const [newUserPermissions, setNewUserPermissions] = useState([]);
  const [kpiTemplates, setKpiTemplates] = useState([]);
  const [newKpiName, setNewKpiName] = useState('');
  const [newKpiIcon, setNewKpiIcon] = useState('📊');
  const [newKpiMeta, setNewKpiMeta] = useState(0);
  const [newKpiUnidade, setNewKpiUnidade] = useState('un');
  const [newKpiColor, setNewKpiColor] = useState('#00d4ff');
  const [showIconPicker, setShowIconPicker] = useState(null); // Para a galeria de ícones do KPI

  // Estados para documentos
  const [documentosImportados, setDocumentosImportados] = useState([]);
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploadingDoc, setUploadingDoc] = useState(false);
  const [docHistory, setDocHistory] = useState([]);
  const [showDocModal, setShowDocModal] = useState(false);
  const [modalDocContent, setModalDocContent] = useState('');
  const [modalDocTitle, setModalDocTitle] = useState('');

  // ══════════════════════════════════════════════
  // CONSTANTES
  // ══════════════════════════════════════════════
  const TABS = [
    { id: 'geral',      label: '🏢 Empresa' },
    { id: 'metas',      label: '🎯 Metas' },
    { id: 'kpis',       label: '📊 KPIs' },
    { id: 'usuarios',   label: '👥 Usuários' },
    { id: 'produtos',   label: '📦 Produtos' },
    { id: 'descontos',  label: '🏷️ Descontos' },
    { id: 'vouchers',   label: '🎫 Vouchers' },
    { id: 'documentos', label: '📄 Documentos' }, // Nova aba para documentos importados
    { id: 'historico',  label: '🗂️ Histórico' },  // Aba para histórico de gerados/assinados
    { id: 'clientes',   label: '🗃️ Clientes' },
    { id: 'tema',       label: '🎨 Tema' },
  ];

  // Galeria de ícones para KPI
  const KPI_ICONS = [
    '📞','📲','📧','🤝','💼','🏆','🎯','💰','📈','📊',
    '🔥','⭐','🚀','✅','📅','🗓','👥','🏃','💡','🎤',
    '📝','🔔','💬','🌐','🛒','📦','🔑','⚡','🎁','🏅',
  ];

  // Módulos e planos padrão
  const MODULOS_PADRAO = ['Gestão Fiscal','CND','XML','BIA','IF','EP','Tributos'];
  const PLANOS_PADRAO = [
    { id: 'basic',   nome: 'Basic',    maxCnpjs: 25,  usuarios: 1  },
    { id: 'pro',     nome: 'Pro',      maxCnpjs: 80,  usuarios: 1  },
    { id: 'top',     nome: 'Top',      maxCnpjs: 150, usuarios: 5  },
    { id: 'topplus', nome: 'Top Plus', maxCnpjs: 999, usuarios: 999 },
  ];
  const PRECOS_PADRAO = {
    'Gestão Fiscal': { basic:[478,318], pro:[590,409], top:[1032,547], topplus:[1398,679] },
    'CND':           { basic:[0,48],   pro:[0,90],   top:[0,150],    topplus:[0,200]     },
    'XML':           { basic:[478,199], pro:[590,299], top:[1032,349], topplus:[1398,399] },
    'BIA':           { basic:[478,129], pro:[590,169], top:[1032,280], topplus:[1398,299] },
    'IF':            { basic:[1600,379],pro:[1600,619],top:[1600,920], topplus:[1600,1100]},
    'EP':            { basic:[0,39],   pro:[0,82],   top:[0,167],    topplus:[0,200]     },
    'Tributos':      { basic:[0,0],    pro:[0,0],    top:[0,0],      topplus:[0,0]       },
  };

  // Permissões disponíveis
  const PERMISSOES_DISPONIVEIS = [
    { id: 'ver_dashboard',    label: '📊 Ver Dashboard'           },
    { id: 'ver_chat',         label: '💬 Usar Chat'               },
    { id: 'ver_configuracoes',label: '⚙️ Ver Configurações'        },
    { id: 'editar_precos',    label: '💲 Editar Preços'            },
    { id: 'ver_historico',    label: '🗂️ Ver Histórico'            },
    { id: 'gerar_proposta',   label: '📄 Gerar Proposta'           },
    { id: 'gerar_contrato',   label: '📝 Gerar Contrato'           },
    { id: 'ver_clientes',     label: '🗃️ Ver Clientes'             },
    { id: 'gerenciar_usuarios',label:'👥 Gerenciar Usuários'       },
    { id: 'ver_kpis',         label: '📈 Ver KPIs'                 },
    { id: 'lancar_kpis',      label: '✏️ Lançar KPIs diários'      },
    { id: 'ver_vouchers',     label: '🎫 Ver/Gerar Vouchers'       },
    { id: 'gerenciar_documentos', label: '📄 Gerenciar Documentos' }, // Nova permissão
  ];

  // Permissões padrão por perfil
  const PERMISSOES_ADMIN = PERMISSOES_DISPONIVEIS.map(p => p.id);
  const PERMISSOES_USER  = ['ver_dashboard','ver_chat','gerar_proposta','gerar_contrato','ver_clientes','ver_historico','ver_kpis','lancar_kpis'];

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

  async function salvarStorage(empresaId, novoCfg) {
    return supabase.from('vx_storage').upsert({
      key: `cfg:${empresaId}`,
      value: JSON.stringify(novoCfg),
      updated_at: new Date().toISOString()
    });
  }

  // ══════════════════════════════════════════════
  // EFEITOS E CARREGAMENTO INICIAL
  // ══════════════════════════════════════════════
  useEffect(() => {
    async function checkUser() {
      const { data: { session }, error } = await supabase.auth.getSession();
      if (error || !session) {
        router.push('/'); // Redireciona para a página de login se não houver sessão
        return;
      }
      setUser(session.user);

      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('company_id')
        .eq('uuid', session.user.id)
        .single();

      if (profileError || !profile?.company_id) {
        console.error('Erro ao buscar company_id ou company_id não encontrado:', profileError);
        // Pode redirecionar para uma página de erro ou setup inicial da empresa
        router.push('/setup-empresa'); // Exemplo de redirecionamento
        return;
      }
      setEmpresaId(profile.company_id);
    }
    checkUser();
  }, [router]);

  useEffect(() => {
    async function loadConfig() {
      if (!empresaId) return; // Só carrega se empresaId estiver disponível

      setLoading(true);
      const { data, error } = await supabase
        .from('vx_storage')
        .select('value')
        .eq('key', `cfg:${empresaId}`)
        .single();

      if (error && error.code !== 'PGRST116') { // PGRST116 = no rows found (primeira vez)
        console.error('Erro ao carregar configurações:', error);
        setErrorMsg('Erro ao carregar configurações. Tente novamente.');
        setLoading(false);
        return;
      }

      let loadedCfg = data ? JSON.parse(data.value) : {};

      // Garante que as configurações essenciais existam
      loadedCfg = {
        company: loadedCfg.company || 'Minha Empresa',
        slogan: loadedCfg.slogan || 'Assistente Comercial',
        logob64: loadedCfg.logob64 || '',
        users: loadedCfg.users || [],
        kpiTemplates: loadedCfg.kpiTemplates || [],
        goals: loadedCfg.goals || [],
        products: loadedCfg.products || MODULOS_PADRAO,
        plans: loadedCfg.plans || PLANOS_PADRAO,
        prices: loadedCfg.prices || PRECOS_PADRAO,
        productNames: loadedCfg.productNames || {},
        vouchers: loadedCfg.vouchers || [],
        docTemplates: loadedCfg.docTemplates || [],
        docHistory: loadedCfg.docHistory || [],
        importedDocs: loadedCfg.importedDocs || [], // Novos documentos importados
        perfisTipos: loadedCfg.perfisTipos || [
          { id: 'admin', nome: 'Administrador', permissoes: PERMISSOES_ADMIN, fixo: true },
          { id: 'user',  nome: 'Vendedor',      permissoes: PERMISSOES_USER,  fixo: true },
        ],
        // Novas configurações de desconto
        discAdPct: loadedCfg.discAdPct !== undefined ? loadedCfg.discAdPct : 50, // Desconto adesão em tela
        discMenPct: loadedCfg.discMenPct !== undefined ? loadedCfg.discMenPct : 0, // Desconto mensalidade em tela
        discClosePct: loadedCfg.discClosePct !== undefined ? loadedCfg.discClosePct : 40, // Desconto adesão fechamento
        discountMode: loadedCfg.discountMode || 'tela', // 'tela' ou 'voucher'
        // Nova configuração de KPI
        kpiDailyRequired: loadedCfg.kpiDailyRequired !== undefined ? loadedCfg.kpiDailyRequired : false,
        ...loadedCfg // Sobrescreve com o que veio do banco
      };

      setCfg(loadedCfg);
      setKpiTemplates(loadedCfg.kpiTemplates);
      setDocumentosImportados(loadedCfg.importedDocs);
      setDocHistory(loadedCfg.docHistory);
      setLoading(false);
    }

    if (empresaId) {
      loadConfig();
    }
  }, [empresaId]);

  // Função genérica para salvar qualquer parte do cfg
  const handleSave = useCallback(async (key, value, successMessage) => {
    if (!empresaId) {
      setErrorMsg('ID da empresa não disponível. Tente recarregar a página.');
      return;
    }
    setSaving(true);
    const novoCfg = { ...cfg, [key]: value };
    const { error } = await salvarStorage(empresaId, novoCfg);
    setSaving(false);
    if (error) {
      setErrorMsg('Erro ao salvar: ' + error.message);
      toast('Erro ao salvar: ' + error.message, 'err');
      return;
    }
    setCfg(novoCfg);
    setSuccessMsg(successMessage);
    toast(successMessage);
    setTimeout(() => setSuccessMsg(''), 3000);
  }, [cfg, empresaId]);

  if (loading || !user || !empresaId) {
    return (
      <div style={s.centro}>
        <div style={s.spinner}></div>
        <p style={{ marginTop: 20, color: 'var(--muted)' }}>Carregando configurações...</p>
      </div>
    );
  }

  // ══════════════════════════════════════════════
  // ABA EMPRESA — CORREÇÃO DA LOGO
  // ══════════════════════════════════════════════
  function TabEmpresa({ cfg, setCfg, empresaId, handleSave }) {
    const [company,  setCompany]  = useState(cfg.company  || '');
    const [slogan,   setSlogan]   = useState(cfg.slogan   || '');
    const [logoB64,  setLogoB64]  = useState(cfg.logob64  || '');
    const [savingLocal, setSavingLocal] = useState(false);

    useEffect(() => {
      setCompany(cfg.company  || '');
      setSlogan(cfg.slogan    || '');
      setLogoB64(cfg.logob64  || '');
    }, [cfg]);

    function handleLogo(e) {
      const file = e.target.files[0];
      if (!file) return;
      if (file.size > 512000) { toast('Imagem muito grande (máx 500kb)', 'err'); return; }
      const reader = new FileReader();
      reader.onload = ev => setLogoB64(ev.target.result);
      reader.readAsDataURL(file);
    }

    function removerLogo() { setLogoB64(''); }

    async function salvar() {
      setSavingLocal(true);
      const novoCfg = { ...cfg, company, slogan, logob64: logoB64 };
      await handleSave('company', company, '✅ Empresa salva com sucesso!');
      await handleSave('slogan', slogan, ''); // Não exibe toast duplicado
      await handleSave('logob64', logoB64, ''); // Não exibe toast duplicado
      setSavingLocal(false);
    }

    return (
      <div style={s.body}>
        <div style={s.sec}>
          <div style={s.secTitle}>Identidade Visual</div>
          <div style={s.row2}>
            <div style={s.field}>
              <label style={s.label}>Nome da Empresa</label>
              <input style={s.input} value={company} onChange={e => setCompany(e.target.value)} placeholder="Ex: Vivanexa" />
            </div>
            <div style={s.field}>
              <label style={s.label}>Slogan / Subtítulo</label>
              <input style={s.input} value={slogan} onChange={e => setSlogan(e.target.value)} placeholder="Assistente Comercial" />
            </div>
          </div>

          <div style={s.field}>
            <label style={s.label}>Logomarca (PNG/JPG — máx 500kb)</label>
            <input type="file" accept="image/*" onChange={handleLogo} style={{ ...s.input, padding: '6px' }} />
          </div>

          {logoB64 ? (
            <div style={{ marginTop: 12, padding: 14, background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 10, display: 'inline-flex', flexDirection: 'column', alignItems: 'flex-start', gap: 10 }}>
              <div style={{ fontSize: 11, color: 'var(--muted)', letterSpacing: 1, textTransform: 'uppercase' }}>Pré-visualização</div>
              <img
                src={logoB64}
                alt="Logo"
                style={{ height: 70, maxWidth: 280, objectFit: 'contain', borderRadius: 8, border: '1px solid var(--border)' }}
                onError={e => { e.target.style.display = 'none' }}
              />
              <button onClick={removerLogo}
                style={{ fontSize: 12, color: 'var(--danger)', background: 'rgba(239,68,68,.1)', border: '1px solid rgba(239,68,68,.25)', padding: '4px 10px', borderRadius: 7, cursor: 'pointer', fontFamily: 'DM Mono, monospace' }}>
                🗑 Remover logo
              </button>
            </div>
          ) : (
            <div style={{ marginTop: 10, padding: '14px 18px', background: 'var(--surface2)', border: '1px dashed var(--border)', borderRadius: 10, fontSize: 13, color: 'var(--muted)', textAlign: 'center' }}>
              Nenhuma logomarca carregada
            </div>
          )}
        </div>
        <button style={s.saveBtn} onClick={salvar} disabled={savingLocal}>
          {savingLocal ? '⏳ Salvando...' : '✅ Salvar Empresa'}
        </button>
      </div>
    );
  }

  // ══════════════════════════════════════════════
  // ABA METAS
  // ══════════════════════════════════════════════
  function TabMetas({ cfg, setCfg, empresaId, handleSave }) {
    const mes = new Date().toISOString().slice(0, 7);
    const [mesRef,  setMesRef]  = useState(mes);
    const [metas,   setMetas]   = useState({});
    const [savingLocal, setSavingLocal] = useState(false);
    const usuarios = cfg.users || [];

    useEffect(() => {
      const g = cfg.goals || [];
      const map = {};
      g.filter(x => x.mes === mesRef).forEach(x => { map[x.userId] = x; });
      setMetas(map);
    }, [mesRef, cfg.goals]);

    function updateMeta(userId, campo, val) {
      setMetas(prev => ({ ...prev, [userId]: { ...(prev[userId] || { userId, mes: mesRef }), [campo]: val } }));
    }

    async function salvar() {
      setSavingLocal(true);
      const outrasGoals = (cfg.goals || []).filter(x => x.mes !== mesRef);
      const novasGoals  = Object.values(metas).map(m => ({ ...m, mes: mesRef }));
      await handleSave('goals', [...outrasGoals, ...novasGoals], '✅ Metas salvas!');
      setSavingLocal(false);
    }

    async function adminClear(tipo) {
      if (!confirm(`Confirma zerar ${tipo}? Esta ação é irreversível.`)) return;
      let novoCfg = { ...cfg };
      if (tipo === 'historico') novoCfg.docHistory = [];
      if (tipo === 'metas')     novoCfg.goals = [];
      if (tipo === 'clientes')  novoCfg.clients = [];
      if (tipo === 'tudo') novoCfg = { company: cfg.company, slogan: cfg.slogan, logob64: cfg.logob64, users: cfg.users, kpiTemplates: cfg.kpiTemplates, perfisTipos: cfg.perfisTipos, products: cfg.products, plans: cfg.plans, prices: cfg.prices, productNames: cfg.productNames, discAdPct: cfg.discAdPct, discMenPct: cfg.discMenPct, discClosePct: cfg.discClosePct, discountMode: cfg.discountMode, kpiDailyRequired: cfg.kpiDailyRequired }; // Mantém o essencial
      const { error } = await salvarStorage(empresaId, novoCfg); // Usa salvarStorage direto para reset completo
      if (error) { toast('Erro', 'err'); return; }
      setCfg(novoCfg); // Atualiza o estado local
      toast('🗑 Dados removidos!');
    }

    return (
      <div style={s.body}>
        <div style={s.sec}>
          <div style={s.secTitle}>Metas de Vendas por Usuário</div>
          <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 16, lineHeight: 1.6 }}>
            Defina metas mensais de adesão e mensalidade para cada vendedor.
          </p>
          <div style={{ marginBottom: 16 }}>
            <label style={s.label}>Mês de Referência</label>
            <input type="month" value={mesRef} onChange={e => setMesRef(e.target.value)} style={s.input} />
          </div>
          {usuarios.length === 0 && (
            <p style={{ color: 'var(--muted)', fontSize: 13 }}>Nenhum usuário cadastrado. Cadastre na aba Usuários.</p>
          )}
          {usuarios.map(u => (
            <div key={u.id} style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 10, padding: 14, marginBottom: 10 }}>
              <div style={{ fontWeight: 600, marginBottom: 10, color: 'var(--accent)', fontSize: 14 }}>{u.nome}</div>
              <div style={s.row2}>
                <div style={s.field}>
                  <label style={s.label}>Meta Adesão (R$)</label>
                  <input type="number" style={s.input}
                    value={metas[u.id]?.metaAdesao || ''}
                    onChange={e => updateMeta(u.id, 'metaAdesao', e.target.value)}
                    placeholder="0" />
                </div>
                <div style={s.field}>
                  <label style={s.label}>Meta Mensalidade (R$)</label>
                  <input type="number" style={s.input}
                    value={metas[u.id]?.metaMensalidade || ''}
                    onChange={e => updateMeta(u.id, 'metaMensalidade', e.target.value)}
                    placeholder="0" />
                </div>
              </div>
            </div>
          ))}
          <button style={s.saveBtn} onClick={salvar} disabled={savingLocal}>
            {savingLocal ? '⏳ Salvando...' : '✅ Salvar Metas'}
          </button>
        </div>

        <div style={s.sec}>
          <div style={{ ...s.secTitle, color: 'var(--danger)' }}>⚠️ Área Administrativa — Limpeza de Dados</div>
          {[
            ['historico', '🗑 Zerar histórico de contratos e propostas'],
            ['metas',     '🎯 Zerar metas de todos os usuários'],
            ['clientes',  '👥 Zerar banco de clientes'],
            ['tudo',      '⚠️ RESET COMPLETO — Apagar tudo (IRREVERSÍVEL)'],
          ].map(([tipo, label]) => (
            <button key={tipo} onClick={() => adminClear(tipo)}
              style={{ display: 'block', width: '100%', marginBottom: 8, padding: '11px 14px', borderRadius: 9,
                background: tipo === 'tudo' ? 'rgba(239,68,68,.2)' : 'rgba(239,68,68,.1)',
                border: tipo === 'tudo' ? '2px solid rgba(239,68,68,.5)' : '1px solid rgba(239,68,68,.3)',
                color: 'var(--danger)', fontFamily: 'DM Mono, monospace', fontSize: 13, cursor: 'pointer',
                textAlign: 'left', fontWeight: tipo === 'tudo' ? 700 : 400 }}>
              {label}
            </button>
          ))}
        </div>
      </div>
    );
  }

  // ══════════════════════════════════════════════
  // ABA KPIs — COM GALERIA DE ÍCONES E OBRIGATORIEDADE
  // ══════════════════════════════════════════════
  function TabKpis({ cfg, setCfg, empresaId, handleSave }) {
    const [kpis,        setKpis]        = useState(cfg.kpiTemplates || []);
    const [savingLocal, setSavingLocal] = useState(false);
    const [iconPickerId, setIconPickerId] = useState(null); // qual KPI está com seletor aberto
    const [kpiDailyRequired, setKpiDailyRequired] = useState(cfg.kpiDailyRequired);

    useEffect(() => {
      setKpis(cfg.kpiTemplates || []);
      setKpiDailyRequired(cfg.kpiDailyRequired);
    }, [cfg]);

    function addKpi() {
      setKpis(prev => [...prev, { id: Date.now(), nome: '', icone: '📊', meta: 0, unidade: 'un', cor: '#00d4ff' }]);
    }
    function updateKpi(id, campo, val) {
      setKpis(prev => prev.map(k => k.id === id ? { ...k, [campo]: val } : k));
    }
    function removeKpi(id) {
      setKpis(prev => prev.filter(k => k.id !== id));
      if (iconPickerId === id) setIconPickerId(null);
    }

    async function salvar() {
      setSavingLocal(true);
      await handleSave('kpiTemplates', kpis, '✅ KPIs salvos!');
      await handleSave('kpiDailyRequired', kpiDailyRequired, ''); // Salva a obrigatoriedade
      setSavingLocal(false);
    }

    return (
      <div style={s.body}>
        <div style={s.sec}>
          <div style={s.secTitle}>📊 Indicadores de Atividade (KPIs)</div>
          <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 14, lineHeight: 1.6 }}>
            Configure os KPIs que os vendedores irão acompanhar diariamente. Cada KPI aparece no Dashboard com sua meta.
          </p>

          {kpis.map(k => (
            <div key={k.id} style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 10, padding: '12px 14px', marginBottom: 10 }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: iconPickerId === k.id ? 12 : 0 }}>
                <div style={{ position: 'relative' }}>
                  <button onClick={() => setIconPickerId(iconPickerId === k.id ? null : k.id)}
                    style={{ width: 44, height: 44, borderRadius: 10, background: 'var(--surface)', border: '1px solid var(--border)', fontSize: 22, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'border-color .2s', borderColor: iconPickerId === k.id ? 'var(--accent)' : undefined }}
                    title="Escolher ícone">
                    {k.icone}
                  </button>
                </div>

                <input style={{ ...s.input, flex: 1 }} value={k.nome}
                  onChange={e => updateKpi(k.id, 'nome', e.target.value)}
                  placeholder="Nome do KPI (ex: Ligações realizadas)" />

                <input type="number" style={{ ...s.input, width: 90 }} value={k.meta}
                  onChange={e => updateKpi(k.id, 'meta', e.target.value)}
                  placeholder="Meta" />

                <select style={{ ...s.input, width: 72 }} value={k.unidade || 'un'}
                  onChange={e => updateKpi(k.id, 'unidade', e.target.value)}>
                  <option value="un">un</option>
                  <option value="R$">R$</option>
                  <option value="%">%</option>
                  <option value="h">h</option>
                </select>

                <button onClick={() => removeKpi(k.id)}
                  style={{ padding: '8px 12px', borderRadius: 8, background: 'rgba(239,68,68,.1)', border: '1px solid rgba(239,68,68,.3)', color: 'var(--danger)', cursor: 'pointer' }}>
                  🗑
                </button>
              </div>

              {iconPickerId === k.id && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, padding: '10px 0 2px' }}>
                  {KPI_ICONS.map(ic => (
                    <button key={ic} onClick={() => { updateKpi(k.id, 'icone', ic); setIconPickerId(null); }}
                      style={{ width: 36, height: 36, borderRadius: 8, background: k.icone === ic ? 'rgba(0,212,255,.15)' : 'var(--surface)', border: `1px solid ${k.icone === ic ? 'var(--accent)' : 'var(--border)'}`, fontSize: 18, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all .15s' }}>
                      {ic}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}

          <button onClick={addKpi}
            style={{ padding: '9px 16px', borderRadius: 8, background: 'rgba(0,212,255,.1)', border: '1px solid rgba(0,212,255,.25)', color: 'var(--accent)', fontFamily: 'DM Mono, monospace', fontSize: 13, cursor: 'pointer', fontWeight: 600, marginTop: 8 }}>
            ➕ Adicionar KPI
          </button>
        </div>

        <div style={s.sec}>
          <div style={s.secTitle}>Configurações de Preenchimento</div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 0' }}>
            <label htmlFor="kpi-required-toggle" style={{ fontSize: 14, color: 'var(--text)', flex: 1 }}>
              Obrigar preenchimento diário de KPIs
              <p style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4 }}>
                Se ativado, o usuário será bloqueado no dashboard até preencher os KPIs do dia anterior (após as 10h).
              </p>
            </label>
            <label className="switch">
              <input
                type="checkbox"
                id="kpi-required-toggle"
                checked={kpiDailyRequired}
                onChange={e => setKpiDailyRequired(e.target.checked)}
              />
              <span className="slider"></span>
            </label>
          </div>
        </div>

        <button style={s.saveBtn} onClick={salvar} disabled={savingLocal}>
          {savingLocal ? '⏳ Salvando...' : '✅ Salvar KPIs'}
        </button>
      </div>
    );
  }

  // ══════════════════════════════════════════════
  // ABA USUÁRIOS — COM PERMISSÕES + PERFIS
  // ══════════════════════════════════════════════
  function TabUsuarios({ cfg, setCfg, empresaId, handleSave }) {
    const [users,   setUsers]   = useState(cfg.users || []);
    const [form,    setForm]    = useState(null);
    const [savingLocal, setSavingLocal] = useState(false);
    const [abaU,    setAbaU]    = useState('lista'); // 'lista' | 'perfis'
    const [perfis,  setPerfis]  = useState(cfg.perfisTipos || [
      { id: 'admin', nome: 'Administrador', permissoes: PERMISSOES_ADMIN, fixo: true },
      { id: 'user',  nome: 'Vendedor',      permissoes: PERMISSOES_USER,  fixo: true },
    ]);
    const [perfilForm, setPerfilForm] = useState(null);

    const emptyForm = { nome: '', usuario: '', email: '', telefone: '', senha: '', perfilId: 'user', permissoes: PERMISSOES_USER };

    useEffect(() => {
      setUsers(cfg.users || []);
      setPerfis(cfg.perfisTipos || [
        { id: 'admin', nome: 'Administrador', permissoes: PERMISSOES_ADMIN, fixo: true },
        { id: 'user',  nome: 'Vendedor',      permissoes: PERMISSOES_USER,  fixo: true },
      ]);
    }, [cfg]);

    function editUser(u) { setForm({ ...u, permissoes: u.permissoes || PERMISSOES_USER }); }

    function removeUser(id) {
      if (!confirm('Remover usuário?')) return;
      setUsers(prev => prev.filter(u => u.id !== id));
      handleSave('users', users.filter(u => u.id !== id), '🗑 Usuário removido!');
    }

    function mudarPerfil(perfilId) {
      const p = perfis.find(x => x.id === perfilId);
      setForm(f => ({ ...f, perfilId, permissoes: p?.permissoes || PERMISSOES_USER }));
    }

    function togglePermissao(perm) {
      setForm(f => {
        const perms = f.permissoes || [];
        return { ...f, permissoes: perms.includes(perm) ? perms.filter(x => x !== perm) : [...perms, perm] };
      });
    }

    async function salvarUser() {
      if (!form.nome || !form.email) { toast('Nome e e-mail obrigatórios', 'err'); return; }
      setSavingLocal(true);
      let novos;
      if (form.id) {
        novos = users.map(u => u.id === form.id ? form : u);
      } else {
        novos = [...users, { ...form, id: Date.now().toString() }];
      }
      await handleSave('users', novos, '✅ Usuário salvo!');
      setUsers(novos);
      setForm(null);
      setSavingLocal(false);
    }

    // ── Perfis personalizados ──
    function addPerfil() {
      setPerfilForm({ id: 'perfil_' + Date.now(), nome: '', permissoes: PERMISSOES_USER, fixo: false });
    }
    function togglePerfilPerm(perm) {
      setPerfilForm(f => {
        const perms = f.permissoes || [];
        return { ...f, permissoes: perms.includes(perm) ? perms.filter(x => x !== perm) : [...perms, perm] };
      });
    }
    async function salvarPerfil() {
      if (!perfilForm.nome) { toast('Nome do perfil obrigatório', 'err'); return; }
      setSavingLocal(true);
      let novos;
      if (perfis.find(p => p.id === perfilForm.id)) {
        novos = perfis.map(p => p.id === perfilForm.id ? perfilForm : p);
      } else {
        novos = [...perfis, perfilForm];
      }
      await handleSave('perfisTipos', novos, '✅ Perfil salvo!');
      setPerfis(novos);
      setPerfilForm(null);
      setSavingLocal(false);
    }
    async function removerPerfil(id) {
      if (!confirm('Remover perfil?')) return;
      const novos = perfis.filter(p => p.id !== id);
      await handleSave('perfisTipos', novos, '🗑 Perfil removido!');
      setPerfis(novos);
    }

    const nomePerfilLabel = (perfilId) => perfis.find(p => p.id === perfilId)?.nome || perfilId;

    return (
      <div style={s.body}>
        <div style={{ display: 'flex', gap: 6, marginBottom: 20 }}>
          {[['lista','👥 Usuários'],['perfis','🔐 Tipos de Perfil']].map(([id, label]) => (
            <button key={id} onClick={() => setAbaU(id)}
              style={{ padding: '8px 16px', borderRadius: 9, fontFamily: 'DM Mono, monospace', fontSize: 12, cursor: 'pointer',
                background: abaU === id ? 'rgba(0,212,255,.12)' : 'var(--surface2)',
                border: `1px solid ${abaU === id ? 'rgba(0,212,255,.35)' : 'var(--border)'}`,
                color: abaU === id ? 'var(--accent)' : 'var(--muted)', fontWeight: abaU === id ? 600 : 400 }}>
              {label}
            </button>
          ))}
        </div>

        {abaU === 'lista' && (
          <div style={s.sec}>
            <div style={s.secTitle}>Usuários do Sistema</div>
            {users.length === 0 && <p style={{ color: 'var(--muted)', fontSize: 13, marginBottom: 12 }}>Nenhum usuário cadastrado.</p>}
            {users.map(u => (
              <div key={u.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 10, marginBottom: 8 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>{u.nome}</div>
                  <div style={{ fontSize: 12, color: 'var(--muted)' }}>
                    {u.email} · <span style={{ color: 'var(--accent)', fontWeight: 600 }}>{nomePerfilLabel(u.perfilId || u.perfil)}</span>
                  </div>
                  {u.permissoes && (
                    <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 3 }}>
                      {u.permissoes.length} permissões configuradas
                    </div>
                  )}
                </div>
                <button onClick={() => editUser(u)}
                  style={{ padding: '5px 10px', borderRadius: 7, background: 'rgba(0,212,255,.1)', border: '1px solid rgba(0,212,255,.2)', color: 'var(--accent)', cursor: 'pointer', fontFamily: 'DM Mono, monospace', fontSize: 12 }}>
                  ✏️ Editar
                </button>
                <button onClick={() => removeUser(u.id)}
                  style={{ padding: '5px 10px', borderRadius: 7, background: 'rgba(239,68,68,.1)', border: '1px solid rgba(239,68,68,.2)', color: 'var(--danger)', cursor: 'pointer', fontFamily: 'DM Mono, monospace', fontSize: 12 }}>
                  🗑
                </button>
              </div>
            ))}
            <button onClick={() => setForm(emptyForm)}
              style={{ padding: '9px 16px', borderRadius: 8, background: 'rgba(0,212,255,.1)', border: '1px solid rgba(0,212,255,.25)', color: 'var(--accent)', fontFamily: 'DM Mono, monospace', fontSize: 13, cursor: 'pointer', marginTop: 8 }}>
              + Novo Usuário
            </button>

            {form && (
              <div style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 12, padding: 18, marginTop: 16 }}>
                <div style={{ ...s.secTitle, marginBottom: 14 }}>
                  {form.id ? '✏️ Editar Usuário' : '➕ Novo Usuário'}
                </div>
                <div style={s.row2}>
                  <div style={s.field}><label style={s.label}>Nome Completo</label>
                    <input style={s.input} value={form.nome} onChange={e => setForm(f => ({ ...f, nome: e.target.value }))} placeholder="Nome" />
                  </div>
                  <div style={s.field}><label style={s.label}>Usuário (login)</label>
                    <input style={s.input} value={form.usuario} onChange={e => setForm(f => ({ ...f, usuario: e.target.value }))} placeholder="usuario" />
                  </div>
                </div>
                <div style={s.row2}>
                  <div style={s.field}><label style={s.label}>E-mail</label>
                    <input style={s.input} type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="email@empresa.com" />
                  </div>
                  <div style={s.field}><label style={s.label}>Telefone</label>
                    <input style={s.input} value={form.telefone} onChange={e => setForm(f => ({ ...f, telefone: e.target.value }))} placeholder="(00) 00000-0000" />
                  </div>
                </div>
                <div style={s.row2}>
                  <div style={s.field}><label style={s.label}>Senha</label>
                    <input style={s.input} type="password" value={form.senha} onChange={e => setForm(f => ({ ...f, senha: e.target.value }))} placeholder="••••••••" />
                  </div>
                  <div style={s.field}><label style={s.label}>Perfil base</label>
                    <select style={s.input} value={form.perfilId || form.perfil || 'user'} onChange={e => mudarPerfil(e.target.value)}>
                      {perfis.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}
                    </select>
                  </div>
                </div>

                <div style={{ marginTop: 8 }}>
                  <div style={{ ...s.secTitle, marginBottom: 10 }}>🔐 Permissões individuais</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                    {PERMISSOES_DISPONIVEIS.map(p => {
                      const ativo = (form.permissoes || []).includes(p.id);
                      return (
                        <div key={p.id} onClick={() => togglePermissao(p.id)}
                          style={{ padding: '8px 12px', borderRadius: 8, cursor: 'pointer', fontSize: 13,
                            background: ativo ? 'rgba(0,212,255,.1)' : 'var(--surface)',
                            border: `1px solid ${ativo ? 'rgba(0,212,255,.3)' : 'var(--border)'}`,
                            color: ativo ? 'var(--accent)' : 'var(--muted)',
                            display: 'flex', alignItems: 'center', gap: 8 }}>
                          {ativo ? '✅' : '⬜'} {p.label}
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 10, marginTop: 20, justifyContent: 'flex-end' }}>
                  <button onClick={() => setForm(null)} style={s.btnCancel}>Cancelar</button>
                  <button onClick={salvarUser} style={s.btnPrimary} disabled={savingLocal}>
                    {savingLocal ? '⏳ Salvando...' : '✅ Salvar Usuário'}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── TIPOS DE PERFIL ── */}
        {abaU === 'perfis' && (
          <div style={s.sec}>
            <div style={s.secTitle}>Tipos de Perfil Personalizados</div>
            <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 14, lineHeight: 1.6 }}>
              Crie perfis com conjuntos de permissões pré-definidos para facilitar a gestão de usuários.
            </p>
            {perfis.map(p => (
              <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 10, marginBottom: 8 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>{p.nome} {p.fixo && <span style={{ fontSize: 11, color: 'var(--accent)', marginLeft: 5 }}>(Padrão)</span>}</div>
                  <div style={{ fontSize: 12, color: 'var(--muted)' }}>
                    {p.permissoes.length} permissões
                  </div>
                </div>
                {!p.fixo && (
                  <>
                    <button onClick={() => setPerfilForm(p)}
                      style={{ padding: '5px 10px', borderRadius: 7, background: 'rgba(0,212,255,.1)', border: '1px solid rgba(0,212,255,.2)', color: 'var(--accent)', cursor: 'pointer', fontFamily: 'DM Mono, monospace', fontSize: 12 }}>
                      ✏️ Editar
                    </button>
                    <button onClick={() => removerPerfil(p.id)}
                      style={{ padding: '5px 10px', borderRadius: 7, background: 'rgba(239,68,68,.1)', border: '1px solid rgba(239,68,68,.2)', color: 'var(--danger)', cursor: 'pointer', fontFamily: 'DM Mono, monospace', fontSize: 12 }}>
                      🗑
                    </button>
                  </>
                )}
              </div>
            ))}
            <button onClick={addPerfil}
              style={{ padding: '9px 16px', borderRadius: 8, background: 'rgba(0,212,255,.1)', border: '1px solid rgba(0,212,255,.25)', color: 'var(--accent)', fontFamily: 'DM Mono, monospace', fontSize: 13, cursor: 'pointer', marginTop: 8 }}>
              + Novo Perfil
            </button>

            {perfilForm && (
              <div style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 12, padding: 18, marginTop: 16 }}>
                <div style={{ ...s.secTitle, marginBottom: 14 }}>
                  {perfilForm.id.startsWith('perfil_') ? '➕ Novo Perfil' : '✏️ Editar Perfil'}
                </div>
                <div style={s.field}>
                  <label style={s.label}>Nome do Perfil</label>
                  <input style={s.input} value={perfilForm.nome} onChange={e => setPerfilForm(f => ({ ...f, nome: e.target.value }))} placeholder="Ex: Gerente de Vendas" />
                </div>

                <div style={{ marginTop: 8 }}>
                  <div style={{ ...s.secTitle, marginBottom: 10 }}>🔐 Permissões do Perfil</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                    {PERMISSOES_DISPONIVEIS.map(p => {
                      const ativo = (perfilForm.permissoes || []).includes(p.id);
                      return (
                        <div key={p.id} onClick={() => togglePerfilPerm(p.id)}
                          style={{ padding: '8px 12px', borderRadius: 8, cursor: 'pointer', fontSize: 13,
                            background: ativo ? 'rgba(0,212,255,.1)' : 'var(--surface)',
                            border: `1px solid ${ativo ? 'rgba(0,212,255,.3)' : 'var(--border)'}`,
                            color: ativo ? 'var(--accent)' : 'var(--muted)',
                            display: 'flex', alignItems: 'center', gap: 8 }}>
                          {ativo ? '✅' : '⬜'} {p.label}
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 10, marginTop: 20, justifyContent: 'flex-end' }}>
                  <button onClick={() => setPerfilForm(null)} style={s.btnCancel}>Cancelar</button>
                  <button onClick={salvarPerfil} style={s.btnPrimary} disabled={savingLocal}>
                    {savingLocal ? '⏳ Salvando...' : '✅ Salvar Perfil'}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  // ══════════════════════════════════════════════
  // ABA PRODUTOS
  // ══════════════════════════════════════════════
  function TabProdutos({ cfg, setCfg, empresaId, handleSave }) {
    const [modulos, setModulos] = useState(cfg.products || MODULOS_PADRAO);
    const [planos, setPlanos] = useState(cfg.plans || PLANOS_PADRAO);
    const [precos, setPrecos] = useState(cfg.prices || PRECOS_PADRAO);
    const [productNames, setProductNames] = useState(cfg.productNames || {});
    const [savingLocal, setSavingLocal] = useState(false);

    useEffect(() => {
      setModulos(cfg.products || MODULOS_PADRAO);
      setPlanos(cfg.plans || PLANOS_PADRAO);
      setPrecos(cfg.prices || PRECOS_PADRAO);
      setProductNames(cfg.productNames || {});
    }, [cfg]);

    function updateModuloName(oldName, newName) {
      setModulos(prev => prev.map(m => m === oldName ? newName : m));
      setProductNames(prev => ({ ...prev, [oldName]: newName }));
      // Atualiza chaves em precos
      setPrecos(prev => {
        const newPrecos = {};
        for (const key in prev) {
          newPrecos[key === oldName ? newName : key] = prev[key];
        }
        return newPrecos;
      });
    }

    function addModulo() {
      setModulos(prev => [...prev, 'Novo Módulo']);
      setPrecos(prev => ({ ...prev, 'Novo Módulo': {} }));
    }

    function removeModulo(name) {
      if (!confirm(`Remover módulo "${name}"?`)) return;
      setModulos(prev => prev.filter(m => m !== name));
      setPrecos(prev => {
        const newPrecos = { ...prev };
        delete newPrecos[name];
        return newPrecos;
      });
      setProductNames(prev => {
        const newNames = { ...prev };
        delete newNames[name];
        return newNames;
      });
    }

    function updatePlano(id, field, value) {
      setPlanos(prev => prev.map(p => p.id === id ? { ...p, [field]: value } : p));
    }

    function updatePreco(modulo, planoId, tipo, value) {
      setPrecos(prev => ({
        ...prev,
        [modulo]: {
          ...prev[modulo],
          [planoId]: tipo === 'adesao'
            ? [parseFloat(value), prev[modulo]?.[planoId]?.[1] || 0]
            : [prev[modulo]?.[planoId]?.[0] || 0, parseFloat(value)]
        }
      }));
    }

    async function salvar() {
      setSavingLocal(true);
      await handleSave('products', modulos, '✅ Produtos salvos!');
      await handleSave('plans', planos, '');
      await handleSave('prices', precos, '');
      await handleSave('productNames', productNames, '');
      setSavingLocal(false);
    }

    return (
      <div style={s.body}>
        <div style={s.sec}>
          <div style={s.secTitle}>📦 Módulos / Produtos</div>
          <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 14, lineHeight: 1.6 }}>
            Defina os módulos que compõem seu serviço e seus nomes de exibição.
          </p>
          {modulos.map((mod, idx) => (
            <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 10, marginBottom: 8 }}>
              <input style={{ ...s.input, flex: 1 }} value={productNames[mod] || mod}
                onChange={e => updateModuloName(mod, e.target.value)}
                placeholder="Nome do Módulo" />
              <button onClick={() => removeModulo(mod)}
                style={{ padding: '8px 12px', borderRadius: 8, background: 'rgba(239,68,68,.1)', border: '1px solid rgba(239,68,68,.3)', color: 'var(--danger)', cursor: 'pointer' }}>
                🗑
              </button>
            </div>
          ))}
          <button onClick={addModulo}
            style={{ padding: '9px 16px', borderRadius: 8, background: 'rgba(0,212,255,.1)', border: '1px solid rgba(0,212,255,.25)', color: 'var(--accent)', fontFamily: 'DM Mono, monospace', fontSize: 13, cursor: 'pointer', fontWeight: 600, marginTop: 8 }}>
            ➕ Adicionar Módulo
          </button>
        </div>

        <div style={s.sec}>
          <div style={s.secTitle}>📊 Planos de Serviço</div>
          <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 14, lineHeight: 1.6 }}>
            Configure os planos disponíveis e seus limites de CNPJs e usuários.
          </p>
          {planos.map(p => (
            <div key={p.id} style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 10, padding: 14, marginBottom: 10 }}>
              <div style={{ fontWeight: 600, marginBottom: 10, color: 'var(--accent)', fontSize: 14 }}>{p.nome}</div>
              <div style={s.row2}>
                <div style={s.field}>
                  <label style={s.label}>Max CNPJs</label>
                  <input type="number" style={s.input} value={p.maxCnpjs} onChange={e => updatePlano(p.id, 'maxCnpjs', parseInt(e.target.value))} />
                </div>
                <div style={s.field}>
                  <label style={s.label}>Max Usuários</label>
                  <input type="number" style={s.input} value={p.usuarios} onChange={e => updatePlano(p.id, 'usuarios', parseInt(e.target.value))} />
                </div>
              </div>
            </div>
          ))}
        </div>

        <div style={s.sec}>
          <div style={s.secTitle}>💲 Tabela de Preços por Módulo e Plano</div>
          <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 14, lineHeight: 1.6 }}>
            Defina os preços base de adesão e mensalidade para cada módulo em cada plano.
          </p>
          {modulos.map(mod => (
            <div key={mod} style={{ marginBottom: 20, background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 10, padding: 14 }}>
              <h4 style={{ fontSize: 15, fontWeight: 600, marginBottom: 12, color: 'var(--text)' }}>{productNames[mod] || mod}</h4>
              {planos.map(plano => (
                <div key={plano.id} style={{ marginBottom: 10, padding: '10px 0', borderBottom: '1px dashed var(--border)' }}>
                  <div style={{ fontWeight: 500, marginBottom: 8, color: 'var(--accent)' }}>{plano.nome}</div>
                  <div style={s.row2}>
                    <div style={s.field}>
                      <label style={s.label}>Adesão (R$)</label>
                      <input type="number" style={s.input}
                        value={precos[mod]?.[plano.id]?.[0] || 0}
                        onChange={e => updatePreco(mod, plano.id, 'adesao', e.target.value)} />
                    </div>
                    <div style={s.field}>
                      <label style={s.label}>Mensalidade (R$)</label>
                      <input type="number" style={s.input}
                        value={precos[mod]?.[plano.id]?.[1] || 0}
                        onChange={e => updatePreco(mod, plano.id, 'mensalidade', e.target.value)} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>

        <button style={s.saveBtn} onClick={salvar} disabled={savingLocal}>
          {savingLocal ? '⏳ Salvando...' : '✅ Salvar Produtos e Preços'}
        </button>
      </div>
    );
  }

  // ══════════════════════════════════════════════
  // ABA DESCONTOS — NOVAS CONFIGURAÇÕES
  // ══════════════════════════════════════════════
  function TabDescontos({ cfg, setCfg, empresaId, handleSave }) {
    const [discAdPct, setDiscAdPct] = useState(cfg.discAdPct);
    const [discMenPct, setDiscMenPct] = useState(cfg.discMenPct);
    const [discClosePct, setDiscClosePct] = useState(cfg.discClosePct);
    const [discountMode, setDiscountMode] = useState(cfg.discountMode);
    const [savingLocal, setSavingLocal] = useState(false);

    useEffect(() => {
      setDiscAdPct(cfg.discAdPct);
      setDiscMenPct(cfg.discMenPct);
      setDiscClosePct(cfg.discClosePct);
      setDiscountMode(cfg.discountMode);
    }, [cfg]);

    async function salvar() {
      setSavingLocal(true);
      await handleSave('discAdPct', discAdPct, '✅ Descontos salvos!');
      await handleSave('discMenPct', discMenPct, '');
      await handleSave('discClosePct', discClosePct, '');
      await handleSave('discountMode', discountMode, '');
      setSavingLocal(false);
    }

    return (
      <div style={s.body}>
        <div style={s.sec}>
          <div style={s.secTitle}>🏷️ Regras de Desconto Padrão</div>
          <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 14, lineHeight: 1.6 }}>
            Defina os percentuais de desconto padrão aplicados em propostas e o modo de aplicação.
          </p>

          <div style={s.field}>
            <label style={s.label}>% Desconto Adesão (em tela)</label>
            <input type="number" style={s.input} value={discAdPct} onChange={e => setDiscAdPct(parseFloat(e.target.value))} placeholder="50" min="0" max="100" />
            <p style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>
              Percentual de desconto na adesão exibido na tela de proposta.
            </p>
          </div>

          <div style={s.field}>
            <label style={s.label}>% Desconto Mensalidade (em tela)</label>
            <input type="number" style={s.input} value={discMenPct} onChange={e => setDiscMenPct(parseFloat(e.target.value))} placeholder="0" min="0" max="100" />
            <p style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>
              Percentual de desconto na mensalidade exibido na tela de proposta.
            </p>
          </div>

          <div style={s.field}>
            <label style={s.label}>% Desconto Adesão (fechamento)</label>
            <input type="number" style={s.input} value={discClosePct} onChange={e => setDiscClosePct(parseFloat(e.target.value))} placeholder="40" min="0" max="100" />
            <p style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>
              Percentual de desconto adicional na adesão para o fechamento (aplicado no cálculo final).
            </p>
          </div>

          <div style={s.field}>
            <label style={s.label}>Modo de Desconto</label>
            <select style={s.input} value={discountMode} onChange={e => setDiscountMode(e.target.value)}>
              <option value="tela">Aplicar desconto em tela</option>
              <option value="voucher">Aplicar desconto via voucher</option>
            </select>
            <p style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>
              Define se os descontos são aplicados automaticamente ou se exigem um voucher.
            </p>
          </div>
        </div>

        <button style={s.saveBtn} onClick={salvar} disabled={savingLocal}>
          {savingLocal ? '⏳ Salvando...' : '✅ Salvar Descontos'}
        </button>
      </div>
    );
  }

  // ══════════════════════════════════════════════
  // ABA VOUCHERS
  // ══════════════════════════════════════════════
  function TabVouchers({ cfg, setCfg, empresaId, handleSave }) {
    const [vouchers, setVouchers] = useState(cfg.vouchers || []);
    const [newVoucherCode, setNewVoucherCode] = useState('');
    const [newVoucherDiscount, setNewVoucherDiscount] = useState(0);
    const [newVoucherType, setNewVoucherType] = useState('adesao'); // 'adesao' | 'mensalidade' | 'total'
    const [savingLocal, setSavingLocal] = useState(false);

    useEffect(() => {
      setVouchers(cfg.vouchers || []);
    }, [cfg]);

    function addVoucher() {
      if (!newVoucherCode || newVoucherDiscount <= 0) {
        toast('Preencha código e desconto válidos.', 'err');
        return;
      }
      const newV = {
        id: uuidv4(),
        code: newVoucherCode.toUpperCase(),
        discount: newVoucherDiscount,
        type: newVoucherType,
        createdAt: new Date().toISOString(),
        used: false,
      };
      setVouchers(prev => [...prev, newV]);
      setNewVoucherCode('');
      setNewVoucherDiscount(0);
      toast('Voucher adicionado localmente. Salve para persistir.');
    }

    function removeVoucher(id) {
      if (!confirm('Remover voucher?')) return;
      setVouchers(prev => prev.filter(v => v.id !== id));
      toast('Voucher removido localmente. Salve para persistir.');
    }

    async function salvar() {
      setSavingLocal(true);
      await handleSave('vouchers', vouchers, '✅ Vouchers salvos!');
      setSavingLocal(false);
    }

    function imprimirVoucher(voucher) {
      const printWindow = window.open('', '_blank');
      printWindow.document.write(`
        <html>
        <head>
          <title>Voucher de Desconto</title>
          <style>
            body { font-family: 'Inter', sans-serif; margin: 0; padding: 40px; background: #f0f2f5; color: #333; }
            .voucher-card {
              width: 350px; margin: 0 auto; padding: 30px; border: 2px dashed #00d4ff; border-radius: 15px;
              background: #fff; text-align: center; box-shadow: 0 8px 20px rgba(0,0,0,0.1);
              position: relative; overflow: hidden;
            }
            .voucher-card::before {
              content: ''; position: absolute; top: -20px; left: -20px; right: -20px; bottom: -20px;
              background: radial-gradient(circle at center, rgba(0,212,255,0.05) 0%, transparent 70%);
              z-index: 0;
            }
            h1 { color: #00d4ff; font-size: 28px; margin-bottom: 10px; font-family: 'Syne', sans-serif; font-weight: 800; }
            h2 { color: #333; font-size: 22px; margin-bottom: 5px; }
            p { font-size: 14px; color: #666; margin-bottom: 8px; }
            .code {
              font-family: 'DM Mono', monospace; font-size: 36px; font-weight: bold; color: #7c3aed;
              background: #f3e8ff; padding: 10px 20px; border-radius: 8px; margin: 20px 0;
              letter-spacing: 2px; display: inline-block;
            }
            .discount-info { font-size: 16px; color: #555; margin-top: 15px; }
            .footer { font-size: 12px; color: #999; margin-top: 30px; }
            @media print {
              body { background: #fff; padding: 0; }
              .voucher-card { box-shadow: none; border: 1px dashed #ccc; }
            }
          </style>
        </head>
        <body>
          <div class="voucher-card">
            <h1>Voucher de Desconto</h1>
            <p>${cfg.company || 'Sua Empresa'}</p>
            <div class="code">${voucher.code}</div>
            <h2>${voucher.discount}% OFF</h2>
            <p class="discount-info">Aplicável em ${voucher.type === 'adesao' ? 'Adesão' : voucher.type === 'mensalidade' ? 'Mensalidade' : 'Valor Total'}</p>
            <p class="footer">Válido por tempo limitado. Não cumulativo com outras promoções.</p>
          </div>
        </body>
        </html>
      `);
      printWindow.document.close();
      printWindow.print();
    }

    return (
      <div style={s.body}>
        <div style={s.sec}>
          <div style={s.secTitle}>🎫 Gerar Novo Voucher</div>
          <div style={s.row2}>
            <div style={s.field}>
              <label style={s.label}>Código do Voucher</label>
              <input style={s.input} value={newVoucherCode} onChange={e => setNewVoucherCode(e.target.value)} placeholder="EX: DESCONTO10" />
            </div>
            <div style={s.field}>
              <label style={s.label}>% Desconto</label>
              <input type="number" style={s.input} value={newVoucherDiscount} onChange={e => setNewVoucherDiscount(parseFloat(e.target.value))} placeholder="10" min="1" max="100" />
            </div>
          </div>
          <div style={s.field}>
            <label style={s.label}>Tipo de Desconto</label>
            <select style={s.input} value={newVoucherType} onChange={e => setNewVoucherType(e.target.value)}>
              <option value="adesao">Adesão</option>
              <option value="mensalidade">Mensalidade</option>
              <option value="total">Total (Adesão + Mensalidade)</option>
            </select>
          </div>
          <button onClick={addVoucher} style={s.btnPrimary}>
            ➕ Adicionar Voucher
          </button>
        </div>

        <div style={s.sec}>
          <div style={s.secTitle}>Vouchers Ativos</div>
          {vouchers.length === 0 && <p style={{ color: 'var(--muted)', fontSize: 13, marginBottom: 12 }}>Nenhum voucher cadastrado.</p>}
          {vouchers.map(v => (
            <div key={v.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 10, marginBottom: 8 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--accent)' }}>{v.code}</div>
                <div style={{ fontSize: 12, color: 'var(--muted)' }}>
                  {v.discount}% OFF em {v.type === 'adesao' ? 'Adesão' : v.type === 'mensalidade' ? 'Mensalidade' : 'Total'}
                </div>
              </div>
              <button onClick={() => imprimirVoucher(v)}
                style={{ padding: '5px 10px', borderRadius: 7, background: 'rgba(0,212,255,.1)', border: '1px solid rgba(0,212,255,.2)', color: 'var(--accent)', cursor: 'pointer', fontFamily: 'DM Mono, monospace', fontSize: 12 }}>
                🖨 Imprimir
              </button>
              <button onClick={() => removeVoucher(v.id)}
                style={{ padding: '5px 10px', borderRadius: 7, background: 'rgba(239,68,68,.1)', border: '1px solid rgba(239,68,68,.2)', color: 'var(--danger)', cursor: 'pointer', fontFamily: 'DM Mono, monospace', fontSize: 12 }}>
                🗑
              </button>
            </div>
          ))}
        </div>

        <button style={s.saveBtn} onClick={salvar} disabled={savingLocal}>
          {savingLocal ? '⏳ Salvando...' : '✅ Salvar Vouchers'}
        </button>
      </div>
    );
  }

  // ══════════════════════════════════════════════
  // ABA DOCUMENTOS — UPLOAD E GESTÃO
  // ══════════════════════════════════════════════
  function TabDocumentos({ cfg, setCfg, empresaId, handleSave }) {
    const [docs, setDocs] = useState(cfg.importedDocs || []);
    const [selectedFile, setSelectedFile] = useState(null);
    const [uploadingLocal, setUploadingLocal] = useState(false);
    const [savingLocal, setSavingLocal] = useState(false);

    useEffect(() => {
      setDocs(cfg.importedDocs || []);
    }, [cfg]);

    const handleFileChange = (e) => {
      setSelectedFile(e.target.files[0]);
    };

    const uploadDocument = async () => {
      if (!selectedFile) {
        toast('Selecione um arquivo para upload.', 'err');
        return;
      }
      setUploadingLocal(true);
      const fileExtension = selectedFile.name.split('.').pop();
      const fileName = `${uuidv4()}.${fileExtension}`;
      const filePath = `${empresaId}/${fileName}`;

      const { data, error } = await supabase.storage
        .from('documents') // Certifique-se que este bucket existe no Supabase
        .upload(filePath, selectedFile, {
          cacheControl: '3600',
          upsert: false,
        });

      if (error) {
        console.error('Erro ao fazer upload do documento:', error);
        toast('Erro ao fazer upload: ' + error.message, 'err');
        setUploadingLocal(false);
        return;
      }

      const { data: publicUrlData } = supabase.storage
        .from('documents')
        .getPublicUrl(filePath);

      const newDoc = {
        id: uuidv4(),
        name: selectedFile.name,
        type: selectedFile.type,
        url: publicUrlData.publicUrl,
        filePath: filePath,
        uploadedAt: new Date().toISOString(),
        userId: user.id,
      };

      const updatedDocs = [...docs, newDoc];
      setDocs(updatedDocs);
      setSelectedFile(null);
      toast('✅ Documento enviado com sucesso! Salve para persistir.');
      setUploadingLocal(false);
    };

    const removeDocument = async (docId, filePath) => {
      if (!confirm('Remover documento? Esta ação é irreversível.')) return;

      // Remove do Supabase Storage
      const { error: storageError } = await supabase.storage
        .from('documents')
        .remove([filePath]);

      if (storageError) {
        console.error('Erro ao remover do storage:', storageError);
        toast('Erro ao remover do storage: ' + storageError.message, 'err');
        return;
      }

      const updatedDocs = docs.filter(d => d.id !== docId);
      setDocs(updatedDocs);
      toast('Documento removido localmente. Salve para persistir.');
    };

    async function salvar() {
      setSavingLocal(true);
      await handleSave('importedDocs', docs, '✅ Documentos importados salvos!');
      setSavingLocal(false);
    }

    return (
      <div style={s.body}>
        <div style={s.sec}>
          <div style={s.secTitle}>📄 Importar Documentos</div>
          <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 14, lineHeight: 1.6 }}>
            Faça upload de documentos (PDF, HTML) para uso no sistema.
          </p>
          <div style={s.field}>
            <label style={s.label}>Selecionar Arquivo (PDF, HTML)</label>
            <input type="file" accept=".pdf,.html" onChange={handleFileChange} style={{ ...s.input, padding: '6px' }} />
          </div>
          <button onClick={uploadDocument} style={s.btnPrimary} disabled={!selectedFile || uploadingLocal}>
            {uploadingLocal ? '⏳ Enviando...' : '⬆️ Fazer Upload'}
          </button>
        </div>

        <div style={s.sec}>
          <div style={s.secTitle}>Documentos Importados</div>
          {docs.length === 0 && <p style={{ color: 'var(--muted)', fontSize: 13, marginBottom: 12 }}>Nenhum documento importado.</p>}
          {docs.map(doc => (
            <div key={doc.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 10, marginBottom: 8 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: 14 }}>{doc.name}</div>
                <div style={{ fontSize: 12, color: 'var(--muted)' }}>
                  {new Date(doc.uploadedAt).toLocaleDateString()} - {doc.type}
                </div>
              </div>
              <a href={doc.url} target="_blank" rel="noopener noreferrer"
                style={{ padding: '5px 10px', borderRadius: 7, background: 'rgba(0,212,255,.1)', border: '1px solid rgba(0,212,255,.2)', color: 'var(--accent)', cursor: 'pointer', fontFamily: 'DM Mono, monospace', fontSize: 12, textDecoration: 'none' }}>
                👁 Ver
              </a>
              <button onClick={() => removeDocument(doc.id, doc.filePath)}
                style={{ padding: '5px 10px', borderRadius: 7, background: 'rgba(239,68,68,.1)', border: '1px solid rgba(239,68,68,.2)', color: 'var(--danger)', cursor: 'pointer', fontFamily: 'DM Mono, monospace', fontSize: 12 }}>
                🗑
              </button>
            </div>
          ))}
        </div>

        <button style={s.saveBtn} onClick={salvar} disabled={savingLocal}>
          {savingLocal ? '⏳ Salvando...' : '✅ Salvar Documentos Importados'}
        </button>
      </div>
    );
  }

  // ══════════════════════════════════════════════
  // ABA HISTÓRICO — DOCUMENTOS GERADOS E ASSINADOS
  // ══════════════════════════════════════════════
  function TabHistorico({ cfg, setCfg, empresaId, handleSave, setShowDocModal, setModalDocContent, setModalDocTitle }) {
    const [history, setHistory] = useState(cfg.docHistory || []);
    const [savingLocal, setSavingLocal] = useState(false);

    useEffect(() => {
      setHistory(cfg.docHistory || []);
    }, [cfg]);

    const viewDocumentContent = async (docId, docType) => {
      // Para documentos gerados (HTML)
      if (docType === 'proposta' || docType === 'contrato') {
        const { data, error } = await supabase.storage
          .from('documents')
          .download(`${empresaId}/generated/${docId}.html`);

        if (error) {
          console.error('Erro ao baixar conteúdo do documento:', error);
          toast('Erro ao carregar conteúdo do documento.', 'err');
          return;
        }
        const text = await data.text();
        setModalDocContent(text);
        setModalDocTitle(`Visualizar ${docType === 'proposta' ? 'Proposta' : 'Contrato'}`);
        setShowDocModal(true);
      } else {
        // Para outros tipos, pode abrir em nova aba ou tratar de forma diferente
        toast('Funcionalidade de visualização para este tipo de documento não implementada.', 'err');
      }
    };

    const removeHistoryItem = (id) => {
      if (!confirm('Remover item do histórico?')) return;
      const updatedHistory = history.filter(item => item.id !== id);
      setHistory(updatedHistory);
      toast('Item do histórico removido localmente. Salve para persistir.');
    };

    async function salvar() {
      setSavingLocal(true);
      await handleSave('docHistory', history, '✅ Histórico salvo!');
      setSavingLocal(false);
    }

    return (
      <div style={s.body}>
        <div style={s.sec}>
          <div style={s.secTitle}>🗂️ Histórico de Documentos</div>
          <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 14, lineHeight: 1.6 }}>
            Acompanhe todas as propostas e contratos gerados e seus status de assinatura.
          </p>

          {history.length === 0 && <p style={{ color: 'var(--muted)', fontSize: 13, marginBottom: 12 }}>Nenhum documento no histórico.</p>}
          {history.map(doc => (
            <div key={doc.id} style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 10, padding: 14, marginBottom: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--text)' }}>
                  {doc.type === 'proposta' ? 'Proposta' : 'Contrato'} - {doc.clientName}
                </div>
                <span style={{ fontSize: 11, color: doc.status === 'assinado' ? 'var(--accent3)' : 'var(--muted)', fontWeight: 600 }}>
                  {doc.status === 'assinado' ? '✅ ASSINADO' : '⏳ PENDENTE'}
                </span>
              </div>
              <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 10 }}>
                Gerado em: {new Date(doc.createdAt).toLocaleDateString()} por {doc.userName}
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button onClick={() => viewDocumentContent(doc.id, doc.type)}
                  style={{ padding: '6px 12px', borderRadius: 8, background: 'rgba(0,212,255,.1)', border: '1px solid rgba(0,212,255,.2)', color: 'var(--accent)', cursor: 'pointer', fontFamily: 'DM Mono, monospace', fontSize: 12 }}>
                  👁 Ver Documento
                </button>
                <a href={`/sign/${doc.id}`} target="_blank" rel="noopener noreferrer"
                  style={{ padding: '6px 12px', borderRadius: 8, background: 'rgba(124,58,237,.1)', border: '1px solid rgba(124,58,237,.2)', color: 'var(--accent2)', cursor: 'pointer', fontFamily: 'DM Mono, monospace', fontSize: 12, textDecoration: 'none' }}>
                  🔗 Link Assinatura
                </a>
                <button onClick={() => removeHistoryItem(doc.id)}
                  style={{ padding: '6px 12px', borderRadius: 8, background: 'rgba(239,68,68,.1)', border: '1px solid rgba(239,68,68,.2)', color: 'var(--danger)', cursor: 'pointer', fontFamily: 'DM Mono, monospace', fontSize: 12 }}>
                  🗑 Remover
                </button>
              </div>
            </div>
          ))}
        </div>

        <button style={s.saveBtn} onClick={salvar} disabled={savingLocal}>
          {savingLocal ? '⏳ Salvando...' : '✅ Salvar Histórico'}
        </button>
      </div>
    );
  }

  // ══════════════════════════════════════════════
  // ABA CLIENTES
  // ══════════════════════════════════════════════
  function TabClientes({ cfg, setCfg, empresaId, handleSave }) {
    const [clients, setClients] = useState(cfg.clients || []);
    const [savingLocal, setSavingLocal] = useState(false);

    useEffect(() => {
      setClients(cfg.clients || []);
    }, [cfg]);

    async function salvar() {
      setSavingLocal(true);
      await handleSave('clients', clients, '✅ Clientes salvos!');
      setSavingLocal(false);
    }

    return (
      <div style={s.body}>
        <div style={s.sec}>
          <div style={s.secTitle}>🗃️ Gestão de Clientes</div>
          <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 14, lineHeight: 1.6 }}>
            Aqui você pode visualizar e gerenciar seus clientes.
          </p>
          {clients.length === 0 && <p style={{ color: 'var(--muted)', fontSize: 13, marginBottom: 12 }}>Nenhum cliente cadastrado.</p>}
          {clients.map(client => (
            <div key={client.id} style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 10, padding: 14, marginBottom: 10 }}>
              <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--text)' }}>{client.name}</div>
              <div style={{ fontSize: 12, color: 'var(--muted)' }}>
                {client.document} - {client.email}
              </div>
            </div>
          ))}
        </div>
        <button style={s.saveBtn} onClick={salvar} disabled={savingLocal}>
          {savingLocal ? '⏳ Salvando...' : '✅ Salvar Clientes'}
        </button>
      </div>
    );
  }

  // ══════════════════════════════════════════════
  // ABA TEMA
  // ══════════════════════════════════════════════
  function TabTema({ cfg, setCfg, empresaId, handleSave }) {
    const [theme, setTheme] = useState(cfg.theme || 'dark');
    const [savingLocal, setSavingLocal] = useState(false);

    useEffect(() => {
      setTheme(cfg.theme || 'dark');
    }, [cfg]);

    async function salvar() {
      setSavingLocal(true);
      await handleSave('theme', theme, '✅ Tema salvo!');
      setSavingLocal(false);
    }

    return (
      <div style={s.body}>
        <div style={s.sec}>
          <div style={s.secTitle}>🎨 Tema da Aplicação</div>
          <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 14, lineHeight: 1.6 }}>
            Escolha o tema visual para a interface do sistema.
          </p>
          <div style={s.field}>
            <label style={s.label}>Tema</label>
            <select style={s.input} value={theme} onChange={e => setTheme(e.target.value)}>
              <option value="dark">Escuro</option>
              <option value="light">Claro</option>
            </select>
          </div>
        </div>
        <button style={s.saveBtn} onClick={salvar} disabled={savingLocal}>
          {savingLocal ? '⏳ Salvando...' : '✅ Salvar Tema'}
        </button>
      </div>
    );
  }

  // ══════════════════════════════════════════════
  // RENDERIZAÇÃO PRINCIPAL
  // ══════════════════════════════════════════════
  return (
    <>
      <Head>
        <title>Configurações — {cfg.company}</title>
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
            {TABS.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                style={{ ...s.navItem, ...(activeTab === tab.id ? s.navItemActive : {}) }}
              >
                {tab.label}
              </button>
            ))}
          </nav>

          <button onClick={() => supabase.auth.signOut()} style={s.logoutBtn}>
            Sair
          </button>
        </aside>

        <main style={s.mainContent}>
          <h1 style={s.pageTitle}>Configurações da Empresa</h1>
          {errorMsg && <div style={s.errorBox}>{errorMsg}</div>}
          {successMsg && <div style={s.successBox}>{successMsg}</div>}

          {activeTab === 'geral'      && <TabEmpresa    cfg={cfg} setCfg={setCfg} empresaId={empresaId} handleSave={handleSave} />}
          {activeTab === 'metas'      && <TabMetas      cfg={cfg} setCfg={setCfg} empresaId={empresaId} handleSave={handleSave} />}
          {activeTab === 'kpis'       && <TabKpis       cfg={cfg} setCfg={setCfg} empresaId={empresaId} handleSave={handleSave} />}
          {activeTab === 'usuarios'   && <TabUsuarios   cfg={cfg} setCfg={setCfg} empresaId={empresaId} handleSave={handleSave} />}
          {activeTab === 'produtos'   && <TabProdutos   cfg={cfg} setCfg={setCfg} empresaId={empresaId} handleSave={handleSave} />}
          {activeTab === 'descontos'  && <TabDescontos  cfg={cfg} setCfg={setCfg} empresaId={empresaId} handleSave={handleSave} />}
          {activeTab === 'vouchers'   && <TabVouchers   cfg={cfg} setCfg={setCfg} empresaId={empresaId} handleSave={handleSave} />}
          {activeTab === 'documentos' && <TabDocumentos cfg={cfg} setCfg={setCfg} empresaId={empresaId} handleSave={handleSave} />}
          {activeTab === 'historico'  && <TabHistorico  cfg={cfg} setCfg={setCfg} empresaId={empresaId} handleSave={handleSave} setShowDocModal={setShowDocModal} setModalDocContent={setModalDocContent} setModalDocTitle={setModalDocTitle} />}
          {activeTab === 'clientes'   && <TabClientes   cfg={cfg} setCfg={setCfg} empresaId={empresaId} handleSave={handleSave} />}
          {activeTab === 'tema'       && <TabTema       cfg={cfg} setCfg={setCfg} empresaId={empresaId} handleSave={handleSave} />}
        </main>
      </div>

      {/* Modal de visualização de documento */}
      {showDocModal && (
        <div style={s.modalOverlay}>
          <div style={s.modalBox}>
            <div style={s.modalHeader}>
              <h3>{modalDocTitle}</h3>
              <button onClick={() => setShowDocModal(false)} style={s.modalClose}>✕</button>
            </div>
            <div style={s.modalBody}>
              <div dangerouslySetInnerHTML={{ __html: modalDocContent }} />
            </div>
            <div style={s.modalFooter}>
              <button onClick={() => setShowDocModal(false)} style={s.btnCancel}>Fechar</button>
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
  sec: {
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    borderRadius: 16,
    padding: 24,
    marginBottom: 24,
    boxShadow: 'var(--shadow)',
  },
  secTitle: {
    fontFamily: 'Syne, sans-serif',
    fontSize: 18,
    fontWeight: 700,
    color: 'var(--accent)',
    marginBottom: 16,
  },
  field: {
    marginBottom: 16,
    flex: 1,
  },
  label: {
    display: 'block',
    fontSize: 12,
    color: 'var(--muted)',
    marginBottom: 6,
    letterSpacing: '.5px',
    textTransform: 'uppercase',
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
  row2: {
    display: 'flex',
    gap: 20,
    marginBottom: 0,
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
  errorBox: {
    background: 'rgba(239,68,68,.1)',
    border: '1px solid rgba(239,68,68,.3)',
    color: 'var(--danger)',
    padding: '12px 18px',
    borderRadius: 10,
    marginBottom: 20,
    fontSize: 14,
  },
  successBox: {
    background: 'rgba(16,185,129,.1)',
    border: '1px solid rgba(16,185,129,.3)',
    color: 'var(--accent3)',
    padding: '12px 18px',
    borderRadius: 10,
    marginBottom: 20,
    fontSize: 14,
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
    maxWidth: 800, // Aumentado para melhor visualização de documentos
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
  modalCloseHover: {
    color: 'var(--text)',
  },
  modalBody: {
    padding: '20px 24px',
    overflowY: 'auto',
    flex: 1,
    background: '#fff', // Fundo branco para o conteúdo do documento
    color: '#333',      // Texto escuro para o conteúdo do documento
    borderRadius: 8,
    margin: '0 24px',
    border: '1px solid #eee',
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
  btnPrimary: {
    padding: '10px 22px',
    borderRadius: 10,
    background: 'linear-gradient(135deg,var(--accent),#0099bb)',
    border: 'none',
    color: '#fff',
    fontFamily: 'DM Mono, monospace',
    fontSize: 13,
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'all .2s',
  },
};
