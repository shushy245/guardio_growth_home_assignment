"""Driver for `POST /api/visitors` and `GET /api/visitors/{id}`.

Composes the shared `HttpDriver` and keeps visitor vocabulary here. The seeded
`result_screen_tone` flag is the fixture every test starts from; `given.*` reshapes it through
the test's session, which is the same session the app is wired to.
"""

from http.cookies import SimpleCookie

from sqlalchemy import delete, func, select, update
from sqlalchemy.orm import Session

from app.config import Env
from app.feature_flags.models import FeatureFlagRow
from app.visitors.models import VisitorAssignmentRow, VisitorRow
from tests.builders.feature_flag import a_wire_variant
from tests.drivers.http import HttpDriver

RESULT_SCREEN_TONE = "result_screen_tone"
VISITOR_COOKIE = "visitor_id"


UNKNOWN_VISITOR_ID = "vis_00000000000000000000000000"


class VisitorsApiDriver:
    def __init__(self, http: HttpDriver, session: Session) -> None:
        self._http = http
        self._session = session
        self._created_id: str | None = None
        self._created_assignments: dict[str, object] = {}
        self.given = _Given(self)
        self.when = _When(self)
        self.then = _Then(self)

    @property
    def _body(self) -> dict[str, object]:
        body = self._http._last.json()
        assert isinstance(body, dict), f"expected a visitor body, got {body!r}"

        return body

    @property
    def _visitor_id(self) -> str:
        visitor_id = self._body["id"]
        assert isinstance(visitor_id, str), f"id must be a string, got {visitor_id!r}"

        return visitor_id

    @property
    def _assignments(self) -> dict[str, object]:
        assignments = self._body["assignments"]
        assert isinstance(assignments, dict), f"assignments must be a mapping, got {assignments!r}"

        return assignments

    def _visitor_cookie(self) -> SimpleCookie:
        header = self._http._last.headers.get("set-cookie")
        assert header is not None, "no Set-Cookie header on the response"
        cookie: SimpleCookie = SimpleCookie(header)
        assert VISITOR_COOKIE in cookie, f"Set-Cookie does not carry {VISITOR_COOKIE}: {header}"

        return cookie


class _Given:
    def __init__(self, driver: VisitorsApiDriver) -> None:
        self._driver = driver

    def the_app_runs_in(self, env: Env) -> None:
        self._driver._http.given.env(env)

    def a_visitor_exists(self) -> None:
        """Created through the API, so the stored assignment is the real one."""
        self._driver._http.post.empty("/api/visitors")
        self._driver._created_id = self._driver._visitor_id
        self._driver._created_assignments = dict(self._driver._assignments)

    def the_split_no_longer_includes_the_visitors_variant(self) -> None:
        """Move all the weight to the other variant. A recomputed assignment would now be that
        one; only a stored assignment can still answer with the original."""
        assigned = self._driver._created_assignments[RESULT_SCREEN_TONE]
        variants = [
            a_wire_variant().with_key("calm").with_weight(0 if assigned == "calm" else 100),
            a_wire_variant().with_key("urgent").with_weight(0 if assigned == "urgent" else 100),
        ]
        self._driver._session.execute(
            update(FeatureFlagRow)
            .where(FeatureFlagRow.key == RESULT_SCREEN_TONE)
            .values(variants=[variant.build() for variant in variants])
        )
        self._driver._session.flush()

    def the_database_has_forgotten_the_visitor(self) -> None:
        """The browser keeps its cookie across a database reset; the id in it names nobody."""
        self._driver._session.execute(delete(VisitorAssignmentRow))
        self._driver._session.execute(delete(VisitorRow))
        self._driver._session.flush()

    def the_result_screen_tone_flag_is_disabled(self) -> None:
        self._driver._session.execute(
            update(FeatureFlagRow)
            .where(FeatureFlagRow.key == RESULT_SCREEN_TONE)
            .values(is_enabled=False)
        )
        self._driver._session.flush()


class _When:
    def __init__(self, driver: VisitorsApiDriver) -> None:
        self._driver = driver

    def a_visitor_is_created(self) -> None:
        self._driver._http.post.empty("/api/visitors")

    def the_visitor_is_fetched(self) -> None:
        assert self._driver._created_id is not None, "given.a_visitor_exists() first"
        self._driver._http.get.path(f"/api/visitors/{self._driver._created_id}")

    def an_unknown_visitor_is_fetched(self) -> None:
        self._driver._http.get.path(f"/api/visitors/{UNKNOWN_VISITOR_ID}")


