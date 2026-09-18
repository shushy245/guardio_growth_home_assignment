"""House error contract: every non-2xx response is `{ "error": "<human-readable string>" }`.

FastAPI's defaults are `{ "detail": ... }` and 422 for validation failures; both are rewritten here
so clients, logs and monitoring see one shape and honest status codes.

An error response also keeps the request's deferred work. FastAPI attaches `BackgroundTasks`
only to a response the handler *returned*; when the handler raises, the tasks it scheduled are
dropped with it. A handler that has work which must outlive its own failure — the catalog
refresh that heals an empty table behind a 503 — registers it with `carry_background_tasks`, and
the `HTTPException` response runs it.
"""

from fastapi import BackgroundTasks, FastAPI, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

_CARRIED_BACKGROUND_TASKS = "carried_background_tasks"


def carry_background_tasks(*, request: Request, background_tasks: BackgroundTasks) -> None:
    """Make these tasks survive an `HTTPException` raised later in the same handler."""
    setattr(request.state, _CARRIED_BACKGROUND_TASKS, background_tasks)


def register_exception_handlers(app: FastAPI) -> None:
    @app.exception_handler(StarletteHTTPException)
    def _handle_http_exception(request: Request, exc: StarletteHTTPException) -> JSONResponse:
        response = _error_response(status_code=exc.status_code, message=str(exc.detail))
        response.background = _carried_background_tasks(request)

        return response

    @app.exception_handler(RequestValidationError)
    def _handle_validation_error(_request: Request, exc: RequestValidationError) -> JSONResponse:
        return _error_response(
            status_code=status.HTTP_400_BAD_REQUEST,
            message=format_validation_errors(exc),
        )


def format_validation_errors(exc: RequestValidationError) -> str:
    """`count: Input should be a valid integer; email: value is not a valid email address`."""
    parts = [
        f"{'.'.join(str(loc) for loc in error['loc'] if loc != 'body')}: {error['msg']}"
        for error in exc.errors()
    ]
    return "; ".join(parts)


def _carried_background_tasks(request: Request) -> BackgroundTasks | None:
    """`None` when the handler carried nothing — the common case, and Starlette's own default."""
    carried: BackgroundTasks | None = getattr(request.state, _CARRIED_BACKGROUND_TASKS, None)

    return carried


def _error_response(*, status_code: int, message: str) -> JSONResponse:
    return JSONResponse(status_code=status_code, content={"error": message})
