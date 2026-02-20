/**
 * lib/danfe/barcode.ts
 *
 * Gera o código de barras Code128 da chave de acesso da NF-e.
 * Usa bwip-js (serverless-safe, puro JavaScript, sem binários).
 *
 * Retorna um Buffer PNG que pode ser embutido direto no PDFKit via doc.image().
 */

// bwip-js é importado dinamicamente para compatibilidade com Turbopack/ESM
// eslint-disable-next-line @typescript-eslint/no-require-imports
const bwipjs = require('bwip-js')

/**
 * Gera um PNG do código de barras Code128 a partir da chave de acesso (44 dígitos).
 * @param chave - Chave de acesso da NF-e (44 dígitos, sem espaços/formatação)
 * @param widthPx - Largura em pixels do código de barras (padrão: 420)
 * @param heightPx - Altura em pixels (padrão: 40)
 * @returns Buffer PNG
 */
export async function gerarCodigoBarras(
    chave: string,
    widthPx = 420,
    heightPx = 40,
): Promise<Buffer> {
    // Remove qualquer espaço ou formatação
    const chaveClean = chave.replace(/\s/g, '').slice(0, 44)

    if (chaveClean.length !== 44) {
        throw new Error(`Chave de acesso inválida: esperado 44 dígitos, recebido ${chaveClean.length}`)
    }

    const png: Buffer = await bwipjs.toBuffer({
        bcid: 'code128',          // Code128 (padrão DANFE)
        text: chaveClean,
        scale: 2,
        height: 10,              // Altura em módulos
        width: widthPx,
        includetext: false,      // Não incluir texto — exibimos separado
        textxalign: 'center',
        backgroundcolor: 'ffffff',
        barcolor: '000000',
        padding: 0,
    })

    return png
}

/**
 * Formata a chave de acesso em grupos de 4 dígitos para exibição.
 * Exemplo: "3521..." → "3521 0215 ..."
 */
export function formatarChave(chave: string): string {
    const clean = chave.replace(/\s/g, '')
    return clean.match(/.{1,4}/g)?.join(' ') ?? clean
}
