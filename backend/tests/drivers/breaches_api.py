"""Driver for `GET /api/breaches`.

Composes the shared `HttpDriver` rather than re-implementing request plumbing, and keeps breach
vocabulary out of it: `HttpDriver.then` stays the house HTTP contract (status, error shape,
headers) while everything breach-shaped lives here.

Rows are seeded through the same session the app is wired to, so a test that reads them back
through HTTP is also proving the `get_session` override seam.
"""

from datetime import UTC, date, datetime, timedelta
from urllib.parse import quote

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.breaches.models import BreachRow
from app.breaches.repository import upsert_many
from app.ports.breach_catalog import Breach
from tests.builders.breach import a_breach
from tests.drivers.http import HttpDriver
from tests.fakes.breach_catalog import UNREACHABLE_REASON

# Ages, not instants: a seed stamped with a fixed date silently crosses the sync TTL the day
# after it is written, and every list test would start behaving as if the catalog were stale.
SEEDED_AGE = timedelta(hours=1)
RE_SYNCED_AGE = timedelta(minutes=30)
ONE_DAY = date(2024, 1, 1)


class BreachesApiDriver:
    def __init__(self, http: HttpDriver, session: Session) -> None:
        self._http = http
        self._session = session
        self._now = datetime.now(UTC)
        self._seeded_at = self._now - SEEDED_AGE
        self._seeded: list[str] = []
        self._held: list[Breach] = []
        self._listed_names: list[str] = []
        self.given = _Given(self)
        self.when = _When(self)
        self.then = _Then(self)

    def _seed(self, breaches: list[Breach], *, age: timedelta = SEEDED_AGE) -> None:
        self._seeded_at = self._now - age
        upsert_many(session=self._session, breaches=breaches, fetched_at=self._seeded_at)
        self._session.flush()
        self._held = list(breaches)
        self._seeded.extend(breach.name for breach in breaches)

    def _re_sync(self) -> None:
        upsert_many(
            session=self._session, breaches=self._held, fetched_at=self._now - RE_SYNCED_AGE
        )
        self._session.flush()

    def _list(self, query: str) -> None:
        self._http.get.path(f"/api/breaches{query}")

    @property
    def _body(self) -> dict[str, object]:
        body = self._http._last.json()
        assert isinstance(body, dict), f"expected a list envelope, got {body!r}"

        return body

    def _items(self) -> list[dict[str, object]]:
        items = self._body["items"]
        assert isinstance(items, list), f"items must be a list, got {items!r}"

        return items


class _Given:
    def __init__(self, driver: BreachesApiDriver) -> None:
        self._driver = driver

    def breaches(self, *breaches: Breach) -> None:
        self._driver._seed(list(breaches))

    def breaches_stored_hours_ago(self, hours: int, *breaches: Breach) -> None:
        """A copy old enough (or not) to be past the sync TTL — the age is the point."""
        self._driver._seed(list(breaches), age=timedelta(hours=hours))

    def the_catalog_source_offers(self, *breaches: Breach) -> None:
        """What HIBP would answer if asked. Distinct from what is stored: a refresh is proved by
        the difference between the two."""
        self._driver._http._catalog.holds(list(breaches))

    def a_request_already_triggered_the_refresh(self) -> None:
        """One earlier request over an empty catalog: a 503 whose refresh has already run."""
        self._driver._list("")

    def the_catalog_source_is_unreachable(self) -> None:
        """HIBP is down. The endpoints never call it, and this test is what says so."""
        self._driver._http._catalog.becomes_unreachable()

    def breaches_all_on_one_day(self, *, count: int) -> None:
        """The pagination trap: every row ties on the sort column, so only a secondary key can
        give LIMIT/OFFSET a deterministic order."""
        self._driver._seed(
            [
                a_breach()
                .with_name(f"breach-{index:03d}")
                .with_title(f"Breach {index:03d}")
                .with_domain(f"breach-{index:03d}.test")
                .with_breach_date(ONE_DAY)
                .build()
                for index in range(count)
            ]
        )


