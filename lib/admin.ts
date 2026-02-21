/**
 * Helpers de validação do Master Admin (dono do SaaS).
 *
 * O email master é definido pela variável de ambiente MASTER_ADMIN_EMAILS.
 *
 * IMPORTANTE: Para que funcione na Vercel, a variável MASTER_ADMIN_EMAILS
 * DEVE ser configurada no painel da Vercel → Settings → Environment Variables.
 *
 * Master admins:
 *  - Acessam SOMENTE o painel /admin (nunca /dashboard)
 *  - NÃO possuem profile, empresa_membros ou subscription
 *  - São completamente separados dos clientes do SaaS
 */

export const MASTER_ADMIN_EMAILS = (process.env.MASTER_ADMIN_EMAILS ?? '')
    .split(',')
    .map(e => e.trim().toLowerCase())
    .filter(Boolean)

/**
 * Verifica se um email pertence à lista de master admins.
 */
export function isMasterAdminEmail(email: string | null | undefined): boolean {
    if (!email) return false
    return MASTER_ADMIN_EMAILS.includes(email.toLowerCase().trim())
}
