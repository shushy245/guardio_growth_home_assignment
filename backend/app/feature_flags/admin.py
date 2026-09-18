"""The gate on the feature-flag write: a shared secret in the `X-Admin-Token` header.

Full auth is out of scope for a take-home; an open write on a security company's product is
not acceptable either. The comparison is constant-time so the token cannot be recovered one
byte at a time from response timings, and the log line never carries what was sent.
"""

import hmac
from typing import Annotated

import structlog
from fastapi import Depends, Header, HTTPException, status

from app.config import Settings
from app.dependencies import get_settings

log = structlog.get_logger()

ADMIN_HEADER_NAME = "X-Admin-Token"
REFUSED = f"a valid {ADMIN_HEADER_NAME} header is required to change a feature flag"


def require_admin_token(
    settings: Annotated[Settings, Depends(get_settings)],
    # Optional at the framework level on purpose: a missing header is an authorisation failure
    # (401), not a malformed request (400), which is what a required header would make it.
    x_admin_token: Annotated[str | None, Header()] = None,
) -> None:
    if x_admin_token is None:
        log.info("require_admin_token: refused, header missing")
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=REFUSED)

    if not is_the_admin_token(presented=x_admin_token, settings=settings):
        log.info("require_admin_token: refused, header does not match")
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=REFUSED)


def is_the_admin_token(*, presented: str, settings: Settings) -> bool:
    return hmac.compare_digest(presented.encode(), settings.admin_token.get_secret_value().encode())
