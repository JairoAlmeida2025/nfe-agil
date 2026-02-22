/**
 * app/api/download-lote/route.ts
 *
 * GET /api/download-lote?tipo=xml|pdf|ambos&period=...&from=...&to=...
 *
 * Gera um ZIP com XMLs e/ou PDFs (DANFEs) das NF-es do período filtrado.
 * Limites: 500 XMLs / 100 PDFs por download (timeout Vercel ~25s).
 *
 * Plan Gating: somente Pro/Trial/Lifetime.
 */

import { NextRequest, NextResponse } from 'next/server'
import JSZip from 'jszip'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { getOwnerUserId } from '@/lib/get-owner-id'
import { computeDateRangeBRT } from '@/lib/date-brt'
import { isStarterOnly } from '@/lib/plan-gate'
import { converterXmlParaDanfe } from '@/services/danfe.service'
import type { PeriodPreset } from '@/lib/constants'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60 // Vercel Pro permite até 60s

const DANFES_BUCKET = 'danfes'
const LIMIT_XML = 500
const LIMIT_PDF = 100

export async function GET(request: NextRequest) {
    try {
        // ── 1. Autenticação ──────────────────────────────────────────────────
        const ownerId = await getOwnerUserId()
        if (!ownerId) {
            return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })
        }

        // ── 2. Plan Gating (somente Pro/Trial/Lifetime) ──────────────────────
        const starterOnly = await isStarterOnly()
        if (starterOnly) {
            return NextResponse.json(
                { error: 'Download em lote é exclusivo do Plano Pro.' },
                { status: 403 }
            )
        }

        // ── 3. Query Params ──────────────────────────────────────────────────
        const { searchParams } = request.nextUrl
        const tipo = (searchParams.get('tipo') || 'xml') as 'xml' | 'pdf' | 'ambos'
        const period = (searchParams.get('period') || 'todos') as PeriodPreset
        const from = searchParams.get('from') || undefined
        const to = searchParams.get('to') || undefined

        const includePdf = tipo === 'pdf' || tipo === 'ambos'
        const includeXml = tipo === 'xml' || tipo === 'ambos'
        const limit = includePdf ? LIMIT_PDF : LIMIT_XML

        // ── 4. Buscar NF-es com XML disponível ──────────────────────────────
        let query = supabaseAdmin
            .from('nfes')
            .select('id, chave, numero, xml_content, data_emissao, emitente')
            .eq('user_id', ownerId)
            .not('xml_content', 'is', null)
            .order('data_emissao', { ascending: false })
            .limit(limit)

        // Filtro de período
        if (period && period !== 'todos') {
            const range = computeDateRangeBRT(period, from, to)
            if (range.from) query = query.gte('data_emissao', range.from)
            if (range.to) query = query.lte('data_emissao', range.to)
        }

        const { data: nfes, error: dbError } = await query

        if (dbError) {
            console.error('[Download Lote] Erro Supabase:', dbError.message)
            return NextResponse.json({ error: 'Erro ao buscar NF-es.' }, { status: 500 })
        }

        if (!nfes || nfes.length === 0) {
            return NextResponse.json(
                { error: 'Nenhuma NF-e com XML disponível no período selecionado.' },
                { status: 404 }
            )
        }

        console.log(`[Download Lote] Tipo: ${tipo} | Período: ${period} | NF-es encontradas: ${nfes.length}`)

        // ── 5. Montar ZIP ────────────────────────────────────────────────────
        const zip = new JSZip()
        let xmlCount = 0
        let pdfCount = 0
        let pdfErrors = 0

        for (const nfe of nfes) {
            const xmlContent = nfe.xml_content as string
            const chave = nfe.chave as string
            const nfeId = nfe.id as string

            // ── XML ──────────────────────────────────────────────────────────
            if (includeXml) {
                const folder = tipo === 'ambos' ? 'xmls/' : ''
                zip.file(`${folder}${chave}.xml`, xmlContent)
                xmlCount++
            }

            // ── PDF ──────────────────────────────────────────────────────────
            if (includePdf) {
                try {
                    let pdfBuffer: Buffer | null = null

                    // Tentar cache no bucket
                    const storagePath = `${ownerId}/${nfeId}.pdf`
                    const { data: cachedFile } = await supabaseAdmin
                        .storage
                        .from(DANFES_BUCKET)
                        .download(storagePath)

                    if (cachedFile) {
                        // Cache hit
                        const ab = await cachedFile.arrayBuffer()
                        pdfBuffer = Buffer.from(ab)
                    } else {
                        // Cache miss → gerar via MeuDanfe API
                        try {
                            const result = await converterXmlParaDanfe(xmlContent)
                            pdfBuffer = result.buffer

                            // Salvar no cache para próximas vezes
                            await supabaseAdmin.storage
                                .from(DANFES_BUCKET)
                                .upload(storagePath, pdfBuffer, {
                                    contentType: 'application/pdf',
                                    upsert: true,
                                })
                        } catch (pdfErr: any) {
                            console.warn(`[Download Lote] Falha PDF ${chave}:`, pdfErr.message)
                            pdfErrors++
                            continue
                        }
                    }

                    if (pdfBuffer) {
                        const numero = (nfe.numero as string) || chave.slice(-8)
                        const folder = tipo === 'ambos' ? 'pdfs/' : ''
                        zip.file(`${folder}danfe-${numero}.pdf`, pdfBuffer)
                        pdfCount++
                    }
                } catch (err: any) {
                    console.warn(`[Download Lote] Erro PDF ${chave}:`, err.message)
                    pdfErrors++
                }
            }
        }

        // ── 6. Gerar buffer do ZIP ───────────────────────────────────────────
        const totalFiles = xmlCount + pdfCount
        if (totalFiles === 0) {
            return NextResponse.json(
                { error: 'Nenhum arquivo pôde ser incluído no download.' },
                { status: 422 }
            )
        }

        const zipBuffer = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' })

        // Nome do arquivo
        const now = new Date()
        const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '')
        const zipName = `nfe-agil-${tipo}-${dateStr}.zip`

        console.log(`[Download Lote] ZIP gerado | ${totalFiles} arquivos | ${zipBuffer.length} bytes | XMLs: ${xmlCount} | PDFs: ${pdfCount} | Erros PDF: ${pdfErrors}`)

        return new NextResponse(zipBuffer as any, {
            status: 200,
            headers: {
                'Content-Type': 'application/zip',
                'Content-Disposition': `attachment; filename="${zipName}"`,
                'Content-Length': zipBuffer.length.toString(),
                'X-Xml-Count': String(xmlCount),
                'X-Pdf-Count': String(pdfCount),
                'X-Pdf-Errors': String(pdfErrors),
                'X-Total-Available': String(nfes.length),
            },
        })

    } catch (err: any) {
        console.error('[Download Lote] Erro fatal:', err.message)
        return NextResponse.json(
            { error: 'Erro ao gerar download em lote.', details: err.message },
            { status: 500 }
        )
    }
}
