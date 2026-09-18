"""`GET /api/breaches/summary` and the fail-visible paths on both breach endpoints.

The rule these tests exist for: a catalog we do not hold is *unknown*, and answering an empty
200 would state that no breaches exist. That is synthetic data by omission.
"""

from datetime import date

from tests.builders.breach import a_breach
from tests.drivers.breaches_api import BreachesApiDriver


def test_the_summary_describes_the_stored_catalog(breaches: BreachesApiDriver) -> None:
    breaches.given.breaches(
        a_breach()
        .with_name("Adobe")
        .with_pwn_count(150_000_000)
        .with_data_classes("Email addresses", "Passwords")
        .with_breach_date(date(2013, 10, 4))
        .build(),
        a_breach()
        .with_name("Canva")
        .with_pwn_count(130_000_000)
        .with_data_classes("Email addresses")
        .with_breach_date(date(2019, 5, 24))
        .build(),
    )

    breaches.when.the_summary_was_requested()

    breaches.then.the_summary_reports(
        totalBreaches=2, totalAccountsExposed=280_000_000, shareExposingPasswords=0.5
    )
    breaches.then.the_summary_highlights(largest="Adobe", most_recent="Canva")
    breaches.then.the_top_data_classes_are("Email addresses", "Passwords")


def test_the_summary_leaves_out_the_breaches_the_list_refuses_to_serve(
    breaches: BreachesApiDriver,
) -> None:
    """The tiles and the list must never disagree about which breaches exist."""
    breaches.given.breaches(
        a_breach().with_name("Adobe").with_pwn_count(150_000_000).build(),
        a_breach().with_name("Withdrawn").with_pwn_count(999_000_000).retired().build(),
        a_breach().with_name("Invented").with_pwn_count(999_000_000).fabricated().build(),
    )

    breaches.when.the_summary_was_requested()

    breaches.then.the_summary_reports(totalBreaches=1, totalAccountsExposed=150_000_000)


def test_an_empty_catalog_makes_the_list_fail_visibly(breaches: BreachesApiDriver) -> None:
    breaches.when.listed()

    breaches.then.the_catalog_was_reported_unavailable()


def test_an_empty_catalog_makes_the_summary_fail_visibly(breaches: BreachesApiDriver) -> None:
    breaches.when.the_summary_was_requested()

    breaches.then.the_catalog_was_reported_unavailable()


def test_a_catalog_holding_only_unservable_breaches_counts_as_empty(
    breaches: BreachesApiDriver,
) -> None:
    breaches.given.breaches(a_breach().with_name("Withdrawn").retired().build())

    breaches.when.listed()

    breaches.then.the_catalog_was_reported_unavailable()


def test_a_filter_matching_nothing_is_an_empty_page_not_an_unavailable_catalog(
    breaches: BreachesApiDriver,
) -> None:
    """Zero results and zero catalog are different facts and must not share a status code."""
    breaches.given.breaches(a_breach().with_name("Adobe").build())

    breaches.when.listed_matching("nothing-matches-this")

    breaches.then.it_answered_normally()
    breaches.then.the_breach_names_are()
    breaches.then.the_envelope_reports(total=0, page=1, limit=20)


def test_hibp_going_down_does_not_stop_the_list_serving_what_is_stored(
    breaches: BreachesApiDriver,
) -> None:
    """503 is for holding nothing, not for an upstream blip: the catalog is a day-old public
    record and stays perfectly serviceable while HIBP is unreachable."""
    breaches.given.breaches(a_breach().with_name("Adobe").build())
    breaches.given.the_catalog_source_is_unreachable()

    breaches.when.listed()

    breaches.then.it_answered_normally()
    breaches.then.the_breach_names_are("Adobe")


def test_the_summary_reports_when_the_catalog_was_synced(breaches: BreachesApiDriver) -> None:
    """The one number the tiles cannot imply: how old the copy the visitor is reading is."""
    breaches.given.breaches(a_breach().with_name("Adobe").build())

    breaches.when.the_summary_was_requested()

    breaches.then.the_summary_reports_the_seeded_sync_time()
