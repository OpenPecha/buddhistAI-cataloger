"""
Legacy Outliner routes under ``/outliner/*``.

Prefer :mod:`outliner.routers.v1` at ``/api/v1/outliner/*`` (resource-first API).
These endpoints remain for backward compatibility during migration.
"""

from fastapi import APIRouter, HTTPException, Depends, UploadFile, File, Form, Query
from pydantic import BaseModel, ConfigDict, Field, model_serializer
from typing import Any, Dict, List, Optional, Tuple
from sqlalchemy.orm import Session
from datetime import datetime
from ai_text_outline import extract_toc_indices
from core.database import get_db
from outliner.controller.outliner import (
    create_document as create_document_ctrl,
    list_documents as list_documents_ctrl,
    get_document as get_document_ctrl,
    get_document_for_workspace as get_document_for_workspace_ctrl,
    update_document_content as update_document_content_ctrl,
    get_document_ai_toc_entries as get_document_ai_toc_entries_ctrl,
    ai_toc_db_value_to_api_items,
    delete_document as delete_document_ctrl,
    update_document_status as update_document_status_ctrl,
    get_document_progress as get_document_progress_ctrl,
    reset_segments as reset_segments_ctrl,
    create_segment as create_segment_ctrl,
    create_segments_bulk as create_segments_bulk_ctrl,
    replace_document_segments_and_ai_toc as replace_document_segments_and_ai_toc_ctrl,
    list_segments as list_segments_ctrl,
    get_segment as get_segment_ctrl,
    update_segment as update_segment_ctrl,
    update_segments_bulk as update_segments_bulk_ctrl,
    split_segment as split_segment_ctrl,
    merge_segments as merge_segments_ctrl,
    delete_segment as delete_segment_ctrl,
    update_segment_status as update_segment_status_ctrl,
    bulk_segment_operations as bulk_segment_operations_ctrl,
    get_segment_comments as get_segment_comments_ctrl,
    add_segment_comment as add_segment_comment_ctrl,
    update_segment_comment as update_segment_comment_ctrl,
    delete_segment_comment as delete_segment_comment_ctrl,
    assign_volume as assign_volume_ctrl,
    approve_document as approve_document_ctrl,
    submit_document_to_bdrc_in_review as submit_document_to_bdrc_in_review_ctrl,
    reject_segment as reject_segment_ctrl,
    reject_segments_bulk as reject_segments_bulk_ctrl,
    get_segment_rejection_count as get_segment_rejection_count_ctrl,
    latest_rejection_reason_for_orm_segment as latest_rejection_reason_for_orm_segment_ctrl,
    latest_rejection_reviewer_for_orm_segment as latest_rejection_reviewer_for_orm_segment_ctrl,
    latest_rejection_resolved_for_orm_segment as latest_rejection_resolved_for_orm_segment_ctrl,
    get_dashboard_stats as get_dashboard_stats_ctrl,
)
from outliner.utils.outliner_utils import get_comments_list, segment_body_from_document

router = APIRouter()

# ==================== Pydantic Schemas ====================


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
    reviewer_id: Optional[str] = None
    comment: str = Field(..., min_length=1, description="Required explanation for the annotator (applied to each segment)")


class DocumentCreate(BaseModel):
    content: str
    filename: Optional[str] = None
    user_id: Optional[str] = None

class SegmentResponseDocument(BaseModel):
    id: str
    text: Optional[str] = None  # Omitted in JSON; derive from document.content + spans
    segment_index: int
    span_start: int
    span_end: int
    title: Optional[str] 
    author: Optional[str] 
    title_span_start: Optional[int] = None
    title_span_end: Optional[int] = None
    updated_title: Optional[str] = None
    author_span_start: Optional[int] = None
    author_span_end: Optional[int] = None
    updated_author: Optional[str] = None
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


def _segment_list_row_to_document_segment(row: dict) -> SegmentResponseDocument:
    """Build document segment payload; validates nested `rejection` when present."""
    return SegmentResponseDocument.model_validate(row)

class DocumentResponse(BaseModel):
    id: str
    content: str = ""
    filename: Optional[str] = None
    user_id: Optional[str] = None
    status: Optional[str] = None  # active, completed, deleted, approved, rejected
    is_supplied_title: Optional[bool] = None
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


# ==================== Helper Functions ====================

