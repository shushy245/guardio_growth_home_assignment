"""HTTP test driver.

Tests read as Given / When / Then and never touch the client directly:

    driver.get.path("/api/health")
    driver.then.status(200)
    driver.then.json({"status": "ok"})

`given.*` seeds state, `get/post.*` performs the one request under test, `then.*` holds
every assertion (Python reserves `assert`, so the Then namespace is `then`).
"""

from __future__ import annotations

import asyncio
from collections.abc import Callable, Coroutine
from typing import Any

import httpx2 as httpx
import structlog
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session
from structlog.testing import capture_logs
from structlog.typing import EventDict

from app.db.session import get_session
from app.main import create_app
from app.middleware.correlation_id import CORRELATION_ID_HEADER
from tests.builders.settings import a_settings


class HttpDriver:
    """Builds the app lazily on the first request, so `given.*` can shape settings first."""

    def __init__(self) -> None:
        self._settings = a_settings()
        self._session_override: Session | None = None
        self._built_app: FastAPI | None = None
        self._client: TestClient | None = None
        self._response: httpx.Response | None = None
        self._overlapping: dict[str, httpx.Response] = {}
        self._logs: list[EventDict] = []
        self.given = _Given(self)
        self.get = _Get(self)
        self.post = _Post(self)
        self.when = _When(self)
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

    def _perform_concurrently(self, correlation_ids: tuple[str, ...]) -> None:
        """Drive several requests through one event loop so they genuinely interleave.

        `TestClient` runs the app on a worker thread, so a test thread cannot observe a
        request's contextvars. Driving the ASGI app directly from the test's own event loop
        puts each request in its own asyncio task — the scope a contextvar is isolated to —
        which is what makes per-request correlation ids provable.
        """
        app = self._app()  # create_app configures logging; must precede the capture
        with capture_logs(processors=[structlog.contextvars.merge_contextvars]) as logs:
            responses = asyncio.run(_get_health_concurrently(app, correlation_ids))
        self._logs = logs
        self._overlapping = dict(zip(correlation_ids, responses, strict=True))

    def _app_client(self) -> TestClient:
        if self._client is None:
            self._client = TestClient(self._app())
        return self._client

    def _app(self) -> FastAPI:
        if self._built_app is None:
            app = create_app(self._settings.build())
            if self._session_override is not None:
                session = self._session_override
                app.dependency_overrides[get_session] = lambda: session
            self._built_app = app
        return self._built_app

    @property
    def _last(self) -> httpx.Response:
        if self._response is None:
            msg = "HttpDriver: no request performed yet — call get/post before then.*"
            raise AssertionError(msg)
        return self._response


class _Given:
    def __init__(self, driver: HttpDriver) -> None:
        self._driver = driver

    def frontend_origin(self, origin: str) -> None:
        self._driver._settings = self._driver._settings.with_frontend_origin(origin)

    def database_session(self, session: Session) -> None:
        """Integration tests: route every request's DB work through the test's session."""
        self._driver._session_override = session


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


class _When:
    def __init__(self, driver: HttpDriver) -> None:
        self._driver = driver

    def two_overlapping_requests(self, correlation_ids: tuple[str, str]) -> None:
        self._driver._perform_concurrently(correlation_ids)


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

    def body_lacks(self, fragment: str) -> None:
        assert fragment not in self._driver._last.text, f"response body leaked {fragment!r}"

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

    def each_overlapping_request_echoed_its_own_id(self) -> None:
        for correlation_id, response in self._driver._overlapping.items():
            actual = response.headers.get(CORRELATION_ID_HEADER)
            assert actual == correlation_id, (
                f"request sent {correlation_id!r} but got {actual!r} back"
            )

    def each_overlapping_request_logged_its_own_id(self) -> None:
        logged = [
            log.get("correlation_id")
            for log in self._driver._logs
            if log.get("event") == "request: completed"
        ]
        expected = list(self._driver._overlapping)
        assert sorted(str(item) for item in logged) == sorted(expected), (
            f"expected one completed log line per request carrying its own id {expected}, "
            f"got {logged}"
        )


async def _get_health_concurrently(
    app: FastAPI, correlation_ids: tuple[str, ...]
) -> list[httpx.Response]:
    transport = httpx.ASGITransport(app)
    async with httpx.AsyncClient(transport=transport, base_url="http://driver.test") as client:
        requests: list[Coroutine[Any, Any, httpx.Response]] = [
            client.get("/api/health", headers={CORRELATION_ID_HEADER: correlation_id})
            for correlation_id in correlation_ids
        ]

        return list(await asyncio.gather(*requests))
