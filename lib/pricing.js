// lib/pricing.js
// Funções auxiliares de formatação
export function fmt(n) {
  return 'R$ ' + n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// Função para obter o plano com base na quantidade de CNPJs
export function getPlan(cnpjs, plans) {
  const sorted = [...plans].sort((a,b) => a.maxCnpjs - b.maxCnpjs);
  for (let p of sorted) if (cnpjs <= p.maxCnpjs) return p.id;
  return sorted[sorted.length-1].id;
}

// Nome do plano
export function planLabel(id, plans) {
  if (!id) return '—';
  const p = plans.find(p => p.id === id);
  return p ? p.name : id;
}

// Nome exibido do produto
export function prodName(key, productNames) {
  if (!key) return key;
  return productNames[key] || key;
}

// Preço do módulo para determinado plano
export function getPriceForPlan(mod, planId, prices, plans) {
  const pricesMod = prices[mod];
  if (!pricesMod) return [0,0];
  if (pricesMod[planId]) return pricesMod[planId];
  const keyLower = planId.toLowerCase();
  for (let [k, v] of Object.entries(pricesMod)) {
    if (k.toLowerCase() === keyLower) return v;
  }
  const keys = Object.keys(pricesMod);
  if (keys.length) return pricesMod[keys[keys.length-1]];
  return [0,0];
}

// Cálculo de Tributos (simples)
export function calcTributos(notas) {
  if (!notas || notas <= 0) return 0;
  if (notas <= 50) return 169.90;
  if (notas <= 100) return 200;
  return 200 + (notas - 100) * 0.80;
}

// Cálculo da oferta cheia (sem desconto)
export function calcQuoteFullPrice(mods, planId, ifPlan, cnpjs, notas, config = {}) {
  const { prices = {}, plans = [], productNames = {} } = config;
  const results = [];
  let tAd = 0, tMen = 0;
  for (let mod of mods) {
    if (mod === 'IF') {
      const p = ifPlan || 'basic';
      const [aB, mB] = getPriceForPlan('IF', p, prices, plans);
      const ad = aB * 2, men = mB * 1.2;
      results.push({ name: prodName('IF', productNames), ad, men, adD: ad, menD: men, isPrepaid: true, plan: p, isIF: true });
      tAd += ad; tMen += men;
      continue;
    }
    if (mod === 'Tributos') {
      const m = calcTributos(notas);
      results.push({ name: prodName('Tributos', productNames), ad: 0, men: m, adD: 0, menD: m, isTributos: true, notas });
      tMen += m;
      continue;
    }
    if (mod === 'EP') {
      const epPlan = planId === 'topplus' ? 'top' : planId;
      const [, mB] = getPriceForPlan('EP', epPlan, prices, plans);
      const men = mB * 1.2;
      results.push({ name: prodName('EP', productNames), ad: 0, men, adD: 0, menD: men, isEP: true, plan: epPlan });
      tMen += men;
      continue;
    }
    const [aB, mB] = getPriceForPlan(mod, planId, prices, plans);
    let ad = aB > 0 ? Math.max(aB * 2, 1000) : 0;
    let men = mB * 1.2;
    if (mod === 'XML') men = Math.max(men, 175);
    if (mod === 'Gestão Fiscal') men = Math.max(men, 200);
    results.push({ name: prodName(mod, productNames), ad, men, adD: ad, menD: men, plan: planId });
    tAd += ad; tMen += men;
  }
  return { results, tAd, tMen, tAdD: tAd, tMenD: tMen };
}

// Cálculo com desconto (tela)
export function calcQuoteWithDiscount(mods, planId, ifPlan, cnpjs, notas, config = {}) {
  const { discAdPct = 50, discMenPct = 0, unlimitedStrategy = true, prices = {}, plans = [], productNames = {} } = config;
  const results = [];
  let tAd = 0, tMen = 0, tAdD = 0, tMenD = 0;
  for (let mod of mods) {
    if (mod === 'IF') {
      const p = ifPlan || 'basic';
      const [aB, mB] = getPriceForPlan('IF', p, prices, plans);
      const ad = aB * 2, men = mB * 1.2;
      const adD = aB, menD = mB;
      results.push({ name: prodName('IF', productNames), ad, men, adD, menD, isPrepaid: true, plan: p, isIF: true });
      tAd += ad; tMen += men; tAdD += adD; tMenD += menD;
      continue;
    }
    if (mod === 'Tributos') {
      const m = calcTributos(notas);
      results.push({ name: prodName('Tributos', productNames), ad: 0, men: m, adD: 0, menD: m, isTributos: true, notas });
      tMen += m; tMenD += m;
      continue;
    }
    if (mod === 'EP') {
      const epPlan = planId === 'topplus' ? 'top' : planId;
      const [, mB] = getPriceForPlan('EP', epPlan, prices, plans);
      const men = mB * 1.2, menD = mB;
      results.push({ name: prodName('EP', productNames), ad: 0, men, adD: 0, menD, isEP: true, plan: epPlan });
      tMen += men; tMenD += menD;
      continue;
    }
    const [aB, mB] = getPriceForPlan(mod, planId, prices, plans);
    let ad = aB > 0 ? Math.max(aB * 2, 1000) : 0;
    let men = mB * 1.2;
    if (mod === 'XML') men = Math.max(men, 175);
    if (mod === 'Gestão Fiscal') men = Math.max(men, 200);
    const adD = aB > 0 ? aB : 0;
    const menD = mB;
    results.push({ name: prodName(mod, productNames), ad, men, adD, menD, plan: planId });
    tAd += ad; tMen += men; tAdD += adD; tMenD += menD;
  }
  // Aplica descontos globais
  const discAd = discAdPct / 100;
  const discMen = discMenPct / 100;
  const tAdFinal = tAd * (1 - discAd);
  const tMenFinal = tMen * (1 - discMen);
  const tAdDFinal = tAdD * (1 - discAd);
  const tMenDFinal = tMenD * (1 - discMen);
  results.forEach(r => {
    if (!r.isTributos && !r.isEP) {
      r.ad = r.ad * (1 - discAd);
      r.adD = r.adD * (1 - discAd);
    }
    if (!r.isTributos && !r.isEP && !r.isIF) {
      r.men = r.men * (1 - discMen);
      r.menD = r.menD * (1 - discMen);
    }
  });
  return { results, tAd: tAdFinal, tMen: tMenFinal, tAdD: tAdDFinal, tMenD: tMenDFinal };
}

// Cálculo de fechamento (desconto extra na adesão)
export function calcClosing(mods, planId, ifPlan, cnpjs, notas, config = {}) {
  const { discClosePct = 40, unlimitedStrategy = true, prices = {}, plans = [], productNames = {} } = config;
  const results = [];
  let tAd = 0, tMen = 0;
  const cp = discClosePct / 100;
  for (let mod of mods) {
    if (mod === 'IF') {
      const p = ifPlan || 'basic';
      const [aB, mB] = getPriceForPlan('IF', p, prices, plans);
      const ad = aB * (1 - cp);
      results.push({ name: prodName('IF', productNames), ad, men: mB, isPrepaid: true, plan: p, isIF: true });
      tAd += ad; tMen += mB;
      continue;
    }
    if (mod === 'Tributos') {
      const m = calcTributos(notas);
      results.push({ name: prodName('Tributos', productNames), ad: 0, men: m, isTributos: true });
      tMen += m;
      continue;
    }
    if (mod === 'EP') {
      const epPlan = planId === 'topplus' ? 'top' : planId;
      const [, mB] = getPriceForPlan('EP', epPlan, prices, plans);
      results.push({ name: prodName('EP', productNames), ad: 0, men: mB, isEP: true, plan: epPlan });
      tMen += mB;
      continue;
    }
    const [aB] = getPriceForPlan(mod, planId, prices, plans);
    const ad = aB > 0 ? Math.max(aB * (1 - cp), 0) : 0;
    let men = 0;
    if (mod === 'BIA') men = 0.85 * (cnpjs || 0);
    else if (mod === 'CND') men = 0.40 * (cnpjs || 0);
    else if (mod === 'Gestão Fiscal') men = Math.max(2.00 * (cnpjs || 0), 200);
    else if (mod === 'XML') men = Math.max(1.75 * (cnpjs || 0), 175);
    results.push({ name: prodName(mod, productNames), ad, men, plan: planId });
    tAd += ad; tMen += men;
  }
  return { results, tAd, tMen };
}

// Funções de parse
export function cleanDoc(s) { return s.replace(/\D/g, ''); }
export function isCNPJ(s) { return s.length === 14; }
export function isCPF(s) { return s.length === 11; }
export function fmtDoc(s) {
  if (!s) return '—';
  if (s.length === 14) return s.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');
  if (s.length === 11) return s.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, '$1.$2.$3-$4');
  return s;
}

