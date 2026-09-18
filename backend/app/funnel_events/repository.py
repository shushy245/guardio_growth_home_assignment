"""Database access for the `funnel_event` table. Only SQL."""

from sqlalchemy import insert
from sqlalchemy.orm import Session

from app.funnel_events.models import FunnelEventRow
from app.funnel_events.schemas import FunnelEventCreate
from app.funnel_events.tagging import ExperimentTag


def insert_event(*, session: Session, event: FunnelEventCreate, tag: ExperimentTag | None) -> None:
    session.execute(
        insert(FunnelEventRow).values(
            id=event.id,
            visitor_id=event.visitor_id,
            name=event.name,
            flag_key=None if tag is None else tag.flag_key,
            variant_key=None if tag is None else tag.variant_key,
            occurred_at=event.occurred_at,
            metadata_=event.metadata,
        )
    )
