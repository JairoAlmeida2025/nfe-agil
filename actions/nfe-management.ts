'use server'

import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { revalidatePath } from 'next/cache'

// Inicializa Supabase para uso em Server Actions
async function createClient() {
    const cookieStore = await cookies()
    return createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                getAll() {
                    return cookieStore.getAll()
                },
                setAll(cookiesToSet) {
                    try {
                        cookiesToSet.forEach(({ name, value, options }) =>
                            cookieStore.set(name, value, options)
                        )
                    } catch {
                        // Ignorar em Server Components (read-only)
                    }
                },
            },
        }
    )
}

/**
 * Helper: obtém o userId da sessão atual.
 * Lança erro se não autenticado — fail-secure.
 */
async function requireAuth(): Promise<string> {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user?.id) throw new Error('Não autenticado. Faça login para continuar.')
    return user.id
}

// ── Update Situação (Badge Modal) ──────────────────────────────────────────────

export async function updateNFeSituacao(id: string, novaSituacao: 'confirmada' | 'recusada') {
    const userId = await requireAuth()
    const supabase = await createClient()

    // SECURITY: .eq('user_id', userId) garante que só o dono pode alterar
    const { error } = await supabase
        .from('nfes')
        .update({ situacao: novaSituacao })
        .eq('id', id)
        .eq('user_id', userId)

    if (error) {
        throw new Error(`Erro ao atualizar situação: ${error.message}`)
    }

    revalidatePath('/dashboard/nfe')
    return { success: true }
}

// ── Deletar Nota ───────────────────────────────────────────────────────────────

export async function deleteNFe(id: string) {
    const userId = await requireAuth()
    const supabase = await createClient()

    // SECURITY: .eq('user_id', userId) previne deleção de notas de outros usuários (IDOR)
    const { error } = await supabase
        .from('nfes')
        .delete()
        .eq('id', id)
        .eq('user_id', userId)

    if (error) {
        throw new Error(`Erro ao deletar nota: ${error.message}`)
    }

    revalidatePath('/dashboard/nfe')
    return { success: true }
}

// ── Download XML ───────────────────────────────────────────────────────────────

export async function getNFeXmlContent(id: string) {
    const userId = await requireAuth()
    const supabase = await createClient()

    // SECURITY: .eq('user_id', userId) previne acesso ao XML de outros usuários (IDOR)
    const { data, error } = await supabase
        .from('nfes')
        .select('xml_content, chave')
        .eq('id', id)
        .eq('user_id', userId)
        .single()

    if (error || !data) {
        throw new Error('XML não encontrado ou acesso negado.')
    }

    return {
        xml: data.xml_content || '',
        chave: data.chave
    }
}
