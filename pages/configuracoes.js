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
// 6. KPIs: Obrigar preenchimento diário de KPIs
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
  const [newKpiTarget, setNewKpiTarget] = useState('');
  const [newKpiUnit, setNewKpiUnit] = useState('');
  const [documentUploadFile, setDocumentUploadFile] = useState(null);
  const [documentUploadName, setDocumentUploadName] = useState('');
  const [documentUploadType, setDocumentUploadType] = useState('html'); // 'html' ou 'pdf'

  const PERMISSIONS_OPTIONS = [
    { id: 'view_dashboard', name: 'Ver Dashboard' },
    { id: 'manage_users', name: 'Gerenciar Usuários' },
    { id: 'manage_products', name: 'Gerenciar Produtos' },
    { id: 'manage_discounts', name: 'Gerenciar Descontos' },
    { id: 'manage_documents', name: 'Gerenciar Documentos' },
    { id: 'manage_kpis', name: 'Gerenciar KPIs' },
    { id: 'create_proposals', name: 'Criar Propostas' },
    { id: 'sign_documents', name: 'Assinar Documentos' },
  ];

  const fetchUserData = useCallback(async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      router.push('/'); // Redireciona para login se não houver usuário
      return;
    }
    setUser(user);

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('company_id, role')
      .eq('uuid', user.id)
      .single();

    if (profileError || !profile?.company_id) {
      console.error('Erro ao buscar perfil ou company_id:', profileError);
      setErrorMsg('Não foi possível carregar as configurações da empresa. Verifique seu perfil.');
      setLoading(false);
      return;
    }
    setEmpresaId(profile.company_id);

    const { data: cfgRow, error: cfgError } = await supabase
      .from('vx_storage')
      .select('value')
      .eq('key', `cfg:${profile.company_id}`)
      .single();

    if (cfgError && cfgError.code !== 'PGRST116') { // PGRST116 = no rows found
      console.error('Erro ao buscar configurações:', cfgError);
      setErrorMsg('Erro ao carregar configurações da empresa.');
      setLoading(false);
      return;
    }

    const initialCfg = cfgRow?.value ? JSON.parse(cfgRow.value) : {
      company: 'Minha Empresa',
      logob64: '',
      plans: [
        { id: 'basic', name: 'Basic', maxCnpjs: 5, maxUsers: 2 },
        { id: 'pro', name: 'Pro', maxCnpjs: 20, maxUsers: 5 },
        { id: 'top', name: 'Top', maxCnpjs: 50, maxUsers: 10 },
        { id: 'topplus', name: 'Top Plus', maxCnpjs: 9999, maxUsers: 9999 },
      ],
      productNames: {
        'IF': 'Inteligência Fiscal',
        'Gestão Fiscal': 'Gestão Fiscal',
        'BIA': 'BIA',
        'CND': 'CND',
        'XML': 'XML',
        'Tributos': 'Tributos',
        'EP': 'E-Processos',
      },
      prices: {
        'IF': { 'basic': [0, 150], 'pro': [0, 250], 'top': [0, 400], 'topplus': [0, 600] },
        'Gestão Fiscal': { 'basic': [500, 100], 'pro': [750, 150], 'top': [1000, 200], 'topplus': [1200, 250] },
        'BIA': { 'basic': [0, 50], 'pro': [0, 80], 'top': [0, 120], 'topplus': [0, 180] },
        'CND': { 'basic': [0, 30], 'pro': [0, 50], 'top': [0, 80], 'topplus': [0, 120] },
        'XML': { 'basic': [0, 70], 'pro': [0, 120], 'top': [0, 180], 'topplus': [0, 250] },
        'Tributos': { 'basic': [0, 0], 'pro': [0, 0], 'top': [0, 0], 'topplus': [0, 0] }, // Preço calculado à parte
        'EP': { 'basic': [0, 80], 'pro': [0, 150], 'top': [0, 250], 'topplus': [0, 350] },
      },
      users: [], // Lista de usuários da empresa com permissões
      discAdPct: 50, // Desconto de adesão em tela
      discMenPct: 0,  // Desconto de mensalidade em tela
      discClosePct: 40, // Desconto de adesão no fechamento
      discountMode: 'screen', // 'screen' ou 'voucher'
      documents: [], // Lista de documentos importados
      docHistory: [], // Histórico de documentos gerados/assinados
      kpiTemplates: [], // Modelos de KPI
      kpiDailyMandatory: false, // Obrigar preenchimento diário de KPIs
    };

    setCfg(initialCfg);
    setKpiTemplates(initialCfg.kpiTemplates || []);
    setLoading(false);
  }, [router]);

  useEffect(() => {
    fetchUserData();
  }, [fetchUserData]);

  const handleSaveConfig = async (updatedCfg) => {
    if (!empresaId) {
      setErrorMsg('ID da empresa não encontrado. Não foi possível salvar.');
      return;
    }
    setSaving(true);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      const { error } = await supabase.from('vx_storage').upsert({
        key: `cfg:${empresaId}`,
        value: JSON.stringify(updatedCfg),
        updated_at: new Date().toISOString(),
      });

      if (error) throw error;

      setCfg(updatedCfg);
      setSuccessMsg('Configurações salvas com sucesso!');
    } catch (e) {
      console.error('Erro ao salvar configurações:', e);
      setErrorMsg('Erro ao salvar configurações. Tente novamente.');
    } finally {
      setSaving(false);
      setTimeout(() => setSuccessMsg(''), 3000);
      setTimeout(() => setErrorMsg(''), 5000);
    }
  };

  const handleLogoUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        handleSaveConfig({ ...cfg, logob64: reader.result });
      };
      reader.readAsDataURL(file);
    }
  };

  const handleAddUser = async () => {
    if (!newUserName || !newUserEmail || !newUserRole) {
      setErrorMsg('Preencha todos os campos para adicionar um usuário.');
      return;
    }

    // Verifica se o usuário já existe no Supabase Auth
    const { data: existingUsers, error: searchError } = await supabase.auth.admin.listUsers({
      email: newUserEmail,
    });

    let userId = null;
    if (searchError) {
      console.error('Erro ao buscar usuário existente:', searchError);
      setErrorMsg('Erro ao verificar usuário existente.');
      return;
    }

    if (existingUsers.users.length > 0) {
      userId = existingUsers.users[0].id;
    } else {
      // Se não existe, cria um novo usuário no Supabase Auth
      const { data: newUserAuth, error: createError } = await supabase.auth.admin.createUser({
        email: newUserEmail,
        password: uuidv4(), // Senha temporária, o usuário definirá a própria
        email_confirm: true,
      });

      if (createError) {
        console.error('Erro ao criar usuário no Auth:', createError);
        setErrorMsg(`Erro ao criar usuário: ${createError.message}.`);
        return;
      }
      userId = newUserAuth.user.id;
    }

    const updatedUsers = [...(cfg.users || []), {
      id: userId,
      name: newUserName,
      email: newUserEmail,
      role: newUserRole,
      permissions: newUserPermissions,
      company_id: empresaId,
    }];

    await handleSaveConfig({ ...cfg, users: updatedUsers });
    setNewUserName('');
    setNewUserEmail('');
    setNewUserRole('user');
    setNewUserPermissions([]);
  };

  const handleUpdateUser = async (index, field, value) => {
    const updatedUsers = [...cfg.users];
    updatedUsers[index][field] = value;
    await handleSaveConfig({ ...cfg, users: updatedUsers });
  };

  const handleDeleteUser = async (index) => {
    const updatedUsers = cfg.users.filter((_, i) => i !== index);
    await handleSaveConfig({ ...cfg, users: updatedUsers });
  };

  const handlePermissionChange = (userId, permissionId, isChecked) => {
    const updatedUsers = cfg.users.map(u => {
      if (u.id === userId) {
        const newPermissions = isChecked
          ? [...(u.permissions || []), permissionId]
          : (u.permissions || []).filter(p => p !== permissionId);
        return { ...u, permissions: newPermissions };
      }
      return u;
    });
    handleSaveConfig({ ...cfg, users: updatedUsers });
  };

  const handleAddKpiTemplate = async () => {
    if (!newKpiName || !newKpiTarget || !newKpiUnit) {
      setErrorMsg('Preencha todos os campos para adicionar um modelo de KPI.');
      return;
    }
    const newTemplate = {
      id: uuidv4(),
      name: newKpiName,
      target: Number(newKpiTarget),
      unit: newKpiUnit,
    };
    const updatedKpiTemplates = [...kpiTemplates, newTemplate];
    setKpiTemplates(updatedKpiTemplates);
    await handleSaveConfig({ ...cfg, kpiTemplates: updatedKpiTemplates });
    setNewKpiName('');
    setNewKpiTarget('');
    setNewKpiUnit('');
  };

  const handleDeleteKpiTemplate = async (id) => {
    const updatedKpiTemplates = kpiTemplates.filter(kpi => kpi.id !== id);
    setKpiTemplates(updatedKpiTemplates);
    await handleSaveConfig({ ...cfg, kpiTemplates: updatedKpiTemplates });
  };

  const handleDocumentUpload = async (e) => {
    e.preventDefault();
    if (!documentUploadFile || !documentUploadName) {
      setErrorMsg('Selecione um arquivo e insira um nome para o documento.');
      return;
    }

    setSaving(true);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      const fileExtension = documentUploadFile.name.split('.').pop();
      const filePath = `${empresaId}/documents/${uuidv4()}.${fileExtension}`;

      const { data, error: uploadError } = await supabase.storage
        .from('documents') // Certifique-se de ter um bucket 'documents' no Supabase Storage
        .upload(filePath, documentUploadFile, {
          cacheControl: '3600',
          upsert: false,
        });

      if (uploadError) throw uploadError;

      const publicUrl = supabase.storage.from('documents').getPublicUrl(filePath).data.publicUrl;

      const newDocument = {
        id: uuidv4(),
        name: documentUploadName,
        type: documentUploadType,
        url: publicUrl,
        uploaded_at: new Date().toISOString(),
        file_path: filePath,
      };

      const updatedDocuments = [...(cfg.documents || []), newDocument];
      await handleSaveConfig({ ...cfg, documents: updatedDocuments });

      setDocumentUploadFile(null);
      setDocumentUploadName('');
      setDocumentUploadType('html');
      setSuccessMsg('Documento enviado com sucesso!');
    } catch (e) {
      console.error('Erro ao fazer upload do documento:', e);
      setErrorMsg(`Erro ao enviar documento: ${e.message}`);
    } finally {
      setSaving(false);
      setTimeout(() => setSuccessMsg(''), 3000);
      setTimeout(() => setErrorMsg(''), 5000);
    }
  };

  const handleDeleteDocument = async (docId, filePath) => {
    if (!confirm('Tem certeza que deseja excluir este documento?')) return;

    setSaving(true);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      // Excluir do Supabase Storage
      const { error: storageError } = await supabase.storage
        .from('documents')
        .remove([filePath]);

      if (storageError) throw storageError;

      // Excluir da configuração
      const updatedDocuments = cfg.documents.filter(doc => doc.id !== docId);
      await handleSaveConfig({ ...cfg, documents: updatedDocuments });
      setSuccessMsg('Documento excluído com sucesso!');
    } catch (e) {
      console.error('Erro ao excluir documento:', e);
      setErrorMsg(`Erro ao excluir documento: ${e.message}`);
    } finally {
      setSaving(false);
      setTimeout(() => setSuccessMsg(''), 3000);
      setTimeout(() => setErrorMsg(''), 5000);
    }
  };

  if (loading) {
    return (
      <div style={st.container}>
        <Head><title>Carregando Configurações...</title></Head>
        <div style={st.loadingBox}>
          <div style={st.spinner} />
          <p style={{ color: 'var(--muted)', fontSize: 14, marginTop: 20 }}>Carregando configurações...</p>
        </div>
      </div>
    );
  }

  if (errorMsg && !cfg) { // Exibe erro fatal se não conseguiu carregar cfg
    return (
      <div style={st.container}>
        <Head><title>Erro</title></Head>
        <div style={st.errorBox}>
          <div style={{ fontSize: 48, textAlign: 'center', marginBottom: 16 }}>❌</div>
          <h2 style={{ ...st.titulo, color: 'var(--danger)', textAlign: 'center' }}>Erro ao Carregar</h2>
          <p style={st.sub}>{errorMsg}</p>
          <button onClick={() => router.reload()} style={{ ...st.btnPrimary, marginTop: 20 }}>Tentar Novamente</button>
        </div>
      </div>
    );
  }

  return (
    <div style={st.container}>
      <Head><title>Configurações — {cfg?.company || 'Vivanexa'}</title></Head>

      <h1 style={st.pageTitle}>⚙️ Configurações</h1>

      <div style={st.tabs}>
        <button onClick={() => setActiveTab('geral')} className={activeTab === 'geral' ? 'active' : ''}>Geral</button>
        <button onClick={() => setActiveTab('produtos')} className={activeTab === 'produtos' ? 'active' : ''}>Produtos</button>
        <button onClick={() => setActiveTab('usuarios')} className={activeTab === 'usuarios' ? 'active' : ''}>Usuários</button>
        <button onClick={() => setActiveTab('descontos')} className={activeTab === 'descontos' ? 'active' : ''}>🏷️ Descontos</button>
        <button onClick={() => setActiveTab('documentos')} className={activeTab === 'documentos' ? 'active' : ''}>📄 Documentos</button>
        <button onClick={() => setActiveTab('kpis')} className={activeTab === 'kpis' ? 'active' : ''}>📊 KPIs</button>
        <button onClick={() => setActiveTab('historico')} className={activeTab === 'historico' ? 'active' : ''}>🗂️ Histórico</button>
      </div>

      <div style={st.tabContent}>
        {successMsg && <div style={st.successAlert}>✅ {successMsg}</div>}
        {errorMsg && <div style={st.errorAlert}>⚠️ {errorMsg}</div>}

        {/* Tab Geral */}
        {activeTab === 'geral' && (
          <TabGeral cfg={cfg} handleSaveConfig={handleSaveConfig} handleLogoUpload={handleLogoUpload} />
        )}

        {/* Tab Produtos */}
        {activeTab === 'produtos' && (
          <TabProdutos cfg={cfg} handleSaveConfig={handleSaveConfig} />
        )}

        {/* Tab Usuários */}
        {activeTab === 'usuarios' && (
          <TabUsuarios
            cfg={cfg}
            newUserName={newUserName} setNewUserName={setNewUserName}
            newUserEmail={newUserEmail} setNewUserEmail={setNewUserEmail}
            newUserRole={newUserRole} setNewUserRole={setNewUserRole}
            newUserPermissions={newUserPermissions} setNewUserPermissions={setNewUserPermissions}
            handleAddUser={handleAddUser}
            handleUpdateUser={handleUpdateUser}
            handleDeleteUser={handleDeleteUser}
            handlePermissionChange={handlePermissionChange}
            permissionsOptions={PERMISSIONS_OPTIONS}
          />
        )}

        {/* Tab Descontos */}
        {activeTab === 'descontos' && (
          <TabDescontos cfg={cfg} handleSaveConfig={handleSaveConfig} />
        )}

        {/* Tab Documentos */}
        {activeTab === 'documentos' && (
          <TabDocumentos
            cfg={cfg}
            documentUploadFile={documentUploadFile} setDocumentUploadFile={setDocumentUploadFile}
            documentUploadName={documentUploadName} setDocumentUploadName={setDocumentUploadName}
            documentUploadType={documentUploadType} setDocumentUploadType={setDocumentUploadType}
            handleDocumentUpload={handleDocumentUpload}
            handleDeleteDocument={handleDeleteDocument}
            saving={saving}
          />
        )}

        {/* Tab KPIs */}
        {activeTab === 'kpis' && (
          <TabKPIs
            cfg={cfg}
            handleSaveConfig={handleSaveConfig}
            kpiTemplates={kpiTemplates}
            newKpiName={newKpiName} setNewKpiName={setNewKpiName}
            newKpiTarget={newKpiTarget} setNewKpiTarget={setNewKpiTarget}
            newKpiUnit={newKpiUnit} setNewKpiUnit={setNewKpiUnit}
            handleAddKpiTemplate={handleAddKpiTemplate}
            handleDeleteKpiTemplate={handleDeleteKpiTemplate}
          />
        )}

        {/* Tab Histórico */}
        {activeTab === 'historico' && (
          <TabHistorico cfg={cfg} />
        )}
      </div>
    </div>
  );
}

