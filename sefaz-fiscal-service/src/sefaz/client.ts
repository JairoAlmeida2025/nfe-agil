import https from 'https'
import fs from 'fs'

const SEFAZ_URL = 'https://www1.nfe.fazenda.sp.gov.br/NFeDistribuicaoDFe/NFeDistribuicaoDFe.asmx'
const SOAP_ACTION = 'http://www.portalfiscal.inf.br/nfe/wsdl/NFeDistribuicaoDFe/nfeDistDFeInteresse'

export function callSefaz(xml: string, endpoint: string = SEFAZ_URL, action: string = SOAP_ACTION): Promise<string> {
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
            keepAlive: true
        })

        const url = new URL(endpoint)
        const options: https.RequestOptions = {
            hostname: url.hostname,
            path: url.pathname + url.search,
            method: 'POST',
            agent,
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
                if (res.statusCode && res.statusCode >= 400) {
                    console.error(`Status ${res.statusCode}: ${data}`)
                    return reject(new Error(`SEFAZ HTTP ${res.statusCode}`))
                }
                resolve(data)
            })
        })

        req.on('error', (err) => {
            console.error('Erro de conexão:', err)
            reject(err)
        })

        req.write(xml)
        req.end()
    })
}
