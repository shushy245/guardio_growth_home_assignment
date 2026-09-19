"""The experiment's read, assembled from counted rows — pure once the rows are in hand.

`StepCount` is the shape the repository hands back: one row per (arm, step) that at least one
visitor reached. A step nobody in an arm reached has no row, and the assembly reads absence as
zero rather than asking the database to invent empty groups.
"""

from dataclasses import dataclass

from app.funnel_events.models import FunnelEventName


@dataclass(frozen=True)
class StepCount:
    """How many distinct visitors in one arm reached one step."""

    variant_key: str
    step: FunnelEventName
    visitors: int