// ── SUB-COMPONENTES DAS ABAS ──────────────────────────────────

function TabGeral({ cfg, handleSaveConfig, handleLogoUpload }) {
  const [companyName, setCompanyName] = useState(cfg.company);

  useEffect(() => {
    setCompanyName(cfg.company);
  }, [cfg.company]);

  const onSave = () => {
    handleSaveConfig({ ...cfg, company: companyName });
  };

  return (
    <div style={st.card}>
      <h2 style={st.cardTitle}>Informações Gerais da Empresa</h2>
      <div style={st.campo}>
        <label style={st.label}>Nome da Empresa</label>
        <input style={st.input} value={companyName} onChange={e => setCompanyName(e.target.value)} />
      </div>
      <div style={st.campo}>
        <label style={st.label}>Logo da Empresa</label>
        {cfg.logob64 && <img src={cfg.logob64} alt="Logo da Empresa" style={{ maxWidth: 150, maxHeight: 80, marginBottom: 10, border: '1px solid var(--border)', borderRadius: 8, padding: 5 }} />}
        <input type="file" accept="image/*" onChange={handleLogoUpload} style={st.fileInput} />
        <p style={st.sub}>Faça upload de um arquivo de imagem (PNG, JPG) para o logo da sua empresa.</p>
      </div>
      <div style={st.btnGroup}>
        <button onClick={onSave} style={st.btnPrimary}>Salvar Alterações</button>
      </div>
    </div>
  );
}

