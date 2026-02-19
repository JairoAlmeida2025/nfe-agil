"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseDistDFeResponse = parseDistDFeResponse;
const zlib_1 = require("zlib");
function extrairTag(xml, tag) {
    const match = xml.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`));
    return match?.[1]?.trim() ?? '';
}
function parseDistDFeResponse(xmlResponse) {
    const cStat = extrairTag(xmlResponse, 'cStat');
    const xMotivo = extrairTag(xmlResponse, 'xMotivo');
    const ultNSU = extrairTag(xmlResponse, 'ultNSU');
    const maxNSU = extrairTag(xmlResponse, 'maxNSU');
    const documentos = [];
    // Regex para docZip
    const docZipRegex = /<docZip[^>]*NSU="(\d+)"[^>]*schema="([^"]+)"[^>]*>([^<]+)<\/docZip>/g;
    let match;
    while ((match = docZipRegex.exec(xmlResponse)) !== null) {
        const nsu = match[1];
        const schema = match[2];
        const conteudoBase64 = match[3];
        try {
            const buffer = Buffer.from(conteudoBase64, 'base64');
            const xmlConteudo = (0, zlib_1.gunzipSync)(buffer).toString('utf-8');
            documentos.push({
                nsu,
                schema,
                xml: xmlConteudo
            });
        }
        catch (e) {
            console.error(`Erro unzip NSU ${nsu}:`, e);
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
    };
}
