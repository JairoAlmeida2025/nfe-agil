/**
 * app/api/nfe/[id]/pdf/route.ts
 *
 * Endpoint GET /api/nfe/[id]/pdf
 *
 * Fluxo:
 *  1. Valida autenticação (getOwnerUserId)
 *  2. Busca NF-e no Supabase validando user_id (multi-tenant)
 *  3. Verifica existência do XML
 *  4. Converte XML → DanfeData via parser
 *  5. Gera PDF via engine PDFKit (renderDanfe)
 *  6. Retorna inline como application/pdf
 *
 * Serverless-safe: sem Puppeteer, sem Chromium, sem filesystem.
 */

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { getOwnerUserId } from '@/lib/get-owner-id'
import { parseXmlToDANFE } from '@/lib/danfe/parser'
import { renderDanfe } from '@/lib/danfe/renderer'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(
    _request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        // ── 1. Autenticação e Multi-tenancy ───────────────────────────────────
        const ownerId = await getOwnerUserId()
        if (!ownerId) {
            return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })
        }

        const { id } = await params
        if (!id) {
            return NextResponse.json({ error: 'ID inválido.' }, { status: 400 })
        }

        // ── 2. Buscar NF-e (isolamento por user_id) ───────────────────────────
        const { data: nfe, error: dbError } = await supabaseAdmin
            .from('nfes')
            .select('id, chave, numero, xml_content, user_id, status')
            .eq('id', id)
            .eq('user_id', ownerId)
            .single()

        if (dbError || !nfe) {
            console.warn('[DANFE] NF-e não encontrada | id:', id, '| owner:', ownerId, '| err:', dbError?.message)
            return NextResponse.json(
                { error: 'NF-e não encontrada ou acesso negado.' },
                { status: 404 }
            )
        }

        // ── 3. Verificar XML ──────────────────────────────────────────────────
        if (!nfe.xml_content) {
            return NextResponse.json(
                { error: 'XML ainda não disponível pela SEFAZ.', code: 'XML_NOT_AVAILABLE' },
                { status: 422 }
            )
        }

        const xml = nfe.xml_content as string

        console.log('[DANFE] Parsing XML | NF-e:', nfe.numero ?? id, '| Chave:', nfe.chave?.slice(-8) ?? '?')

        // ── 4. Parser XML → DanfeData ─────────────────────────────────────────
        const danfeData = parseXmlToDANFE(xml)

        // Garantir que o status de cancelamento venha também do banco
        if (nfe.status === 'cancelada') {
            danfeData.cancelada = true
        }

        console.log('[DANFE] Parser concluído | Produtos:', danfeData.produtos.length, '| Total:', danfeData.totais.vNF)

        // ── 5. Gerar PDF via engine PDFKit ────────────────────────────────────
        const pdfBuffer = await renderDanfe(danfeData)

        const numero = danfeData.numero || nfe.numero || id.slice(0, 8)
        const filename = `danfe-${numero}.pdf`

        console.log('[DANFE] PDF gerado:', filename, '|', pdfBuffer.length, 'bytes')

        // ── 6. Retornar inline ────────────────────────────────────────────────
        return new NextResponse(new Uint8Array(pdfBuffer), {
            status: 200,
            headers: {
                'Content-Type': 'application/pdf',
                'Content-Disposition': `inline; filename="${filename}"`,
                'Content-Length': pdfBuffer.length.toString(),
                'Cache-Control': 'no-store',
            },
        })

    } catch (err: any) {
        console.error('[DANFE] Erro fatal:', err.message, '\n', err.stack)
        return NextResponse.json(
            { error: 'Erro ao gerar o DANFE PDF.', details: err.message },
            { status: 500 }
        )
    }
}
