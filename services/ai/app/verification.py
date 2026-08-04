"""Núcleo de verificação anti-cheat (Prompt 6b) — puro, sem qualquer import
de FastAPI/HTTP, mesmo padrão de app/scoring.py.

Reavalia server-side um único keyframe contra as features reivindicadas pelo
cliente, usando heurísticas OpenCV de baixo custo (Haar cascade + variância
de Laplaciano) em vez de um modelo de ML completo — decisão de Prompt 6b:
verificação por amostragem exige custo/latência baixos, ao contrário da
extração completa de landmarks (que continua no cliente, via MediaPipe WASM,
por custo + LGPD — CLAUDE.md regra 5).

`posture`/`expression`/`movement` não são reavaliáveis por este heurístico
single-frame de baixo custo (exigiriam pose estimation completa) — só
`presence`/`eyeContact` contribuem para o `discrepancy`.
"""

import base64
import binascii
from dataclasses import dataclass
from datetime import datetime

import cv2
import numpy as np

from app.config import Settings, get_settings
from app.constants import ANTI_CHEAT_VERSION
from app.schemas import AuraFeatures, LivenessFlags, VerifyRequest, VerifyResponse
from app.utils.time import to_iso_z, utc_now_iso

_FACE_CASCADE = cv2.CascadeClassifier(cv2.data.haarcascades + "haarcascade_frontalface_default.xml")
_EYE_CASCADE = cv2.CascadeClassifier(cv2.data.haarcascades + "haarcascade_eye.xml")

# Únicas dimensões que este heurístico consegue aproximar — pesos somam 1.0.
DISCREPANCY_DIMENSION_WEIGHTS: dict[str, float] = {"presence": 0.6, "eyeContact": 0.4}


@dataclass(frozen=True)
class FacePresenceResult:
    faces_detected: int
    largest_face_area_ratio: float  # área do maior rosto / área total da imagem
    eyes_detected_in_largest_face: int


def decode_keyframe(keyframe_base64: str) -> np.ndarray:
    """Decodifica um base64 (JPEG/PNG) para uma imagem BGR do OpenCV.

    Levanta ValueError em base64 corrompido ou bytes que não formam uma
    imagem suportada — a camada HTTP mapeia isso para 422.
    """
    try:
        raw = base64.b64decode(keyframe_base64, validate=True)
    except (binascii.Error, ValueError) as exc:
        raise ValueError("keyframeBase64 não é base64 válido") from exc
    image = cv2.imdecode(np.frombuffer(raw, dtype=np.uint8), cv2.IMREAD_COLOR)
    if image is None:
        raise ValueError("keyframeBase64 não decodifica para uma imagem suportada (JPEG/PNG)")
    return image


def detect_face_presence(image_bgr: np.ndarray, *, settings: Settings) -> FacePresenceResult:
    gray = cv2.cvtColor(image_bgr, cv2.COLOR_BGR2GRAY)
    gray = cv2.equalizeHist(gray)
    faces = _FACE_CASCADE.detectMultiScale(
        gray,
        scaleFactor=settings.verify_haar_scale_factor,
        minNeighbors=settings.verify_haar_min_neighbors,
    )
    if len(faces) == 0:
        return FacePresenceResult(faces_detected=0, largest_face_area_ratio=0.0, eyes_detected_in_largest_face=0)

    image_area = image_bgr.shape[0] * image_bgr.shape[1]
    x, y, w, h = max(faces, key=lambda f: f[2] * f[3])
    eyes = _EYE_CASCADE.detectMultiScale(gray[y : y + h, x : x + w])
    return FacePresenceResult(
        faces_detected=len(faces),
        largest_face_area_ratio=(w * h) / image_area if image_area > 0 else 0.0,
        eyes_detected_in_largest_face=len(eyes),
    )


def compute_blur_variance(image_bgr: np.ndarray) -> float:
    """Variância do Laplaciano em grayscale — proxy clássico de nitidez/textura.

    NÃO é uma medida temporal: mede só se ESTE frame parece uma foto
    impressa, uma tela reexibida ou algo muito liso/comprimido. A comparação
    entre múltiplos frames ao longo da partida (detectar replay/loop) é
    responsabilidade do AntiCheatModule (apps/api), não deste endpoint
    stateless de frame único.
    """
    gray = cv2.cvtColor(image_bgr, cv2.COLOR_BGR2GRAY)
    return float(cv2.Laplacian(gray, cv2.CV_64F).var())


def compute_liveness_flags(face: FacePresenceResult, blur_variance: float, *, settings: Settings) -> LivenessFlags:
    return LivenessFlags(
        noFaceDetected=face.faces_detected == 0,
        staticImageSuspected=blur_variance < settings.verify_blur_variance_static_threshold,
        lowDetailSuspected=blur_variance < settings.verify_blur_variance_low_detail_threshold,
        multipleFacesDetected=face.faces_detected > 1,
    )


def derive_presence_proxy(face: FacePresenceResult, *, settings: Settings) -> float:
    if face.faces_detected == 0:
        return 0.0
    if settings.verify_face_min_area_ratio <= 0:
        return 1.0
    return max(0.0, min(1.0, face.largest_face_area_ratio / settings.verify_face_min_area_ratio))


def derive_eye_contact_proxy(face: FacePresenceResult) -> float:
    if face.faces_detected == 0:
        return 0.0
    if face.eyes_detected_in_largest_face >= 2:
        return 1.0
    if face.eyes_detected_in_largest_face == 1:
        return 0.5
    return 0.0


def compute_discrepancy(
    claimed: AuraFeatures, face: FacePresenceResult, *, settings: Settings
) -> tuple[float, float]:
    """Retorna (discrepancy, confidence).

    confidence = soma dos pesos das dimensões reavaliáveis (hoje sempre
    1.0 — existe para permitir reduzir peso dinamicamente no futuro sem
    quebrar o contrato de resposta).
    """
    presence_diff = abs(claimed.presence - derive_presence_proxy(face, settings=settings))
    eye_diff = abs(claimed.eyeContact - derive_eye_contact_proxy(face))
    discrepancy = (
        presence_diff * DISCREPANCY_DIMENSION_WEIGHTS["presence"]
        + eye_diff * DISCREPANCY_DIMENSION_WEIGHTS["eyeContact"]
    )
    return min(1.0, discrepancy), sum(DISCREPANCY_DIMENSION_WEIGHTS.values())


def _computed_at(now: datetime | None) -> str:
    return utc_now_iso() if now is None else to_iso_z(now)


def verify(request: VerifyRequest, *, settings: Settings | None = None, now: datetime | None = None) -> VerifyResponse:
    """Orquestração pura — decodifica, detecta, deriva discrepancy+liveness.

    Levanta ValueError em base64/imagem inválidos (a camada HTTP mapeia
    para 422).
    """
    settings = settings or get_settings()
    image = decode_keyframe(request.keyframeBase64)
    face = detect_face_presence(image, settings=settings)
    blur_variance = compute_blur_variance(image)
    liveness = compute_liveness_flags(face, blur_variance, settings=settings)
    discrepancy, confidence = compute_discrepancy(request.claimedFeatures, face, settings=settings)
    return VerifyResponse(
        matchId=request.matchId,
        userId=request.userId,
        challengeId=request.challengeId,
        discrepancy=discrepancy,
        discrepancyConfidence=confidence,
        liveness=liveness,
        version=ANTI_CHEAT_VERSION,
        computedAt=_computed_at(now),
    )
