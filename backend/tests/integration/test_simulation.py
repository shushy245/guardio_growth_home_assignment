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

    simulation.then.the_run_gave_up_after_ten_failures()
    simulation.then.ten_visitors_were_created_before_it_stopped()


def test_a_run_carries_on_past_one_visit_whose_server_never_answered(
    simulation: SimulationDriver,
) -> None:
    """A read timeout is the likeliest flaky request there is, and it does not arrive as a
    response at all — the catch has to cover the transport, not only a non-2xx (review, 2a)."""
    simulation.given.the_browser_of_visit(1)

    simulation.when.traffic_is_simulated(visitors=6)

    simulation.then.no_failure_was_raised()
    simulation.then.every_visitor_but_the_failed_one_walked(of=6)


def test_a_run_whose_every_request_times_out_gives_up_like_any_other_failure(
    simulation: SimulationDriver,
) -> None:
    simulation.given.every_browser_talks_to_a_server_that_never_answers(visits=200)

    simulation.when.traffic_is_simulated_against_a_failing_api(visitors=200)

    simulation.then.the_run_gave_up_after_ten_failures()
    simulation.then.nobody_was_created()


def test_a_run_missing_an_arms_activation_rate_says_so_rather_than_guessing(
    simulation: SimulationDriver,
) -> None:
    """The arm is the server's choice, so a rate for every arm the flag can assign is the
    simulator's precondition; walking an unnamed arm with another's rate would encode an effect
    nobody asked for (BF86)."""
    simulation.when.traffic_is_simulated_with_a_rate_for_only_one_arm(visitors=200)

    simulation.then.the_failure_named_the_arm_with_no_rate()
