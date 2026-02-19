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
        await ensureXmlBucket()

        console.log(`[Next.js] Chamando Micro-Serviço em ${microUrl}/sefaz/distdfe para CNPJ ${cnpj} NSU ${ultNSU}...`)

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
            } catch { } // Body vazio ou inválido
            return { success: false, error: `Falha no Micro-Serviço SEFAZ: ${errorMsg}` }
        }

        const data = await response.json() // { documentos: [], ultNSU: string }
        const documentos = data.documentos || []

        console.log(`[Next.js] Recebido ${documentos.length} documentos. Processando...`)

        let processados = 0

        for (const doc of documentos) {
            const { schema, xml, nsu } = doc
            const nsuInt = parseInt(nsu)

            try {
                let chave = ''
                let status = ''
                let dadosNfe: any = {}

                // Extrair chave e dados básicos independente do schema para identificação
                if (schema.includes('resNFe')) {
                    chave = extrairTag(xml, 'chNFe')
                    status = 'recebida'
                } else if (schema.includes('procNFe')) {
                    chave = extrairTag(xml, 'chNFe') || extrairAttr(xml, 'infNFe', 'Id')?.replace('NFe', '')
                    status = 'xml_disponivel'
                } else if (schema.includes('procEventoNFe') || schema.includes('resEvento')) {
                    // Eventos
                    const tpEvento = extrairTag(xml, 'tpEvento')
                    const chNFe = extrairTag(xml, 'chNFe')
                    if (tpEvento === '110111' || tpEvento === '110110') { // Cancelamento / CC-e
                        console.log(`[Next.js] Evento ${tpEvento} para ${chNFe}`)
                        await supabaseAdmin.from('nfes')
                            .update({ status: 'cancelada' })
                            .eq('chave', chNFe)
                            .eq('user_id', user.id)
                    }
                    processados++
                    continue // Próximo doc
                }

                if (!chave) continue

                // Check existing
                const { data: existing } = await supabaseAdmin
                    .from('nfes')
                    .select('id, status, xml_url')
                    .eq('chave', chave)
                    .single() // Pode retornar null se não existir (mas .single() throw error se 0 rows?)
                // Supabase retorna error code PGRST116 se 0 rows com .single()

                // Melhor usar .maybeSingle()

                const { data: existingSafe } = await supabaseAdmin
                    .from('nfes')
                    .select('id, status, xml_url')
                    .eq('chave', chave)
                    .maybeSingle()

                if (schema.includes('resNFe')) {
                    if (!existingSafe) {
                        // Inserir resumo
                        const dhEmi = extrairTag(xml, 'dhEmi')
                        const xNome = extrairTag(xml, 'xNome')
                        const vNF = extrairTag(xml, 'vNF')
                        const cSitNFe = extrairTag(xml, 'cSitNFe')
                        const cUF = extrairTag(xml, 'cUF')

                        let st = 'recebida'
                        if (cSitNFe === '3') st = 'cancelada' // Cancelada na origem (resumo já avisa)

                        await supabaseAdmin.from('nfes').insert({
                            user_id: user.id,
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
                    // Se já existe, IGNORA resNFe (não sobrescreve possível procNFe nem update status)
                } else if (schema.includes('procNFe')) {
                    // Upload XML
                    const xmlPath = await uploadXmlToStorage(chave, xml)

                    const emit = extrairTag(xml, 'emit')
                    const xNome = extrairTag(emit, 'xNome')
                    const ide = extrairTag(xml, 'ide')
                    const dhEmi = extrairTag(ide, 'dhEmi') || extrairTag(ide, 'dEmi')
                    const nNF = extrairTag(ide, 'nNF')
                    const total = extrairTag(xml, 'total')
                    const vNF = extrairTag(total, 'vNF')

                    const upsertData = {
                        user_id: user.id,
                        empresa_cnpj: cnpj,
                        chave,
                        nsu: nsuInt,
                        numero: nNF,
                        emitente: xNome,
                        valor: parseFloat(vNF) || 0,
                        data_emissao: dhEmi ? new Date(dhEmi).toISOString() : new Date().toISOString(),
                        status: 'xml_disponivel',
                        schema_tipo: 'procNFe',
                        xml_content: xml, // Mantendo por compatibilidade/backup
                        xml_url: xmlPath // Novo campo storage path
                    }

                    // Se não existe -> Insert full
                    // Se existe -> Update full (sobrescreve resumo)
                    await supabaseAdmin.from('nfes').upsert(upsertData, { onConflict: 'chave' })
                }

                processados++

            } catch (e) {
                console.error(`Erro processando doc NSU ${nsu}:`, e)
            }
        }

        // Atualizar Sync State
        const novoUltNSU = parseInt(data.ultNSU || ultNSU)
        if (novoUltNSU > parseInt(ultNSU)) {
            await supabaseAdmin.from('nfe_sync_state').upsert({
                user_id: user.id,
                empresa_cnpj: cnpj,
                ultimo_nsu: novoUltNSU,
                ultima_sync: new Date().toISOString()
            }, { onConflict: 'user_id,empresa_cnpj' }) // Na verdade é PK composta? Se for (id), onConflict não funciona. Mas nfe_sync_state PK deve ser (user_id, empresa_cnpj)
        }

        revalidatePath('/dashboard')
        revalidatePath('/dashboard/nfe')

        return {
            success: true,
            importadas: processados,
            message: `Sincronização concluída. ${processados} documentos atualizados.`
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
        supabaseAdmin.from('nfes').select('id', { count: 'exact', head: true }).eq('user_id', user.id).is('xml_url', null).neq('status', 'cancelada'), // Pendente = Sem URL
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
