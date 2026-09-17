"""Correlation id per request.

Reads `x-correlation-id` from the client or mints a `req_…` id, binds it to the structlog
context for the life of the request, echoes it on the response (including error responses,
which pass back through this middleware), and clears the context afterwards so nothing leaks
into the next request handled on the same worker.
"""

import time

import structlog
from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
from starlette.requests import Request
from starlette.responses import Response

from app.shared.ids import generate_unique_id

CORRELATION_ID_HEADER = "x-correlation-id"

log = structlog.get_logger()


class CorrelationIdMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next: RequestResponseEndpoint) -> Response:
        correlation_id = request.headers.get(CORRELATION_ID_HEADER) or generate_unique_id("req")
        structlog.contextvars.bind_contextvars(correlation_id=correlation_id)
        started_at = time.perf_counter()
        try:
            response = await call_next(request)
            response.headers[CORRELATION_ID_HEADER] = correlation_id
            log.info(
                "request: completed",
                method=request.method,
                path=request.url.path,
                status_code=response.status_code,
                duration_ms=round((time.perf_counter() - started_at) * 1_000, 1),
            )
            return response
        finally:
            structlog.contextvars.clear_contextvars()
