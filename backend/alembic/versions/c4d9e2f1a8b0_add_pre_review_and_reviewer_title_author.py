"""add pre_review and reviewer title/author on outliner_segments

Revision ID: c4d9e2f1a8b0
Revises: b3e8f1a2c4d0
Create Date: 2026-04-14

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy import text


revision: str = "c4d9e2f1a8b0"
down_revision: Union[str, Sequence[str], None] = "b3e8f1a2c4d0"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "outliner_segments",
        sa.Column("pre_review_title", sa.String(), nullable=True),
    )
    op.add_column(
        "outliner_segments",
        sa.Column("pre_review_author", sa.String(), nullable=True),
    )
    op.add_column(
        "outliner_segments",
        sa.Column("reviewer_title", sa.String(), nullable=True),
    )
    op.add_column(
        "outliner_segments",
        sa.Column("reviewer_author", sa.String(), nullable=True),
    )

    bind = op.get_bind()
    bind.execute(
        text(
            "UPDATE outliner_segments SET pre_review_title = title, "
            "pre_review_author = author WHERE status = 'checked'"
        )
    )


def downgrade() -> None:
    op.drop_column("outliner_segments", "reviewer_author")
    op.drop_column("outliner_segments", "reviewer_title")
    op.drop_column("outliner_segments", "pre_review_author")
    op.drop_column("outliner_segments", "pre_review_title")
