"""HTTP shell for the k-anonymity proxy. The prefix is validated by the path parameter — five
upper-case hex characters, what the browser derives from a SHA-1 — before the port is asked, so
a malformed one never reaches the source. The answer is the source's text, as text.

Why a proxy at all: the browser could call the range API directly, but then a failed check is
invisible to us. Through the proxy it is a logged, correlated 503 and the field says "couldn't
check" — a fail-visible seam instead of a silent clean bill."""

from typing import Annotated

import structlog
from fastapi import APIRouter, Depends, HTTPException, Path, status
from fastapi.responses import PlainTextResponse

from app.dependencies import get_pwned_password_range
from app.ports.pwned_password_range import PwnedPasswordRangeError, PwnedPasswordRangePort

log = structlog.get_logger()

router = APIRouter()

PREFIX_PATTERN = r"^[0-9A-F]{5}$"

# What the browser is told. The adapter's own message names the upstream URL and carries the
# exception's repr — on-call detail, written for whoever reads the log, and not for a visitor's
# browser (BF67; BF38 is the same defect on the operator side). It stays in the warning below.
RANGE_SOURCE_UNAVAILABLE = "the password-leak source is unavailable — the check could not run"


@router.get("/pwned-passwords/range/{prefix}", response_class=PlainTextResponse)
def get_pwned_password_range_text(
    prefix: Annotated[str, Path(pattern=PREFIX_PATTERN)],
    source: Annotated[PwnedPasswordRangePort, Depends(get_pwned_password_range)],
) -> str:
    """Logs the prefix and nothing more: five hex characters name ~16 million hashes, which is
    the point of k-anonymity, and the rest of the hash never arrives here."""
    log.info("get_pwned_password_range: started", prefix=prefix)
    try:
        text = source.fetch_range(prefix)
    except PwnedPasswordRangeError as error:
        log.warning("get_pwned_password_range: source failed", prefix=prefix, reason=str(error))
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=RANGE_SOURCE_UNAVAILABLE,
        ) from error

    log.info("get_pwned_password_range: answered", prefix=prefix, line_count=text.count("\n") + 1)

    return text
