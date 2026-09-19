"""Database access for the experiment read. Only SQL."""

from sqlalchemy import distinct, func, select
from sqlalchemy.orm import Session

from app.experiments.results import StepCount
from app.funnel_events.models import FunnelEventRow
from app.visitors.models import VisitorAssignmentRow


def count_visitors_per_step(*, session: Session, flag_key: str) -> list[StepCount]:
    """Distinct visitors per (arm, step), where the arm is the visitor's stored assignment.

    The join is on `visitor_assignment`, not on the event's own `variant_key`, although the
    event carries one. The primary key `(visitor_id, flag_key)` is what makes a visitor belong
    to exactly one arm; grouping by the event tag would let a visitor whose steps were tagged
    two ways be counted in both samples, which the z-test's independence assumption cannot
    survive. The tag stays the audit trail of what the visitor saw when the step happened.

    `count(distinct visitor_id)`: a retry, a replay with a fresh id or a double-fired effect is
    a second row for the same visitor, and a funnel counts people, not rows. A visitor with no
    assignment for this flag joins to nothing and is in neither arm.
    """
    rows = session.execute(
        select(
            VisitorAssignmentRow.variant_key,
            FunnelEventRow.name,
            func.count(distinct(FunnelEventRow.visitor_id)),
        )
        .join(FunnelEventRow, FunnelEventRow.visitor_id == VisitorAssignmentRow.visitor_id)
        .where(VisitorAssignmentRow.flag_key == flag_key)
        .group_by(VisitorAssignmentRow.variant_key, FunnelEventRow.name)
        .order_by(VisitorAssignmentRow.variant_key, FunnelEventRow.name)
    ).all()

    return [
        StepCount(variant_key=variant_key, step=step, visitors=visitors)
        for variant_key, step, visitors in rows
    ]
