"""Outliner segment controller (CRUD, split/merge, bulk)."""
import uuid
from datetime import datetime
from typing import Any, Dict, List, Optional

from fastapi import HTTPException
from sqlalchemy.orm import Session

from outliner.models.outliner import OutlinerSegment, SegmentLabels
from outliner.repository import outliner_repository as outliner_repo
from outliner.utils.segment_title_author_auto import (
    apply_auto_title_to_segment,
    apply_split_auto_title_author_parallel,
)
from outliner.utils.outliner_utils import (
    get_comments_list,
    get_document_with_cache,
    get_annotation_status_delta,
    incremental_update_document_progress,
    infer_segment_label_for_new_segment,
    segment_body_from_document,
    validate_segment_status_transition,
)


def segment_orm_to_document_response_dict(seg: OutlinerSegment) -> Dict[str, Any]:
    """Flat dict for SegmentResponseDocument (stable across commit / session expiry)."""
    return {
        "id": seg.id,
        "segment_index": seg.segment_index,
        "span_start": seg.span_start,
        "span_end": seg.span_end,
        "title": seg.title,
        "author": seg.author,
        "title_span_start": seg.title_span_start,
        "title_span_end": seg.title_span_end,
        "updated_title": seg.updated_title,
        "author_span_start": seg.author_span_start,
        "author_span_end": seg.author_span_end,
        "updated_author": seg.updated_author,
        "reviewer_title": seg.reviewer_title,
        "reviewer_author": seg.reviewer_author,
        "title_bdrc_id": seg.title_bdrc_id,
        "author_bdrc_id": seg.author_bdrc_id,
        "parent_segment_id": seg.parent_segment_id,
        "is_annotated": seg.is_annotated,
        "is_attached": seg.is_attached,
        "status": seg.status,
        "label": seg.label.name if seg.label else None,
        "is_supplied_title": seg.is_supplied_title,
    }


def _segment_orms_from_bulk_data(
    document_id: str,
    document_content: str,
    segments_data: List[Dict[str, Any]],
) -> List[OutlinerSegment]:
    """Build OutlinerSegment instances for bulk insert (not yet added to the session)."""
    db_segments: List[OutlinerSegment] = []
    for segment_data in segments_data:
        segment_text = segment_data.get("text")
        if not segment_text:
            span_start = segment_data["span_start"]
            span_end = segment_data["span_end"]
            if span_start < 0 or span_end > len(document_content):
                raise HTTPException(
                    status_code=400,
                    detail=f"Invalid span addresses for segment at index {segment_data['segment_index']}",
                )
            segment_text = document_content[span_start:span_end]

        title_val = segment_data.get("title")
        label = infer_segment_label_for_new_segment(title_val, segment_text)
        db_segment = OutlinerSegment(
            id=str(uuid.uuid4()),
            document_id=document_id,
            text="",
            segment_index=segment_data["segment_index"],
            span_start=segment_data["span_start"],
            span_end=segment_data["span_end"],
            title=title_val,
            label=label,
            author=segment_data.get("author"),
            title_bdrc_id=segment_data.get("title_bdrc_id"),
            author_bdrc_id=segment_data.get("author_bdrc_id"),
            parent_segment_id=segment_data.get("parent_segment_id"),
            status="unchecked",
        )
        db_segment.update_annotation_status()
        db_segments.append(db_segment)
    return db_segments


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
    
    if span_start < 0 or span_end > len(document.content):
        raise HTTPException(status_code=400, detail="Invalid span addresses")
    segment_text = segment_body_from_document(document.content, span_start, span_end)

    db_segment = OutlinerSegment(
        id=str(uuid.uuid4()),
        document_id=document_id,
        text="",
        segment_index=segment_index,
        span_start=span_start,
        span_end=span_end,
        title=title,
        author=author,
        title_bdrc_id=title_bdrc_id,
        author_bdrc_id=author_bdrc_id,
        parent_segment_id=parent_segment_id,
        label=infer_segment_label_for_new_segment(title, segment_text),
        status='unchecked'  # Default to unchecked
    )
    db_segment.update_annotation_status()

    return outliner_repo.insert_segment(db, db_segment)


def create_segments_bulk(
    db: Session,
    document_id: str,
    segments_data: List[Dict[str, Any]]
) -> List[OutlinerSegment]:
    """Create multiple segments at once"""
    document = get_document_with_cache(db, document_id)
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")

    db_segments = _segment_orms_from_bulk_data(document_id, document.content, segments_data)
    outliner_repo.insert_segments_bulk(db, db_segments)
    return db_segments


def list_segments(db: Session, document_id: str) -> List[OutlinerSegment]:
    """Get all segments for a document"""
    return outliner_repo.list_segments(db, document_id)


