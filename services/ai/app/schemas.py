"""Schemas Pydantic espelhando packages/shared/src/dtos/aura-features.dto.ts
e aura-score.dto.ts campo a campo (mesmos nomes, mesma normalização 0-1).

Os nomes de campo ficam em camelCase (eyeContact, capturedAt, computedAt) —
sem tradução para snake_case + alias — para eliminar o risco de o corpo da
resposta reverter silenciosamente para snake_case caso `by_alias=True` seja
esquecido em algum ponto. `capturedAt`/`computedAt` ficam como `str` (não
`datetime` do Pydantic) para preservar o formato de wire idêntico ao
`z.iso.datetime()` do Zod, que por padrão exige sufixo 'Z' (UTC), não offset.
"""

from datetime import datetime
from typing import Annotated, Literal

from pydantic import AfterValidator, BaseModel, ConfigDict, Field

from app.constants import AURA_SCORE_VERSION


def _validate_iso_datetime(value: str) -> str:
    if not value.endswith("Z"):
        raise ValueError("datetime deve estar em UTC com sufixo 'Z' (formato Date.toISOString())")
    try:
        datetime.fromisoformat(value[:-1] + "+00:00")
    except ValueError as exc:
        raise ValueError("string ISO-8601 inválida") from exc
    return value


Unit = Annotated[float, Field(ge=0.0, le=1.0)]
IsoDatetimeStr = Annotated[str, AfterValidator(_validate_iso_datetime)]


class AuraFeatures(BaseModel):
    """Espelha AuraFeaturesSchema (aura-features.dto.ts)."""

    model_config = ConfigDict(extra="forbid")

    posture: Unit
    eyeContact: Unit
    expression: Unit
    presence: Unit
    movement: Unit
    sequence: Annotated[int, Field(ge=0)]
    capturedAt: IsoDatetimeStr


class AuraScoreBreakdown(BaseModel):
    """Espelha o objeto `breakdown` inline de AuraScoreSchema (aura-score.dto.ts).

    É uma classe nomeada só por ergonomia do lado Python; a forma JSON
    (objeto com as 5 métricas) permanece idêntica ao TS.
    """

    model_config = ConfigDict(extra="forbid")

    posture: Unit
    eyeContact: Unit
    expression: Unit
    presence: Unit
    movement: Unit


class AuraScore(BaseModel):
    """Espelha AuraScoreSchema (aura-score.dto.ts)."""

    model_config = ConfigDict(extra="forbid")

    overall: Unit
    breakdown: AuraScoreBreakdown
    version: Literal[AURA_SCORE_VERSION]
    computedAt: IsoDatetimeStr


class ScoreAggregateRequest(BaseModel):
    """Envelope de POST /score/aggregate — sem equivalente direto em `shared`.

    Usa `{"samples": [...]}` em vez de um array bruto para deixar espaço a
    metadata futura (ex.: matchId) sem quebrar a forma do body, e para dar
    paths de erro por índice mais legíveis (`body -> samples -> 1 -> posture`).
    """

    model_config = ConfigDict(extra="forbid")

    samples: Annotated[list[AuraFeatures], Field(min_length=1)]
