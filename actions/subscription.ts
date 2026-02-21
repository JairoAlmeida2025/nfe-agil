'use server'

import { supabaseAdmin } from '@/lib/supabase-admin'
import { getAuthUserId } from '@/lib/get-owner-id'
import { revalidatePath } from 'next/cache'

// ── Tipos ─────────────────────────────────────────────────────────────────────

export type SubscriptionResult =
    | { success: true; message?: string }
    | { success: false; error: string }

export type SubscriptionWithPlan = {
    id: string
    user_id: string
    plan_id: string
    status: string
    trial_ends_at: string | null
    current_period_end: string | null
    is_lifetime: boolean
    manual_override: boolean
    stripe_customer_id: string | null
    stripe_subscription_id: string | null
    created_at: string
    updated_at: string
    plans: {
        name: string
        slug: string
        price: number
        features: string[]
    }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const MASTER_ADMIN_EMAILS = (process.env.MASTER_ADMIN_EMAILS ?? '').split(',').map(e => e.trim().toLowerCase()).filter(Boolean)

async function isMasterAdmin(): Promise<boolean> {
    const userId = await getAuthUserId()
    if (!userId) return false

    const { data } = await supabaseAdmin
        .from('profiles')
        .select('id')
        .eq('id', userId)
        .single()

    if (!data) return false

    // Buscar email do usuário via auth
    const { data: { user } } = await supabaseAdmin.auth.admin.getUserById(userId)
    if (!user?.email) return false

    return MASTER_ADMIN_EMAILS.includes(user.email.toLowerCase())
}

async function getAuthEmail(): Promise<string | null> {
    const userId = await getAuthUserId()
    if (!userId) return null

    const { data: { user } } = await supabaseAdmin.auth.admin.getUserById(userId)
    return user?.email ?? null
}

// ── Buscar subscription ativa do usuário ──────────────────────────────────────

export async function getActiveSubscription(): Promise<SubscriptionWithPlan | null> {
    const userId = await getAuthUserId()
    if (!userId) return null

    const { data } = await supabaseAdmin
        .from('subscriptions')
        .select(`
            *,
            plans (name, slug, price, features)
        `)
        .eq('user_id', userId)
        .in('status', ['trialing', 'active'])
        .order('created_at', { ascending: false })
        .limit(1)
        .single()

    return data as SubscriptionWithPlan | null
}

// ── Verificar se usuário tem acesso ativo ─────────────────────────────────────

export async function hasActiveAccess(userId?: string): Promise<boolean> {
    const uid = userId ?? await getAuthUserId()
    if (!uid) return false

    const { data } = await supabaseAdmin
        .from('subscriptions')
        .select('id, status, trial_ends_at, is_lifetime, current_period_end')
        .eq('user_id', uid)
        .order('created_at', { ascending: false })
        .limit(1)
        .single()

    if (!data) return false

    // Lifetime = sempre ativo
    if (data.is_lifetime) return true

    // Ativo = acesso liberado
    if (data.status === 'active') return true

    // Trial = verificar se não expirou
    if (data.status === 'trialing' && data.trial_ends_at) {
        return new Date(data.trial_ends_at) > new Date()
    }

    return false
}

// ── Criar subscription trial ──────────────────────────────────────────────────

export async function createSubscriptionTrial(planId: string): Promise<SubscriptionResult> {
    const userId = await getAuthUserId()
    if (!userId) return { success: false, error: 'Não autenticado.' }

    // Verificar se já tem subscription ativa
    const existing = await getActiveSubscription()
    if (existing) {
        return { success: false, error: 'Você já possui uma assinatura ativa.' }
    }

    // Verificar se o plano existe e está ativo
    const { data: plan } = await supabaseAdmin
        .from('plans')
        .select('id, name')
        .eq('id', planId)
        .eq('is_active', true)
        .single()

    if (!plan) {
        return { success: false, error: 'Plano não encontrado ou inativo.' }
    }

    // Criar subscription com trial de 7 dias
    const trialEndsAt = new Date()
    trialEndsAt.setDate(trialEndsAt.getDate() + 7)

    const { error } = await supabaseAdmin
        .from('subscriptions')
        .insert({
            user_id: userId,
            plan_id: planId,
            status: 'trialing',
            trial_ends_at: trialEndsAt.toISOString(),
        })

    if (error) {
        console.error('Erro ao criar subscription trial:', error)
        return { success: false, error: 'Falha ao criar assinatura de teste.' }
    }

    revalidatePath('/dashboard')
    revalidatePath('/escolher-plano')
    return { success: true, message: `Teste grátis do plano ${plan.name} ativado por 7 dias!` }
}

// ── Admin: Estender trial ─────────────────────────────────────────────────────

export async function extendTrial(subscriptionId: string, days: number): Promise<SubscriptionResult> {
    if (!(await isMasterAdmin())) {
        return { success: false, error: 'Acesso negado.' }
    }

    const { data: sub } = await supabaseAdmin
        .from('subscriptions')
        .select('trial_ends_at, status')
        .eq('id', subscriptionId)
        .single()

    if (!sub) return { success: false, error: 'Assinatura não encontrada.' }

    const baseDate = sub.trial_ends_at ? new Date(sub.trial_ends_at) : new Date()
    const newEndDate = new Date(baseDate)
    newEndDate.setDate(newEndDate.getDate() + days)

    const { error } = await supabaseAdmin
        .from('subscriptions')
        .update({
            trial_ends_at: newEndDate.toISOString(),
            status: 'trialing',
            manual_override: true,
            updated_at: new Date().toISOString(),
        })
        .eq('id', subscriptionId)

    if (error) {
        console.error('Erro ao estender trial:', error)
        return { success: false, error: 'Falha ao estender o período de teste.' }
    }

    revalidatePath('/admin')
    revalidatePath('/admin/usuarios')
    return { success: true, message: `Trial estendido por mais ${days} dias.` }
}

// ── Admin: Ativar lifetime ────────────────────────────────────────────────────

export async function activateLifetime(subscriptionId: string): Promise<SubscriptionResult> {
    if (!(await isMasterAdmin())) {
        return { success: false, error: 'Acesso negado.' }
    }

    const { error } = await supabaseAdmin
        .from('subscriptions')
        .update({
            is_lifetime: true,
            status: 'active',
            manual_override: true,
            updated_at: new Date().toISOString(),
        })
        .eq('id', subscriptionId)

    if (error) {
        console.error('Erro ao ativar lifetime:', error)
        return { success: false, error: 'Falha ao ativar acesso vitalício.' }
    }

    revalidatePath('/admin')
    revalidatePath('/admin/usuarios')
    return { success: true, message: 'Acesso vitalício ativado com sucesso.' }
}

// ── Admin: Ativar manualmente ─────────────────────────────────────────────────

export async function activateManual(subscriptionId: string): Promise<SubscriptionResult> {
    if (!(await isMasterAdmin())) {
        return { success: false, error: 'Acesso negado.' }
    }

    const { error } = await supabaseAdmin
        .from('subscriptions')
        .update({
            status: 'active',
            manual_override: true,
            updated_at: new Date().toISOString(),
        })
        .eq('id', subscriptionId)

    if (error) {
        console.error('Erro ao ativar manual:', error)
        return { success: false, error: 'Falha ao ativar assinatura.' }
    }

    revalidatePath('/admin')
    revalidatePath('/admin/usuarios')
    return { success: true, message: 'Assinatura ativada manualmente.' }
}

// ── Admin: Cancelar subscription ──────────────────────────────────────────────

export async function cancelSubscription(subscriptionId: string): Promise<SubscriptionResult> {
    if (!(await isMasterAdmin())) {
        return { success: false, error: 'Acesso negado.' }
    }

    const { error } = await supabaseAdmin
        .from('subscriptions')
        .update({
            status: 'canceled',
            manual_override: true,
            updated_at: new Date().toISOString(),
        })
        .eq('id', subscriptionId)

    if (error) {
        console.error('Erro ao cancelar:', error)
        return { success: false, error: 'Falha ao cancelar assinatura.' }
    }

    revalidatePath('/admin')
    revalidatePath('/admin/usuarios')
    return { success: true, message: 'Assinatura cancelada.' }
}

// ── Admin: Listar todas as subscriptions ──────────────────────────────────────

export async function listAllSubscriptions() {
    if (!(await isMasterAdmin())) return []

    const { data } = await supabaseAdmin
        .from('subscriptions')
        .select(`
            *,
            plans (name, slug, price),
            profiles:user_id (id, nome)
        `)
        .order('created_at', { ascending: false })

    return data ?? []
}

// ── Admin: Listar todos os pagamentos ─────────────────────────────────────────

export async function listAllPayments() {
    if (!(await isMasterAdmin())) return []

    const { data } = await supabaseAdmin
        .from('payments')
        .select(`
            *,
            profiles:user_id (id, nome),
            subscriptions:subscription_id (id, status, plans (name))
        `)
        .order('created_at', { ascending: false })

    return data ?? []
}

// ── Admin: Dashboard metrics ──────────────────────────────────────────────────

export type SaasMetrics = {
    totalUsers: number
    activeSubscriptions: number
    activeTrials: number
    canceledLast30: number
    mrr: number
    arpu: number
    totalRevenue: number
}

export async function getSaasMetrics(): Promise<SaasMetrics | null> {
    if (!(await isMasterAdmin())) return null

    // Total de usuários
    const { count: totalUsers } = await supabaseAdmin
        .from('profiles')
        .select('*', { count: 'exact', head: true })

    // Assinaturas ativas
    const { count: activeSubscriptions } = await supabaseAdmin
        .from('subscriptions')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'active')

    // Trials ativos
    const { data: trialData } = await supabaseAdmin
        .from('subscriptions')
        .select('id, trial_ends_at')
        .eq('status', 'trialing')

    const now = new Date()
    const activeTrials = (trialData ?? []).filter(s =>
        s.trial_ends_at && new Date(s.trial_ends_at) > now
    ).length

    // Cancelados últimos 30 dias
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

    const { count: canceledLast30 } = await supabaseAdmin
        .from('subscriptions')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'canceled')
        .gte('updated_at', thirtyDaysAgo.toISOString())

    // MRR: soma dos preços dos planos com subscription ativa
    const { data: activeSubs } = await supabaseAdmin
        .from('subscriptions')
        .select('plans (price)')
        .eq('status', 'active')

    const mrr = (activeSubs ?? []).reduce((sum, s: any) => sum + (s.plans?.price ?? 0), 0)

    // Total revenue
    const { data: payments } = await supabaseAdmin
        .from('payments')
        .select('amount')
        .eq('status', 'succeeded')

    const totalRevenue = (payments ?? []).reduce((sum, p) => sum + (p.amount ?? 0), 0)

    // ARPU
    const payingUsers = (activeSubscriptions ?? 0) + activeTrials
    const arpu = payingUsers > 0 ? mrr / payingUsers : 0

    return {
        totalUsers: totalUsers ?? 0,
        activeSubscriptions: activeSubscriptions ?? 0,
        activeTrials,
        canceledLast30: canceledLast30 ?? 0,
        mrr,
        arpu,
        totalRevenue,
    }
}

