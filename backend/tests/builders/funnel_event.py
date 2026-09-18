"""Builder for the funnel-event wire body: what the browser posts for one step.

`build()` returns the camelCase JSON mapping the API receives, so tests exercise the aliases
and the validators. The body names no visitor: the identity is the cookie the browser carries.
`claiming_to_be` puts one in anyway, for the test that proves the server refuses it.
"""

from __future__ import annotations

from dataclasses import dataclass, field, replace
from datetime import UTC, datetime

from app.funnel_events.models import FunnelEventName

A_CLIENT_EVENT_ID = "evt_3f9c2a1e-7b4d-4c8e-9a6f-1d2e3f4a5b6c"


def a_funnel_event() -> _FunnelEventBuilder:
    return _FunnelEventBuilder()


@dataclass(frozen=True)
class _FunnelEventBuilder:
    id: str = A_CLIENT_EVENT_ID
    claimed_visitor_id: str | None = None
    name: str = FunnelEventName.LANDING_VIEW
    occurred_at: str = field(default_factory=lambda: datetime.now(UTC).isoformat())
    metadata: dict[str, object] = field(default_factory=dict)

    def with_id(self, event_id: str) -> _FunnelEventBuilder:
        return replace(self, id=event_id)

    def claiming_to_be(self, visitor_id: str) -> _FunnelEventBuilder:
        """A `visitorId` in the body — what a caller filing steps under someone else would send."""
        return replace(self, claimed_visitor_id=visitor_id)

    def with_name(self, name: str) -> _FunnelEventBuilder:
        return replace(self, name=name)

    def occurring_at(self, occurred_at: str) -> _FunnelEventBuilder:
        return replace(self, occurred_at=occurred_at)

    def with_metadata(self, metadata: dict[str, object]) -> _FunnelEventBuilder:
        return replace(self, metadata=metadata)

    def build(self) -> dict[str, object]:
        body: dict[str, object] = {
            "id": self.id,
            "name": self.name,
            "occurredAt": self.occurred_at,
            "metadata": self.metadata,
        }
        if self.claimed_visitor_id is not None:
            body["visitorId"] = self.claimed_visitor_id

        return body
