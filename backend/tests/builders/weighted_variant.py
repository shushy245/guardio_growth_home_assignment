"""Builder for a `WeightedVariant` — the pure assignment rule's view of a variant: key and weight.

The wire schema carries copy and tone as well; the rule only needs to know how the hundred
buckets are split, so this builds only that.
"""

from __future__ import annotations

from dataclasses import dataclass, replace

from app.feature_flags.assignment import WeightedVariant


def a_variant() -> _WeightedVariantBuilder:
    return _WeightedVariantBuilder()


@dataclass(frozen=True)
class _WeightedVariantBuilder:
    key: str = "calm"
    weight: int = 50

    def with_key(self, key: str) -> _WeightedVariantBuilder:
        return replace(self, key=key)

    def with_weight(self, weight: int) -> _WeightedVariantBuilder:
        return replace(self, weight=weight)

    def build(self) -> WeightedVariant:
        return WeightedVariant(key=self.key, weight=self.weight)
