import base64
from typing import Any

import cv2
import numpy as np


def make_features(**overrides: Any) -> dict[str, Any]:
    defaults: dict[str, Any] = {
        "posture": 0.8,
        "eyeContact": 0.7,
        "expression": 0.6,
        "presence": 0.9,
        "movement": 0.5,
        "sequence": 0,
        "capturedAt": "2026-01-01T00:00:00.000Z",
    }
    defaults.update(overrides)
    return defaults


def make_flat_image(size: int = 200, color: int = 128) -> np.ndarray:

    return np.full((size, size, 3), color, dtype=np.uint8)


def make_noisy_image(size: int = 200, seed: int = 42) -> np.ndarray:

    rng = np.random.default_rng(seed)
    return rng.integers(0, 255, (size, size, 3), dtype=np.uint8).astype(np.uint8)


def encode_image_base64(image: np.ndarray, ext: str = ".png") -> str:
    ok, buf = cv2.imencode(ext, image)
    assert ok
    return base64.b64encode(buf.tobytes()).decode("ascii")


def make_verify_request(**overrides: Any) -> dict[str, Any]:
    defaults: dict[str, Any] = {
        "matchId": "123e4567-e89b-12d3-a456-426614174000",
        "userId": "223e4567-e89b-12d3-a456-426614174001",
        "challengeId": "323e4567-e89b-12d3-a456-426614174002",
        "keyframeBase64": encode_image_base64(make_noisy_image()),
        "claimedFeatures": make_features(),
    }
    defaults.update(overrides)
    return defaults
