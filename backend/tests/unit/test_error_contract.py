from tests.drivers.http import HttpDriver


def test_unknown_route_returns_404_with_error_body(driver: HttpDriver) -> None:
    driver.get.path("/api/does-not-exist")

    driver.then.status(404)
    driver.then.error_body()


def test_request_failing_validation_returns_400_with_error_body(driver: HttpDriver) -> None:
    driver.post.json("/api/_probe/validation", {"count": "not-a-number"})

    driver.then.status(400)
    driver.then.error_body()


def test_unhandled_exception_returns_500_with_error_body_and_correlation_id(
    driver: HttpDriver,
) -> None:
    driver.get.path("/api/_probe/crash", headers={"x-correlation-id": "corr-500"})

    driver.then.status(500)
    driver.then.error_body()
    driver.then.header("x-correlation-id", "corr-500")
    driver.then.logged("request: failed", correlation_id="corr-500", path="/api/_probe/crash")


def test_unhandled_exception_body_does_not_leak_the_exception_message(driver: HttpDriver) -> None:
    driver.get.path("/api/_probe/crash")

    driver.then.body_lacks("secret detail")
