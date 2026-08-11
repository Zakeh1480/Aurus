from fastapi import FastAPI

from app.body_size_limit import BodySizeLimitMiddleware
from app.config import get_settings
from app.constants import MAX_REQUEST_BODY_BYTES
from app.rate_limit import RateLimitMiddleware
from app.routers import health, score, verify


def create_app() -> FastAPI:
    app = FastAPI(title="AuraFarming AI Service")
    settings = get_settings()
    app.add_middleware(
        RateLimitMiddleware,
        max_requests=settings.rate_limit_max_requests,
        window_seconds=settings.rate_limit_window_seconds,
    )
    app.add_middleware(BodySizeLimitMiddleware, max_bytes=MAX_REQUEST_BODY_BYTES)
    app.include_router(health.router)
    app.include_router(score.router)
    app.include_router(verify.router)
    return app


app = create_app()
