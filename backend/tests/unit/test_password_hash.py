"""`PasswordHasher` is a pure wrapper over argon2 — no I/O, so asserted directly, no driver."""

from app.signups.password_hash import ARGON2ID_PREFIX, PasswordHasher

A_PASSWORD = "correct horse battery staple"


def test_a_hashed_password_verifies_against_the_password_it_was_made_from() -> None:
    hasher = PasswordHasher()

    hashed = hasher.hash_password(A_PASSWORD)

    assert hasher.verify_password(password=A_PASSWORD, password_hash=hashed)


def test_a_wrong_password_does_not_verify() -> None:
    hasher = PasswordHasher()

    hashed = hasher.hash_password(A_PASSWORD)

    assert not hasher.verify_password(password="wrong horse", password_hash=hashed)


def test_the_stored_hash_is_argon2id_and_never_the_password_itself() -> None:
    hasher = PasswordHasher()

    hashed = hasher.hash_password(A_PASSWORD)

    assert hashed.startswith(ARGON2ID_PREFIX), f"not an argon2id hash: {hashed[:20]!r}"
    assert A_PASSWORD not in hashed


def test_hashing_the_same_password_twice_gives_two_different_hashes() -> None:
    """Salted per hash: two people with the same password must not share a stored value."""
    hasher = PasswordHasher()

    assert hasher.hash_password(A_PASSWORD) != hasher.hash_password(A_PASSWORD)
