import { FastifyInstance } from 'fastify'
import { enviarManifestacao } from '../sefaz/manifestacao'

interface ManifestacaoBody {
    cnpj: string
    chave: string
    tipoEvento?: string
}

export default async function (fastify: FastifyInstance) {
    fastify.post<{ Body: ManifestacaoBody }>('/manifestacao', async (req, reply) => {
        const { cnpj, chave, tipoEvento } = req.body

        if (!cnpj || !chave) {
            return reply.code(400).send({ error: 'CNPJ e Chave são obrigatórios' })
        }

        try {
            console.log(`[Manifestacao] Enviando evento ${tipoEvento || '210210'} para chave ${chave} (CNPJ ${cnpj})`)
            const result = await enviarManifestacao(cnpj, chave, tipoEvento) // Default 210210 interno

            return {
                success: result.cStat === '135' || result.cStat === '136', // 135: Vinculado, 136: Já registrado
                cStat: result.cStat,
                xMotivo: result.xMotivo,
                xml: result.xmlRetorno
            }

        } catch (err: any) {
            req.log.error(err)
            return reply.code(500).send({ error: err.message || String(err) })
        }
    })
}
