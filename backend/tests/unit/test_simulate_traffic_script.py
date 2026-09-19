"""The simulator script's argument parsing — the file the README tells a reviewer to run.

Three lines of parsing with no test at all (BF86): a rate the funnel cannot produce, or a
malformed `--activation`, would otherwise be found by a 4,000-visitor run rather than by the
parser, and argparse's error is the only thing standing between a typo and a wasted run.
"""

import argparse
import re

import pytest

from app.experiments.simulation import MAX_ACTIVATION_RATE
from scripts.simulate_traffic import DEFAULT_VISITORS, build_parser, parse_arm_rate


def test_an_arm_and_its_rate_are_read_as_a_pair() -> None:
    assert parse_arm_rate("calm=0.08") == ("calm", 0.08)


def test_a_pair_with_no_equals_sign_is_refused_naming_the_form() -> None:
    with pytest.raises(argparse.ArgumentTypeError, match=re.escape("calm=0.08")):
        parse_arm_rate("calm")


def test_a_pair_with_no_arm_is_refused() -> None:
    with pytest.raises(argparse.ArgumentTypeError):
        parse_arm_rate("=0.08")


def test_a_rate_that_is_not_a_number_is_refused() -> None:
    with pytest.raises(argparse.ArgumentTypeError, match="not a number"):
        parse_arm_rate("calm=soon")


def test_a_rate_the_funnel_shape_cannot_produce_is_refused_before_the_run() -> None:
    with pytest.raises(argparse.ArgumentTypeError, match="must be in"):
        parse_arm_rate(f"calm={MAX_ACTIVATION_RATE + 0.01}")


def test_a_rate_of_zero_is_refused() -> None:
    with pytest.raises(argparse.ArgumentTypeError, match="must be in"):
        parse_arm_rate("calm=0")


def test_the_parser_reads_a_run_the_readme_spells_out() -> None:
    args = build_parser().parse_args(
        ["--visitors", "4000", "--activation", "calm=0.08", "urgent=0.10"]
    )

    assert args.visitors == 4000
    assert dict(args.activation) == {"calm": 0.08, "urgent": 0.10}


def test_the_activation_rates_are_required_and_the_rest_default() -> None:
    args = build_parser().parse_args(["--activation", "calm=0.08"])

    assert args.visitors == DEFAULT_VISITORS
    assert args.base_url.startswith("http://")

    with pytest.raises(SystemExit):
        build_parser().parse_args([])
