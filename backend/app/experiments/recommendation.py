"""What the numbers mean: turning a z-test into a call somebody can act on.

Pure — it takes two counted arms and the sample the hypothesis asks for, and answers one of
three things. Separated from `stats.py` on purpose: that module knows what the figures *are*,
this one knows what they are *worth*, and only this one changes when the house rule for calling
an experiment changes.

The rule is deliberately conservative. Two of the three answers are "not yet", and a
statistically significant result on a sample smaller than the hypothesis asked for is still
"not yet" — see `_has_enough_traffic`.
"""

from dataclasses import dataclass
from enum import StrEnum

from app.experiments.stats import (
    ALPHA,
    Lift,
    Proportion,
    ZTestResult,
    measure_lift,
    two_proportion_z_test,
)


class Recommendation(StrEnum):
    """The three calls the dashboard can make. `KEEP_RUNNING` is the default and the only
    honest answer to an experiment that has not finished."""

    SHIP_VARIANT = "SHIP_VARIANT"
    KEEP_CONTROL = "KEEP_CONTROL"
    KEEP_RUNNING = "KEEP_RUNNING"


@dataclass(frozen=True)
class Analysis:
    """The read: the figures, the sample it would take to trust them, and the call.

    `test` and `lift` are `None` independently — an experiment can have a valid z-test and no
    statable lift (a control nobody converted in), so a reader must not infer one from the
    other.
    """

    test: ZTestResult | None
    lift: Lift | None
    required_per_arm: int
    recommendation: Recommendation


def analyse(*, control: Proportion, variant: Proportion, required_per_arm: int) -> Analysis:
    """The whole read in one value.

    `required_per_arm` is passed in rather than derived from the observed rates: it belongs to
    the hypothesis, which is fixed before the experiment runs. Deriving it from the data would
    move the finish line every time somebody refreshed the page.
    """
    test = two_proportion_z_test(control=control, variant=variant)

    return Analysis(
        test=test,
        lift=measure_lift(control=control, variant=variant),
        required_per_arm=required_per_arm,
        recommendation=_recommend(
            test=test, control=control, variant=variant, required_per_arm=required_per_arm
        ),
    )


def _recommend(
    *,
    test: ZTestResult | None,
    control: Proportion,
    variant: Proportion,
    required_per_arm: int,
) -> Recommendation:
    """Guard clauses, cheapest refusal first; the happy path is the last line."""
    if test is None:
        return Recommendation.KEEP_RUNNING

    if not _is_significant(test):
        return Recommendation.KEEP_RUNNING

    if not _has_enough_traffic(control=control, variant=variant, required_per_arm=required_per_arm):
        return Recommendation.KEEP_RUNNING

    return Recommendation.SHIP_VARIANT if _variant_won(test) else Recommendation.KEEP_CONTROL


def _is_significant(test: ZTestResult) -> bool:
    return test.p_value < ALPHA


def _has_enough_traffic(*, control: Proportion, variant: Proportion, required_per_arm: int) -> bool:
    """Both arms, not their total: a test that ran 9,000 visitors through one arm and 900
    through the other has not met a 5,000-per-arm requirement, however large the sum looks.

    This is what makes significance insufficient on its own. Stopping the moment a p-value
    crosses 0.05 is the peeking problem — check often enough and a null experiment will cross
    it eventually — so a call waits for the sample the hypothesis was powered for.
    """
    return min(control.trials, variant.trials) >= required_per_arm


def _variant_won(test: ZTestResult) -> bool:
    """The sign of z is the direction of the effect; this is the only reader of it."""
    return test.z > 0
