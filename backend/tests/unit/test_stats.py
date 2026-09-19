"""The experiment's statistics are pure arithmetic, so they are asserted directly.

Every expected value here is a textbook figure for the pooled two-proportion z-test, not a
number this implementation once produced: a test that records its own output proves only that
the code has not changed.

The p-value is **two-sided** throughout. A one-sided test on the same inputs returns half the
figure, which would call a result significant at alpha=0.05 when it is only significant at 0.10 —
so the constants below are what pin the test's sidedness, and `test_stats` is the only place
that sidedness is stated.
"""

import pytest

from app.experiments.stats import Proportion, two_proportion_z_test


def test_two_points_of_difference_on_a_thousand_visitors_an_arm_is_not_significant() -> None:
    """8% against 10% with 1,000 per arm: a real-looking gap that the sample cannot support."""
    result = two_proportion_z_test(
        control=Proportion(successes=80, trials=1000),
        variant=Proportion(successes=100, trials=1000),
    )

    assert result.p_value == pytest.approx(0.118, abs=0.001)


def test_the_same_two_points_on_ten_times_the_traffic_is_significant() -> None:
    """The identical rates at 10,000 an arm: only the sample size changed, and the call flips."""
    result = two_proportion_z_test(
        control=Proportion(successes=800, trials=10_000),
        variant=Proportion(successes=1000, trials=10_000),
    )

    assert result.p_value < 0.001


def test_the_z_score_is_positive_when_the_variant_converts_better() -> None:
    """The sign is the direction of the effect, and `recommend` reads it to tell a win from a
    loss — so which arm is subtracted from which is behaviour, not an implementation detail."""
    result = two_proportion_z_test(
        control=Proportion(successes=80, trials=1000),
        variant=Proportion(successes=100, trials=1000),
    )

    assert result.z > 0


def test_the_z_score_is_negative_when_the_variant_converts_worse() -> None:
    result = two_proportion_z_test(
        control=Proportion(successes=100, trials=1000),
        variant=Proportion(successes=80, trials=1000),
    )

    assert result.z < 0
