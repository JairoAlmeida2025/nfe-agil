/**
 * app/api/nfe/[id]/pdf/route.ts
 *
 * GET /api/nfe/[id]/pdf
 *
 * Fluxo:
 *  1. Valida autenticação (getOwnerUserId) — multi-tenant
 *  2. Busca NF-e no Supabase (filtro user_id)
 *  3. Verifica existência do XML
 *  4. Verifica cache no bucket Storage "danfes/{id}.pdf"
 *     → Se existir: retorna diretamente (signed URL ou buffer)
 *  5. Envia XML para MeuDanfe API → recebe PDF em base64
 *  6. Salva PDF no bucket "danfes/{id}.pdf" (cache)
 *  7. Retorna PDF inline
 *
 * Serverless-safe: sem Puppeteer, sem Chromium, sem PDFKit local.
 * Geração delegada à API MeuDanfe (SaaS externo).
 */

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { getOwnerUserId } from '@/lib/get-owner-id'
import { converterXmlParaDanfe } from '@/services/danfe.service'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const DANFES_BUCKET = 'danfes'

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
            console.warn('[DANFE] NF-e não encontrada | id:', id, '| owner:', ownerId)
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

        const numero = nfe.numero || id.slice(0, 8)
        const filename = `danfe-${numero}.pdf`
        const storagePath = `${ownerId}/${id}.pdf`   // isolamento por tenant

        // ── 4. Cache: verificar se PDF já existe no bucket ────────────────────
        const { data: existingFile } = await supabaseAdmin
            .storage
            .from(DANFES_BUCKET)
            .download(storagePath)

        if (existingFile) {
            console.log('[DANFE] Cache hit | path:', storagePath)
            const cached = await existingFile.arrayBuffer()
            return new NextResponse(cached, {
                status: 200,
                headers: {
                    'Content-Type': 'application/pdf',
                    'Content-Disposition': `inline; filename="${filename}"`,
                    'Content-Length': cached.byteLength.toString(),
                    'Cache-Control': 'private, max-age=3600',
                    'X-Danfe-Source': 'cache',
                },
            })
        }

        // ── 5. Converter via MeuDanfe API ─────────────────────────────────────
        console.log('[DANFE] Cache miss | Gerando via MeuDanfe API | NF:', numero)

        const { buffer: pdfBuffer } = await converterXmlParaDanfe(nfe.xml_content as string)

        // ── 6. Salvar no bucket Storage (cache para próximas requisições) ──────
        const { error: uploadError } = await supabaseAdmin
            .storage
            .from(DANFES_BUCKET)
            .upload(storagePath, pdfBuffer, {
                contentType: 'application/pdf',
                upsert: true,
                // Metadados para rastreabilidade
                duplex: 'half',
            })

        if (uploadError) {
            // Falha no cache não impede retornar o PDF — apenas loga
            console.warn('[DANFE] Falha ao salvar PDF no cache:', uploadError.message)
        } else {
            console.log('[DANFE] PDF salvo no cache | path:', storagePath, '|', pdfBuffer.length, 'bytes')
        }

        // ── 7. Retornar PDF inline ────────────────────────────────────────────
        return new NextResponse(new Uint8Array(pdfBuffer), {
            status: 200,
            headers: {
                'Content-Type': 'application/pdf',
                'Content-Disposition': `inline; filename="${filename}"`,
                'Content-Length': pdfBuffer.length.toString(),
                'Cache-Control': 'private, max-age=3600',
                'X-Danfe-Source': 'meudanfe-api',
            },
        })

    } catch (err: any) {
        console.error('[DANFE] Erro fatal:', err.message, '\n', err.stack)

        // Erros específicos da API externa
        if (err.message?.includes('MEUDANFE_API_KEY')) {
            return NextResponse.json(
                { error: 'Configuração de integração ausente. Contate o suporte.' },
                { status: 503 }
            )
        }

        if (err.message?.includes('MeuDanfe API retornou erro')) {
            return NextResponse.json(
                { error: 'Falha ao gerar DANFE via serviço externo. Tente novamente.', details: err.message },
                { status: 502 }
            )
        }

        return NextResponse.json(
            { error: 'Erro ao gerar o DANFE PDF.', details: err.message },
            { status: 500 }
        )
    }
}

/**
 * DELETE /api/nfe/[id]/pdf
 * Invalida o cache do DANFE para forçar re-geração.
 */
export async function DELETE(
    _request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const ownerId = await getOwnerUserId()
    if (!ownerId) {
        return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })
    }

    const { id } = await params
    const storagePath = `${ownerId}/${id}.pdf`

    const { error } = await supabaseAdmin.storage.from(DANFES_BUCKET).remove([storagePath])

    if (error) {
        return NextResponse.json({ error: 'Falha ao remover cache.' }, { status: 500 })
    }

    return NextResponse.json({ ok: true, message: 'Cache removido. Próxima requisição irá re-gerar o PDF.' })
}
