import { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useRouter } from 'next/router';
import * as pricing from '../lib/pricing';

// Dados iniciais (depois serão buscados do Supabase)
let configData = {
  plans: [
    { id: 'basic',   name: 'Basic',   maxCnpjs: 25,  users: 1,  unlimited: false },
    { id: 'pro',     name: 'Pro',     maxCnpjs: 80,  users: 1,  unlimited: false },
    { id: 'top',     name: 'Top',     maxCnpjs: 150, users: 5,  unlimited: false },
    { id: 'topplus', name: 'Top Plus',maxCnpjs: 999, users: 999, unlimited: true }
  ],
  productNames: {
    'Gestão Fiscal': 'Gestão Fiscal',
    'CND':           'CND',
    'XML':           'XML',
    'BIA':           'BIA',
    'IF':            'Inteligência Fiscal',
    'EP':            'e-PROCESSOS',
    'Tributos':      'Tributos'
  },
  prices: {
    'Gestão Fiscal': { basic: [478, 318], pro: [590, 409], top: [1032, 547], topplus: [1398, 679] },
    'CND':           { basic: [0, 48],    pro: [0, 90],    top: [0, 150],    topplus: [0, 200]    },
    'XML':           { basic: [478, 199], pro: [590, 299],  top: [1032, 349], topplus: [1398, 399] },
    'BIA':           { basic: [478, 129], pro: [590, 169],  top: [1032, 280], topplus: [1398, 299] },
    'IF':            { basic: [1600, 379], pro: [1600, 619], top: [1600, 920] },
    'EP':            { basic: [0, 39],    pro: [0, 82],     top: [0, 167]    }
  },
  discAdPct: 50,
  discMenPct: 0,
  discClosePct: 40,
  discMode: 'screen',
  unlimitedStrategy: true,
  vouchers: []
};

export default function Chat() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [stage, setStage] = useState('await_doc'); // estados do fluxo
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
    closingData: null,
    closingToday: null,
    appliedVoucher: null
  });
  const messagesEndRef = useRef(null);
  const router = useRouter();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) router.push('/');
    });
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const addMessage = (role, content, isHtml = false) => {
    setMessages(prev => [...prev, { role, content, isHtml }]);
  };

  // Função para renderizar os cards de preço (copiado do HTML)
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
    return html;
  };

  // Processamento das mensagens
  const processInput = async (text) => {
    const t = text.trim(), low = t.toLowerCase();
    if (stage === 'await_doc') {
      const doc = pricing.cleanDoc(t);
      if (!pricing.isCNPJ(doc) && !pricing.isCPF(doc)) {
        return { type: 'text', content: 'Por favor, informe o CPF ou CNPJ do cliente (somente números).' };
      }
      setState(prev => ({ ...prev, doc }));
      // Simula dados do cliente (depois vai buscar no Supabase)
      const clientData = { nome: 'Empresa Teste', fantasia: 'Teste LTDA', cnpj: doc };
      setState(prev => ({ ...prev, clientData }));
      setStage('await_users');
      return { type: 'html', content: `<div>${clientData.nome}</div><div style="margin-top:10px">Quantos <strong>usuários</strong> ele possui atualmente?</div>` };
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
      // Verifica se precisa de CNPJs
      const needsCNPJ = mods.some(m => !['IF','Tributos','EP'].includes(m));
      if (needsCNPJ && !state.cnpjs) {
        setStage('await_cnpjs');
        return { type: 'text', content: 'Quantos CNPJs o cliente possui?' };
      }
      // Se não precisar, avança
      return finalizeQuote();
    }
    if (stage === 'await_cnpjs') {
      const cnpjs = pricing.parseCNPJsQty(t);
      if (!cnpjs || cnpjs < 1) return { type: 'text', content: 'Quantos CNPJs? (informe um número)' };
      setState(prev => ({ ...prev, cnpjs }));
      return finalizeQuote();
    }
    // Se precisar de IFPlan
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
      // Determina o plano
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

    // Fallback
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

  return (
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

      {/* Incluir os estilos do HTML original (copiados) */}
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
        .yn-btn.yes:hover {
          background: rgba(16,185,129,.25);
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
      `}</style>
    </div>
  );
}
