"""In-memory `PwnedPasswordRangePort` — a real implementation of the port, not a mock.

A test says what the range source answers for a prefix; the fake records every prefix it was
asked for, which is how a test proves the proxy forwarded exactly the five characters it was
given and nothing more.
"""

from app.ports.pwned_password_range import PwnedPasswordRangeError

UNREACHABLE_REASON = "fetch_range: fake range source is unreachable"


class FakePwnedPasswordRange:
    def __init__(self) -> None:
        self._ranges: dict[str, str] = {}
        self._reachable = True
        self.requested_prefixes: list[str] = []

    def answers(self, *, prefix: str, text: str) -> None:
        self._ranges[prefix] = text

    def becomes_unreachable(self) -> None:
        self._reachable = False

    def fetch_range(self, prefix: str) -> str:
        self.requested_prefixes.append(prefix)
        if not self._reachable:
            raise PwnedPasswordRangeError(UNREACHABLE_REASON)

        # A prefix nothing was registered for is a real, empty range — the source answers
        # every well-formed prefix, padded or not.
        return self._ranges.get(prefix, "")
