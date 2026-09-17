"""Pull the catalog from whatever source is wired in and store it.

Takes the port as a parameter, so the composition root decides whether that is HIBP over HTTP or
an in-memory fake, and this module never learns the difference.
"""

from datetime import datetime

import structlog
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session, sessionmaker

from app.breaches.repository import latest_fetched_at, upsert_many
from app.breaches.staleness import should_sync
from app.ports.breach_catalog import BreachCatalogError, BreachCatalogPort

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


def sync_catalog_at_startup(*, session: Session, catalog: BreachCatalogPort, now: datetime) -> None:
    """Sync on boot, but never fail the boot over it.

    An unreachable catalog is answered by the endpoints with a 503 that names the reason. A
    crash loop instead would hide the same fact behind a container that never comes up, and it
    would take down a catalog we may already hold perfectly good rows for.
    """
    try:
        sync_breaches_if_stale(session=session, catalog=catalog, now=now)
    except BreachCatalogError:
        log.exception("sync_catalog_at_startup: catalog unavailable, serving what is stored")
    except SQLAlchemyError:
        # The database too, not just the source. Catching only `BreachCatalogError` left the
        # docstring's promise half-true: a rejected write escaped the lifespan and aborted
        # uvicorn's startup, turning one bad record into the crash loop this exists to avoid.
        log.exception("sync_catalog_at_startup: could not store the catalog, serving what is held")


def sync_catalog_on_boot(
    *, session_factory: sessionmaker[Session], catalog: BreachCatalogPort, now: datetime
) -> None:
    """The whole boot-time sync, transaction included.

    It lives here rather than inline in the lifespan so it can be tested: a lifespan body is
    reachable only by booting an app, and a boot that writes for real cannot run inside the
    savepoint harness. Opening the transaction here is load-bearing — without the commit the
    sync runs, appears to succeed, and rolls back.

    **Known, accepted:** the HIBP call happens *inside* this transaction, so the connection sits
    idle-in-transaction for up to `HIBP_TIMEOUT_SECONDS`. That is tolerable only while compose
    runs a single worker and this is the only boot-time writer — the S2 review flagged it and it
    is deferred in the plan's RF-backlog. **Adding a worker, or a second boot-time sync, is what
    makes it a real problem; split the read and the write into two transactions then.**
    """
    with session_factory.begin() as session:
        sync_catalog_at_startup(session=session, catalog=catalog, now=now)
