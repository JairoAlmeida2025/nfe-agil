import https from 'https'
import { gunzipSync } from 'zlib'
import { decrypt } from './crypto'
import { supabaseAdmin } from './database'

// ── Endpoints e Config ────────────────────────────────────────────────────────

// SP Produção - DistDFe (www1.nfe.fazenda.sp.gov.br pode ser necessário)
// Confirmação: https://www.nfe.fazenda.gov.br/portal/webServices.aspx?tipoConteudo=Wak0FwB8dKs= (Lista SP: NFeDistribuicaoDFe)
const ENDPOINT_SP_PRODUCAO = 'https://www1.nfe.fazenda.sp.gov.br/NFeDistribuicaoDFe/NFeDistribuicaoDFe.asmx'
const SOAP_ACTION = 'http://www.portalfiscal.inf.br/nfe/wsdl/NFeDistribuicaoDFe/nfeDistDFeInteresse'

// ── Helpers ───────────────────────────────────────────────────────────────────

function buildDistDFeEnvelope(cnpj: string, ultNSU: number, cUF: string = '35'): string {
    const nsuFormatado = String(ultNSU).padStart(15, '0')

    return `<?xml version="1.0" encoding="utf-8"?>
<soap12:Envelope
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xmlns:xsd="http://www.w3.org/2001/XMLSchema"
  xmlns:soap12="http://www.w3.org/2003/05/soap-envelope">
  <soap12:Body>
    <nfeDistDFeInteresse xmlns="http://www.portalfiscal.inf.br/nfe/wsdl/NFeDistribuicaoDFe">
      <nfeDadosMsg>
        <distDFeInt versao="1.01" xmlns="http://www.portalfiscal.inf.br/nfe">
          <tpAmb>1</tpAmb>
          <cUFAutor>${cUF}</cUFAutor>
          <CNPJ>${cnpj}</CNPJ>
          <distNSU>
            <ultNSU>${nsuFormatado}</ultNSU>
          </distNSU>
        </distDFeInt>
      </nfeDadosMsg>
    </nfeDistDFeInteresse>
  </soap12:Body>
</soap12:Envelope>`
}

function extrairTag(xml: string, tag: string): string {
    const match = xml.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`))
    return match?.[1]?.trim() ?? ''
}

function extrairAttr(xml: string, tag: string, attr: string): string {
    const match = xml.match(new RegExp(`<${tag}[^>]*${attr}="([^"]*)"[^>]*>`))
    return match?.[1] ?? ''
}

// ── Agent e Conexão HTTPS Pura ────────────────────────────────────────────────

// Helper para obter arquivo blob como buffer
async function getFileBuffer(bucket: string, path: string): Promise<Buffer> {
    const { data, error } = await supabaseAdmin.storage.from(bucket).download(path)
    if (error || !data) throw new Error(`Erro download storage: ${path}`)
    return Buffer.from(await data.arrayBuffer())
}

async function buildSefazAgent(cnpj: string): Promise<https.Agent> {
    // Buscar certificado no banco
    const { data: cert } = await supabaseAdmin
        .from('certificados')
        .select('*')
        .eq('status', 'ativo')
        .eq('empresa_cnpj', cnpj) // Assumindo relação direta ou precisa filtrar por user?
        // Aqui assumimos que o backend valida a permissão antes de chamar.
        // Vamos buscar pelo CNPJ para simplificar o backend.
        .limit(1)
        .single()

    if (!cert) throw new Error(`Nenhum certificado ativo para CNPJ ${cnpj}`)
    if (!cert.senha_cifrada) throw new Error('Senha do certificado não encontrada.')

    const pfxBuffer = await getFileBuffer('certificados', cert.arquivo_path)
    const password = decrypt(cert.senha_cifrada)

    return new https.Agent({
        pfx: pfxBuffer,
        passphrase: password,
        rejectUnauthorized: true, // Aqui no backend dedicado PODEMOS E DEVEMOS ser strict
        minVersion: 'TLSv1.2',
        maxVersion: 'TLSv1.3',
        keepAlive: true
    })
}

// ── Chamada HTTPS Nativa ──────────────────────────────────────────────────────

async function requestSefaz(envelope: string, agent: https.Agent): Promise<string> {
    return new Promise((resolve, reject) => {
        const url = new URL(ENDPOINT_SP_PRODUCAO)

        const options: https.RequestOptions = {
            hostname: url.hostname,
            path: url.pathname + url.search,
            method: 'POST',
            agent,
            headers: {
                'Content-Type': 'application/soap+xml; charset=utf-8',
                'SOAPAction': SOAP_ACTION,
                'Content-Length': Buffer.byteLength(envelope)
            }
        }

        const req = https.request(options, (res) => {
            let data = ''
            res.on('data', chunk => data += chunk)
            res.on('end', () => {
                if (res.statusCode && res.statusCode >= 400) {
                    console.error('Resposta SEFAZ:', data)
                    reject(new Error(`SEFAZ HTTP ${res.statusCode}: ${res.statusMessage}`))
                } else {
                    resolve(data)
                }
            })
        })

        req.on('error', (err) => {
            reject(err)
        })

        req.write(envelope)
        req.end()
    })
}

// ── Processamento de Documentos ──────────────────────────────────────────────

