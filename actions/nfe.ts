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
    const MAX_LOOPS = 50
    let loopCount = 0
    let totalImportadas = 0

    // 1. Lock: Verificar execução concorrente recente (< 5 min) sem fim
    const { data: activeJob } = await supabaseAdmin
        .from('nfe_job_logs')
        .select('id')
        .eq('tipo_job', 'sync')
        .is('fim', null)
        .gt('inicio', new Date(Date.now() - 5 * 60 * 1000).toISOString())
        .limit(1)
        .maybeSingle()

    if (activeJob) {
        console.warn(`[Sync] Job bloqueado: ${activeJob.id} ainda em execução.`)
        return { success: false, error: 'Job de sincronização já está em execução.' }
    }

    // 2. Verificar Certificado (Health Check)
    try {
        const certRes = await fetch(`${microUrl}/sefaz/status`, { cache: 'no-store' })
        if (!certRes.ok) throw new Error('Falha ao verificar certificado')
        const certStatus = await certRes.json()
        if (!certStatus.valid) {
            await supabaseAdmin.from('nfe_job_logs').insert({
                tipo_job: 'sync',
                sucesso: false,
                erro_resumido: `Certificado Inválido (Expira em: ${certStatus.expirationDate})`
            })
            return { success: false, error: 'Certificado digital expirado ou inválido.' }
        }
    } catch (e: any) {
        return { success: false, error: `Erro verificando certificado: ${e.message}` }
    }

    // Registrar inicio do Job
    const { data: jobLog } = await supabaseAdmin
        .from('nfe_job_logs')
        .insert({ tipo_job: 'sync', inicio: new Date().toISOString() })
        .select('id')
        .single()

    const jobId = jobLog?.id

    try {
        await ensureXmlBucket()

        let hasMore = true
        let currentUltNSU = '0'

        // Buscar último NSU inicial
        const { data: syncState } = await supabaseAdmin
            .from('nfe_sync_state')
            .select('ultimo_nsu')
            .eq('user_id', userId)
            .eq('empresa_cnpj', cnpj)
            .single()
        currentUltNSU = String(syncState?.ultimo_nsu ?? 0)

        console.log(`[Sync] Iniciando job ${jobId} para CNPJ ${cnpj} NSU ${currentUltNSU}`)

        while (hasMore && loopCount < MAX_LOOPS) {
            loopCount++

            console.log(`[Sync] Loop ${loopCount}/${MAX_LOOPS} - Buscando NSU > ${currentUltNSU}`)

            const response = await fetch(`${microUrl}/sefaz/distdfe`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ cnpj, ultNSU: currentUltNSU }),
                cache: 'no-store'
            })

            if (!response.ok) {
                // Tenta extrair erro
                let detail = ''
                try { detail = (await response.json()).error } catch { }
                throw new Error(`Micro-Serviço HTTP ${response.status} ${detail}`)
            }

            const data = await response.json()
            const documentos = data.documentos || []
            const novoUltNSU = data.ultNSU // Último NSU consultado

            // Se documentos vazio E ultNSU não mudou -> Acabou
            if (documentos.length === 0 && novoUltNSU === currentUltNSU) {
                hasMore = false
            }

            // Processar Documentos
            let loteImportado = 0
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
                        // Validação XML de Integridade
                        if (!xml.includes('<NFe') || !xml.includes('</NFe>')) {
                            console.warn(`[Sync] XML Inválido/Corrompido NSU ${nsu}`)
                            continue
                        }
                        chave = extrairTag(xml, 'chNFe') || extrairAttr(xml, 'infNFe', 'Id')?.replace('NFe', '')
                        status = 'xml_disponivel'
                    } else if (schema.includes('procEventoNFe') || schema.includes('resEvento')) {
                        const tpEvento = extrairTag(xml, 'tpEvento')
                        const chNFe = extrairTag(xml, 'chNFe')
                        if (tpEvento === '110111' || tpEvento === '110110') {
                            await supabaseAdmin.from('nfes')
                                .update({ status: 'cancelada' })
                                .eq('chave', chNFe)
                                .eq('user_id', userId)
                        }
                        loteImportado++
                        continue
                    }

                    if (!chave) continue

                    const { data: existingSafe } = await supabaseAdmin
                        .from('nfes')
                        .select('id')
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
                    loteImportado++
                } catch (e) {
                    console.error(`Erro processando doc NSU ${nsu}:`, e)
                }
            } // end for

            totalImportadas += loteImportado

            // Atualizar Sync State se avançou NSU
            if (parseInt(novoUltNSU) > parseInt(currentUltNSU)) {
                await supabaseAdmin.from('nfe_sync_state').upsert({
                    user_id: userId,
                    empresa_cnpj: cnpj,
                    ultimo_nsu: parseInt(novoUltNSU),
                    ultima_sync: new Date().toISOString()
                }, { onConflict: 'user_id,empresa_cnpj' })

                currentUltNSU = novoUltNSU
            } else {
                hasMore = false
            }

            if (documentos.length < 50) hasMore = false
        }

        // Tentar manifestação automática
        await processAutoManifestation(userId, cnpj)

        // Log Sucesso
        if (jobId) {
            await supabaseAdmin.from('nfe_job_logs').update({
                fim: new Date().toISOString(),
                sucesso: true,
                total_processado: totalImportadas,
                erro_resumido: null
            }).eq('id', jobId)
        }

        return {
            success: true,
            importadas: totalImportadas,
            message: `Sincronização concluída. ${totalImportadas} documentos em ${loopCount} lotes.`
        }

    } catch (err: any) {
        console.error('[Sync] Erro Fatal:', err)
        if (jobId) {
            await supabaseAdmin.from('nfe_job_logs').update({
                fim: new Date().toISOString(),
                sucesso: false,
                erro_resumido: err.message
            }).eq('id', jobId)
        }
        return { success: false, error: `Erro de sincronização: ${err.message}` }
    }
}

