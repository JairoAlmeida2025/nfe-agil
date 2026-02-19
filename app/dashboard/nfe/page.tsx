import { NFeTable } from "../nfe-table"
import { FileText } from "lucide-react"

export default function NFesPage() {
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

            <NFeTable />
        </div>
    )
}
