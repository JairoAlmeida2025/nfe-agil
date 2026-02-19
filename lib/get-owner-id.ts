/**
 * Resolve o "dono dos dados" de um usuário.
 *
 * Conceito de grupo:
 *   - Admin raiz (created_by = null) → dono = próprio id
 *   - Usuário criado por admin (created_by = <admin_id>) → dono = admin_id
 *
 * Todas as queries de empresa, certificado e NF-es devem filtrar
 * por `ownerUserId` em vez do `userId` do usuário logado diretamente.
 * Isso permite que membros de uma equipe compartilhem os mesmos dados.
 */

import { supabaseAdmin } from '@/lib/supabase-admin'
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'

/**
 * Retorna o user_id do usuário autenticado atualmente.
 * Retorna null se não houver sessão.
 */
export async function getAuthUserId(): Promise<string | null> {
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
    return user?.id ?? null
}

/**
 * Retorna o user_id do "dono" dos dados de negócio (empresa, certificado, NF-es).
 *
 * - Se o usuário foi criado por um admin → retorna o ID do admin
 * - Se é o admin raiz → retorna o próprio ID
 * - Se não autenticado → retorna null
 */
export async function getOwnerUserId(): Promise<string | null> {
    const userId = await getAuthUserId()
    if (!userId) return null

    const { data } = await supabaseAdmin
        .from('profiles')
        .select('id, created_by')
        .eq('id', userId)
        .single()

    if (!data) return userId  // fallback: usa o próprio id

    // Se tem um admin criador, usa o ID do admin como dono
    return data.created_by ?? data.id
}
