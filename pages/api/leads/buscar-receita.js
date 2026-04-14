// pages/api/leads/buscar-receita.js
// ═══════════════════════════════════════════════════════════════════════
// Gerador de Leads — Receita Federal (Dados Abertos)
//
// Fontes usadas (em ordem de prioridade):
//  1. casadosdados.com.br — busca por CNAE + UF + município (gratuita)
//  2. receitaws.com.br    — fallback por CNPJ individual (gratuita)
//  3. open.cnpja.com      — enriquecimento de dados (gratuita, sem auth)
//
// IMPORTANTE: A Receita Federal não tem API de busca textual gratuita.
// A busca é feita por CÓDIGO CNAE (atividade econômica) mapeado do nicho.
// ═══════════════════════════════════════════════════════════════════════

const sleep = ms => new Promise(r => setTimeout(r, ms))

// ── Mapeamento nicho → CNAEs da Receita Federal ──────────────────────
// Fonte: tabela CNAE 2.3 — https://cnae.ibge.gov.br
const NICHO_CNAE = {
  // Serviços contábeis
  'contab':        ['6920601','6920602'],
  'contador':      ['6920601','6920602'],
  'escritorio contab': ['6920601'],
  'auditoria':     ['6920601'],
  'fiscal':        ['6920601','6920602'],
  // Jurídico
  'advogad':       ['6911701','6911702'],
  'advocacia':     ['6911701','6911702'],
  'juridico':      ['6911701','6911702'],
  'notario':       ['6912500'],
  'cartorio':      ['6912500'],
  // Saúde / Médico
  'dentist':       ['8630502','8630501'],
  'odontolog':     ['8630502','8630501'],
  'medico':        ['8630502','8630503','8630504','8630506'],
  'clinica':       ['8630502','8630503','8630504'],
  'hospital':      ['8610101','8610102'],
  'saude':         ['8630502','8630503','8630504','8650001'],
  'fisioterapia':  ['8650001','8650004'],
  'psicolog':      ['8650001','8650002'],
  'nutric':        ['8650001','8650006'],
  'farmacia':      ['4771701','4771702'],
  'drogar':        ['4771701'],
  'laboratorio':   ['8640202','8640203'],
  'laborat':       ['8640202','8640203'],
  'optica':        ['4774100'],
  'otica':         ['4774100'],
  // Alimentação
  'restaurante':   ['5611201','5611202','5611203'],
  'lanchonete':    ['5611203'],
  'pizzaria':      ['5611202'],
  'bar ':          ['5611201','5611202'],
  'cafe ':         ['5611201'],
  'padaria':       ['1091101','4721102'],
  'panificadora':  ['1091101'],
  'sorveteria':    ['5611203'],
  'doceria':       ['5611203','4721104'],
  // Educação
  'escola':        ['8511200','8512100','8513900'],
  'colegio':       ['8511200','8512100'],
  'faculdade':     ['8532500','8533300'],
  'universidade':  ['8532500'],
  'curso':         ['8599604','8599605','8599699'],
  'idioma':        ['8599604'],
  'cursinhos':     ['8599699'],
  // Beleza / Estética
  'cabeleirei':    ['9602501','9602502'],
  'salao':         ['9602501','9602502'],
  'barbear':       ['9602503'],
  'barbearia':     ['9602503'],
  'estetica':      ['9609202','9602501'],
  'manicure':      ['9602502'],
  'spa':           ['9609202'],
  // Fitness
  'academia':      ['9313100'],
  'fitness':       ['9313100'],
  'pilates':       ['9313100'],
  'crossfit':      ['9313100'],
  // Animal
  'petshop':       ['4789004','7500100'],
  'veterinar':     ['7500100'],
  'canil':         ['0162803'],
  // Automóveis / Veículos
  'mecanica':      ['4520001','4520002','4520003'],
  'oficina':       ['4520001','4520002'],
  'autopecas':     ['4530701','4530703'],
  'concession':    ['4511101','4511102'],
  'lava rapido':   ['4520008'],
  'funilaria':     ['4520007'],
  // Imóveis
  'imobili':       ['6821801','6821802'],
  'corretora imov':['6821801'],
  'incorporadora': ['4110700'],
  'construtora':   ['4110700','4120400'],
  'construcao':    ['4110700','4120400'],
  // Tecnologia
  'tecnologia':    ['6201500','6202300','6209100'],
  'software':      ['6201500','6202300'],
  'informatica':   ['6201500','4751201','4751202'],
  'desenvolvimen': ['6201500','6202300'],
  'suporte ti':    ['6203100','6209100'],
  // Varejo / Comércio
  'supermercado':  ['4711302','4711301'],
  'mercado':       ['4711302','4711301'],
  'farmacia':      ['4771701','4771702'],
  'livraria':      ['4761003'],
  'moveis':        ['4754701','4754702','4754703'],
  'eletrodomest':  ['4753900'],
  'celular':       ['4752100'],
  'vestuario':     ['4781400','4782201'],
  'calcado':       ['4782202','4783101'],
  'joalheria':     ['4783102'],
  'brinquedo':     ['4763602'],
  'esporte':       ['4763604'],
  // Serviços gerais
  'limpeza':       ['8121400','8122200'],
  'seguranca':     ['8011101','8011102'],
  'transporte':    ['4930201','4930202','4921301'],
  'logistica':     ['5229001','5229002'],
  'mudanca':       ['4924800'],
  'grafica':       ['1811301','1811302'],
  'fotografia':    ['7420001','7420002','7420003'],
  'decoracao':     ['4759801','4759899'],
  'reforma':       ['4330401','4330402','4330403','4330404'],
  'eletrica':      ['4321500'],
  'hidraulica':    ['4322301'],
  'pintura':       ['4330404'],
  'jardinagem':    ['8130300'],
  // Hotelaria / Turismo
  'hotel':         ['5510801','5510802'],
  'pousada':       ['5590601','5590602'],
  'turismo':       ['7911200','7912100'],
  'agencia viagem':['7911200','7912100'],
  // Financeiro / Seguros
  'seguros':       ['6511101','6511102','6512000'],
  'segurador':     ['6511101','6511102'],
  'financeira':    ['6422100','6499901'],
  'consorcio':     ['6622300'],
  // Consultoria / Negócios
  'consultoria':   ['7020400','6920601'],
  'marketing':     ['7319002','7319003'],
  'publicidade':   ['7311400','7312200'],
  'rh':            ['7810800','7820500'],
  'recrutamento':  ['7810800'],
  'contabilidade': ['6920601','6920602'],
  // Engenharia / Arquitetura
  'engenharia':    ['7112000','7111100'],
  'arquitetura':   ['7111100'],
  // Religiosos / Sociais
  'igreja':        ['9491000'],
  'ong':           ['9430800','8730101'],
}

