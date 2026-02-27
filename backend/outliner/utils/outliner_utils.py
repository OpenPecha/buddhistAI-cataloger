"""
Utility functions for outliner operations.
"""
import re
from typing import Optional, List, Dict, Any
from datetime import datetime
from sqlalchemy.orm import Session
from sqlalchemy import func
from core.redis import (
    get_document_content_from_cache,
    set_document_content_in_cache,
    invalidate_document_content_cache
)
from outliner.models.outliner import OutlinerDocument, OutlinerSegment


def remove_escape_chars_except_newline(text: str) -> str:
    """
    Removes all ASCII control characters except newline (\n).
    """
    # ASCII control chars: 0x00–0x1F and 0x7F
    # Keep \n (0x0A)
    return re.sub(r'[\x00-\x09\x0B-\x1F\x7F]', '', text)


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

    # PERFORMANCE FIX: Fetch document once, update in memory
    # This is still much faster than COUNT queries on large segment tables
    document = db.query(OutlinerDocument).filter(OutlinerDocument.id == document_id).first()
    if not document:
        return  # Document doesn't exist, skip update
    
    
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


def get_comments_list(segment: OutlinerSegment) -> List[Dict[str, Any]]:
    """
    Helper function to extract comments list from segment.comment field.
    
    Args:
        segment: OutlinerSegment instance
        
    Returns:
        List of comment dictionaries
    """
    import json
    if not segment.comment:
        return []
    
    try:
        # New format: comments are stored directly as an array
        if isinstance(segment.comment, list):
            # Return a copy to avoid mutating the original list
            return list(segment.comment)
        
        
    
            
    except Exception:
        return [{"content": str(segment.comment), "username": "Unknown", "timestamp": datetime.utcnow().isoformat()}]
    
    return []
