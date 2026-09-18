"""Stale-while-revalidate for the stored catalog.

A breach request always answers from the database. When what is stored has aged past the sync
TTL, the request schedules one refresh to run *after* its response has gone out, so a visitor is
never made to wait on HIBP and a container that stays up for a week no longer serves a week-old
copy. The boot-time sync remains the first fill; this is what keeps it current afterwards.
"""

import threading
from datetime import datetime

import structlog
from sqlalchemy.orm import Session, sessionmaker

from app.breaches.staleness import should_retry, should_sync
from app.breaches.sync import sync_catalog_in_own_transaction
from app.ports.breach_catalog import BreachCatalogPort

log = structlog.get_logger()


class CatalogRefresher:
    """One per process, built in the composition root and reached through `app.state`.

    A class because the in-flight lock and the last attempt time are state no caller may
    bypass: two requests that find the catalog stale in the same window must become one fetch,
    not two fetches and two concurrent upserts of the same rows; and a down HIBP is attempted
    once per retry interval, not once per visitor. Both are per process; a second worker would
    need them in the database (recorded in ADR-0002's amendment).
    """

    def __init__(self, *, catalog: BreachCatalogPort) -> None:
        self._catalog = catalog
        self._in_flight = threading.Lock()
        self._last_attempt_at: datetime | None = None

    def wants_refresh(self, *, fetched_at: datetime | None, now: datetime) -> bool:
        if self._is_in_flight():
            return False
        if not should_retry(last_attempt_at=self._last_attempt_at, now=now):
            return False

        return should_sync(fetched_at=fetched_at, now=now)

    def refresh(self, *, session_factory: sessionmaker[Session], now: datetime) -> None:
        """Runs after a response, on the request's worker thread, in a transaction of its own —
        the request's session is closed by the time this starts.

        Non-blocking acquire: a refresh that finds another in flight returns at once rather than
        queueing behind it to fetch the same catalog again the moment it finishes.

        The retry gate is checked again here, under the lock, not only in `wants_refresh`: a
        request checks it when it schedules, milliseconds before the task runs, so a cohort of
        requests that all passed before the first attempt failed would otherwise each fetch a
        fast-failing HIBP in turn (BF22).
        """
        if not self._in_flight.acquire(blocking=False):
            log.info("CatalogRefresher.refresh: a refresh is already in flight, skipping")
            return

        try:
            if not should_retry(last_attempt_at=self._last_attempt_at, now=now):
                log.info(
                    "CatalogRefresher.refresh: inside the retry interval of a failed attempt, "
                    "skipping",
                    last_attempt_at=_isoformat_or_never(self._last_attempt_at),
                )
                return

            self._last_attempt_at = now
            log.info("CatalogRefresher.refresh: started", now=now.isoformat())
            sync_catalog_in_own_transaction(
                session_factory=session_factory, catalog=self._catalog, now=now
            )
        finally:
            self._in_flight.release()

    def _is_in_flight(self) -> bool:
        return self._in_flight.locked()


def _isoformat_or_never(at: datetime | None) -> str:
    return "never" if at is None else at.isoformat()
