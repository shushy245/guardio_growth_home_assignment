from app.shared.ids import generate_unique_id, generate_unique_id_at

ULID_LENGTH = 26


def test_id_is_prefix_underscore_and_a_26_char_body() -> None:
    generated = generate_unique_id("vis")

    assert generated.startswith("vis_")
    assert len(generated) == len("vis_") + ULID_LENGTH


def test_ids_created_at_increasing_milliseconds_sort_by_creation() -> None:
    earlier = generate_unique_id_at(prefix="evt", timestamp_ms=1_000)
    middle = generate_unique_id_at(prefix="evt", timestamp_ms=2_000)
    later = generate_unique_id_at(prefix="evt", timestamp_ms=3_000)

    assert sorted([later, earlier, middle]) == [earlier, middle, later]


def test_a_thousand_ids_in_the_same_millisecond_are_unique() -> None:
    ids = {generate_unique_id_at(prefix="sup", timestamp_ms=5_000) for _ in range(1_000)}

    assert len(ids) == 1_000
