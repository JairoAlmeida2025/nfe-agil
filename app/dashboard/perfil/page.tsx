"use client"

import * as React from "react"
import Image from "next/image"
import {
    Camera, Loader2, CheckCircle2, User, ShieldCheck, Users
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { getProfile, updateProfile } from "@/actions/auth"
import { getCurrentUserRole } from "@/actions/usuarios"
import type { UserRole } from "@/lib/permissions"
import { TeamManager } from "@/components/team-manager"

type Profile = {
    id: string
    nome: string | null
    avatar_url: string | null
    email: string | null
}

const ROLE_INFO: Record<UserRole, { label: string; description: string; icon: React.ReactNode }> = {
    admin: {
        label: "Administrador",
        description: "Acesso total ao sistema, incluindo certificados, empresa e gerenciamento de usuários.",
        icon: <ShieldCheck className="h-4 w-4 text-blue-600" />,
    },
    user: {
        label: "Usuário",
        description: "Acesso de consulta e download de NF-es. Sem permissão para alterar configurações.",
        icon: <User className="h-4 w-4 text-gray-500" />,
    },
}

export default function PerfilPage() {
    const [profile, setProfile] = React.useState<Profile | null>(null)
    const [role, setRole] = React.useState<UserRole | null>(null)
    const [loading, setLoading] = React.useState(true)
    const [saving, setSaving] = React.useState(false)
    const [success, setSuccess] = React.useState(false)
    const [error, setError] = React.useState<string | null>(null)
    const [nome, setNome] = React.useState("")
    const [avatarPreview, setAvatarPreview] = React.useState<string | null>(null)
    const [avatarFile, setAvatarFile] = React.useState<File | null>(null)
    const fileInputRef = React.useRef<HTMLInputElement>(null)

    React.useEffect(() => {
        Promise.all([getProfile(), getCurrentUserRole()]).then(([p, r]) => {
            setProfile(p)
            setNome(p?.nome ?? "")
            setRole(r)
            setLoading(false)
        })
    }, [])

    function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0]
        if (!file) return

        if (file.size > 2 * 1024 * 1024) {
            setError("Imagem muito grande. Máximo: 2 MB.")
            return
        }

        setAvatarFile(file)
        const url = URL.createObjectURL(file)
        setAvatarPreview(url)
        setError(null)
    }

    async function handleSave(e: React.FormEvent) {
        e.preventDefault()
        setSaving(true)
        setError(null)
        setSuccess(false)

        const fd = new FormData()
        fd.append("nome", nome)
        if (avatarFile) fd.append("avatar", avatarFile)

        const result = await updateProfile(fd)

        if (result.success) {
            setSuccess(true)
            const updated = await getProfile()
            setProfile(updated)
            setTimeout(() => setSuccess(false), 4000)
        } else {
            setError(result.error)
        }

        setSaving(false)
    }

    const avatarSrc = avatarPreview ?? profile?.avatar_url

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
        )
    }

    const initials = nome
        ? nome.split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase()
        : (profile?.email?.[0] ?? "?").toUpperCase()

    const roleInfo = role ? ROLE_INFO[role] : null

    return (
        <div className="max-w-2xl space-y-6">
            <div>
                <h1 className="text-2xl font-bold tracking-tight">Meu Perfil</h1>
                <p className="text-sm text-muted-foreground">
                    Gerencie suas informações pessoais e configurações da conta.
                </p>
            </div>

            {/* Badge de role atual */}
            {roleInfo && (
                <div className="flex items-center gap-3 px-4 py-3 rounded-sm border bg-muted/30">
                    {roleInfo.icon}
                    <div>
                        <p className="text-sm font-medium">{roleInfo.label}</p>
                        <p className="text-xs text-muted-foreground">{roleInfo.description}</p>
                    </div>
                </div>
            )}

            {/* Foto de perfil */}
            <Card className="rounded-sm">
                <CardHeader>
                    <CardTitle className="text-base">Foto de perfil</CardTitle>
                    <CardDescription>JPG, PNG ou WebP. Máximo 2 MB.</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="flex items-center gap-6">
                        <div className="relative h-20 w-20 shrink-0">
                            {avatarSrc ? (
                                <Image
                                    src={avatarSrc}
                                    alt="Avatar"
                                    fill
                                    className="rounded-full object-cover"
                                />
                            ) : (
                                <div className="h-20 w-20 rounded-full bg-primary/10 flex items-center justify-center">
                                    <span className="text-xl font-bold text-primary">{initials}</span>
                                </div>
                            )}
                            <button
                                type="button"
                                onClick={() => fileInputRef.current?.click()}
                                className="absolute bottom-0 right-0 h-6 w-6 bg-primary rounded-full flex items-center justify-center text-primary-foreground border-2 border-background hover:bg-primary/90 transition-colors"
                            >
                                <Camera className="h-3 w-3" />
                            </button>
                        </div>

                        <div className="space-y-1">
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="rounded-sm"
                                onClick={() => fileInputRef.current?.click()}
                            >
                                <Camera className="mr-2 h-4 w-4" />
                                {avatarSrc ? "Trocar foto" : "Enviar foto"}
                            </Button>
                            <p className="text-xs text-muted-foreground">
                                Clique para selecionar ou arraste sobre a foto.
                            </p>
                        </div>
                    </div>

                    <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/jpeg,image/png,image/webp,image/gif"
                        className="hidden"
                        onChange={handleAvatarChange}
                    />
                </CardContent>
            </Card>

            {/* Dados da conta */}
            <Card className="rounded-sm">
                <CardHeader>
                    <CardTitle className="text-base">Dados da conta</CardTitle>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleSave} className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="perfil-nome">Nome completo</Label>
                            <Input
                                id="perfil-nome"
                                value={nome}
                                onChange={(e) => setNome(e.target.value)}
                                placeholder="Seu nome"
                                className="rounded-sm"
                                disabled={saving}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="perfil-email">E-mail</Label>
                            <Input
                                id="perfil-email"
                                value={profile?.email ?? ""}
                                disabled
                                className="rounded-sm bg-muted"
                            />
                            <p className="text-xs text-muted-foreground">O e-mail não pode ser alterado aqui.</p>
                        </div>

                        {error && (
                            <p className="text-sm text-destructive bg-destructive/5 border border-destructive/20 rounded-sm px-3 py-2">
                                {error}
                            </p>
                        )}

                        {success && (
                            <div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 border border-green-200 rounded-sm px-3 py-2">
                                <CheckCircle2 className="h-4 w-4" />
                                Perfil atualizado com sucesso!
                            </div>
                        )}

                        <Button type="submit" className="rounded-sm" disabled={saving}>
                            {saving ? (
                                <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Salvando...</>
                            ) : (
                                <><User className="mr-2 h-4 w-4" />Salvar alterações</>
                            )}
                        </Button>
                    </form>
                </CardContent>
            </Card>

            {/* Gerenciamento de equipe (somente admin) */}
            {role === "admin" && (
                <Card className="rounded-sm">
                    <CardHeader>
                        <div className="flex items-center gap-2">
                            <Users className="h-5 w-5 text-primary" />
                            <CardTitle className="text-base">Gerenciamento de Equipe</CardTitle>
                        </div>
                        <CardDescription>
                            Adicione colaboradores e defina o nível de acesso de cada um.
                            Membros com perfil <strong>Usuário</strong> podem consultar e baixar NF-es.
                            Membros com perfil <strong>Admin</strong> têm acesso total ao sistema.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        {profile?.id && (
                            <TeamManager currentUserId={profile.id} />
                        )}
                    </CardContent>
                </Card>
            )}
        </div>
    )
}
