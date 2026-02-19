-- Criação da tabela de logs para cron jobs
CREATE TABLE IF NOT EXISTS public.cron_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    executed_at TIMESTAMPTZ DEFAULT NOW(),
    duration TEXT,
    processed_count INT DEFAULT 0,
    status TEXT NOT NULL,
    message TEXT,
    details JSONB
);

-- Habilitar RLS para segurança
ALTER TABLE public.cron_logs ENABLE ROW LEVEL SECURITY;

-- Política para permitir apenas service_role (backend cron) escrever e ler
CREATE POLICY "Service Role Full Access" ON public.cron_logs
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- Política para desenvolvedores/admin? (opcional)
-- CREATE POLICY "Admin Read" ON public.cron_logs FOR SELECT TO authenticated USING (auth.jwt() ->> 'role' = 'service_role');
