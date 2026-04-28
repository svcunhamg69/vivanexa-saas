// pages/api/cobranca-automatica.js
// Endpoint chamado por cron job (ex: Vercel Cron, cron-job.org, Render Cron)
// GET /api/cobranca-automatica?secret=SEU_SECRET
// Verifica todos os tenants inadimplentes e dispara régua de cobrança configurável

import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

// Régua padrão caso não configurada no master_cfg
const REGUA_PADRAO = [
  { diasAposVenc: 2,  canal: ['email'],           assunto: 'Lembrete de pagamento', ativo: true },
  { diasAposVenc: 5,  canal: ['email','whatsapp'], assunto: 'Pagamento pendente',    ativo: true },
  { diasAposVenc: 10, canal: ['email','whatsapp'], assunto: 'Urgente: pagamento em atraso', ativo: true },
  { diasAposVenc: 20, canal: ['email','whatsapp'], assunto: 'Acesso será suspenso',  ativo: true },
  { diasAposVenc: 30, canal: ['email'],            assunto: 'Contrato cancelado',    ativo: false },
]

function diasEntre(d1, d2) {
  return Math.floor((new Date(d2) - new Date(d1)) / 86400000)
}

function substituirVariaveis(template, vars) {
  return template.replace(/\{\{(\w+)\}\}/g, (_, k) => vars[k] || '')
}

