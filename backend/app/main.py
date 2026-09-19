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

from app.breaches.refresh import CatalogRefresher
from app.breaches.router import router as breaches_router
from app.breaches.sync import sync_catalog_in_own_transaction
from app.config import Settings
from app.db.engine import build_engine, build_session_factory
from app.errors import register_exception_handlers
from app.feature_flags.router import router as feature_flags_router
from app.funnel_events.router import router as funnel_events_router
from app.health.router import router as health_router
from app.logging import configure_logging
from app.middleware.correlation_id import CorrelationIdMiddleware
from app.ports.breach_catalog import BreachCatalogPort
from app.signups.password_hash import PasswordHasher
from app.signups.router import router as signups_router
from app.visitors.router import router as visitors_router


def create_app(settings: Settings, *, catalog: BreachCatalogPort) -> FastAPI:
    configure_logging(log_format=settings.log_format)
    session_factory = build_session_factory(build_engine(database_url=settings.database_url))

    @asynccontextmanager
    async def lifespan(_app: FastAPI) -> AsyncIterator[None]:
        """Sync the catalog before the first request, so nobody is served an empty table while a
        fetch is in flight. Blocking here is the point: the app is not ready until it is."""
        sync_catalog_in_own_transaction(
            session_factory=session_factory, catalog=catalog, now=datetime.now(UTC)
        )
        yield

    app = FastAPI(title="Breach Scan API", lifespan=lifespan)
    app.state.settings = settings
    app.state.session_factory = session_factory
    app.state.catalog_refresher = CatalogRefresher(catalog=catalog)
    # Built once: the parameters are parsed at construction, and every request hashes with it.
    app.state.password_hasher = PasswordHasher()
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
    app.include_router(visitors_router, prefix="/api")
    app.include_router(feature_flags_router, prefix="/api")
    app.include_router(funnel_events_router, prefix="/api")
    app.include_router(signups_router, prefix="/api")
    return app
