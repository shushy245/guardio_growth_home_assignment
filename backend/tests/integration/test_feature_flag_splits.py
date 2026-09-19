"""A stored split that does not cover the buckets is refused once, at the read.

The write path has always rejected one. The read path did not, so a row that got in another way
— a migration, a psql prompt — was validated variant by variant and never as a whole, and the
failure surfaced later as an intermittent 500 on `POST /api/visitors`: only the visitors whose
bucket happened to land past the last weight.
"""

from tests.drivers.flag_splits import RESULT_SCREEN_TONE, FlagSplitsDriver


def test_a_stored_split_that_leaves_buckets_unassigned_is_refused(
    flag_splits: FlagSplitsDriver,
) -> None:
    flag_splits.given.the_stored_weights_sum_to(90)

    flag_splits.when.the_enabled_splits_are_read()

    flag_splits.then.the_read_was_refused_naming(RESULT_SCREEN_TONE)


def test_a_stored_split_that_reaches_past_the_last_bucket_is_refused(
    flag_splits: FlagSplitsDriver,
) -> None:
    """A 60/60 split assigns nobody to the second arm: every bucket is inside the first sixty,
    so the dashboard shows an experiment with one empty arm and no error anywhere (BF79)."""
    flag_splits.given.the_stored_weights_sum_to(120)

    flag_splits.when.the_enabled_splits_are_read()

    flag_splits.then.the_read_was_refused_naming(RESULT_SCREEN_TONE)


def test_a_stored_flag_with_no_variants_is_refused(flag_splits: FlagSplitsDriver) -> None:
    flag_splits.given.the_stored_flag_has_no_variants()

    flag_splits.when.the_enabled_splits_are_read()

    flag_splits.then.the_read_was_refused_naming(RESULT_SCREEN_TONE)


def test_the_seeded_split_is_read(flag_splits: FlagSplitsDriver) -> None:
    flag_splits.when.the_enabled_splits_are_read()

    flag_splits.then.the_split_was_read(RESULT_SCREEN_TONE)
