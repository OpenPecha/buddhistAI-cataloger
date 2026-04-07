"""
Controller for outliner document and segment operations.
"""
import logging
import uuid
from pathlib import Path
from typing import List, Optional, Dict, Any
from datetime import datetime
from fastapi import HTTPException
from sqlalchemy.orm import Session
from sqlalchemy.orm.attributes import flag_modified
from sqlalchemy import func, case, or_, and_, exists
from sqlalchemy.orm.session import identity
from outliner.models.outliner import OutlinerDocument, OutlinerSegment, SegmentRejection, SegmentLabels
from outliner.utils.segment_title_author_auto import (
    apply_auto_author_to_segment,
    apply_auto_title_to_segment,
)
from user.models.user import User
from core.redis import invalidate_document_content_cache
from outliner.utils.outliner_utils import (
    get_document_with_cache,
    incremental_update_document_progress,
    get_annotation_status_delta,
    get_comments_list,
    remove_escape_chars_except_newline,
    set_document_content_in_cache,
    validate_segment_status_transition,
)

logger = logging.getLogger(__name__)

# BDRC bulk sync progress: append-only log next to backend package (backend/sync_status.txt).
_SYNC_STATUS_LOG_PATH = Path(__file__).resolve().parents[2] / "sync_status.txt"


def _bdrc_bulk_sync_file_logger() -> logging.Logger:
    """Logger that writes BDRC bulk sync progress to sync_status.txt (handlers attached once)."""
    log = logging.getLogger("outliner.bdrc_bulk_sync_status")
    log.setLevel(logging.INFO)
    if not log.handlers:
        fh = logging.FileHandler(_SYNC_STATUS_LOG_PATH, encoding="utf-8", mode="a")
        fh.setFormatter(
            logging.Formatter("%(asctime)s %(levelname)s %(message)s", datefmt="%Y-%m-%d %H:%M:%S")
        )
        log.addHandler(fh)
    log.propagate = False
    return log


# ==================== Document Operations ====================

def create_document(
    db: Session,
    content: str,
    filename: Optional[str] = None,
    user_id: Optional[str] = None
) -> OutlinerDocument:
    """Create a new outliner document with full text content"""
    db_document = OutlinerDocument(
        id=str(uuid.uuid4()),
        content=content,
        filename=filename,
        user_id=user_id,
        status='active',
    )
    db.add(db_document)
    db.commit()
    db.refresh(db_document)
    
    # Cache the new document content
    set_document_content_in_cache(db_document.id, db_document.content)
    
    return db_document


def upload_document(
    db: Session,
    file_content: Optional[str] = None,
    content: Optional[str] = None,
    filename: Optional[str] = None,
    user_id: Optional[str] = None
) -> OutlinerDocument:
    """Upload a text file or text content to create a new outliner document"""
    text_content = None
    document_filename = None
    
    # Try to get file content first
    if file_content:
        text_content_temp = file_content
        text_content = remove_escape_chars_except_newline(text_content_temp)
        document_filename = filename
    
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
    
    return create_document(db, text_content, document_filename, user_id)


def list_documents(
    db: Session,
    user_id: Optional[str] = None,
    status: Optional[str] = None,
    skip: int = 0,
    limit: int = 100,
    include_deleted: bool = False,
    title: Optional[str] = None,
) -> List[Dict[str, Any]]:
    """
    List all outliner documents, optionally filtered by user, status, and deletion status.

    Args:
        db: Database session
        user_id: Filter documents by user ID
        status: Filter documents by status (active, completed, approved, etc.)
        skip: Number of documents to skip (pagination)
        limit: Maximum number of documents to return
        include_deleted: If False (default), exclude deleted documents. If True, include all documents.
        title: If set, case-insensitive substring match on document filename (list UI title).
    """
    query = db.query(OutlinerDocument)
    if user_id:
        query = query.filter(OutlinerDocument.user_id == user_id)

    if status:
        query = query.filter(OutlinerDocument.status == status)

    if title and title.strip():
        escaped = (
            title.strip()
            .replace("\\", "\\\\")
            .replace("%", "\\%")
            .replace("_", "\\_")
        )
        query = query.filter(OutlinerDocument.filename.ilike(f"%{escaped}%", escape="\\"))

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
            OutlinerSegment.status != 'checked'
        ).scalar() or 0
        
        total = db.query(func.count(OutlinerSegment.id)).filter(
            OutlinerSegment.document_id == doc.id
        ).scalar() or 0
        
        annotated = db.query(func.count(OutlinerSegment.id)).filter(
            OutlinerSegment.document_id == doc.id,
            OutlinerSegment.is_annotated == True
        ).scalar() or 0

        rejection_count = (
            db.query(func.count(OutlinerSegment.id))
            .filter(
                OutlinerSegment.document_id == doc.id,
                OutlinerSegment.status == "rejected",
            )
            .scalar()
        ) or 0

        result.append({
            "id": doc.id,
            "filename": doc.filename,
            "user_id": doc.user_id,
            "checked_segments": checked,
            "unchecked_segments": unchecked,
            "total_segments": total,
            "annotated_segments": annotated,
            "rejection_count": rejection_count,
            "progress_percentage": (annotated / total) * 100 if total > 0 else 0,
            "status": doc.status,
            "created_at": doc.created_at,
            "updated_at": doc.updated_at,
        })
    
    return result


