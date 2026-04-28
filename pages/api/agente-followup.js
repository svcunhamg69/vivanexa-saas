// pages/api/agente-followup.js
// ══════════════════════════════════════════════════════
// Agente IA de Follow-up do CRM v2
//
// Funções:
//  1. POST { acao: 'briefing_diario', empresaId }
//     → Envia resumo do dia via WhatsApp para cada vendedor
//
//  2. POST { acao: 'followup_parado', empresaId, negocioId? }
//     → Verifica negócios parados e envia WhatsApp ao cliente
//
//  3. POST { acao: 'followup_tarefas', empresaId }
//     → Verifica atividades/tarefas atrasadas ou para hoje e envia lembrete
//
//  4. POST { acao: 'negociar', empresaId, negocioId, mensagemCliente }
//     → IA responde ao cliente como assistente de vendas
//
//  5. POST { acao: 'automacao_etapa', empresaId, negocioId, etapaId }
//     → Executa automações configuradas para a etapa (email/WhatsApp)
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

// ── Seleciona o agente de IA configurado para follow-up ──
function getAgenteFollowup(cfg) {
  const agentes = cfg.wppAgentes || []
  // Busca o agente marcado como padrão de follow-up
  const agenteFollowup = agentes.find(a => a.usarParaFollowup && a.ativo)
  // Fallback: primeiro agente ativo
  const agentePadrao   = agentes.find(a => a.ativo)
  const agente = agenteFollowup || agentePadrao || null

  // Resolve chaves de API
  const geminiKey = agente?.geminiKey || cfg.geminiApiKey || cfg.geminiKey || process.env.GEMINI_API_KEY || ''
  const groqKey   = agente?.groqKey   || cfg.groqApiKey   || cfg.groqKey   || process.env.GROQ_API_KEY   || ''
  const openaiKey = agente?.openaiKey || cfg.openaiApiKey  || cfg.openaiKey  || process.env.OPENAI_API_KEY  || ''

  // Prompt base do agente (se configurado)
  const promptBase = agente?.prompt || ''

  return { agente, geminiKey, groqKey, openaiKey, promptBase }
}

async function chamarIA(prompt, cfg) {
  const { geminiKey, groqKey, openaiKey, agente } = getAgenteFollowup(cfg)

  // OpenAI primeiro se disponível
  if (openaiKey) {
    try {
      const model = agente?.provider === 'openai' ? (agente.model || 'gpt-4o-mini') : 'gpt-4o-mini'
      const r = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${openaiKey}` },
        body: JSON.stringify({
          model,
          messages: [{ role: 'user', content: prompt }],
          max_tokens: 600,
          temperature: 0.7
        })
      })
      const d = await r.json()
      const txt = d.choices?.[0]?.message?.content?.trim()
      if (txt) return txt
    } catch {}
  }

  // Gemini
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

  // Groq fallback
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

async function enviarWhatsApp(numero, mensagem, wppToken, instanceName, opts = {}) {
  if (!numero || !mensagem || !wppToken) return false
  try {
    const num = numero.replace(/\D/g, '')
    const full = num.startsWith('55') ? num : `55${num}`
    const [url, token] = wppToken.includes('|') ? wppToken.split('|') : [wppToken, '']

    const resp = await fetch(`${url}/message/sendText/${instanceName || 'default'}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: token },
      body: JSON.stringify({ number: full, text: mensagem })
    })

    // ── Salva mensagem na conversa do WhatsApp Inbox para o usuário acompanhar ──
    if (resp.ok && opts.empresaId) {
      try {
        const msgObj = {
          id: 'agente_' + Date.now() + '_' + Math.random().toString(36).slice(2,6),
          de: 'empresa', fromMe: true, texto: mensagem,
          at: new Date().toISOString(), tipo: 'text',
          agente: opts.origemAgente || 'IA Follow-up', isAgente: true,
        }
        const convKey = `wpp_conv:${opts.empresaId}:${full}`
        const { data: convRow } = await supabase.from('vx_storage').select('value').eq('key', convKey).maybeSingle()
        const convData = convRow?.value ? JSON.parse(convRow.value) : {
          numero: full, nome: opts.nomeContato || '', status: 'automacao',
          mensagens: [], criadoEm: new Date().toISOString(),
          instancia: instanceName || 'default',
        }
        convData.mensagens = [...(convData.mensagens || []).slice(-199), msgObj]
        convData.ultimaMensagem = mensagem.slice(0, 60)
        convData.ultimaAt = new Date().toISOString()
        convData.ultimaDe = 'empresa'
        convData.instancia = instanceName || convData.instancia || 'default'
        await supabase.from('vx_storage').upsert(
          { key: convKey, value: JSON.stringify(convData), updated_at: new Date().toISOString() },
          { onConflict: 'key' }
        )
        // Atualiza índice de conversas
        const idxKey = `wpp_idx:${opts.empresaId}`
        const { data: idxRow } = await supabase.from('vx_storage').select('value').eq('key', idxKey).maybeSingle()
        const idx = idxRow?.value ? JSON.parse(idxRow.value) : {}
        idx[full] = { numero: full, nome: opts.nomeContato || '', ultimaMensagem: mensagem.slice(0,60),
          ultimaAt: new Date().toISOString(), status: 'automacao',
          instancia: instanceName || 'default', isAgente: true, updatedAt: new Date().toISOString() }
        await supabase.from('vx_storage').upsert(
          { key: idxKey, value: JSON.stringify(idx), updated_at: new Date().toISOString() },
          { onConflict: 'key' }
        )
      } catch (saveErr) { console.error('[inbox save]', saveErr.message) }
    }

    return resp.ok
  } catch (e) {
    console.error('Erro WhatsApp:', e.message)
    return false
  }
}

