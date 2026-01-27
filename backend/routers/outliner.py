from fastapi import APIRouter, HTTPException, Depends, UploadFile, File, Form, Request
from pydantic import BaseModel, Field
from typing import List, Optional, Union, Dict, Any
from sqlalchemy.orm import Session
from sqlalchemy.orm.attributes import flag_modified
from sqlalchemy import func, update
from sqlalchemy.dialects.postgresql import insert
from datetime import datetime
import uuid
from core.database import get_db
from core.redis import (
    get_document_content_from_cache,
    set_document_content_in_cache,
    invalidate_document_content_cache
)
from models.outliner import OutlinerDocument, OutlinerSegment

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
    segments: List[SegmentResponse] = []

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


import re

def remove_escape_chars_except_newline(text: str) -> str:
    """
    Removes all ASCII control characters except newline (\n).
    """
    # ASCII control chars: 0x00–0x1F and 0x7F
    # Keep \n (0x0A)
    return re.sub(r'[\x00-\x09\x0B-\x1F\x7F]', '', text)

# ==================== Helper Functions ====================

def get_document_with_cache(db: Session, document_id: str) -> Optional[OutlinerDocument]:
    """
    Get document from database, checking Redis cache first for content.
    If content is in cache, use it; otherwise fetch from DB and cache it.
    
    Args:
        db: Database session
        document_id: Document ID
        
    Returns:
        OutlinerDocument if found, None otherwise
    """
    # Try to get content from cache first
    cached_content = get_document_content_from_cache(document_id)
    
    if cached_content is not None:
        # Content found in cache, fetch document metadata from DB
        document = db.query(OutlinerDocument).filter(OutlinerDocument.id == document_id).first()
        if document:
            # Replace content with cached version
            document.content = cached_content
        return document
    else:
        # Content not in cache, fetch from DB
        document = db.query(OutlinerDocument).filter(OutlinerDocument.id == document_id).first()
        if document:
            # Cache the content for future requests
            set_document_content_in_cache(document_id, document.content)
        return document


def update_document_progress(db: Session, document_id: str):
    """
    Recalculate and update document progress using COUNT queries.
    DEPRECATED: Use incremental_update_document_progress for better performance.
    Kept for backward compatibility with endpoints that need full recalculation.
    """
    document = db.query(OutlinerDocument).filter(OutlinerDocument.id == document_id).first()
    if not document:
        return
    
    # Count total and annotated segments
    total = db.query(func.count(OutlinerSegment.id)).filter(
        OutlinerSegment.document_id == document_id
    ).scalar()
    
    annotated = db.query(func.count(OutlinerSegment.id)).filter(
        OutlinerSegment.document_id == document_id,
        OutlinerSegment.is_annotated == True
    ).scalar()
    
    document.total_segments = total
    document.annotated_segments = annotated
    document.update_progress()
    # Note: Don't commit here - let the caller handle transaction


def incremental_update_document_progress(
    db: Session,
    document_id: str,
    total_delta: int = 0,
    annotated_delta: int = 0
):
    """
    PERFORMANCE OPTIMIZED: Incrementally update document progress without COUNT queries.
    
    This function updates document progress counters atomically using the current
    values plus deltas, avoiding expensive COUNT(*) queries.
    
    Args:
        db: Database session
        document_id: Document ID to update
        total_delta: Change in total_segments count (+1 for create, -1 for delete, 0 for update)
        annotated_delta: Change in annotated_segments count (+1 when annotation added, -1 when removed, 0 for no change)
    
    Performance: 1 SELECT + 1 UPDATE instead of 2 COUNT queries + 1 SELECT + 1 UPDATE
    """
    if total_delta == 0 and annotated_delta == 0:
        # No change needed, but still update progress percentage in case it's stale
        document = db.query(OutlinerDocument).filter(OutlinerDocument.id == document_id).first()
        if document:
            document.update_progress()
        return
    
    # PERFORMANCE FIX: Fetch document once, update in memory
    # This is still much faster than COUNT queries on large segment tables
    document = db.query(OutlinerDocument).filter(OutlinerDocument.id == document_id).first()
    if not document:
        return  # Document doesn't exist, skip update
    
    # Update counters atomically
    document.total_segments += total_delta
    document.annotated_segments += annotated_delta
    
    # Ensure counters don't go negative (safety check)
    if document.total_segments < 0:
        document.total_segments = 0
    if document.annotated_segments < 0:
        document.annotated_segments = 0
    if document.annotated_segments > document.total_segments:
        document.annotated_segments = document.total_segments
    
    # Recalculate progress percentage
    document.update_progress()
    # Note: Don't commit here - let the caller handle transaction


def get_annotation_status_delta(
    old_is_annotated: bool,
    new_is_annotated: bool
) -> int:
    """
    Calculate the delta for annotated_segments count based on annotation status change.
    
    Returns:
        +1 if segment became annotated (False -> True)
        -1 if segment became unannotated (True -> False)
        0 if status unchanged
    """
    if old_is_annotated and not new_is_annotated:
        return -1
    elif not old_is_annotated and new_is_annotated:
        return 1
    return 0


# ==================== Document Endpoints ====================

