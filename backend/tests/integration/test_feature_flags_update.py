"""`PATCH /api/feature-flags/{key}`: the product-owned write, behind the admin token and an
optimistic lock. Every save is built from a flag the driver read first, so the token in play is
the one the API handed out."""

from tests.drivers.feature_flags_api import FeatureFlagsApiDriver


def test_a_save_with_the_current_token_persists_the_change_and_returns_the_new_token(
    flags: FeatureFlagsApiDriver,
) -> None:
    flags.given.the_flag_was_read()

    flags.when.the_cta_label_is_saved_as("Protect me today")

    flags.then.the_save_was_accepted_with_a_new_token()
    flags.then.every_cta_label_now_reads("Protect me today")


def test_the_token_is_accepted_when_spelled_with_an_explicit_offset(
    flags: FeatureFlagsApiDriver,
) -> None:
    """The wire round trip: `Z` and `+00:00` name the same instant, and a page that
    re-serialises the token must not be turned away for the spelling."""
    flags.given.the_flag_was_read()

    flags.when.the_flag_is_saved_with_the_token_spelled_with_an_explicit_offset()

    flags.then.the_save_was_accepted_with_a_new_token()


def test_two_consecutive_saves_each_carrying_the_returned_token_both_succeed(
    flags: FeatureFlagsApiDriver,
) -> None:
    """Postgres pins `now()` to the transaction start; a token minted with it would not move
    between two writes in one transaction — which is exactly what this harness runs a test in."""
    flags.given.the_flag_was_read()

    flags.when.the_flag_is_saved_twice_carrying_each_returned_token()

    flags.then.both_saves_were_accepted_and_the_token_advanced_each_time()


def test_a_save_with_a_stale_token_is_refused_and_changes_nothing(
    flags: FeatureFlagsApiDriver,
) -> None:
    flags.given.the_flag_was_read()
    flags.given.the_flag_was_saved_once_since()

    flags.when.the_flag_is_saved_with_the_stale_token()

    flags.then.the_save_was_refused_as_stale()
    flags.then.the_description_is_still("edited by another operator")


def test_a_save_to_an_unknown_flag_is_not_found(flags: FeatureFlagsApiDriver) -> None:
    flags.given.the_flag_was_read()

    flags.when.an_unknown_flag_is_saved()

    flags.then.the_flag_was_not_found()


def test_a_save_whose_weights_do_not_sum_to_a_hundred_is_rejected_before_anything_is_written(
    flags: FeatureFlagsApiDriver,
) -> None:
    flags.given.the_flag_was_read()

    flags.when.the_flag_is_saved_with_weights(50, 40)

    flags.then.the_save_was_rejected()
    flags.then.the_description_is_still(
        "Tone of the result screen: calm framing vs urgent framing of the same data."
    )
