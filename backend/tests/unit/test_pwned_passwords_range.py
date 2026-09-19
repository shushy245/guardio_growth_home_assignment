"""`GET /api/pwned-passwords/range/{prefix}`: the k-anonymity proxy. The browser sends the
first five characters of a SHA-1 and never the rest; the proxy forwards exactly those."""

from tests.drivers.pwned_passwords_api import PwnedPasswordsApiDriver

A_RANGE = "0018A45C4D1DEF81644B54AB7F969B88D65:1\r\n00D4F6E8FA6EECAD2A3AA415EEC418D38EC:2"


def test_the_proxy_forwards_exactly_the_five_character_prefix_and_returns_the_text(
    pwned_passwords: PwnedPasswordsApiDriver,
) -> None:
    pwned_passwords.given.the_range_source_answers(prefix="5BAA6", text=A_RANGE)

    pwned_passwords.get.the_range("5BAA6")

    pwned_passwords.then.the_range_text_is(A_RANGE)
    pwned_passwords.then.the_source_was_asked_for_exactly("5BAA6")


def test_a_prefix_that_is_not_five_upper_case_hex_characters_is_refused_before_any_call(
    pwned_passwords: PwnedPasswordsApiDriver,
) -> None:
    pwned_passwords.get.the_range("5baa6")

    pwned_passwords.then.the_prefix_was_refused()
    pwned_passwords.then.the_source_was_asked_for_exactly()


def test_a_prefix_of_the_wrong_length_is_refused_before_any_call(
    pwned_passwords: PwnedPasswordsApiDriver,
) -> None:
    pwned_passwords.get.the_range("5BAA6F")

    pwned_passwords.then.the_prefix_was_refused()
    pwned_passwords.then.the_source_was_asked_for_exactly()


def test_an_unreachable_source_is_a_503_with_the_house_error_body(
    pwned_passwords: PwnedPasswordsApiDriver,
) -> None:
    """Fail visibly: the browser shows "couldn't check", never a clean bill it did not earn."""
    pwned_passwords.given.the_range_source_is_unreachable()

    pwned_passwords.get.the_range("5BAA6")

    pwned_passwords.then.the_source_is_unavailable()
    pwned_passwords.then.the_source_s_own_words_were_not_repeated_to_the_browser()
