"""Driver for the catalog sync: Given a catalog, When synced, Then rows are stored.

Keeps SQLAlchemy out of the test bodies — a test says `then.stored_names_are(...)`, never a
select. `then` is the house Assert namespace (`assert` is a Python keyword).
"""

from datetime import datetime

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.breaches.models import BreachRow
from app.breaches.sync import sync_breaches, sync_breaches_if_stale
from app.ports.breach_catalog import Breach
from tests.fakes.breach_catalog import FakeBreachCatalog


class BreachSyncDriver:
    def __init__(self, session: Session) -> None:
        self._session = session
        self._catalog = FakeBreachCatalog()
        self.given = _Given(self)
        self.when = _When(self)
        self.then = _Then(self)

    def _sync(self, at: datetime) -> None:
        sync_breaches(session=self._session, catalog=self._catalog, now=at)

    def _sync_if_stale(self, at: datetime) -> None:
        sync_breaches_if_stale(session=self._session, catalog=self._catalog, now=at)

    def _row(self, name: str) -> BreachRow:
        row = self._session.execute(
            select(BreachRow).where(BreachRow.name == name)
        ).scalar_one_or_none()
        assert row is not None, f"no breach stored under name={name!r}"

        return row


class _Given:
    def __init__(self, driver: BreachSyncDriver) -> None:
        self._driver = driver

    def catalog_holds(self, *breaches: Breach) -> None:
        self._driver._catalog.holds(list(breaches))

    def already_synced(self, *, at: datetime) -> None:
        self._driver._sync(at)


class _When:
    def __init__(self, driver: BreachSyncDriver) -> None:
        self._driver = driver

    def synced(self, *, at: datetime) -> None:
        self._driver._sync(at)

    def synced_if_stale(self, *, at: datetime) -> None:
        self._driver._sync_if_stale(at)


class _Then:
    def __init__(self, driver: BreachSyncDriver) -> None:
        self._driver = driver

    def stored_names_are(self, *expected: str) -> None:
        stored = self._driver._session.execute(select(BreachRow.name).order_by(BreachRow.name))
        assert sorted(stored.scalars()) == sorted(expected)

    def stored_title_is(self, *, name: str, title: str) -> None:
        assert self._driver._row(name).title == title

    def stored_fetched_at_is(self, *, name: str, at: datetime) -> None:
        assert self._driver._row(name).fetched_at == at

    def the_catalog_was_fetched(self, times: int) -> None:
        actual = self._driver._catalog.fetch_count
        assert actual == times, f"expected {times} catalog fetch(es), got {actual}"