// ── Admin: Listar todos os usuários com subscription info ─────────────────────

export async function listAllUsersWithSubscriptions() {
    if (!(await isMasterAdmin())) return []

    // Buscar todos os profiles
    const { data: profiles } = await supabaseAdmin
        .from('profiles')
        .select('id, nome, role, created_at')
        .order('created_at', { ascending: false })

    if (!profiles) return []

    // Buscar todas as subscriptions
    const { data: subs } = await supabaseAdmin
        .from('subscriptions')
        .select(`
            id, user_id, status, trial_ends_at, is_lifetime, 
            manual_override, current_period_end, created_at, updated_at,
            plans (name, slug, price)
        `)
        .order('created_at', { ascending: false })

    // Buscar emails via auth
    const { data: { users: authUsers } } = await supabaseAdmin.auth.admin.listUsers({
        perPage: 1000,
    })

    // Buscar empresas para cada user
    const { data: empresas } = await supabaseAdmin
        .from('empresas')
        .select('user_id, razao_social, cnpj')

    // Buscar último pagamento
    const { data: lastPayments } = await supabaseAdmin
        .from('payments')
        .select('user_id, amount, created_at, status')
        .eq('status', 'succeeded')
        .order('created_at', { ascending: false })

    // Montar resposta combinada
    return profiles.map(profile => {
        const authUser = (authUsers ?? []).find(u => u.id === profile.id)
        const userSubs = (subs ?? []).filter(s => s.user_id === profile.id)
        const activeSub = userSubs.find(s =>
            s.status === 'active' || s.status === 'trialing'
        )
        const empresa = (empresas ?? []).find(e => e.user_id === profile.id)
        const lastPayment = (lastPayments ?? []).find(p => p.user_id === profile.id)

        return {
            id: profile.id,
            nome: profile.nome,
            email: authUser?.email ?? 'N/A',
            role: profile.role,
            created_at: profile.created_at,
            empresa: empresa?.razao_social ?? null,
            cnpj: empresa?.cnpj ?? null,
            subscription: activeSub ? {
                id: activeSub.id,
                status: activeSub.status,
                plan_name: (activeSub as any).plans?.name ?? 'N/A',
                plan_slug: (activeSub as any).plans?.slug ?? 'N/A',
                price: (activeSub as any).plans?.price ?? 0,
                trial_ends_at: activeSub.trial_ends_at,
                is_lifetime: activeSub.is_lifetime,
                manual_override: activeSub.manual_override,
                current_period_end: activeSub.current_period_end,
            } : null,
            last_payment: lastPayment ? {
                amount: lastPayment.amount,
                date: lastPayment.created_at,
                status: lastPayment.status,
            } : null,
        }
    })
}

