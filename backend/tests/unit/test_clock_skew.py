"""The clock-skew rule at its edges — the only place the five minutes is pinned.

The endpoint's cases sit a minute and an hour from now, which proves a rule exists and nothing
about where it is: widening the allowance to thirty minutes, or forgiving one second more than
the constant says, leaves them green (BF84). Pure function, so bare asserts.
"""

from datetime import UTC, datetime, timedelta

from app.funnel_events.clock_skew import MAX_CLOCK_SKEW_AHEAD, is_too_far_ahead

NOW = datetime(2026, 9, 19, 12, 0, tzinfo=UTC)


def test_an_instant_exactly_at_the_allowance_is_still_forgiven() -> None:
    assert not is_too_far_ahead(NOW + MAX_CLOCK_SKEW_AHEAD, now=NOW)


def test_one_second_past_the_allowance_is_too_far_ahead() -> None:
    assert is_too_far_ahead(NOW + MAX_CLOCK_SKEW_AHEAD + timedelta(seconds=1), now=NOW)


def test_the_allowance_is_five_minutes() -> None:
    """Spelled out, because every other case is stated in terms of the constant and would follow
    it anywhere. Five minutes forgives a drifting browser clock; half an hour forgives a broken
    one, and the step is filed in an hour of the funnel it did not happen in."""
    assert timedelta(minutes=5) == MAX_CLOCK_SKEW_AHEAD


def test_an_instant_in_the_past_is_never_too_far_ahead() -> None:
    """No bound on the past, on purpose: the funnel is read per visitor and per step, never by
    time bucket, and a step queued behind a slow session is genuinely older than its arrival."""
    assert not is_too_far_ahead(NOW - timedelta(days=365), now=NOW)
