"""ORM model for segment_rejections."""
from __future__ import annotations

from datetime import datetime
import uuid

from sqlalchemy import Boolean, DateTime, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from core.database import Base
from user.models.user import User


class SegmentRejection(Base):
    """Records each rejection event for annotator quality tracking."""

    __tablename__ = "segment_rejections"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    segment_id: Mapped[str] = mapped_column(
        String,
        ForeignKey("outliner_segments.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    user_id: Mapped[str | None] = mapped_column(
        String,
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    reviewer_id: Mapped[str | None] = mapped_column(
        String,
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    rejection_reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    resolved: Mapped[bool] = mapped_column(Boolean, default=False, nullable=True)
    segment: Mapped["OutlinerSegment"] = relationship("OutlinerSegment", back_populates="rejections")
    reviewer: Mapped[User | None] = relationship(
        User,
        foreign_keys=[reviewer_id],
    )
