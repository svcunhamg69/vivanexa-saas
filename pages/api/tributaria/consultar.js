// pages/api/tributaria/consultar.js
// ✅ Consulta tributária completa: NCM, EAN, Descrição
// ✅ Dados: PIS/COFINS, IPI, ICMS, CBS, IBS, IS, CFOP, CEST, CST
// ✅ APIs: BrasilAPI, Bluesoft Cosmos, Siscomex, IBPT
// ✅ Suporte a lote (array de itens)

export const config = { api: { bodyParser: { sizeLimit: '5mb' } } }

// ─── Alíquotas ICMS internas por UF ──────────────────────────────────────────
const ICMS_UF = {
  AC:19, AL:19, AM:20, AP:18, BA:20.5, CE:20, DF:20, ES:17,
  GO:17, MA:22, MG:20, MS:17, MT:17, PA:19, PB:20, PE:20.5,
  PI:21, PR:19.5, RJ:20, RN:20, RO:17.5, RR:20, RS:17,
  SC:17, SE:19, SP:18, TO:20,
}

// ─── FCP por UF (Fundo de Combate à Pobreza) ─────────────────────────────────
const FCP_UF = {
  AL:2, AM:2, BA:2, CE:2, MA:2, MG:2, PA:2, PB:2,
  PE:2, PI:2, RJ:2, RN:2, SE:2, TO:2,
}

// ─── CFOP padrão por tipo de operação e regime ───────────────────────────────
const CFOP_MAP = {
  varejo:     { entrada: '1403', saida: '5405' },
  atacadista: { entrada: '1102', saida: '5102' },
  industria:  { entrada: '1101', saida: '5101' },
  servicos:   { entrada: '1933', saida: '5933' },
  importador: { entrada: '3102', saida: '5102' },
}

