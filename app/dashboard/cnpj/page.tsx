"use client"

import * as React from "react"
import { Building2, Pencil, Save, X, Loader2, Shield, CheckCircle2, AlertTriangle, RefreshCw } from "lucide-react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { saveEmpresa, getEmpresaAtiva, type EmpresaData } from "@/actions/empresa"

// ── Schema (mirror do backend para validação client-side) ────────────────────

const cnpjSchema = z.object({
    cnpj: z.string().min(14, "CNPJ deve ter 14 dígitos").max(18),
    razaoSocial: z.string().min(3, "Razão social obrigatória"),
    nomeFantasia: z.string().optional().nullable(),
    inscricaoEstadual: z.string().optional().nullable(),
    regimeTributario: z.string().optional(),
})

type CnpjForm = {
    cnpj: string
    razaoSocial: string
    nomeFantasia?: string | null
    inscricaoEstadual?: string | null
    regimeTributario?: string
}

const regimeLabels: Record<string, string> = {
    simples: "Simples Nacional",
    lucro_presumido: "Lucro Presumido",
    lucro_real: "Lucro Real",
}

function formatCnpj(value: string) {
    const digits = value.replace(/\D/g, "").slice(0, 14)
    return digits
        .replace(/(\d{2})(\d)/, "$1.$2")
        .replace(/(\d{3})(\d)/, "$1.$2")
        .replace(/(\d{3})(\d)/, "$1/$2")
        .replace(/(\d{4})(\d)/, "$1-$2")
}

// ── Certificado status banner ─────────────────────────────────────────────────

