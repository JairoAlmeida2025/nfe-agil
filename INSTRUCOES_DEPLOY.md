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
   - **Environment Variables**: EXPANDA esta seção. Você precisa copiar as variáveis do seu arquivo `.env.local` (ou `.env`) para cá.
     - `NEXT_PUBLIC_SUPABASE_URL`: (Sua URL do Supabase)
     - `NEXT_PUBLIC_SUPABASE_ANON_KEY`: (Sua chave Anon)
     - `SUPABASE_SERVICE_ROLE_KEY`: (Sua chave Service Role)
     - `CERTIFICATE_ENCRYPTION_KEY`: (A chave hexadecimal que está no seu .env)
     - `NEXT_PUBLIC_APP_URL`: **IMPORTANTE!** Coloque a URL que a Vercel gerar (ex: `https://nfe-agil.vercel.app`) ou deixe vazio por enquanto e preencha depois do deploy.
5. Clique em **Deploy**.

---

## 3️⃣ Supabase (Configuração de URL e Auth)

Para que o login, cadastro e *Esqueci a Senha* funcionem em produção, você precisa autorizar a URL da Vercel.

1. Vá no [Painel do Supabase](https://supabase.com/dashboard).
2. Selecione seu projeto.
3. Vá em **Authentication > URL Configuration**.
4. Em **Site URL**, coloque a URL oficial da sua aplicação (ex: `https://nfe-agil.vercel.app`).
5. Em **Redirect URLs**, adicione:
   - `https://nfe-agil.vercel.app/**` (com os dois asteriscos no final para aceitar qualquer subcaminho).
   - `http://localhost:3000/**` (para continuar funcionando localmente).
6. Salve.

### Testando "Esqueci a Senha"
1. Vá em **Authentication > Providers > Email**.
2. Garanta que **Enable Email Provider** está ativo.
3. (Opcional) Edite o template de "Reset Password" para personalizar o e-mail.

---

## ✅ Pronto!
Agora você pode acessar `https://nfe-agil.vercel.app`, criar contas, recuperar senhas e fazer upload de certificados. Tudo estará conectado ao seu banco de produção.
