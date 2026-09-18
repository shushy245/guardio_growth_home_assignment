"""The summary maths is pure, so it is asserted directly — no database, no clock.

`today` is a parameter: a "last 12 months" rule that reads the clock itself can only be tested
on the day the test happens to run.
"""

from datetime import UTC, date, datetime

from app.breaches.summary import summarise_breaches
from tests.builders.breach_facts import breach_facts

TODAY = date(2026, 9, 18)


def test_an_empty_catalog_summarises_to_nothing_rather_than_zeroes() -> None:
    """A zero-filled summary would read as "no breaches exist", which is the opposite of unknown."""
    assert summarise_breaches([], today=TODAY) is None


def test_the_summary_counts_the_breaches_and_sums_the_accounts_exposed() -> None:
    catalog = [
        breach_facts().with_name("Adobe").with_pwn_count(152_445_165).build(),
        breach_facts().with_name("Canva").with_pwn_count(137_272_116).build(),
    ]

    summary = summarise_breaches(catalog, today=TODAY)

    assert summary is not None
    assert summary.total_breaches == 2
    assert summary.total_accounts_exposed == 289_717_281


def test_the_summary_counts_only_the_breaches_inside_the_last_twelve_months() -> None:
    catalog = [
        breach_facts().with_name("Recent").with_breach_date(date(2026, 8, 1)).build(),
        breach_facts().with_name("Older").with_breach_date(date(2024, 1, 1)).build(),
    ]

    summary = summarise_breaches(catalog, today=TODAY)

    assert summary is not None
    assert summary.breaches_last_12_months == 1


def test_a_breach_exactly_a_year_old_is_outside_the_window() -> None:
    catalog = [breach_facts().with_breach_date(date(2025, 9, 18)).build()]

    summary = summarise_breaches(catalog, today=TODAY)

    assert summary is not None
    assert summary.breaches_last_12_months == 0


def test_the_summary_reports_the_share_of_breaches_that_leaked_passwords() -> None:
    catalog = [
        breach_facts().with_name("A").with_data_classes("Email addresses", "Passwords").build(),
        breach_facts().with_name("B").with_data_classes("Email addresses", "Passwords").build(),
        breach_facts().with_name("C").with_data_classes("Email addresses").build(),
        breach_facts().with_name("D").with_data_classes("Names").build(),
    ]

    summary = summarise_breaches(catalog, today=TODAY)

    assert summary is not None
    assert summary.share_exposing_passwords == 0.5


def test_the_summary_ranks_the_five_most_common_data_classes() -> None:
    catalog = [
        breach_facts().with_name("A").with_data_classes("Email addresses", "Passwords").build(),
        breach_facts().with_name("B").with_data_classes("Email addresses", "Names").build(),
        breach_facts().with_name("C").with_data_classes("Email addresses").build(),
        breach_facts().with_name("D").with_data_classes("Phone numbers").build(),
        breach_facts().with_name("E").with_data_classes("Dates of birth").build(),
        breach_facts().with_name("F").with_data_classes("IP addresses").build(),
    ]

    summary = summarise_breaches(catalog, today=TODAY)

    assert summary is not None
    assert [(item.data_class, item.breach_count) for item in summary.top_data_classes] == [
        ("Email addresses", 3),
        ("Dates of birth", 1),
        ("IP addresses", 1),
        ("Names", 1),
        ("Passwords", 1),
    ]


def test_data_classes_tied_on_count_are_ranked_by_name_so_the_order_is_stable() -> None:
    """`Counter.most_common` breaks ties by insertion order, which is the row order of a query."""
    catalog = [
        breach_facts().with_name("A").with_data_classes("Zip codes", "Ages").build(),
        breach_facts().with_name("B").with_data_classes("Zip codes", "Ages").build(),
    ]

    summary = summarise_breaches(catalog, today=TODAY)

    assert summary is not None
    assert [item.data_class for item in summary.top_data_classes] == ["Ages", "Zip codes"]


def test_the_summary_names_the_largest_breach_by_accounts_exposed() -> None:
    catalog = [
        breach_facts().with_name("Adobe").with_pwn_count(152_445_165).build(),
        breach_facts().with_name("Yahoo").with_pwn_count(3_000_000_000).build(),
    ]

    summary = summarise_breaches(catalog, today=TODAY)

    assert summary is not None
    assert summary.largest_breach.name == "Yahoo"
    assert summary.largest_breach.pwn_count == 3_000_000_000


def test_the_summary_names_the_most_recent_breach() -> None:
    catalog = [
        breach_facts().with_name("Old").with_breach_date(date(2012, 5, 5)).build(),
        breach_facts().with_name("New").with_breach_date(date(2026, 8, 27)).build(),
    ]

    summary = summarise_breaches(catalog, today=TODAY)

    assert summary is not None
    assert summary.most_recent_breach.name == "New"
    assert summary.most_recent_breach.breach_date == date(2026, 8, 27)


def test_breaches_tied_on_size_resolve_to_the_same_one_every_time() -> None:
    catalog = [
        breach_facts().with_name("Zeta").with_pwn_count(1_000).build(),
        breach_facts().with_name("Alpha").with_pwn_count(1_000).build(),
    ]

    summary = summarise_breaches(catalog, today=TODAY)

    assert summary is not None
    assert summary.largest_breach.name == "Alpha"


def test_the_summary_reports_the_newest_sync_as_when_the_catalog_was_synced() -> None:
    """Every row of one sync shares a `fetched_at`; a breach the source stopped listing keeps
    its old stamp, and the newest is the age of what the visitor is looking at."""
    catalog = [
        breach_facts()
        .with_name("Older")
        .with_fetched_at(datetime(2026, 9, 17, 8, tzinfo=UTC))
        .build(),
        breach_facts()
        .with_name("Newer")
        .with_fetched_at(datetime(2026, 9, 18, 8, tzinfo=UTC))
        .build(),
    ]

    summary = summarise_breaches(catalog, today=TODAY)

    assert summary is not None
    assert summary.synced_at == datetime(2026, 9, 18, 8, tzinfo=UTC)
