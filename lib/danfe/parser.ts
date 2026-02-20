/**
 * lib/danfe/parser.ts
 *
 * Responsável por converter o XML da NF-e armazenado no banco
 * em um objeto tipado DanfeData, extraindo todos os campos
 * necessários para renderização do DANFE.
 *
 * Não usa DOM parser externo — opera com regex robustas.
 * Serverless-safe, zero dependências externas.
 */

// ── Tipos ──────────────────────────────────────────────────────────────────────

export interface Emitente {
    nome: string
    cnpj: string
    ie: string
    crt: string            // 1=SN, 2=SN Excesso, 3=Regime Normal
    endereco: string
    municipio: string
    uf: string
    cep: string
    fone: string
}

export interface Destinatario {
    nome: string
    cnpj: string
    ie: string
    endereco: string
    municipio: string
    uf: string
    cep: string
    email: string
}

export interface Produto {
    item: number
    codigo: string
    descricao: string
    ncm: string
    cfop: string
    unidade: string
    quantidade: number
    valorUnitario: number
    valorTotal: number
    // Impostos por item
    vICMS: number
    cstICMS: string
    vPIS: number
    vCOFINS: number
    vIPI: number
}

export interface Totais {
    vBC: number        // Base cálculo ICMS
    vICMS: number      // Valor ICMS
    vICMSDeson: number // ICMS desonerado
    vFCP: number       // FCP
    vBCST: number      // BC ICMS ST
    vST: number        // ICMS ST
    vFCPST: number     // FCP ST
    vProd: number      // Valor produtos
    vFrete: number     // Frete
    vSeg: number       // Seguro
    vDesc: number      // Desconto
    vII: number        // II
    vIPI: number       // IPI
    vIPIDevol: number  // IPI devolvido
    vPIS: number       // PIS
    vCOFINS: number    // COFINS
    vOutro: number     // Outras desp
    vNF: number        // Valor total NF
    vTotTrib: number   // Total tributos
}

export interface Duplicata {
    numero: string
    vencimento: string
    valor: number
}

export interface Transportador {
    modalidadeFrete: string // 0=Emitente, 1=Destinatário, 2=Terceiros, 9=Sem frete
    nome: string
    cnpj: string
    ie: string
    endereco: string
    municipio: string
    uf: string
    // Volumes
    quantidade: string
    especie: string
    marca: string
    numeracao: string
    pesoBruto: string
    pesoLiquido: string
}

export interface DanfeData {
    // Identificação
    chaveAcesso: string
    numero: string
    serie: string
    tpNF: '0' | '1'       // 0=Entrada, 1=Saída
    natOp: string
    dhEmi: string
    dhSaiEnt: string
    tpImp: string          // 1=Retrato, 2=Paisagem
    finNFe: string         // 1=Normal, 2=Complementar, etc
    indFinal: string       // 0=Não consumidor final, 1=Sim
    indPres: string        // Indicador de presença

    // Protocolo
    protocolo: string
    dhProtocolo: string

    // Partes
    emitente: Emitente
    destinatario: Destinatario

    // Produtos
    produtos: Produto[]

    // Totais
    totais: Totais

    // Transportador
    transportador: Transportador

    // Faturas
    duplicatas: Duplicata[]

    // Info adicional
    infAdFisco: string
    infCompl: string

    // Status
    cancelada: boolean
}

// ── Helpers internos ──────────────────────────────────────────────────────────

/**
 * Extrai o conteúdo de uma tag XML (ignora namespace).
 * Busca na string a partir de um contexto opcional.
 */
function tag(xml: string, tagName: string, fallback = ''): string {
    // Suporta namespace: <nfe:xNome> ou <xNome>
    const re = new RegExp(`<(?:[\\w]+:)?${tagName}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/(?:[\\w]+:)?${tagName}>`, 'i')
    const m = xml.match(re)
    return m ? m[1].trim() : fallback
}

/**
 * Extrai o conteúdo de um bloco <tagName>...</tagName>
 */
function block(xml: string, tagName: string): string {
    const re = new RegExp(`<(?:[\\w]+:)?${tagName}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/(?:[\\w]+:)?${tagName}>`, 'i')
    const m = xml.match(re)
    return m ? m[1] : ''
}

