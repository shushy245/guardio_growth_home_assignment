"""initial baseline

Revision ID: c1cc8cd4064e
Revises:
Create Date: 2026-09-17 22:46:31.947617

The empty first revision: it gives every later migration a `down_revision` to chain onto and
makes `alembic upgrade head` a real operation on a fresh database (it stamps `alembic_version`),
so the integration harness migrates rather than silently doing nothing.

Migrations are forward-only by house policy: `downgrade` stays empty and bad state is corrected
with a new forward revision, never a rollback.
"""

from collections.abc import Sequence

# revision identifiers, used by Alembic.
revision: str = "c1cc8cd4064e"
down_revision: str | Sequence[str] | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """No schema yet: S2 adds the first table."""


def downgrade() -> None:
    """Forward-only: see the module docstring."""
