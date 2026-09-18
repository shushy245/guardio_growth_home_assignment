"""Which experiment an event belongs to — a pure rule over the visitor's stored assignments.

One `flag_key` / `variant_key` pair per event tags the one running experiment. A visitor holding
two assignments cannot be tagged by one pair, and picking either would silently misfile every
event of theirs; the rule refuses instead. When a second experiment runs, the row grows a JSONB
`assignments` snapshot or one row per flag — and this function is the one place that changes.
"""

from collections.abc import Mapping
from dataclasses import dataclass


@dataclass(frozen=True)
class ExperimentTag:
    flag_key: str
    variant_key: str


def experiment_tag(assignments: Mapping[str, str]) -> ExperimentTag | None:
    """`None` for a visitor outside every experiment; the pair for one assignment."""
    if not assignments:
        return None

    if len(assignments) > 1:
        msg = (
            f"experiment_tag: visitor holds {len(assignments)} assignments "
            f"({', '.join(sorted(assignments))}); one flag/variant pair per event cannot tag "
            "them all — see app/funnel_events/tagging.py"
        )
        raise ValueError(msg)

    ((flag_key, variant_key),) = assignments.items()

    return ExperimentTag(flag_key=flag_key, variant_key=variant_key)
