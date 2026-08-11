import hmac
import os

from fastapi import Header, HTTPException, status


def verify_service_secret(x_ai_service_secret: str | None = Header(default=None)) -> None:
    expected = os.getenv("AI_SERVICE_SHARED_SECRET", "")
    if not expected or not x_ai_service_secret:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or missing service secret"
        )
    if hmac.compare_digest(x_ai_service_secret, expected):
        return
    previous_candidates = os.getenv("AI_SERVICE_SHARED_SECRET_PREVIOUS", "").split(",")
    for candidate in (c.strip() for c in previous_candidates):
        if candidate and hmac.compare_digest(x_ai_service_secret, candidate):
            return
    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or missing service secret"
    )
