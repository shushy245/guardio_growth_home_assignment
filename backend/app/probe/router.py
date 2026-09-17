"""Temporary validation probe so the error contract is testable before any real POST exists.

Deleted in S2 once `GET /api/breaches` provides a real validated route.
"""

from fastapi import APIRouter
from pydantic import BaseModel

router = APIRouter()


class ProbeBody(BaseModel):
    count: int


class ProbeResponse(BaseModel):
    count: int


@router.post("/_probe/validation", response_model=ProbeResponse)
def post_probe(body: ProbeBody) -> ProbeResponse:
    return ProbeResponse(count=body.count)


@router.get("/_probe/crash")
def get_crash() -> None:
    msg = "probe: secret detail that must never reach the client"
    raise RuntimeError(msg)
