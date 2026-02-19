'use server'

import https from 'https'
import { gunzipSync } from 'zlib'
import { Buffer } from 'buffer'
import { revalidatePath } from 'next/cache'
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { buildSefazAgent } from '@/actions/certificate'

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

// ── Montar envelope SOAP para DistribuiçãoDFe ─────────────────────────────────

function buildDistDFeEnvelope(cnpj: string, ultNSU: number, cUF: string = '35'): string {
    const nsuFormatado = String(ultNSU).padStart(15, '0')

    return `<?xml version="1.0" encoding="utf-8"?>
<soap12:Envelope
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xmlns:xsd="http://www.w3.org/2001/XMLSchema"
  xmlns:soap12="http://www.w3.org/2003/05/soap-envelope">
  <soap12:Body>
    <nfeDistDFeInteresse xmlns="http://www.portalfiscal.inf.br/nfe/wsdl/NFeDistribuicaoDFe">
      <nfeDadosMsg>
        <distDFeInt versao="1.01" xmlns="http://www.portalfiscal.inf.br/nfe">
          <tpAmb>1</tpAmb>
          <cUFAutor>${cUF}</cUFAutor>
          <CNPJ>${cnpj}</CNPJ>
          <distNSU>
            <ultNSU>${nsuFormatado}</ultNSU>
          </distNSU>
        </distDFeInt>
      </nfeDadosMsg>
    </nfeDistDFeInteresse>
  </soap12:Body>
</soap12:Envelope>`
}

// ── Utils XML ────────────────────────────────────────────────────────────────

function extrairTag(xml: string, tag: string): string {
    const match = xml.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`))
    return match?.[1]?.trim() ?? ''
}

function extrairAttr(xml: string, tag: string, attr: string): string {
    const match = xml.match(new RegExp(`<${tag}[^>]*${attr}="([^"]*)"[^>]*>`))
    return match?.[1] ?? ''
}

// ── Fazer chamada SOAP para SEFAZ ────────────────────────────────────────────

async function chamarDistDFe(
    agent: https.Agent,
    cnpj: string,
    ultNSU: number,
    ambiente: 'producao' | 'homologacao' = 'producao'
): Promise<string> {
    const endpoint = ambiente === 'producao'
        ? 'https://www.nfe.fazenda.gov.br/NFeDistribuicaoDFe/NFeDistribuicaoDFe.asmx'
        : 'https://hom.nfe.fazenda.gov.br/NFeDistribuicaoDFe/NFeDistribuicaoDFe.asmx'

    const body = buildDistDFeEnvelope(cnpj, ultNSU)

    console.log(`[SEFAZ] Enviando requisição para ${endpoint} (CNPJ: ${cnpj} NSU: ${ultNSU})`)

    const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/soap+xml; charset=utf-8',
            'SOAPAction': 'http://www.portalfiscal.inf.br/nfe/wsdl/NFeDistribuicaoDFe/nfeDistDFeInteresse',
        },
        body,
        // @ts-expect-error Node.js only
        agent,
        // @ts-expect-error Node.js extended options
        duplex: 'half',
        keepalive: true
    })

    console.log(`[SEFAZ] Resposta HTTP: ${response.status} ${response.statusText}`)

    if (!response.ok) {
        const errorText = await response.text()
        console.error(`[SEFAZ] Erro Response Body: ${errorText.substring(0, 500)}`)
        throw new Error(`SEFAZ retornou HTTP ${response.status}: ${response.statusText}`)
    }

    return response.text()
}

// ── Processamento de Documentos (Lógica Core) ────────────────────────────────

