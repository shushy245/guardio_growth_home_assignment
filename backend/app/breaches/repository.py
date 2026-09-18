"""Database access for the `breach` table. No business rules live here — only SQL."""

from collections.abc import Sequence
from datetime import datetime

from sqlalchemy import func, select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import Session

from app.breaches.models import BreachRow
from app.breaches.query import (
    build_breach_facts_query,
    build_breach_order,
    build_breach_query,
    build_catalog_exists_query,
)
from app.breaches.schemas import BreachListQuery
from app.breaches.summary import BreachFacts
from app.ports.breach_catalog import Breach

_KEY_COLUMNS = frozenset({"name"})


def latest_fetched_at(*, session: Session) -> datetime | None:
    """When the catalog was last stored, or `None` if it never has been.

    One `max()` over the column rather than a row read: every row in a sync shares one
    `fetched_at`, so the newest value is the age of the catalog as a whole.
    """
    return session.execute(select(func.max(BreachRow.fetched_at))).scalar_one()


def list_breaches(*, session: Session, query: BreachListQuery) -> tuple[list[BreachRow], int]:
    """One page of breaches plus the total behind it.

    Which breaches are servable, and in what order, is `query.py`'s business; this function
    executes what it builds and counts the same statement it pages.
    """
    filtered = build_breach_query(query)
    total = session.execute(select(func.count()).select_from(filtered.subquery())).scalar_one()
    rows = session.execute(
        filtered.order_by(*build_breach_order(query))
        .limit(query.limit)
        .offset((query.page - 1) * query.limit)
    ).scalars()

    return list(rows), total


def has_any_servable_breach(*, session: Session) -> bool:
    return bool(session.execute(build_catalog_exists_query()).scalar_one())


def list_breach_facts(*, session: Session) -> list[BreachFacts]:
    """Every servable breach, as the six fields the summary needs.

    Loading the catalog to summarise it in Python rather than aggregating in SQL is a deliberate
    trade at 1,036 rows: the `unnest`-and-group form of the data-class ranking is far harder to
    read than the pure function, and far harder to test. Revisit it if the catalog grows an
    order of magnitude.
    """
    return [
        BreachFacts(
            name=name,
            title=title,
            breach_date=breach_date,
            pwn_count=pwn_count,
            data_classes=tuple(data_classes),
            fetched_at=fetched_at,
        )
        for name, title, breach_date, pwn_count, data_classes, fetched_at in session.execute(
            build_breach_facts_query()
        ).all()
    ]


def upsert_many(*, session: Session, breaches: Sequence[Breach], fetched_at: datetime) -> None:
    """Insert or update every breach in one statement, keyed on HIBP's stable `name`.

    Rows absent from `breaches` are left alone: HIBP does not delete breaches, and a sync that
    truncated first would empty the catalog for the length of its own transaction.
    """
    rows = _one_row_per_name(breaches, fetched_at=fetched_at)
    if not rows:
        return

    statement = insert(BreachRow).values(rows)
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


def _one_row_per_name(
    breaches: Sequence[Breach], *, fetched_at: datetime
) -> list[dict[str, object]]:
    """Last occurrence of each name wins.

    A single `INSERT … ON CONFLICT DO UPDATE` may not touch the same row twice — Postgres raises
    `CardinalityViolation` — so one duplicated name in the upstream payload would fail the whole
    sync rather than the one record. A dict keyed on name is the de-duplication and preserves
    insertion order, so "last wins" is the newest thing the source said.
    """
    return list(
        {breach.name: _to_row(breach, fetched_at=fetched_at) for breach in breaches}.values()
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
