"""One process, overlapping and failing refreshes: the guards a sequential HTTP test cannot
reach. Against the real Postgres because a refresh is a transaction, and the point of the
overlap is what happens to the connection while HIBP is slow."""

from datetime import UTC, datetime, timedelta

from tests.builders.breach import a_breach
from tests.drivers.catalog_refresh import CatalogRefreshDriver

T = datetime(2026, 9, 18, 12, 0, tzinfo=UTC)


def test_a_refresh_already_in_flight_is_not_started_a_second_time(
    refresh: CatalogRefreshDriver,
) -> None:
    """Two requests in the same stale window must not become two HIBP fetches and two
    concurrent upserts of the same rows."""
    refresh.given.catalog_holds(a_breach().with_name("Adobe").build())
    refresh.given.the_catalog_source_answers_only_when_released()
    refresh.when.a_refresh_runs_in_the_background(at=T)

    refresh.when.a_refresh_is_requested(at=T)
    refresh.when.the_source_is_released()

    refresh.then.the_catalog_was_fetched(1)
    refresh.then.stored_names_are("Adobe")


def test_no_refresh_is_wanted_while_one_is_in_flight(refresh: CatalogRefreshDriver) -> None:
    refresh.given.catalog_holds(a_breach().with_name("Adobe").build())
    refresh.given.the_catalog_source_answers_only_when_released()
    refresh.when.a_refresh_runs_in_the_background(at=T)

    refresh.when.asked_whether_a_refresh_is_wanted(at=T)
    refresh.when.the_source_is_released()

    refresh.then.a_refresh_was_not_wanted()


def test_a_failed_refresh_is_not_retried_inside_the_retry_interval(
    refresh: CatalogRefreshDriver,
) -> None:
    """A down HIBP is attempted once per interval, not once per visitor who finds the copy stale."""
    refresh.given.the_catalog_source_is_unreachable()
    refresh.when.a_refresh_is_requested(at=T)

    refresh.when.asked_whether_a_refresh_is_wanted(at=T + timedelta(minutes=1))

    refresh.then.the_catalog_was_fetched(1)
    refresh.then.a_refresh_was_not_wanted()


def test_a_failed_refresh_is_retried_once_the_interval_has_passed(
    refresh: CatalogRefreshDriver,
) -> None:
    """Also proves the in-flight lock is released by a failure: a second fetch is possible."""
    refresh.given.the_catalog_source_is_unreachable()
    refresh.when.a_refresh_is_requested(at=T)

    refresh.when.asked_whether_a_refresh_is_wanted(at=T + timedelta(minutes=5))
    refresh.when.a_refresh_is_requested(at=T + timedelta(minutes=5))

    refresh.then.a_refresh_was_wanted()
    refresh.then.the_catalog_was_fetched(2)
