import { getSaasMetrics } from '@/actions/subscription'
import {
    Users,
    CreditCard,
    Clock,
    TrendingUp,
    DollarSign,
    XCircle,
    BarChart3,
    Activity,
} from 'lucide-react'

export const dynamic = 'force-dynamic'

export const metadata = {
    title: 'Admin Dashboard | NF-e Ágil',
}

/**
 * Paleta Oficial NF-e Ágil
 * Azul Fiscal: #1E3A8A    Verde Status: #10B981
 * Cinza Claro: #F3F4F6    Amarelo: #F59E0B    Grafite: #1F2937
 */

function MetricCard({
    label,
    value,
    icon: Icon,
    color,
    prefix,
    suffix,
}: {
    label: string
    value: number | string
    icon: React.ElementType
    color: string
    prefix?: string
    suffix?: string
}) {
    const colorMap: Record<string, { bg: string; text: string; icon: string }> = {
        blue: { bg: 'bg-[#1E3A8A]/10', text: 'text-[#5B8DEF]', icon: 'text-[#1E3A8A]' },
        green: { bg: 'bg-[#10B981]/10', text: 'text-[#10B981]', icon: 'text-[#10B981]' },
        yellow: { bg: 'bg-[#F59E0B]/10', text: 'text-[#F59E0B]', icon: 'text-[#F59E0B]' },
        red: { bg: 'bg-red-500/10', text: 'text-red-400', icon: 'text-red-500' },
        cyan: { bg: 'bg-[#1E3A8A]/8', text: 'text-[#5B8DEF]', icon: 'text-[#1E3A8A]' },
    }

    const c = colorMap[color] ?? colorMap.blue

    return (
        <div className="rounded-xl border border-white/5 bg-white/[0.02] p-5 hover:bg-white/[0.04] transition-colors">
            <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-medium text-white/40 uppercase tracking-wider">
                    {label}
                </span>
                <div className={`p-2 rounded-lg ${c.bg}`}>
                    <Icon className={`h-4 w-4 ${c.icon}`} />
                </div>
            </div>
            <div className={`text-2xl font-bold ${c.text}`}>
                {prefix}
                {typeof value === 'number' ? value.toLocaleString('pt-BR') : value}
                {suffix}
            </div>
        </div>
    )
}

export default async function AdminDashboardPage() {
    const metrics = await getSaasMetrics()

    if (!metrics) {
        return (
            <div className="flex items-center justify-center h-64">
                <p className="text-white/40">Acesso não autorizado.</p>
            </div>
        )
    }

    return (
        <div className="space-y-8">
            {/* Header */}
            <div>
                <h1 className="text-2xl font-bold tracking-tight">Dashboard SaaS</h1>
                <p className="text-sm text-white/40 mt-1">
                    Visão geral do sistema — métricas em tempo real
                </p>
            </div>

            {/* Metrics Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <MetricCard
                    label="Total Usuários"
                    value={metrics.totalUsers}
                    icon={Users}
                    color="blue"
                />
                <MetricCard
                    label="Assinaturas Ativas"
                    value={metrics.activeSubscriptions}
                    icon={CreditCard}
                    color="green"
                />
                <MetricCard
                    label="Trials Ativos"
                    value={metrics.activeTrials}
                    icon={Clock}
                    color="yellow"
                />
                <MetricCard
                    label="Cancelados (30d)"
                    value={metrics.canceledLast30}
                    icon={XCircle}
                    color="red"
                />
            </div>

            {/* Revenue Metrics */}
            <div>
                <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                    <Activity className="h-4 w-4 text-[#1E3A8A]" />
                    Receita
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <MetricCard
                        label="MRR"
                        value={metrics.mrr.toFixed(2)}
                        icon={TrendingUp}
                        color="blue"
                        prefix="R$ "
                    />
                    <MetricCard
                        label="ARPU"
                        value={metrics.arpu.toFixed(2)}
                        icon={BarChart3}
                        color="cyan"
                        prefix="R$ "
                    />
                    <MetricCard
                        label="Receita Total"
                        value={metrics.totalRevenue.toFixed(2)}
                        icon={DollarSign}
                        color="green"
                        prefix="R$ "
                    />
                </div>
            </div>

            {/* Quick Info */}
            <div className="rounded-xl border border-[#1E3A8A]/10 bg-[#1E3A8A]/5 p-6">
                <h3 className="text-sm font-semibold text-[#5B8DEF] mb-3">Informações Rápidas</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-white/40">
                    <div>
                        <span className="text-white/60">Plano mais popular:</span>
                        <br />
                        Pro (R$ 49/mês)
                    </div>
                    <div>
                        <span className="text-white/60">Taxa de conversão trial→ativo:</span>
                        <br />
                        {metrics.activeSubscriptions > 0 && metrics.activeTrials > 0
                            ? `${((metrics.activeSubscriptions / (metrics.activeSubscriptions + metrics.activeTrials)) * 100).toFixed(0)}%`
                            : 'N/A'
                        }
                    </div>
                    <div>
                        <span className="text-white/60">Próxima receita estimada:</span>
                        <br />
                        R$ {metrics.mrr.toFixed(2)}
                    </div>
                </div>
            </div>
        </div>
    )
}
