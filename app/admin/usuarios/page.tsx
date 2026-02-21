import { listAllUsersWithSubscriptions } from '@/actions/subscription'
import { AdminUsersTable } from './users-table'

export const dynamic = 'force-dynamic'

export const metadata = {
    title: 'Usuários | Admin NF-e Ágil',
}

export default async function AdminUsuariosPage() {
    const users = await listAllUsersWithSubscriptions()

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold tracking-tight">Usuários</h1>
                <p className="text-sm text-white/40 mt-1">
                    Gerenciar todos os usuários do sistema — {users.length} registros
                </p>
            </div>
            <AdminUsersTable users={users} />
        </div>
    )
}
