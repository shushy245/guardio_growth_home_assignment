"""Application wiring.

`create_app` receives its outside-world dependencies rather than constructing them: `app/asgi.py`
is the process entrypoint and the one place the real HIBP adapter is named, and tests pass a
fake. The database is the exception — it is reached per request through the overridable
`get_session` dependency, so the engine is still built here from settings; the catalog is reached
during startup, where no dependency seam exists, so it has to come in through the door.
"""

from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from datetime import UTC, datetime

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.breaches.router import router as breaches_router
from app.breaches.sync import sync_catalog_on_boot
from app.config import Settings
from app.db.engine import build_engine, build_session_factory
from app.errors import register_exception_handlers
from app.health.router import router as health_router
from app.logging import configure_logging
from app.middleware.correlation_id import CorrelationIdMiddleware
from app.ports.breach_catalog import BreachCatalogPort


def create_app(settings: Settings, *, catalog: BreachCatalogPort) -> FastAPI:
    configure_logging(log_format=settings.log_format)
    session_factory = build_session_factory(build_engine(database_url=settings.database_url))

    @asynccontextmanager
    async def lifespan(_app: FastAPI) -> AsyncIterator[None]:
        """Sync the catalog before the first request, so nobody is served an empty table while a
        fetch is in flight. Blocking here is the point: the app is not ready until it is."""
        sync_catalog_on_boot(
            session_factory=session_factory, catalog=catalog, now=datetime.now(UTC)
        )
        yield

    app = FastAPI(title="Breach Scan API", lifespan=lifespan)
    app.state.session_factory = session_factory
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
    app.include_router(breaches_router, prefix="/api")
    return app
