import { supabaseAdmin } from '@/lib/supabase-admin'
import { getAuthUserId } from '@/lib/get-owner-id'
import { redirect } from 'next/navigation'
import { ChoosePlanClient } from './choose-plan-client'

export const dynamic = 'force-dynamic'

export const metadata = {
    title: 'Escolher Plano | NF-e Ágil',
    description: 'Escolha o plano ideal para sua empresa e comece seu teste grátis de 7 dias.',
}

export default async function EscolherPlanoPage({
    searchParams,
}: {
    searchParams: Promise<{ upgrade?: string; force_checkout?: string }>
}) {
    const userId = await getAuthUserId()

    // Se não autenticado, redirecionar para login
    if (!userId) {
        redirect('/login')
    }

    const resolvedSearchParams = await searchParams
    const isUpgrade = resolvedSearchParams.upgrade === 'true'
    const forceCheckout = resolvedSearchParams.force_checkout === 'true'
    const blockTrial = isUpgrade || forceCheckout

    // Verificar se já tem subscription ativa
    const { data: existingSub } = await supabaseAdmin
        .from('subscriptions')
        .select('id, status, trial_ends_at, is_lifetime')
        .eq('user_id', userId)
        .in('status', ['active', 'trialing'])
        .order('created_at', { ascending: false })
        .limit(1)
        .single()

    if (existingSub) {
        const isValid =
            existingSub.is_lifetime ||
            existingSub.status === 'active' ||
            (existingSub.status === 'trialing' &&
                existingSub.trial_ends_at &&
                new Date(existingSub.trial_ends_at) > new Date())

        // Se for vitalício, nunca precisa fazer upgrade
        if (existingSub.is_lifetime) {
            redirect('/dashboard')
        }

        // Se tem assinatura válida, MAS NÃO pediu para ver upgrade (isUpgrade) nem forçou checkout, manda pro dashboard
        if (isValid && !blockTrial) {
            redirect('/dashboard')
        }
    }

    // Buscar planos ativos
    const { data: plans } = await supabaseAdmin
        .from('plans')
        .select('*')
        .eq('is_active', true)
        .order('price', { ascending: true })

    return <ChoosePlanClient plans={plans ?? []} isUpgrade={blockTrial} />
}
