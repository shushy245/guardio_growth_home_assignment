"""Filtering is a server query. Nothing here is a `.filter()` the browser could have run."""

from tests.builders.breach import a_breach
from tests.drivers.breaches_api import BreachesApiDriver


def test_the_text_search_matches_the_name_whatever_the_case(breaches: BreachesApiDriver) -> None:
    breaches.given.breaches(
        a_breach().with_name("LinkedIn").build(), a_breach().with_name("Adobe").build()
    )

    breaches.when.listed_matching("linkedin")

    breaches.then.the_breach_names_are("LinkedIn")


def test_the_text_search_matches_the_title_a_visitor_actually_reads(
    breaches: BreachesApiDriver,
) -> None:
    """HIBP's title differs from its name in 461 of 1,036 records — `AcneOrg` is shown as
    `Acne.org`, and searching for what is on the screen has to find it."""
    breaches.given.breaches(
        a_breach().with_name("AcneOrg").with_title("Acne.org").build(),
        a_breach().with_name("Adobe").with_title("Adobe").build(),
    )

    breaches.when.listed_matching("acne.org")

    breaches.then.the_breach_names_are("AcneOrg")


def test_the_text_search_matches_the_domain(breaches: BreachesApiDriver) -> None:
    breaches.given.breaches(
        a_breach().with_name("Canva").with_title("Canva").with_domain("canva.com").build(),
        a_breach().with_name("Adobe").with_title("Adobe").with_domain("adobe.com").build(),
    )

    breaches.when.listed_matching("canva.com")

    breaches.then.the_breach_names_are("Canva")


def test_the_text_search_matches_part_of_a_word(breaches: BreachesApiDriver) -> None:
    breaches.given.breaches(
        a_breach().with_name("MySpace").with_title("MySpace").build(),
        a_breach().with_name("Adobe").with_title("Adobe").build(),
    )

    breaches.when.listed_matching("space")

    breaches.then.the_breach_names_are("MySpace")


def test_a_breach_with_no_domain_is_still_searchable_by_name(
    breaches: BreachesApiDriver,
) -> None:
    """54 of 1,036 HIBP records have no domain; SQL's NULL must not swallow them."""
    breaches.given.breaches(
        a_breach().with_name("Collection1").with_title("Collection #1").with_domain(None).build()
    )

    breaches.when.listed_matching("collection")

    breaches.then.the_breach_names_are("Collection1")


def test_the_data_class_filter_returns_only_breaches_carrying_that_class(
    breaches: BreachesApiDriver,
) -> None:
    breaches.given.breaches(
        a_breach().with_name("Leaky").with_data_classes("Email addresses", "Passwords").build(),
        a_breach().with_name("Tidy").with_data_classes("Email addresses").build(),
    )

    breaches.when.listed_with_data_class("Passwords")

    breaches.then.the_breach_names_are("Leaky")


def test_a_filtered_list_reports_the_filtered_total_not_the_table_count(
    breaches: BreachesApiDriver,
) -> None:
    """ "Showing 20 of 1,036" has to be a number the same query can back up."""
    breaches.given.breaches_all_on_one_day(count=25)
    breaches.given.breaches(a_breach().with_name("Adobe").with_title("Adobe").build())

    breaches.when.listed_matching("adobe")

    breaches.then.the_breach_names_are("Adobe")
    breaches.then.the_envelope_reports(total=1, page=1, limit=20)


def test_a_search_that_matches_nothing_is_an_empty_page_not_an_error(
    breaches: BreachesApiDriver,
) -> None:
    breaches.given.breaches(a_breach().with_name("Adobe").build())

    breaches.when.listed_matching("nothing-matches-this")

    breaches.then.the_breach_names_are()
    breaches.then.the_envelope_reports(total=0, page=1, limit=20)
