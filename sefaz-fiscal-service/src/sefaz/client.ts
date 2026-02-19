import https from 'https'
import fs from 'fs'

const SEFAZ_URL = 'https://www1.nfe.fazenda.sp.gov.br/NFeDistribuicaoDFe/NFeDistribuicaoDFe.asmx'
const SOAP_ACTION = 'http://www.portalfiscal.inf.br/nfe/wsdl/NFeDistribuicaoDFe/nfeDistDFeInteresse'

export function callSefaz(
    xml: string,
    endpoint: string = SEFAZ_URL,
    action: string = SOAP_ACTION,
    timeoutMs: number = 30000,
    attempt: number = 1
): Promise<string> {
    return new Promise((resolve, reject) => {

        if (!process.env.PFX_PATH || !process.env.PFX_PASSWORD) {
            return reject(new Error('PFX_PATH e PFX_PASSWORD são obrigatórios no .env'))
        }

        let pfx: Buffer
        try {
            pfx = fs.readFileSync(process.env.PFX_PATH)
        } catch (e) {
            return reject(new Error(`Erro ao ler PFX em ${process.env.PFX_PATH}: ${e}`))
        }

        const agent = new https.Agent({
            pfx,
            passphrase: process.env.PFX_PASSWORD,
            rejectUnauthorized: true,
            minVersion: 'TLSv1.2',
            keepAlive: true,
            timeout: timeoutMs // Agente timeout para conexão 
        })

        const url = new URL(endpoint)
        const options: https.RequestOptions = {
            hostname: url.hostname,
            path: url.pathname + url.search,
            method: 'POST',
            agent,
            //@ts-ignore
            timeout: timeoutMs, // Request timeout
            headers: {
                'Content-Type': 'application/soap+xml; charset=utf-8',
                'SOAPAction': action,
                'Content-Length': Buffer.byteLength(xml)
            }
        }

        const req = https.request(options, (res) => {
            let data = ''
            res.on('data', chunk => (data += chunk))
            res.on('end', () => {
                if (res.statusCode && res.statusCode >= 400 && res.statusCode < 500) {
                    // Erros 4xx geralmente não vale a pena retry (exceto 408/429)
                    // Se for 403 (Certificado), não retry.
                    return reject(new Error(`SEFAZ HTTP ${res.statusCode}: ${data}`))
                }
                if (res.statusCode && res.statusCode >= 500) {
                    // Erro 5xx -> Retry se attempt < 3
                    if (attempt < 3) {
                        console.warn(`[SEFAZ] Erro ${res.statusCode} (Tentativa ${attempt}/3). Retrying...`)
                        setTimeout(() => resolve(callSefaz(xml, endpoint, action, timeoutMs, attempt + 1)), 1500 * attempt)
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
                setTimeout(() => resolve(callSefaz(xml, endpoint, action, timeoutMs, attempt + 1)), 1500 * attempt)
            } else {
                console.error('[SEFAZ] Timeout excedido (30s).')
                reject(new Error('Timeout SEFAZ após 3 tentativas.'))
            }
        })

        req.on('error', (err: any) => {
            // Retry em erros de rede (ECONNRESET, ETIMEDOUT, etc)
            if (attempt < 3) {
                console.warn(`[SEFAZ] Erro Rede: ${err.message} (Tentativa ${attempt}/3). Retrying...`)
                setTimeout(() => resolve(callSefaz(xml, endpoint, action, timeoutMs, attempt + 1)), 1500 * attempt)
            } else {
                console.error('[SEFAZ] Erro fatal de conexão:', err)
                reject(err)
            }
        })

        req.write(xml)
        req.end()
    })
}
