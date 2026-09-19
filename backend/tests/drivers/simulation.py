"""Driver for `experiments.simulation.simulate_traffic` — simulated visitors through the real
API, into the real tables.

Every simulated visitor is a fresh `TestClient` over the one app the `HttpDriver` built, so each
carries its own cookie jar the way a separate browser would. Dev env, because the test client
speaks plain http and a `Secure` cookie is one no client sends back over it. The Then reads
back through the same repository query the dashboard uses.
"""

import random
from collections import Counter
from itertools import pairwise

from fastapi.testclient import TestClient
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.config import Env
from app.experiments import repository
from app.experiments.results import FUNNEL_IN_ORDER, StepPairCount
from app.experiments.simulation import simulate_traffic
from app.funnel_events.models import FunnelEventRow
from app.visitors.models import VisitorAssignmentRow, VisitorRow
from tests.drivers.http import HttpDriver

RESULT_SCREEN_TONE = "result_screen_tone"
ACTIVATION_RATES = {"calm": 0.08, "urgent": 0.10}


class SimulationDriver:
    def __init__(self, http: HttpDriver, session: Session) -> None:
        self._http = http
        self._session = session
        self._visitors_sent = 0
        self.when = _When(self)
        self.then = _Then(self)

    def _counts(self) -> list[StepPairCount]:
        return repository.count_visitors_per_step_pair(
            session=self._session, flag_key=RESULT_SCREEN_TONE
        )

    def _funnel_of(self, arm: str) -> list[int]:
        visitors_at = {
            count.reached: count.visitors
            for count in self._counts()
            if count.variant_key == arm and count.reached == count.and_reached
        }

        return [visitors_at.get(step, 0) for step in FUNNEL_IN_ORDER]

    def _arms(self) -> Counter[str]:
        rows = self._session.execute(
            select(VisitorAssignmentRow.variant_key).where(
                VisitorAssignmentRow.flag_key == RESULT_SCREEN_TONE
            )
        ).scalars()

        return Counter(rows)


class _When:
    def __init__(self, driver: SimulationDriver) -> None:
        self._driver = driver

    def traffic_is_simulated(self, *, visitors: int) -> None:
        self._driver._http.given.env(Env.DEV)
        app = self._driver._http._app()
        self._driver._visitors_sent = visitors
        simulate_traffic(
            visitors=visitors,
            activation_rates=ACTIVATION_RATES,
            rng=random.SystemRandom(),
            open_browser=lambda: TestClient(app),
        )


class _Then:
    def __init__(self, driver: SimulationDriver) -> None:
        self._driver = driver

    def every_simulated_visitor_is_a_distinct_visitor(self) -> None:
        """BF47's shape: a shared cookie jar makes every visit after the first the *same*
        visitor, because visitor creation recognises the cookie and hands back the known id."""
        sent = self._driver._visitors_sent
        stored = self._driver._session.execute(
            select(func.count()).select_from(VisitorRow)
        ).scalar_one()
        assert stored == sent, f"sent {sent} simulated visitors, the table holds {stored}"
        with_events = self._driver._session.execute(
            select(func.count(func.distinct(FunnelEventRow.visitor_id)))
        ).scalar_one()
        assert with_events == sent, f"{with_events} distinct visitors recorded events, not {sent}"

    def each_arm_holds_a_share_of_visitors_within(self, *, points: float) -> None:
        """Absolute points of the configured 50/50 split, so the bound is a property of the
        assignment rule and not a flake budget: at 200 visitors, ±15 points is ±4 standard
        deviations of a fair coin."""
        arms = self._driver._arms()
        sent = self._driver._visitors_sent
        for arm in ACTIVATION_RATES:
            share = arms[arm] / sent
            assert abs(share - 0.5) <= points, f"arm {arm!r} holds {share:.0%} of {sent}: {arms}"

    def every_funnel_narrows_step_by_step(self) -> None:
        """No step counts more visitors than the one before it — a visitor who dropped out
        never records a later step — and not everyone activated. Only the upper bound: at 200
        visitors an arm expects ~6 activations, and `0 < activation` was a 0.15% flake (R-10)."""
        for arm in ACTIVATION_RATES:
            funnel = self._driver._funnel_of(arm)
            by_step = dict(zip(FUNNEL_IN_ORDER, funnel, strict=True))
            assert all(later <= earlier for earlier, later in pairwise(funnel)), (
                f"arm {arm!r} funnel grows at some step: {by_step}"
            )
            landing, activation = funnel[0], funnel[-1]
            assert activation < landing, (
                f"arm {arm!r}: expected fewer than {landing} to activate, got {activation}"
            )

    def every_event_is_tagged_with_its_visitors_arm(self) -> None:
        """The API stamped the tag; the simulator sent none. Every stored event carries the
        variant its visitor holds — `IS DISTINCT FROM`, so a missing tag counts as a mismatch
        too (R-5: the first form only checked that *a* flag was stamped)."""
        mismatched = self._driver._session.execute(
            select(func.count())
            .select_from(FunnelEventRow)
            .join(
                VisitorAssignmentRow,
                (VisitorAssignmentRow.visitor_id == FunnelEventRow.visitor_id)
                & (VisitorAssignmentRow.flag_key == RESULT_SCREEN_TONE),
            )
            .where(FunnelEventRow.variant_key.is_distinct_from(VisitorAssignmentRow.variant_key))
        ).scalar_one()
        assert mismatched == 0, f"{mismatched} events carry a tag other than their visitor's arm"
