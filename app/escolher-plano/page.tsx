import { supabaseAdmin } from '@/lib/supabase-admin'
import { getAuthUserId } from '@/lib/get-owner-id'
import { redirect } from 'next/navigation'
import { ChoosePlanClient } from './choose-plan-client'

export const dynamic = 'force-dynamic'

export const metadata = {
    title: 'Escolher Plano | NF-e Ágil',
    description: 'Escolha o plano ideal para sua empresa e comece seu teste grátis de 7 dias.',
}

export default async function EscolherPlanoPage() {
    const userId = await getAuthUserId()

    // Se não autenticado, redirecionar para login
    if (!userId) {
        redirect('/login')
    }

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

        if (isValid) {
            redirect('/dashboard')
        }
    }

    // Buscar planos ativos
    const { data: plans } = await supabaseAdmin
        .from('plans')
        .select('*')
        .eq('is_active', true)
        .order('price', { ascending: true })

    return <ChoosePlanClient plans={plans ?? []} />
}