@router.post("/documents", response_model=DocumentResponse, status_code=201)
async def create_document(
    document: DocumentCreate,
    db: Session = Depends(get_db)
):
    """Create a new outliner document with full text content"""
    db_document = OutlinerDocument(
        id=str(uuid.uuid4()),
        content=document.content,
        filename=document.filename,
        user_id=document.user_id,
        total_segments=0,
        annotated_segments=0,
        progress_percentage=0.0
    )
    db.add(db_document)
    db.commit()
    db.refresh(db_document)
    
    # Cache the new document content
    set_document_content_in_cache(db_document.id, db_document.content)
    
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
    text_content = None
    document_filename = None
    
    # Try to get file content first
    if file is not None and file.filename and file.filename.strip():
        try:
            file_content = await file.read()
            if file_content:
                text_content_temp = file_content.decode('utf-8')
                text_content = remove_escape_chars_except_newline(text_content_temp)
                document_filename = file.filename
        except Exception as e:
            # Log the error for debugging but continue to check content field
            print(f"Error reading file: {e}")
    
    # If no file content, check for direct text content
    if not text_content and content:
        text_content = content
        document_filename = filename or "text_document.txt"
    
    # Validate that we have content from either source
    if not text_content:
        raise HTTPException(
            status_code=400,
            detail="Either 'file' or 'content' field is required"
        )
    
    # Validate that we have non-empty content
    if len(text_content.strip()) == 0:
        raise HTTPException(
            status_code=400,
            detail="Content cannot be empty"
        )
    
    db_document = OutlinerDocument(
        id=str(uuid.uuid4()),
        content=text_content,
        filename=document_filename,
        user_id=user_id,
        total_segments=0,
        annotated_segments=0,
        progress_percentage=0.0
    )
    db.add(db_document)
    db.commit()
    db.refresh(db_document)
    
    # Cache the new document content
    set_document_content_in_cache(db_document.id, db_document.content)
    
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
    query = db.query(OutlinerDocument)
    if user_id:
        query = query.filter(OutlinerDocument.user_id == user_id)
    
    # Filter out deleted documents by default
    if not include_deleted:
        query = query.filter(
            (OutlinerDocument.status != 'deleted') | (OutlinerDocument.status.is_(None))
        )
    
    documents = query.order_by(OutlinerDocument.updated_at.desc()).offset(skip).limit(limit).all()
    
    # Calculate checked/unchecked segments for each document
    result = []
    for doc in documents:
        checked = db.query(func.count(OutlinerSegment.id)).filter(
            OutlinerSegment.document_id == doc.id,
            OutlinerSegment.status == 'checked'
        ).scalar() or 0
        
        unchecked = db.query(func.count(OutlinerSegment.id)).filter(
            OutlinerSegment.document_id == doc.id,
            OutlinerSegment.status 
            != 'checked'
        ).scalar() or 0
        
        result.append({
            "id": doc.id,
            "filename": doc.filename,
            "user_id": doc.user_id,
            "total_segments": doc.total_segments,
            "annotated_segments": doc.annotated_segments,
            "progress_percentage": doc.progress_percentage,
            "checked_segments": checked,
            "unchecked_segments": unchecked,
            "status": doc.status,
            "created_at": doc.created_at,
            "updated_at": doc.updated_at,
        })
    
    return result


@router.get("/documents/{document_id}", response_model=DocumentResponse)
async def get_document(
    document_id: str,
    include_segments: bool = True,
    db: Session = Depends(get_db)
):
    """Get a document by ID with all its segments"""
    document = get_document_with_cache(db, document_id)
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")
    
    if include_segments:
        # Load only selected fields for each segment
        segments = db.query(
            OutlinerSegment.span_start,
            OutlinerSegment.span_end,
            OutlinerSegment.is_attached,
            OutlinerSegment.segment_index,
            OutlinerSegment.comment,
            OutlinerSegment.id,
            OutlinerSegment.status,
            OutlinerSegment.title,
            OutlinerSegment.author,
            OutlinerSegment.title_bdrc_id,
            OutlinerSegment.author_bdrc_id,
        ).filter(
            OutlinerSegment.document_id == document_id
        ).order_by(OutlinerSegment.segment_index).all()
        # Instead of assigning a list of dicts directly (which breaks SQLAlchemy relations), store the segments as an extra attribute for serialization
        document.segment_list = [dict(segment._asdict()) for segment in segments]

    return document


@router.put("/documents/{document_id}/content")
async def update_document_content(
    document_id: str,
    content: str,
    db: Session = Depends(get_db)
):
    """Update the full text content of a document"""
    document = db.query(OutlinerDocument).filter(OutlinerDocument.id == document_id).first()
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")
    
    document.content = content
    document.updated_at = datetime.utcnow()
    db.commit()
    
    # Invalidate cache and update with new content
    invalidate_document_content_cache(document_id)
    set_document_content_in_cache(document_id, content)
    
    return {"message": "Document content updated", "document_id": document_id}


@router.delete("/documents/{document_id}", status_code=204)
async def delete_document(
    document_id: str,
    db: Session = Depends(get_db)
):
    """Delete a document and all its segments"""
    document = db.query(OutlinerDocument).filter(OutlinerDocument.id == document_id).first()
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")
    
    db.delete(document)
    db.commit()
    
    # Invalidate cache when document is deleted
    invalidate_document_content_cache(document_id)
    
    return None


# ==================== Segment Endpoints ====================

