'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Check, Rocket, Star, Zap, ArrowRight, Loader2 } from 'lucide-react'
import Image from 'next/image'
import { createSubscriptionTrial } from '@/actions/subscription'

type Plan = {
    id: string
    name: string
    slug: string
    price: number
    features: string[]
    is_active: boolean
}

export function ChoosePlanClient({ plans }: { plans: Plan[] }) {
    const router = useRouter()
    const [loading, setLoading] = useState<string | null>(null)
    const [error, setError] = useState<string | null>(null)

    async function handleSelectPlan(planId: string) {
        setLoading(planId)
        setError(null)

        try {
            const result = await createSubscriptionTrial(planId)
            if (result.success) {
                router.push('/dashboard')
            } else {
                setError(result.error)
            }
        } catch {
            setError('Ocorreu um erro. Tente novamente.')
        } finally {
            setLoading(null)
        }
    }

    const planIcons: Record<string, React.ReactNode> = {
        starter: <Zap className="h-8 w-8" />,
        pro: <Rocket className="h-8 w-8" />,
    }

    const planColors: Record<string, { gradient: string; border: string; badge: string; button: string }> = {
        starter: {
            gradient: 'from-blue-500/10 to-cyan-500/10',
            border: 'border-blue-500/20 hover:border-blue-500/40',
            badge: 'bg-blue-500/10 text-blue-400',
            button: 'bg-blue-600 hover:bg-blue-700',
        },
        pro: {
            gradient: 'from-violet-500/10 to-fuchsia-500/10',
            border: 'border-violet-500/30 hover:border-violet-500/50 ring-2 ring-violet-500/20',
            badge: 'bg-violet-500/10 text-violet-400',
            button: 'bg-violet-600 hover:bg-violet-700',
        },
    }

    return (
        <div className="min-h-screen bg-[#0a0a0f] text-white">
            {/* Header */}
            <header className="border-b border-white/5 bg-[#0a0a0f]/80 backdrop-blur-xl sticky top-0 z-50">
                <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
                    <Image
                        src="/images/logo_sidebar.png"
                        alt="NF-e Ágil"
                        width={120}
                        height={32}
                        priority
                        className="h-8 w-auto object-contain brightness-0 invert"
                    />
                    <span className="text-sm text-white/40">Escolha seu plano</span>
                </div>
            </header>

            {/* Hero */}
            <div className="relative overflow-hidden">
                {/* Glow effects */}
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-violet-600/10 rounded-full blur-[120px]" />
                <div className="absolute top-40 left-0 w-[400px] h-[300px] bg-blue-600/8 rounded-full blur-[100px]" />

                <div className="relative max-w-6xl mx-auto px-6 pt-16 pb-12 text-center">
                    <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-violet-500/10 border border-violet-500/20 text-violet-300 text-sm mb-6">
                        <Star className="h-3.5 w-3.5" />
                        7 dias de teste grátis em qualquer plano
                    </div>
                    <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-4">
                        Comece a usar o{' '}
                        <span className="bg-gradient-to-r from-violet-400 to-fuchsia-400 bg-clip-text text-transparent">
                            NF-e Ágil
                        </span>
                    </h1>
                    <p className="text-lg text-white/50 max-w-2xl mx-auto">
                        Escolha o plano ideal para sua empresa. Sem compromisso —
                        cancele a qualquer momento.
                    </p>
                </div>
            </div>

            {/* Plans Grid */}
            <div className="max-w-5xl mx-auto px-6 pb-20">
                {error && (
                    <div className="mb-8 p-4 rounded-lg bg-red-500/10 border border-red-500/20 text-red-300 text-sm text-center">
                        {error}
                    </div>
                )}

                <div className="grid md:grid-cols-2 gap-8">
                    {plans.map(plan => {
                        const colors = planColors[plan.slug] ?? planColors.starter
                        const icon = planIcons[plan.slug] ?? <Zap className="h-8 w-8" />
                        const isPopular = plan.slug === 'pro'

                        return (
                            <div
                                key={plan.id}
                                className={`
                                    relative rounded-2xl border p-8 transition-all duration-300
                                    bg-gradient-to-b ${colors.gradient}
                                    ${colors.border}
                                    hover:translate-y-[-2px]
                                `}
                            >
                                {/* Popular Badge */}
                                {isPopular && (
                                    <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                                        <span className="px-4 py-1 rounded-full bg-violet-600 text-white text-xs font-semibold uppercase tracking-wider shadow-lg shadow-violet-600/30">
                                            Mais popular
                                        </span>
                                    </div>
                                )}

                                {/* Icon + Name */}
                                <div className="flex items-center gap-3 mb-6">
                                    <div className={`p-2.5 rounded-xl ${colors.badge}`}>
                                        {icon}
                                    </div>
                                    <div>
                                        <h2 className="text-xl font-semibold">{plan.name}</h2>
                                        <p className="text-sm text-white/40">Plano {plan.name}</p>
                                    </div>
                                </div>

                                {/* Price */}
                                <div className="mb-8">
                                    <div className="flex items-baseline gap-1">
                                        <span className="text-sm text-white/40">R$</span>
                                        <span className="text-5xl font-bold tracking-tight">
                                            {plan.price.toFixed(0)}
                                        </span>
                                        <span className="text-white/40">/mês</span>
                                    </div>
                                    <p className="text-xs text-white/30 mt-1">
                                        Após o período de teste grátis
                                    </p>
                                </div>

                                {/* Features */}
                                <ul className="space-y-3 mb-8">
                                    {(plan.features ?? []).map((feature, i) => (
                                        <li key={i} className="flex items-start gap-3 text-sm">
                                            <Check className="h-4 w-4 mt-0.5 text-emerald-400 shrink-0" />
                                            <span className="text-white/70">{feature}</span>
                                        </li>
                                    ))}
                                </ul>

                                {/* CTA */}
                                <button
                                    onClick={() => handleSelectPlan(plan.id)}
                                    disabled={loading !== null}
                                    className={`
                                        w-full flex items-center justify-center gap-2 
                                        py-3 px-6 rounded-xl font-medium text-sm
                                        text-white transition-all duration-200
                                        ${colors.button}
                                        disabled:opacity-50 disabled:cursor-not-allowed
                                        shadow-lg shadow-black/20
                                        cursor-pointer
                                    `}
                                >
                                    {loading === plan.id ? (
                                        <>
                                            <Loader2 className="h-4 w-4 animate-spin" />
                                            Ativando teste...
                                        </>
                                    ) : (
                                        <>
                                            Iniciar teste grátis
                                            <ArrowRight className="h-4 w-4" />
                                        </>
                                    )}
                                </button>
                            </div>
                        )
                    })}
                </div>

                {/* Footer info */}
                <div className="mt-12 text-center space-y-3">
                    <p className="text-sm text-white/30">
                        ✓ Sem cartão de crédito &nbsp;&nbsp; ✓ Cancele a qualquer momento &nbsp;&nbsp; ✓ 7 dias grátis
                    </p>
                    <p className="text-xs text-white/20">
                        Ao iniciar o teste, você concorda com nossos{' '}
                        <a href="/termos" className="underline hover:text-white/40">Termos de Uso</a>
                        {' '}e{' '}
                        <a href="/privacidade" className="underline hover:text-white/40">Política de Privacidade</a>
                    </p>
                </div>
            </div>
        </div>
    )
}
