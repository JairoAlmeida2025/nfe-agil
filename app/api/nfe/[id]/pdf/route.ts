import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { gerarPDF } from '@alexssmusica/node-pdf-nfe'
import { Readable } from 'stream'

// Força execução em Node.js runtime (não Edge) — necessário para stream e gerarPDF
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

async function getAuthUser() {
    const cookieStore = await cookies()
    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                getAll: () => cookieStore.getAll(),
                setAll: () => { },
            },
        }
    )
    const { data: { user } } = await supabase.auth.getUser()
    return user
}

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        // 1. Autenticação
        const user = await getAuthUser()
        if (!user) {
            return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })
        }

        const { id } = await params

        if (!id || typeof id !== 'string') {
            return NextResponse.json({ error: 'ID inválido.' }, { status: 400 })
        }

        // 2. Buscar NF-e com validação multi-tenant (user_id)
        const { data: nfe, error: dbError } = await supabaseAdmin
            .from('nfes')
            .select('id, chave, numero, xml_content, user_id, status')
            .eq('id', id)
            .eq('user_id', user.id)   // SECURITY: garante isolamento por usuário
            .single()

        if (dbError || !nfe) {
            return NextResponse.json(
                { error: 'NF-e não encontrada ou acesso negado.' },
                { status: 404 }
            )
        }

        // 3. Verificar se XML está disponível
        if (!nfe.xml_content) {
            return NextResponse.json(
                {
                    error: 'XML ainda não disponível pela SEFAZ.',
                    code: 'XML_NOT_AVAILABLE',
                },
                { status: 422 }
            )
        }

        // 4. Gerar DANFE
        // gerarPDF retorna um PDFDocument (stream PDFKit)
        const pdfDoc = await gerarPDF(nfe.xml_content, {
            cancelada: nfe.status === 'cancelada',
        })

        // 5. Converter stream PDFKit → Buffer
        const chunks: Buffer[] = []
        const buffer = await new Promise<Buffer>((resolve, reject) => {
            pdfDoc.on('data', (chunk: Buffer) => chunks.push(chunk))
            pdfDoc.on('end', () => resolve(Buffer.concat(chunks)))
            pdfDoc.on('error', reject)
            pdfDoc.end()
        })

        // 6. Retornar PDF como response com headers corretos
        const filename = nfe.numero
            ? `danfe-${nfe.numero}.pdf`
            : `danfe-${nfe.chave.slice(-8)}.pdf`

        return new NextResponse(new Uint8Array(buffer), {
            status: 200,
            headers: {
                'Content-Type': 'application/pdf',
                'Content-Disposition': `inline; filename="${filename}"`,
                'Content-Length': buffer.length.toString(),
                'Cache-Control': 'no-store',
            },
        })

    } catch (err: any) {
        console.error('[DANFE] Erro ao gerar PDF:', err.message)

        // Erro específico de XML malformado
        if (err.message?.includes('parse') || err.message?.includes('XML')) {
            return NextResponse.json(
                { error: 'XML da NF-e inválido ou malformado.', code: 'INVALID_XML' },
                { status: 422 }
            )
        }

        return NextResponse.json(
            { error: 'Erro interno ao gerar o DANFE.', details: err.message },
            { status: 500 }
        )
    }
}
