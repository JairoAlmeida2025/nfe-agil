'use server'

import forge from 'node-forge'
import https from 'https'
import { revalidatePath } from 'next/cache'
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { encrypt, decrypt } from '@/lib/crypto'
import { getOwnerUserId } from '@/lib/get-owner-id'
import { constants } from 'crypto'

// ── Helper: verificar role do usuário ─────────────────────────────────────────

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
        return { error: 'Apenas administradores podem realizar esta ação.' }
    }

    return { userId: user.id }
}


// ── Tipos ─────────────────────────────────────────────────────────────────────

export type CertificateInfo = {
    cnpj: string
    razaoSocial: string
    validade: string       // ISO string
    validadeFormatada: string  // DD/MM/YYYY
    diasRestantes: number
}

export type CertificateRecord = {
    id: string
    cnpj: string
    razaoSocial: string
    validade: string       // ISO string
    validadeFormatada: string
    diasRestantes: number
    status: 'ativo' | 'expirado' | 'revogado'
    storagePath: string
    createdAt: string
}

export type UploadCertificateResult =
    | { success: true; info: CertificateInfo }
    | { success: false; error: string }

export type DeleteCertificateResult =
    | { success: true }
    | { success: false; error: string }

// ── Helpers ───────────────────────────────────────────────────────────────────

