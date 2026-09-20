"""Simulated visitors through the real HTTP API, one browser each.

The simulator *encodes* the effect it is asked for: an arm's activation rate is an input, so the
read it produces validates the pipeline and the statistics, never the hypothesis. What it does
exercise for real is everything between a browser and the dashboard — the cookie identity, the
server-side assignment, the tag on every step, the distinct-visitor count.

One browser per visitor is the whole design (BF47). The event endpoint identifies a browser by
its `visitor_id` cookie and refuses a body that names one, and visitor creation recognises a
cookie it has seen and answers with the *same* visitor. A shared jar would therefore not be
fifty visitors with one cookie each but one visitor fifty times over. `open_browser` opens a
fresh client, with a fresh jar, for every visitor.

`httpx2` is imported here for the client type only: the seam is the factory, and the test hands
it a `TestClient`, which is that same client over an in-process app.
"""

import random
from collections.abc import Callable, Mapping
from dataclasses import dataclass
from datetime import UTC, datetime

import httpx2 as httpx
import structlog

from app.experiments.hypothesis import RESULT_SCREEN_TONE
from app.funnel_events.models import FunnelEventName
from app.shared.ids import generate_unique_id

log = structlog.get_logger()

# The funnel's shape, shared by both arms: how many of the visitors at one step reach the next.
# Only the last transition differs by arm, and it is solved from the activation rate asked for
# so that activation / scan_completed comes out at that rate.
SCAN_STARTED_OF_LANDING = 0.85
SCAN_COMPLETED_OF_SCAN_STARTED = 0.95
CTA_CLICK_OF_SCAN_COMPLETED = 0.35
SIGNUP_STARTED_OF_CTA_CLICK = 0.60
# The highest activation rate the shape above can produce: everyone who starts signing up.
MAX_ACTIVATION_RATE = CTA_CLICK_OF_SCAN_COMPLETED * SIGNUP_STARTED_OF_CTA_CLICK

LOG_EVERY = 500
# How many visits may fail before the run is called off — whether the failure is a refusal the
# server sent or a request that never came back. One is a flaky request and the next visitor is
# unaffected; a stream of them is an API that is down, and walking the remaining thousands into
# it writes half-funnels the dashboard cannot tell from real drop-off (BF72).
MAX_FAILED_VISITS = 10


class SimulationError(Exception):
    """The API answered something the walk cannot continue from. Loud, with the response."""


@dataclass(frozen=True)
class _Transition:
    step: FunnelEventName
    probability: float


def plan_transitions(*, activation_rate: float) -> tuple[_Transition, ...]:
    """The steps in order, each with the chance of reaching it from the one before.

    Pure, and the one place the funnel's shape is written. `activation_rate` is a rate of
    `scan_completed`, the primary metric's denominator, so the last conditional is that rate
    divided by the two transitions between them.
    """
    if not 0 < activation_rate <= MAX_ACTIVATION_RATE:
        msg = (
            f"plan_transitions: activation rate {activation_rate} is outside "
            f"(0, {MAX_ACTIVATION_RATE:.2f}], the ceiling this funnel shape can produce"
        )
        raise ValueError(msg)

    return (
        _Transition(FunnelEventName.LANDING_VIEW, 1.0),
        _Transition(FunnelEventName.SCAN_STARTED, SCAN_STARTED_OF_LANDING),
        _Transition(FunnelEventName.SCAN_COMPLETED, SCAN_COMPLETED_OF_SCAN_STARTED),
        _Transition(FunnelEventName.CTA_CLICK, CTA_CLICK_OF_SCAN_COMPLETED),
        _Transition(FunnelEventName.SIGNUP_STARTED, SIGNUP_STARTED_OF_CTA_CLICK),
        _Transition(FunnelEventName.ACTIVATION, activation_rate / MAX_ACTIVATION_RATE),
    )


def walk(
    *, transitions: tuple[_Transition, ...], rng: random.Random
) -> tuple[FunnelEventName, ...]:
    """The steps one visitor takes: each is reached with its probability, and the first one
    missed ends the visit — a visitor who left never records a later step."""
    taken: list[FunnelEventName] = []
    for transition in transitions:
        if rng.random() >= transition.probability:
            break
        taken.append(transition.step)

    return tuple(taken)


