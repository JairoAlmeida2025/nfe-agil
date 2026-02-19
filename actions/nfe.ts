'use server'

import https from 'https'
import { gunzipSync } from 'zlib'
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

// ── Parsear resposta XML da SEFAZ ────────────────────────────────────────────

function extrairTag(xml: string, tag: string): string {
    const match = xml.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`))
    return match?.[1]?.trim() ?? ''
}

function extrairAttr(xml: string, tag: string, attr: string): string {
    const match = xml.match(new RegExp(`<${tag}[^>]*${attr}="([^"]*)"[^>]*>`))
    return match?.[1] ?? ''
}

interface NFeResumida {
    chave: string
    nsu: string
    dhEmi?: string
    emitente?: string
    valorNF?: string
    numero?: string
    natOp?: string
    ufEmitente?: string
}

function parsearDocumentos(xmlResponde: string): { documentos: NFeResumida[], ultNSU: number, maxNSU: number } {
    const ultNSU = parseInt(extrairTag(xmlResponde, 'ultNSU') || '0')
    const maxNSU = parseInt(extrairTag(xmlResponde, 'maxNSU') || '0')
    const documentos: NFeResumida[] = []

    // Extrair todos os loteDistDFeInt > docZip
    const docZipRegex = /<docZip[^>]*NSU="(\d+)"[^>]*schema="([^"]+)"[^>]*>([^<]+)<\/docZip>/g
    let match: RegExpExecArray | null
    // eslint-disable-next-line no-cond-assign
    while ((match = docZipRegex.exec(xmlResponde)) !== null) {
        const nsu = match[1]
        const schema = match[2]
        const conteudo = match[3]

        // Só processa resNFe (resumo de NF-e destinada à empresa)
        if (schema.includes('resNFe') || schema.includes('procNFe')) {
            try {
                // O conteúdo é Base64+GZip — decodificamos para extrair tags XML
                const buffer = Buffer.from(conteudo, 'base64')
                const decompressed = gunzipSync(buffer).toString('utf-8')

                const chave = extrairTag(decompressed, 'chNFe') || extrairAttr(decompressed, 'infNFe', 'Id')?.replace('NFe', '')
                const dhEmi = extrairTag(decompressed, 'dhEmi') || extrairTag(decompressed, 'dEmi')
                const emitente = extrairTag(decompressed, 'xNome')
                const valorNF = extrairTag(decompressed, 'vNF')
                const numero = extrairTag(decompressed, 'nNF')
                const natOp = extrairTag(decompressed, 'natOp')
                const ufEmitente = extrairTag(decompressed, 'cUF')

                if (chave) {
                    documentos.push({ chave, nsu, dhEmi, emitente, valorNF, numero, natOp, ufEmitente })
                }
            } catch {
                // Documento inválido, pular
            }
        }
    }

    return { documentos, ultNSU, maxNSU }
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

    console.log(`[SEFAZ] Enviando requisição para ${endpoint} (CNPJ: ${cnpj})`)

    const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/soap+xml; charset=utf-8',
            'SOAPAction': 'http://www.portalfiscal.inf.br/nfe/wsdl/NFeDistribuicaoDFe/nfeDistDFeInteresse', // Tentar com Action explícita
        },
        body,
        // @ts-expect-error Node.js only
        agent,
    })

    console.log(`[SEFAZ] Resposta HTTP: ${response.status} ${response.statusText}`)

    if (!response.ok) {
        const errorText = await response.text()
        console.error(`[SEFAZ] Erro Response Body: ${errorText.substring(0, 500)}`)
        throw new Error(`SEFAZ retornou HTTP ${response.status}: ${response.statusText}`)
    }
    return response.text()
}

// ── Server Action principal: sincronizar NF-es da SEFAZ ──────────────────────

export type SyncResult =
    | { success: true; importadas: number; message: string }
    | { success: false; error: string }

