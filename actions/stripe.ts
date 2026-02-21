'use server'

import { stripe } from '@/lib/stripe'
import { getAuthUserId } from '@/lib/get-owner-id'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { headers } from 'next/headers'

// Generate a Stripe Checkout Session for a given Plan ID
export async function createCheckoutSession(planId: string) {
    const userId = await getAuthUserId()
    if (!userId) return { success: false, error: 'Não autenticado.' }

    // Fetch user info for email
    const { data: { user } } = await supabaseAdmin.auth.admin.getUserById(userId)
    if (!user) return { success: false, error: 'Usuário não encontrado.' }

    const { data: profile } = await supabaseAdmin
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single()

    // Fetch Plan
    const { data: plan } = await supabaseAdmin
        .from('plans')
        .select('*')
        .eq('id', planId)
        .single()

    if (!plan || !plan.stripe_price_id) {
        return { success: false, error: 'Plano inválido ou não configurado no Stripe.' }
    }

    // Check if user already has a Stripe customer ID in their latest subscription
    const { data: latestSub } = await supabaseAdmin
        .from('subscriptions')
        .select('stripe_customer_id')
        .eq('user_id', userId)
        .not('stripe_customer_id', 'is', null)
        .order('created_at', { ascending: false })
        .limit(1)
        .single()

    let customerId = latestSub?.stripe_customer_id

    // Fall back to seeing if they were already created in Stripe directly
    if (!customerId) {
        const customers = await stripe.customers.list({ email: user.email, limit: 1 })
        if (customers.data.length > 0) {
            customerId = customers.data[0].id
        } else {
            const customer = await stripe.customers.create({
                email: user.email,
                name: profile?.nome || user.email,
                metadata: {
                    user_id: userId
                }
            })
            customerId = customer.id
        }
    }

    const headersList = await headers()
    const host = headersList.get('host')
    const protocol = process.env.NODE_ENV === 'development' ? 'http' : 'https'
    const siteUrl = process.env.NEXT_PUBLIC_APP_URL || `${protocol}://${host}`

    try {
        const session = await stripe.checkout.sessions.create({
            customer: customerId,
            mode: 'subscription',
            payment_method_types: ['card'],
            line_items: [
                {
                    price: plan.stripe_price_id,
                    quantity: 1
                }
            ],
            success_url: `${siteUrl}/dashboard?session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: `${siteUrl}/escolher-plano`,
            metadata: {
                user_id: userId,
                plan_id: plan.id
            }
        })

        return { success: true, url: session.url }
    } catch (e: any) {
        console.error('Error creating checkout session:', e)
        return { success: false, error: 'Falha ao iniciar pagamento.' }
    }
}

// Generate Stripe Customer Portal session, allowing users to pause, update card, etc.
export async function createCustomerPortalSession() {
    const userId = await getAuthUserId()
    if (!userId) return { success: false, error: 'Não autenticado.' }

    const { data: sub } = await supabaseAdmin
        .from('subscriptions')
        .select('stripe_customer_id')
        .eq('user_id', userId)
        .not('stripe_customer_id', 'is', null)
        .order('created_at', { ascending: false })
        .limit(1)
        .single()

    if (!sub || !sub.stripe_customer_id) {
        return { success: false, error: 'Nenhuma assinatura do Stripe encontrada.' }
    }

    const headersList = await headers()
    const host = headersList.get('host')
    const protocol = process.env.NODE_ENV === 'development' ? 'http' : 'https'
    const siteUrl = process.env.NEXT_PUBLIC_APP_URL || `${protocol}://${host}`

    try {
        const session = await stripe.billingPortal.sessions.create({
            customer: sub.stripe_customer_id,
            return_url: `${siteUrl}/dashboard/perfil?settings=billing`
        })

        return { success: true, url: session.url }
    } catch (e: any) {
        console.error('Error creating portal session:', e)
        return { success: false, error: 'Falha ao acessar painel do cliente.' }
    }
}
