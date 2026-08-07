"""Testes do segredo compartilhado apps/api <-> services/ai (Prompt 13, Prompt 18)."""

import pytest
from fastapi.testclient import TestClient

from app.main import app
from tests.fixtures import make_features, make_verify_request


def test_health_stays_open_without_secret() -> None:
    client = TestClient(app)
    response = client.get("/health")
    assert response.status_code == 200


def test_score_rejects_missing_secret_header() -> None:
    client = TestClient(app)
    response = client.post("/score", json=make_features())
    assert response.status_code == 401


def test_score_rejects_wrong_secret_header() -> None:
    client = TestClient(app, headers={"X-AI-Service-Secret": "wrong-secret"})
    response = client.post("/score", json=make_features())
    assert response.status_code == 401


def test_score_accepts_correct_secret_header() -> None:
    client = TestClient(app, headers={"X-AI-Service-Secret": "test-shared-secret"})
    response = client.post("/score", json=make_features())
    assert response.status_code == 200


def test_verify_rejects_missing_secret_header() -> None:
    client = TestClient(app)
    response = client.post("/verify", json=make_verify_request())
    assert response.status_code == 401


def test_score_accepts_previous_secret_header(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("AI_SERVICE_SHARED_SECRET_PREVIOUS", "old-shared-secret")
    client = TestClient(app, headers={"X-AI-Service-Secret": "old-shared-secret"})
    response = client.post("/score", json=make_features())
    assert response.status_code == 200


def test_score_rejects_stale_secret_when_previous_not_configured() -> None:
    client = TestClient(app, headers={"X-AI-Service-Secret": "old-shared-secret"})
    response = client.post("/score", json=make_features())
    assert response.status_code == 401


def test_score_rejects_when_header_matches_neither_current_nor_previous(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("AI_SERVICE_SHARED_SECRET_PREVIOUS", "old-shared-secret")
    client = TestClient(app, headers={"X-AI-Service-Secret": "some-other-secret"})
    response = client.post("/score", json=make_features())
    assert response.status_code == 401
