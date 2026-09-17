"""Self-test of the integration harness.

The second test depends on running after the first: isolation between tests can only be
observed across two tests. pytest runs a file's tests in definition order.
"""

from tests.drivers.db import DbDriver


def test_a_session_against_the_compose_database_answers(db: DbDriver) -> None:
    db.then.the_database_answers()


def test_a_write_committed_in_one_test_is_rolled_back_afterwards(db: DbDriver) -> None:
    db.given.a_probe_table_with_one_row()

    db.then.the_database_answers()


def test_the_previous_tests_write_is_not_visible_here(db: DbDriver) -> None:
    db.then.the_probe_table_is_absent()
