// pages/api/agente-followup.js
// ══════════════════════════════════════════════════════
// Agente IA de Follow-up do CRM v3
//
// Funções:
//  1. POST { acao: 'briefing_diario', empresaId, instanciaOverride? }
//     → Envia resumo do dia via WhatsApp para cada vendedor (usa cfg.users[].telefone)
//
//  2. POST { acao: 'followup_parado', empresaId, negocioId?, instanciaOverride? }
//     → Verifica negócios parados e envia WhatsApp ao cliente
//
//  3. POST { acao: 'followup_tarefas', empresaId, instanciaOverride? }
//     → Verifica atividades/tarefas atrasadas ou para hoje e envia lembrete
//
//  4. POST { acao: 'negociar', empresaId, negocioId, mensagemCliente, retornarParaVendedor? }
//     → IA responde ao cliente como assistente de vendas
//
//  5. POST { acao: 'automacao_etapa', empresaId, negocioId, etapaId }
//     → Executa automações configuradas para a etapa (email/WhatsApp)
//
//  6. POST { acao: 'resposta_briefing', empresaId, mensagem, usuarioTelefone }
//     → Recebe resposta do vendedor ao briefing via WhatsApp e executa ação
// ══════════════════════════════════════════════════════

import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

const DIAS_PARADO_ALERTA = 3

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

function limparNumero(n) {
  if (!n) return ''
  const d = String(n).replace(/\D/g, '')
  if (d.length === 10 || d.length === 11) return '55' + d
  return d
}

// ── Seleciona a instância Evolution correta ──────────
// Prioridade: instanciaOverride → agente marcado usarParaFollowup → primeiro ativo
function getWppConfig(cfg, instanciaOverride) {
  const agentes = cfg.wppAgentes || []

  let agente = null
  if (instanciaOverride) {
    agente = agentes.find(a => a.instancia === instanciaOverride && a.ativo)
  }
  if (!agente) agente = agentes.find(a => a.usarParaFollowup && a.ativo)
  if (!agente) agente = agentes.find(a => a.ativo)

  // Resolve URL e token: agente individual ou fallback global
  const evolutionUrl   = agente?.evolutionUrl   || cfg.evolutionApiUrl   || cfg.wppInbox?.evolutionUrl   || ''
  const evolutionToken = agente?.evolutionToken || cfg.evolutionApiToken || cfg.wppInbox?.evolutionKey   || ''
  const instancia      = agente?.instancia      || cfg.evolutionInstance || cfg.wppInbox?.instancia       || 'default'

  const wppToken = evolutionUrl && evolutionToken ? `${evolutionUrl}|${evolutionToken}` : null

  return { wppToken, instancia, agente }
}

// ── Telefone do vendedor dono dos negócios (usuário logado) ──
// Para usuário comum: usa cfg.users[].telefone do usuário que possui os negócios
// Fallback: cfg.whatsappEmpresa ou cfg.responsavelTelefone
function getTelefoneVendedor(cfg, userId) {
  const users = cfg.users || []

  // Tenta pelo userId
  if (userId) {
    const u = users.find(u => u.id === userId || u.email === userId)
    if (u?.telefone) return limparNumero(u.telefone)
  }

  // Tenta primeiro usuário admin com telefone
  const admin = users.find(u => u.tipo === 'admin' && u.telefone)
  if (admin?.telefone) return limparNumero(admin.telefone)

  // Fallback global
  const global = cfg.whatsappEmpresa || cfg.responsavelTelefone || cfg.telefoneEmp || ''
  return limparNumero(global)
}

// ── Retorna todos os telefones de vendedores com negócios ──
function getTelefonesVendedores(cfg) {
  const users = cfg.users || []
  const tels = []

  for (const u of users) {
    if (u?.telefone) {
      tels.push({ nome: u.nome || u.email, telefone: limparNumero(u.telefone), userId: u.id })
    }
  }

  // Se não houver nenhum, usa o telefone global
  if (tels.length === 0) {
    const global = limparNumero(cfg.whatsappEmpresa || cfg.responsavelTelefone || cfg.telefoneEmp || '')
    if (global) tels.push({ nome: cfg.company || 'Admin', telefone: global, userId: null })
  }

  return tels
}