def get_segment(db: Session, segment_id: str) -> OutlinerSegment:
    """Get a single segment by ID"""
    segment = outliner_repo.get_segment_with_rejections(db, segment_id)
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
    segment = outliner_repo.get_segment_plain(db, segment_id)
    if not segment:
        raise HTTPException(status_code=404, detail="Segment not found")

    old_status = segment.status
    old_label = segment.label

    # Track old annotation status for incremental update
    old_is_annotated = segment.is_annotated
    document_id = segment.document_id  # Store before updates

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
        prev_status = segment.status
        is_valid, error_msg = validate_segment_status_transition(segment.status, status)
        if not is_valid:
            raise HTTPException(status_code=422, detail=error_msg)
        outliner_repo.apply_segment_review_metadata(
            segment,
            prev_status,
            status,
            patch.get("reviewer_id"),
        )
        outliner_repo.apply_segment_review_title_author_tracking(
            segment, prev_status, status
        )
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
    if "reviewer_title" in patch:
        segment.reviewer_title = patch["reviewer_title"]
    if "reviewer_author" in patch:
        segment.reviewer_author = patch["reviewer_author"]

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

    if old_status == "rejected":
        outliner_repo.mark_latest_rejection_resolved(db, segment_id)

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
        segment = outliner_repo.get_segment_plain(db, segment_id)
        if not segment:
            continue

        old_status = segment.status
        old_label = segment.label
        
        document_ids.add(segment.document_id)
        
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
            new_st = segment_update['status']
            prev_st = segment.status
            is_valid, _ = validate_segment_status_transition(segment.status, new_st)
            if not is_valid:
                continue
            outliner_repo.apply_segment_review_metadata(
                segment,
                prev_st,
                new_st,
                segment_update.get('reviewer_id'),
            )
            outliner_repo.apply_segment_review_title_author_tracking(
                segment, prev_st, new_st
            )
            segment.status = new_st
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
        if 'reviewer_title' in segment_update:
            segment.reviewer_title = segment_update['reviewer_title']
        if 'reviewer_author' in segment_update:
            segment.reviewer_author = segment_update['reviewer_author']

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
        if old_status == "rejected":
            outliner_repo.mark_latest_rejection_resolved(db, segment.id)
        updated_segments.append(segment)

    outliner_repo.commit_and_refresh_segments(db, updated_segments)

    return updated_segments


def split_segment(
    db: Session,
    segment_id: str,
    split_position: int,
    document_id: Optional[str] = None
) -> List[OutlinerSegment]:
    """Split a segment at a given position"""
    segment = outliner_repo.get_segment_by_pk(db, segment_id)

    # If segment doesn't exist, check if we need to create initial segment from document
    if not segment:
        if not document_id:
            raise HTTPException(status_code=404, detail="Segment not found")

        document = get_document_with_cache(db, document_id)
        if not document:
            raise HTTPException(status_code=404, detail="Document not found")

        if outliner_repo.document_has_any_segment(db, document_id):
            raise HTTPException(status_code=404, detail="Segment not found")

        if not document.content or len(document.content.strip()) == 0:
            raise HTTPException(status_code=400, detail="Document has no content to split")

        segment = OutlinerSegment(
            id=str(uuid.uuid4()),
            document_id=document_id,
            text="",
            segment_index=0,
            span_start=0,
            span_end=len(document.content),
            title=None,
            author=None,
            parent_segment_id=None,
            label=SegmentLabels.FRONT_MATTER,
            status='unchecked',
        )
        segment.update_annotation_status()
        outliner_repo.add_segment_flush(db, segment)

    doc_for_body = get_document_with_cache(db, segment.document_id)
    if not doc_for_body:
        raise HTTPException(status_code=404, detail="Document not found")
    content = doc_for_body.content or ""
    body = segment_body_from_document(content, segment.span_start, segment.span_end)

    # IMPORTANT: Do not strip/trim. split_position is a character offset within the segment body
    # (slice of document.content [span_start, span_end)).
    if split_position <= 0 or split_position >= len(body):
        raise HTTPException(status_code=400, detail="Invalid split position")

    old_span_start = segment.span_start
    old_span_end = segment.span_end
    new_first_span_end = old_span_start + split_position

    # Safety check: split position must fall within the segment span
    if new_first_span_end < old_span_start or new_first_span_end > old_span_end:
        raise HTTPException(status_code=400, detail="Invalid split position for segment span")

    text_before = body[:split_position]
    text_after = body[split_position:]

    # Update first segment (preserve whitespace/newlines; update span_end using split_position)
    segment.text = ""
    segment.span_end = new_first_span_end
    upper_label = infer_segment_label_for_new_segment(segment.title, text_before)
    lower_label = infer_segment_label_for_new_segment(None, text_after)
    if lower_label == SegmentLabels.TOC or upper_label == SegmentLabels.FRONT_MATTER:
        segment.label = SegmentLabels.FRONT_MATTER
    label = lower_label

    # Create second segment
    new_segment = OutlinerSegment(
        id=str(uuid.uuid4()),
        document_id=segment.document_id,
        text="",
        segment_index=segment.segment_index + 1,
        span_start=new_first_span_end,
        span_end=old_span_end,
        title=None,
        author=None,        
        label=label,
        parent_segment_id=segment.parent_segment_id,
        status=segment.status or 'unchecked'
    )

    outliner_repo.execute_bump_segment_indices_after(
        db, segment.document_id, segment.segment_index
    )

    outliner_repo.add_segment(db, new_segment)
    # Upper title + upper author + lower title: independent Gemini calls, run concurrently
    apply_split_auto_title_author_parallel(segment, new_segment, text_before, text_after)
    segment.update_annotation_status()
    new_segment.update_annotation_status()
    outliner_repo.commit_session(db)

    return [segment, new_segment]


