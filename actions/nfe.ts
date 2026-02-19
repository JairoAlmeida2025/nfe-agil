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

async function ensureXmlBucket() {
    const { data: buckets } = await supabaseAdmin.storage.listBuckets()
    const bucketExists = buckets?.some(b => b.id === 'xml')
    if (!bucketExists) {
        await supabaseAdmin.storage.createBucket('xml', { public: false })
    }
}

async function uploadXmlToStorage(chave: string, xmlContent: string): Promise<string | null> {
    try {
        const path = `xml/${chave}.xml`
        const { error } = await supabaseAdmin.storage
            .from('xml')
            .upload(path, xmlContent, {
                contentType: 'text/xml',
                upsert: true
            })

        if (error) {
            console.error(`Erro upload XML ${chave}:`, error)
            return null
        }
        return path
    } catch (e) {
        console.error(`Exceção upload XML ${chave}:`, e)
        return null
    }
}

async function processAutoManifestation(userId: string, cnpj: string) {
    const microUrl = process.env.MICRO_SEFAZ_URL || 'http://localhost:3001'

    // Buscar notas pendentes de manifestação
    const { data: pendentes } = await supabaseAdmin
        .from('nfes')
        .select('id, chave')
        .eq('user_id', userId)
        .eq('empresa_cnpj', cnpj)
        .eq('status', 'recebida')
        .is('manifestacao', null)
        .limit(20) // Lote pequeno por execução

    if (!pendentes || pendentes.length === 0) return

    console.log(`[AutoManifest] Encontradas ${pendentes.length} notas para ciência.`)

    for (const nfe of pendentes) {
        try {
            const resp = await fetch(`${microUrl}/sefaz/manifestacao`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ cnpj, chave: nfe.chave, tipoEvento: '210210' })
            })

            if (!resp.ok) continue

            const resBody = await resp.json()

            // 135: Vinculado, 136: Já registrado
            if (resBody.cStat === '135' || resBody.cStat === '136') {
                await supabaseAdmin.from('nfes')
                    .update({
                        manifestacao: 'ciencia',
                        data_manifestacao: new Date().toISOString()
                    })
                    .eq('id', nfe.id)
                console.log(`[AutoManifest] Sucesso ${nfe.chave}: ${resBody.xMotivo}`)
            } else {
                console.warn(`[AutoManifest] Falha ${nfe.chave}: ${resBody.cStat} - ${resBody.xMotivo}`)
            }
        } catch (e) {
            console.error(`[AutoManifest] Erro ${nfe.chave}:`, e)
        }
    }
}

// ── Core Sync Logic (Shared by Action and Cron) ───────────────────────────────

export type SyncResult =
    | { success: true; importadas: number; message: string }
    | { success: false; error: string }

