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

MVP funcionalmente completo, construído em 22 iterações disciplinadas ("um prompt = um PR"), seguidas por uma rodada de prompts fechando lacunas que não dependem de decisão/credencial humana. HEAD atual é pós-Prompt 23 (rotação encadeada do segredo compartilhado `apps/api ↔ services/ai`).

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
- Prompt 16 — auditoria de segurança completa + correções (trust proxy, secrets fail-closed, JWT algorithm pin, normalização de e-mail, limites de payload em `services/ai`, autenticação WS centralizada no adapter, CI)
- Prompt 17 — Redis adapter para Socket.IO em `apps/api` (`@socket.io/redis-adapter`), entrega de eventos WS cross-instance-safe via rooms por usuário
- Prompt 18 — rotação de `AI_SERVICE_SHARED_SECRET` com chave anterior: `services/ai` aceita `AI_SERVICE_SHARED_SECRET_PREVIOUS` opcional como fallback, permitindo rollout gradual (deploy de `services/ai` antes de `apps/api`) sem deploy simultâneo dos dois lados
- Prompt 19 — `MatchmakingService.pendingMatches`/`pendingMatchByUser` (estado de pareamento/aceite-com-timeout) migrado de `Map` local para Redis (`PendingMatchService`, novo em `apps/api/src/matchmaking`): o timeout local (`setTimeout`) vira um poller cross-instance que varre um ZSET de expiração compartilhado — pareamento/aceite do matchmaking passa a ser cross-instance-safe de verdade
- Prompt 20 — `MatchDurationSchedulerService` (`livekit/`) migrado de `Map` local para Redis: um ZSET compartilhado (`lk:match-duration:expiry`, score = instante de encerramento forçado) substitui o `setTimeout` por partida; sem script Lua (não há sub-estado mutável por partida, ao contrário do Prompt 19) — `ZADD NX` agenda de forma idempotente e um `ZREM` (atômico por si só) serve tanto de cancelamento quanto de _claim_ do poller cross-instance, cuja réplica vencedora é a única a rodar `finalizeMatch`+`deleteRoom`
- Prompt 21 — `ScoreTickSchedulerService` (`scoring/`) migrado de `Map` local para Redis: um ZSET compartilhado (`score:tick:due`, score = próximo instante do tick) substitui o `setInterval` por partida. Diferente do Prompt 20, o agendamento aqui é recorrente (a entrada nunca é removida de vez, só reagendada), então precisou de um script Lua de compare-and-swap no score (`ZSCORE` + checagem `<= now` + `ZADD` do próximo vencimento, tudo atômico) pra dois pollers não reivindicarem o mesmo ciclo de tick simultaneamente — um `ZREM` isolado (como no Prompt 20) não bastaria aqui
- Prompt 22 — `ChallengeSchedulerService` (`anti-cheat/`) migrado de `Map`/`Set` local para Redis: um HASH por jogador (`ac:match:{matchId}:user:{userId}:challenge-schedule`, campos `targetCount`/`issuedSoFar`/`sessionStartedAt`) + um ZSET compartilhado (`ac:challenge-schedule:due`, score = próximo instante do desafio). Precisou de **dois** scripts Lua — `targetCount`/`issuedSoFar`/`sessionStartedAt` são um sub-estado composto e mutável (ao contrário do Prompt 20, mas no mesmo espírito do Prompt 19): um script cria o HASH+ZSET atomicamente só se ainda não existir (fecha a corrida de `ensureScheduledForMatch` ser chamado para os dois jogadores por réplicas diferentes quase ao mesmo tempo), outro reivindica um ciclo vencido com o mesmo compare-and-swap do Prompt 21 (`ZSCORE` + checagem `<= now`) e já incrementa `issuedSoFar` atomicamente antes de soltar o `ZREM` — reagendar o próximo ciclo (delay aleatório, teto de `maxSessionMs`) fica em JS, fora do script, porque a essa altura só a réplica que reivindicou chega lá (não há mais corrida). Fecha a lacuna dos três schedulers em memória documentada desde o Prompt 17
- Prompt 23 — rotação encadeada de `AI_SERVICE_SHARED_SECRET_PREVIOUS` em `services/ai/app/security.py`: a variável passa a aceitar uma lista separada por vírgula de segredos anteriores (nome inalterado, retrocompatível com um único valor), iterada com `hmac.compare_digest` por candidato — viabiliza trocar o segredo de novo antes de remover o valor anterior da rotação em andamento, sem nunca haver uma janela sem uma chave válida em comum entre `apps/api` e `services/ai` ← estado atual

