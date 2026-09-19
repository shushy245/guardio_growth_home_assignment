"""The sign-up boundary's two numbers, spelled out.

Every other case states its input in terms of the constants, so they follow the constants
anywhere: raising the password ceiling to a megabyte left the whole suite green (BF84). On an
unauthenticated endpoint that ceiling is Argon2's 64 MiB of memory per request, not a long
password, so the number itself is the thing under test.
"""

import pytest
from pydantic import ValidationError

from app.signups.models import Plan
from app.signups.schemas import MAX_PASSWORD_LENGTH, MIN_PASSWORD_LENGTH, SignupCreate


def _a_signup_with_password(password: str) -> dict[str, object]:
    return {
        "email": "ada@example.com",
        "plan": Plan.BASIC,
        "password": password,
        "passwordWasPwned": False,
    }


def test_the_password_bounds_are_eight_and_two_hundred_and_fifty_six() -> None:
    assert MIN_PASSWORD_LENGTH == 8
    assert MAX_PASSWORD_LENGTH == 256


def test_a_password_of_two_hundred_and_fifty_seven_characters_is_refused() -> None:
    with pytest.raises(ValidationError):
        SignupCreate.model_validate(_a_signup_with_password("p" * 257))


def test_a_password_of_two_hundred_and_fifty_six_characters_is_accepted() -> None:
    signup = SignupCreate.model_validate(_a_signup_with_password("p" * 256))

    assert len(signup.password.get_secret_value()) == 256