// ── Seleciona o agente de IA configurado para follow-up ──
function getAgenteFollowup(cfg) {
  const agentes = cfg.wppAgentes || []
  const agenteFollowup = agentes.find(a => a.usarParaFollowup && a.ativo)
  const agentePadrao   = agentes.find(a => a.ativo)
  const agente = agenteFollowup || agentePadrao || null

  const geminiKey = agente?.geminiKey || cfg.geminiApiKey || cfg.geminiKey || process.env.GEMINI_API_KEY || ''
  const groqKey   = agente?.groqKey   || cfg.groqApiKey   || cfg.groqKey   || process.env.GROQ_API_KEY   || ''
  const openaiKey = agente?.openaiKey || cfg.openaiApiKey  || cfg.openaiKey  || process.env.OPENAI_API_KEY  || ''
  const promptBase = agente?.prompt || ''

  return { agente, geminiKey, groqKey, openaiKey, promptBase }
}

async function chamarIA(prompt, cfg) {
  const { geminiKey, groqKey, openaiKey, agente } = getAgenteFollowup(cfg)

  if (openaiKey) {
    try {
      const model = agente?.provider === 'openai' ? (agente.model || 'gpt-4o-mini') : 'gpt-4o-mini'
      const r = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${openaiKey}` },
        body: JSON.stringify({ model, messages: [{ role: 'user', content: prompt }], max_tokens: 600, temperature: 0.7 })
      })
      const d = await r.json()
      const txt = d.choices?.[0]?.message?.content?.trim()
      if (txt) return txt
    } catch {}
  }

  if (geminiKey) {
    try {
      const model = agente?.provider === 'gemini' ? (agente.model || 'gemini-2.0-flash') : 'gemini-2.0-flash'
      const r = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${geminiKey}`,
        { method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }) }
      )
      const d = await r.json()
      const txt = d.candidates?.[0]?.content?.parts?.[0]?.text
      if (txt) return txt.trim()
    } catch {}
  }

  if (groqKey) {
    try {
      const model = agente?.provider === 'groq' ? (agente.model || 'llama3-8b-8192') : 'llama3-8b-8192'
      const r = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${groqKey}` },
        body: JSON.stringify({ model, messages: [{ role: 'user', content: prompt }], max_tokens: 600 })
      })
      const d = await r.json()
      return d.choices?.[0]?.message?.content?.trim() || null
    } catch {}
  }

  return null
}

async function enviarWhatsApp(numero, mensagem, wppToken, instanceName) {
  if (!numero || !mensagem || !wppToken) return false
  try {
    const num = limparNumero(numero)
    if (!num) return false
    const [url, token] = wppToken.includes('|') ? wppToken.split('|') : [wppToken, '']

    const resp = await fetch(`${url}/message/sendText/${instanceName || 'default'}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: token },
      body: JSON.stringify({ number: num, text: mensagem })
    })
    return resp.ok
  } catch (e) {
    console.error('Erro WhatsApp:', e.message)
    return false
  }
}

