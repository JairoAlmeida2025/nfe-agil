'use server'

import { revalidatePath } from 'next/cache'
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
import { supabaseAdmin } from '@/lib/supabase-admin'

// ── Helpers ───────────────────────────────────────────────────────────────────

async function getAuthUser() {
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
    return user
}

function extrairTag(xml: string, tag: string): string {
    const match = xml.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`))
    return match?.[1]?.trim() ?? ''
}

function extrairAttr(xml: string, tag: string, attr: string): string {
    const match = xml.match(new RegExp(`<${tag}[^>]*${attr}="([^"]*)"[^>]*>`))
    return match?.[1] ?? ''
}

// ── Server Action principal (Consome Micro-Serviço) ───────────────────────────

export type SyncResult =
    | { success: true; importadas: number; message: string }
    | { success: false; error: string }

export async function syncNFesFromSEFAZ(): Promise<SyncResult> {
    const user = await getAuthUser()
    if (!user) return { success: false, error: 'Não autenticado.' }

    // Buscar empresa ativa
    const { data: empresa } = await supabaseAdmin
        .from('empresas')
        .select('cnpj')
        .eq('user_id', user.id)
        .eq('ativo', true)
        .single()

    if (!empresa) {
        return { success: false, error: 'Nenhuma empresa configurada.' }
    }

    const cnpj = empresa.cnpj.replace(/\D/g, '')

    // Buscar último NSU
    const { data: syncState } = await supabaseAdmin
        .from('nfe_sync_state')
        .select('ultimo_nsu')
        .eq('user_id', user.id)
        .eq('empresa_cnpj', cnpj)
        .single()

    const ultNSU = String(syncState?.ultimo_nsu ?? 0)

    const microUrl = process.env.MICRO_SEFAZ_URL || 'http://localhost:3001'

    try {
        console.log(`[Next.js] Chamando Micro-Serviço em ${microUrl}/sefaz/distdfe para CNPJ ${cnpj} NSU ${ultNSU}...`)

        const response = await fetch(`${microUrl}/sefaz/distdfe`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                cnpj,
                ultNSU
            }),
            cache: 'no-store'
        })

        if (!response.ok) {
            let errorMsg = `Erro HTTP ${response.status}`
            try {
                const errBody = await response.json()
                if (errBody.error) errorMsg = errBody.error
            } catch { }
            return { success: false, error: `Falha no Micro-Serviço SEFAZ: ${errorMsg}` }
        }

        const data = await response.json() // { documentos: [], ultNSU: string }

        const documentos = data.documentos || []
        let importadas = 0

        console.log(`[Next.js] Recebido ${documentos.length} documentos. Processando...`)

        // Persistir no Supabase
        for (const doc of documentos) {
            const { schema, xml, nsu } = doc
            const nsuInt = parseInt(nsu)

            try {
                if (schema.includes('resNFe')) {
                    const chave = extrairTag(xml, 'chNFe')
                    const dhEmi = extrairTag(xml, 'dhEmi')
                    const xNome = extrairTag(xml, 'xNome')
                    const vNF = extrairTag(xml, 'vNF')
                    const cSitNFe = extrairTag(xml, 'cSitNFe')
                    const cUF = extrairTag(xml, 'cUF')

                    let status = 'recebida'
                    if (cSitNFe === '3') status = 'cancelada'
                    if (cSitNFe === '2') status = 'denegada'

                    await supabaseAdmin.from('nfes').upsert({
                        user_id: user.id,
                        empresa_cnpj: cnpj,
                        chave,
                        nsu: nsuInt,
                        emitente: xNome,
                        valor: parseFloat(vNF) || 0,
                        data_emissao: dhEmi ? new Date(dhEmi).toISOString() : new Date().toISOString(),
                        status: status,
                        schema_tipo: 'resNFe',
                        uf_emitente: cUF,
                    }, { onConflict: 'chave' })

                } else if (schema.includes('procNFe')) {
                    const chave = extrairTag(xml, 'chNFe') || extrairAttr(xml, 'infNFe', 'Id')?.replace('NFe', '')
                    const emit = extrairTag(xml, 'emit')
                    const xNome = extrairTag(emit, 'xNome')
                    const ide = extrairTag(xml, 'ide')
                    const dhEmi = extrairTag(ide, 'dhEmi') || extrairTag(ide, 'dEmi') || extrairTag(xml, 'dhEmi')
                    const nNF = extrairTag(ide, 'nNF')
                    const total = extrairTag(xml, 'total')
                    const vNF = extrairTag(total, 'vNF') || extrairTag(xml, 'vNF') // Fallback

                    await supabaseAdmin.from('nfes').upsert({
                        user_id: user.id,
                        empresa_cnpj: cnpj,
                        chave,
                        nsu: nsuInt,
                        numero: nNF,
                        emitente: xNome,
                        valor: parseFloat(vNF) || 0,
                        data_emissao: dhEmi ? new Date(dhEmi).toISOString() : new Date().toISOString(),
                        status: 'autorizada',
                        schema_tipo: 'procNFe',
                        xml_content: xml
                    }, { onConflict: 'chave' })
                }

                if (schema.includes('procEventoNFe') || schema.includes('resEvento')) {
                    const tpEvento = extrairTag(xml, 'tpEvento')
                    const chNFe = extrairTag(xml, 'chNFe')
                    if (tpEvento === '110111') { // Cancelamento
                        await supabaseAdmin.from('nfes').update({ status: 'cancelada' }).eq('chave', chNFe)
                    }
                }

                importadas++
            } catch (e) {
                console.error(`Erro ao salvar doc NSU ${nsu}:`, e)
            }
        }

        // Atualizar estado de sincronização com o ultNSU final retornado pelo serviço
        const novoUltNSU = parseInt(data.ultNSU || ultNSU)
        if (novoUltNSU > parseInt(ultNSU)) {
            await supabaseAdmin.from('nfe_sync_state').upsert({
                user_id: user.id,
                empresa_cnpj: cnpj,
                ultimo_nsu: novoUltNSU,
                ultima_sync: new Date().toISOString()
            }, { onConflict: 'user_id,empresa_cnpj' })
        }

        revalidatePath('/dashboard')
        revalidatePath('/dashboard/nfe')

        return {
            success: true,
            importadas,
            message: `Sincronização concluída. ${importadas} documentos salvos.`
        }

    } catch (err: any) {
        console.error('[Next.js] Erro ao conectar ao Micro-Serviço:', err)
        return { success: false, error: `Erro de conexão: ${err.message}` }
    }
}

