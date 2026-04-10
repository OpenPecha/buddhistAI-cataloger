"""add rejection_reason to segment_rejections

Revision ID: c8f9a1b2d3e4
Revises: aa2cd2e55aff
Create Date: 2026-04-10

"""
from alembic import op
import sqlalchemy as sa


revision = "c8f9a1b2d3e4"
down_revision = "aa2cd2e55aff"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "segment_rejections",
        sa.Column("rejection_reason", sa.Text(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("segment_rejections", "rejection_reason")
