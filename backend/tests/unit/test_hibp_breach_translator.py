"""The HIBP translator is pure, so it is asserted directly — no driver, no I/O.

These tests are the proof that HIBP's vocabulary stops at the adapter: they feed wire names
(`PwnCount`, `IsRetired`) in and read our names (`pwn_count`, `is_retired`) out.
"""

from datetime import UTC, date, datetime

import pytest

from app.adapters.hibp.breach_catalog import to_breaches
from app.ports.breach_catalog import Breach, BreachCatalogError
from tests.builders.hibp_breach import a_hibp_breach


def test_the_hibp_translator_maps_every_wire_field_onto_our_breach_model() -> None:
    payload = [a_hibp_breach().build()]

    assert to_breaches(payload) == [
        Breach(
            name="000webhost",
            title="000webhost",
            domain="000webhost.com",
            breach_date=date(2015, 3, 1),
            added_date=datetime(2015, 10, 26, 23, 35, 45, tzinfo=UTC),
            modified_date=datetime(2017, 12, 10, 21, 44, 27, tzinfo=UTC),
            pwn_count=14936670,
            description="The breach exposed customer records.",
            logo_path="https://logos.haveibeenpwned.com/000webhost.png",
            data_classes=("Email addresses", "IP addresses", "Names", "Passwords"),
            is_verified=True,
            is_fabricated=False,
            is_sensitive=False,
            is_retired=False,
            is_spam_list=False,
            is_malware=False,
            is_subscription_free=False,
            is_stealer_log=False,
            attribution=None,
            disclosure_url=None,
        )
    ]


def test_the_hibp_translator_reads_an_empty_domain_as_absent() -> None:
    """HIBP writes "no domain" as `""` (54 of 1,036 records); our model says absent with `None`."""
    payload = [a_hibp_breach().with_domain("").build()]

    assert to_breaches(payload)[0].domain is None


def test_the_hibp_translator_rejects_a_payload_that_is_not_hibps_shape() -> None:
    """A schema change upstream must fail loudly here, never yield half-populated breaches."""
    payload = [{"Name": "acme.test"}]

    with pytest.raises(BreachCatalogError) as error:
        to_breaches(payload)

    assert "to_breaches" in str(error.value)
    assert "Title" in str(error.value)