function normStr(s) {
  return s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim()
}

function getCnaesParaNicho(nicho) {
  const t = normStr(nicho)
  const cnaeSet = new Set()
  // Busca exata primeiro
  for (const [key, codes] of Object.entries(NICHO_CNAE)) {
    const kn = normStr(key)
    if (t.includes(kn) || kn.includes(t) || kn.startsWith(t.slice(0,4)) || t.startsWith(kn.slice(0,4))) {
      codes.forEach(c => cnaeSet.add(c))
    }
  }
  return [...cnaeSet].slice(0, 8) // máximo 8 CNAEs por busca
}

// ── casadosdados.com.br — estrutura correta do body ──────────────────
async function casaDadosBuscar({ cnae, uf, cidade, pagina }) {
  // Estrutura exata documentada em https://casadosdados.com.br/api/v2
  const body = {
    query: {
      uf: [uf.toUpperCase()],
      cnae_fiscal_principal: { key: [cnae] },
      situacao_cadastral: 'ATIVA',
      ...(cidade ? { municipio: [normalizarCidade(cidade)] } : {}),
    },
    range_query: {},
    extras: {
      somente_mei:                false,
      excluir_mei:                false,
      com_email:                  false,
      incluir_atividade_secundaria: false,
    },
    page: pagina,
  }

  const r = await fetch('https://api.casadosdados.com.br/v2/public/cnpj/search', {
    method:  'POST',
    headers: {
      'Content-Type': 'application/json',
      'User-Agent':   'Vivanexa-SaaS/2.0',
      'Origin':       'https://casadosdados.com.br',
      'Referer':      'https://casadosdados.com.br/',
    },
    body:   JSON.stringify(body),
    signal: AbortSignal.timeout(25000),
  })

  if (!r.ok) {
    console.error('[casadados] HTTP', r.status, await r.text().catch(()=>''))
    return null
  }

  const d = await r.json()
  // A resposta tem: { data: [...], count: N }
  return d
}

