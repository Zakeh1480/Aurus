# AuraFarming — Contexto do Repositório

Este arquivo é lido pelo Claude Code em toda sessão. Siga estas regras à risca.

## O que é

Plataforma web competitiva: partidas 1x1 com câmera, IA analisa postura/contato visual/expressão/presença/movimento, gera um **Aura Score**, atualiza ranking global. Monetização em fase posterior.

## Este é um MONOREPO único

Nunca sugira separar em múltiplos repositórios. Estrutura alvo:

```
apps/
  web/          # Next.js 15 (App Router) — frontend
  api/          # NestJS — backend
services/
  ai/           # Python + FastAPI — scoring/verificação (não roda no Node)
packages/
  shared/       # Contratos Zod — FONTE ÚNICA DE VERDADE
  config/        # eslint / tsconfig / prettier compartilhados
```

Se o repo hoje tem um projeto Next na raiz, mova-o para `apps/web` durante o Prompt 0.

## Stack fixa (não troque sem me perguntar)

- Front: Next.js 15 App Router, TypeScript, Tailwind, shadcn/ui
- Back: NestJS, PostgreSQL (Prisma), Redis, Socket.IO
- Vídeo: LiveKit (WebRTC) — LiveKit Cloud no MVP
- IA/CV: Python, FastAPI, MediaPipe, OpenCV, PyTorch
  - Estado atual: `services/ai` implementa scoring/verificação com OpenCV + NumPy (heurísticas clássicas); MediaPipe roda só no cliente via WASM (regra de ouro #5); PyTorch ainda não implementado (reservado para IA treinada com dados próprios — Fase 2/3, fora de escopo).
- Monorepo: Turborepo + pnpm workspaces
- Infra: Vercel (web), Railway (api/ai), Cloudflare, Postgres/Redis gerenciados

## Regras de ouro (inegociáveis)

1. **Contract-first.** Todo DTO, enum e evento WebSocket vive em `packages/shared` como schema **Zod** (schema → tipo inferido). Back e front importam de `shared`. **NUNCA** crie um tipo que já existe (ou deveria existir) em `shared` — coloque em `shared` e importe.
2. **Um prompt = um PR.** Não misture escopos. Cada tarefa entrega: código + testes + critérios de aceite atendidos.
3. **TypeScript estrito.** `strict: true`, `noUncheckedIndexedAccess`. Sem `any` sem justificativa.
4. **Aura Score é função pura e versionada.** `score = f(features, AURA_SCORE_VERSION)`. Determinístico, sem estado, auditável. A versão é carimbada em todo resultado persistido.
5. **Landmarks são extraídos NO CLIENTE** (MediaPipe WASM no browser). O backend/serviço de IA recebe **vetores de features**, nunca o vídeo cru. Isso é decisão de custo + LGPD.
6. **Anti-cheat (Prompt 6b)** valida features por amostragem server-side; resultado com trust score baixo é descartado antes de tocar rating/ranking.
7. **Segredos nunca no cliente nem commitados.** Use `.env` (com `.env.example` versionado). LiveKit/DB/Cloudflare/pagamento são injetados pelo humano.

## Convenções

- Validação de payload (REST e WS) via Zod em toda borda.
- Commits e PRs em português, descritivos, referenciando o número do prompt.
- Testes obrigatórios em lógica de negócio (auth, matchmaking, scoring, anti-cheat).
- Ao terminar um prompt, gere um resumo curto do que mudou e o que o próximo prompt vai precisar.

## Comandos

- `pnpm dev` — sobe apps em dev
- `pnpm build` / `pnpm lint` / `pnpm test`
- `docker compose up` — Postgres + Redis + api + ai local
- `pnpm --filter api prisma migrate dev` — migrations

## Fora de escopo por enquanto

Fases 2/3 (loja, moedas, torneios, clãs, replay, mobile, IA treinada com dados próprios) só depois do MVP fechado. Não antecipe.

## Trilha humana (não é tarefa de código)

Fairness do score, política de moderação, sign-off de LGPD, precificação e ops de produção são decisões do humano. Se um prompt esbarrar nisso, pare e pergunte.

## Estado atual do projeto

MVP funcionalmente completo, construído em 17 iterações disciplinadas ("um prompt = um PR"). HEAD atual é pós-Prompt 16 (auditoria de segurança + correções).

- Prompt 0 — bootstrap do monorepo + contratos Zod (`packages/shared`)
- Prompt 1 — schema Prisma + docker-compose local
- Prompt 2 — autenticação (JWT + refresh rotativo)
- Prompt 3 — perfil + LGPD (Users/Consent)
- Prompt 4 — matchmaking + gateway WebSocket
- Prompt 5 — integração LiveKit (tokens + webhook)
- Prompt 6 — serviço de IA (FastAPI) — scoring
- Prompt 6b — verificação server-side + anti-cheat
- Prompt 7 — pipeline de score em tempo real + ranking (Elo)
- Prompt 8 — scaffold do frontend + design system
- Prompt 9 — frontend de auth + perfil + consentimento
- Prompt 10 — fila de matchmaking em `apps/web`
- Prompt 11 — sala de batalha (LiveKit + MediaPipe client + anti-cheat)
- Prompt 12 — ranking global (leaderboard) em `apps/web`
- Prompt 13 — hardening: segurança, LGPD, moderação
- Prompt 14 — containers, CI (GitLab) e preparação de deploy
- Prompt 15 — duração fixa de partida (60s), encerramento forçado server-side
- Prompt 16 — auditoria de segurança completa + correções (trust proxy, secrets fail-closed, JWT algorithm pin, normalização de e-mail, limites de payload em `services/ai`, autenticação WS centralizada no adapter, CI) ← estado atual

## Arquitetura implementada

**apps/web** — App Router com route group `(protected)` (guard client-side via `RequireAuth`; **sem `middleware.ts`** de propósito, porque o refresh token vive num cookie httpOnly no domínio da API, não do Next). Auth: access token em memória, refresh em cookie httpOnly com renovação proativa e deduplicação de chamadas concorrentes. Extração MediaPipe roda em Web Worker (`workers/aura-features.worker.ts`) com fallback para main thread, cadência de 1 amostra/segundo. `ws-client` valida todo payload de entrada/saída contra `WsEventSchemas` de `packages/shared`. Testes só com Vitest (lib-level) — sem Playwright/Cypress, sem E2E.

**apps/api** — Módulos NestJS: `auth`, `users`, `consent`, `matchmaking`, `livekit`, `anti-cheat`, `scoring`, `ranking`, `moderation`, `prisma`, `redis`. Três WS Gateways coexistem no mesmo `Server` (`MatchmakingGateway`, `MatchScoringGateway`, `AntiCheatGateway`); a autenticação do handshake (JWT verificado + reconsulta ao Postgres) é registrada uma única vez em `MatchmakingIoAdapter.createIOServer` (não mais em `MatchmakingGateway.afterInit`, Prompt 16) — garantia estrutural do bootstrap, não efeito colateral de qual gateway instancia primeiro; nenhum handler confia em `payload.userId`. `app.set("trust proxy", 1)` em `main.ts` (Prompt 16) — necessário atrás do proxy da Railway/Cloudflare pro rate-limit por IP (`ThrottlerGuard`) funcionar de verdade. Redis é usado para rate limit/nonces/buffers de score, **não** como adapter de Socket.IO — por isso a API está limitada a **1 réplica** (sem scaling horizontal) até isso ser endereçado. Segredo compartilhado `AI_SERVICE_SHARED_SECRET` (header `X-AI-Service-Secret`) protege toda chamada `apps/api → services/ai`; junto com `JWT_SECRET` e `REDIS_URL`, todos falham fechado (lançam) se a env var não estiver definida — nenhum cai silenciosamente num default (Prompt 16). Algoritmo do JWT fixado explicitamente (`JWT_ALGORITHM = "HS256"`, `auth.constants.ts`) em todo ponto de verificação. E-mail é normalizado pra lowercase na fronteira do Zod (`UserSchema.email`, `packages/shared`) — comparações (login, bootstrap de moderador) não são mais case-sensitive. Prisma é a fonte de verdade durável (`RankingSnapshot`, `Report`/`Ban` append-only, `anonymizedAt` em vez de hard-delete de usuário). Partida tem duração fixa (`MATCH_DURATION_SECONDS`, `packages/shared`, Prompt 15): `MatchDurationSchedulerService` (`livekit/`) agenda, a partir de `Match.startedAt`, o encerramento forçado (`ScoringService.finalizeMatch` + `LivekitService.deleteRoom`) mesmo com os dois participantes ainda conectados; `LivekitWebhookController` cancela esse timer quando a partida já termina pelo caminho normal (`participant_left`). 41 arquivos de spec (Vitest).

**services/ai** — FastAPI puro, sem MediaPipe/PyTorch (ver nota em "Stack fixa"). Endpoints: `GET /health`, `POST /score`, `POST /score/aggregate`, `POST /verify`. Scoring é função pura e versionada (`AURA_SCORE_VERSION = "aura-score-v1"`), soma ponderada de 5 métricas; agregação multi-amostra por **mediana por métrica** (robusta a outliers), teto de `SCORE_AGGREGATE_MAX_SAMPLES` amostras por chamada (Prompt 16). `/verify` (Prompt 6b) usa heurísticas clássicas de CV (Haar cascade + variância de Laplaciano) sobre um único keyframe, cobrindo só `presence`/`eyeContact`; a comparação temporal entre keyframes (detecção de replay) fica em `apps/api/src/anti-cheat`, não aqui. Keyframe decodificado tem teto de `VERIFY_MAX_IMAGE_MEGAPIXELS` (Prompt 16, guarda contra decompression-bomb — `ANTI_CHEAT_MAX_KEYFRAME_BASE64_LENGTH` só limita o tamanho comprimido). `BodySizeLimitMiddleware` rejeita (413) requisições acima de `MAX_REQUEST_BODY_BYTES` pelo header `Content-Length` (Prompt 16). Sem CORS (server-to-server only). Contrato documentado em `services/ai/CONTRACT.md`. Testes com pytest (6 arquivos, incluindo guard-test de sincronia de constantes com o TS).

**packages/shared** — organizado em `dtos/` (19 arquivos), `enums/` (10 arquivos), `events/` (`event-map.ts` com `WsEventSchemas`, mapa único evento→schema, 11 eventos WS no total), mais `constants.ts` e `match-signing.ts` (strings canônicas para HMAC). Testes extensos (1541 linhas, incluindo `dtos.test.ts` com 1172 linhas) — contract-first levado a sério.

**packages/config** — `eslint.config.base.mjs`, `tsconfig.base.json` (`strict: true`, `noUncheckedIndexedAccess: true`), `prettier.config.mjs`, consumidos via `exports` do `package.json` por `apps/api`, `apps/web` e `packages/shared`.

## Infraestrutura e deploy

- `docker-compose.yml` sobe `postgres`, `redis`, `api`, `ai-service` — **`apps/web` não é containerizado**, roda via Vercel/`pnpm dev` nativamente.
- Dockerfiles multi-stage para `apps/api` (usa `turbo prune` para podar o monorepo) e single-stage para `services/ai`.
- CI é 100% GitLab (`.gitlab-ci.yml`): stages `test` (lint, typecheck, test, ai-service, sast) e `build` (build, docker-build) — **sem job de deploy**; deploy é via integração nativa Railway/Vercel configurada manualmente.
- Deploy: Railway para `apps/api` e `services/ai` (via `railway.json`, builder Dockerfile, `preDeployCommand: prisma migrate deploy` no api), Vercel para `apps/web` (zero-config, root directory `apps/web`), Cloudflare para DNS.
- `.env` real vive na **raiz do monorepo** (fonte única para dev local); cada app/service tem um `.env.example` espelhando o subconjunto relevante para configurar os dashboards de deploy.

## Testes

| Pacote            | Framework | Comando                              | Cobertura                                |
| ----------------- | --------- | ------------------------------------ | ---------------------------------------- |
| `apps/web`        | Vitest    | `pnpm --filter web test`             | 12 arquivos, lib-level (sem E2E/browser) |
| `apps/api`        | Vitest    | `pnpm --filter api test`             | 41 arquivos de spec                      |
| `services/ai`     | pytest    | `cd services/ai && uv run pytest -v` | 6 arquivos                               |
| `packages/shared` | Vitest    | `pnpm --filter shared test`          | contratos exaustivamente testados        |

**Não há testes E2E/integração cross-serviço** (nem Playwright/Cypress no front, nem smoke test funcional das imagens Docker no CI) — gap conhecido, não silencioso.

## Lacunas e pontos de atenção conhecidos

Já documentadas em `docs/security-checklist.md` ou no próprio código — não são achados de bug, são trabalho pendente sinalizado:

- Texto de `/termos` é placeholder — conteúdo jurídico real pendente de revisão humana.
- Sem job de deploy automatizado no CI (deploy manual via dashboards Railway/Vercel).
- Segredos de produção (`JWT_SECRET`, `AI_SERVICE_SHARED_SECRET`, `LIVEKIT_*`) ainda são placeholders `change-me`.
- Sem Redis adapter para Socket.IO → API restrita a 1 réplica até isso ser endereçado.
- Rotação de `AI_SERVICE_SHARED_SECRET` não suporta "chave anterior" — troca exige deploy simultâneo dos dois lados.
- Sem testes E2E/integração cross-serviço.
- Rota `apps/web/src/app/_dev/ui` parece página de showcase de componentes — confirmar com o humano se deve ser removida/protegida antes de produção.
- `services/ai/Dockerfile` continua single-stage (`uv`/`pip`/`apt` presentes na imagem final) — auditoria de segurança (Prompt 16) recomendou converter pra multi-stage (mesmo padrão de `apps/api/Dockerfile`), não aplicado ainda por falta de acesso a `docker build` pra validar no ambiente em que a auditoria rodou.
- Container Scanning não está no `.gitlab-ci.yml` (só SAST/Secret Detection/Dependency Scanning, Prompt 16) — as imagens do job `docker-build` não são publicadas em nenhum registry, pré-requisito do template.
- SAST/Secret Detection/Dependency Scanning rodam mas não bloqueiam o pipeline por achado (comportamento padrão do GitLab, só informam a MR) — bloquear exigiria GitLab Ultimate ou script customizado.
