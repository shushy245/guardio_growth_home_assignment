"""Database access for the `visitor` and `visitor_assignment` tables. Only SQL."""

from sqlalchemy import insert
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
