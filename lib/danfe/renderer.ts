/**
 * lib/danfe/renderer.ts
 *
 * Engine de renderização do DANFE usando PDFKit.
 * Serverless-safe: gera PDF em memória (Buffer), sem filesystem.
 *
 * Estrutura dos blocos (ordem oficial DANFE):
 *  1. Cabeçalho: Emitente | DANFE | Número NF
 *  2. Chave de Acesso + Código de Barras
 *  3. Natureza da Operação | IE Emitente | CNPJ Emitente
 *  4. Data Emissão | Data Saída/Entrada | Hora Saída/Entrada
 *  5. Destinatário / Remetente
 *  6. Cálculo do Imposto
 *  7. Transportador / Volumes
 *  8. Fatura / Duplicatas
 *  9. Dados dos Produtos / Serviços  (tabela dinâmica)
 * 10. Cálculo do IPI / Totais complementares
 * 11. Informações Adicionais
 * 12. Rodapé
 */

import PDFDocument from 'pdfkit'
import { gerarCodigoBarras, formatarChave } from './barcode'
import {
    PAGE, FONT, COLOR, PROD_COLS, BLOCK_HEIGHT,
    brl, numBR, fmtDate, fmtDateTime, truncate,
} from './layout'
import type { DanfeData, Produto } from './parser'

// ── Tipos internos ────────────────────────────────────────────────────────────

type PDFDoc = InstanceType<typeof PDFDocument>

// ── Helpers de desenho ────────────────────────────────────────────────────────

/** Desenha retângulo de fundo (para rótulos de campo). */
function fillRect(doc: PDFDoc, x: number, y: number, w: number, h: number, color = COLOR.sectionBg) {
    doc.save().rect(x, y, w, h).fill(color).restore()
}

/** Desenha retângulo com borda. */
function strokeRect(doc: PDFDoc, x: number, y: number, w: number, h: number, lineWidth = 0.5) {
    doc.save()
        .lineWidth(lineWidth)
        .strokeColor(COLOR.border)
        .rect(x, y, w, h)
        .stroke()
        .restore()
}

/** Linha horizontal. */
function hLine(doc: PDFDoc, x: number, y: number, width: number, lw = 0.5) {
    doc.save().lineWidth(lw).strokeColor(COLOR.border).moveTo(x, y).lineTo(x + width, y).stroke().restore()
}

/** Linha vertical. */
function vLine(doc: PDFDoc, x: number, y: number, height: number, lw = 0.5) {
    doc.save().lineWidth(lw).strokeColor(COLOR.border).moveTo(x, y).lineTo(x, y + height).stroke().restore()
}

/**
 * Célula genérica: label em cima, valor em baixo.
 * @param bkg - se true, pinta fundo cinza no rótulo
 */
function cell(
    doc: PDFDoc,
    label: string,
    value: string,
    x: number, y: number,
    w: number, h: number,
    opts?: { align?: 'left' | 'right' | 'center'; bkg?: boolean; bold?: boolean }
) {
    const labelH = 9
    const { align = 'left', bkg = true, bold = false } = opts ?? {}

    if (bkg) fillRect(doc, x + 0.5, y + 0.5, w - 1, labelH, COLOR.sectionBg)

    doc.font(FONT.bold).fontSize(FONT.size.label).fillColor(COLOR.gray)
        .text(label, x + 2, y + 2, { width: w - 4, align, lineBreak: false, ellipsis: true })

    doc.font(bold ? FONT.bold : FONT.regular).fontSize(FONT.size.value).fillColor(COLOR.black)
        .text(value || ' ', x + 2, y + labelH + 2, { width: w - 4, align, lineBreak: false, ellipsis: true })
}

// ── Blocos de conteúdo ────────────────────────────────────────────────────────

/**
 * Bloco 1 — Cabeçalho: Emitente | DANFE | Número NF
 */
