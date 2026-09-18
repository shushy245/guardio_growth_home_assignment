"""seed the result_screen_tone flag

Revision ID: 9b3f1c2d4e5a
Revises: 75463482a98c
Create Date: 2026-09-18 17:50:00.000000

The one experiment the funnel ships with: two variants at 50/50, product-editable on `/admin`.
The urgent copy quotes the exposed-account total the summary endpoint actually reports (17.7B
at the time of seeding), not a rounded-up figure.

`ON CONFLICT DO NOTHING` so re-running against a database where product has already edited the
flag never resets their copy — a seed is a starting point, not a source of truth.

Migrations are forward-only by house policy: `downgrade` stays empty and bad state is corrected
with a new forward revision, never a rollback.
"""

import json
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "9b3f1c2d4e5a"
down_revision: str | Sequence[str] | None = "75463482a98c"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

RESULT_SCREEN_TONE_VARIANTS = [
    {
        "key": "calm",
        "weight": 50,
        "config": {
            "headline": "Known breaches",
            "subheadline": "Here's the public record of data breaches.",
            "ctaLabel": "Protect me",
            "tone": "calm",
        },
    },
    {
        "key": "urgent",
        "weight": 50,
        "config": {
            "headline": "You're exposed!",
            "subheadline": "17.7B accounts have leaked. Yours could be among them.",
            "ctaLabel": "Protect me now",
            "tone": "urgent",
        },
    },
]


def upgrade() -> None:
    op.execute(
        sa.text(
            "INSERT INTO feature_flag (key, description, is_enabled, variants) "
            "VALUES (:key, :description, :is_enabled, CAST(:variants AS jsonb)) "
            "ON CONFLICT (key) DO NOTHING"
        ).bindparams(
            key="result_screen_tone",
            description=(
                "Tone of the result screen: calm framing vs urgent framing of the same data."
            ),
            is_enabled=True,
            variants=json.dumps(RESULT_SCREEN_TONE_VARIANTS),
        )
    )


def downgrade() -> None:
    """Forward-only: see the module docstring."""
