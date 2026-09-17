"""The breach catalog port: what the application needs from a breach source, in our vocabulary.

`Breach` is the currency the port trades in, so it lives here rather than in a feature package —
`app/breaches/` and `app/adapters/hibp/` both depend on this module and never on each other. This
module imports nothing from the database, the web framework or any HTTP client, which is what
makes "HIBP is replaceable by one adapter file" true rather than aspirational.
"""

from dataclasses import dataclass
from datetime import date, datetime
from typing import Protocol


@dataclass(frozen=True)
class Breach:
    """One breach as the application understands it. `name` is HIBP's stable identifier."""

    name: str
    title: str
    domain: str | None
    breach_date: date
    added_date: datetime
    modified_date: datetime
    pwn_count: int
    description: str
    logo_path: str
    data_classes: tuple[str, ...]
    is_verified: bool
    is_fabricated: bool
    is_sensitive: bool
    is_retired: bool
    is_spam_list: bool
    is_malware: bool
    is_subscription_free: bool
    is_stealer_log: bool
    attribution: str | None
    disclosure_url: str | None


class BreachCatalogError(Exception):
    """The catalog source could not be read: unreachable, refused, or no longer our shape.

    One error type for every way a source can fail, so callers decide once — serve what is
    stored, or fail visibly — without knowing which adapter is behind the port.
    """


class BreachCatalogPort(Protocol):
    """A source of breaches. `tests/fakes/breach_catalog.py` is the in-memory implementation."""

    def fetch_all(self) -> list[Breach]:
        """Every breach the source knows about, or `BreachCatalogError` if it cannot say."""
        ...
