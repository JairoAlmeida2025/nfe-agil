// @ts-ignore
import forge from 'node-forge'
import fs from 'fs'

export function checkCertificateValidity(): {
    valid: boolean
    expirationDate: Date
    daysRemaining: number
    issuer: string
    subject: string
} {
    if (!process.env.PFX_PATH || !process.env.PFX_PASSWORD) {
        throw new Error('Certificado PFX não configurado no .env')
    }

    let pfx: Buffer
    try {
        pfx = fs.readFileSync(process.env.PFX_PATH)
    } catch (e: any) {
        throw new Error(`Arquivo PFX não encontrado: ${e.message}`)
    }

    const p12Asn1 = forge.asn1.fromDer(pfx.toString('binary'))
    const p12 = forge.pkcs12.pkcs12FromAsn1(p12Asn1, process.env.PFX_PASSWORD)

    // Obter Certificado
    const certBags = p12.getBags({ bagType: forge.pki.oids.certBag })
    const certBag = certBags[forge.pki.oids.certBag]?.[0]

    if (!certBag) throw new Error('Certificado X.509 não encontrado no PFX')

    const cert = certBag.cert!

    // Datas
    const validity = cert.validity
    const notAfter = validity.notAfter
    const notBefore = validity.notBefore
    const now = new Date()

    const diffTime = notAfter.getTime() - now.getTime()
    const daysRemaining = Math.ceil(diffTime / (1000 * 60 * 60 * 24))

    const isValid = now >= notBefore && now <= notAfter

    // Issuer e Subject (CN)
    // Tenta pegar CN do Subject
    const subjectCN = cert.subject.getField('CN')?.value || 'Desconhecido'
    const issuerCN = cert.issuer.getField('CN')?.value || 'Desconhecido'

    return {
        valid: isValid,
        expirationDate: notAfter,
        daysRemaining,
        issuer: String(issuerCN),
        subject: String(subjectCN)
    }
}
