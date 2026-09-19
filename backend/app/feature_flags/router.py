"""HTTP shell for feature flags. Validation is the schema's job, SQL is the repository's.

Reads are open: an unauthenticated `/admin` page is a harmless one. Only the write is gated.
"""

from typing import Annotated

import structlog
from fastapi import APIRouter, Depends, HTTPException, Path, status

from app.db.session import SessionDep
from app.feature_flags import repository
from app.feature_flags.admin import require_admin_token
from app.feature_flags.assignment import orphaned_variant_keys
from app.feature_flags.schemas import (
    FeatureFlagResponse,
    FeatureFlagUpdate,
    FeatureFlagUpdated,
    to_weighted_variants,
)
from app.visitors import repository as visitor_repository

log = structlog.get_logger()

router = APIRouter()


@router.get("/feature-flags", response_model=list[FeatureFlagResponse])
def list_feature_flags(
    session: SessionDep,
) -> list[FeatureFlagResponse]:
    return [
        FeatureFlagResponse.model_validate(row) for row in repository.list_flags(session=session)
    ]


@router.patch(
    "/feature-flags/{key}",
    response_model=FeatureFlagUpdated,
    dependencies=[Depends(require_admin_token)],
)
def update_feature_flag(
    key: Annotated[str, Path(min_length=1, max_length=64)],
    changes: FeatureFlagUpdate,
    session: SessionDep,
) -> FeatureFlagUpdated:
    """Optimistic lock: the write matches on the token the client read; zero rows is a 409 (or
    a 404 for a key that was never there). Returns only what the client cannot know.

    **The orphan guard races visitor creation, and that is accepted (BF71).** This transaction
    reads `visitor_assignment` and writes the flag under READ COMMITTED while a visitor is
    created in another, so a visitor assigned between the two statements can hold the very key
    this save removes. `SELECT … FOR UPDATE` here would not close it: a plain reader does not
    wait on a locked row, so visitor creation would have to take a share lock on every enabled
    flag — serialising the funnel's entry point against an admin write to protect one visitor.

    What that one visitor costs is bounded and safe. The experiment read counts visitors by the
    arm they hold, and a key the flag no longer defines is neither of the two the hypothesis
    names, so they fall out of both samples rather than into the wrong one; the result screen
    finds no variant for the key and shows the control copy. A stale assignment is a visitor
    outside the experiment, which is the same thing as a visitor who arrived while it was off.
    """
    token = changes.updated_at.isoformat()
    log.info(
        "update_feature_flag: started",
        key=key,
        token=token,
        is_enabled=changes.is_enabled,
        split={variant.key: variant.weight for variant in changes.variants},
    )
    orphans = orphaned_variant_keys(
        assigned=visitor_repository.list_assigned_variant_keys(session=session, flag_key=key),
        variants=to_weighted_variants(changes.variants),
    )
    if orphans:
        log.info(
            "update_feature_flag: refused, the split would orphan assignments",
            key=key,
            orphans=orphans,
        )
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                f"update_feature_flag: flag {key!r} would stop defining "
                f"{', '.join(repr(orphan) for orphan in orphans)}, which visitors are already "
                "assigned to; keep those keys, or retire the flag and start a new one"
            ),
        )

    new_token = repository.update_flag(session=session, key=key, changes=changes)
    if new_token is not None:
        log.info("update_feature_flag: saved", key=key, new_token=new_token.isoformat())

        return FeatureFlagUpdated(updated_at=new_token)

    if not repository.flag_exists(session=session, key=key):
        log.info("update_feature_flag: unknown flag", key=key)
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"update_feature_flag: no flag with key {key!r}",
        )

    log.info("update_feature_flag: optimistic lock conflict", key=key, token=token)
    raise HTTPException(
        status_code=status.HTTP_409_CONFLICT,
        detail=(
            f"update_feature_flag: optimistic lock conflict — key={key!r}, token={token} is no "
            "longer the stored updatedAt; reload the flag and retry"
        ),
    )
