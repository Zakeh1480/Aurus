import os

os.environ["AI_SERVICE_SHARED_SECRET"] = "test-shared-secret"

import pytest
from fastapi.testclient import TestClient

from app.main import app


@pytest.fixture
def client() -> TestClient:

    return TestClient(app, headers={"X-AI-Service-Secret": "test-shared-secret"})
