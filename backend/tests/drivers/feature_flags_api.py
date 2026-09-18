"""Driver for `GET /api/feature-flags` and `PATCH /api/feature-flags/{key}`.

Composes the shared `HttpDriver`. The seeded `result_screen_tone` flag is the fixture; a PATCH
in a test is rolled back with the savepoint, so every test starts from the seed.
"""

from sqlalchemy.orm import Session

from tests.drivers.http import HttpDriver

RESULT_SCREEN_TONE = "result_screen_tone"


class FeatureFlagsApiDriver:
    def __init__(self, http: HttpDriver, session: Session) -> None:
        self._http = http
        self._session = session
        self.given = _Given(self)
        self.when = _When(self)
        self.then = _Then(self)

    def _flags(self) -> list[dict[str, object]]:
        body = self._http._last.json()
        assert isinstance(body, list), f"expected a bare list of flags, got {body!r}"

        return body

    def _flag(self, key: str) -> dict[str, object]:
        matching = [flag for flag in self._flags() if flag.get("key") == key]
        assert len(matching) == 1, f"expected exactly one flag {key!r}, got {self._flags()}"

        return matching[0]


class _Given:
    def __init__(self, driver: FeatureFlagsApiDriver) -> None:
        self._driver = driver


class _When:
    def __init__(self, driver: FeatureFlagsApiDriver) -> None:
        self._driver = driver

    def the_flags_are_listed(self) -> None:
        self._driver._http.get.path("/api/feature-flags")


class _Then:
    def __init__(self, driver: FeatureFlagsApiDriver) -> None:
        self._driver = driver

    def the_flag_is_listed_with_variants(self, key: str, *variant_keys: str) -> None:
        self._driver._http.then.status(200)
        variants = self._driver._flag(key)["variants"]
        assert isinstance(variants, list), f"variants must be a list, got {variants!r}"
        actual = [variant["key"] for variant in variants]
        assert actual == list(variant_keys), f"expected variants {variant_keys}, got {actual}"

    def the_flag_is_enabled(self, key: str) -> None:
        assert self._driver._flag(key)["isEnabled"] is True

    def the_flag_carries_a_lock_token(self, key: str) -> None:
        """`updatedAt` is what the admin page must send back on save."""
        token = self._driver._flag(key).get("updatedAt")
        assert isinstance(token, str) and token, f"expected an updatedAt token, got {token!r}"
