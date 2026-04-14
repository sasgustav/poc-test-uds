# syntax=docker/dockerfile:1.7

# ----- Stage 1: builder -----
FROM node:20-alpine AS builder
WORKDIR /app

# Install deps primeiro (melhor cache layer)
COPY package.json package-lock.json* ./
RUN npm ci --ignore-scripts

COPY tsconfig*.json nest-cli.json ./
COPY src ./src
RUN npm run build

# Prune devDeps para copiar só runtime
RUN npm prune --omit=dev

# ----- Stage 2: runtime -----
FROM node:20-alpine AS runtime
WORKDIR /app

RUN apk add --no-cache dumb-init tini tzdata \
  && adduser -D -u 10001 -s /sbin/nologin app

ENV NODE_ENV=production \
    PORT=3000 \
    TZ=America/Sao_Paulo

COPY --from=builder --chown=app:app /app/node_modules ./node_modules
COPY --from=builder --chown=app:app /app/dist ./dist
COPY --from=builder --chown=app:app /app/package.json ./package.json

USER app
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=3s --start-period=15s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/health/liveness || exit 1

ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "dist/main.js"]
