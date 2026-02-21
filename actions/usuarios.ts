'use server'

import { revalidatePath } from 'next/cache'
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { PERMISSIONS, type UserRole } from '@/lib/permissions'

export type TeamMember = {
    id: string
    nome: string | null
    email: string | null
    role: UserRole
    createdAt: string
    createdBy: string | null
    lastSignIn: string | null
}

export type ActionResult =
    | { success: true; message?: string }
    | { success: false; error: string }

// ── Helper: obter user autenticado com role e empresa ─────────────────────────

async function getAuthUserWithRole(): Promise<{
    id: string
    role: UserRole
    empresa_id: string | null
} | null> {
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
    if (!user) return null

    const { data: profile } = await supabaseAdmin
        .from('profiles')
        .select('role, empresa_id')
        .eq('id', user.id)
        .single()

    if (!profile) return null

    return {
        id: user.id,
        role: profile.role as UserRole,
        empresa_id: profile.empresa_id,
    }
}

// ── Verificar role do usuário atual ──────────────────────────────────────────

export async function getCurrentUserRole(): Promise<UserRole | null> {
    const user = await getAuthUserWithRole()
    return user?.role ?? null
}

// ── Verificar se o usuário tem uma permissão específica ──────────────────────

export async function hasPermission(permission: string): Promise<boolean> {
    const user = await getAuthUserWithRole()
    if (!user) return false
    return PERMISSIONS[user.role].includes(permission)
}

// ── Listar membros da equipe (isolados por empresa) ───────────────────────────

export async function listTeamMembers(): Promise<TeamMember[]> {
    const currentUser = await getAuthUserWithRole()
    if (!currentUser || currentUser.role !== 'admin') return []

    // Buscar a empresa do usuário atual
    const empresaId = currentUser.empresa_id
    if (!empresaId) return []

    // Buscar apenas membros da MESMA empresa
    const { data: membros } = await supabaseAdmin
        .from('empresa_membros')
        .select('user_id, role, created_at, created_by')
        .eq('empresa_id', empresaId)
        .order('created_at', { ascending: true })

    if (!membros?.length) return []

    const memberIds = membros.map(m => m.user_id)

    // Buscar profiles desses membros
    const { data: profiles } = await supabaseAdmin
        .from('profiles')
        .select('id, nome')
        .in('id', memberIds)

    const profileMap = new Map(
        (profiles ?? []).map(p => [p.id, p])
    )

    // Buscar emails dos auth.users
    const { data: authUsers } = await supabaseAdmin.auth.admin.listUsers()
    const authMap = new Map(
        (authUsers?.users ?? []).map(u => [u.id, {
            email: u.email ?? null,
            lastSignIn: u.last_sign_in_at ?? null,
        }])
    )

    return membros.map(m => ({
        id: m.user_id,
        nome: profileMap.get(m.user_id)?.nome ?? null,
        email: authMap.get(m.user_id)?.email ?? null,
        role: m.role as UserRole,
        createdAt: m.created_at,
        createdBy: m.created_by,
        lastSignIn: authMap.get(m.user_id)?.lastSignIn ?? null,
    }))
}

// ── Criar novo membro da equipe (isolado por empresa) ─────────────────────────

