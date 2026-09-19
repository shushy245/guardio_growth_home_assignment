"""Request-scoped database session.

One transaction per request: committed when the handler returns, rolled back when it raises.
Handlers and repositories never call `commit()` themselves, which keeps "single write per flow"
visible at the handler level. Tests override this dependency with a session bound to a
rolled-back transaction.

**Committed before the response is sent.** FastAPI's default dependency scope runs a yield
dependency's exit code — here, the commit — after the response has gone out. A browser that
fires its next request the moment the first answers then reads before the write has landed:
the simulator created a visitor, got its 201, and was told on the next request that no such
visitor existed. `scope="function"` closes the transaction inside the handler's own exit
stack, before the response starts. Every handler takes the session through `SessionDep`, so
the scope is set once and cannot be forgotten at a call site.
"""

from collections.abc import Iterator
from typing import Annotated

from fastapi import Depends, Request
from sqlalchemy.orm import Session, sessionmaker


def get_session(request: Request) -> Iterator[Session]:
    session_factory: sessionmaker[Session] = request.app.state.session_factory
    with session_factory.begin() as session:
        yield session


SessionDep = Annotated[Session, Depends(get_session, scope="function")]
