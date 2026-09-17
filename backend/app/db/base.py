"""The declarative base every table model registers on; Alembic reads `Base.metadata`."""

from sqlalchemy.orm import DeclarativeBase


class Base(DeclarativeBase):
    pass
