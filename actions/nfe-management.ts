'use server'

import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { revalidatePath } from 'next/cache'

// Inicializa Supabase para uso em Server Actions
function createClient() {
    const cookieStore = cookies()
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
                        // The `setAll` method was called from a Server Component.
                        // This can be ignored if you have middleware refreshing
                        // user sessions.
                    }
                },
            },
        }
    )
}

// ----------------------------------------------------------------------------
// Update Situação (Badge Modal)
// ----------------------------------------------------------------------------

export async function updateNFeSituacao(id: string, novaSituacao: 'confirmada' | 'recusada') {
    const supabase = createClient()

    // Atualiza apenas a situação local
    const { error } = await supabase
        .from('nfes')
        .update({ situacao: novaSituacao })
        .eq('id', id)

    if (error) {
        throw new Error(`Erro ao atualizar situação: ${error.message}`)
    }

    revalidatePath('/dashboard/nfe')
    return { success: true }
}

// ----------------------------------------------------------------------------
// Deletar Nota
// ----------------------------------------------------------------------------

export async function deleteNFe(id: string) {
    const supabase = createClient()

    const { error } = await supabase
        .from('nfes')
        .delete()
        .eq('id', id)

    if (error) {
        throw new Error(`Erro ao deletar nota: ${error.message}`)
    }

    revalidatePath('/dashboard/nfe')
    return { success: true }
}

// ----------------------------------------------------------------------------
// Download XML (Server-side fetch helper)
// ----------------------------------------------------------------------------
// Nota: Para download direto, geralmente é melhor returnar um Response ou stream,
// mas em Server Actions retornamos dados serializáveis.
// O client pode chamar este server action para obter o conteúdo base64/texto e criar Blob.

export async function getNFeXmlContent(id: string) {
    const supabase = createClient()

    // Busca XML content (que está salvo na coluna xml ou xml_content)
    // Conforme actions/nfe.ts, usamos xml_content
    const { data, error } = await supabase
        .from('nfes')
        .select('xml_content, chave')
        .eq('id', id)
        .single()

    if (error || !data) {
        throw new Error('XML não encontrado')
    }

    return {
        xml: data.xml_content || '',
        chave: data.chave
    }
}
