#!/bin/sh
# Smoke test cross-serviço dos containers Docker (Prompt 26) — sobe
# postgres/redis/api/ai-service via Docker Compose e valida, contra
# containers de verdade (não mocks), que os dois /health respondem com a
# mesma auraScoreVersion e que o handshake X-AI-Service-Secret funciona de
# ponta a ponta. Não cobre LiveKit/vídeo (exigiria credenciais reais).
#
# POSIX sh de propósito — roda dentro da imagem docker:27 (Alpine) usada
# pelo job de CI, que só tem /bin/sh (sem bash/curl). O curl acontece via um
# container efêmero curlimages/curl na mesma network do compose, em vez de
# depender de portas publicadas (que em dind não são acessíveis via
# "localhost" do job) ou de instalar curl na imagem base.
#
# Uso:
#   SMOKE_TEST_MODE=local sh scripts/smoke-test.sh   # builda as imagens locais (default)
#   SMOKE_TEST_MODE=ci sh scripts/smoke-test.sh       # dá pull nas imagens (API_IMAGE/AI_IMAGE)

set -eu

SCRIPT_DIR=$(cd "$(dirname "$0")" && pwd)
cd "$SCRIPT_DIR/.."

COMPOSE="docker compose -f docker-compose.yml -f docker-compose.ci.yml"
NETWORK="aurafarming_ci_net"
MODE="${SMOKE_TEST_MODE:-local}"
SHARED_SECRET="ci-smoke-dummy-shared-secret"
TMP_DIR=$(mktemp -d)

# env_file: ./.env é obrigatório no docker-compose.yml base — só precisa
# existir (docker-compose.ci.yml supre os valores que importam via
# `environment:`, que sempre vence sobre env_file na precedência do
# Compose), então nunca sobrescreve um .env real de dev já existente.
[ -f .env ] || : > .env

cleanup() {
  status=$?
  if [ "$status" -ne 0 ]; then
    echo "--- smoke-test falhou, dump de logs ---"
    $COMPOSE logs --no-color || true
  fi
  $COMPOSE down -v --remove-orphans || true
  rm -rf "$TMP_DIR"
  exit "$status"
}
trap cleanup EXIT INT TERM

echo "=== smoke-test: modo=$MODE ==="

if [ "$MODE" = "ci" ]; then
  $COMPOSE pull api ai-service
else
  $COMPOSE build api ai-service
fi

$COMPOSE up -d postgres redis api ai-service

curl_in_net() {
  docker run --rm --network "$NETWORK" curlimages/curl:latest "$@"
}

wait_for_health() {
  url="$1"
  out_file="$2"
  i=0
  max=60
  while [ "$i" -lt "$max" ]; do
    if curl_in_net -sf "$url" > "$out_file" 2>/dev/null; then
      return 0
    fi
    i=$((i + 1))
    sleep 2
  done
  return 1
}

echo "--- aguardando api:3001/health ---"
if ! wait_for_health "http://api:3001/health" "$TMP_DIR/api-health.json"; then
  echo "api não respondeu /health a tempo" >&2
  exit 1
fi
echo "api saudável: $(cat "$TMP_DIR/api-health.json")"

echo "--- aguardando ai-service:8000/health ---"
if ! wait_for_health "http://ai-service:8000/health" "$TMP_DIR/ai-health.json"; then
  echo "ai-service não respondeu /health a tempo" >&2
  exit 1
fi
echo "ai-service saudável: $(cat "$TMP_DIR/ai-health.json")"

api_status=$(grep -o '"status":"[^"]*"' "$TMP_DIR/api-health.json")
ai_status=$(grep -o '"status":"[^"]*"' "$TMP_DIR/ai-health.json")
if [ "$api_status" != '"status":"ok"' ] || [ "$ai_status" != '"status":"ok"' ]; then
  echo "status inesperado — api=$api_status ai-service=$ai_status" >&2
  exit 1
fi

api_version=$(grep -o '"auraScoreVersion":"[^"]*"' "$TMP_DIR/api-health.json")
ai_version=$(grep -o '"auraScoreVersion":"[^"]*"' "$TMP_DIR/ai-health.json")
if [ -z "$api_version" ] || [ "$api_version" != "$ai_version" ]; then
  echo "auraScoreVersion divergente entre api ($api_version) e ai-service ($ai_version)" >&2
  exit 1
fi
echo "auraScoreVersion consistente entre os dois serviços: $api_version"

echo "--- validando handshake X-AI-Service-Secret entre containers reais ---"
FEATURES_PAYLOAD='{"posture":0.8,"eyeContact":0.7,"expression":0.6,"presence":0.9,"movement":0.5,"sequence":0,"capturedAt":"2026-01-01T00:00:00.000Z"}'

ok_status=$(curl_in_net -s -o /dev/null -w '%{http_code}' \
  -X POST "http://ai-service:8000/score" \
  -H "Content-Type: application/json" \
  -H "X-AI-Service-Secret: $SHARED_SECRET" \
  -d "$FEATURES_PAYLOAD")
if [ "$ok_status" != "200" ]; then
  echo "esperava 200 com o segredo correto, recebeu $ok_status" >&2
  exit 1
fi
echo "segredo correto -> 200 OK"

wrong_status=$(curl_in_net -s -o /dev/null -w '%{http_code}' \
  -X POST "http://ai-service:8000/score" \
  -H "Content-Type: application/json" \
  -H "X-AI-Service-Secret: wrong-secret" \
  -d "$FEATURES_PAYLOAD")
if [ "$wrong_status" != "401" ]; then
  echo "esperava 401 com o segredo errado, recebeu $wrong_status" >&2
  exit 1
fi
echo "segredo errado -> 401 OK"

echo "=== smoke-test OK ==="
