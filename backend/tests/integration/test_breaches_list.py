"""`GET /api/breaches` against the real Postgres — sorting, paging and the envelope are SQL."""

from datetime import date

from tests.builders.breach import a_breach
from tests.drivers.breaches_api import BreachesApiDriver


def test_the_breach_list_returns_the_newest_breach_first(breaches: BreachesApiDriver) -> None:
    breaches.given.breaches(
        a_breach().with_name("Adobe").with_breach_date(date(2013, 10, 4)).build(),
        a_breach().with_name("Canva").with_breach_date(date(2019, 5, 24)).build(),
        a_breach().with_name("LinkedIn").with_breach_date(date(2012, 5, 5)).build(),
    )

    breaches.when.listed()

    breaches.then.the_breach_names_are("Canva", "Adobe", "LinkedIn")


def test_the_breach_list_serves_twenty_per_page_and_reports_the_full_total(
    breaches: BreachesApiDriver,
) -> None:
    breaches.given.breaches_all_on_one_day(count=25)

    breaches.when.listed()

    breaches.then.the_page_holds(count=20)
    breaches.then.the_envelope_reports(total=25, page=1, limit=20)


def test_a_sync_landing_mid_scroll_does_not_make_paging_repeat_or_skip_breaches(
    breaches: BreachesApiDriver,
) -> None:
    """LIMIT/OFFSET over a tied sort column has no defined order without a secondary key, and a
    sync rewriting every row between pages is exactly what perturbs the heap order."""
    breaches.given.breaches_all_on_one_day(count=25)

    breaches.when.every_page_was_listed_while_the_catalog_was_re_synced(limit=10)

    breaches.then.every_seeded_breach_appeared_exactly_once()


def test_the_api_reads_rows_written_through_the_tests_own_session(
    breaches: BreachesApiDriver,
) -> None:
    """Forwarded from the S1 review: the `get_session` override seam had no caller until now."""
    breaches.given.breaches(a_breach().with_name("Adobe").build())

    breaches.when.listed()

    breaches.then.the_breach_names_are("Adobe")


def test_rows_written_by_the_previous_test_are_not_visible_here(
    breaches: BreachesApiDriver,
) -> None:
    """The savepoint rolled back, so the catalog is empty again — which the API reports as
    unavailable rather than as an empty list. Either way the rows are gone."""
    breaches.when.listed()

    breaches.then.the_catalog_was_reported_unavailable()
