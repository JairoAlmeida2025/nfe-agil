/**
 * Módulo de criptografia para dados sensíveis do servidor.
 * Usa AES-256-GCM (autenticado) para cifrar/decifrar a senha do certificado.
 * A chave vem EXCLUSIVAMENTE de variável de ambiente servidor (nunca NEXT_PUBLIC_).
 */

import crypto from 'crypto'

const ALGORITHM = 'aes-256-gcm'
const IV_LENGTH = 12   // GCM padrão: 96 bits
const TAG_LENGTH = 16  // GCM auth tag: 128 bits

function getKey(): Buffer {
    const hex = process.env.CERTIFICATE_ENCRYPTION_KEY
    if (!hex || hex.length !== 64) {
        throw new Error(
            'CERTIFICATE_ENCRYPTION_KEY inválida. Deve ser 32 bytes em hex (64 chars). ' +
            'Gere com: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"'
        )
    }
    return Buffer.from(hex, 'hex')
}

/**
 * Cifra texto com AES-256-GCM.
 * Retorna string no formato: iv:authTag:ciphertext (tudo em hex).
 */
export function encrypt(plaintext: string): string {
    const key = getKey()
    const iv = crypto.randomBytes(IV_LENGTH)
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv, { authTagLength: TAG_LENGTH })

    const encrypted = Buffer.concat([
        cipher.update(plaintext, 'utf8'),
        cipher.final(),
    ])

    return [
        iv.toString('hex'),
        cipher.getAuthTag().toString('hex'),
        encrypted.toString('hex'),
    ].join(':')
}

/**
 * Decifra string no formato iv:authTag:ciphertext.
 */
export function decrypt(ciphertext: string): string {
    const parts = ciphertext.split(':')
    if (parts.length !== 3) throw new Error('Formato de ciphertext inválido.')

    const [ivHex, tagHex, encHex] = parts
    const key = getKey()
    const iv = Buffer.from(ivHex, 'hex')
    const tag = Buffer.from(tagHex, 'hex')
    const enc = Buffer.from(encHex, 'hex')

    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv, { authTagLength: TAG_LENGTH })
    decipher.setAuthTag(tag)

    return decipher.update(enc).toString('utf8') + decipher.final('utf8')
}
