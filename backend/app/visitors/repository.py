"""Database access for the `visitor` and `visitor_assignment` tables. Only SQL."""

from sqlalchemy import insert, select
from sqlalchemy.orm import Session

from app.visitors.models import VisitorAssignmentRow, VisitorRow


def insert_visitor(*, session: Session, visitor_id: str, user_agent: str | None) -> None:
    session.execute(insert(VisitorRow).values(id=visitor_id, user_agent=user_agent))


def insert_assignments(*, session: Session, visitor_id: str, assignments: dict[str, str]) -> None:
    if not assignments:
        return

    session.execute(
        insert(VisitorAssignmentRow).values(
            [
                {"visitor_id": visitor_id, "flag_key": flag_key, "variant_key": variant_key}
                for flag_key, variant_key in assignments.items()
            ]
        )
    )


def list_assigned_variant_keys(*, session: Session, flag_key: str) -> set[str]:
    """Every variant key visitors currently hold for this flag — what a rename would orphan."""
    return set(
        session.execute(
            select(VisitorAssignmentRow.variant_key)
            .where(VisitorAssignmentRow.flag_key == flag_key)
            .distinct()
        ).scalars()
    )


def find_assignments(*, session: Session, visitor_id: str) -> dict[str, str] | None:
    """`{ flag_key: variant_key }` for a known visitor; `None` for one that does not exist.

    One outer join, so a visitor with no assignments (every flag was disabled when they
    arrived) is an empty mapping and not mistaken for an unknown visitor.
    """
    rows = session.execute(
        select(VisitorRow.id, VisitorAssignmentRow.flag_key, VisitorAssignmentRow.variant_key)
        .outerjoin(VisitorAssignmentRow, VisitorAssignmentRow.visitor_id == VisitorRow.id)
        .where(VisitorRow.id == visitor_id)
    ).all()
    if not rows:
        return None

    return {flag_key: variant_key for _, flag_key, variant_key in rows if flag_key is not None}
