// pages/api/leads/buscar-receita.js
// ═══════════════════════════════════════════════════════════════════════

const sleep = ms => new Promise(r => setTimeout(r, ms))

// ── MAPEAMENTO NICHO → CNAE ───────────────────────────────────────────
const NICHO_CNAE = {
  'contab': ['6920601','6920602'],
  'contador': ['6920601','6920602'],
  'contabilidade':['6920601','6920602'],
}

// ── NORMALIZAÇÃO ─────────────────────────────────────────────────────
function normStr(s) {
  return String(s).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim()
}

function getCnaes(nicho) {
  const t = normStr(nicho)
  const set = new Set()
  for (const [key, codes] of Object.entries(NICHO_CNAE)) {
    const k = normStr(key)
    if (t.includes(k)) codes.forEach(c => set.add(c))
  }
  return [...set]
}

// ── IBGE ─────────────────────────────────────────────────────────────
const IBGE = {
  'vila velha':'3205200'
}
function codIbge(cidade) {
  return IBGE[normStr(cidade)] || null
}

// ── API ──────────────────────────────────────────────────────────────
async function buscaMinhareceita(cnae, uf, municipio, cursor) {
  const p = new URLSearchParams({
    uf: uf.toUpperCase(),
    cnae_fiscal: cnae,
    limit: '1000'
  })

  if (municipio) p.set('municipio', municipio)
  if (cursor) p.set('cursor', cursor)

  const url = `https://minhareceita.org/?${p}`
  console.log('URL:', url)

  const r = await fetch(url)
  if (!r.ok) throw new Error(`HTTP ${r.status}`)
  return r.json()
}

// ── MAP ──────────────────────────────────────────────────────────────
function mapMinhareceita(e) {
  const cnpj = (e.cnpj||'').replace(/\D/g,'')
  const s = Array.isArray(e.qsa) && e.qsa.length ? e.qsa[0] : null

  return {
    id: `rf_${cnpj}`,
    nome: e.razao_social || '',
    fantasia: e.nome_fantasia || '',
    responsavel: s?.nome_socio || '',
    cnpj,
    telefone: '',
    email: e.email || '',
    logradouro: e.logradouro || '',
    numero: e.numero || '',
    bairro: e.bairro || '',
    cidade: e.municipio || '',
    uf: e.uf || '',
    cep: (e.cep || '').replace(/\D/g,''),
    atividade: e.cnae_fiscal_descricao || '',
    cnae: String(e.cnae_fiscal || ''),
    situacao: e.situacao_cadastral || '',
    dataInicio: e.data_inicio_atividade || '',
    fonte: 'Receita Federal'
  }
}

// ── HANDLER ──────────────────────────────────────────────────────────
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({error:'Método não permitido'})

  const { nicho, cnaeManual, uf, cidade, bairro, logradouro, situacaoFiltro, dataInicioDe, dataInicioAte } = req.body||{}

  if (!uf?.trim()) return res.status(400).json({error:'UF é obrigatória'})
  if (!nicho?.trim() && !cnaeManual?.trim()) return res.status(400).json({error:'Informe o nicho ou o CNAE'})

  let cnaes = cnaeManual?.trim()
    ? cnaeManual.split(',').map(c=>c.trim()).filter(Boolean)
    : getCnaes(nicho)

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
        const data = await buscaMinhareceita(cnae, uf, municipioCod, cursor)
        const lista = data?.data || []

        totalBruto += lista.length

        for (const emp of lista) {
          if (!emp) continue

          const cnpj = (emp.cnpj||'').replace(/\D/g,'')
          if (!cnpj || vistos.has(cnpj)) continue
          vistos.add(cnpj)

          // ── CORREÇÃO SITUAÇÃO ──
          const sitCode = Number(emp.situacao_cadastral)

          const isAtiva = sitCode === 2
          const isInativa = [3,4,8].includes(sitCode)

          if (situacaoFiltro === 'ativa' && !isAtiva) continue
          if (situacaoFiltro === 'inativa' && !isInativa) continue

          // ── CORREÇÃO DATA ──
          const di = emp.data_inicio_atividade || ''
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

        await sleep(200)

      } catch (e) {
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
    aviso
  })
}
