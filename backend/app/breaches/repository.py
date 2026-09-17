"""Database access for the `breach` table. No business rules live here — only SQL."""

from collections.abc import Sequence
from datetime import datetime

from sqlalchemy import func, select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import Session

from app.breaches.models import BreachRow
from app.ports.breach_catalog import Breach

_KEY_COLUMNS = frozenset({"name"})


def latest_fetched_at(*, session: Session) -> datetime | None:
    """When the catalog was last stored, or `None` if it never has been.

    One `max()` over the column rather than a row read: every row in a sync shares one
    `fetched_at`, so the newest value is the age of the catalog as a whole.
    """
    return session.execute(select(func.max(BreachRow.fetched_at))).scalar_one()


def upsert_many(*, session: Session, breaches: Sequence[Breach], fetched_at: datetime) -> None:
    """Insert or update every breach in one statement, keyed on HIBP's stable `name`.

    Rows absent from `breaches` are left alone: HIBP does not delete breaches, and a sync that
    truncated first would empty the catalog for the length of its own transaction.
    """
    if not breaches:
        return

    statement = insert(BreachRow).values(
        [_to_row(breach, fetched_at=fetched_at) for breach in breaches]
    )
    session.execute(
        statement.on_conflict_do_update(
            index_elements=[BreachRow.name],
            # Derived from the table, not hand-listed: a column added later cannot be forgotten
            # here, which is how `fetched_at` would silently stop advancing and pin the TTL open.
            set_={
                column.name: statement.excluded[column.name]
                for column in BreachRow.__table__.columns
                if column.name not in _KEY_COLUMNS
            },
        )
    )


def _to_row(breach: Breach, *, fetched_at: datetime) -> dict[str, object]:
    """Domain value → column mapping. `data_classes` is a tuple in the model and an array column."""
    return {
        "name": breach.name,
        "title": breach.title,
        "domain": breach.domain,
        "breach_date": breach.breach_date,
        "added_date": breach.added_date,
        "modified_date": breach.modified_date,
        "pwn_count": breach.pwn_count,
        "description": breach.description,
        "logo_path": breach.logo_path,
        "data_classes": list(breach.data_classes),
        "is_verified": breach.is_verified,
        "is_fabricated": breach.is_fabricated,
        "is_sensitive": breach.is_sensitive,
        "is_retired": breach.is_retired,
        "is_spam_list": breach.is_spam_list,
        "is_malware": breach.is_malware,
        "is_subscription_free": breach.is_subscription_free,
        "is_stealer_log": breach.is_stealer_log,
        "attribution": breach.attribution,
        "disclosure_url": breach.disclosure_url,
        "fetched_at": fetched_at,
    }
