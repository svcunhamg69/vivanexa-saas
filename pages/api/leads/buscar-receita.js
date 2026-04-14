// pages/api/leads/buscar-receita.js
// ═══════════════════════════════════════════════════════════════════════
// Gerador de Leads — Receita Federal
//
// LISTAGEM:     minhareceita.org  — GET /?uf=MG&cnae_fiscal=6920601&limit=1000
//               Dados abertos da RFB, gratuito, sem autenticação
//
// ENRIQUECIMENTO: cnpj-api.com   — GET /v1/cnpj/{cnpj}?token=TOKEN
//               Telefone, e-mail, responsável, logo
//               Token configurado em: Configurações → Integrações
//
// FILTROS (aplicados no servidor):
//   situacaoFiltro  → 'ativa' | 'inativa' | 'todas'
//   dataInicioDe    → YYYY-MM-DD (data de abertura mínima)
//   dataInicioAte   → YYYY-MM-DD (data de abertura máxima)
//   apenasNovas     → true/false (empresas dos últimos X dias)
//   diasNovas       → número de dias (padrão 90)
// ═══════════════════════════════════════════════════════════════════════

import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

const sleep = ms => new Promise(r => setTimeout(r, ms))

// ── MAPEAMENTO NICHO → CNAE DA RECEITA FEDERAL ───────────────────────
const NICHO_CNAE = {
  'contab':           ['6920601','6920602'],
  'contador':         ['6920601','6920602'],
  'contabilidade':    ['6920601','6920602'],
  'auditoria':        ['6920601'],
  'fiscal':           ['6920601','6920602'],
  'advogad':          ['6911701','6911702'],
  'advocacia':        ['6911701','6911702'],
  'juridico':         ['6911701','6911702'],
  'cartorio':         ['6912500'],
  'notario':          ['6912500'],
  'dentist':          ['8630502','8630501'],
  'odontolog':        ['8630502','8630501'],
  'medico':           ['8630502','8630503','8630504'],
  'clinica':          ['8630502','8630503'],
  'hospital':         ['8610101','8610102'],
  'saude':            ['8630502','8630503','8650001'],
  'fisioterapia':     ['8650001','8650004'],
  'psicolog':         ['8650001','8650002'],
  'nutricion':        ['8650001','8650006'],
  'farmacia':         ['4771701','4771702'],
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
  'barbearia':        ['9602503'],
  'estetica':         ['9609202'],
  'manicure':         ['9602502'],
  'academia':         ['9313100'],
  'fitness':          ['9313100'],
  'pilates':          ['9313100'],
  'crossfit':         ['9313100'],
  'petshop':          ['4789004','7500100'],
  'veterinar':        ['7500100'],
  'mecanica':         ['4520001','4520002','4520003'],
  'oficina':          ['4520001','4520002'],
  'autopecas':        ['4530701','4530703'],
  'concession':       ['4511101','4511102'],
  'imobili':          ['6821801','6821802'],
  'construtora':      ['4110700','4120400'],
  'construcao':       ['4110700','4120400'],
  'incorporadora':    ['4110700'],
  'tecnologia':       ['6201500','6202300','6209100'],
  'software':         ['6201500','6202300'],
  'informatica':      ['6201500','4751201'],
  'desenvolvimen':    ['6201500','6202300'],
  'supermercado':     ['4711302','4711301'],
  'mercado':          ['4711302','4711301'],
  'hotel':            ['5510801','5510802'],
  'pousada':          ['5590601','5590602'],
  'turismo':          ['7911200','7912100'],
  'agencia viagem':   ['7911200','7912100'],
  'seguros':          ['6511101','6511102','6512000'],
  'seguradora':       ['6511101','6511102'],
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
  'fotografia':       ['7420001','7420002'],
  'decoracao':        ['4759801','4759899'],
  'reforma':          ['4330401','4330402','4330403'],
  'eletrica':         ['4321500'],
  'hidraulica':       ['4322301'],
  'jardinagem':       ['8130300'],
  'moveis':           ['4754701','4754702'],
  'joalheria':        ['4783102'],
  'financeira':       ['6422100','6499901'],
  'cooperativa':      ['6430100'],
  'padaria':          ['1091101','4721102'],
  'sorveteria':       ['5611203'],
  'psicolog':         ['8650001','8650002'],
  'fisioterapia':     ['8650001','8650004'],
}

