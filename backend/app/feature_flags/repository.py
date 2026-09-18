"""Database access for the `feature_flag` table. No business rules live here — only SQL, and
the one narrowing step that turns the JSONB column into validated variants."""

from datetime import datetime

from pydantic import TypeAdapter
from sqlalchemy import func, select, update
from sqlalchemy.orm import Session

from app.feature_flags.assignment import FlagSplit
from app.feature_flags.models import FeatureFlagRow
from app.feature_flags.schemas import FeatureFlagUpdate, FeatureFlagVariant, to_weighted_variants

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


def update_flag(*, session: Session, key: str, changes: FeatureFlagUpdate) -> datetime | None:
    """One statement: write the new state where the stored token still matches, and hand back
    the new token. `None` means no row matched — the key is unknown or the token is stale, and
    the caller tells the two apart with `flag_exists`.

    `clock_timestamp()`, not `now()`: Postgres pins `now()` to the transaction start, so two
    writes inside one transaction would mint the same token and the second save could never be
    told from a replay of the first.
    """
    return session.execute(
        update(FeatureFlagRow)
        .where(FeatureFlagRow.key == key, FeatureFlagRow.updated_at == changes.updated_at)
        .values(
            description=changes.description,
            is_enabled=changes.is_enabled,
            variants=[
                variant.model_dump(mode="json", by_alias=True) for variant in changes.variants
            ],
            updated_at=func.clock_timestamp(),
        )
        .returning(FeatureFlagRow.updated_at)
    ).scalar_one_or_none()


def flag_exists(*, session: Session, key: str) -> bool:
    return (
        session.execute(select(FeatureFlagRow.key).where(FeatureFlagRow.key == key)).first()
        is not None
    )
