"""Segment CRUD controller (single segment create/read/update/delete/status)."""
import uuid
from datetime import datetime
from typing import Any, Dict, List, Optional

from fastapi import HTTPException
from sqlalchemy.orm import Session

from outliner.controller.segment_common import (
    _normalize_reviewer_title_value,
    _segment_orms_from_bulk_data,
)
from outliner.models.outliner import OutlinerSegment, SegmentLabels
from outliner.repository import outliner_repository as outliner_repo
from outliner.utils.segment_title_author_auto import apply_auto_title_to_segment
from outliner.utils.outliner_utils import (
    get_comments_list,
    get_document_with_cache,
    get_annotation_status_delta,
    incremental_update_document_progress,
    infer_segment_label_for_new_segment,
    segment_body_from_document,
    validate_segment_status_transition,
)


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
        status='unchecked'
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
    """
    segment = outliner_repo.get_segment_plain(db, segment_id)
    if not segment:
        raise HTTPException(status_code=404, detail="Segment not found")

    old_status = segment.status
    old_label = segment.label

    old_is_annotated = segment.is_annotated
    document_id = segment.document_id

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
        segment.comment = patch["comment"]
    if patch.get("comment_content") is not None and patch.get("comment_username") is not None:
        existing_comments = get_comments_list(segment)
        new_comment = {
            "content": patch["comment_content"],
            "username": patch["comment_username"],
            "timestamp": datetime.utcnow().isoformat()
        }
        existing_comments.append(new_comment)
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
        segment.reviewer_title = _normalize_reviewer_title_value(patch["reviewer_title"])
    if "reviewer_author" in patch:
        segment.reviewer_author = patch["reviewer_author"]

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
    if label_became_text and not user_nonempty_title:
        apply_auto_title_to_segment(db, segment)

    segment.update_annotation_status()
    new_is_annotated = segment.is_annotated
    segment.updated_at = datetime.utcnow()

    annotated_delta = get_annotation_status_delta(old_is_annotated, new_is_annotated)
    if annotated_delta != 0:
        incremental_update_document_progress(
            db=db,
            document_id=document_id,
            total_delta=0,
            annotated_delta=annotated_delta
        )

    if old_status == "rejected":
        outliner_repo.mark_latest_rejection_resolved(db, segment_id)

    return segment


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
