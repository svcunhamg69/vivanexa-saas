// pages/api/leads/buscar-receita.js
// ═══════════════════════════════════════════════════════════════════════
// Gerador de Leads — Receita Federal via APIs GRATUITAS e REAIS
//
// FONTE PRINCIPAL: minhareceita.org
//   GET /?uf=MG&cnae_fiscal=6920601&municipio=3106200&limit=1000&cursor=xxx
//   - Busca paginada por UF + CNAE + município
//   - Gratuita, sem autenticação, sem rate limit oficial
//   - Dados atualizados mensalmente pela RFB
//
// ENRIQUECIMENTO: api.opencnpj.org
//   GET /https://api.opencnpj.org/{cnpj}
//   - 50 req/s por IP, sem auth
//   - Retorna telefone, e-mail, QSA, endereço completo
//
// FILTROS:
//   - situacao: 'ativa' | 'inativa' | 'todas'
//   - dataInicio: data mínima de abertura (YYYY-MM-DD) — filtra empresas novas
//   - cnaeManual: código CNAE informado pelo usuário (sobrepõe mapeamento auto)
// ═══════════════════════════════════════════════════════════════════════

const sleep = ms => new Promise(r => setTimeout(r, ms))

// ── Mapeamento nicho → CNAE fiscal ───────────────────────────────────
// Fonte: tabela CNAE 2.3 IBGE — https://cnae.ibge.gov.br
const NICHO_CNAE = {
  'contab':           ['6920601','6920602'],
  'contador':         ['6920601','6920602'],
  'escritorio contab':['6920601'],
  'auditoria':        ['6920601'],
  'fiscal':           ['6920601','6920602'],
  'advogad':          ['6911701','6911702'],
  'advocacia':        ['6911701','6911702'],
  'juridico':         ['6911701','6911702'],
  'notario':          ['6912500'],
  'cartorio':         ['6912500'],
  'dentist':          ['8630502','8630501'],
  'odontolog':        ['8630502','8630501'],
  'medico':           ['8630502','8630503','8630504','8630506'],
  'clinica':          ['8630502','8630503','8630504'],
  'hospital':         ['8610101','8610102'],
  'saude':            ['8630502','8630503','8650001'],
  'fisioterapia':     ['8650001','8650004'],
  'psicolog':         ['8650001','8650002'],
  'nutric':           ['8650001','8650006'],
  'farmacia':         ['4771701','4771702'],
  'drogar':           ['4771701'],
  'laboratorio':      ['8640202','8640203'],
  'optica':           ['4774100'],
  'otica':            ['4774100'],
  'restaurante':      ['5611201','5611202','5611203'],
  'lanchonete':       ['5611203'],
  'pizzaria':         ['5611202'],
  'padaria':          ['1091101','4721102'],
  'panificadora':     ['1091101'],
  'sorveteria':       ['5611203'],
  'escola':           ['8511200','8512100','8513900'],
  'colegio':          ['8511200','8512100'],
  'faculdade':        ['8532500','8533300'],
  'curso':            ['8599604','8599605','8599699'],
  'idioma':           ['8599604'],
  'cabeleirei':       ['9602501','9602502'],
  'salao':            ['9602501','9602502'],
  'barbear':          ['9602503'],
  'barbearia':        ['9602503'],
  'estetica':         ['9609202','9602501'],
  'academia':         ['9313100'],
  'fitness':          ['9313100'],
  'pilates':          ['9313100'],
  'petshop':          ['4789004','7500100'],
  'veterinar':        ['7500100'],
  'mecanica':         ['4520001','4520002','4520003'],
  'oficina':          ['4520001','4520002'],
  'autopecas':        ['4530701','4530703'],
  'imobili':          ['6821801','6821802'],
  'incorporadora':    ['4110700'],
  'construtora':      ['4110700','4120400'],
  'construcao':       ['4110700','4120400'],
  'tecnologia':       ['6201500','6202300','6209100'],
  'software':         ['6201500','6202300'],
  'informatica':      ['6201500','4751201'],
  'supermercado':     ['4711302','4711301'],
  'mercado':          ['4711302','4711301'],
  'hotel':            ['5510801','5510802'],
  'pousada':          ['5590601','5590602'],
  'turismo':          ['7911200','7912100'],
  'agencia viagem':   ['7911200','7912100'],
  'seguros':          ['6511101','6511102','6512000'],
  'consultoria':      ['7020400','6920601'],
  'marketing':        ['7319002','7319003'],
  'publicidade':      ['7311400','7312200'],
  'rh':               ['7810800','7820500'],
  'recrutamento':     ['7810800'],
  'engenharia':       ['7112000','7111100'],
  'arquitetura':      ['7111100'],
  'limpeza':          ['8121400','8122200'],
  'seguranca':        ['8011101','8011102'],
  'transporte':       ['4930201','4930202','4921301'],
  'logistica':        ['5229001','5229002'],
  'grafica':          ['1811301','1811302'],
  'fotografia':       ['7420001','7420002','7420003'],
  'decoracao':        ['4759801','4759899'],
  'reforma':          ['4330401','4330402','4330403'],
  'eletrica':         ['4321500'],
  'hidraulica':       ['4322301'],
  'jardinagem':       ['8130300'],
  'moveis':           ['4754701','4754702','4754703'],
  'joalheria':        ['4783102'],
  'optica':           ['4774100'],
  'padaria':          ['1091101','4721102'],
  'financeira':       ['6422100','6499901'],
  'contabilidade':    ['6920601','6920602'],
}