/**
 * Extrai todos os blocos repetidos (ex: <det> ... </det>)
 */
function allBlocks(xml: string, tagName: string): string[] {
    const re = new RegExp(`<(?:[\\w]+:)?${tagName}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/(?:[\\w]+:)?${tagName}>`, 'gi')
    const results: string[] = []
    let m: RegExpExecArray | null
    while ((m = re.exec(xml)) !== null) {
        results.push(m[0]) // retorna o bloco completo incluindo tags
    }
    return results
}

function num(val: string): number {
    if (!val) return 0
    return parseFloat(val.replace(',', '.')) || 0
}

function fmtCNPJ(cnpj: string): string {
    const d = cnpj.replace(/\D/g, '')
    if (d.length === 14) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`
    if (d.length === 11) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`
    return cnpj
}

function fmtCEP(cep: string): string {
    const d = cep.replace(/\D/g, '')
    if (d.length === 8) return `${d.slice(0, 5)}-${d.slice(5)}`
    return cep
}

function fmtFone(fone: string): string {
    const d = fone.replace(/\D/g, '')
    if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`
    if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`
    return fone
}

function modalidadeFreteLabel(cod: string): string {
    const m: Record<string, string> = {
        '0': '0 – Por conta do emitente',
        '1': '1 – Por conta do destinatário',
        '2': '2 – Por conta de terceiros',
        '3': '3 – Próprio por conta do remetente',
        '4': '4 – Próprio por conta do destinatário',
        '9': '9 – Sem ocorrência de transporte',
    }
    return m[cod] ?? cod
}

// ── Parser principal ──────────────────────────────────────────────────────────

