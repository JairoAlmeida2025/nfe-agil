import { FastifyInstance } from 'fastify'
import { checkCertificateValidity } from '../sefaz/status'

export default async function (fastify: FastifyInstance) {
    fastify.get('/status', async (req, reply) => {
        try {
            const status = checkCertificateValidity()

            return {
                ...status,
                environment: 'production',
                sistema: 'NFe Agil Fiscal Service'
            }

        } catch (err: any) {
            req.log.error(err)
            return reply.code(500).send({ error: err.message || String(err) })
        }
    })
}
