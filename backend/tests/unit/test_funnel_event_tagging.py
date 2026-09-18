"""Tagging an event with its experiment is a pure rule over the visitor's assignments, so it is
asserted directly with no database and no HTTP."""

import pytest

from app.funnel_events.tagging import ExperimentTag, experiment_tag


def test_a_visitor_with_one_assignment_is_tagged_with_that_flag_and_variant() -> None:
    assert experiment_tag({"result_screen_tone": "urgent"}) == ExperimentTag(
        flag_key="result_screen_tone", variant_key="urgent"
    )


def test_a_visitor_outside_every_experiment_gets_no_tag() -> None:
    assert experiment_tag({}) is None


def test_a_visitor_holding_two_assignments_is_refused_rather_than_guessed() -> None:
    with pytest.raises(ValueError, match="holds 2 assignments"):
        experiment_tag({"result_screen_tone": "urgent", "other_flag": "on"})
