// pages/api/wpp/sincronizar-msgs.js
// ═══════════════════════════════════════════════════════════════
// Busca mensagens históricas diretamente da Evolution API v2
// e sincroniza com o wpp_conv no Supabase
//
// POST { empresaId, numero, instancia, limite? }
// ═══════════════════════════════════════════════════════════════

import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método não permitido' })

  const { empresaId, numero, instancia, limite = 50 } = req.body
  if (!empresaId || !numero || !instancia) {
    return res.status(400).json({ error: 'empresaId, numero e instancia são obrigatórios' })
  }

  try {
    // Busca configuração da empresa
    const { data: cfgRow } = await supabase
      .from('vx_storage').select('value').eq('key', `cfg:${empresaId}`).maybeSingle()
    if (!cfgRow?.value) return res.status(404).json({ error: 'Empresa não encontrada' })

    const cfg = JSON.parse(cfgRow.value)
    const evoUrl = cfg.wppInbox?.evolutionUrl || cfg.evolutionApiUrl || ''
    const evoKey = cfg.wppInbox?.evolutionKey || cfg.evolutionApiToken || ''

    if (!evoUrl || !evoKey) {
      return res.status(400).json({ error: 'Evolution API não configurada' })
    }

    // Normaliza o número para formato JID da Evolution
    const numLimpo = numero.replace(/\D/g, '')
    const numFull  = numLimpo.startsWith('55') ? numLimpo : `55${numLimpo}`
    const jid      = numFull.includes('@') ? numFull : `${numFull}@s.whatsapp.net`

    // ── Busca mensagens via Evolution API v2 ─────────────────────────
    // POST /chat/findMessages/{instance}
    const evoResp = await fetch(`${evoUrl}/chat/findMessages/${instancia}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: evoKey },
      body: JSON.stringify({
        where: { key: { remoteJid: jid } },
        limit: limite,
      }),
      signal: AbortSignal.timeout(10000),
    })

    if (!evoResp.ok) {
      const errText = await evoResp.text()
      console.error('[sincronizar-msgs] Evolution error:', evoResp.status, errText.slice(0, 200))
      return res.status(200).json({ ok: false, sincronizadas: 0, erro: `Evolution retornou ${evoResp.status}` })
    }

    const evoData = await evoResp.json()

    // A resposta pode ser array direto ou { messages: [...] }
    const rawMsgs = Array.isArray(evoData)
      ? evoData
      : (evoData?.messages?.records || evoData?.messages || evoData?.data || [])

    if (!rawMsgs.length) {
      return res.status(200).json({ ok: true, sincronizadas: 0, total: 0 })
    }

    // ── Converte mensagens do formato Evolution → formato Vivanexa ────
    const mensagens = rawMsgs.map(m => {
      const fromMe = m.key?.fromMe === true
      const ts = m.messageTimestamp
        ? new Date(Number(m.messageTimestamp) * 1000).toISOString()
        : (m.updatedAt || new Date().toISOString())

      // Extrai texto
      const texto = m.message?.conversation
        || m.message?.extendedTextMessage?.text
        || m.message?.imageMessage?.caption
        || m.message?.videoMessage?.caption
        || m.message?.documentMessage?.caption
        || m.message?.audioMessage?.url
        || m.pushName || ''

      // Tipo de mensagem
      const tipo = m.message?.imageMessage    ? 'image'
                 : m.message?.videoMessage    ? 'video'
                 : m.message?.audioMessage    ? 'audio'
                 : m.message?.documentMessage ? 'document'
                 : m.message?.stickerMessage  ? 'sticker'
                 : m.message?.locationMessage ? 'location'
                 : 'text'

      return {
        id:          m.key?.id || 'evo_' + Math.random().toString(36).slice(2),
        de:          fromMe ? 'empresa' : 'cliente',
        fromMe,
        texto,
        at:          ts,
        tipo,
        mediaId:     m.key?.id || null,
        mimetype:    m.message?.imageMessage?.mimetype
                  || m.message?.videoMessage?.mimetype
                  || m.message?.audioMessage?.mimetype
                  || m.message?.documentMessage?.mimetype
                  || null,
        nomeArquivo: m.message?.documentMessage?.fileName || null,
        origem:      'evolution',
      }
    }).filter(m => m.texto || m.tipo !== 'text') // remove msgs vazias de texto

    // Ordena por data (mais antigas primeiro)
    mensagens.sort((a, b) => new Date(a.at) - new Date(b.at))

    // ── Carrega conversa existente do Supabase ──────────────────────
    const convKey = `wpp_conv:${empresaId}:${numFull}`
    const { data: convRow } = await supabase
      .from('vx_storage').select('value').eq('key', convKey).maybeSingle()

    let conv = convRow?.value ? JSON.parse(convRow.value) : {
      numero: numFull, nome: '', status: 'automacao',
      mensagens: [], criadoEm: new Date().toISOString(),
      instancia,
    }

    // ── Merge: adiciona mensagens que ainda não existem (por ID) ─────
    const idsExistentes = new Set((conv.mensagens || []).map(m => m.id))
    const novas = mensagens.filter(m => !idsExistentes.has(m.id))

    if (novas.length > 0) {
      conv.mensagens = [...(conv.mensagens || []), ...novas]
        .sort((a, b) => new Date(a.at) - new Date(b.at))
        .slice(-200) // mantém últimas 200 mensagens

      const ultima = conv.mensagens[conv.mensagens.length - 1]
      conv.ultimaMensagem = ultima?.texto?.slice(0, 60) || ''
      conv.ultimaAt       = ultima?.at || new Date().toISOString()
      conv.ultimaDe       = ultima?.fromMe ? 'empresa' : 'cliente'
      conv.updatedAt      = new Date().toISOString()
      conv.instancia      = conv.instancia || instancia

      // Salva conversa atualizada
      await supabase.from('vx_storage').upsert(
        { key: convKey, value: JSON.stringify(conv), updated_at: new Date().toISOString() },
        { onConflict: 'key' }
      )

      // Atualiza índice
      const idxKey = `wpp_idx:${empresaId}`
      const { data: idxRow } = await supabase.from('vx_storage').select('value').eq('key', idxKey).maybeSingle()
      const idx = idxRow?.value ? JSON.parse(idxRow.value) : {}
      idx[numFull] = {
        ...(idx[numFull] || {}), numero: numFull,
        ultimaMensagem: conv.ultimaMensagem, ultimaAt: conv.ultimaAt,
        updatedAt: new Date().toISOString(), status: conv.status || 'automacao',
        instancia: conv.instancia,
      }
      await supabase.from('vx_storage').upsert(
        { key: idxKey, value: JSON.stringify(idx), updated_at: new Date().toISOString() },
        { onConflict: 'key' }
      )
    }

    return res.status(200).json({
      ok: true,
      sincronizadas: novas.length,
      total: rawMsgs.length,
      conv: { ...conv, mensagens: conv.mensagens }, // retorna conv completa
    })

  } catch (err) {
    console.error('[sincronizar-msgs]', err.message)
    return res.status(500).json({ error: err.message })
  }
}
