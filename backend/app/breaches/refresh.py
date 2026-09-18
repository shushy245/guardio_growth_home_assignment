"""Stale-while-revalidate for the stored catalog.

A breach request always answers from the database. When what is stored has aged past the sync
TTL, the request schedules one refresh to run *after* its response has gone out, so a visitor is
never made to wait on HIBP and a container that stays up for a week no longer serves a week-old
copy. The boot-time sync remains the first fill; this is what keeps it current afterwards.
"""

from datetime import datetime

import structlog
from sqlalchemy.orm import Session, sessionmaker

from app.breaches.staleness import should_sync
from app.breaches.sync import sync_catalog_in_own_transaction
from app.ports.breach_catalog import BreachCatalogPort

log = structlog.get_logger()


class CatalogRefresher:
    """One per process, built in the composition root and reached through `app.state`."""

    def __init__(self, *, catalog: BreachCatalogPort) -> None:
        self._catalog = catalog

    def wants_refresh(self, *, fetched_at: datetime | None, now: datetime) -> bool:
        return should_sync(fetched_at=fetched_at, now=now)

    def refresh(self, *, session_factory: sessionmaker[Session], now: datetime) -> None:
        """Runs after a response, on the request's worker thread, in a transaction of its own —
        the request's session is closed by the time this starts."""
        log.info("CatalogRefresher.refresh: started", now=now.isoformat())
        sync_catalog_in_own_transaction(
            session_factory=session_factory, catalog=self._catalog, now=now
        )