function renderCabecalho(doc: PDFDoc, data: DanfeData, x: number, y: number, w: number): number {
    const h = BLOCK_HEIGHT.headerLogo
    strokeRect(doc, x, y, w, h, 1)

    // Coluna emitente (~55% da largura)
    const emitW = Math.floor(w * 0.55)
    const danfeW = Math.floor(w * 0.22)
    const nfW = w - emitW - danfeW

    // Divisor entre emitente e DANFE
    vLine(doc, x + emitW, y, h)
    vLine(doc, x + emitW + danfeW, y, h)

    // ── Emitente ──────────────────────────────────────────────────────────────
    const { emitente } = data
    doc.font(FONT.bold).fontSize(10).fillColor(COLOR.black)
        .text(emitente.nome, x + 4, y + 6, { width: emitW - 8, align: 'center', lineBreak: true })

    const afterNome = doc.y + 2
    doc.font(FONT.regular).fontSize(FONT.size.label).fillColor(COLOR.gray)
        .text(emitente.endereco, x + 4, afterNome, { width: emitW - 8, align: 'center', lineBreak: true })
        .text(`${emitente.municipio} – ${emitente.uf} – CEP: ${emitente.cep}`, x + 4, doc.y + 1, { width: emitW - 8, align: 'center', lineBreak: false })
    if (emitente.fone) {
        doc.text(`Fone: ${emitente.fone}`, x + 4, doc.y + 2, { width: emitW - 8, align: 'center', lineBreak: false })
    }

    // ── DANFE (centro) ────────────────────────────────────────────────────────
    const dx = x + emitW
    doc.font(FONT.bold).fontSize(FONT.size.danfe).fillColor(COLOR.black)
        .text('DANFE', dx, y + 8, { width: danfeW, align: 'center' })
    doc.font(FONT.regular).fontSize(6).fillColor(COLOR.gray)
        .text('Documento Auxiliar da\nNota Fiscal Eletrônica', dx, y + 26, { width: danfeW, align: 'center' })

    // Indicador entrada/saída
    const indY = y + h - 22
    strokeRect(doc, dx + 8, indY, danfeW - 16, 16)
    const tpLabel = data.tpNF === '0' ? '0 – ENTRADA' : '1 – SAÍDA'
    doc.font(FONT.bold).fontSize(7).fillColor(COLOR.black)
        .text(tpLabel, dx + 8, indY + 4, { width: danfeW - 16, align: 'center' })

    // ── NF Número / Série (direita) ───────────────────────────────────────────
    const nx = x + emitW + danfeW
    doc.font(FONT.bold).fontSize(8).fillColor(COLOR.black)
        .text(`Nº ${data.numero}`, nx, y + 8, { width: nfW - 4, align: 'center' })
    doc.font(FONT.regular).fontSize(7)
        .text(`SÉRIE ${data.serie}`, nx, y + 20, { width: nfW - 4, align: 'center' })

    // Folha
    doc.font(FONT.regular).fontSize(FONT.size.label).fillColor(COLOR.gray)
        .text('Folha', nx, y + 34, { width: nfW - 4, align: 'center' })
    doc.font(FONT.regular).fontSize(FONT.size.value).fillColor(COLOR.black)
        .text('1 / 1', nx, y + 43, { width: nfW - 4, align: 'center' })

    return y + h
}

/**
 * Bloco 2 — Chave de Acesso + Código de Barras
 */
async function renderChaveAcesso(doc: PDFDoc, data: DanfeData, x: number, y: number, w: number, barcodeBuffer: Buffer): Promise<number> {
    const h = BLOCK_HEIGHT.chaveAcesso
    strokeRect(doc, x, y, w, h)

    // Rótulo
    fillRect(doc, x + 0.5, y + 0.5, w - 1, 9, COLOR.sectionBg)
    doc.font(FONT.bold).fontSize(FONT.size.label).fillColor(COLOR.gray)
        .text('CHAVE DE ACESSO', x + 2, y + 2, { width: w - 4, align: 'left' })

    // Chave formatada
    const chaveFormatada = formatarChave(data.chaveAcesso)
    doc.font(FONT.regular).fontSize(FONT.size.chave).fillColor(COLOR.black)
        .text(chaveFormatada, x + 2, y + 12, { width: w - 130, align: 'left', characterSpacing: 0.5 })

    // Código de barras (PNG)
    try {
        doc.image(barcodeBuffer, x + w - 125, y + 8, { width: 120, height: 20 })
    } catch {
        // falha silenciosa — chave formatada já está visível
    }

    // Protocolo de autorização
    const prot = data.protocolo ? `Protocolo: ${data.protocolo}` : 'Aguardando autorização SEFAZ'
    const dhProt = data.dhProtocolo ? ` – ${fmtDateTime(data.dhProtocolo)}` : ''
    doc.font(FONT.regular).fontSize(FONT.size.label).fillColor(COLOR.gray)
        .text(prot + dhProt, x + 2, y + h - 10, { width: w - 4, align: 'left' })

    return y + h
}

