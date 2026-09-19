"""The Pwned Passwords adapter over a fake transport: real client, real URL and headers."""

from tests.drivers.hibp_pwned_passwords import HibpPwnedPasswordsDriver

A_RANGE = "0018A45C4D1DEF81644B54AB7F969B88D65:1\r\n00D4F6E8FA6EECAD2A3AA415EEC418D38EC:2"


def test_the_adapter_asks_the_range_api_for_the_prefix_with_padding_and_identifies_itself(
    hibp_pwned: HibpPwnedPasswordsDriver,
) -> None:
    hibp_pwned.given.the_api_answers_with(A_RANGE)

    hibp_pwned.when.the_range_is_fetched("5BAA6")

    hibp_pwned.then.the_api_was_asked_for("https://api.pwnedpasswords.com/range/5BAA6")
    hibp_pwned.then.the_request_asked_for_padding()
    hibp_pwned.then.the_request_identified_us()


def test_the_adapter_returns_the_range_text_untouched(
    hibp_pwned: HibpPwnedPasswordsDriver,
) -> None:
    """The browser parses the lines; the proxy is a pipe, not a translator."""
    hibp_pwned.given.the_api_answers_with(A_RANGE)

    hibp_pwned.when.the_range_is_fetched("5BAA6")

    hibp_pwned.then.the_range_text_is(A_RANGE)


def test_an_unreachable_range_api_becomes_a_range_error(
    hibp_pwned: HibpPwnedPasswordsDriver,
) -> None:
    hibp_pwned.given.the_api_is_unreachable()

    hibp_pwned.when.the_range_is_fetched("5BAA6")

    hibp_pwned.then.it_failed_saying("fetch_range", "unreachable")


def test_a_non_2xx_answer_becomes_a_range_error_naming_the_status(
    hibp_pwned: HibpPwnedPasswordsDriver,
) -> None:
    hibp_pwned.given.the_api_answers_status(429)

    hibp_pwned.when.the_range_is_fetched("5BAA6")

    hibp_pwned.then.it_failed_saying("fetch_range", "429")
