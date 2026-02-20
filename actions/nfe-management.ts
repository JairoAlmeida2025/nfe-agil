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
 *   - Admin: userId próprio
 *   - User vinculado: userId do admin (created_by)
 *
 * Segurança:
 *   - Todas as queries filtram por user_id = ownerId (supabaseAdmin)
 *   - Isso bloqueia acesso IDOR cross-tenant
 *   - Usuário de outra empresa não acessa os dados
 */

import { revalidatePath } from 'next/cache'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { getAuthUserId, getOwnerUserId } from '@/lib/get-owner-id'

// ── Helper: Autenticação + Resolução do dono ──────────────────────────────────

/**
 * Garante que há usuário autenticado e retorna:
 * - authUserId: ID real do usuário logado
 * - ownerId: ID do "dono" dos dados (admin ou o próprio user)
 *
 * Lança erro se não autenticado.
 */
async function requireAuthWithOwner(): Promise<{ authUserId: string; ownerId: string }> {
    const authUserId = await getAuthUserId()
    if (!authUserId) throw new Error('Não autenticado. Faça login para continuar.')

    const ownerId = await getOwnerUserId()
    if (!ownerId) throw new Error('Não autenticado. Faça login para continuar.')

    return { authUserId, ownerId }
}

// ── Download XML ───────────────────────────────────────────────────────────────

/**
 * Retorna o conteúdo XML e chave de acesso de uma NF-e.
 *
 * Funciona para admin e para users vinculados à mesma empresa.
 * Bloqueia acesso cross-tenant (user de outra empresa → erro).
 */
export async function getNFeXmlContent(id: string) {
    const { ownerId } = await requireAuthWithOwner()

    // Usa supabaseAdmin + filtro explícito por user_id = ownerId
    // Isso contorna o RLS (que filtraria pelo auth.uid() do user)
    // e aplica o isolamento correto de multi-tenant
    const { data, error } = await supabaseAdmin
        .from('nfes')
        .select('xml_content, chave')
        .eq('id', id)
        .eq('user_id', ownerId)  // isolamento: só dados do dono/admin
        .single()

    if (error || !data) {
        console.warn('[getNFeXmlContent] Não encontrado | id:', id, '| ownerId:', ownerId, '| err:', error?.message)
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

/**
 * Deleta uma NF-e. Apenas o dono (admin) pode deletar.
 * Users vinculados NÃO podem deletar — somente o admin da conta.
 */
export async function deleteNFe(id: string) {
    const { authUserId, ownerId } = await requireAuthWithOwner()

    // Buscar o profile do usuário logado para verificar role
    const { data: profile } = await supabaseAdmin
        .from('profiles')
        .select('role')
        .eq('id', authUserId)
        .single()

    // Apenas admin pode deletar NF-es
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

// ── Atualizar Situação (Badge Modal) ──────────────────────────────────────────

/**
 * Atualiza a situação (confirmada/recusada) de uma NF-e.
 * Admin e users vinculados podem atualizar.
 */
export async function updateNFeSituacao(id: string, novaSituacao: 'confirmada' | 'recusada') {
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
