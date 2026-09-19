"""The only module that knows the Pwned Passwords range API's URL and headers.

A second HIBP adapter, not a second method on the first: the range API lives on its own host
(`api.pwnedpasswords.com`, not `haveibeenpwned.com/api/v3`), needs no API key, and answers text,
not JSON. One client per host, built once in the composition root.
"""

import httpx2 as httpx

from app.ports.pwned_password_range import PwnedPasswordRangeError

PWNED_PASSWORDS_BASE_URL = "https://api.pwnedpasswords.com"
RANGE_PATH = "/range"
# The check runs while someone types their password; a slow upstream must become "couldn't
# check" quickly rather than a field that never settles.
PWNED_PASSWORDS_TIMEOUT_SECONDS = 5.0
# With padding every answer carries 800 to 1000 lines whatever the prefix, so the length of the
# response says nothing about how common the password is to anyone watching the wire.
ADD_PADDING_HEADER = "Add-Padding"


def build_pwned_passwords_transport() -> httpx.BaseTransport:
    """The real network transport, named here so the composition root never imports httpx."""
    return httpx.HTTPTransport()


def build_pwned_passwords_client(
    *, user_agent: str, transport: httpx.BaseTransport
) -> httpx.Client:
    return httpx.Client(
        base_url=PWNED_PASSWORDS_BASE_URL,
        headers={"User-Agent": user_agent, ADD_PADDING_HEADER: "true"},
        timeout=PWNED_PASSWORDS_TIMEOUT_SECONDS,
        transport=transport,
    )


class HibpPwnedPasswordRange:
    """The production `PwnedPasswordRangePort`. Every way HTTP can fail becomes
    `PwnedPasswordRangeError`; the text comes back untouched, the browser parses it."""

    def __init__(self, *, client: httpx.Client) -> None:
        self._client = client

    def fetch_range(self, prefix: str) -> str:
        """`prefix` is interpolated into the URL path as given. The route is the boundary that
        holds it to five upper-case hex characters (`PREFIX_PATTERN`); a second caller of this
        port must validate the same way or the source is asked for whatever it was handed."""
        url = f"{PWNED_PASSWORDS_BASE_URL}{RANGE_PATH}/{prefix}"
        try:
            response = self._client.get(f"{RANGE_PATH}/{prefix}")
            response.raise_for_status()
        except httpx.HTTPStatusError as error:
            msg = f"fetch_range: the range API answered {error.response.status_code} for {url}"
            raise PwnedPasswordRangeError(msg) from error
        except httpx.HTTPError as error:
            msg = f"fetch_range: the range API is unreachable at {url} — {error!r}"
            raise PwnedPasswordRangeError(msg) from error

        return response.text
