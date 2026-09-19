"""The health check's happy path, against the real Postgres.

Integration, not unit: the whole point of the route is that it reaches the database, so a
version of this test that faked the session would prove nothing (BF68).
"""

from tests.drivers.http import HttpDriver


def test_health_says_ok_when_the_database_answers(driver: HttpDriver) -> None:
    driver.get.path("/api/health")

    driver.then.status(200)
    driver.then.json({"status": "ok"})