function CertificadoBanner({ empresa }: { empresa: EmpresaData }) {
    if (!empresa.certificadoId) {
        return (
            <div className="flex items-center gap-3 rounded-sm border border-yellow-200 bg-yellow-50 p-3">
                <AlertTriangle className="h-4 w-4 text-yellow-600 shrink-0" />
                <p className="text-xs text-yellow-800">
                    Nenhum certificado digital vinculado. Envie o certificado .pfx em{" "}
                    <a href="/dashboard/certificado" className="font-medium underline">
                        Certificado Digital
                    </a>{" "}
                    — os dados da empresa serão preenchidos automaticamente.
                </p>
            </div>
        )
    }

    const validade = empresa.certificadoValidade
        ? new Date(empresa.certificadoValidade)
        : null
    const diasRestantes = validade
        ? Math.floor((validade.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
        : null

    const ok = diasRestantes !== null && diasRestantes > 30

    return (
        <div className={cn(
            "flex items-center gap-3 rounded-sm border p-3",
            ok ? "border-green-200 bg-green-50" : "border-yellow-200 bg-yellow-50"
        )}>
            {ok
                ? <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />
                : <AlertTriangle className="h-4 w-4 text-yellow-600 shrink-0" />
            }
            <p className={cn("text-xs", ok ? "text-green-800" : "text-yellow-800")}>
                {ok
                    ? `Certificado digital ativo — vence em ${validade?.toLocaleDateString("pt-BR")} (${diasRestantes} dias).`
                    : `Certificado próximo do vencimento — vence em ${validade?.toLocaleDateString("pt-BR")} (${diasRestantes} dias).`
                }
            </p>
        </div>
    )
}

// ── Página principal ──────────────────────────────────────────────────────────

export default function EmpresaPage() {
    const [empresa, setEmpresa] = React.useState<EmpresaData | null>(null)
    const [loadingState, setLoadingState] = React.useState<"loading" | "loaded" | "empty">("loading")
    const [isEditing, setIsEditing] = React.useState(false)
    const [isSaving, setIsSaving] = React.useState(false)
    const [saveError, setSaveError] = React.useState<string | null>(null)

    const {
        register,
        handleSubmit,
        reset,
        setValue,
        formState: { errors },
    } = useForm<CnpjForm>({
        resolver: zodResolver(cnpjSchema),
        defaultValues: {
            regimeTributario: "simples",
        },
    })

    // ── Carregar dados ao montar ──────────────────────────────────────────────

    async function loadEmpresa() {
        setLoadingState("loading")
        const data = await getEmpresaAtiva()
        if (data) {
            setEmpresa(data)
            reset({
                cnpj: formatCnpj(data.cnpj),
                razaoSocial: data.razaoSocial,
                nomeFantasia: data.nomeFantasia ?? "",
                inscricaoEstadual: data.inscricaoEstadual ?? "",
                regimeTributario: data.regimeTributario,
            })
            setLoadingState("loaded")
        } else {
            setLoadingState("empty")
            setIsEditing(true) // Se não existe empresa, já abre em modo edição
        }
    }

    React.useEffect(() => { loadEmpresa() }, [])

    // ── Handlers ──────────────────────────────────────────────────────────────

    function handleCancel() {
        if (empresa) {
            reset({
                cnpj: formatCnpj(empresa.cnpj),
                razaoSocial: empresa.razaoSocial,
                nomeFantasia: empresa.nomeFantasia ?? "",
                inscricaoEstadual: empresa.inscricaoEstadual ?? "",
                regimeTributario: empresa.regimeTributario,
            })
        }
        setSaveError(null)
        setIsEditing(false)
    }

    async function onSubmit(values: CnpjForm) {
        setIsSaving(true)
        setSaveError(null)

        const formData = new FormData()
        formData.append("cnpj", values.cnpj.replace(/\D/g, ""))
        formData.append("razaoSocial", values.razaoSocial)
        formData.append("nomeFantasia", values.nomeFantasia ?? "")
        formData.append("inscricaoEstadual", values.inscricaoEstadual ?? "")
        formData.append("regimeTributario", values.regimeTributario ?? "simples")


        const result = await saveEmpresa(formData)

        if (result.success) {
            setEmpresa(result.empresa)
            setIsEditing(false)
        } else {
            setSaveError(result.error)
        }
        setIsSaving(false)
    }

    // ── Render: carregando ────────────────────────────────────────────────────

    if (loadingState === "loading") {
        return (
            <div className="flex items-center gap-3 text-muted-foreground py-12 justify-center">
                <Loader2 className="h-5 w-5 animate-spin" />
                <span className="text-sm">Carregando dados da empresa...</span>
            </div>
        )
    }

    return (
        <div className="space-y-6">
            <div className="flex items-start justify-between">
                <div>
                    <h2 className="text-2xl font-bold tracking-tight">Empresa &amp; CNPJ</h2>
                    <p className="text-sm text-muted-foreground">
                        Configuração da empresa para monitoramento de NF-es junto à SEFAZ.
                    </p>
                </div>
                {loadingState === "loaded" && !isEditing && (
                    <Button
                        variant="outline"
                        size="sm"
                        className="rounded-sm gap-2"
                        onClick={loadEmpresa}
                    >
                        <RefreshCw className="h-3.5 w-3.5" />
                        Atualizar
                    </Button>
                )}
            </div>

            {/* Banner do certificado */}
            {empresa && <CertificadoBanner empresa={empresa} />}

            {/* Estado vazio */}
            {loadingState === "empty" && (
                <div className="flex items-start gap-3 rounded-sm border border-blue-200 bg-blue-50 p-4">
                    <Shield className="h-5 w-5 text-blue-600 shrink-0 mt-0.5" />
                    <div>
                        <p className="text-sm font-medium text-blue-900">Nenhuma empresa cadastrada</p>
                        <p className="text-xs text-blue-700 mt-1">
                            Preencha os dados abaixo ou{" "}
                            <a href="/dashboard/certificado" className="underline font-medium">
                                envie um certificado digital
                            </a>{" "}
                            — os dados serão preenchidos automaticamente.
                        </p>
                    </div>
                </div>
            )}

            {/* Card principal */}
            <Card className={cn(
                "rounded-sm border-l-4",
                loadingState === "loaded" ? "border-l-primary" : "border-l-muted-foreground/30"
            )}>
                <CardHeader className="flex flex-row items-center justify-between pb-3">
                    <div className="flex items-center gap-3">
                        <Building2 className="h-5 w-5 text-primary" />
                        <div>
                            <CardTitle className="text-base">
                                {loadingState === "loaded" ? empresa?.razaoSocial : "Cadastrar Empresa"}
                            </CardTitle>
                            <CardDescription>
                                {loadingState === "loaded"
                                    ? `CNPJ: ${formatCnpj(empresa?.cnpj ?? "")}`
                                    : "Dados da empresa para integração com a SEFAZ"
                                }
                            </CardDescription>
                        </div>
                    </div>
                    {loadingState === "loaded" && (
                        <Badge variant="success" className="uppercase text-xs">Ativo</Badge>
                    )}
                </CardHeader>

                <CardContent>
                    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                        <div className="grid gap-4 md:grid-cols-2">

                            {/* CNPJ */}
                            <div className="grid gap-2">
                                <Label htmlFor="cnpj">CNPJ <span className="text-destructive">*</span></Label>
                                <Input
                                    id="cnpj"
                                    disabled={!isEditing}
                                    className="rounded-sm font-mono"
                                    placeholder="00.000.000/0001-00"
                                    {...register("cnpj", {
                                        onChange: (e) => setValue("cnpj", formatCnpj(e.target.value))
                                    })}
                                />
                                {errors.cnpj && (
                                    <p className="text-xs text-destructive">{errors.cnpj.message}</p>
                                )}
                            </div>

                            {/* Nome Fantasia */}
                            <div className="grid gap-2">
                                <Label htmlFor="nomeFantasia">Nome Fantasia</Label>
                                <Input
                                    id="nomeFantasia"
                                    disabled={!isEditing}
                                    className="rounded-sm"
                                    placeholder="Como é conhecido no mercado"
                                    {...register("nomeFantasia")}
                                />
                            </div>

                            {/* Razão Social */}
                            <div className="grid gap-2 md:col-span-2">
                                <Label htmlFor="razaoSocial">Razão Social <span className="text-destructive">*</span></Label>
                                <Input
                                    id="razaoSocial"
                                    disabled={!isEditing}
                                    className="rounded-sm"
                                    placeholder="Nome completo conforme CNPJ"
                                    {...register("razaoSocial")}
                                />
                                {errors.razaoSocial && (
                                    <p className="text-xs text-destructive">{errors.razaoSocial.message}</p>
                                )}
                            </div>

                            {/* Inscrição Estadual */}
                            <div className="grid gap-2">
                                <Label htmlFor="inscricaoEstadual">Inscrição Estadual</Label>
                                <Input
                                    id="inscricaoEstadual"
                                    disabled={!isEditing}
                                    className="rounded-sm font-mono"
                                    placeholder="Opcional"
                                    {...register("inscricaoEstadual")}
                                />
                            </div>

                            {/* Regime */}
                            <div className="grid gap-2">
                                <Label htmlFor="regimeTributario">Regime Tributário</Label>
                                <select
                                    id="regimeTributario"
                                    disabled={!isEditing}
                                    className={cn(
                                        "flex h-9 w-full rounded-sm border border-input bg-background px-3 py-1 text-sm shadow-sm",
                                        "focus:outline-none focus:ring-1 focus:ring-ring",
                                        "disabled:cursor-not-allowed disabled:opacity-50"
                                    )}
                                    {...register("regimeTributario")}
                                >
                                    <option value="simples">Simples Nacional</option>
                                    <option value="lucro_presumido">Lucro Presumido</option>
                                    <option value="lucro_real">Lucro Real</option>
                                </select>
                            </div>
                        </div>

                        {/* Erro ao salvar */}
                        {saveError && (
                            <p className="text-sm text-destructive border border-destructive/30 bg-destructive/5 rounded-sm px-3 py-2">
                                {saveError}
                            </p>
                        )}

                        {/* Data de atualização */}
                        {empresa?.updatedAt && !isEditing && (
                            <p className="text-xs text-muted-foreground">
                                Última atualização: {new Date(empresa.updatedAt).toLocaleString("pt-BR")}
                            </p>
                        )}

                        {/* Ações */}
                        <div className="flex justify-end gap-2 pt-2">
                            {isEditing ? (
                                <>
                                    {loadingState === "loaded" && (
                                        <Button
                                            type="button"
                                            variant="outline"
                                            className="rounded-sm gap-2"
                                            onClick={handleCancel}
                                            disabled={isSaving}
                                        >
                                            <X className="h-4 w-4" />
                                            Cancelar
                                        </Button>
                                    )}
                                    <Button
                                        type="submit"
                                        disabled={isSaving}
                                        className="rounded-sm gap-2"
                                    >
                                        {isSaving
                                            ? <><Loader2 className="h-4 w-4 animate-spin" />Salvando...</>
                                            : <><Save className="h-4 w-4" />{loadingState === "empty" ? "Cadastrar Empresa" : "Salvar"}</>
                                        }
                                    </Button>
                                </>
                            ) : (
                                <Button
                                    type="button"
                                    variant="outline"
                                    className="rounded-sm gap-2"
                                    onClick={() => { setSaveError(null); setIsEditing(true) }}
                                >
                                    <Pencil className="h-4 w-4" />
                                    Editar
                                </Button>
                            )}
                        </div>
                    </form>
                </CardContent>
            </Card>
        </div>
    )
}
