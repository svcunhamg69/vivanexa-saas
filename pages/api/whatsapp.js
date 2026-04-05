// pages/api/whatsapp.js
// ✅ WhatsApp Cloud API (Meta) — Vivanexa SaaS
// Funcionalidades:
//   GET  → verificação do webhook (Meta exige isso na configuração)
//   POST → receber mensagens (chatbot automático)
//   POST com action → enviar mensagem, disparo em massa, notificação interna

export default async function handler(req, res) {

  // ══════════════════════════════════════════════════════════
  // GET — Verificação do Webhook (Meta Developer Portal)
  // ══════════════════════════════════════════════════════════
  if (req.method === 'GET') {
    const {
      'hub.mode':         mode,
      'hub.verify_token': token,
      'hub.challenge':    challenge,
    } = req.query

    const verifyToken = process.env.WHATSAPP_VERIFY_TOKEN || 'vivanexa_webhook_2024'

    if (mode === 'subscribe' && token === verifyToken) {
      console.log('✅ Webhook WhatsApp verificado com sucesso!')
      return res.status(200).send(challenge)
    }
    return res.status(403).json({ error: 'Token inválido' })
  }

  // ══════════════════════════════════════════════════════════
  // POST — Receber mensagens do WhatsApp (chatbot) ou Enviar
  // ══════════════════════════════════════════════════════════
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido' })
  }

  const body = req.body

  // ── Detectar se é um evento do webhook da Meta ──
  if (body?.object === 'whatsapp_business_account') {
    try {
      const entry   = body.entry?.[0]
      const change  = entry?.changes?.[0]
      const value   = change?.value
      const message = value?.messages?.[0]

      if (!message) return res.status(200).json({ status: 'no_message' })

      const from    = message.from                          // número do remetente
      const msgText = message.text?.body?.toLowerCase() || ''
      const phoneId = value.metadata?.phone_number_id

      // Credenciais do ambiente
      const token   = process.env.WHATSAPP_TOKEN

      // ── Lógica do Chatbot Automático ──
      const resposta = gerarRespostaChatbot(msgText)

      if (resposta && token && phoneId) {
        await enviarMensagem({ phoneId, token, para: from, texto: resposta })
      }

      return res.status(200).json({ status: 'ok' })
    } catch (err) {
      console.error('Erro no webhook WhatsApp:', err)
      return res.status(200).json({ status: 'error', message: err.message })
      // ⚠️ Sempre retorna 200 para a Meta não retentar
    }
  }

  // ── Ações manuais disparadas pelo sistema Vivanexa ──
  const { action, phoneId, token, para, texto, contatos, mensagem, titulo } = body

  if (!phoneId || !token) {
    return res.status(400).json({ error: 'phoneId e token são obrigatórios' })
  }

  try {
    switch (action) {

      // ─────────────────────────────────────────────
      // 1. ENVIAR MENSAGEM SIMPLES (proposta, contrato)
      // ─────────────────────────────────────────────
      case 'enviar': {
        if (!para || !texto) return res.status(400).json({ error: 'para e texto são obrigatórios' })
        const result = await enviarMensagem({ phoneId, token, para, texto })
        return res.status(200).json({ success: true, result })
      }

      // ─────────────────────────────────────────────
      // 2. DISPARO EM MASSA
      // ─────────────────────────────────────────────
      case 'disparo': {
        if (!contatos?.length || !mensagem) {
          return res.status(400).json({ error: 'contatos e mensagem são obrigatórios' })
        }

        const resultados = []
        for (const contato of contatos) {
          try {
            const numero = limparNumero(contato.telefone || contato.numero || contato)
            if (!numero) { resultados.push({ numero: contato, status: 'erro', motivo: 'número inválido' }); continue }

            // Personalizar mensagem com nome do contato
            const textoPers = mensagem
              .replace('{nome}',    contato.nome    || 'Cliente')
              .replace('{empresa}', contato.empresa || '')

            await enviarMensagem({ phoneId, token, para: numero, texto: textoPers })
            resultados.push({ numero, status: 'enviado' })

            // Delay de 1s entre mensagens para evitar bloqueio
            await sleep(1000)
          } catch (e) {
            resultados.push({ numero: contato, status: 'erro', motivo: e.message })
          }
        }

        const enviados = resultados.filter(r => r.status === 'enviado').length
        return res.status(200).json({ success: true, enviados, total: contatos.length, resultados })
      }

      // ─────────────────────────────────────────────
      // 3. NOTIFICAÇÃO INTERNA (para número da empresa)
      // ─────────────────────────────────────────────
      case 'notificacao': {
        if (!para || !titulo) return res.status(400).json({ error: 'para e titulo são obrigatórios' })
        const textoNotif = `🔔 *${titulo}*\n\n${texto || ''}\n\n_Vivanexa SaaS_`
        const result = await enviarMensagem({ phoneId, token, para, texto: textoNotif })
        return res.status(200).json({ success: true, result })
      }

      default:
        return res.status(400).json({ error: `Ação desconhecida: ${action}` })
    }
  } catch (err) {
    console.error('Erro na API WhatsApp:', err)
    return res.status(500).json({ error: err.message })
  }
}