export function parseModules(text, productNames) {
  const t = text.toLowerCase();
  const found = [];
  const ifName = (productNames['IF'] || 'Inteligência Fiscal').toLowerCase();
  const hasIF = /intelig[eê]ncia\s*fiscal|intelig.*fiscal/i.test(t) || (ifName && t.includes(ifName));
  if (hasIF) found.push('IF');
  const tNoIF = t.replace(/intelig[eê]ncia\s*fiscal|intelig[\w\s]*fiscal/gi, '');
  const gfName = (productNames['Gestão Fiscal'] || '').toLowerCase();
  if (/gest[aã]o\s*(e\s*an[aá]lise|fiscal)/i.test(tNoIF) || (/\bfiscal\b/i.test(tNoIF) && !/intelig/i.test(tNoIF)) || (gfName && tNoIF.includes(gfName))) found.push('Gestão Fiscal');
  if (/\bbia\b/i.test(t)) found.push('BIA');
  if (/\bcnd\b/i.test(t)) found.push('CND');
  if (/\bxml\b/i.test(t)) found.push('XML');
  if (/tributos/i.test(t)) found.push('Tributos');
  const epName = (productNames['EP'] || '').toLowerCase();
  if (/e[\s-]?process[o]s?|eprocess/i.test(t) || (epName && t.includes(epName))) found.push('EP');
  return found;
}

