"""Correlation id per request.

Reads `x-correlation-id` from the client or mints a `req_…` id, binds it to the structlog
context for the life of the request, echoes it on the response, and clears the context
afterwards so nothing leaks into the next request handled on the same worker.

Handled errors (404, 400) pass back through here as responses. An *unhandled* exception would
otherwise be answered by Starlette's outermost ServerErrorMiddleware as plain text, outside this
middleware and outside CORS, so it is caught here: logged with the correlation id and the
traceback, and answered with the house `{ error }` shape carrying a generic message.
"""

import time

import structlog
from fastapi import status
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
from starlette.requests import Request
from starlette.responses import Response

from app.shared.ids import generate_unique_id

CORRELATION_ID_HEADER = "x-correlation-id"
INTERNAL_ERROR_MESSAGE = "internal error"

log = structlog.get_logger()


class CorrelationIdMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next: RequestResponseEndpoint) -> Response:
        correlation_id = request.headers.get(CORRELATION_ID_HEADER) or generate_unique_id("req")
        structlog.contextvars.bind_contextvars(correlation_id=correlation_id)
        started_at = time.perf_counter()
        try:
            response = await call_next(request)
        except Exception:
            log.exception(
                "request: failed",
                method=request.method,
                path=request.url.path,
                duration_ms=_elapsed_ms(started_at),
            )
            response = JSONResponse(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                content={"error": INTERNAL_ERROR_MESSAGE},
            )
        else:
            log.info(
                "request: completed",
                method=request.method,
                path=request.url.path,
                status_code=response.status_code,
                duration_ms=_elapsed_ms(started_at),
            )
        finally:
            structlog.contextvars.clear_contextvars()
        response.headers[CORRELATION_ID_HEADER] = correlation_id
        return response


def _elapsed_ms(started_at: float) -> float:
    return round((time.perf_counter() - started_at) * 1_000, 1)
