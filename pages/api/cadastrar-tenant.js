// pages/api/cadastrar-tenant.js — v3
// ✅ Cria usuário Supabase Auth isolado por empresaId (user_id do admin da empresa)
// ✅ Salva tenant:ID e cfg:ID com RLS garantindo que cada cliente vê só seus dados
// ✅ Asaas: cliente + cobrança de adesão (avulsa) + assinatura recorrente
// ✅ E-mail de boas-vindas com template personalizável e credenciais completas

import { createClient } from '@supabase/supabase-js'

// ⚠️ IMPORTANTE: este client usa a SERVICE ROLE KEY (bypass de RLS)
// Necessário para criar usuários e escrever cfg de outros tenants
// Adicione SUPABASE_SERVICE_ROLE_KEY no .env.local e nas env vars da Vercel
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

export const config = { api: { bodyParser: { sizeLimit: '1mb' } } }

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método não permitido' })

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
  let asaasSubId     = null

  // ══════════════════════════════════════════════════════
  // 1. CRIAR / RECUPERAR USUÁRIO NO SUPABASE AUTH
  //    Cada tenant tem seu próprio usuário → isolamento total
  // ══════════════════════════════════════════════════════
  try {
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email:         emailAdmin.trim().toLowerCase(),
      password:      senha,
      email_confirm: true,
      user_metadata: { name: responsavel || nomeEmpresa, empresa: nomeEmpresa },
    })

    if (authError) {
      if (authError.message?.includes('already registered') || authError.code === 'email_exists') {
        // Usuário já existe — localiza e atualiza a senha
        const { data: lista } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 })
        const existing = lista?.users?.find(u => u.email === emailAdmin.trim().toLowerCase())
        if (existing) {
          supabaseUserId = existing.id
          await supabaseAdmin.auth.admin.updateUserById(supabaseUserId, {
            password: senha,
            user_metadata: { name: responsavel || nomeEmpresa, empresa: nomeEmpresa }
          })
        } else {
          return res.status(400).json({ error: 'E-mail já cadastrado mas não encontrado. Contate o suporte.' })
        }
      } else {
        return res.status(400).json({ error: 'Erro ao criar usuário: ' + authError.message })
      }
    } else {
      supabaseUserId = authData.user.id
    }

    // empresaId = user_id do admin da empresa
    // Isso garante que todos os dados da empresa ficam sob essa chave
    empresaId = supabaseUserId

  } catch (e) {
    return res.status(500).json({ error: 'Erro Supabase Auth: ' + e.message })
  }

  // ══════════════════════════════════════════════════════
  // 2. CRIAR / ATUALIZAR PERFIL NA TABELA 'perfis'
  //    Mantém mapeamento user_id → empresa_id para o _app.js
  // ══════════════════════════════════════════════════════
  const { error: perfilError } = await supabaseAdmin.from('perfis').upsert({
    user_id:    supabaseUserId,
    nome:       responsavel || nomeEmpresa,
    email:      emailAdmin.trim().toLowerCase(),
    empresa_id: empresaId,
    perfil:     'admin',
    updated_at: agora,
  }, { onConflict: 'user_id' })

  if (perfilError) erros.push('perfil: ' + perfilError.message)

  // ══════════════════════════════════════════════════════
  // 3. ASAAS — CLIENTE + ADESÃO (avulsa) + ASSINATURA MENSAL
  // ══════════════════════════════════════════════════════
  if (criarAsaas && masterCfg?.asaasKey) {
    try {
      const base = masterCfg.asaasSandbox
        ? 'https://sandbox.asaas.com/api/v3'
        : 'https://api.asaas.com/v3'
      const headers = {
        'Content-Type': 'application/json',
        'access_token': masterCfg.asaasKey,
      }

      // 3a. Cria ou localiza cliente no Asaas
      const custResp = await fetch(`${base}/customers`, {
        method: 'POST', headers,
        body: JSON.stringify({
          name:               responsavel || nomeEmpresa,
          email:              emailAdmin,
          phone:              (telefone||'').replace(/\D/g,''),
          cpfCnpj:            (cnpj||'').replace(/\D/g,''),
          externalReference:  empresaId,
          notificationDisabled: false,
        })
      })
      const custJson = await custResp.json()

      if (custResp.ok) {
        asaasCustomerId = custJson.id
      } else if (custJson.errors?.some(e => e.description?.includes('cpfCnpj'))) {
        // CNPJ duplicado — busca cliente existente
        const busca = await fetch(`${base}/customers?cpfCnpj=${(cnpj||'').replace(/\D/g,'')}`, { headers })
        const buscaJson = await busca.json()
        asaasCustomerId = buscaJson.data?.[0]?.id
        if (!asaasCustomerId) {
          // Tenta sem CNPJ
          const custSemCnpj = await fetch(`${base}/customers`, {
            method: 'POST', headers,
            body: JSON.stringify({ name: responsavel || nomeEmpresa, email: emailAdmin, externalReference: empresaId })
          })
          const cJson = await custSemCnpj.json()
          if (custSemCnpj.ok) asaasCustomerId = cJson.id
          else erros.push('asaas_customer: ' + JSON.stringify(cJson.errors))
        }
      } else {
        erros.push('asaas_customer: ' + JSON.stringify(custJson.errors || custJson))
      }

      // 3b. Cobrança de ADESÃO (avulsa, vence em 1 dia)
      if (asaasCustomerId && Number(adesao) > 0) {
        const dueAdesao = new Date()
        dueAdesao.setDate(dueAdesao.getDate() + 1)
        const adeResp = await fetch(`${base}/payments`, {
          method: 'POST', headers,
          body: JSON.stringify({
            customer:    asaasCustomerId,
            billingType: billingType || 'BOLETO',
            value:       Number(adesao),
            dueDate:     dueAdesao.toISOString().slice(0,10),
            description: `Taxa de Adesão — ${nomeEmpresa} — Plano ${plano}`,
            externalReference: `${empresaId}_adesao`,
          })
        })
        const adeJson = await adeResp.json()
        if (!adeResp.ok) erros.push('asaas_adesao: ' + JSON.stringify(adeJson.errors || adeJson))
      }

      // 3c. ASSINATURA MENSAL recorrente
      if (asaasCustomerId && Number(mensalidade) > 0) {
        const dueAssin = vencimento || (() => {
          const d = new Date(); d.setDate(d.getDate() + 30); return d.toISOString().slice(0,10)
        })()
        const subResp = await fetch(`${base}/subscriptions`, {
          method: 'POST', headers,
          body: JSON.stringify({
            customer:    asaasCustomerId,
            billingType: billingType || 'BOLETO',
            value:       Number(mensalidade),
            nextDueDate: dueAssin,
            cycle:       'MONTHLY',
            description: `Mensalidade Vivanexa — ${nomeEmpresa} — Plano ${plano}`,
            externalReference: `${empresaId}_mensal`,
          })
        })
        const subJson = await subResp.json()
        if (subResp.ok) {
          asaasSubId = subJson.id
        } else {
          erros.push('asaas_assinatura: ' + JSON.stringify(subJson.errors || subJson))
        }
      }
    } catch (e) {
      erros.push('asaas_exception: ' + e.message)
    }
  }

  // ══════════════════════════════════════════════════════
  // 4. SALVAR DADOS DO TENANT NO SUPABASE (vx_storage)
  //
  //    ISOLAMENTO: cada tenant tem duas chaves:
  //    • tenant:{empresaId}  → dados administrativos (só o master lê)
  //    • cfg:{empresaId}     → configurações (o próprio tenant lê via empresa_id)
  //
  //    O _app.js busca cfg:{session.user.empresa_id} para carregar as
  //    configurações do tenant logado. Como empresa_id = supabaseUserId,
  //    cada empresa SOMENTE lê a própria cfg.
  // ══════════════════════════════════════════════════════
  const tenantData = {
    id:             empresaId,
    empresaId,
    supabaseUserId,
    nomeEmpresa,
    cnpj:           cnpj || '',
    emailAdmin:     emailAdmin.trim().toLowerCase(),
    senhaInicial:   senha,   // armazenada para consulta no painel master
    telefone:       telefone || '',
    responsavel:    responsavel || '',
    vendedorId:     vendedorId || '',
    plano:          plano || 'basic',
    status:         status || 'trial',
    maxUsuarios:    Number(maxUsuarios) || 3,
    mensalidade:    Number(mensalidade) || 0,
    adesao:         Number(adesao) || 0,
    vencimento:     vencimento || '',
    modulosLiberados: modulosLiberados || [],
    obs:            obs || '',
    asaasCustomerId: asaasCustomerId || '',
    asaasSubId:     asaasSubId || '',
    pagamentoStatus:'pendente',
    criadoEm:       agora,
    atualizadoEm:   agora,
  }

  // Salva registro administrativo do tenant (apenas o master lê)
  const { error: tenantErr } = await supabaseAdmin.from('vx_storage').upsert({
    key:        `tenant:${empresaId}`,
    value:      JSON.stringify(tenantData),
    updated_at: agora,
  }, { onConflict: 'key' })

  if (tenantErr) erros.push('tenant_storage: ' + tenantErr.message)

  // Salva configurações que o próprio tenant lê ao logar
  const cfgData = {
    company:           nomeEmpresa,
    emailEmpresa:      emailAdmin.trim().toLowerCase(),
    empresaId,
    tenant_plano:      plano || 'basic',
    tenant_status:     status || 'trial',
    tenant_modulos:    modulosLiberados || [],
    tenant_maxUsuarios:Number(maxUsuarios) || 3,
    tenant_vencimento: vencimento || '',
    modulosAtivos:     modulosLiberados || [],
    // Config padrão vazia para o tenant preencher nas suas configurações
    smtpHost: '', smtpUser: '', smtpPass: '', smtpPort: '587',
    kpiRequired: false, kpiTemplates: [],
  }

  const { error: cfgErr } = await supabaseAdmin.from('vx_storage').upsert({
    key:        `cfg:${empresaId}`,
    value:      JSON.stringify(cfgData),
    updated_at: agora,
  }, { onConflict: 'key' })

  if (cfgErr) erros.push('cfg_storage: ' + cfgErr.message)

  // ══════════════════════════════════════════════════════
  // 5. E-MAIL DE BOAS-VINDAS COM CREDENCIAIS
  // ══════════════════════════════════════════════════════
  if (sendEmail && masterCfg?.smtpHost && masterCfg?.smtpUser) {
    try {
      const siteUrl    = masterCfg.siteUrl || 'https://vivanexa-saas.vercel.app'
      const nomePlano  = plano ? plano.charAt(0).toUpperCase() + plano.slice(1) : 'Basic'

      // Usa template customizado ou o padrão
      const htmlFinal = masterCfg.emailTemplates?.boasVindas
        ? masterCfg.emailTemplates.boasVindas
            .replace(/\{\{nomeEmpresa\}\}/g, nomeEmpresa)
            .replace(/\{\{responsavel\}\}/g, responsavel || nomeEmpresa)
            .replace(/\{\{email\}\}/g, emailAdmin)
            .replace(/\{\{senha\}\}/g, senha)
            .replace(/\{\{plano\}\}/g, nomePlano)
            .replace(/\{\{siteUrl\}\}/g, siteUrl)
            .replace(/\{\{mensalidade\}\}/g, 'R$ ' + Number(mensalidade||0).toLocaleString('pt-BR',{minimumFractionDigits:2}))
        : templateBoasVindas({ nomeEmpresa, responsavel, emailAdmin, senha, plano: nomePlano, siteUrl, mensalidade: Number(mensalidade||0) })

      await fetch(`${siteUrl}/api/send-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to:      emailAdmin,
          subject: `🎉 Bem-vindo(a) à Vivanexa — Seus dados de acesso`,
          html:    htmlFinal,
          config: {
            smtpHost:       masterCfg.smtpHost,
            smtpPort:       masterCfg.smtpPort || 587,
            smtpUser:       masterCfg.smtpUser,
            smtpPass:       masterCfg.smtpPass,
            emailApiKey:    masterCfg.emailApiKey,
            emailRemetente: masterCfg.smtpFrom || masterCfg.smtpUser,
            nomeRemetente:  'Vivanexa',
          }
        })
      })
    } catch (e) {
      erros.push('email: ' + e.message)
    }
  }

  // ══════════════════════════════════════════════════════
  // 6. RETORNO
  // ══════════════════════════════════════════════════════
  return res.status(200).json({
    success: true,
    empresaId,
    supabaseUserId,
    asaasCustomerId,
    asaasSubId,
    erros: erros.length > 0 ? erros : undefined,
    aviso: erros.length > 0 ? `Cliente criado com ${erros.length} aviso(s): ${erros.join(' | ')}` : undefined,
  })
}

// ══════════════════════════════════════════════════════
// TEMPLATE DE BOAS-VINDAS PADRÃO
// ══════════════════════════════════════════════════════
function templateBoasVindas({ nomeEmpresa, responsavel, emailAdmin, senha, plano, siteUrl, mensalidade }) {
  const fmt = n => 'R$ ' + Number(n||0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })
  return `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"/></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:Arial,sans-serif">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:32px 16px">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;max-width:600px;width:100%">

  <!-- Header -->
  <tr><td style="background:linear-gradient(135deg,#0d1526 0%,#1a2540 100%);padding:40px 40px 32px;text-align:center">
    <div style="font-size:36px;margin-bottom:12px">🚀</div>
    <h1 style="color:#00d4ff;font-size:26px;margin:0;font-weight:800;letter-spacing:-0.5px">Vivanexa</h1>
    <p style="color:#64748b;margin:8px 0 0;font-size:13px;letter-spacing:1px">PLATAFORMA DE GESTÃO COMERCIAL</p>
  </td></tr>

  <!-- Bem-vindo -->
  <tr><td style="padding:36px 40px 24px">
    <h2 style="color:#1a202c;font-size:20px;margin:0 0 16px;font-weight:700">
      🎉 Bem-vindo(a) à Vivanexa, ${responsavel || nomeEmpresa}!
    </h2>
    <p style="color:#475569;font-size:15px;line-height:1.7;margin:0 0 24px">
      Sua conta foi criada com sucesso! Abaixo estão seus dados de acesso ao sistema. Guarde este e-mail em local seguro.
    </p>

    <!-- Card de credenciais -->
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;border-radius:12px;border:1px solid #e2e8f0;margin-bottom:28px">
      <tr><td style="padding:24px">
        <p style="margin:0 0 16px;font-size:12px;color:#94a3b8;font-weight:700;letter-spacing:1px">SEUS DADOS DE ACESSO</p>
        <table width="100%" cellpadding="0" cellspacing="0">
          <tr>
            <td style="padding:8px 0;border-bottom:1px solid #e2e8f0">
              <span style="font-size:13px;color:#64748b">🌐 URL do sistema</span><br/>
              <a href="${siteUrl}" style="font-size:14px;color:#00d4ff;font-weight:700;text-decoration:none">${siteUrl}</a>
            </td>
          </tr>
          <tr>
            <td style="padding:8px 0;border-bottom:1px solid #e2e8f0">
              <span style="font-size:13px;color:#64748b">📧 Login (e-mail)</span><br/>
              <span style="font-size:15px;color:#1a202c;font-weight:700;font-family:monospace">${emailAdmin}</span>
            </td>
          </tr>
          <tr>
            <td style="padding:8px 0;border-bottom:1px solid #e2e8f0">
              <span style="font-size:13px;color:#64748b">🔑 Senha</span><br/>
              <span style="font-size:15px;color:#1a202c;font-weight:700;font-family:monospace;background:#fff;border:1px solid #e2e8f0;padding:4px 12px;border-radius:6px;display:inline-block;letter-spacing:1px">${senha}</span>
            </td>
          </tr>
          <tr>
            <td style="padding:8px 0">
              <span style="font-size:13px;color:#64748b">📦 Plano</span><br/>
              <span style="font-size:14px;color:#7c3aed;font-weight:700">${plano}${mensalidade>0?' — '+fmt(mensalidade)+'/mês':''}</span>
            </td>
          </tr>
        </table>
      </td></tr>
    </table>

    <!-- Botão CTA -->
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px">
      <tr><td align="center">
        <a href="${siteUrl}" style="display:inline-block;padding:16px 40px;background:linear-gradient(135deg,#00d4ff,#0099bb);color:#000;font-weight:800;font-size:15px;text-decoration:none;border-radius:10px;letter-spacing:0.3px">
          🔐 Acessar o Sistema
        </a>
      </td></tr>
    </table>

    <!-- Dica segurança -->
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#fff8f0;border-left:4px solid #f59e0b;border-radius:0 8px 8px 0;margin-bottom:24px">
      <tr><td style="padding:14px 18px">
        <p style="margin:0;font-size:13px;color:#92400e;line-height:1.6">
          <strong>⚠️ Recomendação de segurança:</strong> Altere sua senha após o primeiro acesso em <em>Configurações → Minha Conta</em>.
        </p>
      </td></tr>
    </table>

    <p style="color:#94a3b8;font-size:13px;line-height:1.6;margin:0">
      Em caso de dúvidas, responda este e-mail ou entre em contato com nosso suporte.<br/>
      Estamos felizes em tê-lo(a) conosco! 🙌
    </p>
  </td></tr>

  <!-- Footer -->
  <tr><td style="background:#f8fafc;padding:24px 40px;text-align:center;border-top:1px solid #e2e8f0">
    <p style="margin:0;font-size:12px;color:#94a3b8;line-height:1.7">
      <strong style="color:#64748b">Vivanexa SaaS</strong> · Plataforma de Gestão Comercial<br/>
      <a href="${siteUrl}" style="color:#00d4ff;text-decoration:none">${siteUrl}</a>
    </p>
  </td></tr>

</table>
</td></tr>
</table>
</body>
</html>`
}
