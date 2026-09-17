"""HTTP shell for the breach catalog. Validation is the schema's job, SQL is the repository's."""

from typing import Annotated

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.breaches import repository
from app.breaches.schemas import BreachListQuery, BreachPage, BreachResponse
from app.db.session import get_session

router = APIRouter()


@router.get("/breaches", response_model=BreachPage)
def list_breaches(
    query: Annotated[BreachListQuery, Query()],
    session: Annotated[Session, Depends(get_session)],
) -> BreachPage:
    rows, total = repository.list_breaches(session=session, query=query)

    return BreachPage(
        items=[BreachResponse.model_validate(row) for row in rows],
        total=total,
        page=query.page,
        limit=query.limit,
    )
