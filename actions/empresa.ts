'use server'

import { revalidatePath } from 'next/cache'
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
import { z } from 'zod'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { getOwnerUserId } from '@/lib/get-owner-id'

// ── Helper: verificar role admin ─────────────────────────────────────────

async function checkAdminPermission(): Promise<{ userId: string } | { error: string }> {
    const cookieStore = await cookies()
    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                getAll: () => cookieStore.getAll(),
                setAll: () => { },
            },
        }
    )
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: 'Você precisa estar autenticado.' }

    const { data: profile } = await supabaseAdmin
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()

    if (!profile) return { error: 'Perfil não encontrado.' }
    if (profile.role !== 'admin') {
        return { error: 'Apenas administradores podem editar os dados da empresa.' }
    }

    return { userId: user.id }
}


// ── Schema de validação ───────────────────────────────────────────────────────

const empresaSchema = z.object({
    cnpj: z.string().min(14, 'CNPJ inválido').max(18),
    razaoSocial: z.string().min(3, 'Razão social obrigatória'),
    nomeFantasia: z.string().optional().nullable(),
    inscricaoEstadual: z.string().optional().nullable(),
    regimeTributario: z.enum(['simples', 'lucro_presumido', 'lucro_real']).default('simples'),
})

export type EmpresaForm = z.infer<typeof empresaSchema>

export type EmpresaData = EmpresaForm & {
    id: string
    ativo: boolean
    updatedAt: string
    certificadoId?: string | null
    certificadoValidade?: string | null // ISO string
}

export type SaveEmpresaResult =
    | { success: true; empresa: EmpresaData }
    | { success: false; error: string }

// ── Buscar empresa ativa ──────────────────────────────────────────────────────

export async function getEmpresaAtiva(): Promise<EmpresaData | null> {
    // getOwnerUserId resolve o grupo: se usuário foi criado por admin,
    // retorna o ID do admin (dono dos dados). Assim toda a equipe vê a mesma empresa.
    const ownerUserId = await getOwnerUserId()
    if (!ownerUserId) return null

    const { data, error } = await supabaseAdmin
        .from('empresas')
        .select(`
            *,
            certificados (
                id,
                validade,
                status
            )
        `)
        .eq('ativo', true)
        .eq('user_id', ownerUserId)
        .order('created_at', { ascending: false })
        .limit(1)
        .single()

    if (error || !data) return null

    const cert = Array.isArray(data.certificados) ? data.certificados[0] : data.certificados

    return {
        id: data.id,
        cnpj: data.cnpj,
        razaoSocial: data.razao_social,
        nomeFantasia: data.nome_fantasia ?? null,
        inscricaoEstadual: data.inscricao_estadual ?? null,
        regimeTributario: (data.regime_tributario as EmpresaForm['regimeTributario']) ?? 'simples',
        ativo: data.ativo,
        updatedAt: data.updated_at,
        certificadoId: cert?.id ?? null,
        certificadoValidade: cert?.validade ?? null,
    }
}

// ── Criar ou atualizar empresa ────────────────────────────────────────────────

export async function saveEmpresa(
    formData: FormData
): Promise<SaveEmpresaResult> {
    const raw = {
        cnpj: formData.get('cnpj') as string,
        razaoSocial: formData.get('razaoSocial') as string,
        nomeFantasia: formData.get('nomeFantasia') as string | null,
        inscricaoEstadual: formData.get('inscricaoEstadual') as string | null,
        regimeTributario: (formData.get('regimeTributario') as string) || 'simples',
    }

    const parsed = empresaSchema.safeParse(raw)
    if (!parsed.success) {
        const msg = parsed.error.issues.map((e: z.ZodIssue) => e.message).join(', ')
        return { success: false, error: msg }
    }


    const values = parsed.data
    const cnpjClean = values.cnpj.replace(/\D/g, '')

    // Verificar permissão de admin
    const permCheck = await checkAdminPermission()
    if ('error' in permCheck) return { success: false, error: permCheck.error }
    const userId = permCheck.userId

    // Upsert por CNPJ (cria se não existe, atualiza se já existe)
    const { data, error } = await supabaseAdmin
        .from('empresas')
        .upsert(
            {
                cnpj: cnpjClean,
                razao_social: values.razaoSocial,
                nome_fantasia: values.nomeFantasia || null,
                inscricao_estadual: values.inscricaoEstadual || null,
                regime_tributario: values.regimeTributario,
                ativo: true,
                user_id: userId,
            },
            { onConflict: 'cnpj' }
        )
        .select()
        .single()

    if (error || !data) {
        console.error('Erro ao salvar empresa:', error)
        return { success: false, error: 'Erro ao salvar os dados da empresa.' }
    }

    revalidatePath('/dashboard/cnpj')

    return {
        success: true,
        empresa: {
            id: data.id,
            cnpj: data.cnpj,
            razaoSocial: data.razao_social,
            nomeFantasia: data.nome_fantasia ?? null,
            inscricaoEstadual: data.inscricao_estadual ?? null,
            regimeTributario: data.regime_tributario as EmpresaForm['regimeTributario'],
            ativo: data.ativo,
            updatedAt: data.updated_at,
            certificadoId: data.certificado_id ?? null,
            certificadoValidade: null,
        },
    }
}
