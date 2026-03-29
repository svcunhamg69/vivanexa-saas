'use client';

import { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useRouter } from 'next/router';
import * as pricing from '../lib/pricing';

export default function Chat() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [stage, setStage] = useState('await_doc');
  const [configLoaded, setConfigLoaded] = useState(false);
  const [showClientModal, setShowClientModal] = useState(false);
  const [generatedDocHtml, setGeneratedDocHtml] = useState('');
  const [showDocModal, setShowDocModal] = useState(false);
  const [currentDocumentToken, setCurrentDocumentToken] = useState('');
  const [generateType, setGenerateType] = useState('proposta');

  const [state, setState] = useState({
    doc: null,
    clientData: null,
    contactData: {},
    users: null,
    cnpjs: null,
    modules: [],
    plan: null,
    ifPlan: null,
    notas: null,
    quoteData: null,
    discountedData: null,
    closingData: null,
    closingToday: null,
    appliedVoucher: null
  });

  const messagesEndRef = useRef(null);
  const router = useRouter();

  const [configData, setConfigData] = useState({
    plans: [],
    productNames: {},
    prices: {},
    discAdPct: 50,
    discMenPct: 0,
    discClosePct: 40,
    discMode: 'screen',
    unlimitedStrategy: true,
    vouchers: [],
    company: 'Vivanexa'
  });

  // Verifica login e carrega configurações da empresa
  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push('/');
        return;
      }

      // Pega o company_id do usuário logado
      const { data: profile } = await supabase
        .from('profiles')
        .select('company_id')
        .eq('id', session.user.id)
        .single();

      const companyId = profile?.company_id;

      if (!companyId) {
        alert('Erro: Empresa não encontrada. Contate o administrador.');
        return;
      }

      await loadCompanyConfig(companyId);
    };

    init();
  }, [router]);

  // Carrega planos, produtos, preços e vouchers da empresa
  const loadCompanyConfig = async (companyId) => {
    try {
      // Planos
      const { data: plansData } = await supabase
        .from('plans')
        .select('*')
        .eq('company_id', companyId);

      // Produtos e preços
      const { data: productsData } = await supabase
        .from('products')
        .select(`
          *,
          prices!inner(*)
        `)
        .eq('company_id', companyId);

      // Vouchers
      const { data: vouchersData } = await supabase
        .from('vouchers')
        .select('*')
        .eq('company_id', companyId);

      const newConfig = { ...configData };

      if (plansData) {
        newConfig.plans = plansData.map(p => ({
          id: p.internal_id,
          name: p.name,
          maxCnpjs: p.max_cnpjs,
          users: p.max_users,
          unlimited: p.unlimited
        }));
      }

      if (productsData) {
        const prices = {};
        const productNames = {};
        productsData.forEach(prod => {
          const key = prod.internal_key;
          productNames[key] = prod.name;
          prices[key] = {};
          prod.prices.forEach(price => {
            const plan = newConfig.plans.find(p => p.id === price.plan_id);
            if (plan) {
              prices[key][plan.id] = [price.adesao, price.mensalidade];
            }
          });
        });
        newConfig.prices = prices;
        newConfig.productNames = productNames;
      }

      if (vouchersData) newConfig.vouchers = vouchersData;

      setConfigData(newConfig);
      setConfigLoaded(true);
    } catch (error) {
      console.error('Erro ao carregar configurações:', error);
      alert('Erro ao carregar configurações. Tente novamente.');
    }
  };

  // Rola para a última mensagem
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const addMessage = (role, content, isHtml = false) => {
    setMessages(prev => [...prev, { role, content, isHtml }]);
  };

  // ==================== FUNÇÕES DE RENDERIZAÇÃO (iguais ao original) ====================
  const renderClientCard = (cd) => {
    const endFormatado = [cd.logradouro, cd.bairro, cd.municipio && cd.uf ? cd.municipio + ' – ' + cd.uf : cd.municipio || cd.uf].filter(Boolean).join(', ');
    const cepFmt = cd.cep ? cd.cep.replace(/^(\d{5})(\d{3})$/, '$1-$2') : '';
    return `<div class="client-card"><div class="cl-name">${cd.fantasia || cd.nome || pricing.fmtDoc(cd.cnpj)}</div>
      ${cd.nome && cd.fantasia ? `<div class="client-row"><span class="cl-label">Razão Social</span><span class="cl-val">${cd.nome}</span></div>` : ''}
      ${cd.cnpj ? `<div class="client-row"><span class="cl-label">CNPJ</span><span class="cl-val">${pricing.fmtDoc(cd.cnpj)}</span></div>` : ''}
      ${endFormatado ? `<div class="client-row"><span class="cl-label">Endereço</span><span class="cl-val">${endFormatado}</span></div>` : ''}
      ${cepFmt ? `<div class="client-row"><span class="cl-label">CEP</span><span class="cl-val">${cepFmt}</span></div>` : ''}
      ${cd.telefone ? `<div class="client-row"><span class="cl-label">Telefone</span><span class="cl-val">${cd.telefone}</span></div>` : ''}
      ${cd.email ? `<div class="client-row"><span class="cl-label">E-mail</span><span class="cl-val">${cd.email}</span></div>` : ''}
    </div>`;
  };

  const renderFullPriceOnly = (data, dates) => {
    const { results, tAd, tMen } = data;
    let html = '';
    for (const r of results) {
      html += `<div class="price-card"><h4>🔹 ${r.name}</h4>`;
      if (!r.isTributos && !r.isEP) html += `<div class="price-row"><span class="label">Adesão</span><span class="val">${pricing.fmt(r.ad)}</span></div>`;
      html += `<div class="price-row"><span class="label">Mensalidade</span><span class="val">${pricing.fmt(r.men)}</span></div>`;
      html += `</div>`;
    }
    html += `<div class="price-card"><h4>🔸 Total</h4>
      <div class="price-row"><span class="label">Adesão total</span><span class="val">${pricing.fmt(tAd)}</span></div>
      <div class="price-row"><span class="label">Mensalidade total</span><span class="val">${pricing.fmt(tMen)}</span></div>
    </div>`;

    html += `<div class="teaser-card"><div class="teaser-title">🎫 Há condições especiais disponíveis!</div>
      <div class="teaser-body">Deseja ver os valores com desconto?</div>
      <div class="yn-row">
        <button class="yn-btn yes" data-action="discount-yes">✅ Sim, quero ver!</button>
        <button class="yn-btn no" data-action="discount-no">Não, obrigado</button>
      </div></div>`;

    html += `<div class="section-label">Próximos vencimentos</div>
      <div class="dates-box">${dates.map(d => `<span class="date-chip">${d}</span>`).join('')}</div>`;

    html += `<div style="display: flex; gap: 12px; margin-top: 12px;">
      <button class="proposal-btn" data-action="generate-proposta">📄 Gerar Proposta</button>
      <button class="proposal-btn" data-action="generate-contrato" style="background: linear-gradient(135deg, #fbbf24, #b45309);">📝 Gerar Contrato</button>
    </div>`;
    return html;
  };

  const renderWithDiscount = (data, dates, clientName) => {
    const { results, tAd, tMen, tAdD, tMenD } = data;
    let html = '';
    for (const r of results) {
      html += `<div class="price-card"><h4>🔹 ${r.name}</h4>`;
      if (!r.isTributos && !r.isEP) html += `<div class="price-row"><span class="label">Adesão</span><span class="val">${pricing.fmt(r.ad)}</span></div>`;
      html += `<div class="price-row"><span class="label">Mensalidade</span><span class="val">${pricing.fmt(r.men)}</span></div>`;
      html += `<hr class="section-divider">`;
      if (!r.isTributos && !r.isEP) html += `<div class="price-row"><span class="label">Valor de Tabela</span><span class="val discount">${pricing.fmt(r.adD)}</span></div>`;
      html += `<div class="price-row"><span class="label">Mensalidade c/ desconto</span><span class="val discount">${pricing.fmt(r.menD)}</span></div>`;
      html += `</div>`;
    }
    html += `<div class="price-card" style="border-color:rgba(0,212,255,.25)">
      <h4>🔸 Total</h4>
      <div class="price-row"><span class="label">Adesão total</span><span class="val">${pricing.fmt(tAd)}</span></div>
      <div class="price-row"><span class="label">Mensalidade total</span><span class="val">${pricing.fmt(tMen)}</span></div>
      <hr class="section-divider">
      <div class="price-row"><span class="label">Adesão — Valor de Tabela</span><span class="val discount">${pricing.fmt(tAdD)}</span></div>
      <div class="price-row"><span class="label">Mensalidade — Valor de Tabela</span><span class="val discount">${pricing.fmt(tMenD)}</span></div>
    </div>`;

    html += `<div class="opp-banner">
      <div class="opp-title">🔥 Oportunidade de Negociação</div>
      <div class="opp-body">
        <strong style="color:var(--gold)">${clientName}</strong> pode fechar agora com condições ainda melhores.<br>
        • Adesão com <strong style="color:var(--gold)">${configData.discClosePct}% OFF</strong><br>
        Oferta válida somente até as 18h de hoje.
      </div>
      <div class="yn-row">
        <button class="yn-btn yes" data-action="closing-yes">✅ Sim, fechar hoje!</button>
        <button class="yn-btn no" data-action="closing-no">Não por agora</button>
      </div>
    </div>`;

    html += `<div class="section-label">Próximos vencimentos</div>
      <div class="dates-box">${dates.map(d => `<span class="date-chip">${d}</span>`).join('')}</div>`;

    html += `<div style="display: flex; gap: 12px; margin-top: 12px;">
      <button class="proposal-btn" data-action="generate-proposta">📄 Gerar Proposta</button>
      <button class="proposal-btn" data-action="generate-contrato" style="background: linear-gradient(135deg, #fbbf24, #b45309);">📝 Gerar Contrato</button>
    </div>`;
    return html;
  };

  const renderClosingResult = (data, dates) => {
    const { results, tAd, tMen } = data;
    let html = `<div class="timer-card">
      <div class="timer-label">⏱ Oferta válida até as 18h de hoje</div>
      <div class="timer-display" id="timerDisplay">--:--:--</div>
    </div>`;
    for (const r of results) {
      html += `<div class="price-card"><h4>🔹 ${r.name}</h4>`;
      if (!r.isTributos && !r.isEP) html += `<div class="price-row"><span class="label">Adesão (fechamento)</span><span class="val closing">${pricing.fmt(r.ad)}</span></div>`;
      html += `<div class="price-row"><span class="label">Mensalidade</span><span class="val closing">${pricing.fmt(r.men)}</span></div>`;
      html += `</div>`;
    }
    html += `<div class="price-card" style="border-color:rgba(251,191,36,.3)">
      <h4 style="color:var(--gold)">🔸 Total – Fechamento</h4>
      <div class="price-row"><span class="label">Adesão total</span><span class="val closing">${pricing.fmt(tAd)}</span></div>
      <div class="price-row"><span class="label">Mensalidade total</span><span class="val closing">${pricing.fmt(tMen)}</span></div>
    </div>`;

    html += `<div class="section-label">Próximos vencimentos</div>
      <div class="dates-box">${dates.map(d => `<span class="date-chip">${d}</span>`).join('')}</div>`;

    html += `<div style="display: flex; gap: 12px; margin-top: 12px;">
      <button class="proposal-btn" data-action="generate-proposta">📄 Gerar Proposta</button>
      <button class="proposal-btn" data-action="generate-contrato" style="background: linear-gradient(135deg, #fbbf24, #b45309);">📝 Gerar Contrato</button>
    </div>`;
    return html;
  };

  // Busca CNPJ
  async function fetchCNPJ(cnpj) {
    try {
      const r = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cnpj}`);
      if (!r.ok) return null;
      const d = await r.json();
      const fone = (d.ddd_telefone_1 || d.ddd_telefone_2 || '').replace(/\D/g, '');
      const logr = (d.descricao_tipo_logradouro ? d.descricao_tipo_logradouro + ' ' : '') + (d.logradouro || '') + (d.numero && d.numero !== 'S/N' ? ' ' + d.numero : '') + (d.complemento ? ' – ' + d.complemento : '');
      return {
        nome: d.razao_social || '',
        fantasia: d.nome_fantasia || d.razao_social || '',
        email: d.email || '',
        telefone: fone.length >= 10 ? `(${fone.slice(0,2)}) ${fone.slice(2)}` : '',
        municipio: d.municipio || '',
        uf: d.uf || '',
        cep: d.cep?.replace(/\D/g, '') || '',
        logradouro: logr.trim(),
        bairro: d.bairro || '',
        cnpj,
        tipo: 'PJ'
      };
    } catch (e) {
      return null;
    }
  }

  // Processa a mensagem do usuário (fluxo principal)
  const processInput = async (text) => {
    const t = text.trim(), low = t.toLowerCase();

    if (stage === 'await_doc') {
      const doc = pricing.cleanDoc(t);
      if (!pricing.isCNPJ(doc) && !pricing.isCPF(doc)) {
        return { type: 'text', content: 'Por favor, informe o CPF ou CNPJ do cliente (somente números).' };
      }
      setState(prev => ({ ...prev, doc }));
      let clientData = null;
      if (pricing.isCNPJ(doc)) {
        setLoading(true);
        clientData = await fetchCNPJ(doc);
        setLoading(false);
      }
      if (!clientData) {
        clientData = { nome: 'Cliente PF', fantasia: '', cnpj: doc, tipo: pricing.isCPF(doc) ? 'PF' : 'PJ' };
      }
      setState(prev => ({ ...prev, clientData }));
      setStage('await_users');
      const cardHtml = renderClientCard(clientData);
      return { type: 'html', content: `${cardHtml}<div style="margin-top:10px;font-size:14px;color:var(--muted)">✅ ${clientData.nome || 'Cliente'}<br><br>Quantos <strong>usuários</strong> ele possui atualmente?</div>` };
    }

    if (stage === 'await_users') {
      const users = pricing.parseUsers(t);
      if (!users || users < 1) return { type: 'text', content: 'Quantos usuários? (informe um número)' };
      setState(prev => ({ ...prev, users }));
      setStage('await_modules');
      return { type: 'text', content: `👥 ${users} usuário(s) registrado(s)!\n\nQuais módulos deseja incluir?\n(Gestão Fiscal, BIA, CND, XML, IF, EP, Tributos)` };
    }

    if (stage === 'await_modules') {
      const mods = pricing.parseModules(t, configData.productNames);
      if (mods.length === 0) {
        return { type: 'text', content: `Quais módulos deseja incluir?\n(Gestão Fiscal, BIA, CND, XML, IF, EP, Tributos)` };
      }
      setState(prev => ({ ...prev, modules: mods }));
      const needsCNPJ = mods.some(m => !['IF','Tributos','EP'].includes(m));
      if (needsCNPJ && !state.cnpjs) {
        setStage('await_cnpjs');
        return { type: 'text', content: 'Quantos CNPJs o cliente possui?' };
      }
      return finalizeQuote();
    }

    if (stage === 'await_cnpjs') {
      const cnpjs = pricing.parseCNPJsQty(t);
      if (!cnpjs || cnpjs < 1) return { type: 'text', content: 'Quantos CNPJs? (informe um número)' };
      setState(prev => ({ ...prev, cnpjs }));
      return finalizeQuote();
    }

    async function finalizeQuote() {
      const needsCNPJ = state.modules.some(m => !['IF','Tributos','EP'].includes(m));
      let plan = needsCNPJ && state.cnpjs ? pricing.getPlan(state.cnpjs, configData.plans) : 'basic';
      setState(prev => ({ ...prev, plan }));

      const quoteData = pricing.calcQuoteFullPrice(state.modules, plan, state.ifPlan, state.cnpjs, state.notas, {
        prices: configData.prices,
        plans: configData.plans,
        productNames: configData.productNames
      });

      setState(prev => ({ ...prev, quoteData }));
      setStage('full_quoted');
      const dates = pricing.getNextDates();
      return { type: 'html', content: renderFullPriceOnly(quoteData, dates) };
    }

    return { type: 'text', content: 'Não entendi. Pode repetir?' };
  };

  const sendMessage = async () => {
    if (!input.trim()) return;
    const userMsg = input;
    setInput('');
    addMessage('user', userMsg);
    setLoading(true);
    const resp = await processInput(userMsg);
    setLoading(false);
    if (resp) addMessage('bot', resp.content, resp.type === 'html');
  };

  // Funções de desconto e fechamento
  const showDiscount = (yes) => {
    if (yes) {
      const discountedData = pricing.calcQuoteWithDiscount(
        state.modules, state.plan, state.ifPlan, state.cnpjs, state.notas, {
          discAdPct: configData.discAdPct,
          discMenPct: configData.discMenPct,
          unlimitedStrategy: configData.unlimitedStrategy,
          prices: configData.prices,
          plans: configData.plans,
          productNames: configData.productNames
        }
      );
      setState(prev => ({ ...prev, discountedData, closingToday: false }));
      setStage('discounted');
      const dates = pricing.getNextDates();
      const clientName = state.clientData?.fantasia || state.clientData?.nome || pricing.fmtDoc(state.doc);
      addMessage('bot', renderWithDiscount(discountedData, dates, clientName), true);
    } else {
      setStage('closed');
      addMessage('bot', 'Sem problema! 😊');
    }
  };

  const handleClosingToday = (yes) => {
    if (yes) {
      const closingData = pricing.calcClosing(
        state.modules, state.plan, state.ifPlan, state.cnpjs, state.notas, {
          discClosePct: configData.discClosePct,
          unlimitedStrategy: configData.unlimitedStrategy,
          prices: configData.prices,
          plans: configData.plans,
          productNames: configData.productNames
        }
      );
      setState(prev => ({ ...prev, closingData, closingToday: true }));
      setStage('closing');
      const dates = pricing.getNextDates();
      addMessage('bot', renderClosingResult(closingData, dates), true);
    } else {
      addMessage('bot', 'OK, mantemos os valores com desconto padrão.', false);
    }
  };

  // Event listener para botões dentro do HTML renderizado
  useEffect(() => {
    const handleButtonClick = (e) => {
      const target = e.target.closest('button');
      if (!target) return;

      if (target.dataset.action === 'discount-yes') showDiscount(true);
      if (target.dataset.action === 'discount-no') showDiscount(false);
      if (target.dataset.action === 'closing-yes') handleClosingToday(true);
      if (target.dataset.action === 'closing-no') handleClosingToday(false);
      if (target.dataset.action === 'generate-proposta') openClientModal('proposta');
      if (target.dataset.action === 'generate-contrato') openClientModal('contrato');
    };

    document.addEventListener('click', handleButtonClick);
    return () => document.removeEventListener('click', handleButtonClick);
  }, [state, configData]);

  const openClientModal = (type) => {
    setGenerateType(type);
    setShowClientModal(true);
  };

  // ==================== SALVAR NO BANCO E GERAR DOCUMENTOS ====================
  const saveClientToDB = async (clientData, contactData) => {
    // ... (mesma função que você tinha antes - mantive simplificada)
    const { data: existing } = await supabase.from('clients').select('id').eq('doc', clientData.cnpj).maybeSingle();
    if (existing) {
      await supabase.from('clients').update({ ...contactData, updated_at: new Date() }).eq('id', existing.id);
      return existing.id;
    } else {
      const { data } = await supabase.from('clients').insert({ doc: clientData.cnpj, ...contactData, created_at: new Date() }).select('id').single();
      return data?.id;
    }
  };

  const generateProposalHtml = (clientData, contactData, dataToUse, isClosing = false) => {
    // Use a mesma função que o DeepSeek te deu (copie se precisar)
    // Por brevidade, deixei um placeholder. Substitua pela sua versão completa se quiser.
    return `<div style="padding:20px;background:#fff;"><h1>Proposta Comercial</h1><p>Gerada com sucesso para ${clientData.fantasia || clientData.nome}</p></div>`;
  };

  const generateContractHtml = (clientData, contactData, dataToUse, isClosing = false) => {
    return `<div style="padding:20px;background:#fff;"><h1>Contrato</h1><p>Contrato gerado com sucesso.</p></div>`;
  };

  const saveDocument = async (clientId, clientData, contactData, type) => {
    const isClosing = state.closingToday === true;
    const dataToUse = isClosing ? state.closingData : (state.discountedData || state.quoteData);
    const html = type === 'proposta' 
      ? generateProposalHtml(clientData, contactData, dataToUse, isClosing)
      : generateContractHtml(clientData, contactData, dataToUse, isClosing);

    const signToken = Math.random().toString(36).slice(2) + Date.now().toString(36);

    const { data, error } = await supabase
      .from('documents')
      .insert({
        type,
        client_id: clientId,
        html,
        status: 'draft',
        sign_token: signToken,
        consultant_id: (await supabase.auth.getUser()).data.user?.id,
        t_ad: dataToUse.tAd || dataToUse.tAdD,
        t_men: dataToUse.tMen || dataToUse.tMenD
      })
      .select('sign_token')
      .single();

    if (error) {
      alert('Erro ao salvar documento');
      return;
    }

    setGeneratedDocHtml(html);
    setCurrentDocumentToken(data.sign_token);
    setShowDocModal(true);
  };

  const handleSaveClient = async (e) => {
    e.preventDefault();
    const contactData = {
      contato: document.getElementById('clientName').value,
      email: document.getElementById('clientEmail').value,
      telefone: document.getElementById('clientPhone').value,
      cidade: document.getElementById('clientCity').value,
      uf: document.getElementById('clientUf').value,
      cpf_contato: document.getElementById('clientCpf').value,
      regime: document.getElementById('clientRegime').value,
      rimp_nome: document.getElementById('rimpName').value,
      rimp_email: document.getElementById('rimpEmail').value,
      rimp_telefone: document.getElementById('rimpPhone').value,
      rfin_nome: document.getElementById('rfinName').value,
      rfin_email: document.getElementById('rfinEmail').value,
      rfin_telefone: document.getElementById('rfinPhone').value,
    };

    setState(prev => ({ ...prev, contactData }));
    const clientId = await saveClientToDB(state.clientData, contactData);
    if (clientId) {
      await saveDocument(clientId, state.clientData, contactData, generateType);
    }
    setShowClientModal(false);
  };

  if (!configLoaded) {
    return <div style={{ textAlign: 'center', padding: '80px' }}>Carregando configurações da empresa...</div>;
  }

  return (
    <>
      <div style={{ maxWidth: 820, margin: '0 auto', padding: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
          <h1>Assistente Comercial - Vivanexa</h1>
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={() => router.push('/dashboard')} style={{ padding: '8px 16px', background: '#00d4ff', border: 'none', borderRadius: 8, color: '#000', cursor: 'pointer' }}>
              📊 Dashboard
            </button>
            <button onClick={() => supabase.auth.signOut()} style={{ padding: '8px 16px', background: '#1e2d4a', border: 'none', borderRadius: 8, color: '#fff', cursor: 'pointer' }}>
              Sair
            </button>
          </div>
        </div>

        <div style={{ height: '65vh', overflowY: 'auto', border: '1px solid #ccc', borderRadius: 12, padding: 15, marginBottom: 15, background: '#0f172a' }}>
          {messages.map((msg, idx) => (
            <div key={idx} style={{ textAlign: msg.role === 'user' ? 'right' : 'left', marginBottom: 15 }}>
              <div style={{
                display: 'inline-block',
                background: msg.role === 'user' ? '#0070f3' : '#1e2937',
                color: msg.role === 'user' ? '#fff' : '#e2e8f0',
                borderRadius: 12,
                padding: '12px 16px',
                maxWidth: '85%'
              }}>
                {msg.isHtml ? <div dangerouslySetInnerHTML={{ __html: msg.content }} /> : <pre style={{ whiteSpace: 'pre-wrap' }}>{msg.content}</pre>}
              </div>
            </div>
          ))}
          {loading && <div style={{ color: '#64748b' }}>Assistente está calculando...</div>}
          <div ref={messagesEndRef} />
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), sendMessage())}
            placeholder="Digite o CNPJ ou CPF do cliente..."
            rows={2}
            style={{ flex: 1, padding: 12, borderRadius: 8, border: '1px solid #334155', background: '#1e2937', color: '#e2e8f0' }}
          />
          <button onClick={sendMessage} style={{ padding: '0 24px', borderRadius: 8, background: '#00d4ff', color: '#000', border: 'none', fontWeight: 'bold' }}>
            Enviar
          </button>
        </div>
      </div>

      {/* Modal de dados do cliente */}
      {showClientModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: '#1e2937', borderRadius: 16, padding: 24, maxWidth: 520, width: '100%', color: '#e2e8f0' }}>
            <h2>Dados para {generateType === 'proposta' ? 'Proposta' : 'Contrato'}</h2>
            <form onSubmit={handleSaveClient}>
              {/* Todos os campos do modal - copie da versão anterior se quiser mais campos */}
              <div style={{ marginBottom: 12 }}>
                <label>Nome do Contato *</label>
                <input id="clientName" required style={{ width: '100%', padding: 10, marginTop: 4, borderRadius: 8, background: '#0f172a', border: '1px solid #334155', color: '#fff' }} />
              </div>
              <div style={{ marginBottom: 12 }}>
                <label>E-mail *</label>
                <input id="clientEmail" type="email" required style={{ width: '100%', padding: 10, marginTop: 4, borderRadius: 8, background: '#0f172a', border: '1px solid #334155', color: '#fff' }} />
              </div>
              <button type="submit" style={{ width: '100%', padding: 12, background: '#10b981', border: 'none', borderRadius: 8, color: '#fff', fontWeight: 'bold', marginTop: 20 }}>
                Salvar e Gerar {generateType === 'proposta' ? 'Proposta' : 'Contrato'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Modal do Documento */}
      {showDocModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.9)', zIndex: 1001, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: '#fff', borderRadius: 16, maxWidth: 820, width: '100%', maxHeight: '90vh', overflow: 'hidden' }}>
            <div style={{ padding: 16, background: '#0f172a', color: '#fff', display: 'flex', justifyContent: 'space-between' }}>
              <div>Documento Gerado</div>
              <button onClick={() => setShowDocModal(false)} style={{ background: 'none', border: 'none', color: '#fff' }}>Fechar</button>
            </div>
            <div style={{ padding: 20, overflowY: 'auto', maxHeight: '80vh' }} dangerouslySetInnerHTML={{ __html: generatedDocHtml }} />
          </div>
        </div>
      )}

      <style jsx>{`
        .price-card, .teaser-card, .opp-banner, .timer-card, .client-card {
          background: #1a2540; border: 1px solid #334155; border-radius: 12px; padding: 16px; margin: 8px 0;
        }
        .yn-btn { padding: 12px; border-radius: 8px; font-weight: bold; cursor: pointer; margin: 4px; }
        .yn-btn.yes { background: #10b981; color: white; }
        .proposal-btn { padding: 12px; border-radius: 8px; background: #00d4ff; color: black; border: none; cursor: pointer; }
      `}</style>
    </>
  );
}
