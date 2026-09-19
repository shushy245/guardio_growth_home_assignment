"""HTTP test driver.

Tests read as Given / When / Then and never touch the client directly:

    driver.get.path(PROBE_ROUTE)
    driver.then.status(200)
    driver.then.json({"status": "ok"})

`given.*` seeds state, `get/post.*` performs the one request under test, `then.*` holds
every assertion (Python reserves `assert`, so the Then namespace is `then`).
"""

from __future__ import annotations

import asyncio
from collections.abc import Callable, Coroutine, Iterator
from contextlib import contextmanager
from typing import Any

import httpx2 as httpx
import structlog
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session, sessionmaker
from starlette.types import ASGIApp, Message, Receive, Scope, Send
from structlog.testing import capture_logs
from structlog.typing import EventDict

from app.config import Env
from app.db.session import SessionDep, get_session
from app.main import create_app
from app.middleware.correlation_id import CORRELATION_ID_HEADER
from tests.builders.settings import a_settings
from tests.fakes.breach_catalog import FakeBreachCatalog
from tests.fakes.pwned_password_range import FakePwnedPasswordRange

CRASHING_ROUTE = "/api/_test/crash"
CRASH_DETAIL = "secret detail that must never reach the client"
SESSION_ROUTE = "/api/_test/session"
# A route that needs nothing — no database, no fake, no state. The middleware tests are about
# the middleware, and `/api/health` stopped being trivial when it started proving the database
# answers (BF68); borrowing it would have made every CORS and correlation-id test need Postgres.
PROBE_ROUTE = "/api/_test/probe"
# Port 1 is reserved and unbound: a connect attempt is refused at once rather than hanging.
UNREACHABLE_DATABASE_URL = "postgresql+psycopg://breachscan:breachscan@127.0.0.1:1/breachscan"
TRANSACTION_CLOSED = "transaction closed"
RESPONSE_STARTED = "response started"


class HttpDriver:
    """Builds the app lazily on the first request, so `given.*` can shape settings first."""

    def __init__(self) -> None:
        self._settings = a_settings()
        self._catalog = FakeBreachCatalog()
        self._pwned_passwords = FakePwnedPasswordRange()
        self._crashing_route = False
        self._session_route = False
        self._request_events: list[str] = []
        self._session_override: Session | None = None
        self._cookies: dict[str, str] = {}
        self._built_app: FastAPI | None = None
        self._client: TestClient | None = None
        self._response: httpx.Response | None = None
        self._overlapping: dict[str, httpx.Response] = {}
        self._logs: list[EventDict] = []
        self.given = _Given(self)
        self.get = _Get(self)
        self.post = _Post(self)
        self.patch = _Patch(self)
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
            responses = asyncio.run(_get_probe_concurrently(app, correlation_ids))
        self._logs = logs
        self._overlapping = dict(zip(correlation_ids, responses, strict=True))

    def _app_client(self) -> TestClient:
        if self._client is None:
            self._client = TestClient(self._app())
            for name, value in self._cookies.items():
                self._client.cookies.set(name, value)
        return self._client

    def _app(self) -> FastAPI:
        if self._built_app is None:
            app = create_app(
                self._settings.build(),
                catalog=self._catalog,
                pwned_passwords=self._pwned_passwords,
            )
            _mount_probe_route(app)
            if self._crashing_route:
                _mount_crashing_route(app)
            if self._session_route:
                _mount_session_route(app, events=self._request_events)
            if self._session_override is not None:
                session = self._session_override
                app.dependency_overrides[get_session] = lambda: session
                # The background refresh opens its own transaction from this factory. Bound to
                # the test's connection it lands in the savepoint; left on the real engine it
                # would commit for real and leak rows into the test database. Invariant: never
                # two threads on this connection — it holds only because `TestClient` blocks
                # until background tasks finish. A test that drives two requests concurrently
                # through this driver would break it without a clear failure.
                app.state.session_factory = sessionmaker(
                    bind=session.connection(), join_transaction_mode="create_savepoint"
                )
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

    def env(self, env: Env) -> None:
        self._driver._settings = self._driver._settings.with_env(env)

    def the_database_is_unreachable(self) -> None:
        """A real engine pointed at a port nothing listens on. `create_engine` is lazy, so the
        app still builds and the failure happens where a live outage would: on the connect."""
        self._driver._settings = self._driver._settings.with_database_url(UNREACHABLE_DATABASE_URL)

    def a_route_that_raises(self) -> None:
        """Mounted by the test, never by the app.

        The unhandled-500 path still has to be proved, but a route that exists only to crash has
        no business in production code — S1 shipped one as a probe and this replaces it.
        """
        self._driver._crashing_route = True

    def a_route_that_only_opens_a_session(self) -> None:
        """A handler that asks for the request's session and does nothing with it, over a
        session factory that records the moment the transaction closes. The one thing under
        test is *when* that moment comes relative to the response."""
        self._driver._session_route = True

    def cookie(self, *, name: str, value: str) -> None:
        """A cookie the browser under test carries from the start, before any response set one."""
        self._driver._cookies[name] = value

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

    def empty(self, path: str) -> None:
        self._driver._perform(lambda client: client.post(path))


