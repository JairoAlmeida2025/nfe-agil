# ─── Build Stage ───────────────────────────────────────────────────────────────
FROM node:18-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm install

COPY tsconfig.json ./
COPY src/ ./src/
RUN npm run build

# ─── Production Stage ──────────────────────────────────────────────────────────
FROM node:18-alpine AS production

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm install --omit=dev && npm cache clean --force

COPY --from=builder /app/dist ./dist

RUN mkdir -p /app/certs

EXPOSE 80

CMD ["node", "dist/index.js"]
