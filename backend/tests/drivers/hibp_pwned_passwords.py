"""Driver for the Pwned Passwords adapter: Given what the range API answers, When a prefix is
fetched, Then what we get back and what was sent.

Same shape as `hibp_catalog.py`: the real client with its real base URL, headers and timeout,
over `httpx2.MockTransport`. Nothing reaches the network.
"""

from collections.abc import Callable

import httpx2 as httpx

from app.adapters.hibp.pwned_password_range import (
    HibpPwnedPasswordRange,
    build_pwned_passwords_client,
)
from app.ports.pwned_password_range import PwnedPasswordRangeError

USER_AGENT = "breach-scan-funnel-test"


class HibpPwnedPasswordsDriver:
    def __init__(self) -> None:
        self._handler: Callable[[httpx.Request], httpx.Response] | None = None
        self._requests: list[httpx.Request] = []
        self._range: str | None = None
        self._failure: PwnedPasswordRangeError | None = None
        self.given = _Given(self)
        self.when = _When(self)
        self.then = _Then(self)

    def _adapter(self) -> HibpPwnedPasswordRange:
        handler = self._handler
        if handler is None:
            msg = "HibpPwnedPasswordsDriver: say what the API answers with given.* first"
            raise AssertionError(msg)

        def record(request: httpx.Request) -> httpx.Response:
            self._requests.append(request)

            return handler(request)

        client = build_pwned_passwords_client(
            user_agent=USER_AGENT, transport=httpx.MockTransport(record)
        )

        return HibpPwnedPasswordRange(client=client)

    @property
    def _request(self) -> httpx.Request:
        assert self._requests, "no request was made"

        return self._requests[0]


class _Given:
    def __init__(self, driver: HibpPwnedPasswordsDriver) -> None:
        self._driver = driver

    def the_api_answers_with(self, text: str) -> None:
        self._driver._handler = lambda _request: httpx.Response(200, text=text)

    def the_api_answers_status(self, status_code: int) -> None:
        self._driver._handler = lambda _request: httpx.Response(status_code, text="no")

    def the_api_is_unreachable(self) -> None:
        def refuse(request: httpx.Request) -> httpx.Response:
            raise httpx.ConnectError("connection refused", request=request)

        self._driver._handler = refuse


class _When:
    def __init__(self, driver: HibpPwnedPasswordsDriver) -> None:
        self._driver = driver

    def the_range_is_fetched(self, prefix: str) -> None:
        try:
            self._driver._range = self._driver._adapter().fetch_range(prefix)
        except PwnedPasswordRangeError as error:
            self._driver._failure = error


class _Then:
    def __init__(self, driver: HibpPwnedPasswordsDriver) -> None:
        self._driver = driver

    def the_range_text_is(self, expected: str) -> None:
        assert self._driver._failure is None, f"fetch failed: {self._driver._failure}"
        assert self._driver._range == expected

    def it_failed_saying(self, *fragments: str) -> None:
        failure = self._driver._failure
        assert failure is not None, "expected a PwnedPasswordRangeError, the fetch succeeded"
        for fragment in fragments:
            assert fragment in str(failure), f"error did not mention {fragment!r}: {failure}"

    def the_api_was_asked_for(self, url: str) -> None:
        assert str(self._driver._request.url) == url

    def the_request_asked_for_padding(self) -> None:
        """`Add-Padding: true` makes every answer the same order of size, so a listener on the
        wire cannot tell a rare prefix from a common one by the response length."""
        assert self._driver._request.headers.get("Add-Padding") == "true"

    def the_request_identified_us(self) -> None:
        assert self._driver._request.headers.get("User-Agent") == USER_AGENT
