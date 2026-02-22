import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { NextResponse, type NextRequest } from 'next/server'
import { isMasterAdminEmail } from '@/lib/admin'

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
    const publicRoutes = ['/', '/login', '/cadastro', '/auth/callback', '/auth/confirm', '/privacidade', '/termos', '/escolher-plano']
    const isPublicRoute = publicRoutes.some(r => {
        // Trata a rota raiz exatamente
        if (r === '/') return pathname === '/'
        return pathname.startsWith(r)
    })

    // ── Usuário NÃO autenticado ──────────────────────────────────────────────
    if (!user && !isPublicRoute) {
        return NextResponse.redirect(new URL('/login', request.url))
    }

    // ── Usuário AUTENTICADO ──────────────────────────────────────────────────
    if (user) {
        const isAdmin = isMasterAdminEmail(user.email)

        // ══════════════════════════════════════════════════════════════════════
        // ── MASTER ADMIN: dono do SaaS — NUNCA entra no sistema como cliente
        // ══════════════════════════════════════════════════════════════════════
        if (isAdmin) {
            // Qualquer rota que NÃO seja /admin/* → redireciona para /admin
            // O dono do SaaS vive exclusivamente no painel administrativo
            if (!pathname.startsWith('/admin')) {
                return NextResponse.redirect(new URL('/admin', request.url))
            }

            // Já está em /admin/* → acesso liberado
            return supabaseResponse
        }

        // ══════════════════════════════════════════════════════════════════════
        // ── USUÁRIO NORMAL: cliente do SaaS
        // ══════════════════════════════════════════════════════════════════════

        // Redirecionar rotas de autenticação para /dashboard se já estiver logado
        if (pathname === '/login' || pathname === '/cadastro') {
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
                let isTrialExpired = false

                if (subscription) {
                    if (subscription.is_lifetime) {
                        hasAccess = true
                    } else if (subscription.status === 'active') {
                        hasAccess = true
                    } else if (subscription.status === 'trialing' && subscription.trial_ends_at) {
                        if (new Date(subscription.trial_ends_at) > new Date()) {
                            hasAccess = true
                        } else {
                            isTrialExpired = true
                        }
                    }
                }

                if (!hasAccess) {
                    if (isTrialExpired) {
                        return NextResponse.redirect(new URL('/escolher-plano?reason=trial_expired&force_checkout=true', request.url))
                    }
                    return NextResponse.redirect(new URL('/escolher-plano', request.url))
                }
            } catch (error) {
                console.error('[Middleware] Erro ao verificar subscription:', error)
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
