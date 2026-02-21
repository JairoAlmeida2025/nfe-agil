import { stripe } from '@/lib/stripe'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'

export async function POST(req: NextRequest) {
    const signature = req.headers.get('stripe-signature') as string

    if (!signature) {
        return new NextResponse('No signature', { status: 400 })
    }

    let event: Stripe.Event

    try {
        const payload = await req.text()
        event = stripe.webhooks.constructEvent(
            payload,
            signature,
            process.env.STRIPE_WEBHOOK_SECRET!
        )
    } catch (e: any) {
        console.error('Webhook signature verification failed.', e.message)
        return new NextResponse('Webhook error', { status: 400 })
    }

    try {
        switch (event.type) {
            case 'checkout.session.completed': {
                const session = event.data.object as Stripe.Checkout.Session
                const userId = session.metadata?.user_id
                const planId = session.metadata?.plan_id
                const customerId = session.customer as string
                const subscriptionId = session.subscription as string

                if (!userId || !planId) throw new Error('Missing metadata')

                const subscription = await stripe.subscriptions.retrieve(subscriptionId) as any
                const currentPeriodEnd = new Date(subscription.current_period_end * 1000).toISOString()

                // Check for existing subscription for this user
                const { data: existingSub } = await supabaseAdmin
                    .from('subscriptions')
                    .select('id')
                    .eq('user_id', userId)
                    .order('created_at', { ascending: false })
                    .limit(1)
                    .single()

                if (existingSub) {
                    await supabaseAdmin
                        .from('subscriptions')
                        .update({
                            status: subscription.status,
                            stripe_customer_id: customerId,
                            stripe_subscription_id: subscriptionId,
                            current_period_end: currentPeriodEnd,
                            plan_id: planId,
                            updated_at: new Date().toISOString()
                        })
                        .eq('id', existingSub.id)
                } else {
                    await supabaseAdmin
                        .from('subscriptions')
                        .insert({
                            user_id: userId,
                            plan_id: planId,
                            status: subscription.status,
                            stripe_customer_id: customerId,
                            stripe_subscription_id: subscriptionId,
                            current_period_end: currentPeriodEnd,
                            trial_used: true
                        })
                }

                // Try assigning the master admin notification logic maybe?
                break
            }

            case 'customer.subscription.updated':
            case 'customer.subscription.deleted': {
                const subscription = event.data.object as Stripe.Subscription

                const { data: userSub } = await supabaseAdmin
                    .from('subscriptions')
                    .select('id')
                    .eq('stripe_subscription_id', subscription.id)
                    .single()

                if (userSub) {
                    await supabaseAdmin
                        .from('subscriptions')
                        .update({
                            status: subscription.status,
                            current_period_end: new Date((subscription as any).current_period_end * 1000).toISOString(),
                            updated_at: new Date().toISOString()
                        })
                        .eq('id', userSub.id)
                }
                break
            }

            case 'invoice.payment_succeeded': {
                const invoice = event.data.object as Stripe.Invoice
                const subscriptionId = (invoice as any).subscription as string

                if (subscriptionId) {
                    const { data: userSub } = await supabaseAdmin
                        .from('subscriptions')
                        .select('id, user_id')
                        .eq('stripe_subscription_id', subscriptionId)
                        .single()

                    if (userSub) {
                        await supabaseAdmin
                            .from('payments')
                            .insert({
                                user_id: userSub.user_id,
                                subscription_id: userSub.id,
                                amount: invoice.amount_paid / 100, // em reais
                                currency: invoice.currency.toUpperCase(),
                                status: 'succeeded',
                                stripe_payment_intent: (invoice as any).payment_intent as string || null
                            })
                    }
                }
                break
            }

            case 'invoice.payment_failed': {
                const invoice = event.data.object as Stripe.Invoice
                const subscriptionId = (invoice as any).subscription as string

                if (subscriptionId) {
                    const { data: userSub } = await supabaseAdmin
                        .from('subscriptions')
                        .select('id, user_id')
                        .eq('stripe_subscription_id', subscriptionId)
                        .single()

                    if (userSub) {
                        await supabaseAdmin
                            .from('payments')
                            .insert({
                                user_id: userSub.user_id,
                                subscription_id: userSub.id,
                                amount: invoice.amount_due / 100, // em reais
                                currency: invoice.currency.toUpperCase(),
                                status: 'failed',
                                stripe_payment_intent: (invoice as any).payment_intent as string || null
                            })
                    }
                }
                break
            }
        }

        return new NextResponse('Webhook processed', { status: 200 })
    } catch (e: any) {
        console.error('Webhook handler failed:', e)
        return new NextResponse('Webhook processing error', { status: 500 })
    }
}
