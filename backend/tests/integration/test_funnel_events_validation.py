"""`POST /api/funnel-events`: what the boundary refuses, and what it records for a visitor the
experiment never enrolled."""

from datetime import UTC, datetime, timedelta

from tests.builders.funnel_event import a_funnel_event
from tests.drivers.funnel_events_api import FunnelEventsApiDriver


def test_an_event_for_a_visitor_nobody_knows_is_not_found(
    funnel_events: FunnelEventsApiDriver,
) -> None:
    funnel_events.when.an_event_is_recorded_for_a_visitor_nobody_knows(a_funnel_event())

    funnel_events.then.the_visitor_was_not_found()
    funnel_events.then.no_event_is_stored()


def test_an_event_with_a_name_the_funnel_does_not_define_is_refused(
    funnel_events: FunnelEventsApiDriver,
) -> None:
    funnel_events.given.a_visitor_exists()

    funnel_events.when.the_visitor_records(a_funnel_event().with_name("checkout_completed"))

    funnel_events.then.the_event_was_refused()
    funnel_events.then.no_event_is_stored()


def test_an_event_dated_more_than_five_minutes_ahead_is_refused(
    funnel_events: FunnelEventsApiDriver,
) -> None:
    """A browser clock can run ahead; five minutes of skew is forgiven, an hour is a bad clock
    or a forged timestamp, and either would file the step in the wrong hour of the funnel."""
    funnel_events.given.a_visitor_exists()
    an_hour_ahead = (datetime.now(UTC) + timedelta(hours=1)).isoformat()

    funnel_events.when.the_visitor_records(a_funnel_event().occurring_at(an_hour_ahead))

    funnel_events.then.the_event_was_refused()
    funnel_events.then.no_event_is_stored()


def test_an_event_dated_within_five_minutes_ahead_is_recorded(
    funnel_events: FunnelEventsApiDriver,
) -> None:
    funnel_events.given.a_visitor_exists()
    a_minute_ahead = (datetime.now(UTC) + timedelta(minutes=1)).isoformat()

    funnel_events.when.the_visitor_records(a_funnel_event().occurring_at(a_minute_ahead))

    funnel_events.then.the_event_was_recorded()


def test_an_event_dated_without_a_timezone_is_refused(
    funnel_events: FunnelEventsApiDriver,
) -> None:
    """A naive instant means whatever the server's zone says it means; the browser always
    knows its offset, so a missing one is a malformed request, not a guess to make."""
    funnel_events.given.a_visitor_exists()

    funnel_events.when.the_visitor_records(a_funnel_event().occurring_at("2026-09-18T12:00:00"))

    funnel_events.then.the_event_was_refused()
    funnel_events.then.no_event_is_stored()


def test_an_event_whose_id_is_not_a_prefixed_client_id_is_refused(
    funnel_events: FunnelEventsApiDriver,
) -> None:
    """The client mints the row's primary key, so the boundary — not the table — decides what a
    well-formed one looks like."""
    funnel_events.given.a_visitor_exists()

    funnel_events.when.the_visitor_records(a_funnel_event().with_id("landing-1"))

    funnel_events.then.the_event_was_refused()
    funnel_events.then.no_event_is_stored()


def test_a_visitor_outside_the_experiment_still_has_their_step_recorded(
    funnel_events: FunnelEventsApiDriver,
) -> None:
    """The flag was disabled when they arrived: no assignment, no tag — still a funnel step."""
    funnel_events.given.a_visitor_exists_outside_the_experiment()

    funnel_events.when.the_visitor_records(a_funnel_event())

    funnel_events.then.the_event_was_recorded()
    funnel_events.then.the_stored_event_has_no_experiment_tag()


def test_metadata_is_stored_as_sent(funnel_events: FunnelEventsApiDriver) -> None:
    funnel_events.given.a_visitor_exists()

    funnel_events.when.the_visitor_records(
        a_funnel_event().with_metadata({"sort": "pwnCount", "page": 2})
    )

    funnel_events.then.the_event_was_recorded()
    funnel_events.then.the_stored_event_carries_metadata({"sort": "pwnCount", "page": 2})