def _spans_from_toc_indices(content: str, indices: Optional[List]) -> List[Tuple[int, int]]:
    """Turn character offsets from extract_toc_indices into non-overlapping [start, end) spans."""
    n = len(content)
    starts: List[int] = []
    for i in indices or []:
        try:
            s = int(i)
        except (TypeError, ValueError):
            continue
        if 0 <= s <= n:
            starts.append(s)
    split_points = sorted(set([0] + [s for s in starts if s > 0]))
    spans: List[Tuple[int, int]] = []
    for idx, start in enumerate(split_points):
        end = split_points[idx + 1] if idx + 1 < len(split_points) else n
        if start < end:
            spans.append((start, end))
    return spans if spans else [(0, n)]


def _build_segment_response(
    segment,
    db: Session = None,
    *,
    document_content: Optional[str] = None,
) -> SegmentResponse:
    """Helper to build SegmentResponse from segment model.

    When ``document_content`` is set (e.g. list segments without full document payload),
    ``text`` is filled from spans for backward compatibility. Otherwise ``text`` is omitted.
    """
    comments_list = get_comments_list(segment)
    
    rejection_count = 0
    if hasattr(segment, 'rejections') and segment.rejections is not None:
        rejection_count = len(segment.rejections)
    elif db is not None:
        rejection_count = get_segment_rejection_count_ctrl(db, segment.id)
    
    label_value = segment.label.name if segment.label is not None else None
    rejection_reason = latest_rejection_reason_for_orm_segment_ctrl(db, segment)
    rr = latest_rejection_reviewer_for_orm_segment_ctrl(db, segment)
    rr_clean: Optional[Dict[str, Any]] = None
    if rr:
        rr_clean = dict(rr)
        if rr_clean.get("picture") is not None:
            rr_clean["picture"] = str(rr_clean["picture"]).strip() or None
    rejection: Optional[SegmentRejectionSummary] = None
    if rejection_count > 0 or segment.status == "rejected":
        rev = None
        if segment.status == "rejected" and rr_clean and rr_clean.get("id"):
            rev = SegmentRejectionReviewer(
                user_id=rr_clean["id"],
                picture=rr_clean.get("picture"),
                name=rr_clean.get("name"),
            )
        resolved_flag = (
            latest_rejection_resolved_for_orm_segment_ctrl(db, segment)
            if db is not None
            else None
        )
        rejection = SegmentRejectionSummary(
            count=rejection_count,
            reason=rejection_reason if segment.status == "rejected" else None,
            reviewer=rev,
            resolved=resolved_flag,
        )
    resolved_text: Optional[str] = None
    if document_content is not None:
        resolved_text = segment_body_from_document(
            document_content, segment.span_start, segment.span_end
        )

    return SegmentResponse(
        id=segment.id,
        text=resolved_text,
        segment_index=segment.segment_index,
        span_start=segment.span_start,
        span_end=segment.span_end,
        title=segment.title,
        author=segment.author,
        title_span_start=segment.title_span_start,
        title_span_end=segment.title_span_end,
        updated_title=segment.updated_title,
        author_span_start=segment.author_span_start,
        author_span_end=segment.author_span_end,
        updated_author=segment.updated_author,
        title_bdrc_id=segment.title_bdrc_id,
        author_bdrc_id=segment.author_bdrc_id,
        parent_segment_id=segment.parent_segment_id,
        is_annotated=segment.is_annotated,
        is_attached=segment.is_attached,
        status=segment.status,
        label=label_value,
        rejection=rejection,
        is_supplied_title=segment.is_supplied_title,
        comments=[CommentResponse(**c) for c in comments_list] if comments_list else None,
        created_at=segment.created_at,
        updated_at=segment.updated_at
    )


def _document_plain_content(db: Session, document_id: str) -> str:
    """Full document text for resolving segment bodies on segment-only responses."""
    doc = get_document_ctrl(db, document_id, include_segments=False)
    return doc.content or ""


# ==================== Document Endpoints ====================

@router.post("/documents", response_model=DocumentResponse, status_code=201)
async def create_document(
    document: DocumentCreate,
    db: Session = Depends(get_db)
):
    """Create a new outliner document with full text content"""
    db_document = create_document_ctrl(
        db=db,
        content=document.content,
        filename=document.filename,
        user_id=document.user_id
    )
    return db_document



