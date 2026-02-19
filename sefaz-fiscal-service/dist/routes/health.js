"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = default_1;
async function default_1(fastify) {
    fastify.get('/health', async (req, reply) => {
        return {
            status: 'ok',
            service: 'sefaz-fiscal-service',
            uptime: process.uptime(),
            timestamp: new Date().toISOString()
        };
    });
}
