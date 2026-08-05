# syntax=docker/dockerfile:1
# Build a partir da RAIZ do monorepo (apps/api depende de @aurafarming/shared
# via workspace:*):  docker build -f apps/api/Dockerfile -t aurafarming-api .

FROM node:22-bookworm-slim AS base
RUN corepack enable && corepack prepare pnpm@10.32.1 --activate

FROM base AS pruner
WORKDIR /app
COPY . .
RUN pnpm dlx turbo@2.10.7 prune @aurafarming/api --docker

FROM base AS installer
WORKDIR /app
COPY --from=pruner /app/out/json/ .
COPY --from=pruner /app/out/pnpm-lock.yaml ./pnpm-lock.yaml
COPY --from=pruner /app/out/pnpm-workspace.yaml ./pnpm-workspace.yaml
RUN pnpm install --frozen-lockfile

# apps/api/prisma/schema.prisma só existe a partir daqui.
COPY --from=pruner /app/out/full/ .
RUN pnpm --filter @aurafarming/api exec prisma generate --schema=prisma/schema.prisma
RUN pnpm turbo run build --filter=@aurafarming/api --cache-dir=.turbo

# Sem "pnpm prune --prod" aqui de propósito: `pnpm prune` não é
# workspace-aware (não tem modo recursivo) — rodado da raiz do monorepo,
# ele interpreta "prod" a partir do package.json da RAIZ (que não declara
# nenhuma "dependencies") e apaga o node_modules inteiro de apps/api, não só
# as devDependencies. A imagem final carrega devDependencies também — troca
# aceitável de alguns MB por uma imagem que realmente funciona.

FROM node:22-bookworm-slim AS runtime
# openssl: exigido pelo engine do Prisma em runtime (migrate deploy);
# ca-certificates: chamadas HTTPS de saída (LiveKit, AI_SERVICE_URL).
# node:22-bookworm-slim já vem com um usuário não-root "node" (uid 1000) —
# reaproveita em vez de criar outro (useradd --uid 1000 colide com ele).
RUN apt-get update \
    && apt-get install -y --no-install-recommends openssl ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY --from=installer --chown=node:node /app/ .

ENV NODE_ENV=production PORT=3001
USER node
WORKDIR /app/apps/api
EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=5s --retries=5 \
  CMD node -e "require('http').get('http://localhost:'+(process.env.PORT||3001)+'/health',r=>process.exit(r.statusCode===200?0:1)).on('error',()=>process.exit(1))"

CMD ["sh", "-c", "node_modules/.bin/prisma migrate deploy --schema=prisma/schema.prisma && node dist/main.js"]
