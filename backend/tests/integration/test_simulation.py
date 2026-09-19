"""Simulated traffic through the real API: one browser per visitor, both arms, a funnel that
narrows.

The simulator encodes the effect it is asked for, so what this proves is the pipeline — the
cookie identity, the server-side assignment, the tagging, the distinct-visitor read — and not
the hypothesis. `docs/plan.md`, "Experiment design", says so in as many words.
"""

from tests.drivers.simulation import SimulationDriver


def test_two_hundred_simulated_visitors_land_in_both_arms_and_walk_a_narrowing_funnel(
    simulation: SimulationDriver,
) -> None:
    simulation.when.traffic_is_simulated(visitors=200)

    simulation.then.each_arm_holds_a_share_of_visitors_within(points=0.15)
    simulation.then.every_funnel_narrows_step_by_step()
    simulation.then.every_event_is_tagged_with_its_visitors_arm()


def test_every_simulated_visitor_is_its_own_browser(simulation: SimulationDriver) -> None:
    """BF47: the event endpoint identifies the browser by its cookie and refuses a body naming a
    visitor, so a simulator with one shared jar would be one visitor fifty times over."""
    simulation.when.traffic_is_simulated(visitors=50)

    simulation.then.every_simulated_visitor_is_a_distinct_visitor()


def test_a_run_marks_every_event_it_writes_with_its_own_id(simulation: SimulationDriver) -> None:
    simulation.when.traffic_is_simulated(visitors=20)

    simulation.then.every_event_names_the_run_that_wrote_it()


def test_a_run_against_an_api_it_cannot_walk_gives_up_instead_of_filling_the_table(
    simulation: SimulationDriver,
) -> None:
    """One failed visit is a flaky request and the run carries on; a stream of them is an API
    that is down, and walking hundreds of visitors into it writes hundreds of half-funnels the
    dashboard cannot tell from real drop-off (BF72)."""
    simulation.given.the_experiment_is_not_running()

    simulation.when.traffic_is_simulated_against_a_failing_api(visitors=200)

    simulation.then.the_run_gave_up_after_the_failure_threshold()
