import Link from 'next/link'
import Image from 'next/image'
import {
    LayoutDashboard,
    Users,
    CreditCard,
    Receipt,
    Package,
    LogOut,
} from 'lucide-react'
import { getProfile, signOut } from '@/actions/auth'
import { Button } from '@/components/ui/button'

export const dynamic = 'force-dynamic'

/**
 * Paleta Oficial NF-e Ágil
 * ─────────────────────────
 * Azul Fiscal:          #1E3A8A
 * Verde Status:         #10B981
 * Cinza Claro:          #F3F4F6
 * Amarelo Alerta:       #F59E0B
 * Grafite Profundo:     #1F2937
 */

const adminNavItems = [
    { href: '/admin', label: 'Dashboard', icon: LayoutDashboard },
    { href: '/admin/usuarios', label: 'Usuários', icon: Users },
    { href: '/admin/assinaturas', label: 'Assinaturas', icon: CreditCard },
    { href: '/admin/pagamentos', label: 'Pagamentos', icon: Receipt },
    { href: '/admin/planos', label: 'Planos', icon: Package },
]

export default async function AdminLayout({
    children,
}: {
    children: React.ReactNode
}) {
    const profile = await getProfile()
    const initials = profile?.nome
        ? profile.nome.split(' ').map((n: string) => n[0]).slice(0, 2).join('').toUpperCase()
        : (profile?.email?.[0] ?? '?').toUpperCase()

    return (
        <div className="flex min-h-screen flex-col bg-[#1F2937] text-white">
            {/* Header — Azul Fiscal */}
            <header className="sticky top-0 z-50 flex h-14 items-center border-b border-[#1E3A8A]/20 bg-[#1F2937]/95 backdrop-blur-xl px-6">
                <div className="flex items-center gap-3">
                    <Image
                        src="/images/logo_sidebar.png"
                        alt="NF-e Ágil"
                        width={100}
                        height={28}
                        priority
                        className="h-7 w-auto object-contain brightness-0 invert"
                    />
                    <span className="px-2 py-0.5 rounded-md bg-[#F59E0B]/15 border border-[#F59E0B]/30 text-[#F59E0B] text-[10px] font-semibold uppercase tracking-wider">
                        Admin
                    </span>
                </div>
                <div className="ml-auto flex items-center gap-3">
                    <span className="text-xs text-white/30 hidden sm:inline">
                        {profile?.email}
                    </span>
                    <div className="h-8 w-8 rounded-full bg-[#1E3A8A]/20 flex items-center justify-center text-xs font-bold text-[#5B8DEF]">
                        {initials}
                    </div>
                    <form action={signOut}>
                        <Button
                            type="submit"
                            variant="ghost"
                            size="sm"
                            className="text-white/40 hover:text-red-400 hover:bg-red-500/10"
                        >
                            <LogOut className="mr-1.5 h-3.5 w-3.5" />
                            Sair
                        </Button>
                    </form>
                </div>
            </header>

            <div className="flex flex-1">
                {/* Sidebar — Grafite com accent Azul Fiscal */}
                <aside className="w-56 border-r border-white/5 bg-[#1F2937] hidden md:block">
                    <nav className="p-4 space-y-1">
                        {adminNavItems.map(item => (
                            <Link
                                key={item.href}
                                href={item.href}
                                className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-white/50 hover:text-white hover:bg-[#1E3A8A]/10 transition-colors"
                            >
                                <item.icon className="h-4 w-4" />
                                {item.label}
                            </Link>
                        ))}
                    </nav>
                </aside>

                {/* Content */}
                <main className="flex-1 p-6 overflow-auto">
                    {children}
                </main>
            </div>
        </div>
    )
}
