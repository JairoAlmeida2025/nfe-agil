"use client"

import * as React from "react"
import {
    UserPlus, Trash2, ShieldCheck, User, Loader2, CheckCircle2,
    AlertTriangle, Crown, Eye, EyeOff, ChevronDown, X
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
    createTeamMember,
    listTeamMembers,
    updateMemberRole,
    removeTeamMember,
    type TeamMember,
} from "@/actions/usuarios"
import type { UserRole } from "@/lib/permissions"

// ─── Permissões visuais por role ──────────────────────────────────────────────

const ROLE_PERMISSIONS: Record<UserRole, { label: string; items: string[] }> = {
    admin: {
        label: "Administrador",
        items: [
            "Visualizar, baixar e consultar NF-es",
            "Importar NF-es da SEFAZ",
            "Fazer upload e revogar certificado digital",
            "Editar dados da empresa",
            "Gerenciar membros da equipe",
        ],
    },
    user: {
        label: "Usuário",
        items: [
            "Visualizar, baixar e consultar NF-es",
            "Importar NF-es da SEFAZ",
        ],
    },
}

const ROLE_BADGE: Record<UserRole, { label: string; className: string }> = {
    admin: {
        label: "Admin",
        className: "bg-blue-50 text-blue-700 border-blue-200",
    },
    user: {
        label: "Usuário",
        className: "bg-gray-50 text-gray-700 border-gray-200",
    },
}

// ─── Componente de badge de role ──────────────────────────────────────────────

