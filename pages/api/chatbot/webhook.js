// pages/api/chatbot/webhook.js
// Recebe eventos da Evolution API e executa o fluxo de chatbot ativo

import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY  // chave de serviço (não a pública)
)

// ─── Sessões em memória (substituir por Redis em produção) ────────
// Formato: { [phone]: { nodeId, vars, lastActivity } }
const sessions = new Map()

const SESSION_TIMEOUT_MS = 10 * 60 * 1000 // 10 minutos

// ─── Funções auxiliares ──────────────────────────────────────────
function getSession(phone) {
  const s = sessions.get(phone)
  if (!s) return null
  if (Date.now() - s.lastActivity > SESSION_TIMEOUT_MS) {
    sessions.delete(phone)
    return null
  }
  return s
}

function setSession(phone, data) {
  sessions.set(phone, { ...data, lastActivity: Date.now() })
}

function clearSession(phone) {
  sessions.delete(phone)
}

// ─── Enviar mensagem via Evolution API ──────────────────────────
async function sendMessage(phone, text, evolutionCfg) {
  if (!evolutionCfg?.apiUrl || !evolutionCfg?.apiKey || !evolutionCfg?.instance) {
    console.warn('[Chatbot] Evolution API não configurada')
    return
  }
  try {
    await fetch(`${evolutionCfg.apiUrl}/message/sendText/${evolutionCfg.instance}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': evolutionCfg.apiKey,
      },
      body: JSON.stringify({
        number: phone,
        text,
        delay: 1000,
      })
    })
  } catch (err) {
    console.error('[Chatbot] Erro ao enviar mensagem:', err)
  }
}

// ─── Executar nó do fluxo ────────────────────────────────────────
async function executeNode(nodeId, flow, phone, incomingText, vars, evolutionCfg) {
  const node = flow.nodes.find(n => n.id === nodeId)
  if (!node) { clearSession(phone); return }

  switch (node.type) {

    case 'start':
    case 'message': {
      const text = interpolate(node.data?.text || '', vars)
      await sendMessage(phone, text, evolutionCfg)
      // Avança para próximo nó automaticamente
      const next = flow.connections.find(c => c.fromId === nodeId && c.port === 'main')
      if (next) {
        await executeNode(next.toId, flow, phone, incomingText, vars, evolutionCfg)
      } else {
        clearSession(phone)
      }
      break
    }

    case 'question': {
      const text = interpolate(node.data?.text || '', vars)
      await sendMessage(phone, text, evolutionCfg)
      // Aguarda resposta do usuário — salva na sessão
      setSession(phone, { nodeId, vars, waitingAnswer: true, variable: node.data?.variable })
      break
    }

    case 'condition': {
      const varValue = (vars[node.data?.variable] || incomingText || '').toLowerCase().trim()
      const branches = node.data?.branches || []
      let matched = false
      for (let i = 0; i < branches.length; i++) {
        const kw = (branches[i].keyword || '').toLowerCase().trim()
        if (kw && varValue.includes(kw)) {
          const next = flow.connections.find(c => c.fromId === nodeId && c.port === `branch_${i}`)
          if (next) {
            await executeNode(next.toId, flow, phone, incomingText, vars, evolutionCfg)
            matched = true
            break
          }
        }
      }
      if (!matched) {
        // Fallback: porta principal
        const next = flow.connections.find(c => c.fromId === nodeId && c.port === 'main')
        if (next) await executeNode(next.toId, flow, phone, incomingText, vars, evolutionCfg)
        else clearSession(phone)
      }
      break
    }

    case 'action': {
      const actionType = node.data?.actionType || 'transfer'
      if (actionType === 'transfer') {
        const text = interpolate(node.data?.text || 'Transferindo para atendente...', vars)
        await sendMessage(phone, text, evolutionCfg)
        clearSession(phone) // encerra bot, humano assume
      } else if (actionType === 'webhook') {
        try {
          await fetch(node.data?.webhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ phone, vars, text: incomingText })
          })
        } catch {}
        // Continua fluxo
        const next = flow.connections.find(c => c.fromId === nodeId && c.port === 'main')
        if (next) await executeNode(next.toId, flow, phone, incomingText, vars, evolutionCfg)
        else clearSession(phone)
      } else if (actionType === 'tag') {
        // Salvar tag (implementação depende do CRM)
        const next = flow.connections.find(c => c.fromId === nodeId && c.port === 'main')
        if (next) await executeNode(next.toId, flow, phone, incomingText, vars, evolutionCfg)
        else clearSession(phone)
      } else if (actionType === 'close') {
        clearSession(phone)
      }
      break
    }

    case 'end': {
      if (node.data?.text) {
        await sendMessage(phone, interpolate(node.data.text, vars), evolutionCfg)
      }
      clearSession(phone)
      break
    }
  }
}

// Substituir variáveis no texto: {{nome_cliente}} → valor
function interpolate(text, vars) {
  return text.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] || `{{${key}}}`)
}

// ─── Handler principal ───────────────────────────────────────────
export default async function handler(req, res) {
  // Só aceita POST
  if (req.method !== 'POST') return res.status(405).end()

  // Validação do token (Evolution API envia em x-api-key ou query)
  const token = req.headers['x-webhook-token'] || req.query.token
  if (process.env.CHATBOT_WEBHOOK_TOKEN && token !== process.env.CHATBOT_WEBHOOK_TOKEN) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  const body = req.body

  // Evolution API: evento de mensagem recebida
  // Estrutura: { event: 'messages.upsert', data: { key: { remoteJid }, message: { conversation } } }
  if (body?.event !== 'messages.upsert') return res.status(200).json({ ok: true })

  const data = body?.data
  const key  = data?.key
  if (!key || key.fromMe) return res.status(200).json({ ok: true }) // ignora mensagens enviadas pelo bot

  const phone       = key.remoteJid?.replace('@s.whatsapp.net', '').replace('@g.us', '')
  const incomingText = (data?.message?.conversation || data?.message?.extendedTextMessage?.text || '').trim()

  if (!phone || !incomingText) return res.status(200).json({ ok: true })

  // Buscar empresa pelo número da instância (se configurado)
  // Por enquanto busca o primeiro cfg com botAtivo = true
  // Em produção: mapear instance → empresa_id
  const instanceName = body?.instance || req.query.instance

  // Carregar configuração do chatbot
  let flowData = null
  let evolutionCfg = null

  try {
    // Buscar por instância se disponível
    let cfgQuery = supabase.from('vx_storage').select('value, key')

    // Tentar encontrar a empresa pela instância Evolution
    const { data: allRows } = await cfgQuery
    for (const row of allRows || []) {
      if (!row.key.startsWith('chatbot_flows:')) continue
      const val = JSON.parse(row.value)
      if (val.botAtivo) {
        flowData = val
        // Buscar config evolution da mesma empresa
        const eid = row.key.replace('chatbot_flows:', '')
        const { data: cfgRow } = await supabase.from('vx_storage').select('value').eq('key', `cfg:${eid}`).single()
        if (cfgRow?.value) {
          const cfg = JSON.parse(cfgRow.value)
          evolutionCfg = {
            apiUrl: cfg.evolutionApiUrl,
            apiKey: cfg.evolutionApiKey,
            instance: cfg.evolutionInstance || instanceName,
          }
        }
        break
      }
    }
  } catch (err) {
    console.error('[Chatbot] Erro ao carregar fluxo:', err)
    return res.status(500).json({ error: 'Internal error' })
  }

  if (!flowData || !flowData.botAtivo) return res.status(200).json({ ok: true, skip: 'bot_inactive' })

  // Encontrar fluxo ativo
  const activeFlow = (flowData.flows || []).find(f => f.id === flowData.activeFlowId || f.active)
  if (!activeFlow) return res.status(200).json({ ok: true, skip: 'no_active_flow' })

  // Verificar sessão existente
  const session = getSession(phone)

  if (session?.waitingAnswer) {
    // Salvar resposta do usuário na variável
    const vars = { ...session.vars }
    if (session.variable) vars[session.variable] = incomingText
    setSession(phone, { ...session, vars, waitingAnswer: false })

    // Avançar para próximo nó
    const next = activeFlow.connections.find(c => c.fromId === session.nodeId && c.port === 'main')
    if (next) {
      await executeNode(next.toId, activeFlow, phone, incomingText, vars, evolutionCfg)
    } else {
      clearSession(phone)
    }
  } else {
    // Nova conversa: iniciar do nó de start
    const startNode = activeFlow.nodes.find(n => n.type === 'start')
    if (startNode) {
      setSession(phone, { nodeId: startNode.id, vars: {}, waitingAnswer: false })
      await executeNode(startNode.id, activeFlow, phone, incomingText, {}, evolutionCfg)
    }
  }

  return res.status(200).json({ ok: true })
}
