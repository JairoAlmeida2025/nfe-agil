'use client'

import React, { useState } from 'react'
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
    Settings,
} from 'lucide-react'
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
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
        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full ${s.bg} ${s.text} text-[11px] font-medium border border-current/10`}>
            {s.icon}
            {labels[status] ?? 'Desconhecido'}
            {status === 'trialing' && (
                <span className="ml-1 opacity-70 border-l border-current/20 pl-1.5 hidden sm:inline-block">
                    (Em Período de Teste)
                </span>
            )}
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
        <DropdownMenu open={open} onOpenChange={setOpen}>
            <DropdownMenuTrigger asChild>
                <button
                    className="p-1.5 rounded-md hover:bg-white/5 transition-colors outline-none"
                    disabled={loading}
                >
                    {loading ? (
                        <Loader2 className="h-4 w-4 animate-spin text-white/40" />
                    ) : (
                        <MoreHorizontal className="h-4 w-4 text-white/40" />
                    )}
                </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56 bg-[#1F2937] border-[#1E3A8A]/20 text-white rounded-xl shadow-2xl shadow-black/50 p-1">
                {message && (
                    <>
                        <DropdownMenuLabel className="text-xs text-[#10B981]">{message}</DropdownMenuLabel>
                        <DropdownMenuSeparator className="bg-white/5" />
                    </>
                )}

                {sub.status === 'trialing' && (
                    <>
                        <DropdownMenuItem
                            onClick={() => handleAction(() => extendTrial(sub.id, 7))}
                            disabled={loading}
                            className="cursor-pointer text-sm text-white/70 focus:text-white focus:bg-white/10 rounded-lg p-2"
                        >
                            <Clock className="h-3.5 w-3.5 mr-2" />
                            Estender trial (+7 dias)
                        </DropdownMenuItem>
                        <DropdownMenuItem
                            onClick={() => handleAction(() => extendTrial(sub.id, 30))}
                            disabled={loading}
                            className="cursor-pointer text-sm text-white/70 focus:text-white focus:bg-white/10 rounded-lg p-2"
                        >
                            <Clock className="h-3.5 w-3.5 mr-2" />
                            Estender trial (+30 dias)
                        </DropdownMenuItem>
                    </>
                )}

                {sub.status !== 'active' && (
                    <DropdownMenuItem
                        onClick={() => handleAction(() => activateManual(sub.id))}
                        disabled={loading}
                        className="cursor-pointer text-sm text-white/70 focus:text-white focus:bg-white/10 rounded-lg p-2"
                    >
                        <CheckCircle className="h-3.5 w-3.5 mr-2" />
                        {sub.status === 'canceled' ? 'Reativar assinatura' : 'Ativar manualmente'}
                    </DropdownMenuItem>
                )}

                {!sub.is_lifetime && (
                    <DropdownMenuItem
                        onClick={() => handleAction(() => activateLifetime(sub.id))}
                        disabled={loading}
                        className="cursor-pointer text-sm text-[#F59E0B]/80 focus:text-[#F59E0B] focus:bg-[#F59E0B]/10 rounded-lg p-2"
                    >
                        <Infinity className="h-3.5 w-3.5 mr-2" />
                        Tornar Lifetime
                    </DropdownMenuItem>
                )}

                {sub.status !== 'canceled' && (
                    <>
                        <DropdownMenuSeparator className="bg-white/5 mx-1 my-1" />
                        <DropdownMenuItem
                            onClick={() => handleAction(() => cancelSubscription(sub.id))}
                            disabled={loading}
                            className="cursor-pointer text-sm text-red-400/80 focus:text-red-400 focus:bg-red-500/10 rounded-lg p-2"
                        >
                            <XCircle className="h-3.5 w-3.5 mr-2" />
                            Cancelar assinatura
                        </DropdownMenuItem>
                    </>
                )}
            </DropdownMenuContent>
        </DropdownMenu>
    )
}

export function AdminUsersTable({ users }: { users: UserRow[] }) {
    // Group users by company name (or fallback for users without a company)
    const groupedUsers = users.reduce((acc, user) => {
        const companyName = user.empresa || 'Sem Empresa Vinculada'
        if (!acc[companyName]) {
            acc[companyName] = []
        }
        acc[companyName].push(user)
        return acc
    }, {} as Record<string, UserRow[]>)

    return (
        <div className="rounded-xl border border-white/5 overflow-hidden">
            <div className="overflow-x-auto">
                <table className="w-full text-sm">
                    <thead>
                        <tr className="border-b border-white/5 bg-white/[0.02]">
                            <th className="px-4 py-3 text-left text-xs font-medium text-white/40 uppercase tracking-wider w-[35%]">
                                Usuário
                            </th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-white/40 uppercase tracking-wider w-[15%]">
                                Plano
                            </th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-white/40 uppercase tracking-wider w-[15%]">
                                Status
                            </th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-white/40 uppercase tracking-wider w-[15%]">
                                Trial até
                            </th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-white/40 uppercase tracking-wider w-[10%]">
                                Últ. Pagamento
                            </th>
                            <th className="px-4 py-3 text-right text-xs font-medium text-white/40 uppercase tracking-wider w-[10%]">
                                Ações
                            </th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                        {Object.entries(groupedUsers).map(([companyName, companyUsers]) => {
                            const firstUserWithCnpj = companyUsers.find(u => u.cnpj)
                            return (
                                <React.Fragment key={companyName}>
                                    {/* Company Group Header */}
                                    <tr className="bg-white/[0.04]">
                                        <td colSpan={6} className="px-4 py-3">
                                            <div className="flex items-center gap-3">
                                                <div className="h-8 w-8 rounded-lg bg-[#1E3A8A]/20 flex items-center justify-center text-[#5B8DEF] text-xs font-bold">
                                                    {companyName.charAt(0).toUpperCase()}
                                                </div>
                                                <div>
                                                    <p className="font-semibold text-white/90 text-sm">
                                                        {companyName}
                                                    </p>
                                                    {firstUserWithCnpj?.cnpj && (
                                                        <p className="text-[11px] text-white/40 font-mono mt-0.5">
                                                            CNPJ: {firstUserWithCnpj.cnpj}
                                                        </p>
                                                    )}
                                                </div>
                                            </div>
                                        </td>
                                    </tr>

                                    {/* Users in this Company */}
                                    {companyUsers.map(user => (
                                        <tr key={user.id} className="hover:bg-white/[0.02] transition-colors">
                                            <td className="px-4 py-3 pl-8">
                                                <div className="flex items-center gap-2">
                                                    <div className="h-7 w-7 rounded-full bg-white/5 flex items-center justify-center text-[10px] font-bold text-white/40">
                                                        {user.nome?.[0]?.toUpperCase() ?? '?'}
                                                    </div>
                                                    <div>
                                                        <p className="font-medium text-white/80 text-xs flex items-center gap-2">
                                                            {user.nome ?? 'Sem nome'}
                                                            {user.role === 'admin' && (
                                                                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-medium bg-[#1F2937] text-white/40 border border-white/10 uppercase tracking-wider">
                                                                    Admin
                                                                </span>
                                                            )}
                                                            {user.subscription?.status === 'trialing' && (
                                                                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold bg-[#5B8DEF]/10 text-[#5B8DEF] border border-[#5B8DEF]/20 uppercase tracking-wider">
                                                                    Teste Grátis
                                                                </span>
                                                            )}
                                                        </p>
                                                        <p className="text-[11px] text-white/30">{user.email}</p>
                                                    </div>
                                                </div>
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
                                </React.Fragment>
                            )
                        })}
                        {Object.keys(groupedUsers).length === 0 && (
                            <tr>
                                <td colSpan={6} className="px-4 py-8 text-center text-white/30 text-sm">
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
