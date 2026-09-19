"""The experiment's statistics: pure arithmetic over two counted arms.

No database, no clock, no HTTP — every input arrives as a `Proportion` and every output is a
value. This is the functional core of the dashboard's read, and it is the only module that
knows what "significant" means.

**Two-sided, always.** The interval and the p-value are computed at the same alpha from the same
critical value, so a reader cannot be told a result is significant by one and not the other.
An A/B test that only ever asks "did the variant win" is still a two-sided question in
practice: a variant that loses is a result, not a non-result, and the recommendation acts on it.
"""

import math
from dataclasses import dataclass

from scipy import stats

# The one place the test's size is set. The p-value and both intervals read it, so a reader
# can never be shown a p-value at one threshold beside an interval at another.
ALPHA = 0.05
# The chance of detecting a real effect of the stated size. 0.8 is the conventional floor: a
# test powered below it is one that can miss a win it was built to find.
POWER = 0.80
# Computed once at import: every call would otherwise pay for the same inverse normal.
_CRITICAL_VALUE = float(stats.norm.ppf(1 - ALPHA / 2))
_POWER_VALUE = float(stats.norm.ppf(POWER))


@dataclass(frozen=True)
class Proportion:
    """One arm: how many of its visitors converted, out of how many reached the step."""

    successes: int
    trials: int


@dataclass(frozen=True)
class ZTestResult:
    """`z` carries the direction — positive when the variant converted better than the control."""

    z: float
    p_value: float


def two_proportion_z_test(*, control: Proportion, variant: Proportion) -> ZTestResult:
    """The pooled two-proportion z-test.

    Pooled, not unpooled: the null hypothesis is that both arms share one rate, so the standard
    error is estimated under that assumption. The unpooled form is what the confidence interval
    uses, because there the two rates are not assumed equal — the two standard errors differ on
    purpose and are not a duplication to collapse.
    """
    pooled_rate = (control.successes + variant.successes) / (control.trials + variant.trials)
    standard_error = math.sqrt(
        pooled_rate * (1 - pooled_rate) * (1 / control.trials + 1 / variant.trials)
    )
    z = (_rate_of(variant) - _rate_of(control)) / standard_error

    # `sf` rather than `1 - cdf`: the survival function keeps its precision far out in the tail,
    # where `1 - cdf` has already rounded to 1.0 and would report p = 0.
    return ZTestResult(z=z, p_value=float(2 * stats.norm.sf(abs(z))))


def _rate_of(arm: Proportion) -> float:
    return arm.successes / arm.trials


@dataclass(frozen=True)
class Estimate:
    """A point estimate and the interval it is known to within, at `ALPHA`."""

    point: float
    low: float
    high: float


@dataclass(frozen=True)
class Lift:
    """How much better the variant did, both ways a reader asks it.

    `absolute` is in rate points (8% to 10% is +0.02) and `relative` is in proportion of the
    control (the same move is +0.25). The dashboard leads with the relative figure because that
    is what a hypothesis is stated in, and carries the absolute one because that is what a
    forecast is built from.
    """

    absolute: Estimate
    relative: Estimate


def measure_lift(*, control: Proportion, variant: Proportion) -> Lift:
    """Both intervals at `ALPHA`, unpooled.

    Unpooled here, pooled in the z-test, on purpose: the test asks "could these have come from
    one rate", so it estimates one; the interval asks "how far apart are they", so it estimates
    two. Collapsing the two standard errors into one shared helper would be collapsing two
    different questions.
    """
    return Lift(
        absolute=_absolute_lift(control=control, variant=variant),
        relative=_relative_lift(control=control, variant=variant),
    )


def _absolute_lift(*, control: Proportion, variant: Proportion) -> Estimate:
    difference = _rate_of(variant) - _rate_of(control)
    margin = _CRITICAL_VALUE * math.sqrt(_variance_of(control) + _variance_of(variant))

    return Estimate(point=difference, low=difference - margin, high=difference + margin)


def _relative_lift(*, control: Proportion, variant: Proportion) -> Estimate:
    """The delta method on the log ratio, exponentiated back.

    A ratio's sampling distribution is skewed, so the interval is built where it is symmetric —
    on the log scale — and carried back. The symmetric alternative (the absolute interval over
    the control rate) understates the upside and can put the lower bound below -100%, which is
    not a lift any variant can deliver.
    """
    log_ratio = math.log(_rate_of(variant) / _rate_of(control))
    margin = _CRITICAL_VALUE * math.sqrt(_log_variance_of(control) + _log_variance_of(variant))

    return Estimate(
        point=math.exp(log_ratio) - 1,
        low=math.exp(log_ratio - margin) - 1,
        high=math.exp(log_ratio + margin) - 1,
    )


def _variance_of(arm: Proportion) -> float:
    rate = _rate_of(arm)

    return rate * (1 - rate) / arm.trials


def _log_variance_of(arm: Proportion) -> float:
    rate = _rate_of(arm)

    return (1 - rate) / (rate * arm.trials)


def required_sample_per_arm(
    *, baseline_rate: float, minimum_detectable_relative_lift: float
) -> int:
    """How many visitors each arm needs before a lift of this size could be called.

    The effect is stated as a **relative** lift because that is how the hypothesis is written —
    "at least 20% better", not "at least 1.6 points better" — and because a relative target
    keeps its meaning when the baseline drifts.

    One-sided power, two-sided alpha: the convention every published calculator uses, and the
    reason `_POWER_VALUE` is `ppf(POWER)` while `_CRITICAL_VALUE` is `ppf(1 - ALPHA / 2)`.
    """
    target_rate = baseline_rate * (1 + minimum_detectable_relative_lift)
    pooled_rate = (baseline_rate + target_rate) / 2
    numerator = (
        _CRITICAL_VALUE * math.sqrt(2 * pooled_rate * (1 - pooled_rate))
        + _POWER_VALUE
        * math.sqrt(baseline_rate * (1 - baseline_rate) + target_rate * (1 - target_rate))
    ) ** 2

    # Ceiling, never round: a fractional visitor is not a sample size, and rounding down would
    # let the dashboard call a test powered one visitor before it is.
    return math.ceil(numerator / (target_rate - baseline_rate) ** 2)
