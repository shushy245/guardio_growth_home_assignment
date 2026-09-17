"""When the stored catalog is old enough to be worth re-fetching.

Pure: no clock, no database, no HTTP. It lives apart from `sync.py` so a test of the rule does
not drag in SQLAlchemy, and so the one number that decides how often we call HIBP is readable in
a five-line file rather than buried in a handler.
"""

from datetime import datetime, timedelta

# HIBP publishes a handful of breaches a week. A day-old catalog is a day-old public record, not
# stale data about the visitor — nothing on the result screen changes meaning within 24 hours.
SYNC_TTL = timedelta(hours=24)


def should_sync(*, fetched_at: datetime | None, now: datetime) -> bool:
    """`fetched_at is None` means the catalog has never been fetched, which is never fresh."""
    if fetched_at is None:
        return True

    return now - fetched_at >= SYNC_TTL
