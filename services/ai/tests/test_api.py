"""Testes da camada HTTP via fastapi.testclient.TestClient."""

import pytest
from fastapi.testclient import TestClient

from app.constants import AURA_SCORE_VERSION
from tests.fixtures import make_features


def test_health(client: TestClient) -> None:
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok", "auraScoreVersion": AURA_SCORE_VERSION}


def test_score_valid_body(client: TestClient) -> None:
    response = client.post("/score", json=make_features())
    assert response.status_code == 200
    body = response.json()
    expected = 0.8 * 0.30 + 0.7 * 0.25 + 0.6 * 0.20 + 0.9 * 0.15 + 0.5 * 0.10
    assert body["overall"] == pytest.approx(expected, abs=1e-9)
    assert body["version"] == AURA_SCORE_VERSION


def test_score_out_of_range_value_rejected(client: TestClient) -> None:
    response = client.post("/score", json=make_features(posture=1.5))
    assert response.status_code == 422


def test_score_missing_required_field_rejected(client: TestClient) -> None:
    payload = make_features()
    del payload["capturedAt"]
    response = client.post("/score", json=payload)
    assert response.status_code == 422


def test_score_invalid_datetime_rejected(client: TestClient) -> None:
    response = client.post("/score", json=make_features(capturedAt="not-a-date"))
    assert response.status_code == 422


def test_score_unknown_extra_field_rejected(client: TestClient) -> None:
    response = client.post("/score", json=make_features(extra="nope"))
    assert response.status_code == 422


def test_score_aggregate_with_multiple_samples(client: TestClient) -> None:
    samples = [make_features(posture=v) for v in (0.5, 0.7, 0.9)]
    response = client.post("/score/aggregate", json={"samples": samples})
    assert response.status_code == 200
    body = response.json()
    assert body["breakdown"]["posture"] == pytest.approx(0.7)


def test_score_aggregate_empty_samples_rejected(client: TestClient) -> None:
    response = client.post("/score/aggregate", json={"samples": []})
    assert response.status_code == 422


def test_score_aggregate_single_sample(client: TestClient) -> None:
    features = make_features()
    response = client.post("/score/aggregate", json={"samples": [features]})
    assert response.status_code == 200
    body = response.json()
    assert body["breakdown"]["posture"] == pytest.approx(features["posture"])


def test_score_determinism_ignoring_computed_at(client: TestClient) -> None:
    payload = make_features()
    first = client.post("/score", json=payload).json()
    second = client.post("/score", json=payload).json()
    first.pop("computedAt")
    second.pop("computedAt")
    assert first == second


def test_score_aggregate_overall_matches_weighted_sum(client: TestClient) -> None:
    samples = [
        make_features(posture=0.5, eyeContact=0.4, expression=0.3, presence=0.2, movement=0.1),
        make_features(posture=0.9, eyeContact=0.8, expression=0.7, presence=0.6, movement=0.5),
    ]
    response = client.post("/score/aggregate", json={"samples": samples})
    body = response.json()
    breakdown = body["breakdown"]
    expected = (
        breakdown["posture"] * 0.30
        + breakdown["eyeContact"] * 0.25
        + breakdown["expression"] * 0.20
        + breakdown["presence"] * 0.15
        + breakdown["movement"] * 0.10
    )
    assert body["overall"] == pytest.approx(expected, abs=1e-9)
