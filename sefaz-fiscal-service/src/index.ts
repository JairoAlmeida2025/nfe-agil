import Fastify, { FastifyInstance } from 'fastify'
import dotenv from 'dotenv'
import distdfeRoute from './routes/distdfe'

dotenv.config()

const server: FastifyInstance = Fastify({ logger: true })

server.register(distdfeRoute, { prefix: '/sefaz' })

const port = Number(process.env.PORT) || 3001

server.listen({ port, host: '0.0.0.0' }, (err, address) => {
    if (err) {
        server.log.error(err)
        process.exit(1)
    }
    console.log(`Micro-serviço SEFAZ rodando em ${address}`)
})
