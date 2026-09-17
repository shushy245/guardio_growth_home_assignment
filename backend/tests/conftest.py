"""Shared fixtures — pytest's `beforeEach` with dependency injection.

A test asks for a fixture by naming it as a parameter. `driver` is the Given phase every HTTP
test shares: an app built by the composition root, wrapped in the house driver.
"""

import pytest
from fastapi.testclient import TestClient

from app.main import create_app
from tests.drivers.http import HttpDriver


@pytest.fixture
def driver() -> HttpDriver:
    return HttpDriver(TestClient(create_app()))