export async function createTeamMember(params: {
    nome: string
    email: string
    senha: string
    role: UserRole
}): Promise<ActionResult> {
    const currentUser = await getAuthUserWithRole()
    if (!currentUser || currentUser.role !== 'admin') {
        return { success: false, error: 'Apenas administradores podem criar usuários.' }
    }

    const empresaId = currentUser.empresa_id
    if (!empresaId) {
        return { success: false, error: 'Sua conta não está vinculada a nenhuma empresa.' }
    }

    const { nome, email, senha, role } = params

    if (!nome?.trim()) return { success: false, error: 'Nome é obrigatório.' }
    if (!email?.trim()) return { success: false, error: 'E-mail é obrigatório.' }
    if (!senha || senha.length < 8) return { success: false, error: 'Senha deve ter no mínimo 8 caracteres.' }

    // Criar usuário no Supabase Auth
    const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
        email: email.trim().toLowerCase(),
        password: senha,
        email_confirm: true,
        user_metadata: { full_name: nome.trim() },
    })

    if (createError) {
        if (createError.message.includes('already been registered') || createError.message.includes('already exists')) {
            return { success: false, error: 'Este e-mail já está cadastrado no sistema.' }
        }
        return { success: false, error: `Erro ao criar usuário: ${createError.message}` }
    }

    if (!newUser?.user) {
        return { success: false, error: 'Falha ao criar usuário. Tente novamente.' }
    }

    // Atualizar profile com nome, role, created_by e empresa_id
    const { error: profileError } = await supabaseAdmin
        .from('profiles')
        .upsert({
            id: newUser.user.id,
            nome: nome.trim(),
            role,
            created_by: currentUser.id,
            empresa_id: empresaId,
            updated_at: new Date().toISOString(),
        })

    if (profileError) {
        await supabaseAdmin.auth.admin.deleteUser(newUser.user.id)
        return { success: false, error: 'Falha ao definir perfil do usuário.' }
    }

    // Inserir na empresa_membros (isolamento por empresa)
    const { error: membroError } = await supabaseAdmin
        .from('empresa_membros')
        .insert({
            empresa_id: empresaId,
            user_id: newUser.user.id,
            role,
            created_by: currentUser.id,
        })

    if (membroError) {
        await supabaseAdmin.auth.admin.deleteUser(newUser.user.id)
        return { success: false, error: 'Falha ao vincular usuário à empresa.' }
    }

    revalidatePath('/dashboard/perfil')
    return { success: true, message: `Usuário "${nome}" criado com sucesso!` }
}

// ── Alterar role de um membro (isolado por empresa) ───────────────────────────

export async function updateMemberRole(params: {
    memberId: string
    newRole: UserRole
}): Promise<ActionResult> {
    const currentUser = await getAuthUserWithRole()
    if (!currentUser || currentUser.role !== 'admin') {
        return { success: false, error: 'Apenas administradores podem alterar permissões.' }
    }

    if (params.memberId === currentUser.id) {
        return { success: false, error: 'Você não pode alterar sua própria permissão.' }
    }

    // Verificar se o membro pertence à mesma empresa
    const empresaId = currentUser.empresa_id
    if (!empresaId) return { success: false, error: 'Empresa não encontrada.' }

    const { data: membro } = await supabaseAdmin
        .from('empresa_membros')
        .select('id')
        .eq('empresa_id', empresaId)
        .eq('user_id', params.memberId)
        .single()

    if (!membro) {
        return { success: false, error: 'Membro não encontrado na sua empresa.' }
    }

    // Atualizar role no profile e na empresa_membros
    await supabaseAdmin
        .from('profiles')
        .update({ role: params.newRole, updated_at: new Date().toISOString() })
        .eq('id', params.memberId)

    await supabaseAdmin
        .from('empresa_membros')
        .update({ role: params.newRole })
        .eq('empresa_id', empresaId)
        .eq('user_id', params.memberId)

    revalidatePath('/dashboard/perfil')
    return { success: true, message: 'Permissão atualizada com sucesso!' }
}

// ── Remover membro (isolado por empresa) ──────────────────────────────────────

export async function removeTeamMember(memberId: string): Promise<ActionResult> {
    const currentUser = await getAuthUserWithRole()
    if (!currentUser || currentUser.role !== 'admin') {
        return { success: false, error: 'Apenas administradores podem remover usuários.' }
    }

    if (memberId === currentUser.id) {
        return { success: false, error: 'Você não pode remover a si mesmo.' }
    }

    // Verificar se o membro pertence à mesma empresa
    const empresaId = currentUser.empresa_id
    if (!empresaId) return { success: false, error: 'Empresa não encontrada.' }

    const { data: membro } = await supabaseAdmin
        .from('empresa_membros')
        .select('id')
        .eq('empresa_id', empresaId)
        .eq('user_id', memberId)
        .single()

    if (!membro) {
        return { success: false, error: 'Membro não encontrado na sua empresa.' }
    }

    // Deletar do Supabase Auth (cascade deleta profile e empresa_membros)
    const { error } = await supabaseAdmin.auth.admin.deleteUser(memberId)

    if (error) return { success: false, error: `Falha ao remover usuário: ${error.message}` }

    revalidatePath('/dashboard/perfil')
    return { success: true, message: 'Usuário removido com sucesso.' }
}
