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

*Documentação atualizada em 19/02/2026 refletindo a versão v3.3 do Micro-serviço e o novo layout de Gestão de Notas.*
