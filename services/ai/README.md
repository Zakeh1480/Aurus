# services/ai

Serviço de scoring do Aura Score (FastAPI). Recebe vetores de features já
extraídos no cliente (nunca vídeo cru — CLAUDE.md, regra 5) e retorna um
`AuraScore` determinístico, versionado e sem estado (CLAUDE.md, regra 4).

Como não existe `package.json` aqui, este diretório fica fora do grafo de
workspaces do pnpm/Turborepo — `pnpm build`/`lint`/`test` na raiz não o
tocam. As dependências Python são gerenciadas via [uv](https://docs.astral.sh/uv/).

## Quickstart

```bash
cd services/ai
uv sync                      # instala dependências (gera/usa uv.lock)
uv run pytest -v             # roda os testes
uv run python -m app.run     # sobe o servidor em AI_SERVICE_PORT (default 8000)
```

Com o servidor no ar:

```bash
curl localhost:8000/health
curl -X POST localhost:8000/score -H "Content-Type: application/json" -d '{
  "posture": 0.8, "eyeContact": 0.7, "expression": 0.6,
  "presence": 0.9, "movement": 0.5,
  "sequence": 0, "capturedAt": "2026-01-01T00:00:00.000Z"
}'
```

## Docker

```bash
docker build -t aurafarming-ai services/ai
docker run -p 8000:8000 aurafarming-ai
```

## Contrato HTTP

Ver [`CONTRACT.md`](./CONTRACT.md) para o request/response completo de
`/score` e `/score/aggregate`, incluindo o algoritmo de agregação (mediana
por métrica) e os casos de erro.

## Estrutura

```
app/
  main.py        # FastAPI app factory + registro de routers
  run.py         # entrypoint uvicorn (dev local e Docker CMD)
  config.py      # Settings via AI_SERVICE_PORT
  constants.py   # espelho manual de packages/shared/src/constants.ts
  schemas.py     # Pydantic — espelha AuraFeatures/AuraScore de packages/shared
  scoring.py     # núcleo puro de scoring, sem dependência de HTTP
  routers/       # health.py (GET /health), score.py (POST /score, /score/aggregate)
tests/           # pytest — testes puros (test_scoring.py) e via TestClient (test_api.py)
```