@router.get("/documents", response_model=List[DocumentListResponse])
async def list_documents(
    user_id: Optional[str] = None,
    status: Optional[str] = None,
    title: Optional[str] = Query(
        None,
        description="Case-insensitive partial match on document title (filename)",
    ),
    skip: int = 0,
    limit: int = 100,
    include_deleted: bool = False,
    db: Session = Depends(get_db)
):
    """
    List all outliner documents, optionally filtered by user, status, title search, and deletion status.

    Each item may include `rejected_segment`: the most recent segment rejection in that document
    (message, document_id, segment_id, reviewer_user) for annotator-facing notices.

    Args:
        user_id: Filter documents by user ID (annotator)
        status: Filter by document status (active, completed, approved)
        title: Search string matched against document filename (display title in list views)
        skip: Number of documents to skip (pagination)
        limit: Maximum number of documents to return
        include_deleted: If False (default), exclude deleted documents. If True, include all documents.
    """
    result = list_documents_ctrl(
        db=db,
        user_id=user_id,
        status=status,
        skip=skip,
        limit=limit,
        include_deleted=include_deleted,
        title=title,
    )
    return result


@router.get("/documents/{document_id}", response_model=DocumentResponse)
async def get_document(
    document_id: str,
    include_segments: bool = True,
    db: Session = Depends(get_db),
):
    """Get a document by ID with all its segments (full metadata)."""
    document = get_document_ctrl(db, document_id, include_segments)

    # If segments are requested but none exist, create a single segment covering the entire document
    if include_segments:
        segments_exist = (
            hasattr(document, "segment_list")
            and document.segment_list
            and len(document.segment_list) > 0
        )
        if not segments_exist:
            text_length = len(document.content)
            create_segment_ctrl(
                db=db,
                document_id=document_id,
                segment_index=0,
                span_start=0,
                span_end=text_length,
                text=None,
            )
            document = get_document_ctrl(db, document_id, include_segments)

    if include_segments and hasattr(document, "segment_list") and document.segment_list:
        segments_resp = [
            _segment_list_row_to_document_segment(s) for s in document.segment_list
        ]
        return DocumentResponse(
            id=document.id,
            content=document.content,
            filename=document.filename,
            user_id=document.user_id,
            status=getattr(document, "status", None),
            created_at=document.created_at,
            updated_at=document.updated_at,
            is_supplied_title=getattr(document, "is_supplied_title", None),
            segments=segments_resp,
        )
    return DocumentResponse(
        id=document.id,
        content=document.content,
        filename=document.filename,
        user_id=document.user_id,
        status=getattr(document, "status", None),
        created_at=document.created_at,
        updated_at=document.updated_at,
        is_supplied_title=getattr(document, "is_supplied_title", None),
        segments=[],
    )


@router.get(
    "/documents/{document_id}/workspace",
    response_model=DocumentWorkspaceResponse,
)
async def get_document_workspace(
    document_id: str,
    include_segments: bool = True,
    db: Session = Depends(get_db),
):
    """
    Annotator workspace: id, filename, status, full text, and segments only.
    Content is served from Redis when cached; otherwise one read of the content column.
    Segments are read only from outliner_segments for this document.
    """
    document = get_document_for_workspace_ctrl(db, document_id, include_segments)

    if include_segments:
        segments_exist = (
            hasattr(document, "segment_list")
            and document.segment_list
            and len(document.segment_list) > 0
        )
        if not segments_exist:
            text_length = len(document.content)
            create_segment_ctrl(
                db=db,
                document_id=document_id,
                segment_index=0,
                span_start=0,
                span_end=text_length,
                text=None,
            )
            document = get_document_for_workspace_ctrl(db, document_id, include_segments)

    if include_segments and hasattr(document, "segment_list") and document.segment_list:
        segments_resp = [
            _segment_list_row_to_document_segment(s) for s in document.segment_list
        ]
        return DocumentWorkspaceResponse(
            id=document.id,
            content=document.content,
            filename=document.filename,
            status=getattr(document, "status", None),
            segments=segments_resp,
        )
    return DocumentWorkspaceResponse(
        id=document.id,
        content=document.content,
        filename=document.filename,
        status=getattr(document, "status", None),
        segments=[],
    )


@router.get(
    "/documents/{document_id}/ai-toc-entries",
    response_model=AiTocEntriesResponse,
)
async def get_document_ai_toc_entries(
    document_id: str,
    db: Session = Depends(get_db),
):
    """Return AI / stored TOC as page numbers and titles (not included on the main document payload)."""
    raw = get_document_ai_toc_entries_ctrl(db, document_id)
    items = ai_toc_db_value_to_api_items(raw)
    return AiTocEntriesResponse(entries=[AiTocEntryItem(**row) for row in items])


