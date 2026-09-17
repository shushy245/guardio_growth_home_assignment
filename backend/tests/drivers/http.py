"""HTTP test driver.

Tests read as Given / When / Then and never touch the client directly:

    driver.get.path("/api/health")
    driver.then.status(200)
    driver.then.json({"status": "ok"})

`given.*` seeds state, `get/post/patch.*` performs the one request under test, `then.*` holds
every assertion (Python reserves `assert`, so the Then namespace is `then`).
"""

from __future__ import annotations

from typing import Any

import httpx2 as httpx
from fastapi.testclient import TestClient


class HttpDriver:
    def __init__(self, client: TestClient) -> None:
        self._client = client
        self._response: httpx.Response | None = None
        self.given = _Given()
        self.get = _Get(self)
        self.post = _Post(self)
        self.patch = _Patch(self)
        self.then = _Then(self)

    def _record(self, response: httpx.Response) -> None:
        self._response = response

    @property
    def _last(self) -> httpx.Response:
        if self._response is None:
            msg = "HttpDriver: no request performed yet — call get/post/patch before then.*"
            raise AssertionError(msg)
        return self._response


class _Given:
    """Scenario setup lives here as stories add state (db rows, fakes). Empty in S1."""


class _Get:
    def __init__(self, driver: HttpDriver) -> None:
        self._driver = driver

    def path(self, path: str, *, headers: dict[str, str] | None = None) -> None:
        self._driver._record(self._driver._client.get(path, headers=headers))


class _Post:
    def __init__(self, driver: HttpDriver) -> None:
        self._driver = driver

    def json(
        self, path: str, body: dict[str, Any], *, headers: dict[str, str] | None = None
    ) -> None:
        self._driver._record(self._driver._client.post(path, json=body, headers=headers))


class _Patch:
    def __init__(self, driver: HttpDriver) -> None:
        self._driver = driver

    def json(
        self, path: str, body: dict[str, Any], *, headers: dict[str, str] | None = None
    ) -> None:
        self._driver._record(self._driver._client.patch(path, json=body, headers=headers))


class _Then:
    def __init__(self, driver: HttpDriver) -> None:
        self._driver = driver

    def status(self, expected: int) -> None:
        actual = self._driver._last.status_code
        assert actual == expected, (
            f"expected HTTP {expected}, got {actual}: {self._driver._last.text}"
        )

    def json(self, expected: dict[str, Any]) -> None:
        assert self._driver._last.json() == expected

    def error_body(self) -> None:
        """The house error contract: `{ "error": "<human-readable string>" }` and nothing else."""
        body = self._driver._last.json()
        assert set(body) == {"error"}, f"error body must be exactly {{error}}, got {body}"
        assert isinstance(body["error"], str) and body["error"], "error must be a non-empty string"

    def header(self, name: str, expected: str) -> None:
        assert self._driver._last.headers.get(name) == expected

    def has_header(self, name: str) -> None:
        assert name in self._driver._last.headers, f"missing response header {name}"

    def lacks_header(self, name: str) -> None:
        assert name not in self._driver._last.headers, f"unexpected response header {name}"