/**
 * Bloco 3 — Natureza da Operação | IE | CNPJ Emitente
 */
function renderNatOp(doc: PDFDoc, data: DanfeData, x: number, y: number, w: number): number {
    const h = BLOCK_HEIGHT.natOp
    strokeRect(doc, x, y, w, h)

    const col1 = Math.floor(w * 0.45)
    const col2 = Math.floor(w * 0.25)
    const col3 = w - col1 - col2
    vLine(doc, x + col1, y, h)
    vLine(doc, x + col1 + col2, y, h)

    cell(doc, 'NATUREZA DA OPERAÇÃO', data.natOp, x, y, col1, h)
    cell(doc, 'INSCRIÇÃO ESTADUAL', data.emitente.ie, x + col1, y, col2, h)
    cell(doc, 'CNPJ', data.emitente.cnpj, x + col1 + col2, y, col3, h)

    return y + h
}

/**
 * Bloco 4 — Datas: Emissão | Saída/Entrada
 */
function renderDatas(doc: PDFDoc, data: DanfeData, x: number, y: number, w: number): number {
    const h = BLOCK_HEIGHT.ie
    strokeRect(doc, x, y, w, h)

    const col1 = Math.floor(w * 0.25)
    const col2 = Math.floor(w * 0.25)
    const col3 = Math.floor(w * 0.25)
    const col4 = w - col1 - col2 - col3
    vLine(doc, x + col1, y, h)
    vLine(doc, x + col1 + col2, y, h)
    vLine(doc, x + col1 + col2 + col3, y, h)

    // Hora de saída/entrada
    let hora = ''
    try {
        if (data.dhSaiEnt) {
            const d = new Date(data.dhSaiEnt)
            hora = d.toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit', second: '2-digit' })
        }
    } catch { /* ok */ }

    cell(doc, 'DATA DE EMISSÃO', fmtDate(data.dhEmi), x, y, col1, h, { align: 'right' })
    cell(doc, 'DATA DE ENTRADA/SAÍDA', fmtDate(data.dhSaiEnt), x + col1, y, col2, h, { align: 'right' })
    cell(doc, 'HORA DE ENTRADA/SAÍDA', hora, x + col1 + col2, y, col3, h, { align: 'right' })
    cell(doc, 'FORMA PAGTO', '', x + col1 + col2 + col3, y, col4, h)

    return y + h
}

/**
 * Bloco 5 — Destinatário / Remetente
 */
function renderDestinatario(doc: PDFDoc, data: DanfeData, x: number, y: number, w: number): number {
    const h = BLOCK_HEIGHT.destinatario
    strokeRect(doc, x, y, w, h)
    vLine(doc, x, y + 20, w)

    // Linha 1 header
    fillRect(doc, x + 0.5, y + 0.5, w - 1, 9, COLOR.sectionBg)
    doc.font(FONT.bold).fontSize(FONT.size.sectionTitle).fillColor(COLOR.gray)
        .text('DESTINATÁRIO / REMETENTE', x + 2, y + 2)

    // Linha 1: Nome | CNPJ | Data Emissão
    const c1 = Math.floor(w * 0.50)
    const c2 = Math.floor(w * 0.30)
    const c3 = w - c1 - c2
    vLine(doc, x + c1, y + 9, 22)
    vLine(doc, x + c1 + c2, y + 9, 22)

    cell(doc, 'NOME / RAZÃO SOCIAL', data.destinatario.nome, x, y + 9, c1, 22, { bkg: false })
    cell(doc, 'CNPJ / CPF', data.destinatario.cnpj, x + c1, y + 9, c2, 22, { bkg: false })
    cell(doc, 'DATA DE EMISSÃO', fmtDate(data.dhEmi), x + c1 + c2, y + 9, c3, 22, { bkg: false, align: 'right' })

    // Linha 2: Endereço | UF | IE
    const e1 = Math.floor(w * 0.50)
    const e2 = Math.floor(w * 0.10)
    const e3 = Math.floor(w * 0.20)
    const e4 = w - e1 - e2 - e3
    hLine(doc, x, y + 31, w)
    vLine(doc, x + e1, y + 31, h - 31)
    vLine(doc, x + e1 + e2, y + 31, h - 31)
    vLine(doc, x + e1 + e2 + e3, y + 31, h - 31)

    cell(doc, 'ENDEREÇO', data.destinatario.endereco + (data.destinatario.municipio ? ` – ${data.destinatario.municipio}` : ''), x, y + 31, e1, h - 31, { bkg: false })
    cell(doc, 'UF', data.destinatario.uf, x + e1, y + 31, e2, h - 31, { bkg: false, align: 'center' })
    cell(doc, 'CEP', data.destinatario.cep, x + e1 + e2, y + 31, e3, h - 31, { bkg: false })
    cell(doc, 'IE', data.destinatario.ie, x + e1 + e2 + e3, y + 31, e4, h - 31, { bkg: false })

    return y + h
}