@router.post("/documents/{document_id}/segments", response_model=SegmentResponse, status_code=201)
async def create_segment(
    document_id: str,
    segment: SegmentCreate,
    db: Session = Depends(get_db)
):
    """Create a new segment in a document"""
    # Verify document exists and get content from cache if available
    document = get_document_with_cache(db, document_id)
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")
    
    # Extract text from document content using span addresses if text not provided
    segment_text = segment.text
    if not segment_text:
        if segment.span_start < 0 or segment.span_end > len(document.content):
            raise HTTPException(status_code=400, detail="Invalid span addresses")
        segment_text = document.content[segment.span_start:segment.span_end]
    
    db_segment = OutlinerSegment(
        id=str(uuid.uuid4()),
        document_id=document_id,
        text=segment_text,
        segment_index=segment.segment_index,
        span_start=segment.span_start,
        span_end=segment.span_end,
        title=segment.title,
        author=segment.author,
        title_bdrc_id=segment.title_bdrc_id,
        author_bdrc_id=segment.author_bdrc_id,
        parent_segment_id=segment.parent_segment_id,
        status='unchecked'  # Default to unchecked
    )
    db_segment.update_annotation_status()
    
    db.add(db_segment)
    update_document_progress(db, document_id)
    db.commit()
    db.refresh(db_segment)

    comments_list = _get_comments_list(db_segment)
    return SegmentResponse(
        id=db_segment.id,
        text=db_segment.text,
        segment_index=db_segment.segment_index,
        span_start=db_segment.span_start,
        span_end=db_segment.span_end,
        title=db_segment.title,
        author=db_segment.author,
        title_bdrc_id=db_segment.title_bdrc_id,
        author_bdrc_id=db_segment.author_bdrc_id,
        parent_segment_id=db_segment.parent_segment_id,
        is_annotated=db_segment.is_annotated,
        is_attached=db_segment.is_attached,
        status=db_segment.status,
        comments=comments_list,
        created_at=db_segment.created_at,
        updated_at=db_segment.updated_at
    )


@router.post("/documents/{document_id}/segments/bulk", response_model=List[SegmentResponse], status_code=201)
async def create_segments_bulk(
    document_id: str,
    segments: List[SegmentCreate],
    db: Session = Depends(get_db)
):
    """Create multiple segments at once"""
    document = get_document_with_cache(db, document_id)
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")
    
    db_segments = []
    for segment in segments:
        # Extract text from document content using span addresses if text not provided
        segment_text = segment.text
        if not segment_text:
            if segment.span_start < 0 or segment.span_end > len(document.content):
                raise HTTPException(status_code=400, detail=f"Invalid span addresses for segment at index {segment.segment_index}")
            segment_text = document.content[segment.span_start:segment.span_end]
        
        db_segment = OutlinerSegment(
            id=str(uuid.uuid4()),
            document_id=document_id,
            text=segment_text,
            segment_index=segment.segment_index,
            span_start=segment.span_start,
            span_end=segment.span_end,
            title=segment.title,
            author=segment.author,
            title_bdrc_id=segment.title_bdrc_id,
            author_bdrc_id=segment.author_bdrc_id,
            parent_segment_id=segment.parent_segment_id,
            status='unchecked'  # Default to unchecked
        )
        db_segment.update_annotation_status()
        db_segments.append(db_segment)
        db.add(db_segment)
    
    update_document_progress(db, document_id)
    db.commit()

    for seg in db_segments:
        db.refresh(seg)

    segment_responses = []
    for segment in db_segments:
        comments_list = _get_comments_list(segment)
        segment_responses.append(SegmentResponse(
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
            comments=comments_list,
            created_at=segment.created_at,
            updated_at=segment.updated_at
        ))
    return segment_responses


@router.get("/documents/{document_id}/segments", response_model=List[SegmentResponse])
async def list_segments(
    document_id: str,
    db: Session = Depends(get_db)
):
    """Get all segments for a document"""
    segments = db.query(OutlinerSegment).filter(
        OutlinerSegment.document_id == document_id
    ).order_by(OutlinerSegment.segment_index).all()

    segment_responses = []
    for segment in segments:
        comments_list = _get_comments_list(segment)
        segment_responses.append(SegmentResponse(
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
            comments=comments_list,
            created_at=segment.created_at,
            updated_at=segment.updated_at
        ))
    return segment_responses


