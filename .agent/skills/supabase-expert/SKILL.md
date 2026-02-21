---
name: supabase-expert
description: Concise guide and reference on Supabase best practices, database architecture, security (RLS), and CLI utilization based on official documentation. Triggers on supabase, database, rls, migration, realtime, backend, postgres.
---

# Supabase Best Practices & Guidelines

Este é o manual do agente para implementação, segurança e manutenção de projetos Next.js utilizando **Supabase**. Quando o usuário solicitar operações de banco de dados, migrações, políticas ou integrações com Supabase, utilize as diretrizes abaixo.

🔗 **Link Oficial de Referência:** [https://supabase.com/docs](https://supabase.com/docs)

## When to Use This Skill

- Consultas sobre "Como fazer no Supabase?"
- Criação e atualização de tabelas (Migrations via Supabase CLI).
- Geração de Tipagens para TypeScript.
- Configuração de Segurança de Banco de Dados (Row Level Security - RLS).
- Otimizações de consultas e performance no Postgres.
- Manipulação de Realtime, Storage e Edge Functions.

---

## 🏗️ 1. Arquitetura e Fluxo de Desenvolvimento

Supabase é um encapsulamento poderoso sobre o PostgreSQL. A regra fundamental é tratar o banco de dados como a **verdade absoluta** através de código.

*   **Evite cliques no Dashboard para produção:** Em ambiente local ou dev, explorar a interface é normal, mas todas as alterações de esquema **devem** virar migrações SQL.
*   **Fluxo Local-Primeiro:** 
    1. Utilize a Supabase CLI (`supabase start`, `supabase migration new minha_migracao`).
    2. Escreva o SQL (ou gere a partir do diff).
    3. Aplique (`supabase db reset` ou `supabase migration up`).
    4. Atualize as tipagens: `supabase gen types typescript --local > types/supabase.ts`.

## 🔒 2. Segurança e RLS (Row Level Security)

A segurança no Supabase é feita na camada do PostgreSQL e não apenas na API/Backend.
*   **Bloqueio por Defeito:** TODA nova tabela criada que seja exposta na API deve ter o RLS ativado.
    ```sql
    ALTER TABLE public.minha_tabela ENABLE ROW LEVEL SECURITY;
    ```
*   **Políticas de Acesso (Policies):**
    *   Sempre filtre utilizando `auth.uid()`.
    *   Separe operações (`SELECT`, `INSERT`, `UPDATE`, `DELETE`).
    ```sql
    CREATE POLICY "Usuário vê apenas seus dados"
    ON public.minha_tabela FOR SELECT 
    USING ( auth.uid() = user_id );
    ```
*   **Chaves:**
    *   `ANON_KEY`: Única chave que deve ir para o Frontend (`NEXT_PUBLIC_...`). Totalmente segura SE o RLS estiver bem configurado.
    *   `SERVICE_ROLE_KEY`: A chave admin, ignora qualquer RLS. **JAMAIS** exponha isso no frontend. Utilize estritamente em Node.js / Server Actions (`process.env.SUPABASE_SERVICE_ROLE_KEY`).

## 🚀 3. Performance e Indexação

Como o Supabase é PostreSQL puro, sinta-se livre para usar os superpoderes do Postgres.
*   **Índices (B-Tree, GIN):** Colunas usadas frequentemente em `.eq()`, `.match()` e ligações de Chaves Estrangeiras (`REFERENCES`) necessitam de indexação para evitar lentidão conforme a tabela cresce.
    ```sql
    CREATE INDEX idx_minha_tabela_user_id ON public.minha_tabela(user_id);
    ```
*   **Visualizações (Views):** Consultas pesadas ou dashboards devem se apoiar em Views ou Materialized Views em vez de enviar a lógica computacional complexa para Client Side ou Edge/Node.
*   **Paginação e Filtros:** Sempre aplique limites (`.limit()`) e partições (`.range()`) em grandes chamadas API do `@supabase/supabase-js`.

## ⚡ 4. Realtime (WebSockets)

Para habilitar atualizações ao vivo:
1. O recurso precisa estar ligado ao nível da Tabela e da Publicação no Postgres:
   ```sql
   ALTER PUBLICATION supabase_realtime ADD TABLE minha_tabela;
   ```
2. No Frontend Client (Componentes React), faça a inscrição ouvindo eventos específicos para evitar estourar o limite de conexões e onerar renderizações desnecessárias da UI (use filtros, como `.on('postgres_changes', { filter: 'user_id=eq.'+id })`).

## 🗃️ 5. Ferramentas do Agente

Quando operando sobre um projeto via **Trae / Antigravity**, o agente deve utilizar o **MCP Supabase** (quando disponível) para consultar as tabelas do estado atual, executar migrações ou ver erros/logs sem precisar sair do editor.
*   Recorra sempre as ferramentas do MCP como `mcp_supabase-mcp-server...` para agilizar verificações.

## 📝 Resumo de Boas Práticas (Checklist)

1. [ ] RLS ativado em tabelas públicas?
2. [ ] FKs e PKs devidamente associadas e indexadas?
3. [ ] `ON DELETE CASCADE` ou `SET NULL` devidamente planejado para segurança de integridade referencial?
4. [ ] Operações de administração (criação de usuário bypass) encapsuladas em backend usando a `service_role_key`?
5. [ ] Arquivo `types/supabase.ts` está compatível com as mudanças do banco de dados?