function normStr(s) {
  return String(s).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim()
}

function getCnaes(nicho) {
  const t = normStr(nicho)
  const set = new Set()
  for (const [key, codes] of Object.entries(NICHO_CNAE)) {
    const k = normStr(key)
    if (t.includes(k) || k.includes(t) ||
        (t.length >= 4 && k.startsWith(t.slice(0,4))) ||
        (k.length >= 4 && t.startsWith(k.slice(0,4)))) {
      codes.forEach(c => set.add(c))
    }
  }
  return [...set].slice(0, 6)
}

// ── MAPA IBGE — principais cidades brasileiras ────────────────────────
const IBGE = {
  // MG
  'belo horizonte':'3106200','uberlandia':'3170206','contagem':'3118601',
  'juiz de fora':'3136702','betim':'3106705','montes claros':'3143302',
  'uberaba':'3170107','ipatinga':'3131307','sete lagoas':'3167202',
  // SP
  'sao paulo':'3550308','guarulhos':'3518800','campinas':'3509502',
  'sao bernardo do campo':'3548708','santo andre':'3547809',
  'osasco':'3534401','ribeirao preto':'3543402','sorocaba':'3552205',
  'sao jose dos campos':'3549904','maua':'3529401',
  // RJ
  'rio de janeiro':'3304557','nova iguacu':'3303500','niteroi':'3303302',
  'duque de caxias':'3301702','sao goncalo':'3304904',
  // RS
  'porto alegre':'4314902','caxias do sul':'4305108','canoas':'4304606',
  'pelotas':'4314407','santa maria':'4316907',
  // PR
  'curitiba':'4106902','londrina':'4113700','maringa':'4115200',
  'foz do iguacu':'4108304','cascavel':'4104808',
  // SC
  'florianopolis':'4205407','joinville':'4209102','blumenau':'4202404',
  // BA
  'salvador':'2927408','feira de santana':'2910800',
  // PE
  'recife':'2611606','caruaru':'2604106','olinda':'2609600',
  // CE
  'fortaleza':'2304400','caucaia':'2303709',
  // AM
  'manaus':'1302603',
  // PA
  'belem':'1501402',
  // GO
  'goiania':'5208707','aparecida de goiania':'5201405','anapolis':'5201108',
  // DF
  'brasilia':'5300108',
  // ES
  'vitoria':'3205309','vila velha':'3205200','cariacica':'3201308',
  // MT
  'cuiaba':'5103403',
  // MS
  'campo grande':'5002704','dourados':'5003702',
  // AL
  'maceio':'2704302',
  // RN
  'natal':'2408102','mossoro':'2408003',
  // PB
  'joao pessoa':'2507507','campina grande':'2504009',
  // SE
  'aracaju':'2800308',
  // PI
  'teresina':'2211001',
  // MA
  'sao luis':'2111300',
  // RO
  'porto velho':'1100205',
  // AC
  'rio branco':'1200401',
  // RR
  'boa vista':'1400100',
  // AP
  'macapa':'1600303',
  // TO
  'palmas':'1721000',
}

function getCodIbge(cidade) {
  if (!cidade || !cidade.trim()) return null
  return IBGE[normStr(cidade)] || null
}

// ── FONTE 1: minhareceita.org — busca paginada por CNAE + UF ─────────
async function buscarMinhareceita({ cnae, uf, codIbge, cursor }) {
  const params = new URLSearchParams({
    uf:          uf.toUpperCase(),
    cnae_fiscal: cnae,
    limit:       '1000',   // máximo suportado pela API
  })
  if (codIbge) params.set('municipio', codIbge)
  if (cursor)  params.set('cursor',    cursor)

  const url = `https://minhareceita.org/?${params}`
  console.log('[minhareceita] GET', url)

  const r = await fetch(url, {
    headers: {
      'Accept':     'application/json',
      'User-Agent': 'Mozilla/5.0 (compatible; Vivanexa-SaaS/3.0)',
    },
    signal: AbortSignal.timeout(30000),
  })

  if (!r.ok) {
    const body = await r.text().catch(() => '')
    throw new Error(`minhareceita.org retornou HTTP ${r.status}: ${body.slice(0, 200)}`)
  }

  // Resposta esperada: { "data": [...empresas], "cursor": "string_ou_null" }
  return r.json()
}

