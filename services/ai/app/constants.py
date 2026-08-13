from typing import Final

AURA_SCORE_VERSION: Final[str] = "aura-score-v2"

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


GESTURE_HEURISTIC_VERSION: Final[str] = "gesture-heuristic-v1"

GESTURE_BONUS_MAX: Final[float] = 0.05

GESTURE_MOGGAR_EYE_CONTACT_MIN: Final[float] = 0.70
GESTURE_MOGGAR_POSTURE_MIN: Final[float] = 0.70
GESTURE_MOGGAR_MOVEMENT_MAX: Final[float] = 0.40

GESTURE_FARMAR_AURA_MOVEMENT_MAX: Final[float] = 0.20
GESTURE_FARMAR_AURA_EXPRESSION_MIN: Final[float] = 0.35
GESTURE_FARMAR_AURA_EXPRESSION_MAX: Final[float] = 0.65
GESTURE_FARMAR_AURA_POSTURE_MIN: Final[float] = 0.55


ANTI_CHEAT_VERSION: Final[str] = "anti-cheat-v1"

ANTI_CHEAT_MAX_KEYFRAME_BASE64_LENGTH: Final[int] = 400_000


VERIFY_MAX_IMAGE_MEGAPIXELS: Final[int] = 25


SCORE_AGGREGATE_MAX_SAMPLES: Final[int] = 2000


MAX_REQUEST_BODY_BYTES: Final[int] = 2_000_000
