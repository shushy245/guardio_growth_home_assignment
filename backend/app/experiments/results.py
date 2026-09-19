"""The experiment's read, assembled from counted rows — pure once the rows are in hand.

`StepCount` is the shape the repository hands back: one row per (arm, step) that at least one
visitor reached. A step nobody in an arm reached has no row, and the assembly reads absence as
zero rather than asking the database to invent empty groups.

Everything below `StepCount` is arithmetic over those rows and the hypothesis: the funnel per
arm in step order, the three rates, and the analysis on the primary one.
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
class StepCount:
    """How many distinct visitors in one arm reached one step."""

    variant_key: str
    step: FunnelEventName
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
    *, flag_key: str, hypothesis: Hypothesis, counts: Iterable[StepCount]
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


def _group_by_arm(counts: Iterable[StepCount]) -> dict[str, dict[FunnelEventName, int]]:
    grouped: dict[str, dict[FunnelEventName, int]] = {}
    for count in counts:
        grouped.setdefault(count.variant_key, {})[count.step] = count.visitors

    return grouped


def _read_arm(*, key: str, counts: Mapping[str, Mapping[FunnelEventName, int]]) -> ArmRead:
    visitors_at = counts.get(key, {})

    return ArmRead(
        key=key,
        steps=tuple(
            StepRead(name=step, visitors=visitors_at.get(step, 0)) for step in FUNNEL_IN_ORDER
        ),
        primary=_read_metric(PRIMARY_METRIC, visitors_at),
        secondary=_read_metric(SECONDARY_METRIC, visitors_at),
        guardrail=_read_metric(GUARDRAIL_METRIC, visitors_at),
    )


def _read_metric(
    definition: MetricDefinition, visitors_at: Mapping[FunnelEventName, int]
) -> MetricRead:
    successes = visitors_at.get(definition.numerator, 0)
    trials = visitors_at.get(definition.denominator, 0)

    return MetricRead(
        successes=successes,
        trials=trials,
        rate=None if trials == 0 else successes / trials,
    )


def _as_proportion(metric: MetricRead) -> Proportion:
    return Proportion(successes=metric.successes, trials=metric.trials)
