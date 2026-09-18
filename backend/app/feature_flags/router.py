"""HTTP shell for feature flags. Validation is the schema's job, SQL is the repository's.

Reads are open: an unauthenticated `/admin` page is a harmless one. Only the write is gated.
"""

from typing import Annotated

import structlog
from fastapi import APIRouter, Depends, HTTPException, Path, status
from sqlalchemy.orm import Session

from app.db.session import get_session
from app.feature_flags import repository
from app.feature_flags.schemas import FeatureFlagResponse, FeatureFlagUpdate, FeatureFlagUpdated

log = structlog.get_logger()

router = APIRouter()


@router.get("/feature-flags", response_model=list[FeatureFlagResponse])
def list_feature_flags(
    session: Annotated[Session, Depends(get_session)],
) -> list[FeatureFlagResponse]:
    return [
        FeatureFlagResponse.model_validate(row) for row in repository.list_flags(session=session)
    ]


@router.patch("/feature-flags/{key}", response_model=FeatureFlagUpdated)
def update_feature_flag(
    key: Annotated[str, Path(min_length=1, max_length=64)],
    changes: FeatureFlagUpdate,
    session: Annotated[Session, Depends(get_session)],
) -> FeatureFlagUpdated:
    """Optimistic lock: the write matches on the token the client read; zero rows is a 409 (or
    a 404 for a key that was never there). Returns only what the client cannot know."""
    token = changes.updated_at.isoformat()
    log.info(
        "update_feature_flag: started",
        key=key,
        token=token,
        is_enabled=changes.is_enabled,
        split={variant.key: variant.weight for variant in changes.variants},
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
