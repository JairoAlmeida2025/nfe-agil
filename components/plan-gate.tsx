'use client'

import { useState, useEffect, ReactNode } from 'react'
import { UpgradeBanner } from '@/components/upgrade-banner'
import { Loader2 } from 'lucide-react'

/**
 * Wrapper client-side: verifica se o usuário está no Starter
 * e exibe UpgradeBanner ao invés do conteúdo da página.
 *
 * Uso: <PlanGate feature="Certificado Digital">{children}</PlanGate>
 */
export function PlanGate({ feature, children }: { feature: string; children: ReactNode }) {
    const [isStarter, setIsStarter] = useState<boolean | null>(null)

    useEffect(() => {
        fetch('/api/converter') // GET retorna plan info
            .then(r => r.json())
            .then(data => {
                setIsStarter(data.plan === 'starter')
            })
            .catch(() => setIsStarter(false))
    }, [])

    if (isStarter === null) {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
        )
    }

    if (isStarter) {
        return <UpgradeBanner feature={feature} />
    }

    return <>{children}</>
}