export function parseIFPlan(text, plans) {
  const t = text.toLowerCase();
  for (let p of plans) {
    if (t.includes(p.name.toLowerCase()) || t.includes(p.id)) return p.id;
  }
  if (/\btop\b/i.test(t)) return 'top';
  if (/\bpro\b/i.test(t)) return 'pro';
  if (/\bbasic\b/i.test(t)) return 'basic';
  return null;
}

export function parseCNPJsQty(text) {
  const m = text.match(/\b(\d+)\s*(cnpj[s]?)?\b/i);
  return m ? parseInt(m[1]) : null;
}

export function parseUsers(text) {
  const m = text.match(/\b(\d+)\s*(usu[aá]rio[s]?)?\b/i);
  return m ? parseInt(m[1]) : null;
}

export function getNextDates() {
  const now = new Date(), day = now.getDate(), m = now.getMonth(), y = now.getFullYear();
  let tm, ty;
  if (day <= 20) {
    tm = m + 1; ty = y;
    if (tm > 11) { tm = 0; ty++; }
    return [5, 10, 15, 20, 25].map(d => `${String(d).padStart(2, '0')}/${String(tm+1).padStart(2, '0')}`);
  } else {
    tm = m + 2; ty = y;
    if (tm > 11) { tm -= 12; ty++; }
    return [5, 10, 15].map(d => `${String(d).padStart(2, '0')}/${String(tm+1).padStart(2, '0')}`);
  }
}

// Geração de voucher HTML para impressão
export function buildVoucherHTML(v, logo, today, eventLine) {
  return `<div style="background:#fff;font-family:Inter,sans-serif;border-radius:16px;overflow:hidden">
    <div style="background:linear-gradient(135deg,#0f172a 0%,#1e3a5f 60%,#0f4c75 100%);padding:32px 40px;text-align:center;position:relative">
      <img src="${logo}" style="height:50px;object-fit:contain;margin-bottom:12px;display:block;margin-left:auto;margin-right:auto">
      <div style="display:inline-block;background:rgba(0,212,255,.15);border:1px solid rgba(0,212,255,.3);color:#00d4ff;padding:4px 14px;border-radius:20px;font-size:11px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;margin-bottom:8px">Voucher de Desconto</div>
      ${eventLine?`<div style="font-family:Syne,sans-serif;font-size:18px;font-weight:700;color:#fff;margin-top:4px">${eventLine}</div>`:''}
    </div>
    <div style="padding:32px 40px;text-align:center">
      <div style="font-size:12px;color:#64748b;text-transform:uppercase;letter-spacing:1px;margin-bottom:16px">Benefícios incluídos</div>
      <div style="display:flex;gap:14px;justify-content:center;flex-wrap:wrap;margin-bottom:24px">
        ${v.discAdPct>0?`<div style="background:linear-gradient(135deg,#f0fdf4,#dcfce7);border:2px solid #10b981;border-radius:14px;padding:14px 26px;text-align:center"><div style="font-family:Syne,sans-serif;font-size:34px;font-weight:800;color:#10b981;line-height:1">${v.discAdPct}%</div><div style="font-size:11px;color:#065f46;margin-top:4px;font-weight:700;text-transform:uppercase;letter-spacing:.8px">na Adesão</div></div>`:''}
        ${v.discMenPct>0?`<div style="background:linear-gradient(135deg,#f0fdf4,#dcfce7);border:2px solid #10b981;border-radius:14px;padding:14px 26px;text-align:center"><div style="font-family:Syne,sans-serif;font-size:34px;font-weight:800;color:#10b981;line-height:1">${v.discMenPct}%</div><div style="font-size:11px;color:#065f46;margin-top:4px;font-weight:700;text-transform:uppercase;letter-spacing:.8px">na Mensalidade</div></div>`:''}
        ${!v.discAdPct&&!v.discMenPct?`<div style="font-size:14px;color:#64748b">Desconto especial — consulte seu consultor</div>`:''}
      </div>
      <div style="background:linear-gradient(135deg,#1e293b,#0f172a);border-radius:14px;padding:22px;margin-bottom:22px">
        <div style="font-size:11px;color:#64748b;letter-spacing:2px;text-transform:uppercase;margin-bottom:10px">Código do Voucher</div>
        <div style="font-family:Syne,sans-serif;font-size:26px;font-weight:800;color:#00d4ff;letter-spacing:6px;word-break:break-all">${v.code}</div>
      </div>
      <div style="font-size:11px;color:#94a3b8;line-height:1.6;border-top:1px solid #f1f5f9;padding-top:16px">
        Válido para contratação de novos serviços.<br>
        Apresente este voucher ao seu consultor para aplicar o desconto.<br>
        Gerado em ${today} · Uso único.
      </div>
    </div>
    <div style="background:#f8fafc;padding:14px 40px;display:flex;justify-content:space-between;align-items:center;font-size:11px;color:#94a3b8;border-top:1px solid #e2e8f0">
      <div style="font-weight:700;color:#1e293b">Empresa</div>
      <div>www.vivanexa.com.br</div>
    </div>
  </div>`;
}
