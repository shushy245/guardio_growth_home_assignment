"""Request-scoped database session.

One transaction per request: committed when the handler returns, rolled back when it raises.
Handlers and repositories never call `commit()` themselves, which keeps "single write per flow"
visible at the handler level. Tests override this dependency with a session bound to a
rolled-back transaction.
"""

from collections.abc import Iterator

from fastapi import Request
from sqlalchemy.orm import Session, sessionmaker


def get_session(request: Request) -> Iterator[Session]:
    session_factory: sessionmaker[Session] = request.app.state.session_factory
    with session_factory.begin() as session:
        yield session
