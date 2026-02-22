import { assinarXML } from './signer'
import { callSefaz } from './client'
import fs from 'fs'

// Endpoint Nacional de Recepção de Evento (Destinada)
const ENDPOINT_EVENTO = 'https://www1.nfe.fazenda.gov.br/NFeRecepcaoEvento4/NFeRecepcaoEvento4.asmx'
// O WCF da SEFAZ para NFeRecepcaoEvento4 exige o Action exato terminando sem 'nfeRecepcaoEvento'
// Em ambientes Nacionais, para Evento a Action é literalmente o namespace base
const SOAP_ACTION_EVENTO = 'http://www.portalfiscal.inf.br/nfe/wsdl/NFeRecepcaoEvento4/nfeRecepcaoEvento'

function getDhEvento() {
  // Retorna data atual no formato AAAA-MM-DDThh:mm:ss-03:00 (Brasília)
  // Ajuste simples para node
  const now = new Date()
  now.setHours(now.getHours() - 3) // Ajusta fuso (simples)
  return now.toISOString().slice(0, 19) + '-03:00'
}

export async function enviarManifestacao(cnpj: string, chave: string, pfx: Buffer, passphrase: string, tipoEvento: string = '210210'): Promise<{ cStat: string, xMotivo: string, xmlRetorno: string }> {
  const idLote = '1'
  const seqEvento = '1'
  const nSeqEvento = '1'
  const verEvento = '1.00'
  const id = `ID${tipoEvento}${chave}0${seqEvento}`
  const dhEvento = getDhEvento()

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
</evento>`

  // Assinar
  if (!pfx || !passphrase) throw new Error('Credenciais PFX faltando')

  let xmlAssinado = ''
  try {
    xmlAssinado = assinarXML(xmlEvento, id, pfx, passphrase)
  } catch (e) {
    console.error('Erro na assinatura digital: e')
    throw new Error(`Falha ao assinar evento: ${String(e)}`)
  }

  // Envelope de Envio (envEvento) - Migrado para SOAP 1.1 para evitar bugs de leitura do WCF Nacional na injeção do header content-type action
  const xmlEnvio = `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>
    <nfeRecepcaoEvento xmlns="http://www.portalfiscal.inf.br/nfe/wsdl/NFeRecepcaoEvento4">
      <nfeDadosMsg>
        <envEvento xmlns="http://www.portalfiscal.inf.br/nfe" versao="1.00">
          <idLote>${idLote}</idLote>
          ${xmlAssinado}
        </envEvento>
      </nfeDadosMsg>
    </nfeRecepcaoEvento>
  </soap:Body>
</soap:Envelope>`

  // Enviar (passando credenciais)
  const xmlRetorno = await callSefaz(xmlEnvio, pfx, passphrase, ENDPOINT_EVENTO, SOAP_ACTION_EVENTO)

  // Parse Resposta Simplificado (Regex)
  const matchStat = xmlRetorno.match(/<cStat>(\d+)<\/cStat>/) || []
  const matchMotivo = xmlRetorno.match(/<xMotivo>([^<]+)<\/xMotivo>/) || []

  const cStat = matchStat[1] || ''
  const xMotivo = matchMotivo[1] || ''

  return { cStat, xMotivo, xmlRetorno }
}
