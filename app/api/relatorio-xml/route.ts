/**
 * app/api/relatorio-xml/route.ts
 *
 * POST /api/relatorio-xml
 *
 * Recebe XMLs via FormData, parseia server-side com parseXmlToDANFE(),
 * e retorna JSON com dados tabulares para exibir planilha e exportar XLSX.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getOwnerUserId } from '@/lib/get-owner-id'
import { parseXmlToDANFE, type DanfeData } from '@/lib/danfe/parser'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

interface ReportRow {
    tipo: string
    chave: string
    numero: string
    serie: string
    emissao: string
    natOp: string
    emitCnpj: string
    emitNome: string
    emitUf: string
    destCnpj: string
    destNome: string
    destUf: string
    valorProdutos: number
    valorNF: number
    valorICMS: number
    valorPIS: number
    valorCOFINS: number
    valorIPI: number
    valorFrete: number
    valorDesconto: number
    qtdItens: number
    protocolo: string
    cancelada: boolean
}

function danfeToRow(d: DanfeData): ReportRow {
    return {
        tipo: d.tpNF === '0' ? 'Entrada' : 'Saída',
        chave: d.chaveAcesso,
        numero: d.numero,
        serie: d.serie,
        emissao: d.dhEmi,
        natOp: d.natOp,
        emitCnpj: d.emitente.cnpj,
        emitNome: d.emitente.nome,
        emitUf: d.emitente.uf,
        destCnpj: d.destinatario.cnpj,
        destNome: d.destinatario.nome,
        destUf: d.destinatario.uf,
        valorProdutos: d.totais.vProd,
        valorNF: d.totais.vNF,
        valorICMS: d.totais.vICMS,
        valorPIS: d.totais.vPIS,
        valorCOFINS: d.totais.vCOFINS,
        valorIPI: d.totais.vIPI,
        valorFrete: d.totais.vFrete,
        valorDesconto: d.totais.vDesc,
        qtdItens: d.produtos.length,
        protocolo: d.protocolo,
        cancelada: d.cancelada,
    }
}

export async function POST(request: NextRequest) {
    try {
        const userId = await getOwnerUserId()
        if (!userId) {
            return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })
        }

        const formData = await request.formData()
        const files = formData.getAll('files') as File[]

        if (!files || files.length === 0) {
            return NextResponse.json({ error: 'Nenhum XML enviado.' }, { status: 400 })
        }

        if (files.length > 100) {
            return NextResponse.json({ error: 'Máximo 100 arquivos por vez.' }, { status: 400 })
        }

        const rows: ReportRow[] = []
        const errors: { filename: string; error: string }[] = []

        for (const file of files) {
            try {
                const xmlContent = await file.text()
                const danfe = parseXmlToDANFE(xmlContent)
                rows.push(danfeToRow(danfe))
            } catch (err: any) {
                errors.push({ filename: file.name, error: err.message || 'Erro ao parsear XML' })
            }
        }

        return NextResponse.json({
            rows,
            errors,
            total: files.length,
            success: rows.length,
            failed: errors.length,
        })
    } catch (err: any) {
        console.error('[Relatorio] Erro:', err.message)
        return NextResponse.json({ error: err.message }, { status: 500 })
    }
}
