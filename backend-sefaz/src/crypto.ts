import crypto from 'crypto'
import dotenv from 'dotenv'

dotenv.config()

function getEncryptionKey() {
    const key = process.env.CERTIFICATE_ENCRYPTION_KEY
    if (!key) throw new Error('CERTIFICATE_ENCRYPTION_KEY não definida.')
    // Ajustar se a key não tiver 32 bytes (hash sha256 para garantir)
    return crypto.createHash('sha256').update(String(key)).digest()
}

const IV_LENGTH = 16

export function decrypt(text: string): string {
    const textParts = text.split(':')
    const iv = Buffer.from(textParts.shift()!, 'hex')
    const encryptedText = Buffer.from(textParts.join(':'), 'hex')
    const decipher = crypto.createDecipheriv('aes-256-cbc', getEncryptionKey(), iv)
    let decrypted = decipher.update(encryptedText)
    decrypted = Buffer.concat([decrypted, decipher.final()])
    return decrypted.toString()
}
