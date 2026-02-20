# 🔐 Auditoria de Segurança – NF-e Ágil
### Metodologia: OWASP Top 10:2025 | Zero Trust | Defense in Depth
> **Data:** 19/02/2026 | **Auditor:** Security Auditor Skill | **Versão do Sistema:** v3.3

---

## Superfície de Ataque Mapeada

```
Browser (React Client)
    │
    ▼
Next.js Server (Vercel) — Server Actions, Middleware
    │
    ├── Supabase (PostgreSQL + Storage) — RLS + service_role
    │
    └── Micro-serviço Fiscal (Fastify/Node.js) — EasyPanel/VPS
              │
              └── SEFAZ (SOAP mTLS) — Ambiente Nacional

Ativos de alto valor:
  ├── Certificado Digital A1 (.pfx) — chave privada do CNPJ
  ├── Senha do certificado (AES-256-GCM cifrada)
  ├── XMLs de NF-es (dados fiscais sigilosos)
  ├── Credenciais Supabase (service_role)
  └── FISCAL_SECRET (token de autenticação inter-serviços)
```

---

## Resumo Executivo

| Severidade | Qtd | Status |
|---|---|---|
| 🔴 **Crítico** | 3 | Requer ação imediata |
| 🟠 **Alto** | 3 | Requer ação no próximo sprint |
| 🟡 **Médio** | 4 | Agendar correção |
| 🔵 **Baixo / Informacional** | 4 | Boas práticas |

---

## Findings Detalhados

---

### 🔴 CRÍTICO-1 — Ausência de `user_id` nas novas actions de gestão (IDOR)
**OWASP:** A01 – Broken Access Control  
**Arquivo:** `actions/nfe-management.ts`  
**CVSS Estimado:** 9.1 (AV:N/AC:L/PR:L/UI:N/S:U/C:H/I:H/A:N)

**Descrição:**  
As funções `updateNFeSituacao`, `deleteNFe` e `getNFeXmlContent` operam apenas com o `id` da NF-e, sem verificar se a nota pertence ao usuário autenticado. Qualquer usuário logado pode adivinhar ou enumerar UUIDs e:
- **Alterar** a situação de uma nota de outro usuário.
- **Deletar** qualquer nota do banco.
- **Exfiltrar** o XML completo de qualquer NF-e (dados fiscais sigilosos).

**Vetor de ataque:**
```
POST /server-action updateNFeSituacao
body: { id: "<uuid_de_outro_usuario>", novaSituacao: "recusada" }
→ Action executa sem validar ownership → Sucesso
```

**Remediação:**
```typescript
// actions/nfe-management.ts
export async function updateNFeSituacao(id: string, novaSituacao: 'confirmada' | 'recusada') {
    const supabase = await createClient()
    
    // ✅ ADICIONAR: Verificar que a nota pertence ao usuário logado
    const { data: { user } } = await (await createClient()).auth.getUser()
    if (!user) throw new Error('Não autenticado')

    const { error } = await supabase
        .from('nfes')
        .update({ situacao: novaSituacao })
        .eq('id', id)
        .eq('user_id', user.id) // ← Filtro de ownership obrigatório
    // ...
}
```
O mesmo padrão deve ser aplicado em `deleteNFe` e `getNFeXmlContent`.

---

### 🔴 CRÍTICO-2 — `rejectUnauthorized: false` em conexões TLS (MITM)
**OWASP:** A02 – Security Misconfiguration | A04 – Cryptographic Failures  
**Arquivos:** `actions/certificate.ts:325`, `sefaz-fiscal-service/src/sefaz/client.ts:56`  
**CVSS Estimado:** 8.7 (AV:N/AC:H/PR:N/UI:N/S:U/C:H/I:H/A:N)

**Descrição:**  
Ambos os pontos de comunicação com a SEFAZ (direto via `buildSefazAgent` e via micro-serviço) desabilitam a verificação de certificado TLS do servidor (`rejectUnauthorized: false`). Isso torna todo o tráfego vulnerável a ataques Man-in-the-Middle: um atacante com posição na rede pode interceptar e modificar envelopes SOAP contendo o certificado PFX completo e os dados fiscais.

**Comentário no código confirma o risco:**
```typescript
// IMPORTANTE: Node.js não tem a cadeia ICP-Brasil por padrão.
// Em produção, isso causa erro de "unable to get local issuer certificate".
// A solução robusta é injetar a CA, mas para funcionar agora usamos false.
rejectUnauthorized: false,  // ← ⚠️ MITM POSSÍVEL
```

