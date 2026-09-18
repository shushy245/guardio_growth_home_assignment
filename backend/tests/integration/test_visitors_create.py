"""`POST /api/visitors`: a visitor is minted, assigned to every enabled flag, and handed a
cookie that names them. The assignment is stored, so a refresh later reads the same one."""

from app.config import Env
from tests.drivers.visitors_api import RESULT_SCREEN_TONE, VisitorsApiDriver


def test_a_new_visitor_is_created_and_assigned_to_the_enabled_flag(
    visitors: VisitorsApiDriver,
) -> None:
    visitors.when.a_visitor_is_created()

    visitors.then.the_visitor_was_created()
    visitors.then.the_visitor_id_is_prefixed("vis")
    visitors.then.the_visitor_is_assigned_to_one_of(RESULT_SCREEN_TONE, "calm", "urgent")
    visitors.then.the_assignment_is_stored(RESULT_SCREEN_TONE)
    visitors.then.the_visitor_cookie_names_the_visitor()


def test_a_disabled_flag_gets_no_assignment_but_the_visitor_is_still_created(
    visitors: VisitorsApiDriver,
) -> None:
    visitors.given.the_result_screen_tone_flag_is_disabled()

    visitors.when.a_visitor_is_created()

    visitors.then.the_visitor_was_created()
    visitors.then.the_visitor_has_no_assignments()


def test_the_visitor_cookie_is_http_only_lax_and_secure_outside_dev(
    visitors: VisitorsApiDriver,
) -> None:
    """Test settings run as `ENV=test`, which is "not dev" — the production-shaped cookie."""
    visitors.when.a_visitor_is_created()

    visitors.then.the_visitor_cookie_is_http_only_and_lax()
    visitors.then.the_visitor_cookie_is_secure()


def test_the_visitor_cookie_is_not_secure_in_dev(visitors: VisitorsApiDriver) -> None:
    visitors.given.the_app_runs_in(Env.DEV)

    visitors.when.a_visitor_is_created()

    visitors.then.the_visitor_cookie_is_http_only_and_lax()
    visitors.then.the_visitor_cookie_is_not_secure()
