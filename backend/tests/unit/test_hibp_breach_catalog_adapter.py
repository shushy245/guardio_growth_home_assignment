"""The HIBP adapter over a fake transport: real client, real URL and headers, no network."""

from tests.builders.hibp_breach import a_hibp_breach
from tests.drivers.hibp_catalog import HibpCatalogDriver


def test_the_adapter_asks_hibp_for_the_breach_catalog_and_identifies_itself(
    hibp: HibpCatalogDriver,
) -> None:
    hibp.given.hibp_answers_with([a_hibp_breach().build()])

    hibp.when.fetched()

    hibp.then.hibp_was_asked_for("https://haveibeenpwned.com/api/v3/breaches")
    hibp.then.the_request_identified_us()


def test_the_adapter_returns_the_translated_breaches(hibp: HibpCatalogDriver) -> None:
    hibp.given.hibp_answers_with([a_hibp_breach().build()])

    hibp.when.fetched()

    hibp.then.the_breach_names_are("000webhost")


def test_an_unreachable_hibp_becomes_a_catalog_error(hibp: HibpCatalogDriver) -> None:
    hibp.given.hibp_is_unreachable()

    hibp.when.fetched()

    hibp.then.it_failed_saying("fetch_all", "unreachable")


def test_a_non_2xx_answer_from_hibp_becomes_a_catalog_error_naming_the_status(
    hibp: HibpCatalogDriver,
) -> None:
    hibp.given.hibp_answers_status(429)

    hibp.when.fetched()

    hibp.then.it_failed_saying("fetch_all", "429")


def test_an_answer_that_is_not_json_becomes_a_catalog_error(hibp: HibpCatalogDriver) -> None:
    """A proxy's HTML maintenance page arrives as a 200; it must not crash somewhere obscure."""
    hibp.given.hibp_answers_with_something_other_than_json()

    hibp.when.fetched()

    hibp.then.it_failed_saying("fetch_all", "not JSON")
