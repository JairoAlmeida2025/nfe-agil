'use server'

import { revalidatePath } from 'next/cache'
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { getCertificateCredentials } from './certificate'
import { computeDateRangeBRT, type PeriodPreset } from '@/lib/date-brt'

// ── Helpers de Comunicação Fiscal ─────────────────────────────────────────────

async function fetchFiscal(path: string, options: RequestInit = {}) {
    let microUrl = process.env.MICRO_SEFAZ_URL
    if (!microUrl) throw new Error('MICRO_SEFAZ_URL não configurada')
    if (microUrl.endsWith('/')) microUrl = microUrl.slice(0, -1)

    const controller = new AbortController()
    // 120s: suficiente para varredura de NSU 0→10000+ (múltiplos loops no micro-serviço)
    const timeoutId = setTimeout(() => controller.abort(), 120_000)

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
        if (e.name === 'AbortError') throw new Error('Timeout de conexão com Micro-serviço (120s)')
        throw e
    } finally {
        clearTimeout(timeoutId)
    }
}

async function checkFiscalConnectivity(): Promise<boolean> {
    try {
        const res = await fetchFiscal('/health')
        console.log("[Health] Status:", res.status, "OK:", res.ok)
        return res.ok
    } catch (err: any) {
        console.error("[Health] ERROR:", err.message)
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
            console.error(`[Sync] Erro upload XML ${chave}:`, error.message)
            return null
        }
        return path
    } catch (e: any) {
        console.error(`[Sync] Exceção upload XML ${chave}:`, e.message)
        return null
    }
}

async function processAutoManifestation(userId: string, cnpj: string, pfxBuffer: Buffer, passphrase: string) {
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
        } catch (e: any) {
            console.error(`[AutoManifest] Erro ${nfe.chave}:`, e.message)
        }
    }
}

// ── Gerenciamento de NSU via nfe_sync_state ────────────────────────────────────

async function getOrCreateSyncState(userId: string, cnpj: string): Promise<{
    id: string
    ultimo_nsu: number
    blocked_until: string | null
}> {
    // Tenta ler estado existente
    const { data: existing } = await supabaseAdmin
        .from('nfe_sync_state')
        .select('id, ultimo_nsu, blocked_until')
        .eq('user_id', userId)
        .eq('empresa_cnpj', cnpj)
        .maybeSingle()

    if (existing) {
        return {
            id: existing.id,
            ultimo_nsu: Number(existing.ultimo_nsu ?? 0),
            blocked_until: existing.blocked_until ?? null
        }
    }

    // Cria registro inicial
    const { data: created, error } = await supabaseAdmin
        .from('nfe_sync_state')
        .insert({
            user_id: userId,
            empresa_cnpj: cnpj,
            ultimo_nsu: 0,
            ultima_sync: null
        })
        .select('id, ultimo_nsu, blocked_until')
        .single()

    if (error || !created) throw new Error(`Falha ao criar nfe_sync_state: ${error?.message}`)

    return {
        id: created.id,
        ultimo_nsu: 0,
        blocked_until: null
    }
}

async function updateSyncStateSuccess(
    syncStateId: string,
    novoNsu: number,
    cStat: string
) {
    await supabaseAdmin
        .from('nfe_sync_state')
        .update({
            ultimo_nsu: novoNsu,
            ultima_sync: new Date().toISOString(),
            ultimo_cstat: cStat,
            ultimo_sucesso_em: new Date().toISOString(),
            blocked_until: null // Remove bloqueio anterior se tiver
        })
        .eq('id', syncStateId)
}

async function updateSyncStateBlocked(syncStateId: string) {
    // Bloqueia por 1 hora
    const blockedUntil = new Date(Date.now() + 60 * 60 * 1000).toISOString()
    await supabaseAdmin
        .from('nfe_sync_state')
        .update({
            ultimo_cstat: '656',
            blocked_until: blockedUntil
        })
        .eq('id', syncStateId)
}

