"""Pydantic models for legacy ``/outliner/*`` routes."""

from datetime import datetime
from typing import Dict, List, Optional

from pydantic import BaseModel, ConfigDict, Field, model_serializer


class SegmentRejectionReviewer(BaseModel):
    """Latest reviewer for a rejected segment (document + segment APIs)."""

    user_id: str
    picture: Optional[str] = None
    name: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)

    @model_serializer(mode="wrap")
    def _serialize_omit_nulls(self, serializer):
        data = serializer(self)
        if not isinstance(data, dict):
            return data
        return {k: v for k, v in data.items() if v is not None}


class SegmentRejectionSummary(BaseModel):
    """Bundled rejection fields for segment payloads (avoid flat rejection_* keys)."""

    count: int = 0
    reason: Optional[str] = None
    reviewer: Optional[SegmentRejectionReviewer] = None
    resolved: Optional[bool] = None

    model_config = ConfigDict(from_attributes=True)

    @model_serializer(mode="wrap")
    def _serialize_omit_nulls(self, serializer):
        data = serializer(self)
        if not isinstance(data, dict):
            return data
        return {k: v for k, v in data.items() if v is not None}


class SegmentCreate(BaseModel):
    text: Optional[str] = None  # Optional - will be extracted from document if not provided
    segment_index: int
    span_start: int
    span_end: int
    title: Optional[str] = None
    author: Optional[str] = None
    title_bdrc_id: Optional[str] = None
    author_bdrc_id: Optional[str] = None
    parent_segment_id: Optional[str] = None


class CommentAdd(BaseModel):
    content: str
    username: str


class CommentUpdate(BaseModel):
    content: str


class CommentResponse(BaseModel):
    content: str
    username: str
    timestamp: str


class CommentsResponse(BaseModel):
    comments: List[CommentResponse]


class SegmentUpdate(BaseModel):
    text: Optional[str] = None
    title: Optional[str] = None
    author: Optional[str] = None
    title_bdrc_id: Optional[str] = None
    author_bdrc_id: Optional[str] = None
    parent_segment_id: Optional[str] = None
    is_attached: Optional[bool] = None
    status: Optional[str] = None  # checked, unchecked
    label: Optional[str] = None  # FRONT_MATTER, TOC, TEXT, BACK_MATTER
    comment: Optional[str] = None  # Deprecated: kept for backward compatibility
    comment_content: Optional[str] = None  # New comment content to append
    comment_username: Optional[str] = None  # Username for new comment
    is_supplied_title: Optional[bool] = None  # Title supplied by annotator (not from source)
    title_span_start: Optional[int] = None
    title_span_end: Optional[int] = None
    updated_title: Optional[str] = None  # Annotator text when it differs from source span text
    author_span_start: Optional[int] = None
    author_span_end: Optional[int] = None
    updated_author: Optional[str] = None
    reviewer_title: Optional[str] = None
    reviewer_author: Optional[str] = None


class SegmentResponse(BaseModel):
    id: str
    text: Optional[str] = None  # Omitted in JSON; derive from document.content + spans
    segment_index: int
    span_start: int
    span_end: int
    title: Optional[str] = None
    author: Optional[str] = None
    title_span_start: Optional[int] = None
    title_span_end: Optional[int] = None
    updated_title: Optional[str] = None
    author_span_start: Optional[int] = None
    author_span_end: Optional[int] = None
    updated_author: Optional[str] = None
    reviewer_title: Optional[str] = None
    reviewer_author: Optional[str] = None
    title_bdrc_id: Optional[str] = None
    author_bdrc_id: Optional[str] = None
    parent_segment_id: Optional[str] = None
    is_annotated: bool
    is_attached: Optional[bool] = None
    status: Optional[str] = None
    label: Optional[str] = None  # FRONT_MATTER, TOC, TEXT, BACK_MATTER
    rejection: Optional[SegmentRejectionSummary] = None
    is_supplied_title: Optional[bool] = None
    comments: Optional[List[CommentResponse]] = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)

    @model_serializer(mode="wrap")
    def _serialize_omit_empty_text(self, serializer):
        data = serializer(self)
        if isinstance(data, dict) and data.get("text") is None:
            data.pop("text", None)
        return data


