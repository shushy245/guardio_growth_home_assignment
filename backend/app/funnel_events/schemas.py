"""The wire contract for funnel events: what the browser posts for one step."""

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field
from pydantic.alias_generators import to_camel

from app.funnel_events.models import FunnelEventName


class FunnelEventCreate(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, extra="forbid", frozen=True)

    id: str
    visitor_id: str = Field(min_length=1, max_length=64)
    name: FunnelEventName
    occurred_at: datetime
    metadata: dict[str, object] = Field(default_factory=dict)


class FunnelEventRecorded(BaseModel):
    """What a POST returns: nothing — the client minted the id and knows everything it sent."""

    model_config = ConfigDict(extra="forbid", frozen=True)
