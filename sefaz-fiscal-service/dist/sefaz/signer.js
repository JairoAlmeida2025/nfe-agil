"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.assinarXML = assinarXML;
const xml_crypto_1 = require("xml-crypto");
// @ts-ignore
const node_forge_1 = __importDefault(require("node-forge"));
function assinarXML(xml, tagId, pfx, password) {
    const p12Asn1 = node_forge_1.default.asn1.fromDer(pfx.toString('binary'));
    const p12 = node_forge_1.default.pkcs12.pkcs12FromAsn1(p12Asn1, password || '');
    const certBags = p12.getBags({ bagType: node_forge_1.default.pki.oids.certBag });
    const certBag = certBags[node_forge_1.default.pki.oids.certBag]?.[0];
    const keyBags = p12.getBags({ bagType: node_forge_1.default.pki.oids.pkcs8ShroudedKeyBag });
    const keyBag = keyBags[node_forge_1.default.pki.oids.pkcs8ShroudedKeyBag]?.[0];
    if (!certBag || !keyBag)
        throw new Error('Certificado ou Chave Privada não encontrados no PFX');
    const cert = certBag.cert;
    const key = keyBag.key;
    const certPem = node_forge_1.default.pki.certificateToPem(cert);
    const keyPem = node_forge_1.default.pki.privateKeyToPem(key);
    // Limpar certificado para incluir no KeyInfo
    const certClean = certPem
        .replace(/-----BEGIN CERTIFICATE-----/g, '')
        .replace(/-----END CERTIFICATE-----/g, '')
        .replace(/\r?\n|\r/g, '');
    const sig = new xml_crypto_1.SignedXml({
        privateKey: keyPem,
        canonicalizationAlgorithm: 'http://www.w3.org/TR/2001/REC-xml-c14n-20010315',
        signatureAlgorithm: 'http://www.w3.org/2000/09/xmldsig#rsa-sha1',
        getKeyInfoContent: () => `<X509Data><X509Certificate>${certClean}</X509Certificate></X509Data>`
    });
    sig.addReference({
        xpath: `//*[@Id='${tagId}']`,
        transforms: [
            'http://www.w3.org/2000/09/xmldsig#enveloped-signature',
            'http://www.w3.org/TR/2001/REC-xml-c14n-20010315'
        ],
        digestAlgorithm: 'http://www.w3.org/2000/09/xmldsig#sha1'
    });
    sig.computeSignature(xml);
    return sig.getSignedXml();
}