@router.put("/documents/{document_id}/content")
async def update_document_content(
    document_id: str,
    content: str,
    db: Session = Depends(get_db)
):
    """Update the full text content of a document"""
    return update_document_content_ctrl(db, document_id, content)


@router.delete("/documents/{document_id}", status_code=204)
async def delete_document(
    document_id: str,
    db: Session = Depends(get_db)
):
    """Delete a document and all its segments"""
    delete_document_ctrl(db, document_id)
    return None


# ==================== Segment Endpoints ====================

@router.post("/documents/{document_id}/segments", response_model=SegmentResponse, status_code=201)
async def create_segment(
    document_id: str,
    segment: SegmentCreate,
    db: Session = Depends(get_db)
):
    """Create a new segment in a document"""
    db_segment = create_segment_ctrl(
        db=db,
        document_id=document_id,
        segment_index=segment.segment_index,
        span_start=segment.span_start,
        span_end=segment.span_end,
        text=segment.text,
        title=segment.title,
        author=segment.author,
        title_bdrc_id=segment.title_bdrc_id,
        author_bdrc_id=segment.author_bdrc_id,
        parent_segment_id=segment.parent_segment_id
    )
    return _build_segment_response(
        db_segment,
        db,
        document_content=_document_plain_content(db, document_id),
    )


@router.post("/documents/{document_id}/segments/bulk", response_model=List[SegmentResponse], status_code=201)
async def create_segments_bulk(
    document_id: str,
    segments: List[SegmentCreate],
    db: Session = Depends(get_db)
):
    """Create multiple segments at once"""
    segments_data = [seg.dict() for seg in segments]
    db_segments = create_segments_bulk_ctrl(db, document_id, segments_data)
    content = _document_plain_content(db, document_id)

    segment_responses = []
    for segment in db_segments:
        segment_responses.append(_build_segment_response(segment, db, document_content=content))
    return segment_responses


@router.get("/documents/{document_id}/segments", response_model=List[SegmentResponse])
async def list_segments(
    document_id: str,
    db: Session = Depends(get_db)
):
    """Get all segments for a document"""
    content = _document_plain_content(db, document_id)
    segments = list_segments_ctrl(db, document_id)
    segment_responses = []
    for segment in segments:
        segment_responses.append(_build_segment_response(segment, db, document_content=content))
    return segment_responses


@router.get("/segments/{segment_id}", response_model=SegmentResponse)
async def get_segment(
    segment_id: str,
    db: Session = Depends(get_db)
):
    """Get a single segment by ID"""
    segment = get_segment_ctrl(db, segment_id)
    return _build_segment_response(
        segment,
        db,
        document_content=_document_plain_content(db, segment.document_id),
    )


@router.put("/segments/{segment_id}",status_code=201)
async def update_segment(
    segment_id: str,
    segment_update: SegmentUpdate,
    db: Session = Depends(get_db)
):
    """
    PERFORMANCE OPTIMIZED: Update a segment's content or annotations.
    
    Optimizations:
    1. Single SELECT to get segment (with old annotation status)
    2. Incremental document progress update (no COUNT queries)
    3. Avoid db.refresh() by using already-updated ORM object
    4. Single transaction commit
    
    Performance: Reduced from ~5 queries to 1-2 queries:
    - Before: 1 SELECT (segment) + 1 SELECT (document) + 2 COUNT(*) + 1 UPDATE (doc) + 1 UPDATE (segment) + 1 SELECT (refresh)
    - After: 1 SELECT (segment) + 1 UPDATE (segment) + 1 UPDATE (doc, if annotation changed)
    """
    patch = segment_update.model_dump(exclude_unset=True)
    segment = update_segment_ctrl(db, segment_id, patch)
    return {"message":"segment updated","id":segment.id}


@router.put("/segments/bulk", response_model=List[SegmentResponse])
async def update_segments_bulk(
    updates: BulkSegmentUpdate,
    db: Session = Depends(get_db)
):
    """Update multiple segments at once"""
    segment_updates = [seg.model_dump(exclude_unset=True) for seg in updates.segments]
    updated_segments = update_segments_bulk_ctrl(db, segment_updates, updates.segment_ids)
    content = (
        _document_plain_content(db, updated_segments[0].document_id)
        if updated_segments
        else ""
    )

    segment_responses = []
    for segment in updated_segments:
        segment_responses.append(_build_segment_response(segment, db, document_content=content))
    return segment_responses


