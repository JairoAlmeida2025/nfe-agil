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

## 16. Roadmap

### Em progresso
- [ ] Paginação real na tabela (server-side)
- [ ] Dashboard analítico com gráficos de despesas

### Planejado
- [ ] Manifestação eletrônica real via SEFAZ (endpoint `/manifestacao` já existe no micro-serviço)
- [ ] Notificações por e-mail para novas notas capturadas
- [ ] Exportação para CSV/Excel
- [ ] Relatórios fiscais por período

---

## Histórico de Atualizações

### 20/02/2026 — Correção: Filtro de Período Estritamente Backend-Driven

#### Problema Identificado

Mesmo com a sincronização de URL, a listagem ainda apresentava comportamentos de fallback para o mês atual no servidor, ignorando parcialmente os parâmetros da URL ou falhando ao aplicar filtros combinados de emitente e status.

#### Solução Aplicada

**1. Backend-Driven Real (`actions/nfe.ts`)**

- A action `listNFesFiltradas` agora é agnóstica a padrões. Se o parâmetro `period` não for fornecido, nenhum filtro de data é aplicado (retorna "todos").
- Logs explícitos de debug foram adicionados para monitorar a entrada de parâmetros no servidor.
- Filtro de **Situação** corrigido: agora mapeia corretamente o parâmetro `status` para a coluna `situacao` do banco de dados.

**2. Integração SSR (`app/dashboard/nfe/page.tsx`)**

- A página agora extrai `searchParams` e repassa integralmente para a action, sem intervir com defaults de "mes_atual". Isso garante que o que está na barra de endereços seja exatamente o que o banco de dados processa.

**3. Single Source of Truth (`nfe-table.tsx`)**

- Removida qualquer redundância de `useState` para controle de período ativo.
- O componente agora é puramente reativo à URL. Se a URL mudar (via botões do browser ou interação), o `useEffect` dispara o re-fetch com os novos dados.

#### Query Params Dinâmicos

- `period`: `hoje | semana | mes_atual | mes_passado | todos | custom` (opcional)
- `from`/`to`: Datas ISO (opcional)
- `emitente`: Busca parcial via `ilike`.
- `status`: Filtro exato via coluna `situacao`.

### 20/02/2026 — Correção Multi-tenant: Acesso XML/DANFE para Users Vinculados

#### Problema Identificado

Users vinculados a um admin recebiam erro 500 ao tentar baixar XML ou visualizar DANFE.
Admin funcionava normalmente.

**Causa raiz:**

```
nfes.user_id = admin.id         (NF-es pertencem ao admin)
profiles.created_by = admin.id  (users são criados pelo admin)

Antes: query filtrava por user_id = auth.uid() (ID do user logado)
       → User logado → busca com user_id = user.id → 0 resultados → erro
```

#### Modelo de Dados Multi-tenant

```
profiles
  id: admin.id       role: 'admin'   created_by: null
  id: user.id        role: 'user'    created_by: admin.id

empresas
  user_id: admin.id  (empresa pertence ao admin)

nfes
  user_id: admin.id  (NF-es pertencem ao admin)
```

#### Solução Aplicada

**1. `actions/nfe-management.ts` — Server Actions**

Substituiu `supabase` client (anon key + RLS) por `supabaseAdmin` + `getOwnerUserId()`:

```typescript
// getOwnerUserId() resolve:
// - Se admin: retorna próprio ID
// - Se user vinculado: retorna profiles.created_by (ID do admin)

const { ownerId } = await requireAuthWithOwner()

supabaseAdmin.from('nfes')
    .select(...)
    .eq('user_id', ownerId)   // ← usa o ID do admin sempre
```

**Permissões por operação:**

| Operação | Admin | User vinculado | Outro tenant |
|---|---|---|---|
| Download XML | ✅ | ✅ | ❌ 403 |
| Visualizar DANFE | ✅ | ✅ | ❌ 403 |
| Atualizar situação | ✅ | ✅ | ❌ 403 |
| Deletar NF-e | ✅ | ❌ (role check) | ❌ 403 |

