from tests.drivers.http import HttpDriver


def test_health_endpoint_returns_200_status_ok(driver: HttpDriver) -> None:
    driver.get.path("/api/health")

    driver.then.status(200)
    driver.then.json({"status": "ok"})