@router.post("/segments/{segment_id}/split")
async def split_segment(
    segment_id: str,
    split_request: SplitSegmentRequest,
    db: Session = Depends(get_db)
):
    """Split a segment at a given position"""
    split_segment_ctrl(
        db=db,
        segment_id=split_request.segment_id,
        split_position=split_request.split_position,
        document_id=split_request.document_id
    )
    
    return {"message":"segment split","id":segment_id}


@router.post("/segments/merge", response_model=SegmentResponse)
async def merge_segments(
    merge_request: MergeSegmentsRequest,
    db: Session = Depends(get_db)
):
    """Merge multiple segments into one"""
    first_segment = merge_segments_ctrl(db, merge_request.segment_ids)
    return _build_segment_response(
        first_segment,
        db,
        document_content=_document_plain_content(db, first_segment.document_id),
    )


@router.delete("/segments/{segment_id}", status_code=204)
async def delete_segment(
    segment_id: str,
    db: Session = Depends(get_db)
):
    """Delete a segment"""
    delete_segment_ctrl(db, segment_id)
    return None


# ==================== Comment Endpoints ====================

@router.get("/segments/{segment_id}/comment", response_model=List[CommentResponse])
async def get_segment_comments(
    segment_id: str,
    db: Session = Depends(get_db)
):
    """Get all comments for a segment"""
    comments_list = get_segment_comments_ctrl(db, segment_id)
    return [CommentResponse(**c) for c in comments_list]


@router.post("/segments/{segment_id}/comment", response_model=List[CommentResponse])
async def add_segment_comment(
    segment_id: str,
    comment: CommentAdd,
    db: Session = Depends(get_db)
):
    """Add a comment to a segment"""
    comments_list = add_segment_comment_ctrl(
        db=db,
        segment_id=segment_id,
        content=comment.content,
        username=comment.username
    )
    return [CommentResponse(**c) for c in comments_list]


@router.put("/segments/{segment_id}/comment/{comment_index}", response_model=List[CommentResponse])
async def update_segment_comment(
    segment_id: str,
    comment_index: int,
    comment_update: CommentUpdate,
    db: Session = Depends(get_db)
):
    """Update a specific comment by index"""
    comments_list = update_segment_comment_ctrl(
        db=db,
        segment_id=segment_id,
        comment_index=comment_index,
        content=comment_update.content
    )
    return [CommentResponse(**c) for c in comments_list]


@router.delete("/segments/{segment_id}/comment/{comment_index}", response_model=List[CommentResponse])
async def delete_segment_comment(
    segment_id: str,
    comment_index: int,
    db: Session = Depends(get_db)
):
    """Delete a specific comment by index"""
    comments_list = delete_segment_comment_ctrl(
        db=db,
        segment_id=segment_id,
        comment_index=comment_index
    )
    return [CommentResponse(**c) for c in comments_list]


@router.post("/documents/{document_id}/segments/bulk-operations", response_model=List[SegmentResponse])
async def bulk_segment_operations(
    document_id: str,
    operations: BulkSegmentOperationsRequest,
    db: Session = Depends(get_db)
):
    """
    Perform bulk operations on segments: create, update, and delete in a single transaction.
    This is optimized for performance by batching all operations together.
    """
    create_data = [seg.dict() for seg in operations.create] if operations.create else None
    result_segments = bulk_segment_operations_ctrl(
        db=db,
        document_id=document_id,
        create=create_data,
        update=operations.update,
        delete=operations.delete
    )
    content = _document_plain_content(db, document_id)

    segment_responses = []
    for seg in result_segments:
        segment_responses.append(_build_segment_response(seg, db, document_content=content))
    return segment_responses


@router.delete("/documents/{document_id}/segments/reset", status_code=204)
async def reset_segments(
    document_id: str,
    db: Session = Depends(get_db)
):
    """Delete all segments for a document"""
    reset_segments_ctrl(db, document_id)
    return None


