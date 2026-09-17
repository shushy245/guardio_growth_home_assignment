from fastapi.testclient import TestClient

from app.main import create_app
from tests.drivers.http import HttpDriver


def test_health_endpoint_returns_200_status_ok() -> None:
    driver = HttpDriver(TestClient(create_app()))

    driver.get.path("/api/health")

    driver.then.status(200)
    driver.then.json({"status": "ok"})
