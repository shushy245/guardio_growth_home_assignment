"""Variant assignment is a pure rule — a visitor id, a flag key and the weights in, a variant
key out — so it is asserted directly with no database and no HTTP."""

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
