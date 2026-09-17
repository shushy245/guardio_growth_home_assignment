"""The only module that knows what HIBP's breach payload looks like.

`_HibpBreach` is the wire contract — PascalCase field names and all — and `to_breaches` is the
boundary: untrusted JSON in, validated domain objects out. Validation happens here, once, so no
code downstream ever has to ask whether a field was present or what type it arrived as.
"""

import json
from datetime import date, datetime

import httpx2 as httpx
from pydantic import BaseModel, ConfigDict, Field, TypeAdapter, ValidationError

from app.ports.breach_catalog import Breach, BreachCatalogError
from app.shared.html import strip_html

HIBP_BASE_URL = "https://haveibeenpwned.com/api/v3"
BREACHES_PATH = "/breaches"
# A blocking startup sync must not hang the boot on a slow upstream. The catalog is ~1MB.
HIBP_TIMEOUT_SECONDS = 15.0


def build_hibp_transport() -> httpx.BaseTransport:
    """The real network transport, named here so the composition root never imports httpx."""
    return httpx.HTTPTransport()


def build_hibp_client(*, user_agent: str, transport: httpx.BaseTransport) -> httpx.Client:
    """Built once in the composition root and closed over — a client per call is a connection
    pool per call. The transport is injected because it is a real dependency: production passes
    the network, tests pass a fake wire, and neither is a special case of the other."""
    return httpx.Client(
        base_url=HIBP_BASE_URL,
        headers={"User-Agent": user_agent},
        timeout=HIBP_TIMEOUT_SECONDS,
        transport=transport,
    )


class HibpBreachCatalog:
    """The production `BreachCatalogPort`. Every way HTTP can fail becomes `BreachCatalogError`,
    so callers choose between serving what is stored and failing visibly without knowing that
    HIBP — or HTTP at all — is on the other side."""

    def __init__(self, *, client: httpx.Client) -> None:
        self._client = client

    def fetch_all(self) -> list[Breach]:
        try:
            response = self._client.get(BREACHES_PATH)
            response.raise_for_status()
        except httpx.HTTPStatusError as error:
            msg = (
                f"fetch_all: HIBP answered {error.response.status_code} for "
                f"{HIBP_BASE_URL}{BREACHES_PATH}"
            )
            raise BreachCatalogError(msg) from error
        except httpx.HTTPError as error:
            msg = f"fetch_all: HIBP is unreachable at {HIBP_BASE_URL}{BREACHES_PATH} — {error!r}"
            raise BreachCatalogError(msg) from error

        try:
            payload = response.json()
        except json.JSONDecodeError as error:
            msg = (
                f"fetch_all: HIBP answered {response.status_code} but the body is not JSON — "
                f"first 80 bytes: {response.text[:80]!r}"
            )
            raise BreachCatalogError(msg) from error

        return to_breaches(payload)


class _HibpBreach(BaseModel):
    """HIBP's wire shape. Aliases are the only accepted input, so wire names cannot leak."""

    model_config = ConfigDict(frozen=True)

    name: str = Field(alias="Name")
    title: str = Field(alias="Title")
    domain: str = Field(alias="Domain")
    breach_date: date = Field(alias="BreachDate")
    added_date: datetime = Field(alias="AddedDate")
    modified_date: datetime = Field(alias="ModifiedDate")
    pwn_count: int = Field(alias="PwnCount")
    description: str = Field(alias="Description")
    logo_path: str = Field(alias="LogoPath")
    data_classes: tuple[str, ...] = Field(alias="DataClasses")
    is_verified: bool = Field(alias="IsVerified")
    is_fabricated: bool = Field(alias="IsFabricated")
    is_sensitive: bool = Field(alias="IsSensitive")
    is_retired: bool = Field(alias="IsRetired")
    is_spam_list: bool = Field(alias="IsSpamList")
    is_malware: bool = Field(alias="IsMalware")
    is_subscription_free: bool = Field(alias="IsSubscriptionFree")
    is_stealer_log: bool = Field(alias="IsStealerLog")
    attribution: str | None = Field(alias="Attribution")
    disclosure_url: str | None = Field(alias="DisclosureUrl")


# Compiled once at import: a TypeAdapter builds a validator, which is not cheap per call.
_hibp_breach_list = TypeAdapter(list[_HibpBreach])


def to_breaches(payload: object) -> list[Breach]:
    """Validate a raw `/breaches` response and translate it into our model.

    Raises `BreachCatalogError` naming the offending fields when HIBP's shape has moved: a
    partially populated catalog would be synthetic data wearing a real catalog's clothes.
    """
    try:
        records = _hibp_breach_list.validate_python(payload)
    except ValidationError as error:
        msg = f"to_breaches: HIBP payload is not the expected shape — {_describe(error)}"
        raise BreachCatalogError(msg) from error

    return [_to_breach(record) for record in records]


def _describe(error: ValidationError) -> str:
    """`[0].Title: Field required; [0].PwnCount: Field required` — index and wire name."""
    problems = [
        f"{'.'.join(f'[{part}]' if isinstance(part, int) else str(part) for part in item['loc'])}"
        f": {item['msg']}"
        for item in error.errors()
    ]
    return "; ".join(problems)


def _to_breach(record: _HibpBreach) -> Breach:
    return Breach(
        name=record.name,
        title=record.title,
        domain=_none_if_empty(record.domain),
        breach_date=record.breach_date,
        added_date=record.added_date,
        modified_date=record.modified_date,
        pwn_count=record.pwn_count,
        description=strip_html(record.description),
        logo_path=record.logo_path,
        data_classes=record.data_classes,
        is_verified=record.is_verified,
        is_fabricated=record.is_fabricated,
        is_sensitive=record.is_sensitive,
        is_retired=record.is_retired,
        is_spam_list=record.is_spam_list,
        is_malware=record.is_malware,
        is_subscription_free=record.is_subscription_free,
        is_stealer_log=record.is_stealer_log,
        attribution=record.attribution,
        disclosure_url=record.disclosure_url,
    )


def _none_if_empty(value: str) -> str | None:
    """HIBP writes a missing domain as `""`; our model states absence with `None`."""
    return None if value == "" else value
