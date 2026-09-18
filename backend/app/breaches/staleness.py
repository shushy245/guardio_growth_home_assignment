"""When the stored catalog is old enough to be worth re-fetching, and when a failed fetch may
be tried again.

Pure: no clock, no database, no HTTP. It lives apart from `sync.py` so a test of the rule does
not drag in SQLAlchemy, and so the two numbers that decide how often we call HIBP are readable
in one short file rather than buried in a handler.
"""

from datetime import datetime, timedelta

# HIBP publishes a handful of breaches a week. A day-old catalog is a day-old public record, not
# stale data about the visitor — nothing on the result screen changes meaning within 24 hours.
SYNC_TTL = timedelta(hours=24)
# How long a failed refresh keeps the next one from starting. Without it a down HIBP would be
# re-fetched by every request that finds the catalog stale — a retry storm aimed at a third party.
RETRY_INTERVAL = timedelta(minutes=5)


def should_sync(*, fetched_at: datetime | None, now: datetime) -> bool:
    """`fetched_at is None` means the catalog has never been fetched, which is never fresh."""
    if fetched_at is None:
        return True

    return now - fetched_at >= SYNC_TTL


def should_retry(*, last_attempt_at: datetime | None, now: datetime) -> bool:
    """`last_attempt_at is None` means no refresh has been attempted in this process yet."""
    if last_attempt_at is None:
        return True

    return now - last_attempt_at >= RETRY_INTERVAL
