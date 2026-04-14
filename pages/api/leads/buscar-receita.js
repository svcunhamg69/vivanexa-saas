// pages/api/leads/buscar-receita.js
// ═══════════════════════════════════════════════════════════════════════

const sleep = ms => new Promise(r => setTimeout(r, ms))

// ── MAPEAMENTO NICHO → CNAE ───────────────────────────────────────────
const NICHO_CNAE = {
  'contab':       ['6920601','6920602'],
  'contador':     ['6920601','6920602'],
  'auditoria':    ['6920601'],
  'advogad':      ['6911701','6911702'],
  'advocacia':    ['6911701','6911702'],
  'juridico':     ['6911701','6911702'],
  'cartorio':     ['6912500'],
  'dentist':      ['8630502','8630501'],
  'odontolog':    ['8630502'],
  'medico':       ['8630502','8630503','8630504'],
  'clinica':      ['8630502','8630503'],
  'hospital':     ['8610101','8610102'],
  'saude':        ['8630502','8630503','8650001'],
  'fisioterapia': ['8650001','8650004'],
  'psicolog':     ['8650001','8650002'],
  'nutricion':    ['8650001','8650006'],
  'farmacia':     ['4771701','4771702'],
  'laboratorio':  ['8640202','8640203'],
  'optica':       ['4774100'],
  'otica':        ['4774100'],
  'restaurante':  ['5611201','5611202','5611203'],
  'lanchonete':   ['5611203'],
  'pizzaria':     ['5611202'],
  'padaria':      ['1091101','4721102'],
  'escola':       ['8511200','8512100','8513900'],
  'colegio':      ['8511200','8512100'],
  'faculdade':    ['8532500','8533300'],
  'curso':        ['8599604','8599605','8599699'],
  'cabeleirei':   ['9602501','9602502'],
  'salao':        ['9602501','9602502'],
  'barbearia':    ['9602503'],
  'estetica':     ['9609202'],
  'academia':     ['9313100'],
  'fitness':      ['9313100'],
  'pilates':      ['9313100'],
  'petshop':      ['4789004','7500100'],
  'veterinar':    ['7500100'],
  'mecanica':     ['4520001','4520002','4520003'],
  'oficina':      ['4520001','4520002'],
  'autopecas':    ['4530701','4530703'],
  'imobili':      ['6821801','6821802'],
  'construtora':  ['4110700','4120400'],
  'construcao':   ['4110700','4120400'],
  'tecnologia':   ['6201500','6202300','6209100'],
  'software':     ['6201500','6202300'],
  'informatica':  ['6201500','4751201'],
  'supermercado': ['4711302','4711301'],
  'mercado':      ['4711302','4711301'],
  'hotel':        ['5510801','5510802'],
  'pousada':      ['5590601','5590602'],
  'turismo':      ['7911200','7912100'],
  'seguros':      ['6511101','6511102','6512000'],
  'consultoria':  ['7020400','6920601'],
  'marketing':    ['7319002','7319003'],
  'publicidade':  ['7311400','7312200'],
  'engenharia':   ['7112000','7111100'],
  'arquitetura':  ['7111100'],
  'limpeza':      ['8121400','8122200'],
  'seguranca':    ['8011101','8011102'],
  'transporte':   ['4930201','4930202'],
  'logistica':    ['5229001','5229002'],
  'grafica':      ['1811301','1811302'],
  'fotografia':   ['7420001','7420002'],
  'decoracao':    ['4759801','4759899'],
  'reforma':      ['4330401','4330402'],
  'eletrica':     ['4321500'],
  'hidraulica':   ['4322301'],
  'moveis':       ['4754701','4754702'],
  'joalheria':    ['4783102'],
  'financeira':   ['6422100','6499901'],
  'contabilidade':['6920601','6920602'],
  'rh':           ['7810800','7820500'],
}

function normStr(s) {
  return String(s).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim()
}

function getCnaes(nicho) {
  const t = normStr(nicho)
  const set = new Set()
  for (const [key, codes] of Object.entries(NICHO_CNAE)) {
    const k = normStr(key)
    if (t.includes(k) || k.includes(t) || (t.length>=4 && k.startsWith(t.slice(0,4))) || (k.length>=4 && t.startsWith(k.slice(0,4)))) {
      codes.forEach(c => set.add(c))
    }
  }
  return [...set].slice(0, 6)
}

// ── IBGE ─────────────────────────────────────────────────────────
const IBGE = {
  'belo horizonte':'3106200','sao paulo':'3550308','rio de janeiro':'3304557',
  'porto alegre':'4314902','curitiba':'4106902','fortaleza':'2304400',
  'manaus':'1302603','salvador':'2927408','recife':'2611606',
  'goiania':'5208707','brasilia':'5300108','belem':'1501402'
}

