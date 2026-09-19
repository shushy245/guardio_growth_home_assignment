"""Database access for the experiment read. Only SQL."""

from sqlalchemy import Select, func, select
from sqlalchemy.orm import Session

from app.experiments.results import StepPairCount
from app.funnel_events.models import FunnelEventName, FunnelEventRow
from app.visitors.models import VisitorAssignmentRow


def count_visitors_per_step_pair(*, session: Session, flag_key: str) -> list[StepPairCount]:
    """Distinct visitors per (arm, step, step), where the arm is the visitor's stored assignment.

    One row per ordered pair of steps a visitor reached, counting the visitors who reached
    **both**. The pair of a step with itself is the arm's count at that step — what the funnel
    is drawn from — and a pair of two different steps is what a rate is counted over. Counting
    the two halves of a rate separately is BF60: a visitor who recorded `activation` and never
    completed a scan lands in one count and not the other, which put the primary metric above
    100% and the pooled z-test under `sqrt` of a negative number.

    The join is on `visitor_assignment`, not on the event's own `variant_key`, although the
    event carries one. The primary key `(visitor_id, flag_key)` is what makes a visitor belong
    to exactly one arm; grouping by the event tag would let a visitor whose steps were tagged
    two ways be counted in both samples, which the z-test's independence assumption cannot
    survive. The tag stays the audit trail of what the visitor saw when the step happened.

    `distinct` in the CTE, not `count(distinct …)` in the outer query: a retry, a replay with a
    fresh id or a double-fired effect is a second row for the same visitor and step, and a
    funnel counts people, not rows. Collapsing them once, before the self-join, is what keeps
    one visitor's two `activation` rows from pairing twice against their one `scan_completed`.
    A visitor with no assignment for this flag joins to nothing and is in neither arm.
    """
    reached = _steps_reached(flag_key=flag_key).cte("reached")
    and_reached = reached.alias("and_reached")

    rows = session.execute(
        select(
            reached.c.variant_key,
            reached.c.step,
            and_reached.c.step,
            func.count(),
        )
        .join(and_reached, and_reached.c.visitor_id == reached.c.visitor_id)
        .group_by(reached.c.variant_key, reached.c.step, and_reached.c.step)
        .order_by(reached.c.variant_key, reached.c.step, and_reached.c.step)
    ).all()

    return [
        StepPairCount(variant_key=variant_key, reached=step, and_reached=also, visitors=visitors)
        for variant_key, step, also, visitors in rows
    ]


def _steps_reached(*, flag_key: str) -> Select[tuple[str, str, FunnelEventName]]:
    """One row per (arm, visitor, step) the flag's visitors reached, each exactly once."""
    return (
        select(
            VisitorAssignmentRow.variant_key.label("variant_key"),
            FunnelEventRow.visitor_id.label("visitor_id"),
            FunnelEventRow.name.label("step"),
        )
        .join(FunnelEventRow, FunnelEventRow.visitor_id == VisitorAssignmentRow.visitor_id)
        .where(VisitorAssignmentRow.flag_key == flag_key)
        .distinct()
    )
