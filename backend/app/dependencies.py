"""Request-scoped access to what the composition root built once.

`Settings` is stored on `app.state` by `create_app` and read back through this dependency, so a
handler declares that it needs settings instead of importing a module-level singleton — and a
test's settings arrive the same way production's do."""

from fastapi import Request

from app.config import Settings
from app.signups.password_hash import PasswordHasher


def get_settings(request: Request) -> Settings:
    settings: Settings = request.app.state.settings

    return settings


def get_password_hasher(request: Request) -> PasswordHasher:
    hasher: PasswordHasher = request.app.state.password_hasher

    return hasher
