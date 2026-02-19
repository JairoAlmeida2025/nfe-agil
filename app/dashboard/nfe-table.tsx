"use client"

import * as React from "react"
import { createPortal } from "react-dom"
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
import { supabase } from "@/lib/supabase"
import { syncNFesFromSEFAZ } from "@/actions/nfe"

// ─── Tipos ────────────────────────────────────────────────────────────────────

type FetchStatus = "idle" | "loading" | "success" | "error" | "empty"

type PeriodPreset =
    | "today"
    | "this_week"
    | "last_month"
    | "this_month"
    | "all"
    | "custom"

interface Filters {
    periodPreset: PeriodPreset
    dateFrom: string
    dateTo: string
    emitente: string
    status: string
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function pad(n: number) {
    return String(n).padStart(2, "0")
}
function toInputDate(d: Date) {
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}
function toDisplayDate(iso: string) {
    if (!iso) return ""
    const [y, m, d] = iso.split("-")
    return `${d}/${m}/${y}`
}

function computeDateRange(preset: PeriodPreset): { from: string; to: string } {
    const now = new Date()
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())

    switch (preset) {
        case "today":
            return { from: toInputDate(today), to: toInputDate(today) }
        case "this_week": {
            const day = today.getDay()
            const monday = new Date(today)
            monday.setDate(today.getDate() - (day === 0 ? 6 : day - 1))
            const sunday = new Date(monday)
            sunday.setDate(monday.getDate() + 6)
            return { from: toInputDate(monday), to: toInputDate(sunday) }
        }
        case "last_month": {
            const first = new Date(now.getFullYear(), now.getMonth() - 1, 1)
            const last = new Date(now.getFullYear(), now.getMonth(), 0)
            return { from: toInputDate(first), to: toInputDate(last) }
        }
        case "this_month": {
            const first = new Date(now.getFullYear(), now.getMonth(), 1)
            const last = new Date(now.getFullYear(), now.getMonth() + 1, 0)
            return { from: toInputDate(first), to: toInputDate(last) }
        }
        case "all":
            return { from: "2020-01-01", to: toInputDate(today) }
        default:
            return { from: "", to: "" }
    }
}

function presetLabel(preset: PeriodPreset, dateFrom: string, dateTo: string) {
    if (preset === "custom" && dateFrom && dateTo)
        return `${toDisplayDate(dateFrom)} – ${toDisplayDate(dateTo)}`
    const now = new Date()
    const month = now.toLocaleString("pt-BR", { month: "long" })
    const year = now.getFullYear()
    const labels: Record<PeriodPreset, string> = {
        today: "Hoje",
        this_week: "Esta semana",
        last_month: "Mês passado",
        this_month: `${month.charAt(0).toUpperCase() + month.slice(1)} de ${year}`,
        all: "Todo o período",
        custom: "Período personalizado",
    }
    return labels[preset]
}

// ─── Simulação de fetch (substituir pela API real) ─────────────────────────────

// ─── Integração Supabase ───────────────────────────────────────────────────────

async function fetchNFes(filters: Filters): Promise<NFe[]> {
    // 1. Calcular range de datas
    const range =
        filters.periodPreset === "custom"
            ? { from: filters.dateFrom, to: filters.dateTo }
            : computeDateRange(filters.periodPreset)

    let query = supabase
        .from("nfes")
        .select("*")
        .order("data_emissao", { ascending: false })

    // 2. Aplicarfiltros de data (se existirem)
    if (range.from) {
        // Ajuste para início do dia
        query = query.gte("data_emissao", `${range.from}T00:00:00`)
    }
    if (range.to) {
        // Ajuste para fim do dia
        query = query.lte("data_emissao", `${range.to}T23:59:59`)
    }

    // 3. Filtros de texto e status
    if (filters.emitente) {
        query = query.ilike("emitente", `%${filters.emitente}%`)
    }
    if (filters.status) {
        query = query.eq("status", filters.status)
    }

    const { data, error } = await query

    if (error) {
        console.error("Erro Supabase:", error)
        throw new Error("Erro ao buscar notas fiscais: " + error.message)
    }

    if (!data) return []

    // 4. Mapear retorno para interface NFe
    return data.map((item: any) => ({
        id: item.id,
        numero: item.numero,
        chave: item.chave,
        emitente: item.emitente || item.razao_social_emitente || 'Desconhecido',
        valor: Number(item.valor || item.valor_total || 0),
        status: item.status,
        situacao: item.situacao || 'nao_informada',
        dataEmissao: item.data_emissao, // Manter string ISO para Date no componente
        xmlContent: item.xml_content || item.xml,
    }))
}