**Remediação:**  
Injetar os certificados intermediários da **ICP-Brasil** na cadeia de confiança:
```typescript
import { readFileSync } from 'fs'

const agent = new https.Agent({
    pfx: pfxBuffer,
    passphrase: password,
    // ✅ Certificados raiz ICP-Brasil
    ca: [
        readFileSync('./certs/ICP-Brasil-v5.crt'),
        readFileSync('./certs/AC-SERASA-v5.crt'),
    ],
    rejectUnauthorized: true, // ← Restaurar
    secureOptions: constants.SSL_OP_NO_TLSv1 | constants.SSL_OP_NO_TLSv1_1,
})
```
Certificados ICP-Brasil disponíveis em: https://www.gov.br/iti/pt-br/assuntos/repositorio

---

### 🔴 CRÍTICO-3 — CORS wildcard `*` no micro-serviço (se `ALLOWED_ORIGIN` não definido)
**OWASP:** A02 – Security Misconfiguration  
**Arquivo:** `sefaz-fiscal-service/src/index.ts:16`  
**CVSS Estimado:** 7.5 (AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:N/A:N)

**Descrição:**  
```typescript
const allowedOrigin = process.env.ALLOWED_ORIGIN || '*'
reply.header('Access-Control-Allow-Origin', allowedOrigin)
```
Se `ALLOWED_ORIGIN` não estiver configurada no ambiente de produção, o micro-serviço aceita requisições de qualquer origem. Apesar do `FISCAL_SECRET` mitigar o acesso não autorizado, um CORS aberto expande desnecessariamente a superfície de ataque e pode facilitar ataques cross-origin se houver XSS no frontend.

**Remediação:**
```typescript
// Remover o fallback para '*'
const allowedOrigin = process.env.ALLOWED_ORIGIN
if (!allowedOrigin) {
    throw new Error('ALLOWED_ORIGIN obrigatório em produção')
}
// Validar que a origem da request é permitida
if (req.headers.origin !== allowedOrigin) {
    return reply.code(403).send({ error: 'Origin not allowed' })
}
```
**Configurar na EasyPanel:** `ALLOWED_ORIGIN=https://nfe-agil.vercel.app`

---

### 🟠 ALTO-1 — Passphrase do certificado logada em texto plano (Information Disclosure)
**OWASP:** A09 – Logging & Alerting Failures  
**Arquivo:** `sefaz-fiscal-service/src/routes/distdfe.ts:29`

**Descrição:**  
```typescript
console.log(`[PFX] Passphrase length: ${passphrase?.length}`)
console.log(`[PFX] Passphrase tipo: ${typeof passphrase}`)
```
Embora não logue o valor em si, há um comentário crítico:
```typescript
// console.log(`[Auth] Secret esperado (FULL): "${secret}"`) // Uncomment if desperate
```
Este log comentado, se ativado acidentalmente, exporia o `FISCAL_SECRET` nos logs. Mesmo o log parcial (`secret.substring(0, 5)`) em `index.ts:36` é uma prática de risco. Mais grave: o XML bruto da SEFAZ (2000 chars) é logado contendo dados fiscais PII.

**Remediação:**
- Remover permanentemente os logs comentados com valores sensíveis.
- Substituir logging de XML por hash/contagem: `console.log('[XML] Hash:', sha256(xmlResponse).substring(0, 8))`.
- Configurar log level `info` em produção — nunca `debug` com raw payload.

---

### 🟠 ALTO-2 — `buildSefazAgent` sem `userId` pode retornar certificado de qualquer usuário
**OWASP:** A01 – Broken Access Control  
**Arquivo:** `actions/certificate.ts:285-298`

**Descrição:**  
```typescript
export async function buildSefazAgent(userId?: string): Promise<https.Agent> {
    // ...
    if (resolvedUserId) {
        query = query.eq('user_id', resolvedUserId)
    }
    // Se resolvedUserId for null: busca qualquer certificado ativo!
```
Se `getOwnerUserId()` retornar `null` (sessão expirada ou bug), a query retorna o primeiro certificado ativo do banco — possivelmente de outro usuário. O mesmo problema ocorre em `getCertificateCredentials`.

