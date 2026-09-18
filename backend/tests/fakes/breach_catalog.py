"""In-memory `BreachCatalogPort` — a real implementation of the port, not a mock.

It survives refactoring of the HIBP adapter because it is coupled to the port's behaviour, not
to how the adapter achieves it. `fetch_count` is what lets a test prove the TTL actually skips a
fetch rather than merely writing the same rows again, and `answers_only_when_released` is what
lets a test hold a fetch open to prove that nothing starts a second one meanwhile.
"""

import threading

from app.ports.breach_catalog import Breach, BreachCatalogError

# A held fetch that is never released is a test bug, not a hang: fail it, loudly, in bounded time.
RELEASE_TIMEOUT_SECONDS = 5
UNREACHABLE_REASON = "fetch_all: fake catalog is unreachable"


class FakeBreachCatalog:
    def __init__(self) -> None:
        self._breaches: list[Breach] = []
        self._reachable = True
        self._released = threading.Event()
        self._released.set()
        self._counting = threading.Lock()
        self.fetch_started = threading.Event()
        self.fetch_count = 0

    def holds(self, breaches: list[Breach]) -> None:
        self._breaches = list(breaches)

    def becomes_unreachable(self) -> None:
        self._reachable = False

    def answers_only_when_released(self) -> None:
        """Every fetch from now on blocks inside `fetch_all` until `release()` — a slow HIBP."""
        self._released.clear()

    def release(self) -> None:
        self._released.set()

    def fetch_all(self) -> list[Breach]:
        # The count is the evidence that single-flight holds, so it must not itself lose an
        # increment under two genuinely concurrent fetches — the case it exists to detect.
        with self._counting:
            self.fetch_count += 1
        self.fetch_started.set()
        if not self._released.wait(timeout=RELEASE_TIMEOUT_SECONDS):
            msg = "fetch_all: fake catalog was held for too long and never released"
            raise AssertionError(msg)
        if not self._reachable:
            raise BreachCatalogError(UNREACHABLE_REASON)

        return list(self._breaches)