export function parseXmlToDANFE(xml: string): DanfeData {
    // Extrair chave de acesso (44 dígitos no atributo Id ou dentro da tag chNFe)
    const chaveAcesso = tag(xml, 'chNFe') ||
        (xml.match(/Id="NFe(\d{44})"/) ?? [])[1] ||
        (xml.match(/\d{44}/) ?? [])[0] || ''

    // ── Identificação (ide) ───────────────────────────────────────────────────
    const ideBlock = block(xml, 'ide')
    const numero = tag(ideBlock, 'nNF')
    const serie = tag(ideBlock, 'serie')
    const tpNF = (tag(ideBlock, 'tpNF') || '0') as '0' | '1'
    const natOp = tag(ideBlock, 'natOp')
    const dhEmi = tag(ideBlock, 'dhEmi')
    const dhSaiEnt = tag(ideBlock, 'dhSaiEnt') || tag(ideBlock, 'dSaiEnt') || dhEmi
    const tpImp = tag(ideBlock, 'tpImp', '1')
    const finNFe = tag(ideBlock, 'finNFe', '1')
    const indFinal = tag(ideBlock, 'indFinal', '0')
    const indPres = tag(ideBlock, 'indPres', '0')

    // ── Protocolo ─────────────────────────────────────────────────────────────
    const protBlock = block(xml, 'protNFe') || block(xml, 'retConsSitNFe')
    const protocolo = tag(protBlock, 'nProt') || tag(xml, 'nProt') || ''
    const dhProtocolo = tag(protBlock, 'dhRecbto') || ''

    // ── Emitente ─────────────────────────────────────────────────────────────
    const emitBlock = block(xml, 'emit')
    const emitEnderBlock = block(emitBlock, 'enderEmit')
    const emitLgr = tag(emitEnderBlock, 'xLgr')
    const emitNro = tag(emitEnderBlock, 'nro')
    const emitCompl = tag(emitEnderBlock, 'xCpl')
    const emitBairro = tag(emitEnderBlock, 'xBairro')
    const emitMun = tag(emitEnderBlock, 'xMun')
    const emitUF = tag(emitEnderBlock, 'UF')
    const emitCEP = tag(emitEnderBlock, 'CEP')
    const emitFone = tag(emitEnderBlock, 'fone') || tag(emitBlock, 'fone')

    const enderLines = [
        emitLgr + (emitNro ? ', ' + emitNro : '') + (emitCompl ? ' - ' + emitCompl : ''),
        emitBairro,
    ].filter(Boolean).join(' – ')

    const emitente: Emitente = {
        nome: tag(emitBlock, 'xNome') || tag(emitBlock, 'xFant') || '',
        cnpj: fmtCNPJ(tag(emitBlock, 'CNPJ') || tag(emitBlock, 'CPF') || ''),
        ie: tag(emitBlock, 'IE') || 'ISENTO',
        crt: tag(emitBlock, 'CRT', '3'),
        endereco: enderLines,
        municipio: emitMun,
        uf: emitUF,
        cep: fmtCEP(emitCEP),
        fone: fmtFone(emitFone),
    }

    // ── Destinatário ──────────────────────────────────────────────────────────
    const destBlock = block(xml, 'dest')
    const destEnderBlock = block(destBlock, 'enderDest')
    const destLgr = tag(destEnderBlock, 'xLgr')
    const destNro = tag(destEnderBlock, 'nro')
    const destCompl = tag(destEnderBlock, 'xCpl')
    const destBairro = tag(destEnderBlock, 'xBairro')
    const destMun = tag(destEnderBlock, 'xMun')
    const destUF = tag(destEnderBlock, 'UF')
    const destCEP = tag(destEnderBlock, 'CEP')

    const destEnderLines = [
        destLgr + (destNro ? ', ' + destNro : '') + (destCompl ? ' - ' + destCompl : ''),
        destBairro,
    ].filter(Boolean).join(' – ')

    const destinatario: Destinatario = {
        nome: tag(destBlock, 'xNome') || '',
        cnpj: fmtCNPJ(tag(destBlock, 'CNPJ') || tag(destBlock, 'CPF') || ''),
        ie: tag(destBlock, 'IE') || 'ISENTO',
        endereco: destEnderLines,
        municipio: destMun,
        uf: destUF,
        cep: fmtCEP(destCEP),
        email: tag(destBlock, 'email') || '',
    }

    // ── Produtos ──────────────────────────────────────────────────────────────
    const detBlocks = allBlocks(xml, 'det')
    const produtos: Produto[] = detBlocks.map((det, idx) => {
        const prodBlock = block(det, 'prod')
        const impostoBlock = block(det, 'imposto')
        const icmsBlock = block(impostoBlock, 'ICMS')
        // Pegar primeiro bloco de imposto ICMS (ICMSxx)
        const icmsInner = block(icmsBlock, 'ICMS00') || block(icmsBlock, 'ICMS10') ||
            block(icmsBlock, 'ICMS20') || block(icmsBlock, 'ICMS40') ||
            block(icmsBlock, 'ICMS41') || block(icmsBlock, 'ICMS60') ||
            block(icmsBlock, 'ICMS70') || block(icmsBlock, 'ICMS90') ||
            block(icmsBlock, 'ICMSSN101') || block(icmsBlock, 'ICMSSN102') ||
            block(icmsBlock, 'ICMSSN201') || block(icmsBlock, 'ICMSSN202') ||
            block(icmsBlock, 'ICMSSN500') || block(icmsBlock, 'ICMSSN900') || ''

        const pisBlock = block(impostoBlock, 'PIS')
        const cofinsBlock = block(impostoBlock, 'COFINS')
        const ipiBlock = block(impostoBlock, 'IPI')

        return {
            item: idx + 1,
            codigo: tag(prodBlock, 'cProd'),
            descricao: tag(prodBlock, 'xProd'),
            ncm: tag(prodBlock, 'NCM'),
            cfop: tag(prodBlock, 'CFOP'),
            unidade: tag(prodBlock, 'uCom') || tag(prodBlock, 'uTrib'),
            quantidade: num(tag(prodBlock, 'qCom') || tag(prodBlock, 'qTrib')),
            valorUnitario: num(tag(prodBlock, 'vUnCom') || tag(prodBlock, 'vUnTrib')),
            valorTotal: num(tag(prodBlock, 'vProd')),
            cstICMS: tag(icmsInner, 'CST') || tag(icmsInner, 'CSOSN'),
            vICMS: num(tag(icmsInner, 'vICMS')),
            vPIS: num(tag(pisBlock, 'vPIS')),
            vCOFINS: num(tag(cofinsBlock, 'vCOFINS')),
            vIPI: num(tag(ipiBlock, 'vIPI')),
        }
    })

    // ── Totais ────────────────────────────────────────────────────────────────
    const totBlock = block(xml, 'ICMSTot') || block(block(xml, 'total'), 'ICMSTot')
    const totais: Totais = {
        vBC: num(tag(totBlock, 'vBC')),
        vICMS: num(tag(totBlock, 'vICMS')),
        vICMSDeson: num(tag(totBlock, 'vICMSDeson')),
        vFCP: num(tag(totBlock, 'vFCP')),
        vBCST: num(tag(totBlock, 'vBCST')),
        vST: num(tag(totBlock, 'vST')),
        vFCPST: num(tag(totBlock, 'vFCPST')),
        vProd: num(tag(totBlock, 'vProd')),
        vFrete: num(tag(totBlock, 'vFrete')),
        vSeg: num(tag(totBlock, 'vSeg')),
        vDesc: num(tag(totBlock, 'vDesc')),
        vII: num(tag(totBlock, 'vII')),
        vIPI: num(tag(totBlock, 'vIPI')),
        vIPIDevol: num(tag(totBlock, 'vIPIDevol')),
        vPIS: num(tag(totBlock, 'vPIS')),
        vCOFINS: num(tag(totBlock, 'vCOFINS')),
        vOutro: num(tag(totBlock, 'vOutro')),
        vNF: num(tag(totBlock, 'vNF')),
        vTotTrib: num(tag(totBlock, 'vTotTrib')),
    }

    // ── Transportador ─────────────────────────────────────────────────────────
    const transpBlock = block(xml, 'transp')
    const transpNome = tag(transpBlock, 'xNome')
    const transpCNPJ = fmtCNPJ(tag(transpBlock, 'CNPJ') || tag(transpBlock, 'CPF') || '')
    const transpIE = tag(transpBlock, 'IE')
    const transpEnder = tag(transpBlock, 'xEnder')
    const transpMun = tag(transpBlock, 'xMun')
    const transpUF = tag(transpBlock, 'UF')
    const modalFrete = tag(transpBlock, 'modFrete', '9')

    const volBlock = block(transpBlock, 'vol')

    const transportador: Transportador = {
        modalidadeFrete: modalidadeFreteLabel(modalFrete),
        nome: transpNome,
        cnpj: transpCNPJ,
        ie: transpIE,
        endereco: transpEnder,
        municipio: transpMun,
        uf: transpUF,
        quantidade: tag(volBlock, 'qVol'),
        especie: tag(volBlock, 'esp'),
        marca: tag(volBlock, 'marca'),
        numeracao: tag(volBlock, 'nVol'),
        pesoBruto: tag(volBlock, 'pesoB'),
        pesoLiquido: tag(volBlock, 'pesoL'),
    }

    // ── Duplicatas / Fatura ───────────────────────────────────────────────────
    const fatBlock = block(xml, 'cobr')
    const dupBlocks = allBlocks(fatBlock, 'dup')
    const duplicatas: Duplicata[] = dupBlocks.map(dup => ({
        numero: tag(dup, 'nDup'),
        vencimento: tag(dup, 'dVenc'),
        valor: num(tag(dup, 'vDup')),
    }))

    // ── Info Adicional ────────────────────────────────────────────────────────
    const infAdic = block(xml, 'infAdic')
    const infAdFisco = tag(infAdic, 'infAdFisco')
    const infCompl = tag(infAdic, 'infCpl')

    // ── Status ────────────────────────────────────────────────────────────────
    // Verificar se veio com evento de cancelamento (tpEvento=110111)
    const cancelada = xml.includes('110111') && xml.includes('Cancelamento')

    return {
        chaveAcesso,
        numero,
        serie,
        tpNF,
        natOp,
        dhEmi,
        dhSaiEnt,
        tpImp,
        finNFe,
        indFinal,
        indPres,
        protocolo,
        dhProtocolo,
        emitente,
        destinatario,
        produtos,
        totais,
        transportador,
        duplicatas,
        infAdFisco,
        infCompl,
        cancelada,
    }
}
