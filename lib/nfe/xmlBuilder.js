// lib/nfe/xmlBuilder.js
const { create } = require('xmlbuilder2');
const { formatMoney, gerarCNF, gerarChave, gerarIdNFe, obterCodigoUF } = require('./utils');

function buildNFeSaida(emitente, destinatario, produtos, dadosNota, tpAmb, ultimoNumeroNFe = 0) {
  const uf = emitente.uf;
  const anoMes = new Date().toISOString().slice(0, 7).replace('-', '');
  const cnpj = emitente.cnpj.replace(/\D/g, '');
  const modelo = '55';
  const serie = emitente.serie || '1';
  const nNF = (ultimoNumeroNFe + 1).toString().padStart(9, '0');
  const cNF = gerarCNF();
  const cUF = obterCodigoUF(uf).toString().padStart(2, '0');
  const chave = gerarChave(cUF, anoMes, cnpj, modelo, serie, nNF, cNF);
  const id = gerarIdNFe(chave);
  const dhEmi = new Date().toISOString().replace(/\.\d+Z$/, '-03:00');
  const dataHoraSaiEnt = dadosNota.dataSaida
    ? `${dadosNota.dataSaida}T${dadosNota.horaSaida || '12:00:00'}-03:00`
    : dhEmi;

  const doc = create({ version: '1.0', encoding: 'UTF-8' })
    .ele('NFe', { xmlns: 'http://www.portalfiscal.inf.br/nfe' });

  const infNFe = doc.ele('infNFe', { versao: '4.00', Id: id });

  // IDE
  const ide = infNFe.ele('ide');
  ide.ele('cUF').txt(cUF);
  ide.ele('cNF').txt(cNF);
  ide.ele('natOp').txt(dadosNota.naturezaOperacao || 'VENDA DE MERCADORIA');
  ide.ele('mod').txt(modelo);
  ide.ele('serie').txt(serie);
  ide.ele('nNF').txt(nNF);
  ide.ele('dhEmi').txt(dhEmi);
  if (dadosNota.tipoOperacao === '1') ide.ele('dhSaiEnt').txt(dataHoraSaiEnt);
  ide.ele('tpNF').txt(dadosNota.tipoOperacao || '1');
  ide.ele('idDest').txt(emitente.uf === destinatario.uf ? '1' : '2');
  ide.ele('cMunFG').txt(emitente.codigoMunicipio || '3550308');
  ide.ele('tpImp').txt('1');
  ide.ele('tpEmis').txt('1');
  ide.ele('cDV').txt(chave.slice(-1));
  ide.ele('tpAmb').txt(tpAmb);
  ide.ele('finNFe').txt('1');
  ide.ele('indFinal').txt('1');
  ide.ele('indPres').txt('1');
  ide.ele('procEmi').txt('0');
  ide.ele('verProc').txt('1.0.0');

  // EMITENTE
  const emit = infNFe.ele('emit');
  emit.ele('CNPJ').txt(cnpj);
  emit.ele('xNome').txt(emitente.razaoSocial || emitente.razao);
  emit.ele('xFant').txt(emitente.nomeFantasia || emitente.razaoSocial || emitente.razao);
  const enderEmit = emit.ele('enderEmit');
  enderEmit.ele('xLgr').txt(emitente.logradouro || '');
  enderEmit.ele('nro').txt(emitente.numero || 'S/N');
  if (emitente.complemento) enderEmit.ele('xCpl').txt(emitente.complemento);
  enderEmit.ele('xBairro').txt(emitente.bairro || '');
  enderEmit.ele('cMun').txt(emitente.codigoMunicipio || '3550308');
  enderEmit.ele('xMun').txt(emitente.municipio || '');
  enderEmit.ele('UF').txt(uf);
  enderEmit.ele('CEP').txt((emitente.cep || '').replace(/\D/g, ''));
  enderEmit.ele('cPais').txt('1058');
  enderEmit.ele('xPais').txt('BRASIL');
  if (emitente.telefone) enderEmit.ele('fone').txt(emitente.telefone.replace(/\D/g, ''));
  emit.ele('IE').txt(emitente.ie || '');
  emit.ele('CRT').txt('1');

  // DESTINATÁRIO
  const dest = infNFe.ele('dest');
  const cnpjDest = (destinatario.cnpj || '').replace(/\D/g, '');
  const cpfDest = (destinatario.cpf || '').replace(/\D/g, '');
  if (cnpjDest.length === 14) dest.ele('CNPJ').txt(cnpjDest);
  else if (cpfDest.length === 11) dest.ele('CPF').txt(cpfDest);
  else throw new Error('Destinatário deve ter CNPJ ou CPF válido');
  dest.ele('xNome').txt(destinatario.nome || destinatario.razao);
  const enderDest = dest.ele('enderDest');
  enderDest.ele('xLgr').txt(destinatario.logradouro || '');
  enderDest.ele('nro').txt(destinatario.numero || 'S/N');
  if (destinatario.complemento) enderDest.ele('xCpl').txt(destinatario.complemento);
  enderDest.ele('xBairro').txt(destinatario.bairro || '');
  enderDest.ele('cMun').txt(destinatario.codigoMunicipio || '3550308');
  enderDest.ele('xMun').txt(destinatario.municipio || '');
  enderDest.ele('UF').txt(destinatario.uf || '');
  enderDest.ele('CEP').txt((destinatario.cep || '').replace(/\D/g, ''));
  enderDest.ele('cPais').txt('1058');
  enderDest.ele('xPais').txt('BRASIL');
  if (destinatario.telefone) enderDest.ele('fone').txt(destinatario.telefone.replace(/\D/g, ''));
  dest.ele('indIEDest').txt(destinatario.isento ? '2' : '9');
  if (!destinatario.isento && destinatario.ie) dest.ele('IE').txt(destinatario.ie);

  // PRODUTOS
  let valorTotalProd = 0;
  produtos.forEach((prod, index) => {
    const vlProd = Number(prod.quantidade) * Number(prod.valorUnitario);
    valorTotalProd += vlProd;
    const det = infNFe.ele('det', { nItem: (index + 1).toString() });
    const prodEl = det.ele('prod');
    prodEl.ele('cProd').txt(prod.codigoProduto || String(index + 1).padStart(6, '0'));
    prodEl.ele('cEAN').txt(prod.codigoBarras || 'SEM GTIN');
    prodEl.ele('xProd').txt(prod.descricao);
    prodEl.ele('NCM').txt((prod.ncm || '00000000').replace(/\D/g, ''));
    prodEl.ele('CFOP').txt(prod.cfop || '5102');
    prodEl.ele('uCom').txt(prod.unidade || 'UN');
    prodEl.ele('qCom').txt(formatMoney(prod.quantidade));
    prodEl.ele('vUnCom').txt(formatMoney(prod.valorUnitario));
    prodEl.ele('vProd').txt(formatMoney(vlProd));
    if (prod.desconto) prodEl.ele('vDesc').txt(formatMoney(prod.desconto));
    prodEl.ele('cEANTrib').txt(prod.codigoBarras || 'SEM GTIN');
    prodEl.ele('uTrib').txt(prod.unidade || 'UN');
    prodEl.ele('qTrib').txt(formatMoney(prod.quantidade));
    prodEl.ele('vUnTrib').txt(formatMoney(prod.valorUnitario));
    prodEl.ele('indTot').txt('1');

    const imposto = det.ele('imposto');
    const icms = imposto.ele('ICMS');
    const icmsSn = icms.ele('ICMSSN400');
    icmsSn.ele('orig').txt('0');
    icmsSn.ele('CSOSN').txt(prod.csosn || '400');

    const pis = imposto.ele('PIS');
    const pisOutr = pis.ele('PISOutr');
    pisOutr.ele('CST').txt('49');
    pisOutr.ele('vBC').txt('0.00');
    pisOutr.ele('pPIS').txt('0.00');
    pisOutr.ele('vPIS').txt('0.00');

    const cofins = imposto.ele('COFINS');
    const cofinsOutr = cofins.ele('COFINSOutr');
    cofinsOutr.ele('CST').txt('49');
    cofinsOutr.ele('vBC').txt('0.00');
    cofinsOutr.ele('pCOFINS').txt('0.00');
    cofinsOutr.ele('vCOFINS').txt('0.00');
  });

  // TOTAIS
  const total = infNFe.ele('total');
  const icmsTot = total.ele('ICMSTot');
  icmsTot.ele('vBC').txt('0.00');
  icmsTot.ele('vICMS').txt('0.00');
  icmsTot.ele('vICMSDeson').txt('0.00');
  icmsTot.ele('vFCP').txt('0.00');
  icmsTot.ele('vBCST').txt('0.00');
  icmsTot.ele('vST').txt('0.00');
  icmsTot.ele('vFCPST').txt('0.00');
  icmsTot.ele('vFCPSTRet').txt('0.00');
  icmsTot.ele('vProd').txt(formatMoney(valorTotalProd));
  icmsTot.ele('vFrete').txt('0.00');
  icmsTot.ele('vSeg').txt('0.00');
  icmsTot.ele('vDesc').txt('0.00');
  icmsTot.ele('vII').txt('0.00');
  icmsTot.ele('vIPI').txt('0.00');
  icmsTot.ele('vIPIDevol').txt('0.00');
  icmsTot.ele('vPIS').txt('0.00');
  icmsTot.ele('vCOFINS').txt('0.00');
  icmsTot.ele('vOutro').txt('0.00');
  icmsTot.ele('vNF').txt(formatMoney(valorTotalProd));
  icmsTot.ele('vTotTrib').txt('0.00');

  // TRANSPORTE
  const transp = infNFe.ele('transp');
  transp.ele('modFrete').txt('9');

  // PAGAMENTO
  const pag = infNFe.ele('pag');
  const detPag = pag.ele('detPag');
  detPag.ele('tPag').txt(dadosNota.formaPagamento || '01');
  detPag.ele('vPag').txt(formatMoney(valorTotalProd));

  // INFO ADICIONAIS
  if (dadosNota.infAdFisco || dadosNota.infCpl) {
    const infAdic = infNFe.ele('infAdic');
    if (dadosNota.infAdFisco) infAdic.ele('infAdFisco').txt(dadosNota.infAdFisco);
    if (dadosNota.infCpl) infAdic.ele('infCpl').txt(dadosNota.infCpl);
  }

  const xml = doc.end({ prettyPrint: true });
  return { xml, chave, numero: nNF };
}

