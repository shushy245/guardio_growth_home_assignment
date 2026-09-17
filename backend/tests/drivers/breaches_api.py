"""Driver for `GET /api/breaches`.

Composes the shared `HttpDriver` rather than re-implementing request plumbing, and keeps breach
vocabulary out of it: `HttpDriver.then` stays the house HTTP contract (status, error shape,
headers) while everything breach-shaped lives here.

Rows are seeded through the same session the app is wired to, so a test that reads them back
through HTTP is also proving the `get_session` override seam.
"""

from datetime import UTC, date, datetime
from urllib.parse import quote

from sqlalchemy.orm import Session

from app.breaches.repository import upsert_many
from app.ports.breach_catalog import Breach
from tests.builders.breach import a_breach
from tests.drivers.http import HttpDriver

SEEDED_AT = datetime(2026, 9, 18, 8, 0, tzinfo=UTC)
RE_SYNCED_AT = datetime(2026, 9, 19, 8, 0, tzinfo=UTC)
ONE_DAY = date(2024, 1, 1)


class BreachesApiDriver:
    def __init__(self, http: HttpDriver, session: Session) -> None:
        self._http = http
        self._session = session
        self._seeded: list[str] = []
        self._held: list[Breach] = []
        self._listed_names: list[str] = []
        self.given = _Given(self)
        self.when = _When(self)
        self.then = _Then(self)

    def _seed(self, breaches: list[Breach]) -> None:
        upsert_many(session=self._session, breaches=breaches, fetched_at=SEEDED_AT)
        self._session.flush()
        self._held = list(breaches)
        self._seeded.extend(breach.name for breach in breaches)

    def _re_sync(self) -> None:
        upsert_many(session=self._session, breaches=self._held, fetched_at=RE_SYNCED_AT)
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

    def listed_page(self, *, page: int, limit: int) -> None:
        self._driver._list(f"?page={page}&limit={limit}")

    def listed_matching(self, q: str) -> None:
        self._driver._list(f"?q={quote(q)}")

    def listed_with_data_class(self, data_class: str) -> None:
        self._driver._list(f"?dataClass={quote(data_class)}")

    def listed_verified_only(self) -> None:
        self._driver._list("?verifiedOnly=true")

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
