import math

from app.constants import (
    ANTI_CHEAT_VERSION,
    AURA_METRIC_KEYS,
    AURA_SCORE_VERSION,
    AURA_SCORE_WEIGHTS,
)
from app.schemas import AuraFeatures, AuraScoreBreakdown


def test_weights_sum_to_one() -> None:
    assert math.isclose(sum(AURA_SCORE_WEIGHTS.values()), 1.0, abs_tol=1e-9)


def test_weight_keys_match_metric_keys() -> None:
    assert set(AURA_SCORE_WEIGHTS.keys()) == set(AURA_METRIC_KEYS)


def test_metric_keys_match_features_model() -> None:
    non_metric_fields = {"sequence", "capturedAt"}
    feature_fields = set(AuraFeatures.model_fields.keys()) - non_metric_fields
    assert feature_fields == set(AURA_METRIC_KEYS)


def test_metric_keys_match_breakdown_model() -> None:
    assert set(AuraScoreBreakdown.model_fields.keys()) == set(AURA_METRIC_KEYS)


def test_version_value() -> None:
    assert AURA_SCORE_VERSION == "aura-score-v1"


def test_anti_cheat_version_value() -> None:
    assert ANTI_CHEAT_VERSION == "anti-cheat-v1"
