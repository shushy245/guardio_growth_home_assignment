"""`POST /api/signups`: an account is created once per email, its password stored as an
Argon2id hash, filed under the visitor the cookie names when the server knows them."""

from app.signups.schemas import MAX_PASSWORD_LENGTH
from tests.builders.signup import a_signup
from tests.drivers.signups_api import SignupsApiDriver


def test_a_valid_signup_creates_an_account_and_answers_only_what_the_client_cannot_know(
    signups: SignupsApiDriver,
) -> None:
    signups.given.a_visitor_exists()

    signups.when.a_signup_is_submitted(a_signup().with_email("Ada@Example.com"))

    signups.then.the_account_was_created()
    signups.then.the_signup_id_is_prefixed("sup")
    signups.then.the_stored_email_is("ada@example.com")
    signups.then.the_stored_plan_is("family")
    signups.then.the_stored_password_is_an_argon2id_hash_of_the_one_submitted()
    signups.then.the_stored_signup_belongs_to_the_visitor()


def test_a_second_signup_with_the_same_email_in_another_case_is_a_conflict(
    signups: SignupsApiDriver,
) -> None:
    signups.given.a_visitor_exists()
    signups.given.an_account_already_exists(a_signup().with_email("ada@example.com"))

    signups.when.a_signup_is_submitted(a_signup().with_email("ADA@example.com"))

    signups.then.the_email_is_already_taken()
    signups.then.exactly_one_signup_is_stored()


def test_a_duplicate_is_refused_by_the_index_not_by_a_read_the_handler_made_first(
    signups: SignupsApiDriver,
) -> None:
    """Two people submitting the same email in the same instant both pass a read-then-insert;
    only the unique index answers the second one. The repository must report the conflict
    itself, so the handler never has to look first."""
    signups.given.a_visitor_exists()
    signups.given.an_account_already_exists(a_signup())

    signups.when.a_duplicate_is_inserted_bypassing_the_handler(a_signup())

    signups.then.the_direct_insert_reported_the_conflict()
    signups.then.exactly_one_signup_is_stored()


def test_an_invalid_email_is_refused(signups: SignupsApiDriver) -> None:
    signups.given.a_visitor_exists()

    signups.when.a_signup_is_submitted(a_signup().with_email("not-an-email"))

    signups.then.the_signup_was_refused()
    signups.then.no_signup_is_stored()


def test_a_password_under_eight_characters_is_refused(signups: SignupsApiDriver) -> None:
    signups.given.a_visitor_exists()

    signups.when.a_signup_is_submitted(a_signup().with_password("short"))

    signups.then.the_signup_was_refused()
    signups.then.no_signup_is_stored()


def test_a_password_at_the_length_bound_is_accepted_and_one_character_past_it_is_refused(
    signups: SignupsApiDriver,
) -> None:
    """Argon2 hashes any length; the bound is about what it costs to hash it. Only a case at
    the edge pins the number — a megabyte-long limit leaves every other case green (BF84), and
    on an unauthenticated endpoint that is 64 MiB of memory per request, not a long password.
    """
    signups.given.a_visitor_exists()

    signups.when.a_signup_is_submitted(a_signup().with_password("p" * MAX_PASSWORD_LENGTH))

    signups.then.the_account_was_created()

    signups.when.a_signup_is_submitted(
        a_signup().with_email("longer@example.com").with_password("p" * (MAX_PASSWORD_LENGTH + 1))
    )

    signups.then.the_signup_was_refused()


def test_a_plan_the_product_does_not_offer_is_refused(signups: SignupsApiDriver) -> None:
    signups.given.a_visitor_exists()

    signups.when.a_signup_is_submitted(a_signup().with_plan("enterprise"))

    signups.then.the_signup_was_refused()
    signups.then.no_signup_is_stored()


def test_the_leaked_password_flag_is_persisted_as_the_browser_sent_it(
    signups: SignupsApiDriver,
) -> None:
    """The read is "how many chose a leaked password anyway" — the browser's answer at the
    moment of sign-up, never a re-check."""
    signups.given.a_visitor_exists()

    signups.when.a_signup_is_submitted(a_signup().with_a_leaked_password())

    signups.then.the_account_was_created()
    signups.then.the_stored_flag_says_the_password_was_leaked()


def test_a_signup_from_a_browser_with_no_visitor_cookie_is_stored_with_no_visitor(
    signups: SignupsApiDriver,
) -> None:
    """The funnel fails open when the visitor service is down (ADR-0004). The purchase step
    must not dead-end on it: a customer the experiment cannot attribute is still a customer."""
    signups.when.a_signup_is_submitted(a_signup())

    signups.then.the_account_was_created()
    signups.then.the_stored_signup_has_no_visitor()


def test_a_signup_from_a_cookie_naming_a_visitor_nobody_knows_is_stored_with_no_visitor(
    signups: SignupsApiDriver,
) -> None:
    """A browser outliving a database reset; the foreign key cannot point at nobody."""
    signups.given.the_browser_carries_a_cookie_naming_nobody()

    signups.when.a_signup_is_submitted(a_signup())

    signups.then.the_account_was_created()
    signups.then.the_stored_signup_has_no_visitor()


def test_neither_the_response_nor_the_log_carries_the_password_or_its_hash(
    signups: SignupsApiDriver,
) -> None:
    signups.given.a_visitor_exists()

    signups.when.a_signup_is_submitted(a_signup())

    signups.then.the_account_was_created()
    signups.then.neither_the_response_nor_the_log_carries_the_password_or_its_hash()
