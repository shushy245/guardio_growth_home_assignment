"""The experiment's read, assembled from counted rows — pure once the rows are in hand.

`StepPairCount` is the shape the repository hands back: one row per (arm, step, step) that at
least one visitor reached **both** halves of. A pair nobody reached has no row, and the
assembly reads absence as zero rather than asking the database to invent empty groups.

Why pairs and not steps: a rate is not two step counts divided. A visitor who recorded
`activation` without ever completing a scan (`/signup` is reachable by link and by bookmark) is
in the activation count and not in the scan count, and dividing one by the other put the primary
metric above 100% and the pooled z-test under a square root of a negative number — a 500 that
never cleared, because the rows persist. The numerator is counted over the visitors who also
reached the denominator, so `successes <= trials` holds by construction; the pair whose two
halves are the same step is the plain count the funnel is drawn from.

Everything below `StepPairCount` is arithmetic over those rows and the hypothesis: the funnel
per arm in step order, the three rates, and the analysis on the primary one.
"""

from collections.abc import Iterable, Mapping
from dataclasses import dataclass

from app.experiments.hypothesis import (
    GUARDRAIL_METRIC,
    PRIMARY_METRIC,
    SECONDARY_METRIC,
    Hypothesis,
    MetricDefinition,
)
from app.experiments.recommendation import Recommendation, analyse
from app.experiments.stats import Lift, Proportion, ZTestResult, required_sample_per_arm
from app.funnel_events.models import FunnelEventName

FUNNEL_IN_ORDER = tuple(FunnelEventName)


@dataclass(frozen=True)
class StepPairCount:
    """How many distinct visitors in one arm reached both `reached` and `and_reached`.

    The same step twice is the arm's count at that step. Two different steps is what a rate is
    counted over, in either order — the pair says the visitor reached both, never in what
    sequence, because the funnel's order is the plan's, not the clock's.
    """

    variant_key: str
    reached: FunnelEventName
    and_reached: FunnelEventName
    visitors: int


@dataclass(frozen=True)
class StepRead:
    name: FunnelEventName
    visitors: int


@dataclass(frozen=True)
class MetricRead:
    """A rate and the counts behind it. `rate` is `None`, not `NaN`, when nobody reached the
    denominator — `NaN` is not JSON."""

    successes: int
    trials: int
    rate: float | None


@dataclass(frozen=True)
class ArmRead:
    key: str
    steps: tuple[StepRead, ...]
    primary: MetricRead
    secondary: MetricRead
    guardrail: MetricRead


@dataclass(frozen=True)
class MetricDefinitions:
    primary: MetricDefinition
    secondary: MetricDefinition
    guardrail: MetricDefinition


@dataclass(frozen=True)
class SampleRead:
    """What the hypothesis asked for and how far the smaller arm has got — the "4,200 of 6,500
    required per arm" the dashboard prints while it waits."""

    required_per_arm: int
    reached_per_arm: int


@dataclass(frozen=True)
class ExperimentRead:
    flag_key: str
    hypothesis: Hypothesis
    metrics: MetricDefinitions
    control: ArmRead
    variant: ArmRead
    test: ZTestResult | None
    lift: Lift | None
    sample: SampleRead
    recommendation: Recommendation


def assemble_results(
    *, flag_key: str, hypothesis: Hypothesis, counts: Iterable[StepPairCount]
) -> ExperimentRead:
    """Only the two arms the hypothesis names are read. A third variant on the flag has no
    place in a two-arm comparison, and its visitors are left out of both samples rather than
    folded into either."""
    counts_by_arm = _group_by_arm(counts)
    control = _read_arm(key=hypothesis.control_key, counts=counts_by_arm)
    variant = _read_arm(key=hypothesis.variant_key, counts=counts_by_arm)
    required_per_arm = required_sample_per_arm(
        baseline_rate=hypothesis.baseline_rate,
        minimum_detectable_relative_lift=hypothesis.minimum_detectable_relative_lift,
    )
    analysis = analyse(
        control=_as_proportion(control.primary),
        variant=_as_proportion(variant.primary),
        required_per_arm=required_per_arm,
    )

    return ExperimentRead(
        flag_key=flag_key,
        hypothesis=hypothesis,
        metrics=MetricDefinitions(
            primary=PRIMARY_METRIC, secondary=SECONDARY_METRIC, guardrail=GUARDRAIL_METRIC
        ),
        control=control,
        variant=variant,
        test=analysis.test,
        lift=analysis.lift,
        sample=SampleRead(
            required_per_arm=required_per_arm,
            reached_per_arm=min(control.primary.trials, variant.primary.trials),
        ),
        recommendation=analysis.recommendation,
    )


StepPair = tuple[FunnelEventName, FunnelEventName]


def _group_by_arm(counts: Iterable[StepPairCount]) -> dict[str, dict[StepPair, int]]:
    grouped: dict[str, dict[StepPair, int]] = {}
    for count in counts:
        grouped.setdefault(count.variant_key, {})[(count.reached, count.and_reached)] = (
            count.visitors
        )

    return grouped


def _read_arm(*, key: str, counts: Mapping[str, Mapping[StepPair, int]]) -> ArmRead:
    visitors_reaching = counts.get(key, {})

    return ArmRead(
        key=key,
        steps=tuple(
            StepRead(
                name=step, visitors=_visitors_at(step=step, visitors_reaching=visitors_reaching)
            )
            for step in FUNNEL_IN_ORDER
        ),
        primary=_read_metric(definition=PRIMARY_METRIC, visitors_reaching=visitors_reaching),
        secondary=_read_metric(definition=SECONDARY_METRIC, visitors_reaching=visitors_reaching),
        guardrail=_read_metric(definition=GUARDRAIL_METRIC, visitors_reaching=visitors_reaching),
    )


def _visitors_at(*, step: FunnelEventName, visitors_reaching: Mapping[StepPair, int]) -> int:
    """The arm's count at one step: the pair whose two halves are that step."""
    return visitors_reaching.get((step, step), 0)


def _read_metric(
    *, definition: MetricDefinition, visitors_reaching: Mapping[StepPair, int]
) -> MetricRead:
    """The numerator is the pair, never the numerator step on its own: only visitors who
    reached the denominator were ever eligible to convert."""
    successes = visitors_reaching.get((definition.numerator, definition.denominator), 0)
    trials = _visitors_at(step=definition.denominator, visitors_reaching=visitors_reaching)

    return MetricRead(
        successes=successes,
        trials=trials,
        rate=None if trials == 0 else successes / trials,
    )


def _as_proportion(metric: MetricRead) -> Proportion:
    return Proportion(successes=metric.successes, trials=metric.trials)
