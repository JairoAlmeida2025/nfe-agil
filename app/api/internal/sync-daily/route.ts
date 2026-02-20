import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { processSefazSync } from '@/actions/nfe'

// ── Endpoint chamado pelo Vercel Cron às 06:00 UTC (03:00 BRT)  ───────────────
// Vercel Cron jobs chamam via GET com header Authorization: Bearer <CRON_SECRET>

export const maxDuration = 300 // 5 minutos máximo (Vercel Pro)

export async function GET(req: NextRequest) {
    // Verificar autorização do Vercel Cron
    const authHeader = req.headers.get('Authorization')
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        // Em desenvolvimento, aceitar sem auth
        if (process.env.NODE_ENV !== 'development') {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }
    }

    const startTime = Date.now()
    console.log('[SyncDaily] Iniciando sync automático diário (Vercel Cron)...')

    try {
        // Buscar todas as empresas ativas
        const { data: empresas, error: empresasErr } = await supabaseAdmin
            .from('empresas')
            .select('cnpj, user_id, razao_social')
            .eq('ativo', true)
            .not('user_id', 'is', null)

        if (empresasErr || !empresas || empresas.length === 0) {
            console.error('[SyncDaily] Nenhuma empresa ativa:', empresasErr)
            return NextResponse.json({
                success: true,
                message: 'Nenhuma empresa ativa para sincronizar',
                processed: 0
            })
        }

        console.log(`[SyncDaily] ${empresas.length} empresa(s) para sincronizar`)

        let totalProcessed = 0
        const results: any[] = []

        for (const empresa of empresas) {
            const companyStart = Date.now()
            try {
                // Verificar bloqueio 656
                const { data: syncState } = await supabaseAdmin
                    .from('nfe_sync_state')
                    .select('blocked_until')
                    .eq('user_id', empresa.user_id)
                    .eq('empresa_cnpj', empresa.cnpj)
                    .maybeSingle()

                if (syncState?.blocked_until && new Date(syncState.blocked_until) > new Date()) {
                    console.warn(`[SyncDaily] ${empresa.cnpj} bloqueado até ${syncState.blocked_until}`)

                    await supabaseAdmin.from('cron_logs').insert({
                        executed_at: new Date().toISOString(),
                        duration: '0ms',
                        processed_count: 0,
                        status: 'blocked_656',
                        message: `Bloqueado por erro 656 até ${syncState.blocked_until}`,
                        user_id: empresa.user_id,
                        empresa_cnpj: empresa.cnpj
                    })

                    results.push({ cnpj: empresa.cnpj, status: 'blocked_656' })
                    continue
                }

                console.log(`[SyncDaily] Sincronizando ${empresa.cnpj} (${empresa.razao_social})...`)
                const result = await processSefazSync(empresa.user_id, empresa.cnpj)

                if (result.success) {
                    totalProcessed += result.importadas
                    results.push({ cnpj: empresa.cnpj, status: 'success', imported: result.importadas })
                    console.log(`[SyncDaily] ✅ ${empresa.cnpj}: ${result.importadas} importados em ${Date.now() - companyStart}ms`)
                } else {
                    results.push({ cnpj: empresa.cnpj, status: 'error', error: result.error })
                    console.error(`[SyncDaily] ❌ ${empresa.cnpj}: ${result.error}`)
                }

            } catch (err: any) {
                console.error(`[SyncDaily] Exceção empresa ${empresa.cnpj}:`, err.message)
                results.push({ cnpj: empresa.cnpj, status: 'error', error: err.message })

                try {
                    await supabaseAdmin.from('cron_logs').insert({
                        executed_at: new Date().toISOString(),
                        duration: `${Date.now() - companyStart}ms`,
                        processed_count: 0,
                        status: 'error',
                        message: `Exceção: ${err.message}`,
                        user_id: empresa.user_id,
                        empresa_cnpj: empresa.cnpj
                    })
                } catch { }
            }
        }

        const totalDuration = `${Date.now() - startTime}ms`
        console.log(`[SyncDaily] Concluído em ${totalDuration}. Total: ${totalProcessed} importados`)

        return NextResponse.json({
            success: true,
            duration: totalDuration,
            totalProcessed,
            empresasProcessadas: empresas.length,
            results
        })

    } catch (err: any) {
        console.error('[SyncDaily] Erro fatal:', err)
        return NextResponse.json(
            { success: false, error: err.message },
            { status: 500 }
        )
    }
}
