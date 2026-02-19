import Fastify, { FastifyInstance } from 'fastify'
import dotenv from 'dotenv'
import distdfeRoute from './routes/distdfe'
import manifestacaoRoute from './routes/manifestacao'
import statusRoute from './routes/status'
import healthRoute from './routes/health'

dotenv.config()

const server: FastifyInstance = Fastify({ logger: true })

// Configuração CORS Manual para Diagnóstico
server.addHook('onRequest', async (req, reply) => {
    reply.header('Access-Control-Allow-Origin', '*')
    reply.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PATCH, PUT, DELETE')
    reply.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With')
})

// Rota de Diagnóstico Pública
server.get('/', async () => ({ status: 'online', service: 'sefaz-fiscal-service' }))

server.register(healthRoute)
server.register(distdfeRoute, { prefix: '/sefaz' })
server.register(manifestacaoRoute, { prefix: '/sefaz' })
server.register(statusRoute, { prefix: '/sefaz' })

const port = Number(process.env.PORT) || 3001

server.listen({ port, host: '0.0.0.0' }, (err, address) => {
    if (err) {
        server.log.error(err)
        process.exit(1)
    }
    console.log(`Micro-serviço SEFAZ rodando em ${address}`)
})
