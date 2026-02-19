'use server'

import { revalidatePath } from 'next/cache'
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { getCertificateCredentials } from './certificate'

// ── Helpers de Comunicação Fiscal ─────────────────────────────────────────────

async function fetchFiscal(path: string, options: RequestInit = {}) {
    let microUrl = process.env.MICRO_SEFAZ_URL
    if (!microUrl) throw new Error('MICRO_SEFAZ_URL não configurada na Vercel')
    if (microUrl.endsWith('/')) microUrl = microUrl.slice(0, -1)

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 10000) // 10s Timeout

    try {
        const headers: Record<string, string> = {
            'Content-Type': 'application/json',
            ...(options.headers as Record<string, string> || {})
        }

        if (process.env.FISCAL_SECRET) {
            headers['x-fiscal-secret'] = process.env.FISCAL_SECRET
        }

        const res = await fetch(`${microUrl}${path}`, {
            ...options,
            headers,
            signal: controller.signal,
            cache: 'no-store'
        })
        return res
    } catch (e: any) {
        if (e.name === 'AbortError') throw new Error('Timeout de conexão com Micro-serviço (10s)')
        throw e
    } finally {
        clearTimeout(timeoutId)
    }
}

async function checkFiscalConnectivity(): Promise<boolean> {
    const microUrl = process.env.MICRO_SEFAZ_URL
    try {
        // console.log(`[Health] Conectando: ${microUrl}/health`)

        if (!microUrl) {
            console.error("[Health] ERRO: MICRO_SEFAZ_URL não definida")
            return false
        }

        const res = await fetchFiscal('/health')

        console.log("[Health] Status:", res.status)
        console.log("[Health] OK:", res.ok)

        const text = await res.text()
        console.log("[Health] Body:", text)

        return res.ok
    } catch (err: any) {
        console.error("[Health] ERROR:", err)
        if (err.cause) console.error("[Health] Cause:", err.cause)
        return false
    }
}

// ── Helpers Gerais ────────────────────────────────────────────────────────────

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

async function processAutoManifestation(userId: string, cnpj: string, pfxBuffer: Buffer, passphrase: string) {
    // Buscar notas pendentes de manifestação
    const { data: pendentes } = await supabaseAdmin
        .from('nfes')
        .select('id, chave')
        .eq('user_id', userId)
        .eq('empresa_cnpj', cnpj)
        .eq('status', 'recebida')
        .is('manifestacao', null)
        .limit(20)

    if (!pendentes || pendentes.length === 0) return

    for (const nfe of pendentes) {
        try {
            const resp = await fetchFiscal('/sefaz/manifestacao', {
                method: 'POST',
                body: JSON.stringify({
                    cnpj,
                    chave: nfe.chave,
                    tipoEvento: '210210',
                    pfxBase64: pfxBuffer.toString('base64'),
                    passphrase
                })
            })

            if (!resp.ok) continue

            const resBody = await resp.json()

            if (resBody.cStat === '135' || resBody.cStat === '136') {
                await supabaseAdmin.from('nfes')
                    .update({
                        manifestacao: 'ciencia',
                        data_manifestacao: new Date().toISOString()
                    })
                    .eq('id', nfe.id)
            }
        } catch (e) {
            console.error(`[AutoManifest] Erro ${nfe.chave}:`, e)
        }
    }
}

// ── Core Sync Logic ──────────────────────────────────────────────────────────

export type SyncResult =
    | { success: true; importadas: number; message: string }
    | { success: false; error: string }

