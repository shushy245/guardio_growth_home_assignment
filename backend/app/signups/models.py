"""The `signup` table: one row per account the mock sign-up created.

`email` is stored lower-cased and unique, so the same person spelt two ways is one account and a
second attempt is a 409 from the index — never a read-then-insert that two concurrent requests
could both pass. `visitor_id` is nullable on purpose: the funnel fails open when the visitor
service is down (ADR-0004), and the purchase step must not dead-end on it; a signup with no
visitor is a customer the experiment cannot attribute, not a refused customer.

`password_hash` is Argon2id (`password_hash.py`) and `password_was_pwned` is what the browser's
k-anonymity check found at sign-up time, persisted as sent — the read is "how many chose a leaked
password anyway", so it has to be the browser's answer, not a re-check.
"""

from datetime import datetime
from enum import StrEnum

from sqlalchemy import Boolean, DateTime, Enum, ForeignKey, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class Plan(StrEnum):
    """The two plans the mock offers. Wire values; the frontend's `Plan` enum carries the same."""

    BASIC = "basic"
    FAMILY = "family"


class SignupRow(Base):
    __tablename__ = "signup"

    id: Mapped[str] = mapped_column(Text, primary_key=True)
    visitor_id: Mapped[str | None] = mapped_column(Text, ForeignKey("visitor.id"), index=True)
    email: Mapped[str] = mapped_column(Text, unique=True)
    # Text under a CHECK constraint, storing the wire value — see `funnel_event.name` for why.
    plan: Mapped[Plan] = mapped_column(
        Enum(
            Plan,
            native_enum=False,
            create_constraint=True,
            name="signup_plan",
            values_callable=lambda members: [member.value for member in members],
        )
    )
    password_hash: Mapped[str] = mapped_column(Text)
    password_was_pwned: Mapped[bool] = mapped_column(Boolean)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
