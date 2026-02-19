import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { processSefazSync } from '@/actions/nfe'

async function logCronResult(processed: number, successCount: number, errorCount: number, errors: any[]) {
    try {
        await supabaseAdmin.from('cron_logs').insert({
            executed_at: new Date().toISOString(),
            status: errorCount === 0 ? 'success' : (successCount > 0 ? 'partial_success' : 'error'),
            processed_count: processed,
            message: `Processado: ${successCount} sucesso, ${errorCount} erros.`,
            details: errors.length > 0 ? errors : null
        })
    } catch (e) {
        console.error('Falha ao salvar log do cron:', e)
    }
}

async function handleSync(req: NextRequest) {
    // Validação de segurança básica via CRON_SECRET
    const authHeader = req.headers.get('authorization')
    const secret = process.env.CRON_SECRET

    if (!secret || authHeader !== `Bearer ${secret}`) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Listar TODAS as empresas ativas para sync
    const { data: companies, error } = await supabaseAdmin
        .from('empresas')
        .select('user_id, cnpj')
        .eq('ativo', true)

    if (error || !companies) {
        return NextResponse.json({ error: 'Database error listing companies' }, { status: 500 })
    }

    console.log(`[Cron] Iniciando sync diária para ${companies.length} empresas...`)

    let totalImported = 0
    let successCount = 0
    let errorCount = 0
    const errors: any[] = []

    for (const company of companies) {
        try {
            // Chama a função interna de sync (reutilizada da action)
            // Essa função chama o micro-serviço e persiste no banco
            const result = await processSefazSync(company.user_id, company.cnpj)

            if (result.success) {
                totalImported += (result.importadas || 0)
                successCount++
            } else {
                errorCount++
                errors.push({ cnpj: company.cnpj, error: result.error })
                console.error(`[Cron] Erro ao sincronizar CNPJ ${company.cnpj}: ${result.error}`)
            }
        } catch (e: any) {
            errorCount++
            errors.push({ cnpj: company.cnpj, error: e.message })
            console.error(`[Cron] Exceção ao sincronizar CNPJ ${company.cnpj}:`, e)
        }
    }

    // Registrar log no banco
    await logCronResult(totalImported, successCount, errorCount, errors)

    return NextResponse.json({
        success: true,
        processed: totalImported,
        companies: {
            total: companies.length,
            success: successCount,
            failed: errorCount
        },
        errors: errors.length > 0 ? errors : undefined
    })
}

// Suporta GET (padrão Vercel Cron) e POST (padrão manual/API)
export async function GET(req: NextRequest) {
    return handleSync(req)
}

export async function POST(req: NextRequest) {
    return handleSync(req)
}
