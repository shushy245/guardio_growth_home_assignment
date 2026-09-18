"""The wire contract for funnel events: what the browser posts for one step."""

from pydantic import AwareDatetime, BaseModel, ConfigDict, Field
from pydantic.alias_generators import to_camel

from app.funnel_events.models import FunnelEventName

# The client mints the row's primary key, so this is where a well-formed one is defined: `evt_`
# and either a UUID body (what the browser mints with `crypto.randomUUID()`) or a ULID body
# (what `generate_unique_id("evt")` mints for the simulator).
EVENT_ID_PATTERN = (
    r"^evt_(?:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}|[0-9A-HJKMNP-TV-Z]{26})$"
)


class FunnelEventCreate(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, extra="forbid", frozen=True)

    id: str = Field(pattern=EVENT_ID_PATTERN)
    visitor_id: str = Field(min_length=1, max_length=64)
    name: FunnelEventName
    # Aware, never naive: a timestamp without an offset would be read in the server's zone, and
    # the skew guard's comparison against an aware `now` would raise a TypeError instead of a 400.
    occurred_at: AwareDatetime
    metadata: dict[str, object] = Field(default_factory=dict)


class FunnelEventRecorded(BaseModel):
    """What a POST returns: nothing — the client minted the id and knows everything it sent."""

    model_config = ConfigDict(extra="forbid", frozen=True)
