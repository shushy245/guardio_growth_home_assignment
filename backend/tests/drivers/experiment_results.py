"""Driver for `experiments.repository.count_visitors_per_step` — the read the dashboard's funnel
is built from.

Rows are seeded straight into the tables rather than through the API. The API can only put a
visitor in the arm the hash chooses for them, and these scenarios need a visitor in a *chosen*
arm whose events say something else — the shapes design call 1 (docs/plan.md, S7) exists for:
the arm is the stored assignment, the event's tag is only the audit trail.
"""

from datetime import UTC, datetime

from sqlalchemy import insert
from sqlalchemy.orm import Session

from app.experiments import repository
from app.experiments.results import StepCount
from app.funnel_events.models import FunnelEventName, FunnelEventRow
from app.shared.ids import generate_unique_id
from app.visitors.models import VisitorAssignmentRow, VisitorRow

RESULT_SCREEN_TONE = "result_screen_tone"


class ExperimentResultsDriver:
    def __init__(self, session: Session) -> None:
        self._session = session
        self._last_visitor_id: str | None = None
        self._counts: list[StepCount] = []
        self.given = _Given(self)
        self.when = _When(self)
        self.then = _Then(self)

    @property
    def _the_last_visitor(self) -> str:
        assert self._last_visitor_id is not None, "given.a_visitor_in_arm(...) first"

        return self._last_visitor_id

    def _insert_visitor(self) -> str:
        visitor_id = generate_unique_id("vis")
        self._session.execute(insert(VisitorRow).values(id=visitor_id, user_agent=None))
        self._last_visitor_id = visitor_id

        return visitor_id

    def _insert_assignment(self, *, visitor_id: str, variant_key: str) -> None:
        self._session.execute(
            insert(VisitorAssignmentRow).values(
                visitor_id=visitor_id, flag_key=RESULT_SCREEN_TONE, variant_key=variant_key
            )
        )

    def _insert_event(
        self, *, visitor_id: str, step: FunnelEventName, tagged_as: str | None
    ) -> None:
        self._session.execute(
            insert(FunnelEventRow).values(
                id=generate_unique_id("evt"),
                visitor_id=visitor_id,
                name=step,
                flag_key=None if tagged_as is None else RESULT_SCREEN_TONE,
                variant_key=tagged_as,
                occurred_at=datetime.now(UTC),
                metadata_={},
            )
        )

    def _count_for(self, *, arm: str, step: FunnelEventName) -> int:
        """Absent is zero: a step nobody in the arm reached has no row, and reads as 0."""
        matching = [
            count.visitors
            for count in self._counts
            if count.variant_key == arm and count.step == step
        ]
        assert len(matching) <= 1, f"more than one count for ({arm!r}, {step}): {self._counts}"

        return matching[0] if matching else 0


class _Given:
    def __init__(self, driver: ExperimentResultsDriver) -> None:
        self._driver = driver

    def a_visitor_in_arm(self, variant_key: str, *, took: tuple[FunnelEventName, ...]) -> None:
        """A visitor assigned to `variant_key`, with one event per step, each tagged with it —
        exactly what the event endpoint writes for an ordinary visit."""
        visitor_id = self._driver._insert_visitor()
        self._driver._insert_assignment(visitor_id=visitor_id, variant_key=variant_key)
        for step in took:
            self._driver._insert_event(visitor_id=visitor_id, step=step, tagged_as=variant_key)
        self._driver._session.flush()

    def the_visitor_recorded_again(self, step: FunnelEventName, *, tagged_as: str) -> None:
        """A second row for the last visitor: a retry with a fresh id, or a step recorded while
        the event's tag said something other than the stored assignment."""
        self._driver._insert_event(
            visitor_id=self._driver._the_last_visitor, step=step, tagged_as=tagged_as
        )
        self._driver._session.flush()

    def a_visitor_outside_the_experiment(self, *, took: tuple[FunnelEventName, ...]) -> None:
        """No assignment for the flag, and untagged steps — a visitor who arrived while it was
        disabled."""
        visitor_id = self._driver._insert_visitor()
        for step in took:
            self._driver._insert_event(visitor_id=visitor_id, step=step, tagged_as=None)
        self._driver._session.flush()


class _When:
    def __init__(self, driver: ExperimentResultsDriver) -> None:
        self._driver = driver

    def the_funnel_is_read(self) -> None:
        self._driver._counts = repository.count_visitors_per_step(
            session=self._driver._session, flag_key=RESULT_SCREEN_TONE
        )


class _Then:
    def __init__(self, driver: ExperimentResultsDriver) -> None:
        self._driver = driver

    def the_arm_counted(self, *, arm: str, step: FunnelEventName, visitors: int) -> None:
        actual = self._driver._count_for(arm=arm, step=step)
        assert actual == visitors, (
            f"expected {visitors} visitor(s) in arm {arm!r} at {step}, counted {actual}: "
            f"{self._driver._counts}"
        )

    def nothing_was_counted(self) -> None:
        assert self._driver._counts == [], f"expected no counts, read {self._driver._counts}"
