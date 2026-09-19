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


def test_the_filtered_total_equals_the_items_gathered_across_all_its_pages(
    breaches: BreachesApiDriver,
) -> None:
    """The other half of B17. On a one-page fixture `total` and the page's length are the same
    number whatever the query counts, so the promise "Showing 20 of 63" makes is only tested by
    walking the pages and counting what comes back."""
    breaches.given.breaches_all_on_one_day(count=25)
    breaches.given.breaches(a_breach().with_name("Adobe").with_title("Adobe").build())

    breaches.when.listed_matching("breach-")

    breaches.then.the_envelope_reports(total=25, page=1, limit=20)

    breaches.when.every_page_of_the_filtered_list_was_gathered(q="breach-", limit=10)

    breaches.then.the_gathered_pages_hold_exactly_what_the_total_promised(total=25)


def test_a_search_that_matches_nothing_is_an_empty_page_not_an_error(
    breaches: BreachesApiDriver,
) -> None:
    breaches.given.breaches(a_breach().with_name("Adobe").build())

    breaches.when.listed_matching("nothing-matches-this")

    breaches.then.the_breach_names_are()
    breaches.then.the_envelope_reports(total=0, page=1, limit=20)


def test_a_percent_in_the_search_is_looked_for_literally_not_as_a_wildcard(
    breaches: BreachesApiDriver,
) -> None:
    """`%` and `_` are LIKE wildcards. Unescaped, `?q=%` returns the whole catalog while the
    "Showing X of Y" tile reports it as a search result — the search silently stops being one."""
    breaches.given.breaches(
        a_breach().with_name("Adobe").with_title("Adobe").build(),
        a_breach().with_name("Discount50").with_title("50% off").with_domain(None).build(),
    )

    breaches.when.listed_matching("%")

    breaches.then.the_breach_names_are("Discount50")
    breaches.then.the_envelope_reports(total=1, page=1, limit=20)


def test_an_underscore_in_the_search_is_looked_for_literally(
    breaches: BreachesApiDriver,
) -> None:
    breaches.given.breaches(
        a_breach().with_name("Adobe").with_title("Adobe").with_domain(None).build(),
        a_breach().with_name("A_obe").with_title("A_obe").with_domain(None).build(),
    )

    breaches.when.listed_matching("A_obe")

    breaches.then.the_breach_names_are("A_obe")


def test_a_query_parameter_the_endpoint_does_not_know_is_refused(
    breaches: BreachesApiDriver,
) -> None:
    """Decided, not inherited (BF76): an unknown key is a 400 rather than something ignored.

    The cost of strictness is that a link carrying a tracking parameter would be refused, and
    nothing here builds one — the frontend composes this query itself. The cost of ignoring is
    that `?verifiedOnly=ture` reads as the whole catalog and looks like it worked, which is the
    failure a list endpoint can least afford.
    """
    breaches.when.listed_with_an_unknown_parameter()

    breaches.then.the_request_was_rejected()
    breaches.then.the_error_names("utm_source")
