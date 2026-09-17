"""Catalog sync against the real Postgres: upsert semantics are the thing under test, and an
in-memory fake would prove nothing about `ON CONFLICT`."""

from datetime import UTC, datetime, timedelta

from tests.builders.breach import a_breach
from tests.drivers.breach_sync import BreachSyncDriver

FIRST_SYNC = datetime(2026, 9, 17, 9, 0, tzinfo=UTC)
LATER_SYNC = datetime(2026, 9, 18, 9, 0, tzinfo=UTC)


def test_sync_stores_every_breach_the_catalog_offers(sync: BreachSyncDriver) -> None:
    sync.given.catalog_holds(
        a_breach().with_name("Adobe").build(), a_breach().with_name("LinkedIn").build()
    )

    sync.when.synced(at=FIRST_SYNC)

    sync.then.stored_names_are("Adobe", "LinkedIn")


def test_a_second_sync_of_the_same_catalog_does_not_duplicate_rows(sync: BreachSyncDriver) -> None:
    sync.given.catalog_holds(a_breach().with_name("Adobe").build())
    sync.given.already_synced(at=FIRST_SYNC)

    sync.when.synced(at=LATER_SYNC)

    sync.then.stored_names_are("Adobe")
    sync.then.stored_fetched_at_is(name="Adobe", at=LATER_SYNC)


def test_a_second_sync_applies_a_changed_record_in_place(sync: BreachSyncDriver) -> None:
    sync.given.catalog_holds(a_breach().with_name("Adobe").with_title("Adobe").build())
    sync.given.already_synced(at=FIRST_SYNC)
    sync.given.catalog_holds(a_breach().with_name("Adobe").with_title("Adobe Systems").build())

    sync.when.synced(at=LATER_SYNC)

    sync.then.stored_names_are("Adobe")
    sync.then.stored_title_is(name="Adobe", title="Adobe Systems")


def test_a_breach_missing_from_a_later_sync_is_left_in_place(sync: BreachSyncDriver) -> None:
    """HIBP does not delete breaches; a sync that pruned would erase the catalog on a bad fetch."""
    sync.given.catalog_holds(
        a_breach().with_name("Adobe").build(), a_breach().with_name("LinkedIn").build()
    )
    sync.given.already_synced(at=FIRST_SYNC)
    sync.given.catalog_holds(a_breach().with_name("Adobe").build())

    sync.when.synced(at=LATER_SYNC)

    sync.then.stored_names_are("Adobe", "LinkedIn")


def test_a_catalog_that_has_never_been_fetched_is_synced_on_the_first_call(
    sync: BreachSyncDriver,
) -> None:
    sync.given.catalog_holds(a_breach().with_name("Adobe").build())

    sync.when.synced_if_stale(at=FIRST_SYNC)

    sync.then.the_catalog_was_fetched(1)
    sync.then.stored_names_are("Adobe")


def test_a_catalog_older_than_the_ttl_is_fetched_again(sync: BreachSyncDriver) -> None:
    sync.given.catalog_holds(a_breach().with_name("Adobe").build())
    sync.given.already_synced(at=FIRST_SYNC)

    sync.when.synced_if_stale(at=FIRST_SYNC + timedelta(hours=25))

    sync.then.the_catalog_was_fetched(2)
    sync.then.stored_fetched_at_is(name="Adobe", at=FIRST_SYNC + timedelta(hours=25))


def test_a_second_sync_inside_the_same_ttl_window_does_not_fetch_again(
    sync: BreachSyncDriver,
) -> None:
    """Restarts and repeated startups must not each pull a megabyte of catalog from HIBP.

    Two workers starting at genuinely the same instant would both see an empty table and both
    fetch; the upsert makes that harmless and compose runs one worker, so no lock is warranted.
    """
    sync.given.catalog_holds(a_breach().with_name("Adobe").build())
    sync.given.already_synced(at=FIRST_SYNC)

    sync.when.synced_if_stale(at=FIRST_SYNC + timedelta(minutes=1))

    sync.then.the_catalog_was_fetched(1)
    sync.then.stored_fetched_at_is(name="Adobe", at=FIRST_SYNC)
