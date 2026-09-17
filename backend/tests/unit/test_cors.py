from tests.drivers.http import HttpDriver

ALLOW_ORIGIN_HEADER = "access-control-allow-origin"


def test_configured_frontend_origin_is_allowed(driver: HttpDriver) -> None:
    driver.given.frontend_origin("http://frontend.test")

    driver.get.path("/api/health", headers={"Origin": "http://frontend.test"})

    driver.then.header(ALLOW_ORIGIN_HEADER, "http://frontend.test")


def test_any_other_origin_gets_no_allow_header(driver: HttpDriver) -> None:
    driver.given.frontend_origin("http://frontend.test")

    driver.get.path("/api/health", headers={"Origin": "http://evil.test"})

    driver.then.lacks_header(ALLOW_ORIGIN_HEADER)
