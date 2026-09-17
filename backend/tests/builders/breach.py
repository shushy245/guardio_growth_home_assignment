"""Builder for a domain `Breach` — the far side of the adapter boundary.

`tests/builders/hibp_breach.py` builds the wire shape; this builds what the application works
with. A test states only the field it cares about; every default is valid.
"""

from __future__ import annotations

from dataclasses import dataclass, replace
from datetime import UTC, date, datetime

from app.ports.breach_catalog import Breach


def a_breach() -> _BreachBuilder:
    return _BreachBuilder()


@dataclass(frozen=True)
class _BreachBuilder:
    name: str = "Adobe"
    title: str = "Adobe"
    domain: str | None = "adobe.com"
    breach_date: date = date(2013, 10, 4)
    added_date: datetime = datetime(2013, 12, 4, tzinfo=UTC)
    modified_date: datetime = datetime(2022, 5, 15, 23, 52, 49, tzinfo=UTC)
    pwn_count: int = 152_445_165
    description: str = "Adobe accounts were exposed, along with password hints."
    logo_path: str = "https://logos.haveibeenpwned.com/Adobe.png"
    data_classes: tuple[str, ...] = ("Email addresses", "Password hints", "Passwords")
    is_verified: bool = True
    is_fabricated: bool = False
    is_sensitive: bool = False
    is_retired: bool = False
    is_spam_list: bool = False
    is_malware: bool = False
    is_subscription_free: bool = False
    is_stealer_log: bool = False
    attribution: str | None = None
    disclosure_url: str | None = None

    def with_name(self, name: str) -> _BreachBuilder:
        return replace(self, name=name)

    def with_title(self, title: str) -> _BreachBuilder:
        return replace(self, title=title)

    def with_breach_date(self, breach_date: date) -> _BreachBuilder:
        return replace(self, breach_date=breach_date)

    def with_pwn_count(self, pwn_count: int) -> _BreachBuilder:
        return replace(self, pwn_count=pwn_count)

    def build(self) -> Breach:
        return Breach(
            name=self.name,
            title=self.title,
            domain=self.domain,
            breach_date=self.breach_date,
            added_date=self.added_date,
            modified_date=self.modified_date,
            pwn_count=self.pwn_count,
            description=self.description,
            logo_path=self.logo_path,
            data_classes=self.data_classes,
            is_verified=self.is_verified,
            is_fabricated=self.is_fabricated,
            is_sensitive=self.is_sensitive,
            is_retired=self.is_retired,
            is_spam_list=self.is_spam_list,
            is_malware=self.is_malware,
            is_subscription_free=self.is_subscription_free,
            is_stealer_log=self.is_stealer_log,
            attribution=self.attribution,
            disclosure_url=self.disclosure_url,
        )
