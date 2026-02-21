"use client"

import * as React from "react"
import { createPortal } from "react-dom"
import {
    AlertTriangle,
    FileX,
    CheckCircle2,
    SlidersHorizontal,
    Search,
    X,
    ChevronDown,
    Calendar,
    CloudDownload,
    Loader2,
} from "lucide-react"
import { DataTable } from "@/components/ui/data-table"
import { columns, NFe } from "./columns"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Select } from "@/components/ui/select"
import { cn } from "@/lib/utils"
import { syncNFesFromSEFAZ, getSyncStatus } from "@/actions/nfe"
import { SyncStatusBadge } from "@/components/sync-status-badge"
import type { PeriodPreset } from "@/lib/constants"
import { NFE_STATUS, NFE_XML_FILTER, PERIOD_PRESETS } from "@/lib/constants"

// ─── Labels dos Presets ────────────────────────────────────────────────────────

const PRESETS: { key: PeriodPreset; label: string }[] = [
    { key: PERIOD_PRESETS.HOJE, label: "Hoje" },
    { key: PERIOD_PRESETS.ESTA_SEMANA, label: "Esta semana" },
    { key: PERIOD_PRESETS.MES_ATUAL, label: "Este mês" },
    { key: PERIOD_PRESETS.MES_PASSADO, label: "Mês passado" },
    { key: PERIOD_PRESETS.TODOS, label: "Todo o período" },
    { key: PERIOD_PRESETS.CUSTOM, label: "Escolha o período…" },
]

function presetLabel(preset: PeriodPreset | undefined, from?: string, to?: string): string {
    if (!preset) return "Todo o período"
    const now = new Date()
    const labels: Record<PeriodPreset, string> = {
        hoje: "Hoje",
        esta_semana: "Esta semana",
        mes_atual: now.toLocaleString("pt-BR", { month: "long", year: "numeric" }).replace(/^\w/, (c) => c.toUpperCase()),
        mes_passado: "Mês passado",
        todos: "Todo o período",
        custom: from && to
            ? `De ${new Date(from + 'T12:00:00').toLocaleDateString('pt-BR')} até ${new Date(to + 'T12:00:00').toLocaleDateString('pt-BR')}`
            : "Período personalizado",
    }
    return labels[preset] || "Período"
}

// ─── Props do componente ──────────────────────────────────────────────────────

interface NFeTableProps {
    data?: NFe[]
    /** Query params atuais vindo do server — usados para montar URLs e marcar filtro ativo */
    currentParams?: {
        period?: string
        from?: string
        to?: string
        emitente?: string
        status?: string
        xml?: string
    }
}

// ─── Componente principal — PURAMENTE PRESENTACIONAL ─────────────────────────
// Não faz fetch. Recebe dados via prop `data` (pré-carregados pelo Server Component).
// Navegação usa window.location.href para GARANTIR hard navigation + SSR completo.