// ─── Base NCM local com dados completos ──────────────────────────────────────
const NCM_FISCAL = {
  '22021000': {
    descricao: 'Refrigerante em lata / Água mineral sem gás',
    ipi: 0, cst_ipi_saida: '53', cst_ipi_entrada: '03', tipi: 'REFRIGERANTE EM LATA',
    pis_saida: 0, cofins_saida: 0, cst_pis_saida: '06', cst_cofins_saida: '06',
    cst_pis_entrada: '73', cst_cofins_entrada: '73',
    nri: '918', amparo_legal_pis: 'Lei n 13.097/2015, Art. 28',
    natureza_receita: '918 - Receita decorrente da venda de bebidas frias a consumidor final',
    cest: '03.010.02', st_todos_estados: true,
    red_bc_icms: 0, iva: 0, fcp: 2,
    cbs: { cst: '000', aliquota: 0.9, reducao: 0, vigencia_inicio: '01/01/2026', vigencia_fim: '31/12/2026', classtrib: '000001', desc_classtrib: 'SITUACOES TRIBUTADAS INTEGRALMENTE PELO IBS E CBS.', desc_cst: 'TRIBUTACAO INTEGRAL', amparo_legal: 'LEI COMPLEMENTAR Nº 214, DE 16 DE JANEIRO DE 2025' },
    ibs: { cst: '000', aliq_estadual: 0.1, aliq_municipal: 0, reducao: 0, vigencia_inicio: '01/01/2026', vigencia_fim: '31/12/2026', classtrib: '000001', desc_classtrib: 'SITUACOES TRIBUTADAS INTEGRALMENTE PELO IBS E CBS.', desc_cst: 'TRIBUTACAO INTEGRAL', amparo_legal: 'LEI COMPLEMENTAR Nº 214, DE 16 DE JANEIRO DE 2025' },
    is: { cst: null, aliquota: null, anexo: null, classtrib: null, desc_classtrib: null, desc_cst: null, amparo_legal: 'LEI COMPLEMENTAR Nº 214, DE 16 DE JANEIRO DE 2025' },
  },
  '84713012': {
    descricao: 'Notebook / Laptop / Computador portátil',
    ipi: 0, cst_ipi_saida: '52', cst_ipi_entrada: '02', tipi: 'NOTEBOOK / LAPTOP',
    pis_saida: 1.65, cofins_saida: 7.6, cst_pis_saida: '01', cst_cofins_saida: '01',
    cst_pis_entrada: '50', cst_cofins_entrada: '50',
    nri: null, amparo_legal_pis: 'Leis 10.637/2002 e 10.833/2003',
    cest: null, st_todos_estados: false,
    red_bc_icms: 0, iva: 0, fcp: 0,
    cbs: { cst: '000', aliquota: 0.9, reducao: 0, vigencia_inicio: '01/01/2026', vigencia_fim: '31/12/2026', classtrib: '000001', desc_classtrib: 'SITUACOES TRIBUTADAS INTEGRALMENTE PELO IBS E CBS.', desc_cst: 'TRIBUTACAO INTEGRAL', amparo_legal: 'LEI COMPLEMENTAR Nº 214, DE 16 DE JANEIRO DE 2025' },
    ibs: { cst: '000', aliq_estadual: 0.1, aliq_municipal: 0, reducao: 0, vigencia_inicio: '01/01/2026', vigencia_fim: '31/12/2026', classtrib: '000001', desc_classtrib: 'SITUACOES TRIBUTADAS INTEGRALMENTE PELO IBS E CBS.', desc_cst: 'TRIBUTACAO INTEGRAL', amparo_legal: 'LEI COMPLEMENTAR Nº 214, DE 16 DE JANEIRO DE 2025' },
    is: { cst: null, aliquota: null, anexo: null, classtrib: null, desc_classtrib: null, desc_cst: null, amparo_legal: 'LEI COMPLEMENTAR Nº 214, DE 16 DE JANEIRO DE 2025' },
  },
  '85171210': {
    descricao: 'Smartphone / Telefone celular',
    ipi: 8, cst_ipi_saida: '50', cst_ipi_entrada: '00', tipi: 'APARELHOS TELEFÔNICOS - SMARTPHONES',
    pis_saida: 1.65, cofins_saida: 7.6, cst_pis_saida: '01', cst_cofins_saida: '01',
    cst_pis_entrada: '50', cst_cofins_entrada: '50',
    nri: null, amparo_legal_pis: 'Leis 10.637/2002 e 10.833/2003',
    cest: '21.059.00', st_todos_estados: true,
    red_bc_icms: 0, iva: 0, fcp: 0,
    cbs: { cst: '000', aliquota: 0.9, reducao: 0, vigencia_inicio: '01/01/2026', vigencia_fim: '31/12/2026', classtrib: '000001', desc_classtrib: 'SITUACOES TRIBUTADAS INTEGRALMENTE PELO IBS E CBS.', desc_cst: 'TRIBUTACAO INTEGRAL', amparo_legal: 'LEI COMPLEMENTAR Nº 214, DE 16 DE JANEIRO DE 2025' },
    ibs: { cst: '000', aliq_estadual: 0.1, aliq_municipal: 0, reducao: 0, vigencia_inicio: '01/01/2026', vigencia_fim: '31/12/2026', classtrib: '000001', desc_classtrib: 'SITUACOES TRIBUTADAS INTEGRALMENTE PELO IBS E CBS.', desc_cst: 'TRIBUTACAO INTEGRAL', amparo_legal: 'LEI COMPLEMENTAR Nº 214, DE 16 DE JANEIRO DE 2025' },
    is: { cst: null, aliquota: null, anexo: null, classtrib: null, desc_classtrib: null, desc_cst: null, amparo_legal: 'LEI COMPLEMENTAR Nº 214, DE 16 DE JANEIRO DE 2025' },
  },
  '10063021': {
    descricao: 'Arroz beneficiado / Arroz polido',
    ipi: 0, cst_ipi_saida: '53', cst_ipi_entrada: '03', tipi: 'ARROZ BENEFICIADO',
    pis_saida: 0, cofins_saida: 0, cst_pis_saida: '07', cst_cofins_saida: '07',
    cst_pis_entrada: '70', cst_cofins_entrada: '70',
    nri: null, amparo_legal_pis: 'Lei 10.925/2004, Art. 1º - Cesta básica',
    cest: '13.001.00', st_todos_estados: false,
    red_bc_icms: 30, iva: 0, fcp: 0,
    cbs: { cst: '040', aliquota: 0, reducao: 100, vigencia_inicio: '01/01/2026', vigencia_fim: '31/12/2026', classtrib: '000040', desc_classtrib: 'CESTA BASICA - OPERACOES COM REDUCAO DE 100%.', desc_cst: 'REDUCAO 100% DA BASE DE CALCULO', amparo_legal: 'LEI COMPLEMENTAR Nº 214, DE 16 DE JANEIRO DE 2025' },
    ibs: { cst: '040', aliq_estadual: 0, aliq_municipal: 0, reducao: 100, vigencia_inicio: '01/01/2026', vigencia_fim: '31/12/2026', classtrib: '000040', desc_classtrib: 'CESTA BASICA - OPERACOES COM REDUCAO DE 100%.', desc_cst: 'REDUCAO 100% DA BASE DE CALCULO', amparo_legal: 'LEI COMPLEMENTAR Nº 214, DE 16 DE JANEIRO DE 2025' },
    is: { cst: null, aliquota: null, anexo: null, classtrib: null, desc_classtrib: null, desc_cst: null, amparo_legal: 'LEI COMPLEMENTAR Nº 214, DE 16 DE JANEIRO DE 2025' },
  },
  '30049099': {
    descricao: 'Medicamentos / Produtos farmacêuticos',
    ipi: 0, cst_ipi_saida: '53', cst_ipi_entrada: '03', tipi: 'MEDICAMENTOS',
    pis_saida: 0, cofins_saida: 0, cst_pis_saida: '07', cst_cofins_saida: '07',
    cst_pis_entrada: '70', cst_cofins_entrada: '70',
    nri: null, amparo_legal_pis: 'Lei 10.147/2000 - Medicamentos',
    cest: '13.023.00', st_todos_estados: true,
    red_bc_icms: 0, iva: 0, fcp: 0,
    cbs: { cst: '000', aliquota: 0.9, reducao: 0, vigencia_inicio: '01/01/2026', vigencia_fim: '31/12/2026', classtrib: '000001', desc_classtrib: 'SITUACOES TRIBUTADAS INTEGRALMENTE PELO IBS E CBS.', desc_cst: 'TRIBUTACAO INTEGRAL', amparo_legal: 'LEI COMPLEMENTAR Nº 214, DE 16 DE JANEIRO DE 2025' },
    ibs: { cst: '000', aliq_estadual: 0.1, aliq_municipal: 0, reducao: 0, vigencia_inicio: '01/01/2026', vigencia_fim: '31/12/2026', classtrib: '000001', desc_classtrib: 'SITUACOES TRIBUTADAS INTEGRALMENTE PELO IBS E CBS.', desc_cst: 'TRIBUTACAO INTEGRAL', amparo_legal: 'LEI COMPLEMENTAR Nº 214, DE 16 DE JANEIRO DE 2025' },
    is: { cst: null, aliquota: null, anexo: null, classtrib: null, desc_classtrib: null, desc_cst: null, amparo_legal: 'LEI COMPLEMENTAR Nº 214, DE 16 DE JANEIRO DE 2025' },
  },
}