@router.get("/segments/{segment_id}", response_model=SegmentResponse)
async def get_segment(
    segment_id: str,
    db: Session = Depends(get_db)
):
    """Get a single segment by ID"""
    segment = db.query(OutlinerSegment).filter(OutlinerSegment.id == segment_id).first()
    if not segment:
        raise HTTPException(status_code=404, detail="Segment not found")

    comments_list = _get_comments_list(segment)
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
        comments=comments_list,
        created_at=segment.created_at,
        updated_at=segment.updated_at
    )


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
    # PERFORMANCE FIX #1: Single SELECT to get segment with current state
    segment = db.query(OutlinerSegment).filter(OutlinerSegment.id == segment_id).first()
    if not segment:
        raise HTTPException(status_code=404, detail="Segment not found")
    
    # Track old annotation status for incremental update
    old_is_annotated = segment.is_annotated
    document_id = segment.document_id  # Store before updates
    
    # Update fields if provided
    if segment_update.text is not None:
        segment.text = segment_update.text
    if segment_update.title is not None:
        segment.title = segment_update.title
    if segment_update.author is not None:
        segment.author = segment_update.author
    if segment_update.title_bdrc_id is not None:
        segment.title_bdrc_id = segment_update.title_bdrc_id
    if segment_update.author_bdrc_id is not None:
        segment.author_bdrc_id = segment_update.author_bdrc_id
    if segment_update.parent_segment_id is not None:
        segment.parent_segment_id = segment_update.parent_segment_id
    if segment_update.is_attached is not None:
        segment.is_attached = segment_update.is_attached
    if segment_update.comment is not None:
        # Backward compatibility: if old comment format is used, convert to new format
        segment.comment = segment_update.comment
    # Handle new comment format: append comment with username
    if segment_update.comment_content is not None and segment_update.comment_username is not None:
        # Get existing comments using helper function
        existing_comments = _get_comments_list(segment)
        
        # Append new comment
        new_comment = {
            "content": segment_update.comment_content,
            "username": segment_update.comment_username,
            "timestamp": datetime.utcnow().isoformat()
        }
        existing_comments.append(new_comment)
        
        # Store as array directly
        segment.comment = existing_comments
    if segment_update.status is not None:
        # Validate status value
        if segment_update.status not in ['checked', 'unchecked','approved']:
            raise HTTPException(status_code=400, detail="Status must be 'checked' or 'unchecked'")
        segment.status = segment_update.status
    
    # Update annotation status flag
    segment.update_annotation_status()
    new_is_annotated = segment.is_annotated
    segment.updated_at = datetime.utcnow()
    
    # PERFORMANCE FIX #2: Incremental progress update (no COUNT queries)
    # Only update document progress if annotation status actually changed
    annotated_delta = get_annotation_status_delta(old_is_annotated, new_is_annotated)
    if annotated_delta != 0:
        incremental_update_document_progress(
            db=db,
            document_id=document_id,
            total_delta=0,  # No change in total count for updates
            annotated_delta=annotated_delta
        )
    
    # PERFORMANCE FIX #3: Single commit (get_db dependency handles commit automatically)
    # No db.refresh() needed - ORM object is already updated in memory
    # The object will be flushed and committed by get_db dependency

    comments_list = _get_comments_list(segment)
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
        comments=comments_list,
        created_at=segment.created_at,
        updated_at=segment.updated_at
    )


@router.put("/segments/bulk", response_model=List[SegmentResponse])
async def update_segments_bulk(
    updates: BulkSegmentUpdate,
    db: Session = Depends(get_db)
):
    """Update multiple segments at once"""
    if len(updates.segments) != len(updates.segment_ids):
        raise HTTPException(
            status_code=400,
            detail="Number of segments must match number of segment_ids"
        )
    
    updated_segments = []
    document_ids = set()
    
    for segment_id, segment_update in zip(updates.segment_ids, updates.segments):
        segment = db.query(OutlinerSegment).filter(OutlinerSegment.id == segment_id).first()
        if not segment:
            continue
        
        document_ids.add(segment.document_id)
        
        if segment_update.text is not None:
            segment.text = segment_update.text
        if segment_update.title is not None:
            segment.title = segment_update.title
        if segment_update.author is not None:
            segment.author = segment_update.author
        if segment_update.title_bdrc_id is not None:
            segment.title_bdrc_id = segment_update.title_bdrc_id
        if segment_update.author_bdrc_id is not None:
            segment.author_bdrc_id = segment_update.author_bdrc_id
        if segment_update.parent_segment_id is not None:
            segment.parent_segment_id = segment_update.parent_segment_id
        if segment_update.is_attached is not None:
            segment.is_attached = segment_update.is_attached
        if segment_update.status is not None:
            # Validate status value
            if segment_update.status not in ['checked', 'unchecked']:
                continue  # Skip invalid status updates
            segment.status = segment_update.status
        
        segment.update_annotation_status()
        segment.updated_at = datetime.utcnow()
        updated_segments.append(segment)
    
    # Update progress for all affected documents
    for doc_id in document_ids:
        update_document_progress(db, doc_id)
    
    db.commit()

    for seg in updated_segments:
        db.refresh(seg)

    segment_responses = []
    for segment in updated_segments:
        comments_list = _get_comments_list(segment)
        segment_responses.append(SegmentResponse(
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
            comments=comments_list,
            created_at=segment.created_at,
            updated_at=segment.updated_at
        ))
    return segment_responses


