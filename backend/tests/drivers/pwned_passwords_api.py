"""Driver for `GET /api/pwned-passwords/range/{prefix}`.

Composes the shared `HttpDriver`, whose app is built over the fake range source; `given.*`
shapes what that source answers, and the Then reads what the proxy handed back and what the
source was asked for.
"""

from tests.drivers.http import HttpDriver

RANGE_PATH = "/api/pwned-passwords/range"


class PwnedPasswordsApiDriver:
    def __init__(self, http: HttpDriver) -> None:
        self._http = http
        self.given = _Given(self)
        self.get = _Get(self)
        self.then = _Then(self)


class _Given:
    def __init__(self, driver: PwnedPasswordsApiDriver) -> None:
        self._driver = driver

    def the_range_source_answers(self, *, prefix: str, text: str) -> None:
        self._driver._http._pwned_passwords.answers(prefix=prefix, text=text)

    def the_range_source_is_unreachable(self) -> None:
        self._driver._http._pwned_passwords.becomes_unreachable()


class _Get:
    def __init__(self, driver: PwnedPasswordsApiDriver) -> None:
        self._driver = driver

    def the_range(self, prefix: str) -> None:
        self._driver._http.get.path(f"{RANGE_PATH}/{prefix}")


class _Then:
    def __init__(self, driver: PwnedPasswordsApiDriver) -> None:
        self._driver = driver

    def the_range_text_is(self, expected: str) -> None:
        self._driver._http.then.status(200)
        content_type = self._driver._http._last.headers.get("content-type", "")
        assert content_type.startswith("text/plain"), f"expected text/plain, got {content_type}"
        assert self._driver._http._last.text == expected

    def the_source_was_asked_for_exactly(self, *prefixes: str) -> None:
        asked = self._driver._http._pwned_passwords.requested_prefixes
        assert asked == list(prefixes), f"the source was asked for {asked}, expected {prefixes}"

    def the_prefix_was_refused(self) -> None:
        self._driver._http.then.status(400)
        self._driver._http.then.error_body()

    def the_source_is_unavailable(self) -> None:
        self._driver._http.then.status(503)
        self._driver._http.then.error_body()
