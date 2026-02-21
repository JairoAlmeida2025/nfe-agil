import { NFeTable } from "../nfe-table"
import { FileText } from "lucide-react"
import { listNFesFiltradas } from "@/actions/nfe"
import { PeriodPreset } from "@/lib/constants"

// Garante que a página nunca use cache — sempre executa SSR com os params atuais
export const dynamic = 'force-dynamic'

interface PageProps {
    searchParams: Promise<{
        period?: string
        from?: string
        to?: string
        emitente?: string
        status?: string
        xml?: string
    }>
}

export default async function NFesPage({ searchParams }: PageProps) {
    const params = await searchParams

    console.log('==========================')
    console.log('PERIOD RECEBIDO NA PAGE (SSR):', params.period ?? '(não informado)')

    // Busca 100% server-side — dados chegam prontos ao componente
    const result = await listNFesFiltradas({
        period: (params.period as PeriodPreset) || undefined,
        from: params.from,
        to: params.to,
        emitente: params.emitente,
        status: params.status,
        xml: params.xml,
    })

    const data = result.success ? result.data : []
    console.log('TOTAL NFES:', data.length)
    console.log('==========================')

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

            {/*
              NFeTable é puramente presentacional.
              key força remount quando params mudam.
              currentParams permite ao componente saber os filtros ativos sem useSearchParams.
            */}
            <NFeTable
                key={JSON.stringify(params)}
                data={data as any}
                currentParams={params}
            />
        </div>
    )
}
