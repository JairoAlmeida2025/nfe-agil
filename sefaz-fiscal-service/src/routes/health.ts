import { FastifyInstance } from 'fastify'

export default async function (fastify: FastifyInstance) {
    fastify.get('/health', async (req, reply) => {
        return { status: 'ok', timestamp: new Date().toISOString() }
    })
}
