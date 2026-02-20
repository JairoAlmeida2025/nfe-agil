import { NextRequest, NextResponse } from 'next/server'
import { processSefazSync } from '@/actions/nfe'

const INTERNAL_SYNC_SECRET = process.env.INTERNAL_SYNC_SECRET ?? 'nfe-agil-cron-2025'

export async function POST(req: NextRequest) {
    // Validar secret interno
    const secret = req.headers.get('x-internal-secret')
    if (secret !== INTERNAL_SYNC_SECRET) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    try {
        const body = await req.json()
        const { userId, cnpj } = body

        if (!userId || !cnpj) {
            return NextResponse.json({ error: 'userId e cnpj são obrigatórios' }, { status: 400 })
        }

        console.log(`[AutoSync API] Iniciando sync para user=${userId} cnpj=${cnpj}`)
        const result = await processSefazSync(userId, cnpj)
        console.log(`[AutoSync API] Resultado:`, result)

        return NextResponse.json(result)
    } catch (err: any) {
        console.error('[AutoSync API] Erro:', err)
        return NextResponse.json({ success: false, error: err.message }, { status: 500 })
    }
}
