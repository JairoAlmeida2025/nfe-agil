import { FastifyInstance } from 'fastify'
import { checkCertificateValidity } from '../sefaz/status'

export default async function (fastify: FastifyInstance) {
    fastify.get('/status', async (req, reply) => {
        try {
            const status = checkCertificateValidity()

            // Retorna valid: boolean
            // Se expirado, valid=false. HTTP 200 é OK (serviço respondeu).
            return status

        } catch (err: any) {
            req.log.error(err)
            return reply.code(500).send({ error: err.message || String(err) })
        }
    })
}