## Arquitetura implementada

**apps/web** — App Router com route group `(protected)` (guard client-side via `RequireAuth`; **sem `middleware.ts`** de propósito, porque o refresh token vive num cookie httpOnly no domínio da API, não do Next). Auth: access token em memória, refresh em cookie httpOnly com renovação proativa e deduplicação de chamadas concorrentes. Extração MediaPipe roda em Web Worker (`workers/aura-features.worker.ts`) com fallback para main thread, cadência de 1 amostra/segundo. `ws-client` valida todo payload de entrada/saída contra `WsEventSchemas` de `packages/shared`. Testes só com Vitest (lib-level) — sem Playwright/Cypress, sem E2E.

**apps/api** — Módulos NestJS: `auth`, `users`, `consent`, `matchmaking`, `livekit`, `anti-cheat`, `scoring`, `ranking`, `moderation`, `prisma`, `redis`. Três WS Gateways coexistem no mesmo `Server` (`MatchmakingGateway`, `MatchScoringGateway`, `AntiCheatGateway`); a autenticação do handshake (JWT verificado + reconsulta ao Postgres) é registrada uma única vez em `MatchmakingIoAdapter.createIOServer` (não mais em `MatchmakingGateway.afterInit`, Prompt 16) — garantia estrutural do bootstrap, não efeito colateral de qual gateway instancia primeiro; nenhum handler confia em `payload.userId`. `app.set("trust proxy", 1)` em `main.ts` (Prompt 16) — necessário atrás do proxy da Railway/Cloudflare pro rate-limit por IP (`ThrottlerGuard`) funcionar de verdade. `MatchmakingIoAdapter.createIOServer` também registra (Prompt 17) o adapter Redis do Socket.IO (`@socket.io/redis-adapter`, dois clientes ioredis dedicados via `RedisService.duplicate()` — nunca a instância `RedisService` compartilhada, porque o cliente "sub" entra em modo subscriber e não pode rodar mais nenhum outro comando) e injeta o `Server` em `MatchmakingService.setServer()`; `MatchmakingService` emite/desconecta por usuário via `server.to(userRoom(userId))`/`server.in(userRoom(userId)).disconnectSockets()` (cada socket entra na sua room no handshake) em vez de guardar `Socket` em memória — isso já alcança um usuário conectado em **qualquer réplica** da API. O estado de pareamento pendente/aceite-com-timeout (Prompt 19) mora em Redis via `PendingMatchService` (`matchmaking/pending-match.service.ts`): um HASH `mm:pending:{matchId}` (player1Id/player2Id/flags de aceite) + ponteiros reversos `mm:user:{userId}:pending` + um ZSET compartilhado `mm:pending:expiry` (score = instante de expiração). `accept` valida posse com uma leitura solta (`HMGET`, seguro porque player1Id/player2Id são imutáveis) e conclui com um script Lua atômico que seta a flag e, se as duas já estiverem setadas, apaga as 3 chaves e retorna os dois ids; `claimAndCancel` (compartilhado por `leave`/desconexão e pelo poller de timeout) precisa ficar **inteiro** dentro de um único script Lua, sem pré-leitura em JS — os campos de aceite são mutáveis e uma leitura solta abriria uma corrida real contra um `accept` concorrente. `MatchmakingService.pollExpiredPendingMatches` (chamado por um `setInterval` em `onModuleInit`, cadência `getAcceptPollIntervalMs()`) varre o ZSET achando matchIds vencidos em qualquer réplica; a réplica que reivindica primeiro processa o cancelamento, as demais recebem `not_found` e não fazem nada — sem lock distribuído. Isso fecha a lacuna de pareamento/aceite documentada nos Prompts 17/18. Segredo compartilhado `AI_SERVICE_SHARED_SECRET` (header `X-AI-Service-Secret`) protege toda chamada `apps/api → services/ai`; junto com `JWT_SECRET` e `REDIS_URL`, todos falham fechado (lançam) se a env var não estiver definida — nenhum cai silenciosamente num default (Prompt 16). Algoritmo do JWT fixado explicitamente (`JWT_ALGORITHM = "HS256"`, `auth.constants.ts`) em todo ponto de verificação. E-mail é normalizado pra lowercase na fronteira do Zod (`UserSchema.email`, `packages/shared`) — comparações (login, bootstrap de moderador) não são mais case-sensitive. Prisma é a fonte de verdade durável (`RankingSnapshot`, `Report`/`Ban` append-only, `anonymizedAt` em vez de hard-delete de usuário). Partida tem duração fixa (`MATCH_DURATION_SECONDS`, `packages/shared`, Prompt 15): `MatchDurationSchedulerService` (`livekit/`) agenda, a partir de `Match.startedAt`, o encerramento forçado (`ScoringService.finalizeMatch` + `LivekitService.deleteRoom`) mesmo com os dois participantes ainda conectados; `LivekitWebhookController` cancela esse agendamento quando a partida já termina pelo caminho normal (`participant_left`). Esse agendamento (Prompt 20) mora em Redis, não em `Map` local: um ZSET compartilhado `lk:match-duration:expiry` (score = instante absoluto de vencimento, `Match.startedAt` + `MATCH_DURATION_SECONDS`) — sem script Lua, porque não há sub-estado mutável por partida como no Prompt 19 (`fire()` só precisa do `matchId`); `scheduleForMatch` agenda com `ZADD NX` (idempotente) e `cancel` remove com `ZREM`, e o próprio poller cross-instance (`pollDueMatches`, `setInterval` em `onModuleInit`, cadência `getMatchDurationPollIntervalMs()`) reusa `ZREM` como _claim_ atômico do vencedor da corrida — seu retorno (0 ou 1) já resolve sozinho quem dispara `fire()`, sem precisar de lock distribuído nem hash auxiliar. O tick de score ao vivo (`ScoreTickSchedulerService`, `scoring/`, Prompt 21) segue o mesmo molde, mas o agendamento é recorrente em vez de único: um ZSET compartilhado `score:tick:due` (score = próximo instante do tick) é reivindicado por um script Lua de compare-and-swap (`ZSCORE` + checagem `<= now` + `ZADD` do próximo vencimento, atômico) — só quem reivindica processa aquele ciclo e reagenda o seguinte; `ensureScheduledForMatch`/`cancel` não precisam mais de `player1Id`/`player2Id` (removidos da assinatura), já que `tick()` já reconsultava o `Match` no Prisma mesmo antes da migração e os deriva de lá. Os desafios de anti-cheat (`ChallengeSchedulerService`, `anti-cheat/`, Prompt 22) fecham o terceiro e último scheduler em memória: diferente dos Prompts 20/21, o sub-estado por jogador (`targetCount`/`issuedSoFar`/`sessionStartedAt`) é composto e mutável, então mora num HASH (`ac:match:{matchId}:user:{userId}:challenge-schedule`) ao lado do ZSET compartilhado `ac:challenge-schedule:due` — precisa de **dois** scripts Lua: um cria HASH+ZSET atomicamente só se ainda não existir (fecha a corrida de `ensureScheduledForMatch` ser chamado para os dois jogadores por réplicas diferentes quase ao mesmo tempo, já que o endpoint agenda sempre para os DOIS jogadores, não só quem chamou), outro reivindica um ciclo vencido com o mesmo compare-and-swap do tick de score e incrementa `issuedSoFar` atomicamente antes do `ZREM`; reagendar o próximo ciclo (delay aleatório, teto de `maxSessionMs`) fica em JS, fora do script, porque a essa altura só a réplica que reivindicou chega lá. 42 arquivos de spec (Vitest).

