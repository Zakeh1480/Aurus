"""Testes das funções puras de app/verification.py (Prompt 6b)."""

import base64
from unittest.mock import patch

import numpy as np
import pytest

from app.config import Settings
from app.schemas import AuraFeatures, VerifyRequest
from app.verification import (
    DISCREPANCY_DIMENSION_WEIGHTS,
    FacePresenceResult,
    compute_blur_variance,
    compute_discrepancy,
    compute_liveness_flags,
    decode_keyframe,
    derive_eye_contact_proxy,
    derive_presence_proxy,
    detect_face_presence,
    verify,
)
from tests.fixtures import encode_image_base64, make_flat_image, make_noisy_image, make_verify_request

SETTINGS = Settings()


def test_decode_keyframe_valid_png_returns_array_with_expected_shape() -> None:
    image = make_flat_image(size=50)
    decoded = decode_keyframe(encode_image_base64(image))
    assert decoded.shape[0] == 50
    assert decoded.shape[1] == 50


def test_decode_keyframe_invalid_base64_raises_value_error() -> None:
    with pytest.raises(ValueError):
        decode_keyframe("not-base64!!!")


def test_decode_keyframe_corrupt_image_bytes_raises_value_error() -> None:
    corrupt = base64.b64encode(b"not an image").decode("ascii")
    with pytest.raises(ValueError):
        decode_keyframe(corrupt)


def test_compute_blur_variance_flat_image_is_near_zero() -> None:
    assert compute_blur_variance(make_flat_image()) == pytest.approx(0.0, abs=1e-6)


def test_compute_blur_variance_noisy_image_is_higher_than_flat() -> None:
    flat_variance = compute_blur_variance(make_flat_image())
    noisy_variance = compute_blur_variance(make_noisy_image())
    assert noisy_variance > flat_variance


def test_detect_face_presence_no_face_on_flat_image() -> None:
    result = detect_face_presence(make_flat_image(), settings=SETTINGS)
    assert result.faces_detected == 0


def test_detect_face_presence_uses_mocked_cascade_for_deterministic_pipeline_tests() -> None:
    """A acurácia do Haar cascade em imagens sintéticas não vale a pena fixar em
    teste unitário — é um algoritmo já vetorizado/testado pelo OpenCV. O que
    este módulo constrói POR CIMA dele (derivação de proxies, discrepancy)
    precisa ser preciso, então mockamos o cascade para pinar sua saída."""
    image = make_noisy_image(size=100)
    with (
        patch("app.verification._FACE_CASCADE") as mock_face_cascade,
        patch("app.verification._EYE_CASCADE") as mock_eye_cascade,
    ):
        mock_face_cascade.detectMultiScale.return_value = np.array([[10, 10, 50, 50]])
        mock_eye_cascade.detectMultiScale.return_value = np.array([[5, 5, 10, 10], [30, 5, 10, 10]])
        result = detect_face_presence(image, settings=SETTINGS)

    assert result.faces_detected == 1
    assert result.largest_face_area_ratio == pytest.approx((50 * 50) / (100 * 100))
    assert result.eyes_detected_in_largest_face == 2


def test_derive_presence_proxy_full_face_area_returns_one() -> None:
    face = FacePresenceResult(faces_detected=1, largest_face_area_ratio=1.0, eyes_detected_in_largest_face=2)
    assert derive_presence_proxy(face, settings=SETTINGS) == 1.0


def test_derive_presence_proxy_small_face_area_scales_down() -> None:
    half_threshold = SETTINGS.verify_face_min_area_ratio / 2
    face = FacePresenceResult(faces_detected=1, largest_face_area_ratio=half_threshold, eyes_detected_in_largest_face=2)
    assert derive_presence_proxy(face, settings=SETTINGS) == pytest.approx(0.5)


def test_derive_presence_proxy_no_face_returns_zero() -> None:
    face = FacePresenceResult(faces_detected=0, largest_face_area_ratio=0.0, eyes_detected_in_largest_face=0)
    assert derive_presence_proxy(face, settings=SETTINGS) == 0.0


def test_derive_eye_contact_proxy_two_eyes_returns_one() -> None:
    face = FacePresenceResult(faces_detected=1, largest_face_area_ratio=0.5, eyes_detected_in_largest_face=2)
    assert derive_eye_contact_proxy(face) == 1.0


def test_derive_eye_contact_proxy_one_eye_returns_half() -> None:
    face = FacePresenceResult(faces_detected=1, largest_face_area_ratio=0.5, eyes_detected_in_largest_face=1)
    assert derive_eye_contact_proxy(face) == 0.5


def test_derive_eye_contact_proxy_no_eyes_or_no_face_returns_zero() -> None:
    with_face_no_eyes = FacePresenceResult(faces_detected=1, largest_face_area_ratio=0.5, eyes_detected_in_largest_face=0)
    no_face = FacePresenceResult(faces_detected=0, largest_face_area_ratio=0.0, eyes_detected_in_largest_face=0)
    assert derive_eye_contact_proxy(with_face_no_eyes) == 0.0
    assert derive_eye_contact_proxy(no_face) == 0.0


def test_discrepancy_dimension_weights_sum_to_one() -> None:
    assert sum(DISCREPANCY_DIMENSION_WEIGHTS.values()) == pytest.approx(1.0)


def test_compute_discrepancy_zero_when_claims_match_proxies() -> None:
    face = FacePresenceResult(faces_detected=1, largest_face_area_ratio=SETTINGS.verify_face_min_area_ratio, eyes_detected_in_largest_face=2)
    claimed = AuraFeatures(**{**{k: 0.5 for k in ("posture", "expression", "movement")}, "presence": 1.0, "eyeContact": 1.0, "sequence": 0, "capturedAt": "2026-01-01T00:00:00.000Z"})
    discrepancy, confidence = compute_discrepancy(claimed, face, settings=SETTINGS)
    assert discrepancy == pytest.approx(0.0, abs=1e-6)
    assert confidence == pytest.approx(1.0)


def test_compute_discrepancy_high_when_claims_dont_match_proxies() -> None:
    face = FacePresenceResult(faces_detected=0, largest_face_area_ratio=0.0, eyes_detected_in_largest_face=0)
    claimed = AuraFeatures(**{**{k: 0.5 for k in ("posture", "expression", "movement")}, "presence": 1.0, "eyeContact": 1.0, "sequence": 0, "capturedAt": "2026-01-01T00:00:00.000Z"})
    discrepancy, _confidence = compute_discrepancy(claimed, face, settings=SETTINGS)
    assert discrepancy == pytest.approx(1.0)


def test_verify_static_flat_image_flags_static_image_suspected() -> None:
    request = VerifyRequest(**make_verify_request(keyframeBase64=encode_image_base64(make_flat_image())))
    response = verify(request)
    assert response.liveness.staticImageSuspected is True


def test_verify_noisy_image_does_not_flag_static_image_suspected() -> None:
    request = VerifyRequest(**make_verify_request(keyframeBase64=encode_image_base64(make_noisy_image())))
    response = verify(request)
    assert response.liveness.staticImageSuspected is False


def test_verify_propagates_value_error_on_corrupt_base64() -> None:
    request = VerifyRequest(**make_verify_request(keyframeBase64="not-base64!!!"))
    with pytest.raises(ValueError):
        verify(request)
