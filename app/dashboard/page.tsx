import { Activity, AlertTriangle, CheckCircle, FileText } from "lucide-react"
import { MetricCard } from "@/components/metric-card"
import { NFeTable } from "./nfe-table"
import { getDashboardMetrics } from "@/actions/nfe"

export default async function DashboardPage() {
    const metrics = await getDashboardMetrics()

    // Formatar a última sincronização para exibição
    const ultimaSyncLabel = metrics.ultimaSync
        ? (() => {
            const diff = Date.now() - new Date(metrics.ultimaSync).getTime()
            const minutes = Math.floor(diff / 60000)
            const hours = Math.floor(diff / 3600000)
            const days = Math.floor(diff / 86400000)
            if (minutes < 1) return "agora"
            if (minutes < 60) return `${minutes}min atrás`
            if (hours < 24) return `${hours}h atrás`
            return `${days}d atrás`
        })()
        : "Nunca sincronizado"

    const integracaoDescricao =
        metrics.integracaoStatus === "ativa"
            ? `Última sincronia: ${ultimaSyncLabel}`
            : metrics.integracaoStatus === "sem_certificado"
                ? "Certificado não configurado"
                : "Aguardando primeira sinc"

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
                    title="Recebidas (Hoje)"
                    value={String(metrics.recebidosHoje)}
                    description="NF-es capturadas hoje"
                    icon={<FileText className="h-4 w-4" />}
                />
                <MetricCard
                    title="Pendentes"
                    value={String(metrics.pendentes)}
                    description="Aguardando manifestação"
                    icon={<AlertTriangle className={`h-4 w-4 ${metrics.pendentes > 0 ? "text-yellow-600" : ""}`} />}
                />
                <MetricCard
                    title={`Total (${mesAtual})`}
                    value={metrics.totalMes.toLocaleString("pt-BR")}
                    description="NF-es no mês vigente"
                    icon={<CheckCircle className="h-4 w-4 text-green-600" />}
                />
                <MetricCard
                    title="Integração (SEFAZ)"
                    value={metrics.integracaoStatus === "ativa" ? "Online" : "Inativa"}
                    description={integracaoDescricao}
                    icon={<Activity className={`h-4 w-4 ${metrics.integracaoStatus === "ativa" ? "text-green-600" : "text-muted-foreground"}`} />}
                />
            </div>

            <NFeTable />
        </div>
    )
}
