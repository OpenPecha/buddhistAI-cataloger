from enum import Enum as PyEnum
from typing import Any
from sqlalchemy import Boolean, String, Text, Integer, Float, DateTime, ForeignKey, Index, JSON, Enum
from sqlalchemy.orm import Mapped, mapped_column, relationship
from datetime import datetime
import uuid
from core.database import Base
from user.models.user import User


class SegmentStatus(str, PyEnum):
    UNCHECKED = "unchecked"
    CHECKED = "checked"
    APPROVED = "approved"
    REJECTED = "rejected"

class SegmentLabels(str, PyEnum):
    FRONT_MATTER = "front matter"
    TOC = "TOC"
    TEXT = "text"
    BACK_MATTER = "back matter"


SEGMENT_STATUS_TRANSITIONS = {
    SegmentStatus.UNCHECKED: {SegmentStatus.CHECKED},
    SegmentStatus.CHECKED: {SegmentStatus.APPROVED, SegmentStatus.REJECTED, SegmentStatus.UNCHECKED},
    SegmentStatus.REJECTED: {SegmentStatus.CHECKED},
    SegmentStatus.APPROVED: {SegmentStatus.UNCHECKED},
}



class OutlinerDocument(Base):
    """Stores the full text content and metadata for an outliner document"""
    __tablename__ = "outliner_documents"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    content: Mapped[str] = mapped_column(Text, nullable=False)  # Full text content
    filename: Mapped[str | None] = mapped_column(String, nullable=True)  # Original filename if uploaded
    user_id: Mapped[str | None] = mapped_column(String, ForeignKey("users.id"), nullable=True, index=True)
    
    order: Mapped[int] = mapped_column(Integer, nullable=True,default=0)
    category: Mapped[str | None] = mapped_column(String, nullable=True,default='uncategorized')
    
    # Timestamps
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    status: Mapped[str|None] = mapped_column(String, default="active",nullable=True) #  active ,completed, deleted ,approved ,rejected, skipped
    ai_toc_entries: Mapped[Any | None] = mapped_column(JSON, nullable=True)
    segments: Mapped[list["OutlinerSegment"]] = relationship(
        "OutlinerSegment",
        back_populates="document",
        cascade="all, delete-orphan",
        order_by="OutlinerSegment.segment_index"
    )

 


class OutlinerSegment(Base):
    """Stores individual segments with their annotations and metadata"""
    __tablename__ = "outliner_segments"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    document_id: Mapped[str] = mapped_column(
        String,
        ForeignKey("outliner_documents.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )
    
    # Segment content and position
    text: Mapped[str] = mapped_column(Text, nullable=False)
    segment_index: Mapped[int] = mapped_column(Integer, nullable=False)  # Order in document
    span_start: Mapped[int] = mapped_column(Integer, nullable=False)  # Character position in full text
    span_end: Mapped[int] = mapped_column(Integer, nullable=False)  # Character position in full text
    label: Mapped[SegmentLabels | None] = mapped_column(Enum(SegmentLabels), nullable=True)
    # Annotations
    title: Mapped[str | None] = mapped_column(String, nullable=True)
    title_span_start: Mapped[int] = mapped_column(Integer, nullable=True)
    title_span_end: Mapped[int] = mapped_column(Integer, nullable=True)
    updated_title: Mapped[str | None] = mapped_column(String, nullable=True)
    is_supplied_title: Mapped[bool] = mapped_column(Boolean, default=False, nullable=True)
    author: Mapped[str | None] = mapped_column(String, nullable=True)
    author_span_start: Mapped[int] = mapped_column(Integer, nullable=True)
    author_span_end: Mapped[int] = mapped_column(Integer, nullable=True)
    updated_author: Mapped[str | None] = mapped_column(String, nullable=True)
    title_bdrc_id: Mapped[str | None] = mapped_column(String, nullable=True)
    author_bdrc_id: Mapped[str | None] = mapped_column(String, nullable=True)
    parent_segment_id: Mapped[str | None] = mapped_column(
        String,
        ForeignKey("outliner_segments.id", ondelete="SET NULL"),
        nullable=True
    )
    status: Mapped[str | None] = mapped_column(String, nullable=True) # checked, unchecked, approved, rejected
    reviewed_by_id: Mapped[str | None] = mapped_column(
        String,
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    reviewed_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    # Status tracking
    is_annotated: Mapped[bool] = mapped_column(default=False)  # Has title or author
    comment: Mapped[dict | list | None] = mapped_column(JSON, nullable=True)  # Can be array of comments or dict (for backward compatibility)
    # Timestamps
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    is_attached: Mapped[bool] = mapped_column(default=False, nullable=True)  # Is attached to a parent segment
    # Relationships
    document: Mapped["OutlinerDocument"] = relationship("OutlinerDocument", back_populates="segments")
    parent_segment: Mapped["OutlinerSegment | None"] = relationship(
        "OutlinerSegment",
        remote_side=[id],
        backref="child_segments"
    )

    # Indexes for performance
    __table_args__ = (
        Index("ix_outliner_segments_document_index", "document_id", "segment_index"),
        Index("ix_outliner_segments_span", "document_id", "span_start", "span_end"),
    )

    rejections: Mapped[list["SegmentRejection"]] = relationship(
        "SegmentRejection",
        back_populates="segment",
        cascade="all, delete-orphan",
        order_by="SegmentRejection.created_at"
    )
    reviewed_by_user: Mapped[User | None] = relationship(
        User,
        foreign_keys=[reviewed_by_id],
    )

    def update_annotation_status(self):
        """Update is_annotated flag based on title/author presence"""
        self.is_annotated = bool(self.title or self.author)


class SegmentRejection(Base):
    """Records each rejection event for annotator quality tracking"""
    __tablename__ = "segment_rejections"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    segment_id: Mapped[str] = mapped_column(
        String,
        ForeignKey("outliner_segments.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )
    user_id: Mapped[str | None] = mapped_column(
        String,
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True
    )
    reviewer_id: Mapped[str | None] = mapped_column(
        String,
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    # Reviewer explanation shown to annotators (required on new rejections)
    rejection_reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    resolved: Mapped[bool] = mapped_column(Boolean, default=False, nullable=True)
    segment: Mapped["OutlinerSegment"] = relationship("OutlinerSegment", back_populates="rejections")
    # Annotator (document owner) vs reviewer — both FK to users; disambiguate with foreign_keys
    reviewer: Mapped[User | None] = relationship(
        User,
        foreign_keys=[reviewer_id],
    )