"use client"

import * as React from "react"
import {
    Upload, Shield, CheckCircle2, AlertTriangle, XCircle,
    Loader2, Info, Trash2, RefreshCw, KeyRound, Calendar,
    Building2, BadgeCheck
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
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
import { cn } from "@/lib/utils"
import {
    uploadCertificate,
    getActiveCertificate,
    revokeCertificate,
    type CertificateRecord,
    type CertificateInfo,
} from "@/actions/certificate"

// ── Sub-componente: Card do certificado ativo ─────────────────────────────────

function CertificateCard({
    cert,
    onRevoke,
    onReplace,
    isRevoking,
}: {
    cert: CertificateRecord
    onRevoke: () => void
    onReplace: () => void
    isRevoking: boolean
}) {
    const isValid = cert.diasRestantes > 30
    const isExpiring = cert.diasRestantes > 0 && cert.diasRestantes <= 30
    const isExpired = cert.diasRestantes <= 0

    const statusColor = isExpired
        ? "border-l-destructive"
        : isExpiring
            ? "border-l-yellow-500"
            : "border-l-green-600"

    const badgeVariant = isExpired ? "destructive" : isExpiring ? "warning" : "success"
    const badgeLabel = isExpired ? "Expirado" : isExpiring ? "Vencendo" : "Ativo"

    return (
        <Card className={cn("rounded-sm border-l-4", statusColor)}>
            <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <div className={cn(
                            "flex h-10 w-10 items-center justify-center rounded-sm",
                            isExpired ? "bg-destructive/10" : isExpiring ? "bg-yellow-50" : "bg-green-50"
                        )}>
                            <KeyRound className={cn(
                                "h-5 w-5",
                                isExpired ? "text-destructive" : isExpiring ? "text-yellow-600" : "text-green-600"
                            )} />
                        </div>
                        <div>
                            <CardTitle className="text-base">Certificado Digital A1</CardTitle>
                            <CardDescription>
                                Instalado em {new Date(cert.createdAt).toLocaleDateString("pt-BR")}
                            </CardDescription>
                        </div>
                    </div>
                    <Badge variant={badgeVariant as "destructive" | "success" | "outline"} className="uppercase text-xs shrink-0">
                        {badgeLabel}
                    </Badge>
                </div>
            </CardHeader>

            <CardContent className="space-y-4">
                {/* Dados do certificado */}
                <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
                    <div className="flex items-start gap-2">
                        <Building2 className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                        <div>
                            <p className="text-xs text-muted-foreground">CNPJ</p>
                            <p className="font-mono font-medium">
                                {cert.cnpj.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5")}
                            </p>
                        </div>
                    </div>
                    <div className="flex items-start gap-2">
                        <BadgeCheck className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                        <div>
                            <p className="text-xs text-muted-foreground">Razão Social</p>
                            <p className="font-medium truncate max-w-[200px]" title={cert.razaoSocial}>
                                {cert.razaoSocial}
                            </p>
                        </div>
                    </div>
                    <div className="flex items-start gap-2 col-span-2">
                        <Calendar className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                        <div className="flex items-center gap-3">
                            <div>
                                <p className="text-xs text-muted-foreground">Validade</p>
                                <p className="font-medium">{cert.validadeFormatada}</p>
                            </div>
                            <Separator orientation="vertical" className="h-8" />
                            <div>
                                <p className="text-xs text-muted-foreground">Dias restantes</p>
                                <p className={cn(
                                    "font-bold text-base",
                                    isExpired ? "text-destructive" : isExpiring ? "text-yellow-600" : "text-green-600"
                                )}>
                                    {isExpired ? "Expirado" : `${cert.diasRestantes} dias`}
                                </p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Alerta de vencimento */}
                {(isExpiring || isExpired) && (
                    <div className={cn(
                        "flex items-start gap-2 rounded-sm border p-3 text-xs",
                        isExpired
                            ? "border-destructive/30 bg-destructive/5 text-destructive"
                            : "border-yellow-200 bg-yellow-50 text-yellow-800"
                    )}>
                        <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                        <span>
                            {isExpired
                                ? "Este certificado está expirado. Substitua-o imediatamente para restaurar a comunicação com a SEFAZ."
                                : `Certificado expira em ${cert.diasRestantes} dias. Providencie a renovação para evitar interrupções.`
                            }
                        </span>
                    </div>
                )}

                {isValid && (
                    <div className="flex items-center gap-2 rounded-sm bg-green-50 border border-green-200 p-3">
                        <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />
                        <p className="text-xs text-green-800">
                            Certificado válido. A comunicação com a SEFAZ está habilitada.
                        </p>
                    </div>
                )}

                <Separator />

                {/* Ações */}
                <div className="flex items-center gap-2">
                    <AlertDialog>
                        <AlertDialogTrigger asChild>
                            <Button
                                variant="outline"
                                size="sm"
                                className="rounded-sm gap-2 flex-1"
                                disabled={isRevoking}
                            >
                                <RefreshCw className="h-3.5 w-3.5" />
                                Substituir Certificado
                            </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent className="rounded-sm">
                            <AlertDialogHeader>
                                <AlertDialogTitle>Substituir certificado atual?</AlertDialogTitle>
                                <AlertDialogDescription>
                                    Ao confirmar, a tela de upload será aberta para enviar um novo arquivo .pfx ou .p12.
                                    O certificado antigo continuará ativo até que a substituição seja concluída com sucesso.
                                </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                                <AlertDialogCancel className="rounded-sm">Cancelar</AlertDialogCancel>
                                <AlertDialogAction
                                    onClick={onReplace}
                                    className="rounded-sm bg-primary text-primary-foreground hover:bg-primary/90"
                                >
                                    Continuar
                                </AlertDialogAction>
                            </AlertDialogFooter>
                        </AlertDialogContent>
                    </AlertDialog>

                    <AlertDialog>
                        <AlertDialogTrigger asChild>
                            <Button
                                variant="outline"
                                size="sm"
                                className="rounded-sm gap-2 text-destructive border-destructive/20 hover:bg-destructive/5 hover:text-destructive"
                                disabled={isRevoking}
                            >
                                {isRevoking
                                    ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                    : <Trash2 className="h-3.5 w-3.5" />
                                }
                                Revogar
                            </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent className="rounded-sm">
                            <AlertDialogHeader>
                                <AlertDialogTitle>Revogar certificado?</AlertDialogTitle>
                                <AlertDialogDescription>
                                    O certificado será marcado como revogado e desvinculado da empresa.
                                    A comunicação com a SEFAZ será interrompida até que um novo certificado
                                    seja instalado. Esta ação não pode ser desfeita.
                                </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                                <AlertDialogCancel className="rounded-sm">Cancelar</AlertDialogCancel>
                                <AlertDialogAction
                                    onClick={onRevoke}
                                    className="rounded-sm bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                >
                                    Revogar Certificado
                                </AlertDialogAction>
                            </AlertDialogFooter>
                        </AlertDialogContent>
                    </AlertDialog>
                </div>
            </CardContent>
        </Card>
    )
}

// ── Sub-componente: Formulário de upload ──────────────────────────────────────

function UploadForm({
    isReplace,
    onSuccess,
    onCancel,
}: {
    isReplace: boolean
    onSuccess: (info: CertificateInfo) => void
    onCancel?: () => void
}) {
    const [isDragging, setIsDragging] = React.useState(false)
    const [file, setFile] = React.useState<File | null>(null)
    const [password, setPassword] = React.useState("")
    const [isUploading, setIsUploading] = React.useState(false)
    const [error, setError] = React.useState<string | null>(null)

    function handleDrop(e: React.DragEvent) {
        e.preventDefault()
        setIsDragging(false)
        const dropped = e.dataTransfer.files[0]
        if (dropped && (dropped.name.endsWith(".pfx") || dropped.name.endsWith(".p12"))) {
            setFile(dropped)
            setError(null)
        }
    }

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault()
        if (!file || !password) return

        setIsUploading(true)
        setError(null)

        const formData = new FormData()
        formData.append("certificate", file)
        formData.append("password", password)

        const result = await uploadCertificate(formData)

        if (result.success) {
            onSuccess(result.info)
        } else {
            setError(result.error)
        }
        setIsUploading(false)
    }

    return (
        <Card className="rounded-sm">
            <CardHeader>
                <CardTitle>{isReplace ? "Substituir Certificado" : "Instalar Certificado"}</CardTitle>
                <CardDescription>
                    Aceita arquivos .pfx ou .p12 (Certificado A1 ICP-Brasil).
                    O arquivo é validado e armazenado de forma criptografada.
                </CardDescription>
            </CardHeader>
            <CardContent>
                <form onSubmit={handleSubmit} className="space-y-4">
                    {/* Zona de drop */}
                    <div
                        onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
                        onDragLeave={() => setIsDragging(false)}
                        onDrop={handleDrop}
                        className={cn(
                            "relative flex flex-col items-center justify-center rounded-sm border-2 border-dashed p-10 transition-colors cursor-pointer",
                            isDragging
                                ? "border-primary bg-primary/5"
                                : file
                                    ? "border-primary/60 bg-primary/5"
                                    : "border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/30"
                        )}
                    >
                        <input
                            type="file"
                            accept=".pfx,.p12"
                            onChange={(e) => {
                                const sel = e.target.files?.[0]
                                if (sel) { setFile(sel); setError(null) }
                            }}
                            className="absolute inset-0 opacity-0 cursor-pointer"
                        />
                        <Upload className={cn("h-8 w-8 mb-3", file ? "text-primary" : "text-muted-foreground")} />
                        {file ? (
                            <div className="text-center">
                                <p className="font-medium text-primary text-sm">{file.name}</p>
                                <p className="text-xs text-muted-foreground mt-1">
                                    {(file.size / 1024).toFixed(1)} KB — Clique para trocar
                                </p>
                            </div>
                        ) : (
                            <div className="text-center">
                                <p className="text-sm font-medium">Arraste o arquivo aqui ou clique para selecionar</p>
                                <p className="text-xs text-muted-foreground mt-1">Formatos: .pfx, .p12</p>
                            </div>
                        )}
                    </div>

                    {/* Senha */}
                    <div className="grid gap-2">
                        <Label htmlFor="cert-password">Senha do Certificado</Label>
                        <Input
                            id="cert-password"
                            type="password"
                            placeholder="••••••••"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="rounded-sm"
                            autoComplete="new-password"
                        />
                    </div>

                    {/* Erro */}
                    {error && (
                        <div className="flex items-start gap-2 rounded-sm border border-destructive/30 bg-destructive/5 p-3">
                            <XCircle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
                            <p className="text-sm text-destructive">{error}</p>
                        </div>
                    )}

                    {/* Info */}
                    <div className="flex items-start gap-2 text-xs text-muted-foreground">
                        <Info className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                        <span>A senha é criptografada com AES-256 antes de ser armazenada.</span>
                    </div>

                    {/* Botões */}
                    <div className="flex gap-2">
                        {onCancel && (
                            <Button
                                type="button"
                                variant="outline"
                                className="rounded-sm flex-1"
                                onClick={onCancel}
                                disabled={isUploading}
                            >
                                Cancelar
                            </Button>
                        )}
                        <Button
                            type="submit"
                            disabled={!file || !password || isUploading}
                            className="rounded-sm flex-1"
                        >
                            {isUploading ? (
                                <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Validando e instalando...</>
                            ) : (
                                isReplace ? "Substituir e Validar" : "Instalar Certificado"
                            )}
                        </Button>
                    </div>
                </form>
            </CardContent>
        </Card>
    )
}

