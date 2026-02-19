import { NextResponse } from 'next/server'
import { buildSefazAgent } from '@/actions/certificate'
import { getOwnerUserId } from '@/lib/get-owner-id'

export async function GET() {
    try {
        const userId = await getOwnerUserId()
        if (!userId) {
            return NextResponse.json({ error: 'Não autenticado (owner)' }, { status: 401 })
        }

        console.log('[Debug] Iniciando teste de conexão Sefaz...')

        // 1. Construir Agente
        let agent
        try {
            agent = await buildSefazAgent(userId)
            console.log('[Debug] Agente construído com sucesso.')
        } catch (e: any) {
            console.error('[Debug] Erro ao construir agente:', e)
            return NextResponse.json({ step: 'buildAgent', error: e.message, stack: e.stack }, { status: 500 })
        }

        // 2. Tentar conexão simples (GET na raiz ou NfeStatusServico)
        // NfeDistribuicaoDfe só aceita POST, mas se fizermos GET deve retornar 405 ou 500, não 403 se o SSL estiver OK.
        // Ou melhor, vamos tentar conectar no WSDL que é público mas requer SSL.
        // Endpoint: https://www.nfe.fazenda.gov.br/NFeDistribuicaoDFe/NFeDistribuicaoDFe.asmx?wsdl

        const url = 'https://www.nfe.fazenda.gov.br/NFeDistribuicaoDFe/NFeDistribuicaoDFe.asmx?wsdl'

        console.log(`[Debug] Tentando fetch em ${url}`)

        const start = Date.now()
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

            return NextResponse.json({
                success: true,
                status: response.status,
                statusText: response.statusText,
                headers: Object.fromEntries(response.headers.entries()),
                bodyPreview: text.substring(0, 500),
                duration
            })

        } catch (fetchError: any) {
            console.error('[Debug] Erro no fetch:', fetchError)
            return NextResponse.json({
                step: 'fetch',
                error: fetchError.message,
                code: fetchError.code,
                cause: fetchError.cause,
                stack: fetchError.stack
            }, { status: 500 })
        }

    } catch (e: any) {
        return NextResponse.json({ error: 'Erro geral', details: e.message }, { status: 500 })
    }
}
