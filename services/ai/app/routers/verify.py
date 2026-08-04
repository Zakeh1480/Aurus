from fastapi import APIRouter, HTTPException

from app.schemas import VerifyRequest, VerifyResponse
from app.verification import verify

router = APIRouter()


@router.post("/verify", response_model=VerifyResponse)
def verify_keyframe(payload: VerifyRequest) -> VerifyResponse:
    try:
        return verify(payload)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
