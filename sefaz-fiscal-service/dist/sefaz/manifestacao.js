"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.enviarManifestacao = enviarManifestacao;
const signer_1 = require("./signer");
const client_1 = require("./client");
const fs_1 = __importDefault(require("fs"));
const ENDPOINT_EVENTO = 'https://www1.nfe.fazenda.sp.gov.br/RecepcaoEvento/RecepcaoEvento.asmx';
const SOAP_ACTION_EVENTO = 'http://www.portalfiscal.inf.br/nfe/wsdl/RecepcaoEvento/nfeRecepcaoEvento';
function getDhEvento() {
    // Retorna data atual no formato AAAA-MM-DDThh:mm:ss-03:00 (Brasília)
    // Ajuste simples para node
    const now = new Date();
    now.setHours(now.getHours() - 3); // Ajusta fuso (simples)
    return now.toISOString().slice(0, 19) + '-03:00';
}
async function enviarManifestacao(cnpj, chave, tipoEvento = '210210') {
    const idLote = '1';
    const seqEvento = '1';
    const nSeqEvento = '1';
    const verEvento = '1.00';
    const id = `ID${tipoEvento}${chave}0${seqEvento}`;
    const dhEvento = getDhEvento();
    // XML do Evento (que será assinado)
    const xmlEvento = `<evento xmlns="http://www.portalfiscal.inf.br/nfe" versao="${verEvento}">
<infEvento Id="${id}">
<cOrgao>91</cOrgao>
<tpAmb>1</tpAmb>
<CNPJ>${cnpj}</CNPJ>
<chNFe>${chave}</chNFe>
<dhEvento>${dhEvento}</dhEvento>
<tpEvento>${tipoEvento}</tpEvento>
<nSeqEvento>${nSeqEvento}</nSeqEvento>
<verEvento>${verEvento}</verEvento>
<detEvento version="${verEvento}">
<descEvento>Ciencia da Operacao</descEvento>
</detEvento>
</infEvento>
</evento>`;
    // Assinar
    if (!process.env.PFX_PATH || !process.env.PFX_PASSWORD)
        throw new Error('Credenciais PFX faltando');
    const pfx = fs_1.default.readFileSync(process.env.PFX_PATH);
    // A função assinarXML retorna o XML COM a assinatura INSERIDA
    // Mas xml-crypto assina e insere. O template DEVE ter o local da assinatura?
    // Não, xml-crypto insere <Signature> após o último elemento referenciado ou no root?
    // Com signedXml.computeSignature(xml), ele calcula.
    // Com signedXml.getSignedXml(), ele retorna o XML completo com a assinatura.
    // O xml-crypto por padrão insere Signature como *último filho* do root element.
    // Sefaz espera Signature DENTRO de <evento>, DEPOIS de <infEvento>.
    // Como <infEvento> é filho de <evento> e é o único, Signature ficará depois dele. OK.
    let xmlAssinado = '';
    try {
        xmlAssinado = (0, signer_1.assinarXML)(xmlEvento, id, pfx, process.env.PFX_PASSWORD);
    }
    catch (e) {
        console.error('Erro na assinatura digital:', e);
        throw new Error(`Falha ao assinar evento: ${e}`);
    }
    // Envelope de Envio (envEvento)
    const xmlEnvio = `<?xml version="1.0" encoding="utf-8"?>
<soap12:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap12="http://www.w3.org/2003/05/soap-envelope">
<soap12:Body>
<nfeRecepcaoEvento xmlns="http://www.portalfiscal.inf.br/nfe/wsdl/RecepcaoEvento">
<nfeDadosMsg>
<envEvento xmlns="http://www.portalfiscal.inf.br/nfe" versao="1.00">
<idLote>${idLote}</idLote>
${xmlAssinado}
</envEvento>
</nfeDadosMsg>
</nfeRecepcaoEvento>
</soap12:Body>
</soap12:Envelope>`;
    // Enviar
    const xmlRetorno = await (0, client_1.callSefaz)(xmlEnvio, ENDPOINT_EVENTO, SOAP_ACTION_EVENTO);
    // Parse Resposta Simplificado (Regex)
    // <cStat>135</cStat>
    const matchStat = xmlRetorno.match(/<cStat>(\d+)<\/cStat>/) || [];
    const matchMotivo = xmlRetorno.match(/<xMotivo>([^<]+)<\/xMotivo>/) || [];
    const cStat = matchStat[1] || '';
    const xMotivo = matchMotivo[1] || '';
    return { cStat, xMotivo, xmlRetorno };
}