function buildNFCe(emitente, destinatario, produtos, dadosNota, tpAmb, ultimoNumeroNFCe = 0) {
  const uf = emitente.uf;
  const anoMes = new Date().toISOString().slice(0, 7).replace('-', '');
  const cnpj = emitente.cnpj.replace(/\D/g, '');
  const modelo = '65';
  const serie = emitente.serie || '1';
  const nNF = (ultimoNumeroNFCe + 1).toString().padStart(9, '0');
  const cNF = gerarCNF();
  const cUF = obterCodigoUF(uf).toString().padStart(2, '0');
  const chave = gerarChave(cUF, anoMes, cnpj, modelo, serie, nNF, cNF);
  const id = gerarIdNFe(chave);
  const dhEmi = new Date().toISOString().replace(/\.\d+Z$/, '-03:00');

  const doc = create({ version: '1.0', encoding: 'UTF-8' })
    .ele('NFe', { xmlns: 'http://www.portalfiscal.inf.br/nfe' });

  const infNFe = doc.ele('infNFe', { versao: '4.00', Id: id });

  const ide = infNFe.ele('ide');
  ide.ele('cUF').txt(cUF);
  ide.ele('cNF').txt(cNF);
  ide.ele('natOp').txt(dadosNota.naturezaOperacao || 'VENDA DE MERCADORIA');
  ide.ele('mod').txt(modelo);
  ide.ele('serie').txt(serie);
  ide.ele('nNF').txt(nNF);
  ide.ele('dhEmi').txt(dhEmi);
  ide.ele('tpNF').txt('1');
  ide.ele('idDest').txt('1');
  ide.ele('cMunFG').txt(emitente.codigoMunicipio || '3550308');
  ide.ele('tpImp').txt('4');
  ide.ele('tpEmis').txt('1');
  ide.ele('cDV').txt(chave.slice(-1));
  ide.ele('tpAmb').txt(tpAmb);
  ide.ele('finNFe').txt('1');
  ide.ele('indFinal').txt('1');
  ide.ele('indPres').txt('1');
  ide.ele('procEmi').txt('0');
  ide.ele('verProc').txt('1.0.0');

  const emit = infNFe.ele('emit');
  emit.ele('CNPJ').txt(cnpj);
  emit.ele('xNome').txt(emitente.razaoSocial || emitente.razao);
  emit.ele('xFant').txt(emitente.nomeFantasia || emitente.razaoSocial || emitente.razao);
  const enderEmit = emit.ele('enderEmit');
  enderEmit.ele('xLgr').txt(emitente.logradouro || '');
  enderEmit.ele('nro').txt(emitente.numero || 'S/N');
  if (emitente.complemento) enderEmit.ele('xCpl').txt(emitente.complemento);
  enderEmit.ele('xBairro').txt(emitente.bairro || '');
  enderEmit.ele('cMun').txt(emitente.codigoMunicipio || '3550308');
  enderEmit.ele('xMun').txt(emitente.municipio || '');
  enderEmit.ele('UF').txt(uf);
  enderEmit.ele('CEP').txt((emitente.cep || '').replace(/\D/g, ''));
  enderEmit.ele('cPais').txt('1058');
  enderEmit.ele('xPais').txt('BRASIL');
  if (emitente.telefone) enderEmit.ele('fone').txt(emitente.telefone.replace(/\D/g, ''));
  emit.ele('IE').txt(emitente.ie || '');
  emit.ele('CRT').txt('1');

  if (destinatario && (destinatario.cpf || destinatario.cnpj)) {
    const dest = infNFe.ele('dest');
    const cnpjDest = (destinatario.cnpj || '').replace(/\D/g, '');
    const cpfDest = (destinatario.cpf || '').replace(/\D/g, '');
    if (cnpjDest.length === 14) dest.ele('CNPJ').txt(cnpjDest);
    else if (cpfDest.length === 11) dest.ele('CPF').txt(cpfDest);
    dest.ele('xNome').txt(destinatario.nome || destinatario.razao || 'CONSUMIDOR NAO IDENTIFICADO');
    dest.ele('indIEDest').txt('9');
  }

  let valorTotalProd = 0;
  produtos.forEach((prod, index) => {
    const vlProd = Number(prod.quantidade) * Number(prod.valorUnitario);
    valorTotalProd += vlProd;
    const det = infNFe.ele('det', { nItem: (index + 1).toString() });
    const prodEl = det.ele('prod');
    prodEl.ele('cProd').txt(prod.codigoProduto || String(index + 1).padStart(6, '0'));
    prodEl.ele('cEAN').txt(prod.codigoBarras || 'SEM GTIN');
    prodEl.ele('xProd').txt(prod.descricao);
    prodEl.ele('NCM').txt((prod.ncm || '00000000').replace(/\D/g, ''));
    prodEl.ele('CFOP').txt(prod.cfop || '5102');
    prodEl.ele('uCom').txt(prod.unidade || 'UN');
    prodEl.ele('qCom').txt(formatMoney(prod.quantidade));
    prodEl.ele('vUnCom').txt(formatMoney(prod.valorUnitario));
    prodEl.ele('vProd').txt(formatMoney(vlProd));
    prodEl.ele('cEANTrib').txt(prod.codigoBarras || 'SEM GTIN');
    prodEl.ele('uTrib').txt(prod.unidade || 'UN');
    prodEl.ele('qTrib').txt(formatMoney(prod.quantidade));
    prodEl.ele('vUnTrib').txt(formatMoney(prod.valorUnitario));
    prodEl.ele('indTot').txt('1');

    const imposto = det.ele('imposto');
    const icms = imposto.ele('ICMS');
    const icmsSn = icms.ele('ICMSSN400');
    icmsSn.ele('orig').txt('0');
    icmsSn.ele('CSOSN').txt(prod.csosn || '400');
  });

  const total = infNFe.ele('total');
  const icmsTot = total.ele('ICMSTot');
  icmsTot.ele('vBC').txt('0.00');
  icmsTot.ele('vICMS').txt('0.00');
  icmsTot.ele('vICMSDeson').txt('0.00');
  icmsTot.ele('vFCP').txt('0.00');
  icmsTot.ele('vBCST').txt('0.00');
  icmsTot.ele('vST').txt('0.00');
  icmsTot.ele('vFCPST').txt('0.00');
  icmsTot.ele('vFCPSTRet').txt('0.00');
  icmsTot.ele('vProd').txt(formatMoney(valorTotalProd));
  icmsTot.ele('vFrete').txt('0.00');
  icmsTot.ele('vSeg').txt('0.00');
  icmsTot.ele('vDesc').txt('0.00');
  icmsTot.ele('vII').txt('0.00');
  icmsTot.ele('vIPI').txt('0.00');
  icmsTot.ele('vIPIDevol').txt('0.00');
  icmsTot.ele('vPIS').txt('0.00');
  icmsTot.ele('vCOFINS').txt('0.00');
  icmsTot.ele('vOutro').txt('0.00');
  icmsTot.ele('vNF').txt(formatMoney(valorTotalProd));
  icmsTot.ele('vTotTrib').txt('0.00');

  const transp = infNFe.ele('transp');
  transp.ele('modFrete').txt('9');

  const pag = infNFe.ele('pag');
  const detPag = pag.ele('detPag');
  detPag.ele('tPag').txt(dadosNota.formaPagamento || '01');
  detPag.ele('vPag').txt(formatMoney(valorTotalProd));

  const xml = doc.end({ prettyPrint: true });
  return { xml, chave, numero: nNF };
}

module.exports = { buildNFeSaida, buildNFCe };
