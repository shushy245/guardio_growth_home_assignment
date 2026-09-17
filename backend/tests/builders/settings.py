"""Builder for `Settings`.

House builder shape: `a_settings()` factory, module-private class, `with_*` returns a **new**
builder (never mutates), `build()` returns the model. Defaults are valid so a test only states
what it cares about.
"""

from __future__ import annotations

from dataclasses import dataclass, replace

from app.config import Env, Settings


def a_settings() -> _SettingsBuilder:
    return _SettingsBuilder(
        env=Env.TEST,
        database_url="postgresql+psycopg://breachscan:breachscan@localhost:5433/breachscan_test",
        frontend_origin="http://frontend.test",
        hibp_user_agent="breach-scan-funnel-test",
    )


@dataclass(frozen=True)
class _SettingsBuilder:
    env: Env
    database_url: str
    frontend_origin: str
    hibp_user_agent: str

    def with_frontend_origin(self, frontend_origin: str) -> _SettingsBuilder:
        return replace(self, frontend_origin=frontend_origin)

    def build(self) -> Settings:
        return Settings(
            env=self.env,
            database_url=self.database_url,
            frontend_origin=self.frontend_origin,
            hibp_user_agent=self.hibp_user_agent,
        )
