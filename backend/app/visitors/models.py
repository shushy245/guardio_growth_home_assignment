"""The `visitor` and `visitor_assignment` tables.

An assignment is stored, not recomputed: the row is what a visitor was shown, and it stays that
way when product changes the weights later. The primary key (visitor, flag) means a visitor can
hold at most one variant per flag, which is what makes per-variant funnel counts additive.
"""

from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class VisitorRow(Base):
    __tablename__ = "visitor"

    id: Mapped[str] = mapped_column(Text, primary_key=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    user_agent: Mapped[str | None] = mapped_column(Text)


class VisitorAssignmentRow(Base):
    __tablename__ = "visitor_assignment"

    visitor_id: Mapped[str] = mapped_column(Text, ForeignKey("visitor.id"), primary_key=True)
    flag_key: Mapped[str] = mapped_column(Text, ForeignKey("feature_flag.key"), primary_key=True)
    variant_key: Mapped[str] = mapped_column(Text)
    assigned_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
