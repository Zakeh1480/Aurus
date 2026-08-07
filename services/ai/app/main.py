from fastapi import FastAPI

from app.body_size_limit import BodySizeLimitMiddleware
from app.constants import MAX_REQUEST_BODY_BYTES
from app.routers import health, score, verify


def create_app() -> FastAPI:
    app = FastAPI(title="AuraFarming AI Service")
    app.add_middleware(BodySizeLimitMiddleware, max_bytes=MAX_REQUEST_BODY_BYTES)
    app.include_router(health.router)
    app.include_router(score.router)
    app.include_router(verify.router)
    return app


app = create_app()