async function enviarEmailAuto(para, assunto, htmlCorpo, cfg) {
  if (!para || !assunto) return false
  try {
    // Monta cfg de email igual ao crm.js
    const smtpCfg = cfg.smtpHost ? {
      smtpHost: cfg.smtpHost,
      smtpPort: cfg.smtpPort || 587,
      smtpUser: cfg.smtpUser,
      smtpPass: cfg.smtpPass,
      apiKey: cfg.emailApiKey || cfg.apiKey || cfg.brevoApiKey || cfg.api_key || cfg.smtpPass || '',
      emailRemetente: cfg.emailRemetente || cfg.smtpFrom || cfg.emailEmpresa || '',
      nomeRemetente: cfg.company || 'Vivanexa'
    } : null

    if (!smtpCfg) return false

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000'

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
// Agrupa negócios por responsavelId e envia 1 briefing personalizado por vendedor

async function briefingDiario(empresaId, instanciaOverride) {
  const cfg = await getCfg(empresaId)
  const negocios   = cfg.crm_negocios   || []
  const atividades = cfg.crm_atividades || []
  const hoje = new Date()
  const hojeStr = hoje.toISOString().slice(0, 10)
  const users = cfg.users || []

  const { wppToken, instancia: wppInstancia } = getWppConfig(cfg, instanciaOverride)
  const { promptBase } = getAgenteFollowup(cfg)

  // ── Agrupa negócios por responsável ──────────────────────
  // responsavelId > criadoPorId > fallback global
  const mapaVendedor = {}
  for (const neg of negocios) {
    if (neg.etapa === 'perdido') continue
    const uid = neg.responsavelId || neg.criadoPorId || '__global__'
    if (!mapaVendedor[uid]) mapaVendedor[uid] = []
    mapaVendedor[uid].push(neg)
  }

  // Se não há vínculo algum, manda para todos usuários com tel
  if (Object.keys(mapaVendedor).length === 0 || (Object.keys(mapaVendedor).length === 1 && mapaVendedor['__global__'])) {
    mapaVendedor['__global__'] = negocios.filter(n => n.etapa !== 'perdido')
  }

  // Monta lista de destinatários
  const destinatarios = []
  for (const [uid, meusNegs] of Object.entries(mapaVendedor)) {
    let tel = '', nome = 'Vendedor'
    if (uid && uid !== '__global__') {
      const u = users.find(u => u.id === uid)
      tel  = u?.telefone ? limparNumero(u.telefone) : ''
      nome = u?.nome || u?.email || uid
    }
    // Fallback: telefone global da empresa
    if (!tel) {
      tel = limparNumero(cfg.whatsappEmpresa || cfg.responsavelTelefone || cfg.telefoneEmp || '')
      nome = cfg.company || 'Vendedor'
    }
    if (tel) destinatarios.push({ userId: uid, nome, telefone: tel, meusNegs })
  }

  if (!destinatarios.length) {
    return { ok: false, erro: 'Nenhum usuário com telefone cadastrado. Configure em Config → Usuários → campo Telefone.' }
  }

  const resultados = []

  for (const dest of destinatarios) {
    const { meusNegs, nome, telefone } = dest
    const meusIds = new Set(meusNegs.map(n => n.id))

    // Filtra atividades do vendedor
    const tarefasHoje      = atividades.filter(a => !a.concluida && a.prazo && a.prazo.slice(0, 10) === hojeStr && (meusIds.has(a.negocioId) || a.usuarioId === dest.userId))
    const tarefasAtrasadas = atividades.filter(a => !a.concluida && a.prazo && new Date(a.prazo) < new Date() && a.prazo.slice(0, 10) !== hojeStr && (meusIds.has(a.negocioId) || a.usuarioId === dest.userId))
    const negParados       = meusNegs.filter(n => !['fechamento','perdido'].includes(n.etapa) && diasDesde(n.atualizadoEm || n.updatedAt) >= DIAS_PARADO_ALERTA)
    const negFechamento    = meusNegs.filter(n => n.etapa === 'fechamento')
    const negAtivos        = meusNegs.filter(n => !['perdido'].includes(n.etapa))

    const tarefasHojeDetalhes = tarefasHoje.slice(0, 5).map(a => {
      const neg = meusNegs.find(n => n.id === a.negocioId)
      return `• ${a.tipo}: ${a.descricao.slice(0, 60)}${neg ? ` [${neg.titulo}]` : ''}`
    }).join('\n')

    const prompt = `
${promptBase ? `Contexto do agente:\n${promptBase}\n\n` : ''}Você é um assistente comercial inteligente da empresa ${cfg.company || 'Vivanexa'}.
Hoje é ${hoje.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })}.
Você está gerando o briefing para o vendedor: ${nome}.

Gere um briefing RESUMIDO para WhatsApp (máx 550 caracteres, sem markdown, use emojis e quebras de linha).
No final adicione exatamente: "Responda: *1* Rodar follow-ups | *2* Ver parados | *3* Fechar briefing"

Estruture:
📊 Pipeline: X negócios ativos
🎯 Fechamento: X oportunidades
⚠️ Parados: X negócios
📅 Hoje: X tarefas
⚡ Atrasadas: X tarefas
[Sugestão prática de ação prioritária]

DADOS DO VENDEDOR ${nome}:
- Negócios ativos: ${negAtivos.length}
- Em fechamento: ${negFechamento.length}
- Parados +${DIAS_PARADO_ALERTA}d: ${negParados.length}${negParados.length ? ' (' + negParados.map(n => n.titulo).slice(0, 2).join(', ') + ')' : ''}
- Tarefas hoje: ${tarefasHoje.length}
${tarefasHojeDetalhes ? 'Tarefas:\n' + tarefasHojeDetalhes : ''}
- Tarefas atrasadas: ${tarefasAtrasadas.length}
- Prioritário: ${negFechamento[0]?.titulo || negParados[0]?.titulo || 'Nenhum crítico'}
`
    const texto = await chamarIA(prompt, cfg)
    if (!texto) { resultados.push({ nome, telefone, enviado: false, erro: 'IA indisponível' }); continue }

    let enviado = false
    if (wppToken && telefone) {
      enviado = await enviarWhatsApp(
        telefone,
        `🤖 *BRIEFING DO DIA — ${hoje.toLocaleDateString('pt-BR')}*\n\nOlá, ${nome}! 👋\n\n${texto}`,
        wppToken, wppInstancia,
        { empresaId, nomeContato: nome, origemAgente: '🤖 Briefing Diário' }
      )
    }
    resultados.push({ nome, telefone, enviado, texto: texto.slice(0, 100) + '...' })
  }

  const log = { data: hoje.toISOString(), tipo: 'briefing', resultados: resultados.length }
  cfg.agenteLog = [...(cfg.agenteLog || []).slice(-29), log]
  await saveCfg(empresaId, cfg)

  const totalEnviados = resultados.filter(r => r.enviado).length
  return { ok: true, texto: resultados[0]?.texto || '', enviado: totalEnviados > 0, totalEnviados, resultados }
}

// ── AÇÃO 2: Follow-up de negócios parados ────────────

async function followupParado(empresaId, negocioId) {
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

  const resultados = []
  const wppToken = cfg.evolutionApiUrl && cfg.evolutionApiToken
    ? `${cfg.evolutionApiUrl}|${cfg.evolutionApiToken}` : null

  const { promptBase } = getAgenteFollowup(cfg)

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
      enviado = await enviarWhatsApp(neg.telefone, mensagem, wppToken, cfg.evolutionInstance)
    }

    cfg.crm_negocios = cfg.crm_negocios.map(n =>
      n.id === neg.id ? { ...n, agenteFollowupHoje: new Date().toISOString().slice(0, 10), agenteEmNegociacao: true } : n
    )

    const atividade = {
      id: 'ativ_' + Date.now() + '_' + neg.id,
      negocioId: neg.id,
      tipo: 'Follow-up',
      descricao: `Agente IA enviou follow-up: "${mensagem.slice(0, 100)}..."`,
      data: new Date().toISOString(),
      criadoEm: new Date().toISOString(),
      userId: 'agente_ia',
    }
    cfg.crm_atividades = [...(cfg.crm_atividades || []), atividade]

    resultados.push({ negocioId: neg.id, titulo: neg.titulo, mensagem, enviado })
  }

  await saveCfg(empresaId, cfg)
  return { ok: true, resultados }
}

