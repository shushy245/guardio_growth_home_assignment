"""HTTP shell for funnel events. Validation is the schema's job, tagging is the pure rule's,
SQL is the repository's. Everything is looked up first and written last, once."""

from typing import Annotated

import structlog
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.db.session import get_session
from app.funnel_events import repository
from app.funnel_events.schemas import FunnelEventCreate, FunnelEventRecorded
from app.funnel_events.tagging import experiment_tag
from app.visitors import repository as visitor_repository

log = structlog.get_logger()

router = APIRouter()


@router.post(
    "/funnel-events", status_code=status.HTTP_201_CREATED, response_model=FunnelEventRecorded
)
def create_funnel_event(
    event: FunnelEventCreate,
    session: Annotated[Session, Depends(get_session)],
) -> FunnelEventRecorded:
    ctx = {"event_id": event.id, "visitor_id": event.visitor_id, "name": event.name}
    log.info("create_funnel_event: started", **ctx)

    assignments = visitor_repository.find_assignments(session=session, visitor_id=event.visitor_id)
    if assignments is None:
        log.info("create_funnel_event: unknown visitor", **ctx)
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"create_funnel_event: no visitor with id {event.visitor_id!r}",
        )

    tag = experiment_tag(assignments)
    log.info("create_funnel_event: recording", **ctx, tag=tag)
    written = repository.insert_event(session=session, event=event, tag=tag)
    if not written:
        log.info("create_funnel_event: already recorded, replay ignored", **ctx)

    return FunnelEventRecorded()