// Normaliza cidade para o formato que a casadosdados espera (uppercase sem acento)
function normalizarCidade(cidade) {
  return cidade.toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'')
}

// ── Enriquecimento via open.cnpja.com (gratuito, sem auth) ───────────
async function enriquecerCNPJ(cnpj) {
  try {
    const r = await fetch(`https://open.cnpja.com/office/${cnpj}`, {
      headers: { 'User-Agent': 'Vivanexa-SaaS/2.0' },
      signal:  AbortSignal.timeout(10000),
    })
    if (!r.ok) return null
    return await r.json()
  } catch { return null }
}

// ── Mappers ───────────────────────────────────────────────────────────
function mapCasaDados(emp) {
  // Estrutura retornada pela casadosdados:
  // { cnpj, razao_social, nome_fantasia, cnae_fiscal_descricao,
  //   uf, municipio, bairro, logradouro, numero, complemento, cep,
  //   ddd_telefone_1, ddd_telefone_2, email, qsa: [...] }
  const cnpj = (emp.cnpj || '').replace(/\D/g,'')
  const tel1 = (emp.ddd_telefone_1 || '').replace(/\D/g,'')
  const tel2 = (emp.ddd_telefone_2 || '').replace(/\D/g,'')
  const tel  = tel1.length >= 10 ? tel1 : tel2.length >= 10 ? tel2 : ''
  const socio = Array.isArray(emp.qsa) ? emp.qsa[0] : null

  return {
    id:          `rf_${cnpj}`,
    nome:        emp.razao_social    || '',
    fantasia:    emp.nome_fantasia   || emp.razao_social || '',
    responsavel: socio?.nome_socio   || socio?.nome || '',
    cnpj,
    telefone:    tel,
    email:       emp.email           || '',
    site:        '',
    logradouro:  [emp.descricao_tipo_logradouro, emp.logradouro].filter(Boolean).join(' ').trim(),
    numero:      emp.numero          || '',
    complemento: emp.complemento     || '',
    bairro:      emp.bairro          || '',
    cidade:      emp.municipio       || '',
    uf:          emp.uf              || '',
    cep:         (emp.cep || '').replace(/\D/g,''),
    atividade:   emp.cnae_fiscal_descricao || '',
    fonte:       'Receita Federal',
  }
}

function mapOpenCnpja(d) {
  if (!d) return {}
  const company = d.company || {}
  const address = d.address || {}
  const phones  = [...(company.phones || []), ...(d.phones || [])]
  const emails  = [...(company.emails || []), ...(d.emails || [])]
  const members = [...(company.members || []), ...(d.members || [])]
  const tel     = (phones[0]?.number || '').replace(/\D/g,'')
  return {
    telefone:    tel,
    email:       emails[0]?.address || '',
    site:        company.website || d.website || '',
    responsavel: members[0]?.person?.name || members[0]?.name || '',
    logradouro:  address.street   || '',
    numero:      address.number   || '',
    complemento: address.details  || '',
    bairro:      address.district || '',
    cidade:      address.city     || '',
    uf:          address.state    || '',
    cep:         (address.zip || '').replace(/\D/g,''),
    atividade:   company.primary_activity?.text || '',
  }
}

