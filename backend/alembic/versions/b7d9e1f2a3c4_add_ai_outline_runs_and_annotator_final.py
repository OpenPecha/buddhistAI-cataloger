"""add outliner_ai_outline_runs table and annotator_ai_final_segments column

Revision ID: b7d9e1f2a3c4
Revises: e3a4b5c6d7f8
Create Date: 2026-06-12 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'b7d9e1f2a3c4'
down_revision: Union[str, Sequence[str], None] = 'e3a4b5c6d7f8'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'outliner_ai_outline_runs',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('document_id', sa.String(), nullable=False),
        sa.Column('segments', sa.JSON(), nullable=True),
        sa.Column('created_by_id', sa.String(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['document_id'], ['outliner_documents.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['created_by_id'], ['users.id'], ondelete='SET NULL'),
    )
    op.create_index(
        'ix_outliner_ai_outline_runs_document_id',
        'outliner_ai_outline_runs',
        ['document_id'],
    )
    op.add_column(
        'outliner_documents',
        sa.Column('annotator_ai_final_segments', sa.JSON(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column('outliner_documents', 'annotator_ai_final_segments')
    op.drop_index(
        'ix_outliner_ai_outline_runs_document_id',
        table_name='outliner_ai_outline_runs',
    )
    op.drop_table('outliner_ai_outline_runs')
