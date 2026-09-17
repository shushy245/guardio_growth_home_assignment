"""The `breach` table.

Table classes carry a `Row` suffix so they never collide with the domain model of the same name
(`app.ports.breach_catalog.Breach`): `sync.py` holds both in one scope and the reader must always
know which side of the boundary a value is on.

Every boolean is `NOT NULL`. A nullable boolean would make `WHERE NOT is_retired` silently drop
rows under SQL's three-valued logic — the default exclusions would quietly shrink the catalog.
"""

from datetime import date, datetime

from sqlalchemy import ARRAY, BigInteger, Date, DateTime, Index, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class BreachRow(Base):
    __tablename__ = "breach"
    __table_args__ = (
        # GIN is the index type that can answer `data_classes @> ARRAY['Passwords']`.
        Index("ix_breach_data_classes", "data_classes", postgresql_using="gin"),
    )

    name: Mapped[str] = mapped_column(Text, primary_key=True)
    title: Mapped[str] = mapped_column(Text)
    domain: Mapped[str | None] = mapped_column(Text)
    breach_date: Mapped[date] = mapped_column(Date, index=True)
    added_date: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    modified_date: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    # BigInteger, not Integer: the largest breach on record is 1.96B accounts, already 91% of
    # int4's ceiling. One more mega-breach overflows a column that would be painful to widen.
    pwn_count: Mapped[int] = mapped_column(BigInteger, index=True)
    description: Mapped[str] = mapped_column(Text)
    logo_path: Mapped[str] = mapped_column(Text)
    data_classes: Mapped[list[str]] = mapped_column(ARRAY(Text))
    is_verified: Mapped[bool]
    is_fabricated: Mapped[bool]
    is_sensitive: Mapped[bool]
    is_retired: Mapped[bool]
    is_spam_list: Mapped[bool]
    is_malware: Mapped[bool]
    is_subscription_free: Mapped[bool]
    is_stealer_log: Mapped[bool]
    attribution: Mapped[str | None] = mapped_column(Text)
    disclosure_url: Mapped[str | None] = mapped_column(Text)
    # When this row last came back from the catalog source; drives the 24h sync TTL.
    fetched_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
