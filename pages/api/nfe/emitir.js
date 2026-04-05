// pages/api/nfe/emitir.js
import path from 'path';
import { buildNFeSaida, buildNFCe } from '../../../lib/nfe/xmlBuilder';
import { loadPfx, assinarXml } from '../../../lib/nfe/signer';
import { enviarLote, consultarRecibo } from '../../../lib/nfe/sefaz';

export const config = {
  api: { bodyParser: { sizeLimit: '10mb' } },
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  try {
    const {
      emitente,
      destinatario,
      produtos,
      dadosNota,
      tpAmb = '2',
      modelo = '55',
      certificadoBase64,
      senhaCertificado,
      ultimoNumero = 0,
    } = req.body;

    if (!emitente || !destinatario || !produtos || produtos.length === 0) {
      return res.status(400).json({ error: 'Dados incompletos: emitente, destinatário e produtos são obrigatórios' });
    }

    if (!certificadoBase64 || !senhaCertificado) {
      return res.status(400).json({
        error: 'Certificado digital não configurado. Acesse Configurações → Empresa para fazer o upload.',
      });
    }

    // 1. Montar XML
    let buildResult;
    if (modelo === '65') {
      buildResult = buildNFCe(emitente, destinatario, produtos, dadosNota, tpAmb, ultimoNumero);
    } else {
      buildResult = buildNFeSaida(emitente, destinatario, produtos, dadosNota, tpAmb, ultimoNumero);
    }
    const { xml, chave, numero } = buildResult;

    // 2. Carregar certificado e assinar
    const pfxBuffer = Buffer.from(certificadoBase64, 'base64');
    const { privateKey, certificate } = loadPfx(pfxBuffer, senhaCertificado);
    const xmlAssinado = assinarXml(xml, privateKey, certificate);

    // 3. Enviar para SEFAZ
    const resultado = await enviarLote(xmlAssinado, tpAmb, emitente.uf, modelo);

    // Síncrono autorizado
    if (resultado.tipo === 'sincrono' && resultado.autorizado) {
      return res.status(200).json({
        status: 'autorizada',
        chave,
        numero,
        protocolo: resultado.protocolo,
        xml: resultado.xml,
        dataHora: new Date().toISOString(),
        cStat: resultado.cStat,
        xMotivo: resultado.xMotivo,
      });
    }

    // Síncrono rejeitado
    if (resultado.tipo === 'sincrono' && !resultado.autorizado) {
      return res.status(422).json({
        status: 'rejeitada',
        cStat: resultado.cStat,
        motivo: resultado.xMotivo,
        chave,
        numero,
      });
    }

    // Assíncrono — aguarda e consulta recibo
    if (resultado.tipo === 'assincrono') {
      await new Promise((r) => setTimeout(r, 3000));
      const retorno = await consultarRecibo(resultado.recibo, tpAmb, emitente.uf);

      const cStatMatch = retorno.match(/<cStat>(\d+)<\/cStat>/);
      const xMotivoMatch = retorno.match(/<xMotivo>(.*?)<\/xMotivo>/);
      const cStat = cStatMatch ? cStatMatch[1] : '999';
      const xMotivo = xMotivoMatch ? xMotivoMatch[1] : 'Sem retorno';
      const protocoloMatch = retorno.match(/<nProt>(.*?)<\/nProt>/);

      if (cStat === '100') {
        return res.status(200).json({
          status: 'autorizada',
          chave,
          numero,
          protocolo: protocoloMatch ? protocoloMatch[1] : null,
          xml: retorno,
          dataHora: new Date().toISOString(),
          cStat,
          xMotivo,
        });
      }

      return res.status(422).json({
        status: 'rejeitada',
        cStat,
        motivo: xMotivo,
        chave,
        numero,
      });
    }

    throw new Error('Retorno inesperado da SEFAZ');
  } catch (error) {
    console.error('Erro na emissão NF-e:', error);
    return res.status(500).json({ error: error.message || 'Erro interno na emissão' });
  }
}
