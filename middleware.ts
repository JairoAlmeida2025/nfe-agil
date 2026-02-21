import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { NextResponse, type NextRequest } from 'next/server'

// ── Master Admin emails ───────────────────────────────────────────────────────
const MASTER_ADMIN_EMAILS = (process.env.MASTER_ADMIN_EMAILS ?? '')
    .split(',')
    .map(e => e.trim().toLowerCase())
    .filter(Boolean)

function isMasterAdmin(email?: string | null): boolean {
    if (!email) return false
    return MASTER_ADMIN_EMAILS.includes(email.toLowerCase())
}

export async function middleware(request: NextRequest) {
    let supabaseResponse = NextResponse.next({ request })

    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                getAll() {
                    return request.cookies.getAll()
                },
                setAll(cookiesToSet) {
                    cookiesToSet.forEach(({ name, value }) =>
                        request.cookies.set(name, value)
                    )
                    supabaseResponse = NextResponse.next({ request })
                    cookiesToSet.forEach(({ name, value, options }) =>
                        supabaseResponse.cookies.set(name, value, options)
                    )
                },
            },
        }
    )

    // Verificar sessão
    const { data: { user } } = await supabase.auth.getUser()

    const { pathname } = request.nextUrl

    // Rotas públicas (acessíveis sem autenticação)
    const publicRoutes = ['/login', '/cadastro', '/auth/callback', '/auth/confirm', '/privacidade', '/termos', '/escolher-plano']
    const isPublicRoute = publicRoutes.some(r => pathname.startsWith(r))

    // ── Usuário NÃO autenticado ──────────────────────────────────────────────
    if (!user && !isPublicRoute) {
        return NextResponse.redirect(new URL('/login', request.url))
    }

    // ── Usuário AUTENTICADO ──────────────────────────────────────────────────
    if (user) {
        const isAdmin = isMasterAdmin(user.email)

        // ── Master Admin: redirecionar rotas de entrada para /admin ──────────
        if (isAdmin) {
            // Admin logou ou acessou raiz → vai para /admin
            if (pathname === '/' || pathname === '/login' || pathname === '/cadastro') {
                return NextResponse.redirect(new URL('/admin', request.url))
            }

            // Admin nunca deve cair em /escolher-plano → redireciona para /admin
            if (pathname === '/escolher-plano') {
                return NextResponse.redirect(new URL('/admin', request.url))
            }

            // Admin tem acesso total a /admin/* e /dashboard/*
            // Sem restrições — prossegue normalmente
            return supabaseResponse
        }

        // ── Usuário normal ───────────────────────────────────────────────────

        // Redirecionar de rotas de entrada para /dashboard
        if (pathname === '/' || pathname === '/login' || pathname === '/cadastro') {
            return NextResponse.redirect(new URL('/dashboard', request.url))
        }

        // Bloquear acesso a /admin para não-admins
        if (pathname.startsWith('/admin')) {
            return NextResponse.redirect(new URL('/dashboard', request.url))
        }

        // ── Subscription Guard (apenas para /dashboard/*) ────────────────────
        if (pathname.startsWith('/dashboard')) {
            try {
                const supabaseAdmin = createClient(
                    process.env.NEXT_PUBLIC_SUPABASE_URL!,
                    process.env.SUPABASE_SERVICE_ROLE_KEY!,
                    {
                        auth: { autoRefreshToken: false, persistSession: false },
                    }
                )

                // Buscar subscription mais recente
                const { data: subscription } = await supabaseAdmin
                    .from('subscriptions')
                    .select('status, trial_ends_at, is_lifetime')
                    .eq('user_id', user.id)
                    .order('created_at', { ascending: false })
                    .limit(1)
                    .single()

                let hasAccess = false

                if (subscription) {
                    // Lifetime = sempre ativo
                    if (subscription.is_lifetime) {
                        hasAccess = true
                    }
                    // Ativo
                    else if (subscription.status === 'active') {
                        hasAccess = true
                    }
                    // Trial ainda válido
                    else if (
                        subscription.status === 'trialing' &&
                        subscription.trial_ends_at &&
                        new Date(subscription.trial_ends_at) > new Date()
                    ) {
                        hasAccess = true
                    }
                }

                if (!hasAccess) {
                    return NextResponse.redirect(new URL('/escolher-plano', request.url))
                }
            } catch (error) {
                console.error('[Middleware] Erro ao verificar subscription:', error)
                // Em caso de erro, permitir acesso para não bloquear o uso
            }
        }
    }

    return supabaseResponse
}

export const config = {
    matcher: [
        '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
    ],
}
