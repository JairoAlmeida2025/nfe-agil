import { listAllSubscriptions } from '@/actions/subscription'
import {
    CheckCircle,
    Clock,
    XCircle,
    Infinity,
    CreditCard,
} from 'lucide-react'

export const dynamic = 'force-dynamic'

export const metadata = {
    title: 'Assinaturas | Admin NF-e Ágil',
}

function StatusBadge({ status, isLifetime }: { status: string; isLifetime?: boolean }) {
    if (isLifetime) {
        return (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 text-xs font-medium">
                <Infinity className="h-3 w-3" />
                Lifetime
            </span>
        )
    }

    const map: Record<string, { bg: string; text: string; label: string }> = {
        active: { bg: 'bg-emerald-500/10', text: 'text-emerald-400', label: 'Ativo' },
        trialing: { bg: 'bg-blue-500/10', text: 'text-blue-400', label: 'Trial' },
        canceled: { bg: 'bg-red-500/10', text: 'text-red-400', label: 'Cancelado' },
        expired: { bg: 'bg-zinc-500/10', text: 'text-zinc-400', label: 'Expirado' },
        past_due: { bg: 'bg-orange-500/10', text: 'text-orange-400', label: 'Pendente' },
    }

    const s = map[status] ?? map.expired

    return (
        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full ${s.bg} ${s.text} text-xs font-medium`}>
            {s.label}
        </span>
    )
}

export default async function AdminAssinaturasPage() {
    const subscriptions = await listAllSubscriptions()

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold tracking-tight">Assinaturas</h1>
                <p className="text-sm text-white/40 mt-1">
                    Todas as assinaturas do sistema — {subscriptions.length} registros
                </p>
            </div>

            <div className="rounded-xl border border-white/5 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b border-white/5 bg-white/[0.02]">
                                <th className="px-4 py-3 text-left text-xs font-medium text-white/40 uppercase tracking-wider">
                                    Usuário
                                </th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-white/40 uppercase tracking-wider">
                                    Plano
                                </th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-white/40 uppercase tracking-wider">
                                    Status
                                </th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-white/40 uppercase tracking-wider">
                                    Stripe ID
                                </th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-white/40 uppercase tracking-wider">
                                    Trial até
                                </th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-white/40 uppercase tracking-wider">
                                    Próx. cobrança
                                </th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-white/40 uppercase tracking-wider">
                                    Criado em
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {subscriptions.map((sub: any) => (
                                <tr key={sub.id} className="hover:bg-white/[0.02] transition-colors">
                                    <td className="px-4 py-3">
                                        <p className="text-xs text-white/70">
                                            {sub.profiles?.nome ?? 'N/A'}
                                        </p>
                                    </td>
                                    <td className="px-4 py-3">
                                        <span className="text-xs text-white/60">
                                            {sub.plans?.name ?? 'N/A'}
                                        </span>
                                        {sub.plans?.price && (
                                            <span className="text-[10px] text-white/30 ml-1">
                                                R${sub.plans.price}
                                            </span>
                                        )}
                                    </td>
                                    <td className="px-4 py-3">
                                        <StatusBadge status={sub.status} isLifetime={sub.is_lifetime} />
                                        {sub.manual_override && (
                                            <span className="ml-1 text-[9px] text-amber-500/50 uppercase">manual</span>
                                        )}
                                    </td>
                                    <td className="px-4 py-3">
                                        <span className="text-xs text-white/30 font-mono">
                                            {sub.stripe_subscription_id
                                                ? sub.stripe_subscription_id.substring(0, 20) + '...'
                                                : '—'
                                            }
                                        </span>
                                    </td>
                                    <td className="px-4 py-3">
                                        {sub.trial_ends_at ? (
                                            <span className="text-xs text-white/50">
                                                {new Date(sub.trial_ends_at).toLocaleDateString('pt-BR')}
                                            </span>
                                        ) : (
                                            <span className="text-xs text-white/20">—</span>
                                        )}
                                    </td>
                                    <td className="px-4 py-3">
                                        {sub.current_period_end ? (
                                            <span className="text-xs text-white/50">
                                                {new Date(sub.current_period_end).toLocaleDateString('pt-BR')}
                                            </span>
                                        ) : (
                                            <span className="text-xs text-white/20">—</span>
                                        )}
                                    </td>
                                    <td className="px-4 py-3">
                                        <span className="text-xs text-white/40">
                                            {new Date(sub.created_at).toLocaleDateString('pt-BR')}
                                        </span>
                                    </td>
                                </tr>
                            ))}
                            {subscriptions.length === 0 && (
                                <tr>
                                    <td colSpan={7} className="px-4 py-8 text-center text-white/30 text-sm">
                                        Nenhuma assinatura encontrada.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    )
}
