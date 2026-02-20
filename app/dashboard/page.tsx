import { Suspense } from "react"
import { AlertTriangle, CheckCircle, FileText, DollarSign, RefreshCw } from "lucide-react"
import { MetricCard } from "@/components/metric-card"
import { NFeTable } from "./nfe-table"
import { getDashboardMetrics } from "@/actions/nfe"

export default async function DashboardPage() {
    const metrics = await getDashboardMetrics()

    // Mês atual formatado
    const now = new Date()
    const mesAtual = now.toLocaleString("pt-BR", { month: "long", year: "numeric" })

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h2 className="text-3xl font-bold tracking-tight">Monitoramento</h2>
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <MetricCard
                    title={`Total (${mesAtual})`}
                    value={metrics.totalNotasMes.toLocaleString("pt-BR")}
                    description="NF-es no mês vigente"
                    icon={<FileText className="h-4 w-4" />}
                />
                <MetricCard
                    title="Valor Total"
                    value={metrics.valorTotalMes.toLocaleString("pt-BR", { style: 'currency', currency: 'BRL' })}
                    description="Volume financeiro mensal"
                    icon={<DollarSign className="h-4 w-4 text-green-600" />}
                />
                <MetricCard
                    title="XML Disponível"
                    value={metrics.totalXmlDisponivel.toLocaleString("pt-BR")}
                    description="Arquivos importados"
                    icon={<CheckCircle className="h-4 w-4 text-emerald-600" />}
                />
                <MetricCard
                    title="Pendentes"
                    value={metrics.totalPendentes.toLocaleString("pt-BR")}
                    description="Aguardando XML"
                    icon={<AlertTriangle className={`h-4 w-4 ${metrics.totalPendentes > 0 ? "text-yellow-600" : "text-muted-foreground"}`} />}
                />
            </div>

            {/* Suspense obrigatório: NFeTable usa useSearchParams() */}
            <Suspense
                fallback={
                    <div className="flex items-center justify-center gap-2 py-16 text-muted-foreground">
                        <RefreshCw className="h-5 w-5 animate-spin" />
                        <span className="text-sm">Carregando notas fiscais...</span>
                    </div>
                }
            >
                <NFeTable />
            </Suspense>
        </div>
    )
}
