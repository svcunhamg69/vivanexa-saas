// pages/api/leads/buscar-receita.js
// ═══════════════════════════════════════════════════════════════════════════
// Estratégia de busca na Receita Federal (dados abertos):
//
// A Receita Federal NÃO tem endpoint de busca por texto/nicho gratuito.
// O que existe:
//   1. open.cnpja.com/office/{cnpj}  → consulta por CNPJ individual (gratuita)
//   2. CNPJ.ws → consulta por CNPJ individual (gratuita, 3 req/min)
//   3. Dados abertos RFB (arquivo mensal CSV) → requer download e indexação local
//   4. casadosdados.com.br → API pública com busca por município + CNAE (gratuita limitada)
//   5. receitaws.com.br → apenas CNPJ individual
//
// NOSSA SOLUÇÃO:
//   - Usa casadosdados.com.br/api/v1/search para buscar por município + CNAE
//     (dados da própria RFB, atualizados, gratuitos com limite de 10 req/s)
//   - Fallback: minhareceita.org (se tiver endpoint de busca)
//   - Enriquece cada CNPJ com open.cnpja.com para dados completos (telefone, sócios, e-mail)
//   - Rate limiting inteligente entre chamadas
// ═══════════════════════════════════════════════════════════════════════════

const sleep = ms => new Promise(r => setTimeout(r, ms))

// ── Mapa nicho → CNAE codes ──────────────────────────────────────────────
const NICHO_CNAE = {
  contabilid:    ['6920601','6920602'],
  contador:      ['6920601','6920602'],
  escritório:    ['6920601'],
  advocacia:     ['6911701','6911702','6912500'],
  advogad:       ['6911701','6911702'],
  dentist:       ['8630502','8630501'],
  odontolog:     ['8630502'],
  restaurante:   ['5611201','5611202','5611203'],
  lanchonete:    ['5611203'],
  alimentaç:     ['5611201','5611202','5611203'],
  farmácia:      ['4771701','4771702'],
  farmacia:      ['4771701','4771702'],
  drogar:        ['4771701'],
  academia:      ['9313100'],
  fitness:       ['9313100'],
  palest:        ['9313100'],
  médico:        ['8630502','8630503','8630504'],
  medico:        ['8630502','8630503','8630504'],
  clínica:       ['8630502','8630503','8630504'],
  clinica:       ['8630502','8630503'],
  saúde:         ['8630502','8630503','8630504','8650001'],
  imobili:       ['6821801','6821802'],
  corretora:     ['6821801'],
  supermercado:  ['4711302','4711301'],
  mercado:       ['4711302','4711301'],
  escola:        ['8511200','8512100','8513900'],
  educaç:        ['8511200','8512100','8520100'],
  ensino:        ['8511200','8512100','8513900'],
  petshop:       ['7500100','4789099'],
  veterinár:     ['7500100'],
  cabeleirei:    ['9602501','9602502'],
  salão:         ['9602501','9602502'],
  beleza:        ['9602501','9602502','9602503'],
  barbearia:     ['9602503'],
  mecânica:      ['4520001','4520002','4520003'],
  mecanica:      ['4520001','4520002','4520003'],
  oficina:       ['4520001','4520002'],
  hotel:         ['5510801','5510802'],
  pousada:       ['5590601','5590602'],
  hospeda:       ['5510801','5590601'],
  tecnologia:    ['6201500','6202300','6209100'],
  software:      ['6201500','6202300'],
  desenvolvimen: ['6201500','6202300'],
  ti:            ['6201500','6202300','6203100'],
  engenharia:    ['7112000','7111100'],
  construção:    ['4110700','4120400'],
  construtora:   ['4110700','4120400'],
  transporte:    ['4930201','4930202','4921301'],
  logística:     ['5229001','5229002'],
  segurança:     ['8011101','8011102'],
  limpeza:       ['8121400','8122200'],
  marketing:     ['7319002','7319003'],
  publicidade:   ['7311400','7312200'],
  psicolog:      ['8650001','8650002','8650003'],
  nutricion:     ['8650001','8650006'],
  fisioterapia:  ['8650001','8650004'],
  laboratório:   ['8640202','8640203'],
  laboratorio:   ['8640202','8640203'],
  joalheria:     ['4783102'],
  ótica:         ['4774100'],
  otica:         ['4774100'],
  relojoaria:    ['4783101'],
  padaria:       ['1091101','4721102'],
  panificadora:  ['1091101'],
  autopeças:     ['4530701','4530703'],
  autopecas:     ['4530701','4530703'],
  elétrica:      ['4321500'],
  eletrica:      ['4321500'],
  hidráulica:    ['4322301'],
  hidraulica:    ['4322301'],
  pintura:       ['4330404'],
  reforma:       ['4330401','4330402','4330403'],
  gráfica:       ['1811301','1811302'],
  grafica:       ['1811301','1811302'],
  floricultura:  ['4789003'],
  decoração:     ['4759801','4759899'],
  decoracao:     ['4759801','4759899'],
  móveis:        ['4754701','4754702','4754703'],
  moveis:        ['4754701','4754702','4754703'],
  colchão:       ['4754703'],
  eletrodoméstico:['4753900'],
  eletrodomestico:['4753900'],
  informática:   ['4751200'],
  informatica:   ['4751200'],
  celular:       ['4752100','4759899'],
  fotografia:    ['7420001','7420002','7420003'],
  turismo:       ['7911200','7912100'],
  viagem:        ['7911200','7912100'],
  agência:       ['7311400','7912100','6110803'],
  agencia:       ['7311400','7912100'],
  seguros:       ['6511101','6511102','6512000'],
  seguradora:    ['6511101','6511102'],
  banco:         ['6422100','6421200'],
  financeira:    ['6422100','6499901'],
  cooperativa:   ['6430100','6432800'],
  plano:         ['6511101','6512000'],
  odontológico:  ['6512000'],
  contabilidade: ['6920601','6920602'],
  auditoria:     ['6920601'],
  consultoria:   ['7020400','6920601'],
  rh:            ['7810800','7820500'],
  recrutamento:  ['7810800'],
}

