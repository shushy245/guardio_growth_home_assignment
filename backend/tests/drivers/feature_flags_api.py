"""Driver for `GET /api/feature-flags` and `PATCH /api/feature-flags/{key}`.

Composes the shared `HttpDriver`. The seeded `result_screen_tone` flag is the fixture; a PATCH
in a test is rolled back with the savepoint, so every test starts from the seed. A save is
always built from a flag the driver *read* first — the token the page would hold is the one
the API handed out, never one invented in a test.
"""

from datetime import datetime

from sqlalchemy import insert
from sqlalchemy.orm import Session

from app.visitors.models import VisitorAssignmentRow, VisitorRow
from tests.builders.settings import TEST_ADMIN_TOKEN
from tests.drivers.http import HttpDriver

RESULT_SCREEN_TONE = "result_screen_tone"
SEEDED_DESCRIPTION = "Tone of the result screen: calm framing vs urgent framing of the same data."
ADMIN_TOKEN_HEADER = "X-Admin-Token"
FLAG_UPDATE_FIELDS = ("description", "isEnabled", "variants", "updatedAt")


class FeatureFlagsApiDriver:
    def __init__(self, http: HttpDriver, session: Session) -> None:
        self._http = http
        self._session = session
        self._read_flag: dict[str, object] | None = None
        self._returned_tokens: list[str] = []
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

    def _read(self) -> dict[str, object]:
        self._http.get.path("/api/feature-flags")
        self._read_flag = self._flag(RESULT_SCREEN_TONE)

        return self._read_flag

    @property
    def _held(self) -> dict[str, object]:
        assert self._read_flag is not None, "given.the_flag_was_read() first"

        return self._read_flag

    @property
    def _held_token(self) -> str:
        token = self._held["updatedAt"]
        assert isinstance(token, str)

        return token

    def _update_payload(self, **edits: object) -> dict[str, object]:
        """The flag as read, with `edits` applied — the fields the update schema accepts."""
        return {**{field: self._held[field] for field in FLAG_UPDATE_FIELDS}, **edits}

    def _save(
        self, payload: dict[str, object], *, key: str = RESULT_SCREEN_TONE, token: str | None
    ) -> None:
        headers = {} if token is None else {ADMIN_TOKEN_HEADER: token}
        self._http.patch.json(f"/api/feature-flags/{key}", payload, headers=headers)
        if self._http._last.status_code == 200:
            self._returned_tokens.append(str(self._http._last.json()["updatedAt"]))

    def _variants_with_cta_label(self, cta_label: str) -> list[dict[str, object]]:
        variants = self._held["variants"]
        assert isinstance(variants, list)

        return [
            {**variant, "config": {**variant["config"], "ctaLabel": cta_label}}
            for variant in variants
        ]

    def _variants_renamed(self, renames: dict[str, str]) -> list[dict[str, object]]:
        variants = self._held["variants"]
        assert isinstance(variants, list)

        return [
            {**variant, "key": renames.get(str(variant["key"]), variant["key"])}
            for variant in variants
        ]

    def _variants_with_weights(self, *weights: int) -> list[dict[str, object]]:
        variants = self._held["variants"]
        assert isinstance(variants, list)

        return [
            {**variant, "weight": weight} for variant, weight in zip(variants, weights, strict=True)
        ]


class _Given:
    def __init__(self, driver: FeatureFlagsApiDriver) -> None:
        self._driver = driver

    def the_flag_was_read(self) -> None:
        self._driver._read()

    def a_visitor_holds_the_variant(self, variant_key: str) -> None:
        """A real assignment row: what a rename would leave pointing at nothing."""
        visitor_id = "vis_00000000000000000000000001"
        session = self._driver._session
        session.execute(insert(VisitorRow).values(id=visitor_id, user_agent=None))
        session.execute(
            insert(VisitorAssignmentRow).values(
                visitor_id=visitor_id, flag_key=RESULT_SCREEN_TONE, variant_key=variant_key
            )
        )
        session.flush()

    def the_flag_was_saved_once_since(self) -> None:
        """Someone else's save landed after the read: the held token is now stale."""
        self._driver._save(
            self._driver._update_payload(description="edited by another operator"),
            token=TEST_ADMIN_TOKEN,
        )
        self._driver._http.then.status(200)


