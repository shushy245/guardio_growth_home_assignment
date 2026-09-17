"""Pull the catalog from whatever source is wired in and store it.

Takes the port as a parameter, so the composition root decides whether that is HIBP over HTTP or
an in-memory fake, and this module never learns the difference.
"""

from datetime import datetime

import structlog
from sqlalchemy.orm import Session

from app.breaches.repository import latest_fetched_at, upsert_many
from app.breaches.staleness import should_sync
from app.ports.breach_catalog import BreachCatalogPort

log = structlog.get_logger()


def sync_breaches(*, session: Session, catalog: BreachCatalogPort, now: datetime) -> None:
    log.info("sync_breaches: started", now=now.isoformat())
    breaches = catalog.fetch_all()

    log.info("sync_breaches: storing the catalog", fetched=len(breaches))
    upsert_many(session=session, breaches=breaches, fetched_at=now)

    log.info("sync_breaches: completed", stored=len(breaches), fetched_at=now.isoformat())


def sync_breaches_if_stale(*, session: Session, catalog: BreachCatalogPort, now: datetime) -> None:
    """The startup path: pull the catalog only when what we hold has aged past the TTL.

    Sequential restarts inside one window cost nothing. Two workers booting at genuinely the same
    instant would both see an empty table and both fetch — harmless, because the upsert is
    idempotent — so no advisory lock is warranted while compose runs a single worker.
    """
    fetched_at = latest_fetched_at(session=session)
    last_fetch = "never" if fetched_at is None else fetched_at.isoformat()

    if not should_sync(fetched_at=fetched_at, now=now):
        log.info("sync_breaches_if_stale: catalog is fresh, skipping", last_fetch=last_fetch)
        return

    log.info("sync_breaches_if_stale: catalog is stale, syncing", last_fetch=last_fetch)
    sync_breaches(session=session, catalog=catalog, now=now)
