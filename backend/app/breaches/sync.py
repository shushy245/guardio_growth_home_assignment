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


def sync_catalog_best_effort(
    *, session: Session, catalog: BreachCatalogPort, now: datetime
) -> None:
    """Sync if stale, but never let a failure reach the caller.

    Called at boot and by the request-path refresher. An unreachable catalog is answered by the
    endpoints with a 503 that names the reason; a crash loop at boot, or a background task that
    dies, would hide the same fact — and at boot it would take down a catalog we may already
    hold perfectly good rows for.
    """
    try:
        sync_breaches_if_stale(session=session, catalog=catalog, now=now)
    except BreachCatalogError:
        log.exception("sync_catalog_best_effort: catalog unavailable, serving what is stored")
    except SQLAlchemyError:
        # The database too, not just the source. Catching only `BreachCatalogError` left the
        # docstring's promise half-true: a rejected write escaped the lifespan and aborted
        # uvicorn's startup, turning one bad record into the crash loop this exists to avoid.
        log.exception("sync_catalog_best_effort: could not store the catalog, serving what is held")


def sync_catalog_in_own_transaction(
    *, session_factory: sessionmaker[Session], catalog: BreachCatalogPort, now: datetime
) -> None:
    """The whole sync, transaction included — the unit the lifespan and the refresher both call.

    It lives here rather than inline in the lifespan so it can be tested: a lifespan body is
    reachable only by booting an app, and a boot that writes for real cannot run inside the
    savepoint harness. Opening the transaction here is load-bearing — without the commit the
    sync runs, appears to succeed, and rolls back.

    **Known, accepted:** the HIBP call happens *inside* this transaction, so the connection sits
    idle-in-transaction for up to `HIBP_TIMEOUT_SECONDS`. That is tolerable only while compose
    runs a single worker and at most one sync runs at a time — boot completes before the first
    request, and the refresher is single-flight per process — the S2 review flagged it and it is
    deferred in the plan's RF-backlog. **Adding a worker is what makes it a real problem; split
    the read and the write into two transactions then.**
    """
    with session_factory.begin() as session:
        sync_catalog_best_effort(session=session, catalog=catalog, now=now)