// ─── Helpers de API ───────────────────────────────────────────────────────────
async function fetchBrasilApiNCM(ncm) {
  try {
    const clean = ncm.replace(/\D/g, '')
    const r = await fetch(`https://brasilapi.com.br/api/ncm/v1/${clean}`, { signal: AbortSignal.timeout(8000) })
    if (!r.ok) return null
    return await r.json()
  } catch { return null }
}

async function fetchBrasilApiNCMSearch(descricao) {
  try {
    const r = await fetch(`https://brasilapi.com.br/api/ncm/v1?search=${encodeURIComponent(descricao)}`, { signal: AbortSignal.timeout(8000) })
    if (!r.ok) return null
    const d = await r.json()
    return Array.isArray(d) ? d : null
  } catch { return null }
}

async function fetchCosmos(ean) {
  try {
    const r = await fetch(`https://cosmos.bluesoft.com.br/products/${ean}`, {
      headers: { 'X-Cosmos-Token': 'demo', 'User-Agent': 'Vivanexa-SaaS/2.0' },
      signal: AbortSignal.timeout(8000),
    })
    if (!r.ok) return null
    return await r.json()
  } catch { return null }
}

async function fetchOpenFoodFacts(ean) {
  try {
    const r = await fetch(`https://world.openfoodfacts.org/api/v0/product/${ean}.json`, { signal: AbortSignal.timeout(6000) })
    if (!r.ok) return null
    const d = await r.json()
    if (d.status !== 1) return null
    return { description: d.product?.product_name_pt || d.product?.product_name || null, ncm: null }
  } catch { return null }
}

