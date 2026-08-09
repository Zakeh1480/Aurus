# Checklist de segurança — hardening (Prompt 13)

Checklist prático para revisar antes de expor a plataforma publicamente. Reexecute os comandos citados a cada PR relevante — este arquivo documenta o estado no momento do Prompt 13, não é garantia permanente.

## Segredos

- [x] `.env` (real) está no `.gitignore` (`git ls-files | grep -E "^\.env$"` não retorna nada) e nunca foi commitado.
- [x] `.env.example` documenta todo segredo com placeholder óbvio (`change-me`), nunca um valor real.
- [ ] **Antes de qualquer deploy**: trocar `JWT_SECRET`, `AI_SERVICE_SHARED_SECRET`, `LIVEKIT_API_KEY`/`LIVEKIT_API_SECRET` por valores reais em **todo** ambiente (dev remoto, staging, produção) — não só produção. `change-me` funciona em dev local porque é o mesmo valor nos dois lados (`apps/api` e `services/ai`), mas nunca deve sair da máquina local.
- [x] Segredos nunca logados: `to-public-user.mapper.ts` constrói o `User` público campo a campo (nunca `{...user}}`), então `passwordHash`/tokens nunca vazam em uma resposta por engano. Nenhum `logger.log`/`console.log` no repo referencia `passwordHash`, `tokenHash`, `accessToken` ou `refreshToken` (`grep -rn "passwordHash\|tokenHash" apps/api/src --include="*.ts" | grep -i log` deve retornar vazio).
- [x] `services/ai` não tem CORS nem é chamado direto do browser (`CONTRACT.md`); desde este prompt, `/score`, `/score/aggregate` e `/verify` exigem o header `X-AI-Service-Secret` batendo com `AI_SERVICE_SHARED_SECRET` (falha fechado — sem a env var configurada, nenhuma requisição passa). `/health` continua aberto para probes de infra.
- [x] Rotação do segredo compartilhado (Prompt 18): `services/ai` aceita um `AI_SERVICE_SHARED_SECRET_PREVIOUS` opcional além do `AI_SERVICE_SHARED_SECRET` atual, então a troca não exige mais deploy simultâneo dos dois lados. Procedimento: (1) deploy de `services/ai` com o novo valor em `AI_SERVICE_SHARED_SECRET` e o antigo em `AI_SERVICE_SHARED_SECRET_PREVIOUS`; (2) deploy de `apps/api` com o novo valor (ele só emite o header, nunca verifica, então não tem variável "anterior" própria); (3) num deploy seguinte, remover `AI_SERVICE_SHARED_SECRET_PREVIOUS` de `services/ai`. Desde o Prompt 23, `AI_SERVICE_SHARED_SECRET_PREVIOUS` aceita uma lista separada por vírgula (ex.: `old1,old2`), então rotações encadeadas (trocar de novo antes de remover a anterior) não quebram mais o meio da transição — cada troca só adiciona o valor recém-aposentado à lista, sem precisar esperar o passo (3) do ciclo anterior terminar.

## Nada sensível vaza para o cliente

- [x] Único bloco `NEXT_PUBLIC_*` em `.env.example`: `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_WS_URL` — ambos não-sensíveis (URLs públicas do próprio serviço).
- [x] Landmarks/vídeo: extração acontece 100% no navegador (MediaPipe WASM); só vetores de features numéricas trafegam para `apps/api`/`services/ai` (CLAUDE.md, regra 5).
- [x] Exceção documentada: `/verify` recebe um único keyframe comprimido (~dezenas de KB, capado por `ANTI_CHEAT_MAX_KEYFRAME_BASE64_LENGTH`) para heurísticas de liveness (blur/detecção de rosto) — nunca persistido (só o hash SHA-256 em Redis para dedup), nunca logado. Isso não é "vídeo cru" (a regra 5 é sobre vídeo, não sobre qualquer imagem) mas vale deixar explícito por que essa exceção existe.
- [x] LiveKit: chave/segredo (`LIVEKIT_API_KEY`/`LIVEKIT_API_SECRET`) só existem em `apps/api`; o cliente recebe apenas um token de acesso de curta duração via `POST /matches/:id/token`.

