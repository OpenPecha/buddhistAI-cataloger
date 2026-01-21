from sqlalchemy import String, Text, Integer, Float, DateTime, ForeignKey, Index
from sqlalchemy.orm import Mapped, mapped_column, relationship
from datetime import datetime
import uuid
from core.database import Base


class OutlinerDocument(Base):
    """Stores the full text content and metadata for an outliner document"""
    __tablename__ = "outliner_documents"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    content: Mapped[str] = mapped_column(Text, nullable=False)  # Full text content
    filename: Mapped[str | None] = mapped_column(String, nullable=True)  # Original filename if uploaded
    user_id: Mapped[str | None] = mapped_column(String, ForeignKey("users.id"), nullable=True, index=True)
    
    order: Mapped[int] = mapped_column(Integer, nullable=True,default=0)
    category: Mapped[str | None] = mapped_column(String, nullable=True,default='uncategorized')
    
    # Progress tracking
    total_segments: Mapped[int] = mapped_column(Integer, default=0)  # Total number of segments
    annotated_segments: Mapped[int] = mapped_column(Integer, default=0)  # Segments with title/author
    progress_percentage: Mapped[float] = mapped_column(Float, default=0.0)  # 0-100
    
    # Timestamps
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    status: Mapped[str | None] = mapped_column(String, nullable=True) #  active ,completed, deleted ,approved ,rejected
    
    segments: Mapped[list["OutlinerSegment"]] = relationship(
        "OutlinerSegment",
        back_populates="document",
        cascade="all, delete-orphan",
        order_by="OutlinerSegment.segment_index"
    )

    def update_progress(self):
        """Recalculate progress based on annotated segments"""
        if self.total_segments > 0:
            self.progress_percentage = (self.annotated_segments / self.total_segments) * 100
        else:
            self.progress_percentage = 0.0
        self.updated_at = datetime.utcnow()


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
    
    # Annotations
    title: Mapped[str | None] = mapped_column(String, nullable=True)
    author: Mapped[str | None] = mapped_column(String, nullable=True)
    title_bdrc_id: Mapped[str | None] = mapped_column(String, nullable=True)
    author_bdrc_id: Mapped[str | None] = mapped_column(String, nullable=True)
    parent_segment_id: Mapped[str | None] = mapped_column(
        String,
        ForeignKey("outliner_segments.id", ondelete="SET NULL"),
        nullable=True
    )
    status: Mapped[str | None] = mapped_column(String, nullable=True) # checked, unchecked
    # Status tracking
    is_annotated: Mapped[bool] = mapped_column(default=False)  # Has title or author
    comment: Mapped[str | None] = mapped_column(String, nullable=True)
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

    def update_annotation_status(self):
        """Update is_annotated flag based on title/author presence"""
        self.is_annotated = bool(self.title or self.author)