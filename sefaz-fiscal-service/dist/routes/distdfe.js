"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = default_1;
const client_1 = require("../sefaz/client");
const envelope_1 = require("../sefaz/envelope");
const parser_1 = require("../sefaz/parser");
// @ts-ignore
const node_forge_1 = __importDefault(require("node-forge"));
async function default_1(fastify) {
    fastify.post('/distdfe', async (req, reply) => {
        const { cnpj, ultNSU: ultNSUInicial, pfxBase64, passphrase, ambiente } = req.body;
        if (!cnpj || ultNSUInicial === undefined || !pfxBase64 || !passphrase) {
            return reply.code(400).send({ error: 'cnpj, ultNSU, pfxBase64 e passphrase são obrigatórios' });
        }
        const pfx = Buffer.from(pfxBase64, 'base64');
        console.log("----------------------------------------------------------------");
        console.log(`[PFX] Tamanho base64 recebido: ${pfxBase64.length}`);
        console.log(`[PFX] Buffer bytes decodificado: ${pfx.length}`);
        console.log(`[PFX] Passphrase length: ${passphrase?.length}`);
        console.log(`[PFX] Passphrase tipo: ${typeof passphrase}`);
        try {
            const p12Asn1 = node_forge_1.default.asn1.fromDer(node_forge_1.default.util.createBuffer(pfx.toString('binary')));
            // Tentar abrir com a senha. Se senha errada, lança exceção.
            node_forge_1.default.pkcs12.pkcs12FromAsn1(p12Asn1, passphrase);
            console.log("[PFX] ✅ Certificado aberto com sucesso via node-forge (Senha Correta)");
        }
        catch (err) {
            console.error("[PFX] ❌ ERRO CRÍTICO ao abrir PKCS12 (Senha Incorreta?):", err.message);
            return reply.code(400).send({ error: `Certificado/Senha inválidos: ${err.message}` });
        }
        console.log("----------------------------------------------------------------");
        let ultNSU = String(ultNSUInicial);
        const todosDocumentos = [];
        let lastCStat = '';
        let lastXMotivo = '';
        let loopCount = 0;
        const MAX_LOOPS = 50;
        try {
            while (true) {
                loopCount++;
                if (loopCount > MAX_LOOPS)
                    break;
                console.log(`[SEFAZ] Loop ${loopCount} | CNPJ: ${cnpj} | NSU: ${ultNSU}`);
                const endpoint = ambiente === 'homologacao' ? client_1.URL_DISTDFE_HOM : client_1.URL_DISTDFE_PROD;
                const envelope = (0, envelope_1.buildDistDFeEnvelope)(cnpj, ultNSU, ambiente);
                const xmlResponse = await (0, client_1.callSefaz)(envelope, pfx, passphrase, endpoint);
                console.log("--------------------------------------------------");
                console.log("[SEFAZ RAW RESPONSE]");
                console.log(xmlResponse.substring(0, 2000)); // evitar log gigante
                console.log("--------------------------------------------------");
                // Parse simplificado para ver status primeiro
                const parsed = (0, parser_1.parseDistDFeResponse)(xmlResponse);
                console.log("[SEFAZ] cStat:", parsed.cStat);
                console.log("[SEFAZ] xMotivo:", parsed.xMotivo);
                console.log("[SEFAZ] ultNSU:", parsed.ultNSU);
                console.log("[SEFAZ] maxNSU:", parsed.maxNSU);
                console.log("[SEFAZ] Docs retornados:", parsed.documentos.length);
                if (parsed.documentos.length > 0) {
                    console.log("[SEFAZ] Schema primeiro doc:", parsed.documentos[0]?.schema);
                }
                // Proteção contra Consumo Indevido (656)
                if (parsed.cStat === '656') {
                    console.warn(`[SEFAZ] BLOQUEIO: Consumo Indevido (656).`);
                    return reply.code(429).send({
                        error: 'Consumo indevido detectado pela SEFAZ. Aguarde 1 hora antes de tentar novamente.',
                        cStat: parsed.cStat,
                        xMotivo: parsed.xMotivo
                    });
                }
                lastCStat = parsed.cStat;
                lastXMotivo = parsed.xMotivo;
                // Se erro fatal, para
                if (parsed.cStat !== '137' && parsed.cStat !== '138') {
                    console.warn(`[SEFAZ] Parando por erro/status: ${parsed.cStat} - ${parsed.xMotivo}`);
                    break;
                }
                // Adiciona docs
                if (parsed.documentos.length > 0) {
                    todosDocumentos.push(...parsed.documentos);
                }
                // Se 137 -> Acabou (Nenhum documento localizado para o NSU informado)
                if (parsed.cStat === '137') {
                    ultNSU = parsed.ultNSU; // Atualiza final
                    break;
                }
                // Se 138 -> Documento localizado (Tem mais)
                ultNSU = parsed.ultNSU;
            }
            return {
                cStat: lastCStat,
                xMotivo: lastXMotivo,
                ultNSU, // O último NSU processado (para o cliente salvar)
                documentos: todosDocumentos
            };
        }
        catch (err) {
            req.log.error(err);
            return reply.code(500).send({ error: err.message || String(err) });
        }
    });
}
