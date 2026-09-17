"""Typed settings, validated once at startup.

`load_settings` takes an explicit mapping (normally `os.environ`) so the composition root is the
only place the process environment is read and tests build settings directly. A missing or
malformed variable fails loudly, naming the variable, before the app serves a request.
"""

from collections.abc import Mapping
from enum import StrEnum

from pydantic import BaseModel, ConfigDict, SecretStr, ValidationError


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
    model_config = ConfigDict(frozen=True, extra="forbid")

    env: Env
    database_url: str
    frontend_origin: str
    admin_token: SecretStr
    hibp_user_agent: str

    @property
    def log_format(self) -> LogFormat:
        return _log_format_map[self.env]


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
