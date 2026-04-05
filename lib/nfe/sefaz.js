// lib/nfe/sefaz.js

// URLs por UF e ambiente para NF-e (modelo 55)
const URLS_NFE = {
  homologacao: {
    envio: 'https://homologacao.nfe.fazenda.gov.br/NFeAutorizacao4/NFeAutorizacao4.asmx',
    retorno: 'https://homologacao.nfe.fazenda.gov.br/NFeRetAutorizacao4/NFeRetAutorizacao4.asmx',
    cancelamento: 'https://homologacao.nfe.fazenda.gov.br/NFeRecepcaoEvento4/NFeRecepcaoEvento4.asmx',
  },
  producao: {
    envio: 'https://nfe.fazenda.gov.br/NFeAutorizacao4/NFeAutorizacao4.asmx',
    retorno: 'https://nfe.fazenda.gov.br/NFeRetAutorizacao4/NFeRetAutorizacao4.asmx',
    cancelamento: 'https://nfe.fazenda.gov.br/NFeRecepcaoEvento4/NFeRecepcaoEvento4.asmx',
  },
};

// URLs por UF e ambiente para NFC-e (modelo 65) — cada estado tem URL própria
const URLS_NFCE_HOMOLOGACAO = {
  MG: 'https://hnfe.fazenda.mg.gov.br/nfe2/services/NFeAutorizacao4',
  SP: 'https://homologacao.nfce.fazenda.sp.gov.br/ws/NFeAutorizacao4.asmx',
  RJ: 'https://nfce.fazenda.rj.gov.br/NFeAutorizacao4/NFeAutorizacao4.asmx',
  RS: 'https://nfce-homologacao.sefazrs.rs.gov.br/ws/NfeAutorizacao/NFeAutorizacao4.asmx',
  PR: 'https://homologacao.nfce.sefa.pr.gov.br/nfce/NFeAutorizacao4',
  default: 'https://homologacao.nfe.fazenda.gov.br/NFeAutorizacao4/NFeAutorizacao4.asmx',
};

function getUrl(tpAmb, uf, modelo) {
  const ambiente = tpAmb === '1' ? 'producao' : 'homologacao';
  if (modelo === '65') {
    if (tpAmb === '2') return URLS_NFCE_HOMOLOGACAO[uf] || URLS_NFCE_HOMOLOGACAO.default;
    return URLS_NFCE_HOMOLOGACAO[uf] || URLS_NFCE_HOMOLOGACAO.default;
  }
  return URLS_NFE[ambiente].envio;
}

function getRetornoUrl(tpAmb, modelo) {
  const ambiente = tpAmb === '1' ? 'producao' : 'homologacao';
  return URLS_NFE[ambiente].retorno;
}

function getCancelUrl(tpAmb) {
  const ambiente = tpAmb === '1' ? 'producao' : 'homologacao';
  return URLS_NFE[ambiente].cancelamento;
}

