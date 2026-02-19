"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = default_1;
const manifestacao_1 = require("../sefaz/manifestacao");
async function default_1(fastify) {
    fastify.post('/manifestacao', async (req, reply) => {
        const { cnpj, chave, tipoEvento } = req.body;
        if (!cnpj || !chave) {
            return reply.code(400).send({ error: 'CNPJ e Chave são obrigatórios' });
        }
        try {
            console.log(`[Manifestacao] Enviando evento ${tipoEvento || '210210'} para chave ${chave} (CNPJ ${cnpj})`);
            const result = await (0, manifestacao_1.enviarManifestacao)(cnpj, chave, tipoEvento); // Default 210210 interno
            return {
                success: result.cStat === '135' || result.cStat === '136', // 135: Vinculado, 136: Já registrado
                cStat: result.cStat,
                xMotivo: result.xMotivo,
                xml: result.xmlRetorno
            };
        }
        catch (err) {
            req.log.error(err);
            return reply.code(500).send({ error: err.message || String(err) });
        }
    });
}
