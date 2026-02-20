"use client"

import { ColumnDef } from "@tanstack/react-table"
import { ArrowUpDown } from "lucide-react"
import { Button } from "@/components/ui/button"
import { NFeActions, NFeStatus } from "./nfe/nfe-actions"

// Definição do Tipo NFe
export type NFe = {
    id: string
    numero: string
    chave: string
    emitente: string // Razão Social
    valor: number
    status: string // Status Técnico (recebida, manifestada, etc)
    situacao: 'nao_informada' | 'confirmada' | 'recusada' // Status Visual
    dataEmissao: string
    xmlContent: string | null
}

export const columns: ColumnDef<NFe>[] = [
    {
        accessorKey: "chave",
        header: "Chave",
        cell: ({ row }) => (
            <div className="font-mono text-xs text-muted-foreground truncate max-w-[280px]" title={row.getValue("chave")}>
                {row.getValue("chave")}
            </div>
        ),
    },
    {
        accessorKey: "dataEmissao",
        header: ({ column }) => {
            return (
                <Button
                    variant="ghost"
                    onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
                    className="-ml-4 h-8"
                >
                    Data
                    <ArrowUpDown className="ml-2 h-4 w-4" />
                </Button>
            )
        },
        cell: ({ row }) => {
            const date = new Date(row.getValue("dataEmissao"))
            // Fallback se data inválida
            if (isNaN(date.getTime())) return <span className="text-muted-foreground">-</span>
            return <div className="text-sm font-medium">{date.toLocaleDateString("pt-BR")}</div>
        },
    },
    {
        accessorKey: "emitente",
        header: "Fornecedor",
        cell: ({ row }) => (
            <div className="font-medium text-sm truncate max-w-[250px]" title={row.getValue("emitente")}>
                {row.getValue("emitente") || "Fornecedor Desconhecido"}
            </div>
        ),
    },
    {
        accessorKey: "situacao",
        header: "Situação",
        cell: ({ row }) => {
            return (
                <NFeStatus
                    id={row.original.id}
                    situacao={row.getValue("situacao") || 'nao_informada'}
                />
            )
        },
    },
    {
        accessorKey: "valor",
        header: () => <div className="text-right">Valor total</div>,
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
        id: "actions",
        header: "Ações",
        cell: ({ row }) => {
            return (
                <NFeActions
                    id={row.original.id}
                    chave={row.original.chave}
                    hasXml={!!row.original.xmlContent}
                    numero={row.original.numero}
                />
            )
        },
    },
]
