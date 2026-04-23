// pages/api/leads/buscar-receita.js
// ═══════════════════════════════════════════════════════════════════════
// Gerador de Leads — Receita Federal
//
// LISTAGEM:       minhareceita.org  → GET /?uf=XX&cnae_fiscal=XXXX&limit=1000
// ENRIQUECIMENTO: api.cnpj-api.com.br → GET /v1/cnpj/{cnpj}?token=TOKEN
//
// Token configurado em: Configurações → Integrações → CNPJ API
// ═══════════════════════════════════════════════════════════════════════

import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

const sleep = ms => new Promise(r => setTimeout(r, ms))

// Converte qualquer valor para string lowercase segura
function safeStr(v) {
  if (v === null || v === undefined) return ''
  return String(v).toLowerCase().trim()
}

// ── MAPEAMENTO NICHO → CNAE ───────────────────────────────────────────
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
  'escola':           ['8511200','8512100','8513900'],
  'colegio':          ['8511200','8512100'],
  'faculdade':        ['8532500','8533300'],
  'curso':            ['8599604','8599605','8599699'],
  'cabeleirei':       ['9602501','9602502'],
  'salao':            ['9602501','9602502'],
  'barbearia':        ['9602503'],
  'estetica':         ['9609202'],
  'academia':         ['9313100'],
  'fitness':          ['9313100'],
  'pilates':          ['9313100'],
  'petshop':          ['4789004','7500100'],
  'veterinar':        ['7500100'],
  'mecanica':         ['4520001','4520002','4520003'],
  'oficina':          ['4520001','4520002'],
  'autopecas':        ['4530701','4530703'],
  'imobili':          ['6821801','6821802'],
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
  'seguros':          ['6511101','6511102','6512000'],
  'consultoria':      ['7020400','6920601'],
  'marketing':        ['7319002','7319003'],
  'publicidade':      ['7311400','7312200'],
  'engenharia':       ['7112000','7111100'],
  'arquitetura':      ['7111100'],
  'limpeza':          ['8121400','8122200'],
  'seguranca':        ['8011101','8011102'],
  'transporte':       ['4930201','4930202'],
  'logistica':        ['5229001','5229002'],
  'grafica':          ['1811301','1811302'],
  'fotografia':       ['7420001','7420002'],
  'decoracao':        ['4759801','4759899'],
  'reforma':          ['4330401','4330402'],
  'eletrica':         ['4321500'],
  'hidraulica':       ['4322301'],
  'moveis':           ['4754701','4754702'],
  'joalheria':        ['4783102'],
  'financeira':       ['6422100','6499901'],
  'rh':               ['7810800','7820500'],
  'jardinagem':       ['8130300'],
  'sorveteria':       ['5611203'],
  'barbearia':        ['9602503'],
  'nutricion':        ['8650001','8650006'],
}

