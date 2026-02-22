"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.URL_DISTDFE_HOM = exports.URL_DISTDFE_PROD = void 0;
exports.callSefaz = callSefaz;
const https_1 = __importDefault(require("https"));
// @ts-ignore
const node_forge_1 = __importDefault(require("node-forge"));
const URL_DISTDFE_PROD = 'https://www1.nfe.fazenda.gov.br/NFeDistribuicaoDFe/NFeDistribuicaoDFe.asmx';
exports.URL_DISTDFE_PROD = URL_DISTDFE_PROD;
const URL_DISTDFE_HOM = 'https://hom1.nfe.fazenda.gov.br/NFeDistribuicaoDFe/NFeDistribuicaoDFe.asmx'; // hom1 é o mais comum para AN
exports.URL_DISTDFE_HOM = URL_DISTDFE_HOM;
const SOAP_ACTION = 'http://www.portalfiscal.inf.br/nfe/wsdl/NFeDistribuicaoDFe/nfeDistDFeInteresse';
function callSefaz(xml, pfx, passphrase, endpoint, // Endpoint agora é obrigatório (ou padronizado fora)
action = SOAP_ACTION, timeoutMs = 30000, attempt = 1) {
    return new Promise((resolve, reject) => {
        if (!pfx || !passphrase) {
            return reject(new Error('PFX e Passphrase são obrigatórios'));
        }
        console.log(`[SEFAZ Client] Iniciando chamada v3.0 (PEM Conversion). PFX Buffer Size: ${pfx.length}`);
        let agent;
        try {
            // Conversão PKCS12 -> PEM usando node-forge (Bypasses OpenSSL legacy issues)
            const p12Der = pfx.toString('binary');
            const p12Asn1 = node_forge_1.default.asn1.fromDer(p12Der);
            const p12 = node_forge_1.default.pkcs12.pkcs12FromAsn1(p12Asn1, passphrase);
            // Extrair Chave Privada
            const keyBags = p12.getBags({ bagType: node_forge_1.default.pki.oids.pkcs8ShroudedKeyBag });
            const keyBag = keyBags[node_forge_1.default.pki.oids.pkcs8ShroudedKeyBag]?.[0];
            // Extrair Certificado
            const certBags = p12.getBags({ bagType: node_forge_1.default.pki.oids.certBag });
            const certBag = certBags[node_forge_1.default.pki.oids.certBag]?.[0];
            if (!keyBag || !certBag) {
                throw new Error('Falha ao extrair Chave Privada ou Certificado do PKCS12 (Bags not found)');
            }
            const privateKeyPem = node_forge_1.default.pki.privateKeyToPem(keyBag.key);
            const certificatePem = node_forge_1.default.pki.certificateToPem(certBag.cert);
            // Criar Agente com PEM
            agent = new https_1.default.Agent({
                key: privateKeyPem,
                cert: certificatePem,
                rejectUnauthorized: false,
                minVersion: "TLSv1.2",
                keepAlive: true,
                timeout: timeoutMs
            });
            console.log('[SEFAZ Client] Agente HTTPS criado com sucesso via PEM');
        }
        catch (err) {
            console.error('[SEFAZ Client] Erro na conversão PFX->PEM ou criação do agente:', err.message);
            return reject(new Error(`Falha TLS/PFX: ${err.message}`));
        }
        const url = new URL(endpoint);
        const options = {
            hostname: url.hostname,
            path: url.pathname + url.search,
            method: 'POST',
            agent,
            //@ts-ignore
            timeout: timeoutMs,
            headers: {
                'Content-Type': xml.includes('soap12') ? 'application/soap+xml; charset=utf-8' : 'text/xml; charset=utf-8',
                'SOAPAction': `"${action}"`,
                'Content-Length': Buffer.byteLength(xml)
            }
        };
        const req = https_1.default.request(options, (res) => {
            let data = '';
            res.on('data', chunk => (data += chunk));
            res.on('end', () => {
                if (res.statusCode && res.statusCode >= 400 && res.statusCode < 500) {
                    return reject(new Error(`SEFAZ HTTP ${res.statusCode}: ${data}`));
                }
                if (res.statusCode && res.statusCode >= 500) {
                    if (attempt < 3) {
                        console.warn(`[SEFAZ] Erro ${res.statusCode} (Tentativa ${attempt}/3). Retrying...`);
                        // Retry recursivo: Mantém o PFX original pois callSefaz espera PFX
                        setTimeout(() => resolve(callSefaz(xml, pfx, passphrase, endpoint, action, timeoutMs, attempt + 1)), 1500 * attempt);
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
                setTimeout(() => resolve(callSefaz(xml, pfx, passphrase, endpoint, action, timeoutMs, attempt + 1)), 1500 * attempt);
            }
            else {
                console.error('[SEFAZ] Timeout excedido (30s).');
                reject(new Error('Timeout SEFAZ após 3 tentativas.'));
            }
        });
        req.on('error', (err) => {
            // Tratamento específico para erro de conexão/TLS
            console.error(`[SEFAZ] Erro de Rede/TLS: ${err.message}`, err);
            if (attempt < 3) {
                console.warn(`[SEFAZ] Retrying connection failure (Tentativa ${attempt}/3)...`);
                setTimeout(() => resolve(callSefaz(xml, pfx, passphrase, endpoint, action, timeoutMs, attempt + 1)), 1500 * attempt);
            }
            else {
                reject(err);
            }
        });
        req.write(xml);
        req.end();
    });
}
