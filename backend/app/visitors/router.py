"""HTTP shell for visitors. Assignment is the pure rule's job, SQL is the repository's.

`POST` is the one place a visitor is assigned. Everything is computed first — the id, every
enabled flag's variant — and written last, in one transaction, so a visitor row never exists
without the assignments the response reports.
"""

from typing import Annotated

import structlog
from fastapi import APIRouter, Depends, Request, Response, status
from sqlalchemy.orm import Session

from app.config import Settings
from app.db.session import get_session
from app.dependencies import get_settings
from app.feature_flags import repository as flag_repository
from app.feature_flags.assignment import assign_all
from app.shared.ids import generate_unique_id
from app.visitors import repository
from app.visitors.cookie import VISITOR_COOKIE, VISITOR_COOKIE_MAX_AGE, is_secure_cookie_env
from app.visitors.schemas import VisitorResponse

log = structlog.get_logger()

router = APIRouter()


@router.post("/visitors", status_code=status.HTTP_201_CREATED, response_model=VisitorResponse)
def create_visitor(
    session: Annotated[Session, Depends(get_session)],
    settings: Annotated[Settings, Depends(get_settings)],
    request: Request,
    response: Response,
) -> VisitorResponse:
    visitor_id = generate_unique_id("vis")
    splits = flag_repository.list_enabled_splits(session=session)
    assignments = assign_all(visitor_id=visitor_id, splits=splits)
    log.info("create_visitor: assigned", visitor_id=visitor_id, assignments=assignments)

    repository.insert_visitor(
        session=session, visitor_id=visitor_id, user_agent=request.headers.get("user-agent")
    )
    repository.insert_assignments(session=session, visitor_id=visitor_id, assignments=assignments)
    response.set_cookie(
        VISITOR_COOKIE,
        visitor_id,
        max_age=int(VISITOR_COOKIE_MAX_AGE.total_seconds()),
        httponly=True,
        samesite="lax",
        secure=is_secure_cookie_env(settings.env),
    )

    return VisitorResponse(id=visitor_id, assignments=assignments)
