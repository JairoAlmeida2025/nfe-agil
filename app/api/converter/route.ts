/**
 * app/api/converter/route.ts
 *
 * POST /api/converter
 *
 * Recebe 1 ou mais XMLs via FormData, converte para DANFE PDF
 * via MeuDanfe API (gratuito), e retorna:
 *  - 1 arquivo: PDF direto
 *  - 2+ arquivos: ZIP contendo todos os PDFs
 *
 * Limites:
 *  - Starter: 50 PDFs/mês (via conversion_usage)
 *  - Pro/Trial/Lifetime: ilimitado
 *  - Max 50 arquivos por request
 */

import { NextRequest, NextResponse } from 'next/server'
import JSZip from 'jszip'
import { getOwnerUserId } from '@/lib/get-owner-id'
import { converterXmlParaDanfe } from '@/services/danfe.service'
import { getUserPlanInfo } from '@/lib/plan-gate'
import { supabaseAdmin } from '@/lib/supabase-admin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

const MAX_FILES_PER_REQUEST = 50
const STARTER_MONTHLY_LIMIT = 50

// ── Helpers ─────────────────────────────────────────────────────────────

function getCurrentMonthYear(): string {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

async function getMonthlyUsage(userId: string): Promise<number> {
    const monthYear = getCurrentMonthYear()
    const { data } = await supabaseAdmin
        .from('conversion_usage')
        .select('count')
        .eq('user_id', userId)
        .eq('month_year', monthYear)
        .single()
    return data?.count ?? 0
}

async function incrementUsage(userId: string, amount: number): Promise<void> {
    const monthYear = getCurrentMonthYear()

    // Upsert: incrementa se existe, cria se não
    const { data: existing } = await supabaseAdmin
        .from('conversion_usage')
        .select('id, count')
        .eq('user_id', userId)
        .eq('month_year', monthYear)
        .single()

    if (existing) {
        await supabaseAdmin
            .from('conversion_usage')
            .update({
                count: existing.count + amount,
                updated_at: new Date().toISOString()
            })
            .eq('id', existing.id)
    } else {
        await supabaseAdmin
            .from('conversion_usage')
            .insert({
                user_id: userId,
                month_year: monthYear,
                count: amount
            })
    }
}

// Extrai o número da nota do XML para nomear o arquivo
function extractNFeNumber(xmlContent: string): string {
    const match = xmlContent.match(/<nNF>(\d+)<\/nNF>/)
    return match?.[1] ?? 'sem-numero'
}

// ── POST Handler ─────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
    try {
        // 1. Auth
        const userId = await getOwnerUserId()
        if (!userId) {
            return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })
        }

        // 2. Plano e limites
        const { slug } = await getUserPlanInfo()
        if (!slug) {
            return NextResponse.json(
                { error: 'Assinatura inativa. Escolha um plano para continuar.' },
                { status: 403 }
            )
        }

        const isStarter = slug === 'starter'
        let currentUsage = 0

        if (isStarter) {
            currentUsage = await getMonthlyUsage(userId)
        }

        // 3. Parse FormData
        const formData = await request.formData()
        const files = formData.getAll('files') as File[]

        if (!files || files.length === 0) {
            return NextResponse.json(
                { error: 'Nenhum arquivo XML enviado.' },
                { status: 400 }
            )
        }

        if (files.length > MAX_FILES_PER_REQUEST) {
            return NextResponse.json(
                { error: `Máximo de ${MAX_FILES_PER_REQUEST} arquivos por vez.` },
                { status: 400 }
            )
        }

        // Verificar limite Starter
        if (isStarter && (currentUsage + files.length) > STARTER_MONTHLY_LIMIT) {
            const remaining = Math.max(0, STARTER_MONTHLY_LIMIT - currentUsage)
            return NextResponse.json(
                {
                    error: `Limite mensal atingido. Você usou ${currentUsage} de ${STARTER_MONTHLY_LIMIT} conversões. Restam ${remaining}.`,
                    code: 'LIMIT_REACHED',
                    usage: currentUsage,
                    limit: STARTER_MONTHLY_LIMIT,
                    remaining
                },
                { status: 429 }
            )
        }

        // 4. Converter cada XML
        const results: { filename: string; buffer: Buffer; success: boolean; error?: string }[] = []

        for (const file of files) {
            try {
                const xmlContent = await file.text()

                if (!xmlContent.trim() || !xmlContent.includes('<nfeProc') && !xmlContent.includes('<NFe')) {
                    results.push({
                        filename: file.name,
                        buffer: Buffer.alloc(0),
                        success: false,
                        error: 'Arquivo não parece ser um XML de NF-e válido.'
                    })
                    continue
                }

                const nfeNumber = extractNFeNumber(xmlContent)
                const { buffer } = await converterXmlParaDanfe(xmlContent)

                results.push({
                    filename: `DANFE-${nfeNumber}.pdf`,
                    buffer,
                    success: true
                })
            } catch (err: any) {
                results.push({
                    filename: file.name,
                    buffer: Buffer.alloc(0),
                    success: false,
                    error: err.message || 'Erro na conversão.'
                })
            }
        }

        const successfulResults = results.filter(r => r.success)

        if (successfulResults.length === 0) {
            return NextResponse.json(
                {
                    error: 'Nenhum arquivo foi convertido com sucesso.',
                    details: results.map(r => ({ file: r.filename, error: r.error }))
                },
                { status: 422 }
            )
        }

        // 5. Registrar uso
        if (isStarter) {
            await incrementUsage(userId, successfulResults.length)
        }

        // 6. Retornar resultado
        if (successfulResults.length === 1) {
            // Retorna PDF direto
            const pdf = successfulResults[0]
            return new NextResponse(new Uint8Array(pdf.buffer), {
                status: 200,
                headers: {
                    'Content-Type': 'application/pdf',
                    'Content-Disposition': `attachment; filename="${pdf.filename}"`,
                    'Content-Length': pdf.buffer.length.toString(),
                    'X-Converted-Count': '1',
                    'X-Failed-Count': String(results.length - successfulResults.length),
                },
            })
        }

        // Múltiplos: gerar ZIP
        const zip = new JSZip()
        for (const pdf of successfulResults) {
            zip.file(pdf.filename, pdf.buffer)
        }

        const zipBuffer = await zip.generateAsync({
            type: 'uint8array',
            compression: 'DEFLATE',
            compressionOptions: { level: 6 }
        })

        return new NextResponse(zipBuffer as any, {
            status: 200,
            headers: {
                'Content-Type': 'application/zip',
                'Content-Disposition': 'attachment; filename="danfes.zip"',
                'Content-Length': zipBuffer.length.toString(),
                'X-Converted-Count': String(successfulResults.length),
                'X-Failed-Count': String(results.length - successfulResults.length),
            },
        })

    } catch (err: any) {
        console.error('[Converter] Erro fatal:', err.message)
        return NextResponse.json(
            { error: 'Erro interno ao processar a conversão.', details: err.message },
            { status: 500 }
        )
    }
}

// ── GET: Retorna uso mensal ─────────────────────────────────────────────

export async function GET() {
    try {
        const userId = await getOwnerUserId()
        if (!userId) {
            return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })
        }

        const { slug } = await getUserPlanInfo()
        const currentUsage = await getMonthlyUsage(userId)

        return NextResponse.json({
            usage: currentUsage,
            limit: slug === 'starter' ? STARTER_MONTHLY_LIMIT : null,
            remaining: slug === 'starter' ? Math.max(0, STARTER_MONTHLY_LIMIT - currentUsage) : null,
            plan: slug,
            unlimited: slug !== 'starter'
        })
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 })
    }
}
