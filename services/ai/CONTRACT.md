# Contrato HTTP — services/ai

Documenta o contrato de `POST /score` e `POST /score/aggregate` para o
`apps/api` consumir (Prompt 7) e para o anti-cheat reusar o núcleo de scoring
(Prompt 6b).

## Overview

- Base URL: `AI_SERVICE_URL` (`.env.example`, default `http://localhost:8000`).
- Porta: `AI_SERVICE_PORT` (default `8000`).
- Consumidores: `apps/api` (grava `AuraScore` em resultados de partida —
  Prompt 7); anti-cheat (Prompt 6b — pode importar `app.scoring`/`app.schemas`
  diretamente em processo, já que o núcleo de scoring não tem nenhuma
  dependência de HTTP, ou chamar via HTTP como qualquer outro consumidor).
- Sem CORS: o serviço é chamado server-to-server, nunca direto do browser.
- Todos os corpos de request/response são JSON, validados por schemas
  Pydantic com `extra="forbid"` — campos desconhecidos são rejeitados (422).

## Versionamento

Toda resposta carimba `"version": "aura-score-v1"` (`AURA_SCORE_VERSION`).
Mudanças futuras nos pesos ou no algoritmo de agregação devem incrementar a
versão (ex.: `"aura-score-v2"`) em vez de alterar o significado de
`"aura-score-v1"` — resultados já persistidos com uma versão continuam
válidos/interpretáveis sob essa mesma versão para sempre.

## `GET /health`

```
GET /health
```

```json
{ "status": "ok", "auraScoreVersion": "aura-score-v1" }
```

## `POST /score`

Recebe um vetor de features já extraído no cliente e retorna o `AuraScore`
correspondente. Função pura, determinística: mesmo corpo → mesmo
`overall`/`breakdown`/`version` (apenas `computedAt` varia, por ser metadado
de wall-clock).

**Request** — body = `AuraFeatures` direto, sem envelope:

```json
{
  "posture": 0.8,
  "eyeContact": 0.7,
  "expression": 0.6,
  "presence": 0.9,
  "movement": 0.5,
  "sequence": 0,
  "capturedAt": "2026-01-01T00:00:00.000Z"
}
```

**Response 200** — `AuraScore`:

```json
{
  "overall": 0.72,
  "breakdown": {
    "posture": 0.8,
    "eyeContact": 0.7,
    "expression": 0.6,
    "presence": 0.9,
    "movement": 0.5
  },
  "version": "aura-score-v1",
  "computedAt": "2026-08-04T03:07:36.487Z"
}
```

`overall` é sempre a soma ponderada do `breakdown` pelos pesos correntes
(`posture 0.30`, `eyeContact 0.25`, `expression 0.20`, `presence 0.15`,
`movement 0.10`), clampada em `[0, 1]`.

**Erros (422)** — corpo de erro no formato padrão do FastAPI/Pydantic
(`{"detail": [{"loc": [...], "msg": "...", "type": "..."}]}`):

| Caso | Exemplo |
|---|---|
| Métrica fora de `[0, 1]` | `posture: 1.5` |
| Campo obrigatório faltando | `capturedAt` ausente |
| Datetime inválido / sem sufixo `Z` | `capturedAt: "not-a-date"` |
| Campo desconhecido | `{"posture": 0.8, ..., "extra": "nope"}` |

## `POST /score/aggregate`

Recebe várias amostras de `AuraFeatures` de uma mesma partida e consolida em
um único `AuraScore` final.

**Request** — envelope `{"samples": AuraFeatures[]}` (não um array bruto —
deixa espaço para metadata futura como `matchId` sem quebrar a forma do body,
e dá paths de erro por índice mais legíveis, ex. `body -> samples -> 1 ->
posture`). `samples` exige ao menos 1 item.

```json
{
  "samples": [
    { "posture": 0.83, "eyeContact": 0.7, "expression": 0.6, "presence": 0.9, "movement": 0.5, "sequence": 0, "capturedAt": "2026-01-01T00:00:00.000Z" },
    { "posture": 0.85, "eyeContact": 0.72, "expression": 0.61, "presence": 0.88, "movement": 0.52, "sequence": 1, "capturedAt": "2026-01-01T00:00:02.000Z" },
    { "posture": 0.86, "eyeContact": 0.71, "expression": 0.59, "presence": 0.91, "movement": 0.49, "sequence": 2, "capturedAt": "2026-01-01T00:00:04.000Z" }
  ]
}
```

**Response 200** — `AuraScore` único (mesma forma de `/score`).

### Algoritmo de agregação

Para cada uma das 5 métricas, independentemente, calcula-se a **mediana**
através de todas as amostras — esse `breakdown` agregado é então passado pelo
mesmo cálculo de soma ponderada usado em `/score` (nunca uma média dos
`overall` individuais). Isso garante que "overall == soma ponderada do
breakdown" vale também para o resultado agregado.

Por que mediana, e não média simples ou trimmed-mean:

- **Robustez a outliers**: ponto de ruptura de 50% — até metade das amostras
  pode ser anômala/corrompida sem mover a mediana. Relevante mesmo sem o
  anti-cheat completo (Prompt 6b) ainda implementado.
- **Zero parâmetros a ajustar**: uma trimmed-mean exigiria escolher e
  justificar uma fração de corte sem dado histórico ainda disponível neste
  estágio do projeto.
- **Degenera corretamente em N=1**: `aggregate([f])` produz o mesmo
  `breakdown`/`overall`/`version` que `compute_score(f)` diretamente.
- **Independente de ordem**: amostras embaralhadas produzem exatamente o
  mesmo resultado — "mesmo input → mesmo output" vale mesmo que as amostras
  cheguem fora de ordem.

`sequence`/`capturedAt` de cada amostra são aceitos para rastreabilidade mas
não influenciam o score nem a ordem de agregação.

**Erros (422)**:

| Caso | Exemplo |
|---|---|
| `samples` vazio | `{"samples": []}` |
| Qualquer amostra inválida | mesmas regras de `/score`, com `loc` indexado pela posição da amostra |

## Nota para o Prompt 6b (anti-cheat)

`app/scoring.py` (`compute_score`, `aggregate_scores`) e `app/schemas.py`
(`AuraFeatures`, `AuraScore`) não importam nada de `fastapi`/HTTP — são
importáveis diretamente por qualquer código Python no mesmo processo (ex.:
uma futura rota `/verify` neste mesmo serviço), sem precisar de uma chamada
HTTP interna.
