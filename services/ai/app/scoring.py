import statistics
from datetime import datetime

from app.constants import AURA_METRIC_KEYS, AURA_SCORE_VERSION, AURA_SCORE_WEIGHTS
from app.schemas import AuraFeatures, AuraScore, AuraScoreBreakdown
from app.utils.time import to_iso_z, utc_now_iso


def _weighted_total(breakdown: AuraScoreBreakdown) -> float:
    total = sum(getattr(breakdown, key) * AURA_SCORE_WEIGHTS[key] for key in AURA_METRIC_KEYS)
    return min(1.0, max(0.0, total))


def _computed_at(now: datetime | None) -> str:
    return utc_now_iso() if now is None else to_iso_z(now)


def compute_score(features: AuraFeatures, *, now: datetime | None = None) -> AuraScore:

    breakdown = AuraScoreBreakdown(**{key: getattr(features, key) for key in AURA_METRIC_KEYS})
    return AuraScore(
        overall=_weighted_total(breakdown),
        breakdown=breakdown,
        version=AURA_SCORE_VERSION,
        computedAt=_computed_at(now),
    )


def aggregate_scores(samples: list[AuraFeatures], *, now: datetime | None = None) -> AuraScore:

    if not samples:
        raise ValueError("aggregate_scores requer ao menos uma amostra")

    breakdown = AuraScoreBreakdown(
        **{key: statistics.median(getattr(s, key) for s in samples) for key in AURA_METRIC_KEYS}
    )
    return AuraScore(
        overall=_weighted_total(breakdown),
        breakdown=breakdown,
        version=AURA_SCORE_VERSION,
        computedAt=_computed_at(now),
    )
