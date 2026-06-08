"""add comment to segment_reviews

Revision ID: e3a4b5c6d7f8
Revises: d2f3a4b5c6e7
Create Date: 2026-06-08

"""
from alembic import op
import sqlalchemy as sa


revision = "e3a4b5c6d7f8"
down_revision = "d2f3a4b5c6e7"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "segment_reviews",
        sa.Column("comment", sa.Text(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("segment_reviews", "comment")
