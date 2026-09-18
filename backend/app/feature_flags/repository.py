"""Database access for the `feature_flag` table. No business rules live here — only SQL, and
the one narrowing step that turns the JSONB column into validated variants."""

from pydantic import TypeAdapter
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.feature_flags.assignment import FlagSplit
from app.feature_flags.models import FeatureFlagRow
from app.feature_flags.schemas import FeatureFlagVariant, to_weighted_variants

# Built once: a TypeAdapter compiles a validator, and this one runs on every visitor creation.
_stored_variants = TypeAdapter(list[FeatureFlagVariant])


def list_enabled_splits(*, session: Session) -> list[FlagSplit]:
    """Every enabled flag's split, in key order, so a visitor's assignments are deterministic."""
    rows = session.execute(
        select(FeatureFlagRow).where(FeatureFlagRow.is_enabled).order_by(FeatureFlagRow.key)
    ).scalars()

    return [
        FlagSplit(
            key=row.key,
            variants=tuple(to_weighted_variants(_stored_variants.validate_python(row.variants))),
        )
        for row in rows
    ]


def list_flags(*, session: Session) -> list[FeatureFlagRow]:
    return list(session.execute(select(FeatureFlagRow).order_by(FeatureFlagRow.key)).scalars())