@router.post("/segments/{segment_id}/split", response_model=List[SegmentResponse])
async def split_segment(
    segment_id: str,
    split_request: SplitSegmentRequest,
    db: Session = Depends(get_db)
):
    """Split a segment at a given position"""
    segment = db.query(OutlinerSegment).filter(OutlinerSegment.id == segment_id).first()
    
    # If segment doesn't exist, check if we need to create initial segment from document
    if not segment:
        # If document_id is provided, try to create initial segment from document content
        if split_request.document_id:
            document = get_document_with_cache(db, split_request.document_id)
            if not document:
                raise HTTPException(status_code=404, detail="Document not found")
            
            # Check if document has any segments
            existing_segments = db.query(OutlinerSegment).filter(
                OutlinerSegment.document_id == split_request.document_id
            ).count()
            
            # If no segments exist, create initial segment from document content
            if existing_segments == 0:
                if not document.content or len(document.content.strip()) == 0:
                    raise HTTPException(status_code=400, detail="Document has no content to split")
                
                # Create initial segment from full document content
                initial_segment = OutlinerSegment(
                    id=str(uuid.uuid4()),
                    document_id=split_request.document_id,
                    text=document.content,
                    segment_index=0,
                    span_start=0,
                    span_end=len(document.content),
                    title=None,
                    author=None,
                    parent_segment_id=None,
                    status='unchecked'  # Default to unchecked
                )
                initial_segment.update_annotation_status()
                db.add(initial_segment)
                db.commit()
                db.refresh(initial_segment)
                
                # Now use this segment for splitting
                segment = initial_segment
            else:
                raise HTTPException(status_code=404, detail="Segment not found")
        else:
            raise HTTPException(status_code=404, detail="Segment not found")
    
    # IMPORTANT: Do not strip/trim. Document content (and spans) must preserve whitespace/newlines exactly.
    # split_position is a character offset within segment.text.
    if split_request.split_position <= 0 or split_request.split_position >= len(segment.text):
        raise HTTPException(status_code=400, detail="Invalid split position")

    old_span_start = segment.span_start
    old_span_end = segment.span_end
    new_first_span_end = old_span_start + split_request.split_position

    # Safety check: split position must fall within the segment span
    if new_first_span_end < old_span_start or new_first_span_end > old_span_end:
        raise HTTPException(status_code=400, detail="Invalid split position for segment span")

    text_before = segment.text[:split_request.split_position]
    text_after = segment.text[split_request.split_position:]

    
    # Update first segment (preserve whitespace/newlines; update span_end using split_position)
    segment.text = text_before
    segment.span_end = new_first_span_end
    segment.update_annotation_status()
    
    # Create second segment
    new_segment = OutlinerSegment(
        id=str(uuid.uuid4()),
        document_id=segment.document_id,
        text=text_after,
        segment_index=segment.segment_index + 1,
        span_start=new_first_span_end,
        span_end=old_span_end,
        title=None,
        author=None,
        parent_segment_id=segment.parent_segment_id,
        status=segment.status or 'unchecked'
    )
    
    # Update segment indices for following segments
    following_segments = db.query(OutlinerSegment).filter(
        OutlinerSegment.document_id == segment.document_id,
        OutlinerSegment.segment_index > segment.segment_index
    ).all()
    
    for seg in following_segments:
        seg.segment_index += 1
    
    db.add(new_segment)
    update_document_progress(db, segment.document_id)
    db.commit()
    db.refresh(segment)
    db.refresh(new_segment)

    segment_responses = []
    for seg in [segment, new_segment]:
        comments_list = _get_comments_list(seg)
        segment_responses.append(SegmentResponse(
            id=seg.id,
            text=seg.text,
            segment_index=seg.segment_index,
            span_start=seg.span_start,
            span_end=seg.span_end,
            title=seg.title,
            author=seg.author,
            title_bdrc_id=seg.title_bdrc_id,
            author_bdrc_id=seg.author_bdrc_id,
            parent_segment_id=seg.parent_segment_id,
            is_annotated=seg.is_annotated,
            is_attached=seg.is_attached,
            status=seg.status,
            comments=comments_list,
            created_at=seg.created_at,
            updated_at=seg.updated_at
        ))
    return segment_responses


@router.post("/segments/merge", response_model=SegmentResponse)
async def merge_segments(
    merge_request: MergeSegmentsRequest,
    db: Session = Depends(get_db)
):
    """Merge multiple segments into one"""
    if len(merge_request.segment_ids) < 2:
        raise HTTPException(status_code=400, detail="At least 2 segments required for merge")
    
    segments = db.query(OutlinerSegment).filter(
        OutlinerSegment.id.in_(merge_request.segment_ids)
    ).order_by(OutlinerSegment.segment_index).all()
    
    if len(segments) != len(merge_request.segment_ids):
        raise HTTPException(status_code=404, detail="One or more segments not found")
    
    # Check all segments belong to same document
    document_id = segments[0].document_id
    if not all(seg.document_id == document_id for seg in segments):
        raise HTTPException(status_code=400, detail="All segments must belong to same document")
    
    # Merge text and metadata
    merged_text = "".join(seg.text for seg in segments)
    merged_title = next((seg.title for seg in segments if seg.title), None)
    merged_author = next((seg.author for seg in segments if seg.author), None)
    merged_title_bdrc_id = next((seg.title_bdrc_id for seg in segments if seg.title_bdrc_id), None)
    merged_author_bdrc_id = next((seg.author_bdrc_id for seg in segments if seg.author_bdrc_id), None)
    merged_parent_id = segments[0].parent_segment_id
    
    # Update first segment with merged data
    first_segment = segments[0]
    first_segment.text = merged_text
    first_segment.span_end = segments[-1].span_end
    first_segment.title = merged_title
    first_segment.author = merged_author
    first_segment.title_bdrc_id = merged_title_bdrc_id
    first_segment.author_bdrc_id = merged_author_bdrc_id
    first_segment.parent_segment_id = merged_parent_id
    first_segment.update_annotation_status()
    
    # Delete other segments and update indices
    segment_indices_to_delete = [seg.segment_index for seg in segments[1:]]
    for seg in segments[1:]:
        db.delete(seg)
    
    # Update indices of following segments
    following_segments = db.query(OutlinerSegment).filter(
        OutlinerSegment.document_id == document_id,
        OutlinerSegment.segment_index > first_segment.segment_index
    ).all()
    
    shift_amount = len(segments) - 1
    for seg in following_segments:
        seg.segment_index -= shift_amount
    
    update_document_progress(db, document_id)
    db.commit()
    db.refresh(first_segment)

    comments_list = _get_comments_list(first_segment)
    return SegmentResponse(
        id=first_segment.id,
        text=first_segment.text,
        segment_index=first_segment.segment_index,
        span_start=first_segment.span_start,
        span_end=first_segment.span_end,
        title=first_segment.title,
        author=first_segment.author,
        title_bdrc_id=first_segment.title_bdrc_id,
        author_bdrc_id=first_segment.author_bdrc_id,
        parent_segment_id=first_segment.parent_segment_id,
        is_annotated=first_segment.is_annotated,
        is_attached=first_segment.is_attached,
        status=first_segment.status,
        comments=comments_list,
        created_at=first_segment.created_at,
        updated_at=first_segment.updated_at
    )


