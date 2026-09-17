"""What the catalog refuses to serve.

Retired and fabricated breaches are HIBP's own disclaimers — a breach it withdrew, and one it
believes was invented. Showing either on a screen whose whole job is to be believed would be a
security company repeating a claim its source has retracted.
"""

from tests.builders.breach import a_breach
from tests.drivers.breaches_api import BreachesApiDriver


def test_a_retired_breach_is_never_served(breaches: BreachesApiDriver) -> None:
    breaches.given.breaches(
        a_breach().with_name("Withdrawn").retired().build(),
        a_breach().with_name("Adobe").build(),
    )

    breaches.when.listed()

    breaches.then.the_breach_names_are("Adobe")


def test_a_fabricated_breach_is_never_served(breaches: BreachesApiDriver) -> None:
    breaches.given.breaches(
        a_breach().with_name("Invented").fabricated().build(),
        a_breach().with_name("Adobe").build(),
    )

    breaches.when.listed()

    breaches.then.the_breach_names_are("Adobe")


def test_the_excluded_breaches_are_absent_from_the_total_too(breaches: BreachesApiDriver) -> None:
    breaches.given.breaches(
        a_breach().with_name("Withdrawn").retired().build(),
        a_breach().with_name("Invented").fabricated().build(),
        a_breach().with_name("Adobe").build(),
    )

    breaches.when.listed()

    breaches.then.the_envelope_reports(total=1, page=1, limit=20)


def test_unverified_breaches_are_served_by_default(breaches: BreachesApiDriver) -> None:
    """Unverified is not the same as fabricated: HIBP has 42 of these and they are real leads."""
    breaches.given.breaches(
        a_breach().with_name("Unconfirmed").unverified().build(),
        a_breach().with_name("Adobe").build(),
    )

    breaches.when.listed()

    breaches.then.the_breach_names_are("Adobe", "Unconfirmed")


def test_verified_only_excludes_the_unverified(breaches: BreachesApiDriver) -> None:
    breaches.given.breaches(
        a_breach().with_name("Unconfirmed").unverified().build(),
        a_breach().with_name("Adobe").build(),
    )

    breaches.when.listed_verified_only()

    breaches.then.the_breach_names_are("Adobe")
    breaches.then.the_envelope_reports(total=1, page=1, limit=20)