def merge_segments(
    db: Session,
    segment_ids: List[str]
) -> OutlinerSegment:
    """Merge multiple segments into one"""
    if len(segment_ids) < 2:
        raise HTTPException(status_code=400, detail="At least 2 segments required for merge")
    
    segments = outliner_repo.fetch_segments_ordered_by_ids(db, segment_ids)
    
    if len(segments) != len(segment_ids):
        raise HTTPException(status_code=404, detail="One or more segments not found")
    
    # Check all segments belong to same document
    document_id = segments[0].document_id
    if not all(seg.document_id == document_id for seg in segments):
        raise HTTPException(status_code=400, detail="All segments must belong to same document")
    
    # Merge spans and metadata (body text lives on OutlinerDocument.content only)
    merged_title = next((seg.title for seg in segments if seg.title), None)
    merged_author = next((seg.author for seg in segments if seg.author), None)
    merged_title_bdrc_id = next((seg.title_bdrc_id for seg in segments if seg.title_bdrc_id), None)
    merged_author_bdrc_id = next((seg.author_bdrc_id for seg in segments if seg.author_bdrc_id), None)
    merged_parent_id = segments[0].parent_segment_id
    
    # Update first segment with merged data
    first_segment = segments[0]
    first_segment.text = ""
    first_segment.span_end = segments[-1].span_end
    first_segment.title = merged_title
    first_segment.author = merged_author
    first_segment.title_bdrc_id = merged_title_bdrc_id
    first_segment.author_bdrc_id = merged_author_bdrc_id
    first_segment.parent_segment_id = merged_parent_id
    first_segment.update_annotation_status()
    
    # Get IDs of segments to be deleted (all except the first)
    segments_to_delete_ids = [seg.id for seg in segments[1:]]
    
    for seg in segments[1:]:
        outliner_repo.delete_orm_entity(db, seg)

    following_segments = outliner_repo.fetch_following_segments_excluding_ids(
        db, document_id, first_segment.segment_index, segments_to_delete_ids
    )

    shift_amount = len(segments) - 1
    for seg in following_segments:
        seg.segment_index -= shift_amount

    outliner_repo.merge_segments_persist(db, first_segment)

    return first_segment


def delete_segment(db: Session, segment_id: str) -> None:
    """Delete a segment"""
    segment = outliner_repo.get_segment_plain(db, segment_id)
    if not segment:
        raise HTTPException(status_code=404, detail="Segment not found")
    outliner_repo.delete_segment_and_reindex(db, segment)


def update_segment_status(
    db: Session,
    segment_id: str,
    status: str,
    reviewer_id: Optional[str] = None,
) -> Dict[str, str]:
    """Update segment status with transition validation"""
    segment = outliner_repo.get_segment_plain(db, segment_id)
    if not segment:
        raise HTTPException(status_code=404, detail="Segment not found")

    old_status = segment.status
    is_valid, error_msg = validate_segment_status_transition(segment.status, status)
    if not is_valid:
        raise HTTPException(status_code=422, detail=error_msg)

    outliner_repo.update_segment_status_persist(db, segment, status, reviewer_id)

    if old_status == "rejected":
        outliner_repo.mark_latest_rejection_resolved(db, segment_id)

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
    
    try:
        return outliner_repo.bulk_segment_operations_execute(
            db, document, create=create, update=update, delete=delete
        )
    except ValueError as e:
        msg = str(e)
        if "Invalid span addresses" in msg:
            raise HTTPException(status_code=400, detail=msg) from e
        if "not found" in msg.lower():
            raise HTTPException(status_code=404, detail=msg) from e
        raise HTTPException(status_code=422, detail=msg) from e