@router.delete("/segments/{segment_id}", status_code=204)
async def delete_segment(
    segment_id: str,
    db: Session = Depends(get_db)
):
    """Delete a segment"""
    segment = db.query(OutlinerSegment).filter(OutlinerSegment.id == segment_id).first()
    if not segment:
        raise HTTPException(status_code=404, detail="Segment not found")
    
    document_id = segment.document_id
    segment_index = segment.segment_index
    
    db.delete(segment)
    
    # Update indices of following segments
    following_segments = db.query(OutlinerSegment).filter(
        OutlinerSegment.document_id == document_id,
        OutlinerSegment.segment_index > segment_index
    ).all()
    
    for seg in following_segments:
        seg.segment_index -= 1
    
    update_document_progress(db, document_id)
    db.commit()
    return None


# ==================== Comment Endpoints ====================

def _get_comments_list(segment: OutlinerSegment) -> List[Dict[str, Any]]:
    """Helper function to extract comments list from segment.comment field"""
    import json
    if not segment.comment:
        return []
    
    try:
        # New format: comments are stored directly as an array
        if isinstance(segment.comment, list):
            # Return a copy to avoid mutating the original list
            return list(segment.comment)
        
        # Handle string format (backward compatibility)
        if isinstance(segment.comment, str):
            try:
                parsed = json.loads(segment.comment)
                if isinstance(parsed, list):
                    return parsed
                elif isinstance(parsed, dict) and isinstance(parsed.get('comments'), list):
                    return parsed['comments']
                else:
                    return [{"content": segment.comment, "username": "Unknown", "timestamp": datetime.utcnow().isoformat()}]
            except json.JSONDecodeError:
                return [{"content": segment.comment, "username": "Unknown", "timestamp": datetime.utcnow().isoformat()}]
        
        # Handle dict format (backward compatibility)
        if isinstance(segment.comment, dict) and isinstance(segment.comment.get('comments'), list):
            return segment.comment['comments']
            
    except Exception:
        return [{"content": str(segment.comment), "username": "Unknown", "timestamp": datetime.utcnow().isoformat()}]
    
    return []


@router.get("/segments/{segment_id}/comment", response_model=List[CommentResponse])
async def get_segment_comments(
    segment_id: str,
    db: Session = Depends(get_db)
):
    """Get all comments for a segment"""
    segment = db.query(OutlinerSegment).filter(OutlinerSegment.id == segment_id).first()
    if not segment:
        raise HTTPException(status_code=404, detail="Segment not found")
    
    comments_list = _get_comments_list(segment)
    return [CommentResponse(**c) for c in comments_list]


@router.post("/segments/{segment_id}/comment", response_model=List[CommentResponse])
async def add_segment_comment(
    segment_id: str,
    comment: CommentAdd,
    db: Session = Depends(get_db)
):
    """Add a comment to a segment"""
    segment = db.query(OutlinerSegment).filter(OutlinerSegment.id == segment_id).first()
    
    if not segment:
        raise HTTPException(status_code=404, detail="Segment not found")
    
    # Get existing comments (returns a copy of the list)
    existing_comments = _get_comments_list(segment)
    
    # Add new comment
    new_comment = {
        "content": comment.content,
        "username": comment.username,
        "timestamp": datetime.utcnow().isoformat()
    }
    existing_comments.append(new_comment)
    
    # Update segment comment field - store as array directly
    segment.comment = existing_comments
    # Explicitly mark the JSON field as modified so SQLAlchemy detects the change
    flag_modified(segment, "comment")
    segment.updated_at = datetime.utcnow()
    
    db.commit()
    db.refresh(segment)
    
    return [CommentResponse(**c) for c in existing_comments]


