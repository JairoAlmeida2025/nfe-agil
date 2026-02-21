import { listAllPayments } from '@/actions/subscription'
import { DollarSign, CheckCircle, XCircle, Clock } from 'lucide-react'

export const dynamic = 'force-dynamic'

export const metadata = {
    title: 'Pagamentos | Admin NF-e Ágil',
}

function PaymentStatusBadge({ status }: { status: string }) {
    const map: Record<string, { bg: string; text: string; label: string }> = {
        succeeded: { bg: 'bg-[#10B981]/10', text: 'text-[#10B981]', label: 'Pago' },
        pending: { bg: 'bg-[#F59E0B]/10', text: 'text-[#F59E0B]', label: 'Pendente' },
        failed: { bg: 'bg-red-500/10', text: 'text-red-400', label: 'Falhou' },
        refunded: { bg: 'bg-zinc-500/10', text: 'text-zinc-400', label: 'Reembolsado' },
    }

    const s = map[status] ?? map.pending

    return (
        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full ${s.bg} ${s.text} text-xs font-medium`}>
            {s.label}
        </span>
    )
}

export default async function AdminPagamentosPage() {
    const payments = await listAllPayments()

    const totalReceived = payments
        .filter((p: any) => p.status === 'succeeded')
        .reduce((sum: number, p: any) => sum + (p.amount ?? 0), 0)

    return (
        <div className="space-y-6">
            <div className="flex items-start justify-between">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Pagamentos</h1>
                    <p className="text-sm text-white/40 mt-1">
                        Histórico completo de pagamentos — {payments.length} registros
                    </p>
                </div>
                <div className="rounded-xl border border-white/5 bg-white/[0.02] px-4 py-3 text-right">
                    <p className="text-[10px] text-white/40 uppercase tracking-wider">Total recebido</p>
                    <p className="text-lg font-bold text-[#10B981]">
                        R$ {totalReceived.toFixed(2)}
                    </p>
                </div>
            </div>

            <div className="rounded-xl border border-white/5 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b border-white/5 bg-white/[0.02]">
                                <th className="px-4 py-3 text-left text-xs font-medium text-white/40 uppercase tracking-wider">
                                    Valor
                                </th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-white/40 uppercase tracking-wider">
                                    Usuário
                                </th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-white/40 uppercase tracking-wider">
                                    Status
                                </th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-white/40 uppercase tracking-wider">
                                    Plano
                                </th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-white/40 uppercase tracking-wider">
                                    Data
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {payments.map((payment: any) => (
                                <tr key={payment.id} className="hover:bg-white/[0.02] transition-colors">
                                    <td className="px-4 py-3">
                                        <span className="font-mono text-sm text-white/80">
                                            R$ {(payment.amount ?? 0).toFixed(2)}
                                        </span>
                                        <span className="text-[10px] text-white/30 ml-1 uppercase">
                                            {payment.currency}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3">
                                        <p className="text-xs text-white/60">
                                            {payment.profiles?.nome ?? 'N/A'}
                                        </p>
                                    </td>
                                    <td className="px-4 py-3">
                                        <PaymentStatusBadge status={payment.status} />
                                    </td>
                                    <td className="px-4 py-3">
                                        <span className="text-xs text-white/50">
                                            {payment.subscriptions?.plans?.name ?? '—'}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3">
                                        <span className="text-xs text-white/40">
                                            {new Date(payment.created_at).toLocaleDateString('pt-BR', {
                                                day: '2-digit',
                                                month: '2-digit',
                                                year: 'numeric',
                                                hour: '2-digit',
                                                minute: '2-digit',
                                            })}
                                        </span>
                                    </td>
                                </tr>
                            ))}
                            {payments.length === 0 && (
                                <tr>
                                    <td colSpan={5} className="px-4 py-8 text-center text-white/30 text-sm">
                                        Nenhum pagamento registrado.
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