async function enviarEmailAuto(para, assunto, htmlCorpo, cfg) {
  if (!para || !assunto) return false
  try {
    const resolvedApiKey = cfg.emailApiKey || cfg.apiKey || cfg.brevoApiKey || cfg.api_key || cfg.smtpPass || ''
    const hasEmailConfig = cfg.smtpHost || resolvedApiKey || cfg.emailProvider === 'brevo'
    if (!hasEmailConfig) return false

    const smtpCfg = {
      smtpHost: cfg.smtpHost || 'smtp-relay.brevo.com',
      smtpPort: cfg.smtpPort || 587,
      smtpUser: cfg.smtpUser || 'apikey',
      smtpPass: cfg.smtpPass || '',
      emailApiKey: resolvedApiKey,
      apiKey: resolvedApiKey,
      emailProvider: cfg.emailProvider || '',
      emailRemetente: cfg.emailRemetente || cfg.smtpFrom || cfg.emailEmpresa || '',
      nomeRemetente: cfg.company || 'Vivanexa',
      company: cfg.company || 'Vivanexa'
    }

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL
      || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000')

    const resp = await fetch(`${baseUrl}/api/send-email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ to: para, subject: assunto, html: htmlCorpo, config: smtpCfg })
    })
    const r = await resp.json()
    return r.success && !r.fallback
  } catch (e) {
    console.error('Erro email automação:', e.message)
    return false
  }
}

function resumoNegocio(neg, cfg) {
  const etapas = cfg.crm_etapas || []
  const etapaLabel = etapas.find(e => e.id === neg.etapa)?.label || neg.etapa || '—'
  const obs = (neg.observacoes || '').slice(0, 300)
  const atividades = (cfg.crm_atividades || [])
    .filter(a => a.negocioId === neg.id)
    .sort((a, b) => new Date(b.data || b.criadoEm) - new Date(a.data || a.criadoEm))
    .slice(0, 3)
    .map(a => `[${fmtData(a.data || a.criadoEm)}] ${a.tipo}: ${a.descricao}`)
    .join('\n')

  return `
NEGÓCIO: ${neg.titulo}
Cliente: ${neg.nome || neg.razao || '—'} | CNPJ/CPF: ${neg.cnpj || neg.cpf || '—'}
E-mail: ${neg.email || '—'} | Telefone: ${neg.telefone || '—'}
Etapa: ${etapaLabel}
Adesão: R$ ${neg.adesao || 0} | Mensalidade: R$ ${neg.mensalidade || 0}
Última atualização: ${neg.atualizadoEm ? fmtData(neg.atualizadoEm) : '—'} (${diasDesde(neg.atualizadoEm)} dias atrás)
Observações: ${obs || '—'}
Últimas atividades:
${atividades || 'Nenhuma atividade registrada.'}
`.trim()
}

// ── AÇÃO 1: Briefing diário ───────────────────────────
// Envia para CADA usuário com telefone cadastrado o resumo dos SEUS negócios

async function briefingDiario(empresaId, instanciaOverride) {
  const cfg = await getCfg(empresaId)
  const negocios   = cfg.crm_negocios   || []
  const atividades = cfg.crm_atividades || []
  const hoje = new Date()
  const hojeStr = hoje.toISOString().slice(0, 10)

  const { wppToken, instancia } = getWppConfig(cfg, instanciaOverride)
  const { promptBase } = getAgenteFollowup(cfg)

  // Obtém lista de vendedores com telefone
  const vendedores = getTelefonesVendedores(cfg)
  if (!vendedores.length) return { ok: false, erro: 'Nenhum usuário com telefone cadastrado. Configure em Config → Usuários.' }

  const resultados = []

  for (const vendedor of vendedores) {
    // Tarefas de hoje (globais — sem filtro por usuário para simplificar)
    const tarefasHoje     = atividades.filter(a => !a.concluida && a.prazo && a.prazo.slice(0, 10) === hojeStr)
    const tarefasAtrasadas= atividades.filter(a => !a.concluida && a.prazo && new Date(a.prazo) < new Date() && a.prazo.slice(0, 10) !== hojeStr)
    const negParados      = negocios.filter(n => !['fechamento', 'perdido'].includes(n.etapa) && diasDesde(n.atualizadoEm || n.updatedAt) >= DIAS_PARADO_ALERTA)
    const negFechamento   = negocios.filter(n => n.etapa === 'fechamento')
    const negAtivos       = negocios.filter(n => !['perdido'].includes(n.etapa))

    const tarefasHojeDetalhes = tarefasHoje.slice(0, 5).map(a => {
      const neg = negocios.find(n => n.id === a.negocioId)
      return `• ${a.tipo}: ${a.descricao.slice(0, 60)}${neg ? ` [${neg.titulo}]` : ''}`
    }).join('\n')

    const prompt = `
${promptBase ? `Contexto do agente:\n${promptBase}\n\n` : ''}Você é um assistente comercial inteligente da empresa ${cfg.company || 'Vivanexa'}.
Hoje é ${hoje.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })}.

Gere um briefing RESUMIDO para WhatsApp (máx 600 caracteres, sem markdown, use emojis e quebras de linha).
No final, adicione exatamente esta linha:
"Responda: *1* Rodar follow-ups | *2* Ver parados | *3* Fechar briefing"

Estruture assim:
📊 Pipeline: X negócios ativos
🎯 Fechamento: X oportunidades
⚠️ Parados: X negócios
📅 Hoje: X tarefas
⚡ Atrasadas: X tarefas
[Uma sugestão prática de ação prioritária]

DADOS:
- Total ativo: ${negAtivos.length}
- Em fechamento: ${negFechamento.length}
- Parados +${DIAS_PARADO_ALERTA}d: ${negParados.length} (${negParados.map(n => n.titulo).slice(0, 3).join(', ')})
- Tarefas hoje: ${tarefasHoje.length}
${tarefasHojeDetalhes ? `Detalhes tarefas:\n${tarefasHojeDetalhes}` : ''}
- Tarefas atrasadas: ${tarefasAtrasadas.length}
- Negócio prioritário: ${negFechamento[0]?.titulo || negParados[0]?.titulo || 'Nenhum crítico'}
`
    const texto = await chamarIA(prompt, cfg)
    if (!texto) {
      resultados.push({ vendedor: vendedor.nome, enviado: false, erro: 'IA indisponível' })
      continue
    }

    let enviado = false
    if (wppToken && vendedor.telefone) {
      enviado = await enviarWhatsApp(
        vendedor.telefone,
        `🤖 *BRIEFING DO DIA — ${hoje.toLocaleDateString('pt-BR')}*\n\nOlá, ${vendedor.nome}! 👋\n\n${texto}`,
        wppToken,
        instancia
      )
    }

    resultados.push({ vendedor: vendedor.nome, telefone: vendedor.telefone, enviado, texto })
  }

  // Salva log
  const log = { data: hoje.toISOString(), tipo: 'briefing', resultados: resultados.length }
  cfg.agenteLog = [...(cfg.agenteLog || []).slice(-29), log]
  await saveCfg(empresaId, cfg)

  const textoUltimo = resultados[0]?.texto || ''
  const totalEnviados = resultados.filter(r => r.enviado).length
  return { ok: true, texto: textoUltimo, enviado: totalEnviados > 0, totalEnviados, resultados }
}

// ── AÇÃO 2: Follow-up de negócios parados ────────────

async function followupParado(empresaId, negocioId, instanciaOverride) {
  const cfg = await getCfg(empresaId)
  const negocios = cfg.crm_negocios || []

  const candidatos = negocioId
    ? negocios.filter(n => n.id === negocioId)
    : negocios.filter(n =>
        !['fechamento', 'perdido'].includes(n.etapa) &&
        diasDesde(n.atualizadoEm || n.updatedAt) >= DIAS_PARADO_ALERTA &&
        !n.agenteFollowupHoje
      )

  if (!candidatos.length) return { ok: true, msg: 'Nenhum negócio pendente de follow-up.' }

  const { wppToken, instancia } = getWppConfig(cfg, instanciaOverride)
  const { promptBase } = getAgenteFollowup(cfg)
  const resultados = []

  for (const neg of candidatos.slice(0, 5)) {
    const contexto = resumoNegocio(neg, cfg)
    const prompt = `
${promptBase ? `Contexto do agente:\n${promptBase}\n\n` : ''}Você é um assistente comercial gentil da empresa ${cfg.company || 'Vivanexa'}.
Redija uma mensagem de follow-up para WhatsApp (máx 300 caracteres, informal, sem markdown, sem colchetes).
O objetivo é reativar o interesse do cliente de forma natural e personalizada.
NÃO mencione que você é uma IA. Assine como a equipe comercial da empresa.

CONTEXTO DO NEGÓCIO:
${contexto}
`
    const mensagem = await chamarIA(prompt, cfg)
    if (!mensagem) continue

    let enviado = false
    if (wppToken && neg.telefone) {
      enviado = await enviarWhatsApp(neg.telefone, mensagem, wppToken, instancia)
    }

    cfg.crm_negocios = cfg.crm_negocios.map(n =>
      n.id === neg.id ? { ...n, agenteFollowupHoje: new Date().toISOString().slice(0, 10), agenteEmNegociacao: true } : n
    )

    const atividade = {
      id: 'ativ_' + Date.now() + '_' + neg.id,
      negocioId: neg.id, tipo: 'Follow-up',
      descricao: `Agente IA enviou follow-up: "${mensagem.slice(0, 100)}..."`,
      data: new Date().toISOString(), criadoEm: new Date().toISOString(), userId: 'agente_ia',
    }
    cfg.crm_atividades = [...(cfg.crm_atividades || []), atividade]
    resultados.push({ negocioId: neg.id, titulo: neg.titulo, mensagem, enviado })
  }

  await saveCfg(empresaId, cfg)
  return { ok: true, resultados }
}

// ── AÇÃO 3: Follow-up de TAREFAS atrasadas / para hoje ──

async function followupTarefas(empresaId, instanciaOverride) {
  const cfg = await getCfg(empresaId)
  const atividades = cfg.crm_atividades || []
  const negocios   = cfg.crm_negocios   || []
  const hoje = new Date()
  const hojeStr = hoje.toISOString().slice(0, 10)

  const tarefasCriticas = atividades.filter(a => {
    if (a.concluida) return false
    if (!a.prazo) return false
    const prazoDate = new Date(a.prazo)
    return prazoDate < hoje || a.prazo.slice(0, 10) === hojeStr
  })

  if (!tarefasCriticas.length) return { ok: true, msg: 'Nenhuma tarefa crítica no momento.' }

  const { wppToken, instancia } = getWppConfig(cfg, instanciaOverride)
  const vendedores = getTelefonesVendedores(cfg)
  const { promptBase } = getAgenteFollowup(cfg)

  const atrasadas = tarefasCriticas.filter(a => new Date(a.prazo) < hoje && a.prazo.slice(0, 10) !== hojeStr)
  const deHoje    = tarefasCriticas.filter(a => a.prazo.slice(0, 10) === hojeStr)

  const prompt = `
${promptBase ? `Contexto do agente:\n${promptBase}\n\n` : ''}Você é um assistente comercial da empresa ${cfg.company || 'Vivanexa'}.
Crie uma mensagem de alerta de tarefas para WhatsApp (máx 450 caracteres, direto, use emojis, sem markdown).

TAREFAS ATRASADAS (${atrasadas.length}):
${atrasadas.slice(0, 3).map(a => {
  const neg = negocios.find(n => n.id === a.negocioId)
  return `- ${a.tipo}: ${a.descricao.slice(0, 50)}${neg ? ` [${neg.titulo}]` : ''} (${Math.floor((hoje - new Date(a.prazo)) / 86400000)}d atrasada)`
}).join('\n') || 'Nenhuma'}

TAREFAS PARA HOJE (${deHoje.length}):
${deHoje.slice(0, 3).map(a => {
  const neg = negocios.find(n => n.id === a.negocioId)
  return `- ${a.tipo}: ${a.descricao.slice(0, 50)}${neg ? ` [${neg.titulo}]` : ''}`
}).join('\n') || 'Nenhuma'}
`
  const texto = await chamarIA(prompt, cfg)
  if (!texto) return { ok: false, erro: 'IA indisponível' }

  let totalEnviados = 0
  for (const vendedor of vendedores) {
    if (wppToken && vendedor.telefone) {
      const ok = await enviarWhatsApp(
        vendedor.telefone,
        `📋 *ALERTA DE TAREFAS — ${hoje.toLocaleDateString('pt-BR')}*\n\n${texto}`,
        wppToken, instancia
      )
      if (ok) totalEnviados++
    }
  }

  const log = { data: hoje.toISOString(), tipo: 'followup_tarefas', texto, atrasadas: atrasadas.length, deHoje: deHoje.length }
  cfg.agenteLog = [...(cfg.agenteLog || []).slice(-29), log]
  await saveCfg(empresaId, cfg)

  return { ok: true, texto, enviado: totalEnviados > 0, totalEnviados, atrasadas: atrasadas.length, deHoje: deHoje.length }
}

// ── AÇÃO 4: Negociar (IA responde ao cliente) ─────────

async function negociar(empresaId, negocioId, mensagemCliente, retornarParaVendedor = false, instanciaOverride) {
  const cfg = await getCfg(empresaId)
  const neg = (cfg.crm_negocios || []).find(n => n.id === negocioId)
  if (!neg) return { ok: false, erro: 'Negócio não encontrado' }

  const { wppToken, instancia } = getWppConfig(cfg, instanciaOverride)
  const vendedorTel = getTelefonesVendedores(cfg)[0]?.telefone

  if (retornarParaVendedor) {
    cfg.crm_negocios = cfg.crm_negocios.map(n =>
      n.id === negocioId ? { ...n, agenteEmNegociacao: false } : n
    )
    if (wppToken && vendedorTel) {
      await enviarWhatsApp(vendedorTel,
        `🔔 *Agente IA — Retorno ao vendedor*\n\nO cliente *${neg.nome || neg.titulo}* demonstrou interesse!\n\nÚltima mensagem: "${mensagemCliente}"\n\n➡️ Acesse o CRM para continuar a negociação.`,
        wppToken, instancia)
    }
    await saveCfg(empresaId, cfg)
    return { ok: true, retornouParaVendedor: true }
  }

  const contexto = resumoNegocio(neg, cfg)
  const { promptBase } = getAgenteFollowup(cfg)

  const prompt = `
${promptBase ? `Instruções do agente:\n${promptBase}\n\n` : ''}Você é um assistente comercial especializado da empresa ${cfg.company || 'Vivanexa'}.
Responda à mensagem do cliente de forma natural, persuasiva e cordial (máx 350 caracteres, sem markdown).
NÃO mencione que é uma IA. Se o cliente confirmar interesse em fechar, diga que vai passar para o consultor.

CONTEXTO DO NEGÓCIO:
${contexto}

MENSAGEM DO CLIENTE: "${mensagemCliente}"

Responda no formato:
MENSAGEM: [sua resposta]
PRONTO_PARA_FECHAR: sim/não
`
  const resposta = await chamarIA(prompt, cfg)
  if (!resposta) return { ok: false, erro: 'IA indisponível' }

  const msgMatch    = resposta.match(/MENSAGEM:\s*(.+?)(?:\n|$)/s)
  const prontoMatch = resposta.match(/PRONTO_PARA_FECHAR:\s*(sim|não)/i)
  const mensagemResposta = msgMatch?.[1]?.trim() || resposta.split('\n')[0]
  const prontoParaFechar = prontoMatch?.[1]?.toLowerCase() === 'sim'

  if (wppToken && neg.telefone) {
    await enviarWhatsApp(neg.telefone, mensagemResposta, wppToken, instancia)
  }

  const atividade = {
    id: 'ativ_neg_' + Date.now(), negocioId: neg.id, tipo: 'Follow-up',
    descricao: `Cliente: "${mensagemCliente}" → IA: "${mensagemResposta.slice(0, 80)}..."`,
    data: new Date().toISOString(), criadoEm: new Date().toISOString(), userId: 'agente_ia',
  }
  cfg.crm_atividades = [...(cfg.crm_atividades || []), atividade]

  if (prontoParaFechar) {
    if (wppToken && vendedorTel) {
      await enviarWhatsApp(vendedorTel,
        `🎯 *Lead quente! Agente IA detectou interesse de fechamento*\n\nCliente: *${neg.nome || neg.titulo}*\nMensagem: "${mensagemCliente}"\n\n👉 Entre em contato agora!`,
        wppToken, instancia)
    }
    cfg.crm_negocios = cfg.crm_negocios.map(n =>
      n.id === negocioId ? { ...n, agenteEmNegociacao: false, etapa: 'fechamento', atualizadoEm: new Date().toISOString() } : n
    )
  }

  await saveCfg(empresaId, cfg)
  return { ok: true, mensagemResposta, prontoParaFechar, enviado: !!(wppToken && neg.telefone) }
}

// ── AÇÃO 5: Executar automação de etapa ──────────────

async function automacaoEtapa(empresaId, negocioId, etapaId) {
  const cfg = await getCfg(empresaId)
  const neg = (cfg.crm_negocios || []).find(n => n.id === negocioId)
  if (!neg) return { ok: false, erro: 'Negócio não encontrado' }

  const automacoes = (cfg.crm_automacoes || []).filter(a => a.etapaId === etapaId && a.ativo)
  if (!automacoes.length) return { ok: true, msg: 'Nenhuma automação configurada para esta etapa.' }

  const { wppToken, instancia } = getWppConfig(cfg)
  const resultados = []

  for (const auto of automacoes) {
    const substituir = (texto) => (texto || '')
      .replace(/\{nome\}/gi, neg.nome || neg.fantasia || '')
      .replace(/\{titulo\}/gi, neg.titulo || '')
      .replace(/\{email\}/gi, neg.email || '')
      .replace(/\{telefone\}/gi, neg.telefone || '')
      .replace(/\{empresa\}/gi, cfg.company || 'Vivanexa')
      .replace(/\{adesao\}/gi, neg.adesao ? `R$ ${Number(neg.adesao).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : '')
      .replace(/\{mensalidade\}/gi, neg.mensalidade ? `R$ ${Number(neg.mensalidade).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : '')

    if (auto.tipo === 'whatsapp' && wppToken && neg.telefone) {
      let mensagem = substituir(auto.mensagem)

      if (auto.usarIA && mensagem) {
        const { promptBase } = getAgenteFollowup(cfg)
        const prompt = `
${promptBase ? `Contexto: ${promptBase}\n\n` : ''}Melhore esta mensagem de WhatsApp para soar mais natural e persuasiva (máx 300 caracteres):
"${mensagem}"
Responda APENAS com a mensagem melhorada, sem aspas ou explicações.
`
        const melhorada = await chamarIA(prompt, cfg)
        if (melhorada) mensagem = melhorada
      }

      if (mensagem) {
        const enviado = await enviarWhatsApp(neg.telefone, mensagem, wppToken, instancia)
        resultados.push({ tipo: 'whatsapp', enviado, mensagem: mensagem.slice(0, 50) })
        cfg.crm_atividades = [...(cfg.crm_atividades || []), {
          id: 'ativ_auto_' + Date.now() + '_wpp', negocioId: neg.id, tipo: 'WhatsApp',
          descricao: `Automação enviou WhatsApp: "${mensagem.slice(0, 80)}..."`,
          data: new Date().toISOString(), criadoEm: new Date().toISOString(), userId: 'automacao', concluida: true,
        }]
      }
    }

    if (auto.tipo === 'email' && neg.email) {
      const assunto  = substituir(auto.emailAssunto) || `Mensagem da ${cfg.company || 'Vivanexa'}`
      const conteudo = substituir(auto.emailCorpo)   || ''
      const htmlCorpo = `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px">
        <p style="color:#333;line-height:1.7;white-space:pre-wrap">${conteudo.replace(/\n/g, '<br>')}</p>
        <hr style="border:1px solid #eee;margin:24px 0"/>
        <p style="font-size:12px;color:#999">${cfg.company || 'Vivanexa'} · ${cfg.emailRemetente || ''}</p>
      </div>`

      const enviado = await enviarEmailAuto(neg.email, assunto, htmlCorpo, cfg)
      resultados.push({ tipo: 'email', enviado, assunto })
      cfg.crm_atividades = [...(cfg.crm_atividades || []), {
        id: 'ativ_auto_' + Date.now() + '_email', negocioId: neg.id, tipo: 'E-mail',
        descricao: `Automação enviou e-mail: "${assunto}"`,
        data: new Date().toISOString(), criadoEm: new Date().toISOString(), userId: 'automacao', concluida: true,
      }]
    }
  }

  await saveCfg(empresaId, cfg)
  return { ok: true, resultados }
}

// ── AÇÃO 6: Resposta do vendedor ao briefing via WhatsApp ──
// Quando o vendedor responde o briefing com "1", "2" etc, o agente executa automaticamente
// Esta ação é chamada pelo webhook do WhatsApp (bot.js / webhook.js)

async function respostaBriefing(empresaId, mensagem, usuarioTelefone, instanciaOverride) {
  const cfg = await getCfg(empresaId)
  const { wppToken, instancia } = getWppConfig(cfg, instanciaOverride)
  const msg = mensagem.trim().toLowerCase()

  // Detecta comando do vendedor
  const cmd1 = msg === '1' || msg.includes('rodar') || msg.includes('follow-up') || msg.includes('followup')
  const cmd2 = msg === '2' || msg.includes('parado')
  const cmd3 = msg === '3' || msg.includes('fechar') || msg.includes('ok')

  if (cmd3) {
    // Apenas confirma recebimento
    if (wppToken && usuarioTelefone) {
      await enviarWhatsApp(usuarioTelefone, '✅ Briefing encerrado. Boa sorte nas vendas hoje! 🚀', wppToken, instancia)
    }
    return { ok: true, acao: 'fechar' }
  }

  if (cmd1) {
    // Roda follow-ups automaticamente
    const resultado = await followupParado(empresaId, null, instanciaOverride)
    const qtd = resultado.resultados?.length || 0
    if (wppToken && usuarioTelefone) {
      await enviarWhatsApp(
        usuarioTelefone,
        `✅ *Follow-ups enviados!*\n\n${qtd > 0 ? `Enviei mensagem para ${qtd} negócio(s) parado(s) 🎯` : 'Nenhum negócio parado no momento.'}\n\nO agente está negociando. Você será notificado quando um cliente responder! 🤖`,
        wppToken, instancia
      )
    }
    return { ok: true, acao: 'followup_executado', resultado }
  }

  if (cmd2) {
    // Mostra lista de negócios parados
    const negocios = cfg.crm_negocios || []
    const parados = negocios.filter(n =>
      !['fechamento', 'perdido'].includes(n.etapa) &&
      diasDesde(n.atualizadoEm || n.updatedAt) >= DIAS_PARADO_ALERTA
    ).slice(0, 5)

    if (parados.length === 0) {
      if (wppToken && usuarioTelefone) {
        await enviarWhatsApp(usuarioTelefone, '✅ Nenhum negócio parado no momento. Continue assim! 💪', wppToken, instancia)
      }
    } else {
      const lista = parados.map((n, i) =>
        `${i + 1}. *${n.titulo}* — ${diasDesde(n.atualizadoEm || n.updatedAt)}d parado\n   📞 ${n.telefone || '(sem tel)'}`
      ).join('\n\n')

      if (wppToken && usuarioTelefone) {
        await enviarWhatsApp(
          usuarioTelefone,
          `⚠️ *Negócios parados (${parados.length}):*\n\n${lista}\n\nResponda *1* para rodar follow-up automático em todos!`,
          wppToken, instancia
        )
      }
    }
    return { ok: true, acao: 'lista_parados', total: parados.length }
  }

  // Mensagem não reconhecida — ignora silenciosamente
  return { ok: true, acao: 'ignorado' }
}

// ── Handler principal ─────────────────────────────────

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método não permitido' })

  const { acao, empresaId, negocioId, etapaId, mensagemCliente, retornarParaVendedor,
          instanciaOverride, mensagem, usuarioTelefone } = req.body

  if (!acao || !empresaId) return res.status(400).json({ error: 'acao e empresaId são obrigatórios' })

  try {
    switch (acao) {
      case 'briefing_diario':
        return res.json(await briefingDiario(empresaId, instanciaOverride))

      case 'followup_parado':
        return res.json(await followupParado(empresaId, negocioId, instanciaOverride))

      case 'followup_tarefas':
        return res.json(await followupTarefas(empresaId, instanciaOverride))

      case 'negociar':
        return res.json(await negociar(empresaId, negocioId, mensagemCliente, retornarParaVendedor, instanciaOverride))

      case 'automacao_etapa':
        return res.json(await automacaoEtapa(empresaId, negocioId, etapaId))

      case 'resposta_briefing':
        return res.json(await respostaBriefing(empresaId, mensagem, usuarioTelefone, instanciaOverride))

      default:
        return res.status(400).json({ error: `Ação desconhecida: ${acao}` })
    }
  } catch (err) {
    console.error('Agente follow-up erro:', err)
    return res.status(500).json({ error: err.message })
  }
}
