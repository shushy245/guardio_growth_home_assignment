"""How far ahead of the server a browser's clock may run — a pure rule.

`occurred_at` is the client's clock, and browser clocks drift. A few minutes ahead is forgiven so
an honest visitor is never refused; an hour ahead is a broken clock or a forged timestamp, and
recording it would file the step in a future the funnel has not reached.

There is deliberately no bound on the past. S7 reads the funnel per visitor and per step, never
by time bucket, so an old instant changes no number the dashboard shows; a queued step that
waited on a slow session is genuinely older than its arrival, and refusing it would drop a real
step. Precondition, recorded so its violation is seen: the first time-bucketed read (events per
hour, a retention curve) is the moment this needs an `is_implausibly_old` beside it.
"""

from datetime import datetime, timedelta

MAX_CLOCK_SKEW_AHEAD = timedelta(minutes=5)


def is_too_far_ahead(occurred_at: datetime, *, now: datetime) -> bool:
    return occurred_at - now > MAX_CLOCK_SKEW_AHEAD
