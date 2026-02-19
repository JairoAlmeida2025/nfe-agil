"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const fastify_1 = __importDefault(require("fastify"));
const dotenv_1 = __importDefault(require("dotenv"));
const distdfe_1 = __importDefault(require("./routes/distdfe"));
const manifestacao_1 = __importDefault(require("./routes/manifestacao"));
const status_1 = __importDefault(require("./routes/status"));
const health_1 = __importDefault(require("./routes/health"));
dotenv_1.default.config();
const server = (0, fastify_1.default)({ logger: true });
// ── Segurança: CORS e Auth ──────────────────────────────────────────────────
server.addHook('onRequest', async (req, reply) => {
    // CORS
    const allowedOrigin = process.env.ALLOWED_ORIGIN || '*';
    reply.header('Access-Control-Allow-Origin', allowedOrigin);
    reply.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    reply.header('Access-Control-Allow-Headers', 'Content-Type, x-fiscal-auth');
    if (req.method === 'OPTIONS') {
        return reply.send();
    }
    // Autenticação para rotas fiscais sensíveis (/sefaz/*)
    // Ignora /health e root
    const url = req.url;
    if (url.startsWith('/sefaz/') && !url.includes('/health') && !url.includes('/status')) {
        const secret = process.env.FISCAL_SECRET;
        if (secret) {
            const header = req.headers['x-fiscal-auth'];
            if (header !== secret) {
                server.log.warn(`Acesso negado de ${req.ip} para ${url}`);
                return reply.code(401).send({ error: 'Unauthorized' });
            }
        }
    }
});
// ── Rotas ────────────────────────────────────────────────────────────────────
server.get('/', async () => ({ status: 'online', service: 'sefaz-fiscal-service' }));
server.register(health_1.default);
server.register(distdfe_1.default, { prefix: '/sefaz' });
server.register(manifestacao_1.default, { prefix: '/sefaz' });
server.register(status_1.default, { prefix: '/sefaz' });
// ── Startup ──────────────────────────────────────────────────────────────────
const port = Number(process.env.PORT) || 80;
async function start() {
    try {
        console.log(`[Startup] PORT env: "${process.env.PORT}" → usando porta: ${port}`);
        console.log(`[Startup] NODE_ENV: ${process.env.NODE_ENV}`);
        console.log(`[Startup] FISCAL_SECRET definido: ${!!process.env.FISCAL_SECRET}`);
        console.log(`[Startup] ALLOWED_ORIGIN: ${process.env.ALLOWED_ORIGIN || '*'}`);
        console.log(`[Startup] PFX_PATH: ${process.env.PFX_PATH || '(não definido)'}`);
        const address = await server.listen({ port, host: '0.0.0.0' });
        console.log(`[Startup] ✅ Micro-serviço SEFAZ rodando em ${address}`);
    }
    catch (err) {
        console.error('[Startup] ❌ Falha ao iniciar servidor:', err);
    }
}
start();
