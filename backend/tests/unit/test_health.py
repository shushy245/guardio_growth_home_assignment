"""`GET /api/health`: alive *and* able to answer, which for this app means the database.

The check is what a restarter acts on and what a deploy gate waits for, so "ok" from an app
whose every data endpoint 500s is worse than no health check at all (BF68). The happy path
needs a real database and lives in `tests/integration/test_health.py`; this is the outage.
"""

from tests.drivers.http import HttpDriver


def test_an_unreachable_database_is_a_503_not_an_ok(driver: HttpDriver) -> None:
    driver.given.the_database_is_unreachable()

    driver.get.path("/api/health")

    driver.then.status(503)
    driver.then.error_body()
