// pages/api/brevo-webhook.js
// ══════════════════════════════════════════════════════
// Recebe eventos da Brevo (email respondido, clicado etc.)
// e registra na timeline do negócio correspondente no CRM
//
// Configure em: Brevo → Configurações → Webhooks → Transacional
// URL: https://seu-dominio.com/api/brevo-webhook
// Eventos: delivered, opened, clicked, replied, softBounce, hardBounce
// ══════════════════════════════════════════════════════

import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

export const config = { api: { bodyParser: { sizeLimit: '2mb' } } }

async function getCfg(empresaId) {
  const { data } = await supabase.from('vx_storage').select('value').eq('key', `cfg:${empresaId}`).maybeSingle()
  return data?.value ? JSON.parse(data.value) : {}
}

async function saveCfg(empresaId, cfg) {
  await supabase.from('vx_storage').upsert(
    { key: `cfg:${empresaId}`, value: JSON.stringify(cfg), updated_at: new Date().toISOString() },
    { onConflict: 'key' }
  )
}

// Mapeia eventos Brevo para labels legíveis
const EVENTO_LABEL = {
  delivered:   { label: 'E-mail entregue',     icon: '✅', tipo: 'E-mail' },
  opened:      { label: 'E-mail aberto',        icon: '👁',  tipo: 'E-mail' },
  clicked:     { label: 'Link clicado no e-mail', icon: '🔗', tipo: 'E-mail' },
  replied:     { label: 'E-mail respondido',    icon: '↩️',  tipo: 'E-mail Respondido' },
  softBounce:  { label: 'E-mail não entregue (soft bounce)', icon: '⚠️', tipo: 'E-mail' },
  hardBounce:  { label: 'E-mail rejeitado (endereço inválido)', icon: '❌', tipo: 'E-mail' },
  unsubscribed:{ label: 'Destinatário descadastrou', icon: '🚫', tipo: 'E-mail' },
  spam:        { label: 'Marcado como spam',    icon: '⛔', tipo: 'E-mail' },
}

export default async function handler(req, res) {
  // Brevo envia GET para verificar o webhook na configuração
  if (req.method === 'GET') {
    return res.status(200).json({ ok: true, service: 'Vivanexa Brevo Webhook' })
  }

  if (req.method !== 'POST') return res.status(405).json({ error: 'Método não permitido' })

  try {
    const body = req.body

    // Brevo pode enviar array ou objeto único
    const eventos = Array.isArray(body) ? body : [body]

    for (const evento of eventos) {
      const { event, email, subject, date, tags, messageId } = evento

      if (!event || !email) continue

      // Busca empresaId pelo email do destinatário
      // A tag 'empresaId:xxx' é adicionada automaticamente no send-email.js
      // ou buscamos pelo email do destinatário nos negócios
      let empresaId = null
      let negocioId = null

      // Tenta extrair empresaId das tags do evento
      if (tags && Array.isArray(tags)) {
        const tagEmpresa = tags.find(t => t.startsWith('empresaId:'))
        if (tagEmpresa) empresaId = tagEmpresa.replace('empresaId:', '')
        const tagNeg = tags.find(t => t.startsWith('negocioId:'))
        if (tagNeg) negocioId = tagNeg.replace('negocioId:', '')
      }

      // Se não veio nas tags, busca no Supabase por email do destinatário
      if (!empresaId) {
        // Busca em todos os cfgs (apenas para ambientes com poucos tenants)
        const { data: rows } = await supabase
          .from('vx_storage')
          .select('key, value')
          .like('key', 'cfg:%')
          .limit(50)

        if (rows) {
          for (const row of rows) {
            try {
              const cfg = JSON.parse(row.value)
              const negocios = cfg.crm_negocios || []
              const neg = negocios.find(n => n.email && n.email.toLowerCase() === email.toLowerCase())
              if (neg) {
                empresaId = row.key.replace('cfg:', '')
                negocioId = neg.id
                break
              }
            } catch {}
          }
        }
      }

      if (!empresaId) {
        console.log(`[brevo-webhook] Evento "${event}" para ${email} — empresa não encontrada`)
        continue
      }

      const cfg = await getCfg(empresaId)
      const meta = EVENTO_LABEL[event] || { label: event, icon: '📧', tipo: 'E-mail' }

      // Monta atividade para a timeline
      const atividade = {
        id: 'ativ_brevo_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
        negocioId: negocioId || '',
        tipo: meta.tipo,
        descricao: `${meta.icon} ${meta.label}${subject ? ` — "${subject}"` : ''} (${email})`,
        data: date ? new Date(date * 1000).toISOString() : new Date().toISOString(),
        criadoEm: new Date().toISOString(),
        concluida: true,
        prazo: '',
        duracao_seg: 0,
        gravacao_url: '',
        google_event_id: '',
        google_link: '',
        fonte: 'brevo_webhook',
        eventoBrevo: event,
      }

      cfg.crm_atividades = [...(cfg.crm_atividades || []), atividade]

      // Para respostas de email: adiciona notificação no sino
      if (event === 'replied') {
        const notif = {
          id: 'brevo_reply_' + Date.now(),
          tipo: 'email_reply',
          descricao: `${email} respondeu o e-mail${subject ? ` "${subject}"` : ''}`,
          data: new Date().toISOString(),
          negocioId: negocioId || '',
          lida: false,
        }
        cfg.wppNotificacoes = [...(cfg.wppNotificacoes || []).slice(-49), notif]
      }

      // Para abertura de email — também notifica
      if (event === 'opened') {
        const notif = {
          id: 'brevo_open_' + Date.now(),
          tipo: 'email_open',
          descricao: `${email} abriu o e-mail${subject ? ` "${subject}"` : ''}`,
          data: new Date().toISOString(),
          negocioId: negocioId || '',
          lida: false,
        }
        cfg.wppNotificacoes = [...(cfg.wppNotificacoes || []).slice(-49), notif]
      }

      await saveCfg(empresaId, cfg)
      console.log(`[brevo-webhook] ✅ Evento "${event}" registrado para empresa ${empresaId}${negocioId ? `, negócio ${negocioId}` : ''}`)
    }

    return res.status(200).json({ ok: true })
  } catch (err) {
    console.error('[brevo-webhook] Erro:', err.message)
    return res.status(200).json({ ok: true }) // sempre 200 para Brevo não retentar
  }
}