async function processarDocZip(
    user_id: string,
    empresa_cnpj: string,
    nsu: string,
    schema: string,
    conteudoBase64: string
) {
    try {
        const buffer = Buffer.from(conteudoBase64, 'base64')
        const xml = gunzipSync(buffer).toString('utf-8')

        const nsuInt = parseInt(nsu)

        if (schema.includes('resNFe')) {
            // Resumo da NF-e
            const chave = extrairTag(xml, 'chNFe')
            const dhEmi = extrairTag(xml, 'dhEmi')
            const xNome = extrairTag(xml, 'xNome')
            const vNF = extrairTag(xml, 'vNF')
            // cSitNFe: 1=Autorizada, 2=Denegada, 3=Cancelada
            const cSitNFe = extrairTag(xml, 'cSitNFe')
            const cUF = extrairTag(xml, 'cUF')

            let status = 'recebida'
            if (cSitNFe === '3') status = 'cancelada'
            if (cSitNFe === '2') status = 'denegada'

            console.log(`[SEFAZ] Processando resNFe: ${chave} (NSU ${nsu})`)

            await supabaseAdmin.from('nfes').upsert({
                user_id,
                empresa_cnpj,
                chave,
                nsu: nsuInt,
                emitente: xNome,
                valor: parseFloat(vNF) || 0,
                // Garantir data válida
                data_emissao: dhEmi ? new Date(dhEmi).toISOString() : new Date().toISOString(),
                status: status,
                schema_tipo: 'resNFe',
                uf_emitente: cUF,
                // xml_content permanece NULL se não existir
            }, { onConflict: 'chave' }) // Upsert: atualiza se já existir

        } else if (schema.includes('procNFe')) {
            // NF-e Completa (Autorizada)
            const chave = extrairTag(xml, 'chNFe') || extrairAttr(xml, 'infNFe', 'Id')?.replace('NFe', '')

            // Extrair dados do XML completo
            const emit = extrairTag(xml, 'emit')
            const xNome = extrairTag(emit, 'xNome')

            const ide = extrairTag(xml, 'ide')
            const dhEmi = extrairTag(ide, 'dhEmi') || extrairTag(ide, 'dEmi')
            const nNF = extrairTag(ide, 'nNF')

            const total = extrairTag(xml, 'total')
            const vNF = extrairTag(total, 'vNF')

            console.log(`[SEFAZ] Processando procNFe: ${chave} (NSU ${nsu})`)

            // Upsert: Se já existia como resNFe, agora ganha xml_content e vira autorizada
            await supabaseAdmin.from('nfes').upsert({
                user_id,
                empresa_cnpj,
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

        // Se for Evento de Cancelamento (procEventoNFe ou resEvento)
        if (schema.includes('procEventoNFe') || schema.includes('resEvento')) {
            const tpEvento = extrairTag(xml, 'tpEvento')
            const chNFe = extrairTag(xml, 'chNFe')
            if (tpEvento === '110111') { // Cancelamento
                console.log(`[SEFAZ] Processando Cancelamento para NF: ${chNFe}`)
                await supabaseAdmin.from('nfes').update({ status: 'cancelada' }).eq('chave', chNFe)
            }
        }

    } catch (e) {
        console.error(`[SEFAZ] Erro ao processar docZip NSU ${nsu}:`, e)
    }
}

// ── Server Action principal ────────────────────────────────────────────────────

export type SyncResult =
    | { success: true; importadas: number; message: string } // Removido erro daqui no type success
    | { success: false; error: string }

export async function syncNFesFromSEFAZ(): Promise<SyncResult> {
    const user = await getAuthUser()
    if (!user) return { success: false, error: 'Não autenticado.' }

    // Buscar empresa ativa
    const { data: empresa } = await supabaseAdmin
        .from('empresas')
        .select('cnpj, ambiente_sefaz')
        .eq('user_id', user.id)
        .eq('ativo', true)
        .single()

    if (!empresa) {
        return { success: false, error: 'Nenhuma empresa configurada.' }
    }

    const cnpj = empresa.cnpj.replace(/\D/g, '')
    const ambiente = (empresa.ambiente_sefaz ?? 'producao') as 'producao' | 'homologacao'

    // Buscar último NSU
    const { data: syncState } = await supabaseAdmin
        .from('nfe_sync_state')
        .select('ultimo_nsu')
        .eq('user_id', user.id)
        .eq('empresa_cnpj', cnpj)
        .single()

    let ultNSU = Number(syncState?.ultimo_nsu ?? 0)

    // Construir agent mTLS
    let agent: https.Agent
    try {
        agent = await buildSefazAgent()
    } catch (e) {
        return { success: false, error: `Certificado erro: ${e instanceof Error ? e.message : String(e)}` }
    }

    let totalImportadas = 0
    let loopCount = 0
    const MAX_LOOPS = 50

    console.log(`[SEFAZ] Iniciando sincronização. CNPJ: ${cnpj}, Ultimo NSU: ${ultNSU}`)

    try {
        let continuar = true
        while (continuar) {
            loopCount++
            if (loopCount > MAX_LOOPS) {
                console.warn('[SEFAZ] Limite de loops atingido (50).')
                break
            }

            const xmlResposta = await chamarDistDFe(agent, cnpj, ultNSU, ambiente)

            const cStat = extrairTag(xmlResposta, 'cStat')
            const xMotivo = extrairTag(xmlResposta, 'xMotivo')
            const ultNSURetornado = parseInt(extrairTag(xmlResposta, 'ultNSU') || '0')
            const maxNSURetornado = parseInt(extrairTag(xmlResposta, 'maxNSU') || '0')

            console.log(`[SEFAZ] Loop ${loopCount}: cStat=${cStat} (${xMotivo}), NSU Atual=${ultNSU}, Retornado=${ultNSURetornado}, Max=${maxNSURetornado}`)

            if (cStat === '137') {
                // Nenhum documento localizado
                continuar = false
                break
            }

            if (cStat !== '138') {
                // Erro
                return { success: false, error: `SEFAZ: ${cStat} - ${xMotivo}` }
            }

            // Processar docZip
            const docZipRegex = /<docZip[^>]*NSU="(\d+)"[^>]*schema="([^"]+)"[^>]*>([^<]+)<\/docZip>/g
            let match: RegExpExecArray | null

            // Iterar sobre os docs
            while ((match = docZipRegex.exec(xmlResposta)) !== null) {
                const nsu = match[1]
                const schema = match[2]
                const conteudo = match[3]

                await processarDocZip(user.id, cnpj, nsu, schema, conteudo)
                totalImportadas++
            }

            // Atualizar NSU para o loop seguinte
            // A regra é: Próxima chamada usa o ultNSU retornado pela chamada anterior
            ultNSU = ultNSURetornado

            // Persistir estado NO BANCO a cada lote
            await supabaseAdmin.from('nfe_sync_state').upsert({
                user_id: user.id,
                empresa_cnpj: cnpj,
                ultimo_nsu: ultNSU,
                ultima_sync: new Date().toISOString()
            }, { onConflict: 'user_id,empresa_cnpj' })
        }

    } catch (err: any) {
        console.error('[SEFAZ] Erro fatal no loop:', err)
        return { success: false, error: `Erro na sincronização: ${err.message}` }
    }

    revalidatePath('/dashboard')
    revalidatePath('/dashboard/nfe')

    return {
        success: true,
        importadas: totalImportadas,
        message: `${totalImportadas} documentos processados.`
    }
}

// ── Listar NF-es ─────────────────────────────────────────────────────────────

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

// ── Última sincronização ──────────────────────────────────────────────────────

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

// ── Métricas e Status ────────────────────────────────────────────────────────

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
        // Pendentes = Notas que não têm xml_content (são null) E não estão canceladas
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
