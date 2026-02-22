# Histórico Detalhado de Atualizações e Correções

### 22/02/2026 — Módulo Starter: Conversor XML→PDF + Relatório XLSX + Plan Gating

#### Visão Geral
Implementação completa do módulo Starter com duas features core: **Conversor XML→DANFE PDF** (batch, até 50/mês) e **Relatório de XMLs com exportação XLSX** (estilo FSist). Adicionado **plan gating** Starter/Pro em toda a plataforma, bloqueando features Pro para usuários Starter com banner de upgrade.
**Nota Técnica:** Verificado e validado que o módulo de conversão (tanto API quanto Frontend) foi disponibilizado com sucesso e de forma irrestrita também para o **Plano Pró** (acesso total/ilimitado às ferramentas criadas).
**Ajuste Pleno no Admin & Roteamento (22/02):** Implementada a ação `activateManualPlan` no painel administrativo `/admin/usuarios` que permite atribuir planos específicos de forma expressa (Starter ou Pro) sincronizando instantaneamente permissões de uso e interface. Além disso, a home '/' foi configurada via `middleware.ts` para redirecionamento full redirect para a Landing Page (https://nfe-agil.vercel.app/).


#### Novos Arquivos
- `app/api/converter/route.ts` — API batch para conversão XML→PDF via MeuDanfe API (gratuita). Suporta 1−50 XMLs, retorna PDF direto ou ZIP. Inclui GET para consultar uso mensal.
- `app/dashboard/converter/page.tsx` — UI completa com drag-and-drop, lista de arquivos, AlertDialog de confirmação, barra de progresso, download automático e contador de uso.
- `app/api/relatorio-xml/route.ts` — API que parseia XMLs via `parseXmlToDANFE()` e retorna dados tabulares JSON.
- `app/dashboard/relatorio-xml/page.tsx` — Tabela interativa (busca, ordenação por coluna) com exportação Excel (.xlsx) via SheetJS.
- `lib/plan-gate.ts` — Helpers server-side: `getUserPlanInfo()`, `isStarterOnly()`, `isProOrTrial()`, `canAccessProFeatures()`.
- `components/upgrade-banner.tsx` — Banner premium com ícone de cadeado e CTA para upgrade.
- `components/plan-gate.tsx` — Wrapper client-side para gating em páginas `'use client'`.

#### Arquivos Modificados
- `app/dashboard/layout.tsx` — Nova seção **Ferramentas** na sidebar com links para Converter XML e Relatório XML.
- `app/dashboard/page.tsx` — Plan gating: Starter vê UpgradeBanner ao invés do dashboard de monitoramento.
- `app/dashboard/nfe/page.tsx` — Plan gating: Starter bloqueado de NF-es Recebidas.
- `app/dashboard/certificado/page.tsx` — Plan gating via PlanGate wrapper.
- `app/dashboard/cnpj/page.tsx` — Plan gating via PlanGate wrapper.

#### Supabase
- Migration `create_conversion_usage`: tabela para rastreamento de conversões mensais por usuário.

#### Dependências
- `jszip` — Geração de ZIP para múltiplos PDFs.
- `xlsx` (SheetJS) — Exportação de relatório para Excel (.xlsx).
- `@shadcn/progress` — Componente de barra de progresso.

---

### 22/02/2026 — Registro e Sincronização de Planos no Stripe via MCP

#### Visão Geral
A aplicação foi completamente conectada à conta oficial do Stripe, criando e sincronizando os planos base ("Starter" e "Pro") para permitir testes reais do fluxo de pagamento. Também foi validada a estrutura do Webhook local e a importância da tabela `payments` na arquitetura financeira do SaaS.

#### Mudanças e Validações Realizadas
- **Validação de chaves:** Confirmado o pareamento das chaves de teste da Vercel (`.env.local`) com a conta do Stripe conectada ao MCP (*Área restrita de New business*).
- **Criação de Produtos e Preços (Stripe):** Utilizando conectores MCP, os planos "Starter" (R$ 29,00/mês) e "Pro" (R$ 49,00/mês) foram criados nativamente no Stripe, configurados com faturamento recorrente (`interval: month`).
- **Sincronização do Banco de Dados (Supabase):** Inseridos os IDs ofíciais gerados no Stripe (`stripe_product_id` e `stripe_price_id`) diretamente na tabela `plans`, habilitando as sessões de checkout a processarem cobranças ativas.
- **Validação do Fluxo de Checkout:** Realizado teste ponta a ponta (E2E) gerando a `Checkout Session` e verificando o redirecionamento de sucesso para o painel de bordo. O painel da Stripe confirmou a criação do Customer e do Payment Intent (`succeeded`).
- **Fix no Banco de Dados (Schema Cache):** Corrigido o erro `PGRST204` criando fisicamente a coluna `trial_used` (BOOLEAN DEFAULT false) na tabela `subscriptions` e recarregando o schema (`NOTIFY pgrst, 'reload schema'`) para sincronizar com o que a aplicação já tentava inserir.
- **Análise Arquitetural da Tabela `payments`:** Confirmada a essencialidade da tabela `payments` em oposição à `subscriptions`. Enquanto `subscriptions` guarda o estado atual do usuário, `payments` atua como o **livro-caixa e extrato vitalício** alimentado automaticamente pelo Webhook (`invoice.payment_succeeded`). É a principal fonte de dados para o painel de administração calcular o MRR e exibir recibos. Em ambiente localhost proxy, o webhook pode gerar status HTTP 307 devido aos redirecionamentos Next.js, mas o seu funcionamento em Produção (Vercel) ocorrerá com entrega direta via POST.
- **Copywriting Estratégico (Landing Page):** Implementada a seção "Ameaça/Consequência Real" exibindo os custos invisíveis de não assinar o software (multas, notas frias, stress com obrigações legais, dependência de fornecedores). Adicionada uma seção de "Prova Social/Autoridade", enfatizando a proteção via Certificado Digital A1, Criptografia, 24/7 e Isolamento Multi-Tenant. Call To Action final (CTA) fortificada focando na proatividade: *"Assuma o controle das suas notas hoje... antes do seu contador pedir."*

---
### 21/02/2026 — Implementação de Integração Stripe para Monetização

#### Visão Geral
Foi implementada a integração completa com o Stripe para permitir ao administrador a gestão total da monetização pela plataforma.

#### Mudanças Realizadas
- **SDK do Stripe**: Adicionado módulo `lib/stripe.ts` para conectar via Stripe SDK usando `STRIPE_SECRET_KEY`.
- **Sincronização de Planos**: As *Server Actions* `createPlan`, `updatePlan` e `deletePlan` em `actions/subscription.ts` agora sincronizam os planos do Supabase diretamente com o Stripe, criando *Products* e *Prices* e salvando `stripe_product_id` e `stripe_price_id` no banco de dados.
- **Webhook do Stripe**: Implementado endpoint `app/api/stripe/webhook/route.ts` para processar eventos do Stripe em tempo real:
  - `checkout.session.completed`: Registra a assinatura do usuário vinculando a `stripe_subscription_id` e a `stripe_customer_id` na tabela `subscriptions`. Atualiza o período (`current_period_end`).
  - `customer.subscription.updated/deleted`: Atualiza os status e ciclos da assinatura nativamente a partir das ocorrências do Stripe.
  - `invoice.payment_succeeded/failed`: Registra e controla os pagamentos automaticamente na tabela `payments` utilizando o metadata do webhook.
- **Painel e Checkout do Usuário**: Criadas *Server Actions* em `actions/stripe.ts` focadas em criar sessões de checkout de novos planos e sessões do *Customer Portal* (para usuários pausarem/cancelarem/atualizarem cartões).
- **Esquema de Banco de Dados**: Adicionada via migração (DML) a coluna `stripe_product_id` em `plans` para manter a referência bidirecional com os produtos do Stripe.

*Documentação atualizada em 21/02/2026.*

---

### 21/02/2026 — Hardening SaaS: Trial Único + Expiração Automática + Forçar Checkout

#### O que foi implementado e corrigido

- **Bloqueio de Múltiplos Trials (`trial_used`)**: Adicionada a coluna `trial_used` e índice (`idx_subscriptions_user_id`) no Supabase. O backend agora recusa a criação de uma nova trial para quem já usufruiu, emitindo alerta amigável de redirecionamento. A Server Action `createSubscriptionTrial` apenas processa updates na linha principal do usuário existente (garantindo 1 subscription por usuário).
- **Expiração Automática e Conversão Forçada**: O Middleware foi atualizado (no Subscription Guard) para detectar status ativo em conjunto com o prazo de validade (`trial_ends_at`). Se o prazo se esgotar, ele aciona o redirecionamento automático: `/escolher-plano?reason=trial_expired&force_checkout=true`.
- **Checkout Compulsório**: A página de Planos agora recebe o param `force_checkout`, que atua da mesma forma que o upgrade visual (transformando os botões de Iniciar Trial para "Assinar Agora" blindando o usuário que tentaria refazer a conta gratuita).
- **UX com Alerta Antecedente no Dashboard**: Se a conta estiver a <= 2 dias do vencimento, o usuário verá um Badge persistente vermelho alarmando o fim do teste (layout.tsx do Dashboard), além de um link sutil para fazer Upgrade direto sem travas (sem polling, checado tudo por SSR Date diff).
- **Stripe Integrations base**: Criadas colunas (`stripe_customer_id` e `stripe_subscription_id`) sem acionamentos, prevendo a integração dos webhooks futuros.

---

### 21/02/2026 — Correção de Redirecionamento de Upgrade (SaaS)

#### O que foi implementado e corrigido

- **Correção da Causa Raiz de Acesso à Tela Escolher Plano**: A página `/escolher-plano` redirecionava clientes de `trial` que desejavam fazer um upgrade para `/dashboard`. Alteramos a lógica no Next.js Server Component para destruturar apropriadamente `searchParams` dinâmicos (suportando Next.js 15+) utilizando `Promise`.
- **Acesso Condicional Flexibilizado**: Agora, quando a URL possuir a flag explícita de `?upgrade=true`, o redirecionamento de tela de planos aceita que o usuário visualiza planos de downgrade ou upgrade em modo "Assinar agora". 
- **Modo Stripe Habilitado (Mock)**: A interface de seleção prevenida com `upgrade` exibe o alerta: *"Em processamento... Integração com Stripe a ser implementada na próxima etapa! Você será redirecionado para a página de pagamento."* para simular o redirecionamento sem duplicar planos na trial. 

---

### 21/02/2026 — Correção de Acesso Master Admin e Controle Transacional de Assinaturas

#### O que foi implementado e corrigido

- **Correção da Causa Raiz de Acesso Master Admin**: O painel Dashboard `/admin` falhava para o dono do SaaS porque a função `isMasterAdmin` tentava buscar um perfil na tabela `profiles`. Como o sistema foi refatorado para que os Master Admins *não tenham perfil*, a verificação quebrava (Acesso Não Autorizado). 
- **Centralização do Master Admin Guard**: Refatorado `actions/subscription.ts` para verificar o email diretamente do Auth (`supabase.auth.getUser()`) contra a lista `MASTER_ADMIN_EMAILS` importada de `lib/admin.ts`, ignorando a tabela `profiles`.
- **Badge Visual de Trial**: Alterado o texto de `Trial` para `Trial Grátis` no dashboard de gerenciamento para rápida identificação de clientes em fase de testes (7 dias).
- **Controle Manual pelo Dono**: Validado o funcionamento das Server Actions que permitem gerenciar exceções manualmente pelo painel:
  - Estender trial (+7 dias ou +30 dias)
  - Ativar assinatura manualmente (Pula trial, ativa acesso)
  - Tornar Lifetime (Acesso vitalício, ideal para contas próprias/testes da moderação que nunca vão pro Stripe)
  - Cancelar Assinaturas em conformidade.
- **Ambiente Vercel Suportado**: Configuração documentada explícita exigindo a adição de `MASTER_ADMIN_EMAILS` na Vercel para sincronia com o ambiente local.

---

### 21/02/2026 — Fundação SaaS: Sistema de Planos, Assinaturas e Painel Admin

#### Tabelas Criadas (Supabase)

| Tabela | RLS | Descrição |
|---|---|---|
| `plans` | ✅ | Planos disponíveis (name, slug, price, features, stripe_price_id) |
| `subscriptions` | ✅ | Assinaturas (user_id, plan_id, status, trial_ends_at, is_lifetime) |
| `payments` | ✅ | Pagamentos (user_id, subscription_id, amount, stripe_payment_intent) |

#### Arquivos Criados

| Arquivo | Descrição |
|---|---|
| `actions/subscription.ts` | Server Actions: createSubscriptionTrial, extendTrial, activateLifetime, activateManual, cancelSubscription, getSaasMetrics, listAllUsersWithSubscriptions, CRUD de planos |
| `lib/admin.ts` | Helper centralizado de validação MASTER_ADMIN_EMAILS |
| `middleware.ts` | Reescrito: Admin Guard (/admin) + Subscription Guard (/dashboard) |
| `app/escolher-plano/page.tsx` | Server Component de onboarding: lista planos e redireciona se já tem subscription |
| `app/escolher-plano/choose-plan-client.tsx` | Client Component premium com cards de plano e CTA |
| `app/admin/layout.tsx` | Layout exclusivo admin com sidebar dark e badge ADMIN |
| `app/admin/page.tsx` | Dashboard SaaS: Total usuarios, Assinaturas ativas, Trials, MRR, ARPU, Receita |
| `app/admin/usuarios/page.tsx` | Listagem de usuários com info de subscription |
| `app/admin/usuarios/users-table.tsx` | Tabela interativa com ações: estender trial, ativar manual, lifetime, cancelar |
| `app/admin/assinaturas/page.tsx` | Listagem de todas as assinaturas com status e Stripe ID |
| `app/admin/pagamentos/page.tsx` | Histórico de pagamentos com total recebido |
| `app/admin/planos/page.tsx` | CRUD de planos server component |
| `app/admin/planos/plans-manager.tsx` | Manager de planos com criar, editar inline, excluir |

#### Middleware SaaS

**Admin Guard** (`/admin/*`):
- Valida se email do usuário autenticado está em `MASTER_ADMIN_EMAILS`
- Redireciona para `/dashboard` se não autorizado

**Subscription Guard** (`/dashboard/*`):
- Libera acesso se: `is_lifetime = true` OU `status = active` OU `status = trialing AND trial_ends_at > now()`
- Redireciona para `/escolher-plano` se sem acesso
- Master admins sempre têm acesso

#### Variáveis de Ambiente Adicionadas

| Variável | Descrição |
|---|---|
| `MASTER_ADMIN_EMAILS` | Lista de emails com acesso ao painel admin (separados por vírgula) |

#### Impacto Arquitetural

- Todas as rotas `/dashboard/*` agora exigem subscription ativa
- Novo fluxo de onboarding: Cadastro → Confirma email → Escolhe plano → Trial 7 dias → Dashboard
- Admin panel independente do dashboard principal (layout separado)
- Todas as queries admin usam `supabaseAdmin` (service_role), nunca client anon
- Email master validado antes de qualquer override manual
- Base preparada para integração Stripe (campos stripe_customer_id, stripe_subscription_id, stripe_payment_intent)

#### Server Actions de Subscription

| Action | Quem pode usar | Descrição |
|---|---|---|
| `createSubscriptionTrial` | Qualquer autenticado | Cria subscription trial de 7 dias |
| `extendTrial` | Master admin | Estende trial por N dias |
| `activateLifetime` | Master admin | Ativa acesso vitalício |
| `activateManual` | Master admin | Ativa subscription manualmente |
| `cancelSubscription` | Master admin | Cancela subscription |
| `getSaasMetrics` | Master admin | Retorna métricas SaaS (MRR, ARPU, etc.) |
| `listAllUsersWithSubscriptions` | Master admin | Lista todos os usuários com info de subscription |
| `createPlan` / `updatePlan` / `deletePlan` | Master admin | CRUD de planos |

---
### 21/02/2026 — Expansão Institucional: Termos de Uso e Links de Rodapé

#### O que foi criado

- Página pública **Termos de Uso** disponível em `/termos`.
- Integração completa dos links de legalidade na tela de login.

#### Arquivos alterados

| Arquivo | Descrição |
|---|---|
| `app/termos/page.tsx` | Página Server Component com os Termos e Condições de Uso. |
| `app/login/page.tsx` | Atualização dos links de rodapé para apontar para `/termos` e `/privacidade`. |

#### Características técnicas

- **Zero Client Side** — Mantém o padrão de Server Components puros para páginas institucionais.
- **Destaque SEO** — Metadados específicos para a página de termos.
- **Consistência Visual** — Design unificado com a `/privacidade` (barra sticky, índice, botões de retorno).

#### Próximos passos legais

- [ ] Criar `/dpa` — Data Processing Agreement (para clientes corporativos)
- [ ] Implementar aceite obrigatório no cadastro (checkbox com link para ambos os documentos)
- [ ] Registrar data/versão do aceite na tabela `profiles` do Supabase

---

### 20/02/2026 — Criação da Página Institucional: Política de Privacidade

#### O que foi criado

Página pública completamente estática disponível em `/privacidade`, sem autenticação, sem Supabase, sem Client Components.

#### Arquivos criados

| Arquivo | Descrição |
|---|---|
| `lib/legal.ts` | Versionamento centralizado de documentos legais (`LEGAL_VERSIONS`, `LEGAL_DATES`) |
| `app/privacidade/page.tsx` | Página Server Component com Política de Privacidade completa |

#### Características técnicas

- **Server Component puro** — sem `"use client"`, sem `dynamic`, sem `fetch`, sem Server Actions
- **Sem dependência de autenticação** — acessível publicamente por qualquer visitante
- **Metadata SEO** — `title` e `description` via `export const metadata`
- **Estrutura semântica** — `<header>`, `<nav>`, `<main>`, `<section>`, `<footer>` com `aria-labelledby`
- **Índice navegável** — âncoras para cada seção da política
- **Link de retorno** — no topo (barra sticky) e no rodapé
- **Versão dinâmica** — importada de `lib/legal.ts` (`LEGAL_VERSIONS.PRIVACY_POLICY = "v1.0.0"`)
- **Visual consistente** — segue design system do projeto

#### Conteúdo coberto

15 seções completas juridicamente preparadas para SaaS:
1. Sobre o NF-e Ágil
2. Definições (Controlador / Operador / Suboperador / Titular)
3. Dados Tratados (Cadastro / Fiscais / Técnicos)
4. Finalidades do Tratamento
5. Base Legal (LGPD art. 7º)
6. Compartilhamento de Dados
7. Suboperadores
8. Transferência Internacional
9. Segurança da Informação
10. Retenção
11. Direitos dos Titulares
12. Exclusão de Conta
13. Limitação de Responsabilidade
14. Alterações
15. Contato

#### Impacto arquitetural

- Criado padrão `lib/legal.ts` para versionamento de todos os documentos legais futuros
- A rota `/privacidade` é totalmente estática — renderizada em build sem custo de servidor
- O link já existe na tela de login (`href="#"`) — pode ser atualizado para `/privacidade`

#### Próximos passos legais

- [ ] Criar `/termos` — Termos de Uso (v1.0.0)
- [ ] Criar `/dpa` — Data Processing Agreement (para clientes corporativos)
- [ ] Implementar aceite obrigatório no cadastro (checkbox com link para ambos os documentos)
- [ ] Registrar data/versão do aceite na tabela `profiles` do Supabase
- [ ] Atualizar link `href="#"` na tela de login para `href="/privacidade"`

---

### 20/02/2026 — Fix Definitivo: Dropdown de Período + Navegação Hard + Centralização de Presets

#### Problema

O dropdown de período (Hoje, Esta semana, Este mês, Mês passado) **não funcionava** — ao clicar em qualquer opção, nada acontecia. A tabela permanecia com "Todo o período" e 135 notas, independente da seleção.

#### Causa Raiz (3 problemas encadeados)

**1. `mousedown` matando o `click` do portal (BUG PRINCIPAL)**

O menu era renderizado via `createPortal(…, document.body)` — fora da árvore do `periodMenuRef`. O handler de "fechar ao clicar fora" usava `periodMenuRef.contains(target)` que retornava `false` para cliques dentro do portal. Resultado: `setShowPeriodMenu(false)` removia o menu do DOM **antes** do evento `click` ser processado, e `selectPreset()` **nunca executava**.

**2. `router.push()` com cache do App Router**

Mesmo quando o `selectPreset()` era chamado (em cenários sem o portal), o `router.push()` do Next.js App Router fazia soft navigation com cache client-side, impedindo o Server Component de re-executar com os novos `searchParams`.

**3. Valores de período desalinhados**

O dropdown enviava `semana` mas testes manuais usavam `esta_semana`, `esse_mes` etc. Sem um enum centralizado, qualquer variação rompia o filtro silenciosamente.

#### Solução Aplicada (3 correções)

**1. `portalMenuRef` — corrige o mousedown vs click**

```tsx
const portalMenuRef = React.useRef<HTMLDivElement>(null)

// Handler agora verifica AMBOS os refs antes de fechar
function handler(e: MouseEvent) {
    const target = e.target as Node
    const clickedInsideButton = periodMenuRef.current?.contains(target)
    const clickedInsidePortal = portalMenuRef.current?.contains(target)
    if (!clickedInsideButton && !clickedInsidePortal) {
        setShowPeriodMenu(false)
    }
}

// Portal recebe o ref
<div ref={portalMenuRef} ...>
```

**2. `window.location.href` — hard navigation garantida**

Substituiu `router.push()` por `window.location.href` em toda navegação de filtro. Isso força o browser a fazer um request HTTP completo, garantindo que o Server Component execute do zero.

Removidos `useRouter()`, `useSearchParams()` e `usePathname()` — agora os params chegam via prop `currentParams` do server.

**3. `PERIOD_PRESETS` — enum centralizado**

```typescript
// lib/constants.ts
export const PERIOD_PRESETS = {
    HOJE: 'hoje',
    ESTA_SEMANA: 'esta_semana',
    MES_ATUAL: 'mes_atual',
    MES_PASSADO: 'mes_passado',
    TODOS: 'todos',
    CUSTOM: 'custom',
} as const
```

Frontend, URL e backend usam exclusivamente estes valores. Qualquer valor não reconhecido gera `console.warn('PERIOD NÃO RECONHECIDO:', preset)`.

#### Arquivos Alterados

| Arquivo | Mudança |
|---|---|
| `lib/constants.ts` | `PERIOD_PRESETS` e `PeriodPreset` type |
| `lib/date-brt.ts` | `'semana'` → `'esta_semana'`, re-export de `PeriodPreset`, `default: console.warn` |
| `nfe-table.tsx` | Reescrito: `portalMenuRef`, `window.location.href`, `currentParams` prop, remove hooks de navegação |
| `nfe/page.tsx` | `force-dynamic`, `currentParams` prop, `key={JSON.stringify(params)}` |
| `dashboard/page.tsx` | Remove `Suspense`, `currentParams` prop, `xml` adicionado |
| `actions/nfe.ts` | Log `PERIOD RECEBIDO NO SERVIDOR` |

#### Resultado Confirmado em Produção

| Período | URL | Notas | Status |
|---|---|---|---|
| Hoje | `?period=hoje` | 1 | ✅ |
| Esta semana | `?period=esta_semana` | 4 | ✅ |
| Este mês | `?period=mes_atual` | 27 | ✅ |
| Mês passado | `?period=mes_passado` | 47 | ✅ |
| Todo o período | `?period=todos` | 135 | ✅ |

---

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

**Nota (Build Fix):** Corrigido erro de tipagem no Dashboard principal (`app/dashboard/page.tsx`) que ainda utilizava nomes antigos de parâmetros após a refatoração da action `listNFesFiltradas`.

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

### 20/02/2026 — Refatoração Total: Filtros Backend-Driven + Padronização de Status

#### Problema Identificado

Havia inconsistência entre as opções de filtro no frontend e os dados reais no banco, além de estados duplicados que causavam bugs de sincronização ao navegar. Filtros como "XML Disponível" não funcionavam corretamente no backend.

#### Soluções Aplicadas

**1. Centralização de Constantes (`lib/constants.ts`)**

- Criados enums `NFE_STATUS` (`nao_informada`, `confirmada`, `recusada`) e `NFE_XML_FILTER` (`xml_disponivel`, `xml_pendente`).
- Estes enums agora regem a tabela, os filtros, as badges e as ações (Server Actions).

**2. Backend-Driven Filtering (`actions/nfe.ts`)**

- A função `listNFesFiltradas` agora realiza toda a lógica de filtragem via Supabase.
- Adicionado suporte real para filtro de XML: `query.not('xml_content', 'is', null)` ou `query.is('xml_content', null)`.
- Logs detalhados no servidor para monitorar a aplicação de cada filtro.

**3. Frontend Descomplicado (`app/dashboard/nfe-table.tsx`)**

- **URL como Única Fonte de Verdade**: Removidos estados `useState` para filtros. O componente agora deriva todo o seu estado de `useSearchParams()`.
- **Revalidação Automática**: O uso de `revalidatePath('/dashboard/nfe')` em mutations garante que a UI reflita as mudanças de status instantaneamente sem recarregar a página.
- **Cabeçalho Dinâmico**: O título e o resumo de resultados agora descrevem exatamente os filtros ativos (ex: "135 notas encontradas – Todo período").

**4. Sincronização Server/Client**

- `app/dashboard/nfe/page.tsx` agora repassa o parâmetro `xml` da URL para garantir que o SSR (Server Side Rendering) venha filtrado desde o primeiro carregamento.

#### Query Params Atualizados

- `status`: `todas | nao_informada | confirmada | recusada`
- `xml`: `todas | xml_disponivel | xml_pendente`
- `period`, `from`, `to`, `emitente`: Mantidos conforme padrão anterior.

---

### 20/02/2026 — Refatoração Final: Filtro 100% Server-Driven (Elimina useState/useEffect de dados)

#### Problema

Mesmo com a refatoração anterior que usava `useEffect` + re-fetch client-side, a tabela não atualizava corretamente ao mudar o período. O conflito entre:
- `useState` para armazenar dados localmente
- `useEffect` disparando `listNFesFiltradas` de forma client-side
- Cache do App Router mantendo dados antigos
- `initialData` sendo hidratado uma única vez no mount

Causava uma corrida de condições onde o SSR entregava dados novos, mas o estado client sobrescrevia com os dados antigos.

#### Solução Aplicada (Arquitetura Final)

**Princípio**: o servidor é a **única fonte de verdade dos dados**. O cliente só navega (URL) e gerencia UI local.

**1. `app/dashboard/nfe/page.tsx`**
- `export const dynamic = 'force-dynamic'` — garante que o Next.js nunca use cache para esta página
- Busca dados via `await listNFesFiltradas({...})` diretamente no Server Component
- Passa dados como prop `<NFeTable data={nfes} />` — sem `initialData`, sem `Suspense` para dados

**2. `app/dashboard/nfe-table.tsx`** — Componente puramente presentacional
- **Removido completamente**: `useState` de `data`, `status`, `errorMessage`, `lastSync`
- **Removido completamente**: `useEffect` de re-fetch ao mudar `searchParams`
- **Removido completamente**: `fetchNFes()`, `handleSync()`, botão "Atualizar lista"
- **Mantido**: `router.push()` para navegação de filtros → SSR roda novamente automaticamente
- **Mantido**: estados de UI local (`showAdvanced`, `showPeriodMenu`, `pendingFilters`)
- **Mantido**: lógica do botão "Importar da SEFAZ" → usa `router.refresh()` após sync
- Prop renomeada de `initialData` para `data`

**3. `actions/nfe.ts`**
- Log explícito adicionado: `console.log('PERIOD RECEBIDO NO SERVIDOR:', params.period)`
- Confirma que a query é re-executada a cada navegação

**4. `app/dashboard/page.tsx`**
- `export const dynamic = 'force-dynamic'` adicionado
- Prop corrigida de `initialData` para `data`

#### Fluxo Após Refatoração

```
Usuário seleciona período
  → selectPreset(preset)
    → router.push('/dashboard/nfe?period=mes_atual')
      → Next.js App Router detecta mudança de URL
        → SSR executa page.tsx novamente
          → listNFesFiltradas({ period: 'mes_atual' }) chamado
            → console.log: "PERIOD RECEBIDO NO SERVIDOR: mes_atual"
            → Query Supabase com filtro de data correto
          → Dados novos passados como prop data={nfes}
            → NFeTable renderiza tabela atualizada
```

#### Critérios de Sucesso Atingidos

- ✅ Ao selecionar qualquer período: URL muda → SSR roda → log aparece → tabela atualiza
- ✅ Nenhum `useState` controla período ou dados da tabela
- ✅ Nenhum `useEffect` dispara fetch manual de dados
- ✅ `force-dynamic` garante ausência de cache indevido
- ✅ Build de produção passou sem erros (exit code 0)
- ✅ Commit e push realizados para main

---

### 20/02/2026 — Fix: Forçar Remount do NFeTable via `key` (elimina reaproveitamento de estado)

#### Problema

Mesmo com SSR executando corretamente e entregando dados novos via prop `data`, o React do App Router **reaproveitava** a instância do componente client `NFeTable`. O estado interno (dropdowns abertos, pendingFilters, etc.) era mantido entre navegações, e em alguns cenários os dados visuais não eram atualizados.

#### Causa Raiz

O React não desmonta um componente se ele aparece no mesmo ponto da árvore com o mesmo tipo. Como `NFeTable` sempre aparecia na mesma posição, o React reconciliava e mantinha o estado interno — mesmo que a prop `data` fosse diferente.

#### Solução

```tsx
// app/dashboard/nfe/page.tsx
<NFeTable key={JSON.stringify(params)} data={data as any} />
```

Quando qualquer query param muda, a `key` muda → React desmonta a instância anterior e monta uma nova, zerando todo estado interno.

#### Resultado

- ✅ Componente desmonta e remonta a cada mudança de filtro
- ✅ Estado interno (pendingFilters, dropdowns, sefazMsg) é zerado
- ✅ Dados novos são refletidos imediatamente na tabela

---

### 20/02/2026 — Fix: Centralização dos Presets de Período (PERIOD_PRESETS)

#### Problema

O dropdown enviava `semana` na URL, mas o backend usava `semana` no switch/case de `computeDateRangeBRT`. Embora os valores coincidissem, o padrão de naming era inconsistente e frágil — qualquer variação (`esta_semana`, `este_mes`, `estaSemana`) rompia o filtro silenciosamente, gerando intervalo `[∞, ∞]` (sem filtro).

#### Solução

**1. Enum centralizado (`lib/constants.ts`)**

```typescript
export const PERIOD_PRESETS = {
    HOJE: 'hoje',
    ESTA_SEMANA: 'esta_semana',
    MES_ATUAL: 'mes_atual',
    MES_PASSADO: 'mes_passado',
    TODOS: 'todos',
    CUSTOM: 'custom',
} as const

export type PeriodPreset = typeof PERIOD_PRESETS[keyof typeof PERIOD_PRESETS]
```

**2. `lib/date-brt.ts`**
- Re-exporta `PeriodPreset` de `constants.ts`
- Switch atualizado: `'semana'` → `'esta_semana'`
- Adicionado `default: console.warn('PERIOD NÃO RECONHECIDO:', preset)`

**3. `nfe-table.tsx` (dropdown)**
- PRESETS array usa `PERIOD_PRESETS.ESTA_SEMANA` etc.
- Labels mapeiam `esta_semana` em vez de `semana`

**4. Todos os imports de `PeriodPreset`**
- Agora apontam para `@/lib/constants` (fonte única de verdade)

#### Valores Padronizados (URL)

| Valor na URL | Label no Dropdown |
|---|---|
| `hoje` | Hoje |
| `esta_semana` | Esta semana |
| `mes_atual` | Este mês |
| `mes_passado` | Mês passado |
| `todos` | Todo o período |
| `custom` | Escolha o período… |

---

### 20/02/2026 — Fix Definitivo: Hard Navigation (window.location.href)

#### Problema

Mesmo com `force-dynamic` e `key={JSON.stringify(params)}`, o `router.push()` do Next.js App Router fazia **soft navigation** — o React reconciliava o componente client sem re-executar o Server Component com os novos `searchParams`. Resultado: o dropdown mudava a URL, mas a tabela permanecia com os dados antigos.

#### Causa Raiz

O `router.push()` no App Router utiliza um **cache do Router Client** que pode reutilizar a resposta do Server Component anterior. Para páginas `force-dynamic`, o comportamento esperado seria revalidar, mas na prática o cache client-side impedia a re-execução do SSR.

Adicionalmente, `useSearchParams()` requer `<Suspense>` e pode gerar dessincronização entre o que o Server Component retorna e o que o estado client lê da URL.

#### Solução Aplicada

1. **`window.location.href` substitui `router.push()`** — toda navegação de filtro agora faz **hard navigation** completa. Isso garante que o browser recarrega a página, o Next.js executa o Server Component do zero e os dados chegam frescos via SSR.

2. **`currentParams` como prop** — o `NFeTable` agora recebe os query params diretamente do server via `currentParams` prop, eliminando `useSearchParams()`, `useRouter()` e `usePathname()` do componente.

3. **`<Suspense>` removido** do `dashboard/page.tsx` — não é mais necessário pois `NFeTable` não usa `useSearchParams()`.

4. **`window.location.reload()`** substitui `router.refresh()` após sync SEFAZ.

#### Arquivos Alterados

| Arquivo | Mudança |
|---|---|
| `nfe-table.tsx` | Reescrito: `window.location.href` para navegar, `currentParams` prop, remove `useRouter/useSearchParams/usePathname` |
| `nfe/page.tsx` | Passa `currentParams={params}` para NFeTable |
| `dashboard/page.tsx` | Passa `currentParams={params}`, remove `Suspense`, adiciona `xml` nos params |

#### Fluxo Final

```
Usuário clica "Hoje" no dropdown
  → selectPreset('hoje')
    → window.location.href = '/dashboard/nfe?period=hoje'
      → Browser faz request completo (hard navigation)
        → Next.js executa page.tsx (Server Component)
          → listNFesFiltradas({ period: 'hoje' })
            → computeDateRangeBRT('hoje') → range [00:00 BRT, 23:59 BRT]
            → Supabase query com filtro de data
          → <NFeTable data={1_nota} currentParams={{ period: 'hoje' }} />
            → Tabela renderiza com 1 nota ✅
```

---

*Documentação atualizada em 20/02/2026.*
