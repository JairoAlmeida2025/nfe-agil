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

// ── Helper: obter user autenticado com role ───────────────────────────────────

async function getAuthUserWithRole(): Promise<{ id: string; role: UserRole } | null> {
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
        .select('role')
        .eq('id', user.id)
        .single()

    if (!profile) return null

    return { id: user.id, role: profile.role as UserRole }
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

// ── Listar membros da equipe ──────────────────────────────────────────────────

export async function listTeamMembers(): Promise<TeamMember[]> {
    const currentUser = await getAuthUserWithRole()
    if (!currentUser || currentUser.role !== 'admin') return []

    const { data: profiles } = await supabaseAdmin
        .from('profiles')
        .select('id, nome, role, created_at, created_by')
        .order('created_at', { ascending: true })

    if (!profiles?.length) return []

    // Buscar emails dos auth.users
    const { data: authUsers } = await supabaseAdmin.auth.admin.listUsers()

    const authMap = new Map(
        (authUsers?.users ?? []).map((u) => [u.id, {
            email: u.email ?? null,
            lastSignIn: u.last_sign_in_at ?? null,
        }])
    )

    return profiles.map((p) => ({
        id: p.id,
        nome: p.nome,
        email: authMap.get(p.id)?.email ?? null,
        role: p.role as UserRole,
        createdAt: p.created_at,
        createdBy: p.created_by,
        lastSignIn: authMap.get(p.id)?.lastSignIn ?? null,
    }))
}

// ── Criar novo usuário ────────────────────────────────────────────────────────

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

    const { nome, email, senha, role } = params

    if (!nome?.trim()) return { success: false, error: 'Nome é obrigatório.' }
    if (!email?.trim()) return { success: false, error: 'E-mail é obrigatório.' }
    if (!senha || senha.length < 8) return { success: false, error: 'Senha deve ter no mínimo 8 caracteres.' }

    // Criar usuário no Supabase Auth — admin cria diretamente com acesso imediato
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

    // O trigger já criou o profile — atualizamos com role e created_by corretos
    const { error: profileError } = await supabaseAdmin
        .from('profiles')
        .upsert({
            id: newUser.user.id,
            nome: nome.trim(),
            role,
            created_by: currentUser.id,
            updated_at: new Date().toISOString(),
        })

    if (profileError) {
        // Reverter criação do usuário se profile falhou
        await supabaseAdmin.auth.admin.deleteUser(newUser.user.id)
        return { success: false, error: 'Falha ao definir perfil do usuário.' }
    }

    revalidatePath('/dashboard/perfil')
    return { success: true, message: `Usuário "${nome}" criado com sucesso!` }
}

// ── Alterar role de um membro ─────────────────────────────────────────────────

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

    const { error } = await supabaseAdmin
        .from('profiles')
        .update({ role: params.newRole, updated_at: new Date().toISOString() })
        .eq('id', params.memberId)

    if (error) return { success: false, error: 'Falha ao atualizar permissão.' }

    revalidatePath('/dashboard/perfil')
    return { success: true, message: 'Permissão atualizada com sucesso!' }
}

// ── Remover membro ────────────────────────────────────────────────────────────

export async function removeTeamMember(memberId: string): Promise<ActionResult> {
    const currentUser = await getAuthUserWithRole()
    if (!currentUser || currentUser.role !== 'admin') {
        return { success: false, error: 'Apenas administradores podem remover usuários.' }
    }

    if (memberId === currentUser.id) {
        return { success: false, error: 'Você não pode remover a si mesmo.' }
    }

    // Deletar do Supabase Auth (o cascade deleta o profile via trigger/FK)
    const { error } = await supabaseAdmin.auth.admin.deleteUser(memberId)

    if (error) return { success: false, error: `Falha ao remover usuário: ${error.message}` }

    revalidatePath('/dashboard/perfil')
    return { success: true, message: 'Usuário removido com sucesso.' }
}
