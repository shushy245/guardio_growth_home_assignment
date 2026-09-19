"""Shared fixtures — pytest's `beforeEach` with dependency injection.

A test asks for a fixture by naming it as a parameter. `driver` is the Given phase every HTTP
test shares: the house driver, which builds the app from test settings on first request.
"""

from pathlib import Path

import pytest

from tests.drivers.hibp_catalog import HibpCatalogDriver
from tests.drivers.hibp_pwned_passwords import HibpPwnedPasswordsDriver
from tests.drivers.http import HttpDriver
from tests.drivers.pwned_passwords_api import PwnedPasswordsApiDriver

INTEGRATION_DIR = Path(__file__).parent / "integration"


def pytest_collection_modifyitems(items: list[pytest.Item]) -> None:
    """Every test under tests/integration/ carries the `integration` marker by location.

    A `pytestmark` in a conftest is inert, so the marker is applied here at collection; this is
    what makes `pytest -m "not integration"` a real unit-only run with no database.
    """
    for item in items:
        if INTEGRATION_DIR in Path(item.fspath).parents:
            item.add_marker(pytest.mark.integration)


@pytest.fixture
def driver() -> HttpDriver:
    return HttpDriver()


@pytest.fixture
def hibp() -> HibpCatalogDriver:
    return HibpCatalogDriver()


@pytest.fixture
def hibp_pwned() -> HibpPwnedPasswordsDriver:
    return HibpPwnedPasswordsDriver()


@pytest.fixture
def pwned_passwords(driver: HttpDriver) -> PwnedPasswordsApiDriver:
    return PwnedPasswordsApiDriver(driver)