// ── Página principal ──────────────────────────────────────────────────────────

export default function CertificadoPage() {
    const [cert, setCert] = React.useState<CertificateRecord | null>(null)
    const [loadState, setLoadState] = React.useState<"loading" | "loaded" | "empty">("loading")
    const [showUploadForm, setShowUploadForm] = React.useState(false)
    const [isRevoking, setIsRevoking] = React.useState(false)

    async function loadCert() {
        setLoadState("loading")
        const data = await getActiveCertificate()
        if (data) {
            setCert(data)
            setLoadState("loaded")
            setShowUploadForm(false)
        } else {
            setCert(null)
            setLoadState("empty")
            setShowUploadForm(true)
        }
    }

    React.useEffect(() => { loadCert() }, [])

    async function handleRevoke() {
        if (!cert) return
        setIsRevoking(true)
        const result = await revokeCertificate(cert.id)
        if (result.success) {
            setCert(null)
            setLoadState("empty")
            setShowUploadForm(true)
        }
        setIsRevoking(false)
    }

    function handleUploadSuccess() {
        loadCert()
    }

    return (
        <div className="space-y-6">
            <div className="flex items-start justify-between">
                <div>
                    <h2 className="text-2xl font-bold tracking-tight">Certificado Digital A1</h2>
                    <p className="text-sm text-muted-foreground">
                        Gerencie o certificado utilizado para autenticação na SEFAZ.
                    </p>
                </div>
                {loadState === "loaded" && !showUploadForm && (
                    <Button
                        variant="outline"
                        size="sm"
                        className="rounded-sm gap-2"
                        onClick={loadCert}
                    >
                        <RefreshCw className="h-3.5 w-3.5" />
                        Atualizar
                    </Button>
                )}
            </div>

            {/* Carregando */}
            {loadState === "loading" && (
                <div className="flex items-center gap-3 text-muted-foreground py-12 justify-center">
                    <Loader2 className="h-5 w-5 animate-spin" />
                    <span className="text-sm">Verificando certificado instalado...</span>
                </div>
            )}

            {/* Certificado ativo */}
            {loadState === "loaded" && cert && !showUploadForm && (
                <CertificateCard
                    cert={cert}
                    onRevoke={handleRevoke}
                    onReplace={() => setShowUploadForm(true)}
                    isRevoking={isRevoking}
                />
            )}

            {/* Formulário de upload (install ou replace) */}
            {(loadState === "empty" || showUploadForm) && (
                <UploadForm
                    isReplace={loadState === "loaded"}
                    onSuccess={handleUploadSuccess}
                    onCancel={loadState === "loaded" ? () => setShowUploadForm(false) : undefined}
                />
            )}

            {/* Nota de segurança */}
            <Card className="rounded-sm bg-muted/30 border-muted">
                <CardContent className="pt-4">
                    <div className="flex items-start gap-3">
                        <Shield className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                        <div className="space-y-1">
                            <p className="text-sm font-medium">Armazenamento seguro</p>
                            <p className="text-xs text-muted-foreground leading-relaxed">
                                O arquivo .pfx é armazenado em bucket privado no Supabase. A senha é cifrada
                                com AES-256-GCM antes de ser persistida — nunca em texto plano. A comunicação
                                com a SEFAZ usa mTLS com o certificado carregado diretamente pelo servidor.
                            </p>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}
