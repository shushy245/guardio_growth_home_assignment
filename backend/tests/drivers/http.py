"""HTTP test driver.

Tests read as Given / When / Then and never touch the client directly:

    driver.get.path("/api/health")
    driver.then.status(200)
    driver.then.json({"status": "ok"})

`given.*` seeds state, `get/post/patch.*` performs the one request under test, `then.*` holds
every assertion (Python reserves `assert`, so the Then namespace is `then`).
"""

from __future__ import annotations

from collections.abc import Callable
from typing import Any

import httpx2 as httpx
import structlog
from fastapi.testclient import TestClient
from structlog.testing import capture_logs
from structlog.typing import EventDict

from app.main import create_app
from tests.builders.settings import a_settings


class HttpDriver:
    """Builds the app lazily on the first request, so `given.*` can shape settings first."""

    def __init__(self) -> None:
        self._settings = a_settings()
        self._client: TestClient | None = None
        self._response: httpx.Response | None = None
        self._logs: list[EventDict] = []
        self.given = _Given(self)
        self.get = _Get(self)
        self.post = _Post(self)
        self.patch = _Patch(self)
        self.then = _Then(self)

    def _perform(self, request: Callable[[TestClient], httpx.Response]) -> None:
        """Every request runs under log capture so `then.logged(...)` can assert on it.

        `capture_logs` replaces the processor chain, so the contextvars merge step from
        production logging is re-added or bound fields (correlation id) would not be captured.
        """
        client = self._app_client()  # create_app configures logging; must precede the capture
        with capture_logs(processors=[structlog.contextvars.merge_contextvars]) as logs:
            self._response = request(client)
        self._logs = logs

    def _app_client(self) -> TestClient:
        if self._client is None:
            self._client = TestClient(create_app(self._settings.build()))
        return self._client

    @property
    def _last(self) -> httpx.Response:
        if self._response is None:
            msg = "HttpDriver: no request performed yet — call get/post/patch before then.*"
            raise AssertionError(msg)
        return self._response


class _Given:
    def __init__(self, driver: HttpDriver) -> None:
        self._driver = driver

    def frontend_origin(self, origin: str) -> None:
        self._driver._settings = self._driver._settings.with_frontend_origin(origin)


class _Get:
    def __init__(self, driver: HttpDriver) -> None:
        self._driver = driver

    def path(self, path: str, *, headers: dict[str, str] | None = None) -> None:
        self._driver._perform(lambda client: client.get(path, headers=headers))


class _Post:
    def __init__(self, driver: HttpDriver) -> None:
        self._driver = driver

    def json(
        self, path: str, body: dict[str, Any], *, headers: dict[str, str] | None = None
    ) -> None:
        self._driver._perform(lambda client: client.post(path, json=body, headers=headers))


class _Patch:
    def __init__(self, driver: HttpDriver) -> None:
        self._driver = driver

    def json(
        self, path: str, body: dict[str, Any], *, headers: dict[str, str] | None = None
    ) -> None:
        self._driver._perform(lambda client: client.patch(path, json=body, headers=headers))


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

    def logged(self, event: str, **fields: str | int) -> None:
        """A log line with this event name was emitted during the request and carries `fields`."""
        matching = [log for log in self._driver._logs if log.get("event") == event]
        assert matching, f"no log line with event={event!r}; got {self._driver._logs}"
        assert any(all(log.get(k) == v for k, v in fields.items()) for log in matching), (
            f"no {event!r} log line carried {fields}; got {matching}"
        )

    def no_bound_log_context(self) -> None:
        """Per-request context must not leak into the next request (contextvars cleared)."""
        assert structlog.contextvars.get_contextvars() == {}
