"""Pull the catalog from whatever source is wired in and store it.

Takes the port as a parameter, so the composition root decides whether that is HIBP over HTTP or
an in-memory fake, and this module never learns the difference.
"""

from datetime import datetime

import structlog
from sqlalchemy.orm import Session

from app.breaches.repository import upsert_many
from app.ports.breach_catalog import BreachCatalogPort

log = structlog.get_logger()


def sync_breaches(*, session: Session, catalog: BreachCatalogPort, now: datetime) -> None:
    log.info("sync_breaches: started", now=now.isoformat())
    breaches = catalog.fetch_all()

    log.info("sync_breaches: storing the catalog", fetched=len(breaches))
    upsert_many(session=session, breaches=breaches, fetched_at=now)

    log.info("sync_breaches: completed", stored=len(breaches), fetched_at=now.isoformat())
