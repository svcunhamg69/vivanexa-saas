// lib/docxTemplate.js
// ══════════════════════════════════════════════════════════════════
// Geração de DOCX com substituição de variáveis usando docxtemplater
// ══════════════════════════════════════════════════════════════════
//
// DEPENDÊNCIAS (adicionar ao package.json):
//   "docxtemplater": "^3.49.0",
//   "pizzip": "^3.1.7"
//
// Instale: npm install docxtemplater pizzip
//
// USO (no browser via Next.js dynamic import):
//   const { gerarDocxPreenchido, downloadDocx } = await import('../lib/docxTemplate')
//   const blob = await gerarDocxPreenchido(templateBase64, variaveis)
//   downloadDocx(blob, 'contrato_cliente.docx')
//
// ══════════════════════════════════════════════════════════════════

/**
 * Gera um arquivo DOCX com variáveis substituídas.
 *
 * @param {string} templateBase64 - O template DOCX em formato data-URL base64
 *   (ex: "data:application/.../base64,AAAA...") ou base64 puro
 * @param {Object} variaveis - Mapa de variáveis: { empresa: "Acme", total_adesao: "R$ 500,00", ... }
 * @returns {Promise<Blob>} - Blob do DOCX preenchido
 */
export async function gerarDocxPreenchido(templateBase64, variaveis) {
  // Lazy-load apenas no browser (não no servidor)
  const PizZip     = (await import('pizzip')).default
  const Docxtemplater = (await import('docxtemplater')).default

  // Converter base64 → ArrayBuffer
  let base64 = templateBase64
  if (base64.includes(',')) {
    // Remove o prefixo "data:...;base64,"
    base64 = base64.split(',')[1]
  }

  const binaryStr = atob(base64)
  const bytes = new Uint8Array(binaryStr.length)
  for (let i = 0; i < binaryStr.length; i++) {
    bytes[i] = binaryStr.charCodeAt(i)
  }

  const zip = new PizZip(bytes.buffer)

  const doc = new Docxtemplater(zip, {
    // paragraphLoop: true permite loops de parágrafos (para tabelas dinâmicas)
    paragraphLoop: true,
    // Não lança erro para variáveis ausentes — deixa o placeholder vazio
    nullGetter: () => '',
  })

  // Substitui todas as variáveis
  doc.render(variaveis)

  // Gera o arquivo de saída
  const outputZip = doc.getZip()
  const blob = outputZip.generate({
    type: 'blob',
    mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    compression: 'DEFLATE',
  })

  return blob
}

/**
 * Dispara o download do DOCX no browser.
 *
 * @param {Blob} blob - O Blob gerado por gerarDocxPreenchido()
 * @param {string} nomeArquivo - Nome do arquivo (ex: "contrato_cliente.docx")
 */
export function downloadDocx(blob, nomeArquivo = 'documento.docx') {
  const url = URL.createObjectURL(blob)
  const a   = document.createElement('a')
  a.href     = url
  a.download = nomeArquivo
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

/**
 * Substitui variáveis num string HTML/texto simples.
 * Usado quando o template é HTML (não DOCX).
 *
 * @param {string} template - String HTML com {{variavel}} placeholders
 * @param {Object} variaveis - Mapa de variáveis
 * @returns {string} - HTML com variáveis substituídas
 */
export function substituirVariaveisHtml(template, variaveis) {
  let resultado = template
  for (const [chave, valor] of Object.entries(variaveis)) {
    // Substitui todas as ocorrências de {{chave}}
    const regex = new RegExp(`\\{\\{${chave}\\}\\}`, 'g')
    resultado = resultado.replace(regex, valor ?? '')
  }
  return resultado
}

/**
 * Constrói o objeto de variáveis a partir dos dados disponíveis.
 * Chamada no momento de gerar proposta/contrato.
 *
 * @param {Object} params
 * @returns {Object} variaveis
 */
export function buildVariaveis({
  clientData = {},
  cfgData    = {},
  quoteData  = {},
  consultorNome = '',
  condicaoPagamento = '',
  vencimentoAdesao  = '',
  vencimentoMensal  = '',
  produtosTabela    = '',
  produtosLista     = '',
}) {
  const fmt = (n) =>
    typeof n === 'number'
      ? 'R$ ' + n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
      : (n || '—')

  return {
    // Dados do cliente
    empresa:    clientData.empresa    || clientData.fantasia || '—',
    razao:      clientData.razao      || '—',
    cnpj:       clientData.cnpj       || clientData.doc      || '—',
    contato:    clientData.contato    || '—',
    email:      clientData.email      || '—',
    telefone:   clientData.telefone   || '—',
    endereco:   clientData.endereco   || '—',
    regime:     clientData.regime     || '—',

    // Dados financeiros
    plano:               quoteData.planLabel          || '—',
    cnpjs_qty:           String(quoteData.cnpjs       || '—'),
    total_adesao:        fmt(quoteData.tAd            || 0),
    total_mensal:        fmt(quoteData.tMen           || 0),
    condicao_pagamento:  condicaoPagamento             || '—',
    vencimento_adesao:   vencimentoAdesao              || '—',
    vencimento_mensal:   vencimentoMensal              || '—',

    // Dados da empresa contratada
    company:          cfgData.company          || '—',
    razao_empresa:    cfgData.razaoEmpresa      || cfgData.razao_empresa || '—',
    cnpj_empresa:     cfgData.cnpjEmpresa       || cfgData.cnpj_empresa  || '—',
    responsavel:      cfgData.responsavel       || '—',
    telefone_empresa: cfgData.telefone          || cfgData.telefoneEmpresa || '—',
    email_empresa:    cfgData.emailEmpresa      || cfgData.email_empresa  || '—',
    endereco_empresa: cfgData.enderecoEmpresa   || cfgData.endereco_empresa || '—',

    // Consultor, data, logo
    consultor_nome:  consultorNome || '—',
    data_hora:       new Date().toLocaleString('pt-BR'),
    logo:            cfgData.logob64 || '',

    // Produtos (já formatados como HTML/texto pelo chamador)
    produtos_tabela: produtosTabela || '—',
    produtos_lista:  produtosLista  || '—',
  }
}
