"""Engine and session factory, built once in the composition root and closed over."""

from sqlalchemy import Engine, create_engine
from sqlalchemy.orm import Session, sessionmaker


def build_engine(*, database_url: str) -> Engine:
    return create_engine(database_url, pool_pre_ping=True)


def build_session_factory(engine: Engine) -> sessionmaker[Session]:
    return sessionmaker(bind=engine, expire_on_commit=False)
