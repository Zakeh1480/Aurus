# Fairness do Aura Score

Este documento explica, em linguagem simples, como o Aura Score é calculado e como contestar um resultado. Não substitui a política de fairness/moderação em si (decisão humana — ver "Trilha humana" no `CLAUDE.md`), só documenta o mecanismo já implementado.

## Como o score é calculado

```
score = f(features, AURA_SCORE_VERSION)
```

- `features` é um vetor de 5 métricas (0 a 1), extraídas **no seu navegador** via MediaPipe: `posture`, `eyeContact`, `expression`, `presence`, `movement`. O vídeo bruto nunca chega ao servidor.
- A função `f` é **pura, determinística e sem estado** — mesmas features sempre produzem o mesmo score. Ela vive em `services/ai` (Python).
- O resultado é o `overall` (média ponderada) e o `breakdown` (valor bruto de cada métrica).

## Pesos fixos por métrica

| Métrica | Peso |
| --- | --- |
| Postura (`posture`) | 0.30 |
| Contato visual (`eyeContact`) | 0.25 |
| Expressão (`expression`) | 0.20 |
| Presença (`presence`) | 0.15 |
| Movimento (`movement`) | 0.10 |

Fonte única: `AURA_SCORE_WEIGHTS` em `packages/shared/src/constants.ts` — front e back importam a mesma constante, nunca redeclaram os pesos.

## Versão carimbada em todo resultado

Toda vez que um score é calculado, ele carrega `version: AURA_SCORE_VERSION` (hoje `"aura-score-v1"`). Essa versão é persistida em `Match.scoreVersion` e em `MatchResult.player1Score`/`player2Score` — se o algoritmo mudar no futuro, resultados antigos continuam auditáveis com a versão que realmente os gerou.

## Como ver o detalhamento do seu resultado

- Na tela de resultado (`/match/[id]`), cada métrica já mostra o peso ao lado da barra.
- `GET /matches/:id/score-explanation` (participante da partida ou moderador) retorna, por métrica: valor bruto, peso e contribuição (`raw × weight`) — útil para revisão fora do momento da partida.

## Como contestar um resultado

Use o canal de denúncia (botão "Reportar jogador" na tela de resultado, motivo "Trapaça / uso de terceiros" ou "Outro motivo"). A denúncia entra na fila de moderação e é revisada por um humano — nenhuma ação (advertência, ban) é automática. Se a partida também tiver sido sinalizada pelo pipeline de anti-cheat (Prompt 6b), essa informação aparece para o moderador junto com a denúncia.

## O que fica fora deste documento

Definição de thresholds de "cheating" no anti-cheat, política de banimento (duração, apelação) e qualquer mudança futura nos pesos/algoritmo são decisões de produto/fairness — humanas, não deste código. Ver `CLAUDE.md`, seção "Trilha humana".
