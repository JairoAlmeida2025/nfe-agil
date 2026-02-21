/**
 * Helpers de validação do Master Admin.
 * 
 * MASTER_ADMIN_EMAILS define os emails com acesso ao painel /admin.
 * Sempre validar no server-side antes de rodar queries globais.
 */

export const MASTER_ADMIN_EMAILS = (process.env.MASTER_ADMIN_EMAILS ?? '')
    .split(',')
    .map(e => e.trim().toLowerCase())
    .filter(Boolean)

/**
 * Verifica se um email pertence à lista de admins master.
 */
export function isMasterAdminEmail(email: string | null | undefined): boolean {
    if (!email) return false
    return MASTER_ADMIN_EMAILS.includes(email.toLowerCase())
}
