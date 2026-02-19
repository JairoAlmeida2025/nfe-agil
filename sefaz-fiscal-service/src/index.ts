import Fastify, { FastifyInstance } from 'fastify'
import dotenv from 'dotenv'
import distdfeRoute from './routes/distdfe'
import manifestacaoRoute from './routes/manifestacao'
import statusRoute from './routes/status'
import healthRoute from './routes/health'

dotenv.config()

const server: FastifyInstance = Fastify({ logger: true })

// ── Segurança: CORS e Auth ──────────────────────────────────────────────────

server.addHook('onRequest', async (req, reply) => {
    // CORS
    const allowedOrigin = process.env.ALLOWED_ORIGIN || '*'
    reply.header('Access-Control-Allow-Origin', allowedOrigin)
    reply.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
    reply.header('Access-Control-Allow-Headers', 'Content-Type, x-fiscal-secret')

    if (req.method === 'OPTIONS') {
        return reply.send()
    }

    // Autenticação para rotas fiscais sensíveis (/sefaz/*)
    // Ignora /health e root
    const url = req.url
    if (url.startsWith('/sefaz/') && !url.includes('/health') && !url.includes('/status')) {
        const secret = process.env.FISCAL_SECRET
        if (secret) {
            const header = req.headers['x-fiscal-secret']

            console.log("----------------------------------------------------------------")
            console.log(`[Auth] Validação para ${url}`)
            console.log(`[Auth] Header x-fiscal-secret recebido: "${header}"`)
            console.log(`[Auth] Secret esperado (env): "${secret ? secret.substring(0, 5) + '...' : 'UNDEFINED'}"`) // Masked for safety in logs, unmasked if safe environment
            // console.log(`[Auth] Secret esperado (FULL): "${secret}"`) // Uncomment if desperate
            console.log("----------------------------------------------------------------")

            if (header !== secret) {
                server.log.warn(`Acesso negado de ${req.ip} para ${url}`)
                return reply.code(401).send({ error: 'Unauthorized' })
            }
        }
    }
})

// ── Rotas ────────────────────────────────────────────────────────────────────

server.get('/', async () => ({ status: 'online', service: 'sefaz-fiscal-service' }))

server.register(healthRoute)
server.register(distdfeRoute, { prefix: '/sefaz' })
server.register(manifestacaoRoute, { prefix: '/sefaz' })
server.register(statusRoute, { prefix: '/sefaz' })

// ── Startup ──────────────────────────────────────────────────────────────────

const port = Number(process.env.PORT) || 80

async function start() {
    try {
        console.log("🚀 Micro-serviço SEFAZ v3.1 – Fix Endpoint Nacional (AN)")
        console.log(`[Startup] PORT env: "${process.env.PORT}" → usando porta: ${port}`)
        console.log(`[Startup] NODE_ENV: ${process.env.NODE_ENV}`)
        console.log(`[Startup] FISCAL_SECRET definido: ${!!process.env.FISCAL_SECRET}`)
        console.log(`[Startup] ALLOWED_ORIGIN: ${process.env.ALLOWED_ORIGIN || '*'}`)
        console.log(`[Startup] PFX_PATH: ${process.env.PFX_PATH || '(não definido)'}`)

        const address = await server.listen({ port, host: '0.0.0.0' })
        console.log(`[Startup] ✅ Micro-serviço SEFAZ rodando em ${address}`)
    } catch (err) {
        console.error('[Startup] ❌ Falha ao iniciar servidor:', err)
    }
}

start()
