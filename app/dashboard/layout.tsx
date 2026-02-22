import Link from "next/link"
import Image from "next/image"
import {
    Bell,
    FileText,
    FileUp,
    LayoutDashboard,
    Settings,
    Shield,
    LogOut,
    User,
    AlertTriangle,
    Table2
} from "lucide-react"

import { Button } from "@/components/ui/button"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { getProfile } from "@/actions/auth"
import { SignOutButton } from "@/components/sign-out-button"
import { NotificationsBell } from "@/components/notifications-bell"
import { getActiveSubscription } from "@/actions/subscription"

interface SidebarProps extends React.HTMLAttributes<HTMLDivElement> { }

export function Sidebar({ className }: SidebarProps) {
    return (
        <div className={`pb-12 ${className ?? ""}`}>
            <div className="space-y-4 py-4">
                <div className="px-3 py-2">
                    <h2 className="mb-2 px-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground/50">
                        Operacional
                    </h2>
                    <div className="space-y-1">
                        <Button
                            variant="ghost"
                            className="w-full justify-start rounded-none hover:bg-muted/50"
                            asChild
                        >
                            <Link href="/dashboard">
                                <LayoutDashboard className="mr-2 h-4 w-4" />
                                Monitoramento
                            </Link>
                        </Button>
                    </div>
                </div>
                <div className="px-3 py-2">
                    <h2 className="mb-2 px-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground/50">
                        Ferramentas
                    </h2>
                    <div className="space-y-1">
                        <Button
                            variant="ghost"
                            className="w-full justify-start rounded-none hover:bg-muted/50"
                            asChild
                        >
                            <Link href="/dashboard/converter">
                                <FileUp className="mr-2 h-4 w-4" />
                                Converter XML
                            </Link>
                        </Button>
                        <Button
                            variant="ghost"
                            className="w-full justify-start rounded-none hover:bg-muted/50"
                            asChild
                        >
                            <Link href="/dashboard/relatorio-xml">
                                <Table2 className="mr-2 h-4 w-4" />
                                Relatório XML
                            </Link>
                        </Button>
                    </div>
                </div>
                <div className="px-3 py-2">
                    <h2 className="mb-2 px-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground/50">
                        Configuração
                    </h2>
                    <div className="space-y-1">
                        <Button
                            variant="ghost"
                            className="w-full justify-start rounded-none hover:bg-muted/50"
                            asChild
                        >
                            <Link href="/dashboard/certificado">
                                <Shield className="mr-2 h-4 w-4" />
                                Certificado Digital
                            </Link>
                        </Button>
                        <Button
                            variant="ghost"
                            className="w-full justify-start rounded-none hover:bg-muted/50"
                            asChild
                        >
                            <Link href="/dashboard/cnpj">
                                <Settings className="mr-2 h-4 w-4" />
                                Empresa & CNPJ
                            </Link>
                        </Button>
                        <Button
                            variant="ghost"
                            className="w-full justify-start rounded-none hover:bg-muted/50"
                            asChild
                        >
                            <Link href="/dashboard/perfil">
                                <User className="mr-2 h-4 w-4" />
                                Meu Perfil
                            </Link>
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default async function DashboardLayout({
    children,
}: {
    children: React.ReactNode
}) {
    const profile = await getProfile()
    const initials = profile?.nome
        ? profile.nome.split(" ").map((n: string) => n[0]).slice(0, 2).join("").toUpperCase()
        : (profile?.email?.[0] ?? "?").toUpperCase()

    const subscription = await getActiveSubscription()
    let daysLeft = 0
    let isTrialing = false

    if (subscription && subscription.status === 'trialing' && subscription.trial_ends_at) {
        isTrialing = true
        const diff = new Date(subscription.trial_ends_at).getTime() - Date.now()
        daysLeft = Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)))
    }

    return (
        <div className="flex min-h-screen flex-col">
            {isTrialing && (
                <div className={`w-full p-2 text-center text-sm font-medium flex items-center justify-center gap-2 ${daysLeft <= 2 ? 'bg-destructive text-destructive-foreground' : 'bg-primary text-primary-foreground'
                    }`}>
                    {daysLeft <= 2 && <AlertTriangle className="h-4 w-4" />}
                    {daysLeft <= 2
                        ? `Atenção: Seu período de teste acaba em ${daysLeft} dia${daysLeft !== 1 ? 's' : ''}.`
                        : `Você está em período de teste. Faltam ${daysLeft} dia${daysLeft !== 1 ? 's' : ''}.`}
                    <Link href="/escolher-plano?upgrade=true" className="underline font-bold ml-1 hover:text-white/80 transition-colors">
                        Fazer Upgrade
                    </Link>
                </div>
            )}
            <header className="sticky top-0 z-50 flex h-14 items-center border-b bg-background px-6 shadow-sm">
                <div className="mr-4 flex items-center">
                    <Image
                        src="/images/logo_sidebar.png"
                        alt="NF-e Ágil"
                        width={120}
                        height={32}
                        priority
                        className="h-8 w-auto object-contain"
                    />
                </div>
                <div className="ml-auto flex items-center space-x-2">
                    {profile?.id && <NotificationsBell userId={profile.id} />}

                    {/* Avatar com dropdown */}
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <button className="h-8 w-8 rounded-full overflow-hidden border border-border hover:ring-2 hover:ring-primary/30 transition-all">
                                {profile?.avatar_url ? (
                                    <Image
                                        src={profile.avatar_url}
                                        alt="Avatar"
                                        width={32}
                                        height={32}
                                        className="object-cover w-8 h-8"
                                    />
                                ) : (
                                    <div className="h-8 w-8 bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">
                                        {initials}
                                    </div>
                                )}
                            </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-48 rounded-sm">
                            <DropdownMenuLabel className="flex flex-col">
                                <span className="font-medium truncate">{profile?.nome ?? "Usuário"}</span>
                                <span className="text-xs font-normal text-muted-foreground truncate">
                                    {profile?.email}
                                </span>
                            </DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem asChild>
                                <Link href="/dashboard/perfil" className="cursor-pointer">
                                    <User className="mr-2 h-4 w-4" />
                                    Meu Perfil
                                </Link>
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem asChild>
                                <SignOutButton />
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            </header>
            <div className="flex-1 items-start md:grid md:grid-cols-[220px_1fr]">
                <aside className="fixed top-14 z-30 hidden h-[calc(100vh-3.5rem)] w-full shrink-0 border-r bg-background md:sticky md:block">
                    <Sidebar />
                </aside>
                <main className="flex w-full flex-col overflow-hidden p-6">
                    {children}
                </main>
            </div>
        </div>
    )
}