function codIbge(cidade) {
  return IBGE[normStr(cidade)] || null
}

// ── FONTE ─────────────────────────────────────────────────────────
async function buscaMinhareceita(cnae, uf, municipio, cursor) {
  const p = new URLSearchParams({ uf: uf.toUpperCase(), cnae_fiscal: cnae, limit: '1000' })
  if (municipio) p.set('municipio', municipio)
  if (cursor) p.set('cursor', cursor)

  const r = await fetch(`https://minhareceita.org/?${p}`)
  if (!r.ok) throw new Error(`minhareceita HTTP ${r.status}`)
  return r.json()
}

function mapMinhareceita(e) {
  const cnpj = (e.cnpj||'').replace(/\D/g,'')
  const s = Array.isArray(e.qsa) && e.qsa.length ? e.qsa[0] : null

  return {
    id: `rf_${cnpj}`,
    nome: e.razao_social||'',
    fantasia: e.nome_fantasia||e.razao_social||'',
    responsavel: s?.nome_socio||'',
    cnpj,
    telefone: '',
    email: e.email||'',
    logradouro: e.logradouro||'',
    numero: e.numero||'',
    bairro: e.bairro||'',
    cidade: e.municipio||'',
    uf: e.uf||'',
    cep: (e.cep||'').replace(/\D/g,''),
    atividade: e.cnae_fiscal_descricao||'',
    cnae: String(e.cnae_fiscal||''),
    situacao: e.situacao_cadastral||'',
    dataInicio: e.data_inicio_atividade||'',
    fonte: 'Receita Federal'
  }
}

// ── HANDLER ─────────────────────────────────────────────────────────
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({error:'Método não permitido'})

  const { nicho, cnaeManual, uf, cidade, bairro, logradouro, situacaoFiltro, dataInicioDe, dataInicioAte } = req.body||{}

  if (!uf?.trim()) return res.status(400).json({error:'UF é obrigatória'})
  if (!nicho?.trim() && !cnaeManual?.trim()) return res.status(400).json({error:'Informe o nicho ou o CNAE'})

  let cnaes = cnaeManual?.trim()
    ? cnaeManual.split(',').map(c=>c.trim()).filter(Boolean).slice(0,6)
    : getCnaes(nicho.trim())

  const municipioCod = codIbge(cidade||'')
  const resultados = []
  const vistos = new Set()
  const logErros = []
  let totalBruto = 0

  for (const cnae of cnaes) {
    let cursor = null
    let continua = true

    while (continua) {
      try {
        const data = await buscaMinhareceita(cnae, uf.trim(), municipioCod||undefined, cursor)
        const lista = data?.data || []

        totalBruto += lista.length

        for (const emp of lista) {
          if (!emp) continue

          const cnpj = (emp.cnpj||'').replace(/\D/g,'')
          if (!cnpj || vistos.has(cnpj)) continue
          vistos.add(cnpj)

          // ✅ CORREÇÃO SITUAÇÃO
          const sitCode = Number(emp.situacao_cadastral)
          const isAtiva = sitCode === 2
          const isInativa = [3,4,8].includes(sitCode)

          if (situacaoFiltro==='ativa' && !isAtiva) continue
          if (situacaoFiltro==='inativa' && !isInativa) continue

          // ✅ CORREÇÃO DATA
          const di = emp.data_inicio_atividade||''
          const diDate = di ? new Date(di) : null

          if (dataInicioDe && diDate && diDate < new Date(dataInicioDe)) continue
          if (dataInicioAte && diDate && diDate > new Date(dataInicioAte)) continue

          if (bairro && !(emp.bairro||'').toLowerCase().includes(bairro.toLowerCase())) continue
          if (logradouro && !(emp.logradouro||'').toLowerCase().includes(logradouro.toLowerCase())) continue

          const lead = mapMinhareceita(emp)
          resultados.push(lead)
        }

        cursor = data?.cursor || null
        continua = !!cursor
        if (continua) await sleep(300)

      } catch(e) {
        logErros.push(`cnae=${cnae}: ${e.message}`)
        continua = false
      }
    }
  }

  const aviso = resultados.length === 0 ? [
    `Nenhuma empresa encontrada para "${nicho||cnaeManual}" em ${uf}`,
    '',
    'Diagnóstico:',
    `• CNAEs pesquisados: ${cnaes.join(', ')}`,
    totalBruto>0 ? `• ${totalBruto} registros encontrados mas filtrados pelos critérios` : null,
    logErros.length ? `• Erros de API: ${logErros.join(' | ')}` : null,
  ].filter(Boolean).join('\n') : null

  return res.status(200).json({
    resultados,
    total: resultados.length,
    totalBruto,
    cnaes,
    aviso,
    ...(logErros.length?{erros:logErros}:{})
  })
}
