"""`POST /api/funnel-events`: a step is written once, tagged with what the visitor was assigned."""

from tests.builders.funnel_event import a_funnel_event
from tests.drivers.funnel_events_api import FunnelEventsApiDriver


def test_a_valid_event_is_recorded_with_the_visitors_flag_and_variant(
    funnel_events: FunnelEventsApiDriver,
) -> None:
    funnel_events.given.a_visitor_exists()

    funnel_events.when.the_visitor_records(a_funnel_event())

    funnel_events.then.the_event_was_recorded()
    funnel_events.then.the_stored_event_is_tagged_with_the_visitors_assignment()
