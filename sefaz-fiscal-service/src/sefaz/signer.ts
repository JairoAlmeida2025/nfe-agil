import { SignedXml } from 'xml-crypto'
// @ts-ignore
import forge from 'node-forge'

export function assinarXML(xml: string, tagId: string, pfx: Buffer, password: string): string {
    const p12Asn1 = forge.asn1.fromDer(pfx.toString('binary'))
    const p12 = forge.pkcs12.pkcs12FromAsn1(p12Asn1, password || '')

    const certBags = p12.getBags({ bagType: forge.pki.oids.certBag })
    const certBag = certBags[forge.pki.oids.certBag]?.[0]

    const keyBags = p12.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag })
    const keyBag = keyBags[forge.pki.oids.pkcs8ShroudedKeyBag]?.[0]

    if (!certBag || !keyBag) throw new Error('Certificado ou Chave Privada não encontrados no PFX')

    const cert = certBag.cert!
    const key = keyBag.key!

    const certPem = forge.pki.certificateToPem(cert)
    const keyPem = forge.pki.privateKeyToPem(key)

    // Limpar certificado para incluir no KeyInfo
    const certClean = certPem
        .replace(/-----BEGIN CERTIFICATE-----/g, '')
        .replace(/-----END CERTIFICATE-----/g, '')
        .replace(/\r?\n|\r/g, '')

    const sig = new SignedXml({
        privateKey: keyPem,
        canonicalizationAlgorithm: 'http://www.w3.org/TR/2001/REC-xml-c14n-20010315',
        signatureAlgorithm: 'http://www.w3.org/2000/09/xmldsig#rsa-sha1',
        getKeyInfoContent: () => `<X509Data><X509Certificate>${certClean}</X509Certificate></X509Data>`
    })

    sig.addReference({
        xpath: `//*[@Id='${tagId}']`,
        transforms: [
            'http://www.w3.org/2000/09/xmldsig#enveloped-signature',
            'http://www.w3.org/TR/2001/REC-xml-c14n-20010315'
        ],
        digestAlgorithm: 'http://www.w3.org/2000/09/xmldsig#sha1'
    })

    sig.computeSignature(xml)

    return sig.getSignedXml()
}