async function enviarLote(xmlAssinado, tpAmb, uf = 'SP', modelo = '55') {
  const url = getUrl(tpAmb, uf, modelo);

  // Monta lote NF-e
  const idLote = Date.now().toString().slice(0, 15);
  const xmlLote = `<?xml version="1.0" encoding="UTF-8"?>
<enviNFe versao="4.00" xmlns="http://www.portalfiscal.inf.br/nfe">
  <idLote>${idLote}</idLote>
  <indSinc>1</indSinc>
  ${xmlAssinado}
</enviNFe>`;

  const soapEnvelope = `<?xml version="1.0" encoding="UTF-8"?>
<soap12:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xmlns:xsd="http://www.w3.org/2001/XMLSchema"
  xmlns:soap12="http://www.w3.org/2003/05/soap-envelope">
  <soap12:Body>
    <nfeDadosMsg xmlns="http://www.portalfiscal.inf.br/nfe/wsdl/NFeAutorizacao4">
      ${xmlLote}
    </nfeDadosMsg>
  </soap12:Body>
</soap12:Envelope>`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/soap+xml; charset=utf-8',
      'SOAPAction': '',
    },
    body: soapEnvelope,
    signal: AbortSignal.timeout(30000),
  });

  const text = await response.text();

  // Verifica se foi síncrono (cStat 100 direto) ou assíncrono (recibo)
  const cStatMatch = text.match(/<cStat>(\d+)<\/cStat>/);
  const xMotivoMatch = text.match(/<xMotivo>(.*?)<\/xMotivo>/);
  const cStat = cStatMatch ? cStatMatch[1] : null;
  const xMotivo = xMotivoMatch ? xMotivoMatch[1] : 'Sem retorno';

  // Síncrono autorizado
  if (cStat === '100') {
    const chaveMatch = text.match(/<chNFe>(.*?)<\/chNFe>/);
    const protocoloMatch = text.match(/<nProt>(.*?)<\/nProt>/);
    return {
      tipo: 'sincrono',
      autorizado: true,
      cStat,
      xMotivo,
      chave: chaveMatch ? chaveMatch[1] : null,
      protocolo: protocoloMatch ? protocoloMatch[1] : null,
      xml: text,
    };
  }

  // Rejeitado
  if (cStat && parseInt(cStat) >= 200) {
    return { tipo: 'sincrono', autorizado: false, cStat, xMotivo, xml: text };
  }

  // Assíncrono — retornou recibo
  const reciboMatch = text.match(/<nRec>(.*?)<\/nRec>/);
  if (reciboMatch) {
    return { tipo: 'assincrono', recibo: reciboMatch[1], cStat, xMotivo, xml: text };
  }

  throw new Error(`Retorno inesperado da SEFAZ: ${text.slice(0, 500)}`);
}

async function consultarRecibo(recibo, tpAmb, uf = 'SP') {
  const url = getRetornoUrl(tpAmb);
  const soapEnvelope = `<?xml version="1.0" encoding="UTF-8"?>
<soap12:Envelope xmlns:soap12="http://www.w3.org/2003/05/soap-envelope">
  <soap12:Body>
    <nfeDadosMsg xmlns="http://www.portalfiscal.inf.br/nfe/wsdl/NFeRetAutorizacao4">
      <consReciNFe versao="4.00" xmlns="http://www.portalfiscal.inf.br/nfe">
        <tpAmb>${tpAmb}</tpAmb>
        <nRec>${recibo}</nRec>
      </consReciNFe>
    </nfeDadosMsg>
  </soap12:Body>
</soap12:Envelope>`;

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/soap+xml; charset=utf-8' },
    body: soapEnvelope,
    signal: AbortSignal.timeout(15000),
  });

  return await response.text();
}

async function cancelarNFe(xmlEventoAssinado, tpAmb) {
  const url = getCancelUrl(tpAmb);
  const soapEnvelope = `<?xml version="1.0" encoding="UTF-8"?>
<soap12:Envelope xmlns:soap12="http://www.w3.org/2003/05/soap-envelope">
  <soap12:Body>
    <nfeDadosMsg xmlns="http://www.portalfiscal.inf.br/nfe/wsdl/NFeRecepcaoEvento4">
      ${xmlEventoAssinado}
    </nfeDadosMsg>
  </soap12:Body>
</soap12:Envelope>`;

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/soap+xml; charset=utf-8' },
    body: soapEnvelope,
    signal: AbortSignal.timeout(20000),
  });

  const text = await response.text();
  const cStatMatch = text.match(/<cStat>(\d+)<\/cStat>/);
  const xMotivoMatch = text.match(/<xMotivo>(.*?)<\/xMotivo>/);
  return {
    cStat: cStatMatch ? cStatMatch[1] : '999',
    xMotivo: xMotivoMatch ? xMotivoMatch[1] : 'Sem retorno',
    xml: text,
  };
}

module.exports = { enviarLote, consultarRecibo, cancelarNFe };
