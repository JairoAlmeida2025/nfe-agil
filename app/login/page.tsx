"use client"

import * as React from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { FileText, Loader2, Mail, CheckCircle2, Eye, EyeOff } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { signIn, signUp, requestPasswordReset } from "@/actions/auth"

type Mode = "login" | "cadastro" | "email-enviado" | "recuperar-senha" | "link-enviado"

// Componente interno que usa useSearchParams — deve ficar dentro de <Suspense>
function LoginContent() {
    const router = useRouter()
    const searchParams = useSearchParams()
    const defaultMode = searchParams.get("modo") === "cadastro" ? "cadastro" : "login"

    const [mode, setMode] = React.useState<Mode>(defaultMode)
    const [isLoading, setIsLoading] = React.useState(false)
    const [error, setError] = React.useState<string | null>(null)
    const [showPassword, setShowPassword] = React.useState(false)
    const [showConfirm, setShowConfirm] = React.useState(false)

    // Campos
    const [nome, setNome] = React.useState("")
    const [email, setEmail] = React.useState("")
    const [password, setPassword] = React.useState("")
    const [confirmPassword, setConfirmPassword] = React.useState("")

    function resetForm() {
        setError(null)
        setPassword("")
        setConfirmPassword("")
    }

    async function handleLogin(e: React.FormEvent) {
        e.preventDefault()
        setIsLoading(true)
        setError(null)

        const fd = new FormData()
        fd.append("email", email)
        fd.append("password", password)

        const result = await signIn(fd)

        if (result.success) {
            router.push("/dashboard")
            router.refresh()
        } else {
            setError(result.error)
        }
        setIsLoading(false)
    }

    async function handleCadastro(e: React.FormEvent) {
        e.preventDefault()
        if (password !== confirmPassword) {
            setError("As senhas não coincidem.")
            return
        }
        setIsLoading(true)
        setError(null)

        const fd = new FormData()
        fd.append("nome", nome)
        fd.append("email", email)
        fd.append("password", password)

        const result = await signUp(fd)

        if (result.success) {
            setMode("email-enviado")
        } else {
            setError(result.error)
        }
        setIsLoading(false)
    }

    async function handleRecovery(e: React.FormEvent) {
        e.preventDefault()
        setIsLoading(true)
        setError(null)

        const res = await requestPasswordReset(email)

        if (res.success) {
            setMode("link-enviado")
        } else {
            setError(res.error)
        }
        setIsLoading(false)
    }

    // ── TELA: E-MAIL ENVIADO ──────────────────────────────────────────────────
    if (mode === "email-enviado") {
        return (
            <div className="flex min-h-screen items-center justify-center bg-muted/30 px-4">
                <Card className="w-full max-w-md rounded-sm">
                    <CardContent className="pt-8 pb-8 text-center space-y-4">
                        <div className="flex justify-center">
                            <div className="h-16 w-16 rounded-full bg-green-100 flex items-center justify-center">
                                <Mail className="h-8 w-8 text-green-600" />
                            </div>
                        </div>
                        <h2 className="text-xl font-bold">Confirme seu e-mail</h2>
                        <p className="text-sm text-muted-foreground leading-relaxed">
                            Enviamos um link de confirmação para <strong>{email}</strong>.
                            Acesse seu e-mail e clique no link para ativar sua conta.
                        </p>
                        <div className="flex items-start gap-2 text-xs text-muted-foreground bg-muted rounded-sm p-3 text-left">
                            <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5 text-muted-foreground" />
                            <span>Não encontrou? Verifique a caixa de spam ou aguarde alguns minutos.</span>
                        </div>
                        <Button
                            variant="outline"
                            className="w-full rounded-sm"
                            onClick={() => { setMode("login"); resetForm() }}
                        >
                            Voltar ao login
                        </Button>
                    </CardContent>
                </Card>
            </div>
        )
    }

    // ── TELA: LINK ENVIADO (RESET) ────────────────────────────────────────────
    if (mode === "link-enviado") {
        return (
            <div className="flex min-h-screen items-center justify-center bg-muted/30 px-4">
                <Card className="w-full max-w-md rounded-sm">
                    <CardContent className="pt-8 pb-8 text-center space-y-4">
                        <div className="flex justify-center">
                            <div className="h-16 w-16 rounded-full bg-blue-100 flex items-center justify-center">
                                <Mail className="h-8 w-8 text-blue-600" />
                            </div>
                        </div>
                        <h2 className="text-xl font-bold">Verifique seu e-mail</h2>
                        <p className="text-sm text-muted-foreground leading-relaxed">
                            Se houver uma conta associada a <strong>{email}</strong>,
                            enviamos um link para redefinir sua senha.
                        </p>
                        <Button
                            variant="outline"
                            className="w-full rounded-sm"
                            onClick={() => { setMode("login"); resetForm() }}
                        >
                            Voltar ao login
                        </Button>
                    </CardContent>
                </Card>
            </div>
        )
    }

    return (
        <div className="flex min-h-screen">
            {/* LADO ESQUERDO — visual */}
            <div className="hidden lg:flex lg:w-1/2 flex-col items-center justify-center bg-primary text-primary-foreground p-12 relative overflow-hidden">
                <div className="absolute inset-0 opacity-10">
                    {Array.from({ length: 8 }).map((_, i) => (
                        <div
                            key={i}
                            className="absolute border border-current rounded-sm"
                            style={{
                                width: `${(i + 1) * 120}px`,
                                height: `${(i + 1) * 120}px`,
                                top: "50%",
                                left: "50%",
                                transform: "translate(-50%, -50%)",
                            }}
                        />
                    ))}
                </div>
                <div className="relative z-10 text-center space-y-6 max-w-xs">
                    <div className="flex items-center justify-center gap-3">
                        <FileText className="h-10 w-10" />
                        <span className="text-3xl font-bold tracking-tight">NF-e Ágil</span>
                    </div>
                    <p className="text-primary-foreground/80 text-sm leading-relaxed">
                        Gestão fiscal inteligente. Monitore e gerencie suas notas fiscais
                        eletrônicas com integração direta à SEFAZ.
                    </p>
                    <div className="grid grid-cols-2 gap-3 text-xs">
                        {[
                            "Certificado A1 seguro",
                            "Integração SEFAZ",
                            "Dados isolados por usuário",
                            "Atualização automática",
                        ].map((f) => (
                            <div key={f} className="flex items-center gap-1.5 bg-white/10 rounded-sm px-2 py-1.5">
                                <CheckCircle2 className="h-3 w-3 shrink-0" />
                                <span>{f}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* LADO DIREITO — formulário */}
            <div className="flex-1 flex items-center justify-center p-8 bg-background">
                <div className="w-full max-w-sm space-y-6">
                    {/* Logo mobile */}
                    <div className="flex items-center gap-2 lg:hidden">
                        <FileText className="h-6 w-6 text-primary" />
                        <span className="font-bold text-lg">NF-e Ágil</span>
                    </div>

                    {/* Tabs Login / Cadastro */}
                    <div className="flex rounded-sm bg-muted p-1 gap-1">
                        <button
                            onClick={() => { setMode("login"); resetForm() }}
                            className={`flex-1 rounded-sm py-1.5 text-sm font-medium transition-colors ${mode === "login"
                                ? "bg-background text-foreground shadow-sm"
                                : "text-muted-foreground hover:text-foreground"
                                }`}
                        >
                            Entrar
                        </button>
                        <button
                            onClick={() => { setMode("cadastro"); resetForm() }}
                            className={`flex-1 rounded-sm py-1.5 text-sm font-medium transition-colors ${mode === "cadastro"
                                ? "bg-background text-foreground shadow-sm"
                                : "text-muted-foreground hover:text-foreground"
                                }`}
                        >
                            Criar conta
                        </button>
                    </div>

                    {/* FORMULÁRIO RECUPERAR SENHA */}
                    {mode === "recuperar-senha" && (
                        <Card className="rounded-sm border">
                            <CardHeader className="pb-4">
                                <CardTitle className="text-lg">Recuperar senha</CardTitle>
                                <CardDescription>Informe seu e-mail e enviaremos um link de redefinição.</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <form onSubmit={handleRecovery} className="space-y-4">
                                    <div className="space-y-2">
                                        <Label htmlFor="rec-email">E-mail cadastrado</Label>
                                        <Input
                                            id="rec-email"
                                            type="email"
                                            placeholder="seu@email.com"
                                            value={email}
                                            onChange={(e) => setEmail(e.target.value)}
                                            required
                                            className="rounded-sm"
                                            disabled={isLoading}
                                        />
                                    </div>

                                    {error && (
                                        <p className="text-sm text-destructive bg-destructive/5 border border-destructive/20 rounded-sm px-3 py-2">
                                            {error}
                                        </p>
                                    )}

                                    <Button type="submit" className="w-full rounded-sm" disabled={isLoading}>
                                        {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                        Enviar link
                                    </Button>

                                    <Button
                                        type="button"
                                        variant="ghost"
                                        className="w-full rounded-sm"
                                        onClick={() => { setMode("login"); resetForm() }}
                                        disabled={isLoading}
                                    >
                                        Voltar ao login
                                    </Button>
                                </form>
                            </CardContent>
                        </Card>
                    )}

                    {/* FORMULÁRIO LOGIN */}
                    {mode === "login" && (
                        <Card className="rounded-sm border">
                            <CardHeader className="pb-4">
                                <CardTitle className="text-lg">Bem-vindo de volta</CardTitle>
                                <CardDescription>Entre com suas credenciais para acessar o sistema.</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <form onSubmit={handleLogin} className="space-y-4">
                                    <div className="space-y-2">
                                        <Label htmlFor="login-email">E-mail</Label>
                                        <Input
                                            id="login-email"
                                            type="email"
                                            placeholder="seu@email.com"
                                            value={email}
                                            onChange={(e) => setEmail(e.target.value)}
                                            autoComplete="email"
                                            required
                                            className="rounded-sm"
                                            disabled={isLoading}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="login-password">Senha</Label>
                                        <div className="relative">
                                            <Input
                                                id="login-password"
                                                type={showPassword ? "text" : "password"}
                                                placeholder="••••••••"
                                                value={password}
                                                onChange={(e) => setPassword(e.target.value)}
                                                autoComplete="current-password"
                                                required
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
                                        <div className="text-right">
                                            <button
                                                type="button"
                                                className="text-xs text-muted-foreground hover:text-primary transition-colors"
                                                onClick={() => { setMode("recuperar-senha"); resetForm() }}
                                            >
                                                Esqueci minha senha
                                            </button>
                                        </div>
                                    </div>

                                    {error && (
                                        <p className="text-sm text-destructive bg-destructive/5 border border-destructive/20 rounded-sm px-3 py-2">
                                            {error}
                                        </p>
                                    )}

                                    <Button type="submit" className="w-full rounded-sm" disabled={isLoading}>
                                        {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                        Entrar
                                    </Button>
                                </form>
                            </CardContent>
                        </Card>
                    )}

                    {/* FORMULÁRIO CADASTRO */}
                    {mode === "cadastro" && (
                        <Card className="rounded-sm border">
                            <CardHeader className="pb-4">
                                <CardTitle className="text-lg">Crie sua conta</CardTitle>
                                <CardDescription>
                                    Após o cadastro, enviaremos um e-mail de confirmação.
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                <form onSubmit={handleCadastro} className="space-y-4">
                                    <div className="space-y-2">
                                        <Label htmlFor="cad-nome">Nome completo</Label>
                                        <Input
                                            id="cad-nome"
                                            type="text"
                                            placeholder="João Silva"
                                            value={nome}
                                            onChange={(e) => setNome(e.target.value)}
                                            autoComplete="name"
                                            required
                                            className="rounded-sm"
                                            disabled={isLoading}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="cad-email">E-mail</Label>
                                        <Input
                                            id="cad-email"
                                            type="email"
                                            placeholder="seu@email.com"
                                            value={email}
                                            onChange={(e) => setEmail(e.target.value)}
                                            autoComplete="email"
                                            required
                                            className="rounded-sm"
                                            disabled={isLoading}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="cad-password">Senha</Label>
                                        <div className="relative">
                                            <Input
                                                id="cad-password"
                                                type={showPassword ? "text" : "password"}
                                                placeholder="Mínimo 8 caracteres"
                                                value={password}
                                                onChange={(e) => setPassword(e.target.value)}
                                                autoComplete="new-password"
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
                                        <Label htmlFor="cad-confirm">Confirmar senha</Label>
                                        <div className="relative">
                                            <Input
                                                id="cad-confirm"
                                                type={showConfirm ? "text" : "password"}
                                                placeholder="Repita a senha"
                                                value={confirmPassword}
                                                onChange={(e) => setConfirmPassword(e.target.value)}
                                                autoComplete="new-password"
                                                required
                                                className="rounded-sm pr-10"
                                                disabled={isLoading}
                                            />
                                            <button
                                                type="button"
                                                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                                                onClick={() => setShowConfirm(!showConfirm)}
                                            >
                                                {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                            </button>
                                        </div>
                                    </div>

                                    {error && (
                                        <p className="text-sm text-destructive bg-destructive/5 border border-destructive/20 rounded-sm px-3 py-2">
                                            {error}
                                        </p>
                                    )}

                                    <Button type="submit" className="w-full rounded-sm" disabled={isLoading}>
                                        {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                        Criar conta
                                    </Button>
                                </form>
                            </CardContent>
                        </Card>
                    )}

                    <p className="text-center text-xs text-muted-foreground">
                        Ao continuar, você concorda com nossos{" "}
                        <a href="#" className="underline underline-offset-4 hover:text-primary">Termos de Uso</a>
                        {" "}e{" "}
                        <a href="#" className="underline underline-offset-4 hover:text-primary">Política de Privacidade</a>.
                    </p>
                </div>
            </div>
        </div>
    )
}

// Página exportada — envolve LoginContent em Suspense para satisfazer o build do Next.js
export default function LoginPage() {
    return (
        <React.Suspense fallback={
            <div className="flex min-h-screen items-center justify-center">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
        }>
            <LoginContent />
        </React.Suspense>
    )
}
