-- 1. Corrige Aviso: "Function Search Path Mutable" (Risco de Injeção de Schema)
-- Adiciona um caminho de busca explícito nas funções para evitar execuções maliciosas.
ALTER FUNCTION public.handle_new_user() SET search_path = public;
ALTER FUNCTION public.match_documents(vector, integer, jsonb) SET search_path = public;
ALTER FUNCTION public.update_updated_at() SET search_path = public;
ALTER FUNCTION public.get_owner_user_id(uuid) SET search_path = public;

-- 2. Corrige Aviso: "RLS Policy Always True" 
-- A política antiga 'bd_ativo' permitia QUALQUER operação (INSERT/UPDATE/DELETE) 
-- para QUALQUER usuário porque usava `ALL USING (true) WITH CHECK (true)`.
DROP POLICY IF EXISTS "bd_ativo" ON public.bd_ativo;

ALTER TABLE public.bd_ativo ENABLE ROW LEVEL SECURITY;

-- Substitui por uma permissão de apenas leitura (SELECT) se houver necessidades públicas
CREATE POLICY "Leitura irrestrita para bd_ativo" 
ON public.bd_ativo 
FOR SELECT 
USING (true);

-- Operações de gravação (Insert/Update/Delete) nesta tabela só poderão
-- ser feitas pelo Admin (Service Role) no Backend, pois bloqueamos as demais ações por omissão do RLS.

-- NOTA: O aviso "Leaked Password Protection Disabled" deve ser ativado manualmente
-- no painel (Dashboard) do Supabase em Authentication > Configuração > Security.

-- NOTA: O aviso "Extension in Public" sobre a extensão `vector` pode quebrar a tipagem de outras tabelas 
-- do seu sistema se for migrada para outro schema arbitrariamente agora, pois a recomendação oficial
-- de criar em um schema "extensions" deveria ser feita na raiz do projeto vazio. Foi mantido em public
-- por segurança estrutural do que mover e quebrar sua tabela operations/documents.
