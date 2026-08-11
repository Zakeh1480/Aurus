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


UuidStr = Annotated[str, AfterValidator(_validate_uuid)]


class AuraFeatures(BaseModel):
    model_config = ConfigDict(extra="forbid")

    posture: Unit
    eyeContact: Unit
    expression: Unit
    presence: Unit
    movement: Unit
    sequence: Annotated[int, Field(ge=0)]
    capturedAt: IsoDatetimeStr


class AuraScoreBreakdown(BaseModel):
    model_config = ConfigDict(extra="forbid")

    posture: Unit
    eyeContact: Unit
    expression: Unit
    presence: Unit
    movement: Unit


class AuraScore(BaseModel):
    model_config = ConfigDict(extra="forbid")

    overall: Unit
    breakdown: AuraScoreBreakdown
    version: Literal[AURA_SCORE_VERSION]
    computedAt: IsoDatetimeStr


class ScoreAggregateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    samples: Annotated[
        list[AuraFeatures], Field(min_length=1, max_length=SCORE_AGGREGATE_MAX_SAMPLES)
    ]


class LivenessFlags(BaseModel):
    model_config = ConfigDict(extra="forbid")

    noFaceDetected: bool
    staticImageSuspected: bool
    lowDetailSuspected: bool
    multipleFacesDetected: bool


class VerifyRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    matchId: UuidStr
    userId: UuidStr
    challengeId: UuidStr
    keyframeBase64: Annotated[
        str, Field(min_length=1, max_length=ANTI_CHEAT_MAX_KEYFRAME_BASE64_LENGTH)
    ]
    claimedFeatures: AuraFeatures


class VerifyResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    matchId: UuidStr
    userId: UuidStr
    challengeId: UuidStr
    discrepancy: Unit
    discrepancyConfidence: Unit
    liveness: LivenessFlags
    version: Literal[ANTI_CHEAT_VERSION]
    computedAt: IsoDatetimeStr
