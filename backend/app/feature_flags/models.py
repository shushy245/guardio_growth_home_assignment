"""The `feature_flag` table.

One row per flag; the variants live in a JSONB column rather than a child table because they
are read and written as one unit — the admin page saves the whole list, and the assignment rule
walks the whole list — and a product-owned experiment toggle has no reason to be joined.

`updated_at` is the optimistic-lock token: a PATCH carries the value it read and the update
matches on it, so two operators editing the same flag cannot silently overwrite each other.
"""

from datetime import datetime

from sqlalchemy import Boolean, DateTime, Text, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class FeatureFlagRow(Base):
    __tablename__ = "feature_flag"

    key: Mapped[str] = mapped_column(Text, primary_key=True)
    description: Mapped[str] = mapped_column(Text)
    is_enabled: Mapped[bool] = mapped_column(Boolean)
    # Raw JSON at this layer: the repository narrows it through the variant schema, so nothing
    # past the boundary ever works with an unvalidated dict.
    variants: Mapped[list[object]] = mapped_column(JSONB)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
