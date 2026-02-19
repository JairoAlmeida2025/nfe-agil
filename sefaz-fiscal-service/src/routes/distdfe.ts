import { FastifyInstance } from 'fastify'
import { callSefaz } from '../sefaz/client'
import { buildDistDFeEnvelope } from '../sefaz/envelope'
import { parseDistDFeResponse, DocDFe } from '../sefaz/parser'
// @ts-ignore
import forge from 'node-forge'

interface DistDFeBody {
    cnpj: string
    ultNSU: string
    pfxBase64: string
    passphrase: string
    ambiente?: 'producao' | 'homologacao'
}

export default async function (fastify: FastifyInstance) {
    fastify.post<{ Body: DistDFeBody }>('/distdfe', async (req, reply) => {
        const { cnpj, ultNSU: ultNSUInicial, pfxBase64, passphrase, ambiente } = req.body

        if (!cnpj || ultNSUInicial === undefined || !pfxBase64 || !passphrase) {
            return reply.code(400).send({ error: 'cnpj, ultNSU, pfxBase64 e passphrase são obrigatórios' })
        }

        const pfx = Buffer.from(pfxBase64, 'base64')

        console.log("----------------------------------------------------------------")
        console.log(`[PFX] Tamanho base64 recebido: ${pfxBase64.length}`)
        console.log(`[PFX] Buffer bytes decodificado: ${pfx.length}`)
        console.log(`[PFX] Passphrase length: ${passphrase?.length}`)
        console.log(`[PFX] Passphrase tipo: ${typeof passphrase}`)

        try {
            const p12Asn1 = forge.asn1.fromDer(
                forge.util.createBuffer(
                    pfx.toString('binary')
                )
            )
            // Tentar abrir com a senha. Se senha errada, lança exceção.
            forge.pkcs12.pkcs12FromAsn1(p12Asn1, passphrase)
            console.log("[PFX] ✅ Certificado aberto com sucesso via node-forge (Senha Correta)")
        } catch (err: any) {
            console.error("[PFX] ❌ ERRO CRÍTICO ao abrir PKCS12 (Senha Incorreta?):", err.message)
            return reply.code(400).send({ error: `Certificado/Senha inválidos: ${err.message}` })
        }

        console.log("----------------------------------------------------------------")

        let ultNSU = String(ultNSUInicial)
        const todosDocumentos: DocDFe[] = []
        let lastCStat = ''
        let lastXMotivo = ''
        let loopCount = 0
        const MAX_LOOPS = 50

        try {
            while (true) {
                loopCount++
                if (loopCount > MAX_LOOPS) break

                console.log(`[SEFAZ] Loop ${loopCount} | CNPJ: ${cnpj} | NSU: ${ultNSU}`)

                const envelope = buildDistDFeEnvelope(cnpj, ultNSU, ambiente)
                const xmlResponse = await callSefaz(envelope, pfx, passphrase)

                // Parse simplificado para ver status primeiro
                const parsed = parseDistDFeResponse(xmlResponse)

                lastCStat = parsed.cStat
                lastXMotivo = parsed.xMotivo

                // Se erro fatal, para
                if (parsed.cStat !== '137' && parsed.cStat !== '138') {
                    console.warn(`[SEFAZ] Parando por erro/status: ${parsed.cStat} - ${parsed.xMotivo}`)
                    break
                }

                // Adiciona docs
                if (parsed.documentos.length > 0) {
                    todosDocumentos.push(...parsed.documentos)
                }

                // Se 137 -> Acabou (Nenhum documento localizado para o NSU informado)
                if (parsed.cStat === '137') {
                    ultNSU = parsed.ultNSU // Atualiza final
                    break
                }

                // Se 138 -> Documento localizado (Tem mais)
                ultNSU = parsed.ultNSU
            }

            return {
                cStat: lastCStat,
                xMotivo: lastXMotivo,
                ultNSU, // O último NSU processado (para o cliente salvar)
                documentos: todosDocumentos
            }

        } catch (err: any) {
            req.log.error(err)
            return reply.code(500).send({ error: err.message || String(err) })
        }
    })
}
