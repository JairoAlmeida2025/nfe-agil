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
    const allowedOrigin = process.env.ALLOWED_ORIGIN || '*' // Em produção, defina ALLOWED_ORIGIN=https://seu-app-vercel.app
    reply.header('Access-Control-Allow-Origin', allowedOrigin)
    reply.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
    reply.header('Access-Control-Allow-Headers', 'Content-Type, x-fiscal-auth')

    if (req.method === 'OPTIONS') {
        return reply.send()
    }

    // Autenticação para rotas fiscais sensíveis (/sefaz/*)
    // Ignora /health e root
    const url = req.url
    if (url.startsWith('/sefaz/') && !url.includes('/health') && !url.includes('/status')) {
        // Status pode ser público para monitoramento simples, mas idealmente protegido.
        // Vou proteger tudo exceto /health.
        const secret = process.env.FISCAL_SECRET
        if (secret) {
            const header = req.headers['x-fiscal-auth']
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
server.register(statusRoute, { prefix: '/sefaz' }) // Protegido pelo hook acima se configurado FISCAL_SECRET

const port = Number(process.env.PORT) || 3001

server.listen({ port, host: '0.0.0.0' }, (err, address) => {
    if (err) {
        server.log.error(err)
        process.exit(1)
    }
    console.log(`Micro-serviço SEFAZ rodando em ${address}`)
})
