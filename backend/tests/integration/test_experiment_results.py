"""The funnel read: one visitor per step per arm, and the arm is the stored assignment.

Design call 1 in `docs/plan.md` (S7): the query groups by `visitor_assignment.variant_key`, not
by the tag on the event, so one visitor belongs to exactly one arm however their steps were
tagged — the property the z-test's two independent samples rest on.
"""

from app.funnel_events.models import FunnelEventName
from tests.drivers.experiment_results import ExperimentResultsDriver

SCAN_COMPLETED = FunnelEventName.SCAN_COMPLETED
ACTIVATION = FunnelEventName.ACTIVATION


def test_each_arm_counts_its_own_visitors_at_each_step(
    experiment_results: ExperimentResultsDriver,
) -> None:
    experiment_results.given.a_visitor_in_arm("calm", took=(SCAN_COMPLETED, ACTIVATION))
    experiment_results.given.a_visitor_in_arm("calm", took=(SCAN_COMPLETED,))
    experiment_results.given.a_visitor_in_arm("urgent", took=(SCAN_COMPLETED,))

    experiment_results.when.the_funnel_is_read()

    experiment_results.then.the_arm_counted(arm="calm", step=SCAN_COMPLETED, visitors=2)
    experiment_results.then.the_arm_counted(arm="calm", step=ACTIVATION, visitors=1)
    experiment_results.then.the_arm_counted(arm="urgent", step=SCAN_COMPLETED, visitors=1)
    experiment_results.then.the_arm_counted(arm="urgent", step=ACTIVATION, visitors=0)


def test_a_visitor_who_recorded_a_step_twice_is_counted_once_for_it(
    experiment_results: ExperimentResultsDriver,
) -> None:
    """A retry with a fresh id lands as a second row. Counting rows would let one visitor's
    flaky network inflate a conversion rate."""
    experiment_results.given.a_visitor_in_arm("calm", took=(SCAN_COMPLETED,))
    experiment_results.given.the_visitor_recorded_again(SCAN_COMPLETED, tagged_as="calm")

    experiment_results.when.the_funnel_is_read()

    experiment_results.then.the_arm_counted(arm="calm", step=SCAN_COMPLETED, visitors=1)


def test_a_visitor_is_counted_in_the_arm_they_hold_whatever_their_events_are_tagged(
    experiment_results: ExperimentResultsDriver,
) -> None:
    """Two tags on one visitor's events, one arm in the read. Grouping by the event tag would
    put this visitor in both samples, and a funnel that counts them at activation in an arm
    where they never completed a scan would no longer decrease step by step."""
    experiment_results.given.a_visitor_in_arm("urgent", took=(SCAN_COMPLETED,))
    experiment_results.given.the_visitor_recorded_again(ACTIVATION, tagged_as="calm")

    experiment_results.when.the_funnel_is_read()

    experiment_results.then.the_arm_counted(arm="urgent", step=ACTIVATION, visitors=1)
    experiment_results.then.the_arm_counted(arm="calm", step=ACTIVATION, visitors=0)


def test_a_visitor_with_no_assignment_for_the_flag_is_in_neither_arm(
    experiment_results: ExperimentResultsDriver,
) -> None:
    experiment_results.given.a_visitor_outside_the_experiment(took=(SCAN_COMPLETED, ACTIVATION))

    experiment_results.when.the_funnel_is_read()

    experiment_results.then.nothing_was_counted()


def test_a_visitor_who_reached_a_step_without_the_one_it_converts_from_is_not_counted_for_the_pair(
    experiment_results: ExperimentResultsDriver,
) -> None:
    """`/signup` is reachable by link and by bookmark, so `activation` with no `scan_completed`
    is a shape the write endpoint accepts with a 201. The funnel still shows the visitor where
    they were; the rate they were never eligible for does not count them."""
    experiment_results.given.a_visitor_in_arm("calm", took=(ACTIVATION,))

    experiment_results.when.the_funnel_is_read()

    experiment_results.then.the_arm_counted(arm="calm", step=ACTIVATION, visitors=1)
    experiment_results.then.the_arm_counted_reaching_both(
        arm="calm", reached=ACTIVATION, and_reached=SCAN_COMPLETED, visitors=0
    )


def test_a_visitor_who_recorded_a_step_twice_is_counted_once_for_the_pair_it_belongs_to(
    experiment_results: ExperimentResultsDriver,
) -> None:
    """The same retry as above, read through a rate rather than a step: `funnel_event` is
    idempotent per client id, not per (visitor, step), so a second `activation` row would
    otherwise put one visitor into a numerator twice."""
    experiment_results.given.a_visitor_in_arm("calm", took=(SCAN_COMPLETED, ACTIVATION))
    experiment_results.given.the_visitor_recorded_again(ACTIVATION, tagged_as="calm")

    experiment_results.when.the_funnel_is_read()

    experiment_results.then.the_arm_counted_reaching_both(
        arm="calm", reached=ACTIVATION, and_reached=SCAN_COMPLETED, visitors=1
    )
