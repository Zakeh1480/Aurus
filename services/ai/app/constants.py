"""Espelho manual de packages/shared/src/constants.ts.

Python não importa o pacote TS `@aurafarming/shared` diretamente, então estas
constantes são mantidas à mão em sincronia com o lado TypeScript. O teste
`tests/test_constants.py` replica o guard-test que já existe em
`packages/shared/test/constants.test.ts` (pesos somam 1.0, chaves batem com
os schemas) para flagrar divergência.
"""

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

# Espelho manual de ANTI_CHEAT_VERSION / ANTI_CHEAT_MAX_KEYFRAME_BASE64_LENGTH
# (packages/shared/src/constants.ts) — Prompt 6b.
ANTI_CHEAT_VERSION: Final[str] = "anti-cheat-v1"

ANTI_CHEAT_MAX_KEYFRAME_BASE64_LENGTH: Final[int] = 400_000
