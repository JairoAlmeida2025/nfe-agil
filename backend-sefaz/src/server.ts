import Fastify from 'fastify'
import { executarSync } from './sefaz'

const server = Fastify({ logger: true })

server.get('/ping', async (request, reply) => {
    return { status: 'ok', time: new Date().toISOString() }
})

interface SyncBody {
    user_id: string
    cnpj: string
}

server.post<{ Body: SyncBody }>('/nfe/sync', async (request, reply) => {
    const { user_id, cnpj } = request.body
    if (!user_id || !cnpj) {
        return reply.code(400).send({ error: 'user_id e cnpj obrigatórios' })
    }
    try {
        request.log.info(`[API] Sync solicitada: user=${user_id}, cnpj=${cnpj}`)
        const result = await executarSync(user_id, cnpj)
        return result
    } catch (err: any) {
        request.log.error(err)
        return reply.code(500).send({ error: err.message || String(err) })
    }
})

const start = async () => {
    try {
        const port = parseInt(process.env.PORT || '3001')
        await server.listen({ port, host: '0.0.0.0' })
        console.log(`Server listening on ${port}`)
    } catch (err) {
        server.log.error(err)
        process.exit(1)
    }
}

start()
