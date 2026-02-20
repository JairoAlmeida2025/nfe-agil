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

// ─── Tipos ────────────────────────────────────────────────────────────────────

type FetchStatus = "idle" | "loading" | "success" | "error" | "empty"

interface Filters {
    periodPreset: PeriodPreset
    customFrom: string   // 'YYYY-MM-DD' — apenas para preset='custom'
    customTo: string     // 'YYYY-MM-DD' — apenas para preset='custom'
    emitente: string
    status: string
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

function presetLabel(preset: PeriodPreset): string {
    const now = new Date()
    const month = now.toLocaleString("pt-BR", { month: "long" })
    const year = now.getFullYear()
    const labels: Record<PeriodPreset, string> = {
        hoje: "Hoje",
        semana: "Esta semana",
        mes_passado: "Mês passado",
        mes_atual: `${month.charAt(0).toUpperCase() + month.slice(1)} de ${year}`,
        todos: "Todo o período",
        custom: "Período personalizado",
    }
    return labels[preset] || "Período"
}

// ─── Fetch via Server Action ───────────────────────────────────────────────────
// O cálculo de datas ocorre no backend (timezone America/Sao_Paulo).

async function fetchNFes(filters: Filters): Promise<NFe[]> {
    console.log("[NFeTable] 🔍 Fetch iniciando com filtros:", {
        periodo: filters.periodPreset,
        de: filters.customFrom || 'n/a',
        ate: filters.customTo || 'n/a'
    })
    const result = await listNFesFiltradas({
        periodo: filters.periodPreset,
        customFrom: filters.customFrom || undefined,
        customTo: filters.customTo || undefined,
        emitente: filters.emitente || undefined,
        status: filters.status || undefined,
    })

    console.log("[NFeTable] 📥 Resposta recebida:", {
        success: result.success,
        count: result.data?.length ?? 0,
        error: result.error
    })

    if (!result.success) {
        throw new Error(result.error ?? "Erro ao buscar notas fiscais")
    }

    return result.data as NFe[]
}

// ─── Padrão: Este Mês ─────────────────────────────────────────────────────────

const DEFAULT_FILTERS: Filters = {
    periodPreset: "mes_atual",
    customFrom: "",
    customTo: "",
    emitente: "",
    status: "",
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

    // ── Parsear filtros da URL ────────────────────────────────────────────────
    const getParam = (key: string) => searchParams.get(key) || ""

    const initialFilters: Filters = {
        periodPreset: (getParam("period") as PeriodPreset) || "mes_atual",
        customFrom: getParam("from"),
        customTo: getParam("to"),
        emitente: getParam("emitente"),
        status: getParam("status"),
    }

    const [filters, setFilters] = React.useState<Filters>(initialFilters)
    const [showAdvanced, setShowAdvanced] = React.useState(false)
    const [pendingFilters, setPendingFilters] = React.useState<Filters>(initialFilters)
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

    // ── Sincronizar com URL e Carregar Dados ──────────────────────────────────
    React.useEffect(() => {
        const currentFilters: Filters = {
            periodPreset: (getParam("period") as PeriodPreset) || "mes_atual",
            customFrom: getParam("from"),
            customTo: getParam("to"),
            emitente: getParam("emitente"),
            status: getParam("status"),
        }
        setFilters(currentFilters)
        setPendingFilters(currentFilters)
        handleSync(currentFilters)
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [searchParams])

    // ── Funções de fetch ──────────────────────────────────────────────────────

    async function refreshSyncStatus() {
        const s = await getSyncStatus().catch(() => null)
        setSyncStatusData(s)
    }

    async function handleSync(overrideFilters?: Filters) {
        const activeFilters = overrideFilters ?? filters
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
        if (newFilters.periodPreset !== "mes_atual") params.set("period", newFilters.periodPreset)
        if (newFilters.customFrom) params.set("from", newFilters.customFrom)
        if (newFilters.customTo) params.set("to", newFilters.customTo)
        if (newFilters.emitente) params.set("emitente", newFilters.emitente)
        if (newFilters.status) params.set("status", newFilters.status)

        const query = params.toString()
        router.push(`${pathname}${query ? "?" + query : ""}`)
    }

    // ── Seleção de preset (atualiza URL) ──────────────────────────────────────

    function selectPreset(preset: PeriodPreset) {
        const updated: Filters = {
            ...filters,
            periodPreset: preset,
            customFrom: "",
            customTo: "",
        }
        setShowPeriodMenu(false)
        if (preset !== "custom") {
            updateUrl(updated)
        } else {
            setFilters(updated)
            setPendingFilters(updated)
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
                            {presetLabel(filters.periodPreset)}
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
                        onClick={() => handleSync()}
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
                                    handleSync()
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
                                <option value="">Todas as situações</option>
                                <option value="recebida">Recebida</option>
                                <option value="xml_disponivel">XML disponível</option>
                                <option value="manifestada">Manifestada</option>
                                <option value="arquivada">Arquivada</option>
                                <option value="cancelada">Cancelada</option>
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
                    <p className="text-xs text-muted-foreground/70">Filtrando por {presetLabel(filters.periodPreset).toLowerCase()}.</p>
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
                        onClick={() => handleSync()}
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
                            Não há NF-es para o período selecionado: <strong>{presetLabel(filters.periodPreset)}</strong>
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
                            {data.length === 1 ? "nota encontrada" : "notas encontradas"} ·{" "}
                            {presetLabel(filters.periodPreset)} · ordenadas por data (mais recentes primeiro)
                        </span>
                    </div>
                    <DataTable columns={columns} data={data} />
                </>
            )}
        </div>
    )
}
