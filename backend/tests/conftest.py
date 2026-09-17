"""Shared fixtures — pytest's `beforeEach` with dependency injection.

A test asks for a fixture by naming it as a parameter. `driver` is the Given phase every HTTP
test shares: the house driver, which builds the app from test settings on first request.
"""

import pytest

from tests.drivers.http import HttpDriver


@pytest.fixture
def driver() -> HttpDriver:
    return HttpDriver()
