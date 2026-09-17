from fastapi.testclient import TestClient

from app.main import create_app
from tests.drivers.http import HttpDriver


def test_unknown_route_returns_404_with_error_body() -> None:
    driver = HttpDriver(TestClient(create_app()))

    driver.get.path("/api/does-not-exist")

    driver.then.status(404)
    driver.then.error_body()


def test_request_failing_validation_returns_400_with_error_body() -> None:
    driver = HttpDriver(TestClient(create_app()))

    driver.post.json("/api/_probe/validation", {"count": "not-a-number"})

    driver.then.status(400)
    driver.then.error_body()
