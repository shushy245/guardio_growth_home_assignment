"""Structured logging.

Every log line is a JSON object carrying whatever was bound to the request context (the
correlation id from the middleware, entity ids bound by handlers), so one grep on
`correlation_id` reconstructs a request across modules.
"""

import logging

import structlog

from app.config import LogFormat

_renderer_map: dict[LogFormat, structlog.typing.Processor] = {
    LogFormat.JSON: structlog.processors.JSONRenderer(),
    LogFormat.CONSOLE: structlog.dev.ConsoleRenderer(),
}


def configure_logging(*, log_format: LogFormat) -> None:
    structlog.configure(
        processors=[
            structlog.contextvars.merge_contextvars,
            structlog.processors.add_log_level,
            structlog.processors.TimeStamper(fmt="iso", utc=True),
            _renderer_map[log_format],
        ],
        wrapper_class=structlog.make_filtering_bound_logger(logging.INFO),
        cache_logger_on_first_use=False,
    )
