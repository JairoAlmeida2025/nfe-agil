# NF-e Ágil - Task List (atualizado 19/02/2026)

## ✅ Concluído

- [x] Design & Architecture (Next.js 16 + TypeScript + Tailwind + shadcn/ui)
- [x] Autenticação: login, cadastro, confirmação por e-mail, middleware, logout
- [x] Perfil: avatar upload, edição de nome, dropdown no header
- [x] Multi-tenancy banco: profiles, user_id em empresas/certificados/nfes, RLS owner-only
- [x] Certificado A1: upload, validação, criptografia, exibição, revogação
- [x] Empresa & CNPJ: auto-criação, edição, ambiente SEFAZ, UF
- [x] NF-es: tabela com filtros de período/emitente/status, mês vigente por padrão
- [x] SEFAZ: botão "Importar da SEFAZ", envelope SOAP DistribuiçãoDFe, mTLS, parse docZip, NSU incremental, upsert sem duplicatas
- [x] Filtros user_id nas Server Actions (multi-tenancy runtime):
    - [x] getActiveCertificate() — filtrar por usuário logado
    - [x] buildSefazAgent() — usar certificado do usuário logado
    - [x] getEmpresaAtiva() — filtrar por usuário logado
    - [x] uploadCertificate() — vincular user_id ao inserir
    - [x] saveEmpresa() — vincular user_id ao inserir
- [x] Sidebar — Corrigir link NF-es Recebidas (/dashboard → /dashboard/nfe)
- [x] Página /dashboard/nfe criada
- [x] Cards de métricas com dados reais (hoje, pendentes, total mês, status integração)
- [x] Documentação técnica completa (docs/PROJETO.md)
- [x] Banco: constraint UNIQUE em nfe_sync_state(user_id, empresa_cnpj)
- [x] Banco: trigger handle_new_user para auto-criar profile no cadastro
- [x] Banco: coluna role em profiles (admin | user), primeiro usuário = admin
- [x] Sistema de roles e permissões (actions/usuarios.ts):
    - [x] Admin: upload/revogação de certificado, edição de empresa, gerência de usuários
    - [x] User: visualizar, baixar, importar NF-es
- [x] Gerenciamento de equipe na tela de Perfil (somente admin):
    - [x] Criar usuário com nome + e-mail + senha + role (acesso imediato, sem confirmação de e-mail)
    - [x] Listar membros com last_sign_in
    - [x] Promover/rebaixar role (admin ↔ user)
    - [x] Remover membro com confirmação
- [x] Guards de permissão nas actions críticas:
    - [x] uploadCertificate() — somente admin
    - [x] revokeCertificate() — somente admin
    - [x] saveEmpresa() — somente admin
- [x] Gerenciamento de Notas: Download de XML, Visualização de DANFE (v4 MeuDanfe)
- [x] Refatoração: Filtros Backend-Driven (Período, Status, XML) + URL as Source of Truth

## 🟡 MVP Incompleto

- [ ] Sincronização automática diária (Edge Function Supabase cron)
- [ ] Tela de Detalhe da NF-e (/dashboard/nfe/[chave])
- [ ] Consulta por Chave de Acesso (/dashboard/consulta-chave)
- [ ] Tela de Monitoramento DFe (histórico, status integração, última sync)
- [ ] Registro de Atividades (auditoria de downloads/visualizações, /dashboard/atividades)

## 🟢 Pós-MVP

- [ ] Manifestação eletrônica (ciência da operação, confirmação, desconhecimento)
- [ ] Multi-CNPJ por usuário
- [ ] Alertas de vencimento de certificado por e-mail
- [ ] Exportação XLSX
- [ ] Dashboard analítico com gráficos
- [ ] Paginação e filtro por valor na tabela de NF-es
- [ ] Dark mode toggle
- [ ] Perfil de usuário por tipo de acesso (Ex: Analista Fiscal, Financeiro, Administrativo)
