"""add segment reviews table

Revision ID: d2f3a4b5c6e7
Revises: c1a2b3d4e5f7
Create Date: 2026-06-03 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'd2f3a4b5c6e7'
down_revision: Union[str, Sequence[str], None] = 'c1a2b3d4e5f7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'segment_reviews',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('document_id', sa.String(), nullable=False),
        sa.Column('segment_id', sa.String(), nullable=False),
        sa.Column('user_id', sa.String(), nullable=False),
        sa.Column('status', sa.String(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['document_id'], ['outliner_documents.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['segment_id'], ['outliner_segments.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.UniqueConstraint('user_id', 'segment_id', name='uq_segment_reviews_user_segment'),
    )
    op.create_index('ix_segment_reviews_document_id', 'segment_reviews', ['document_id'])
    op.create_index('ix_segment_reviews_segment_id', 'segment_reviews', ['segment_id'])
    op.create_index('ix_segment_reviews_user_id', 'segment_reviews', ['user_id'])


def downgrade() -> None:
    op.drop_index('ix_segment_reviews_user_id', table_name='segment_reviews')
    op.drop_index('ix_segment_reviews_segment_id', table_name='segment_reviews')
    op.drop_index('ix_segment_reviews_document_id', table_name='segment_reviews')
    op.drop_table('segment_reviews')
