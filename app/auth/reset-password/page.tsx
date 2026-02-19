"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { KeyRound, Loader2, Eye, EyeOff, CheckCircle2, AlertTriangle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { updatePassword } from "@/actions/auth"

export default function ResetPasswordPage() {
    const router = useRouter()
    const [password, setPassword] = React.useState("")
    const [confirm, setConfirm] = React.useState("")
    const [showPassword, setShowPassword] = React.useState(false)
    const [isLoading, setIsLoading] = React.useState(false)
    const [result, setResult] = React.useState<{ type: "success" | "error"; message: string } | null>(null)

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault()
        if (password !== confirm) {
            setResult({ type: "error", message: "As senhas não coincidem." })
            return
        }
        setIsLoading(true)
        setResult(null)
        const res = await updatePassword(password)
        if (res.success) {
            setResult({ type: "success", message: "Senha redefinida com sucesso! Redirecionando..." })
            setTimeout(() => router.push("/dashboard"), 2500)
        } else {
            setResult({ type: "error", message: res.error })
        }
        setIsLoading(false)
    }

    return (
        <div className="flex min-h-screen items-center justify-center bg-muted/30 px-4">
            <Card className="w-full max-w-sm rounded-sm">
                <CardHeader className="text-center pb-4">
                    <div className="flex justify-center mb-3">
                        <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                            <KeyRound className="h-6 w-6 text-primary" />
                        </div>
                    </div>
                    <CardTitle className="text-lg">Redefinir senha</CardTitle>
                    <CardDescription>Escolha uma nova senha para sua conta.</CardDescription>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="new-password">Nova senha</Label>
                            <div className="relative">
                                <Input
                                    id="new-password"
                                    type={showPassword ? "text" : "password"}
                                    placeholder="Mínimo 8 caracteres"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    required
                                    minLength={8}
                                    className="rounded-sm pr-10"
                                    disabled={isLoading}
                                />
                                <button
                                    type="button"
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                                    onClick={() => setShowPassword(!showPassword)}
                                >
                                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                </button>
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="confirm-password">Confirmar nova senha</Label>
                            <Input
                                id="confirm-password"
                                type="password"
                                placeholder="Repita a nova senha"
                                value={confirm}
                                onChange={(e) => setConfirm(e.target.value)}
                                required
                                className="rounded-sm"
                                disabled={isLoading}
                            />
                        </div>

                        {result && (
                            <div className={`flex items-center gap-2 text-sm rounded-sm px-3 py-2 border ${result.type === "success"
                                ? "text-green-700 bg-green-50 border-green-200"
                                : "text-red-700 bg-red-50 border-red-200"
                                }`}>
                                {result.type === "success"
                                    ? <CheckCircle2 className="h-4 w-4 shrink-0" />
                                    : <AlertTriangle className="h-4 w-4 shrink-0" />}
                                {result.message}
                            </div>
                        )}

                        <Button type="submit" className="w-full rounded-sm" disabled={isLoading}>
                            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Salvar nova senha
                        </Button>
                    </form>
                </CardContent>
            </Card>
        </div>
    )
}
