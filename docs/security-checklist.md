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
- [x] Reconfirmado no Prompt 28: zero uso de `localStorage`/`sessionStorage`/IndexedDB em `apps/web` (`grep -rn "localStorage\|sessionStorage\|indexedDB" apps/web/src` vazio) — access token só em memória (`api-client.ts`), refresh só no cookie `httpOnly` da API, nunca lido/escrito por JS.

## Superfície HTTP/WS

- [x] Helmet ativo em `apps/api` (`main.ts`).
- [x] CORS restrito a `WEB_ORIGIN` (lista, não wildcard), `credentials: true` — mesma fonte (`common/cors.util.ts`) usada por REST e WebSocket, nunca diverge.
- [x] Rate limiting global (`@nestjs/throttler`, 20 req/60s por padrão) via `APP_GUARD`; rotas de auth mantêm limites mais estritos (5/60s em `register`/`login`).
- [x] Rate limiting nos eventos WS de matchmaking (`queue:join/leave/accept`, janela fixa via Redis) — `@nestjs/throttler` não cobre gateways Socket.IO.
- [ ] **Decisão de escopo, não gap**: `match:features`/`match:verify-response` (anti-cheat) não receberam o mesmo rate limiter — já têm proteção própria (assinatura HMAC, nonce de uso único, janela de clock skew, contabilização de pacotes rejeitados no trust score). Adicionar um limiter genérico ali arriscaria brigar com a cadência de amostragem do anti-cheat sem necessidade real hoje.
- [x] Rate limit no **handshake** de conexão WS (Prompt 28, `matchmaking-io.adapter.ts`): antes só existia rate limit nas mensagens pós-conexão (`queue:*`) — o handshake em si (JWT verify + reconsulta ao Postgres por tentativa) não tinha teto nenhum, então um flood de tentativas de conexão virava flood de query no banco mesmo com token inválido. Chaveado por IP (primeiro salto de `X-Forwarded-For`, já que `socket.handshake.address` do engine.io não respeita `trust proxy` do Express como `req.ip` respeita); falha do próprio rate limiter (Redis fora do ar) não bloqueia a autenticação (fail open só nessa checagem de volume).
- [x] Rate limiting por IP em `services/ai` (Prompt 28, `app/rate_limit.py`) — antes dependia inteiramente de `apps/api` nunca floodar; agora há um teto real (default 1200 req/60s, configurável via `AI_SERVICE_RATE_LIMIT_MAX_REQUESTS`/`AI_SERVICE_RATE_LIMIT_WINDOW_SECONDS`) contra o segredo compartilhado vazando ou um bug de loop em `apps/api`. Em memória (não Redis) — não é cross-instance-safe se `services/ai` rodar múltiplas réplicas, mas ainda é defesa em profundidade real. `/health` fica de fora (probe de infra).
- [x] Toda rota REST nova (`POST /reports`, `GET/POST /moderation/*`) valida com `ZodValidationPipe` contra um schema de `packages/shared` — mesmo padrão já usado em 100% das rotas pré-existentes.
- [x] Cabeçalhos de segurança em `apps/web` (`next.config.ts`): `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy` (câmera liberada só para o próprio origin), `Strict-Transport-Security`, e desde o Prompt 28 também `Content-Security-Policy` (allowlist explícita: próprio origin, API/WS configurados, `*.livekit.cloud`, CDN do MediaPipe WASM/modelo — `'wasm-unsafe-eval'` liberado só porque a extração de landmarks roda via WASM no cliente, regra de ouro 5).
- [x] `Cache-Control: no-store` em toda resposta de `apps/api` (Prompt 28, middleware em `main.ts`) — a API é 100% dinâmica/por-usuário (perfil, tokens, ranking), nada aqui deve ser retido por proxy/CDN intermediário ou cache do próprio navegador.
- [ ] **CSRF — avaliado, decisão de escopo, não gap**: o cookie de refresh já é `sameSite: "lax"` + `path: "/auth"`, o que já bloqueia o vetor prático (navegadores modernos não enviam cookie `Lax` em `POST` cross-site, só em navegação top-level `GET`). Não foi implementado um token CSRF explícito (double-submit) — o risco residual é baixo e as únicas rotas afetadas (`POST /auth/refresh`, `POST /auth/logout`) não têm efeito destrutivo alcançável por esse vetor. Reavaliar se o escopo do cookie mudar.
- [x] Rota `/_dev/ui` (showcase de componentes) movida para dentro do route group `(protected)` (Prompt 28) — antes era acessível publicamente sem login; continua existindo para uso em dev, mas passa a exigir sessão autenticada como qualquer outra página protegida.

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

## Gate de severidade no CI (Prompt 25)

- [x] SAST, Secret Detection, Dependency Scanning (todos desde o Prompt 16) e Container Scanning (Prompt 24) rodam via templates gerenciados do GitLab, que por padrão só anotam a MR — não bloqueiam o pipeline por achado (isso exigiria GitLab Ultimate). `scripts/check-security-reports.mjs` é a alternativa gratuita: um job novo, `security-gate` (stage final, depois de `test` e `build`), lê os relatórios JSON que cada template gera (`gl-sast-report.json`, `gl-secret-detection-report.json`, `gl-dependency-scanning-report.json`, `gl-container-scanning-report.json` — os que existirem; ausência de um deles não é erro) e falha o job se algum achado tiver severidade >= `SECURITY_GATE_MIN_SEVERITY` (variável de CI, default `"High"`; ordem: `Info < Unknown < Low < Medium < High < Critical`).
- [x] `security-gate` não declara `needs:`/`dependencies:` de propósito — herda os artifacts de todos os jobs dos estágios `test`/`build` por padrão do GitLab, sem depender do nome exato de cada job de scanner (que varia por versão/template).
- **Falso positivo ou risco aceito**: adicionar o `id` da vulnerabilidade (campo `id` no JSON do relatório) num array em `.security-gate-allowlist.json` na raiz do projeto (arquivo opcional, não existe por padrão — só criar quando o primeiro caso aparecer). Achados nesse array são ignorados pelo gate mas continuam aparecendo normalmente na aba de segurança da MR no GitLab.

## Como reverificar

```bash
grep -n "^\.env$" .gitignore                                  # .env está ignorado
git ls-files | grep -E "^\.env$|\.env\.local"                 # nada retornado
grep -rn "@Body\|@Query" apps/api/src --include="*.controller.ts"  # toda rota nova tem um ZodValidationPipe ao lado
pnpm --filter api test && pnpm --filter web test && pnpm --filter @aurafarming/shared test
cd services/ai && uv run pytest -v
```
