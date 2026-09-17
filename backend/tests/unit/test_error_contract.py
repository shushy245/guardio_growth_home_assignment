"""The house error contract: every non-2xx is `{ "error": "<human-readable string>" }`.

The validation case runs against the real `GET /api/breaches` — FastAPI rejects a bad query
before the handler or its session dependency is reached, so this needs no database. The 500 case
uses a route the driver mounts, because a route whose only job is to crash does not belong in
the application.
"""

from tests.drivers.http import CRASHING_ROUTE, HttpDriver


def test_unknown_route_returns_404_with_error_body(driver: HttpDriver) -> None:
    driver.get.path("/api/does-not-exist")

    driver.then.status(404)
    driver.then.error_body()


def test_request_failing_validation_returns_400_with_error_body(driver: HttpDriver) -> None:
    driver.get.path("/api/breaches?page=0")

    driver.then.status(400)
    driver.then.error_body()


def test_unhandled_exception_returns_500_with_error_body_and_correlation_id(
    driver: HttpDriver,
) -> None:
    driver.given.a_route_that_raises()

    driver.get.path(CRASHING_ROUTE, headers={"x-correlation-id": "corr-500"})

    driver.then.status(500)
    driver.then.error_body()
    driver.then.header("x-correlation-id", "corr-500")
    driver.then.logged("request: failed", correlation_id="corr-500", path=CRASHING_ROUTE)


def test_unhandled_exception_body_does_not_leak_the_exception_message(driver: HttpDriver) -> None:
    driver.given.a_route_that_raises()

    driver.get.path(CRASHING_ROUTE)

    driver.then.body_lacks("secret detail")
