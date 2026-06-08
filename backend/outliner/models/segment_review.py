"""ORM model for segment_reviews (view-only reviewer spot-check decisions)."""
from __future__ import annotations

from datetime import datetime
import uuid

from sqlalchemy import DateTime, ForeignKey, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from core.database import Base


class SegmentReview(Base):
    """A reviewer's current approve/reject decision on a segment from the view-only page.

    One row per (user_id, segment_id); re-deciding updates ``status`` and ``updated_at``.
    Independent of the annotation pipeline status on ``outliner_segments``.
    """

    __tablename__ = "segment_reviews"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    document_id: Mapped[str] = mapped_column(
        String,
        ForeignKey("outliner_documents.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    segment_id: Mapped[str] = mapped_column(
        String,
        ForeignKey("outliner_segments.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    user_id: Mapped[str] = mapped_column(
        String,
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    status: Mapped[str] = mapped_column(String, nullable=False)
    comment: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow
    )

    __table_args__ = (
        UniqueConstraint("user_id", "segment_id", name="uq_segment_reviews_user_segment"),
    )
