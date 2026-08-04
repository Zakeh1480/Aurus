"""Núcleo de scoring — puro, sem qualquer import de FastAPI/HTTP.

`sequence`/`capturedAt` de `AuraFeatures` são aceitos para rastreabilidade mas
nunca influenciam o score. Este módulo é importável isoladamente (ex.: pelo
anti-cheat do Prompt 6b para reusar o cálculo de score sem acoplar-se à
camada HTTP).
"""

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
    """score = f(features, AURA_SCORE_VERSION) — determinístico e sem estado."""
    breakdown = AuraScoreBreakdown(**{key: getattr(features, key) for key in AURA_METRIC_KEYS})
    return AuraScore(
        overall=_weighted_total(breakdown),
        breakdown=breakdown,
        version=AURA_SCORE_VERSION,
        computedAt=_computed_at(now),
    )


def aggregate_scores(samples: list[AuraFeatures], *, now: datetime | None = None) -> AuraScore:
    """Consolida várias amostras de uma partida em um AuraScore final.

    Algoritmo: mediana por métrica através de todas as amostras, seguida do
    mesmo cálculo de soma ponderada usado em `compute_score` sobre o
    breakdown agregado (nunca a média dos `overall` individuais) — isso
    garante que "overall == soma ponderada do breakdown" vale também para o
    resultado agregado.

    Por que mediana (e não média simples ou trimmed-mean):
    - Robustez a outliers: ponto de ruptura de 50%, relevante mesmo sem o
      anti-cheat completo (Prompt 6b) ainda implementado.
    - Zero parâmetros a ajustar, ao contrário de trimmed-mean (exigiria
      escolher e justificar uma fração de corte sem dado histórico ainda).
    - Degenera corretamente em N=1 (aggregate_scores([f]) == compute_score(f)
      em breakdown/overall/version) e é independente da ordem das amostras
      (statistics.median ordena internamente).
    """
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
