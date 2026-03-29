import { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useRouter } from 'next/router';
import * as pricing from '../lib/pricing';

// Configuração inicial – será preenchida do banco
let configData = {
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
};

export default function Chat() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [stage, setStage] = useState('await_doc');
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
  const [configLoaded, setConfigLoaded] = useState(false);
  const [showClientModal, setShowClientModal] = useState(false);
  const [generatedDocHtml, setGeneratedDocHtml] = useState('');
  const [showDocModal, setShowDocModal] = useState(false);
  const [currentDocumentToken, setCurrentDocumentToken] = useState('');
  const [generateType, setGenerateType] = useState('proposta');
  const messagesEndRef = useRef(null);
  const router = useRouter();

  // Verifica se o usuário está logado
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) router.push('/');
    });
  }, []);

  // Rola para a última mensagem
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Carrega planos, produtos, preços e vouchers do Supabase
  useEffect(() => {
    async function loadConfig() {
      // 1. Planos
      const { data: plansData, error: plansError } = await supabase
        .from('plans')
        .select('*');
      if (!plansError && plansData) {
        configData.plans = plansData.map(p => ({
          id: p.internal_id,
          name: p.name,
          maxCnpjs: p.max_cnpjs,
          users: p.max_users,
          unlimited: p.unlimited
        }));
      } else {
        console.error('Erro ao carregar planos:', plansError);
      }

      // 2. Produtos e preços
      const { data: productsData, error: productsError } = await supabase
        .from('products')
        .select(`
          *,
          prices (
            plan_id,
            adesao,
            mensalidade
          )
        `);
      if (!productsError && productsData) {
        const prices = {};
        const productNames = {};
        for (const prod of productsData) {
          const key = prod.internal_key;
          productNames[key] = prod.name;
          prices[key] = {};
          for (const price of prod.prices) {
            const plan = configData.plans.find(p => p.id === price.plan_id);
            if (plan) {
              prices[key][plan.id] = [price.adesao, price.mensalidade];
            }
          }
        }
        configData.prices = prices;
        configData.productNames = productNames;
      } else {
        console.error('Erro ao carregar produtos:', productsError);
      }

      // 3. Vouchers
      const { data: vouchersData, error: vouchersError } = await supabase
        .from('vouchers')
        .select('*');
      if (!vouchersError && vouchersData) {
        configData.vouchers = vouchersData;
      } else {
        console.error('Erro ao carregar vouchers:', vouchersError);
      }

      setConfigLoaded(true);
    }
    loadConfig();
  }, []);

  const addMessage = (role, content, isHtml = false) => {
    setMessages(prev => [...prev, { role, content, isHtml }]);
  };

  // Renderização do card do cliente
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

  // Renderização dos cards de preço (versão cheia) – agora com dois botões
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
    if (configData.discMode === 'voucher') {
      html += `<div class="teaser-card"><div class="teaser-title">🎫 Possui um voucher de desconto?</div>
        <div class="teaser-body">Digite seu código para desbloquear condições especiais.</div>
        <div class="voucher-row">
          <input class="voucher-input" id="voucherInput" type="text" placeholder="Digite o código do voucher">
          <button class="voucher-apply-btn" onclick="window.tryVoucher()">Aplicar</button>
        </div><div id="voucherMsg"></div></div>`;
    } else {
      html += `<div class="teaser-card"><div class="teaser-title">🎫 Há licenças com desconto disponíveis!</div>
        <div class="teaser-body">Temos condições especiais para novos clientes.<br>Deseja ver os valores com desconto?</div>
        <div class="yn-row">
          <button class="yn-btn yes" onclick="window.handleShowDiscount(true)">✅ Sim, quero ver!</button>
          <button class="yn-btn no" onclick="window.handleShowDiscount(false)">Não, obrigado</button>
        </div></div>`;
    }
    html += `<div class="section-label">Próximos vencimentos</div>
      <div class="dates-box">${dates.map(d => `<span class="date-chip">${d}</span>`).join('')}</div>`;
    // Botões para gerar proposta e contrato
    html += `<div style="display: flex; gap: 12px; margin-top: 12px;">
      <button class="proposal-btn" onclick="window.openClientModal('proposta')" style="flex:1;">📄 Gerar Proposta</button>
      <button class="proposal-btn" onclick="window.openClientModal('contrato')" style="flex:1; background: linear-gradient(135deg, #fbbf24, #b45309);">📝 Gerar Contrato</button>
    </div>`;
    return html;
  };

  // Renderização com desconto – também com dois botões
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

    // OPP BANNER
    html += `<div class="opp-banner">
      <div class="opp-title">🔥 Oportunidade de Negociação</div>
      <div class="opp-body">
        <strong style="color:var(--gold)">${clientName}</strong> pode fechar agora com condições ainda melhores:<br>
        • Adesão com <strong style="color:var(--gold)">${configData.discClosePct}% OFF</strong> sobre o valor base<br>
        • Mensalidade calculada por CNPJ ativo<br>
        Oferta válida somente até as <strong style="color:var(--gold)">18h de hoje</strong>.
      </div>
      <div class="yn-row">
        <button class="yn-btn yes" onclick="window.handleClosingToday(true)">✅ Sim, fechar hoje!</button>
        <button class="yn-btn no" onclick="window.handleClosingToday(false)">Não por agora</button>
      </div>
    </div>`;
    html += `<div class="section-label">Próximos vencimentos</div>
      <div class="dates-box">${dates.map(d => `<span class="date-chip">${d}</span>`).join('')}</div>`;
    html += `<div style="display: flex; gap: 12px; margin-top: 12px;">
      <button class="proposal-btn" onclick="window.openClientModal('proposta')" style="flex:1;">📄 Gerar Proposta</button>
      <button class="proposal-btn" onclick="window.openClientModal('contrato')" style="flex:1; background: linear-gradient(135deg, #fbbf24, #b45309);">📝 Gerar Contrato</button>
    </div>`;
    return html;
  };

  // Renderização do fechamento – também com dois botões
  const renderClosingResult = (data, dates) => {
    const { results, tAd, tMen } = data;
    let html = `<div class="timer-card">
      <div class="timer-label">⏱ Oferta válida até as 18h de hoje</div>
      <div class="timer-display" id="timerDisplay">--:--:--</div>
      <div class="timer-sub">Após este horário retornam os valores com desconto padrão</div>
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
      <button class="proposal-btn" onclick="window.openClientModal('proposta')" style="flex:1;">📄 Gerar Proposta</button>
      <button class="proposal-btn" onclick="window.openClientModal('contrato')" style="flex:1; background: linear-gradient(135deg, #fbbf24, #b45309);">📝 Gerar Contrato</button>
    </div>`;
    // Inicia o timer (simples)
    setTimeout(() => {
      const deadline = new Date(); deadline.setHours(18,0,0,0);
      const tick = () => {
        const el = document.getElementById('timerDisplay');
        if (!el) return;
        const diff = deadline - new Date();
        if (diff <= 0) { el.textContent = 'EXPIRADO'; clearInterval(interval); return; }
        const hh = Math.floor(diff / 3600000);
        const mm = Math.floor((diff % 3600000) / 60000);
        const ss = Math.floor((diff % 60000) / 1000);
        el.textContent = `${String(hh).padStart(2,'0')}:${String(mm).padStart(2,'0')}:${String(ss).padStart(2,'0')}`;
      };
      tick();
      const interval = setInterval(tick, 1000);
    }, 100);
    return html;
  };

  // Busca CNPJ na BrasilAPI
  async function fetchCNPJ(cnpj) {
    try {
      const r = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cnpj}`);
      if (!r.ok) return null;
      const d = await r.json();
      const fone = (d.ddd_telefone_1 || d.ddd_telefone_2 || '').replace(/\D/g, '');
      const logr = (d.descricao_tipo_logradouro ? d.descricao_tipo_logradouro + ' ' : '') +
                   (d.logradouro || '') + (d.numero && d.numero !== 'S/N' ? ' ' + d.numero : '') + (d.complemento ? ' – ' + d.complemento : '');
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

  // Processamento da mensagem
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
      return {
        type: 'html',
        content: `${cardHtml}<div style="margin-top:10px;font-size:14px;color:var(--muted)">✅ ${clientData.nome || 'Cliente'}<br><br>Quantos <strong style="color:var(--text)">usuários</strong> ele possui atualmente?</div>`
      };
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

    if (stage === 'await_if_plan') {
      const ifPlan = pricing.parseIFPlan(t, configData.plans);
      if (!ifPlan) return { type: 'text', content: `Informe o plano do IF: Basic, Pro ou Top` };
      setState(prev => ({ ...prev, ifPlan }));
      return finalizeQuote();
    }

    if (stage === 'await_notas') {
      const notas = parseInt(t);
      if (!notas || notas < 1) return { type: 'text', content: 'Quantas notas fiscais por mês?' };
      setState(prev => ({ ...prev, notas }));
      return finalizeQuote();
    }

    async function finalizeQuote() {
      const needsCNPJ = state.modules.some(m => !['IF','Tributos','EP'].includes(m));
      let plan = null;
      if (needsCNPJ && state.cnpjs) {
        plan = pricing.getPlan(state.cnpjs, configData.plans);
      } else {
        plan = 'basic';
      }
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

  // Funções para desconto e fechamento
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
      setTimeout(() => {
        addMessage('bot', `<div style="margin-top: 8px; display: flex; gap: 12px;">
          <button class="proposal-btn" onclick="window.openClientModal('proposta')" style="flex:1;">📄 Gerar Proposta (preço cheio)</button>
          <button class="proposal-btn" onclick="window.openClientModal('contrato')" style="flex:1; background: linear-gradient(135deg, #fbbf24, #b45309);">📝 Gerar Contrato (preço cheio)</button>
        </div>`, true);
      }, 500);
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

  const tryVoucher = () => {
    const inputEl = document.getElementById('voucherInput');
    if (!inputEl) return;
    const code = inputEl.value.trim().toUpperCase();
    const voucher = configData.vouchers.find(v => v.code.toUpperCase() === code);
    const msgDiv = document.getElementById('voucherMsg');
    if (voucher) {
      msgDiv.innerHTML = `<div class="voucher-msg ok">✅ Voucher ${code} aplicado! (${voucher.disc_ad_pct}% off adesão, ${voucher.disc_men_pct}% off mensalidade)</div>`;
      const discountedData = pricing.calcQuoteWithDiscount(
        state.modules, state.plan, state.ifPlan, state.cnpjs, state.notas, {
          discAdPct: voucher.disc_ad_pct,
          discMenPct: voucher.disc_men_pct,
          unlimitedStrategy: configData.unlimitedStrategy,
          prices: configData.prices,
          plans: configData.plans,
          productNames: configData.productNames
        }
      );
      setState(prev => ({ ...prev, discountedData, appliedVoucher: voucher }));
      setStage('discounted');
      const dates = pricing.getNextDates();
      const clientName = state.clientData?.fantasia || state.clientData?.nome || pricing.fmtDoc(state.doc);
      addMessage('bot', renderWithDiscount(discountedData, dates, clientName), true);
    } else {
      msgDiv.innerHTML = `<div class="voucher-msg err">❌ Voucher inválido.</div>`;
    }
  };

  // Salva o cliente no Supabase
  const saveClientToDB = async (clientData, contactData) => {
    const { data: existing } = await supabase
      .from('clients')
      .select('id')
      .eq('doc', clientData.cnpj)
      .maybeSingle();
    if (existing) {
      const { error } = await supabase
        .from('clients')
        .update({
          fantasia: clientData.fantasia,
          razao: clientData.nome,
          contato: contactData.contato,
          email: contactData.email || clientData.email,
          telefone: contactData.telefone || clientData.telefone,
          cidade: contactData.cidade || clientData.municipio,
          uf: contactData.uf || clientData.uf,
          cpf_contato: contactData.cpfContato,
          regime: contactData.regime,
          rimp_nome: contactData.rimpNome,
          rimp_email: contactData.rimpEmail,
          rimp_telefone: contactData.rimpTel,
          rfin_nome: contactData.rfinNome,
          rfin_email: contactData.rfinEmail,
          rfin_telefone: contactData.rfinTel,
          updated_at: new Date()
        })
        .eq('id', existing.id);
      if (error) console.error(error);
      return existing.id;
    } else {
      const { data, error } = await supabase
        .from('clients')
        .insert({
          doc: clientData.cnpj,
          fantasia: clientData.fantasia,
          razao: clientData.nome,
          contato: contactData.contato,
          email: contactData.email || clientData.email,
          telefone: contactData.telefone || clientData.telefone,
          cidade: contactData.cidade || clientData.municipio,
          uf: contactData.uf || clientData.uf,
          cpf_contato: contactData.cpfContato,
          regime: contactData.regime,
          rimp_nome: contactData.rimpNome,
          rimp_email: contactData.rimpEmail,
          rimp_telefone: contactData.rimpTel,
          rfin_nome: contactData.rfinNome,
          rfin_email: contactData.rfinEmail,
          rfin_telefone: contactData.rfinTel,
          created_at: new Date()
        })
        .select('id');
      if (error) console.error(error);
      return data?.[0]?.id;
    }
  };

  // Gera o HTML da proposta (igual ao anterior)
  const generateProposalHtml = (clientData, contactData, dataToUse, isClosing = false) => {
    const results = dataToUse.results;
    const tAd = isClosing ? dataToUse.tAd : (state.discountedData ? state.discountedData.tAdD : dataToUse.tAdD);
    const tMen = isClosing ? dataToUse.tMen : (state.discountedData ? state.discountedData.tMenD : dataToUse.tMenD);
    const today = new Date().toLocaleDateString('pt-BR');
    const validity = isClosing ? 'Válida até as 18h de hoje' : 'Válida por 7 dias';
    let rows = '';
    for (const r of results) {
      const adS = (r.isTributos || r.isEP) ? '—' : pricing.fmt(isClosing ? r.ad : (state.discountedData ? r.adD : r.ad));
      const menS = pricing.fmt(isClosing ? r.men : (state.discountedData ? r.menD : r.men));
      rows += `<table>
        <td style="padding:10px 14px;border-bottom:1px solid #f1f5f9;font-size:13px;color:#1e293b;font-weight:500">${r.name}</td>
        <td style="padding:10px 14px;border-bottom:1px solid #f1f5f9;font-size:13px;color:#1e293b;text-align:center">${adS}</td>
        <td style="padding:10px 14px;border-bottom:1px solid #f1f5f9;font-size:13px;color:#1e293b;text-align:center">${menS}</td>
        <td style="padding:10px 14px;border-bottom:1px solid #f1f5f9;font-size:13px;color:#1e293b;text-align:center">${state.cnpjs || '—'}</td>
        <td style="padding:10px 14px;border-bottom:1px solid #f1f5f9;font-size:13px;color:#10b981;font-weight:700;text-align:right">${pricing.fmt(menS)}</td>
       </tr>`;
    }

    const html = `
    <div style="background:#fff;font-family:'Inter',sans-serif;color:#1e293b;max-width:820px;margin:0 auto">
      <div style="background:linear-gradient(135deg,#0f172a,#1e3a5f);padding:32px 44px;text-align:center">
        <div style="font-family:Syne,sans-serif;font-size:20px;font-weight:800;color:#fff;margin-bottom:6px">Proposta Comercial</div>
        <div style="font-size:12px;color:#94a3b8">${configData.company || 'Vivanexa'}</div>
      </div>
      <div style="padding:36px 44px">
        <p style="font-size:13px;color:#475569;margin-bottom:28px">Prezado(a) ${contactData.contato || clientData.fantasia || clientData.nome},</p>
        <p style="font-size:13px;color:#475569;margin-bottom:28px">Segue nossa proposta comercial para os serviços abaixo:</p>

        <table style="width:100%;border-collapse:collapse;margin-bottom:20px">
          <thead><tr style="background:#f8fafc">
            <th style="padding:10px 14px;text-align:left">Produto</th>
            <th style="padding:10px 14px;text-align:center">Adesão</th>
            <th style="padding:10px 14px;text-align:center">Mensalidade</th>
            <th style="padding:10px 14px;text-align:center">CNPJs</th>
            <th style="padding:10px 14px;text-align:right">Total/mês</th>
          </tr></thead>
          <tbody>${rows}</tbody>
          <tfoot>
            <tr style="background:#f0fdf4"><td colspan="4" style="padding:12px 14px;font-weight:700">Total Mensalidade</td><td style="padding:12px 14px;font-weight:800;color:#10b981;text-align:right">${pricing.fmt(tMen)}/mês</td></tr>
            <tr style="background:#fffbeb"><td colspan="4" style="padding:10px 14px;font-weight:700">Adesão (único)</td><td style="padding:10px 14px;font-weight:700;color:#b45309;text-align:right">${pricing.fmt(tAd)}</td></tr>
          </tfoot>
        </table>

        <div style="margin-top:14px;padding:14px 18px;background:#fffbeb;border:1px solid #fde68a;border-radius:8px;font-size:13px;color:#92400e">
          <strong>Condições:</strong> Pagamento à vista ou parcelado no cartão (consulte). Vencimento da adesão: a combinar. Primeira mensalidade: a combinar.
        </div>

        <div style="margin-top:24px;font-size:12px;color:#64748b;text-align:center">
          Esta proposta é válida até ${validity}.<br>
          ${configData.company || 'Vivanexa'} – CNPJ 32.125.987/0001-67 – contato@vivanexa.com.br – (69) 98405-9125
        </div>
      </div>
    </div>`;
    return html;
  };

  // Gera o HTML do contrato (baseado no original)
  const generateContractHtml = (clientData, contactData, dataToUse, isClosing = false) => {
    const results = dataToUse.results;
    const tAd = isClosing ? dataToUse.tAd : (state.discountedData ? state.discountedData.tAdD : dataToUse.tAdD);
    const tMen = isClosing ? dataToUse.tMen : (state.discountedData ? state.discountedData.tMenD : dataToUse.tMenD);
    const today = new Date().toLocaleDateString('pt-BR');
    const addr = [contactData.endereco, contactData.bairro, contactData.cidade, contactData.uf].filter(Boolean).join(', ');
    let rows = '';
    for (const r of results) {
      const adS = (r.isTributos || r.isEP) ? '—' : pricing.fmt(isClosing ? r.ad : (state.discountedData ? r.adD : r.ad));
      const menS = pricing.fmt(isClosing ? r.men : (state.discountedData ? r.menD : r.men));
      rows += `<tr>
        <td style="padding:10px 14px;border-bottom:1px solid #f1f5f9;font-size:13px;color:#1e293b;font-weight:500">${r.name}</td>
        <td style="padding:10px 14px;border-bottom:1px solid #f1f5f9;font-size:13px;color:#1e293b;text-align:center">${adS}</td>
        <td style="padding:10px 14px;border-bottom:1px solid #f1f5f9;font-size:13px;color:#1e293b;text-align:center">${menS}</td>
        <td style="padding:10px 14px;border-bottom:1px solid #f1f5f9;font-size:13px;color:#1e293b;text-align:center">${state.cnpjs || '—'}</td>
        <td style="padding:10px 14px;border-bottom:1px solid #f1f5f9;font-size:13px;color:#10b981;font-weight:700;text-align:right">${pricing.fmt(menS)}</td>
       </tr>`;
    }

    const html = `
    <div style="background:#fff;font-family:'Inter',sans-serif;color:#1e293b;max-width:820px;margin:0 auto">
      <div style="background:linear-gradient(135deg,#0f172a,#1e3a5f);padding:32px 44px;text-align:center">
        <div style="font-family:Syne,sans-serif;font-size:20px;font-weight:800;color:#fff;margin-bottom:6px">Termo de Pedido e Registro de Software</div>
        <div style="font-size:12px;color:#94a3b8">${configData.company || 'Vivanexa'}</div>
      </div>
      <div style="padding:36px 44px">
        <p style="font-size:13px;color:#475569;margin-bottom:28px;padding:14px 18px;background:#f8fafc;border-left:3px solid #00d4ff">Confira os dados abaixo e assine eletronicamente.</p>

        <div style="margin-bottom:24px">
          <div style="font-weight:700;margin-bottom:8px">1 – CONTRATADA</div>
          <div><strong>VIVANEXA DESENVOLVIMENTO E LICENCIAMENTO DE PROGRAMAS LTDA</strong><br>CNPJ 32.125.987/0001-67<br>Rua Dom Augusto, 1488, Sala D, Centro, Ji-Paraná RO, 76900-103<br>contato@vivanexa.com.br</div>
        </div>

        <div style="margin-bottom:24px">
          <div style="font-weight:700;margin-bottom:8px">2 – CONTRATANTE</div>
          <div><strong>${contactData.razao || clientData.nome || ''}</strong><br>CNPJ: ${pricing.fmtDoc(state.doc || '')}<br>Endereço: ${addr}<br>E-mail: ${contactData.email || clientData.email || ''}<br>Telefone: ${contactData.telefone || clientData.telefone || ''}<br>Contato: ${contactData.contato || ''}<br>CPF: ${contactData.cpfContato || ''}</div>
        </div>

        <div style="margin-bottom:24px">
          <div style="font-weight:700;margin-bottom:8px">3 – PLANO CONTRATADO E VALORES</div>
          <table style="width:100%;border-collapse:collapse;margin-bottom:12px">
            <thead><tr style="background:#f8fafc">
              <th style="padding:10px 14px;text-align:left">Produto</th><th>Adesão</th><th>Mensalidade</th><th>CNPJs</th><th>Total/mês</th>
            </tr></thead>
            <tbody>${rows}</tbody>
            <tfoot>
              <tr style="background:#f0fdf4"><td colspan="4" style="padding:12px 14px;font-weight:700">Total Mensalidade</td><td style="padding:12px 14px;font-weight:800;color:#10b981">${pricing.fmt(tMen)}/mês</td></tr>
              <tr style="background:#fffbeb"><td colspan="4" style="padding:10px 14px;font-weight:700">Adesão (único)</td><td style="padding:10px 14px;font-weight:700;color:#b45309">${pricing.fmt(tAd)}</td></tr>
            </tfoot>
          </table>
          <div style="font-size:12px;color:#64748b">Validade: 12 meses. Renovação automática.</div>
        </div>

        <div style="margin-bottom:24px">
          <div style="font-weight:700;margin-bottom:8px">4 – CONDIÇÕES DE PAGAMENTO</div>
          <div>Adesão: a combinar. Primeira mensalidade: a combinar. Pagamento via boleto ou cartão.</div>
        </div>

        <div style="margin-bottom:24px;padding:12px;background:#f0f9ff;border-radius:8px">
          <strong>Informações adicionais:</strong><br>
          Regime Tributário: ${contactData.regime || '—'}<br>
          Responsável pela implantação: ${contactData.rimpNome || '—'} (${contactData.rimpEmail || '—'}, ${contactData.rimpTel || '—'})<br>
          Responsável financeiro: ${contactData.rfinNome || '—'} (${contactData.rfinEmail || '—'}, ${contactData.rfinTel || '—'})
        </div>

        <div style="margin-bottom:24px;font-size:12px;color:#475569">
          <p>Este contrato é regido pela Lei nº 14.063/2020 e pela MP 2.200-2/2001, que estabelecem a validade jurídica das assinaturas eletrônicas. As partes declaram estar de acordo com os Termos de Uso e Política de Privacidade disponíveis em <a href="https://vivanexa.com.br/termos">vivanexa.com.br/termos</a>.</p>
          <p>A rescisão antecipada implicará na cobrança de multa de 20% sobre o saldo remanescente.</p>
        </div>

        <div style="margin-top:44px;border-top:1px solid #e2e8f0;padding-top:24px">
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:48px;text-align:center">
            <div>
              <div style="height:50px;border-bottom:1px solid #1e293b;margin-bottom:8px"></div>
              <div><strong>${configData.company || 'Vivanexa'}</strong><br>Contratada</div>
              <div style="font-size:11px;color:#94a3b8">Data: ${today}</div>
            </div>
            <div>
              <div style="height:50px;border-bottom:1px solid #1e293b;margin-bottom:8px"></div>
              <div><strong>${contactData.contato || clientData.fantasia || clientData.nome || 'Cliente'}</strong><br>Contratante</div>
              <div style="font-size:11px;color:#94a3b8">CPF: ${contactData.cpfContato || '—'}</div>
            </div>
          </div>
        </div>
      </div>
      <div style="background:#f8fafc;padding:16px 44px;font-size:11px;color:#94a3b8;text-align:center">${configData.company || 'Vivanexa'} – www.vivanexa.com.br</div>
    </div>`;
    return html;
  };

  // Salva o documento no Supabase e exibe o modal
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
        type: type,
        client_id: clientId,
        html: html,
        status: 'draft',
        sign_token: signToken,
        consultant_id: (await supabase.auth.getUser()).data.user?.id,
        t_ad: isClosing ? state.closingData?.tAd : (state.discountedData?.tAdD || state.quoteData.tAdD),
        t_men: isClosing ? state.closingData?.tMen : (state.discountedData?.tMenD || state.quoteData.tMenD),
        created_at: new Date()
      })
      .select('sign_token')
      .single();
    if (error) {
      console.error(error);
      alert('Erro ao salvar documento. Verifique o console.');
      return;
    }
    setGeneratedDocHtml(html);
    setCurrentDocumentToken(data.sign_token);
    setShowDocModal(true);
  };

  // Função chamada ao clicar em "Gerar Proposta" ou "Gerar Contrato"
  const openClientModal = (type) => {
    setGenerateType(type);
    setShowClientModal(true);
  };

  // Quando o usuário salva os dados do modal
  const handleSaveClient = async (e) => {
    e.preventDefault();
    const contactData = {
      contato: document.getElementById('clientName').value,
      email: document.getElementById('clientEmail').value,
      telefone: document.getElementById('clientPhone').value,
      cidade: document.getElementById('clientCity').value,
      uf: document.getElementById('clientUf').value,
      cpfContato: document.getElementById('clientCpf').value,
      regime: document.getElementById('clientRegime').value,
      rimpNome: document.getElementById('rimpName').value,
      rimpEmail: document.getElementById('rimpEmail').value,
      rimpTel: document.getElementById('rimpPhone').value,
      rfinNome: document.getElementById('rfinName').value,
      rfinEmail: document.getElementById('rfinEmail').value,
      rfinTel: document.getElementById('rfinPhone').value,
      endereco: document.getElementById('clientEndereco')?.value || '',
      bairro: document.getElementById('clientBairro')?.value || '',
      razao: document.getElementById('clientRazao')?.value || '',
    };
    setState(prev => ({ ...prev, contactData }));
    const clientId = await saveClientToDB(state.clientData, contactData);
    if (clientId) {
      await saveDocument(clientId, state.clientData, contactData, generateType);
    }
    setShowClientModal(false);
  };

  // Funções globais para os botões no HTML
  useEffect(() => {
    window.handleShowDiscount = showDiscount;
    window.handleClosingToday = handleClosingToday;
    window.tryVoucher = tryVoucher;
    window.openClientModal = openClientModal;
  }, [state, configData]);

  if (!configLoaded) {
    return <div style={{ textAlign: 'center', padding: '50px' }}>Carregando configurações...</div>;
  }

  return (
    <>
      <div style={{ maxWidth: 820, margin: '0 auto', padding: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
          <h1>Assistente Comercial</h1>
          <button onClick={() => supabase.auth.signOut()}>Sair</button>
        </div>

        <div style={{ height: '60vh', overflowY: 'auto', border: '1px solid #ccc', borderRadius: 8, padding: 10, marginBottom: 10 }}>
          {messages.map((msg, idx) => (
            <div key={idx} style={{ textAlign: msg.role === 'user' ? 'right' : 'left', marginBottom: 10 }}>
              <div style={{
                display: 'inline-block',
                background: msg.role === 'user' ? '#0070f3' : '#eaeaea',
                color: msg.role === 'user' ? '#fff' : '#000',
                borderRadius: 12,
                padding: '8px 12px',
                maxWidth: '80%'
              }}>
                {msg.isHtml ? <div dangerouslySetInnerHTML={{ __html: msg.content }} /> : msg.content}
              </div>
            </div>
          ))}
          {loading && <div style={{ textAlign: 'left' }}>Assistente está pensando...</div>}
          <div ref={messagesEndRef} />
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && sendMessage()}
            placeholder="Digite aqui..."
            rows={2}
            style={{ flex: 1, padding: 8, borderRadius: 8, border: '1px solid #ccc' }}
          />
          <button onClick={sendMessage} style={{ padding: '0 16px', borderRadius: 8, background: '#0070f3', color: '#fff', border: 'none' }}>
            Enviar
          </button>
        </div>
      </div>

      {/* Modal para dados do cliente */}
      {showClientModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div style={{ background: '#111827', borderRadius: 16, padding: 24, maxWidth: 500, width: '100%', maxHeight: '80vh', overflowY: 'auto' }}>
            <h2 style={{ color: '#00d4ff', marginBottom: 16 }}>{generateType === 'proposta' ? 'Dados para a Proposta' : 'Dados para o Contrato'}</h2>
            <form onSubmit={handleSaveClient}>
              <div style={{ marginBottom: 12 }}>
                <label style={{ display: 'block', fontSize: 12, color: '#64748b', marginBottom: 4 }}>Razão Social</label>
                <input id="clientRazao" defaultValue={state.clientData?.nome || ''} style={{ width: '100%', padding: 8, borderRadius: 8, border: '1px solid #1e2d4a', background: '#0f172a', color: '#e2e8f0' }} />
              </div>
              <div style={{ marginBottom: 12 }}>
                <label style={{ display: 'block', fontSize: 12, color: '#64748b', marginBottom: 4 }}>Nome do Contato *</label>
                <input id="clientName" required style={{ width: '100%', padding: 8, borderRadius: 8, border: '1px solid #1e2d4a', background: '#0f172a', color: '#e2e8f0' }} />
              </div>
              <div style={{ marginBottom: 12 }}>
                <label style={{ display: 'block', fontSize: 12, color: '#64748b', marginBottom: 4 }}>E-mail *</label>
                <input id="clientEmail" type="email" required style={{ width: '100%', padding: 8, borderRadius: 8, border: '1px solid #1e2d4a', background: '#0f172a', color: '#e2e8f0' }} />
              </div>
              <div style={{ marginBottom: 12 }}>
                <label style={{ display: 'block', fontSize: 12, color: '#64748b', marginBottom: 4 }}>Telefone</label>
                <input id="clientPhone" style={{ width: '100%', padding: 8, borderRadius: 8, border: '1px solid #1e2d4a', background: '#0f172a', color: '#e2e8f0' }} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 12, color: '#64748b', marginBottom: 4 }}>Cidade</label>
                  <input id="clientCity" style={{ width: '100%', padding: 8, borderRadius: 8, border: '1px solid #1e2d4a', background: '#0f172a', color: '#e2e8f0' }} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 12, color: '#64748b', marginBottom: 4 }}>UF</label>
                  <input id="clientUf" style={{ width: '100%', padding: 8, borderRadius: 8, border: '1px solid #1e2d4a', background: '#0f172a', color: '#e2e8f0' }} />
                </div>
              </div>
              <div style={{ marginBottom: 12 }}>
                <label style={{ display: 'block', fontSize: 12, color: '#64748b', marginBottom: 4 }}>Endereço</label>
                <input id="clientEndereco" style={{ width: '100%', padding: 8, borderRadius: 8, border: '1px solid #1e2d4a', background: '#0f172a', color: '#e2e8f0' }} />
              </div>
              <div style={{ marginBottom: 12 }}>
                <label style={{ display: 'block', fontSize: 12, color: '#64748b', marginBottom: 4 }}>Bairro</label>
                <input id="clientBairro" style={{ width: '100%', padding: 8, borderRadius: 8, border: '1px solid #1e2d4a', background: '#0f172a', color: '#e2e8f0' }} />
              </div>
              <div style={{ marginBottom: 12 }}>
                <label style={{ display: 'block', fontSize: 12, color: '#64748b', marginBottom: 4 }}>CPF do Contato</label>
                <input id="clientCpf" style={{ width: '100%', padding: 8, borderRadius: 8, border: '1px solid #1e2d4a', background: '#0f172a', color: '#e2e8f0' }} />
              </div>
              <div style={{ marginBottom: 12 }}>
                <label style={{ display: 'block', fontSize: 12, color: '#64748b', marginBottom: 4 }}>Regime Tributário</label>
                <select id="clientRegime" style={{ width: '100%', padding: 8, borderRadius: 8, border: '1px solid #1e2d4a', background: '#0f172a', color: '#e2e8f0' }}>
                  <option value="">Selecione</option>
                  <option>Simples Nacional</option>
                  <option>Lucro Presumido</option>
                  <option>Lucro Real</option>
                  <option>MEI</option>
                </select>
              </div>
              <div style={{ borderTop: '1px solid #1e2d4a', margin: '16px 0 12px', paddingTop: 12 }}>
                <div style={{ fontSize: 13, fontWeight: 'bold', color: '#00d4ff', marginBottom: 8 }}>Responsável pela Implantação</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <input id="rimpName" placeholder="Nome" style={{ padding: 8, borderRadius: 8, border: '1px solid #1e2d4a', background: '#0f172a', color: '#e2e8f0' }} />
                  <input id="rimpEmail" placeholder="E-mail" style={{ padding: 8, borderRadius: 8, border: '1px solid #1e2d4a', background: '#0f172a', color: '#e2e8f0' }} />
                  <input id="rimpPhone" placeholder="Telefone" style={{ padding: 8, borderRadius: 8, border: '1px solid #1e2d4a', background: '#0f172a', color: '#e2e8f0' }} />
                </div>
              </div>
              <div style={{ borderTop: '1px solid #1e2d4a', margin: '16px 0 12px', paddingTop: 12 }}>
                <div style={{ fontSize: 13, fontWeight: 'bold', color: '#fbbf24', marginBottom: 8 }}>Responsável Financeiro</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <input id="rfinName" placeholder="Nome" style={{ padding: 8, borderRadius: 8, border: '1px solid #1e2d4a', background: '#0f172a', color: '#e2e8f0' }} />
                  <input id="rfinEmail" placeholder="E-mail" style={{ padding: 8, borderRadius: 8, border: '1px solid #1e2d4a', background: '#0f172a', color: '#e2e8f0' }} />
                  <input id="rfinPhone" placeholder="Telefone" style={{ padding: 8, borderRadius: 8, border: '1px solid #1e2d4a', background: '#0f172a', color: '#e2e8f0' }} />
                </div>
              </div>
              <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
                <button type="submit" style={{ flex: 1, padding: 10, borderRadius: 8, background: '#10b981', border: 'none', color: '#fff', fontWeight: 'bold', cursor: 'pointer' }}>Salvar e Gerar {generateType === 'proposta' ? 'Proposta' : 'Contrato'}</button>
                <button type="button" onClick={() => setShowClientModal(false)} style={{ padding: '10px 16px', borderRadius: 8, background: '#1e2d4a', border: 'none', color: '#64748b', cursor: 'pointer' }}>Cancelar</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal para visualizar o documento */}
      {showDocModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.9)', zIndex: 1001, overflowY: 'auto', padding: 20, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ maxWidth: 820, width: '100%', background: '#fff', borderRadius: 16, overflow: 'hidden' }}>
            <div style={{ padding: 16, background: '#0f172a', display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
              <div>
                <button
                  onClick={() => {
                    const link = `${window.location.origin}/sign/${currentDocumentToken}`;
                    navigator.clipboard.writeText(link);
                    alert('Link copiado! Envie para o cliente.');
                  }}
                  style={{ padding: '8px 16px', borderRadius: 8, background: '#00d4ff', border: 'none', color: '#000', cursor: 'pointer' }}
                >
                  📋 Copiar link de assinatura
                </button>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => window.print()} style={{ padding: '8px 16px', borderRadius: 8, background: '#00d4ff', border: 'none', color: '#000', cursor: 'pointer' }}>
                  🖨️ Imprimir
                </button>
                <button onClick={() => setShowDocModal(false)} style={{ padding: '8px 16px', borderRadius: 8, background: '#1e2d4a', border: 'none', color: '#fff', cursor: 'pointer' }}>
                  Fechar
                </button>
              </div>
            </div>
            <div dangerouslySetInnerHTML={{ __html: generatedDocHtml }} />
          </div>
        </div>
      )}

      {/* Estilos */}
      <style jsx>{`
        .price-card {
          background: #1a2540;
          border: 1px solid #1e2d4a;
          border-radius: 12px;
          padding: 15px 18px;
          margin: 4px 0;
          font-size: 15px;
        }
        .price-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 5px 0;
          border-bottom: 1px solid rgba(128,128,128,.1);
        }
        .label {
          color: #64748b;
          font-size: 13px;
        }
        .val {
          font-weight: 600;
          font-size: 15px;
        }
        .discount { color: #10b981; }
        .closing { color: #fbbf24; }
        .teaser-card {
          background: linear-gradient(135deg,rgba(16,185,129,.1),rgba(16,185,129,.03));
          border: 1px solid rgba(16,185,129,.3);
          border-radius: 12px;
          padding: 16px 18px;
          margin: 4px 0;
          position: relative;
          overflow: hidden;
        }
        .teaser-title {
          font-family: 'Syne',sans-serif;
          font-weight: 700;
          font-size: 15px;
          color: #10b981;
          margin-bottom: 8px;
        }
        .teaser-body {
          font-size: 14px;
          color: #6ee7b7;
          line-height: 1.6;
          margin-bottom: 12px;
        }
        .opp-banner {
          background: linear-gradient(135deg,rgba(251,191,36,.12),rgba(251,191,36,.04));
          border: 1px solid rgba(251,191,36,.35);
          border-radius: 12px;
          padding: 16px 18px;
          margin: 4px 0;
          position: relative;
          overflow: hidden;
        }
        .opp-title {
          font-family: 'Syne',sans-serif;
          font-weight: 700;
          font-size: 15px;
          color: #fbbf24;
          margin-bottom: 8px;
        }
        .opp-body {
          font-size: 14px;
          color: #d4b96a;
          line-height: 1.7;
          margin-bottom: 12px;
        }
        .timer-card {
          background: linear-gradient(135deg,rgba(239,68,68,.12),rgba(239,68,68,.04));
          border: 1px solid rgba(239,68,68,.35);
          border-radius: 12px;
          padding: 16px 18px;
          margin: 4px 0;
          text-align: center;
          position: relative;
          overflow: hidden;
        }
        .timer-label {
          font-size: 11px;
          color: #64748b;
          letter-spacing: 1.5px;
          text-transform: uppercase;
          margin-bottom: 6px;
        }
        .timer-display {
          font-family: 'Syne',sans-serif;
          font-size: 34px;
          font-weight: 800;
          color: #ef4444;
          letter-spacing: 6px;
        }
        .timer-sub {
          font-size: 12px;
          color: #64748b;
          margin-top: 5px;
        }
        .yn-row {
          display: flex;
          gap: 10px;
          margin-top: 12px;
        }
        .yn-btn {
          flex: 1;
          padding: 11px;
          border-radius: 10px;
          font-family: 'DM Mono',monospace;
          font-size: 14px;
          font-weight: 500;
          cursor: pointer;
          border: 1px solid;
          transition: all .2s;
          letter-spacing: .3px;
        }
        .yn-btn.yes {
          background: rgba(16,185,129,.15);
          border-color: rgba(16,185,129,.4);
          color: #10b981;
        }
        .yn-btn.no {
          background: rgba(100,116,139,.12);
          border-color: rgba(100,116,139,.3);
          color: #64748b;
        }
        .section-label {
          font-size: 11px;
          letter-spacing: 1.5px;
          color: #64748b;
          text-transform: uppercase;
          margin: 10px 0 6px;
        }
        .dates-box {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
          margin: 8px 0;
        }
        .date-chip {
          background: rgba(0,212,255,.1);
          border: 1px solid rgba(0,212,255,.2);
          color: #00d4ff;
          padding: 5px 12px;
          border-radius: 20px;
          font-size: 13px;
          letter-spacing: .5px;
        }
        .voucher-row {
          display: flex;
          gap: 8px;
          margin-top: 10px;
        }
        .voucher-input {
          flex: 1;
          background: #111827;
          border: 1px solid #1e2d4a;
          border-radius: 9px;
          padding: 10px 12px;
          font-family: 'DM Mono',monospace;
          font-size: 14px;
          color: #e2e8f0;
          outline: none;
          text-transform: uppercase;
          letter-spacing: 1px;
        }
        .voucher-apply-btn {
          background: rgba(0,212,255,.15);
          border: 1px solid rgba(0,212,255,.3);
          border-radius: 9px;
          color: #00d4ff;
          font-family: 'DM Mono',monospace;
          font-size: 13px;
          padding: 10px 14px;
          cursor: pointer;
          white-space: nowrap;
        }
        .voucher-msg.ok {
          background: rgba(16,185,129,.1);
          color: #10b981;
          border: 1px solid rgba(16,185,129,.2);
          padding: 6px 10px;
          border-radius: 8px;
          margin-top: 6px;
        }
        .voucher-msg.err {
          background: rgba(239,68,68,.1);
          color: #ef4444;
          border: 1px solid rgba(239,68,68,.2);
          padding: 6px 10px;
          border-radius: 8px;
          margin-top: 6px;
        }
        .client-card {
          background: linear-gradient(135deg,rgba(0,212,255,.08),rgba(0,212,255,.02));
          border: 1px solid rgba(0,212,255,.2);
          border-radius: 12px;
          padding: 15px 18px;
          margin: 4px 0;
          font-size: 14px;
        }
        .cl-name {
          font-family: 'Syne',sans-serif;
          font-size: 16px;
          font-weight: 700;
          color: #00d4ff;
          margin-bottom: 10px;
        }
        .client-row {
          display: flex;
          gap: 8px;
          padding: 3px 0;
          align-items: flex-start;
        }
        .cl-label {
          color: #64748b;
          min-width: 90px;
          flex-shrink: 0;
          font-size: 13px;
        }
        .cl-val {
          color: #e2e8f0;
          font-size: 13px;
        }
        .proposal-btn {
          padding: 12px;
          border-radius: 10px;
          background: linear-gradient(135deg, #00d4ff, #0099bb);
          border: none;
          color: #fff;
          font-family: 'DM Mono', monospace;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          margin-top: 8px;
        }
        .section-divider {
          border: none;
          border-top: 1px solid var(--border);
          margin: 10px 0;
        }
      `}</style>
    </>
  );
}