@router.put("/segments/{segment_id}/comment/{comment_index}", response_model=List[CommentResponse])
async def update_segment_comment(
    segment_id: str,
    comment_index: int,
    comment_update: CommentUpdate,
    db: Session = Depends(get_db)
):
    """Update a specific comment by index"""
    segment = db.query(OutlinerSegment).filter(OutlinerSegment.id == segment_id).first()
    if not segment:
        raise HTTPException(status_code=404, detail="Segment not found")
    
    comments_list = _get_comments_list(segment)
    
    if comment_index < 0 or comment_index >= len(comments_list):
        raise HTTPException(status_code=404, detail="Comment not found")
    
    # Update the comment
    comments_list[comment_index]["content"] = comment_update.content
    comments_list[comment_index]["timestamp"] = datetime.utcnow().isoformat()
    
    # Update segment comment field - store as array directly
    segment.comment = comments_list
    # Explicitly mark the JSON field as modified so SQLAlchemy detects the change
    flag_modified(segment, "comment")
    segment.updated_at = datetime.utcnow()
    
    db.commit()
    db.refresh(segment)
    
    return [CommentResponse(**c) for c in comments_list]


@router.delete("/segments/{segment_id}/comment/{comment_index}", response_model=List[CommentResponse])
async def delete_segment_comment(
    segment_id: str,
    comment_index: int,
    db: Session = Depends(get_db)
):
    """Delete a specific comment by index"""
    segment = db.query(OutlinerSegment).filter(OutlinerSegment.id == segment_id).first()
    if not segment:
        raise HTTPException(status_code=404, detail="Segment not found")
    
    comments_list = _get_comments_list(segment)
    
    if comment_index < 0 or comment_index >= len(comments_list):
        raise HTTPException(status_code=404, detail="Comment not found")
    
    # Remove the comment
    comments_list.pop(comment_index)
    
    # Update segment comment field (or set to None if no comments left) - store as array directly
    if len(comments_list) == 0:
        segment.comment = None
    else:
        segment.comment = comments_list
        # Explicitly mark the JSON field as modified so SQLAlchemy detects the change
        flag_modified(segment, "comment")
    
    segment.updated_at = datetime.utcnow()
    
    db.commit()
    db.refresh(segment)
    
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
    # Verify document exists and get content from cache if available
    document = get_document_with_cache(db, document_id)
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")
    
    result_segments = []
    
    # Process deletions first
    if operations.delete:
        segments_to_delete = db.query(OutlinerSegment).filter(
            OutlinerSegment.id.in_(operations.delete),
            OutlinerSegment.document_id == document_id
        ).all()
        
        if len(segments_to_delete) != len(operations.delete):
            found_ids = {seg.id for seg in segments_to_delete}
            missing_ids = set(operations.delete) - found_ids
            raise HTTPException(
                status_code=404,
                detail=f"Some segments not found: {list(missing_ids)}"
            )
        
        # Get segment indices to update after deletion
        deleted_indices = {seg.segment_index for seg in segments_to_delete}
        max_deleted_index = max(deleted_indices) if deleted_indices else -1
        
        # Delete segments
        for seg in segments_to_delete:
            db.delete(seg)
        
        # Update indices of following segments
        if max_deleted_index >= 0:
            following_segments = db.query(OutlinerSegment).filter(
                OutlinerSegment.document_id == document_id,
                OutlinerSegment.segment_index > max_deleted_index
            ).all()
            
            shift_amount = len(segments_to_delete)
            for seg in following_segments:
                seg.segment_index -= shift_amount
    
    # Process updates
    if operations.update:
        segment_updates = {update.get('id'): update for update in operations.update if 'id' in update}
        segment_ids_to_update = list(segment_updates.keys())
        
        segments_to_update = db.query(OutlinerSegment).filter(
            OutlinerSegment.id.in_(segment_ids_to_update),
            OutlinerSegment.document_id == document_id
        ).all()
        
        if len(segments_to_update) != len(segment_ids_to_update):
            found_ids = {seg.id for seg in segments_to_update}
            missing_ids = set(segment_ids_to_update) - found_ids
            raise HTTPException(
                status_code=404,
                detail=f"Some segments not found for update: {list(missing_ids)}"
            )
        
        for segment in segments_to_update:
            update_data = segment_updates[segment.id]
            
            # Update fields if provided
            if 'text' in update_data and update_data['text'] is not None:
                segment.text = update_data['text']
            if 'title' in update_data and update_data['title'] is not None:
                segment.title = update_data['title']
            if 'author' in update_data and update_data['author'] is not None:
                segment.author = update_data['author']
            if 'title_bdrc_id' in update_data and update_data['title_bdrc_id'] is not None:
                segment.title_bdrc_id = update_data['title_bdrc_id']
            if 'author_bdrc_id' in update_data and update_data['author_bdrc_id'] is not None:
                segment.author_bdrc_id = update_data['author_bdrc_id']
            if 'parent_segment_id' in update_data and update_data['parent_segment_id'] is not None:
                segment.parent_segment_id = update_data['parent_segment_id']
            if 'is_attached' in update_data and update_data['is_attached'] is not None:
                segment.is_attached = update_data['is_attached']
            if 'status' in update_data and update_data['status'] is not None:
                if update_data['status'] not in ['checked', 'unchecked']:
                    raise HTTPException(
                        status_code=400,
                        detail=f"Invalid status: {update_data['status']}. Must be 'checked' or 'unchecked'"
                    )
                segment.status = update_data['status']
            if 'span_start' in update_data and update_data['span_start'] is not None:
                segment.span_start = update_data['span_start']
            if 'span_end' in update_data and update_data['span_end'] is not None:
                segment.span_end = update_data['span_end']
            if 'segment_index' in update_data and update_data['segment_index'] is not None:
                segment.segment_index = update_data['segment_index']
            
            segment.update_annotation_status()
            segment.updated_at = datetime.utcnow()
            result_segments.append(segment)
    
    # Process creates
    if operations.create:
        # Get current max segment_index to ensure proper ordering
        max_index = db.query(func.max(OutlinerSegment.segment_index)).filter(
            OutlinerSegment.document_id == document_id
        ).scalar() or -1
        
        new_segments = []
        for idx, segment_data in enumerate(operations.create):
            # If segment_index is not provided or needs adjustment, calculate it
            segment_index = segment_data.segment_index if segment_data.segment_index is not None else max_index + idx + 1
            
            # Extract text from document content using span addresses if text not provided
            segment_text = segment_data.text
            if not segment_text:
                if segment_data.span_start < 0 or segment_data.span_end > len(document.content):
                    raise HTTPException(status_code=400, detail=f"Invalid span addresses for segment at index {segment_index}")
                segment_text = document.content[segment_data.span_start:segment_data.span_end]
            
            db_segment = OutlinerSegment(
                id=str(uuid.uuid4()),
                document_id=document_id,
                text=segment_text,
                segment_index=segment_index,
                span_start=segment_data.span_start,
                span_end=segment_data.span_end,
                title=segment_data.title,
                author=segment_data.author,
                title_bdrc_id=segment_data.title_bdrc_id,
                author_bdrc_id=segment_data.author_bdrc_id,
                parent_segment_id=segment_data.parent_segment_id,
                status='unchecked'  # Default to unchecked
            )
            db_segment.update_annotation_status()
            new_segments.append(db_segment)
            db.add(db_segment)
        
        result_segments.extend(new_segments)
    
    # Update document progress
    update_document_progress(db, document_id)
    
    # Commit all changes in a single transaction
    db.commit()
    
    # Refresh all segments
    for seg in result_segments:
        db.refresh(seg)
    
    return result_segments