def get_document(
    db: Session,
    document_id: str,
    include_segments: bool = True
) -> OutlinerDocument:
    """Get a document by ID with all its segments"""
    document = get_document_with_cache(db, document_id)
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")
    
    if include_segments:
        # Load only selected fields for each segment (include text so response does not rely on lazy-loaded relationship)
        segments = db.query(
            OutlinerSegment.id,
            OutlinerSegment.text,
            OutlinerSegment.segment_index,
            OutlinerSegment.span_start,
            OutlinerSegment.span_end,
            OutlinerSegment.title,
            OutlinerSegment.title_span_start,
            OutlinerSegment.title_span_end,
            OutlinerSegment.updated_title,
            OutlinerSegment.author,
            OutlinerSegment.author_span_start,
            OutlinerSegment.author_span_end,
            OutlinerSegment.updated_author,
            OutlinerSegment.title_bdrc_id,
            OutlinerSegment.author_bdrc_id,
            OutlinerSegment.parent_segment_id,
            OutlinerSegment.is_annotated,
            OutlinerSegment.is_attached,
            OutlinerSegment.status,
            OutlinerSegment.is_supplied_title,
            OutlinerSegment.label,
        ).filter(
            OutlinerSegment.document_id == document_id
        ).order_by(OutlinerSegment.segment_index).all()
        # Store as segment_list so router can serialize without touching document.segments (avoids lazy-load timing issues in production)
        def _segment_to_dict(segment):
            d = segment._asdict()
            d['label'] = segment.label.name if segment.label else None
            return d
        document.segment_list = [_segment_to_dict(segment) for segment in segments]

    return document

def get_document_by_filename(db: Session, filename: str) -> OutlinerDocument:
    """Get a document by filename"""
    document = db.query(OutlinerDocument).filter(OutlinerDocument.filename == filename).first()
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")
    return document

def update_document_content(
    db: Session,
    document_id: str,
    content: str
) -> Dict[str, str]:
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


def delete_document(db: Session, document_id: str) -> None:
    """Delete a document and all its segments"""
    document = db.query(OutlinerDocument).filter(OutlinerDocument.id == document_id).first()
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")
    
    db.delete(document)
    db.commit()
    
    # Invalidate cache when document is deleted
    invalidate_document_content_cache(document_id)


def update_document_status(
    db: Session,
    document_id: str,
    status: str,
    user_id: Optional[str] = None
) -> Dict[str, str]:
    """
    Update document status.
    
    When restoring a deleted document (changing status from 'deleted' to 'active'),
    the user_id parameter must be provided and must match the document's user_id
    to ensure only the document owner can restore it.
    """
    # Validate status value
    valid_statuses = ['active', 'completed', 'deleted', 'approved', 'rejected','skipped']
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


def get_document_progress(db: Session, document_id: str) -> Dict[str, Any]:
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
        "checked_segments": checked or 0,
        "unchecked_segments": unchecked or 0,
        "updated_at": document.updated_at
    }


def reset_segments(db: Session, document_id: str) -> None:
    """Delete all segments for a document"""
    document = db.query(OutlinerDocument).filter(OutlinerDocument.id == document_id).first()
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")
    
    # Delete all segments for this document
    db.query(OutlinerSegment).filter(OutlinerSegment.document_id == document_id).delete()
    
    db.commit()


# ==================== Segment Operations ====================

def create_segment(
    db: Session,
    document_id: str,
    segment_index: int,
    span_start: int,
    span_end: int,
    text: Optional[str] = None,
    title: Optional[str] = None,
    author: Optional[str] = None,
    title_bdrc_id: Optional[str] = None,
    author_bdrc_id: Optional[str] = None,
    parent_segment_id: Optional[str] = None
) -> OutlinerSegment:
    """Create a new segment in a document"""
    # Verify document exists and get content from cache if available
    document = get_document_with_cache(db, document_id)
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")
    
    # Extract text from document content using span addresses if text not provided
    segment_text = text
    if not segment_text:
        if span_start < 0 or span_end > len(document.content):
            raise HTTPException(status_code=400, detail="Invalid span addresses")
        segment_text = document.content[span_start:span_end]
    
    db_segment = OutlinerSegment(
        id=str(uuid.uuid4()),
        document_id=document_id,
        text=segment_text,
        segment_index=segment_index,
        span_start=span_start,
        span_end=span_end,
        title=title,
        author=author,
        title_bdrc_id=title_bdrc_id,
        author_bdrc_id=author_bdrc_id,
        parent_segment_id=parent_segment_id,
        status='unchecked'  # Default to unchecked
    )
    db_segment.update_annotation_status()
    
    db.add(db_segment)
    db.commit()
    db.refresh(db_segment)
    
    return db_segment


def create_segments_bulk(
    db: Session,
    document_id: str,
    segments_data: List[Dict[str, Any]]
) -> List[OutlinerSegment]:
    """Create multiple segments at once"""
    document = get_document_with_cache(db, document_id)
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")
    
    db_segments = []
    for segment_data in segments_data:
        # Extract text from document content using span addresses if text not provided
        segment_text = segment_data.get('text')
        if not segment_text:
            span_start = segment_data['span_start']
            span_end = segment_data['span_end']
            if span_start < 0 or span_end > len(document.content):
                raise HTTPException(status_code=400, detail=f"Invalid span addresses for segment at index {segment_data['segment_index']}")
            segment_text = document.content[span_start:span_end]
        
        is_karchak=segment_text.__contains__("དཀར་ཆག")
        if is_karchak:
            label=SegmentLabels.TOC
        else:
            label=SegmentLabels.TEXT
        db_segment = OutlinerSegment(
            id=str(uuid.uuid4()),
            document_id=document_id,
            text=segment_text,
            segment_index=segment_data['segment_index'],
            span_start=segment_data['span_start'],
            span_end=segment_data['span_end'],
            title=segment_data.get('title'),
            label=label,
            author=segment_data.get('author'),
            title_bdrc_id=segment_data.get('title_bdrc_id'),
            author_bdrc_id=segment_data.get('author_bdrc_id'),
            parent_segment_id=segment_data.get('parent_segment_id'),
            status='unchecked'  # Default to unchecked
        )
        db_segment.update_annotation_status()
        db_segments.append(db_segment)
        db.add(db_segment)
    
    db.commit()

    for seg in db_segments:
        db.refresh(seg)

    return db_segments


def list_segments(db: Session, document_id: str) -> List[OutlinerSegment]:
    """Get all segments for a document"""
    segments = db.query(OutlinerSegment).filter(
        OutlinerSegment.document_id == document_id
    ).order_by(OutlinerSegment.segment_index).all()
    return segments


def get_segment(db: Session, segment_id: str) -> OutlinerSegment:
    """Get a single segment by ID"""
    segment = db.query(OutlinerSegment).filter(OutlinerSegment.id == segment_id).first()
    if not segment:
        raise HTTPException(status_code=404, detail="Segment not found")
    return segment


