"""Driver for `CatalogRefresher` below the HTTP layer: what one process does when refreshes
overlap or fail, which a sequential `TestClient` cannot interleave.

A refresh "in the background" is a real thread holding a real (savepoint-bound) transaction
open inside the fake's held fetch — the state a slow HIBP puts production in. The test thread
touches the shared connection only after that thread has been joined.
"""

import threading
from datetime import datetime

from sqlalchemy import select
from sqlalchemy.orm import Session, sessionmaker

from app.breaches.models import BreachRow
from app.breaches.refresh import CatalogRefresher
from app.ports.breach_catalog import Breach
from tests.fakes.breach_catalog import RELEASE_TIMEOUT_SECONDS, FakeBreachCatalog

JOIN_TIMEOUT_SECONDS = RELEASE_TIMEOUT_SECONDS + 1


class CatalogRefreshDriver:
    def __init__(self, session: Session) -> None:
        self._session = session
        self._catalog = FakeBreachCatalog()
        self._refresher = CatalogRefresher(catalog=self._catalog)
        self._session_factory = sessionmaker(
            bind=session.connection(), join_transaction_mode="create_savepoint"
        )
        self._background: threading.Thread | None = None
        self._wanted: bool | None = None
        self.given = _Given(self)
        self.when = _When(self)
        self.then = _Then(self)

    def _refresh(self, at: datetime) -> None:
        self._refresher.refresh(session_factory=self._session_factory, now=at)


class _Given:
    def __init__(self, driver: CatalogRefreshDriver) -> None:
        self._driver = driver

    def catalog_holds(self, *breaches: Breach) -> None:
        self._driver._catalog.holds(list(breaches))

    def the_catalog_source_answers_only_when_released(self) -> None:
        self._driver._catalog.answers_only_when_released()

    def the_catalog_source_is_unreachable(self) -> None:
        self._driver._catalog.becomes_unreachable()


class _When:
    def __init__(self, driver: CatalogRefreshDriver) -> None:
        self._driver = driver

    def a_refresh_runs_in_the_background(self, *, at: datetime) -> None:
        """Returns once the refresh is inside its fetch, so the next step overlaps it for sure."""
        thread = threading.Thread(target=self._driver._refresh, args=(at,), daemon=True)
        thread.start()
        started = self._driver._catalog.fetch_started.wait(timeout=RELEASE_TIMEOUT_SECONDS)
        assert started, "the background refresh never reached its fetch"
        self._driver._background = thread

    def a_refresh_is_requested(self, *, at: datetime) -> None:
        self._driver._refresh(at)

    def asked_whether_a_refresh_is_wanted(self, *, at: datetime) -> None:
        """With a catalog that was never fetched, so only the refresher's own gates can say no."""
        self._driver._wanted = self._driver._refresher.wants_refresh(fetched_at=None, now=at)

    def the_source_is_released(self) -> None:
        self._driver._catalog.release()
        thread = self._driver._background
        assert thread is not None, "no refresh is running in the background"
        thread.join(timeout=JOIN_TIMEOUT_SECONDS)
        assert not thread.is_alive(), "the background refresh did not finish after release"


class _Then:
    def __init__(self, driver: CatalogRefreshDriver) -> None:
        self._driver = driver

    def the_catalog_was_fetched(self, times: int) -> None:
        actual = self._driver._catalog.fetch_count
        assert actual == times, f"expected {times} catalog fetch(es), got {actual}"

    def stored_names_are(self, *expected: str) -> None:
        stored = self._driver._session.execute(select(BreachRow.name)).scalars()
        assert sorted(stored) == sorted(expected)

    def a_refresh_was_wanted(self) -> None:
        assert self._driver._wanted is True

    def a_refresh_was_not_wanted(self) -> None:
        assert self._driver._wanted is False