function normStr(s) {
  return String(s).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim()
}

function getCnaesParaNicho(nicho) {
  const t = normStr(nicho)
  const cnaeSet = new Set()
  for (const [key, codes] of Object.entries(NICHO_CNAE)) {
    const kn = normStr(key)
    if (t.includes(kn) || kn.includes(t) || (t.length >= 4 && kn.startsWith(t.slice(0,4))) || (kn.length >= 4 && t.startsWith(kn.slice(0,4)))) {
      codes.forEach(c => cnaeSet.add(c))
    }
  }
  return [...cnaeSet].slice(0, 6)
}

// ── Mapa código IBGE das principais cidades ───────────────────────────
// minhareceita usa código IBGE numérico para município
// Fonte parcial — cidades principais por UF
const CODIGO_IBGE = {
  // MG
  'belo horizonte': '3106200', 'uberlandia': '3170206', 'contagem': '3118601',
  'juiz de fora': '3136702', 'betim': '3106705', 'montes claros': '3143302',
  'ribeirão das neves': '3154507', 'uberaba': '3170107', 'ipatinga': '3131307',
  // SP
  'sao paulo': '3550308', 'guarulhos': '3518800', 'campinas': '3509502',
  'sao bernardo do campo': '3548708', 'santo andre': '3547809',
  'osasco': '3534401', 'ribeirao preto': '3543402', 'sorocaba': '3552205',
  'maua': '3529401', 'sao jose dos campos': '3549904',
  // RJ
  'rio de janeiro': '3304557', 'nova iguacu': '3303500', 'niteroi': '3303302',
  'duque de caxias': '3301702', 'sao goncalo': '3304904', 'campos dos goytacazes': '3301009',
  // RS
  'porto alegre': '4314902', 'caxias do sul': '4305108', 'canoas': '4304606',
  'pelotas': '4314407', 'santa maria': '4316907',
  // PR
  'curitiba': '4106902', 'londrina': '4113700', 'maringa': '4115200',
  'foz do iguacu': '4108304', 'cascavel': '4104808',
  // SC
  'florianopolis': '4205407', 'joinville': '4209102', 'blumenau': '4202404',
  // BA
  'salvador': '2927408', 'feira de santana': '2910800', 'vitoria da conquista': '2933307',
  // PE
  'recife': '2611606', 'caruaru': '2604106', 'olinda': '2609600',
  // CE
  'fortaleza': '2304400', 'caucaia': '2303709', 'juazeiro do norte': '2307304',
  // AM
  'manaus': '1302603',
  // PA
  'belem': '1501402', 'ananindeua': '1500800',
  // GO
  'goiania': '5208707', 'aparecida de goiania': '5201405', 'anapolis': '5201108',
  // DF
  'brasilia': '5300108',
  // ES
  'vitoria': '3205309', 'vila velha': '3205200', 'cariacica': '3201308',
  // MT
  'cuiaba': '5103403', 'varzea grande': '5108402',
  // MS
  'campo grande': '5002704', 'dourados': '5003702',
  // AL
  'maceio': '2704302',
  // RN
  'natal': '2408102', 'mossoro': '2408003',
  // PB
  'joao pessoa': '2507507', 'campina grande': '2504009',
  // SE
  'aracaju': '2800308',
  // PI
  'teresina': '2211001',
  // MA
  'sao luis': '2111300',
  // RO
  'porto velho': '1100205',
  // AC
  'rio branco': '1200401',
  // RR
  'boa vista': '1400100',
  // AP
  'macapa': '1600303',
  // TO
  'palmas': '1721000',
}

