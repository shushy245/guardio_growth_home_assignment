"""What the numbers mean: the call a product manager reads off the dashboard.

`analyse` is pure, so it is asserted directly. Its whole job is to refuse to overclaim — four
of the tests below are about *not* making a call.

The required sample is passed in rather than derived from the observed rates. It belongs to the
stated hypothesis ("8% activation, detect a 20% relative lift"), which is fixed before the test
runs; deriving it from what the data happens to show would move the finish line every time
somebody refreshed the page.
"""

import math

from app.experiments.recommendation import Recommendation, analyse
from app.experiments.stats import ALPHA, Proportion

# The plan's hypothesis, as `required_sample_per_arm` computes it. Pinned as a literal so these
# tests state their own powered/underpowered boundary rather than importing the formula they
# would then be unable to contradict.
REQUIRED_PER_ARM = 4921


def test_a_significant_win_on_enough_traffic_recommends_shipping_the_variant() -> None:
    analysis = analyse(
        control=Proportion(successes=800, trials=10_000),
        variant=Proportion(successes=1000, trials=10_000),
        required_per_arm=REQUIRED_PER_ARM,
    )

    assert analysis.recommendation is Recommendation.SHIP_VARIANT


def test_a_significant_loss_on_enough_traffic_recommends_keeping_the_control() -> None:
    """The mirror image, and the reason the z-test keeps its sign: an experiment that proves
    the variant is worse is a result the dashboard must be able to state."""
    analysis = analyse(
        control=Proportion(successes=1000, trials=10_000),
        variant=Proportion(successes=800, trials=10_000),
        required_per_arm=REQUIRED_PER_ARM,
    )

    assert analysis.recommendation is Recommendation.KEEP_CONTROL


def test_a_call_is_made_at_exactly_the_required_sample_and_not_one_visitor_short() -> None:
    """The threshold itself, which no other case sits on: `>= required` weakened to `> required`
    leaves every one of them green (BF84). The pair is the same rates either side of the line."""
    fully_powered = analyse(
        control=Proportion(successes=394, trials=REQUIRED_PER_ARM),
        variant=Proportion(successes=492, trials=REQUIRED_PER_ARM),
        required_per_arm=REQUIRED_PER_ARM,
    )
    one_visitor_short = analyse(
        control=Proportion(successes=394, trials=REQUIRED_PER_ARM - 1),
        variant=Proportion(successes=492, trials=REQUIRED_PER_ARM - 1),
        required_per_arm=REQUIRED_PER_ARM,
    )

    assert fully_powered.recommendation is Recommendation.SHIP_VARIANT
    assert one_visitor_short.recommendation is Recommendation.KEEP_RUNNING


def test_a_difference_the_sample_cannot_support_recommends_keeping_the_test_running() -> None:
    """Plenty of traffic, no signal: 8.00% against 8.10% at 10,000 an arm is p = 0.79."""
    analysis = analyse(
        control=Proportion(successes=800, trials=10_000),
        variant=Proportion(successes=810, trials=10_000),
        required_per_arm=REQUIRED_PER_ARM,
    )

    assert analysis.recommendation is Recommendation.KEEP_RUNNING


def test_a_significant_result_on_too_little_traffic_still_recommends_keeping_it_running() -> None:
    """The peeking guard, and the case most likely to be got wrong.

    4% against 9% at 1,000 an arm is p = 0.0000058 — significant by any threshold, and still
    only a fifth of the traffic the hypothesis asks for. Calling it here is exactly the early
    stop that inflates false positives, so significance alone is not a licence to ship.
    """
    analysis = analyse(
        control=Proportion(successes=40, trials=1000),
        variant=Proportion(successes=90, trials=1000),
        required_per_arm=REQUIRED_PER_ARM,
    )

    assert analysis.recommendation is Recommendation.KEEP_RUNNING


def test_a_significant_result_with_one_thin_arm_still_recommends_keeping_it_running() -> None:
    """Per arm, not in total (R-2). 9,000 visitors through the control and 900 through the
    variant is a strongly significant read and still a fifth of the variant's required sample;
    the sum says 9,900 and would call it."""
    analysis = analyse(
        control=Proportion(successes=720, trials=9000),
        variant=Proportion(successes=135, trials=900),
        required_per_arm=REQUIRED_PER_ARM,
    )

    assert analysis.recommendation is Recommendation.KEEP_RUNNING


def test_a_win_over_a_control_nobody_converted_in_is_not_called() -> None:
    """The z-test is defined and enormous, the lift is not statable (R-1). A call the dashboard
    would print beside "Not enough data yet" is a call it must not make: a control arm nobody
    converted in over a full sample is a broken funnel to look into, not a variant to ship."""
    analysis = analyse(
        control=Proportion(successes=0, trials=5000),
        variant=Proportion(successes=100, trials=5000),
        required_per_arm=REQUIRED_PER_ARM,
    )

    assert analysis.test is not None
    assert analysis.lift is None
    assert analysis.recommendation is Recommendation.KEEP_RUNNING


