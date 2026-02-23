---
name: full-stack-architect
description: >
  Obligatory architectural rules and conventions for Node.js + React + TypeScript projects. 
  Triggers when reviewing project architecture, creating new modules, refactoring, or 
  designing full-stack features using Supabase infrastructure.
---

# GLOBAL ARCHITECTURE RULES
Stack: Node.js + React + TypeScript
Escopo: Aplicável a qualquer projeto nesta stack
Natureza: Regras obrigatórias de arquitetura e organização

---

# 1. FUNDAMENTOS OBRIGATÓRIOS

- Aplicar SRP (Single Responsibility Principle)
- Garantir baixo acoplamento
- Garantir alta coesão
- Separação clara de camadas
- Evitar duplicação (DRY)
- Código explícito > código implícito
- Tipagem forte obrigatória
- Legibilidade é prioridade sobre “esperteza”
- Arquitetura sempre prevalece sobre velocidade

---

# 2. TYPESCRIPT (FRONTEND E BACKEND)

## 2.1 Regras Gerais

- Proibido uso de `any`
- Funções públicas devem ter tipo de retorno explícito
- Parâmetros sempre tipados
- Nunca expor tipos implícitos em contratos externos
- Criar tipos por domínio
- Separar DTO de Model quando houver transformação
- Nunca misturar regra de negócio dentro de tipos

Exemplo obrigatório de separação:

```ts
export interface UserDTO {
  id: string;
  created_at: string;
}

export interface User {
  id: string;
  createdAt: Date;
}
```

Transformação deve ocorrer na camada de service/usecase.

---

# 3. FRONTEND – REACT

## 3.1 Organização por Domínio (Feature First)

Estrutura obrigatória:

src/
  modules/
    dominio/
      components/
      hooks/
      services/
      types.ts
      index.ts
  shared/
    components/
    hooks/
    utils/
  routes/

Regras:

- Nada específico de uma feature pode ficar fora dela
- Código reutilizável deve ir para `shared`
- Proibido organização puramente por tipo técnico global

---

## 3.2 Camadas Obrigatórias

Component
↓
Hook
↓
Service
↓
HTTP Client

Regras:

- Componentes NÃO chamam API diretamente
- Services NÃO conhecem React
- Hooks concentram estado e orquestração
- Componentes apenas renderizam e recebem props

---

## 3.3 Componentes

- Devem ser puros
- Sem regra de negócio pesada
- Sem manipulação complexa de dados
- Props obrigatoriamente tipadas
- Uma responsabilidade por componente

---

## 3.4 Estado

Separação obrigatória:

- Server State → dados externos
- Client State → estado de UI

Nunca misturar os dois.

Estado global apenas quando:
- Autenticação
- Configurações globais
- Dados compartilhados entre múltiplas features

---

## 3.5 Services (Frontend)

- Contêm apenas integração externa
- Transformam DTO → Model
- Retornam dados tipados
- Não manipulam estado
- Não conhecem React

---

## 3.6 Imports

Proibido:

- Importação cruzada entre features
- Dependência circular
- Acesso direto a arquivos internos de outra feature

Permitido:

- Uso via index.ts
- Abstrações em shared

---

# 4. BACKEND – NODE + TYPESCRIPT

## 4.1 Camadas Obrigatórias

Controller
↓
UseCase / Service
↓
Repository
↓
Database

---

## 4.2 Controller

- Recebe request
- Valida entrada
- Chama UseCase
- Retorna resposta
- Não contém regra de negócio

---

## 4.3 UseCase / Service

- Contém regra de negócio
- Independente de framework
- Recebe dependências via injeção
- Testável isoladamente

---

## 4.4 Repository

- Responsável apenas por acesso a dados
- Sem regra de negócio
- Retorna entidades tipadas

---

## 4.5 Entidades

- Representam domínio
- Não dependem de banco
- Não dependem de framework

---

# 5. TRATAMENTO DE ERROS

- Nunca lançar erro genérico
- Criar classes específicas de erro
- Padronizar estrutura de resposta
- Nunca expor stack trace em produção

---

# 6. PADRONIZAÇÃO DE NOMES

Arquivos:
- kebab-case para arquivos
- PascalCase para classes e componentes
- camelCase para funções

Hooks:
useNomeDoDominio.ts

Services:
acao-dominio.service.ts

UseCases:
acao-dominio.usecase.ts

---

# 7. VALIDAÇÃO

- Nunca confiar em dados externos
- Validar no controller
- Validar DTO antes de transformação
- Não confiar em tipagem apenas como validação

---

# 8. TESTABILIDADE

Código deve permitir:

- Teste unitário de UseCases
- Mock de Repositories
- Mock de HTTP Client
- Teste isolado de Services

Se não for testável, está acoplado demais.

---

# 9. PROIBIÇÕES ABSOLUTAS

- Lógica de negócio dentro de Controller
- Lógica de negócio dentro de Component
- Acesso direto ao banco fora do Repository
- Uso de any
- Código duplicado
- Dependência circular
- Mistura de camadas
- Arquitetura improvisada

---

# 10. CRITÉRIO DE ACEITAÇÃO ARQUITETURAL

Toda implementação deve ser:

- Modular
- Escalável
- Tipada
- Organizada por domínio
- Sem duplicação
- Testável
- Previsível
- Consistente com estas regras

Se violar qualquer regra acima, a implementação deve ser considerada incorreta até ser corrigida.
---

# 11. INFRAESTRUTURA PADRÃO – SUPABASE

Supabase é definido como infraestrutura padrão para:

- Banco de dados (PostgreSQL)
- Autenticação
- Storage (quando necessário)

Supabase é considerado camada de infraestrutura.
Nunca deve fazer parte da regra de negócio.

---

## 11.1 Posição Arquitetural

Arquitetura obrigatória no backend:

Controller
↓
UseCase
↓
Repository
↓
Supabase Client

Regras obrigatórias:

- UseCase NÃO pode conhecer Supabase
- Controller NÃO pode acessar Supabase
- React NÃO pode acessar Supabase diretamente
- Apenas a camada Repository pode utilizar o client do Supabase

---

## 11.2 Encapsulamento

O client do Supabase deve ficar isolado em camada de infraestrutura:

infra/
  database/
    supabase.client.ts

Repositories devem depender apenas de abstrações.

Nunca espalhar chamadas Supabase pelo sistema.

---

## 11.3 Regra de Domínio

- Queries não devem conter regra de negócio
- Regra de negócio pertence ao UseCase
- Repository apenas persiste e recupera dados

---

## 11.4 Possível Substituição Futura

A arquitetura deve permitir substituição do Supabase sem impactar:

- Controllers
- UseCases
- Entidades
- Frontend

Se a troca de banco exigir alteração fora da camada Repository,
a arquitetura está incorreta.

---

## 11.5 Autenticação

Se utilizar Supabase Auth:

- Tokens devem ser validados no backend
- Nunca confiar apenas na validação do frontend
- Regras de autorização devem existir no backend
- Não misturar regra de autorização dentro de queries SQL

---

## 11.6 Proibições

- Proibido usar Supabase direto no React para lógica crítica
- Proibido usar Supabase direto no Controller
- Proibido misturar regra de negócio com query
- Proibido espalhar instâncias do client pelo sistema

---
