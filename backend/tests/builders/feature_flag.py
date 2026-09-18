"""Builders for the feature-flag wire shapes: what the admin page sends on PATCH.

`build()` returns the camelCase JSON mapping the API actually receives, so tests exercise the
aliases and the validators rather than a pre-parsed object. Defaults are the seeded
`result_screen_tone` flag, so a test states only what it changes.
"""

from __future__ import annotations

from dataclasses import dataclass, field, replace
from datetime import UTC, datetime

SEEDED_UPDATED_AT = datetime(2026, 9, 18, 8, 0, tzinfo=UTC)


def a_wire_variant() -> _WireVariantBuilder:
    return _WireVariantBuilder()


@dataclass(frozen=True)
class _WireVariantBuilder:
    key: str = "calm"
    weight: int = 50
    headline: str = "Known breaches"
    subheadline: str = "Here's the public record of data breaches."
    cta_label: str = "Protect me"
    tone: str = "calm"

    def with_key(self, key: str) -> _WireVariantBuilder:
        return replace(self, key=key)

    def with_weight(self, weight: int) -> _WireVariantBuilder:
        return replace(self, weight=weight)

    def with_cta_label(self, cta_label: str) -> _WireVariantBuilder:
        return replace(self, cta_label=cta_label)

    def with_tone(self, tone: str) -> _WireVariantBuilder:
        return replace(self, tone=tone)

    def build(self) -> dict[str, object]:
        return {
            "key": self.key,
            "weight": self.weight,
            "config": {
                "headline": self.headline,
                "subheadline": self.subheadline,
                "ctaLabel": self.cta_label,
                "tone": self.tone,
            },
        }


def _calm_and_urgent() -> tuple[_WireVariantBuilder, ...]:
    return (
        a_wire_variant().with_key("calm").with_weight(50),
        a_wire_variant().with_key("urgent").with_weight(50).with_tone("urgent"),
    )


def a_feature_flag_update() -> _FeatureFlagUpdateBuilder:
    return _FeatureFlagUpdateBuilder()


@dataclass(frozen=True)
class _FeatureFlagUpdateBuilder:
    description: str = "Tone of the result screen."
    is_enabled: bool = True
    variants: tuple[_WireVariantBuilder, ...] = field(default_factory=_calm_and_urgent)
    updated_at: datetime = SEEDED_UPDATED_AT

    def with_variants(self, *variants: _WireVariantBuilder) -> _FeatureFlagUpdateBuilder:
        return replace(self, variants=variants)

    def disabled(self) -> _FeatureFlagUpdateBuilder:
        return replace(self, is_enabled=False)

    def with_updated_at(self, updated_at: datetime) -> _FeatureFlagUpdateBuilder:
        return replace(self, updated_at=updated_at)

    def build(self) -> dict[str, object]:
        return {
            "description": self.description,
            "isEnabled": self.is_enabled,
            "variants": [variant.build() for variant in self.variants],
            "updatedAt": self.updated_at.isoformat(),
        }
