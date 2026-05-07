"""add active batch

Revision ID: 709744fc4e49
Revises: e661979c6628
Create Date: 2026-05-07 10:46:17.820171

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '709744fc4e49'
down_revision: Union[str, Sequence[str], None] = 'e661979c6628'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table(
        "active_batch",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("batch_id", sa.Integer(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("batch_id", name="uq_active_batch_batch_id"),
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_table("active_batch")