def test_a_loss_to_a_variant_nobody_converted_in_keeps_the_control() -> None:
    """The mirror of R-1, and the half its guard missed (BF61). A variant nobody converted in
    over a full sample has no statable relative lift either — but "keep the control" needs no
    lift to state, it is the status quo, and answering "keep running" here leaves a variant
    that is significantly worse live for as long as nobody reads the p-value themselves."""
    analysis = analyse(
        control=Proportion(successes=400, trials=5000),
        variant=Proportion(successes=0, trials=5000),
        required_per_arm=REQUIRED_PER_ARM,
    )

    assert analysis.test is not None
    assert analysis.test.z < 0
    assert analysis.lift is None
    assert analysis.recommendation is Recommendation.KEEP_CONTROL


def test_an_experiment_nobody_has_reached_yet_reads_as_keep_running_with_no_statistics() -> None:
    """Zero denominators. The alternative is a ZeroDivisionError on the dashboard's first
    render, before a single visitor has been through the funnel."""
    analysis = analyse(
        control=Proportion(successes=0, trials=0),
        variant=Proportion(successes=0, trials=0),
        required_per_arm=REQUIRED_PER_ARM,
    )

    assert analysis.recommendation is Recommendation.KEEP_RUNNING
    assert analysis.test is None
    assert analysis.lift is None


def test_two_arms_nobody_converted_in_read_as_keep_running_with_no_statistics() -> None:
    """Traffic but no conversions: the pooled rate is 0, so the standard error is 0 and the
    z-score would be 0/0. A NaN here reaches the wire as a literal `NaN`, which is not JSON —
    `JSON.parse` throws on it and the dashboard goes blank rather than reading "not yet"."""
    analysis = analyse(
        control=Proportion(successes=0, trials=1000),
        variant=Proportion(successes=0, trials=1000),
        required_per_arm=REQUIRED_PER_ARM,
    )

    assert analysis.recommendation is Recommendation.KEEP_RUNNING
    assert analysis.test is None
    assert analysis.lift is None


def test_an_arm_with_no_conversions_has_no_relative_lift_to_report() -> None:
    """A control nobody converted in makes every variant infinitely better. The z-test is still
    defined here — the pooled rate is above zero — so the two are guarded separately."""
    analysis = analyse(
        control=Proportion(successes=0, trials=1000),
        variant=Proportion(successes=20, trials=1000),
        required_per_arm=REQUIRED_PER_ARM,
    )

    assert analysis.lift is None
    assert analysis.test is not None


def test_no_degenerate_input_produces_a_figure_that_is_not_a_number() -> None:
    """The guard that has to hold for every shape of nothing, not just the ones named above.

    `NaN` and `Infinity` both survive Python's json encoder as bare literals and both break a
    standards-compliant parser, so this walks the degenerate space and insists every figure
    that *is* reported is finite.
    """
    degenerate = [
        (Proportion(successes=0, trials=0), Proportion(successes=0, trials=0)),
        (Proportion(successes=0, trials=1000), Proportion(successes=0, trials=1000)),
        (Proportion(successes=0, trials=1000), Proportion(successes=20, trials=1000)),
        (Proportion(successes=20, trials=1000), Proportion(successes=0, trials=1000)),
        (Proportion(successes=0, trials=0), Proportion(successes=20, trials=1000)),
        (Proportion(successes=1000, trials=1000), Proportion(successes=1000, trials=1000)),
    ]

    for control, variant in degenerate:
        analysis = analyse(control=control, variant=variant, required_per_arm=REQUIRED_PER_ARM)
        # Per figure, so a failure names the input and the figure, not a list of them (R-9).
        for figure in _every_figure_in(analysis):
            assert math.isfinite(figure), (
                f"the read of {control} vs {variant} reported a figure that is not finite: "
                f"{figure} in {analysis}"
            )


def test_the_interval_and_the_p_value_agree_about_significance() -> None:
    """One alpha, two expressions of it (B11).

    A one-sided p-value beside a two-sided interval would call significance at half the stated
    threshold, and the disagreement is invisible on a screen that shows both. The two forms are
    not algebraically identical — the test pools the standard error and the interval does not,
    so they can in principle part company at extreme rates — but across realistic funnel
    numbers they agree, and a sidedness slip breaks the agreement immediately.
    """
    cases = [
        (Proportion(successes=80, trials=1000), Proportion(successes=100, trials=1000)),
        (Proportion(successes=80, trials=1000), Proportion(successes=113, trials=1000)),
        (Proportion(successes=800, trials=10_000), Proportion(successes=810, trials=10_000)),
        (Proportion(successes=800, trials=10_000), Proportion(successes=1000, trials=10_000)),
        (Proportion(successes=100, trials=1000), Proportion(successes=80, trials=1000)),
    ]

    for control, variant in cases:
        analysis = analyse(control=control, variant=variant, required_per_arm=REQUIRED_PER_ARM)
        assert analysis.test is not None and analysis.lift is not None
        by_p_value = analysis.test.p_value < ALPHA
        by_interval = analysis.lift.absolute.low > 0 or analysis.lift.absolute.high < 0

        assert by_p_value == by_interval, (
            f"p-value and interval disagree for {control} vs {variant}: "
            f"p={analysis.test.p_value}, interval="
            f"({analysis.lift.absolute.low}, {analysis.lift.absolute.high})"
        )


def _every_figure_in(value: object) -> list[float]:
    """Every float the read carries, however deeply it is nested."""
    if isinstance(value, bool | int | str | None.__class__):
        return []
    if isinstance(value, float):
        return [value]
    if not hasattr(value, "__dict__"):
        return []

    return [figure for field in vars(value).values() for figure in _every_figure_in(field)]