async function fetchSiscomexNCM(ncm) {
  try {
    const clean = ncm.replace(/\D/g, '')
    const r = await fetch(
      `https://portalunico.siscomex.gov.br/classif/api/publico/nomenclatura/download/json`,
      { signal: AbortSignal.timeout(15000) }
    )
    if (!r.ok) return null
    const lista = await r.json()
    return lista?.find(i => i.Codigo?.replace(/\D/g,'') === clean) || null
  } catch { return null }
}

// ─── Monta resultado completo ─────────────────────────────────────────────────
function montarDados({ ncmCodigo, descricao, uf, regime, tipoNegocio, apiIPI, fonteNcm, fonteEan, ean }) {
  const ncmClean = String(ncmCodigo || '').replace(/\D/g,'')
  const local    = NCM_FISCAL[ncmClean] || {}
  const cfops    = CFOP_MAP[tipoNegocio] || CFOP_MAP.varejo
  const icmsAliq = ICMS_UF[uf] || 18
  const fcp      = FCP_UF[uf] || 0

  // ── IPI
  const ipi = apiIPI !== undefined && apiIPI !== null ? apiIPI : (local.ipi ?? 0)

  // ── PIS/COFINS por regime
  let pis_saida, cofins_saida, cst_pis_saida, cst_cofins_saida, cst_pis_entrada, cst_cofins_entrada, amparo_pis
  if (regime === 'simples' || regime === 'mei') {
    pis_saida = 0; cofins_saida = 0
    cst_pis_saida = '07'; cst_cofins_saida = '07'
    cst_pis_entrada = '70'; cst_cofins_entrada = '70'
    amparo_pis = 'PIS/COFINS incluídos no DAS – LC 123/2006'
  } else if (regime === 'real' || tipoNegocio === 'industria') {
    pis_saida    = local.pis_saida    ?? 1.65
    cofins_saida = local.cofins_saida ?? 7.6
    cst_pis_saida    = local.cst_pis_saida    || '01'
    cst_cofins_saida = local.cst_cofins_saida || '01'
    cst_pis_entrada    = local.cst_pis_entrada    || '50'
    cst_cofins_entrada = local.cst_cofins_entrada || '50'
    amparo_pis = local.amparo_legal_pis || 'Regime não cumulativo – Leis 10.637/2002 e 10.833/2003'
  } else {
    pis_saida    = local.pis_saida    !== undefined ? local.pis_saida    : 0.65
    cofins_saida = local.cofins_saida !== undefined ? local.cofins_saida : 3
    cst_pis_saida    = local.cst_pis_saida    || '01'
    cst_cofins_saida = local.cst_cofins_saida || '01'
    cst_pis_entrada    = local.cst_pis_entrada    || '50'
    cst_cofins_entrada = local.cst_cofins_entrada || '50'
    amparo_pis = local.amparo_legal_pis || 'Regime cumulativo – Lei 9.718/1998'
  }

  // ── ICMS
  const red_bc_icms = local.red_bc_icms ?? 0
  const icms_efetivo = icmsAliq * (1 - red_bc_icms / 100)
  const temST = local.st_todos_estados || false
  const csosn = regime === 'simples' || regime === 'mei'
    ? (temST ? '500' : '102')
    : null
  const cst_icms_saida  = temST ? '10' : '00'
  const cst_icms_entrada = temST ? '70' : '00'
  const amparo_icms = `BASE LEGAL ALÍQUOTA: RICMS/${uf}. BASE LEGAL IVA: RICMS/${uf}, ANEXO XV.`

  // ── CBS / IBS / IS (Reforma Tributária - LC 214/2025)
  const cbs = local.cbs || {
    cst: '000', aliquota: 0.9, reducao: 0,
    vigencia_inicio: '01/01/2026', vigencia_fim: '31/12/2026',
    classtrib: '000001',
    desc_classtrib: 'SITUACOES TRIBUTADAS INTEGRALMENTE PELO IBS E CBS.',
    desc_cst: 'TRIBUTACAO INTEGRAL',
    amparo_legal: 'LEI COMPLEMENTAR Nº 214, DE 16 DE JANEIRO DE 2025',
  }
  const ibs = local.ibs || {
    cst: '000', aliq_estadual: 0.1, aliq_municipal: 0, reducao: 0,
    vigencia_inicio: '01/01/2026', vigencia_fim: '31/12/2026',
    classtrib: '000001',
    desc_classtrib: 'SITUACOES TRIBUTADAS INTEGRALMENTE PELO IBS E CBS.',
    desc_cst: 'TRIBUTACAO INTEGRAL',
    amparo_legal: 'LEI COMPLEMENTAR Nº 214, DE 16 DE JANEIRO DE 2025',
  }
  const is = local.is || {
    cst: null, aliquota: null, anexo: null,
    classtrib: null, desc_classtrib: null, desc_cst: null,
    amparo_legal: 'LEI COMPLEMENTAR Nº 214, DE 16 DE JANEIRO DE 2025',
  }

  return {
    ncm: ncmCodigo || 'N/D',
    descricao: descricao || local.descricao || 'Produto não identificado',
    ean: ean || null,
    uf, regime, tipoNegocio,
    fonte: { ncm: fonteNcm || 'base_local', ean: fonteEan || null },

    pis_cofins: {
      pis: Number((pis_saida || 0).toFixed(2)),
      cofins: Number((cofins_saida || 0).toFixed(2)),
      cst_entrada: cst_pis_entrada,
      cst_saida: cst_pis_saida,
      cfop_entrada: cfops.entrada,
      cfop_saida: cfops.saida,
      nri: local.nri || null,
      amparo_legal: amparo_pis,
      natureza_receita: local.natureza_receita || null,
      medicamento: local.medicamento || 'N',
      medicamento_lista: null,
      medicamento_tipo: null,
      uso_veterinario: 'N',
    },

    ipi: {
      aliquota: Number((ipi || 0).toFixed(2)),
      cod_enq: local.cod_enq || null,
      cst_saida: local.cst_ipi_saida || '99',
      cst_entrada: local.cst_ipi_entrada || '49',
      ex: null,
      tipi: local.tipi || descricao?.toUpperCase() || '',
    },

    icms: {
      aliquota: Number(icms_efetivo.toFixed(2)),
      cst_csosn: csosn || cst_icms_saida,
      cfop_entrada: cfops.entrada,
      cfop_saida: cfops.saida,
      cest: local.cest || null,
      red_bc: red_bc_icms,
      red_bc_st: 0,
      iva: local.iva || 0,
      fcp: fcp,
      cod_beneficio: null,
      antecipado: 'N',
      diferido: 'Não',
      diferimento_pct: 0,
      desonerado: null,
      desonerado_pct: 0,
      isencao_pct: 0,
      amparo_legal: amparo_icms,
      cest_descricao: descricao || local.descricao || null,
      tem_st: temST,
      pdv: {
        cfop_entrada: null, cfop_saida: null,
        cest: local.cest || null, cst_csosn: csosn || '00',
        aliquota: 0, red_bc: null, red_bc_st: null, iva: 0,
        fcp: null, cod_beneficio: null, antecipado: null,
        diferido: null, diferimento_pct: null, desonerado: null,
        desonerado_pct: null, isencao_pct: null, simb_pdv: 'F',
      },
    },

    cbs,
    ibs,
    is,
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// HANDLER
// ═════════════════════════════════════════════════════════════════════════════
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método não permitido' })

  try {
    const { tipo, busca, uf = 'SP', regime = 'presumido', tipoNegocio = 'varejo', lote } = req.body

    // ── LOTE ─────────────────────────────────────────────────────────────────
    if (lote && Array.isArray(lote)) {
      const resultados = []
      for (const item of lote.slice(0, 200)) {
        const termoBruto = String(item.ncm || item.ean || item.descricao || item || '').trim()
        if (!termoBruto) { resultados.push({ input: item, erro: 'Vazio' }); continue }

        const tipoItem = item.ncm ? 'ncm' : item.ean ? 'ean' : 'descricao'
        const result = await consultarUnico({ tipo: tipoItem, busca: termoBruto, uf, regime, tipoNegocio })
        resultados.push({ input: termoBruto, tipo: tipoItem, ...result })

        // Rate limit mínimo
        await new Promise(r => setTimeout(r, 80))
      }
      return res.status(200).json({ lote: resultados })
    }

    // ── INDIVIDUAL ───────────────────────────────────────────────────────────
    if (!busca || !tipo) return res.status(400).json({ error: 'busca e tipo são obrigatórios' })
    const result = await consultarUnico({ tipo, busca: String(busca).trim(), uf, regime, tipoNegocio })
    return res.status(200).json(result)

  } catch (err) {
    console.error('[Tributaria]', err)
    return res.status(500).json({ error: err.message || 'Erro interno' })
  }
}

// ─── Consulta individual ──────────────────────────────────────────────────────
async function consultarUnico({ tipo, busca, uf, regime, tipoNegocio }) {
  const termo = busca.replace(/[.\-\/\s]/g, '')

  // ────────────── NCM ───────────────────────────────────────────────────────
  if (tipo === 'ncm') {
    // 1. Base local
    const local = NCM_FISCAL[termo]
    if (local) {
      const d = montarDados({ ncmCodigo: busca, descricao: local.descricao, uf, regime, tipoNegocio, fonteNcm: 'base_local' })
      return { success: true, single: true, data: d }
    }

    // 2. BrasilAPI
    const api = await fetchBrasilApiNCM(termo)
    if (api?.codigo) {
      const d = montarDados({ ncmCodigo: api.codigo, descricao: api.descricao, uf, regime, tipoNegocio, apiIPI: api.aliquota_ipi ?? null, fonteNcm: 'brasilapi' })
      return { success: true, single: true, data: d }
    }

    return { success: false, erro: 'NCM não encontrado. Verifique o código.' }
  }

  // ────────────── EAN ───────────────────────────────────────────────────────
  if (tipo === 'ean') {
    let descricao = null, ncmCode = null, fonteEan = null

    // 1. Cosmos
    const cosmos = await fetchCosmos(termo)
    if (cosmos && (cosmos.description || cosmos.descricao)) {
      descricao = cosmos.description || cosmos.descricao
      ncmCode   = cosmos.ncm?.code || cosmos.ncm?.codigo || null
      fonteEan  = 'cosmos'
    }

    // 2. Fallback Open Food Facts
    if (!descricao) {
      const off = await fetchOpenFoodFacts(termo)
      if (off?.description) { descricao = off.description; fonteEan = 'openfoodfacts' }
    }

    if (!descricao) return { success: false, erro: 'Produto não encontrado pelo código de barras.' }

    const ncmClean = ncmCode ? String(ncmCode).replace(/\D/g,'') : null
    let ipiApi = null

    // Se temos NCM, busca dados fiscais
    if (ncmClean) {
      const apiNcm = await fetchBrasilApiNCM(ncmClean)
      if (apiNcm) ipiApi = apiNcm.aliquota_ipi ?? null
    }

    const d = montarDados({ ncmCodigo: ncmCode || 'N/D', descricao, uf, regime, tipoNegocio, apiIPI: ipiApi, fonteNcm: ncmClean ? 'brasilapi' : null, fonteEan, ean: termo })
    return { success: true, single: true, data: d }
  }

  // ────────────── DESCRIÇÃO ─────────────────────────────────────────────────
  if (tipo === 'descricao') {
    // 1. BrasilAPI search
    const lista = await fetchBrasilApiNCMSearch(busca)
    if (lista && lista.length > 0) {
      if (lista.length === 1) {
        const item = lista[0]
        const ncmC = item.codigo?.replace(/\D/g,'')
        const local2 = NCM_FISCAL[ncmC] || {}
        const d = montarDados({ ncmCodigo: item.codigo, descricao: item.descricao, uf, regime, tipoNegocio, fonteNcm: 'brasilapi' })
        return { success: true, single: true, data: d }
      }
      // Múltiplos → retorna lista
      return { success: true, single: false, lista: lista.slice(0, 20).map(i => ({ codigo: i.codigo, descricao: i.descricao })) }
    }

    // 2. Fallback base local
    const t = busca.toLowerCase()
    const achado = Object.entries(NCM_FISCAL).find(([, v]) => v.descricao.toLowerCase().includes(t))
    if (achado) {
      const [ncmKey, local3] = achado
      const d = montarDados({ ncmCodigo: local3.ncm || ncmKey, descricao: local3.descricao, uf, regime, tipoNegocio, fonteNcm: 'base_local' })
      return { success: true, single: true, data: d }
    }

    return { success: false, erro: 'Nenhum produto encontrado. Tente NCM ou código de barras.' }
  }

  return { success: false, erro: 'Tipo de busca inválido.' }
}
