"""`GET /api/experiments/{flagKey}/results`: the whole read in one body.

Per-arm funnels, the three rates, the z-test, the lift on both scales, the sample the
hypothesis asks for, and the call. The degenerate experiment is the case that matters most: it
is what the dashboard renders first, before a single visitor has been through.
"""

from app.experiments.recommendation import Recommendation
from app.funnel_events.models import FunnelEventName
from tests.drivers.experiments_api import ExperimentsApiDriver

LANDING_VIEW = FunnelEventName.LANDING_VIEW
SCAN_COMPLETED = FunnelEventName.SCAN_COMPLETED
CTA_CLICK = FunnelEventName.CTA_CLICK
ACTIVATION = FunnelEventName.ACTIVATION
# The plan's hypothesis, 8% -> 9.6% at alpha 0.05 and power 0.8, as `required_sample_per_arm`
# computes it and `test_recommendation.py` pins it.
REQUIRED_PER_ARM = 4921


def test_the_read_assembles_both_arms_their_rates_the_statistics_and_the_call(
    experiments: ExperimentsApiDriver,
) -> None:
    experiments.given.a_visitor_in_arm("calm", took=(LANDING_VIEW, SCAN_COMPLETED))
    experiments.given.a_visitor_in_arm("calm", took=(LANDING_VIEW, SCAN_COMPLETED, CTA_CLICK))
    experiments.given.a_visitor_in_arm(
        "calm", took=(LANDING_VIEW, SCAN_COMPLETED, CTA_CLICK, ACTIVATION)
    )
    experiments.given.a_visitor_in_arm("calm", took=(LANDING_VIEW,))
    experiments.given.a_visitor_in_arm(
        "urgent", took=(LANDING_VIEW, SCAN_COMPLETED, CTA_CLICK, ACTIVATION)
    )
    experiments.given.a_visitor_in_arm(
        "urgent", took=(LANDING_VIEW, SCAN_COMPLETED, CTA_CLICK, ACTIVATION)
    )
    experiments.given.a_visitor_in_arm("urgent", took=(LANDING_VIEW, SCAN_COMPLETED, CTA_CLICK))
    experiments.given.a_visitor_in_arm("urgent", took=(LANDING_VIEW, SCAN_COMPLETED))

    experiments.when.the_results_are_read()

    experiments.then.the_read_succeeded()
    experiments.then.the_hypothesis_is_stated()
    experiments.then.the_arms_are(control="calm", variant="urgent")
    experiments.then.the_funnel_lists_every_step_in_order(arm="control")
    experiments.then.the_step_reads(arm="control", step=LANDING_VIEW, visitors=4)
    experiments.then.the_step_reads(arm="control", step=SCAN_COMPLETED, visitors=3)
    experiments.then.the_step_reads(arm="control", step=ACTIVATION, visitors=1)
    experiments.then.the_step_reads(arm="variant", step=ACTIVATION, visitors=2)
    experiments.then.the_metric_reads(
        arm="control", metric="primary", successes=1, trials=3, rate=1 / 3
    )
    experiments.then.the_metric_reads(
        arm="variant", metric="secondary", successes=3, trials=4, rate=0.75
    )
    experiments.then.the_metric_reads(
        arm="variant", metric="guardrail", successes=2, trials=3, rate=2 / 3
    )
    experiments.then.the_test_reports_a_p_value()
    experiments.then.the_lift_is_stated_on_both_scales()
    experiments.then.the_sample_reads(required_per_arm=REQUIRED_PER_ARM, reached_per_arm=3)
    experiments.then.the_recommendation_is(Recommendation.KEEP_RUNNING)


def test_an_experiment_nobody_has_reached_reads_calmly_with_null_statistics(
    experiments: ExperimentsApiDriver,
) -> None:
    """Every step is listed at zero, every rate and both statistics are `null`, and the body is
    strict JSON — no `NaN` for `JSON.parse` to throw on."""
    experiments.when.the_results_are_read()

    experiments.then.the_read_succeeded()
    experiments.then.the_funnel_lists_every_step_in_order(arm="variant")
    experiments.then.the_step_reads(arm="variant", step=LANDING_VIEW, visitors=0)
    experiments.then.the_metric_reads(
        arm="control", metric="primary", successes=0, trials=0, rate=None
    )
    experiments.then.the_statistics_are_absent()
    experiments.then.the_sample_reads(required_per_arm=REQUIRED_PER_ARM, reached_per_arm=0)
    experiments.then.the_recommendation_is(Recommendation.KEEP_RUNNING)


def test_an_unknown_flag_is_not_found(experiments: ExperimentsApiDriver) -> None:
    experiments.when.the_results_are_read_for_an_unknown_flag()

    experiments.then.the_flag_was_not_found()