**Remediação:**
```typescript
const resolvedUserId = userId ?? await getOwnerUserId()
if (!resolvedUserId) throw new Error('Usuário não autenticado. Não é possível obter certificado.')
// Nunca executar query sem o filtro user_id
query = query.eq('user_id', resolvedUserId)
```

---

### 🟠 ALTO-3 — Ausência de Rate Limiting no Frontend (Sync SEFAZ)
**OWASP:** A10 – Exceptional Conditions  
**Arquivo:** `actions/nfe.ts`

**Descrição:**  
O botão "Importar da SEFAZ" chama `syncNFesFromSEFAZ()` sem rate limiting no lado do Next.js. O lock via `nfe_job_logs` (5 minutos) é uma mitigação parcial, mas:
1. Não protege contra chamadas paralelas de múltiplos usuários/instâncias.
2. Um usuário mal-intencionado pode triggerar o bloqueio 656 deliberadamente e afetar o serviço da empresa.

**Remediação:**
- Implementar rate limit por `user_id` com Redis/Upstash (ex: max 1 sync a cada 10 minutos por empresa).
- Guardar timestamp da última sync em `config_fiscal` e rejeitar no action se `< 10 min`.

---

### 🟡 MÉDIO-1 — Avatares em bucket público (Information Disclosure)
**OWASP:** A01 – Broken Access Control  
**Arquivo:** `actions/auth.ts:175-178`

**Descrição:**  
```typescript
const { data: { publicUrl } } = supabaseAdmin.storage
    .from('avatars')
    .getPublicUrl(path)
```
O bucket `avatars` é público. A URL é previsível: `<supabase_url>/storage/v1/object/public/avatars/<user_id>/avatar.jpg`. Um atacante com o UUID de um usuário pode acessar seu avatar. Para um sistema interno com dados fiscais, isso viola o princípio do least privilege.

**Remediação:** Usar bucket privado com signed URLs de curta duração.

---

### 🟡 MÉDIO-2 — Política de Senha Fraca (min 8 chars, sem complexidade)
**OWASP:** A07 – Authentication Failures  
**Arquivo:** `actions/auth.ts:58-59`

**Descrição:**
```typescript
if (password.length < 8) {
    return { success: false, error: 'A senha deve ter no mínimo 8 caracteres.' }
}
```
Sem exigência de caracteres especiais, números ou maiúsculas. Para um sistema que gerencia certificados digitais e dados fiscais, uma senha `12345678` é aceita.

**Remediação:** Exigir no mínimo: 12 chars, 1 número, 1 especial.

---

### 🟡 MÉDIO-3 — Ausência de Security Headers HTTP no Next.js
**OWASP:** A02 – Security Misconfiguration  
**Arquivo:** `next.config.ts`

**Descrição:**  
Headers de segurança como `Content-Security-Policy`, `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy` e `Permissions-Policy` não foram identificados na configuração.

**Remediação:**
```typescript
// next.config.ts
const securityHeaders = [
  { key: 'X-DNS-Prefetch-Control', value: 'on' },
  { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
  { key: 'Content-Security-Policy', value: "default-src 'self'; script-src 'self' 'unsafe-eval' 'unsafe-inline'; ..." },
]
```

---

### 🟡 MÉDIO-4 — FISCAL_SECRET como string simples (sem rotação ou expiração)
**OWASP:** A04 – Cryptographic Failures  
**Arquivo:** `.env.local`, `sefaz-fiscal-service/src/index.ts`

**Descrição:**  
O `FISCAL_SECRET` (`9a8f12c4-e6b7-4d89-9a2c-123456789abc`) é um UUID4 simples, sem mecanismo de rotação. Se comprometido, o micro-serviço fica vulnerável até rotação manual.

**Remediação:**
- Gerar secret com `crypto.randomBytes(32).toString('hex')` (256 bits de entropia vs 128 do UUID).
- Implementar rotação semestral.
- Considerar JWT com expiração como alternativa.

---

### 🔵 BAIXO-1 — `getSession()` em vez de `getUser()` em alguns pontos
**OWASP:** A07 – Authentication Failures  
**Arquivo:** `actions/auth.ts:120-124`

**Descrição:**  
A função `getSession()` usa `auth.getSession()` que pode retornar sessão cacheada sem revalidação JWT. Em operações sensíveis, deve-se usar `auth.getUser()` que faz round-trip ao servidor Supabase para validar o token.

