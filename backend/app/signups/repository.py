"""Database access for the `signup` table. Only SQL."""

from dataclasses import dataclass
from datetime import datetime

from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import Session

from app.signups.models import Plan, SignupRow


@dataclass(frozen=True)
class NewSignup:
    """Everything the row needs, computed before the write — the handler's "transform before
    write" step made into a value. `visitor_id` is `None` for a browser the server cannot
    place (see `router.py`)."""

    id: str
    visitor_id: str | None
    email: str
    plan: Plan
    password_hash: str
    password_was_pwned: bool


@dataclass(frozen=True)
class InsertedSignup:
    id: str
    created_at: datetime


def insert_signup(*, session: Session, signup: NewSignup) -> InsertedSignup | None:
    """The row written, or `None` when the email is already taken.

    `ON CONFLICT (email) DO NOTHING` is the whole duplicate check: two requests for the same
    email in the same instant both pass a read-then-insert, and only the unique index refuses
    the second. `RETURNING` yields a row only for an insert that happened.
    """
    row = session.execute(
        insert(SignupRow)
        .values(
            id=signup.id,
            visitor_id=signup.visitor_id,
            email=signup.email,
            plan=signup.plan,
            password_hash=signup.password_hash,
            password_was_pwned=signup.password_was_pwned,
        )
        .on_conflict_do_nothing(index_elements=[SignupRow.email])
        .returning(SignupRow.id, SignupRow.created_at)
    ).one_or_none()
    if row is None:
        return None

    return InsertedSignup(id=row.id, created_at=row.created_at)
