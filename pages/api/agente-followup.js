// pages/api/agente-followup.js
// ══════════════════════════════════════════════════════
// Agente IA de Follow-up do CRM
//
// Funções:
//  1. POST { acao: 'briefing_diario', empresaId }
//     → Envia resumo do dia via WhatsApp para cada vendedor
//
//  2. POST { acao: 'followup_parado', empresaId, negocioId? }
//     → Verifica negócios parados e envia WhatsApp ao cliente
//
//  3. POST { acao: 'negociar', empresaId, negocioId, mensagemCliente }
//     → IA responde ao cliente como assistente de vendas
//
// Configure um cron job no Vercel (vercel.json) ou Upstash para
// chamar este endpoint todos os dias às 08:00.
// ══════════════════════════════════════════════════════

import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

const DIAS_PARADO_ALERTA = 3  // dias sem atualização para acionar follow-up

// ── Helpers ──────────────────────────────────────────

async function getCfg(empresaId) {
  const { data } = await supabase
    .from('vx_storage').select('value').eq('key', `cfg:${empresaId}`).single()
  return data?.value ? JSON.parse(data.value) : {}
}

async function saveCfg(empresaId, cfg) {
  await supabase.from('vx_storage').upsert(
    { key: `cfg:${empresaId}`, value: JSON.stringify(cfg), updated_at: new Date().toISOString() },
    { onConflict: 'key' }
  )
}

function diasDesde(dataStr) {
  if (!dataStr) return 999
  return Math.floor((Date.now() - new Date(dataStr).getTime()) / 86400000)
}

function fmtData(d) {
  return new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

async function chamarIA(prompt, apiKey, fallbackKey) {
  // Tenta Gemini primeiro, depois Groq
  if (apiKey) {
    try {
      const r = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
        { method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }) }
      )
      const d = await r.json()
      const txt = d.candidates?.[0]?.content?.parts?.[0]?.text
      if (txt) return txt.trim()
    } catch {}
  }
  if (fallbackKey) {
    try {
      const r = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${fallbackKey}` },
        body: JSON.stringify({ model: 'llama3-8b-8192', messages: [{ role: 'user', content: prompt }], max_tokens: 600 })
      })
      const d = await r.json()
      return d.choices?.[0]?.message?.content?.trim() || ''
    } catch {}
  }
  return null
}

async function enviarWhatsApp(numero, mensagem, whatsappToken, whatsappNumber) {
  // Suporta Evolution API (whatsappToken = url:token)
  if (!numero || !mensagem || !whatsappToken) return false
  try {
    const num = numero.replace(/\D/g, '')
    const full = num.startsWith('55') ? num : `55${num}`
    const [url, token] = whatsappToken.includes('|') ? whatsappToken.split('|') : [whatsappToken, '']

    const resp = await fetch(`${url}/message/sendText/${whatsappNumber || 'default'}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: token },
      body: JSON.stringify({ number: full, text: mensagem })
    })
    return resp.ok
  } catch (e) {
    console.error('Erro WhatsApp:', e.message)
    return false
  }
}

// ── Gera resumo do negócio para o prompt da IA ───────

function resumoNegocio(neg, cfg) {
  const etapas = cfg.crm_etapas || []
  const etapaLabel = etapas.find(e => e.id === neg.etapa)?.label || neg.etapa || '—'
  const obs = (neg.observacoes || '').slice(0, 300)
  const atividades = (cfg.crm_atividades || [])
    .filter(a => a.negocioId === neg.id)
    .sort((a, b) => new Date(b.data) - new Date(a.data))
    .slice(0, 3)
    .map(a => `[${fmtData(a.data)}] ${a.tipo}: ${a.descricao}`)
    .join('\n')

  return `
NEGÓCIO: ${neg.titulo}
Cliente: ${neg.nome || neg.razao || '—'} | CNPJ/CPF: ${neg.cnpj || neg.cpf || '—'}
Etapa: ${etapaLabel}
Adesão: R$ ${neg.adesao || 0} | Mensalidade: R$ ${neg.mensalidade || 0}
Última atualização: ${neg.updatedAt ? fmtData(neg.updatedAt) : '—'} (${diasDesde(neg.updatedAt)} dias atrás)
Observações: ${obs || '—'}
Últimas atividades:
${atividades || 'Nenhuma atividade registrada.'}
`.trim()
}

// ── AÇÃO 1: Briefing diário ───────────────────────────