export async function processSefazSync(userId: string, cnpjInput: string): Promise<SyncResult> {
    const cnpj = cnpjInput.replace(/\D/g, '')
    const microUrl = process.env.MICRO_SEFAZ_URL || 'http://localhost:3001'

    // Buscar último NSU
    const { data: syncState } = await supabaseAdmin
        .from('nfe_sync_state')
        .select('ultimo_nsu')
        .eq('user_id', userId)
        .eq('empresa_cnpj', cnpj)
        .single()

    const ultNSU = String(syncState?.ultimo_nsu ?? 0)

    try {
        await ensureXmlBucket()

        console.log(`[Sync] Iniciando sync para user=${userId} cnpj=${cnpj} NSU=${ultNSU}`)

        const response = await fetch(`${microUrl}/sefaz/distdfe`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ cnpj, ultNSU }),
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

        const data = await response.json()
        const documentos = data.documentos || []

        console.log(`[Sync] Recebido ${documentos.length} documentos. Processando...`)

        let processados = 0

        for (const doc of documentos) {
            const { schema, xml, nsu } = doc
            const nsuInt = parseInt(nsu)

            try {
                let chave = ''
                let status = ''

                if (schema.includes('resNFe')) {
                    chave = extrairTag(xml, 'chNFe')
                    status = 'recebida'
                } else if (schema.includes('procNFe')) {
                    chave = extrairTag(xml, 'chNFe') || extrairAttr(xml, 'infNFe', 'Id')?.replace('NFe', '')
                    status = 'xml_disponivel'
                } else if (schema.includes('procEventoNFe') || schema.includes('resEvento')) {
                    const tpEvento = extrairTag(xml, 'tpEvento')
                    const chNFe = extrairTag(xml, 'chNFe')
                    if (tpEvento === '110111' || tpEvento === '110110') {
                        console.log(`[Sync] Evento ${tpEvento} para ${chNFe}`)
                        await supabaseAdmin.from('nfes')
                            .update({ status: 'cancelada' })
                            .eq('chave', chNFe)
                            .eq('user_id', userId)
                    }
                    processados++
                    continue
                }

                if (!chave) continue

                const { data: existingSafe } = await supabaseAdmin
                    .from('nfes')
                    .select('id, status, xml_url')
                    .eq('chave', chave)
                    .maybeSingle()

                if (schema.includes('resNFe')) {
                    if (!existingSafe) {
                        const dhEmi = extrairTag(xml, 'dhEmi')
                        const xNome = extrairTag(xml, 'xNome')
                        const vNF = extrairTag(xml, 'vNF')
                        const cSitNFe = extrairTag(xml, 'cSitNFe')
                        const cUF = extrairTag(xml, 'cUF')

                        let st = 'recebida'
                        if (cSitNFe === '3') st = 'cancelada'

                        await supabaseAdmin.from('nfes').insert({
                            user_id: userId,
                            empresa_cnpj: cnpj,
                            chave,
                            nsu: nsuInt,
                            emitente: xNome,
                            valor: parseFloat(vNF) || 0,
                            data_emissao: dhEmi ? new Date(dhEmi).toISOString() : new Date().toISOString(),
                            status: st,
                            schema_tipo: 'resNFe',
                            uf_emitente: cUF,
                        })
                    }
                } else if (schema.includes('procNFe')) {
                    const xmlPath = await uploadXmlToStorage(chave, xml)

                    const emit = extrairTag(xml, 'emit')
                    const xNome = extrairTag(emit, 'xNome')
                    const ide = extrairTag(xml, 'ide')
                    const dhEmi = extrairTag(ide, 'dhEmi') || extrairTag(ide, 'dEmi')
                    const nNF = extrairTag(ide, 'nNF')
                    const total = extrairTag(xml, 'total')
                    const vNF = extrairTag(total, 'vNF')

                    const upsertData = {
                        user_id: userId,
                        empresa_cnpj: cnpj,
                        chave,
                        nsu: nsuInt,
                        numero: nNF,
                        emitente: xNome,
                        valor: parseFloat(vNF) || 0,
                        data_emissao: dhEmi ? new Date(dhEmi).toISOString() : new Date().toISOString(),
                        status: 'xml_disponivel',
                        schema_tipo: 'procNFe',
                        xml_content: xml,
                        xml_url: xmlPath
                    }

                    await supabaseAdmin.from('nfes').upsert(upsertData, { onConflict: 'chave' })
                }

                processados++

            } catch (e) {
                console.error(`Erro processando doc NSU ${nsu}:`, e)
            }
        }

        const novoUltNSU = parseInt(data.ultNSU || ultNSU)
        if (novoUltNSU > parseInt(ultNSU)) {
            await supabaseAdmin.from('nfe_sync_state').upsert({
                user_id: userId,
                empresa_cnpj: cnpj,
                ultimo_nsu: novoUltNSU,
                ultima_sync: new Date().toISOString()
            }, { onConflict: 'user_id,empresa_cnpj' })
        }

        // Tentar manifestação automática
        await processAutoManifestation(userId, cnpj)

        return {
            success: true,
            importadas: processados,
            message: `Sincronização concluída. ${processados} documentos atualizados.`
        }

    } catch (err: any) {
        console.error('[Sync] Erro:', err)
        return { success: false, error: `Erro de conexão: ${err.message}` }
    }
}

// ── Server Action principal (Consome Micro-Serviço) ───────────────────────────

export async function syncNFesFromSEFAZ(): Promise<SyncResult> {
    const user = await getAuthUser()
    if (!user) return { success: false, error: 'Não autenticado.' }

    const { data: empresa } = await supabaseAdmin
        .from('empresas')
        .select('cnpj')
        .eq('user_id', user.id)
        .eq('ativo', true)
        .single()

    if (!empresa) return { success: false, error: 'Nenhuma empresa configurada.' }

    const result = await processSefazSync(user.id, empresa.cnpj)

    // Revalidar só no Action
    revalidatePath('/dashboard')
    revalidatePath('/dashboard/nfe')

    return result
}

// ── Listar NF-es (Mantidas) ───────────────────────────────────────────────────

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

// ── Métricas e Status (Mantidas) ──────────────────────────────────────────────

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
        supabaseAdmin.from('nfes').select('id', { count: 'exact', head: true }).eq('user_id', user.id).is('xml_url', null).neq('status', 'cancelada'),
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
