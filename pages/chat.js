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

  // Configuração (sem filtro de empresa por enquanto)
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

  // Verifica login
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        router.push('/');
      } else {
        loadConfig();
      }
    });
  }, [router]);

  // Carrega configurações (sem company_id por enquanto)
  const loadConfig = async () => {
    try {
      // Planos
      const { data: plansData } = await supabase.from('plans').select('*');
      
      // Produtos + preços
      const { data: productsData } = await supabase
        .from('products')
        .select('*, prices!inner(*)');

      // Vouchers
      const { data: vouchersData } = await supabase.from('vouchers').select('*');

      const newConfig = { ...configData };

      if (plansData) {
        newConfig.plans = plansData.map(p => ({
          id: p.internal_id || p.id,
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
          (prod.prices || []).forEach(price => {
            const planId = price.plan_id;
            if (planId) prices[key][planId] = [price.adesao, price.mensalidade];
          });
        });
        newConfig.prices = prices;
        newConfig.productNames = productNames;
      }

      if (vouchersData) newConfig.vouchers = vouchersData;

      setConfigData(newConfig);
      setConfigLoaded(true);
    } catch (error) {
      console.error(error);
      alert('Erro ao carregar configurações do Supabase. Verifique as tabelas.');
    }
  };

  // Rola para última mensagem
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const addMessage = (role, content, isHtml = false) => {
    setMessages(prev => [...prev, { role, content, isHtml }]);
  };

  // ==================== FUNÇÕES DE RENDER (mantidas) ====================
  const renderClientCard = (cd) => {
    const endFormatado = [cd.logradouro, cd.bairro, cd.municipio && cd.uf ? `${cd.municipio} – ${cd.uf}` : cd.municipio || cd.uf].filter(Boolean).join(', ');
    const cepFmt = cd.cep ? cd.cep.replace(/^(\d{5})(\d{3})$/, '$1-$2') : '';
    return `<div class="client-card">
      <div class="cl-name">${cd.fantasia || cd.nome || pricing.fmtDoc(cd.cnpj || '')}</div>
      ${cd.nome && cd.fantasia ? `<div class="client-row"><span class="cl-label">Razão Social</span><span class="cl-val">${cd.nome}</span></div>` : ''}
      ${cd.cnpj ? `<div class="client-row"><span class="cl-label">CNPJ</span><span class="cl-val">${pricing.fmtDoc(cd.cnpj)}</span></div>` : ''}
      ${endFormatado ? `<div class="client-row"><span class="cl-label">Endereço</span><span class="cl-val">${endFormatado}</span></div>` : ''}
      ${cepFmt ? `<div class="client-row"><span class="cl-label">CEP</span><span class="cl-val">${cepFmt}</span></div>` : ''}
      ${cd.telefone ? `<div class="client-row"><span class="cl-label">Telefone</span><span class="cl-val">${cd.telefone}</span></div>` : ''}
      ${cd.email ? `<div class="client-row"><span class="cl-label">E-mail</span><span class="cl-val">${cd.email}</span></div>` : ''}
    </div>`;
  };

  const renderFullPriceOnly = (data, dates) => {
    const { results, tAd, tMen } = data || { results: [], tAd: 0, tMen: 0 };
    let html = '';
    for (const r of results) {
      html += `<div class="price-card"><h4>🔹 ${r.name}</h4>`;
      if (!r.isTributos && !r.isEP) html += `<div class="price-row"><span class="label">Adesão</span><span class="val">${pricing.fmt(r.ad)}</span></div>`;
      html += `<div class="price-row"><span class="label">Mensalidade</span><span class="val">${pricing.fmt(r.men)}</span></div></div>`;
    }
    html += `<div class="price-card"><h4>🔸 Total</h4>
      <div class="price-row"><span class="label">Adesão total</span><span class="val">${pricing.fmt(tAd)}</span></div>
      <div class="price-row"><span class="label">Mensalidade total</span><span class="val">${pricing.fmt(tMen)}</span></div>
    </div>`;

    html += `<div class="teaser-card">
      <div class="teaser-title">🎫 Condições especiais disponíveis</div>
      <div class="teaser-body">Deseja ver os valores com desconto?</div>
      <div class="yn-row">
        <button class="yn-btn yes" data-action="discount-yes">✅ Sim, quero ver!</button>
        <button class="yn-btn no" data-action="discount-no">Não, obrigado</button>
      </div>
    </div>`;

    html += `<div style="display:flex;gap:12px;margin-top:12px;">
      <button class="proposal-btn" data-action="generate-proposta">📄 Gerar Proposta</button>
      <button class="proposal-btn" data-action="generate-contrato" style="background:linear-gradient(135deg,#fbbf24,#b45309);">📝 Gerar Contrato</button>
    </div>`;

    return html;
  };

  // (As outras funções renderWithDiscount e renderClosingResult podem ser adicionadas depois)

  // ProcessInput simplificado
  const processInput = async (text) => {
    const t = text.trim();

    if (stage === 'await_doc') {
      const doc = pricing.cleanDoc(t);
      if (!pricing.isCNPJ(doc) && !pricing.isCPF(doc)) {
        return { type: 'text', content: 'Informe o CPF ou CNPJ do cliente (apenas números).' };
      }

      let clientData = { cnpj: doc, nome: 'Cliente', fantasia: '' };
      if (pricing.isCNPJ(doc)) {
        const fetched = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${doc}`)
          .then(r => r.ok ? r.json() : null)
          .catch(() => null);
        if (fetched) clientData = { ...clientData, ...fetched, fantasia: fetched.nome_fantasia || fetched.razao_social };
      }

      setState(prev => ({ ...prev, doc, clientData }));
      setStage('await_users');

      return { 
        type: 'html', 
        content: renderClientCard(clientData) + `<div style="margin-top:15px;">Quantos usuários o cliente possui?</div>` 
      };
    }

    return { type: 'text', content: 'Etapa em desenvolvimento...' };
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

  // Event listener para botões
  useEffect(() => {
    const handleClick = (e) => {
      const btn = e.target.closest('button');
      if (!btn) return;
      if (btn.dataset.action === 'discount-yes') console.log('Desconto sim');
      if (btn.dataset.action === 'generate-proposta') console.log('Gerar proposta');
      if (btn.dataset.action === 'generate-contrato') console.log('Gerar contrato');
    };
    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, []);

  if (!configLoaded) {
    return <div style={{ padding: 80, textAlign: 'center', color: '#fff' }}>Carregando configurações...</div>;
  }

  return (
    <div style={{ maxWidth: 820, margin: '0 auto', padding: 20, background: '#0a0f1c', minHeight: '100vh', color: '#e2e8f0' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
        <h1>Assistente Comercial</h1>
        <button onClick={() => supabase.auth.signOut()} style={{ padding: '8px 16px', background: '#334155', border: 'none', borderRadius: 8, color: '#fff' }}>
          Sair
        </button>
      </div>

      <div style={{ height: '65vh', overflowY: 'auto', border: '1px solid #334155', borderRadius: 12, padding: 15, marginBottom: 15, background: '#111827' }}>
        {messages.map((msg, i) => (
          <div key={i} style={{ marginBottom: 15, textAlign: msg.role === 'user' ? 'right' : 'left' }}>
            <div style={{
              display: 'inline-block',
              padding: '12px 16px',
              borderRadius: 12,
              maxWidth: '85%',
              background: msg.role === 'user' ? '#3b82f6' : '#1f2937',
              color: msg.role === 'user' ? '#fff' : '#e2e8f0'
            }}>
              {msg.isHtml ? <div dangerouslySetInnerHTML={{ __html: msg.content }} /> : msg.content}
            </div>
          </div>
        ))}
        {loading && <div>Calculando...</div>}
        <div ref={messagesEndRef} />
      </div>

      <div style={{ display: 'flex', gap: 8 }}>
        <textarea
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), sendMessage())}
          placeholder="Digite o CNPJ ou CPF do cliente..."
          rows={2}
          style={{ flex: 1, padding: 12, borderRadius: 8, background: '#1f2937', border: '1px solid #475569', color: '#e2e8f0' }}
        />
        <button onClick={sendMessage} style={{ padding: '0 24px', background: '#00d4ff', color: '#000', border: 'none', borderRadius: 8, fontWeight: 'bold' }}>
          Enviar
        </button>
      </div>
    </div>
  );
}
