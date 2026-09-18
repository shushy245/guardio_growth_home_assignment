"""Builder for `Settings`.

House builder shape: `a_settings()` factory, module-private class, `with_*` returns a **new**
builder (never mutates), `build()` returns the model. Defaults are valid so a test only states
what it cares about.
"""

from __future__ import annotations

from dataclasses import dataclass, replace

from pydantic import SecretStr

from app.config import Env, Settings

# The token every driver-built app is configured with; a test that wants to be refused sends
# something else. Not a credential: it never leaves the test process.
TEST_ADMIN_TOKEN = "test-admin-token"


def a_settings() -> _SettingsBuilder:
    return _SettingsBuilder(
        env=Env.TEST,
        database_url="postgresql+psycopg://breachscan:breachscan@localhost:5433/breachscan_test",
        frontend_origin="http://frontend.test",
        hibp_user_agent="breach-scan-funnel-test",
        admin_token=TEST_ADMIN_TOKEN,
    )


@dataclass(frozen=True)
class _SettingsBuilder:
    env: Env
    database_url: str
    frontend_origin: str
    hibp_user_agent: str
    admin_token: str

    def with_frontend_origin(self, frontend_origin: str) -> _SettingsBuilder:
        return replace(self, frontend_origin=frontend_origin)

    def with_env(self, env: Env) -> _SettingsBuilder:
        return replace(self, env=env)

    def build(self) -> Settings:
        return Settings(
            env=self.env,
            database_url=self.database_url,
            frontend_origin=self.frontend_origin,
            hibp_user_agent=self.hibp_user_agent,
            admin_token=SecretStr(self.admin_token),
        )
