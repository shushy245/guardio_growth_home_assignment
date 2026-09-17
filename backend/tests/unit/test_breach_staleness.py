"""The sync TTL is a pure rule, so it is asserted directly — no clock, no database.

`now` is a parameter rather than a call to `datetime.now()` inside the rule: a rule that reads
the clock itself can only be tested by waiting.
"""

from datetime import UTC, datetime, timedelta

from app.breaches.staleness import should_sync

NOW = datetime(2026, 9, 18, 12, 0, tzinfo=UTC)


def test_a_catalog_that_has_never_been_fetched_must_sync() -> None:
    assert should_sync(fetched_at=None, now=NOW) is True


def test_a_catalog_fetched_an_hour_ago_is_still_fresh() -> None:
    assert should_sync(fetched_at=NOW - timedelta(hours=1), now=NOW) is False


def test_a_catalog_fetched_just_under_a_day_ago_is_still_fresh() -> None:
    assert should_sync(fetched_at=NOW - timedelta(hours=23, minutes=59), now=NOW) is False


def test_a_catalog_fetched_exactly_a_day_ago_must_sync() -> None:
    """The boundary belongs to the stale side: at the TTL the catalog has earned a re-fetch."""
    assert should_sync(fetched_at=NOW - timedelta(hours=24), now=NOW) is True


def test_a_catalog_fetched_a_week_ago_must_sync() -> None:
    assert should_sync(fetched_at=NOW - timedelta(days=7), now=NOW) is True
