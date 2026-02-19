---
name: boas-praticas-nextjs
description: Define boas práticas de desenvolvimento para projetos Next.js com Supabase. Aplicar sempre ao final de qualquer alteração de código: executar build de validação local, verificar erros de TypeScript e confirmar que o servidor dev refletiu as mudanças em tempo real. Inclui regra de commit automático após validação.
---

# Boas Práticas — NF-e Ágil (Next.js + Supabase)

Este skill define o fluxo obrigatório que deve ser seguido **ao final de cada alteração realizada no projeto**, garantindo que o ambiente local esteja sempre atualizado, sem resíduos de builds antigas, e que o usuário consiga validar as mudanças em tempo real.

---

## Quando Usar Este Skill

- Ao finalizar qualquer edição de código (Server Actions, componentes, rotas, layouts)
- Após alterações de banco de dados (migrações Supabase, novas colunas, triggers)
- Após instalar ou remover dependências
- Após corrigir erros de lint ou TypeScript
- Quando o usuário reportar que as mudanças "não apareceram" na tela

---

## Fluxo Obrigatório Pós-Alteração

### Passo 1 — Verificar Erros TypeScript

Antes de qualquer coisa, confirmar que não há erros de tipos:

```powershell
npx tsc --noEmit
```

- **Exit code 0** → sem erros, prosseguir
- **Exit code 1** → corrigir todos os erros antes de continuar

> Nunca deixar erros TypeScript sem resolver. Eles causam falhas silenciosas em produção.

---

### Passo 2 — Reiniciar o Servidor de Desenvolvimento (quando necessário)

O Next.js com Turbopack (next dev) faz hot-reload automático de código. **Porém**, reiniciar é obrigatório quando:

| Situação | Ação |
|----------|------|
| Instalação/remoção de dependência (`npm install`) | Reiniciar obrigatório |
| Alteração em `next.config.ts` ou `.env.local` | Reiniciar obrigatório |
| Erro de cache inexplicável persiste | Reiniciar + limpar cache |
| Middleware alterado | Reiniciar obrigatório |
| Hot-reload parou de funcionar | Reiniciar obrigatório |
| Alterações normais de código | Hot-reload automático (não precisa reiniciar) |

**Comandos para reiniciar:**

```powershell
# Parar o servidor atual (Ctrl+C no terminal) e subir novamente:
npm run dev
```

---

### Passo 3 — Build de Validação Completa (quando há dúvida)

Se houver qualquer dúvida sobre erros de build que não aparecem no dev, rodar:

```powershell
npm run build
```

Isso detecta:
- Erros de Server Components vs Client Components
- Exports inválidos em arquivos `'use server'`
- Imports quebrados
- Erros de metadata/SEO
- Problemas com `generateStaticParams`

> ⚠️ **Importante**: o build de produção é mais rigoroso que o dev. Erros que passam no dev podem falhar no build.

Se o build passar:
```
✓ Compiled successfully
```

O ambiente está limpo e as mudanças são válidas.

---

### Passo 4 — Limpeza de Cache (quando build falha por razão obscura)

Se o servidor dev ou build apresentar erros inexplicáveis:

```powershell
# Limpar cache do Next.js
Remove-Item -Recurse -Force .next

# Reinstalar dependências (se suspeitar de node_modules corrompido)
Remove-Item -Recurse -Force node_modules
npm install

# Subir dev novamente
npm run dev
```

---

### Passo 5 — Confirmar Funcionamento no Browser

Após qualquer alteração, acessar a rota modificada em:

```
http://localhost:3000
```

E verificar:
- Página carrega sem erro 500
- Dados aparecem corretamente
- Ações do formulário funcionam
- Console do browser sem erros críticos

---

### Passo 6 — Commit e Versionamento Automático (Novo)

Se o projeto tiver um repositório remoto configurado (online), **o sistema deve realizar o commit e push automaticamente** assim que a tarefa for concluída e validada.

**Critérios:**
1. Alteração solicitada implementada.
2. Validação técnica (TypeScript, Build) passou.
3. Repositório remoto existe.

**Fluxo Automático:**
```powershell
git add .
git commit -m "tipo: descrição do que foi feito"
git push origin main
```

> **Regra:** Não pergunte "posso commitar?". Se está pronto e validado, commite e suba. Só pergunte se houver dúvida ou risco.

---

## Checklist Rápido Pós-Alteração

```
[ ] TypeScript sem erros (npx tsc --noEmit → exit code 0)
[ ] Servidor dev compilou sem erros (✓ Compiled in Xms)
[ ] Página afetada retorna 200 OK
[ ] Funcionalidade alterada testada manualmente
[ ] Sem erros no console do browser
[ ] Se alterou banco → migration aplicada no Supabase
[ ] Se alterou .env → servidor reiniciado
[ ] Alterações validadas comitadas e enviadas para main (se repo existir)
```

---

## Regras de Ouro

1. **Nunca entregar alterações sem confirmar o hot-reload**: sempre aguardar a mensagem `✓ Compiled` no terminal antes de dizer que está pronto.

2. **Erros de runtime > erros de TypeScript**: um erro 500 em produção é pior que um lint. Prioridade sempre é o servidor rodar.

3. **Limpar `.next/` quando em dúvida**: o cache do Next.js pode manter versões antigas. Em caso de comportamento estranho, limpar e recompilar.

4. **Testar a rota específica**: não basta o servidor subir — testar a URL exata que foi modificada.

5. **Variáveis de ambiente**: qualquer alteração em `.env.local` exige **reinicialização obrigatória** do servidor dev. O Next.js não faz hot-reload de variáveis de ambiente.

6. **Versionamento Contínuo**: Tarefa concluída e validada = código no repositório. O commit deve ser imediato e automático.

---

## Erros Comuns e Soluções

| Erro | Causa Provável | Solução |
|------|---------------|---------|
| `A "use server" file can only export async functions` | Objeto/constante exportado de arquivo com `'use server'` | Mover para `lib/` sem `'use server'` |
| `Cannot read properties of undefined` | Server Action retornou `undefined` ao invés de objeto | Verificar `return` na action |
| `Hydration failed` | Diferença entre render servidor/cliente | Verificar uso de `Date.now()`, `Math.random()` no render |
| Build passa mas dev falha | Cache corrompido | Deletar `.next/` e reiniciar |
| Página 500 sem mensagem | Erro em Server Component | Verificar logs do terminal do `npm run dev` |
| Variável de ambiente `undefined` | `.env.local` alterado sem reiniciar | Reiniciar `npm run dev` |

---

## Stack do Projeto

Este skill é calibrado para o projeto **NF-e Ágil** com:

- **Next.js 16** com App Router e Turbopack
- **TypeScript** (strict mode)
- **Supabase** (Auth + PostgreSQL + Storage)
- **shadcn/ui** + Tailwind CSS
- **Ambiente**: Windows + PowerShell
