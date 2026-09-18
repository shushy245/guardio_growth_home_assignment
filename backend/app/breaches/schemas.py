"""The wire contract for the breach endpoints.

Pydantic models in the route signature are the boundary: the handler never sees a raw query
string or an unvalidated int, and an out-of-range `limit` is a 400 before any SQL runs. Field
names are snake_case here and camelCase on the wire through one alias generator, so the two
vocabularies never have to be kept in step by hand.
"""

from datetime import date, datetime
from enum import StrEnum

from pydantic import BaseModel, ConfigDict, Field
from pydantic.alias_generators import to_camel

DEFAULT_PAGE = 1
DEFAULT_LIMIT = 20
# A ceiling, not a preference: an unbounded `limit` lets one request ask for the whole table and
# turns the list contract back into the client-side filtering it exists to prevent.
MAX_LIMIT = 100

_wire = ConfigDict(alias_generator=to_camel, populate_by_name=True)


class BreachSort(StrEnum):
    """The sortable columns, named as the wire names them.

    An enum rather than a free string: an unrecognised value has to be a 400, because silently
    falling back to the default sort is a screen showing a different order than it claims to.
    """

    BREACH_DATE = "breachDate"
    PWN_COUNT = "pwnCount"
    NAME = "name"


class SortOrder(StrEnum):
    ASC = "asc"
    DESC = "desc"


class BreachListQuery(BaseModel):
    """No `populate_by_name`: the wire spelling is the only accepted spelling, so there is one
    contract to document rather than two that drift."""

    model_config = ConfigDict(alias_generator=to_camel, extra="forbid")

    page: int = Field(default=DEFAULT_PAGE, ge=1)
    limit: int = Field(default=DEFAULT_LIMIT, ge=1, le=MAX_LIMIT)
    sort: BreachSort = BreachSort.BREACH_DATE
    order: SortOrder = SortOrder.DESC
    # Free text over the three strings a visitor can see or type; `data_class` is one of the
    # values the list itself hands back, so it is matched exactly.
    q: str | None = Field(default=None, min_length=1, max_length=100)
    data_class: str | None = Field(default=None, min_length=1, max_length=100)
    verified_only: bool = False


class BreachResponse(BaseModel):
    """One breach as the result screen needs it.

    The exclusion flags (`is_retired`, `is_fabricated`) are deliberately absent: they decide
    server-side which rows exist at all, and a client that could see them would be tempted to
    filter on them itself.
    """

    model_config = ConfigDict(**_wire, from_attributes=True)

    name: str
    title: str
    domain: str | None
    breach_date: date
    pwn_count: int
    description: str
    logo_path: str
    data_classes: list[str]
    is_verified: bool
    is_sensitive: bool


class BreachPage(BaseModel):
    """The list envelope. Queries return the resource bare; pagination metadata is the exception
    the house rule names, because `total` is the one thing the client cannot compute."""

    model_config = _wire

    items: list[BreachResponse]
    total: int
    page: int
    limit: int


class BreachHighlightResponse(BaseModel):
    model_config = ConfigDict(**_wire, from_attributes=True)

    name: str
    title: str
    breach_date: date
    pwn_count: int


class DataClassCountResponse(BaseModel):
    model_config = ConfigDict(**_wire, from_attributes=True)

    data_class: str
    breach_count: int


class BreachSummaryResponse(BaseModel):
    """The result screen's tiles. Every field is present or the response does not exist: an
    absent largest breach would mean an empty catalog, which is a 503, not a summary."""

    model_config = ConfigDict(**_wire, from_attributes=True)

    total_breaches: int
    total_accounts_exposed: int
    breaches_last_12_months: int
    share_exposing_passwords: float
    top_data_classes: list[DataClassCountResponse]
    largest_breach: BreachHighlightResponse
    most_recent_breach: BreachHighlightResponse
    synced_at: datetime