## Superfície HTTP/WS

- [x] Helmet ativo em `apps/api` (`main.ts`).
- [x] CORS restrito a `WEB_ORIGIN` (lista, não wildcard), `credentials: true` — mesma fonte (`common/cors.util.ts`) usada por REST e WebSocket, nunca diverge.
- [x] Rate limiting global (`@nestjs/throttler`, 20 req/60s por padrão) via `APP_GUARD`; rotas de auth mantêm limites mais estritos (5/60s em `register`/`login`).
- [x] Rate limiting nos eventos WS de matchmaking (`queue:join/leave/accept`, janela fixa via Redis) — `@nestjs/throttler` não cobre gateways Socket.IO.
- [ ] **Decisão de escopo, não gap**: `match:features`/`match:verify-response` (anti-cheat) não receberam o mesmo rate limiter — já têm proteção própria (assinatura HMAC, nonce de uso único, janela de clock skew, contabilização de pacotes rejeitados no trust score). Adicionar um limiter genérico ali arriscaria brigar com a cadência de amostragem do anti-cheat sem necessidade real hoje.
- [x] Toda rota REST nova (`POST /reports`, `GET/POST /moderation/*`) valida com `ZodValidationPipe` contra um schema de `packages/shared` — mesmo padrão já usado em 100% das rotas pré-existentes.
- [x] Cabeçalhos de segurança em `apps/web` (`next.config.ts`): `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy` (câmera liberada só para o próprio origin), `Strict-Transport-Security`.

## Moderação

- [x] `Report`/`Ban` são tabelas append-only (nunca hard-delete) — mesma convenção de `Consent`.
- [x] Nenhuma ação de moderação é automática: `dismissed`/`warned`/`banned` é sempre escolha explícita de um usuário com `role: "moderator"`, via `POST /moderation/reports/:id/action`, protegido por `RolesGuard`.
- [x] Incidentes de anti-cheat (`decision != "valid"`) entram sozinhos na fila (`source: "anti_cheat"`), mas isso só cria uma entrada revisável — não bane ninguém automaticamente.
- [x] Ban revoga sessões ativas (`AuthService.forceLogout`) e desconecta o socket ativo (`MatchmakingService.disconnectUser`); usuário banido recebe a mesma mensagem genérica de "credenciais inválidas" que um e-mail inexistente ou conta anonimizada (nunca revela "você está banido").
- [ ] **Bootstrap de moderador**: hoje só via `MODERATION_BOOTSTRAP_EMAILS` (env var, promoção idempotente na subida da API) ou update manual direto no banco (`UPDATE users SET role = 'moderator' WHERE email = '...'`). Não existe UI de promoção — decisão de escopo confirmada para o MVP, revisar se o volume de moderação justificar um fluxo mais formal depois.

## LGPD

- [x] Export (`GET /users/me/export`) e anonimização (`DELETE /users/me`) revisados ponta-a-ponta neste prompt — continuam corretos; anonimizar um usuário nunca remove seu histórico de `Report`/`Ban` (FKs `onDelete: Restrict`, preserva a auditoria).
- [x] `ConsentType` agora cobre `"terms"` além de `"camera"` — cadastro exige aceite explícito dos Termos de Uso/Política de Privacidade antes de criar a conta.
- [ ] **Texto de `/termos` é placeholder** — estrutura de seções pronta, mas o conteúdo jurídico final precisa de revisão humana antes do lançamento (CLAUDE.md, "Trilha humana": sign-off de LGPD é decisão do humano).

## Como reverificar

```bash
grep -n "^\.env$" .gitignore                                  # .env está ignorado
git ls-files | grep -E "^\.env$|\.env\.local"                 # nada retornado
grep -rn "@Body\|@Query" apps/api/src --include="*.controller.ts"  # toda rota nova tem um ZodValidationPipe ao lado
pnpm --filter api test && pnpm --filter web test && pnpm --filter @aurafarming/shared test
cd services/ai && uv run pytest -v
```
