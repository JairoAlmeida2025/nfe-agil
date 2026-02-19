'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { supabaseAdmin } from '@/lib/supabase-admin'

// ── Cliente Supabase com cookies (para auth server-side) ──────────────────────

async function createSupabaseServerClient() {
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

// ── Tipos ─────────────────────────────────────────────────────────────────────

export type Profile = {
    id: string
    nome: string | null
    avatar_url: string | null
    email: string | null
}

export type AuthResult =
    | { success: true }
    | { success: false; error: string }

// ── Cadastro com confirmação por e-mail ───────────────────────────────────────

export async function signUp(formData: FormData): Promise<AuthResult> {
    const email = formData.get('email') as string
    const password = formData.get('password') as string
    const nome = formData.get('nome') as string

    if (!email || !password || !nome) {
        return { success: false, error: 'Preencha todos os campos.' }
    }
    if (password.length < 8) {
        return { success: false, error: 'A senha deve ter no mínimo 8 caracteres.' }
    }

    const supabase = await createSupabaseServerClient()

    const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
            data: { full_name: nome },
            emailRedirectTo: `${process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'}/auth/callback`,
        },
    })

    if (error) {
        if (error.message.includes('already registered')) {
            return { success: false, error: 'Este e-mail já está cadastrado.' }
        }
        return { success: false, error: error.message }
    }

    return { success: true }
}

// ── Login ─────────────────────────────────────────────────────────────────────

export async function signIn(formData: FormData): Promise<AuthResult> {
    const email = formData.get('email') as string
    const password = formData.get('password') as string

    const supabase = await createSupabaseServerClient()

    const { error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
        if (error.message.includes('Invalid login credentials')) {
            return { success: false, error: 'E-mail ou senha inválidos.' }
        }
        if (error.message.includes('Email not confirmed')) {
            return {
                success: false,
                error: 'Confirme seu e-mail antes de entrar. Verifique sua caixa de entrada.',
            }
        }
        return { success: false, error: error.message }
    }

    revalidatePath('/', 'layout')
    return { success: true }
}

// ── Logout ────────────────────────────────────────────────────────────────────

export async function signOut(): Promise<void> {
    const supabase = await createSupabaseServerClient()
    await supabase.auth.signOut()
    redirect('/login')
}

// ── Obter sessão atual ────────────────────────────────────────────────────────

export async function getSession() {
    const supabase = await createSupabaseServerClient()
    const { data: { session } } = await supabase.auth.getSession()
    return session
}

// ── Obter perfil do usuário logado ────────────────────────────────────────────

export async function getProfile(): Promise<Profile | null> {
    const supabase = await createSupabaseServerClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return null

    const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single()

    return {
        id: user.id,
        email: user.email ?? null,
        nome: profile?.nome ?? (user.user_metadata?.full_name as string) ?? null,
        avatar_url: profile?.avatar_url ?? null,
    }
}

// ── Atualizar perfil (nome + avatar) ─────────────────────────────────────────

export async function updateProfile(formData: FormData): Promise<AuthResult> {
    const supabase = await createSupabaseServerClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { success: false, error: 'Não autenticado.' }

    const nome = formData.get('nome') as string
    const avatarFile = formData.get('avatar') as File | null

    let avatar_url: string | undefined

    // Upload de avatar se fornecido
    if (avatarFile && avatarFile.size > 0) {
        const ext = avatarFile.name.split('.').pop() ?? 'jpg'
        const path = `${user.id}/avatar.${ext}`

        const { error: uploadError } = await supabaseAdmin.storage
            .from('avatars')
            .upload(path, avatarFile, {
                contentType: avatarFile.type,
                upsert: true,
            })

        if (uploadError) {
            return { success: false, error: 'Falha ao enviar foto de perfil.' }
        }

        const { data: { publicUrl } } = supabaseAdmin.storage
            .from('avatars')
            .getPublicUrl(path)

        avatar_url = `${publicUrl}?v=${Date.now()}`
    }

    const { error } = await supabase
        .from('profiles')
        .upsert({
            id: user.id,
            nome,
            ...(avatar_url ? { avatar_url } : {}),
            updated_at: new Date().toISOString(),
        })

    if (error) return { success: false, error: 'Falha ao salvar perfil.' }

    revalidatePath('/dashboard', 'layout')
    return { success: true }
}

// ── Vincular empresa/certificado existente ao usuário logado ──────────────────
// (Chamado na primeira vez que o usuário sobe o certificado)

export async function linkEmpresaToUser(cnpj: string): Promise<void> {
    const supabase = await createSupabaseServerClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    // Vincular empresa e certificado ao user_id
    await supabaseAdmin
        .from('empresas')
        .update({ user_id: user.id })
        .eq('cnpj', cnpj)
        .is('user_id', null) // só vincula se ainda não tem dono

    await supabaseAdmin
        .from('certificados')
        .update({ user_id: user.id })
        .eq('cnpj', cnpj)
        .is('user_id', null)
}

// ── Solicitar redefinição de senha (envia e-mail) ─────────────────────────────

export async function requestPasswordReset(email: string): Promise<AuthResult> {
    if (!email?.trim()) return { success: false, error: 'Informe o e-mail.' }

    const supabase = await createSupabaseServerClient()

    const redirectTo = `${process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'}/auth/callback?next=/auth/reset-password`

    const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
        redirectTo,
    })

    if (error) {
        // Não expor se o e-mail existe ou não (segurança)
        console.error('Reset password error:', error.message)
    }

    // Sempre retornar sucesso para não revelar se o e-mail existe
    return { success: true }
}

// ── Redefinir senha (após clicar no link do e-mail) ───────────────────────────

export async function updatePassword(newPassword: string): Promise<AuthResult> {
    if (!newPassword || newPassword.length < 8) {
        return { success: false, error: 'A nova senha deve ter no mínimo 8 caracteres.' }
    }

    const supabase = await createSupabaseServerClient()

    const { error } = await supabase.auth.updateUser({ password: newPassword })

    if (error) {
        return { success: false, error: 'Falha ao atualizar a senha. O link pode ter expirado.' }
    }

    return { success: true }
}
