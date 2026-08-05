import os

# Precisa ser setado antes do client — verify_service_secret (Prompt 13) lê
# AI_SERVICE_SHARED_SECRET do ambiente a cada requisição.
os.environ["AI_SERVICE_SHARED_SECRET"] = "test-shared-secret"

import pytest
from fastapi.testclient import TestClient

from app.main import app


@pytest.fixture
def client() -> TestClient:
    # Header default em todo request deste client — /health fica de fora do
    # dependency (rota aberta para probes de infra), então recebê-lo não faz diferença lá.
    return TestClient(app, headers={"X-AI-Service-Secret": "test-shared-secret"})
