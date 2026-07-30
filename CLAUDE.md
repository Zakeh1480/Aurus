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