/**
 * Bloco 6 — Cálculo do Imposto
 */
function renderCalculoImposto(doc: PDFDoc, data: DanfeData, x: number, y: number, w: number): number {
    const h = BLOCK_HEIGHT.calc
    strokeRect(doc, x, y, w, h)

    // Título da seção
    fillRect(doc, x + 0.5, y + 0.5, w - 1, 9, COLOR.sectionBg)
    doc.font(FONT.bold).fontSize(FONT.size.sectionTitle).fillColor(COLOR.gray)
        .text('CÁLCULO DO IMPOSTO', x + 2, y + 2)

    hLine(doc, x, y + 9, w)

    // 7 colunas
    const cols = [
        { label: 'BC ICMS (R$)', value: brl(data.totais.vBC), w: 0 },
        { label: 'VALOR ICMS (R$)', value: brl(data.totais.vICMS), w: 0 },
        { label: 'BC ICMS ST (R$)', value: brl(data.totais.vBCST), w: 0 },
        { label: 'VALOR ICMS ST (R$)', value: brl(data.totais.vST), w: 0 },
        { label: 'VL. IPI (R$)', value: brl(data.totais.vIPI), w: 0 },
        { label: 'VL. PIS (R$)', value: brl(data.totais.vPIS), w: 0 },
        { label: 'VL. COFINS (R$)', value: brl(data.totais.vCOFINS), w: 0 },
        { label: 'TOTAL NF (R$)', value: brl(data.totais.vNF), w: 0 },
    ]
    const colW = Math.floor(w / cols.length)
    let cx = x
    cols.forEach((col, i) => {
        const cw = i === cols.length - 1 ? w - (colW * (cols.length - 1)) : colW
        if (i > 0) vLine(doc, cx, y + 9, h - 9)
        cell(doc, col.label, col.value, cx, y + 9, cw, h - 9, { align: 'right', bkg: false, bold: i === cols.length - 1 })
        cx += cw
    })

    return y + h
}

/**
 * Bloco 7 — Transportador / Volumes
 */
function renderTransportador(doc: PDFDoc, data: DanfeData, x: number, y: number, w: number): number {
    const h = BLOCK_HEIGHT.transp
    strokeRect(doc, x, y, w, h)
    fillRect(doc, x + 0.5, y + 0.5, w - 1, 9, COLOR.sectionBg)
    doc.font(FONT.bold).fontSize(FONT.size.sectionTitle).fillColor(COLOR.gray)
        .text('TRANSPORTADOR / VOLUMES TRANSPORTADOS', x + 2, y + 2)
    hLine(doc, x, y + 9, w)

    // Linha 1: Nome | CNPJ | Frete | Qtd | Espécie
    const t1 = Math.floor(w * 0.30)
    const t2 = Math.floor(w * 0.18)
    const t3 = Math.floor(w * 0.20)
    const t4 = Math.floor(w * 0.12)
    const t5 = w - t1 - t2 - t3 - t4
    vLine(doc, x + t1, y + 9, h - 9)
    vLine(doc, x + t1 + t2, y + 9, h - 9)
    vLine(doc, x + t1 + t2 + t3, y + 9, h - 9)
    vLine(doc, x + t1 + t2 + t3 + t4, y + 9, h - 9)

    const { transportador: tr } = data
    cell(doc, 'RAZÃO SOCIAL', tr.nome, x, y + 9, t1, h - 9, { bkg: false })
    cell(doc, 'FRETE POR CONTA', tr.modalidadeFrete, x + t1, y + 9, t2, h - 9, { bkg: false })
    cell(doc, 'CNPJ / CPF', tr.cnpj, x + t1 + t2, y + 9, t3, h - 9, { bkg: false })
    cell(doc, 'QTD. VOLUMES', tr.quantidade, x + t1 + t2 + t3, y + 9, t4, h - 9, { bkg: false, align: 'right' })
    cell(doc, 'ESPÉCIE', tr.especie, x + t1 + t2 + t3 + t4, y + 9, t5, h - 9, { bkg: false })

    return y + h
}

