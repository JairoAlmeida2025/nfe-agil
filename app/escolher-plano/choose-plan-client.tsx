'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Check, Rocket, Star, Zap, ArrowRight, Loader2, LogOut } from 'lucide-react'
import Image from 'next/image'
import { createSubscriptionTrial } from '@/actions/subscription'
import { signOut } from '@/actions/auth'

type Plan = {
    id: string
    name: string
    slug: string
    price: number
    features: string[]
    is_active: boolean
}

/**
 * Paleta Oficial NF-e Ágil
 * ─────────────────────────
 * Azul Fiscal:          #1E3A8A
 * Verde Status:         #10B981
 * Cinza Claro:          #F3F4F6
 * Amarelo Alerta:       #F59E0B
 * Grafite Profundo:     #1F2937
 */

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

    // Paleta oficial aplicada nos cards
    const planColors: Record<string, { gradient: string; border: string; badge: string; button: string; checkColor: string }> = {
        starter: {
            gradient: 'from-[#1E3A8A]/8 to-[#1E3A8A]/3',
            border: 'border-[#1E3A8A]/20 hover:border-[#1E3A8A]/40',
            badge: 'bg-[#1E3A8A]/10 text-[#5B8DEF]',
            button: 'bg-[#1E3A8A] hover:bg-[#1E3A8A]/90',
            checkColor: 'text-[#10B981]',
        },
        pro: {
            gradient: 'from-[#1E3A8A]/12 to-[#10B981]/6',
            border: 'border-[#1E3A8A]/30 hover:border-[#10B981]/40 ring-2 ring-[#1E3A8A]/20',
            badge: 'bg-[#1E3A8A]/15 text-[#5B8DEF]',
            button: 'bg-[#1E3A8A] hover:bg-[#10B981]',
            checkColor: 'text-[#10B981]',
        },
    }

    return (
        <div className="min-h-screen bg-[#1F2937] text-white">
            {/* Header */}
            <header className="border-b border-white/5 bg-[#1F2937]/90 backdrop-blur-xl sticky top-0 z-50">
                <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
                    <Image
                        src="/images/logo_sidebar.png"
                        alt="NF-e Ágil"
                        width={120}
                        height={32}
                        priority
                        className="h-8 w-auto object-contain brightness-0 invert"
                    />
                    <div className="flex items-center gap-4">
                        <span className="text-sm text-white/40">Escolha seu plano</span>
                        <form action={signOut}>
                            <button
                                type="submit"
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white/40 hover:text-white hover:bg-white/5 border border-white/10 transition-colors cursor-pointer"
                            >
                                <LogOut className="h-3.5 w-3.5" />
                                Sair
                            </button>
                        </form>
                    </div>
                </div>
            </header>

            {/* Hero */}
            <div className="relative overflow-hidden">
                {/* Glow effects — Azul Fiscal + Verde Status */}
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-[#1E3A8A]/15 rounded-full blur-[120px]" />
                <div className="absolute top-40 right-0 w-[400px] h-[300px] bg-[#10B981]/8 rounded-full blur-[100px]" />

                <div className="relative max-w-6xl mx-auto px-6 pt-16 pb-12 text-center">
                    {/* Badge — Amarelo Alerta */}
                    <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[#F59E0B]/10 border border-[#F59E0B]/25 text-[#F59E0B] text-sm mb-6">
                        <Star className="h-3.5 w-3.5" />
                        7 dias de teste grátis em qualquer plano
                    </div>
                    <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-4">
                        Comece a usar o{' '}
                        <span className="bg-gradient-to-r from-[#1E3A8A] via-[#2D5BD0] to-[#10B981] bg-clip-text text-transparent">
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
                                {/* Popular Badge — Amarelo Alerta */}
                                {isPopular && (
                                    <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                                        <span className="px-4 py-1 rounded-full bg-[#F59E0B] text-[#1F2937] text-xs font-semibold uppercase tracking-wider shadow-lg shadow-[#F59E0B]/30">
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

                                {/* Features — Verde Status nos checks */}
                                <ul className="space-y-3 mb-8">
                                    {(plan.features ?? []).map((feature, i) => (
                                        <li key={i} className="flex items-start gap-3 text-sm">
                                            <Check className={`h-4 w-4 mt-0.5 ${colors.checkColor} shrink-0`} />
                                            <span className="text-white/70">{feature}</span>
                                        </li>
                                    ))}
                                </ul>

                                {/* CTA — Azul Fiscal */}
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
