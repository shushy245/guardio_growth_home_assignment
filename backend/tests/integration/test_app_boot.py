"""What `create_app`'s lifespan does, through the door the server opens it by.

`tests/integration/test_breach_sync.py` proves the boot sync's behaviour; this proves it is
wired to startup at all. Reducing the lifespan to a bare `yield` left the whole suite green
(BF77) — the same class of gap as BF21, one level up: a tested function nothing calls.
"""

from tests.builders.breach import a_breach
from tests.drivers.breaches_api import BreachesApiDriver
from tests.drivers.http import HttpDriver


def test_starting_the_app_syncs_the_catalog_once(
    driver: HttpDriver, breaches: BreachesApiDriver
) -> None:
    breaches.given.the_catalog_source_offers(a_breach().with_name("Adobe").build())

    driver.when.the_app_starts_up()

    driver.then.the_catalog_was_fetched(times=1)
    breaches.then.the_stored_catalog_holds("Adobe")
