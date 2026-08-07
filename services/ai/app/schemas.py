"""Schemas Pydantic espelhando packages/shared/src/dtos/aura-features.dto.ts
e aura-score.dto.ts campo a campo (mesmos nomes, mesma normalização 0-1).

Os nomes de campo ficam em camelCase (eyeContact, capturedAt, computedAt) —
sem tradução para snake_case + alias — para eliminar o risco de o corpo da
resposta reverter silenciosamente para snake_case caso `by_alias=True` seja
esquecido em algum ponto. `capturedAt`/`computedAt` ficam como `str` (não
`datetime` do Pydantic) para preservar o formato de wire idêntico ao
`z.iso.datetime()` do Zod, que por padrão exige sufixo 'Z' (UTC), não offset.
"""

import re
from datetime import datetime
from typing import Annotated, Literal

from pydantic import AfterValidator, BaseModel, ConfigDict, Field

from app.constants import (
    ANTI_CHEAT_MAX_KEYFRAME_BASE64_LENGTH,
    ANTI_CHEAT_VERSION,
    AURA_SCORE_VERSION,
    SCORE_AGGREGATE_MAX_SAMPLES,
)


def _validate_iso_datetime(value: str) -> str:
    if not value.endswith("Z"):
        raise ValueError("datetime deve estar em UTC com sufixo 'Z' (formato Date.toISOString())")
    try:
        datetime.fromisoformat(value[:-1] + "+00:00")
    except ValueError as exc:
        raise ValueError("string ISO-8601 inválida") from exc
    return value


_UUID_RE = re.compile(
    r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$", re.IGNORECASE
)


def _validate_uuid(value: str) -> str:
    if not _UUID_RE.match(value):
        raise ValueError("UUID inválido")
    return value


Unit = Annotated[float, Field(ge=0.0, le=1.0)]
IsoDatetimeStr = Annotated[str, AfterValidator(_validate_iso_datetime)]
# Aceita qualquer versão de UUID (Prisma usa uuid(7)) — por isso NÃO usamos
# pydantic.UUID4, que restringe à v4.
UuidStr = Annotated[str, AfterValidator(_validate_uuid)]


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

    samples: Annotated[list[AuraFeatures], Field(min_length=1, max_length=SCORE_AGGREGATE_MAX_SAMPLES)]


class LivenessFlags(BaseModel):
    """Espelha LivenessFlagsSchema (verify.dto.ts)."""

    model_config = ConfigDict(extra="forbid")

    noFaceDetected: bool
    staticImageSuspected: bool
    lowDetailSuspected: bool
    multipleFacesDetected: bool


class VerifyRequest(BaseModel):
    """Espelha VerifyRequestSchema (verify.dto.ts) — body de POST /verify (Prompt 6b)."""

    model_config = ConfigDict(extra="forbid")

    matchId: UuidStr
    userId: UuidStr
    challengeId: UuidStr
    keyframeBase64: Annotated[str, Field(min_length=1, max_length=ANTI_CHEAT_MAX_KEYFRAME_BASE64_LENGTH)]
    claimedFeatures: AuraFeatures


class VerifyResponse(BaseModel):
    """Espelha VerifyResponseSchema (verify.dto.ts)."""

    model_config = ConfigDict(extra="forbid")

    matchId: UuidStr
    userId: UuidStr
    challengeId: UuidStr
    discrepancy: Unit
    discrepancyConfidence: Unit
    liveness: LivenessFlags
    version: Literal[ANTI_CHEAT_VERSION]
    computedAt: IsoDatetimeStr
