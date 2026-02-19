"use client"

import { ColumnDef } from "@tanstack/react-table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ArrowUpDown, Eye, Download } from "lucide-react"

export type NFe = {
    id: string
    numero: string
    chave: string
    emitente: string
    valor: number
    status: "recebida" | "manifestada" | "arquivada" | "cancelada"
    dataEmissao: string
}

export const columns: ColumnDef<NFe>[] = [
    {
        accessorKey: "numero",
        header: "Número",
        cell: ({ row }) => <div className="font-mono">{row.getValue("numero")}</div>,
    },
    {
        accessorKey: "emitente",
        header: ({ column }) => {
            return (
                <Button
                    variant="ghost"
                    onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
                >
                    Emitente
                    <ArrowUpDown className="ml-2 h-4 w-4" />
                </Button>
            )
        },
    },
    {
        accessorKey: "chave",
        header: "Chave de Acesso",
        cell: ({ row }) => (
            <div className="font-mono text-xs text-muted-foreground truncate max-w-[200px]">
                {row.getValue("chave")}
            </div>
        ),
    },
    {
        accessorKey: "dataEmissao",
        header: "Emissão",
    },
    {
        accessorKey: "valor",
        header: () => <div className="text-right">Valor</div>,
        cell: ({ row }) => {
            const amount = parseFloat(row.getValue("valor"))
            const formatted = new Intl.NumberFormat("pt-BR", {
                style: "currency",
                currency: "BRL",
            }).format(amount)

            return <div className="text-right font-medium">{formatted}</div>
        },
    },
    {
        accessorKey: "status",
        header: "Status",
        cell: ({ row }) => {
            const status = row.getValue("status") as string
            let variant: "default" | "secondary" | "destructive" | "outline" | "success" | "warning" = "default"

            if (status === "recebida") variant = "secondary"
            if (status === "manifestada") variant = "warning"
            if (status === "arquivada") variant = "success"
            if (status === "cancelada") variant = "destructive"

            return (
                <Badge variant={variant} className="uppercase text-[10px]">
                    {status}
                </Badge>
            )
        },
    },
    {
        id: "actions",
        cell: ({ row }) => {
            return (
                <div className="flex justify-end gap-2">
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                        <Eye className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                        <Download className="h-4 w-4" />
                    </Button>
                </div>
            )
        },
    },
]
