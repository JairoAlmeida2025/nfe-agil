# NF-e Ágil – Documentação Técnica Completa

> Sistema interno de gestão de Notas Fiscais Eletrônicas com integração direta à SEFAZ via certificado digital A1.

--- 19/02/2026

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
16. [Roadmap](#16-roadmap)

---

## 1. Visão Geral

O **NF-e Ágil** é um sistema web interno desenvolvido para centralizar, automatizar e garantir o acesso contínuo às NF-es emitidas contra o CNPJ da empresa, com integração direta à SEFAZ via Distribuição DFe.

### O problema que resolve

- Dependência de processos manuais para obter XMLs.
- Risco de perda de documentos fiscais.
- Falta de controle sobre notas emitidas contra o CNPJ (Notas Frias).
- Dificuldade na manifestação do destinatário.

### A solução

Captura automática de NF-es via Distribuição DFe da SEFAZ, usando certificado digital A1, com armazenamento seguro, consulta filtrada, download de XML e controle de status (Manifestação).

---

## 2. Objetivos do Projeto

### v3.3 (Versão Atual - Estável)

- [x] Autenticação segura com confirmação por e-mail
- [x] Cadastro e gerenciamento do CNPJ da empresa
- [x] Upload e gerenciamento do certificado digital A1
- [x] **Micro-serviço Fiscal Stateless (Node.js/Fastify) v3.3**
  - Isolamento da comunicação mTLS com a SEFAZ.
  - Suporte a TLS 1.2 via `node-forge` e `https.Agent`.
  - Endpoint Nacional (AN) corrigido.
  - Proteção contra Consumo Indevido (cStat 656).
- [x] **Sincronização Robusta**
  - Persistência garantida de NSU (`config_fiscal`).
  - Download e armazenamento do XML completo.
  - Parseamento avançado de retorno SEFAZ.
- [x] **Gestão de Notas (Frontend)**
  - Listagem estilo Data Table (Chave, Data, Fornecedor, Valor, Situação).
  - Ações: Baixar XML, Visualizar/Imprimir, Deletar.
  - Controle de Situação (Confirmada/Recusada) via Modal.

### Indicadores de Sucesso

- 100% das NF-es emitidas contra o CNPJ capturadas automaticamente.
- Zero bloqueios por Consumo Indevido na SEFAZ.
- Interface intuitiva para a equipe financeira.

---

## 3. Personas

### Analista Fiscal
Garante que todas as NF-es estejam armazenadas para escrituração e auditoria. Usa a listagem para verificar captura diária.

### Equipe Financeira / Contas a Pagar
Consulta notas recebidas para conferência e validação de pagamentos. Usa filtros por fornecedor e valor. Valida o recebimento (Manifestação).

---

## 4. Stack Tecnológica

| Camada | Tecnologia |
|--------|-----------|
| **Frontend** | Next.js 16+ (App Router) + TypeScript |
| **UI Components** | shadcn/ui + Tailwind CSS |
| **Auth** | Supabase Auth (email + confirmação) |
| **Banco de Dados** | Supabase (PostgreSQL) com RLS |
| **Storage** | Supabase Storage (certificados, XMLs) |
| **Micro-serviço Fiscal** | Node.js 18 + Fastify (Hospedado via Docker/EasyPanel) |
| **Certificado/TLS** | `node-forge` (pfx parsing) + `https.Agent` (mTLS) |
| **Criptografia** | AES-256-GCM (senha do certificado) |
| **Deploy** | Vercel (Frontend) + VPS/EasyPanel (Micro-serviço) |

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
│  │ (auth guard)│  │ /actions/*.ts│  │ (download)     │  │
│  └─────────────┘  └──────┬───────┘  └────────────────┘  │
│                          │ HTTP (JSON)
│                          │ Payload: PFX Base64 + Senha
│           ┌──────────────▼───────────────┐
│           │   MICRO-SERVIÇO FISCAL       │
│           │   (Node.js / Fastify)        │
│           │   v3.3 - Stateless           │
│           └──────┬───────────────────────┘
│                  │ mTLS (Cert A1)
│           ┌──────▼───────────────────────┐
│           │      SEFAZ (SOAP)            │
│           │   NFeDistribuiçãoDFe         │
│           │   Ambiente Nacional          │
│           └──────────────────────────────┘
│
└─────────────────────────┼───────────────────────────────┘
                           │
           ┌───────────────┼───────────────┐
           │               │               │
┌──────────▼───┐  ┌────────▼──────┐  ┌────▼──────────────┐
│  Supabase    │  │  Supabase     │  │   Logs / Audit    │
│  PostgreSQL  │  │  Storage      │  │                   │
│  (RLS ativo) │  │  (XMLs/PFX)   │  │                   │
└──────────────┘  └───────────────┘  └───────────────────┘
```

### Fluxo de Sincronização SEFAZ (Atualizado)

```
Usuário clica "Importar da SEFAZ"
  → syncNFesFromSEFAZ() (Server Action)
    → Busca empresa e certificado ativo
    → Busca ult_nsu em `config_fiscal` (Persistência Real)
    → Carrega PFX e Senha (descriptografada)
    → Chama Micro-serviço POST /distdfe
      → Micro-serviço converte PFX para PEM em memória
      → Cria Agente HTTPS mTLS
      → Consome SEFAZ (Ambiente Nacional)
      → Retorna XML e parsed data
    → Next.js recebe retorno
      → Trata erro 656 (Consumo Indevido) -> Aborta e alerta
      → Processa documentos (unzip XMLs)
      → Upsert na tabela `nfes`
      → Atualiza `config_fiscal.ult_nsu` se sucesso
      → Revalida dashboard
```

---

## 6. Funcionalidades Implementadas

### ✅ Gestão de Notas Fiscais (Novo)

| Funcionalidade | Descrição | Status |
|---|---|---|
| **Listagem Data Table** | Exibição colunar (Chave, Data, Fornecedor, Valor, Situação). | ✅ |
| **Filtros Avançados** | Período, Emitente, Situação. | ✅ |
| **Persistência de Status** | Coluna `situacao` no banco (`nao_informada`, `confirmada`, `recusada`). | ✅ |
| **Modal de Decisão** | Confirmação ou Recusa da nota (Ciência/Desconhecimento). | ✅ |
| **Ações Rápidas** | Baixar XML, Visualizar/Imprimir, Deletar registro. | ✅ |
| **Sincronização Manual** | Botão "Importar da SEFAZ" com feedback em tempo real. | ✅ |

### ✅ Backend & Integração

| Funcionalidade | Descrição | Status |
|---|---|---|
| **Micro-serviço v3.3** | API isolada para comunicação com SEFAZ. Resolve problemas de TLS/OpenSSL. | ✅ |
| **Stateless Auth** | Certificado enviado por requisição, sem dependência de disco no micro-serviço. | ✅ |
| **Proteção NSU** | Controle estrito de sequenciamento e bloqueio de consumo indevido (656). | ✅ |
| **Logs Detalhados** | Logging completo de Request/Response XML para auditoria. | ✅ |

### ✅ Infraestrutura Base

| Funcionalidade | Status |
|---|---|
| Autenticação (Login/Cadastro) | ✅ |
| Gestão de Empresas/CNPJs | ✅ |
| Upload de Certificado A1 | ✅ |
| Criptografia de Credenciais | ✅ |

---

## 7. Funcionalidades Pendentes

### 🟡 Melhorias de UX
- **Paginação Real** na tabela de notas (atualmente client-side ou limitada).
- **Dashboard Analítico** (Gráficos de despesas por período).
- **Notificações** (Email/Push para novas notas).

### 🔴 Manifestação Eletrônica Real
- A funcionalidade visual de "Confirmar/Recusar" está implementada, mas o envio do evento para a SEFAZ (Evento de Manifestação) precisa ser conectado ao micro-serviço (endpoint `/manifestacao` já existe, falta integrar no Action `updateNFeSituacao`).

---

## 8. Estrutura do Banco de Dados (Principais Tabelas)

### `nfes`
| Coluna | Tipo | Descrição |
|---|---|---|
| `id` | uuid | PK |
| `chave` | text | Unique. Chave de acesso 44 dígitos. |
| `emitente` | text | Razão Social do fornecedor. |
| `valor` | numeric | Valor total da nota. |
| `data_emissao` | timestamptz | Data de emissão. |
| `situacao` | text | `nao_informada`, `confirmada`, `recusada`. |
| `xml_content` | text | Conteúdo XML completo (armazenado). |
| `nsu` | text | Número Sequencial Único da SEFAZ. |
| `created_at` | timestamptz | Data de importação. |

### `config_fiscal`
| Coluna | Tipo | Descrição |
|---|---|---|
| `id` | uuid | PK |
| `empresa_id` | uuid | FK Empresa |
| `ult_nsu` | bigint | Último NSU processado com sucesso. Importante para sincronização incremental. |

(Tabelas `profiles`, `empresas`, `certificados` mantidas conforme documentação anterior).

---

## 9. Estrutura de Arquivos Relevante

```
nfe-agil/
├── actions/
│   ├── nfe.ts                  # Lógica de Sync SEFAZ
│   ├── nfe-management.ts       # CRUD de Notas (Delete, Update Status, Download)
│   └── certificate.ts          # Gestão de Certificados
│
├── app/dashboard/
│   ├── nfe/
│   │   ├── page.tsx            # Página principal de Notas
│   │   ├── nfe-actions.tsx     # Componentes de Ação e Status Badge
│   │   └── ...
│   ├── columns.tsx             # Definição das colunas (Data Table)
│   ├── nfe-table.tsx           # Tabela com filtros e integração
│   └── ...
│
├── sefaz-fiscal-service/       # Código do Micro-serviço
│   ├── src/
│   │   ├── routes/
│   │   │   ├── distdfe.ts      # Rota de Distribuição DFe
│   │   │   └── ...
│   │   ├── sefaz/
│   │   │   ├── client.ts       # Cliente SOAP / HTTPS Agent
│   │   │   ├── signer.ts       # Assinatura XML (se necessário)
│   │   │   └── ...
│   │   └── index.ts            # Entrypoint Fastify
│   └── Dockerfile              # Configuração de Build
```

---

## 10. Server Actions (Backend)

| Action | Arquivo | Descrição |
|---|---|---|
| `syncNFesFromSEFAZ()` | `actions/nfe.ts` | Dispara sincronização manual com SEFAZ. |
| `listNFesFiltradas()` | `actions/nfe.ts` | Lista NF-es filtradas por período, emitente e status. Calcula datas em BRT. |
| `getSyncStatus()` | `actions/nfe.ts` | Retorna status da última sincronização (NSU, data, bloqueio). |
| `deleteNFe()` | `actions/nfe-management.ts` | Remove NF-e do banco (multi-tenant seguro). |
| `updateNFeSituacao()` | `actions/nfe-management.ts` | Atualiza situação da nota (confirmada/recusada). |
| `getNFeXmlContent()` | `actions/nfe-management.ts` | Retorna XML bruto para download. |
| `uploadCertificate()` | `actions/certificate.ts` | Faz upload e criptografia do certificado A1. |
| `getActiveCertificate()` | `actions/certificate.ts` | Retorna certificado ativo do usuário autenticado. |

---

## 11. Fluxo Principal do Usuário

1. Login → redirecionado ao Dashboard
2. Configura CNPJ da empresa (menu Empresa)
3. Faz upload do Certificado A1 (menu Certificado)
4. Clica **"Importar da SEFAZ"** → sincronização incremental via NSU
5. Visualiza NF-es capturadas na tabela com filtros de período
6. Para cada nota: baixa XML, visualiza DANFE ou atualiza situação

---

## 12. Mapa de Telas

| Rota | Descrição |
|---|---|
| `/login` | Autenticação com Supabase Auth |
| `/dashboard` | Visão geral + cards de resumo |
| `/dashboard/nfe` | Tabela de NF-es com filtros e ações |
| `/dashboard/empresa` | Cadastro e ativação do CNPJ |
| `/dashboard/certificado` | Upload e gestão do certificado A1 |
| `/api/nfe/[id]/pdf` | Geração de DANFE em PDF (react-pdf/renderer) |

---

## 13. Segurança

- **Autenticação**: Supabase Auth com confirmação por e-mail
- **Multi-tenancy**: `user_id` em todas as queries — dados isolados por usuário
- **RLS (Row Level Security)**: ativo no Supabase; todas as ações usam `supabaseAdmin` com filtro `user_id` manual
- **Certificado**: senha criptografada com AES-256-GCM; chave derivada no servidor
- **Micro-serviço**: autenticado via `FISCAL_SECRET` (header `x-fiscal-secret`)
- **Headers HTTP**: HSTS, X-Frame-Options, X-Content-Type-Options, CSP configurados
- **IDOR**: todas as rotas API validam `ownerId` antes de retornar dados

---

## 14. Variáveis de Ambiente

| Variável | Descrição |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | URL pública do projeto Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Chave anônima (pública) |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role (somente servidor) |
| `MICRO_SEFAZ_URL` | URL do micro-serviço fiscal |
| `FISCAL_SECRET` | Segredo de autenticação do micro-serviço |
| `CERT_ENCRYPTION_KEY` | Chave AES para criptografia de senhas de certificado |
| `MEUDANFE_API_KEY` | Chave da API MeuDanfe (conversão XML→DANFE PDF) |
| `MASTER_ADMIN_EMAILS` | Lista de emails com acesso ao painel admin (separados por vírgula) |

---

## 15. Como Rodar Localmente

```bash
# Instalar dependências
npm install

# Configurar variáveis de ambiente
cp .env.example .env.local
# Preencher .env.local com credenciais Supabase e micro-serviço

# Rodar em modo desenvolvimento
npm run dev

# Build de produção
npm run build
```

---

## 16. Módulo SaaS

### Sistema de Planos

| Plano | Preço | Features |
|---|---|---|
| **Starter** | R$ 29/mês | Conversão XML manual, até 50 PDFs/mês, suporte e-mail |
| **Pro** | R$ 49/mês | Monitoramento SEFAZ, manifestação, conversão ilimitada, download em lote, CSV, suporte prioritário |

### Sistema de Assinaturas

Fluxo de onboarding:
1. Cadastro → Confirma e-mail
2. Redirecionado para `/escolher-plano`
3. Usuário escolhe plano → subscription criada com `status = 'trialing'` e `trial_ends_at = now() + 7 dias`
4. Acesso ao dashboard liberado

Regras de acesso:
- `is_lifetime = true` → Sempre ativo
- `status = 'active'` → Assinatura paga ativa
- `status = 'trialing'` e `trial_ends_at > now()` → Trial válido
- Demais cenários → Redirecionado para `/escolher-plano`

### Middleware de Controle

| Guard | Rotas | Regra |
|---|---|---|
| Admin Guard | `/admin/*` | Email deve estar em `MASTER_ADMIN_EMAILS` |
| Subscription Guard | `/dashboard/*` | Deve ter subscription ativa, trial válido ou lifetime |

### Painel Admin

| Rota | Descrição |
|---|---|
| `/admin` | Dashboard SaaS (Total usuários, MRR, ARPU, Trials, Receita) |
| `/admin/usuarios` | Gestão de usuários (estender trial, ativar manual, lifetime, cancelar) |
| `/admin/assinaturas` | Listagem de todas as assinaturas |
| `/admin/pagamentos` | Histórico de pagamentos |
| `/admin/planos` | CRUD completo de planos |

### Tabelas SaaS

| Tabela | Descrição |
|---|---|
| `plans` | Planos disponíveis (name, slug, price, features, stripe_price_id) |
| `subscriptions` | Assinaturas dos usuários (status, trial_ends_at, is_lifetime) |
| `payments` | Histórico de pagamentos (amount, stripe_payment_intent) |

---

## 17. Roadmap

### ✅ Concluído
- [x] Sistema de Planos SaaS
- [x] Sistema de Assinaturas com Trial
- [x] Middleware de controle por plano
- [x] Painel Master Admin
- [x] Página institucional Política de Privacidade (`/privacidade`)
- [x] Página institucional Termos de Uso (`/termos`)

### Em progresso
- [ ] Dashboard analítico com gráficos de despesas

### Planejado
- [ ] Integração Stripe (checkout + webhooks)
- [ ] Manifestação eletrônica real via SEFAZ
- [ ] Notificações por e-mail para novas notas capturadas
- [ ] Exportação para CSV/Excel
- [ ] Relatórios fiscais por período

---

## Histórico de Atualizações

### 21/02/2026 — Fundação SaaS

Implementação completa do módulo SaaS com sistema de planos, assinaturas com trial de 7 dias, middleware de bloqueio e painel admin. Ver detalhes em [ATUALIZAÇÕES.md](./ATUALIZACOES.md).

### 21/02/2026 — Hardening de Segurança no Supabase (Database Advisors)

#### O que foi resolvido (Vulnerabilidades mitigadas):
- **Function Search Path Mutable:** Funções do PostgreSQL que não tinham schema qualificado sofriam risco de receber injeção de schemas maliciosos. Adicionada a restrição `SET search_path = public` nas funções `handle_new_user`, `match_documents`, `update_updated_at` e `get_owner_user_id`. (4 warnings removidos).
- **RLS Policy Always True:** A tabela `bd_ativo` possuía uma política extremamente aberta (inserir, deletar, ler livremente a todos). Refinamos o RLS dela (Row Level Security) e criamos uma Migration onde apenas é permitido a LEITURA se for pública, delegando a escrita unicamente ao Backend via Service Role. (1 warning crítico resolvido).

*Nota para a equipe:* Sobraram 2 avisos de menor criticidade ou que demandam ativação manual via interface do Supabase:
1. **Leaked Password Protection:** Pode ser ativado manualmente no painel (Authentication > Security).
2. **Vector Extension In Public:** Migrar o pg_vector para um schema `extensions` a essa altura do software pode quebrar tipagens que referenciam o `public.vector`. Não oferece risco imediato de vazamento de dados, trata-se de arquitetura de pastas.

---

### 21/02/2026 — Feedback Visual de Carregamento nas Consultas (UX)

#### O que foi melhorado
- Adicionado estado `isNavigating` na tabela principal de NF-es (`NFeTable`).
- Botões de **filtragem de período**, **busca avançada**, **limpar filtros** e **Importar da SEFAZ** agora travam (ficam `disabled`) e exibem um _spinner_ de carregamento até que o navegador conclua a requisição de recarregamento da página.
- Previne múltiplos cliques acidentais e elimina a sensação do sistema estar "seco" ou "congelado" durante o SSR (Server-Side Rendering) das query strings.

---

### 21/02/2026 — Modais de Confirmação e Segurança UX

#### O que foi criado
- Implementado modal (`AlertDialog`) nativo de **Confirmação de Logout (Sair)**, com estado de loading ("Saindo...") durante a navegação.
- Implementado modal de consulta para a operação de **Substituição de Certificado Digital**, orientando o usuário antes de perder a visão da tela atual.
- *Nota:* A exclusão de NF-e e a Revogação do certificado já possuíam essas travas de confirmação por segurança, garantindo consistência em toda a UX.

---

### 21/02/2026 — Sistema de Notificações Visuais no Dashboard (Sino)

#### Problema

Os usuários precisavam de um sistema visual (popover no sino do Header) para saber de forma imediata quando novas notas fiscais foram capturadas pela sincronização com a SEFAZ.

#### Solução:
- **Tabela `notifications`:** Criada no Supabase (`id`, `user_id`, `message`, `is_read`, `link`, etc.) com RLS ativo e inscrição na `publication `supabase_realtime``.
- **Backend (Auto-sync):** Em `actions/nfe.ts` (função `processSefazSync`), inserida a lógica de insert na tabela `notifications` se houver N notas importadas, avisando o usuário: "Foram sincronizadas X novas notas...".
- **Frontend `NotificationsBell`:** Criado um Client Component reativo que:
  - Faz fetch inicial das últimas notificações do usuário logado;
  - Utiliza **Supabase Realtime** via `@supabase/ssr` (`createBrowserClient`) para escutar inserts em tempo real na tabela usando o filtro `user_id=eq.${userId}` e atualizar a "bolinha" vermelha de não lidas e a lista dinamicamente sem Refresh (!).
  - Inclui ações de marcar como lida otimista (Optimistic Updates) para clique individual e para "Marcar todas como Lidas".
  - Navega para `/dashboard/nfe` ao ser clicada.
- **Integração:** Adicionado o `<NotificationsBell userId={profile.id} />` diretamente no cabeçalho do `DashboardLayout` consumindo o `user_id` do perfil.

---

> **Nota:** Para o histórico detalhado de correções de bugs e refatorações técnicas, consulte o arquivo [ATUALIZAÇÕES.md](./ATUALIZACOES.md).