/**
 * Bloco 8 — Duplicatas / Fatura
 */
function renderFatura(doc: PDFDoc, data: DanfeData, x: number, y: number, w: number): number {
    if (!data.duplicatas.length) return y
    const h = BLOCK_HEIGHT.faturas
    strokeRect(doc, x, y, w, h)
    fillRect(doc, x + 0.5, y + 0.5, w - 1, 9, COLOR.sectionBg)
    doc.font(FONT.bold).fontSize(FONT.size.sectionTitle).fillColor(COLOR.gray)
        .text('FATURA / DUPLICATAS', x + 2, y + 2)
    hLine(doc, x, y + 9, w)

    const colW = Math.floor(w / Math.min(data.duplicatas.length, 10))
    let dx = x
    data.duplicatas.slice(0, 10).forEach((dup, i) => {
        if (i > 0) vLine(doc, dx, y + 9, h - 9)
        cell(doc, `DUP ${dup.numero}`, `${fmtDate(dup.vencimento)}\n${brl(dup.valor)}`, dx, y + 9, colW, h - 9, { bkg: false, align: 'center' })
        dx += colW
    })

    return y + h
}

/**
 * Bloco 9 — Cabeçalho da tabela de produtos
 */
function renderProdutosHeader(doc: PDFDoc, x: number, y: number, w: number): number {
    const h = BLOCK_HEIGHT.prodHeader
    strokeRect(doc, x, y, w, h)
    fillRect(doc, x + 0.5, y + 0.5, w - 1, h, COLOR.sectionBg)
    doc.font(FONT.bold).fontSize(FONT.size.sectionTitle).fillColor(COLOR.gray)
        .text('DADOS DOS PRODUTOS / SERVIÇOS', x + 2, y + 2)

    hLine(doc, x, y + 10, w)

    // Cabeçalhos das colunas
    const cols = Object.values(PROD_COLS)
    let cx = x
    cols.forEach((col, i) => {
        if (i > 0) vLine(doc, cx, y + 10, h - 10)
        doc.font(FONT.bold).fontSize(FONT.size.prodHeader).fillColor(COLOR.gray)
            .text(col.label, cx + 1, y + 12, { width: col.w - 2, align: 'center', lineBreak: false, ellipsis: true })
        cx += col.w
    })

    return y + h
}

/**
 * Bloco 9 — Linha de produto
 */
function renderProdutoRow(doc: PDFDoc, prod: Produto, x: number, y: number, w: number, isAlt: boolean): number {
    const h = BLOCK_HEIGHT.prodRow
    if (isAlt) fillRect(doc, x, y, w, h, '#f7f7f7')
    hLine(doc, x, y + h, w)

    const colDefs = Object.values(PROD_COLS)
    const values = [
        String(prod.item),
        truncate(prod.codigo, 8),
        truncate(prod.descricao, 40),
        prod.ncm,
        prod.cfop,
        prod.unidade,
        numBR(prod.quantidade, 2),
        brl(prod.valorUnitario),
        brl(prod.valorTotal),
    ]

    let cx = x
    colDefs.forEach((col, i) => {
        if (i > 0) vLine(doc, cx, y, h)
        const align = i >= 6 ? 'right' : i === 0 ? 'center' : 'left'
        doc.font(FONT.regular).fontSize(FONT.size.prodRow).fillColor(COLOR.black)
            .text(values[i] ?? '', cx + 1, y + 4, { width: col.w - 2, align, lineBreak: false, ellipsis: true })
        cx += col.w
    })

    return y + h
}

