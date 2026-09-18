"""Which variant a visitor sees: a pure rule over the visitor id, the flag key and the weights.

No clock, no randomness, no database: the same inputs always give the same answer, which is
what makes an assignment reproducible from a log line and what lets the simulator reason about
the split it drove. The stored row (`visitor_assignment`) is still the source of truth for a
visitor — this rule decides only at creation; changing weights later moves new visitors only.
"""

import hashlib
from collections.abc import Sequence
from dataclasses import dataclass

# Weights are integer percentages, so a hundred buckets is exactly the resolution they have.
BUCKET_COUNT = 100


@dataclass(frozen=True)
class WeightedVariant:
    key: str
    weight: int


@dataclass(frozen=True)
class FlagSplit:
    """An enabled flag as the assignment rule sees it: its key and how it splits visitors."""

    key: str
    variants: tuple[WeightedVariant, ...]


def assign_all(*, visitor_id: str, splits: Sequence[FlagSplit]) -> dict[str, str]:
    """One assignment per enabled flag, keyed by flag key."""
    return {
        split.key: assign_variant(
            visitor_id=visitor_id, flag_key=split.key, variants=split.variants
        )
        for split in splits
    }


def assign_variant(*, visitor_id: str, flag_key: str, variants: Sequence[WeightedVariant]) -> str:
    """The variant whose slice of `[0, 100)` holds this visitor's bucket, in variant order.

    `sha256`, not `hash()`: Python salts `hash()` per process, so the same visitor would land in
    a different bucket on every worker and after every restart.
    """
    bucket = bucket_for(visitor_id=visitor_id, flag_key=flag_key)
    upper = 0
    for variant in variants:
        upper += variant.weight
        if bucket < upper:
            return variant.key

    msg = (
        f"assign_variant: weights of flag {flag_key!r} cover only {upper} of {BUCKET_COUNT} "
        f"buckets — bucket {bucket} for visitor {visitor_id!r} is unassigned"
    )
    raise ValueError(msg)


def weights_cover_every_bucket(variants: Sequence[WeightedVariant]) -> bool:
    """Weights are percentages of one whole: anything but 100 leaves buckets unassigned or
    double-assigned, and `assign_variant` would raise on the first visitor to land there."""
    return sum(variant.weight for variant in variants) == BUCKET_COUNT


def duplicated_variant_keys(variants: Sequence[WeightedVariant]) -> list[str]:
    """Every key that appears more than once, in first-seen order; empty when all are unique."""
    seen: set[str] = set()
    duplicated: list[str] = []
    for variant in variants:
        if variant.key in seen and variant.key not in duplicated:
            duplicated.append(variant.key)
        seen.add(variant.key)

    return duplicated


def bucket_for(*, visitor_id: str, flag_key: str) -> int:
    digest = hashlib.sha256(f"{visitor_id}:{flag_key}".encode()).digest()

    return int.from_bytes(digest[:8], "big") % BUCKET_COUNT
