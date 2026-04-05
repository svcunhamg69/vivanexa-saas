// lib/nfe/signer.js
const forge = require('node-forge');
const { SignedXml } = require('xml-crypto');

function loadPfx(pfxBuffer, password) {
  const p12Asn1 = forge.asn1.fromDer(pfxBuffer.toString('binary'));
  const p12 = forge.pkcs12.pkcs12FromAsn1(p12Asn1, false, password);

  const keyBags = p12.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag });
  const certBags = p12.getBags({ bagType: forge.pki.oids.certBag });

  const keyBagArr = keyBags[forge.pki.oids.pkcs8ShroudedKeyBag];
  const certBagArr = certBags[forge.pki.oids.certBag];

  if (!keyBagArr || !keyBagArr.length) throw new Error('Chave privada não encontrada no certificado');
  if (!certBagArr || !certBagArr.length) throw new Error('Certificado não encontrado no arquivo PFX');

  const privateKey = forge.pki.privateKeyToPem(keyBagArr[0].key);
  const certificate = forge.pki.certificateToPem(certBagArr[0].cert);

  return { privateKey, certificate };
}

function assinarXml(xmlString, privateKeyPem, certificatePem) {
  const sig = new SignedXml({ privateKey: privateKeyPem });

  const certBase64 = certificatePem
    .replace(/-----BEGIN CERTIFICATE-----/g, '')
    .replace(/-----END CERTIFICATE-----/g, '')
    .replace(/\s/g, '');

  sig.addReference({
    xpath: "//*[local-name(.)='infNFe']",
    digestAlgorithm: 'http://www.w3.org/2000/09/xmldsig#sha1',
    transforms: [
      'http://www.w3.org/2000/09/xmldsig#enveloped-signature',
      'http://www.w3.org/TR/2001/REC-xml-c14n-20010315',
    ],
  });

  sig.canonicalizationAlgorithm = 'http://www.w3.org/TR/2001/REC-xml-c14n-20010315';
  sig.signatureAlgorithm = 'http://www.w3.org/2000/09/xmldsig#rsa-sha1';

  sig.keyInfoProvider = {
    getKeyInfo: () => `<X509Data><X509Certificate>${certBase64}</X509Certificate></X509Data>`,
  };

  sig.computeSignature(xmlString, {
    location: { reference: "//*[local-name(.)='infNFe']", action: 'after' },
  });

  return sig.getSignedXml();
}

module.exports = { loadPfx, assinarXml };
