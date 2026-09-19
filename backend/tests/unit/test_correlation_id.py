from tests.drivers.http import PROBE_ROUTE, HttpDriver

CORRELATION_HEADER = "x-correlation-id"


def test_every_response_carries_a_generated_correlation_id(driver: HttpDriver) -> None:
    driver.get.path(PROBE_ROUTE)

    driver.then.has_header(CORRELATION_HEADER)


def test_an_inbound_correlation_id_is_echoed_back(driver: HttpDriver) -> None:
    driver.get.path(PROBE_ROUTE, headers={CORRELATION_HEADER: "corr-from-client"})

    driver.then.header(CORRELATION_HEADER, "corr-from-client")


def test_a_404_response_also_carries_the_correlation_id(driver: HttpDriver) -> None:
    driver.get.path("/api/does-not-exist", headers={CORRELATION_HEADER: "corr-404"})

    driver.then.status(404)
    driver.then.header(CORRELATION_HEADER, "corr-404")


def test_a_400_response_also_carries_the_correlation_id(driver: HttpDriver) -> None:
    driver.get.path("/api/breaches?page=0", headers={CORRELATION_HEADER: "corr-400"})

    driver.then.status(400)
    driver.then.header(CORRELATION_HEADER, "corr-400")


def test_log_lines_emitted_during_a_request_carry_its_correlation_id(driver: HttpDriver) -> None:
    driver.get.path(PROBE_ROUTE, headers={CORRELATION_HEADER: "corr-log"})

    driver.then.logged("request: completed", correlation_id="corr-log", status_code=200)


def test_two_overlapping_requests_each_get_their_own_correlation_id(driver: HttpDriver) -> None:
    driver.when.two_overlapping_requests(("corr-first", "corr-second"))

    driver.then.each_overlapping_request_echoed_its_own_id()
    driver.then.each_overlapping_request_logged_its_own_id()


def test_the_request_log_names_the_client_and_the_scheme(driver: HttpDriver) -> None:
    """Behind the compose proxy every request arrives from nginx over plain http. The client and
    scheme are only true if uvicorn rewrote them from `X-Forwarded-For` / `X-Forwarded-Proto`,
    and a log that never carried them would make that wiring unobservable."""
    driver.get.path(PROBE_ROUTE)

    driver.then.logged("request: completed", client_ip="testclient", scheme="http")
