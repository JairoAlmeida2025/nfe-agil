import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
// ⚠️ Service role key: acesso total, sem RLS. NUNCA expor ao cliente.
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

/**
 * Cliente administrativo com service_role.
 * Use APENAS em Server Actions ou Route Handlers (server-side).
 * Jamais importe em componentes 'use client'.
 */
export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
        autoRefreshToken: false,
        persistSession: false,
    },
})
