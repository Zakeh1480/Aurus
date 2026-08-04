from fastapi import APIRouter

from app.constants import AURA_SCORE_VERSION

router = APIRouter()


@router.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok", "auraScoreVersion": AURA_SCORE_VERSION}