@router.delete("/documents/{document_id}/segments/reset", status_code=204)
async def reset_segments(
    document_id: str,
    db: Session = Depends(get_db)
):
    """Delete all segments for a document"""
    document = db.query(OutlinerDocument).filter(OutlinerDocument.id == document_id).first()
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")
    
    # Delete all segments for this document
    db.query(OutlinerSegment).filter(OutlinerSegment.document_id == document_id).delete()
    
    # Update document progress
    update_document_progress(db, document_id)
    db.commit()
    return None


class DocumentStatusUpdate(BaseModel):
    status: str


class SegmentStatusUpdate(BaseModel):
    status: str


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
    status = status_update.status
    # Validate status value
    valid_statuses = ['active', 'completed', 'deleted', 'approved', 'rejected']
    if status not in valid_statuses:
        raise HTTPException(
            status_code=400,
            detail=f"Status must be one of: {', '.join(valid_statuses)}"
        )
    
    document = db.query(OutlinerDocument).filter(OutlinerDocument.id == document_id).first()
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")
    
    # If restoring a deleted document (changing to 'active'), verify ownership
    if document.status == 'deleted' and status == 'active':
        if not user_id:
            raise HTTPException(
                status_code=400,
                detail="user_id parameter is required to restore a deleted document"
            )
        if document.user_id != user_id:
            raise HTTPException(
                status_code=403,
                detail="You can only restore documents that belong to you"
            )
    
    document.status = status
    document.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(document)
    
    return {"message": "Document status updated", "document_id": document_id, "status": status}


@router.put("/segments/{segment_id}/status")
async def update_segment_status(
    segment_id: str,
    status_update: SegmentStatusUpdate,
    db: Session = Depends(get_db)
):
    """Update segment status (checked/unchecked)"""
    status = status_update.status
    # Validate status value
    if status not in ['checked', 'unchecked','approved']:
        raise HTTPException(status_code=400, detail="Status must be 'checked' or 'unchecked'")
    
    segment = db.query(OutlinerSegment).filter(OutlinerSegment.id == segment_id).first()
    if not segment:
        raise HTTPException(status_code=404, detail="Segment not found")
    
    segment.status = status
    segment.updated_at = datetime.utcnow()
    
    update_document_progress(db, segment.document_id)
    db.commit()
    db.refresh(segment)
    
    return {"message": "Segment status updated", "segment_id": segment_id, "status": status}


@router.get("/documents/{document_id}/progress")
async def get_document_progress(
    document_id: str,
    db: Session = Depends(get_db)
):
    """Get progress statistics for a document"""
    document = db.query(OutlinerDocument).filter(OutlinerDocument.id == document_id).first()
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")
    
    # Count checked and unchecked segments
    checked = db.query(func.count(OutlinerSegment.id)).filter(
        OutlinerSegment.document_id == document_id,
        OutlinerSegment.status == 'checked'
    ).scalar()
    
    unchecked = db.query(func.count(OutlinerSegment.id)).filter(
        OutlinerSegment.document_id == document_id,
        OutlinerSegment.status == 'unchecked'
    ).scalar()
    
    return {
        "document_id": document_id,
        "total_segments": document.total_segments,
        "annotated_segments": document.annotated_segments,
        "checked_segments": checked or 0,
        "unchecked_segments": unchecked or 0,
        "progress_percentage": document.progress_percentage,
        "updated_at": document.updated_at
    }