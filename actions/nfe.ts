'use server'

import { revalidatePath } from 'next/cache'
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
import { supabaseAdmin } from '@/lib/supabase-admin'

// ── Helpers ───────────────────────────────────────────────────────────────────

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

// ── Server Action principal (Proxy para Backend Fiscal) ────────────────────────

export type SyncResult =
    | { success: true; importadas?: number; message: string }
    | { success: false; error: string }

export async function syncNFesFromSEFAZ(): Promise<SyncResult> {
    const user = await getAuthUser()
    if (!user) return { success: false, error: 'Não autenticado.' }

    // Buscar empresa ativa
    const { data: empresa } = await supabaseAdmin
        .from('empresas')
        .select('cnpj')
        .eq('user_id', user.id)
        .eq('ativo', true)
        .single()

    if (!empresa) {
        return { success: false, error: 'Nenhuma empresa configurada.' }
    }

    const cnpj = empresa.cnpj.replace(/\D/g, '')
    const backendUrl = process.env.SEFAZ_BACKEND_URL || 'http://localhost:3001'

    try {
        console.log(`[Next.js] Chamando Backend Fiscal em ${backendUrl}/nfe/sync...`)

        const response = await fetch(`${backendUrl}/nfe/sync`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                // Se o backend precisar de segredo, adicione aqui: 'x-api-key': process.env.SEFAZ_BACKEND_KEY
            },
            body: JSON.stringify({
                user_id: user.id,
                cnpj: cnpj
            }),
            cache: 'no-store'
        })

        if (!response.ok) {
            let errorMsg = `Erro HTTP ${response.status}`
            try {
                const errBody = await response.json()
                if (errBody.error) errorMsg = errBody.error
            } catch { } // Body não é JSON
            return { success: false, error: `Falha no Backend Fiscal: ${errorMsg}` }
        }

        const data = await response.json()

        revalidatePath('/dashboard')
        revalidatePath('/dashboard/nfe')

        return {
            success: true,
            importadas: data.result?.total ?? 0,
            message: `Sincronização concluída com sucesso. ${data.result?.total ?? 0} documentos processados.`
        }

    } catch (err: any) {
        console.error('[Next.js] Erro ao conectar ao Backend Fiscal:', err)
        return { success: false, error: `Erro de conexão com Backend Fiscal: ${err.message}` }
    }
}

// ── Listar NF-es (Leitura direta do banco) ───────────────────────────────────

export async function listNFes(params?: {
    dataInicio?: string
    dataFim?: string
}) {
    const user = await getAuthUser()
    if (!user) return []

    const now = new Date()
    const dataInicio = params?.dataInicio ?? new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
    const dataFim = params?.dataFim ?? new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59).toISOString()

    const { data, error } = await supabaseAdmin
        .from('nfes')
        .select('*')
        .eq('user_id', user.id)
        .gte('data_emissao', dataInicio)
        .lte('data_emissao', dataFim)
        .order('data_emissao', { ascending: false })

    if (error) return []
    return data
}

// ── Última sincronização ──────────────────────────────────────────────────────

export async function getLastSync(): Promise<string | null> {
    const user = await getAuthUser()
    if (!user) return null

    const { data } = await supabaseAdmin
        .from('nfe_sync_state')
        .select('ultima_sync')
        .eq('user_id', user.id)
        .limit(1)
        .single()

    return data?.ultima_sync ?? null
}

// ── Métricas e Status ────────────────────────────────────────────────────────

export interface DashboardMetrics {
    recebidosHoje: number
    pendentes: number
    totalMes: number
    ultimaSync: string | null
    integracaoStatus: 'ativa' | 'sem_certificado' | 'nunca_sincronizado'
}

export async function getDashboardMetrics(): Promise<DashboardMetrics> {
    const user = await getAuthUser()
    if (!user) {
        return {
            recebidosHoje: 0,
            pendentes: 0,
            totalMes: 0,
            ultimaSync: null,
            integracaoStatus: 'sem_certificado',
        }
    }

    const now = new Date()
    const inicioMes = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
    const fimMes = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59).toISOString()
    const inicioHoje = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString()
    const fimHoje = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59).toISOString()

    const [mesMes, hoje, pendentes, syncState] = await Promise.all([
        supabaseAdmin.from('nfes').select('id', { count: 'exact', head: true }).eq('user_id', user.id).gte('data_emissao', inicioMes).lte('data_emissao', fimMes),
        supabaseAdmin.from('nfes').select('id', { count: 'exact', head: true }).eq('user_id', user.id).gte('data_emissao', inicioHoje).lte('data_emissao', fimHoje),
        supabaseAdmin.from('nfes').select('id', { count: 'exact', head: true }).eq('user_id', user.id).is('xml_content', null).neq('status', 'cancelada'),
        supabaseAdmin.from('nfe_sync_state').select('ultima_sync').eq('user_id', user.id).single(),
    ])

    const ultimaSync = syncState.data?.ultima_sync ?? null
    let integracaoStatus: DashboardMetrics['integracaoStatus'] = 'nunca_sincronizado'
    if (ultimaSync) integracaoStatus = 'ativa'

    return {
        recebidosHoje: hoje.count ?? 0,
        pendentes: pendentes.count ?? 0,
        totalMes: mesMes.count ?? 0,
        ultimaSync,
        integracaoStatus,
    }
}