function TabProdutos({ cfg, handleSaveConfig }) {
  const [localCfg, setLocalCfg] = useState(cfg);

  useEffect(() => {
    setLocalCfg(cfg);
  }, [cfg]);

  const handlePlanChange = (index, field, value) => {
    const updatedPlans = [...localCfg.plans];
    updatedPlans[index][field] = value;
    setLocalCfg({ ...localCfg, plans: updatedPlans });
  };

  const handleProductNameChange = (key, value) => {
    setLocalCfg({
      ...localCfg,
      productNames: { ...localCfg.productNames, [key]: value }
    });
  };

  const handlePriceChange = (module, planId, type, value) => {
    const updatedPrices = { ...localCfg.prices };
    if (!updatedPrices[module]) updatedPrices[module] = {};
    if (!updatedPrices[module][planId]) updatedPrices[module][planId] = [0, 0];

    const priceArray = [...updatedPrices[module][planId]];
    if (type === 'adesao') priceArray[0] = Number(value);
    if (type === 'mensalidade') priceArray[1] = Number(value);

    updatedPrices[module][planId] = priceArray;
    setLocalCfg({ ...localCfg, prices: updatedPrices });
  };

  const onSave = () => {
    handleSaveConfig(localCfg);
  };

  return (
    <div style={st.card}>
      <h2 style={st.cardTitle}>Planos e Produtos</h2>

      <h3 style={st.sectionHeader}>Planos</h3>
      {localCfg.plans.map((plan, index) => (
        <div key={plan.id} style={st.itemCard}>
          <label style={st.label}>ID do Plano</label>
          <input style={st.input} value={plan.id} disabled />
          <label style={st.label}>Nome do Plano</label>
          <input style={st.input} value={plan.name} onChange={e => handlePlanChange(index, 'name', e.target.value)} />
          <label style={st.label}>Máx CNPJs</label>
          <input style={st.input} type="number" value={plan.maxCnpjs} onChange={e => handlePlanChange(index, 'maxCnpjs', Number(e.target.value))} />
          <label style={st.label}>Máx Usuários</label>
          <input style={st.input} type="number" value={plan.maxUsers} onChange={e => handlePlanChange(index, 'maxUsers', Number(e.target.value))} />
        </div>
      ))}

      <h3 style={st.sectionHeader}>Nomes dos Produtos</h3>
      {Object.entries(localCfg.productNames).map(([key, name]) => (
        <div key={key} style={st.itemCard}>
          <label style={st.label}>Chave Interna</label>
          <input style={st.input} value={key} disabled />
          <label style={st.label}>Nome Exibido</label>
          <input style={st.input} value={name} onChange={e => handleProductNameChange(key, e.target.value)} />
        </div>
      ))}

      <h3 style={st.sectionHeader}>Tabela de Preços por Módulo e Plano</h3>
      {Object.keys(localCfg.prices).map(module => (
        <div key={module} style={st.itemCard}>
          <h4 style={st.itemTitle}>{localCfg.productNames[module] || module}</h4>
          {localCfg.plans.map(plan => (
            <div key={`${module}-${plan.id}`} style={{ marginBottom: 10, borderBottom: '1px dashed var(--border)', paddingBottom: 10 }}>
              <p style={{ ...st.label, fontWeight: 600, color: 'var(--text)' }}>{plan.name}</p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label style={st.label}>Adesão</label>
                  <input
                    style={st.input}
                    type="number"
                    value={localCfg.prices[module]?.[plan.id]?.[0] || 0}
                    onChange={e => handlePriceChange(module, plan.id, 'adesao', e.target.value)}
                  />
                </div>
                <div>
                  <label style={st.label}>Mensalidade</label>
                  <input
                    style={st.input}
                    type="number"
                    value={localCfg.prices[module]?.[plan.id]?.[1] || 0}
                    onChange={e => handlePriceChange(module, plan.id, 'mensalidade', e.target.value)}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      ))}

      <div style={st.btnGroup}>
        <button onClick={onSave} style={st.btnPrimary}>Salvar Tabela de Preços</button>
      </div>
    </div>
  );
}

function TabUsuarios({
  cfg, newUserName, setNewUserName, newUserEmail, setNewUserEmail,
  newUserRole, setNewUserRole, newUserPermissions, setNewUserPermissions,
  handleAddUser, handleUpdateUser, handleDeleteUser, handlePermissionChange,
  permissionsOptions
}) {
  const onPermissionToggle = (permissionId) => {
    setNewUserPermissions(prev =>
      prev.includes(permissionId)
        ? prev.filter(p => p !== permissionId)
        : [...prev, permissionId]
    );
  };

  return (
    <div style={st.card}>
      <h2 style={st.cardTitle}>Gerenciamento de Usuários</h2>

      <h3 style={st.sectionHeader}>Adicionar Novo Usuário</h3>
      <div style={st.itemCard}>
        <div style={st.campo}>
          <label style={st.label}>Nome</label>
          <input style={st.input} value={newUserName} onChange={e => setNewUserName(e.target.value)} placeholder="Nome completo" />
        </div>
        <div style={st.campo}>
          <label style={st.label}>E-mail</label>
          <input style={st.input} type="email" value={newUserEmail} onChange={e => setNewUserEmail(e.target.value)} placeholder="email@empresa.com" />
        </div>
        <div style={st.campo}>
          <label style={st.label}>Função</label>
          <select style={st.input} value={newUserRole} onChange={e => setNewUserRole(e.target.value)}>
            <option value="user">Usuário Padrão</option>
            <option value="admin">Administrador</option>
            <option value="manager">Gerente</option>
          </select>
        </div>
        <div style={st.campo}>
          <label style={st.label}>Permissões (para Usuário Padrão)</label>
          <div style={st.permissionsGrid}>
            {permissionsOptions.map(perm => (
              <div key={perm.id} style={st.permissionItem}>
                <input
                  type="checkbox"
                  id={`new-user-perm-${perm.id}`}
                  checked={newUserPermissions.includes(perm.id)}
                  onChange={() => onPermissionToggle(perm.id)}
                  disabled={newUserRole !== 'user'}
                />
                <label htmlFor={`new-user-perm-${perm.id}`}>{perm.name}</label>
              </div>
            ))}
          </div>
          {newUserRole !== 'user' && <p style={st.sub}>Administradores e Gerentes geralmente têm todas as permissões.</p>}
        </div>
        <button onClick={handleAddUser} style={st.btnPrimary}>Adicionar Usuário</button>
      </div>

      <h3 style={st.sectionHeader}>Usuários Existentes</h3>
      {(cfg.users || []).length === 0 && <p style={st.sub}>Nenhum usuário cadastrado ainda.</p>}
      {(cfg.users || []).map((user, index) => (
        <div key={user.id} style={st.itemCard}>
          <div style={st.campo}>
            <label style={st.label}>Nome</label>
            <input style={st.input} value={user.name} onChange={e => handleUpdateUser(index, 'name', e.target.value)} />
          </div>
          <div style={st.campo}>
            <label style={st.label}>E-mail</label>
            <input style={st.input} type="email" value={user.email} disabled />
          </div>
          <div style={st.campo}>
            <label style={st.label}>Função</label>
            <select style={st.input} value={user.role} onChange={e => handleUpdateUser(index, 'role', e.target.value)}>
              <option value="user">Usuário Padrão</option>
              <option value="admin">Administrador</option>
              <option value="manager">Gerente</option>
            </select>
          </div>
          <div style={st.campo}>
            <label style={st.label}>Permissões</label>
            <div style={st.permissionsGrid}>
              {permissionsOptions.map(perm => (
                <div key={perm.id} style={st.permissionItem}>
                  <input
                    type="checkbox"
                    id={`user-${user.id}-perm-${perm.id}`}
                    checked={(user.permissions || []).includes(perm.id)}
                    onChange={e => handlePermissionChange(user.id, perm.id, e.target.checked)}
                    disabled={user.role !== 'user'}
                  />
                  <label htmlFor={`user-${user.id}-perm-${perm.id}`}>{perm.name}</label>
                </div>
              ))}
            </div>
            {user.role !== 'user' && <p style={st.sub}>Administradores e Gerentes geralmente têm todas as permissões.</p>}
          </div>
          <button onClick={() => handleDeleteUser(index)} style={st.btnDanger}>Remover Usuário</button>
        </div>
      ))}
    </div>
  );
}

function TabDescontos({ cfg, handleSaveConfig }) {
  const [discAdPct, setDiscAdPct] = useState(cfg.discAdPct);
  const [discMenPct, setDiscMenPct] = useState(cfg.discMenPct);
  const [discClosePct, setDiscClosePct] = useState(cfg.discClosePct);
  const [discountMode, setDiscountMode] = useState(cfg.discountMode);

  useEffect(() => {
    setDiscAdPct(cfg.discAdPct);
    setDiscMenPct(cfg.discMenPct);
    setDiscClosePct(cfg.discClosePct);
    setDiscountMode(cfg.discountMode);
  }, [cfg]);

  const onSave = () => {
    handleSaveConfig({
      ...cfg,
      discAdPct: Number(discAdPct),
      discMenPct: Number(discMenPct),
      discClosePct: Number(discClosePct),
      discountMode: discountMode,
    });
  };

  return (
    <div style={st.card}>
      <h2 style={st.cardTitle}>🏷️ Regras de Desconto</h2>

      <h3 style={st.sectionHeader}>Descontos em Tela (para Propostas)</h3>
      <div style={st.itemCard}>
        <div style={st.campo}>
          <label style={st.label}>% Adesão (Tela)</label>
          <input
            style={st.input}
            type="number"
            value={discAdPct}
            onChange={e => setDiscAdPct(e.target.value)}
            min="0" max="100"
          />
          <p style={st.sub}>Percentual de desconto aplicado na adesão ao gerar propostas.</p>
        </div>
        <div style={st.campo}>
          <label style={st.label}>% Mensalidade (Tela)</label>
          <input
            style={st.input}
            type="number"
            value={discMenPct}
            onChange={e => setDiscMenPct(e.target.value)}
            min="0" max="100"
          />
          <p style={st.sub}>Percentual de desconto aplicado na mensalidade ao gerar propostas.</p>
        </div>
      </div>

      <h3 style={st.sectionHeader}>Desconto de Fechamento (para Vouchers)</h3>
      <div style={st.itemCard}>
        <div style={st.campo}>
          <label style={st.label}>% Adesão (Fechamento)</label>
          <input
            style={st.input}
            type="number"
            value={discClosePct}
            onChange={e => setDiscClosePct(e.target.value)}
            min="0" max="100"
          />
          <p style={st.sub}>Percentual de desconto extra aplicado na adesão para fechamento via voucher.</p>
        </div>
      </div>

      <h3 style={st.sectionHeader}>Modo de Desconto Padrão</h3>
      <div style={st.itemCard}>
        <div style={st.campo}>
          <label style={st.label}>Escolha como os descontos são aplicados por padrão:</label>
          <select style={st.input} value={discountMode} onChange={e => setDiscountMode(e.target.value)}>
            <option value="screen">Em Tela (Propostas)</option>
            <option value="voucher">Via Voucher (Fechamento)</option>
          </select>
          <p style={st.sub}>Define o modo padrão de aplicação de descontos para novas propostas.</p>
        </div>
      </div>

      <div style={st.btnGroup}>
        <button onClick={onSave} style={st.btnPrimary}>Salvar Regras de Desconto</button>
      </div>
    </div>
  );
}

function TabDocumentos({
  cfg, documentUploadFile, setDocumentUploadFile, documentUploadName,
  setDocumentUploadName, documentUploadType, setDocumentUploadType,
  handleDocumentUpload, handleDeleteDocument, saving
}) {
  return (
    <div style={st.card}>
      <h2 style={st.cardTitle}>📄 Documentos Importados</h2>

      <h3 style={st.sectionHeader}>Upload de Novo Documento</h3>
      <form onSubmit={handleDocumentUpload} style={st.itemCard}>
        <div style={st.campo}>
          <label style={st.label}>Nome do Documento</label>
          <input
            style={st.input}
            value={documentUploadName}
            onChange={e => setDocumentUploadName(e.target.value)}
            placeholder="Nome para identificar o documento"
            required
          />
        </div>
        <div style={st.campo}>
          <label style={st.label}>Tipo de Documento</label>
          <select
            style={st.input}
            value={documentUploadType}
            onChange={e => setDocumentUploadType(e.target.value)}
          >
            <option value="html">HTML</option>
            <option value="pdf">PDF</option>
          </select>
          <p style={st.sub}>Selecione o formato do arquivo que será enviado.</p>
        </div>
        <div style={st.campo}>
          <label style={st.label}>Arquivo (.html ou .pdf)</label>
          <input
            type="file"
            accept=".html,.pdf"
            onChange={e => setDocumentUploadFile(e.target.files[0])}
            style={st.fileInput}
            required
          />
          <p style={st.sub}>Envie um arquivo HTML ou PDF. Para edição online, HTML é recomendado.</p>
        </div>
        <button type="submit" style={st.btnPrimary} disabled={saving}>
          {saving ? '⏳ Enviando...' : '⬆️ Enviar Documento'}
        </button>
      </form>

      <h3 style={st.sectionHeader}>Documentos Existentes</h3>
      {(cfg.documents || []).length === 0 && <p style={st.sub}>Nenhum documento importado ainda.</p>}
      {(cfg.documents || []).map(doc => (
        <div key={doc.id} style={st.itemCard}>
          <p style={{ ...st.label, fontWeight: 600, color: 'var(--text)' }}>{doc.name}</p>
          <p style={st.sub}>Tipo: {doc.type.toUpperCase()} | Upload: {new Date(doc.uploaded_at).toLocaleDateString()}</p>
          <div style={{ display: 'flex', gap: 10, marginTop: 10 }}>
            <a href={doc.url} target="_blank" rel="noopener noreferrer" style={st.btnSecondary}>
              👁 Ver
            </a>
            <button onClick={() => handleDeleteDocument(doc.id, doc.file_path)} style={st.btnDanger}>
              🗑 Excluir
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

function TabKPIs({
  cfg, handleSaveConfig, kpiTemplates, newKpiName, setNewKpiName,
  newKpiTarget, setNewKpiTarget, newKpiUnit, setNewKpiUnit,
  handleAddKpiTemplate, handleDeleteKpiTemplate
}) {
  const [kpiDailyMandatory, setKpiDailyMandatory] = useState(cfg.kpiDailyMandatory);

  useEffect(() => {
    setKpiDailyMandatory(cfg.kpiDailyMandatory);
  }, [cfg.kpiDailyMandatory]);

  const onSaveMandatory = () => {
    handleSaveConfig({ ...cfg, kpiDailyMandatory: kpiDailyMandatory });
  };

  return (
    <div style={st.card}>
      <h2 style={st.cardTitle}>📊 Configurações de KPIs</h2>

      <h3 style={st.sectionHeader}>Obrigatoriedade de Preenchimento Diário</h3>
      <div style={st.itemCard}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 15 }}>
          <label style={{ ...st.label, marginBottom: 0, fontSize: 14, color: 'var(--text)' }}>
            Obrigar preenchimento diário de KPIs
          </label>
          <label className="switch">
            <input
              type="checkbox"
              checked={kpiDailyMandatory}
              onChange={(e) => setKpiDailyMandatory(e.target.checked)}
            />
            <span className="slider round"></span>
          </label>
        </div>
        <p style={st.sub}>
          Se ativado, os usuários serão bloqueados de outras funcionalidades até preencherem seus KPIs diários.
        </p>
        <div style={st.btnGroup}>
          <button onClick={onSaveMandatory} style={st.btnPrimary}>Salvar Obrigatoriedade</button>
        </div>
      </div>

      <h3 style={st.sectionHeader}>Modelos de KPI</h3>
      <div style={st.itemCard}>
        <div style={st.campo}>
          <label style={st.label}>Nome do KPI</label>
          <input style={st.input} value={newKpiName} onChange={e => setNewKpiName(e.target.value)} placeholder="Ex: Ligações Realizadas" />
        </div>
        <div style={st.campo}>
          <label style={st.label}>Meta Diária</label>
          <input style={st.input} type="number" value={newKpiTarget} onChange={e => setNewKpiTarget(e.target.value)} placeholder="Ex: 20" />
        </div>
        <div style={st.campo}>
          <label style={st.label}>Unidade</label>
          <input style={st.input} value={newKpiUnit} onChange={e => setNewKpiUnit(e.target.value)} placeholder="Ex: Ligações, Vendas, R$" />
        </div>
        <button onClick={handleAddKpiTemplate} style={st.btnPrimary}>Adicionar Modelo de KPI</button>
      </div>

      <h3 style={st.sectionHeader}>Modelos Existentes</h3>
      {kpiTemplates.length === 0 && <p style={st.sub}>Nenhum modelo de KPI cadastrado ainda.</p>}
      {kpiTemplates.map(kpi => (
        <div key={kpi.id} style={st.itemCard}>
          <p style={{ ...st.label, fontWeight: 600, color: 'var(--text)' }}>{kpi.name}</p>
          <p style={st.sub}>Meta: {kpi.target} {kpi.unit}</p>
          <button onClick={() => handleDeleteKpiTemplate(kpi.id)} style={st.btnDanger}>Remover</button>
        </div>
      ))}
    </div>
  );
}

function TabHistorico({ cfg }) {
  const [selectedDocHtml, setSelectedDocHtml] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const openDocModal = async (doc) => {
    if (doc.html) {
      setSelectedDocHtml(doc.html);
      setIsModalOpen(true);
    } else if (doc.signToken) {
      // Se não tem HTML direto, tenta buscar do vx_storage pelo token
      const { data: docRow } = await supabase
        .from('vx_storage')
        .select('value')
        .eq('key', `doc:${doc.signToken}`)
        .single();

      if (docRow?.value) {
        const docData = JSON.parse(docRow.value);
        setSelectedDocHtml(docData.html);
        setIsModalOpen(true);
      } else {
        alert('Conteúdo do documento não encontrado.');
      }
    }
  };

  const closeDocModal = () => {
    setIsModalOpen(false);
    setSelectedDocHtml(null);
  };

  return (
    <div style={st.card}>
      <h2 style={st.cardTitle}>🗂️ Histórico de Documentos</h2>

      {(cfg.docHistory || []).length === 0 && <p style={st.sub}>Nenhum documento gerado ou assinado ainda.</p>}
      {(cfg.docHistory || []).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).map(doc => (
        <div key={doc.signToken} style={st.itemCard}>
          <p style={{ ...st.label, fontWeight: 600, color: 'var(--text)' }}>
            {doc.clientName} - {doc.type === 'proposta' ? 'Proposta' : 'Contrato'}
          </p>
          <p style={st.sub}>Gerado em: {new Date(doc.createdAt).toLocaleDateString()} por {doc.consultorName}</p>
          {doc.signedAt && (
            <p style={st.sub}>Assinado por: {doc.signedBy} em {doc.signedAt} ({doc.status})</p>
          )}
          {!doc.signedAt && (
            <p style={st.sub}>Status: Pendente de Assinatura</p>
          )}
          <div style={{ display: 'flex', gap: 10, marginTop: 10 }}>
            <button onClick={() => openDocModal(doc)} style={st.btnSecondary}>
              👁 Ver Documento
            </button>
            <a href={`/sign/${doc.signToken}`} target="_blank" rel="noopener noreferrer" style={st.btnSecondary}>
              🔗 Link Assinatura
            </a>
          </div>
        </div>
      ))}

      {isModalOpen && (
        <div style={st.modalOverlay}>
          <div style={st.modalBox}>
            <div style={st.modalHeader}>
              <h3>Visualizar Documento</h3>
              <button onClick={closeDocModal} style={st.modalClose}>✕</button>
            </div>
            <div style={st.modalBody}>
              <div dangerouslySetInnerHTML={{ __html: selectedDocHtml }} />
            </div>
            <div style={st.modalFooter}>
              <button onClick={closeDocModal} style={st.btnCancel}>Fechar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── ESTILOS GLOBAIS (PARA SEREM ADICIONADOS EM globals.css) ──
// Estes estilos são para o layout geral da página de configurações e para os componentes internos.
// O switch toggle já está no globals.css que te passei antes.

const st = {
  container: {
    maxWidth: 960,
    margin: '40px auto',
    padding: '0 20px',
  },
  pageTitle: {
    fontFamily: 'Syne, sans-serif',
    fontSize: 28,
    fontWeight: 700,
    color: 'var(--text)',
    marginBottom: 30,
    textAlign: 'center',
  },
  tabs: {
    display: 'flex',
    gap: 10,
    marginBottom: 20,
    overflowX: 'auto',
    paddingBottom: 5,
    borderBottom: '1px solid var(--border)',
  },
  tabContent: {
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    borderRadius: 16,
    padding: 24,
    boxShadow: 'var(--shadow)',
  },
  card: {
    // Reutiliza o estilo do tabContent para consistência
  },
  cardTitle: {
    fontFamily: 'Syne, sans-serif',
    fontSize: 20,
    fontWeight: 700,
    color: 'var(--accent)',
    marginBottom: 20,
    borderBottom: '1px solid var(--border)',
    paddingBottom: 10,
  },
  sectionHeader: {
    fontFamily: 'Syne, sans-serif',
    fontSize: 16,
    fontWeight: 700,
    color: 'var(--text)',
    marginTop: 30,
    marginBottom: 15,
    paddingBottom: 5,
    borderBottom: '1px dashed var(--border)',
  },
  itemCard: {
    background: 'var(--surface2)',
    border: '1px solid var(--border)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 15,
  },
  campo: {
    marginBottom: 15,
  },
  label: {
    fontSize: 12,
    color: 'var(--muted)',
    display: 'block',
    marginBottom: 6,
    letterSpacing: '.5px',
    textTransform: 'uppercase',
  },
  input: {
    width: '100%',
    background: 'var(--bg)',
    border: '1px solid var(--border)',
    borderRadius: 8,
    padding: '10px 14px',
    fontSize: 14,
    color: 'var(--text)',
    outline: 'none',
    transition: 'border-color .2s',
  },
  fileInput: {
    width: '100%',
    background: 'var(--bg)',
    border: '1px solid var(--border)',
    borderRadius: 8,
    padding: '10px 14px',
    fontSize: 14,
    color: 'var(--text)',
    outline: 'none',
    transition: 'border-color .2s',
    cursor: 'pointer',
  },
  sub: {
    fontSize: 12,
    color: 'var(--muted)',
    lineHeight: 1.6,
    marginTop: 5,
  },
  btnGroup: {
    marginTop: 20,
    display: 'flex',
    justifyContent: 'flex-end',
    gap: 10,
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
  btnSecondary: {
    padding: '8px 16px',
    borderRadius: 8,
    background: 'rgba(100,116,139,.12)',
    border: '1px solid var(--border)',
    color: 'var(--muted)',
    fontFamily: 'DM Mono, monospace',
    fontSize: 12,
    cursor: 'pointer',
    transition: 'all .2s',
    textDecoration: 'none', // Para links
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnDanger: {
    padding: '8px 16px',
    borderRadius: 8,
    background: 'rgba(239,68,68,.1)',
    border: '1px solid rgba(239,68,68,.3)',
    color: 'var(--danger)',
    fontFamily: 'DM Mono, monospace',
    fontSize: 12,
    cursor: 'pointer',
    transition: 'all .2s',
  },
  successAlert: {
    padding: '12px 16px',
    background: 'rgba(16,185,129,.1)',
    border: '1px solid rgba(16,185,129,.3)',
    borderRadius: 8,
    fontSize: 14,
    color: 'var(--accent3)',
    marginBottom: 20,
  },
  errorAlert: {
    padding: '12px 16px',
    background: 'rgba(239,68,68,.1)',
    border: '1px solid rgba(239,68,68,.3)',
    borderRadius: 8,
    fontSize: 14,
    color: 'var(--danger)',
    marginBottom: 20,
  },
  loadingBox: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 300,
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    borderRadius: 16,
    padding: 24,
    boxShadow: 'var(--shadow)',
    marginTop: 40,
  },
  errorBox: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 300,
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    borderRadius: 16,
    padding: 24,
    boxShadow: 'var(--shadow)',
    marginTop: 40,
  },
  spinner: {
    width: 40,
    height: 40,
    border: '3px solid var(--border)',
    borderTop: '3px solid var(--accent)',
    borderRadius: '50%',
    animation: 'spin 1s linear infinite',
  },
  permissionsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
    gap: 10,
    marginTop: 10,
  },
  permissionItem: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    fontSize: 13,
    color: 'var(--text)',
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
    maxWidth: 720, // Aumentado para melhor visualização de documentos
    boxShadow: 'var(--shadow)',
    display: 'flex',
    flexDirection: 'column',
    maxHeight: '90vh',
    position: 'relative',
  },
  modalHeader: {
    padding: '20px 24px 0',
    flexShrink: 0,
  },
  modalHeaderH3: {
    fontFamily: 'Syne, sans-serif',
    fontSize: 16,
    fontWeight: 700,
    color: 'var(--accent)',
  },
  modalClose: {
    position: 'absolute',
    top: 16,
    right: 20,
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
    background: '#fff', // Fundo branco para o conteúdo do documento
    color: '#333', // Texto escuro para o conteúdo do documento
    borderRadius: 8,
    margin: '0 24px 20px',
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
};

// Estilos para as abas (diretamente no componente para evitar conflitos)
const tabStyles = `
  .tabs button {
    padding: 10px 18px;
    border-radius: 8px;
    background: transparent;
    border: none;
    color: var(--muted);
    font-family: 'DM Mono', monospace;
    font-size: 14px;
    cursor: pointer;
    transition: all .2s;
    white-space: nowrap;
  }
  .tabs button:hover {
    color: var(--text);
    background: rgba(100,116,139,.08);
  }
  .tabs button.active {
    color: var(--accent);
    background: rgba(0,212,255,.15);
    font-weight: 600;
  }
  @keyframes spin {
    to { transform: rotate(360deg); }
  }
`;

// Adiciona os estilos das abas ao head do documento
// Isso é uma alternativa para evitar adicionar no globals.css se você preferir
// Manter os estilos específicos do componente mais isolados.
// Se você já tem um globals.css, pode mover estes estilos para lá.
useEffect(() => {
  const styleElement = document.createElement('style');
  styleElement.innerHTML = tabStyles;
  document.head.appendChild(styleElement);
  return () => {
    document.head.removeChild(styleElement);
  };
}, []);
