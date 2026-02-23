'use server'

/**
 * actions/nfe-management.ts
 *
 * Server Actions para operações de gestão de NF-es:
 * - getNFeXmlContent: download do XML
 * - deleteNFe: exclusão
 * - updateNFeSituacao: atualização de situação (badge)
 *
 * Multi-tenant: usa getOwnerUserId() para resolver o dono dos dados.
 */

import { revalidatePath } from 'next/cache'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { getAuthUserId, getOwnerUserId } from '@/lib/get-owner-id'
import { NFE_STATUS } from '@/lib/constants'

// ── Helper: Autenticação + Resolução do dono ──────────────────────────────────

async function requireAuthWithOwner(): Promise<{ authUserId: string; ownerId: string }> {
    const authUserId = await getAuthUserId()
    if (!authUserId) throw new Error('Não autenticado. Faça login para continuar.')

    const ownerId = await getOwnerUserId()
    if (!ownerId) throw new Error('Não autenticado. Faça login para continuar.')

    return { authUserId, ownerId }
}

// ── Download XML ───────────────────────────────────────────────────────────────

export async function getNFeXmlContent(id: string) {
    const { ownerId } = await requireAuthWithOwner()

    const { data, error } = await supabaseAdmin
        .from('nfes')
        .select('xml_content, chave')
        .eq('id', id)
        .eq('user_id', ownerId)
        .single()

    if (error || !data) {
        throw new Error('XML não encontrado ou acesso negado.')
    }

    if (!data.xml_content) {
        throw new Error('XML ainda não disponível para esta nota.')
    }

    return {
        xml: data.xml_content,
        chave: data.chave,
    }
}

// ── Deletar Nota ───────────────────────────────────────────────────────────────

export async function deleteNFe(id: string) {
    const { authUserId, ownerId } = await requireAuthWithOwner()

    const { data: profile } = await supabaseAdmin
        .from('profiles')
        .select('role')
        .eq('id', authUserId)
        .single()

    if (profile?.role !== 'admin') {
        throw new Error('Apenas o administrador pode deletar notas fiscais.')
    }

    const { error } = await supabaseAdmin
        .from('nfes')
        .delete()
        .eq('id', id)
        .eq('user_id', ownerId)

    if (error) {
        throw new Error(`Erro ao deletar nota: ${error.message}`)
    }

    revalidatePath('/dashboard/nfe')
    return { success: true }
}

// ── Integração SEFAZ ───────────────────────────────────────────────────────────

async function fetchFiscal(path: string, options: RequestInit = {}) {
    let microUrl = process.env.MICRO_SEFAZ_URL
    if (!microUrl) throw new Error('MICRO_SEFAZ_URL não configurada')
    if (microUrl.endsWith('/')) microUrl = microUrl.slice(0, -1)

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 60_000)

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
        if (e.name === 'AbortError') throw new Error('Timeout de conexão com Micro-serviço (60s)')
        throw e
    } finally {
        clearTimeout(timeoutId)
    }
}

import { getActiveCertificate } from '@/actions/certificate'
import { decrypt } from '@/lib/crypto'

export async function manifestarSefaz(id: string, chave: string, tipoEvento: '210200' | '210220' | '210240', situacaoVisual: typeof NFE_STATUS.CONFIRMADA | typeof NFE_STATUS.RECUSADA) {
    const { ownerId } = await requireAuthWithOwner()

    // 1. Pegar metadados do certificado ativo
    const { data: certRow, error: certErr } = await supabaseAdmin
        .from('certificados')
        .select('*')
        .eq('status', 'ativo')
        .eq('user_id', ownerId)
        .order('created_at', { ascending: false })
        .limit(1)
        .single()

    if (certErr || !certRow) {
        throw new Error('Nenhum certificado digital ativo encontrado para sua empresa.')
    }

    // 2. Descriptografar a senha
    const password = decrypt(certRow.senha_cifrada as string)

    // 3. Baixar o arquivo PFX do Storage
    const { data: pfxBlob, error: storageErr } = await supabaseAdmin.storage
        .from('certificados')
        .download(certRow.storage_path)

    if (storageErr || !pfxBlob) {
        throw new Error('Falha ao obter o arquivo do certificado no servidor.')
    }

    const arrayBuffer = await pfxBlob.arrayBuffer()
    const pfxBuffer = Buffer.from(arrayBuffer)

    // 4. Enviar para Micro-serviço
    const resp = await fetchFiscal('/sefaz/manifestacao', {
        method: 'POST',
        body: JSON.stringify({
            cnpj: certRow.cnpj.replace(/\D/g, ''),
            chave,
            tipoEvento, // 210200 Confirmação, 210220 Desconhecimento, 210240 Não Realizada
            pfxBase64: pfxBuffer.toString('base64'),
            passphrase: password
        })
    })

    if (!resp.ok) {
        const errorBody = await resp.json().catch(() => ({}))
        throw new Error(errorBody.error || `Erro HTTP ${resp.status} do serviço fiscal.`)
    }

    const resBody = await resp.json()

    // 4. Validar cStat 
    // 135 = Evento Vinculado
    // 136 = Evento já registrado anteriormente
    // 128 = Lote de evento processado
    if (resBody.cStat !== '135' && resBody.cStat !== '136' && resBody.cStat !== '128') {
        throw new Error(`Rejeição SEFAZ (${resBody.cStat}): ${resBody.xMotivo}`)
    }

    const textoManifestacao = tipoEvento === '210200' ? 'confirmacao'
        : tipoEvento === '210220' ? 'desconhecimento'
            : 'nao_realizada'

    // 5. Atualizar no banco
    const { error } = await supabaseAdmin
        .from('nfes')
        .update({
            situacao: situacaoVisual,
            manifestacao: textoManifestacao,
            data_manifestacao: new Date().toISOString()
        })
        .eq('id', id)
        .eq('user_id', ownerId)

    if (error) {
        throw new Error(`Manifestação enviada, mas erro ao atualizar banco: ${error.message}`)
    }

    revalidatePath('/dashboard/nfe')
    return { success: true, cStat: resBody.cStat, xMotivo: resBody.xMotivo }
}