class RejectSegmentRequest(BaseModel):
    comment: str = Field(..., min_length=1, description="Required explanation for the annotator")


class BulkRejectRequest(BaseModel):
    segment_ids: List[str]
    comment: str = Field(
        ...,
        min_length=1,
        description="Required explanation for the annotator (applied to each segment)",
    )


class DocumentCreate(BaseModel):
    content: str
    filename: Optional[str] = None


class SegmentResponseDocument(BaseModel):
    id: str
    text: Optional[str] = None  # Omitted in JSON; derive from document.content + spans
    segment_index: int
    span_start: int
    span_end: int
    title: Optional[str] = None
    author: Optional[str] = None
    title_span_start: Optional[int] = None
    title_span_end: Optional[int] = None
    updated_title: Optional[str] = None
    author_span_start: Optional[int] = None
    author_span_end: Optional[int] = None
    updated_author: Optional[str] = None
    reviewer_title: Optional[str] = None
    reviewer_author: Optional[str] = None
    title_bdrc_id: Optional[str] = None
    author_bdrc_id: Optional[str] = None
    parent_segment_id: Optional[str] = None
    is_annotated: bool
    is_attached: Optional[bool] = None
    status: Optional[str] = None  # checked, unchecked
    label: Optional[str] = None  # FRONT_MATTER, TOC, TEXT, BACK_MATTER
    is_supplied_title: Optional[bool] = None  # Title supplied by annotator (not from source)
    # Set in enrich_segment_list_rejection_fields
    rejection: Optional[SegmentRejectionSummary] = None

    model_config = ConfigDict(from_attributes=True)

    @model_serializer(mode="wrap")
    def _serialize_omit_nulls(self, serializer):
        data = serializer(self)
        if not isinstance(data, dict):
            return data
        return {k: v for k, v in data.items() if v is not None}


class DocumentResponse(BaseModel):
    id: str
    content: str = ""
    filename: Optional[str] = None
    user_id: Optional[str] = None
    status: Optional[str] = None  # active, completed, deleted, approved, rejected
    is_supplied_title: Optional[bool] = None
    submit_count: Optional[int] = None  # admin review submits (POST .../approve)
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    segments: List[SegmentResponseDocument] = []

    model_config = ConfigDict(from_attributes=True)


class DocumentWorkspaceResponse(BaseModel):
    """Annotator workspace: id, filename, status, full text, segments only (smaller than DocumentResponse)."""

    id: str
    content: str = ""
    filename: Optional[str] = None
    status: Optional[str] = None
    segments: List[SegmentResponseDocument] = []

    model_config = ConfigDict(from_attributes=True)


class AiTocEntryItem(BaseModel):
    page_no: int
    title: str


class AiTocEntriesResponse(BaseModel):
    entries: List[AiTocEntryItem] = []


class RejectedSegmentReviewerUser(BaseModel):
    name: Optional[str] = None
    picture: Optional[str] = None


class RejectedSegmentListNotice(BaseModel):
    """Latest rejection on any segment in the document (for annotator list notices)."""

    message: str = ""
    document_id: str
    segment_id: str
    reviewer_user: Optional[RejectedSegmentReviewerUser] = None


class DocumentListResponse(BaseModel):
    id: str
    filename: Optional[str] = None
    user_id: Optional[str] = None
    total_segments: int
    annotated_segments: int
    rejection_count: int = 0  # Segments with status rejected in this document
    progress_percentage: float
    checked_segments: int  # Segments with status checked or approved
    unchecked_segments: int  # Segments not yet checked or approved
    status: Optional[str] = None  # active, completed, deleted, approved, rejected
    created_at: datetime
    updated_at: datetime
    rejected_segment: Optional[RejectedSegmentListNotice] = None

    class Config:
        from_attributes = True