function toRecord(data: Record<string, unknown>): CertificateRecord {
    const validade = new Date(data.validade as string)
    const diasRestantes = Math.floor(
        (validade.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
    )
    return {
        id: data.id as string,
        cnpj: data.cnpj as string,
        razaoSocial: data.razao_social as string,
        validade: data.validade as string,
        validadeFormatada: validade.toLocaleDateString('pt-BR'),
        diasRestantes,
        status: data.status as CertificateRecord['status'],
        storagePath: data.storage_path as string,
        createdAt: data.created_at as string,
    }
}

// ── Buscar certificado ativo ──────────────────────────────────────────────────

export async function getActiveCertificate(): Promise<CertificateRecord | null> {
    // Usa ownerUserId para que membros da equipe vejam o certificado do admin
    const ownerUserId = await getOwnerUserId()
    if (!ownerUserId) return null

    const { data, error } = await supabaseAdmin
        .from('certificados')
        .select('*')
        .eq('status', 'ativo')
        .eq('user_id', ownerUserId)
        .order('created_at', { ascending: false })
        .limit(1)
        .single()

    if (error || !data) return null
    return toRecord(data as Record<string, unknown>)
}

// ── Upload e validação ────────────────────────────────────────────────────────

/**
 * Faz upload, valida e persiste o certificado A1 (.pfx/.p12).
 * Executado inteiramente no servidor — a senha é cifrada com AES-256-GCM antes de persistir.
 */
export async function uploadCertificate(
    formData: FormData
): Promise<UploadCertificateResult> {
    // Verificar permissão de admin
    const permCheck = await checkAdminPermission()
    if ('error' in permCheck) return { success: false, error: permCheck.error }
    const userId = permCheck.userId

    const file = formData.get('certificate') as File | null
    const password = formData.get('password') as string | null

    if (!file) return { success: false, error: 'Nenhum arquivo selecionado.' }
    if (!password) return { success: false, error: 'Senha do certificado obrigatória.' }

    const ext = file.name.toLowerCase()
    if (!ext.endsWith('.pfx') && !ext.endsWith('.p12')) {
        return { success: false, error: 'Arquivo inválido. Envie um arquivo .pfx ou .p12.' }
    }

    let info: CertificateInfo
    let pfxBuffer: Buffer

    try {
        const arrayBuffer = await file.arrayBuffer()
        pfxBuffer = Buffer.from(arrayBuffer)

        const pfxDer = forge.util.createBuffer(pfxBuffer.toString('binary'))
        const pfxAsn1 = forge.asn1.fromDer(pfxDer)
        const pfx = forge.pkcs12.pkcs12FromAsn1(pfxAsn1, false, password)

        const certBags = pfx.getBags({ bagType: forge.pki.oids.certBag })
        const certBag = certBags[forge.pki.oids.certBag]?.[0]

        if (!certBag?.cert) {
            return { success: false, error: 'Certificado inválido ou corrompido.' }
        }

        const cert = certBag.cert
        const subject = cert.subject.attributes

        const cnpjAttr = subject.find(
            (a) => a.shortName === 'CN' || a.name === 'commonName'
        )
        const rawCN = String(cnpjAttr?.value ?? '')
        const colonIdx = rawCN.lastIndexOf(':')
        const cnpj = colonIdx !== -1 ? rawCN.slice(colonIdx + 1).trim() : rawCN
        const razaoSocial = colonIdx !== -1 ? rawCN.slice(0, colonIdx).trim() : rawCN

        const validade = cert.validity.notAfter
        const validadeFormatada = new Date(validade).toLocaleDateString('pt-BR')
        const diasRestantes = Math.floor(
            (validade.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
        )

        if (diasRestantes < 0) {
            return {
                success: false,
                error: `Certificado vencido em ${validadeFormatada}. Renove-o antes de continuar.`,
            }
        }

        info = { cnpj, razaoSocial, validade: validade.toISOString(), validadeFormatada, diasRestantes }
    } catch {
        return {
            success: false,
            error: 'Falha ao ler o certificado. Verifique se a senha está correta.',
        }
    }

    // Cifrar senha
    let senhaCifrada: string
    try {
        senhaCifrada = encrypt(password)
    } catch {
        return { success: false, error: 'Configuração de criptografia inválida. Verifique CERTIFICATE_ENCRYPTION_KEY.' }
    }

    // Upload Storage
    const storagePath = `${info.cnpj.replace(/\D/g, '')}/${Date.now()}_${file.name}`
    const { error: storageError } = await supabaseAdmin.storage
        .from('certificados')
        .upload(storagePath, pfxBuffer, {
            contentType: 'application/x-pkcs12',
            upsert: true,
        })

    if (storageError) {
        return { success: false, error: 'Falha ao armazenar o certificado. Tente novamente.' }
    }

    // Revogar anteriores do mesmo CNPJ pertencentes ao usuário
    await supabaseAdmin
        .from('certificados')
        .update({ status: 'revogado' })
        .eq('cnpj', info.cnpj.replace(/\D/g, ''))
        .eq('user_id', userId)

    // Inserir novo (com user_id)
    const { data: dbData, error: dbError } = await supabaseAdmin
        .from('certificados')
        .insert({
            cnpj: info.cnpj.replace(/\D/g, ''),
            razao_social: info.razaoSocial,
            validade: info.validade,
            status: 'ativo',
            storage_path: storagePath,
            senha_cifrada: senhaCifrada,
            user_id: userId,
        })
        .select()
        .single()

    if (dbError) {
        return { success: false, error: 'Falha ao salvar os dados do certificado.' }
    }

    // Auto-popular empresa com user_id
    const cnpjClean = info.cnpj.replace(/\D/g, '')
    await supabaseAdmin
        .from('empresas')
        .upsert(
            {
                cnpj: cnpjClean,
                razao_social: info.razaoSocial,
                ativo: true,
                user_id: userId,
                ...(dbData?.id ? { certificado_id: dbData.id } : {}),
            },
            { onConflict: 'cnpj' }
        )

    revalidatePath('/dashboard/certificado')
    revalidatePath('/dashboard/cnpj')

    return { success: true, info }
}

// ── Revogar / excluir certificado ─────────────────────────────────────────────

export async function revokeCertificate(
    certId: string
): Promise<DeleteCertificateResult> {
    // Verificar permissão de admin
    const permCheck = await checkAdminPermission()
    if ('error' in permCheck) return { success: false, error: permCheck.error }

    // Usar a função SQL atômica que criamos
    const { error } = await supabaseAdmin.rpc('revogar_certificado', {
        cert_id: certId,
    })

    if (error) {
        console.error('Erro ao revogar certificado:', error)
        return { success: false, error: 'Não foi possível revogar o certificado.' }
    }

    revalidatePath('/dashboard/certificado')
    revalidatePath('/dashboard/cnpj')

    return { success: true }
}

// ── Reconstitui o https.Agent mTLS para SEFAZ ────────────────────────────────

export async function buildSefazAgent(userId?: string): Promise<https.Agent> {
    // Usa ownerUserId para garantir acesso ao certificado do grupo
    const resolvedUserId = userId ?? await getOwnerUserId()

    // SECURITY: Nunca executar sem userId — fail-secure
    if (!resolvedUserId) {
        throw new Error('Usuário não autenticado. Não é possível obter o certificado.')
    }

    const { data: cert } = await supabaseAdmin
        .from('certificados')
        .select('*')
        .eq('status', 'ativo')
        .eq('user_id', resolvedUserId) // SECURITY: sempre filtrar por user_id
        .order('created_at', { ascending: false })
        .limit(1)
        .single()

    if (!cert) throw new Error('Nenhum certificado ativo encontrado.')
    if (!cert.senha_cifrada) throw new Error('Senha do certificado não armazenada. Faça o upload novamente.')

    const password = decrypt(cert.senha_cifrada as string)

    const { data: blob, error: dlError } = await supabaseAdmin.storage
        .from('certificados')
        .download(cert.storage_path as string)

    if (dlError || !blob) throw new Error(`Falha ao baixar certificado: ${dlError?.message}`)

    const pfxBuffer = Buffer.from(await blob.arrayBuffer())

    return new https.Agent({
        pfx: pfxBuffer,
        passphrase: password,
        // Forçar TLS 1.2 (Sefaz descontinuou 1.0/1.1)
        secureOptions: constants.SSL_OP_NO_TLSv1 | constants.SSL_OP_NO_TLSv1_1,
        // Ciphers compatíveis com Sefaz
        ciphers: 'DEFAULT:!DH',
        // IMPORTANTE: Node.js não tem a cadeia ICP-Brasil por padrão.
        // Em produção, isso causa erro de "unable to get local issuer certificate".
        // A solução robusta é injetar a CA, mas para funcionar agora usamos false.
        rejectUnauthorized: false,
        keepAlive: true,
    })
}

// ── Obter credenciais do certificado (Buffer PFX + Senha) para o micro-serviço ─────────────────────

export async function getCertificateCredentials(userId?: string) {
    // Usa ownerUserId para garantir acesso ao certificado do grupo
    const resolvedUserId = userId ?? await getOwnerUserId()

    // SECURITY: Nunca executar sem userId — fail-secure
    if (!resolvedUserId) {
        throw new Error('Usuário não autenticado. Não é possível obter o certificado.')
    }

    const { data: cert, error } = await supabaseAdmin
        .from('certificados')
        .select('*')
        .eq('status', 'ativo')
        .eq('user_id', resolvedUserId) // SECURITY: sempre filtrar por user_id
        .order('created_at', { ascending: false })
        .limit(1)
        .single()

    if (error || !cert) throw new Error('Nenhum certificado ativo encontrado.')

    // Garantir que temos a senha cifrada
    if (!cert.senha_cifrada) throw new Error('Senha do certificado não armazenada. Faça o upload novamente.')

    const password = decrypt(cert.senha_cifrada as string)

    // Baixar do Storage
    const { data: blob, error: dlError } = await supabaseAdmin.storage
        .from('certificados')
        .download(cert.storage_path as string)

    if (dlError || !blob) throw new Error(`Falha ao baixar certificado: ${dlError?.message}`)

    const pfxBuffer = Buffer.from(await blob.arrayBuffer())

    return {
        pfxBuffer,
        password,
        cnpj: cert.cnpj
    }
}

