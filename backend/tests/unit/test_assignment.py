"""Variant assignment is a pure rule — a visitor id, a flag key and the weights in, a variant
key out — so it is asserted directly with no database and no HTTP."""

import pytest

from app.feature_flags.assignment import assign_variant, bucket_for
from tests.builders.weighted_variant import a_variant

CALM_URGENT_SPLIT = [
    a_variant().with_key("calm").with_weight(50).build(),
    a_variant().with_key("urgent").with_weight(50).build(),
]


def test_the_same_visitor_and_flag_always_get_the_same_variant() -> None:
    visitor_ids = [f"vis_{index:026d}" for index in range(1_000)]

    first = [
        assign_variant(visitor_id=vid, flag_key="result_screen_tone", variants=CALM_URGENT_SPLIT)
        for vid in visitor_ids
    ]
    second = [
        assign_variant(visitor_id=vid, flag_key="result_screen_tone", variants=CALM_URGENT_SPLIT)
        for vid in visitor_ids
    ]

    assert first == second


def test_the_split_over_ten_thousand_visitors_is_within_three_points_of_the_weights() -> None:
    visitor_ids = [f"vis_{index:026d}" for index in range(10_000)]
    variants = [
        a_variant().with_key("calm").with_weight(30).build(),
        a_variant().with_key("urgent").with_weight(70).build(),
    ]

    assigned = [
        assign_variant(visitor_id=vid, flag_key="result_screen_tone", variants=variants)
        for vid in visitor_ids
    ]

    calm_share = assigned.count("calm") / len(assigned)
    assert abs(calm_share - 0.30) <= 0.03, f"calm got {calm_share:.1%}, expected 30% ± 3"


def test_a_single_variant_holding_all_the_weight_is_always_chosen() -> None:
    only = [a_variant().with_key("calm").with_weight(100).build()]

    assigned = {
        assign_variant(visitor_id=f"vis_{index:026d}", flag_key="tone", variants=only)
        for index in range(1_000)
    }

    assert assigned == {"calm"}


def test_a_known_visitor_lands_in_a_pinned_bucket() -> None:
    """Pins the digest. Python's `hash()` is salted per process, so an implementation built on
    it would pass every other test here and still assign the same visitor differently on each
    worker — this is the one test that would catch the swap."""
    bucket = bucket_for(visitor_id="vis_01K5G6X0000000000000000000", flag_key="result_screen_tone")

    assert bucket == 24


def test_a_variant_weighted_zero_is_never_assigned_even_to_the_first_bucket() -> None:
    """The slice is `[lower, upper)`, and the visitor in bucket 0 is the only one who can tell
    that from `[lower, upper]`: with the bound inclusive, a leading zero-weight variant takes
    every hundredth visitor — an arm product turned off still collecting traffic (BF84).

    `vis_103` is bucket 0 for this flag; the hash is deterministic, so the id is the case.
    """
    split = [
        a_variant().with_key("retired").with_weight(0).build(),
        a_variant().with_key("calm").with_weight(100).build(),
    ]

    assert bucket_for(visitor_id="vis_103", flag_key="result_screen_tone") == 0
    assert (
        assign_variant(visitor_id="vis_103", flag_key="result_screen_tone", variants=split)
        == "calm"
    )


def test_a_split_that_leaves_a_bucket_unassigned_raises_naming_the_flag_and_the_visitor() -> None:
    """The backstop under the two guards that should have caught it first — the update schema on
    write and `list_enabled_splits` on read. It had never been exercised (BF86), and it is what
    turns a corrupt row into one loud error naming what to look at instead of a 500 with a
    traceback into the middle of the assignment loop."""
    short_split = [a_variant().with_key("calm").with_weight(10).build()]

    with pytest.raises(ValueError, match="result_screen_tone") as error:
        assign_variant(visitor_id="vis_0", flag_key="result_screen_tone", variants=short_split)

    assert "vis_0" in str(error.value)
    assert "10" in str(error.value)
