"""add label on each segment

Revision ID: da85dc04e187
Revises: a1b2c3d4e5f6
Create Date: 2026-03-10 13:18:44.351002

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'da85dc04e187'
down_revision: Union[str, Sequence[str], None] = 'a1b2c3d4e5f6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # PostgreSQL requires the ENUM type to exist before using it in a column.
    segmentlabels = sa.Enum('FRONT_MATTER', 'TOC', 'TEXT', 'BACK_MATTER', name='segmentlabels')
    segmentlabels.create(op.get_bind(), checkfirst=True)
    op.add_column('outliner_segments', sa.Column('label', segmentlabels, nullable=True))


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('outliner_segments', 'label')
    segmentlabels = sa.Enum('FRONT_MATTER', 'TOC', 'TEXT', 'BACK_MATTER', name='segmentlabels')
    segmentlabels.drop(op.get_bind(), checkfirst=True)
