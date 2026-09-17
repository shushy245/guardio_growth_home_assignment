"""Database driver for integration tests that need to seed or inspect rows directly.

Keeps SQL out of test bodies. Story drivers add `given.*` seeders here as entities appear.
"""

from sqlalchemy import Column, Integer, MetaData, Table, insert, inspect, text
from sqlalchemy.orm import Session

PROBE_TABLE = "_harness_probe"


class DbDriver:
    def __init__(self, session: Session) -> None:
        self._session = session
        self.given = _Given(session)
        self.then = _Then(session)


class _Given:
    def __init__(self, session: Session) -> None:
        self._session = session

    def a_probe_table_with_one_row(self) -> None:
        probe = Table(PROBE_TABLE, MetaData(), Column("id", Integer, primary_key=True))
        probe.create(self._session.connection())
        self._session.execute(insert(probe).values(id=1))
        self._session.commit()


class _Then:
    def __init__(self, session: Session) -> None:
        self._session = session

    def the_database_answers(self) -> None:
        assert self._session.execute(text("SELECT 1")).scalar_one() == 1

    def the_probe_table_is_absent(self) -> None:
        assert not inspect(self._session.connection()).has_table(PROBE_TABLE), (
            f"{PROBE_TABLE} leaked from a previous test — the savepoint rollback is broken"
        )
