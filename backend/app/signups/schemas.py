"""The wire contract for sign-up: what the form posts and what a create answers.

The password arrives as `SecretStr` so it cannot land in a log line or an error message by
accident — its `repr` is `**********` — and the handler reads it once, to hash. The email is
lower-cased here, at the boundary, so the unique index and every later comparison see one
spelling. `extra="forbid"`: a body naming a visitor would let a caller file an account under
someone else; the visitor is the cookie, as it is for funnel events."""

from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field, SecretStr, field_validator
from pydantic.alias_generators import to_camel

from app.signups.models import Plan

MIN_PASSWORD_LENGTH = 8
# Argon2 hashes any length, but a megabyte of password is a request to burn CPU, not a credential.
MAX_PASSWORD_LENGTH = 256


class SignupCreate(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, extra="forbid", frozen=True)

    email: EmailStr
    plan: Plan
    password: SecretStr = Field(min_length=MIN_PASSWORD_LENGTH, max_length=MAX_PASSWORD_LENGTH)
    # What the browser's k-anonymity check found. Persisted as sent: the read is "how many chose
    # a leaked password anyway", so it has to be the browser's answer at that moment.
    password_was_pwned: bool

    @field_validator("email", mode="after")
    @classmethod
    def _lower_case(cls, email: str) -> str:
        return email.lower()


class SignupCreated(BaseModel):
    """What a create returns: only what the client cannot know."""

    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True, frozen=True)

    id: str
    created_at: datetime