// ── FONTE 2: cnpj-api.com — enriquecimento individual ────────────────
async function enriquecerCnpjApi({ cnpj, token }) {
  if (!token || !cnpj) return null
  try {
    const url = `https://api.cnpj-api.com/v1/cnpj/${cnpj}?token=${token}`
    const r   = await fetch(url, {
      headers: { 'User-Agent': 'Vivanexa-SaaS/3.0' },
      signal:  AbortSignal.timeout(10000),
    })
    if (r.status === 429) { console.warn('[cnpj-api] rate limit 429'); return null }
    if (!r.ok)            { return null }
    return r.json()
  } catch (e) {
    console.error('[cnpj-api] erro:', e.message)
    return null
  }
}

// ── MAPPERS ───────────────────────────────────────────────────────────

function mapMinhareceita(e) {
  // Campos retornados pela minhareceita.org (dados abertos RFB):
  // cnpj, razao_social, nome_fantasia, situacao_cadastral,
  // data_inicio_atividade, cnae_fiscal, cnae_fiscal_descricao,
  // descricao_tipo_logradouro, logradouro, numero, complemento,
  // bairro, cep, uf, municipio, email, ddd_telefone_1, ddd_telefone_2,
  // qsa: [{ nome_socio, ... }]
  const cnpj = (e.cnpj || '').replace(/\D/g,'')
  const t1   = (e.ddd_telefone_1 || e.telefone_1 || '').replace(/\D/g,'')
  const t2   = (e.ddd_telefone_2 || e.telefone_2 || '').replace(/\D/g,'')
  const tel  = t1.length >= 10 ? t1 : t2.length >= 10 ? t2 : ''
  const socio = Array.isArray(e.qsa) ? e.qsa[0] : null

  return {
    id:          `rf_${cnpj}`,
    nome:        e.razao_social    || '',
    fantasia:    e.nome_fantasia   || e.razao_social || '',
    responsavel: socio?.nome_socio || socio?.nome    || '',
    cnpj,
    telefone:    tel,
    email:       e.email           || '',
    site:        '',
    logradouro:  [e.descricao_tipo_logradouro, e.logradouro].filter(Boolean).join(' ').trim(),
    numero:      e.numero          || '',
    complemento: e.complemento     || '',
    bairro:      e.bairro          || '',
    cidade:      e.municipio       || '',
    uf:          e.uf              || '',
    cep:         (e.cep            || '').replace(/\D/g,''),
    atividade:   e.cnae_fiscal_descricao || '',
    cnae:        String(e.cnae_fiscal    || ''),
    situacao:    e.situacao_cadastral    || '',
    dataInicio:  e.data_inicio_atividade || '',
    capital:     e.capital_social        || '',
    porte:       e.porte                 || '',
    natureza:    e.natureza_juridica     || '',
    fonte:       'Receita Federal',
  }
}

function aplicarEnriquecimento(lead, extra) {
  if (!extra) return
  // cnpj-api.com retorna: telefone, email, qsa, logo_url, etc.
  const tel   = extra.telefone || (Array.isArray(extra.telefones) ? extra.telefones[0] : '') || ''
  const fone  = String(tel).replace(/\D/g,'')
  const socio = Array.isArray(extra.qsa) ? extra.qsa[0] : null

  if (!lead.telefone    && fone)              lead.telefone    = fone
  if (!lead.email       && extra.email)       lead.email       = extra.email
  if (!lead.responsavel && socio?.nome_socio) lead.responsavel = socio.nome_socio
  if (!lead.site        && extra.website)     lead.site        = extra.website
  if (extra.logo_url)                         lead.logo        = extra.logo_url
  // Preenche campos extras se vieram vazios da minhareceita
  if (!lead.situacao    && extra.situacao_cadastral)    lead.situacao   = extra.situacao_cadastral
  if (!lead.dataInicio  && extra.data_inicio_atividade) lead.dataInicio = extra.data_inicio_atividade
  if (!lead.porte       && extra.porte_empresa)         lead.porte      = extra.porte_empresa
  if (!lead.capital     && extra.capital_social)        lead.capital    = extra.capital_social
  if (!lead.natureza    && extra.natureza_juridica)     lead.natureza   = extra.natureza_juridica
}

