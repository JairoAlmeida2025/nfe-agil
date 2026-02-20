"use client"

import * as React from "react"
import { createPortal } from "react-dom"
import { useRouter, useSearchParams, usePathname } from "next/navigation"
import {
    RefreshCw,
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
import { syncNFesFromSEFAZ, getSyncStatus, listNFesFiltradas } from "@/actions/nfe"
import { SyncStatusBadge } from "@/components/sync-status-badge"
import type { PeriodPreset } from "@/lib/date-brt"
import { NFE_STATUS, NFE_XML_FILTER } from "@/lib/constants"

// ─── Tipos ────────────────────────────────────────────────────────────────────

type FetchStatus = "idle" | "loading" | "success" | "error" | "empty"

interface Filters {
    periodPreset: PeriodPreset
    customFrom: string
    customTo: string
    emitente: string
    status: string // situacao
    xml: string    // filtro de xml
}

// ─── Labels dos Presets ────────────────────────────────────────────────────────

const PRESETS: { key: PeriodPreset; label: string }[] = [
    { key: "hoje", label: "Hoje" },
    { key: "semana", label: "Esta semana" },
    { key: "mes_passado", label: "Mês passado" },
    { key: "mes_atual", label: "Este mês" },
    { key: "todos", label: "Todo o período" },
    { key: "custom", label: "Escolha o período…" },
]

function presetLabel(preset: PeriodPreset, from?: string, to?: string): string {
    const now = new Date()
    const labels: Record<PeriodPreset, string> = {
        hoje: "Hoje",
        semana: "Esta semana",
        mes_passado: "Mês passado",
        mes_atual: now.toLocaleString("pt-BR", { month: "long", year: "numeric" }).replace(/^\w/, (c) => c.toUpperCase()),
        todos: "Todo o período",
        custom: from && to
            ? `De ${new Date(from + 'T12:00:00').toLocaleDateString('pt-BR')} até ${new Date(to + 'T12:00:00').toLocaleDateString('pt-BR')}`
            : "Período personalizado",
    }
    return labels[preset] || "Período"
}

// ─── Fetch via Server Action ───────────────────────────────────────────────────
// O cálculo de datas ocorre no backend (timezone America/Sao_Paulo).

async function fetchNFes(filters: Filters): Promise<NFe[]> {
    console.log("[NFeTable] 🔍 Fetch iniciando com filtros:", {
        periodo: filters.periodPreset,
        de: filters.customFrom || 'n/a',
        ate: filters.customTo || 'n/a',
        emitente: filters.emitente || 'n/a',
        status: filters.status || 'n/a',
    })
    const result = await listNFesFiltradas({
        period: filters.periodPreset || undefined,
        from: filters.customFrom || undefined,
        to: filters.customTo || undefined,
        emitente: filters.emitente || undefined,
        status: filters.status || undefined,
        xml: filters.xml || undefined,
    })

    console.log("[NFeTable] 📥 Resposta recebida:", {
        success: result.success,
        count: result.data?.length ?? 0,
        error: result.error ?? 'n/a'
    })

    if (!result.success) {
        throw new Error(result.error ?? "Erro ao buscar notas fiscais")
    }

    return result.data as NFe[]
}

// ─── Padrão: Este Mês ─────────────────────────────────────────────────────────

const DEFAULT_FILTERS: Filters = {
    periodPreset: undefined as any,
    customFrom: "",
    customTo: "",
    emitente: "",
    status: "todas",
    xml: "todas",
}

// ─── Componente principal ─────────────────────────────────────────────────────

export function NFeTable({ initialData = [] }: { initialData?: NFe[] }) {
    const [data, setData] = React.useState<NFe[]>(initialData)
    const [status, setStatus] = React.useState<FetchStatus>(
        initialData.length > 0 ? "success" : "loading"
    )
    const [errorMessage, setErrorMessage] = React.useState("")
    const [lastSync, setLastSync] = React.useState<Date | null>(null)
    const [sefazSyncing, setSefazSyncing] = React.useState(false)
    const [sefazMsg, setSefazMsg] = React.useState<{ type: "success" | "error"; text: string } | null>(null)
    const [syncStatusData, setSyncStatusData] = React.useState<Awaited<ReturnType<typeof getSyncStatus>>>(null)

    const router = useRouter()
    const searchParams = useSearchParams()
    const pathname = usePathname()

    // ── Fonte de Verdade: Filtros extraídos da URL ────────────────────────────
    const currentPeriod = (searchParams.get("period") as PeriodPreset) || undefined
    const currentFrom = searchParams.get("from") || ""
    const currentTo = searchParams.get("to") || ""
    const currentEmitente = searchParams.get("emitente") || ""
    const currentStatus = searchParams.get("status") || "todas"
    const currentXml = searchParams.get("xml") || "todas"

    const filters: Filters = {
        periodPreset: currentPeriod,
        customFrom: currentFrom,
        customTo: currentTo,
        emitente: currentEmitente,
        status: currentStatus,
        xml: currentXml,
    }

    const [showAdvanced, setShowAdvanced] = React.useState(false)
    // pendingFilters é usado apenas enquanto o usuário digita no drawer/inputs
    const [pendingFilters, setPendingFilters] = React.useState<Filters>(filters)
    const [showPeriodMenu, setShowPeriodMenu] = React.useState(false)
    const [menuPos, setMenuPos] = React.useState({ top: 0, right: 0 })
    const periodMenuRef = React.useRef<HTMLDivElement>(null)

    // ── Fechar menu de período ao clicar fora ─────────────────────────────────
    React.useEffect(() => {
        function handler(e: MouseEvent) {
            if (periodMenuRef.current && !periodMenuRef.current.contains(e.target as Node)) {
                setShowPeriodMenu(false)
            }
        }
        document.addEventListener("mousedown", handler)
        return () => document.removeEventListener("mousedown", handler)
    }, [])

    // ── Carregar status de sync ───────────────────────────────────────────────
    React.useEffect(() => {
        getSyncStatus().then(setSyncStatusData).catch(() => { })
    }, [])

    // ── Re-fetch sempre que a URL (searchParams) mudar ─────────────────────────
    React.useEffect(() => {
        console.log("[NFeTable] 🌐 URL Params mudaram, disparando re-fetch:", filters)
        // Sincroniza o estado de inputs pendentes com a nova URL
        setPendingFilters(filters)
        handleSync(filters)
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [searchParams])

    // ── Funções de fetch ──────────────────────────────────────────────────────

    async function refreshSyncStatus() {
        const s = await getSyncStatus().catch(() => null)
        setSyncStatusData(s)
    }

    async function handleSync(activeFilters: Filters) {
        setStatus("loading")
        setErrorMessage("")
        try {
            const result = await fetchNFes(activeFilters)
            if (result.length === 0) {
                setData([])
                setStatus("empty")
            } else {
                setData(result)
                setStatus("success")
                setLastSync(new Date())
            }
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : "Erro inesperado"
            setErrorMessage(msg)
            setStatus("error")
        }
    }

    function updateUrl(newFilters: Filters) {
        const params = new URLSearchParams()
        params.set("period", newFilters.periodPreset || "todos")
        if (newFilters.customFrom) params.set("from", newFilters.customFrom)
        if (newFilters.customTo) params.set("to", newFilters.customTo)
        if (newFilters.emitente) params.set("emitente", newFilters.emitente)
        if (newFilters.status && newFilters.status !== 'todas') params.set("status", newFilters.status)
        if (newFilters.xml && newFilters.xml !== 'todas') params.set("xml", newFilters.xml)

        const query = params.toString()
        router.push(`${pathname}?${query}`)
    }

    // ── Seleção de preset ─────────────────────────────────────────────────────

    function selectPreset(preset: PeriodPreset) {
        setShowPeriodMenu(false)
        if (preset !== "custom") {
            const updated: Filters = { ...filters, periodPreset: preset, customFrom: "", customTo: "" }
            updateUrl(updated)
        } else {
            // Se for custom, apenas abre o seletor de datas e altera o estado pendente
            setPendingFilters(f => ({ ...f, periodPreset: 'custom' }))
            // Mas não atualiza a URL ainda (espera o botão 'Aplicar')
            // No entanto, para o UI dropdown mudar o texto, precisamos que a UI saiba
            // que estamos em modo seleção custom.
            updateUrl({ ...filters, periodPreset: 'custom' })
        }
    }

    function applyAdvanced() {
        setShowAdvanced(false)
        updateUrl(pendingFilters)
    }

    function clearAdvanced() {
        setShowAdvanced(false)
        updateUrl(DEFAULT_FILTERS)
    }

    // ── Aplicar período customizado ───────────────────────────────────────────

    function applyCustomRange() {
        updateUrl({
            ...filters,
            customFrom: pendingFilters.customFrom,
            customTo: pendingFilters.customTo
        })
    }

    const activeFilterCount = [
        filters.emitente,
        filters.status,
        filters.periodPreset === "custom" && filters.customFrom ? "custom" : "",
    ].filter(Boolean).length

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
                            {lastSync
                                ? `Atualizado às ${lastSync.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`
                                : "Carregando NF-es do mês vigente..."}
                        </p>
                    )}
                </div>

                <div className="flex flex-wrap items-center gap-2">
                    {/* ── Seletor de Período ──────────────────────────────────────── */}
                    <div className="relative" ref={periodMenuRef}>
                        <Button
                            variant="outline"
                            className="rounded-sm gap-2 font-medium"
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
                            <Calendar className="h-4 w-4 text-primary" />
                            {presetLabel(filters.periodPreset, filters.customFrom, filters.customTo)}
                            <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                        </Button>

                        {showPeriodMenu && typeof document !== "undefined" && createPortal(
                            <div
                                style={{ top: menuPos.top, right: menuPos.right, position: "fixed" }}
                                className="z-[9999] w-52 rounded-sm border bg-popover shadow-xl"
                            >
                                {PRESETS.map((p) => (
                                    <button
                                        key={p.key}
                                        onClick={() => selectPreset(p.key)}
                                        className={cn(
                                            "w-full px-4 py-2.5 text-left text-sm transition-colors hover:bg-accent",
                                            filters.periodPreset === p.key && "bg-accent font-semibold text-primary"
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

                    {/* ── Atualizar Lista ──────────────────────────────────────────── */}
                    <Button
                        onClick={() => handleSync(filters)}
                        disabled={status === "loading" || sefazSyncing}
                        variant="outline"
                        className="rounded-sm gap-2"
                    >
                        <RefreshCw className={cn("h-4 w-4", status === "loading" && "animate-spin")} />
                        {status === "loading" ? "Atualizando..." : "Atualizar lista"}
                    </Button>

                    {/* ── Importar da SEFAZ ────────────────────────────────────────── */}
                    <Button
                        onClick={async () => {
                            console.log("[Client] Botão 'Importar da SEFAZ' clicado")
                            try {
                                setSefazSyncing(true)
                                setSefazMsg(null)
                                const result = await syncNFesFromSEFAZ()
                                console.log("[Client] Retorno Server Action:", result)

                                if (result.success) {
                                    setSefazMsg({ type: "success", text: result.message })
                                    handleSync(filters)
                                    await refreshSyncStatus()
                                } else {
                                    setSefazMsg({ type: "error", text: result.error })
                                    await refreshSyncStatus()
                                }
                            } catch (err: any) {
                                console.error("[Client] Erro fatal chamando action:", err)
                                setSefazMsg({ type: "error", text: `Erro de execução: ${err.message}` })
                            } finally {
                                setSefazSyncing(false)
                                setTimeout(() => setSefazMsg(null), 8000)
                            }
                        }}
                        disabled={sefazSyncing || status === "loading"}
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
            {filters.periodPreset === "custom" && (
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
                        disabled={!pendingFilters.customFrom || !pendingFilters.customTo}
                    >
                        <Search className="h-3.5 w-3.5" />
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
                        <Button variant="ghost" size="sm" className="rounded-sm gap-1" onClick={clearAdvanced}>
                            <X className="h-3.5 w-3.5" />
                            Limpar filtros
                        </Button>
                        <Button size="sm" className="rounded-sm gap-2" onClick={applyAdvanced}>
                            <Search className="h-3.5 w-3.5" />
                            Aplicar e Buscar
                        </Button>
                    </div>
                </div>
            )}

            {/* ── Estados de Feedback ─────────────────────────────────────────────── */}
            {status === "loading" && (
                <div className="flex flex-col items-center justify-center gap-3 rounded-sm border border-dashed border-muted-foreground/25 py-16 text-center">
                    <RefreshCw className="h-8 w-8 animate-spin text-primary/50" />
                    <p className="text-sm font-medium text-muted-foreground">Consultando notas fiscais...</p>
                    <p className="text-xs text-muted-foreground/70">Filtrando por {presetLabel(filters.periodPreset, filters.customFrom, filters.customTo).toLowerCase()}.</p>
                </div>
            )}

            {status === "error" && (
                <div className="flex flex-col items-center justify-center gap-3 rounded-sm border border-dashed border-destructive/40 bg-destructive/5 py-16 text-center">
                    <AlertTriangle className="h-8 w-8 text-destructive/70" />
                    <div>
                        <p className="text-sm font-medium text-destructive">Falha ao buscar as notas</p>
                        <p className="mt-1 text-xs text-muted-foreground">
                            {errorMessage || "Verifique sua conexão e tente novamente."}
                        </p>
                    </div>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleSync(filters)}
                        className="mt-2 rounded-sm gap-2 border-destructive/30 hover:bg-destructive/10"
                    >
                        <RefreshCw className="h-3.5 w-3.5" />
                        Tentar novamente
                    </Button>
                </div>
            )}

            {status === "empty" && (
                <div className="flex flex-col items-center justify-center gap-3 rounded-sm border border-dashed border-muted-foreground/25 py-16 text-center">
                    <FileX className="h-8 w-8 text-muted-foreground/50" />
                    <div>
                        <p className="text-sm font-medium text-muted-foreground">Nenhuma nota encontrada</p>
                        <p className="mt-1 text-xs text-muted-foreground/70">
                            Não há NF-es para o período selecionado: <strong>{presetLabel(filters.periodPreset, filters.customFrom, filters.customTo)}</strong>
                        </p>
                    </div>
                    <Button variant="outline" size="sm" className="mt-2 rounded-sm gap-1" onClick={clearAdvanced}>
                        <X className="h-3.5 w-3.5" />
                        Limpar filtros
                    </Button>
                </div>
            )}

            {status === "success" && data.length > 0 && (
                <>
                    <div className="mb-3 flex items-center gap-2 text-xs text-green-600">
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        <span>
                            {data.length}{" "}
                            {data.length === 1 ? "nota encontrada" : "notas encontradas"} –{" "}
                            {presetLabel(filters.periodPreset, filters.customFrom, filters.customTo)}
                            {filters.status && filters.status !== 'todas' && ` · Status: ${filters.status}`}
                            {filters.xml && filters.xml !== 'todas' && ` · XML: ${filters.xml.replace('_', ' ')}`}
                            {filters.emitente && ` · Emitente: ${filters.emitente}`}
                        </span>
                    </div>
                    <DataTable columns={columns} data={data} />
                </>
            )}
        </div>
    )
}