// ── Listar NF-es (Leitura direta do banco - Mantida) ──────────────────────────

export async function listNFes(params?: {
    dataInicio?: string
    dataFim?: string
}) {
    const user = await getAuthUser()
    if (!user) return []

    const now = new Date()
    const dataInicio = params?.dataInicio ?? new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
    const dataFim = params?.dataFim ?? new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59).toISOString()

    const { data, error } = await supabaseAdmin
        .from('nfes')
        .select('*')
        .eq('user_id', user.id)
        .gte('data_emissao', dataInicio)
        .lte('data_emissao', dataFim)
        .order('data_emissao', { ascending: false })

    if (error) return []
    return data
}

// ── Outras Funções (Metrics, etc - Mantidas) ──────────────────────────────────

export async function getLastSync(): Promise<string | null> {
    const user = await getAuthUser()
    if (!user) return null

    const { data } = await supabaseAdmin
        .from('nfe_sync_state')
        .select('ultima_sync')
        .eq('user_id', user.id)
        .limit(1)
        .single()

    return data?.ultima_sync ?? null
}

export interface DashboardMetrics {
    recebidosHoje: number
    pendentes: number
    totalMes: number
    ultimaSync: string | null
    integracaoStatus: 'ativa' | 'sem_certificado' | 'nunca_sincronizado'
}

export async function getDashboardMetrics(): Promise<DashboardMetrics> {
    const user = await getAuthUser()
    if (!user) {
        return {
            recebidosHoje: 0,
            pendentes: 0,
            totalMes: 0,
            ultimaSync: null,
            integracaoStatus: 'sem_certificado',
        }
    }

    const now = new Date()
    const inicioMes = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
    const fimMes = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59).toISOString()
    const inicioHoje = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString()
    const fimHoje = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59).toISOString()

    const [mesMes, hoje, pendentes, syncState] = await Promise.all([
        supabaseAdmin.from('nfes').select('id', { count: 'exact', head: true }).eq('user_id', user.id).gte('data_emissao', inicioMes).lte('data_emissao', fimMes),
        supabaseAdmin.from('nfes').select('id', { count: 'exact', head: true }).eq('user_id', user.id).gte('data_emissao', inicioHoje).lte('data_emissao', fimHoje),
        supabaseAdmin.from('nfes').select('id', { count: 'exact', head: true }).eq('user_id', user.id).is('xml_content', null).neq('status', 'cancelada'),
        supabaseAdmin.from('nfe_sync_state').select('ultima_sync').eq('user_id', user.id).single(),
    ])

    const ultimaSync = syncState.data?.ultima_sync ?? null
    let integracaoStatus: DashboardMetrics['integracaoStatus'] = 'nunca_sincronizado'
    if (ultimaSync) integracaoStatus = 'ativa'

    return {
        recebidosHoje: hoje.count ?? 0,
        pendentes: pendentes.count ?? 0,
        totalMes: mesMes.count ?? 0,
        ultimaSync,
        integracaoStatus,
    }
}
