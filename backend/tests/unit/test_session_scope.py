"""The request's transaction is committed before the response is sent.

Found by the simulator, not by a test: 750 visitors in, a visitor was created with a 201 and
the very next request said no such visitor existed. FastAPI's default dependency scope runs a
yield-dependency's exit code — here, the commit — *after* the response has gone out, so a
client on a fast link reads before the write lands. The in-process test client waits for the
whole cycle and can never show it; this test watches the order of the two events instead.
"""

from tests.drivers.http import SESSION_ROUTE, HttpDriver


def test_the_transaction_is_closed_before_the_response_is_sent(driver: HttpDriver) -> None:
    driver.given.a_route_that_only_opens_a_session()

    driver.get.path(SESSION_ROUTE)

    driver.then.status(200)
    driver.then.the_transaction_closed_before_the_response_started()
