import pytest

from app.config import Env, LogFormat, SettingsError, load_settings

COMPLETE_ENVIRON = {
    "ENV": "prod",
    "DATABASE_URL": "postgresql+psycopg://u:p@db:5432/breachscan",
    "FRONTEND_ORIGIN": "https://funnel.example",
    "HIBP_USER_AGENT": "breach-scan-funnel",
}


def test_complete_environment_loads_typed_settings() -> None:
    settings = load_settings(COMPLETE_ENVIRON)

    assert settings.env is Env.PROD
    assert settings.database_url == COMPLETE_ENVIRON["DATABASE_URL"]
    assert settings.frontend_origin == COMPLETE_ENVIRON["FRONTEND_ORIGIN"]
    assert settings.hibp_user_agent == COMPLETE_ENVIRON["HIBP_USER_AGENT"]


def test_missing_database_url_fails_loudly_naming_the_variable() -> None:
    environ = {key: value for key, value in COMPLETE_ENVIRON.items() if key != "DATABASE_URL"}

    with pytest.raises(SettingsError, match="DATABASE_URL"):
        load_settings(environ)


def test_missing_hibp_user_agent_fails_loudly_naming_the_variable() -> None:
    """HIBP refuses API calls that do not identify their consumer, so an unset value is a 403."""
    environ = {key: value for key, value in COMPLETE_ENVIRON.items() if key != "HIBP_USER_AGENT"}

    with pytest.raises(SettingsError, match="HIBP_USER_AGENT"):
        load_settings(environ)


def test_an_empty_hibp_user_agent_fails_loudly_too() -> None:
    """An empty value boots cleanly, HIBP answers 403, the sync swallows it, and both catalog
    endpoints answer 503 forever with a message that blames the sync rather than the config."""
    environ = {**COMPLETE_ENVIRON, "HIBP_USER_AGENT": ""}

    with pytest.raises(SettingsError, match="HIBP_USER_AGENT"):
        load_settings(environ)


def test_unknown_env_value_fails_loudly_naming_the_variable() -> None:
    environ = {**COMPLETE_ENVIRON, "ENV": "staging"}

    with pytest.raises(SettingsError, match="ENV"):
        load_settings(environ)


def test_dev_logs_to_a_readable_console() -> None:
    assert load_settings({**COMPLETE_ENVIRON, "ENV": "dev"}).log_format is LogFormat.CONSOLE


def test_the_test_env_logs_json() -> None:
    assert load_settings({**COMPLETE_ENVIRON, "ENV": "test"}).log_format is LogFormat.JSON


def test_prod_logs_json() -> None:
    assert load_settings({**COMPLETE_ENVIRON, "ENV": "prod"}).log_format is LogFormat.JSON


def test_frontend_origin_with_a_trailing_slash_fails_loudly() -> None:
    environ = {**COMPLETE_ENVIRON, "FRONTEND_ORIGIN": "https://funnel.example/"}

    with pytest.raises(SettingsError, match="FRONTEND_ORIGIN"):
        load_settings(environ)


def test_frontend_origin_with_a_path_fails_loudly() -> None:
    environ = {**COMPLETE_ENVIRON, "FRONTEND_ORIGIN": "https://funnel.example/app"}

    with pytest.raises(SettingsError, match="FRONTEND_ORIGIN"):
        load_settings(environ)


def test_frontend_origin_without_a_scheme_fails_loudly() -> None:
    environ = {**COMPLETE_ENVIRON, "FRONTEND_ORIGIN": "funnel.example"}

    with pytest.raises(SettingsError, match="FRONTEND_ORIGIN"):
        load_settings(environ)
