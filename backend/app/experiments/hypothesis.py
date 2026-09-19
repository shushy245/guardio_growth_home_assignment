"""What each experiment set out to prove — fixed before it ran, and read from code.

A hypothesis is not product-editable: the baseline and the minimum detectable lift decide the
sample the test is powered for, and an operator who could raise them on `/admin` after a
disappointing week would be moving the finish line. So it lives beside the statistics that read
it, keyed by the flag it belongs to, and a flag without an entry here has no experiment read.
"""

from dataclasses import dataclass
from types import MappingProxyType

from app.funnel_events.models import FunnelEventName


@dataclass(frozen=True)
class MetricDefinition:
    """A conversion rate between two funnel steps: visitors at `numerator` over visitors at
    `denominator`."""

    numerator: FunnelEventName
    denominator: FunnelEventName


@dataclass(frozen=True)
class Hypothesis:
    statement: str
    control_key: str
    variant_key: str
    baseline_rate: float
    minimum_detectable_relative_lift: float


# The three rates every experiment reports (docs/plan.md, "Experiment design"). The hypothesis
# is stated on the primary one; the z-test and the lift read it alone.
PRIMARY_METRIC = MetricDefinition(
    numerator=FunnelEventName.ACTIVATION, denominator=FunnelEventName.SCAN_COMPLETED
)
SECONDARY_METRIC = MetricDefinition(
    numerator=FunnelEventName.CTA_CLICK, denominator=FunnelEventName.SCAN_COMPLETED
)
GUARDRAIL_METRIC = MetricDefinition(
    numerator=FunnelEventName.ACTIVATION, denominator=FunnelEventName.CTA_CLICK
)

RESULT_SCREEN_TONE = "result_screen_tone"

hypothesis_map: MappingProxyType[str, Hypothesis] = MappingProxyType(
    {
        RESULT_SCREEN_TONE: Hypothesis(
            statement=(
                "An urgent framing of the result screen raises the activation rate "
                "(visitors who complete a scan and go on to activate) by at least 20% relative."
            ),
            control_key="calm",
            variant_key="urgent",
            baseline_rate=0.08,
            minimum_detectable_relative_lift=0.20,
        )
    }
)