// ── Core Sync Logic ──────────────────────────────────────────────────────────

export type SyncResult =
    | { success: true; importadas: number; message: string }
    | { success: false; error: string }

export async function processSefazSync(userId: string, cnpjInput: string): Promise<SyncResult> {
    const cnpj = cnpjInput.replace(/\D/g, '')
    const syncStart = Date.now()
    let totalImportadas = 0
    let totalIgnorados = 0
    let totalErros = 0
    let loopCount = 0
    let jobId: string | undefined

    // ── 1. Verificar Conectividade ─────────────────────────────────────────────
    if (!(await checkFiscalConnectivity())) {
        return { success: false, error: 'Micro-serviço fiscal indisponível (Health Check falhou).' }
    }

    // ── 2. Lock Anti-Duplo ─────────────────────────────────────────────────────
    const { data: activeJob } = await supabaseAdmin
        .from('nfe_job_logs')
        .select('id, inicio')
        .eq('tipo_job', 'sync')
        .eq('empresa_cnpj', cnpj)
        .is('fim', null)
        .gt('inicio', new Date(Date.now() - 10 * 60 * 1000).toISOString()) // 10 min
        .limit(1)
        .maybeSingle()

    if (activeJob) {
        return { success: false, error: `Job de sincronização já está em andamento desde ${new Date(activeJob.inicio).toLocaleTimeString('pt-BR')}.` }
    }

    // ── 3. Carregar Credenciais ────────────────────────────────────────────────
    let pfxBuffer: Buffer
    let passphrase: string

    try {
        const creds = await getCertificateCredentials(userId)
        pfxBuffer = creds.pfxBuffer
        passphrase = creds.password
    } catch (e: any) {
        return { success: false, error: `Erro carregando certificado: ${e.message}` }
    }

    // ── 4. Ler NSU do nfe_sync_state ───────────────────────────────────────────
    let syncState: { id: string; ultimo_nsu: number; blocked_until: string | null }
    try {
        syncState = await getOrCreateSyncState(userId, cnpj)
    } catch (e: any) {
        return { success: false, error: `Erro lendo estado de sincronização: ${e.message}` }
    }

    // Verificar bloqueio 656
    if (syncState.blocked_until && new Date(syncState.blocked_until) > new Date()) {
        return {
            success: false,
            error: `Bloqueado por erro 656 até ${new Date(syncState.blocked_until).toLocaleString('pt-BR')}. Aguarde.`
        }
    }

    // ── 5. Registrar Job ───────────────────────────────────────────────────────
    const { data: jobLog } = await supabaseAdmin
        .from('nfe_job_logs')
        .insert({
            tipo_job: 'sync',
            inicio: new Date().toISOString(),
            user_id: userId,
            empresa_cnpj: cnpj,
            nsu_inicial: syncState.ultimo_nsu
        })
        .select('id')
        .single()

    jobId = jobLog?.id

    try {
        await ensureXmlBucket()

        let currentUltNSU = String(syncState.ultimo_nsu)
        const nsuInicial = syncState.ultimo_nsu

        console.log(`[Sync] ▶ Iniciando | user=${userId} | CNPJ=${cnpj} | NSU inicial=${currentUltNSU}`)

        // ── 6. Loop de sincronização (micro-serviço já faz multiplos loops internamente) ──
        // O micro-serviço retorna TODOS os documentos de uma vez (loop interno dele)
        // então fazemos apenas 1 chamada por execução neste nível

        console.log(`[Sync] Chamando Micro-serviço com NSU=${currentUltNSU}`)

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
            const status = response.status
            try {
                const errBody = await response.json()
                detail = errBody.error ?? errBody.xMotivo ?? ''

                // Tratamento específico 656 (Consumo Indevido)
                if (status === 429 || errBody.cStat === '656') {
                    console.warn(`[Sync] BLOQUEIO 656: ${detail}`)
                    await updateSyncStateBlocked(syncState.id)

                    if (jobId) {
                        await supabaseAdmin.from('nfe_job_logs').update({
                            fim: new Date().toISOString(),
                            sucesso: false,
                            erro_resumido: `BLOQUEIO 656: ${detail}`,
                            detalhes: { cStat: '656', motivo: detail }
                        }).eq('id', jobId)
                    }

                    return { success: false, error: 'Consumo indevido (656). Sistema bloqueado por 1 hora.' }
                }
            } catch { }

            console.error(`[Sync] ERRO REQUISIÇÃO: ${status} - ${detail}`)
            throw new Error(`Micro-Serviço HTTP ${status}: ${detail}`)
        }

        const data = await response.json()
        const documentos = data.documentos || []
        const novoUltNSU = data.ultNSU
        const cStat = data.cStat
        const xMotivo = data.xMotivo

        console.log(`[Sync] SEFAZ Retorno: cStat=${cStat} xMotivo=${xMotivo} NSU=${currentUltNSU}→${novoUltNSU} Docs=${documentos.length}`)

        // ── 7. Processar cada documento ────────────────────────────────────────
        for (const doc of documentos) {
            const { schema, xml, nsu } = doc
            const nsuInt = parseInt(nsu) || 0
            loopCount++

            try {
                // ── Eventos: cancelamento e manifestação ─────────────────────
                if (schema.includes('procEventoNFe') || schema.includes('resEvento')) {
                    const tpEvento = extrairTag(xml, 'tpEvento')
                    const chNFe = extrairTag(xml, 'chNFe')

                    if (chNFe) {
                        if (tpEvento === '110111' || tpEvento === '110110') {
                            // Cancelamento
                            const { error: cancelErr } = await supabaseAdmin.from('nfes')
                                .update({
                                    status: 'cancelada',
                                    schema_tipo: schema.includes('procEvento') ? 'procEventoNFe' : 'resEvento'
                                })
                                .eq('chave', chNFe)
                                .eq('user_id', userId)

                            if (cancelErr) {
                                console.error(`[Sync] Erro atualizando cancelamento chave=${chNFe.slice(-8)}: ${cancelErr.message}`)
                            } else {
                                console.log(`[Sync] ✅ Cancelamento aplicado chave=${chNFe.slice(-8)}`)
                            }
                        }
                        // Outros eventos: registrar mas não ignorar
                    }
                    totalImportadas++
                    continue
                }

                // ── resNFe: Resumo da NF-e (chegou antes do XML completo) ────
                if (schema.includes('resNFe')) {
                    const chave = extrairTag(xml, 'chNFe')
                    if (!chave) {
                        console.warn(`[Sync] resNFe sem chave NSU=${nsu}`)
                        totalIgnorados++
                        continue
                    }

                    const dhEmi = extrairTag(xml, 'dhEmi')
                    const xNome = extrairTag(xml, 'xNome')
                    const vNF = extrairTag(xml, 'vNF')
                    const cSitNFe = extrairTag(xml, 'cSitNFe')
                    const cUF = extrairTag(xml, 'cUF')

                    // cSitNFe=1=Autorizada, 2=Cancelada, 3=Denegada
                    const statusNFe = cSitNFe === '2' || cSitNFe === '3' ? 'cancelada' : 'recebida'

                    const { error: upsertErr } = await supabaseAdmin
                        .from('nfes')
                        .upsert({
                            user_id: userId,
                            empresa_cnpj: cnpj,
                            chave,
                            nsu: nsuInt,
                            emitente: xNome || 'Desconhecido',
                            razao_social_emitente: xNome || null,
                            valor: parseFloat(vNF) || 0,
                            data_emissao: dhEmi ? new Date(dhEmi).toISOString() : new Date().toISOString(),
                            status: statusNFe,
                            situacao: 'nao_informada',
                            schema_tipo: 'resNFe',
                            uf_emitente: cUF || null,
                        }, {
                            onConflict: 'chave',
                            ignoreDuplicates: false // atualiza se já existir como procNFe
                        })

                    if (upsertErr) {
                        console.error(`[Sync] ❌ Erro upsert resNFe chave=${chave.slice(-8)}: ${upsertErr.message}`)
                        totalErros++
                    } else {
                        console.log(`[Sync] ✅ resNFe salvo chave=${chave.slice(-8)} status=${statusNFe}`)
                        totalImportadas++
                    }
                    continue
                }

                // ── procNFe: NF-e completa com XML assinado ──────────────────
                if (schema.includes('procNFe')) {
                    if (!xml.includes('<NFe') && !xml.includes('<nfeProc')) {
                        console.warn(`[Sync] procNFe XML inválido NSU=${nsu}`)
                        totalIgnorados++
                        continue
                    }

                    // Extrair chave: tenta infNFe Id, depois chNFe
                    let chave = extrairAttr(xml, 'infNFe', 'Id')?.replace(/^NFe/, '') || extrairTag(xml, 'chNFe')
                    if (!chave) {
                        console.warn(`[Sync] procNFe sem chave NSU=${nsu}`)
                        totalIgnorados++
                        continue
                    }

                    // Extrair dados do XML completo
                    const ideXml = extrairTag(xml, 'ide')
                    const dhEmi = extrairTag(ideXml, 'dhEmi') || extrairTag(ideXml, 'dEmi')
                    const nNF = extrairTag(ideXml, 'nNF')
                    const natOp = extrairTag(ideXml, 'natOp')

                    const emitXml = extrairTag(xml, 'emit')
                    const xNome = extrairTag(emitXml, 'xNome') || extrairTag(emitXml, 'xFant')
                    const cnpjEmit = extrairTag(emitXml, 'CNPJ')

                    const destXml = extrairTag(xml, 'dest')
                    const xNomeDest = extrairTag(destXml, 'xNome')

                    const ICMSTot = extrairTag(xml, 'ICMSTot')
                    const vNF = extrairTag(ICMSTot, 'vNF') || extrairTag(extrairTag(xml, 'total'), 'vNF')

                    // Upload XML no Storage (não bloqueia se falhar)
                    const xmlPath = await uploadXmlToStorage(chave, xml).catch(() => null)

                    const { error: upsertErr } = await supabaseAdmin
                        .from('nfes')
                        .upsert({
                            user_id: userId,
                            empresa_cnpj: cnpj,
                            chave,
                            nsu: nsuInt,
                            numero: nNF || null,
                            emitente: xNome || cnpjEmit || 'Desconhecido',
                            razao_social_emitente: xNome || null,
                            destinatario: xNomeDest || null,
                            nat_op: natOp || null,
                            valor: parseFloat(vNF) || 0,
                            data_emissao: dhEmi ? new Date(dhEmi).toISOString() : new Date().toISOString(),
                            status: 'xml_disponivel',
                            situacao: 'nao_informada',
                            schema_tipo: 'procNFe',
                            xml_content: xml,
                            xml_url: xmlPath,
                        }, {
                            onConflict: 'chave',
                            ignoreDuplicates: false
                        })

                    if (upsertErr) {
                        console.error(`[Sync] ❌ Erro upsert procNFe chave=${chave.slice(-8)}: ${upsertErr.message}`)
                        totalErros++
                    } else {
                        console.log(`[Sync] ✅ procNFe salvo chave=${chave.slice(-8)} nNF=${nNF} valor=${vNF}`)
                        totalImportadas++
                    }
                    continue
                }

                // Schema desconhecido
                console.warn(`[Sync] Schema desconhecido: ${schema} NSU=${nsu}`)
                totalIgnorados++

            } catch (e: any) {
                console.error(`[Sync] ❌ Exceção doc NSU=${nsu} schema=${schema}: ${e?.message}`)
                totalErros++
            }
        } // end for documentos

        console.log(`[Sync] ✔ Processamento: salvos=${totalImportadas} ignorados=${totalIgnorados} erros=${totalErros}`)

        // ── 8. Atualizar NSU somente APÓS persistência completa ────────────────
        const nsuFinal = parseInt(novoUltNSU) || syncState.ultimo_nsu

        if (totalErros === 0 || totalImportadas > 0) {
            // Atualiza NSU mesmo se houve alguns erros, desde que pelo menos parte foi salva
            if (nsuFinal > syncState.ultimo_nsu) {
                await updateSyncStateSuccess(syncState.id, nsuFinal, cStat)
                console.log(`[Sync] NSU atualizado: ${syncState.ultimo_nsu} → ${nsuFinal}`)
            } else {
                // NSU não avançou mas atualizar ultima_sync apenas
                await supabaseAdmin
                    .from('nfe_sync_state')
                    .update({
                        ultima_sync: new Date().toISOString(),
                        ultimo_cstat: cStat
                    })
                    .eq('id', syncState.id)
            }
        } else if (totalErros > 0 && totalImportadas === 0) {
            // Falha total: NÃO atualiza NSU para permitir reprocessamento
            console.error(`[Sync] ⚠️ NSU NÃO atualizado: todos os ${totalErros} documentos falharam. Permitindo reprocessamento.`)
        }

        // ── 9. Registrar em cron_logs ──────────────────────────────────────────
        const duration = `${Date.now() - syncStart}ms`
        const cronStatus = cStat === '137' ? 'nenhum_documento' :
            cStat === '138' ? 'success' :
                cStat === '656' ? 'blocked_656' : 'success'

        await supabaseAdmin.from('cron_logs').insert({
            executed_at: new Date().toISOString(),
            duration,
            processed_count: totalImportadas,
            status: cronStatus,
            message: `cStat=${cStat} | Salvos=${totalImportadas} | Ignorados=${totalIgnorados} | Erros=${totalErros} | NSU ${nsuInicial}→${nsuFinal}`,
            user_id: userId,
            empresa_cnpj: cnpj,
            nsu_inicial: nsuInicial,
            nsu_final: nsuFinal,
            details: {
                cStat,
                xMotivo,
                total_documentos: documentos.length,
                salvos: totalImportadas,
                ignorados: totalIgnorados,
                erros: totalErros
            }
        })

        // ── 10. Finalizar Job ──────────────────────────────────────────────────
        if (jobId) {
            await supabaseAdmin.from('nfe_job_logs').update({
                fim: new Date().toISOString(),
                sucesso: totalErros === 0 || totalImportadas > 0,
                total_processado: totalImportadas,
                total_ignorado: totalIgnorados,
                total_erro: totalErros,
                nsu_final: nsuFinal,
                loops_executados: 1, // micro-serviço faz os loops internamente
                erro_resumido: totalErros > 0 ? `${totalErros} erros de parse/upsert` : null,
                detalhes: {
                    cStat,
                    xMotivo,
                    documentos_recebidos: documentos.length,
                    nsu_inicial: nsuInicial,
                    nsu_final: nsuFinal
                }
            }).eq('id', jobId)
        }

        // ── 11. Auto-manifestação ──────────────────────────────────────────────
        if (totalImportadas > 0) {
            await processAutoManifestation(userId, cnpj, pfxBuffer, passphrase)
        }

        const message = cStat === '137'
            ? `Sincronização concluída. Nenhum documento novo encontrado (NSU atual: ${nsuFinal}).`
            : `Sincronização concluída. ${totalImportadas} documento(s) importado(s). NSU: ${nsuInicial}→${nsuFinal}.`

        return {
            success: true,
            importadas: totalImportadas,
            message
        }

    } catch (err: any) {
        console.error(`[Sync] ❌ Erro fatal:`, err.message)

        if (jobId) {
            await supabaseAdmin.from('nfe_job_logs').update({
                fim: new Date().toISOString(),
                sucesso: false,
                erro_resumido: err.message
            }).eq('id', jobId)
        }

        try {
            await supabaseAdmin.from('cron_logs').insert({
                executed_at: new Date().toISOString(),
                duration: `${Date.now() - syncStart}ms`,
                processed_count: 0,
                status: 'error',
                message: `Erro fatal: ${err.message}`,
                user_id: userId,
                empresa_cnpj: cnpj
            })
        } catch { } // não propagar erro do log

        return { success: false, error: `Erro de sincronização: ${err.message}` }
    }
}

