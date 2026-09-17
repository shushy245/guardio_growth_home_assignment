"""Integration harness: the real compose Postgres, migrated once, one savepoint per test.

Each test gets a Session joined to an outer transaction that is rolled back afterwards
(SQLAlchemy's "join a session into an external transaction" recipe). Application code may
`commit()` freely: with `join_transaction_mode="create_savepoint"` that only releases a
savepoint, and the outer rollback discards everything.

TEST_DATABASE_URL is read from the process environment on purpose: this file is test
infrastructure, the one place tests meet the outside world, and a missing value fails loudly.
"""

import os
from collections.abc import Iterator

import pytest
from alembic import command
from alembic.config import Config
from sqlalchemy import Engine, create_engine
from sqlalchemy.orm import Session

from tests.drivers.breach_sync import BreachSyncDriver
from tests.drivers.breaches_api import BreachesApiDriver
from tests.drivers.db import DbDriver
from tests.drivers.http import HttpDriver


def _test_database_url() -> str:
    url = os.environ.get("TEST_DATABASE_URL")
    if url is None:
        msg = (
            "integration tests: TEST_DATABASE_URL is not set — start the compose db "
            "(docker compose up -d db) and export the URL from .env.example"
        )
        raise RuntimeError(msg)
    return url


@pytest.fixture(scope="session")
def engine() -> Iterator[Engine]:
    url = _test_database_url()
    os.environ["DATABASE_URL"] = url  # alembic/env.py reads DATABASE_URL
    command.upgrade(Config("alembic.ini"), "head")
    engine = create_engine(url)
    yield engine
    engine.dispose()


@pytest.fixture
def db_session(engine: Engine) -> Iterator[Session]:
    connection = engine.connect()
    outer = connection.begin()
    session = Session(bind=connection, join_transaction_mode="create_savepoint")
    yield session
    session.close()
    outer.rollback()
    connection.close()


@pytest.fixture
def db(db_session: Session) -> DbDriver:
    return DbDriver(db_session)


@pytest.fixture
def driver(db_session: Session) -> HttpDriver:
    http_driver = HttpDriver()
    http_driver.given.database_session(db_session)
    return http_driver


@pytest.fixture
def sync(db_session: Session) -> BreachSyncDriver:
    return BreachSyncDriver(db_session)


@pytest.fixture
def breaches(driver: HttpDriver, db_session: Session) -> BreachesApiDriver:
    return BreachesApiDriver(driver, db_session)