// ── Admin: CRUD de Planos ─────────────────────────────────────────────────────

export async function listAllPlans() {
    if (!(await isMasterAdmin())) return []

    const { data } = await supabaseAdmin
        .from('plans')
        .select('*')
        .order('price', { ascending: true })

    return data ?? []
}

export async function createPlan(formData: FormData): Promise<SubscriptionResult> {
    if (!(await isMasterAdmin())) {
        return { success: false, error: 'Acesso negado.' }
    }

    const name = formData.get('name') as string
    const slug = formData.get('slug') as string
    const price = parseFloat(formData.get('price') as string)
    const featuresRaw = formData.get('features') as string

    if (!name || !slug) {
        return { success: false, error: 'Nome e slug são obrigatórios.' }
    }

    const features = featuresRaw
        ? featuresRaw.split('\n').map(f => f.trim()).filter(Boolean)
        : []

    const { error } = await supabaseAdmin.from('plans').insert({
        name,
        slug,
        price: isNaN(price) ? 0 : price,
        features,
    })

    if (error) {
        if (error.message.includes('duplicate')) {
            return { success: false, error: 'Já existe um plano com este slug.' }
        }
        return { success: false, error: 'Falha ao criar plano.' }
    }

    revalidatePath('/admin/planos')
    return { success: true, message: 'Plano criado com sucesso.' }
}

