"""Builder único de AuraFeatures, reusado em testes puros e testes HTTP."""

from typing import Any


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
