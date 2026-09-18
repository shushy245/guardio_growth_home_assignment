"""HTTP shell for feature flags. Validation is the schema's job, SQL is the repository's.

Reads are open: an unauthenticated `/admin` page is a harmless one. Only the write is gated.
"""

from typing import Annotated

import structlog
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.db.session import get_session
from app.feature_flags import repository
from app.feature_flags.schemas import FeatureFlagResponse

log = structlog.get_logger()

router = APIRouter()


@router.get("/feature-flags", response_model=list[FeatureFlagResponse])
def list_feature_flags(
    session: Annotated[Session, Depends(get_session)],
) -> list[FeatureFlagResponse]:
    return [
        FeatureFlagResponse.model_validate(row) for row in repository.list_flags(session=session)
    ]
