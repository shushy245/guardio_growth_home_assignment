"""Driver for `feature_flags.repository.list_enabled_splits` — the read every visitor creation
goes through.

The write path validates a split before it stores it, but rows also arrive from migrations and
from a psql prompt, which never meet Pydantic. This drives the read against rows shaped that
way, so the invariant is proved where it is relied on rather than where it happens to be set.
"""

from sqlalchemy import update
from sqlalchemy.orm import Session

from app.feature_flags import repository
from app.feature_flags.assignment import FlagSplit
from app.feature_flags.models import FeatureFlagRow
from tests.builders.feature_flag import a_wire_variant

RESULT_SCREEN_TONE = "result_screen_tone"


class FlagSplitsDriver:
    def __init__(self, session: Session) -> None:
        self._session = session
        self._splits: list[FlagSplit] = []
        self._refusal: ValueError | None = None
        self.given = _Given(self)
        self.when = _When(self)
        self.then = _Then(self)

    def _store_variants(self, variants: list[dict[str, object]]) -> None:
        self._session.execute(
            update(FeatureFlagRow)
            .where(FeatureFlagRow.key == RESULT_SCREEN_TONE)
            .values(variants=variants)
        )
        self._session.flush()


class _Given:
    def __init__(self, driver: FlagSplitsDriver) -> None:
        self._driver = driver

    def the_stored_weights_sum_to(self, total: int) -> None:
        """Written past Pydantic, exactly as a migration or a psql session writes JSONB."""
        self._driver._store_variants(
            [
                a_wire_variant().with_key("calm").with_weight(total // 2).build(),
                a_wire_variant().with_key("urgent").with_weight(total - total // 2).build(),
            ]
        )

    def the_stored_flag_has_no_variants(self) -> None:
        self._driver._store_variants([])


class _When:
    def __init__(self, driver: FlagSplitsDriver) -> None:
        self._driver = driver

    def the_enabled_splits_are_read(self) -> None:
        try:
            self._driver._splits = repository.list_enabled_splits(session=self._driver._session)
        except ValueError as refusal:
            self._driver._refusal = refusal


class _Then:
    def __init__(self, driver: FlagSplitsDriver) -> None:
        self._driver = driver

    def the_read_was_refused_naming(self, flag_key: str) -> None:
        refusal = self._driver._refusal
        assert refusal is not None, f"the read returned {self._driver._splits} instead of refusing"
        assert flag_key in str(refusal), (
            f"the refusal does not name the flag that is broken: {refusal}"
        )

    def the_split_was_read(self, flag_key: str) -> None:
        assert self._driver._refusal is None, f"the read was refused: {self._driver._refusal}"
        assert [split.key for split in self._driver._splits] == [flag_key]
