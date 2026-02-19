import https from 'https'

const SEFAZ_URL = 'https://www1.nfe.fazenda.sp.gov.br/NFeDistribuicaoDFe/NFeDistribuicaoDFe.asmx'
const SOAP_ACTION = 'http://www.portalfiscal.inf.br/nfe/wsdl/NFeDistribuicaoDFe/nfeDistDFeInteresse'

export function callSefaz(
    xml: string,
    pfx: Buffer,
    passphrase: string,
    endpoint: string = SEFAZ_URL,
    action: string = SOAP_ACTION,
    timeoutMs: number = 30000,
    attempt: number = 1
): Promise<string> {
    return new Promise((resolve, reject) => {

        if (!pfx || !passphrase) {
            return reject(new Error('PFX e Passphrase são obrigatórios'))
        }

        console.log(`[SEFAZ Client] Iniciando chamada. PFX Buffer Size: ${pfx.length}`)

        const agent = new https.Agent({
            pfx,
            passphrase,
            rejectUnauthorized: false, // Permitido conforme instrução (CA Brasil ausente em alpine padrão)
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
                        // Passando pfx e passphrase recursivamente
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
            // Retry em erros de rede (ECONNRESET, ETIMEDOUT, etc)
            if (attempt < 3) {
                console.warn(`[SEFAZ] Erro Rede: ${err.message} (Tentativa ${attempt}/3). Retrying...`)
                setTimeout(() => resolve(callSefaz(xml, pfx, passphrase, endpoint, action, timeoutMs, attempt + 1)), 1500 * attempt)
            } else {
                console.error('[SEFAZ] Erro fatal de conexão:', err)
                reject(err)
            }
        })

        req.write(xml)
        req.end()
    })
}
