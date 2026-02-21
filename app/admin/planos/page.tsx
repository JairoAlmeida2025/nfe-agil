import { listAllPlans } from '@/actions/subscription'
import { PlansManager } from './plans-manager'

export const dynamic = 'force-dynamic'

export const metadata = {
    title: 'Planos | Admin NF-e Ágil',
}

export default async function AdminPlanosPage() {
    const plans = await listAllPlans()

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold tracking-tight">Planos</h1>
                <p className="text-sm text-white/40 mt-1">
                    Gerenciar planos do sistema — CRUD completo
                </p>
            </div>
            <PlansManager plans={plans} />
        </div>
    )
}