export async function processSefazSync(userId: string, cnpjInput: string): Promise<SyncResult> {
    const cnpj = cnpjInput.replace(/\D/g, '')
    const MAX_LOOPS = 50
    let loopCount = 0
    let totalImportadas = 0

    // 0. Pré-Check de Conectividade
    if (!(await checkFiscalConnectivity())) {
        return { success: false, error: 'Micro-serviço fiscal indisponível (Health Check falhou).' }
    }

    // 1. Lock
    const { data: activeJob } = await supabaseAdmin
        .from('nfe_job_logs')
        .select('id')
        .eq('tipo_job', 'sync')
        .is('fim', null)
        .gt('inicio', new Date(Date.now() - 5 * 60 * 1000).toISOString())
        .limit(1)
        .maybeSingle()

    if (activeJob) {
        return { success: false, error: 'Job de sincronização já está em execução.' }
    }

    // 2. Obter Credenciais do Certificado (Stateless)
    let pfxBuffer: Buffer
    let passphrase: string

    try {
        const creds = await getCertificateCredentials(userId)
        pfxBuffer = creds.pfxBuffer
        passphrase = creds.password
    } catch (e: any) {
        return { success: false, error: `Erro carregando certificado: ${e.message}` }
    }

    // Registrar Job
    const { data: jobLog } = await supabaseAdmin
        .from('nfe_job_logs')
        .insert({ tipo_job: 'sync', inicio: new Date().toISOString() })
        .select('id')
        .single()

    const jobId = jobLog?.id

    try {
        await ensureXmlBucket()

        // vFinal: Persistência real de NSU via Supabase (config_fiscal)
        console.log("🚀 vFinal – Persistência real de NSU via Supabase ativa");

        // Obter ID da empresa
        const { data: empresa } = await supabaseAdmin
            .from('empresas')
            .select('id')
            .eq('cnpj', cnpj)
            .eq('user_id', userId)
            .single()

        if (!empresa) throw new Error(`Empresa não encontrada para CNPJ ${cnpj}`)
        const empresaId = empresa.id

        // Ler NSU atual de config_fiscal
        let currentUltNSU = '0'
        const { data: cfg } = await supabaseAdmin
            .from('config_fiscal')
            .select('ult_nsu')
            .eq('empresa_id', empresaId)
            .maybeSingle() // maybeSingle para não quebrar se não existir config ainda

        if (cfg?.ult_nsu) {
            currentUltNSU = String(cfg.ult_nsu)
        } else {
            // Se não existe, cria
            await supabaseAdmin.from('config_fiscal').insert({ empresa_id: empresaId, ult_nsu: 0 }).select()
        }

        let hasMore = true
        while (hasMore && loopCount < MAX_LOOPS) {
            loopCount++

            console.log(`[Sync] Loop ${loopCount} - Chamando Micro-serviço (NSU: ${currentUltNSU})`)

            const response = await fetchFiscal('/sefaz/distdfe', {
                method: 'POST',
                body: JSON.stringify({
                    cnpj,
                    ultNSU: currentUltNSU,
                    pfxBase64: pfxBuffer.toString('base64'),
                    passphrase,
                    ambiente: 'producao'
                })
            })

            console.log(`[Sync] Micro-serviço HTTP Status: ${response.status}`)

            if (!response.ok) {
                let detail = ''
                let status = response.status
                try {
                    const errBody = await response.json()
                    detail = errBody.error
                    // Tratamento específico 656 (Consumo Indevido)
                    if (status === 429 || errBody.cStat === '656') {
                        console.warn(`[Sync] BLOQUEIO 656: ${detail}`)
                        // Não reseta NSU. Retorna erro controlado.
                        return { success: false, error: 'Consumo indevido (656). Aguarde 1 hora.' }
                    }
                } catch { }
                console.error(`[Sync] ERRO REQUISIÇÃO: ${status} - ${detail}`)
                throw new Error(`Micro-Serviço HTTP ${status} ${detail}`)
            }

            const data = await response.json()
            const documentos = data.documentos || []
            const novoUltNSU = data.ultNSU
            const cStat = data.cStat
            const xMotivo = data.xMotivo

            console.log(`[Sync] SEFAZ Retorno: cStat=${cStat} xMotivo=${xMotivo} NSU=${currentUltNSU}->${novoUltNSU} Docs=${documentos.length}`)

            if (documentos.length === 0 && novoUltNSU === currentUltNSU) {
                hasMore = false
            }

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
                        if (!xml.includes('<NFe') || !xml.includes('</NFe>')) continue
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
                    // Log error per doc
                }
            } // end for

            totalImportadas += loteImportado

            // Atualizar NSU somente se maior
            if (parseInt(novoUltNSU) > parseInt(currentUltNSU)) {
                await supabaseAdmin
                    .from('config_fiscal')
                    .update({ ult_nsu: parseInt(novoUltNSU) })
                    .eq('empresa_id', empresaId)

                currentUltNSU = novoUltNSU
            } else {
                hasMore = false
            }

            if (documentos.length < 50) hasMore = false
        }

        await processAutoManifestation(userId, cnpj, pfxBuffer, passphrase)

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

// ── Server Action ─────────────────────────────────────────────────────────────

export async function syncNFesFromSEFAZ(): Promise<SyncResult> {
    console.log("[SYNC] Action invoked (Server Side)")
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

// ── Métricas ──────────────────────────────────────────────────────────────────

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
    let certificado = { valid: false, expirationDate: null, daysRemaining: 0, issuer: '' }
    let error = null

    try {
        const res = await fetchFiscal('/sefaz/status')
        if (res.ok) {
            const data = await res.json()
            certificado = data
        }
    } catch (e: any) {
        error = e.message
    }

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
