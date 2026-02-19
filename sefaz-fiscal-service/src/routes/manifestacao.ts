import { FastifyInstance } from 'fastify'
import { enviarManifestacao } from '../sefaz/manifestacao'

interface ManifestacaoBody {
    cnpj: string
    chave: string
    tipoEvento?: string
    pfxBase64: string
    passphrase: string
}

export default async function (fastify: FastifyInstance) {
    fastify.post<{ Body: ManifestacaoBody }>('/manifestacao', async (req, reply) => {
        const { cnpj, chave, tipoEvento, pfxBase64, passphrase } = req.body

        if (!cnpj || !chave || !pfxBase64 || !passphrase) {
            return reply.code(400).send({ error: 'CNPJ, Chave, pfxBase64 e passphrase são obrigatórios' })
        }

        const pfx = Buffer.from(pfxBase64, 'base64')

        try {
            console.log(`[Manifestacao] Enviando evento ${tipoEvento || '210210'} para chave ${chave} (CNPJ ${cnpj})`)
            const result = await enviarManifestacao(cnpj, chave, pfx, passphrase, tipoEvento) // Default 210210 interno

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
