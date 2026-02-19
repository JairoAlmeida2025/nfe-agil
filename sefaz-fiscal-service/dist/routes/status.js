"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = default_1;
const status_1 = require("../sefaz/status");
async function default_1(fastify) {
    fastify.get('/status', async (req, reply) => {
        try {
            const status = (0, status_1.checkCertificateValidity)();
            return {
                ...status,
                environment: 'production',
                sistema: 'NFe Agil Fiscal Service'
            };
        }
        catch (err) {
            req.log.error(err);
            return reply.code(500).send({ error: err.message || String(err) });
        }
    });
}
