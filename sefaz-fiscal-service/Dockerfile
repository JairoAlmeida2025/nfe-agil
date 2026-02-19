# ─── Build Stage ───────────────────────────────────────────────────────────────
FROM node:18-alpine AS builder

WORKDIR /app

# Copiar apenas dependências primeiro (cache de layer Docker)
COPY package.json package-lock.json* ./
RUN npm install

# Copiar código-fonte e compilar TypeScript
COPY tsconfig.json ./
COPY src/ ./src/
RUN npm run build

# ─── Production Stage ──────────────────────────────────────────────────────────
FROM node:18-alpine AS production

WORKDIR /app

# Segurança: rodar como non-root
RUN addgroup -g 1001 -S appgroup && \
    adduser -S appuser -u 1001 -G appgroup

# Copiar apenas dependências de produção
COPY package.json package-lock.json* ./
RUN npm install --omit=dev && npm cache clean --force

# Copiar código compilado do stage builder
COPY --from=builder /app/dist ./dist

# Criar diretório para certificados (montado via volume)
RUN mkdir -p /app/certs && chown appuser:appgroup /app/certs

# Trocar para usuário non-root
USER appuser

# Porta padrão (sobreescrita por env PORT no EasyPanel)
EXPOSE 80

# Health check nativo do Docker
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:80/health || exit 1

# Iniciar micro-serviço
CMD ["node", "dist/index.js"]
