import { NextResponse } from 'next/server'
import { buildSefazAgent } from '@/actions/certificate'
import { getOwnerUserId } from '@/lib/get-owner-id'
import forge from 'node-forge'
import https from 'https'

export async function GET() {
    try {
        const userId = await getOwnerUserId()
        if (!userId) {
            return NextResponse.json({ error: 'Não autenticado (owner)' }, { status: 401 })
        }

        console.log('[Debug] Iniciando teste de conexão Sefaz...')

        let agent: https.Agent
        let certDetails: any[] = []

        try {
            agent = await buildSefazAgent(userId)
            console.log('[Debug] Agente construído com sucesso.')

            const opts = agent.options as any
            if (opts.pfx && opts.passphrase) {
                const pfxBuffer = Buffer.isBuffer(opts.pfx) ? opts.pfx : Buffer.from(opts.pfx)
                const pfxDer = forge.util.createBuffer(pfxBuffer.toString('binary'))
                const pfxAsn1 = forge.asn1.fromDer(pfxDer)
                const pfx = forge.pkcs12.pkcs12FromAsn1(pfxAsn1, false, opts.passphrase)

                const bags = pfx.getBags({ bagType: forge.pki.oids.certBag })
                const certBags = bags[forge.pki.oids.certBag]

                if (certBags) {
                    certDetails = certBags.map((bag: any) => {
                        const cert = bag.cert!
                        return {
                            subject: cert.subject.attributes.map((a: any) => `${a.shortName || a.name}=${a.value}`).join(', '),
                            issuer: cert.issuer.attributes.map((a: any) => `${a.shortName || a.name}=${a.value}`).join(', '),
                            validity: cert.validity,
                            serialNumber: cert.serialNumber
                        }
                    })
                }
            }

        } catch (e: any) {
            console.error('[Debug] Erro ao construir/inspecionar agente:', e)
            return NextResponse.json({ step: 'buildAgent', error: e.message, stack: e.stack }, { status: 500 })
        }

        const url = 'https://www.nfe.fazenda.gov.br/NFeDistribuicaoDFe/NFeDistribuicaoDFe.asmx?wsdl'

        console.log(`[Debug] Tentando fetch em ${url}`)

        const start = Date.now()
        let fetchResult = {} as any

        try {
            const response = await fetch(url, {
                method: 'GET',
                // @ts-expect-error Node fetch agent
                agent: agent,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (compatible; NfeAgil/1.0)',
                }
            })
            const duration = Date.now() - start

            console.log(`[Debug] Resposta recebida: ${response.status} em ${duration}ms`)

            const text = await response.text()

            fetchResult = {
                success: true,
                status: response.status,
                statusText: response.statusText,
                headers: Object.fromEntries(response.headers.entries()),
                bodyPreview: text.substring(0, 500),
                duration
            }

        } catch (fetchError: any) {
            console.error('[Debug] Erro no fetch:', fetchError)
            fetchResult = {
                success: false,
                error: fetchError.message,
                code: fetchError.code,
                cause: fetchError.cause
            }
        }

        return NextResponse.json({
            certificates: certDetails,
            connection: fetchResult
        })

    } catch (e: any) {
        return NextResponse.json({ error: 'Erro geral', details: e.message }, { status: 500 })
    }
}
