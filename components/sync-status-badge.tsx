"use client"

import * as React from "react"
import { Badge } from "@/components/ui/badge"
import {
    CheckCircle2,
    AlertTriangle,
    Clock,
    RefreshCw,
    Ban,
    CalendarClock,
    FileCheck,
    Activity
} from "lucide-react"
import { cn } from "@/lib/utils"

// ─── Tipos ────────────────────────────────────────────────────────────────────

type SyncStatus =
    | "atualizado"
    | "nenhum_documento"
    | "bloqueado_656"
    | "erro"
    | "nunca_sincronizado"

interface SyncStatusProps {
    ultimaSync: string | null
    proximaSync: string | null
    quantidadeImportada: number
    status: SyncStatus
    ultimoNsu?: number
    ultimoCstat?: string | null
    blockedUntil?: string | null
    className?: string
}

// ─── Helper ───────────────────────────────────────────────────────────────────

function formatRelative(isoDate: string | null): string {
    if (!isoDate) return "—"
    const date = new Date(isoDate)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMin = Math.floor(diffMs / 60000)
    const diffH = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)

    if (diffMin < 1) return "agora mesmo"
    if (diffMin < 60) return `há ${diffMin} min`
    if (diffH < 24) return `há ${diffH}h`
    if (diffDays === 1) return "ontem"
    return date.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })
}

function formatDateTime(isoDate: string | null): string {
    if (!isoDate) return "—"
    return new Date(isoDate).toLocaleString("pt-BR", {
        day: "2-digit",
        month: "2-digit",
        year: "2-digit",
        hour: "2-digit",
        minute: "2-digit"
    })
}

// ─── Configurações de status ──────────────────────────────────────────────────

const STATUS_CONFIG: Record<SyncStatus, {
    label: string
    badgeVariant: "default" | "secondary" | "destructive" | "outline"
    badgeClass: string
    icon: React.ReactNode
    description: string
}> = {
    atualizado: {
        label: "Atualizado",
        badgeVariant: "default",
        badgeClass: "bg-emerald-500/15 text-emerald-700 border-emerald-500/30 hover:bg-emerald-500/15",
        icon: <CheckCircle2 className="h-3.5 w-3.5" />,
        description: "Sincronização concluída com sucesso"
    },
    nenhum_documento: {
        label: "Sem Novos Docs",
        badgeVariant: "secondary",
        badgeClass: "bg-blue-500/10 text-blue-700 border-blue-500/20 hover:bg-blue-500/10",
        icon: <FileCheck className="h-3.5 w-3.5" />,
        description: "SEFAZ não retornou documentos novos (NSU atual)"
    },
    bloqueado_656: {
        label: "Bloqueado 656",
        badgeVariant: "destructive",
        badgeClass: "bg-orange-500/10 text-orange-700 border-orange-500/20 hover:bg-orange-500/10",
        icon: <Ban className="h-3.5 w-3.5" />,
        description: "Consumo indevido detectado. Aguardando liberação automática."
    },
    erro: {
        label: "Com Erros",
        badgeVariant: "destructive",
        badgeClass: "bg-destructive/10 text-destructive border-destructive/20 hover:bg-destructive/10",
        icon: <AlertTriangle className="h-3.5 w-3.5" />,
        description: "Última sincronização encontrou erros"
    },
    nunca_sincronizado: {
        label: "Aguardando",
        badgeVariant: "outline",
        badgeClass: "bg-muted/50 text-muted-foreground border-border",
        icon: <Clock className="h-3.5 w-3.5" />,
        description: "Nenhuma sincronização realizada ainda"
    }
}

// ─── Componente ───────────────────────────────────────────────────────────────

export function SyncStatusBadge({
    ultimaSync,
    proximaSync,
    quantidadeImportada,
    status,
    ultimoNsu,
    blockedUntil,
    className
}: SyncStatusProps) {
    const config = STATUS_CONFIG[status]

    return (
        <div className={cn("flex flex-wrap items-center gap-3", className)}>
            {/* Badge principal de status */}
            <Badge
                variant="outline"
                className={cn(
                    "gap-1.5 px-2.5 py-1 text-xs font-medium border transition-colors",
                    config.badgeClass
                )}
            >
                {config.icon}
                {config.label}
            </Badge>

            {/* Última execução */}
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Activity className="h-3.5 w-3.5 shrink-0" />
                <span title={formatDateTime(ultimaSync)}>
                    Última: <span className="font-medium text-foreground">{formatRelative(ultimaSync)}</span>
                </span>
            </div>

            {/* Próxima execução automática */}
            {proximaSync && (
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <CalendarClock className="h-3.5 w-3.5 shrink-0" />
                    <span title={formatDateTime(proximaSync)}>
                        Próxima: <span className="font-medium text-foreground">{formatRelative(proximaSync)}</span>
                    </span>
                </div>
            )}

            {/* Quantidade importada */}
            {quantidadeImportada > 0 && (
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <RefreshCw className="h-3.5 w-3.5 shrink-0" />
                    <span>
                        <span className="font-medium text-foreground">{quantidadeImportada.toLocaleString("pt-BR")}</span>
                        {" "}importada{quantidadeImportada !== 1 ? "s" : ""}
                    </span>
                </div>
            )}

            {/* NSU atual */}
            {ultimoNsu !== undefined && ultimoNsu > 0 && (
                <div className="hidden sm:flex items-center gap-1.5 text-xs text-muted-foreground">
                    <span className="font-mono text-[10px] bg-muted rounded px-1.5 py-0.5">
                        NSU {ultimoNsu.toLocaleString("pt-BR")}
                    </span>
                </div>
            )}

            {/* Alerta de bloqueio */}
            {status === "bloqueado_656" && blockedUntil && (
                <span className="text-xs text-orange-600">
                    Libera em {formatDateTime(blockedUntil)}
                </span>
            )}
        </div>
    )
}
