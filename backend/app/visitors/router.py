"""HTTP shell for visitors. Assignment is the pure rule's job, SQL is the repository's.

`POST` is the one place a visitor is assigned. Everything is computed first — the id, every
enabled flag's variant — and written last, in one transaction, so a visitor row never exists
without the assignments the response reports.

It is also idempotent per browser: a request carrying a `visitor_id` cookie this server knows is
answered with that visitor and their stored assignments. Two tabs opened together are one person,
and minting a second identity would enrol them in the experiment twice, under two variants.
"""

from typing import Annotated

import structlog
from fastapi import APIRouter, Depends, HTTPException, Path, Request, Response, status
from sqlalchemy.orm import Session

from app.config import Settings
from app.db.session import SessionDep
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
    session: SessionDep,
    settings: Annotated[Settings, Depends(get_settings)],
    request: Request,
    response: Response,
) -> VisitorResponse:
    """`201` for a browser the server has not seen, `200` when the cookie names a visitor it
    knows: the same body and the same cookie, with nothing created. A refresh is not a second
    visitor, and answering `201` to one would say it was (BF26)."""
    log.info("create_visitor: started", has_cookie=VISITOR_COOKIE in request.cookies)

    recognised = _recognised_visitor(session=session, request=request)
    if recognised is not None:
        log.info(
            "create_visitor: cookie names a known visitor, reusing them",
            visitor_id=recognised.id,
            assignments=recognised.assignments,
        )
        response.status_code = status.HTTP_200_OK
        _set_visitor_cookie(response, visitor_id=recognised.id, settings=settings)

        return recognised

    visitor_id = generate_unique_id("vis")
    splits = flag_repository.list_enabled_splits(session=session)
    assignments = assign_all(visitor_id=visitor_id, splits=splits)
    log.info("create_visitor: assigned", visitor_id=visitor_id, assignments=assignments)

    repository.insert_visitor(
        session=session, visitor_id=visitor_id, user_agent=request.headers.get("user-agent")
    )
    repository.insert_assignments(session=session, visitor_id=visitor_id, assignments=assignments)
    _set_visitor_cookie(response, visitor_id=visitor_id, settings=settings)

    return VisitorResponse(id=visitor_id, assignments=assignments)


def _recognised_visitor(*, session: Session, request: Request) -> VisitorResponse | None:
    """The visitor this request's cookie names, if this server still knows them.

    A cookie naming nobody is a browser outliving a database, not an error: the caller mints a
    new visitor, and the stale id is overwritten by the fresh cookie.
    """
    visitor_id = request.cookies.get(VISITOR_COOKIE)
    if visitor_id is None:
        return None

    assignments = repository.find_assignments(session=session, visitor_id=visitor_id)
    if assignments is None:
        log.info("create_visitor: cookie names an unknown visitor", visitor_id=visitor_id)

        return None

    return VisitorResponse(id=visitor_id, assignments=assignments)


def _set_visitor_cookie(response: Response, *, visitor_id: str, settings: Settings) -> None:
    response.set_cookie(
        VISITOR_COOKIE,
        visitor_id,
        max_age=int(VISITOR_COOKIE_MAX_AGE.total_seconds()),
        httponly=True,
        samesite="lax",
        secure=is_secure_cookie_env(settings.env),
    )


@router.get("/visitors/{visitor_id}", response_model=VisitorResponse)
def get_visitor(
    visitor_id: Annotated[str, Path(min_length=1, max_length=64)],
    session: SessionDep,
) -> VisitorResponse:
    """The refresh path: what this visitor was assigned, as stored — never recomputed."""
    assignments = repository.find_assignments(session=session, visitor_id=visitor_id)
    if assignments is None:
        log.info("get_visitor: unknown visitor", visitor_id=visitor_id)
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"get_visitor: no visitor with id {visitor_id!r}",
        )

    return VisitorResponse(id=visitor_id, assignments=assignments)
