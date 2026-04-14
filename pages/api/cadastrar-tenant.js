// pages/api/cadastrar-tenant.js
// ✅ Fluxo completo ao cadastrar um novo cliente:
//   1. Cria usuário no Supabase Auth (email + senha)
//   2. Cria/atualiza perfil na tabela 'perfis'
//   3. Salva tenant:ID e cfg:ID no vx_storage
//   4. (Opcional) Cria cliente + cobrança adesão + assinatura mensal no Asaas
//   5. Envia e-mail de boas-vindas com credenciais via SMTP configurado

import { createClient } from '@supabase/supabase-js'
import nodemailer from 'nodemailer'

// Cliente admin (service_role) para criar usuários
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY // ⚠️ adicionar no .env.local
)

// ══════════════════════════════════════════════════════
// HANDLER PRINCIPAL
// ══════════════════════════════════════════════════════

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido' })
  }

  const {
    nomeEmpresa, cnpj, emailAdmin, senha, telefone, responsavel,
    vendedorId, plano, status, maxUsuarios, mensalidade, adesao,
    vencimento, modulosLiberados, obs,
    criarAsaas, billingType,
    sendEmail, masterCfg,
  } = req.body

  if (!emailAdmin || !senha || !nomeEmpresa) {
    return res.status(400).json({ error: 'emailAdmin, senha e nomeEmpresa são obrigatórios' })
  }

  const erros = []
  const agora = new Date().toISOString()
  let supabaseUserId = null
  let empresaId      = null
  let asaasCustomerId = null
  let asaasSubId      = null

  try {

    // ══════════════════════════════════════════════════
    // 1. CRIAR USUÁRIO NO SUPABASE AUTH
    // ══════════════════════════════════════════════════
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: emailAdmin,
      password: senha,
      email_confirm: true, // não precisa confirmar e-mail
      user_metadata: { name: responsavel || nomeEmpresa },
    })

    if (authError) {
      // Se usuário já existe, tenta buscar pelo e-mail
      if (authError.message?.includes('already registered') || authError.code === 'email_exists') {
        const { data: existUsers } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 })
        const existing = existUsers?.users?.find(u => u.email === emailAdmin)
        if (existing) {
          supabaseUserId = existing.id
          // Atualiza senha
          await supabaseAdmin.auth.admin.updateUserById(supabaseUserId, { password: senha })
        } else {
          throw new Error('Erro ao criar usuário: ' + authError.message)
        }
      } else {
        throw new Error('Erro ao criar usuário: ' + authError.message)
      }
    } else {
      supabaseUserId = authData.user.id
    }

    empresaId = supabaseUserId // empresa_id = user_id do admin master da empresa

    // ══════════════════════════════════════════════════
    // 2. CRIAR / ATUALIZAR PERFIL NA TABELA 'perfis'
    // ══════════════════════════════════════════════════
    const { error: perfilError } = await supabaseAdmin.from('perfis').upsert({
      user_id:    supabaseUserId,
      nome:       responsavel || nomeEmpresa,
      email:      emailAdmin,
      empresa_id: empresaId,
      perfil:     'admin',
      updated_at: agora,
    }, { onConflict: 'user_id' })

    if (perfilError) erros.push('perfil: ' + perfilError.message)

    // ══════════════════════════════════════════════════
    // 3. ASAAS — CRIAR CLIENTE + COBRANÇA ADESÃO + ASSINATURA
    // ══════════════════════════════════════════════════
    if (criarAsaas && masterCfg?.asaasKey) {
      try {
        const asaasBase = masterCfg.asaasSandbox
          ? 'https://sandbox.asaas.com/api/v3'
          : 'https://api.asaas.com/v3'

        const asaasHeaders = {
          'Content-Type': 'application/json',
          'access_token': masterCfg.asaasKey,
        }

        // 3a. Criar cliente no Asaas
        const cnpjLimpo = cnpj ? cnpj.replace(/\D/g, '') : ''
        const customerBody = {
          name:     nomeEmpresa,
          email:    emailAdmin,
          phone:    telefone ? telefone.replace(/\D/g, '') : undefined,
          cpfCnpj:  cnpjLimpo || undefined,
          groupName: plano,
          externalReference: empresaId,
          notificationDisabled: false,
        }

        const cusRes = await fetch(`${asaasBase}/customers`, {
          method: 'POST',
          headers: asaasHeaders,
          body: JSON.stringify(customerBody),
        })
        const cusData = await cusRes.json()

        if (!cusRes.ok) {
          erros.push('Asaas customer: ' + (cusData?.errors?.[0]?.description || cusData?.error || JSON.stringify(cusData)))
        } else {
          asaasCustomerId = cusData.id

          // 3b. Cobrança de adesão (avulsa) se valor > 0
          if (Number(adesao) > 0) {
            const dueDate = new Date(); dueDate.setDate(dueDate.getDate() + 3)
            const adesaoRes = await fetch(`${asaasBase}/payments`, {
              method: 'POST',
              headers: asaasHeaders,
              body: JSON.stringify({
                customer:    asaasCustomerId,
                billingType: billingType || 'BOLETO',
                value:       Number(adesao),
                dueDate:     dueDate.toISOString().slice(0, 10),
                description: `Adesão — ${nomeEmpresa} — Plano ${plano}`,
                externalReference: `adesao:${empresaId}`,
              }),
            })
            const adesaoData = await adesaoRes.json()
            if (!adesaoRes.ok) erros.push('Asaas adesão: ' + (adesaoData?.errors?.[0]?.description || JSON.stringify(adesaoData)))
          }

          // 3c. Assinatura mensal recorrente se mensalidade > 0
          if (Number(mensalidade) > 0) {
            const nextDue = vencimento || new Date(new Date().setDate(new Date().getDate() + 30)).toISOString().slice(0, 10)
            const subRes = await fetch(`${asaasBase}/subscriptions`, {
              method: 'POST',
              headers: asaasHeaders,
              body: JSON.stringify({
                customer:    asaasCustomerId,
                billingType: billingType || 'BOLETO',
                value:       Number(mensalidade),
                nextDueDate: nextDue,
                cycle:       'MONTHLY',
                description: `Mensalidade ${plano} — ${nomeEmpresa}`,
                externalReference: `sub:${empresaId}`,
              }),
            })
            const subData = await subRes.json()
            if (!subRes.ok) erros.push('Asaas assinatura: ' + (subData?.errors?.[0]?.description || JSON.stringify(subData)))
            else asaasSubId = subData.id
          }
        }
      } catch (asaasErr) {
        erros.push('Asaas exception: ' + asaasErr.message)
      }
    }

    // ══════════════════════════════════════════════════
    // 4. SALVAR TENANT NO VX_STORAGE
    // ══════════════════════════════════════════════════
    const tenantId = empresaId // usa o supabase user_id como tenant id

    const tenantData = {
      id:               tenantId,
      empresaId:        empresaId,
      nomeEmpresa,
      cnpj,
      emailAdmin,
      telefone,
      responsavel,
      vendedorId,
      plano,
      status,
      maxUsuarios:      Number(maxUsuarios),
      mensalidade:      Number(mensalidade),
      adesao:           Number(adesao),
      vencimento,
      modulosLiberados,
      obs,
      asaasCustomerId,
      asaasSubId,
      criadoEm:         agora,
      atualizadoEm:     agora,
    }

    const { error: tenantError } = await supabaseAdmin.from('vx_storage').upsert(
      { key: `tenant:${tenantId}`, value: JSON.stringify(tenantData), updated_at: agora },
      { onConflict: 'key' }
    )
    if (tenantError) erros.push('tenant storage: ' + tenantError.message)

    // Salvar cfg da empresa
    const cfgData = {
      company:              nomeEmpresa,
      tenant_plano:         plano,
      tenant_status:        status,
      tenant_modulos:       modulosLiberados,
      tenant_maxUsuarios:   Number(maxUsuarios),
      tenant_vencimento:    vencimento,
      tenant_mensalidade:   Number(mensalidade),
      tenant_adesao:        Number(adesao),
      modulosAtivos:        modulosLiberados,
      asaasCustomerId,
      asaasSubId,
      kpiRequired:          false,
      kpiTemplates:         [],
      kpiLog:               [],
    }

    const { error: cfgError } = await supabaseAdmin.from('vx_storage').upsert(
      { key: `cfg:${empresaId}`, value: JSON.stringify(cfgData), updated_at: agora },
      { onConflict: 'key' }
    )
    if (cfgError) erros.push('cfg storage: ' + cfgError.message)

    // ══════════════════════════════════════════════════
    // 5. ENVIAR E-MAIL DE BOAS-VINDAS
    // ══════════════════════════════════════════════════
    if (sendEmail && masterCfg?.smtpHost) {
      try {
        const siteUrl = masterCfg.siteUrl || 'https://vivanexa-saas.vercel.app'
        const transporter = nodemailer.createTransport({
          host:   masterCfg.smtpHost,
          port:   Number(masterCfg.smtpPort) || 587,
          secure: Number(masterCfg.smtpPort) === 465,
          auth: { user: masterCfg.smtpUser, pass: masterCfg.smtpPass },
        })

        const htmlEmail = gerarEmailBoasVindas({
          nome:       responsavel || nomeEmpresa,
          nomeEmpresa,
          email:      emailAdmin,
          senha,
          plano,
          siteUrl,
          mensalidade: Number(mensalidade),
          vencimento,
        })

        await transporter.sendMail({
          from:    masterCfg.smtpFrom || masterCfg.smtpUser,
          to:      emailAdmin,
          subject: `🚀 Bem-vindo(a) à Vivanexa — Seus dados de acesso`,
          html:    htmlEmail,
        })
      } catch (emailErr) {
        erros.push('email: ' + emailErr.message)
      }
    }

    // ══════════════════════════════════════════════════
    // RESPOSTA
    // ══════════════════════════════════════════════════
    return res.status(200).json({
      success: true,
      tenantId,
      empresaId,
      supabaseUserId,
      asaasCustomerId,
      asaasSubId,
      avisos: erros.length ? erros : undefined,
    })

  } catch (err) {
    console.error('[cadastrar-tenant]', err)
    return res.status(500).json({ error: err.message })
  }
}

