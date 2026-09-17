"""In-memory `BreachCatalogPort` — a real implementation of the port, not a mock.

It survives refactoring of the HIBP adapter because it is coupled to the port's behaviour, not
to how the adapter achieves it. `fetch_count` is what lets a test prove the TTL actually skips a
fetch rather than merely writing the same rows again.
"""

from app.ports.breach_catalog import Breach, BreachCatalogError


class FakeBreachCatalog:
    def __init__(self) -> None:
        self._breaches: list[Breach] = []
        self._reachable = True
        self.fetch_count = 0

    def holds(self, breaches: list[Breach]) -> None:
        self._breaches = list(breaches)

    def becomes_unreachable(self) -> None:
        self._reachable = False

    def fetch_all(self) -> list[Breach]:
        self.fetch_count += 1
        if not self._reachable:
            msg = "fetch_all: fake catalog is unreachable"
            raise BreachCatalogError(msg)

        return list(self._breaches)
