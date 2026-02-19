"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = default_1;
const client_1 = require("../sefaz/client");
const envelope_1 = require("../sefaz/envelope");
const parser_1 = require("../sefaz/parser");
async function default_1(fastify) {
    fastify.post('/distdfe', async (req, reply) => {
        const { cnpj, ultNSU: ultNSUInicial } = req.body;
        if (!cnpj || ultNSUInicial === undefined) {
            return reply.code(400).send({ error: 'cnpj e ultNSU são obrigatórios' });
        }
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
                const envelope = (0, envelope_1.buildDistDFeEnvelope)(cnpj, ultNSU);
                const xmlResponse = await (0, client_1.callSefaz)(envelope);
                const parsed = (0, parser_1.parseDistDFeResponse)(xmlResponse);
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
                // Se 137 -> Acabou
                if (parsed.cStat === '137') {
                    ultNSU = parsed.ultNSU; // Atualiza final
                    break;
                }
                // Se 138 -> Tem mais
                // Atualiza ultNSU para o próximo loop
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
