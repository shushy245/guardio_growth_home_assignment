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
