"""
Controller for outliner document and segment operations.
"""
import uuid
from typing import List, Optional, Dict, Any
from datetime import datetime
from fastapi import HTTPException
from sqlalchemy.orm import Session
from sqlalchemy.orm.attributes import flag_modified
from sqlalchemy import func
from sqlalchemy.orm.session import identity
from outliner.models.outliner import OutlinerDocument, OutlinerSegment
from outliner.utils.outliner_utils import (
    get_document_with_cache,
    update_document_progress,
    incremental_update_document_progress,
    get_annotation_status_delta,
    get_comments_list,
    remove_escape_chars_except_newline,
    set_document_content_in_cache,
    invalidate_document_content_cache
)


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
        total_segments=0,
        annotated_segments=0,
        status='active',
        progress_percentage=0.0
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
    skip: int = 0,
    limit: int = 100,
    include_deleted: bool = False
) -> List[Dict[str, Any]]:
    """
    List all outliner documents, optionally filtered by user and deletion status.
    
    Args:
        db: Database session
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
            OutlinerSegment.status != 'checked'
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
        # Load only selected fields for each segment
        segments = db.query(
            OutlinerSegment.span_start,
            OutlinerSegment.span_end,
            OutlinerSegment.is_attached,
            OutlinerSegment.segment_index,
            OutlinerSegment.id,
            OutlinerSegment.status,
            OutlinerSegment.title,
            OutlinerSegment.author,
            OutlinerSegment.title_bdrc_id,
            OutlinerSegment.author_bdrc_id,
            OutlinerSegment.comment
        ).filter(
            OutlinerSegment.document_id == document_id
        ).order_by(OutlinerSegment.segment_index).all()
        # Instead of assigning a list of dicts directly (which breaks SQLAlchemy relations), store the segments as an extra attribute for serialization
        document.segment_list = [dict(segment._asdict()) for segment in segments]

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
        "total_segments": document.total_segments,
        "annotated_segments": document.annotated_segments,
        "checked_segments": checked or 0,
        "unchecked_segments": unchecked or 0,
        "progress_percentage": document.progress_percentage,
        "updated_at": document.updated_at
    }


def reset_segments(db: Session, document_id: str) -> None:
    """Delete all segments for a document"""
    document = db.query(OutlinerDocument).filter(OutlinerDocument.id == document_id).first()
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")
    
    # Delete all segments for this document
    db.query(OutlinerSegment).filter(OutlinerSegment.document_id == document_id).delete()
    
    # Update document progress
    update_document_progress(db, document_id)
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
    update_document_progress(db, document_id)
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
        
        db_segment = OutlinerSegment(
            id=str(uuid.uuid4()),
            document_id=document_id,
            text=segment_text,
            segment_index=segment_data['segment_index'],
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
        db_segments.append(db_segment)
        db.add(db_segment)
    
    update_document_progress(db, document_id)
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
    text: Optional[str] = None,
    title: Optional[str] = None,
    author: Optional[str] = None,
    title_bdrc_id: Optional[str] = None,
    author_bdrc_id: Optional[str] = None,
    parent_segment_id: Optional[str] = None,
    is_attached: Optional[bool] = None,
    status: Optional[str] = None,
    comment: Optional[str] = None,
    comment_content: Optional[str] = None,
    comment_username: Optional[str] = None
) -> OutlinerSegment:
    """
    PERFORMANCE OPTIMIZED: Update a segment's content or annotations.
    
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
    
    # Track old annotation status for incremental update
    old_is_annotated = segment.is_annotated
    document_id = segment.document_id  # Store before updates
    
    # Update fields if provided
    if text is not None:
        segment.text = text
    if title is not None:
        segment.title = title
    if author is not None:
        segment.author = author
    if title_bdrc_id is not None:
        segment.title_bdrc_id = title_bdrc_id
    if author_bdrc_id is not None:
        segment.author_bdrc_id = author_bdrc_id
    if parent_segment_id is not None:
        segment.parent_segment_id = parent_segment_id
    if is_attached is not None:
        segment.is_attached = is_attached
    if comment is not None:
        # Backward compatibility: if old comment format is used, convert to new format
        segment.comment = comment
    # Handle new comment format: append comment with username
    if comment_content is not None and comment_username is not None:
        # Get existing comments using helper function
        existing_comments = get_comments_list(segment)
        
        # Append new comment
        new_comment = {
            "content": comment_content,
            "username": comment_username,
            "timestamp": datetime.utcnow().isoformat()
        }
        existing_comments.append(new_comment)
        
        # Store as array directly
        segment.comment = existing_comments
    if status is not None:
        # Validate status value
        if status not in ['checked', 'unchecked', 'approved']:
            raise HTTPException(status_code=400, detail="Status must be 'checked' or 'unchecked'")
        segment.status = status
    
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
        
        document_ids.add(segment.document_id)
        
        if segment_update.get('text') is not None:
            segment.text = segment_update['text']
        if segment_update.get('title') is not None:
            segment.title = segment_update['title']
        if segment_update.get('author') is not None:
            segment.author = segment_update['author']
        if segment_update.get('title_bdrc_id') is not None:
            segment.title_bdrc_id = segment_update['title_bdrc_id']
        if segment_update.get('author_bdrc_id') is not None:
            segment.author_bdrc_id = segment_update['author_bdrc_id']
        if segment_update.get('parent_segment_id') is not None:
            segment.parent_segment_id = segment_update['parent_segment_id']
        if segment_update.get('is_attached') is not None:
            segment.is_attached = segment_update['is_attached']
        if segment_update.get('status') is not None:
            # Validate status value
            if segment_update['status'] not in ['checked', 'unchecked']:
                continue  # Skip invalid status updates
            segment.status = segment_update['status']
        
        segment.update_annotation_status()
        segment.updated_at = datetime.utcnow()
        updated_segments.append(segment)
    
    # Update progress for all affected documents
    for doc_id in document_ids:
        update_document_progress(db, doc_id)
    
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
    
    # Delete other segments and update indices
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
    
    update_document_progress(db, document_id)
    db.commit()


