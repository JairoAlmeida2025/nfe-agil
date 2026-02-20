import { Suspense } from "react"
import { NFeTable } from "../nfe-table"
import { FileText, RefreshCw } from "lucide-react"
import { listNFesFiltradas } from "@/actions/nfe"
import { PeriodPreset } from "@/lib/date-brt"

interface PageProps {
    searchParams: Promise<{
        period?: string
        from?: string
        to?: string
        emitente?: string
        status?: string
    }>
}

export default async function NFesPage({ searchParams }: PageProps) {
    const params = await searchParams

    // Busca inicial no servidor para evitar layout shift e loading desnecessário
    const result = await listNFesFiltradas({
        periodo: (params.period as PeriodPreset) || "mes_atual",
        customFrom: params.from,
        customTo: params.to,
        emitente: params.emitente,
        status: params.status,
    })

    const initialData = result.success ? result.data : []

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <FileText className="h-8 w-8 text-primary" />
                    <div>
                        <h2 className="text-3xl font-bold tracking-tight">NF-es Recebidas</h2>
                        <p className="text-muted-foreground">
                            Gerencie e filtre todas as Notas Fiscais capturadas da SEFAZ
                        </p>
                    </div>
                </div>
            </div>

            <Suspense
                fallback={
                    <div className="flex items-center justify-center gap-2 py-16 text-muted-foreground">
                        <RefreshCw className="h-5 w-5 animate-spin" />
                        <span className="text-sm">Carregando notas fiscais...</span>
                    </div>
                }
            >
                {/* 
                  Passamos initialData para o componente cliente. 
                  O componente cliente ainda mantém seu useEffect para mudanças posteriores na URL.
                */}
                <NFeTable initialData={initialData as any} />
            </Suspense>
        </div>
    )
}
