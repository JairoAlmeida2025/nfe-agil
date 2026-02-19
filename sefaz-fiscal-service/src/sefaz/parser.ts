import { gunzipSync } from 'zlib'

function extrairTag(xml: string, tag: string): string {
    const match = xml.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`))
    return match?.[1]?.trim() ?? ''
}

export interface DocDFe {
    nsu: string
    schema: string
    xml: string // Base64 decoded + Gunzip decompressed
}

export interface DistDFeResponse {
    cStat: string
    xMotivo: string
    ultNSU: string
    maxNSU: string
    documentos: DocDFe[]
}

export function parseDistDFeResponse(xmlResponse: string): DistDFeResponse {
    const cStat = extrairTag(xmlResponse, 'cStat')
    const xMotivo = extrairTag(xmlResponse, 'xMotivo')
    const ultNSU = extrairTag(xmlResponse, 'ultNSU')
    const maxNSU = extrairTag(xmlResponse, 'maxNSU')

    const documentos: DocDFe[] = []

    // Regex para docZip
    const docZipRegex = /<docZip[^>]*NSU="(\d+)"[^>]*schema="([^"]+)"[^>]*>([^<]+)<\/docZip>/g
    let match: RegExpExecArray | null

    while ((match = docZipRegex.exec(xmlResponse)) !== null) {
        const nsu = match[1]
        const schema = match[2]
        const conteudoBase64 = match[3]

        try {
            const buffer = Buffer.from(conteudoBase64, 'base64')
            const xmlConteudo = gunzipSync(buffer).toString('utf-8')

            documentos.push({
                nsu,
                schema,
                xml: xmlConteudo
            })
        } catch (e) {
            console.error(`Erro unzip NSU ${nsu}:`, e)
            // Se falhar unzip, retorna base64 ou ignora?
            // Vamos ignorar docs corrompidos para não travar o fluxo
        }
    }

    return {
        cStat,
        xMotivo,
        ultNSU,
        maxNSU,
        documentos
    }
}