**2. RLS `nfes` table — Supabase**

```sql
-- SELECT/UPDATE: acesso al tenant completo
CREATE POLICY nfes_tenant_select ON nfes FOR SELECT TO authenticated
USING (
    auth.uid() = user_id
    OR auth.uid() IN (
        SELECT id FROM profiles WHERE created_by = nfes.user_id
    )
);

-- DELETE/INSERT: apenas dono direto (admin)
CREATE POLICY nfes_owner_delete ON nfes FOR DELETE TO authenticated
USING (auth.uid() = user_id);
```

#### Arquivo `lib/get-owner-id.ts`

Helper centralizado que resolve o ownerId para todas as queries. Deve ser usado em qualquer Server Action ou Route Handler que acesse dados de NF-es, empresa ou certificado.

```typescript
const ownerId = await getOwnerUserId()
// → admin.id  (sempre, independente de quem está logado)
```

---

### 20/02/2026 — Integração MeuDanfe API (v3 — Versão Final de Produção)


#### Decisão

Após implementar engine própria com PDFKit (v2), a abordagem foi substituída pela **API MeuDanfe** para garantir fidelidade de 100% ao layout oficial SEFAZ sem manter engine própria.

| Versão | Abordagem | Status |
|---|---|---|
| v1 | Puppeteer + Chromium | ❌ Removida (incompatível com Vercel) |
| v2 | @react-pdf/renderer | ❌ Substituída (layout não fiel) |
| v3 | PDFKit engine própria | ❌ Substituída (manutenção complexa) |
| **v4** | **MeuDanfe API (SaaS externo)** | ✅ **Produção** |

**Motivo da decisão:**
- PDF idêntico ao DANFE oficial emitido pela SEFAZ
- Zero manutenção de layout
- Serverless-safe (fetch HTTP puro)
- Equipe não precisa conhecer spec DANFE para manter
- Escalável para mini SaaS sem reescrever engine

---

#### Variáveis de Ambiente

```bash
# Nunca usar NEXT_PUBLIC_ — expõe chave ao browser!
MEUDANFE_API_KEY=<chave-da-conta>   # https://meudanfe.com.br
```

Adicionar na Vercel: **Settings → Environment Variables → MEUDANFE_API_KEY**

---

#### Arquitetura da Integração

```
services/danfe.service.ts       # Serviço de integração MeuDanfe
app/api/nfe/[id]/pdf/route.ts   # Endpoint com cache
supabase/storage/danfes/        # Bucket de cache dos PDFs
```

#### Fluxo Completo

```
GET /api/nfe/[id]/pdf
  → getOwnerUserId()                           # 1. Autenticação
  → supabaseAdmin.from('nfes')                 # 2. Busca NF-e (filtro user_id)
  → storage.from('danfes').download(path)      # 3. Cache hit? → retorna diretamente
  → converterXmlParaDanfe(xml)                 # 4. Cache miss → POST MeuDanfe API
      → POST api.meudanfe.com.br/v2/fd/convert/xml-to-da
      → resposta: { data: "<base64>" }
      → Buffer.from(data, 'base64')
  → storage.from('danfes').upload(path, pdf)   # 5. Salva no cache
  → new NextResponse(pdf)                      # 6. Retorna inline
```

#### Estratégia de Cache

- **Bucket:** `danfes` (privado, somente backend)
- **Path:** `{user_id}/{nfe_id}.pdf` — isolamento multi-tenant automático
- **Cache-Control:** `private, max-age=3600`
- **Invalidação:** `DELETE /api/nfe/[id]/pdf` apaga cache e força re-geração
- **Falha de upload de cache:** não impede retorno do PDF (graceful degradation)

#### Serviço `converterXmlParaDanfe()`

