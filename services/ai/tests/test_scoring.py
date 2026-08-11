import statistics
from datetime import datetime, timezone

import pytest

from app.constants import AURA_SCORE_VERSION
from app.schemas import AuraFeatures
from app.scoring import aggregate_scores, compute_score
from tests.fixtures import make_features

FIXED_NOW = datetime(2026, 1, 1, 12, 0, 0, tzinfo=timezone.utc)


def _features(**overrides: object) -> AuraFeatures:
    return AuraFeatures(**make_features(**overrides))


def test_compute_score_is_deterministic() -> None:
    features = _features()
    first = compute_score(features, now=FIXED_NOW)
    second = compute_score(features, now=FIXED_NOW)
    assert first == second


def test_compute_score_overall_matches_weighted_sum() -> None:
    features = _features(posture=0.8, eyeContact=0.7, expression=0.6, presence=0.9, movement=0.5)
    score = compute_score(features, now=FIXED_NOW)
    expected = 0.8 * 0.30 + 0.7 * 0.25 + 0.6 * 0.20 + 0.9 * 0.15 + 0.5 * 0.10
    assert score.overall == pytest.approx(expected, abs=1e-9)
    assert score.overall == pytest.approx(0.72, abs=1e-9)


def test_compute_score_stamps_version() -> None:
    score = compute_score(_features(), now=FIXED_NOW)
    assert score.version == AURA_SCORE_VERSION


def test_compute_score_breakdown_reflects_features() -> None:
    features = _features(
        posture=0.11, eyeContact=0.22, expression=0.33, presence=0.44, movement=0.55
    )
    score = compute_score(features, now=FIXED_NOW)
    assert score.breakdown.posture == pytest.approx(0.11)
    assert score.breakdown.eyeContact == pytest.approx(0.22)
    assert score.breakdown.expression == pytest.approx(0.33)
    assert score.breakdown.presence == pytest.approx(0.44)
    assert score.breakdown.movement == pytest.approx(0.55)


def test_compute_score_computed_at_uses_injected_now() -> None:
    score = compute_score(_features(), now=FIXED_NOW)
    assert score.computedAt == "2026-01-01T12:00:00.000Z"


def test_aggregate_single_sample_matches_compute_score() -> None:
    features = _features()
    direct = compute_score(features, now=FIXED_NOW)
    aggregated = aggregate_scores([features], now=FIXED_NOW)
    assert aggregated.breakdown == direct.breakdown
    assert aggregated.overall == pytest.approx(direct.overall)
    assert aggregated.version == direct.version


def test_aggregate_scores_is_deterministic() -> None:
    samples = [_features(posture=0.5), _features(posture=0.7), _features(posture=0.9)]
    first = aggregate_scores(samples, now=FIXED_NOW)
    second = aggregate_scores(samples, now=FIXED_NOW)
    assert first == second


def test_aggregate_scores_is_order_independent() -> None:
    samples = [_features(posture=0.5), _features(posture=0.7), _features(posture=0.9)]
    shuffled = list(reversed(samples))
    assert aggregate_scores(samples, now=FIXED_NOW) == aggregate_scores(shuffled, now=FIXED_NOW)


def test_aggregate_overall_matches_weighted_sum_of_its_own_breakdown() -> None:
    samples = [
        _features(posture=0.5, eyeContact=0.4, expression=0.3, presence=0.2, movement=0.1),
        _features(posture=0.9, eyeContact=0.8, expression=0.7, presence=0.6, movement=0.5),
        _features(posture=0.7, eyeContact=0.6, expression=0.5, presence=0.4, movement=0.3),
    ]
    aggregated = aggregate_scores(samples, now=FIXED_NOW)
    expected = (
        aggregated.breakdown.posture * 0.30
        + aggregated.breakdown.eyeContact * 0.25
        + aggregated.breakdown.expression * 0.20
        + aggregated.breakdown.presence * 0.15
        + aggregated.breakdown.movement * 0.10
    )
    assert aggregated.overall == pytest.approx(expected, abs=1e-9)


def test_aggregate_scores_resists_outlier_via_median() -> None:
    cluster = [_features(posture=v) for v in (0.83, 0.85, 0.86, 0.87)]
    outlier = _features(posture=0.02)
    samples = cluster + [outlier]

    aggregated = aggregate_scores(samples, now=FIXED_NOW)
    naive_mean = statistics.mean(s.posture for s in samples)

    assert aggregated.breakdown.posture == pytest.approx(0.85, abs=0.05)
    assert aggregated.breakdown.posture > naive_mean


def test_aggregate_scores_empty_list_raises() -> None:
    with pytest.raises(ValueError):
        aggregate_scores([])


def test_aggregate_scores_even_sample_count_interpolates_median() -> None:
    samples = [_features(posture=v) for v in (0.2, 0.4, 0.6, 0.8)]
    aggregated = aggregate_scores(samples, now=FIXED_NOW)
    assert aggregated.breakdown.posture == pytest.approx(0.5)
