from fastapi.testclient import TestClient

from app.constants import ANTI_CHEAT_VERSION
from tests.fixtures import (
    encode_image_base64,
    make_flat_image,
    make_noisy_image,
    make_verify_request,
)


def test_verify_valid_request_returns_200_with_expected_shape(client: TestClient) -> None:
    response = client.post("/verify", json=make_verify_request())
    assert response.status_code == 200
    body = response.json()
    assert set(body.keys()) == {
        "matchId",
        "userId",
        "challengeId",
        "discrepancy",
        "discrepancyConfidence",
        "liveness",
        "version",
        "computedAt",
    }
    assert body["version"] == ANTI_CHEAT_VERSION


def test_verify_missing_keyframe_base64_rejected_422(client: TestClient) -> None:
    payload = make_verify_request()
    del payload["keyframeBase64"]
    response = client.post("/verify", json=payload)
    assert response.status_code == 422


def test_verify_invalid_base64_rejected_422(client: TestClient) -> None:
    response = client.post("/verify", json=make_verify_request(keyframeBase64="not-base64!!!"))
    assert response.status_code == 422


def test_verify_corrupt_image_bytes_rejected_422(client: TestClient) -> None:
    import base64

    corrupt = base64.b64encode(b"not an image").decode("ascii")
    response = client.post("/verify", json=make_verify_request(keyframeBase64=corrupt))
    assert response.status_code == 422


def test_verify_claimed_features_out_of_range_rejected_422(client: TestClient) -> None:
    payload = make_verify_request()
    payload["claimedFeatures"]["posture"] = 1.5
    response = client.post("/verify", json=payload)
    assert response.status_code == 422


def test_verify_unknown_extra_field_rejected_422(client: TestClient) -> None:
    payload = make_verify_request(extra="nope")
    response = client.post("/verify", json=payload)
    assert response.status_code == 422


def test_verify_invalid_uuid_rejected_422(client: TestClient) -> None:
    response = client.post("/verify", json=make_verify_request(matchId="not-a-uuid"))
    assert response.status_code == 422


def test_verify_response_version_stamped(client: TestClient) -> None:
    response = client.post("/verify", json=make_verify_request())
    assert response.json()["version"] == "anti-cheat-v1"


def test_verify_static_image_end_to_end_flags_liveness(client: TestClient) -> None:
    payload = make_verify_request(
        keyframeBase64=encode_image_base64(make_flat_image()),
        claimedFeatures={
            "posture": 0.5,
            "eyeContact": 1.0,
            "expression": 0.5,
            "presence": 1.0,
            "movement": 0.5,
            "sequence": 0,
            "capturedAt": "2026-01-01T00:00:00.000Z",
        },
    )
    response = client.post("/verify", json=payload)
    assert response.status_code == 200
    body = response.json()
    assert body["liveness"]["staticImageSuspected"] is True
    assert body["discrepancy"] > 0


def test_verify_noisy_image_end_to_end_does_not_flag_static(client: TestClient) -> None:
    payload = make_verify_request(keyframeBase64=encode_image_base64(make_noisy_image()))
    response = client.post("/verify", json=payload)
    assert response.status_code == 200
    assert response.json()["liveness"]["staticImageSuspected"] is False