// ─── Componente principal ─────────────────────────────────────────────────────

const DEFAULT_FILTERS: Filters = {
    periodPreset: "this_month",
    dateFrom: "",
    dateTo: "",
    emitente: "",
    status: "",
}

export function NFeTable({ initialData = [] }: { initialData?: NFe[] }) {
    const [data, setData] = React.useState<NFe[]>(initialData)
    const [status, setStatus] = React.useState<FetchStatus>(
        initialData.length > 0 ? "success" : "idle"
    )
    const [errorMessage, setErrorMessage] = React.useState("")
    const [lastSync, setLastSync] = React.useState<Date | null>(null)
    const [sefazSyncing, setSefazSyncing] = React.useState(false)
    const [sefazMsg, setSefazMsg] = React.useState<{ type: "success" | "error"; text: string } | null>(null)

    const [filters, setFilters] = React.useState<Filters>(DEFAULT_FILTERS)
    const [showAdvanced, setShowAdvanced] = React.useState(false)
    const [pendingFilters, setPendingFilters] = React.useState<Filters>(DEFAULT_FILTERS)
    const [showPeriodMenu, setShowPeriodMenu] = React.useState(false)
    const [menuPos, setMenuPos] = React.useState({ top: 0, right: 0 })
    const periodMenuRef = React.useRef<HTMLDivElement>(null)

    // Fecha o menu de período ao clicar fora
    React.useEffect(() => {
        function handler(e: MouseEvent) {
            if (periodMenuRef.current && !periodMenuRef.current.contains(e.target as Node)) {
                setShowPeriodMenu(false)
            }
        }
        document.addEventListener("mousedown", handler)
        return () => document.removeEventListener("mousedown", handler)
    }, [])

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

    function selectPreset(preset: PeriodPreset) {
        const range = preset !== "custom" ? computeDateRange(preset) : { from: "", to: "" }
        const updated: Filters = {
            ...filters,
            periodPreset: preset,
            dateFrom: range.from,
            dateTo: range.to,
        }
        setFilters(updated)
        setPendingFilters(updated)
        setShowPeriodMenu(false)
        handleSync(updated)
    }

    function applyAdvanced() {
        setFilters(pendingFilters)
        setShowAdvanced(false)
        handleSync(pendingFilters)
    }

    function clearAdvanced() {
        const reset: Filters = { ...DEFAULT_FILTERS }
        setFilters(reset)
        setPendingFilters(reset)
        setShowAdvanced(false)
        handleSync(reset)
    }

    const activeFilterCount = [
        filters.emitente,
        filters.status,
        filters.periodPreset === "custom" ? "custom" : "",
    ].filter(Boolean).length

    const PRESETS: { key: PeriodPreset; label: string }[] = [
        { key: "today", label: "Hoje" },
        { key: "this_week", label: "Esta semana" },
        { key: "last_month", label: "Mês passado" },
        { key: "this_month", label: "Este mês" },
        { key: "all", label: "Todo o período" },
        { key: "custom", label: "Escolha o período…" },
    ]

    return (
        <div className="rounded-sm border-t-2 border-t-primary pt-4">
            {/* ── Cabeçalho ──────────────────────────────────────────────────────── */}
            <div className="mb-4 flex flex-wrap items-start gap-3">
                <div className="flex-1 min-w-[180px]">
                    <h3 className="text-lg font-medium">NF-es Recebidas</h3>
                    <p className="text-sm text-muted-foreground">
                        {lastSync
                            ? `Sincronizado às ${lastSync.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`
                            : "Selecione o período e clique em Buscar."}
                    </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                    {/* Seletor de período */}
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
                            {presetLabel(filters.periodPreset, filters.dateFrom, filters.dateTo)}
                            <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                        </Button>

                        {showPeriodMenu && typeof document !== "undefined" && createPortal(
                            <div
                                style={{ top: menuPos.top, right: menuPos.right }}
                                className="absolute z-[9999] w-52 rounded-sm border bg-popover shadow-xl"
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

                    {/* Busca avançada */}
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

                    {/* Buscar (atualiza lista local) */}
                    <Button
                        onClick={() => handleSync()}
                        disabled={status === "loading" || sefazSyncing}
                        variant="outline"
                        className="rounded-sm gap-2"
                    >
                        <RefreshCw
                            className={cn("h-4 w-4", status === "loading" && "animate-spin")}
                        />
                        {status === "loading" ? "Atualizando..." : "Atualizar lista"}
                    </Button>

                    {/* Importar da SEFAZ */}
                    <Button
                        onClick={async () => {
                            console.log("[Client] Botão 'Importar da SEFAZ' clicado")
                            try {
                                setSefazSyncing(true)
                                setSefazMsg(null)
                                console.log("[Client] Chamando Server Action syncNFesFromSEFAZ()...")
                                const result = await syncNFesFromSEFAZ()
                                console.log("[Client] Retorno Server Action:", result)

                                if (result.success) {
                                    setSefazMsg({ type: "success", text: result.message })
                                    handleSync()
                                } else {
                                    setSefazMsg({ type: "error", text: result.error })
                                }
                            } catch (err: any) {
                                console.error("[Client] Erro fatal chamando action:", err)
                                setSefazMsg({ type: "error", text: `Erro de execução: ${err.message}` })
                            } finally {
                                setSefazSyncing(false)
                                setTimeout(() => setSefazMsg(null), 6000)
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

            {/* Feedback SEFAZ */}
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

            {/* ── Escolha de período personalizado ───────────────────────────────── */}
            {filters.periodPreset === "custom" && (
                <div className="mb-4 flex flex-wrap items-end gap-3 rounded-sm border border-dashed bg-muted/30 p-3">
                    <div className="grid gap-1">
                        <Label className="text-xs">De</Label>
                        <input
                            type="date"
                            value={pendingFilters.dateFrom}
                            onChange={(e) =>
                                setPendingFilters((f) => ({ ...f, dateFrom: e.target.value }))
                            }
                            className="h-9 rounded-sm border border-input bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                        />
                    </div>
                    <div className="grid gap-1">
                        <Label className="text-xs">Até</Label>
                        <input
                            type="date"
                            value={pendingFilters.dateTo}
                            onChange={(e) =>
                                setPendingFilters((f) => ({ ...f, dateTo: e.target.value }))
                            }
                            className="h-9 rounded-sm border border-input bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                        />
                    </div>
                    <Button
                        size="sm"
                        className="rounded-sm gap-2 self-end"
                        onClick={() => {
                            const updated = { ...filters, dateFrom: pendingFilters.dateFrom, dateTo: pendingFilters.dateTo }
                            setFilters(updated)
                            handleSync(updated)
                        }}
                        disabled={!pendingFilters.dateFrom || !pendingFilters.dateTo}
                    >
                        <Search className="h-3.5 w-3.5" />
                        Aplicar
                    </Button>
                </div>
            )}

            {/* ── Filtros avançados ───────────────────────────────────────────────── */}
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

            {/* ── Estados de feedback ─────────────────────────────────────────────── */}
            {status === "loading" && (
                <div className="flex flex-col items-center justify-center gap-3 rounded-sm border border-dashed border-muted-foreground/25 py-16 text-center">
                    <RefreshCw className="h-8 w-8 animate-spin text-primary/50" />
                    <p className="text-sm font-medium text-muted-foreground">Consultando notas fiscais...</p>
                    <p className="text-xs text-muted-foreground/70">Aguarde enquanto conectamos à SEFAZ.</p>
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
                            Não há NF-es para o período e filtros selecionados.
                        </p>
                    </div>
                    <Button variant="outline" size="sm" className="mt-2 rounded-sm gap-1" onClick={clearAdvanced}>
                        <X className="h-3.5 w-3.5" />
                        Limpar filtros
                    </Button>
                </div>
            )}

            {status === "idle" && (
                <div className="flex flex-col items-center justify-center gap-3 rounded-sm border border-dashed border-muted-foreground/25 py-16 text-center">
                    <RefreshCw className="h-8 w-8 text-muted-foreground/30" />
                    <p className="text-sm text-muted-foreground">
                        Selecione o período e clique em{" "}
                        <span className="font-medium text-foreground">Buscar</span>.
                    </p>
                </div>
            )}

            {status === "success" && data.length > 0 && (
                <>
                    <div className="mb-3 flex items-center gap-2 text-xs text-green-600">
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        <span>
                            {data.length}{" "}
                            {data.length === 1 ? "nota encontrada" : "notas encontradas"} ·{" "}
                            ordenadas por data (mais recentes primeiro)
                        </span>
                    </div>
                    <DataTable columns={columns} data={data} />
                </>
            )}
        </div>
    )
}