function getCnaesParaNicho(nicho) {
  const t = nicho.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'')
  const cnaeSet = new Set()
  for (const [key, codes] of Object.entries(NICHO_CNAE)) {
    const kNorm = key.normalize('NFD').replace(/[\u0300-\u036f]/g,'')
    if (t.includes(kNorm) || kNorm.includes(t.slice(0,5))) {
      codes.forEach(c => cnaeSet.add(c))
    }
  }
  return [...cnaeSet]
}

// ── API casadosdados.com.br ──────────────────────────────────────────────
// Endpoint público: GET https://api.casadosdados.com.br/v2/public/cnpj/search
// Aceita: municipio, uf, cnae_fiscal, situacao_cadastral=ATIVA, page
async function buscarCasaDados({ cnae, uf, cidade, bairro, pagina = 1 }) {
  const body = {
    query: {
      municipio:          cidade ? [cidade.toUpperCase()] : undefined,
      uf:                 [uf],
      situacao_cadastral: 'ATIVA',
      cnae_fiscal_principal: { key: [cnae] },
    },
    range_query: { data_inicio_atividade: { lte: new Date().toISOString().slice(0,10) } },
    extras: { somente_mei: false, excluir_mei: false, com_email: false, incluir_atividade_secundaria: false, com_contato_telefonico: false, somente_fixo: false, somente_celular: false, somente_matriz: false },
    page: pagina,
  }
  // Remove undefined
  Object.keys(body.query).forEach(k => body.query[k] === undefined && delete body.query[k])

  const r = await fetch('https://api.casadosdados.com.br/v2/public/cnpj/search', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(body),
    signal:  AbortSignal.timeout(20000),
  })

  if (!r.ok) return null
  const d = await r.json()
  return d
}

// ── Enriquecer CNPJ com open.cnpja.com ───────────────────────────────────
async function enriquecerCNPJ(cnpj) {
  try {
    const r = await fetch(`https://open.cnpja.com/office/${cnpj.replace(/\D/g,'')}`, {
      signal: AbortSignal.timeout(12000),
    })
    if (!r.ok) return null
    return await r.json()
  } catch { return null }
}

// ── Mapear resultado casadosdados → lead ─────────────────────────────────
function mapCasaDados(emp) {
  const cnpj = (emp.cnpj || '').replace(/\D/g,'')
  const fone = (emp.ddd_telefone_1 || emp.telefone || '').replace(/\D/g,'')
  return {
    id:          `rf_${cnpj||Date.now()}`,
    nome:        emp.razao_social || '',
    fantasia:    emp.nome_fantasia || emp.razao_social || '',
    responsavel: emp.qsa?.[0]?.nome_socio || '',
    cnpj,
    telefone:    fone,
    email:       emp.email || '',
    site:        '',
    logradouro:  [emp.descricao_tipo_logradouro, emp.logradouro].filter(Boolean).join(' '),
    numero:      emp.numero || '',
    complemento: emp.complemento || '',
    bairro:      emp.bairro || '',
    cidade:      emp.municipio || '',
    uf:          emp.uf || '',
    cep:         (emp.cep || '').replace(/\D/g,''),
    atividade:   emp.cnae_fiscal_descricao || '',
    fonte:       'Receita Federal',
  }
}

