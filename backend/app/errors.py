"""House error contract: every non-2xx response is `{ "error": "<human-readable string>" }`.

FastAPI's defaults are `{ "detail": ... }` and 422 for validation failures; both are rewritten here
so clients, logs and monitoring see one shape and honest status codes.
"""

from fastapi import FastAPI, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException


def register_exception_handlers(app: FastAPI) -> None:
    @app.exception_handler(StarletteHTTPException)
    def _handle_http_exception(_request: Request, exc: StarletteHTTPException) -> JSONResponse:
        return _error_response(status_code=exc.status_code, message=str(exc.detail))

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


def _error_response(*, status_code: int, message: str) -> JSONResponse:
    return JSONResponse(status_code=status_code, content={"error": message})