class _Then:
    def __init__(self, driver: VisitorsApiDriver) -> None:
        self._driver = driver

    def the_visitor_was_created(self) -> None:
        self._driver._http.then.status(201)

    def the_visitor_was_not_found(self) -> None:
        self._driver._http.then.status(404)
        self._driver._http.then.error_body()

    def the_assignment_is_the_one_made_at_creation(self) -> None:
        self._driver._http.then.status(200)
        assert self._driver._assignments == self._driver._created_assignments, (
            f"fetched {self._driver._assignments}, but creation assigned "
            f"{self._driver._created_assignments}"
        )

    def the_visitor_id_is_prefixed(self, prefix: str) -> None:
        visitor_id = self._driver._visitor_id
        assert visitor_id.startswith(f"{prefix}_"), f"expected a {prefix}_ id, got {visitor_id!r}"

    def the_visitor_is_assigned_to_one_of(self, flag_key: str, *variant_keys: str) -> None:
        assignments = self._driver._assignments
        assert assignments.get(flag_key) in variant_keys, (
            f"expected {flag_key} to be one of {variant_keys}, got {assignments}"
        )

    def the_visitor_has_no_assignments(self) -> None:
        assignments = self._driver._assignments
        assert assignments == {}, f"expected no assignments, got {assignments}"

    def the_assignment_is_stored(self, flag_key: str) -> None:
        """Read through the test's own session: the row the response reports must exist."""
        stored = self._driver._session.execute(
            select(VisitorAssignmentRow.variant_key).where(
                VisitorAssignmentRow.visitor_id == self._driver._visitor_id,
                VisitorAssignmentRow.flag_key == flag_key,
            )
        ).scalar_one_or_none()
        assert stored == self._driver._assignments.get(flag_key), (
            f"stored {stored!r} but the response reported {self._driver._assignments}"
        )

    def the_visitor_was_recognised(self) -> None:
        """Nothing was created: 200, not the 201 a new identity would answer with."""
        self._driver._http.then.status(200)

    def the_visitor_is_the_one_already_created(self) -> None:
        assert self._driver._visitor_id == self._driver._created_id, (
            f"expected the stored visitor {self._driver._created_id!r}, "
            f"got a new one: {self._driver._visitor_id!r}"
        )

    def the_visitor_is_not_the_one_already_created(self) -> None:
        assert self._driver._visitor_id != self._driver._created_id, (
            f"expected a new visitor, got the stored {self._driver._created_id!r} back"
        )

    def the_assignments_are_the_ones_already_stored(self) -> None:
        assert self._driver._assignments == self._driver._created_assignments, (
            f"got {self._driver._assignments}, but the visitor was assigned "
            f"{self._driver._created_assignments}"
        )

    def exactly_one_visitor_exists(self) -> None:
        count = self._driver._session.execute(
            select(func.count()).select_from(VisitorRow)
        ).scalar_one()
        assert count == 1, f"expected one visitor row, found {count}"

    def the_visitor_cookie_names_the_visitor(self) -> None:
        cookie = self._driver._visitor_cookie()
        assert cookie[VISITOR_COOKIE].value == self._driver._visitor_id

    def the_visitor_cookie_is_http_only_and_lax(self) -> None:
        morsel = self._driver._visitor_cookie()[VISITOR_COOKIE]
        assert morsel["httponly"], f"visitor cookie is not HttpOnly: {morsel.OutputString()}"
        assert morsel["samesite"].lower() == "lax", (
            f"expected SameSite=Lax: {morsel.OutputString()}"
        )

    def the_visitor_cookie_is_secure(self) -> None:
        morsel = self._driver._visitor_cookie()[VISITOR_COOKIE]
        assert morsel["secure"], f"visitor cookie is not Secure: {morsel.OutputString()}"

    def the_visitor_cookie_is_not_secure(self) -> None:
        """Over plain http on localhost a Secure cookie is one the browser silently drops."""
        morsel = self._driver._visitor_cookie()[VISITOR_COOKIE]
        assert not morsel["secure"], f"visitor cookie is Secure in dev: {morsel.OutputString()}"