```typescript
// services/danfe.service.ts
const response = await fetch('https://api.meudanfe.com.br/v2/fd/convert/xml-to-da', {
    method: 'POST',
    headers: { 'Api-Key': apiKey, 'Content-Type': 'text/plain' },
    body: xmlContent,   // XML puro no body
})
const { data } = await response.json()
return Buffer.from(data, 'base64')  // PDF binário
```

#### Bucket Supabase Storage

```sql
-- Criado via MCP Supabase
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('danfes', 'danfes', false, 5242880, ARRAY['application/pdf']);
```

---


- Escalável para branding por empresa (mini SaaS)

---

#### Módulo `lib/danfe/` — Estrutura

```
lib/danfe/
├── parser.ts     # XML → DanfeData tipado
├── layout.ts     # Constantes de layout A4, tipografia, cores, colunas
├── barcode.ts    # Code128 PNG via bwip-js
└── renderer.ts   # Engine PDFKit — renderiza todos os blocos
```

---

#### `parser.ts` — Conversor XML → DanfeData

Responsável por extrair do XML NF-e todos os campos necessários para renderização.

**Interface principal: `DanfeData`**

```typescript
interface DanfeData {
    chaveAcesso: string
    numero: string
    serie: string
    tpNF: '0' | '1'        // 0=Entrada, 1=Saída
    natOp: string
    dhEmi: string
    protocolo: string
    emitente: Emitente
    destinatario: Destinatario
    produtos: Produto[]
    totais: Totais          // vBC, vICMS, vST, vNF, vPIS, vCOFINS...
    transportador: Transportador
    duplicatas: Duplicata[]
    infAdFisco: string
    infCompl: string
    cancelada: boolean
}
```

**Técnica:** regex robustas com suporte a namespaces XML (`nfe:xNome` ou `xNome`). Sem DOM parser externo. Zero dependências externas.

---

#### `layout.ts` — Sistema de Grid

Constantes em pontos PDF (pt). 1mm ≈ 2.835pt. Página A4 = 595.28 x 841.89pt.

```typescript
PAGE.contentWidth = 567pt   // Largura útil
BLOCK_HEIGHT.headerLogo = 60pt
BLOCK_HEIGHT.calc = 34pt
BLOCK_HEIGHT.prodRow = 16pt  // Linha de produto
PROD_COLS = { item, codigo, descricao, ncm, cfop, unid, qtde, vUnit, vTotal }
```

---

#### `barcode.ts` — Code128

Usa `bwip-js` (serverless-safe, JS puro, sem binários):

```typescript
const png = await gerarCodigoBarras(chave44Digitos)   // → Buffer PNG
doc.image(png, x, y, { width: 124, height: 20 })
```

---

#### `renderer.ts` — Engine de Renderização

Blocos renderizados na ordem oficial DANFE:

| Bloco | Conteúdo |
|---|---|
| 1 | Cabeçalho: Emitente + DANFE title + Nº/Série |
| 2 | Chave de Acesso + Código de Barras Code128 + Protocolo |
| 3 | Natureza da Operação \| IE \| CNPJ Emitente |
| 4 | Data Emissão \| Data Entrada/Saída \| Hora |
| 5 | Destinatário / Remetente (Nome, CNPJ, IE, Endereço) |
| 6 | Cálculo do Imposto (BC ICMS, ICMS, ST, IPI, PIS, COFINS, Total) |
| 7 | Transportador / Volumes |
| 8 | Fatura / Duplicatas (opcional) |
| 9 | Tabela de Produtos (dinâmica, com quebra automática de página) |
| 10 | Informações Adicionais / Complementares |
| 11 | Rodapé legal + Marca d'água CANCELADA (se aplicável) |

**Paginação automática:** quando a tabela de produtos ultrapassa o final da página, `doc.addPage()` é chamado e o cabeçalho condensado é re-renderizado na página seguinte.

**Geração em memória:**
```typescript
const doc = new PDFDocument({ ... })
doc.on('data', chunk => chunks.push(chunk))
doc.on('end', () => resolve(Buffer.concat(chunks)))
```