function RoleBadge({ role }: { role: UserRole }) {
    const { label, className } = ROLE_BADGE[role]
    return (
        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium border ${className}`}>
            {role === "admin" ? <ShieldCheck className="h-3 w-3" /> : <User className="h-3 w-3" />}
            {label}
        </span>
    )
}

// ─── Componente principal ─────────────────────────────────────────────────────

interface TeamManagerProps {
    currentUserId: string
}

export function TeamManager({ currentUserId }: TeamManagerProps) {
    const [members, setMembers] = React.useState<TeamMember[]>([])
    const [loadingMembers, setLoadingMembers] = React.useState(true)
    const [showForm, setShowForm] = React.useState(false)
    const [submitting, setSubmitting] = React.useState(false)
    const [feedback, setFeedback] = React.useState<{ type: "success" | "error"; message: string } | null>(null)
    const [removingId, setRemovingId] = React.useState<string | null>(null)
    const [changingRoleId, setChangingRoleId] = React.useState<string | null>(null)
    const [showPassword, setShowPassword] = React.useState(false)

    // Form state
    const [nome, setNome] = React.useState("")
    const [email, setEmail] = React.useState("")
    const [senha, setSenha] = React.useState("")
    const [role, setRole] = React.useState<UserRole>("user")
    const [showPermissions, setShowPermissions] = React.useState(false)

    React.useEffect(() => {
        loadMembers()
    }, [])

    async function loadMembers() {
        setLoadingMembers(true)
        const data = await listTeamMembers()
        setMembers(data)
        setLoadingMembers(false)
    }

    function showFeedback(type: "success" | "error", message: string) {
        setFeedback({ type, message })
        setTimeout(() => setFeedback(null), 5000)
    }

    async function handleCreate(e: React.FormEvent) {
        e.preventDefault()
        setSubmitting(true)
        const result = await createTeamMember({ nome, email, senha, role })
        if (result.success) {
            showFeedback("success", result.message ?? "Usuário criado!")
            setShowForm(false)
            setNome(""); setEmail(""); setSenha(""); setRole("user")
            await loadMembers()
        } else {
            showFeedback("error", result.error)
        }
        setSubmitting(false)
    }

    async function handleChangeRole(memberId: string, newRole: UserRole) {
        setChangingRoleId(memberId)
        const result = await updateMemberRole({ memberId, newRole })
        if (result.success) {
            showFeedback("success", "Permissão atualizada!")
            await loadMembers()
        } else {
            showFeedback("error", result.error)
        }
        setChangingRoleId(null)
    }

    async function handleRemove(memberId: string, memberNome: string) {
        if (!confirm(`Tem certeza que deseja remover "${memberNome}"? Esta ação não pode ser desfeita.`)) return
        setRemovingId(memberId)
        const result = await removeTeamMember(memberId)
        if (result.success) {
            showFeedback("success", result.message ?? "Usuário removido.")
            await loadMembers()
        } else {
            showFeedback("error", result.error)
        }
        setRemovingId(null)
    }

    function formatDate(iso: string | null) {
        if (!iso) return "Nunca acessou"
        return new Date(iso).toLocaleDateString("pt-BR", {
            day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit"
        })
    }

    return (
        <div className="space-y-4">
            {/* Feedback global */}
            {feedback && (
                <div className={`flex items-center gap-2 text-sm rounded-sm px-3 py-2 border ${feedback.type === "success"
                    ? "text-green-700 bg-green-50 border-green-200"
                    : "text-red-700 bg-red-50 border-red-200"
                    }`}>
                    {feedback.type === "success"
                        ? <CheckCircle2 className="h-4 w-4 shrink-0" />
                        : <AlertTriangle className="h-4 w-4 shrink-0" />}
                    {feedback.message}
                </div>
            )}

            {/* Cabeçalho */}
            <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                    {members.length} {members.length === 1 ? "membro" : "membros"} cadastrado{members.length !== 1 ? "s" : ""}
                </p>
                <Button
                    size="sm"
                    className="rounded-sm gap-2"
                    onClick={() => setShowForm(!showForm)}
                >
                    {showForm ? <X className="h-4 w-4" /> : <UserPlus className="h-4 w-4" />}
                    {showForm ? "Cancelar" : "Novo Usuário"}
                </Button>
            </div>

            {/* Formulário de novo usuário */}
            {showForm && (
                <div className="border rounded-sm p-4 bg-muted/30 space-y-4">
                    <h3 className="font-medium text-sm">Adicionar novo membro</h3>
                    <form onSubmit={handleCreate} className="space-y-4">
                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1.5">
                                <Label htmlFor="new-nome" className="text-xs">Nome completo *</Label>
                                <Input
                                    id="new-nome"
                                    value={nome}
                                    onChange={(e) => setNome(e.target.value)}
                                    placeholder="Ex: Maria Oliveira"
                                    className="rounded-sm h-8 text-sm"
                                    required
                                    disabled={submitting}
                                />
                            </div>
                            <div className="space-y-1.5">
                                <Label htmlFor="new-email" className="text-xs">E-mail *</Label>
                                <Input
                                    id="new-email"
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    placeholder="email@empresa.com"
                                    className="rounded-sm h-8 text-sm"
                                    required
                                    disabled={submitting}
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1.5">
                                <Label htmlFor="new-senha" className="text-xs">Senha padrão *</Label>
                                <div className="relative">
                                    <Input
                                        id="new-senha"
                                        type={showPassword ? "text" : "password"}
                                        value={senha}
                                        onChange={(e) => setSenha(e.target.value)}
                                        placeholder="Mín. 8 caracteres"
                                        className="rounded-sm h-8 text-sm pr-9"
                                        required
                                        minLength={8}
                                        disabled={submitting}
                                    />
                                    <button
                                        type="button"
                                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                                        onClick={() => setShowPassword(!showPassword)}
                                    >
                                        {showPassword ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                                    </button>
                                </div>
                            </div>

                            <div className="space-y-1.5">
                                <Label className="text-xs">Perfil de acesso *</Label>
                                <div className="flex gap-2">
                                    <button
                                        type="button"
                                        onClick={() => setRole("user")}
                                        className={`flex-1 flex items-center justify-center gap-1.5 h-8 text-xs rounded-sm border transition-all ${role === "user"
                                            ? "bg-gray-100 border-gray-400 font-medium"
                                            : "border-border hover:bg-muted/50"
                                            }`}
                                    >
                                        <User className="h-3 w-3" /> Usuário
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setRole("admin")}
                                        className={`flex-1 flex items-center justify-center gap-1.5 h-8 text-xs rounded-sm border transition-all ${role === "admin"
                                            ? "bg-blue-50 border-blue-400 text-blue-700 font-medium"
                                            : "border-border hover:bg-muted/50"
                                            }`}
                                    >
                                        <ShieldCheck className="h-3 w-3" /> Admin
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Permissões do role selecionado */}
                        <button
                            type="button"
                            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                            onClick={() => setShowPermissions(!showPermissions)}
                        >
                            <ChevronDown className={`h-3.5 w-3.5 transition-transform ${showPermissions ? "rotate-180" : ""}`} />
                            Ver permissões do perfil &quot;{ROLE_PERMISSIONS[role].label}&quot;
                        </button>

                        {showPermissions && (
                            <ul className="text-xs space-y-1 pl-4 text-muted-foreground">
                                {ROLE_PERMISSIONS[role].items.map((item) => (
                                    <li key={item} className="flex items-center gap-1.5">
                                        <CheckCircle2 className="h-3 w-3 text-green-500 shrink-0" />
                                        {item}
                                    </li>
                                ))}
                                {role === "user" && (
                                    <>
                                        <li className="flex items-center gap-1.5 text-muted-foreground/60">
                                            <X className="h-3 w-3 text-red-400 shrink-0" />
                                            Upload ou revogação de certificado
                                        </li>
                                        <li className="flex items-center gap-1.5 text-muted-foreground/60">
                                            <X className="h-3 w-3 text-red-400 shrink-0" />
                                            Edição de dados da empresa
                                        </li>
                                        <li className="flex items-center gap-1.5 text-muted-foreground/60">
                                            <X className="h-3 w-3 text-red-400 shrink-0" />
                                            Gerenciamento de usuários
                                        </li>
                                    </>
                                )}
                            </ul>
                        )}

                        <div className="flex justify-end gap-2">
                            <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="rounded-sm"
                                onClick={() => setShowForm(false)}
                                disabled={submitting}
                            >
                                Cancelar
                            </Button>
                            <Button
                                type="submit"
                                size="sm"
                                className="rounded-sm"
                                disabled={submitting}
                            >
                                {submitting ? (
                                    <><Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />Criando...</>
                                ) : (
                                    <><UserPlus className="mr-2 h-3.5 w-3.5" />Criar usuário</>
                                )}
                            </Button>
                        </div>
                    </form>
                </div>
            )}

            {/* Lista de membros */}
            {loadingMembers ? (
                <div className="flex justify-center py-6">
                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
            ) : members.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground text-sm">
                    Nenhum membro cadastrado ainda.
                </div>
            ) : (
                <div className="divide-y border rounded-sm overflow-hidden">
                    {members.map((member) => {
                        const isCurrentUser = member.id === currentUserId
                        const isChangingRole = changingRoleId === member.id
                        const isRemoving = removingId === member.id

                        return (
                            <div key={member.id} className="flex items-center gap-3 px-4 py-3 bg-background hover:bg-muted/20 transition-colors">
                                {/* Avatar / Inicial */}
                                <div className="h-9 w-9 shrink-0 rounded-full bg-primary/10 flex items-center justify-center">
                                    <span className="text-sm font-bold text-primary">
                                        {(member.nome ?? member.email ?? "?")[0].toUpperCase()}
                                    </span>
                                </div>

                                {/* Info */}
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2">
                                        <span className="text-sm font-medium truncate">
                                            {member.nome ?? "Sem nome"}
                                        </span>
                                        {isCurrentUser && (
                                            <span className="flex items-center gap-1 text-xs text-amber-600">
                                                <Crown className="h-3 w-3" /> Você
                                            </span>
                                        )}
                                        <RoleBadge role={member.role} />
                                    </div>
                                    <p className="text-xs text-muted-foreground truncate">{member.email}</p>
                                    <p className="text-xs text-muted-foreground">
                                        Último acesso: {formatDate(member.lastSignIn)}
                                    </p>
                                </div>

                                {/* Ações */}
                                {!isCurrentUser && (
                                    <div className="flex items-center gap-2 shrink-0">
                                        {/* Toggle role */}
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            className="rounded-sm h-7 text-xs px-2 gap-1"
                                            onClick={() => handleChangeRole(member.id, member.role === "admin" ? "user" : "admin")}
                                            disabled={isChangingRole || isRemoving}
                                            title={member.role === "admin" ? "Rebaixar para Usuário" : "Promover para Admin"}
                                        >
                                            {isChangingRole ? (
                                                <Loader2 className="h-3 w-3 animate-spin" />
                                            ) : member.role === "admin" ? (
                                                <><User className="h-3 w-3" /> Tornar Usuário</>
                                            ) : (
                                                <><ShieldCheck className="h-3 w-3" /> Tornar Admin</>
                                            )}
                                        </Button>

                                        {/* Remover */}
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            className="rounded-sm h-7 w-7 p-0 text-destructive hover:bg-destructive/10"
                                            onClick={() => handleRemove(member.id, member.nome ?? member.email ?? "")}
                                            disabled={isChangingRole || isRemoving}
                                            title="Remover usuário"
                                        >
                                            {isRemoving ? (
                                                <Loader2 className="h-3 w-3 animate-spin" />
                                            ) : (
                                                <Trash2 className="h-3 w-3" />
                                            )}
                                        </Button>
                                    </div>
                                )}
                            </div>
                        )
                    })}
                </div>
            )}
        </div>
    )
}