/**
 * Bloco 10 — Informações Adicionais
 */
function renderInfoAdicional(doc: PDFDoc, data: DanfeData, x: number, y: number, w: number): number {
    const content = [data.infAdFisco, data.infCompl].filter(Boolean).join(' | ')
    if (!content) return y
    const h = BLOCK_HEIGHT.infAdic
    strokeRect(doc, x, y, w, h)
    fillRect(doc, x + 0.5, y + 0.5, w - 1, 9, COLOR.sectionBg)
    doc.font(FONT.bold).fontSize(FONT.size.sectionTitle).fillColor(COLOR.gray)
        .text('INFORMAÇÕES COMPLEMENTARES', x + 2, y + 2)
    hLine(doc, x, y + 9, w)
    doc.font(FONT.regular).fontSize(FONT.size.label).fillColor(COLOR.black)
        .text(content, x + 3, y + 12, { width: w - 6, lineBreak: true, height: h - 14, ellipsis: true })
    return y + h
}

/**
 * Rodapé — Marcação de cancelada + aviso legal
 */
function renderRodape(doc: PDFDoc, data: DanfeData, x: number, y: number, w: number) {
    if (data.cancelada) {
        // PDFKit: rotação via doc.rotate(), não via opção de .text()
        doc.save()
            .rotate(-30, { origin: [x + w / 2, y - 150] })
            .font(FONT.bold).fontSize(60).fillColor(COLOR.cancelRed, 0.25)
            .text('CANCELADA', x, y - 180, { width: w, align: 'center', lineBreak: false })
            .restore()
    }
    doc.font(FONT.regular).fontSize(FONT.size.footer).fillColor(COLOR.lightGray)
        .text(
            'Este documento é uma representação gráfica da NF-e. A validade jurídica é garantida pela ' +
            'assinatura digital do emitente e pela autorização de uso pela SEFAZ.',
            x, y + 4, { width: w, align: 'center', lineBreak: false }
        )
}

// ── Engine principal ──────────────────────────────────────────────────────────

/**
 * Gera o PDF do DANFE a partir de um DanfeData e retorna um Buffer.
 * @param data - Dados estruturados do DANFE (saída do parser)
 * @returns Promise<Buffer> — Buffer do PDF em memória
 */