// ── Server Action ─────────────────────────────────────────────────────────────

export async function syncNFesFromSEFAZ(): Promise<SyncResult> {
    console.log("[SYNC] Action invocada (Server Side)")
    const user = await getAuthUser()
    if (!user) return { success: false, error: 'Não autenticado.' }

    const { data: empresa } = await supabaseAdmin
        .from('empresas')
        .select('cnpj')
        .eq('user_id', user.id)
        .eq('ativo', true)
        .single()

    if (!empresa) return { success: false, error: 'Nenhuma empresa ativa configurada.' }

    const result = await processSefazSync(user.id, empresa.cnpj)

    revalidatePath('/dashboard')
    revalidatePath('/dashboard/nfe')

    return result
}

// ── Listar NF-es (dashboard cards) ───────────────────────────────────────────

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

    if (error) {
        console.error('[listNFes] Erro:', error.message)
        return []
    }
    return data
}

// ── Listar NF-es com Filtros (página NF-es Recebidas) ─────────────────────────
// Usa supabaseAdmin para bypassar RLS e filtra por user_id manualmente (seguro no servidor).
// Datas calculadas no backend com timezone America/Sao_Paulo (BRT/BRST).

export async function listNFesFiltradas(params?: {
    periodo?: PeriodPreset          // preset de período (padrão: 'this_month')
    customFrom?: string             // apenas para periodo='custom': 'YYYY-MM-DD'
    customTo?: string               // apenas para periodo='custom': 'YYYY-MM-DD'
    emitente?: string               // filtro parcial (ilike)
    status?: string                 // valor exato do campo status
}): Promise<{
    success: boolean
    data: Array<{
        id: string
        numero: string | null
        chave: string
        emitente: string
        valor: number
        status: string
        situacao: string
        dataEmissao: string | null
        xmlContent: string | null
    }>
    error?: string
}> {
    const user = await getAuthUser()
    if (!user) return { success: false, data: [], error: 'Não autenticado.' }

    try {
        // ── Calcular range de datas no backend (timezone BRT) ─────────────────
        // Padrão: 'this_month' (nunca retorna todo o histórico sem solicitação explícita)
        const periodo: PeriodPreset = params?.periodo ?? 'this_month'
        const range = computeDateRangeBRT(periodo, params?.customFrom, params?.customTo)

        console.log(`[listNFesFiltradas] user=${user.id} | periodo=${periodo} | from=${range.from || 'sem_inicio'} | to=${range.to || 'sem_fim'}`)

        let query = supabaseAdmin
            .from('nfes')
            .select('id, numero, chave, emitente, razao_social_emitente, valor, valor_total, status, situacao, data_emissao, xml_content')
            .eq('user_id', user.id)
            .order('data_emissao', { ascending: false })

        // Aplicar filtros de data (range.from/to são ISO UTC strings ou '' para 'all')
        if (range.from) {
            query = query.gte('data_emissao', range.from)
        }
        if (range.to) {
            query = query.lte('data_emissao', range.to)
        }

        // Filtro de emitente (parcial, case-insensitive)
        if (params?.emitente?.trim()) {
            query = query.ilike('emitente', `%${params.emitente.trim()}%`)
        }

        // Filtro de status (valor exato)
        if (params?.status?.trim()) {
            query = query.eq('status', params.status.trim())
        }

        const { data, error } = await query

        if (error) {
            console.error('[listNFesFiltradas] Erro Supabase:', error.message)
            return { success: false, data: [], error: error.message }
        }

        const mapped = (data ?? []).map((item: any) => ({
            id: item.id,
            numero: item.numero ?? null,
            chave: item.chave,
            emitente: item.emitente || item.razao_social_emitente || 'Desconhecido',
            valor: Number(item.valor || item.valor_total || 0),
            status: item.status,
            situacao: item.situacao || 'nao_informada',
            dataEmissao: item.data_emissao ?? null,
            xmlContent: item.xml_content ?? null,
        }))

        console.log(`[listNFesFiltradas] → ${mapped.length} registros encontrados`)

        return { success: true, data: mapped }
    } catch (err: any) {
        console.error('[listNFesFiltradas] Erro inesperado:', err.message)
        return { success: false, data: [], error: err.message }
    }
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
        .maybeSingle()

    return data?.ultima_sync ?? null
}

