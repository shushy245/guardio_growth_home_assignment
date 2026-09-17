"""Which breaches the catalog will serve, and in what order.

These are rules, not database access: what counts as a text match, which breaches are never
shown, what makes an ordering total. They build a statement and never execute one, so the
repository is left with nothing but `session.execute`, and the docstring on each rule is the
place a reader looks to find out why the list behaves as it does.
"""

from datetime import date

from sqlalchemy import ColumnElement, Select, exists, or_, select
from sqlalchemy.orm import InstrumentedAttribute
from sqlalchemy.sql.elements import UnaryExpression

from app.breaches.models import BreachRow
from app.breaches.schemas import BreachListQuery, BreachSort, SortOrder

# A lookup, not an if-chain: a new sortable column is one row here and one enum member, and
# mypy proves the map covers the enum.
_sort_column_map: dict[BreachSort, InstrumentedAttribute[object]] = {
    BreachSort.BREACH_DATE: BreachRow.breach_date,
    BreachSort.PWN_COUNT: BreachRow.pwn_count,
    BreachSort.NAME: BreachRow.name,
}

# The primary key, so appending it makes any sort total.
_TIEBREAKER: InstrumentedAttribute[object] = BreachRow.name


def build_breach_query(query: BreachListQuery) -> Select[tuple[BreachRow]]:
    """The filtered set — unordered and unpaged, because the count and the page both start here.

    Two query builders is how `total` drifts from `items` and the screen ends up stating a
    number it cannot back up. There is one.
    """
    return select(BreachRow).where(*_conditions(query))


def build_breach_facts_query() -> Select[tuple[str, str, date, int, list[str]]]:
    """The whole servable catalog, reduced to the five fields the summary works from.

    It shares `servable_conditions` with the list, so the tiles and the rows underneath them can
    never disagree about which breaches exist. It deliberately ignores the list's filters: the
    tiles describe the public record, not the visitor's current view of it.
    """
    return select(
        BreachRow.name,
        BreachRow.title,
        BreachRow.breach_date,
        BreachRow.pwn_count,
        BreachRow.data_classes,
    ).where(*servable_conditions())


def build_catalog_exists_query() -> Select[tuple[bool]]:
    """Whether the catalog holds anything servable at all.

    This is the difference between "your filter matched nothing" and "we are not holding the
    public record", which are different facts and must not share a status code.
    """
    return select(exists(select(BreachRow.name).where(*servable_conditions())))


def build_breach_order(query: BreachListQuery) -> list[UnaryExpression[object]]:
    """`name` always closes the sort, and it is not decoration.

    LIMIT/OFFSET over a tied `breach_date` has no defined order in Postgres, so page 2 can repeat
    or skip rows page 1 already showed. `name` is the primary key, so appending it makes every
    sort total; when it *is* the sort key the second clause simply never decides anything.
    """
    column = _sort_column_map[query.sort]
    leading = column.desc() if query.order is SortOrder.DESC else column.asc()

    return [leading, _TIEBREAKER.asc()]


def _conditions(query: BreachListQuery) -> list[ColumnElement[bool]]:
    conditions: list[ColumnElement[bool]] = [*servable_conditions()]
    if query.verified_only:
        conditions.append(BreachRow.is_verified.is_(True))
    if query.q is not None:
        conditions.append(_matches_text(query.q))
    if query.data_class is not None:
        # `@>` on the text[] column, which is what the GIN index can answer.
        conditions.append(BreachRow.data_classes.contains([query.data_class]))

    return conditions


def servable_conditions() -> list[ColumnElement[bool]]:
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