// ── HANDLER PRINCIPAL ─────────────────────────────────────────────────
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido. Use POST.' })
  }

  const {
    nicho,
    cnaeManual,
    uf,
    cidade,
    bairro,
    logradouro,
    situacaoFiltro  = 'ativa',   // 'ativa' | 'inativa' | 'todas'
    dataInicioDe,                 // YYYY-MM-DD
    dataInicioAte,                // YYYY-MM-DD
    apenasNovas     = false,
    diasNovas       = 90,
    empresaId,                    // ID da empresa para buscar o token no Supabase
  } = req.body || {}

  // ── Validações básicas ────────────────────────────────────────────
  if (!uf?.trim()) {
    return res.status(400).json({ error: 'Estado (UF) é obrigatório.' })
  }
  if (!nicho?.trim() && !cnaeManual?.trim()) {
    return res.status(400).json({ error: 'Informe o nicho ou o código CNAE.' })
  }

  // ── Buscar token do cnpj-api.com salvo nas configurações ────────
  let tokenCnpjApi = ''
  if (empresaId) {
    try {
      const { data: row } = await supabaseAdmin
        .from('vx_storage')
        .select('value')
        .eq('key', `cfg:${empresaId}`)
        .maybeSingle()
      if (row?.value) {
        const cfg = JSON.parse(row.value)
        tokenCnpjApi = cfg.cnpjApiToken || ''
      }
    } catch (e) {
      console.warn('[leads] erro ao buscar token das configs:', e.message)
    }
  }

  // ── Determinar CNAEs a buscar ─────────────────────────────────────
  let cnaes = []
  if (cnaeManual?.trim()) {
    // Usuário informou código CNAE diretamente (pode ser múltiplos separados por vírgula)
    cnaes = cnaeManual.split(',').map(c => c.replace(/\D/g,'').trim()).filter(Boolean).slice(0, 8)
  } else {
    cnaes = getCnaes(nicho.trim())
  }

  if (cnaes.length === 0) {
    return res.status(200).json({
      resultados: [],
      cnaes:      [],
      total:      0,
      aviso: [
        `Nicho "${nicho}" não foi mapeado para nenhum código CNAE.`,
        '',
        'Use o campo "Código CNAE" para informar o código diretamente,',
        'ou tente um destes termos: contabilidade, advocacia, dentista,',
        'restaurante, farmácia, academia, clínica, imobiliária, escola,',
        'petshop, salão, barbearia, mecânica, hotel, tecnologia, psicólogo,',
        'nutricionista, engenharia, segurança, limpeza, marketing, consultoria,',
        'padaria, ótica, laboratório, turismo, seguro, supermercado,',
        'fisioterapia, construtora, gráfica, fotografia, logística...',
      ].join('\n'),
    })
  }

  const codIbge     = getCodIbge(cidade)
  const resultados  = []
  const cnpjsVistos = new Set()
  const erros       = []
  let   totalBruto  = 0

  console.log(`[leads] nicho="${nicho}" uf="${uf}" cidade="${cidade}" codIbge="${codIbge}" CNAEs:`, cnaes)

  // ── Loop por cada CNAE ────────────────────────────────────────────
  for (const cnae of cnaes) {
    let cursor   = null
    let pagina   = 1
    let continuar = true

    while (continuar) {
      try {
        const data  = await buscarMinhareceita({ cnae, uf: uf.trim(), codIbge, cursor })
        const lista = data?.data   || []
        cursor      = data?.cursor || null
        totalBruto += lista.length

        console.log(`[leads] CNAE=${cnae} página=${pagina} → ${lista.length} registros, cursor=${cursor}`)

        for (const emp of lista) {
          const cnpj = (emp.cnpj || '').replace(/\D/g,'')
          if (!cnpj || cnpjsVistos.has(cnpj)) continue
          cnpjsVistos.add(cnpj)

          // ── Filtros ─────────────────────────────────────────────
          // Situação cadastral
          const sitEmp = (emp.situacao_cadastral || '').toLowerCase()
          if (situacaoFiltro === 'ativa'   && !sitEmp.includes('ativa'))  continue
          if (situacaoFiltro === 'inativa' &&  sitEmp.includes('ativa'))  continue

          // Data de abertura (período específico)
          const di = emp.data_inicio_atividade || ''
          if (dataInicioDe && di && di < dataInicioDe) continue
          if (dataInicioAte && di && di > dataInicioAte) continue

          // Empresas recentes (últimos X dias)
          if (apenasNovas) {
            const limite = new Date()
            limite.setDate(limite.getDate() - parseInt(diasNovas, 10))
            if (!di || new Date(di) < limite) continue
          }

          // Bairro / logradouro (filtro local)
          if (bairro     && !(emp.bairro     || '').toLowerCase().includes(bairro.toLowerCase()))     continue
          if (logradouro && !(emp.logradouro || '').toLowerCase().includes(logradouro.toLowerCase())) continue

          // ── Montar lead ─────────────────────────────────────────
          const lead = mapMinhareceita(emp)

          // Enriquecer com cnpj-api.com apenas se faltar telefone ou e-mail
          if (tokenCnpjApi && (!lead.telefone || !lead.email)) {
            await sleep(200) // ~5 req/s — dentro do limite gratuito (5/min = ~0,08/s mas é conservador)
            const extra = await enriquecerCnpjApi({ cnpj, token: tokenCnpjApi })
            aplicarEnriquecimento(lead, extra)
          }

          resultados.push(lead)
        }

        // Continuar paginando se retornou cursor
        continuar = !!cursor
        pagina++
        if (continuar) await sleep(350) // pausa respeitosa entre páginas

      } catch (e) {
        const msg = `CNAE ${cnae}: ${e.message}`
        erros.push(msg)
        console.error('[leads]', msg)
        continuar = false
      }
    }

    await sleep(400) // pausa entre CNAEs diferentes
  }

  // ── Montar aviso se não encontrou nada ────────────────────────────
  let aviso = null
  if (resultados.length === 0) {
    const linhas = [
      `Nenhuma empresa encontrada para "${nicho || cnaeManual}" em ${uf}${cidade ? ` / ${cidade}` : ''}.`,
      '',
      'Diagnóstico:',
    ]
    linhas.push(`• CNAEs pesquisados: ${cnaes.join(', ')}`)
    if (cidade && !codIbge) {
      linhas.push(`• Cidade "${cidade}" não encontrada no mapeamento IBGE — tente deixar o campo Cidade vazio para buscar no estado todo.`)
    }
    if (totalBruto > 0) {
      linhas.push(`• Foram encontrados ${totalBruto} registros mas todos foram filtrados pelos critérios selecionados (situação, data de abertura, etc.).`)
    }
    if (erros.length > 0) {
      linhas.push(`• Erros de API: ${erros.slice(0, 2).join(' | ')}`)
    }
    if (!tokenCnpjApi) {
      linhas.push(`• Token da cnpj-api.com não configurado — o enriquecimento de telefone/e-mail está desativado.`)
      linhas.push(`  Acesse Configurações → Integrações para adicionar o token.`)
    }
    linhas.push('')
    linhas.push('A minhareceita.org é uma API gratuita sem garantia de disponibilidade.')
    linhas.push('Se persistir o problema, tente com outro CNAE ou aguarde alguns minutos.')
    aviso = linhas.join('\n')
  }

  return res.status(200).json({
    resultados,
    total:      resultados.length,
    totalBruto,
    cnaes,
    aviso,
    semToken:   !tokenCnpjApi,
    ...(erros.length ? { erros } : {}),
  })
}
