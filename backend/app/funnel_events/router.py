"""HTTP shell for funnel events. Validation is the schema's job, tagging is the pure rule's,
SQL is the repository's. Everything is looked up first and written last, once.

The visitor is the cookie, never the body: a browser can only file steps under the identity the
server handed it. No cookie is a 401 — nobody to file the step under — and a cookie naming a
visitor the database no longer holds is a 404, the browser outliving a reset."""

from datetime import UTC, datetime
from typing import Annotated

import structlog
from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from app.db.session import get_session
from app.funnel_events import repository
from app.funnel_events.clock_skew import MAX_CLOCK_SKEW_AHEAD, is_too_far_ahead
from app.funnel_events.schemas import FunnelEventCreate, FunnelEventRecorded
from app.funnel_events.tagging import experiment_tag
from app.visitors import repository as visitor_repository
from app.visitors.cookie import VISITOR_COOKIE

log = structlog.get_logger()

router = APIRouter()


@router.post(
    "/funnel-events", status_code=status.HTTP_201_CREATED, response_model=FunnelEventRecorded
)
def create_funnel_event(
    event: FunnelEventCreate,
    request: Request,
    session: Annotated[Session, Depends(get_session)],
) -> FunnelEventRecorded:
    visitor_id = request.cookies.get(VISITOR_COOKIE)
    ctx = {"event_id": event.id, "visitor_id": visitor_id, "name": event.name}
    log.info("create_funnel_event: started", **ctx, occurred_at=event.occurred_at.isoformat())

    if visitor_id is None:
        log.info("create_funnel_event: refused, no visitor cookie", **ctx)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="create_funnel_event: no visitor cookie — a step can only be recorded by a "
            "browser the server has identified",
        )

    now = datetime.now(UTC)
    if is_too_far_ahead(event.occurred_at, now=now):
        log.info("create_funnel_event: refused, occurred_at is ahead of the clock", **ctx)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                f"create_funnel_event: occurredAt {event.occurred_at.isoformat()} is more than "
                f"{MAX_CLOCK_SKEW_AHEAD} ahead of the server clock {now.isoformat()}"
            ),
        )

    assignments = visitor_repository.find_assignments(session=session, visitor_id=visitor_id)
    if assignments is None:
        log.info("create_funnel_event: unknown visitor", **ctx)
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"create_funnel_event: no visitor with id {visitor_id!r}",
        )

    tag = experiment_tag(assignments)
    log.info(
        "create_funnel_event: recording",
        **ctx,
        flag_key=None if tag is None else tag.flag_key,
        variant_key=None if tag is None else tag.variant_key,
    )
    inserted_id = repository.insert_event(
        session=session, event=event, visitor_id=visitor_id, tag=tag
    )
    if inserted_id is None:
        log.info("create_funnel_event: already recorded, replay ignored", **ctx)

    return FunnelEventRecorded()
