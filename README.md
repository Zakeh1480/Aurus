# AuraFarming

[![pipeline status](https://gitlab.com/Zakeh1480/aurus/badges/main/pipeline.svg)](https://gitlab.com/Zakeh1480/aurus/-/commits/main)

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
  web/          # Next.js 15 (App Router) — frontend completo (lobby, batalha, ranking, perfil)
  api/          # NestJS — auth, matchmaking, partidas, scoring/ranking, anti-cheat, moderação
services/
  ai/           # FastAPI — scoring do Aura Score, verificação anti-cheat (/score, /verify)
packages/
  shared/       # contratos Zod (DTOs, enums, eventos WebSocket) — fonte única de verdade
  config/       # tsconfig / eslint / prettier compartilhados
```

## Pré-requisitos

- Node 22.x (ver `.nvmrc`)
- pnpm 10.x via [Corepack](https://pnpm.io/installation#using-corepack)
- Python 3.12 + [uv](https://docs.astral.sh/uv/) para `services/ai`
- Docker + Docker Compose (stack local e paridade com as imagens de deploy)

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

## Docker (stack completa)

`docker compose up` sobe Postgres + Redis + `api` + `ai-service` já
containerizados — as mesmas imagens usadas no deploy (Railway). Útil para
validar o build de produção e as migrations antes de um deploy real; para o
dia a dia de desenvolvimento (hot-reload), continue usando
`docker compose up -d postgres redis` + `pnpm dev` como acima.

```bash
cp .env.example .env   # se ainda não existir
docker compose up --build
curl http://localhost:3001/health
curl http://localhost:8000/health
```

`apps/api` roda `prisma migrate deploy` automaticamente antes de subir (ver
`CMD` em `apps/api/Dockerfile`) — nenhuma migration manual é necessária
nesse fluxo.

## Vídeo (LiveKit)

As partidas usam [LiveKit Cloud](https://livekit.io/) para a chamada de vídeo
1x1. Setup:

1. Crie uma conta no LiveKit Cloud e um projeto; gere uma API key/secret.
2. Preencha no `.env` da raiz: `LIVEKIT_URL` (`wss://<projeto>.livekit.cloud`),
   `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`.
3. No painel do projeto, configure um webhook apontando para
   `POST {API_URL}/livekit/webhook` (em dev local isso exige expor a API
   publicamente, ex. `ngrok http 3001`).

Fluxo: o front autenticado chama `POST /matches/:id/token` (Prompt 11) e
recebe `{ token, url, roomName, identity, expiresAt }` para conectar via
`livekit-client`, com `roomName === matchId`. Quando o LiveKit envia o evento
`participant_left`, o backend encerra a partida (`Match.status = "cancelled"`,
evento WS `match:end` com `reason: "disconnected"`) e fecha a room — o mesmo
caminho que o Prompt 7 (scoring) já trata para partidas canceladas.

## Variáveis de ambiente

Ver `.env.example` — o arquivo `.env` fica na raiz do monorepo mesmo para
variáveis usadas só por `apps/api` (Prisma/NestJS carregam explicitamente a
partir da raiz). Nenhum segredo é commitado; o humano injeta os valores
reais via `.env` local ou variáveis de ambiente do provedor de infra.

Cada serviço também tem um `.env.example` próprio (`apps/web/.env.example`,
`apps/api/.env.example`, `services/ai/.env.example`), espelhando só o
subconjunto de variáveis que aquele serviço lê — útil para configurar as
variáveis de ambiente por serviço nos dashboards da Vercel/Railway. O
`.env.example` da raiz continua sendo a fonte canônica para dev local.

## Deploy

Deploy é **documentado e reproduzível**, mas a criação de contas externas é
tarefa humana (ver checklist no fim desta seção) — nenhum segredo real é
gerado ou commitado por este guia.

### Visão geral

| Serviço | Plataforma | Como |
|---|---|---|
| `apps/web` | Vercel | build nativo Next.js (sem Docker) |
| `apps/api` | Railway | container via `apps/api/Dockerfile` |
| `services/ai` | Railway | container via `services/ai/Dockerfile` |
| Postgres/Redis | Railway (addons gerenciados) | `DATABASE_URL`/`REDIS_URL` injetados |
| DNS/proxy | Cloudflare | na frente de Vercel e do domínio da API |

### 1. Postgres + Redis (Railway)

1. Crie um projeto Railway.
2. "New → Database → PostgreSQL" e "New → Database → Redis" — Railway expõe
   `DATABASE_URL`/`REDIS_URL`, referenciáveis por outros serviços do mesmo
   projeto (ex.: `${{Postgres.DATABASE_URL}}`).

### 2. API (Railway)

1. No mesmo projeto, "New → conecte o GitLab" → repositório
   `Zakeh1480/aurus`.
2. Settings do serviço:
   - **Root Directory**: `/` (raiz do repo — o build depende de
     `packages/shared`, fora de `apps/api`).
   - **Config-as-code Path**: `apps/api/railway.json`.
3. Environment Variables — copie de `apps/api/.env.example`, com:
   - `DATABASE_URL` = `${{Postgres.DATABASE_URL}}`
   - `REDIS_URL` = `${{Redis.REDIS_URL}}`
   - `WEB_ORIGIN` = domínio real de `apps/web` (Vercel)
   - `AI_SERVICE_URL` = URL do serviço `services/ai` (passo 3)
   - `JWT_SECRET`, `AI_SERVICE_SHARED_SECRET`, `LIVEKIT_API_KEY`,
     `LIVEKIT_API_SECRET`: **gerar valores reais**, nunca os defaults de dev
     (ver [`docs/security-checklist.md`](./docs/security-checklist.md)).
4. Deploy — `apps/api/railway.json` já define `preDeployCommand` (roda
   `prisma migrate deploy` antes de cada deploy) e `healthcheckPath: /health`.
5. **Restrição conhecida do MVP**: matchmaking/estado de partida vive em
   memória por instância (sem adapter Redis do Socket.IO) — mantenha este
   serviço em **1 réplica**; não ative scaling horizontal/multi-region.

### 3. AI service (Railway)

1. Mesmo projeto, novo serviço a partir do mesmo repo.
2. **Root Directory**: `services/ai`. **Config-as-code Path**:
   `services/ai/railway.json`.
3. Environment Variables — copie de `services/ai/.env.example`.
   `AI_SERVICE_SHARED_SECRET` **precisa ser idêntico** ao de `apps/api`, no
   MESMO deploy (um lado desatualizado quebra scoring/verify inteiro).
4. Deploy. Healthcheck em `/health` (sem dependência de banco).

### 4. Web (Vercel)

1. "Add New… → Project", importe `Zakeh1480/aurus` do GitLab.
2. **Root Directory**: `apps/web`. A Vercel detecta `pnpm-workspace.yaml` e
   instala a partir da raiz automaticamente — sem `vercel.json`.
3. Build Command/Output: default (framework preset "Next.js").
4. Environment Variables (Production e Preview) — copie de
   `apps/web/.env.example`, apontando para o domínio real da API.
5. Deploy — push em `main` builda/publica; MRs geram preview deployments.

### 5. Cloudflare (DNS/proxy)

1. Domínio apontado na Cloudflare.
2. Registro do front → CNAME para o domínio da Vercel, proxy ativado.
3. Registro da API → CNAME para o domínio público do serviço Railway,
   proxy ativado — validar WebSocket via Cloudflare após o primeiro deploy.
4. Com os domínios finais definidos, volte e atualize `WEB_ORIGIN` (Railway,
   `apps/api`) e `NEXT_PUBLIC_API_URL`/`NEXT_PUBLIC_WS_URL` (Vercel,
   `apps/web`) — nunca deixe `WEB_ORIGIN` como wildcard.

### Checklist antes de ir ao ar (trilha humana, fora do escopo deste PR)

- [ ] Criar as contas Vercel/Railway/Cloudflare e o domínio.
- [ ] Gerar valores reais de `JWT_SECRET`, `AI_SERVICE_SHARED_SECRET`,
      `LIVEKIT_API_KEY`/`LIVEKIT_API_SECRET` (nunca reusar os de dev).
- [ ] Confirmar `AI_SERVICE_SHARED_SECRET` idêntico em `apps/api` e
      `services/ai` no mesmo deploy.
- [ ] Revisar [`docs/security-checklist.md`](./docs/security-checklist.md)
      por completo antes do primeiro deploy público.

## Convenções

Este repositório segue as regras descritas em [`CLAUDE.md`](./CLAUDE.md):
contract-first via `packages/shared`, um prompt por PR, TypeScript estrito,
Aura Score como função pura e versionada, e commits/PRs em português.