export async function renderDanfe(data: DanfeData): Promise<Buffer> {
    console.log('[DANFE Engine] Iniciando renderização | NF:', data.numero, '| Chave:', data.chaveAcesso.slice(-8))

    // Gerar código de barras antes de criar o documento
    let barcodeBuffer: Buffer
    try {
        barcodeBuffer = await gerarCodigoBarras(data.chaveAcesso)
    } catch (err: any) {
        console.warn('[DANFE Engine] Falha ao gerar código de barras:', err.message)
        barcodeBuffer = Buffer.alloc(0)
    }

    return new Promise((resolve, reject) => {
        const chunks: Buffer[] = []

        const doc = new PDFDocument({
            size: 'A4',
            margins: { top: PAGE.marginTop, bottom: PAGE.margin, left: PAGE.margin, right: PAGE.margin },
            autoFirstPage: true,
            bufferPages: true,
            info: {
                Title: `DANFE NF-e Nº ${data.numero}`,
                Author: data.emitente.nome,
                Subject: 'Documento Auxiliar da Nota Fiscal Eletrônica',
                Creator: 'NF-e Ágil',
            },
        })

        doc.on('data', (chunk: Buffer) => chunks.push(chunk))
        doc.on('end', () => resolve(Buffer.concat(chunks)))
        doc.on('error', reject)

        try {
            const x = PAGE.margin
            const w = PAGE.contentWidth
            let y = PAGE.marginTop

            // ── 1. Cabeçalho ─────────────────────────────────────────────────
            y = renderCabecalho(doc, data, x, y, w)

            // ── 2. Chave de Acesso + Código de Barras ─────────────────────────
            // renderChaveAcesso é async mas já temos o buffer
            y = renderChaveAcessoSync(doc, data, x, y, w, barcodeBuffer)

            // ── 3. Natureza Operação | IE | CNPJ ─────────────────────────────
            y = renderNatOp(doc, data, x, y, w)

            // ── 4. Datas ──────────────────────────────────────────────────────
            y = renderDatas(doc, data, x, y, w)

            // ── 5. Destinatário ───────────────────────────────────────────────
            y = renderDestinatario(doc, data, x, y, w)

            // ── 6. Cálculo Imposto ────────────────────────────────────────────
            y = renderCalculoImposto(doc, data, x, y, w)

            // ── 7. Transportador ──────────────────────────────────────────────
            y = renderTransportador(doc, data, x, y, w)

            // ── 8. Fatura / Duplicatas ────────────────────────────────────────
            y = renderFatura(doc, data, x, y, w)

            // ── 9. Tabela de Produtos (com paginação automática) ──────────────
            y = renderProdutosHeader(doc, x, y, w)

            const PAGE_BOTTOM = PAGE.height - PAGE.margin - BLOCK_HEIGHT.rodape - 20

            data.produtos.forEach((prod, idx) => {
                // Verificar se precisa de nova página
                if (y + BLOCK_HEIGHT.prodRow > PAGE_BOTTOM) {
                    doc.addPage()
                    y = PAGE.marginTop
                    // Re-renderiza cabeçalho condensado na segunda página
                    strokeRect(doc, x, y, w, 12)
                    fillRect(doc, x + 0.5, y + 0.5, w - 1, 12, COLOR.sectionBg)
                    doc.font(FONT.bold).fontSize(FONT.size.sectionTitle).fillColor(COLOR.gray)
                        .text(`DANFE – Continuação – NF ${data.numero} | ${data.emitente.nome}`, x + 2, y + 3, { width: w - 4, align: 'center' })
                    y += 12
                    y = renderProdutosHeader(doc, x, y, w)
                }
                y = renderProdutoRow(doc, prod, x, y, w, idx % 2 === 1)
            })

            // Borda direita e esquerda da tabela
            strokeRect(doc, x, y - BLOCK_HEIGHT.prodRow * data.produtos.length - BLOCK_HEIGHT.prodHeader,
                w, BLOCK_HEIGHT.prodRow * data.produtos.length + BLOCK_HEIGHT.prodHeader, 0.5)

            y += 4

            // ── 10. Informações Adicionais ────────────────────────────────────
            y = renderInfoAdicional(doc, data, x, y, w)

            // ── 11. Rodapé ────────────────────────────────────────────────────
            renderRodape(doc, data, x, y, w)

        } catch (err) {
            reject(err)
            return
        }

        doc.end()

        console.log('[DANFE Engine] PDF finalizado')
    })
}

// ── Versão sync da chave (reutiliza buffer já gerado) ─────────────────────────

function renderChaveAcessoSync(doc: PDFDoc, data: DanfeData, x: number, y: number, w: number, barcodeBuffer: Buffer): number {
    const h = BLOCK_HEIGHT.chaveAcesso
    strokeRect(doc, x, y, w, h)
    fillRect(doc, x + 0.5, y + 0.5, w - 1, 9, COLOR.sectionBg)
    doc.font(FONT.bold).fontSize(FONT.size.label).fillColor(COLOR.gray)
        .text('CHAVE DE ACESSO', x + 2, y + 2, { width: w - 130, align: 'left' })

    const chaveFormatada = formatarChave(data.chaveAcesso)
    doc.font(FONT.regular).fontSize(FONT.size.chave).fillColor(COLOR.black)
        .text(chaveFormatada, x + 2, y + 12, { width: w - 130, align: 'left', characterSpacing: 0.5, lineBreak: false, ellipsis: true })

    if (barcodeBuffer.length > 0) {
        try {
            doc.image(barcodeBuffer, x + w - 128, y + 6, { width: 124, height: 20 })
        } catch {/* ok */ }
    }

    const prot = data.protocolo ? `Protocolo de Autorização: ${data.protocolo}` : 'Aguardando autorização SEFAZ'
    const dhProt = data.dhProtocolo ? ` – ${fmtDateTime(data.dhProtocolo)}` : ''
    doc.font(FONT.regular).fontSize(FONT.size.label).fillColor(COLOR.gray)
        .text(prot + dhProt, x + 2, y + h - 10, { width: w - 4, align: 'left' })

    return y + h
}