export function NFeTable({ data = [], currentParams = {} }: NFeTableProps) {
    // ── Filtros derivados dos params do servidor (única fonte de verdade) ─────
    const currentPeriod = (currentParams.period as PeriodPreset) || undefined
    const currentFrom = currentParams.from || ""
    const currentTo = currentParams.to || ""
    const currentEmitente = currentParams.emitente || ""
    const currentStatus = currentParams.status || "todas"
    const currentXml = currentParams.xml || "todas"

    // ── Estado de UI local (não controla dados) ───────────────────────────────
    const [showAdvanced, setShowAdvanced] = React.useState(false)
    const [showPeriodMenu, setShowPeriodMenu] = React.useState(false)
    const [menuPos, setMenuPos] = React.useState({ top: 0, right: 0 })
    const periodMenuRef = React.useRef<HTMLDivElement>(null)
    const portalMenuRef = React.useRef<HTMLDivElement>(null)

    // pendingFilters: usado apenas enquanto o usuário digita nos inputs antes de aplicar
    const [pendingFilters, setPendingFilters] = React.useState({
        customFrom: currentFrom,
        customTo: currentTo,
        emitente: currentEmitente,
        status: currentStatus,
        xml: currentXml,
    })

    // ── Estados para sync SEFAZ (operação client) ─────────────────────────────
    const [sefazSyncing, setSefazSyncing] = React.useState(false)
    const [sefazMsg, setSefazMsg] = React.useState<{ type: "success" | "error"; text: string } | null>(null)
    const [syncStatusData, setSyncStatusData] = React.useState<Awaited<ReturnType<typeof getSyncStatus>>>(null)
    const [isNavigating, setIsNavigating] = React.useState(false)

    // ── Carregar status de sync ao montar ─────────────────────────────────────
    React.useEffect(() => {
        getSyncStatus().then(setSyncStatusData).catch(() => { })
    }, [])

    // ── Fechar menu de período ao clicar fora (verifica botão E portal) ─────
    React.useEffect(() => {
        function handler(e: MouseEvent) {
            const target = e.target as Node
            const clickedInsideButton = periodMenuRef.current?.contains(target)
            const clickedInsidePortal = portalMenuRef.current?.contains(target)
            if (!clickedInsideButton && !clickedInsidePortal) {
                setShowPeriodMenu(false)
            }
        }
        document.addEventListener("mousedown", handler)
        return () => document.removeEventListener("mousedown", handler)
    }, [])

    // ── Navegação HARD (window.location) — garante SSR completo ──────────────

    /**
     * Monta URL com query params e navega via window.location.href.
     * Isso garante que o Next.js App Router execute o Server Component
     * do zero, sem cache, sem reaproveitamento de estado client.
     */
    function navigateTo(overrides: Record<string, string | undefined>) {
        const params = new URLSearchParams()

        const period = overrides.period ?? (currentPeriod || "todos")
        const from = overrides.from ?? currentFrom
        const to = overrides.to ?? currentTo
        const emitente = overrides.emitente ?? currentEmitente
        const status = overrides.status ?? currentStatus
        const xml = overrides.xml ?? currentXml

        params.set("period", period)
        if (from) params.set("from", from)
        if (to) params.set("to", to)
        if (emitente) params.set("emitente", emitente)
        if (status && status !== "todas") params.set("status", status)
        if (xml && xml !== "todas") params.set("xml", xml)

        // Hard navigation — SSR executará o page.tsx do zero
        setIsNavigating(true)
        window.location.href = `${window.location.pathname}?${params.toString()}`
    }

    function selectPreset(preset: PeriodPreset) {
        setShowPeriodMenu(false)

        const params = new URLSearchParams()
        params.set("period", preset)

        // Ao mudar preset (exceto custom), limpa datas customizadas
        if (preset !== "custom") {
            if (currentEmitente) params.set("emitente", currentEmitente)
            if (currentStatus && currentStatus !== "todas") params.set("status", currentStatus)
            if (currentXml && currentXml !== "todas") params.set("xml", currentXml)
        } else {
            if (currentFrom) params.set("from", currentFrom)
            if (currentTo) params.set("to", currentTo)
            if (currentEmitente) params.set("emitente", currentEmitente)
            if (currentStatus && currentStatus !== "todas") params.set("status", currentStatus)
            if (currentXml && currentXml !== "todas") params.set("xml", currentXml)
        }

        // HARD NAVIGATION — garante SSR completo
        setIsNavigating(true)
        window.location.href = `${window.location.pathname}?${params.toString()}`
    }

    function applyAdvanced() {
        setShowAdvanced(false)
        navigateTo({
            emitente: pendingFilters.emitente || undefined,
            status: pendingFilters.status,
            xml: pendingFilters.xml,
        })
    }

    function clearAdvanced() {
        setShowAdvanced(false)
        setIsNavigating(true)
        window.location.href = window.location.pathname
    }

    function applyCustomRange() {
        navigateTo({
            period: "custom",
            from: pendingFilters.customFrom,
            to: pendingFilters.customTo,
        })
    }

    async function refreshSyncStatus() {
        const s = await getSyncStatus().catch(() => null)
        setSyncStatusData(s)
    }

    const activeFilterCount = [
        currentEmitente,
        currentStatus && currentStatus !== "todas" ? currentStatus : "",
        currentPeriod === "custom" && currentFrom ? "custom" : "",
    ].filter(Boolean).length

    const isEmpty = data.length === 0

    // ─── Render ───────────────────────────────────────────────────────────────

    return (
        <div className="rounded-sm border-t-2 border-t-primary pt-4">
            {/* ── Cabeçalho ──────────────────────────────────────────────────────── */}
            <div className="mb-4 flex flex-wrap items-start gap-3">
                <div className="flex-1 min-w-[180px]">
                    <h3 className="text-lg font-medium">NF-es Recebidas</h3>
                    {syncStatusData ? (
                        <div className="mt-1">
                            <SyncStatusBadge
                                ultimaSync={syncStatusData.ultimaSync}
                                proximaSync={syncStatusData.proximaSync}
                                quantidadeImportada={syncStatusData.quantidadeImportada}
                                status={syncStatusData.status as any}
                                ultimoNsu={syncStatusData.ultimoNsu}
                                blockedUntil={syncStatusData.blockedUntil}
                            />
                        </div>
                    ) : (
                        <p className="text-sm text-muted-foreground">
                            {presetLabel(currentPeriod, currentFrom, currentTo)}
                        </p>
                    )}
                </div>

                <div className="flex flex-wrap items-center gap-2">
                    {/* ── Seletor de Período ──────────────────────────────────────── */}
                    <div className="relative" ref={periodMenuRef}>
                        <Button
                            variant="outline"
                            className="rounded-sm gap-2 font-medium"
                            disabled={isNavigating}
                            onClick={() => {
                                if (!showPeriodMenu && periodMenuRef.current) {
                                    const rect = periodMenuRef.current.getBoundingClientRect()
                                    setMenuPos({
                                        top: rect.bottom + window.scrollY + 4,
                                        right: window.innerWidth - rect.right,
                                    })
                                }
                                setShowPeriodMenu((v) => !v)
                            }}
                        >
                            {isNavigating ? <Loader2 className="h-4 w-4 text-primary animate-spin" /> : <Calendar className="h-4 w-4 text-primary" />}
                            {presetLabel(currentPeriod, currentFrom, currentTo)}
                            <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                        </Button>

                        {showPeriodMenu && typeof document !== "undefined" && createPortal(
                            <div
                                ref={portalMenuRef}
                                style={{ top: menuPos.top, right: menuPos.right, position: "fixed" }}
                                className="z-[9999] w-52 rounded-sm border bg-popover shadow-xl"
                            >
                                {PRESETS.map((p) => (
                                    <button
                                        key={p.key}
                                        onClick={() => selectPreset(p.key)}
                                        className={cn(
                                            "w-full px-4 py-2.5 text-left text-sm transition-colors hover:bg-accent",
                                            currentPeriod === p.key && "bg-accent font-semibold text-primary"
                                        )}
                                    >
                                        {p.label}
                                    </button>
                                ))}
                            </div>,
                            document.body
                        )}
                    </div>

                    {/* ── Filtros Avançados ────────────────────────────────────────── */}
                    <Button
                        variant="outline"
                        className={cn(
                            "rounded-sm gap-2",
                            showAdvanced && "border-primary text-primary"
                        )}
                        onClick={() => setShowAdvanced((v) => !v)}
                    >
                        <SlidersHorizontal className="h-4 w-4" />
                        Busca avançada
                        {activeFilterCount > 0 && (
                            <Badge className="ml-1 h-5 w-5 rounded-full p-0 flex items-center justify-center text-[10px]">
                                {activeFilterCount}
                            </Badge>
                        )}
                    </Button>

                    {/* ── Importar da SEFAZ ────────────────────────────────────────── */}
                    <Button
                        onClick={async () => {
                            try {
                                setSefazSyncing(true)
                                setSefazMsg(null)
                                const result = await syncNFesFromSEFAZ()

                                if (result.success) {
                                    setSefazMsg({ type: "success", text: result.message })
                                    await refreshSyncStatus()
                                    // Recarrega a página para refletir novos dados
                                    setIsNavigating(true)
                                    window.location.reload()
                                } else {
                                    setSefazMsg({ type: "error", text: result.error })
                                    await refreshSyncStatus()
                                    setSefazSyncing(false)
                                }
                            } catch (err: any) {
                                setSefazMsg({ type: "error", text: `Erro de execução: ${err.message}` })
                                setSefazSyncing(false)
                            } finally {
                                setTimeout(() => setSefazMsg(null), 8000)
                            }
                        }}
                        disabled={sefazSyncing || isNavigating}
                        className="rounded-sm gap-2 bg-primary"
                    >
                        {sefazSyncing
                            ? <Loader2 className="h-4 w-4 animate-spin" />
                            : <CloudDownload className="h-4 w-4" />
                        }
                        {sefazSyncing ? "Buscando na SEFAZ..." : "Importar da SEFAZ"}
                    </Button>
                </div>
            </div>

            {/* ── Feedback SEFAZ ─────────────────────────────────────────────────── */}
            {sefazMsg && (
                <div className={cn(
                    "mb-4 flex items-center gap-2 rounded-sm border px-4 py-2.5 text-sm",
                    sefazMsg.type === "success"
                        ? "border-green-200 bg-green-50 text-green-800"
                        : "border-destructive/30 bg-destructive/10 text-destructive"
                )}>
                    {sefazMsg.type === "success"
                        ? <CheckCircle2 className="h-4 w-4 shrink-0" />
                        : <AlertTriangle className="h-4 w-4 shrink-0" />
                    }
                    <span>{sefazMsg.text}</span>
                    <button
                        onClick={() => setSefazMsg(null)}
                        className="ml-auto text-muted-foreground hover:text-foreground"
                    >
                        <X className="h-4 w-4" />
                    </button>
                </div>
            )}

            {/* ── Período Customizado ─────────────────────────────────────────────── */}
            {currentPeriod === "custom" && (
                <div className="mb-4 flex flex-wrap items-end gap-3 rounded-sm border border-dashed bg-muted/30 p-3">
                    <div className="grid gap-1">
                        <Label className="text-xs">De</Label>
                        <input
                            type="date"
                            value={pendingFilters.customFrom}
                            onChange={(e) =>
                                setPendingFilters((f) => ({ ...f, customFrom: e.target.value }))
                            }
                            className="h-9 rounded-sm border border-input bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                        />
                    </div>
                    <div className="grid gap-1">
                        <Label className="text-xs">Até</Label>
                        <input
                            type="date"
                            value={pendingFilters.customTo}
                            onChange={(e) =>
                                setPendingFilters((f) => ({ ...f, customTo: e.target.value }))
                            }
                            className="h-9 rounded-sm border border-input bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                        />
                    </div>
                    <Button
                        size="sm"
                        className="rounded-sm gap-2 self-end"
                        onClick={applyCustomRange}
                        disabled={!pendingFilters.customFrom || !pendingFilters.customTo || isNavigating}
                    >
                        {isNavigating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Search className="h-3.5 w-3.5" />}
                        Aplicar
                    </Button>
                </div>
            )}

            {/* ── Filtros Avançados ───────────────────────────────────────────────── */}
            {showAdvanced && (
                <div className="mb-4 rounded-sm border bg-muted/20 p-4 space-y-4">
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        Filtros avançados
                    </p>
                    <div className="grid gap-4 sm:grid-cols-2">
                        <div className="grid gap-1.5">
                            <Label htmlFor="filter-emitente" className="text-xs">Emitente / Fornecedor</Label>
                            <Input
                                id="filter-emitente"
                                placeholder="Nome ou parte do nome..."
                                value={pendingFilters.emitente}
                                onChange={(e) =>
                                    setPendingFilters((f) => ({ ...f, emitente: e.target.value }))
                                }
                                className="rounded-sm"
                            />
                        </div>
                        <div className="grid gap-1.5">
                            <Label htmlFor="filter-status" className="text-xs">Situação</Label>
                            <Select
                                id="filter-status"
                                value={pendingFilters.status}
                                onChange={(e) =>
                                    setPendingFilters((f) => ({ ...f, status: e.target.value }))
                                }
                            >
                                <option value="todas">Todas as situações</option>
                                <option value={NFE_STATUS.NAO_INFORMADA}>Não Informada</option>
                                <option value={NFE_STATUS.CONFIRMADA}>Confirmada</option>
                                <option value={NFE_STATUS.RECUSADA}>Recusada</option>
                            </Select>
                        </div>
                        <div className="grid gap-1.5">
                            <Label htmlFor="filter-xml" className="text-xs">Conteúdo XML</Label>
                            <Select
                                id="filter-xml"
                                value={pendingFilters.xml}
                                onChange={(e) =>
                                    setPendingFilters((f) => ({ ...f, xml: e.target.value }))
                                }
                            >
                                <option value={NFE_XML_FILTER.TODAS}>Todos</option>
                                <option value={NFE_XML_FILTER.XML_DISPONIVEL}>XML disponível</option>
                                <option value={NFE_XML_FILTER.XML_PENDENTE}>XML pendente</option>
                            </Select>
                        </div>
                    </div>
                    <div className="flex justify-end gap-2">
                        <Button variant="ghost" size="sm" className="rounded-sm gap-1" onClick={clearAdvanced} disabled={isNavigating}>
                            <X className="h-3.5 w-3.5" />
                            Limpar filtros
                        </Button>
                        <Button size="sm" className="rounded-sm gap-2" onClick={applyAdvanced} disabled={isNavigating}>
                            {isNavigating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Search className="h-3.5 w-3.5" />}
                            Aplicar e Buscar
                        </Button>
                    </div>
                </div>
            )}

            {/* ── Resultado ──────────────────────────────────────────────────────── */}
            {isEmpty ? (
                <div className="flex flex-col items-center justify-center gap-3 rounded-sm border border-dashed border-muted-foreground/25 py-16 text-center">
                    <FileX className="h-8 w-8 text-muted-foreground/50" />
                    <div>
                        <p className="text-sm font-medium text-muted-foreground">Nenhuma nota encontrada</p>
                        <p className="mt-1 text-xs text-muted-foreground/70">
                            Não há NF-es para o período selecionado: <strong>{presetLabel(currentPeriod, currentFrom, currentTo)}</strong>
                        </p>
                    </div>
                    <Button variant="outline" size="sm" className="mt-2 rounded-sm gap-1" onClick={clearAdvanced}>
                        <X className="h-3.5 w-3.5" />
                        Limpar filtros
                    </Button>
                </div>
            ) : (
                <>
                    <div className="mb-3 flex items-center gap-2 text-xs text-green-600">
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        <span>
                            {data.length}{" "}
                            {data.length === 1 ? "nota encontrada" : "notas encontradas"} –{" "}
                            {presetLabel(currentPeriod, currentFrom, currentTo)}
                            {currentStatus && currentStatus !== "todas" && ` · Status: ${currentStatus}`}
                            {currentXml && currentXml !== "todas" && ` · XML: ${currentXml.replace('_', ' ')}`}
                            {currentEmitente && ` · Emitente: ${currentEmitente}`}
                        </span>
                    </div>
                    <DataTable columns={columns} data={data} />
                </>
            )}
        </div>
    )
}
