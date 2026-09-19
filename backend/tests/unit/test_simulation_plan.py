"""The simulator's pure half: the funnel shape it walks and the rates it refuses.

`plan_transitions` solves the last transition from the activation rate asked for, so a rate the
shape cannot produce has to be refused rather than silently clamped — a run at a rate above the
ceiling would encode an effect it did not walk, and the read would describe a funnel nobody took.
"""

import pytest

from app.experiments.simulation import (
    MAX_ACTIVATION_RATE,
    SCAN_STARTED_OF_LANDING,
    plan_transitions,
)
from app.funnel_events.models import FunnelEventName


def test_the_plan_lists_every_step_in_funnel_order() -> None:
    steps = [transition.step for transition in plan_transitions(activation_rate=0.08)]

    assert steps == list(FunnelEventName)


def test_the_first_step_is_reached_by_everyone_and_the_rest_by_a_share() -> None:
    landing, scan_started, *_ = plan_transitions(activation_rate=0.08)

    assert landing.probability == 1.0
    assert scan_started.probability == SCAN_STARTED_OF_LANDING


def test_the_activation_rate_asked_for_is_what_the_last_transition_solves_for() -> None:
    """The last conditional is the rate divided by the two transitions between activation and
    its denominator, so walking the plan produces that rate of `scan_completed`."""
    *_, activation = plan_transitions(activation_rate=MAX_ACTIVATION_RATE)

    assert activation.probability == pytest.approx(1.0)


def test_a_rate_the_funnel_shape_cannot_produce_is_refused() -> None:
    with pytest.raises(ValueError, match="ceiling"):
        plan_transitions(activation_rate=MAX_ACTIVATION_RATE + 0.01)


def test_a_rate_of_zero_is_refused() -> None:
    """Zero is not a funnel to walk, and it would leave the variant's arm with no conversions
    at all — a read the statistics answer `None` to rather than a result."""
    with pytest.raises(ValueError, match="outside"):
        plan_transitions(activation_rate=0.0)
