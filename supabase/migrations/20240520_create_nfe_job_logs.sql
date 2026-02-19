-- Tabela de logs de jobs fiscais (sync/manifestacao)
CREATE TABLE IF NOT EXISTS public.nfe_job_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    tipo_job TEXT NOT NULL CHECK (tipo_job IN ('sync', 'manifestacao')),
    inicio TIMESTAMPTZ DEFAULT NOW(),
    fim TIMESTAMPTZ,
    total_processado INT DEFAULT 0,
    sucesso BOOLEAN DEFAULT FALSE,
    erro_resumido TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS
ALTER TABLE public.nfe_job_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service Role Full Access" ON public.nfe_job_logs
    FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_nfe_job_logs_created_at ON public.nfe_job_logs(created_at DESC);
