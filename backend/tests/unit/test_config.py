import pytest

from app.config import Env, LogFormat, SettingsError, load_settings

COMPLETE_ENVIRON = {
    "ENV": "prod",
    "DATABASE_URL": "postgresql+psycopg://u:p@db:5432/breachscan",
    "FRONTEND_ORIGIN": "https://funnel.example",
    "ADMIN_TOKEN": "s3cret",
    "HIBP_USER_AGENT": "breach-scan",
}


def test_complete_environment_loads_typed_settings() -> None:
    settings = load_settings(COMPLETE_ENVIRON)

    assert settings.env is Env.PROD
    assert settings.database_url == COMPLETE_ENVIRON["DATABASE_URL"]
    assert settings.frontend_origin == COMPLETE_ENVIRON["FRONTEND_ORIGIN"]
    assert settings.admin_token.get_secret_value() == "s3cret"


def test_missing_database_url_fails_loudly_naming_the_variable() -> None:
    environ = {key: value for key, value in COMPLETE_ENVIRON.items() if key != "DATABASE_URL"}

    with pytest.raises(SettingsError, match="DATABASE_URL"):
        load_settings(environ)


def test_unknown_env_value_fails_loudly_naming_the_variable() -> None:
    environ = {**COMPLETE_ENVIRON, "ENV": "staging"}

    with pytest.raises(SettingsError, match="ENV"):
        load_settings(environ)


def test_admin_token_is_not_revealed_when_settings_are_printed() -> None:
    settings = load_settings(COMPLETE_ENVIRON)

    assert "s3cret" not in repr(settings)


def test_dev_logs_to_console_and_every_other_env_logs_json() -> None:
    assert load_settings({**COMPLETE_ENVIRON, "ENV": "dev"}).log_format is LogFormat.CONSOLE
    assert load_settings({**COMPLETE_ENVIRON, "ENV": "test"}).log_format is LogFormat.JSON
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
