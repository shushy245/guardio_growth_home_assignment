"""Is the service able to answer, not merely running.

An app whose database is unreachable boots, serves this route and 500s on every endpoint that
touches data — so a health check that only says "the process is up" tells a restarter, a deploy
gate and an on-call engineer the opposite of what they need (BF68). One `SELECT 1` is the whole
check: it proves the pool can hand out a connection the database accepts.
"""

import structlog
from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError

from app.db.session import SessionFactoryDep

log = structlog.get_logger()

router = APIRouter()

DATABASE_UNAVAILABLE = "the database is unreachable — the service cannot answer requests"


class HealthResponse(BaseModel):
    status: str


@router.get("/health", response_model=HealthResponse)
def get_health(session_factory: SessionFactoryDep) -> HealthResponse:
    """The factory rather than a request session: a `SessionDep` would raise inside the
    dependency, before the handler runs, and the probe would answer 500 instead of 503."""
    try:
        with session_factory() as session:
            session.execute(text("SELECT 1"))
    except SQLAlchemyError as error:
        log.warning("get_health: the database did not answer", reason=str(error))
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=DATABASE_UNAVAILABLE
        ) from error

    return HealthResponse(status="ok")
