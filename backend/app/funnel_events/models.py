"""The `funnel_event` table: one row per step a visitor took, tagged with the experiment.

The primary key is minted by the client. That is what makes the write idempotent — a retry, a
StrictMode double-run or a replay carries the same id and lands on `ON CONFLICT DO NOTHING` —
and it is why the boundary schema, not the table, decides what a well-formed id looks like.

`flag_key` and `variant_key` are denormalised from `visitor_assignment` at write time ("tag every
step"): the dashboard groups events by variant without a join, and the tag records what the
visitor was in when the step happened. Both are nullable: a visitor who arrived while the flag
was disabled holds no assignment, and their steps are still funnel steps.
"""

from datetime import datetime
from enum import StrEnum

from sqlalchemy import DateTime, Enum, ForeignKey, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class FunnelEventName(StrEnum):
    """The six steps of the funnel, in order. The experiment's primary metric is
    `ACTIVATION / SCAN_COMPLETED`; `CTA_CLICK` is the secondary."""

    LANDING_VIEW = "landing_view"
    SCAN_STARTED = "scan_started"
    SCAN_COMPLETED = "scan_completed"
    CTA_CLICK = "cta_click"
    SIGNUP_STARTED = "signup_started"
    ACTIVATION = "activation"


class FunnelEventRow(Base):
    __tablename__ = "funnel_event"

    id: Mapped[str] = mapped_column(Text, primary_key=True)
    visitor_id: Mapped[str] = mapped_column(Text, ForeignKey("visitor.id"), index=True)
    # Stored as text under a CHECK constraint rather than a Postgres enum type: a new step is a
    # constraint change in a migration, not an `ALTER TYPE` that some tools cannot run inside a
    # transaction. `values_callable` stores the wire value (`landing_view`); SQLAlchemy's
    # default is the member *name* (`LANDING_VIEW`), which no query outside Python would guess.
    name: Mapped[FunnelEventName] = mapped_column(
        Enum(
            FunnelEventName,
            native_enum=False,
            create_constraint=True,
            name="funnel_event_name",
            values_callable=lambda members: [member.value for member in members],
        )
    )
    flag_key: Mapped[str | None] = mapped_column(Text, ForeignKey("feature_flag.key"), index=True)
    variant_key: Mapped[str | None] = mapped_column(Text)
    # The client's clock, bounded by the handler's skew guard — not the server's receipt time.
    occurred_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    # `metadata` is reserved on every declarative class (`Base.metadata`), so the attribute
    # carries a suffix while the column keeps the plan's name.
    metadata_: Mapped[dict[str, object]] = mapped_column("metadata", JSONB)
