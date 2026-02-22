'use client'

import * as React from "react"
import { Download, Printer, Trash2, FileText, Loader2 } from "lucide-react"
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
import { deleteNFe, getNFeXmlContent, manifestarSefaz } from "@/actions/nfe-management"
// import { useToast } from "@/components/ui/use-toast" // Se existir, se não uso alert
import { cn } from "@/lib/utils"
import { NFE_STATUS } from "@/lib/constants"

interface NFeActionsProps {
    id: string
    chave: string
    hasXml: boolean
    numero?: string | null
}

export function NFeActions({ id, chave, hasXml, numero }: NFeActionsProps) {
    const [isDeleting, startDelete] = React.useTransition()
    const [isPdfLoading, setIsPdfLoading] = React.useState(false)

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

    const handleViewPDF = async () => {
        if (!hasXml) {
            alert("XML ainda não disponível pela SEFAZ.")
            return
        }
        try {
            setIsPdfLoading(true)
            // Testa a resposta antes de abrir nova aba
            const res = await fetch(`/api/nfe/${id}/pdf`, { method: 'GET', credentials: 'include' })
            if (!res.ok) {
                const body = await res.json().catch(() => ({}))
                if (res.status === 422) {
                    alert(body.error ?? "XML ainda não disponível pela SEFAZ.")
                } else if (res.status === 401) {
                    alert("Sessão expirada. Faça login novamente.")
                } else {
                    alert(body.error ?? "Erro ao gerar o DANFE.")
                }
                return
            }
            // Se ok, abrir em nova aba
            window.open(`/api/nfe/${id}/pdf`, '_blank', 'noopener')
        } catch (error: any) {
            alert("Erro ao gerar DANFE: " + error.message)
        } finally {
            setIsPdfLoading(false)
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
            {/* Botão DANFE (PDF) */}
            <Button
                variant="secondary"
                size="icon"
                className="h-8 w-8 bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
                onClick={handleViewPDF}
                disabled={!hasXml || isPdfLoading}
                title={hasXml ? "Visualizar DANFE (PDF)" : "XML não disponível"}
            >
                {isPdfLoading
                    ? <Loader2 className="h-4 w-4 animate-spin" />
                    : <FileText className="h-4 w-4" />
                }
            </Button>

            {/* Botão Download XML */}
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
    chave: string
    situacao: string // 'nao_informada' | 'confirmada' | 'recusada'
}

export function NFeStatus({ id, chave, situacao }: NFeStatusProps) {
    const [isPending, startTransition] = React.useTransition()

    // Mapeamento de Cores e Labels
    const config = {
        [NFE_STATUS.NAO_INFORMADA]: { label: "Não informada", variant: "secondary", className: "bg-gray-500 hover:bg-gray-600 text-white cursor-pointer" },
        [NFE_STATUS.CONFIRMADA]: { label: "Confirmada", variant: "default", className: "bg-green-600 hover:bg-green-700 text-white" },
        [NFE_STATUS.RECUSADA]: { label: "Recusada", variant: "destructive", className: "bg-red-600 hover:bg-red-700 text-white" }
    } as const

    const current = config[situacao as keyof typeof config] || config[NFE_STATUS.NAO_INFORMADA]

    const handleManifestar = (
        tipoEvento: '210200' | '210220' | '210240',
        novaSituacao: typeof NFE_STATUS.CONFIRMADA | typeof NFE_STATUS.RECUSADA
    ) => {
        startTransition(async () => {
            try {
                const result = await manifestarSefaz(id, chave, tipoEvento, novaSituacao)
                alert(`Manifestação enviada com sucesso! \nRetorno Sefaz: ${result.xMotivo}`)
            } catch (error: any) {
                alert(`Falha ao manifestar: ${error.message}`)
            }
        })
    }

    if (situacao !== NFE_STATUS.NAO_INFORMADA) {
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
                    <AlertDialogTitle>Manifestação do Destinatário (SEFAZ)</AlertDialogTitle>
                    <AlertDialogDescription>
                        Esta ação enviará um evento oficial assinado com o seu Certificado Digital para a Secretaria da Fazenda. Qual evento deseja registrar?
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <div className="flex flex-col gap-3 mt-4">
                    <Button
                        variant="default"
                        className="bg-green-600 hover:bg-green-700 w-full justify-start"
                        disabled={isPending}
                        onClick={() => handleManifestar('210200', NFE_STATUS.CONFIRMADA)}
                    >
                        {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                        Confirmação da Operação (Reconheço a nota e o recebimento)
                    </Button>
                    <Button
                        variant="destructive"
                        className="w-full justify-start"
                        disabled={isPending}
                        onClick={() => handleManifestar('210220', NFE_STATUS.RECUSADA)}
                    >
                        {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                        Desconhecimento da Operação (Não reconheço essa nota)
                    </Button>
                    <Button
                        variant="outline"
                        className="w-full justify-start text-red-600 border-red-200 hover:bg-red-50"
                        disabled={isPending}
                        onClick={() => handleManifestar('210240', NFE_STATUS.RECUSADA)}
                    >
                        {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                        Operação Não Realizada (Reconheço, mas não foi concluída)
                    </Button>
                </div>
                <div className="flex justify-center mt-2">
                    <AlertDialogCancel disabled={isPending} className="border-none text-muted-foreground underline">
                        Cancelar (Manter pendente)
                    </AlertDialogCancel>
                </div>
            </AlertDialogContent>
        </AlertDialog>
    )
}
