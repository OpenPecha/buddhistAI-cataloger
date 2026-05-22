"""add synced_to_bdrc on document

Revision ID: b7e4a1c9d2f0
Revises: 0a8df555c271
Create Date: 2026-05-22 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "b7e4a1c9d2f0"
down_revision: Union[str, Sequence[str], None] = "0a8df555c271"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "outliner_documents",
        sa.Column("synced_to_bdrc", sa.Boolean(), nullable=True, server_default=sa.false()),
    )


def downgrade() -> None:
    op.drop_column("outliner_documents", "synced_to_bdrc")