class _When:
    def __init__(self, driver: BreachesApiDriver) -> None:
        self._driver = driver

    def listed(self) -> None:
        self._driver._list("")

    def the_summary_was_requested(self) -> None:
        self._driver._http.get.path("/api/breaches/summary")

    def listed_page(self, *, page: int, limit: int) -> None:
        self._driver._list(f"?page={page}&limit={limit}")

    def listed_matching(self, q: str) -> None:
        self._driver._list(f"?q={quote(q)}")

    def listed_with_data_class(self, data_class: str) -> None:
        self._driver._list(f"?dataClass={quote(data_class)}")

    def listed_verified_only(self) -> None:
        self._driver._list("?verifiedOnly=true")

    def listed_with_an_unknown_parameter(self) -> None:
        """A tracking parameter, the shape most likely to arrive by accident."""
        self._driver._list("?utm_source=newsletter")

    def listed_sorted_by(self, *, sort: str, order: str) -> None:
        """`sort` and `order` are strings, not enums, so a test can send a value that is not one."""
        self._driver._list(f"?sort={sort}&order={order}")

    def every_page_was_listed_while_the_catalog_was_re_synced(self, *, limit: int) -> None:
        """Walk the pages with a sync landing between each one — the real interleaving.

        An UPDATE writes a new tuple at the end of the heap, so a sequential scan's physical
        order changes underneath a reader who is paging. Only an explicit secondary sort key
        keeps LIMIT/OFFSET coherent across that.
        """
        collected: list[str] = []
        page = 1
        while True:
            self._driver._list(f"?page={page}&limit={limit}")
            names = [str(item["name"]) for item in self._driver._items()]
            if not names:
                break
            collected.extend(names)
            self._driver._re_sync()
            page += 1

        self._driver._listed_names = collected


class _Then:
    def __init__(self, driver: BreachesApiDriver) -> None:
        self._driver = driver

    def the_breach_names_are(self, *expected: str) -> None:
        actual = [str(item["name"]) for item in self._driver._items()]
        assert actual == list(expected), f"expected {list(expected)}, got {actual}"

    def the_catalog_was_reported_unavailable(self) -> None:
        """503, not an empty 200: a catalog we do not hold is unknown, not "no breaches"."""
        self._driver._http.then.status(503)
        self._driver._http.then.error_body()

    def it_answered_normally(self) -> None:
        self._driver._http.then.status(200)

    def the_summary_reports(self, **expected: object) -> None:
        body = self._driver._body
        actual = {key: body.get(key) for key in expected}
        assert actual == expected, f"expected {expected}, got {actual}"

    def the_summary_reports_the_seeded_sync_time(self) -> None:
        """`syncedAt` is an ISO instant on the wire; compared as a datetime, not as a string,
        because `Z` and `+00:00` are the same instant spelled two ways."""
        raw = self._driver._body["syncedAt"]
        assert isinstance(raw, str), f"syncedAt must be an ISO string, got {raw!r}"
        actual = datetime.fromisoformat(raw)
        expected = self._driver._seeded_at
        assert actual == expected, f"expected syncedAt={expected.isoformat()}, got {raw}"

    def the_failed_refresh_was_logged_with_its_reason(self) -> None:
        """The reason is the only thing an operator can act on; the event name alone is not."""
        self._driver._http.then.logged(
            "sync_catalog_best_effort: catalog unavailable, serving what is stored",
            reason=UNREACHABLE_REASON,
        )

    def the_catalog_source_was_fetched(self, times: int) -> None:
        actual = self._driver._http._catalog.fetch_count
        assert actual == times, f"expected {times} catalog fetch(es), got {actual}"

    def the_stored_catalog_holds(self, *expected: str) -> None:
        """Read through the test's own session: a refresh that committed anywhere else — the
        real engine, say — would not be visible here, and would have leaked."""
        stored = self._driver._session.execute(select(BreachRow.name)).scalars()
        assert sorted(stored) == sorted(expected)

    def the_summary_highlights(self, *, largest: str, most_recent: str) -> None:
        body = self._driver._body
        highlights = (body["largestBreach"], body["mostRecentBreach"])
        assert isinstance(highlights[0], dict) and isinstance(highlights[1], dict)
        assert (highlights[0]["name"], highlights[1]["name"]) == (largest, most_recent)

    def the_top_data_classes_are(self, *expected: str) -> None:
        ranked = self._driver._body["topDataClasses"]
        assert isinstance(ranked, list)
        actual = [item["dataClass"] for item in ranked]
        assert actual == list(expected), f"expected {list(expected)}, got {actual}"

    def the_request_was_rejected(self) -> None:
        self._driver._http.then.status(400)
        self._driver._http.then.error_body()

    def the_error_names(self, fragment: str) -> None:
        body = self._driver._http._last.json()
        assert fragment in str(body.get("error")), f"error did not mention {fragment!r}: {body}"

    def the_page_holds(self, *, count: int) -> None:
        actual = len(self._driver._items())
        assert actual == count, f"expected {count} items on the page, got {actual}"

    def the_envelope_reports(self, *, total: int, page: int, limit: int) -> None:
        body = self._driver._body
        assert (body["total"], body["page"], body["limit"]) == (total, page, limit), (
            f"expected total={total} page={page} limit={limit}, got {body!r}"
        )

    def every_seeded_breach_appeared_exactly_once(self) -> None:
        listed = self._driver._listed_names
        assert sorted(listed) == sorted(self._driver._seeded), (
            f"paging repeated or skipped rows: listed {len(listed)} of "
            f"{len(self._driver._seeded)} seeded — {sorted(listed)}"
        )
