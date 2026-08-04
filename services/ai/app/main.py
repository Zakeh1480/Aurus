from fastapi import FastAPI

from app.routers import health, score, verify


def create_app() -> FastAPI:
    app = FastAPI(title="AuraFarming AI Service")
    app.include_router(health.router)
    app.include_router(score.router)
    app.include_router(verify.router)
    return app


app = create_app()
