"""Database access for the `funnel_event` table. Only SQL."""

from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import Session

from app.funnel_events.models import FunnelEventRow
from app.funnel_events.schemas import FunnelEventCreate
from app.funnel_events.tagging import ExperimentTag


def insert_event(
    *, session: Session, event: FunnelEventCreate, visitor_id: str, tag: ExperimentTag | None
) -> str | None:
    """The id written, or `None` when this id was already stored.

    `ON CONFLICT DO NOTHING` is the whole idempotency mechanism: a retry, a StrictMode
    double-run or a replay lands here and the first write wins — a replay carrying a different
    body is not an update.
    """
    return session.execute(
        insert(FunnelEventRow)
        .values(
            id=event.id,
            visitor_id=visitor_id,
            name=event.name,
            flag_key=None if tag is None else tag.flag_key,
            variant_key=None if tag is None else tag.variant_key,
            occurred_at=event.occurred_at,
            metadata_=event.metadata,
        )
        .on_conflict_do_nothing(index_elements=[FunnelEventRow.id])
        # RETURNING yields a row only for an insert that happened; a conflict returns nothing.
        .returning(FunnelEventRow.id)
    ).scalar_one_or_none()