// ── AÇÃO 3: Follow-up de TAREFAS atrasadas / para hoje ──

async function followupTarefas(empresaId) {
  const cfg = await getCfg(empresaId)
  const atividades = cfg.crm_atividades || []
  const negocios   = cfg.crm_negocios   || []
  const hoje = new Date()
  const hojeStr = hoje.toISOString().slice(0, 10)

  const tarefasCriticas = atividades.filter(a => {
    if (a.concluida) return false
    if (!a.prazo) return false
    const prazoDate = new Date(a.prazo)
    const isAtrasada = prazoDate < hoje && a.prazo.slice(0, 10) !== hojeStr
    const isHoje     = a.prazo.slice(0, 10) === hojeStr
    return isAtrasada || isHoje
  })

  if (!tarefasCriticas.length) return { ok: true, msg: 'Nenhuma tarefa crítica no momento.' }

  const wppToken = cfg.evolutionApiUrl && cfg.evolutionApiToken
    ? `${cfg.evolutionApiUrl}|${cfg.evolutionApiToken}` : null
  const vendedorTel = cfg.whatsappEmpresa || cfg.responsavelTelefone

  // Agrupa por urgência
  const atrasadas = tarefasCriticas.filter(a => new Date(a.prazo) < hoje && a.prazo.slice(0, 10) !== hojeStr)
  const deHoje    = tarefasCriticas.filter(a => a.prazo.slice(0, 10) === hojeStr)

  const { promptBase } = getAgenteFollowup(cfg)

  const prompt = `
${promptBase ? `Contexto do agente:\n${promptBase}\n\n` : ''}Você é um assistente comercial da empresa ${cfg.company || 'Vivanexa'}.
Crie uma mensagem de alerta de tarefas para WhatsApp (máx 450 caracteres, direto, use emojis, sem markdown).
Liste as tarefas mais urgentes e dê uma sugestão de priorização.

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

  let enviado = false
  if (wppToken && vendedorTel) {
    enviado = await enviarWhatsApp(vendedorTel, `📋 *ALERTA DE TAREFAS — ${hoje.toLocaleDateString('pt-BR')}*\n\n${texto}`, wppToken, cfg.evolutionInstance)
  }

  const log = { data: hoje.toISOString(), tipo: 'followup_tarefas', texto, atrasadas: atrasadas.length, deHoje: deHoje.length }
  cfg.agenteLog = [...(cfg.agenteLog || []).slice(-29), log]
  await saveCfg(empresaId, cfg)

  return { ok: true, texto, enviado, atrasadas: atrasadas.length, deHoje: deHoje.length }
}

// ── AÇÃO 4: Negociar (IA responde ao cliente) ─────────

async function negociar(empresaId, negocioId, mensagemCliente, retornarParaVendedor = false) {
  const cfg = await getCfg(empresaId)
  const neg = (cfg.crm_negocios || []).find(n => n.id === negocioId)
  if (!neg) return { ok: false, erro: 'Negócio não encontrado' }

  if (retornarParaVendedor) {
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

  const wppToken = cfg.evolutionApiUrl && cfg.evolutionApiToken
    ? `${cfg.evolutionApiUrl}|${cfg.evolutionApiToken}` : null

  if (wppToken && neg.telefone) {
    await enviarWhatsApp(neg.telefone, mensagemResposta, wppToken, cfg.evolutionInstance)
  }

  const atividade = {
    id: 'ativ_neg_' + Date.now(),
    negocioId: neg.id,
    tipo: 'Follow-up',
    descricao: `Cliente: "${mensagemCliente}" → IA: "${mensagemResposta.slice(0, 80)}..."`,
    data: new Date().toISOString(),
    criadoEm: new Date().toISOString(),
    userId: 'agente_ia',
  }
  cfg.crm_atividades = [...(cfg.crm_atividades || []), atividade]

  if (prontoParaFechar) {
    const vendedorTel = cfg.whatsappEmpresa || cfg.responsavelTelefone
    if (wppToken && vendedorTel) {
      await enviarWhatsApp(vendedorTel,
        `🎯 *Lead quente! Agente IA detectou interesse de fechamento*\n\nCliente: *${neg.nome || neg.titulo}*\nMensagem: "${mensagemCliente}"\n\n👉 Entre em contato agora!`,
        wppToken, cfg.evolutionInstance)
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

  // Busca automações configuradas para esta etapa
  const automacoes = (cfg.crm_automacoes || []).filter(a => a.etapaId === etapaId && a.ativo)
  if (!automacoes.length) return { ok: true, msg: 'Nenhuma automação configurada para esta etapa.' }

  const wppToken = cfg.evolutionApiUrl && cfg.evolutionApiToken
    ? `${cfg.evolutionApiUrl}|${cfg.evolutionApiToken}` : null

  const resultados = []

  for (const auto of automacoes) {
    // Substitui variáveis na mensagem
    const substituir = (texto) => (texto || '')
      .replace(/\{nome\}/gi, neg.nome || neg.fantasia || '')
      .replace(/\{titulo\}/gi, neg.titulo || '')
      .replace(/\{email\}/gi, neg.email || '')
      .replace(/\{telefone\}/gi, neg.telefone || '')
      .replace(/\{empresa\}/gi, cfg.company || 'Vivanexa')
      .replace(/\{adesao\}/gi, neg.adesao ? `R$ ${Number(neg.adesao).toLocaleString('pt-BR', {minimumFractionDigits:2})}` : '')
      .replace(/\{mensalidade\}/gi, neg.mensalidade ? `R$ ${Number(neg.mensalidade).toLocaleString('pt-BR', {minimumFractionDigits:2})}` : '')

    if (auto.tipo === 'whatsapp' && wppToken && neg.telefone) {
      // Gera mensagem com IA se configurado, senão usa template fixo
      let mensagem = substituir(auto.mensagem)

      if (auto.usarIA && mensagem) {
        const { promptBase } = getAgenteFollowup(cfg)
        const prompt = `
${promptBase ? `Contexto: ${promptBase}\n\n` : ''}Melhore esta mensagem de WhatsApp para soar mais natural e persuasiva (mantenha em até 300 caracteres):
"${mensagem}"
Responda APENAS com a mensagem melhorada, sem aspas ou explicações.
`
        const melhorada = await chamarIA(prompt, cfg)
        if (melhorada) mensagem = melhorada
      }

      if (mensagem) {
        const enviado = await enviarWhatsApp(neg.telefone, mensagem, wppToken, cfg.evolutionInstance)
        resultados.push({ tipo: 'whatsapp', enviado, mensagem: mensagem.slice(0, 50) })

        // Registra atividade
        cfg.crm_atividades = [...(cfg.crm_atividades || []), {
          id: 'ativ_auto_' + Date.now() + '_wpp',
          negocioId: neg.id,
          tipo: 'WhatsApp',
          descricao: `Automação etapa enviou WhatsApp: "${mensagem.slice(0, 80)}..."`,
          data: new Date().toISOString(),
          criadoEm: new Date().toISOString(),
          userId: 'automacao',
          concluida: true,
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
        id: 'ativ_auto_' + Date.now() + '_email',
        negocioId: neg.id,
        tipo: 'E-mail',
        descricao: `Automação etapa enviou e-mail: "${assunto}"`,
        data: new Date().toISOString(),
        criadoEm: new Date().toISOString(),
        userId: 'automacao',
        concluida: true,
      }]
    }
  }

  await saveCfg(empresaId, cfg)
  return { ok: true, resultados }
}

// ── Handler principal ─────────────────────────────────

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método não permitido' })

  const { acao, empresaId, negocioId, etapaId, mensagemCliente, retornarParaVendedor, instanciaOverride } = req.body

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
        return res.json(await negociar(empresaId, negocioId, mensagemCliente, retornarParaVendedor))

      case 'automacao_etapa':
        return res.json(await automacaoEtapa(empresaId, negocioId, etapaId))

      default:
        return res.status(400).json({ error: `Ação desconhecida: ${acao}` })
    }
  } catch (err) {
    console.error('Agente follow-up erro:', err)
    return res.status(500).json({ error: err.message })
  }
}
