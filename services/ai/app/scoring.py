import statistics
from datetime import datetime

from app.constants import (
    AURA_METRIC_KEYS,
    AURA_SCORE_VERSION,
    AURA_SCORE_WEIGHTS,
    GESTURE_BONUS_MAX,
    GESTURE_FARMAR_AURA_EXPRESSION_MAX,
    GESTURE_FARMAR_AURA_EXPRESSION_MIN,
    GESTURE_FARMAR_AURA_MOVEMENT_MAX,
    GESTURE_FARMAR_AURA_POSTURE_MIN,
    GESTURE_HEURISTIC_VERSION,
    GESTURE_MOGGAR_EYE_CONTACT_MIN,
    GESTURE_MOGGAR_MOVEMENT_MAX,
    GESTURE_MOGGAR_POSTURE_MIN,
)
from app.schemas import AuraFeatures, AuraScore, AuraScoreBreakdown, GestureLabel, GestureResult
from app.utils.time import to_iso_z, utc_now_iso


def _clamp01(value: float) -> float:
    return min(1.0, max(0.0, value))


def _weighted_total(breakdown: AuraScoreBreakdown) -> float:
    total = sum(getattr(breakdown, key) * AURA_SCORE_WEIGHTS[key] for key in AURA_METRIC_KEYS)
    return _clamp01(total)


def _classify_gesture(breakdown: AuraScoreBreakdown) -> tuple[GestureLabel, float]:
    if (
        breakdown.eyeContact >= GESTURE_MOGGAR_EYE_CONTACT_MIN
        and breakdown.posture >= GESTURE_MOGGAR_POSTURE_MIN
        and breakdown.movement <= GESTURE_MOGGAR_MOVEMENT_MAX
    ):
        eye_margin = (breakdown.eyeContact - GESTURE_MOGGAR_EYE_CONTACT_MIN) / (
            1 - GESTURE_MOGGAR_EYE_CONTACT_MIN
        )
        posture_margin = (breakdown.posture - GESTURE_MOGGAR_POSTURE_MIN) / (
            1 - GESTURE_MOGGAR_POSTURE_MIN
        )
        return "moggar", _clamp01((eye_margin + posture_margin) / 2)

    if (
        breakdown.movement <= GESTURE_FARMAR_AURA_MOVEMENT_MAX
        and GESTURE_FARMAR_AURA_EXPRESSION_MIN
        <= breakdown.expression
        <= GESTURE_FARMAR_AURA_EXPRESSION_MAX
        and breakdown.posture >= GESTURE_FARMAR_AURA_POSTURE_MIN
    ):
        movement_margin = (
            GESTURE_FARMAR_AURA_MOVEMENT_MAX - breakdown.movement
        ) / GESTURE_FARMAR_AURA_MOVEMENT_MAX
        expression_center = (
            GESTURE_FARMAR_AURA_EXPRESSION_MIN + GESTURE_FARMAR_AURA_EXPRESSION_MAX
        ) / 2
        expression_half_range = (
            GESTURE_FARMAR_AURA_EXPRESSION_MAX - GESTURE_FARMAR_AURA_EXPRESSION_MIN
        ) / 2
        expression_margin = (
            1 - abs(breakdown.expression - expression_center) / expression_half_range
        )
        return "farmarAura", _clamp01((movement_margin + expression_margin) / 2)

    return "none", 0.0


def _gesture_bonus(label: GestureLabel, confidence: float) -> float:
    return 0.0 if label == "none" else GESTURE_BONUS_MAX * confidence


def _gesture_result(breakdown: AuraScoreBreakdown) -> GestureResult:
    label, confidence = _classify_gesture(breakdown)
    return GestureResult(label=label, confidence=confidence, version=GESTURE_HEURISTIC_VERSION)


def _computed_at(now: datetime | None) -> str:
    return utc_now_iso() if now is None else to_iso_z(now)


def compute_score(features: AuraFeatures, *, now: datetime | None = None) -> AuraScore:

    breakdown = AuraScoreBreakdown(**{key: getattr(features, key) for key in AURA_METRIC_KEYS})
    gesture = _gesture_result(breakdown)
    overall = _clamp01(
        _weighted_total(breakdown) + _gesture_bonus(gesture.label, gesture.confidence)
    )
    return AuraScore(
        overall=overall,
        breakdown=breakdown,
        gesture=gesture,
        version=AURA_SCORE_VERSION,
        computedAt=_computed_at(now),
    )


def aggregate_scores(samples: list[AuraFeatures], *, now: datetime | None = None) -> AuraScore:

    if not samples:
        raise ValueError("aggregate_scores requer ao menos uma amostra")

    breakdown = AuraScoreBreakdown(
        **{key: statistics.median(getattr(s, key) for s in samples) for key in AURA_METRIC_KEYS}
    )
    gesture = _gesture_result(breakdown)
    overall = _clamp01(
        _weighted_total(breakdown) + _gesture_bonus(gesture.label, gesture.confidence)
    )
    return AuraScore(
        overall=overall,
        breakdown=breakdown,
        gesture=gesture,
        version=AURA_SCORE_VERSION,
        computedAt=_computed_at(now),
    )
