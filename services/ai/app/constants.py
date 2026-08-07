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

# Tetos de defesa em profundidade só deste lado (não têm equivalente no TS —
# ANTI_CHEAT_MAX_KEYFRAME_BASE64_LENGTH acima limita só o tamanho *comprimido*
# do base64; nada limitava o buffer de pixels já decodificado nem o tamanho
# do array `samples` de /score/aggregate).

# cv2.imdecode não tem guarda de decompression-bomb (ao contrário do
# Image.MAX_IMAGE_PIXELS do Pillow) — uma imagem comprimida bem abaixo de
# ANTI_CHEAT_MAX_KEYFRAME_BASE64_LENGTH pode decodificar pra um array de
# centenas de megapixels. Teto bem acima de qualquer resolução de webcam
# realista (ex. 1920x1080 = ~2MP).
VERIFY_MAX_IMAGE_MEGAPIXELS: Final[int] = 25

# Mesmo teto de MATCH_SCORE_SAMPLE_BUFFER_MAX_LENGTH (apps/api/src/scoring/
# scoring.constants.ts, default 2000) — /score/aggregate hoje só recebe o que
# o buffer do apps/api já limitou, mas sem teto aqui o endpoint aceitaria um
# array arbitrariamente grande de qualquer chamador.
SCORE_AGGREGATE_MAX_SAMPLES: Final[int] = 2000

# Folga generosa acima do maior payload real esperado (keyframe base64 de
# ANTI_CHEAT_MAX_KEYFRAME_BASE64_LENGTH ~390KB, ou SCORE_AGGREGATE_MAX_SAMPLES
# amostras de AuraFeatures ~150-200 bytes cada). Nada limitava o tamanho do
# corpo da requisição antes da validação Pydantic rodar.
MAX_REQUEST_BODY_BYTES: Final[int] = 2_000_000
