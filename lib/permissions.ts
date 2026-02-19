// ── Tipos de role ─────────────────────────────────────────────────────────────

export type UserRole = 'admin' | 'user'

// ── Mapa de permissões por role ───────────────────────────────────────────────
// Arquivo sem 'use server' — pode exportar qualquer valor, inclusive objetos

export const PERMISSIONS: Record<UserRole, readonly string[]> = {
    admin: [
        'certificado:upload',
        'certificado:revogar',
        'empresa:editar',
        'usuarios:gerenciar',
        'nfe:sincronizar',
        'nfe:visualizar',
        'nfe:download',
    ],
    user: [
        'nfe:visualizar',
        'nfe:download',
        'nfe:sincronizar',
    ],
}
