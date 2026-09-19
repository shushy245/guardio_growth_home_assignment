"""The Pwned Passwords range port: what the k-anonymity check needs from a password-leak source.

The browser hashes the password with SHA-1 and sends the first five hex characters; the source
answers with every hash suffix that starts with them and how often each was seen. The full hash
never leaves the browser, which is why the proxy trades in a five-character prefix and a block
of text, not passwords. This module imports nothing from the web framework or any HTTP client.
"""

from typing import Protocol


class PwnedPasswordRangeError(Exception):
    """The range source could not be read: unreachable, refused, or rate-limited.

    One error type for every way a source can fail, so the handler decides once — 503, the
    browser shows "couldn't check" — without knowing which adapter is behind the port.
    """


class PwnedPasswordRangePort(Protocol):
    """A source of SHA-1 suffix ranges. `tests/fakes/pwned_password_range.py` is the in-memory
    implementation."""

    def fetch_range(self, prefix: str) -> str:
        """The `SUFFIX:COUNT` lines for a five-character prefix, as the source sent them, or
        `PwnedPasswordRangeError` if it cannot say."""
        ...
