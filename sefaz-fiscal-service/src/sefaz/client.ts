import https from 'https'
import crypto from 'crypto'
// @ts-ignore
import forge from 'node-forge'

const URL_DISTDFE_PROD = 'https://www1.nfe.fazenda.gov.br/NFeDistribuicaoDFe/NFeDistribuicaoDFe.asmx'
const URL_DISTDFE_HOM = 'https://hom1.nfe.fazenda.gov.br/NFeDistribuicaoDFe/NFeDistribuicaoDFe.asmx' // hom1 é o mais comum para AN
const SOAP_ACTION = 'http://www.portalfiscal.inf.br/nfe/wsdl/NFeDistribuicaoDFe/nfeDistDFeInteresse'

export { URL_DISTDFE_PROD, URL_DISTDFE_HOM }

export function callSefaz(
    xml: string,
    pfx: Buffer,
    passphrase: string,
    endpoint: string, // Endpoint agora é obrigatório (ou padronizado fora)
    action: string = SOAP_ACTION,
    timeoutMs: number = 30000,
    attempt: number = 1
): Promise<string> {
    return new Promise((resolve, reject) => {

        if (!pfx || !passphrase) {
            return reject(new Error('PFX e Passphrase são obrigatórios'))
        }

        console.log(`[SEFAZ Client] Iniciando chamada v3.0 (PEM Conversion). PFX Buffer Size: ${pfx.length}`)

        let agent: https.Agent

        try {
            // Conversão PKCS12 -> PEM usando node-forge (Bypasses OpenSSL legacy issues)
            const p12Der = pfx.toString('binary')
            const p12Asn1 = forge.asn1.fromDer(p12Der)
            const p12 = forge.pkcs12.pkcs12FromAsn1(p12Asn1, passphrase)

            // Extrair Chave Privada
            const keyBags = p12.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag })
            const keyBag = keyBags[forge.pki.oids.pkcs8ShroudedKeyBag]?.[0]

            // Extrair Certificado
            const certBags = p12.getBags({ bagType: forge.pki.oids.certBag })
            const certBag = certBags[forge.pki.oids.certBag]?.[0]

            if (!keyBag || !certBag) {
                throw new Error('Falha ao extrair Chave Privada ou Certificado do PKCS12 (Bags not found)')
            }

            const privateKeyPem = forge.pki.privateKeyToPem(keyBag.key!)
            const certificatePem = forge.pki.certificateToPem(certBag.cert!)

            // Criar Agente com PEM
            agent = new https.Agent({
                key: privateKeyPem,
                cert: certificatePem,
                rejectUnauthorized: false,
                minVersion: "TLSv1.2",
                keepAlive: true,
                timeout: timeoutMs
            })

            console.log('[SEFAZ Client] Agente HTTPS criado com sucesso via PEM')

        } catch (err: any) {
            console.error('[SEFAZ Client] Erro na conversão PFX->PEM ou criação do agente:', err.message)
            return reject(new Error(`Falha TLS/PFX: ${err.message}`))
        }

        const url = new URL(endpoint)
        const options: https.RequestOptions = {
            hostname: url.hostname,
            path: url.pathname + url.search,
            method: 'POST',
            agent,
            //@ts-ignore
            timeout: timeoutMs,
            headers: {
                'Content-Type': xml.includes('soap12') ? 'application/soap+xml; charset=utf-8' : 'text/xml; charset=utf-8',
                'SOAPAction': action,
                'Content-Length': Buffer.byteLength(xml)
            }
        }

        const req = https.request(options, (res) => {
            let data = ''
            res.on('data', chunk => (data += chunk))
            res.on('end', () => {
                if (res.statusCode && res.statusCode >= 400 && res.statusCode < 500) {
                    return reject(new Error(`SEFAZ HTTP ${res.statusCode}: ${data}`))
                }
                if (res.statusCode && res.statusCode >= 500) {
                    if (attempt < 3) {
                        console.warn(`[SEFAZ] Erro ${res.statusCode} (Tentativa ${attempt}/3). Retrying...`)
                        // Retry recursivo: Mantém o PFX original pois callSefaz espera PFX
                        setTimeout(() => resolve(callSefaz(xml, pfx, passphrase, endpoint, action, timeoutMs, attempt + 1)), 1500 * attempt)
                        return
                    }
                    return reject(new Error(`SEFAZ HTTP ${res.statusCode}: ${data}`))
                }
                resolve(data)
            })
        })

        req.on('timeout', () => {
            req.destroy()
            if (attempt < 3) {
                console.warn(`[SEFAZ] Timeout (Tentativa ${attempt}/3). Retrying...`)
                setTimeout(() => resolve(callSefaz(xml, pfx, passphrase, endpoint, action, timeoutMs, attempt + 1)), 1500 * attempt)
            } else {
                console.error('[SEFAZ] Timeout excedido (30s).')
                reject(new Error('Timeout SEFAZ após 3 tentativas.'))
            }
        })

        req.on('error', (err: any) => {
            // Tratamento específico para erro de conexão/TLS
            console.error(`[SEFAZ] Erro de Rede/TLS: ${err.message}`, err)

            if (attempt < 3) {
                console.warn(`[SEFAZ] Retrying connection failure (Tentativa ${attempt}/3)...`)
                setTimeout(() => resolve(callSefaz(xml, pfx, passphrase, endpoint, action, timeoutMs, attempt + 1)), 1500 * attempt)
            } else {
                reject(err)
            }
        })

        req.write(xml)
        req.end()
    })
}