export default async function handler(req, res) {
  // Verifica secret para segurança
  const secret = req.query.secret || req.headers['x-cron-secret']
  if (secret !== process.env.CRON_SECRET && secret !== 'dev_test') {
    return res.status(401).json({ error: 'Não autorizado.' })
  }

  const hoje = new Date().toISOString().slice(0, 10)
  const log  = []

  try {
    // Carrega configuração master
    const { data: cfgRow } = await supabase.from('vx_storage').select('value').eq('key', 'master_cfg').maybeSingle()
    const masterCfg = cfgRow?.value ? JSON.parse(cfgRow.value) : {}

    const regua         = masterCfg.reguaCobranca?.length ? masterCfg.reguaCobranca : REGUA_PADRAO
    const reguaAtiva    = regua.filter(r => r.ativo)
    const siteUrl       = masterCfg.siteUrl || 'https://vivanexa-saas.vercel.app'
    const wppApiUrl     = masterCfg.wppApiUrl || ''   // URL do bot WhatsApp (ex: /api/wpp/send)
    const wppToken      = masterCfg.wppToken  || ''

    // Carrega todos os tenants
    const { data: rows } = await supabase.from('vx_storage').select('key, value').like('key', 'tenant:%')
    const tenants = (rows || []).map(r => { try { return JSON.parse(r.value) } catch { return null } }).filter(Boolean)

    // Filtra inadimplentes: vencimento passou E pagamento não é 'pago'
    const inadimplentes = tenants.filter(t => {
      if (!t.vencimento || t.status === 'cancelado') return false
      const pagto = t.pagamentoStatus || 'pendente'
      if (pagto === 'pago') return false
      return new Date(t.vencimento) < new Date()
    })

    log.push({ msg: `${inadimplentes.length} inadimplente(s) encontrado(s)`, data: hoje })

    for (const tenant of inadimplentes) {
      const diasAtraso = diasEntre(tenant.vencimento, hoje)
      if (diasAtraso <= 0) continue

      // Carrega histórico de notificações deste tenant
      const { data: histRow } = await supabase.from('vx_storage').select('value').eq('key', `cobranca_hist:${tenant.id}`).maybeSingle()
      const hist = histRow?.value ? JSON.parse(histRow.value) : []

      for (const etapa of reguaAtiva) {
        // Verifica se esta etapa já foi disparada
        const jaEnviado = hist.some(h => h.etapa === etapa.diasAposVenc && h.data === hoje)
        if (jaEnviado) continue

        // Verifica se chegou o dia desta etapa
        // Dispara quando diasAtraso >= etapa.diasAposVenc e não enviou esta etapa ainda nenhum dia
        const etapaJaEnviadaAlgumDia = hist.some(h => h.etapa === etapa.diasAposVenc)
        if (etapaJaEnviadaAlgumDia) continue
        if (diasAtraso < etapa.diasAposVenc) continue

        const vars = {
          nomeEmpresa:  tenant.nomeEmpresa || 'Cliente',
          responsavel:  tenant.responsavel || 'Responsável',
          diasAtraso:   String(diasAtraso),
          vencimento:   new Date(tenant.vencimento + 'T12:00:00').toLocaleDateString('pt-BR'),
          mensalidade:  'R$ ' + Number(tenant.mensalidade || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 }),
          siteUrl,
          linkPagamento: masterCfg.linkPagamento || siteUrl,
        }

        // Template de e-mail
        const templateEmail = masterCfg.emailTemplates?.cobranca || DEFAULT_TEMPLATE_EMAIL
        const htmlEmail = substituirVariaveis(templateEmail, vars)
        const assunto   = substituirVariaveis(etapa.assunto || 'Pagamento pendente - {{nomeEmpresa}}', vars)

        const resultEtapa = { etapa: etapa.diasAposVenc, data: hoje, canais: [] }

        // ── Envia E-mail ──────────────────────────────────────
        if (etapa.canal.includes('email') && tenant.emailAdmin) {
          try {
            const emailRes = await fetch(`${siteUrl}/api/send-email`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                to:      tenant.emailAdmin,
                subject: assunto,
                html:    htmlEmail,
                config: {
                  smtpHost: masterCfg.smtpHost,
                  smtpPort: masterCfg.smtpPort,
                  smtpUser: masterCfg.smtpUser,
                  smtpPass: masterCfg.smtpPass,
                  emailApiKey: masterCfg.emailApiKey,
                  emailRemetente: masterCfg.smtpFrom || masterCfg.smtpUser,
                  nomeRemetente: 'Vivanexa',
                }
              })
            })
            const emailJson = await emailRes.json()
            resultEtapa.canais.push({ canal: 'email', ok: emailJson.success || false, erro: emailJson.error })
            log.push({ tenant: tenant.nomeEmpresa, etapa: etapa.diasAposVenc, canal: 'email', ok: emailJson.success })
          } catch (e) {
            resultEtapa.canais.push({ canal: 'email', ok: false, erro: e.message })
          }
        }

        // ── Envia WhatsApp ────────────────────────────────────
        if (etapa.canal.includes('whatsapp') && tenant.telefone && wppApiUrl) {
          try {
            const templateWpp = masterCfg.wppTemplates?.cobranca || DEFAULT_TEMPLATE_WPP
            const msgWpp = substituirVariaveis(templateWpp, vars)
            const wppRes = await fetch(wppApiUrl, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${wppToken}` },
              body: JSON.stringify({ to: tenant.telefone.replace(/\D/g, ''), message: msgWpp })
            })
            const wppJson = await wppRes.json()
            resultEtapa.canais.push({ canal: 'whatsapp', ok: wppRes.ok, erro: wppJson.error })
            log.push({ tenant: tenant.nomeEmpresa, etapa: etapa.diasAposVenc, canal: 'whatsapp', ok: wppRes.ok })
          } catch (e) {
            resultEtapa.canais.push({ canal: 'whatsapp', ok: false, erro: e.message })
          }
        }

        // ── Ação especial: suspender no último step ───────────
        if (etapa.suspenderAcesso && tenant.status === 'ativo') {
          await supabase.from('vx_storage').upsert({
            key: `tenant:${tenant.id}`,
            value: JSON.stringify({ ...tenant, status: 'suspenso', atualizadoEm: new Date().toISOString() }),
            updated_at: new Date().toISOString()
          }, { onConflict: 'key' })
          // Atualiza cfg do tenant
          const { data: cfgT } = await supabase.from('vx_storage').select('value').eq('key', `cfg:${tenant.empresaId || tenant.id}`).maybeSingle()
          const cfgTObj = cfgT?.value ? JSON.parse(cfgT.value) : {}
          await supabase.from('vx_storage').upsert({
            key: `cfg:${tenant.empresaId || tenant.id}`,
            value: JSON.stringify({ ...cfgTObj, tenant_status: 'suspenso' }),
            updated_at: new Date().toISOString()
          }, { onConflict: 'key' })
          resultEtapa.suspendeu = true
          log.push({ tenant: tenant.nomeEmpresa, acao: 'suspenso automaticamente' })
        }

        // Salva no histórico
        hist.push(resultEtapa)
      }

      // Salva histórico atualizado
      await supabase.from('vx_storage').upsert({
        key: `cobranca_hist:${tenant.id}`,
        value: JSON.stringify(hist.slice(-50)), // mantém últimas 50 entradas
        updated_at: new Date().toISOString()
      }, { onConflict: 'key' })
    }

    return res.status(200).json({ ok: true, processados: inadimplentes.length, log })
  } catch (err) {
    console.error('[cobranca-automatica]', err)
    return res.status(500).json({ error: err.message, log })
  }
}

// ── Templates padrão ──────────────────────────────────
const DEFAULT_TEMPLATE_EMAIL = `
<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;border:1px solid #e2e8f0">
  <div style="background:linear-gradient(135deg,#0d1526,#1a2540);padding:32px;text-align:center">
    <h1 style="color:#00d4ff;font-size:22px;margin:0">Vivanexa</h1>
    <p style="color:#94a3b8;margin:8px 0 0;font-size:13px">Plataforma de Gestão Comercial</p>
  </div>
  <div style="padding:32px">
    <h2 style="color:#1a202c;font-size:18px;margin:0 0 16px">⚠️ Pagamento Pendente</h2>
    <p style="color:#475569;font-size:14px;line-height:1.7">Olá, <strong>{{responsavel}}</strong>!</p>
    <p style="color:#475569;font-size:14px;line-height:1.7">
      Identificamos que a mensalidade da <strong>{{nomeEmpresa}}</strong> no valor de <strong>{{mensalidade}}</strong>
      está em aberto há <strong>{{diasAtraso}} dia(s)</strong> (vencimento: <strong>{{vencimento}}</strong>).
    </p>
    <p style="color:#475569;font-size:14px;line-height:1.7">
      Para manter o acesso ao sistema, regularize seu pagamento o quanto antes.
    </p>
    <div style="text-align:center;margin:28px 0">
      <a href="{{linkPagamento}}" style="display:inline-block;padding:14px 32px;background:linear-gradient(135deg,#00d4ff,#0099bb);color:#000;text-decoration:none;border-radius:8px;font-weight:700;font-size:14px">
        💳 Regularizar Pagamento
      </a>
    </div>
    <p style="color:#94a3b8;font-size:12px;line-height:1.6">
      Em caso de dúvidas, entre em contato pelo e-mail ou WhatsApp da Vivanexa.<br>
      Se já realizou o pagamento, desconsidere este aviso.
    </p>
  </div>
  <div style="background:#f8fafc;padding:16px;text-align:center;font-size:11px;color:#94a3b8">
    Vivanexa SaaS · <a href="{{siteUrl}}" style="color:#00d4ff">{{siteUrl}}</a>
  </div>
</div>`

const DEFAULT_TEMPLATE_WPP = `⚠️ *Vivanexa — Pagamento Pendente*

Olá, *{{responsavel}}*!

Sua mensalidade de *{{mensalidade}}* está em aberto há *{{diasAtraso}} dia(s)* (vencimento: {{vencimento}}).

Para regularizar e manter o acesso ao sistema, acesse:
🔗 {{linkPagamento}}

Dúvidas? Responda esta mensagem.
_Vivanexa SaaS_`
