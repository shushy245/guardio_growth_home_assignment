"""HTTP shell for the breach catalog. Validation is the schema's job, SQL is the repository's.

Both endpoints answer 503 when the catalog holds nothing servable. That is the "never synthetic
data" rule at the boundary: an empty 200 would state that no breaches exist, when what is true
is that we are not holding the public record — usually because the HIBP sync has not yet
succeeded. The visitor sees an honest error instead of a clean bill of health.

Every handler here revalidates the catalog first (`revalidate_catalog`): it answers from what
is stored and, if that has aged past the sync TTL, schedules a refresh after the response. It is
a call inside the handler rather than a router-level dependency on purpose: FastAPI solves
dependencies before it validates the handler's own parameters, and the contract is that an
invalid request is a 400 before any SQL runs.
"""

from datetime import UTC, datetime
from typing import Annotated

import structlog
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query, Request, status
from sqlalchemy.orm import Session

from app.breaches import repository
from app.breaches.refresh import CatalogRefresher
from app.breaches.schemas import (
    BreachListQuery,
    BreachPage,
    BreachResponse,
    BreachSummaryResponse,
)
from app.breaches.summary import summarise_breaches
from app.db.session import get_session
from app.errors import carry_background_tasks

log = structlog.get_logger()

CATALOG_UNAVAILABLE = (
    "the breach catalog is empty — the sync from the breach source has not succeeded yet"
)


router = APIRouter()


def revalidate_catalog(
    *, request: Request, background_tasks: BackgroundTasks, session: Session
) -> None:
    """Stale-while-revalidate.

    The refresh runs after the response through `BackgroundTasks`, in its own transaction from
    the app's session factory — never the request's session, which is closed by then. It is
    carried onto an error response too: an empty catalog is a 503 *and* the case that most needs
    the refresh, since it is how a boot that found HIBP down heals without a restart.
    """
    refresher: CatalogRefresher = request.app.state.catalog_refresher
    now = datetime.now(UTC)
    fetched_at = repository.latest_fetched_at(session=session)
    if not refresher.wants_refresh(fetched_at=fetched_at, now=now):
        return

    log.info(
        "revalidate_catalog: stored catalog is stale, scheduling a refresh after the response",
        last_fetch="never" if fetched_at is None else fetched_at.isoformat(),
    )
    background_tasks.add_task(
        refresher.refresh, session_factory=request.app.state.session_factory, now=now
    )
    carry_background_tasks(request=request, background_tasks=background_tasks)


@router.get("/breaches", response_model=BreachPage)
def list_breaches(
    query: Annotated[BreachListQuery, Query()],
    session: Annotated[Session, Depends(get_session)],
    request: Request,
    background_tasks: BackgroundTasks,
) -> BreachPage:
    revalidate_catalog(request=request, background_tasks=background_tasks, session=session)
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
    request: Request,
    background_tasks: BackgroundTasks,
) -> BreachSummaryResponse:
    revalidate_catalog(request=request, background_tasks=background_tasks, session=session)
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
