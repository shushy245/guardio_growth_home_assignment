"""Prefixed, time-sortable identifiers: `vis_01J9…`, `evt_01J9…`, `sup_01J9…`.

The prefix names the entity type in logs and DB rows; the ULID body sorts lexicographically by
creation millisecond, which gives stable pagination order and B-tree locality. Ids minted in the
same millisecond are unique but not ordered relative to each other.
"""

import time

from ulid import ULID


def generate_unique_id(prefix: str) -> str:
    return generate_unique_id_at(prefix=prefix, timestamp_ms=time.time_ns() // 1_000_000)


def generate_unique_id_at(*, prefix: str, timestamp_ms: int) -> str:
    """Injected-clock form, so tests can pin the millisecond a id was minted in.

    `timestamp_ms / 1_000` must stay a **float** division: python-ulid's `from_timestamp` reads a
    `float` as seconds and an `int` as milliseconds, so narrowing it to `//` would silently shift
    every id by a factor of 1000 while still producing well-formed, sortable output.
    """
    return f"{prefix}_{ULID.from_timestamp(timestamp_ms / 1_000)}"
