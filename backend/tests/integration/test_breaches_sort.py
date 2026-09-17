"""Sorting is a server query, never a browser `Array.sort` over a page of twenty."""

from tests.builders.breach import a_breach
from tests.drivers.breaches_api import BreachesApiDriver


def test_sorting_by_pwn_count_puts_the_largest_breach_first(breaches: BreachesApiDriver) -> None:
    breaches.given.breaches(
        a_breach().with_name("Small").with_pwn_count(1_000).build(),
        a_breach().with_name("Huge").with_pwn_count(1_000_000_000).build(),
        a_breach().with_name("Medium").with_pwn_count(500_000).build(),
    )

    breaches.when.listed_sorted_by(sort="pwnCount", order="desc")

    breaches.then.the_breach_names_are("Huge", "Medium", "Small")


def test_sorting_by_pwn_count_ascending_puts_the_smallest_first(
    breaches: BreachesApiDriver,
) -> None:
    breaches.given.breaches(
        a_breach().with_name("Small").with_pwn_count(1_000).build(),
        a_breach().with_name("Huge").with_pwn_count(1_000_000_000).build(),
    )

    breaches.when.listed_sorted_by(sort="pwnCount", order="asc")

    breaches.then.the_breach_names_are("Small", "Huge")


def test_sorting_by_name_orders_alphabetically(breaches: BreachesApiDriver) -> None:
    breaches.given.breaches(
        a_breach().with_name("Zynga").build(),
        a_breach().with_name("Adobe").build(),
        a_breach().with_name("MySpace").build(),
    )

    breaches.when.listed_sorted_by(sort="name", order="asc")

    breaches.then.the_breach_names_are("Adobe", "MySpace", "Zynga")


def test_an_unknown_sort_field_is_rejected_rather_than_silently_ignored(
    breaches: BreachesApiDriver,
) -> None:
    """A typo that fell back to the default sort would be a screen quietly showing wrong order."""
    breaches.when.listed_sorted_by(sort="pwnCoutn", order="desc")

    breaches.then.the_request_was_rejected()
    breaches.then.the_error_names("sort")


def test_an_unknown_order_is_rejected(breaches: BreachesApiDriver) -> None:
    breaches.when.listed_sorted_by(sort="pwnCount", order="sideways")

    breaches.then.the_request_was_rejected()
    breaches.then.the_error_names("order")
