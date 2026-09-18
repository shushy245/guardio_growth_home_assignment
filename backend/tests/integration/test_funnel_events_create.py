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


def test_the_same_event_posted_twice_is_accepted_and_stored_once(
    funnel_events: FunnelEventsApiDriver,
) -> None:
    """A retry, a StrictMode double-run or a replay carries the same id; the second arrival is
    a success that changes nothing, not a conflict the browser has to handle."""
    funnel_events.given.a_visitor_exists()
    funnel_events.given.the_visitor_already_recorded(a_funnel_event())

    funnel_events.when.the_visitor_records(a_funnel_event())

    funnel_events.then.the_event_was_recorded()
    funnel_events.then.exactly_one_event_is_stored()


def test_a_replay_with_a_different_body_leaves_the_first_write_untouched(
    funnel_events: FunnelEventsApiDriver,
) -> None:
    """`DO NOTHING` does nothing: the first write wins and the replay is not an update."""
    funnel_events.given.a_visitor_exists()
    funnel_events.given.the_visitor_already_recorded(a_funnel_event().with_name("landing_view"))

    funnel_events.when.the_visitor_records(a_funnel_event().with_name("scan_started"))

    funnel_events.then.the_event_was_recorded()
    funnel_events.then.exactly_one_event_is_stored()
    funnel_events.then.the_stored_event_is_named("landing_view")
