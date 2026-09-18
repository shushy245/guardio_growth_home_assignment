"""The wire contract for feature flags: what `/admin` reads and what it is allowed to save.

The variant list is validated as a whole here, once, so a handler and the assignment rule never
have to ask whether the weights add up or the keys are distinct. The same models narrow the
JSONB column on the way out of the database (`repository.py`), so the stored shape and the wire
shape are one vocabulary.
"""

from datetime import datetime
from enum import StrEnum

from pydantic import BaseModel, ConfigDict, Field, field_validator
from pydantic.alias_generators import to_camel

from app.feature_flags.assignment import (
    BUCKET_COUNT,
    WeightedVariant,
    duplicated_variant_keys,
    weights_cover_every_bucket,
)

_wire = ConfigDict(alias_generator=to_camel, populate_by_name=True, frozen=True)


class Tone(StrEnum):
    """How the result screen frames the same data. The frontend maps each member to a class."""

    CALM = "calm"
    URGENT = "urgent"


class VariantConfig(BaseModel):
    model_config = _wire

    headline: str = Field(min_length=1, max_length=120)
    subheadline: str = Field(min_length=1, max_length=240)
    cta_label: str = Field(min_length=1, max_length=40)
    tone: Tone


class FeatureFlagVariant(BaseModel):
    model_config = _wire

    # Keys are identifiers that end up in event rows and dashboard labels, not display text.
    key: str = Field(min_length=1, max_length=40, pattern=r"^[a-z][a-z0-9_]*$")
    weight: int = Field(ge=0, le=BUCKET_COUNT)
    config: VariantConfig


def to_weighted_variants(variants: list[FeatureFlagVariant]) -> list[WeightedVariant]:
    """The assignment rule's view: keys and weights, nothing about copy."""
    return [WeightedVariant(key=variant.key, weight=variant.weight) for variant in variants]


class FeatureFlagUpdate(BaseModel):
    """The whole flag, every time. A partial PATCH would need optional fields used as "leave
    it alone" sentinels; the admin page holds the whole flag anyway, so it sends it."""

    model_config = ConfigDict(alias_generator=to_camel, extra="forbid", frozen=True)

    description: str = Field(min_length=1, max_length=240)
    is_enabled: bool
    variants: list[FeatureFlagVariant] = Field(min_length=1)
    # The optimistic-lock token: the `updatedAt` the client read, matched on write.
    updated_at: datetime

    @field_validator("variants")
    @classmethod
    def _reject_an_incomplete_or_ambiguous_split(
        cls, variants: list[FeatureFlagVariant]
    ) -> list[FeatureFlagVariant]:
        weighted = to_weighted_variants(variants)
        if not weights_cover_every_bucket(weighted):
            total = sum(variant.weight for variant in weighted)
            msg = f"variant weights must sum to {BUCKET_COUNT}; these sum to {total}"
            raise ValueError(msg)

        duplicated = duplicated_variant_keys(weighted)
        if duplicated:
            msg = f"variant keys must be unique; duplicated: {', '.join(duplicated)}"
            raise ValueError(msg)

        return variants


class FeatureFlagResponse(BaseModel):
    model_config = ConfigDict(**_wire, from_attributes=True)

    key: str
    description: str
    is_enabled: bool
    variants: list[FeatureFlagVariant]
    created_at: datetime
    updated_at: datetime


class FeatureFlagUpdated(BaseModel):
    """What a PATCH returns: only the new lock token — the client sent everything else."""

    model_config = _wire

    updated_at: datetime