def simulate_traffic(
    *,
    visitors: int,
    activation_rates: Mapping[str, float],
    rng: random.Random,
    open_browser: Callable[[], httpx.Client],
    run_id: str,
) -> None:
    """Send `visitors` visitors through the API, each in a browser of their own.

    The arm is whatever the server assigned — the simulator never chooses it, so the split the
    dashboard reads is the assignment rule's, not the script's. `activation_rates` must name
    every arm the flag can assign; a visitor landing in one it does not name is an error, not a
    visitor silently walked with someone else's rate.

    `run_id` is stamped into every event's metadata and injected rather than generated here, so
    the caller can print the id of the run it started and find its rows afterwards. A run that
    stops part-way leaves its rows behind — they are real events from real requests and are not
    rolled back — and the marker is what tells them from a complete run's.

    A visit that fails is logged and the next visitor is walked; the run gives up once
    `MAX_FAILED_VISITS` have failed, because at that point the answer is about the API and not
    about the funnel.
    """
    transitions_map = {
        arm: plan_transitions(activation_rate=rate) for arm, rate in activation_rates.items()
    }
    log.info(
        "simulate_traffic: started",
        visitors=visitors,
        activation_rates=activation_rates,
        run_id=run_id,
    )
    failed = 0

    for ordinal in range(1, visitors + 1):
        browser = open_browser()
        try:
            _one_visit(browser=browser, transitions_map=transitions_map, rng=rng, run_id=run_id)
        # The transport too, not only a refusal the server managed to send: a read timeout or a
        # dropped connection is the likeliest flaky request there is against a real server, and
        # it never arrives as a response at all. Catching only `SimulationError` made the
        # threshold below cover the failure a run is least likely to meet and miss the one it
        # is most likely to (audit-fixes review, finding 2a).
        except (SimulationError, httpx.HTTPError) as error:
            failed += 1
            log.warning(
                "simulate_traffic: a visit failed",
                run_id=run_id,
                ordinal=ordinal,
                failed=failed,
                reason=str(error),
            )
            if failed >= MAX_FAILED_VISITS:
                msg = (
                    f"simulate_traffic: giving up after {failed} failed visits of {ordinal} "
                    f"attempted — run_id={run_id}; the last failure was: {error}"
                )
                raise SimulationError(msg) from error
        finally:
            browser.close()
        if ordinal % LOG_EVERY == 0:
            log.info("simulate_traffic: progress", sent=ordinal, of=visitors, run_id=run_id)

    log.info("simulate_traffic: completed", visitors=visitors, failed=failed, run_id=run_id)


def _one_visit(
    *,
    browser: httpx.Client,
    transitions_map: Mapping[str, tuple[_Transition, ...]],
    rng: random.Random,
    run_id: str,
) -> None:
    arm = _create_visitor(browser)
    transitions = transitions_map.get(arm)
    if transitions is None:
        msg = (
            f"simulate_traffic: the server assigned arm {arm!r}, which has no activation rate — "
            f"rates were given for {sorted(transitions_map)}"
        )
        raise SimulationError(msg)

    for step in walk(transitions=transitions, rng=rng):
        _record_step(browser, step=step, run_id=run_id)


def _create_visitor(browser: httpx.Client) -> str:
    """The arm the server put this browser in. The cookie lands in the browser's own jar.

    `201` and not `200`: the endpoint answers `200` for a cookie it recognises, and every
    simulated visitor opens a browser with an empty jar, so anything but `201` means two
    visitors shared one — the defect BF47 was.
    """
    response = browser.post("/api/visitors")
    _expect(response, status=201, doing="create a visitor")
    assignments = response.json()["assignments"]
    arm = assignments.get(RESULT_SCREEN_TONE)
    if not isinstance(arm, str):
        msg = (
            f"simulate_traffic: the visitor was not assigned to {RESULT_SCREEN_TONE!r} — is the "
            f"flag enabled? assignments={assignments}"
        )
        raise SimulationError(msg)

    return arm


def _record_step(browser: httpx.Client, *, step: FunnelEventName, run_id: str) -> None:
    """No `visitorId` in the body, by design: the cookie is the identity (BF47)."""
    response = browser.post(
        "/api/funnel-events",
        json={
            "id": generate_unique_id("evt"),
            "name": step,
            "occurredAt": datetime.now(UTC).isoformat(),
            "metadata": {"simulated": True, "runId": run_id},
        },
    )
    _expect(response, status=201, doing=f"record {step}")


def _expect(response: httpx.Response, *, status: int, doing: str) -> None:
    if response.status_code == status:
        return

    msg = (
        f"simulate_traffic: could not {doing} — expected HTTP {status}, got "
        f"{response.status_code}: {response.text}"
    )
    raise SimulationError(msg)
