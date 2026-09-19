"""Driver for `POST /api/signups`.

Composes the shared `HttpDriver`. A visitor, when the scenario has one, is minted through the
real `POST /api/visitors` so the cookie on the test client's jar is the one a browser would
carry. The driver remembers what the last submission sent, and the Then reads the stored row
back through the test's own session — the same one the app is wired to.

Dev env for every scenario that mints a visitor: the test client speaks plain http, and the
`Secure` cookie every other env sets is one no client sends back over http.
"""

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.config import Env
from app.signups import repository
from app.signups.models import SignupRow
from app.signups.password_hash import ARGON2ID_PREFIX, PasswordHasher
from app.signups.repository import NewSignup
from app.visitors.cookie import VISITOR_COOKIE
from tests.builders.signup import _SignupBuilder
from tests.drivers.http import HttpDriver

UNKNOWN_VISITOR_ID = "vis_00000000000000000000000000"


class SignupsApiDriver:
    def __init__(self, http: HttpDriver, session: Session) -> None:
        self._http = http
        self._session = session
        self._visitor_id: str | None = None
        self._submitted: dict[str, object] | None = None
        self._direct_insert_result: str | None = None
        self._direct_insert_attempted = False
        self.given = _Given(self)
        self.when = _When(self)
        self.then = _Then(self)

    def _create_visitor(self) -> None:
        self._http.given.env(Env.DEV)
        self._http.post.empty("/api/visitors")
        body = self._http._last.json()
        assert isinstance(body, dict), f"expected a visitor body, got {body!r}"
        visitor_id = body["id"]
        assert isinstance(visitor_id, str)
        self._visitor_id = visitor_id

    def _post(self, signup: _SignupBuilder) -> None:
        self._submitted = signup.build()
        self._http.post.json("/api/signups", self._submitted)

    @property
    def _the_submission(self) -> dict[str, object]:
        assert self._submitted is not None, "when.a_signup_is_submitted(...) first"

        return self._submitted

    @property
    def _body(self) -> dict[str, object]:
        body = self._http._last.json()
        assert isinstance(body, dict), f"expected a JSON object, got {body!r}"

        return body

    def _the_stored_signup(self) -> SignupRow:
        rows = self._session.execute(select(SignupRow)).scalars().all()
        assert len(rows) == 1, f"expected exactly one signup row, found {len(rows)}"

        return rows[0]

    def _count(self) -> int:
        return self._session.execute(select(func.count()).select_from(SignupRow)).scalar_one()


class _Given:
    def __init__(self, driver: SignupsApiDriver) -> None:
        self._driver = driver

    def a_visitor_exists(self) -> None:
        """Minted through the API, so the cookie is the one the server handed out."""
        self._driver._create_visitor()

    def the_browser_carries_a_cookie_naming_nobody(self) -> None:
        """The browser outlived the database: its cookie names a visitor no row remembers."""
        self._driver._http.given.cookie(name=VISITOR_COOKIE, value=UNKNOWN_VISITOR_ID)

    def an_account_already_exists(self, signup: _SignupBuilder) -> None:
        self._driver._post(signup)
        self._driver._http.then.status(201)


class _When:
    def __init__(self, driver: SignupsApiDriver) -> None:
        self._driver = driver

    def a_signup_is_submitted(self, signup: _SignupBuilder) -> None:
        self._driver._post(signup)

    def a_duplicate_is_inserted_bypassing_the_handler(self, signup: _SignupBuilder) -> None:
        """Straight at the repository: the proof that the conflict is the index's answer and
        not a read the handler made first, which a concurrent request could race."""
        body = signup.build()
        email = body["email"]
        assert isinstance(email, str)
        self._driver._direct_insert_attempted = True
        inserted = repository.insert_signup(
            session=self._driver._session,
            signup=NewSignup(
                id="sup_00000000000000000000000000",
                visitor_id=None,
                email=email.lower(),
                plan=self._driver._the_stored_signup().plan,
                password_hash=PasswordHasher().hash_password("another password"),
                password_was_pwned=False,
            ),
        )
        self._driver._direct_insert_result = None if inserted is None else inserted.id


class _Then:
    def __init__(self, driver: SignupsApiDriver) -> None:
        self._driver = driver

    def the_account_was_created(self) -> None:
        self._driver._http.then.status(201)
        body = self._driver._body
        assert set(body) == {"id", "createdAt"}, (
            f"a create answers only what the client cannot know; got {sorted(body)}"
        )

    def the_signup_id_is_prefixed(self, prefix: str) -> None:
        signup_id = self._driver._body["id"]
        assert isinstance(signup_id, str) and signup_id.startswith(f"{prefix}_"), (
            f"expected a {prefix}_ id, got {signup_id!r}"
        )

    def the_email_is_already_taken(self) -> None:
        self._driver._http.then.status(409)
        self._driver._http.then.error_body()

    def the_signup_was_refused(self) -> None:
        self._driver._http.then.status(400)
        self._driver._http.then.error_body()

    def the_stored_email_is(self, email: str) -> None:
        stored = self._driver._the_stored_signup().email
        assert stored == email, f"expected the stored email {email!r}, found {stored!r}"

    def the_stored_plan_is(self, plan: str) -> None:
        stored = self._driver._the_stored_signup().plan
        assert stored == plan, f"expected the stored plan {plan!r}, found {stored!r}"

    def the_stored_password_is_an_argon2id_hash_of_the_one_submitted(self) -> None:
        submitted = self._driver._the_submission["password"]
        assert isinstance(submitted, str)
        stored = self._driver._the_stored_signup().password_hash
        assert stored.startswith(ARGON2ID_PREFIX), f"not an argon2id hash: {stored[:20]!r}"
        assert submitted not in stored, "the password itself is in the stored hash"
        assert PasswordHasher().verify_password(password=submitted, password_hash=stored), (
            "the stored hash does not verify against the submitted password"
        )

    def the_stored_flag_says_the_password_was_leaked(self) -> None:
        assert self._driver._the_stored_signup().password_was_pwned is True

    def the_stored_signup_belongs_to_the_visitor(self) -> None:
        stored = self._driver._the_stored_signup().visitor_id
        assert stored == self._driver._visitor_id, (
            f"stored visitor {stored!r}, but the cookie named {self._driver._visitor_id!r}"
        )

    def the_stored_signup_has_no_visitor(self) -> None:
        stored = self._driver._the_stored_signup().visitor_id
        assert stored is None, f"expected no visitor, stored {stored!r}"

    def exactly_one_signup_is_stored(self) -> None:
        count = self._driver._count()
        assert count == 1, f"expected one signup row, found {count}"

    def no_signup_is_stored(self) -> None:
        count = self._driver._count()
        assert count == 0, f"expected no signup row, found {count}"

    def the_direct_insert_reported_the_conflict(self) -> None:
        assert self._driver._direct_insert_attempted, "when.a_duplicate_is_inserted_… first"
        assert self._driver._direct_insert_result is None, (
            f"a duplicate email was inserted as {self._driver._direct_insert_result!r}"
        )

    def neither_the_response_nor_the_log_carries_the_password_or_its_hash(self) -> None:
        submitted = self._driver._the_submission["password"]
        assert isinstance(submitted, str)
        self._driver._http.then.body_lacks(submitted)
        self._driver._http.then.body_lacks(ARGON2ID_PREFIX)
        self._driver._http.then.no_log_line_mentions(submitted)
        self._driver._http.then.no_log_line_mentions(ARGON2ID_PREFIX)
