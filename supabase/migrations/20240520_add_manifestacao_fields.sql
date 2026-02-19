-- Adicionar campos de manifestação na tabela nfes
ALTER TABLE public.nfes ADD COLUMN IF NOT EXISTS manifestacao TEXT;
ALTER TABLE public.nfes ADD COLUMN IF NOT EXISTS data_manifestacao TIMESTAMPTZ;

-- Adicionar índice para otimizar busca de notas pendentes de manifestação
CREATE INDEX IF NOT EXISTS idx_nfes_manifestacao ON public.nfes(status, manifestacao) WHERE status = 'recebida' AND manifestacao IS NULL;
