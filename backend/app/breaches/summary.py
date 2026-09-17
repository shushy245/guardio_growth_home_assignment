"""The numbers on the result screen: how much of the public record is exposure, and whose.

Pure — no database, no clock. `today` arrives as a parameter because a "last 12 months" rule that
reads the clock itself can only be tested on the day the test happens to run.

It works from `BreachFacts` rather than whole breaches: five fields decide every tile, so the
summary never learns what a description or a logo path is, and a test states five values instead
of twenty-one.
"""

from collections import Counter
from collections.abc import Sequence
from dataclasses import dataclass
from datetime import date, timedelta

# 365 days rather than a calendar year: the calendar form has to answer what 29 February minus a
# year means, and no tile on the screen is worth that question.
RECENT_WINDOW = timedelta(days=365)
TOP_DATA_CLASSES = 5
PASSWORDS_CLASS = "Passwords"
# A share is read as a percentage with one decimal at most; four places is room to spare and
# makes the value stable to compare.
SHARE_PLACES = 4


@dataclass(frozen=True)
class BreachFacts:
    """What one breach contributes to the summary."""

    name: str
    title: str
    breach_date: date
    pwn_count: int
    data_classes: tuple[str, ...]


@dataclass(frozen=True)
class DataClassCount:
    data_class: str
    breach_count: int


@dataclass(frozen=True)
class BreachHighlight:
    name: str
    title: str
    breach_date: date
    pwn_count: int


@dataclass(frozen=True)
class BreachSummary:
    total_breaches: int
    total_accounts_exposed: int
    breaches_last_12_months: int
    share_exposing_passwords: float
    top_data_classes: tuple[DataClassCount, ...]
    largest_breach: BreachHighlight
    most_recent_breach: BreachHighlight


def summarise_breaches(breaches: Sequence[BreachFacts], *, today: date) -> BreachSummary | None:
    """`None` when there is nothing to summarise.

    The alternative — zeroes and an absent largest breach — is a screen stating that no breaches
    exist, which is the opposite of what an empty catalog means. The caller answers 503 instead.
    """
    if not breaches:
        return None

    return BreachSummary(
        total_breaches=len(breaches),
        total_accounts_exposed=sum(breach.pwn_count for breach in breaches),
        breaches_last_12_months=sum(1 for breach in breaches if _is_recent(breach, today=today)),
        share_exposing_passwords=round(
            sum(1 for breach in breaches if _exposed_passwords(breach)) / len(breaches),
            SHARE_PLACES,
        ),
        top_data_classes=_rank_data_classes(breaches),
        largest_breach=_highlight(min(breaches, key=_largest_first)),
        most_recent_breach=_highlight(min(breaches, key=_most_recent_first)),
    )


def _is_recent(breach: BreachFacts, *, today: date) -> bool:
    """The window is open at its far end: a breach exactly a year old is no longer recent."""
    return breach.breach_date > today - RECENT_WINDOW


def _exposed_passwords(breach: BreachFacts) -> bool:
    return PASSWORDS_CLASS in breach.data_classes


def _largest_first(breach: BreachFacts) -> tuple[int, str]:
    """Descending accounts exposed, then name — so a tie always resolves to the same breach."""
    return (-breach.pwn_count, breach.name)


def _most_recent_first(breach: BreachFacts) -> tuple[int, str]:
    return (-breach.breach_date.toordinal(), breach.name)


def _rank_data_classes(breaches: Sequence[BreachFacts]) -> tuple[DataClassCount, ...]:
    """Most breaches first, then alphabetical.

    `Counter.most_common` breaks a tie by insertion order, which here is the row order of a
    query — so the same catalog could rank two equally common classes differently on two calls.
    """
    counts = Counter(data_class for breach in breaches for data_class in breach.data_classes)
    ranked = sorted(counts.items(), key=lambda item: (-item[1], item[0]))

    return tuple(
        DataClassCount(data_class=data_class, breach_count=count)
        for data_class, count in ranked[:TOP_DATA_CLASSES]
    )


def _highlight(breach: BreachFacts) -> BreachHighlight:
    return BreachHighlight(
        name=breach.name,
        title=breach.title,
        breach_date=breach.breach_date,
        pwn_count=breach.pwn_count,
    )
