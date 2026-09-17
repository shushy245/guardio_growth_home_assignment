"""Database access for the `breach` table. No business rules live here — only SQL."""

from collections.abc import Sequence
from datetime import datetime

from sqlalchemy import ColumnElement, func, or_, select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import InstrumentedAttribute, Session
from sqlalchemy.sql.elements import UnaryExpression

from app.breaches.models import BreachRow
from app.breaches.schemas import BreachListQuery, BreachSort, SortOrder
from app.ports.breach_catalog import Breach

_KEY_COLUMNS = frozenset({"name"})

# A lookup, not an if-chain: a new sortable column is one row here and one enum member, and
# mypy proves the map covers the enum.
_sort_column_map: dict[BreachSort, InstrumentedAttribute[object]] = {
    BreachSort.BREACH_DATE: BreachRow.breach_date,
    BreachSort.PWN_COUNT: BreachRow.pwn_count,
    BreachSort.NAME: BreachRow.name,
}

# The primary key, so appending it makes any sort total.
_TIEBREAKER: InstrumentedAttribute[object] = BreachRow.name


def latest_fetched_at(*, session: Session) -> datetime | None:
    """When the catalog was last stored, or `None` if it never has been.

    One `max()` over the column rather than a row read: every row in a sync shares one
    `fetched_at`, so the newest value is the age of the catalog as a whole.
    """
    return session.execute(select(func.max(BreachRow.fetched_at))).scalar_one()


def list_breaches(*, session: Session, query: BreachListQuery) -> tuple[list[BreachRow], int]:
    """One page of breaches plus the total behind it.

    The count and the page are built from one `select` so a filter can only ever apply to both —
    a `total` that disagrees with `items` is a number the screen states and cannot back up.
    """
    filtered = select(BreachRow).where(*_conditions(query))
    total = session.execute(select(func.count()).select_from(filtered.subquery())).scalar_one()
    rows = session.execute(
        filtered.order_by(*_order_by(sort=query.sort, order=query.order))
        .limit(query.limit)
        .offset((query.page - 1) * query.limit)
    ).scalars()

    return list(rows), total


def _conditions(query: BreachListQuery) -> list[ColumnElement[bool]]:
    """Every filter in one place, so the count and the page can only ever share them.

    Two query builders is how `total` drifts from `items` and the screen ends up stating a
    number it cannot back up.
    """
    conditions: list[ColumnElement[bool]] = [*_always_excluded()]
    if query.verified_only:
        conditions.append(BreachRow.is_verified.is_(True))
    if query.q is not None:
        conditions.append(_matches_text(query.q))
    if query.data_class is not None:
        # `@>` on the text[] column, which is what the GIN index can answer.
        conditions.append(BreachRow.data_classes.contains([query.data_class]))

    return conditions


def _always_excluded() -> list[ColumnElement[bool]]:
    """Retired and fabricated breaches are never served, with no parameter to turn it back on.

    They are HIBP's own disclaimers — a breach it withdrew, and one it believes was invented.
    A screen whose whole job is to be believed cannot repeat a claim its source has retracted,
    and there is no visitor for whom the answer is different. Both columns are NOT NULL, so
    `NOT` cannot silently drop rows through three-valued logic.
    """
    return [~BreachRow.is_retired, ~BreachRow.is_fabricated]


def _matches_text(q: str) -> ColumnElement[bool]:
    """The three strings a visitor can see or type. `title` is not redundant with `name`: HIBP
    shows `AcneOrg` as `Acne.org`, and they differ in 461 of 1,036 records.

    A NULL `domain` (54 records) yields NULL rather than false, which `OR` absorbs — so a
    domainless breach is still found by its name."""
    pattern = f"%{q}%"

    return or_(
        BreachRow.name.ilike(pattern),
        BreachRow.title.ilike(pattern),
        BreachRow.domain.ilike(pattern),
    )


def _order_by(*, sort: BreachSort, order: SortOrder) -> list[UnaryExpression[object]]:
    """`name` always closes the sort, and it is not decoration.

    LIMIT/OFFSET over a tied `breach_date` has no defined order in Postgres, so page 2 can repeat
    or skip rows page 1 already showed. `name` is the primary key, so appending it makes every
    sort total; when it *is* the sort key the second clause simply never decides anything.
    """
    column = _sort_column_map[sort]
    leading = column.desc() if order is SortOrder.DESC else column.asc()

    return [leading, _TIEBREAKER.asc()]


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