// ── Server Action principal ───────────────────────────────────────────────────

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

    revalidatePath('/dashboard')
    revalidatePath('/dashboard/nfe')

    return result
}

// ── Listar NF-es ──────────────────────────────────────────────────────────────

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

// ── Métricas e Status ─────────────────────────────────────────────────────────

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

export async function getFiscalHealthStatus() {
    const microUrl = process.env.MICRO_SEFAZ_URL || 'http://localhost:3001'
    let certificado = { valid: false, expirationDate: null, daysRemaining: 0, issuer: '' }
    let error = null

    try {
        const res = await fetch(`${microUrl}/sefaz/status`, { next: { revalidate: 60 } })
        if (res.ok) {
            const data = await res.json()
            certificado = data
        }
    } catch (e: any) {
        error = e.message
    }

    // Ultimo Job e Erro
    const { data: lastJob } = await supabaseAdmin
        .from('nfe_job_logs')
        .select('sucesso, fim, erro_resumido, created_at')
        .eq('tipo_job', 'sync')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

    return {
        certificado,
        lastJob,
        serviceError: error,
        ultimaSync: lastJob?.created_at ?? null,
        erroUltimaExecucao: lastJob?.sucesso === false
    }
}

export interface DashboardMetrics {
    totalNotasMes: number
    valorTotalMes: number
    totalXmlDisponivel: number
    totalPendentes: number
    ultimaSync: string | null
    integracaoStatus: 'ativa' | 'sem_certificado' | 'nunca_sincronizado'
}

export async function getDashboardMetrics(): Promise<DashboardMetrics> {
    const user = await getAuthUser()
    const emptyMetrics: DashboardMetrics = {
        totalNotasMes: 0,
        valorTotalMes: 0,
        totalXmlDisponivel: 0,
        totalPendentes: 0,
        ultimaSync: null,
        integracaoStatus: 'sem_certificado'
    }

    if (!user) return emptyMetrics

    const now = new Date()
    const inicioMes = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
    const fimMes = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59).toISOString()

    const [nfesMes, syncState] = await Promise.all([
        supabaseAdmin.from('nfes')
            .select('valor, status')
            .eq('user_id', user.id)
            .gte('data_emissao', inicioMes)
            .lte('data_emissao', fimMes),
        supabaseAdmin.from('nfe_sync_state')
            .select('ultima_sync')
            .eq('user_id', user.id)
            .single()
    ])

    const notas = nfesMes.data || []

    // Calcular Métricas
    const totalNotasMes = notas.length
    const valorTotalMes = notas.reduce((acc, curr) => acc + (curr.valor || 0), 0)
    const totalXmlDisponivel = notas.filter(n => n.status === 'xml_disponivel').length
    const totalPendentes = notas.filter(n => n.status === 'recebida').length

    const ultimaSync = syncState.data?.ultima_sync ?? null
    let integracaoStatus: DashboardMetrics['integracaoStatus'] = 'nunca_sincronizado'
    if (ultimaSync) integracaoStatus = 'ativa'

    return {
        totalNotasMes,
        valorTotalMes,
        totalXmlDisponivel,
        totalPendentes,
        ultimaSync,
        integracaoStatus
    }
}
