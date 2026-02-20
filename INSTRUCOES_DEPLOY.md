# 🚀 Instruções de Deploy (Vercel + Supabase)

O projeto está pronto para ir ao ar! Siga estes passos para colocar tudo funcionando em produção.

## 1️⃣ GitHub Desktop (Subir o código)

1. Abra o **GitHub Desktop**.
2. Vá em **File > Add Local Repository**.
3. Selecione a pasta do projeto: `c:\trae\nfe-agil`.
4. Ele vai perguntar se quer criar um repositório. Clique em **create a repository**.
5. Em **Git Ignore**, selecione **Node**. (Isso é redundante com nosso `.gitignore`, mas não faz mal).
6. Clique em **Create Repository**.
7. Clique em **Publish repository** na barra superior.
8. Dê o nome `nfe-agil` (ou outro) e publique (pode ser privado se preferir).

---

## 2️⃣ Vercel (Hospedagem)

1. Acesse [vercel.com](https://vercel.com) e faça login com seu GitHub.
2. Clique em **Add New > Project**.
3. Importe o repositório `nfe-agil` que você acabou de criar.
4. Na tela de configuração **Configure Project**:
   - **Framework Preset**: Next.js (já deve estar selecionado).
   - **Root Directory**: `.` (padrão).
   - **Environment Variables**: EXPANDA esta seção e adicione TODAS as variáveis abaixo:

```
NEXT_PUBLIC_SUPABASE_URL=https://ncorntmwslmcdwejwkmc.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_IxlKcoM3pqQaUh2Hnb2MMQ_-SV5k5fd
SUPABASE_SERVICE_ROLE_KEY=<sua service_role key do Supabase>
CERTIFICATE_ENCRYPTION_KEY=<sua chave de 64 hex chars do .env.local>
NEXT_PUBLIC_APP_URL=https://nfe-agil.vercel.app  ← Preencher após primeiro deploy
MICRO_SEFAZ_URL=https://api-fiscal.automacoesai.com
FISCAL_SECRET=9a8f12c4-e6b7-4d89-9a2c-123456789abc
INTERNAL_SYNC_SECRET=nfe-agil-cron-2025
CRON_SECRET=pnKGHCgSDWCXV2E7lLimcfm5kki3NoaB
```

5. Clique em **Deploy**.
6. Após o deploy, pegue a URL gerada (ex: `https://nfe-agil.vercel.app`) e:
   - Volte em **Settings > Environment Variables** na Vercel.
   - Atualize `NEXT_PUBLIC_APP_URL` com essa URL.

---

## 3️⃣ Supabase (Edge Function Secrets)

Para que o **auto-sync automático** funcione (via Edge Function `nfe-auto-sync`):

1. Acesse [supabase.com/dashboard](https://supabase.com/dashboard).
2. Vá no projeto **NF-e Agil**.
3. Vá em **Edge Functions > nfe-auto-sync > Settings**.
4. Adicione os seguintes secrets:
   - `MICRO_SEFAZ_URL` = `https://api-fiscal.automacoesai.com`
   - `FISCAL_SECRET` = `9a8f12c4-e6b7-4d89-9a2c-123456789abc`
   - `INTERNAL_SYNC_SECRET` = `nfe-agil-cron-2025`
   - `NEXT_PUBLIC_APP_URL` = `https://nfe-agil.vercel.app` ← URL real de produção
   - `SUPABASE_SERVICE_ROLE_KEY` = sua service_role key

---

## 4️⃣ Supabase (Auth Configuration)

Para que o login e "Esqueci a Senha" funcionem em produção:

1. Vá em **Authentication > URL Configuration**.
2. Em **Site URL**, coloque: `https://nfe-agil.vercel.app`
3. Em **Redirect URLs**, adicione:
   - `https://nfe-agil.vercel.app/**`
   - `http://localhost:3000/**`
4. Salve.

---

## 5️⃣ Verificar Sincronização Automática

O sistema possui **duas camadas de agendamento automático**:

### Camada 1: pg_cron (Supabase Database)
- **Horário**: 10:00 UTC (07:00 BRT - America/Sao_Paulo)
- **Ação**: Chama a Edge Function `nfe-auto-sync` via HTTP
- **Verificar**: Supabase Dashboard > Database > Extensions > pg_cron

### Camada 2: Vercel Cron Jobs  
- **Horário**: 10:00 UTC (07:00 BRT)
- **Endpoint**: `/api/internal/sync-daily`
- **Configuração**: `vercel.json`
- **Verificar**: Vercel Dashboard > Settings > Cron Jobs

### Logs de execução:
- `cron_logs` - historico de cada execução automática
- `nfe_job_logs` - detalhes de cada job de sync
- `nfe_sync_state` - NSU atual e data da última sync

---

## ✅ Pronto!

Após configurar tudo:
1. A sincronização roda automaticamente todo dia às **07:00 BRT**
2. O usuário pode sincronizar manualmente clicando em **Importar da SEFAZ**
3. O painel mostra badge atualizado com status, última sync, próxima sync e NSU
4. Todos os logs ficam em `cron_logs`, `nfe_job_logs` e `nfe_sync_state`
