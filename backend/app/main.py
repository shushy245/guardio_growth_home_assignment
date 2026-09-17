"""Composition root.

The only module that knows which concrete adapters exist. Everything else receives its
dependencies; tests build the same app with fakes.
"""

from fastapi import FastAPI

from app.errors import register_exception_handlers
from app.health.router import router as health_router
from app.logging import LogFormat, configure_logging
from app.middleware.correlation_id import CorrelationIdMiddleware
from app.probe.router import router as probe_router


def create_app() -> FastAPI:
    configure_logging(log_format=LogFormat.JSON)
    app = FastAPI(title="Breach Scan API")
    app.add_middleware(CorrelationIdMiddleware)
    register_exception_handlers(app)
    app.include_router(health_router, prefix="/api")
    app.include_router(probe_router, prefix="/api")
    return app