---

#### Fluxo completo do endpoint

```
GET /api/nfe/[id]/pdf
  → getOwnerUserId()           # Autenticação
  → supabaseAdmin.from('nfes') # Busca XML (filtro user_id)
  → parseXmlToDANFE(xml)       # Extrai dados estruturados
  → gerarCodigoBarras(chave)   # PNG Code128
  → renderDanfe(danfeData)     # PDFKit → Buffer
  → new NextResponse(uint8)    # Content-Type: application/pdf
```

---

#### Dependências adicionadas

| Pacote | Versão | Uso |
|---|---|---|
| `pdfkit` | ^0.15 | Engine de geração de PDF |
| `@types/pdfkit` | ^0.15 | Tipos TypeScript |
| `bwip-js` | ^3.x | Code128 serverless |

---

#### Escalabilidade futura (mini SaaS)

A estrutura modular permite:

```
lib/danfe/
├── branding.ts    # Futuro: logomarca por empresa
├── themes.ts      # Futuro: cores/estilos por tenant
└── templates/     # Futuro: DANFE NFC-e, DACTE, etc
```

---

*Documentação atualizada em 20/02/2026.*


#### Parte 1 — Geração de PDF (DANFE) sem Puppeteer

**Problema**: Chromium/Puppeteer não está disponível no ambiente serverless da Vercel.

**Solução**: Substituição completa por `@react-pdf/renderer` — serverless-safe, sem binário, sem filesystem, sem fontes externas.

| Arquivo | Mudança |
|---|---|
| `package.json` | Removido `puppeteer-core` e `@sparticuz/chromium-min`; adicionado `@react-pdf/renderer@4.3.2` |
| `app/api/nfe/[id]/pdf/route.ts` | Reescrito — usa `renderToBuffer()` + conversão `Buffer→Uint8Array` |
| `app/api/nfe/[id]/pdf/danfe-pdf.tsx` | **Novo** — componente JSX DANFE (Document, Page, View, Text) |
| `next.config.ts` | Adicionado `turbopack.resolveAlias` para excluir `canvas` (dependência opcional do react-pdf) |
| `empty-module.js` | **Novo** — módulo vazio que substitui `canvas` no bundle serverless |

**Fluxo atual**:
1. Busca XML do banco (Supabase)
2. Extrai campos via regex (`xmlTag`)
3. Renderiza `<DanfePDF />` via `renderToBuffer()`
4. Retorna stream com headers `Content-Type: application/pdf`

#### Parte 2 — Filtro de Período Corrigido

**Problema**: Seleção de período no dropdown não alterava os dados listados (filtro travado no mês atual).

**Causas identificadas**:
1. `useSearchParams()` sem `<Suspense>` boundary — obrigatório no Next.js App Router
2. `mes_atual` não era incluído na URL (`?period=mes_atual`), causando ambiguidade quando o usuário voltava para esse período

**Correções**:

| Arquivo | Mudança |
|---|---|
| `app/dashboard/nfe/page.tsx` | Adicionado `<Suspense>` ao redor de `<NFeTable>` |
| `app/dashboard/nfe-table.tsx` | `updateUrl()` sempre inclui `?period=` na URL (inclusive `mes_atual`) |
| `actions/nfe.ts` | Adicionados logs explícitos: `Periodo recebido:`, `Data inicial:`, `Data final:` |

---

### 19/02/2026 — Auditoria de Segurança (OWASP)

- Implementação de headers HTTP de segurança (HSTS, X-Frame-Options, CSP)
- Correção de IDOR em rotas de API
- Validação de `user_id` em todos os Server Actions
- Documentação de superfície de ataque

---

### 18/02/2026 — Correção de Multi-tenancy

- Filtro `user_id` adicionado em `getActiveCertificate`, `buildSefazAgent`, `getEmpresaAtiva`
- Isolamento de dados entre usuários garantido em todas as queries

---

*Documentação atualizada em 20/02/2026.****
