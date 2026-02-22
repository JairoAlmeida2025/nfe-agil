'use server'

import { getActiveSubscription, type SubscriptionWithPlan } from '@/actions/subscription'

/**
 * lib/plan-gate.ts
 *
 * Helpers server-side para verificar o plano do usuário logado.
 *
 * Regras:
 *  - Trial (7 dias): acesso completo (100%)
 *  - Pro (pago): acesso completo
 *  - Starter (pago): apenas Conversor XML + Relatório XML
 *  - Lifetime: acesso completo
 */

export type PlanSlug = 'starter' | 'pro' | 'trial' | null

export async function getUserPlanInfo(): Promise<{
    slug: PlanSlug
    subscription: SubscriptionWithPlan | null
}> {
    const sub = await getActiveSubscription()

    if (!sub) return { slug: null, subscription: null }

    // Lifetime sempre tem acesso total
    if (sub.is_lifetime) return { slug: 'pro', subscription: sub }

    // Trial ativo = acesso total
    if (sub.status === 'trialing') {
        const trialEnd = sub.trial_ends_at ? new Date(sub.trial_ends_at) : null
        if (trialEnd && trialEnd > new Date()) {
            return { slug: 'trial', subscription: sub }
        }
        // Trial expirado
        return { slug: null, subscription: sub }
    }

    // Assinatura ativa — verifica slug do plano
    if (sub.status === 'active') {
        const planSlug = sub.plans?.slug as PlanSlug
        return { slug: planSlug || 'pro', subscription: sub }
    }

    return { slug: null, subscription: sub }
}

/**
 * Retorna true se o usuário tem acesso completo (Pro, Lifetime ou Trial ativo)
 */
export async function isProOrTrial(): Promise<boolean> {
    const { slug } = await getUserPlanInfo()
    return slug === 'pro' || slug === 'trial'
}

/**
 * Retorna true se o usuário está no plano Starter (sem acesso às features Pro)
 */
export async function isStarterOnly(): Promise<boolean> {
    const { slug } = await getUserPlanInfo()
    return slug === 'starter'
}

/**
 * Retorna true se o usuário pode acessar as features Pro (Monitoramento, NF-es, etc.)
 */
export async function canAccessProFeatures(): Promise<boolean> {
    return await isProOrTrial()
}

/**
 * Retorna o slug do plano atual do usuário
 */
export async function getUserPlanSlug(): Promise<PlanSlug> {
    const { slug } = await getUserPlanInfo()
    return slug
}
