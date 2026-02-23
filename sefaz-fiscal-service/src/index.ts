import Fastify, { FastifyInstance } from 'fastify'
import dotenv from 'dotenv'
import distdfeRoute from './routes/distdfe'
import manifestacaoRoute from './routes/manifestacao'
import statusRoute from './routes/status'
import healthRoute from './routes/health'

dotenv.config()

const server: FastifyInstance = Fastify({ logger: true })

// ── Segurança: CORS, Auth e Headers ──────────────────────────────────────────

server.addHook('onRequest', async (req, reply) => {
    // CORS — SECURITY: nunca usar '*' em produção com dados sensíveis
    const allowedOrigin = process.env.ALLOWED_ORIGIN
    if (!allowedOrigin) {
        console.warn('[SECURITY] ⚠️  ALLOWED_ORIGIN não definido. Configure em produção!')
    }

    // Validar origem da requisição
    const requestOrigin = req.headers.origin
    if (allowedOrigin && requestOrigin && requestOrigin !== allowedOrigin) {
        console.warn(`[SECURITY] Origem bloqueada: "${requestOrigin}" (esperado: "${allowedOrigin}")`)
        return reply.code(403).send({ error: 'Origin not allowed' })
    }

    reply.header('Access-Control-Allow-Origin', allowedOrigin || '*')
    reply.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
    reply.header('Access-Control-Allow-Headers', 'Content-Type, x-fiscal-secret')
    // Headers de segurança adicionais
    reply.header('X-Content-Type-Options', 'nosniff')
    reply.header('X-Frame-Options', 'DENY')

    if (req.method === 'OPTIONS') {
        return reply.send()
    }

    // Autenticação para rotas fiscais sensíveis (/sefaz/*)
    const url = req.url
    if (url.startsWith('/sefaz/') && !url.includes('/health') && !url.includes('/status')) {
        const secret = process.env.FISCAL_SECRET

        if (!secret) {
            // SECURITY: Sem secret configurado é crítico — bloquear
            console.error('[SECURITY] 🚨 FISCAL_SECRET não definido! Bloqueando acesso às rotas /sefaz/*')
            return reply.code(503).send({ error: 'Service not configured' })
        }

        const header = req.headers['x-fiscal-secret']
        // SECURITY: Nunca logar o valor do secret — apenas status
        console.log(`[Auth] Validação para ${url} | Header presente: ${!!header}`)

        if (header !== secret) {
            server.log.warn(`[SECURITY] Acesso negado de ${req.ip} para ${url}`)
            return reply.code(401).send({ error: 'Unauthorized' })
        }
    }
})

// ── Rotas ─────────────────────────────────────────────────────────────────────

server.get('/', async () => ({ status: 'online', service: 'sefaz-fiscal-service' }))

server.register(healthRoute)
server.register(distdfeRoute, { prefix: '/sefaz' })
server.register(manifestacaoRoute, { prefix: '/sefaz' })
server.register(statusRoute, { prefix: '/sefaz' })

// ── Startup ───────────────────────────────────────────────────────────────────

const port = Number(process.env.PORT) || 80

async function start() {
    try {
        console.log("🚀 Micro-serviço SEFAZ v3.8 – (SOAP 1.2 MDe Header Omission FIX)")
        console.log(`[Startup] PORT: ${port} | NODE_ENV: ${process.env.NODE_ENV}`)
        console.log(`[Startup] FISCAL_SECRET configurado: ${!!process.env.FISCAL_SECRET}`)
        console.log(`[Startup] ALLOWED_ORIGIN: ${process.env.ALLOWED_ORIGIN || '⚠️ NÃO DEFINIDO'}`)

        const address = await server.listen({ port, host: '0.0.0.0' })
        console.log(`[Startup] ✅ Micro-serviço SEFAZ rodando em ${address}`)
    } catch (err) {
        console.error('[Startup] ❌ Falha ao iniciar servidor:', err)
        process.exit(1)
    }
}

start()
