"""Typed settings, validated once at startup.

`load_settings` takes an explicit mapping (normally `os.environ`) so the composition root is the
only place the process environment is read and tests build settings directly. A missing or
malformed variable fails loudly, naming the variable, before the app serves a request.
"""

from collections.abc import Mapping
from enum import StrEnum
from urllib.parse import urlsplit

from pydantic import BaseModel, ConfigDict, Field, SecretStr, ValidationError, field_validator


class Env(StrEnum):
    DEV = "dev"
    TEST = "test"
    PROD = "prod"


class LogFormat(StrEnum):
    JSON = "json"
    CONSOLE = "console"


_log_format_map: dict[Env, LogFormat] = {
    Env.DEV: LogFormat.CONSOLE,
    Env.TEST: LogFormat.JSON,
    Env.PROD: LogFormat.JSON,
}


class Settings(BaseModel):
    # No `extra="forbid"`: `load_settings` only ever passes known fields, and direct construction
    # is checked at type-check time by the pydantic mypy plugin (`init_forbid_extra`).
    model_config = ConfigDict(frozen=True)

    env: Env
    database_url: str
    frontend_origin: str
    # HIBP refuses API calls that do not identify their consumer; an unset value is a 403.
    hibp_user_agent: str = Field(min_length=1)
    # Gates the feature-flag write. Kept as SecretStr so a settings dump can never print it;
    # non-empty because an empty token would compare equal to an empty header.
    admin_token: SecretStr = Field(min_length=1)

    @property
    def log_format(self) -> LogFormat:
        return _log_format_map[self.env]

    @field_validator("database_url")
    @classmethod
    def _reject_anything_but_a_postgres_url(cls, value: str) -> str:
        if is_postgres_url(value):
            return value

        msg = (
            "must be a PostgreSQL SQLAlchemy URL — postgresql[+driver]://user:password@host/db "
            "— because the migrations, the jsonb columns and the text[] ones are Postgres's; "
            f"found {value!r}"
        )
        raise ValueError(msg)

    @field_validator("frontend_origin")
    @classmethod
    def _reject_anything_but_a_bare_origin(cls, value: str) -> str:
        if is_bare_origin(value):
            return value

        msg = (
            "must be a bare origin — scheme://host[:port], no path and no trailing slash — "
            f"because CORS compares the browser's Origin header exactly; found {value!r}"
        )
        raise ValueError(msg)


def is_bare_origin(value: str) -> bool:
    """`http://localhost:5173` yes; `https://x.test/`, `https://x.test/app`, `x.test` no."""
    parsed = urlsplit(value)

    return (
        parsed.scheme in {"http", "https"}
        and bool(parsed.netloc)
        and not parsed.path
        and not parsed.query
        and not parsed.fragment
    )


def is_postgres_url(value: str) -> bool:
    """`postgresql+psycopg://u:p@db:5432/x` yes; `sqlite:///x.db`, `postgres//db/x` no.

    Checked here because `create_engine` is lazy: a URL with a typo'd scheme builds an app that
    boots, answers health and 500s on the first request that touches data (BF68).
    """
    scheme = urlsplit(value).scheme

    return scheme == "postgresql" or scheme.startswith("postgresql+")


class SettingsError(Exception):
    """Raised at startup when the environment is incomplete or malformed."""


def load_settings(environ: Mapping[str, str]) -> Settings:
    provided = {
        field: environ[field.upper()] for field in Settings.model_fields if field.upper() in environ
    }
    try:
        return Settings.model_validate(provided)
    except ValidationError as error:
        raise SettingsError(_describe(error)) from error


def _describe(error: ValidationError) -> str:
    problems = [
        f"{'.'.join(str(part) for part in item['loc']).upper()}: {item['msg']}"
        for item in error.errors()
    ]
    return f"load_settings: invalid environment — {'; '.join(problems)}"
