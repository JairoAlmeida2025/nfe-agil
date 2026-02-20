/**
 * DanfePDF — Componente React PDF para geração do DANFE simplificado.
 * 
 * Sem dependências externas (sem Puppeteer, Chromium, ou fonts remotas).
 * Compatível com Vercel Serverless / Edge.
 */

import {
    Document,
    Page,
    Text,
    View,
    StyleSheet,
    type DocumentProps,
} from '@react-pdf/renderer'
import type { ReactElement } from 'react'

// ── Estilos ──────────────────────────────────────────────────────────────────

const S = StyleSheet.create({
    page: {
        fontFamily: 'Helvetica',
        fontSize: 8,
        padding: 20,
        color: '#1a1a1a',
        backgroundColor: '#ffffff',
    },
    container: {
        border: '1pt solid #000',
        padding: 8,
    },
    // Header
    header: {
        flexDirection: 'row',
        borderBottom: '1.5pt solid #000',
        paddingBottom: 8,
        marginBottom: 8,
    },
    emitente: {
        flex: 1,
        paddingRight: 10,
    },
    emitenteNome: {
        fontSize: 11,
        fontFamily: 'Helvetica-Bold',
        marginBottom: 2,
    },
    emitenteInfo: {
        fontSize: 7,
        color: '#444',
        marginBottom: 1,
    },
    danfeBox: {
        width: 140,
        borderLeft: '1pt solid #000',
        paddingLeft: 10,
        alignItems: 'center',
    },
    danfeTitle: {
        fontSize: 14,
        fontFamily: 'Helvetica-Bold',
        marginBottom: 2,
    },
    danfeSubtitle: {
        fontSize: 6,
        color: '#555',
        textAlign: 'center',
        marginBottom: 6,
    },
    danfeNumero: {
        fontSize: 11,
        fontFamily: 'Helvetica-Bold',
        marginTop: 4,
    },
    danfeSerie: {
        fontSize: 9,
        marginTop: 2,
    },
    entradaSaida: {
        fontSize: 6,
        textAlign: 'center',
        marginBottom: 2,
    },
    // Seções
    sectionTitle: {
        backgroundColor: '#ececec',
        fontFamily: 'Helvetica-Bold',
        fontSize: 7,
        padding: '3pt 5pt',
        marginTop: 8,
        marginBottom: 4,
        textTransform: 'uppercase',
        border: '0.5pt solid #999',
    },
    // Grid
    grid: {
        flexDirection: 'row',
        gap: 8,
        border: '0.5pt solid #ccc',
        padding: '6pt 8pt',
        flexWrap: 'wrap',
    },
    field: {
        flexDirection: 'column',
        flex: 1,
        minWidth: 80,
    },
    fieldWide: {
        flexDirection: 'column',
        flex: 2,
    },
    label: {
        fontSize: 6,
        fontFamily: 'Helvetica-Bold',
        color: '#666',
        textTransform: 'uppercase',
        marginBottom: 2,
    },
    value: {
        fontSize: 8,
        fontFamily: 'Helvetica-Bold',
    },
    valueLg: {
        fontSize: 10,
        fontFamily: 'Helvetica-Bold',
    },
    // Chave
    chaveBox: {
        border: '0.5pt solid #bbb',
        backgroundColor: '#f9f9f9',
        padding: '5pt 8pt',
        marginVertical: 4,
        textAlign: 'center',
    },
    chaveText: {
        fontSize: 7,
        letterSpacing: 1,
        fontFamily: 'Helvetica',
    },
    // Footer
    footer: {
        marginTop: 12,
        paddingTop: 6,
        borderTop: '0.5pt dashed #bbb',
        textAlign: 'center',
        fontSize: 6,
        color: '#888',
    },
    // Cancelada watermark
    canceladaWatermark: {
        position: 'absolute',
        top: 200,
        left: 60,
        fontSize: 65,
        fontFamily: 'Helvetica-Bold',
        color: '#ffcccc',
        transform: 'rotate(-30deg)',
    },
})

// ── Props ─────────────────────────────────────────────────────────────────────

export interface DanfePDFProps {
    emitNome: string
    emitEndereco: string
    emitCNPJ: string
    emitIE: string
    destNome: string
    destCNPJ: string
    nNF: string
    serie: string
    dhEmi: string
    natOp: string
    /** Valor total já formatado como BRL (ex: "R$ 1.500,00") */
    vNF: string
    chaveNFe: string
    cancelada: boolean
    fmtDate: (iso: string) => string
}

// ── Componente ────────────────────────────────────────────────────────────────

