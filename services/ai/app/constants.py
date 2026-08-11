from typing import Final

AURA_SCORE_VERSION: Final[str] = "aura-score-v1"

AURA_METRIC_KEYS: Final[tuple[str, ...]] = (
    "posture",
    "eyeContact",
    "expression",
    "presence",
    "movement",
)

AURA_SCORE_WEIGHTS: Final[dict[str, float]] = {
    "posture": 0.30,
    "eyeContact": 0.25,
    "expression": 0.20,
    "presence": 0.15,
    "movement": 0.10,
}


ANTI_CHEAT_VERSION: Final[str] = "anti-cheat-v1"

ANTI_CHEAT_MAX_KEYFRAME_BASE64_LENGTH: Final[int] = 400_000


VERIFY_MAX_IMAGE_MEGAPIXELS: Final[int] = 25


SCORE_AGGREGATE_MAX_SAMPLES: Final[int] = 2000


MAX_REQUEST_BODY_BYTES: Final[int] = 2_000_000
