"""HTTP shell for the breach catalog. Validation is the schema's job, SQL is the repository's.

Both endpoints answer 503 when the catalog holds nothing servable. That is the "never synthetic
data" rule at the boundary: an empty 200 would state that no breaches exist, when what is true
is that we are not holding the public record — usually because the HIBP sync has not yet
succeeded. The visitor sees an honest error instead of a clean bill of health.
"""

from datetime import UTC, datetime
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.breaches import repository
from app.breaches.schemas import (
    BreachListQuery,
    BreachPage,
    BreachResponse,
    BreachSummaryResponse,
)
from app.breaches.summary import summarise_breaches
from app.db.session import get_session

router = APIRouter()

CATALOG_UNAVAILABLE = (
    "the breach catalog is empty — the sync from the breach source has not succeeded yet"
)


@router.get("/breaches", response_model=BreachPage)
def list_breaches(
    query: Annotated[BreachListQuery, Query()],
    session: Annotated[Session, Depends(get_session)],
) -> BreachPage:
    rows, total = repository.list_breaches(session=session, query=query)
    if total == 0:
        # Only when there is nothing to show: a filter that matched nothing is a legitimate
        # empty page, and this distinguishes the two without a query on the normal path.
        _refuse_if_the_catalog_is_empty(session=session)

    return BreachPage(
        items=[BreachResponse.model_validate(row) for row in rows],
        total=total,
        page=query.page,
        limit=query.limit,
    )


@router.get("/breaches/summary", response_model=BreachSummaryResponse)
def get_breach_summary(
    session: Annotated[Session, Depends(get_session)],
) -> BreachSummaryResponse:
    summary = summarise_breaches(
        repository.list_breach_facts(session=session), today=datetime.now(UTC).date()
    )
    if summary is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=CATALOG_UNAVAILABLE
        )

    return BreachSummaryResponse.model_validate(summary)


def _refuse_if_the_catalog_is_empty(*, session: Session) -> None:
    if repository.has_any_servable_breach(session=session):
        return

    raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=CATALOG_UNAVAILABLE)