async function briefingDiario(empresaId) {
  const cfg = await getCfg(empresaId)
  const negocios = cfg.crm_negocios || []
  const etapas = cfg.crm_etapas || []
  const hoje = new Date()
  const hojeStr = hoje.toISOString().slice(0, 10)

  const ativHoje = (cfg.crm_atividades || []).filter(a => a.data?.slice(0, 10) === hojeStr)
  const negParados = negocios.filter(n => !['fechamento', 'perdido'].includes(n.etapa) && diasDesde(n.updatedAt) >= DIAS_PARADO_ALERTA)
  const negFechamento = negocios.filter(n => n.etapa === 'fechamento')

  const prompt = `
Você é um assistente comercial inteligente da empresa ${cfg.company || 'Vivanexa'}.
Hoje é ${hoje.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })}.

Gere um briefing RESUMIDO em WhatsApp (máx 400 caracteres, sem markdown, direto ao ponto) com:
- Qtd negócios ativos no pipeline
- Negócios em fechamento
- Negócios parados há mais de ${DIAS_PARADO_ALERTA} dias
- Atividades previstas para hoje
- Um conselho motivacional curto

DADOS:
- Total no pipeline: ${negocios.filter(n => n.etapa !== 'perdido').length}
- Em fechamento: ${negFechamento.length} negócios
- Parados: ${negParados.length} negócios (${negParados.map(n => n.titulo).slice(0, 3).join(', ')})
- Atividades hoje: ${ativHoje.length} (${ativHoje.map(a => a.descricao).slice(0, 2).join(', ')})
`

  const texto = await chamarIA(prompt, cfg.geminiKey || cfg.geminiApiKey, cfg.groqKey || cfg.groqApiKey)
  if (!texto) return { ok: false, erro: 'IA indisponível' }

  const wppToken = cfg.evolutionApiUrl && cfg.evolutionApiToken
    ? `${cfg.evolutionApiUrl}|${cfg.evolutionApiToken}` : null
  const vendedorTel = cfg.whatsappEmpresa || cfg.responsavelTelefone

  if (wppToken && vendedorTel) {
    await enviarWhatsApp(vendedorTel, `🤖 *BRIEFING DO DIA — ${hoje.toLocaleDateString('pt-BR')}*\n\n${texto}`, wppToken, cfg.evolutionInstance)
  }

  // Salva log do briefing
  const log = { data: hoje.toISOString(), tipo: 'briefing', texto }
  cfg.agenteLog = [...(cfg.agenteLog || []).slice(-29), log]
  await saveCfg(empresaId, cfg)

  return { ok: true, texto, enviado: !!(wppToken && vendedorTel) }
}

// ── AÇÃO 2: Follow-up de negócios parados ────────────

async function followupParado(empresaId, negocioId) {
  const cfg = await getCfg(empresaId)
  const negocios = cfg.crm_negocios || []

  const candidatos = negocioId
    ? negocios.filter(n => n.id === negocioId)
    : negocios.filter(n =>
        !['fechamento', 'perdido'].includes(n.etapa) &&
        diasDesde(n.updatedAt) >= DIAS_PARADO_ALERTA &&
        !n.agenteFollowupHoje
      )

  if (!candidatos.length) return { ok: true, msg: 'Nenhum negócio pendente de follow-up.' }

  const resultados = []
  const wppToken = cfg.evolutionApiUrl && cfg.evolutionApiToken
    ? `${cfg.evolutionApiUrl}|${cfg.evolutionApiToken}` : null

  for (const neg of candidatos.slice(0, 5)) { // máx 5 por vez
    const contexto = resumoNegocio(neg, cfg)
    const prompt = `
Você é um assistente comercial gentil da empresa ${cfg.company || 'Vivanexa'}.
Redija uma mensagem de follow-up para WhatsApp (máx 300 caracteres, informal, sem markdown, sem colchetes).
O objetivo é reativar o interesse do cliente de forma natural.
NÃO mencione que você é uma IA. Assine como a equipe comercial da empresa.

CONTEXTO DO NEGÓCIO:
${contexto}

A mensagem deve ser personalizada ao contexto. NÃO use template genérico.
`
    const mensagem = await chamarIA(prompt, cfg.geminiKey || cfg.geminiApiKey, cfg.groqKey || cfg.groqApiKey)
    if (!mensagem) continue

    let enviado = false
    if (wppToken && neg.telefone) {
      enviado = await enviarWhatsApp(neg.telefone, mensagem, wppToken, cfg.evolutionInstance)
    }

    // Marca como contatado hoje
    cfg.crm_negocios = cfg.crm_negocios.map(n =>
      n.id === neg.id ? { ...n, agenteFollowupHoje: new Date().toISOString().slice(0, 10), agenteEmNegociacao: true } : n
    )

    // Log da atividade
    const atividade = {
      id: 'ativ_' + Date.now() + '_' + neg.id,
      negocioId: neg.id,
      tipo: 'follow-up IA',
      descricao: `Agente IA enviou follow-up: "${mensagem.slice(0, 100)}..."`,
      data: new Date().toISOString(),
      userId: 'agente_ia',
    }
    cfg.crm_atividades = [...(cfg.crm_atividades || []), atividade]

    resultados.push({ negocioId: neg.id, titulo: neg.titulo, mensagem, enviado })
  }

  await saveCfg(empresaId, cfg)
  return { ok: true, resultados }
}

// ── AÇÃO 3: Negociar (IA responde ao cliente) ─────────