// ══════════════════════════════════════════════════════
// TEMPLATE DE E-MAIL
// ══════════════════════════════════════════════════════

function gerarEmailBoasVindas({ nome, nomeEmpresa, email, senha, plano, siteUrl, mensalidade, vencimento }) {
  const fmt = n => 'R$ ' + Number(n||0).toLocaleString('pt-BR',{minimumFractionDigits:2})
  const fmtData = iso => iso ? new Date(iso).toLocaleDateString('pt-BR') : '—'
  const planoLabel = plano?.charAt(0).toUpperCase() + plano?.slice(1)

  return `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1.0"/>
  <title>Bem-vindo à Vivanexa</title>
</head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:Arial,Helvetica,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:40px 20px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,.08);">

        <!-- HEADER -->
        <tr><td style="background:linear-gradient(135deg,#0f172a 0%,#1e3a5f 60%,#0f4c75 100%);padding:40px 48px;text-align:center;">
          <div style="font-size:36px;margin-bottom:12px;">🚀</div>
          <h1 style="margin:0;font-size:26px;font-weight:800;color:#ffffff;font-family:Arial,sans-serif;letter-spacing:-0.5px;">Bem-vindo(a) à Vivanexa!</h1>
          <p style="margin:10px 0 0;color:#94a3b8;font-size:14px;">Sua plataforma de vendas inteligente está pronta.</p>
        </td></tr>

        <!-- SAUDAÇÃO -->
        <tr><td style="padding:36px 48px 24px;">
          <p style="margin:0 0 16px;font-size:16px;color:#1e293b;line-height:1.6;">Olá, <strong>${nome}</strong>! 👋</p>
          <p style="margin:0;font-size:14px;color:#475569;line-height:1.7;">
            O acesso da <strong>${nomeEmpresa}</strong> à plataforma Vivanexa foi criado com sucesso.<br/>
            Abaixo estão seus dados de acesso. Guarde-os em local seguro.
          </p>
        </td></tr>

        <!-- CREDENCIAIS -->
        <tr><td style="padding:0 48px 28px;">
          <div style="background:#f8fafc;border:2px solid #e2e8f0;border-radius:12px;padding:28px;">
            <h3 style="margin:0 0 20px;font-size:14px;color:#64748b;text-transform:uppercase;letter-spacing:1px;">🔑 Dados de Acesso</h3>
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td style="padding:8px 0;border-bottom:1px solid #e2e8f0;">
                  <span style="font-size:12px;color:#94a3b8;display:block;">ENDEREÇO DE ACESSO</span>
                  <a href="${siteUrl}" style="font-size:15px;color:#0f172a;font-weight:700;text-decoration:none;">${siteUrl}</a>
                </td>
              </tr>
              <tr>
                <td style="padding:12px 0;border-bottom:1px solid #e2e8f0;">
                  <span style="font-size:12px;color:#94a3b8;display:block;">USUÁRIO (LOGIN)</span>
                  <span style="font-size:15px;color:#0f172a;font-weight:700;">${email}</span>
                </td>
              </tr>
              <tr>
                <td style="padding:12px 0;">
                  <span style="font-size:12px;color:#94a3b8;display:block;">SENHA INICIAL</span>
                  <span style="font-size:18px;color:#0f172a;font-weight:800;font-family:monospace;background:#e2e8f0;padding:4px 12px;border-radius:6px;letter-spacing:2px;">${senha}</span>
                </td>
              </tr>
            </table>
          </div>
        </td></tr>

        <!-- PLANO -->
        <tr><td style="padding:0 48px 28px;">
          <div style="background:linear-gradient(135deg,#0f172a,#1e3a5f);border-radius:12px;padding:24px;display:flex;">
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td>
                  <h3 style="margin:0 0 16px;font-size:14px;color:#94a3b8;text-transform:uppercase;letter-spacing:1px;">📦 Seu Plano</h3>
                  <table width="100%" cellpadding="0" cellspacing="0">
                    <tr>
                      <td style="padding:6px 0;"><span style="font-size:13px;color:#64748b;">Plano:</span></td>
                      <td style="padding:6px 0;text-align:right;"><span style="font-size:13px;color:#00d4ff;font-weight:700;">${planoLabel}</span></td>
                    </tr>
                    ${mensalidade > 0 ? `<tr><td style="padding:6px 0;"><span style="font-size:13px;color:#64748b;">Mensalidade:</span></td><td style="padding:6px 0;text-align:right;"><span style="font-size:13px;color:#10b981;font-weight:700;">${fmt(mensalidade)}/mês</span></td></tr>` : ''}
                    ${vencimento ? `<tr><td style="padding:6px 0;"><span style="font-size:13px;color:#64748b;">Próxima renovação:</span></td><td style="padding:6px 0;text-align:right;"><span style="font-size:13px;color:#e2e8f0;font-weight:700;">${fmtData(vencimento)}</span></td></tr>` : ''}
                  </table>
                </td>
              </tr>
            </table>
          </div>
        </td></tr>

        <!-- CTA -->
        <tr><td style="padding:0 48px 36px;text-align:center;">
          <a href="${siteUrl}" style="display:inline-block;background:linear-gradient(135deg,#00d4ff,#0099bb);color:#000000;font-size:15px;font-weight:800;text-decoration:none;padding:16px 40px;border-radius:10px;letter-spacing:0.5px;">
            🚀 Acessar Plataforma Agora
          </a>
          <p style="margin:16px 0 0;font-size:12px;color:#94a3b8;">Recomendamos alterar sua senha após o primeiro acesso.</p>
        </td></tr>

        <!-- DICAS -->
        <tr><td style="padding:0 48px 36px;">
          <div style="background:#f0fdf4;border-left:4px solid #10b981;border-radius:0 8px 8px 0;padding:16px 20px;">
            <h4 style="margin:0 0 10px;font-size:13px;color:#065f46;">💡 Primeiros passos recomendados</h4>
            <ul style="margin:0;padding-left:18px;font-size:13px;color:#047857;line-height:1.8;">
              <li>Acesse <strong>Config → Empresa</strong> e complete seus dados</li>
              <li>Configure sua chave de <strong>IA (OpenAI/Gemini/Groq)</strong></li>
              <li>Conecte seu <strong>WhatsApp</strong> para automatizar atendimentos</li>
              <li>Configure seus <strong>Produtos e Preços</strong></li>
              <li>Convide sua <strong>equipe de vendas</strong></li>
            </ul>
          </div>
        </td></tr>

        <!-- SUPORTE -->
        <tr><td style="padding:0 48px 28px;">
          <p style="margin:0;font-size:13px;color:#64748b;line-height:1.6;text-align:center;">
            Precisa de ajuda? Entre em contato com nosso suporte.<br/>
            Estamos aqui para garantir seu sucesso! 💪
          </p>
        </td></tr>

        <!-- FOOTER -->
        <tr><td style="background:#f8fafc;border-top:1px solid #e2e8f0;padding:20px 48px;text-align:center;">
          <p style="margin:0;font-size:11px;color:#94a3b8;">
            © ${new Date().getFullYear()} Vivanexa SaaS. Todos os direitos reservados.<br/>
            Este e-mail contém informações confidenciais de acesso. Não compartilhe com terceiros.
          </p>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>
`
}
