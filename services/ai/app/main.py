from fastapi import FastAPI

from app.routers import health, score


def create_app() -> FastAPI:
    app = FastAPI(title="AuraFarming AI Service")
    app.include_router(health.router)
    app.include_router(score.router)
    return app


app = create_app()