**Remediação:** Substituir chamadas a `getSession()` em contexts de autorização por `getUser()`.

---

### 🔵 BAIXO-2 — Ausência de auditoria / log de ações sensíveis
**OWASP:** A09 – Logging & Alerting Failures

**Descrição:**  
Ações críticas como `deleteNFe`, `revokeCertificate`, `uploadCertificate` não registram audit log com `userId`, `timestamp` e `resourceId`. Impossibilita rastrear quem deletou o quê.

**Remediação:** Implementar tabela `audit_logs` com triggers ou chamadas explícitas nas actions.

---

### 🔵 BAIXO-3 — Supply Chain: Dependências sem auditoria
**OWASP:** A03 – Software Supply Chain

**Análise:**  
- `package-lock.json` presente ✅ (integridade garantida)
- `node-forge` (version desconhecida): biblioteca não-oficial para PKI — verificar CVEs.
- `xml-crypto` no micro-serviço: assinatura XML — auditar periodicamente.

**Remediação:**
```bash
npm audit --audit-level=high
cd sefaz-fiscal-service && npm audit --audit-level=high
```
Adicionar ao CI/CD pipeline.

---

### 🔵 BAIXO-4 — Micro-serviço rodando como `host: '0.0.0.0'` sem firewall de aplicação
**OWASP:** A02 – Security Misconfiguration  
**Arquivo:** `sefaz-fiscal-service/src/index.ts:70`

**Descrição:**  
O serviço escuta em `0.0.0.0`, exposto diretamente na VPS. Depende da proteção do `FISCAL_SECRET` e do firewall da infraestrutura EasyPanel. Sem WAF ou IP allowlist, qualquer IP na internet pode tentar autenticar.

**Remediação:**
- Configurar `ALLOWED_ORIGIN` e firewall de rede para aceitar apenas IPs do Vercel.
- Ou usar tunnel privado (Cloudflare Tunnel/Tailscale) para comunicação interna.

---

## Plano de Remediação Priorizado

```
SPRINT IMEDIATO (< 48h):
  [CRÍTICO-1] Adicionar .eq('user_id', user.id) em nfe-management.ts
  [CRÍTICO-3] Configurar ALLOWED_ORIGIN na EasyPanel e remover fallback '*'
  [ALTO-2]    Falhar explicitamente se resolvedUserId for null

PRÓXIMO SPRINT (< 2 semanas):
  [CRÍTICO-2] Injetar cadeia ICP-Brasil (rejectUnauthorized: true)
  [ALTO-1]    Remover logs com dados sensíveis do micro-serviço
  [ALTO-3]    Rate limit na sync por empresa/user

BACKLOG TÉCNICO:
  [MÉDIO-1]   Bucket avatars → privado + signed URLs
  [MÉDIO-2]   Política de senha mais forte
  [MÉDIO-3]   Security headers no next.config.ts
  [MÉDIO-4]   Rotação do FISCAL_SECRET

BOAS PRÁTICAS:
  [BAIXO-1]   getUser() em vez de getSession() onde relevante
  [BAIXO-2]   Tabela de audit logs
  [BAIXO-3]   npm audit no CI/CD
  [BAIXO-4]   IP allowlist para o micro-serviço
```

---

## O que está BEM implementado ✅

| Controle | Avaliação |
|---|---|
| AES-256-GCM para senha do certificado | ✅ Excelente — IV único por operação, auth tag validado |
| Supabase Auth com cookies HTTP-only | ✅ Correto — middleware valida em cada request |
| `service_role` apenas server-side | ✅ Correto — nunca exposto ao browser |
| `'use server'` em todas as actions | ✅ Garante execução server-side |
| Verificação de sessão com `getUser()` (na maioria) | ✅ Round-trip real ao Supabase |
| Admin permission check no upload de certificado | ✅ Role-based gate implementado |
| Proteção contra Consumo Indevido (cStat 656) | ✅ Retorna 429 e não reseta NSU |
| Job lock anti-duplicata na sync | ✅ `nfe_job_logs` com janela de 5min |
| Certificado PFX em Storage privado | ✅ Sem URL pública |
| FISCAL_SECRET para autenticar micro-serviço | ✅ Present e verificado |
| Input validation no upload (.pfx/.p12) | ✅ Extensão + parse + senha verificados |

---

*Relatório gerado em 19/02/2026. Revisar a cada sprint ou após mudanças arquiteturais significativas.*
