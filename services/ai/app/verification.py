import base64
import binascii
from dataclasses import dataclass
from datetime import datetime

import cv2
import numpy as np

from app.config import Settings, get_settings
from app.constants import ANTI_CHEAT_VERSION, VERIFY_MAX_IMAGE_MEGAPIXELS
from app.schemas import AuraFeatures, LivenessFlags, VerifyRequest, VerifyResponse
from app.utils.time import to_iso_z, utc_now_iso

_FACE_CASCADE = cv2.CascadeClassifier(cv2.data.haarcascades + "haarcascade_frontalface_default.xml")
_EYE_CASCADE = cv2.CascadeClassifier(cv2.data.haarcascades + "haarcascade_eye.xml")


DISCREPANCY_DIMENSION_WEIGHTS: dict[str, float] = {"presence": 0.6, "eyeContact": 0.4}


@dataclass(frozen=True)
class FacePresenceResult:
    faces_detected: int
    largest_face_area_ratio: float
    eyes_detected_in_largest_face: int


def decode_keyframe(keyframe_base64: str) -> np.ndarray:

    try:
        raw = base64.b64decode(keyframe_base64, validate=True)
    except (binascii.Error, ValueError) as exc:
        raise ValueError("keyframeBase64 não é base64 válido") from exc
    image = cv2.imdecode(np.frombuffer(raw, dtype=np.uint8), cv2.IMREAD_COLOR)
    if image is None:
        raise ValueError("keyframeBase64 não decodifica para uma imagem suportada (JPEG/PNG)")

    megapixels = (image.shape[0] * image.shape[1]) / 1_000_000
    if megapixels > VERIFY_MAX_IMAGE_MEGAPIXELS:
        raise ValueError(
            f"keyframe decodificado excede o limite de {VERIFY_MAX_IMAGE_MEGAPIXELS} megapixels"
        )
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
        return FacePresenceResult(
            faces_detected=0, largest_face_area_ratio=0.0, eyes_detected_in_largest_face=0
        )

    image_area = image_bgr.shape[0] * image_bgr.shape[1]
    x, y, w, h = max(faces, key=lambda f: f[2] * f[3])
    eyes = _EYE_CASCADE.detectMultiScale(gray[y : y + h, x : x + w])
    return FacePresenceResult(
        faces_detected=len(faces),
        largest_face_area_ratio=(w * h) / image_area if image_area > 0 else 0.0,
        eyes_detected_in_largest_face=len(eyes),
    )


def compute_blur_variance(image_bgr: np.ndarray) -> float:

    gray = cv2.cvtColor(image_bgr, cv2.COLOR_BGR2GRAY)
    return float(cv2.Laplacian(gray, cv2.CV_64F).var())


def compute_liveness_flags(
    face: FacePresenceResult, blur_variance: float, *, settings: Settings
) -> LivenessFlags:
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

    presence_diff = abs(claimed.presence - derive_presence_proxy(face, settings=settings))
    eye_diff = abs(claimed.eyeContact - derive_eye_contact_proxy(face))
    discrepancy = (
        presence_diff * DISCREPANCY_DIMENSION_WEIGHTS["presence"]
        + eye_diff * DISCREPANCY_DIMENSION_WEIGHTS["eyeContact"]
    )
    return min(1.0, discrepancy), sum(DISCREPANCY_DIMENSION_WEIGHTS.values())


def _computed_at(now: datetime | None) -> str:
    return utc_now_iso() if now is None else to_iso_z(now)


def verify(
    request: VerifyRequest, *, settings: Settings | None = None, now: datetime | None = None
) -> VerifyResponse:

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