async function negociar(empresaId, negocioId, mensagemCliente, retornarParaVendedor = false) {
  const cfg = await getCfg(empresaId)
  const neg = (cfg.crm_negocios || []).find(n => n.id === negocioId)
  if (!neg) return { ok: false, erro: 'Negócio não encontrado' }

  if (retornarParaVendedor) {
    // Desliga o agente e notifica o vendedor
    cfg.crm_negocios = cfg.crm_negocios.map(n =>
      n.id === negocioId ? { ...n, agenteEmNegociacao: false } : n
    )
    const wppToken = cfg.evolutionApiUrl && cfg.evolutionApiToken
      ? `${cfg.evolutionApiUrl}|${cfg.evolutionApiToken}` : null
    const vendedorTel = cfg.whatsappEmpresa || cfg.responsavelTelefone
    if (wppToken && vendedorTel) {
      await enviarWhatsApp(vendedorTel,
        `🔔 *Agente IA — Retorno ao vendedor*\n\nO cliente *${neg.nome || neg.titulo}* demonstrou interesse!\n\nÚltima mensagem: "${mensagemCliente}"\n\n➡️ Acesse o CRM para continuar a negociação.`,
        wppToken, cfg.evolutionInstance)
    }
    await saveCfg(empresaId, cfg)
    return { ok: true, retornouParaVendedor: true }
  }

  const contexto = resumoNegocio(neg, cfg)
  const prompt = `
Você é um assistente comercial especializado da empresa ${cfg.company || 'Vivanexa'}.
Responda à mensagem do cliente de forma natural, persuasiva e cordial (máx 350 caracteres, sem markdown).
NÃO mencione que é uma IA. Se o cliente confirmar interesse em fechar, diga que vai passar para o consultor.

CONTEXTO DO NEGÓCIO:
${contexto}

MENSAGEM DO CLIENTE: "${mensagemCliente}"

Decida também: o cliente está pronto para fechar? Responda no formato:
MENSAGEM: [sua resposta]
PRONTO_PARA_FECHAR: sim/não
`

  const resposta = await chamarIA(prompt, cfg.geminiKey || cfg.geminiApiKey, cfg.groqKey || cfg.groqApiKey)
  if (!resposta) return { ok: false, erro: 'IA indisponível' }

  const msgMatch = resposta.match(/MENSAGEM:\s*(.+?)(?:\n|$)/s)
  const prontoMatch = resposta.match(/PRONTO_PARA_FECHAR:\s*(sim|não)/i)
  const mensagemResposta = msgMatch?.[1]?.trim() || resposta.split('\n')[0]
  const prontoParaFechar = prontoMatch?.[1]?.toLowerCase() === 'sim'

  const wppToken = cfg.evolutionApiUrl && cfg.evolutionApiToken
    ? `${cfg.evolutionApiUrl}|${cfg.evolutionApiToken}` : null

  if (wppToken && neg.telefone) {
    await enviarWhatsApp(neg.telefone, mensagemResposta, wppToken, cfg.evolutionInstance)
  }

  // Registra atividade
  const atividade = {
    id: 'ativ_neg_' + Date.now(),
    negocioId: neg.id,
    tipo: 'negociação IA',
    descricao: `Cliente: "${mensagemCliente}" → IA: "${mensagemResposta.slice(0, 80)}..."`,
    data: new Date().toISOString(),
    userId: 'agente_ia',
  }
  cfg.crm_atividades = [...(cfg.crm_atividades || []), atividade]

  if (prontoParaFechar) {
    // Notifica vendedor
    const vendedorTel = cfg.whatsappEmpresa || cfg.responsavelTelefone
    if (wppToken && vendedorTel) {
      await enviarWhatsApp(vendedorTel,
        `🎯 *Lead quente! Agente IA detectou interesse de fechamento*\n\nCliente: *${neg.nome || neg.titulo}*\nMensagem: "${mensagemCliente}"\n\n👉 Entre em contato agora!`,
        wppToken, cfg.evolutionInstance)
    }
    cfg.crm_negocios = cfg.crm_negocios.map(n =>
      n.id === negocioId ? { ...n, agenteEmNegociacao: false, etapa: 'fechamento', updatedAt: new Date().toISOString() } : n
    )
  }

  await saveCfg(empresaId, cfg)
  return { ok: true, mensagemResposta, prontoParaFechar, enviado: !!(wppToken && neg.telefone) }
}

// ── Handler principal ─────────────────────────────────

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método não permitido' })

  const { acao, empresaId, negocioId, mensagemCliente, retornarParaVendedor } = req.body

  if (!acao || !empresaId) return res.status(400).json({ error: 'acao e empresaId são obrigatórios' })

  try {
    switch (acao) {
      case 'briefing_diario':
        return res.json(await briefingDiario(empresaId))

      case 'followup_parado':
        return res.json(await followupParado(empresaId, negocioId))

      case 'negociar':
        return res.json(await negociar(empresaId, negocioId, mensagemCliente, retornarParaVendedor))

      default:
        return res.status(400).json({ error: `Ação desconhecida: ${acao}` })
    }
  } catch (err) {
    console.error('Agente follow-up erro:', err)
    return res.status(500).json({ error: err.message })
  }
}
