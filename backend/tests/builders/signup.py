"""Builder for the sign-up wire body: what the browser posts when the form is submitted.

`build()` returns the camelCase JSON mapping the API receives, so tests exercise the aliases and
the validators. Defaults are valid, so a test states only what it cares about.
"""

from __future__ import annotations

from dataclasses import dataclass, replace

from app.signups.models import Plan

A_PASSWORD = "correct horse battery staple"


def a_signup() -> _SignupBuilder:
    return _SignupBuilder()


@dataclass(frozen=True)
class _SignupBuilder:
    email: str = "ada@example.com"
    plan: str = Plan.FAMILY
    password: str = A_PASSWORD
    password_was_pwned: bool = False

    def with_email(self, email: str) -> _SignupBuilder:
        return replace(self, email=email)

    def with_plan(self, plan: str) -> _SignupBuilder:
        return replace(self, plan=plan)

    def with_password(self, password: str) -> _SignupBuilder:
        return replace(self, password=password)

    def with_a_leaked_password(self) -> _SignupBuilder:
        """What the browser sends when the k-anonymity check found the password in a breach."""
        return replace(self, password_was_pwned=True)

    def build(self) -> dict[str, object]:
        return {
            "email": self.email,
            "plan": self.plan,
            "password": self.password,
            "passwordWasPwned": self.password_was_pwned,
        }
