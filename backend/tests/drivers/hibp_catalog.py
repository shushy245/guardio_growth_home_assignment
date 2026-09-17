"""Driver for the HIBP adapter: Given what HIBP answers, When fetched, Then what we get back.

The adapter talks HTTP, so the test drives it through `httpx2.MockTransport` — the real client
with its real base URL, headers and timeout, and a fake wire underneath. Nothing here reaches the
network, and no test asserts on httpx directly.
"""

from collections.abc import Callable

import httpx2 as httpx

from app.adapters.hibp.breach_catalog import HibpBreachCatalog, build_hibp_client
from app.ports.breach_catalog import BreachCatalogError

USER_AGENT = "breach-scan-funnel-test"


class HibpCatalogDriver:
    def __init__(self) -> None:
        self._handler: Callable[[httpx.Request], httpx.Response] | None = None
        self._requests: list[httpx.Request] = []
        self._breaches: list[str] = []
        self._failure: BreachCatalogError | None = None
        self.given = _Given(self)
        self.when = _When(self)
        self.then = _Then(self)

    def _catalog(self) -> HibpBreachCatalog:
        handler = self._handler
        if handler is None:
            msg = "HibpCatalogDriver: say what HIBP answers with given.* before when.fetched()"
            raise AssertionError(msg)

        def record(request: httpx.Request) -> httpx.Response:
            self._requests.append(request)

            return handler(request)

        client = build_hibp_client(user_agent=USER_AGENT, transport=httpx.MockTransport(record))

        return HibpBreachCatalog(client=client)

    @property
    def _request(self) -> httpx.Request:
        assert self._requests, "no request was made"

        return self._requests[0]


class _Given:
    def __init__(self, driver: HibpCatalogDriver) -> None:
        self._driver = driver

    def hibp_answers_with(self, payload: list[dict[str, object]]) -> None:
        self._driver._handler = lambda _request: httpx.Response(200, json=payload)

    def hibp_answers_status(self, status_code: int) -> None:
        self._driver._handler = lambda _request: httpx.Response(status_code, json={"message": "no"})

    def hibp_answers_with_something_other_than_json(self) -> None:
        self._driver._handler = lambda _request: httpx.Response(200, text="<html>maintenance")

    def hibp_is_unreachable(self) -> None:
        def refuse(request: httpx.Request) -> httpx.Response:
            raise httpx.ConnectError("connection refused", request=request)

        self._driver._handler = refuse


class _When:
    def __init__(self, driver: HibpCatalogDriver) -> None:
        self._driver = driver

    def fetched(self) -> None:
        try:
            self._driver._breaches = [breach.name for breach in self._driver._catalog().fetch_all()]
        except BreachCatalogError as error:
            self._driver._failure = error


class _Then:
    def __init__(self, driver: HibpCatalogDriver) -> None:
        self._driver = driver

    def the_breach_names_are(self, *expected: str) -> None:
        assert self._driver._failure is None, f"fetch failed: {self._driver._failure}"
        assert self._driver._breaches == list(expected)

    def it_failed_saying(self, *fragments: str) -> None:
        failure = self._driver._failure
        assert failure is not None, "expected a BreachCatalogError, the fetch succeeded"
        for fragment in fragments:
            assert fragment in str(failure), f"error did not mention {fragment!r}: {failure}"

    def hibp_was_asked_for(self, url: str) -> None:
        assert str(self._driver._request.url) == url

    def the_request_identified_us(self) -> None:
        assert self._driver._request.headers.get("User-Agent") == USER_AGENT
