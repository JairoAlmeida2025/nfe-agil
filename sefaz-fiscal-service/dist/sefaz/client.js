"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.callSefaz = callSefaz;
const https_1 = __importDefault(require("https"));
const fs_1 = __importDefault(require("fs"));
const SEFAZ_URL = 'https://www1.nfe.fazenda.sp.gov.br/NFeDistribuicaoDFe/NFeDistribuicaoDFe.asmx';
const SOAP_ACTION = 'http://www.portalfiscal.inf.br/nfe/wsdl/NFeDistribuicaoDFe/nfeDistDFeInteresse';
function callSefaz(xml, endpoint = SEFAZ_URL, action = SOAP_ACTION, timeoutMs = 30000, attempt = 1) {
    return new Promise((resolve, reject) => {
        if (!process.env.PFX_PATH || !process.env.PFX_PASSWORD) {
            return reject(new Error('PFX_PATH e PFX_PASSWORD são obrigatórios no .env'));
        }
        let pfx;
        try {
            pfx = fs_1.default.readFileSync(process.env.PFX_PATH);
        }
        catch (e) {
            return reject(new Error(`Erro ao ler PFX em ${process.env.PFX_PATH}: ${e}`));
        }
        const agent = new https_1.default.Agent({
            pfx,
            passphrase: process.env.PFX_PASSWORD,
            rejectUnauthorized: true,
            minVersion: 'TLSv1.2',
            keepAlive: true,
            timeout: timeoutMs // Agente timeout para conexão 
        });
        const url = new URL(endpoint);
        const options = {
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
        };
        const req = https_1.default.request(options, (res) => {
            let data = '';
            res.on('data', chunk => (data += chunk));
            res.on('end', () => {
                if (res.statusCode && res.statusCode >= 400 && res.statusCode < 500) {
                    // Erros 4xx geralmente não vale a pena retry (exceto 408/429)
                    // Se for 403 (Certificado), não retry.
                    return reject(new Error(`SEFAZ HTTP ${res.statusCode}: ${data}`));
                }
                if (res.statusCode && res.statusCode >= 500) {
                    // Erro 5xx -> Retry se attempt < 3
                    if (attempt < 3) {
                        console.warn(`[SEFAZ] Erro ${res.statusCode} (Tentativa ${attempt}/3). Retrying...`);
                        setTimeout(() => resolve(callSefaz(xml, endpoint, action, timeoutMs, attempt + 1)), 1500 * attempt);
                        return;
                    }
                    return reject(new Error(`SEFAZ HTTP ${res.statusCode}: ${data}`));
                }
                resolve(data);
            });
        });
        req.on('timeout', () => {
            req.destroy();
            if (attempt < 3) {
                console.warn(`[SEFAZ] Timeout (Tentativa ${attempt}/3). Retrying...`);
                setTimeout(() => resolve(callSefaz(xml, endpoint, action, timeoutMs, attempt + 1)), 1500 * attempt);
            }
            else {
                console.error('[SEFAZ] Timeout excedido (30s).');
                reject(new Error('Timeout SEFAZ após 3 tentativas.'));
            }
        });
        req.on('error', (err) => {
            // Retry em erros de rede (ECONNRESET, ETIMEDOUT, etc)
            if (attempt < 3) {
                console.warn(`[SEFAZ] Erro Rede: ${err.message} (Tentativa ${attempt}/3). Retrying...`);
                setTimeout(() => resolve(callSefaz(xml, endpoint, action, timeoutMs, attempt + 1)), 1500 * attempt);
            }
            else {
                console.error('[SEFAZ] Erro fatal de conexão:', err);
                reject(err);
            }
        });
        req.write(xml);
        req.end();
    });
}
