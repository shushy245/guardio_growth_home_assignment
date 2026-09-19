"""Password storage: Argon2id, wrapped once so nothing else imports argon2 (ADR-0005).

The library's defaults are the parameters it ships as recommended (time cost 3, 64 MiB, four
lanes) and each hash carries its own random salt, so two people with the same password never
share a stored value. The SHA-1 the k-anonymity check computes in the browser is never stored —
an unsalted digest is a lookup key, not a credential.

One hasher per process: the parameters are parsed once at construction, in the composition root.
"""

import argon2

ARGON2ID_PREFIX = "$argon2id$"


class PasswordHasher:
    def __init__(self) -> None:
        self._hasher = argon2.PasswordHasher()

    def hash_password(self, password: str) -> str:
        return self._hasher.hash(password)

    def verify_password(self, *, password: str, password_hash: str) -> bool:
        """A mismatch is an answer, not an error: the library raises, this returns."""
        try:
            return self._hasher.verify(password_hash, password)
        except argon2.exceptions.VerifyMismatchError:
            return False
