"""The flag's wire schema is the boundary: what it rejects never reaches a handler.

Asserted directly on the Pydantic model — a schema is a pure function of its input — and again
through HTTP once the PATCH route exists, where the same rejection has to be a 400.
"""

import pytest
from pydantic import ValidationError

from app.feature_flags.schemas import FeatureFlagUpdate
from tests.builders.feature_flag import a_feature_flag_update, a_wire_variant


def test_a_flag_update_with_a_complete_split_is_accepted() -> None:
    payload = a_feature_flag_update().build()

    update = FeatureFlagUpdate.model_validate(payload)

    assert [variant.key for variant in update.variants] == ["calm", "urgent"]


def test_a_flag_update_whose_weights_do_not_sum_to_a_hundred_is_rejected() -> None:
    payload = (
        a_feature_flag_update()
        .with_variants(
            a_wire_variant().with_key("calm").with_weight(50),
            a_wire_variant().with_key("urgent").with_weight(40),
        )
        .build()
    )

    with pytest.raises(ValidationError, match="100"):
        FeatureFlagUpdate.model_validate(payload)


def test_a_flag_update_with_two_variants_sharing_a_key_is_rejected() -> None:
    """Two `calm`s would make an assignment ambiguous and merge two configs under one label."""
    payload = (
        a_feature_flag_update()
        .with_variants(
            a_wire_variant().with_key("calm").with_weight(50),
            a_wire_variant().with_key("calm").with_weight(50),
        )
        .build()
    )

    with pytest.raises(ValidationError, match="calm"):
        FeatureFlagUpdate.model_validate(payload)
