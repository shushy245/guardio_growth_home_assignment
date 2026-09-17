"""Composition root.

The only module that knows which concrete adapters exist. Everything else receives its
dependencies; tests build the same app with fakes.
"""

from fastapi import FastAPI

from app.health.router import router as health_router


def create_app() -> FastAPI:
    app = FastAPI(title="Breach Scan API")
    app.include_router(health_router, prefix="/api")
    return app
