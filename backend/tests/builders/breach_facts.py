"""Builder for the handful of facts the summary works from.

The summary does not need a whole `Breach` — five fields decide every number on the result
screen — so it takes only those, and this builds them.
"""

from __future__ import annotations

from dataclasses import dataclass, replace
from datetime import UTC, date, datetime

from app.breaches.summary import BreachFacts


def breach_facts() -> _BreachFactsBuilder:
    return _BreachFactsBuilder()


@dataclass(frozen=True)
class _BreachFactsBuilder:
    name: str = "Adobe"
    title: str = "Adobe"
    breach_date: date = date(2013, 10, 4)
    pwn_count: int = 152_445_165
    data_classes: tuple[str, ...] = ("Email addresses", "Passwords")
    fetched_at: datetime = datetime(2026, 9, 18, 8, 0, tzinfo=UTC)

    def with_name(self, name: str) -> _BreachFactsBuilder:
        return replace(self, name=name, title=name)

    def with_breach_date(self, breach_date: date) -> _BreachFactsBuilder:
        return replace(self, breach_date=breach_date)

    def with_pwn_count(self, pwn_count: int) -> _BreachFactsBuilder:
        return replace(self, pwn_count=pwn_count)

    def with_data_classes(self, *data_classes: str) -> _BreachFactsBuilder:
        return replace(self, data_classes=data_classes)

    def with_fetched_at(self, fetched_at: datetime) -> _BreachFactsBuilder:
        return replace(self, fetched_at=fetched_at)

    def build(self) -> BreachFacts:
        return BreachFacts(
            name=self.name,
            title=self.title,
            breach_date=self.breach_date,
            pwn_count=self.pwn_count,
            data_classes=self.data_classes,
            fetched_at=self.fetched_at,
        )
