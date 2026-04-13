"""Clear redundant outliner segment text (body = document.content[span_start:span_end)).

Revision ID: f8a1c2d3e4b5
Revises: 1c72bb1d87bb
Create Date: 2026-04-13

"""
from typing import Sequence, Union

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "f8a1c2d3e4b5"
down_revision: Union[str, None] = "1c72bb1d87bb"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("UPDATE outliner_segments SET text = ''")


def downgrade() -> None:
    # Cannot restore removed duplicate text
    pass