function getCodIbge(cidade) {
  if (!cidade) return null
  const key = normStr(cidade)
  return CODIGO_IBGE[key] || null
}

// ── minhareceita.org — busca paginada ────────────────────────────────
// GET /?uf=MG&cnae_fiscal=6920601&limit=1000&cursor=xxx
async function minhaReceitaBuscar({ cnae, uf, municipio, limit, cursor }) {
  const params = new URLSearchParams()
  params.set('uf',          uf.toUpperCase())
  params.set('cnae_fiscal', cnae)
  params.set('limit',       String(Math.min(limit || 1000, 1000)))
  if (municipio) params.set('municipio', municipio)
  if (cursor)    params.set('cursor',    cursor)

  const url = `https://minhareceita.org/?${params}`
  console.log('[minhareceita] GET', url)

  const r = await fetch(url, {
    headers: {
      'Accept':     'application/json',
      'User-Agent': 'Vivanexa-SaaS/2.0 (gerador-leads)',
    },
    signal: AbortSignal.timeout(30000),
  })

  if (!r.ok) {
    const txt = await r.text().catch(()=>'')
    console.error('[minhareceita] HTTP', r.status, txt.slice(0,200))
    return null
  }

  // Resposta: { data: [...], cursor: "..." }
  const d = await r.json()
  return d
}

// ── opencnpj.org — enriquecimento individual ─────────────────────────
// GET https://api.opencnpj.org/{cnpj}
// Rate limit: 50 req/s
async function enriquecerOpenCNPJ(cnpj) {
  try {
    const r = await fetch(`https://api.opencnpj.org/${cnpj}`, {
      headers: { 'User-Agent': 'Vivanexa-SaaS/2.0' },
      signal:  AbortSignal.timeout(8000),
    })
    if (r.status === 429) { await sleep(1000); return null }
    if (!r.ok) return null
    return await r.json()
  } catch { return null }
}

// ── Mapper minhareceita → lead ────────────────────────────────────────
function mapMinhareceita(emp) {
  // Campos retornados pela minhareceita:
  // cnpj, razao_social, nome_fantasia, situacao_cadastral,
  // data_inicio_atividade, cnae_fiscal, cnae_fiscal_descricao,
  // logradouro, numero, complemento, bairro, cep, uf, municipio,
  // email, telefone_1, telefone_2, qsa: [{ nome_socio, ... }]

  const cnpj = (emp.cnpj || '').replace(/\D/g,'')
  const tel1 = (emp.ddd_telefone_1 || emp.telefone_1 || '').replace(/\D/g,'')
  const tel2 = (emp.ddd_telefone_2 || emp.telefone_2 || '').replace(/\D/g,'')
  const tel  = tel1.length >= 10 ? tel1 : (tel2.length >= 10 ? tel2 : '')
  const socio = Array.isArray(emp.qsa) ? emp.qsa[0] : null

  return {
    id:          `rf_${cnpj}`,
    nome:        emp.razao_social  || '',
    fantasia:    emp.nome_fantasia || emp.razao_social || '',
    responsavel: socio?.nome_socio || socio?.nome || '',
    cnpj,
    telefone:    tel,
    email:       emp.email         || '',
    site:        '',
    logradouro:  [emp.descricao_tipo_logradouro, emp.logradouro].filter(Boolean).join(' ').trim(),
    numero:      emp.numero        || '',
    complemento: emp.complemento   || '',
    bairro:      emp.bairro        || '',
    cidade:      emp.municipio     || '',
    uf:          emp.uf            || '',
    cep:         (emp.cep || '').replace(/\D/g,''),
    atividade:   emp.cnae_fiscal_descricao || '',
    cnae:        String(emp.cnae_fiscal || ''),
    situacao:    emp.situacao_cadastral || '',
    dataInicio:  emp.data_inicio_atividade || '',
    capital:     emp.capital_social || '',
    porte:       emp.porte         || '',
    natureza:    emp.natureza_juridica || '',
    fonte:       'Receita Federal',
  }
}

