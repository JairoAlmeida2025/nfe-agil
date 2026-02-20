/**
 * lib/danfe/layout.ts
 *
 * Define as constantes de layout do DANFE em pontos PDF (pt).
 * 1mm ≈ 2.835pt. Página A4 = 595.28 x 841.89pt.
 *
 * Todas as medidas são em pontos (pt), sistema nativo do PDFKit.
 * Estrutura modular: cada bloco é uma constante separada.
 */

// ── Página A4 ─────────────────────────────────────────────────────────────────

export const PAGE = {
    width: 595.28,
    height: 841.89,
    margin: 14.17,       // ~5mm
    marginTop: 14.17,
    get contentWidth() { return this.width - this.margin * 2 },
}

// ── Grid de colunas internas ──────────────────────────────────────────────────

export const GRID = {
    // Largura útil é PAGE.contentWidth
    // Colunas principais do cabeçalho
    emitWidth: 310,           // ~110mm - bloco emitente
    danfeBoxWidth: 135,       // ~47mm - caixa DANFE central
    nfNumWidth: 120,          // ~42mm - número/série NF
}

// ── Alturas de blocos (pt) ────────────────────────────────────────────────────

export const BLOCK_HEIGHT = {
    headerLogo: 60,       // Bloco emitente + DANFE
    chaveAcesso: 32,      // Chave de acesso
    natOp: 22,            // Natureza operação
    ie: 22,               // IE / IE ST / CNPJ
    destinatario: 42,     // Bloco destinatário
    faturas: 22,          // Duplicatas
    calc: 34,             // Cálculo imposto
    transp: 28,           // Transportador + Volumes
    prodHeader: 18,       // Cabeçalho tabela produtos
    prodRow: 16,          // Cada linha de produto
    infAdic: 50,          // Info adicional
    rodape: 20,           // Rodapé
}

// ── Tipografia ────────────────────────────────────────────────────────────────

export const FONT = {
    regular: 'Helvetica',
    bold: 'Helvetica-Bold',
    italic: 'Helvetica-Oblique',

    size: {
        label: 6,           // Rótulos de campo
        value: 7.5,         // Valores de campo
        danfe: 14,          // Título "DANFE"
        nf: 10,             // Número NF
        sectionTitle: 6.5,  // Títulos de seção
        chave: 6.8,         // Chave de acesso
        prodHeader: 6.5,    // Cabeçalho tabela
        prodRow: 6.5,       // Linhas tabela
        footer: 6,          // Rodapé
    },
}

// ── Cores ─────────────────────────────────────────────────────────────────────

export const COLOR = {
    black: '#000000',
    gray: '#444444',
    lightGray: '#888888',
    sectionBg: '#ececec',     // Fundo de rótulos de campo
    border: '#000000',
    cancelRed: '#CC0000',
    white: '#ffffff',
}

// ── Tabela de Produtos — Colunas ──────────────────────────────────────────────
// Largura de cada coluna (em pt), soma deve ser <= PAGE.contentWidth

export const PROD_COLS = {
    item: { label: 'Nº', w: 20 },
    codigo: { label: 'Código', w: 40 },
    descricao: { label: 'Descrição', w: 165 },
    ncm: { label: 'NCM/SH', w: 42 },
    cfop: { label: 'CFOP', w: 28 },
    unid: { label: 'Un.', w: 22 },
    qtde: { label: 'Qtd.', w: 35 },
    vUnit: { label: 'Vl. Unit.', w: 46 },
    vTotal: { label: 'Vl. Total', w: 46 },
    // Total: 444pt — ligeiramente abaixo de PAGE.contentWidth (~567pt)
    // Restante usado para margens internas das células
}

// ── Helpers de formatação ─────────────────────────────────────────────────────

/**
 * Formata número como moeda BRL.
 */
export function brl(value: number): string {
    if (isNaN(value)) return '0,00'
    return value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

/**
 * Formata número com N casas decimais.
 */
export function numBR(value: number, decimals = 4): string {
    return value.toLocaleString('pt-BR', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
}

/**
 * Formata data ISO para pt-BR (dd/MM/yyyy).
 */
export function fmtDate(iso: string): string {
    if (!iso) return ''
    try {
        const d = new Date(iso)
        return d.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })
    } catch { return iso }
}

/**
 * Formata data e hora ISO para pt-BR.
 */
export function fmtDateTime(iso: string): string {
    if (!iso) return ''
    try {
        const d = new Date(iso)
        return d.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })
    } catch { return iso }
}

/**
 * Tronca texto para caber em largura (estimativa: ~1.8pt por caractere no font 6.5pt).
 */
export function truncate(text: string, maxChars: number): string {
    if (text.length <= maxChars) return text
    return text.slice(0, maxChars - 1) + '…'
}
