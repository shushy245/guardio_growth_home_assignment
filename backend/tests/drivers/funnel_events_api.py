"""Driver for `POST /api/funnel-events`.

Composes the shared `HttpDriver`. The visitor a test records events for is minted through the
real `POST /api/visitors`, so the assignment an event must be tagged with is the stored one —
the driver remembers what creation answered and the Then compares the row against it.
"""

from sqlalchemy import func, select, update
from sqlalchemy.orm import Session

from app.feature_flags.models import FeatureFlagRow
from app.funnel_events.models import FunnelEventRow
from tests.builders.funnel_event import _FunnelEventBuilder
from tests.drivers.http import HttpDriver

RESULT_SCREEN_TONE = "result_screen_tone"


class FunnelEventsApiDriver:
    def __init__(self, http: HttpDriver, session: Session) -> None:
        self._http = http
        self._session = session
        self._visitor_id: str | None = None
        self._visitor_assignments: dict[str, object] = {}
        self._posted_event_id: str | None = None
        self.given = _Given(self)
        self.when = _When(self)
        self.then = _Then(self)

    @property
    def _the_visitor(self) -> str:
        assert self._visitor_id is not None, "given.a_visitor_exists() first"

        return self._visitor_id

    @property
    def _the_posted_event(self) -> str:
        assert self._posted_event_id is not None, "when.the_visitor_records(...) first"

        return self._posted_event_id

    def _create_visitor(self) -> None:
        self._http.post.empty("/api/visitors")
        body = self._http._last.json()
        assert isinstance(body, dict), f"expected a visitor body, got {body!r}"
        visitor_id = body["id"]
        assignments = body["assignments"]
        assert isinstance(visitor_id, str) and isinstance(assignments, dict)
        self._visitor_id = visitor_id
        self._visitor_assignments = dict(assignments)

    def _post(self, event: _FunnelEventBuilder) -> None:
        body = event.build()
        event_id = body["id"]
        assert isinstance(event_id, str)
        self._posted_event_id = event_id
        self._http.post.json("/api/funnel-events", body)

    def _stored_event(self) -> FunnelEventRow:
        row = self._session.execute(
            select(FunnelEventRow).where(FunnelEventRow.id == self._the_posted_event)
        ).scalar_one_or_none()
        assert row is not None, f"no funnel_event row with id {self._the_posted_event!r}"

        return row


class _Given:
    def __init__(self, driver: FunnelEventsApiDriver) -> None:
        self._driver = driver

    def a_visitor_exists(self) -> None:
        """Minted through the API, so the assignment the event must carry is the stored one."""
        self._driver._create_visitor()

    def a_visitor_exists_outside_the_experiment(self) -> None:
        """The flag was disabled when they arrived, so they hold no assignment at all."""
        self._driver._session.execute(
            update(FeatureFlagRow)
            .where(FeatureFlagRow.key == RESULT_SCREEN_TONE)
            .values(is_enabled=False)
        )
        self._driver._session.flush()
        self._driver._create_visitor()

    def the_visitor_already_recorded(self, event: _FunnelEventBuilder) -> None:
        self._driver._post(event.for_visitor(self._driver._the_visitor))
        self._driver._http.then.status(201)


class _When:
    def __init__(self, driver: FunnelEventsApiDriver) -> None:
        self._driver = driver

    def the_visitor_records(self, event: _FunnelEventBuilder) -> None:
        self._driver._post(event.for_visitor(self._driver._the_visitor))

    def an_event_is_recorded_for_a_visitor_nobody_knows(self, event: _FunnelEventBuilder) -> None:
        """The builder's default visitor id names nobody; posted as built."""
        self._driver._post(event)


class _Then:
    def __init__(self, driver: FunnelEventsApiDriver) -> None:
        self._driver = driver

    def the_event_was_recorded(self) -> None:
        self._driver._http.then.status(201)

    def the_event_was_refused(self) -> None:
        self._driver._http.then.status(400)
        self._driver._http.then.error_body()

    def the_visitor_was_not_found(self) -> None:
        self._driver._http.then.status(404)
        self._driver._http.then.error_body()

    def the_stored_event_is_tagged_with_the_visitors_assignment(self) -> None:
        row = self._driver._stored_event()
        expected = self._driver._visitor_assignments.get(RESULT_SCREEN_TONE)
        assert expected is not None, "the visitor was created outside the experiment"
        assert (row.flag_key, row.variant_key) == (RESULT_SCREEN_TONE, expected), (
            f"stored ({row.flag_key!r}, {row.variant_key!r}), but creation assigned "
            f"{self._driver._visitor_assignments}"
        )

    def the_stored_event_has_no_experiment_tag(self) -> None:
        row = self._driver._stored_event()
        assert (row.flag_key, row.variant_key) == (None, None), (
            f"expected no tag, stored ({row.flag_key!r}, {row.variant_key!r})"
        )

    def the_stored_event_is_named(self, name: str) -> None:
        row = self._driver._stored_event()
        assert row.name == name, f"expected the stored name {name!r}, found {row.name!r}"

    def the_stored_event_carries_metadata(self, metadata: dict[str, object]) -> None:
        row = self._driver._stored_event()
        assert row.metadata_ == metadata, f"expected metadata {metadata}, stored {row.metadata_}"

    def exactly_one_event_is_stored(self) -> None:
        count = self._driver._session.execute(
            select(func.count()).select_from(FunnelEventRow)
        ).scalar_one()
        assert count == 1, f"expected one funnel_event row, found {count}"

    def no_event_is_stored(self) -> None:
        count = self._driver._session.execute(
            select(func.count()).select_from(FunnelEventRow)
        ).scalar_one()
        assert count == 0, f"expected no funnel_event row, found {count}"