export function DanfePDF(props: DanfePDFProps): ReactElement<DocumentProps> {
    const {
        emitNome, emitEndereco, emitCNPJ, emitIE,
        destNome, destCNPJ,
        nNF, serie, dhEmi, natOp, vNF,
        chaveNFe, cancelada, fmtDate,
    } = props

    const chaveFormatada = chaveNFe.replace(/(.{4})/g, '$1 ').trim()

    return (
        <Document title={`DANFE NF-e Nº ${nNF}`} author={emitNome}>
            <Page size="A4" style={S.page}>

                {/* Marca d'água CANCELADA */}
                {cancelada && (
                    <Text style={S.canceladaWatermark}>CANCELADA</Text>
                )}

                <View style={S.container}>

                    {/* ── Header: Emitente + DANFE Info ────────────────────── */}
                    <View style={S.header}>
                        <View style={S.emitente}>
                            <Text style={S.emitenteNome}>{emitNome}</Text>
                            <Text style={S.emitenteInfo}>{emitEndereco}</Text>
                            <Text style={S.emitenteInfo}>CNPJ: {emitCNPJ}  |  IE: {emitIE}</Text>
                        </View>

                        <View style={S.danfeBox}>
                            <Text style={S.danfeTitle}>DANFE</Text>
                            <Text style={S.danfeSubtitle}>{'Documento Auxiliar da\nNota Fiscal Eletrônica'}</Text>
                            <Text style={S.entradaSaida}>{'0 - ENTRADA\n1 - SAÍDA'}</Text>
                            <Text style={S.danfeNumero}>Nº {nNF}</Text>
                            <Text style={S.danfeSerie}>SÉRIE: {serie}</Text>
                        </View>
                    </View>

                    {/* ── Chave de Acesso ──────────────────────────────────── */}
                    <Text style={S.sectionTitle}>CHAVE DE ACESSO</Text>
                    <View style={S.chaveBox}>
                        <Text style={S.chaveText}>{chaveFormatada}</Text>
                    </View>

                    {/* ── Natureza da Operação ─────────────────────────────── */}
                    <Text style={S.sectionTitle}>NATUREZA DA OPERAÇÃO</Text>
                    <View style={S.grid}>
                        <View style={S.fieldWide}>
                            <Text style={S.label}>Descrição</Text>
                            <Text style={S.value}>{natOp || 'N/I'}</Text>
                        </View>
                        <View style={S.field}>
                            <Text style={S.label}>Protocolo de Autorização</Text>
                            <Text style={S.value}>Consultar SEFAZ</Text>
                        </View>
                    </View>

                    {/* ── Destinatário ─────────────────────────────────────── */}
                    <Text style={S.sectionTitle}>DESTINATÁRIO / REMETENTE</Text>
                    <View style={S.grid}>
                        <View style={S.fieldWide}>
                            <Text style={S.label}>Nome / Razão Social</Text>
                            <Text style={S.value}>{destNome || 'N/I'}</Text>
                        </View>
                        <View style={S.field}>
                            <Text style={S.label}>CNPJ / CPF</Text>
                            <Text style={S.value}>{destCNPJ || 'N/I'}</Text>
                        </View>
                        <View style={S.field}>
                            <Text style={S.label}>Inscrição Estadual</Text>
                            <Text style={S.value}>ISENTO</Text>
                        </View>
                    </View>

                    {/* ── Datas ────────────────────────────────────────────── */}
                    <Text style={S.sectionTitle}>DATAS</Text>
                    <View style={S.grid}>
                        <View style={S.field}>
                            <Text style={S.label}>Data de Emissão</Text>
                            <Text style={S.value}>{fmtDate(dhEmi)}</Text>
                        </View>
                        <View style={S.field}>
                            <Text style={S.label}>Data de Entrada/Saída</Text>
                            <Text style={S.value}>{fmtDate(dhEmi)}</Text>
                        </View>
                        <View style={S.field}>
                            <Text style={S.label}>Hora de Entrada/Saída</Text>
                            <Text style={S.value}>00:00:00</Text>
                        </View>
                    </View>

                    {/* ── Cálculo do Imposto ───────────────────────────────── */}
                    <Text style={S.sectionTitle}>CÁLCULO DO IMPOSTO</Text>
                    <View style={S.grid}>
                        <View style={S.field}>
                            <Text style={S.label}>Base Cálc. ICMS</Text>
                            <Text style={S.value}>R$ 0,00</Text>
                        </View>
                        <View style={S.field}>
                            <Text style={S.label}>Valor ICMS</Text>
                            <Text style={S.value}>R$ 0,00</Text>
                        </View>
                        <View style={S.field}>
                            <Text style={S.label}>Valor PIS</Text>
                            <Text style={S.value}>R$ 0,00</Text>
                        </View>
                        <View style={S.field}>
                            <Text style={S.label}>Valor COFINS</Text>
                            <Text style={S.value}>R$ 0,00</Text>
                        </View>
                        <View style={S.field}>
                            <Text style={S.label}>Valor Total da NF-e</Text>
                            <Text style={S.valueLg}>{vNF}</Text>
                        </View>
                    </View>

                    {/* ── Footer ──────────────────────────────────────────── */}
                    <Text style={S.footer}>
                        {'Este documento é uma representação simplificada da NF-e. ' +
                            'A validade jurídica é garantida pela assinatura digital do emitente e autorização de uso pela SEFAZ.'}
                    </Text>
                </View>
            </Page>
        </Document>
    )
}