// ── Handler principal ─────────────────────────────────────────────────
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método não permitido' })

  const { nicho, uf, cidade, bairro, logradouro } = req.body || {}

  if (!nicho?.trim()) return res.status(400).json({ error: 'Nicho é obrigatório' })
  if (!uf?.trim())    return res.status(400).json({ error: 'UF é obrigatória' })

  const cnaes = getCnaesParaNicho(nicho.trim())
  console.log(`[leads] nicho="${nicho}" uf="${uf}" cidade="${cidade}" → CNAEs: ${cnaes.join(',')}`)

  if (cnaes.length === 0) {
    return res.status(200).json({
      resultados: [],
      cnaes: [],
      aviso: `Nicho "${nicho}" não reconhecido. Tente: contabilidade, advocacia, dentista, restaurante, farmácia, academia, clínica médica, imobiliária, escola, petshop, salão de beleza, mecânica, hotel, tecnologia, psicólogo, nutricionista, engenharia, segurança, limpeza, marketing, consultoria, padaria, ótica, laboratório, turismo, seguro, supermercado, academia, fisioterapia, barbearia, veterinária, decoração, construtora, gráfica, fotografia, logística, transportadora...`,
    })
  }

  const resultados = []
  const cnpjsVistos = new Set()
  const erros = []

  for (const cnae of cnaes) {
    let pagina = 1
    let continuar = true

    while (continuar) {
      try {
        const data = await casaDadosBuscar({
          cnae,
          uf:     uf.trim().toUpperCase(),
          cidade: cidade?.trim() || '',
          pagina,
        })

        if (!data) {
          erros.push(`CNAE ${cnae}: sem resposta da casadosdados`)
          continuar = false
          break
        }

        const lista = data.data || []
        const totalDisponivel = data.count || 0

        console.log(`[leads] CNAE=${cnae} pag=${pagina} retornou ${lista.length} (total=${totalDisponivel})`)

        for (const emp of lista) {
          const cnpj = (emp.cnpj || '').replace(/\D/g,'')
          if (!cnpj || cnpjsVistos.has(cnpj)) continue
          cnpjsVistos.add(cnpj)

          // Filtro local por bairro/logradouro se informados
          if (bairro && !(emp.bairro||'').toLowerCase().includes(bairro.toLowerCase())) continue
          if (logradouro && !(emp.logradouro||'').toLowerCase().includes(logradouro.toLowerCase())) continue

          const lead = mapCasaDados(emp)

          // Enriquecer com open.cnpja.com somente se faltar dados importantes
          if (!lead.telefone || !lead.email) {
            await sleep(250)
            const extra = await enriquecerCNPJ(cnpj)
            if (extra) {
              const enr = mapOpenCnpja(extra)
              if (!lead.telefone)    lead.telefone    = enr.telefone
              if (!lead.email)       lead.email       = enr.email
              if (!lead.site)        lead.site        = enr.site
              if (!lead.responsavel) lead.responsavel = enr.responsavel
              if (!lead.logradouro)  lead.logradouro  = enr.logradouro
              if (!lead.bairro)      lead.bairro      = enr.bairro
              if (!lead.cep)         lead.cep         = enr.cep
              if (!lead.atividade)   lead.atividade   = enr.atividade
            }
          }

          resultados.push(lead)
        }

        // Continua paginando se retornou 20 (página cheia) e tem mais
        continuar = lista.length === 20 && resultados.length < Math.min(totalDisponivel, 5000)
        pagina++
        if (continuar) await sleep(350)

      } catch (e) {
        console.error(`[leads] CNAE ${cnae} pag ${pagina}:`, e.message)
        erros.push(`CNAE ${cnae}: ${e.message}`)
        continuar = false
      }
    }

    await sleep(400)
  }

  const aviso = resultados.length === 0
    ? [
        `Nenhuma empresa encontrada para "${nicho}" em ${uf}${cidade ? ` / ${cidade}` : ''}.`,
        '',
        'Possíveis causas:',
        `• CNAEs pesquisados: ${cnaes.join(', ')} — verifique se são os corretos para o nicho`,
        cidade ? `• Tente sem informar a cidade (busca por estado inteiro retorna mais resultados)` : null,
        `• A casadosdados.com.br pode estar temporariamente fora do ar`,
        erros.length ? `• Erros técnicos: ${erros.slice(0,2).join('; ')}` : null,
        '',
        'Dica: experimente variações do nicho (ex: "contabil" → "contabilidade", "medico" → "clinica medica").',
      ].filter(l => l !== null).join('\n')
    : null

  return res.status(200).json({
    resultados,
    total: resultados.length,
    cnaes,
    erros: erros.length ? erros : undefined,
    aviso,
  })
}
