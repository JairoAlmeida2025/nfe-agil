'use client'

import * as React from "react"
import { Download, Printer, Trash2, Eye } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Badge } from "@/components/ui/badge"
import { deleteNFe, getNFeXmlContent, updateNFeSituacao } from "@/actions/nfe-management"
// import { useToast } from "@/components/ui/use-toast" // Se existir, se não uso alert
import { cn } from "@/lib/utils"

interface NFeActionsProps {
    id: string
    chave: string
    hasXml: boolean
}

export function NFeActions({ id, chave, hasXml }: NFeActionsProps) {
    const [isDeleting, startDelete] = React.useTransition()

    const handleDownload = async () => {
        try {
            const { xml, chave } = await getNFeXmlContent(id)
            if (!xml) return alert("XML vazio")

            // Decode base64 or utilize raw string
            // Se for base64: atob(xml) -> Uint8Array -> Blob
            // Se for raw string xml: new Blob([xml], { type: 'application/xml' })

            // Assumindo que pode vir base64 ou raw. 
            // O backend grava xml_content que geralmente é o raw string da Sefaz.
            // Mas em actions/nfe.ts: pfxBase64. O XML da nota recebida (procNFe) é string XML.

            const blob = new Blob([xml], { type: "application/xml" })
            const url = window.URL.createObjectURL(blob)
            const a = document.createElement("a")
            a.href = url
            a.download = `${chave}.xml`
            document.body.appendChild(a)
            a.click()
            window.URL.revokeObjectURL(url)
            document.body.removeChild(a)
        } catch (error: any) {
            alert("Erro ao baixar XML: " + error.message)
        }
    }

    const handlePrint = async () => {
        try {
            const { xml } = await getNFeXmlContent(id)
            if (!xml) return alert("XML vazio")

            const blob = new Blob([xml], { type: "text/xml" })
            const url = window.URL.createObjectURL(blob)
            window.open(url, '_blank')
        } catch (error: any) {
            alert("Erro ao abrir XML: " + error.message)
        }
    }

    const handleDelete = () => {
        startDelete(async () => {
            try {
                await deleteNFe(id)
            } catch (error: any) {
                alert("Erro ao deletar: " + error.message)
            }
        })
    }

    return (
        <div className="flex items-center justify-end gap-2">
            <Button
                variant="secondary"
                size="icon"
                className="h-8 w-8 bg-green-600 text-white hover:bg-green-700 disabled:opacity-50"
                onClick={handleDownload}
                disabled={!hasXml}
                title="Baixar XML"
            >
                <Download className="h-4 w-4" />
            </Button>

            <Button
                variant="secondary"
                size="icon"
                className="h-8 w-8 bg-gray-100 hover:bg-gray-200 text-gray-700 disabled:opacity-50"
                onClick={handlePrint}
                disabled={!hasXml}
                title="Imprimir / Visualizar"
            >
                <Printer className="h-4 w-4" />
            </Button>

            <AlertDialog>
                <AlertDialogTrigger asChild>
                    <Button
                        variant="destructive"
                        size="icon"
                        className="h-8 w-8 hover:bg-red-600"
                        title="Deletar Nota"
                    >
                        <Trash2 className="h-4 w-4" />
                    </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Tem certeza?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Esta ação removerá a nota fiscal do sistema e não poderá ser desfeita.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                            {isDeleting ? "Deletando..." : "Confirmar Exclusão"}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    )
}

// ----------------------------------------------------------------------------

interface NFeStatusProps {
    id: string
    situacao: string // 'nao_informada' | 'confirmada' | 'recusada'
}

export function NFeStatus({ id, situacao }: NFeStatusProps) {
    const [isPending, startTransition] = React.useTransition()

    // Mapeamento de Cores e Labels
    const config = {
        nao_informada: { label: "Não informada", variant: "secondary", className: "bg-gray-500 hover:bg-gray-600 text-white cursor-pointer" },
        confirmada: { label: "Confirmada", variant: "default", className: "bg-green-600 hover:bg-green-700 text-white" }, // verde escuro que nem na imagem? Imagem usa verde normal?
        recusada: { label: "Recusada", variant: "destructive", className: "bg-red-600 hover:bg-red-700 text-white" }
    } as const

    const current = config[situacao as keyof typeof config] || config.nao_informada

    const handleUpdate = (nova: 'confirmada' | 'recusada') => {
        startTransition(async () => {
            try {
                await updateNFeSituacao(id, nova)
            } catch (error: any) {
                alert("Erro ao atualizar situação: " + error.message)
            }
        })
    }

    if (situacao !== 'nao_informada') {
        // Se já foi decidida, mostra badge estática (ou clicável para ver apenas)
        return (
            <Badge variant={current.variant as any} className={cn("uppercase text-[10px] font-bold px-2 py-0.5", current.className)}>
                {current.label}
            </Badge>
        )
    }

    // Se é 'nao_informada', abre modal ao clicar
    return (
        <AlertDialog>
            <AlertDialogTrigger asChild>
                <Badge variant="secondary" className={cn("uppercase text-[10px] font-bold px-2 py-0.5 hover:opacity-80 transition-opacity", current.className)}>
                    {current.label}
                </Badge>
            </AlertDialogTrigger>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>Confirmar ou Recusar Nota</AlertDialogTitle>
                    <AlertDialogDescription>
                        Você deseja confirmar o recebimento desta nota ou recusá-la?
                        Essa ação registrará sua decisão no sistema.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter className="sm:justify-center gap-4 mt-4">
                    <AlertDialogAction
                        onClick={() => handleUpdate('confirmada')}
                        className="bg-green-600 hover:bg-green-700 text-white w-full sm:w-auto"
                        disabled={isPending}
                    >
                        Confirmar Recebimento
                    </AlertDialogAction>
                    <AlertDialogAction
                        onClick={() => handleUpdate('recusada')}
                        className="bg-red-600 hover:bg-red-700 text-white w-full sm:w-auto"
                        disabled={isPending}
                    >
                        Recusar Nota
                    </AlertDialogAction>
                </AlertDialogFooter>
                <div className="flex justify-center mt-2">
                    <AlertDialogCancel className="border-none text-muted-foreground underline">Cancelar (Manter pendente)</AlertDialogCancel>
                </div>
            </AlertDialogContent>
        </AlertDialog>
    )
}