def update_segment(
    db: Session,
    segment_id: str,
    patch: Dict[str, Any],
) -> OutlinerSegment:
    """
    PERFORMANCE OPTIMIZED: Update a segment's content or annotations.

    ``patch`` is a partial update (e.g. from Pydantic ``model_dump(exclude_unset=True)``).
    Keys present in ``patch`` are applied, including explicit nulls to clear nullable fields.

    Optimizations:
    1. Single SELECT to get segment (with old annotation status)
    2. Incremental document progress update (no COUNT queries)
    3. Avoid db.refresh() by using already-updated ORM object
    4. Single transaction commit
    """
    # PERFORMANCE FIX #1: Single SELECT to get segment with current state
    segment = db.query(OutlinerSegment).filter(OutlinerSegment.id == segment_id).first()
    if not segment:
        raise HTTPException(status_code=404, detail="Segment not found")

    old_label = segment.label

    # Track old annotation status for incremental update
    old_is_annotated = segment.is_annotated
    document_id = segment.document_id  # Store before updates

    if "text" in patch:
        segment.text = patch["text"]
    if "title" in patch:
        segment.title = patch["title"]
    if "author" in patch:
        segment.author = patch["author"]
    if "title_bdrc_id" in patch:
        segment.title_bdrc_id = patch["title_bdrc_id"]
    if "author_bdrc_id" in patch:
        segment.author_bdrc_id = patch["author_bdrc_id"]
    if "parent_segment_id" in patch:
        segment.parent_segment_id = patch["parent_segment_id"]
    if "is_attached" in patch:
        segment.is_attached = patch["is_attached"]
    if "comment" in patch:
        # Backward compatibility: if old comment format is used, convert to new format
        segment.comment = patch["comment"]
    # Handle new comment format: append comment with username
    if patch.get("comment_content") is not None and patch.get("comment_username") is not None:
        # Get existing comments using helper function
        existing_comments = get_comments_list(segment)

        # Append new comment
        new_comment = {
            "content": patch["comment_content"],
            "username": patch["comment_username"],
            "timestamp": datetime.utcnow().isoformat()
        }
        existing_comments.append(new_comment)

        # Store as array directly
        segment.comment = existing_comments
    if "status" in patch:
        status = patch["status"]
        is_valid, error_msg = validate_segment_status_transition(segment.status, status)
        if not is_valid:
            raise HTTPException(status_code=422, detail=error_msg)
        segment.status = status
    if "label" in patch:
        label = patch["label"]
        if label is not None:
            try:
                segment.label = SegmentLabels[label]
            except KeyError:
                raise HTTPException(
                    status_code=422,
                    detail=f"Invalid label. Must be one of: {', '.join(s.name for s in SegmentLabels)}"
                )
        else:
            segment.label = None
    if "is_supplied_title" in patch:
        segment.is_supplied_title = patch["is_supplied_title"]
    if "title_span_start" in patch:
        segment.title_span_start = patch["title_span_start"]
    if "title_span_end" in patch:
        segment.title_span_end = patch["title_span_end"]
    if "updated_title" in patch:
        segment.updated_title = patch["updated_title"]
    if "author_span_start" in patch:
        segment.author_span_start = patch["author_span_start"]
    if "author_span_end" in patch:
        segment.author_span_end = patch["author_span_end"]
    if "updated_author" in patch:
        segment.updated_author = patch["updated_author"]

    # Server-side title/author when label becomes TEXT (no extra client PUT)
    label_became_text = (
        "label" in patch
        and patch.get("label") == "TEXT"
        and old_label != SegmentLabels.TEXT
    )
    user_nonempty_title = (
        "title" in patch
        and patch.get("title") is not None
        and str(patch.get("title")).strip() != ""
    )
    # Title only when label becomes TEXT (author runs when a following segment is created, e.g. split)
    if label_became_text and not user_nonempty_title:
        apply_auto_title_to_segment(db, segment)

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
    
    return segment


def update_segments_bulk(
    db: Session,
    segment_updates: List[Dict[str, Any]],
    segment_ids: List[str]
) -> List[OutlinerSegment]:
    """Update multiple segments at once"""
    if len(segment_updates) != len(segment_ids):
        raise HTTPException(
            status_code=400,
            detail="Number of segments must match number of segment_ids"
        )
    
    updated_segments = []
    document_ids = set()
    
    for segment_id, segment_update in zip(segment_ids, segment_updates):
        segment = db.query(OutlinerSegment).filter(OutlinerSegment.id == segment_id).first()
        if not segment:
            continue

        old_label = segment.label
        
        document_ids.add(segment.document_id)
        
        if 'text' in segment_update:
            segment.text = segment_update['text']
        if 'title' in segment_update:
            segment.title = segment_update['title']
        if 'author' in segment_update:
            segment.author = segment_update['author']
        if 'title_bdrc_id' in segment_update:
            segment.title_bdrc_id = segment_update['title_bdrc_id']
        if 'author_bdrc_id' in segment_update:
            segment.author_bdrc_id = segment_update['author_bdrc_id']
        if 'parent_segment_id' in segment_update:
            segment.parent_segment_id = segment_update['parent_segment_id']
        if 'is_attached' in segment_update:
            segment.is_attached = segment_update['is_attached']
        if 'status' in segment_update:
            is_valid, _ = validate_segment_status_transition(segment.status, segment_update['status'])
            if not is_valid:
                continue
            segment.status = segment_update['status']
        if 'label' in segment_update:
            lbl = segment_update['label']
            if lbl is not None:
                try:
                    segment.label = SegmentLabels[lbl]
                except KeyError:
                    pass
            else:
                segment.label = None
        if 'is_supplied_title' in segment_update:
            segment.is_supplied_title = segment_update['is_supplied_title']
        for span_key in (
            'title_span_start', 'title_span_end', 'updated_title',
            'author_span_start', 'author_span_end', 'updated_author',
        ):
            if span_key in segment_update:
                setattr(segment, span_key, segment_update[span_key])

        label_became_text = (
            'label' in segment_update
            and segment.label == SegmentLabels.TEXT
            and old_label != SegmentLabels.TEXT
        )
        user_nonempty_title = (
            'title' in segment_update
            and segment_update.get('title') is not None
            and str(segment_update.get('title')).strip() != ''
        )
        if label_became_text and not user_nonempty_title:
            apply_auto_title_to_segment(db, segment)

        segment.update_annotation_status()
        segment.updated_at = datetime.utcnow()
        updated_segments.append(segment)
    
  
    
    db.commit()

    for seg in updated_segments:
        db.refresh(seg)

    return updated_segments