// ── Mapper opencnpj → campos extras ──────────────────────────────────
function mapOpenCNPJ(d) {
  if (!d) return {}
  const tel    = (d.telefones || []).find(t => !t.is_fax)
  const fone   = tel ? `${tel.ddd}${tel.numero}`.replace(/\D/g,'') : ''
  const socio  = (d.QSA || [])[0]
  return {
    telefone:    fone,
    email:       d.email       || '',
    responsavel: socio?.nome_socio || '',
    logradouro:  d.logradouro  || '',
    numero:      d.numero      || '',
    complemento: d.complemento || '',
    bairro:      d.bairro      || '',
    cidade:      d.municipio   || '',
    uf:          d.uf          || '',
    cep:         (d.cep || '').replace(/\D/g,''),
    atividade:   d.cnae_fiscal_descricao || d.cnae_principal || '',
    situacao:    d.situacao_cadastral    || '',
    dataInicio:  d.data_inicio_atividade || '',
    capital:     d.capital_social || '',
    porte:       d.porte_empresa  || '',
    natureza:    d.natureza_juridica || '',
  }
}

// ── Handler ───────────────────────────────────────────────────────────
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método não permitido' })

  const {
    nicho,
    uf,
    cidade,
    bairro,
    logradouro,
    cnaeManual,          // código CNAE digitado diretamente pelo usuário
    situacaoFiltro,      // 'ativa' | 'inativa' | 'todas'
    dataInicioDe,        // YYYY-MM-DD — filtrar empresas abertas a partir desta data
    dataInicioAte,       // YYYY-MM-DD — filtrar empresas abertas até esta data
  } = req.body || {}

  if (!uf?.trim()) return res.status(400).json({ error: 'UF é obrigatória' })
  if (!nicho?.trim() && !cnaeManual?.trim()) return res.status(400).json({ error: 'Informe o nicho ou o código CNAE' })

  // Determinar CNAEs a buscar
  let cnaes = []
  if (cnaeManual?.trim()) {
    // Usuário informou CNAE diretamente — pode ser múltiplos separados por vírgula
    cnaes = cnaeManual.split(',').map(c => c.trim()).filter(Boolean).slice(0, 8)
  } else {
    cnaes = getCnaesParaNicho(nicho.trim())
  }

  console.log(`[leads] nicho="${nicho}" cnaeManual="${cnaeManual}" uf="${uf}" cidade="${cidade}" → CNAEs: ${cnaes.join(',')}`)

  if (cnaes.length === 0) {
    return res.status(200).json({
      resultados: [],
      cnaes:      [],
      aviso: `Nicho "${nicho}" não reconhecido no mapeamento de CNAEs.\n\nDigite o código CNAE diretamente no campo "CNAE" ou tente termos como:\ncontabilidade, advocacia, dentista, restaurante, farmácia, academia, clínica médica, imobiliária, escola, petshop, salão de beleza, barbearia, mecânica, hotel, tecnologia, psicólogo, nutricionista, engenharia, segurança, limpeza, marketing, consultoria, padaria, ótica, laboratório, turismo, seguro, supermercado, fisioterapia, construtora, gráfica, fotografia, logística, transportadora...`,
    })
  }

  const codIbge  = getCodIbge(cidade)
  const resultados  = []
  const cnpjsVistos = new Set()
  const erros       = []
  let   totalBruto  = 0

  for (const cnae of cnaes) {
    let cursor    = null
    let continuar = true
    let paginaNum = 1

    while (continuar) {
      try {
        const data = await minhaReceitaBuscar({
          cnae,
          uf:       uf.trim().toUpperCase(),
          municipio: codIbge || undefined,
          limit:    1000,
          cursor,
        })

        if (!data) {
          erros.push(`CNAE ${cnae}: sem resposta da minhareceita.org`)
          continuar = false
          break
        }

        const lista = data.data || []
        cursor      = data.cursor || null
        totalBruto += lista.length

        console.log(`[leads] CNAE=${cnae} pag=${paginaNum} → ${lista.length} registros (cursor=${cursor})`)

        for (const emp of lista) {
          const cnpj = (emp.cnpj || '').replace(/\D/g,'')
          if (!cnpj || cnpjsVistos.has(cnpj)) continue
          cnpjsVistos.add(cnpj)

          // ── Filtros ──────────────────────────────────────
          // Situação cadastral
          const situacaoEmp = normStr(emp.situacao_cadastral || '')
          if (situacaoFiltro === 'ativa'   && !situacaoEmp.includes('ativa'))   continue
          if (situacaoFiltro === 'inativa' && situacaoEmp.includes('ativa'))    continue

          // Filtro por data de abertura
          const dataEmp = emp.data_inicio_atividade || ''
          if (dataInicioDe && dataEmp && dataEmp < dataInicioDe) continue
          if (dataInicioAte && dataEmp && dataEmp > dataInicioAte) continue

          // Filtro por bairro/logradouro local
          if (bairro     && !(emp.bairro     ||'').toLowerCase().includes(bairro.toLowerCase()))     continue
          if (logradouro && !(emp.logradouro ||'').toLowerCase().includes(logradouro.toLowerCase())) continue

          const lead = mapMinhareceita(emp)

          // Enriquecer com opencnpj.org se faltar telefone ou e-mail
          if (!lead.telefone || !lead.email) {
            await sleep(25) // 25ms → ~40 req/s (dentro do limite de 50/s)
            const extra = await enriquecerOpenCNPJ(cnpj)
            if (extra) {
              const enr = mapOpenCNPJ(extra)
              if (!lead.telefone)    lead.telefone    = enr.telefone
              if (!lead.email)       lead.email       = enr.email
              if (!lead.responsavel) lead.responsavel = enr.responsavel
              if (!lead.logradouro)  lead.logradouro  = enr.logradouro
              if (!lead.bairro)      lead.bairro      = enr.bairro
              if (!lead.cidade)      lead.cidade      = enr.cidade
              if (!lead.cep)         lead.cep         = enr.cep
              if (!lead.atividade)   lead.atividade   = enr.atividade
              if (!lead.situacao)    lead.situacao     = enr.situacao
              if (!lead.dataInicio)  lead.dataInicio   = enr.dataInicio
              if (!lead.capital)     lead.capital      = enr.capital
              if (!lead.porte)       lead.porte        = enr.porte
            }
          }

          resultados.push(lead)
        }

        // Continuar se tiver cursor (mais páginas)
        continuar = !!cursor
        paginaNum++
        if (continuar) await sleep(300) // pausa entre páginas

      } catch (e) {
        console.error(`[leads] CNAE ${cnae} pag ${paginaNum}:`, e.message)
        erros.push(`CNAE ${cnae}: ${e.message}`)
        continuar = false
      }
    }

    await sleep(400) // pausa entre CNAEs diferentes
  }

  const aviso = resultados.length === 0
    ? [
        `Nenhuma empresa encontrada para "${nicho || cnaeManual}" em ${uf}${cidade ? ` / ${cidade}` : ''}.`,
        '',
        'Possíveis causas:',
        cidade && !codIbge ? `• Cidade "${cidade}" não encontrada no mapeamento IBGE — tente deixar o campo cidade vazio para buscar no estado todo` : null,
        `• CNAEs pesquisados: ${cnaes.join(', ')} — verifique se são corretos para o nicho`,
        totalBruto > 0 ? `• Foram encontrados ${totalBruto} registros brutos mas todos filtrados pelos critérios selecionados` : null,
        erros.length   ? `• Erros: ${erros.slice(0,2).join('; ')}` : null,
        '',
        'Dica: tente sem filtros de data e com situação "Todas", depois refine os resultados.',
      ].filter(l => l !== null).join('\n')
    : null

  return res.status(200).json({
    resultados,
    total:      resultados.length,
    totalBruto,
    cnaes,
    aviso,
    erros: erros.length ? erros : undefined,
  })
}
