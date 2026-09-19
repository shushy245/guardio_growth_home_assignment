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

from app.experiments.stats import (
    Proportion,
    measure_lift,
    required_sample_per_arm,
    two_proportion_z_test,
)


def test_two_points_of_difference_on_a_thousand_visitors_an_arm_is_not_significant() -> None:
    """8% against 10% with 1,000 per arm: a real-looking gap that the sample cannot support."""
    result = two_proportion_z_test(
        control=Proportion(successes=80, trials=1000),
        variant=Proportion(successes=100, trials=1000),
    )

    assert result is not None
    assert result.p_value == pytest.approx(0.118, abs=0.001)


def test_the_same_two_points_on_ten_times_the_traffic_is_significant() -> None:
    """The identical rates at 10,000 an arm: only the sample size changed, and the call flips."""
    result = two_proportion_z_test(
        control=Proportion(successes=800, trials=10_000),
        variant=Proportion(successes=1000, trials=10_000),
    )

    assert result is not None
    assert result.p_value < 0.001


def test_the_z_score_is_positive_when_the_variant_converts_better() -> None:
    """The sign is the direction of the effect, and `recommend` reads it to tell a win from a
    loss — so which arm is subtracted from which is behaviour, not an implementation detail."""
    result = two_proportion_z_test(
        control=Proportion(successes=80, trials=1000),
        variant=Proportion(successes=100, trials=1000),
    )

    assert result is not None
    assert result.z > 0


def test_the_z_score_is_negative_when_the_variant_converts_worse() -> None:
    result = two_proportion_z_test(
        control=Proportion(successes=100, trials=1000),
        variant=Proportion(successes=80, trials=1000),
    )

    assert result is not None
    assert result.z < 0


def test_the_absolute_interval_straddles_zero_when_the_difference_is_not_significant() -> None:
    """The interval and the p-value are one statement, not two.

    8% against 10% at 1,000 an arm gives p = 0.118, so an interval that excluded zero would be
    a dashboard telling a reader both "no effect proven" and "the effect is at least this big".
    """
    lift = measure_lift(
        control=Proportion(successes=80, trials=1000),
        variant=Proportion(successes=100, trials=1000),
    )

    assert lift is not None
    assert lift.absolute.low < 0 < lift.absolute.high


def test_the_absolute_interval_excludes_zero_when_the_difference_is_significant() -> None:
    """The same rates at 10,000 an arm: 1.21 to 2.79 points, textbook figures."""
    lift = measure_lift(
        control=Proportion(successes=800, trials=10_000),
        variant=Proportion(successes=1000, trials=10_000),
    )

    assert lift is not None
    assert (lift.absolute.low, lift.absolute.high) == pytest.approx((0.01207, 0.02793), abs=1e-5)


def test_the_relative_lift_is_read_from_the_rates_not_from_their_difference() -> None:
    """8% to 10% is a quarter more conversions, not two more — the card says "+25%", and a
    reader who saw "+2%" would be reading the absolute difference under a relative label."""
    lift = measure_lift(
        control=Proportion(successes=80, trials=1000),
        variant=Proportion(successes=100, trials=1000),
    )

    assert lift is not None
    assert lift.relative.point == pytest.approx(0.25)


def test_the_relative_interval_is_the_delta_method_on_the_log_ratio() -> None:
    """Not the absolute interval divided by the control rate: a ratio's sampling distribution
    is skewed, so a symmetric interval around +25% would understate the upside and could put
    the lower bound below -100%, which is not a rate a variant can reach."""
    lift = measure_lift(
        control=Proportion(successes=800, trials=10_000),
        variant=Proportion(successes=1000, trials=10_000),
    )

    assert lift is not None
    assert (lift.relative.low, lift.relative.high) == pytest.approx((0.14385, 0.36600), abs=1e-5)


def test_the_relative_interval_is_wider_above_the_point_than_below_it() -> None:
    """The skew itself, stated as behaviour: +25% with a sample this thin runs from -5.6% to
    +65.5%, and a symmetric interval would be a different claim about the upside."""
    lift = measure_lift(
        control=Proportion(successes=80, trials=1000),
        variant=Proportion(successes=100, trials=1000),
    )

    assert lift is not None
    assert lift.relative.high - lift.relative.point > lift.relative.point - lift.relative.low


def test_the_required_sample_matches_the_textbook_figure_for_the_stated_hypothesis() -> None:
    """The plan's hypothesis: 8% activation, a 20% relative lift to detect, alpha 0.05, power
    0.8. Every published calculator puts that at about 4,920 visitors an arm."""
    required = required_sample_per_arm(baseline_rate=0.08, minimum_detectable_relative_lift=0.20)

    assert required == pytest.approx(4920, rel=0.05)


def test_a_larger_effect_needs_less_traffic_to_detect() -> None:
    """The direction of the whole formula in one assertion: a sign slip or an inverted ratio
    passes the figure above only by coincidence, and fails here."""
    small_effect = required_sample_per_arm(
        baseline_rate=0.08, minimum_detectable_relative_lift=0.10
    )
    large_effect = required_sample_per_arm(
        baseline_rate=0.08, minimum_detectable_relative_lift=0.50
    )

    assert large_effect < small_effect


def test_the_required_sample_rounds_up() -> None:
    """A fractional visitor is not a sample size, and rounding down would let the dashboard
    call a test adequately powered one visitor before it is."""
    required = required_sample_per_arm(baseline_rate=0.08, minimum_detectable_relative_lift=0.20)

    assert required == 4921
