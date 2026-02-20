'use server'

/**
 * actions/nfe-management.ts
 *
 * Server Actions para operações de gestão de NF-es:
 * - getNFeXmlContent: download do XML
 * - deleteNFe: exclusão
 * - updateNFeSituacao: atualização de situação (badge)
 *
 * Multi-tenant: usa getOwnerUserId() para resolver o dono dos dados.
 */

import { revalidatePath } from 'next/cache'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { getAuthUserId, getOwnerUserId } from '@/lib/get-owner-id'
import { NFE_STATUS } from '@/lib/constants'

// ── Helper: Autenticação + Resolução do dono ──────────────────────────────────

async function requireAuthWithOwner(): Promise<{ authUserId: string; ownerId: string }> {
    const authUserId = await getAuthUserId()
    if (!authUserId) throw new Error('Não autenticado. Faça login para continuar.')

    const ownerId = await getOwnerUserId()
    if (!ownerId) throw new Error('Não autenticado. Faça login para continuar.')

    return { authUserId, ownerId }
}

// ── Download XML ───────────────────────────────────────────────────────────────

export async function getNFeXmlContent(id: string) {
    const { ownerId } = await requireAuthWithOwner()

    const { data, error } = await supabaseAdmin
        .from('nfes')
        .select('xml_content, chave')
        .eq('id', id)
        .eq('user_id', ownerId)
        .single()

    if (error || !data) {
        throw new Error('XML não encontrado ou acesso negado.')
    }

    if (!data.xml_content) {
        throw new Error('XML ainda não disponível para esta nota.')
    }

    return {
        xml: data.xml_content,
        chave: data.chave,
    }
}

// ── Deletar Nota ───────────────────────────────────────────────────────────────

export async function deleteNFe(id: string) {
    const { authUserId, ownerId } = await requireAuthWithOwner()

    const { data: profile } = await supabaseAdmin
        .from('profiles')
        .select('role')
        .eq('id', authUserId)
        .single()

    if (profile?.role !== 'admin') {
        throw new Error('Apenas o administrador pode deletar notas fiscais.')
    }

    const { error } = await supabaseAdmin
        .from('nfes')
        .delete()
        .eq('id', id)
        .eq('user_id', ownerId)

    if (error) {
        throw new Error(`Erro ao deletar nota: ${error.message}`)
    }

    revalidatePath('/dashboard/nfe')
    return { success: true }
}

// ── Atualizar Situação ─────────────────────────────────────────────────────────

export async function updateNFeSituacao(id: string, novaSituacao: typeof NFE_STATUS.CONFIRMADA | typeof NFE_STATUS.RECUSADA) {
    const { ownerId } = await requireAuthWithOwner()

    const { error } = await supabaseAdmin
        .from('nfes')
        .update({ situacao: novaSituacao })
        .eq('id', id)
        .eq('user_id', ownerId)

    if (error) {
        throw new Error(`Erro ao atualizar situação: ${error.message}`)
    }

    revalidatePath('/dashboard/nfe')
    return { success: true }
}
