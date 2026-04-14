"""add reviewed_by_id and reviewed_at on outliner_segments

Revision ID: b3e8f1a2c4d0
Revises: 28d6360e19ce
Create Date: 2026-04-14

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "b3e8f1a2c4d0"
down_revision: Union[str, Sequence[str], None] = "28d6360e19ce"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "outliner_segments",
        sa.Column("reviewed_by_id", sa.String(), nullable=True),
    )
    op.add_column(
        "outliner_segments",
        sa.Column("reviewed_at", sa.DateTime(), nullable=True),
    )
    op.create_foreign_key(
        "fk_outliner_segments_reviewed_by_id_users",
        "outliner_segments",
        "users",
        ["reviewed_by_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_index(
        "ix_outliner_segments_reviewed_by_id",
        "outliner_segments",
        ["reviewed_by_id"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index("ix_outliner_segments_reviewed_by_id", table_name="outliner_segments")
    op.drop_constraint(
        "fk_outliner_segments_reviewed_by_id_users",
        "outliner_segments",
        type_="foreignkey",
    )
    op.drop_column("outliner_segments", "reviewed_at")
    op.drop_column("outliner_segments", "reviewed_by_id")
