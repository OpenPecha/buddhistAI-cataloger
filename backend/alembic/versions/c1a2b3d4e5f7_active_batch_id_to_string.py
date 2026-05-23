"""active_batch.batch_id as string

Revision ID: c1a2b3d4e5f7
Revises: b7e4a1c9d2f0
Create Date: 2026-05-23 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "c1a2b3d4e5f7"
down_revision: Union[str, Sequence[str], None] = "b7e4a1c9d2f0"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.alter_column(
        "active_batch",
        "batch_id",
        existing_type=sa.Integer(),
        type_=sa.String(),
        existing_nullable=False,
        postgresql_using="batch_id::text",
    )


def downgrade() -> None:
    op.alter_column(
        "active_batch",
        "batch_id",
        existing_type=sa.String(),
        type_=sa.Integer(),
        existing_nullable=False,
        postgresql_using="batch_id::integer",
    )