class BulkSegmentUpdate(BaseModel):
    segments: List[SegmentUpdate] = Field(..., description="List of segment updates with segment IDs")
    segment_ids: List[str] = Field(..., description="Corresponding segment IDs for each update")


class SplitSegmentRequest(BaseModel):
    segment_id: str
    split_position: int  # Character offset within segment text
    document_id: Optional[str] = None  # Optional: used when segment doesn't exist yet


class MergeSegmentsRequest(BaseModel):
    segment_ids: List[str] = Field(..., min_items=2, description="IDs of segments to merge (in order)")


class BulkSegmentOperationsRequest(BaseModel):
    """Request model for bulk segment operations"""

    create: Optional[List[SegmentCreate]] = Field(None, description="Segments to create")
    update: Optional[List[dict]] = Field(None, description="List of dicts with 'id' and update fields")
    delete: Optional[List[str]] = Field(None, description="Segment IDs to delete")


class DocumentStatusUpdate(BaseModel):
    status: str


class SegmentStatusUpdate(BaseModel):
    status: str


class AnnotatorPerformanceRow(BaseModel):
    user_id: Optional[str] = None
    document_count: int
    segment_count: int
    segments_with_title_or_author: int
    rejection_count: int = Field(
        ...,
        description="Segments still rejected with latest rejection unresolved (annotator has not addressed)",
    )
    segments_reviewed: int = Field(
        0,
        description="Segments currently checked/approved where this user is recorded as reviewer",
    )
    segments_self_reviewed: int = Field(
        0,
        description="Subset of segments_reviewed on documents owned by the same user (annotator checked own work)",
    )
    reviewer_rejection_count: int = Field(
        0,
        description="Rejection events logged with this user as reviewer",
    )
    segments_reviewer_corrected_title_or_author: int = Field(
        0,
        description=(
            "Approved segments on this user's documents where reviewer set title or author at approval"
        ),
    )


class DashboardStatsResponse(BaseModel):
    document_count: int
    total_segments: int
    segments_with_title_or_author: int
    reviewed_segments: int = Field(
        ...,
        description="Among segments with non-empty title or author: status approved",
    )
    annotated_segments: int = Field(
        ...,
        description="Among segments with non-empty title or author: status checked (annotated, awaiting review)",
    )
    rejected_segments_with_title_or_author: int = Field(
        ...,
        description="Among segments with non-empty title or author: status rejected",
    )
    unchecked_segments_with_title_or_author: int = Field(
        ...,
        description="Among segments with non-empty title or author: status unchecked or null",
    )
    annotating_segments: int = Field(
        ...,
        description="All segments with status unchecked or null (not limited to title/author)",
    )
    rejection_count: int = Field(
        ...,
        description="Same as annotator chart: rejected segments whose latest rejection row is not resolved",
    )

   
    document_status_counts: Dict[str, int]
    document_category_counts: Dict[str, int]
    segment_status_counts: Dict[str, int]
    segment_label_counts: Dict[str, int]
    segments_with_bdrc_id: int
    segments_with_parent: int
    segments_with_comments: int = Field(
        ...,
        description="Rejected segments that have comment data stored",
    )
    segments_reviewer_corrected_title_or_author: int = Field(
        ...,
        description="Approved segments where reviewer changed title or author vs snapshot at check time",
    )
    segments_recorded_as_reviewer: Optional[int] = Field(
        None,
        description=(
            "Set only when user_id is set and that user has role reviewer or admin: count of "
            "checked/approved segments with reviewed_by_id equal to that user, scoped to documents "
            "in the date range (all annotators, not owner-scoped). Null otherwise."
        ),
    )
    annotation_coverage_pct: float
    annotator_performance: List[AnnotatorPerformanceRow]