def split_segment(
    db: Session,
    segment_id: str,
    split_position: int,
    document_id: Optional[str] = None
) -> List[OutlinerSegment]:
    """Split a segment at a given position"""
    segment = db.query(OutlinerSegment).filter(OutlinerSegment.id == segment_id).first()
    
    # If segment doesn't exist, check if we need to create initial segment from document
    if not segment:
        # If document_id is provided, try to create initial segment from document content
        if document_id:
            document = get_document_with_cache(db, document_id)
            if not document:
                raise HTTPException(status_code=404, detail="Document not found")
            
            # Check if document has any segments
            existing_segments = db.query(OutlinerSegment).filter(
                OutlinerSegment.document_id == document_id
            ).count()
            
            # If no segments exist, create initial segment from document content
            if existing_segments == 0:
                if not document.content or len(document.content.strip()) == 0:
                    raise HTTPException(status_code=400, detail="Document has no content to split")
                
                # Create initial segment from full document content
                initial_segment = OutlinerSegment(
                    id=str(uuid.uuid4()),
                    document_id=document_id,
                    text=document.content,
                    segment_index=0,
                    span_start=0,
                    span_end=len(document.content),
                    title=None,
                    author=None,
                    parent_segment_id=None,
                    label=SegmentLabels.FRONT_MATTER,
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
    if split_position <= 0 or split_position >= len(segment.text):
        raise HTTPException(status_code=400, detail="Invalid split position")

    old_span_start = segment.span_start
    old_span_end = segment.span_end
    new_first_span_end = old_span_start + split_position

    # Safety check: split position must fall within the segment span
    if new_first_span_end < old_span_start or new_first_span_end > old_span_end:
        raise HTTPException(status_code=400, detail="Invalid split position for segment span")

    text_before = segment.text[:split_position]
    text_after = segment.text[split_position:]

    # Update first segment (preserve whitespace/newlines; update span_end using split_position)
    segment.text = text_before
    segment.span_end = new_first_span_end
    is_karchak = text_after.__contains__("དཀར་ཆག")
    if is_karchak:
        segment.label = SegmentLabels.FRONT_MATTER
        label = SegmentLabels.TOC
    else:
        label = SegmentLabels.TEXT

    # Upper segment: title from start only when labeled TEXT
    if segment.label == SegmentLabels.TEXT:
        apply_auto_title_to_segment(db, segment, skip_last_segment_check=True)
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
        label=label,
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
    # Author on upper segment (TEXT only) once the next segment exists
    if segment.label == SegmentLabels.TEXT:
        apply_auto_author_to_segment(db, segment, skip_last_segment_check=True)
    if new_segment.label == SegmentLabels.TEXT:
        apply_auto_title_to_segment(db, new_segment, skip_last_segment_check=True)
    segment.update_annotation_status()
    new_segment.update_annotation_status()
    db.commit()
    db.refresh(segment)
    db.refresh(new_segment)

    return [segment, new_segment]


def merge_segments(
    db: Session,
    segment_ids: List[str]
) -> OutlinerSegment:
    """Merge multiple segments into one"""
    if len(segment_ids) < 2:
        raise HTTPException(status_code=400, detail="At least 2 segments required for merge")
    
    segments = db.query(OutlinerSegment).filter(
        OutlinerSegment.id.in_(segment_ids)
    ).order_by(OutlinerSegment.segment_index).all()
    
    if len(segments) != len(segment_ids):
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
    
    # Get IDs of segments to be deleted (all except the first)
    segments_to_delete_ids = [seg.id for seg in segments[1:]]
    
    # Delete other segments and update indices
    for seg in segments[1:]:
        db.delete(seg)
    
    # Update indices of following segments (exclude segments being deleted)
    following_segments = db.query(OutlinerSegment).filter(
        OutlinerSegment.document_id == document_id,
        OutlinerSegment.segment_index > first_segment.segment_index,
        ~OutlinerSegment.id.in_(segments_to_delete_ids)  # Exclude segments being deleted
    ).all()
    
    shift_amount = len(segments) - 1
    for seg in following_segments:
        seg.segment_index -= shift_amount
    
    db.commit()
    db.refresh(first_segment)

    return first_segment


def delete_segment(db: Session, segment_id: str) -> None:
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
    
    db.commit()


def update_segment_status(
    db: Session,
    segment_id: str,
    status: str
) -> Dict[str, str]:
    """Update segment status with transition validation"""
    segment = db.query(OutlinerSegment).filter(OutlinerSegment.id == segment_id).first()
    if not segment:
        raise HTTPException(status_code=404, detail="Segment not found")
    
    is_valid, error_msg = validate_segment_status_transition(segment.status, status)
    if not is_valid:
        raise HTTPException(status_code=422, detail=error_msg)
    
    segment.status = status
    segment.updated_at = datetime.utcnow()
    
    db.commit()
    db.refresh(segment)
    
    return {"message": "Segment status updated", "segment_id": segment_id, "status": status}


def bulk_segment_operations(
    db: Session,
    document_id: str,
    create: Optional[List[Dict[str, Any]]] = None,
    update: Optional[List[Dict[str, Any]]] = None,
    delete: Optional[List[str]] = None
) -> List[OutlinerSegment]:
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
    if delete:
        segments_to_delete = db.query(OutlinerSegment).filter(
            OutlinerSegment.id.in_(delete),
            OutlinerSegment.document_id == document_id
        ).all()
        
        if len(segments_to_delete) != len(delete):
            found_ids = {seg.id for seg in segments_to_delete}
            missing_ids = set(delete) - found_ids
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
    if update:
        segment_updates = {update_item.get('id'): update_item for update_item in update if 'id' in update_item}
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
                is_valid, error_msg = validate_segment_status_transition(segment.status, update_data['status'])
                if not is_valid:
                    raise HTTPException(status_code=422, detail=error_msg)
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
    if create:
        # Get current max segment_index to ensure proper ordering
        max_index = db.query(func.max(OutlinerSegment.segment_index)).filter(
            OutlinerSegment.document_id == document_id
        ).scalar() or -1
        
        new_segments = []
        for idx, segment_data in enumerate(create):
            # If segment_index is not provided or needs adjustment, calculate it
            segment_index = segment_data.get('segment_index') if segment_data.get('segment_index') is not None else max_index + idx + 1
            
            # Extract text from document content using span addresses if text not provided
            segment_text = segment_data.get('text')
            if not segment_text:
                span_start = segment_data['span_start']
                span_end = segment_data['span_end']
                if span_start < 0 or span_end > len(document.content):
                    raise HTTPException(status_code=400, detail=f"Invalid span addresses for segment at index {segment_index}")
                segment_text = document.content[span_start:span_end]
            
            db_segment = OutlinerSegment(
                id=str(uuid.uuid4()),
                document_id=document_id,
                text=segment_text,
                segment_index=segment_index,
                span_start=segment_data['span_start'],
                span_end=segment_data['span_end'],
                title=segment_data.get('title'),
                author=segment_data.get('author'),
                title_bdrc_id=segment_data.get('title_bdrc_id'),
                author_bdrc_id=segment_data.get('author_bdrc_id'),
                parent_segment_id=segment_data.get('parent_segment_id'),
                status='unchecked'  # Default to unchecked
            )
            db_segment.update_annotation_status()
            new_segments.append(db_segment)
            db.add(db_segment)
        
        result_segments.extend(new_segments)
    
    
    # Commit all changes in a single transaction
    db.commit()
    
    # Refresh all segments
    for seg in result_segments:
        db.refresh(seg)
    
    return result_segments


# ==================== Comment Operations ====================

def get_segment_comments(db: Session, segment_id: str) -> List[Dict[str, Any]]:
    """Get all comments for a segment"""
    segment = db.query(OutlinerSegment).filter(OutlinerSegment.id == segment_id).first()
    if not segment:
        raise HTTPException(status_code=404, detail="Segment not found")
    
    comments_list = get_comments_list(segment)
    return comments_list


def add_segment_comment(
    db: Session,
    segment_id: str,
    content: str,
    username: str
) -> List[Dict[str, Any]]:
    """Add a comment to a segment"""
    segment = db.query(OutlinerSegment).filter(OutlinerSegment.id == segment_id).first()
    
    if not segment:
        raise HTTPException(status_code=404, detail="Segment not found")
    
    # Get existing comments (returns a copy of the list)
    existing_comments = get_comments_list(segment)
    
    # Add new comment
    new_comment = {
        "content": content,
        "username": username,
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
    
    return existing_comments


def update_segment_comment(
    db: Session,
    segment_id: str,
    comment_index: int,
    content: str
) -> List[Dict[str, Any]]:
    """Update a specific comment by index"""
    segment = db.query(OutlinerSegment).filter(OutlinerSegment.id == segment_id).first()
    if not segment:
        raise HTTPException(status_code=404, detail="Segment not found")
    
    comments_list = get_comments_list(segment)
    
    if comment_index < 0 or comment_index >= len(comments_list):
        raise HTTPException(status_code=404, detail="Comment not found")
    
    # Update the comment
    comments_list[comment_index]["content"] = content
    comments_list[comment_index]["timestamp"] = datetime.utcnow().isoformat()
    
    # Update segment comment field - store as array directly
    segment.comment = comments_list
    # Explicitly mark the JSON field as modified so SQLAlchemy detects the change
    flag_modified(segment, "comment")
    segment.updated_at = datetime.utcnow()
    
    db.commit()
    db.refresh(segment)
    
    return comments_list


def delete_segment_comment(
    db: Session,
    segment_id: str,
    comment_index: int
) -> List[Dict[str, Any]]:
    """Delete a specific comment by index"""
    segment = db.query(OutlinerSegment).filter(OutlinerSegment.id == segment_id).first()
    if not segment:
        raise HTTPException(status_code=404, detail="Segment not found")
    
    comments_list = get_comments_list(segment)
    
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
    
    return comments_list



# ==================== Rejection Operations ====================

def reject_segment(
    db: Session,
    segment_id: str,
    reviewer_id: Optional[str] = None
) -> OutlinerSegment:
    """Reject a checked segment and record the rejection event"""
    segment = db.query(OutlinerSegment).filter(OutlinerSegment.id == segment_id).first()
    if not segment:
        raise HTTPException(status_code=404, detail="Segment not found")
    
    is_valid, error_msg = validate_segment_status_transition(segment.status, "rejected")
    if not is_valid:
        raise HTTPException(status_code=422, detail=error_msg)
    
    document = db.query(OutlinerDocument).filter(OutlinerDocument.id == segment.document_id).first()
    annotator_id = document.user_id if document else None
    
    rejection = SegmentRejection(
        id=str(uuid.uuid4()),
        segment_id=segment_id,
        user_id=annotator_id,
        reviewer_id=reviewer_id,
    )
    db.add(rejection)
    
    segment.status = "rejected"
    segment.updated_at = datetime.utcnow()
    
    db.commit()
    db.refresh(segment)
    return segment


def reject_segments_bulk(
    db: Session,
    segment_ids: List[str],
    reviewer_id: Optional[str] = None
) -> List[OutlinerSegment]:
    """Reject multiple checked segments at once"""
    if not segment_ids:
        raise HTTPException(status_code=400, detail="segment_ids is required")
    
    segments = db.query(OutlinerSegment).filter(
        OutlinerSegment.id.in_(segment_ids)
    ).all()
    
    if not segments:
        raise HTTPException(status_code=404, detail="No segments found")
    
    doc_ids = {seg.document_id for seg in segments}
    documents = db.query(OutlinerDocument).filter(OutlinerDocument.id.in_(doc_ids)).all()
    doc_user_map = {doc.id: doc.user_id for doc in documents}
    
    rejected_segments = []
    for segment in segments:
        is_valid, _ = validate_segment_status_transition(segment.status, "rejected")
        if not is_valid:
            continue
        
        rejection = SegmentRejection(
            id=str(uuid.uuid4()),
            segment_id=segment.id,
            user_id=doc_user_map.get(segment.document_id),
            reviewer_id=reviewer_id,
        )
        db.add(rejection)
        segment.status = "rejected"
        segment.updated_at = datetime.utcnow()
        rejected_segments.append(segment)
    
    db.commit()
    for seg in rejected_segments:
        db.refresh(seg)
    
    return rejected_segments


def get_segment_rejection_count(db: Session, segment_id: str) -> int:
    """Get the number of times a segment has been rejected"""
    return db.query(func.count(SegmentRejection.id)).filter(
        SegmentRejection.segment_id == segment_id
    ).scalar() or 0


def get_annotator_performance_breakdown(
    db: Session,
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
) -> List[Dict[str, Any]]:
    """
    Per-annotator metrics for documents in the date range (ignores user_id filter).
    Scoped by document.created_at. user_id None = unassigned documents.
    """
    doc_filters = [
        (OutlinerDocument.status != "deleted") | (OutlinerDocument.status.is_(None))
    ]
    if start_date:
        doc_filters.append(OutlinerDocument.created_at >= start_date)
    if end_date:
        doc_filters.append(OutlinerDocument.created_at <= end_date)
    doc_scope = and_(*doc_filters)

    title_or_author = case(
        (
            or_(
                and_(OutlinerSegment.title.isnot(None), OutlinerSegment.title != ""),
                and_(OutlinerSegment.author.isnot(None), OutlinerSegment.author != ""),
            ),
            1,
        ),
        else_=0,
    )

    doc_rows = (
        db.query(OutlinerDocument.user_id, func.count(OutlinerDocument.id))
        .filter(doc_scope)
        .group_by(OutlinerDocument.user_id)
        .all()
    )
    seg_rows = (
        db.query(
            OutlinerDocument.user_id,
            func.count(OutlinerSegment.id),
            func.sum(title_or_author),
        )
        .join(OutlinerSegment, OutlinerSegment.document_id == OutlinerDocument.id)
        .filter(doc_scope)
        .group_by(OutlinerDocument.user_id)
        .all()
    )
    rej_rows = (
        db.query(OutlinerDocument.user_id, func.count(OutlinerSegment.id))
        .join(OutlinerSegment, OutlinerSegment.document_id == OutlinerDocument.id)
        .filter(doc_scope)
        .filter(OutlinerSegment.status == "rejected")
        .group_by(OutlinerDocument.user_id)
        .all()
    )

    by_user: Dict[Any, Dict[str, int]] = {}
    for uid, cnt in doc_rows:
        by_user.setdefault(uid, {"document_count": 0, "segment_count": 0, "segments_with_title_or_author": 0, "rejection_count": 0})
        by_user[uid]["document_count"] = int(cnt)
    for uid, seg_cnt, titled in seg_rows:
        by_user.setdefault(uid, {"document_count": 0, "segment_count": 0, "segments_with_title_or_author": 0, "rejection_count": 0})
        by_user[uid]["segment_count"] = int(seg_cnt)
        by_user[uid]["segments_with_title_or_author"] = int(titled or 0)
    for uid, rej_cnt in rej_rows:
        by_user.setdefault(uid, {"document_count": 0, "segment_count": 0, "segments_with_title_or_author": 0, "rejection_count": 0})
        by_user[uid]["rejection_count"] = int(rej_cnt)

    rows: List[Dict[str, Any]] = []
    for uid, m in by_user.items():
        rows.append(
            {
                "user_id": uid,
                "document_count": m["document_count"],
                "segment_count": m["segment_count"],
                "segments_with_title_or_author": m["segments_with_title_or_author"],
                "rejection_count": m["rejection_count"],
            }
        )
    rows.sort(key=lambda r: r["segment_count"], reverse=True)
    return rows


def get_dashboard_stats(
    db: Session,
    user_id: Optional[str] = None,
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
) -> Dict[str, Any]:
    """Aggregate dashboard statistics, optionally scoped by user and date range."""
    doc_query = db.query(OutlinerDocument.id).filter(
        (OutlinerDocument.status != "deleted") | (OutlinerDocument.status.is_(None))
    )
    if user_id:
        doc_query = doc_query.filter(OutlinerDocument.user_id == user_id)
    if start_date:
        doc_query = doc_query.filter(OutlinerDocument.created_at >= start_date)
    if end_date:
        doc_query = doc_query.filter(OutlinerDocument.created_at <= end_date)

    doc_ids_subq = doc_query.subquery()

    document_count = db.query(func.count()).select_from(doc_ids_subq).scalar() or 0

    seg_base = db.query(OutlinerSegment).filter(
        OutlinerSegment.document_id.in_(db.query(doc_ids_subq.c.id))
    )

    total_segments = seg_base.with_entities(func.count(OutlinerSegment.id)).scalar() or 0

    segments_with_title_or_author = seg_base.filter(
        (OutlinerSegment.title.isnot(None) & (OutlinerSegment.title != ""))
        | (OutlinerSegment.author.isnot(None) & (OutlinerSegment.author != ""))
    ).with_entities(func.count(OutlinerSegment.id)).scalar() or 0

    rejection_count = (
        seg_base.filter(OutlinerSegment.status == "rejected")
        .with_entities(func.count(OutlinerSegment.id))
        .scalar()
        or 0
    )

    doc_id_filter = OutlinerDocument.id.in_(db.query(doc_ids_subq.c.id))

    doc_status_rows = (
        db.query(OutlinerDocument.status, func.count(OutlinerDocument.id))
        .filter(doc_id_filter)
        .group_by(OutlinerDocument.status)
        .all()
    )
    document_status_counts: Dict[str, int] = {}
    for status_val, cnt in doc_status_rows:
        key = status_val if status_val else "unknown"
        document_status_counts[key] = int(cnt)

    doc_category_rows = (
        db.query(OutlinerDocument.category, func.count(OutlinerDocument.id))
        .filter(doc_id_filter)
        .group_by(OutlinerDocument.category)
        .all()
    )
    document_category_counts: Dict[str, int] = {}
    for cat_val, cnt in doc_category_rows:
        key = cat_val if cat_val else "uncategorized"
        document_category_counts[key] = int(cnt)

    seg_status_rows = (
        db.query(OutlinerSegment.status, func.count(OutlinerSegment.id))
        .filter(OutlinerSegment.document_id.in_(db.query(doc_ids_subq.c.id)))
        .group_by(OutlinerSegment.status)
        .all()
    )
    segment_status_counts: Dict[str, int] = {}
    for status_val, cnt in seg_status_rows:
        key = status_val if status_val else "unchecked"
        segment_status_counts[key] = int(cnt)

    label_rows = (
        db.query(OutlinerSegment.label, func.count(OutlinerSegment.id))
        .filter(OutlinerSegment.document_id.in_(db.query(doc_ids_subq.c.id)))
        .group_by(OutlinerSegment.label)
        .all()
    )
    segment_label_counts: Dict[str, int] = {}
    for label_val, cnt in label_rows:
        if label_val is not None:
            key = label_val.value if hasattr(label_val, "value") else str(label_val)
        else:
            key = "unset"
        segment_label_counts[key] = int(cnt)

    segments_with_bdrc_id = (
        seg_base.filter(
            (OutlinerSegment.title_bdrc_id.isnot(None) & (OutlinerSegment.title_bdrc_id != ""))
            | (
                OutlinerSegment.author_bdrc_id.isnot(None)
                & (OutlinerSegment.author_bdrc_id != "")
            )
        )
        .with_entities(func.count(OutlinerSegment.id))
        .scalar()
        or 0
    )

    segments_with_parent = (
        seg_base.filter(OutlinerSegment.parent_segment_id.isnot(None))
        .with_entities(func.count(OutlinerSegment.id))
        .scalar()
        or 0
    )

    segments_with_comments = (
        seg_base.filter(OutlinerSegment.comment.isnot(None))
        .with_entities(func.count(OutlinerSegment.id))
        .scalar()
        or 0
    )

    annotation_coverage_pct = (
        round((segments_with_title_or_author / total_segments) * 100, 1)
        if total_segments
        else 0.0
    )

    annotator_performance = get_annotator_performance_breakdown(
        db, start_date=start_date, end_date=end_date
    )

    return {
        "document_count": document_count,
        "total_segments": total_segments,
        "segments_with_title_or_author": segments_with_title_or_author,
        "rejection_count": rejection_count,
        "document_status_counts": document_status_counts,
        "document_category_counts": document_category_counts,
        "segment_status_counts": segment_status_counts,
        "segment_label_counts": segment_label_counts,
        "segments_with_bdrc_id": segments_with_bdrc_id,
        "segments_with_parent": segments_with_parent,
        "segments_with_comments": segments_with_comments,
        "annotation_coverage_pct": annotation_coverage_pct,
        "annotator_performance": annotator_performance,
    }


# ==================== BDRC Operations ====================

from bdrc.main import get_new_volume
from bdrc.volume import SegmentInput, VolumeInput, get_volume, update_volume, update_volume_status


def _bdrc_modified_by_from_document(db: Session, document: OutlinerDocument) -> Optional[str]:
    """BDRC OTAPI `modified_by`: prefer catalog user email, else user id (same pattern as frontend BDRC modals)."""
    if not document.user_id:
        return None
    user = db.query(User).filter(User.id == document.user_id).first()
    if not user:
        return None
    email = (user.email or "").strip()
    if email:
        return email
    return (user.id or "").strip() or None


async def assign_volume(db: Session, user_id: str) -> OutlinerDocument:
    """Assign a volume to a document"""
    volume_data = await get_new_volume()
    if volume_data is None:
        raise HTTPException(status_code=400, detail="No volume found")
    chunks = volume_data["chunks"]
    text = ""
    for chunk in chunks:
        if chunk["text_bo"] is not None:
            text += chunk["text_bo"]
            
    # create a new document with the text
    if text is None or user_id is None:
        raise HTTPException(status_code=400, detail="Text or user_id is required")
    # check if the document already exists
    volume_id = volume_data["id"]
    
    document = None
    try: 
        document =get_document_by_filename(db, volume_id)
    except Exception as e:
        print(f"document already exists: {e}")
    if document:
        raise HTTPException(status_code=400, detail="Document already exists with id: {document.id}")
    
    document = create_document(
            db=db,
            content=text,
            filename=volume_id,
            user_id=user_id
        )
   
    # update the volume status to "in_progress"
    await update_volume_status(volume_id, "in_progress")
    return document
    
    
    
    
    
# ==================== Approval Operations ====================

async def _push_document_segments_to_bdrc(
    document: OutlinerDocument,
    bdrc_status: str,
    modified_by: Optional[str] = None,
) -> Dict[str, Any]:
    """Sync document content and segments to BDRC OTAPI for the volume in document.filename."""
    if not document.filename or not str(document.filename).strip():
        raise HTTPException(
            status_code=400,
            detail="Document has no BDRC volume ID (filename); cannot sync to BDRC",
        )
    volume_id = str(document.filename).strip()
    volume = await get_volume(volume_id)
    rep_id = volume["rep_id"]
    vol_id = volume["vol_id"]
    vol_version = volume["vol_version"]
    base_text = document.content
    db_segments = document.segments
    segment_inputs = []
    for segment in db_segments:
        segment_start = int(segment.span_start)
        segment_end = int(segment.span_end)
        segment_title = segment.title or ""
        segment_author = segment.author
        mw_id = f'{volume["mw_id"]}_{segment.id}'
        wa_id = segment.title_bdrc_id or ''
        segment_inputs.append(SegmentInput(
            cstart=segment_start,
            cend=segment_end,
            title_bo=segment_title,
            author_name_bo=segment_author,
            mw_id=mw_id,
            wa_id=wa_id,
            part_type="text" if wa_id != '' else "editorial"
        ))
    return await update_volume(
        volume_id,
        VolumeInput(
            rep_id=rep_id,
            vol_id=vol_id,
            vol_version=vol_version,
            status=bdrc_status,
            base_text=base_text,
            segments=segment_inputs,
        ),
    )


async def submit_document_to_bdrc_in_review(db: Session, document_id: str) -> Dict[str, Any]:
    """Push current outline to BDRC with status in_review, then set document status to completed."""
    document = get_document(db, document_id, include_segments=True)
    modified_by = _bdrc_modified_by_from_document(db, document)
    bdrc_response = await _push_document_segments_to_bdrc(
        document, "in_review", modified_by=modified_by
    )
    update_document_status(db, document_id, "completed")
    return bdrc_response


def list_completed_document_ids_all_segments_checked(
    db: Session,
    only_document_ids: Optional[List[str]] = None,
) -> List[str]:
    """
    Documents with status `completed`, a non-empty BDRC volume id (`filename`),
    at least one segment, and every segment with status `checked`.

    If `only_document_ids` is not None, restrict to that set (after normalization in the caller).
    Empty `only_document_ids` yields no candidates.
    """
    segment_not_checked = exists().where(
        OutlinerSegment.document_id == OutlinerDocument.id,
        or_(
            OutlinerSegment.status.is_(None),
            OutlinerSegment.status != "checked",
        ),
    )
    has_segments = exists().where(
        OutlinerSegment.document_id == OutlinerDocument.id,
    )
    q = db.query(OutlinerDocument.id).filter(
        OutlinerDocument.status == "completed",
        OutlinerDocument.filename.isnot(None),
        OutlinerDocument.filename != "",
        ~segment_not_checked,
        has_segments,
    )
    if only_document_ids is not None:
        if not only_document_ids:
            return []
        q = q.filter(OutlinerDocument.id.in_(only_document_ids))
    rows = q.all()
    return [r[0] for r in rows]


async def sync_outliner_document_to_bdrc_in_review(db: Session, document_id: str) -> Dict[str, Any]:
    """Push outline to BDRC with status in_review; leaves local outliner document status unchanged."""
    document = get_document(db, document_id, include_segments=True)
    modified_by = _bdrc_modified_by_from_document(db, document)
    return await _push_document_segments_to_bdrc(
        document, "in_review", modified_by=modified_by
    )


async def sync_completed_documents_to_bdrc_in_review(
    db: Session,
    only_document_ids: Optional[List[str]] = None,
) -> Dict[str, Any]:
    """
    For each completed outliner document whose segments are all `checked`, push volume to BDRC as `in_review`.
    Per-document failures are collected; successful syncs still apply.
    Progress is appended to backend/sync_status.txt.

    If `only_document_ids` is set, only those IDs are considered (must still satisfy completed / filename / all-checked).
    """
    sync_log = _bdrc_bulk_sync_file_logger()
    document_ids = list_completed_document_ids_all_segments_checked(db, only_document_ids=only_document_ids)
    total = len(document_ids)
    id_to_filename: Dict[str, str] = {}
    if document_ids:
        for row in (
            db.query(OutlinerDocument.id, OutlinerDocument.filename)
            .filter(OutlinerDocument.id.in_(document_ids))
            .all()
        ):
            id_to_filename[row[0]] = (row[1] or "").strip()

    sync_log.info(
        "BDRC bulk sync start candidate_count=%s filter_document_ids=%s document_ids=%s",
        total,
        only_document_ids,
        document_ids,
    )

    succeeded: List[Dict[str, str]] = []
    failed: List[Dict[str, Any]] = []

    for i, document_id in enumerate(document_ids, start=1):
        filename = id_to_filename.get(document_id, "")
        sync_log.info(
            "BDRC bulk sync [%s/%s] pushing document_id=%s filename=%s",
            i,
            total,
            document_id,
            filename,
        )
        try:
            await sync_outliner_document_to_bdrc_in_review(db, document_id)
            succeeded.append({"document_id": document_id, "filename": filename})
            sync_log.info(
                "BDRC bulk sync [%s/%s] OK document_id=%s filename=%s",
                i,
                total,
                document_id,
                filename,
            )
        except HTTPException as e:
            detail = e.detail
            if not isinstance(detail, str):
                detail = str(detail)
            failed.append(
                {
                    "document_id": document_id,
                    "filename": filename,
                    "detail": detail,
                    "status_code": e.status_code,
                }
            )
            sync_log.warning(
                "BDRC bulk sync [%s/%s] FAILED document_id=%s filename=%s status_code=%s detail=%s",
                i,
                total,
                document_id,
                filename,
                e.status_code,
                detail,
            )
        except (TimeoutError, ConnectionError, RuntimeError) as e:
            failed.append({"document_id": document_id, "filename": filename, "detail": str(e)})
            sync_log.warning(
                "BDRC bulk sync [%s/%s] FAILED document_id=%s filename=%s error=%s",
                i,
                total,
                document_id,
                filename,
                e,
                exc_info=True,
            )
        except Exception as e:
            failed.append({"document_id": document_id, "filename": filename, "detail": str(e)})
            sync_log.exception(
                "BDRC bulk sync [%s/%s] FAILED document_id=%s filename=%s unexpected error",
                i,
                total,
                document_id,
                filename,
            )

    sync_log.info(
        "BDRC bulk sync finished candidate_count=%s succeeded=%s failed=%s",
        total,
        len(succeeded),
        len(failed),
    )
    return {
        "candidate_count": len(document_ids),
        "succeeded": succeeded,
        "failed": failed,
    }


async def approve_document(db: Session, document_id: str) -> OutlinerDocument:
    document = get_document(db, document_id , include_segments=True)
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")

    non_approved = db.query(func.count(OutlinerSegment.id)).filter(
        OutlinerSegment.document_id == document_id,
        OutlinerSegment.status != 'approved'
    ).scalar() or 0
    if non_approved > 0:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot approve document: {non_approved} segment(s) are not yet approved"
        )

    modified_by = _bdrc_modified_by_from_document(db, document)
    response_bdrc = await _push_document_segments_to_bdrc(
        document, "reviewed", modified_by=modified_by
    )
    update_document_status(db, document_id, "approved")
    return response_bdrc