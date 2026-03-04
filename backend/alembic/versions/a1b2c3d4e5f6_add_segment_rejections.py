"""add segment rejections table

Revision ID: a1b2c3d4e5f6
Revises: 8c3767f8dd81
Create Date: 2026-03-04 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a1b2c3d4e5f6'
down_revision: Union[str, Sequence[str], None] = '8c3767f8dd81'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'segment_rejections',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('segment_id', sa.String(), nullable=False),
        sa.Column('user_id', sa.String(), nullable=True),
        sa.Column('reviewer_id', sa.String(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['segment_id'], ['outliner_segments.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['reviewer_id'], ['users.id'], ondelete='SET NULL'),
    )
    op.create_index('ix_segment_rejections_segment_id', 'segment_rejections', ['segment_id'])
    op.create_index('ix_segment_rejections_user_id', 'segment_rejections', ['user_id'])


def downgrade() -> None:
    op.drop_index('ix_segment_rejections_user_id', table_name='segment_rejections')
    op.drop_index('ix_segment_rejections_segment_id', table_name='segment_rejections')
    op.drop_table('segment_rejections')