def update_segment_status(
    db: Session,
    segment_id: str,
    status: str
) -> Dict[str, str]:
    """Update segment status (checked/unchecked)"""
    # Validate status value
    if status not in ['checked', 'unchecked', 'approved']:
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
    
    # Update document progress
    update_document_progress(db, document_id)
    
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



# ==================== BDRC Operations ====================

from bdrc.main import get_new_volume
from bdrc.volume import SegmentInput, VolumeInput, get_volume, update_volume, update_volume_status


async def assign_volume(db: Session, user_id: str) -> OutlinerDocument:
    """Assign a volume to a document"""
    volume_data = await get_new_volume()
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
    print(f"filename: {volume_id}")
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
    return text
    
    
    
    
    
# ==================== Approval Operations ====================

async def approve_document(db: Session, document_id: str) -> OutlinerDocument:
    document = get_document(db, document_id , include_segments=True)
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")
    
    volume_id=document.filename
    #get volume from bdrc
    volume = await get_volume(volume_id)
    
  
    rep_id=volume["rep_id"]
    vol_id=volume["vol_id"]
    vol_version=volume["vol_version"]
    status="reviewed"
    base_text=document.content
    db_segments=document.segments
    segment_inputs = []
    for segment in db_segments:
        segment_start=int(segment.span_start)
        segment_end=int(segment.span_end)
        segment_title=segment.title
        segment_author=segment.author
        mw_id=f'{volume["mw_id"]}_{segment.id}'
        wa_id=segment.title_bdrc_id or ''
        segment_inputs.append(SegmentInput(
            cstart=segment_start,
            cend=segment_end,
            title_bo=segment_title,
            author_name_bo=segment_author,
            mw_id=mw_id,
            wa_id=wa_id,
            part_type="text" if wa_id != '' else "editorial"
        ))
    
    response_bdrc = await update_volume(volume_id, VolumeInput(
        rep_id=rep_id,
        vol_id=vol_id,
        vol_version=vol_version,
        status=status,
        base_text=base_text,
        segments=segment_inputs
    ))
    return response_bdrc