export async function updatePlan(planId: string, formData: FormData): Promise<SubscriptionResult> {
    if (!(await isMasterAdmin())) {
        return { success: false, error: 'Acesso negado.' }
    }

    const name = formData.get('name') as string
    const price = parseFloat(formData.get('price') as string)
    const featuresRaw = formData.get('features') as string
    const isActive = formData.get('is_active') === 'true'

    const features = featuresRaw
        ? featuresRaw.split('\n').map(f => f.trim()).filter(Boolean)
        : []

    const { error } = await supabaseAdmin
        .from('plans')
        .update({
            name,
            price: isNaN(price) ? 0 : price,
            features,
            is_active: isActive,
        })
        .eq('id', planId)

    if (error) {
        return { success: false, error: 'Falha ao atualizar plano.' }
    }

    revalidatePath('/admin/planos')
    return { success: true, message: 'Plano atualizado com sucesso.' }
}

export async function deletePlan(planId: string): Promise<SubscriptionResult> {
    if (!(await isMasterAdmin())) {
        return { success: false, error: 'Acesso negado.' }
    }

    // Verificar se há subscriptions vinculadas
    const { count } = await supabaseAdmin
        .from('subscriptions')
        .select('*', { count: 'exact', head: true })
        .eq('plan_id', planId)

    if ((count ?? 0) > 0) {
        return { success: false, error: 'Não é possível excluir: existem assinaturas vinculadas a este plano.' }
    }

    const { error } = await supabaseAdmin.from('plans').delete().eq('id', planId)

    if (error) {
        return { success: false, error: 'Falha ao excluir plano.' }
    }

    revalidatePath('/admin/planos')
    return { success: true, message: 'Plano excluído com sucesso.' }
}
