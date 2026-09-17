"""Composition root.

The only module that knows which concrete adapters exist. Everything else receives its
dependencies; tests build the same app with fakes. `app/asgi.py` is the process entrypoint that
reads the real environment and calls `create_app`.
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import Settings
from app.db.engine import build_engine, build_session_factory
from app.errors import register_exception_handlers
from app.health.router import router as health_router
from app.logging import configure_logging
from app.middleware.correlation_id import CorrelationIdMiddleware
from app.probe.router import router as probe_router


def create_app(settings: Settings) -> FastAPI:
    configure_logging(log_format=settings.log_format)
    app = FastAPI(title="Breach Scan API")
    app.state.session_factory = build_session_factory(
        build_engine(database_url=settings.database_url)
    )
    app.add_middleware(CorrelationIdMiddleware)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=[settings.frontend_origin],
        allow_credentials=True,
        allow_methods=["GET", "POST", "PATCH"],
        allow_headers=["Content-Type", "X-Admin-Token", "X-Correlation-Id"],
    )
    register_exception_handlers(app)
    app.include_router(health_router, prefix="/api")
    app.include_router(probe_router, prefix="/api")
    return app
