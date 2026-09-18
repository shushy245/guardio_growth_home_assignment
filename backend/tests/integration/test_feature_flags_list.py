"""`GET /api/feature-flags`: what `/admin` reads. Open — only the write is gated."""

from tests.drivers.feature_flags_api import RESULT_SCREEN_TONE, FeatureFlagsApiDriver


def test_the_seeded_flag_is_listed_with_both_variants_and_its_lock_token(
    flags: FeatureFlagsApiDriver,
) -> None:
    flags.when.the_flags_are_listed()

    flags.then.the_flag_is_listed_with_variants(RESULT_SCREEN_TONE, "calm", "urgent")
    flags.then.the_flag_is_enabled(RESULT_SCREEN_TONE)
    flags.then.the_flag_carries_a_lock_token(RESULT_SCREEN_TONE)