**services/ai** — FastAPI puro, sem MediaPipe/PyTorch (ver nota em "Stack fixa"). Endpoints: `GET /health`, `POST /score`, `POST /score/aggregate`, `POST /verify`. Scoring é função pura e versionada (`AURA_SCORE_VERSION = "aura-score-v1"`), soma ponderada de 5 métricas; agregação multi-amostra por **mediana por métrica** (robusta a outliers), teto de `SCORE_AGGREGATE_MAX_SAMPLES` amostras por chamada (Prompt 16). `/verify` (Prompt 6b) usa heurísticas clássicas de CV (Haar cascade + variância de Laplaciano) sobre um único keyframe, cobrindo só `presence`/`eyeContact`; a comparação temporal entre keyframes (detecção de replay) fica em `apps/api/src/anti-cheat`, não aqui. Keyframe decodificado tem teto de `VERIFY_MAX_IMAGE_MEGAPIXELS` (Prompt 16, guarda contra decompression-bomb — `ANTI_CHEAT_MAX_KEYFRAME_BASE64_LENGTH` só limita o tamanho comprimido). `BodySizeLimitMiddleware` rejeita (413) requisições acima de `MAX_REQUEST_BODY_BYTES` pelo header `Content-Length` (Prompt 16). Sem CORS (server-to-server only). `verify_service_secret` (Prompt 13, `app/security.py`) aceita, além de `AI_SERVICE_SHARED_SECRET`, um `AI_SERVICE_SHARED_SECRET_PREVIOUS` opcional como fallback (comparação constant-time via `hmac.compare_digest`, Prompt 18) — viabiliza rollout gradual do segredo (deploy de `services/ai` antes de `apps/api`) sem quebrar scoring/verify no meio da transição; segue fail-closed (sem `AI_SERVICE_SHARED_SECRET`, nenhuma requisição passa, independente da variável "anterior"). Desde o Prompt 23, `AI_SERVICE_SHARED_SECRET_PREVIOUS` aceita uma lista separada por vírgula (não só um único valor) — cada candidato é comparado individualmente via `hmac.compare_digest`, o que viabiliza rotação encadeada (trocar o segredo de novo antes de remover o valor anterior do ciclo em andamento). Contrato documentado em `services/ai/CONTRACT.md`. Testes com pytest (6 arquivos, incluindo guard-test de sincronia de constantes com o TS).

