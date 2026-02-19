import { SignedXml } from 'xml-crypto'
// @ts-ignore
import forge from 'node-forge'

function MyKeyInfo(this: any, cert: string) {
    this.getKeyInfo = function (key: any, prefix: string) {
        prefix = prefix ? prefix + ':' : ''
        const certClean = cert.replace(/-----BEGIN CERTIFICATE-----/g, '').replace(/-----END CERTIFICATE-----/g, '').replace(/\r?\n|\r/g, '')
        return `<X509Data><X509Certificate>${certClean}</X509Certificate></X509Data>`
    }
    this.getKey = function (keyInfo: any) {
        return cert
    }
}

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

    const sig = new SignedXml()

    // Referência assinatura: URI (ID da tag evento), Transformações e Digest Method (SHA1)
    sig.addReference(`//*[@Id='${tagId}']`, [
        'http://www.w3.org/2000/09/xmldsig#enveloped-signature',
        'http://www.w3.org/TR/2001/REC-xml-c14n-20010315'
    ], 'http://www.w3.org/2000/09/xmldsig#sha1')

    sig.canonicalizationAlgorithm = 'http://www.w3.org/TR/2001/REC-xml-c14n-20010315'
    sig.signatureAlgorithm = 'http://www.w3.org/2000/09/xmldsig#rsa-sha1'
    sig.signingKey = keyPem
    sig.keyInfoProvider = new (MyKeyInfo as any)(certPem)

    sig.computeSignature(xml)

    return sig.getSignedXml()
}
