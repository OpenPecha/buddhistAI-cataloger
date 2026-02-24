from fastapi import APIRouter, HTTPException, Depends, UploadFile, File, Form
from pydantic import BaseModel, Field
from typing import List, Optional
from sqlalchemy.orm import Session
from datetime import datetime
from core.database import get_db
from outliner.controller.outliner import (
    create_document as create_document_ctrl,
    upload_document as upload_document_ctrl,
    list_documents as list_documents_ctrl,
    get_document as get_document_ctrl,
    update_document_content as update_document_content_ctrl,
    delete_document as delete_document_ctrl,
    update_document_status as update_document_status_ctrl,
    get_document_progress as get_document_progress_ctrl,
    reset_segments as reset_segments_ctrl,
    create_segment as create_segment_ctrl,
    create_segments_bulk as create_segments_bulk_ctrl,
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
)
from outliner.utils.outliner_utils import get_comments_list

router = APIRouter()

# ==================== Pydantic Schemas ====================

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
    comment: Optional[str] = None  # Deprecated: kept for backward compatibility
    comment_content: Optional[str] = None  # New comment content to append
    comment_username: Optional[str] = None  # Username for new comment


class SegmentResponse(BaseModel):
    id: str
    text: str
    segment_index: int
    span_start: int
    span_end: int
    title: Optional[str] = None
    author: Optional[str] = None
    title_bdrc_id: Optional[str] = None
    author_bdrc_id: Optional[str] = None
    parent_segment_id: Optional[str] = None
    is_annotated: bool
    is_attached: Optional[bool] = None
    status: Optional[str] = None  # checked, unchecked
    comments: Optional[List[CommentResponse]] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class DocumentCreate(BaseModel):
    content: str
    filename: Optional[str] = None
    user_id: Optional[str] = None

class SegmentResponseDocument(BaseModel):
    id: str
    text: str
    segment_index: int
    span_start: int
    span_end: int
    title: Optional[str] = None
    author: Optional[str] = None
    title_bdrc_id: Optional[str] = None
    author_bdrc_id: Optional[str] = None
    parent_segment_id: Optional[str] = None
    is_annotated: bool
    is_attached: Optional[bool] = None
    status: Optional[str] = None  # checked, unchecked

    class Config:
        from_attributes = True

class DocumentResponse(BaseModel):
    id: str
    content: str
    filename: Optional[str] = None
    user_id: Optional[str] = None
    total_segments: int
    annotated_segments: int
    progress_percentage: float
    status: Optional[str] = None  # active, completed, deleted, approved, rejected
    created_at: datetime
    updated_at: datetime
    segments: List[SegmentResponseDocument] = []

    class Config:
        from_attributes = True


class DocumentListResponse(BaseModel):
    id: str
    filename: Optional[str] = None
    user_id: Optional[str] = None
    total_segments: int
    annotated_segments: int
    progress_percentage: float
    checked_segments: int  # Number of checked segments
    unchecked_segments: int  # Number of unchecked segments
    status: Optional[str] = None  # active, completed, deleted, approved, rejected
    created_at: datetime
    updated_at: datetime

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

def _build_segment_response(segment) -> SegmentResponse:
    """Helper to build SegmentResponse from segment model"""
    comments_list = get_comments_list(segment)
    return SegmentResponse(
        id=segment.id,
        text=segment.text,
        segment_index=segment.segment_index,
        span_start=segment.span_start,
        span_end=segment.span_end,
        title=segment.title,
        author=segment.author,
        title_bdrc_id=segment.title_bdrc_id,
        author_bdrc_id=segment.author_bdrc_id,
        parent_segment_id=segment.parent_segment_id,
        is_annotated=segment.is_annotated,
        is_attached=segment.is_attached,
        status=segment.status,
        comments=[CommentResponse(**c) for c in comments_list] if comments_list else None,
        created_at=segment.created_at,
        updated_at=segment.updated_at
    )


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


@router.post("/documents/upload", response_model=DocumentResponse, status_code=201)
async def upload_document(
    file: Optional[UploadFile] = File(None),
    content: Optional[str] = Form(None),
    filename: Optional[str] = Form(None),
    user_id: Optional[str] = Form(None),
    db: Session = Depends(get_db)
):
    """Upload a text file or text content to create a new outliner document"""
    file_content = None
    
    # Try to get file content first
    if file is not None and file.filename and file.filename.strip():
        try:
            file_content_bytes = await file.read()
            if file_content_bytes:
                file_content = file_content_bytes.decode('utf-8')
        except Exception as e:
            # Log the error for debugging but continue to check content field
            print(f"Error reading file: {e}")
    
    db_document = upload_document_ctrl(
        db=db,
        file_content=file_content,
        content=content,
        filename=filename,
        user_id=user_id
    )
    return db_document