async function processarDocZip(user_id: string, empresa_cnpj: string, nsu: string, schema: string, conteudoBase64: string) {
    try {
        const buffer = Buffer.from(conteudoBase64, 'base64')
        const xml = gunzipSync(buffer).toString('utf-8')
        const nsuInt = parseInt(nsu)

        if (schema.includes('resNFe')) {
            const chave = extrairTag(xml, 'chNFe')
            const dhEmi = extrairTag(xml, 'dhEmi')
            const xNome = extrairTag(xml, 'xNome')
            const vNF = extrairTag(xml, 'vNF')
            const cSitNFe = extrairTag(xml, 'cSitNFe')
            const cUF = extrairTag(xml, 'cUF')

            let status = 'recebida'
            if (cSitNFe === '3') status = 'cancelada'
            if (cSitNFe === '2') status = 'denegada'

            console.log(`[BACKEND] Processando resNFe: ${chave} (NSU ${nsu})`)

            await supabaseAdmin.from('nfes').upsert({
                user_id,
                empresa_cnpj,
                chave,
                nsu: nsuInt,
                emitente: xNome,
                valor: parseFloat(vNF) || 0,
                data_emissao: dhEmi ? new Date(dhEmi).toISOString() : new Date().toISOString(),
                status: status,
                schema_tipo: 'resNFe',
                uf_emitente: cUF,
            }, { onConflict: 'chave' })

        } else if (schema.includes('procNFe')) {
            const chave = extrairTag(xml, 'chNFe') || extrairAttr(xml, 'infNFe', 'Id')?.replace('NFe', '')
            const emit = extrairTag(xml, 'emit')
            const xNome = extrairTag(emit, 'xNome')
            const ide = extrairTag(xml, 'ide')
            const dhEmi = extrairTag(ide, 'dhEmi') || extrairTag(ide, 'dEmi')
            const nNF = extrairTag(ide, 'nNF')
            const total = extrairTag(xml, 'total')
            const vNF = extrairTag(total, 'vNF')

            console.log(`[BACKEND] Processando procNFe: ${chave} (NSU ${nsu})`)

            await supabaseAdmin.from('nfes').upsert({
                user_id,
                empresa_cnpj,
                chave,
                nsu: nsuInt,
                numero: nNF,
                emitente: xNome,
                valor: parseFloat(vNF) || 0,
                data_emissao: dhEmi ? new Date(dhEmi).toISOString() : new Date().toISOString(),
                status: 'autorizada',
                schema_tipo: 'procNFe',
                xml_content: xml
            }, { onConflict: 'chave' })
        }

        if (schema.includes('procEventoNFe') || schema.includes('resEvento')) {
            const tpEvento = extrairTag(xml, 'tpEvento')
            const chNFe = extrairTag(xml, 'chNFe')
            if (tpEvento === '110111') {
                console.log(`[BACKEND] Processando Cancelamento: ${chNFe}`)
                await supabaseAdmin.from('nfes').update({ status: 'cancelada' }).eq('chave', chNFe)
            }
        }

    } catch (e) {
        console.error(`[BACKEND] Erro ao processar docZip:`, e)
    }
}


// ── Sync Logic (Exportada) ────────────────────────────────────────────────────

export async function executarSync(user_id: string, cnpj: string) {
    console.log(`[BACKEND] Iniciando Sync para ${cnpj}`)

    // 1. Buscar Ultimo NSU
    const { data: syncState } = await supabaseAdmin
        .from('nfe_sync_state')
        .select('ultimo_nsu')
        .eq('empresa_cnpj', cnpj)
        .single()

    let ultNSU = Number(syncState?.ultimo_nsu ?? 0)

    // 2. Build Agent
    const agent = await buildSefazAgent(cnpj)

    let totalImportadas = 0
    let loopCount = 0
    const MAX_LOOPS = 50

    while (true) {
        loopCount++
        if (loopCount > MAX_LOOPS) break

        const envelope = buildDistDFeEnvelope(cnpj, ultNSU)
        const xmlResposta = await requestSefaz(envelope, agent)

        const cStat = extrairTag(xmlResposta, 'cStat')
        const xMotivo = extrairTag(xmlResposta, 'xMotivo')
        const ultNSURetornado = parseInt(extrairTag(xmlResposta, 'ultNSU') || '0')

        console.log(`[BACKEND] Loop ${loopCount}: cStat=${cStat} (${xMotivo}) ultNSU=${ultNSURetornado}`)

        if (cStat === '137') break // Nenhum doc

        if (cStat !== '138') {
            throw new Error(`SEFAZ retornou ${cStat}: ${xMotivo}`)
        }

        // Processar docs
        const docZipRegex = /<docZip[^>]*NSU="(\d+)"[^>]*schema="([^"]+)"[^>]*>([^<]+)<\/docZip>/g
        let match: RegExpExecArray | null

        while ((match = docZipRegex.exec(xmlResposta)) !== null) {
            const nsu = match[1]
            const schema = match[2]
            const conteudo = match[3]
            await processarDocZip(user_id, cnpj, nsu, schema, conteudo)
            totalImportadas++
        }

        ultNSU = ultNSURetornado // Sefaz sempre retorna o ultNSU do lote processado

        // Persistir estado
        await supabaseAdmin.from('nfe_sync_state').upsert({
            user_id: user_id, // Atenção: backend precisa saber o user_id? Sim, passado no argumento
            empresa_cnpj: cnpj,
            ultimo_nsu: ultNSU,
            ultima_sync: new Date().toISOString()
        }, { onConflict: 'empresa_cnpj' }) // Alterado para conflito apenas no CNPJ se possível, mas tabela tem PK composta (user, cnpj). OK.
    }

    return { success: true, total: totalImportadas }
}
