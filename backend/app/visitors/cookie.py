"""The visitor cookie's shape — pure, so the one security-relevant decision is readable in
isolation: `Secure` everywhere but dev, where the browser talks plain http to localhost and
would silently drop a Secure cookie."""

from datetime import timedelta

from app.config import Env

VISITOR_COOKIE = "visitor_id"
# A visitor is a long-lived identity for the experiment; a session cookie would re-bucket every
# returning visitor and double-count them in the funnel.
VISITOR_COOKIE_MAX_AGE = timedelta(days=365)


def is_secure_cookie_env(env: Env) -> bool:
    return env is not Env.DEV
