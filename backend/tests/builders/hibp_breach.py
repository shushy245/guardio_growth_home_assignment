"""Builder for one raw HIBP `/breaches` record — the wire shape, before translation.

Defaults mirror a real record so a test states only the field it cares about. `build()` returns
the untyped JSON mapping the adapter actually receives, so the tests exercise the wire names and
the Pydantic aliases rather than a pre-parsed object.
"""

from __future__ import annotations

from dataclasses import dataclass, replace


def a_hibp_breach() -> _HibpBreachBuilder:
    return _HibpBreachBuilder()


@dataclass(frozen=True)
class _HibpBreachBuilder:
    name: str = "000webhost"
    title: str = "000webhost"
    domain: str = "000webhost.com"
    breach_date: str = "2015-03-01"
    added_date: str = "2015-10-26T23:35:45Z"
    modified_date: str = "2017-12-10T21:44:27Z"
    pwn_count: int = 14936670
    description: str = 'The breach exposed <a href="https://example.test">customer records</a>.'
    logo_path: str = "https://logos.haveibeenpwned.com/000webhost.png"
    attribution: str | None = None
    disclosure_url: str | None = None
    data_classes: tuple[str, ...] = ("Email addresses", "IP addresses", "Names", "Passwords")
    is_verified: bool = True
    is_fabricated: bool = False
    is_sensitive: bool = False
    is_retired: bool = False
    is_spam_list: bool = False
    is_malware: bool = False
    is_subscription_free: bool = False
    is_stealer_log: bool = False

    def with_description(self, description: str) -> _HibpBreachBuilder:
        return replace(self, description=description)

    def with_domain(self, domain: str) -> _HibpBreachBuilder:
        return replace(self, domain=domain)

    def with_attribution(self, attribution: str | None) -> _HibpBreachBuilder:
        return replace(self, attribution=attribution)

    def with_disclosure_url(self, disclosure_url: str | None) -> _HibpBreachBuilder:
        return replace(self, disclosure_url=disclosure_url)

    def build(self) -> dict[str, object]:
        return {
            "Name": self.name,
            "Title": self.title,
            "Domain": self.domain,
            "BreachDate": self.breach_date,
            "AddedDate": self.added_date,
            "ModifiedDate": self.modified_date,
            "PwnCount": self.pwn_count,
            "Description": self.description,
            "LogoPath": self.logo_path,
            "Attribution": self.attribution,
            "DisclosureUrl": self.disclosure_url,
            "DataClasses": list(self.data_classes),
            "IsVerified": self.is_verified,
            "IsFabricated": self.is_fabricated,
            "IsSensitive": self.is_sensitive,
            "IsRetired": self.is_retired,
            "IsSpamList": self.is_spam_list,
            "IsMalware": self.is_malware,
            "IsSubscriptionFree": self.is_subscription_free,
            "IsStealerLog": self.is_stealer_log,
        }