**packages/shared** — organizado em `dtos/` (19 arquivos), `enums/` (10 arquivos), `events/` (`event-map.ts` com `WsEventSchemas`, mapa único evento→schema, 11 eventos WS no total), mais `constants.ts` e `match-signing.ts` (strings canônicas para HMAC). Testes extensos (1541 linhas, incluindo `dtos.test.ts` com 1172 linhas) — contract-first levado a sério.

**packages/config** — `eslint.config.base.mjs`, `tsconfig.base.json` (`strict: true`, `noUncheckedIndexedAccess: true`), `prettier.config.mjs`, consumidos via `exports` do `package.json` por `apps/api`, `apps/web` e `packages/shared`.

## Infraestrutura e deploy

- `docker-compose.yml` sobe `postgres`, `redis`, `api`, `ai-service` — **`apps/web` não é containerizado**, roda via Vercel/`pnpm dev` nativamente.
- Dockerfiles multi-stage para `apps/api` (usa `turbo prune` para podar o monorepo) e para `services/ai` (`builder` com `uv sync` → `runtime` só com o `.venv` resolvido e o código; `uv`/`uvx`/`pyproject.toml`/`uv.lock` não vão pra imagem final).
- CI é 100% GitLab (`.gitlab-ci.yml`): stages `test` (lint, typecheck, test, ai-service, sast) e `build` (build, docker-build) — **sem job de deploy**; deploy é via integração nativa Railway/Vercel configurada manualmente.
- Deploy: Railway para `apps/api` e `services/ai` (via `railway.json`, builder Dockerfile, `preDeployCommand: prisma migrate deploy` no api), Vercel para `apps/web` (zero-config, root directory `apps/web`), Cloudflare para DNS.
- `.env` real vive na **raiz do monorepo** (fonte única para dev local); cada app/service tem um `.env.example` espelhando o subconjunto relevante para configurar os dashboards de deploy.

