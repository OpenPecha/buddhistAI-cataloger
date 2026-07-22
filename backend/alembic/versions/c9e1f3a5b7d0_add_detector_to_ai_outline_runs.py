"""add detector to outliner_ai_outline_runs

Revision ID: c9e1f3a5b7d0
Revises: b7d9e1f2a3c4
Create Date: 2026-07-22 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "c9e1f3a5b7d0"
down_revision: Union[str, Sequence[str], None] = "b7d9e1f2a3c4"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "outliner_ai_outline_runs",
        sa.Column(
            "detector",
            sa.String(),
            nullable=False,
            server_default="rule",
        ),
    )


def downgrade() -> None:
    op.drop_column("outliner_ai_outline_runs", "detector")