class _When:
    def __init__(self, driver: FeatureFlagsApiDriver) -> None:
        self._driver = driver

    def the_flags_are_listed(self) -> None:
        self._driver._http.get.path("/api/feature-flags")

    def the_cta_label_is_saved_as(self, cta_label: str) -> None:
        self._driver._save(
            self._driver._update_payload(variants=self._driver._variants_with_cta_label(cta_label)),
            token=TEST_ADMIN_TOKEN,
        )

    def the_flag_is_saved_with_the_token_spelled_with_an_explicit_offset(self) -> None:
        """`Z` and `+00:00` are the same instant; the page may send either."""
        held = datetime.fromisoformat(self._driver._held_token)
        assert held.utcoffset() is not None, "the token must be an aware instant"
        self._driver._save(
            self._driver._update_payload(updatedAt=held.isoformat()), token=TEST_ADMIN_TOKEN
        )

    def the_flag_is_saved_twice_carrying_each_returned_token(self) -> None:
        self._driver._save(
            self._driver._update_payload(description="first save"), token=TEST_ADMIN_TOKEN
        )
        first_token = self._driver._returned_tokens[-1]
        self._driver._save(
            self._driver._update_payload(description="second save", updatedAt=first_token),
            token=TEST_ADMIN_TOKEN,
        )

    def the_flag_is_saved_with_the_stale_token(self) -> None:
        self._driver._save(
            self._driver._update_payload(description="stale save"), token=TEST_ADMIN_TOKEN
        )

    def an_unknown_flag_is_saved(self) -> None:
        self._driver._save(
            self._driver._update_payload(), key="no_such_flag", token=TEST_ADMIN_TOKEN
        )

    def the_flag_is_saved_with_weights(self, *weights: int) -> None:
        self._driver._save(
            self._driver._update_payload(variants=self._driver._variants_with_weights(*weights)),
            token=TEST_ADMIN_TOKEN,
        )

    def the_variant_is_renamed(self, old_key: str, new_key: str) -> None:
        self._driver._save(
            self._driver._update_payload(
                variants=self._driver._variants_renamed({old_key: new_key})
            ),
            token=TEST_ADMIN_TOKEN,
        )

    def the_flag_is_saved_without_a_token(self) -> None:
        self._driver._save(self._driver._update_payload(description="anonymous"), token=None)

    def the_flag_is_saved_with_a_wrong_token(self) -> None:
        self._driver._save(
            self._driver._update_payload(description="intruder"), token="not-the-token"
        )


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

    def the_save_was_accepted_with_a_new_token(self) -> None:
        self._driver._http.then.status(200)
        body = self._driver._http._last.json()
        assert set(body) == {"updatedAt"}, f"a PATCH returns only the new token, got {body}"
        assert body["updatedAt"] != self._driver._held_token, "the token did not advance"

    def every_cta_label_now_reads(self, cta_label: str) -> None:
        """Read back through the API: the change is real, not a 200 over nothing."""
        flag = self._driver._read()
        variants = flag["variants"]
        assert isinstance(variants, list)
        actual = [variant["config"]["ctaLabel"] for variant in variants]
        assert actual == [cta_label] * len(variants), f"expected {cta_label!r} on all, got {actual}"

    def both_saves_were_accepted_and_the_token_advanced_each_time(self) -> None:
        self._driver._http.then.status(200)
        tokens = self._driver._returned_tokens
        assert len(tokens) == 2, f"expected two accepted saves, got {len(tokens)}"
        assert tokens[0] != tokens[1], f"the token did not advance between saves: {tokens}"

    def the_save_was_refused_as_stale(self) -> None:
        self._driver._http.then.status(409)
        self._driver._http.then.error_body()

    def the_save_was_refused_as_unauthorised(self) -> None:
        self._driver._http.then.status(401)
        self._driver._http.then.error_body()

    def the_save_was_rejected(self) -> None:
        self._driver._http.then.status(400)
        self._driver._http.then.error_body()

    def the_save_was_rejected_naming(self, fragment: str) -> None:
        self._driver._http.then.status(400)
        self._driver._http.then.error_body()
        body = self._driver._http._last.json()
        assert fragment in body["error"], f"the rejection does not name {fragment!r}: {body}"

    def the_variants_are_still(self, *variant_keys: str) -> None:
        variants = self._driver._read()["variants"]
        assert isinstance(variants, list)
        actual = [variant["key"] for variant in variants]
        assert actual == list(variant_keys), f"expected variants {variant_keys}, got {actual}"

    def the_flag_was_not_found(self) -> None:
        self._driver._http.then.status(404)
        self._driver._http.then.error_body()

    def the_description_is_still(self, description: str) -> None:
        actual = self._driver._read()["description"]
        assert actual == description, f"expected description {description!r}, got {actual!r}"
