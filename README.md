# AuraFarming

Plataforma web competitiva de partidas 1x1 por câmera: uma IA analisa
postura, contato visual, expressão, presença e movimento durante a partida,
gera um **Aura Score** e atualiza um ranking global.

## Stack

| Camada | Tecnologia |
|---|---|
| Frontend | Next.js 15 (App Router), TypeScript, Tailwind, shadcn/ui |
| Backend | NestJS, PostgreSQL (Prisma), Redis, Socket.IO |
| Vídeo | LiveKit (WebRTC) |
| IA / CV | Python, FastAPI, MediaPipe, OpenCV, PyTorch |
| Monorepo | Turborepo + pnpm workspaces |
| Infra | Vercel (web), Railway (api/ai), Cloudflare, Postgres/Redis gerenciados |

## Estrutura do monorepo

```
apps/
  web/          # placeholder de workspace — app Next.js real entra no Prompt 8
  api/          # NestJS — GET /health, Prisma (Postgres) via PrismaModule
services/
  ai/           # placeholder — app FastAPI real entra em prompt futuro
packages/
  shared/       # contratos Zod (DTOs, enums, eventos WebSocket) — fonte única de verdade
  config/       # tsconfig / eslint / prettier compartilhados
```

## Pré-requisitos

- Node 22.x (ver `.nvmrc`)
- pnpm 10.x via [Corepack](https://pnpm.io/installation#using-corepack)
- Python 3.12 para `services/ai` (quando o app real existir)

## Começando

```bash
pnpm install
pnpm dev      # sobe os apps em modo dev
pnpm build    # build de todo o monorepo (via Turborepo)
pnpm lint     # lint de todo o monorepo
pnpm test     # testes de todo o monorepo
```

## Banco de dados (Postgres + Redis)

```bash
cp .env.example .env               # ajuste se necessário — DATABASE_URL já
                                    # bate com as credenciais do compose abaixo
docker compose up -d               # sobe Postgres 16 + Redis 7 locais
pnpm --filter api prisma migrate dev   # aplica as migrations (cria o schema)
pnpm --filter api prisma db seed       # popula alguns usuários + 1 partida de exemplo
```

`schema.prisma` (`apps/api/prisma/schema.prisma`) é o espelho persistente dos
DTOs/enums de `packages/shared` — nenhum enum de domínio é redefinido fora de
`shared`. Exclusão de conta é sempre anonimização (`User.anonymizedAt`), nunca
hard-delete — histórico de partidas (`Match`/`MatchParticipant`/`MatchResult`)
não pode ser apagado via cascade.

## Variáveis de ambiente

Ver `.env.example` — o arquivo `.env` fica na raiz do monorepo mesmo para
variáveis usadas só por `apps/api` (Prisma/NestJS carregam explicitamente a
partir da raiz). Nenhum segredo é commitado; o humano injeta os valores
reais via `.env` local ou variáveis de ambiente do provedor de infra.

## Convenções

Este repositório segue as regras descritas em [`CLAUDE.md`](./CLAUDE.md):
contract-first via `packages/shared`, um prompt por PR, TypeScript estrito,
Aura Score como função pura e versionada, e commits/PRs em português.
