"""The wire contract for the breach endpoints.

Pydantic models in the route signature are the boundary: the handler never sees a raw query
string or an unvalidated int, and an out-of-range `limit` is a 400 before any SQL runs. Field
names are snake_case here and camelCase on the wire through one alias generator, so the two
vocabularies never have to be kept in step by hand.
"""

from datetime import date

from pydantic import BaseModel, ConfigDict, Field
from pydantic.alias_generators import to_camel

DEFAULT_PAGE = 1
DEFAULT_LIMIT = 20
# A ceiling, not a preference: an unbounded `limit` lets one request ask for the whole table and
# turns the list contract back into the client-side filtering it exists to prevent.
MAX_LIMIT = 100

_wire = ConfigDict(alias_generator=to_camel, populate_by_name=True)


class BreachListQuery(BaseModel):
    model_config = ConfigDict(extra="forbid")

    page: int = Field(default=DEFAULT_PAGE, ge=1)
    limit: int = Field(default=DEFAULT_LIMIT, ge=1, le=MAX_LIMIT)


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