@router.put("/documents/{document_id}/status")
async def update_document_status(
    document_id: str,
    status_update: DocumentStatusUpdate,
    user_id: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """
    Update document status.
    
    When restoring a deleted document (changing status from 'deleted' to 'active'),
    the user_id parameter must be provided and must match the document's user_id
    to ensure only the document owner can restore it.
    """
    return update_document_status_ctrl(
        db=db,
        document_id=document_id,
        status=status_update.status,
        user_id=user_id
    )


@router.put("/segments/{segment_id}/status")
async def update_segment_status(
    segment_id: str,
    status_update: SegmentStatusUpdate,
    db: Session = Depends(get_db)
):
    """Update segment status (checked/unchecked)"""
    return update_segment_status_ctrl(
        db=db,
        segment_id=segment_id,
        status=status_update.status
    )


@router.get("/documents/{document_id}/progress")
async def get_document_progress(
    document_id: str,
    db: Session = Depends(get_db)
):
    """Get progress statistics for a document"""
    return get_document_progress_ctrl(db, document_id)


@router.post("/assign_volume")
async def assign_volume(user_id: str, db: Session = Depends(get_db)):
    """Assign a volume to a document"""
    # get a "new" status  volume
    document = await assign_volume_ctrl(db, user_id)
    return document
    
    
@router.put("/segments/{segment_id}/reject", response_model=SegmentResponse)
async def reject_segment(
    segment_id: str,
    body: RejectSegmentRequest,
    reviewer_id: Optional[str] = Query(None, description="Optional reviewer user id"),
    db: Session = Depends(get_db)
):
    """Reject a checked segment"""
    segment = reject_segment_ctrl(db, segment_id, reviewer_id, body.comment)
    return _build_segment_response(
        segment,
        db,
        document_content=_document_plain_content(db, segment.document_id),
    )


@router.put("/segments/bulk-reject", response_model=List[SegmentResponse])
async def reject_segments_bulk(
    request: BulkRejectRequest,
    db: Session = Depends(get_db)
):
    """Reject multiple checked segments at once"""
    segments = reject_segments_bulk_ctrl(
        db, request.segment_ids, request.reviewer_id, request.comment
    )
    return [
        _build_segment_response(
            seg,
            db,
            document_content=_document_plain_content(db, seg.document_id),
        )
        for seg in segments
    ]


@router.post("/documents/{document_id}/submit-bdrc-in-review")
async def submit_document_to_bdrc_in_review(
    document_id: str,
    db: Session = Depends(get_db),
):
    """Push outline to BDRC with status in_review and set document status to completed."""
    return await submit_document_to_bdrc_in_review_ctrl(db, document_id)


@router.post("/documents/{document_id}/approve")
async def approve_document(
    document_id: str,
    db: Session = Depends(get_db)
):
    """Approve all segments for a document"""
    return await approve_document_ctrl(db, document_id)



@router.post("/ai-outline", response_model=DocumentResponse)
async def ai_outline(
    document_id: str,
    db: Session = Depends(get_db)
):
    """Split document text into segments using TOC character indices from ai_text_outline."""
    document = get_document_ctrl(db, document_id, include_segments=False)
    result = extract_toc_indices(text=document.content)

    indices = result["breakpoints"]
    toc = result.get("toc")
    spans = _spans_from_toc_indices(document.content, indices)
    segments_data = [
        {"segment_index": i, "span_start": start, "span_end": end}
        for i, (start, end) in enumerate(spans)
    ]
    document, segment_payload = replace_document_segments_and_ai_toc_ctrl(
        db, document_id, segments_data, toc
    )
    segments_resp = [
        SegmentResponseDocument(
            **{k: d[k] for k in SegmentResponseDocument.model_fields if k in d}
        )
        for d in segment_payload
    ]
    return DocumentResponse(
        id=document.id,
        content=document.content,
        filename=document.filename,
        user_id=document.user_id,
        status=getattr(document, "status", None),
        created_at=document.created_at,
        updated_at=document.updated_at,
        is_supplied_title=getattr(document, "is_supplied_title", None),
        segments=segments_resp,
    )


# ==================== Dashboard Stats ====================

class AnnotatorPerformanceRow(BaseModel):
    user_id: Optional[str] = None
    document_count: int
    segment_count: int
    segments_with_title_or_author: int
    rejection_count: int = Field(
        ...,
        description="Segments still rejected with latest rejection unresolved (annotator has not addressed)",
    )


class DashboardStatsResponse(BaseModel):
    document_count: int
    total_segments: int
    segments_with_title_or_author: int
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
    annotation_coverage_pct: float
    annotator_performance: List[AnnotatorPerformanceRow]


@router.get("/dashboard/stats", response_model=DashboardStatsResponse)
async def get_dashboard_stats(
    user_id: Optional[str] = Query(None, description="Filter by annotator user ID"),
    start_date: Optional[datetime] = Query(None, description="Start of date range (ISO format)"),
    end_date: Optional[datetime] = Query(None, description="End of date range (ISO format)"),
    db: Session = Depends(get_db),
):
    """Return aggregate stats for the admin overview dashboard."""
    return get_dashboard_stats_ctrl(db, user_id=user_id, start_date=start_date, end_date=end_date)