// ══════════════════════════════════════════════════════════
// FUNÇÕES AUXILIARES
// ══════════════════════════════════════════════════════════

async function enviarMensagem({ phoneId, token, para, texto }) {
  const url = `https://graph.facebook.com/v19.0/${phoneId}/messages`

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type':  'application/json',
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      recipient_type:    'individual',
      to:                limparNumero(para),
      type:              'text',
      text:              { preview_url: false, body: texto },
    }),
  })

  const data = await response.json()
  if (!response.ok) throw new Error(data?.error?.message || 'Erro ao enviar mensagem')
  return data
}

function limparNumero(numero) {
  if (!numero) return null
  const limpo = String(numero).replace(/\D/g, '')
  // Garante DDI 55 para números brasileiros sem DDI
  if (limpo.length === 10 || limpo.length === 11) return '55' + limpo
  return limpo
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

// ── Chatbot automático ──
// Personalize as respostas conforme sua empresa
function gerarRespostaChatbot(texto) {
  if (!texto) return null

  const t = texto.toLowerCase().trim()

  if (/^(oi|olá|ola|bom dia|boa tarde|boa noite|hey|hello)/.test(t)) {
    return `Olá! 👋 Bem-vindo à *Vivanexa*!\n\nComo posso te ajudar?\n\n1️⃣ Solicitar proposta\n2️⃣ Falar com consultor\n3️⃣ Informações sobre planos\n4️⃣ Suporte técnico`
  }

  if (/\b1\b|proposta|orçamento|orcamento|preço|preco/.test(t)) {
    return `📋 *Solicitar Proposta*\n\nPara gerar sua proposta personalizada, preciso de algumas informações:\n\n• CNPJ da empresa\n• Quantidade de clientes/CNPJs\n• Módulos de interesse\n\nOu se preferir, acesse: https://vivanexa.com.br`
  }

  if (/\b2\b|consultor|atendimento|humano|pessoa/.test(t)) {
    return `👤 *Falar com Consultor*\n\nVou te transferir para nosso time comercial!\n\nHorário de atendimento:\n📅 Segunda a Sexta: 9h às 18h\n\nAguarde, um consultor entrará em contato em breve. ⏳`
  }

  if (/\b3\b|plano|planos|valor|valores|mensalidade/.test(t)) {
    return `💰 *Nossos Planos*\n\n📦 *Basic* — até 25 CNPJs\n📦 *Pro* — até 80 CNPJs\n📦 *Top* — até 150 CNPJs\n📦 *Top Plus* — ilimitado\n\nDigite *1* para receber uma proposta personalizada ou acesse nosso site!`
  }

  if (/\b4\b|suporte|problema|erro|bug|ajuda/.test(t)) {
    return `🛠️ *Suporte Técnico*\n\nPara suporte, envie:\n• Descrição do problema\n• Tela/módulo afetado\n• Print se possível\n\nNosso time responde em até 2 horas úteis! ⏱️`
  }

  if (/obrigad|valeu|ok|certo/.test(t)) {
    return `De nada! 😊 Estamos sempre à disposição.\n\nSe precisar de mais alguma coisa, é só chamar! 🚀`
  }

  // Resposta padrão
  return `Olá! Recebi sua mensagem. 😊\n\nDigite uma das opções:\n\n1️⃣ Solicitar proposta\n2️⃣ Falar com consultor\n3️⃣ Informações sobre planos\n4️⃣ Suporte técnico`
}
