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
  api/          # NestJS — skeleton com GET /health
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

> `docker compose up` e `pnpm --filter api prisma migrate dev` são os
> comandos previstos no `CLAUDE.md`, mas `docker-compose.yml` e
> `prisma/schema.prisma` ainda não existem neste estado do repo — chegam em
> um prompt posterior.

## Variáveis de ambiente

Ver `.env.example`. Nenhum segredo é commitado; o humano injeta os valores
reais via `.env` local ou variáveis de ambiente do provedor de infra.

## Convenções

Este repositório segue as regras descritas em [`CLAUDE.md`](./CLAUDE.md):
contract-first via `packages/shared`, um prompt por PR, TypeScript estrito,
Aura Score como função pura e versionada, e commits/PRs em português.
