/**
 * services/danfe.service.ts
 *
 * Serviço de conversão XML → DANFE PDF via API MeuDanfe.
 *
 * Referência: https://meudanfe.com.br/documentacao.php
 * Endpoint:   POST https://api.meudanfe.com.br/v2/fd/convert/xml-to-da
 * Headers:    Api-Key: <chave>  |  Content-Type: text/plain
 * Body:       XML puro (string)
 * Retorno:    JSON { data: "<base64 do PDF>" }
 *
 * Serverless-safe: somente fetch HTTP, sem filesystem, sem binários.
 * A chave é lida de process.env.MEUDANFE_API_KEY (nunca exposta ao browser).
 */

const MEUDANFE_URL = 'https://api.meudanfe.com.br/v2/fd/convert/xml-to-da'

export interface MeuDanfeResult {
    buffer: Buffer      // Buffer com o PDF gerado
    bytes: number       // Tamanho em bytes
}

/**
 * Converte um XML NF-e para PDF DANFE via API MeuDanfe.
 *
 * @param xmlContent - XML completo da NF-e (string)
 * @returns MeuDanfeResult com o Buffer do PDF
 * @throws Error com mensagem descritiva em caso de falha
 */
export async function converterXmlParaDanfe(xmlContent: string): Promise<MeuDanfeResult> {
    const apiKey = process.env.MEUDANFE_API_KEY
    if (!apiKey) {
        throw new Error('MEUDANFE_API_KEY não configurada no ambiente.')
    }

    if (!xmlContent || xmlContent.trim().length === 0) {
        throw new Error('XML vazio — não é possível gerar DANFE.')
    }

    console.log('[MeuDanfe] Enviando XML para conversão | tamanho:', xmlContent.length, 'chars')

    const response = await fetch(MEUDANFE_URL, {
        method: 'POST',
        headers: {
            'Api-Key': apiKey,
            'Content-Type': 'text/plain',
        },
        body: xmlContent,
    })

    if (!response.ok) {
        let detail = ''
        try {
            const errBody = await response.text()
            detail = errBody.slice(0, 300)
        } catch { /* ok */ }

        throw new Error(
            `MeuDanfe API retornou erro ${response.status}: ${detail || response.statusText}`
        )
    }

    // A resposta é JSON com campo "data" contendo o PDF em base64
    let body: { data?: string;[k: string]: unknown }
    try {
        body = await response.json()
    } catch (e) {
        throw new Error('MeuDanfe API retornou resposta não-JSON inesperada.')
    }

    if (!body.data || typeof body.data !== 'string') {
        throw new Error(`MeuDanfe API: campo "data" ausente na resposta. Keys: ${Object.keys(body).join(', ')}`)
    }

    const pdfBuffer = Buffer.from(body.data, 'base64')

    if (pdfBuffer.length < 100) {
        throw new Error(`MeuDanfe API: PDF gerado muito pequeno (${pdfBuffer.length} bytes) — possível erro.`)
    }

    console.log('[MeuDanfe] PDF gerado com sucesso | tamanho:', pdfBuffer.length, 'bytes')

    return {
        buffer: pdfBuffer,
        bytes: pdfBuffer.length,
    }
}