class _Patch:
    def __init__(self, driver: HttpDriver) -> None:
        self._driver = driver

    def json(
        self, path: str, body: dict[str, Any], *, headers: dict[str, str] | None = None
    ) -> None:
        self._driver._perform(lambda client: client.patch(path, json=body, headers=headers))


class _When:
    def __init__(self, driver: HttpDriver) -> None:
        self._driver = driver

    def two_overlapping_requests(self, correlation_ids: tuple[str, str]) -> None:
        self._driver._perform_concurrently(correlation_ids)

    def the_app_starts_up(self) -> None:
        """Run the lifespan, as the server does on boot. Entering `TestClient` as a context
        manager is the only way the startup hook runs at all: a plain request through the
        client skips it, which is why the sync's *call* was untested wiring (BF77)."""
        with TestClient(self._driver._app()):
            pass


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

    def the_catalog_was_fetched(self, times: int) -> None:
        actual = self._driver._catalog.fetch_count
        assert actual == times, f"expected {times} catalog fetch(es), the source saw {actual}"

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

    def no_log_line_mentions(self, fragment: str) -> None:
        """No captured log line — event name or any field — contains `fragment`."""
        leaking = [log for log in self._driver._logs if fragment in repr(log)]
        assert not leaking, f"log lines leaked {fragment!r}: {leaking}"

    def the_transaction_closed_before_the_response_started(self) -> None:
        """A client that fires its next request the moment this response arrives must find
        the row this request wrote. If the commit runs after the response is sent, it will
        not — and no in-process test client can show it, because that client waits for the
        whole request cycle before handing the response back."""
        events = self._driver._request_events
        assert TRANSACTION_CLOSED in events and RESPONSE_STARTED in events, (
            f"expected both a transaction close and a response start, recorded {events}"
        )
        assert events.index(TRANSACTION_CLOSED) < events.index(RESPONSE_STARTED), (
            f"the response started before the transaction closed: {events}"
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


def _mount_probe_route(app: FastAPI) -> None:
    @app.get(PROBE_ROUTE)
    def _probe() -> dict[str, str]:
        return {"status": "ok"}


def _mount_crashing_route(app: FastAPI) -> None:
    @app.get(CRASHING_ROUTE)
    def _raise() -> None:
        raise RuntimeError(CRASH_DETAIL)


class _RecordingSessionFactory:
    """Stands in for the sessionmaker: a session nobody uses, and a note when it closes."""

    def __init__(self, events: list[str]) -> None:
        self._events = events

    @contextmanager
    def begin(self) -> Iterator[Session]:
        yield Session()
        self._events.append(TRANSACTION_CLOSED)


class _ResponseStartRecorder:
    """Pure ASGI middleware: a note the moment the response's status line goes out."""

    def __init__(self, app: ASGIApp, *, events: list[str]) -> None:
        self._app = app
        self._events = events

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        async def recording_send(message: Message) -> None:
            if message["type"] == "http.response.start":
                self._events.append(RESPONSE_STARTED)
            await send(message)

        await self._app(scope, receive, recording_send)


def _mount_session_route(app: FastAPI, *, events: list[str]) -> None:
    app.state.session_factory = _RecordingSessionFactory(events)
    app.add_middleware(_ResponseStartRecorder, events=events)

    @app.get(SESSION_ROUTE)
    def _open_a_session(_session: SessionDep) -> dict[str, str]:
        return {}


async def _get_probe_concurrently(
    app: FastAPI, correlation_ids: tuple[str, ...]
) -> list[httpx.Response]:
    transport = httpx.ASGITransport(app)
    async with httpx.AsyncClient(transport=transport, base_url="http://driver.test") as client:
        requests: list[Coroutine[Any, Any, httpx.Response]] = [
            client.get(PROBE_ROUTE, headers={CORRELATION_ID_HEADER: correlation_id})
            for correlation_id in correlation_ids
        ]

        return list(await asyncio.gather(*requests))