// ── Mapear resultado open.cnpja.com → lead ────────────────────────────────
function mapOpenCnpja(d, cnpjBase) {
  const company = d.company || d
  const address = d.address || {}
  const phones  = company.phones || d.phones || []
  const emails  = company.emails || d.emails || []
  const fone    = (phones[0]?.number || '').replace(/\D/g,'')
  const email   = emails[0]?.address || ''
  const socios  = company.members || d.members || []
  return {
    id:          `rf_${cnpjBase}`,
    nome:        company.name  || d.razao_social  || '',
    fantasia:    company.alias || d.nome_fantasia  || company.name || '',
    responsavel: socios[0]?.person?.name          || socios[0]?.nome_socio || '',
    cnpj:        cnpjBase,
    telefone:    fone,
    email,
    site:        '',
    logradouro:  address.street  || '',
    numero:      address.number  || '',
    complemento: address.details || '',
    bairro:      address.district|| '',
    cidade:      address.city    || '',
    uf:          address.state   || '',
    cep:         (address.zip    || '').replace(/\D/g,''),
    atividade:   company.primary_activity?.text || '',
    fonte:       'Receita Federal',
  }
}

// ── Handler principal ─────────────────────────────────────────────────────
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método não permitido' })

  const { nicho, uf, cidade, bairro, logradouro } = req.body

  if (!nicho?.trim()) return res.status(400).json({ error: 'Nicho é obrigatório' })
  if (!uf?.trim())    return res.status(400).json({ error: 'UF é obrigatória' })

  // Buscar CNAEs para o nicho informado
  const cnaes = getCnaesParaNicho(nicho.trim())

  if (cnaes.length === 0) {
    return res.status(200).json({
      resultados: [],
      aviso: `Nicho "${nicho}" não mapeado para código CNAE.\n\nTente termos como: contabilidade, advocacia, dentista, restaurante, farmácia, academia, clínica, imobiliária, escola, petshop, salão, mecânica, hotel, tecnologia, psicólogo, nutricionista, engenharia, segurança, limpeza, marketing, consultoria, padaria, ótica, laboratório, turismo, seguro, etc.`,
      cnaes: [],
    })
  }

  const resultados = []
  const cnpjsVistos = new Set()

  // Para cada CNAE encontrado, buscar no casadosdados
  for (const cnae of cnaes.slice(0, 5)) { // máximo 5 CNAEs para não explodir rate limit
    let pagina = 1
    let temMais = true

    while (temMais) {
      try {
        const data = await buscarCasaDados({ cnae, uf: uf.trim(), cidade: cidade?.trim(), bairro: bairro?.trim(), pagina })

        if (!data) { temMais = false; break }

        const lista = data.data || data.cnpj || []
        const total = data.count || data.total || lista.length

        for (const emp of lista) {
          const cnpj = (emp.cnpj || '').replace(/\D/g,'')
          if (!cnpj || cnpjsVistos.has(cnpj)) continue
          cnpjsVistos.add(cnpj)

          // Filtro local de bairro/logradouro
          if (bairro     && !(emp.bairro     || '').toLowerCase().includes(bairro.toLowerCase()))     continue
          if (logradouro && !(emp.logradouro || '').toLowerCase().includes(logradouro.toLowerCase())) continue

          const lead = mapCasaDados(emp)

          // Enriquecer com open.cnpja.com se telefone/email estão vazios
          if (!lead.telefone && !lead.email) {
            await sleep(220) // 220ms entre chamadas → ~4.5 req/s (limite é 5/s)
            const enrich = await enriquecerCNPJ(cnpj)
            if (enrich) {
              const enriched = mapOpenCnpja(enrich, cnpj)
              lead.telefone    = enriched.telefone    || lead.telefone
              lead.email       = enriched.email       || lead.email
              lead.responsavel = enriched.responsavel || lead.responsavel
              lead.site        = enriched.site        || lead.site
              lead.logradouro  = lead.logradouro      || enriched.logradouro
              lead.bairro      = lead.bairro          || enriched.bairro
              lead.cidade      = lead.cidade          || enriched.cidade
              lead.cep         = lead.cep             || enriched.cep
            }
          }

          resultados.push(lead)
        }

        // Verifica se tem mais páginas
        const porPagina = lista.length
        temMais = porPagina >= 20 && resultados.length < Math.min(total, 2000)
        pagina++
        if (temMais) await sleep(300) // respeita rate limit casadosdados
      } catch (e) {
        console.error('[buscar-receita] erro pagina', pagina, e.message)
        temMais = false
      }
    }

    await sleep(400) // pausa entre CNAEs
  }

  return res.status(200).json({
    resultados,
    total: resultados.length,
    cnaes,
    aviso: resultados.length === 0
      ? `Nenhuma empresa encontrada para "${nicho}" em ${uf}${cidade ? ` / ${cidade}` : ''}.\n\nPossíveis causas:\n• O município deve ser informado em MAIÚSCULAS (ex: "SAO PAULO" não "São Paulo") — tente deixar o campo cidade vazio para busca no estado todo.\n• O nicho pode não ter empresas ativas nesta localização.\n• A casadosdados pode estar temporariamente indisponível.`
      : null,
  })
}