function normStr(s) {
  return safeStr(s).normalize('NFD').replace(/[\u0300-\u036f]/g,'')
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

// ── MAPA IBGE (cache estático para cidades frequentes) ───────────────
const IBGE = {
  // Capitais e grandes cidades
  'belo horizonte':'3106200','sao paulo':'3550308','rio de janeiro':'3304557',
  'porto alegre':'4314902','curitiba':'4106902','fortaleza':'2304400',
  'manaus':'1302603','salvador':'2927408','recife':'2611606',
  'goiania':'5208707','brasilia':'5300108','belem':'1501402',
  'vitoria':'3205309','florianopolis':'4205407','joinville':'4209102',
  'uberlandia':'3170206','campinas':'3509502','sorocaba':'3552205',
  'ribeirao preto':'3543402','sao jose dos campos':'3549904',
  'guarulhos':'3518800','londrina':'4113700','maringa':'4115200',
  'caxias do sul':'4305108','cuiaba':'5103403','campo grande':'5002704',
  'maceio':'2704302','natal':'2408102','joao pessoa':'2507507',
  'aracaju':'2800308','teresina':'2211001','sao luis':'2111300',
  'porto velho':'1100205','rio branco':'1200401','macapa':'1600303',
  'boa vista':'1400100','palmas':'1721000','contagem':'3118601',
  'juiz de fora':'3136702','betim':'3106705','montes claros':'3143302',
  'uberaba':'3170107','ipatinga':'3131307','feira de santana':'2910800',
  // MG — cidades médias e do interior
  'pedro leopoldo':'3149309','vespasiano':'3171303','lagoa santa':'3137601',
  'ribeiro das neves':'3154606','santa luzia':'3157807','sabara':'3156700',
  'nova lima':'3144805','brumadinho':'3109006','esmeraldas':'3124104',
  'sete lagoas':'3167202','divinopolis':'3122306','pocos de caldas':'3151800',
  'varginha':'3170701','pouso alegre':'3152402','itajuba':'3132503',
  'lavras':'3138203','passos':'3147907','patos de minas':'3148004',
  'araguari':'3103504','ituiutaba':'3134202','governador valadares':'3127701',
  'coronel fabriciano':'3119401','timoteo':'3168705','cataguases':'3115300',
  'muriae':'3143700','vicosa':'3171907','uba':'3170008',
  'barbacena':'3105608','sao joao del rei':'3162500','conselheiro lafaiete':'3118304',
  'ouro preto':'3146107','mariana':'3140001','congonhas':'3117900',
  'formiga':'3126109','divinopolis':'3122306','nova serrana':'3145208',
  'para de minas':'3147105','caete':'3109709','caeté':'3109709',
}

// Busca código IBGE via API do IBGE (fallback para cidades não mapeadas)
async function buscarCodIbgeDinamico(cidade, uf) {
  if (!cidade) return null
  try {
    const nome = encodeURIComponent(cidade.trim())
    const url  = `https://servicodados.ibge.gov.br/api/v1/localidades/municipios?nome=${nome}`
    const r    = await fetch(url, { signal: AbortSignal.timeout(8000) })
    if (!r.ok) return null
    const lista = await r.json()
    if (!Array.isArray(lista) || lista.length === 0) return null
    // Filtra por UF se informado
    const filtrados = uf
      ? lista.filter(m => m.microrregiao?.mesorregiao?.UF?.sigla?.toLowerCase() === uf.toLowerCase())
      : lista
    const match = filtrados[0] || lista[0]
    return match?.id ? String(match.id) : null
  } catch(e) {
    console.warn('[ibge] falha na busca dinâmica:', e.message)
    return null
  }
}

async function getCodIbge(cidade, uf) {
  if (!cidade) return null
  const codEstatico = IBGE[normStr(cidade)]
  if (codEstatico) return codEstatico
  // Fallback: consulta API do IBGE em tempo real
  console.log(`[ibge] buscando código para "${cidade}" (${uf}) via API...`)
  const cod = await buscarCodIbgeDinamico(cidade, uf)
  if (cod) console.log(`[ibge] encontrado: ${cidade} → ${cod}`)
  else console.warn(`[ibge] não encontrado para "${cidade}"`)
  return cod
}

// ── minhareceita.org ──────────────────────────────────────────────────
async function buscarMinhareceita({ cnae, uf, codIbge, cursor }) {
  const p = new URLSearchParams({
    uf:          uf.toUpperCase(),
    cnae_fiscal: cnae,
    limit:       '1000',
  })
  if (codIbge) p.set('municipio', codIbge)
  if (cursor)  p.set('cursor', cursor)

  const url = `https://minhareceita.org/?${p}`
  console.log('[leads] GET', url)

  const r = await fetch(url, {
    headers: { 'Accept': 'application/json', 'User-Agent': 'Vivanexa/3.0' },
    signal: AbortSignal.timeout(30000),
  })
  if (!r.ok) throw new Error(`minhareceita HTTP ${r.status}`)
  return r.json()
}

// ── cnpj-api.com — enriquecimento ────────────────────────────────────
// URL correta: api.cnpj-api.com (SEM .br)
async function enriquecerCnpjApi(cnpj, token) {
  if (!token || !cnpj) return null
  try {
    const url = `https://api.cnpj-api.com/v1/cnpj/${cnpj}?token=${token}`
    const r   = await fetch(url, {
      headers: { 'User-Agent': 'Vivanexa/3.0' },
      signal:  AbortSignal.timeout(12000),
    })
    if (r.status === 429) { console.warn('[cnpj-api] 429 rate limit'); return null }
    if (!r.ok) { console.warn('[cnpj-api] HTTP', r.status); return null }
    return r.json()
  } catch(e) {
    console.error('[cnpj-api] erro:', e.message)
    return null
  }
}

// ── Situação cadastral: a minhareceita.org retorna código numérico ────
// 1=Nula, 2=Ativa, 3=Suspensa, 4=Inapta, 8=Baixada
const SITUACAO_MAP = {
  '1': 'Nula', '2': 'Ativa', '3': 'Suspensa', '4': 'Inapta', '8': 'Baixada',
}
// A minhareceita.org pode retornar situacao_cadastral como:
//   número: 2
//   string: "ATIVA" | "2"
//   objeto: { codigo: 2, descricao: "ATIVA" }
function parseSituacao(v) {
  if (v === null || v === undefined) return ''
  // Objeto com descricao
  if (typeof v === 'object') {
    if (v.descricao) return v.descricao.charAt(0).toUpperCase() + v.descricao.slice(1).toLowerCase()
    if (v.codigo !== undefined) return SITUACAO_MAP[String(v.codigo)] || `Código ${v.codigo}`
    return ''
  }
  const s = String(v).trim()
  // Texto direto: "ATIVA", "BAIXADA"...
  if (/[a-zA-Z]/.test(s)) return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase()
  // Número como string: "2", "8"...
  return SITUACAO_MAP[s] || (s ? `Código ${s}` : '')
}

// Retorna true se a situação for considerada "ativa"
function ehAtiva(v) {
  return parseSituacao(v).toLowerCase().includes('ativa')
}

// ── Mappers ───────────────────────────────────────────────────────────
function mapMinhareceita(e) {
  const cnpj = safeStr(e.cnpj).replace(/\D/g,'')
  const t1   = safeStr(e.ddd_telefone_1 || e.telefone_1).replace(/\D/g,'')
  const t2   = safeStr(e.ddd_telefone_2 || e.telefone_2).replace(/\D/g,'')
  const tel  = t1.length >= 10 ? t1 : t2.length >= 10 ? t2 : ''
  const qsa  = Array.isArray(e.qsa) ? e.qsa : []
  const socio = qsa[0]

  return {
    id:          `rf_${cnpj}`,
    nome:        safeStr(e.razao_social).toUpperCase() || '',
    fantasia:    safeStr(e.nome_fantasia || e.razao_social),
    responsavel: safeStr(socio?.nome_socio || socio?.nome),
    cnpj,
    telefone:    tel,
    email:       safeStr(e.email),
    site:        '',
    logradouro:  [e.descricao_tipo_logradouro, e.logradouro].map(safeStr).filter(Boolean).join(' ').trim(),
    numero:      safeStr(e.numero),
    complemento: safeStr(e.complemento),
    bairro:      safeStr(e.bairro),
    cidade:      safeStr(e.municipio),
    uf:          safeStr(e.uf).toUpperCase(),
    cep:         safeStr(e.cep).replace(/\D/g,''),
    atividade:   safeStr(e.cnae_fiscal_descricao),
    cnae:        safeStr(e.cnae_fiscal),
    // ✅ Converte código numérico (2=Ativa, 8=Baixada, etc.) para texto
    situacao:    parseSituacao(e.situacao_cadastral),
    dataInicio:  safeStr(e.data_inicio_atividade),
    capital:     safeStr(e.capital_social),
    porte:       safeStr(e.porte),
    natureza:    safeStr(e.natureza_juridica),
    matrizFilial: safeStr(e.identificador_matriz_filial), // '1'=Matriz '2'=Filial
    fonte:       'Receita Federal',
  }
}

function aplicarEnriquecimento(lead, extra) {
  if (!extra) return
  // cnpj-api.com.br resposta padrão
  const tel  = safeStr(extra.telefone || (Array.isArray(extra.telefones) ? extra.telefones[0] : '')).replace(/\D/g,'')
  const qsa  = Array.isArray(extra.qsa) ? extra.qsa : []
  const socio = qsa[0]

  if (!lead.telefone && tel)                       lead.telefone    = tel
  if (!lead.email    && extra.email)               lead.email       = safeStr(extra.email)
  if (!lead.responsavel && socio?.nome_socio)      lead.responsavel = safeStr(socio.nome_socio)
  if (!lead.site     && extra.website)             lead.site        = safeStr(extra.website)
  if (extra.logo_url)                              lead.logo        = extra.logo_url
  if (!lead.situacao && extra.situacao_cadastral)  lead.situacao    = safeStr(extra.situacao_cadastral)
  if (!lead.dataInicio && extra.data_inicio_atividade) lead.dataInicio = safeStr(extra.data_inicio_atividade)
  if (!lead.porte    && extra.porte_empresa)       lead.porte       = safeStr(extra.porte_empresa)
  if (!lead.capital  && extra.capital_social)      lead.capital     = safeStr(extra.capital_social)
}

// ── HANDLER ───────────────────────────────────────────────────────────
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método não permitido' })

  const {
    nicho,
    cnaeManual,
    uf,
    cidade,
    bairro,
    logradouro,
    situacaoFiltro = 'todas',
    dataInicioDe,
    dataInicioAte,
    apenasNovas    = false,
    diasNovas      = 365,
    empresaId,
    // ── Filtros de qualidade pré-busca ──────────────────────────────
    apenasComTelefone  = false,
    apenasComCelular   = false,
    apenasComEmail     = false,
    excluirMei         = false,
    somenteMei         = false,   // só MEI (natureza 2135)
    somenteMatriz      = false,   // identificador_matriz_filial = 1
    somenteFilial      = false,   // identificador_matriz_filial = 2
    naturezasSelecionadas = [],   // array de códigos ex: ['2135','2062']
    naturezaJuridica   = '',      // legado — código único
    porteFiltro        = '',
  } = req.body || {}

  if (!uf?.trim()) return res.status(400).json({ error: 'Estado (UF) é obrigatório' })
  if (!nicho?.trim() && !cnaeManual?.trim()) return res.status(400).json({ error: 'Informe o nicho ou o CNAE' })

  // ── Ler token das configurações do Supabase ───────────────────────
  let tokenCnpjApi = ''
  if (empresaId) {
    try {
      const { data: row } = await supabase
        .from('vx_storage')
        .select('value')
        .eq('key', `cfg:${empresaId}`)
        .maybeSingle()
      if (row?.value) {
        const cfg = JSON.parse(row.value)
        tokenCnpjApi = cfg.cnpjApiToken || ''
      }
    } catch(e) {
      console.warn('[leads] token lookup erro:', e.message)
    }
  }

  // ── Determinar CNAEs ──────────────────────────────────────────────
  let cnaes = cnaeManual?.trim()
    ? cnaeManual.split(',').map(c => c.replace(/\D/g,'').trim()).filter(Boolean).slice(0, 8)
    : getCnaes(nicho?.trim() || '')

  if (cnaes.length === 0) {
    return res.status(200).json({
      resultados: [], cnaes: [], total: 0,
      aviso: `Nicho "${nicho}" não mapeado. Use o campo CNAE ou tente: contabilidade, advocacia, dentista, restaurante, farmácia, academia, clínica, imobiliária, escola, petshop, salão, barbearia, mecânica, hotel, tecnologia, psicólogo, nutricionista, engenharia, segurança, limpeza, marketing, consultoria, padaria, ótica, laboratório, turismo, seguro, supermercado...`,
    })
  }

  const codIbge     = await getCodIbge(cidade, uf)
  const resultados  = []
  const cnpjsVistos = new Set()
  const erros       = []
  let   totalBruto  = 0

  console.log(`[leads] nicho="${nicho}" uf="${uf}" cidade="${cidade}" codIbge="${codIbge}" CNAEs:${cnaes} situacao="${situacaoFiltro}"`)

  for (const cnae of cnaes) {
    let cursor    = null
    let pagina    = 1
    let continuar = true

    while (continuar) {
      try {
        const data  = await buscarMinhareceita({ cnae, uf: uf.trim(), codIbge, cursor })
        const lista = data?.data   || []
        cursor      = data?.cursor || null
        totalBruto += lista.length

        console.log(`[leads] CNAE=${cnae} pag=${pagina} → ${lista.length} registros cursor=${cursor}`)

        for (const emp of lista) {
          const cnpj = safeStr(emp.cnpj).replace(/\D/g,'')
          if (!cnpj || cnpjsVistos.has(cnpj)) continue
          cnpjsVistos.add(cnpj)

          // ── Filtro situação: usa ehAtiva() que trata número/string/objeto ──
          if (situacaoFiltro === 'ativa'   && !ehAtiva(emp.situacao_cadastral)) continue
          if (situacaoFiltro === 'inativa' &&  ehAtiva(emp.situacao_cadastral)) continue
          // 'todas' não filtra nada

          // ── Filtro datas ──────────────────────────────────────────
          const di = safeStr(emp.data_inicio_atividade)
          if (dataInicioDe && di && di < dataInicioDe) continue
          if (dataInicioAte && di && di > dataInicioAte) continue

          if (apenasNovas && di) {
            const limite = new Date()
            limite.setDate(limite.getDate() - parseInt(diasNovas, 10))
            if (new Date(di) < limite) continue
          }

          // ── Filtros geográficos locais ────────────────────────────
          if (cidade && !codIbge && !normStr(emp.municipio || '').includes(normStr(cidade))) continue
          if (bairro && !safeStr(emp.bairro).includes(normStr(bairro))) continue
          if (logradouro && !safeStr(emp.logradouro).includes(normStr(logradouro))) continue

          const lead = mapMinhareceita(emp)

          // ── Enriquecimento com cnpj-api.com (apenas para dados faltantes) ──
          if (tokenCnpjApi && (!lead.telefone || !lead.email)) {
            await sleep(200)
            const extra = await enriquecerCnpjApi(lead.cnpj, tokenCnpjApi)
            aplicarEnriquecimento(lead, extra)
          }

          resultados.push(lead)
        }

        continuar = !!cursor
        pagina++
        if (continuar) await sleep(350)

      } catch(e) {
        const msg = `CNAE ${cnae} pag ${pagina}: ${e.message}`
        erros.push(msg)
        console.error('[leads]', msg)
        continuar = false
      }
    }

    await sleep(300)
  }

  // ── Diagnóstico se não encontrou nada ─────────────────────────────
  let aviso = null
  if (resultados.length === 0) {
    const linhas = [
      `Nenhuma empresa encontrada para "${nicho || cnaeManual}" em ${uf}${cidade ? ` / ${cidade}` : ''}.`,
      '',
      `• CNAEs pesquisados: ${cnaes.join(', ')}`,
    ]
    if (totalBruto > 0 && situacaoFiltro !== 'todas') {
      linhas.push(`• ${totalBruto} registros encontrados mas filtrados por situação "${situacaoFiltro}"`)
      linhas.push(`  → Tente trocar o filtro de Situação Cadastral para "Todas"`)
    } else if (totalBruto > 0) {
      linhas.push(`• ${totalBruto} registros brutos encontrados mas filtrados pelos critérios selecionados`)
      if (apenasComTelefone) linhas.push(`  → Filtro "Com telefone" ativo — muitas empresas na RF não têm telefone cadastrado`)
      if (apenasComEmail)    linhas.push(`  → Filtro "Com e-mail" ativo — poucos CNPJs têm e-mail na Receita Federal`)
      if (excluirMei)        linhas.push(`  → Filtro "Excluir MEI" ativo — tente incluir MEIs se a cidade for pequena`)
    } else {
      linhas.push(`• minhareceita.org não retornou registros para estes CNAEs nesta UF`)
      linhas.push(`  → Tente sem informar a cidade (busca no estado todo retorna mais resultados)`)
    }
    if (!tokenCnpjApi) {
      linhas.push(`• Token da cnpj-api.com não configurado`)
      linhas.push(`  → Acesse Config → Integrações para adicionar (melhora telefone/e-mail)`)
    }
    if (erros.length) linhas.push(`• Erros: ${erros.slice(0,2).join(' | ')}`)
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
