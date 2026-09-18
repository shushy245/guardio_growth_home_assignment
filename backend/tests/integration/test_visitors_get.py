"""`GET /api/visitors/{id}`: the refresh path. The page keeps the id and asks for the stored
assignments; nothing is recomputed, so changing the weights moves new visitors only."""

from tests.drivers.visitors_api import VisitorsApiDriver


def test_an_unknown_visitor_is_not_found(visitors: VisitorsApiDriver) -> None:
    visitors.when.an_unknown_visitor_is_fetched()

    visitors.then.the_visitor_was_not_found()


def test_a_visitor_keeps_the_assignment_made_at_creation_after_the_weights_change(
    visitors: VisitorsApiDriver,
) -> None:
    visitors.given.a_visitor_exists()
    visitors.given.the_split_no_longer_includes_the_visitors_variant()

    visitors.when.the_visitor_is_fetched()

    visitors.then.the_assignment_is_the_one_made_at_creation()
