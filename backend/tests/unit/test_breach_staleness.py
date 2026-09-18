"""The sync TTL is a pure rule, so it is asserted directly — no clock, no database.

`now` is a parameter rather than a call to `datetime.now()` inside the rule: a rule that reads
the clock itself can only be tested by waiting.
"""

from datetime import UTC, datetime, timedelta

from app.breaches.staleness import should_retry, should_sync

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


def test_a_refresh_that_was_never_attempted_may_run() -> None:
    assert should_retry(last_attempt_at=None, now=NOW) is True


def test_a_refresh_attempted_a_minute_ago_is_not_retried() -> None:
    """A down HIBP is not re-fetched on every request: one attempt per interval, not per visitor."""
    assert should_retry(last_attempt_at=NOW - timedelta(minutes=1), now=NOW) is False


def test_a_refresh_attempted_exactly_a_retry_interval_ago_may_run_again() -> None:
    assert should_retry(last_attempt_at=NOW - timedelta(minutes=5), now=NOW) is True


def test_a_refresh_attempted_an_hour_ago_may_run_again() -> None:
    assert should_retry(last_attempt_at=NOW - timedelta(hours=1), now=NOW) is True
