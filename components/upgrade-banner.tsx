'use client'

import Link from 'next/link'
import { Lock, ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface UpgradeBannerProps {
    feature?: string
}

/**
 * Banner centralizado premium exibido quando um usuário Starter
 * tenta acessar features exclusivas do Pro.
 */
export function UpgradeBanner({ feature }: UpgradeBannerProps) {
    return (
        <div className="flex flex-1 items-center justify-center min-h-[60vh]">
            <div className="text-center max-w-md space-y-6 p-8">
                <div className="mx-auto w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                    <Lock className="h-8 w-8 text-primary" />
                </div>

                <div className="space-y-2">
                    <h2 className="text-2xl font-bold tracking-tight">
                        Funcionalidade Exclusiva do Plano Pro
                    </h2>
                    {feature && (
                        <p className="text-muted-foreground">
                            <strong>{feature}</strong> está disponível apenas no plano Pro.
                        </p>
                    )}
                    <p className="text-muted-foreground text-sm">
                        Faça upgrade para acessar 100% da plataforma, incluindo
                        monitoramento automático SEFAZ, manifestação eletrônica,
                        download em lote e muito mais.
                    </p>
                </div>

                <Button size="lg" asChild className="w-full sm:w-auto">
                    <Link href="/escolher-plano?upgrade=true">
                        Fazer Upgrade para o Pro
                        <ArrowRight className="ml-2 h-5 w-5" />
                    </Link>
                </Button>
            </div>
        </div>
    )
}
