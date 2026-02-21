'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
    Crown,
    User,
    Clock,
    CheckCircle,
    XCircle,
    MoreHorizontal,
    Shield,
    Infinity,
    ChevronDown,
    Loader2,
} from 'lucide-react'
import {
    extendTrial,
    activateLifetime,
    activateManual,
    cancelSubscription,
} from '@/actions/subscription'

type UserRow = {
    id: string
    nome: string | null
    email: string
    role: string
    created_at: string
    empresa: string | null
    cnpj: string | null
    subscription: {
        id: string
        status: string
        plan_name: string
        plan_slug: string
        price: number
        trial_ends_at: string | null
        is_lifetime: boolean
        manual_override: boolean
        current_period_end: string | null
    } | null
    last_payment: {
        amount: number
        date: string
        status: string
    } | null
}

function StatusBadge({ status, isLifetime }: { status?: string; isLifetime?: boolean }) {
    if (isLifetime) {
        return (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#F59E0B]/10 text-[#F59E0B] text-xs font-medium">
                <Infinity className="h-3 w-3" />
                Lifetime
            </span>
        )
    }

    const map: Record<string, { bg: string; text: string; icon: React.ReactNode }> = {
        active: { bg: 'bg-[#10B981]/10', text: 'text-[#10B981]', icon: <CheckCircle className="h-3 w-3" /> },
        trialing: { bg: 'bg-[#1E3A8A]/10', text: 'text-[#5B8DEF]', icon: <Clock className="h-3 w-3" /> },
        canceled: { bg: 'bg-red-500/10', text: 'text-red-400', icon: <XCircle className="h-3 w-3" /> },
        expired: { bg: 'bg-zinc-500/10', text: 'text-zinc-400', icon: <XCircle className="h-3 w-3" /> },
        past_due: { bg: 'bg-[#F59E0B]/10', text: 'text-[#F59E0B]', icon: <Clock className="h-3 w-3" /> },
    }

    if (!status) {
        return (
            <span className="text-xs text-white/30">Sem plano</span>
        )
    }

    const s = map[status] ?? map.expired
    const labels: Record<string, string> = {
        active: 'Ativo',
        trialing: 'Trial Grátis',
        canceled: 'Cancelado',
        expired: 'Expirado',
        past_due: 'Pendente',
    }

    return (
        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full ${s.bg} ${s.text} text-xs font-medium`}>
            {s.icon}
            {labels[status] ?? status}
        </span>
    )
}

function UserActions({ user }: { user: UserRow }) {
    const router = useRouter()
    const [open, setOpen] = useState(false)
    const [loading, setLoading] = useState(false)
    const [message, setMessage] = useState<string | null>(null)

    const sub = user.subscription

    async function handleAction(action: () => Promise<{ success: boolean; message?: string; error?: string }>) {
        setLoading(true)
        setMessage(null)
        try {
            const result = await action()
            if (result.success) {
                setMessage(result.message ?? 'Sucesso!')
                router.refresh()
            } else {
                setMessage(result.error ?? 'Erro')
            }
        } catch {
            setMessage('Erro inesperado')
        } finally {
            setLoading(false)
            setTimeout(() => setOpen(false), 1500)
        }
    }

    if (!sub) return <span className="text-xs text-white/20">—</span>

    return (
        <div className="relative">
            <button
                onClick={() => setOpen(!open)}
                className="p-1.5 rounded-md hover:bg-white/5 transition-colors"
            >
                {loading ? (
                    <Loader2 className="h-4 w-4 animate-spin text-white/40" />
                ) : (
                    <MoreHorizontal className="h-4 w-4 text-white/40" />
                )}
            </button>

            {open && (
                <>
                    <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
                    <div className="absolute right-0 top-full mt-1 z-50 w-56 rounded-xl border border-[#1E3A8A]/15 bg-[#1F2937] p-1.5 shadow-2xl shadow-black/50">
                        {message && (
                            <div className="px-3 py-2 text-xs text-[#10B981] border-b border-white/5 mb-1">
                                {message}
                            </div>
                        )}

                        {sub.status === 'trialing' && (
                            <button
                                onClick={() => handleAction(() => extendTrial(sub.id, 7))}
                                disabled={loading}
                                className="w-full text-left px-3 py-2 text-sm text-white/60 hover:text-white hover:bg-white/5 rounded-lg transition-colors disabled:opacity-50"
                            >
                                <Clock className="h-3.5 w-3.5 inline mr-2" />
                                Estender trial (+7 dias)
                            </button>
                        )}

                        {sub.status === 'trialing' && (
                            <button
                                onClick={() => handleAction(() => extendTrial(sub.id, 30))}
                                disabled={loading}
                                className="w-full text-left px-3 py-2 text-sm text-white/60 hover:text-white hover:bg-white/5 rounded-lg transition-colors disabled:opacity-50"
                            >
                                <Clock className="h-3.5 w-3.5 inline mr-2" />
                                Estender trial (+30 dias)
                            </button>
                        )}

                        {sub.status !== 'active' && (
                            <button
                                onClick={() => handleAction(() => activateManual(sub.id))}
                                disabled={loading}
                                className="w-full text-left px-3 py-2 text-sm text-white/60 hover:text-white hover:bg-white/5 rounded-lg transition-colors disabled:opacity-50"
                            >
                                <CheckCircle className="h-3.5 w-3.5 inline mr-2" />
                                Ativar manualmente
                            </button>
                        )}

                        {!sub.is_lifetime && (
                            <button
                                onClick={() => handleAction(() => activateLifetime(sub.id))}
                                disabled={loading}
                                className="w-full text-left px-3 py-2 text-sm text-[#F59E0B]/80 hover:text-[#F59E0B] hover:bg-[#F59E0B]/5 rounded-lg transition-colors disabled:opacity-50"
                            >
                                <Infinity className="h-3.5 w-3.5 inline mr-2" />
                                Tornar Lifetime
                            </button>
                        )}

                        {sub.status !== 'canceled' && (
                            <>
                                <div className="border-t border-white/5 my-1" />
                                <button
                                    onClick={() => handleAction(() => cancelSubscription(sub.id))}
                                    disabled={loading}
                                    className="w-full text-left px-3 py-2 text-sm text-red-400/80 hover:text-red-400 hover:bg-red-500/5 rounded-lg transition-colors disabled:opacity-50"
                                >
                                    <XCircle className="h-3.5 w-3.5 inline mr-2" />
                                    Cancelar assinatura
                                </button>
                            </>
                        )}
                    </div>
                </>
            )}
        </div>
    )
}

export function AdminUsersTable({ users }: { users: UserRow[] }) {
    return (
        <div className="rounded-xl border border-white/5 overflow-hidden">
            <div className="overflow-x-auto">
                <table className="w-full text-sm">
                    <thead>
                        <tr className="border-b border-white/5 bg-white/[0.02]">
                            <th className="px-4 py-3 text-left text-xs font-medium text-white/40 uppercase tracking-wider">
                                Usuário
                            </th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-white/40 uppercase tracking-wider">
                                Empresa
                            </th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-white/40 uppercase tracking-wider">
                                Plano
                            </th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-white/40 uppercase tracking-wider">
                                Status
                            </th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-white/40 uppercase tracking-wider">
                                Trial até
                            </th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-white/40 uppercase tracking-wider">
                                Últ. Pagamento
                            </th>
                            <th className="px-4 py-3 text-right text-xs font-medium text-white/40 uppercase tracking-wider">
                                Ações
                            </th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                        {users.map(user => (
                            <tr key={user.id} className="hover:bg-white/[0.02] transition-colors">
                                <td className="px-4 py-3">
                                    <div className="flex items-center gap-2">
                                        <div className="h-7 w-7 rounded-full bg-white/5 flex items-center justify-center text-[10px] font-bold text-white/40">
                                            {user.nome?.[0]?.toUpperCase() ?? '?'}
                                        </div>
                                        <div>
                                            <p className="font-medium text-white/80 text-xs">
                                                {user.nome ?? 'Sem nome'}
                                            </p>
                                            <p className="text-[11px] text-white/30">{user.email}</p>
                                        </div>
                                    </div>
                                </td>
                                <td className="px-4 py-3">
                                    <p className="text-xs text-white/60">{user.empresa ?? '—'}</p>
                                    {user.cnpj && (
                                        <p className="text-[10px] text-white/30 font-mono">{user.cnpj}</p>
                                    )}
                                </td>
                                <td className="px-4 py-3">
                                    <span className="text-xs text-white/60">
                                        {user.subscription?.plan_name ?? '—'}
                                    </span>
                                </td>
                                <td className="px-4 py-3">
                                    <StatusBadge
                                        status={user.subscription?.status}
                                        isLifetime={user.subscription?.is_lifetime}
                                    />
                                </td>
                                <td className="px-4 py-3">
                                    {user.subscription?.trial_ends_at ? (
                                        <span className="text-xs text-white/50">
                                            {new Date(user.subscription.trial_ends_at).toLocaleDateString('pt-BR')}
                                        </span>
                                    ) : (
                                        <span className="text-xs text-white/20">—</span>
                                    )}
                                </td>
                                <td className="px-4 py-3">
                                    {user.last_payment ? (
                                        <div>
                                            <p className="text-xs text-white/60">
                                                R$ {user.last_payment.amount.toFixed(2)}
                                            </p>
                                            <p className="text-[10px] text-white/30">
                                                {new Date(user.last_payment.date).toLocaleDateString('pt-BR')}
                                            </p>
                                        </div>
                                    ) : (
                                        <span className="text-xs text-white/20">—</span>
                                    )}
                                </td>
                                <td className="px-4 py-3 text-right">
                                    <UserActions user={user} />
                                </td>
                            </tr>
                        ))}
                        {users.length === 0 && (
                            <tr>
                                <td colSpan={7} className="px-4 py-8 text-center text-white/30 text-sm">
                                    Nenhum usuário encontrado.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    )
}
