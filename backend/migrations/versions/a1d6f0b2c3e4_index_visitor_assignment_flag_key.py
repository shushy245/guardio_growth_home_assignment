"""index visitor_assignment.flag_key

Revision ID: a1d6f0b2c3e4
Revises: 4c4ba04b0c24
Create Date: 2026-09-20 01:40:00.000000

The experiment read filters `visitor_assignment` by `flag_key` on every dashboard load, and the
primary key `(visitor_id, flag_key)` cannot answer it: a composite index is usable only from its
leading column. Without this the read is a sequential scan of every assignment ever made, which
is fine at five thousand rows and is not the shape to leave behind — the S3 review predicted the
query before it existed and the full-codebase audit found it live.

Migrations are forward-only by house policy: `downgrade` stays empty and bad state is corrected
with a new forward revision, never a rollback.
"""

from collections.abc import Sequence

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "a1d6f0b2c3e4"
down_revision: str | Sequence[str] | None = "4c4ba04b0c24"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_index("ix_visitor_assignment_flag_key", "visitor_assignment", ["flag_key"])


def downgrade() -> None:
    """Forward-only: see the module docstring."""
