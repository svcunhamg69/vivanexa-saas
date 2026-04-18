function buildContract(S, cfg, user, tAd, tMen, dateAd, dateMen, payMethod, token, signedData) {
  const template = cfg.contratoTemplate || cfg.docTemplates?.contrato || ''
  const isDocx = _isDocxStr(template)
  
  const cd = S.clientData || {}
  const co = S.contactData || {}
  const today = new Date().toLocaleDateString('pt-BR')
  const now = new Date().toLocaleString('pt-BR')
  const isC = S.closingToday === true
  const results = isC ? S.closingData?.results : S.quoteData?.results
  const plans = cfg.plans?.length ? cfg.plans : DEFAULT_CFG.plans
  const planLabel = S.plan ? (getPlanLabel(S.plan, plans) || S.plan) : '—'
  const payLabel = payMethod === 'pix' ? 'PIX / Boleto à vista'
    : payMethod?.startsWith('cartao') ? `Cartão em até ${payMethod.replace('cartao','').replace('x','×')} sem juros`
    : payMethod?.startsWith('boleto') ? `Boleto ${payMethod.replace('boleto','').replace('x','×')}×`
    : payMethod || '—'
  
  const produtosVertical = (results || []).map(r => {
    const adS = r.isTributos || r.isEP ? '—' : fmt(isC ? r.ad : r.adD || 0)
    const menS = fmt(isC ? r.men : r.menD || r.men || 0)
    const planoNome = r.plan ? (getPlanLabel(r.plan, plans) || r.plan) : ''
    return `<div style="border:1px solid #e2e8f0;border-radius:8px;padding:12px;margin-bottom:12px">
      <div style="font-weight:600;margin-bottom:6px">${r.name}${planoNome ? `<span style="font-size:11px;color:#64748b;margin-left:6px">(Plano ${planoNome})</span>` : ''}</div>
      <div style="display:flex;justify-content:space-between;font-size:13px;margin-top:6px"><span>Adesão:</span><span style="font-weight:600">${adS}</span></div>
      <div style="display:flex;justify-content:space-between;font-size:13px;margin-top:4px"><span>Mensalidade:</span><span style="font-weight:600;color:#00d4ff">${menS}</span></div>
      <div style="font-size:11px;color:#64748b;margin-top:6px">CNPJs: ${S.cnpjs || '—'}</div>
    </div>`
  }).join('')
  
  const endStr = [co.logradouro || cd.logradouro, co.bairro || cd.bairro, co.cidade || cd.municipio, co.uf || cd.uf].filter(Boolean).join(', ')
  const docId = token || generateToken()
  
  const manifesto = `<div style="margin-top:40px;border:2px solid #10b981;border-radius:12px;padding:24px;background:#f0fdf4">
    <div style="display:flex;align-items:center;gap:12px;margin-bottom:20px">
      <div style="font-size:24px">✅</div>
      <div><div style="font-family:Syne,sans-serif;font-size:16px;font-weight:800;color:#065f46">MANIFESTO DE ASSINATURAS ELETRÔNICAS</div>
      <div style="font-size:11px;color:#10b981;font-weight:600;letter-spacing:1px;text-transform:uppercase;margin-top:2px">DOCUMENTO VÁLIDO</div></div>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">
      <div style="border:1px solid #6ee7b7;border-radius:8px;padding:16px;background:#fff">
        <div style="font-size:10px;color:#10b981;letter-spacing:1.5px;text-transform:uppercase;font-weight:700;margin-bottom:10px">✅ ASSINATURA DO CONTRATANTE</div>
        <div style="font-size:12px;color:#374151;margin-bottom:4px"><strong>Assinado por:</strong> <span id="manifest-client-name">${signedData?.signedBy || co.contato || cd.fantasia || cd.nome || 'Aguardando'}</span></div>
        <div style="font-size:12px;color:#374151;margin-bottom:4px"><strong>CPF:</strong> <span id="manifest-client-cpf">${signedData?.signCPF || co.cpfContato || '—'}</span></div>
        <div style="font-size:12px;color:#374151;margin-bottom:4px"><strong>E-mail:</strong> <span id="manifest-client-email">${signedData?.clientEmail || co.email || cd.email || '—'}</span></div>
        <div style="font-size:12px;color:#374151;margin-bottom:4px"><strong>Data/Hora:</strong> <span id="manifest-client-date">${signedData?.signedAt || 'Aguardando assinatura'}</span></div>
        <div style="font-size:11px;color:#6b7280;margin-top:6px;padding-top:6px;border-top:1px solid #d1fae5"><strong>Token:</strong> ${docId}</div>
      </div>
      <div style="border:1px solid #6ee7b7;border-radius:8px;padding:16px;background:#fff">
        <div style="font-size:10px;color:#10b981;letter-spacing:1.5px;text-transform:uppercase;font-weight:700;margin-bottom:10px">✅ ASSINATURA DA CONTRATADA</div>
        <div style="font-size:12px;color:#374151;margin-bottom:4px"><strong>Assinado por:</strong> <span id="manifest-consult-name">${signedData?.consultantSignedBy || user?.nome || '—'}</span></div>
        <div style="font-size:12px;color:#374151;margin-bottom:4px"><strong>Data/Hora:</strong> <span id="manifest-consult-date">${signedData?.consultantSignedAt || 'Aguardando assinatura'}</span></div>
        <div style="font-size:12px;color:#374151;margin-bottom:4px"><strong>E-mail:</strong> <span id="manifest-consult-email">${signedData?.consultantEmail || user?.email || '—'}</span></div>
      </div>
    </div>
    <div style="margin-top:16px;font-size:11px;color:#6b7280;line-height:1.6">
      Assinaturas eletrônicas simples conforme <strong>Lei nº 14.063/2020</strong> e MP 2.200-2/2001.<br>
      Documento: <strong>doc_${docId}</strong>
    </div>
  </div>`
  
  const vars = {
    '{{empresa}}': co.empresa || cd.fantasia || cd.nome || '',
    '{{razao}}': co.razao || cd.nome || '',
    '{{cnpj}}': fmtDoc(S.doc || ''),
    '{{contato}}': co.contato || '',
    '{{email}}': co.email || cd.email || '',
    '{{telefone}}': co.telefone || cd.telefone || '',
    '{{endereco}}': endStr,
    '{{regime}}': co.regime || '',
    '{{plano}}': planLabel,
    '{{cnpjs_qty}}': String(S.cnpjs || '0'),
    '{{total_adesao}}': fmt(tAd),
    '{{total_mensalidade}}': fmt(tMen),
    '{{total_mensal}}': fmt(tMen),
    '{{condicao_pagamento}}': payLabel,
    '{{vencimento_adesao}}': dateAd || '—',
    '{{vencimento_mensal}}': dateMen || '—',
    '{{data_hora}}': now,
    '{{data_hoje}}': today,
    '{{consultor_nome}}': user?.nome || '',
    '{{consultor_tel}}': user?.perfil?.telefone || user?.telefone || '',
    '{{company}}': cfg.company || '',
    '{{logo}}': cfg.logob64 ? `<img src="${cfg.logob64}" style="height:52px;object-fit:contain;margin-bottom:10px;display:block">` : '',
    '{{produtos_tabela}}': `<div style="margin:16px 0">${produtosVertical}</div>`,
    '{{produtos_lista}}': `<div style="margin:16px 0">${produtosVertical}</div>`,
    '{{nome_financeiro}}': co.rfinNome || '',
    '{{email_financeiro}}': co.rfinEmail || '',
    '{{telefone_financeiro}}': co.rfinTel || '',
    '{{nome_implementacao}}': co.rimpNome || '',
    '{{email_implementacao}}': co.rimpEmail || '',
    '{{telefone_implementacao}}': co.rimpTel || '',
    '{{cpf_contato}}': co.cpfContato || '',
    '{{rimp_nome}}': co.rimpNome || '',
    '{{rimp_email}}': co.rimpEmail || '',
    '{{rimp_tel}}': co.rimpTel || '',
    '{{rfin_nome}}': co.rfinNome || '',
    '{{rfin_email}}': co.rfinEmail || '',
    '{{rfin_tel}}': co.rfinTel || '',
  }
  
  if (!isDocx && template) {
    let out = template
    for (const [k, v] of Object.entries(vars)) out = out.replace(new RegExp(k.replace(/[{}]/g, '\\$&'), 'g'), v)
    if (!out.includes('MANIFESTO DE ASSINATURAS')) out += manifesto
    return `<div style="background:#fff;font-family:Inter,sans-serif;color:#1e293b;max-width:820px;margin:0 auto;font-size:13px;line-height:1.7">${out}</div>`
  }
  
  // Fallback HTML
  return `<div style="background:#fff;font-family:Inter,sans-serif;color:#1e293b;max-width:820px;margin:0 auto;padding:24px">
    <h2 style="color:#0f172a;margin-bottom:12px">📝 Contrato</h2>
    <div><strong>Empresa:</strong> ${vars['{{empresa}}']}</div>
    <div><strong>CNPJ:</strong> ${vars['{{cnpj}}']}</div>
    <div><strong>Contato:</strong> ${vars['{{contato}}']}</div>
    <div><strong>E-mail:</strong> ${vars['{{email}}']}</div>
    <div><strong>Telefone:</strong> ${vars['{{telefone}}']}</div>
    <hr/>
    <div><strong>Plano:</strong> ${vars['{{plano}}']}</div>
    <div><strong>CNPJs:</strong> ${vars['{{cnpjs_qty}}']}</div>
    <hr/>
    <div><strong>Produtos:</strong></div>
    ${vars['{{produtos_tabela}}']}
    <hr/>
    <div><strong>Total Adesão:</strong> ${vars['{{total_adesao}}']}</div>
    <div><strong>Total Mensalidade:</strong> ${vars['{{total_mensalidade}}']}</div>
    <hr/>
    <div><strong>Condição de Pagamento:</strong> ${vars['{{condicao_pagamento}}']}</div>
    <div><strong>Vencimento Adesão:</strong> ${vars['{{vencimento_adesao}}']}</div>
    <div><strong>1ª Mensalidade:</strong> ${vars['{{vencimento_mensal}}']}</div>
    <hr/>
    <div><strong>Consultor:</strong> ${vars['{{consultor_nome}}']}</div>
    <div><strong>Data:</strong> ${vars['{{data_hoje}}']}</div>
    ${manifesto}
    <p style="margin-top:20px;font-size:12px;color:#64748b">Documento gerado automaticamente pelo sistema Vivanexa.</p>
  </div>`
}
