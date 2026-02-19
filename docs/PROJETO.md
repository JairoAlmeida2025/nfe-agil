# NF-e Ágil – Documentação Técnica Completa

> Sistema interno de gestão de Notas Fiscais Eletrônicas com integração direta à SEFAZ via certificado digital A1.

---

## Sumário

1. [Visão Geral](#1-visão-geral)
2. [Objetivos do Projeto](#2-objetivos-do-projeto)
3. [Personas](#3-personas)
4. [Stack Tecnológica](#4-stack-tecnológica)
5. [Arquitetura](#5-arquitetura)
6. [Funcionalidades Implementadas](#6-funcionalidades-implementadas)
7. [Funcionalidades Pendentes](#7-funcionalidades-pendentes)
8. [Estrutura do Banco de Dados](#8-estrutura-do-banco-de-dados)
9. [Estrutura de Arquivos do Projeto](#9-estrutura-de-arquivos-do-projeto)
10. [Server Actions (Backend)](#10-server-actions-backend)
11. [Fluxo Principal do Usuário](#11-fluxo-principal-do-usuário)
12. [Mapa de Telas](#12-mapa-de-telas)
13. [Segurança](#13-segurança)
14. [Variáveis de Ambiente](#14-variáveis-de-ambiente)
15. [Como Rodar Localmente](#15-como-rodar-localmente)
16. [Problemas Conhecidos e Dívidas Técnicas](#16-problemas-conhecidos-e-dívidas-técnicas)
17. [Roadmap](#17-roadmap)

---

## 1. Visão Geral

O **NF-e Ágil** é um sistema web interno desenvolvido para centralizar, automatizar e garantir o acesso contínuo às NF-es emitidas contra o CNPJ da empresa, com integração direta à SEFAZ via Distribuição DFe.

### O problema que resolve

Antes do NF-e Ágil, a empresa dependia de processos manuais para obter XMLs e DANFEs dos fornecedores. Esse processo gerava:

- Risco de perda de documentos fiscais
- Retrabalho da equipe administrativa e fiscal
- Exposição a problemas fiscais por ausência de manifestação ou arquivamento

### A solução

Captura automática de NF-es via Distribuição DFe da SEFAZ, usando certificado digital A1, com armazenamento seguro, consulta filtrada e download de XML/PDF.

---

## 2. Objetivos do Projeto

### v1 (MVP – em desenvolvimento)

- [x] Autenticação segura com confirmação por e-mail
- [x] Cadastro e gerenciamento do CNPJ da empresa
- [x] Upload e gerenciamento do certificado digital A1
- [x] Captura automática de NF-es via SEFAZ (Distribuição DFe)
- [x] Listagem de NF-es com filtros por período, emitente e status
- [ ] Download do XML armazenado
- [ ] Geração e visualização do DANFE (PDF)
- [ ] Consulta por chave de acesso (44 dígitos)
- [ ] Sincronização automática diária (Edge Function / Cron)
- [ ] Tela de monitoramento com histórico de sincronizações
- [ ] Registro de atividades (auditoria de downloads e visualizações)

### Indicadores de Sucesso

- 100% das NF-es emitidas contra o CNPJ capturadas automaticamente
- Zero perda de XML após implantação
- Uso ativo ao menos 3x/semana pela equipe interna
- Eliminação completa do processo manual anterior

---

## 3. Personas

### Analista Fiscal
Garante que todas as NF-es estejam armazenadas para escrituração e auditoria. Usa a listagem para verificar captura diária.

### Equipe Financeira / Contas a Pagar
Consulta notas recebidas para conferência e validação de pagamentos. Usa filtros por fornecedor e valor.

### Gestor Administrativo
Acompanha volume mensal de entradas e tem visibilidade consolidada das NF-es emitidas contra o CNPJ.

---

## 4. Stack Tecnológica

| Camada | Tecnologia |
|--------|-----------|
| **Frontend** | Next.js 14+ (App Router) + TypeScript |
| **UI Components** | shadcn/ui + Tailwind CSS |
| **Auth** | Supabase Auth (email + confirmação) |
| **Banco de Dados** | Supabase (PostgreSQL) com RLS |
| **Storage** | Supabase Storage (certificados, avatares, XMLs) |
| **Certificado** | node-forge (parse/validação do .pfx) |
| **Integração SEFAZ** | SOAP via fetch + mTLS com Node.js `https.Agent` |
| **Criptografia** | AES-256-GCM (senha do certificado) |
| **Formulários** | react-hook-form + zod |
| **Deploy** | Vercel (frontend) |

---

## 5. Arquitetura

```
┌─────────────────────────────────────────────────────────┐
│                    NAVEGADOR (Browser)                   │
│  Next.js App Router - Client Components & Server Actions │
└──────────┬──────────────────────────────────────────────┘
           │ HTTPS
┌──────────▼──────────────────────────────────────────────┐
│                  NEXT.JS SERVER (Vercel)                 │
│                                                          │
│  ┌─────────────┐  ┌──────────────┐  ┌────────────────┐  │
│  │ Middleware  │  │Server Actions│  │  API Routes    │  │
│  │ (auth guard)│  │ /actions/*.ts│  │ (future use)   │  │
│  └─────────────┘  └──────┬───────┘  └────────────────┘  │
└─────────────────────────┼───────────────────────────────┘
                           │
           ┌───────────────┼───────────────┐
           │               │               │
┌──────────▼───┐  ┌────────▼──────┐  ┌────▼──────────────┐
│  Supabase    │  │  Supabase     │  │   SEFAZ (SOAP)    │
│  PostgreSQL  │  │  Storage      │  │   NFeDistribuição │
│  (RLS ativo) │  │  (privado)    │  │   DFe - mTLS A1   │
└──────────────┘  └───────────────┘  └───────────────────┘
```

### Fluxo de Autenticação

```
Usuário → /login → signIn() → Supabase Auth → Cookie Session
                                            → Middleware valida em cada request
                                            → Redireciona /login se não autenticado
```

### Fluxo de Sincronização SEFAZ

```
Usuário clica "Importar da SEFAZ"
  → syncNFesFromSEFAZ() (Server Action)
    → getAuthUser() — verifica sessão
    → busca empresa ativa do usuário
    → busca último NSU processado (nfe_sync_state)
    → buildSefazAgent() — monta https.Agent com mTLS
      → busca certificado ativo no banco
      → descriptografa senha (AES-256-GCM)
      → baixa .pfx do Storage
      → cria https.Agent com PFX + passphrase
    → loop: chamarDistDFe() até maxNSU == ultNSU
      → envelope SOAP DistribuiçãoDFe
      → parseia docZip (Base64 + GZip)
      → extrai chave, NSU, emitente, valor, data, natOp, UF
    → upsert NF-es no banco (onConflict: 'chave')
    → atualiza nfe_sync_state com novo NSU
    → revalidatePath('/dashboard')
```

---

## 6. Funcionalidades Implementadas

### ✅ Autenticação

| Funcionalidade | Arquivo | Status |
|---|---|---|
| Login com email/senha | `app/login/page.tsx` + `actions/auth.ts` | ✅ |
| Cadastro com confirmação por e-mail | `actions/auth.ts → signUp()` | ✅ |
| Logout | `components/sign-out-button.tsx` | ✅ |
| Proteção de rotas (Middleware) | `middleware.ts` | ✅ |
| Redirecionamento já logado | `middleware.ts` | ✅ |
| Tela de "verifique seu e-mail" | `app/login/page.tsx` | ✅ |

### ✅ Perfil de Usuário

| Funcionalidade | Arquivo | Status |
|---|---|---|
| Edição de nome | `app/dashboard/perfil/page.tsx` | ✅ |
| Upload de avatar | `app/dashboard/perfil/page.tsx` + `actions/auth.ts` | ✅ |
| Exibição do avatar no header | `app/dashboard/layout.tsx` | ✅ |
| Dropdown com nome e email | `app/dashboard/layout.tsx` | ✅ |

### ✅ Certificado Digital A1

| Funcionalidade | Arquivo | Status |
|---|---|---|
| Upload de .pfx/.p12 com drag & drop | `app/dashboard/certificado/page.tsx` | ✅ |
| Validação com node-forge (CNPJ, validade, razão social) | `actions/certificate.ts` | ✅ |
| Criptografia AES-256-GCM da senha | `lib/crypto.ts` + `actions/certificate.ts` | ✅ |
| Armazenamento no Storage privado | `actions/certificate.ts` | ✅ |
| Exibição de dados do certificado ativo | `app/dashboard/certificado/page.tsx` | ✅ |
| Alerta de vencimento (< 30 dias / expirado) | `app/dashboard/certificado/page.tsx` | ✅ |
| Revogação do certificado | `actions/certificate.ts → revokeCertificate()` | ✅ |
| Substituição de certificado | `app/dashboard/certificado/page.tsx` | ✅ |

### ✅ Empresa & CNPJ

| Funcionalidade | Arquivo | Status |
|---|---|---|
| Cadastro de empresa | `app/dashboard/cnpj/page.tsx` + `actions/empresa.ts` | ✅ |
| Edição de dados (razão social, nome fantasia, IE, regime) | `app/dashboard/cnpj/page.tsx` | ✅ |
| Auto-populado via certificado digital | `actions/certificate.ts` | ✅ |
| Banner de status do certificado | `app/dashboard/cnpj/page.tsx` | ✅ |
| Suporte a ambiente SEFAZ (homologação/produção) | banco `empresas.ambiente_sefaz` | ✅ |
| UF da empresa para roteamento | banco `empresas.uf` | ✅ |

### ✅ NF-es – Listagem e Sincronização

| Funcionalidade | Arquivo | Status |
|---|---|---|
| Filtro por período (hoje, semana, mês, personalizado) | `app/dashboard/nfe-table.tsx` | ✅ |
| Filtro por emitente (ilike) | `app/dashboard/nfe-table.tsx` | ✅ |
| Filtro por status | `app/dashboard/nfe-table.tsx` | ✅ |
| Busca avançada com painel colapsável | `app/dashboard/nfe-table.tsx` | ✅ |
| Importar da SEFAZ (manual) | `app/dashboard/nfe-table.tsx` + `actions/nfe.ts` | ✅ |
| Envelope SOAP DistribuiçãoDFe | `actions/nfe.ts → buildDistDFeEnvelope()` | ✅ |
| Parse de docZip Base64+GZip | `actions/nfe.ts → parsearDocumentos()` | ✅ |
| Upsert de NF-es no banco (sem duplicatas) | `actions/nfe.ts` | ✅ |
| Controle de NSU (sincronização incremental) | `actions/nfe.ts` + `nfe_sync_state` | ✅ |
| Feedback visual de sincronização | `app/dashboard/nfe-table.tsx` | ✅ |

---

## 7. Funcionalidades Pendentes

### 🔴 Crítico (segurança multi-tenant)

- **Filtros por `user_id`** nas actions `getActiveCertificate()`, `getEmpresaAtiva()` e `buildSefazAgent()` — sem isso, todos os usuários acessam dados do mesmo certificado/empresa.
- **Constraint UNIQUE** em `nfe_sync_state(user_id, empresa_cnpj)` — o upsert usa `onConflict` mas o índice pode não existir.

### 🟡 MVP Incompleto

- **Download do XML** — campo `xml_url` existe mas o XML não é baixado/armazenado na sincronização atual (apenas os dados resumidos).
- **Geração de DANFE (PDF)** — geração a partir do XML armazenado.
- **Tela de detalhe da NF-e** — rota `/dashboard/nfe/[chave]` não existe.
- **Consulta por chave de acesso** — tela `/dashboard/consulta-chave` não implementada.
- **Tela de Monitoramento** — `/dashboard/monitoramento` — histórico de sincronizações, status da integração, próxima sinc programada.
- **Registro de atividades** — tabela de auditoria e tela `/dashboard/atividades`.
- **Cards de métricas com dados reais** — atualmente hardcoded na `page.tsx` do dashboard.
- **Sincronização automática diária** — Edge Function ou Cron agendado.
- **Link "NF-es Recebidas" no sidebar** — aponta para `/dashboard` em vez de `/dashboard/nfe`.

### 🟢 Melhorias Futuras (pós-MVP)

- Manifestação eletrônica de NF-e (ciência da operação, confirmação, desconhecimento)
- Filtro por intervalo de valor
- Paginação na tabela de NF-es
- Multiempresa real (múltiplos CNPJs ativos por usuário)
- Alertas de vencimento do certificado via e-mail
- Exportação em XLSX
- Classificação automática com IA

---

## 8. Estrutura do Banco de Dados

### Tabela: `profiles`
Extensão do `auth.users` com dados do perfil.

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| `id` | uuid (PK, FK → auth.users) | ID do usuário |
| `nome` | text | Nome completo |
| `avatar_url` | text | URL pública do avatar no Storage |
| `created_at` | timestamptz | Data de criação |
| `updated_at` | timestamptz | Última atualização |

### Tabela: `empresas`
Empresa (CNPJ) vinculada ao usuário.

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| `id` | uuid (PK) | Identificador |
| `cnpj` | text (UNIQUE) | CNPJ sem formatação |
| `razao_social` | text | Razão social |
| `nome_fantasia` | text | Nome fantasia (opcional) |
| `inscricao_estadual` | text | IE (opcional) |
| `regime_tributario` | text | `simples` / `lucro_presumido` / `lucro_real` |
| `certificado_id` | uuid (FK → certificados) | Certificado ativo vinculado |
| `ativo` | boolean | Se é o CNPJ ativo |
| `uf` | char(2) | UF para roteamento SEFAZ |
| `ambiente_sefaz` | text | `homologacao` / `producao` |
| `user_id` | uuid (FK → auth.users) | Dono da empresa |
| `created_at` | timestamptz | Data de criação |
| `updated_at` | timestamptz | Última atualização |

### Tabela: `certificados`
Certificado digital A1 (.pfx).

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| `id` | uuid (PK) | Identificador |
| `cnpj` | text | CNPJ extraído do certificado |
| `razao_social` | text | Razão social extraída |
| `validade` | timestamptz | Data de expiração |
| `storage_path` | text | Caminho no bucket `certificados` |
| `senha_cifrada` | text | Senha AES-256-GCM (nunca em texto plano) |
| `status` | text | `ativo` / `expirado` / `revogado` |
| `user_id` | uuid (FK → auth.users) | Dono do certificado |
| `created_at` | timestamptz | Data de upload |

### Tabela: `nfes`
NF-es capturadas da SEFAZ.

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| `id` | uuid (PK) | Identificador |
| `user_id` | uuid (FK → auth.users) | Dono |
| `empresa_cnpj` | text | CNPJ da empresa destinatária |
| `chave` | text (UNIQUE) | Chave de acesso (44 dígitos) |
| `numero` | text | Número da nota |
| `emitente` | text | Razão social do emitente |
| `valor` | numeric | Valor total |
| `status` | text | `recebida` / `manifestada` / `arquivada` / `cancelada` |
| `data_emissao` | timestamptz | Data de emissão |
| `nsu` | bigint | NSU da SEFAZ |
| `nat_op` | text | Natureza da operação |
| `uf_emitente` | char(2) | UF do emitente |
| `xml_url` | text | URL do XML no Storage (pendente) |
| `destinatario` | text | Razão social do destinatário |
| `created_at` | timestamptz | Data de captura |

**Regra:** `chave` deve ser única. XML nunca pode ser deletado.

### Tabela: `nfe_sync_state`
Estado de sincronização por empresa.

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| `id` | uuid (PK) | Identificador |
| `user_id` | uuid (FK → auth.users) | Usuário |
| `empresa_cnpj` | text | CNPJ da empresa |
| `ultimo_nsu` | bigint | Último NSU processado |
| `ultima_sync` | timestamptz | Data da última sincronização |
| `created_at` | timestamptz | Criação |

**Constraint necessário:** UNIQUE em `(user_id, empresa_cnpj)`.

### Relacionamentos

```
auth.users
  ├── profiles (1:1)
  ├── empresas (1:N)
  │     └── certificados (N:1)
  ├── certificados (1:N)
  ├── nfes (1:N)
  └── nfe_sync_state (1:N)
```

---

## 9. Estrutura de Arquivos do Projeto

```
nfe-agil/
├── actions/                    # Server Actions (lógica de backend)
│   ├── auth.ts                 # signIn, signUp, signOut, getProfile, updateProfile
│   ├── certificate.ts          # uploadCertificate, getActiveCertificate, revokeCertificate, buildSefazAgent
│   ├── empresa.ts              # getEmpresaAtiva, saveEmpresa
│   └── nfe.ts                  # syncNFesFromSEFAZ, listNFes, getLastSync
│
├── app/                        # Next.js App Router
│   ├── globals.css             # Estilos globais + tokens Tailwind/shadcn
│   ├── layout.tsx              # Layout raiz (ThemeProvider, fontes)
│   ├── page.tsx                # Página inicial (redireciona para /dashboard ou /login)
│   ├── auth/
│   │   └── callback/           # Callback de confirmação de e-mail (Supabase)
│   ├── login/
│   │   └── page.tsx            # Tela de login + cadastro (modo tab)
│   └── dashboard/
│       ├── layout.tsx          # Layout do dashboard (sidebar + header com avatar)
│       ├── page.tsx            # Monitoramento com cards de métricas + NFeTable
│       ├── columns.tsx         # Definição das colunas da tabela de NF-es
│       ├── nfe-table.tsx       # Componente principal de listagem + filtros + sinc SEFAZ
│       ├── certificado/
│       │   └── page.tsx        # Gerenciamento do certificado A1
│       ├── cnpj/
│       │   └── page.tsx        # Configuração da empresa e CNPJ
│       └── perfil/
│           └── page.tsx        # Edição de perfil e avatar
│
├── components/
│   ├── metric-card.tsx         # Card de métrica do dashboard
│   ├── sign-out-button.tsx     # Botão de logout
│   ├── theme-provider.tsx      # Provider de tema (dark/light)
│   └── ui/                     # Componentes shadcn/ui
│       ├── alert-dialog.tsx
│       ├── badge.tsx
│       ├── button.tsx
│       ├── card.tsx
│       ├── data-table.tsx      # Tabela genérica com TanStack Table
│       ├── dropdown-menu.tsx
│       ├── input.tsx
│       ├── label.tsx
│       ├── select.tsx
│       └── separator.tsx
│
├── lib/
│   ├── crypto.ts               # encrypt/decrypt AES-256-GCM
│   ├── supabase.ts             # Cliente Supabase (browser/anon)
│   ├── supabase-admin.ts       # Cliente Supabase (service_role — servidor only)
│   └── utils.ts                # cn() helper
│
├── middleware.ts               # Proteção de rotas + redirecionamentos
├── .env.local                  # Variáveis de ambiente (não versionado)
├── components.json             # Configuração shadcn/ui
├── next.config.ts              # Configuração Next.js
├── tailwind.config.ts          # Configuração Tailwind
└── tsconfig.json               # Configuração TypeScript
```

---

## 10. Server Actions (Backend)

### `actions/auth.ts`

| Função | Descrição |
|--------|-----------|
| `signUp(formData)` | Cadastro com email + nome, envia confirmação |
| `signIn(formData)` | Login com email/senha |
| `signOut()` | Logout e redirect para /login |
| `getSession()` | Retorna sessão atual |
| `getProfile()` | Retorna perfil do usuário logado |
| `updateProfile(formData)` | Atualiza nome e avatar |
| `linkEmpresaToUser(cnpj)` | Vincula empresa/certificado sem `user_id` ao usuário logado |

### `actions/certificate.ts`

| Função | Descrição |
|--------|-----------|
| `uploadCertificate(formData)` | Valida, criptografa e salva certificado .pfx |
| `getActiveCertificate()` | Busca certificado ativo (⚠️ falta filtro user_id) |
| `revokeCertificate(certId)` | Revoga certificado via RPC `revogar_certificado` |
| `buildSefazAgent()` | Monta https.Agent mTLS para chamadas SEFAZ (⚠️ falta filtro user_id) |

### `actions/empresa.ts`

| Função | Descrição |
|--------|-----------|
| `getEmpresaAtiva()` | Busca empresa ativa com dados do certificado (⚠️ falta filtro user_id) |
| `saveEmpresa(formData)` | Cria/atualiza empresa via upsert por CNPJ |

### `actions/nfe.ts`

| Função | Descrição |
|--------|-----------|
| `syncNFesFromSEFAZ()` | Sincroniza NF-es incrementalmente via DistribuiçãoDFe |
| `listNFes(params?)` | Lista NF-es do mês ou período informado |
| `getLastSync()` | Retorna data da última sincronização |

---

## 11. Fluxo Principal do Usuário

```
1. Acessa o sistema → [middleware] verifica sessão
   ├── Não autenticado → redireciona /login
   └── Autenticado → redireciona /dashboard

2. Na tela de login:
   ├── Login: email + senha → signIn() → /dashboard
   └── Cadastro: nome + email + senha → signUp() → tela "verifique seu e-mail"

3. No dashboard:
   a. Sem empresa → vai para /dashboard/certificado → faz upload do .pfx
      → empresa auto-criada com CNPJ + razão social do certificado
   b. Com empresa → acessa /dashboard diretamente

4. Importação de NF-es:
   Clica "Importar da SEFAZ" → syncNFesFromSEFAZ()
   → NF-es aparecem na tabela
   → Aplica filtros: período / emitente / status
   → (futuro) Clica "Baixar XML" ou "Visualizar DANFE"
```

---

## 12. Mapa de Telas

| Tela | Rota | Status |
|------|------|--------|
| Login / Cadastro | `/login` | ✅ Implementado |
| Monitoramento (Dashboard) | `/dashboard` | ⚠️ Métricas hardcoded |
| NF-es Recebidas | `/dashboard` (mesma página) | ✅ Tabela funcional |
| Detalhe da NF-e | `/dashboard/nfe/[chave]` | ❌ Não implementado |
| Consulta por Chave | `/dashboard/consulta-chave` | ❌ Não implementado |
| Certificado Digital | `/dashboard/certificado` | ✅ Implementado |
| Empresa & CNPJ | `/dashboard/cnpj` | ✅ Implementado |
| Meu Perfil | `/dashboard/perfil` | ✅ Implementado |
| Monitoramento DFe | `/dashboard/monitoramento` | ❌ Não implementado |
| Registro de Atividades | `/dashboard/atividades` | ❌ Não implementado |

---

## 13. Segurança

### Autenticação e Sessão
- Supabase Auth com cookies HTTP-only (gerenciados pelo middleware)
- JWT renovado automaticamente via `@supabase/ssr`
- Todas as rotas `/dashboard/**` protegidas pelo middleware

### Certificado Digital
- Arquivo `.pfx` armazenado em bucket privado (sem URL pública)
- Senha criptografada com AES-256-GCM antes de persistir
- Chave de criptografia em variável de ambiente (`CERTIFICATE_ENCRYPTION_KEY`)
- Comunicação com SEFAZ via mTLS (o certificado nunca trafega para o browser)

### Banco de Dados
- Row Level Security (RLS) habilitado em todas as tabelas
- `supabaseAdmin` (service_role) usado apenas em Server Actions — nunca exposto ao browser

### ⚠️ Problema Atual de Multi-tenancy
As funções `getActiveCertificate()`, `getEmpresaAtiva()` e `buildSefazAgent()` não filtram por `user_id`, o que em ambiente com múltiplos usuários pode retornar dados de outros usuários. **Correção necessária antes de produção com múltiplos usuários.**

---

## 14. Variáveis de Ambiente

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=         # URL do projeto Supabase
NEXT_PUBLIC_SUPABASE_ANON_KEY=    # Chave anon (pública)
SUPABASE_SERVICE_ROLE_KEY=        # Chave service_role (servidor only — NUNCA expor)

# Criptografia do certificado
CERTIFICATE_ENCRYPTION_KEY=       # 32 bytes hex — gerado uma vez e nunca alterado

# App
NEXT_PUBLIC_APP_URL=              # URL base do app (ex: https://nfe-agil.vercel.app)
```

---

## 15. Como Rodar Localmente

```bash
# 1. Clonar o repositório
git clone <repo-url>
cd nfe-agil

# 2. Instalar dependências
npm install

# 3. Configurar variáveis de ambiente
cp .env.example .env.local
# Editar .env.local com suas credenciais Supabase

# 4. Gerar chave de criptografia (se não tiver)
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
# Cole o resultado em CERTIFICATE_ENCRYPTION_KEY

# 5. Rodar em desenvolvimento
npm run dev

# 6. Acessar
# http://localhost:3000
```

---

## 16. Problemas Conhecidos e Dívidas Técnicas

### Segurança (crítico)
- [ ] Adicionar filtro `user_id` em `getActiveCertificate()`
- [ ] Adicionar filtro `user_id` em `getEmpresaAtiva()`
- [ ] Adicionar filtro `user_id` em `buildSefazAgent()`
- [ ] Criar constraint UNIQUE em `nfe_sync_state(user_id, empresa_cnpj)`

### Funcionalidades faltantes
- [ ] Download e armazenamento do XML completo na sincronização
- [ ] Geração de DANFE (PDF) a partir do XML
- [ ] Página de detalhe da NF-e
- [ ] Tela de consulta por chave de acesso
- [ ] Tela de Monitoramento DFe com histórico
- [ ] Registro de atividades (auditoria)
- [ ] Cards de métricas com dados reais do banco
- [ ] Sincronização automática via cron/Edge Function
- [ ] Corrigir link "NF-es Recebidas" no sidebar (aponta para /dashboard em vez de /dashboard/nfe)
- [ ] Chamar `linkEmpresaToUser()` no fluxo de upload do certificado

### UX / Perfil
- [ ] A tabela `profiles` está vazia (0 registros) — o perfil só é criado quando o usuário salva manualmente. Criar trigger no Supabase para auto-criar profile no signUp.

---

## 17. Roadmap

### Sprint atual — Correções críticas
1. Filtros por `user_id` nas Server Actions
2. Constraint UNIQUE no banco
3. Cards de métricas com dados reais
4. Corrigir links do sidebar

### Próxima sprint — MVP completo
5. Download e storage do XML completo
6. Geração de DANFE (PDF)
7. Tela de detalhe da NF-e
8. Tela de consulta por chave
9. Sincronização automática (Edge Function)
10. Registro de atividades

### Futuro
- Manifestação eletrônica
- Multi-CNPJ
- Alertas por e-mail
- Exportação XLSX
- Dashboard analítico com gráficos

---

*Documentação gerada em 19/02/2026. Para atualizar, consulte o código-fonte em `actions/`, `app/dashboard/` e o banco Supabase do projeto `ncorntmwslmcdwejwkmc`.*