## Testes

| Pacote            | Framework | Comando                              | Cobertura                                |
| ----------------- | --------- | ------------------------------------ | ---------------------------------------- |
| `apps/web`        | Vitest    | `pnpm --filter web test`             | 12 arquivos, lib-level (sem E2E/browser) |
| `apps/api`        | Vitest    | `pnpm --filter api test`             | 42 arquivos de spec                      |
| `services/ai`     | pytest    | `cd services/ai && uv run pytest -v` | 6 arquivos                               |
| `packages/shared` | Vitest    | `pnpm --filter shared test`          | contratos exaustivamente testados        |

**Não há testes E2E/integração cross-serviço** (nem Playwright/Cypress no front, nem smoke test funcional das imagens Docker no CI) — gap conhecido, não silencioso.

## Lacunas e pontos de atenção conhecidos

Já documentadas em `docs/security-checklist.md` ou no próprio código — não são achados de bug, são trabalho pendente sinalizado. Separadas em duas categorias: o que dá pra implementar sem depender de decisão/credencial do humano, e o que depende dele.

### Dá para implementar sem depender do humano

- Sem testes E2E/integração cross-serviço (nem Playwright/Cypress no front, nem smoke test funcional das imagens Docker no CI).
- Container Scanning não está no `.gitlab-ci.yml` (só SAST/Secret Detection/Dependency Scanning, Prompt 16) — as imagens do job `docker-build` não são publicadas em nenhum registry, pré-requisito do template; o GitLab Container Registry do próprio projeto e as variáveis `CI_REGISTRY_*` (nativas do GitLab CI, sem segredo novo) resolvem isso.
- SAST/Secret Detection/Dependency Scanning rodam mas não bloqueiam o pipeline por achado (comportamento padrão do GitLab, só informam a MR) — um script customizado que parseia os relatórios e falha o job acima de um limiar de severidade é uma alternativa gratuita ao GitLab Ultimate.

### Depende do humano (decisão jurídica/de negócio/infra ou credencial)

- Texto de `/termos` é placeholder — conteúdo jurídico real pendente de revisão humana.
- Segredos de produção (`JWT_SECRET`, `AI_SERVICE_SHARED_SECRET`, `LIVEKIT_*`) ainda são placeholders `change-me` — trocar por valores reais é ação do humano em cada ambiente.
- Sem job de deploy automatizado no CI (deploy manual via dashboards Railway/Vercel) — automatizar exige gerar/injetar tokens de deploy e decidir se isso é desejado.
- Rota `apps/web/src/app/_dev/ui` parece página de showcase de componentes — decisão do humano sobre remover/proteger/manter antes de produção.
- GitLab Ultimate para bloquear o pipeline nativamente por achado de segurança — alternativa paga ao script customizado acima, se preferir não manter o script.
- Bootstrap de moderador só via `MODERATION_BOOTSTRAP_EMAILS`/update manual no banco, sem UI — decisão de escopo já confirmada para o MVP (`docs/security-checklist.md`), revisar depois se o volume de moderação justificar.