export async function syncNFesFromSEFAZ(): Promise<SyncResult> {
    const user = await getAuthUser()
    if (!user) return { success: false, error: 'Não autenticado.' }

    // Buscar empresa ativa do usuário
    const { data: empresa } = await supabaseAdmin
        .from('empresas')
        .select('cnpj, ambiente_sefaz')
        .eq('user_id', user.id)
        .eq('ativo', true)
        .single()

    if (!empresa) {
        return { success: false, error: 'Nenhuma empresa configurada. Configure o certificado primeiro.' }
    }

    const cnpj = empresa.cnpj.replace(/\D/g, '')
    const ambiente = (empresa.ambiente_sefaz ?? 'producao') as 'producao' | 'homologacao'

    // Buscar último NSU processado
    const { data: syncState } = await supabaseAdmin
        .from('nfe_sync_state')
        .select('ultimo_nsu')
        .eq('user_id', user.id)
        .eq('empresa_cnpj', cnpj)
        .single()

    let ultNSU = syncState?.ultimo_nsu ?? 0

    // Construir agent mTLS
    let agent: https.Agent
    try {
        agent = await buildSefazAgent()
    } catch (e) {
        const msg = e instanceof Error ? e.message : String(e)
        return { success: false, error: `Certificado não disponível: ${msg}` }
    }

    let totalImportadas = 0
    let continuar = true

    while (continuar) {
        let xmlResposta: string
        try {
            xmlResposta = await chamarDistDFe(agent, cnpj, ultNSU, ambiente)
        } catch (e) {
            const msg = e instanceof Error ? e.message : String(e)
            return { success: false, error: `Falha na conexão com SEFAZ: ${msg}` }
        }

        // Verificar código de retorno
        const cStat = extrairTag(xmlResposta, 'cStat')
        const xMotivo = extrairTag(xmlResposta, 'xMotivo')

        // cStat 137 = nenhum documento, 138 = documentos encontrados
        if (cStat === '137') {
            continuar = false
            break
        }

        if (cStat !== '138') {
            return { success: false, error: `SEFAZ: ${cStat} - ${xMotivo}` }
        }

        const { documentos, ultNSU: novoUltNSU, maxNSU } = parsearDocumentos(xmlResposta)

        // Salvar documentos no banco
        for (const doc of documentos) {
            const nfeData = {
                user_id: user.id,
                empresa_cnpj: cnpj,
                chave: doc.chave,
                numero: doc.numero ?? '',
                emitente: doc.emitente ?? 'Desconhecido',
                valor: parseFloat(doc.valorNF ?? '0') || 0,
                status: 'recebida' as const,
                data_emissao: doc.dhEmi ? new Date(doc.dhEmi).toISOString() : new Date().toISOString(),
                nsu: parseInt(doc.nsu),
                nat_op: doc.natOp ?? null,
                uf_emitente: doc.ufEmitente ?? null,
            }

            await supabaseAdmin
                .from('nfes')
                .upsert(nfeData, { onConflict: 'chave' })

            totalImportadas++
        }

        ultNSU = novoUltNSU

        // Se maxNSU > ultNSU, há mais documentos para buscar
        continuar = maxNSU > novoUltNSU && documentos.length > 0
    }

    // Salvar estado de sincronização
    await supabaseAdmin
        .from('nfe_sync_state')
        .upsert(
            {
                user_id: user.id,
                empresa_cnpj: cnpj,
                ultimo_nsu: ultNSU,
                ultima_sync: new Date().toISOString(),
            },
            { onConflict: 'user_id,empresa_cnpj' }
        )

    revalidatePath('/dashboard')
    revalidatePath('/dashboard/nfe')

    return {
        success: true,
        importadas: totalImportadas,
        message: totalImportadas > 0
            ? `${totalImportadas} nota(s) importada(s) com sucesso.`
            : 'Nenhuma nota nova encontrada na SEFAZ.',
    }
}

// ── Listar NF-es do mês vigente (ou período selecionado) ─────────────────────

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
        .select('ultima_sync, empresa_cnpj')
        .eq('user_id', user.id)
        .order('ultima_sync', { ascending: false })
        .limit(1)
        .single()

    return data?.ultima_sync ?? null
}

// ── Métricas do dashboard ─────────────────────────────────────────────────────

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

    // Executar queries em paralelo
    const [mesMes, hoje, pendentes, syncState] = await Promise.all([
        supabaseAdmin
            .from('nfes')
            .select('id', { count: 'exact', head: true })
            .eq('user_id', user.id)
            .gte('data_emissao', inicioMes)
            .lte('data_emissao', fimMes),

        supabaseAdmin
            .from('nfes')
            .select('id', { count: 'exact', head: true })
            .eq('user_id', user.id)
            .gte('data_emissao', inicioHoje)
            .lte('data_emissao', fimHoje),

        supabaseAdmin
            .from('nfes')
            .select('id', { count: 'exact', head: true })
            .eq('user_id', user.id)
            .eq('status', 'recebida'),

        supabaseAdmin
            .from('nfe_sync_state')
            .select('ultima_sync')
            .eq('user_id', user.id)
            .order('ultima_sync', { ascending: false })
            .limit(1)
            .single(),
    ])

    const ultimaSync = syncState.data?.ultima_sync ?? null

    let integracaoStatus: DashboardMetrics['integracaoStatus'] = 'nunca_sincronizado'
    if (ultimaSync) {
        integracaoStatus = 'ativa'
    }

    return {
        recebidosHoje: hoje.count ?? 0,
        pendentes: pendentes.count ?? 0,
        totalMes: mesMes.count ?? 0,
        ultimaSync,
        integracaoStatus,
    }
}
