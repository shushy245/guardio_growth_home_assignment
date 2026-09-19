"""Driver for `GET /api/experiments/{flagKey}/results` — the dashboard's one read.

Composes the shared `HttpDriver` for the request and the repository-level
`ExperimentResultsDriver` for seeding, so the arm a visitor sits in is chosen by the test rather
than by the hash. The body is decoded with a JSON parser that refuses `NaN` and `Infinity`:
Python's default accepts both, and the dashboard's `JSON.parse` does not, so a lenient decode
here would pass a body the browser would throw on.
"""

import json
from typing import Any

from sqlalchemy.orm import Session

from app.experiments.recommendation import Recommendation
from app.funnel_events.models import FunnelEventName
from tests.drivers.experiment_results import RESULT_SCREEN_TONE, ExperimentResultsDriver
from tests.drivers.http import HttpDriver

UNKNOWN_FLAG = "no_such_experiment"
FUNNEL_IN_ORDER = tuple(FunnelEventName)


def _refuse_non_finite(literal: str) -> None:
    msg = f"the body carries {literal}, which is not JSON and which JSON.parse rejects"
    raise AssertionError(msg)


class ExperimentsApiDriver:
    def __init__(self, http: HttpDriver, session: Session) -> None:
        self._http = http
        self._seed = ExperimentResultsDriver(session)
        self.given = self._seed.given
        self.when = _When(self)
        self.then = _Then(self)

    def _body(self) -> dict[str, Any]:
        body = json.loads(self._http._last.text, parse_constant=_refuse_non_finite)
        assert isinstance(body, dict), f"expected a results body, got {body!r}"

        return body

    def _arm(self, role: str) -> dict[str, Any]:
        arm = self._body()[role]
        assert isinstance(arm, dict), f"expected the {role} arm to be an object, got {arm!r}"

        return arm

    def _metric(self, *, arm: str, metric: str) -> dict[str, Any]:
        read = self._arm(arm)[metric]
        assert isinstance(read, dict), f"expected {arm}.{metric} to be an object, got {read!r}"

        return read


class _When:
    def __init__(self, driver: ExperimentsApiDriver) -> None:
        self._driver = driver

    def the_results_are_read(self) -> None:
        self._driver._http.get.path(f"/api/experiments/{RESULT_SCREEN_TONE}/results")

    def the_results_are_read_for_an_unknown_flag(self) -> None:
        self._driver._http.get.path(f"/api/experiments/{UNKNOWN_FLAG}/results")


class _Then:
    def __init__(self, driver: ExperimentsApiDriver) -> None:
        self._driver = driver

    def the_read_succeeded(self) -> None:
        self._driver._http.then.status(200)

    def the_flag_was_not_found(self) -> None:
        self._driver._http.then.status(404)
        self._driver._http.then.error_body()

    def the_arms_are(self, *, control: str, variant: str) -> None:
        keys = (self._driver._arm("control")["key"], self._driver._arm("variant")["key"])
        assert keys == (control, variant), f"expected arms {(control, variant)}, got {keys}"

    def the_hypothesis_is_stated(self) -> None:
        hypothesis = self._driver._body()["hypothesis"]
        statement = hypothesis.get("statement")
        assert isinstance(statement, str) and statement, f"no hypothesis statement: {hypothesis}"
        assert hypothesis["baselineRate"] > 0 and hypothesis["minimumDetectableRelativeLift"] > 0

    def the_funnel_lists_every_step_in_order(self, *, arm: str) -> None:
        names = [step["name"] for step in self._driver._arm(arm)["steps"]]
        assert names == list(FUNNEL_IN_ORDER), f"{arm} steps are {names}"

    def the_step_reads(self, *, arm: str, step: FunnelEventName, visitors: int) -> None:
        counts = {entry["name"]: entry["visitors"] for entry in self._driver._arm(arm)["steps"]}
        assert counts.get(step) == visitors, f"{arm} at {step}: expected {visitors}, got {counts}"

    def the_metric_reads(
        self, *, arm: str, metric: str, successes: int, trials: int, rate: float | None
    ) -> None:
        read = self._driver._metric(arm=arm, metric=metric)
        expected = {"successes": successes, "trials": trials, "rate": rate}
        assert read == expected, f"{arm}.{metric}: expected {expected}, got {read}"

    def the_test_reports_a_p_value(self) -> None:
        test = self._driver._body()["test"]
        assert isinstance(test, dict) and 0 <= test["pValue"] <= 1, f"no z-test in the body: {test}"

    def the_lift_is_stated_on_both_scales(self) -> None:
        lift = self._driver._body()["lift"]
        assert isinstance(lift, dict), f"no lift in the body: {lift}"
        for scale in ("absolute", "relative"):
            estimate = lift[scale]
            assert estimate["low"] <= estimate["point"] <= estimate["high"], f"{scale}: {estimate}"

    def the_statistics_are_absent(self) -> None:
        body = self._driver._body()
        assert (body["test"], body["lift"]) == (None, None), (
            f"expected null statistics, got test={body['test']} lift={body['lift']}"
        )

    def the_sample_reads(self, *, required_per_arm: int, reached_per_arm: int) -> None:
        sample = self._driver._body()["sample"]
        expected = {"requiredPerArm": required_per_arm, "reachedPerArm": reached_per_arm}
        assert sample == expected, f"expected sample {expected}, got {sample}"

    def the_recommendation_is(self, recommendation: Recommendation) -> None:
        actual = self._driver._body()["recommendation"]
        assert actual == recommendation, f"expected {recommendation}, got {actual!r}"