@router.get("/documents", response_model=List[DocumentListResponse])
async def list_documents(
    user_id: Optional[str] = None,
    skip: int = 0,
    limit: int = 100,
    include_deleted: bool = False,
    db: Session = Depends(get_db)
):
    """
    List all outliner documents, optionally filtered by user and deletion status.
    
    Args:
        user_id: Filter documents by user ID
        skip: Number of documents to skip (pagination)
        limit: Maximum number of documents to return
        include_deleted: If False (default), exclude deleted documents. If True, include all documents.
    """
    result = list_documents_ctrl(
        db=db,
        user_id=user_id,
        skip=skip,
        limit=limit,
        include_deleted=include_deleted
    )
    return result


@router.get("/documents/{document_id}", response_model=DocumentResponse)
async def get_document(
    document_id: str,
    include_segments: bool = True,
    db: Session = Depends(get_db)
):
    """Get a document by ID with all its segments"""
    document = get_document_ctrl(db, document_id, include_segments)
    
    # If segments are requested but none exist, create a single segment covering the entire document
    if include_segments:
        segments_exist = hasattr(document, 'segment_list') and document.segment_list and len(document.segment_list) > 0
        if not segments_exist:
            # Create a single segment from 0 to length of text
            text_length = len(document.content)
            create_segment_ctrl(
                db=db,
                document_id=document_id,
                segment_index=0,
                span_start=0,
                span_end=text_length,
                text=None  # Will be auto-extracted from document content
            )
            # Re-fetch document with the newly created segment
            document = get_document_ctrl(db, document_id, include_segments)
    
    return document


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
    return _build_segment_response(db_segment)


@router.post("/documents/{document_id}/segments/bulk", response_model=List[SegmentResponse], status_code=201)
async def create_segments_bulk(
    document_id: str,
    segments: List[SegmentCreate],
    db: Session = Depends(get_db)
):
    """Create multiple segments at once"""
    segments_data = [seg.dict() for seg in segments]
    db_segments = create_segments_bulk_ctrl(db, document_id, segments_data)
    
    segment_responses = []
    for segment in db_segments:
        segment_responses.append(_build_segment_response(segment))
    return segment_responses


@router.get("/documents/{document_id}/segments", response_model=List[SegmentResponse])
async def list_segments(
    document_id: str,
    db: Session = Depends(get_db)
):
    """Get all segments for a document"""
    segments = list_segments_ctrl(db, document_id)
    print(segments)
    segment_responses = []
    for segment in segments:
        segment_responses.append(_build_segment_response(segment))
    return segment_responses


@router.get("/segments/{segment_id}", response_model=SegmentResponse)
async def get_segment(
    segment_id: str,
    db: Session = Depends(get_db)
):
    """Get a single segment by ID"""
    segment = get_segment_ctrl(db, segment_id)
    return _build_segment_response(segment)


@router.put("/segments/{segment_id}", response_model=SegmentResponse)
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
    segment = update_segment_ctrl(
        db=db,
        segment_id=segment_id,
        text=segment_update.text,
        title=segment_update.title,
        author=segment_update.author,
        title_bdrc_id=segment_update.title_bdrc_id,
        author_bdrc_id=segment_update.author_bdrc_id,
        parent_segment_id=segment_update.parent_segment_id,
        is_attached=segment_update.is_attached,
        status=segment_update.status,
        comment=segment_update.comment,
        comment_content=segment_update.comment_content,
        comment_username=segment_update.comment_username
    )
    return _build_segment_response(segment)


@router.put("/segments/bulk", response_model=List[SegmentResponse])
async def update_segments_bulk(
    updates: BulkSegmentUpdate,
    db: Session = Depends(get_db)
):
    """Update multiple segments at once"""
    segment_updates = [seg.dict() for seg in updates.segments]
    updated_segments = update_segments_bulk_ctrl(db, segment_updates, updates.segment_ids)
    
    segment_responses = []
    for segment in updated_segments:
        segment_responses.append(_build_segment_response(segment))
    return segment_responses


@router.post("/segments/{segment_id}/split", response_model=List[SegmentResponse])
async def split_segment(
    segment_id: str,
    split_request: SplitSegmentRequest,
    db: Session = Depends(get_db)
):
    """Split a segment at a given position"""
    segments = split_segment_ctrl(
        db=db,
        segment_id=split_request.segment_id,
        split_position=split_request.split_position,
        document_id=split_request.document_id
    )
    
    segment_responses = []
    for seg in segments:
        segment_responses.append(_build_segment_response(seg))
    return segment_responses


@router.post("/segments/merge", response_model=SegmentResponse)
async def merge_segments(
    merge_request: MergeSegmentsRequest,
    db: Session = Depends(get_db)
):
    """Merge multiple segments into one"""
    first_segment = merge_segments_ctrl(db, merge_request.segment_ids)
    return _build_segment_response(first_segment)


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
    
    segment_responses = []
    for seg in result_segments:
        segment_responses.append(_build_segment_response(seg))
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
    
    
@router.post("/documents/{document_id}/approve")
async def approve_document(
    document_id: str,
    db: Session = Depends(get_db)
):
    """Approve all segments for a document"""
    #get document from database
    return await approve_document_ctrl(db, document_id)