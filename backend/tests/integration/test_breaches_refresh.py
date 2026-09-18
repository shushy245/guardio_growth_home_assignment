"""Stale-while-revalidate: a breach request serves what is stored and, when that copy has aged
past the sync TTL, refreshes it *after* answering.

The boot-time sync only ever ran at boot, so a container that stayed up served an ageing copy
with no upper bound. These tests drive the refresh through HTTP because that is the only path a
visitor exercises — a lifespan loop would be wiring no test reaches.
"""

from tests.builders.breach import a_breach
from tests.drivers.breaches_api import BreachesApiDriver

STALE_HOURS = 25


def test_a_request_over_a_stale_catalog_refreshes_it_after_answering(
    breaches: BreachesApiDriver,
) -> None:
    breaches.given.breaches_stored_hours_ago(STALE_HOURS, a_breach().with_name("Adobe").build())
    breaches.given.the_catalog_source_offers(
        a_breach().with_name("Adobe").build(), a_breach().with_name("LinkedIn").build()
    )

    breaches.when.listed()

    breaches.then.it_answered_normally()
    breaches.then.the_catalog_source_was_fetched(1)
    breaches.then.the_stored_catalog_holds("Adobe", "LinkedIn")


def test_a_request_over_a_fresh_catalog_does_not_fetch(breaches: BreachesApiDriver) -> None:
    breaches.given.breaches(a_breach().with_name("Adobe").build())
    breaches.given.the_catalog_source_offers(a_breach().with_name("LinkedIn").build())

    breaches.when.listed()

    breaches.then.it_answered_normally()
    breaches.then.the_catalog_source_was_fetched(0)
    breaches.then.the_stored_catalog_holds("Adobe")


def test_the_request_that_triggers_a_refresh_is_answered_from_the_stored_copy(
    breaches: BreachesApiDriver,
) -> None:
    """Serve stale, then revalidate: the visitor never waits on HIBP. The response's own
    `syncedAt` is the old one, which is only possible if it was built before the fetch."""
    breaches.given.breaches_stored_hours_ago(STALE_HOURS, a_breach().with_name("Adobe").build())
    breaches.given.the_catalog_source_offers(a_breach().with_name("Adobe").build())

    breaches.when.the_summary_was_requested()

    breaches.then.it_answered_normally()
    breaches.then.the_summary_reports_the_seeded_sync_time()
    breaches.then.the_catalog_source_was_fetched(1)
