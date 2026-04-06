// pages/api/wpp/sincronizar.js
// Importa conversas existentes da Evolution API para o Supabase
// Chamada via POST { empresaId }

import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

export const config = { api: { bodyParser: true, responseLimit: false } }

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método não permitido' })

  const { empresaId } = req.body
  if (!empresaId) return res.status(400).json({ error: 'empresaId obrigatório' })

  try {
    const { data: row } = await supabase
      .from('vx_storage').select('value').eq('key', `cfg:${empresaId}`).maybeSingle()
    const cfg = row?.value ? JSON.parse(row.value) : {}

    const wppCfg   = cfg.wppInbox || {}
    const baseUrl  = wppCfg.evolutionUrl      || process.env.EVOLUTION_API_URL || ''
    const apiKey   = wppCfg.evolutionKey      || process.env.EVOLUTION_API_KEY || ''
    const instance = wppCfg.evolutionInstance || ''

    if (!baseUrl || !apiKey || !instance) {
      return res.status(400).json({ error: 'Evolution API não configurada em Config → WhatsApp' })
    }

    // 1. Buscar lista de chats
    const chatsRes = await fetch(`${baseUrl}/chat/findChats/${instance}`, {
      headers: { apikey: apiKey },
      signal: AbortSignal.timeout(20000),
    })

    if (!chatsRes.ok) {
      const txt = await chatsRes.text()
      return res.status(502).json({ error: `Evolution API: ${chatsRes.status} ${txt.slice(0, 300)}` })
    }

    const chatsData = await chatsRes.json()
    const lista = Array.isArray(chatsData)
      ? chatsData
      : (chatsData?.chats || chatsData?.data || Object.values(chatsData || {}))

    // Filtrar apenas contatos individuais (não grupos)
    const individuais = lista.filter(c => {
      const jid = c?.id || c?.remoteJid || ''
      return jid && !jid.includes('@g.us') && jid.includes('@')
    })

    let importados = 0, atualizados = 0, erros = 0

    for (const chat of individuais.slice(0, 200)) {
      try {
        const remoteJid   = chat?.id || chat?.remoteJid || ''
        const numero      = remoteJid.replace('@s.whatsapp.net', '').replace(/\D/g, '')
        const nome        = chat?.name || chat?.pushName || chat?.verifiedBizName || numero
        const convKey     = `wpp_conv:${empresaId}:${numero}`

        // Buscar mensagens desse chat
        let mensagens = []
        try {
          const mRes = await fetch(
            `${baseUrl}/chat/findMessages/${instance}?remoteJid=${encodeURIComponent(remoteJid)}&limit=30`,
            { headers: { apikey: apiKey }, signal: AbortSignal.timeout(8000) }
          )
          if (mRes.ok) {
            const mData = await mRes.json()
            const rawMsgs = Array.isArray(mData)
              ? mData
              : (mData?.messages?.records || mData?.data || [])

            mensagens = rawMsgs.map(m => {
              const msgBody = m?.message || {}
              const texto = (
                msgBody?.conversation ||
                msgBody?.extendedTextMessage?.text ||
                msgBody?.imageMessage?.caption ||
                msgBody?.videoMessage?.caption ||
                msgBody?.documentMessage?.fileName ||
                '[Mídia]'
              )
              return {
                id:   `msg_evo_${m?.key?.id || Math.random().toString(36).slice(2)}`,
                de:   m?.key?.fromMe ? 'empresa' : 'cliente',
                para: m?.key?.fromMe ? numero : 'empresa',
                texto,
                tipo: msgBody?.imageMessage ? 'image'
                    : msgBody?.audioMessage  ? 'audio'
                    : msgBody?.videoMessage  ? 'video'
                    : 'text',
                mediaUrl: msgBody?.imageMessage?.url || msgBody?.audioMessage?.url || null,
                at: m?.messageTimestamp
                  ? new Date(Number(m.messageTimestamp) * 1000).toISOString()
                  : new Date().toISOString(),
                lida: true,
              }
            }).filter(m => m.texto && m.texto !== '[Mídia]' || m.tipo !== 'text')
          }
        } catch {}

        const ultimaMsg = mensagens[mensagens.length - 1]
        const ultimaMensagem = ultimaMsg?.texto || ''
        const ultimaAt = ultimaMsg?.at || new Date().toISOString()
        const naoLidas = mensagens.filter(m => m.de === 'cliente').length

        // Verificar se já existe
        const { data: existente } = await supabase
          .from('vx_storage').select('value').eq('key', convKey).maybeSingle()

        if (existente?.value) {
          // Atualizar: mesclar mensagens sem duplicar
          const conv = JSON.parse(existente.value)
          const idsExist = new Set((conv.mensagens || []).map(m => m.id))
          const novas = mensagens.filter(m => !idsExist.has(m.id))
          if (novas.length > 0) {
            conv.mensagens = [...(conv.mensagens || []), ...novas]
              .sort((a, b) => new Date(a.at) - new Date(b.at))
              .slice(-200)
            conv.ultimaMensagem = ultimaMensagem || conv.ultimaMensagem
            conv.ultimaAt = ultimaAt
            if (!conv.nome || conv.nome === conv.numero) conv.nome = nome
            await supabase.from('vx_storage').upsert({
              key: convKey, value: JSON.stringify(conv), updated_at: new Date().toISOString()
            }, { onConflict: 'key' })
            atualizados++
          }
        } else {
          // Criar nova conversa
          const conv = {
            id: convKey, numero, nome, empresaId,
            status: 'automacao', botPausado: false,
            filaId: null, agenteId: null, agenteNome: null,
            tags: [], naoLidas, ultimaMensagem, ultimaAt, mensagens,
          }
          await supabase.from('vx_storage').upsert({
            key: convKey, value: JSON.stringify(conv), updated_at: new Date().toISOString()
          }, { onConflict: 'key' })
          importados++
        }

        // Atualizar índice
        await atualizarIndice(empresaId, numero, { nome, ultimaMensagem, ultimaAt, status: 'automacao', naoLidas, tags: [] })

      } catch (e) {
        console.warn('[sincronizar] chat error:', e.message)
        erros++
      }
    }

    return res.status(200).json({
      success: true,
      importados,
      atualizados,
      erros,
      total: individuais.length,
      mensagem: `✅ ${importados} novas + ${atualizados} atualizadas de ${individuais.length} conversas.`,
    })

  } catch (err) {
    console.error('[sincronizar] error:', err)
    return res.status(500).json({ error: err.message })
  }
}

async function atualizarIndice(empresaId, numero, dados) {
  const idxKey = `wpp_idx:${empresaId}`
  const { data: row } = await supabase
    .from('vx_storage').select('value').eq('key', idxKey).maybeSingle()
  const idx = row?.value ? JSON.parse(row.value) : {}
  idx[numero] = { ...(idx[numero] || {}), numero, ...dados, updatedAt: new Date().toISOString() }
  await supabase.from('vx_storage').upsert({
    key: idxKey, value: JSON.stringify(idx), updated_at: new Date().toISOString()
  }, { onConflict: 'key' })
}
