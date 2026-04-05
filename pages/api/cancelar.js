// pages/api/nfe/cancelar.js
import { create } from 'xmlbuilder2';
import { loadPfx, assinarXml } from '../../../lib/nfe/signer';
import { cancelarNFe } from '../../../lib/nfe/sefaz';
import { obterCodigoUF } from '../../../lib/nfe/utils';

export const config = {
  api: { bodyParser: { sizeLimit: '10mb' } },
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  try {
    const {
      chave,
      protocolo,
      justificativa,
      emitente,
      tpAmb = '2',
      certificadoBase64,
      senhaCertificado,
    } = req.body;

    if (!chave || !justificativa || !emitente || !certificadoBase64) {
      return res.status(400).json({ error: 'Dados incompletos para cancelamento' });
    }

    if (justificativa.length < 15) {
      return res.status(400).json({ error: 'Justificativa deve ter no mínimo 15 caracteres' });
    }

    const cnpj = emitente.cnpj.replace(/\D/g, '');
    const cUF = obterCodigoUF(emitente.uf).toString();
    const dhEvento = new Date().toISOString().replace(/\.\d+Z$/, '-03:00');
    const idEvento = `ID110111${chave}01`;

    // Monta XML do evento de cancelamento
    const doc = create({ version: '1.0', encoding: 'UTF-8' })
      .ele('envEvento', { versao: '1.00', xmlns: 'http://www.portalfiscal.inf.br/nfe' });

    doc.ele('idLote').txt('1');

    const evento = doc.ele('evento', { versao: '1.00' });
    const infEvento = evento.ele('infEvento', { Id: idEvento });
    infEvento.ele('cOrgao').txt(cUF);
    infEvento.ele('tpAmb').txt(tpAmb);
    infEvento.ele('CNPJ').txt(cnpj);
    infEvento.ele('chNFe').txt(chave);
    infEvento.ele('dhEvento').txt(dhEvento);
    infEvento.ele('tpEvento').txt('110111');
    infEvento.ele('nSeqEvento').txt('1');
    infEvento.ele('verEvento').txt('1.00');
    const detEvento = infEvento.ele('detEvento', { versao: '1.00' });
    detEvento.ele('descEvento').txt('Cancelamento');
    detEvento.ele('nProt').txt(protocolo || '');
    detEvento.ele('xJust').txt(justificativa);

    const xmlCancelamento = doc.end({ prettyPrint: true });

    // Carregar certificado e assinar
    const pfxBuffer = Buffer.from(certificadoBase64, 'base64');
    const { privateKey, certificate } = loadPfx(pfxBuffer, senhaCertificado);
    const xmlAssinado = assinarXml(xmlCancelamento, privateKey, certificate);

    // Enviar para SEFAZ
    const resultado = await cancelarNFe(xmlAssinado, tpAmb);

    // cStat 128 = evento registrado (cancelamento aceito)
    // cStat 135 = evento registrado e vinculado a NF-e cancelada
    if (resultado.cStat === '128' || resultado.cStat === '135') {
      return res.status(200).json({
        status: 'cancelada',
        cStat: resultado.cStat,
        motivo: resultado.xMotivo,
      });
    }

    return res.status(422).json({
      status: 'erro',
      cStat: resultado.cStat,
      motivo: resultado.xMotivo,
    });
  } catch (error) {
    console.error('Erro no cancelamento NF-e:', error);
    return res.status(500).json({ error: error.message || 'Erro interno no cancelamento' });
  }
}