export async function getSyncStatus() {
    const user = await getAuthUser()
    if (!user) return null

    const { data: empresa } = await supabaseAdmin
        .from('empresas')
        .select('cnpj')
        .eq('user_id', user.id)
        .eq('ativo', true)
        .single()

    if (!empresa) return null

    const [syncState, lastJob, lastCronLog] = await Promise.all([
        supabaseAdmin
            .from('nfe_sync_state')
            .select('ultimo_nsu, ultima_sync, ultimo_cstat, blocked_until, ultimo_sucesso_em')
            .eq('user_id', user.id)
            .eq('empresa_cnpj', empresa.cnpj)
            .maybeSingle(),
        supabaseAdmin
            .from('nfe_job_logs')
            .select('sucesso, fim, erro_resumido, created_at, total_processado, total_ignorado, total_erro')
            .eq('user_id', user.id)
            .eq('tipo_job', 'sync')
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle(),
        supabaseAdmin
            .from('cron_logs')
            .select('executed_at, status, processed_count, message, duration')
            .eq('user_id', user.id)
            .order('executed_at', { ascending: false })
            .limit(1)
            .maybeSingle()
    ])

    const s = syncState.data
    const j = lastJob.data
    const c = lastCronLog.data

    // Determinar status legível
    let status: 'atualizado' | 'nenhum_documento' | 'bloqueado_656' | 'erro' | 'nunca_sincronizado' = 'nunca_sincronizado'
    if (s?.blocked_until && new Date(s.blocked_until) > new Date()) {
        status = 'bloqueado_656'
    } else if (s?.ultima_sync) {
        if (s.ultimo_cstat === '137') status = 'nenhum_documento'
        else status = 'atualizado'
    } else if (j?.sucesso === false) {
        status = 'erro'
    }

    // Próxima execução automática: 07:00 BRT (10:00 UTC) do dia seguinte
    const now = new Date()
    const nextRun = new Date()
    nextRun.setUTCHours(10, 0, 0, 0)
    if (nextRun <= now) nextRun.setDate(nextRun.getDate() + 1)

    return {
        ultimaSync: s?.ultima_sync ?? null,
        proximaSync: nextRun.toISOString(),
        ultimoNsu: s?.ultimo_nsu ?? 0,
        ultimoCstat: s?.ultimo_cstat ?? null,
        blockedUntil: s?.blocked_until ?? null,
        quantidadeImportada: j?.total_processado ?? 0,
        status,
        ultimoJob: j ? {
            sucesso: j.sucesso,
            fim: j.fim,
            erroResumido: j.erro_resumido,
            totalProcessado: j.total_processado,
            totalIgnorado: j.total_ignorado,
            totalErro: j.total_erro
        } : null,
        ultimoCronLog: c ? {
            executedAt: c.executed_at,
            status: c.status,
            processedCount: c.processed_count,
            message: c.message,
            duration: c.duration
        } : null
    }
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
            .maybeSingle()
    ])

    const notas = nfesMes.data || []

    const totalNotasMes = notas.length
    const valorTotalMes = notas.reduce((acc, curr) => acc + (Number(curr.valor) || 0), 0)
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
